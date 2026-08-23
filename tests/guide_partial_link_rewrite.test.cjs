"use strict";

// Riesgo 3 (cierre 2026-08-22): auditando si existe una ruta real que evite
// guia.html -> guia_router.js se encontraron enlaces internos ROTOS dentro de
// varios partials/*-content.html (ej. href="grupo-10a-guia-02-...html", sin
// guia.html?g=). No son un bypass (ese archivo crudo no existe fuera de
// pages/guias/, solo preview local -- confirmado con `find`), pero SI son un
// enlace roto real para el aprendiz, ya que estos partials se inyectan tal
// cual (innerHTML, sin reescritura) en produccion via page_runtime_loader.js
// (rutas nuevas: guia 01-08, talleres integradores) y guide_runtime_loader.js
// (rutas redes-rap01/02/03, python). Este archivo prueba la funcion
// rewireGuideLinks agregada a AMBOS loaders: reescribe SOLO los hrefs crudos
// de guia (usando portalAuth.getGuideHref, igual que el resto del portal),
// preservando cualquier #ancla, y sin tocar anclas, URLs externas u otros
// archivos que ya estaban bien.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");

// Fixture con TODOS los casos relevantes: crudo simple, crudo+ancla, ya
// correcto (no debe duplicarse), externo, solo-ancla, y otro archivo que no
// es una guia (no debe tocarse).
const FIXTURE_HTML =
  '<nav>' +
  '<a id="crudo" href="grupo-10a-guia-02-herramientas-informaticas-digitales.html">Guia 2</a>' +
  '<a id="crudo-ancla" href="santa-barbara-10a-guia-02-redes-rap01.html#apropiacion">Redes</a>' +
  '<a id="ya-correcto" href="guia.html?g=grupo-10a-guia-03-planificar-informacion.html">Guia 3</a>' +
  '<a id="externo" href="https://www.youtube.com/watch?v=abc">Video</a>' +
  '<a id="solo-ancla" href="#glosario">Glosario</a>' +
  '<a id="index" href="index.html">Inicio</a>' +
  "</nav>";

function makeFakeContainer(rawHtml) {
  const hrefRegex = /<a\b[^>]*\bid="([^"]*)"[^>]*\bhref="([^"]*)"[^>]*>/gi;
  const anchors = [];
  let match;
  while ((match = hrefRegex.exec(rawHtml))) {
    anchors.push({ id: match[1], href: match[2] });
  }
  return {
    get innerHTML() {
      return rawHtml;
    },
    set innerHTML(value) {
      rawHtml = value;
    },
    querySelectorAll(selector) {
      if (selector !== "a[href]") return [];
      return anchors.map((entry) => ({
        getAttribute(name) { return name === "href" ? entry.href : null; },
        setAttribute(name, value) { if (name === "href") entry.href = value; },
      }));
    },
    byId(id) {
      return anchors.find((entry) => entry.id === id);
    },
  };
}

const realGetGuideHref = (fileName) => "guia.html?g=" + encodeURIComponent(fileName);

function assertRewriteResults(container) {
  assert.equal(
    container.byId("crudo").href,
    "guia.html?g=" + encodeURIComponent("grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
    "el href crudo de guia debe reescribirse con getGuideHref"
  );
  assert.equal(
    container.byId("crudo-ancla").href,
    "guia.html?g=" + encodeURIComponent("santa-barbara-10a-guia-02-redes-rap01.html") + "#apropiacion",
    "debe preservar el #ancla al reescribir"
  );
  assert.equal(
    container.byId("ya-correcto").href,
    "guia.html?g=grupo-10a-guia-03-planificar-informacion.html",
    "un href que ya usa guia.html?g= no debe tocarse ni duplicarse"
  );
  assert.equal(container.byId("externo").href, "https://www.youtube.com/watch?v=abc", "una URL externa nunca debe tocarse");
  assert.equal(container.byId("solo-ancla").href, "#glosario", "un href de solo-ancla nunca debe tocarse");
  assert.equal(container.byId("index").href, "index.html", "index.html no es una guia, no debe tocarse");
}

test("page_runtime_loader.js: rewireGuideLinks corrige los hrefs crudos tras inyectar el partial", async () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, "js", "page_runtime_loader.js"), "utf8");
  const container = makeFakeContainer(FIXTURE_HTML);
  const body = { dataset: {} };
  const document = { body, getElementById: (id) => (id === "page-root" ? container : null) };
  const context = {
    family: "test-family",
    pageFile: "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    partialPath: "partials/fixture.html",
    inst: "", grupo: "", ficha: "",
    boot: "",
  };
  const windowObj = {
    __PAGE_CONTEXT__: { key: "fixture", family: "test-family" },
    location: { pathname: "/grupo-10a-guia-02-herramientas-informaticas-digitales.html" },
    portalAuth: { getGuideHref: realGetGuideHref },
    console: { error() {} },
  };
  const sandbox = {
    window: windowObj,
    document,
    fetch: async (url) => {
      if (url === "data/page_runtime_contexts.json") return { ok: true, async json() { return { fixture: context }; } };
      if (url === "partials/fixture.html") return { ok: true, async text() { return FIXTURE_HTML; } };
      throw new Error("fetch no simulado: " + url);
    },
    console: windowObj.console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "page_runtime_loader.js" });
  await sandbox.window.__pageRuntimePromise;

  assertRewriteResults(container);
});

