const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SHARED_HTML = fs.readFileSync(
  path.join(__dirname, "..", "partials", "guia-redes-rap01-content.html"),
  "utf8"
);

test("el laboratorio 1 de transferencia presenta una estructura guiada y espacios para evidencias", () => {
  assert.match(SHARED_HTML, /Objetivo del laboratorio/);
  assert.match(SHARED_HTML, /Lo que vas a construir/);
  assert.match(SHARED_HTML, /Equipos y recursos que debes agregar/);
  assert.match(SHARED_HTML, /Tabla de direccionamiento sugerida/);
  assert.match(SHARED_HTML, /Evidencias visuales obligatorias/);
  assert.match(SHARED_HTML, /An(?:a|Ã¡|&aacute;)lisis del laboratorio/);
  assert.match(SHARED_HTML, /btnSubirLab1Ping1/);
  assert.match(SHARED_HTML, /btnSubirLab1Ping2/);
  assert.match(SHARED_HTML, /btnSubirLab1Broadcast/);
  assert.match(SHARED_HTML, /btnSubirLab1Ipconfig/);
  assert.match(SHARED_HTML, /btnGuardarLab1/);
  assert.match(SHARED_HTML, /btnEntregaLab1Pkt/);
  assert.match(SHARED_HTML, /lab1Status/);
});

test("el laboratorio 1 integra carga de pantallazos, guardado y desbloqueo admin", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );

  assert.match(guideScript, /lab1-locked/);
  assert.match(guideScript, /window\.subirPantallazoLab1\s*=\s*async function/);
  assert.match(guideScript, /window\.guardarLab1Transferencia\s*=\s*async function/);
  assert.match(guideScript, /window\.subirEntregaFinalLab1\s*=\s*function/);
  assert.match(guideScript, /baseKey:\s*"lab1-ping1"/);
  assert.match(guideScript, /baseKey:\s*"lab1-ipconfig"/);
  assert.match(guideScript, /getLab1EvidenceStateKey\(slotKey,\s*"url"\)/);
  assert.match(adminScript, /lab1-locked/);
});
