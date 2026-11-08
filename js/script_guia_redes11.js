// script_guia_redes11.js — Guias de Redes de GRADO 11 (Santa Barbara 11A/11B):
//   Guia 10 = RAP 02 Comprobar la conectividad de la red   (template guia-redes11-rap02)
//   Guia 11 = RAP 03 Documentar las acciones realizadas en la red (template guia-redes11-rap03)
//
// EMERGENCIA 2026-11-07: hasta esta fecha estas guias reutilizaban el partial y los ids
// de las guias de Redes de grado 10 (otro documento). Ahora usan los partials oficiales
// de grado 11 (partials/guia-redes11-rap0N-content.html) y las actividades declaradas en
// js/guide_declarations.js (familias de calificacion guia-redes11-rap02/03).
//
// PRESERVACION: el documento de la guia (pageFile/stateKey) es el MISMO de antes, asi que
// las respuestas y entregas de la version anterior siguen guardadas en el estado. Este
// script NUNCA las borra ni las sobrescribe (los ids y campos nuevos son distintos) y las
// muestra en solo lectura en "Registros de la version anterior".
(function () {
  "use strict";

  var PAGE_FILE =
    (window.__RUNTIME_PAGE_FILE__ || window.location.pathname.split("/").pop() || "").toLowerCase();
  var PAGE_KEY = PAGE_FILE.replace(/[^a-z0-9]+/g, "_") || "guia_redes11";

  // Version anterior de cada guia: ids de actividad y prefijo de campos que usaba.
  var LEGACY = {
    "guia-redes11-rap02": {
      family: "guia-redes-rap02",
      prefix: "g3r_",
      ids: ["reflexion311", "bloqueA321", "bloqueB322", "bloqueC323", "bloqueD324", "exportBloques321a324",
        "entregaContexto325", "comandos331", "presentacion332", "laboratorio341", "caso342", "quiz-redes-321h-rap02"],
    },
    "guia-redes11-rap03": {
      family: "guia-redes-rap03",
      prefix: "g5r_",
      ids: ["reflexion311", "bloqueA321", "bloqueB322", "bloqueC323", "bloqueD324", "exportBloques321a324",
        "entregaContexto", "demoHerramientas331", "plantilla1Inventario", "plantilla2IP", "plantilla3Pruebas", "informeTecnico"],
    },
  };

  var DRIVE_FOLDERS = {
    // Mismas carpetas de ficha que js/project_integrations.js (fichaDriveFolders).
  };

  var portalAuth = window.portalAuth || null;
  var LEGACY_STORAGE_KEY = "guia_interactiva_" + PAGE_KEY;
  var STORAGE_KEY = portalAuth
    ? portalAuth.getScopedStorageKey(LEGACY_STORAGE_KEY, { area: "guide-data" })
    : LEGACY_STORAGE_KEY;

  var state = window.GuideCloudSync ? window.GuideCloudSync.loadLocal(STORAGE_KEY, LEGACY_STORAGE_KEY) : {};
  var booted = false;

  function getActor() {
    var session = portalAuth && portalAuth.getCurrentSession && portalAuth.getCurrentSession();
    return (session && session.user && (session.user.fullName || session.user.username)) || "Aprendiz";
  }

  var cloudStore = window.GuideCloudSync && window.GuideCloudSync.createStore({
    storageKey: STORAGE_KEY,
    legacyStorageKey: LEGACY_STORAGE_KEY,
    guideDataFile: PAGE_FILE,
    getState: function () { return state; },
    setState: function (next) { state = next; },
    getActor: getActor,
    periodicRefreshMs: 300000,
    onHydrated: function () { hydrateFields(); applyOptionalLocks(); updateProgress(); renderLegacy(); },
  });

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    if (cloudStore) cloudStore.notifyChanged();
    updateProgress();
  }

  function templateName() {
    var ctx = window.__GUIDE_RUNTIME_CONTEXT__ || {};
    if (ctx.template) return ctx.template;
    var el = document.querySelector("[data-redes11-guide]");
    return (el && el.getAttribute("data-redes11-guide")) || "";
  }

  function getConfig() {
    return (window.ActivityStandard && window.ActivityStandard.getConfigForGuide(PAGE_FILE)) || {};
  }

  // ── Formularios ──────────────────────────────────────────────────────────
  function hydrateFields() {
    document.querySelectorAll("[data-store]").forEach(function (el) {
      var key = el.getAttribute("data-store");
      if (!key) return;
      var value = state[key];
      if (typeof value === "string" || typeof value === "number") {
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT") el.value = value;
      }
    });
  }

  function onFieldEvent(event) {
    var target = event.target;
    if (!target || !target.matches || !target.matches("[data-store]")) return;
    var key = target.getAttribute("data-store");
    if (!key) return;
    if (target.disabled) return;
    state[key] = target.value;
    saveState();
  }

  function bindFieldEvents() {
    document.addEventListener("input", onFieldEvent);
    document.addEventListener("change", onFieldEvent);
  }

  // Campos OPCIONALES (filas 4-10 de la Plantilla 3, secciones 7-8 del indice): no
  // son obligatorios para guardar, pero quedan bloqueados junto con su actividad.
  function applyOptionalLocks() {
    document.querySelectorAll("[data-optional-of]").forEach(function (el) {
      var actId = el.getAttribute("data-optional-of");
      var locked = Boolean(state[actId + "-locked"]);
      el.disabled = locked;
      el.style.opacity = locked ? "0.75" : "";
    });
  }

  // ── Contexto para ActivityStandard ───────────────────────────────────────
  function getGuideSelection() {
    var ds = document.body.dataset || {};
    return {
      ficha: ds.ficha || ds.defaultFicha || "",
      grupo: ds.grupo || ds.defaultGrupo || "",
      inst: ds.inst || ds.defaultInst || "",
    };
  }

  function renderTopbarCampus() {
    var el = document.getElementById("topbarCampus");
    if (!el) return;
    var sel = getGuideSelection();
    var inst = sel.inst || document.body.dataset.defaultInst || "";
    var grupo = sel.grupo || document.body.dataset.defaultGrupo || "";
    if (inst) el.textContent = grupo ? inst + " | " + grupo : inst;
  }

  function getCurrentLearnerName() {
    var session = portalAuth && portalAuth.getCurrentSession && portalAuth.getCurrentSession();
    return (session && session.user && (session.user.fullName || session.user.username)) || "";
  }

  function getStateCtx() {
    return {
      getState: function () { return state; },
      saveState: saveState,
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: function () { return getConfig(); },
      getGuideDataFile: function () { return PAGE_FILE; },
    };
  }

  function openDriveFolder() {
    var integ = window.PROJECT_INTEGRATIONS || {};
    var url = (integ.fichaDriveFolders || {})[getGuideSelection().ficha] || DRIVE_FOLDERS[getGuideSelection().ficha] || "";
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else if (window.portalAlert) window.portalAlert("Usa el boton Entregar a Drive de cada actividad.", { type: "info" });
  }

  function mountDriveDelivery() {
    if (!window.sharedDriveDelivery || !window.sharedDriveDelivery.appendDriveDeliveryPanels) return;
    if (!window.ActivityStandard || !window.ActivityStandard.buildDriveTargets) return;
    var targets = window.ActivityStandard.buildDriveTargets(PAGE_FILE, {
      getLearnerName: getCurrentLearnerName,
      getSelection: getGuideSelection,
      getGuideMetadata: function () { return getConfig(); },
    });
    if (!targets.length) return;
    window.sharedDriveDelivery.appendDriveDeliveryPanels({ targets: targets, onDriveClick: openDriveFolder });
  }

  // ── Progreso ─────────────────────────────────────────────────────────────
  function requiredFields() {
    var out = [];
    (getConfig().activities || []).forEach(function (a) {
      (a.formFields || []).forEach(function (k) { out.push(k); });
    });
    return out;
  }

  var SECTION_BY_PREFIX = { "3.1": "reflexion", "3.2": "contexto", "3.3": "apropiacion", "3.4": "transferencia" };

  function updateProgress() {
    var fields = requiredFields();
    var filled = fields.filter(function (k) { return String(state[k] || "").trim().length > 0; }).length;
    var total = fields.length;
    var pct = total > 0 ? Math.round((filled / total) * 100) : 0;
    var bar = document.getElementById("progressBar");
    var lbl = document.getElementById("progressValue");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = pct + "%";
    if (portalAuth && portalAuth.writeGuideProgress) {
      portalAuth.writeGuideProgress(PAGE_FILE, { completed: filled, total: total, percent: pct });
    }
    var bySection = {};
    (getConfig().activities || []).forEach(function (a) {
      var sect = SECTION_BY_PREFIX[String(a.number || "").slice(0, 3)];
      if (!sect) return;
      (bySection[sect] = bySection[sect] || []).push(a.id + "-locked");
    });
    document.querySelectorAll(".nav-link .check").forEach(function (c) { c.classList.remove("done"); });
    Object.keys(bySection).forEach(function (sect) {
      if (bySection[sect].every(function (k) { return state[k]; })) {
        var link = document.querySelector('.nav-link[href="#' + sect + '"] .check');
        if (link) link.classList.add("done");
      }
    });
    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct: pct } }));
  }

  // ── Version anterior (solo lectura) ──────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function legacyEntries(st, legacy) {
    var rows = [];
    Object.keys(st || {}).sort().forEach(function (key) {
      var isField = key.indexOf(legacy.prefix) === 0;
      var isActKey = legacy.ids.some(function (id) { return key === id + "-locked" || key.indexOf(id + "-delivery") === 0; });
      if (!isField && !isActKey) return;
      var v = st[key];
      if (v == null || v === "" || v === false) return;
      rows.push({ key: key, value: typeof v === "object" ? JSON.stringify(v) : String(v) });
    });
    return rows;
  }

  function renderLegacy() {
    var host = document.querySelector("[data-redes11-legacy]");
    var legacy = LEGACY[templateName()];
    if (!host || !legacy) return;
    var rows = legacyEntries(state, legacy);
    if (!rows.length) {
      host.innerHTML = '<p class="intro-text">No hay registros de la versión anterior en esta cuenta.</p>';
      return;
    }
    host.innerHTML = '<p class="intro-text"><strong>' + rows.length + "</strong> registro(s) conservados de la versión anterior:</p>" +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Registro</th><th>Contenido guardado</th></tr></thead><tbody>' +
      rows.map(function (r) { return "<tr><td><code>" + esc(r.key) + "</code></td><td>" + esc(r.value) + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
  }

  // ── Reinicio (solo los campos de ESTA version; nunca la version anterior) ─
  function bindReset() {
    var btn = document.getElementById("resetProgress");
    if (!btn) return;
    btn.addEventListener("click", async function () {
      var ok = window.portalConfirm
        ? await window.portalConfirm("¿Reiniciar las respuestas NO enviadas de esta guía? Las actividades ya guardadas o entregadas y los registros de la versión anterior se conservan.", { title: "Reiniciar respuestas", confirmText: "Reiniciar" })
        : false;
      if (!ok) return;
      (getConfig().activities || []).forEach(function (a) {
        if (state[a.id + "-locked"]) return;   // lo enviado no se toca
        (a.formFields || []).concat(a.optionalFields || []).forEach(function (k) { delete state[k]; });
      });
      saveState();
      document.querySelectorAll("[data-store]").forEach(function (el) {
        if (!el.disabled && state[el.getAttribute("data-store")] == null) el.value = "";
      });
      updateProgress();
    });
  }

  function reflectGrades() {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.reflectGradesIntoGuideState !== "function") return;
    mgr.reflectGradesIntoGuideState({
      guideFamily: templateName(),
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      onChanged: function () {
        saveState();
        applyOptionalLocks();
        if (window.ActivityStandard && typeof window.ActivityStandard.renderAvancePanel === "function" && document.querySelector("[data-act-std-avance]")) {
          window.ActivityStandard.renderAvancePanel({ getGuideDataFile: function () { return PAGE_FILE; }, getState: function () { return state; } });
        }
        if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("activity-deadlines-updated"));
      },
    });
  }

  function initGuiaRedes11() {
    if (booted) return;
    booted = true;
    renderTopbarCampus();
    hydrateFields();
    bindFieldEvents();
    bindReset();
    if (window.ActivityStandard && window.ActivityStandard.mountActivities) {
      window.ActivityStandard.mountActivities(getStateCtx());
    }
    mountDriveDelivery();
    applyOptionalLocks();
    updateProgress();
    renderLegacy();
    reflectGrades();
    if (cloudStore) cloudStore.hydrate();
  }

  // Tras guardar (bloqueo) o cuando el admin habilita de nuevo, re-aplica el bloqueo
  // de los campos opcionales.
  document.addEventListener("click", function (event) {
    var btn = event.target && event.target.closest ? event.target.closest(".btn-save-response") : null;
    if (btn) window.requestAnimationFrame(function () { applyOptionalLocks(); updateProgress(); });
  });
  window.addEventListener("activity-deadlines-updated", function () { applyOptionalLocks(); });
  document.addEventListener("guide-delivery-registered", function () {
    window.requestAnimationFrame(function () { updateProgress(); });
  });

  // Expuesto para pruebas.
  window.__redes11Internals = { LEGACY: LEGACY, legacyEntries: legacyEntries };

  window.initGuiaRedes = initGuiaRedes11;
  window.initGuiaRedes11 = initGuiaRedes11;
})();
