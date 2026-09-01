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
  let querySelectorCalls = 0;
  const windowListeners = {};
  const docListeners = {};
  const ctx = {
    window: {},
    document: {
      querySelector: (sel) => {
        if (sel === "[data-act-std-avance]") { querySelectorCalls += 1; return containerStub; }
        return null;
      },
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute() {}, appendChild() {}, classList: { add() {} } }),
      addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
      getElementById: () => null,
      head: { appendChild() {} },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    Date,
  };
  ctx.window.portalAuth = mocks.portalAuth || { getCurrentSession: () => null };
  ctx.window.activityGradesManager = mocks.activityGradesManager || null;
  ctx.window.sharedAppsScriptDelivery = null;
  ctx.window.addEventListener = (type, fn) => { (windowListeners[type] = windowListeners[type] || []).push(fn); };
  ctx.window.dispatchEvent = (evt) => { (windowListeners[evt.type] || []).forEach((fn) => fn(evt)); };
  ctx.window.requestAnimationFrame = (fn) => fn();
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_standard.js"), "utf8"), ctx);
  return {
    std: ctx.window.ActivityStandard,
    container: containerStub,
    windowListeners,
    docListeners,
    fireActivityDeadlinesUpdated: () => (windowListeners["activity-deadlines-updated"] || []).forEach((fn) => fn({ type: "activity-deadlines-updated" })),
    getAvanceQuerySelectorCalls: () => querySelectorCalls,
  };
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

test("renderAvancePanel: aliasIds -- la actividad alias muestra la nota de su actividad dueña", () => {
  const { std, container } = loadActivityStandard({
    portalAuth: studentSession("prueba.aprendiz"),
    activityGradesManager: {
      GUIDE_FAMILY_BY_FILE: { "guia.html": "familia-x" },
      GRADE_CATALOG: {
        "familia-x": { activities: [{ id: "sopaletras311", aliasIds: ["relaciona311"] }] },
      },
      getStudentGrades: () => ({ sopaletras311: "A" }), // relaciona311 NUNCA tiene su propia entrada
    },
  });

  std.registerGuide({
    files: ["guia.html"],
    activities: [
      { id: "sopaletras311", number: "1.1", label: "Sopa de letras", type: "form" },
      { id: "relaciona311", number: "1.2", label: "Relaciona", type: "form" },
    ],
  });

  const state = { "sopaletras311-locked": true, "relaciona311-locked": true };
  std.renderAvancePanel({ getGuideDataFile: () => "guia.html", getState: () => state });

  const approvedCount = (container.innerHTML.match(/Aprobada/g) || []).length;
  assert.equal(approvedCount, 2, "tanto sopaletras311 como su alias relaciona311 deben mostrar Aprobada");
});

// ── Auditoria 2026-08-31: GuideCloudSync dispara "activity-deadlines-updated"
// tras hydrate()/refresco periodico. _mountAvancePanel() (llamado por
// mountActivities()) debe reaccionar a ese evento reusando renderAvancePanel
// -- sin crear un segundo panel y sin registrar un listener nuevo por cada
// disparo del evento (el listener se instala UNA sola vez, en el montaje). ──

test("mountActivities -> _mountAvancePanel: se repinta con 'activity-deadlines-updated' sin crear un segundo panel ni duplicar el listener", () => {
  let state = {};
  const { std, container, windowListeners, fireActivityDeadlinesUpdated, getAvanceQuerySelectorCalls } = loadActivityStandard({
    portalAuth: studentSession("prueba.aprendiz"),
    activityGradesManager: null,
  });

  std.registerGuide({
    files: ["guia.html"],
    activities: [
      { id: "entregaTest", number: "1.1", label: "Entrega de prueba", type: "file", driveTarget: { panelKey: "entregaTest" } },
    ],
  });

  const stateCtx = { getGuideDataFile: () => "guia.html", getState: () => state, getSelection: () => ({}), getLearnerName: () => "" };

  // Montaje normal (equivalente a initGuiaX() -> ActivityStandard.mountActivities()).
  std.mountActivities(stateCtx);

  assert.doesNotMatch(container.innerHTML, /Entregada/, "antes de hidratar, la actividad no debe figurar como entregada en el avance");
  const listenersAfterMount = (windowListeners["activity-deadlines-updated"] || []).length;
  assert.ok(listenersAfterMount >= 1, "mountActivities debe instalar al menos un listener de activity-deadlines-updated (avance + entrega)");

  // Simula lo que GuideCloudSync.hydrate() hace ANTES de disparar el evento:
  // el estado ya fusionado se aplica primero (setState), despues se dispara.
  state = {
    "entregaTest-locked": true,
    "entregaTest-delivery": { status: "delivered", submittedAt: "2026-08-31T22:00:00.000Z" },
  };
  fireActivityDeadlinesUpdated();

  assert.match(container.innerHTML, /Entregada/, "el panel de avance debe reflejar la entrega tras el evento");
  assert.equal(getAvanceQuerySelectorCalls() >= 2, true, "el panel se repinto reutilizando el MISMO contenedor (document.querySelector se volvio a llamar, no se creo uno nuevo)");

  // Refresco periodico simulado 3 veces mas (igual que 3 ciclos de
  // startPeriodicRefresh): no debe cambiar la cantidad de listeners.
  fireActivityDeadlinesUpdated();
  fireActivityDeadlinesUpdated();
  fireActivityDeadlinesUpdated();

  const listenersAfterRefreshes = (windowListeners["activity-deadlines-updated"] || []).length;
  assert.equal(
    listenersAfterRefreshes,
    listenersAfterMount,
    "disparar el evento varias veces (varias hidrataciones/refrescos) NO debe agregar listeners nuevos"
  );
  assert.match(container.innerHTML, /Entregada/, "el panel sigue correcto despues de varios refrescos consecutivos");
});
