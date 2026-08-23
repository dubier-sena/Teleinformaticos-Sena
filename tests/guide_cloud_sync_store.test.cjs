"use strict";

// Cubre el modulo centralizado js/guide_cloud_sync.js (auditoria 2026-08-22,
// Fases 1-4): hidratacion segura al cargar, estado real de guardado (nunca
// "Guardado" solo porque localStorage funciono), reintento con backoff sin
// timers duplicados, y que nunca haya dos sincronizaciones en vuelo para el
// mismo documento.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function loadModule(sandboxOverrides) {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "guide_cloud_sync.js"), "utf8");
  const localStorage = makeLocalStorage();
  const listeners = {};
  const windowObj = Object.assign(
    {
      localStorage,
      setTimeout,
      clearTimeout,
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
      dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach((fn) => fn(evt)); },
      portalAuth: { getCurrentSession: () => ({ role: "student", user: { usernameKey: "auditoria_claude" } }) },
      portalSaveStatus: null, // se define por test si hace falta
      navigator: { onLine: true },
    },
    sandboxOverrides || {}
  );
  const sandbox = {
    window: windowObj,
    document: { addEventListener: (type, fn) => { (listeners["doc:" + type] = listeners["doc:" + type] || []).push(fn); }, hidden: false },
    navigator: windowObj.navigator,
    console: { warn() {}, info() {}, error() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { GuideCloudSync: windowObj.GuideCloudSync, localStorage, windowObj, listeners: listeners };
}

test("notifyChanged termina sincronizando y reporta 'synced' solo tras exito real de cloudSaveGuideData", async () => {
  const calls = [];
  const statusLog = [];
  let state = { campo1: "hola" };
  const { GuideCloudSync } = loadModule({
    _firebaseDb: {
      cloudSaveGuideData: async (scopeKey, fileName, snapshot) => { calls.push(snapshot); return true; },
    },
  });

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:x",
    guideDataFile: "x.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    baseDelayMs: 10,
    onStatus: (key, msg) => statusLog.push(key),
  });

  store.notifyChanged();
  assert.ok(statusLog.includes("dirty"), "debe reportar 'dirty' de inmediato (guardado local, sincronizando)");
  assert.equal(calls.length, 0, "todavia no debe haber llamado a cloudSaveGuideData (esta debounced)");

  await sleep(60);
  assert.equal(calls.length, 1, "debe haber sincronizado exactamente una vez tras el debounce");
  assert.equal(calls[0].state.campo1, "hola");
  assert.ok(statusLog.includes("synced"), "debe reportar 'synced' solo despues del exito real");
  store.stop();
});

test("si cloudSaveGuideData falla (devuelve false sin lanzar), reporta 'error'/pendiente y reintenta con backoff creciente, nunca 'synced'", async () => {
  const attempts = [];
  let state = { campo1: "importante" };
  const { GuideCloudSync } = loadModule({
    _firebaseDb: {
      cloudSaveGuideData: async () => { attempts.push(Date.now()); return false; },
    },
  });
  const statusLog = [];

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:y",
    guideDataFile: "y.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    baseDelayMs: 10,
    maxDelayMs: 40,
    onStatus: (key) => statusLog.push(key),
  });

  store.notifyChanged();
  await sleep(150); // suficiente para varios reintentos con el backoff reducido
  store.stop(); // corta el reintento infinito: ya probamos lo que queriamos probar

  assert.ok(attempts.length >= 2, "debe haber reintentado mas de una vez: " + attempts.length);
  assert.ok(!statusLog.includes("synced"), "NUNCA debe reportar 'synced' si la nube nunca confirmo exito");
  assert.ok(statusLog.includes("error"), "debe reportar el estado de error/reintento");
});

test("los primeros fallos avisan 'pendiente de sincronizar' (tono neutro); solo tras varios seguidos escala a 'error'", async () => {
  const statusLog = [];
  let state = { campo1: "x" };
  const { GuideCloudSync } = loadModule({
    _firebaseDb: { cloudSaveGuideData: async () => false },
  });
  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:pend",
    guideDataFile: "pend.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    baseDelayMs: 8,
    maxDelayMs: 20,
    onStatus: (key) => statusLog.push(key),
  });
  store.notifyChanged();
  await sleep(20);
  store.stop();
  assert.equal(statusLog.filter((k) => k === "error").length, 0, "no debe escalar a error en los primeros 1-2 intentos");
  assert.ok(statusLog.includes("pending-sync"), "debe avisar pendiente de sincronizar desde el primer fallo");
});

