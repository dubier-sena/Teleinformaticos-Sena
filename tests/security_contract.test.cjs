const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(REPO_ROOT, fileName), "utf8");
}

test("server-side Firebase scripts do not keep real API keys in source", () => {
  const appsScript = read(path.join("apps-script", "respaldo_firestore.gs"));
  const rosterSync = read(path.join("tools", "sync_jfk_10b_roster.cjs"));

  assert.doesNotMatch(appsScript, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(rosterSync, /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(appsScript, /PropertiesService\.getScriptProperties\(\)/);
  assert.match(rosterSync, /requireEnv\("FIREBASE_API_KEY"\)/);
});

// docs/ esta en .gitignore a proposito (documentacion tecnica interna, ver
// README "Seguridad"); no existe en un checkout limpio de CI.
const DOCS_DIR = path.join(REPO_ROOT, "docs");
const DOCS_EXISTS = fs.existsSync(DOCS_DIR);

test("technical audit docs do not publish real password hashes", { skip: !DOCS_EXISTS && "docs/ no existe en este checkout (gitignored a proposito)" }, () => {
  const docsDir = DOCS_DIR;
  const docs = fs
    .readdirSync(docsDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => [fileName, read(path.join("docs", fileName))]);

  docs.forEach(([fileName, content]) => {
    assert.doesNotMatch(
      content,
      /passwordHash:\s*["'][a-f0-9]{64}["']/i,
      `${fileName} should redact concrete password hashes`
    );
  });
});

test("admin access guards only bypass authentication for local preview mode", () => {
  const source = read(path.join("js", "portal_auth.js"));
  const guardBlocks = [
    source.match(/function requireAdminAccess\(options\) \{[\s\S]*?\n  \}/),
    source.match(/function requireAdminAccessPatched\(options\) \{[\s\S]*?\n  \}/),
  ];

  assert.match(source, /protocol === "file:"/);
  assert.match(source, /hostname === "localhost"/);
  assert.match(source, /hostname === "127\.0\.0\.1"/);

  guardBlocks.forEach((block, index) => {
    assert.ok(block, `admin guard block ${index + 1} should exist`);
    assert.match(block[0], /shouldBypassAccessGuardsForLocalPreview\(\)/);
    assert.match(block[0], /isAdminSession/);
  });
});

test("admin gate is confirmed server-side against the Firestore role doc", () => {
  const source = read(path.join("js", "portal_auth.js"));
  const block = source.match(
    /async function confirmAdminAccessServerSide\(options\) \{[\s\S]*?\n  \}/
  );

  assert.ok(block, "confirmAdminAccessServerSide should exist");
  const body = block[0];

  // Verifica contra el doc role del servidor, no solo contra localStorage.
  assert.match(source, /sena_portal_roles\/\$\{encodeURIComponent\(uid\)\}/);
  assert.match(source, /function fetchAdminRoleVerdict\(\)/);

  // Solo degrada ante un negativo definitivo; tolera "unknown" (offline/red).
  assert.match(body, /verdict !== "not-admin"/);
  assert.match(body, /return verdict === "admin"/);

  // 404 (sin doc role) es negativo definitivo; 401/403 NO degradan.
  assert.match(source, /res\.status === 404[\s\S]*?return "not-admin"/);
  assert.match(source, /res\.status === 401 \|\| res\.status === 403[\s\S]*?return "unknown"/);

  // No corre en preview local ni cuando la sesion no reclama admin.
  assert.match(body, /isLocalPreviewContext\(\)/);
  assert.match(body, /auth\.isAdminSession\(\)/);

  // Al detectar una sesion que finge admin, cierra sesion y expulsa.
  assert.match(body, /auth\.logout/);
  assert.match(body, /window\.location\.replace/);

  // Expuesto en la API y auto-agendado fuera de index.html (carrera de bootstrap).
  assert.match(source, /auth\.confirmAdminAccessServerSide = confirmAdminAccessServerSide;/);
  assert.match(source, /page === "index\.html"/);
});

test("tutoring booking rules restrict write access to admins or booking owner", () => {
  const rules = read("firestore.rules");
  const tutoringBlock = rules.match(/match \/sena_portal_tutoring_bookings\/\{bookingId\} \{[\s\S]*?\n    \}/);

  assert.ok(tutoringBlock, "tutoring booking rule block should exist");
  assert.doesNotMatch(tutoringBlock[0], /allow create:\s*if signedIn\(\);/);
  assert.match(tutoringBlock[0], /isTutoringOwnerOfRequest\(\)/);
  assert.match(tutoringBlock[0], /isTutoringOwnerOfResource\(\)/);
  assert.match(tutoringBlock[0], /isValidTutoringBooking\(\)/);
  assert.match(tutoringBlock[0], /durationMinutes in \[30, 60\]/);
  assert.match(tutoringBlock[0], /startTime in \[/);
});
