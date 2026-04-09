const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const guidePaths = [
  path.join(projectRoot, "grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
  path.join(projectRoot, "grupo-10b-guia-02-herramientas-informaticas-digitales.html"),
];
const googleFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSep05Y_zCcRSGPFNGLpI6t7EiXrdw-qrSEP6MHKm5D0oUJ-yQ/viewform?usp=publish-editor";

guidePaths.forEach((guidePath) => {
  const html = fs.readFileSync(guidePath, "utf8");
  if (!html.includes(googleFormUrl)) {
    throw new Error(`Falta el enlace del Formulario de Google en ${path.basename(guidePath)}.`);
  }
  if (!html.includes("Formulario de Google")) {
    throw new Error(`Falta la referencia visible al Formulario de Google en ${path.basename(guidePath)}.`);
  }
});

console.log("Verificacion de respaldo con Formulario de Google completada.");
