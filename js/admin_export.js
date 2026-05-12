(function () {
  const WORD_METADATA = {
    default: {
      guideName: "Consulta administrativa de respuestas",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado: "Evidencia administrativa de respuestas registradas por el aprendiz.",
    },
    guia2: {
      guideName: "Guia 2 - Operar Herramientas Informaticas y Digitales",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado: "RAP 01 - Caracterizar herramientas informaticas segun el contexto tecnologico de la organizacion.",
    },
    guia6: {
      guideName: "Guia 6 - Planificar la informacion",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado:
        "RAP 02 - Implementar componentes de las herramientas tecnologicas segun procedimientos de la organizacion.",
    },
    redes: {
      guideName: "Guia 2 - Redes RAP01",
      program: "Sistemas Teleinformaticos",
      competencia:
        "280102129 - Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa tecnica.",
      resultado:
        "RAP 01 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
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
    try {
      return new URL("assets/img/sena-logo.png", window.location.href).href;
    } catch {
      return "assets/img/sena-logo.png";
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
    return `
      @page { size: 8.5in 11in; margin: 2.54cm; }
      body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; color: #111827; }
      .word-logo-line { display: flex; align-items: center; gap: 8pt; margin: 0 0 8pt; color: #0b6b2b; font-weight: bold; }
      .institutional-header, .answer-card table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 14pt; }
      .institutional-header td, .answer-card th, .answer-card td { border: 1px solid #b7c7bc; padding: 6pt; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .institutional-header .label, .answer-card th { background: #f1f5f9; color: #0b5d28; font-weight: bold; }
      h1 { font-size: 16pt; color: #14532d; margin: 18pt 0 8pt; line-height: 1.35; }
      h2 { font-size: 14pt; color: #14532d; margin: 16pt 0 8pt; line-height: 1.35; }
      h3 { font-size: 12pt; color: #111827; margin: 12pt 0 6pt; line-height: 1.35; }
      .answer-card { page-break-inside: avoid; margin: 0 0 14pt; }
      .response-status { border: 1px solid #d1d5db; padding: 10pt; border-radius: 4pt; }
      p { margin: 0 0 10pt; }
      small { color: #4b5563; }
    `;
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
    const activityName = readMetaField(meta, "Actividad") || title;

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
    <tr><td class="label">Programa de formacion</td><td>${escapeHtml(metadata.program)}</td></tr>
    <tr><td class="label">Competencia</td><td>${escapeHtml(metadata.competencia)}</td></tr>
    <tr><td class="label">Resultado de Aprendizaje</td><td>${escapeHtml(metadata.resultado)}</td></tr>
    <tr><td class="label">Nombre completo del aprendiz</td><td>${escapeHtml(learnerName)}</td></tr>
    <tr><td class="label">Institucion educativa</td><td>${escapeHtml(institucion)}</td></tr>
    <tr><td class="label">Numero de ficha</td><td>${escapeHtml(ficha)}</td></tr>
    <tr><td class="label">Grado / grupo</td><td>${escapeHtml(grupo)}</td></tr>
    <tr><td class="label">Nombre de la guia</td><td>${escapeHtml(metadata.guideName)}</td></tr>
    <tr><td class="label">Nombre de la actividad</td><td>${escapeHtml(activityName)}</td></tr>
    <tr><td class="label">Fecha de entrega</td><td>${escapeHtml(fechaEntrega)}</td></tr>
    <tr><td class="label">Fecha de elaboracion del documento</td><td>${escapeHtml(today)}</td></tr>
  </table>
  <h1>${escapeHtml(title)}</h1>
  <p><strong>${escapeHtml(subtitle)}</strong></p>
  ${bodyHtml}
  <h2>Observaciones</h2>
  <table class="institutional-header" width="100%" style="width:100%;margin-top:0;">
    <tr><td style="height:80pt;vertical-align:top;"> </td></tr>
  </table>
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
