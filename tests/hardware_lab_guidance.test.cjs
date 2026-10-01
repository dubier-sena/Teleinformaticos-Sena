// Fase D (2026-10-01) — orientacion al aprendiz del laboratorio 3D.
// Botones de seguridad contextuales, "Ayuda" (¿que debo hacer?) gratuita que
// nunca revela la pieza en los modos sin guia, contenido REAL de la pista
// (antes se cobraba y el aviso salia vacio) y fase actual del diagnostico.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const G = require("../js/hardware_lab_guidance.js");
const Laptop = require("../js/hardware_lab_data_laptop.js");
const Engine = require("../js/hardware_lab_engine.js");

const laptop = Laptop.LAPTOP_EQUIPMENT;
const safetySteps = () => {
  const out = new Map();
  Object.values(laptop.sequences).forEach((seq) => seq.forEach((s) => { if (s.kind === "safety") out.set(s.id, s); }));
  return Array.from(out.values());
};

test("GD-1 cada paso de seguridad del portatil tiene un boton que dice QUE se confirma", () => {
  const steps = safetySteps();
  assert.ok(steps.length >= 7);
  const labels = steps.map((s) => G.safetyConfirmLabel(s));
  assert.strictEqual(new Set(labels).size, labels.length, "etiquetas distintas");
  labels.forEach((l) => { assert.notStrictEqual(l, "Confirmar paso"); assert.match(l, /^Ya /); });
});

test("GD-2 sin etiqueta propia (escritorio) el boton se deriva del titulo", () => {
  assert.strictEqual(G.safetyConfirmLabel({ title: "Apagar el equipo" }), "Hecho: apagar el equipo");
  assert.strictEqual(G.safetyConfirmLabel({}), "Confirmar paso");
});

test("GD-3 Ayuda en un paso de seguridad: nombra el boton y aclara que no se toca el equipo", () => {
  const t = G.whatToDo({ mode: "guided", safety: { title: "Desconectar el cargador", confirmLabel: "Ya desconecté el cargador" } });
  assert.match(t, /«Desconectar el cargador»/);
  assert.match(t, /«Ya desconecté el cargador»/);
  assert.match(t, /No hay que tocar el equipo/);
});

test("GD-4 Ayuda en el guiado: posicion, tornillos pendientes y pieza", () => {
  const target = { partName: "Tapa inferior", verb: "retirar", screws: 5, tool: "Destornillador Phillips" };
  assert.match(G.whatToDo({ mode: "guided", target, pose: { label: "Preparar para tapa inferior" } }), /^Primero pulsa «Preparar para tapa inferior»/);
  assert.match(G.whatToDo({ mode: "guided", target }), /^Toca cada tornillo marcado con un aro en Tapa inferior \(quedan 5\)/);
  assert.match(G.whatToDo({ mode: "guided", target: Object.assign({}, target, { screws: 1 }) }), /\(queda 1\)/);
  assert.match(G.whatToDo({ mode: "guided", target: Object.assign({}, target, { screws: 0 }) }), /^Toca Tapa inferior en el equipo para retirar esa pieza \(herramienta: Destornillador Phillips\)/);
  assert.match(G.whatToDo({ mode: "guided", pendingInstall: { partName: "Placa base", n: 3 }, target }), /^Asegura Placa base: toca cada tornillo marcado con un aro para colocarlo \(faltan 3\)/);
  assert.match(G.whatToDo({ mode: "guided", thermalRequired: true, target }), /mantenimiento de la refrigeración/);
});

test("GD-5 Ayuda en practica libre y evaluacion: explica como actuar y NUNCA nombra una pieza", () => {
  const names = Object.values(laptop.parts).map((p) => p.name);
  for (const hintsLeft of [3, 0]) {
    const t = G.whatToDo({ mode: "open", hintsLeft, target: { partName: "Tapa inferior", verb: "retirar", screws: 5 } });
    names.forEach((n) => assert.ok(!t.includes(n), "revela " + n));
    assert.match(t, /^Decide tú qué pieza sigue/);
    if (hintsLeft) assert.match(t, /resta 3 puntos/); else assert.match(t, /Aquí no hay pistas/);
  }
});

