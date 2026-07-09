const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// admin_usuarios.js es un archivo grande (miles de lineas, pensado como
// <script src>) con muchas dependencias de arranque -- cargarlo entero en un
// sandbox de pruebas (como se hace con activity_grades.js) no es practico
// aqui. En cambio, se verifica ESTRUCTURALMENTE que las piezas de la UI de
// "motivo de No aprobado" existen y estan conectadas: el comportamiento de
// fondo (buildGradeBadge con el motivo) ya tiene pruebas de comportamiento
// reales en tests/grade_rejection_reason.test.cjs.
const source = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");

test("admin_usuarios.js: existen los 2 motivos predeterminados pedidos por el usuario", () => {
  assert.match(source, /GRADE_REJECTION_REASONS\s*=\s*\{/);
  assert.match(source, /no entreg[oó] la actividad en los tiempos establecidos/i);
  assert.match(source, /no entreg[oó] la actividad como se solicit[oó] en la gu[ií]a/i);
});

test("admin_usuarios.js: gradeSelectMarkup arma el selector de motivo (oculto salvo con nota D)", () => {
  assert.match(source, /class="grade-reason-select"/);
  assert.match(source, /cur === "D" \? "" : " hidden"/);
  // Las 3 opciones: los 2 motivos predeterminados + "Otro" para texto libre.
  assert.match(source, /reasonOpt\("no-entrego-tiempo"/);
  assert.match(source, /reasonOpt\("no-entrego-como-solicitado"/);
  assert.match(source, /reasonOpt\("custom"/);
});

test("admin_usuarios.js: handleGradeChange oculta/borra el motivo cuando la nota deja de ser 'D'", () => {
  const fnMatch = source.match(/async function handleGradeChange\([\s\S]*?\n  \}\n/);
  assert.ok(fnMatch, "no se encontro la funcion handleGradeChange completa");
  const fn = fnMatch[0];
  assert.match(fn, /reasonSelect\.hidden = true/);
  assert.match(fn, /setStudentActivityObservation\(usernameKey, guideFamily, activityId, ""\)/);
});

test("admin_usuarios.js: handleGradeReasonChange guarda el motivo elegido via setStudentActivityObservation", () => {
  const fnMatch = source.match(/async function handleGradeReasonChange\([\s\S]*?\n  \}\n/);
  assert.ok(fnMatch, "no se encontro la funcion handleGradeReasonChange completa");
  const fn = fnMatch[0];
  assert.match(fn, /GRADE_REJECTION_REASONS\[code\]/);
  assert.match(fn, /window\.prompt\(/, "la opcion 'Otro' debe pedir el texto libre");
  assert.match(fn, /setStudentActivityObservation\(usernameKey, guideFamily, activityId, message\)/);
});

test("admin_usuarios.js: el selector de motivo esta conectado en la delegacion de eventos del modulo Notas", () => {
  const idx = source.indexOf('byId("module-notas")?.addEventListener("change"');
  assert.notEqual(idx, -1, "no se encontro la delegacion de eventos del modulo Notas");
  const block = source.slice(idx, idx + 2000);
  assert.match(block, /grade-reason-select/);
  assert.match(block, /handleGradeReasonChange\(reasonSel\)/);
});
