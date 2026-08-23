"use strict";

// Riesgo 1 (cierre 2026-08-22): casos NEGATIVOS de "verify" -- ejecuta de
// verdad handleVerifyDelivery (via vm, con DriveApp simulado) contra una
// carpeta con VARIOS archivos parecidos, para documentar exactamente cual
// selecciona y por que. Nunca debe confirmar una entrega incorrecta.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "entregas_actividades.gs"),
  "utf8"
);

// Identidad de referencia usada en todos los casos (ficha/fullName YA
// coinciden con el perfil "verificado" -- estos tests son sobre el MATCH DE
// ARCHIVO dentro de la carpeta, no sobre la suplantacion de identidad, que ya
// se cubre en tests/entregas_actividades_identity_security.test.cjs).
const FICHA = "3441939";
const FULL_NAME = "Ana Torres";
const GUIDE_NUMBER = "3";
const ACTIVITY_NUMBER = "3.1.1";
const SHORT_NAME = "Bitacora";
// Debe coincidir con buildDeliveryFileNameStem en el .gs para esta identidad.
const EXPECTED_STEM = "Guia_3_Actividad_311_Bitacora_3441939_Ana_Torres";

function makeFile(name, isoDate, id) {
  return {
    name: name,
    getName: function () { return name; },
    getUrl: function () { return "https://drive/fake/" + (id || name); },
    getId: function () { return id || name; },
    getDateCreated: function () { return new Date(isoDate); },
  };
}

function makeSandbox(seedFiles) {
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: function (name) { return name === "FIREBASE_API_KEY" ? "fake-api-key" : ""; } };
      },
    },
    CacheService: {
      getScriptCache: function () {
        const store = {};
        return { get: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null), put: (k, v) => { store[k] = v; } };
      },
    },
    Utilities: {
      base64Decode: (b64) => Buffer.from(String(b64 || ""), "base64"),
      newBlob: (bytes, mime, name) => ({ getName: () => name }),
      computeDigest: () => [1, 2, 3],
      base64EncodeWebSafe: () => "digest",
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
    DriveApp: {
      getFolderById: function () {
        // El payload de "verify" incluye guideNumber/activityNumber (hacen
        // falta para calcular el stem esperado), lo que TAMBIEN hace que
        // resolveTargetFolder intente descender a una subcarpeta de
        // guia/actividad. Como este test es sobre el EMPAREJAMIENTO DE
        // NOMBRE (no sobre la jerarquia de carpetas, ya cubierta en otro
        // lado), createFolder()/getFoldersByName() devuelven la MISMA
        // carpeta (con los MISMOS archivos sembrados) sin importar cuantos
        // niveles se pida descender -- si no, los archivos sembrados
        // quedarian en una carpeta distinta a la que realmente consulta
        // handleVerifyDelivery y todos los casos darian found:false.
        const folder = {
          getFoldersByName: function () { return { hasNext: function () { return false; } }; },
          createFolder: function () { return folder; },
          getFiles: function () {
            let i = 0;
            return {
              hasNext: function () { return i < seedFiles.length; },
              next: function () { return seedFiles[i++]; },
            };
          },
        };
        return folder;
      },
    },
    ContentService: {
      createTextOutput: (text) => ({ setMimeType: () => ({ getContent: () => text }) }),
      MimeType: { JSON: "JSON" },
    },
    UrlFetchApp: {
      fetch: function (url) {
        if (url.indexOf("identitytoolkit.googleapis.com") >= 0) {
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ users: [{ email: "ana.torres@sena-portal.local", localId: "uid-ana" }] }) };
        }
        if (url.indexOf("sena_portal_users") >= 0) {
          // Perfil verificado IDENTICO al payload: aisla el test a la logica
          // de emparejamiento de archivo, no a la de identidad.
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({ fields: { ficha: { stringValue: FICHA }, fullName: { stringValue: FULL_NAME } } }),
          };
        }
        throw new Error("URL no simulada: " + url);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(gsSource + "\nthis.__doPost = doPost;", sandbox);
  return sandbox;
}

function verify(seedFiles) {
  const sandbox = makeSandbox(seedFiles);
  const result = sandbox.__doPost({
    postData: {
      contents: JSON.stringify({
        idToken: "token-ana",
        action: "verify",
        ficha: FICHA,
        fullName: FULL_NAME,
        activityLabel: "Actividad " + ACTIVITY_NUMBER,
        guideNumber: GUIDE_NUMBER,
        activityNumber: ACTIVITY_NUMBER,
        shortName: SHORT_NAME,
      }),
    },
  });
  return JSON.parse(result.getContent());
}

