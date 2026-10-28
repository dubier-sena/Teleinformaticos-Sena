"use strict";

// auth.fetchStudentsWithProgress (js/firebase_db.js), correccion 2026-10-22.
// Antes: el respaldo de progreso desde los DATOS de guia pedia por nombre
// (batchGet) cada combinacion aprendiz x guia con el id CODIFICADO
// (":" -> "%3A"): Firestore las reportaba todas como inexistentes (cada una
// contaba como lectura) y el respaldo nunca encontraba nada; ademas solo
// miraba el documento legado, no el nuevo por UID.
// Ahora: batchGet con nombres literales (documento de progreso por aprendiz) y
// un LISTADO de los documentos __guide_data__ que existen, combinados como
// readGuideStateDoc. Las claves de control (candados, entregas, banderas del
// admin) no cuentan como avance.
//
// Firestore se simula a nivel de fetch (GET, :batchGet, :runQuery): corre el
// codigo real de firebase_db.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const PREFIX = "projects/test-project/databases/(default)/documents/";

function toFields(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    out[k] = typeof v === "number" ? { integerValue: String(v) } : typeof v === "object" ? { mapValue: { fields: toFields(v) } } : { stringValue: String(v) };
  });
  return out;
}
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// store: Map("coleccion/docId" -> objeto). fail(kind) -> Response | throw | null
function makeFirestore(store, fail) {
  const calls = { list: 0, batch: 0, batchNames: [], runQuery: 0, runQueryDocs: 0, get: 0 };
  async function fetchImpl(url, options) {
    const kind = url.includes(":batchGet") ? "batch" : url.includes(":runQuery") ? "runQuery" : (options && options.method) || "GET";
    if (fail) { const forced = await fail(kind); if (forced) return forced; }
    if (kind === "batch") {
      calls.batch += 1;
      const body = JSON.parse(options.body);
      calls.batchNames.push(...body.documents);
      return json(body.documents.map((name) => {
        const key = name.slice(PREFIX.length); // literal: "%3A" NO se decodifica (como Firestore real)
        return store.has(key) ? { found: { name, fields: toFields(store.get(key)), updateTime: "2026-10-01T00:00:00Z" } } : { missing: name };
      }));
    }
    if (kind === "runQuery") {
      calls.runQuery += 1;
      const q = JSON.parse(options.body).structuredQuery;
      const coll = q.from[0].collectionId;
      const filters = q.where.compositeFilter ? q.where.compositeFilter.filters : [q.where];
      let keys = [...store.keys()].filter((k) => k.startsWith(coll + "/")).sort();
      filters.forEach((f) => {
        const ff = f.fieldFilter;
        if (ff.field.fieldPath !== "__name__") return;
        const v = ff.value.referenceValue.slice(PREFIX.length);
        keys = keys.filter((k) => (ff.op === "GREATER_THAN_OR_EQUAL" ? k >= v : k < v));
      });
      if (q.startAt) { const after = q.startAt.values[0].referenceValue.slice(PREFIX.length); keys = keys.filter((k) => k > after); }
      keys = keys.slice(0, q.limit || keys.length);
      calls.runQueryDocs += keys.length;
      return json(keys.length ? keys.map((k) => ({ document: { name: PREFIX + k, fields: toFields(store.get(k)), updateTime: "2026-10-01T00:00:00Z" } })) : [{ readTime: "x" }]);
    }
    const rel = url.split("/documents/")[1].split("?")[0];
    const slash = rel.indexOf("/");
    if (slash === -1) {
      calls.list += 1;
      const coll = rel;
      return json({ documents: [...store.keys()].filter((k) => k.startsWith(coll + "/")).map((k) => ({ name: PREFIX + k, fields: toFields(store.get(k)) })) });
    }
    calls.get += 1;
    const key = rel.slice(0, slash) + "/" + decodeURIComponent(rel.slice(slash + 1));
    return store.has(key) ? json({ name: PREFIX + key, fields: toFields(store.get(key)) }) : json({}, 404);
  }
  return { fetchImpl, calls };
}

const GUIDES = { F1: ["g1.html", "g2.html", "g3.html"], F2: ["g1.html", "g4.html"] };
const CONFIG = { "g1.html": { total: 10 }, "g2.html": { total: 10 }, "g3.html": { total: 4 }, "g4.html": { total: 5 } };

