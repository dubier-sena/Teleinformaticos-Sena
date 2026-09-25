"use strict";

// Lectura/escritura ESTRICTAS de js/firebase_db.js (2026-09-25): base de
// "Agregar clase" (Agenda) y del registro propio de Etapa Productiva.
// Invariantes que se prueban aqui contra un Firestore simulado que honra las
// precondiciones reales (currentDocument.updateTime / currentDocument.exists):
//   * lectura fallida           => CERO escrituras;
//   * documento inexistente     => se crea (calendario vacio real);
//   * dos pestañas concurrentes => ninguna pisa a la otra (conflicto ->
//                                  releer -> reaplicar por id);
//   * cloudSaveCalendar (legacy) conserva su comportamiento.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plain = (v) => JSON.parse(JSON.stringify(v));

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function makeFakeFirestore(opts) {
  const options = opts || {};
  const store = new Map();
  const log = [];
  let counter = 0;
  const nextUpdateTime = () => "2026-01-01T00:00:00." + String(++counter).padStart(6, "0") + "Z";
  async function fetchImpl(url, init) {
    const method = (init && init.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]);
    log.push({ method, key, url });
    await sleep(options.delayMs || 0);
    if (method === "GET") {
      if (options.failGet && options.failGet(key)) return { ok: false, status: 500, json: async () => ({}) };
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      const entry = store.get(key);
      return { ok: true, status: 200, json: async () => ({ name: "x/documents/" + key, fields: entry.fields, updateTime: entry.updateTime }) };
    }
    if (method === "PATCH") {
      const body = JSON.parse(init.body);
      const upd = url.match(/currentDocument\.updateTime=([^&]+)/);
      const mustNotExist = /currentDocument\.exists=false/.test(url);
      const current = store.get(key);
      if (upd && (!current || current.updateTime !== decodeURIComponent(upd[1]))) {
        return { ok: false, status: 400, json: async () => ({ error: { status: "FAILED_PRECONDITION" } }) };
      }
      if (mustNotExist && current) {
        return { ok: false, status: 409, json: async () => ({ error: { status: "ALREADY_EXISTS" } }) };
      }
      const updateTime = nextUpdateTime();
      store.set(key, { fields: body.fields, updateTime });
      if (options.dropPatchResponse && options.dropPatchResponse(key)) throw new Error("timeout simulado (la escritura SI se aplico)");
      return { ok: true, status: 200, json: async () => ({ name: "x/documents/" + key, fields: body.fields, updateTime }) };
    }
    throw new Error("metodo inesperado: " + method);
  }
  return { fetchImpl, store, log };
}

function loadDb(fetchImpl, sessionUsernameKey) {
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => "uid-test",
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: sessionUsernameKey
      ? { getCurrentSession: () => ({ role: "student", user: { usernameKey: sessionUsernameKey } }) }
      : {},
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = fetchImpl;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8"), sandbox);
  return windowObj._firebaseDb;
}

const CAL = "calendario_2026_manual_events";
const FALLBACK_KEY = "sena_portal_progress/__calendar__:" + CAL;
const CANONICAL_KEY = "sena_portal_calendar/" + CAL;
const patches = (log) => log.filter((e) => e.method === "PATCH");
const addEvent = (ev) => (state) => {
  const events = Array.isArray(state.events) ? state.events.filter((e) => e.id !== ev.id) : [];
  return Object.assign({}, state, { events: events.concat([ev]) });
};
const ids = (snapshot) => plain((snapshot.events || []).map((e) => e.id).sort());

async function seedCalendar(fake, events) {
  const db = loadDb(fake.fetchImpl);
  const r = await db.cloudUpdateCalendarStrict(CAL, () => ({ events }));
  assert.equal(r.ok, true);
  fake.log.length = 0;
}

test("B01: lectura fallida del calendario = CERO escrituras (ni respaldo ni canonico)", async () => {
  const fake = makeFakeFirestore({ failGet: (key) => key === FALLBACK_KEY });
  const db = loadDb(fake.fetchImpl);
  const result = await db.cloudUpdateCalendarStrict(CAL, addEvent({ id: "nueva" }));
  assert.equal(result.ok, false);
  assert.equal(result.status, "read-failed");
  assert.equal(patches(fake.log).length, 0, "no debe existir ningun PATCH tras una lectura fallida");
});

test("B01b: si el respaldo no existe y el canonico falla al leerse, tampoco se escribe", async () => {
  const fake = makeFakeFirestore({ failGet: (key) => key === CANONICAL_KEY });
  const db = loadDb(fake.fetchImpl);
  const result = await db.cloudUpdateCalendarStrict(CAL, addEvent({ id: "nueva" }));
  assert.equal(result.status, "read-failed");
  assert.equal(patches(fake.log).length, 0);
});

