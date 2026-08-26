"use strict";

// Bloque E (vistas y horarios, 2026-08-26): pruebas de las vistas
// Agenda/Semana/Mes agregadas a js/student_calendar.js -- en particular la
// garantia "el aprendiz solo visualiza, nunca edita" (ni eventos derivados
// ni avisos manuales del admin) y que el aprendiz usa el guard de
// autenticado, no el de admin.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fakeDocument() {
  return {
    readyState: "complete",
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {},
  };
}

function loadStudentCalendarModule() {
  var sandbox = {
    console: console, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    Number: Number, Date: Date, Math: Math, RegExp: RegExp,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    document: fakeDocument(),
    portalAuth: { getCurrentSession: function () { return null; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("js/student_calendar.js"), sandbox, { filename: "student_calendar.js" });
  return sandbox.window.studentCalendar;
}

test("student_calendar.js carga sin errores y expone __test.eventDateKey", () => {
  const mod = loadStudentCalendarModule();
  assert.equal(mod.__test.eventDateKey({ dueAt: "2026-09-01T23:59:00-05:00" }), "2026-09-01");
  assert.equal(mod.__test.eventDateKey({ startAt: "2026-09-02T09:00:00-05:00" }), "2026-09-02");
  assert.equal(mod.__test.eventDateKey({ date: "2026-09-03" }), "2026-09-03");
});

// ── Garantia: el aprendiz NUNCA edita (ni derivados ni manuales) ─────────

test("student_calendar.js NUNCA referencia acciones de edicion/eliminacion de eventos manuales", () => {
  const source = read("js/student_calendar.js");
  assert.doesNotMatch(source, /data-manual-edit/);
  assert.doesNotMatch(source, /data-manual-delete/);
  assert.doesNotMatch(source, /saveManualEvent/);
  assert.doesNotMatch(source, /deleteManualEvent/);
  assert.doesNotMatch(source, /handleDeleteManual/);
});

test("student_calendar.js SI usa loadManualAgendaEvents (lectura) del modulo compartido", () => {
  const source = read("js/student_calendar.js");
  assert.match(source, /loadManualAgendaEvents/);
});

test("renderCard del aprendiz nunca produce botones de editar/eliminar (regex de la plantilla)", () => {
  const source = read("js/student_calendar.js");
  const renderCardBody = source.slice(source.indexOf("function renderCard"), source.indexOf("function renderMessage"));
  assert.doesNotMatch(renderCardBody, /Editar|Eliminar/);
});

// ── La pagina del aprendiz usa el guard de autenticado, no el de admin ───

test("calendario-aprendiz.html usa access_guard_authenticated.js (no access_guard_admin.js)", () => {
  const html = read("pages/auxiliares/calendario-aprendiz.html");
  assert.match(html, /access_guard_authenticated\.js/);
  assert.doesNotMatch(html, /access_guard_admin\.js/);
});

test("calendario-aprendiz.html carga los 4 modulos compartidos de vistas + eventos manuales en solo lectura", () => {
  const html = read("pages/auxiliares/calendario-aprendiz.html");
  assert.match(html, /academic_agenda_views\.js/);
  assert.match(html, /academic_agenda_calendar_ui\.js/);
  assert.match(html, /agenda_view_preference\.js/);
  assert.match(html, /calendario_admin_manual_events\.js/);
});

test("calendario-aprendiz.html tiene los contenedores de Semana/Mes y el modal de detalle de dia", () => {
  const html = read("pages/auxiliares/calendario-aprendiz.html");
  assert.match(html, /id="sc-week"/);
  assert.match(html, /id="sc-month"/);
  assert.match(html, /id="sc-view-switcher"/);
  assert.match(html, /id="sc-day-detail-modal"/);
});

// ── Filtro de eventos manuales por ficha (evento general vs. de una ficha especifica) ──

test("loadManualEventsForFicha: filtra por ficha O evento general (sin ficha) -- verificado por codigo fuente", () => {
  const source = read("js/student_calendar.js");
  const fnBody = source.slice(source.indexOf("function loadManualEventsForFicha"), source.indexOf("async function loadAndRender"));
  assert.match(fnBody, /!ev\.ficha \|\| String\(ev\.ficha\) === String\(ficha\)/);
});
