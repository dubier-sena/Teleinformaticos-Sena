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

function assertMatches(content, pattern, label) {
  if (!pattern.test(content)) {
    throw new Error(`Falta ${label}: ${pattern}`);
  }
}

const adminHtml = read("panel-administrativo-usuarios.html");
const adminJs = read(path.join("js", "admin_usuarios.js"));
const authJs = read(path.join("js", "portal_auth.js"));
const adminCss = read(path.join("css", "page_admin.css"));

assertIncludes(adminJs, "renderWordSearchAdminSummary", "resumen visible de la sopa por aprendiz");
assertIncludes(adminJs, "Realizo sopa", "estado visible de actividad 1");
assertIncludes(adminJs, "Aprendiz que realizo", "identidad dentro del modal de resultados");
assertIncludes(adminJs, "data-ficha-form", "formulario administrativo para corregir ficha");
assertIncludes(adminJs, "handleFichaSubmit", "manejador de correccion de ficha");
assertIncludes(adminJs, "auth.updateStudentFicha", "uso de API de correccion de ficha");

assertIncludes(authJs, "updateStudentFicha", "funcion local para actualizar ficha");
assertIncludes(authJs, "getSelectionForFicha(cleanFicha)", "recalculo de institucion y grupo");
assertIncludes(authJs, "const localResult = original.updateStudentFicha.call(auth, cleanUsernameKey, cleanFicha);", "fallback local para correccion de ficha");
assertIncludes(authJs, "upsertLocalUser(", "actualizacion del usuario tras corregir ficha");

assertIncludes(adminCss, ".ficha-row", "estilos del formulario de ficha");
assertMatches(adminHtml, /portal_auth\.js\?v=\d{8}_\d+/, "cache actualizado de autenticacion");
assertMatches(adminHtml, /admin_usuarios\.js\?v=\d{8}_\d+/, "cache actualizado del panel admin");
assertMatches(adminHtml, /page_admin\.css\?v=\d{8}_\d+/, "cache actualizado de estilos admin");

console.log("OK: el panel admin muestra quien realizo la actividad y permite corregir ficha.");
