"use strict";

// Caida de la replica de Drive (Apps Script) durante un guardado de guia.
//
// Diagnostico del 2026-09-22, medido contra el Web App real de produccion
// (apps-script/respaldo_firestore.gs):
//   - 3 peticiones simultaneas -> 1 de 3 respondio HTTP 404 tras 34 s
//   - 6 simultaneas            -> 2 de 6 respondieron 404 (13-16 s)
//   - 10 simultaneas           -> 3 de 10 respondieron 404, exitos de 10-24 s
//   - el MISMO documento leido de Firestore: 0,8 s, 100% de exito
// Un salon entero abriendo guias supera ese umbral, asi que la caida parcial
// de la replica es el caso NORMAL en clase, no una rareza.
//
// El defecto: drive_db.js devolvia null tanto para "el documento no existe"
// como para "la replica no respondio". Con useDriveAsPrimary activo, esa
// ambiguedad llegaba hasta cloudSaveGuideDataImpl, que tomaba el null como
// "no hay nada remoto que fusionar" y escribia el estado LOCAL encima del
// documento de Firestore -- borrando lo que hubiera guardado otro dispositivo.
//
// Estas pruebas fallan con el codigo anterior al arreglo.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// Replica de Drive que puede estar CAIDA (transporte) o simplemente no tener
// el documento. Cuenta las llamadas para poder comprobar que el failover a
// Firestore solo ocurre cuando de verdad hace falta.
function makeReplica(mode) {
  const calls = { getDetailed: 0, get: 0 };
  return {
    calls,
    isEnabled: () => true,
    getDetailed: async () => {
      calls.getDetailed += 1;
      return mode === "down"
        ? { status: "unavailable", data: null }
        : { status: "missing", data: null };
    },
    get: async () => { calls.get += 1; return null; },
    set: async () => true,
    updateField: async () => true,
    deleteDoc: async () => true,
    list: async () => [],
  };
}

function makeFirestore() {
  const store = new Map();
  let n = 0;
  const calls = { get: 0, patch: 0 };
  async function fetchImpl(url, options) {
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]).split("?")[0];
    if (method === "GET") {
      calls.get += 1;
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      const entry = store.get(key);
      return { ok: true, status: 200, json: async () => ({ name: key, fields: entry.fields, updateTime: entry.updateTime }) };
    }
    if (method === "PATCH") {
      calls.patch += 1;
      // La precondicion optimista nativa de Firestore: si el documento cambio
      // desde que se leyo, el PATCH se rechaza con FAILED_PRECONDITION. Sin
      // reproducirla aqui, el fake aceptaria a ciegas cualquier escritura y la
      // prueba de concurrencia no probaria nada.
      const preMatch = url.match(/currentDocument\.updateTime=([^&]+)/);
      const expected = preMatch ? decodeURIComponent(preMatch[1]) : null;
      if (expected) {
        const current = store.get(key);
        if ((current ? current.updateTime : null) !== expected) {
          return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "FAILED_PRECONDITION", message: "el documento cambio desde la lectura" } }) };
        }
      }
      const body = JSON.parse(options.body);
      n += 1;
      const updateTime = "2026-09-22T00:00:00." + String(n).padStart(6, "0") + "Z";
      store.set(key, { fields: body.fields, updateTime });
      return { ok: true, status: 200, json: async () => ({ name: key, fields: body.fields, updateTime }) };
    }
    throw new Error("metodo inesperado: " + method);
  }
  return { fetchImpl, store, calls };
}

