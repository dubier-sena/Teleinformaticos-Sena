"use strict";

// Aviso de sincronizacion (#sena-portal-sync-banner) bajo el navbar
// (2026-09-23). Antes era position:fixed; top:0; z-index:99999 y tapaba el
// navbar entero: con el aviso visible ningun control (Guias, Etapa
// Productiva, hamburguesa...) recibia el clic. Ahora se ancla bajo la barra
// (z-index 490 < 500 del navbar) y, mientras esta visible, --navbar-height
// (espacio superior que reserva el layout) pasa a "barra + altura REAL del
// aviso". Estas pruebas ejecutan js/firebase_status_banner.js REAL sobre un
// DOM simulado con medidas controlables y un ResizeObserver falso.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");
const BANNER_SRC = fs.readFileSync(path.join(REPO_ROOT, "js", "firebase_status_banner.js"), "utf8");
const SHELL_CSS = fs.readFileSync(path.join(REPO_ROOT, "css", "shared_shell.css"), "utf8");

const LINE = 18.2; // 13px * 1.4
const PAD = 16;
const bannerHeightFor = (lines) => Math.round((lines * LINE + PAD) * 10) / 10;

function makeStyle() {
  const props = {};
  const style = {
    setProperty(name, value) { props[name] = String(value); },
    removeProperty(name) { delete props[name]; },
    getPropertyValue(name) { return props[name] || ""; },
    _props: props,
  };
  Object.defineProperty(style, "cssText", {
    set(text) {
      String(text).split(";").forEach((decl) => {
        const i = decl.indexOf(":");
        if (i < 0) return;
        const key = decl.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        style[key] = decl.slice(i + 1).trim();
      });
    },
  });
  return style;
}

function makeEnv(options = {}) {
  const withNavbar = options.withNavbar !== false;
  const state = { bannerLines: options.lines || 2, observers: [], created: 0 };
  const attrs = {};
  const banner = {
    id: "",
    style: makeStyle(),
    textContent: "",
    parentNode: null,
    offsetHeight: 0,
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] ?? null; },
    getBoundingClientRect() {
      const shown = banner.style.display === "block";
      return { top: 0, height: shown ? bannerHeightFor(state.bannerLines) : 0 };
    },
  };
  const navbar = { id: "app-navbar", getBoundingClientRect: () => ({ top: 0, height: 60 }) };
  const root = { style: makeStyle() };
  const winListeners = {};
  const timers = [];
  const document = {
    readyState: "complete",
    documentElement: root,
    body: { appendChild(node) { node.parentNode = document.body; } },
    createElement() { return banner; },
    getElementById(id) {
      if (id === "sena-portal-sync-banner") return banner.id ? banner : null;
      if (id === "app-navbar") return withNavbar ? navbar : null;
      return null;
    },
    addEventListener() {},
  };
  class FakeResizeObserver {
    constructor(cb) { this.cb = cb; this.nodes = []; this.connected = true; state.created += 1; state.observers.push(this); }
    observe(node) { this.nodes.push(node); }
    disconnect() { this.connected = false; this.nodes = []; }
  }
  const win = {
    __senaPortalSyncBannerInstalled: false,
    localStorage: { setItem() {}, getItem() { return null; } },
    addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); },
    dispatchEvent() {},
    setTimeout(fn) { timers.push(fn); },
    portalAuth: { isAdminSession: () => Boolean(options.admin) },
    fetch: options.fetch || (() => Promise.resolve({ ok: true, status: 200 })),
  };
  const navigator = { onLine: true };
  const sandbox = {
    document, window: win, navigator, console, ResizeObserver: FakeResizeObserver,
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  vm.createContext(sandbox);
  vm.runInContext(BANNER_SRC, sandbox, { filename: "firebase_status_banner.js" });
  return {
    banner, root, state, win, navigator, attrs,
    flushTimers() { while (timers.length) timers.shift()(); },
    fire(type) { (winListeners[type] || []).forEach((fn) => fn({ type })); },
    resize() { state.observers.filter((o) => o.connected).forEach((o) => o.cb([])); },
    reserved() { return root.style.getPropertyValue("--navbar-height"); },
  };
}

const px = (n) => `${Math.round(n * 10) / 10}px`;

test("visible: queda BAJO el navbar (top = altura real de la barra) y reserva barra + altura real", () => {
  const env = makeEnv({ admin: true, lines: 2 });
  env.win.portalSyncBanner.warn("Sesion admin SIN sincronizacion a la nube");
  assert.equal(env.banner.style.display, "block");
  assert.equal(env.banner.style.top, "60px", "debe colocarse bajo la barra, no en top:0");
  assert.equal(env.reserved(), px(60 + bannerHeightFor(2)));
  assert.equal(env.banner.style.opacity, "1");
});