test("archivo CORRECTO (unico en la carpeta): se encuentra y se confirma", () => {
  const r = verify([makeFile(EXPECTED_STEM + ".pdf", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, true);
  assert.equal(r.savedFileName, EXPECTED_STEM + ".pdf");
});

test("archivo de OTRA ACTIVIDAD (mismo aprendiz/ficha/guia, numero de actividad distinto): NO debe confirmarse", () => {
  const otraActividad = EXPECTED_STEM.replace("Actividad_311", "Actividad_312");
  const r = verify([makeFile(otraActividad + ".pdf", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, false, "un archivo de la actividad 3.1.2 no debe contar como entrega de 3.1.1");
});

test("archivo de OTRA GUIA (mismo aprendiz/ficha/actividad, numero de guia distinto): NO debe confirmarse", () => {
  const otraGuia = EXPECTED_STEM.replace("Guia_3_", "Guia_4_");
  const r = verify([makeFile(otraGuia + ".pdf", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, false, "un archivo de la guia 4 no debe contar como entrega de la guia 3");
});

test("archivo de OTRO APRENDIZ (mismo ficha/guia/actividad, nombre distinto): NO debe confirmarse", () => {
  const otroAprendiz = EXPECTED_STEM.replace("Ana_Torres", "Carlos_Ruiz");
  const r = verify([makeFile(otroAprendiz + ".pdf", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, false, "el archivo de un companero de la misma ficha/guia/actividad no debe confirmarse como propio");
});

test("extension distinta a la sugerida: SI se tolera (mismo stem exacto, solo cambia el formato)", () => {
  const r = verify([makeFile(EXPECTED_STEM + ".docx", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, true, "el aprendiz pudo haber guardado en un formato distinto al sugerido");
  assert.equal(r.savedFileName, EXPECTED_STEM + ".docx");
});

test("REGRESION (hallazgo corregido en esta misma sesion): un nombre que solo EMPIEZA IGUAL como texto plano (\"..._Ana_Torresborrador.pdf\") NO debe confirmarse", () => {
  // Antes de este cambio, `name.indexOf(expectedStem) === 0` aceptaba
  // CUALQUIER sufijo pegado despues del stem exacto (no solo una extension
  // distinta), asi que este archivo -- que en realidad no es una entrega
  // valida de esta actividad -- calzaba por error. Ahora el remanente
  // despues del stem debe ser SOLO una extension o el sufijo "(N)" que Drive
  // agrega solo, nunca texto arbitrario.
  const nombreParecido = EXPECTED_STEM + "borrador.pdf";
  const r = verify([makeFile(nombreParecido, "2026-08-20T10:00:00.000Z")]);
  assert.equal(r.found, false, "un sufijo de texto arbitrario pegado al stem no debe confirmarse como entrega valida");
});

test("tolerancia legitima: el sufijo \"(1)\"/\"(2)\" que Drive agrega solo cuando ya existe un archivo con ese nombre SI se acepta", () => {
  const r1 = verify([makeFile(EXPECTED_STEM + " (1).pdf", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r1.found, true, "Drive renombra asi automaticamente una reentrega manual con el mismo nombre sugerido");

  const r2 = verify([makeFile(EXPECTED_STEM + "(2).docx", "2026-08-20T10:00:00.000Z")]);
  assert.equal(r2.found, true, "tambien debe tolerarse junto con un cambio de extension");
});

test("DUPLICADO (mismo stem, dos extensiones distintas): gana el archivo mas RECIENTE por fecha de creacion en Drive", () => {
  const r = verify([
    makeFile(EXPECTED_STEM + ".pdf", "2026-08-18T09:00:00.000Z", "file-viejo"),
    makeFile(EXPECTED_STEM + ".docx", "2026-08-20T09:00:00.000Z", "file-nuevo"),
  ]);
  assert.equal(r.found, true);
  assert.equal(r.fileId, "file-nuevo", "debe preferir el archivo con fecha de creacion mas reciente");
  assert.equal(r.confirmedAt, "2026-08-20T09:00:00.000Z");
});

test("archivo ANTIGUO junto a uno NUEVO con el MISMO nombre exacto (reentrega manual): gana el mas nuevo, nunca el viejo", () => {
  const r = verify([
    makeFile(EXPECTED_STEM + ".pdf", "2026-01-01T00:00:00.000Z", "file-enero"),
    makeFile(EXPECTED_STEM + ".pdf", "2026-08-20T00:00:00.000Z", "file-agosto"),
  ]);
  assert.equal(r.fileId, "file-agosto", "una reentrega manual debe reemplazar la version reconocida, no la primera que se encuentre");
});

test("DOS ARCHIVOS POTENCIALMENTE VALIDOS (match exacto vs. variante tolerable \"(1)\"): gana el mas reciente, sin importar cual matcheo fue exacto", () => {
  const r = verify([
    makeFile(EXPECTED_STEM + ".pdf", "2026-08-15T00:00:00.000Z", "file-exacto-viejo"),
    makeFile(EXPECTED_STEM + " (1).pdf", "2026-08-21T00:00:00.000Z", "file-variante-nueva"),
  ]);
  assert.equal(r.found, true);
  assert.equal(r.fileId, "file-variante-nueva", "entre dos candidatos validos, el criterio de desempate es SIEMPRE la fecha de creacion mas reciente");
});

test("carpeta con MEZCLA de todos los casos a la vez: solo selecciona el correcto propio, ignora el resto", () => {
  const r = verify([
    makeFile(EXPECTED_STEM.replace("Actividad_311", "Actividad_312") + ".pdf", "2026-08-22T00:00:00.000Z"), // otra actividad, mas reciente
    makeFile(EXPECTED_STEM.replace("Guia_3_", "Guia_4_") + ".pdf", "2026-08-22T00:00:00.000Z"), // otra guia, mas reciente
    makeFile(EXPECTED_STEM.replace("Ana_Torres", "Carlos_Ruiz") + ".pdf", "2026-08-22T00:00:00.000Z"), // otro aprendiz, mas reciente
    makeFile(EXPECTED_STEM + ".pdf", "2026-08-18T00:00:00.000Z", "el-correcto"), // el propio, mas viejo que los anteriores
  ]);
  assert.equal(r.found, true);
  assert.equal(r.fileId, "el-correcto", "aunque los archivos ajenos sean mas recientes, nunca deben preferirse sobre el propio");
});

test("carpeta vacia o sin ningun candidato: found:false con mensaje claro, nunca confirma por defecto", () => {
  const r1 = verify([]);
  assert.equal(r1.found, false);
  assert.match(r1.message, /no encontramos/i);

  const r2 = verify([makeFile("documento_sin_relacion.pdf", "2026-08-20T00:00:00.000Z")]);
  assert.equal(r2.found, false);
});
