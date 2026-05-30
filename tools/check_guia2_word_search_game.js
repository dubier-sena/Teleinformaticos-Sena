const fs = require("fs");
const path = require("path");

const root = process.cwd();
const pages = [
  path.join("pages", "guias", "grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
  path.join("pages", "guias", "grupo-10b-guia-02-herramientas-informaticas-digitales.html"),
];
const partial = fs.readFileSync(path.join(root, "partials", "guia-02-herramientas-content.html"), "utf8");

let failed = false;

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const wrapperRequired = [
    /href="css\/guia_template\.css\?v=202[0-9]{5}_[0-9]+"/,
    /src="js\/script_guia2\.js\?v=202[0-9]{5}_[0-9]+"/,
  ];
  for (const pattern of wrapperRequired) {
    if (!pattern.test(html)) {
      console.error(`[FAIL] ${page} no contiene recurso versionado: ${pattern}`);
      failed = true;
    }
  }
}

{
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
  ];

  for (const marker of required) {
    if (!partial.includes(marker)) {
      console.error(`[FAIL] partial de Guia 2 no contiene: ${marker}`);
      failed = true;
    }
  }

  if (partial.includes("27988460-operar_herramientas")) {
    console.error("[FAIL] el partial de Guia 2 aun conserva el iframe externo de Educaplay para la sopa.");
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

const adminActivities = fs.readFileSync(path.join(root, "js", "admin_activities.js"), "utf8");
for (const marker of [
  'activityId === "wordsearch"',
  "summaries.guide2WordSearch",
  "Puntaje ${escapeHtml(summary.score)} / 10000",
  "buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user)",
]) {
  if (!adminActivities.includes(marker)) {
    console.error(`[FAIL] js/admin_activities.js no muestra resultado de sopa: ${marker}`);
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
