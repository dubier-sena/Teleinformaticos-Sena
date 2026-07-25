"use strict";
// Taller Integrador (Santa Barbara grado 11) — verifica de forma estatica que
// TODAS las piezas del registro quedaron consistentes entre si (partial <->
// guide_declarations <-> script generalizado <-> portal_auth <-> router <->
// page_runtime_contexts <-> activity_grades). Mismo patron que
// tests/guia8_documentar_registration.test.cjs, adaptado a una guia tipo
// "taller" (actividades type:"file" con driveTarget en vez de formFields) que
// ademas REUTILIZA js/script_taller_integrador.js (generalizado por
// GUIDE_DATA_FILE) en vez de tener su propio script_guiaN.js dedicado.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "grupo-11a-guia-09-taller-integrador.html",
  "grupo-11b-guia-09-taller-integrador.html",
];
const PARTIAL = "partials/taller-integrador-sb11-content.html";
const BUNDLE = "partials/taller-integrador-sb11-bundle.js";
const SCRIPT = "js/script_taller_integrador.js";

function read(rel) {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}

function loadDeclarations() {
  const guides = [];
  const ctx = {
    window: {},
    ActivityStandard: { registerGuide: (c) => guides.push(c) },
    console,
  };
  ctx.window.ActivityStandard = ctx.ActivityStandard;
  vm.createContext(ctx);
  vm.runInContext(read("js/guide_declarations.js"), ctx);
  const byFile = {};
  guides.forEach((g) => (g.files || []).forEach((f) => { byFile[f] = g; }));
  return byFile;
}

const partialHtml = read(PARTIAL);
const scriptSrc = read(SCRIPT);
const guide = loadDeclarations()[FILES[0]];
// guide.activities fue creado dentro del contexto vm (otro "realm"): copiarlo
// con Array.from ANTES de filter/map evita que assert.deepEqual falle mas
// abajo con "same structure but not reference-equal" (arrays de dos realms
// distintos, aunque su contenido sea identico).
const fileActivities = Array.from(guide.activities).filter((a) => a.type === "file");

test("Taller SB11: declarado en guide_declarations para 11A y 11B", () => {
  assert.ok(guide, "falta el registro en guide_declarations.js");
  assert.deepEqual(Array.from(guide.files).sort(), FILES.slice().sort());
  assert.equal(guide.guideNumber, "9");
  assert.equal(guide.stateKey, "guia_interactiva_11a_guia9_html");
  assert.equal(guide.activities.length, 5, "debe tener equipoTaller + 4 productos");
  assert.equal(fileActivities.length, 4, "debe tener 4 productos tipo file");
});

test("Taller SB11: cada actividad tipo file tiene driveTarget y mount de entrega en el partial", () => {
  fileActivities.forEach((a) => {
    assert.ok(a.driveTarget, `actividad ${a.id} deberia tener driveTarget`);
    assert.match(
      partialHtml,
      new RegExp(`data-act-std-delivery="${a.id}"`),
      `falta el mount data-act-std-delivery="${a.id}" en el partial`
    );
  });
});

test("Taller SB11: la actividad 0 (equipoTaller) tiene su boton, status y data-store en el partial", () => {
  const equipo = guide.activities.find((a) => a.id === "equipoTaller");
  assert.ok(equipo, "falta la actividad equipoTaller");
  assert.equal(equipo.type, "form");
  assert.match(partialHtml, /id="btnGuardarEquipoTaller"/);
  assert.match(partialHtml, /id="statusEquipoTaller"/);
  assert.match(partialHtml, /data-store="equipoTaller"/);
  assert.match(partialHtml, /actStd_save_equipoTaller\(\)/);
});

