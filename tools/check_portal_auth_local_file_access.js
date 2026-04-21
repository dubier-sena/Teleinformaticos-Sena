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

const patchStart = portalAuthJs.indexOf("const auth = window.portalAuth;");
const requireFileAccessPatchedStart = portalAuthJs.indexOf("function requireFileAccessPatched(fileName, options) {");
assert(
  patchStart >= 0 && requireFileAccessPatchedStart > patchStart,
  "Debe existir el bloque parcheado de portal_auth para validar el bypass local."
);
const patchedPrelude = portalAuthJs.slice(patchStart, requireFileAccessPatchedStart);
assert(
  patchedPrelude.includes("function shouldBypassAccessGuardsForLocalPreview() {"),
  "El bloque parcheado de portal_auth debe declarar su propio helper de bypass local para no depender del cierre anterior."
);

console.log("OK: portal_auth permite navegar el proyecto en file:// sin rebotar al index.");
