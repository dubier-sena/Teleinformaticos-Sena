"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("el panel administrativo carga despues de sus dependencias diferidas", () => {
  const html = read("etapa-productiva-admin.html");
  assert.match(
    html,
    /<script defer src="js\/productive_stage_store\.js\?v=[^"]+"><\/script>/
  );
  assert.match(
    html,
    /<script defer src="js\/productive_stage_admin\.js\?v=[^"]+"><\/script>/
  );
  assert.ok(
    html.indexOf("js/productive_stage_store.js") < html.indexOf("js/productive_stage_admin.js"),
    "el store debe cargarse antes que el controlador administrativo"
  );
});

test("el control administrativo conecta tabla, filtros y modal manual", () => {
  const html = read("etapa-productiva-admin.html");
  const code = read("js/productive_stage_admin.js");

  [
    "document-delivery-control-table",
    "document-delivery-control-query",
    "document-delivery-control-only-pending",
    "document-delivery-manual-modal",
    "document-delivery-manual-url",
    "document-delivery-manual-submit",
  ].forEach((id) => assert.match(html, new RegExp('id="' + id + '"')));

  assert.match(code, /function renderDocumentDeliveryControl\(\)/);
  assert.match(code, /function openDocumentDeliveryManualModal\(usernameKey, documentId\)/);
  assert.match(code, /function handleManualDocumentDeliverySubmit\(\)/);
  assert.match(code, /appendDocumentDeliveryToSnapshot\(productiveStageSnapshot/);
  assert.match(code, /store\.saveSnapshot\(nextSnapshot\)/);
  assert.match(code, /drive\.google\.com/);
});

test("el catalogo administrativo cubre los mismos 9 documentos entregables", () => {
  const code = read("js/productive_stage_admin.js");
  const expectedIds = [
    "ficha-inscripcion",
    "acuerdo",
    "sofia-plus",
    "bitacora-1",
    "bitacora-2",
    "bitacora-3",
    "bitacora-4",
    "bitacora-5",
    "bitacora-6",
  ];

  expectedIds.forEach((id) => {
    assert.match(code, new RegExp('id: "' + id + '"'));
  });
  assert.equal(
    (code.match(/\{ id: "(?:ficha-inscripcion|acuerdo|sofia-plus|bitacora-[1-6])"/g) || []).length,
    9
  );
});

test("el store normaliza la identidad y actualiza sin duplicar", () => {
  const store = require("../js/productive_stage_store.js");
  let snapshot = store.createEmptySnapshot();

  snapshot = store.appendDocumentDeliveryToSnapshot(snapshot, {
    usernameKey: "  APRENDIZ.Uno ",
    docId: "bitacora-1",
    driveUrl: "https://drive.google.com/file/d/uno/view",
  });
  snapshot = store.appendDocumentDeliveryToSnapshot(snapshot, {
    usernameKey: "aprendiz.uno",
    docId: "bitacora-1",
    driveUrl: "https://drive.google.com/file/d/dos/view",
  });

  assert.equal(snapshot.documentDeliveries.length, 1);
  assert.equal(snapshot.documentDeliveries[0].usernameKey, "aprendiz.uno");
  assert.equal(snapshot.documentDeliveries[0].driveUrl, "https://drive.google.com/file/d/dos/view");
  assert.equal(
    store.getDocumentDeliveriesByUsername(snapshot)["aprendiz.uno"]["bitacora-1"].driveUrl,
    "https://drive.google.com/file/d/dos/view"
  );
});
