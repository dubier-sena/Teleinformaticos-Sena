const path = require("path");

const store = require(path.join(process.cwd(), "js", "productive_stage_store.js"));

if (typeof store.getStudentProjectIds !== "function") {
  throw new Error("Falta el helper getStudentProjectIds en productive_stage_store.js");
}

if (typeof store.getStudentProjects !== "function") {
  throw new Error("Falta el helper getStudentProjects en productive_stage_store.js");
}

if (typeof store.getProjectReports !== "function") {
  throw new Error("Falta el helper getProjectReports en productive_stage_store.js");
}

const snapshot = {
  projects: [
    {
      id: "project-alpha",
      projectTitle: "Proyecto Alpha",
      studentUsernameKeys: ["ana", "carlos"],
    },
    {
      id: "project-beta",
      projectTitle: "Proyecto Beta",
      studentUsernameKeys: ["luis"],
    },
  ],
  reports: [
    {
      reportId: "report-1",
      projectId: "project-alpha",
      reportType: "Retroalimentacion",
      importedAt: "2026-04-10T08:00:00.000Z",
    },
    {
      reportId: "report-2",
      projectId: "project-alpha",
      reportType: "Avance",
      importedAt: "2026-04-11T08:00:00.000Z",
    },
    {
      reportId: "report-3",
      projectId: "project-beta",
      reportType: "Retroalimentacion",
      importedAt: "2026-04-09T08:00:00.000Z",
    },
  ],
  studentIndex: {
    ana: ["project-alpha"],
    carlos: ["project-alpha"],
    luis: ["project-beta"],
  },
};

const anaIds = store.getStudentProjectIds(snapshot, "ana");
if (!Array.isArray(anaIds) || anaIds.length !== 1 || anaIds[0] !== "project-alpha") {
  throw new Error("getStudentProjectIds no devolvio el proyecto esperado para ana.");
}

const anaProjects = store.getStudentProjects(snapshot, "ana");
if (!Array.isArray(anaProjects) || anaProjects.length !== 1 || anaProjects[0].id !== "project-alpha") {
  throw new Error("getStudentProjects no filtro correctamente el proyecto visible de ana.");
}

const anaReports = store.getProjectReports(snapshot, "project-alpha");
if (!Array.isArray(anaReports) || anaReports.length !== 2) {
  throw new Error("getProjectReports no devolvio el historial completo del proyecto.");
}

if (anaReports[0].reportId !== "report-2") {
  throw new Error("getProjectReports no ordeno primero el informe mas reciente.");
}

const unknownProjects = store.getStudentProjects(snapshot, "desconocido");
if (!Array.isArray(unknownProjects) || unknownProjects.length !== 0) {
  throw new Error("Un estudiante sin coincidencia no deberia ver proyectos.");
}

console.log("OK: los helpers de etapa productiva filtran proyectos e informes por estudiante.");
