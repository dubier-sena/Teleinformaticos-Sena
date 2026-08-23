"use strict";

// Cierre de riesgos 2026-08-22 (Riesgo 1, seccion "SEGURIDAD DE verify"):
// ficha/fullName llegaban SIEMPRE del payload del cliente sin cruzarlos jamas
// contra el dueno real del idToken. Un idToken valido solo prueba "eres UN
// aprendiz autenticado", no que la ficha/nombre que pusiste en el payload sean
// los tuyos -- por eso un aprendiz podia editar esos campos en devtools y usar
// "verify" (o "upload") contra la carpeta de OTRO aprendiz. Esta prueba EJECUTA
// de verdad doPost (via vm, con DriveApp/UrlFetchApp/etc. simulados) para
// demostrar que ahora se resuelve el perfil real en Firestore (atado al mismo
// idToken ya verificado) y se usa ESE valor para decidir la carpeta, sin
// importar lo que el payload reclame.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "entregas_actividades.gs"),
  "utf8"
);

// IDs reales tomados de FICHA_ROOT_FOLDERS en el .gs (no son secretos: son
// carpetas de Drive, la seguridad la da la verificacion de identidad).
const FICHA_ATACANTE_REAL = "3441939"; // ficha real del atacante segun su perfil
const FOLDER_ATACANTE_REAL = "1SLkk986REOKGEFaCyWV7rSeudj7lnUMs";
const FICHA_VICTIMA_RECLAMADA = "3441944"; // ficha que el atacante PIDE en el payload
const FOLDER_VICTIMA = "1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf";

function makeFakeFolder() {
  return {
    getFoldersByName: function () {
      return { hasNext: function () { return false; } };
    },
    createFolder: function () {
      return makeFakeFolder();
    },
    getFiles: function () {
      return { hasNext: function () { return false; }, next: function () {} };
    },
    createFile: function (blob) {
      return {
        getUrl: function () { return "https://drive/fake/uploaded"; },
        getId: function () { return "fileid-fake"; },
        getDateCreated: function () { return new Date("2026-08-22T10:00:00.000Z"); },
        makeCopy: function () { return this; },
      };
    },
  };
}

