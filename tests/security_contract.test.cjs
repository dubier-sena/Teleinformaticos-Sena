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

test("technical audit docs do not publish real password hashes", () => {
  const docsDir = path.join(REPO_ROOT, "docs");
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
