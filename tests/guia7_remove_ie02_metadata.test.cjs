const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const CONTENT_PATH = path.join(
  REPO_ROOT,
  "partials",
  "guia-07-planificar-ciberseguridad-content.html"
);
const SCRIPT_PATH = path.join(REPO_ROOT, "js", "script_guia7.js");

function readContent() {
  return fs.readFileSync(CONTENT_PATH, "utf8");
}

function readScript() {
  return fs.readFileSync(SCRIPT_PATH, "utf8");
}

function sectionBetween(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
  return html.slice(start, end);
}

test("guia 7 diagnostic activity does not show the IE-02 metadata block", () => {
  const html = readContent();
  const diagnostico = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.3.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.3.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );

  assert.doesNotMatch(diagnostico, /<h3>Datos de la actividad<\/h3>/);
  assert.doesNotMatch(diagnostico, /Instrumento: Lista de Chequeo IE-02 \(&iacute;tems 1-6\)/);
  assert.doesNotMatch(diagnostico, /IE-02 &iacute;tems 1-6/);
});

test("guia 7 activity 3.2.1 does not show the activity data card", () => {
  const html = readContent();
  const bloqueAB = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );

  assert.doesNotMatch(bloqueAB, /<h3>Datos de la actividad<\/h3>/);
});

test("guia 7 activity 3.2.1 includes the team selector for groups of three", () => {
  const html = readContent();
  const script = readScript();
  const bloqueAB = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );

  assert.match(bloqueAB, /data-equipo-g7-mount="bloqueAB321"/);
  assert.match(bloqueAB, /data-equipo-g7-summary="bloqueAB321"/);
  assert.match(bloqueAB, /data-equipo-g7-config="bloqueAB321"/);
  assert.match(bloqueAB, /confirmarEquipoGuia7\('bloqueAB321'\)/);
  assert.match(bloqueAB, /Selecciona hasta 2 compa&ntilde;eros/);
  assert.match(script, /EQUIPO_G7_ACTIVITY_IDS\s*=\s*\["plenaria312", "bloqueAB321"\]/);
});

test("guia 7 activity 3.2.1 gives a clear guided workflow", () => {
  const html = readContent();
  const script = readScript();
  const guideDeclarations = fs.readFileSync(path.join(REPO_ROOT, "js", "guide_declarations.js"), "utf8");
  const bloqueAB = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );

  assert.match(bloqueAB, /Ruta de trabajo/);
  assert.match(bloqueAB, /Paso 1/);
  assert.match(bloqueAB, /Paso 2/);
  assert.match(bloqueAB, /Paso 3/);
  assert.match(bloqueAB, /Plantilla de la fila que vas a entregar/);
  assert.match(bloqueAB, /data-store="g7_321_reparto"/);
  assert.match(bloqueAB, /data-store="g7_321_concepto"/);
  assert.match(bloqueAB, /data-store="g7_321_consiste"/);
  assert.match(bloqueAB, /data-store="g7_321_ejemplo"/);
  assert.match(bloqueAB, /data-store="g7_321_aporte"/);
  assert.match(script, /g7_321_reparto/);
  assert.match(script, /g7_321_concepto/);
  assert.match(script, /g7_321_consiste/);
  assert.match(script, /g7_321_ejemplo/);
  assert.match(script, /g7_321_aporte/);
  assert.match(guideDeclarations, /g7_321_reparto/);
  assert.match(guideDeclarations, /g7_321_concepto/);
  assert.match(guideDeclarations, /g7_321_consiste/);
  assert.match(guideDeclarations, /g7_321_ejemplo/);
  assert.match(guideDeclarations, /g7_321_aporte/);
});

test("guia 7 activity 3.1.1 bitacora guides the security analysis", () => {
  const html = readContent();
  const script = readScript();
  const caso = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.1.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.1.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );
  const guideDeclarations = fs.readFileSync(path.join(REPO_ROOT, "js", "guide_declarations.js"), "utf8");

  assert.match(caso, /Vector de ataque/);
  assert.match(caso, /evidencias del caso/);
  assert.match(caso, /Confidencialidad, Integridad y Disponibilidad/);
  assert.match(caso, /prioridad alta/);
  assert.match(caso, /Activos cr&iacute;ticos/);
  assert.match(caso, /Primeras 24 horas/);
  assert.match(caso, /data-store="g7_311_pregunta5"/);
  assert.match(caso, /data-store="g7_311_pregunta6"/);
  assert.match(script, /g7_311_pregunta5/);
  assert.match(script, /g7_311_pregunta6/);
  assert.match(guideDeclarations, /g7_311_pregunta5/);
  assert.match(guideDeclarations, /g7_311_pregunta6/);
});

test("guia 7 activity 3.1.2 can be completed inside the guide", () => {
  const html = readContent();
  const script = readScript();
  const guideDeclarations = fs.readFileSync(path.join(REPO_ROOT, "js", "guide_declarations.js"), "utf8");
  const plenaria = sectionBetween(
    html,
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.1.2 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->",
    "<!-- \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 Actividad 3.2.1 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 -->"
  );

  assert.doesNotMatch(plenaria, /Padlet/i);
  assert.doesNotMatch(plenaria, /tablero/i);
  assert.match(plenaria, /data-store="g7_312_acuerdos"/);
  assert.match(plenaria, /data-store="g7_312_hallazgo"/);
  assert.match(plenaria, /data-store="g7_312_medida"/);
  assert.match(plenaria, /data-store="g7_312_preguntas"/);
  assert.match(script, /g7_312_acuerdos/);
  assert.match(script, /g7_312_hallazgo/);
  assert.match(script, /g7_312_medida/);
  assert.match(script, /g7_312_preguntas/);
  assert.match(guideDeclarations, /g7_312_acuerdos/);
  assert.match(guideDeclarations, /g7_312_hallazgo/);
  assert.match(guideDeclarations, /g7_312_medida/);
  assert.match(guideDeclarations, /g7_312_preguntas/);
});
