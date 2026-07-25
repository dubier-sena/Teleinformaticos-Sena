"use strict";
// Guia 8 (Santa Barbara grado 11) — Documentar la gestion de la informacion
// (RAP 04). Verifica de forma estatica que TODAS las piezas del registro
// quedaron consistentes entre si (partial <-> guide_declarations <-> script
// <-> portal_auth <-> router <-> page_runtime_contexts). Mismo patron que
// tests/guia4_ciberseguridad_registration.test.cjs: cada una de estas parejas
// ya causo un bug real en guias anteriores cuando se desincronizo (stateKey
// equivocado, alias faltante, mount inexistente, campo renombrado a medias).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "grupo-11a-guia-08-documentar-gestion-informacion.html",
  "grupo-11b-guia-08-documentar-gestion-informacion.html",
];
const PARTIAL = "partials/guia-08-documentar-gestion-content.html";
const SCRIPT = "js/script_guia8.js";

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

test("Guia 8: declarada en guide_declarations para 11A y 11B", () => {
  assert.ok(guide, "falta el registro en guide_declarations.js");
  assert.deepEqual(Array.from(guide.files).sort(), FILES.slice().sort());
  assert.equal(guide.guideNumber, "8");
  assert.equal(guide.stateKey, "guia_interactiva_11a_guia8_html");
  assert.equal(guide.activities.length, 7);
});

test("Guia 8: cada formField declarado existe como data-store en el partial (y viceversa)", () => {
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

test("Guia 8: botones, status y mounts de deadline existen en el partial", () => {
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

test("Guia 8: FORM_FIELDS del script coincide exactamente con los data-store del partial", () => {
  const m = scriptSrc.match(/const FORM_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(m, "no se encontro FORM_FIELDS en el script");
  const scriptFields = new Set(Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]));
  const stores = extractDataStores(partialHtml);
  assert.deepEqual(Array.from(scriptFields).sort(), Array.from(stores).sort());
});

test("Guia 8: el partial y el script no arrastran claves g7_ de la guia 7 (clon a medias)", () => {
  assert.doesNotMatch(partialHtml, /g7_/);
  assert.doesNotMatch(partialHtml, /equipo-g7/);
  assert.doesNotMatch(scriptSrc, /g7_|Guia7|guia7\(/);
});

test("Guia 8: GUIDE_PROGRESS_CONFIG usa el stateKey y activityTotal correctos", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    const block = auth.match(new RegExp(`"${file}":\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(block, `falta ${file} en GUIDE_PROGRESS_CONFIG`);
    assert.match(block[1], /mode:\s*"state-with-activity"/);
    assert.match(block[1], new RegExp(`activityTotal:\\s*${guide.activities.length}\\b`));
    const grupo = file.includes("-11a-") ? "11a" : "11b";
    assert.match(block[1], new RegExp(`stateKey:\\s*"guia_interactiva_${grupo}_guia8_html"`));
  });
});

test("Guia 8: asignada a las fichas Santa Barbara 11A/11B con titulo Guia 8", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    assert.match(auth, new RegExp(`"${file}":\\s*\\n?\\s*"Guía 8`), `falta GUIDE_TITLES de ${file}`);
  });
  const ficha50 = auth.match(/"3168850":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  const ficha52 = auth.match(/"3168852":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  assert.ok(ficha50 && ficha50[1].includes(FILES[0]), "la ficha 3168850 (11A) no incluye la guia");
  assert.ok(ficha52 && ficha52[1].includes(FILES[1]), "la ficha 3168852 (11B) no incluye la guia");
});

test("Guia 8: router y contexts apuntan al script, bundle y boot correctos", () => {
  const router = read("js/guia_router.js");
  assert.match(router, /"11a-guia-8":/);
  assert.match(router, /"11b-guia-8":/);
  assert.match(router, /js\/script_guia8\.js/);
  const contexts = JSON.parse(read("data/page_runtime_contexts.json"));
  ["sb-guia8-11a", "sb-guia8-11b"].forEach((key) => {
    const ctx = contexts[key];
    assert.ok(ctx, `falta ${key} en page_runtime_contexts.json`);
    assert.equal(ctx.partialPath, PARTIAL);
    assert.equal(ctx.boot, "initGuia8");
  });
  assert.match(scriptSrc, /window\.initGuia8 = initGuia8/);
  // El bundle del partial debe estar regenerado con el contenido actual
  const bundle = read("partials/guia-08-documentar-gestion-bundle.js");
  assert.ok(bundle.includes("g8_441_sec_g"), "el bundle no contiene el content actual: corre tools/regen_partial_bundles.py");
  // El bundle de contexts tambien debe estar sincronizado con el JSON
  const ctxBundle = read("data/page_runtime_contexts_bundle.js");
  assert.ok(ctxBundle.includes("sb-guia8-11a") && ctxBundle.includes("sb-guia8-11b"), "regenera data/page_runtime_contexts_bundle.js desde el JSON");
  // El bundle de contexts no debe perder claves existentes al regenerarse
  Object.keys(contexts).forEach((key) => {
    assert.ok(ctxBundle.includes(`"${key}"`), `el bundle de contexts perdio la clave ${key}`);
  });
});

test("Guia 8: activity_grades.js tiene el catalogo y el mapeo de archivo->familia", () => {
  const grades = read("js/activity_grades.js");
  assert.match(grades, /"guia-08-documentar-gestion":\s*\{/);
  FILES.forEach((file) => {
    assert.match(grades, new RegExp(`"${file}":\\s*"guia-08-documentar-gestion"`), `falta el mapeo de ${file} en activity_grades.js`);
  });
  guide.activities.forEach((a) => {
    assert.match(grades, new RegExp(`id:\\s*"${a.id}"`), `falta la actividad ${a.id} en el catalogo de activity_grades.js`);
  });
});
