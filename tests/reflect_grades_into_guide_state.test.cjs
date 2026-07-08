const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// Carga activity_grades.js en un sandbox con mocks minimos (window.portalAuth,
// window._firebaseDb, window.ActivityStandard, localStorage) para poder llamar
// reflectGradesIntoGuideState() sin necesitar un navegador real ni Firestore.
// Cada llamada crea un sandbox NUEVO para no arrastrar estado entre pruebas.
function loadManager(mocks) {
  const localStorageStub = {
    _data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };

  const ctx = {
    window: {},
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, appendChild() {}, classList: { add() {} } }),
    },
    localStorage: localStorageStub,
    console,
    URL,
    Date,
  };
  ctx.window.location = { href: "https://x/" };
  ctx.window.portalAuth = mocks.portalAuth || { getCurrentSession: () => null };
  ctx.window._firebaseDb = mocks.firebaseDb || {};
  ctx.window.ActivityStandard = mocks.activityStandard || {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx);
  return ctx.window.activityGradesManager;
}

function studentSession(usernameKey) {
  return {
    getCurrentSession: () => ({ role: "student", usernameKey, user: { usernameKey } }),
  };
}

const FAKE_FAMILY = "guia-01-induccion"; // familia real ya existente en GRADE_CATALOG

test("reflectGradesIntoGuideState: actividad tipo form calificada -> marca -locked, llama su lockApplier y onChanged", async () => {
  const state = {};
  let lockApplierCalls = 0;
  let onChangedCalls = 0;

  const mgr = loadManager({
    portalAuth: studentSession("prueba.aprendiz"),
    firebaseDb: {
      cloudGetGrades: async () => ({ [FAKE_FAMILY]: { arbol312: "A", "arbol312:gradedAt": "2026-07-08T00:00:00.000Z" } }),
    },
    activityStandard: {
      getConfigForGuide: () => ({ activities: [{ id: "arbol312", type: "form" }] }),
    },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: FAKE_FAMILY,
    pageFile: "grupo-10a-guia-01-induccion.html",
    getState: () => state,
    lockAppliers: { arbol312: () => { lockApplierCalls += 1; } },
    onChanged: () => { onChangedCalls += 1; },
  });

  assert.equal(state["arbol312-locked"], true);
  assert.equal(lockApplierCalls, 1);
  assert.equal(onChangedCalls, 1);
});

test("reflectGradesIntoGuideState: actividad tipo file calificada -> marca -delivery con status delivered", async () => {
  const state = {};

  const mgr = loadManager({
    portalAuth: studentSession("prueba.aprendiz"),
    firebaseDb: {
      cloudGetGrades: async () => ({ [FAKE_FAMILY]: { portafolio342: "A", "portafolio342:gradedAt": "2026-07-08T00:00:00.000Z" } }),
    },
    activityStandard: {
      getConfigForGuide: () => ({ activities: [{ id: "portafolio342", type: "file" }] }),
    },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: FAKE_FAMILY,
    pageFile: "grupo-10a-guia-01-induccion.html",
    getState: () => state,
  });

  assert.equal(state["portafolio342-delivery"].status, "delivered");
  assert.equal(state["portafolio342-delivery"].submittedAt, "2026-07-08T00:00:00.000Z");
});

test("reflectGradesIntoGuideState: actividad SIN nota (Pendiente) no toca el state ni llama su lockApplier", async () => {
  const state = {};
  let lockApplierCalls = 0;

  const mgr = loadManager({
    portalAuth: studentSession("prueba.aprendiz"),
    firebaseDb: {
      cloudGetGrades: async () => ({ [FAKE_FAMILY]: {} }), // nadie calificado
    },
    activityStandard: {
      getConfigForGuide: () => ({ activities: [{ id: "arbol312", type: "form" }] }),
    },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: FAKE_FAMILY,
    pageFile: "grupo-10a-guia-01-induccion.html",
    getState: () => state,
    lockAppliers: { arbol312: () => { lockApplierCalls += 1; } },
  });

  assert.equal(state["arbol312-locked"], undefined);
  assert.equal(lockApplierCalls, 0);
});

test("reflectGradesIntoGuideState: si ya estaba -locked, no vuelve a marcar 'changed' (no llama onChanged de nuevo), pero SI sigue llamando el lockApplier", async () => {
  const state = { "arbol312-locked": true };
  let lockApplierCalls = 0;
  let onChangedCalls = 0;

  const mgr = loadManager({
    portalAuth: studentSession("prueba.aprendiz"),
    firebaseDb: {
      cloudGetGrades: async () => ({ [FAKE_FAMILY]: { arbol312: "A" } }),
    },
    activityStandard: {
      getConfigForGuide: () => ({ activities: [{ id: "arbol312", type: "form" }] }),
    },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: FAKE_FAMILY,
    pageFile: "grupo-10a-guia-01-induccion.html",
    getState: () => state,
    lockAppliers: { arbol312: () => { lockApplierCalls += 1; } },
    onChanged: () => { onChangedCalls += 1; },
  });

  assert.equal(lockApplierCalls, 1, "el lockApplier debe seguir aplicandose aunque el flag ya estuviera puesto");
  assert.equal(onChangedCalls, 0, "onChanged solo debe dispararse cuando algo REALMENTE cambio");
});

test("reflectGradesIntoGuideState: sin sesion de aprendiz (admin o sin sesion) no hace nada", async () => {
  const state = {};
  let cloudCalled = false;

  const mgr = loadManager({
    portalAuth: { getCurrentSession: () => ({ role: "admin" }) },
    firebaseDb: { cloudGetGrades: async () => { cloudCalled = true; return {}; } },
    activityStandard: { getConfigForGuide: () => ({ activities: [] }) },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: FAKE_FAMILY,
    pageFile: "grupo-10a-guia-01-induccion.html",
    getState: () => state,
  });

  assert.equal(cloudCalled, false, "no debe ni consultar la nube si la sesion no es de un aprendiz");
  assert.deepEqual(state, {});
});

test("reflectGradesIntoGuideState: guideFamily inexistente en GRADE_CATALOG no revienta, simplemente no hace nada", async () => {
  const state = {};
  const mgr = loadManager({
    portalAuth: studentSession("prueba.aprendiz"),
    firebaseDb: { cloudGetGrades: async () => ({}) },
    activityStandard: { getConfigForGuide: () => null },
  });

  await mgr.reflectGradesIntoGuideState({
    guideFamily: "familia-que-no-existe",
    pageFile: "no-importa.html",
    getState: () => state,
  });

  assert.deepEqual(state, {});
});
