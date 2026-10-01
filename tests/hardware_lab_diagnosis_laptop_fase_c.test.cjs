"use strict";
// Diagnostico del portatil, Fase C (sep-27): laptop-case-06 (Wi-Fi) y
// laptop-case-07 (sobrecalentamiento), cada uno con varias causas reales.
// Motor, casos y sistema termico REALES (el mismo hardware_lab_thermal.js del
// mantenimiento) en un sandbox: la reparacion sale del estado de las piezas o
// del sistema termico, nunca de una bandera "falla = false".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function loadLab() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  ["hardware_lab_tools.js", "hardware_lab_data_desktop.js", "hardware_lab_data_laptop.js", "hardware_lab_engine.js", "hardware_lab_thermal.js", "hardware_lab_diagnosis_engine.js", "hardware_lab_diagnosis_cases.js"].forEach((f) =>
    vm.runInContext(read("js/" + f), sandbox, { filename: f })
  );
  return sandbox.window;
}
const H = loadLab().HardwareLab;
const Diag = H.DiagnosisEngine;
const Thermal = H.Thermal;
const LAPTOP = H.DataLaptop.LAPTOP_EQUIPMENT;
const Cases = H.DiagnosisCases;
const WIFI = Cases.getCase("laptop", "laptop-case-06");
const HEAT = Cases.getCase("laptop", "laptop-case-07");
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

/** Sesion con la variante pedida (rng determinista sobre el faultPool). */
function sessionFor(caseDef, variantId) {
  const i = caseDef.faultPool.findIndex((f) => f.variantId === variantId);
  assert.ok(i >= 0, variantId);
  const s = Diag.createDiagnosisSession(LAPTOP, caseDef, { rng: () => (i + 0.5) / caseDef.faultPool.length });
  assert.equal(s.variantId, variantId);
  return s;
}
function act(s, partId, action) {
  const part = Diag.getPart(LAPTOP, partId);
  return Diag.attemptAction(LAPTOP, s, { partId, action, toolId: part.tool || "hands" });
}
function must(r, what) {
  assert.equal(r.ok, true, what + ": " + r.message);
  return r.session;
}
const off = (id) => (Diag.getPart(LAPTOP, id).kind === "cable" ? "disconnect" : "remove");
const on = (id) => (Diag.getPart(LAPTOP, id).kind === "cable" ? "connect" : "install");
/** Retira y vuelve a poner una lista de piezas (en orden inverso al volver). */
function reseat(s, ids) {
  ids.forEach((id) => (s = must(act(s, id, off(id)), "retirar " + id)));
  ids.slice().reverse().forEach((id) => (s = must(act(s, id, on(id)), "poner " + id)));
  return s;
}
function openSafe(s) {
  s = must(act(s, "bottom-cover", "remove"), "tapa");
  return must(act(s, "cable-battery", "disconnect"), "bateria");
}
function closeUp(s) {
  s = must(act(s, "cable-battery", "connect"), "bateria");
  return must(act(s, "bottom-cover", "install"), "tapa");
}
const check = (s, secured) => Diag.checkPowerOn(LAPTOP, s, { screwsSecured: secured !== false });
function task(s, id, amount) {
  return Diag.applyThermalTask(LAPTOP, s, id, { amount });
}

// Lo que el aprendiz ve ANTES de terminar: nombre, sintomas, observaciones.
function visibleBeforeFinish(c) {
  const obs = (c.observations.broken || []).map((o) => o.label + " " + o.value).join(" ");
  return [c.name, c.symptom, obs].concat(c.faultPool.map((f) => f.symptomBroken)).join(" \n ");
}

// ── Wi-Fi ───────────────────────────────────────────────────────────────────
const WIFI_VARIANTS = {
  // variante: [lo que hay que reasentar para llegar y corregir, texto del repaso]
  "wifi-card": [["wifi-antenna-1", "wifi-antenna-2", "wifi-card"], /tarjeta Wi-Fi/],
  "wifi-antenna-1": [["wifi-antenna-1"], /antena principal/],
  "wifi-antenna-2": [["wifi-antenna-2"], /antena auxiliar/],
};

