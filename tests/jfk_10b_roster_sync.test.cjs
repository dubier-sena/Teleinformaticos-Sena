const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../tools/sync_jfk_10b_roster.cjs");

test("normalizes official names without changing visible spelling", () => {
  assert.equal(sync.normalizeName("CASTELLANOS HINCAPIE ALJSSON SOFIA"), "CASTELLANOS HINCAPIE ALJSSON SOFIA");
  assert.equal(sync.normalizeName("Alisson Sofía Castellanos hincapié"), "ALISSON SOFIA CASTELLANOS HINCAPIE");
});

test("classifies reordered full-name token matches as safe", () => {
  const official = "BETANCOURT TRILLOS DANNA VALENTINA";
  const existing = [{ fullName: "Danna valentina betancourt trillos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "danna_123." }];
  const plan = sync.buildComparisonPlan(existing, [official]);
  assert.equal(plan.officialResults[0].classification, "coincidencia_segura");
  assert.equal(plan.safeUpdates.length, 1);
});

test("does not auto-update exact duplicate candidates", () => {
  const official = "BETANCOURT TRILLOS DANNA VALENTINA";
  const existing = [
    { fullName: "Danna valentina betancourt trillos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "a" },
    { fullName: "danna valentina betancourt trillos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "b" },
  ];
  const plan = sync.buildComparisonPlan(existing, [official]);
  assert.equal(plan.officialResults[0].classification, "posible_duplicado");
  assert.equal(plan.safeUpdates.length, 0);
});

test("keeps partial-name matches pending instead of creating a duplicate", () => {
  const official = "ACOSTA ROJAS SARA JIZETH";
  const existing = [{ fullName: "Sara acosta", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "sara" }];
  const plan = sync.buildComparisonPlan(existing, [official]);
  assert.equal(plan.officialResults[0].classification, "pendiente_revision");
  assert.equal(plan.safeCreates.length, 0);
});

test("leaves official names not found as possible retirements", () => {
  const official = "VELEZ VERGARA JOHAN ESTEBAN";
  const plan = sync.buildComparisonPlan([], [official]);
  assert.equal(plan.officialResults[0].classification, "no_encontrado_posible_retiro");
  assert.equal(plan.safeCreates.length, 0);
  assert.equal(plan.summary.noEncontradoPosibleRetiro, 1);
});