test("nunca hay dos sincronizaciones en vuelo al mismo tiempo para el mismo documento", async () => {
  let concurrent = 0;
  let maxConcurrent = 0;
  let state = { campo1: "v1" };
  const { GuideCloudSync } = loadModule({
    _firebaseDb: {
      cloudSaveGuideData: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await sleep(30);
        concurrent--;
        return true;
      },
    },
  });

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:z",
    guideDataFile: "z.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    baseDelayMs: 5,
  });

  // Dispara varias sincronizaciones "solapadas" a proposito (simula el
  // autosave + el boton Guardar casi al mismo tiempo).
  store.forceSyncNow();
  store.forceSyncNow();
  state = { campo1: "v2" };
  store.notifyChanged();
  await sleep(120);
  store.stop();

  assert.equal(maxConcurrent, 1, "jamas debe haber mas de una sincronizacion en vuelo a la vez");
});

test("un cambio de OTRA pestaña (evento 'storage') se fusiona en memoria sin pisar el campo propio, y sin repintar el DOM a mitad de tecla", async () => {
  let state = { campo2: "escrito en esta pestaña" };
  const { GuideCloudSync, windowObj, listeners } = loadModule({
    _firebaseDb: {
      mergeGuideState: (previous, incoming) => {
        // Replica real (mismo contrato que firebase_db.js: incoming gana si
        // tiene contenido, si no se conserva previous) para esta prueba.
        const next = Object.assign({}, previous);
        Object.keys(incoming).forEach((k) => {
          if (String(incoming[k] || "").trim()) next[k] = incoming[k];
        });
        return next;
      },
    },
  });
  let hydratedCalls = 0;
  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:tabs",
    guideDataFile: "tabs.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => { hydratedCalls += 1; },
  });
  void store;

  // Simula que OTRA pestaña acaba de guardar el campo1 (no toca el campo2).
  const otherTabWrite = { campo1: "escrito en la OTRA pestaña" };
  const handlers = listeners["storage"] || [];
  assert.ok(handlers.length > 0, "debe existir un listener de 'storage'");
  handlers.forEach((fn) => fn({ key: "sena_portal:test:guide-data:tabs", newValue: JSON.stringify(otherTabWrite) }));

  assert.equal(state.campo1, "escrito en la OTRA pestaña", "debe adoptar el campo que la otra pestaña acaba de guardar");
  assert.equal(state.campo2, "escrito en esta pestaña", "no debe perder lo que esta pestaña ya tenia");
  assert.equal(hydratedCalls, 0, "NO debe repintar el DOM (evita cortar al aprendiz a mitad de tecla en esta pestaña)");
  void windowObj;
});

test("hydrate() nunca reemplaza una respuesta remota valida por un local vacio, y avisa al guion (onHydrated)", async () => {
  let state = {};
  let hydratedWith = null;
  const { GuideCloudSync } = loadModule({
    _firebaseDb: {
      cloudGetGuideData: async () => ({ state: { campo1: "Respuesta real de otro equipo" }, updatedAt: "2026-08-01T00:00:00.000Z" }),
      resolveGuideHydration: (local, remote) => {
        // Replica minima y suficiente del comportamiento real para esta prueba
        // (el algoritmo completo ya se prueba en tests/guide_cloud_sync_race.test.cjs).
        const localHasContent = local && local.state && Object.keys(local.state).length > 0;
        return localHasContent
          ? { state: local.state, updatedAt: local.updatedAt, source: "local" }
          : { state: remote.state, updatedAt: remote.updatedAt, source: "remote" };
      },
    },
  });

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:w",
    guideDataFile: "w.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: (s) => { hydratedWith = s; },
  });

  await store.hydrate();
  assert.equal(state.campo1, "Respuesta real de otro equipo", "debe aplicar la respuesta remota cuando lo local esta vacio");
  assert.deepEqual(hydratedWith, state, "debe avisar al guion (onHydrated) con el estado ya fusionado");
});