test("C00. caso 06 y 07: IDs, variantes declaradas y mismo sintoma para todas las variantes", () => {
  same(WIFI.faultPool.map((f) => f.variantId), ["wifi-card", "wifi-antenna-1", "wifi-antenna-2"]);
  same(HEAT.faultPool.map((f) => f.variantId), ["dust", "paste", "fan-cable"]);
  [WIFI, HEAT].forEach((c) => {
    assert.equal(c.equipmentId, "laptop");
    assert.equal(new Set(c.faultPool.map((f) => f.symptomBroken)).size, 1, c.id + ": el sintoma no delata la variante");
    assert.equal(new Set(c.faultPool.map((f) => JSON.stringify(f.relevantPartIds))).size, 1, c.id + ": la puntuacion no delata la variante");
    assert.equal(c.hints.length, 3);
  });
  // Variantes "mal asentadas": la pieza queda EN SU SITIO (no en la bandeja).
  WIFI.faultPool.concat(HEAT.faultPool).forEach((f) => (f.overrides || []).forEach((o) => assert.equal(o.present, true, f.variantId)));
});

test("C01. nada visible antes del repaso revela la pieza o la variante", () => {
  assert.doesNotMatch(visibleBeforeFinish(WIFI), /tarjeta|antena|u\.fl|principal|auxiliar|asentad|desconect|suelt/i);
  assert.doesNotMatch(visibleBeforeFinish(HEAT), /polvo|pasta|ventilador|conector|aletas|disipador|seca/i);
});

for (const [variant, [path_, reveal]] of Object.entries(WIFI_VARIANTS)) {
  test(`W. caso 06 / ${variant}: sintoma, falsas reparaciones, correccion real, equipo listo, repaso y reinicio`, () => {
    // 1. El estado inicial reproduce el sintoma (todo presente: nada en la bandeja).
    let s = sessionFor(WIFI, variant);
    assert.ok(Object.values(s.parts).every((v) => v === true));
    let r = check(s);
    assert.equal(r.outcome, "fault");
    assert.equal(r.message, WIFI.faultPool[0].symptomBroken);
    s = openSafe(r.session);
    // 2. Tocar otras piezas NO resuelve.
    s = reseat(s, ["ram"]);
    s = reseat(s, ["ssd-m2"]);
    s = reseat(s, ["cable-screen-flex"]);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, "RAM/SSD/eDP no reparan la Wi-Fi");
    // 3. Corregir la causa real: FAULT_FIXED.
    s = reseat(s, path_);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), true);
    // 4. Bateria desconectada: no aprueba.
    r = check(s);
    assert.equal(r.outcome, "not-ready");
    assert.equal(r.message, Diag.NOT_READY_MESSAGE);
    s = must(act(r.session, "cable-battery", "connect"), "bateria");
    // 5. Tapa retirada: no aprueba.
    r = check(s);
    assert.equal(r.outcome, "not-ready");
    s = must(act(r.session, "bottom-cover", "install"), "tapa");
    // Tornillos sueltos: no aprueba.
    assert.equal(check(s, false).outcome, "not-ready");
    // 6. Armado: aprueba.
    r = check(s);
    assert.equal(r.fixed, true, r.message);
    assert.equal(r.message, WIFI.faultPool[0].symptomFixed);
    const fin = Diag.finish(r.session);
    assert.equal(fin.result.status, "APROBADO");
    // 10. El repaso de ESTA variante identifica la causa.
    const variantDef = WIFI.faultPool.find((f) => f.variantId === variant);
    assert.match(variantDef.explanation.whatWasHappening, reveal);
    // 11. Reiniciar restaura la falla (sesion nueva desde el caso).
    const again = sessionFor(WIFI, variant);
    assert.equal(check(again).outcome, "fault");
    assert.equal(again.actionLog.length, 0);
    assert.equal(again.hints.used, 0);
    assert.equal(again.errors, 0);
  });
}

