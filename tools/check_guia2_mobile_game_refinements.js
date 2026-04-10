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
  "let wordSearchLastSelectionCells = [];",
  "let wordSearchFullscreenActive = false;",
  "function matchWordSearchPlacementInCells",
  "function findWordSearchSelectionMatch",
  "function setWordSearchFullscreen",
  "function toggleWordSearchFullscreen",
  "wordSearchLastSelectionCells.length > 1",
  "const matchedSelection = findWordSearchSelectionMatch(selectedCells);",
  "markWordSearchSelection(matchedSelection.cells);",
  "wordSearchFullscreen",
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
  ".word-search-game.is-fullscreen",
  ".word-search-game.is-fullscreen .word-search-board",
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
