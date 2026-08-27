"use strict";

// Bloque E: js/academic_agenda_calendar_ui.js -- constructor de HTML (string)
// para Semana/Mes, sin DOM. Se prueba con aserciones de texto/regex sobre
// el HTML devuelto (mismo enfoque ya usado en otros modulos de este
// proyecto para paginas grandes, ver tests/*_page.test.cjs).

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const ui = require(path.join(__dirname, "..", "js", "academic_agenda_calendar_ui.js"));
const views = require(path.join(__dirname, "..", "js", "academic_agenda_views.js"));

// ── Selector de vista ───────────────────────────────────────────────────

test("renderViewSwitcher: marca la vista activa con is-active/aria-selected", () => {
  const html = ui.renderViewSwitcher("week", "sc");
  assert.match(html, /data-sc-view="week"[^>]*class="aac-view-switcher__btn is-active"|class="aac-view-switcher__btn is-active"[^>]*data-sc-view="week"/);
  assert.match(html, /data-sc-view="agenda"/);
  assert.match(html, /data-sc-view="month"/);
});

test("renderViewSwitcher: solo la vista activa tiene aria-selected=true", () => {
  const html = ui.renderViewSwitcher("agenda", "sc");
  const trueCount = (html.match(/aria-selected="true"/g) || []).length;
  assert.equal(trueCount, 1);
});

// ── Semana ──────────────────────────────────────────────────────────────

