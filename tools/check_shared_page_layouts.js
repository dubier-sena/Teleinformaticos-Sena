const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(source, snippet, message) {
  if (!source.includes(snippet)) {
    throw new Error(`${message}\nMissing: ${snippet}`);
  }
}

const portalCss = read("css/page_portal.css");
const calendarCss = read("css/page_calendar.css");
const guideCss = read("css/guia_template.css");
const induction10a = read("grupo-10a-guia-01-induccion.html");
const induction10b = read("grupo-10b-guia-01-induccion.html");

assertIncludes(
  portalCss,
  "width: min(1480px, calc(100% - 48px));",
  "Portal desktop container is still too narrow for wide PC browsers."
);

assertIncludes(
  calendarCss,
  ".app-shell--calendar .app-hero__inner {",
  "Calendar is missing a desktop-width override for the shared hero shell."
);
assertIncludes(
  calendarCss,
  "width: min(1480px, calc(100% - 40px));",
  "Calendar desktop container is still too narrow for wide PC browsers."
);

assertIncludes(
  guideCss,
  "width: min(1180px, calc(100vw - var(--sidebar-w) - 88px));",
  "Guide content area is still capped too narrowly on desktop."
);

assertIncludes(
  induction10a,
  "href=\"css/guia_template.css?v=20260409_2\"",
  "Guia 1 10A is not using the shared guide template stylesheet."
);

assertIncludes(
  induction10b,
  "href=\"css/guia_template.css?v=20260409_2\"",
  "Guia 1 10B is not using the shared guide template stylesheet."
);

console.log("Shared page layout markers present.");
