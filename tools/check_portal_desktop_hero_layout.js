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
  "margin-top: 0;"
];

const missing = expectations.filter((snippet) => !css.includes(snippet));

if (missing.length) {
  console.error("Desktop hero layout regression detected.");
  missing.forEach((snippet) => console.error(`Missing: ${snippet}`));
  process.exit(1);
}

console.log("Desktop hero layout markers present.");
