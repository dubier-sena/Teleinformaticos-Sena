"use strict";

// Bloque G.1 (H3 + H4, auditoria 2026-08-27):
//   H3 -- jitter pequeño y acotado antes de drenar la cola durable en la
//   reconexion ("online"), para que 20-30 navegadores que recuperan red al
//   mismo tiempo (wifi compartida del salon) no disparen runDeliveryQueue()
//   en la misma rafaga de milisegundos.
//   H4 -- la cola en segundo plano nunca compite con un envio interactivo en
//   curso en el MISMO navegador (cede el turno, sin bloquear indefinidamente:
//   se reintenta sola en el proximo disparo).
//
// Ninguna prueba de este archivo toca IndexedDB/Firebase/Apps Script reales.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDelivery(extraWindow) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );
  const documentListeners = {};
  const windowListeners = {};
  const fakeDocument = (extraWindow && extraWindow.document) || {
    addEventListener: (type, fn) => { (documentListeners[type] = documentListeners[type] || []).push(fn); },
    querySelectorAll: () => [],
  };
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const windowObj = Object.assign(
    {
      PROJECT_INTEGRATIONS: { googleAppsScriptUrl: "https://script.google.com/macros/s/FAKE/exec" },
      portalFirebaseAuth: { getIdToken: async () => "fake-id-token" },
      localStorage,
      indexedDB: (extraWindow && extraWindow.indexedDB) || undefined,
      addEventListener: (type, fn) => { (windowListeners[type] = windowListeners[type] || []).push(fn); },
    },
    extraWindow || {}
  );
  const sandbox = {
    window: windowObj,
    localStorage,
    document: fakeDocument,
    console: { warn() {}, error() {}, info() {}, log() {} },
    setTimeout: (extraWindow && extraWindow.__setTimeout) || setTimeout,
    clearTimeout,
    setInterval: (extraWindow && extraWindow.__setInterval) || function () { return 0; },
    clearInterval,
    URL: global.URL,
    AbortController: global.AbortController,
    fetch: (extraWindow && extraWindow.__fetch) || undefined,
    navigator: {},
  };
  windowObj.window = windowObj;
  windowObj.document = fakeDocument;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return {
    api: sandbox.window.sharedAppsScriptDelivery,
    documentListeners,
    windowListeners,
  };
}

// ── H3: scheduleDeliveryQueueDrain ─────────────────────────────────────────

test("scheduleDeliveryQueueDrain: jitter determinista con rand inyectado (rand=0.5, max=4000 -> 2000)", () => {
  const { api } = loadDelivery();
  const calls = [];
  const jitter = api._scheduleDeliveryQueueDrain({
    maxJitterMs: 4000,
    rand: () => 0.5,
    setTimeoutFn: (fn, ms) => calls.push(ms),
    runner: () => {},
  });
  assert.strictEqual(jitter, 2000);
  assert.deepStrictEqual(calls, [2000]);
});

test("scheduleDeliveryQueueDrain: rand=0 -> jitter 0; rand casi 1 -> jitter casi maxJitterMs (nunca lo alcanza ni lo supera)", () => {
  const { api } = loadDelivery();
  const jMin = api._scheduleDeliveryQueueDrain({ maxJitterMs: 4000, rand: () => 0, setTimeoutFn: () => {}, runner: () => {} });
  const jMax = api._scheduleDeliveryQueueDrain({ maxJitterMs: 4000, rand: () => 0.999999, setTimeoutFn: () => {}, runner: () => {} });
  assert.strictEqual(jMin, 0);
  assert.ok(jMax >= 3999 && jMax < 4000, "el jitter debe quedar estrictamente por debajo del maximo configurado");
});

test("scheduleDeliveryQueueDrain: maxJitterMs=0 nunca agrega retraso, sin importar rand", () => {
  const { api } = loadDelivery();
  const jitter = api._scheduleDeliveryQueueDrain({ maxJitterMs: 0, rand: () => 0.7, setTimeoutFn: () => {}, runner: () => {} });
  assert.strictEqual(jitter, 0);
});

test("scheduleDeliveryQueueDrain: sin maxJitterMs explicito usa el valor por defecto pequeño y acotado (<=4000ms)", () => {
  const { api } = loadDelivery();
  const jitter = api._scheduleDeliveryQueueDrain({ rand: () => 0.999999, setTimeoutFn: () => {}, runner: () => {} });
  assert.ok(jitter >= 0 && jitter <= 4000, "el jitter por defecto debe ser pequeño y acotado");
});

