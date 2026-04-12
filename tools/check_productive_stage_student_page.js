const fs = require("fs");
const path = require("path");

const root = process.cwd();
const htmlPath = path.join(root, "etapa-productiva-estudiante.html");
const jsPath = path.join(root, "js", "productive_stage_student.js");
const cssPath = path.join(root, "css", "page_productive_stage_student.css");

if (!fs.existsSync(htmlPath)) {
  throw new Error("Falta etapa-productiva-estudiante.html");
}

if (!fs.existsSync(jsPath)) {
  throw new Error("Falta js/productive_stage_student.js");
}

if (!fs.existsSync(cssPath)) {
  throw new Error("Falta css/page_productive_stage_student.css");
}

const html = fs.readFileSync(htmlPath, "utf8");
const js = fs.readFileSync(jsPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(html, 'id="productive-stage-student-shell"', "shell principal del estudiante");
assertIncludes(html, 'id="student-project-summary"', "resumen del proyecto");
assertIncludes(html, 'id="student-project-reports"', "listado de informes");
assertIncludes(html, 'src="js/productive_stage_store.js?v=20260411_4"', "store de etapa productiva");
assertIncludes(js, '["3168850", "3168852"]', "fichas permitidas para etapa productiva");
assertIncludes(js, "renderStudentProjectView", "render principal del estudiante");
assertIncludes(js, "renderEmptyState", "estado vacio del estudiante");
assertIncludes(css, ".productive-stage-student", "estilos base de la pagina privada");

console.log("OK: la pagina privada del estudiante de etapa productiva existe con sus bloques principales.");
