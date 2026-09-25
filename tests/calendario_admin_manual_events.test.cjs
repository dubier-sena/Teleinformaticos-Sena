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
    // API estricta (2026-09-25): misma semantica en memoria que
    // cloudGetCalendarStrict / cloudUpdateCalendarStrict de firebase_db.js.
    cloudGetCalendarStrict: function (calendarId) {
      if (calendarId !== "calendario_2026_manual_events") return Promise.resolve({ status: "missing", snapshot: {} });
      return Promise.resolve({ status: "found", snapshot: { events: JSON.parse(JSON.stringify(saved.events)) } });
    },
    cloudUpdateCalendarStrict: function (calendarId, mutate) {
      savedCalendarIds.push(calendarId);
      const next = mutate({ events: JSON.parse(JSON.stringify(saved.events)) });
      if (!next || next.abort) return Promise.resolve({ ok: false, status: "aborted" });
      saved.events = Array.isArray(next.events) ? next.events : [];
      return Promise.resolve({ ok: true, status: "saved", snapshot: next });
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
test("todas las llamadas reales a la nube estan acotadas por withTimeout (nunca cuelgan sin limite)", () => {
  const source = fs.readFileSync(path.join(root, "js/calendario_admin_manual_events.js"), "utf8");
  const cloudCalls = source.match(/dbApi\.cloud(Get|Save|Update)Calendar(Strict)?\(/g) || [];
  // 1 lectura legacy (load) + 2 lecturas estrictas (verificar / pintar) + 2 escrituras estrictas (guardar / eliminar).
  assert.equal(cloudCalls.length, 5);
  let from = 0;
  cloudCalls.forEach(function (call) {
    const idx = source.indexOf(call, from);
    from = idx + call.length;
    const before = source.slice(Math.max(0, idx - 90), idx);
    assert.match(before, /withTimeout\(\s*(Promise\.resolve\(\)\.then\(function \(\) \{ return )?$/, "cada llamada a la nube debe estar envuelta en withTimeout: " + call);
  });
  assert.ok(!/dbApi\.cloudSaveCalendar\(/.test(source), "el guardado de eventos manuales ya no usa cloudSaveCalendar (reemplazo ciego del documento)");
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
    title: "Clase de refuerzo", date: "2026-09-10", type: "CLASE", ficha: "3441944",
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
    title: "Clase de refuerzo", date: "2026-09-10", type: "CLASE", tema: "Subneteo IPv4", ficha: "3441944",
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

// ── Guardado confiable (2026-09-25): R1 / R2 / R3 del diagnostico ──────────

// Nube simulada con fallos inyectables. `mode`:
//   "read-fails"     -> cloudUpdateCalendarStrict devuelve read-failed (y NO escribe);
//   "lost-response"  -> la escritura se aplica pero la respuesta se pierde;
//   "lost-response-verify-fails" -> idem, y la relectura de verificacion falla;
//   "write-rejected" -> la escritura no se aplica y la respuesta falla.
function flakyDb(seedEvents, mode) {
  let events = JSON.parse(JSON.stringify(seedEvents || []));
  const log = { writes: 0, updates: 0 };
  return {
    log,
    events: () => events,
    cloudGetCalendar: () => Promise.resolve({ events: events.slice() }),
    cloudGetCalendarStrict: () => {
      if (mode === "lost-response-verify-fails") return Promise.resolve({ status: "error", snapshot: null });
      return Promise.resolve({ status: "found", snapshot: { events: JSON.parse(JSON.stringify(events)) } });
    },
    cloudUpdateCalendarStrict: (calendarId, mutate) => {
      log.updates += 1;
      if (mode === "read-fails") return Promise.resolve({ ok: false, status: "read-failed" });
      const next = mutate({ events: JSON.parse(JSON.stringify(events)) });
      if (!next || next.abort) return Promise.resolve({ ok: false, status: "aborted" });
      if (mode === "write-rejected") return Promise.resolve({ ok: false, status: "write-failed" });
      events = next.events; log.writes += 1;
      if (mode === "lost-response" || mode === "lost-response-verify-fails") return Promise.resolve({ ok: false, status: "write-failed" });
      return Promise.resolve({ ok: true, status: "saved", snapshot: next });
    },
  };
}
const CLASE = (extra) => Object.assign({
  type: "CLASE", title: "Subneteo", tema: "Subneteo", date: "2026-09-25", ficha: "3441939",
  slots: [{ startAt: "2026-09-25T06:10:00-05:00", endAt: "2026-09-25T10:10:00-05:00" }],
}, extra || {});
const EXISTENTES = [{ id: "a", title: "Clase A" }, { id: "b", title: "Clase B" }, { id: "c", title: "Reunion" }];

test("R1/B01: lectura fallida -> no se escribe nada, los eventos existentes quedan intactos y el error es claro", async () => {
  const db = flakyDb(EXISTENTES, "read-fails");
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.saveManualEvent(CLASE());
  assert.equal(result.ok, false);
  assert.equal(result.code, "read-failed");
  assert.match(result.message, /No se guardo nada/);
  assert.equal(db.log.writes, 0);
  assert.equal(db.events().length, 3);
});

test("R1 (regresion exacta del diagnostico): nunca usa cloudSaveCalendar, que reemplazaba el documento a ciegas", async () => {
  let blindWrites = 0;
  const db = Object.assign(flakyDb(EXISTENTES, "read-fails"), { cloudSaveCalendar: () => { blindWrites += 1; return Promise.resolve(true); } });
  const mod = loadSandbox({ _firebaseDb: db });
  await mod.saveManualEvent(CLASE());
  await mod.deleteManualEvent("a");
  assert.equal(blindWrites, 0);
});

test("sin la API estricta (firebase_db.js viejo en cache) -> error explicito, nunca el camino peligroso", async () => {
  let blindWrites = 0;
  const mod = loadSandbox({ _firebaseDb: { cloudGetCalendar: () => Promise.resolve(null), cloudSaveCalendar: () => { blindWrites += 1; return Promise.resolve(true); } } });
  const result = await mod.saveManualEvent(CLASE());
  assert.equal(result.ok, false);
  assert.equal(result.code, "unavailable");
  assert.equal(blindWrites, 0);
});

test("B03/B09: crear clase agrega UNA clase con type CLASE sin tocar las demas", async () => {
  const db = flakyDb(EXISTENTES);
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.saveManualEvent(CLASE({ id: "manual-fijo" }));
  assert.equal(result.ok, true);
  assert.equal(db.events().length, 4);
  assert.equal(db.events()[3].type, "CLASE");
  assert.equal(db.events()[3].id, "manual-fijo");
});

test("B04: clase sin ficha se rechaza (el evento especial general sigue permitiendo 'todas las fichas')", async () => {
  const mod = loadSandbox({ _firebaseDb: flakyDb([]) });
  const clase = await mod.saveManualEvent(CLASE({ ficha: "" }));
  assert.equal(clase.ok, false);
  assert.equal(clase.code, "validation");
  const general = await mod.saveManualEvent({ title: "Reunion", date: "2026-09-25", allDay: true });
  assert.equal(general.ok, true);
});

test("B05-B07: fecha, inicio y fin obligatorios", async () => {
  const mod = loadSandbox({ _firebaseDb: flakyDb([]) });
  assert.equal((await mod.saveManualEvent(CLASE({ date: "" }))).code, "validation");
  assert.equal((await mod.saveManualEvent(CLASE({ slots: [{ startAt: "", endAt: "2026-09-25T10:10:00-05:00" }] }))).code, "validation");
  assert.equal((await mod.saveManualEvent(CLASE({ slots: [{ startAt: "2026-09-25T06:10:00-05:00", endAt: "" }] }))).code, "validation");
});

test("B08: fin anterior o igual al inicio se rechaza", async () => {
  const mod = loadSandbox({ _firebaseDb: flakyDb([]) });
  const antes = await mod.saveManualEvent(CLASE({ slots: [{ startAt: "2026-09-25T10:00:00-05:00", endAt: "2026-09-25T06:00:00-05:00" }] }));
  assert.equal(antes.code, "validation");
  assert.match(antes.message, /posterior/);
  const igual = await mod.saveManualEvent(CLASE({ slots: [{ startAt: "2026-09-25T10:00:00-05:00", endAt: "2026-09-25T10:00:00-05:00" }] }));
  assert.equal(igual.code, "validation");
});

test("R3/B14: respuesta perdida pero escritura aplicada -> se verifica releyendo y responde GUARDADA (1 sola clase)", async () => {
  const db = flakyDb(EXISTENTES, "lost-response");
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.saveManualEvent(CLASE({ id: "manual-x" }));
  assert.equal(result.ok, true);
  assert.equal(result.code, "saved-verified");
  assert.equal(db.events().filter((e) => e.id === "manual-x").length, 1);
});

test("B16: reintento tras una respuesta perdida usa el MISMO id -> sigue habiendo 1 sola clase", async () => {
  const db = flakyDb(EXISTENTES, "lost-response-verify-fails");
  const mod = loadSandbox({ _firebaseDb: db });
  const first = await mod.saveManualEvent(CLASE({ id: "manual-y" }));
  assert.equal(first.ok, false);
  assert.equal(first.code, "unconfirmed", "si no se puede verificar, se dice que no se pudo confirmar");
  assert.equal(first.id, "manual-y");
  const retry = await mod.saveManualEvent(CLASE({ id: first.id }));
  void retry;
  assert.equal(db.events().filter((e) => e.id === "manual-y").length, 1);
  assert.equal(db.events().length, 4);
});

test("escritura rechazada y verificada ausente -> 'No se pudo guardar' (no falso exito)", async () => {
  const db = flakyDb(EXISTENTES, "write-rejected");
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.saveManualEvent(CLASE({ id: "manual-z" }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "not-saved");
  assert.equal(db.events().length, 3);
});

test("B18: editar conserva el id y createdAt, sin duplicar", async () => {
  const db = flakyDb([]);
  const mod = loadSandbox({ _firebaseDb: db });
  const created = await mod.saveManualEvent(CLASE({ id: "manual-e" }));
  const edited = await mod.saveManualEvent(CLASE({ id: "manual-e", title: "Nuevo tema", tema: "Nuevo tema" }));
  assert.equal(edited.ok, true);
  assert.equal(db.events().length, 1);
  assert.equal(db.events()[0].tema, "Nuevo tema");
  assert.equal(db.events()[0].createdAt, created.record.createdAt);
});

test("B20: eliminar borra SOLO ese id", async () => {
  const db = flakyDb(EXISTENTES);
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.deleteManualEvent("b");
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(db.events().map((e) => e.id)), JSON.stringify(["a", "c"]));
});

test("B21: eliminar con lectura fallida = cero escrituras", async () => {
  const db = flakyDb(EXISTENTES, "read-fails");
  const mod = loadSandbox({ _firebaseDb: db });
  const result = await mod.deleteManualEvent("b");
  assert.equal(result.ok, false);
  assert.equal(result.code, "read-failed");
  assert.equal(db.log.writes, 0);
  assert.equal(db.events().length, 3);
});

test("loadManualEventRecordsStrict distingue 'sin eventos' de 'no se pudo leer'", async () => {
  const ok = await loadSandbox({ _firebaseDb: flakyDb([]) }).loadManualEventRecordsStrict();
  assert.equal(ok.ok, true);
  const failing = loadSandbox({ _firebaseDb: { cloudGetCalendarStrict: () => Promise.resolve({ status: "error" }), cloudUpdateCalendarStrict: () => Promise.resolve({}) } });
  assert.equal((await failing.loadManualEventRecordsStrict()).ok, false);
});

// ── Horario sugerido (B12) con registros REALES del calendario academico ────
const CAL_RECORDS = (function () {
  const w = {};
  new Function("window", read("data/calendario_2026_records.js"))(w);
  return w.CALENDAR_2026_RECORDS;
})();

test("B12: una sola franja ese dia -> se sugiere (JFK 10A, 2026-09-30, 2:10pm–6:10pm)", () => {
  const mod = loadSandbox({});
  const s = mod.suggestClassSlot(CAL_RECORDS, { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A" }, "2026-09-30");
  assert.equal(s.start, "14:10");
  assert.equal(s.end, "18:10");
});

test("B12: varias franjas (separadas por salto de linea) -> NO se inventa una hora, solo se informa", () => {
  const mod = loadSandbox({});
  const s = mod.suggestClassSlot(CAL_RECORDS, { inst: "Institucion Educativa Santa Barbara", grupo: "10A" }, "2026-10-14");
  assert.equal(s.start, "");
  assert.equal(s.end, "");
  assert.match(s.text, /7:00am–7:55am y 2:15pm–4:15pm/);
});

test("B12: sin registro de clase ese dia -> sin sugerencia", () => {
  const mod = loadSandbox({});
  assert.equal(mod.suggestClassSlot(CAL_RECORDS, { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A" }, "2026-09-26"), null);
  assert.equal(mod.suggestClassSlot(CAL_RECORDS, null, "2026-09-30"), null);
});
