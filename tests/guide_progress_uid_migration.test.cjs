"use strict";

// Fase 5 (auditoria profunda, 2026-08-23): migracion de identidad de
// usernameKey saneado a UID de Firebase para los docIds compuestos de
// sena_portal_progress (__guide_data__/__guide_ui__). Antes, dos aprendices
// reales cuyo username saneaba al mismo valor (p.ej. "eimy_alvarez" y
// "eimy.alvarez") quedaban AMBOS autorizados sobre el mismo docId -- una
// colision real, no solo teorica. El UID de Firebase nunca se sanea ni
// colisiona entre cuentas reales.
//
// Cubre las 11 pruebas obligatorias pedidas por el usuario. No usa un
// emulador de Firestore (no disponible en este entorno): reproduce el
// comportamiento real de Firestore REST (GET/PATCH, updateMask de un solo
// campo, precondicion currentDocument.updateTime) con un fake in-memory,
// igual que tests/guide_cloud_sync_multi_device.test.cjs.

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

function makeFakeDriveDb() {
  const store = new Map(); // "collection/docId" -> plain data object
  return {
    isEnabled: () => true,
    get: async (collection, docId) => {
      const key = collection + "/" + docId;
      return store.has(key) ? store.get(key) : null;
    },
    set: async (collection, docId, data) => {
      store.set(collection + "/" + docId, data);
      return true;
    },
    updateField: async (collection, docId, fieldName, fieldValue) => {
      const key = collection + "/" + docId;
      const existing = Object.assign({}, store.get(key) || {});
      existing[fieldName] = fieldValue;
      store.set(key, existing);
      return true;
    },
    deleteDoc: async (collection, docId) => {
      store.delete(collection + "/" + docId);
      return true;
    },
    list: async (collection) =>
      Array.from(store.entries())
        .filter(([k]) => k.indexOf(collection + "/") === 0)
        .map(([, v]) => v),
    _store: store,
  };
}

function makeFakeFirestore(opts) {
  opts = opts || {};
  const state = { down: false };
  const store = new Map(); // "collection/docId" -> { fields, updateTime }
  let updateTimeCounter = 0;
  function nextUpdateTime() {
    updateTimeCounter += 1;
    return "2026-01-01T00:00:00." + String(updateTimeCounter).padStart(6, "0") + "Z";
  }
  async function fetchImpl(url, options) {
    // Fase 5 (cierre fallback Drive): simula "Firestore inalcanzable" (caida
    // de red real, no un 401/403) para que fsGet/fsPatch caigan a
    // driveFallbackGet/Set exactamente como en produccion, SIN disparar
    // markFirestoreRejection (que es solo para 401/403) -- asi no hay que
    // simular ni resetear el cooldown interno en el test.
    if (state.down) {
      throw new Error("network unreachable (simulado)");
    }
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]).split("?")[0];
    if (method === "GET") {
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      const entry = store.get(key);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          name: "projects/test/databases/(default)/documents/" + key,
          fields: entry.fields,
          updateTime: entry.updateTime,
        }),
      };
    }
    if (method === "PATCH") {
      const collection = match[1];
      if (opts.failPatchFor && opts.failPatchFor(collection, decodeURIComponent(match[2]).split("?")[0])) {
        return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "INVALID_ARGUMENT", message: "fallo forzado por el test" } }) };
      }
      const body = JSON.parse(options.body);
      const maskMatch = url.match(/updateMask\.fieldPaths=([^&]+)/);
      const preconditionMatch = url.match(/currentDocument\.updateTime=([^&]+)/);
      const expectedUpdateTime = preconditionMatch ? decodeURIComponent(preconditionMatch[1]) : null;
      if (expectedUpdateTime) {
        const current = store.get(key);
        const currentUpdateTime = current ? current.updateTime : null;
        if (currentUpdateTime !== expectedUpdateTime) {
          return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "FAILED_PRECONDITION", message: "el documento cambio desde la lectura" } }) };
        }
      }
      const updateTime = nextUpdateTime();
      const fields = maskMatch ? Object.assign({}, (store.get(key) || {}).fields, body.fields) : body.fields;
      store.set(key, { fields: fields, updateTime: updateTime });
      return { ok: true, status: 200, json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: fields, updateTime: updateTime }) };
    }
    throw new Error("metodo inesperado en el fake Firestore: " + method);
  }
  return { fetchImpl, store, state };
}

