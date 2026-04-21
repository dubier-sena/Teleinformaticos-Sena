const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const portalAuthJs = fs.readFileSync(path.join(root, "js", "portal_auth.js"), "utf8");

function expectIncludes(snippet, message) {
  assert(portalAuthJs.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

expectIncludes(
  "function shouldBypassAccessGuardsForLocalPreview() {",
  "portal_auth debe centralizar el bypass de permisos cuando el portal se abre en file:// para pruebas locales."
);
expectIncludes(
  'return /^file:$/i.test(String(window.location.protocol || ""));',
  "El bypass local debe activarse especificamente en contexto file://."
);

const bypassMatches = portalAuthJs.match(/if \(shouldBypassAccessGuardsForLocalPreview\(\)\) \{\s*return true;\s*\}/g) || [];
assert(
  bypassMatches.length >= 4,
  "Los guards de acceso base y parchados deben permitir navegacion local sin redirigir al index."
);

console.log("OK: portal_auth permite navegar el proyecto en file:// sin rebotar al index.");
