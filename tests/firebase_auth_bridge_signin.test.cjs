"use strict";

// Prueba de la estrategia de autenticacion del bridge (Capa 1):
//   - sign-in primero (1 llamada en el caso comun: aprendiz que ya existe)
//   - fallback a crear (cuenta nueva / enumeration protection)
//   - deteccion de password incorrecta (create -> email-already-in-use)
//   - reintento con backoff ante "auth/too-many-requests" (avalancha de logins)
//
// Carga firebase_auth_bridge.js en un sandbox vm con un window falso y prueba
// la funcion pura expuesta como _resolveSignInOrCreate, con dependencias
// inyectadas (signIn/create/sleep/rand) para que sea deterministica y rapida.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadBridge() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "firebase_auth_bridge.js"),
    "utf8"
  );
  const sandbox = {
    window: {},
    console: { warn() {}, error() {}, info() {} },
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.portalFirebaseAuth;
}

const bridge = loadBridge();
const resolve = bridge && bridge._resolveSignInOrCreate;
const noSleep = () => Promise.resolve();
const fixedRand = () => 0;
const rejecter = (code) => () => Promise.reject({ code });

test("el bridge expone _resolveSignInOrCreate", () => {
  assert.strictEqual(typeof resolve, "function");
});

test("aprendiz existente entra con UNA sola llamada (sin crear)", async () => {
  let signInCalls = 0;
  let createCalls = 0;
  const res = await resolve(
    {
      signIn: () => {
        signInCalls += 1;
        return Promise.resolve({ user: { uid: "u1" } });
      },
      create: () => {
        createCalls += 1;
        return Promise.resolve({ user: { uid: "no" } });
      },
      sleep: noSleep,
      rand: fixedRand,
    },
    "ana@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.uid, "u1");
  assert.strictEqual(res.created, undefined);
  assert.strictEqual(signInCalls, 1);
  assert.strictEqual(createCalls, 0);
});

test("cuenta nueva con enumeration protection OFF (user-not-found) -> crea", async () => {
  let createCalls = 0;
  const res = await resolve(
    {
      signIn: rejecter("auth/user-not-found"),
      create: () => {
        createCalls += 1;
        return Promise.resolve({ user: { uid: "u2" } });
      },
      sleep: noSleep,
      rand: fixedRand,
    },
    "neo@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.uid, "u2");
  assert.strictEqual(res.created, true);
  assert.strictEqual(createCalls, 1);
});

test("cuenta nueva con enumeration protection ON (invalid-credential) -> crea", async () => {
  const res = await resolve(
    {
      signIn: rejecter("auth/invalid-credential"),
      create: () => Promise.resolve({ user: { uid: "u3" } }),
      sleep: noSleep,
      rand: fixedRand,
    },
    "neo@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.created, true);
});

test("password incorrecta en cuenta existente -> wrong-password", async () => {
  const res = await resolve(
    {
      signIn: rejecter("auth/invalid-credential"),
      create: rejecter("auth/email-already-in-use"),
      sleep: noSleep,
      rand: fixedRand,
    },
    "ana@sena-portal.local",
    "mala"
  );
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "auth/wrong-password");
});

test("too-many-requests: reintenta con backoff y luego entra", async () => {
  let signInCalls = 0;
  let sleeps = 0;
  const res = await resolve(
    {
      signIn: () => {
        signInCalls += 1;
        if (signInCalls <= 2) return Promise.reject({ code: "auth/too-many-requests" });
        return Promise.resolve({ user: { uid: "u5" } });
      },
      create: () => Promise.reject({ code: "auth/should-not-be-called" }),
      sleep: () => {
        sleeps += 1;
        return Promise.resolve();
      },
      rand: fixedRand,
    },
    "ana@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.uid, "u5");
  assert.strictEqual(signInCalls, 3);
  assert.strictEqual(sleeps, 2);
});

test("too-many-requests persistente: agota reintentos y devuelve el error", async () => {
  let signInCalls = 0;
  const res = await resolve(
    {
      signIn: () => {
        signInCalls += 1;
        return Promise.reject({ code: "auth/too-many-requests" });
      },
      create: () => Promise.reject({ code: "auth/unused" }),
      sleep: noSleep,
      rand: fixedRand,
      maxAttempts: 3,
    },
    "ana@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "auth/too-many-requests");
  assert.strictEqual(signInCalls, 3);
});

test("error no recuperable (operation-not-allowed) no reintenta ni crea", async () => {
  let signInCalls = 0;
  let createCalls = 0;
  const res = await resolve(
    {
      signIn: () => {
        signInCalls += 1;
        return Promise.reject({ code: "auth/operation-not-allowed" });
      },
      create: () => {
        createCalls += 1;
        return Promise.resolve({ user: { uid: "no" } });
      },
      sleep: noSleep,
      rand: fixedRand,
    },
    "ana@sena-portal.local",
    "secret"
  );
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, "auth/operation-not-allowed");
  assert.strictEqual(signInCalls, 1);
  assert.strictEqual(createCalls, 0);
});
