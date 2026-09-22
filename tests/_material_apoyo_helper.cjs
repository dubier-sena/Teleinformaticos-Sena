"use strict";
// Ayudante compartido por las pruebas que antes exigian que un material de apoyo
// existiera como archivo del repositorio.
//
// Desde la migracion del 21/09/2026 el material lo sirve Google Drive y esos
// archivos ya no estan versionados: lo que garantiza que el enlace funcione es
// su entrada en data/material_apoyo_drive.js. Este ayudante centraliza la
// comprobacion "existe de verdad", que ahora significa: esta en el repositorio
// O esta en el catalogo de Drive.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

let cached = null;
function driveCatalog() {
  if (cached === null) {
    const source = fs.readFileSync(path.join(ROOT, "data/material_apoyo_drive.js"), "utf8");
    const sandbox = {};
    new Function("window", source)(sandbox);
    cached = sandbox.__MATERIAL_APOYO_DRIVE__ || { enabled: false, files: {} };
  }
  return cached;
}

// Normaliza a la clave del catalogo: recorta lo anterior a "assets/materiales/",
// quita query/fragmento y decodifica el porcentaje.
function normalize(value) {
  const raw = String(value || "").split("?")[0].split("#")[0];
  const at = raw.indexOf("assets/materiales/");
  if (at < 0) return "";
  const slice = raw.slice(at);
  try {
    return decodeURIComponent(slice);
  } catch (error) {
    return slice;
  }
}

// true si el material se puede abrir: o sigue en el repositorio, o Drive lo sirve.
function materialIsAvailable(relativePath) {
  if (fs.existsSync(path.join(ROOT, relativePath))) return true;
  const catalog = driveCatalog();
  if (!catalog.enabled || !catalog.files) return false;
  return Boolean(catalog.files[normalize(relativePath)]);
}

function whereIsMaterial(relativePath) {
  if (fs.existsSync(path.join(ROOT, relativePath))) return "repositorio";
  const catalog = driveCatalog();
  const id = catalog.files ? catalog.files[normalize(relativePath)] : null;
  return id ? `Drive (${id})` : "NO DISPONIBLE";
}

module.exports = { materialIsAvailable, whereIsMaterial, normalize, driveCatalog, ROOT };
