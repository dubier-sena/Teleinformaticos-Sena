const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

test("guia.html is the single public guide entry point", () => {
  const html = read("guia.html");

  assert.match(html, /<div id="page-root"><\/div>/);
  assert.match(html, /js\/guia_router\.js/);
  assert.doesNotMatch(html, /window\.__PAGE_CONTEXT__\s*=/);
});

test("guide router maps every current guide to its real storage and access file", () => {
  const router = read(path.join("js", "guia_router.js"));
  const expectedFiles = [
    "grupo-10a-guia-01-induccion.html",
    "grupo-10b-guia-01-induccion.html",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
    "grupo-11a-guia-06-planificar-informacion.html",
    "grupo-11b-guia-06-planificar-informacion.html",
    "santa-barbara-10a-guia-02-redes-rap01.html",
    "santa-barbara-10b-guia-02-redes-rap01.html",
  ];

  for (const fileName of expectedFiles) {
    assert.match(router, new RegExp(fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(router, /window\.__RUNTIME_PAGE_FILE__\s*=/);
  assert.match(router, /window\.__PAGE_CONTEXT__\s*=/);
  assert.match(router, /routePageFile:\s*"guia\.html"/);
});

test("runtime loaders and guide scripts honor the routed guide file", () => {
  assert.match(read(path.join("js", "page_runtime_loader.js")), /runtimeRequest\.routePageFile/);
  assert.match(read(path.join("js", "guia_template.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_induccion.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia2.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia6.js")), /__RUNTIME_PAGE_FILE__/);
  assert.match(read(path.join("js", "script_guia_redes.js")), /__RUNTIME_PAGE_FILE__/);
});

test("induction partial can run inside guia.html without global name collisions", () => {
  const partial = read(path.join("partials", "guia-01-induccion-content.html"));
  const bundle = read(path.join("partials", "guia-01-induccion-bundle.js"));

  assert.match(partial, /window\.__RUNTIME_PAGE_FILE__/);
  assert.match(partial, /induccionPortalAuth/);
  assert.doesNotMatch(partial, /\b(?:let|const)\s+portalAuth\b/);
  assert.match(bundle, /__RUNTIME_PAGE_FILE__/);
  assert.match(bundle, /induccionPortalAuth/);
});

test("shared shell can initialize after dynamic route scripts load", () => {
  const shell = read(path.join("js", "shared_shell.js"));

  assert.match(shell, /window\.initSharedShell\s*=/);
  assert.match(shell, /document\.readyState === "loading"/);
  assert.match(shell, /sharedShellBooted/);
});
