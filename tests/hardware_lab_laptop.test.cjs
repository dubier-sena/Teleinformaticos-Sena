"use strict";

// Datos del computador portatil (js/hardware_lab_data_laptop.js): igual que
// tests/hardware_lab_engine.test.cjs para el escritorio, el objetivo
// principal es verificar que el grafo de dependencias construido a mano (18
// piezas, mas complejo que el escritorio por el cable de bateria y las
// antenas Wi-Fi) es internamente consistente en ambas secuencias guiadas.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadHardwareLab() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  ["hardware_lab_tools.js", "hardware_lab_data_laptop.js", "hardware_lab_engine.js"].forEach(
    (file) => {
      const code = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
      vm.runInContext(code, sandbox);
    }
  );
  return sandbox.window.HardwareLab;
}

const HardwareLab = loadHardwareLab();
const Engine = HardwareLab.Engine;
const laptop = HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;

function runFullSequence(mode) {
  var session = Engine.createSession(laptop, mode);
  while (!Engine.isFinished(session)) {
    var step = Engine.currentStep(session);
    var outcome;
    if (step.kind === "safety") {
      outcome = Engine.attemptSafetyStep(session, step.id);
    } else {
      var part = laptop.parts[step.partId];
      outcome = Engine.attemptAction(laptop, session, {
        action: step.action,
        partId: step.partId,
        toolId: part.tool,
      });
    }
    assert.strictEqual(
      outcome.ok,
      true,
      "Paso fallido en " + mode + ": " + JSON.stringify(step) + " -> " + outcome.message
    );
    session = outcome.session;
  }
  return session;
}

test("la secuencia de desensamble guiado del portatil completa sin errores en el orden declarado", () => {
  const session = runFullSequence("disassembly-guided");
  assert.strictEqual(session.errors, 0);
  Object.keys(laptop.parts).forEach((id) => {
    assert.strictEqual(session.parts[id], false, "La pieza " + id + " deberia quedar removida/desconectada");
  });
});

test("la secuencia de ensamble guiado del portatil completa sin errores en el orden declarado", () => {
  const session = runFullSequence("assembly-guided");
  assert.strictEqual(session.errors, 0);
  Object.keys(laptop.parts).forEach((id) => {
    assert.strictEqual(session.parts[id], true, "La pieza " + id + " deberia quedar instalada/conectada");
  });
});

test("el cable de bateria bloquea CUALQUIER pieza interna hasta desconectarse (regla especifica de portatil)", () => {
  var session = Engine.createSession(laptop, "disassembly-open");
  // Confirma los 5 pasos de seguridad y abre la tapa, pero NO desconecta
  // todavia el cable de bateria.
  while (true) {
    const step = Engine.currentStep(session);
    if (!step || step.kind !== "safety") break;
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  session = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "bottom-cover",
    toolId: "phillips",
  }).session;

  const outcome = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "ram",
    toolId: "hands",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /Cable de la bateria/);
});

test("las antenas Wi-Fi deben desconectarse antes de retirar la pantalla, y antes de la tarjeta Wi-Fi", () => {
  var session = Engine.createSession(laptop, "disassembly-open");
  while (true) {
    const step = Engine.currentStep(session);
    if (!step || step.kind !== "safety") break;
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  session = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "bottom-cover",
    toolId: "phillips",
  }).session;
  session = Engine.attemptAction(laptop, session, {
    action: "disconnect",
    partId: "cable-battery",
    toolId: "hands",
  }).session;
  session = Engine.attemptAction(laptop, session, {
    action: "disconnect",
    partId: "cable-screen-flex",
    toolId: "hands",
  }).session;

  // Intentar retirar la pantalla sin desconectar las antenas debe fallar
  // explicando cuales antenas faltan.
  const outcome = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "screen-assembly",
    toolId: "phillips",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /Antena Wi-Fi 1/);
  assert.match(outcome.message, /Antena Wi-Fi 2/);
});

test("motherboard del portatil exige TODOS los cables/tarjeta Wi-Fi/cooler resueltos antes de retirarse", () => {
  var session = Engine.createSession(laptop, "disassembly-open");
  while (true) {
    const step = Engine.currentStep(session);
    if (!step || step.kind !== "safety") break;
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  session = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "bottom-cover",
    toolId: "phillips",
  }).session;
  session = Engine.attemptAction(laptop, session, {
    action: "disconnect",
    partId: "cable-battery",
    toolId: "hands",
  }).session;

  const outcome = Engine.attemptAction(laptop, session, {
    action: "remove",
    partId: "motherboard",
    toolId: "phillips",
  });
  assert.strictEqual(outcome.ok, false);
  // Debe listar multiples piezas pendientes (wifi-card, cables de teclado/
  // touchpad/pantalla, cable+modulo de ventilador), no solo una.
  assert.match(outcome.message, /Tarjeta Wi-Fi/);
  assert.match(outcome.message, /Cable flex del teclado/);
});
