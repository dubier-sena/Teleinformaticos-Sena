const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Material de apoyo (auditoria 2026-10-22). En las 18 paginas de Redes los
// botones "MATERIAL DE APOYO INTERACTIVO" no abrian nada: interactive_help.js
// solo venia embebido en el partial de RAP01 y guide_runtime_loader.js no
// ejecuta <script> inyectados. Las tarjetas de "Material de Apoyo" tampoco
// enlazaban (file: ""). Estas pruebas fijan la correccion.

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function loadRouteMap() {
  const ctx = { window: { location: { search: "", pathname: "/guia.html", href: "" } }, document: { readyState: "complete", addEventListener() {}, querySelector: () => null, getElementById: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }), head: { appendChild() {} }, body: { appendChild() {} } } };
  const src = read("js/guia_router.js").replace(/^﻿/, "");
  const start = src.indexOf("const routeMap = {");
  let depth = 0, i = src.indexOf("{", start);
  const open = i;
  for (; i < src.length; i++) { if (src[i] === "{") depth++; else if (src[i] === "}") { depth--; if (!depth) break; } }
  return vm.runInNewContext("(" + src.slice(open, i + 1) + ")", ctx);
}

function loadCatalog() {
  const sandbox = { window: {} };
  vm.runInNewContext(read("data/guide_support_materials.js"), sandbox);
  return sandbox.window.__GUIDE_SUPPORT_MATERIALS__;
}

test("las 18 rutas de Redes cargan el componente de ayuda y el material antes del loader", () => {
  const routes = Object.values(loadRouteMap()).filter((r) => /^guia-redes-rap0[123]$/.test(r.template || ""));
  assert.equal(routes.length, 18);
  for (const r of routes) {
    const names = r.scripts.map((s) => s.split("?")[0]);
    const loader = names.indexOf("js/guide_runtime_loader.js");
    assert.ok(loader > 0, r.pageFile);
    for (const dep of ["js/interactive_help.js", "data/guide_support_materials.js", "js/guide_support_materials.js"]) {
      const at = names.indexOf(dep);
      assert.ok(at !== -1 && at < loader, `${r.pageFile}: falta ${dep} antes del loader`);
    }
  }
});

test("el loader monta el material y interactive_help enlaza su CSS si falta", () => {
  assert.match(read("js/guide_runtime_loader.js"), /GuideSupportMaterials\.mount\(root, context\)/);
  const ih = read("js/interactive_help.js");
  assert.match(ih, /function ensureStyles\(\)/);
  assert.match(ih, /css\/interactive_help\.css/);
  assert.ok(fs.existsSync(path.join(ROOT, "css/interactive_help.css")));
});

test("catalogo: cada recurso tiene driveId y audiencia valida; lo de grado 11 solo va a 3168850/3168852", () => {
  const cat = loadCatalog();
  const templates = Object.keys(cat.templates).sort();
  assert.deepEqual(templates, ["guia-redes-rap01", "guia-redes-rap02", "guia-redes-rap03"]);
  let total = 0;
  for (const groups of Object.values(cat.templates)) {
    for (const g of groups) {
      for (const it of g.items) {
        total++;
        assert.match(it.driveId, /^[A-Za-z0-9_-]{25,}$/, it.title);
        assert.ok(it.title && it.file && it.type, it.file);
        if (it.audience !== "all") assert.equal(JSON.stringify(it.audience), '["3168850","3168852"]', it.file);
      }
    }
  }
  assert.equal(total, 33);
});

test("modulo: filtra por ficha y no duplica al montarse dos veces", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read("data/guide_support_materials.js"), sandbox);
  vm.runInNewContext(read("js/guide_support_materials.js"), sandbox);
  const api = sandbox.window.GuideSupportMaterials;
  const count = (ficha) => api.groupsFor("guia-redes-rap01", ficha).reduce((n, g) => n + g.items.length, 0);
  // 2026-10-28: 2 recursos de RAP01 (Cisco NetAcad) quedan retenidos por derechos (rightsPending).
  assert.equal(count("3168850"), 10);
  assert.equal(count("3441944"), 8);
  assert.equal(count("3441939"), 8);
  assert.equal(api.groupsFor("guia-inexistente", "3168850").length, 0);
  assert.match(api.driveViewUrl("abc"), /^https:\/\/drive\.google\.com\/file\/d\/abc\/view/);
});

test("tarjetas de Redes RAP01: las que tienen recurso enlazan; las demas muestran aviso", () => {
  const src = read("js/script_guia_redes.js");
  assert.match(src, /item\.url\s*\n?\s*\?\s*`<a href="\$\{escapeHtml\(item\.url\)\}"/);
  const block = src.slice(src.indexOf("const supportTemplates"), src.indexOf("// State management"));
  const items = block.match(/\{ icon:[^\n]+\}/g);
  assert.equal(items.length, 7);
  for (const it of items) assert.ok(/url: "https:\/\//.test(it) || /pending: "/.test(it), it.slice(0, 80));
});

test("no quedan enlaces muertos conocidos (Docs eliminados de Induccion, carpeta de instaladores)", () => {
  const dead = ["1tlGEMI0evB-dkiQeZpCRDZdDWnUzGBxR", "1mJ78PmBkFpqjV4vc0EN1n3i8T_g8CM02", "16n9gIdIyYwszyx_REUbHzHzFzgXqy3sQ", "19AY6LsSHM--2VVXp4_Bzzjz2SVyAiSMc"];
  const files = [];
  for (const dir of ["js", "partials", "pages/guias", "pages/auxiliares", "data"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/\.(js|html|json)$/.test(f)) files.push(path.join(dir, f));
  }
  for (const f of files) {
    const s = read(f);
    for (const id of dead) assert.ok(!s.includes(id), `${f} aun referencia ${id}`);
  }
});

test("material de terceros sin derechos verificados (rightsPending) no se muestra en ninguna ficha", () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read("data/guide_support_materials.js"), sandbox);
  vm.runInNewContext(read("js/guide_support_materials.js"), sandbox);
  const cat = sandbox.window.__GUIDE_SUPPORT_MATERIALS__;
  const pending = [];
  for (const groups of Object.values(cat.templates)) for (const g of groups) for (const it of g.items) if (it.rightsPending) pending.push(it.file);
  assert.deepEqual(pending.sort(), ["4.1.1.2 Packet Tracer - Connecting to a Web Server.pka", "DireccionamientoIP.pdf", "Dispositivos.pptx", "Las redes en nuestra vida.pptx"]);
  const api = sandbox.window.GuideSupportMaterials;
  for (const t of Object.keys(cat.templates)) for (const f of ["3168850", "3168852", "3441939", "3441942", "3441944", "3441950"]) {
    const shown = api.groupsFor(t, f).flatMap((g) => g.items.map((i) => i.file));
    for (const p of pending) assert.ok(!shown.includes(p), t + " " + f + " muestra " + p);
  }
});
