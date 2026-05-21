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
  const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
  const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
  const CLOUD_SYNC_DELAY_MS = 1200;

  // ── Estado ────────────────────────────────────────────────────────────────

  let state = loadState();
  let cloudStateSyncTimer = null;
  let guia7Booted = false;

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
      console.warn("[guia7] cloud sync failed", err);
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

  // ── Drive delivery ────────────────────────────────────────────────────────

  function openDriveFolder() {
    const sel = getGuideSelection();
    const folders = {
      "3168850": "https://drive.google.com/drive/folders/1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp?usp=drive_link",
      "3168852": "https://drive.google.com/drive/folders/1p9HdGinK1me8PsbaLHYio_OC-idAmorR?usp=drive_link",
    };
    const url = folders[sel.ficha] || "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else alert("Selecciona primero tu ficha desde el panel lateral.");
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
    "g7_311_pregunta1", "g7_311_pregunta2", "g7_311_pregunta3", "g7_311_pregunta4",
    "g7_312_bitacora",
    "g7_321_temas", "g7_321_fila", "g7_321_dudas",
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
    btn.addEventListener("click", () => {
      if (!confirm("¿Reiniciar todas las respuestas guardadas en este navegador? Esta accion no se puede deshacer.")) return;
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

    updateProgress();
  }

  window.initGuia7 = initGuia7;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuia7);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
