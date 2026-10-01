"use strict";
// Microfase C.1 + Caso 08 «Falla desconocida» (sep-27). Motor, casos y sistema
// termico REALES en un sandbox. El Caso 08 no trae fallas propias: cada
// entrada de su pool REFERENCIA una condicion de los casos 01-07.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const layoutUrl = "file://" + path.join(ROOT, "js/hardware_lab_3d_ui_layout.js");

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
const C8 = Cases.getCase("laptop", "laptop-case-08");
// Los casos 09-11 (averias y fallas dobles, oct-1) no entran en el pool del 08.
const BASE = Cases.casesFor("laptop").filter((c) => c.number < 8);
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

function sessionFor(variantId) {
  const i = C8.faultPool.findIndex((f) => f.variantId === variantId);
  assert.ok(i >= 0, variantId);
  const s = Diag.createDiagnosisSession(LAPTOP, C8, { rng: () => (i + 0.5) / C8.faultPool.length });
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
function reseat(s, ids) {
  ids.forEach((id) => (s = must(act(s, id, off(id)), "retirar " + id)));
  ids.slice().reverse().forEach((id) => (s = must(act(s, id, on(id)), "poner " + id)));
  return s;
}
const openSafe = (s) => must(act(must(act(s, "bottom-cover", "remove"), "tapa"), "cable-battery", "disconnect"), "bateria");
const closeUp = (s) => must(act(must(act(s, "cable-battery", "connect"), "bateria"), "bottom-cover", "install"), "tapa");
const check = (s, secured) => Diag.checkPowerOn(LAPTOP, s, { screwsSecured: secured !== false });
function tasks(s, list) {
  list.forEach(([t, amount]) => {
    const r = Diag.applyThermalTask(LAPTOP, s, t, { amount });
    assert.equal(r.ok, true, t + ": " + r.message);
    s = r.session;
  });
  return s;
}
// Reparacion correcta de cada condicion (clave = variantId del Caso 08).
const REPAIR = {
  "laptop-case-01": (s) => reseat(s, ["ram"]),
  "laptop-case-02": (s) => reseat(s, ["ssd-m2"]),
  "laptop-case-03": (s) => reseat(s, ["cable-touchpad-flex"]),
  "laptop-case-04": (s) => reseat(s, ["cable-keyboard-flex"]),
  "laptop-case-05": (s) => reseat(s, ["cable-screen-flex"]),
  "laptop-case-06:wifi-card": (s) => reseat(s, ["wifi-antenna-1", "wifi-antenna-2", "wifi-card"]),
  "laptop-case-06:wifi-antenna-1": (s) => reseat(s, ["wifi-antenna-1"]),
  "laptop-case-06:wifi-antenna-2": (s) => reseat(s, ["wifi-antenna-2"]),
  "laptop-case-07:dust": (s) => thermalRepair(s, [["brush"], ["air"]]),
  "laptop-case-07:paste": (s) => thermalRepair(s, [["scrape"], ["alcohol"], ["apply", "adecuada"]]),
  "laptop-case-07:fan-cable": (s) => reseat(s, ["cable-cpu-fan-laptop"]),
};
function thermalRepair(s, list) {
  s = must(act(s, "cable-cpu-fan-laptop", "disconnect"), "ventilador");
  s = must(act(s, "cooler", "remove"), "modulo");
  s = tasks(s, list);
  s = must(act(s, "cooler", "install"), "modulo");
  return must(act(s, "cable-cpu-fan-laptop", "connect"), "ventilador");
}

// ── A/B/P: pool por referencia, sin condiciones nuevas ───────────────────────
test("C8-A/B. el pool reutiliza EXACTAMENTE las 11 condiciones de 01-07 (mismos objetos, ninguna nueva)", () => {
  const origin = [];
  BASE.forEach((c) => (c.faultPool || [c.fault]).forEach((f) => origin.push({ c, f })));
  assert.equal(C8.faultPool.length, origin.length);
  assert.equal(C8.faultPool.length, 11);
  C8.faultPool.forEach((e) => {
    const o = origin.find((x) => x.f.fixCondition === e.fixCondition);
    assert.ok(o, e.variantId + ": condicion que no existe en 01-07");
    assert.equal(e.sourceCaseId, o.c.id);
    assert.equal(e.overrides, o.f.overrides, "overrides por referencia");
    assert.equal(e.relevantPartIds, o.f.relevantPartIds, "mismas piezas relevantes");
    assert.equal(e.symptomBroken, o.f.symptomBroken);
    assert.equal(e.thermal, o.f.thermal, "estado termico por referencia");
  });
  // Sin tipos de condicion nuevos.
  const tipos = new Set(C8.faultPool.map((e) => e.fixCondition.type));
  same([...tipos].sort(), ["reseated", "thermalReady"]);
  // Sin motores de falla propios del 08.
  assert.doesNotMatch(read("js/hardware_lab_diagnosis_cases.js") + read("js/hardware_lab_diagnosis_engine.js"), /UnknownFault|unknownFault|wifiUnknown|thermalUnknown/);
});

test("C8-P. el estado termico es el mismo modulo y el mismo estado inicial que el Caso 07", () => {
  const c7 = Cases.getCase("laptop", "laptop-case-07");
  ["dust", "paste", "fan-cable"].forEach((v) => {
    const s8 = sessionFor("laptop-case-07:" + v);
    const i7 = c7.faultPool.findIndex((f) => f.variantId === v);
    const s7 = Diag.createDiagnosisSession(LAPTOP, c7, { rng: () => (i7 + 0.5) / 3 });
    same(s8.thermal, s7.thermal, v);
  });
  assert.equal(Thermal.isReady(sessionFor("laptop-case-02").thermal), true, "fallas no termicas: refrigeracion en buen estado");
});

// ── C/D: persistencia y reinicio ─────────────────────────────────────────────
test("C8-C. la variante se conserva al guardar y volver a cargar la sesion", () => {
  let s = openSafe(sessionFor("laptop-case-06:wifi-antenna-2"));
  const back = Diag.deserialize(JSON.parse(JSON.stringify(Diag.serialize(s))));
  assert.equal(back.variantId, "laptop-case-06:wifi-antenna-2");
  same(back.fixCondition, s.fixCondition);
  same(back.parts, s.parts);
  // El controlador reanuda la sesion guardada (sin resultado) en vez de crear otra.
  assert.match(read("js/hardware_lab_3d_diagnosis_controller.js"), /session = saved && !saved\.result \? Object\.assign\(\{\}, saved\) : createSession\(\);/);
});

test("C8-D. reiniciar puede cambiar la condicion (Math.random real del producto)", () => {
  const seen = {};
  for (let i = 0; i < 1100; i++) {
    const v = Diag.createDiagnosisSession(LAPTOP, C8).variantId;
    seen[v] = (seen[v] || 0) + 1;
  }
  assert.equal(Object.keys(seen).length, 11, "todas las condiciones pueden salir: " + JSON.stringify(seen));
  Object.values(seen).forEach((n) => assert.ok(n > 30, "ninguna condicion queda casi excluida: " + JSON.stringify(seen)));
});

// ── E/F/G/H: reparaciones falsas, correctas, equipo abierto, bateria ────────
for (const e of C8.faultPool) {
  test(`C8-EFGH. ${e.variantId}: sintoma, falsa reparacion, reparacion real, equipo abierto y bateria`, () => {
    let s = sessionFor(e.variantId);
    let r = check(s);
    assert.equal(r.outcome, "fault");
    assert.equal(r.message, e.symptomBroken, "al encender se observa el sintoma (sin nombrar la causa)");
    s = openSafe(r.session);
    // E. Reparacion de otra condicion: no corrige.
    const otra = Object.keys(REPAIR).find((k) => k.split(":")[0] !== e.sourceCaseId && !/07/.test(k));
    s = REPAIR[otra](s);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, `${otra} no repara ${e.variantId}`);
    // F. La reparacion real si corrige.
    s = REPAIR[e.variantId](s);
    assert.equal(Diag.isFixConditionMet(LAPTOP, s), true);
    // G. Abierto / bateria desconectada: no aprueba.
    assert.equal(check(s).outcome, "not-ready");
    s = must(act(s, "cable-battery", "connect"), "bateria");
    assert.equal(check(s).outcome, "not-ready", "tapa retirada");
    s = must(act(s, "bottom-cover", "install"), "tapa");
    assert.equal(check(s, false).outcome, "not-ready", "tornillos sueltos");
    r = check(s);
    assert.equal(r.fixed, true, r.message);
    assert.equal(Diag.finish(r.session).result.status, "APROBADO");
  });
}

