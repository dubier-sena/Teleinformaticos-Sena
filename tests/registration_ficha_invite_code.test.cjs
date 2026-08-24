"use strict";

// Fase 6 (auditoria profunda, 2026-08-23 -- CORREGIDO tras revision de
// seguridad posterior): el diseno original guardaba el codigo de invitacion
// en Firestore con lectura PUBLICA (sena_portal_ficha_codes, "allow get: if
// true") para poder leerlo antes del login. Hallazgo real: eso significaba
// que CUALQUIERA que conociera una ficha podia leer el codigo REAL por
// Firestore REST sin sesion -- el codigo nunca fue secreto.
//
// Corregido migrando TODA la verificacion a Apps Script
// (apps-script/entregas_actividades.gs, acciones "verifyRegistrationCode" y
// "setRegistrationCode"): el codigo se compara server-side contra un hash
// SHA-256(ficha + ":" + codigo + ":" + secreto) guardado en Script
// Properties (nunca en Firestore, nunca en git, nunca en JS publico). El
// cliente NUNCA recibe el codigo ni un hash reutilizable -- solo
// valido/no-valido. sena_portal_ficha_codes ya no existe como coleccion.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// ═══════════════════════════════════════════════════════════════════════════
// Lado Apps Script (entregas_actividades.gs): EJECUTA doPost de verdad, con
// PropertiesService/CacheService/UrlFetchApp simulados. Mismo patron que
// tests/entregas_actividades_identity_security.test.cjs.
// ═══════════════════════════════════════════════════════════════════════════

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "entregas_actividades.gs"),
  "utf8"
);

function makeGsSandbox(scriptProps, identityEmail) {
  const properties = Object.assign({
    FIREBASE_API_KEY: "fake-api-key",
    REGISTRATION_CODE_SECRET: "test-secret-nunca-en-git",
  }, scriptProps || {});
  const cacheStore = {};
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (name) {
            return Object.prototype.hasOwnProperty.call(properties, name) ? properties[name] : "";
          },
          setProperty: function (name, value) { properties[name] = value; },
        };
      },
    },
    CacheService: {
      getScriptCache: function () {
        return {
          get: function (k) { return Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null; },
          put: function (k, v) { cacheStore[k] = v; },
        };
      },
    },
    Utilities: {
      base64Decode: function (b64) { return Buffer.from(String(b64 || ""), "base64"); },
      base64Encode: function (bytes) { return Buffer.from(bytes).toString("base64"); },
      newBlob: function (bytes, mime, name) { return { getName: function () { return name; } }; },
      computeDigest: function (algo, text) {
        const crypto = require("node:crypto");
        return Array.from(crypto.createHash("sha256").update(text, "utf8").digest());
      },
      base64EncodeWebSafe: function () { return "digest"; },
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      sleep: function () { /* sin espera real en los tests */ },
    },
    DriveApp: { getFolderById: function () { throw new Error("no deberia tocar Drive en estas pruebas"); } },
    ContentService: {
      createTextOutput: function (text) {
        return { setMimeType: function () { return { getContent: function () { return text; } }; } };
      },
      MimeType: { JSON: "JSON" },
    },
    UrlFetchApp: {
      fetch: function (url) {
        if (url.indexOf("identitytoolkit.googleapis.com") >= 0) {
          return {
            getResponseCode: function () { return 200; },
            getContentText: function () {
              return JSON.stringify({ users: [{ email: identityEmail || "", localId: "uid-test" }] });
            },
          };
        }
        throw new Error("UrlFetchApp.fetch: URL no simulada: " + url);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(gsSource, sandbox);
  return { sandbox, properties };
}

function callDoPost(sandbox, payloadObj) {
  const result = sandbox.doPost({ postData: { contents: JSON.stringify(payloadObj) } });
  return JSON.parse(result.getContent());
}

// ── Caso 1 (adaptado): sin sesion, ¿se puede leer el codigo por Firestore? ──
// Ya no existe la coleccion: la prueba real es a nivel de reglas (ver
// tests/firestore_rules_ownership.test.cjs) y aqui, a nivel de superficie de
// codigo -- confirmar que NINGUN archivo del cliente vuelve a leer/exponer
// un "code"/"codigo" en texto plano desde Firestore.
test("Caso 1 -- sena_portal_ficha_codes ya no existe como coleccion (nada que leer sin sesion)", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  assert.doesNotMatch(rules, /match \/sena_portal_ficha_codes\//, "no debe quedar ninguna regla para esta coleccion -- cae al cierre total por defecto");
  const clientCode = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  // COL_FICHA_CODES (la constante que apuntaba a esta coleccion) ya no debe
  // existir -- el nombre de la coleccion puede seguir apareciendo dentro de
  // un comentario explicando POR QUE se abandono ese diseno, eso es
  // documentacion valida, no una referencia funcional.
  assert.doesNotMatch(clientCode, /COL_FICHA_CODES/, "la constante de la coleccion debe haberse eliminado por completo");
  assert.doesNotMatch(clientCode, /cloudGetFichaCode|cloudSaveFichaCode|evaluateFichaInviteCode/, "las funciones del diseno anterior (Firestore publico) no deben quedar");
});

test("Caso 2 -- codigo CORRECTO: verifyRegistrationCode responde valido, registro permitido", () => {
  const { sandbox, properties } = makeGsSandbox();
  const hash = require("node:crypto").createHash("sha256").update("3441939:ABC12345:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = hash;

  const response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "ABC12345" });
  assert.equal(response.ok, true);
  assert.equal(response.valid, true);
});

