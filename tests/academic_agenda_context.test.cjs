"use strict";

// Fase Agenda Academica (bloque C, 2026-08-24): js/academic_agenda_context.js
// es la capa "impura" que arma el input real de js/academic_agenda.js desde
// window.portalAuth / activityDeadlineManager / productiveStageStore /
// _firebaseDb / localStorage. Se sandboxa con vm.createContext (es un modulo
// de navegador, no UMD) -- por eso las aserciones evitan instanceof/deepEqual
// sobre objetos creados DENTRO del sandbox (mismo gotcha de cross-realm que
// ya se documento en tests/productive_stage_deadlines.test.cjs).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function makeLocalStorage() {
  var store = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
    __store: store,
  };
}

function loadContextModule(overrides) {
  var localStorage = makeLocalStorage();
  var sandbox = {
    console: console,
    Set: Set,
    Promise: Promise,
    JSON: JSON,
    Object: Object,
    Array: Array,
    String: String,
    encodeURIComponent: encodeURIComponent,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    localStorage: localStorage,
  };
  sandbox.window = sandbox;
  Object.assign(sandbox.window, overrides || {});
  vm.createContext(sandbox);
  vm.runInContext(read("js/academic_agenda_context.js"), sandbox, { filename: "academic_agenda_context.js" });
  return { mod: sandbox.window.academicAgendaContext, localStorage: localStorage };
}

function fakeAuth(session, extra) {
  return Object.assign({
    getCurrentSession: function () { return session; },
    getFichaInfo: function (ficha) {
      var map = { "3441939": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A" }, "3168850": { inst: "Institucion Educativa Santa Barbara", grupo: "11A" } };
      return map[ficha] || null;
    },
    getGuidesForFicha: function (ficha) {
      return ficha === "3441939" ? ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"] : [];
    },
    getGuideTitle: function (file) { return "Guia " + file; },
    getGuideHref: function (file) { return "guia.html?g=" + file; },
    getStudentStorageKey: function (usernameKey, key, opts) { return "sena_portal:student:" + usernameKey + ":" + (opts && opts.area) + ":" + key; },
  }, extra || {});
}

function fakeDeadlineManager(policies) {
  return {
    ready: function () { return Promise.resolve(); },
    getSnapshot: function () { return { policies: policies || {} }; },
    getActivitiesForGuide: function (file) {
      return file === "grupo-10a-guia-02-herramientas-informaticas-digitales.html"
        ? [{ id: "matriz322", label: "Matriz" }]
        : [];
    },
  };
}

// ── Seguridad: nunca arma contexto para una sesion no-aprendiz ────────────

test("resolveStudentAgendaContext: sin sesion -> null", async () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth(null) });
  const result = await mod.resolveStudentAgendaContext();
  assert.equal(result, null);
});

test("resolveStudentAgendaContext: sesion admin -> null (nunca arma contexto de aprendiz para admin)", async () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth({ role: "admin" }) });
  const result = await mod.resolveStudentAgendaContext();
  assert.equal(result, null);
});

test("resolveStudentAgendaContext: arma el contexto SOLO con datos de la propia sesion (ficha/grupo/institucion correctos)", async () => {
  const session = { role: "student", user: { usernameKey: "ana.lopez", ficha: "3441939", fullName: "Ana Lopez" } };
  const { mod } = loadContextModule({
    portalAuth: fakeAuth(session),
    activityDeadlineManager: fakeDeadlineManager({}),
    _firebaseDb: {},
  });
  const result = await mod.resolveStudentAgendaContext();
  assert.equal(result.context.ficha, "3441939");
  assert.equal(result.context.grupo, "10A");
  assert.equal(result.context.institucionShort, "I.E. Jhon F. Kennedy");
  assert.equal(result.context.usernameKey, "ana.lopez");
  assert.equal(result.context.hasProductiveStage, false);
});

test("resolveStudentAgendaContext: ficha de Etapa Productiva activa hasProductiveStage", async () => {
  const session = { role: "student", user: { usernameKey: "prueba.sb11", ficha: "3168850" } };
  const { mod } = loadContextModule({
    portalAuth: fakeAuth(session, { getGuidesForFicha: () => [] }),
    activityDeadlineManager: fakeDeadlineManager({}),
    _firebaseDb: {},
  });
  const result = await mod.resolveStudentAgendaContext();
  assert.equal(result.context.hasProductiveStage, true);
});

