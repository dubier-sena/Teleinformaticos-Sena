"use strict";

// Bloque C.1 (cierre de hallazgo de privacidad, 2026-08-25): antes de esta
// accion, un aprendiz sin acceso directo a Firestore caia al respaldo de
// Drive (respaldo_firestore.gs) pidiendo el doc COMPLETO de Etapa Productiva
// (scope "admin:productive-stage") -- authorizeRequest() SI lo denegaba
// (confirmado leyendo el codigo: el docId no tiene "student"/uid del actor
// como segmento), asi que loadSnapshot() no estaba filtrando NADA en el
// cliente porque nunca recibia nada -- pero esa denegacion total tambien
// significa que un aprendiz JAMAS podia ver su PROPIO documentDeliveries
// por este camino (sin acceso alguno, no un acceso "de mas"). El riesgo real
// era LATENTE: si alguien "arreglara" ese hueco funcional agregando esa
// scope a isSharedReadDoc() (la forma mas facil y mas equivocada de
// arreglarlo), CUALQUIER aprendiz recibiria el documentDeliveries de TODOS.
// handleStudentProductiveStageView cierra el hueco funcional de la forma
// correcta: identidad SOLO del idToken verificado, filtrado SERVER-SIDE
// (nunca en el cliente), sin abrir isSharedReadDoc.
//
// Mismo patron ya probado en este repo para .gs que toca Drive de verdad
// (ver tests/apps_script_respaldo_set_merge.test.cjs): vm.createContext con
// DriveApp/UrlFetchApp/PropertiesService simulados, ejecutando doPost real.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "respaldo_firestore.gs"),
  "utf8"
);

const CATALOG_FILE_NAME = "guide_data__:admin:productive-stage:productive-stage-catalog.json";

function makeFakeDrive(seedCatalog) {
  const collectionFiles = new Map();
  if (seedCatalog) {
    collectionFiles.set(CATALOG_FILE_NAME, JSON.stringify({
      collection: "sena_portal_guide_state",
      docId: "__guide_data__:admin:productive-stage:productive-stage-catalog",
      data: seedCatalog,
      savedAt: "2026-08-24T00:00:00.000Z",
    }));
  }

  const collectionFolder = {
    getFilesByName: function (name) {
      const exists = collectionFiles.has(name);
      return {
        hasNext: function () { return exists; },
        next: function () {
          return { getBlob: function () { return { getDataAsString: function () { return collectionFiles.get(name); } }; } };
        },
      };
    },
  };
  const rootFolder = {
    getFoldersByName: function () {
      return { hasNext: function () { return true; }, next: function () { return collectionFolder; } };
    },
  };
  return { driveApp: { getFolderById: function () { return rootFolder; } }, files: collectionFiles };
}

function makeSandbox(identityEmail, drive, uid) {
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (name) {
            if (name === "FIREBASE_API_KEY") return "fake-api-key";
            if (name === "BACKUP_ROOT_FOLDER_ID") return "fake-root-id";
            return "";
          },
        };
      },
    },
    CacheService: {
      getScriptCache: function () {
        const store = {};
        return {
          get: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
          put: function (k, v) { store[k] = v; },
        };
      },
    },
    Utilities: {
      newBlob: function (content, mime, name) { return { getName: function () { return name; }, getDataAsString: function () { return content; } }; },
      base64EncodeWebSafe: function () { return "digest"; },
      computeDigest: function () { return [1, 2, 3]; },
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
    DriveApp: drive.driveApp,
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
            getContentText: function () { return JSON.stringify({ users: [{ email: identityEmail, localId: uid || "" }] }); },
          };
        }
        throw new Error("UrlFetchApp.fetch: URL no simulada: " + url);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(gsSource, sandbox);
  return sandbox;
}

function callDoPost(sandbox, payloadObj) {
  const result = sandbox.doPost({ postData: { contents: JSON.stringify(payloadObj) } });
  return JSON.parse(result.getContent());
}