test("W7-9. pistas del caso 06: 1 y 2 no identifican la variante; la 3 lleva a tarjeta y antenas", () => {
  const specific = /tarjeta wi-?fi|antena|u\.fl|principal|auxiliar|asentad|desconect/i;
  assert.doesNotMatch(WIFI.hints[0], specific);
  assert.doesNotMatch(WIFI.hints[1], specific);
  assert.match(WIFI.hints[2], /tarjeta Wi-Fi/);
  assert.match(WIFI.hints[2], /antena/);
  let s = sessionFor(WIFI, "wifi-antenna-2");
  WIFI.hints.forEach((h) => {
    const r = Diag.useHint(s, WIFI);
    assert.equal(r.message, h);
    s = r.session;
  });
  assert.equal(Diag.useHint(s, WIFI).ok, false);
});

test("W11. seguridad: manipular tarjeta o antenas con la bateria conectada es inseguro y se registra", () => {
  let s = must(act(sessionFor(WIFI, "wifi-antenna-1"), "bottom-cover", "remove"), "tapa");
  ["wifi-antenna-1", "wifi-antenna-2", "wifi-card"].forEach((id, i) => {
    const r = act(s, id, off(id));
    assert.equal(r.ok, false);
    assert.match(r.message, /desconecta primero la batería/);
    s = r.session;
    assert.equal(s.errorsByType.unsafe, i + 1);
  });
  // Herramientas reales: pinzas para las antenas, Phillips para la tarjeta.
  assert.equal(Diag.getPart(LAPTOP, "wifi-antenna-1").tool, "tweezers");
  assert.equal(Diag.getPart(LAPTOP, "wifi-card").tool, "phillips");
  const wrong = Diag.attemptAction(LAPTOP, must(act(s, "cable-battery", "disconnect"), "bat"), { partId: "wifi-antenna-1", action: "disconnect", toolId: "phillips" });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.session.errorsByType.wrongTool, 1);
});

test("W12. la pantalla completa exige desconectar las antenas: por eso NO es una reparacion 'falsa' de la antena", () => {
  // Documenta el acoplamiento fisico real: para retirar el conjunto de
  // pantalla hay que desconectar ambas antenas; al volver a conectarlas la
  // conexion queda bien hecha (es la accion real que repara), pero reasentar
  // la pantalla NO repara una tarjeta mal asentada.
  same(Diag.getPart(LAPTOP, "screen-assembly").removeRequires.filter((id) => /antenna/.test(id)), ["wifi-antenna-1", "wifi-antenna-2"]);
  let s = openSafe(sessionFor(WIFI, "wifi-card"));
  s = reseat(s, ["cable-screen-flex", "wifi-antenna-1", "wifi-antenna-2", "screen-assembly"]);
  assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, "la pantalla no repara la tarjeta");
  // Sin tocar la tarjeta ni las antenas, la pantalla no se puede retirar.
  const direct = act(openSafe(sessionFor(WIFI, "wifi-antenna-1")), "screen-assembly", "remove");
  assert.equal(direct.ok, false);
});

// ── Sobrecalentamiento ─────────────────────────────────────────────────────
function coolerOut(s) {
  s = must(act(s, "cable-cpu-fan-laptop", "disconnect"), "ventilador");
  return must(act(s, "cooler", "remove"), "modulo");
}
function coolerIn(s) {
  s = must(act(s, "cooler", "install"), "modulo");
  return must(act(s, "cable-cpu-fan-laptop", "connect"), "ventilador");
}
function doTasks(s, list) {
  list.forEach(([id, amount]) => {
    const r = task(s, id, amount);
    assert.equal(r.ok, true, id + ": " + r.message);
    s = r.session;
  });
  return s;
}
const THERMAL_FIX = {
  dust: [["brush"], ["air"]],
  paste: [["scrape"], ["alcohol"], ["apply", "adecuada"]],
  "fan-cable": [],
};