function loadFirebaseDbInstance(fetchImpl, opts) {
  opts = opts || {};
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => opts.uid || null,
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {
      getCurrentSession: () =>
        opts.sessionUsernameKey
          ? { role: "student", user: { usernameKey: opts.sessionUsernameKey } }
          : null,
    },
  };
  if (opts.driveDb) {
    windowObj.driveDb = opts.driveDb;
  }
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(code, sandbox);
  return windowObj._firebaseDb;
}

const FILE = "grupo-11a-guia-99-migracion-uid.html";
const SCOPE_JUAN = "student:juan";

// canCallFirestore (firebase_db.js) exige un uid de Firebase Auth valido
// para CUALQUIER operacion, lectura o escritura (ni siquiera intenta Drive
// sin uid) -- asi que una instancia SIN uid nunca llega de verdad al fake
// Firestore, no representa "un aprendiz sin migrar todavia". Un doc LEGADO
// preexistente (guardado por el codigo anterior a esta migracion, cuando
// TODAS las escrituras iban al esquema por usernameKey) se simula sembrando
// el documento directamente en el store, con el mismo formato "fields" que
// devuelve Firestore REST.
function fileKeyFor(fileName) {
  return String(fileName).replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
}
function legacyDocIdFor(scopeKey, fileName) {
  var sanitizedScope = String(scopeKey).replace(/[^a-z0-9:_-]/gi, "_");
  return "__guide_data__:" + sanitizedScope + ":" + fileKeyFor(fileName);
}
function uidDocIdFor(uid, fileName) {
  return "__guide_data__:uid:" + uid + ":" + fileKeyFor(fileName);
}
function seedLegacyProgressDoc(store, scopeKey, fileName, snapshot) {
  var docId = legacyDocIdFor(scopeKey, fileName);
  store.set("sena_portal_progress/" + docId, {
    fields: {
      _usernameKey: { stringValue: docId },
      usernameKey: { stringValue: docId },
      _kind: { stringValue: "guide-data" },
      scopeKey: { stringValue: scopeKey },
      fileName: { stringValue: fileName },
      updatedAt: { stringValue: snapshot.updatedAt },
      snapshotJson: { stringValue: JSON.stringify(snapshot) },
    },
    updateTime: "seed-legacy",
  });
  return docId;
}

test("Caso 1 -- usuario NUEVO (sin doc legado): guarda y lee por UID correctamente", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  const db = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });

  const saved = await db.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "respuesta" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  assert.equal(saved, true);

  const legacyDocId = "__guide_data__:student:juan:" + FILE.replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
  const uidDocId = "__guide_data__:uid:uid-juan:" + FILE.replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
  assert.ok(store.has("sena_portal_progress/" + uidDocId), "debe existir el doc nuevo por UID");
  assert.ok(!store.has("sena_portal_progress/" + legacyDocId), "NO debe crearse ningun doc legado para un usuario nuevo");

  const read = await db.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.p1, "respuesta");
});

test("Caso 2 -- usuario existente con SOLO doc legado: la lectura cae al legado, contenido identico a hoy", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  seedLegacyProgressDoc(store, SCOPE_JUAN, FILE, { state: { p1: "respuesta vieja" }, updatedAt: "2026-08-01T10:00:00.000Z" });

  // El aprendiz inicia sesion (uid disponible), pero AUN no ha guardado nada
  // desde este navegador -- todavia no existe doc UID.
  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  const read = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.p1, "respuesta vieja", "debe leer el contenido del legado sin alterarlo");
});