function load(fetchImpl) {
  const map = new Map();
  const localStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage, setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {}, dispatchEvent: () => {},
    portalFirebaseAuth: { currentUid: () => "uid-admin", getIdToken: async () => "t", waitForAuthHydration: async () => true, buildEmail: (k) => k + "@x" },
    portalAuth: {
      getGuidesForFicha: (f) => (GUIDES[f] || []).slice(),
      getGuideTitle: (f) => f,
      GUIDE_PROGRESS_CONFIG: CONFIG,
      getUsers: () => [],
      fetchStudentsWithProgress: async () => "LOCAL",
      getCurrentSession: () => ({ role: "admin" }),
    },
  };
  const sandbox = { window: windowObj, localStorage, navigator: { onLine: true }, fetch: fetchImpl, setTimeout: () => 0, clearTimeout: () => {}, console: { info() {}, warn() {}, error() {}, log() {} }, CustomEvent: function () {} };
  windowObj.fetch = fetchImpl;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "firebase_db.js"), "utf8"), sandbox);
  return { auth: windowObj.portalAuth, db: windowObj._firebaseDb };
}

const snap = (state, updatedAt = "2026-10-10T00:00:00Z") => ({ snapshotJson: JSON.stringify({ state, updatedAt }), updatedAt, scopeKey: "x" });

function seed() {
  return new Map([
    ["sena_portal_users/ana.perez", { usernameKey: "ana.perez", fullName: "Ana", ficha: "F1", uid: "u-ana" }],
    ["sena_portal_users/luis", { usernameKey: "luis", fullName: "Luis", ficha: "F1", uid: "u-luis" }],
    ["sena_portal_users/maria.o'neil", { usernameKey: "maria.o'neil", fullName: "María", ficha: "F2", uid: "u-maria" }],
    // Ana: progreso propio en g1 (5/10); g2 solo en datos de guia (doc por UID)
    ["sena_portal_progress/ana.perez", { g1_html: { completed: 5, total: 10, updatedAt: "2026-10-01" } }],
    ["sena_portal_progress/__guide_data__:uid:u-ana:g2_html", snap({ q1: "resp", q2: "resp", "act1-locked": true, "act1-delivery": { submittedAt: "2026-10-09" }, reabierta: true })],
    // Luis: solo un documento legado en guide_state (respaldo historico)
    ["sena_portal_guide_state/__guide_data__:student:luis:g2_html", snap({ q1: "resp" })],
    // María (id con caracteres especiales -> clave saneada en el id legado)
    ["sena_portal_progress/__guide_data__:student:maria_o_neil:g4_html", snap({ a: "1", b: "2", c: "3" })],
  ]);
}

const guide = (user, file) => user.progress.guides.find((g) => g.fileName === file);

test("recupera los documentos reales (legado, UID, guide_state, id especial) y calcula el % con los datos reales", async () => {
  const fsm = makeFirestore(seed());
  const { auth, db } = load(fsm.fetchImpl);
  const users = await auth.fetchStudentsWithProgress();
  const by = Object.fromEntries(users.map((u) => [u.usernameKey, u]));
  assert.deepStrictEqual([guide(by["ana.perez"], "g1.html").completed, guide(by["ana.perez"], "g1.html").total], [5, 10], "progreso propio intacto");
  assert.deepStrictEqual([guide(by["ana.perez"], "g2.html").completed, guide(by["ana.perez"], "g2.html").total], [2, 10], "2 respuestas; candado, entrega y bandera NO cuentan");
  assert.deepStrictEqual([guide(by["ana.perez"], "g3.html").completed, guide(by["ana.perez"], "g3.html").total], [0, 4], "sin datos: 0, nada inventado");
  assert.deepStrictEqual([guide(by.luis, "g2.html").completed], [1], "documento legado de guide_state");
  assert.deepStrictEqual([guide(by["maria.o'neil"], "g4.html").completed], [3], "id con caracteres especiales");
  assert.strictEqual(by["ana.perez"].progress.percent, Math.round((5 + 2 + 0) / 24 * 100));
  assert.strictEqual(db.getLastStudentsProgressLoad().status, "ok");
});

test("no mezcla aprendices ni fichas", async () => {
  const { auth } = load(makeFirestore(seed()).fetchImpl);
  const users = await auth.fetchStudentsWithProgress();
  const by = Object.fromEntries(users.map((u) => [u.usernameKey, u]));
  assert.strictEqual(guide(by.luis, "g1.html").completed, 0, "Luis no recibe el progreso de Ana");
  assert.deepStrictEqual(by["maria.o'neil"].progress.guides.map((g) => g.fileName), ["g1.html", "g4.html"], "solo las guias de su ficha");
});

