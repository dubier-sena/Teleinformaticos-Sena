"use strict";

// cloudReadGuideDataDetailed (js/firebase_db.js, 2026-10-22): lectura de las
// guias de UN aprendiz que distingue "no existe" de "no se pudo consultar"
// (sin red, permisos, tiempo agotado, servicio, incompleta). Complementa a
// cloudGetGuideData, cuyo contrato (null para todo) NO cambia.
//
// Firestore se simula a nivel de fetch (GET de documento y POST :batchGet),
// asi se ejecuta el codigo real de firebase_db.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PREFIX = "projects/test-project/databases/(default)/documents/";

function makeLocalStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

function toFields(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { out[k] = { stringValue: String(v) }; });
  return out;
}

// store: Map("coleccion/docId" -> objeto plano). behavior(kind, n) puede
// devolver una Response falsa o lanzar para simular fallos.
function makeFirestore(store, behavior) {
  const calls = { get: 0, batch: 0, batchDocs: 0, bodies: [] };
  let n = 0;
  async function fetchImpl(url, options) {
    n += 1;
    const isBatch = url.includes(":batchGet");
    if (behavior) {
      const forced = await behavior(isBatch ? "batch" : "get", n, url, options);
      if (forced) return forced;
    }
    if (isBatch) {
      calls.batch += 1;
      const body = JSON.parse(options.body);
      calls.bodies.push(body);
      calls.batchDocs += body.documents.length;
      return {
        ok: true, status: 200,
        json: async () => body.documents.map((name) => {
          const key = name.slice(PREFIX.length);
          return store.has(key)
            ? { found: { name, fields: toFields(store.get(key)), updateTime: "2026-10-01T00:00:00Z" } }
            : { missing: name };
        }),
      };
    }
    calls.get += 1;
    const rel = url.split("/documents/")[1].split("?")[0];
    const slash = rel.indexOf("/");
    const key = rel.slice(0, slash) + "/" + decodeURIComponent(rel.slice(slash + 1));
    if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ name: PREFIX + key, fields: toFields(store.get(key)), updateTime: "2026-10-01T00:00:00Z" }) };
  }
  return { fetchImpl, calls };
}

function load({ fetchImpl, uid = "uid-admin", online = true, driveDb } = {}) {
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => uid,
      getIdToken: async () => (uid ? "token" : null),
      waitForAuthHydration: async () => Boolean(uid),
      buildEmail: (k) => k + "@sena-portal.local",
    },
    portalAuth: { getCurrentSession: () => ({ role: "admin" }) },
    driveDb,
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    navigator: { onLine: online },
    fetch: fetchImpl,
    setTimeout: () => 0,
    clearTimeout: () => {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = fetchImpl;
  windowObj.navigator = sandbox.navigator;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "firebase_db.js"), "utf8"), sandbox);
  return windowObj._firebaseDb;
}

const snap = (state, updatedAt) => ({ snapshotJson: JSON.stringify({ state, updatedAt }) });
const legacyId = (key, file) => `__guide_data__:student:${key}:${file.replace(/\./g, "_")}`;
const uidId = (uid, file) => `__guide_data__:uid:${uid}:${file.replace(/\./g, "_")}`;
const plain = (v) => JSON.parse(JSON.stringify(v));

test("agrupa todas las guias del aprendiz en batchGet y distingue encontrado / inexistente", async () => {
  const store = new Map([
    ["sena_portal_users/ana", { usernameKey: "ana", uid: "u-ana" }],
    ["sena_portal_progress/" + legacyId("ana", "g1.html"), snap({ "a-locked": "true" }, "2026-10-01T00:00:00Z")],
    ["sena_portal_guide_state/" + uidId("u-ana", "g2.html"), snap({ "b-locked": "true" }, "2026-10-02T00:00:00Z")],
  ]);
  const fsm = makeFirestore(store);
  const db = load({ fetchImpl: fsm.fetchImpl });
  const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html", "g2.html", "g3.html"]);
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(r.files["g1.html"].status, "found");
  assert.strictEqual(r.files["g2.html"].status, "found");
  assert.strictEqual(r.files["g3.html"].status, "missing");
  assert.strictEqual(r.files["g2.html"].data.state["b-locked"], "true");
  assert.strictEqual(fsm.calls.get, 0, "no debe usar GET por documento");
  assert.ok(fsm.calls.batch <= 3, "maximo 3 peticiones, fueron " + fsm.calls.batch);
  // Lecturas: nunca mas que el camino anterior (perfil + progress y, si falta, guide_state por dueno).
  assert.ok(fsm.calls.batchDocs <= 1 + 3 * 4, "documentos pedidos: " + fsm.calls.batchDocs);
  // Nombres SIN codificar: con ":" -> "%3A" Firestore reporta "missing" (comprobado en produccion).
  fsm.calls.bodies.forEach((b) => b.documents.forEach((d) => assert.ok(!/%3A/i.test(d), d)));
});

test("el UID del aprendiz se lee una vez por sesion (perfil en cache)", async () => {
  const store = new Map([["sena_portal_users/ana", { usernameKey: "ana", uid: "u-ana" }]]);
  const fsm = makeFirestore(store);
  const db = load({ fetchImpl: fsm.fetchImpl });
  await db.cloudReadGuideDataDetailed("student:ana", ["g1.html"], { skipDrive: true });
  const first = fsm.calls.bodies.flatMap((b) => b.documents).filter((d) => d.includes("sena_portal_users/")).length;
  fsm.calls.bodies.length = 0;
  await db.cloudReadGuideDataDetailed("student:ana", ["g1.html"], { skipDrive: true });
  const second = fsm.calls.bodies.flatMap((b) => b.documents).filter((d) => d.includes("sena_portal_users/")).length;
  assert.strictEqual(first, 1);
  assert.strictEqual(second, 0);
});

