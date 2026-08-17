"use strict";

// Motor del Laboratorio Virtual de Hardware (MVP: PC de escritorio,
// desensamble/ensamble guiado). Carga los 3 modulos de navegador
// (hardware_lab_tools.js, hardware_lab_data_desktop.js, hardware_lab_engine.js)
// en un sandbox vm, igual que el resto de tests de este proyecto que prueban
// codigo escrito como window.X = {...} (ver firebase_auth_bridge_signin.test.cjs).
//
// El objetivo principal de este archivo es verificar que el GRAFO DE
// DEPENDENCIAS declarado a mano en hardware_lab_data_desktop.js es
// internamente consistente: que las secuencias de desensamble y ensamble
// completan sin errores en el orden declarado (si alguien reordena un paso
// sin actualizar las dependencias, este test debe fallar).

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadHardwareLab() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  ["hardware_lab_tools.js", "hardware_lab_data_desktop.js", "hardware_lab_engine.js"].forEach(
    (file) => {
      const code = fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
      vm.runInContext(code, sandbox);
    }
  );
  return sandbox.window.HardwareLab;
}

const HardwareLab = loadHardwareLab();
const Engine = HardwareLab.Engine;
const desktop = HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;

function runFullSequence(mode) {
  var session = Engine.createSession(desktop, mode);
  while (!Engine.isFinished(session)) {
    var step = Engine.currentStep(session);
    var outcome;
    if (step.kind === "safety") {
      outcome = Engine.attemptSafetyStep(session, step.id);
    } else {
      var part = desktop.parts[step.partId];
      outcome = Engine.attemptAction(desktop, session, {
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

test("la secuencia de desensamble guiado del escritorio completa sin errores en el orden declarado", () => {
  const session = runFullSequence("disassembly-guided");
  assert.strictEqual(session.errors, 0);
  assert.strictEqual(Engine.isFinished(session), true);
  // Al final del desensamble completo, todas las piezas deben quedar ausentes.
  Object.keys(desktop.parts).forEach((id) => {
    assert.strictEqual(session.parts[id], false, "La pieza " + id + " deberia quedar removida/desconectada");
  });
});

test("la secuencia de ensamble guiado del escritorio completa sin errores en el orden declarado", () => {
  const session = runFullSequence("assembly-guided");
  assert.strictEqual(session.errors, 0);
  assert.strictEqual(Engine.isFinished(session), true);
  Object.keys(desktop.parts).forEach((id) => {
    assert.strictEqual(session.parts[id], true, "La pieza " + id + " deberia quedar instalada/conectada");
  });
});

test("no se puede tocar una pieza interna con el gabinete cerrado (tapa lateral puesta)", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  // Completa los 5 pasos de seguridad primero: la seguridad pendiente se
  // valida ANTES que el gabinete cerrado (no tiene sentido evaluar el
  // gabinete si ni siquiera se siguio el procedimiento de seguridad).
  for (let i = 0; i < 5; i++) {
    const step = Engine.currentStep(session);
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  // La tapa lateral (paso siguiente) todavia no se ha retirado; intentar la
  // GPU directamente debe bloquear por gabinete cerrado.
  const outcome = Engine.attemptAction(desktop, session, {
    action: "disconnect",
    partId: "cable-gpu-power",
    toolId: "hands",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /tapa lateral/i);
  assert.strictEqual(outcome.session.errorsByType.caseClosed, 1);
});

test("usar la herramienta incorrecta no permite la accion y explica cual usar", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  // Completa los 5 pasos de seguridad para llegar al paso de la tapa lateral.
  for (let i = 0; i < 5; i++) {
    const step = Engine.currentStep(session);
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  const outcome = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "flathead",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /Herramienta incorrecta/);
  assert.match(outcome.message, /Destornillador Phillips/);
  assert.strictEqual(outcome.session.errorsByType.wrongTool, 1);
});

test("retirar una pieza sin resolver su dependencia explica exactamente que falta (item 16)", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  for (let i = 0; i < 5; i++) {
    const step = Engine.currentStep(session);
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  session = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "phillips",
  }).session;

  // Intenta retirar la GPU sin haber desconectado su cable de alimentacion.
  const outcome = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "gpu",
    toolId: "phillips",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /No puedes retirar Tarjeta grafica \(GPU\) todavia/);
  assert.match(outcome.message, /Cable de alimentacion GPU/);
  assert.strictEqual(outcome.session.errorsByType.blocked, 1);
});

test("una accion valida en si misma pero fuera de orden explica cual es el siguiente paso", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  for (let i = 0; i < 5; i++) {
    const step = Engine.currentStep(session);
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
  session = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "phillips",
  }).session;

  // RAM no depende de ningun cable: retirarla ahora es "posible" pero no es
  // el paso que sigue (el motor guiado espera primero desconectar la GPU).
  const outcome = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "ram",
    toolId: "hands",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /siguiente paso es: desconectar Cable de alimentacion GPU/);
  assert.strictEqual(outcome.session.errorsByType.outOfOrder, 1);
});

