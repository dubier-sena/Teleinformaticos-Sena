/*!
 * export_styles.js — Estilos compartidos para todos los documentos Word/HTML
 * exportados por el portal SENA. Fuente única de verdad para:
 *
 *   - Tamaño de página y márgenes (A4 + 2.54 cm en todos los bordes).
 *   - Tipografía base (Times New Roman 12 pt, interlineado uniforme).
 *   - Encabezado institucional (.institutional-header / .word-logo-line).
 *   - Reglas de seguridad de tablas (nunca se salen del ancho útil A4).
 *   - Reglas de seguridad de texto largo (URLs, rutas, correos, fuentes…).
 *
 * Cada exportador (admin_export.js, activity_standard.js, script.js,
 * script_guia2.js, script_guia3.js, script_guia6.js, script_guia_redes.js)
 * antepone esta hoja a sus estilos propios. Lo que cada actividad define
 * después sobre escribe los detalles cosméticos pero NO la seguridad de tabla
 * ni los márgenes.
 *
 * Compatible Word (Office HTML): solo emplea `@page`, `font-family`,
 * `border-collapse`, `table-layout: fixed`, `overflow-wrap`, `word-break` y
 * estilos clásicos que Microsoft Word respeta al abrir un .doc HTML.
 */
(function () {
  if (window.senaExportStyles) return;

  // ── Constantes públicas (útiles para tests y para builders externos) ──
  var PAGE_SIZE = "A4";
  var PAGE_MARGIN = "2.54cm";
  var BASE_FONT_FAMILY = '"Times New Roman", Times, serif';
  var BASE_FONT_SIZE = "12pt";
  var BASE_LINE_HEIGHT = "1.5";
  var BASE_TEXT_COLOR = "#1a1a1a";
  var INSTITUTIONAL_GREEN = "#1b5e20";
  var INSTITUTIONAL_BORDER = "#b7c9bc";
  var INSTITUTIONAL_LABEL_BG = "#f3f4f6";

  // ── Hoja base unificada (se aplica antes que cualquier estilo local) ──
  //
  // Todas las reglas de TABLA aplican a CUALQUIER <table> del documento
  // (incluso si la guía no le puso clase). Esto garantiza que ninguna tabla
  // se salga de las márgenes en Word ni al imprimir en A4.
  var BASE_STYLES = [
    "@page { size: " + PAGE_SIZE + "; margin: " + PAGE_MARGIN + "; }",
    "@page :first { size: " + PAGE_SIZE + "; margin: " + PAGE_MARGIN + "; }",
    "html, body { margin: 0; padding: 0; }",
    "body {",
    "  font-family: " + BASE_FONT_FAMILY + ";",
    "  font-size: " + BASE_FONT_SIZE + ";",
    "  line-height: " + BASE_LINE_HEIGHT + ";",
    "  color: " + BASE_TEXT_COLOR + ";",
    "  word-wrap: break-word;",
    "  overflow-wrap: anywhere;",
    "  -ms-word-break: break-word;",
    "}",
    "p { margin: 0 0 8pt; line-height: 1.5; }",
    "h1 { font-size: 18pt; color: " + INSTITUTIONAL_GREEN + "; margin: 12pt 0 8pt; line-height: 1.35; }",
    "h2 { font-size: 14pt; color: " + INSTITUTIONAL_GREEN + "; margin: 14pt 0 6pt; line-height: 1.35; }",
    "h3 { font-size: 12pt; color: " + INSTITUTIONAL_GREEN + "; margin: 10pt 0 4pt; line-height: 1.35; }",
    "small { color: #4b5563; font-size: 9pt; }",

    // ── Seguridad de tablas: nunca rebasan el ancho útil A4 ────────────
    "table {",
    "  width: 100%;",
    "  max-width: 100%;",
    "  border-collapse: collapse;",
    "  table-layout: fixed;",
    "  word-wrap: break-word;",
    "  overflow-wrap: anywhere;",
    "  word-break: break-word;",
    "  margin: 0 0 12pt;",
    "  page-break-inside: auto;",
    "}",
    "th, td {",
    "  padding: 6pt;",
    "  vertical-align: top;",
    "  border: 1px solid " + INSTITUTIONAL_BORDER + ";",
    "  font-size: 11pt;",
    "  line-height: 1.4;",
    "  word-wrap: break-word;",
    "  overflow-wrap: anywhere;",
    "  word-break: break-word;",
    "}",
    "th { background: #e8f5e9; color: " + INSTITUTIONAL_GREEN + "; font-weight: 700; text-align: left; }",

    // ── Variante para tablas con muchas columnas ───────────────────────
    "table.compact th, table.compact td { font-size: 9.5pt; padding: 5pt; line-height: 1.3; }",

    // ── Encabezado institucional (cabeza fija de cada documento) ───────
    ".word-logo-line { text-align: left; margin: 0 0 8pt; font-size: 10pt; line-height: 1.2; color: " + INSTITUTIONAL_GREEN + "; }",
    ".word-logo-line img { width: 36pt; height: 36pt; vertical-align: middle; margin-right: 8pt; }",
    ".institutional-header { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0 0 14pt; }",
    ".institutional-header td { border: 1px solid " + INSTITUTIONAL_BORDER + "; padding: 7pt; vertical-align: top; font-size: 10pt; line-height: 1.35; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }",
    ".institutional-header .label { width: 30%; font-weight: 700; background: " + INSTITUTIONAL_LABEL_BG + "; color: " + INSTITUTIONAL_GREEN + "; }",

    // ── Tarjetas de respuesta (panel admin) ────────────────────────────
    ".answer-card { page-break-inside: avoid; margin: 0 0 14pt; }",
    ".answer-card table { width: 100%; max-width: 100%; table-layout: fixed; border-collapse: collapse; }",
    ".answer-card th, .answer-card td { border: 1px solid " + INSTITUTIONAL_BORDER + "; padding: 6pt; vertical-align: top; word-wrap: break-word; overflow-wrap: anywhere; word-break: break-word; }",
    ".answer-card th { background: " + INSTITUTIONAL_LABEL_BG + "; color: " + INSTITUTIONAL_GREEN + "; font-weight: 700; }",

    // ── Texto largo (URLs, correos, rutas, fuentes bibliográficas) ─────
    "a { color: #1d4ed8; word-break: break-all; overflow-wrap: anywhere; }",
    "img { max-width: 100%; height: auto; }",
    "pre, code { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; font-family: Consolas, \"Courier New\", monospace; font-size: 10pt; }",

    // ── Pie del documento ──────────────────────────────────────────────
    ".word-footer { margin-top: 28pt; border-top: 1pt solid #e5e7eb; padding-top: 8pt; font-size: 9pt; line-height: 1.4; color: #4b5563; word-break: break-word; overflow-wrap: anywhere; }",
  ].join("\n");

  // ── Hoja para páginas horizontales (opt-in, no se aplica por defecto) ─
  var LANDSCAPE_STYLES = [
    "@page landscape { size: " + PAGE_SIZE + " landscape; margin: " + PAGE_MARGIN + "; }",
    "body.landscape { /* añadir class=\"landscape\" al <body> para activar */ }",
  ].join("\n");

  function getBaseStyles() {
    return BASE_STYLES;
  }

  function getLandscapeStyles() {
    return LANDSCAPE_STYLES;
  }

  /**
   * Devuelve un bloque <style>…</style> listo para insertar en el <head>
   * del documento Word. `extraCss` (opcional) se inyecta DESPUÉS de la hoja
   * base, así puede sobreescribir colores, tamaños o agregar reglas propias.
   */
  function wrapStyles(extraCss) {
    return "<style>" + BASE_STYLES + "\n" + (extraCss || "") + "</style>";
  }

  window.senaExportStyles = Object.freeze({
    getBaseStyles: getBaseStyles,
    getLandscapeStyles: getLandscapeStyles,
    wrapStyles: wrapStyles,
    PAGE_SIZE: PAGE_SIZE,
    PAGE_MARGIN: PAGE_MARGIN,
  });
})();
