const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const requiredFiles = [
  "css/site_tokens.css",
  "css/shared_shell.css",
  "js/shared_shell.js",
  "js/shared_drive_delivery.js",
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing shared foundation file: ${relativePath}`);
  }
}

const gitignoreLines = new Set(
  fs
    .readFileSync(path.join(projectRoot, ".gitignore"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
);

if (!gitignoreLines.has(".superpowers/")) {
  throw new Error("Missing .superpowers/ ignore rule in .gitignore");
}

console.log("Shared foundation files present.");
