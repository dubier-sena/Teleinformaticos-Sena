"use strict";

// Prueba del respaldo manual a Drive:
//   - getDriveFolderUrlForFicha resuelve la carpeta por ficha (y casos borde)
//   - project_integrations.js define carpeta para las 6 fichas reales

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function runInSandbox(relFile, windowSeed) {
  const code = fs.readFileSync(path.join(__dirname, "..", relFile), "utf8");
  const sandbox = {
    window: windowSeed || {},
    document: { addEventListener() {}, querySelectorAll() { return []; } },
    console: { warn() {}, error() {}, info() {}, log() {} },
    navigator: {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}

const FOLDER = "https://drive.google.com/drive/folders/ABC123";
const win = runInSandbox("js/shared_apps_script_delivery.js", {
  PROJECT_INTEGRATIONS: { fichaDriveFolders: { "3441944": FOLDER } },
});
const api = win.sharedAppsScriptDelivery;

test("expone los helpers de respaldo manual", () => {
  assert.strictEqual(typeof api.getDriveFolderUrlForFicha, "function");
  assert.strictEqual(typeof api.renderManualDriveFallback, "function");
  assert.strictEqual(typeof api.offerManualDriveFallback, "function");
});

test("resuelve la carpeta de una ficha conocida", () => {
  assert.strictEqual(api.getDriveFolderUrlForFicha("3441944"), FOLDER);
});

test("ficha desconocida -> cadena vacia", () => {
  assert.strictEqual(api.getDriveFolderUrlForFicha("0000"), "");
});

test("recorta espacios y tolera ficha numerica", () => {
  assert.strictEqual(api.getDriveFolderUrlForFicha("  3441944  "), FOLDER);
  assert.strictEqual(api.getDriveFolderUrlForFicha(3441944), FOLDER);
});

test("ficha vacia o nula -> cadena vacia", () => {
  assert.strictEqual(api.getDriveFolderUrlForFicha(""), "");
  assert.strictEqual(api.getDriveFolderUrlForFicha(null), "");
  assert.strictEqual(api.getDriveFolderUrlForFicha(undefined), "");
});

test("project_integrations define carpeta para las 6 fichas reales", () => {
  const win2 = runInSandbox("js/project_integrations.js", {});
  const map = (win2.PROJECT_INTEGRATIONS || {}).fichaDriveFolders || {};
  ["3441939", "3441942", "3441944", "3441950", "3168850", "3168852"].forEach((ficha) => {
    assert.ok(
      map[ficha] && map[ficha].indexOf("drive.google.com/drive/folders/") >= 0,
      "falta carpeta de Drive para la ficha " + ficha
    );
  });
});

test("project_integrations permite subir .py (guia de Python)", () => {
  const win2 = runInSandbox("js/project_integrations.js", {});
  const exts = (win2.PROJECT_INTEGRATIONS || {}).allowedUploadExtensions || [];
  assert.ok(exts.indexOf(".py") >= 0, "falta .py en allowedUploadExtensions");
});
