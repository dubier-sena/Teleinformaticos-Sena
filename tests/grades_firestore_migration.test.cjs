"use strict";

// Verifica la migracion de las notas (juicios de evaluacion) del archivo semilla
// PUBLICO data/grades_*.js a Firestore (sena_portal_grades): el admin escribe, el
// aprendiz lee SOLO las suyas. Asi no se exponen nombres+notas de menores en el
// repo publico de GitHub.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("firestore.rules: sena_portal_grades lee dueño/admin, escribe solo admin", () => {
  const rules = read("firestore.rules");
  assert.match(rules, /match \/sena_portal_grades\/\{usernameKey\}/);
  const block = rules.slice(rules.indexOf("sena_portal_grades"));
  assert.match(block, /allow read:\s*if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\)/);
  assert.match(block, /allow write:\s*if isAdmin\(\);/);
});

test("firebase_db.js expone cloudGetGrades / cloudSaveGrades sobre COL_GRADES", () => {
  const db = read("js/firebase_db.js");
  assert.match(db, /var COL_GRADES = "sena_portal_grades";/);
  assert.match(db, /async function cloudGetGrades\(usernameKey\)/);
  assert.match(db, /async function cloudSaveGrades\(usernameKey, grades\)/);
  assert.match(db, /fsGet\(COL_GRADES, usernameKey\)/);
  assert.match(db, /fsPatch\(COL_GRADES, usernameKey,/);
  // expuestas en window._firebaseDb
  assert.match(db, /cloudGetGrades: cloudGetGrades/);
  assert.match(db, /cloudSaveGrades: cloudSaveGrades/);
});

test("activity_grades.js: el aprendiz lee de la nube y ya NO usa el archivo semilla", () => {
  const ag = read("js/activity_grades.js");
  assert.match(ag, /async function renderGradeBadges\(options\)/);
  assert.match(ag, /fetchGradesFromCloud\(session\.usernameKey\)/);
  assert.match(ag, /cloudGetGrades/);
  // el admin sincroniza cada escritura a Firestore
  assert.match(ag, /function saveGradesToCloud\(usernameKey, allGrades\)/);
  assert.match(ag, /cloudSaveGrades/);
  // se elimino el fallback al archivo semilla publico
  assert.doesNotMatch(ag, /lookupSeedGrades/);
  assert.doesNotMatch(ag, /seedData/);
});

test("la induccion ya no inyecta datos semilla ni carga el archivo PII", () => {
  const induccion = read("js/script_induccion.js");
  assert.doesNotMatch(induccion, /__GRADES_INDUCCION__/);
  assert.doesNotMatch(induccion, /seedData/);
  // ninguna pagina debe cargar el archivo semilla con nombres+notas
  const a = read("pages/guias/grupo-10a-guia-01-induccion.html");
  const b = read("pages/guias/grupo-10b-guia-01-induccion.html");
  assert.doesNotMatch(a, /grades_induccion\.js/);
  assert.doesNotMatch(b, /grades_induccion\.js/);
});

test("el archivo semilla con PII ya no esta trackeado en git", () => {
  // git ls-files no debe listar data/grades_induccion.js
  const { execSync } = require("node:child_process");
  const tracked = execSync("git ls-files data/grades_induccion.js", {
    cwd: root,
    encoding: "utf8",
  }).trim();
  assert.equal(tracked, "", "data/grades_induccion.js NO debe estar trackeado (PII)");
});
