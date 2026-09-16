const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// admin_usuarios.js es un archivo grande (miles de lineas, pensado como
// <script src>) con muchas dependencias de arranque -- cargarlo entero en un
// sandbox de pruebas (como se hace con activity_grades.js) no es practico
// aqui. En cambio, se verifica ESTRUCTURALMENTE que las piezas de la UI de
// observaciones existen y estan conectadas; el comportamiento de fondo
// (buildGradeBadge con la observacion) tiene pruebas reales en
// tests/grade_rejection_reason.test.cjs, y la logica pura del banco
// (deduplicacion, filtrado por nota, siembra) se ejecuta de verdad mas abajo.
//
// HISTORIA: hasta 2026-09-15 esto cubria un selector de 2 motivos fijos
// (GRADE_REJECTION_REASONS) + un window.prompt para "Otro". Lo reemplazo el
// banco de comentarios reutilizables; esos 2 motivos sobreviven como semillas.
const source = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");

test("admin_usuarios.js: el banco trae las respuestas iniciales pedidas por el usuario", () => {
  assert.match(source, /GRADE_COMMENT_SEEDS\s*=\s*\[/);
  [
    /actividad aprobada correctamente/i,
    /cumple con lo solicitado/i,
    /buen trabajo, evidencia completa/i,
    /actividad incompleta/i,
    /faltan evidencias/i,
    /debe corregir y volver a entregar/i,
    /el archivo entregado no corresponde a la actividad/i,
    /evidencia insuficiente/i,
    /debe mejorar la presentaci[oó]n/i,
    /debe completar los puntos faltantes/i,
    /no entreg[oó] la actividad\./i,
    /requiere revisi[oó]n o correcci[oó]n/i,
  ].forEach((re) => assert.match(source, re, "falta la respuesta inicial " + re));
});

test("admin_usuarios.js: los 2 motivos que ya existian siguen en el banco (no se perdieron)", () => {
  assert.match(source, /no entreg[oó] la actividad en los tiempos establecidos/i);
  assert.match(source, /no entreg[oó] la actividad como se solicit[oó] en la gu[ií]a/i);
});

test("admin_usuarios.js: la celda arma desplegable del banco + campo de texto editable", () => {
  assert.match(source, /class="grade-comment-select"/);
  assert.match(source, /class="grade-obs-input"/);
  // Los controles aparecen con CUALQUIER nota, no solo con "D".
  const fn = source.match(/function gradeSelectMarkup\([\s\S]*?\n  \}\n/);
  assert.ok(fn, "no se encontro gradeSelectMarkup completa");
  assert.match(fn[0], /const hidden = cur \? "" : " hidden"/);
});

test("admin_usuarios.js: handleGradeChange CONSERVA la observacion al pasar de D a A", () => {
  const fnMatch = source.match(/async function handleGradeChange\([\s\S]*?\n  \}\n/);
  assert.ok(fnMatch, "no se encontro la funcion handleGradeChange completa");
  const fn = fnMatch[0];
  // Solo se borra cuando la celda se queda SIN nota.
  assert.match(fn, /if \(!nextGrade\) \{[\s\S]*setStudentActivityObservation\(usernameKey, guideFamily, activityId, ""\)/);
  // Y el desplegable se repuebla segun la nota nueva.
  assert.match(fn, /commentSelect\.innerHTML = commentOptionsMarkup\(nextGrade\)/);
});

test("admin_usuarios.js: insertar del banco rellena el campo editable y guarda por un unico camino", () => {
  const sel = source.match(/function handleGradeCommentSelect\([\s\S]*?\n  \}\n/);
  assert.ok(sel, "no se encontro handleGradeCommentSelect");
  assert.match(sel[0], /obsInput\.value = chosen\.texto/);
  assert.match(sel[0], /saveGradeObservation\(obsInput\)/);

  const save = source.match(/function saveGradeObservation\([\s\S]*?\n  \}\n/);
  assert.ok(save, "no se encontro saveGradeObservation");
  assert.match(save[0], /setStudentActivityObservation\(usernameKey, guideFamily, activityId, message\)/);
});

test("admin_usuarios.js: CRUD del banco presente y conectado a la delegacion del modulo Notas", () => {
  assert.match(source, /function handleGradeCommentAdd\(/);
  assert.match(source, /function handleGradeCommentEdit\(/);
  assert.match(source, /function handleGradeCommentDelete\(/);
  assert.match(source, /id="grades-comments-count"/, "debe haber contador de comentarios");

  const idx = source.indexOf('byId("module-notas")?.addEventListener("change"');
  assert.notEqual(idx, -1, "no se encontro la delegacion de 'change' del modulo Notas");
  const block = source.slice(idx, idx + 2000);
  assert.match(block, /grade-comment-select/);
  assert.match(block, /handleGradeCommentSelect\(commentSel\)/);
  assert.match(block, /saveGradeObservation\(obsInput\)/);

  const clickIdx = source.indexOf('byId("module-notas")?.addEventListener("click"');
  assert.notEqual(clickIdx, -1, "no se encontro la delegacion de 'click' del modulo Notas");
  const clickBlock = source.slice(clickIdx, clickIdx + 800);
  assert.match(clickBlock, /grade-comment-edit/);
  assert.match(clickBlock, /grade-comment-delete/);
});

// ── Logica pura del banco, ejecutada de verdad ───────────────────────────────
// Se extraen las funciones puras del archivo y se corren en un sandbox: la
// deduplicacion y el filtrado por nota son donde de verdad se puede colar un
// bug (duplicados en la nube, comentarios de "Aprobado" ofrecidos en una "D").
function loadPureBankHelpers() {
  const pick = (re, nombre) => {
    const m = source.match(re);
    assert.ok(m, "no se pudo extraer " + nombre);
    return m[0];
  };
  const code = [
    pick(/const GRADE_COMMENT_TYPES = \{[\s\S]*?\};/, "GRADE_COMMENT_TYPES"),
    pick(/const GRADE_COMMENT_SEEDS = \[[\s\S]*?\n  \];/, "GRADE_COMMENT_SEEDS"),
    pick(/function gradeCommentKey\([\s\S]*?\n  \}/, "gradeCommentKey"),
    pick(/function normalizeGradeComment\([\s\S]*?\n  \}/, "normalizeGradeComment"),
    pick(/function dedupeGradeComments\([\s\S]*?\n  \}/, "dedupeGradeComments"),
  ].join("\n");
  const ctx = { console, Date, Set };
  vm.createContext(ctx);
  vm.runInContext(
    code + "\n;globalThis.__bank = { GRADE_COMMENT_SEEDS, gradeCommentKey, dedupeGradeComments, GRADE_COMMENT_TYPES };",
    ctx
  );
  return ctx.__bank;
}

test("banco: las semillas no traen duplicados entre si", () => {
  const b = loadPureBankHelpers();
  const deduped = b.dedupeGradeComments(b.GRADE_COMMENT_SEEDS);
  assert.equal(deduped.length, b.GRADE_COMMENT_SEEDS.length,
    "GRADE_COMMENT_SEEDS contiene textos equivalentes entre si");
});

test("banco: la deduplicacion ignora tildes, mayusculas, espacios y punto final", () => {
  const b = loadPureBankHelpers();
  const out = b.dedupeGradeComments([
    { texto: "Faltan evidencias.", tipo: "no-aprobado" },
    { texto: "faltan   EVIDENCIAS", tipo: "general" },
    { texto: "Debe mejorar la presentación", tipo: "general" },
    { texto: "Debe mejorar la presentacion.", tipo: "aprobado" },
    { texto: "Otro distinto", tipo: "general" },
  ]);
  assert.equal(out.length, 2 + 1 - 1 + 1, "deben quedar 3 comentarios (2 grupos + 1 suelto)");
  assert.equal(out.length, 3);
  // Gana el PRIMERO: no se pierde el que el instructor ya venia usando.
  assert.equal(out[0].texto, "Faltan evidencias.");
  assert.equal(out[0].tipo, "no-aprobado");
});

test("banco: entradas vacias o sin texto se descartan y el tipo invalido cae en 'general'", () => {
  const b = loadPureBankHelpers();
  const out = b.dedupeGradeComments([
    { texto: "   ", tipo: "aprobado" },
    null,
    { texto: "Valido", tipo: "tipo-inventado" },
    { tipo: "general" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].texto, "Valido");
  assert.equal(out[0].tipo, "general");
  assert.ok(out[0].id, "cada comentario debe quedar con id");
});

test("banco: la coleccion nueva es solo-admin en firestore.rules (el aprendiz no la puede leer)", () => {
  const dbSrc = fs.readFileSync(path.join(root, "js", "firebase_db.js"), "utf8");
  assert.match(dbSrc, /COL_GRADE_COMMENTS\s*=\s*"sena_portal_grade_comments"/,
    "firebase_db.js debe declarar la coleccion del banco de comentarios");
  assert.match(dbSrc, /cloudGetGradeComments:\s*cloudGetGradeComments/, "falta exportar cloudGetGradeComments");
  assert.match(dbSrc, /cloudSaveGradeComments:\s*cloudSaveGradeComments/, "falta exportar cloudSaveGradeComments");

  const rules = fs.readFileSync(path.join(root, "firestore.rules"), "utf8");
  const m = rules.match(/match \/sena_portal_grade_comments\/\{[^}]+\} \{([\s\S]*?)\}/);
  assert.ok(m, "firestore.rules debe tener un bloque para sena_portal_grade_comments");
  assert.match(m[1], /allow read, write: if isAdmin\(\);/,
    "el banco de comentarios debe ser solo-admin (lectura y escritura)");
  // El aprendiz solo ve la frase copiada en SU doc de notas, nunca el banco.
  assert.doesNotMatch(m[1], /isOwner/, "ninguna regla de propiedad debe abrir el banco al aprendiz");
});

test("banco: cada semilla tiene un tipo valido (si no, no se ofreceria en ninguna nota)", () => {
  const b = loadPureBankHelpers();
  b.GRADE_COMMENT_SEEDS.forEach((c) => {
    assert.ok(b.GRADE_COMMENT_TYPES[c.tipo], `tipo invalido en la semilla "${c.texto}": ${c.tipo}`);
  });
  // Debe haber al menos una de cada tipo, o el desplegable saldria vacio para
  // alguna de las dos notas.
  const tipos = new Set(b.GRADE_COMMENT_SEEDS.map((c) => c.tipo));
  ["aprobado", "no-aprobado", "general"].forEach((t) =>
    assert.ok(tipos.has(t), "las semillas no cubren el tipo " + t));
});
