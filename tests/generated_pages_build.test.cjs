const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.join(__dirname, "..");
const VARIANTS_FILE = path.join(REPO_ROOT, "data", "generated_page_variants.json");
const BUILD_SCRIPT = path.join(REPO_ROOT, "tools", "build-generated-pages.ps1");

const EXPECTED_VARIANTS = {
  "redes-rap01-quiz-10a": {
    template: "redes-rap01-quiz.template.html",
    outputFile: "pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html",
    grupo: "10A",
    ficha: "3441944",
    inst: "Institucion Educativa Santa Barbara",
    title: "Quiz 3.2.1.H | Redes Santa Barbara 10A",
    cloudFileName: "sb_10a_redes.html",
    backLink: "santa-barbara-10a-guia-02-redes-rap01.html#contexto",
  },
  "redes-rap01-quiz-10b": {
    template: "redes-rap01-quiz.template.html",
    outputFile: "pages/auxiliares/santa-barbara-10b-guia-02-redes-rap01-quiz.html",
    grupo: "10B",
    ficha: "3441950",
    inst: "Institucion Educativa Santa Barbara",
    title: "Quiz 3.2.1.H | Redes Santa Barbara 10B",
    cloudFileName: "sb_10b_redes.html",
    backLink: "santa-barbara-10b-guia-02-redes-rap01.html#contexto",
  },
  "redes-ip-quiz-10a": {
    template: "redes-ip-quiz.template.html",
    outputFile: "pages/auxiliares/santa-barbara-10a-guia-02-redes-ip-quiz.html",
    grupo: "10A",
    ficha: "3441944",
    inst: "Institucion Educativa Santa Barbara",
    title: "Quiz 3.3.H | Parámetros de Red Santa Barbara 10A",
    cloudFileName: "sb_10a_redes.html",
    backLink: "santa-barbara-10a-guia-02-redes-rap01.html#apropiacion",
  },
  "redes-ip-quiz-10b": {
    template: "redes-ip-quiz.template.html",
    outputFile: "pages/auxiliares/santa-barbara-10b-guia-02-redes-ip-quiz.html",
    grupo: "10B",
    ficha: "3441950",
    inst: "Institucion Educativa Santa Barbara",
    title: "Quiz 3.3.H | Parámetros de Red Santa Barbara 10B",
    cloudFileName: "sb_10b_redes.html",
    backLink: "santa-barbara-10b-guia-02-redes-rap01.html#apropiacion",
  },
  "guia2-matriz-322-10a": {
    template: "guia-02-matriz-322.template.html",
    outputFile: "pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html",
    grupo: "10A",
    ficha: "3441939",
    inst: "Institucion Educativa Jhon F. Kennedy",
    title: "Matriz de Diagnóstico Digital | Actividad 3.2.2 | Guía 2 | Grupo 10A",
    backLink: "grupo-10a-guia-02-herramientas-informaticas-digitales.html#contextualizacion",
  },
  "guia2-matriz-322-10b": {
    template: "guia-02-matriz-322.template.html",
    outputFile: "pages/auxiliares/grupo-10b-guia-02-actividad-322-matriz.html",
    grupo: "10B",
    ficha: "3441942",
    inst: "Institucion Educativa Jhon F. Kennedy",
    title: "Matriz de Diagnóstico Digital | Actividad 3.2.2 | Guía 2 | Grupo 10B",
    backLink: "grupo-10b-guia-02-herramientas-informaticas-digitales.html#contextualizacion",
  },
};

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("generated page variants expose the approved small-page families", () => {
  const variants = JSON.parse(readUtf8(VARIANTS_FILE));

  assert.deepEqual(Object.keys(variants).sort(), Object.keys(EXPECTED_VARIANTS).sort());
  assert.deepEqual(variants["redes-rap01-quiz-10a"], EXPECTED_VARIANTS["redes-rap01-quiz-10a"]);
  assert.deepEqual(variants["redes-ip-quiz-10b"], EXPECTED_VARIANTS["redes-ip-quiz-10b"]);
  assert.deepEqual(variants["guia2-matriz-322-10a"], EXPECTED_VARIANTS["guia2-matriz-322-10a"]);
});

test("generated page build script renders the expected public files", () => {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      BUILD_SCRIPT,
    ],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  for (const variant of Object.values(EXPECTED_VARIANTS)) {
    const outputPath = path.join(REPO_ROOT, variant.outputFile);
    const html = readUtf8(outputPath);

    assert.match(html, new RegExp(variant.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(`Grupo ${variant.grupo}`));
    assert.match(html, new RegExp(variant.backLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    if (variant.cloudFileName) {
      assert.match(html, new RegExp(variant.cloudFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});
