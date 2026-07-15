const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_shell.js"), "utf8");
const portalAuth = fs.readFileSync(path.join(REPO_ROOT, "js", "portal_auth.js"), "utf8");

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

test("navbar publishes every guide enabled for Kennedy 10", () => {
  const kennedyBlock = portalAuth.match(/"3441939": \{[\s\S]*?\n    \},\n    "3441942": \{[\s\S]*?\n    \},/);
  assert.ok(kennedyBlock, "Kennedy 10 ficha blocks should be present");
  const enabledGuideFiles = new Set(
    (kennedyBlock[0].match(/"([^"]+\.html)"/g) || []).map((item) => item.slice(1, -1))
  );

  for (const fileName of enabledGuideFiles) {
    assert.match(
      shell,
      new RegExp(`data-guide-file="${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
      `${fileName} is enabled for Kennedy 10 but missing from the shared guide navbar`
    );
  }
});
