const fs = require("fs");
const path = require("path");

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "etapa-productiva-estudiante.html"), "utf8");
const studentJs = fs.readFileSync(path.join(root, "js", "productive_stage_student.js"), "utf8");
const deliveryJs = fs.readFileSync(
  path.join(root, "js", "productive_stage_project_delivery.js"),
  "utf8"
);
const css = fs.readFileSync(path.join(root, "css", "page_productive_stage_student.css"), "utf8");

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(html, 'id="student-project-resources"', "panel de documentos base");
assertIncludes(html, 'id="student-project-delivery"', "panel de avance del proyecto");
assertIncludes(html, 'src="js/project_integrations.js', "configuracion de integraciones");
assertIncludes(html, 'src="js/shared_apps_script_delivery.js', "helper de subida segura");
assertIncludes(html, 'src="js/productive_stage_project_delivery.js', "script del avance del proyecto");
assertIncludes(studentJs, "productiveStageProjectDelivery", "integracion del modulo de avance");
assertIncludes(deliveryJs, "renderProjectResources", "render de documentos base");
assertIncludes(deliveryJs, "handleProjectDeliverySubmit", "subida del avance del proyecto");
assertIncludes(css, ".student-project-downloads", "estilos de descargas de etapa productiva");
assertIncludes(css, ".student-project-delivery-card", "estilos del panel de avance");

console.log("OK: la vista privada del estudiante incluye documentos base y entrega de avance por proyecto.");
