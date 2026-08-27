"use strict";

// Bloque D (Calendario Administrativo, 2026-08-25): js/calendario_admin_manual_events.js
// CRUD de eventos manuales, en su PROPIA coleccion de calendario
// (calendario_2026_manual_events) para que nunca se mezclen con datos
// derivados. Sandboxed con vm.createContext (modulo de navegador, no UMD).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadSandbox(overrides) {
  var sandbox = {
    console: console, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    Number: Number, Date: Date, Math: Math,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
  };
  sandbox.window = sandbox;
  Object.assign(sandbox.window, overrides || {});
  vm.createContext(sandbox);
  vm.runInContext(read("js/calendario_admin_manual_events.js"), sandbox, { filename: "calendario_admin_manual_events.js" });
  return sandbox.window.calendarioAdminManualEvents;
}

function fakeDb(seed) {
  var saved = { events: (seed && seed.events) || [] };
  var savedCalendarIds = [];
  return {
    __savedCalendarIds: savedCalendarIds,
    cloudGetCalendar: function (calendarId) {
      if (calendarId !== "calendario_2026_manual_events") return Promise.resolve(null);
      return Promise.resolve({ events: saved.events.slice() });
    },
    cloudSaveCalendar: function (calendarId, snapshot) {
      savedCalendarIds.push(calendarId);
      saved.events = Array.isArray(snapshot.events) ? snapshot.events : [];
      return Promise.resolve(true);
    },
    __getSaved: function () { return saved; },
  };
}

// ── Nunca se mezcla con datos derivados: siempre usa su propio calendarId ──

test("CALENDAR_ID es su propia coleccion, distinta de calendario_2026_admin", () => {
  const mod = loadSandbox({ _firebaseDb: fakeDb() });
  assert.equal(mod.CALENDAR_ID, "calendario_2026_manual_events");
  assert.notEqual(mod.CALENDAR_ID, "calendario_2026_admin");
});

test("saveManualEvent: siempre escribe en CALENDAR_ID, nunca en otra coleccion", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  await mod.saveManualEvent({ title: "Reunion de padres", date: "2026-09-10", allDay: true });
  assert.deepEqual(db.__savedCalendarIds, ["calendario_2026_manual_events"]);
});

// ── Validacion ──────────────────────────────────────────────────────────

test("saveManualEvent: rechaza sin titulo", async () => {
  const mod = loadSandbox({ _firebaseDb: fakeDb() });
  const result = await mod.saveManualEvent({ date: "2026-09-10" });
  assert.equal(result.ok, false);
});

test("saveManualEvent: rechaza fecha con formato invalido", async () => {
  const mod = loadSandbox({ _firebaseDb: fakeDb() });
  const result = await mod.saveManualEvent({ title: "Reunion", date: "10/09/2026" });
  assert.equal(result.ok, false);
});

// ── Crear / actualizar / eliminar (round-trip) ─────────────────────────────

test("saveManualEvent + loadManualEventRecords: round-trip crea y se puede leer", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => ({ user: { fullName: "Instructor Uno" } }) } });
  const created = await mod.saveManualEvent({ title: "Recuperacion clase Redes", date: "2026-09-12", ficha: "3441944", status: "scheduled", allDay: true });
  assert.equal(created.ok, true);
  assert.equal(created.record.createdBy, "Instructor Uno");

  const records = await mod.loadManualEventRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Recuperacion clase Redes");
  assert.equal(records[0].ficha, "3441944");
});

test("saveManualEvent: actualizar (mismo id) reemplaza en vez de duplicar y conserva createdAt/createdBy", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => ({ user: { fullName: "Instructor Uno" } }) } });
  const created = await mod.saveManualEvent({ title: "Aviso", date: "2026-09-12", allDay: true });
  const updated = await mod.saveManualEvent({ id: created.record.id, title: "Aviso actualizado", date: "2026-09-13", allDay: true });

  assert.equal(updated.ok, true);
  assert.equal(updated.record.createdAt, created.record.createdAt);
  assert.equal(updated.record.createdBy, created.record.createdBy);

  const records = await mod.loadManualEventRecords();
  assert.equal(records.length, 1, "no debe duplicar, debe reemplazar el mismo id");
  assert.equal(records[0].title, "Aviso actualizado");
});

