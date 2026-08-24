"use strict";

// Fase 10 (auditoria profunda, 2026-08-23): lado Apps Script del fix de
// concurrencia. handleSet (respaldo_firestore.gs) hacia un reemplazo
// COMPLETO y ciego del archivo de respaldo en Drive -- si dos dispositivos
// caian a este mismo respaldo casi al mismo tiempo, el segundo en escribir
// borraba en silencio el campo que el primero ya habia guardado. Corregido:
// si el archivo YA existe y tanto el contenido actual como el entrante
// tienen `snapshotJson` (forma de progress/guide_state), se releen ambos y
// se combinan con gsMergeGuideDataSnapshotForSave (puerto exacto de
// mergeGuideDataSnapshotForSave, ver js/firebase_db.js) antes de escribir.
//
// Este archivo EJECUTA doPost de verdad (vm, con DriveApp/UrlFetchApp
// simulados), igual que tests/entregas_actividades_identity_security.test.cjs.
// El lado cliente (tryFirestorePromote) tiene su propio archivo:
// tests/drive_fallback_concurrency.test.cjs.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(
  path.join(__dirname, "..", "apps-script", "respaldo_firestore.gs"),
  "utf8"
);

// Filesystem falso de UNA sola carpeta de coleccion (suficiente para probar
// handleSet: get-existente / crear-nuevo / actualizar-contenido).
function makeFakeDrive() {
  const collectionFiles = new Map(); // fileName -> content string

  const collectionFolder = {
    getFilesByName: function (name) {
      const exists = collectionFiles.has(name);
      return {
        hasNext: function () { return exists; },
        next: function () {
          return {
            getBlob: function () {
              return { getDataAsString: function () { return collectionFiles.get(name); } };
            },
            setContent: function (newContent) { collectionFiles.set(name, newContent); },
            getId: function () { return "file-" + name; },
          };
        },
      };
    },
    createFile: function (blob) {
      collectionFiles.set(blob.getName(), blob.getDataAsString());
      return { getId: function () { return "file-" + blob.getName(); } };
    },
  };

  const rootFolder = {
    getFoldersByName: function () {
      return { hasNext: function () { return true; }, next: function () { return collectionFolder; } };
    },
    createFolder: function () { return collectionFolder; },
  };

  return {
    driveApp: { getFolderById: function () { return rootFolder; } },
    files: collectionFiles,
  };
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
      newBlob: function (content, mime, name) {
        return { getName: function () { return name; }, getDataAsString: function () { return content; } };
      },
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
            getContentText: function () {
              return JSON.stringify({ users: [{ email: identityEmail, localId: uid || "" }] });
            },
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

const DOC_ID = "__guide_data__:uid:uid-ana:archivo";

// sanitizeDocId (respaldo_firestore.gs) recorta guiones bajos al INICIO del
// docId antes de usarlo como nombre de archivo -- irrelevante para lo que
// este archivo prueba (el merge), asi que en vez de replicar esa
// sanitizacion se toma directamente el unico archivo que quedo guardado.
function onlySavedFile(drive) {
  const values = Array.from(drive.files.values());
  assert.equal(values.length, 1, "se esperaba exactamente un archivo guardado en el fake Drive");
  return JSON.parse(values[0]);
}

function snapshotPayload(state, updatedAt) {
  return { scopeKey: "student:ana", fileName: "archivo", updatedAt: updatedAt, snapshotJson: JSON.stringify({ state: state, updatedAt: updatedAt }) };
}

test("handleSet: archivo NUEVO se crea tal cual, sin necesidad de merge (nada que combinar)", () => {
  const drive = makeFakeDrive();
  const sandbox = makeSandbox("ana@sena-portal.local", drive, "uid-ana");
  const response = callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_progress", docId: DOC_ID,
    data: snapshotPayload({ campoA: "de A" }, "2026-08-23T10:00:00.000Z"),
  });
  assert.equal(response.ok, true);
  assert.equal(response.action, "created");
  const saved = onlySavedFile(drive);
  assert.equal(JSON.parse(saved.data.snapshotJson).state.campoA, "de A");
});

test("handleSet: SEGUNDA escritura (archivo ya existe) combina Campo A existente + Campo B entrante, no reemplaza a ciegas", () => {
  const drive = makeFakeDrive();
  const sandbox = makeSandbox("ana@sena-portal.local", drive, "uid-ana");

  // Primera escritura ("dispositivo A"): Campo A.
  callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_progress", docId: DOC_ID,
    data: snapshotPayload({ campoA: "de A" }, "2026-08-23T10:00:00.000Z"),
  });

  // Segunda escritura ("dispositivo B", mismo docId, archivo YA existe):
  // Campo B, SIN incluir campoA en su propio snapshot (B nunca lo vio).
  const response = callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_progress", docId: DOC_ID,
    data: snapshotPayload({ campoB: "de B" }, "2026-08-23T10:00:05.000Z"),
  });

  assert.equal(response.ok, true);
  assert.equal(response.action, "updated");
  const saved = onlySavedFile(drive);
  const finalState = JSON.parse(saved.data.snapshotJson).state;
  assert.equal(finalState.campoA, "de A", "el campo de la primera escritura NO debe perderse (antes del fix, se perdia)");
  assert.equal(finalState.campoB, "de B", "el campo de la segunda escritura debe estar presente");
});

test("handleSet: MISMO campo en dos escrituras sucesivas -- gana la mas reciente por timestamp", () => {
  const drive = makeFakeDrive();
  const sandbox = makeSandbox("ana@sena-portal.local", drive, "uid-ana");

  callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_progress", docId: DOC_ID,
    data: snapshotPayload({ campoCompartido: "version vieja" }, "2026-08-23T10:00:00.000Z"),
  });
  callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_progress", docId: DOC_ID,
    data: snapshotPayload({ campoCompartido: "version nueva" }, "2026-08-23T10:00:10.000Z"),
  });

  const saved = onlySavedFile(drive);
  assert.equal(JSON.parse(saved.data.snapshotJson).state.campoCompartido, "version nueva");
});

test("handleSet: colecciones SIN snapshotJson conservan el comportamiento anterior (reemplazo directo)", () => {
  const drive = makeFakeDrive();
  const sandbox = makeSandbox("dubier@sena-portal.local", drive);
  const docId = "algun-doc-generico";

  callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_calendar", docId: docId,
    data: { campoViejo: "x", updatedAt: "2026-08-23T10:00:00.000Z" },
  });
  const response = callDoPost(sandbox, {
    idToken: "tok", action: "set", collection: "sena_portal_calendar", docId: docId,
    data: { campoNuevo: "y", updatedAt: "2026-08-23T10:00:05.000Z" },
  });

  assert.equal(response.ok, true);
  const saved = onlySavedFile(drive);
  assert.equal(saved.data.campoNuevo, "y");
  assert.equal(saved.data.campoViejo, undefined, "sin snapshotJson, el comportamiento (reemplazo completo) no cambia -- este test documenta que la mejora es especifica a snapshots de guia");
});