test("Caso 3 -- ese mismo usuario guarda: pasa a escribir SOLO en el doc por UID; una lectura posterior lo prefiere", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  const legacyDocId = seedLegacyProgressDoc(store, SCOPE_JUAN, FILE, { state: { p1: "respuesta vieja" }, updatedAt: "2026-08-01T10:00:00.000Z" });

  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "respuesta vieja", p2: "respuesta nueva" }, updatedAt: "2026-08-23T10:00:00.000Z" });

  const legacyEntry = store.get("sena_portal_progress/" + legacyDocId);
  assert.ok(legacyEntry, "el doc legado debe seguir existiendo");
  assert.match(legacyEntry.fields.snapshotJson.stringValue, /respuesta vieja/, "el legado conserva su contenido original, sin tocar");
  assert.doesNotMatch(legacyEntry.fields.snapshotJson.stringValue, /respuesta nueva/, "el guardado nuevo NO debe escribir en el legado");

  const uidEntry = store.get("sena_portal_progress/" + uidDocIdFor("uid-juan", FILE));
  assert.ok(uidEntry, "debe haberse creado el doc nuevo por UID");
  assert.match(uidEntry.fields.snapshotJson.stringValue, /respuesta nueva/);

  const read = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.p2, "respuesta nueva", "la lectura debe reflejar el guardado nuevo (doc UID)");
});

test("Caso 6 -- legado con Campo A mas reciente + UID con Campo B mas reciente: se conservan AMBOS", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  seedLegacyProgressDoc(store, SCOPE_JUAN, FILE, { state: { campoA: "valor A" }, updatedAt: "2026-08-20T10:00:00.000Z" });

  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { campoB: "valor B" }, updatedAt: "2026-08-23T10:00:00.000Z" });

  const read = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.campoA, "valor A", "el campo del legado no debe perderse");
  assert.equal(read.state.campoB, "valor B", "el campo del doc UID no debe perderse");
});

test("Caso 7 -- doc UID vacio/parcial NO debe esconder respuestas validas del legado", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  seedLegacyProgressDoc(store, SCOPE_JUAN, FILE, {
    state: { p1: "respuesta valida", p2: "otra respuesta valida" },
    updatedAt: "2026-08-20T10:00:00.000Z",
  });

  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  // Guardado "vacio" (p.ej. una guia que se abrio y cerro sin contestar nada
  // nuevo) con timestamp MAS RECIENTE que el legado.
  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: {}, updatedAt: "2026-08-23T10:00:00.000Z" });

  const read = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.p1, "respuesta valida", "un doc UID vacio no debe esconder el legado");
  assert.equal(read.state.p2, "otra respuesta valida");
});

test("Caso 8 -- colision historica (eimy_alvarez vs eimy.alvarez): UIDs distintos, aislamiento COMPLETO", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  // Antes de Fase 5, ambos usernames sanean al MISMO segmento "eimy_alvarez"
  // (safeCloudKey solo reemplaza el punto) y colisionaban en el docId legado.
  const dbUnderscore = loadFirebaseDbInstance(fetchImpl, { uid: "uid-real-underscore", sessionUsernameKey: "eimy_alvarez" });
  const dbDot = loadFirebaseDbInstance(fetchImpl, { uid: "uid-real-dot", sessionUsernameKey: "eimy.alvarez" });

  await dbUnderscore.cloudSaveGuideData("student:eimy_alvarez", FILE, { state: { quien: "eimy_alvarez (guion bajo real)" }, updatedAt: "2026-08-23T09:00:00.000Z" });
  await dbDot.cloudSaveGuideData("student:eimy.alvarez", FILE, { state: { quien: "eimy.alvarez (punto real)" }, updatedAt: "2026-08-23T09:05:00.000Z" });

  const fileKey = FILE.replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
  const docIdUnderscoreUid = "__guide_data__:uid:uid-real-underscore:" + fileKey;
  const docIdDotUid = "__guide_data__:uid:uid-real-dot:" + fileKey;
  assert.notEqual(docIdUnderscoreUid, docIdDotUid, "los docIds por UID deben ser necesariamente distintos");
  assert.ok(store.has("sena_portal_progress/" + docIdUnderscoreUid));
  assert.ok(store.has("sena_portal_progress/" + docIdDotUid));

  const readUnderscore = await dbUnderscore.cloudGetGuideData("student:eimy_alvarez", FILE);
  const readDot = await dbDot.cloudGetGuideData("student:eimy.alvarez", FILE);
  assert.equal(readUnderscore.state.quien, "eimy_alvarez (guion bajo real)", "cada uno debe leer SOLO su propio contenido");
  assert.equal(readDot.state.quien, "eimy.alvarez (punto real)");
  assert.notEqual(readUnderscore.state.quien, readDot.state.quien, "nunca deben mezclarse ni pisarse entre si");
});

