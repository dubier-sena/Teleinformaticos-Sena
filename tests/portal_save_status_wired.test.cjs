"use strict";

// Auditoria 2026-08-22, Fase 2: el estado visible de guardado debe reflejar
// lo que REALMENTE paso con la nube, nunca solo que localStorage funciono.
// window.portalSaveStatus ya existia (save_status.js) pero ningun guion de
// guia lo usaba (confirmado por grep antes de esta sesion). Este test cubre
// las 5 guias "protegidas" (que ya hidrataban/reintentaban antes de esta
// sesion, con su propia implementacion) para que no pierdan esta conexion en
// un futuro refactor; las 8 guias migradas al modulo centralizado quedan
// cubiertas por tests/guide_cloud_sync_store.test.cjs (el modulo compartido
// ya reporta el estado real para todas ellas por igual).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, "js", fileName), "utf8");
}

const PROTECTED_FILES = [
  "script.js",
  "script_guia2.js",
  "script_guia3.js",
  "script_guia6.js",
  "script_induccion.js",
];

PROTECTED_FILES.forEach((fileName) => {
  test(`${fileName}: saveState() marca "Guardando..." de inmediato (guardado local, sync pendiente)`, () => {
    const code = read(fileName);
    const fn = code.match(/function saveState\(\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fn, `${fileName} debe tener saveState()`);
    assert.match(fn[0], /portalSaveStatus\?\.saving\?\./, `${fileName}: saveState() debe reportar 'Guardando...'`);
  });

  test(`${fileName}: syncCloudState() solo reporta "Guardado" tras exito real de cloudSaveGuideData`, () => {
    const code = read(fileName);
    const fn = code.match(/async function syncCloudState\(force\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fn, `${fileName} debe tener syncCloudState()`);
    // El aviso de exito debe estar DESPUES de confirmar `saved` (no antes del
    // primer chequeo `if (!saved)`).
    const failIdx = fn[0].indexOf("if (!saved)");
    const successIdx = fn[0].indexOf("portalSaveStatus?.saved?.");
    assert.ok(failIdx > -1 && successIdx > failIdx, `${fileName}: el aviso de 'Guardado' debe venir despues de descartar el fallo`);
  });

  test(`${fileName}: scheduleCloudStateRetry() distingue sin-conexion de fallo-de-sincronizacion`, () => {
    const code = read(fileName);
    const fn = code.match(/function scheduleCloudStateRetry\(\)\s*\{[\s\S]*?\n\}/);
    assert.ok(fn, `${fileName} debe tener scheduleCloudStateRetry()`);
    assert.match(fn[0], /navigator\.onLine === false/, `${fileName}: debe distinguir offline real`);
    assert.match(fn[0], /portalSaveStatus\?\.offline\?\./, `${fileName}: debe avisar offline`);
    assert.match(fn[0], /portalSaveStatus\?\.pendingSync\?\./, `${fileName}: debe avisar pendiente de sincronizar (no offline, pero tampoco confirmado)`);
  });
});
