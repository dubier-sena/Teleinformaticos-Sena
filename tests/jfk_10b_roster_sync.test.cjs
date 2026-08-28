const test = require("node:test");
const assert = require("node:assert/strict");
const sync = require("../tools/sync_jfk_10b_roster.cjs");

test("normalizes official names for search without changing visible spelling", () => {
  assert.equal(sync.normalizeName("MORENO HINCAPIE ALJSSON SOFIA"), "MORENO HINCAPIE ALJSSON SOFIA");
  assert.equal(sync.normalizeName("Aljsson Sofia Moreno hincapie"), "ALJSSON SOFIA MORENO HINCAPIE");
  assert.equal(sync.normalizeName("NUÑEZ MAHECHA NICOL DAYANNA"), "NUNEZ MAHECHA NICOL DAYANNA");
});

test("classifies reordered full-name token matches as safe", () => {
  const official = "HERRERA CAMPOS DANNA VALENTINA";
  const existing = [{ fullName: "Danna valentina herrera campos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "danna_123." }];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "coincidencia_segura");
  assert.equal(plan.summary.safeUpdates, 1);
});

test("does not auto-update exact duplicate candidates", () => {
  const official = "HERRERA CAMPOS DANNA VALENTINA";
  const existing = [
    { fullName: "Danna valentina herrera campos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "a" },
    { fullName: "danna valentina herrera campos", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "b" },
  ];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "posible_duplicado");
  assert.equal(plan.summary.safeUpdates, 0);
});

test("keeps partial-name matches pending instead of creating a duplicate", () => {
  const official = "DIAZ MORENO SARA JIZETH";
  const existing = [{ fullName: "Sara diaz", grupo: "10B", ficha: "3441942", inst: "Institucion Educativa Jhon F. Kennedy", _docId: "sara" }];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "pendiente_revision");
  assert.equal(plan.summary.safeCreates, 0);
});

test("leaves official names not found as new learners pending safe creation", () => {
  const official = "CORDOBA VARGAS JOHAN ESTEBAN";
  const plan = sync.buildComparisonPlan([], { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].officialResults[0].classification, "aprendiz_nuevo");
  assert.equal(plan.summary.safeCreates, 1);
  assert.equal(plan.summary.aprendizNuevo, 1);
});

// Bloque G (2026-08-27): antes esta prueba dependia del roster REAL de 113
// aprendices reales que vivia hardcodeado en el modulo (hallazgo de privacidad,
// ver .gitignore). Ahora el modulo ya no trae ningun roster por defecto --
// se construye uno SINTETICO de varias fichas aqui mismo para seguir probando
// la misma logica de agregacion por ficha, sin depender de datos reales.
test("builds per-ficha summaries across multiple fichas", () => {
  const syntheticRosters = {
    "1111111": ["PEREZ GOMEZ JUAN DAVID", "RAMIREZ TORRES LAURA VALENTINA"],
    "2222222": ["GOMEZ RUIZ MARIA FERNANDA", "TORRES DIAZ CARLOS ANDRES", "MENDEZ SILVA ANA MARIA"],
    "3333333": ["CASTRO LEON PEDRO PABLO"],
  };
  const plan = sync.buildComparisonPlan([], { allowCreates: false, rosters: syntheticRosters });

  assert.equal(plan.officialExpected, 6);
  assert.deepEqual(
    Object.fromEntries(Object.entries(plan.byFicha).map(([ficha, item]) => [ficha, item.officialExpected])),
    {
      "1111111": 2,
      "2222222": 3,
      "3333333": 1,
    }
  );
  assert.equal(plan.summary.aprendizNuevo, 6);
  assert.equal(plan.summary.safeCreates, 0);
});

test("keeps existing users outside the official list as non-destructive extras", () => {
  const official = "HERRERA CAMPOS DANNA VALENTINA";
  const existing = [
    { fullName: "Danna valentina herrera campos", grupo: "10B", ficha: "3441942", _docId: "danna" },
    { fullName: "Learner extra", grupo: "10B", ficha: "3441942", _docId: "extra" },
  ];
  const plan = sync.buildComparisonPlan(existing, { rosters: { "3441942": [official] } });

  assert.equal(plan.byFicha["3441942"].existingNotOfficial.length, 1);
  assert.equal(plan.summary.aprendizExistenteNoOficial, 1);
});