test("Caso 9 -- usuario antiguo con solo legado: abre, hidrata, modifica, guarda -- legado queda intacto", async () => {
  const { fetchImpl, store } = makeFakeFirestore();
  const legacyDocId = seedLegacyProgressDoc(store, SCOPE_JUAN, FILE, { state: { p1: "original" }, updatedAt: "2026-08-01T10:00:00.000Z" });

  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  const hydrated = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(hydrated.state.p1, "original", "lectura previa (hidratacion) correcta");

  const modified = Object.assign({}, hydrated.state, { p1: "modificada" });
  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: modified, updatedAt: "2026-08-23T10:00:00.000Z" });

  const legacyEntry = store.get("sena_portal_progress/" + legacyDocId);
  assert.match(legacyEntry.fields.snapshotJson.stringValue, /original/, "el doc legado no debe modificarse jamas");

  const reread = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(reread.state.p1, "modificada", "la nueva escritura (doc UID) debe reflejarse en la siguiente lectura");
});

test("Caso 10 -- sena_portal_guide_state antiguo con _usernameKey sigue siendo legible por el cliente", async () => {
  // El campo _usernameKey/usernameKey es un asunto de AUTORIZACION del lado
  // servidor (firestore.rules, ver tests/firestore_rules_ownership.test.cjs);
  // el cliente lee cualquier doc que el servidor le entregue sin filtrar por
  // ese campo. Esta prueba confirma que el camino de lectura (fallback a
  // COL_GUIDE_STATE) sigue funcionando para un doc legado tal cual se
  // escribia ANTES de este fix (solo _usernameKey, sin usernameKey), leido
  // por el docId LEGADO (no el de UID, que es donde este aprendiz aun no
  // tiene nada guardado).
  const { fetchImpl, store } = makeFakeFirestore();
  const docId = legacyDocIdFor(SCOPE_JUAN, FILE);
  store.set("sena_portal_guide_state/" + docId, {
    fields: {
      _usernameKey: { stringValue: docId },
      _kind: { stringValue: "guide-data" },
      scopeKey: { stringValue: SCOPE_JUAN },
      fileName: { stringValue: FILE },
      updatedAt: { stringValue: "2026-07-01T10:00:00.000Z" },
      snapshotJson: { stringValue: JSON.stringify({ state: { p1: "en guide_state legado" }, updatedAt: "2026-07-01T10:00:00.000Z" }) },
    },
    updateTime: "seed-1",
  });

  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  const read = await dbWithUid.cloudGetGuideData(SCOPE_JUAN, FILE);
  assert.equal(read.state.p1, "en guide_state legado");
});

