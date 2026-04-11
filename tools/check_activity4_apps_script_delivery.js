const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

const page10A = read("grupo-10a-guia-02-actividad-4-formulario.html");
const page10B = read("grupo-10b-guia-02-actividad-4-formulario.html");
const deliveryJs = read(path.join("js", "activity_delivery.js"));
const configJs = read(path.join("js", "project_integrations.js"));
const guideCss = read(path.join("css", "guia_template.css"));

[page10A, page10B].forEach((pageContent, index) => {
  const label = index === 0 ? "10A" : "10B";
  assertIncludes(pageContent, 'data-activity-delivery="guia2-actividad4"', `panel de entrega ${label}`);
  assertIncludes(pageContent, "js/project_integrations.js?v=20260411_1", `config de integraciones ${label}`);
  assertIncludes(pageContent, "js/shared_apps_script_delivery.js?v=20260411_1", `helper seguro ${label}`);
  assertIncludes(pageContent, "js/activity_delivery.js?v=20260411_1", `script de entrega ${label}`);
  assertIncludes(pageContent, "Entregar actividad", `boton de entrega ${label}`);
});

assertIncludes(configJs, "googleAppsScriptUrl", "url configurable de Apps Script");
assertIncludes(configJs, "window.PROJECT_INTEGRATIONS", "objeto global de integraciones");

assertIncludes(deliveryJs, "uploadDeliveryToAppsScript", "envio de archivo al Apps Script");
assertIncludes(deliveryJs, "readFileAsBase64", "lectura del archivo antes del envio");
assertIncludes(deliveryJs, 'guideLabel: "Guia 2"', "metadatos de guia");
assertIncludes(deliveryJs, 'activityLabel: "Actividad 4"', "metadatos de actividad");
assertIncludes(deliveryJs, "Ficha ", "ruta por ficha");
assertIncludes(deliveryJs, "actividad4:nombre_completo", "reuso del nombre del aprendiz");
assertIncludes(deliveryJs, "actividad4:ficha", "reuso de la ficha del aprendiz");

assertIncludes(guideCss, ".delivery-upload-card", "estilos del panel de entrega");
assertIncludes(guideCss, ".delivery-upload-status", "estado visual de la entrega");

console.log("OK: la Actividad 4 cuenta con entrega por formulario propio y Apps Script configurable.");
