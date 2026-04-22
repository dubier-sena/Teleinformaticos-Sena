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

const adminJs = read(path.join("js", "admin_usuarios.js"));

expectIncludes(
  adminJs,
  "let redesQuizSummaries = {};",
  "El panel admin debe mantener un cache de intentos del quiz de redes."
);
expectIncludes(
  adminJs,
  'state?.["quiz-redes-321h"]',
  "El panel admin debe leer el intento del quiz desde el snapshot de redes."
);
expectIncludes(
  adminJs,
  "hydrateRedesQuizSummaries",
  "El panel admin debe hidratar los resultados del quiz de redes."
);
expectIncludes(
  adminJs,
  "buildRedesQuizTable",
  "El panel admin debe renderizar una tabla para los intentos del quiz de redes."
);
expectIncludes(
  adminJs,
  "Quiz 3.2.1.H - Redes Santa Barbara",
  "La pestaña Actividades debe mostrar una seccion dedicada al quiz 3.2.1.H."
);
expectIncludes(
  adminJs,
  "summary.variant",
  "La tabla del admin debe mostrar la variante aleatoria asignada."
);
expectIncludes(
  adminJs,
  "summary.warningCount",
  "La tabla del admin debe mostrar las advertencias del intento."
);
expectIncludes(
  adminJs,
  "renderRedesQuizDetail",
  "El admin debe construir una vista detallada del intento del quiz."
);
expectIncludes(
  adminJs,
  "evidenceEvents",
  "El detalle del admin debe incluir la evidencia de cambios de visibilidad."
);

console.log("OK: el panel admin integra resumen y detalle del quiz 3.2.1.H.");
