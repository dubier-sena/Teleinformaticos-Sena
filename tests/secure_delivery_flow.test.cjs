"use strict";
// Reemplaza cuatro checks de tooling (check_shared_drive_delivery.js,
// check_shared_apps_script_button.js, check_activity4_apps_script_delivery.js,
// check_apps_script_flat_delivery.js). Esos fallaban por clavar rutas de guías
// en la raíz (movidas a pages/guias/), versiones `?v=` concretas y un diseño de
// entrega "plana" que ya cambió (el .gs volvió a resolver carpeta destino). Aquí
// se conservan SOLO los invariantes vigentes del flujo de entrega compartido y
// sus controles de seguridad, asertando contenido de los JS/.gs (no versiones).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test("la utilidad compartida de entrega en Drive expone su API y se integra con el helper seguro", () => {
  const driveJs = read("js/shared_drive_delivery.js");
  assert.match(driveJs, /window\.sharedDriveDelivery = \{/);
  assert.match(driveJs, /appendDriveDeliveryPanels/);
  assert.match(driveJs, /getActivityContextFromNode/);
  assert.match(driveJs, /window\.sharedAppsScriptDelivery/);
});

test("las guías usan la utilidad compartida y no reimplementan el panel de Drive", () => {
  for (const file of ["js/script.js", "js/script_guia2.js", "js/script_guia6.js"]) {
    const js = read(file);
    assert.match(js, /window\.sharedDriveDelivery\?\.appendDriveDeliveryPanels/, `${file} debe usar el helper compartido`);
    assert.doesNotMatch(js, /function createDriveDeliveryPanel\(/, `${file} no debe conservar una copia local del panel`);
  }
  assert.match(read("css/guia_template.css"), /\.btn-drive/);
});

test("la entrega segura por Apps Script mantiene sus controles", () => {
  const helper = read("js/shared_apps_script_delivery.js");
  // Validación estricta de la URL del Web App + lista blanca de hosts.
  assert.match(helper, /isValidAppsScriptUrl/);
  assert.match(helper, /googleAppsScriptAllowedHosts/);
  assert.match(read("js/project_integrations.js"), /googleAppsScriptAllowedHosts/);
  // Modal compartido e inyección del botón seguro en bloques de entrega.
  assert.match(helper, /shared-apps-script-modal/);
  assert.match(helper, /injectButtonsIntoExistingGroups/);
  assert.match(helper, /btn-apps-script/);
  // Solo el aprendiz (sesión) puede entregar; vista previa del nombre final.
  assert.match(helper, /session\.role === "student"/);
  assert.match(helper, /buildDeliveryFileNamePreview/);
  // La Actividad 4 reutiliza el helper seguro en vez de duplicarlo.
  assert.match(read("js/activity_delivery.js"), /window\.sharedAppsScriptDelivery/);
});

test("el Apps Script de entregas valida tamaño, extensión y etiquetas", () => {
  const gs = read("apps-script/entregas_actividades.gs");
  assert.match(gs, /MAX_UPLOAD_BYTES/);
  assert.match(gs, /ALLOWED_EXTENSIONS/);
  assert.match(gs, /sanitizeLabel/);
  assert.match(gs, /buildDeliveryFileName/);
});
