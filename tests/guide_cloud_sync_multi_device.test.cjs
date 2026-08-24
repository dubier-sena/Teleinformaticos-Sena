"use strict";

// Riesgo 2 (cierre 2026-08-22): dos DISPOSITIVOS reales -- dos procesos de
// navegador independientes, cada uno con su PROPIA cola en memoria de
// firebase_db.js (withGuideStateWriteQueue NO cruza procesos, ver su propio
// comentario en el archivo) y su PROPIO localStorage -- contra un mismo
// backend Firestore compartido (misma fake Firestore que
// tests/firebase_admin_guide_state_race.test.cjs, reutilizada aqui para dos
// "dispositivos" en vez de dos llamadas admin).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// Backend Firestore compartido: GET devuelve lo ultimo guardado (404 si no
// existe) junto con su updateTime; PATCH reemplaza el documento COMPLETO --
// igual que Firestore real sin updateMask (mismo comportamiento documentado
// en tests/firebase_admin_guide_state_race.test.cjs) -- PERO ahora tambien
// honra `currentDocument.updateTime` en la query string: si el documento fue
// escrito por alguien mas desde ese updateTime, responde FAILED_PRECONDITION
// en vez de aceptar el reemplazo a ciegas (misma semantica que la Firestore
// real; ver isFirestorePreconditionConflict en js/firebase_db.js).
function makeFakeFirestore(delayMs) {
  const store = new Map(); // key -> { fields, updateTime }
  const requestLog = [];
  let updateTimeCounter = 0;
  function nextUpdateTime() {
    updateTimeCounter += 1;
    return "2026-01-01T00:00:00." + String(updateTimeCounter).padStart(6, "0") + "Z";
  }
  async function fetchImpl(url, options) {
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]);
    requestLog.push({ method, key, at: Date.now() });
    if (method === "GET") {
      await sleep(delayMs);
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      const entry = store.get(key);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: "projects/test/databases/(default)/documents/" + key,
          fields: entry.fields,
          updateTime: entry.updateTime,
        }),
      };
    }
    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      const preconditionMatch = url.match(/currentDocument\.updateTime=([^&]+)/);
      const expectedUpdateTime = preconditionMatch ? decodeURIComponent(preconditionMatch[1]) : null;
      await sleep(delayMs);
      if (expectedUpdateTime) {
        const current = store.get(key);
        const currentUpdateTime = current ? current.updateTime : null;
        if (currentUpdateTime !== expectedUpdateTime) {
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: { code: 400, status: "FAILED_PRECONDITION", message: "el documento cambio desde la lectura" } }),
          };
        }
      }
      const updateTime = nextUpdateTime();
      store.set(key, { fields: body.fields, updateTime });
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: body.fields, updateTime }),
      };
    }
    throw new Error("metodo inesperado en el fake Firestore: " + method);
  }
  return { fetchImpl, requestLog, store };
}

function loadFirebaseDbInstance(fetchImpl) {
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
      currentUid: () => "uid-test",
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {},
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
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(code, sandbox);
  return windowObj._firebaseDb;
}

function loadCloudSyncInstance(dbInstance, usernameKey) {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "guide_cloud_sync.js"), "utf8");
  const localStorage = makeLocalStorage();
  const listeners = {};
  const windowObj = {
    localStorage,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach((fn) => fn(evt)); },
    portalAuth: { getCurrentSession: () => ({ role: "student", user: { usernameKey } }) },
    portalSaveStatus: null,
    navigator: { onLine: true },
    _firebaseDb: dbInstance,
  };
  const sandbox = {
    window: windowObj,
    document: { addEventListener: () => {}, hidden: false },
    navigator: windowObj.navigator,
    console: { warn() {}, info() {}, error() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return windowObj.GuideCloudSync;
}

// Un "dispositivo": su PROPIO firebase_db.js (propia cola en memoria, propio
// localStorage) + su PROPIO guide_cloud_sync.js + su PROPIO `state` -- tal
// como serian dos computadores reales, apuntando al mismo backend.
function makeDevice(fetchImpl, usernameKey, fileName, delays) {
  const db = loadFirebaseDbInstance(fetchImpl);
  const GuideCloudSync = loadCloudSyncInstance(db, usernameKey);
  let state = {};
  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:" + fileName,
    guideDataFile: fileName,
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz (" + usernameKey + ")",
    baseDelayMs: (delays && delays.baseDelayMs) || 5,
    maxDelayMs: (delays && delays.maxDelayMs) || 20,
  });
  return {
    db,
    store,
    get state() { return state; },
    set state(s) { state = s; },
  };
}