test("T00. el diagnostico usa el MISMO sistema termico del mantenimiento (sin copia)", () => {
  const eng = read("js/hardware_lab_diagnosis_engine.js");
  assert.match(eng, /getThermal\(\)\.applyTask\(/);
  assert.match(eng, /getThermal\(\)\.coolerInstallGate\(/);
  assert.match(eng, /getThermal\(\)\.isReady\(/);
  assert.doesNotMatch(eng, /dust\s*===\s*"dirty"|paste\s*===\s*"old"/, "sin reglas termicas propias en el motor de diagnostico");
  // isReady = polvo limpio + la misma regla de pasta que coolerInstallGate.
  assert.equal(Thermal.isReady(Thermal.createThermalState("serviced")), true);
  assert.equal(Thermal.isReady(Thermal.createThermalState("used")), false);
  assert.equal(Thermal.isReady({ dust: "clean", paste: "new", amount: "excesiva" }), false);
  // El mantenimiento conserva sus estados de partida.
  same(Thermal.createThermalState("used"), { dust: "dirty", paste: "old", amount: null, mistakes: 0 });
  same(Thermal.createThermalState("new"), { dust: "clean", paste: "clean", amount: null, mistakes: 0 });
});

for (const variant of ["dust", "paste", "fan-cable"]) {
  test(`T. caso 07 / ${variant}: estado inicial, falsas reparaciones, procedimiento real, equipo listo y reinicio`, () => {
    let s = sessionFor(HEAT, variant);
    // 1. Estado termico inicial (incorrecto solo en la variante termica).
    if (variant === "dust") same(s.thermal, { dust: "dirty", paste: "new", amount: "adecuada", mistakes: 0 });
    if (variant === "paste") same(s.thermal, { dust: "clean", paste: "old", amount: null, mistakes: 0 });
    if (variant === "fan-cable") assert.equal(Thermal.isReady(s.thermal), true);
    // 2. Sintoma.
    let r = check(s);
    assert.equal(r.outcome, "fault");
    assert.equal(r.message, HEAT.faultPool[0].symptomBroken);
    s = openSafe(r.session);
    // 3. Acciones no relacionadas no resuelven.
    s = reseat(s, ["ram"]);
    s = reseat(s, ["ssd-m2"]);
    s = reseat(s, ["wifi-antenna-1", "wifi-antenna-2", "wifi-card"]);
    s = reseat(s, ["cable-keyboard-flex", "keyboard"]);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, "RAM/SSD/Wi-Fi/teclado no arreglan la temperatura");
    // 4. Procedimiento termico correcto.
    s = coolerOut(s);
    if (variant === "paste") {
      // 5. coolerInstallGate: sin pasta nueva adecuada no se monta (explica, no castiga).
      s = doTasks(s, [["scrape"]]);
      const blocked = act(s, "cooler", "install");
      assert.equal(blocked.ok, false);
      assert.equal(blocked.blockedByThermal, true);
      assert.equal(blocked.session.errors, s.errors, "el bloqueo por pasta no penaliza");
      s = doTasks(s, [["alcohol"], ["apply", "adecuada"]]);
    } else {
      s = doTasks(s, THERMAL_FIX[variant]);
    }
    s = coolerIn(s);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), true);
    // 6. Bateria desconectada: no aprueba.
    assert.equal(check(s).outcome, "not-ready");
    s = must(act(s, "cable-battery", "connect"), "bateria");
    // 7. Equipo abierto: no aprueba.
    assert.equal(check(s).outcome, "not-ready");
    s = must(act(s, "bottom-cover", "install"), "tapa");
    // 8. Cerrado correctamente: aprueba.
    r = check(s);
    assert.equal(r.fixed, true, r.message);
    assert.equal(Diag.finish(r.session).result.status, "APROBADO");
    // 9. Reinicio: polvo/pasta/conexion vuelven al estado de la falla.
    const again = sessionFor(HEAT, variant);
    same(again.thermal, sessionFor(HEAT, variant).thermal);
    assert.equal(check(again).outcome, "fault");
  });
}