test("B02: calendario vacio REAL (los dos docs no existen) -> se crea con exists=false", async () => {
  const fake = makeFakeFirestore();
  const db = loadDb(fake.fetchImpl);
  const result = await db.cloudUpdateCalendarStrict(CAL, addEvent({ id: "c1" }));
  assert.equal(result.ok, true);
  assert.match(patches(fake.log)[0].url, /currentDocument\.exists=false/);
  const read = await db.cloudGetCalendarStrict(CAL);
  assert.equal(read.status, "found");
  assert.deepEqual(ids(read.snapshot), ["c1"]);
});

test("cloudGetCalendarStrict distingue missing / found / error", async () => {
  const empty = loadDb(makeFakeFirestore().fetchImpl);
  assert.equal((await empty.cloudGetCalendarStrict(CAL)).status, "missing");
  const failing = loadDb(makeFakeFirestore({ failGet: () => true }).fetchImpl);
  assert.equal((await failing.cloudGetCalendarStrict(CAL)).status, "error");
});

test("datos que solo existen en el doc canonico (legado) se conservan al agregar", async () => {
  const fake = makeFakeFirestore();
  const legacy = loadDb(fake.fetchImpl);
  // Escritura legacy (sin precondicion) directo al canonico unicamente.
  fake.store.set(CANONICAL_KEY, { fields: { events: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "vieja" } } } }] } } }, updateTime: "2025-12-31T00:00:00Z" });
  const result = await legacy.cloudUpdateCalendarStrict(CAL, addEvent({ id: "nueva" }));
  assert.equal(result.ok, true);
  const read = await legacy.cloudGetCalendarStrict(CAL);
  assert.deepEqual(ids(read.snapshot), ["nueva", "vieja"]);
});

