const fs = require("fs");
const path = require("path");

const root = process.cwd();
const files = [
  path.join("pages", "auxiliares", "grupo-10a-guia-02-actividad-4-formulario.html"),
  path.join("pages", "auxiliares", "grupo-10b-guia-02-actividad-4-formulario.html"),
];

let failed = false;

files.forEach((file) => {
  const fullPath = path.join(root, file);
  const html = fs.readFileSync(fullPath, "utf8");
  const markers = [
    'data-store="actividad4:nombre_completo"',
    'data-store="actividad4:ficha"',
    "Identificacion del aprendiz",
  ];

  markers.forEach((marker) => {
    if (!html.includes(marker)) {
      console.error(`[FAIL] ${file} no contiene: ${marker}`);
      failed = true;
    }
  });

  const identityIndex = html.indexOf("Identificacion del aprendiz");
  const questionnaireIndex = html.indexOf("Formulario de la Actividad 4");
  if (identityIndex === -1 || questionnaireIndex === -1 || identityIndex > questionnaireIndex) {
    console.error(`[FAIL] ${file} no ubica la identificacion antes del formulario.`);
    failed = true;
  }
});

if (failed) {
  process.exit(1);
}

console.log("OK: Formularios de Actividad 4 incluyen identificacion inicial.");