test("guide_runtime_loader.js: rewireGuideLinks corrige los hrefs crudos tras inyectar el partial", async () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, "js", "guide_runtime_loader.js"), "utf8");
  const container = makeFakeContainer(FIXTURE_HTML);
  const body = { dataset: {} };
  const document = { body, getElementById: (id) => (id === "guide-root" ? container : null) };
  const context = {
    key: "fixture",
    template: "redes-rap01",
    pageFile: "santa-barbara-10a-guia-02-redes-rap01.html",
    partialPath: "partials/fixture.html",
    inst: "", grupo: "", ficha: "",
  };
  const windowObj = {
    __GUIDE_CONTEXT__: { key: "fixture", template: "redes-rap01" },
    location: { pathname: "/santa-barbara-10a-guia-02-redes-rap01.html" },
    portalAuth: { getGuideHref: realGetGuideHref },
    console: { error() {} },
  };
  const sandbox = {
    window: windowObj,
    document,
    fetch: async (url) => {
      if (url === "data/guide_contexts.json") return { ok: true, async json() { return { fixture: context }; } };
      if (url === "partials/fixture.html") return { ok: true, async text() { return FIXTURE_HTML; } };
      throw new Error("fetch no simulado: " + url);
    },
    console: windowObj.console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "guide_runtime_loader.js" });
  await sandbox.window.__guideRuntimePromise;

  assertRewriteResults(container);
});

test("rewireGuideLinks se degrada sin romper nada si portalAuth.getGuideHref no esta disponible", async () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, "js", "page_runtime_loader.js"), "utf8");
  const container = makeFakeContainer(FIXTURE_HTML);
  const body = { dataset: {} };
  const document = { body, getElementById: (id) => (id === "page-root" ? container : null) };
  const context = {
    family: "test-family",
    pageFile: "x.html",
    partialPath: "partials/fixture.html",
    inst: "", grupo: "", ficha: "",
    boot: "",
  };
  const windowObj = {
    __PAGE_CONTEXT__: { key: "fixture", family: "test-family" },
    location: { pathname: "/x.html" },
    // Sin portalAuth a proposito.
    console: { error() {} },
  };
  const sandbox = {
    window: windowObj,
    document,
    fetch: async (url) => {
      if (url === "data/page_runtime_contexts.json") return { ok: true, async json() { return { fixture: context }; } };
      if (url === "partials/fixture.html") return { ok: true, async text() { return FIXTURE_HTML; } };
      throw new Error("fetch no simulado: " + url);
    },
    console: windowObj.console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "page_runtime_loader.js" });
  await sandbox.window.__pageRuntimePromise;

  // Sin portalAuth, no debe tocar nada (ni tronar): igual al comportamiento
  // previo a este cambio.
  assert.equal(container.byId("crudo").href, "grupo-10a-guia-02-herramientas-informaticas-digitales.html");
});