test("scheduleDeliveryQueueDrain: 30 'navegadores' con semillas distintas NO terminan sincronizados en el mismo instante", () => {
  const { api } = loadDelivery();
  // LCG simple y determinista (no Math.random real) para que el test sea
  // reproducible: cada 'navegador' recibe una semilla distinta, como pasaria
  // con 30 procesos JS realmente independientes.
  function makeSeededRand(seed) {
    let s = seed;
    return function () {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  }
  const jitters = [];
  for (let browserId = 1; browserId <= 30; browserId++) {
    jitters.push(
      api._scheduleDeliveryQueueDrain({ maxJitterMs: 4000, rand: makeSeededRand(browserId), setTimeoutFn: () => {}, runner: () => {} })
    );
  }
  jitters.forEach((j) => assert.ok(j >= 0 && j < 4000));
  const distinct = new Set(jitters);
  assert.ok(distinct.size >= 20, "30 navegadores independientes deben dispersarse en muchos valores distintos, no coincidir en unos pocos");
});

test("integracion: el listener 'online' real programa el drenado via setTimeout (jitter), no llama runDeliveryQueue de forma directa/sincronica", () => {
  const setTimeoutCalls = [];
  const fakeSetTimeout = (fn, ms) => { setTimeoutCalls.push({ fn, ms }); return 0; };
  const { documentListeners, windowListeners } = loadDelivery({
    __setTimeout: fakeSetTimeout,
    indexedDB: { open: () => ({}) }, // presente para pasar deliveryIdbAvailable(); no se usa de verdad en este test
  });

  const domReady = (documentListeners.DOMContentLoaded || [])[0];
  assert.strictEqual(typeof domReady, "function", "debe existir un listener DOMContentLoaded");
  domReady();

  // El arranque normal YA dispara 2 setTimeout (6000ms inicial; el intervalo
  // de 60s usa setInterval, no setTimeout). Limpiamos para aislar SOLO lo que
  // dispare el evento "online".
  setTimeoutCalls.length = 0;

  const onlineHandler = (windowListeners.online || [])[0];
  assert.strictEqual(typeof onlineHandler, "function", "debe existir un listener 'online'");
  onlineHandler();

  assert.strictEqual(setTimeoutCalls.length, 1, "\"online\" debe programar el drenado via setTimeout, no llamarlo de inmediato");
  assert.ok(setTimeoutCalls[0].ms >= 0 && setTimeoutCalls[0].ms < 4000, "el retraso programado debe ser el jitter pequeño y acotado, no 0 fijo ni un valor grande");
});

test("integracion: el arranque inicial (6s) y el intervalo (60s) NO se tocan -- siguen siendo los mismos valores que antes de H3", () => {
  const setTimeoutCalls = [];
  const setIntervalCalls = [];
  const { documentListeners } = loadDelivery({
    __setTimeout: (fn, ms) => { setTimeoutCalls.push(ms); return 0; },
    __setInterval: (fn, ms) => { setIntervalCalls.push(ms); return 0; },
    indexedDB: { open: () => ({}) },
  });
  const domReady = (documentListeners.DOMContentLoaded || [])[0];
  domReady();
  assert.deepStrictEqual(setTimeoutCalls, [6000], "el arranque inicial no debe cambiar de valor por H3 (no es el punto de sincronizacion real)");
  assert.deepStrictEqual(setIntervalCalls, [60000], "el intervalo periodico no cambia (se auto-dispersa por hora de carga de cada pestaña)");
});

// ── H4: prioridad de la entrega interactiva sobre la cola en segundo plano ──

test("H4: runDeliveryQueue cede el turno (nunca abre IndexedDB) si hay un envio interactivo en curso", async () => {
  let openCalls = 0;
  const { api } = loadDelivery({
    indexedDB: {
      open: () => {
        openCalls += 1;
        const req = {};
        setTimeout(() => { if (req.onerror) req.onerror(new Error("no deberia llegar aqui")); }, 0);
        return req;
      },
    },
  });
  api._setInteractiveDeliveryInFlight(true);
  await api._runDeliveryQueue();
  assert.strictEqual(openCalls, 0, "con un envio interactivo en curso, la cola no debe ni siquiera intentar tocar IndexedDB");
});

test("H4: runDeliveryQueue SI intenta drenar normalmente cuando no hay envio interactivo en curso", async () => {
  let openCalls = 0;
  const { api } = loadDelivery({
    indexedDB: {
      open: () => {
        openCalls += 1;
        const req = {};
        setTimeout(() => { if (req.onerror) req.onerror(new Error("fin del test, no hace falta que la apertura funcione mas alla de contarla")); }, 0);
        return req;
      },
    },
  });
  api._setInteractiveDeliveryInFlight(false);
  await api._runDeliveryQueue();
  assert.strictEqual(openCalls, 1, "sin envio interactivo en curso, la cola debe intentar drenar con normalidad");
});

test("H4: no es un bloqueo indefinido -- al terminar el envio interactivo (flag en false), la cola vuelve a intentar en el siguiente disparo", async () => {
  let openCalls = 0;
  const { api } = loadDelivery({
    indexedDB: {
      open: () => {
        openCalls += 1;
        const req = {};
        setTimeout(() => { if (req.onerror) req.onerror(new Error("fin del test")); }, 0);
        return req;
      },
    },
  });
  api._setInteractiveDeliveryInFlight(true);
  await api._runDeliveryQueue();
  assert.strictEqual(openCalls, 0);

  // El envio interactivo termina (su propio finally libera el flag).
  api._setInteractiveDeliveryInFlight(false);
  await api._runDeliveryQueue();
  assert.strictEqual(openCalls, 1, "en el siguiente disparo, sin el flag activo, la cola vieja debe poder continuar -- no queda bloqueada para siempre");
});