// urlFetchScript: { identityEmail, profileStatus, profileFicha, profileFullName }
function makeSandbox(urlFetchScript) {
  const driveCalls = [];
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: {
      getScriptProperties: function () {
        return {
          getProperty: function (name) {
            return name === "FIREBASE_API_KEY" ? "fake-api-key" : "";
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
      base64Decode: function (b64) { return Buffer.from(String(b64 || ""), "base64"); },
      newBlob: function (bytes, mime, name) {
        return { getName: function () { return name; } };
      },
      computeDigest: function () { return [1, 2, 3]; },
      base64EncodeWebSafe: function () { return "digest"; },
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
    DriveApp: {
      getFolderById: function (id) {
        driveCalls.push(id);
        return makeFakeFolder();
      },
    },
    ContentService: {
      createTextOutput: function (text) {
        return {
          setMimeType: function () {
            return { __isJsonResponse: true, getContent: function () { return text; } };
          },
        };
      },
      MimeType: { JSON: "JSON" },
    },
    UrlFetchApp: {
      fetch: function (url) {
        if (url.indexOf("identitytoolkit.googleapis.com") >= 0) {
          return {
            getResponseCode: function () { return 200; },
            getContentText: function () {
              return JSON.stringify({
                users: [{ email: urlFetchScript.identityEmail, localId: "uid-test" }],
              });
            },
          };
        }
        if (url.indexOf("sena_portal_users") >= 0) {
          if (urlFetchScript.profileStatus !== 200) {
            return { getResponseCode: function () { return urlFetchScript.profileStatus || 404; }, getContentText: function () { return "{}"; } };
          }
          return {
            getResponseCode: function () { return 200; },
            getContentText: function () {
              return JSON.stringify({
                fields: {
                  ficha: { stringValue: urlFetchScript.profileFicha || "" },
                  fullName: { stringValue: urlFetchScript.profileFullName || "" },
                },
              });
            },
          };
        }
        throw new Error("UrlFetchApp.fetch: URL no simulada en el test: " + url);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    gsSource +
      "\nthis.__doPost = doPost; this.__usernameKeyFromEmail = usernameKeyFromEmail; this.__fetchVerifiedProfile = fetchVerifiedProfile;",
    sandbox
  );
  return { sandbox: sandbox, driveCalls: driveCalls };
}

function callDoPost(sandbox, payloadObj) {
  const result = sandbox.__doPost({ postData: { contents: JSON.stringify(payloadObj) } });
  return JSON.parse(result.getContent());
}

test("usernameKeyFromEmail: extrae la clave base, con y sin sufijo de version", () => {
  const { sandbox } = makeSandbox({ identityEmail: "x@sena-portal.local", profileStatus: 200 });
  assert.equal(sandbox.__usernameKeyFromEmail("juan@sena-portal.local"), "juan");
  assert.equal(sandbox.__usernameKeyFromEmail("juan.v2@sena-portal.local"), "juan");
  assert.equal(sandbox.__usernameKeyFromEmail("maria.perez.v10@sena-portal.local"), "maria.perez");
});

test("fetchVerifiedProfile: lee sena_portal_users con Authorization Bearer (no depende de ?key=)", () => {
  let capturedUrl = null;
  let capturedOptions = null;
  const sandbox0 = {
    console,
    Logger: { log: function () {} },
    CacheService: {
      getScriptCache: function () {
        const store = {};
        return { get: (k) => store[k] || null, put: (k, v) => { store[k] = v; } };
      },
    },
    UrlFetchApp: {
      fetch: function (url, options) {
        capturedUrl = url;
        capturedOptions = options;
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ fields: { ficha: { stringValue: "3441939" }, fullName: { stringValue: "Real Nombre" } } }),
        };
      },
    },
  };
  vm.createContext(sandbox0);
  vm.runInContext(gsSource + "\nthis.__fetchVerifiedProfile = fetchVerifiedProfile;", sandbox0);

  const profile = sandbox0.__fetchVerifiedProfile("token-abc123", "juan.v2@sena-portal.local");
  // assert.equal campo por campo (no deepEqual): el objeto viene de un
  // vm.createContext distinto (otro "realm"), y deepStrictEqual compara
  // tambien el prototipo -- con objetos planos de dos realms distintos
  // reporta "same structure but not reference-equal" aunque los valores
  // sean identicos. Comparar valores primitivos evita ese falso negativo.
  assert.equal(profile.usernameKey, "juan");
  assert.equal(profile.ficha, "3441939");
  assert.equal(profile.fullName, "Real Nombre");
  assert.match(capturedUrl, /sena_portal_users\/juan(\?|$)/, "debe leer el doc por la CLAVE BASE (sin .v2)");
  assert.equal(capturedOptions.headers.Authorization, "Bearer token-abc123", "debe autenticar con el idToken, no con una API key publica");
  assert.equal(capturedUrl.indexOf("key="), -1, "no debe depender de un API key en la URL (la regla es 'signedIn()')");
});

test("fetchVerifiedProfile: Firestore no responde 200 -> null (el llamador decide como degradar)", () => {
  const sandbox0 = {
    console,
    Logger: { log: function () {} },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 500, getContentText: () => "" }) },
  };
  vm.createContext(sandbox0);
  vm.runInContext(gsSource + "\nthis.__fetchVerifiedProfile = fetchVerifiedProfile;", sandbox0);
  assert.equal(sandbox0.__fetchVerifiedProfile("tok", "juan@sena-portal.local"), null);
});

test("SEGURIDAD verify: un aprendiz autenticado NO puede consultar la ficha de otro aprendiz cambiando el payload", () => {
  const { sandbox, driveCalls } = makeSandbox({
    identityEmail: "atacante@sena-portal.local",
    profileStatus: 200,
    profileFicha: FICHA_ATACANTE_REAL,
    profileFullName: "Atacante Real",
  });

  const response = callDoPost(sandbox, {
    idToken: "token-del-atacante",
    action: "verify",
    ficha: FICHA_VICTIMA_RECLAMADA, // <- payload alterado: pide la ficha de otro
    fullName: "Nombre De La Victima", // <- y el nombre de otro
    activityLabel: "Actividad 3.1.1",
    guideLabel: "Guia 3",
  });

  assert.equal(response.ok, true);
  assert.deepEqual(driveCalls, [FOLDER_ATACANTE_REAL], "debe consultar SOLO la carpeta real del atacante");
  assert.ok(driveCalls.indexOf(FOLDER_VICTIMA) === -1, "jamas debe tocar la carpeta de la ficha reclamada/ajena");
});

