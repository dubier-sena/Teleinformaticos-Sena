"use strict";

// Bloque E (vistas de calendario, 2026-08-26): js/academic_agenda_views.js
// es el modelo de datos PURO para Semana/Mes (requiere() directo, UMD igual
// que academic_agenda.js). Cubre en detalle los casos de huso horario
// pedidos explicitamente: 12:00 a.m., 12:00 p.m., 11:59 p.m. y eventos que
// cruzan medianoche Bogota.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const views = require(path.join(__dirname, "..", "js", "academic_agenda_views.js"));

// ── bogotaParts / bogotaDateKey ─────────────────────────────────────────

test("bogotaParts: America/Bogota es UTC-5 fijo (sin horario de verano)", () => {
  // 17:10 UTC == 12:10 Bogota (UTC-5)
  const p = views.bogotaParts("2026-03-09T17:10:00.000Z");
  assert.equal(p.hour, 12);
  assert.equal(p.minute, 10);
  assert.equal(p.dateKey, "2026-03-09");
});

test("bogotaParts: medianoche exacta en Bogota (12:00 a.m.) -- no debe salir hour:24", () => {
  // 05:00 UTC == 00:00 Bogota
  const p = views.bogotaParts("2026-03-10T05:00:00.000Z");
  assert.equal(p.hour, 0);
  assert.equal(p.minute, 0);
  assert.equal(p.dateKey, "2026-03-10");
});

test("bogotaParts: un minuto antes de medianoche Bogota cae en el dia civil ANTERIOR", () => {
  // 04:59 UTC == 23:59 Bogota del dia anterior
  const p = views.bogotaParts("2026-03-10T04:59:00.000Z");
  assert.equal(p.hour, 23);
  assert.equal(p.minute, 59);
  assert.equal(p.dateKey, "2026-03-09");
});

test("bogotaParts: mediodia (12:00 p.m.) Bogota", () => {
  // 17:00 UTC == 12:00 Bogota
  const p = views.bogotaParts("2026-03-09T17:00:00.000Z");
  assert.equal(p.hour, 12);
  assert.equal(p.minute, 0);
});

test("bogotaParts: entrada invalida o vacia -> null", () => {
  assert.equal(views.bogotaParts(""), null);
  assert.equal(views.bogotaParts("no-es-fecha"), null);
});

// ── resolveEventWindow: franjas libres (2:10-4:15, 2:35-6:10) ──────────────