test("C8-H. la regla de bateria es la misma: tocar un interno energizado es inseguro", () => {
  let s = must(act(sessionFor("laptop-case-01"), "bottom-cover", "remove"), "tapa");
  const r = act(s, "ram", "remove");
  assert.equal(r.ok, false);
  assert.match(r.message, /desconecta primero la batería/);
  assert.equal(r.session.errorsByType.unsafe, 1);
  s = must(act(r.session, "cable-battery", "disconnect"), "bateria");
  s = must(act(s, "cable-battery", "connect"), "bateria otra vez");
  const t = act(s, "cable-cpu-fan-laptop", "disconnect");
  assert.equal(t.ok, false, "el ventilador tampoco con la bateria conectada");
  assert.equal(t.session.errorsByType.unsafe, 2);
});

// ── I/J/K/L: pistas ─────────────────────────────────────────────────────────
const SUBSYSTEM = /ram|memoria|ssd|almacenamiento|disco|touchpad|teclado|pantalla|imagen|edp|wi-?fi|inal[aá]mbric|antena|red\b|refrigeraci|ventilador|pasta|polvo|temperatura|calor|disipador/i;
const ORIENT = new RegExp(SUBSYSTEM.source + "|dispositivo de entrada|conexi[oó]n interna", "i");
const CAUSE = /\b(ram|so-dimm|ssd|m\.2|flex|edp|cable|antena|tarjeta wi-?fi|pasta|polvo|ventilador|conector|mal asentad|desconectad)/i;
test("C8-IJKL. pistas: 3 niveles adaptados a la condicion; 1 sin subsistema, 2 sin causa, 3 orienta", () => {
  C8.faultPool.forEach((e) => {
    const src = Cases.getCase("laptop", e.sourceCaseId);
    assert.equal(e.hints.length, 3);
    assert.doesNotMatch(e.hints[0], SUBSYSTEM, e.variantId + ": la pista 1 nombra un subsistema");
    assert.doesNotMatch(e.hints[1], CAUSE, e.variantId + ": la pista 2 nombra la causa");
    assert.equal(e.hints[1], src.hints[0], "pista 2 = orientacion validada del caso de origen");
    assert.equal(e.hints[2], src.hints[1], "pista 3 = subsistema del caso de origen");
    assert.notEqual(e.hints[2], src.hints[2], "nunca la pista 'revisa X' del origen");
    assert.match(e.hints[2], ORIENT, e.variantId + ": la pista 3 debe orientar al subsistema");
    assert.doesNotMatch(e.hints.join(" "), /la falla es (el|la|un|una)\b/i);
    let s = sessionFor(e.variantId);
    e.hints.forEach((h) => {
      const r = Diag.useHint(s, C8);
      assert.equal(r.message, h);
      s = r.session;
    });
    assert.equal(Diag.useHint(s, C8).ok, false, "no hay cuarta pista");
  });
  // Los casos 01-07 conservan sus propias pistas.
  BASE.forEach((c) => same(Diag.hintsFor(c, Diag.createDiagnosisSession(LAPTOP, c)), c.hints, c.id));
});

