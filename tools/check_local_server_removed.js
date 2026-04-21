const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertNotIncludes(content, unexpected, label) {
  if (content.includes(unexpected)) {
    throw new Error(`Sobra ${label}: ${unexpected}`);
  }
}

function assertMissing(relativePath) {
  if (fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Sigue presente el archivo: ${relativePath}`);
  }
}

const html = read("index.html");
const css = read(path.join("css", "page_portal.css"));
const structureCheck = read(path.join("tools", "validar_estructura_portal.ps1"));
const adminCheck = read(path.join("tools", "check_admin_activity_identity_and_ficha.js"));

[
  "Servidor local para la red actual",
  "Compartir en Red Local",
  'id="share-panel"',
  "refreshShareStatus()",
  "copyShareUrl()",
  "stopShareServer()",
  "const SHARE_PORT = 8080;",
  "let currentShareUrl = \"\";",
  "function buildShareEndpoint(pathname)",
  "function configureShareStartButton()",
  "function refreshShareStatus()",
  "function copyShareUrl()",
  "function stopShareServer()",
  "tools/iniciar_servidor_red.cmd"
].forEach((snippet) => assertNotIncludes(html, snippet, "referencia del servidor local en index.html"));

[
  ".share-panel {",
  ".share-header {",
  ".share-meta {",
  ".share-status-badge",
  ".share-network-list",
  ".share-network-card",
  ".app-shell--portal .share-panel",
  ".app-shell--portal .share-header h3",
  ".app-shell--portal .share-meta-card",
  ".app-shell--portal .share-network-card",
  ".app-shell--portal .share-actions"
].forEach((snippet) => assertNotIncludes(css, snippet, "estilo del servidor local en page_portal.css"));

[
  "tools/servidor_web_red.ps1",
  "tools/prueba_carga_servidor_local.ps1",
  "iniciar_servidor_red",
  "detener_servidor_red"
].forEach((snippet) => assertNotIncludes(structureCheck, snippet, "validacion obsoleta del servidor local"));

[
  "tools/servidor_web_red.ps1",
  "/api/admin/ficha",
  "endpoint del servidor local para ficha",
  "persistencia de ficha en servidor local"
].forEach((snippet) => assertNotIncludes(adminCheck, snippet, "assertion obsoleta del servidor local"));

[
  path.join("tools", "iniciar_servidor_red.cmd"),
  path.join("tools", "detener_servidor_red.cmd"),
  path.join("tools", "detener_servidor_red.ps1"),
  path.join("tools", "servidor_web_red.ps1"),
  path.join("tools", "prueba_carga_servidor_local.ps1")
].forEach(assertMissing);

console.log("OK: el proyecto ya no conserva referencias al servidor local.");
