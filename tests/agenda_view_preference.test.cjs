"use strict";

// Bloque E: js/agenda_view_preference.js -- preferencia de vista, SOLO
// localStorage (nunca Firestore, pedido explicito). Sandboxed con
// vm.createContext (modulo de navegador, no UMD).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function makeLocalStorage() {
  var store = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
    __store: store,
  };
}

function loadSandbox(overrides) {
  var sandbox = { console: console, Object: Object, String: String };
  sandbox.window = sandbox;
  Object.assign(sandbox.window, { localStorage: makeLocalStorage(), innerWidth: 1440 }, overrides || {});
  vm.createContext(sandbox);
  vm.runInContext(read("js/agenda_view_preference.js"), sandbox, { filename: "agenda_view_preference.js" });
  return sandbox.window.agendaViewPreference;
}

test("getPreferredView: sin nada guardado -> agenda (default universal, sirve tambien para movil)", () => {
  const mod = loadSandbox();
  assert.equal(mod.getPreferredView(), "agenda");
});

test("setPreferredView + getPreferredView: round-trip persiste la eleccion", () => {
  const mod = loadSandbox();
  mod.setPreferredView("week");
  assert.equal(mod.getPreferredView(), "week");
  mod.setPreferredView("month");
  assert.equal(mod.getPreferredView(), "month");
});

test("setPreferredView: valor invalido se ignora, no corrompe lo ya guardado", () => {
  const mod = loadSandbox();
  mod.setPreferredView("week");
  mod.setPreferredView("algo-invalido");
  assert.equal(mod.getPreferredView(), "week");
});

test("getPreferredView: localStorage roto (lanza excepcion) -- nunca truena, cae al default", () => {
  const mod = loadSandbox({
    localStorage: {
      getItem: function () { throw new Error("bloqueado"); },
      setItem: function () { throw new Error("bloqueado"); },
    },
  });
  assert.equal(mod.getPreferredView(), "agenda");
  assert.doesNotThrow(function () { mod.setPreferredView("week"); });
});

test("preferencia guardada se respeta igual en movil que en escritorio (no se ignora por ancho de pantalla)", () => {
  const mod = loadSandbox({ innerWidth: 375 });
  mod.setPreferredView("month");
  assert.equal(mod.getPreferredView(), "month");
});
