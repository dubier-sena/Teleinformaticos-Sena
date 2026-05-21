const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../tools/sync_jfk_10b_roster.cjs");

test("normalizes official names for search without changing visible spelling", () => {
  assert.equal(sync.normalizeName("[DATO REDACTADO] ALJSSON SOFIA"), "[DATO REDACTADO] ALJSSON SOFIA");
  assert.equal(sync.normalizeName("Alisson Sofia [DATO REDACTADO]"), "ALISSON SOFIA [DATO REDACTADO]");
  assert.equal(sync.normalizeName("[DATO REDACTADO]"), "MUNOZ MAHECHA NICOL DAYANNA");
});

test("classifies reordered full-name token matches as safe", () => {
  const official = "[DATO REDACTADO]";
  const existing = [{ fullName: "Danna valentina [DATO REDACTADO]", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "danna_123." }];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "coincidencia_segura");
  assert.equal(plan.summary.safeUpdates, 1);
});

test("does not auto-update exact duplicate candidates", () => {
  const official = "[DATO REDACTADO]";
  const existing = [
    { fullName: "Danna valentina [DATO REDACTADO]", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "a" },
    { fullName: "danna valentina [DATO REDACTADO]", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "b" },
  ];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "posible_duplicado");
  assert.equal(plan.summary.safeUpdates, 0);
});

test("keeps partial-name matches pending instead of creating a duplicate", () => {
  const official = "[DATO REDACTADO]";
  const existing = [{ fullName: "Sara acosta", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "sara" }];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "pendiente_revision");
  assert.equal(plan.summary.safeCreates, 0);
});

test("leaves official names not found as new learners pending safe creation", () => {
  const official = "[DATO REDACTADO]";
  const plan = sync.buildComparisonPlan([], { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "aprendiz_nuevo");
  assert.equal(plan.summary.safeCreates, 1);
  assert.equal(plan.summary.aprendizNuevo, 1);
});

test("builds per-ficha summaries for the six official rosters", () => {
  const plan = sync.buildComparisonPlan([], { allowCreates: false });

  assert.equal(plan.officialExpected, 113);
  assert.deepEqual(
    Object.fromEntries(Object.entries(plan.byFicha).map(([ficha, item]) => [ficha, item.officialExpected])),
    {
      "3441939": 20,
      "3441942": 20,
      "3441944": 20,
      "3441950": 19,
      "3168850": 17,
      "3168852": 17,
    }
  );
  assert.equal(plan.summary.aprendizNuevo, 113);
  assert.equal(plan.summary.safeCreates, 0);
});

test("keeps existing users outside the official list as non-destructive extras", () => {
  const official = "[DATO REDACTADO]";
  const existing = [
    { fullName: "Danna valentina [DATO REDACTADO]", grupo: "10B", ficha: "3441942", _docId: "danna" },
    { fullName: "Learner extra", grupo: "10B", ficha: "3441942", _docId: "extra" },
  ];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].existingNotOfficial.length, 1);
  assert.equal(plan.summary.aprendizExistenteNoOficial, 1);
});
