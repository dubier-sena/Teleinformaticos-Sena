"use strict";

// Motor de "Diagnostico y reparacion" (10 casos, items 18-35). Verifica que
// cada caso: (a) arranca con el sintoma de falla, (b) NO se puede "arreglar"
// solo, (c) SI se resuelve aplicando la reparacion correcta, y (d) los casos
// 1 y 3 no exigen abrir el gabinete (item 21). Tambien prueba la aleatoriedad
// del Caso 10 y el conteo de eficiencia (item 32).

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadHardwareLab() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  [
    "hardware_lab_tools.js",
    "hardware_lab_data_desktop.js",
    "hardware_lab_engine.js",
    "hardware_lab_diagnosis_engine.js",
    "hardware_lab_diagnosis_cases.js",
  ].forEach((file) => {
    const code = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
    vm.runInContext(code, sandbox);
  });
  return sandbox.window.HardwareLab;
}

const HardwareLab = loadHardwareLab();
const DiagEngine = HardwareLab.DiagnosisEngine;
const desktop = HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;
const CASES = HardwareLab.DiagnosisCases.CASES;

function openCaseIfNeeded(session) {
  if (session.parts["side-panel"] === false) return session; // ya abierto
  return DiagEngine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "phillips",
  }).session;
}

// Aplica la reparacion correcta segun el tipo de fixCondition, para
// verificar que el caso SI es resoluble tal como esta definido.
function solveFixCondition(session, fixCondition) {
  var part = DiagEngine.getPart(desktop, fixCondition.partId);
  if (part.location === "internal") session = openCaseIfNeeded(session);

  if (fixCondition.type === "stateEquals") {
    var action = part.kind === "cable" ? "connect" : "install";
    var outcome = DiagEngine.attemptAction(desktop, session, {
      action: action,
      partId: fixCondition.partId,
      toolId: part.tool,
    });
    assert.strictEqual(outcome.ok, true, "fallo al aplicar la reparacion: " + outcome.message);
    return outcome.session;
  }

  if (fixCondition.type === "reseated") {
    var removeAction = part.kind === "cable" ? "disconnect" : "remove";
    var installAction = part.kind === "cable" ? "connect" : "install";

    // La pieza puede tener sus propios cables (GPU, disipador): hay que
    // desconectarlos antes de poder retirarla, y reconectarlos despues para
    // que la reparacion quede REALMENTE completa (ver isFixConditionMet).
    (part.removeRequires || []).forEach(function (depId) {
      if (session.parts[depId] === false) return;
      var dep = DiagEngine.getPart(desktop, depId);
      var out = DiagEngine.attemptAction(desktop, session, { action: "disconnect", partId: depId, toolId: dep.tool });
      assert.strictEqual(out.ok, true, "fallo al desconectar dependencia " + depId + ": " + out.message);
      session = out.session;
    });

    var out1 = DiagEngine.attemptAction(desktop, session, {
      action: removeAction,
      partId: fixCondition.partId,
      toolId: part.tool,
    });
    assert.strictEqual(out1.ok, true, "fallo al retirar para reasentar: " + out1.message);
    var out2 = DiagEngine.attemptAction(desktop, out1.session, {
      action: installAction,
      partId: fixCondition.partId,
      toolId: part.tool,
    });
    assert.strictEqual(out2.ok, true, "fallo al reinstalar tras reasentar: " + out2.message);
    session = out2.session;

    (part.removeRequires || []).forEach(function (depId) {
      var dep = DiagEngine.getPart(desktop, depId);
      var out = DiagEngine.attemptAction(desktop, session, { action: "connect", partId: depId, toolId: dep.tool });
      assert.strictEqual(out.ok, true, "fallo al reconectar dependencia " + depId + ": " + out.message);
      session = out.session;
    });

    return session;
  }

  throw new Error("Tipo de fixCondition no soportado en el test: " + fixCondition.type);
}

CASES.forEach(function (caseDef) {
  test(
    "Caso " + caseDef.number + " (" + caseDef.name + "): arranca roto, no se autoarregla, y SI se resuelve con la reparacion correcta",
    () => {
      // rng fijo para casos con faultPool (Caso 10): siempre la primera variante.
      var session = DiagEngine.createDiagnosisSession(desktop, caseDef, { rng: () => 0 });

      var before = DiagEngine.checkPowerOn(desktop, session);
      assert.strictEqual(before.fixed, false, "El caso deberia arrancar con la falla presente");
      session = before.session;

      session = solveFixCondition(session, session.fixCondition);

      var after = DiagEngine.checkPowerOn(desktop, session);
      assert.strictEqual(after.fixed, true, "El caso deberia quedar resuelto tras la reparacion correcta: " + after.message);
    }
  );
});

