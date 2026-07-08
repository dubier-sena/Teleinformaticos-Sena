const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// Carga activity_standard.js en un sandbox minimo. renderAvancePanel() debe
// mostrar "Aprobada"/"Reprobada" cuando la actividad YA fue calificada (leido
// del cache sincrono de activityGradesManager.getStudentGrades), en vez de
// solo "Guardada" -- que no le dice al aprendiz si el instructor ya la revisó.
function loadActivityStandard(mocks) {
  const containerStub = { innerHTML: "" };
  const ctx = {
    window: {},
    document: {
      querySelector: (sel) => (sel === "[data-act-std-avance]" ? containerStub : null),
      createElement: () => ({ setAttribute() {}, appendChild() {}, classList: { add() {} } }),
      addEventListener: () => {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    Date,
  };
  ctx.window.portalAuth = mocks.portalAuth || { getCurrentSession: () => null };
  ctx.window.activityGradesManager = mocks.activityGradesManager || null;
  ctx.window.sharedAppsScriptDelivery = null;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_standard.js"), "utf8"), ctx);
  return { std: ctx.window.ActivityStandard, container: containerStub };
}

function studentSession(usernameKey) {
  return { getCurrentSession: () => ({ role: "student", usernameKey }) };
}

test("renderAvancePanel: actividad con nota A -> muestra Aprobada (estado--ok), no solo Guardada", () => {
  const { std, container } = loadActivityStandard({
    portalAuth: studentSession("prueba.aprendiz"),
    activityGradesManager: {
      GUIDE_FAMILY_BY_FILE: { "guia.html": "familia-x" },
      getStudentGrades: () => ({ act1: "A" }),
    },
  });

  std.registerGuide({
    files: ["guia.html"],
    activities: [{ id: "act1", number: "1.1", label: "Actividad uno", type: "form", formFields: ["campo1"] }],
  });

  const state = { "act1-locked": true };
  std.renderAvancePanel({ getGuideDataFile: () => "guia.html", getState: () => state });

  assert.match(container.innerHTML, /Aprobada/);
  assert.match(container.innerHTML, /estado--ok/);
  assert.doesNotMatch(container.innerHTML, /Guardada/);
});

test("renderAvancePanel: actividad con nota D -> muestra Reprobada (estado--mal)", () => {
  const { std, container } = loadActivityStandard({
    portalAuth: studentSession("prueba.aprendiz"),
    activityGradesManager: {
      GUIDE_FAMILY_BY_FILE: { "guia.html": "familia-x" },
      getStudentGrades: () => ({ act1: "D" }),
    },
  });

  std.registerGuide({
    files: ["guia.html"],
    activities: [{ id: "act1", number: "1.1", label: "Actividad uno", type: "form", formFields: ["campo1"] }],
  });

  const state = { "act1-locked": true };
  std.renderAvancePanel({ getGuideDataFile: () => "guia.html", getState: () => state });

  assert.match(container.innerHTML, /Reprobada/);
  assert.match(container.innerHTML, /estado--mal/);
});

test("renderAvancePanel: sin nota cacheada -> se mantiene el comportamiento anterior (Guardada/Pendiente)", () => {
  const { std, container } = loadActivityStandard({
    portalAuth: studentSession("prueba.aprendiz"),
    activityGradesManager: {
      GUIDE_FAMILY_BY_FILE: { "guia.html": "familia-x" },
      getStudentGrades: () => ({}), // nadie calificado
    },
  });

  std.registerGuide({
    files: ["guia.html"],
    activities: [
      { id: "act1", number: "1.1", label: "Guardada", type: "form", formFields: ["campo1"] },
      { id: "act2", number: "1.2", label: "Pendiente", type: "form", formFields: ["campo2"] },
    ],
  });

  const state = { "act1-locked": true };
  std.renderAvancePanel({ getGuideDataFile: () => "guia.html", getState: () => state });

  assert.match(container.innerHTML, /Guardada/);
  assert.match(container.innerHTML, /Pendiente/);
  assert.doesNotMatch(container.innerHTML, /Aprobada|Reprobada/);
});