const FILE = "grupo-11a-guia-99-multidispositivo.html";

test("Caso A: campos DISTINTOS desde dos dispositivos, escrituras SECUENCIALES -- ninguno debe desaparecer", async () => {
  const { fetchImpl } = makeFakeFirestore(10);
  const usernameKey = "multia";

  const seed = makeDevice(fetchImpl, usernameKey, FILE);
  seed.state = { campoA: "", campoB: "" };
  await seed.store.forceSyncNow();
  seed.store.stop();

  const deviceA = makeDevice(fetchImpl, usernameKey, FILE);
  const deviceB = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceA.store.hydrate();
  await deviceB.store.hydrate();

  deviceA.state = Object.assign({}, deviceA.state, { campoA: "respuesta desde A" });
  await deviceA.store.forceSyncNow();

  deviceB.state = Object.assign({}, deviceB.state, { campoB: "respuesta desde B" });
  await deviceB.store.forceSyncNow();

  const deviceC = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceC.store.hydrate();
  assert.equal(deviceC.state.campoA, "respuesta desde A", "no debe perder el campo de A");
  assert.equal(deviceC.state.campoB, "respuesta desde B", "no debe perder el campo de B");

  [deviceA, deviceB, deviceC].forEach((d) => d.store.stop());
});

test("Caso A2 (el escenario real de un salon): campos DISTINTOS, escrituras REALMENTE CONCURRENTES", async () => {
  // Delay generoso para forzar que las lecturas de A y B se solapen de verdad
  // (el escenario adversarial: los dos leen ANTES de que cualquiera escriba).
  const { fetchImpl } = makeFakeFirestore(40);
  const usernameKey = "multia2";

  const seed = makeDevice(fetchImpl, usernameKey, FILE);
  seed.state = { campoA: "", campoB: "" };
  await seed.store.forceSyncNow();
  seed.store.stop();

  const deviceA = makeDevice(fetchImpl, usernameKey, FILE);
  const deviceB = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceA.store.hydrate();
  await deviceB.store.hydrate();

  deviceA.state = Object.assign({}, deviceA.state, { campoA: "respuesta desde A" });
  deviceB.state = Object.assign({}, deviceB.state, { campoB: "respuesta desde B" });

  // Arrancan al mismo tiempo: sin proteccion cruzada, cada uno lee el doc
  // ANTES de que el otro escriba, y el que escribe DESPUES pisa el documento
  // completo con un merge que nunca vio el campo del otro.
  await Promise.all([deviceA.store.forceSyncNow(), deviceB.store.forceSyncNow()]);

  const deviceC = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceC.store.hydrate();
  assert.equal(deviceC.state.campoA, "respuesta desde A", "no debe perder el campo de A aunque las escrituras se solapen");
  assert.equal(deviceC.state.campoB, "respuesta desde B", "no debe perder el campo de B aunque las escrituras se solapen");

  [deviceA, deviceB, deviceC].forEach((d) => d.store.stop());
});

