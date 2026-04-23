const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HTML_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

test("el laboratorio 2 de arbol presenta una estructura guiada y espacios para evidencias", () => {
  HTML_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");

    assert.match(html, /Objetivo del laboratorio/);
    assert.match(html, /Lo que vas a construir/);
    assert.match(html, /Equipos y recursos que debes agregar/);
    assert.match(html, /Tabla de direccionamiento sugerida/);
    assert.match(html, /Evidencias visuales obligatorias/);
    assert.match(html, /An(?:a|Ã¡|&aacute;)lisis del laboratorio/);
    assert.match(html, /btnSubirLab2PingMismo/);
    assert.match(html, /btnSubirLab2PingDif/);
    assert.match(html, /btnSubirLab2TracertInterno/);
    assert.match(html, /btnSubirLab2TracertExterno/);
    assert.match(html, /btnGuardarLab2/);
    assert.match(html, /btnEntregaLab2Pkt/);
    assert.match(html, /lab2Status/);
  });
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
