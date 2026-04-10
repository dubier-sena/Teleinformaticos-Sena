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
    'data-matching-game="guia2-relaciona"',
    'id="matchingGameBoard"',
    'id="matchingGameOptions"',
    'id="matchingGameScore"',
    'id="matchingGameTime"',
    'id="matchingGameCorrect"',
    'id="matchingGameMistakes"',
    'id="matchingGameLeaderboard"',
    'id="matchingGameStart"',
    'id="matchingGameReset"',
    "Cuenta regresiva",
    "Puntaje maximo: 10000",
    "Top 5 de puntajes",
    "Funciones disponibles",
    "Haz clic primero en una herramienta",
    "css/guia_template.css?v=20260410_3",
    "js/script_guia2.js?v=20260410_3",
  ];

  for (const marker of required) {
    if (!html.includes(marker)) {
      console.error(`[FAIL] ${page} no contiene: ${marker}`);
      failed = true;
    }
  }

  if (html.includes("27988974-operar_herramientas")) {
    console.error(`[FAIL] ${page} aun conserva el iframe externo de Educaplay para Actividad 2.`);
    failed = true;
  }
}

const script = fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8");
const scriptMarkers = [
  "MATCHING_GAME_ACTIVITY_ID = \"guia2-relaciona\"",
  "MATCHING_GAME_STATE_KEY = \"matchingGame:guia2-relaciona\"",
  "MATCHING_GAME_MAX_SCORE = 10000",
  "MATCHING_GAME_ERROR_PENALTY = 250",
  "MATCHING_GAME_VARIANT_COUNT = 2",
  "startMatchingGameCountdown",
  "finishMatchingGameCountdown",
  "selectMatchingAnswer",
  "renderMatchingGameCountdownOverlay",
  "renderMatchingGameLeaderboard",
  "publishMatchingGameLeaderboard",
  "initializeMatchingGame",
  "matchingGame:guia2-relaciona",
  "is-counting-down",
  "is-updating",
];

for (const marker of scriptMarkers) {
  if (!script.includes(marker)) {
    console.error(`[FAIL] js/script_guia2.js no contiene: ${marker}`);
    failed = true;
  }
}

const admin = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");
const adminMarkers = [
  "matchingGame:guia2-relaciona",
  "renderMatchingGameResult",
  "renderMatchingGameAdminSummary",
  "Actividad 2. Relaciona",
  "Actividad 2 - Relaciona funciones",
  "Parejas correctas",
  "Respuestas correctas",
];

for (const marker of adminMarkers) {
  if (!admin.includes(marker)) {
    console.error(`[FAIL] js/admin_usuarios.js no muestra resultado de Actividad 2: ${marker}`);
    failed = true;
  }
}

const css = fs.readFileSync(path.join(root, "css", "guia_template.css"), "utf8");
const cssMarkers = [
  ".matching-game",
  ".matching-game-board",
  ".matching-game-option",
  ".matching-game.is-counting-down",
  ".matching-game-stat.is-updating",
  "@keyframes matchingGameCountdownPop",
  "@keyframes matchingGameCardIn",
];

for (const marker of cssMarkers) {
  if (!css.includes(marker)) {
    console.error(`[FAIL] css/guia_template.css no contiene interfaz/animacion: ${marker}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: Guia 2 incluye Actividad 2 local con emparejamiento, penalizacion, Top 5 y contador animado.");
