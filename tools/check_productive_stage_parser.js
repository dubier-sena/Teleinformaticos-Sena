const assert = require("assert");
const path = require("path");

const modulePath = path.join(process.cwd(), "js", "productive_stage_import.js");
const productiveStageImport = require(modulePath);

const sampleText = `
INFORME DE RETROALIMENTACION
Proyectos de Grado — Grados 11A y 11B

GRADO 11A
Ficha 3168850  ·  11 proyectos

GRUPO 1 · TECNOLOGIA EDUCATIVA PARA PRIMARIA

BIOEXPLORA — Pagina web de ciencias naturales
👤 Charit Lorena Sierra Porras
🎯 Poblacion: Estudiantes de grado 4 de primaria, I.E. Santa Barbara
🛠️ Herramienta: Pagina web educativa + charlas presenciales

Estado del documento: ✅ Completo

📋 RESUMEN DEL PROYECTO
Charit disena una pagina web interactiva para solucionar vacios en ciencias naturales.

🌟 FORTALEZAS
✔ Identifica con claridad la problematica.
✔ Estructura bien el planteamiento del problema.

🔧 ASPECTOS A MEJORAR
→ Agregar una referencia bibliografica.
→ Definir los objetivos formalmente.

💡 Nota del asesor: Proyecto con base solida.

App educativa de informatica: hardware y software
👤 Kevin Santiago Monroy Lancheros & Luna Gabriela Forero Sierra
🎯 Poblacion: Estudiantes de grado 4 de primaria, escuelas sede
🛠️ Herramienta: Aplicacion educativa interactiva

Estado del documento: ✅ Completo

📋 RESUMEN DEL PROYECTO
Kevin y Luna desarrollan una aplicacion visual y sencilla sobre hardware y software.

🌟 FORTALEZAS
✔ Objetivos claramente formulados.

🔧 ASPECTOS A MEJORAR
→ Agregar una referencia bibliografica.

💡 Nota del asesor: Proyecto bien estructurado.
`;

const result = productiveStageImport.parseProductiveStageReportText(sampleText, {
  sourceFileName: "Informe_Completo_11A_11B_2026.docx",
  importBatchId: "batch-001",
  importedAt: "2026-04-11T04:00:00.000Z",
  users: [
    {
      usernameKey: "charit",
      fullName: "Charit Lorena Sierra Porras",
      ficha: "3168850",
    },
    {
      usernameKey: "kevin",
      fullName: "Kevin Santiago Monroy Lancheros",
      ficha: "3168850",
    },
    {
      usernameKey: "luna",
      fullName: "Luna Gabriela Forero Sierra",
      ficha: "3168850",
    },
  ],
});

assert.ok(result, "El parser debe retornar un resultado");
assert.strictEqual(result.projects.length, 2, "Debe detectar dos proyectos");
assert.strictEqual(result.reports.length, 2, "Debe generar dos informes");
assert.strictEqual(result.summary.totalProjects, 2, "El resumen debe contar los proyectos");
assert.strictEqual(result.summary.statusCounts.Completo, 2, "Debe resumir estados completos");

const firstProject = result.projects[0];
assert.strictEqual(firstProject.ficha, "3168850", "Debe detectar la ficha del proyecto");
assert.strictEqual(firstProject.grado, "11A", "Debe detectar el grado");
assert.strictEqual(
  firstProject.groupCategory,
  "GRUPO 1 · TECNOLOGIA EDUCATIVA PARA PRIMARIA",
  "Debe conservar la categoria de grupo"
);
assert.strictEqual(
  firstProject.projectTitle,
  "BIOEXPLORA — Pagina web de ciencias naturales",
  "Debe extraer el titulo del proyecto"
);
assert.deepStrictEqual(
  firstProject.studentNames,
  ["Charit Lorena Sierra Porras"],
  "Debe detectar el nombre del aprendiz"
);
assert.deepStrictEqual(
  firstProject.studentUsernameKeys,
  ["charit"],
  "Debe vincular el aprendiz registrado"
);
assert.strictEqual(firstProject.currentStatus, "Completo", "Debe normalizar el estado");

const secondProject = result.projects[1];
assert.deepStrictEqual(
  secondProject.studentUsernameKeys,
  ["kevin", "luna"],
  "Debe vincular los integrantes del proyecto"
);

const firstReport = result.reports[0];
assert.strictEqual(firstReport.reportType, "Retroalimentacion", "Debe asignar el tipo de informe");
assert.strictEqual(firstReport.status, "Completo", "Debe copiar el estado del informe");
assert.strictEqual(firstReport.improvements.length, 2, "Debe extraer aspectos a mejorar");
assert.ok(
  firstReport.advisorNote.includes("Proyecto con base solida"),
  "Debe extraer la nota del asesor"
);

console.log("OK: el parser de etapa productiva extrae proyectos e informes desde el texto.");
