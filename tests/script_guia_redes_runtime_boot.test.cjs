const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "script_guia_redes.js"),
  "utf8"
);

test("script_guia_redes exposes an idempotent runtime init hook", () => {
  assert.match(script, /let redesBooted = false/);
  assert.match(script, /function initGuiaRedes\(\)/);
  assert.match(script, /window\.initGuiaRedes = initGuiaRedes/);
  assert.match(script, /renderEvidenceTable\(\)/);
  assert.match(script, /renderQuizRedesStatus\(\)/);
  assert.match(script, /bindEventsRedes\(\)/);
  assert.match(script, /initCloudSyncRedes\(\)/);
});

test("script_guia_redes keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__GUIDE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuiaRedes\);\s*\}/s
  );
});