test("intentar accion sobre una pieza mientras hay un paso de seguridad pendiente no truena y explica que falta primero", () => {
  const session = Engine.createSession(desktop, "disassembly-guided");
  // El primer paso es de seguridad (safety-power-off); intentar tocar
  // side-panel directamente NO debe lanzar excepcion (bug real: el motor
  // asumia step.action/step.partId, que los pasos de seguridad no tienen).
  const outcome = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "side-panel",
    toolId: "phillips",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /paso de seguridad actual/i);
  assert.strictEqual(outcome.session.errorsByType.safetyPending, 1);
});

test("finish() calcula la rubrica de 4 categorias y penaliza la categoria Seguridad por saltarse la seguridad pendiente", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  session = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "gpu",
    toolId: "phillips",
  }).session; // 1 error de tipo safetyPending (aun no se confirma ningun paso de seguridad)
  session = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "gpu",
    toolId: "phillips",
  }).session; // 1 error mas del mismo tipo

  assert.strictEqual(session.errors, 2);
  assert.strictEqual(session.errorsByType.safetyPending, 2);
  const finished = Engine.finish(session, { now: new Date(Date.parse(session.startedAt) + 5000).toISOString() });
  // Seguridad: 20 - 2*5 = 10; Procedimiento/Herramientas/Orden quedan perfectos.
  assert.strictEqual(finished.result.breakdown.seguridad.value, 10);
  assert.strictEqual(finished.result.breakdown.procedimiento.value, 30);
  assert.strictEqual(finished.result.score, 80);
  assert.strictEqual(finished.result.status, "APROBADO");
  assert.strictEqual(finished.result.durationSeconds, 5);
});

// ── Modo abierto (base de Practica libre, Evaluacion y Diagnostico) ────────

function confirmAllPendingSafety(session) {
  while (true) {
    const step = Engine.currentStep(session);
    if (!step || step.kind !== "safety") return session;
    session = Engine.attemptSafetyStep(session, step.id).session;
  }
}

test("modo abierto: bloquea acciones sobre piezas mientras haya seguridad pendiente, igual que el guiado", () => {
  const session = Engine.createSession(desktop, "disassembly-open");
  assert.strictEqual(session.kind, "open");
  const outcome = Engine.attemptAction(desktop, session, {
    action: "remove",
    partId: "ram",
    toolId: "hands",
  });
  assert.strictEqual(outcome.ok, false);
  assert.match(outcome.message, /paso de seguridad actual/i);
});

test("modo abierto: permite desensamblar en un ORDEN DISTINTO al guiado, siempre que respete las dependencias", () => {
  var session = Engine.createSession(desktop, "disassembly-open");
  session = confirmAllPendingSafety(session);

  // Orden deliberadamente distinto al de la secuencia guiada: primero RAM y
  // el conjunto CPU/disipador, despues GPU, despues almacenamiento, y al
  // final tarjeta madre + fuente. Cada paso ya satisface sus propias
  // dependencias en este punto (ver comentario en el archivo de datos).
  var altOrder = [
    { action: "remove", partId: "side-panel", toolId: "phillips" },
    { action: "remove", partId: "ram", toolId: "hands" },
    { action: "disconnect", partId: "cable-cpu-fan", toolId: "hands" },
    { action: "remove", partId: "cooler", toolId: "phillips" },
    { action: "remove", partId: "cpu", toolId: "hands" },
    { action: "disconnect", partId: "cable-atx", toolId: "hands" },
    { action: "disconnect", partId: "cable-cpu-eps", toolId: "hands" },
    { action: "disconnect", partId: "cable-front-panel", toolId: "hands" },
    { action: "disconnect", partId: "cable-gpu-power", toolId: "hands" },
    { action: "remove", partId: "gpu", toolId: "phillips" },
    { action: "disconnect", partId: "cable-sata-data", toolId: "hands" },
    { action: "disconnect", partId: "cable-sata-power", toolId: "hands" },
    { action: "remove", partId: "ssd", toolId: "phillips" },
    { action: "remove", partId: "ssd-m2", toolId: "phillips" },
    { action: "remove", partId: "motherboard", toolId: "phillips" },
    { action: "remove", partId: "psu", toolId: "phillips" },
  ];

  altOrder.forEach(function (attempt) {
    const outcome = Engine.attemptAction(desktop, session, attempt);
    assert.strictEqual(
      outcome.ok,
      true,
      "Fallo en orden alternativo: " + JSON.stringify(attempt) + " -> " + outcome.message
    );
    session = outcome.session;
  });

  assert.strictEqual(session.errors, 0);
  assert.strictEqual(Engine.isGoalReachedOpen(session), true);
  // Desensamble no tiene pasos de verificacion posteriores (solo ensamble),
  // asi que al llegar a la meta la practica ya deberia estar completa.
  assert.strictEqual(Engine.isFinished(session), true);
});

