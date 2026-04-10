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
    "Comenzar",
    "Cuenta regresiva",
    "Puntaje maximo: 10000",
    'class="word-search-layout word-search-arena"',
    'class="word-search-board-shell"',
    "css/guia_template.css?v=20260410_3",
    "js/script_guia2.js?v=20260410_3",
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
  "WORD_SEARCH_GRID_SIZE = 15",
  "WORD_SEARCH_VARIANT_COUNT = 2",
  "startWordSearchCountdown",
  "finishWordSearchSelection",
  "initializeWordSearchGame",
  "renderWordSearchTargets",
  "publishWordSearchLeaderboard",
  "renderWordSearchLeaderboard",
  "renderWordSearchCountdownOverlay",
  "pulseWordSearchMetric",
  "wordSearchCountdownPhase",
  "is-counting-down",
  "is-updating",
  "pointerdown",
  "pointerup",
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

const css = fs.readFileSync(path.join(root, "css", "guia_template.css"), "utf8");
const cssMarkers = [
  ".word-search-board-shell",
  ".word-search-game.is-counting-down",
  ".word-search-stat.is-updating",
  "@keyframes wordSearchCountdownPop",
  "@keyframes wordSearchRingPulse",
  "@keyframes wordSearchMetricPulse",
];

for (const marker of cssMarkers) {
  if (!css.includes(marker)) {
    console.error(`[FAIL] css/guia_template.css no contiene animacion/distribucion: ${marker}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: Guia 2 incluye sopa de letras local con palabras visibles, penalizacion, Top 5 y contador animado.");
