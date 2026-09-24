"use strict";

// Navbar global en modo compacto segun el contenido (2026-09-23). La barra de
// escritorio es una fila rigida; cuando su contenido real no cabe en el ancho
// disponible, shared_shell.js activa .app-navbar--compact (mismo diseno que el
// movil). Estas pruebas ejecutan shared_shell.js REAL sobre un DOM minimo con
// anchos simulados y observadores falsos que se disparan a mano. No fijan
// anchos "de negocio": comprueban "cabe -> escritorio / no cabe -> compacto".

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createDocument, MiniElement } = require("./_mini_dom.cjs");

const REPO_ROOT = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_shell.js"), "utf8");
const portalAuth = fs.readFileSync(path.join(REPO_ROOT, "js", "portal_auth.js"), "utf8");
const css = fs.readFileSync(path.join(REPO_ROOT, "css", "shared_shell.css"), "utf8");

// Ancho simulado: el asignado al elemento, o 0 si el o un ancestro esta oculto.
function renderedWidth(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
    if (n.hidden || (n.style && n.style.display === "none")) return 0;
  }
  return el.__w || 0;
}

function makeStorage() {
  const data = {};
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

function boot(session, opts = {}) {
  const document = createDocument();
  const frames = [];
  const counts = { ro: 0, mo: 0 };
  const observers = { ro: [], mo: [] };
  const ctx = {
    document, console, setTimeout, clearTimeout, URLSearchParams,
    localStorage: makeStorage(), sessionStorage: makeStorage(),
    location: { protocol: "https:", hostname: "x", pathname: "/index.html", href: "https://x/index.html", search: "" },
    navigator: {},
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    matchMedia: () => ({ matches: !!ctx.__mobile, addEventListener() {} }),
    ResizeObserver: class { constructor(cb) { counts.ro += 1; observers.ro.push(cb); } observe() {} disconnect() {} },
    MutationObserver: class { constructor(cb) { counts.mo += 1; observers.mo.push(cb); } observe() {} disconnect() {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(portalAuth, ctx);
  ctx.portalAuth.getCurrentSession = () => session;
  const proto = MiniElement.prototype;
  const prev = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function () { return { width: renderedWidth(this), height: 0, left: 0, top: 0, right: 0, bottom: 0 }; };
  if (opts.beforeShell) opts.beforeShell(ctx);
  vm.runInContext(shell, ctx);
  const nav = document.getElementById("app-navbar");
  const q = (s) => nav.querySelector(s);
  const inner = q(".app-navbar__inner");
  // Anchos del estado escritorio (valores representativos, no reglas).
  q(".app-navbar__logo").__w = 238;
  q(".app-navbar__end").__w = opts.chip || 119;
  document.getElementById("app-navbar-links").children.forEach((c) => { c.__w = 126; });
  const flush = () => { while (frames.length) frames.shift()(); };
  const env = {
    ctx, document, nav, inner, counts, observers,
    compact: () => nav.classList.contains("app-navbar--compact"),
    required: () => renderedWidth(q(".app-navbar__logo")) + renderedWidth(q(".app-navbar__end")) + document.getElementById("app-navbar-links").children.reduce((a, c) => a + renderedWidth(c), 0),
    setAvailable(w) { inner.clientWidth = w; observers.ro.forEach((cb) => cb([])); flush(); },
    restore() { proto.getBoundingClientRect = prev; },
  };
  return env;
}

const ADMIN = { role: "admin", user: { username: "dubier", usernameKey: "dubier" } };
const STUDENT = { role: "student", user: { ficha: "3168850", usernameKey: "prueba", fullName: "Aprendiz Prueba" } };

test("no cabe -> compacto; cabe -> escritorio (instructor)", () => {
  const env = boot(ADMIN);
  try {
    const need = env.required();
    env.setAvailable(need - 1);
    assert.equal(env.compact(), true, "si el contenido no cabe debe pasar a compacto");
    env.setAvailable(need + 200);
    assert.equal(env.compact(), false, "con espacio de sobra vuelve a escritorio");
  } finally { env.restore(); }
});

test("histeresis: no alterna alrededor del umbral", () => {
  const env = boot(ADMIN);
  try {
    const need = env.required();
    env.setAvailable(need - 1);
    assert.equal(env.compact(), true);
    env.setAvailable(need + 1); // cabe por poco: sigue compacto (margen de salida)
    assert.equal(env.compact(), true);
    env.setAvailable(need + 4);
    assert.equal(env.compact(), false);
    env.setAvailable(need); // cabe exacto desde escritorio: sigue escritorio
    assert.equal(env.compact(), false);
    for (let i = 0; i < 20; i++) { env.setAvailable(need - 1); env.setAvailable(need - 2); }
    assert.equal(env.compact(), true);
  } finally { env.restore(); }
});

test("el aprendiz (menos enlaces) cabe donde el instructor no", () => {
  const admin = boot(ADMIN);
  const student = boot(STUDENT);
  try {
    const available = Math.floor((admin.required() + student.required()) / 2);
    admin.setAvailable(available);
    student.setAvailable(available);
    assert.ok(student.required() < admin.required());
    assert.equal(admin.compact(), true, "instructor: compacto");
    assert.equal(student.compact(), false, "aprendiz: escritorio");
  } finally { admin.restore(); student.restore(); }
});

test("<=768 (matchMedia) siempre compacto, aunque quepa", () => {
  const env = boot(STUDENT);
  try {
    env.ctx.__mobile = true;
    env.setAvailable(5000);
    assert.equal(env.compact(), true);
  } finally { env.restore(); }
});

test("un nombre mas largo en el chip recalcula (MutationObserver) y puede activar compacto", () => {
  const env = boot(ADMIN);
  try {
    env.setAvailable(env.required() + 10);
    assert.equal(env.compact(), false);
    env.nav.querySelector(".app-navbar__end").__w += 80; // chip mas ancho
    env.observers.mo.forEach((cb) => cb([]));
    env.setAvailable(env.inner.clientWidth); // mismo ancho, nueva medida
    assert.equal(env.compact(), true);
  } finally { env.restore(); }
});

test("volver a escritorio cierra el menu desplegable del modo compacto", () => {
  const env = boot(ADMIN);
  try {
    env.setAvailable(env.required() - 50);
    const links = env.document.getElementById("app-navbar-links");
    const burger = env.document.getElementById("app-navbar-hamburger");
    links.classList.add("is-open"); burger.setAttribute("aria-expanded", "true");
    env.setAvailable(env.required() + 300);
    assert.equal(links.classList.contains("is-open"), false);
    assert.equal(burger.getAttribute("aria-expanded"), "false");
  } finally { env.restore(); }
});

test("identidad dentro del menu: misma del chip, visible y no interactiva", () => {
  for (const [session, role, name] of [[ADMIN, "Admin", "dubier"], [STUDENT, "Aprendiz", "Aprendiz Prueba"]]) {
    const env = boot(session);
    try {
      const menuUser = env.document.getElementById("app-navbar-menu-user");
      assert.ok(menuUser && !menuUser.hidden);
      assert.equal(menuUser.tagName, "P");
      assert.equal(menuUser.querySelectorAll("a,button,input,[tabindex]").length, 0);
      assert.equal(env.document.getElementById("app-navbar-menu-role").textContent, role);
      assert.equal(env.document.getElementById("app-navbar-menu-username").textContent, name);
      assert.equal(env.document.getElementById("app-navbar-username").textContent, name, "misma fuente que el chip");
    } finally { env.restore(); }
  }
});

test("Panel Admin: accesible para instructor, oculto para aprendiz (sin cambiar permisos)", () => {
  const admin = boot(ADMIN), student = boot(STUDENT);
  try {
    assert.equal(admin.document.querySelector('[data-nav-key="panel"]').style.display, "");
    assert.equal(student.document.querySelector('[data-nav-key="panel"]').style.display, "none");
  } finally { admin.restore(); student.restore(); }
});

test("recalcular muchas veces no duplica nada ni crea observadores extra", () => {
  const env = boot(ADMIN);
  try {
    for (let i = 0; i < 25; i++) env.setAvailable(i % 2 ? 700 : 2000);
    assert.equal(env.document.querySelectorAll("#app-navbar-menu-user").length, 1);
    assert.equal(env.document.querySelectorAll("#app-navbar-hamburger").length, 1);
    assert.equal(env.document.querySelectorAll("#app-navbar").length, 1);
    assert.equal(env.counts.ro, 1);
    assert.equal(env.counts.mo, 1);
  } finally { env.restore(); }
});

// ── CSS ──
function blockBody(source, startIdx) {
  let i = source.indexOf("{", startIdx) + 1, depth = 1;
  const from = i;
  while (depth) { if (source[i] === "{") depth += 1; else if (source[i] === "}") depth -= 1; i += 1; }
  return source.slice(from, i - 1);
}
function rules(text) {
  const out = [];
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    out.push({ sel: m[1].split(",").map((s) => s.trim().replace(/\s+/g, " ")), decl: m[2].split(";").map((d) => d.trim().replace(/\s+/g, " ")).filter(Boolean) });
  }
  return out;
}

test("CSS: el bloque @media (max-width: 768px) sigue existiendo (garantia sin JS)", () => {
  const idx = css.indexOf("@media (max-width: 768px)");
  assert.ok(idx > 0);
  const body = blockBody(css, idx);
  assert.match(body, /\.app-navbar__hamburger\s*\{\s*display:\s*flex/);
  assert.match(body, /\.app-navbar__user\s*\{\s*display:\s*none/);
});

test("CSS: .app-navbar--compact es un espejo EXACTO del bloque movil", () => {
  const mobile = rules(blockBody(css, css.indexOf("@media (max-width: 768px)")));
  const compactText = css.slice(css.indexOf("Modo compacto por contenido"));
  const afterComment = compactText.indexOf("*/") + 2;
  const compact = rules(compactText.slice(afterComment, compactText.indexOf("@media", afterComment)));
  assert.equal(compact.length, mobile.length, "mismo numero de reglas");
  mobile.forEach((r, i) => {
    assert.deepEqual(compact[i].sel, r.sel.map((s) => ".app-navbar--compact " + s), `selectores de la regla ${i}`);
    assert.deepEqual(compact[i].decl, r.decl, `declaraciones de ${r.sel.join(",")}`);
  });
});

test("CSS: barra de 60px sin salto de linea", () => {
  const nav = css.match(/\.app-navbar\s*\{([^}]*)\}/)[1];
  assert.match(nav, /height:\s*var\(--navbar-bar-height,\s*60px\)/);
  for (const sel of [".app-navbar__inner", ".app-navbar__links"]) {
    const body = css.match(new RegExp("\\" + sel + "\\s*\\{([^}]*)\\}"))[1];
    assert.doesNotMatch(body, /flex-wrap:\s*wrap/, sel);
  }
});
