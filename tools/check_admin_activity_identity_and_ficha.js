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
const authJs = read(path.join("js", "portal_auth.js"));
const adminCss = read(path.join("css", "page_admin.css"));
const server = read(path.join("tools", "servidor_web_red.ps1"));

assertIncludes(adminJs, "renderWordSearchAdminSummary", "resumen visible de la sopa por aprendiz");
assertIncludes(adminJs, "Realizo sopa", "estado visible de actividad 1");
assertIncludes(adminJs, "Aprendiz que realizo", "identidad dentro del modal de resultados");
assertIncludes(adminJs, "data-ficha-form", "formulario administrativo para corregir ficha");
assertIncludes(adminJs, "handleFichaSubmit", "manejador de correccion de ficha");
assertIncludes(adminJs, "auth.updateStudentFicha", "uso de API de correccion de ficha");

assertIncludes(authJs, "updateStudentFicha", "funcion local para actualizar ficha");
assertIncludes(authJs, "/api/admin/ficha", "sincronizacion de ficha en servidor local");
assertIncludes(authJs, "getSelectionForFicha(cleanFicha)", "recalculo de institucion y grupo");

assertIncludes(server, '"/api/admin/ficha"', "endpoint del servidor local para ficha");
assertIncludes(server, '$user["ficha"] = $ficha', "persistencia de ficha en servidor local");
assertIncludes(server, '$user["inst"] = $selection["inst"]', "persistencia de institucion en servidor local");
assertIncludes(server, '$user["grupo"] = $selection["grupo"]', "persistencia de grupo en servidor local");

assertIncludes(adminCss, ".ficha-row", "estilos del formulario de ficha");
assertIncludes(adminHtml, "portal_auth.js?v=20260409_2", "cache actualizado de autenticacion");
assertIncludes(adminHtml, "admin_usuarios.js?v=20260409_6", "cache actualizado del panel admin");
assertIncludes(adminHtml, "page_admin.css?v=20260409_2", "cache actualizado de estilos admin");

console.log("OK: el panel admin muestra quien realizo la actividad y permite corregir ficha.");
