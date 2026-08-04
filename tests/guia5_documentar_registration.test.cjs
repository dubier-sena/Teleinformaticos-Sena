"use strict";
// Guia 5 (Kennedy, grado 10) — Documentar la gestion de la informacion
// (RAP 04). Mismo patron que tests/guia8_documentar_registration.test.cjs
// (guia hermana de grado 11, mismo caso Agropecuaria La Esperanza pero
// duracion propia de 48h y ficha/proyecto de Kennedy): verifica de forma
// estatica que TODAS las piezas del registro quedaron consistentes entre si
// (partial <-> guide_declarations <-> script <-> portal_auth <-> router <->
// page_runtime_contexts).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "grupo-10a-guia-05-documentar-gestion-informacion.html",
  "grupo-10b-guia-05-documentar-gestion-informacion.html",
];
const PARTIAL = "partials/guia-05-documentar-gestion-content.html";
const SCRIPT = "js/script_guia5_documentar_gestion.js";

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

function extractDataStores(html) {
  const out = new Set();
  const re = /data-store="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return out;
}

const partialHtml = read(PARTIAL);
const scriptSrc = read(SCRIPT);
const guide = loadDeclarations()[FILES[0]];

test("Guia 5 (Kennedy 10): declarada en guide_declarations para 10A y 10B", () => {
  assert.ok(guide, "falta el registro en guide_declarations.js");
  assert.deepEqual(Array.from(guide.files).sort(), FILES.slice().sort());
  assert.equal(guide.guideNumber, "5");
  assert.equal(guide.stateKey, "guia_interactiva_10a_guia5doc_html");
  assert.equal(guide.activities.length, 7);
});

test("Guia 5 (Kennedy 10): cada formField declarado existe como data-store en el partial (y viceversa)", () => {
  const stores = extractDataStores(partialHtml);
  const declared = new Set();
  guide.activities.forEach((a) => (a.formFields || []).forEach((f) => declared.add(f)));

  for (const f of declared) {
    assert.ok(stores.has(f), `formField "${f}" declarado pero sin data-store en el partial`);
  }
  for (const s of stores) {
    assert.ok(declared.has(s), `data-store "${s}" del partial no esta declarado en ninguna actividad`);
  }
});

test("Guia 5 (Kennedy 10): botones, status y mounts de deadline existen en el partial", () => {
  guide.activities.forEach((a) => {
    if (a.buttonIds?.save) {
      assert.match(partialHtml, new RegExp(`id="${a.buttonIds.save}"`), `falta el boton ${a.buttonIds.save}`);
    }
    if (a.buttonIds?.status) {
      assert.match(partialHtml, new RegExp(`id="${a.buttonIds.status}"`), `falta el status ${a.buttonIds.status}`);
    }
    assert.match(
      partialHtml,
      new RegExp(`id="${a.id}DeadlineControls"`),
      `falta el mount ${a.id}DeadlineControls (badge de nota + fecha limite)`
    );
    assert.match(partialHtml, new RegExp(`actStd_save_${a.id}\\(\\)`), `falta el onclick actStd_save_${a.id}`);
    if (a.driveTarget) {
      assert.match(
        partialHtml,
        new RegExp(`id="driveDeliveryPanel-${a.id}"`),
        `falta el div driveDeliveryPanel-${a.id} para el panel de entrega`
      );
    }
  });
});

test("Guia 5 (Kennedy 10): FORM_FIELDS del script coincide exactamente con los data-store del partial", () => {
  const m = scriptSrc.match(/const FORM_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(m, "no se encontro FORM_FIELDS en el script");
  const scriptFields = new Set(Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]));
  const stores = extractDataStores(partialHtml);
  assert.deepEqual(Array.from(scriptFields).sort(), Array.from(stores).sort());
});

test("Guia 5 (Kennedy 10): el partial y el script no arrastran claves g8_ de la guia 8 (clon a medias)", () => {
  assert.doesNotMatch(partialHtml, /g8_/);
  assert.doesNotMatch(scriptSrc, /g8_/);
  assert.doesNotMatch(partialHtml, /11A|11B|Santa Bárbara/);
});