test("Caso B: MISMO campo desde dos dispositivos -- resultado deterministico (gana el mas nuevo por timestamp)", async () => {
  const { fetchImpl } = makeFakeFirestore(10);
  const usernameKey = "multib";

  const seed = makeDevice(fetchImpl, usernameKey, FILE);
  seed.state = { campoX: "" };
  await seed.store.forceSyncNow();
  seed.store.stop();

  const deviceA = makeDevice(fetchImpl, usernameKey, FILE);
  const deviceB = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceA.store.hydrate();
  await deviceB.store.hydrate();

  // A escribe primero y confirma...
  deviceA.state = { campoX: "version de A" };
  await deviceA.store.forceSyncNow();
  // ... B escribe DESPUES (estrictamente mas nuevo) sobre el mismo campo.
  await sleep(5);
  deviceB.state = { campoX: "version de B" };
  await deviceB.store.forceSyncNow();

  const deviceC = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceC.store.hydrate();
  assert.equal(deviceC.state.campoX, "version de B", "debe ganar la escritura estrictamente mas reciente");

  [deviceA, deviceB, deviceC].forEach((d) => d.store.stop());
});

test("Caso C: conflicto MENOR A 1 SEGUNDO en el mismo campo -- sigue siendo deterministico (no hay perdida silenciosa/empate ambiguo)", async () => {
  const { fetchImpl } = makeFakeFirestore(5);
  const usernameKey = "multic";

  const seed = makeDevice(fetchImpl, usernameKey, FILE);
  seed.state = { campoX: "" };
  await seed.store.forceSyncNow();
  seed.store.stop();

  const deviceA = makeDevice(fetchImpl, usernameKey, FILE);
  const deviceB = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceA.store.hydrate();
  await deviceB.store.hydrate();

  deviceA.state = { campoX: "A a las T" };
  await deviceA.store.forceSyncNow();
  // B escribe ~200ms despues (bien por debajo del margen de tolerancia LWW de 1s
  // documentado en mergeGuideDataSnapshotForSave).
  await sleep(200);
  deviceB.state = { campoX: "B a T+200ms" };
  await deviceB.store.forceSyncNow();

  const deviceC = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceC.store.hydrate();
  // Resultado deterministico esperado: el mas nuevo (B, T+200ms) gana. La
  // tolerancia de 1s en mergeGuideDataSnapshotForSave protege al remoto
  // NUEVO de ser pisado por un incoming VIEJO (jitter de reloj) -- aqui B es
  // el mas nuevo, asi que gana igual, sin ambiguedad.
  assert.equal(deviceC.state.campoX, "B a T+200ms", "con <1s de diferencia el resultado sigue siendo deterministico: gana el mas nuevo real");

  [deviceA, deviceB, deviceC].forEach((d) => d.store.stop());
});

test("Caso D: dispositivo B estuvo OFFLINE y escribe tarde; A ya habia sincronizado otros campos -- el merge final debe conservar ambos", async () => {
  const { fetchImpl } = makeFakeFirestore(10);
  const usernameKey = "multid";

  const seed = makeDevice(fetchImpl, usernameKey, FILE);
  seed.state = { campoA: "", campoB: "" };
  await seed.store.forceSyncNow();
  seed.store.stop();

  const deviceA = makeDevice(fetchImpl, usernameKey, FILE);
  const deviceB = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceA.store.hydrate();
  await deviceB.store.hydrate();

  // B queda "offline": edita en memoria pero NUNCA sincroniza todavia
  // (equivalente a estar sin conexion -- su cambio solo vive local).
  deviceB.state = Object.assign({}, deviceB.state, { campoB: "escrito offline en B" });

  // Mientras tanto, A sí tiene señal y sincroniza su propio campo.
  deviceA.state = Object.assign({}, deviceA.state, { campoA: "sincronizado por A" });
  await deviceA.store.forceSyncNow();

  // B "recupera conexion" y recien ahora sincroniza lo que tenia pendiente.
  await deviceB.store.forceSyncNow();

  const deviceC = makeDevice(fetchImpl, usernameKey, FILE);
  await deviceC.store.hydrate();
  assert.equal(deviceC.state.campoA, "sincronizado por A", "el cambio de A (mientras B seguia offline) no debe perderse");
  assert.equal(deviceC.state.campoB, "escrito offline en B", "el cambio de B (hecho offline, sincronizado despues) debe llegar igual");

  [deviceA, deviceB, deviceC].forEach((d) => d.store.stop());
});
