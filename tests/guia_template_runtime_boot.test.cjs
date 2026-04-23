const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "guia_template.js"),
  "utf8"
);

test("guia_template exposes an idempotent runtime init hook", () => {
  assert.match(script, /let guideTemplateBooted = false/);
  assert.match(script, /function initGuiaTemplateShell\(\)/);
  assert.match(script, /if \(guideTemplateBooted\) \{\s*return;\s*\}/s);
  assert.match(script, /window\.initGuiaTemplateShell = initGuiaTemplateShell/);
});

test("guia_template keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__GUIDE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuiaTemplateShell\);\s*\}/s
  );
});
