const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("guia 2 activity 5 exposes save, export, and upload actions", () => {
  const partial = read("partials/guia-02-herramientas-content.html");

  assert.match(partial, /id="btnGuardarExtensiones"/);
  assert.match(partial, /onclick="guardarExtensiones331\(\)"/);
  assert.match(partial, /openGuide5ExportModal\('extensions'\)/);
  assert.match(partial, /onclick="openExtensionesWordDelivery\(\)"/);
  assert.match(partial, /id="extensionesStatus331"/);
});

test("guia 2 activity 5 locks extension answers after saving", () => {
  const script = read("js/script_guia2.js");

  assert.match(script, /const EXTENSION_ACTIVITY_STORES =/);
  assert.match(script, /function applyExtensionesLock\(\)/);
  assert.match(script, /state\["extensiones331-locked"\]/);
  assert.match(script, /function guardarExtensiones331\(\)/);
  assert.match(script, /window\.guardarExtensiones331 = guardarExtensiones331/);
  assert.match(script, /applyExtensionesLock\(\);/);
});

test("guia 2 activity 5 upload action opens the secure Drive file selector", () => {
  const script = read("js/script_guia2.js");

  assert.match(script, /function openExtensionesWordDelivery\(\)/);
  assert.match(script, /sharedAppsScriptDelivery/);
  assert.match(script, /openDeliveryModal/);
  assert.match(script, /activityNumber:\s*"3\.3\.1"/);
  assert.match(script, /allowedExtensions:\s*\["\.doc", "\.docx"\]/);
  assert.match(script, /window\.openExtensionesWordDelivery = openExtensionesWordDelivery/);
});

test("guia 2 activity 5 table is compact and does not show red risk labels", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const script = read("js/script_guia2.js");
  const css = read("css/guia_template.css");

  assert.match(partial, /class="data-table extension-activity-table"/);
  assert.doesNotMatch(script, /risk-tag/);
  assert.match(css, /\.extension-activity-table/);
});

test("guia 2 activity 5 analysis questions render vertically and admin can show answers", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const css = read("css/guia_template.css");
  const admin = read("js/admin_usuarios.js");

  assert.match(partial, /class="form-grid extension-analysis-grid"/);
  assert.match(css, /\.extension-analysis-grid\s*\{/);
  assert.match(css, /grid-template-columns:\s*1fr/);
  assert.match(admin, /extensions-category-summary/);
  assert.match(admin, /Actividad 5\. Extensiones de archivo/);
  assert.match(admin, /extensiones331-locked/);
});
