const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SHARED_HTML = fs.readFileSync(
  path.join(__dirname, "..", "partials", "guia-redes-rap01-content.html"),
  "utf8"
);

test("el laboratorio 2 de arbol presenta una estructura guiada y espacios para evidencias", () => {
  const lab2ToLab3 = SHARED_HTML.match(/<!-- LAB 2 -->([\s\S]*?)<!-- LAB 3 -->/);

  assert.match(SHARED_HTML, /Objetivo del laboratorio/);
  assert.match(SHARED_HTML, /Lo que vas a construir/);
  assert.match(SHARED_HTML, /Equipos y recursos que debes agregar/);
  assert.match(SHARED_HTML, /Tabla de direccionamiento sugerida/);
  assert.match(SHARED_HTML, /Evidencias visuales obligatorias/);
  assert.match(SHARED_HTML, /An(?:a|ÃƒÂ¡|&aacute;)lisis del laboratorio/);
  assert.match(SHARED_HTML, /btnSubirLab2PingMismo/);
  assert.match(SHARED_HTML, /btnSubirLab2PingDif/);
  assert.match(SHARED_HTML, /btnSubirLab2TracertInterno/);
  assert.match(SHARED_HTML, /btnSubirLab2TracertExterno/);
  assert.match(SHARED_HTML, /btnGuardarLab2/);
  assert.match(SHARED_HTML, /btnEntregaLab2Pkt/);
  assert.match(SHARED_HTML, /lab2Status/);
  assert.ok(lab2ToLab3, "debe existir el bloque entre LAB 2 y LAB 3");
  assert.doesNotMatch(lab2ToLab3[1], /data-ignore-progress/);
});

test("el laboratorio 2 integra carga de pantallazos, guardado y desbloqueo admin", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );

  assert.match(guideScript, /lab2-locked/);
  assert.match(guideScript, /window\.subirPantallazoLab2\s*=\s*async function/);
  assert.match(guideScript, /window\.guardarLab2Arbol\s*=\s*async function/);
  assert.match(guideScript, /window\.subirEntregaFinalLab2\s*=\s*function/);
  assert.match(guideScript, /baseKey:\s*"lab2-ping-mismo"/);
  assert.match(guideScript, /baseKey:\s*"lab2-tracert-externo"/);
  assert.match(guideScript, /getLab2EvidenceStateKey\(slotKey,\s*"url"\)/);
  assert.match(guideScript, /fileNamePrefix:\s*"Lab2_ArbolBoycaTech"/);
  assert.match(adminScript, /lab2-locked/);
});
