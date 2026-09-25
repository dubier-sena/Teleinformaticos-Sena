"use strict";

// Etapa Productiva, 2026-09-25: el aprendiz nunca veia su proyecto vinculado.
// Causa: handleStudentProductiveStageView (apps-script/respaldo_firestore.gs)
// leia la replica de sena_portal_guide_state y esperaba el catalogo YA
// expandido, pero el panel admin guarda en sena_portal_progress con el
// formato { snapshotJson: "<json>" } (ver saveGuideStateDoc en
// js/firebase_db.js). El test anterior (apps_script_productive_stage_privacy)
// no podia verlo: su Drive falso devuelve la MISMA carpeta para cualquier
// coleccion y siembra el catalogo expandido. Aqui cada coleccion es una
// carpeta distinta y el catalogo tiene el formato REAL que escribe el admin.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gsSource = fs.readFileSync(path.join(__dirname, "..", "apps-script", "respaldo_firestore.gs"), "utf8");
const CATALOG_FILE_NAME = "guide_data__:admin:productive-stage:productive-stage-catalog.json";
const DOC_ID = "__guide_data__:admin:productive-stage:productive-stage-catalog";

function makeFolder(files) {
  return {
    getFilesByName: function (name) {
      const exists = files.has(name);
      return {
        hasNext: function () { return exists; },
        next: function () { return { getBlob: function () { return { getDataAsString: function () { return files.get(name); } }; } }; },
      };
    },
  };
}

// collections: { [nombreColeccion]: dataDelDoc }
function makeDrive(collections) {
  const folders = {};
  Object.keys(collections).forEach(function (name) {
    const files = new Map();
    files.set(CATALOG_FILE_NAME, JSON.stringify({ collection: name, docId: DOC_ID, data: collections[name], savedAt: "2026-09-20T00:00:00.000Z" }));
    folders[name] = makeFolder(files);
  });
  return {
    getFolderById: function () {
      return {
        getFoldersByName: function (name) {
          const folder = folders[name];
          return { hasNext: function () { return Boolean(folder); }, next: function () { return folder; } };
        },
      };
    },
  };
}

function makeSandbox(email, driveApp, attestedVersions) {
  const sandbox = {
    console,
    Logger: { log: function () {} },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function (n) { return n === "FIREBASE_API_KEY" ? "k" : n === "BACKUP_ROOT_FOLDER_ID" ? "root" : n === "FIREBASE_PROJECT_ID" ? "sena-portal" : ""; } }; } },
    CacheService: { getScriptCache: function () { const st = {}; return { get: function (k) { return st[k] || null; }, put: function (k, v) { st[k] = v; } }; } },
    Utilities: {
      newBlob: function (c, m, n) { return { getName: function () { return n; }, getDataAsString: function () { return c; } }; },
      base64EncodeWebSafe: function () { return "digest"; },
      computeDigest: function () { return [1]; },
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
    DriveApp: driveApp,
    ContentService: { createTextOutput: function (t) { return { setMimeType: function () { return { getContent: function () { return t; } }; } }; }, MimeType: { JSON: "JSON" } },
    UrlFetchApp: {
      fetch: function (url) {
        if (url.indexOf("identitytoolkit.googleapis.com") >= 0) {
          return { getResponseCode: function () { return 200; }, getContentText: function () { return JSON.stringify({ users: [{ email: email, localId: "uid" }] }); } };
        }
        // Version de cuenta ATESTADA por el admin (sena_portal_user_meta/{key}).
        const meta = url.match(/sena_portal_user_meta\/([^?]+)/);
        if (meta) {
          const v = (attestedVersions || {})[decodeURIComponent(meta[1])];
          return v
            ? { getResponseCode: function () { return 200; }, getContentText: function () { return JSON.stringify({ fields: { authEmailVersion: { integerValue: String(v) } } }); } }
            : { getResponseCode: function () { return 404; }, getContentText: function () { return "{}"; } };
        }
        throw new Error("URL no simulada: " + url);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(gsSource, sandbox);
  return sandbox;
}

function view(email, driveApp, attestedVersions) {
  const sandbox = makeSandbox(email, driveApp, attestedVersions);
  return JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify({ idToken: "tok", action: "studentProductiveStageView" }) } }).getContent());
}

