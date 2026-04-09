const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "css", "page_portal.css");
const css = fs.readFileSync(cssPath, "utf8");

const expectations = [
  "width: min(1480px, calc(100% - 48px));",
  "@media (min-width: 1100px) {",
  "grid-template-columns: minmax(0, 1.22fr) minmax(360px, 420px);",
  "align-items: center;",
  "max-width: 15.4ch;",
  "font-size: clamp(3rem, 3.7vw, 4.5rem);",
  "max-width: min(100%, 420px);",
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
