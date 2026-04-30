const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("la guia de induccion usa una sopa interna con dos variantes aleatorias", () => {
  const partial = read("partials/guia-01-induccion-content.html");

  assert.match(partial, /data-word-search="induccion-sopa"/);
  assert.match(partial, /INDUCTION_WORD_SEARCH_VARIANT_COUNT\s*=\s*2/);
  assert.match(partial, /const INDUCTION_WORD_SEARCH_WORDS = \[/);
  assert.match(partial, /"COMPETENCIA"/);
  assert.match(partial, /"PORTAFOLIO"/);
  assert.match(partial, /function pickInductionWordSearchVariant\(\)/);
  assert.match(partial, /<div class="game-panel" id="tab-sopa">[\s\S]*data-word-search="induccion-sopa"/);
  assert.doesNotMatch(partial, /<div class="game-panel" id="tab-sopa">[\s\S]*sopa_de_letras_vocabulario_fpi\.html[\s\S]*<\/div>\s*<\/div>\s*<!-- Crucigrama -->/);
});

test("el bundle de induccion publica la nueva sopa aleatoria", () => {
  const bundle = read("partials/guia-01-induccion-bundle.js");

  assert.match(bundle, /induccion-sopa/);
  assert.match(bundle, /INDUCTION_WORD_SEARCH_VARIANT_COUNT = 2/);
});
