"use strict";

// Fase Agenda Academica (bloque bitacoras/Sofia Plus, 2026-08-24): migracion
// de BITACORA_DEADLINES (hardcodeado) a fechas admin-editables, con 14
// requisitos explicitos del usuario -- el mas importante: si el admin QUITA
// una fecha, debe quedar realmente sin fecha limite, sin "resucitar" el
// valor legacy (confundir "nunca configurado" con "eliminado a proposito"
// habria sido el bug real a evitar aqui). Ver js/productive_stage_deadlines.js.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// require() directo (no vm.createContext): mismo criterio ya establecido
// para modulos UMD puros (ver tests/word_search_generator.test.cjs) --
// vm.createContext crea un realm separado con su PROPIO Date/Object, y
// "instanceof Date" / assert.deepEqual({}, {}) entre realms distintos falla
// de formas confusas aunque la logica real sea correcta.
const deadlines = require(path.join(root, "js/productive_stage_deadlines.js"));

// ── normalizeDueAt / dueAtForInput (mismo criterio Bogota que activity_deadlines.js) ──

test("normalizeDueAt: interpreta un datetime-local sin zona como hora Bogota (-05:00)", () => {
  const iso = deadlines.normalizeDueAt("2026-09-05T17:30");
  assert.equal(iso, new Date("2026-09-05T17:30:00-05:00").toISOString());
});

test("normalizeDueAt: acepta ISO con zona explicita tal cual", () => {
  const iso = deadlines.normalizeDueAt("2026-09-05T22:30:00.000Z");
  assert.equal(iso, "2026-09-05T22:30:00.000Z");
});

test("normalizeDueAt: cadena vacia o invalida -> string vacio (nunca lanza)", () => {
  assert.equal(deadlines.normalizeDueAt(""), "");
  assert.equal(deadlines.normalizeDueAt("no-es-una-fecha"), "");
});

test("dueAtForInput: round-trip con normalizeDueAt recupera el mismo datetime-local", () => {
  const input = "2026-09-05T17:30";
  const iso = deadlines.normalizeDueAt(input);
  assert.equal(deadlines.dueAtForInput(iso), input);
});

// ── Legacy: las 7 fechas hardcodeadas se preservan EXACTAS (punto 8: la migracion no cambia nada) ──

test("legacyDeadlineIso: las 6 bitacoras + Sofia Plus devuelven exactamente las fechas ya acordadas (fin de dia Bogota)", () => {
  const expectedDateOnly = {
    "sofia-plus": "2026-03-27",
    "bitacora-1": "2026-03-27",
    "bitacora-2": "2026-04-30",
    "bitacora-3": "2026-05-29",
    "bitacora-4": "2026-07-31",
    "bitacora-5": "2026-08-28",
    "bitacora-6": "2026-10-23",
  };
  Object.keys(expectedDateOnly).forEach((docId) => {
    const iso = deadlines.legacyDeadlineIso(docId);
    assert.equal(iso, new Date(expectedDateOnly[docId] + "T23:59:00-05:00").toISOString(), docId);
  });
});

test("legacyDeadlineIso: un docId sin fecha legacy (ficha-inscripcion, acuerdo) devuelve string vacio -- no se inventa fecha", () => {
  assert.equal(deadlines.legacyDeadlineIso("ficha-inscripcion"), "");
  assert.equal(deadlines.legacyDeadlineIso("acuerdo-etapa-productiva"), "");
});

// ── resolveEffectiveDeadline: precedencia admin > cleared > legacy (puntos 6/7/8/9) ──

test("resolveEffectiveDeadline: snapshot vacio (nunca configurado, o fuente no disponible) -> legacy", () => {
  const result = deadlines.resolveEffectiveDeadline({ documentDeadlines: {} }, "bitacora-2");
  assert.equal(result.source, "legacy");
  assert.equal(result.dueAt, deadlines.legacyDeadlineIso("bitacora-2"));
});

