"use strict";
// Mantenimiento termico del portatil (sep-26): polvo + pasta termica + modo
// "Mantenimiento preventivo" del motor.
const test = require("node:test");
const assert = require("node:assert/strict");

const Tools = require("../js/hardware_lab_tools.js");
global.window = global;
global.HardwareLab = global.HardwareLab || {};
global.HardwareLab.Tools = Tools;
const Thermal = require("../js/hardware_lab_thermal.js");
const Engine = require("../js/hardware_lab_engine.js");
const laptop = require("../js/hardware_lab_data_laptop.js").LAPTOP_EQUIPMENT;
const desktop = require("../js/hardware_lab_data_desktop.js").DESKTOP_EQUIPMENT;

const OUT = { coolerInstalled: false, cpuInstalled: true };

function run(state, steps) {
  let s = state;
  const log = [];
  for (const [task, amount] of steps) {
    const r = Thermal.applyTask(s, task, OUT, { amount });
    log.push(r);
    s = r.state;
  }
  return { s, log };
}

test("M01. estados iniciales: equipo usado (polvo + pasta vieja) y piezas nuevas (limpio, sin pasta)", () => {
  assert.deepEqual(Thermal.createThermalState("used"), { dust: "dirty", paste: "old", amount: null, mistakes: 0 });
  assert.deepEqual(Thermal.createThermalState("new"), { dust: "clean", paste: "clean", amount: null, mistakes: 0 });
});

test("M02. procedimiento correcto: brocha -> aire -> retirar grueso -> alcohol -> pasta adecuada", () => {
  const { s, log } = run(Thermal.createThermalState("used"), [["brush"], ["air"], ["scrape"], ["alcohol"], ["apply", "adecuada"]]);
  assert.ok(log.every((r) => r.ok), log.map((r) => r.message).join(" | "));
  assert.deepEqual(s, { dust: "clean", paste: "new", amount: "adecuada", mistakes: 0 });
  assert.equal(Thermal.coolerInstallGate(s).ok, true);
  assert.equal(Thermal.describe(s).pasteReady, true);
});

test("M03. orden incorrecto: explica, no cambia el estado y cuenta el error", () => {
  const used = Thermal.createThermalState("used");
  const air = Thermal.applyTask(used, "air", OUT);
  assert.equal(air.ok, false);
  assert.equal(air.state.dust, "dirty");
  assert.match(air.message, /brocha/);
  const alcohol = Thermal.applyTask(used, "alcohol", OUT);
  assert.equal(alcohol.ok, false);
  assert.equal(alcohol.state.paste, "old");
  assert.match(alcohol.message, /herramienta plástica/);
  const onResidue = Thermal.applyTask({ ...used, paste: "residue" }, "apply", OUT, { amount: "adecuada" });
  assert.equal(onResidue.ok, false);
  assert.equal(onResidue.state.paste, "residue");
  assert.equal(onResidue.state.mistakes, 1);
});

test("M04. cantidades: insuficiente y excesiva bloquean el montaje; se corrigen limpiando y reaplicando", () => {
  for (const bad of ["insuficiente", "excesiva"]) {
    const { s, log } = run(Thermal.createThermalState("new"), [["apply", bad]]);
    assert.equal(log[0].ok, false);
    assert.equal(s.amount, bad);
    const gate = Thermal.coolerInstallGate(s);
    assert.equal(gate.ok, false);
    assert.match(gate.reason, bad === "insuficiente" ? /muy poca/ : /demasiada/);
    const fixed = run(s, [["alcohol"], ["apply", "adecuada"]]);
    assert.ok(fixed.log.every((r) => r.ok));
    assert.equal(Thermal.coolerInstallGate(fixed.s).ok, true);
    assert.equal(fixed.s.mistakes, 1, "el error de dosificacion queda registrado");
  }
});

test("M05. mensajes del bloqueo de montaje segun el estado real de la pasta", () => {
  assert.match(Thermal.coolerInstallGate({ paste: "clean" }).reason, /no tiene pasta/);
  assert.match(Thermal.coolerInstallGate({ paste: "old" }).reason, /restos de la pasta vieja/);
  assert.match(Thermal.coolerInstallGate({ paste: "residue" }).reason, /restos de la pasta vieja/);
});

test("M06. acceso: nada con el modulo montado; la pasta exige el procesador en la placa", () => {
  const used = Thermal.createThermalState("used");
  for (const t of ["brush", "air", "scrape", "alcohol", "apply"]) {
    const r = Thermal.applyTask(used, t, { coolerInstalled: true, cpuInstalled: true }, { amount: "adecuada" });
    assert.equal(r.ok, false);
    assert.match(r.message, /retira el módulo/);
    assert.deepEqual(r.state, used);
  }
  const noCpu = Thermal.applyTask(used, "scrape", { coolerInstalled: false, cpuInstalled: false });
  assert.equal(noCpu.ok, false);
  assert.match(noCpu.message, /procesador/);
  // El polvo del modulo SI se limpia aunque el CPU no este.
  assert.equal(Thermal.applyTask(used, "brush", { coolerInstalled: false, cpuInstalled: false }).ok, true);
});

