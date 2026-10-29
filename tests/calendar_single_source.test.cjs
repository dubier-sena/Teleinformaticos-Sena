"use strict";
// Fuente unica del calendario (2026-10-28): la agenda administrativa toma las CLASES de las sesiones por
// ficha (las mismas que ve el aprendiz), el menu abre el calendario por ficha y el calendario anterior
// queda en solo consulta. Sin sesiones legibles, la agenda usa el anterior y lo AVISA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const realAgenda = require(path.join(root, "js/academic_agenda.js"));
const realCloud = require(path.join(root, "js/academic_calendar_cloud.js"));

const FICHA_MAP = {
  "3441939": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A", guias: [] },
  "3441942": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10B", guias: [] },
};
const RECORDS = [
  { id: 1, fecha: "2026-10-27", tipo: "CLASE", colegio: "I.E. Jhon F. Kennedy", grado: "10B", horario: "2:10pm–6:10pm", defE: "Activa", defO: "" },
  { id: 2, fecha: "2026-10-20", tipo: "SENA", colegio: "I.E. Jhon F. Kennedy", grado: "10B", horario: "-", defE: "SEDE SENA", defO: "Cumplir horario en el Sena" },
];
const SESSION = { id: "s_2026_10_27_10b", ficha: "3441942", year: 2026, date: "2026-10-27", originalDate: "2026-10-27", blocks: [{ start: "14:10", end: "18:10" }],
  plannedMinutes: 240, actualMinutes: null, status: "Impartida", activity: "", evidence: "", dueDate: "", curriculum: {}, sourceStatuses: [], origin: "new", protected: false, revision: 1 };

function loadAdminContext(extra) {
  const store = {};
  const sandbox = {
    console, Set, Promise, JSON, Object, Array, String, Number, Date, Math, RegExp, encodeURIComponent, setTimeout, clearTimeout,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  };
  sandbox.window = sandbox;
  sandbox.academicAgenda = realAgenda;
  sandbox.CALENDAR_2026_RECORDS = RECORDS;
  sandbox.portalAuth = { FICHA_MAP, getGuidesForFicha: () => [], getGuideTitle: () => "", getGuideHref: () => "", getStudentsWithProgress: () => [], listStudents: () => [] };
  Object.assign(sandbox, extra || {});
  vm.createContext(sandbox);
  vm.runInContext(read("js/academic_agenda_context.js"), sandbox);
  vm.runInContext(read("js/academic_agenda_admin_context.js"), sandbox);
  return sandbox.academicAgendaAdminContext;
}

function connection({ role = "admin", fail = null, sessions = [SESSION] } = {}) {
  const calls = [];
  return {
    calls,
    factory: () => ({
      principal: async () => { if (fail) throw new Error(fail); return { role, fichas: ["3441939", "3441942"] }; },
      listCached: async (ficha, year) => { calls.push(ficha + "/" + year); return { docs: sessions.filter((s) => s.ficha === ficha).map((data) => ({ data })) }; },
    }),
  };
}

test("con el calendario seguro activo, las clases salen de las sesiones y se conservan los eventos institucionales", async () => {
  const c = connection();
  const mod = loadAdminContext({ SENA_CALENDAR_FIRESTORE: { enabled: true }, academicCalendarConnection: c.factory, academicCalendarCloud: realCloud });
  const r = await mod.resolveAdminAgendaContext({ fichas: ["3441939", "3441942"], year: 2026 });
  assert.equal(r.classSource, "sessions");
  assert.equal(r.classSourceError, null);
  assert.deepEqual(c.calls, ["3441939/2026", "3441942/2026"]);
  const classes = r.events.filter((e) => e.type === "CLASE");
  assert.equal(classes.length, 1);
  assert.equal(classes[0].source, "calendar-cloud");
  assert.equal(classes[0].status, "taught", "el 27-oct se ve Impartida, como lo ve el aprendiz");
  assert.ok(!r.events.some((e) => e.source === "calendar" && e.type === "CLASE"), "ninguna clase del calendario anterior");
  assert.ok(r.events.some((e) => e.source === "calendar" && e.type === "ACTIVIDAD_ESPECIAL"), "el día SENA del anterior se conserva");
});

test("si no se pueden leer las sesiones, usa el calendario anterior y devuelve el motivo", async () => {
  const c = connection({ fail: "Sesión de Firebase no disponible" });
  const mod = loadAdminContext({ SENA_CALENDAR_FIRESTORE: { enabled: true }, academicCalendarConnection: c.factory, academicCalendarCloud: realCloud });
  const r = await mod.resolveAdminAgendaContext({ fichas: ["3441942"], year: 2026 });
  assert.equal(r.classSource, "legacy-fallback");
  assert.match(r.classSourceError, /Firebase no disponible/);
  assert.ok(r.events.some((e) => e.source === "calendar" && e.type === "CLASE"));
});