test("Caso 3 -- codigo INCORRECTO: rechazado con mensaje generico", () => {
  const { sandbox, properties } = makeGsSandbox();
  const hash = require("node:crypto").createHash("sha256").update("3441939:ABC12345:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = hash;

  const response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "codigo-inventado" });
  assert.equal(response.ok, true);
  assert.equal(response.valid, false);
});

test("Caso 4 -- ficha correcta + codigo de OTRA ficha: rechazado (el hash incluye la ficha)", () => {
  const { sandbox, properties } = makeGsSandbox();
  const hashFichaA = require("node:crypto").createHash("sha256").update("3441939:CODIGO-A:test-secret-nunca-en-git", "utf8").digest("hex");
  const hashFichaB = require("node:crypto").createHash("sha256").update("3441944:CODIGO-B:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = hashFichaA;
  properties["FICHA_CODE_HASH_3441944"] = hashFichaB;

  // Alguien con el codigo real de 3441944 intenta usarlo para 3441939.
  const response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "CODIGO-B" });
  assert.equal(response.ok, true);
  assert.equal(response.valid, false);
});

test("Caso 5 -- secreto del servidor no configurado: respuesta de error explicita (fail-closed), nunca 'valid:false'", () => {
  const { sandbox } = makeGsSandbox({ REGISTRATION_CODE_SECRET: "" });
  const response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "cualquier-cosa" });
  assert.equal(response.ok, false, "un fallo real de configuracion debe distinguirse de 'codigo incorrecto'");
  assert.match(response.message, /no fue posible verificar/i);
});

