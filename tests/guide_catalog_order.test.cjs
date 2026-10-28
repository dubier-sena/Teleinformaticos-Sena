const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Catalogo de presentacion, orden global y metadatos academicos (2026-10-22).
// Orden aprobado: guias numeradas en orden NUMERICO -> Taller Integrador ->
// Practica de Python. Solo presentacion: FICHA_MAP, archivos y stateKey no cambian.

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

function loadAuth() {
  const store = {};
  const w = { location: { protocol: "http:", hostname: "test", href: "", pathname: "/" }, addEventListener() {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, crypto: { subtle: {} } };
  w.window = w;
  const ctx = Object.assign(w, { console, document: { addEventListener() {}, readyState: "complete", querySelector: () => null, getElementById: () => null }, setTimeout, clearTimeout, TextEncoder, URLSearchParams });
  try { vm.runInNewContext(read("js/portal_auth.js"), ctx); } catch (e) { /* el resto de efectos de arranque no importa aqui */ }
  return w.portalAuth;
}

function loadDeclarations() {
  const regs = [];
  const c = { window: { ActivityStandard: { registerGuide: (r) => regs.push(r) } } };
  c.ActivityStandard = c.window.ActivityStandard;
  vm.runInNewContext(read("js/guide_declarations.js"), c);
  const byFile = {};
  regs.forEach((r) => r.files.forEach((f) => { byFile[f] = r; }));
  return byFile;
}

const auth = loadAuth();
const decl = loadDeclarations();
const FICHAS = ["3441939", "3441942", "3441944", "3441950", "3168850", "3168852"];

test("orden global por ficha: numeradas ascendentes, luego Taller, al final Python", () => {
  for (const ficha of FICHAS) {
    const files = Array.from(auth.getGuidesForFicha(ficha));
    const kinds = files.map((f) => auth.getGuideKind(f));
    assert.equal(kinds[kinds.length - 1], "python", ficha);
    assert.equal(kinds[kinds.length - 2], "taller", ficha);
    const nums = files.filter((f) => auth.getGuideKind(f) === "numbered").map((f) => auth.getGuideNumber(f));
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b), `${ficha}: ${nums}`);
    assert.equal(new Set(files).size, files.length, `${ficha}: guia duplicada`);
    assert.equal(files.length, auth.FICHA_MAP[ficha].guias.length, `${ficha}: el orden no debe agregar ni quitar guias`);
  }
});

test("numeracion exacta por ficha (sin inventar una Guia 9 en Kennedy)", () => {
  const nums = (ficha) => Array.from(auth.getGuidesForFicha(ficha)).map((f) => auth.getGuideNumber(f)).filter((n) => n != null);
  for (const f of ["3441939", "3441942"]) assert.ok(!nums(f).includes(9), "Kennedy no tiene Guia 9");
  for (const f of ["3168850", "3168852"]) assert.deepEqual(nums(f), [5, 6, 7, 8, 9, 10, 11]);
  assert.equal(auth.sortGuidesForDisplay(["x-guia-10.html", "x-guia-2.html"]).length, 2, "lo desconocido no desaparece");
});

test("orden numerico, no alfabetico: Guia 10 va despues de Guia 2", () => {
  const files = Array.from(auth.getGuidesForFicha("3441939"));
  const pos = (n) => files.findIndex((f) => auth.getGuideNumber(f) === n);
  assert.ok(pos(2) < pos(10) && pos(6) < pos(10) && pos(10) < pos(11) && pos(11) < pos(12));
});

test("nombres cortos del catalogo y etiquetas sin numero para Taller y Python", () => {
  assert.equal(auth.getGuideDisplayLabel("grupo-10a-guia-03-planificar-informacion.html"), "Guía 3 — Implementar componentes");
  assert.equal(auth.getGuideDisplayLabel("grupo-11a-guia-05-herramientas-informaticas-digitales.html"), "Guía 5 — Caracterizar herramientas informáticas");
  assert.equal(auth.getGuideDisplayLabel("grupo-10a-guia-06-mantener-equipos.html"), "Guía 6 — Preparar mantenimiento");
  assert.equal(auth.getGuideDisplayLabel("grupo-11b-guia-09-redes-rap01.html"), "Guía 9 — Definir parámetros de red");
  assert.equal(auth.getGuideDisplayLabel("grupo-11a-guia-09-taller-integrador.html"), "Taller Integrador");
  assert.equal(auth.getGuideNumber("grupo-11a-guia-09-taller-integrador.html"), null);
  assert.equal(auth.getGuideDisplayLabel("santa-barbara-guia-python.html"), "Práctica de Python");
});

test("metadatos segun el Diseno Curricular 233108", () => {
  const ind = decl["grupo-10a-guia-01-induccion.html"];
  assert.match(ind.competencia, /^240201530 /);
  assert.match(ind.resultado, /dinamica organizacional del SENA/);
  for (const f of ["grupo-10a-guia-02-herramientas-informaticas-digitales.html", "grupo-11b-guia-05-herramientas-informaticas-digitales.html"]) {
    assert.match(decl[f].competencia, /^220501121 - Operar herramientas informaticas y digitales/);
    assert.match(decl[f].resultado, /^RAP 01 - Caracterizar herramientas informaticas/);
  }
  assert.doesNotMatch(decl["santa-barbara-guia-python.html"].competencia, /220501121/);
  assert.doesNotMatch(read("js/guide_declarations.js"), /Procesar la informacion/);
});

