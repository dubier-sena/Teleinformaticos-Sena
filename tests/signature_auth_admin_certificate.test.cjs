const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

test("panel de autorizaciones permite descargar constancia PNG por aprendiz entregado", () => {
  const script = read("js/admin_usuarios.js");
  const css = read("css/page_admin.css");

  assert.match(script, /function downloadSignatureAuthCertificate\(/);
  assert.match(script, /canvas\.toDataURL\("image\/png"\)/);
  assert.match(script, /Constancia_Firma_/);
  assert.match(script, /firma-certificate-btn/);
  assert.match(script, /Descargar constancia/);
  assert.match(script, /Estado: AUTORIZADO Y ENTREGADO/);
  assert.match(script, /El aprendiz autorizo al instructor a usar su firma/);
  assert.match(script, /Evidencia de firma del aprendiz \(registro manual por contingencia\)/);
  assert.match(script, /downloadSignatureAuthCertificate\(certBtn\.dataset\.firmaUser\)/);
  assert.doesNotMatch(script, /Registrado por el instructor/);
  assert.match(css, /\.firma-actions/);
});
