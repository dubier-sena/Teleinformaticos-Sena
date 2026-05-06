const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadSharedDelivery(integrations = {}) {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );
  const sandbox = {
    URL,
    window: {
      PROJECT_INTEGRATIONS: integrations,
      addEventListener() {},
    },
    document: {
      addEventListener() {},
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  vm.runInNewContext(source, sandbox, { filename: "shared_apps_script_delivery.js" });
  return sandbox.window.sharedAppsScriptDelivery;
}

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

test("la validacion compartida rechaza archivos peligrosos aunque no haya lista por actividad", () => {
  const delivery = loadSharedDelivery({
    allowedUploadExtensions: [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp", ".pkt"],
    maxUploadBytes: 5 * 1024 * 1024,
  });

  assert.throws(
    () => delivery.validateFile({ name: "evidencia.html", size: 2000, type: "text/html" }, {}),
    /extension permitida|tipo de archivo/i
  );
  assert.throws(
    () => delivery.validateFile({ name: "captura.jpg.exe", size: 2000, type: "image/jpeg" }, {}),
    /extension permitida|tipo de archivo/i
  );
});

test("la validacion compartida aplica limite de tamano por actividad y tipo MIME de imagen", () => {
  const delivery = loadSharedDelivery({
    allowedUploadExtensions: [".png", ".jpg", ".jpeg", ".webp", ".pkt"],
    maxUploadBytes: 10 * 1024 * 1024,
  });

  assert.throws(
    () =>
      delivery.validateFile(
        { name: "captura.png", size: 6 * 1024 * 1024, type: "image/png" },
        { allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxUploadBytes: 5 * 1024 * 1024 }
      ),
    /tamano maximo/i
  );
  assert.throws(
    () =>
      delivery.validateFile(
        { name: "captura.png", size: 2000, type: "application/javascript" },
        { allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] }
      ),
    /tipo de archivo/i
  );
  assert.doesNotThrow(() =>
    delivery.validateFile(
      { name: "captura.webp", size: 2000, type: "image/webp" },
      { allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"], allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] }
    )
  );
});

test("las subidas directas de imagenes de redes usan la validacion compartida", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /validateRedesImageUpload/);
  assert.match(guideScript, /allowedMimeTypes:\s*\["image\/png",\s*"image\/jpeg",\s*"image\/webp"\]/);
  const directValidationCalls = guideScript.match(/validateRedesImageUpload\(delivery,\s*file\);/g) || [];
  assert.equal(directValidationCalls.length, 10);
});

test("el panel administrativo conserva la barrera de acceso admin", () => {
  const panel = fs.readFileSync(
    path.join(__dirname, "..", "panel-administrativo-usuarios.html"),
    "utf8"
  );

  assert.match(panel, /portalAuth\.requireAdminAccess\(\{\s*redirectUrl:\s*"index\.html"\s*\}\)/);
});
