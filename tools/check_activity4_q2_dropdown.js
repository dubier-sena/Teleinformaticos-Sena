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
    'data-store="contexto-rel-drive"',
    'data-store="contexto-rel-excel"',
    'data-store="contexto-rel-canva"',
    'data-store="contexto-rel-whatsapp"',
    "<select",
    "Selecciona la funcion",
    "Crear presentaciones visuales.",
    "Almacenar y compartir archivos en la nube.",
    "Organizar datos en tablas y hacer calculos.",
    "Comunicarse con clientes de un negocio.",
  ];

  for (const marker of required) {
    if (!html.includes(marker)) {
      console.error(`[FAIL] ${file} no contiene: ${marker}`);
      failed = true;
    }
  }

  const banned = [
    'type="text" data-store="contexto-rel-drive"',
    'type="text" data-store="contexto-rel-excel"',
    'type="text" data-store="contexto-rel-canva"',
    'type="text" data-store="contexto-rel-whatsapp"',
    "<div class=\"label\">Funciones</div>",
    "1. Crear presentaciones visuales.",
    "2. Almacenar y compartir archivos en la nube.",
    "3. Organizar datos en tablas y hacer c&aacute;lculos.",
    "4. Comunicarse con clientes de un negocio.",
  ];

  for (const marker of banned) {
    if (html.includes(marker)) {
      console.error(`[FAIL] ${file} aun conserva input de texto para pregunta 2: ${marker}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: La pregunta 2 de Actividad 4 usa respuestas desplegables completas.");
