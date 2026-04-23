const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HTML_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

test("el laboratorio 3 hibrida presenta una estructura guiada y espacios para evidencias", () => {
  HTML_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");

    assert.match(html, /3\.4\.3/);
    assert.match(html, /Laboratorio 3/);
    assert.match(html, /red h(?:i|&iacute;|ÃƒÂ­)brida/i);
    assert.match(html, /estrella/i);
    assert.match(html, /(?:arbol|&aacute;rbol|ÃƒÂ¡rbol)/i);
    assert.match(html, /fibra (?:optica|&oacute;ptica|ÃƒÂ³ptica)/i);
    assert.match(html, /Wi-?Fi/i);
    assert.match(html, /Objetivo del laboratorio/);
    assert.match(html, /Lo que vas a construir/);
    assert.match(html, /Equipos y recursos que debes agregar/);
    assert.match(html, /Tabla de direccionamiento sugerida/);
    assert.match(html, /Evidencias visuales obligatorias/);
    assert.match(html, /An(?:a|ÃƒÂ¡|&aacute;)lisis del laboratorio/);
    assert.match(html, /btnSubirLab3Topologia/);
    assert.match(html, /btnSubirLab3PingBloques/);
    assert.match(html, /btnSubirLab3PingWifi/);
    assert.match(html, /btnSubirLab3IpconfigWifi/);
    assert.match(html, /btnGuardarLab3/);
    assert.match(html, /btnEntregaLab3Pkt/);
    assert.match(html, /lab3Status/);
  });
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
