const fs = require("fs");
const path = require("path");

const root = process.cwd();
const adminHtml = fs.readFileSync(path.join(root, "panel-administrativo-usuarios.html"), "utf8");
const pageHtml = fs.readFileSync(path.join(root, "etapa-productiva-admin.html"), "utf8");
const pageJs = fs.readFileSync(path.join(root, "js", "productive_stage_admin.js"), "utf8");
const pageCss = fs.readFileSync(path.join(root, "css", "page_productive_stage_admin.css"), "utf8");

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

function assertExcludes(content, forbidden, label) {
  if (content.includes(forbidden)) {
    throw new Error(`Sobra ${label}: ${forbidden}`);
  }
}

assertIncludes(
  adminHtml,
  'href="etapa-productiva-admin.html"',
  "enlace del panel principal hacia la nueva pagina de etapa productiva"
);
assertIncludes(adminHtml, 'id="productive-stage-access-panel"', "tarjeta de acceso rapido");
assertExcludes(adminHtml, 'src="js/vendor/mammoth.browser.min.js', "libreria DOCX cargada en el panel principal");
assertExcludes(adminHtml, 'src="js/productive_stage_import.js', "parser de etapa productiva cargado en el panel principal");
assertExcludes(adminHtml, 'src="js/productive_stage_store.js', "store de etapa productiva cargado en el panel principal");
assertExcludes(adminHtml, 'id="productive-stage-file"', "importador incrustado en el panel principal");
assertExcludes(adminHtml, 'id="productive-stage-detail-modal"', "modal de detalle incrustado en el panel principal");

assertIncludes(
  pageHtml,
  'src="js/vendor/mammoth.browser.min.js?v=20260411_1"',
  "libreria de lectura docx en la nueva pagina"
);
assertIncludes(
  pageHtml,
  'src="js/productive_stage_import.js?v=20260411_1"',
  "parser de etapa productiva en la nueva pagina"
);
assertIncludes(
  pageHtml,
  'src="js/productive_stage_store.js?v=20260411_2"',
  "almacenamiento de etapa productiva en la nueva pagina"
);
assertIncludes(pageHtml, 'id="productive-stage-panel"', "contenedor principal de etapa productiva");
assertIncludes(pageHtml, 'id="productive-stage-file"', "input de archivo en la pagina dedicada");
assertIncludes(pageHtml, 'id="productive-stage-import-button"', "boton de importacion dedicado");
assertIncludes(pageHtml, 'id="productive-stage-projects"', "listado de proyectos");
assertIncludes(pageHtml, 'id="productive-stage-detail-modal"', "modal de detalle");

assertIncludes(pageJs, "renderProductiveStageSection", "render del modulo administrativo dedicado");
assertIncludes(pageJs, "handleProductiveStageImport", "flujo de importacion administrativa dedicado");
assertIncludes(pageJs, "refreshProductiveStageModule", "recarga de datos dedicada");

assertIncludes(pageCss, ".productive-stage-admin-shell", "estilos de la pagina dedicada");
assertIncludes(pageCss, ".productive-stage-toolbar", "toolbar de filtros dedicada");

console.log("OK: etapa productiva vive en una pagina administrativa dedicada y el panel principal solo enlaza el modulo.");