test("resolveEffectiveDeadline: admin configuro una fecha real -> se usa esa, no la legacy", () => {
  const snapshot = {
    documentDeadlines: {
      "bitacora-2": { dueAt: "2026-05-10T22:30:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z", updatedBy: "admin.test" },
    },
  };
  const result = deadlines.resolveEffectiveDeadline(snapshot, "bitacora-2");
  assert.equal(result.source, "admin");
  assert.equal(result.dueAt, "2026-05-10T22:30:00.000Z");
  assert.notEqual(result.dueAt, deadlines.legacyDeadlineIso("bitacora-2"));
});

// Punto 14 (prueba obligatoria explicita del usuario): el caso critico.
test("resolveEffectiveDeadline: el admin QUITA la fecha -> queda SIN fecha, NO resucita la legacy", () => {
  const snapshot = {
    documentDeadlines: {
      "bitacora-2": { cleared: true, updatedAt: "2026-08-24T00:00:00.000Z", updatedBy: "admin.test" },
    },
  };
  const result = deadlines.resolveEffectiveDeadline(snapshot, "bitacora-2");
  assert.equal(result.source, "cleared");
  assert.equal(result.dueAt, "", "un documento 'cleared' debe quedar SIN fecha limite");
});

test("resolveEffectiveDeadline: 'cleared' en un docId no debe afectar a los demas (fechas independientes, punto 1)", () => {
  const snapshot = {
    documentDeadlines: {
      "bitacora-2": { cleared: true, updatedAt: "2026-08-24T00:00:00.000Z", updatedBy: "admin.test" },
      "bitacora-3": { dueAt: "2026-06-01T22:00:00.000Z", updatedAt: "2026-08-24T00:00:00.000Z", updatedBy: "admin.test" },
    },
  };
  assert.equal(deadlines.resolveEffectiveDeadline(snapshot, "bitacora-1").source, "legacy");
  assert.equal(deadlines.resolveEffectiveDeadline(snapshot, "bitacora-2").source, "cleared");
  assert.equal(deadlines.resolveEffectiveDeadline(snapshot, "bitacora-3").source, "admin");
  assert.equal(deadlines.resolveEffectiveDeadline(snapshot, "bitacora-3").dueAt, "2026-06-01T22:00:00.000Z");
  assert.equal(deadlines.resolveEffectiveDeadline(snapshot, "bitacora-6").source, "legacy");
});

// ── setDeadline / clearDeadline (contrato con productiveStageStore) ──

test("setDeadline: exige una fecha valida y no silenciosamente acepta un valor vacio", () => {
  assert.throws(() => deadlines.setDeadline({ documentDeadlines: {} }, "bitacora-1", "", "admin"));
});

// ── classifyStatus (punto 10): estados visibles del aprendiz, hora Bogota ──

test("classifyStatus: entregado siempre gana, sin importar la fecha limite", () => {
  const status = deadlines.classifyStatus({ dueAt: "2020-01-01T00:00:00.000Z", deliveredAt: "2026-08-24T00:00:00.000Z" });
  assert.equal(status, deadlines.STATUS.DELIVERED);
});

test("classifyStatus: sin fecha limite y sin entrega -> no-deadline", () => {
  assert.equal(deadlines.classifyStatus({ dueAt: "" }), deadlines.STATUS.NO_DEADLINE);
});

test("classifyStatus: fecha ya pasada -> vencida", () => {
  const now = new Date("2026-09-06T00:00:00.000Z");
  const status = deadlines.classifyStatus({ dueAt: "2026-09-05T22:59:00.000Z", now: now });
  assert.equal(status, deadlines.STATUS.OVERDUE);
});

test("classifyStatus: vence exactamente 'hoy' en Bogota, aunque el runner corra en UTC", () => {
  // 05-sep 2026 hora Bogota: entre 05:00 UTC (00:00 Bogota) y 05:00 UTC del
  // dia siguiente. "now" e "dueAt" caen ambos dentro de esa ventana.
  const now = new Date("2026-09-05T13:00:00.000Z"); // 08:00 Bogota, 5-sep
  const dueAt = "2026-09-05T23:00:00.000Z"; // 18:00 Bogota, 5-sep (aun no vence)
  assert.equal(deadlines.classifyStatus({ dueAt: dueAt, now: now }), deadlines.STATUS.DUE_TODAY);
});