test("modo abierto de ensamble exige confirmar los pasos de verificacion FINALES tras alcanzar la meta", () => {
  var session = Engine.createSession(desktop, "assembly-open");
  // El ensamble abierto no tiene seguridad PREVIA (empieza con el gabinete
  // vacio), asi que se puede actuar sobre piezas de inmediato.
  var order = [
    { action: "install", partId: "motherboard", toolId: "phillips" },
    { action: "install", partId: "psu", toolId: "phillips" },
    { action: "connect", partId: "cable-atx", toolId: "hands" },
    { action: "connect", partId: "cable-cpu-eps", toolId: "hands" },
    { action: "connect", partId: "cable-front-panel", toolId: "hands" },
    { action: "install", partId: "cpu", toolId: "hands" },
    { action: "install", partId: "cooler", toolId: "phillips" },
    { action: "connect", partId: "cable-cpu-fan", toolId: "hands" },
    { action: "install", partId: "ram", toolId: "hands" },
    { action: "install", partId: "ssd", toolId: "phillips" },
    { action: "install", partId: "ssd-m2", toolId: "phillips" },
    { action: "connect", partId: "cable-sata-data", toolId: "hands" },
    { action: "connect", partId: "cable-sata-power", toolId: "hands" },
    { action: "install", partId: "gpu", toolId: "phillips" },
    { action: "connect", partId: "cable-gpu-power", toolId: "hands" },
    { action: "install", partId: "side-panel", toolId: "phillips" },
  ];
  order.forEach(function (attempt) {
    const outcome = Engine.attemptAction(desktop, session, attempt);
    assert.strictEqual(outcome.ok, true, JSON.stringify(attempt) + " -> " + outcome.message);
    session = outcome.session;
  });

  assert.strictEqual(Engine.isGoalReachedOpen(session), true);
  assert.strictEqual(Engine.isFinished(session), false, "aun faltan los pasos de verificacion finales");

  session = confirmAllPendingSafety(session);
  assert.strictEqual(Engine.isFinished(session), true);
});

test("modo abierto: usar una pista incrementa hints.used y penaliza la categoria Procedimiento", () => {
  var session = Engine.createSession(desktop, "disassembly-open");
  const first = Engine.useHint(session);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.hintsRemaining, 2);
  session = first.session;
  assert.strictEqual(session.hints.used, 1);

  const finished = Engine.finish(session);
  assert.strictEqual(finished.result.breakdown.procedimiento.value, 27); // 30 - 1*3
});

test("useHint respeta el maximo configurado (3 por defecto, item 31)", () => {
  var session = Engine.createSession(desktop, "disassembly-open");
  session = Engine.useHint(session).session;
  session = Engine.useHint(session).session;
  session = Engine.useHint(session).session;
  const fourth = Engine.useHint(session);
  assert.strictEqual(fourth.ok, false);
  assert.strictEqual(fourth.session.hints.used, 3);
});

test("serialize/deserialize conserva el estado y reconstruye la secuencia del equipo", () => {
  var session = Engine.createSession(desktop, "disassembly-guided");
  session = Engine.attemptSafetyStep(session, "safety-power-off").session;
  const packed = Engine.serialize(session);
  assert.strictEqual(packed.sequence, undefined, "no debe persistir la secuencia (son datos estaticos)");

  const restored = Engine.deserialize(desktop, packed);
  assert.strictEqual(restored.stepIndex, 1);
  assert.strictEqual(Engine.currentStep(restored).id, "safety-unplug");
});
