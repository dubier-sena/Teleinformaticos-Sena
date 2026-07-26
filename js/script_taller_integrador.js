// script_taller_integrador.js — Taller Integrador (Sistemas Teleinformaticos)
// Compartido por tres variantes: John F. Kennedy grado 10 (10A/10B, 6 productos),
// Santa Barbara grado 10 (10A/10B, 6 productos) y Santa Barbara grado 11
// (11A/11B, 4 productos, ultimo ano de contrato del grupo). Productos type:"file"
// (entrega a Drive por equipo) via ActivityStandard. Sin formularios ni wizard
// de equipo: los integrantes del equipo van en la portada del documento
// entregado. El PAGE_FILE (via STORAGE_FILE_ALIASES) determina el storage
// local/nube, el registro de guide_declarations.js que aplica y la lista de
// productos (ACTIVITY_IDS_BY_FILE) de esa variante.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  const STORAGE_FILE_ALIASES = {
    "grupo-10a-guia-04-taller-integrador.html": "10a_guia4.html",
    "grupo-10b-guia-04-taller-integrador.html": "10b_guia4.html",
    "santa-barbara-10a-guia-04-taller-integrador.html": "sb_10a_guia4.html",
    "santa-barbara-10b-guia-04-taller-integrador.html": "sb_10b_guia4.html",
    "grupo-11a-guia-09-taller-integrador.html": "11a_guia9.html",
    "grupo-11b-guia-09-taller-integrador.html": "11b_guia9.html",
  };
  const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia4";

  // Cada variante del taller (JFK/SB grado 10 con 6 productos, SB grado 11 con
  // 4 productos) declara su propia lista de actividades aqui, indexada por el
  // GUIDE_DATA_FILE (ya resuelto via alias arriba). El resto del script es
  // identico para todas las variantes.
  const ACTIVITY_IDS_BY_FILE = {
    "10a_guia4.html": ["diagnostico", "planAlfabetizacion", "plantillaExcel", "bitacoraAsesorias", "fichaEquipos", "informeImpacto"],
    "10b_guia4.html": ["diagnostico", "planAlfabetizacion", "plantillaExcel", "bitacoraAsesorias", "fichaEquipos", "informeImpacto"],
    "sb_10a_guia4.html": ["diagnostico", "planAlfabetizacion", "plantillaExcel", "bitacoraAsesorias", "fichaEquipos", "informeImpacto"],
    "sb_10b_guia4.html": ["diagnostico", "planAlfabetizacion", "plantillaExcel", "bitacoraAsesorias", "fichaEquipos", "informeImpacto"],
    "11a_guia9.html": ["informeInfraestructura", "planMejora", "informeEjecucion", "reporteCumplimiento"],
    "11b_guia9.html": ["informeInfraestructura", "planMejora", "informeEjecucion", "reporteCumplimiento"],
  };

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;
  const STORAGE_META_KEY = `${STORAGE_KEY}__meta`;
  const SCOPED_STORAGE_ENABLED = STORAGE_KEY !== LEGACY_STORAGE_KEY;
  const CLOUD_SYNC_DELAY_MS = 1200;

  // Debe coincidir con los `id` de las actividades tipo "file" (productos)
  // registradas en guide_declarations.js para esta variante del taller.
  const ACTIVITY_IDS = ACTIVITY_IDS_BY_FILE[GUIDE_DATA_FILE] || [];

  // ── Estado ────────────────────────────────────────────────────────────────

  let state = loadState();
  let cloudStateSyncTimer = null;
  let tallerBooted = false;

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
      console.warn("[taller_integrador] cloud sync failed", err);
    }
  }

  // ── Hidratacion y binding del campo "equipo de trabajo" ────────────────────

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
      getGuideMetadata: () =>
        window.ActivityStandard?.getConfigForGuide(PAGE_FILE) || {},
      getGuideDataFile: () => PAGE_FILE,
    };
  }

  // ── Drive delivery ────────────────────────────────────────────────────────

  function getDriveFolderUrl() {
    const selection = getGuideSelection();
    const ficha = selection.ficha || localStorage.getItem("sena_ficha") || "";
    if (!ficha || !window.sharedAppsScriptDelivery?.getDriveFolderUrlForFicha) return "";
    return window.sharedAppsScriptDelivery.getDriveFolderUrlForFicha(ficha) || "";
  }

  function showDriveSelectionAlert() {
    window.portalAlert(
      "No se encontro la carpeta de Drive para esta ficha. Regresa al portal y verifica que el grupo seleccionado sea el correcto.",
      { type: "warning" }
    );
  }

  function openDriveFolder() {
    const url = getDriveFolderUrl();
    if (!url) {
      showDriveSelectionAlert();
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery?.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard?.buildDriveTargets) return;
    const targets = window.ActivityStandard.buildDriveTargets(PAGE_FILE, getStateCtx());
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({
      targets,
      onDriveClick: openDriveFolder,
      hideQr: true,
    });
  }

  // ── Progreso ──────────────────────────────────────────────────────────────

  // Un producto (tipo "file") cuenta como hecho por "-locked" (entrega real del
  // equipo, ver _persistDeliveryToState en activity_standard.js, que fija
  // ambos) O por "-delivery" (entrega sintetizada por reflectGradesIntoGuideState
  // cuando el admin aprueba desde el banco sin subida real -- ese camino NUNCA
  // fija "-locked"). Sin este respaldo, "Progreso" se quedaba atascado aunque
  // "Tus actividades de esta guia" ya mostrara todo Aprobada/Entregado.
  function isProductDone(id) {
    if (state[`${id}-locked`]) return true;
    const delivery = state[`${id}-delivery`];
    return Boolean(delivery && delivery.status === "delivered");
  }

  function updateProgress() {
    const completed = ACTIVITY_IDS.filter(isProductDone).length;
    const total = ACTIVITY_IDS.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    // Sincroniza el avance a la nube para que el panel admin lo vea aunque el
    // equipo haya entregado desde otro equipo de computo.
    portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed, total, percent: pct });

    document.querySelectorAll(".nav-link .check").forEach((c) => c.classList.remove("done"));
    ACTIVITY_IDS.forEach((id, index) => {
      if (!isProductDone(id)) return;
      const check = document.querySelector(`.nav-link[href="#producto${index + 1}"] .check`);
      if (check) check.classList.add("done");
    });

    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct } }));
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function bindReset() {
    const btn = document.getElementById("resetProgress");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!(await window.portalConfirm("¿Reiniciar el avance guardado en este navegador? Esta accion no se puede deshacer.", { title: "Reiniciar avance", confirmText: "Reiniciar" }))) return;
      state = {};
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_META_KEY);
      } catch {}
      updateProgress();
      scheduleCloudSync();
      document.querySelectorAll(".activity-saved-notice").forEach((n) => (n.style.display = "none"));
      window.dispatchEvent(new Event("activity-deadlines-updated"));
    });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function initTallerIntegrador() {
    if (tallerBooted) return;
    tallerBooted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    updateProgress();
    reflectGradesForTaller();
  }

  // El taller nunca llamaba a reflectGradesIntoGuideState: si el admin
  // aprobaba "equipoTaller" (el unico producto type:"form" del taller, los
  // demas son type:"file" y se bloquean via el fallback de entrega del
  // admin) con el banco de respuestas, el flag "equipoTaller-locked" nunca se
  // ponia y el campo seguia editable aunque la actividad ya estuviera
  // Aprobada. Mismo bug que Guia 5/7/8. La familia se resuelve por PAGE_FILE
  // porque este mismo script sirve las 3 variantes del taller (JFK/SB grado
  // 10, SB grado 11), cada una con su propia familia en GRADE_CATALOG.
  function reflectGradesForTaller() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    var guideFamily = (mgr.GUIDE_FAMILY_BY_FILE || {})[PAGE_FILE];
    if (!guideFamily) return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: guideFamily,
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
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new Event("activity-deadlines-updated"));
        }
      },
    });
  }

  window.initTallerIntegrador = initTallerIntegrador;
  window.updateGuideProgress = updateProgress;
})();
