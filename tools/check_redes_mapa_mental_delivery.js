const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(source, snippet, message) {
  assert(source.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

const page10A = read("santa-barbara-10a-guia-02-redes-rap01.html");
const page10B = read("santa-barbara-10b-guia-02-redes-rap01.html");
const sharedDelivery = read(path.join("js", "shared_apps_script_delivery.js"));
const appsScript = read(path.join("apps-script", "entregas_actividades.gs"));

for (const [label, page] of [
  ["10A", page10A],
  ["10B", page10B],
]) {
  expectIncludes(
    page,
    "MapaMental_Redes_NombreAprendiz_FICHA",
    `La guia ${label} debe documentar el nombre base del mapa mental.`
  );
  expectIncludes(
    page,
    "allowedExtensions:['.png','.pdf']",
    `La guia ${label} debe limitar la entrega del mapa mental a PNG y PDF.`
  );
  expectIncludes(
    page,
    "fileNamePrefix:'MapaMental_Redes'",
    `La guia ${label} debe enviar el prefijo del nombre de archivo esperado para el mapa mental.`
  );
  expectIncludes(
    page,
    "learnerNameMode:'full'",
    `La guia ${label} debe pedir el nombre completo del aprendiz en el archivo del mapa mental.`
  );
}

expectIncludes(
  sharedDelivery,
  "function getAllowedExtensions(context)",
  "La entrega compartida debe soportar extensiones permitidas por actividad."
);
expectIncludes(
  sharedDelivery,
  "currentContext.allowedExtensions = getAllowedExtensions(currentContext);",
  "El modal debe normalizar las extensiones permitidas de la actividad."
);
expectIncludes(
  sharedDelivery,
  "fileNamePrefix: currentContext.fileNamePrefix || \"\"",
  "El modal debe enviar el prefijo configurado al Apps Script."
);
expectIncludes(
  sharedDelivery,
  "learnerNameMode: currentContext.learnerNameMode || \"firstToken\"",
  "El modal debe enviar el modo de nombre configurado al Apps Script."
);

expectIncludes(
  appsScript,
  "const finalFileName = buildDeliveryFileName(fullName, ficha, activityLabel, fileName, payload);",
  "El Apps Script debe construir el nombre final con ficha y configuracion de actividad."
);
expectIncludes(
  appsScript,
  "validateUploadExtension(fileName, payload.allowedExtensions);",
  "El Apps Script debe validar extensiones segun la actividad cuando aplique."
);
expectIncludes(
  appsScript,
  "const prefix = sanitizeFileSegment(payload.fileNamePrefix, \"\");",
  "El Apps Script debe permitir un prefijo personalizado para el nombre final."
);
expectIncludes(
  appsScript,
  "const fichaLabel = sanitizeFileSegment(ficha, \"SIN_FICHA\");",
  "El Apps Script debe incluir la ficha en el nombre final personalizado."
);

console.log("OK: la entrega del mapa mental restringe formato y nombre final esperado.");
