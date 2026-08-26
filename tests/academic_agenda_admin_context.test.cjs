"use strict";

// Bloque D (Calendario Administrativo, 2026-08-25): js/academic_agenda_admin_context.js
// es la capa admin, paralela a academic_agenda_context.js (aprendiz) pero
// iterando VARIAS fichas y agregando conteos reales de entrega. Se sandboxea
// con vm.createContext (modulo de navegador, no UMD) e inyecta el
// academic_agenda.js REAL (obtenido via require(), tal como ya hace
// tests/academic_agenda_integration.test.cjs) para probar la cadena real,
// no una reimplementacion.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const realAgenda = require(path.join(root, "js/academic_agenda.js"));

function makeLocalStorage() {
  var store = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem: function (key, value) { store[key] = String(value); },
    removeItem: function (key) { delete store[key]; },
  };
}

function loadSandbox(overrides) {
  var sandbox = {
    console: console, Set: Set, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    Number: Number, Date: Date, Math: Math, RegExp: RegExp,
    encodeURIComponent: encodeURIComponent,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    localStorage: makeLocalStorage(),
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.academicAgenda = realAgenda;
  Object.assign(sandbox.window, overrides || {});
  vm.createContext(sandbox);
  vm.runInContext(read("js/academic_agenda_context.js"), sandbox, { filename: "academic_agenda_context.js" });
  vm.runInContext(read("js/academic_agenda_admin_context.js"), sandbox, { filename: "academic_agenda_admin_context.js" });
  return sandbox.window.academicAgendaAdminContext;
}

const FICHA_MAP = {
  "3441939": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A", guias: ["grupo-10a-guia-02-herramientas-informaticas-digitales.html", "grupo-10a-guia-04-taller-integrador.html"] },
  "3441942": { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10B", guias: [] },
  "3441944": { inst: "Institucion Educativa Santa Barbara", grupo: "10A", guias: [] },
  "3441950": { inst: "Institucion Educativa Santa Barbara", grupo: "10B", guias: [] },
  "3168850": { inst: "Institucion Educativa Santa Barbara", grupo: "11A", guias: [] },
  "3168852": { inst: "Institucion Educativa Santa Barbara", grupo: "11B", guias: [] },
};

function baseAuth(extra) {
  return Object.assign({
    FICHA_MAP: FICHA_MAP,
    getGuidesForFicha: function (ficha) { return (FICHA_MAP[ficha] && FICHA_MAP[ficha].guias) || []; },
    getGuideTitle: function (file) { return file.indexOf("taller") !== -1 ? "Taller Integrador" : "Guia 2"; },
    getGuideHref: function (file) { return "guia.html?g=" + file; },
    getStudentsWithProgress: function () { return []; },
    listStudents: function () { return []; },
  }, extra || {});
}

function baseDeadlineManager(policies) {
  return {
    ready: function () { return Promise.resolve(); },
    getSnapshot: function () { return { policies: policies || {} }; },
    getActivitiesForGuide: function (file) {
      if (file === "grupo-10a-guia-02-herramientas-informaticas-digitales.html") return [{ id: "matriz322", label: "Matriz 3.2.2", keys: ["matriz322-locked"] }];
      if (file === "grupo-10a-guia-04-taller-integrador.html") return [{ id: "producto1", label: "Producto 1", keys: ["producto1-locked"] }];
      return [];
    },
    getPolicy: function () { return null; },
  };
}

// ── listFichaOptions ───────────────────────────────────────────────────────

test("listFichaOptions: devuelve las 6 fichas con inst/grupo/hasProductiveStage", () => {
  const mod = loadSandbox({ portalAuth: baseAuth() });
  const options = mod.listFichaOptions();
  assert.equal(options.length, 6);
  const ficha11a = options.find((o) => o.ficha === "3168850");
  assert.equal(ficha11a.grupo, "11A");
  assert.equal(ficha11a.hasProductiveStage, true);
  const ficha10a = options.find((o) => o.ficha === "3441939");
  assert.equal(ficha10a.hasProductiveStage, false);
  assert.equal(ficha10a.institucionShort, "I.E. Jhon F. Kennedy");
});

// ── Escenario 1: deadline de guia aparece en la agenda admin ───────────────

test("resolveAdminAgendaContext: deadline de guia configurado -> evento ENTREGA", async () => {
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-09-01T23:59:00-05:00" } },
    }),
  });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3441939"] });
  const entrega = result.events.find((e) => e.type === "ENTREGA");
  assert.ok(entrega, "debe existir un evento ENTREGA");
  assert.equal(entrega.ficha, "3441939");
  assert.equal(entrega.sourceId, "grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322");
});

// ── Escenario 2: cambio de fecha se refleja ────────────────────────────────

