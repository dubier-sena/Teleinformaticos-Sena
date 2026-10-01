"use strict";

// Diagnostico 2026-10-01 (seguimiento del Laboratorio Virtual): el login del
// aprendiz autenticaba bien en Firebase Auth pero NO dejaba
// sena_portal_user_index/{uid} ni el campo uid del perfil.
//
// Causa: loginStudentWithFirebaseBridge (js/portal_auth.js) lanzaba
// cloudSaveUserIndex() y syncUserAuthHashAfterLogin() SIN esperarlas y
// devolvia el resultado; index_auth.js hace window.location.reload() en la
// misma continuacion. La recarga descarta las peticiones que aun no salieron
// (y aborta las que iban en vuelo), asi que el indice solo quedaba cuando la
// peticion ganaba la carrera por casualidad.
//
// Estas pruebas EJECUTAN el bloque real del puente de portal_auth.js contra
// el firebase_db.js real, con un Firestore REST simulado que se comporta como
// una pagina que se recarga: lo que no haya recibido respuesta cuando
// loginStudent/registerStudent resuelve, se pierde.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const UID = "uid-prueba-0001";
const KEY = "prueba10x";
const FICHA = "3441939";

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// Extrae el IIFE "INTEGRACION CON FIREBASE AUTH" (el que engancha
// loginStudent / registerStudent) sin cargar el resto de portal_auth.js.
function bridgeBlockSource() {
  const src = fs.readFileSync(path.join(ROOT, "js", "portal_auth.js"), "utf8");
  const marker = src.indexOf("INTEGRACION CON FIREBASE AUTH");
  assert.ok(marker > 0, "no se encontro el bloque del puente en portal_auth.js");
  const start = src.indexOf("(function () {", marker);
  assert.ok(start > marker, "no se encontro el inicio del IIFE del puente");
  return src.slice(start);
}

// Firestore REST simulado con latencia y "recarga de pagina".
function makePage(latencyMs) {
  const page = { reloaded: false, issued: [], applied: new Map(), dropped: [] };
  page.fetch = function (url, options) {
    const method = (options && options.method) || "GET";
    const m = String(url).match(/documents\/([^/?]+)\/([^?]+)/);
    const key = m ? m[1] + "/" + decodeURIComponent(m[2]) : String(url);
    if (page.reloaded) { page.dropped.push(method + " " + key); return new Promise(() => {}); }
    page.issued.push(method + " " + key);
    return new Promise((resolve) => {
      setTimeout(() => {
        // La pagina se recargo antes de la respuesta: peticion abortada.
        if (page.reloaded) { page.dropped.push(method + " " + key); return; }
        if (method === "GET") { resolve({ ok: false, status: 404, json: async () => ({}) }); return; }
        const body = JSON.parse(options.body);
        const prev = page.applied.get(key) || {};
        page.applied.set(key, Object.assign({}, prev, body.fields));
        resolve({ ok: true, status: 200, json: async () => ({ fields: body.fields, updateTime: "t" }) });
      }, latencyMs);
    });
  };
  return page;
}

function loadPortal(page, opts) {
  opts = opts || {};
  const localStorage = makeLocalStorage();
  const user = { usernameKey: KEY, ficha: FICHA, fullName: "Prueba X" };
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { pathname: "/index.html", protocol: "https:", hostname: "example.test" },
    portalFirebaseAuth: {
      isEnabled: () => true,
      currentUid: () => UID,
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
      ensureSignedIn: async () => ({ ok: true, uid: UID }),
      signOut: async () => {},
    },
    portalAuth: {
      loginStudent: async () => ({ ok: true, user }),
      registerStudent: async () => ({ ok: true, user }),
      loginAdmin: async () => ({ ok: false }),
      logout: async () => {},
      hashSecret: async () => "hash-de-prueba",
      isAdminSession: () => false,
      getFichaInfo: () => ({ ficha: FICHA }),
      getCurrentSession: () => null,
      setFlashMessage: () => {},
      ADMIN_PROFILE: { usernameKey: "admin" },
    },
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    document: { readyState: "complete", addEventListener: () => {} },
    fetch: page.fetch,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "firebase_db.js"), "utf8"), sandbox);
  if (opts.neverAnswers) {
    // Red colgada: las escrituras post-login no responden nunca.
    windowObj._firebaseDb.cloudSaveUserIndex = () => new Promise(() => {});
    windowObj._firebaseDb.cloudSaveUserAuth = () => new Promise(() => {});
  }
  if (opts.verifyRegistrationCode !== false) {
    windowObj._firebaseDb.verifyRegistrationCode = async () => ({ ok: true });
  }
  vm.runInContext(bridgeBlockSource(), sandbox);
  return windowObj;
}