const CATALOG = {
  schemaVersion: 2,
  updatedAt: "2026-08-20T00:00:00.000Z",
  documentDeadlines: { "bitacora-1": { dueAt: "2026-09-01T00:00:00.000Z", updatedAt: "x", updatedBy: "admin" } },
  documentDeliveries: [
    { usernameKey: "ana.lopez", docId: "bitacora-1", fullName: "Ana Lopez", submittedAt: "2026-08-01T00:00:00.000Z", driveUrl: "https://drive.google.com/ana-file" },
    { usernameKey: "beto.perez", docId: "bitacora-1", fullName: "Beto Perez", submittedAt: "2026-08-02T00:00:00.000Z", driveUrl: "https://drive.google.com/beto-file" },
    { usernameKey: "carla.ruiz", docId: "sofia-plus", fullName: "Carla Ruiz", submittedAt: "2026-08-03T00:00:00.000Z", driveUrl: "https://drive.google.com/carla-file" },
  ],
  // Ana y Beto son del MISMO equipo (proyecto p-ana-beto); Carla es de un
  // equipo totalmente distinto (proyecto p-carla-solo).
  projects: [
    { id: "p-ana-beto", title: "Proyecto de Ana y Beto", studentUsernameKeys: ["ana.lopez", "beto.perez"] },
    { id: "p-carla-solo", title: "Proyecto de Carla", studentUsernameKeys: ["carla.ruiz"] },
  ],
  reports: [
    { reportId: "r1", projectId: "p-ana-beto", comentario: "Informe del equipo de Ana" },
    { reportId: "r2", projectId: "p-carla-solo", comentario: "Informe de Carla" },
  ],
  deliveries: [
    { deliveryId: "d1", projectId: "p-ana-beto", savedFileName: "avance-ana-beto.docx" },
    { deliveryId: "d2", projectId: "p-carla-solo", savedFileName: "avance-carla.docx" },
  ],
  studentIndex: { "ana.lopez": ["p-ana-beto"], "beto.perez": ["p-ana-beto"], "carla.ruiz": ["p-carla-solo"] },
};

// 1, 2, 3: cada aprendiz obtiene SU snapshot, nunca el de otro.
test("1 y 2. aprendiz A obtiene su propio snapshot y NO el de B", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  assert.equal(response.ok, true);
  assert.equal(response.found, true);
  assert.equal(response.data.documentDeliveries.length, 1);
  assert.equal(response.data.documentDeliveries[0].usernameKey, "ana.lopez");
  assert.equal(response.data.documentDeliveries.some((r) => r.usernameKey === "beto.perez"), false);
  assert.equal(response.data.documentDeliveries.some((r) => r.usernameKey === "carla.ruiz"), false);
});

test("3. aprendiz B obtiene el suyo (independiente de A)", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("beto.perez@sena-portal.local", drive, "uid-beto");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  assert.equal(response.data.documentDeliveries.length, 1);
  assert.equal(response.data.documentDeliveries[0].usernameKey, "beto.perez");
});

// 4. Modificar identidad en el payload NO permite suplantar a otro: la
// identidad viene SOLO del idToken verificado, este handler ni siquiera lee
// payload.usernameKey/payload.ficha.
test("4. un payload con usernameKey/ficha falsos (de otro aprendiz) es IGNORADO -- la identidad sale solo del idToken verificado", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, {
    idToken: "tok",
    action: "studentProductiveStageView",
    usernameKey: "beto.perez", // intento de suplantacion via payload
    ficha: "3168850",
    fullName: "Beto Perez",
  });

  assert.equal(response.data.documentDeliveries.length, 1);
  assert.equal(response.data.documentDeliveries[0].usernameKey, "ana.lopez", "debe seguir siendo Ana, el payload no debe poder cambiar la identidad");
});

// 5. Admin sigue con acceso completo por el camino EXISTENTE (accion "get"
// generica), sin que esta nueva accion lo reemplace ni lo debilite.
test("5. el admin sigue obteniendo el snapshot COMPLETO por la accion generica 'get' (sin cambios)", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("dubier@sena-portal.local", drive, "uid-admin");
  const response = callDoPost(sandbox, {
    idToken: "tok", action: "get",
    collection: "sena_portal_guide_state",
    docId: "__guide_data__:admin:productive-stage:productive-stage-catalog",
  });
  assert.equal(response.ok, true);
  assert.equal(response.data.documentDeliveries.length, 3, "el admin ve las 3 entregas, de los 3 aprendices");
});

// 6. Firestore disponible: fuera del alcance de este archivo (esa decision
// vive del lado cliente, ver tests/academic_agenda_context.test.cjs) -- aqui
// se cubre el propio Apps Script, que es lo que responde cuando Firestore
// NO esta disponible (escenario 7).

// 7 y 8: "Firestore caido -> fallback Drive" + "el fallback tampoco expone
// otros aprendices" -- este archivo simula exactamente el fallback (nunca
// toca Firestore real), asi que los tests 1-4 de arriba YA prueban 7 y 8 al
// mismo tiempo: la unica fuente de datos aqui ES el fallback de Drive.

