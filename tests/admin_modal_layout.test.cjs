const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/page_admin.css"), "utf8");

test("admin response modal stays below the fixed navbar and scrolls internally", () => {
  assert.match(css, /\.modal-shell\s*\{[\s\S]*z-index:\s*1200/);
  assert.match(css, /\.modal-shell\s*\{[\s\S]*padding:\s*calc\(var\(--navbar-height,\s*60px\) \+ 14px\) 14px 14px/);
  assert.match(css, /\.modal-card\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--navbar-height,\s*60px\) - 28px\)/);
  assert.match(css, /\.modal-header\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-meta\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*min-height:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*overflow:\s*auto/);
});
