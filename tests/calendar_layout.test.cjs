const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("calendar hero removes campaign text and keeps sync controls on one line", () => {
  const html = read("calendario-academico-2026.html");
  const css = read("css/page_calendar.css");

  assert.match(html, /<div id="title">Calendario<\/div>/);
  assert.doesNotMatch(html, /Calendario Pro 2026/);
  assert.doesNotMatch(html, /class="calendar-hero__range"/);
  assert.match(html, /class="calendar-hero__actions calendar-hero__actions--inline"/);
  assert.match(html, /id="save-chip">Guardado local<\/div>\s*<div id="sync-chip"/);

  assert.match(css, /\.calendar-hero__actions--inline/);
  assert.match(css, /flex-direction:\s*row/);
  assert.match(css, /flex-wrap:\s*nowrap/);
});

test("calendar layout gives the month grid more visible space", () => {
  const css = read("css/page_calendar.css");

  assert.match(css, /\.app-shell--calendar \.app-main\s*\{\s*width:\s*min\(1760px, calc\(100% - 20px\)\)/);
  assert.match(css, /\.calendar-hero__panel\s*\{[\s\S]*max-width:\s*1560px/);
  assert.match(css, /#header-top\s*\{[\s\S]*padding:\s*14px 22px 10px/);
  assert.match(css, /\.calendar-main-shell\s*\{[\s\S]*padding:\s*14px 0 28px/);
  assert.match(css, /\.cal-cell\s*\{[\s\S]*min-height:\s*116px/);
});
