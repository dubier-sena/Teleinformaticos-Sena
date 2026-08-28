"use strict";

// Bloque G.1 (Fase E) — arnes de simulacion LOCAL para medir el comportamiento
// real del pipeline de entregas (retryWithBackoff + uploadToAppsScript +
// cola durable + jitter H3 + prioridad H4) bajo carga, SIN tocar Firebase,
// Apps Script, Drive ni producción.
//
// Diseño:
//   - Reloj virtual: setTimeout/setInterval/sleep controlados, avanzables por
//     el test ("segundo 5", "minuto 1", etc.) sin esperar tiempo real.
//   - "Navegador" simulado = una instancia vm.createContext INDEPENDIENTE que
//     carga el modulo REAL js/shared_apps_script_delivery.js (no una
//     reimplementacion) -- cada aprendiz tiene su PROPIO
//     deliveryQueueRunning/interactiveDeliveryInFlight/IndexedDB falsa, igual
//     que en la vida real cada navegador es independiente.
//   - Servidor Apps Script falso COMPARTIDO entre todos los navegadores (asi
//     como en la realidad todos le pegan al MISMO backend): cuenta requests,
//     concurrencia maxima observada, y aplica idempotencia real por
//     submissionId (igual que findFileBySubmissionId en el .gs real) para
//     poder detectar duplicados de verdad.
//   - No se usa `fetch`/`setTimeout` reales en ningun navegador simulado: el
//     reloj virtual reemplaza ambos, así que 60 "aprendices" con reintentos
//     con backoff de hasta 24s corren en milisegundos de tiempo real de test.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DELIVERY_MODULE_SRC = fs.readFileSync(
  path.join(__dirname, "..", "..", "js", "shared_apps_script_delivery.js"),
  "utf8"
);

// ── Reloj virtual ────────────────────────────────────────────────────────

function createVirtualClock() {
  let now = 0;
  let idCounter = 1;
  const timers = new Map(); // id -> { fireAt, fn, intervalMs }

  function setTimeoutFn(fn, ms) {
    const id = idCounter++;
    timers.set(id, { fireAt: now + Math.max(0, Number(ms) || 0), fn, intervalMs: null });
    return id;
  }
  function clearTimeoutFn(id) { timers.delete(id); }
  function setIntervalFn(fn, ms) {
    const id = idCounter++;
    const interval = Math.max(1, Number(ms) || 0);
    timers.set(id, { fireAt: now + interval, fn, intervalMs: interval });
    return id;
  }
  function clearIntervalFn(id) { timers.delete(id); }

  function sleep(ms) {
    return new Promise((resolve) => setTimeoutFn(resolve, ms));
  }

  function findNext(limit) {
    let nextId = null;
    let nextFireAt = Infinity;
    for (const [id, t] of timers) {
      if ((limit === undefined || t.fireAt <= limit) && t.fireAt < nextFireAt) {
        nextFireAt = t.fireAt;
        nextId = id;
      }
    }
    return nextId === null ? null : { id: nextId, fireAt: nextFireAt };
  }

  async function flushMicrotasks(rounds) {
    for (let i = 0; i < (rounds || 30); i++) await Promise.resolve();
  }

  // IMPORTANTE: una cadena de awaits sobre promesas YA resueltas (p.ej.
  // getDeliveryIdToken() -> bridge.getIdToken()) no registra ningun timer
  // hasta que el codigo real efectivamente llega a fetch()/sleep(). Por eso
  // SIEMPRE se vacian microtasks ANTES de preguntar "que timer sigue" -- si
  // se preguntara primero, una simulacion podria ver 0 timers pendientes y
  // terminar "advanceTo" sin haber dejado que el codigo real llegara a
  // programar el suyo. Tope de iteraciones para nunca colgar el test si algo
  // se reprograma sin fin.
  async function advanceTo(target, opts) {
    var maxIterations = (opts && opts.maxIterations) || 20000;
    var iterations = 0;
    for (;;) {
      await flushMicrotasks();
      const next = findNext(target);
      if (!next) break;
      iterations += 1;
      if (iterations > maxIterations) {
        throw new Error("advanceTo: demasiadas iteraciones (" + maxIterations + ") -- probable timer que se reprograma indefinidamente antes de " + target + "ms simulados");
      }
      const t = timers.get(next.id);
      if (t.intervalMs) {
        t.fireAt = next.fireAt + t.intervalMs;
      } else {
        timers.delete(next.id);
      }
      now = next.fireAt;
      try { t.fn(); } catch (_) { /* los handlers reales ya se protegen solos */ }
    }
    now = Math.max(now, target);
    await flushMicrotasks();
  }

  // Agota TODOS los timers pendientes sin limite de tiempo (util para dejar
  // que una cadena de reintentos in-session termine de una vez). Se detiene
  // sin error si lo unico que queda son intervalos periodicos (setInterval de
  // 60s): esos nunca "terminan" solos, advanceTo(target) es la forma correcta
  // de simular tiempo con intervalos activos.
  async function drainAll(maxIterations) {
    let iterations = 0;
    for (;;) {
      await flushMicrotasks();
      const next = findNext(undefined);
      if (!next) break;
      const t = timers.get(next.id);
      if (t.intervalMs) break;
      iterations += 1;
      if (iterations > (maxIterations || 5000)) {
        throw new Error("drainAll: demasiadas iteraciones -- probable timer que se reprograma indefinidamente");
      }
      timers.delete(next.id);
      now = next.fireAt;
      try { t.fn(); } catch (_) {}
    }
  }

  return {
    setTimeout: setTimeoutFn,
    clearTimeout: clearTimeoutFn,
    setInterval: setIntervalFn,
    clearInterval: clearIntervalFn,
    sleep,
    advanceTo,
    drainAll,
    getNow: () => now,
    pendingCount: () => timers.size,
  };
}