test("deleteManualEvent: elimina por id sin afectar otros eventos", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const a = await mod.saveManualEvent({ title: "Evento A", date: "2026-09-01", allDay: true });
  await mod.saveManualEvent({ title: "Evento B", date: "2026-09-02", allDay: true });

  const result = await mod.deleteManualEvent(a.record.id);
  assert.equal(result.ok, true);

  const records = await mod.loadManualEventRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].title, "Evento B");
});

test("deleteManualEvent: id inexistente devuelve ok:false sin tocar los existentes", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  await mod.saveManualEvent({ title: "Evento A", date: "2026-09-01", allDay: true });
  const result = await mod.deleteManualEvent("no-existe");
  assert.equal(result.ok, false);
  const records = await mod.loadManualEventRecords();
  assert.equal(records.length, 1);
});

// ── toAgendaEvent: shape compatible con academic_agenda.js, marcado isDerived:false ──

test("toAgendaEvent: produce isDerived:false y type ACTIVIDAD_ESPECIAL (siempre devuelve un array)", () => {
  const mod = loadSandbox({ _firebaseDb: fakeDb() });
  const events = mod.toAgendaEvent({
    id: "manual-1", title: "Reunion", date: "2026-09-10", status: "scheduled",
    ficha: "3441939", createdBy: "admin", createdAt: "2026-08-25T00:00:00.000Z",
    allDay: true,
  });
  assert.equal(events.length, 1);
  const event = events[0];
  assert.equal(event.isDerived, false);
  assert.equal(event.source, "manual");
  assert.equal(event.type, "ACTIVIDAD_ESPECIAL");
  assert.equal(event.id, "manual:manual-1");
});

// ── Bloque E: todo el dia, franjas libres y multiples franjas ──────────────

test("validateInput: todo el dia no exige horas", () => {
  const mod = loadSandbox({});
  const error = mod.__test.validateInput({ title: "Aviso", date: "2026-09-10", allDay: true });
  assert.equal(error, "");
});

test("validateInput: sin todo-el-dia y sin ninguna franja -- rechaza", () => {
  const mod = loadSandbox({});
  const error = mod.__test.validateInput({ title: "Aviso", date: "2026-09-10" });
  assert.match(error, /franja/);
});

test("validateInput: franja incompleta (falta hora fin) -- rechaza", () => {
  const mod = loadSandbox({});
  const error = mod.__test.validateInput({ title: "Aviso", date: "2026-09-10", startAt: "2026-09-10T14:10:00-05:00", endAt: "" });
  assert.match(error, /franja/);
});

test("saveManualEvent: franja horaria libre (2:10pm-4:15pm, minutos arbitrarios) se guarda tal cual", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({
    title: "Reunion", date: "2026-09-10",
    startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00",
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.allDay, false);
  assert.equal(result.record.slots.length, 1);
  assert.equal(result.record.slots[0].startAt, "2026-09-10T14:10:00-05:00");
  assert.equal(result.record.slots[0].endAt, "2026-09-10T16:15:00-05:00");
});

test("saveManualEvent: todo el dia -- ignora cualquier hora que venga en el input", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({
    title: "Feria de servicios", date: "2026-09-10", allDay: true,
    startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00",
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.allDay, true);
  assert.equal(result.record.slots.length, 0);
  assert.equal(result.record.startAt, "");
  assert.equal(result.record.endAt, "");
});

