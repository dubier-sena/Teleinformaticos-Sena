// script_guia6_mantener_equipos.js — Guia 6: Preparar el mantenimiento de equipos de computo (RAP 01)
// Kennedy 10A / 10B. Usa ActivityStandard para guardar/bloquear/exportar Word.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  const STORAGE_FILE_ALIASES = {
    "grupo-10a-guia-06-mantener-equipos.html": "10a_guia6mant.html",
    "grupo-10b-guia-06-mantener-equipos.html": "10b_guia6mant.html",
  };
  const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia6mant";

  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;

  // ── Estado ────────────────────────────────────────────────────────────────
  // Carga/guardado/hidratacion desde la nube/reintento centralizados en
  // js/guide_cloud_sync.js (mismo mecanismo que el resto de guias del portal).

  let state = window.GuideCloudSync
    ? window.GuideCloudSync.loadLocal(STORAGE_KEY, LEGACY_STORAGE_KEY)
    : {};
  let guia6MantBooted = false;

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
    // Si la nube trae una version distinta a la que ya se pinto (el aprendiz
    // cambio de equipo, o esta guia nunca se habia abierto aqui), se vuelve a
    // pintar el DOM y el progreso con el estado ya fusionado. El repintado del
    // panel de entrega/avance/bloqueos lo dispara guide_cloud_sync.js mismo
    // (evento "activity-deadlines-updated"), no hace falta hacer nada aqui.
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
    "g6mant_311_sintomas", "g6mant_311_causas", "g6mant_311_herramientas", "g6mant_311_precauciones", "g6mant_311_experiencia",
    "g6mant_312_sintoma_grupo", "g6mant_312_reflexion",
    "g6mant_321_reparto", "g6mant_321_temas", "g6mant_321_tema_fila", "g6mant_321_paraque", "g6mant_321_ejemplo",
    "g6mant_322_hallazgos", "g6mant_322_conclusion", "g6mant_322_disp_entrada", "g6mant_322_disp_salida", "g6mant_322_disp_almacenamiento",
    "g6mant_331_bloqueC", "g6mant_331_reporte1", "g6mant_331_reporte2", "g6mant_331_recomendacion",
    "g6mant_332_diagnostico", "g6mant_332_hv_identificacion", "g6mant_332_hv_especificaciones", "g6mant_332_hv_recomendacion",
    "g6mant_341_registros", "g6mant_341_comparativa", "g6mant_341_conclusion",
    "g6mant_342_cronograma", "g6mant_342_actividades", "g6mant_342_materiales", "g6mant_342_epp", "g6mant_342_responsables",
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
      contexto: ["bloqueAB321-locked", "inspeccion322-locked"],
      apropiacion: ["analisis331-locked", "diagnostico332-locked"],
      transferencia: ["hwmonitor341-locked", "planMantenimiento342-locked"],
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

  function initGuia6MantenerEquipos() {
    if (guia6MantBooted) return;
    guia6MantBooted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();

    updateProgress();
    reflectGradesForGuia6MantenerEquipos();

    // Se hidrata DESPUES de pintar (el aprendiz ve de inmediato lo que ya
    // tenia local); si la nube trae algo distinto, onHydrated() vuelve a
    // pintar. Nunca reemplaza una respuesta remota valida por un local vacio
    // o mas viejo (ver resolveGuideHydration en js/firebase_db.js).
    cloudStore?.hydrate();
  }

  // Mismo patron que Guia 5/7/8/4-Ciber (ver reflectGradesForGuia8() en
  // js/script_guia8.js): si el admin aprueba una actividad con el banco de
  // respuestas sin que el aprendiz la haya guardado el mismo, el flag
  // "{id}-locked" nunca se pone y ActivityStandard.mountActivities() sigue
  // mostrando los campos editables aunque la actividad ya este "Aprobada".
  function reflectGradesForGuia6MantenerEquipos() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: "guia-06-mantener-equipos",
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

  window.initGuia6MantenerEquipos = initGuia6MantenerEquipos;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuia6MantenerEquipos);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
