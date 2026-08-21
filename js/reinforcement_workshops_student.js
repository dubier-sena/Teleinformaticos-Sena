// js/reinforcement_workshops_student.js — pagina "Talleres de Refuerzo".
//
// El aprendiz desarrolla el taller EN LINEA, igual que una guia: cada
// actividad tiene sus propios campos de texto guardados/bloqueados con
// ActivityStandard.mountFormActivity (el MISMO motor que usan las guias
// reales -- Guardar respuestas -> bloquea campos), llamado directamente por
// actividad (sin ActivityStandard.registerGuide/mountActivities, que asumen
// una guia de acceso por ficha; un taller de refuerzo se asigna a aprendices
// puntuales, ver js/reinforcement_workshops.js). La actividad con contenido
// visual (mapa conceptual) ademas lleva un panel de entrega a Drive, mismo
// patron que "Arbol de la Vida" en la Guia de Induccion
// (sharedDriveDelivery.appendDriveDeliveryPanels).
//
// Datos: la asignacion (fechaLimite/estado/resultado, solo-admin-escribe)
// vive en reinforcementWorkshops; las RESPUESTAS de texto (el aprendiz si
// escribe la suya) viven aparte, en reinforcementWorkshops.saveWorkshopAnswers
// -- ver el comentario de separacion de colecciones en firestore.rules.
(function () {
  "use strict";

  var CLOUD_SAVE_DEBOUNCE_MS = 1200;
  var _saveTimers = {};      // workshopId -> timer
  var _respuestasByWorkshop = {};  // workshopId -> objeto respuestas (referencia viva)

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // workshop.id (ej. "taller_guia-01-induccion_175...") tiene guiones -- no se
  // puede usar tal cual en un id efectivo de actividad: ActivityStandard
  // genera botones con onclick="actStd_save_{id}()", y un guion ahi se lee
  // como resta en JS (rompe el boton en silencio). Se sanea SIEMPRE que se
  // arma un effectiveId o una llave de campo, tanto al escribir como al leer,
  // para que ambos lados coincidan exactamente.
  function safeId(value) {
    return String(value).replace(/[^a-zA-Z0-9_]/g, "_");
  }

  function formatFecha(value) {
    if (!value) return "";
    var d = new Date(String(value).length <= 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return String(value);
    try {
      return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  function getSession() {
    var auth = window.portalAuth;
    return auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
  }

  function fillMeta(session) {
    var user = session && session.user;
    var nameEl = document.getElementById("taller-meta-name");
    var instEl = document.getElementById("taller-meta-inst");
    var fichaEl = document.getElementById("taller-meta-ficha");
    if (nameEl) nameEl.textContent = (user && user.fullName) || "—";
    if (instEl) instEl.textContent = (user && user.inst) || "—";
    if (fichaEl) fichaEl.textContent = (user && user.ficha) || "—";
  }

  function renderNotStudent() {
    var container = document.getElementById("taller-content");
    if (!container) return;
    container.innerHTML = '<p class="taller-status">Inicia sesion como aprendiz para ver tus talleres de refuerzo.</p>';
  }

  function renderEmpty() {
    var container = document.getElementById("taller-content");
    if (!container) return;
    container.innerHTML = '<p class="taller-status">No tienes ningun taller de refuerzo asignado por ahora.</p>';
  }

  // ── Guardado (local instantaneo + nube con debounce, mismo criterio de
  //    espera que el resto del portal: "1.2 s") ───────────────────────────────
  function scheduleCloudSave(usernameKey, workshopId) {
    if (_saveTimers[workshopId]) clearTimeout(_saveTimers[workshopId]);
    _saveTimers[workshopId] = setTimeout(function () {
      delete _saveTimers[workshopId];
      window.reinforcementWorkshops.saveWorkshopAnswers(usernameKey, workshopId, _respuestasByWorkshop[workshopId] || {});
    }, CLOUD_SAVE_DEBOUNCE_MS);
  }

  function makeStateCtx(usernameKey, workshop, catalogEntry) {
    return {
      getState: function () { return _respuestasByWorkshop[workshop.id]; },
      saveState: function () { scheduleCloudSave(usernameKey, workshop.id); },
      getLearnerName: function () { var s = getSession(); return (s && s.user && s.user.fullName) || ""; },
      getSelection: function () {
        var s = getSession();
        var u = (s && s.user) || {};
        return { ficha: u.ficha || "", grupo: u.grupo || "", inst: u.inst || "" };
      },
      getGuideMetadata: function () {
        return {
          guideNumber: catalogEntry.guideNumber || "",
          guideTitle: catalogEntry.guideTitle || catalogEntry.title || "",
          program: catalogEntry.program || "",
          competencia: "",
          resultado: "",
        };
      },
      getGuideDataFile: function () { return "taller-refuerzo:" + workshop.workshopKey; },
    };
  }

  // ── Markup de un campo de texto: mismo patron exacto que usan las guias
  //    reales (label > span + textarea, ver .notes-card label en
  //    css/guia_template.css) para que se vea y se comporte igual. ─────────
  function fieldMarkup(key, label, placeholder, value, dataAttr, disabled) {
    return (
      "<label>" +
      "<span>" + escapeHtml(label) + "</span>" +
      '<textarea rows="3" ' + dataAttr + '="' + escapeHtml(key) + '" placeholder="' +
      escapeHtml(placeholder || "") + '"' + (disabled ? " disabled" : "") + ">" +
      escapeHtml(value) + "</textarea>" +
      "</label>"
    );
  }

  // Campo de "documento" (intro/conclusiones/referencias): autoguardado, sin
  // boton ni bloqueo propio.
  function docFieldMarkup(workshop, field, respuestas) {
    var key = safeId(workshop.id) + "__" + field.key;
    return fieldMarkup(key, field.label, field.placeholder, respuestas[key] || "", "data-doc-field", false);
  }

  function activityFieldsMarkup(workshop, fields, respuestas, disabled) {
    return fields.map(function (f) {
      var key = safeId(workshop.id) + "__" + f.key;
      return fieldMarkup(key, f.label, f.placeholder, respuestas[key] || "", "data-store", disabled);
    }).join("");
  }

  // Seccion de "documento final" (intro/conclusiones/referencias): mismo
  // envoltorio .notes-card que una actividad real (hereda el estilo de
  // label/span/textarea), con una explicacion de para que sirven estos
  // campos -- mismo feedback del usuario que motivo el resto del rediseno
  // ("el aprendiz no sabe que es cada actividad").
  function docFieldsSectionMarkup(workshop, catalogEntry, respuestas) {
    var fieldsHtml = (catalogEntry.docFields || []).map(function (f) {
      return docFieldMarkup(workshop, f, respuestas);
    }).join("");
    if (!fieldsHtml) return "";
    return (
      '<article class="notes-card taller-docfields">' +
        "<h3>Tu documento final</h3>" +
        '<p class="intro-text">Estos campos arman la portada de tu documento final en Word: cuenta brevemente el proposito de tu trabajo, que aprendiste y que fuentes usaste. Se guardan automaticamente mientras escribes y puedes ajustarlos hasta la fecha limite.</p>' +
        fieldsHtml +
      "</article>"
    );
  }

  function readOnlyDocFieldsMarkup(workshop, catalogEntry, respuestas) {
    var fieldsHtml = (catalogEntry.docFields || []).map(function (f) {
      var v = respuestas[safeId(workshop.id) + "__" + f.key];
      return v ? '<p><strong>' + escapeHtml(f.label) + ":</strong> " + escapeHtml(v) + "</p>" : "";
    }).join("");
    if (!fieldsHtml) return "";
    return '<article class="notes-card taller-docfields"><h3>Documento final</h3>' + fieldsHtml + "</article>";
  }

  function instruccionesMarkup(act) {
    var items = (act.instrucciones || []).map(function (i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("");
    if (!items) return "";
    return '<article class="support-card"><h3>Instrucciones</h3><ol>' + items + "</ol></article>";
  }

  function objetivoMarkup(act) {
    return act.objetivo
      ? '<p class="intro-text"><strong>Propósito:</strong> ' + escapeHtml(act.objetivo) + "</p>"
      : "";
  }

  // Mismo look que una actividad real de guia: .activity.mission-card ->
  // .activity-header (numero + titulo) -> .activity-body con .intro-text
  // (proposito), .support-card (instrucciones numeradas) y .notes-card
  // (campos de respuesta + botones). Se renderiza siempre "open" (sin
  // plegado/despliegue): el taller solo tiene 6 actividades, no hace falta
  // la complejidad de toggleActivity() que usan las guias largas.
  function activityCardMarkup(workshop, act) {
    var effectiveId = safeId(workshop.id) + "__" + act.id;
    var AS = window.ActivityStandard;
    var buttonsHtml = AS.renderFormButtons(effectiveId, {
      saveId: "btnGuardar_" + effectiveId,
      statusId: "status_" + effectiveId,
      noWord: true,
    });
    var driveHtml = act.type === "both"
      ? AS.renderFileButton(effectiveId, { description: act.driveTarget.description, note: act.driveTarget.note })
      : "";
    return (
      '<div class="activity open mission-card" id="wrap_' + escapeHtml(effectiveId) + '">' +
        '<div class="activity-header">' +
          '<span class="activity-num">Actividad ' + escapeHtml(act.number) + "</span>" +
          '<span class="activity-title">' + escapeHtml(act.label) + "</span>" +
        "</div>" +
        '<div class="activity-body">' +
          objetivoMarkup(act) +
          instruccionesMarkup(act) +
          '<article class="notes-card" style="margin-top:16px">' +
            "<h3>Tus respuestas</h3>" +
            activityFieldsMarkup(workshop, act.fields, _respuestasByWorkshop[workshop.id], false) +
            buttonsHtml +
          "</article>" +
          driveHtml +
        "</div>" +
      "</div>"
    );
  }

  // ── Panel de entrega a Drive de una actividad "both" (solo Actividad 3):
  //    mismo evento global que usa shared_apps_script_delivery.js, pero se
  //    persiste en la respuesta del taller (no en el "state" de una guia). ──
  function mountDriveActivity(usernameKey, workshop, act) {
    var effectiveId = safeId(workshop.id) + "__" + act.id;
    var respuestas = _respuestasByWorkshop[workshop.id];
    var deliveryKey = effectiveId + "-delivery";
    var mountEl = document.querySelector('[data-act-std-delivery="' + effectiveId + '"]');

    function restore() {
      var record = respuestas[deliveryKey];
      if (record && mountEl) {
        window.ActivityStandard.renderDeliveryStatus(record, mountEl);
        var group = document.querySelector('[data-act-std-drive="' + effectiveId + '"]');
        var btn = group && group.querySelector(".btn-drive, .btn-apps-script, button");
        if (btn) btn.style.display = "none";
      }
    }
    restore();

    var sdd = window.sharedDriveDelivery;
    if (sdd && typeof sdd.appendDriveDeliveryPanels === "function") {
      sdd.appendDriveDeliveryPanels({
        targets: [{
          activityNumber: act.number,
          panelKey: effectiveId,
          deadlineActivityId: effectiveId,
          description: act.driveTarget.description,
          note: act.driveTarget.note,
          activityContext: {
            activityTitle: act.label,
            fileNamePrefix: "TallerRefuerzo_" + workshop.workshopKey + "_" + (act.shortName || act.id),
            learnerNameMode: "full",
          },
        }],
      });
    }

    document.addEventListener("guide-delivery-registered", function (event) {
      var record = (event && event.detail) || {};
      if ((record.panelKey || "") !== effectiveId) return;
      respuestas[deliveryKey] = {
        submittedAt: record.submittedAt || new Date().toISOString(),
        savedFileName: record.savedFileName || record.nombreArchivoEstandar || "",
        driveUrl: record.driveUrl || record.enlaceDrive || "",
        status: "delivered",
      };
      scheduleCloudSave(usernameKey, workshop.id);
      restore();
    });
  }

  // ── Exportacion del taller completo a Word (todas las secciones juntas,
  //    para que el aprendiz conserve el "documento unico" que pedia el
  //    taller impreso). ───────────────────────────────────────────────────
  function exportWorkshopWord(usernameKey, workshop, catalogEntry) {
    var AS = window.ActivityStandard;
    var respuestas = _respuestasByWorkshop[workshop.id] || {};
    var session = getSession();
    var user = (session && session.user) || {};
    var sections = [];
    (catalogEntry.docFields || []).forEach(function (f) {
      sections.push({ label: f.label, value: respuestas[safeId(workshop.id) + "__" + f.key] || "" });
    });
    (catalogEntry.activities || []).forEach(function (act) {
      sections.push({ label: "Actividad " + act.number + " — " + act.label, value: "" });
      (act.fields || []).forEach(function (f) {
        sections.push({ label: "  " + f.label, value: respuestas[safeId(workshop.id) + "__" + f.key] || "" });
      });
    });
    var html = AS.buildWordDocument({
      title: catalogEntry.title,
      learnerName: user.fullName || "",
      ficha: user.ficha || "",
      grupo: user.grupo || "",
      inst: user.inst || "",
      fecha: new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
      program: catalogEntry.program || "",
      competencia: "",
      resultado: "",
      guideTitle: catalogEntry.guideTitle || catalogEntry.title,
      sections: sections,
    });
    AS.downloadWordDoc(html, "TallerRefuerzo_" + workshop.workshopKey + "_" + String(user.fullName || "Aprendiz").replace(/\s+/g, "") + ".doc");
  }

  // ── Tarjeta interactiva (estado "asignado": aun se puede trabajar) ────────
  function renderEditableWorkshop(usernameKey, workshop, catalogEntry) {
    var AS = window.ActivityStandard;
    var fecha = workshop.fechaLimite ? formatFecha(workshop.fechaLimite) : "—";
    var docFieldsHtml = docFieldsSectionMarkup(workshop, catalogEntry, _respuestasByWorkshop[workshop.id]);
    var activitiesHtml = (catalogEntry.activities || []).map(function (act) {
      return activityCardMarkup(workshop, act);
    }).join("");

    var html =
      '<div class="taller-card">' +
      '<div class="taller-card__head">' +
        "<h2>" + escapeHtml(catalogEntry.title) + "</h2>" +
        '<span class="taller-estado taller-estado--asignado">Asignado</span>' +
      "</div>" +
      (workshop.motivo ? '<p class="taller-card__motivo">' + escapeHtml(workshop.motivo) + "</p>" : "") +
      '<dl class="taller-card__meta"><dt>Fecha límite</dt><dd>' + escapeHtml(fecha) + "</dd></dl>" +
      (workshop.fileUrl
        ? '<p><a class="c-btn c-btn--secondary" href="' + escapeHtml(workshop.fileUrl) + '" target="_blank" rel="noopener">📄 Ver instrucciones completas (PDF)</a></p>'
        : "") +
      docFieldsHtml +
      activitiesHtml +
      '<div class="taller-export"><button type="button" class="c-btn c-btn--primary" data-taller-export="' + escapeHtml(workshop.id) + '">📘 Exportar taller completo a Word</button></div>' +
      "</div>";

    return html;
  }

  function bindEditableWorkshop(usernameKey, workshop, catalogEntry) {
    var AS = window.ActivityStandard;
    var stateCtx = makeStateCtx(usernameKey, workshop, catalogEntry);

    // Campos de documento: autoguardado simple (sin boton, sin bloqueo).
    (catalogEntry.docFields || []).forEach(function (f) {
      var key = safeId(workshop.id) + "__" + f.key;
      var el = document.querySelector('[data-doc-field="' + key + '"]');
      if (!el) return;
      el.addEventListener("input", function () {
        _respuestasByWorkshop[workshop.id][key] = el.value;
        scheduleCloudSave(usernameKey, workshop.id);
      });
    });

    (catalogEntry.activities || []).forEach(function (act) {
      var effectiveId = safeId(workshop.id) + "__" + act.id;
      var formFields = act.fields.map(function (f) { return safeId(workshop.id) + "__" + f.key; });

      // ActivityStandard.mountFormActivity SOLO valida/bloquea/guarda -- no
      // sincroniza el tecleo del aprendiz hacia el state (eso lo hace cada
      // guia por su cuenta, ver bindEvents() en script_induccion.js). Sin
      // este listener, "Guardar respuestas" siempre veria los campos vacios
      // aunque el aprendiz ya hubiera escrito en ellos.
      formFields.forEach(function (key) {
        var el = document.querySelector('[data-store="' + key + '"]');
        if (!el) return;
        el.addEventListener("input", function () {
          _respuestasByWorkshop[workshop.id][key] = el.value;
          scheduleCloudSave(usernameKey, workshop.id);
        });
      });

      AS.mountFormActivity({
        id: effectiveId,
        number: act.number,
        label: act.label,
        shortName: act.shortName,
        type: act.type,
        formFields: formFields,
        buttonIds: { save: "btnGuardar_" + effectiveId, status: "status_" + effectiveId },
      }, stateCtx);

      if (act.type === "both") mountDriveActivity(usernameKey, workshop, act);
    });

    var exportBtn = document.querySelector('[data-taller-export="' + workshop.id + '"]');
    if (exportBtn) exportBtn.addEventListener("click", function () { exportWorkshopWord(usernameKey, workshop, catalogEntry); });
  }

  // ── Tarjeta de solo lectura (entregado/vencido/superado/no_superado) ─────
  //    Misma estructura visual que la editable (.activity.mission-card con
  //    objetivo + instrucciones), solo que las respuestas se muestran como
  //    texto plano en vez de textarea -- para que el aprendiz siga viendo el
  //    contexto de cada actividad al revisar un taller ya cerrado.
  function readOnlyFieldsMarkup(workshop, fields, respuestas) {
    return fields.map(function (f) {
      var v = respuestas[safeId(workshop.id) + "__" + f.key];
      return '<p><strong>' + escapeHtml(f.label) + ":</strong> " + (v ? escapeHtml(v) : "<em>(sin respuesta)</em>") + "</p>";
    }).join("");
  }

  function readOnlyActivityMarkup(workshop, act, respuestas) {
    return (
      '<div class="activity open mission-card">' +
        '<div class="activity-header">' +
          '<span class="activity-num">Actividad ' + escapeHtml(act.number) + "</span>" +
          '<span class="activity-title">' + escapeHtml(act.label) + "</span>" +
        "</div>" +
        '<div class="activity-body">' +
          objetivoMarkup(act) +
          instruccionesMarkup(act) +
          '<article class="notes-card" style="margin-top:16px">' +
            "<h3>Tus respuestas</h3>" +
            readOnlyFieldsMarkup(workshop, act.fields, respuestas) +
          "</article>" +
        "</div>" +
      "</div>"
    );
  }

  function renderReadOnlyWorkshop(usernameKey, workshop, catalogEntry, status) {
    var mgr = window.reinforcementWorkshops;
    var label = mgr.WORKSHOP_STATUS_LABELS[status] || status;
    var respuestas = mgr.getWorkshopAnswers(usernameKey, workshop.id);
    var fecha = workshop.fechaLimite ? formatFecha(workshop.fechaLimite) : "—";

    var docsHtml = readOnlyDocFieldsMarkup(workshop, catalogEntry, respuestas);

    var actsHtml = (catalogEntry.activities || []).map(function (act) {
      return readOnlyActivityMarkup(workshop, act, respuestas);
    }).join("");

    var cerradoMsg = status === "vencido"
      ? '<p class="taller-card__cerrado">La entrega de este taller está cerrada (fecha vencida). Pide al instructor que la reabra.</p>'
      : "";

    return (
      '<div class="taller-card">' +
      '<div class="taller-card__head">' +
        "<h2>" + escapeHtml(catalogEntry.title) + "</h2>" +
        '<span class="taller-estado taller-estado--' + escapeHtml(status) + '">' + escapeHtml(label) + "</span>" +
      "</div>" +
      '<dl class="taller-card__meta"><dt>Fecha límite</dt><dd>' + escapeHtml(fecha) + "</dd></dl>" +
      (workshop.fileUrl
        ? '<p><a class="c-btn c-btn--secondary" href="' + escapeHtml(workshop.fileUrl) + '" target="_blank" rel="noopener">📄 Ver instrucciones completas (PDF)</a></p>'
        : "") +
      cerradoMsg +
      docsHtml +
      actsHtml +
      "</div>"
    );
  }

  async function renderList(usernameKey, workshops) {
    var container = document.getElementById("taller-content");
    if (!container) return;
    if (!workshops.length) { renderEmpty(); return; }

    var catalog = window.reinforcementWorkshopsCatalog || {};
    var mgr = window.reinforcementWorkshops;
    var now = Date.now();
    var sorted = workshops.slice().sort(function (a, b) {
      return String(b.fechaAsignacion).localeCompare(String(a.fechaAsignacion));
    });

    var cardsHtml = [];
    var editable = [];
    sorted.forEach(function (workshop) {
      var catalogEntry = catalog[workshop.workshopKey];
      if (!catalogEntry) return;  // taller de un catalogo que ya no existe
      var status = mgr.deriveWorkshopStatus(workshop, now);
      if (status === "asignado") {
        _respuestasByWorkshop[workshop.id] = mgr.getWorkshopAnswers(usernameKey, workshop.id);
        cardsHtml.push(renderEditableWorkshop(usernameKey, workshop, catalogEntry));
        editable.push({ workshop: workshop, catalogEntry: catalogEntry });
      } else {
        cardsHtml.push(renderReadOnlyWorkshop(usernameKey, workshop, catalogEntry, status));
      }
    });

    if (!cardsHtml.length) { renderEmpty(); return; }
    container.innerHTML = cardsHtml.join("");
    editable.forEach(function (e) { bindEditableWorkshop(usernameKey, e.workshop, e.catalogEntry); });
  }

  async function init() {
    var session = getSession();
    fillMeta(session);

    if (!session || session.role !== "student" || !session.usernameKey) {
      renderNotStudent();
      return;
    }
    var mgr = window.reinforcementWorkshops;
    if (!mgr) { renderEmpty(); return; }
    var usernameKey = session.usernameKey;
    var workshops = await mgr.syncStudentWorkshopsFromCloud(usernameKey);
    await mgr.syncStudentAnswersFromCloud(usernameKey);
    await renderList(usernameKey, Array.isArray(workshops) ? workshops : []);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