test("saveManualEvent: multiples franjas (8-10 y 14:10-16:15) se guardan las 2, sin obligar a usar mas de una", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({
    title: "Jornada", date: "2026-09-10",
    slots: [
      { startAt: "2026-09-10T08:00:00-05:00", endAt: "2026-09-10T10:00:00-05:00" },
      { startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00" },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.slots.length, 2);
  // Compatibilidad: startAt/endAt singulares = primera franja / ultima franja.
  assert.equal(result.record.startAt, "2026-09-10T08:00:00-05:00");
  assert.equal(result.record.endAt, "2026-09-10T16:15:00-05:00");
});

test("toAgendaEvent: todo el dia produce UN evento allDay:true", () => {
  const mod = loadSandbox({});
  const events = mod.toAgendaEvent({ id: "e1", title: "Feria", date: "2026-09-10", allDay: true, status: "scheduled" });
  assert.equal(events.length, 1);
  assert.equal(events[0].allDay, true);
  assert.equal(events[0].startAt, "");
});

test("toAgendaEvent: una sola franja produce UN evento con ese startAt/endAt", () => {
  const mod = loadSandbox({});
  const events = mod.toAgendaEvent({
    id: "e2", title: "Reunion", date: "2026-09-10", status: "scheduled", allDay: false,
    slots: [{ startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00" }],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "manual:e2");
  assert.equal(events[0].startAt, "2026-09-10T14:10:00-05:00");
  assert.equal(events[0].allDay, false);
});

test("toAgendaEvent: multiples franjas se EXPANDEN en varios eventos que comparten sourceId (edicion/borrado siguen operando sobre el registro unico)", () => {
  const mod = loadSandbox({});
  const events = mod.toAgendaEvent({
    id: "e3", title: "Jornada", date: "2026-09-10", status: "scheduled", allDay: false,
    slots: [
      { startAt: "2026-09-10T08:00:00-05:00", endAt: "2026-09-10T10:00:00-05:00" },
      { startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00" },
    ],
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].sourceId, "e3");
  assert.equal(events[1].sourceId, "e3");
  assert.notEqual(events[0].id, events[1].id);
  assert.equal(events[0].startAt, "2026-09-10T08:00:00-05:00");
  assert.equal(events[1].startAt, "2026-09-10T14:10:00-05:00");
});

// ── No inventar: sin firebase_db disponible, falla explicito (nunca silencioso) ──

test("saveManualEvent: sin _firebaseDb disponible, devuelve ok:false explicito", async () => {
  const mod = loadSandbox({});
  const result = await mod.saveManualEvent({ title: "Reunion", date: "2026-09-10" });
  assert.equal(result.ok, false);
  assert.ok(result.message);
});

// ── Regresion (hallazgo real en navegador, 2026-08-26): con la sesion admin
// desincronizada, cloudGetCalendar/cloudSaveCalendar quedaron pendientes
// INDEFINIDAMENTE (nunca resolvieron ni rechazaron) -- el admin se quedaba
// viendo "Guardando..." para siempre, sin ningun mensaje. withTimeout debe
// garantizar que esto SIEMPRE se resuelve en un tiempo acotado. ──────────

test("withTimeout: promesa que nunca resuelve -- se resuelve igual con el fallback tras el limite", async () => {
  const mod = loadSandbox({});
  const neverResolves = new Promise(function () {});
  const result = await mod.__test.withTimeout(neverResolves, 30, "FALLBACK");
  assert.equal(result, "FALLBACK");
});

test("CLOUD_TIMEOUT_MS es generoso (no corta una entrega real de golpe) pero acotado", () => {
  const mod = loadSandbox({});
  assert.ok(mod.__test.CLOUD_TIMEOUT_MS >= 5000);
  assert.ok(mod.__test.CLOUD_TIMEOUT_MS <= 30000);
});

// Prueba estatica (no de ejecucion, para no esperar 12s reales en la suite):
// confirma que las 3 llamadas reales a cloudGetCalendar/cloudSaveCalendar
// pasan SIEMPRE por withTimeout -- si algun cambio futuro vuelve a llamarlas
// "pelonas" (sin envolver), esta prueba lo detecta.
test("las 3 llamadas reales a la nube estan envueltas en withTimeout (nunca cuelgan sin limite)", () => {
  const source = fs.readFileSync(path.join(root, "js/calendario_admin_manual_events.js"), "utf8");
  const cloudCalls = source.match(/dbApi\.cloud(Get|Save)Calendar\([^)]*\)/g) || [];
  assert.equal(cloudCalls.length, 3, "se esperan exactamente 3 llamadas: 1 get (load) + 2 save (crear/editar y eliminar)");
  cloudCalls.forEach(function (call) {
    const idx = source.indexOf(call);
    const before = source.slice(Math.max(0, idx - 20), idx);
    assert.match(before, /withTimeout\($/, "cada llamada a la nube debe estar envuelta en withTimeout: " + call);
  });
});

// ── Bloque F.1: "Nueva clase" (type="CLASE") + campo "tema" ────────────────

test("MANUAL_EVENT_TYPES incluye CLASE ademas de ACTIVIDAD_ESPECIAL", () => {
  const mod = loadSandbox({});
  // Array creado DENTRO del sandbox -- comparar como strings, no deepEqual
  // (mismo gotcha cross-realm documentado en otros tests de este archivo).
  const types = Array.prototype.slice.call(mod.MANUAL_EVENT_TYPES).sort().join(",");
  assert.equal(types, "ACTIVIDAD_ESPECIAL,CLASE");
});

test("saveManualEvent: type='CLASE' se guarda tal cual (Nueva clase)", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({
    title: "Clase de refuerzo", date: "2026-09-10", type: "CLASE",
    startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00",
  });
  assert.equal(result.ok, true);
  assert.equal(result.record.type, "CLASE");
});

test("saveManualEvent: un type invalido/desconocido cae a ACTIVIDAD_ESPECIAL (nunca inventa un tipo nuevo)", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({ title: "Aviso", date: "2026-09-10", allDay: true, type: "TIPO_QUE_NO_EXISTE" });
  assert.equal(result.ok, true);
  assert.equal(result.record.type, "ACTIVIDAD_ESPECIAL");
});

test("saveManualEvent: sin type explicito, default sigue siendo ACTIVIDAD_ESPECIAL (compatibilidad con eventos ya creados en Bloque D/E)", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({ title: "Aviso", date: "2026-09-10", allDay: true });
  assert.equal(result.record.type, "ACTIVIDAD_ESPECIAL");
});

test("saveManualEvent: guarda el campo tema", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  const result = await mod.saveManualEvent({
    title: "Clase de refuerzo", date: "2026-09-10", type: "CLASE", tema: "Subneteo IPv4",
    startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00",
  });
  assert.equal(result.record.tema, "Subneteo IPv4");
});

test("toAgendaEvent: antepone 'Tema: X' a la descripcion cuando hay tema", () => {
  const mod = loadSandbox({});
  const events = mod.toAgendaEvent({
    id: "e1", title: "Clase", date: "2026-09-10", status: "scheduled", allDay: true,
    type: "CLASE", tema: "Subneteo IPv4", description: "Traer calculadora",
  });
  assert.equal(events[0].description, "Tema: Subneteo IPv4 — Traer calculadora");
  assert.equal(events[0].type, "CLASE");
});

test("toAgendaEvent: sin tema, la descripcion queda igual que antes (sin regresion)", () => {
  const mod = loadSandbox({});
  const events = mod.toAgendaEvent({ id: "e1", title: "Aviso", date: "2026-09-10", status: "scheduled", allDay: true, description: "Traer calculadora" });
  assert.equal(events[0].description, "Traer calculadora");
});

test("Nueva clase: persiste tras 'recargar' (round-trip completo con type y tema)", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => ({ user: { fullName: "Instructor Uno" } }) } });
  await mod.saveManualEvent({
    title: "Clase de refuerzo - Redes", date: "2026-09-10", type: "CLASE", tema: "Subneteo IPv4",
    ficha: "3441944", startAt: "2026-09-10T14:10:00-05:00", endAt: "2026-09-10T16:15:00-05:00",
  });
  const records = await mod.loadManualEventRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].type, "CLASE");
  assert.equal(records[0].tema, "Subneteo IPv4");
  assert.equal(records[0].ficha, "3441944");
});

test("Nueva clase: solo la ficha indicada la recibe (loadManualAgendaEvents no filtra por ficha -- eso lo hace el llamador, se prueba aqui que el dato de ficha se conserva)", async () => {
  const db = fakeDb();
  const mod = loadSandbox({ _firebaseDb: db, portalAuth: { getCurrentSession: () => null } });
  await mod.saveManualEvent({
    title: "Clase ficha 3441944", date: "2026-09-10", type: "CLASE", ficha: "3441944", allDay: true,
  });
  const events = await mod.loadManualAgendaEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].ficha, "3441944");
  assert.equal(events[0].type, "CLASE");
});