test("resolveStudentAgendaContext: el snapshot de Etapa Productiva SOLO se pide cuando la ficha corresponde (evita una lectura sin sentido para grado 10)", async () => {
  const session = { role: "student", user: { usernameKey: "ana.lopez", ficha: "3441939" } };
  let loadStudentSnapshotCalled = false;
  const { mod } = loadContextModule({
    portalAuth: fakeAuth(session),
    activityDeadlineManager: fakeDeadlineManager({}),
    _firebaseDb: {},
    productiveStageStore: { loadStudentSnapshot: async function () { loadStudentSnapshotCalled = true; return { documentDeliveries: [] }; } },
  });
  const result = await mod.resolveStudentAgendaContext();
  assert.equal(loadStudentSnapshotCalled, false);
  assert.equal(result.productiveStageSnapshot, null);
});

// ── Estado de entrega cross-device: prioridad remoto > local > desconocido ─

test("resolveDeliveredGuideActivityKeys: prioriza el estado REMOTO sobre uno local desactualizado", async () => {
  const localStorage = makeLocalStorage();
  localStorage.setItem("sena_portal:student:ana.lopez:guide-data:guia_02", JSON.stringify({})); // local: nada marcado
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }, {
      getStudentStorageKey: () => "sena_portal:student:ana.lopez:guide-data:guia_02",
    }),
    ActivityStandard: { getStateKeyForGuide: () => "guia_02" },
    _firebaseDb: {
      cloudGetGuideData: async function () { return { state: { "matriz322-locked": true } }; }, // remoto: SI entregado
      guideDataFileName: (f) => f,
    },
    localStorage: localStorage,
  });
  const delivered = await mod.__test.resolveDeliveredGuideActivityKeys("ana.lopez", ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"]);
  assert.equal(delivered.has("grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322"), true);
});

test("resolveDeliveredGuideActivityKeys: sin conexion, cae al estado LOCAL (equipo que ya visito la guia)", async () => {
  const localStorage = makeLocalStorage();
  localStorage.setItem("sena_portal:student:ana.lopez:guide-data:guia_02", JSON.stringify({ "matriz322-locked": true }));
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }, {
      getStudentStorageKey: () => "sena_portal:student:ana.lopez:guide-data:guia_02",
    }),
    ActivityStandard: { getStateKeyForGuide: () => "guia_02" },
    _firebaseDb: {
      cloudGetGuideData: async function () { throw new Error("sin conexion"); },
      guideDataFileName: (f) => f,
    },
    localStorage: localStorage,
  });
  const delivered = await mod.__test.resolveDeliveredGuideActivityKeys("ana.lopez", ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"]);
  assert.equal(delivered.has("grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322"), true);
});

test("resolveDeliveredGuideActivityKeys: equipo LIMPIO (sin cache local) + remoto confirmado -> SI aparece entregada", async () => {
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }, {
      getStudentStorageKey: () => "sena_portal:student:ana.lopez:guide-data:guia_02",
    }),
    ActivityStandard: { getStateKeyForGuide: () => "guia_02" },
    _firebaseDb: {
      cloudGetGuideData: async function () { return { data: { "matriz322-locked": true } }; },
      guideDataFileName: (f) => f,
    },
  });
  const delivered = await mod.__test.resolveDeliveredGuideActivityKeys("ana.lopez", ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"]);
  assert.equal(delivered.has("grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322"), true);
});

test("resolveDeliveredGuideActivityKeys: sin local NI remoto disponible -> NUNCA se inventa 'entregada'", async () => {
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }, {
      getStudentStorageKey: () => "sena_portal:student:ana.lopez:guide-data:guia_02",
    }),
    ActivityStandard: { getStateKeyForGuide: () => "guia_02" },
    _firebaseDb: { cloudGetGuideData: async function () { throw new Error("404"); }, guideDataFileName: (f) => f },
  });
  const delivered = await mod.__test.resolveDeliveredGuideActivityKeys("ana.lopez", ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"]);
  assert.equal(delivered.has("grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322"), false);
  assert.equal(delivered.size, 0);
});

test("resolveDeliveredGuideActivityKeys: shouldDeferCloudReads() activo NO intenta la red (respeta el guard de cuota existente)", async () => {
  const localStorage = makeLocalStorage();
  localStorage.setItem("sena_portal:student:ana.lopez:guide-data:guia_02", JSON.stringify({ "matriz322-locked": true }));
  let remoteCalled = false;
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }, {
      getStudentStorageKey: () => "sena_portal:student:ana.lopez:guide-data:guia_02",
    }),
    ActivityStandard: { getStateKeyForGuide: () => "guia_02" },
    _firebaseDb: {
      cloudGetGuideData: async function () { remoteCalled = true; return { state: {} }; },
      shouldDeferCloudReads: function () { return true; },
      guideDataFileName: (f) => f,
    },
    localStorage: localStorage,
  });
  const delivered = await mod.__test.resolveDeliveredGuideActivityKeys("ana.lopez", ["grupo-10a-guia-02-herramientas-informaticas-digitales.html"]);
  assert.equal(remoteCalled, false);
  assert.equal(delivered.has("grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322"), true, "debe caer al local");
});

