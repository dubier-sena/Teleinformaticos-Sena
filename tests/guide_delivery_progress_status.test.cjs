const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("las entregas compartidas muestran un estado visible en la actividad", () => {
  const sharedDrive = read("js/shared_drive_delivery.js");

  assert.match(sharedDrive, /data-drive-delivery-status/);
  assert.match(sharedDrive, /function renderDeliveryStatus/);
  assert.match(sharedDrive, /Entrega registrada/);
  assert.match(sharedDrive, /document\.addEventListener\("guide-delivery-registered"/);
  assert.match(sharedDrive, /delivery-deadline-admin-slot/);
  assert.match(sharedDrive, /delivery-deadline-note-slot/);
  assert.match(sharedDrive, /applyDeliveryDeadlineState/);
});

test("la entrega segura notifica a la guia cuando el archivo queda registrado", () => {
  const sharedApps = read("js/shared_apps_script_delivery.js");

  assert.match(sharedApps, /function notifyDeliveryRegistered/);
  assert.match(sharedApps, /guide-delivery-registered/);
  assert.match(sharedApps, /response\.savedFileName/);
  assert.match(sharedApps, /response\.driveUrl/);
});

test("la plantilla de guia expone una forma compartida de marcar actividades completadas", () => {
  const template = read("js/guia_template.js");

  assert.match(template, /window\.setGuideActivitySeen = function \(activity, seen\)/);
  assert.match(template, /localStorage\.setItem\(activityStorageKey\(activityKey\), seen \? "1" : "0"\)/);
  assert.match(template, /notifyGuideProgressChanged\(\);/);
});

test("la guia de induccion ya no muestra el boton visible de guardar progreso", () => {
  const partial = read("partials/guia-01-induccion-content.html");

  assert.doesNotMatch(partial, /💾\s*Guardar progreso/);
});