// ── M/N/O: repaso, puntuacion e interfaz ─────────────────────────────────────
test("C8-M. repaso: la causa REAL de ese intento y la accion que la corrigio (con el acoplamiento fisico explicado)", () => {
  C8.faultPool.forEach((e) => {
    const src = Cases.getCase("laptop", e.sourceCaseId);
    const v = (src.faultPool || []).find((f) => f.fixCondition === e.fixCondition);
    const expected = (v && v.explanation && v.explanation.whatWasHappening) || src.explanation.whatWasHappening;
    assert.equal(e.explanation.whatWasHappening, expected, e.variantId);
  });
  // Antena principal corregida al montar de nuevo la pantalla: se registra la accion real.
  let s = openSafe(sessionFor("laptop-case-06:wifi-antenna-1"));
  s = reseat(s, ["cable-screen-flex", "wifi-antenna-1", "wifi-antenna-2", "screen-assembly"]);
  const by = Diag.fixedBy(s);
  assert.equal(by.type, "fault-fixed");
  assert.equal(by.partId, "wifi-antenna-1");
  assert.equal(by.action, "connect");
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /\["Qué corrigió la falla", caseDef\.unknown \? fixedByText\(\) : ""\]/);
  assert.match(ctl, /tuviste que desconectar/);
  // Tarjeta Wi-Fi: el ultimo paso es reconectar una antena, pero la causa era la tarjeta.
  let c = openSafe(sessionFor("laptop-case-06:wifi-card"));
  c = reseat(c, ["wifi-antenna-1", "wifi-antenna-2", "wifi-card"]);
  assert.equal(Diag.fixedBy(c).partId, "wifi-antenna-1", "el cambio de estado ocurre al reconectar la ultima antena");
  assert.match(ctl, /la falla quedó corregida al reasentar " \+ getPart\(fault\)\.name \+ "; el último paso necesario fue/);
  // Termica: la tarea que dejo el sistema listo.
  let t = openSafe(sessionFor("laptop-case-07:dust"));
  t = REPAIR["laptop-case-07:dust"](t);
  assert.equal(Diag.fixedBy(t).task, "air");
});

