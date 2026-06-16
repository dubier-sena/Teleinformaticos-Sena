const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

// Files refactored in Paso 2 to delegate escapeHtml to window.portalUtils.
const DELEGATING_FILES = [
  "admin_audit", "script_redes_quiz", "guia_template", "shared_apps_script_delivery",
  "script_induccion", "python_online_lab", "student_calendar", "activity_delivery",
  "activity_deadlines", "productive_stage_student", "tutoring_bookings", "script",
  "script_guia6", "script_guia2", "guide_deadline_summary", "script_guia3",
  "script_guia_redes", "activity4_admin_report", "admin_usuarios",
  "productive_stage_admin", "productive_stage_project_delivery", "admin_export",
].map((n) => path.join("js", n + ".js"));

test("shared_utils.js exposes a canonical escapeHtml on window.portalUtils", () => {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read(path.join("js", "shared_utils.js")), sandbox);

  const escapeHtml = sandbox.window.portalUtils && sandbox.window.portalUtils.escapeHtml;
  assert.equal(typeof escapeHtml, "function");
  assert.equal(
    escapeHtml('<a href="x">&\'</a>'),
    "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"
  );
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("refactored modules delegate escapeHtml to the shared util (no duplicated bodies)", () => {
  DELEGATING_FILES.forEach((file) => {
    const source = read(file);
    assert.match(
      source,
      /function escapeHtml\(value\) \{\s*var u = window\.portalUtils;\s*if \(u && typeof u\.escapeHtml === "function"\) return u\.escapeHtml\(value\);/,
      `${file} should delegate escapeHtml to window.portalUtils`
    );
  });
});

test("shared_utils.js loads before portal_auth.js on consumer pages", () => {
  ["panel-administrativo-usuarios.html", path.join("pages", "guias", "santa-barbara-10a-guia-02-redes-rap01.html")].forEach((page) => {
    const html = read(page);
    const utilsIdx = html.indexOf("js/shared_utils.js");
    const authIdx = html.indexOf("js/portal_auth.js");
    assert.ok(utilsIdx >= 0, `${page} should load shared_utils.js`);
    assert.ok(authIdx >= 0, `${page} should load portal_auth.js`);
    assert.ok(utilsIdx < authIdx, `${page} should load shared_utils.js before portal_auth.js`);
  });
});
