const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("el Apps Script enruta las entregas por guia y actividad dentro de la ficha", () => {
  const appsScript = fs.readFileSync(
    path.join(__dirname, "..", "apps-script", "entregas_actividades.gs"),
    "utf8"
  );

  assert.match(appsScript, /resolveTargetFolder/);
  assert.match(appsScript, /ensureFolderByName/);
  assert.match(appsScript, /buildGuideFolderName/);
  assert.match(appsScript, /buildActivityFolderName/);
  assert.match(appsScript, /destination\.folder\.createFile\(blob\)/);
  assert.match(appsScript, /folderPath:\s*destination\.folderPath/);
});

test("la entrega segura muestra la ruta prevista por ficha, guia y actividad", () => {
  const sharedDelivery = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );

  assert.match(sharedDelivery, /buildDestinationFolderPreview/);
  assert.match(sharedDelivery, /buildGuideFolderLabel/);
  assert.match(sharedDelivery, /buildActivityFolderLabel/);
  assert.match(sharedDelivery, /carpeta correspondiente de la ficha/i);
  assert.match(sharedDelivery, /response\.folderPath/);
});

test("el ejercicio 4 limpia la copia local cuando Drive confirma el pantallazo", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /delete state\["ej4-captura"\]/);
  assert.match(guideScript, /state\["ej4-captura-url"\]\s*=\s*response\.driveUrl/);
});

test("los laboratorios de redes pueden entregar archivos .pkt en la integracion segura", () => {
  const integrationsScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "project_integrations.js"),
    "utf8"
  );
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(integrationsScript, /allowedUploadExtensions:\s*\[[\s\S]*"\.pkt"/);
  assert.match(guideScript, /subirEntregaFinalLab1[\s\S]*allowedExtensions:\s*\["\.pkt"\]/);
  assert.match(guideScript, /subirEntregaFinalLab2[\s\S]*allowedExtensions:\s*\["\.pkt"\]/);
  assert.match(guideScript, /subirEntregaFinalLab3[\s\S]*allowedExtensions:\s*\["\.pkt"\]/);
});
