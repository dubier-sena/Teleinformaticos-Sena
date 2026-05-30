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
  'protocol === "file:"',
  "El bypass local debe activarse en contexto file://."
);
expectIncludes(
  'hostname === "localhost"',
  "El bypass local debe activarse tambien cuando se prueba desde localhost."
);

const bypassMatches = portalAuthJs.match(/if \(shouldBypassAccessGuardsForLocalPreview\(\)\) \{\s*return true;\s*\}/g) || [];
assert(
  bypassMatches.length === 2,
  "Los guards de guias deben permitir navegacion local directa."
);

for (const functionName of ["requireAdminAccess", "requireAdminAccessPatched"]) {
  const block = portalAuthJs.match(new RegExp("function " + functionName + "\\(options\\) \\{[\\s\\S]*?\\n  \\}"));
  assert(block, `Debe existir ${functionName}.`);
  assert(
    block[0].includes("shouldBypassAccessGuardsForLocalPreview()"),
    `${functionName} debe permitir navegacion administrativa en vista local.`
  );
  assert(
    /persistSession(?:Record)?\(\{[\s\S]*role:\s*"admin"[\s\S]*token:\s*"local-preview"/.test(block[0]),
    `${functionName} debe crear una sesion admin local para que el panel cargue sus modulos.`
  );
}

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

console.log("OK: portal_auth permite guias y admin en vista local sin abrir dominios publicados.");
