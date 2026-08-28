"use strict";

// Bloque G (auditoria 2026-08-27, caso Michell Sofia Avila + idempotencia).
// Ejecuta de verdad entregas_actividades.gs (via vm, con DriveApp/Firestore
// simulados) contra un nombre con tildes reales, y contra dos llamadas de
// "upload" con el MISMO submissionId.
//
// IMPORTANTE: estos dos cambios (sanitizeFileSegment con NFD +
// findFileBySubmissionId) estan hechos SOLO en el archivo local del repo.
// NO se han desplegado al Apps Script real (ver informe, seccion G.4/anexo
// de cambios pendientes) -- por diseno, este test corre contra el .gs local,
// no contra produccion.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "entregas_actividades.gs"),
  "utf8"
);

const FICHA = "3441939";
const FULL_NAME = "Michell Sofía Ávila";

function makeFile(name) {
  makeFile._n = (makeFile._n || 0) + 1;
  const id = "file-" + makeFile._n;
  let description = "";
  const createdAt = new Date("2026-08-27T12:00:00.000Z");
  return {
    getName: () => name,
    getUrl: () => "https://drive/fake/" + id,
    getId: () => id,
    getDateCreated: () => createdAt,
    setDescription: (d) => { description = d; },
    getDescription: () => description,
  };
}

function makeFolder() {
  const files = [];
  const subfolders = {};
  const folder = {
    getFoldersByName: function (name) {
      const existing = subfolders[name];
      const list = existing ? [existing] : [];
      let i = 0;
      return { hasNext: () => i < list.length, next: () => list[i++] };
    },
    createFolder: function (name) {
      if (!subfolders[name]) subfolders[name] = makeFolder();
      return subfolders[name];
    },
    createFile: function (blob) {
      const file = makeFile(blob.getName());
      files.push(file);
      return file;
    },
    getFiles: function () {
      let i = 0;
      return { hasNext: () => i < files.length, next: () => files[i++] };
    },
    _files: files,
    _subfolders: subfolders,
  };
  return folder;
}

function makeSandbox() {
  const rootFolder = makeFolder();
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: {
      getScriptProperties: function () {
        return { getProperty: (name) => (name === "FIREBASE_API_KEY" ? "fake-api-key" : "") };
      },
    },
    CacheService: {
      getScriptCache: function () {
        const store = {};
        return {
          get: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
          put: (k, v) => { store[k] = v; },
        };
      },
    },
    Utilities: {
      base64Decode: (b64) => Buffer.from(String(b64 || ""), "base64"),
      newBlob: (bytes, mime, name) => ({ getName: () => name, getBytes: () => bytes }),
      computeDigest: () => [1, 2, 3],
      base64EncodeWebSafe: () => "digest",
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
    DriveApp: { getFolderById: () => rootFolder },
    ContentService: {
      createTextOutput: (text) => ({ setMimeType: () => ({ getContent: () => text }) }),
      MimeType: { JSON: "JSON" },
    },
    UrlFetchApp: {
      fetch: function (url) {
        if (url.indexOf("identitytoolkit.googleapis.com") >= 0) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({ users: [{ email: "michell.sofia.avila@sena-portal.local", localId: "uid-michell" }] }),
          };
        }
        if (url.indexOf("sena_portal_users") >= 0) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({ fields: { ficha: { stringValue: FICHA }, fullName: { stringValue: FULL_NAME } } }),
          };
        }
        throw new Error("URL no simulada: " + url);
      },
    },
  };
  sandbox.ROOT_FOLDER = rootFolder;
  vm.createContext(sandbox);
  vm.runInContext(
    gsSource +
      "\nthis.__doPost = doPost;" +
      "\nthis.__sanitizeFileSegment = sanitizeFileSegment;" +
      "\nthis.__buildDeliveryFileNameStem = buildDeliveryFileNameStem;",
    sandbox
  );
  return sandbox;
}

function callDoPost(sandbox, payload) {
  return JSON.parse(sandbox.__doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());
}

// ── NFD (caso Michell Sofia Avila) ─────────────────────────────────────────

test("sanitizeFileSegment normaliza tildes/ene en vez de eliminar la vocal entera (Bloque G)", () => {
  const sandbox = makeSandbox();
  assert.strictEqual(sandbox.__sanitizeFileSegment("Sofía", "x"), "Sofia");
  assert.strictEqual(sandbox.__sanitizeFileSegment("Ávila", "x"), "Avila");
  assert.strictEqual(sandbox.__sanitizeFileSegment("Peña Núñez", "x"), "Pena_Nunez");
  // Antes del fix esto daba "Sof_a" / "_vila" -- se pierde la vocal entera,
  // no solo la tilde.
  assert.doesNotMatch(sandbox.__sanitizeFileSegment("Sofía", "x"), /_/);
});

