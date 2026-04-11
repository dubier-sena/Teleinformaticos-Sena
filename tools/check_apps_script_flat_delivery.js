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

function assertNotIncludes(content, unexpected, label) {
  if (content.includes(unexpected)) {
    throw new Error(`Sobra ${label}: ${unexpected}`);
  }
}

const appsScriptGs = read(path.join("apps-script", "entregas_actividades.gs"));
const helperJs = read(path.join("js", "shared_apps_script_delivery.js"));

assertIncludes(
  appsScriptGs,
  "buildDeliveryFileName",
  "generacion centralizada del nombre final del archivo"
);
assertIncludes(
  appsScriptGs,
  "rootFolder.createFile(blob)",
  "carga directa en la carpeta raiz de la ficha"
);
assertIncludes(
  appsScriptGs,
  'replace(/\\s+/g, "_")',
  "normalizacion con guion bajo en el nombre del archivo"
);
assertIncludes(
  appsScriptGs,
  'replace(/[^a-z0-9]+/gi, "_")',
  "normalizacion segura del texto de la actividad"
);
assertNotIncludes(
  appsScriptGs,
  "findOrCreateFolder(",
  "creacion de subcarpetas por guia o actividad"
);
assertIncludes(
  helperJs,
  "buildDeliveryFileNamePreview",
  "vista previa del nombre final en el modal"
);
assertIncludes(
  helperJs,
  "Archivo final previsto:",
  "mensaje actualizado del estado"
);

console.log("OK: la entrega segura usa archivo plano por ficha y nombre final normalizado.");