test("capa: z-index 490 (por debajo del navbar 500), ya no 99999", () => {
  const env = makeEnv({ admin: true });
  env.win.portalSyncBanner.warn("x");
  assert.equal(env.banner.style.zIndex, "490");
  assert.doesNotMatch(BANNER_SRC, /z-index:\s*99999/);
});

test("oculto: libera el espacio (--navbar-height vuelve al valor del CSS) y desconecta el observer", () => {
  const env = makeEnv({ admin: true });
  env.win.portalSyncBanner.warn("x");
  assert.ok(env.reserved());
  env.win.portalSyncBanner.hide();
  env.flushTimers();
  assert.equal(env.banner.style.display, "none");
  assert.equal(env.reserved(), "", "no debe quedar ningun valor residual");
  assert.ok(env.state.observers.every((o) => !o.connected), "observer desconectado");
});

test("cambio de mensaje sin ocultarse: 1 -> 5 -> 2 lineas recalcula la reserva", () => {
  const env = makeEnv({ admin: true, lines: 1 });
  env.win.portalSyncBanner.warn("corto");
  assert.equal(env.reserved(), px(60 + bannerHeightFor(1)));
  env.state.bannerLines = 5; env.resize();
  assert.equal(env.reserved(), px(60 + bannerHeightFor(5)));
  env.state.bannerLines = 2; env.resize();
  assert.equal(env.reserved(), px(60 + bannerHeightFor(2)));
});

test("mostrar/ocultar muchas veces NO acumula desplazamiento ni observers", () => {
  const env = makeEnv({ admin: true, lines: 3 });
  for (let i = 0; i < 5; i++) {
    env.win.portalSyncBanner.warn("aviso " + i);
    assert.equal(env.reserved(), px(60 + bannerHeightFor(3)), `ciclo ${i}: nunca 60 + 2H`);
    env.win.portalSyncBanner.hide();
    env.flushTimers();
    assert.equal(env.reserved(), "", `ciclo ${i}: vuelve a 60`);
  }
  assert.ok(env.state.observers.filter((o) => o.connected).length === 0);
  // Mensajes seguidos sin ocultar: un solo observer vivo.
  env.win.portalSyncBanner.warn("a");
  env.win.portalSyncBanner.warn("b");
  env.win.portalSyncBanner.warn("c");
  assert.equal(env.state.observers.filter((o) => o.connected).length, 1);
});

test("aprendiz: offline -> online (x3) muestra/oculta y restaura el layout sin acumular", async () => {
  const env = makeEnv({ admin: false, lines: 4 });
  for (let i = 0; i < 3; i++) {
    env.navigator.onLine = false;
    env.fire("offline");
    assert.equal(env.banner.style.display, "block");
    assert.match(env.banner.textContent, /se siguen guardando en este equipo/, "mensaje del aprendiz intacto");
    assert.equal(env.reserved(), px(60 + bannerHeightFor(4)));
    env.navigator.onLine = true;
    env.fire("online");
    await env.win.fetch("https://firestore.googleapis.com/v1/x"); // Firestore responde bien -> markOnline
    env.flushTimers();
    assert.equal(env.banner.style.display, "none");
    assert.equal(env.reserved(), "");
  }
});

test("pagina SIN navbar: top 0 y no se reserva el hueco de una barra inexistente", () => {
  const env = makeEnv({ admin: true, withNavbar: false });
  env.win.portalSyncBanner.warn("x");
  assert.equal(env.banner.style.display, "block");
  assert.equal(env.banner.style.top, "0px");
  assert.equal(env.reserved(), "");
});

test("accesibilidad intacta: role=status, aria-live=polite, sin controles ni foco", () => {
  const env = makeEnv({ admin: true });
  env.win.portalSyncBanner.warn("x");
  assert.equal(env.attrs.role, "status");
  assert.equal(env.attrs["aria-live"], "polite");
  assert.equal(env.attrs.tabindex, undefined);
});

test("CSS: el navbar usa su altura propia (--navbar-bar-height), no el espacio total reservado", () => {
  const rule = SHELL_CSS.match(/\.app-navbar\s*\{([^}]*)\}/);
  assert.ok(rule);
  assert.match(rule[1], /height:\s*var\(--navbar-bar-height,\s*60px\)/);
  assert.doesNotMatch(rule[1], /height:\s*var\(--navbar-height/);
  // El resto del layout SIGUE usando --navbar-height (se desplaza una vez).
  assert.match(SHELL_CSS, /body\.app-shell\s*\{[^}]*padding-top:\s*var\(--navbar-height/);
});

test("la altura del aviso se MIDE: sin alturas fijas en el JS", () => {
  const presentation = BANNER_SRC.slice(BANNER_SRC.indexOf("function ensureBanner"), BANNER_SRC.indexOf("function emitStatus"));
  assert.doesNotMatch(presentation, /\b(34|52|70|88|107)(\.\d+)?px/);
  assert.match(presentation, /getBoundingClientRect\(\)\.height/);
  assert.match(presentation, /ResizeObserver/);
});