test("Guia 5 (Kennedy 10): GUIDE_PROGRESS_CONFIG usa el stateKey y activityTotal correctos", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    const block = auth.match(new RegExp(`"${file}":\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(block, `falta ${file} en GUIDE_PROGRESS_CONFIG`);
    assert.match(block[1], /mode:\s*"state-with-activity"/);
    assert.match(block[1], new RegExp(`activityTotal:\\s*${guide.activities.length}\\b`));
    const grupo = file.includes("-10a-") ? "10a" : "10b";
    assert.match(block[1], new RegExp(`stateKey:\\s*"guia_interactiva_${grupo}_guia5doc_html"`));
  });
});

test("Guia 5 (Kennedy 10): asignada a las fichas Kennedy 10A/10B con titulo Guia 5", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    assert.match(auth, new RegExp(`"${file}":\\s*\\n?\\s*"Guía 5`), `falta GUIDE_TITLES de ${file}`);
  });
  const ficha39 = auth.match(/"3441939":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  const ficha42 = auth.match(/"3441942":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  assert.ok(ficha39 && ficha39[1].includes(FILES[0]), "la ficha 3441939 (10A) no incluye la guia");
  assert.ok(ficha42 && ficha42[1].includes(FILES[1]), "la ficha 3441942 (10B) no incluye la guia");
});

test("Guia 5 (Kennedy 10): router y contexts apuntan al script, bundle y boot correctos", () => {
  const router = read("js/guia_router.js");
  assert.match(router, /"10a-guia-5-doc":/);
  assert.match(router, /"10b-guia-5-doc":/);
  assert.match(router, /js\/script_guia5_documentar_gestion\.js/);
  const contexts = JSON.parse(read("data/page_runtime_contexts.json"));
  ["jfk-guia5doc-10a", "jfk-guia5doc-10b"].forEach((key) => {
    const ctx = contexts[key];
    assert.ok(ctx, `falta ${key} en page_runtime_contexts.json`);
    assert.equal(ctx.partialPath, PARTIAL);
    assert.equal(ctx.boot, "initGuia5DocumentarGestion");
  });
  assert.match(scriptSrc, /window\.initGuia5DocumentarGestion = initGuia5DocumentarGestion/);
  // El bundle del partial debe estar regenerado con el contenido actual
  const bundle = read("partials/guia-05-documentar-gestion-bundle.js");
  assert.ok(bundle.includes("g5doc_441_sec_g"), "el bundle no contiene el content actual: corre tools/regen_partial_bundles.py");
  // El bundle de contexts tambien debe estar sincronizado con el JSON
  const ctxBundle = read("data/page_runtime_contexts_bundle.js");
  assert.ok(ctxBundle.includes("jfk-guia5doc-10a") && ctxBundle.includes("jfk-guia5doc-10b"), "regenera data/page_runtime_contexts_bundle.js desde el JSON");
  // El bundle de contexts no debe perder claves existentes al regenerarse
  Object.keys(contexts).forEach((key) => {
    assert.ok(ctxBundle.includes(`"${key}"`), `el bundle de contexts perdio la clave ${key}`);
  });
});

test("Guia 5 (Kennedy 10): activity_grades.js tiene el catalogo y el mapeo de archivo->familia", () => {
  const grades = read("js/activity_grades.js");
  assert.match(grades, /"guia-05-documentar-gestion":\s*\{/);
  FILES.forEach((file) => {
    assert.match(grades, new RegExp(`"${file}":\\s*"guia-05-documentar-gestion"`), `falta el mapeo de ${file} en activity_grades.js`);
  });
  guide.activities.forEach((a) => {
    assert.match(grades, new RegExp(`id:\\s*"${a.id}"`), `falta la actividad ${a.id} en el catalogo de activity_grades.js`);
  });
});

test("Guia 5 (Kennedy 10): identificacion usa el proyecto de Kennedy (no el de Santa Barbara) y sus 48 horas", () => {
  assert.match(partialHtml, /zona de influencia del CIAS Puerto Boyac/);
  assert.match(partialHtml, /Duraci&oacute;n<\/td><td>48 horas/);
  assert.doesNotMatch(partialHtml, /Fortalecimiento de los servicios Teleinform/);
});
