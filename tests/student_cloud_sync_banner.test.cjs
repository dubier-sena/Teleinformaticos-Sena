"use strict";

// Auditoria 2026-08-22, Fase 6: watchdog de sesion de Firebase para el
// APRENDIZ (espejo del que ya existia solo para el admin, ver
// tests/admin_cloud_sync_warning.test.cjs). Antes firebase_status_banner.js
// detectaba offline/no-auth/rechazos por igual para cualquier sesion, pero
// `setBannerMessage` cortaba en seco si quien miraba no era admin -- un
// aprendiz podia pasar sesiones enteras escribiendo respuestas que solo
// quedaban en su localStorage, sin ningun aviso de que la nube dejo de
// sincronizar.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

test("existe un mensaje pensado para el aprendiz (no tecnico) para cada estado de fallo", () => {
  const banner = read(path.join("js", "firebase_status_banner.js"));
  assert.match(banner, /function studentMessageFor\(status\)/);
  assert.match(banner, /case "offline":/);
  assert.match(banner, /case "no-auth":/);
  assert.match(banner, /case "rejected":/);
  // El texto del aprendiz debe ser tranquilizador (su trabajo sigue a salvo),
  // no la jerga tecnica que sí es aceptable para el admin.
  assert.match(banner, /se siguen guardando en este equipo/);
});

test("setBannerMessage ya no descarta el aviso solo por no ser admin", () => {
  const banner = read(path.join("js", "firebase_status_banner.js"));
  const fn = banner.match(/function setBannerMessage\([\s\S]*?\n  \}/);
  assert.ok(fn, "setBannerMessage debe existir");
  // Antes: `if (!isAdmin()) return;` incondicional. Ahora solo corta si
  // TAMPOCO hay mensaje de aprendiz para ese estado.
  assert.match(fn[0], /if \(!admin && !studentMessage\) return;/);
});

test("markFailure le pasa a setBannerMessage el mensaje de aprendiz correspondiente", () => {
  const banner = read(path.join("js", "firebase_status_banner.js"));
  assert.match(banner, /setBannerMessage\(message, studentMessageFor\(status\)\)/);
});

// Prueba de comportamiento real: con un DOM minimo, un aprendiz (isAdminSession
// devuelve false) SI debe ver el banner con el texto de aprendiz cuando el
// hook de fetch detecta 2 fallos de auth seguidos contra Firestore.
function makeMinimalDom() {
  const listeners = {};
  const style = {};
  const el = {
    id: "",
    style,
    _text: "",
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
    setAttribute() {},
    appendChild() {},
  };
  const doc = {
    getElementById(id) { return id === "sena-portal-sync-banner" ? (el.id ? el : null) : null; },
    createElement() { el.id = "sena-portal-sync-banner"; return el; },
    body: { appendChild(node) { void node; } },
    addEventListener() {},
    readyState: "complete",
  };
  return { doc, el, listeners };
}

test("un aprendiz (no admin) SI ve el banner tras 2 fallos de auth seguidos contra Firestore", async () => {
  const code = read(path.join("js", "firebase_status_banner.js"));
  const { doc, el } = makeMinimalDom();
  let capturedFetch = null;

  const sandbox = {
    document: doc,
    window: {
      __senaPortalSyncBannerInstalled: false,
      localStorage: { setItem() {}, getItem() { return null; } },
      addEventListener() {},
      dispatchEvent() {},
      setTimeout: (fn) => fn(),
      portalAuth: { isAdminSession: () => false }, // aprendiz, no admin
    },
    navigator: { onLine: true },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    console,
  };
  sandbox.window.fetch = function fakeFetch() {
    return Promise.resolve({ ok: false, status: 401 });
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  capturedFetch = sandbox.window.fetch;

  // Dos peticiones "a Firestore" seguidas con 401 (umbral FAILURE_THRESHOLD=2).
  await capturedFetch("https://firestore.googleapis.com/v1/projects/x/databases/(default)/documents/y");
  await capturedFetch("https://firestore.googleapis.com/v1/projects/x/databases/(default)/documents/y");

  assert.equal(el.style.display, "block", "el banner debe mostrarse para el aprendiz");
  assert.match(el.textContent, /se siguen guardando en este equipo/, "debe usar el texto pensado para el aprendiz, no el tecnico del admin");
});