test("consultas: batchGet con nombres literales y listado de datos de guia; sin pedir combinaciones aprendiz x guia", async () => {
  const fsm = makeFirestore(seed());
  const { auth } = load(fsm.fetchImpl);
  await auth.fetchStudentsWithProgress();
  assert.ok(fsm.calls.batchNames.every((n) => !/%3A|%27/i.test(n)), "nombres sin codificar");
  assert.ok(fsm.calls.batchNames.every((n) => !n.includes("__guide_data__")), "ya no se piden ids __guide_data__ por nombre");
  assert.strictEqual(fsm.calls.batch, 1, "un batchGet: documentos de progreso por aprendiz");
  assert.strictEqual(fsm.calls.runQuery, 2, "un listado por coleccion (progress y guide_state)");
  assert.strictEqual(fsm.calls.runQueryDocs, 3, "solo se leen los documentos __guide_data__ que existen");
});

test("sin guias pendientes de respaldo no se lista nada", async () => {
  const store = new Map([
    ["sena_portal_users/luis", { usernameKey: "luis", fullName: "Luis", ficha: "F2", uid: "u-luis" }],
    ["sena_portal_progress/luis", { g1_html: { completed: 1, total: 10 }, g4_html: { completed: 2, total: 5 } }],
  ]);
  const fsm = makeFirestore(store);
  const { auth } = load(fsm.fetchImpl);
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(fsm.calls.runQuery, 0);
});

for (const [label, failure, expected] of [
  ["sin red", () => { throw new TypeError("Failed to fetch"); }, "offline"],
  ["permisos 403", () => json({}, 403), "denied"],
  ["cuota 429", () => json({}, 429), "quota"],
]) {
  test(`fallo del listado (${label}): se informa "${expected}" y se conserva el progreso propio`, async () => {
    const fsm = makeFirestore(seed(), async (kind) => (kind === "runQuery" ? failure() : null));
    const { auth, db } = load(fsm.fetchImpl);
    const users = await auth.fetchStudentsWithProgress();
    const ana = users.find((u) => u.usernameKey === "ana.perez");
    assert.strictEqual(db.getLastStudentsProgressLoad().status, expected);
    assert.strictEqual(guide(ana, "g1.html").completed, 5, "el progreso propio no se pierde");
    assert.strictEqual(guide(ana, "g2.html").completed, 0, "lo que no se pudo leer no se inventa");
  });
}

// ── cloudListGuideDataSince ("Entregas recientes"): consulta por rango ──────
// Emulador de runQuery con updatedAt >= X, orden descendente y cursor.
function makeRangeFirestore(store, failOnPage) {
  const calls = { runQuery: 0, docs: 0, bodies: [] };
  async function fetchImpl(url, options) {
    if (!url.includes(":runQuery")) return json({}, 404);
    calls.runQuery += 1;
    if (failOnPage) { const forced = failOnPage(calls.runQuery); if (forced) return forced(); }
    const q = JSON.parse(options.body).structuredQuery;
    calls.bodies.push(q);
    const coll = q.from[0].collectionId;
    const since = q.where.fieldFilter.value.stringValue;
    let rows = [...store.entries()].filter(([k, v]) => k.startsWith(coll + "/") && typeof v.updatedAt === "string" && v.updatedAt >= since)
      .sort((a, b) => (b[1].updatedAt.localeCompare(a[1].updatedAt) || b[0].localeCompare(a[0])));
    if (q.startAt) {
      const [u, n] = q.startAt.values;
      const name = n.referenceValue.slice(PREFIX.length);
      rows = rows.filter(([k, v]) => v.updatedAt < u.stringValue || (v.updatedAt === u.stringValue && k < name));
    }
    rows = rows.slice(0, q.limit);
    calls.docs += rows.length;
    return json(rows.length ? rows.map(([k, v]) => ({ document: { name: PREFIX + k, fields: toFields(v) } })) : [{ readTime: "x" }]);
  }
  return { fetchImpl, calls };
}

test("entregas recientes: solo documentos __guide_data__ actualizados en el periodo, paginados por cursor", async () => {
  const store = new Map();
  for (let i = 0; i < 650; i++) {
    const day = String(1 + (i % 28)).padStart(2, "0");
    store.set(`sena_portal_progress/__guide_data__:student:a${i}:g1_html`, { updatedAt: `2026-10-${day}T10:00:00.000Z`, snapshotJson: "{}" });
  }
  store.set("sena_portal_progress/a1", { updatedAt: "2026-10-28T00:00:00.000Z" }); // no es __guide_data__
  store.set("sena_portal_guide_state/__guide_data__:student:z:g2_html", { updatedAt: "2026-10-27T00:00:00.000Z", snapshotJson: "{}" });
  const fsm = makeRangeFirestore(store);
  const { db } = load(fsm.fetchImpl);
  const since = "2026-10-15T00:00:00.000Z";
  const r = await db.cloudListGuideDataSince(since);
  const expected = [...store.entries()].filter(([k, v]) => k.includes("__guide_data__") && v.updatedAt >= since).length;
  assert.strictEqual(r.status, "ok");
  assert.strictEqual(r.docs.length, expected);
  assert.ok(r.docs.every((d) => d._docId.startsWith("__guide_data__:")));
  assert.strictEqual(new Set(r.docs.map((d) => d._docId)).size, r.docs.length, "sin duplicados entre paginas");
  assert.ok(fsm.calls.runQuery >= 3, "paginado (300 por pagina)");
  assert.ok(fsm.calls.docs <= expected + 1, "solo se leen los del periodo");
});

