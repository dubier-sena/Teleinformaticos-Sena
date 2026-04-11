const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "css", "page_portal.css");
const css = fs.readFileSync(cssPath, "utf8");

const expectations = [
  "width: min(1480px, calc(100% - 48px));",
  "@media (min-width: 1100px) {",
  "grid-template-columns: 1fr;",
  "justify-items: center;",
  "text-align: center;",
  "align-items: center;",
  ".app-shell--portal .hero-welcome {",
  "max-width: 10.5ch;",
  "font-size: clamp(3.05rem, 4vw, 4.5rem);",
  "max-width: min(100%, 760px);",
  "margin-inline: auto;"
];

const missing = expectations.filter((snippet) => !css.includes(snippet));

if (missing.length) {
  console.error("Desktop hero layout regression detected.");
  missing.forEach((snippet) => console.error(`Missing: ${snippet}`));
  process.exit(1);
}

console.log("Desktop hero layout markers present.");
