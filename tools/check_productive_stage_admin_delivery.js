const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pageHtml = fs.readFileSync(path.join(root, "etapa-productiva-admin.html"), "utf8");
const pageJs = fs.readFileSync(path.join(root, "js", "productive_stage_admin.js"), "utf8");
const pageCss = fs.readFileSync(path.join(root, "css", "page_productive_stage_admin.css"), "utf8");

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(
  pageHtml,
  'src="js/project_integrations.js?v=20260411_1"',
  "integraciones del proyecto para subir avances desde etapa productiva admin"
);
assertIncludes(
  pageHtml,
  'src="js/shared_apps_script_delivery.js?v=20260411_1"',
  "utilidad compartida de entrega segura para etapa productiva admin"
);
assertIncludes(
  pageJs,
  "handleProductiveStageDeliverySubmit",
  "handler de subida de avance desde la vista administrativa"
);
assertIncludes(
  pageJs,
  'id="productive-stage-delivery-student"',
  "selector del integrante que registra el avance"
);
assertIncludes(
  pageJs,
  "store.getProjectDeliveries",
  "lectura del historial de avances del proyecto"
);
assertIncludes(
  pageJs,
  "sharedDelivery.uploadToAppsScript",
  "subida segura del avance desde admin"
);
assertIncludes(
  pageCss,
  ".productive-stage-delivery-card",
  "estilos de la tarjeta de avances en la vista administrativa"
);
assertIncludes(
  pageCss,
  ".productive-stage-delivery-history",
  "estilos del historial de avances en la vista administrativa"
);

console.log("OK: la pagina administrativa de etapa productiva incluye carga y seguimiento de avances por proyecto.");
