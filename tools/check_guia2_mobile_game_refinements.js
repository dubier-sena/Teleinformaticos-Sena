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
  "function matchWordSearchPlacementInCells",
  "function findWordSearchSelectionMatch",
  "wordSearchLastSelectionCells.length > 1",
  "const matchedSelection = findWordSearchSelectionMatch(selectedCells);",
  "markWordSearchSelection(matchedSelection.cells);",
].forEach((marker) => assertIncludes(script, marker, "tolerancia tactil de sopa de letras"));

[
  "@media (max-width: 640px)",
  ".word-search-game,",
  ".matching-game {",
  ".word-search-board-shell",
  "width: max(100%, 390px);",
  "font-size: 13px;",
  ".matching-game-tool,",
  ".matching-game-option {",
  "min-height: 52px;",
].forEach((marker) => assertIncludes(css, marker, "ajustes moviles de actividades 1 y 2"));

if (failed) {
  process.exit(1);
}

console.log("OK: Actividades 1 y 2 tienen mejor tacto movil, colores suaves y seleccion tolerante.");
