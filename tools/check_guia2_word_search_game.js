const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pages = [
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
];

let failed = false;

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const required = [
    'data-word-search="guia2-sopa"',
    'id="wordSearchBoard"',
    'id="wordSearchFound"',
    'id="wordSearchScore"',
    'id="wordSearchMistakes"',
    'id="wordSearchTargets"',
    'id="wordSearchLeaderboard"',
    "Palabras a buscar",
    "Puntaje maximo: 10000",
  ];

  for (const marker of required) {
    if (!html.includes(marker)) {
      console.error(`[FAIL] ${page} no contiene: ${marker}`);
      failed = true;
    }
  }

  if (html.includes("27988460-operar_herramientas")) {
    console.error(`[FAIL] ${page} aun conserva el iframe externo de Educaplay para la sopa.`);
    failed = true;
  }
}

const script = fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8");
const scriptMarkers = [
  "WORD_SEARCH_MAX_SCORE = 10000",
  "WORD_SEARCH_ERROR_PENALTY = 200",
  "initializeWordSearchGame",
  "renderWordSearchTargets",
  "publishWordSearchLeaderboard",
  "renderWordSearchLeaderboard",
  "mistakes",
  "wordSearch:guia2-sopa",
];

for (const marker of scriptMarkers) {
  if (!script.includes(marker)) {
    console.error(`[FAIL] js/script_guia2.js no contiene: ${marker}`);
    failed = true;
  }
}

const admin = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");
for (const marker of ["Errores", "Puntaje", "Palabras encontradas"]) {
  if (!admin.includes(marker)) {
    console.error(`[FAIL] js/admin_usuarios.js no muestra resultado de sopa: ${marker}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: Guia 2 incluye sopa de letras local con palabras visibles, penalizacion y Top 5.");
