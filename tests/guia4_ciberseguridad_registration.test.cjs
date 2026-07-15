"use strict";
// Guia 4 (JFK grado 10) — Planificar la informacion segun criterios de
// ciberseguridad. Verifica de forma estatica que TODAS las piezas del registro
// quedaron consistentes entre si (partial <-> guide_declarations <-> script
// <-> aliases cloud <-> progreso <-> router). Cada una de estas parejas ya
// causo un bug real en guias anteriores cuando se desincronizo (stateKey
// equivocado, alias faltante, mount inexistente, campo renombrado a medias).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html",
  "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html",
];
const PARTIAL = "partials/guia-04-planificar-ciberseguridad-content.html";
const SCRIPT = "js/script_guia4_ciberseguridad.js";

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

test("Guia 4 ciber: declarada en guide_declarations para 10A y 10B", () => {
  assert.ok(guide, "falta el registro en guide_declarations.js");
  assert.deepEqual(Array.from(guide.files).sort(), FILES.slice().sort());
  assert.equal(guide.guideNumber, "4");
  assert.equal(guide.stateKey, "guia_interactiva_10a_guia4ciber_html");
  assert.equal(guide.activities.length, 8);
});

test("Guia 4 ciber: cada formField declarado existe como data-store en el partial (y viceversa)", () => {
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

test("Guia 4 ciber: botones, status y mounts de deadline existen en el partial", () => {
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

test("Guia 4 ciber: FORM_FIELDS del script coincide exactamente con los data-store del partial", () => {
  const m = scriptSrc.match(/const FORM_FIELDS = \[([\s\S]*?)\];/);
  assert.ok(m, "no se encontro FORM_FIELDS en el script");
  const scriptFields = new Set(Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]));
  const stores = extractDataStores(partialHtml);
  assert.deepEqual(Array.from(scriptFields).sort(), Array.from(stores).sort());
});

test("Guia 4 ciber: el partial no arrastra claves g7_ de la guia 7 (clon a medias)", () => {
  assert.doesNotMatch(partialHtml, /g7_/);
  assert.doesNotMatch(partialHtml, /equipo-g7/);
  assert.doesNotMatch(scriptSrc, /g7_|Guia7|guia7/);
});

test("Guia 4 ciber: aliases de storage identicos en script, firebase_db y admin_habilitacion", () => {
  const expected = {
    "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html": "10a_guia4ciber.html",
    "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html": "10b_guia4ciber.html",
  };
  for (const src of [scriptSrc, read("js/firebase_db.js"), read("js/admin_habilitacion.js")]) {
    Object.entries(expected).forEach(([file, alias]) => {
      assert.match(
        src,
        new RegExp(`"${file}":\\s*"${alias}"`),
        `falta el alias ${file} -> ${alias}`
      );
    });
  }
});

test("Guia 4 ciber: GUIDE_PROGRESS_CONFIG usa el stateKey del alias y total = campos + actividades", () => {
  const auth = read("js/portal_auth.js");
  const stores = extractDataStores(partialHtml);
  const expectedTotal = stores.size + guide.activities.length;
  FILES.forEach((file) => {
    const block = auth.match(new RegExp(`"${file}":\\s*\\{([\\s\\S]*?)\\}`));
    assert.ok(block, `falta ${file} en GUIDE_PROGRESS_CONFIG`);
    assert.match(block[1], /mode:\s*"state-with-activity"/);
    assert.match(block[1], new RegExp(`total:\\s*${expectedTotal}\\b`), `total debe ser ${expectedTotal} (campos ${stores.size} + actividades ${guide.activities.length})`);
    assert.match(block[1], new RegExp(`activityTotal:\\s*${guide.activities.length}\\b`));
    const grupo = file.includes("-10a-") ? "10a" : "10b";
    assert.match(block[1], new RegExp(`stateKey:\\s*"guia_interactiva_${grupo}_guia4ciber_html"`));
  });
});

test("Guia 4 ciber: asignada a las fichas Kennedy 10A/10B con titulo Guia 4", () => {
  const auth = read("js/portal_auth.js");
  FILES.forEach((file) => {
    assert.match(auth, new RegExp(`"${file}":\\s*\\n?\\s*"Guía 4`), `falta GUIDE_TITLES de ${file}`);
  });
  const ficha39 = auth.match(/"3441939":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  const ficha42 = auth.match(/"3441942":\s*\{[\s\S]*?guias:\s*\[([\s\S]*?)\]/);
  assert.ok(ficha39 && ficha39[1].includes(FILES[0]), "la ficha 3441939 (10A) no incluye la guia");
  assert.ok(ficha42 && ficha42[1].includes(FILES[1]), "la ficha 3441942 (10B) no incluye la guia");
});

test("Guia 4 ciber: router y contexts apuntan al script, bundle y boot correctos", () => {
  const router = read("js/guia_router.js");
  assert.match(router, /"10a-guia-4-ciber":/);
  assert.match(router, /"10b-guia-4-ciber":/);
  assert.match(router, /"jfk-guia4ciber-10a":\s*"10a-guia-4-ciber"/);
  assert.match(router, /"jfk-guia4ciber-10b":\s*"10b-guia-4-ciber"/);
  const contexts = JSON.parse(read("data/page_runtime_contexts.json"));
  ["jfk-guia4ciber-10a", "jfk-guia4ciber-10b"].forEach((key) => {
    const ctx = contexts[key];
    assert.ok(ctx, `falta ${key} en page_runtime_contexts.json`);
    assert.equal(ctx.partialPath, PARTIAL);
    assert.equal(ctx.boot, "initGuia4Ciber");
  });
  assert.match(scriptSrc, /window\.initGuia4Ciber = initGuia4Ciber/);
  // El bundle del partial debe estar regenerado con el contenido actual
  const bundle = read("partials/guia-04-planificar-ciberseguridad-bundle.js");
  assert.ok(bundle.includes("g4c_341_sec_recomendaciones"), "el bundle no contiene el content actual: corre tools/regen_partial_bundles.py");
  // El bundle de contexts tambien debe estar sincronizado con el JSON
  const ctxBundle = read("data/page_runtime_contexts_bundle.js");
  assert.ok(ctxBundle.includes("jfk-guia4ciber-10a") && ctxBundle.includes("jfk-guia4ciber-10b"), "regenera data/page_runtime_contexts_bundle.js desde el JSON");
});

test("Guia 4 ciber: todo el material de apoyo enlazado existe en assets/materiales/guia4ciber (y viceversa)", () => {
  const MATERIALS_DIR = "assets/materiales/guia4ciber";
  const linked = Array.from(
    partialHtml.matchAll(/href="(assets\/materiales\/guia4ciber\/[^"]+)"/g),
    (m) => m[1]
  );
  assert.ok(linked.length >= 13, `el partial deberia enlazar al menos 13 PDF del material (hay ${linked.length})`);
  linked.forEach((rel) => {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `enlace roto: ${rel} no existe en el repo`);
  });
  const onDisk = fs.readdirSync(path.join(ROOT, MATERIALS_DIR)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const linkedNames = new Set(linked.map((rel) => rel.split("/").pop()));
  onDisk.forEach((f) => {
    assert.ok(linkedNames.has(f), `el PDF ${f} esta en ${MATERIALS_DIR} pero la guia no lo enlaza`);
  });
  // Los instaladores .exe NO van al repo publico: se enlaza la fuente oficial.
  const exes = fs.readdirSync(path.join(ROOT, MATERIALS_DIR)).filter((f) => f.toLowerCase().endsWith(".exe"));
  assert.deepEqual(exes, [], "no debe haber ejecutables dentro de assets/materiales/guia4ciber");
  assert.match(partialHtml, /belarc\.com/, "falta el enlace oficial de Belarc Advisor");
  assert.match(partialHtml, /easeus\.com/, "falta el enlace oficial de EaseUS Todo Backup");
});

test("Guia 4 ciber: selector de equipo del script y del partial usan las mismas actividades", () => {
  const m = scriptSrc.match(/EQUIPO_G4C_ACTIVITY_IDS = \[([\s\S]*?)\]/);
  assert.ok(m, "no se encontro EQUIPO_G4C_ACTIVITY_IDS");
  const ids = Array.from(m[1].matchAll(/"([^"]+)"/g), (x) => x[1]);
  const mounts = Array.from(partialHtml.matchAll(/data-equipo-g4c-mount="([^"]+)"/g), (x) => x[1]);
  assert.deepEqual(mounts.sort(), ids.slice().sort(), "los mounts data-equipo-g4c-mount del partial no coinciden con EQUIPO_G4C_ACTIVITY_IDS");
});
