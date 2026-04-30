const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("redes Word exports use current portal session identity", () => {
  const script = read("js/script_guia_redes.js");

  assert.match(script, /function getGuideSelectionRedes\(\)/);
  assert.match(script, /portalAuth[\s\S]*getCurrentSession/);
  assert.match(script, /session\.user/);
  assert.match(script, /fullName/);
  assert.match(script, /Aprendiz:\s*\$\{escapeHtml\(sel\.fullName/);
  assert.match(script, /Ficha:\s*\$\{escapeHtml\(sel\.ficha/);
});

test("guide 5 and guide 6 Word exports prefill the learner name from the session", () => {
  const guide5Script = read("js/script.js");
  const guide2Script = read("js/script_guia2.js");
  const guide6Script = read("js/script_guia6.js");

  for (const script of [guide5Script, guide2Script, guide6Script]) {
    assert.match(script, /getCurrentSession/);
    assert.match(script, /session\?\.user\?\.fullName/);
  }

  assert.match(guide5Script, /input\.value = getCurrentLearnerName\(\)/);
  assert.match(guide2Script, /input\.value = getCurrentLearnerName\(\)/);
  assert.match(guide6Script, /input\.value = getCurrentLearnerName\(\)/);
});

test("Word exports include the institutional SENA header fields", () => {
  const scripts = [
    read("js/script.js"),
    read("js/script_guia2.js"),
    read("js/script_guia6.js"),
    read("js/script_guia_redes.js"),
  ];

  for (const script of scripts) {
    assert.match(script, /sena-logo\.png/);
    assert.match(script, /Sistemas Teleinformaticos/);
    assert.match(script, /Competencia/);
    assert.match(script, /Resultado de Aprendizaje/);
    assert.match(script, /Nombre completo del aprendiz/);
    assert.match(script, /Fecha de elaboracion/);
    assert.match(script, /Numero de ficha/);
    assert.match(script, /Grado/);
    assert.match(script, /Institucion/);
  }
});

test("Word exports use APA page basics and keep tables inside margins", () => {
  const htmlExportScripts = [
    read("js/script.js"),
    read("js/script_guia2.js"),
    read("js/script_guia6.js"),
    read("js/script_guia_redes.js"),
  ];

  for (const script of htmlExportScripts) {
    assert.match(script, /margin:\s*2\.54cm/);
    assert.match(script, /Times New Roman/);
    assert.match(script, /font-size:\s*12pt/);
    assert.match(script, /table-layout:\s*fixed/);
    assert.match(script, /max-width:\s*100%/);
    assert.match(script, /word-break:\s*break-word/);
    assert.match(script, /width="64"/);
    assert.match(script, /width:\s*64pt/);
  }

  const redesScript = read("js/script_guia_redes.js");
  assert.match(redesScript, /font:\s*"Times New Roman"/);
});
