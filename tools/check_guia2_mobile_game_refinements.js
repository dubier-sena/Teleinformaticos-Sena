const fs = require("fs");
const path = require("path");

const root = process.cwd();
const script = fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "guia_template.css"), "utf8");

let failed = false;

function assertIncludes(content, marker, label) {
  if (!content.includes(marker)) {
    console.error(`[FAIL] Falta ${label}: ${marker}`);
    failed = true;
  }
}

[
  "WORD_SEARCH_FOUND_COLOR_COUNT = 8",
  "let wordSearchLastSelectionCells = [];",
  "let wordSearchFullscreenActive = false;",
  "let wordSearchFullscreenPlaceholder = null;",
  "function getWordSearchFoundColorClass",
  "function matchWordSearchPlacementInCells",
  "function findWordSearchSelectionMatch",
  "function moveWordSearchToFullscreenLayer",
  "function restoreWordSearchFromFullscreenLayer",
  "function setWordSearchFullscreen",
  "function toggleWordSearchFullscreen",
  "wordSearchLastSelectionCells.length > 1",
  "const matchedSelection = findWordSearchSelectionMatch(selectedCells);",
  "markWordSearchSelection(matchedSelection.cells);",
  "wordSearchFullscreen",
  "data-found-color",
].forEach((marker) => assertIncludes(script, marker, "tolerancia tactil de sopa de letras"));

[
  'id="wordSearchFullscreen"',
  "Pantalla completa",
].forEach((marker) => {
  for (const page of [
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  ]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assertIncludes(html, marker, `boton pantalla completa en ${page}`);
  }
});

[
  "@media (max-width: 640px)",
  ".word-search-game,",
  ".matching-game {",
  "body.word-search-fullscreen-lock",
  "html.word-search-fullscreen-lock",
  ".word-search-fullscreen-placeholder",
  ".word-search-game.is-fullscreen",
  ".word-search-game.is-fullscreen .word-search-board",
  ".word-search-cell.word-found-color-1",
  ".word-search-cell.word-found-color-8",
  ".word-search-board-shell",
  "width: 100%;",
  "font-size: clamp(10px, 3.2vw, 13px);",
  ".matching-game-tool,",
  ".matching-game-option {",
  "min-height: 52px;",
].forEach((marker) => assertIncludes(css, marker, "ajustes moviles de actividades 1 y 2"));

if (failed) {
  process.exit(1);
}

console.log("OK: Actividades 1 y 2 tienen mejor tacto movil, colores suaves y seleccion tolerante.");
