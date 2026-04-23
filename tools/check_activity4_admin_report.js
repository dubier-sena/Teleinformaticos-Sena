const fs = require("fs");
const path = require("path");

const root = process.cwd();
const form10a = fs.readFileSync(
  path.join(root, "pages", "auxiliares", "grupo-10a-guia-02-actividad-4-formulario.html"),
  "utf8"
);
const form10b = fs.readFileSync(
  path.join(root, "pages", "auxiliares", "grupo-10b-guia-02-actividad-4-formulario.html"),
  "utf8"
);
const guia2Js = fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8");
const reportJs = fs.readFileSync(path.join(root, "js", "activity4_admin_report.js"), "utf8");

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(
  form10a,
  "activity4_admin_report.js?v=",
  "script del reporte admin en el formulario 10A"
);
assertIncludes(
  form10b,
  "activity4_admin_report.js?v=",
  "script del reporte admin en el formulario 10B"
);
assertIncludes(
  guia2Js,
  "window.guia2Activity4ReportSource",
  "exposicion del estado del formulario para el reporte admin"
);
assertIncludes(
  reportJs,
  "Ver reporte del aprendiz",
  "boton para abrir el reporte desde el mismo formulario"
);
assertIncludes(
  reportJs,
  'session.role !== "admin"',
  "restriccion del reporte para administradores"
);
assertIncludes(
  reportJs,
  "renderGuide2ResponsesBody",
  "renderizado del reporte de respuestas dentro del formulario"
);

console.log("OK: los formularios de Actividad 4 incluyen el reporte del aprendiz dentro de la misma pagina para el administrador.");
