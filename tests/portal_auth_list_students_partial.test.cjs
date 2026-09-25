"use strict";

// Hotfix 2026-09-25: la Agenda administrativa mostraba "Error al construir la
// agenda" en produccion. Causa: listStudents() (js/portal_auth.js) ordenaba
// con left.fullName.localeCompare(...) y un documento de sena_portal_users
// sincronizado SIN fullName/username/ficha lanzaba TypeError, que tumbaba
// todo getStudentsWithProgress() -> loadRoster() -> resolveAdminAgendaContext().
// Un registro incompleto NO debe romper la lista, y tampoco debe recibir una
// identidad inventada: se conserva tal cual, solo se ordena de forma tolerante.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const AUTH_SRC = fs.readFileSync(path.join(__dirname, "..", "js", "portal_auth.js"), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));

function makeStorage(seed) {
  const map = new Map(Object.entries(seed || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => Array.from(map.keys())[i] || null,
    get length() { return map.size; },
  };
}

function loadAuth(users) {
  const localStorage = makeStorage({ sena_portal_users_v1: JSON.stringify(users) });
  const ctx = {
    document: { addEventListener() {}, removeEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: { appendChild() {} }, readyState: "complete" },
    localStorage,
    sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname: "dubier-sena.github.io", pathname: "/Teleinformaticos-Sena/index.html", href: "", search: "" },
    navigator: {},
    console,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    addEventListener() {},
    removeEventListener() {},
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(AUTH_SRC, ctx, { filename: "portal_auth.js" });
  return ctx.portalAuth;
}

const ANA = { usernameKey: "ana.lopez", username: "ana.lopez", fullName: "Ana Lopez", ficha: "3168852", grupo: "11B" };
const BETO = { usernameKey: "beto.perez", username: "beto.perez", fullName: "Beto Perez", ficha: "3168852", grupo: "11B" };
const SIN_NOMBRE = { usernameKey: "carla.ruiz", username: "carla.ruiz", ficha: "3168850", grupo: "11A" };
// Forma REAL del documento defectuoso visto en produccion (sin fullName,
// username ni ficha; solo metadatos y usernameKey).
const INCOMPLETO = { _docId: "x", _docName: "x", _updateTime: "2026-09-01T00:00:00Z", audit: {}, usernameKey: "zz.incompleto", progress: {}, passwordHash: "h", updatedAt: "2026-09-01T00:00:00Z", status: "active", active: true };
const VACIO = { _docId: "y", audit: {} };

test("T01: usuarios normales -> lista ordenada por nombre", () => {
  const auth = loadAuth([BETO, ANA]);
  assert.deepEqual(plain(auth.listStudents().map((u) => u.usernameKey)), ["ana.lopez", "beto.perez"]);
});

test("T02: un usuario sin fullName NO lanza excepcion", () => {
  const auth = loadAuth([ANA, SIN_NOMBRE, BETO]);
  assert.doesNotThrow(() => auth.listStudents());
});

test("T03: sin fullName pero con username/usernameKey -> orden estable y determinista", () => {
  const a = loadAuth([BETO, SIN_NOMBRE, ANA]).listStudents().map((u) => u.usernameKey);
  const b = loadAuth([SIN_NOMBRE, ANA, BETO]).listStudents().map((u) => u.usernameKey);
  assert.deepEqual(plain(a), plain(b));
  assert.deepEqual(plain(a), ["ana.lopez", "beto.perez", "carla.ruiz"]);
});

test("T04: registro sin fullName, username NI ficha (el de produccion) NO lanza excepcion", () => {
  const auth = loadAuth([ANA, INCOMPLETO, BETO, VACIO]);
  assert.doesNotThrow(() => auth.listStudents());
  assert.doesNotThrow(() => auth.getStudentsWithProgress());
});

test("T05: dos usuarios normales mantienen el orden esperado aunque haya incompletos", () => {
  const keys = loadAuth([INCOMPLETO, BETO, VACIO, ANA]).listStudents().map((u) => u.usernameKey);
  assert.ok(keys.indexOf("ana.lopez") < keys.indexOf("beto.perez"));
});

test("T06: el registro incompleto NO recibe identidad inventada", () => {
  const list = loadAuth([ANA, INCOMPLETO]).listStudents();
  const inc = list.find((u) => u.usernameKey === "zz.incompleto");
  assert.ok(inc, "el registro se conserva (no se borra en silencio)");
  assert.equal(inc.fullName, undefined);
  assert.equal(inc.username, undefined);
  assert.equal(inc.ficha, undefined);
});

test("T07: los registros validos se devuelven completos y sin alterar", () => {
  const list = loadAuth([INCOMPLETO, ANA, BETO]).listStudents();
  const ana = list.find((u) => u.usernameKey === "ana.lopez");
  assert.deepEqual(plain(ana), ANA);
  assert.equal(list.length, 3);
  const withProgress = loadAuth([INCOMPLETO, ANA, BETO]).getStudentsWithProgress();
  assert.equal(withProgress.length, 3);
  assert.equal(withProgress.find((u) => u.usernameKey === "ana.lopez").fullName, "Ana Lopez");
});
