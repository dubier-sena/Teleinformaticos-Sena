"use strict";

// Bloque C.2 (2026-08-25): cierre de "syncDocumentDeliveryToCloud falla en
// silencio". Hallazgo real: la funcion escribia (via store.loadSnapshot()/
// saveSnapshot()) contra el doc AGREGADO del admin ("admin:productive-stage"),
// del que un aprendiz real NUNCA es dueno segun ninguna regla (ni Firestore
// Rules ni el fallback de Apps Script) -- get y set quedaban denegados
// SIEMPRE, atrapados en silencio por un catch vacio. La entrega del ARCHIVO
// (Drive + registro local) nunca se vio afectada; lo que fallaba era solo la
// replica hacia otros dispositivos/el resumen del propio aprendiz.
//
// Correccion: doc PROPIO por aprendiz ("student:{usernameKey}", el MISMO
// esquema que ya usan las respuestas de guia), via las mismas funciones
// genericas cloudGetGuideData/cloudSaveGuideData que YA hacen
// Firestore-primero-con-fallback-a-Drive-y-promocion-al-reconectar para
// cualquier otro guardado de este portal -- nada de eso se reimplementa
// aqui, solo se re-usa con el scope correcto. Ver js/productive_stage_store.js
// (loadOwnDocumentDeliveries/saveOwnDocumentDelivery/mergeOwnDeliveriesIntoSnapshot)
// y js/productive_stage_project_delivery.js (syncDocumentDeliveryToCloud,
// getDocumentDeliveryRecord).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// El modulo resuelve runtimeScope via self/window/globalThis -- en Node cae a
// globalThis, asi que mockear global.xxx antes de cada llamada es suficiente
// (las funciones leen runtimeScope.xxx en el momento de la llamada, no al
// cargar el modulo). Se limpia despues de cada test para no contaminar otros.
const store = require(path.join(root, "js/productive_stage_store.js"));

function resetGlobals() {
  delete global._firebaseDb;
  delete global.driveDb;
  delete global.portalAuth;
}

function fakeSession(usernameKey) {
  return {
    getCurrentSession: function () {
      return { role: "student", user: { usernameKey: usernameKey, fullName: "Aprendiz Prueba" } };
    },
  };
}

// Simula el "doc en la nube" de un aprendiz como si fuera Firestore/Drive
// real: cloudSaveGuideData reemplaza el contenido, cloudGetGuideData lo
// devuelve tal cual -- exactamente el contrato real (ver firebase_db.js).
function makeFakeCloud() {
  const docs = {}; // key: scopeKey + "|" + fileName -> snapshot
  return {
    docs: docs,
    cloudGetGuideData: async function (scopeKey, fileName) {
      const key = scopeKey + "|" + fileName;
      return Object.prototype.hasOwnProperty.call(docs, key) ? docs[key] : null;
    },
    cloudSaveGuideData: async function (scopeKey, fileName, snapshot) {
      docs[scopeKey + "|" + fileName] = snapshot;
      return true;
    },
  };
}