test("Caso 11 -- escritura nueva a sena_portal_guide_state incluye el campo usernameKey (cumple la regla nueva)", async () => {
  const { fetchImpl, store } = makeFakeFirestore({
    // Fuerza que el PATCH primario a sena_portal_progress falle (no es un
    // conflicto de version ni un 401/403/transitorio) para alcanzar el
    // fallback a sena_portal_guide_state -- el camino que tenia el bug.
    failPatchFor: (collection) => collection === "sena_portal_progress",
  });
  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  const docId = uidDocIdFor("uid-juan", FILE);

  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "via fallback guide_state" }, updatedAt: "2026-08-23T10:00:00.000Z" });

  const entry = store.get("sena_portal_guide_state/" + docId);
  assert.ok(entry, "debe haber llegado al fallback de guide_state, con el docId por UID (las escrituras nuevas van solo ahi)");
  assert.equal(entry.fields.usernameKey.stringValue, docId, "el campo usernameKey (sin guion bajo) debe estar presente, no solo _usernameKey");
  assert.equal(entry.fields._usernameKey.stringValue, docId, "_usernameKey se conserva para compatibilidad");
});

// ── Pruebas focalizadas de las piezas nuevas en aislamiento ─────────────────

test("resolveUidForScope: camino rapido (sesion propia) no necesita red", async () => {
  const { fetchImpl } = makeFakeFirestore();
  const db = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  const uid = await db.resolveUidForScope(SCOPE_JUAN);
  assert.equal(uid, "uid-juan");
});

test("resolveUidForScope: aprendiz sin perfil aun (nunca inicio sesion bajo el nuevo esquema) devuelve vacio -- transicion, no error", async () => {
  const { fetchImpl } = makeFakeFirestore();
  // Camino admin: sesion valida (con su propio uid), pero consultando a un
  // aprendiz cuyo sena_portal_users nunca se sembro con `.uid` (transicion).
  const dbAdmin = loadFirebaseDbInstance(fetchImpl, { uid: "uid-admin", sessionUsernameKey: "dubier" });
  const uid = await dbAdmin.resolveUidForScope("student:nunca-inicio-sesion");
  assert.equal(uid, "");
});

test("resolveUidForScope: camino admin (otro aprendiz) resuelve leyendo sena_portal_users.uid", async () => {
  const { fetchImpl } = makeFakeFirestore();
  // El propio aprendiz estampa su uid en su perfil al iniciar sesion.
  const dbJuan = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan" });
  await dbJuan.cloudSaveUser({ usernameKey: "juan", fullName: "Juan Aprendiz", ficha: "3441939" });
  await dbJuan.cloudSaveUserIndex("3441939", "juan");

  // El admin (sesion distinta, sin match de usernameKey) resuelve el uid de
  // "juan" a partir de su perfil, sin depender de que juan tenga sesion
  // activa en ESTE navegador.
  const dbAdmin = loadFirebaseDbInstance(fetchImpl, { uid: "uid-admin", sessionUsernameKey: "dubier" });
  const uid = await dbAdmin.resolveUidForScope(SCOPE_JUAN);
  assert.equal(uid, "uid-juan");
});

// ── Item 6 (cierre fallback Drive): promocion Drive -> Firestore ───────────