test("renderWeekGrid: 7 columnas de dia, una por cada dia del modelo", () => {
  const week = views.buildWeekView({ events: [], referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  const cols = html.match(/aac-week__daycol(?!-head)[^"]*" data-day-key="[^"]+"/g) || [];
  assert.equal(cols.length, 7);
});

test("renderWeekGrid: un evento aparece como chip dentro de su columna, con top/height coherentes", () => {
  const event = { id: "e1", type: "CLASE", status: "scheduled", title: "Clase de prueba", startAt: "2026-09-09T14:10:00-05:00", endAt: "2026-09-09T16:15:00-05:00" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00", hourStart: 6, hourEnd: 20 });
  const html = ui.renderWeekGrid(week);
  assert.match(html, /data-event-id="e1"/);
  assert.match(html, /Clase de prueba/);
  // 14:10 dentro de 6-20h (840 min de rango): (14*60+10 - 6*60)/840 = 0.5595 -> ~56%
  const topMatch = html.match(/top:(\d+\.\d+)%;height:(\d+\.\d+)%/);
  assert.ok(topMatch, "debe tener un bloque posicionado con top/height");
  const top = parseFloat(topMatch[1]);
  assert.ok(top > 50 && top < 62, "top esperado ~56%, obtenido " + top);
});

test("renderWeekGrid: evento todo-el-dia aparece en la fila de arriba, no como bloque posicionado", () => {
  const event = { id: "allday1", type: "ACTIVIDAD_ESPECIAL", status: "scheduled", title: "Evento general", allDay: true, date: "2026-09-10" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  assert.match(html, /aac-week__allday-row/);
  assert.match(html, /aac-chip--allday/);
});

test("renderWeekGrid: sin eventos todo-el-dia, no se renderiza la fila (ahorra espacio vertical)", () => {
  const week = views.buildWeekView({ events: [], referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  assert.doesNotMatch(html, /aac-week__allday-row/);
});

test("renderWeekGrid: dos franjas en el mismo dia producen dos bloques distintos", () => {
  const events = [
    { id: "s1", type: "CLASE", status: "scheduled", title: "Franja 1", startAt: "2026-09-09T08:00:00-05:00", endAt: "2026-09-09T10:00:00-05:00" },
    { id: "s2", type: "CLASE", status: "scheduled", title: "Franja 2", startAt: "2026-09-09T14:10:00-05:00", endAt: "2026-09-09T16:15:00-05:00" },
  ];
  const week = views.buildWeekView({ events: events, referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  assert.match(html, /data-event-id="s1"/);
  assert.match(html, /data-event-id="s2"/);
  assert.equal((html.match(/aac-week__block/g) || []).length, 2);
});

test("renderWeekGrid: escapa HTML en el titulo (sin XSS)", () => {
  const event = { id: "xss1", type: "CLASE", status: "scheduled", title: '<img src=x onerror=alert(1)>', startAt: "2026-09-09T08:00:00-05:00", endAt: "2026-09-09T09:00:00-05:00" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

// Bloque F.1: el titulo de un evento CLASE es siempre el texto generico
// "Clase" (ver TYPE_META) -- sin la hora como texto en el chip, dos franjas
// del mismo dia eran indistinguibles salvo por su posicion (top/height),
// invisible al leer el HTML o al usar un lector de pantalla. La Agenda
// (lista) y el detalle al hacer clic ya mostraban la hora real vía
// description/startAt; solo la capa visual del chip de semana no la
// exponia como texto.
test("renderWeekGrid: el chip de una franja de clase muestra la hora como texto (no solo top/height)", () => {
  const event = { id: "c1", type: "CLASE", status: "scheduled", title: "Clase", startAt: "2026-09-09T14:35:00-05:00", endAt: "2026-09-09T18:10:00-05:00" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00", hourStart: 6, hourEnd: 20 });
  const html = ui.renderWeekGrid(week);
  assert.match(html, /aac-chip__time">2:35 p\. m\.–6:10 p\. m\./);
  assert.match(html, /title="Clase · 2:35 p\. m\.–6:10 p\. m\."/);
});

test("renderWeekGrid: sin timeRange (evento todo-el-dia), el chip no agrega aac-chip__time", () => {
  const event = { id: "allday1", type: "ACTIVIDAD_ESPECIAL", status: "scheduled", title: "Evento general", allDay: true, date: "2026-09-10" };
  const week = views.buildWeekView({ events: [event], referenceIso: "2026-09-09T00:00:00-05:00" });
  const html = ui.renderWeekGrid(week);
  assert.doesNotMatch(html, /aac-chip__time/);
});

test("renderMonthGrid: los chips compactos de mes no agregan aac-chip__time (sin cambios de Bloque F.1)", () => {
  const event = { id: "ev1", type: "CLASE", status: "scheduled", title: "Clase", startAt: "2026-09-15T08:00:00-05:00", endAt: "2026-09-15T09:00:00-05:00" };
  const month = views.buildMonthView({ year: 2026, month: 9, events: [event] });
  const html = ui.renderMonthGrid(month);
  assert.doesNotMatch(html, /aac-chip__time/);
});

test("__test.formatMinutesLabel: mismo formato que formatHourLabel en horas exactas, con minutos cuando aplica", () => {
  assert.equal(ui.__test.formatMinutesLabel(0), "12:00 a. m.");
  assert.equal(ui.__test.formatMinutesLabel(12 * 60), "12:00 p. m.");
  assert.equal(ui.__test.formatMinutesLabel(14 * 60 + 35), "2:35 p. m.");
  assert.equal(ui.__test.formatMinutesLabel(23 * 60 + 59), "11:59 p. m.");
  assert.equal(ui.__test.formatMinutesLabel(7 * 60), "7:00 a. m.");
});

// ── Mes ─────────────────────────────────────────────────────────────────

test("renderMonthGrid: septiembre 2026 arma 5 filas de semana x 7 celdas", () => {
  const month = views.buildMonthView({ year: 2026, month: 9, events: [] });
  const html = ui.renderMonthGrid(month);
  assert.equal((html.match(/aac-month__week-row/g) || []).length, 5);
  assert.equal((html.match(/data-month-day="/g) || []).length, 35);
});

test("renderMonthGrid: mas de 3 eventos en un dia -- se limita a 3 y se muestra +N mas", () => {
  const events = [1, 2, 3, 4, 5].map(function (n) {
    return { id: "ev" + n, type: "ENTREGA", status: "pending", title: "Evento " + n, dueAt: "2026-09-15T0" + n + ":00:00-05:00" };
  });
  const month = views.buildMonthView({ year: 2026, month: 9, events: events });
  const html = ui.renderMonthGrid(month, { maxPerDay: 3 });
  assert.match(html, />\+2 más</);
  // Exactamente 3 chips (no 5) para el dia 15
  const day15Match = html.match(/data-month-day="2026-09-15"[\s\S]*?(?=data-month-day="2026-09-16")/);
  assert.ok(day15Match);
  const chipsInDay15 = (day15Match[0].match(/aac-chip--compact/g) || []).length;
  assert.equal(chipsInDay15, 3);
});

test("renderMonthGrid: dia con pocos eventos no muestra boton +N mas", () => {
  const events = [{ id: "ev1", type: "ENTREGA", status: "pending", title: "Uno", dueAt: "2026-09-15T08:00:00-05:00" }];
  const month = views.buildMonthView({ year: 2026, month: 9, events: events });
  const html = ui.renderMonthGrid(month, { maxPerDay: 3 });
  assert.doesNotMatch(html, /aac-month__more/);
});

test("renderMonthGrid: dias fuera del mes llevan la clase is-outside", () => {
  const month = views.buildMonthView({ year: 2026, month: 9, events: [] });
  const html = ui.renderMonthGrid(month);
  assert.match(html, /data-month-day="2026-08-31"[^>]*class="aac-month__day is-outside"|class="aac-month__day is-outside"[^>]*data-month-day="2026-08-31"/);
});

// ── Detalle de dia ──────────────────────────────────────────────────────

test("renderDayDetailList: sin eventos muestra mensaje vacio, no revienta", () => {
  const html = ui.renderDayDetailList([]);
  assert.match(html, /Sin eventos/);
});

test("renderDayDetailList: usa el renderCard inyectado por el llamador (admin vs aprendiz)", () => {
  const events = [{ id: "a1", title: "Algo" }];
  const html = ui.renderDayDetailList(events, { renderCard: function (ev) { return "<div class=\"custom-card\">" + ev.title + "</div>"; } });
  assert.match(html, /custom-card/);
  assert.match(html, />Algo</);
});

// ── formatHourLabel ─────────────────────────────────────────────────────

test("formatHourLabel: medianoche y mediodia se rotulan como 12, no 0", () => {
  assert.equal(ui.__test.formatHourLabel(0), "12 a. m.");
  assert.equal(ui.__test.formatHourLabel(12), "12 p. m.");
  assert.equal(ui.__test.formatHourLabel(13), "1 p. m.");
  assert.equal(ui.__test.formatHourLabel(23), "11 p. m.");
});
