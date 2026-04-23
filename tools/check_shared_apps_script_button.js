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

const helperJs = read(path.join("js", "shared_apps_script_delivery.js"));
const sharedDriveJs = read(path.join("js", "shared_drive_delivery.js"));
const integrationsJs = read(path.join("js", "project_integrations.js"));
const activityDeliveryJs = read(path.join("js", "activity_delivery.js"));
const appsScriptGs = read(path.join("apps-script", "entregas_actividades.gs"));

[
  "grupo-10a-guia-01-induccion.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "pages/auxiliares/plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "pages/auxiliares/plantilla-grado-11-guia-06-planificar-informacion.html",
].forEach((filePath) => {
  const html = read(filePath);
  assertIncludes(
    html,
    "js/project_integrations.js?v=20260411_1",
    `config de integraciones en ${filePath}`
  );
  assertIncludes(
    html,
    "js/shared_apps_script_delivery.js?v=20260411_1",
    `helper compartido de Apps Script en ${filePath}`
  );
});

assertIncludes(
  helperJs,
  "Entregar por formulario seguro",
  "texto del tercer boton seguro"
);
assertIncludes(
  helperJs,
  "isValidAppsScriptUrl",
  "validacion estricta de la URL del Web App"
);
assertIncludes(
  helperJs,
  "googleAppsScriptAllowedHosts",
  "lista blanca de dominios permitidos"
);
assertIncludes(
  helperJs,
  "shared-apps-script-modal",
  "modal compartido para entrega segura"
);
assertIncludes(
  helperJs,
  "injectButtonsIntoExistingGroups",
  "inyeccion del boton en bloques de entrega ya existentes"
);
assertIncludes(
  helperJs,
  "session.role === \"student\"",
  "restriccion de identidad del aprendiz para la entrega segura"
);

assertIncludes(
  sharedDriveJs,
  "window.sharedAppsScriptDelivery",
  "integracion del panel de Drive con el helper seguro"
);
assertIncludes(
  sharedDriveJs,
  "getActivityContextFromNode",
  "contexto de actividad inferido desde la guia"
);

assertIncludes(
  integrationsJs,
  "googleAppsScriptAllowedHosts",
  "hosts permitidos en la configuracion"
);

assertIncludes(
  activityDeliveryJs,
  "window.sharedAppsScriptDelivery",
  "reuso del helper seguro desde la actividad 4"
);

assertIncludes(
  appsScriptGs,
  "MAX_UPLOAD_BYTES",
  "limite de tamano en Apps Script"
);
assertIncludes(
  appsScriptGs,
  "ALLOWED_EXTENSIONS",
  "lista blanca de extensiones en Apps Script"
);
assertIncludes(
  appsScriptGs,
  "sanitizeLabel",
  "limpieza de etiquetas sensibles en Apps Script"
);

console.log("OK: las guias muestran el boton seguro de Apps Script y el flujo compartido tiene validaciones de seguridad.");