// ── Servidor Apps Script falso (compartido entre "navegadores") ───────────

// behaviorFn(ctx) -> { kind, delayMs?, diag?, message? }
//   kind: "ok" | "transient-429" | "transient-503" | "transient-500" |
//         "transient-timeout" | "transient-network" | "response-lost-after-save" |
//         "permanent"
// ctx: { requestIndex, submissionId, body, now }
function createFakeAppsScriptServer(clock, behaviorFn) {
  const createdFiles = new Map(); // submissionId -> { fileId, url, createdAt }
  let requestCounter = 0;
  let activeCount = 0;
  let maxActive = 0;
  const requestLog = []; // { at, requestIndex, submissionId, kind }

  async function fetchImpl(url, opts) {
    requestCounter += 1;
    const requestIndex = requestCounter;
    activeCount += 1;
    maxActive = Math.max(maxActive, activeCount);
    let body = {};
    try { body = JSON.parse(opts && opts.body ? opts.body : "{}"); } catch (_) {}
    const submissionId = String(body.submissionId || "");
    const decision = behaviorFn({ requestIndex, submissionId, body, now: clock.getNow() }) || { kind: "ok" };
    requestLog.push({ at: clock.getNow(), requestIndex, submissionId, kind: decision.kind });

    try {
      if (decision.kind === "transient-timeout") {
        await new Promise((resolve, reject) => {
          const hangMs = decision.delayMs != null ? decision.delayMs : 999999;
          const timerId = clock.setTimeout(resolve, hangMs);
          if (opts && opts.signal) {
            if (opts.signal.aborted) {
              clock.clearTimeout(timerId);
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
              return;
            }
            opts.signal.addEventListener("abort", function () {
              clock.clearTimeout(timerId);
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      } else {
        await clock.sleep(decision.delayMs || 0);
      }

      if (decision.kind === "transient-network") {
        throw new Error("Failed to fetch (red simulada)");
      }

      if (decision.kind === "permanent") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: false,
            transient: false,
            diag: decision.diag || "permanent",
            message: decision.message || "Error permanente simulado.",
          }),
        };
      }

      if (decision.kind === "transient-429" || decision.kind === "transient-503" || decision.kind === "transient-500") {
        const status = decision.kind === "transient-429" ? 429 : decision.kind === "transient-503" ? 503 : 500;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: false,
            transient: true,
            diag: "http-" + status,
            message: "Congestion simulada (HTTP " + status + ").",
          }),
        };
      }

      if (decision.kind === "response-lost-after-save") {
        if (submissionId && !createdFiles.has(submissionId)) {
          createdFiles.set(submissionId, {
            fileId: "file-" + submissionId,
            url: "https://drive/fake/" + submissionId,
            createdAt: clock.getNow(),
          });
        }
        throw new Error("Failed to fetch (respuesta perdida DESPUES de guardar, simulada)");
      }

      // "ok": idempotencia real por submissionId, igual que findFileBySubmissionId.
      let file = submissionId ? createdFiles.get(submissionId) : null;
      let idempotentReplay = false;
      if (file) {
        idempotentReplay = true;
      } else {
        file = {
          fileId: "file-" + (submissionId || requestIndex),
          url: "https://drive/fake/" + (submissionId || requestIndex),
          createdAt: clock.getNow(),
        };
        if (submissionId) createdFiles.set(submissionId, file);
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          driveUrl: file.url,
          fileId: file.fileId,
          savedFileName: "archivo_simulado_" + (submissionId || requestIndex) + ".pdf",
          confirmedAt: new Date(2026, 7, 27, 0, 0, 0, file.createdAt).toISOString(),
          idempotentReplay: idempotentReplay,
        }),
      };
    } finally {
      activeCount -= 1;
    }
  }

  return {
    fetchImpl,
    getStats: function () {
      return {
        totalRequests: requestCounter,
        maxConcurrency: maxActive,
        filesCreated: createdFiles.size,
        requestLog: requestLog.slice(),
      };
    },
  };
}