test("1. aprendiz guarda su entrega -- saveOwnDocumentDelivery escribe en su propio doc (scope student:{key}), nunca en el del admin", async () => {
  resetGlobals();
  const cloud = makeFakeCloud();
  global._firebaseDb = cloud;

  const result = await store.saveOwnDocumentDelivery("ana.lopez", {
    docId: "bitacora-1",
    docLabel: "Bitacora 1",
    submittedAt: "2026-08-25T10:00:00.000Z",
    savedFileName: "bitacora1-ana.docx",
    driveUrl: "https://drive.google.com/ana-bitacora1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.savedCloud, true);
  const savedKeys = Object.keys(cloud.docs);
  assert.equal(savedKeys.length, 1);
  assert.equal(savedKeys[0], "student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME);
  assert.notEqual(savedKeys[0].indexOf("admin:"), 0, "nunca debe escribir en el scope admin agregado");
});

test("2. recarga y la recupera -- loadOwnDocumentDeliveries (simulando otra carga de pagina) ve lo guardado", async () => {
  resetGlobals();
  const cloud = makeFakeCloud();
  global._firebaseDb = cloud;

  await store.saveOwnDocumentDelivery("ana.lopez", {
    docId: "ficha-inscripcion",
    submittedAt: "2026-08-25T10:00:00.000Z",
    savedFileName: "ficha-ana.docx",
  });

  // "Recarga": una llamada NUEVA e independiente, como la haria otra pestaña.
  const reloaded = await store.loadOwnDocumentDeliveries("ana.lopez");
  assert.equal(reloaded.documentDeliveries.length, 1);
  assert.equal(reloaded.documentDeliveries[0].docId, "ficha-inscripcion");
  assert.equal(reloaded.documentDeliveries[0].usernameKey, "ana.lopez");
});

test("3 y 9. otro aprendiz no puede leer/escribir esa entrega, y su llamada nunca la expone -- prueba real contra respaldo_firestore.gs (actorOwnsDoc)", () => {
  // Mismo tecnica que tests/apps_script_productive_stage_privacy.test.cjs:
  // ejecuta el .gs REAL (sin modificarlo) para probar la autorizacion real,
  // no una re-implementacion de la logica.
  const gsSource = read("apps-script/respaldo_firestore.gs");
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(gsSource, sandbox);

  // Mismo docId que produce guideStateDocId("__guide_data__:", "student:ana.lopez", OWN_DELIVERIES_FILE_NAME)
  // en firebase_db.js (fileNameToKey no altera este nombre: sin puntos ni
  // caracteres fuera de [a-z0-9_-]).
  const docId = "__guide_data__:student:ana.lopez:" + store.OWN_DELIVERIES_FILE_NAME;
  const collection = "sena_portal_guide_state";

  const ownerGet = sandbox.authorizeRequest({ action: "get", collection: collection, docId: docId, email: "ana.lopez@sena-portal.local", uid: "uid-ana", adminEmails: ["dubier@sena-portal.local"] });
  const ownerSet = sandbox.authorizeRequest({ action: "set", collection: collection, docId: docId, email: "ana.lopez@sena-portal.local", uid: "uid-ana", adminEmails: ["dubier@sena-portal.local"] });
  assert.equal(ownerGet.ok, true, "la propia aprendiz SI debe poder leer su doc");
  assert.equal(ownerSet.ok, true, "la propia aprendiz SI debe poder escribir su doc");

  const strangerGet = sandbox.authorizeRequest({ action: "get", collection: collection, docId: docId, email: "beto.perez@sena-portal.local", uid: "uid-beto", adminEmails: ["dubier@sena-portal.local"] });
  const strangerSet = sandbox.authorizeRequest({ action: "set", collection: collection, docId: docId, email: "beto.perez@sena-portal.local", uid: "uid-beto", adminEmails: ["dubier@sena-portal.local"] });
  assert.equal(strangerGet.ok, false, "OTRO aprendiz NO debe poder leer el doc de Ana");
  assert.equal(strangerSet.ok, false, "OTRO aprendiz NO debe poder escribir en el doc de Ana");

  // El mismo docId por esquema UID (Fase 5, el que realmente usan las
  // escrituras nuevas cuando el uid ya se resolvio) tambien queda cubierto.
  const uidDocId = "__guide_data__:uid:uid-ana:" + store.OWN_DELIVERIES_FILE_NAME;
  const ownerByUid = sandbox.authorizeRequest({ action: "set", collection: collection, docId: uidDocId, email: "ana.lopez@sena-portal.local", uid: "uid-ana", adminEmails: ["dubier@sena-portal.local"] });
  const strangerByUid = sandbox.authorizeRequest({ action: "set", collection: collection, docId: uidDocId, email: "beto.perez@sena-portal.local", uid: "uid-beto", adminEmails: ["dubier@sena-portal.local"] });
  assert.equal(ownerByUid.ok, true);
  assert.equal(strangerByUid.ok, false);
});

test("firestore.rules: sena_portal_guide_state sigue autorizando por docId compuesto student:/uid: (esquema que este cierre reutiliza)", () => {
  const rules = read("firestore.rules");
  const guideStateBlock = rules.split("match /sena_portal_guide_state/")[1] || "";
  assert.match(guideStateBlock.slice(0, 800), /isOwnerOfGuideStateDoc\(/, "sena_portal_guide_state debe seguir autorizando por dueno compuesto");
  assert.match(rules, /function isOwnerOfGuideStateDoc\(/);
  assert.match(rules, /isOwnerOfComposedStudentDoc\(docId\)/);
  assert.match(rules, /isOwnerOfComposedUidDoc\(docId\)/);
});

test("4. Firestore disponible -- cloudSaveGuideData/cloudGetGuideData exitosos de punta a punta (camino feliz)", async () => {
  resetGlobals();
  const cloud = makeFakeCloud();
  global._firebaseDb = cloud;
  global.portalAuth = fakeSession("ana.lopez");
  global.driveDb = { getStudentProductiveStageView: async function () { return { documentDeliveries: [], projects: [] }; } };

  const saveResult = await store.saveOwnDocumentDelivery("ana.lopez", { docId: "sofia-plus", submittedAt: "2026-08-25T10:00:00.000Z" });
  assert.equal(saveResult.ok, true);

  const merged = await store.loadStudentSnapshot();
  assert.equal(merged.documentDeliveries.length, 1);
  assert.equal(merged.documentDeliveries[0].docId, "sofia-plus");
});

test("5. Firestore caido -> fallback: cloudSaveGuideData resuelve true via Drive (mismo contrato que el resto del portal) y saveOwnDocumentDelivery lo refleja sin fallo falso", async () => {
  resetGlobals();
  // Simula exactamente lo que devuelve firebase_db.js cuando fsPatch cae a
  // driveFallbackSet y este SI tiene exito: true (y ahi mismo, dentro de
  // firebase_db.js -- no aqui -- queda registrada la promocion pendiente).
  global._firebaseDb = {
    cloudGetGuideData: async function () { return null; },
    cloudSaveGuideData: async function () { return true; },
  };

  const result = await store.saveOwnDocumentDelivery("ana.lopez", { docId: "bitacora-2", submittedAt: "2026-08-25T10:00:00.000Z" });
  assert.equal(result.ok, true, "un exito via respaldo Drive debe verse como exito, no como fallo silencioso ni como error falso");
});

test("5b. Firestore Y Drive caidos (fallo total) -- saveOwnDocumentDelivery NUNCA falla en silencio: devuelve ok:false explicito", async () => {
  resetGlobals();
  global._firebaseDb = {
    cloudGetGuideData: async function () { return null; },
    cloudSaveGuideData: async function () { return false; },
  };

  const result = await store.saveOwnDocumentDelivery("ana.lopez", { docId: "bitacora-3", submittedAt: "2026-08-25T10:00:00.000Z" });
  assert.equal(result.ok, false);
  assert.equal(result.savedCloud, false);
});

test("saveOwnDocumentDelivery ignora un usernameKey falso dentro del propio registro -- la identidad SIEMPRE es el parametro, nunca el payload", async () => {
  resetGlobals();
  const cloud = makeFakeCloud();
  global._firebaseDb = cloud;

  await store.saveOwnDocumentDelivery("ana.lopez", {
    usernameKey: "beto.perez", // intento de suplantacion dentro del propio registro
    docId: "bitacora-4",
    submittedAt: "2026-08-25T10:00:00.000Z",
  });

  const saved = cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME];
  assert.equal(saved.documentDeliveries[0].usernameKey, "ana.lopez", "el usernameKey guardado debe ser el de quien realmente llamo, no el del payload");
});

test("7. equipo limpio recupera estado -- mergeOwnDeliveriesIntoSnapshot repone la entrega aunque la vista server-side llegue vacia", () => {
  const scopedEmpty = store.createEmptySnapshot(); // lo que devolveria handleStudentProductiveStageView si el catalogo admin aun no tiene nada
  const ownSnapshot = {
    documentDeliveries: [
      { usernameKey: "ana.lopez", docId: "bitacora-1", submittedAt: "2026-08-01T00:00:00.000Z", savedFileName: "b1.docx" },
    ],
  };
  const merged = store.mergeOwnDeliveriesIntoSnapshot(scopedEmpty, ownSnapshot, "ana.lopez");
  assert.equal(merged.documentDeliveries.length, 1);
  assert.equal(merged.documentDeliveries[0].docId, "bitacora-1");
});

test("9b. mergeOwnDeliveriesIntoSnapshot nunca introduce un registro de OTRO aprendiz (defensa en profundidad)", () => {
  const scopedEmpty = store.createEmptySnapshot();
  const ownSnapshotConDatoAjeno = {
    documentDeliveries: [
      { usernameKey: "beto.perez", docId: "bitacora-1", submittedAt: "2026-08-01T00:00:00.000Z" }, // no deberia estar aqui, pero si llegara
    ],
  };
  const merged = store.mergeOwnDeliveriesIntoSnapshot(scopedEmpty, ownSnapshotConDatoAjeno, "ana.lopez");
  assert.equal(merged.documentDeliveries.length, 0, "un registro que no es de 'ana.lopez' nunca debe fusionarse en su vista");
});

test("loadStudentSnapshot: sin sesion resuelta (portalAuth ausente) no revienta, devuelve solo la vista server-side", async () => {
  resetGlobals();
  global.driveDb = { getStudentProductiveStageView: async function () { return { documentDeliveries: [{ usernameKey: "ana.lopez", docId: "x" }] }; } };
  // portalAuth ausente a proposito
  const snap = await store.loadStudentSnapshot();
  assert.equal(snap.documentDeliveries.length, 1);
});

test("estructura: productive_stage_project_delivery.js ya no usa loadSnapshot/saveSnapshot (doc admin) para syncDocumentDeliveryToCloud", () => {
  const code = read("js/productive_stage_project_delivery.js");
  const syncFnMatch = code.match(/async function syncDocumentDeliveryToCloud\([\s\S]*?\n  \}/);
  assert.ok(syncFnMatch, "no se encontro syncDocumentDeliveryToCloud");
  const fnBody = syncFnMatch[0];
  assert.doesNotMatch(fnBody, /store\.loadSnapshot\(/, "ya no debe leer el doc admin agregado");
  assert.doesNotMatch(fnBody, /store\.saveSnapshot\(/, "ya no debe escribir el doc admin agregado");
  assert.match(fnBody, /store\.saveOwnDocumentDelivery\(/, "debe usar el doc propio del aprendiz");
});

test("estructura: un fallo de sincronizacion se avisa de forma visible (portalSaveStatus.error), nunca en silencio", () => {
  const code = read("js/productive_stage_project_delivery.js");
  const syncFnMatch = code.match(/async function syncDocumentDeliveryToCloud\([\s\S]*?\n  \}/);
  const fnBody = syncFnMatch[0];
  assert.match(fnBody, /if \(!result \|\| !result\.ok\)/, "debe distinguir explicitamente el caso de fallo");
  assert.match(fnBody, /portalSaveStatus\.error\(/, "debe avisar con el toast visible existente, no tragarse el error");
  assert.doesNotMatch(fnBody, /\/\/ Silencioso/i, "no debe quedar el comentario/patron del catch silencioso original");
});

test("estructura: getDocumentDeliveryRecord cae al registro remoto propio (equipo limpio) usando getDocumentDeliveriesByUsername", () => {
  const code = read("js/productive_stage_project_delivery.js");
  const fnMatch = code.match(/function getDocumentDeliveryRecord\(doc\) \{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "no se encontro getDocumentDeliveryRecord");
  const fnBody = fnMatch[0];
  assert.match(fnBody, /store\.getDocumentDeliveriesByUsername\(currentState\.snapshot\)/);
  assert.match(fnBody, /usernameKey/);
});
