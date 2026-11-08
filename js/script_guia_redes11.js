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
    // Guia 9 (fase 2, 2026-11-08): la version anterior la manejaba script_guia_redes.js
    // (compartido con 10.) con decenas de claves dinamicas; se muestra en modo
    // "foreign": toda clave que NO pertenezca a la version oficial actual.
    "guia-redes11-rap01": {
      family: "guia-redes-rap01",
      mode: "foreign",
      prefix: "",
      ids: ["reflexion311", "socializacion311", "bloqueA", "bloqueB", "bloqueC", "bloqueD", "bloqueE", "mapaMental322",
        "quiz-redes-321h", "ip1", "ip2", "ip3", "taller-ip-ej1", "taller-ip-ej2", "taller-ip-ej3", "taller-ip-ej4",
        "taller-ip-ej5", "quiz-redes-33h", "lab1", "lab2", "lab3", "social"],
    },
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

  // Rediseno visual (fase 2): hoja de estilos propia, solo en estas guias.
  var STYLE_HREF = "css/guia_redes11.css?v=20261108_8";
  (function ensureStyles() {
    if (typeof document === "undefined" || !document.head || !document.createElement) return;
    if (document.querySelector('link[data-redes11-css]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    link.setAttribute("data-redes11-css", "1");
    document.head.appendChild(link);
  })();

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
    onHydrated: function () { hydrateFields(); applyOptionalLocks(); updateProgress(); renderLegacy(); renderModelAnswers(); },
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
    placeDeliveryPanelsInEvidenceZones();
  }

  // Rediseno (fase 2): shared_drive_delivery agrega el panel de entrega al final de
  // la actividad; aqui se MUEVE (mismo nodo, mismos eventos y estados) dentro de su
  // zona de evidencias para que producto, formatos, botones y estado queden juntos.
  function placeDeliveryPanelsInEvidenceZones() {
    var byPanel = {};
    (getConfig().activities || []).forEach(function (a) {
      if (a.driveTarget && a.driveTarget.panelKey) byPanel[a.driveTarget.panelKey] = a.id;
    });
    document.querySelectorAll("[data-drive-panel]").forEach(function (panel) {
      var actId = byPanel[panel.getAttribute("data-drive-panel")];
      if (!actId) return;
      var holder = document.querySelector('.r11-evidence [data-act-std-delivery="' + actId + '"]');
      if (!holder || holder.parentNode.contains(panel)) return;
      holder.parentNode.insertBefore(panel, holder);
    });
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
    renderRapStatus();
    renderModelAnswers();
    document.dispatchEvent(new CustomEvent("guide-progress-changed", { detail: { pct: pct } }));
  }

  // ── Estado del RAP (fase 3, Codex) ────────────────────────────────────────
  // Distingue evidencias OFICIALES (condicionan el RAP) de actividades formativas, y
  // entrega real de aprobacion. El RAP solo figura APROBADO si todas las evidencias
  // oficiales estan entregadas (archivo real o respuestas guardadas) y aprobadas.
  function renderRapStatus() {
    var mgr = window.activityGradesManager;
    var avance = document.querySelector("[data-act-std-avance]");
    if (!avance || !mgr || typeof mgr.evaluateRapStatus !== "function") return;
    var host = document.querySelector("[data-redes11-rap]");
    if (!host) {
      host = document.createElement("div");
      host.setAttribute("data-redes11-rap", "");
      host.className = "r11-rap";
      avance.parentNode.insertBefore(host, avance.nextSibling);
    }
    var session = portalAuth && portalAuth.getCurrentSession && portalAuth.getCurrentSession();
    var family = templateName();
    var grades = session && session.usernameKey && typeof mgr.getStudentGrades === "function" ? mgr.getStudentGrades(session.usernameKey, family) : {};
    var u = (session && session.user) || {};
    // Fase 3f: la sesion del navegador no atesta identidad -> identityVerified:false.
    var subject = { usernameKey: (session && session.usernameKey) || "", ficha: String(u.ficha || getGuideSelection().ficha || ""), uid: String(u.uid || ""), identityVerified: false };
    var rap = mgr.evaluateRapStatus(family, grades, state, getConfig().activities || [], subject);
    if (!rap) { host.innerHTML = ""; return; }
    var estado = rap.status === "aprobado" ? "RAP APROBADO" : rap.status === "pendiente-nueva-verificacion" ? "RAP pendiente de nueva verificación" : rap.status === "pendiente-verificacion" ? "RAP pendiente de verificación" : "RAP en proceso";
    host.innerHTML = '<div class="r11-rap__head"><strong>Estado del RAP</strong><span class="r11-chip' + (rap.status === "aprobado" ? "" : " r11-chip--format") + '">' + esc(estado) + "</span></div>" +
      '<p class="intro-text">Evidencias oficiales verificadas por el instructor: <strong>' + rap.delivered + "/" + rap.total + "</strong> · aprobadas: <strong>" + rap.approved + "/" + rap.total + "</strong>. Guardar o enviar desde la guía no basta: el instructor verifica cada evidencia (si después la cambia, debe verificarse de nuevo). Las actividades que piden formulario Y archivo necesitan las dos partes. Las demás son formativas.</p>" +
      '<div class="table-scroll"><table class="data-table"><thead><tr><th>Evidencia oficial</th><th>Formulario</th><th>Archivo</th><th>Verificación</th><th>Aprobada</th></tr></thead><tbody>' +
      rap.items.map(function (i) {
        var archivo = !i.needsFile ? "No aplica" : i.fileState === "missing" ? "&#9711; Falta" : "&#128228; Entregado";
        var form = !i.needsForm ? "No aplica" : i.formState === "missing" ? "&#9711; Falta (complete y envíe)" : "&#128190; Enviado";
        var verif = i.evidence === "verificada" ? "&#9989; Verificada" : i.evidence === "nueva-verificacion" ? "&#9888;&#65039; Cambió: pendiente de nueva verificación" : i.evidence === "integridad-pendiente" ? "&#9203; Pendiente de verificación de integridad" : i.evidence === "por-verificar" ? "&#9203; Pendiente de verificación" : "—";
        return "<tr><td>" + esc((i.number ? i.number + " " : "") + i.label) + "</td><td>" + form + "</td><td>" + archivo + "</td><td>" + verif + "</td><td>" + (i.approved ? "&#9989; Sí" : i.failed ? "&#10060; No aprobada" : "&#9711; Pendiente") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  // ── Respuestas modelo de actividades APROBADAS (ajuste 2026-11-08) ─────────
  // Igual que en las demas guias, el aprendiz consulta la respuesta modelo que el
  // instructor embebe en SUS notas al aprobar ({id}:solution). En Redes 11.° se muestra
  // SOLO de forma visual: texto de ayuda (placeholder) en los campos VACIOS y un
  // recuadro identificado. Nunca se escribe en el valor del campo ni en el estado del
  // aprendiz: no es su respuesta, no es evidencia y no afecta el estado del RAP.
  function renderModelAnswers() {
    var mgr = window.activityGradesManager;
    var session = portalAuth && portalAuth.getCurrentSession && portalAuth.getCurrentSession();
    if (!mgr || typeof mgr.getStudentGrades !== "function" || !session || session.role !== "student" || !session.usernameKey) return;
    var grades = mgr.getStudentGrades(session.usernameKey, templateName()) || {};
    (getConfig().activities || []).forEach(function (act) {
      var sol = grades[act.id + ":solution"];
      var approved = grades[act.id] === "A" && sol && typeof sol === "object";
      var labels = {};
      (((act.wordExport || {}).sections) || []).forEach(function (sec) { if (sec && sec.storeKey) labels[sec.storeKey] = sec.label; });
      var keys = approved ? Object.keys(sol).filter(function (k) { return k.indexOf("__") !== 0 && String(sol[k] == null ? "" : sol[k]).trim() !== ""; }) : [];
      // campos: texto de ayuda solo si el campo esta VACIO
      (act.formFields || []).concat(act.optionalFields || []).forEach(function (k) {
        var el = document.querySelector('[data-store="' + k + '"]');
        if (!el) return;
        var has = keys.indexOf(k) !== -1;
        var empty = String(state[k] == null ? "" : state[k]).trim() === "" && String(el.value || "").trim() === "";
        if (has && empty && el.tagName !== "SELECT") {
          if (!el.hasAttribute("data-r11-orig-placeholder")) el.setAttribute("data-r11-orig-placeholder", el.getAttribute("placeholder") || "");
          el.setAttribute("placeholder", "Respuesta modelo del instructor: " + String(sol[k]));
          el.classList.add("r11-model-hint");
        } else if (el.hasAttribute("data-r11-orig-placeholder")) {
          el.setAttribute("placeholder", el.getAttribute("data-r11-orig-placeholder"));
          el.removeAttribute("data-r11-orig-placeholder");
          el.classList.remove("r11-model-hint");
        }
      });
      // recuadro de consulta dentro de la actividad
      var holder = document.querySelector('[data-r11-model="' + act.id + '"]');
      if (!keys.length) { if (holder) holder.remove(); return; }
      if (!holder) {
        var anchor = document.getElementById(act.id + "GradeMount") || document.querySelector('[data-act-std-delivery="' + act.id + '"]');
        if (!anchor || !anchor.parentNode) return;
        holder = document.createElement("details");
        holder.className = "r11-model-answers";
        holder.setAttribute("data-r11-model", act.id);
        anchor.parentNode.insertBefore(holder, anchor.nextSibling);
      }
      holder.innerHTML = "<summary>&#128214; Respuesta modelo del instructor (actividad aprobada)</summary>" +
        '<p class="intro-text">Es la respuesta de referencia del banco del instructor. <strong>No reemplaza ni se guarda como su respuesta</strong>; sus respuestas y evidencias se conservan tal como las envió.</p>' +
        '<div class="table-scroll"><table class="data-table"><tbody>' +
        keys.map(function (k) { return "<tr><th>" + esc(labels[k] || k) + "</th><td>" + esc(sol[k]) + "</td></tr>"; }).join("") +
        "</tbody></table></div>";
    });
  }

  // ── Version anterior (solo lectura) ──────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // currentKeys: claves de la version oficial actual (campos + ids de actividad). En
  // modo "foreign" se muestra todo lo demas (salvo metadatos internos).
  function legacyEntries(st, legacy, currentKeys) {
    var rows = [];
    var cur = currentKeys || { fields: {}, ids: [] };
    Object.keys(st || {}).sort().forEach(function (key) {
      var isField, isActKey;
      if (legacy.mode === "foreign") {
        if (key.charAt(0) === "_" || cur.fields[key]) return;
        if (cur.ids.some(function (id) { return key === id || key.indexOf(id + "-") === 0 || key.indexOf(id + ":") === 0; })) return;
        isField = true; isActKey = false;
      } else {
        isField = legacy.prefix && key.indexOf(legacy.prefix) === 0;
        isActKey = legacy.ids.some(function (id) { return key === id + "-locked" || key.indexOf(id + "-delivery") === 0; });
      }
      if (!isField && !isActKey) return;
      var v = st[key];
      if (v == null || v === "" || v === false) return;
      var text = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (/^data:image\//.test(text)) text = "[imagen guardada en este navegador]";
      else if (text.length > 400) text = text.slice(0, 400) + "…";
      rows.push({ key: key, value: text });
    });
    return rows;
  }

  function currentKeys() {
    var fields = {};
    var ids = [];
    (getConfig().activities || []).forEach(function (a) {
      ids.push(a.id);
      (a.formFields || []).concat(a.optionalFields || []).forEach(function (k) { fields[k] = true; });
    });
    return { fields: fields, ids: ids };
  }

  function renderLegacy() {
    var host = document.querySelector("[data-redes11-legacy]");
    var legacy = LEGACY[templateName()];
    if (!host || !legacy) return;
    var rows = legacyEntries(state, legacy, currentKeys());
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
    var pending = mgr.reflectGradesIntoGuideState({
      guideFamily: templateName(),
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      onChanged: function () {
        saveState();
        applyOptionalLocks();
        renderRapStatus();
        if (window.ActivityStandard && typeof window.ActivityStandard.renderAvancePanel === "function" && document.querySelector("[data-act-std-avance]")) {
          window.ActivityStandard.renderAvancePanel({ getGuideDataFile: function () { return PAGE_FILE; }, getState: function () { return state; } });
        }
        if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("activity-deadlines-updated"));
      },
    });
    // Las notas de la nube llegan despues: el estado del RAP se recalcula al llegar
    // (en estas familias la nota no cambia el estado de la guia, asi que onChanged no se dispara).
    var afterGrades = function () { renderRapStatus(); renderModelAnswers(); };
    if (pending && typeof pending.then === "function") pending.then(afterGrades, afterGrades);
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
  // Procedencia (fase 3c, Codex): el sello "{id}-submission" se crea SOLO aqui, en el
  // flujo legitimo del aprendiz: sesion de aprendiz + clic en el boton «Guardar
  // respuestas» de esa actividad + la actividad pasa de NO enviada a enviada en ese
  // clic. Lleva la huella de las respuestas enviadas. Nada administrativo lo crea.
  var _lockBeforeClick = {};
  function activityForSaveButton(btn) {
    var id = btn && btn.id;
    if (!id) return null;
    return (getConfig().activities || []).filter(function (a) {
      return (a.type === "form" || a.type === "both") && a.buttonIds && a.buttonIds.save === id;
    })[0] || null;
  }
  document.addEventListener("click", function (event) {
    var btn = event.target && event.target.closest ? event.target.closest(".btn-save-response") : null;
    var act = activityForSaveButton(btn);
    if (act) _lockBeforeClick[act.id] = state[act.id + "-locked"] === true;
  }, true);
  function stampStudentSubmission(act) {
    var mgr = window.activityGradesManager;
    var session = portalAuth && portalAuth.getCurrentSession && portalAuth.getCurrentSession();
    if (!act || !mgr || typeof mgr.buildStudentSubmissionRecord !== "function") return;
    if (!session || session.role !== "student" || !session.usernameKey) return;
    if (_lockBeforeClick[act.id] !== false || state[act.id + "-locked"] !== true) return;
    _lockBeforeClick[act.id] = true;
    state[act.id + "-submission"] = mgr.buildStudentSubmissionRecord(state, act, session.usernameKey);
    saveState();
  }

  document.addEventListener("click", function (event) {
    var btn = event.target && event.target.closest ? event.target.closest(".btn-save-response") : null;
    if (btn) {
      var act = activityForSaveButton(btn);
      stampStudentSubmission(act);
      window.requestAnimationFrame(function () { applyOptionalLocks(); updateProgress(); });
    }
  });
  window.addEventListener("activity-deadlines-updated", function () { applyOptionalLocks(); });
  document.addEventListener("guide-delivery-registered", function () {
    window.requestAnimationFrame(function () { updateProgress(); });
  });

  // Expuesto para pruebas.
  window.__redes11Internals = { LEGACY: LEGACY, legacyEntries: legacyEntries, renderRapStatus: renderRapStatus, stampStudentSubmission: stampStudentSubmission, renderModelAnswers: renderModelAnswers };

  window.initGuiaRedes = initGuiaRedes11;
  window.initGuiaRedes11 = initGuiaRedes11;
})();