test("resolveAdminAgendaContext: cambio de dueAt cambia la fecha del evento (no se duplica)", async () => {
  const modA = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-09-01T23:59:00-05:00" } },
    }),
  });
  const resultA = await modA.resolveAdminAgendaContext({ fichas: ["3441939"] });
  const eventA = resultA.events.find((e) => e.type === "ENTREGA");

  const modB = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-10-15T23:59:00-05:00" } },
    }),
  });
  const resultB = await modB.resolveAdminAgendaContext({ fichas: ["3441939"] });
  const eventB = resultB.events.find((e) => e.type === "ENTREGA");

  assert.equal(eventA.id, eventB.id, "mismo id -- no se duplica, es la MISMA entrega con otra fecha");
  assert.notEqual(eventA.dueAt, eventB.dueAt);
  assert.equal(eventB.dueAt.slice(0, 10), "2026-10-15");
});

// ── Escenario 5: Taller Integrador (mismo mecanismo que guia normal) ───────

test("resolveAdminAgendaContext: Taller Integrador con deadline aparece como ENTREGA", async () => {
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({
      "grupo-10a-guia-04-taller-integrador.html": { producto1: { dueAt: "2026-09-20T23:59:00-05:00" } },
    }),
  });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3441939"] });
  const taller = result.events.find((e) => e.sourceId.indexOf("taller-integrador") !== -1);
  assert.ok(taller);
  assert.equal(taller.title.indexOf("Taller Integrador") !== -1, true);
});

// ── Escenarios 3/4: Bitacora y Sofia Plus (Etapa Productiva) ───────────────

test("resolveAdminAgendaContext: ficha con Etapa Productiva genera BITACORA y DOCUMENTO", async () => {
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({}),
    productiveStageStore: {
      loadSnapshot: function () {
        return Promise.resolve({
          documentDeliveries: [],
          updatedAt: "",
        });
      },
      getDocumentDeliveriesByUsername: function () { return {}; },
    },
  });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3168850"] });
  const bitacoras = result.events.filter((e) => e.type === "BITACORA");
  const sofia = bitacoras.find((e) => e.sourceId === "sofia-plus");
  const docs = result.events.filter((e) => e.type === "DOCUMENTO");
  assert.ok(bitacoras.length >= 6, "debe haber al menos las 6 bitacoras");
  assert.ok(sofia, "Sofia Plus debe aparecer");
  assert.ok(docs.length >= 1, "ficha-inscripcion/acuerdo deben aparecer como DOCUMENTO");
});

test("resolveAdminAgendaContext: ficha SIN Etapa Productiva no genera BITACORA/DOCUMENTO", async () => {
  const mod = loadSandbox({ portalAuth: baseAuth(), activityDeadlineManager: baseDeadlineManager({}) });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3441939"] });
  assert.equal(result.events.filter((e) => e.type === "BITACORA" || e.type === "DOCUMENTO").length, 0);
});

// ── Escenario 6: evento legacy de calendario aparece ───────────────────────

test("resolveAdminAgendaContext: registro legacy de calendario (CLASE) aparece scopeado por ficha", async () => {
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({}),
    CALENDAR_2026_RECORDS: [
      { id: "rec1", tipo: "CLASE", colegio: "I.E. Jhon F. Kennedy", grado: "10A", fecha: "2026-09-02", horario: "9:00am-9:55am", defE: "Activa" },
      { id: "rec2", tipo: "CLASE", colegio: "I.E. Santa Bárbara", grado: "11A", fecha: "2026-09-02", horario: "9:00am-9:55am", defE: "Activa" },
    ],
  });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3441939"] });
  const clases = result.events.filter((e) => e.type === "CLASE");
  assert.equal(clases.length, 1, "solo debe traer la clase de SU ficha (10A Kennedy), no la de 11A Santa Barbara");
  assert.equal(clases[0].ficha, "3441939");
});

// ── Escenario 7: filtro por ficha (multi-ficha) ────────────────────────────

test("resolveAdminAgendaContext: con 2 fichas solo trae eventos de esas 2", async () => {
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    activityDeadlineManager: baseDeadlineManager({
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-09-01T23:59:00-05:00" } },
    }),
  });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["3441939", "3441942"] });
  const fichasPresentes = new Set(result.events.map((e) => e.ficha));
  assert.ok(fichasPresentes.size <= 2);
  fichasPresentes.forEach((f) => assert.ok(["3441939", "3441942"].includes(f)));
});

test("resolveAdminAgendaContext: ficha invalida se ignora silenciosamente (nunca revienta)", async () => {
  const mod = loadSandbox({ portalAuth: baseAuth(), activityDeadlineManager: baseDeadlineManager({}) });
  const result = await mod.resolveAdminAgendaContext({ fichas: ["9999999"] });
  // Nota: result.events es un Array creado DENTRO del sandbox (vm.createContext) --
  // deepEqual contra un [] del realm principal falla por identidad de
  // prototipo cross-realm, no por contenido (mismo gotcha documentado en
  // tests/academic_agenda_context.test.cjs). Se compara longitud, no deepEqual.
  assert.equal(result.events.length, 0);
});