test("buildDeliveryFileNameStem para 'Michell Sofía Ávila' coincide con lo que el CLIENTE ya sugiere (mismo criterio que sanitizeSegment del cliente)", () => {
  const sandbox = makeSandbox();
  const stem = sandbox.__buildDeliveryFileNameStem(FULL_NAME, FICHA, "Actividad 3.1.1", {
    guideNumber: "3",
    activityNumber: "3.1.1",
    shortName: "Bitacora",
  });
  assert.strictEqual(stem, "Guia_3_Actividad_311_Bitacora_3441939_Michell_Sofia_Avila");
});

test("Bloque G: handleVerifyDelivery ahora SI encuentra el archivo subido manualmente con el nombre que el cliente sugirio (antes buscaba un stem distinto)", () => {
  const sandbox = makeSandbox();
  // El cliente (sanitizeSegment, activity_standard.js) SI normalizaba bien:
  // el aprendiz sube el archivo con el nombre "correcto" sugerido.
  const stemQueClienteSugirio = "Guia_3_Actividad_311_Bitacora_3441939_Michell_Sofia_Avila";
  sandbox.ROOT_FOLDER.createFolder("3.1.1").createFile({ getName: () => stemQueClienteSugirio + ".pdf" });

  const result = callDoPost(sandbox, {
    idToken: "token-michell",
    action: "verify",
    ficha: FICHA,
    fullName: FULL_NAME,
    activityLabel: "Actividad 3.1.1",
    guideNumber: "3",
    activityNumber: "3.1.1",
    shortName: "Bitacora",
  });
  assert.strictEqual(result.found, true, "con el fix NFD, el stem que calcula el servidor debe coincidir con el que el cliente sugirio");
  assert.strictEqual(result.savedFileName, stemQueClienteSugirio + ".pdf");
});

// ── Idempotencia (Bloque G) ─────────────────────────────────────────────────

function uploadPayload(overrides) {
  return Object.assign(
    {
      idToken: "token-michell",
      action: "upload",
      ficha: FICHA,
      fullName: FULL_NAME,
      activityLabel: "Actividad 3.1.1",
      guideNumber: "3",
      activityNumber: "3.1.1",
      shortName: "Bitacora",
      fileName: "evidencia.py",
      mimeType: "text/plain",
      fileBase64: Buffer.from("print('hola')").toString("base64"),
    },
    overrides || {}
  );
}

test("idempotencia: dos llamadas de upload con el MISMO submissionId no crean un archivo duplicado", () => {
  const sandbox = makeSandbox();
  const payload = uploadPayload({ submissionId: "sub-fixed-123" });

  const r1 = callDoPost(sandbox, payload);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.idempotentReplay, undefined, "la primera vez debe crear el archivo de verdad, no reportarse como replay");

  const r2 = callDoPost(sandbox, payload);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.idempotentReplay, true, "el reintento con el mismo submissionId debe reusar el archivo existente");
  assert.strictEqual(r2.fileId, r1.fileId, "debe devolver el MISMO archivo, no uno nuevo");
  assert.strictEqual(r2.driveUrl, r1.driveUrl);

  const activityFolder = sandbox.ROOT_FOLDER._subfolders["3.1.1"];
  assert.strictEqual(activityFolder._files.length, 1, "solo debe existir 1 archivo real en Drive, no 2, tras el reintento");
});

test("idempotencia: dos entregas con submissionId DISTINTO (dos actividades/archivos reales) SI crean dos archivos", () => {
  const sandbox = makeSandbox();
  const r1 = callDoPost(sandbox, uploadPayload({ submissionId: "sub-aaa" }));
  const r2 = callDoPost(sandbox, uploadPayload({ submissionId: "sub-bbb" }));
  assert.notStrictEqual(r1.fileId, r2.fileId, "submissionId distinto debe ser tratado como una entrega logica distinta");
  const activityFolder = sandbox.ROOT_FOLDER._subfolders["3.1.1"];
  assert.strictEqual(activityFolder._files.length, 2);
});

test("idempotencia: sin submissionId (payload legado/cliente viejo), el comportamiento previo se conserva sin errores", () => {
  const sandbox = makeSandbox();
  const r1 = callDoPost(sandbox, uploadPayload({ submissionId: undefined }));
  const r2 = callDoPost(sandbox, uploadPayload({ submissionId: undefined }));
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r1.idempotentReplay, undefined);
  assert.strictEqual(r2.idempotentReplay, undefined, "sin submissionId no hay forma de detectar el duplicado -- comportamiento previo, no una regresion nueva");
  const activityFolder = sandbox.ROOT_FOLDER._subfolders["3.1.1"];
  assert.strictEqual(activityFolder._files.length, 2, "sin submissionId, cada llamada sigue creando su propio archivo, como antes de este cambio");
});