test("C8-56. traza de identificacion (dato, NO nota): dirigida frente a 'servicio completo'", () => {
  // Dirigida: solo el conector del ventilador.
  let a = openSafe(sessionFor("laptop-case-07:fan-cable"));
  a = closeUp(REPAIR["laptop-case-07:fan-cable"](a));
  let ra = check(a);
  const ta = Diag.diagnosisTrace(LAPTOP, ra.session);
  assert.equal(ta.corrected, true);
  assert.equal(ta.identifiedBeforeRepair, true);
  assert.equal(ta.repairedWithoutDiagnosis, false);
  // Servicio completo (quitar el modulo y limpiar) que tambien la corrige.
  let b = openSafe(sessionFor("laptop-case-07:fan-cable"));
  b = must(act(b, "cable-cpu-fan-laptop", "disconnect"), "v");
  b = must(act(b, "cooler", "remove"), "m");
  b = Diag.applyThermalTask(LAPTOP, b, "brush").session; // sin efecto: ya limpio
  b = closeUp(must(act(must(act(b, "cooler", "install"), "m"), "cable-cpu-fan-laptop", "connect"), "v"));
  const rb = check(b);
  assert.equal(rb.fixed, true);
  const tb = Diag.diagnosisTrace(LAPTOP, rb.session);
  assert.equal(tb.corrected, true);
  assert.equal(tb.identifiedBeforeRepair, false);
  assert.equal(tb.repairedWithoutDiagnosis, true);
  same(tb.extraParts, ["cooler"]);
  same(tb.extraThermalTasks, ["brush"]);
  // La nota no cambia por la traza.
  const fa = Diag.finish(ra.session).result, fb = Diag.finish(rb.session).result;
  assert.equal(fa.breakdown.diagnostico.value, fb.breakdown.diagnostico.value);
  assert.equal(read("js/hardware_lab_diagnosis_engine.js").match(/function computeScoreBreakdown[\s\S]*?\n  \}/)[0].includes("trace"), false);
});

test("C8-N. puntuacion: misma rubrica; no depende de un campo propio del 08 ni muestra la variante", () => {
  const s = sessionFor("laptop-case-03");
  const b = Diag.finish(check(closeUp(REPAIR["laptop-case-03"](openSafe(s)))).session).result.breakdown;
  same([b.diagnostico.max, b.procedimiento.max, b.reparacion.max, b.herramientas.max, b.eficiencia.max], [30, 25, 25, 10, 10]);
  assert.equal(b.total, 100);
  // El modal de resultado solo pinta el desglose y el repaso (no la traza ni ids internos).
  const stage = read("js/hardware_lab_3d_stage.js");
  const modal = stage.match(/function openResultModal[\s\S]*?\n  \}/)[0];
  assert.doesNotMatch(modal, /trace|variantId|fixCondition/);
});

