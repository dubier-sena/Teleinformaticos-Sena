const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adminScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "admin_usuarios.js"),
  "utf8"
);

test("panel admin expone habilitacion individual para los laboratorios de redes", () => {
  assert.match(adminScript, /REDES_LAB_ACTIVITIES/);
  assert.match(adminScript, /id:\s*"lab1"/);
  assert.match(adminScript, /keys:\s*\[\s*"lab1-locked"\s*\]/);
  assert.match(adminScript, /id:\s*"lab2"/);
  assert.match(adminScript, /keys:\s*\[\s*"lab2-locked"\s*\]/);
  assert.match(adminScript, /id:\s*"lab3"/);
  assert.match(adminScript, /keys:\s*\[\s*"lab3-locked"\s*\]/);
  assert.match(adminScript, /data-unlock-redes-activity/);
});

