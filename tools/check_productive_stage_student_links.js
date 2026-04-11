const fs = require("fs");
const path = require("path");

const root = process.cwd();
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const indexJs = fs.readFileSync(path.join(root, "js", "index_auth.js"), "utf8");
const guideTemplateJs = fs.readFileSync(path.join(root, "js", "guia_template.js"), "utf8");

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(indexHtml, 'id="auth-student-actions"', "contenedor de acciones del estudiante");
assertIncludes(indexHtml, 'id="btn-productive-stage-access"', "boton del portal hacia etapa productiva");
assertIncludes(indexJs, "etapa-productiva-estudiante.html", "enlace de etapa productiva en index_auth");
assertIncludes(indexJs, "Mi proyecto y retroalimentacion", "texto del acceso de etapa productiva en el portal");
assertIncludes(guideTemplateJs, "etapa-productiva-estudiante.html", "enlace de etapa productiva dentro de la plantilla de guias");
assertIncludes(guideTemplateJs, "Mi proyecto", "rotulo del acceso de etapa productiva en guias 11");

console.log("OK: el portal y las guias 11 enlazan la vista privada de etapa productiva.");
