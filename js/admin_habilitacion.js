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
      </div>
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
  });
})();