test("Promocion: con Firestore caido el guardado cae a Drive y registra la promocion CON EL DOCID POR UID (no reconstruido)", async () => {
  const { fetchImpl, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan", driveDb });

  state.down = true;
  const saved = await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "guardado con Firestore caido" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  assert.equal(saved, true, "debe caer a Drive y reportar exito");

  const expectedDocId = uidDocIdFor("uid-juan", FILE);
  assert.ok(await driveDb.get("sena_portal_progress", expectedDocId), "debe haber quedado en el replica de Drive, bajo el docId por UID");

  const pending = await dbWithUid.readPendingPromotions();
  const entry = pending.find((p) => p.collection === "sena_portal_progress" && p.docId === expectedDocId);
  assert.ok(entry, "debe haber una promocion pendiente para el docId por UID exacto (nunca reconstruido desde username)");
});

test("Promocion: al volver Firestore, flushPendingPromotions promueve al docId por UID correcto", async () => {
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const dbWithUid = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan", driveDb });

  state.down = true;
  await dbWithUid.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "guardado offline" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  const expectedDocId = uidDocIdFor("uid-juan", FILE);
  assert.equal(store.has("sena_portal_progress/" + expectedDocId), false, "todavia NO debe existir en Firestore mientras esta caido");

  state.down = false; // Firestore se recupera
  await dbWithUid.flushPendingPromotions();

  const promoted = store.get("sena_portal_progress/" + expectedDocId);
  assert.ok(promoted, "debe haberse promovido al docId por UID correcto");
  assert.match(promoted.fields.snapshotJson.stringValue, /guardado offline/);
  const remaining = await dbWithUid.readPendingPromotions();
  assert.equal(remaining.length, 0, "la promocion exitosa debe limpiar la cola pendiente");
});

test("Promocion: el docId objetivo es FIJO y nunca se recalcula a partir de la sesion que ejecuta el flush", async () => {
  // No hay emulador de Firestore para probar el RECHAZO real por reglas
  // (eso exige un uid distinto en el token vs. el docId, algo que Firestore
  // real evalua del lado servidor). Lo que SI se puede probar aqui, a nivel
  // de codigo: tryFirestorePromote nunca deriva el docId de la sesion actual
  // -- siempre reusa el docId ya resuelto y guardado en la operacion
  // pendiente. Por eso, aunque el flush se ejecute bajo la sesion de OTRO
  // usuario (p.ej. el admin, en una carga de pagina distinta), el PATCH
  // sigue apuntando al doc original de Juan, nunca a uno de "pedro".
  const { fetchImpl, store, state } = makeFakeFirestore();
  const driveDb = makeFakeDriveDb();
  const dbJuan = loadFirebaseDbInstance(fetchImpl, { uid: "uid-juan", sessionUsernameKey: "juan", driveDb });

  state.down = true;
  await dbJuan.cloudSaveGuideData(SCOPE_JUAN, FILE, { state: { p1: "de juan" }, updatedAt: "2026-08-23T10:00:00.000Z" });
  const juanDocId = uidDocIdFor("uid-juan", FILE);
  const pendingOp = (await dbJuan.readPendingPromotions()).find((p) => p.docId === juanDocId);
  assert.ok(pendingOp, "debe existir la operacion pendiente de juan");

  state.down = false;
  // Se ejecuta bajo OTRA sesion (pedro), reusando el MISMO objeto de
  // operacion pendiente (asi es como localStorage lo entregaria en un
  // computador compartido: el dato no sabe quien esta logueado ahora).
  const dbPedro = loadFirebaseDbInstance(fetchImpl, { uid: "uid-pedro", sessionUsernameKey: "pedro", driveDb });
  const ok = await dbPedro.tryFirestorePromote(pendingOp);
  assert.equal(ok, true);

  const pedroDocId = uidDocIdFor("uid-pedro", FILE);
  assert.equal(store.has("sena_portal_progress/" + pedroDocId), false, "NUNCA debe crearse/tocarse un doc de pedro por promover una operacion de juan");
  const juanEntry = store.get("sena_portal_progress/" + juanDocId);
  assert.ok(juanEntry, "el PATCH debe seguir dirigido al docId ORIGINAL de juan, sin importar quien ejecuto el flush");
  assert.match(juanEntry.fields.snapshotJson.stringValue, /de juan/);
});

test("mergeLegacyAndUidGuideStateDocs: sin doc UID, pasa el legado sin _updateTime (evita falso conflicto)", async () => {
  const { fetchImpl } = makeFakeFirestore();
  const db = loadFirebaseDbInstance(fetchImpl, {});
  const legacyDoc = { updatedAt: "2026-08-01T10:00:00.000Z", snapshotJson: JSON.stringify({ state: { p1: "x" } }), _updateTime: "legacy-rev-1" };
  const merged = db.mergeLegacyAndUidGuideStateDocs(legacyDoc, null);
  assert.equal(merged._updateTime, undefined, "no debe llevar la precondicion del legado a una escritura que ira al doc UID");
});