test("M07. normalize tolera estados guardados corruptos o de versiones previas", () => {
  assert.deepEqual(Thermal.normalize(null), { dust: "dirty", paste: "old", amount: null, mistakes: 0 });
  assert.deepEqual(Thermal.normalize({ dust: "x", paste: "clean", amount: "adecuada", mistakes: -3 }), { dust: "dirty", paste: "clean", amount: null, mistakes: 0 });
});

test("M08. cada tarea usa una herramienta del catalogo con precaucion (herramienta contextual)", () => {
  Object.values(Thermal.TASKS).forEach((t) => {
    const tool = Tools.getTool(t.tool);
    assert.ok(tool && tool.precaution, t.id);
  });
});

test("M09. motor: modo mantenimiento del portatil parte armado, abre hasta el modulo termico y vuelve a cerrar", () => {
  let s = Engine.createSession(laptop, "maintenance-guided");
  assert.equal(s.direction, "maintenance");
  assert.ok(Object.values(s.parts).every(Boolean), "debe partir del equipo armado");
  const actions = [];
  while (!Engine.isFinished(s)) {
    const step = Engine.currentStep(s);
    const r = step.kind === "safety"
      ? Engine.attemptSafetyStep(s, step.id)
      : Engine.attemptAction(laptop, s, { partId: step.partId, action: step.action, toolId: laptop.parts[step.partId].tool || "hands" });
    assert.ok(r.ok, `${step.id || step.partId}: ${r.message}`);
    if (step.kind === "action") actions.push(step.action + ":" + step.partId);
    s = r.session;
  }
  assert.deepEqual(actions, [
    "remove:bottom-cover", "disconnect:cable-battery", "disconnect:cable-cpu-fan-laptop", "remove:cooler",
    "install:cooler", "connect:cable-cpu-fan-laptop", "connect:cable-battery", "install:bottom-cover",
  ]);
  assert.ok(Object.values(s.parts).every(Boolean), "debe terminar armado");
  assert.equal(s.errors, 0);
  // Guardar y restaurar conserva la secuencia de mantenimiento.
  const back = Engine.deserialize(laptop, JSON.parse(JSON.stringify(Engine.serialize(s))));
  assert.equal(back.direction, "maintenance");
  assert.equal(back.sequence.length, s.sequence.length);
});

test("M10. el escritorio no ofrece mantenimiento (el motor lo rechaza de forma explicita)", () => {
  assert.throws(() => Engine.createSession(desktop, "maintenance-guided"), /Modo no soportado/);
});

const Check = require("../js/hardware_lab_equipment_check.js");
const names = Object.fromEntries(Object.entries(laptop.parts).map(([id, p]) => [id, p.name]));
const allIn = Object.fromEntries(Object.keys(laptop.parts).map((id) => [id, true]));

test("M11. comprobacion del equipo: listo solo con piezas, tornillos, pasta adecuada, sin polvo y abierto", () => {
  const good = { dust: "clean", paste: "new", amount: "adecuada", mistakes: 0 };
  const ok = Check.equipmentCheck({ direction: "maintenance", parts: allIn, partNames: names, pendingScrewPart: null, thermal: good, poseOk: true });
  assert.equal(ok.verdict.status, "ok");
  assert.ok(ok.items.every((i) => i.status === "ok"));
  // Cada fallo real cambia el veredicto y se nombra.
  const noCooler = Check.equipmentCheck({ direction: "assembly", parts: { ...allIn, cooler: false }, partNames: names, thermal: good, poseOk: true });
  assert.equal(noCooler.verdict.status, "fail");
  assert.match(noCooler.items[0].detail, /Modulo de refrigeracion/);
  const loose = Check.equipmentCheck({ direction: "assembly", parts: allIn, partNames: names, pendingScrewPart: "keyboard", thermal: good, poseOk: true });
  assert.equal(loose.verdict.status, "fail");
  const dusty = Check.equipmentCheck({ direction: "maintenance", parts: allIn, partNames: names, thermal: { ...good, dust: "loose" }, poseOk: true });
  assert.equal(dusty.verdict.status, "warn");
  const mistakes = Check.equipmentCheck({ direction: "maintenance", parts: allIn, partNames: names, thermal: { ...good, mistakes: 2 }, poseOk: true });
  assert.equal(mistakes.verdict.status, "warn");
  assert.ok(mistakes.items.some((i) => /2 paso/.test(i.detail)));
});

test("M12. comprobacion: sin datos no inventa (escritorio sin termico ni posicion) y el desensamble se juzga distinto", () => {
  const desk = Object.fromEntries(Object.keys(desktop.parts).map((id) => [id, true]));
  const r = Check.equipmentCheck({ direction: "assembly", parts: desk, partNames: {}, pendingScrewPart: null, thermal: null, poseOk: null });
  assert.deepEqual(r.items.map((i) => i.label), ["Piezas y cables", "Tornillos"]);
  const dis = Check.equipmentCheck({ direction: "disassembly", parts: Object.fromEntries(Object.keys(allIn).map((k) => [k, false])), partNames: names, thermal: { paste: "old" } });
  assert.equal(dis.verdict.status, "warn");
  assert.ok(dis.items.some((i) => i.label === "Pasta térmica"));
});