test("Caso 1 y Caso 3 se resuelven SIN abrir el gabinete (item 21: no siempre hay que abrir el computador)", () => {
  var case1 = CASES.find((c) => c.id === "caso-01");
  var case3 = CASES.find((c) => c.id === "caso-03");

  [case1, case3].forEach(function (caseDef) {
    var session = DiagEngine.createDiagnosisSession(desktop, caseDef);
    var outcome = DiagEngine.attemptAction(desktop, session, {
      action: "connect",
      partId: caseDef.fault.overrides[0].partId,
      toolId: "hands",
    });
    assert.strictEqual(outcome.ok, true, "Deberia poder repararse sin abrir el gabinete: " + outcome.message);
    var check = DiagEngine.checkPowerOn(desktop, outcome.session);
    assert.strictEqual(check.fixed, true);
    assert.strictEqual(outcome.session.parts["side-panel"], true, "La tapa lateral nunca debio tocarse en este caso");
  });
});

test("Caso 10 (falla desconocida) cambia de variante segun el rng: no siempre la misma falla", () => {
  var caseDef = CASES.find((c) => c.id === "caso-10");
  var seenPartIds = new Set();
  caseDef.faultPool.forEach(function (_, idx) {
    var rngValue = idx / caseDef.faultPool.length; // fuerza cada indice del pool
    var session = DiagEngine.createDiagnosisSession(desktop, caseDef, { rng: () => rngValue });
    seenPartIds.add(session.fixCondition.partId);
  });
  assert.strictEqual(seenPartIds.size, caseDef.faultPool.length, "cada valor de rng deberia mapear a una variante distinta");
});

test("tocar una pieza que NO es parte de la falla real se registra como accion innecesaria (item 32, eficiencia)", () => {
  var caseDef = CASES.find((c) => c.id === "caso-03"); // fault: solo cable-video, sin abrir gabinete
  var session = DiagEngine.createDiagnosisSession(desktop, caseDef);

  // El aprendiz abre el gabinete y retira la RAM "por si acaso" (innecesario:
  // el caso 3 no depende de RAM ni de que el gabinete este abierto).
  session = DiagEngine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "phillips",
  }).session;
  session = DiagEngine.attemptAction(desktop, session, {
    action: "remove",
    partId: "ram",
    toolId: "hands",
  }).session;

  // deepEqual (no deepStrictEqual): el array viene del sandbox vm, con su
  // propio Object/Array.prototype (otro realm) -- ver mismo gotcha en
  // tests/hardware_lab_storage.test.cjs.
  assert.deepEqual(session.unnecessaryPartIds.sort(), ["ram", "side-panel"].sort());

  var finished = DiagEngine.finish(session);
  // Eficiencia max 10, -2 por cada pieza innecesaria (2 piezas) = 6.
  assert.strictEqual(finished.result.breakdown.eficiencia.value, 6);
});

test("usar pistas reduce hints.max disponibles y penaliza la categoria Diagnostico si se resuelve el caso", () => {
  var caseDef = CASES.find((c) => c.id === "caso-01");
  var session = DiagEngine.createDiagnosisSession(desktop, caseDef);
  var hint1 = DiagEngine.useHint(session, caseDef);
  assert.strictEqual(hint1.ok, true);
  assert.strictEqual(hint1.message, caseDef.hints[0]);
  session = hint1.session;

  session = solveFixCondition(session, session.fixCondition);
  var check = DiagEngine.checkPowerOn(desktop, session);
  assert.strictEqual(check.fixed, true);
  session = check.session;

  var finished = DiagEngine.finish(session);
  assert.strictEqual(finished.result.breakdown.diagnostico.value, 25); // 30 - 1*5
  assert.strictEqual(finished.result.score, finished.result.breakdown.total);
});

test("finish() sin haber resuelto el caso da Diagnostico y Reparacion en 0, pero conserva Herramientas/Procedimiento/Eficiencia", () => {
  var caseDef = CASES.find((c) => c.id === "caso-05");
  var session = DiagEngine.createDiagnosisSession(desktop, caseDef);
  var finished = DiagEngine.finish(session); // nunca se resolvio
  assert.strictEqual(finished.result.breakdown.diagnostico.value, 0);
  assert.strictEqual(finished.result.breakdown.reparacion.value, 0);
  assert.strictEqual(finished.result.breakdown.herramientas.value, 10);
  assert.strictEqual(finished.result.breakdown.procedimiento.value, 25);
  assert.strictEqual(finished.result.breakdown.eficiencia.value, 10);
  assert.strictEqual(finished.result.status, "POR MEJORAR");
});
