const fs = require("fs");
const path = require("path");

const root = process.cwd();
const files = [
  path.join("pages", "auxiliares", "grupo-10a-guia-02-actividad-4-formulario.html"),
  path.join("pages", "auxiliares", "grupo-10b-guia-02-actividad-4-formulario.html"),
];

let failed = false;

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), "utf8");

  if (!html.includes('name="contexto-q1"')) {
    console.error(`[FAIL] ${file} no usa un grupo de seleccion para contexto-q1.`);
    failed = true;
  }

  if (!html.includes('type="radio"')) {
    console.error(`[FAIL] ${file} no contiene opciones de tipo radio para la pregunta 1.`);
    failed = true;
  }

  if (html.includes('textarea rows="4" data-store="contexto-q1"')) {
    console.error(`[FAIL] ${file} aun conserva textarea para la pregunta 1.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: La pregunta 1 de Actividad 4 usa seleccion unica.");