test("SEGURIDAD upload: un aprendiz autenticado NO puede depositar un archivo en la ficha de otro aprendiz", () => {
  const { sandbox, driveCalls } = makeSandbox({
    identityEmail: "atacante@sena-portal.local",
    profileStatus: 200,
    profileFicha: FICHA_ATACANTE_REAL,
    profileFullName: "Atacante Real",
  });

  const response = callDoPost(sandbox, {
    idToken: "token-del-atacante",
    action: "upload",
    ficha: FICHA_VICTIMA_RECLAMADA,
    fullName: "Nombre De La Victima",
    activityLabel: "Actividad 3.1.1",
    fileName: "evidencia.pdf",
    fileBase64: Buffer.from("contenido-fake").toString("base64"),
  });

  assert.equal(response.ok, true);
  // El primer folder consultado es SIEMPRE la carpeta principal de la ficha
  // (la copia de respaldo del instructor va despues, a una carpeta fija sin
  // relacion con la ficha -- ver ADMIN_BACKUP_FOLDER_ID en el .gs).
  assert.equal(driveCalls[0], FOLDER_ATACANTE_REAL, "el archivo debe caer en la carpeta REAL del atacante, no en la reclamada");
  assert.ok(driveCalls.indexOf(FOLDER_VICTIMA) === -1, "jamas debe tocar la carpeta de la ficha reclamada/ajena");
});

test("RECORRIDO completo (Riesgo 1): confirmedAt en la respuesta de upload es EXACTAMENTE DriveApp.File.getDateCreated(), no el reloj del cliente", () => {
  const { sandbox } = makeSandbox({
    identityEmail: "juan@sena-portal.local",
    profileStatus: 200,
    profileFicha: FICHA_ATACANTE_REAL,
    profileFullName: "Juan Aprendiz",
  });

  const response = callDoPost(sandbox, {
    idToken: "token-juan",
    action: "upload",
    ficha: FICHA_ATACANTE_REAL,
    fullName: "Juan Aprendiz",
    activityLabel: "Actividad 3.1.1",
    fileName: "evidencia.pdf",
    fileBase64: Buffer.from("contenido-fake").toString("base64"),
  });

  assert.equal(response.ok, true);
  // makeFakeFolder().createFile(...) fija getDateCreated() en un valor FIJO
  // y distinto de "ahora" (2026-08-22T10:00:00.000Z): si confirmedAt viniera
  // del reloj del cliente/servidor en el momento de la prueba, este assert
  // fallaria salvo coincidencia exacta de milisegundo.
  assert.equal(response.confirmedAt, "2026-08-22T10:00:00.000Z", "confirmedAt debe ser la fecha real de creacion del archivo en Drive");
  assert.equal(response.fileId, "fileid-fake");
  // Y el mismo valor es el que buildDeliveryRecord (shared_apps_script_delivery.js)
  // usa como submittedAt/fechaEntrega -- probado end-to-end en
  // tests/delivery_history_and_dates.test.cjs ("usa confirmedAt del servidor
  // como fecha oficial"); aqui solo se confirma que el .gs REALMENTE
  // devuelve el valor real de Drive, no un placeholder.
});

test("degradacion segura: si el perfil de Firestore no se puede leer, se usa la ficha del cliente (sin bloquear la entrega real)", () => {
  const { sandbox, driveCalls } = makeSandbox({
    identityEmail: "juan@sena-portal.local",
    profileStatus: 500, // Firestore caido / doc inexistente
  });

  const response = callDoPost(sandbox, {
    idToken: "token-juan",
    action: "verify",
    ficha: "3168850",
    fullName: "Juan Estudiante",
    activityLabel: "Actividad 1.1.1",
  });

  assert.equal(response.ok, true, "no debe bloquear la entrega solo porque el perfil no se pudo leer");
  assert.deepEqual(driveCalls, ["1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp"], "debe caer de vuelta al valor del payload (comportamiento previo)");
});

test("perfil verificado sin ficha/fullName (doc vacio) tambien degrada al valor del cliente", () => {
  const { sandbox, driveCalls } = makeSandbox({
    identityEmail: "nuevo@sena-portal.local",
    profileStatus: 200,
    profileFicha: "",
    profileFullName: "",
  });
  const response = callDoPost(sandbox, {
    idToken: "token-nuevo",
    action: "verify",
    ficha: "3168852",
    fullName: "Aprendiz Nuevo",
    activityLabel: "Actividad 1.1.1",
  });
  assert.equal(response.ok, true);
  assert.deepEqual(driveCalls, ["1p9HdGinK1me8PsbaLHYio_OC-idAmorR"]);
});
