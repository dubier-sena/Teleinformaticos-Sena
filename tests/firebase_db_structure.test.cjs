const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

// docs/ esta en .gitignore a proposito (documentacion tecnica interna, ver
// README "Seguridad": "no se publican en el repositorio"). Solo existe en
// checkouts locales; un checkout limpio de CI no lo tiene. Estas 3 pruebas
// se saltan ahi en vez de fallar.
const DOCS_PATH = path.join(REPO_ROOT, "docs", "firebase-runtime-setup.md");
const DOCS_EXISTS = fs.existsSync(DOCS_PATH);
const SKIP_REASON = "docs/ no existe en este checkout (gitignored a proposito)";

test("firebase_db.js does not keep the step-by-step setup instructions inline", () => {
  const source = read(path.join("js", "firebase_db.js"));
  assert.doesNotMatch(source, /INSTRUCCIONES DE CONFIGURACION PASO A PASO/);
});

test("firebase runtime setup instructions live in docs", { skip: !DOCS_EXISTS && SKIP_REASON }, () => {
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));
  assert.match(docs, /Firebase runtime/);
  assert.match(docs, /sena_portal_firebase_runtime_v1/);
});

test("firestore rules are not open for production data", () => {
  // Esta parte NUNCA se salta: es la verificacion de seguridad real
  // (firestore.rules siempre esta commiteado, a diferencia de docs/).
  const rules = read("firestore.rules");
  assert.doesNotMatch(rules, /allow\s+read\s*,\s*write\s*:\s*if\s+true/);
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /adminEmails/);
});

test("firestore rules recommended mode is documented in docs", { skip: !DOCS_EXISTS && SKIP_REASON }, () => {
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));
  assert.match(docs, /Modo recomendado/);
  assert.match(docs, /cliente estatico publico no debe escribir directamente/i);
});

test("portal_auth.js implements the required academic identity fields", () => {
  const authSource = read(path.join("js", "portal_auth.js"));
  assert.match(authSource, /grado:\s*selection\.grado/);
  assert.match(authSource, /localStorage\.setItem\("sena_grado"/);
});

test("firebase migration docs document the required academic identity", { skip: !DOCS_EXISTS && SKIP_REASON }, () => {
  const docs = read(path.join("docs", "firebase-runtime-setup.md"));
  ["fullName", "ficha", "inst", "grado", "grupo", "usernameKey"].forEach((field) => {
    assert.match(docs, new RegExp("`" + field + "`"));
  });
});
