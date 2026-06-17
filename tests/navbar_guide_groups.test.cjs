const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_shell.js"), "utf8");

test("navbar guide groups each carry a distinct institution+grade key", () => {
  const keys = (shell.match(/data-guide-group-key="([^"]+)"/g) || []).map(
    (m) => m.match(/"([^"]+)"/)[1]
  );
  assert.deepEqual(keys.sort(), ["kennedy-10", "sb-10", "sb-11"]);
});

test("student navbar filter scopes guides to the student's own ficha group", () => {
  // Regresión: las guías compartidas (p. ej. Práctica de Python) están listadas en
  // los tres grupos del navbar. El filtro del aprendiz debe acotar al grupo que
  // coincide con su institución+grado; de lo contrario la misma guía aparece varias
  // veces (incluido un encabezado de "Grado 11" que no corresponde al aprendiz).
  assert.match(shell, /getFichaInfo/);
  assert.match(shell, /getAttribute\("data-guide-group-key"\)/);
  assert.match(shell, /groupMatches/);
});
