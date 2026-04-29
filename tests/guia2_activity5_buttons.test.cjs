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

test("guia 2 activity 6 mirrors save, export, upload, lock, and admin visibility", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const script = read("js/script_guia2.js");
  const css = read("css/guia_template.css");
  const admin = read("js/admin_usuarios.js");

  assert.match(partial, /class="data-table system-activity-table"/);
  assert.match(partial, /class="form-grid system-analysis-grid"/);
  assert.match(partial, /id="btnGuardarSistemas"/);
  assert.match(partial, /onclick="guardarSistemas332\(\)"/);
  assert.match(partial, /openGuide5ExportModal\('systems'\)/);
  assert.match(partial, /onclick="openSistemasWordDelivery\(\)"/);
  assert.match(partial, /id="sistemasStatus332"/);

  assert.match(script, /const SYSTEM_ACTIVITY_STORES =/);
  assert.match(script, /function applySistemasLock\(\)/);
  assert.match(script, /function guardarSistemas332\(\)/);
  assert.match(script, /state\["sistemas332-locked"\]/);
  assert.match(script, /function openSistemasWordDelivery\(\)/);
  assert.match(script, /activityNumber:\s*"3\.3\.2"/);
  assert.match(script, /allowedExtensions:\s*\["\.doc", "\.docx"\]/);
  assert.match(script, /window\.guardarSistemas332 = guardarSistemas332/);
  assert.match(script, /window\.openSistemasWordDelivery = openSistemasWordDelivery/);

  assert.match(css, /\.system-activity-table/);
  assert.match(css, /\.system-analysis-grid\s*\{/);
  assert.match(admin, /GUIDE2_SYSTEM_ACTIVITY_KEYS/);
  assert.match(admin, /Actividad 6\. Requerimientos minimos de sistemas operativos/);
  assert.match(admin, /sistemas332-locked/);
});

