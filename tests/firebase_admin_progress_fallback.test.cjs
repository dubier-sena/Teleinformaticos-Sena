const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

test("firebase admin progress maps batchGet docs by document id and falls back to guide snapshots", () => {
  const source = read(path.join("js", "firebase_db.js"));
  // Fase 14: deriveProgressFromGuideDataDoc se movio a guide_merge_utils.js
  // (misma logica, sin cambios) -- firebase_db.js solo la LLAMA ahora.
  const mergeUtils = read(path.join("js", "guide_merge_utils.js"));

  assert.match(source, /_docId:\s*String\(doc\.name/);
  assert.match(source, /progressDocs\.forEach\(function \(doc\)/);
  assert.match(source, /progressByUser\[doc\._docId\]\s*=\s*doc/);
  assert.match(mergeUtils, /function deriveProgressFromGuideDataDoc\(fileName,\s*doc\)/);
  assert.match(source, /guideDataDocs\.forEach\(function \(doc\)/);
  assert.match(source, /progressByUser\[item\.usernameKey\]\[item\.progressKey\]\s*=\s*derived/);
});

test("guide progress writers do not persist zero-total placeholders", () => {
  const portalAuth = read(path.join("js", "portal_auth.js"));
  const firebaseDb = read(path.join("js", "firebase_db.js"));

  assert.match(portalAuth, /if \(total <= 0\) \{\s*return;\s*\}/);
  assert.match(firebaseDb, /if \(total <= 0\) return;/);
});
