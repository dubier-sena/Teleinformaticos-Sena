"use strict";

// Pruebas de la capa de datos que alimenta el panel admin (js/firebase_db.js):
//   1. fsList PAGINA con nextPageToken (antes cortaba en la primera pagina y
//      el panel "perdia" aprendices silenciosamente).
//   2. fsBatchGet trocea en lotes de 100 (antes una peticion gigante que
//      fallara se convertia en [] silencioso = secciones vacias).
//   3. Una escritura que cae al fallback de Drive SIEMPRE registra su
//      promocion a Firestore (antes en force-drive no se registraba y el
//      admin quedaba ciego a esos guardados de forma permanente).
//   4. precreateVersionedAuthAccount llama a identitytoolkit accounts:signUp
//      con el email versionado y la password nueva (cierra la ventana de
//      suplantacion del email versionado y habilita el login inmediato).
// Carga js/firebase_db.js en un sandbox vm con window/fetch/localStorage falsos.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _dump: () => Object.fromEntries(map),
  };
}

// Crea un sandbox nuevo con firebase_db.js cargado.
// fetchImpl: async (url, options) => Response-like
function loadFirebaseDb({ fetchImpl, config, driveDb } = {}) {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: Object.assign(
      { enabled: true, projectId: "test-project", apiKey: "test-key" },
      config || {}
    ),
    localStorage,
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => "uid-test",
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key, v) => (Number(v) > 1 ? key + ".v" + v + "@sena-portal.local" : key + "@sena-portal.local"),
    },
    portalAuth: {},
    driveDb: driveDb || undefined,
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl || (async () => { throw new Error("fetch no esperado"); }),
    setTimeout: () => 0,
    clearTimeout: () => {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { db: windowObj._firebaseDb, window: windowObj, localStorage };
}

function fsDoc(collection, docId, fields) {
  const fsFields = {};
  Object.keys(fields || {}).forEach((k) => {
    const v = fields[k];
    fsFields[k] = typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) };
  });
  return {
    name: "projects/test-project/databases/(default)/documents/" + collection + "/" + docId,
    fields: fsFields,
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test("fsList sigue nextPageToken y une todas las paginas", async () => {
  const requests = [];
  const { db } = loadFirebaseDb({
    fetchImpl: async (url) => {
      requests.push(url);
      if (!url.includes("pageToken")) {
        return jsonResponse({
          documents: [fsDoc("sena_portal_users", "ana", { usernameKey: "ana" }), fsDoc("sena_portal_users", "luis", { usernameKey: "luis" })],
          nextPageToken: "tok-2",
        });
      }
      return jsonResponse({
        documents: [fsDoc("sena_portal_users", "sofia", { usernameKey: "sofia" })],
      });
    },
  });
  const docs = await db.fsList("sena_portal_users");
  assert.strictEqual(docs.length, 3, "debe unir las dos paginas");
  // join: el array nace en el realm del vm y deepStrictEqual compara prototipos
  assert.strictEqual(docs.map((d) => d._docId).sort().join(","), "ana,luis,sofia");
  assert.strictEqual(requests.length, 2);
  assert.ok(requests[1].includes("pageToken=tok-2"), "la segunda peticion debe llevar el token");
});

test("fsList devuelve lo acumulado si una pagina intermedia falla", async () => {
  let call = 0;
  const { db } = loadFirebaseDb({
    fetchImpl: async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse({ documents: [fsDoc("sena_portal_users", "ana", {})], nextPageToken: "t2" });
      }
      return jsonResponse({}, 500);
    },
  });
  const docs = await db.fsList("sena_portal_users");
  assert.strictEqual(docs.length, 1, "mejor pagina 1 que lista vacia");
});

test("fsBatchGet trocea en lotes de maximo 100 documentos", async () => {
  const batchSizes = [];
  const { db } = loadFirebaseDb({
    fetchImpl: async (url, options) => {
      assert.ok(url.includes(":batchGet"));
      const body = JSON.parse(options.body);
      batchSizes.push(body.documents.length);
      return {
        ok: true,
        status: 200,
        json: async () => body.documents.map((docPath) => ({
          found: fsDoc("sena_portal_progress", docPath.split("/").pop(), { x: 1 }),
        })),
      };
    },
  });
  const ids = [];
  for (let i = 0; i < 250; i += 1) ids.push("doc" + i);
  const docs = await db.fsBatchGet("sena_portal_progress", ids);
  assert.strictEqual(docs.length, 250, "debe devolver todos los lotes unidos");
  assert.deepStrictEqual(batchSizes, [100, 100, 50]);
});

test("escritura que cae a Drive registra SIEMPRE la promocion a Firestore (aun en force-drive)", async () => {
  const driveSets = [];
  const { db, localStorage } = loadFirebaseDb({
    config: { useDriveAsPrimary: true },
    driveDb: {
      isEnabled: () => true,
      get: async () => null,
      set: async (collection, docId, data) => { driveSets.push({ collection, docId, data }); return true; },
      updateField: async () => true,
      deleteDoc: async () => true,
      list: async () => [],
    },
    // Firestore inaccesible: toda escritura cae al fallback de Drive.
    fetchImpl: async () => { throw new Error("red caida"); },
  });
  const saved = await db.cloudSaveGuideData("student:pepito", "grupo-10a-guia-01.html", {
    state: { campo: "respuesta" },
    updatedAt: "2026-07-17T10:00:00.000Z",
  });
  assert.strictEqual(saved, true, "el guardado debe reportar exito via Drive");
  assert.ok(driveSets.length >= 1, "Drive debe recibir el doc");
  const pending = JSON.parse(localStorage.getItem("sena_portal_pending_firestore_promote_v1") || "[]");
  assert.ok(pending.length >= 1, "la promocion a Firestore DEBE quedar registrada");
  assert.strictEqual(pending[0].collection, "sena_portal_progress");
  assert.ok(pending[0].docId.startsWith("__guide_data__:student:pepito:"), "docId compuesto del aprendiz");
});

test("precreateVersionedAuthAccount crea la cuenta versionada via identitytoolkit", async () => {
  const calls = [];
  const { db } = loadFirebaseDb({
    fetchImpl: async (url, options) => {
      calls.push({ url, body: options && options.body ? JSON.parse(options.body) : null });
      return jsonResponse({ localId: "nuevo-uid" });
    },
  });
  const ok = await db._precreateVersionedAuthAccount("pepito", 2, "claveNueva123");
  assert.strictEqual(ok, true);
  assert.strictEqual(calls.length, 1);
  assert.ok(calls[0].url.includes("identitytoolkit.googleapis.com/v1/accounts:signUp"));
  assert.strictEqual(calls[0].body.email, "pepito.v2@sena-portal.local");
  assert.strictEqual(calls[0].body.password, "claveNueva123");
});

test("precreateVersionedAuthAccount no hace nada para version 1", async () => {
  let called = false;
  const { db } = loadFirebaseDb({ fetchImpl: async () => { called = true; return jsonResponse({}); } });
  const ok = await db._precreateVersionedAuthAccount("pepito", 1, "clave");
  assert.strictEqual(ok, false);
  assert.strictEqual(called, false, "v1 no necesita cuenta nueva");
});