// ── "Navegador" simulado: una instancia independiente del modulo real ─────

function createSimulatedBrowser(clock, fakeFetch, opts) {
  opts = opts || {};
  const documentListeners = {};
  const windowListeners = {};
  const fakeDocument = {
    addEventListener: function (type, fn) { (documentListeners[type] = documentListeners[type] || []).push(fn); },
    querySelectorAll: function () { return []; },
  };
  const store = {};
  const localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
  };

  // IndexedDB falsa MINIMA pero funcional (suficiente para
  // deliveryIdbOpen/Get/Put/Remove reales del modulo) -- en memoria, propia
  // de ESTE navegador (nunca compartida entre aprendices).
  const idbStore = new Map();
  function makeFakeIndexedDB() {
    return {
      open: function () {
        var req = { result: { objectStoreNames: { contains: function () { return true; } } } };
        clock.setTimeout(function () {
          if (req.onupgradeneeded) {
            req.onupgradeneeded({
              target: {
                result: {
                  objectStoreNames: { contains: function () { return false; } },
                  createObjectStore: function () {},
                },
              },
            });
          }
          if (req.onsuccess) req.onsuccess();
        }, 0);
        return req;
      },
    };
  }

  var listeners = {};
  var onlineAvailable = opts.indexedDBAvailable !== false;
  const windowObj = {
    PROJECT_INTEGRATIONS: { googleAppsScriptUrl: "https://script.google.com/macros/s/FAKE/exec" },
    portalFirebaseAuth: { getIdToken: async function () { return opts.idToken !== undefined ? opts.idToken : "fake-id-token-" + (opts.learnerId || "x"); } },
    localStorage: localStorage,
    indexedDB: onlineAvailable ? makeFakeIndexedDB() : undefined,
    addEventListener: function (type, fn) { (windowListeners[type] = windowListeners[type] || []).push(fn); },
    location: { pathname: "/pages/guias/" + (opts.pageFile || "guia.html") },
    __RUNTIME_PAGE_FILE__: opts.pageFile || "guia.html",
  };

  // Sustituye el store IndexedDB real de deliveryIdbOpen por uno en memoria:
  // el modulo real usa keyPath "key" sobre un objectStore -- replicamos su
  // contrato exacto (getAll/put/delete) sin pasar por window.indexedDB real,
  // via un pequeño parche post-carga (mas simple y fiel que emular IDBRequest
  // por completo). Ver wireIdb() abajo, llamado despues de vm.runInContext.

  const sandbox = {
    window: windowObj,
    localStorage: localStorage,
    document: fakeDocument,
    console: { warn: function () {}, error: function () {}, info: function () {}, log: function () {} },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    URL: global.URL,
    AbortController: global.AbortController,
    fetch: fakeFetch,
    navigator: { onLine: true },
  };
  windowObj.window = windowObj;
  windowObj.document = fakeDocument;
  vm.createContext(sandbox);
  vm.runInContext(DELIVERY_MODULE_SRC, sandbox, { filename: "shared_apps_script_delivery.js" });

  const api = sandbox.window.sharedAppsScriptDelivery;

  // Cola en memoria (Map) por navegador, IGUAL de "durable" dentro del test
  // (sobrevive a cualquier numero de llamadas dentro de esta simulacion),
  // pero SIN pasar por IndexedDB real -- se inyecta reemplazando el `storage`
  // que ve processDeliveryQueue a traves de un runDeliveryQueue propio, ya
  // que el _runDeliveryQueue exportado usa el storage interno real. Para
  // simulaciones a esta escala usamos directamente _processDeliveryQueue con
  // este storage en memoria (misma logica pura, sin diferencia de
  // comportamiento) en vez de depender de la IndexedDB fake.
  const memoryQueue = new Map();
  const queueStorage = {
    getAll: async function () { return Array.from(memoryQueue.values()); },
    put: async function (entry) { memoryQueue.set(entry.key, entry); },
    remove: async function (key) { memoryQueue.delete(key); },
  };

  function fireDomReady() {
    (documentListeners.DOMContentLoaded || []).forEach(function (fn) { fn(); });
  }

  return {
    api: api,
    documentListeners: documentListeners,
    windowListeners: windowListeners,
    memoryQueue: memoryQueue,
    queueStorage: queueStorage,
    fireDomReady: fireDomReady,
  };
}