test("T32. limpiar/cambiar pasta NO repara el conector del ventilador; reconectar el ventilador NO limpia el polvo", () => {
  // Variante ventilador: el modulo fuera + limpieza + montarlo SIN reconectar el ventilador.
  let s = coolerOut(openSafe(sessionFor(HEAT, "fan-cable")));
  s = doTasks(s, []);
  assert.equal(task(s, "brush").ok, false, "no hay polvo que limpiar");
  s = must(act(s, "cooler", "install"), "modulo");
  assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, "sin reconectar el ventilador sigue la falla");
  s = must(act(s, "cable-cpu-fan-laptop", "connect"), "ventilador");
  assert.equal(Diag.isFixConditionMet(LAPTOP, s), true, "reconectar el ventilador es la reparacion");
  // Variante polvo: solo reasentar el ventilador no alcanza.
  let d = openSafe(sessionFor(HEAT, "dust"));
  d = reseat(d, ["cable-cpu-fan-laptop"]);
  assert.equal(Diag.isFixConditionMet(LAPTOP, d), false);
  // Variante pasta: limpiar el polvo (ya limpio) no alcanza; pasta mal dosificada tampoco.
  let p = coolerOut(openSafe(sessionFor(HEAT, "paste")));
  p = doTasks(p, [["scrape"], ["alcohol"]]);
  const mucha = task(p, "apply", "excesiva");
  assert.equal(mucha.ok, false);
  assert.equal(Diag.isFixConditionMet(LAPTOP, mucha.session), false);
  assert.equal(act(mucha.session, "cooler", "install").blockedByThermal, true);
});

test("T-P. puntuacion: orden termico incorrecto y trabajo energizado restan en Procedimiento; tareas innecesarias solo informan", () => {
  let s = coolerOut(openSafe(sessionFor(HEAT, "dust")));
  const aire = task(s, "air");
  assert.equal(aire.ok, false);
  assert.equal(aire.level, "error");
  assert.equal(aire.session.errorsByType.thermal, 1, "aire antes de la brocha: error de procedimiento");
  s = aire.session;
  const nada = task(s, "alcohol");
  assert.equal(nada.level, "info", "pasta ya correcta: solo informa");
  assert.equal(nada.session.errors, s.errors);
  // Con la bateria reconectada y el modulo fuera: inseguro.
  const bat = must(act(s, "cable-battery", "connect"), "bateria");
  const unsafe = task(bat, "brush");
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.session.errorsByType.unsafe, 1);
  assert.equal(unsafe.session.thermal.dust, "dirty", "no cambia el estado");
  s = must(act(unsafe.session, "cable-battery", "disconnect"), "bateria");
  s = closeUp(coolerIn(doTasks(s, [["brush"], ["air"]])));
  const r = check(s);
  assert.equal(r.fixed, true);
  const b = Diag.finish(r.session).result.breakdown;
  assert.equal(b.procedimiento.value, 25 - 3 - 3, "−3 orden termico, −3 inseguro");
  // Porcentajes sin cambios.
  same([b.diagnostico.max, b.procedimiento.max, b.reparacion.max, b.herramientas.max, b.eficiencia.max], [30, 25, 25, 10, 10]);
});

test("T-H. pistas del caso 07: 1 y 2 orientan al subsistema sin nombrar la causa; la 3 enumera lo que se revisa", () => {
  const specific = /polvo|pasta|ventilador|conector|aletas|disipador/i;
  assert.doesNotMatch(HEAT.hints[0], specific);
  assert.doesNotMatch(HEAT.hints[1], specific);
  assert.match(HEAT.hints[2], /ventilador/);
  assert.match(HEAT.hints[2], /polvo/);
  assert.match(HEAT.hints[2], /pasta/);
});

test("R. repasos 06 y 07: cada variante explica su causa; el caso aporta diagnostico, funcionamiento y prevencion", () => {
  const reveal = { "wifi-card": /tarjeta Wi-Fi/, "wifi-antenna-1": /principal/, "wifi-antenna-2": /auxiliar/, dust: /polvo/, paste: /pasta/, "fan-cable": /ventilador/ };
  [WIFI, HEAT].forEach((c) => {
    ["howToDiagnose", "background", "prevention"].forEach((k) => assert.ok(c.explanation[k] && c.explanation[k].length > 40, c.id + " " + k));
    c.faultPool.forEach((f) => {
      ["whatWasHappening", "why", "howToFix", "optimalProcedure"].forEach((k) => assert.ok(f.explanation[k] && f.explanation[k].length > 30, f.variantId + " " + k));
      assert.match(f.explanation.whatWasHappening, reveal[f.variantId]);
    });
  });
  assert.match(WIFI.explanation.background, /antenas/);
  assert.match(WIFI.explanation.background, /tarjeta Wi-Fi/);
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /Object\.assign\(\{\}, caseDef\.explanation, variant && variant\.explanation\)/);
});

