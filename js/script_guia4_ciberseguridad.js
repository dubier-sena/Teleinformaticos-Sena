// script_guia4_ciberseguridad.js — Guia 4: Planificar la informacion segun criterios de ciberseguridad (RAP 03)
// Kennedy 10A / 10B. Usa ActivityStandard para guardar/bloquear/exportar Word.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  const STORAGE_FILE_ALIASES = {
    "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html": "10a_guia4ciber.html",
    "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html": "10b_guia4ciber.html",
  };
  const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia4ciber";

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;
  const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
  const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
  const CLOUD_SYNC_DELAY_MS = 1200;

  // ── Estado ────────────────────────────────────────────────────────────────

  let state = loadState();
  let cloudStateSyncTimer = null;
  let guia4CiberBooted = false;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) || {};
      if (SCOPED_STORAGE_ENABLED) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          const parsed = JSON.parse(legacy) || {};
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          return parsed;
        }
      }
      return {};
    } catch {
      return {};
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify({
        updatedAt: new Date().toISOString(),
        updatedBy: getActor(),
      }));
    } catch {}
    scheduleCloudSync();
    updateProgress();
  }

  function getActor() {
    const session = portalAuth?.getCurrentSession?.();
    return session?.user?.fullName || session?.user?.username || "Aprendiz";
  }

  function getCloudScopeKey() {
    const session = portalAuth?.getCurrentSession?.();
    if (!session) return "";
    if (session.role === "admin") return `admin:${session.usernameKey || "admin"}`;
    if (session.role === "student") return `student:${session.user?.usernameKey || ""}`;
    return "";
  }

  function scheduleCloudSync() {
    if (cloudStateSyncTimer) clearTimeout(cloudStateSyncTimer);
    cloudStateSyncTimer = setTimeout(flushCloudSync, CLOUD_SYNC_DELAY_MS);
  }

  async function flushCloudSync() {
    cloudStateSyncTimer = null;
    const scopeKey = getCloudScopeKey();
    if (!scopeKey || !window._firebaseDb?.cloudSaveGuideData) return;
    try {
      await window._firebaseDb.cloudSaveGuideData(scopeKey, GUIDE_DATA_FILE, {
        scopeKey,
        fileName: GUIDE_DATA_FILE,
        updatedAt: new Date().toISOString(),
        updatedBy: getActor(),
        state: { ...state },
      });
    } catch (err) {
      console.warn("[guia4ciber] cloud sync failed", err);
    }
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
  // Solo 3.2.2 (mapa conceptual integrador) se trabaja en equipo: tu y hasta
  // 2 companeros. Cada mount persiste su equipo de forma independiente.

  const EQUIPO_G4C_STATE_KEY_PREFIX = "equipoGuia4C_";
  const EQUIPO_G4C_ACTIVITY_IDS = ["mapa322"];
  const EQUIPO_G4C_EMAIL_DOMAIN = "@sena-portal.local";
  const equipoGuia4CWizardActive = {};

  function equipoG4CKey(actId) {
    return EQUIPO_G4C_STATE_KEY_PREFIX + String(actId || "");
  }

  function getCurrentUsernameKeyG4C() {
    const session = portalAuth?.getCurrentSession?.();
    return String(session?.usernameKey || session?.user?.usernameKey || "").trim().toLowerCase();
  }

  function getEquipoG4CFromState(actId) {
    if (!actId) return null;
    const raw = state[equipoG4CKey(actId)];
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

  function setEquipoG4CInState(actId, team) {
    if (!actId) return;
    state[equipoG4CKey(actId)] = team;
    saveState();
  }

  function clearEquipoG4CFromState(actId) {
    if (!actId) return;
    delete state[equipoG4CKey(actId)];
    saveState();
  }

  function escG4C(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildEquipoG4CGroupKey(ficha, memberKeys) {
    const sorted = memberKeys.slice().map((k) => String(k || "").trim().toLowerCase()).sort();
    const seed = "g4c:" + ficha + ":" + sorted.join("__");
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "g4c_" + ficha + "_" + (hash >>> 0).toString(16);
  }

  function buildEquipoG4CCode4(team) {
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

  function renderEquipoG4CBlock(actId) {
    if (!actId) {
      EQUIPO_G4C_ACTIVITY_IDS.forEach((id) => renderEquipoG4CBlock(id));
      return;
    }
    const summary = document.querySelector(`[data-equipo-g4c-summary="${actId}"]`);
    const config = document.querySelector(`[data-equipo-g4c-config="${actId}"]`);
    if (!summary || !config) return;
    const team = getEquipoG4CFromState(actId);
    if (team && !equipoGuia4CWizardActive[actId]) {
      config.style.display = "none";
      renderEquipoG4CSummary(actId, team);
      return;
    }
    if (!equipoGuia4CWizardActive[actId]) {
      config.style.display = "none";
      renderEquipoG4CStartButton(actId);
      return;
    }
    summary.innerHTML = "";
    config.style.display = "";
    renderEquipoG4CRoster(actId);
  }

  function renderEquipoG4CStartButton(actId) {
    const summary = document.querySelector(`[data-equipo-g4c-summary="${actId}"]`);
    if (!summary) return;
    summary.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
        <button type="button" onclick="iniciarEquipoGuia4C('${escG4C(actId)}')" class="btn-save-response" style="display:inline-flex;align-items:center;gap:6px">
          &#128101; Configurar equipo de esta actividad
        </button>
        <button type="button" onclick="trabajarSoloGuia4C('${escG4C(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #b6dba0;background:#e8f5e9;color:#1b5e20;border-radius:6px;font-family:inherit;font-size:.86rem;cursor:pointer;font-weight:600">
          &#128100; Trabajar solo
        </button>
        <span class="intro-text" style="margin:0;font-size:.82rem;color:#4b5563">Si no aparecen tus compa&ntilde;eros o prefieres hacerlo individual, pulsa "Trabajar solo" y contin&uacute;a.</span>
      </div>`;
  }

  function renderEquipoG4CSummary(actId, team) {
    const summary = document.querySelector(`[data-equipo-g4c-summary="${actId}"]`);
    if (!summary) return;
    const isSolo = team.solo === true || team.mode === "solo";
    const code4 = buildEquipoG4CCode4(team);
    const memberList = team.members
      .map((m) => `<li>${escG4C(m.fullName)} <span style="color:#78909c;font-size:.78rem">(${escG4C(m.usernameKey)})</span></li>`)
      .join("");
    summary.innerHTML = `
      <div style="padding:10px 12px;background:#e8f5e9;border:1px solid #b6dba0;border-left:4px solid #2e7d32;border-radius:6px;color:#1b5e20;font-size:.88rem">
        <div style="font-weight:700;margin-bottom:4px">${isSolo ? "&#128100; Trabajando de forma individual" : "Equipo confirmado para esta actividad"} &middot; <code style="background:#fff;padding:2px 6px;border-radius:4px;color:#0b6b35">${isSolo ? "Individual" : "Equipo " + escG4C(code4)}</code></div>
        <ul style="margin:6px 0 6px 18px;padding:0;line-height:1.55">${memberList}</ul>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
          <button type="button" onclick="reconfigurarEquipoGuia4C('${escG4C(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid #f5c1bb;background:#fdecea;color:#a13029;border-radius:6px;font-family:inherit;font-size:.82rem;cursor:pointer;font-weight:600">&#128683; ${isSolo ? "Cambiar a equipo" : "Cambiar equipo de esta actividad"}</button>
        </div>
      </div>`;
  }

  function renderEquipoG4CRoster(actId) {
    const mount = document.querySelector(`[data-equipo-g4c-roster="${actId}"]`);
    const hint = document.querySelector(`[data-equipo-g4c-hint="${actId}"]`);
    if (!mount) return;
    const selfKey = getCurrentUsernameKeyG4C();
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
        <p style="margin:0 0 8px;font-size:.86rem;color:#a13029">Aun no hay companeros registrados en la ficha ${escG4C(ficha)} (pueden tardar en cargar). Pideles que inicien sesion, o continua de forma individual.</p>
        <button type="button" onclick="trabajarSoloGuia4C('${escG4C(actId)}')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #b6dba0;background:#e8f5e9;color:#1b5e20;border-radius:6px;font-family:inherit;font-size:.86rem;cursor:pointer;font-weight:600">&#128100; Trabajar solo</button>`;
      if (hint) hint.textContent = "Si no cargan tus companeros, puedes trabajar solo y continuar.";
      return;
    }
    const selfRow = `
      <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;background:#e8f5e9">
        <input type="checkbox" checked disabled>
        <span style="font-weight:600;color:#1b5e20">${escG4C(selfName || selfKey)} <span style="font-weight:400;color:#37474f">(tu)</span></span>
      </label>`;
    const rows = roster
      .map((u) => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer">
          <input type="checkbox" data-equipo-g4c-act="${escG4C(actId)}" data-equipo-g4c-key="${escG4C(u.usernameKey)}" data-equipo-g4c-name="${escG4C(u.fullName)}">
          <span style="color:#37474f">${escG4C(u.fullName)}</span>
        </label>`)
      .join("");
    mount.innerHTML = selfRow + rows;
    if (hint) {
      hint.textContent = `Tu ficha tiene ${roster.length + 1} aprendices registrados. La guia indica equipos de 3 (incluyendote): selecciona maximo 2 companeros.`;
    }
    mount.querySelectorAll(`input[data-equipo-g4c-act="${actId}"]`).forEach((cb) => {
      cb.addEventListener("change", () => {
        const checked = mount.querySelectorAll(`input[data-equipo-g4c-act="${actId}"]:checked`).length;
        if (checked > 2) {
          cb.checked = false;
          window.portalAlert("La guia indica equipos de hasta 3 integrantes. Solo puedes seleccionar 2 companeros. Desmarca uno antes de agregar otro.", { type: "warning" });
        }
      });
    });
  }

  function confirmarEquipoGuia4C(actId) {
    if (!actId) return;
    const selfKey = getCurrentUsernameKeyG4C();
    const selfName = getCurrentLearnerName();
    const selection = getGuideSelection();
    const ficha = String(selection.ficha || "").trim();
    if (!selfKey || !ficha) {
      window.portalAlert("No se pudo identificar tu sesion o ficha. Vuelve a iniciar sesion.", { type: "error" });
      return;
    }
    const checks = document.querySelectorAll(`input[data-equipo-g4c-act="${actId}"]:checked`);
    const selected = Array.from(checks).map((c) => ({
      usernameKey: c.dataset.equipoG4cKey,
      fullName: c.dataset.equipoG4cName,
    }));
    if (selected.length < 1 || selected.length > 2) {
      window.portalAlert("Selecciona 1 o 2 companeros (equipo de maximo 3, incluyendote).", { type: "warning" });
      return;
    }
    const allMembers = [{ usernameKey: selfKey, fullName: selfName || selfKey }, ...selected];
    const memberKeys = allMembers.map((m) => m.usernameKey);
    const memberEmails = memberKeys.map((k) => k + EQUIPO_G4C_EMAIL_DOMAIN);
    const groupKey = buildEquipoG4CGroupKey(ficha + ":" + actId, memberKeys);
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
    setEquipoG4CInState(actId, team);
    equipoGuia4CWizardActive[actId] = false;
    if (window._firebaseDb && typeof window._firebaseDb.cloudSaveGroup === "function") {
      Promise.resolve(window._firebaseDb.cloudSaveGroup(groupKey, {
        ficha,
        guide: GUIDE_DATA_FILE,
        activity: "guia4c_equipo_" + actId,
        members: allMembers,
        memberKeys,
        memberEmails,
        updatedAt: new Date().toISOString(),
      })).catch(() => {});
    }
    renderEquipoG4CBlock(actId);
  }

  function cancelarEquipoGuia4CConfig(actId) {
    if (!actId) return;
    equipoGuia4CWizardActive[actId] = false;
    renderEquipoG4CBlock(actId);
  }

  function iniciarEquipoGuia4C(actId) {
    if (!actId) return;
    equipoGuia4CWizardActive[actId] = true;
    renderEquipoG4CBlock(actId);
  }

  async function trabajarSoloGuia4C(actId) {
    if (!actId) return;
    const selfKey = getCurrentUsernameKeyG4C();
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
    const memberEmails = memberKeys.map((k) => k + EQUIPO_G4C_EMAIL_DOMAIN);
    const groupKey = buildEquipoG4CGroupKey(ficha + ":" + actId + ":solo", memberKeys);
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
    setEquipoG4CInState(actId, team);
    equipoGuia4CWizardActive[actId] = false;
    if (window._firebaseDb && typeof window._firebaseDb.cloudSaveGroup === "function") {
      Promise.resolve(window._firebaseDb.cloudSaveGroup(groupKey, {
        ficha,
        guide: GUIDE_DATA_FILE,
        activity: "guia4c_equipo_" + actId,
        members: allMembers,
        memberKeys,
        memberEmails,
        solo: true,
        updatedAt: new Date().toISOString(),
      })).catch(() => {});
    }
    renderEquipoG4CBlock(actId);
  }

  async function reconfigurarEquipoGuia4C(actId) {
    if (!actId) return;
    if (!(await window.portalConfirm("Cambiar el equipo de esta actividad borrara la configuracion actual. Continuar?", { title: "Cambiar equipo", confirmText: "Continuar" }))) return;
    clearEquipoG4CFromState(actId);
    equipoGuia4CWizardActive[actId] = true;
    renderEquipoG4CBlock(actId);
  }

  window.confirmarEquipoGuia4C = confirmarEquipoGuia4C;
  window.cancelarEquipoGuia4CConfig = cancelarEquipoGuia4CConfig;
  window.iniciarEquipoGuia4C = iniciarEquipoGuia4C;
  window.trabajarSoloGuia4C = trabajarSoloGuia4C;
  window.reconfigurarEquipoGuia4C = reconfigurarEquipoGuia4C;

  // ── Drive delivery ────────────────────────────────────────────────────────

  function openDriveFolder() {
    const sel = getGuideSelection();
    const folders = {
      "3441939": "https://drive.google.com/drive/folders/1SLkk986REOKGEFaCyWV7rSeudj7lnUMs",
      "3441942": "https://drive.google.com/drive/folders/1cv0DkFXhkMw22AddqIgC354DhUUHcQck",
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
    "g4c_311_pregunta1", "g4c_311_pregunta2", "g4c_311_pregunta3", "g4c_311_pregunta4", "g4c_311_pregunta5",
    "g4c_312_compartida", "g4c_312_aporte", "g4c_312_tablero", "g4c_312_sintesis",
    "g4c_321_cia", "g4c_321_ataques", "g4c_321_normativa", "g4c_321_documentos", "g4c_321_activos", "g4c_321_dudas",
    "g4c_322_central", "g4c_322_ramas", "g4c_322_enlaces", "g4c_322_conexion",
    "g4c_331_estado", "g4c_331_hallazgos", "g4c_331_prioridades", "g4c_331_conclusion",
    "g4c_332_orden", "g4c_332_resumen", "g4c_332_errores", "g4c_332_conclusion",
    "g4c_333_informe", "g4c_333_politica", "g4c_333_inventario", "g4c_333_protocolo",
    "g4c_341_sec_resumen", "g4c_341_sec_diagnostico", "g4c_341_sec_controles", "g4c_341_sec_politica",
    "g4c_341_sec_backup", "g4c_341_sec_inventario", "g4c_341_sec_recomendaciones",
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
      contexto: ["bloques321-locked", "mapa322-locked"],
      apropiacion: ["diagnostico331-locked", "hardening332-locked", "documentos333-locked"],
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
        localStorage.removeItem(STORAGE_META_KEY);
      } catch {}
      hydrateFields();
      updateProgress();
      scheduleCloudSync();
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

  function initGuia4Ciber() {
    if (guia4CiberBooted) return;
    guia4CiberBooted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    renderEquipoG4CBlock();

    updateProgress();
  }

  window.initGuia4Ciber = initGuia4Ciber;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuia4Ciber);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
