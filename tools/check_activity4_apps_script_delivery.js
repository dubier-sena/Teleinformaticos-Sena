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

const page10A = read(path.join("pages", "auxiliares", "grupo-10a-guia-02-actividad-4-formulario.html"));
const page10B = read(path.join("pages", "auxiliares", "grupo-10b-guia-02-actividad-4-formulario.html"));
const sharedDriveJs = read(path.join("js", "shared_drive_delivery.js"));
const guideCss = read(path.join("css", "guia_template.css"));

[page10A, page10B].forEach((pageContent, index) => {
  const label = index === 0 ? "10A" : "10B";
  assertIncludes(pageContent, "js/shared_drive_delivery.js?v=20260410_1", `helper compartido de entrega ${label}`);
  assertIncludes(pageContent, "js/script_guia2.js?v=20260416_1", `script compartido de Guia 2 ${label}`);
  assertIncludes(pageContent, "activity4_admin_report.js?v=", `reporte integrado ${label}`);
  assertIncludes(pageContent, "Abrir Google Forms", `acceso externo del formulario ${label}`);
  assertIncludes(pageContent, "Volver a la Guia 2", `enlace de retorno ${label}`);
});

assertIncludes(sharedDriveJs, "window.sharedDriveDelivery", "helper global de entrega en Drive");
assertIncludes(sharedDriveJs, "getActivityContextFromNode", "inferencia de contexto de actividad");
assertIncludes(sharedDriveJs, "appendDriveDeliveryPanels", "insercion de paneles de entrega");

assertIncludes(guideCss, ".btn-drive", "estilo de botones de acceso y entrega");

console.log("OK: la Actividad 4 mantiene acceso externo y carga el helper compartido de entrega en Drive.");
