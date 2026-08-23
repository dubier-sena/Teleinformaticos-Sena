// script_guia5_documentar_gestion.js — Guia 5: Documentar la gestion de la informacion (RAP 04)
// Kennedy 10A / 10B. Usa ActivityStandard para guardar/bloquear/exportar Word.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  const STORAGE_FILE_ALIASES = {
    "grupo-10a-guia-05-documentar-gestion-informacion.html": "10a_guia5doc.html",
    "grupo-10b-guia-05-documentar-gestion-informacion.html": "10b_guia5doc.html",
  };
  const GUIDE_DATA_FILE = STORAGE_FILE_ALIASES[PAGE_FILE] || PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_") || "guia5doc";

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
  let guia5DocBooted = false;

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
    // pintar el DOM y el progreso con el estado ya fusionado.
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
    "g5doc_411_datos", "g5doc_411_consecuencias", "g5doc_411_experiencia", "g5doc_411_documento",
    "g5doc_412_comunes", "g5doc_412_documento_urgente", "g5doc_412_reflexion",
    "g5doc_421_reparto", "g5doc_421_temas", "g5doc_421_documento", "g5doc_421_paraque", "g5doc_421_ejemplo", "g5doc_421_aporte", "g5doc_421_dudas",
    "g5doc_422_central", "g5doc_422_relacion", "g5doc_422_protocolo", "g5doc_422_aplicacion",
    "g5doc_431_ficha_tecnica", "g5doc_431_hoja_vida", "g5doc_431_inventario", "g5doc_431_backup", "g5doc_431_chequeo", "g5doc_431_procedimientos", "g5doc_431_conclusion",
    "g5doc_432_estructura", "g5doc_432_convencion", "g5doc_432_versiones", "g5doc_432_protocolo",
    "g5doc_441_sec_a", "g5doc_441_sec_b", "g5doc_441_sec_c", "g5doc_441_sec_d",
    "g5doc_441_sec_e", "g5doc_441_sec_f", "g5doc_441_sec_g",
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
      reflexion: ["caso411-locked", "plenaria412-locked"],
      contexto: ["bloqueAB421-locked", "mapa422-locked"],
      apropiacion: ["portafolio431-locked", "organizacion432-locked"],
      transferencia: ["documento441-locked"],
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

  function initGuia5DocumentarGestion() {
    if (guia5DocBooted) return;
    guia5DocBooted = true;

    hydrateFields();
    bindFieldEvents();
    bindReset();

    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();

    updateProgress();
    reflectGradesForGuia5DocumentarGestion();

    // Se hidrata DESPUES de pintar (el aprendiz ve de inmediato lo que ya
    // tenia local); si la nube trae algo distinto, onHydrated() vuelve a
    // pintar. Nunca reemplaza una respuesta remota valida por un local vacio
    // o mas viejo (ver resolveGuideHydration en js/firebase_db.js).
    cloudStore?.hydrate();
  }

  // Mismo patron que Guia 7/8/4-Ciber (ver reflectGradesForGuia8() en
  // js/script_guia8.js): si el admin aprueba una actividad con el banco de
  // respuestas sin que el aprendiz la haya guardado el mismo, el flag
  // "{id}-locked" nunca se pone y ActivityStandard.mountActivities() sigue
  // mostrando los campos editables aunque la actividad ya este "Aprobada".
  function reflectGradesForGuia5DocumentarGestion() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: "guia-05-documentar-gestion",
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

  window.initGuia5DocumentarGestion = initGuia5DocumentarGestion;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuia5DocumentarGestion);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