for (const [label, fail, expected] of [
  ["sin red", () => { throw new TypeError("Failed to fetch"); }, "offline"],
  ["403", () => json({}, 403), "denied"],
  ["429", () => json({}, 429), "quota"],
]) {
  test(`entregas recientes: fallo ${label} -> "${expected}"; tras recuperar parte -> "incomplete"`, async () => {
    const store = new Map();
    for (let i = 0; i < 400; i++) store.set(`sena_portal_progress/__guide_data__:student:a${i}:g1_html`, { updatedAt: "2026-10-20T00:00:00.000Z", snapshotJson: "{}" });
    const first = load(makeRangeFirestore(store, () => fail).fetchImpl);
    const r1 = await first.db.cloudListGuideDataSince("2026-10-01T00:00:00.000Z");
    assert.strictEqual(r1.status, expected);
    const second = load(makeRangeFirestore(store, (n) => (n === 2 ? fail : null)).fetchImpl);
    const r2 = await second.db.cloudListGuideDataSince("2026-10-01T00:00:00.000Z");
    assert.strictEqual(r2.status, "incomplete");
    assert.strictEqual(r2.docs.length, 300, "lo recuperado se conserva");
  });
}

test("el listado de datos de guia se reutiliza en memoria; 'Actualizar datos' y guardar datos de guia lo invalidan", async () => {
  const fsm = makeFirestore(seed());
  const { auth, db } = load(fsm.fetchImpl);
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(fsm.calls.runQuery, 2);
  await auth.fetchStudentsWithProgress(); // p. ej. tras editar un aprendiz
  assert.strictEqual(fsm.calls.runQuery, 2, "no vuelve a listar los documentos de guia");
  db.forceNextStudentsProgressListing(); // boton "Actualizar datos"
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(fsm.calls.runQuery, 4);
  db.cloudSaveGuideData("student:ana.perez", "g2.html", { state: { q3: "x" }, updatedAt: "2026-10-22T00:00:00Z" }).catch(() => {});
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(fsm.calls.runQuery, 6, "un guardado de guia invalida el listado");
});

test("un listado fallido NO se reutiliza (la siguiente carga reintenta, sin bucle)", async () => {
  let failing = true;
  const fsm = makeFirestore(seed(), async (kind) => (kind === "runQuery" && failing ? json({}, 503) : null));
  const { auth, db } = load(fsm.fetchImpl);
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(db.getLastStudentsProgressLoad().status, "unavailable");
  const afterFail = fsm.calls.runQuery;
  failing = false;
  await auth.fetchStudentsWithProgress();
  assert.strictEqual(db.getLastStudentsProgressLoad().status, "ok");
  assert.ok(fsm.calls.runQuery > afterFail);
});

test("estados para indicadores/Reportes desde el ULTIMO listado: 0 lecturas, legado + UID, sin mezclar aprendices", async () => {
  const fsm = makeFirestore(seed());
  const { auth, db } = load(fsm.fetchImpl);
  assert.strictEqual(db.getGuideStatesFromLastListing([], () => []), null, "sin listado en memoria: null");
  await auth.fetchStudentsWithProgress();
  const before = { batch: fsm.calls.batch, runQuery: fsm.calls.runQuery, get: fsm.calls.get };
  const users = [{ usernameKey: "ana.perez", ficha: "F1" }, { usernameKey: "luis", ficha: "F1" }, { usernameKey: "maria.o'neil", ficha: "F2" }];
  const out = db.getGuideStatesFromLastListing(users, (f) => GUIDES[f] || []);
  assert.deepStrictEqual({ batch: fsm.calls.batch, runQuery: fsm.calls.runQuery, get: fsm.calls.get }, before, "no hace ninguna consulta");
  const by = Object.fromEntries(out.entries.map((e) => [e.usernameKey + "|" + e.fileName, e]));
  assert.ok(by["ana.perez|g2.html"].state["act1-delivery"], "doc por UID (con su entrega)");
  assert.ok(by["luis|g2.html"].state.q1, "doc legado de guide_state");
  assert.ok(by["maria.o'neil|g4.html"], "id con caracteres especiales");
  assert.ok(!by["luis|g1.html"] && !by["ana.perez|g3.html"], "sin datos: no se inventa");
  assert.strictEqual(out.entries.length, 3);
});
