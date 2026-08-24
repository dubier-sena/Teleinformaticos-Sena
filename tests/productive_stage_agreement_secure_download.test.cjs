"use strict";

// Fase 2 (auditoria profunda, 2026-08-23): el acuerdo de Etapa Productiva
// (contiene cedula y datos de TODO el grupo) ya no se referencia por URL/ID
// de Drive en el frontend -- antes viajaba en texto plano en
// project_integrations.js (repo publico) y el archivo estaba compartido
// "cualquiera con el enlace" en Drive, asi que cualquiera en internet podia
// descargarlo sin ser aprendiz. Ahora el cliente pide el archivo al Apps
// Script (entregas_actividades.gs, action "agreement"), que lo resuelve por
// la ficha VERIFICADA del propio idToken. Ver
// tests/entregas_actividades_identity_security.test.cjs para las pruebas
// funcionales del lado servidor.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// Los 6 IDs reales que antes vivian en project_integrations.js. Si alguno de
// estos vuelve a aparecer en un archivo del cliente, la exposicion publica se
// reabrio.
const REAL_AGREEMENT_FILE_IDS = [
  "1Gs67a5LUc0Alv1kqe3Yla3ryosCeBH0k",
  "17Ou96W5e5uWnvVvqAzPq2J1oc8qOYxyd",
  "1carTO0eulPdNLmoyUWpoBdzktDPRccTX",
  "1S1PKiIPDUwCmbZTuDtWzaWe78NXIXJr3",
  "11nEbEacehK3DmAbnQT2moAdsTR3I6t7P",
  "1AFGFI-buGhMeL41oSaYVDgaFFr1QTjLT",
];

test("project_integrations.js ya no expone el mapa fichaAcuerdoExcelUrls ni ningun ID real del acuerdo", () => {
  const code = read("js/project_integrations.js");
  assert.doesNotMatch(code, /fichaAcuerdoExcelUrls/);
  REAL_AGREEMENT_FILE_IDS.forEach((id) => {
    assert.doesNotMatch(code, new RegExp(id), `el ID ${id} no debe aparecer en un archivo del cliente`);
  });
});

test("ningun archivo del cliente (js/, html en cualquier carpeta) contiene los IDs reales del acuerdo de Etapa Productiva", () => {
  // Fase 15 (CI): ampliado de "js/ + html de la raiz" a TODO archivo
  // rastreado por git que sea .js o .html -- incluye pages/**, sources/
  // generated/** y cualquier carpeta nueva que aparezca despues, sin tener
  // que acordarse de sumarla aqui a mano.
  const { execFileSync } = require("node:child_process");
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const filesToScan = tracked.filter((relPath) => /\.(js|html)$/i.test(relPath));

  filesToScan.forEach((relativePath) => {
    const code = read(relativePath);
    REAL_AGREEMENT_FILE_IDS.forEach((id) => {
      assert.doesNotMatch(code, new RegExp(id), `${relativePath} no debe contener el ID de Drive ${id}`);
    });
  });
});

test("productive_stage_project_delivery.js: el acuerdo usa secureAction, no hrefByFicha", () => {
  const code = read("js/productive_stage_project_delivery.js");
  assert.doesNotMatch(code, /hrefByFicha/);
  assert.doesNotMatch(code, /resolveFichaHref/);
  const docsMatch = code.match(/const PROJECT_DOCUMENTS = (\[[\s\S]*?\n  \]);/);
  assert.ok(docsMatch, "no se encontro PROJECT_DOCUMENTS");
  const docs = new Function("return (" + docsMatch[1] + ");")();
  const agreement = docs.find((d) => d.id === "acuerdo-etapa-productiva");
  assert.ok(agreement, "debe seguir existiendo el documento acuerdo-etapa-productiva");
  assert.equal(agreement.secureAction, "agreement");
  assert.ok(!agreement.href, "un documento secureAction no debe tener ademas un href estatico");
});

test("productive_stage_project_delivery.js: los botones secureAction se conectan a sharedDelivery.downloadSecureDocument", () => {
  const code = read("js/productive_stage_project_delivery.js");
  assert.match(code, /data-secure-doc="\$\{escapeHtml\(documentItem\.id\)\}"/);
  assert.match(code, /querySelectorAll\("\[data-secure-doc\]"\)/);
  assert.match(code, /sharedDelivery\s*\n?\s*\.downloadSecureDocument\(doc\.secureAction/);
});

test("shared_apps_script_delivery.js expone downloadSecureDocument y nunca envia un ficha/fileId del cliente en su payload", () => {
  const code = read("js/shared_apps_script_delivery.js");
  assert.match(code, /downloadSecureDocument:\s*downloadSecureDocument/, "debe estar en window.sharedAppsScriptDelivery");
  const fnMatch = code.match(/async function fetchSecureDocument\(action\) \{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "no se encontro fetchSecureDocument");
  assert.doesNotMatch(fnMatch[0], /ficha/i, "el payload al Apps Script no debe incluir ninguna ficha del cliente");
  assert.match(fnMatch[0], /body:\s*JSON\.stringify\(\{\s*action:\s*action,\s*idToken:\s*idToken\s*\}\)/);
});

test("entregas_actividades.gs: action \"agreement\" nunca lee payload.ficha, solo el perfil verificado", () => {
  const code = read("apps-script/entregas_actividades.gs");
  assert.match(code, /FICHA_AGREEMENT_FILE_IDS/);
  assert.match(code, /action === "agreement"/);
  assert.match(code, /handleFetchAgreementDocument\(verifiedProfile\.ficha\)/);
  const fnMatch = code.match(/function handleFetchAgreementDocument\(ficha\) \{[\s\S]*?\n\}/);
  assert.ok(fnMatch, "no se encontro handleFetchAgreementDocument");
  assert.doesNotMatch(fnMatch[0], /payload/i, "el handler no debe recibir ni leer el payload crudo del cliente");
  assert.match(fnMatch[0], /DriveApp\.getFileById\(fileId\)/);
});
