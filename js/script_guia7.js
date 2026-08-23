// script_guia7.js — Guia 7: Planificar la informacion segun criterios de ciberseguridad (RAP 03)
// Santa Barbara 11A / 11B. Usa ActivityStandard para guardar/bloquear/exportar Word.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  const STORAGE_FILE_ALIASES = {
    "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "11a_guia7.html",
    "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "11b_guia7.html",
  };
  const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia7";

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;

  // ── Estado ────────────────────────────────────────────────────────────────
  // Carga/guardado/hidratacion desde la nube/reintento centralizados en
  // js/guide_cloud_sync.js (antes cada guion los reimplementaba por su cuenta;
  // 8 de ellas, incluida esta, nunca leian de la nube al cargar -- auditoria
  // 2026-08-22).

  let state = window.GuideCloudSync
    ? window.GuideCloudSync.loadLocal(STORAGE_KEY, LEGACY_STORAGE_KEY)
    : {};
  let guia7Booted = false;

  function getActor() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "Aprendiz";
  }

  const cloudStore = window.GuideCloudSync?.createStore({
    storageKey: STORAGE_KEY,
    legacyStorageKey: LEGACY_STORAGE_KEY,
    guideDataFile: GUIDE_DATA_FILE,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: getActor,
    periodicRefreshMs: 300000,
    onHydrated: () => { hydrateFields(); updateProgress(); },
  });

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    cloudStore?.notifyChanged();
    updateProgress();
  }

  // ── Hidratacion y binding de formularios ──────────────────────────────────

  function hydrateFields() {
    document.querySelectorAll("[data-store]").forEach((el) => {
      const key = el.getAttribute("data-store");
      if (!key) return;
      const value = state[key];
      if (typeof value === "string" || typeof value === "number") {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") {
          el.value = value;
        }
      }
    });
  }

  function bindFieldEvents() {
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target?.matches?.("[data-store]")) return;
      const key = target.getAttribute("data-store");
      if (!key) return;
      state[key] = target.value;
      saveState();
    });
  }

  // ── stateCtx para ActivityStandard ────────────────────────────────────────

  function getGuideSelection() {
    const ds = document.body.dataset || {};
    return {
      ficha: ds.ficha || ds.defaultFicha || "",
      grupo: ds.grupo || ds.defaultGrupo || "",
      inst: ds.inst || ds.defaultInst || "",
    };
  }

  function getCurrentLearnerName() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "";
  }

  function getStateCtx() {
    return {
      getState: () => state,
      saveState,
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      // ActivityStandard registry y activityDeadlineManager se llevan por el
      // nombre completo del HTML (PAGE_FILE), no por el alias de storage.
      getGuideMetadata: () =>
        window.ActivityStandard?.getConfigForGuide(PAGE_FILE) || {},
      getGuideDataFile: () => PAGE_FILE,
    };
  }

  // ── Selector de equipo por actividad (max 3) ──────────────────────────────
  // 3.1.2 y 3.2.1: equipo de 3 (incluyendote 2 companeros).
  // Por simetria con Guia 6, cada actividad puede tener su propio equipo. Por
  // cada mount persiste su equipo de forma independiente.

  const EQUIPO_G7_STATE_KEY_PREFIX = "equipoGuia7_";
  const EQUIPO_G7_ACTIVITY_IDS = ["plenaria312", "bloqueAB321"];
  const EQUIPO_G7_EMAIL_DOMAIN = "@sena-portal.local";
  const equipoGuia7WizardActive = {};

  function equipoG7Key(actId) {
    return EQUIPO_G7_STATE_KEY_PREFIX + String(actId || "");
  }

  function getCurrentUsernameKeyG7() {
    const session = portalAuth?.getCurrentSession?.();
    return String(session?.usernameKey || session?.user?.usernameKey || "").trim().toLowerCase();
  }

  function getEquipoG7FromState(actId) {
    if (!actId) return null;
    const raw = state[equipoG7Key(actId)];
    if (!raw || typeof raw !== "object") return null;
    // Modo SOLO: el aprendiz trabaja sin companeros (1 integrante = el mismo).
    // Permite continuar la actividad aunque el roster no cargue o prefiera individual.
    if (raw.mode === "solo" || raw.solo === true) {
      return Array.isArray(raw.members) && raw.members.length >= 1 ? raw : null;
    }
    if (raw.mode !== "grupo") return null;
    if (!Array.isArray(raw.members) || raw.members.length < 2) return null;
    return raw;
  }

  function setEquipoG7InState(actId, team) {
    if (!actId) return;
    state[equipoG7Key(actId)] = team;
    saveState();
  }

  function clearEquipoG7FromState(actId) {
    if (!actId) return;
    delete state[equipoG7Key(actId)];
    saveState();
  }

  function escG7(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildEquipoG7GroupKey(ficha, memberKeys) {
    const sorted = memberKeys.slice().map((k) => String(k || "").trim().toLowerCase()).sort();
    const seed = "g7:" + ficha + ":" + sorted.join("__");
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "g7_" + ficha + "_" + (hash >>> 0).toString(16);
  }

  function buildEquipoG7Code4(team) {
    if (!team || !Array.isArray(team.memberKeys)) return "";
    const sorted = team.memberKeys.slice().map((k) => String(k || "").trim().toLowerCase()).sort();
    const seed = "code:" + (team.ficha || "") + ":" + sorted.join("__");
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(0, 4);
  }

  function renderEquipoG7Block(actId) {
    if (!actId) {
      EQUIPO_G7_ACTIVITY_IDS.forEach((id) => renderEquipoG7Block(id));
      return;
    }
    const summary = document.querySelector(`[data-equipo-g7-summary="${actId}"]`);
    const config = document.querySelector(`[data-equipo-g7-config="${actId}"]`);
    if (!summary || !config) return;
    const team = getEquipoG7FromState(actId);
    if (team && !equipoGuia7WizardActive[actId]) {
      config.style.display = "none";
      renderEquipoG7Summary(actId, team);
      return;
    }
    if (!equipoGuia7WizardActive[actId]) {
      config.style.display = "none";
      renderEquipoG7StartButton(actId);
      return;
    }
    summary.innerHTML = "";
    config.style.display = "";
    renderEquipoG7Roster(actId);
  }

  function renderEquipoG7StartButton(actId) {
    const summary = document.querySelector(`[data-equipo-g7-summary="${actId}"]`);
    if (!summary) return;
    summary.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <button type="button" onclick="iniciarEquipoGuia7('${escG7(actId)}')" class="btn-save-response" style="display:inline-flex;align-items:center;gap:6px">
          &#128101; Configurar equipo de esta actividad
        </button>
        <button type="button" onclick="trabajarSoloGuia7('${escG7(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #b6dba0;background:#e8f5e9;color:#1b5e20;border-radius:6px;font-family:inherit;font-size:.86rem;cursor:pointer;font-weight:600">
          &#128100; Trabajar solo
        </button>
        <span class="intro-text" style="margin:0;font-size:.82rem;color:#4b5563">Si no aparecen tus compa&ntilde;eros o prefieres hacerlo individual, pulsa "Trabajar solo" y contin&uacute;a.</span>
      </div>`;
  }

  function renderEquipoG7Summary(actId, team) {
    const summary = document.querySelector(`[data-equipo-g7-summary="${actId}"]`);
    if (!summary) return;
    const isSolo = team.solo === true || team.mode === "solo";
    const code4 = buildEquipoG7Code4(team);
    const memberList = team.members
      .map((m) => `<li>${escG7(m.fullName)} <span style="color:#78909c;font-size:.78rem">(${escG7(m.usernameKey)})</span></li>`)
      .join("");
    summary.innerHTML = `
      <div style="padding:10px 12px;background:#e8f5e9;border:1px solid #b6dba0;border-left:4px solid #2e7d32;border-radius:6px;color:#1b5e20;font-size:.88rem">
        <div style="font-weight:700;margin-bottom:4px">${isSolo ? "&#128100; Trabajando de forma individual" : "Equipo confirmado para esta actividad"} &middot; <code style="background:#fff;padding:2px 6px;border-radius:4px;color:#0b6b35">${isSolo ? "Individual" : "Equipo " + escG7(code4)}</code></div>
        <ul style="margin:6px 0 6px 18px;padding:0;line-height:1.55">${memberList}</ul>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <button type="button" onclick="reconfigurarEquipoGuia7('${escG7(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid #f5c1bb;background:#fdecea;color:#a13029;border-radius:6px;font-family:inherit;font-size:.82rem;cursor:pointer;font-weight:600">&#128683; ${isSolo ? "Cambiar a equipo" : "Cambiar equipo de esta actividad"}</button>
        </div>
      </div>`;
  }

  function renderEquipoG7Roster(actId) {
    const mount = document.querySelector(`[data-equipo-g7-roster="${actId}"]`);
    const hint = document.querySelector(`[data-equipo-g7-hint="${actId}"]`);
    if (!mount) return;
    const selfKey = getCurrentUsernameKeyG7();
    const selfName = getCurrentLearnerName();
    const selection = getGuideSelection();
    const ficha = String(selection.ficha || "").trim();
    if (!selfKey || !ficha) {
      mount.innerHTML = "";
      if (hint) hint.textContent = "Inicia sesion como aprendiz con ficha asignada para configurar el equipo.";
      return;
    }
    const roster = (window.portalAuth?.getUsers?.() || [])
      .filter((u) => String(u?.ficha || "").trim() === ficha)
      .filter((u) => u?.role !== "admin")
      .filter((u) => String(u.usernameKey || "").toLowerCase() !== selfKey)
      .map((u) => ({
        usernameKey: String(u.usernameKey || "").trim().toLowerCase(),
        fullName: String(u.fullName || u.username || "").trim(),
      }))
      .filter((u) => u.usernameKey && u.fullName)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
    if (roster.length === 0) {
      mount.innerHTML = `
        <p style="margin:0 0 8px;font-size:.86rem;color:#a13029">Aun no hay companeros registrados en la ficha ${escG7(ficha)} (pueden tardar en cargar). Pideles que inicien sesion, o continua de forma individual.</p>
        <button type="button" onclick="trabajarSoloGuia7('${escG7(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #b6dba0;background:#e8f5e9;color:#1b5e20;border-radius:6px;font-family:inherit;font-size:.86rem;cursor:pointer;font-weight:600">&#128100; Trabajar solo</button>`;
      if (hint) hint.textContent = "Si no cargan tus companeros, puedes trabajar solo y continuar.";
      return;
    }
    const selfRow = `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:#e8f5e9">
        <input type="checkbox" checked disabled>
        <span style="font-weight:600;color:#1b5e20">${escG7(selfName || selfKey)} <span style="font-weight:400;color:#37474f">(tu)</span></span>
      </label>`;
    const rows = roster
      .map((u) => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer">
          <input type="checkbox" data-equipo-g7-act="${escG7(actId)}" data-equipo-g7-key="${escG7(u.usernameKey)}" data-equipo-g7-name="${escG7(u.fullName)}">
          <span style="color:#37474f">${escG7(u.fullName)}</span>
        </label>`)
      .join("");
    mount.innerHTML = selfRow + rows;
    if (hint) {
      hint.textContent = `Tu ficha tiene ${roster.length + 1} aprendices registrados. La guia indica equipos de 3 (incluyendote): selecciona maximo 2 companeros.`;
    }
    mount.querySelectorAll(`input[data-equipo-g7-act="${actId}"]`).forEach((cb) => {
      cb.addEventListener("change", () => {
        const checked = mount.querySelectorAll(`input[data-equipo-g7-act="${actId}"]:checked`).length;
        if (checked > 2) {
          cb.checked = false;
          window.portalAlert("La guia indica equipos de hasta 3 integrantes. Solo puedes seleccionar 2 companeros. Desmarca uno antes de agregar otro.", { type: "warning" });
        }
      });
    });
  }

  function confirmarEquipoGuia7(actId) {
    if (!actId) return;
    const selfKey = getCurrentUsernameKeyG7();
    const selfName = getCurrentLearnerName();
    const selection = getGuideSelection();
    const ficha = String(selection.ficha || "").trim();
    if (!selfKey || !ficha) {
      window.portalAlert("No se pudo identificar tu sesion o ficha. Vuelve a iniciar sesion.", { type: "error" });
      return;
    }
    const checks = document.querySelectorAll(`input[data-equipo-g7-act="${actId}"]:checked`);
    const selected = Array.from(checks).map((c) => ({
      usernameKey: c.dataset.equipoG7Key,
      fullName: c.dataset.equipoG7Name,
    }));
    if (selected.length < 1 || selected.length > 2) {
      window.portalAlert("Selecciona 1 o 2 companeros (equipo de maximo 3, incluyendote).", { type: "warning" });
      return;
    }
    const allMembers = [{ usernameKey: selfKey, fullName: selfName || selfKey }, ...selected];
    const memberKeys = allMembers.map((m) => m.usernameKey);
    const memberEmails = memberKeys.map((k) => k + EQUIPO_G7_EMAIL_DOMAIN);
    const groupKey = buildEquipoG7GroupKey(ficha + ":" + actId, memberKeys);
    const team = {
      mode: "grupo",
      groupKey,
      ficha,
      members: allMembers,
      memberKeys,
      memberEmails,
      scope: "activity",
      activityId: actId,
      guide: GUIDE_DATA_FILE,
      confirmedAt: new Date().toISOString(),
      confirmedBy: { usernameKey: selfKey, fullName: selfName || selfKey },
    };
    setEquipoG7InState(actId, team);
    equipoGuia7WizardActive[actId] = false;
    if (window._firebaseDb && typeof window._firebaseDb.cloudSaveGroup === "function") {
      Promise.resolve(window._firebaseDb.cloudSaveGroup(groupKey, {
        ficha,
        guide: GUIDE_DATA_FILE,
        activity: "guia7_equipo_" + actId,
        members: allMembers,
        memberKeys,
        memberEmails,
        updatedAt: new Date().toISOString(),
      })).catch(() => {});
    }
    renderEquipoG7Block(actId);
  }

  function cancelarEquipoGuia7Config(actId) {
    if (!actId) return;
    equipoGuia7WizardActive[actId] = false;
    renderEquipoG7Block(actId);
  }

  function iniciarEquipoGuia7(actId) {
    if (!actId) return;
    equipoGuia7WizardActive[actId] = true;
    renderEquipoG7Block(actId);
  }

  async function trabajarSoloGuia7(actId) {
    if (!actId) return;
    const selfKey = getCurrentUsernameKeyG7();
    const selfName = getCurrentLearnerName();
    const selection = getGuideSelection();
    const ficha = String(selection.ficha || "").trim();
    if (!selfKey || !ficha) {
      window.portalAlert("No se pudo identificar tu sesion o ficha. Vuelve a iniciar sesion.", { type: "error" });
      return;
    }
    if (!(await window.portalConfirm("Trabajar SOLO en esta actividad? Podras continuar sin companeros. Si luego consigues equipo, usa 'Cambiar a equipo'.", { title: "Trabajar solo", confirmText: "Si, solo" }))) return;
    const allMembers = [{ usernameKey: selfKey, fullName: selfName || selfKey }];
    const memberKeys = allMembers.map((m) => m.usernameKey);
    const memberEmails = memberKeys.map((k) => k + EQUIPO_G7_EMAIL_DOMAIN);
    const groupKey = buildEquipoG7GroupKey(ficha + ":" + actId + ":solo", memberKeys);
    const team = {
      mode: "solo",
      solo: true,
      groupKey,
      ficha,
      members: allMembers,
      memberKeys,
      memberEmails,
      scope: "activity",
      activityId: actId,
      guide: GUIDE_DATA_FILE,
      confirmedAt: new Date().toISOString(),
      confirmedBy: { usernameKey: selfKey, fullName: selfName || selfKey },
    };
    setEquipoG7InState(actId, team);
    equipoGuia7WizardActive[actId] = false;
    if (window._firebaseDb && typeof window._firebaseDb.cloudSaveGroup === "function") {
      Promise.resolve(window._firebaseDb.cloudSaveGroup(groupKey, {
        ficha,
        guide: GUIDE_DATA_FILE,
        activity: "guia7_equipo_" + actId,
        members: allMembers,
        memberKeys,
        memberEmails,
        solo: true,
        updatedAt: new Date().toISOString(),
      })).catch(() => {});
    }
    renderEquipoG7Block(actId);
  }

  async function reconfigurarEquipoGuia7(actId) {
    if (!actId) return;
    if (!(await window.portalConfirm("Cambiar el equipo de esta actividad borrara la configuracion actual. Continuar?", { title: "Cambiar equipo", confirmText: "Continuar" }))) return;
    clearEquipoG7FromState(actId);
    equipoGuia7WizardActive[actId] = true;
    renderEquipoG7Block(actId);
  }

  window.confirmarEquipoGuia7 = confirmarEquipoGuia7;
  window.cancelarEquipoGuia7Config = cancelarEquipoGuia7Config;
  window.iniciarEquipoGuia7 = iniciarEquipoGuia7;
  window.trabajarSoloGuia7 = trabajarSoloGuia7;
  window.reconfigurarEquipoGuia7 = reconfigurarEquipoGuia7;

  // ── Constructor de tabla 3.2.1 (Paso 2: una fila por tema) ────────────────

  const G7_321_TABLA_KEY = "g7_321_tabla";
  const G7_321_TABLA_TEXT_KEY = "g7_321_tabla_text";
  const G7_321_TABLA_FIELDS = [
    { key: "tema",     label: "Tema",              placeholder: "Ej.: Tipos de ciberataques" },
    { key: "concepto", label: "Concepto / Control", placeholder: "Ej.: Phishing" },
    { key: "consiste", label: "En que consiste",    placeholder: "Explica con tus palabras." },
    { key: "ejemplo",  label: "Ejemplo en MiPyme",  placeholder: "Ej.: Correo falso suplantando un proveedor." },
  ];

  function isG7_321_Locked() {
    return Boolean(state["bloqueAB321-locked"]);
  }

  function getG7_321_TablaRows() {
    const raw = state[G7_321_TABLA_KEY];
    return Array.isArray(raw) ? raw : [];
  }

  function serializeG7_321_Tabla(rows) {
    if (!rows || !rows.length) return "";
    return rows.map(function (row, i) {
      const lines = G7_321_TABLA_FIELDS.map(function (f) {
        const v = String((row && row[f.key]) || "").trim();
        return "  - " + f.label + ": " + (v || "(vacio)");
      });
      return "Fila " + (i + 1) + "\n" + lines.join("\n");
    }).join("\n\n");
  }

  function setG7_321_TablaRows(rows) {
    state[G7_321_TABLA_KEY] = rows;
    state[G7_321_TABLA_TEXT_KEY] = serializeG7_321_Tabla(rows);
    saveState();
  }

  function renderG7_321_Tabla() {
    const body = document.querySelector("[data-g7-tabla-body]");
    const empty = document.querySelector("[data-g7-tabla-empty]");
    const addBtn = document.getElementById("g7_321_add_row");
    const clrBtn = document.getElementById("g7_321_clear_rows");
    if (!body) return;
    const locked = isG7_321_Locked();
    if (addBtn) addBtn.style.display = locked ? "none" : "";
    if (clrBtn) clrBtn.style.display = locked ? "none" : "";
    const rows = getG7_321_TablaRows();
    body.innerHTML = "";
    if (rows.length === 0) {
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    rows.forEach(function (row, idx) {
      const tr = document.createElement("tr");
      G7_321_TABLA_FIELDS.forEach(function (f) {
        const td = document.createElement("td");
        const ta = document.createElement("textarea");
        ta.rows = 3;
        ta.placeholder = f.placeholder;
        ta.value = (row && row[f.key]) || "";
        ta.disabled = locked;
        ta.style.cssText = "width:100%;box-sizing:border-box;resize:vertical;font-family:inherit;font-size:.88rem;padding:6px 8px;border:1px solid #cfe0d3;border-radius:6px;background:" + (locked ? "#f5f7f5" : "#ffffff") + ";opacity:" + (locked ? "0.85" : "1");
        ta.addEventListener("input", function () {
          if (isG7_321_Locked()) return;
          const current = getG7_321_TablaRows();
          if (!current[idx]) current[idx] = {};
          current[idx][f.key] = ta.value;
          setG7_321_TablaRows(current);
        });
        td.appendChild(ta);
        tr.appendChild(td);
      });
      const tdAction = document.createElement("td");
      tdAction.style.textAlign = "center";
      tdAction.style.verticalAlign = "middle";
      if (!locked) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Quitar esta fila";
        btn.textContent = "Quitar";
        btn.style.cssText = "padding:6px 10px;border:1px solid #f5c1bb;background:#fdecea;color:#a13029;border-radius:6px;font-family:inherit;font-size:.82rem;cursor:pointer;font-weight:600";
        btn.addEventListener("click", async function () {
          if (isG7_321_Locked()) return;
          if (!(await window.portalConfirm("Quitar esta fila?", { title: "Quitar fila", confirmText: "Quitar" }))) return;
          const current = getG7_321_TablaRows();
          current.splice(idx, 1);
          setG7_321_TablaRows(current);
          renderG7_321_Tabla();
        });
        tdAction.appendChild(btn);
      } else {
        tdAction.textContent = "—";
        tdAction.style.color = "#9aa5ad";
      }
      tr.appendChild(tdAction);
      body.appendChild(tr);
    });
  }

  function bindG7_321_TablaControls() {
    const add = document.getElementById("g7_321_add_row");
    const clr = document.getElementById("g7_321_clear_rows");
    if (add) {
      add.addEventListener("click", function () {
        if (isG7_321_Locked()) return;
        const current = getG7_321_TablaRows();
        current.push({ tema: "", concepto: "", consiste: "", ejemplo: "" });
        setG7_321_TablaRows(current);
        renderG7_321_Tabla();
      });
    }
    if (clr) {
      clr.addEventListener("click", async function () {
        if (isG7_321_Locked()) return;
        if (!(await window.portalConfirm("Borrar TODAS las filas de la tabla?", { title: "Borrar tabla", confirmText: "Borrar" }))) return;
        setG7_321_TablaRows([]);
        renderG7_321_Tabla();
      });
    }
  }

  // ── Drive delivery ────────────────────────────────────────────────────────

  function openDriveFolder() {
    const sel = getGuideSelection();
    const folders = {
      "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp?usp=drive_link",
      "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
    };
    const url = folders[sel.ficha] || "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else window.portalAlert("Selecciona primero tu ficha desde el panel lateral.", { type: "warning" });
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery?.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard?.buildDriveTargets) return;
    const targets = window.ActivityStandard.buildDriveTargets(PAGE_FILE, {
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: () =>
        window.ActivityStandard.getConfigForGuide(PAGE_FILE) || {},
    });
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({
      targets,
      onDriveClick: openDriveFolder,
    });
  }

  // ── Progreso ──────────────────────────────────────────────────────────────

  const FORM_FIELDS = [
    "g7_311_pregunta1", "g7_311_pregunta2", "g7_311_pregunta3", "g7_311_pregunta4", "g7_311_pregunta5", "g7_311_pregunta6",
    "g7_312_acuerdos", "g7_312_hallazgo", "g7_312_medida", "g7_312_preguntas", "g7_312_bitacora",
    "g7_321_reparto", "g7_321_temas", "g7_321_concepto", "g7_321_consiste", "g7_321_ejemplo", "g7_321_aporte", "g7_321_dudas",
    "g7_322_central", "g7_322_ramas", "g7_322_enlaces", "g7_322_cia_mipyme",
    "g7_331_estado", "g7_331_hallazgos", "g7_331_prioridades", "g7_331_conclusion",
    "g7_332_orden", "g7_332_resumen", "g7_332_errores", "g7_332_conclusion",
    "g7_341_sec_a", "g7_341_sec_b", "g7_341_sec_c", "g7_341_sec_d",
    "g7_341_sec_e", "g7_341_sec_f", "g7_341_sec_g",
  ];

  function updateProgress() {
    const filled = FORM_FIELDS.filter((k) => String(state[k] || "").trim().length > 0).length;
    const total = FORM_FIELDS.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    // Sincroniza el avance a la nube para que el panel admin lo vea aunque el
    // aprendiz haya guardado desde otro equipo (sin esto el admin deriva mal el %).
    portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed: filled, total, percent: pct });

    // Marca check de cada categoria si todas sus actividades estan bloqueadas
    document.querySelectorAll(".nav-link .check").forEach((c) => c.classList.remove("done"));
    const navMap = {
      reflexion: ["caso311-locked", "plenaria312-locked"],
      contexto: ["bloqueAB321-locked", "mapa322-locked"],
      apropiacion: ["diagnostico331-locked", "hardening332-locked"],
      transferencia: ["plan341-locked"],
    };
    Object.entries(navMap).forEach(([sect, keys]) => {
      if (keys.every((k) => state[k])) {
        const link = document.querySelector(`.nav-link[href="#${sect}"] .check`);
        if (link) link.classList.add("done");
      }
    });

    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct } }));
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function bindReset() {
    const btn = document.getElementById("resetProgress");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!(await window.portalConfirm("¿Reiniciar todas las respuestas guardadas en este navegador? Esta accion no se puede deshacer.", { title: "Reiniciar respuestas", confirmText: "Reiniciar" }))) return;
      state = {};
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(`${STORAGE_KEY}__meta`);
      } catch {}
      hydrateFields();
      updateProgress();
      cloudStore?.notifyChanged();
      // Resetear lock visual de los botones
      document.querySelectorAll("[data-store]").forEach((el) => {
        el.disabled = false;
        el.style.opacity = "";
      });
      document.querySelectorAll(".activity-saved-notice").forEach((n) => (n.style.display = "none"));
      window.dispatchEvent(new Event("activity-deadlines-updated"));
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function initGuia7() {
    if (guia7Booted) return;
    guia7Booted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    renderEquipoG7Block();
    bindG7_321_TablaControls();
    renderG7_321_Tabla();

    updateProgress();
    reflectGradesForGuia7();
    cloudStore?.hydrate();
  }

  // Guia 7 nunca llamaba a reflectGradesIntoGuideState (mismo bug que tuvo
  // Guia 5, ver reflectGradesForGuia5() en js/script.js): si el admin aprobaba
  // una actividad con el banco de respuestas (el aprendiz nunca la guardo el
  // mismo), el flag "{id}-locked" nunca se ponia, asi que ActivityStandard.
  // mountActivities() seguia mostrando los campos editables aunque la
  // actividad ya estuviera Aprobada. Detectado 2026-07-25 en QA de la cuenta
  // de pruebas 11A. Mismo fix en Guia 8 (script_guia8.js).
  function reflectGradesForGuia7() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: "guia-07-ciberseguridad",
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      onChanged: function () {
        saveState();
        updateProgress();
        if (window.ActivityStandard && typeof window.ActivityStandard.renderAvancePanel === "function" && document.querySelector("[data-act-std-avance]")) {
          window.ActivityStandard.renderAvancePanel({
            getGuideDataFile: function () { return PAGE_FILE; },
            getState: function () { return state; },
          });
        }
        renderG7_321_Tabla();
        // mountFormActivity() (activity_standard.js) escucha este evento y
        // vuelve a aplicar applyLock()/applyDeadlineGate() por actividad --
        // asi los campos quedan deshabilitados DE INMEDIATO si el aprendiz
        // tiene la guia abierta cuando el admin califica, sin re-montar nada.
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new Event("activity-deadlines-updated"));
        }
      },
    });
  }

  window.initGuia7 = initGuia7;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuia7);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });

  // Re-render del constructor cuando ActivityStandard bloquea/desbloquea 3.2.1
  window.addEventListener("activity-deadlines-updated", function () {
    renderG7_321_Tabla();
  });
  document.addEventListener("guide-delivery-registered", function () {
    requestAnimationFrame(renderG7_321_Tabla);
  });
  document.addEventListener("click", function (ev) {
    const t = ev.target;
    if (t && t.id === "btnGuardarBloqueAB321") {
      requestAnimationFrame(renderG7_321_Tabla);
    }
  });
})();