test("resolveEventWindow: 2:10pm-4:15pm en un solo dia -> un segmento con minutos exactos", () => {
  const event = { startAt: "2026-09-01T14:10:00-05:00", endAt: "2026-09-01T16:15:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.allDay, false);
  assert.equal(win.segments.length, 1);
  assert.equal(win.segments[0].dateKey, "2026-09-01");
  assert.equal(win.segments[0].startMin, 14 * 60 + 10);
  assert.equal(win.segments[0].endMin, 16 * 60 + 15);
});

test("resolveEventWindow: 2:35pm-6:10pm (minutos arbitrarios, no bloques predefinidos)", () => {
  const event = { startAt: "2026-09-01T14:35:00-05:00", endAt: "2026-09-01T18:10:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.segments[0].startMin, 14 * 60 + 35);
  assert.equal(win.segments[0].endMin, 18 * 60 + 10);
});

test("resolveEventWindow: 7:00am-11:45am", () => {
  const event = { startAt: "2026-09-01T07:00:00-05:00", endAt: "2026-09-01T11:45:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.segments[0].startMin, 7 * 60);
  assert.equal(win.segments[0].endMin, 11 * 60 + 45);
});

// ── Todo el dia ─────────────────────────────────────────────────────────

test("resolveEventWindow: evento todo-el-dia no exige hora, un solo segmento por date", () => {
  const event = { allDay: true, date: "2026-09-05" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.allDay, true);
  assert.equal(win.segments.length, 1);
  assert.equal(win.segments[0].dateKey, "2026-09-05");
  assert.equal(win.segments[0].startMin, undefined);
});

// ── Entrega con dueAt (marcador puntual, sin inventar un horario real) ─────

test("resolveEventWindow: ENTREGA con dueAt y sin startAt/endAt -> marcador de 30 min", () => {
  const event = { type: "ENTREGA", dueAt: "2026-09-10T18:00:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.allDay, false);
  assert.equal(win.segments.length, 1);
  assert.equal(win.segments[0].startMin, 18 * 60);
  assert.equal(win.segments[0].endMin, 18 * 60 + 30);
});

test("resolveEventWindow: dueAt a las 11:59 p.m. exactas -- el marcador cruza a medianoche", () => {
  const event = { dueAt: "2026-09-10T23:59:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.segments.length, 2);
  assert.equal(win.segments[0].dateKey, "2026-09-10");
  assert.equal(win.segments[0].endMin, 1440);
  assert.equal(win.segments[1].dateKey, "2026-09-11");
  assert.equal(win.segments[1].startMin, 0);
  assert.equal(win.segments[1].endMin, 29);
});

// ── Eventos que cruzan medianoche (startAt/endAt reales, no marcador) ──────

test("resolveEventWindow: evento real que termina al cambiar de dia -> 2 segmentos correctos", () => {
  const event = { startAt: "2026-09-10T23:00:00-05:00", endAt: "2026-09-11T00:30:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.allDay, false);
  assert.equal(win.segments.length, 2);
  assert.equal(win.segments[0].dateKey, "2026-09-10");
  assert.equal(win.segments[0].startMin, 23 * 60);
  assert.equal(win.segments[0].endMin, 1440);
  assert.equal(win.segments[1].dateKey, "2026-09-11");
  assert.equal(win.segments[1].startMin, 0);
  assert.equal(win.segments[1].endMin, 30);
});

test("resolveEventWindow: endAt <= startAt (dato invalido) -- no rompe, aplica marcador minimo", () => {
  const event = { startAt: "2026-09-01T14:00:00-05:00", endAt: "2026-09-01T14:00:00-05:00" };
  const win = views.resolveEventWindow(event);
  assert.equal(win.segments.length, 1);
  assert.equal(win.segments[0].startMin, 14 * 60);
  assert.ok(win.segments[0].endMin > win.segments[0].startMin);
});

test("resolveEventWindow: sin ninguna fecha -> allDay:true con segments vacio (no se ubica, no truena)", () => {
  const win = views.resolveEventWindow({});
  assert.equal(win.allDay, true);
  assert.equal(win.segments.length, 0);
});

// ── buildWeekView ───────────────────────────────────────────────────────

test("buildWeekView: 7 dias, semana Lunes-Domingo, dateKeys consecutivos", () => {
  const week = views.buildWeekView({ events: [], referenceIso: "2026-09-09T12:00:00-05:00" }); // miercoles
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0].weekdayIndex, 1); // lunes
  assert.equal(week.days[6].weekdayIndex, 0); // domingo
  assert.equal(week.weekStartDateKey, "2026-09-07");
  assert.equal(week.weekEndDateKey, "2026-09-13");
});

test("buildWeekView: evento 2:10-4:15 aparece en el dia correcto con los minutos correctos", () => {
  const event = { id: "e1", startAt: "2026-09-09T14:10:00-05:00", endAt: "2026-09-09T16:15:00-05:00" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const wed = week.days.find((d) => d.dateKey === "2026-09-09");
  assert.equal(wed.timedSegments.length, 1);
  assert.equal(wed.timedSegments[0].startMin, 14 * 60 + 10);
  assert.equal(wed.timedSegments[0].event.id, "e1");
});

test("buildWeekView: evento todo-el-dia va en allDayEvents del dia correcto, no en timedSegments", () => {
  const event = { id: "allday1", allDay: true, date: "2026-09-10" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const thu = week.days.find((d) => d.dateKey === "2026-09-10");
  assert.equal(thu.allDayEvents.length, 1);
  assert.equal(thu.timedSegments.length, 0);
});

test("buildWeekView: dos franjas en el mismo dia -- ambas aparecen (8-10 y 14:10-16:15)", () => {
  const events = [
    { id: "s1", startAt: "2026-09-09T08:00:00-05:00", endAt: "2026-09-09T10:00:00-05:00" },
    { id: "s2", startAt: "2026-09-09T14:10:00-05:00", endAt: "2026-09-09T16:15:00-05:00" },
  ];
  const week = views.buildWeekView({ events: events, referenceIso: "2026-09-09T00:00:00-05:00" });
  const wed = week.days.find((d) => d.dateKey === "2026-09-09");
  assert.equal(wed.timedSegments.length, 2);
  assert.equal(wed.timedSegments[0].event.id, "s1");
  assert.equal(wed.timedSegments[1].event.id, "s2");
});

test("buildWeekView: evento fuera del rango 6-20h expande hourStart/hourEnd (nunca se recorta)", () => {
  const event = { id: "temprano", startAt: "2026-09-09T04:30:00-05:00", endAt: "2026-09-09T05:00:00-05:00" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  assert.ok(week.hourStart <= 4);
});

test("buildWeekView: evento que cruza medianoche entre sabado y domingo aparece en ambas columnas de la semana", () => {
  const event = { id: "cruce", startAt: "2026-09-12T23:00:00-05:00", endAt: "2026-09-13T00:30:00-05:00" }; // sabado->domingo
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const sat = week.days.find((d) => d.dateKey === "2026-09-12");
  const sun = week.days.find((d) => d.dateKey === "2026-09-13");
  assert.equal(sat.timedSegments.length, 1);
  assert.equal(sun.timedSegments.length, 1);
  assert.equal(sat.timedSegments[0].endMin, 1440);
  assert.equal(sun.timedSegments[0].startMin, 0);
});

test("buildWeekView: isToday marca el dia correcto usando un 'now' inyectado (deterministico)", () => {
  const now = new Date("2026-09-10T15:00:00-05:00");
  const week = views.buildWeekView({ referenceIso: "2026-09-09T00:00:00-05:00", now: now, events: [] });
  const flagged = week.days.filter((d) => d.isToday);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].dateKey, "2026-09-10");
});

// ── buildMonthView ──────────────────────────────────────────────────────

test("buildMonthView: cubre el mes completo sin semanas vacias de mas (septiembre 2026 empieza martes)", () => {
  const month = views.buildMonthView({ year: 2026, month: 9, events: [] });
  const lastWeek = month.weeks[month.weeks.length - 1];
  const flatDays = month.weeks.flat();
  const day30 = flatDays.find((d) => d.dateKey === "2026-09-30");
  assert.ok(day30, "el 30 de septiembre debe estar en la grilla");
  assert.equal(day30.inMonth, true);
  assert.equal(lastWeek.length, 7);
  assert.equal(month.weeks.length, 5, "septiembre 2026 (empieza martes, 30 dias) cabe en 5 semanas");
});

test("buildMonthView: dias fuera del mes (relleno) tienen inMonth:false", () => {
  const month = views.buildMonthView({ year: 2026, month: 9, events: [] });
  const firstCell = month.weeks[0][0];
  // Septiembre 2026 empieza martes -> la celda del lunes anterior es de agosto
  assert.equal(firstCell.dateKey, "2026-08-31");
  assert.equal(firstCell.inMonth, false);
});

test("buildMonthView: eventos del dia quedan ordenados y agrupados por dateKey", () => {
  const events = [
    { id: "tarde", dueAt: "2026-09-15T18:00:00-05:00" },
    { id: "manana", dueAt: "2026-09-15T08:00:00-05:00" },
  ];
  const month = views.buildMonthView({ year: 2026, month: 9, events: events });
  const day15 = month.weeks.flat().find((d) => d.dateKey === "2026-09-15");
  assert.equal(day15.events.length, 2);
  assert.equal(day15.events[0].id, "manana");
  assert.equal(day15.events[1].id, "tarde");
});

test("buildMonthView: isToday con 'now' inyectado", () => {
  const now = new Date("2026-09-15T10:00:00-05:00");
  const month = views.buildMonthView({ year: 2026, month: 9, events: [], now: now });
  const flagged = month.weeks.flat().filter((d) => d.isToday);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].dateKey, "2026-09-15");
});

// ── Compatibilidad legacy: clase con "date"+"horario" ya viene con startAt/endAt
// desde academic_agenda.js (parseHorarioSlots) -- se prueba la integracion real ──

test("integracion real: un registro de clase legacy con horario ya produce startAt/endAt consumibles por buildWeekView", () => {
  const agenda = require(path.join(__dirname, "..", "js", "academic_agenda.js"));
  const result = agenda.buildAcademicAgenda({
    context: { ficha: "3441939", grupo: "10A", institucionShort: "I.E. Jhon F. Kennedy" },
    calendarRecords: [
      { id: "rec1", tipo: "CLASE", colegio: "I.E. Jhon F. Kennedy", grado: "10A", fecha: "2026-09-09", horario: "2:10pm-4:15pm", defE: "Activa" },
    ],
  });
  const claseEvent = result.events.find((e) => e.type === "CLASE");
  assert.ok(claseEvent.startAt, "el evento legacy ya trae startAt real (parseHorarioSlots)");
  const week = views.buildWeekView({ events: result.events, referenceIso: "2026-09-09T00:00:00-05:00" });
  const wed = week.days.find((d) => d.dateKey === "2026-09-09");
  assert.equal(wed.timedSegments.length, 1);
  assert.equal(wed.timedSegments[0].startMin, 14 * 60 + 10);
});