const CATALOG_NUEVO = {
  schemaVersion: 2,
  updatedAt: "2026-09-20T00:00:00.000Z",
  projects: [
    { id: "p-nuevo", projectTitle: "Proyecto vinculado en septiembre", studentUsernameKeys: ["ana.lopez"] },
    { id: "p-otro", projectTitle: "Proyecto ajeno", studentUsernameKeys: ["beto.perez"] },
  ],
  deliveries: [{ deliveryId: "d1", projectId: "p-nuevo" }, { deliveryId: "d2", projectId: "p-otro" }],
  documentDeadlines: { "bitacora-6": { dueAt: "2026-10-23T23:59:00-05:00" } },
  documentDeliveries: [],
  reports: [],
};
// Formato REAL que escribe el admin (saveGuideStateDoc -> progressPayload).
const progressPayload = (catalog) => ({
  _usernameKey: DOC_ID, usernameKey: DOC_ID, _kind: "guide-data",
  scopeKey: "admin:productive-stage", fileName: "productive-stage-catalog",
  updatedAt: catalog.updatedAt, snapshotJson: JSON.stringify(catalog),
});

test("catalogo real (sena_portal_progress + snapshotJson): el aprendiz VE su proyecto vinculado", () => {
  const res = view("ana.lopez@sena-portal.local", makeDrive({ sena_portal_progress: progressPayload(CATALOG_NUEVO) }));
  assert.equal(res.ok, true);
  assert.equal(res.found, true);
  assert.equal(JSON.stringify(res.data.projects.map((p) => p.id)), JSON.stringify(["p-nuevo"]));
  assert.equal(JSON.stringify(res.data.deliveries.map((d) => d.deliveryId)), JSON.stringify(["d1"]));
  assert.equal(res.data.documentDeadlines["bitacora-6"].dueAt, "2026-10-23T23:59:00-05:00");
});

test("privacidad intacta con el formato real: nunca aparece el proyecto de otro equipo", () => {
  const res = view("ana.lopez@sena-portal.local", makeDrive({ sena_portal_progress: progressPayload(CATALOG_NUEVO) }));
  assert.ok(!res.data.projects.some((p) => p.id === "p-otro"));
  assert.ok(!res.data.deliveries.some((d) => d.projectId === "p-otro"));
});

test("si existen ambas replicas gana sena_portal_progress (la actual), no la copia legado", () => {
  const legado = Object.assign({}, CATALOG_NUEVO, { projects: [], updatedAt: "2026-07-01T00:00:00.000Z" });
  const res = view("ana.lopez@sena-portal.local", makeDrive({
    sena_portal_progress: progressPayload(CATALOG_NUEVO),
    sena_portal_guide_state: legado,
  }));
  assert.equal(res.data.projects.length, 1);
});

test("compatibilidad: si solo existe la copia legado (expandida) se sigue leyendo", () => {
  const res = view("ana.lopez@sena-portal.local", makeDrive({ sena_portal_guide_state: CATALOG_NUEVO }));
  assert.equal(res.found, true);
  assert.equal(res.data.projects[0].id, "p-nuevo");
});

test("sin catalogo en ninguna coleccion -> ok:true found:false (sin proyecto, no error)", () => {
  const res = view("ana.lopez@sena-portal.local", makeDrive({}));
  assert.equal(res.ok, true);
  assert.equal(res.found, false);
});

test("snapshotJson corrupto -> ok:false (error, NUNCA 'sin proyecto')", () => {
  const res = view("ana.lopez@sena-portal.local", makeDrive({ sena_portal_progress: { snapshotJson: "{no es json" } }));
  assert.equal(res.ok, false);
});

// ── Seguridad: cuentas versionadas (.vN) ────────────────────────────────────
// Misma regla que authorizeRequest: "victima.v2@..." solo vale si el admin
// atesto la version 2 para "victima" (reset de password real). Una cuenta
// .vN creada por cualquiera en Firebase Auth NO debe ver los datos ajenos.

test("seguridad: cuenta .v2 creada por un tercero SIN atestacion -> rechazada, sin datos de la victima", () => {
  const res = view("ana.lopez.v2@sena-portal.local", makeDrive({ sena_portal_progress: progressPayload(CATALOG_NUEVO) }), {});
  assert.equal(res.ok, false);
  assert.equal(res.data, undefined);
  assert.match(res.message, /no atestada/);
});

test("seguridad: cuenta .v2 LEGITIMA (version atestada 2) ve SU proyecto", () => {
  const res = view("ana.lopez.v2@sena-portal.local", makeDrive({ sena_portal_progress: progressPayload(CATALOG_NUEVO) }), { "ana.lopez": 2 });
  assert.equal(res.ok, true);
  assert.equal(res.data.projects[0].id, "p-nuevo");
});

test("seguridad: version .v3 cuando la atestada es 2 -> rechazada", () => {
  const res = view("ana.lopez.v3@sena-portal.local", makeDrive({ sena_portal_progress: progressPayload(CATALOG_NUEVO) }), { "ana.lopez": 2 });
  assert.equal(res.ok, false);
});
