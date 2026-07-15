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
  assert.match(script, /El estudiante subio su evidencia de firma y autorizo/);
  assert.match(script, /downloadSignatureAuthCertificate\(certBtn\.dataset\.firmaUser\)/);
  assert.match(css, /\.firma-actions/);
});
