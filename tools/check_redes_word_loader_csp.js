const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(source, snippet, message) {
  assert(source.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

function expectNotIncludes(source, snippet, message) {
  assert(!source.includes(snippet), `${message}\nNo esperado: ${snippet}`);
}

const page10A = read("santa-barbara-10a-guia-02-redes-rap01.html");
const page10B = read("santa-barbara-10b-guia-02-redes-rap01.html");
const guideJs = read(path.join("js", "script_guia_redes.js"));

for (const [label, page] of [
  ["10A", page10A],
  ["10B", page10B],
]) {
  expectIncludes(
    page,
    "script-src 'self' 'unsafe-inline' blob:;",
    `La guia ${label} debe mantener CSP que solo permite scripts locales o blob.`
  );
  expectIncludes(
    page,
    'js/script_guia_redes.js?v=20260421_2',
    `La guia ${label} debe apuntar a la version nueva de script_guia_redes.js para evitar cache antiguo.`
  );
}

expectIncludes(
  guideJs,
  'const response = await fetch(url, { cache: "force-cache" });',
  "La carga de la libreria de Word debe obtener el script por fetch para cumplir la CSP."
);
expectIncludes(
  guideJs,
  'const blobUrl = URL.createObjectURL(new Blob([scriptText], { type: "text/javascript" }));',
  "La carga de la libreria de Word debe convertir el script remoto a blob local."
);
expectIncludes(
  guideJs,
  "s.src = blobUrl;",
  "La libreria de Word debe ejecutarse desde un blob permitido por la CSP."
);
expectNotIncludes(
  guideJs,
  "s.src = url;",
  "La libreria de Word ya no debe cargarse directamente desde una URL remota bloqueada por la CSP."
);

console.log("OK: la guia de redes carga la libreria Word de forma compatible con la CSP.");
