const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

test("firebase runtime setup instructions live in docs instead of the runtime script", () => {
  const source = read(path.join("js", "firebase_db.js"));
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));

  assert.doesNotMatch(source, /INSTRUCCIONES DE CONFIGURACION PASO A PASO/);
  assert.match(docs, /Firebase runtime/);
  assert.match(docs, /sena_portal_firebase_runtime_v1/);
});

test("firestore rules are not open for production data", () => {
  const rules = read("firestore.rules");
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));

  assert.doesNotMatch(rules, /allow\s+read\s*,\s*write\s*:\s*if\s+true/);
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /adminEmails/);
  assert.match(docs, /Modo recomendado/);
  assert.match(docs, /cliente estatico publico no debe escribir directamente/i);
});

test("firebase migration documents the required academic identity", () => {
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));
  const authSource = read(path.join("js", "portal_auth.js"));

  ["fullName", "ficha", "inst", "grado", "grupo", "usernameKey"].forEach((field) => {
    assert.match(docs, new RegExp("`" + field + "`"));
  });
  assert.match(authSource, /grado:\s*selection\.grado/);
  assert.match(authSource, /localStorage\.setItem\("sena_grado"/);
});
