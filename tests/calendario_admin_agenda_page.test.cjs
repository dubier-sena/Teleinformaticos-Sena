"use strict";

// Bloque D (Calendario Administrativo, 2026-08-25): pruebas de los filtros
// de PRESENTACION (tipo/estado/guia/rango de fechas) de
// js/calendario_admin_agenda_page.js -- puramente sobre eventos ya
// cargados, sin red. Sandboxed con vm.createContext porque el archivo
// arranca su propio bootstrap al cargar (mismo patron que student_calendar.js);
// se le da un document minimo (getElementById/querySelector -> null,
// readyState "complete") para que el bootstrap no falle por falta de DOM
// real -- todos los handlers ya son null-guardados en el archivo real.

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

function loadPageModule() {
  var sandbox = {
    console: console, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    Number: Number, Date: Date, Math: Math, RegExp: RegExp,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    document: fakeDocument(),
    portalAuth: { getCurrentSession: function () { return null; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("js/calendario_admin_agenda_page.js"), sandbox, { filename: "calendario_admin_agenda_page.js" });
  return sandbox.window.calendarioAdminAgendaPage;
}

function baseEvents() {
  return [
    { id: "e1", type: "ENTREGA", status: "pending", sourceId: "guia-a.html::act1", dueAt: "2026-09-01T23:59:00-05:00", date: "2026-09-01" },
    { id: "e2", type: "CLASE", status: "scheduled", sourceId: "calendar:rec1:0", date: "2026-09-02", startAt: "2026-09-02T09:00:00-05:00" },
    { id: "e3", type: "BITACORA", status: "overdue", sourceId: "bitacora-1", dueAt: "2026-08-20T23:59:00-05:00", date: "2026-08-20" },
    { id: "e4", type: "ACTIVIDAD_ESPECIAL", status: "scheduled", sourceId: "manual-1", date: "2026-09-10" },
  ];
}

// ── eventDateKey ────────────────────────────────────────────────────────

test("eventDateKey: prioriza dueAt, luego startAt, luego date", () => {
  const mod = loadPageModule();
  assert.equal(mod.__test.eventDateKey({ dueAt: "2026-09-01T23:59:00-05:00" }), "2026-09-01");
  assert.equal(mod.__test.eventDateKey({ startAt: "2026-09-02T09:00:00-05:00" }), "2026-09-02");
  assert.equal(mod.__test.eventDateKey({ date: "2026-09-03" }), "2026-09-03");
  assert.equal(mod.__test.eventDateKey({}), "");
});

// ── applyPresentationFilters ────────────────────────────────────────────

test("applyPresentationFilters: sin filtros devuelve todos los eventos", () => {
  const mod = loadPageModule();
  const result = mod.__test.applyPresentationFilters(baseEvents());
  assert.equal(result.length, 4);
});

test("applyPresentationFilters: filtro por tipo", () => {
  const mod = loadPageModule();
  const result = mod.__test.applyPresentationFilters(baseEvents(), { tipo: "ENTREGA" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "e1");
});

test("applyPresentationFilters: filtro por estado (overdue) trae solo la bitacora vencida", () => {
  const mod = loadPageModule();
  const result = mod.__test.applyPresentationFilters(baseEvents(), { estado: "overdue" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "e3");
});

test("applyPresentationFilters: filtro por guia (prefijo de sourceId) trae solo esa guia", () => {
  const mod = loadPageModule();
  const result = mod.__test.applyPresentationFilters(baseEvents(), { guia: "guia-a.html" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "e1");
});

test("applyPresentationFilters: rango de fechas excluye eventos fuera de rango", () => {
  const mod = loadPageModule();
  const result = mod.__test.applyPresentationFilters(baseEvents(), { desde: "2026-09-01", hasta: "2026-09-05" });
  const ids = result.map((e) => e.id).sort();
  assert.deepEqual(ids, ["e1", "e2"]);
});

test("applyPresentationFilters: combina 2 filtros a la vez (tipo + estado)", () => {
  const mod = loadPageModule();
  const events = baseEvents().concat([{ id: "e5", type: "ENTREGA", status: "overdue", sourceId: "guia-b.html::act9", date: "2026-09-05" }]);
  const result = mod.__test.applyPresentationFilters(events, { tipo: "ENTREGA", estado: "overdue" });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "e5");
});

// ── Seguridad estructural: la pagina nueva usa el guard de admin ────────

test("calendario-administrativo-agenda.html carga access_guard_admin.js (no el de aprendiz)", () => {
  const html = read("calendario-administrativo-agenda.html");
  assert.match(html, /access_guard_admin\.js/);
  assert.doesNotMatch(html, /access_guard_authenticated\.js/);
});

test("calendario-administrativo-agenda.html carga los 3 modulos nuevos del bloque D", () => {
  const html = read("calendario-administrativo-agenda.html");
  assert.match(html, /academic_agenda_admin_context\.js/);
  assert.match(html, /calendario_admin_manual_events\.js/);
  assert.match(html, /calendario_admin_agenda_page\.js/);
});

test("calendario-administrativo-agenda.html esta enlazada desde index.html", () => {
  const indexHtml = read("index.html");
  assert.match(indexHtml, /href="calendario-administrativo-agenda\.html"/);
});

// ── Bloque E: vistas Semana/Mes + todo-el-dia/franjas en el formulario ───

test("calendario-administrativo-agenda.html carga los modulos compartidos de vistas (Bloque E)", () => {
  const html = read("calendario-administrativo-agenda.html");
  assert.match(html, /academic_agenda_views\.js/);
  assert.match(html, /academic_agenda_calendar_ui\.js/);
  assert.match(html, /agenda_view_preference\.js/);
  assert.match(html, /academic_agenda_calendar\.css/);
});

test("calendario-administrativo-agenda.html tiene los contenedores de Semana/Mes, el selector de vista y el modal de detalle de dia", () => {
  const html = read("calendario-administrativo-agenda.html");
  assert.match(html, /id="aa-week"/);
  assert.match(html, /id="aa-month"/);
  assert.match(html, /id="aa-view-switcher"/);
  assert.match(html, /id="aa-view-nav"/);
  assert.match(html, /id="aa-day-detail-modal"/);
});

test("el formulario de evento manual tiene el checkbox Todo el dia y la seccion de franjas dinamicas", () => {
  const html = read("calendario-administrativo-agenda.html");
  assert.match(html, /id="aa-manual-allday"/);
  assert.match(html, /id="aa-manual-slots-list"/);
  assert.match(html, /id="aa-manual-add-slot"/);
  // Ya NO debe quedar el par fijo startAt/endAt de un solo horario (Bloque D)
  assert.doesNotMatch(html, /name="startAt"/);
  assert.doesNotMatch(html, /name="endAt"/);
});