// Simula UNA entrega interactiva de UN archivo logico, con la MISMA logica de
// decision que handleModalSubmit real (retryWithBackoff -> si falla y no es
// permanente -> cola durable), usando las funciones puras exportadas del
// modulo real (no una reimplementacion).
async function simulateLearnerUpload(browser, fileDescriptor) {
  const api = browser.api;
  const submissionId = fileDescriptor.submissionId || api._buildSubmissionId();
  const payload = {
    guideLabel: fileDescriptor.guideLabel || "Guia simulada",
    activityLabel: fileDescriptor.activityLabel || "Actividad simulada",
    activityNumber: fileDescriptor.activityNumber || "1",
    fileName: fileDescriptor.fileName || "evidencia.py",
    mimeType: "text/plain",
    fileBase64: "ZmFrZQ==",
    fullName: fileDescriptor.fullName || "Aprendiz Simulado",
    ficha: fileDescriptor.ficha || "0000000",
    pageFile: fileDescriptor.pageFile || "guia.html",
    submittedAt: new Date().toISOString(),
    submissionId: submissionId,
  };
  const deliveryCtx = {
    context: { pageFile: payload.pageFile, panelKey: fileDescriptor.panelKey || "target" },
    panelKey: fileDescriptor.panelKey || "target",
    pageFile: payload.pageFile,
    fullName: payload.fullName,
    ficha: payload.ficha,
    fileName: payload.fileName,
    submittedAt: payload.submittedAt,
  };

  const retries = { count: 0 };
  try {
    const response = await api._retryWithBackoff(
      function () { return api._uploadToAppsScript(payload); },
      {
        isPermanent: api._isPermanentDeliveryError,
        onRetry: function () { retries.count += 1; },
      }
    );
    const record = api._finalizeDelivery(deliveryCtx, response, null);
    return { outcome: "delivered-immediately", retries: retries.count, submissionId: submissionId, record: record };
  } catch (error) {
    if (!api._isPermanentDeliveryError(error)) {
      browser.memoryQueue.set(
        (payload.pageFile || "guia") + "|" + (fileDescriptor.panelKey || "target"),
        {
          key: (payload.pageFile || "guia") + "|" + (fileDescriptor.panelKey || "target"),
          payload: payload,
          deliveryCtx: deliveryCtx,
          ownerUsernameKey: fileDescriptor.usernameKey || "",
          createdAt: Date.now(),
          attempts: 0,
          status: "pending",
        }
      );
      return { outcome: "queued", retries: retries.count, submissionId: submissionId, error: error };
    }
    return { outcome: "failed-permanent", retries: retries.count, submissionId: submissionId, error: error };
  }
}

// Drena la cola EN MEMORIA de un navegador (equivalente de processDeliveryQueue
// real, mismo helper puro exportado) una vez.
async function drainBrowserQueue(browser) {
  const api = browser.api;
  return api._processDeliveryQueue({
    storage: browser.queueStorage,
    upload: function (payload) { return api._uploadToAppsScript(payload); },
    finalize: function (entry, response) { return api._finalizeDelivery(entry.deliveryCtx, response, null); },
    isPermanent: api._isPermanentDeliveryError,
    currentUsernameKey: function () { return ""; },
    // Bloque G.2: mismo deps que el runDeliveryQueue real -- si esto se
    // omitiera, la simulacion de "cuota agotada" seguiria midiendo un
    // descarte silencioso aunque el codigo real ya avise.
    onGiveUp: api._handleQueueGiveUp,
  });
}

module.exports = {
  createVirtualClock,
  createFakeAppsScriptServer,
  createSimulatedBrowser,
  simulateLearnerUpload,
  drainBrowserQueue,
};