test("GD-6 la pista de las practicas tiene contenido (antes: aviso vacio con coste)", () => {
  const t = G.practiceHint({ mode: "open", target: { partName: "Batería", verb: "retirar", where: "Parte inferior, zona central.", tool: "Destornillador Phillips", screws: 2, missing: ["Cable de la batería"] } });
  assert.match(t, /^Pista: lo que sigue es retirar Batería\./);
  assert.match(t, /Ubicación: Parte inferior, zona central\./);
  assert.match(t, /Antes hay que retirar o desconectar: Cable de la batería\./);
  assert.match(t, /2 tornillos pendientes/);
  assert.match(t, /Herramienta: Destornillador Phillips\./);
  assert.match(G.practiceHint({ safety: { confirmLabel: "Ya apagué el equipo" } }), /«Ya apagué el equipo»/);
  assert.ok(G.practiceHint({}).length > 20);
  // El motor sigue sin devolver texto: lo construye el controlador.
  const s = Engine.createSession(laptop, "disassembly-guided");
  const r = Engine.useHint(s);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.message, undefined);
  const ctl = read("js/hardware_lab_3d_controller.js");
  assert.match(ctl, /message = Guidance\(\)\.practiceHint\(\{ mode: session\.kind, safety, target \}\);/);
});

test("GD-7 la pista no cambia de coste: el calculo de la nota del motor no se toco", () => {
  const engine = read("js/hardware_lab_engine.js");
  assert.match(engine, /CATEGORY_MAX\.procedimiento - \(e\.blocked \|\| 0\) \* 3 - session\.hints\.used \* 3/);
});

test("GD-8 fases del diagnostico: observar -> diagnosticar -> reparar -> comprobar", () => {
  assert.strictEqual(G.diagnosisPhase({ checks: 0, actions: 0, actionsSinceCheck: 0 }).id, "observar");
  assert.strictEqual(G.diagnosisPhase({ checks: 1, actions: 0, actionsSinceCheck: 0 }).id, "diagnosticar");
  assert.strictEqual(G.diagnosisPhase({ checks: 1, actions: 3, actionsSinceCheck: 3 }).id, "comprobar");
  assert.strictEqual(G.diagnosisPhase({ checks: 2, actions: 3, actionsSinceCheck: 0 }).id, "reparar");
  // Abrir el equipo sin haber encendido tambien es trabajar: toca comprobar.
  assert.strictEqual(G.diagnosisPhase({ checks: 0, actions: 2, actionsSinceCheck: 2 }).id, "comprobar");
  const done = G.diagnosisPhase({ checks: 2, actions: 3, actionsSinceCheck: 0, fixed: true });
  assert.strictEqual(done.id, "comprobar");
  assert.match(done.text, /corregida/);
  assert.deepStrictEqual(done.phases.map((p) => p.label), ["Observar", "Diagnosticar", "Reparar", "Comprobar"]);
  assert.match(G.whatToDoDiagnosis({ checks: 0, actions: 0 }), /^Fase 1 de 4 · Observar: /);
  assert.match(G.whatToDoDiagnosis({ checks: 1, actions: 0 }), /tócala en el equipo/);
  assert.match(G.whatToDoDiagnosis({ checks: 1, actions: 0, pose: { label: "Preparar para X" } }), /^Pulsa «Preparar para X»/);
});

test("GD-9 la pagina carga el modulo y ofrece el boton Ayuda, visible tambien en la banda compacta", () => {
  const html = read("laboratorio-virtual-hardware.html");
  assert.match(html, /<script defer src="js\/hardware_lab_guidance\.js\?v=\d{8}_\d+"><\/script>/);
  assert.ok(html.indexOf("hardware_lab_guidance.js") < html.indexOf("hardware_lab_3d_bootstrap.js"));
  assert.match(html, /class="hwlab-card__help" id="hwlab-help-btn" aria-label="¿Qué debo hacer\? Ayuda del paso actual" hidden>Ayuda<\/button>/);
  const css = read("css/page_hardware_lab.css");
  assert.doesNotMatch(css, /\[data-auto-compact="true"\][^{]*\.hwlab-card__help[^{]*\{[^}]*display: none/);
  assert.match(css, /@media \(hover: none\) \{\s*\.hwlab-dock \[data-tip\]:hover::after,\s*\.hwlab-card \[data-tip\]:hover::after \{ display: none; \}/);
  assert.match(css, /#hwlab-safety-confirm-btn,\s*\.hwlab-card__body #hwlab-prepare-btn,[^{]*#hwlab-power-check-btn \{\s*position: sticky;/);
  const stage = read("js/hardware_lab_3d_stage.js");
  assert.match(stage, /function setHelpHandler\(fn\)/);
  assert.match(stage, /function pointAtPart\(partId\)/);
  const diag = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(diag, /stage\.setHelpHandler\(onHelp\);/);
  assert.match(diag, /data-pending-text="Fase \$\{phase\.index \+ 1\} de \$\{phase\.phases\.length\} · \$\{esc\(phase\.label\)\}"/);
});
