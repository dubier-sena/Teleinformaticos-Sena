const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "script_guia6.js"),
  "utf8"
);

test("script_guia6 exposes an idempotent runtime init hook", () => {
  assert.match(script, /let guia6Booted = false/);
  assert.match(script, /function initGuia6\(\)/);
  assert.match(script, /window\.initGuia6 = initGuia6/);
  assert.match(script, /renderStatefulSections\(\)/);
  assert.match(script, /renderEvidenceTable\(\)/);
  assert.match(script, /renderGlossary\(\)/);
  assert.match(script, /renderSupportMaterials\(\)/);
  assert.match(script, /renderDriveDeliveryPanel\(\)/);
  assert.match(script, /updateBudgetSummary\(\)/);
  assert.match(script, /initializeCloudStateSync\(\)/);
});

test("script_guia6 keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__PAGE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuia6\);\s*\}/s
  );
});
