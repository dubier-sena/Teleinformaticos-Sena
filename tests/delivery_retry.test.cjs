"use strict";

// Prueba del reintento automatico de entrega (Capa 2):
//   - exito al primer intento (no reintenta)
//   - error transitorio: reintenta con backoff y luego entrega
//   - error transitorio persistente: agota intentos y propaga el error
//   - error permanente (extension/datos): NO reintenta
//   - clasificacion isPermanentDeliveryError
//
// Carga shared_apps_script_delivery.js en un sandbox vm con window/document
// falsos y prueba los helpers puros expuestos (_retryWithBackoff,
// _isPermanentDeliveryError) con dependencias inyectadas (sleep/rand).

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
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.sharedAppsScriptDelivery;
}

const api = loadDelivery();
const retry = api && api._retryWithBackoff;
const isPermanent = api && api._isPermanentDeliveryError;
const noSleep = () => Promise.resolve();
const fixedRand = () => 0;

test("el modulo expone los helpers de reintento", () => {
  assert.strictEqual(typeof retry, "function");
  assert.strictEqual(typeof isPermanent, "function");
});

test("exito al primer intento: no reintenta", async () => {
  let calls = 0;
  let retries = 0;
  const res = await retry(
    () => {
      calls += 1;
      return Promise.resolve({ ok: true });
    },
    { sleep: noSleep, rand: fixedRand, onRetry: () => { retries += 1; } }
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls, 1);
  assert.strictEqual(retries, 0);
});

test("transitorio: reintenta con backoff y luego entrega", async () => {
  let calls = 0;
  let sleeps = 0;
  let retries = 0;
  const res = await retry(
    () => {
      calls += 1;
      if (calls <= 2) return Promise.reject(new Error("falta token de seguridad"));
      return Promise.resolve({ ok: true, savedFileName: "f.pkt" });
    },
    {
      sleep: () => { sleeps += 1; return Promise.resolve(); },
      rand: fixedRand,
      isPermanent: isPermanent,
      onRetry: () => { retries += 1; },
    }
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(calls, 3);
  assert.strictEqual(sleeps, 2);
  assert.strictEqual(retries, 2);
});

test("transitorio persistente: agota intentos y propaga el error", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        () => {
          calls += 1;
          return Promise.reject(new Error("No fue posible entregar el archivo en este momento."));
        },
        { sleep: noSleep, rand: fixedRand, isPermanent: isPermanent, maxAttempts: 4 }
      ),
    /No fue posible entregar/
  );
  assert.strictEqual(calls, 4);
});

test("error permanente: NO reintenta", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      retry(
        () => {
          calls += 1;
          return Promise.reject(new Error("El archivo no tiene una extension permitida para la entrega."));
        },
        { sleep: noSleep, rand: fixedRand, isPermanent: isPermanent, maxAttempts: 4 }
      ),
    /extension permitida/
  );
  assert.strictEqual(calls, 1);
});

test("isPermanentDeliveryError clasifica correctamente", () => {
  assert.strictEqual(isPermanent(new Error("El archivo no tiene una extension permitida para la entrega.")), true);
  assert.strictEqual(isPermanent(new Error("El archivo supera el tamano maximo permitido para esta entrega.")), true);
  assert.strictEqual(isPermanent(new Error("Faltan datos obligatorios para registrar la entrega.")), true);
  // Transitorios (deben reintentarse):
  assert.strictEqual(isPermanent(new Error("No se pudo verificar tu sesion de seguridad para la entrega.")), false);
  assert.strictEqual(isPermanent(new Error("falta token de seguridad")), false);
  assert.strictEqual(isPermanent(new Error("No fue posible entregar el archivo en este momento.")), false);
});
