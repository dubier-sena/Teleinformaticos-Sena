const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(source, snippet, message) {
  assert(
    source.includes(snippet),
    `${message}\nEsperado: ${snippet}`
  );
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
    "genera tu entrega en Word",
    `La guia ${label} debe indicar que la exploracion contextual se entrega en Word.`
  );
  expectIncludes(
    page,
    'onclick="exportarWordContextualizacion()"',
    `La guia ${label} debe usar el exportador de Word para la exploracion contextual.`
  );
  expectIncludes(
    page,
    "Generar Word &mdash; Exploraci&oacute;n Contextual",
    `La guia ${label} debe mostrar el boton de Word en la exploracion contextual.`
  );
  expectIncludes(
    page,
    "compilados en un solo documento Word titulado",
    `La guia ${label} debe describir la entrega compilada como documento Word.`
  );
  expectIncludes(
    page,
    "Exploracion_Contextual_NombreAprendiz_FICHA.docx",
    `La guia ${label} debe mostrar el nombre de archivo .docx esperado para la exploracion contextual.`
  );
}

expectIncludes(
  guideJs,
  'const user = session && session.user ? session.user : null;',
  "La exportacion contextual debe resolver la identidad desde session.user."
);
expectIncludes(
  guideJs,
  'const fullName = (user && user.fullName) || "Aprendiz";',
  "La exportacion contextual debe usar el nombre completo real del aprendiz."
);
expectIncludes(
  guideJs,
  'const ficha    = (user && user.ficha)    || "0000";',
  "La exportacion contextual debe usar la ficha real del aprendiz."
);
expectIncludes(
  guideJs,
  'evidence: "Producto: Exploracion_Contextual_NombreAprendiz_FICHA.docx (5 productos compilados).",',
  "La evidencia de la exploracion contextual debe estar documentada como Word."
);

console.log("OK: la exploracion contextual de redes esta alineada con Word en UI y logica.");
