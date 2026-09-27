"use strict";
// Acceso de APRENDICES al Laboratorio Virtual de Hardware (2026-09-27).
// Hasta ahora solo el admin podia verlo (gate temporal del 2026-08-16). La
// fuente de verdad es la misma de siempre: FICHA_MAP[ficha].optionalModules.
// hardwareLab (js/portal_auth.js). Se prueba con el portal_auth.js y el
// shared_shell.js REALES: el enlace del menu y el gate de la pagina deben
// coincidir, y el aprendiz no debe recibir enlaces de instructor.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createDocument, isRendered } = require("./_mini_dom.cjs");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const shell = read("js/shared_shell.js");
const portalAuth = read("js/portal_auth.js");
const labHtml = read("laboratorio-virtual-hardware.html");

function makeStorage() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function makeContext(session, { hostname = "dubier-sena.github.io", pathname = "/Teleinformaticos-Sena/index.html" } = {}) {
  const document = createDocument();
  const ctx = {
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname, pathname, href: "https://" + hostname + pathname, search: "", replace(url) { ctx.__redirect = url; } },
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
  vm.runInContext(portalAuth, ctx, { filename: "portal_auth.js" });
  ctx.portalAuth.getCurrentSession = () => session;
  ctx.portalAuth.setFlashMessage = (msg) => { ctx.__flash = msg; };
  return ctx;
}

function bootNavbar(session) {
  const ctx = makeContext(session);
  vm.runInContext(shell, ctx, { filename: "shared_shell.js" });
  const link = ctx.document.querySelector('[data-nav-key="laboratorio"]');
  const panel = ctx.document.querySelector('[data-nav-key="panel"]');
  return { ctx, link, panel };
}

/** Ejecuta el gate REAL de la pagina (primer <script> inline tras portal_auth.js). */
function runGate(session, opts) {
  const start = labHtml.indexOf("<script>", labHtml.indexOf("js/portal_auth.js"));
  const end = labHtml.indexOf("</script>", start);
  const code = labHtml.slice(start + "<script>".length, end);
  assert.match(code, /optionalModules\.hardwareLab === true/, "no se encontro el gate de la pagina");
  const ctx = makeContext(session, opts);
  ctx.document.documentElement = { innerHTML: "x" };
  let blocked = false;
  try { vm.runInContext(code, ctx, { filename: "gate.js" }); } catch (e) { blocked = /Acceso no autorizado/.test(e.message); }
  return { allowed: !blocked && !ctx.__redirect, redirect: ctx.__redirect || null, flash: ctx.__flash || null };
}

const STUDENT = (ficha) => ({ role: "student", user: { ficha, usernameKey: "prueba", fullName: "Aprendiz Prueba" } });
const ADMIN = { role: "admin", user: { username: "dubier", usernameKey: "dubier" } };

/** Fichas habilitadas segun la fuente central (no una lista propia del test). */
function fichasSegunPortal() {
  const ctx = makeContext(null);
  const enabled = [], disabled = [];
  const src = portalAuth.slice(portalAuth.indexOf("const FICHA_MAP = {"));
  const ids = [...new Set([...src.slice(0, src.indexOf("\n  };")).matchAll(/^ {4}"(\d{7})": \{/gm)].map((m) => m[1]))];
  assert.ok(ids.length >= 4, "no se encontraron las fichas de FICHA_MAP");
  ids.forEach((f) => {
    const info = ctx.portalAuth.getFichaInfo(f);
    ((info && info.optionalModules && info.optionalModules.hardwareLab === true) ? enabled : disabled).push(f);
  });
  return { enabled, disabled };
}

test("A01. las fichas habilitadas salen de FICHA_MAP (optionalModules.hardwareLab)", () => {
  const { enabled, disabled } = fichasSegunPortal();
  assert.deepEqual(enabled.slice().sort(), ["3441939", "3441942", "3441944", "3441950"]);
  assert.ok(disabled.includes("3168850") && disabled.includes("3168852"), "grado 11 no tiene el modulo");
});

test("A02. menu: el aprendiz de una ficha habilitada VE el Laboratorio; el de otra ficha no", () => {
  const { enabled, disabled } = fichasSegunPortal();
  enabled.forEach((f) => {
    const { link } = bootNavbar(STUDENT(f));
    assert.ok(link, "falta el enlace del laboratorio");
    assert.equal(isRendered(link), true, `ficha ${f}: deberia verlo`);
    assert.match(link.getAttribute("href"), /laboratorio-virtual-hardware\.html$/);
  });
  disabled.forEach((f) => assert.equal(isRendered(bootNavbar(STUDENT(f)).link), false, `ficha ${f}: no deberia verlo`));
  assert.equal(isRendered(bootNavbar(STUDENT("0000000")).link), false, "ficha inexistente: no lo ve");
});

test("A03. menu: el instructor conserva el Laboratorio y el Panel Admin; el aprendiz NO recibe el Panel Admin", () => {
  const admin = bootNavbar(ADMIN);
  assert.equal(isRendered(admin.link), true);
  assert.equal(isRendered(admin.panel), true, "el admin conserva Panel Admin");
  const aprendiz = bootNavbar(STUDENT("3441939"));
  assert.equal(isRendered(aprendiz.panel), false, "el aprendiz no ve Panel Admin");
  aprendiz.ctx.document.querySelectorAll(".app-navbar__admin-only").forEach((el) => assert.equal(isRendered(el), false, "enlace de instructor visible para el aprendiz"));
  // El laboratorio ya no depende de la clase de solo-admin (la usa el resto del instructor).
  assert.doesNotMatch(aprendiz.link.getAttribute("class"), /app-navbar__admin-only/);
});

test("A04. gate de la pagina: misma regla que el menu (admin o ficha habilitada); el resto vuelve al inicio", () => {
  assert.equal(runGate(ADMIN).allowed, true, "admin");
  fichasSegunPortal().enabled.forEach((f) => assert.equal(runGate(STUDENT(f)).allowed, true, `aprendiz ficha ${f}`));
  const otra = runGate(STUDENT("3168850"));
  assert.equal(otra.allowed, false);
  assert.equal(otra.redirect, "index.html", "redirige al inicio (politica existente)");
  assert.ok(otra.flash, "explica por que");
  assert.equal(runGate(null).allowed, false, "sin sesion no entra");
  assert.equal(runGate(STUDENT("0000000")).allowed, false, "ficha inexistente no entra");
  // Vista previa local: el bypass de siempre no cambia.
  assert.equal(runGate(null, { hostname: "localhost" }).allowed, true);
});
