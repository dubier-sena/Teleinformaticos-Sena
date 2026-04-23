const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SHARED_HTML = fs.readFileSync(
  path.join(__dirname, "..", "partials", "guia-redes-rap01-content.html"),
  "utf8"
);

test("el laboratorio 3 hibrida presenta una estructura guiada y espacios para evidencias", () => {
  assert.match(SHARED_HTML, /3\.4\.3/);
  assert.match(SHARED_HTML, /Laboratorio 3/);
  assert.match(SHARED_HTML, /red h(?:i|&iacute;|ÃƒÆ’Ã‚Â­)brida/i);
  assert.match(SHARED_HTML, /estrella/i);
  assert.match(SHARED_HTML, /(?:arbol|&aacute;rbol|ÃƒÆ’Ã‚Â¡rbol)/i);
  assert.match(SHARED_HTML, /fibra (?:optica|&oacute;ptica|ÃƒÆ’Ã‚Â³ptica)/i);
  assert.match(SHARED_HTML, /Wi-?Fi/i);
  assert.match(SHARED_HTML, /Objetivo del laboratorio/);
  assert.match(SHARED_HTML, /Lo que vas a construir/);
  assert.match(SHARED_HTML, /Equipos y recursos que debes agregar/);
  assert.match(SHARED_HTML, /Tabla de direccionamiento sugerida/);
  assert.match(SHARED_HTML, /Evidencias visuales obligatorias/);
  assert.match(SHARED_HTML, /An(?:a|ÃƒÆ’Ã‚Â¡|&aacute;)lisis del laboratorio/);
  assert.match(SHARED_HTML, /btnSubirLab3Topologia/);
  assert.match(SHARED_HTML, /btnSubirLab3PingBloques/);
  assert.match(SHARED_HTML, /btnSubirLab3PingWifi/);
  assert.match(SHARED_HTML, /btnSubirLab3IpconfigWifi/);
  assert.match(SHARED_HTML, /btnGuardarLab3/);
  assert.match(SHARED_HTML, /btnEntregaLab3Pkt/);
  assert.match(SHARED_HTML, /lab3Status/);
});

test("el laboratorio 3 integra carga de pantallazos, guardado y entrega final", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /lab3-locked/);
  assert.match(guideScript, /window\.subirPantallazoLab3\s*=\s*async function/);
  assert.match(guideScript, /window\.guardarLab3Hibrida\s*=\s*async function/);
  assert.match(guideScript, /window\.subirEntregaFinalLab3\s*=\s*function/);
  assert.match(guideScript, /baseKey:\s*"lab3-topologia"/);
  assert.match(guideScript, /baseKey:\s*"lab3-ipconfig-wifi"/);
  assert.match(guideScript, /getLab3EvidenceStateKey\(slotKey,\s*"url"\)/);
  assert.match(guideScript, /fileNamePrefix:\s*"Lab3_HibridaColegio"/);
});

test("el laboratorio 3 queda integrado con desbloqueo admin", () => {
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );

  assert.match(adminScript, /lab3-locked/);
});