test("Taller SB11: GUIDE_PROGRESS_CONFIG usa el stateKey y activityTotal correctos (4 productos, sin contar equipoTaller)", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    const block = auth.match(new RegExp(`"${file}":\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(block, `falta ${file} en GUIDE_PROGRESS_CONFIG`);
    assert.match(block[1], /mode:\s*"state-with-activity"/);
    assert.match(block[1], new RegExp(`activityTotal:\\s*${fileActivities.length}\\b`));
    const grupo = file.includes("-11a-") ? "11a" : "11b";
    assert.match(block[1], new RegExp(`stateKey:\\s*"guia_interactiva_${grupo}_guia9_html"`));
  });
});

test("Taller SB11: asignada a las fichas Santa Barbara 11A/11B con titulo Taller Integrador", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    assert.match(auth, new RegExp(`"${file}":\\s*\\n?\\s*"Taller Integrador`), `falta GUIDE_TITLES de ${file}`);
  });
  const ficha50 = auth.match(/"3168850":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  const ficha52 = auth.match(/"3168852":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  assert.ok(ficha50 && ficha50[1].includes(FILES[0]), "la ficha 3168850 (11A) no incluye el taller");
  assert.ok(ficha52 && ficha52[1].includes(FILES[1]), "la ficha 3168852 (11B) no incluye el taller");
});

test("Taller SB11: router y contexts apuntan al script generalizado, bundle y boot correctos", () => {
  const router = read("js/guia_router.js");
  assert.match(router, /"11a-guia-9":/);
  assert.match(router, /"11b-guia-9":/);
  assert.match(router, /js\/script_taller_integrador\.js/);
  const contexts = JSON.parse(read("data/page_runtime_contexts.json"));
  ["sb-guia9-11a", "sb-guia9-11b"].forEach((key) => {
    const ctx = contexts[key];
    assert.ok(ctx, `falta ${key} en page_runtime_contexts.json`);
    assert.equal(ctx.partialPath, PARTIAL);
    assert.equal(ctx.boot, "initTallerIntegrador");
    assert.equal(ctx.family, "taller-integrador-sb11");
  });
  assert.equal(contexts["sb-guia9-11a"].ficha, "3168850");
  assert.equal(contexts["sb-guia9-11b"].ficha, "3168852");
  const bundle = read(BUNDLE);
  assert.ok(bundle.includes(BUNDLE.split("/")[1].replace("-bundle.js", "-content.html")) || bundle.includes(PARTIAL), "el bundle no referencia el content.html actual");
  const ctxBundle = read("data/page_runtime_contexts_bundle.js");
  assert.ok(ctxBundle.includes("sb-guia9-11a") && ctxBundle.includes("sb-guia9-11b"), "regenera data/page_runtime_contexts_bundle.js desde el JSON");
  Object.keys(contexts).forEach((key) => {
    assert.ok(ctxBundle.includes(`"${key}"`), `el bundle de contexts perdio la clave ${key}`);
  });
});

test("Taller SB11: activity_grades.js tiene el catalogo y el mapeo de archivo->familia", () => {
  const grades = read("js/activity_grades.js");
  assert.match(grades, /"taller-integrador-sb11":\s*\{/);
  FILES.forEach((file) => {
    assert.match(grades, new RegExp(`"${file}":\\s*"taller-integrador-sb11"`), `falta el mapeo de ${file} en activity_grades.js`);
  });
  guide.activities.forEach((a) => {
    assert.match(grades, new RegExp(`id:\\s*"${a.id}"`), `falta la actividad ${a.id} en el catalogo de activity_grades.js`);
  });
});

test("Taller SB11: script_taller_integrador.js tiene el alias y la lista de productos de esta variante", () => {
  assert.match(scriptSrc, /"grupo-11a-guia-09-taller-integrador\.html":\s*"11a_guia9\.html"/);
  assert.match(scriptSrc, /"grupo-11b-guia-09-taller-integrador\.html":\s*"11b_guia9\.html"/);
  const m = scriptSrc.match(/"11a_guia9\.html":\s*\[([^\]]*)\]/);
  assert.ok(m, "falta la entrada 11a_guia9.html en ACTIVITY_IDS_BY_FILE");
  const scriptIds = Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]);
  const declaredIds = fileActivities.map((a) => a.id);
  assert.deepEqual(scriptIds, declaredIds, "ACTIVITY_IDS_BY_FILE de 11a_guia9.html no coincide con los productos declarados");
});

test("Taller SB11: admin_habilitacion.js y firebase_db.js conocen el alias de storage", () => {
  const admin = read("js/admin_habilitacion.js");
  const fb = read("js/firebase_db.js");
  FILES.forEach((file) => {
    assert.match(admin, new RegExp(`"${file}":\\s*"11[ab]_guia9\\.html"`), `falta el alias de ${file} en admin_habilitacion.js`);
    assert.match(fb, new RegExp(`"${file}":\\s*"11[ab]_guia9\\.html"`), `falta el alias de ${file} en firebase_db.js (guideDataFileName)`);
  });
  assert.match(fb, /"11a_guia9\.html",\s*\n\s*"11b_guia9\.html",/, "faltan los alias en getKnownStudentGuideStateFiles()");
});