function loadFirebaseDb(fetchImpl, driveDb, uid) {
  const localStorage = makeLocalStorage();
  const windowObj = {
    // useDriveAsPrimary: el ruteo real de produccion.
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key", useDriveAsPrimary: true },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    driveDb,
    portalFirebaseAuth: {
      currentUid: () => uid,
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: { getCurrentSession: () => ({ role: "student", user: { usernameKey: "ana" } }) },
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8"), sandbox);
  return windowObj._firebaseDb;
}

const FILE = "santa-barbara-10a-guia-02-redes-rap01.html";
const SCOPE = "student:ana";
const UID = "uid-ana-1234";

function fileKey(fileName) {
  return String(fileName).replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
}
function uidDocId(fileName) {
  return "__guide_data__:uid:" + UID + ":" + fileKey(fileName);
}
function seed(store, docId, snapshot) {
  store.set("sena_portal_progress/" + docId, {
    fields: {
      _kind: { stringValue: "guide-data" },
      scopeKey: { stringValue: SCOPE },
      fileName: { stringValue: FILE },
      updatedAt: { stringValue: snapshot.updatedAt },
      snapshotJson: { stringValue: JSON.stringify(snapshot) },
    },
    updateTime: "2026-09-20T00:00:00.000000Z",
  });
}
function readSnapshot(store, docId) {
  const entry = store.get("sena_portal_progress/" + docId);
  if (!entry) return null;
  return JSON.parse(entry.fields.snapshotJson.stringValue);
}

test("la replica caida NO borra en Firestore las respuestas de otro dispositivo", async () => {
  const fsFake = makeFirestore();
  const replica = makeReplica("down");
  const db = loadFirebaseDb(fsFake.fetchImpl, replica, UID);

  // Otro dispositivo ya guardo dos respuestas.
  seed(fsFake.store, uidDocId(FILE), {
    updatedAt: "2026-09-22T10:00:00.000Z",
    state: { p1: "respuesta del otro equipo", p2: "segunda respuesta" },
  });

  // Este dispositivo guarda solo p3 mientras la replica de Drive no responde.
  const saved = await db.cloudSaveGuideData(SCOPE, FILE, {
    updatedAt: "2026-09-22T10:05:00.000Z",
    state: { p3: "respuesta de este equipo" },
  });

  assert.equal(saved, true, "el guardado debe completarse");
  const remote = readSnapshot(fsFake.store, uidDocId(FILE));
  assert.equal(remote.state.p3, "respuesta de este equipo", "debe quedar lo que guardo este equipo");
  assert.equal(remote.state.p1, "respuesta del otro equipo", "no puede perderse p1 del otro dispositivo");
  assert.equal(remote.state.p2, "segunda respuesta", "no puede perderse p2 del otro dispositivo");
});

test("con la replica caida, la lectura cae a Firestore en vez de devolver vacio", async () => {
  const fsFake = makeFirestore();
  const replica = makeReplica("down");
  const db = loadFirebaseDb(fsFake.fetchImpl, replica, UID);

  seed(fsFake.store, uidDocId(FILE), {
    updatedAt: "2026-09-22T10:00:00.000Z",
    state: { p1: "dato real en la nube" },
  });

  const doc = await db.cloudGetGuideData(SCOPE, FILE);
  assert.ok(doc, "una replica caida no puede reportarse como 'no hay datos'");
  assert.equal(doc.state.p1, "dato real en la nube");
});

test("si la replica SI responde y el documento no existe, no se consulta Firestore (cuota intacta)", async () => {
  const fsFake = makeFirestore();
  const replica = makeReplica("missing");
  const db = loadFirebaseDb(fsFake.fetchImpl, replica, UID);

  const doc = await db.cloudGetGuideData(SCOPE, FILE);
  assert.equal(doc, null, "la replica respondio: el documento realmente no existe");
  assert.ok(replica.calls.getDetailed > 0, "se consulto la replica");
  assert.equal(fsFake.calls.get, 0, "no debe gastarse una lectura de Firestore cuando la replica SI respondio");
});

test("el guardado conserva la precondicion optimista (_updateTime) al leer de Firestore", async () => {
  const fsFake = makeFirestore();
  const replica = makeReplica("missing");
  const db = loadFirebaseDb(fsFake.fetchImpl, replica, UID);

  seed(fsFake.store, uidDocId(FILE), {
    updatedAt: "2026-09-22T10:00:00.000Z",
    state: { p1: "previo" },
  });

  let sawPrecondition = false;
  const originalFetch = fsFake.fetchImpl;
  const spyFetch = async (url, options) => {
    if ((options && options.method) === "PATCH" && /currentDocument\.updateTime=/.test(url)) {
      sawPrecondition = true;
    }
    return originalFetch(url, options);
  };
  const db2 = loadFirebaseDb(spyFetch, replica, UID);
  void db;

  await db2.cloudSaveGuideData(SCOPE, FILE, {
    updatedAt: "2026-09-22T10:05:00.000Z",
    state: { p2: "nuevo" },
  });

  assert.ok(
    sawPrecondition,
    "leyendo la base de fusion de Firestore el guardado debe mandar currentDocument.updateTime; " +
      "leyendola de la replica ese campo nunca existe y la proteccion contra dos dispositivos queda apagada"
  );
});

test("drive_db: un 404 del Apps Script es 'unavailable', no 'missing'", async () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "drive_db.js"), "utf8");
  const responses = [];
  const windowObj = {
    PROJECT_INTEGRATIONS: { respaldoFirestoreUrl: "https://script.google.com/macros/s/TEST/exec" },
    portalFirebaseAuth: { getIdToken: async () => "token-test" },
  };
  const sandbox = {
    window: windowObj,
    setTimeout,
    clearTimeout,
    fetch: async () => responses.shift(),
    console: { warn() {}, error() {}, log() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const driveDb = windowObj.driveDb;

  // Nota: los objetos vienen del realm de vm.createContext, asi que se comparan
  // campo a campo (deepEqual/deepStrictEqual fallan por prototipo distinto).
  responses.push({ ok: false, status: 404, json: async () => ({}) });
  let r = await driveDb.getDetailed("sena_portal_progress", "doc-x");
  assert.equal(
    r.status,
    "unavailable",
    "un 404 del Web App significa que la replica no respondio, no que el documento no exista"
  );
  assert.equal(r.data, null);

  responses.push({ ok: true, status: 200, json: async () => ({ ok: true, found: false }) });
  r = await driveDb.getDetailed("sena_portal_progress", "doc-x");
  assert.equal(r.status, "missing", "la replica respondio y no tiene el documento");
  assert.equal(r.data, null);

  responses.push({ ok: true, status: 200, json: async () => ({ ok: true, found: true, data: { a: 1 } }) });
  r = await driveDb.getDetailed("sena_portal_progress", "doc-x");
  assert.equal(r.status, "found");
  assert.equal(r.data.a, 1);

  // Timeout / red caida (fetch lanza) tambien es "unavailable".
  const originalFetch = sandbox.fetch;
  sandbox.fetch = async () => { throw new Error("network unreachable (simulado)"); };
  r = await driveDb.getDetailed("sena_portal_progress", "doc-x");
  assert.equal(r.status, "unavailable", "un fallo de red no puede leerse como documento inexistente");
  sandbox.fetch = originalFetch;
});

test("drive_db.get conserva su contrato anterior (dato o null)", async () => {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "drive_db.js"), "utf8");
  const responses = [];
  const windowObj = {
    PROJECT_INTEGRATIONS: { respaldoFirestoreUrl: "https://script.google.com/macros/s/TEST/exec" },
    portalFirebaseAuth: { getIdToken: async () => "token-test" },
  };
  const sandbox = {
    window: windowObj,
    setTimeout,
    clearTimeout,
    fetch: async () => responses.shift(),
    console: { warn() {}, error() {}, log() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const driveDb = windowObj.driveDb;

  responses.push({ ok: true, status: 200, json: async () => ({ ok: true, found: true, data: { a: 1 } }) });
  assert.equal((await driveDb.get("c", "d")).a, 1);

  responses.push({ ok: false, status: 404, json: async () => ({}) });
  assert.equal(await driveDb.get("c", "d"), null);
});

// ── Prueba critica pedida para el cierre (22-sep-2026) ────────────────────────
// Escenario COMPLETO en un solo test, tal como se pidio verificarlo antes de
// publicar: A) Firestore ya tiene p1 escrito por otro equipo; B) la replica de
// Drive falla/timeout; C) este equipo guarda desde su estado local; D) se
// comprueba que p1 sigue existiendo (no queda undefined), que la fusion es
// correcta, que _updateTime viaja en la escritura y que la proteccion optimista
// de concurrencia sigue activa (un cambio ajeno entre la lectura y la escritura
// es rechazado, releido y reintentado sin perder nada).
test("CRITICA: replica caida + p1 de otro equipo -> p1 sobrevive, _updateTime viaja y la concurrencia optimista sigue activa", async () => {
  const fsFake = makeFirestore();
  const replica = makeReplica("down");

  const patches = [];
  let intruso = null; // escritura de un tercer equipo, inyectada entre lectura y escritura
  const spyFetch = async (url, options) => {
    const method = (options && options.method) || "GET";
    if (method === "PATCH") {
      patches.push({
        conPrecondicion: /currentDocument\.updateTime=/.test(url),
        updateTime: (url.match(/currentDocument\.updateTime=([^&]+)/) || [])[1] || null,
      });
      if (intruso) { const f = intruso; intruso = null; await f(); }
    }
    return fsFake.fetchImpl(url, options);
  };

  const db = loadFirebaseDb(spyFetch, replica, UID);

  // A) otro equipo ya guardo p1 (y p2) en Firestore.
  seed(fsFake.store, uidDocId(FILE), {
    updatedAt: "2026-09-22T10:00:00.000Z",
    state: { p1: "respuesta del otro equipo", p2: "segunda del otro equipo" },
  });

  // Un TERCER equipo escribe justo entre la lectura y la primera escritura:
  // asi se comprueba que la precondicion de verdad detecta el conflicto.
  intruso = async () => {
    const entry = fsFake.store.get("sena_portal_progress/" + uidDocId(FILE));
    const snap = JSON.parse(entry.fields.snapshotJson.stringValue);
    snap.state.p4 = "respuesta de un tercer equipo";
    snap.updatedAt = "2026-09-22T10:02:00.000Z";
    entry.fields.snapshotJson = { stringValue: JSON.stringify(snap) };
    entry.fields.updatedAt = { stringValue: snap.updatedAt };
    entry.updateTime = "2026-09-22T00:00:00.999999Z"; // cambia -> rompe la precondicion
  };

  // B + C) la replica no responde y este equipo guarda solo p3.
  const saved = await db.cloudSaveGuideData(SCOPE, FILE, {
    updatedAt: "2026-09-22T10:05:00.000Z",
    state: { p3: "respuesta de este equipo" },
  });

  // D) comprobaciones
  assert.equal(saved, true, "el guardado debe completarse pese a la replica caida");

  const remote = readSnapshot(fsFake.store, uidDocId(FILE));
  assert.notEqual(remote.state.p1, undefined, "p1 NO puede quedar undefined");
  assert.equal(remote.state.p1, "respuesta del otro equipo", "p1 del otro equipo debe conservarse intacto");
  assert.equal(remote.state.p2, "segunda del otro equipo", "p2 del otro equipo debe conservarse intacto");
  assert.equal(remote.state.p3, "respuesta de este equipo", "lo guardado por este equipo debe quedar");
  assert.equal(remote.state.p4, "respuesta de un tercer equipo", "lo escrito por el tercer equipo durante la carrera no puede perderse");

  assert.ok(patches.length >= 2, "la precondicion debe haber rechazado el primer intento y forzado un reintento");
  assert.ok(
    patches.every((p) => p.conPrecondicion),
    "TODA escritura debe llevar currentDocument.updateTime: leyendo la base de fusion de la replica ese campo no existe y la proteccion queda apagada"
  );
  assert.ok(patches[0].updateTime, "_updateTime debe viajar en la primera escritura");
  assert.notEqual(
    patches[1].updateTime,
    patches[0].updateTime,
    "el reintento debe usar el _updateTime RELEIDO, no el viejo"
  );
});
