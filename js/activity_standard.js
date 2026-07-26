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
      if (Array.isArray(act.legacyLockKeys) && act.legacyLockKeys.length) {
        keys = keys.concat(act.legacyLockKeys);
      }
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

  // Limpia etiquetas HTML que pudieran venir dentro del valor guardado (por
  // datos viejos de un serializador previo o por texto pegado). Convierte
  // estructura de tabla/parrafo a texto plano legible:
  //   <br>, </tr>, </p>, </li>  -> salto de linea
  //   </td>, </th>              -> separador
  //   resto de etiquetas        -> se eliminan
  // Si el valor no tiene '<' ni '&', se devuelve tal cual (rapido).
  function cleanAnswerHtml(v) {
    var s = String(v == null ? "" : v);
    if (s.indexOf("<") === -1 && s.indexOf("&") === -1) return s;
    // Decodificar entidades comunes primero (por si vienen escapadas).
    s = s
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&amp;/gi, "&");
    // Estructura -> texto plano.
    s = s
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*tr\s*>/gi, "\n")
      .replace(/<\s*\/\s*(td|th)\s*>/gi, "  ")
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
      .replace(/<\/?[a-z!][^>]*>/gi, "");
    // Normalizar espacios y saltos sobrantes.
    s = s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }

  function escWord(v) {
    // Orden correcto: limpiar HTML del valor -> escapar -> saltos a <br> reales.
    return escHtml(cleanAnswerHtml(v)).replace(/\n/g, "<br>");
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
   * Genera el nombre estándar OBLIGATORIO para cualquier archivo de evidencia:
   *   Guia_{NumeroGuia}_Actividad_{NumeroActividad}_{NombreBreveActividad}_{NumeroFicha}_{NombreAprendiz}.{ext}
   *
   * Es la única función autorizada para construir nombres de entrega/exportación.
   * Conserva la extensión original cuando se proporciona vía `ext` o `originalFileName`.
   * Reemplaza tildes/espacios y caracteres especiales sin perder información útil.
   */
  function generateEvidenceFileName(opts) {
    opts = opts || {};
    var ext = String(opts.ext || "").trim();
    if (!ext && opts.originalFileName) {
      var m = String(opts.originalFileName).match(/(\.[a-zA-Z0-9]+)$/);
      if (m) ext = m[1];
    }
    if (!ext) ext = ".doc";
    if (ext.charAt(0) !== ".") ext = "." + ext;
    ext = ext.toLowerCase();

    var guiaNumero = sanitizeSegment(String(opts.guiaNumero != null ? opts.guiaNumero : opts.guideNumber || ""));
    var actividadNumero = sanitizeSegment(
      String(opts.actividadNumero != null ? opts.actividadNumero : opts.activityNumber || "").replace(/\./g, "")
    );
    var nombreBreve = sanitizeSegment(opts.actividadTitulo || opts.shortName) || "Actividad";
    var ficha = sanitizeSegment(opts.ficha) || "SinFicha";
    var aprendiz = sanitizeSegment(opts.nombreAprendiz || opts.learnerName) || "Aprendiz";

    return [
      "Guia_" + (guiaNumero || "X"),
      "Actividad_" + (actividadNumero || "X"),
      nombreBreve,
      ficha,
      aprendiz,
    ].join("_") + ext;
  }

  // Wrapper de compatibilidad. Acepta tanto el contrato viejo
  //   { guideNumber, activityNumber, shortName, ficha, learnerName, ext }
  // como el nuevo. Toda llamada produce el formato estándar nuevo.
  function buildFileName(opts) {
    return generateEvidenceFileName(opts);
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
    // Entrega registrada por el instructor (sin archivo real, ver
    // adminMarkActivityDelivered en firebase_db.js): no hay savedFileName NI
    // driveUrl. Mostrar "Archivo: —" / "Enlace no disponible" en ese caso
    // confundia al aprendiz (parecia una entrega rota). Se omiten esas lineas
    // y se explica que fue el instructor quien la registro asi.
    var hasFile = Boolean(record.savedFileName || record.driveUrl);
    var reopened = record.status === "reabierta" || record.estado === "reabierta" || record.reabierta === true;
    var title = reopened
      ? "Actividad reabierta por el instructor."
      : hasFile
        ? "Actividad entregada correctamente."
        : "Actividad registrada como entregada.";
    var stateLabel = reopened ? "Reabierta" : "Entregada";

    var linkHtml = viewUrl
      ? '<a href="' + escHtml(viewUrl) + '" target="_blank" rel="noopener noreferrer"' +
        ' class="act-std-delivery-link">Ver archivo entregado ↗</a>'
      : "(Enlace no disponible)";

    var fileLinesHtml = hasFile
      ? '    <li><strong>Archivo entregado:</strong> ' + escHtml(fileName) + '</li>\n' +
        '    <li><strong>Enlace del archivo:</strong> ' + linkHtml + '</li>\n'
      : "";

    var noticeHtml = reopened
      ? '<p class="act-std-delivery-notice">' +
        'La entrega anterior se conserva. Puedes continuar editando y realizar una nueva entrega si corresponde.' +
        '</p>'
      : hasFile
        ? '<p class="act-std-delivery-notice">' +
          'Esta actividad ya fue entregada el ' + escHtml(fecha) + ' a las ' + escHtml(hora) + '. ' +
          'Puede consultar el archivo entregado en el enlace de arriba. ' +
          'Para modificar o reemplazar la entrega, debe solicitar al instructor o administrador ' +
          'que habilite nuevamente la actividad.' +
          '</p>'
        : '<p class="act-std-delivery-notice">' +
          'Esta actividad fue registrada como entregada por el instructor el ' + escHtml(fecha) +
          ', segun la fecha indicada. No hay un archivo asociado en el portal para esta actividad.' +
          '</p>';

    mountEl.innerHTML = [
      '<div class="act-std-delivery-panel">',
      '  <p class="act-std-delivery-title">&#9989; ' + escHtml(title) + '</p>',
      '  <ul>',
      '    <li><strong>Estado:</strong> ' + escHtml(stateLabel) + '</li>',
      '    <li><strong>Fecha de entrega:</strong> ' + escHtml(fecha) + '</li>',
      '    <li><strong>Hora de entrega:</strong> ' + escHtml(hora) + '</li>',
      fileLinesHtml.replace(/\n$/, ""),
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
    var previous = state[activityId + "-delivery"];
    var previousRecord = previous && typeof previous === "object" ? previous : {};
    var history = Array.isArray(previousRecord.historialEntregas)
      ? previousRecord.historialEntregas.slice()
      : [];
    var previousFingerprint = [
      previousRecord.submittedAt || "",
      previousRecord.savedFileName || "",
      previousRecord.driveUrl || "",
    ].join("|");
    if (previousFingerprint.replace(/\|/g, "")) {
      var exists = history.some(function (item) {
        return [
          item && item.submittedAt || "",
          item && item.savedFileName || "",
          item && item.driveUrl || "",
        ].join("|") === previousFingerprint;
      });
      if (!exists) history.push(previousRecord);
    }
    var guideMeta = (stateCtx.getGuideMetadata && stateCtx.getGuideMetadata()) || {};
    var savedName = record.savedFileName || "";
    var standardName = generateEvidenceFileName({
      guiaNumero: guideMeta.guideNumber,
      actividadNumero: record.activityNumber,
      actividadTitulo: record.shortName || record.activityTitle || record.activityLabel,
      ficha: record.ficha,
      nombreAprendiz: record.fullName || record.learnerName,
      originalFileName: savedName || record.originalFileName || "",
    });
    state[activityId + "-locked"] = true;
    state[activityId + "-delivery"] = {
      learnerName:    record.fullName || record.learnerName || "",
      ficha:          record.ficha || "",
      institucion:    record.institucion || "",
      activityNumber: record.activityNumber || "",
      activityTitle:  record.activityTitle || record.activityLabel || "",
      guiaNumero:     guideMeta.guideNumber || "",
      actividadNumero: record.activityNumber || "",
      actividadTitulo: record.activityTitle || record.activityLabel || "",
      nombreAprendiz: record.fullName || record.learnerName || "",
      nombreArchivoOriginal: record.originalFileName || savedName || "",
      nombreArchivoEstandar: standardName,
      submittedAt:    record.submittedAt || "",
      fechaEntrega:   record.submittedAt || "",
      savedFileName:  savedName,
      driveUrl:       toViewOnlyDriveUrl(record.driveUrl || ""),
      enlaceDrive:    toViewOnlyDriveUrl(record.driveUrl || ""),
      backupDriveUrl: toViewOnlyDriveUrl(record.backupDriveUrl || ""),
      respaldoDriveUrl: toViewOnlyDriveUrl(record.backupDriveUrl || ""),
      backupFolderPath: record.backupFolderPath || "",
      backupError:    record.backupError || "",
      status:         "delivered",
      estado:         "entregada",
      fechaEntregaOriginal: previousRecord.fechaEntregaOriginal || previousRecord.submittedAt || record.submittedAt || "",
      historialEntregas: history,
      historialReaperturas: Array.isArray(previousRecord.historialReaperturas)
        ? previousRecord.historialReaperturas
        : [],
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
    if (!record || (record.status !== "delivered" && record.status !== "reabierta" && record.estado !== "reabierta")) return;

    var panelKey = (activityDef.driveTarget || {}).panelKey || activityDef.id;
    var mountEl = _findOrCreateDeliveryMount(activityDef.id, panelKey);
    if (mountEl) renderDeliveryStatus(record, mountEl);

    if (record.status !== "reabierta" && record.estado !== "reabierta" && record.reabierta !== true) {
      // Ocultar boton "Entregar a Drive" si ya fue entregada y no esta reabierta.
      _hideDeliveryButton(activityDef.id, panelKey);
    }
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

    // Si el admin aprueba la actividad DESPUES de este montaje inicial (banco de
    // respuestas, sin que el aprendiz suba nada) via reflectGradesIntoGuideState,
    // el "-delivery" sintetico llega tarde: el panel de confirmacion quedaba
    // vacio hasta el proximo recargo de pagina. reflectGradesIntoGuideState ya
    // dispara "activity-deadlines-updated" (lo escucha mountFormActivity para
    // re-bloquear campos) -- se reusa el mismo evento aqui para reintentar la
    // restauracion de la confirmacion de entrega. Detectado 2026-07-26 en QA de
    // Taller Integrador SB 10B.
    window.addEventListener("activity-deadlines-updated", function () {
      _restoreDeliveryFromState(activityDef, stateCtx);
    });

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
      // Filas extra opcionales (p. ej. el Plan de Mejoramiento añade Motivo + fechas).
      (Array.isArray(opts.extraHeaderRows) ? opts.extraHeaderRows.map(function (r) {
        return '<tr><td class="label">' + escWord(r.label) + "</td><td>" + escWord(r.value) + "</td></tr>";
      }).join("") : ""),
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
      // Hoja base centralizada (export_styles.js): A4, márgenes 2.54cm,
      // tipografía Times 12pt y seguridad de tabla. Fallback inline si el
      // helper no está cargado, para no romper la exportación.
      (window.senaExportStyles && window.senaExportStyles.getBaseStyles && window.senaExportStyles.getBaseStyles()) ||
        '@page { size: A4; margin: 2.54cm; } body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #1a1a1a; } table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; overflow-wrap: anywhere; word-break: break-word; } th, td { padding: 6pt; vertical-align: top; border: 1px solid #b7c9bc; overflow-wrap: anywhere; word-break: break-word; } .institutional-header td { border: 1px solid #b7c9bc; padding: 7pt; vertical-align: top; font-size: 10pt; line-height: 1.35; } .institutional-header .label { width: 30%; font-weight: 700; background: #f3f4f6; color: #1b5e20; } .word-logo-line { margin: 0 0 8pt; font-size: 10pt; color: #1b5e20; } .word-logo-line img { width: 36pt; height: 36pt; vertical-align: middle; margin-right: 8pt; }',
      // Overrides locales del documento de actividad (solo cosméticos).
      "  .header { text-align: center; border-bottom: 2px solid #1b5e20; padding-bottom: 8pt; margin-bottom: 14pt; }",
      "  .header p { margin: 2pt 0; }",
      "  h1 { text-align: center; }",
      "  .case-box { background: #f9fef9; border-left: 4pt solid #39b54a; padding: 10pt 12pt; margin-bottom: 14pt; }",
      "  .sec-title { font-size: 12pt; font-weight: bold; color: #1b5e20; margin: 16pt 0 6pt; }",
      "  .sec-body { border: 1pt solid #dfe7df; background: #fff; padding: 10pt 12pt; line-height: 1.7; min-height: 24pt; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }",
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

  // ── Generación de .docx REAL (Office Open XML) ─────────────────────────────
  // El HTML-como-.doc anterior NO abre en teléfonos ("documento dañado"). Esto
  // arma un .docx válido (ZIP almacenado + OOXML), sin librerías externas, que
  // abre en Word de escritorio y en las apps de Office/Docs/WPS de Android/iOS.
  var _crcTable = null;
  function _crc32(bytes) {
    if (!_crcTable) {
      _crcTable = [];
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        _crcTable[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ _crcTable[(crc ^ bytes[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function _u16(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]); }
  function _u32(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]); }
  function _concat(parts) {
    var len = 0, i;
    for (i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len), off = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], off); off += parts[i].length; }
    return out;
  }
  // Logo SENA embebido (PNG base64) para el encabezado del .docx. Sincrono y
  // sirve offline (no usa fetch). Si el decode falla, _logoImage() devuelve null
  // y el .docx se arma con el encabezado de texto (comportamiento previo, seguro).
  var SENA_LOGO_PNG_B64 = "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";
  var SENA_LOGO_W = 243, SENA_LOGO_H = 230;
  function _b64ToBytes(b64) {
    try {
      if (typeof atob !== "function") return null;
      var bin = atob(b64);
      var n = bin.length, a = new Uint8Array(n);
      for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
      return a;
    } catch (e) { return null; }
  }
  function _logoImage() {
    if (!SENA_LOGO_PNG_B64 || SENA_LOGO_PNG_B64.charAt(0) === "_") return null;
    var bytes = _b64ToBytes(SENA_LOGO_PNG_B64);
    return bytes && bytes.length ? { bytes: bytes, ext: "png", ct: "image/png" } : null;
  }
  function _logoDrawingPara() {
    var cy = 1005840; // ~1.1 in de alto
    var cx = Math.round((cy * SENA_LOGO_W) / SENA_LOGO_H);
    return '<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr><w:r><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
      '<wp:docPr id="1" name="LogoSENA"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="1" name="LogoSENA"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }
  function _zipStore(files) {
    var enc = new TextEncoder();
    var chunks = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nameBytes = enc.encode(f.name);
      var data = f.bytes;
      var crc = _crc32(data);
      var size = data.length;
      var local = _concat([
        _u32(0x04034b50), _u16(20), _u16(0), _u16(0), _u16(0), _u16(0),
        _u32(crc), _u32(size), _u32(size), _u16(nameBytes.length), _u16(0), nameBytes,
      ]);
      chunks.push(local, data);
      central.push(_concat([
        _u32(0x02014b50), _u16(20), _u16(20), _u16(0), _u16(0), _u16(0), _u16(0),
        _u32(crc), _u32(size), _u32(size), _u16(nameBytes.length), _u16(0), _u16(0),
        _u16(0), _u16(0), _u32(0), _u32(offset), nameBytes,
      ]));
      offset += local.length + data.length;
    });
    var centralBytes = _concat(central);
    var eocd = _concat([
      _u32(0x06054b50), _u16(0), _u16(0), _u16(files.length), _u16(files.length),
      _u32(centralBytes.length), _u32(offset), _u16(0),
    ]);
    chunks.push(centralBytes, eocd);
    return new Blob(chunks, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  function _xe(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function _runs(text, rpr) {
    var lines = String(text == null ? "" : text).split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      if (i > 0) out.push("<w:r>" + rpr + "<w:br/></w:r>");
      out.push("<w:r>" + rpr + '<w:t xml:space="preserve">' + _xe(lines[i]) + "</w:t></w:r>");
    }
    return out.join("");
  }
  function _rpr(o) {
    o = o || {};
    var s = "";
    if (o.bold) s += "<w:b/>";
    if (o.color) s += '<w:color w:val="' + o.color + '"/>';
    if (o.sz) s += '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>';
    return s ? "<w:rPr>" + s + "</w:rPr>" : "";
  }
  function _para(text, o) {
    o = o || {};
    var inner = "";
    if (o.center) inner += '<w:jc w:val="center"/>';
    if (o.spacing) inner += '<w:spacing w:before="' + (o.spacing.before || 0) + '" w:after="' + (o.spacing.after || 0) + '"/>';
    var ppr = inner ? "<w:pPr>" + inner + "</w:pPr>" : "";
    return "<w:p>" + ppr + _runs(text, _rpr(o)) + "</w:p>";
  }
  var _TBL_BORDERS = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="B7C9BC"/><w:left w:val="single" w:sz="4" w:color="B7C9BC"/><w:bottom w:val="single" w:sz="4" w:color="B7C9BC"/><w:right w:val="single" w:sz="4" w:color="B7C9BC"/><w:insideH w:val="single" w:sz="4" w:color="B7C9BC"/><w:insideV w:val="single" w:sz="4" w:color="B7C9BC"/></w:tblBorders>';
  function _row(label, value) {
    return "<w:tr>" +
      '<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:tcPr>' + _para(label, { bold: true, color: "1B5E20" }) + "</w:tc>" +
      '<w:tc><w:tcPr><w:tcW w:w="6500" w:type="dxa"/></w:tcPr>' + _para(value) + "</w:tc>" +
      "</w:tr>";
  }
  function _headerTable(rows) {
    return '<w:tbl><w:tblPr><w:tblW w:w="9500" w:type="dxa"/>' + _TBL_BORDERS + '<w:tblLayout w:type="fixed"/></w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6500"/></w:tblGrid>' +
      rows.map(function (r) { return _row(r[0], r[1]); }).join("") + "</w:tbl>";
  }
  function buildDocxBlob(opts) {
    opts = opts || {};
    var body = [];
    body.push(_para("SERVICIO NACIONAL DE APRENDIZAJE - SENA", { bold: true, center: true, color: "1B5E20", sz: 24 }));
    if (opts.program) body.push(_para(opts.program, { center: true }));
    if (opts.guideTitle) body.push(_para(opts.guideTitle, { center: true }));
    body.push(_para(opts.title || "", { bold: true, center: true, sz: 32, spacing: { before: 120, after: 120 } }));
    body.push(_headerTable([
      ["Programa", opts.program || ""],
      ["Fecha de elaboración", opts.fecha || ""],
      ["Guía", opts.guideTitle || ""],
      ["Actividad", opts.title || ""],
      ["Competencia", opts.competencia || ""],
      ["Resultado de aprendizaje", opts.resultado || ""],
      ["Nombre completo del aprendiz", opts.learnerName || ""],
      ["Número de ficha", opts.ficha || ""],
      ["Grado", opts.grupo || ""],
      ["Institución", opts.inst || ""],
    ]));
    body.push(_para(""));
    if (opts.contextBox) {
      body.push(_para("Contexto:", { bold: true, color: "1B5E20" }));
      body.push(_para(opts.contextBox));
    }
    (opts.sections || []).forEach(function (s) {
      body.push(_para(s.label || "", { bold: true, color: "1B5E20", spacing: { before: 160, after: 40 } }));
      body.push(_para((s.value == null || s.value === "") ? "(Sin respuesta)" : s.value));
    });
    body.push(_para("Documento generado el " + (opts.fecha || "") + " - SENA CIAS Puerto Boyacá.", { center: true, color: "6B7280", sz: 18, spacing: { before: 240 } }));

    var _logo = _logoImage();
    if (_logo) body.unshift(_logoDrawingPara());
    return _packDocx(body, _logo);
  }

  // Empaqueta un arreglo de párrafos/tablas OOXML en un .docx (ZIP store-only).
  // Si `image` viene ({bytes, ext, ct}), se incrusta como word/media/image1.<ext>
  // y se referencia con rId "rIdLogo" (el dibujo lo agrega quien llama).
  function _packDocx(body, image) {
    var sectPr = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>' +
      body.join("") + sectPr + "</w:body></w:document>";
    var ctImage = image ? '<Default Extension="' + image.ext + '" ContentType="' + image.ct + '"/>' : "";
    var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      ctImage +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    var enc = new TextEncoder();
    var files = [
      { name: "[Content_Types].xml", bytes: enc.encode(contentTypes) },
      { name: "_rels/.rels", bytes: enc.encode(rels) },
      { name: "word/document.xml", bytes: enc.encode(documentXml) },
    ];
    if (image) {
      var docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.' + image.ext + '"/></Relationships>';
      files.push({ name: "word/_rels/document.xml.rels", bytes: enc.encode(docRels) });
      files.push({ name: "word/media/image1." + image.ext, bytes: image.bytes });
    }
    return _zipStore(files);
  }

  // Convierte HTML (cuerpo de respuestas del admin) en párrafos OOXML.
  function _htmlToParagraphs(html) {
    var paras = [];
    var doc = null;
    try {
      if (typeof DOMParser !== "undefined") {
        doc = new DOMParser().parseFromString("<body><div>" + String(html || "") + "</div></body>", "text/html");
      }
    } catch (e) { doc = null; }
    if (!doc || !doc.body) {
      var plain = String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) paras.push(_para(plain));
      return paras;
    }
    var BLOCK = { P: 1, DIV: 1, LI: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, BLOCKQUOTE: 1, SECTION: 1, ARTICLE: 1, HEADER: 1, FOOTER: 1 };
    function textOf(el) { return (el.textContent || "").replace(/\s+/g, " ").trim(); }
    function blockText(el) {
      var h = (el.innerHTML || "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
        .replace(/<[^>]+>/g, "");
      h = h.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      return h.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n")
        .replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    }
    function walk(node) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue;
        var tag = c.tagName;
        if (tag === "TABLE") {
          var trs = c.querySelectorAll("tr");
          for (var r = 0; r < trs.length; r++) {
            var cells = [], tcs = trs[r].children;
            for (var x = 0; x < tcs.length; x++) { var tt = textOf(tcs[x]); if (tt) cells.push(tt); }
            if (cells.length) paras.push(_para(cells.join(":  ")));
          }
          continue;
        }
        if (BLOCK[tag]) {
          var hasBlockChild = false;
          for (var k = c.firstChild; k; k = k.nextSibling) {
            if (k.nodeType === 1 && (BLOCK[k.tagName] || k.tagName === "TABLE")) { hasBlockChild = true; break; }
          }
          if (hasBlockChild) { walk(c); }
          else {
            var t = blockText(c);
            if (t) paras.push(_para(t, /^H[1-6]$/.test(tag) ? { bold: true, color: "1B5E20" } : {}));
          }
        } else {
          walk(c);
        }
      }
    }
    walk(doc.body);
    if (!paras.length) { var t2 = textOf(doc.body); if (t2) paras.push(_para(t2)); }
    return paras;
  }

  // .docx genérico desde { title, subtitle, headerRows:[[label,value]], bodyHtml, footerLines:[] }
  function buildDocxFromContent(model) {
    model = model || {};
    var body = [];
    body.push(_para("SERVICIO NACIONAL DE APRENDIZAJE - SENA", { bold: true, center: true, color: "1B5E20", sz: 24 }));
    body.push(_para(model.title || "", { bold: true, center: true, sz: 30, spacing: { before: 120, after: 60 } }));
    if (model.subtitle) body.push(_para(model.subtitle, { center: true, color: "374151" }));
    if (model.headerRows && model.headerRows.length) { body.push(_headerTable(model.headerRows)); body.push(_para("")); }
    var bodyParas = _htmlToParagraphs(model.bodyHtml || "");
    for (var i = 0; i < bodyParas.length; i++) body.push(bodyParas[i]);
    (model.footerLines || []).forEach(function (line) {
      body.push(_para(line, { center: true, color: "6B7280", sz: 18, spacing: { before: 120 } }));
    });
    var _logo = _logoImage();
    if (_logo) body.unshift(_logoDrawingPara());
    return _packDocx(body, _logo);
  }
  function downloadBlob(blob, fileName) {
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

    var exportOpts = {
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
    };
    var fileBase = buildFileName({
      guideNumber: meta.guideNumber,
      activityNumber: actDef.number,
      shortName: actDef.shortName,
      ficha: selection.ficha,
      learnerName: nombre,
    }).replace(/\.docx?$/i, "");

    // .docx real (abre en teléfonos); fallback a HTML-doc en navegadores muy viejos.
    if (typeof TextEncoder !== "undefined" && typeof Uint8Array !== "undefined") {
      downloadBlob(buildDocxBlob(exportOpts), fileBase + ".docx");
    } else {
      downloadWordDoc(buildWordDocument(exportOpts), fileBase + ".doc");
    }
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
        window.portalAlert("Por favor responde todos los campos antes de guardar.", { type: "warning" });
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
    _mountAvancePanel(stateCtx);
    return handles;
  }

  // ── Panel "Tu control de avance" (compartido por todas las guias) ─────────
  // Se monta automaticamente si la guia tiene un <div data-act-std-avance>.
  // Refleja TODO lo entregado/guardado hasta hoy: combina el registro local de
  // entregas (sharedAppsScriptDelivery) con el estado sincronizado de la guia
  // (state["{actId}-delivery"] / "-locked"), que viaja por Firebase/Drive, para
  // que el avance aparezca aunque la entrega se haya hecho en otro dispositivo.

  function _escapeAvance(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getActivityDeliveryInfo(act, state) {
    var fromState = state ? state[act.id + "-delivery"] : null;
    if (fromState && fromState.status === "delivered") {
      return { kind: "delivered", when: fromState.submittedAt || "" };
    }
    if (act.driveTarget && act.driveTarget.panelKey && window.sharedAppsScriptDelivery?.loadDeliveryRecord) {
      var record = window.sharedAppsScriptDelivery.loadDeliveryRecord({ panelKey: act.driveTarget.panelKey });
      if (record && record.status === "delivered") {
        return { kind: "delivered", when: record.submittedAt || record.fechaEntrega || "" };
      }
    }
    if (state && (act.type === "form" || act.type === "both") && _anyLockKeySet(state, act)) {
      return { kind: "saved", when: "" };
    }
    // Guias que NO usan el bloqueo por actividad (campos libres generados en
    // runtime, p.ej. Induccion / Guia 5): se considera "Guardada" si el
    // formulario tiene contenido. La guia declara como detectarlo con
    // act.formFields (llaves exactas) o act.fieldPrefixes (prefijos data-store).
    if (state && (act.type === "form" || act.type === "both")) {
      if (_anyFormFieldFilled(state, act.formFields) || _anyPrefixFilled(state, act.fieldPrefixes)) {
        return { kind: "saved", when: "" };
      }
    }
    return { kind: "pending", when: "" };
  }

  // Ademas de la llave canonica {actId}-locked, una actividad puede declarar
  // llaves de bloqueo legacy (act.legacyLockKeys) que su guia escribia antes de
  // entrar al catalogo (ej. transferReto341 -> "transfer-reto-locked" en Guia 2).
  function _anyLockKeySet(state, act) {
    if (state[act.id + "-locked"] === true) return true;
    var legacy = Array.isArray(act.legacyLockKeys) ? act.legacyLockKeys : [];
    return legacy.some(function (key) { return state[key] === true; });
  }

  function _hasContent(value) {
    if (value == null) return false;
    if (typeof value === "boolean") return value === true;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== "";
  }

  function _anyFormFieldFilled(state, formFields) {
    if (!Array.isArray(formFields) || !formFields.length) return false;
    return formFields.some(function (key) { return _hasContent(state[key]); });
  }

  function _anyPrefixFilled(state, prefixes) {
    if (!Array.isArray(prefixes) || !prefixes.length) return false;
    return Object.keys(state).some(function (key) {
      return prefixes.some(function (p) { return key.indexOf(p) === 0; }) && _hasContent(state[key]);
    });
  }

  // Nota real del instructor (A/D), leida del cache local que ya llena
  // activityGradesManager (activity_grades.js) al cargar la guia -- sincrona,
  // no depende de esperar una llamada a Firestore aqui.
  function _getStudentGradeForActivity(pageFile, activityId) {
    var mgr = window.activityGradesManager;
    if (!mgr || !mgr.GUIDE_FAMILY_BY_FILE || !mgr.getStudentGrades) return null;
    var family = mgr.GUIDE_FAMILY_BY_FILE[String(pageFile || "")];
    if (!family) return null;
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || !session.usernameKey) return null;
    var grades = mgr.getStudentGrades(session.usernameKey, family) || {};
    var grade = grades[activityId];
    if (grade === "A" || grade === "D") return grade;
    // Puede ser un alias: comparte columna de nota con otra actividad "dueña"
    // (ej. relaciona311 se califica junto con sopaletras311 -- ver aliasIds
    // en GRADE_CATALOG). Se busca la actividad dueña y se usa SU nota.
    var catalogEntry = mgr.GRADE_CATALOG && mgr.GRADE_CATALOG[family];
    var ownerAct = catalogEntry && Array.isArray(catalogEntry.activities)
      ? catalogEntry.activities.filter(function (a) {
          return Array.isArray(a.aliasIds) && a.aliasIds.indexOf(activityId) !== -1;
        })[0]
      : null;
    var ownerGrade = ownerAct ? grades[ownerAct.id] : null;
    return ownerGrade === "A" || ownerGrade === "D" ? ownerGrade : null;
  }

  function renderAvancePanel(stateCtx) {
    var container = document.querySelector("[data-act-std-avance]");
    if (!container) return;
    var pageFile = stateCtx.getGuideDataFile();
    var config = getConfigForGuide(pageFile);
    var activities = (config && config.activities) || [];
    if (!activities.length) {
      container.innerHTML = '<p class="intro-text">El control de avance se activa cuando cargan las actividades.</p>';
      return;
    }

    var state = null;
    try { state = stateCtx.getState ? stateCtx.getState() : null; } catch (_) {}

    var done = 0;
    var rows = activities.map(function (act) {
      var info = getActivityDeliveryInfo(act, state);
      if (info.kind !== "pending") done += 1;
      var fecha = "";
      if (info.when) {
        try {
          fecha = new Date(info.when).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
        } catch (_) {}
      }
      var titulo = (act.number ? act.number + " - " : "") +
        ((act.driveTarget && act.driveTarget.activityTitle) || act.label || "Actividad");
      var grade = _getStudentGradeForActivity(pageFile, act.id);
      var estado, cls;
      if (grade === "A") {
        estado = "&#9989; Aprobada";
        cls = "estado--ok";
      } else if (grade === "D") {
        estado = "&#10060; Reprobada";
        cls = "estado--mal";
      } else if (info.kind === "delivered") {
        estado = "&#9989; Entregada" + (fecha ? " &middot; " + fecha : "");
        cls = "estado--ok";
      } else if (info.kind === "saved") {
        estado = "&#128190; Guardada";
        cls = "estado--ok";
      } else {
        estado = "&#9711; Pendiente";
        cls = "estado--pend";
      }
      return "<tr><td>" + _escapeAvance(titulo) + '</td><td class="' + cls + '">' + estado + "</td></tr>";
    });

    var pct = Math.round((done / activities.length) * 100);
    container.innerHTML =
      '<div class="avance-resumen"><strong>Tus actividades de esta gu&iacute;a</strong>' +
      '<span class="avance-chip">' + done + " / " + activities.length + " &middot; " + pct + "%</span></div>" +
      '<table class="avance-table"><thead><tr><th>Actividad</th><th>Estado</th></tr></thead><tbody>' +
      rows.join("") + "</tbody></table>";
  }

  function _mountAvancePanel(stateCtx) {
    renderAvancePanel(stateCtx);
    document.addEventListener("guide-delivery-registered", function () {
      window.requestAnimationFrame(function () { renderAvancePanel(stateCtx); });
    });
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
    renderAvancePanel: renderAvancePanel,
    getActivityDeliveryInfo: getActivityDeliveryInfo,
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
    buildDocxBlob: buildDocxBlob,
    buildDocxFromContent: buildDocxFromContent,
    buildFileName: buildFileName,
    generateEvidenceFileName: generateEvidenceFileName,
    downloadWordDoc: downloadWordDoc,
    openWordModal: openWordModal,

    // Helpers HTML
    renderFormButtons: renderFormButtons,
    renderFileButton: renderFileButton,
  });
})();
