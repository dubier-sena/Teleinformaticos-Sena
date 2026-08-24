"use strict";

// Fase 10 (auditoria profunda, 2026-08-23): concurrencia completa con
// Firestore caido. Antes, tanto el respaldo a Drive (apps-script/
// respaldo_firestore.gs, handleSet) como la promocion Drive -> Firestore
// (js/firebase_db.js, tryFirestorePromote) hacian un reemplazo COMPLETO y
// ciego del documento. Escenario real: Firestore cae, Dispositivo A guarda
// Campo A (cae a Drive), Dispositivo B guarda Campo B (cae a Drive, cola
// PROPIA en su propio localStorage), Firestore vuelve, ambos pendientes se
// promueven -- sin merge, el que promoviera SEGUNDO borraba el campo que el
// primero ya habia promovido. Corregido: ambos puntos ahora releen el
// estado actual antes de escribir y combinan con el mismo merge por
// timestamp/campo que ya protege el guardado online normal
// (mergeGuideDataSnapshotForSave), sin importar el orden de promocion.
//
// Este archivo cubre el lado CLIENTE (tryFirestorePromote, firebase_db.js).
// El lado Apps Script (handleSet, respaldo_firestore.gs) tiene su propio
// archivo: tests/apps_script_respaldo_set_merge.test.cjs.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function makeFakeDriveDb() {
  const store = new Map();
  return {
    isEnabled: () => true,
    get: async (collection, docId) => {
      const key = collection + "/" + docId;
      return store.has(key) ? store.get(key) : null;
    },
    set: async (collection, docId, data) => { store.set(collection + "/" + docId, data); return true; },
    updateField: async () => true,
    deleteDoc: async () => true,
    list: async () => [],
    _store: store,
  };
}

// Backend Firestore compartido entre "dispositivos": GET devuelve lo ultimo
// guardado; PATCH reemplaza el documento COMPLETO salvo updateMask (igual
// que Firestore real sin ese parametro). `state.down` simula una caida de
// red real (excepcion, no 401/403) para que fsGet/fsPatch caigan al fallback
// de Drive exactamente como en produccion.
function makeFakeFirestore() {
  const state = { down: false };
  const store = new Map();
  async function fetchImpl(url, options) {
    if (state.down) throw new Error("network unreachable (simulado)");
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]).split("?")[0];
    if (method === "GET") {
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ fields: store.get(key).fields }) };
    }
    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      store.set(key, { fields: body.fields });
      return { ok: true, status: 200, json: async () => ({ fields: body.fields }) };
    }
    throw new Error("metodo inesperado: " + method);
  }
  return { fetchImpl, store, state };
}

function loadFirebaseDbInstance(fetchImpl, opts) {
  opts = opts || {};
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => opts.uid || "uid-test",
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {
      getCurrentSession: () =>
        opts.sessionUsernameKey ? { role: "student", user: { usernameKey: opts.sessionUsernameKey } } : null,
    },
  };
  if (opts.driveDb) windowObj.driveDb = opts.driveDb;
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(code, sandbox);
  return windowObj._firebaseDb;
}

const SCOPE = "student:ana";
const FILE = "grupo-11a-guia-99-concurrencia.html";
const DOC_ID = "__guide_data__:uid:uid-ana:" + FILE.replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");

// Simula "dos dispositivos": misma cuenta (mismo uid, escenario del enunciado
// -- el mismo aprendiz guardando desde dos equipos), cada uno con su PROPIO
// localStorage/cola de promociones pendientes, contra el MISMO backend
// Firestore + Drive compartido.
function makeDevice(fetchImpl, driveDb) {
  return loadFirebaseDbInstance(fetchImpl, { uid: "uid-ana", sessionUsernameKey: "ana", driveDb });
}

