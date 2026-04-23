const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const AUX_ROOT = path.join(REPO_ROOT, "pages", "aux");

const EXPECTED_ROOT_HTML = [
  "calendario-academico-2026.html",
  "etapa-productiva-admin.html",
  "etapa-productiva-estudiante.html",
  "grupo-10a-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "index.html",
  "panel-administrativo-usuarios.html",
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

const EXPECTED_AUX_HTML = [
  "grupo-10a-guia-02-actividad-322-matriz.html",
  "grupo-10a-guia-02-actividad-4-formulario.html",
  "grupo-10a-guia-02-ficha-caso.html",
  "grupo-10b-guia-02-actividad-322-matriz.html",
  "grupo-10b-guia-02-actividad-4-formulario.html",
  "grupo-10b-guia-02-ficha-caso.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html",
  "santa-barbara-10a-guia-02-redes-ip-quiz.html",
  "santa-barbara-10a-guia-02-redes-rap01-quiz.html",
  "santa-barbara-10b-guia-02-redes-ip-quiz.html",
  "santa-barbara-10b-guia-02-redes-rap01-quiz.html",
  "santa-barbara-guia-02-contenido-teorico-redes.html",
];

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("the repo root only keeps the approved main html pages", () => {
  const rootHtml = fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(rootHtml, [...EXPECTED_ROOT_HTML].sort());
});

test("approved auxiliary html pages live under pages/aux and not in the root", () => {
  for (const fileName of EXPECTED_AUX_HTML) {
    const auxPath = path.join(AUX_ROOT, fileName);
    const rootPath = path.join(REPO_ROOT, fileName);

    assert.equal(fs.existsSync(auxPath), true, `${fileName} should exist under pages/aux`);
    assert.equal(fs.existsSync(rootPath), false, `${fileName} should no longer exist in the root`);
  }
});

test("guide 2 shared partial points auxiliary links to pages/aux", () => {
  const partial = readUtf8(path.join(REPO_ROOT, "partials", "guia-02-herramientas-content.html"));

  assert.match(partial, /pages\/aux\/grupo-10a-guia-02-actividad-4-formulario\.html\?v=20260409_6/);
  assert.match(partial, /pages\/aux\/grupo-10a-guia-02-ficha-caso\.html/);
  assert.match(partial, /pages\/aux\/grupo-10a-guia-02-actividad-322-matriz\.html/);
  assert.match(partial, /pages\/aux\/grupo-10b-guia-02-actividad-4-formulario\.html\?v=20260409_6/);
  assert.match(partial, /pages\/aux\/grupo-10b-guia-02-ficha-caso\.html/);
  assert.match(partial, /pages\/aux\/grupo-10b-guia-02-actividad-322-matriz\.html/);
});

test("the shared redes guide points theoretical content to pages/aux", () => {
  const partial = readUtf8(path.join(REPO_ROOT, "partials", "guia-redes-rap01-content.html"));

  assert.match(partial, /href="pages\/aux\/santa-barbara-guia-02-contenido-teorico-redes\.html"/);
});
