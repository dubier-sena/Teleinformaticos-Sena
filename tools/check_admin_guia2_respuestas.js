const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const adminHtmlPath = path.join(projectRoot, "panel-administrativo-usuarios.html");
const adminJsPath = path.join(projectRoot, "js", "admin_usuarios.js");
const guidePages = [
  {
    guidePath: path.join(projectRoot, "grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
    formPath: path.join(projectRoot, "grupo-10a-guia-02-actividad-4-formulario.html"),
  },
  {
    guidePath: path.join(projectRoot, "grupo-10b-guia-02-herramientas-informaticas-digitales.html"),
    formPath: path.join(projectRoot, "grupo-10b-guia-02-actividad-4-formulario.html"),
  },
];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

const adminHtml = read(adminHtmlPath);
const adminJs = read(adminJsPath);
const questionnaireFields = [
  'data-store="contexto-q1"',
  'data-store="contexto-rel-drive"',
  'data-store="contexto-tendero"',
  'data-store="contexto-q4"',
  'data-store="contexto-docente-correo-si"',
  'data-store="contexto-nube"',
  'data-store="contexto-backup-verificar"',
  'data-store="contexto-info-problem"',
  'data-store="contexto-uso-word-si"',
  'data-store="contexto-otanche"',
];

guidePages.forEach(({ guidePath, formPath }) => {
  const guideHtml = read(guidePath);
  const formHtml = read(formPath);
  assertIncludes(
    guideHtml,
    path.basename(formPath),
    `enlace al formulario independiente en ${path.basename(guidePath)}`
  );

  questionnaireFields.forEach((key) => {
    assertIncludes(
      formHtml,
      key,
      `campo del cuestionario 3.2.1 en ${path.basename(formPath)}`
    );
  });
});

assertIncludes(adminHtml, 'id="guide2-responses-modal"', "modal admin de respuestas");
assertIncludes(adminJs, "data-view-guide2", "boton para ver respuestas de Guia 2");
assertIncludes(adminJs, "contexto-q1", "mapeo de la pregunta 1");
assertIncludes(adminJs, "contexto-otanche", "mapeo de la pregunta 10");

console.log("Verificacion de estructura admin/Guia 2 completada.");
