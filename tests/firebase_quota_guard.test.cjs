"use strict";
// Reemplaza tools/check_firebase_read_optimization.js, que clavaba los valores
// numéricos exactos del presupuesto diario (cambiaron a read 40k / write 12k /
// delete 450, alineados con CLAUDE.md) y el nombre del intervalo de polling.
// Aquí se asertan los INVARIANTES durables de la guarda de cuota Firestore: el
// presupuesto de 3 niveles por operación, las decisiones centrales para pausar
// lecturas/escrituras no esenciales, y que la plantilla y los scripts de guía
// respetan esa guarda y la visibilidad de la pestaña. Sin pinear números ni
// intervalos concretos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test("firebase_db define un presupuesto diario de 3 niveles y decisiones de guarda", () => {
  const db = read("js/firebase_db.js");
  const budget = db.match(/FIRESTORE_DAILY_BUDGET_LIMITS = \{[\s\S]*?\};/);
  assert.ok(budget, "debe existir el objeto de límites diarios");
  // Cada operación (read/write/delete) con sus tres niveles preventivos.
  for (const op of ["read", "write", "delete"]) {
    assert.match(
      budget[0],
      new RegExp(op + ":\\s*\\{[^}]*warn:[^}]*restrict:[^}]*block:[^}]*\\}"),
      `el presupuesto debe tener niveles warn/restrict/block para ${op}`
    );
  }
  // Decisiones centrales y estado expuesto para diagnóstico.
  assert.match(db, /function shouldDeferCloudReads\(\) \{/);
  assert.match(db, /function shouldSkipGuideUiCloudSave\(\) \{/);
  assert.match(db, /getBudgetStatus:\s*getFirestoreBudgetStatus/);
});

test("la plantilla de guía respeta la guarda de cuota y la visibilidad", () => {
  const gt = read("js/guia_template.js");
  assert.match(gt, /function isGuideDocumentVisible\(\) \{/);
  assert.match(gt, /window\._firebaseDb\?\.shouldDeferCloudReads\?\.\(\)/);
  assert.match(gt, /window\._firebaseDb\?\.shouldSkipGuideUiCloudSave\?\.\(\)/);
  assert.match(gt, /function saveGuideCalendarLocalSnapshot\(snapshot\) \{/);
});

test("cada script de guía pausa lecturas en segundo plano y bajo restricción de cuota", () => {
  const scripts = [
    "js/script.js",
    "js/script_guia2.js",
    "js/script_guia6.js",
    "js/script_induccion.js",
    "js/script_guia_redes.js",
  ];
  for (const file of scripts) {
    const s = read(file);
    assert.match(s, /if \(document\.hidden\) \{/, `${file} debe evitar lecturas con la pestaña oculta`);
    assert.match(
      s,
      /window\._firebaseDb\?\.shouldDeferCloudReads\?\.\(\)/,
      `${file} debe pausar lecturas no esenciales bajo restricción de cuota`
    );
  }
});
