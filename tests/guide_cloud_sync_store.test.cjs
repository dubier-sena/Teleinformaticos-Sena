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
      setInterval,
      clearInterval,
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
    Event: function Event(type) { this.type = type; },
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

// ── Auditoria 2026-08-31: activity_standard.js nunca volvia a llamar
// mountActivities() tras hydrate()/el refresco periodico, asi que el panel de
// entrega y el bloqueo de campos se quedaban con el estado PRE-hidratacion.
// Fix: se reusa el evento existente "activity-deadlines-updated" (que
// mountFormActivity/_mountDeliveryWatcher ya escuchan), disparado DESPUES de
// que el estado resuelto ya se aplico (setState) y de ejecutar onHydrated. ──

test("hydrate(): dispara 'activity-deadlines-updated' EXACTAMENTE una vez, y solo despues de setState + onHydrated (orden estricto)", async () => {
  const order = [];
  let state = {};
  const { GuideCloudSync, windowObj } = loadModule({
    _firebaseDb: {
      cloudGetGuideData: async () => ({ state: { campoX: "de la nube" }, updatedAt: "2026-08-31T22:00:05.000Z" }),
      resolveGuideHydration: () => ({ state: { campoX: "de la nube" }, updatedAt: "2026-08-31T22:00:05.000Z", source: "remote" }),
    },
  });

  const eventLog = [];
  windowObj.addEventListener("activity-deadlines-updated", () => eventLog.push("event"));

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:order-hydrate",
    guideDataFile: "order.html",
    getState: () => state,
    setState: (s) => { order.push("setState"); state = s; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => { order.push("onHydrated"); eventLog.push("onHydrated-marker"); },
  });

  await store.hydrate();

  assert.deepEqual(order, ["setState", "onHydrated"], "setState debe ejecutarse antes que onHydrated");
  assert.deepEqual(eventLog, ["onHydrated-marker", "event"], "el evento debe emitirse DESPUES de onHydrated, nunca antes");
  assert.equal(state.campoX, "de la nube", "el estado ya fusionado debe estar aplicado para cuando el evento se dispare");
});

test("hydrate(): tambien dispara el evento cuando gana lo LOCAL (repintar es un no-op seguro, pero debe ocurrir)", async () => {
  const eventLog = [];
  let state = { campoLocal: "ya estaba aqui" };
  const { GuideCloudSync, windowObj } = loadModule({
    _firebaseDb: {
      cloudGetGuideData: async () => ({ state: { campoLocal: "version vieja de la nube" }, updatedAt: "2026-08-01T00:00:00.000Z" }),
      resolveGuideHydration: () => ({ state: { campoLocal: "ya estaba aqui" }, updatedAt: "2026-08-31T23:00:00.000Z", source: "local" }),
    },
  });
  windowObj.addEventListener("activity-deadlines-updated", () => eventLog.push("event"));

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:order-hydrate-local",
    guideDataFile: "order-local.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  await store.hydrate();
  assert.equal(eventLog.length, 1, "debe dispararse tambien cuando gana lo local (la UI puede necesitar reevaluarse igual)");
});

test("hydrate(): si la nube no responde (sin sesion/red), NO se aplico ningun estado nuevo y el evento NO se dispara", async () => {
  const eventLog = [];
  let state = { campoLocal: "sin cambios" };
  const { GuideCloudSync, windowObj } = loadModule({}); // sin _firebaseDb -> hydrate() sale temprano
  windowObj.addEventListener("activity-deadlines-updated", () => eventLog.push("event"));

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:order-hydrate-noop",
    guideDataFile: "order-noop.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => { eventLog.push("onHydrated-no-deberia-pasar"); },
  });

  await store.hydrate();
  assert.deepEqual(eventLog, [], "sin resolucion real (setState/onHydrated nunca corrieron), no debe dispararse el evento");
});

