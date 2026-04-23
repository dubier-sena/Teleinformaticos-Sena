const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "script.js"),
  "utf8"
);

test("script.js exposes an idempotent runtime init hook for guia 5", () => {
  assert.match(script, /let guia5Booted = false/);
  assert.match(script, /function initGuia5\(\)/);
  assert.match(script, /window\.initGuia5 = initGuia5/);
  assert.match(script, /renderStatefulSections\(\)/);
  assert.match(script, /renderConceptLegend\(\)/);
  assert.match(script, /renderEvidenceTable\(\)/);
  assert.match(script, /renderGlossary\(\)/);
  assert.match(script, /renderSupportMaterials\(\)/);
  assert.match(script, /renderDriveDeliveryPanel\(\)/);
  assert.match(script, /initializeCloudStateSync\(\)/);
});

test("script.js keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__PAGE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuia5\);\s*\}/s
  );
});
