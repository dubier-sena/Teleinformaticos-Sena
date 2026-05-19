(function () {
  const SENA_LOGO_DATA_URI =
    "data:image/png;base64,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";

  const WORD_METADATA = {
    default: {
      guideName: "Consulta administrativa de respuestas",
      program: "Sistemas Teleinformáticos",
      competencia:
        "220501121 - Operar herramientas informáticas y digitales de acuerdo con protocolos y manuales técnicos.",
      resultado: "Evidencia administrativa de respuestas registradas por el aprendiz.",
    },
    guia2: {
      guideName: "Guía 2 - Operar herramientas informáticas y digitales",
      program: "Sistemas Teleinformáticos",
      competencia:
        "220501121 - Operar herramientas informáticas y digitales de acuerdo con protocolos y manuales técnicos.",
      resultado: "RAP 01 - Caracterizar herramientas informáticas según el contexto tecnológico de la organización.",
    },
    guia6: {
      guideName: "Guía 6 - Planificar la información",
      program: "Sistemas Teleinformáticos",
      competencia:
        "220501121 - Operar herramientas informáticas y digitales de acuerdo con protocolos y manuales técnicos.",
      resultado:
        "RAP 02 - Implementar componentes de las herramientas tecnológicas según procedimientos de la organización.",
    },
    redes: {
      guideName: "Guía 2 - Redes RAP 01",
      program: "Sistemas Teleinformáticos",
      competencia:
        "280102129 - Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa técnica.",
      resultado:
        "RAP 01 - Definir los parámetros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
    },
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeFileName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 90);
  }

  function getSenaLogoUrl() {
    return SENA_LOGO_DATA_URI;
  }

  function getProjectLink() {
    try {
      return new URL(window.location.href).href;
    } catch {
      return "";
    }
  }

  function getMetadata(title, subtitle) {
    const source = `${title || ""} ${subtitle || ""}`.toLowerCase();
    if (source.includes("redes") || source.includes("santa barbara")) return WORD_METADATA.redes;
    if (source.includes("guia 6") || source.includes("guía 6")) return WORD_METADATA.guia6;
    if (source.includes("guia 2") || source.includes("guía 2") || source.includes("ficha de caso") || source.includes("matriz 3.2.2")) {
      return WORD_METADATA.guia2;
    }
    return WORD_METADATA.default;
  }

  function readMetaField(meta, label) {
    const escapedLabel = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = String(meta || "").match(new RegExp(`${escapedLabel}:\\s*([^|]+)`, "i"));
    return match ? match[1].trim() : "";
  }

  function buildWordStyles() {
    // Hoja base centralizada (A4, márgenes 2.54cm, seguridad de tabla).
    // Si export_styles.js no llegó a cargarse, hacemos fallback a la hoja
    // local original para no romper la exportación.
    var base =
      (window.senaExportStyles && window.senaExportStyles.getBaseStyles && window.senaExportStyles.getBaseStyles()) ||
      `@page { size: A4; margin: 2.54cm; }
       body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; color: #111827; }
       table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }
       th, td { padding: 6pt; vertical-align: top; border: 1px solid #b7c7bc; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }`;

    // Estilos locales del panel admin (sólo overrides cosméticos sobre la
    // base; no redefinen márgenes ni reglas de seguridad de tabla).
    var local = `
      .response-status { border: 1px solid #d1d5db; padding: 10pt; border-radius: 4pt; }
      .answer-card { page-break-inside: avoid; margin: 0 0 14pt; }
    `;

    return base + "\n" + local;
  }

  function buildWordDocument(exportData) {
    const title = exportData?.title || "Respuestas del aprendiz";
    const subtitle = exportData?.subtitle || "";
    const meta = exportData?.meta || "";
    const bodyHtml = exportData?.bodyHtml || "";
    const metadata = getMetadata(title, subtitle);
    const today = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const learnerName = readMetaField(meta, "Aprendiz") || String(subtitle).split("|")[0]?.trim() || "Aprendiz";
    const ficha = readMetaField(meta, "Ficha");
    const grupo = readMetaField(meta, "Grupo");
    const institucion = readMetaField(meta, "Institucion") || readMetaField(meta, "Institución");
    const fechaEntrega = readMetaField(meta, "Fecha de entrega") || readMetaField(meta, "Guardado") || readMetaField(meta, "Fecha") || "—";
    const guideName = readMetaField(meta, "Guia") || readMetaField(meta, "GuÃ­a") || metadata.guideName;
    const fechaElaboracion =
      readMetaField(meta, "Fecha de elaboraci\u00f3n") ||
      readMetaField(meta, "Fecha de " + "elaboracion") ||
      readMetaField(meta, "Fecha de elaboraciÃ³n") ||
      readMetaField(meta, "Primer guardado") ||
      fechaEntrega;
    const activityName = readMetaField(meta, "Actividad") || title;
    const projectLink = exportData?.projectLink || getProjectLink();
    const projectLinkHtml = projectLink
      ? `<a href="${escapeHtml(projectLink)}">${escapeHtml(projectLink)}</a>`
      : "No disponible";

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${buildWordStyles()}</style>
</head>
<body>
  <div class="word-logo-line">
    <img src="${escapeHtml(getSenaLogoUrl())}" alt="Logo SENA" width="36" height="36" style="width:36pt;height:36pt;">
    <strong>Servicio Nacional de Aprendizaje - SENA</strong>
  </div>
  <table class="institutional-header" width="100%" align="left" style="width:100%;margin-left:0;margin-right:0;">
    <tr><td class="label">Programa de formación</td><td>${escapeHtml(metadata.program)}</td></tr>
    <tr><td class="label">Competencia</td><td>${escapeHtml(metadata.competencia)}</td></tr>
    <tr><td class="label">Resultado de aprendizaje</td><td>${escapeHtml(metadata.resultado)}</td></tr>
    <tr><td class="label">Nombre completo del aprendiz</td><td>${escapeHtml(learnerName)}</td></tr>
    <tr><td class="label">Institución educativa</td><td>${escapeHtml(institucion)}</td></tr>
    <tr><td class="label">Número de ficha</td><td>${escapeHtml(ficha)}</td></tr>
    <tr><td class="label">Grado / grupo</td><td>${escapeHtml(grupo)}</td></tr>
    <tr><td class="label">Nombre de la guía</td><td>${escapeHtml(metadata.guideName)}</td></tr>
    <tr><td class="label">Guia seleccionada</td><td>${escapeHtml(guideName)}</td></tr>
    <tr><td class="label">Nombre de la actividad</td><td>${escapeHtml(activityName)}</td></tr>
    <tr><td class="label">Fecha de elaboraci&oacute;n original</td><td>${escapeHtml(fechaElaboracion)}</td></tr>
    <tr><td class="label">Fecha de entrega</td><td>${escapeHtml(fechaEntrega)}</td></tr>
    <tr><td class="label">Fecha de elaboración del documento</td><td>${escapeHtml(today)}</td></tr>
    <tr><td class="label">Fecha de exportaci&oacute;n del soporte</td><td>${escapeHtml(today)}</td></tr>
  </table>
  <h1>${escapeHtml(title)}</h1>
  <p><strong>${escapeHtml(subtitle)}</strong></p>
  ${bodyHtml}
  <h2>Observaciones</h2>
  <table class="institutional-header" width="100%" style="width:100%;margin-top:0;">
    <tr><td style="height:80pt;vertical-align:top;"> </td></tr>
  </table>
  <div class="word-footer">
    Este soporte se genera para seguimiento formativo institucional. La exportaci&oacute;n no modifica respuestas, entregas ni fechas registradas.
    <br>
    <strong>Enlace del proyecto:</strong> ${projectLinkHtml}
  </div>
</body>
</html>`;
  }

  function downloadWord(exportData, options) {
    if (!exportData?.bodyHtml) {
      return false;
    }
    const html = buildWordDocument(exportData);
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const safeLearner = sanitizeFileName(options?.learnerName || readMetaField(exportData.meta, "Aprendiz") || "Aprendiz");
    const safeTitle = sanitizeFileName(options?.title || exportData.title || "Respuestas");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}_${safeLearner}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  window.adminExport = Object.freeze({
    buildWordDocument,
    downloadWord,
    readMetaField,
    sanitizeFileName,
  });
})();