test("equivalencia: los datos combinados son los mismos que devuelve cloudGetGuideData", async () => {
  const store = new Map([
    ["sena_portal_users/ana", { usernameKey: "ana", uid: "u-ana" }],
    ["sena_portal_progress/" + legacyId("ana", "g1.html"), snap({ x: "viejo", y: "solo-legado" }, "2026-09-01T00:00:00Z")],
    ["sena_portal_progress/" + uidId("u-ana", "g1.html"), snap({ x: "nuevo", "z-locked": "true" }, "2026-10-01T00:00:00Z")],
    ["sena_portal_guide_state/" + legacyId("ana", "g2.html"), snap({ w: "gs" }, "2026-08-01T00:00:00Z")],
  ]);
  const db = load({ fetchImpl: makeFirestore(store).fetchImpl });
  const detailed = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html", "g2.html"], { skipDrive: true });
  for (const f of ["g1.html", "g2.html"]) {
    const classic = await db.cloudGetGuideData("student:ana", f, { skipDriveOn404: true });
    assert.deepStrictEqual(plain(detailed.files[f].data), plain(classic), f);
  }
});

const failures = [
  ["sin red (fetch lanza TypeError)", () => { throw new TypeError("Failed to fetch"); }, "offline"],
  ["tiempo agotado (AbortError)", () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; }, "timeout"],
  ["permisos (403)", () => ({ ok: false, status: 403, json: async () => ({}) }), "denied"],
  ["servicio (503)", () => ({ ok: false, status: 503, json: async () => ({}) }), "unavailable"],
  ["cuota agotada (429)", () => ({ ok: false, status: 429, json: async () => ({}) }), "quota"],
  ["peticion invalida (400)", () => ({ ok: false, status: 400, json: async () => ({}) }), "error"],
];
for (const [label, fail, expected] of failures) {
  test(`fallo ${label} -> estado "${expected}" (nunca "missing")`, async () => {
    const db = load({ fetchImpl: makeFirestore(new Map(), async () => fail()).fetchImpl });
    const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html", "g2.html"], { uid: "u-ana", skipDrive: true });
    assert.strictEqual(r.status, expected);
    assert.strictEqual(r.files["g1.html"].status, expected);
    assert.notStrictEqual(r.files["g2.html"].status, "missing");
  });
}

test("sin sesion de Firebase: 'denied' sin ninguna peticion", async () => {
  let calls = 0;
  const db = load({ uid: null, fetchImpl: async () => { calls += 1; throw new Error("no debe llamar"); } });
  const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html"]);
  assert.strictEqual(r.status, "denied");
  assert.strictEqual(calls, 0);
});

test("navegador sin conexion: 'offline' sin ninguna peticion", async () => {
  let calls = 0;
  const db = load({ online: false, fetchImpl: async () => { calls += 1; throw new Error("no debe llamar"); } });
  const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html"]);
  assert.strictEqual(r.status, "offline");
  assert.strictEqual(calls, 0);
});

test("consulta incompleta: una ronda falla despues de encontrar datos -> 'incomplete' con lo encontrado", async () => {
  const store = new Map([["sena_portal_progress/" + legacyId("ana", "g1.html"), snap({ "a-locked": "true" }, "2026-10-01T00:00:00Z")]]);
  const fsm = makeFirestore(store, async (kind, n) => (n >= 2 ? { ok: false, status: 503, json: async () => ({}) } : null));
  const db = load({ fetchImpl: fsm.fetchImpl });
  const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html", "g2.html"], { uid: "u-ana", skipDrive: true });
  assert.strictEqual(r.status, "incomplete");
  assert.strictEqual(r.files["g1.html"].status, "partial");
  assert.strictEqual(r.files["g1.html"].data.state["a-locked"], "true");
  assert.strictEqual(r.files["g2.html"].status, "unavailable");
});

test("replica de Drive: una consulta por guia ausente; encontrado / no respondio / omitida", async () => {
  const driveCalls = [];
  const driveDb = {
    isEnabled: () => true,
    getDetailed: async (collection, docId) => {
      driveCalls.push(collection + "/" + docId);
      if (docId.endsWith("g1_html")) return { status: "found", data: snap({ "d-locked": "true" }, "2026-10-03T00:00:00Z") };
      return { status: "unavailable", data: null };
    },
    get: async () => null,
  };
  const db = load({ fetchImpl: makeFirestore(new Map()).fetchImpl, driveDb });
  const r = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html", "g2.html"], { uid: "u-ana" });
  assert.strictEqual(driveCalls.length, 2, "una consulta a Drive por guia ausente");
  assert.ok(driveCalls.every((c) => c.startsWith("sena_portal_progress/__guide_data__:uid:u-ana:")));
  assert.strictEqual(r.files["g1.html"].status, "found");
  assert.strictEqual(r.files["g1.html"].source, "drive");
  assert.strictEqual(r.files["g2.html"].status, "unverified");
  assert.strictEqual(r.status, "incomplete");
  driveCalls.length = 0;
  const skipped = await db.cloudReadGuideDataDetailed("student:ana", ["g1.html"], { uid: "u-ana", skipDrive: true });
  assert.strictEqual(driveCalls.length, 0);
  assert.strictEqual(skipped.files["g1.html"].status, "missing");
});

test("el contrato de cloudGetGuideData no cambia: null ante un fallo de red", async () => {
  const db = load({ fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.strictEqual(await db.cloudGetGuideData("student:ana", "g1.html"), null);
});
