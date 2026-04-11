const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    throw new Error(`${message}\nMissing: ${snippet}`);
  }
}

function assertNotIncludes(source, snippet, message) {
  if (source.includes(snippet)) {
    throw new Error(`${message}\nUnexpected: ${snippet}`);
  }
}

const helperJs = read("js/shared_drive_delivery.js");
const guia5Js = read("js/script.js");
const guia2Js = read("js/script_guia2.js");
const guia6Js = read("js/script_guia6.js");

assertIncludes(
  helperJs,
  "window.sharedDriveDelivery = {",
  "La utilidad compartida de entrega en Drive debe exponer una API global."
);
assertIncludes(
  helperJs,
  "appendDriveDeliveryPanels",
  "La utilidad compartida debe poder insertar paneles de entrega."
);

assertIncludes(
  guia5Js,
  "window.sharedDriveDelivery?.appendDriveDeliveryPanels",
  "Guia 5 debe usar la utilidad compartida para renderizar el panel de Drive."
);
assertIncludes(
  guia2Js,
  "window.sharedDriveDelivery?.appendDriveDeliveryPanels",
  "Guia 2 debe usar la utilidad compartida para renderizar el panel de Drive."
);
assertIncludes(
  guia6Js,
  "window.sharedDriveDelivery?.appendDriveDeliveryPanels",
  "Guia 6 debe usar la utilidad compartida para renderizar el panel de Drive."
);

assertNotIncludes(
  guia5Js,
  "function createDriveDeliveryPanel(",
  "Guia 5 aun conserva una copia local innecesaria del panel de Drive."
);
assertNotIncludes(
  guia2Js,
  "function createDriveDeliveryPanel(",
  "Guia 2 aun conserva una copia local innecesaria del panel de Drive."
);
assertNotIncludes(
  guia6Js,
  "function createDriveDeliveryPanel(",
  "Guia 6 aun conserva una copia local innecesaria del panel de Drive."
);

[
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html",
].forEach((filePath) => {
  const html = read(filePath);
  assertIncludes(
    html,
    "js/shared_drive_delivery.js?v=20260410_2",
    `Falta cargar la utilidad compartida de entrega en Drive en ${filePath}.`
  );
});

console.log("OK: la entrega en Drive usa una utilidad compartida y elimina duplicacion innecesaria.");
