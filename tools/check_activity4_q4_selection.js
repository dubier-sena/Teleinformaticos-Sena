const fs = require("fs");
const path = require("path");

const root = process.cwd();
const files = [
  "grupo-10a-guia-02-actividad-4-formulario.html",
  "grupo-10b-guia-02-actividad-4-formulario.html",
];

let failed = false;

for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const required = [
    'name="contexto-q4"',
    'type="radio"',
    'data-store="contexto-q4"',
    "Crear una base de datos con miles de registros de clientes.",
  ];

  for (const marker of required) {
    if (!html.includes(marker)) {
      console.error(`[FAIL] ${file} no contiene: ${marker}`);
      failed = true;
    }
  }

  if (html.includes('textarea rows="4" data-store="contexto-q4"')) {
    console.error(`[FAIL] ${file} aun conserva textarea para la pregunta 4.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: La pregunta 4 de Actividad 4 usa seleccion unica.");