test("classifyStatus: vence 'mañana' en Bogota", () => {
  const now = new Date("2026-09-05T13:00:00.000Z"); // 08:00 Bogota, 5-sep
  const dueAt = "2026-09-07T02:00:00.000Z"; // 21:00 Bogota, 6-sep
  assert.equal(deadlines.classifyStatus({ dueAt: dueAt, now: now }), deadlines.STATUS.DUE_TOMORROW);
});

test("classifyStatus: mas de 2 dias en el futuro -> pendiente (no 'hoy' ni 'mañana')", () => {
  const now = new Date("2026-09-05T13:00:00.000Z");
  const dueAt = "2026-09-10T13:00:00.000Z";
  assert.equal(deadlines.classifyStatus({ dueAt: dueAt, now: now }), deadlines.STATUS.PENDING);
});

// Seccion 25 del pedido original: 11:59 p.m. / 12:00 a.m. / cambio de dia.
test("classifyStatus: 23:59 Bogota sigue siendo 'hoy'; 00:00 del dia siguiente ya es 'vencida' si el limite era el dia anterior", () => {
  const dueAt = deadlines.normalizeDueAt("2026-09-05T23:59"); // 23:59 Bogota, 5-sep
  const justBefore = new Date("2026-09-06T04:58:00.000Z"); // 23:58 Bogota, 5-sep
  const justAfter = new Date("2026-09-06T05:00:01.000Z"); // 00:00:01 Bogota, 6-sep
  assert.equal(deadlines.classifyStatus({ dueAt: dueAt, now: justBefore }), deadlines.STATUS.DUE_TODAY);
  assert.equal(deadlines.classifyStatus({ dueAt: dueAt, now: justAfter }), deadlines.STATUS.OVERDUE);
});

// ── productive_stage_store.js: documentDeadlines (nuevo campo) ──

const productiveStageStore = require(path.join(root, "js/productive_stage_store.js"));
function loadStoreModule() {
  return productiveStageStore;
}

test("productiveStageStore.createEmptySnapshot incluye documentDeadlines vacio", () => {
  const store = loadStoreModule();
  const empty = store.createEmptySnapshot();
  assert.equal(Object.keys(empty.documentDeadlines).length, 0);
});

test("productiveStageStore.setDocumentDeadlineInSnapshot es puro (no muta el snapshot original) y preserva el resto", () => {
  const store = loadStoreModule();
  const before = store.createEmptySnapshot();
  before.projects.push({ id: "p1" });
  const after = store.setDocumentDeadlineInSnapshot(before, "bitacora-1", { dueAt: "2026-09-01T00:00:00.000Z", updatedAt: "x", updatedBy: "admin" });

  assert.deepEqual(before.documentDeadlines, {}, "el snapshot original no debe mutarse");
  assert.equal(after.documentDeadlines["bitacora-1"].dueAt, "2026-09-01T00:00:00.000Z");
  assert.equal(after.projects.length, 1, "el resto del snapshot se preserva");
});

test("productiveStageStore.mergeImportIntoSnapshot preserva documentDeadlines existentes (un import de Excel no debe borrar fechas ya configuradas)", () => {
  const store = loadStoreModule();
  const before = store.setDocumentDeadlineInSnapshot(
    store.createEmptySnapshot(),
    "bitacora-3",
    { dueAt: "2026-06-01T00:00:00.000Z", updatedAt: "x", updatedBy: "admin" }
  );
  const merged = store.mergeImportIntoSnapshot(before, {
    projects: [],
    reports: [],
    importBatchId: "b1",
    sourceFileName: "informe.docx",
    importedAt: "2026-08-24T00:00:00.000Z",
    summary: {},
    alerts: [],
  });
  assert.equal(merged.documentDeadlines["bitacora-3"].dueAt, "2026-06-01T00:00:00.000Z");
});
