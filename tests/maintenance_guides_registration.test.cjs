const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Guias de mantenimiento 220501001 creadas el 2026-10-22 desde los PDF
// originales del instructor: Kennedy Guia 7 (RAP 02) y Guia 8 (RAP 03);
// Santa Barbara Guia 5 (RAP 01), 6 (RAP 02) y 7 (RAP 03). La Guia 6 de
// Kennedy (RAP 01) no se toca.

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const GUIDES = [
  { files: ["grupo-10a-guia-07-mantenimiento-integral.html", "grupo-10b-guia-07-mantenimiento-integral.html"], fichas: ["3441939", "3441942"], number: "7", rap: /^RAP 02 - Realizar mantenimiento integral/, partial: "partials/guia-07-mantenimiento-integral-content.html", inst: "jfk" },
  { files: ["grupo-10a-guia-08-verificar-operacion.html", "grupo-10b-guia-08-verificar-operacion.html"], fichas: ["3441939", "3441942"], number: "8", rap: /^RAP 03 - Verificar la operacion del sistema/, partial: "partials/guia-08-verificar-operacion-content.html", inst: "jfk" },
  { files: ["santa-barbara-10a-guia-05-preparar-mantenimiento.html", "santa-barbara-10b-guia-05-preparar-mantenimiento.html"], fichas: ["3441944", "3441950"], number: "5", rap: /^RAP 01 - Preparar el mantenimiento/, partial: "partials/sb10-guia-05-preparar-mantenimiento-content.html", inst: "sb" },
  { files: ["santa-barbara-10a-guia-06-mantenimiento-integral.html", "santa-barbara-10b-guia-06-mantenimiento-integral.html"], fichas: ["3441944", "3441950"], number: "6", rap: /^RAP 02 - Realizar mantenimiento integral/, partial: "partials/sb10-guia-06-mantenimiento-integral-content.html", inst: "sb" },
  { files: ["santa-barbara-10a-guia-07-verificar-operacion.html", "santa-barbara-10b-guia-07-verificar-operacion.html"], fichas: ["3441944", "3441950"], number: "7", rap: /^RAP 03 - Verificar la operacion del sistema/, partial: "partials/sb10-guia-07-verificar-operacion-content.html", inst: "sb" },
];

