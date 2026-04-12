const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "css", "page_portal.css");
const css = fs.readFileSync(cssPath, "utf8");

const expectations = [
  "width: min(1480px, calc(100% - 48px));",
  "@media (min-width: 1100px) {",
  "grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);",
  "justify-items: stretch;",
  "text-align: left;",
  "align-items: center;",
  ".app-shell--portal .header h1 {",
  "grid-column: 1;",
  "max-width: 8.6ch;",
  "font-size: clamp(3.2rem, 4.6vw, 5rem);",
  ".app-shell--portal .info-grid {",
  "grid-column: 2;",
  "grid-row: 1 / span 4;",
  "max-width: 460px;",
  "margin-left: auto;"
];

const missing = expectations.filter((snippet) => !css.includes(snippet));

if (missing.length) {
  console.error("Desktop hero layout regression detected.");
  missing.forEach((snippet) => console.error(`Missing: ${snippet}`));
  process.exit(1);
}

console.log("Desktop hero layout markers present.");