// Igual que index_auth.js: await del login y recarga inmediata.
async function loginThenReload(page, win, method, data) {
  const result = await win.portalAuth[method](data);
  page.reloaded = true; // window.location.reload()
  await new Promise((r) => setTimeout(r, 120)); // deja pasar lo que quedara en vuelo
  return result;
}

const INDEX_DOC = "sena_portal_user_index/" + UID;
const PROFILE_DOC = "sena_portal_users/" + KEY;
const AUTH_DOC = "sena_portal_user_auth/" + KEY;

test("login con contraseña (ruta local OK): el indice uid->ficha queda escrito antes de la recarga", async () => {
  const page = makePage(25);
  const win = loadPortal(page);
  const result = await loginThenReload(page, win, "loginStudent", { username: KEY, password: "secreta-de-prueba" });
  assert.equal(result.ok, true);
  assert.ok(page.applied.has(INDEX_DOC),
    "la recarga descarto la escritura de " + INDEX_DOC + " (emitidas: " + JSON.stringify(page.issued) + ", perdidas: " + JSON.stringify(page.dropped) + ")");
  assert.equal(page.applied.get(INDEX_DOC).ficha.stringValue, FICHA);
});

test("login con contraseña: el uid queda estampado en el perfil antes de la recarga", async () => {
  const page = makePage(25);
  const win = loadPortal(page);
  await loginThenReload(page, win, "loginStudent", { username: KEY, password: "secreta-de-prueba" });
  assert.ok(page.applied.has(PROFILE_DOC), "la recarga descarto el campo uid del perfil");
  assert.equal(page.applied.get(PROFILE_DOC).uid.stringValue, UID);
});

test("login con contraseña: el hash de sena_portal_user_auth queda sincronizado antes de la recarga", async () => {
  const page = makePage(25);
  const win = loadPortal(page);
  await loginThenReload(page, win, "loginStudent", { username: KEY, password: "secreta-de-prueba" });
  assert.ok(page.applied.has(AUTH_DOC), "la recarga descarto la sincronizacion del hash");
});

test("registro: el indice y el uid del perfil quedan escritos antes de la recarga", async () => {
  const page = makePage(25);
  const win = loadPortal(page);
  const result = await loginThenReload(page, win, "registerStudent",
    { username: KEY, password: "secreta-de-prueba", ficha: FICHA, fullName: "Prueba X", code: "ABC" });
  assert.equal(result.ok, true);
  assert.ok(page.applied.has(INDEX_DOC), "el registro perdio el indice en la recarga");
  assert.ok(page.applied.has(PROFILE_DOC), "el registro perdio el uid del perfil en la recarga");
});

test("si la red no responde, el login NO se queda colgado: resuelve dentro del tope", async () => {
  const page = makePage(25);
  const win = loadPortal(page, { neverAnswers: true });
  const t0 = Date.now();
  const result = await win.portalAuth.loginStudent({ username: KEY, password: "secreta-de-prueba" });
  const elapsed = Date.now() - t0;
  assert.equal(result.ok, true, "el login local debe seguir funcionando sin nube");
  assert.ok(elapsed < 6000, "el login tardo " + elapsed + " ms esperando a la nube");
});

test("sin sesion de Firebase (bridge falla) el login local sigue devolviendo ok sin esperar nada", async () => {
  const page = makePage(25);
  const win = loadPortal(page);
  win.portalFirebaseAuth.ensureSignedIn = async () => ({ ok: false, error: "auth/network-request-failed" });
  const t0 = Date.now();
  const result = await win.portalAuth.loginStudent({ username: KEY, password: "secreta-de-prueba" });
  assert.equal(result.ok, true);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(page.issued.filter((r) => r.indexOf("PATCH") === 0).length, 0);
});
