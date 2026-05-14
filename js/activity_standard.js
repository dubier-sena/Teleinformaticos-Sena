/**
 * activity_standard.js
 *
 * Módulo reutilizable para la lógica estándar de actividades en guías SENA.
 * Cada nueva guía registra su configuración con ActivityStandard.registerGuide()
 * y llama a ActivityStandard.mountActivities() para conectar botones y lógica.
 *
 * Tipos de actividad:
 *   "form"  — formulario: Guardar respuestas + Exportar Word + Entregar a Drive
 *   "file"  — solo archivo: Entregar actividad a Drive
 *   "both"  — formulario + entrega de archivo independiente
 *
 * Nomenclatura de archivos exportados:
 *   Guia{N}_{ActNum}_{NombreBreve}_{Ficha}_{NombreAprendiz}.doc
 *   Ejemplo: Guia3_311_Bitacora_3441939_Juan_Perez.doc
 *
 * Confirmación de entrega:
 *   Tras una entrega exitosa a Drive, activity_standard.js muestra inline:
 *   fecha, hora, nombre del archivo y enlace de solo lectura al archivo.
 *   El registro también queda en el state de la guía (y por tanto en Firebase).
 */
(function () {
  "use strict";

  // ── Registro global de guías ──────────────────────────────────────────────

  var _registry = Object.create(null);

  /**
   * Registra la configuración de una guía.
   *
   * config = {
   *   files:       string[],   // nombres de los HTML que comparten esta config
   *   guideNumber: string,     // "3"
   *   guideTitle:  string,     // "Guia 3 - Planificar la informacion"
   *   stateKey:    string,     // clave base de localStorage, p.ej. "guia_interactiva_10a_guia3"
   *   program:     string,     // "Sistemas Teleinformáticos"
   *   competencia: string,
   *   resultado:   string,
   *   activities:  ActivityDef[]
   * }
   *
   * ActivityDef = {
   *   id:         string,   // "bitacora311" — usado como sufijo de la llave de bloqueo
   *   number:     string,   // "3.1.1"
   *   label:      string,   // "Bitacora individual de analisis"
   *   shortName:  string,   // "Bitacora" — parte del nombre del archivo exportado
   *   type:       "form" | "file" | "both",
   *
   *   // Solo para type "form" / "both":
   *   formFields: string[], // data-store keys de los campos del formulario
   *   buttonIds: {
   *     save:   string,     // id del botón "Guardar respuestas"
   *     status: string,     // id del elemento de estado (se muestra al bloquear)
   *   },
   *   wordExport: {
   *     sections: [{ label: string, storeKey: string }],
   *     contextBox: string,  // texto de contexto/escenario (opcional)
   *   },
   *
   *   // Para entrega a Drive (type "file" / "both"):
   *   driveTarget: {
   *     panelKey:           string,  // id único del panel de entrega
   *     deadlineActivityId: string,  // id para activityDeadlineManager
   *     activityTitle:      string,
   *     description:        string,
   *     note:               string,
   *   },
   * }
   */
  function registerGuide(config) {
    if (!config || !Array.isArray(config.files)) return;
    config.files.forEach(function (fileName) {
      _registry[fileName] = config;
    });
  }

  function getConfigForGuide(fileName) {
    return _registry[fileName] || null;
  }

  // ── API para admin_usuarios.js ────────────────────────────────────────────

  /**
   * Devuelve el array de actividades en el formato que espera admin_habilitacion.js:
   *   [{ id, label, keys, deliveryOnly }]
   * Las claves terminadas en -locked son las que el panel de habilitación puede revertir.
   */
  function getActivitiesForGuide(fileName) {
    var config = getConfigForGuide(fileName);
    if (!config) return [];
    return config.activities.map(function (act) {
      var isFileOnly = act.type === "file";
      var keys = isFileOnly
        ? [act.id + "-delivery", act.id + "-locked"]
        : (act.formFields || []).concat([act.id + "-locked"]);
      return {
        id: act.id,
        label: "Actividad " + act.number + " - " + act.label,
        keys: keys,
        deliveryOnly: isFileOnly,
      };
    });
  }

  function getStateKeyForGuide(fileName) {
    var config = getConfigForGuide(fileName);
    return config ? config.stateKey : "";
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  function escHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function escWord(v) {
    return escHtml(String(v == null ? "" : v).replace(/\n/g, "<br>"));
  }

  function sanitizeSegment(v) {
    return String(v == null ? "" : v)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getSenaLogoUrl() {
    try { return new URL("assets/img/sena-logo.png", window.location.href).href; } catch (_) { return "assets/img/sena-logo.png"; }
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  // ── Nombre estándar de archivo ─────────────────────────────────────────────

  /**
   * Genera el nombre de archivo con la estructura estándar:
   *   Guia{N}_{ActNum}_{NombreBreve}_{Ficha}_{NombreAprendiz}
   */
  function buildFileName(opts) {
    var ext = opts.ext || ".doc";
    var actNum = sanitizeSegment(String(opts.activityNumber || "").replace(/\./g, ""));
    return [
      "Guia" + sanitizeSegment(opts.guideNumber || ""),
      actNum,
      sanitizeSegment(opts.shortName) || "Actividad",
      sanitizeSegment(opts.ficha) || "SinFicha",
      sanitizeSegment(opts.learnerName) || "Aprendiz",
    ].join("_") + ext;
  }

  // ── URL de solo lectura en Drive ──────────────────────────────────────────

  /**
   * Convierte cualquier URL de Drive al formato /view (solo lectura).
   * Si la URL no es de Drive, la devuelve sin cambios.
   */
  function toViewOnlyDriveUrl(url) {
    if (!url) return "";
    try {
      var match = String(url).match(/\/file\/d\/([^/]+)/);
      if (!match) return url;
      return "https://drive.google.com/file/d/" + match[1] + "/view?usp=sharing";
    } catch (_) {
      return url;
    }
  }

  // ── Estilos de la confirmación de entrega ─────────────────────────────────

  var _stylesInjected = false;

  function _injectDeliveryStyles() {
    if (_stylesInjected || document.getElementById("act-std-delivery-styles")) return;
    _stylesInjected = true;
    var style = document.createElement("style");
    style.id = "act-std-delivery-styles";
    style.textContent = [
      ".act-std-delivery-panel {",
      "  background: #f0faf4;",
      "  border: 1.5px solid #4caf50;",
      "  border-radius: 10px;",
      "  padding: 16px 18px;",
      "  margin-top: 14px;",
      "  font-size: 14px;",
      "  line-height: 1.6;",
      "}",
      ".act-std-delivery-panel .act-std-delivery-title {",
      "  font-weight: 700;",
      "  color: #1b5e20;",
      "  font-size: 15px;",
      "  margin: 0 0 10px;",
      "}",
      ".act-std-delivery-panel ul {",
      "  margin: 0 0 10px;",
      "  padding-left: 18px;",
      "}",
      ".act-std-delivery-panel li {",
      "  margin-bottom: 4px;",
      "}",
      ".act-std-delivery-panel .act-std-delivery-link {",
      "  color: #1565c0;",
      "  font-weight: 600;",
      "  word-break: break-all;",
      "}",
      ".act-std-delivery-panel .act-std-delivery-link:hover {",
      "  text-decoration: underline;",
      "}",
      ".act-std-delivery-panel .act-std-delivery-notice {",
      "  font-size: 12px;",
      "  color: #555;",
      "  margin: 0;",
      "  border-top: 1px solid #c8e6c9;",
      "  padding-top: 8px;",
      "}",
      // Modal Word export
      "#act-std-word-modal .modal-box {",
      "  padding: 28px 28px 24px;",
      "}",
      "#act-std-word-modal input.error {",
      "  border-color: #c62828 !important;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // ── Confirmación de entrega ───────────────────────────────────────────────

  /**
   * Renderiza el panel de confirmación de entrega dentro de mountEl.
   *
   * record = {
   *   submittedAt, savedFileName, driveUrl,
   *   learnerName, ficha, institucion, activityNumber, activityTitle, status
   * }
   */
  function renderDeliveryStatus(record, mountEl) {
    if (!mountEl || !record) return;
    _injectDeliveryStyles();

    var fecha = fmtDate(record.submittedAt);
    var hora = fmtTime(record.submittedAt);
    var viewUrl = toViewOnlyDriveUrl(record.driveUrl || "");
    var fileName = record.savedFileName || "—";

    var linkHtml = viewUrl
      ? '<a href="' + escHtml(viewUrl) + '" target="_blank" rel="noopener noreferrer"' +
        ' class="act-std-delivery-link">Ver archivo entregado ↗</a>'
      : "(Enlace no disponible)";

    var noticeHtml = '<p class="act-std-delivery-notice">' +
      'Esta actividad ya fue entregada el ' + escHtml(fecha) + ' a las ' + escHtml(hora) + '. ' +
      'Puede consultar el archivo entregado en el enlace de arriba. ' +
      'Para modificar o reemplazar la entrega, debe solicitar al instructor o administrador ' +
      'que habilite nuevamente la actividad.' +
      '</p>';

    mountEl.innerHTML = [
      '<div class="act-std-delivery-panel">',
      '  <p class="act-std-delivery-title">&#9989; Actividad entregada correctamente.</p>',
      '  <ul>',
      '    <li><strong>Estado:</strong> Entregada</li>',
      '    <li><strong>Fecha de entrega:</strong> ' + escHtml(fecha) + '</li>',
      '    <li><strong>Hora de entrega:</strong> ' + escHtml(hora) + '</li>',
      '    <li><strong>Archivo entregado:</strong> ' + escHtml(fileName) + '</li>',
      '    <li><strong>Enlace del archivo:</strong> ' + linkHtml + '</li>',
      '  </ul>',
      noticeHtml,
      '</div>',
    ].join("\n");
  }

  /**
   * Encuentra el div donde montar la confirmación para una actividad dada.
   * Prioridad:
   *   1. [data-act-std-delivery="{activityId}"]
   *   2. [data-act-std-delivery="{panelKey}"]
   *   3. El .drive-action-group con [data-act-std-drive="{activityId}"]
   * Si ninguno existe, crea un div al final del primer .drive-action-group encontrado.
   */
  function _findOrCreateDeliveryMount(activityId, panelKey) {
    var el = document.querySelector('[data-act-std-delivery="' + activityId + '"]') ||
             document.querySelector('[data-act-std-delivery="' + panelKey + '"]');
    if (el) return el;

    var driveGroup = document.querySelector('[data-act-std-drive="' + activityId + '"]') ||
                     document.querySelector('[data-act-std-drive="' + panelKey + '"]');
    if (driveGroup) {
      var div = document.createElement("div");
      div.dataset.actStdDelivery = activityId;
      driveGroup.appendChild(div);
      return div;
    }

    return null;
  }

  /**
   * Escribe el registro de entrega en el state de la guía (para sincronización Firebase).
   * También activa el bloqueo de la actividad (state[actId + "-locked"] = true).
   */
  function _persistDeliveryToState(activityId, record, stateCtx) {
    var state = stateCtx.getState();
    state[activityId + "-locked"] = true;
    state[activityId + "-delivery"] = {
      learnerName:    record.fullName || record.learnerName || "",
      ficha:          record.ficha || "",
      institucion:    record.institucion || "",
      activityNumber: record.activityNumber || "",
      activityTitle:  record.activityTitle || record.activityLabel || "",
      submittedAt:    record.submittedAt || "",
      savedFileName:  record.savedFileName || "",
      driveUrl:       toViewOnlyDriveUrl(record.driveUrl || ""),
      status:         "delivered",
    };
    stateCtx.saveState();
  }

  /**
   * Restaura la confirmación de entrega desde el state (carga inicial de la guía).
   * Oculta el botón de entrega si la actividad ya fue entregada.
   */
  function _restoreDeliveryFromState(activityDef, stateCtx) {
    var state = stateCtx.getState();
    var record = state[activityDef.id + "-delivery"];
    if (!record || record.status !== "delivered") return;

    var panelKey = (activityDef.driveTarget || {}).panelKey || activityDef.id;
    var mountEl = _findOrCreateDeliveryMount(activityDef.id, panelKey);
    if (mountEl) renderDeliveryStatus(record, mountEl);

    // Ocultar botón "Entregar a Drive" si ya fue entregada
    _hideDeliveryButton(activityDef.id, panelKey);
  }

  function _hideDeliveryButton(activityId, panelKey) {
    [activityId, panelKey].forEach(function (key) {
      var group = document.querySelector('[data-act-std-drive="' + key + '"]');
      if (group) {
        var btn = group.querySelector(".btn-drive, .btn-apps-script, button");
        if (btn) btn.style.display = "none";
      }
    });
  }

  /**
   * Instala el listener del evento global "guide-delivery-registered" (disparado por
   * shared_apps_script_delivery.js) para la actividad dada.
   * También restaura la confirmación en la carga inicial si ya existe en el state.
   */
  function _mountDeliveryWatcher(activityDef, stateCtx) {
    var panelKey = (activityDef.driveTarget || {}).panelKey || activityDef.id;

    // Restaurar al cargar la página (ya entregada en sesión anterior)
    _restoreDeliveryFromState(activityDef, stateCtx);

    // Escuchar nuevas entregas en esta sesión
    document.addEventListener("guide-delivery-registered", function (event) {
      var record = event.detail || {};
      // Filtrar solo la actividad correspondiente por panelKey
      if ((record.panelKey || "") !== panelKey) return;

      _persistDeliveryToState(activityDef.id, record, stateCtx);

      var mountEl = _findOrCreateDeliveryMount(activityDef.id, panelKey);
      if (mountEl) renderDeliveryStatus(record, mountEl);

      _hideDeliveryButton(activityDef.id, panelKey);

      // Si la actividad también tiene formulario, aplicar bloqueo de campos
      if (activityDef.type === "both" && activityDef.buttonIds) {
        var btn = document.getElementById(activityDef.buttonIds.save);
        if (btn) { btn.disabled = true; }
      }
    });
  }

  // ── Generación de Word ────────────────────────────────────────────────────

  function _buildInstitutionalHeader(opts) {
    return [
      '<div class="word-logo-line">',
      '  <img src="' + escWord(getSenaLogoUrl()) + '" alt="Logo SENA" width="36" height="36" style="width:36pt;height:36pt;" />',
      "  <strong>Servicio Nacional de Aprendizaje - SENA</strong>",
      "</div>",
      '<table class="institutional-header" width="100%" style="width:100%;border-collapse:collapse;margin:0 0 12pt;">',
      '<tr><td class="label">Programa</td><td>' + escWord(opts.program) + "</td></tr>",
      '<tr><td class="label">Fecha de elaboración</td><td>' + escWord(opts.fecha) + "</td></tr>",
      '<tr><td class="label">Guía</td><td>' + escWord(opts.guideTitle) + "</td></tr>",
      '<tr><td class="label">Actividad</td><td>' + escWord(opts.title) + "</td></tr>",
      '<tr><td class="label">Competencia</td><td>' + escWord(opts.competencia) + "</td></tr>",
      '<tr><td class="label">Resultado de aprendizaje</td><td>' + escWord(opts.resultado) + "</td></tr>",
      '<tr><td class="label">Nombre completo del aprendiz</td><td>' + escWord(opts.learnerName) + "</td></tr>",
      '<tr><td class="label">Número de ficha</td><td>' + escWord(opts.ficha) + "</td></tr>",
      '<tr><td class="label">Grado</td><td>' + escWord(opts.grupo) + "</td></tr>",
      '<tr><td class="label">Institución</td><td>' + escWord(opts.inst) + "</td></tr>",
      "</table>",
    ].join("\n");
  }

  /**
   * Construye el HTML completo del documento Word institucional.
   *
   * opts = {
   *   title, learnerName, ficha, grupo, inst, fecha,
   *   program, competencia, resultado, guideTitle,
   *   sections: [{ label, value }],
   *   contextBox: string (opcional)
   * }
   */
  function buildWordDocument(opts) {
    var sectionsHtml = (opts.sections || []).map(function (s) {
      return [
        '<div class="sec-title">' + escWord(s.label) + "</div>",
        '<div class="sec-body">' + escWord(s.value || "(Sin respuesta)") + "</div>",
      ].join("\n");
    }).join("\n");

    var contextHtml = opts.contextBox
      ? '<div class="case-box"><strong>Contexto:</strong><br>' + escWord(opts.contextBox) + "</div>"
      : "";

    return [
      '<!DOCTYPE html>',
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"',
      '      xmlns:w="urn:schemas-microsoft-com:office:word"',
      '      xmlns="http://www.w3.org/TR/REC-html40">',
      "<head>",
      '<meta charset="utf-8">',
      "<title>" + escHtml(opts.title) + " - " + escHtml(opts.learnerName) + "</title>",
      "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom>",
      "<w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->",
      "<style>",
      "  @page { margin: 2.54cm; }",
      '  body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 2; color: #1a1a1a; }',
      "  .header { text-align: center; border-bottom: 2px solid #007934; padding-bottom: 8pt; margin-bottom: 14pt; }",
      "  .header p { margin: 2pt 0; }",
      "  table { max-width: 100%; table-layout: fixed; overflow-wrap: break-word; word-break: break-word; }",
      "  .word-logo-line { text-align: left; margin: 0 0 8pt; font-size: 10pt; line-height: 1.2; color: #1b5e20; }",
      "  .word-logo-line img { width: 36pt; height: 36pt; vertical-align: middle; margin-right: 8pt; }",
      "  .institutional-header td { border: 1px solid #b7c9bc; padding: 7pt; vertical-align: middle; font-size: 10pt; line-height: 1.35; }",
      "  .institutional-header .label { width: 30%; font-weight: 700; background: #f3f4f6; color: #1b5e20; }",
      "  h1 { text-align: center; color: #007934; font-size: 18pt; margin: 12pt 0 6pt; }",
      "  .case-box { background: #f9fef9; border-left: 4pt solid #39b54a; padding: 10pt 12pt; margin-bottom: 14pt; }",
      "  .sec-title { font-size: 12pt; font-weight: bold; color: #007934; margin: 16pt 0 6pt; }",
      "  .sec-body { border: 1pt solid #dfe7df; background: #fff; padding: 10pt 12pt; line-height: 1.7; min-height: 24pt; }",
      "  .footer { margin-top: 28pt; text-align: center; font-size: 9pt; color: #6b7280; border-top: 1pt solid #e5e7eb; padding-top: 8pt; }",
      "</style>",
      "</head>",
      "<body>",
      '  <div class="header">',
      "    <p><strong>SERVICIO NACIONAL DE APRENDIZAJE - SENA</strong></p>",
      "    <p>" + escWord(opts.program) + "</p>",
      "    <p>" + escWord(opts.guideTitle) + "</p>",
      "  </div>",
      "  <h1>" + escWord(opts.title) + "</h1>",
      "  " + _buildInstitutionalHeader(opts),
      "  " + contextHtml,
      "  " + sectionsHtml,
      '  <div class="footer">Documento generado el ' + escWord(opts.fecha) + " - SENA CIAS Puerto Boyacá.</div>",
      "</body>",
      "</html>",
    ].join("\n");
  }

  function downloadWordDoc(html, fileName) {
    var blob = new Blob(["﻿", html], { type: "application/msword" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Modal compartido para exportar Word ───────────────────────────────────

  var WORD_MODAL_ID = "act-std-word-modal";
  var _wordCtx = null;

  function _ensureWordModal() {
    if (document.getElementById(WORD_MODAL_ID)) return;
    _injectDeliveryStyles();
    var modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.id = WORD_MODAL_ID;
    modal.innerHTML = [
      '<div class="modal-box" style="max-width:460px;padding:28px 28px 24px">',
      '  <h3 id="act-std-word-title" style="margin-top:0">Exportar actividad a Word</h3>',
      '  <label for="act-std-word-nombre" style="display:block;margin-bottom:6px;font-weight:600">',
      "    Nombre completo del aprendiz",
      "  </label>",
      '  <input type="text" id="act-std-word-nombre" placeholder="Nombre y apellidos"',
      '    autocomplete="name" maxlength="120"',
      '    style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:14px">',
      '  <p id="act-std-word-error" style="display:none;color:#c62828;font-size:13px;margin:6px 0 0">',
      "    Ingresa tu nombre completo para continuar.",
      "  </p>",
      '  <p id="act-std-word-ficha-warn" style="display:none;color:#e65100;font-size:13px;margin:6px 0 0">',
      "    No se encontró la ficha activa. Selecciona tu grupo en el portal antes de exportar.",
      "  </p>",
      '  <p id="act-std-word-preview" style="margin:10px 0 0;font-size:12px;color:#555"></p>',
      '  <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end">',
      '    <button class="btn ghost" type="button" id="act-std-word-cancel">Cancelar</button>',
      '    <button class="modal-btn-ok" type="button" id="act-std-word-ok">&#128196; Descargar Word</button>',
      "  </div>",
      "</div>",
    ].join("\n");
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) { if (e.target === modal) _closeWordModal(); });
    document.getElementById("act-std-word-cancel").addEventListener("click", _closeWordModal);
    document.getElementById("act-std-word-nombre").addEventListener("input", _refreshWordPreview);
    document.getElementById("act-std-word-ok").addEventListener("click", _submitWordExport);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") _closeWordModal(); });
  }

  function openWordModal(activityDef, stateCtx) {
    _ensureWordModal();
    _wordCtx = { activityDef: activityDef, stateCtx: stateCtx };

    var selection = stateCtx.getSelection();
    var hasFicha = Boolean(selection.ficha);

    document.getElementById("act-std-word-title").textContent =
      "Exportar Actividad " + activityDef.number + " a Word";
    var input = document.getElementById("act-std-word-nombre");
    input.value = stateCtx.getLearnerName();
    input.classList.remove("error");
    input.style.borderColor = "";
    document.getElementById("act-std-word-error").style.display = "none";
    document.getElementById("act-std-word-ficha-warn").style.display = hasFicha ? "none" : "";
    document.getElementById("act-std-word-ok").disabled = !hasFicha;
    _refreshWordPreview();
    document.getElementById(WORD_MODAL_ID).classList.add("open");
    if (hasFicha) setTimeout(function () { input.focus(); }, 80);
  }

  function _refreshWordPreview() {
    if (!_wordCtx) return;
    var input = document.getElementById("act-std-word-nombre");
    var preview = document.getElementById("act-std-word-preview");
    if (!input || !preview) return;
    var meta = _wordCtx.stateCtx.getGuideMetadata();
    var selection = _wordCtx.stateCtx.getSelection();
    preview.textContent = "Archivo: " + buildFileName({
      guideNumber: meta.guideNumber,
      activityNumber: _wordCtx.activityDef.number,
      shortName: _wordCtx.activityDef.shortName,
      ficha: selection.ficha,
      learnerName: input.value || _wordCtx.stateCtx.getLearnerName(),
    });
  }

  function _closeWordModal() {
    var modal = document.getElementById(WORD_MODAL_ID);
    if (modal) modal.classList.remove("open");
    _wordCtx = null;
  }

  function _submitWordExport() {
    if (!_wordCtx) return;
    var input = document.getElementById("act-std-word-nombre");
    var error = document.getElementById("act-std-word-error");
    var nombre = input.value.trim() || _wordCtx.stateCtx.getLearnerName();
    if (!nombre) {
      input.style.borderColor = "#c62828";
      error.style.display = "";
      input.focus();
      return;
    }
    var selection = _wordCtx.stateCtx.getSelection();
    if (!selection.ficha) return;

    var meta = _wordCtx.stateCtx.getGuideMetadata();
    var actDef = _wordCtx.activityDef;
    var state = _wordCtx.stateCtx.getState();
    var fecha = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

    var sections = (actDef.wordExport && actDef.wordExport.sections || []).map(function (s) {
      return { label: s.label, value: String(state[s.storeKey] || "").trim() || "(Sin respuesta)" };
    });

    var html = buildWordDocument({
      title: "Actividad " + actDef.number + " - " + actDef.label,
      learnerName: nombre,
      ficha: selection.ficha,
      grupo: selection.grupo,
      inst: selection.inst,
      fecha: fecha,
      program: meta.program,
      competencia: meta.competencia,
      resultado: meta.resultado,
      guideTitle: meta.guideTitle,
      sections: sections,
      contextBox: actDef.wordExport && actDef.wordExport.contextBox || "",
    });

    downloadWordDoc(html, buildFileName({
      guideNumber: meta.guideNumber,
      activityNumber: actDef.number,
      shortName: actDef.shortName,
      ficha: selection.ficha,
      learnerName: nombre,
    }));
    _closeWordModal();
  }

  // ── Montaje de actividad de formulario ────────────────────────────────────

  /**
   * Conecta la lógica de guardado, bloqueo y exportación Word al DOM
   * para una actividad de tipo "form" o "both".
   *
   * stateCtx = {
   *   getState:         () => object,
   *   saveState:        () => void,
   *   getLearnerName:   () => string,
   *   getSelection:     () => { ficha, grupo, inst },
   *   getGuideMetadata: () => { guideNumber, guideTitle, program, competencia, resultado },
   *   getGuideDataFile: () => string,
   * }
   *
   * Expone en window:
   *   actStd_save_{id}()
   *   actStd_export_{id}()
   *
   * Devuelve: { applyLock, applyDeadlineGate, save }
   */
  function mountFormActivity(activityDef, stateCtx) {
    var id = activityDef.id;
    var lockKey = id + "-locked";
    var formFields = activityDef.formFields || [];
    var buttonIds = activityDef.buttonIds || {};

    function isLocked() { return Boolean(stateCtx.getState()[lockKey]); }

    function applyLock() {
      var locked = isLocked();
      formFields.forEach(function (key) {
        var el = document.querySelector('[data-store="' + key + '"]');
        if (!el) return;
        el.disabled = locked;
        el.style.opacity = locked ? "0.75" : "";
      });
      var btn = document.getElementById(buttonIds.save);
      if (btn) {
        btn.disabled = locked;
        btn.textContent = locked ? "✅ Respuestas enviadas" : "💾 Guardar respuestas";
      }
      var status = document.getElementById(buttonIds.status);
      if (status) status.style.display = locked ? "block" : "none";
    }

    function applyDeadlineGate() {
      var dm = window.activityDeadlineManager;
      if (!dm || !dm.applyAvailability) return;
      dm.applyAvailability({
        pageFile: stateCtx.getGuideDataFile(),
        activityId: id,
        isLocked: isLocked(),
        fieldSelector: formFields.map(function (k) { return '[data-store="' + k + '"]'; }).join(","),
        buttonId: buttonIds.save,
        statusId: buttonIds.status,
        activeButtonText: "Guardar respuestas",
        lockedButtonText: "Respuestas enviadas",
        closedButtonText: "Entrega cerrada",
        adminMount: { mountSelector: "#" + id + "DeadlineControls" },
        noticeMount: { mountSelector: "#" + id + "DeadlineControls" },
      });
    }

    function save() {
      var dm = window.activityDeadlineManager;
      if (dm && dm.canSubmit && !dm.canSubmit({ pageFile: stateCtx.getGuideDataFile(), activityId: id })) return;
      var empty = formFields.filter(function (k) { return !String(stateCtx.getState()[k] || "").trim(); });
      if (empty.length > 0) {
        alert("Por favor responde todos los campos antes de guardar.");
        return;
      }
      stateCtx.getState()[lockKey] = true;
      stateCtx.saveState();
      applyLock();
      applyDeadlineGate();
    }

    function openExport() { openWordModal(activityDef, stateCtx); }

    window["actStd_save_" + id] = save;
    window["actStd_export_" + id] = openExport;

    applyLock();
    applyDeadlineGate();

    window.addEventListener("activity-deadlines-updated", function () {
      applyLock();
      applyDeadlineGate();
    });

    return { applyLock: applyLock, applyDeadlineGate: applyDeadlineGate, save: save };
  }

  // ── Montaje completo de todas las actividades ─────────────────────────────

  /**
   * Monta todas las actividades declaradas en la config del guide.
   *   - Tipo "form"/"both": conecta botones de guardado y exportación Word.
   *   - Tipo "file"/"both": instala el watcher de confirmación de entrega Drive.
   *   - Todos los tipos: restaura la confirmación de entrega si ya fue entregada.
   *
   * Devuelve: { [activityId]: { applyLock, ... } }
   */
  function mountActivities(stateCtx) {
    var fileName = stateCtx.getGuideDataFile();
    var config = getConfigForGuide(fileName);
    if (!config) return {};

    _injectDeliveryStyles();

    var handles = {};
    config.activities.forEach(function (act) {
      if (act.type === "form" || act.type === "both") {
        handles[act.id] = mountFormActivity(act, stateCtx);
      }
      if (act.type === "file" || act.type === "both") {
        _mountDeliveryWatcher(act, stateCtx);
      }
    });
    return handles;
  }

  // ── Panel de entrega a Drive ───────────────────────────────────────────────

  /**
   * Construye los targets de entrega Drive para las actividades de tipo "file"/"both".
   * Pasar a sharedDriveDelivery.appendDriveDeliveryPanels({ targets: ... }).
   */
  function buildDriveTargets(fileName, opts) {
    var config = getConfigForGuide(fileName);
    if (!config) return [];
    var meta = (opts && opts.getGuideMetadata) ? opts.getGuideMetadata() : config;
    var selection = (opts && opts.getSelection) ? opts.getSelection() : {};
    var learnerName = (opts && opts.getLearnerName) ? opts.getLearnerName() : "";

    return config.activities
      .filter(function (act) { return act.type === "file" || act.type === "both"; })
      .map(function (act) {
        var dt = act.driveTarget || {};
        return {
          activityNumber: act.number,
          panelKey: dt.panelKey || (fileName + "-" + act.id),
          deadlineActivityId: dt.deadlineActivityId || act.id,
          description: dt.description || "Sube a Drive la evidencia de esta actividad.",
          note: dt.note || "",
          activityContext: {
            activityTitle: dt.activityTitle || act.label,
            fileNamePrefix: buildFileName({
              guideNumber: meta.guideNumber,
              activityNumber: act.number,
              shortName: act.shortName,
              ficha: selection.ficha || "",
              learnerName: learnerName,
            }).replace(/\.doc$/, ""),
            learnerNameMode: "full",
          },
        };
      });
  }

  // ── Helpers HTML ──────────────────────────────────────────────────────────

  /**
   * Genera el HTML de los botones estándar para una actividad de formulario.
   * Layout vertical, mismo tamaño en todos los botones.
   *   - 💾 Guardar respuestas   (.btn-save-response, verde)
   *   - 📄 Exportar a Word      (.btn-export-word, azul)
   */
  function renderFormButtons(activityId, opts) {
    opts = opts || {};
    var saveId   = escHtml(opts.saveId   || "btnGuardar_" + activityId);
    var statusId = escHtml(opts.statusId || "status_"    + activityId);
    var actId    = escHtml(activityId);
    return [
      '<div class="act-btn-group">',
      '  <button type="button" id="' + saveId + '" class="btn-save-response"',
      '    onclick="actStd_save_' + actId + '()">',
      "    &#128190; Guardar respuestas",
      "  </button>",
      opts.noWord ? "" : [
        '  <button type="button" class="btn-export-word"',
        '    onclick="actStd_export_' + actId + '()">',
        "    &#128196; Exportar a Word",
        "  </button>",
      ].join("\n"),
      "</div>",
      '<div id="' + statusId + '" class="activity-saved-notice"',
      '  style="display:none;margin-top:8px;color:#1b5e20;font-weight:600">',
      "  &#9989; Respuestas guardadas y enviadas correctamente.",
      "</div>",
      '<div id="' + actId + 'DeadlineControls"></div>',
    ].join("\n");
  }

  /**
   * Genera el HTML del contenedor de entrega a Drive para actividades tipo "file".
   * El botón "📁 Entregar a Drive" es inyectado por sharedDriveDelivery.
   * El div [data-act-std-delivery] recibe la confirmación tras la entrega.
   */
  function renderFileButton(activityId, opts) {
    opts = opts || {};
    return [
      '<div class="drive-action-group" data-act-std-drive="' + escHtml(activityId) + '">',
      opts.description ? '  <p class="drive-delivery-desc">' + escHtml(opts.description) + "</p>" : "",
      opts.note        ? '  <p class="drive-delivery-note">' + escHtml(opts.note)        + "</p>" : "",
      "</div>",
      '<div data-act-std-delivery="' + escHtml(activityId) + '"></div>',
    ].join("\n");
  }

  // ── API pública ───────────────────────────────────────────────────────────

  window.ActivityStandard = Object.freeze({
    // Registro
    registerGuide: registerGuide,
    getConfigForGuide: getConfigForGuide,

    // Para admin_usuarios.js
    getActivitiesForGuide: getActivitiesForGuide,
    getStateKeyForGuide: getStateKeyForGuide,

    // Montaje
    mountFormActivity: mountFormActivity,
    mountActivities: mountActivities,

    // Drive
    buildDriveTargets: buildDriveTargets,

    // Confirmación de entrega
    renderDeliveryStatus: renderDeliveryStatus,
    toViewOnlyDriveUrl: toViewOnlyDriveUrl,

    // Word
    buildWordDocument: buildWordDocument,
    buildFileName: buildFileName,
    downloadWordDoc: downloadWordDoc,
    openWordModal: openWordModal,

    // Helpers HTML
    renderFormButtons: renderFormButtons,
    renderFileButton: renderFileButton,
  });
})();