test("catalogo inexistente (aun no se ha configurado ninguna fecha/entrega) -> found:false, no un error", () => {
  const drive = makeFakeDrive(null); // sin seed: el archivo no existe
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });
  assert.equal(response.ok, true);
  assert.equal(response.found, false);
});

test("sin idToken -> rechazado antes de identificar a nadie", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const result = sandbox.doPost({ postData: { contents: JSON.stringify({ action: "studentProductiveStageView" }) } });
  const response = JSON.parse(result.getContent());
  assert.equal(response.ok, false);
});

// Prueba explicita pedida: inspeccionar la respuesta SERIALIZADA completa y
// confirmar que el nombre/usernameKey/UID de OTRO aprendiz no aparece en
// NINGUN lugar (no solo en el campo que se le ocurre revisar a un test
// menos estricto). Carla es la referencia correcta para "cero relacion": a
// diferencia de Beto (companero de EQUIPO de Ana, con visibilidad legitima
// del mismo proyecto), Carla no comparte proyecto ni documentDeliveries con
// Ana -- nada de lo suyo deberia aparecer bajo ningun campo.
test("inspeccion completa de la respuesta serializada: ningun dato de Carla (sin relacion con Ana) aparece en ningun lugar", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  const serialized = JSON.stringify(response);
  ["carla.ruiz", "Carla Ruiz", "carla-file", "p-carla-solo", "Proyecto de Carla", "Informe de Carla", "avance-carla"].forEach((needle) => {
    assert.equal(serialized.indexOf(needle), -1, `"${needle}" (dato de Carla) no debe aparecer en ningun lugar de la respuesta de Ana`);
  });
  // Y lo de Ana SI debe estar (confirma que no se vacio todo por error).
  assert.notEqual(serialized.indexOf("ana.lopez"), -1);
});

// Beto SI es visible para Ana como companero de EQUIPO (mismo proyecto) --
// eso es correcto. Lo que NUNCA debe cruzar es el documentDeliveries
// INDIVIDUAL de Beto (su propia entrega de bitacora, personal, no de
// equipo): Ana no debe recibir el registro de la bitacora de Beto ni su
// enlace de Drive personal.
test("Beto es visible como companero de equipo, pero su entrega INDIVIDUAL de bitacora nunca llega a Ana", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  assert.equal(response.data.documentDeliveries.some((r) => r.usernameKey === "beto.perez"), false);
  const serialized = JSON.stringify(response);
  assert.equal(serialized.indexOf("beto-file"), -1, "el enlace de Drive personal de la bitacora de Beto no debe aparecer");
});

// El proyecto es compartido por EQUIPO (varios companeros), no por
// aprendiz individual como documentDeliveries -- Ana y Beto SI deben ver el
// mismo proyecto/informes/avance (son equipo), pero NUNCA los de Carla
// (otro equipo).
test("proyecto/informes/avance: Ana ve el proyecto de SU equipo (Beto incluido), nunca el de Carla", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  assert.equal(response.data.projects.length, 1);
  assert.equal(response.data.projects[0].id, "p-ana-beto");
  assert.deepEqual(response.data.studentIndex["ana.lopez"], ["p-ana-beto"]);

  assert.equal(response.data.reports.length, 1);
  assert.equal(response.data.reports[0].projectId, "p-ana-beto");

  assert.equal(response.data.deliveries.length, 1);
  assert.equal(response.data.deliveries[0].projectId, "p-ana-beto");

  const serialized = JSON.stringify(response);
  ["p-carla-solo", "Proyecto de Carla", "Informe de Carla", "avance-carla"].forEach((needle) => {
    assert.equal(serialized.indexOf(needle), -1, `"${needle}" (equipo de Carla) no debe aparecer para Ana`);
  });
});

test("Carla (otro equipo) ve SU proyecto, nunca el de Ana/Beto", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("carla.ruiz@sena-portal.local", drive, "uid-carla");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });

  assert.equal(response.data.projects.length, 1);
  assert.equal(response.data.projects[0].id, "p-carla-solo");
  const serialized = JSON.stringify(response);
  assert.equal(serialized.indexOf("p-ana-beto"), -1);
});

// documentDeadlines es informacion COMPARTIDA (fechas, no datos personales):
// debe llegar completa a cualquier aprendiz, no solo la propia.
test("documentDeadlines (compartido, sin datos personales) llega completo, no se filtra por aprendiz", () => {
  const drive = makeFakeDrive(CATALOG);
  const sandbox = makeSandbox("ana.lopez@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, { idToken: "tok", action: "studentProductiveStageView" });
  assert.deepEqual(Object.keys(response.data.documentDeadlines), ["bitacora-1"]);
});
