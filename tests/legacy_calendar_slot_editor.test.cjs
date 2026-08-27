"use strict";

// Bloque F.1 (franjas horarias de clases existentes, 2026-08-26):
// js/legacy_calendar_slot_editor.js -- conversion PURA entre el string
// "horario" (calendario-academico-2026.html / CALENDAR_2026_RECORDS) y
// franjas en formato <input type="time"> (24h). El formato de salida debe
// coincidir EXACTO con lo que academic_agenda.js#parseHorarioSlots ya sabe
// leer (se prueba la integracion real al final, sin reimplementar esa
// funcion).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const editor = require(path.join(__dirname, "..", "js", "legacy_calendar_slot_editor.js"));

// ── isAllDayHorario ──────────────────────────────────────────────────────

test("isAllDayHorario: vacio, guion largo y guion corto cuentan como todo-el-dia", () => {
  assert.equal(editor.isAllDayHorario(""), true);
  assert.equal(editor.isAllDayHorario("—"), true);
  assert.equal(editor.isAllDayHorario("-"), true);
  assert.equal(editor.isAllDayHorario(null), true);
  assert.equal(editor.isAllDayHorario("7:00am–9:55am"), false);
});

// ── parseHorarioToSlots (string legacy -> inputs de hora) ──────────────────

test("parseHorarioToSlots: una sola franja", () => {
  const slots = editor.parseHorarioToSlots("2:10pm–4:15pm");
  assert.equal(slots.length, 1);
  assert.equal(slots[0].start, "14:10");
  assert.equal(slots[0].end, "16:15");
});

test("parseHorarioToSlots: dos franjas separadas por '/'", () => {
  const slots = editor.parseHorarioToSlots("7:00am–9:55am / 2:15pm–4:15pm");
  assert.equal(slots.length, 2);
  assert.equal(slots[0].start, "07:00");
  assert.equal(slots[0].end, "09:55");
  assert.equal(slots[1].start, "14:15");
  assert.equal(slots[1].end, "16:15");
});

test("parseHorarioToSlots: separador ';' (formato alterno ya usado en SBH)", () => {
  const slots = editor.parseHorarioToSlots("7:00am–7:55am; 9:55am–10:50am");
  assert.equal(slots.length, 2);
  assert.equal(slots[0].start, "07:00");
  assert.equal(slots[1].start, "09:55");
});

test("parseHorarioToSlots: todo el dia -> sin franjas", () => {
  assert.deepEqual(editor.parseHorarioToSlots("—"), []);
  assert.deepEqual(editor.parseHorarioToSlots(""), []);
});

test("parseHorarioToSlots: 12:00pm (mediodia) y 12:00am (medianoche) no rompen el parseo", () => {
  const midday = editor.parseHorarioToSlots("12:00pm–1:00pm");
  assert.equal(midday[0].start, "12:00");
  const midnight = editor.parseHorarioToSlots("12:00am–1:00am");
  assert.equal(midnight[0].start, "00:00");
});

// ── buildHorarioFromSlots (inputs de hora -> string legacy) ────────────────

test("buildHorarioFromSlots: 2:10pm-4:15pm (ejemplo pedido explicitamente)", () => {
  const s = editor.buildHorarioFromSlots([{ start: "14:10", end: "16:15" }]);
  assert.equal(s, "2:10pm–4:15pm");
});

test("buildHorarioFromSlots: 2:35pm-6:10pm (ejemplo pedido explicitamente)", () => {
  const s = editor.buildHorarioFromSlots([{ start: "14:35", end: "18:10" }]);
  assert.equal(s, "2:35pm–6:10pm");
});

test("buildHorarioFromSlots: 7:00am-11:45am (ejemplo pedido explicitamente)", () => {
  const s = editor.buildHorarioFromSlots([{ start: "07:00", end: "11:45" }]);
  assert.equal(s, "7:00am–11:45am");
});

test("buildHorarioFromSlots: multiples franjas se unen con ' / '", () => {
  const s = editor.buildHorarioFromSlots([{ start: "08:00", end: "10:00" }, { start: "14:10", end: "16:15" }]);
  assert.equal(s, "8:00am–10:00am / 2:10pm–4:15pm");
});

test("buildHorarioFromSlots: sin franjas validas -> todo el dia ('—')", () => {
  assert.equal(editor.buildHorarioFromSlots([]), "—");
  assert.equal(editor.buildHorarioFromSlots([{ start: "", end: "" }]), "—");
});

test("buildHorarioFromSlots: descarta silenciosamente una franja incompleta entre validas", () => {
  const s = editor.buildHorarioFromSlots([{ start: "08:00", end: "10:00" }, { start: "", end: "" }]);
  assert.equal(s, "8:00am–10:00am");
});

// ── Round-trip (parse -> build debe devolver un string EQUIVALENTE) ────────

test("round-trip: parsear y reconstruir una franja simple no cambia su significado", () => {
  const original = "2:10pm–4:15pm";
  const rebuilt = editor.buildHorarioFromSlots(editor.parseHorarioToSlots(original));
  assert.equal(rebuilt, original);
});

test("round-trip: parsear y reconstruir 2 franjas preserva ambas", () => {
  const original = "7:00am–9:55am / 2:15pm–4:15pm";
  const rebuilt = editor.buildHorarioFromSlots(editor.parseHorarioToSlots(original));
  assert.equal(rebuilt, original);
});

// ── Integracion real: el formato de salida lo entiende academic_agenda.js ──

test("integracion real: buildHorarioFromSlots produce un horario que academic_agenda.js parsea correctamente", () => {
  const agenda = require(path.join(__dirname, "..", "js", "academic_agenda.js"));
  const horario = editor.buildHorarioFromSlots([{ start: "14:10", end: "16:15" }, { start: "18:35", end: "20:10" }]);
  const result = agenda.buildAcademicAgenda({
    context: { ficha: "3441939", grupo: "10A", institucionShort: "I.E. Jhon F. Kennedy" },
    calendarRecords: [
      { id: "rec1", tipo: "CLASE", colegio: "I.E. Jhon F. Kennedy", grado: "10A", fecha: "2026-09-09", horario: horario, defE: "Activa" },
    ],
  });
  const clases = result.events.filter((e) => e.type === "CLASE");
  assert.equal(clases.length, 2, "las 2 franjas generadas por el editor deben producir 2 eventos CLASE reales");
  // startAt es ISO en UTC; 14:10/18:35 hora Bogota (UTC-5) == 19:10/23:35 UTC.
  assert.match(clases[0].startAt, /19:10/);
  assert.match(clases[1].startAt, /23:35/);
});

test("integracion real: buildHorarioFromSlots('—') (todo el dia) produce un evento allDay real", () => {
  const agenda = require(path.join(__dirname, "..", "js", "academic_agenda.js"));
  const horario = editor.buildHorarioFromSlots([]);
  assert.equal(horario, "—");
  const result = agenda.buildAcademicAgenda({
    context: { ficha: "3441939", grupo: "10A", institucionShort: "I.E. Jhon F. Kennedy" },
    calendarRecords: [
      { id: "rec1", tipo: "CLASE", colegio: "I.E. Jhon F. Kennedy", grado: "10A", fecha: "2026-09-09", horario: horario, defE: "Activa" },
    ],
  });
  const clase = result.events.find((e) => e.type === "CLASE");
  assert.equal(clase.allDay, true);
});
