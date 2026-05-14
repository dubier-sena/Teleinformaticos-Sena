const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

test("rewritten admin panel exposes the requested module shell", () => {
  const html = read("panel-administrativo-usuarios.html");
  const modules = [
    "dashboard",
    "aprendices",
    "fichas",
    "guias",
    "actividades",
    "fechas",
    "respuestas",
    "entregas",
    "reportes",
    "configuracion",
  ];

  assert.match(html, /requireAdminAccess\(\{ redirectUrl: "index\.html" \}\)/);
  assert.match(html, /class="admin-layout"/);
  modules.forEach((moduleName) => {
    assert.match(html, new RegExp(`data-admin-module="${moduleName}"`));
    assert.match(html, new RegExp(`id="module-${moduleName}"`));
  });
});

test("rewritten admin script keeps critical storage and integration contracts", () => {
  const script = read(path.join("js", "admin_usuarios.js"));

  assert.match(script, /activityDeadlineManager/);
  assert.match(script, /savePolicy\(/);
  assert.match(script, /clearPolicy\(/);
  assert.match(script, /getStudentsWithProgress/);
  assert.match(script, /updateStudentAccount/);
  assert.match(script, /updateStudentPassword/);
  assert.match(script, /adminCreateStudent/);
  assert.match(script, /downloadWord/);
  assert.match(script, /Firebase Authentication/);
  assert.match(script, /TODO\(reportes\)/);
  assert.doesNotMatch(script, /registerStudent\(/);
});

test("admin deliveries view can reopen delivered activities without replacing evidence", () => {
  const script = read(path.join("js", "admin_usuarios.js"));

  assert.match(script, /data-reopen-delivery/);
  assert.match(script, /Reabrir actividad/);
  assert.match(script, /function buildReopenedDeliveryRecord/);
  assert.match(script, /function reopenDeliveredActivity/);
  assert.match(script, /historialReaperturas/);
  assert.match(script, /permiteEdicion:\s*true/);
  assert.match(script, /permiteEntrega:\s*true/);
  assert.match(script, /cloudSaveGuideData/);
  assert.doesNotMatch(script, /localStorage\.clear\(/);
});

test("admin responses module filters by learner activity and status and exports activity support", () => {
  const html = read("panel-administrativo-usuarios.html");
  const script = read(path.join("js", "admin_usuarios.js"));
  const exportScript = read(path.join("js", "admin_export.js"));

  assert.match(html, /id="responses-learner-filter"/);
  assert.match(html, /id="responses-activity-filter"/);
  assert.match(html, /id="responses-status-filter"/);
  assert.match(script, /function collectActivityResponses/);
  assert.match(script, /function buildResponsesView/);
  assert.match(script, /function buildExportableActivityDocument/);
  assert.match(script, /data-view-activity-response/);
  assert.match(script, /data-export-activity-response/);
  assert.match(script, /Sin respuesta/);
  assert.match(script, /responsesActivity/);
  assert.match(script, /responsesStatus/);
  assert.match(script, /fechaPrimerGuardado/);
  assert.match(script, /fechaUltimaActualizacion/);
  assert.match(exportScript, /Fecha de elaboraci/);
  assert.match(exportScript, /Fecha de exportaci/);
  assert.doesNotMatch(script, /cloudSaveGuideData\([^)]*responses/i);
});

test("portal auth exposes admin-safe learner create and status update helpers", () => {
  const auth = read(path.join("js", "portal_auth.js"));

  assert.match(auth, /adminCreateStudent/);
  assert.match(auth, /updateStudentStatus/);
  assert.match(auth, /function adminCreateStudent/);
  assert.match(auth, /function updateStudentStatus/);
  assert.match(auth, /isAdminSession/);
});

test("rewritten admin css defines responsive administrative layout", () => {
  const css = read(path.join("css", "page_admin.css"));

  assert.match(css, /\.admin-layout/);
  assert.match(css, /\.admin-sidebar/);
  assert.match(css, /\.admin-data-table/);
  assert.match(css, /\.admin-status/);
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.doesNotMatch(css, /gradient orbs/i);
});