function loadAuth() {
  const store = {};
  const w = { location: { protocol: "http:", hostname: "test", href: "", pathname: "/" }, addEventListener() {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, crypto: { subtle: {} } };
  w.window = w;
  try { vm.runInNewContext(read("js/portal_auth.js"), Object.assign(w, { console, document: { addEventListener() {}, readyState: "complete", querySelector: () => null, getElementById: () => null }, setTimeout, clearTimeout, TextEncoder, URLSearchParams })); } catch (e) {}
  return w.portalAuth;
}

function loadDeclarations() {
  const byFile = {};
  const c = { window: { ActivityStandard: { registerGuide: (r) => r.files.forEach((f) => { byFile[f] = r; }) } } };
  c.ActivityStandard = c.window.ActivityStandard;
  vm.runInNewContext(read("js/guide_declarations.js"), c);
  return byFile;
}

const auth = loadAuth();
const decl = loadDeclarations();
const contexts = JSON.parse(read("data/page_runtime_contexts.json"));
const router = read("js/guia_router.js");

test("cada guia nueva esta solo en sus dos fichas, con su numero y RAP de 220501001", () => {
  for (const g of GUIDES) {
    g.files.forEach((file, i) => {
      for (const [ficha, info] of Object.entries(auth.FICHA_MAP)) {
        assert.equal(info.guias.includes(file), ficha === g.fichas[i], `${file} en ficha ${ficha}`);
      }
      const d = decl[file];
      assert.ok(d, `${file} sin declaracion`);
      assert.equal(d.guideNumber, g.number, file);
      assert.match(d.competencia, /^220501001 /, file);
      assert.match(d.resultado, g.rap, file);
      assert.equal(auth.getGuideNumber(file), Number(g.number), file);
      assert.ok(auth.GUIDE_PROGRESS_CONFIG[file], `${file} sin GUIDE_PROGRESS_CONFIG`);
    });
  }
});

test("rutas, contextos y paginas contenedoras de las 10 paginas", () => {
  for (const g of GUIDES) {
    g.files.forEach((file, i) => {
      assert.ok(router.includes(`pageFile: "${file}"`), `${file} sin ruta`);
      const ctx = Object.values(contexts).find((c) => c.pageFile === file);
      assert.ok(ctx, `${file} sin contexto`);
      assert.equal(ctx.ficha, g.fichas[i]);
      assert.equal(ctx.partialPath, g.partial);
      assert.equal(ctx.boot, "initGuiaMantenimiento");
      assert.ok(fs.existsSync(path.join(ROOT, "pages/guias", file)), `${file} sin pagina contenedora`);
      assert.match(read(`pages/guias/${file}`), /js\/script_guia_mantenimiento\.js\?v=/);
    });
  }
});

test("cada campo declarado existe en el partial y cada actividad tiene su boton y aviso", () => {
  for (const g of GUIDES) {
    const html = read(g.partial);
    for (const act of decl[g.files[0]].activities) {
      assert.ok(html.includes(`>${act.number}<`), `${g.partial}: falta la actividad ${act.number}`);
      for (const key of act.formFields || []) assert.ok(html.includes(`data-store="${key}"`), `${g.partial}: falta ${key}`);
      if (!(act.formFields || []).length) {
        // La aplica el instructor (IE-01 del RAP 03): sin formulario, solo su insignia de nota.
        assert.ok(html.includes(`id="${act.id}GradeMount"`), `${g.partial}: falta ${act.id}GradeMount`);
        continue;
      }
      assert.ok(html.includes(`id="${act.buttonIds.save}"`), `${g.partial}: falta ${act.buttonIds.save}`);
      assert.ok(html.includes(`id="${act.buttonIds.status}"`), `${g.partial}: falta ${act.buttonIds.status}`);
      if (act.type === "both") assert.ok(act.driveTarget && act.driveTarget.panelKey, `${act.id} sin entrega a Drive`);
    }
    assert.doesNotMatch(html, /\sstyle="/, `${g.partial} no debe agregar style inline (ratchet CSP)`);
  }
});

test("Santa Barbara no se presenta como Kennedy ni comparte identificadores de progreso", () => {
  const stateKeys = new Set();
  for (const g of GUIDES) {
    const d = decl[g.files[0]];
    assert.ok(!stateKeys.has(d.stateKey), `stateKey repetido ${d.stateKey}`);
    stateKeys.add(d.stateKey);
    if (g.inst === "sb") {
      const html = read(g.partial);
      assert.doesNotMatch(html, /Kennedy/, `${g.partial} menciona Kennedy`);
      assert.match(html, /Santa Bárbara \| Grado 10/);
      assert.match(d.stateKey, /santa_barbara/);
      assert.ok(!d.cloudFileNames, "sin alias de nube: el documento se llama como el HTML");
    }
  }
  // La Guia 6 de Kennedy conserva su stateKey y su alias.
  const g6 = decl["grupo-10a-guia-06-mantener-equipos.html"];
  assert.equal(g6.stateKey, "guia_interactiva_10a_guia6mant_html");
  assert.equal(g6.cloudFileNames["grupo-10a-guia-06-mantener-equipos.html"], "10a_guia6mant.html");
  assert.ok(!stateKeys.has(g6.stateKey));
});

test("el RAP 01 de Santa Barbara tiene exactamente las 8 actividades de la Guia 6 (mismo PDF original)", () => {
  const sb = decl["santa-barbara-10a-guia-05-preparar-mantenimiento.html"].activities.map((a) => a.number);
  const k = decl["grupo-10a-guia-06-mantener-equipos.html"].activities.map((a) => a.number);
  assert.deepEqual(sb, k);
  assert.equal(sb.length, 8);
});

test("el script de mantenimiento cubre exactamente las 10 paginas y no toca la Guia 6", () => {
  const src = read("js/script_guia_mantenimiento.js");
  const files = [...src.matchAll(/"([a-z0-9-]+\.html)": "guia-/g)].map((m) => m[1]).sort();
  assert.deepEqual(files, GUIDES.flatMap((g) => g.files).sort());
  assert.doesNotMatch(src, /guia-06-mantener-equipos\.html/);
});

test("ningun campo de registro se presenta como contenido oficial: el partial lo rotula como apoyo del portal", () => {
  for (const g of GUIDES.filter((x) => x.inst === "jfk" || x.number !== "5")) {
    assert.match(read(g.partial), /Campos de apoyo del portal para organizar tus respuestas/);
  }
});
