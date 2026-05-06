const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adminScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "admin_usuarios.js"),
  "utf8"
);
const progressScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "admin_progress.js"),
  "utf8"
);

test("admin unlock for Guia 6 quiz clears local and cloud attempt state", () => {
  assert.match(adminScript, /"grupo-11a-guia-06-planificar-informacion\.html":\s*\{[^}]*cloudFileName:\s*"11a_guia6\.html"/s);
  assert.match(adminScript, /"grupo-11b-guia-06-planificar-informacion\.html":\s*\{[^}]*cloudFileName:\s*"11b_guia6\.html"/s);
  assert.match(progressScript, /data-guide-file="\$\{escapeHtml\(guide\.fileName\)\}"/);
  assert.match(adminScript, /patchGuideCloudState/);
  assert.match(adminScript, /cloudGetGuideData/);
  assert.match(adminScript, /cloudSaveGuideData/);
  assert.match(adminScript, /admin-activity-unlock:\$\{activity\.id\}/);
});

test("admin response viewer for Guia 6 reads cloud quiz answers before showing empty state", () => {
  assert.match(adminScript, /readGuide6CloudSnapshot/);
  assert.match(adminScript, /loadGuide6Responses/);
  assert.match(adminScript, /readGuide6CloudSnapshot\(usernameKey,\s*config\)/);
  assert.match(adminScript, /readGuide6LocalSnapshot\(usernameKey,\s*config\)/);
  assert.match(adminScript, /pickLatestSnapshot\(cloudSnapshot,\s*localSnapshot\)/);
  assert.match(adminScript, /aun no tiene respuestas guardadas en la Guia 6 sincronizadas/i);
});