// ── Escenario 12: conteos entregaron/pendientes/vencidos ───────────────────

test("computeProductiveStageCounts: total/delivered/pending/overdue correctos", () => {
  const mod = loadSandbox({ portalAuth: baseAuth() });
  const roster = [
    { usernameKey: "ana", ficha: "3168850" },
    { usernameKey: "beto", ficha: "3168850" },
    { usernameKey: "cami", ficha: "3168850" },
  ];
  const snapshot = { documentDeliveries: [{ usernameKey: "ana", docId: "bitacora-1" }] };
  const events = [
    { type: "BITACORA", sourceId: "bitacora-1", ficha: "3168850", status: "overdue" },
  ];
  const storeStub = {
    getDocumentDeliveriesByUsername: function () { return { ana: { "bitacora-1": true } }; },
  };
  // Inyectar el stub de store directamente en el modulo via un sandbox nuevo
  const modWithStore = loadSandbox({ portalAuth: baseAuth(), productiveStageStore: storeStub });
  modWithStore.__test.computeProductiveStageCounts(events, snapshot, roster);
  // deliverySummary se crea DENTRO del sandbox -- comparar campo a campo, no
  // deepEqual (mismo gotcha cross-realm, ver nota arriba).
  const summary = events[0].deliverySummary;
  assert.equal(summary.total, 3);
  assert.equal(summary.delivered, 1);
  assert.equal(summary.pending, 2);
  assert.equal(summary.overdue, 2);
});

test("computeProductiveStageCounts: sin roster para la ficha, no inventa conteo", () => {
  const mod = loadSandbox({ portalAuth: baseAuth(), productiveStageStore: { getDocumentDeliveriesByUsername: () => ({}) } });
  const events = [{ type: "BITACORA", sourceId: "bitacora-1", ficha: "3168850", status: "pending" }];
  mod.__test.computeProductiveStageCounts(events, {}, []);
  assert.equal(events[0].deliverySummary, undefined, "sin roster no se agrega deliverySummary (no inventar)");
});

// ── computeGuideDeliveryCounts: agrupa por (ficha,pageFile), no por actividad ──

test("computeGuideDeliveryCounts: agrupa fetch por guia (una sola lectura por estudiante aunque haya 2 actividades)", async () => {
  var fetchCalls = [];
  const mod = loadSandbox({
    portalAuth: baseAuth(),
    ActivityStandard: {
      getActivitiesForGuide: function (file) {
        if (file === "grupo-10a-guia-02-herramientas-informaticas-digitales.html") {
          return [
            { id: "act1", keys: ["act1-locked"] },
            { id: "act2", keys: ["act2-locked"] },
          ];
        }
        return [];
      },
    },
    _firebaseDb: {
      guideDataFileName: function (f) { return f; },
      cloudGetGuideData: function (scope, file) {
        fetchCalls.push(scope + "::" + file);
        if (scope === "student:ana") return Promise.resolve({ state: { "act1-locked": true } });
        return Promise.resolve({ state: {} });
      },
    },
  });

  const roster = [{ usernameKey: "ana", ficha: "3441939" }, { usernameKey: "beto", ficha: "3441939" }];
  const events = [
    { type: "ENTREGA", sourceId: "grupo-10a-guia-02-herramientas-informaticas-digitales.html::act1", ficha: "3441939", status: "pending" },
    { type: "ENTREGA", sourceId: "grupo-10a-guia-02-herramientas-informaticas-digitales.html::act2", ficha: "3441939", status: "overdue" },
  ];

  const summary = await mod.computeGuideDeliveryCounts(events, roster);
  assert.equal(summary.computed, 2);
  assert.equal(fetchCalls.length, 2, "2 estudiantes x 1 guia = 2 fetch (no 4, aunque hay 2 actividades)");
  // deliverySummary se crea DENTRO del sandbox -- comparar campo a campo (ver nota arriba).
  assert.equal(events[0].deliverySummary.total, 2);
  assert.equal(events[0].deliverySummary.delivered, 1);
  assert.equal(events[0].deliverySummary.pending, 1);
  assert.equal(events[0].deliverySummary.overdue, 0);
  assert.equal(events[1].deliverySummary.total, 2);
  assert.equal(events[1].deliverySummary.delivered, 0);
  assert.equal(events[1].deliverySummary.pending, 2);
  assert.equal(events[1].deliverySummary.overdue, 2);
});

test("computeGuideDeliveryCounts: sin ActivityStandard disponible, marca deliverySummary null (no inventa)", async () => {
  const mod = loadSandbox({ portalAuth: baseAuth() });
  const events = [{ type: "ENTREGA", sourceId: "guia.html::act1", ficha: "3441939", status: "pending" }];
  const summary = await mod.computeGuideDeliveryCounts(events, []);
  assert.equal(summary.computed, 0);
  assert.equal(events[0].deliverySummary, null);
});
