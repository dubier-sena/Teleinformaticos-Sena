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

function loadDelivery(sessionUser) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );
  const windowObj = {
    location: { pathname: "/guia.html" },
    portalAuth: {
      getCurrentSession: () =>
        sessionUser
          ? { role: "student", user: { usernameKey: sessionUser, fullName: sessionUser, ficha: "3441939" } }
          : null,
      getCurrentSelection: (defaults) => defaults,
    },
  };
  const sandbox = {
    window: windowObj,
    document: {
      addEventListener() {},
      querySelectorAll() { return []; },
      body: { dataset: {} },
    },
    console: { warn() {}, error() {}, info() {}, log() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  windowObj.window = windowObj;
  windowObj.document = sandbox.document;
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

// ── Riesgo 4 (cierre 2026-08-22, "computador compartido") ──────────────────
// runDeliveryQueue corre en CADA carga de pagina sin distinguir de quien es
// la cola. Antes de este fix, si el aprendiz A dejaba una entrega pendiente
// (fallo transitorio) y el aprendiz B iniciaba sesion despues en el MISMO
// equipo, el siguiente reintento la subiria usando la sesion de B -- el
// archivo de A terminaria registrado como entrega de B. Estas pruebas
// confirman que una entrada con dueno registrado que YA NO coincide con la
// sesion activa se deja pendiente sin intentar subir.

test("computador compartido: entrada de OTRO aprendiz (ownerUsernameKey distinto a la sesion actual) NO se sube, queda pendiente", async () => {
  const storage = makeStorage([pending("k1", { ownerUsernameKey: "ana" })]);
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({ ok: true }); },
    finalize: () => {},
    isPermanent: () => false,
    currentUsernameKey: () => "carlos", // otro aprendiz inicio sesion despues
  });
  assert.strictEqual(uploads, 0, "jamas debe subir el archivo de otro aprendiz con la sesion actual");
  assert.strictEqual(res.skippedOtherSession, 1);
  assert.strictEqual(res.delivered, 0);
  assert.strictEqual(storage.data.length, 1, "la entrada debe seguir en la cola, intacta, para cuando el dueno real vuelva");
  assert.strictEqual(storage.data[0].attempts, 0, "no cuenta como intento fallido: ni siquiera se intento");
});

test("computador compartido: entrada del MISMO aprendiz que sigue con sesion activa SI se sube normalmente", async () => {
  const storage = makeStorage([pending("k1", { ownerUsernameKey: "ana" })]);
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({ ok: true }); },
    finalize: () => {},
    isPermanent: () => false,
    currentUsernameKey: () => "ana",
  });
  assert.strictEqual(uploads, 1);
  assert.strictEqual(res.delivered, 1);
  assert.strictEqual(storage.data.length, 0);
});

test("computador compartido: entrada VIEJA sin ownerUsernameKey (guardada antes de este fix) se reintenta igual que siempre", async () => {
  const storage = makeStorage([pending("k1")]); // sin ownerUsernameKey, como antes de este cambio
  let uploads = 0;
  const res = await process({
    storage,
    upload: () => { uploads += 1; return Promise.resolve({ ok: true }); },
    finalize: () => {},
    isPermanent: () => false,
    currentUsernameKey: () => "cualquiera",
  });
  assert.strictEqual(uploads, 1, "compatibilidad: sin dueno registrado, se reintenta como antes");
  assert.strictEqual(res.delivered, 1);
});

test("getCurrentIdentity expone el usernameKey de la sesion activa (lo que enqueueDelivery guarda como ownerUsernameKey)", () => {
  const withSession = loadDelivery("ana");
  const identityWithSession = withSession._getCurrentIdentity();
  assert.equal(identityWithSession.fullName, "ana");

  const withoutSession = loadDelivery();
  const identityWithoutSession = withoutSession._getCurrentIdentity();
  assert.equal(identityWithoutSession.session, null);
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
