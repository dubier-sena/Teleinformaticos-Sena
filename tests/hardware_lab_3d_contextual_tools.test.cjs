"use strict";
// Herramienta CONTEXTUAL (auditoria sep-26).
//
// Antes el aprendiz debia elegir una herramienta en el panel "HERRAMIENTAS"
// antes de hacer clic en la pieza, y el motor lo penalizaba ("wrongTool") si no
// coincidia. Ahora el flujo es COMPONENTE -> ACCION: el laboratorio usa la
// herramienta que la pieza requiere y la explica (nombre, uso, precaucion).
// Este test protege que la seleccion manual no vuelva por otra puerta.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const Tools = require("../js/hardware_lab_tools.js");
global.window = global;
global.HardwareLab = global.HardwareLab || {};
global.HardwareLab.Tools = Tools;
const Engine = require("../js/hardware_lab_engine.js");
const laptop = require("../js/hardware_lab_data_laptop.js").LAPTOP_EQUIPMENT;
const desktop = require("../js/hardware_lab_data_desktop.js").DESKTOP_EQUIPMENT;

const UI_FILES = [
  "laboratorio-virtual-hardware.html",
  "css/page_hardware_lab.css",
  "js/hardware_lab_3d_stage.js",
  "js/hardware_lab_3d_controller.js",
  "js/hardware_lab_3d_diagnosis_controller.js",
];

test("T01. no queda panel ni estado de seleccion manual de herramienta en la interfaz", () => {
  const banned = [
    /hwlab-tools-panel/,
    /hwlab-tool-grid/,
    /hwlab-tool-active/,
    /hwlab-tool-btn/,
    /data-tool=/,
    /renderToolGrid/,
    /setActiveTool/,
    /getActiveToolId/,
    /Ninguna seleccionada/,
    /Elige una herramienta/i,
  ];
  const hits = [];
  for (const f of UI_FILES) {
    const src = read(f);
    for (const re of banned) if (re.test(src)) hits.push(`${f}: ${re}`);
  }
  assert.deepEqual(hits, []);
});

test("T02. los controladores pasan la herramienta de la PIEZA al motor y no bloquean por herramienta", () => {
  const ctl = read("js/hardware_lab_3d_controller.js");
  assert.match(ctl, /attemptAction\(equipmentData, session, \{ partId, action, toolId: contextualToolId\(part\) \}\)/);
  const wouldBe = ctl.slice(ctl.indexOf("function actionWouldBeValid"), ctl.indexOf("function onHint"));
  assert.ok(wouldBe.length > 0);
  assert.doesNotMatch(wouldBe, /tool/i, "actionWouldBeValid vuelve a depender de una herramienta elegida");
  const diag = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(diag, /toolId: part\.tool \|\| "hands"/);
});

test("T03. cada herramienta que usa una pieza tiene nombre, uso y precaucion para el panel contextual", () => {
  const used = new Set();
  for (const eq of [laptop, desktop]) Object.values(eq.parts).forEach((p) => used.add(p.tool || "hands"));
  for (const id of used) {
    const t = Tools.getTool(id);
    assert.ok(t, `herramienta desconocida: ${id}`);
    assert.ok(t.name && t.description && t.precaution, `${id}: falta nombre/uso/precaucion`);
  }
});

function runWithContextualTools(equipment, mode) {
  let s = Engine.createSession(equipment, mode, { maxHints: 3 });
  for (let guard = 0; guard < 400 && !Engine.isFinished(s); guard++) {
    const step = Engine.currentStep(s);
    if (!step) break;
    if (step.kind === "safety") {
      s = Engine.attemptSafetyStep(s, step.id).session;
      continue;
    }
    const part = equipment.parts[step.partId];
    const r = Engine.attemptAction(equipment, s, { partId: step.partId, action: step.action, toolId: part.tool || "hands" });
    assert.ok(r.ok, `${step.partId}/${step.action}: ${r.message}`);
    s = r.session;
  }
  return s;
}

test("T04. recorrido guiado completo con herramienta contextual: 0 errores de herramienta y 20/20 en esa categoria", () => {
  for (const eq of [laptop, desktop]) {
    for (const mode of ["disassembly-guided", "assembly-guided"]) {
      const s = runWithContextualTools(eq, mode);
      assert.ok(Engine.isFinished(s), `${eq.id} ${mode}: no termino`);
      assert.equal(s.errorsByType.wrongTool || 0, 0);
      const b = Engine.computeScoreBreakdown(s);
      assert.equal(b.herramientas.value, b.herramientas.max);
    }
  }
});