test("guia 2 activity 7 matches the source guide layout and copy", () => {
  const partial = read("partials/guia-02-herramientas-content.html");

  assert.match(partial, /ACTIVIDAD 7: &#128187; Suite ofim&aacute;tica en acci&oacute;n: herramientas para el negocio real/);
  assert.match(partial, /Diagn&oacute;stico digital &ndash; \[Nombre del negocio de tu caso\]/);
  assert.match(partial, /Control_Ventas_\[Negocio\]\.xlsx/);
  assert.match(partial, /C2 \* D2/);
  assert.match(partial, /SUMA\(\), PROMEDIO\(\) y MAX\(\)/);
  assert.match(partial, /Proyecto_Digital_\[Negocio\]/);
  assert.match(partial, /Entrega Actividad 3 &ndash; \[Tu nombre\]/);
  assert.match(partial, /class="guide-source-steps"/);
  assert.match(partial, /class="guide-source-achievement"/);
  assert.doesNotMatch(partial, /data-store="suite-negocio"/);
  assert.doesNotMatch(partial, /Organiza la evidencia del caso/);
});

test("guia 2 activity 8 matches the source guide layout and warning", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const css = read("css/guia_template.css");
  const script = read("js/script_guia2.js");

  assert.match(partial, /ACTIVIDAD 8: &#128187; Herramientas colaborativas y comunicaci&oacute;n digital profesional/);
  assert.match(partial, /MATERIAL DE APOYO INTERACTIVO/);
  assert.match(partial, /onclick="openGuia2SupportPanel\('collab-tools'\)"/);
  assert.match(partial, /Microsoft 365 \(Teams, SharePoint, OneDrive\), Google Workspace \(Meet, Drive, Docs\)/);
  assert.match(partial, /PRACTICA GOOGLE MEET O TEAMS/);
  assert.match(partial, /Dise&ntilde;a una presentaci&oacute;n de 5 diapositivas/);
  assert.match(partial, /Usa WeTransfer para enviar al instructor un archivo de m&aacute;s de 5 MB/);
  assert.match(partial, /formato del instructor, 15 &iacute;tems/);
  assert.match(partial, /class="guide-source-warning"/);
  assert.match(partial, /La privacidad de los datos de un cliente o una instituci&oacute;n es una responsabilidad &eacute;tica/);
  assert.doesNotMatch(partial, /data-store="collab-ms-function"/);
  assert.doesNotMatch(partial, /data-store="collab-meeting"/);
  assert.match(css, /\.guide-source-warning/);
  assert.match(partial, /id="guia2-support-panel"/);
  assert.match(script, /collab-tools/);
  assert.match(script, /Microsoft 365/);
  assert.match(script, /window\.openGuia2SupportPanel = openGuia2SupportPanel/);
});

test("guia 2 activity 8 includes a fillable comparison table with save and Word export", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const script = read("js/script_guia2.js");
  const css = read("css/guia_template.css");

  assert.match(partial, /class="data-table collaborative-tools-table"/);
  assert.match(partial, /data-store="collab:microsoft-365:function"/);
  assert.match(partial, /data-store="collab:google-workspace:advantage"/);
  assert.match(partial, /data-store="collab:canva:license"/);
  assert.match(partial, /id="btnGuardarColaborativas"/);
  assert.match(partial, /onclick="guardarColaborativas334\(\)"/);
  assert.match(partial, /openGuide5ExportModal\('collaborative'\)/);
  assert.match(partial, /id="colaborativasStatus334"/);

  assert.match(script, /const COLLABORATIVE_TOOLS_ACTIVITY_STORES =/);
  assert.match(script, /function applyColaborativasLock\(\)/);
  assert.match(script, /function guardarColaborativas334\(\)/);
  assert.match(script, /state\["colaborativas334-locked"\]/);
  assert.match(script, /collaborative:\s*\{/);
  assert.match(script, /function buildGuide5CollaborativeRows\(\)/);
  assert.match(script, /mode === "collaborative"/);
  assert.match(script, /window\.guardarColaborativas334 = guardarColaborativas334/);
  assert.match(css, /\.collaborative-tools-table/);
});

test("guia 2 drive delivery panels show only portfolio and secure delivery buttons for activities 7 and 8", () => {
  const script = read("js/script_guia2.js");
  const sharedDrive = read("js/shared_drive_delivery.js");

  assert.match(script, /activityNumber:\s*"3\.3\.3"/);
  assert.match(script, /activityNumber:\s*"3\.3\.4"/);
  assert.match(script, /hideQr:\s*true/);
  assert.doesNotMatch(script, /onQrClick:\s*showDriveFolderQR/);
  assert.match(sharedDrive, /if \(!panelConfig\.hideQr && typeof panelHandlers\.onQrClick === "function"\)/);
  assert.match(sharedDrive, /secureButton\.setAttribute\("data-apps-script-trigger", "true"\)/);
});

test("guia 2 activity 9 matches the source guide cybersecurity layout", () => {
  const partial = read("partials/guia-02-herramientas-content.html");
  const css = read("css/guia_template.css");

  assert.match(partial, /ACTIVIDAD 9: &#128187; Ciberseguridad b&aacute;sica: proteger la informaci&oacute;n del actor productivo/);
  assert.match(partial, /class="guide-source-info-blue"/);
  assert.match(partial, /El 59 % de las empresas colombianas ha sufrido alg&uacute;n incidente de ciberseguridad/);
  assert.match(partial, /malos h&aacute;bitos digitales/);
  assert.match(partial, /phishing por correo o WhatsApp/);
  assert.match(partial, /Gu&iacute;a de ciberseguridad para \[Nombre del actor productivo\]/);
  assert.match(partial, /m&iacute;nimo 8 recomendaciones concretas/);
  assert.match(partial, /lista de verificaci&oacute;n de ciberseguridad de 10 &iacute;tems/);
  assert.doesNotMatch(partial, /data-store="cyber-threats"/);
  assert.doesNotMatch(partial, /data-store="cyber-checklist"/);
  assert.match(css, /\.guide-source-info-blue/);
});