test("una sesión que no es de administrador no alimenta la agenda administrativa", async () => {
  const c = connection({ role: "aprendiz" });
  const mod = loadAdminContext({ SENA_CALENDAR_FIRESTORE: { enabled: true }, academicCalendarConnection: c.factory, academicCalendarCloud: realCloud });
  const r = await mod.resolveAdminAgendaContext({ fichas: ["3441942"], year: 2026 });
  assert.equal(r.classSource, "legacy-fallback");
  assert.match(r.classSourceError, /administrador/);
});

test("sin calendario seguro activo, la agenda sigue igual que antes", async () => {
  const mod = loadAdminContext({});
  const r = await mod.resolveAdminAgendaContext({ fichas: ["3441942"], year: 2026 });
  assert.equal(r.classSource, "legacy");
  assert.equal(r.classSourceError, null);
  assert.ok(r.events.some((e) => e.source === "calendar" && e.type === "CLASE"));
});

test("la agenda administrativa carga el cliente del calendario seguro antes de su contexto", () => {
  const html = read("calendario-administrativo-agenda.html");
  const at = (f) => html.indexOf('src="js/' + f);
  for (const f of ["academic_calendar_release_config.js", "academic_calendar_cloud.js", "academic_calendar_connection.js"]) {
    assert.ok(at(f) > 0, f);
    assert.ok(at(f) < at("academic_agenda_admin_context.js"), f + " antes del contexto");
  }
});

test("la página de la agenda desactiva la «Clase» manual cuando las clases vienen de las sesiones", () => {
  const src = read("js/calendario_admin_agenda_page.js");
  assert.match(src, /function syncManualClassOption\(sessionsActive\)/);
  assert.match(src, /syncManualClassOption\(state\.classSource === "sessions"\)/);
  assert.match(src, /legacy-fallback/);
});

test("el menú «Calendario» abre el calendario por ficha", () => {
  const shell = read("js/shared_shell.js");
  assert.match(shell, /href="' \+ p \+ 'calendario-academico-sesiones\.html" data-nav-key="calendario"/);
  assert.doesNotMatch(shell, /calendario-academico-2026\.html" data-nav-key="calendario"/);
});

test("el inicio del admin conserva el calendario anterior como solo consulta", () => {
  const html = read("index.html");
  assert.match(html, /href="calendario-academico-sesiones\.html"[\s\S]*?Calendario 2026 \(por ficha\)/);
  assert.match(html, /href="calendario-academico-2026\.html"[\s\S]*?Calendario anterior \(solo consulta\)/);
});

function loadReadonly(enabled) {
  const elements = {};
  const el = (id) => (elements[id] = elements[id] || { id, hidden: false, disabled: false, textContent: "", setAttribute() {}, appendChild() {} });
  let saved = 0;
  const sandbox = {
    SENA_CALENDAR_FIRESTORE: enabled ? { enabled: true } : undefined,
    saveModal: () => { saved++; }, toggleFestivo: () => { saved++; }, resetCalendar: () => { saved++; },
    syncFirebaseState: () => { saved++; return Promise.resolve(true); }, closeModal: () => {},
    document: {
      readyState: "complete",
      getElementById: (id) => (id === "calendar-readonly-notice" && !elements[id] ? null : el(id)),
      querySelector: () => el("btn-save"),
      createElement: () => ({ setAttribute() {}, appendChild() {} }),
      body: { insertBefore() {}, firstChild: null },
    },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("js/legacy_calendar_readonly.js"), sandbox);
  return { sandbox, elements, saved: () => saved };
}

test("calendario anterior: con el calendario seguro activo no guarda nada y oculta Guardar/Restaurar", async () => {
  const { sandbox, elements, saved } = loadReadonly(true);
  sandbox.saveModal(); sandbox.toggleFestivo("2026-10-27"); sandbox.resetCalendar();
  assert.equal(await sandbox.syncFirebaseState(true), false);
  assert.equal(saved(), 0, "ninguna función original de escritura se ejecutó");
  assert.equal(elements["firebase-sync-button"].hidden, true);
  assert.equal(elements["calendar-reset-button"].hidden, true);
  assert.equal(elements["btn-save"].hidden, true);
  assert.equal(sandbox.legacyCalendarReadonly.active, true);
});

test("calendario anterior: sin calendario seguro activo no cambia nada", async () => {
  const { sandbox, saved } = loadReadonly(false);
  sandbox.saveModal();
  assert.equal(await sandbox.syncFirebaseState(true), true);
  assert.equal(saved(), 2);
  assert.equal(sandbox.legacyCalendarReadonly, undefined);
});

test("calendario anterior: el script de solo consulta se carga después del motor en línea", () => {
  const html = read("calendario-academico-2026.html");
  const engine = html.lastIndexOf("function syncFirebaseState");
  assert.ok(html.indexOf('src="js/academic_calendar_release_config.js') > engine);
  assert.ok(html.indexOf('src="js/legacy_calendar_readonly.js') > engine);
});
