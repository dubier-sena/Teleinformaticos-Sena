"use strict";

// Prueba de la cola durable de entregas (Capa 2b): processDeliveryQueue.
//   - exito: finaliza la entrega y la quita de la cola
//   - transitorio: conserva la entrada e incrementa intentos (no finaliza)
//   - permanente: descarta sin finalizar
//   - agotada (demasiados intentos): descarta sin intentar subir
//   - entradas ya entregadas: se ignoran
//
// Usa un storage en memoria inyectado, sin IndexedDB. Carga el modulo en un
// sandbox vm con window/document falsos y prueba el helper _processDeliveryQueue.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadDelivery() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );
  const sandbox = {
    window: {},
    document: { addEventListener() {}, querySelectorAll() { return []; } },
    console: { warn() {}, error() {}, info() {}, log() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.sharedAppsScriptDelivery;
}

const api = loadDelivery();
const process = api && api._processDeliveryQueue;

function makeStorage(initial) {
  const data = (initial || []).slice();
  return {
    data,
    getAll: () => Promise.resolve(data.slice()),
    put: (e) => {
      const i = data.findIndex((x) => x.key === e.key);
      if (i >= 0) data[i] = e;
      else data.push(e);
      return Promise.resolve(true);
    },
    remove: (key) => {
      const i = data.findIndex((x) => x.key === key);
      if (i >= 0) data.splice(i, 1);
      return Promise.resolve(true);
    },
  };
}

function pending(key, extra) {
  return Object.assign(
    { key: key, payload: {}, deliveryCtx: {}, attempts: 0, createdAt: Date.now(), status: "pending" },
    extra || {}
  );
}

test("el modulo expone _processDeliveryQueue", () => {
  assert.strictEqual(typeof process, "function");
});

test("entrega exitosa: finaliza y se quita de la cola", async () => {
  const storage = makeStorage([pending("k1")]);
  let finalized = 0;
  const res = await process({
    storage,
    upload: () => Promise.resolve({ ok: true, savedFileName: "x.pkt" }),
    finalize: () => { finalized += 1; return Promise.resolve(); },
    isPermanent: () => false,
  });
  assert.strictEqual(res.delivered, 1);
  assert.strictEqual(finalized, 1);
  assert.strictEqual(storage.data.length, 0);
});

test("error transitorio: conserva la entrada e incrementa intentos", async () => {
  const storage = makeStorage([pending("k1")]);
  let finalized = 0;
  const res = await process({
    storage,
    upload: () => Promise.reject(new Error("servicio congestionado")),
    finalize: () => { finalized += 1; },
    isPermanent: () => false,
  });
  assert.strictEqual(res.kept, 1);
  assert.strictEqual(finalized, 0);
  assert.strictEqual(storage.data.length, 1);
  assert.strictEqual(storage.data[0].attempts, 1);
});

test("error permanente: descarta sin finalizar", async () => {
  const storage = makeStorage([pending("k1")]);
  let finalized = 0;
  const res = await process({
    storage,
    upload: () => Promise.reject(new Error("extension no permitida")),
    finalize: () => { finalized += 1; },
    isPermanent: () => true,
  });
  assert.strictEqual(res.dropped, 1);
  assert.strictEqual(finalized, 0);
  assert.strictEqual(storage.data.length, 0);
});

test("agotada (demasiados intentos): descarta sin intentar subir", async () => {
  const storage = makeStorage([pending("k1", { attempts: 25 })]);
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({}); },
    finalize: () => {},
    isPermanent: () => false,
    maxAttempts: 25,
  });
  assert.strictEqual(res.dropped, 1);
  assert.strictEqual(uploads, 0);
  assert.strictEqual(storage.data.length, 0);
});

test("entrada muy vieja: descarta sin intentar subir", async () => {
  const old = pending("k1", { createdAt: 1000 });
  const storage = makeStorage([old]);
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({}); },
    finalize: () => {},
    isPermanent: () => false,
    now: () => 1000 + 8 * 24 * 60 * 60 * 1000, // 8 dias despues
  });
  assert.strictEqual(res.dropped, 1);
  assert.strictEqual(uploads, 0);
});

test("entradas ya entregadas se ignoran", async () => {
  const storage = makeStorage([pending("k1", { status: "delivered" })]);
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({}); },
    finalize: () => {},
    isPermanent: () => false,
  });
  assert.strictEqual(res.delivered, 0);
  assert.strictEqual(res.kept, 0);
  assert.strictEqual(res.dropped, 0);
  assert.strictEqual(uploads, 0);
  assert.strictEqual(storage.data.length, 1);
});