test("C8-O. interfaz: sintoma general hasta reproducir la falla; nada de la variante en textos ni atributos", () => {
  assert.doesNotMatch(C8.name + " " + C8.symptom, SUBSYSTEM);
  assert.equal(C8.revealSymptomOnCheck, true);
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /if \(caseDef\.revealSymptomOnCheck && !session\.actionLog\.some\(\(e\) => e\.type === "power-on-check"\)\) return caseDef\.symptom;/);
  assert.match(ctl, /const symptom = visibleSymptom\(\);/);
  assert.equal((ctl.match(/variantId/g) || []).length, 0);
  assert.doesNotMatch(ctl, /data-variant|aria-label="[^"]*\$\{/);
  // Misma UI: ni panel, ni modal, ni dock nuevos.
  assert.doesNotMatch(read("laboratorio-virtual-hardware.html"), /caso-?08|unknown/i);
  // El 08 sigue bloqueado por orden y la tarjeta del portatil sigue deshabilitada.
  assert.match(read("js/hardware_lab_3d_bootstrap.js"), /available: equipmentId === "desktop" \|\| equipmentId === "laptop",/);
});

// ── Q: las correcciones de la microfase C.1 siguen en su sitio ───────────────
test("C1-A. desplazamiento: antenas 2,5 mm (medido), tarjeta 1,5 mm arrastrando sus antenas", () => {
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /const MISSEAT_DISTANCE = 0\.0015;/);
  assert.match(ctl, /const MISSEAT_DISTANCE_BY_PART = \{ "wifi-antenna-1": 0\.0025, "wifi-antenna-2": 0\.0025 \};/);
  assert.match(ctl, /const MISSEAT_CARRIES = \{ "wifi-card": \["wifi-antenna-1", "wifi-antenna-2"\] \};/);
  // Tras cada accion asentada se vuelve a aplicar (una antena reconectada sobre la tarjeta aun levantada la sigue).
  assert.match(ctl, /onSettled: \(\) => \{\s*HardwareLabAudio\.playPlace\(\);\s*\/\/[^\n]*\n\s*applyMisseat\(\);/);
  assert.match(read("js/hardware_lab_3d_rig.js"), /function homeOffset\(partId\)/);
});

test("C1-B. avisos: nunca por encima de los controles; prioridad pieza > obligatorios > tarjeta/dock", async () => {
  const L = await import(layoutUrl);
  const css = read("css/page_hardware_lab.css");
  assert.match(css, /\.hwlab-feedback \{\s*display: flex;[^}]*z-index: 19;/);
  assert.doesNotMatch(css, /\.hwlab-feedback\[data-pos="hist"\][^}]*z-index/);
  const stage = read("js/hardware_lab_3d_stage.js");
  assert.match(stage, /const REQUIRED_CONTROLS = "#hwlab-card-toggle, #hwlab-power-check-btn, #hwlab-prepare-btn, #hwlab-safety-confirm-btn/);
  assert.doesNotMatch(stage.match(/function placeFeedback[\s\S]*?\n  \}/)[0], /if \(!target\) return 0;/, "sin pieza objetivo tambien se coloca");
  // Unidad: el aviso de "Preparar" no puede caer sobre el boton "Preparar".
  const boton = L.rect(20, 80, 350, 44);
  const card = L.rect(8, 8, 374, 130);
  const spots = [
    { pos: "", rect: L.rect(16, 500, 358, 90) },
    { pos: "top", rect: L.rect(16, 20, 358, 90) },
    { pos: "free", rect: L.rect(16, 146, 358, 90) },
  ];
  const pieza = Object.assign(L.rect(40, 480, 300, 80), { points: [{ x: 100, y: 520 }] });
  assert.equal(L.chooseFeedbackSpot(spots, pieza, [card], { required: [boton] }).pos, "free");
  // Si solo queda elegir, la pieza manda sobre los controles (que igual quedan encima: z-index).
  const soloDos = spots.slice(0, 2);
  assert.equal(L.chooseFeedbackSpot(soloDos, pieza, [card], { required: [boton] }).pos, "top");
  // Sin pieza objetivo tambien se aparta de lo obligatorio.
  assert.equal(L.chooseFeedbackSpot(spots, null, [card], { required: [boton] }).pos, "");
});
