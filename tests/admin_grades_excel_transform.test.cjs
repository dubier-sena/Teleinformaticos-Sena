"use strict";
// Fase 14 (mantenibilidad): pruebas directas del modulo puro extraido de
// admin_usuarios.js (Calificar en bloque con Excel). Sin DOM, sin XLSX real,
// sin Firestore -- solo datos entrando y saliendo.
const test = require("node:test");
const assert = require("node:assert/strict");
const transform = require("../js/admin_grades_excel_transform.js");

const ACTIVITIES = [
  { id: "act1", label: "Actividad Uno" },
  { id: "act2", label: "Actividad Dos" },
];

test("buildGradesMainSheetRows: header y filas con % aprobado calculado", () => {
  const students = [
    { fullName: "Ana Lopez", usernameKey: "ana.lopez" },
    { fullName: "Beto Ruiz", usernameKey: "beto.ruiz" },
  ];
  const gradesByUser = { "ana.lopez": { act1: "A", act2: "D" }, "beto.ruiz": {} };
  const resolveGrade = (g, a) => g[a.id];
  const { header, rows } = transform.buildGradesMainSheetRows(students, ACTIVITIES, gradesByUser, resolveGrade);

  assert.deepEqual(header, ["Nombre completo", "Usuario", "% Aprobado", "act1", "act2"]);
  assert.deepEqual(rows[0], header);
  assert.deepEqual(rows[1], ["Ana Lopez", "ana.lopez", "50%", "A", "D"]);
  assert.deepEqual(rows[2], ["Beto Ruiz", "beto.ruiz", "0%", "", ""]);
});

test("buildGradesInstructionsRows: incluye ficha, guia, conteos y fecha inyectada (deterministico)", () => {
  const rows = transform.buildGradesInstructionsRows(
    { label: "Guia 2" }, "guia2", "3441939", 12, 5, "24/8/2026, 10:00:00"
  );
  assert.match(rows[0][0], /Guia 2/);
  assert.match(rows[0][0], /3441939/);
  assert.match(rows[rows.length - 2][0], /24\/8\/2026, 10:00:00/);
  assert.match(rows[rows.length - 1][0], /12/);
  assert.match(rows[rows.length - 1][0], /5/);
});

test("buildGradesLegendRows: un renglon por actividad, encabezado fijo", () => {
  const rows = transform.buildGradesLegendRows(ACTIVITIES);
  assert.deepEqual(rows[0], ["Codigo (encabezado en Calificaciones)", "Actividad completa"]);
  assert.deepEqual(rows[1], ["act1", "Actividad Uno"]);
  assert.deepEqual(rows[2], ["act2", "Actividad Dos"]);
});

test("buildGradesExportFileName: sanea caracteres no alfanumericos y limita longitud", () => {
  const name = transform.buildGradesExportFileName(
    { label: "Guía 2 - Herramientas (ofimática)" }, "guia2", "3441939"
  );
  assert.match(name, /^Calificaciones_3441939_/);
  assert.match(name, /\.xlsx$/);
  assert.doesNotMatch(name, /[^A-Za-z0-9_.]/);
});

test("mapGradesExcelHeader: reconoce columna Usuario y mapea por id o por etiqueta completa", () => {
  const header = ["Nombre completo", "Usuario", "% Aprobado", "act1", "Actividad Dos"];
  const result = transform.mapGradesExcelHeader(header, ACTIVITIES);
  assert.equal(result.ok, true);
  assert.equal(result.usuarioIdx, 1);
  assert.equal(result.colToActivityId[3], "act1");
  assert.equal(result.colToActivityId[4], "act2"); // por etiqueta completa
});

test("mapGradesExcelHeader: falla si falta la columna Usuario", () => {
  const result = transform.mapGradesExcelHeader(["Nombre completo", "act1"], ACTIVITIES);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-usuario-column");
});

test("mapGradesExcelHeader: falla si ninguna columna coincide con una actividad de esta guia", () => {
  const result = transform.mapGradesExcelHeader(["Usuario", "otra-cosa"], ACTIVITIES);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no-activity-columns");
});

test("parseGradesExcelRows: solo aplica A/D validos, celda vacia no se toca", () => {
  const header = ["Usuario", "act1", "act2"];
  const map = transform.mapGradesExcelHeader(header, ACTIVITIES);
  const rows = [
    header,
    ["ana.lopez", "a", ""], // minuscula valida, celda vacia se ignora
    ["beto.ruiz", "D", "x"], // x es invalido
  ];
  const studentsByKey = { "ana.lopez": {}, "beto.ruiz": {} };
  const result = transform.parseGradesExcelRows(rows, map.usuarioIdx, map.colToActivityId, studentsByKey);

  assert.equal(result.parsedRows.length, 2);
  assert.deepEqual(result.parsedRows[0], { usernameKey: "ana.lopez", grades: { act1: "A" } });
  assert.deepEqual(result.parsedRows[1], { usernameKey: "beto.ruiz", grades: { act1: "D" } });
  assert.equal(result.invalidCells.length, 1);
  assert.match(result.invalidCells[0], /beto\.ruiz\/act2="X"/);
});

test("parseGradesExcelRows: fila con usernameKey desconocido cae en unmatched, no en parsedRows", () => {
  const header = ["Usuario", "act1"];
  const map = transform.mapGradesExcelHeader(header, ACTIVITIES.slice(0, 1));
  const rows = [header, ["nadie.aqui", "A"]];
  const result = transform.parseGradesExcelRows(rows, map.usuarioIdx, map.colToActivityId, { "ana.lopez": {} });

  assert.equal(result.parsedRows.length, 0);
  assert.deepEqual(result.unmatched, ["nadie.aqui"]);
});

test("parseGradesExcelRows: fila sin ninguna celda A/D no se agrega a parsedRows aunque el usuario exista", () => {
  const header = ["Usuario", "act1"];
  const map = transform.mapGradesExcelHeader(header, ACTIVITIES.slice(0, 1));
  const rows = [header, ["ana.lopez", ""]];
  const result = transform.parseGradesExcelRows(rows, map.usuarioIdx, map.colToActivityId, { "ana.lopez": {} });

  assert.equal(result.parsedRows.length, 0);
  assert.equal(result.unmatched.length, 0);
  assert.equal(result.invalidCells.length, 0);
});
