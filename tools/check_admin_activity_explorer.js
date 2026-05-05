const fs = require("fs");
const path = require("path");

const root = process.cwd();
const adminJs = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");

function assertIncludes(marker, label) {
  if (!adminJs.includes(marker)) {
    throw new Error(`Falta ${label}: ${marker}`);
  }
}

function assertOrder(first, second, label) {
  const a = adminJs.indexOf(first);
  const b = adminJs.indexOf(second);
  if (a < 0 || b < 0 || a >= b) {
    throw new Error(`Orden incorrecto en ${label}: ${first} debe aparecer antes de ${second}`);
  }
}

assertIncludes("function getOfficialGuideFilesForUsers", "guias oficiales por ficha");
assertIncludes("auth.getGuidesForFicha(ficha)", "mapa oficial de guias");
assertIncludes("function userHasOfficialGuide", "filtro oficial de aprendices por guia");
assertIncludes("function getRedesActivitiesForFile", "actividades de redes en explorador");
assertIncludes("function buildStandardActivityButtons", "botones estandar de acciones");
assertIncludes("function buildGuide1ActivityResponsePayload", "detalle de entregas de Guia 1");
assertIncludes("function buildRedesActivityResponsePayload", "detalle de actividades de redes");
assertIncludes('isRedesSbGuideFile(fileName) ? "redes"', "tipo de guia redes");
assertIncludes("guideKind === \"redes\"", "tabla de actividades de redes");
assertIncludes("data-view-guide-activity", "boton Ver respuestas");
assertIncludes("data-export-activity", "boton Exportar soporte");
assertIncludes("data-unlock-redes-activity", "acciones de redes por actividad");
assertIncludes("data-unlock-redes-quiz", "acciones de quiz de redes");

assertOrder(
  '{ id: "matching", label: "Relaciona herramientas"',
  '{ id: "matriz322", label: "Actividad 3.2.2 - Matriz de Diagnóstico Digital"',
  "Guia 2 antes de matriz"
);
assertOrder(
  '{ id: "fichaCaso", label: "Actividad 4 - Ficha de caso"',
  '{ id: "extensiones331", label: "Actividad 5 - Extensiones de archivo"',
  "Guia 2 antes de actividad 5"
);

console.log("OK: el explorador de actividades usa guias oficiales por ficha y orden pedagogico.");
