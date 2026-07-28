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
    "acuerdo-etapa-productiva",
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
    (code.match(/\{ id: "(?:ficha-inscripcion|acuerdo-etapa-productiva|sofia-plus|bitacora-[1-6])"/g) || []).length,
    9
  );
});

// El id es la clave real con la que se cruzan las entregas (docId escrito por
// syncDocumentDeliveryToCloud en productive_stage_project_delivery.js). Si estos
// dos catalogos se desincronizan, la columna correspondiente en el panel admin
// queda mostrando "Pendiente" para siempre aunque el aprendiz si haya entregado
// (paso exactamente con "acuerdo" vs "acuerdo-etapa-productiva").
test("los ids del catalogo administrativo coinciden EXACTAMENTE con los ids reales de PROJECT_DOCUMENTS", () => {
  const adminCode = read("js/productive_stage_admin.js");
  const deliveryCode = read("js/productive_stage_project_delivery.js");

  const catalogMatch = adminCode.match(/const DOCUMENT_CATALOG = (\[[\s\S]*?\n  \]);/);
  assert.ok(catalogMatch, "no se encontro DOCUMENT_CATALOG en productive_stage_admin.js");
  const adminCatalog = new Function("return (" + catalogMatch[1] + ");")();

  const docsMatch = deliveryCode.match(/const PROJECT_DOCUMENTS = (\[[\s\S]*?\n  \]);/);
  assert.ok(docsMatch, "no se encontro PROJECT_DOCUMENTS en productive_stage_project_delivery.js");
  const realDocsWithDelivery = new Function("return (" + docsMatch[1] + ");")().filter(
    (d) => d.deliveryLabel
  );

  // Las bitacoras se agregan via push() en un for (fuera del literal), asi que
  // no aparecen en realDocsWithDelivery -- se verifican aparte por patron.
  const staticExpected = realDocsWithDelivery.map((d) => ({ id: d.id, deliveryLabel: d.deliveryLabel }));
  staticExpected.forEach((expected) => {
    const found = adminCatalog.find((item) => item.deliveryLabel === expected.deliveryLabel);
    assert.ok(found, `DOCUMENT_CATALOG no tiene ninguna entrada con deliveryLabel "${expected.deliveryLabel}"`);
    assert.equal(
      found.id,
      expected.id,
      `DOCUMENT_CATALOG tiene id "${found.id}" para "${expected.deliveryLabel}", pero PROJECT_DOCUMENTS usa "${expected.id}"`
    );
  });

  assert.match(deliveryCode, /id: "bitacora-" \+ i/, "el patron de id de bitacoras cambio, revisar el catalogo admin");
  for (let i = 1; i <= 6; i++) {
    const found = adminCatalog.find((item) => item.id === "bitacora-" + i);
    assert.ok(found, `DOCUMENT_CATALOG no tiene la bitacora ${i} (id "bitacora-${i}")`);
  }
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
