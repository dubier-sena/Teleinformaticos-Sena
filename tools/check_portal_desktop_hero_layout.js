const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "css", "page_portal.css");
const css = fs.readFileSync(cssPath, "utf8");

const expectations = [
  "width: min(1360px, calc(100% - 48px));",
  "grid-template-columns: minmax(0, 1.24fr) minmax(360px, 0.76fr);",
  "align-items: start;",
  "max-width: 13.5ch;",
  "font-size: clamp(3rem, 3.8vw, 4.4rem);",
  "max-width: 36rem;",
  "margin-top: clamp(3rem, 7vw, 6rem);"
];

const missing = expectations.filter((snippet) => !css.includes(snippet));

if (missing.length) {
  console.error("Desktop hero layout regression detected.");
  missing.forEach((snippet) => console.error(`Missing: ${snippet}`));
  process.exit(1);
}

console.log("Desktop hero layout markers present.");
