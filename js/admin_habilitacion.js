(function () {
  "use strict";

  const UNLOCK_LOG_KEY = "sena_portal_admin_unlock_log_v1";
  const MAX_LOG_ENTRIES = 200;

  // ── Trazabilidad ────────────────────────────────────────────────────────────

  function readUnlockLog() {
    try {
      const raw = localStorage.getItem(UNLOCK_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeUnlockLog(entries) {
    localStorage.setItem(UNLOCK_LOG_KEY, JSON.stringify(entries.slice(0, MAX_LOG_ENTRIES)));
  }

  function recordUnlock(entry) {
    const auth = window.portalAuth;
    const session = auth?.getCurrentSession?.();
    const actor =
      session?.user?.username ||
      session?.user?.fullName ||
      session?.usernameKey ||
      "admin";
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      actor,
      usernameKey: String(entry?.usernameKey || ""),
      learnerName: String(entry?.learnerName || ""),
      ficha: String(entry?.ficha || ""),
      guideFile: String(entry?.guideFile || ""),
      guideTitle: String(entry?.guideTitle || ""),
      activityId: String(entry?.activityId || ""),
      activityLabel: String(entry?.activityLabel || ""),
      motivo: String(entry?.motivo || "Sin motivo registrado"),
    };
    writeUnlockLog([record, ...readUnlockLog()]);
    return record;
  }

  // ── Utilidades de presentación ───────────────────────────────────────────────

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtDate(v) {
    if (!v) return "Sin registro";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "Sin registro";
    return d.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function normalize(v) {
    return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  // ── Aliases de archivo para sincronizacion Firestore ──────────────────────
  // Cada script de guia define su STORAGE_FILE_ALIASES (pageFile → cloudAlias).
  // El admin necesita conocer esos aliases para hacer cloudGetGuideData con
  // la cloudAlias correcta. Mantener sincronizado con los scripts de guia.
  const CLOUD_FILE_ALIASES = {
    "grupo-10a-guia-01-induccion.html": "10a_guia.html",
    "grupo-10b-guia-01-induccion.html": "10b_guia.html",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "10a_guia2.html",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "10b_guia2.html",
    "grupo-10a-guia-03-planificar-informacion.html": "10a_guia3.html",
    "grupo-10b-guia-03-planificar-informacion.html": "10b_guia3.html",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
    "grupo-11a-guia-06-planificar-informacion.html": "11a_guia6.html",
    "grupo-11b-guia-06-planificar-informacion.html": "11b_guia6.html",
    // Redes (Santa Barbara) usa su propio nombre sin alias
  };

  function getCloudFileName(pageFile) {
    return CLOUD_FILE_ALIASES[pageFile] || pageFile;
  }

  // ── Sincronizacion de estado desde Firestore ──────────────────────────────
  // Tras pull, los datos quedan en localStorage del navegador del admin con la
  // misma clave que usa el aprendiz, asi getLockedActivities los detecta.
  async function pullCloudStateForUsers(users, deps) {
    const auth = deps?.auth || window.portalAuth;
    const fb = window._firebaseDb;
    if (!fb || typeof fb.cloudGetGuideData !== "function") {
      throw new Error("Firebase no esta disponible.");
    }
    if (typeof auth?.getStudentStorageKey !== "function") {
      throw new Error("portalAuth.getStudentStorageKey no esta disponible.");
    }
    const getStateKey = deps?.getGuideActivityStateKey;
    if (typeof getStateKey !== "function") {
      throw new Error("getGuideActivityStateKey no esta disponible.");
    }
    const onProgress = typeof deps?.onProgress === "function" ? deps.onProgress : null;
    const totalUsers = users.length;
    const results = { fetched: 0, merged: 0, errors: 0 };

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const usernameKey = user.usernameKey;
      if (!usernameKey) continue;
      const scopeKey = `student:${usernameKey}`;
      const guideFiles = typeof auth.getGuidesForFicha === "function"
        ? auth.getGuidesForFicha(user.ficha)
        : [];
      for (const pageFile of guideFiles) {
        const stateKey = getStateKey(pageFile);
        if (!stateKey) continue;
        const cloudFileName = getCloudFileName(pageFile);
        try {
          results.fetched += 1;
          if (onProgress) onProgress({ idx: i + 1, total: totalUsers, fullName: user.fullName, pageFile });
          const remote = await fb.cloudGetGuideData(scopeKey, cloudFileName);
          if (!remote || typeof remote !== "object") continue;
          // El payload puede ser el state directo o estar dentro de .state
          const remoteState = remote.state && typeof remote.state === "object"
            ? remote.state
            : remote;
          if (!remoteState || typeof remoteState !== "object") continue;
          // Mergear con lo que ya este en localStorage (last-write-wins por -locked).
          const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
          let localState = {};
          try {
            const raw = localStorage.getItem(storageKey);
            localState = raw ? JSON.parse(raw) : {};
          } catch (_) { localState = {}; }
          const merged = Object.assign({}, localState, remoteState);
          localStorage.setItem(storageKey, JSON.stringify(merged));
          // Guardar tambien el meta updatedAt si viene
          if (remote.updatedAt) {
            try {
              localStorage.setItem(`${storageKey}__meta`, JSON.stringify({ updatedAt: remote.updatedAt }));
            } catch (_) { /* noop */ }
          }
          results.merged += 1;
        } catch (err) {
          results.errors += 1;
          console.warn("[adminHabilitacion] pull failed for", usernameKey, pageFile, err);
        }
      }
    }
    return results;
  }

  // ── Detección de actividades bloqueadas ────────────────────────────────────
  // Recibe una lista de usuarios y el catálogo de actividades por guía;
  // devuelve un array plano de { user, guideFile, guideTitle, activityId, activityLabel, lockedAt }.

  function getLockedActivities(users, deps) {
    const auth = deps?.auth || window.portalAuth;
    const deadlineManager = deps?.deadlineManager || window.activityDeadlineManager;
    const readJson = deps?.readJson || ((v, fb) => { try { return v ? JSON.parse(v) : fb; } catch { return fb; } });
    const getUnlockActivities = deps?.getUnlockActivitiesForGuide;
    const getStateKey = deps?.getGuideActivityStateKey;

    if (typeof getUnlockActivities !== "function" || typeof getStateKey !== "function") return [];

    const results = [];

    users.forEach((user) => {
      const usernameKey = user.usernameKey;
      const guideFiles = typeof auth?.getGuidesForFicha === "function"
        ? auth.getGuidesForFicha(user.ficha)
        : (user.progress?.guides || []).map((g) => g.fileName);

      guideFiles.forEach((fileName) => {
        const activities = getUnlockActivities(fileName);
        if (!activities.length) return;

        const stateKey = getStateKey(fileName);
        if (!stateKey) return;

        const storageKey = typeof auth?.getStudentStorageKey === "function"
          ? auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" })
          : null;

        const state = storageKey
          ? readJson(localStorage.getItem(storageKey), {})
          : {};
        const meta = storageKey
          ? readJson(localStorage.getItem(`${storageKey}__meta`), {})
          : {};

        activities.forEach((activity) => {
          if (!Array.isArray(activity.keys) || activity.keys.length === 0) return;
          const lockKey = activity.keys.find((k) => /-locked$/.test(k));
          if (!lockKey) return;
          if (state[lockKey] !== true) return;

          // También chequear deadline-lock
          let deadlineLocked = false;
          let dueAt = null;
          if (deadlineManager) {
            const policy = deadlineManager.getPolicy(fileName, activity.id);
            dueAt = policy?.dueAt || null;
            if (dueAt && new Date() > new Date(dueAt)) deadlineLocked = true;
          }

          results.push({
            user,
            guideFile: fileName,
            guideTitle: typeof auth?.getGuideTitle === "function" ? auth.getGuideTitle(fileName) : fileName,
            activityId: activity.id,
            activityLabel: activity.label || activity.id,
            lockedAt: meta?.updatedAt || "",
            dueAt,
            deadlineLocked,
            stateKey,
            lockKeys: activity.keys,
          });
        });
      });
    });

    return results;
  }

  // ── Panel principal de habilitación ────────────────────────────────────────

  function buildHabilitacionPanel(allUsers, deps) {
    const filters = deps?.filters || {};
    const nameFilter = normalize(filters.name || "");
    const fichaFilter = String(filters.ficha || "").trim();
    const guideFilter = String(filters.guide || "").trim();
    const activityFilter = normalize(filters.activity || "");

    let locked = getLockedActivities(allUsers, deps);

    if (nameFilter) locked = locked.filter((r) => normalize(r.user.fullName).includes(nameFilter));
    if (fichaFilter) locked = locked.filter((r) => String(r.user.ficha) === fichaFilter);
    if (guideFilter) locked = locked.filter((r) => r.guideFile === guideFilter);
    if (activityFilter) locked = locked.filter((r) => normalize(r.activityLabel).includes(activityFilter));

    const guideOptions = [...new Map(
      getLockedActivities(allUsers, deps).map((r) => [r.guideFile, r.guideTitle])
    ).entries()];

    const fichaOptions = [...new Set(allUsers.map((u) => u.ficha))].sort();

    const filterBar = `
      <div class="hab-filters toolbar">
        <input type="search" id="hab-filter-name" placeholder="Buscar por aprendiz"
          value="${esc(filters.name || "")}">
        <label class="toolbar-select" for="hab-filter-ficha">
          <span>Ficha</span>
          <select id="hab-filter-ficha">
            <option value="">Todas las fichas</option>
            ${fichaOptions.map((f) => `<option value="${esc(f)}"${fichaFilter === f ? " selected" : ""}>${esc(f)}</option>`).join("")}
          </select>
        </label>
        <label class="toolbar-select" for="hab-filter-guide">
          <span>Guía</span>
          <select id="hab-filter-guide">
            <option value="">Todas las guías</option>
            ${guideOptions.map(([f, t]) => `<option value="${esc(f)}"${guideFilter === f ? " selected" : ""}>${esc(t)}</option>`).join("")}
          </select>
        </label>
        <input type="search" id="hab-filter-activity" placeholder="Buscar actividad"
          value="${esc(filters.activity || "")}">
        <button type="button" id="hab-cloud-sync"
          class="btn secondary btn--sm"
          title="Trae desde Firestore el estado de los aprendices de la ficha filtrada (o de todas las fichas) y refresca la lista de actividades bloqueadas. Util cuando el aprendiz guardo desde otro navegador o dispositivo."
          style="display:inline-flex;align-items:center;gap:6px;font-weight:600">
          &#128260; Cargar estado desde la nube
        </button>
      </div>
      <div id="hab-cloud-sync-status" style="margin-top:8px;font-size:.82rem;color:#4b5563;min-height:18px"></div>
    `;

    if (!locked.length) {
      return `
        <section class="panel">
          <h2>Habilitación de actividades bloqueadas</h2>
          <p class="activities-section-copy">
            Desde aquí el administrador puede habilitar nuevamente actividades que los aprendices ya entregaron
            o que quedaron bloqueadas por fecha límite. Cada habilitación queda registrada con motivo y fecha.
          </p>
          ${filterBar}
          <p class="activities-empty" style="margin-top:1.5rem;">
            No se encontraron actividades bloqueadas que coincidan con los filtros actuales.
          </p>
        </section>
        ${buildLogSection()}
      `;
    }

    const rows = locked.map((r) => {
      const statusLabel = r.deadlineLocked
        ? '<span class="act-delivery-status act-delivery-status--blocked">Vencida y bloqueada</span>'
        : '<span class="act-delivery-status act-delivery-status--sent">Entregada y bloqueada</span>';

      return `
        <tr>
          <td>${esc(r.user.fullName)}</td>
          <td>${esc(r.user.ficha)}</td>
          <td>${esc(r.user.inst)}</td>
          <td title="${esc(r.guideTitle)}">${esc(r.guideTitle.split("|")[0].trim())}</td>
          <td>${esc(r.activityLabel)}</td>
          <td>${statusLabel}</td>
          <td>${r.lockedAt ? esc(fmtDate(r.lockedAt)) : "Sin registro"}</td>
          <td>
            <div class="hab-action-cell">
              <input
                type="text"
                class="hab-motivo-input"
                placeholder="Motivo (opcional)"
                data-hab-motivo="${esc(r.user.usernameKey)}::${esc(r.guideFile)}::${esc(r.activityId)}"
                maxlength="200"
              >
              <button
                class="btn secondary btn--sm"
                type="button"
                data-hab-unlock="${esc(r.user.usernameKey)}"
                data-hab-guide="${esc(r.guideFile)}"
                data-hab-activity="${esc(r.activityId)}"
                data-hab-state-key="${esc(r.stateKey)}"
                data-hab-label="${esc(r.activityLabel)}"
                data-hab-guide-title="${esc(r.guideTitle)}"
                data-hab-learner="${esc(r.user.fullName)}"
                data-hab-ficha="${esc(r.user.ficha)}"
                data-hab-lock-keys="${esc(r.lockKeys.join(","))}"
              >
                Habilitar
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");

    return `
      <section class="panel">
        <h2>Habilitación de actividades bloqueadas</h2>
        <p class="activities-section-copy">
          Desde aquí el administrador puede habilitar nuevamente actividades que los aprendices ya entregaron
          o que quedaron bloqueadas por fecha límite. Cada habilitación queda registrada con motivo, fecha y responsable.
        </p>
        ${filterBar}
        <p class="hab-count">${locked.length} actividad${locked.length !== 1 ? "es" : ""} bloqueada${locked.length !== 1 ? "s" : ""} encontrada${locked.length !== 1 ? "s" : ""}.</p>
        <div class="answer-table-wrap">
          <table class="answer-table activities-table">
            <thead>
              <tr>
                <th>Aprendiz</th>
                <th>Ficha</th>
                <th>Institución</th>
                <th>Guía</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Bloqueada el</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      ${buildLogSection()}
    `;
  }

  // ── Sección de trazabilidad ────────────────────────────────────────────────

  function buildLogSection() {
    const log = readUnlockLog();
    if (!log.length) return "";

    const rows = log.slice(0, 30).map((entry) => `
      <tr>
        <td>${esc(fmtDate(entry.at))}</td>
        <td>${esc(entry.actor)}</td>
        <td>${esc(entry.learnerName)}</td>
        <td>${esc(entry.ficha)}</td>
        <td title="${esc(entry.guideTitle)}">${esc(entry.activityLabel)}</td>
        <td>${esc(entry.motivo)}</td>
      </tr>`).join("");

    return `
      <section class="panel" style="margin-top:2rem;">
        <h2>Historial de habilitaciones</h2>
        <p class="activities-section-copy">Últimas ${Math.min(log.length, 30)} habilitaciones registradas en este navegador.</p>
        <div class="answer-table-wrap">
          <table class="answer-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Aprendiz</th>
                <th>Ficha</th>
                <th>Actividad</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  window.adminHabilitacion = Object.freeze({
    buildHabilitacionPanel,
    recordUnlock,
    readUnlockLog,
    getLockedActivities,
    pullCloudStateForUsers,
    getCloudFileName,
  });
})();