test("startPeriodicRefresh() (via refresco automatico): dispara el evento EXACTAMENTE una vez por ciclo, solo despues de setState + onHydrated, y solo si gana lo remoto", async () => {
  const log = []; // log UNICO y compartido: prueba el orden relativo real entre los 3 eventos, ciclo a ciclo
  let state = { campoY: "version inicial" };
  const { GuideCloudSync, windowObj } = loadModule({
    _firebaseDb: {
      cloudGetGuideData: async () => ({ state: { campoY: "version nueva de otro equipo" }, updatedAt: "2026-08-31T22:30:00.000Z" }),
      resolveGuideHydration: () => ({ state: { campoY: "version nueva de otro equipo" }, updatedAt: "2026-08-31T22:30:00.000Z", source: "remote" }),
    },
  });
  windowObj.addEventListener("activity-deadlines-updated", () => log.push("event"));

  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:order-periodic",
    guideDataFile: "order-periodic.html",
    getState: () => state,
    setState: (s) => { log.push("setState"); state = s; },
    getActor: () => "Aprendiz Prueba",
    periodicRefreshMs: 15,
    onHydrated: () => { log.push("onHydrated"); },
  });

  await store.hydrate(); // primer hydrate: arranca el refresco periodico (periodicRefreshMs > 0)
  log.length = 0;

  await sleep(40); // deja correr uno o mas ciclos del refresco periodico (15ms) -- no se asume una cantidad exacta de ticks
  store.stop();

  // El refresco periodico es un setInterval real: en 40ms pueden caber 1 o
  // varios ciclos de 15ms. En vez de asumir una cantidad exacta de ciclos, se
  // valida que CADA ciclo que haya ocurrido siga el orden setState -> onHydrated
  // -> event, sin saltarse ni adelantar ningun paso.
  assert.ok(log.length >= 3, "debe haber corrido al menos un ciclo completo del refresco periodico: " + JSON.stringify(log));
  assert.equal(log.length % 3, 0, "cada ciclo debe dejar la terna setState+onHydrated+event completa, nunca a medias: " + JSON.stringify(log));
  for (let i = 0; i < log.length; i += 3) {
    assert.deepEqual(
      log.slice(i, i + 3),
      ["setState", "onHydrated", "event"],
      "en cada ciclo, el orden debe ser setState -> onHydrated -> event, nunca el evento antes"
    );
  }
  assert.equal(state.campoY, "version nueva de otro equipo", "el estado ya fusionado debe estar aplicado para cuando el evento se dispare");
});

test("startPeriodicRefresh(): si lo local ya esta al dia (no gana remoto), NO llama a onHydrated ni dispara el evento", async () => {
  const eventLog = [];
  let state = { campoZ: "ya al dia" };
  const { GuideCloudSync, windowObj } = loadModule({
    _firebaseDb: {
      cloudGetGuideData: async () => ({ state: { campoZ: "ya al dia" }, updatedAt: "2026-08-31T22:00:00.000Z" }),
      resolveGuideHydration: () => ({ state: { campoZ: "ya al dia" }, updatedAt: "2026-08-31T22:00:00.000Z", source: "local" }),
    },
  });
  windowObj.addEventListener("activity-deadlines-updated", () => eventLog.push("event"));

  let hydratedCalls = 0;
  const store = GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:order-periodic-noop",
    guideDataFile: "order-periodic-noop.html",
    getState: () => state,
    setState: (s) => { state = s; },
    getActor: () => "Aprendiz Prueba",
    periodicRefreshMs: 15,
    onHydrated: () => { hydratedCalls += 1; },
  });

  await store.hydrate();
  hydratedCalls = 0;
  eventLog.length = 0;

  await sleep(40);
  store.stop();

  assert.equal(hydratedCalls, 0, "si lo local ya gana, el refresco periodico no debe llamar onHydrated (nada cambio)");
  assert.deepEqual(eventLog, [], "sin cambio real, el refresco periodico no debe disparar el evento");
});