test("Z. equipo desarmado (el defecto de la Fase A) en 06 y 07: pieza esencial fuera NO aprueba", () => {
  let s = openSafe(sessionFor(WIFI, "wifi-antenna-2"));
  s = reseat(s, ["wifi-antenna-2"]);
  s = must(act(s, "ram", "remove"), "RAM fuera");
  s = closeUp(s);
  assert.equal(check(s).outcome, "not-ready");
  let t = coolerOut(openSafe(sessionFor(HEAT, "dust")));
  t = doTasks(t, THERMAL_FIX.dust);
  t = must(act(t, "cooler", "install"), "modulo sin ventilador");
  t = closeUp(t);
  const r = check(t);
  assert.equal(r.fixed, false, "con el ventilador desconectado no aprueba");
  assert.equal(r.outcome, "not-ready", "limpio, pero con una conexion esencial sin hacer");
});

test("V. variante estable: reiniciar elige de nuevo y la sesion guarda la variante (serializada)", () => {
  const seen = new Set();
  const seq = [0.1, 0.5, 0.9];
  seq.forEach((x) => seen.add(Diag.createDiagnosisSession(LAPTOP, WIFI, { rng: () => x }).variantId));
  assert.equal(seen.size, 3);
  const s = sessionFor(HEAT, "paste");
  const back = Diag.deserialize(JSON.parse(JSON.stringify(Diag.serialize(s))));
  assert.equal(back.variantId, "paste");
  same(back.thermal, s.thermal);
  // Casos sin variantes (01-05): sin variante y refrigeracion en buen estado.
  const base = Diag.createDiagnosisSession(LAPTOP, Cases.getCase("laptop", "laptop-case-01"));
  assert.equal(base.variantId, null);
  assert.equal(Thermal.isReady(base.thermal), true);
  // El escritorio no tiene sistema termico en el diagnostico.
  assert.equal(Diag.createDiagnosisSession(H.DataDesktop.DESKTOP_EQUIPMENT, Cases.getCase("desktop", "caso-01")).thermal, null);
});

test("UI. la interfaz no revela la variante, no encuadra la falla y la tarjeta del portatil sigue bloqueada", () => {
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  const mech = read("js/hardware_lab_3d_diagnosis_mechanics.js");
  const boot = read("js/hardware_lab_3d_bootstrap.js");
  assert.doesNotMatch(ctl + mech, /esc\([^)]*variantId|textContent[^;]*variantId|pushActionLog\([^)]*variantId|showFeedback\([^)]*variantId/, "la variante no se pinta en la UI");
  // La variante la resuelve el motor (variantOf) y el controlador solo la usa
  // para el repaso final; el controlador no toca variantId directamente.
  assert.equal((ctl.match(/variantId/g) || []).length, 0, "el controlador no lee ni pinta variantId");
  assert.match(ctl, /return s \? Engine\(\)\.variantOf\(caseDef, s\) : null;/);
  assert.doesNotMatch(mech, /variantId/);
  assert.match(ctl, /variantOf\(session\)/, "solo el repaso usa la variante");
  assert.doesNotMatch(ctl + mech, /setFramingPolicy|focusOnPart\(\s*(fix|session)/);
  assert.match(mech, /no se filtran por el estado/);
  assert.match(boot, /available: equipmentId === "desktop" \|\| equipmentId === "laptop",/);
  assert.doesNotMatch(boot, /Próximamente para portátil/);
});

// ── Matriz automatica (casos 01-07, todas las variantes) ─────────────────────
// Para cada pieza del portatil: reasentarla (con lo que fisicamente exige
// retirar antes) y comprobar la condicion de la falla. Solo repara si ese
// camino pasa por la pieza de la falla; nada repara una falla termica de
// polvo o pasta. Asi se ve que 06/07 no alteraron 01-05 y que ninguna
// reparacion "cruzada" es accidental.
function reseatPath(id, seen) {
  seen = seen || new Set();
  if (seen.has(id)) return [];
  seen.add(id);
  const reqs = (Diag.getPart(LAPTOP, id).removeRequires || []).filter((r) => r !== "cable-battery");
  return reqs.flatMap((r) => reseatPath(r, seen)).concat([id]);
}
const CANDIDATES = Object.keys(LAPTOP.parts).filter((id) => id !== "bottom-cover" && id !== "cable-battery");

test("M. matriz: cada falla de 01-07 solo se repara por el camino fisico que pasa por su pieza", () => {
  let checked = 0;
  // Casos 01-08: una sola condicion por intento. Los 09-11 (averias y fallas
  // dobles) tienen su propia matriz en hardware_lab_diagnosis_faults.test.cjs.
  Cases.casesFor("laptop").filter((c) => c.number <= 8).forEach((c) => {
    (c.faultPool || [c.fault]).forEach((f, idx) => {
      CANDIDATES.forEach((cand) => {
        const pathIds = reseatPath(cand);
        let s = c.faultPool
          ? Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (idx + 0.5) / c.faultPool.length })
          : Diag.createDiagnosisSession(LAPTOP, c);
        s = openSafe(s);
        // Pasta vieja: el modulo no se vuelve a montar sin pasta nueva (regla del
        // mantenimiento). Es un bloqueo correcto, no una reparacion.
        if (pathIds.includes("cooler") && !Thermal.coolerInstallGate(s.thermal).ok) {
          pathIds.forEach((id) => (s = must(act(s, id, off(id)), "retirar " + id)));
          const back = pathIds.slice().reverse();
          back.slice(0, back.indexOf("cooler")).forEach((id) => (s = must(act(s, id, on(id)), "poner " + id)));
          const blocked = act(s, "cooler", "install");
          assert.equal(blocked.blockedByThermal, true, c.id + " " + cand);
          checked++;
          return;
        }
        s = reseat(s, pathIds);
        const expected = f.fixCondition.type === "reseated" && pathIds.includes(f.fixCondition.partId);
        assert.equal(Diag.isFixConditionMet(LAPTOP, s), expected, `${c.id}/${f.variantId || "-"} reasentando ${cand} (${pathIds.join(">")})`);
        s = closeUp(s);
        const r = check(s);
        assert.equal(r.fixed, expected, `${c.id}/${f.variantId || "-"} ${cand}: comprobacion final`);
        checked++;
      });
    });
  });
  assert.ok(checked >= 11 * CANDIDATES.length);
});