// ── withTimeout: rendimiento (hallazgo real, verificado en navegador) ──────
// productiveStageStore.loadSnapshot() para un aprendiz SIEMPRE cae al
// respaldo de Drive (medido en vivo: ~8-12s) porque las reglas de Firestore
// no permiten esa lectura directa a un estudiante. Sin este limite, el
// aprendiz se quedaba mirando "Cargando..." 20+ segundos.

test("withTimeout: si la promesa real resuelve antes del limite, se usa SU valor (no el fallback)", async () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth(null) });
  const fast = new Promise((resolve) => setTimeout(() => resolve("valor-real"), 5));
  const result = await mod.__test.withTimeout(fast, 200, "fallback");
  assert.equal(result, "valor-real");
});

test("withTimeout: si la promesa real tarda mas que el limite, se usa el fallback (no bloquea para siempre)", async () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth(null) });
  const slow = new Promise((resolve) => setTimeout(() => resolve("nunca-deberia-verse"), 500));
  const result = await mod.__test.withTimeout(slow, 30, "fallback");
  assert.equal(result, "fallback");
});

test("withTimeout: si la promesa real RECHAZA, tambien se usa el fallback (nunca propaga el error hacia arriba)", async () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth(null) });
  const rejecting = Promise.reject(new Error("fallo de red"));
  const result = await mod.__test.withTimeout(rejecting, 200, "fallback");
  assert.equal(result, "fallback");
});

// ── unwrapCalendarSnapshot: compatibilidad legacy ───────────────────────────

test("unwrapCalendarSnapshot: soporta el shape {state:{...}} y el legacy plano por igual", () => {
  const { mod } = loadContextModule({ portalAuth: fakeAuth(null) });
  // Object.keys(...) en vez de deepEqual: el objeto devuelto se crea DENTRO
  // del sandbox (otro realm) y deepStrictEqual exige prototipos identicos
  // (mismo gotcha de cross-realm ya documentado en este archivo).
  assert.equal(mod.__test.unwrapCalendarSnapshot({ state: { a: 1 } }).a, 1);
  assert.equal(mod.__test.unwrapCalendarSnapshot({ a: 1 }).a, 1);
  assert.equal(Object.keys(mod.__test.unwrapCalendarSnapshot(null)).length, 0);
});

test("resolveStudentAgendaContext: las 3 lecturas de red independientes corren en PARALELO, no en cadena", async () => {
  const session = { role: "student", user: { usernameKey: "prueba.sb11", ficha: "3168850" } };
  function delayed(ms, value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
  }
  const started = Date.now();
  const { mod } = loadContextModule({
    portalAuth: fakeAuth(session, { getGuidesForFicha: () => [] }),
    activityDeadlineManager: fakeDeadlineManager({}),
    _firebaseDb: { cloudGetCalendar: () => delayed(60, { state: {} }) },
    productiveStageStore: { loadStudentSnapshot: () => delayed(60, { documentDeliveries: [] }) },
  });
  await mod.resolveStudentAgendaContext();
  const elapsed = Date.now() - started;
  // Si corrieran en cadena (60ms + 60ms + resolveDeliveredGuideActivityKeys)
  // el total rondaria >=120ms; en paralelo, deberia quedar bien por debajo.
  assert.ok(elapsed < 110, `se esperaba ejecucion en paralelo (<110ms), tardo ${elapsed}ms`);
});

// ── buildGuideCatalog ────────────────────────────────────────────────────

test("buildGuideCatalog: arma el catalogo con titulo/route/actividades reales de la ficha", () => {
  const { mod } = loadContextModule({
    portalAuth: fakeAuth({ role: "student", user: {} }),
    activityDeadlineManager: fakeDeadlineManager({}),
  });
  const catalog = mod.__test.buildGuideCatalog("3441939");
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].pageFile, "grupo-10a-guia-02-herramientas-informaticas-digitales.html");
  assert.equal(catalog[0].activities[0].id, "matriz322");
});
