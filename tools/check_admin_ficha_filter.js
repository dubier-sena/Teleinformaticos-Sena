const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

const adminHtml = read("panel-administrativo-usuarios.html");
const adminJs = read(path.join("js", "admin_usuarios.js"));
const adminCss = read(path.join("css", "page_admin.css"));

assertIncludes(adminHtml, 'id="summary-users-label"', "etiqueta editable de aprendices");
assertIncludes(adminHtml, "Aprendices registrados", "indicador de aprendices registrados");
assertIncludes(adminHtml, 'id="ficha-filter"', "selector para filtrar por ficha");
assertIncludes(adminHtml, 'id="filter-ficha-count"', "contador del filtro por ficha");
assertIncludes(adminHtml, "admin_usuarios.js?v=20260411_2", "cache actualizado del panel admin");
assertIncludes(adminHtml, "page_admin.css?v=20260411_2", "cache actualizado de estilos admin");

assertIncludes(adminJs, "getSelectedFichaFilter", "lectura de ficha seleccionada");
assertIncludes(adminJs, "renderFichaFilterOptions", "opciones del filtro por ficha");
assertIncludes(adminJs, "updateFichaFilterOptions", "sincronizacion de fichas del filtro");
assertIncludes(adminJs, "selectedFicha", "filtrado por ficha");
assertIncludes(adminJs, "renderSummary(users)", "indicadores calculados sobre usuarios filtrados");
assertIncludes(adminJs, 'getById("ficha-filter")?.addEventListener("change"', "evento del filtro por ficha");
assertIncludes(adminJs, "Aprendices registrados en ficha", "contexto del indicador filtrado");

assertIncludes(adminCss, ".toolbar-select", "estilos del selector de ficha");
assertIncludes(adminCss, ".filter-chip", "estilos del contador de ficha");
assertIncludes(adminCss, ".summary-context", "estilos del contexto de indicadores");

console.log("OK: el panel admin permite filtrar por ficha y recalcula indicadores por ficha.");