test("Escenario obligatorio: Firestore caido, A guarda Campo A y B guarda Campo B por Drive, Firestore vuelve, ambos se promueven -> A + B sin perdida", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const deviceA = makeDevice(fetchImpl, driveDb);
  const deviceB = makeDevice(fetchImpl, driveDb);

  state.down = true;
  await deviceA.cloudSaveGuideData(SCOPE, FILE, { state: { campoA: "de A" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  await deviceB.cloudSaveGuideData(SCOPE, FILE, { state: { campoB: "de B" }, updatedAt: "2026-08-23T10:00:05.000Z" });

  state.down = false;
  const pendingA = (await deviceA.readPendingPromotions())[0];
  const pendingB = (await deviceB.readPendingPromotions())[0];
  await deviceA.tryFirestorePromote(pendingA);
  await deviceB.tryFirestorePromote(pendingB);

  const finalRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(finalRead.state.campoA, "de A", "Campo A no debe perderse");
  assert.equal(finalRead.state.campoB, "de B", "Campo B no debe perderse");
});

test("Reintentos en DISTINTO ORDEN: promover B antes que A produce el MISMO resultado final (A + B)", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const deviceA = makeDevice(fetchImpl, driveDb);
  const deviceB = makeDevice(fetchImpl, driveDb);

  state.down = true;
  await deviceA.cloudSaveGuideData(SCOPE, FILE, { state: { campoA: "de A" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  await deviceB.cloudSaveGuideData(SCOPE, FILE, { state: { campoB: "de B" }, updatedAt: "2026-08-23T10:00:05.000Z" });
  state.down = false;

  const pendingA = (await deviceA.readPendingPromotions())[0];
  const pendingB = (await deviceB.readPendingPromotions())[0];
  // Orden invertido respecto al test anterior: B primero, luego A.
  await deviceB.tryFirestorePromote(pendingB);
  await deviceA.tryFirestorePromote(pendingA);

  const finalRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(finalRead.state.campoA, "de A");
  assert.equal(finalRead.state.campoB, "de B");
});

test("Una promocion mientras la otra AUN esta pendiente: el estado intermedio no pierde el campo ya promovido", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const deviceA = makeDevice(fetchImpl, driveDb);
  const deviceB = makeDevice(fetchImpl, driveDb);

  state.down = true;
  await deviceA.cloudSaveGuideData(SCOPE, FILE, { state: { campoA: "de A" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  await deviceB.cloudSaveGuideData(SCOPE, FILE, { state: { campoB: "de B" }, updatedAt: "2026-08-23T10:00:05.000Z" });
  state.down = false;

  // Solo A promueve por ahora; B sigue pendiente (simulando que B aun no
  // recupero conexion o su flush todavia no corrio).
  const pendingA = (await deviceA.readPendingPromotions())[0];
  await deviceA.tryFirestorePromote(pendingA);

  let midRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(midRead.state.campoA, "de A", "el campo ya promovido debe estar presente");
  assert.equal(midRead.state.campoB, undefined, "el campo de B, aun pendiente, todavia no deberia estar en Firestore");

  // Ahora B promueve (releyendo el estado ACTUAL, que ya tiene el campo de A).
  const pendingB = (await deviceB.readPendingPromotions())[0];
  await deviceB.tryFirestorePromote(pendingB);

  const finalRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(finalRead.state.campoA, "de A", "el campo de A no debe desaparecer cuando B promueve despues");
  assert.equal(finalRead.state.campoB, "de B");
});

test("MISMO campo en ambos dispositivos: gana el mas reciente por timestamp (LWW), igual que el guardado online", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const deviceA = makeDevice(fetchImpl, driveDb);
  const deviceB = makeDevice(fetchImpl, driveDb);

  state.down = true;
  await deviceA.cloudSaveGuideData(SCOPE, FILE, { state: { campoCompartido: "version de A (mas vieja)" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  await deviceB.cloudSaveGuideData(SCOPE, FILE, { state: { campoCompartido: "version de B (mas nueva)" }, updatedAt: "2026-08-23T10:00:10.000Z" });
  state.down = false;

  const pendingA = (await deviceA.readPendingPromotions())[0];
  const pendingB = (await deviceB.readPendingPromotions())[0];
  await deviceA.tryFirestorePromote(pendingA);
  await deviceB.tryFirestorePromote(pendingB);

  const finalRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(finalRead.state.campoCompartido, "version de B (mas nueva)", "debe ganar la version con updatedAt mas reciente");
});

test("Timestamps MUY CERCANOS (menos de 1s de diferencia): el mas nuevo sigue mezclandose normalmente (tolerancia de jitter)", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const deviceA = makeDevice(fetchImpl, driveDb);
  const deviceB = makeDevice(fetchImpl, driveDb);

  state.down = true;
  await deviceA.cloudSaveGuideData(SCOPE, FILE, { state: { campoA: "de A" }, updatedAt: "2026-08-23T10:00:00.500Z" });
  // Solo 300ms de diferencia: dentro de la tolerancia de 1s de
  // mergeGuideDataSnapshotForSave -- NO debe descartarse el incoming solo
  // por ser "mas viejo" dentro de ese margen; ambos campos deben mezclarse.
  await deviceB.cloudSaveGuideData(SCOPE, FILE, { state: { campoB: "de B" }, updatedAt: "2026-08-23T10:00:00.800Z" });
  state.down = false;

  const pendingA = (await deviceA.readPendingPromotions())[0];
  const pendingB = (await deviceB.readPendingPromotions())[0];
  await deviceA.tryFirestorePromote(pendingA);
  await deviceB.tryFirestorePromote(pendingB);

  const finalRead = await deviceA.cloudGetGuideData(SCOPE, FILE);
  assert.equal(finalRead.state.campoA, "de A", "dentro del margen de 1s, el campo mas viejo no debe descartarse por completo");
  assert.equal(finalRead.state.campoB, "de B");
});
