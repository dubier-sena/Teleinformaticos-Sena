const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const guideContent = fs.readFileSync(
  path.join(projectRoot, "partials", "guia-02-herramientas-content.html"),
  "utf8"
);
const googleFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSep05Y_zCcRSGPFNGLpI6t7EiXrdw-qrSEP6MHKm5D0oUJ-yQ/viewform?usp=publish-editor";

if (!guideContent.includes(googleFormUrl)) {
  throw new Error("Falta el enlace del Formulario de Google en el partial de Guia 2.");
}
if (!guideContent.includes("Formulario de Google")) {
  throw new Error("Falta la referencia visible al Formulario de Google en el partial de Guia 2.");
}

console.log("Verificacion de respaldo con Formulario de Google completada.");
