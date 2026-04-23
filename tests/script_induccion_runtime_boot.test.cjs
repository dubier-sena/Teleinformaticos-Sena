const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "script_induccion.js"),
  "utf8"
);

test("script_induccion exposes an idempotent runtime init hook", () => {
  assert.match(script, /let induccionBooted = false/);
  assert.match(script, /function initInduccion\(\)/);
  assert.match(script, /window\.initInduccion = initInduccion/);
  assert.match(script, /renderStatefulSections\(\)/);
  assert.match(script, /renderVideoGrid\(\)/);
  assert.match(script, /renderEvidenceTable\(\)/);
  assert.match(script, /renderGlossary\(\)/);
  assert.match(script, /initializeCloudStateSync\(\)/);
});

test("script_induccion keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__PAGE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initInduccion\);\s*\}/s
  );
});