test("Caso 6 -- el cliente NO puede fabricar una respuesta 'valida': el servidor decide, no el frontend", () => {
  // Simula un frontend "modificado" que envia un payload arbitrario --
  // mientras el SERVIDOR (via doPost real) sea quien evalua, ningun campo
  // extra en el payload puede forzar valid:true.
  const { sandbox, properties } = makeGsSandbox();
  const hash = require("node:crypto").createHash("sha256").update("3441939:REAL-CODE:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = hash;

  const response = callDoPost(sandbox, {
    action: "verifyRegistrationCode",
    ficha: "3441939",
    code: "lo-que-sea",
    valid: true, // campo extra fabricado -- el servidor lo ignora por completo
    ok: true,
  });
  assert.equal(response.valid, false, "un campo 'valid' fabricado en el payload no debe influir en la respuesta real");
});

test("Caso 7 -- un aprendiz (no admin) intenta crear/regenerar un codigo: rechazado", () => {
  const { sandbox } = makeGsSandbox({}, "juan@sena-portal.local");
  const response = callDoPost(sandbox, {
    action: "setRegistrationCode",
    idToken: "token-juan",
    ficha: "3441939",
    code: "CODIGO-COLADO",
  });
  assert.equal(response.ok, false);
  assert.match(response.message, /no autorizado/i);
});

test("Caso 8 -- admin valido regenera el codigo: permitido, y el codigo en texto plano NUNCA se guarda", () => {
  const { sandbox, properties } = makeGsSandbox({}, "dubier@sena-portal.local");
  const response = callDoPost(sandbox, {
    action: "setRegistrationCode",
    idToken: "token-admin",
    ficha: "3441939",
    code: "NUEVO-CODIGO",
  });
  assert.equal(response.ok, true);
  const stored = properties["FICHA_CODE_HASH_3441939"];
  assert.ok(stored, "debe haberse guardado un hash");
  assert.notEqual(stored, "NUEVO-CODIGO", "el codigo en texto plano jamas debe coincidir con lo guardado");
  assert.equal(stored.length, 64, "debe ser un hash SHA-256 en hex (64 caracteres), no el codigo original");
});

test("Caso 9 -- el codigo ANTERIOR deja de servir inmediatamente despues de regenerar", () => {
  const { sandbox, properties } = makeGsSandbox({}, "dubier@sena-portal.local");
  const oldHash = require("node:crypto").createHash("sha256").update("3441939:CODIGO-VIEJO:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = oldHash;

  // El codigo viejo funciona antes de regenerar.
  let response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "CODIGO-VIEJO" });
  assert.equal(response.valid, true);

  // Admin regenera.
  callDoPost(sandbox, { action: "setRegistrationCode", idToken: "token-admin", ficha: "3441939", code: "CODIGO-NUEVO" });

  // El codigo viejo ya NO sirve; el nuevo si.
  response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "CODIGO-VIEJO" });
  assert.equal(response.valid, false, "el codigo anterior debe quedar invalidado de inmediato");
  response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "CODIGO-NUEVO" });
  assert.equal(response.valid, true);
});

test("Caso 10 -- multiples intentos fallidos: rate limit aplica un retraso, pero NUNCA bloquea permanentemente", () => {
  const { sandbox, properties } = makeGsSandbox();
  const hash = require("node:crypto").createHash("sha256").update("3441939:CODIGO-REAL:test-secret-nunca-en-git", "utf8").digest("hex");
  properties["FICHA_CODE_HASH_3441939"] = hash;

  // 6 intentos fallidos seguidos (el sandbox mockea Utilities.sleep como
  // no-op, asi que esto no ralentiza el test real -- lo que se prueba es
  // que el CONTADOR de CacheService avanza y que, pese a superar el
  // umbral, un codigo correcto INMEDIATAMENTE despues sigue funcionando).
  for (let i = 0; i < 6; i++) {
    callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "intento-fallido-" + i });
  }
  const response = callDoPost(sandbox, { action: "verifyRegistrationCode", ficha: "3441939", code: "CODIGO-REAL" });
  assert.equal(response.valid, true, "el rate limit no debe bloquear permanentemente a un aprendiz legitimo");
});

// ═══════════════════════════════════════════════════════════════════════════
// Lado cliente (js/firebase_db.js): verifyRegistrationCode / setRegistrationCode
// nunca tocan Firestore, siempre hablan con el Apps Script configurado.
// ═══════════════════════════════════════════════════════════════════════════

function loadFirebaseDbWithFetch(fetchImpl, integrations) {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const storage = new Map();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    },
    setTimeout, clearTimeout,
    portalAuth: { getCurrentSession: () => null },
    portalFirebaseAuth: {
      currentUid: () => null,
      getIdToken: async () => "fake-admin-token",
    },
    PROJECT_INTEGRATIONS: Object.assign({ googleAppsScriptUrl: "https://script.google.com/macros/s/fake/exec" }, integrations || {}),
  };
  const sandbox = {
    window: windowObj, localStorage: windowObj.localStorage, fetch: fetchImpl, setTimeout, clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"),
    sandbox,
    { filename: "guide_merge_utils.js" }
  );
  vm.runInContext(source, sandbox, { filename: "firebase_db.js" });
  return windowObj._firebaseDb;
}

