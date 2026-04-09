const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "css", "page_portal.css");
const css = fs.readFileSync(cssPath, "utf8");

const expectations = [
  "width: min(1180px, calc(100% - 40px));",
  "@media (min-width: 1100px) {",
  "grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);",
  "align-items: center;",
  "max-width: 12.6ch;",
  "font-size: clamp(2.9rem, 3.6vw, 4.2rem);",
  "max-width: min(100%, 430px);",
  "@media (max-width: 1099px) {",
  "max-width: min(100%, 760px);",
  "@media (min-width: 641px) and (max-width: 1099px) {",
  "grid-template-columns: repeat(2, minmax(220px, 1fr));",
  "@media (max-width: 640px) {",
  ".app-shell--portal .info-grid {",
  "grid-template-columns: 1fr;"
];

const missing = expectations.filter((snippet) => !css.includes(snippet));

if (missing.length) {
  console.error("Responsive portal layout regression detected.");
  missing.forEach((snippet) => console.error(`Missing: ${snippet}`));
  process.exit(1);
}

console.log("Responsive portal layout markers present.");
