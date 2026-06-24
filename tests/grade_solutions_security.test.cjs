// Propiedades de seguridad del banco de respuestas modelo.
// El banco MAESTRO no debe llegar nunca al cliente del aprendiz: vive en Firestore
// (solo admin) y al aprobar se copia solo la solucion puntual dentro de las notas del
// aprendiz, que el aprendiz si puede leer (solo las suyas).

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function htmlFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

test("seguridad: ninguna pagina carga el banco de respuestas en el cliente", () => {
  const offenders = htmlFiles(ROOT).filter((f) => fs.readFileSync(f, "utf8").includes("grade_solutions_bank"));
  assert.deepStrictEqual(offenders, [], "el banco no debe referenciarse en ningun HTML (lo veria el aprendiz)");
});

test("seguridad: el banco-semilla esta gitignored (nunca publico)", () => {
  assert.match(read(".gitignore"), /grade_solutions_bank\.json/);
});

test("reglas Firestore: sena_portal_grade_solutions es solo-admin", () => {
  const rules = read("firestore.rules");
  const block = rules.match(/match \/sena_portal_grade_solutions\/\{docId\} \{[\s\S]*?\}/);
  assert.ok(block, "debe existir el match de sena_portal_grade_solutions");
  assert.match(block[0], /allow read, write: if isAdmin\(\);/);
});

test("firebase_db: funciones cloud del banco usan la coleccion solo-admin", () => {
  const db = read("js/firebase_db.js");
  assert.match(db, /COL_GRADE_SOLUTIONS = "sena_portal_grade_solutions"/);
  assert.match(db, /async function cloudGetGradeSolutions\(\)/);
  assert.match(db, /async function cloudSaveGradeSolutions\(solutions\)/);
  assert.match(db, /cloudGetGradeSolutions: cloudGetGradeSolutions/);
  assert.match(db, /cloudSaveGradeSolutions: cloudSaveGradeSolutions/);
});

test("activity_grades: el aprendiz rellena desde la solucion EMBEBIDA en sus notas, no de un banco global", () => {
  const ag = read("js/activity_grades.js");
  const fn = ag.match(/function applyApprovedSolutionsForFamily\(family\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "applyApprovedSolutionsForFamily debe existir");
  // Lee la solucion embebida {actId}:solution de las notas del propio aprendiz.
  assert.match(fn[0], /grades\[activityId \+ ":solution"\]/);
  // Ya NO depende de un banco global cargado en el cliente.
  assert.ok(!fn[0].includes("gradeSolutionsBank"), "no debe leer window.gradeSolutionsBank en el cliente");
  assert.ok(!ag.includes("window.gradeSolutionsBank"), "activity_grades no debe referenciar el banco global");
});

test("activity_grades: el setter del admin embebe la solucion solo cuando la nota es A", () => {
  const ag = read("js/activity_grades.js");
  const fn = ag.match(/function setStudentActivityGradeAndSolution\([\s\S]*?\n  \}/);
  assert.ok(fn, "setStudentActivityGradeAndSolution debe existir");
  assert.match(fn[0], /grade === "A" && solutionObj/);
  assert.match(fn[0], /delete all\[guideFamily\]\[solKey\]/); // sin A => limpia la solucion
});
