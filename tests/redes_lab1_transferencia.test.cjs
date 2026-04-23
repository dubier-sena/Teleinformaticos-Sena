const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HTML_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

test("el laboratorio 1 de transferencia presenta una estructura guiada y espacios para evidencias", () => {
  HTML_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");

    assert.match(html, /Objetivo del laboratorio/);
    assert.match(html, /Lo que vas a construir/);
    assert.match(html, /Equipos y recursos que debes agregar/);
    assert.match(html, /Tabla de direccionamiento sugerida/);
    assert.match(html, /Evidencias visuales obligatorias/);
    assert.match(html, /An(?:a|á|&aacute;)lisis del laboratorio/);
    assert.match(html, /btnSubirLab1Ping1/);
    assert.match(html, /btnSubirLab1Ping2/);
    assert.match(html, /btnSubirLab1Broadcast/);
    assert.match(html, /btnSubirLab1Ipconfig/);
    assert.match(html, /btnGuardarLab1/);
    assert.match(html, /btnEntregaLab1Pkt/);
    assert.match(html, /lab1Status/);
  });
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