test("AB-fix. tarjeta del diagnostico: se abre al empezar un caso y cuando APARECE 'Preparar' (antes quedaba oculto)", () => {
  // Defecto de la Fase A+B hallado con clic real (1024x625, caso 01 -> 02):
  // el resumen del diagnostico es el sintoma y no cambia, asi que la regla
  // "se abre en un paso nuevo" nunca volvia a abrir la tarjeta contraida.
  const stage = read("js/hardware_lab_3d_stage.js");
  assert.match(stage, /if \(summary !== lastSummary && \(hasAction \|\| custom\)\) setCard\(true\);/);
  assert.match(stage, /else if \(custom && hasAction && !lastHadAction\) setCard\(true\);/);
  assert.match(stage, /lastHadAction = hasAction;/);
  // Solo con resumen declarado (diagnostico): las practicas conservan su regla.
  assert.match(stage, /const custom = panel\.querySelector\("\[data-card-summary\]"\);/);
});

test("UI-movil. la expansion manual de la tarjeta no sobrevive a Reiniciar ni al cerrar la refrigeracion", () => {
  // Medido con clic real en 390x844: tras expandir la tarjeta en el caso 07,
  // "Reiniciar" la dejaba expandida (mismo resumen = mismo sintoma) tapando la
  // tapa inferior y sus tornillos.
  const stage = read("js/hardware_lab_3d_stage.js");
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  const mech = read("js/hardware_lab_3d_diagnosis_mechanics.js");
  assert.match(stage, /resetCardExpansion: \(\) => \{\s*userExpandedFor = null;/);
  assert.equal((ctl.match(/stage\.resetCardExpansion\(\)/g) || []).length, 2, "al empezar el caso y al reiniciar");
  assert.match(mech, /if \(thermalShown && stage\.resetCardExpansion\) stage\.resetCardExpansion\(\);/);
  // Las practicas no la usan: conservan su comportamiento.
  assert.doesNotMatch(read("js/hardware_lab_3d_controller.js"), /resetCardExpansion/);
});