test("Santa Barbara 10: ninguna guia presenta 220501121; grado 11: ninguna guia de mantenimiento", () => {
  for (const ficha of ["3441944", "3441950"]) {
    for (const f of auth.getGuidesForFicha(ficha)) {
      assert.ok(decl[f], f);
      assert.doesNotMatch(decl[f].competencia, /220501121/, `${ficha} ${f}`);
    }
  }
  for (const ficha of ["3168850", "3168852"]) {
    for (const f of auth.getGuidesForFicha(ficha)) assert.doesNotMatch(String(decl[f] && decl[f].competencia), /220501001/, `${ficha} ${f}`);
  }
});

// stateKey de las guias existentes al 2026-10-22 (identicos a origin/main 29ef173).
// Cambiar uno desvincula el avance guardado de los aprendices.
const PINNED_STATE_KEYS = {
  "grupo-10a-guia-01-induccion.html": "10a_guia",
  "grupo-10b-guia-01-induccion.html": "10a_guia",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "guia_interactiva_10a_guia2_html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "guia_interactiva_10a_guia2_html",
  "grupo-10a-guia-03-planificar-informacion.html": "guia_interactiva_10a_guia3_html",
  "grupo-10b-guia-03-planificar-informacion.html": "guia_interactiva_10a_guia3_html",
  "grupo-10a-guia-04-taller-integrador.html": "guia_interactiva_10a_guia4_html",
  "grupo-10b-guia-04-taller-integrador.html": "guia_interactiva_10a_guia4_html",
  "santa-barbara-10a-guia-04-taller-integrador.html": "guia_interactiva_sb_10a_guia4_html",
  "santa-barbara-10b-guia-04-taller-integrador.html": "guia_interactiva_sb_10a_guia4_html",
  "grupo-11a-guia-09-taller-integrador.html": "guia_interactiva_11a_guia9_html",
  "grupo-11b-guia-09-taller-integrador.html": "guia_interactiva_11a_guia9_html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "guia_interactiva_11a_guia_html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia_interactiva_11a_guia_html",
  "grupo-11a-guia-06-planificar-informacion.html": "guia_interactiva_11a_guia6_html",
  "grupo-11b-guia-06-planificar-informacion.html": "guia_interactiva_11a_guia6_html",
  "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "guia_interactiva_11a_guia7_html",
  "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia_interactiva_11a_guia7_html",
  "grupo-11a-guia-08-documentar-gestion-informacion.html": "guia_interactiva_11a_guia8_html",
  "grupo-11b-guia-08-documentar-gestion-informacion.html": "guia_interactiva_11a_guia8_html",
  "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html": "guia_interactiva_10a_guia4ciber_html",
  "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html": "guia_interactiva_10a_guia4ciber_html",
  "grupo-10a-guia-05-documentar-gestion-informacion.html": "guia_interactiva_10a_guia5doc_html",
  "grupo-10b-guia-05-documentar-gestion-informacion.html": "guia_interactiva_10a_guia5doc_html",
  "grupo-10a-guia-06-mantener-equipos.html": "guia_interactiva_10a_guia6mant_html",
  "grupo-10b-guia-06-mantener-equipos.html": "guia_interactiva_10a_guia6mant_html",
  "santa-barbara-10a-guia-02-redes-rap01.html": "guia_interactiva_santa_barbara_10a_guia_02_redes_rap01_html",
  "santa-barbara-10b-guia-02-redes-rap01.html": "guia_interactiva_santa_barbara_10a_guia_02_redes_rap01_html",
  "santa-barbara-10a-guia-03-redes-rap02.html": "guia_interactiva_santa_barbara_10a_guia_03_redes_rap02_html",
  "santa-barbara-10b-guia-03-redes-rap02.html": "guia_interactiva_santa_barbara_10a_guia_03_redes_rap02_html",
  "santa-barbara-10a-guia-04-redes-rap03.html": "guia_interactiva_santa_barbara_10a_guia_04_redes_rap03_html",
  "santa-barbara-10b-guia-04-redes-rap03.html": "guia_interactiva_santa_barbara_10a_guia_04_redes_rap03_html",
  "grupo-10a-guia-10-redes-rap01.html": "guia_interactiva_grupo_10a_guia_10_redes_rap01_html",
  "grupo-10b-guia-10-redes-rap01.html": "guia_interactiva_grupo_10a_guia_10_redes_rap01_html",
  "grupo-10a-guia-11-redes-rap02.html": "guia_interactiva_grupo_10a_guia_11_redes_rap02_html",
  "grupo-10b-guia-11-redes-rap02.html": "guia_interactiva_grupo_10a_guia_11_redes_rap02_html",
  "grupo-10a-guia-12-redes-rap03.html": "guia_interactiva_grupo_10a_guia_12_redes_rap03_html",
  "grupo-10b-guia-12-redes-rap03.html": "guia_interactiva_grupo_10a_guia_12_redes_rap03_html",
  "santa-barbara-guia-python.html": "guia_interactiva_santa_barbara_guia_python_html",
  "grupo-11a-guia-09-redes-rap01.html": "guia_interactiva_sb_11a_guia09_redes_rap01",
  "grupo-11b-guia-09-redes-rap01.html": "guia_interactiva_sb_11a_guia09_redes_rap01",
  "grupo-11a-guia-10-redes-rap02.html": "guia_interactiva_sb_11a_guia10_redes_rap02",
  "grupo-11b-guia-10-redes-rap02.html": "guia_interactiva_sb_11a_guia10_redes_rap02",
  "grupo-11a-guia-11-redes-rap03.html": "guia_interactiva_sb_11a_guia11_redes_rap03",
  "grupo-11b-guia-11-redes-rap03.html": "guia_interactiva_sb_11a_guia11_redes_rap03"
};

test("stateKey historicos intactos", () => {
  for (const [file, key] of Object.entries(PINNED_STATE_KEYS)) {
    assert.ok(decl[file], `${file} desaparecio del registro`);
    assert.equal(decl[file].stateKey, key, file);
  }
});