test("B17: dos pestañas leen la misma version y agregan clases distintas -> quedan las DOS", async () => {
  const fake = makeFakeFirestore({ delayMs: 15 });
  await seedCalendar(fake, [{ id: "existente" }]);
  const tabA = loadDb(fake.fetchImpl);
  const tabB = loadDb(fake.fetchImpl);
  const [a, b] = await Promise.all([
    tabA.cloudUpdateCalendarStrict(CAL, addEvent({ id: "claseA" })),
    tabB.cloudUpdateCalendarStrict(CAL, addEvent({ id: "claseB" })),
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const read = await tabA.cloudGetCalendarStrict(CAL);
  assert.deepEqual(ids(read.snapshot), ["claseA", "claseB", "existente"]);
  assert.ok(patches(fake.log).some((e) => /currentDocument\.updateTime=/.test(e.url)), "debe usar la precondicion updateTime");
});

test("B17b: la pestaña con version vieja recibe conflicto y NO pisa la clase de la otra", async () => {
  const fake = makeFakeFirestore();
  await seedCalendar(fake, []);
  const db = loadDb(fake.fetchImpl);
  let calls = 0;
  // La primera vez que se aplica el cambio, otra pestaña escribe "claseA"
  // entre la lectura y la escritura de esta.
  const result = await db.cloudUpdateCalendarStrict(CAL, (state) => {
    calls += 1;
    if (calls === 1) {
      const entry = fake.store.get(FALLBACK_KEY);
      entry.fields = { events: { arrayValue: { values: [{ mapValue: { fields: { id: { stringValue: "claseA" } } } }] } } };
      entry.updateTime = "2026-02-02T00:00:00Z";
    }
    return addEvent({ id: "claseB" })(state);
  });
  assert.equal(result.ok, true);
  assert.equal(calls, 2, "debe releer y reaplicar el cambio una vez");
  const read = await db.cloudGetCalendarStrict(CAL);
  assert.deepEqual(ids(read.snapshot), ["claseA", "claseB"]);
});

test("conflicto permanente -> se rinde tras el maximo de intentos (sin bucle infinito)", async () => {
  const fake = makeFakeFirestore();
  await seedCalendar(fake, []);
  const db = loadDb(fake.fetchImpl);
  let calls = 0;
  const result = await db.cloudUpdateCalendarStrict(CAL, (state) => {
    calls += 1;
    fake.store.get(FALLBACK_KEY).updateTime = "cambiado-" + calls; // siempre cambia antes de escribir
    return addEvent({ id: "x" })(state);
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, "conflict-exhausted");
  assert.equal(calls, 4);
});

test("escritura cuya respuesta se pierde -> status write-failed (ambiguo), el dato SI quedo", async () => {
  const fake = makeFakeFirestore({ dropPatchResponse: (key) => key === FALLBACK_KEY });
  const db = loadDb(fake.fetchImpl);
  const result = await db.cloudUpdateCalendarStrict(CAL, addEvent({ id: "lenta" }));
  assert.equal(result.status, "write-failed");
  const read = await loadDb(fake.fetchImpl).cloudGetCalendarStrict(CAL);
  assert.deepEqual(ids(read.snapshot), ["lenta"], "el llamador debe poder verificar releyendo");
});

test("mutate puede abortar sin escribir nada", async () => {
  const fake = makeFakeFirestore();
  const db = loadDb(fake.fetchImpl);
  const result = await db.cloudUpdateCalendarStrict(CAL, () => ({ abort: "no-existe" }));
  assert.equal(result.status, "aborted");
  assert.equal(patches(fake.log).length, 0);
});

test("cloudSaveCalendar (calendario legacy) conserva su comportamiento: escribe sin precondicion", async () => {
  const fake = makeFakeFirestore();
  const db = loadDb(fake.fetchImpl);
  const ok = await db.cloudSaveCalendar("calendario_2026_admin", { estados: { a: 1 } });
  assert.equal(ok, true);
  const p = patches(fake.log);
  assert.equal(p.length, 2);
  assert.ok(p.every((e) => !/currentDocument/.test(e.url)));
});

// ── Doc de registro propio (Etapa Productiva) ────────────────────────────────
const SCOPE = "student:ana.perez";
const FILE = "productive-stage-own-deliveries";
const addDelivery = (rec) => (snap) => {
  const list = Array.isArray(snap.projectDeliveries) ? snap.projectDeliveries.filter((r) => r.submissionId !== rec.submissionId) : [];
  return Object.assign({}, snap, { projectDeliveries: list.concat([rec]) });
};

test("A12/A17: lectura fallida del doc propio = CERO escrituras", async () => {
  const fake = makeFakeFirestore({ failGet: (key) => key.indexOf("sena_portal_progress/__guide_data__") === 0 });
  const db = loadDb(fake.fetchImpl, "ana.perez");
  const result = await db.cloudUpdateGuideDataStrict(SCOPE, FILE, addDelivery({ submissionId: "s1" }));
  assert.equal(result.status, "read-failed");
  assert.equal(patches(fake.log).length, 0);
});

test("A12/A13: el registro se escribe en el doc por UID y otro 'dispositivo' lo lee con cloudGetGuideData", async () => {
  const fake = makeFakeFirestore();
  const deviceA = loadDb(fake.fetchImpl, "ana.perez");
  const saved = await deviceA.cloudUpdateGuideDataStrict(SCOPE, FILE, addDelivery({ submissionId: "s1", projectId: "p1" }));
  assert.equal(saved.ok, true);
  assert.ok(fake.store.has("sena_portal_progress/__guide_data__:uid:uid-test:productive-stage-own-deliveries"));
  const deviceB = loadDb(fake.fetchImpl, "ana.perez");
  const snapshot = await deviceB.cloudGetGuideData(SCOPE, FILE);
  assert.deepEqual(plain(snapshot.projectDeliveries.map((r) => r.submissionId)), ["s1"]);
});

test("dos dispositivos registran entregas distintas a la vez -> quedan las dos", async () => {
  const fake = makeFakeFirestore({ delayMs: 10 });
  const a = loadDb(fake.fetchImpl, "ana.perez");
  const b = loadDb(fake.fetchImpl, "ana.perez");
  await Promise.all([
    a.cloudUpdateGuideDataStrict(SCOPE, FILE, addDelivery({ submissionId: "sA" })),
    b.cloudUpdateGuideDataStrict(SCOPE, FILE, addDelivery({ submissionId: "sB" })),
  ]);
  const snap = await a.cloudGetGuideData(SCOPE, FILE);
  assert.deepEqual(plain(snap.projectDeliveries.map((r) => r.submissionId).sort()), ["sA", "sB"]);
});

test("registros previos en el doc LEGADO se conservan al escribir el doc por UID", async () => {
  const fake = makeFakeFirestore();
  const legacyKey = "sena_portal_progress/__guide_data__:student:ana_perez:productive-stage-own-deliveries";
  fake.store.set(legacyKey, {
    fields: { snapshotJson: { stringValue: JSON.stringify({ documentDeliveries: [{ usernameKey: "ana.perez", docId: "bitacora-1" }], updatedAt: "2026-08-01T00:00:00Z" }) } },
    updateTime: "2026-08-01T00:00:00Z",
  });
  const db = loadDb(fake.fetchImpl, "ana.perez");
  const saved = await db.cloudUpdateGuideDataStrict(SCOPE, FILE, addDelivery({ submissionId: "s1" }));
  assert.equal(saved.ok, true);
  const snap = await db.cloudGetGuideData(SCOPE, FILE);
  assert.deepEqual(plain(snap.documentDeliveries.map((r) => r.docId)), ["bitacora-1"]);
  assert.deepEqual(plain(snap.projectDeliveries.map((r) => r.submissionId)), ["s1"]);
});
