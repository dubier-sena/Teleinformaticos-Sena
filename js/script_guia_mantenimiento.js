// script_guia_mantenimiento.js — Guias de la competencia 220501001 "Mantener
// equipos de computo" creadas el 2026-10-22:
//   Kennedy 10A/10B:        Guia 7 (RAP 02) y Guia 8 (RAP 03)
//   Santa Barbara 10A/10B:  Guia 5 (RAP 01), Guia 6 (RAP 02) y Guia 7 (RAP 03)
// La Guia 6 de Kennedy (RAP 01) conserva su propio script
// (script_guia6_mantener_equipos.js) y sus identificadores; no se toca.
//
// Mismo patron que script_guia6_mantener_equipos.js (GuideCloudSync +
// ActivityStandard), pero sin listas duplicadas: los campos del formulario y
// el mapa de navegacion salen de la declaracion de la guia en
// guide_declarations.js (fuente unica). Sin alias de storage: el documento de
// nube se llama como el HTML, asi que no hace falta cloudFileNames.
(function () {
  "use strict";

  const PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();

  // pageFile -> familia de calificaciones (activity_grades.js GUIDE_FAMILY_BY_FILE).
  // Un mismo RAP comparte familia entre Kennedy y Santa Barbara (mismas
  // actividades, mismo patron que las guias de Redes); el RAP 01 de Santa
  // Barbara reusa la familia de la Guia 6 de Kennedy.
  const GUIDE_FAMILIES = {
    "grupo-10a-guia-07-mantenimiento-integral.html": "guia-mant-rap02",
    "grupo-10b-guia-07-mantenimiento-integral.html": "guia-mant-rap02",
    "grupo-10a-guia-08-verificar-operacion.html": "guia-mant-rap03",
    "grupo-10b-guia-08-verificar-operacion.html": "guia-mant-rap03",
    "santa-barbara-10a-guia-05-preparar-mantenimiento.html": "guia-06-mantener-equipos",
    "santa-barbara-10b-guia-05-preparar-mantenimiento.html": "guia-06-mantener-equipos",
    "santa-barbara-10a-guia-06-mantenimiento-integral.html": "guia-mant-rap02",
    "santa-barbara-10b-guia-06-mantenimiento-integral.html": "guia-mant-rap02",
    "santa-barbara-10a-guia-07-verificar-operacion.html": "guia-mant-rap03",
    "santa-barbara-10b-guia-07-verificar-operacion.html": "guia-mant-rap03",
  };
  if (!GUIDE_FAMILIES[PAGE_FILE]) return;

  const GUIDE_DATA_FILE = PAGE_FILE;
  const PAGE_KEY = GUIDE_DATA_FILE.replace(/[^a-z0-9]+/g, "_");
  const portalAuth = window.portalAuth || null;
  const LEGACY_STORAGE_KEY = `guia_interactiva_${PAGE_KEY}`;
  const STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;

  // Categoria de la barra lateral por prefijo del numero de actividad.
  const NAV_SECTIONS = { "3.1": "reflexion", "3.2": "contexto", "3.3": "apropiacion", "3.4": "transferencia" };

  let state = window.GuideCloudSync
    ? window.GuideCloudSync.loadLocal(STORAGE_KEY, LEGACY_STORAGE_KEY)
    : {};
  let booted = false;

  function getConfig() {
    return window.ActivityStandard?.getConfigForGuide?.(PAGE_FILE) || {};
  }

  function getActivities() {
    const activities = getConfig().activities;
    return Array.isArray(activities) ? activities : [];
  }

  function getFormFields() {
    const fields = [];
    getActivities().forEach((act) => {
      (act.formFields || []).forEach((key) => {
        if (fields.indexOf(key) === -1) fields.push(key);
      });
    });
    return fields;
  }

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

  function hydrateFields() {
    document.querySelectorAll("[data-store]").forEach((el) => {
      const key = el.getAttribute("data-store");
      if (!key) return;
      const value = state[key];
      if ((typeof value === "string" || typeof value === "number") &&
          (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT")) {
        el.value = value;
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
      getGuideMetadata: () => getConfig(),
      getGuideDataFile: () => PAGE_FILE,
    };
  }

  // Carpeta de Drive de la ficha (project_integrations.js -> fichaDriveFolders).
  function openDriveFolder() {
    const sel = getGuideSelection();
    const delivery = window.sharedAppsScriptDelivery || window.sharedDelivery || null;
    const url = delivery && typeof delivery.getDriveFolderUrlForFicha === "function"
      ? delivery.getDriveFolderUrlForFicha(sel.ficha)
      : "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else window.portalAlert?.("No hay carpeta de Drive configurada para tu ficha. Pide el enlace a tu instructor.", { type: "warning" });
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery?.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard?.buildDriveTargets) return;
    const targets = window.ActivityStandard.buildDriveTargets(PAGE_FILE, {
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: () => getConfig(),
    });
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({ targets, onDriveClick: openDriveFolder });
  }

  function updateProgress() {
    const fields = getFormFields();
    const filled = fields.filter((k) => String(state[k] || "").trim().length > 0).length;
    const total = fields.length;
    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    const bar = document.getElementById("progressBar");
    const lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    portalAuth?.writeGuideProgress?.(PAGE_FILE, { completed: filled, total, percent: pct });

    document.querySelectorAll(".nav-link .check").forEach((c) => c.classList.remove("done"));
    const bySection = {};
    getActivities().forEach((act) => {
      const section = NAV_SECTIONS[String(act.number || "").split(".").slice(0, 2).join(".")];
      // La que aplica el instructor (sin campos) nunca se bloquea: no cuenta para el check.
      if (!section || !(act.formFields || []).length) return;
      (bySection[section] = bySection[section] || []).push(`${act.id}-locked`);
    });
    Object.entries(bySection).forEach(([section, keys]) => {
      if (keys.length && keys.every((k) => state[k])) {
        const link = document.querySelector(`.nav-link[href="#${section}"] .check`);
        if (link) link.classList.add("done");
      }
    });
    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct } }));
  }

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
      document.querySelectorAll("[data-store]").forEach((el) => {
        el.disabled = false;
        el.style.opacity = "";
      });
      document.querySelectorAll(".activity-saved-notice").forEach((n) => (n.style.display = "none"));
      window.dispatchEvent(new Event("activity-deadlines-updated"));
    });
  }

  // Igual que reflectGradesForGuia6MantenerEquipos(): si el admin aprueba con
  // el banco de respuestas, el candado "{id}-locked" se refleja en el estado.
  function reflectGrades() {
    const mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: GUIDE_FAMILIES[PAGE_FILE],
      pageFile: PAGE_FILE,
      getState: () => state,
      onChanged: () => {
        saveState();
        updateProgress();
        if (window.ActivityStandard && typeof window.ActivityStandard.renderAvancePanel === "function" && document.querySelector("[data-act-std-avance]")) {
          window.ActivityStandard.renderAvancePanel({ getGuideDataFile: () => PAGE_FILE, getState: () => state });
        }
        window.dispatchEvent(new Event("activity-deadlines-updated"));
      },
    });
  }

  function initGuiaMantenimiento() {
    if (booted) return;
    booted = true;
    hydrateFields();
    bindFieldEvents();
    bindReset();
    if (window.ActivityStandard?.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    updateProgress();
    reflectGrades();
    cloudStore?.hydrate();
  }

  window.initGuiaMantenimiento = initGuiaMantenimiento;

  if (!window.__PAGE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuiaMantenimiento);
  }

  document.addEventListener("guide-activity-check-change", () => {
    window.requestAnimationFrame(() => updateProgress());
  });
})();