test("Cliente -- verifyRegistrationCode nunca llama a Firestore, solo al Apps Script configurado", async () => {
  let calledUrl = null;
  let calledBody = null;
  const fetchImpl = async (url, opts) => {
    calledUrl = url;
    calledBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true, valid: true }) };
  };
  const db = loadFirebaseDbWithFetch(fetchImpl);
  const result = await db.verifyRegistrationCode("3441939", "ABC123");
  assert.equal(result.ok, true);
  assert.equal(calledUrl, "https://script.google.com/macros/s/fake/exec");
  assert.equal(calledBody.action, "verifyRegistrationCode");
  assert.equal(calledBody.ficha, "3441939");
  assert.equal(calledBody.code, "ABC123");
  assert.equal(calledBody.idToken, undefined, "verify no debe enviar idToken -- ocurre antes del login");
});

test("Cliente -- fallo de red: FAIL-CLOSED (ok:false, nunca autoriza sin verificar)", async () => {
  const fetchImpl = async () => { throw new Error("network down"); };
  const db = loadFirebaseDbWithFetch(fetchImpl);
  const result = await db.verifyRegistrationCode("3441939", "ABC123");
  assert.equal(result.ok, false);
  assert.match(result.message, /no fue posible verificar/i);
});

test("Cliente -- setRegistrationCode adjunta el idToken del admin y nunca guarda nada en Firestore", async () => {
  let calledBody = null;
  const fetchImpl = async (url, opts) => {
    calledBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  const db = loadFirebaseDbWithFetch(fetchImpl);
  const result = await db.setRegistrationCode("3441939", "NUEVO-CODIGO");
  assert.equal(result.ok, true);
  assert.equal(calledBody.action, "setRegistrationCode");
  assert.equal(calledBody.idToken, "fake-admin-token");
  assert.equal(calledBody.code, "NUEVO-CODIGO");
});

// ═══════════════════════════════════════════════════════════════════════════
// Integracion (portal_auth.js): wiring estatico, igual patron que el resto
// de esta suite para archivos grandes/dependientes del DOM.
// ═══════════════════════════════════════════════════════════════════════════

function readPortalAuth() {
  return fs.readFileSync(path.join(__dirname, "..", "js", "portal_auth.js"), "utf8");
}

test("portal_auth.js -- la verificacion via Apps Script corre ANTES de crear la cuenta local", () => {
  const code = readPortalAuth();
  const fnBody = code.split("async function registerStudentWithFirebaseBridge(data) {")[1] || "";
  const checkIndex = fnBody.indexOf("verifyRegistrationCode");
  const createIndex = fnBody.indexOf("await prevRegisterStudent.call(auth, data)");
  assert.ok(checkIndex > 0 && createIndex > 0 && checkIndex < createIndex);
  assert.doesNotMatch(fnBody.slice(0, createIndex), /cloudGetFichaCode|evaluateFichaInviteCode/, "no debe quedar ningun rastro del diseno anterior (Firestore publico)");
});

test("portal_auth.js -- ficha inexistente se rechaza antes de llamar a Apps Script", () => {
  const code = readPortalAuth();
  const fnBody = code.split("async function registerStudentWithFirebaseBridge(data) {")[1] || "";
  const fichaCheckIndex = fnBody.indexOf("auth.getFichaInfo(ficha)");
  const verifyCallIndex = fnBody.indexOf("verifyRegistrationCode(ficha");
  assert.ok(fichaCheckIndex > 0 && verifyCallIndex > 0 && fichaCheckIndex < verifyCallIndex);
});

test("INTENTO DE DUPLICADO -- el registro base sigue rechazando un usernameKey ya existente (sin cambios por Fase 6)", () => {
  const code = readPortalAuth();
  assert.match(code, /users\.some\(\(item\) => item\.usernameKey === validation\.usernameKey\)/);
});
