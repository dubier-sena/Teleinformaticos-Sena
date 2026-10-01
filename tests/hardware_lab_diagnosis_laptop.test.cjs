"use strict";
// Diagnostico y reparacion multi-equipo (sep-27): regla "equipo listo para
// comprobar" (defecto real: el caso SATA del escritorio se aprobaba con la RAM
// fuera y el gabinete abierto), seguridad de la bateria del portatil y los 5
// casos base del portatil. Motor y datos REALES en un sandbox.
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
  ["hardware_lab_tools.js", "hardware_lab_data_desktop.js", "hardware_lab_data_laptop.js", "hardware_lab_engine.js", "hardware_lab_diagnosis_engine.js", "hardware_lab_diagnosis_cases.js", "admin_hardware_lab.js"].forEach((f) =>
    vm.runInContext(read("js/" + f), sandbox, { filename: f })
  );
  return sandbox.window;
}
const W = loadLab();
const H = W.HardwareLab;
const Diag = H.DiagnosisEngine;
const DESKTOP = H.DataDesktop.DESKTOP_EQUIPMENT;
const LAPTOP = H.DataLaptop.LAPTOP_EQUIPMENT;
const Cases = H.DiagnosisCases;

function act(data, session, partId, action) {
  const part = Diag.getPart(data, partId);
  return Diag.attemptAction(data, session, { partId, action, toolId: part.tool || "hands" });
}
function must(r, what) {
  assert.equal(r.ok, true, what + ": " + r.message);
  return r.session;
}
// Objetos creados en el sandbox de vm: se comparan por JSON (otro "realm").
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);
const verbs = (data, id) => (Diag.getPart(data, id).kind === "cable" ? ["disconnect", "connect"] : ["remove", "install"]);

test("D01. escritorio, caso SATA: corregido con la RAM FUERA no aprueba; armado de nuevo, SI", () => {
  const c = Cases.getCase("desktop", "caso-04");
  let s = Diag.createDiagnosisSession(DESKTOP, c);
  s = must(act(DESKTOP, s, "side-panel", "remove"), "abrir");
  s = must(act(DESKTOP, s, "cable-sata-data", "connect"), "corregir SATA");
  s = must(act(DESKTOP, s, "ram", "remove"), "retirar RAM");
  let r = Diag.checkPowerOn(DESKTOP, s);
  assert.equal(r.fixed, false, "con la RAM fuera NO debe aprobar");
  assert.equal(r.outcome, "not-ready");
  assert.equal(r.faultFixed, true);
  assert.match(r.message, /no está en condiciones/);
  s = must(act(DESKTOP, r.session, "ram", "install"), "reinstalar RAM");
  r = Diag.checkPowerOn(DESKTOP, s);
  assert.equal(r.fixed, false, "con el gabinete abierto tampoco");
  s = must(act(DESKTOP, r.session, "side-panel", "install"), "cerrar");
  r = Diag.checkPowerOn(DESKTOP, s);
  assert.equal(r.fixed, true);
  assert.equal(r.outcome, "fixed");
});

test("D02. el mensaje de 'no listo' no revela que pieza falta", () => {
  assert.doesNotMatch(Diag.NOT_READY_MESSAGE, /RAM|memoria|SATA|batería|bateria|tapa|tornillo|SSD|cable/i);
});

test("D03. las piezas externas del escritorio no existen en el portatil", () => {
  assert.equal(Diag.getPart(LAPTOP, "power-cable-wall"), null);
  assert.equal(Diag.getPart(LAPTOP, "cable-video"), null);
  assert.ok(Diag.getPart(DESKTOP, "power-cable-wall"));
  const s = Diag.createDiagnosisSession(LAPTOP, Cases.getCase("laptop", "laptop-case-01"));
  assert.equal("power-cable-wall" in s.parts, false);
});

test("L01. los casos del portatil: IDs propios, equipo declarado, sin chocar con el escritorio", () => {
  const ids = Cases.casesFor("laptop").map((c) => c.id);
  // 01-05 (Fase A+B) + 06 Wi-Fi y 07 sobrecalentamiento (Fase C, con variantes)
  // + 08 falla desconocida (C.2: reutiliza las condiciones de 01-07)
  // + 09 componente averiado, 10 y 11 fallas dobles (LOOP portatil, oct-1).
  same(ids, ["laptop-case-01", "laptop-case-02", "laptop-case-03", "laptop-case-04", "laptop-case-05", "laptop-case-06", "laptop-case-07", "laptop-case-08", "laptop-case-09", "laptop-case-10", "laptop-case-11"]);
  assert.equal(Cases.casesFor("desktop").length, 10);
  assert.equal(Cases.CASES.length, 10, "CASES sigue siendo la lista del escritorio (compatibilidad)");
  Cases.casesFor("desktop").forEach((c) => assert.match(c.id, /^caso-\d\d$/, "IDs del escritorio intactos"));
  const all = Cases.ALL_CASES.map((c) => c.id);
  assert.equal(new Set(all).size, all.length);
  // Todas las piezas referenciadas existen en el portatil real.
  Cases.casesFor("laptop").forEach((c) =>
    (c.faultPool || [c.fault]).forEach((f) =>
      f.relevantPartIds.concat(f.fixCondition.partId ? [f.fixCondition.partId] : []).forEach((id) => assert.ok(LAPTOP.parts[id], c.id + ": " + id))
    )
  );
});

const EXPECTED = {
  "laptop-case-01": "ram",
  "laptop-case-02": "ssd-m2",
  "laptop-case-03": "cable-touchpad-flex",
  "laptop-case-04": "cable-keyboard-flex",
  "laptop-case-05": "cable-screen-flex",
};
const REVEAL = /\b(ram|so-dimm|ssd|m\.2|flex|edp|cable|mal asentad|desconectad)\b/i;

for (const [caseId, faultPart] of Object.entries(EXPECTED)) {
  test(`L02. ${caseId}: falla oculta, seguridad de bateria, reparacion y equipo listo antes de aprobar`, () => {
    const c = Cases.getCase("laptop", caseId);
    assert.equal(c.equipmentId, "laptop");
    same(c.fault.fixCondition, { type: "reseated", partId: faultPart });
    // A. Estado inicial: la pieza esta EN SU SITIO (mal asentada, no en la bandeja) y la falla existe.
    let s = Diag.createDiagnosisSession(LAPTOP, c);
    assert.ok(Object.values(s.parts).every((v) => v === true), "todo presente al inicio");
    let r = Diag.checkPowerOn(LAPTOP, s);
    assert.equal(r.outcome, "fault");
    s = r.session;
    // Sintoma y nombre orientan, no revelan la pieza.
    assert.doesNotMatch(c.symptom, REVEAL, "sintoma revela la pieza");
    assert.doesNotMatch(c.name, REVEAL, "nombre revela la pieza");
    assert.doesNotMatch(c.fault.symptomBroken, REVEAL);
    // Seguridad: con la bateria conectada no se toca un componente interno.
    s = must(act(LAPTOP, s, "bottom-cover", "remove"), "tapa");
    const [off, on] = verbs(LAPTOP, faultPart);
    const inseguro = act(LAPTOP, s, faultPart, off);
    assert.equal(inseguro.ok, false);
    assert.match(inseguro.message, /desconecta primero la batería/);
    assert.equal(inseguro.session.errorsByType.unsafe, 1, "queda registrado como inseguro");
    s = inseguro.session;
    // Procedimiento correcto.
    s = must(act(LAPTOP, s, "cable-battery", "disconnect"), "bateria");
    // C. Tocar OTRA pieza no resuelve la falla.
    const otra = faultPart === "ram" ? "ssd-m2" : "ram";
    const [o1, o2] = verbs(LAPTOP, otra);
    s = must(act(LAPTOP, s, otra, o1), "otra pieza fuera");
    // D. Pieza esencial fuera: no aprueba aunque la falla se corrija.
    s = must(act(LAPTOP, s, faultPart, off), "retirar la pieza de la falla");
    s = must(act(LAPTOP, s, faultPart, on), "reinsertarla");
    r = Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
    assert.equal(r.fixed, false);
    assert.equal(r.outcome, "not-ready", "falla corregida, pero con una pieza esencial fuera");
    s = must(act(LAPTOP, r.session, otra, o2), "reponer la otra pieza");
    // E. Bateria desconectada: no aprueba.
    r = Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
    assert.equal(r.outcome, "not-ready", "con la bateria desconectada no puede aprobar");
    s = must(act(LAPTOP, r.session, "cable-battery", "connect"), "reconectar bateria");
    // D. Tapa retirada: no aprueba.
    r = Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
    assert.equal(r.outcome, "not-ready", "con la tapa inferior retirada no puede aprobar");
    s = must(act(LAPTOP, r.session, "bottom-cover", "install"), "cerrar");
    // Tornillos de cierre sin colocar: no aprueba.
    r = Diag.checkPowerOn(LAPTOP, s, { screwsSecured: false });
    assert.equal(r.outcome, "not-ready", "con tornillos sin colocar no puede aprobar");
    // F. Armado y asegurado: aprueba.
    r = Diag.checkPowerOn(LAPTOP, r.session, { screwsSecured: true });
    assert.equal(r.fixed, true, r.message);
    assert.equal(r.message, c.fault.symptomFixed);
    // Eficiencia: el procedimiento seguro (tapa, bateria) no cuenta como innecesario; la otra pieza si.
    same(r.session.unnecessaryPartIds, [otra]);
    const fin = Diag.finish(r.session);
    assert.equal(fin.result.breakdown.procedimiento.value, 22, "el intento inseguro resta en Procedimiento");
    assert.equal(fin.result.breakdown.eficiencia.value, 8);
    assert.equal(fin.result.status, "APROBADO");
  });

  test(`L03. ${caseId}: sin reasentar la pieza de la falla, armado completo NO aprueba`, () => {
    const c = Cases.getCase("laptop", caseId);
    let s = Diag.createDiagnosisSession(LAPTOP, c);
    s = must(act(LAPTOP, s, "bottom-cover", "remove"), "tapa");
    s = must(act(LAPTOP, s, "cable-battery", "disconnect"), "bateria");
    s = must(act(LAPTOP, s, "cable-battery", "connect"), "bateria");
    s = must(act(LAPTOP, s, "bottom-cover", "install"), "tapa");
    const r = Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
    assert.equal(r.fixed, false);
    assert.equal(r.outcome, "fault", "volver a armar no es reparar");
  });

  test(`L04. ${caseId}: 3 pistas progresivas y repaso completo`, () => {
    const c = Cases.getCase("laptop", caseId);
    assert.equal(c.hints.length, 3);
    let s = Diag.createDiagnosisSession(LAPTOP, c);
    c.hints.forEach((h) => {
      const r = Diag.useHint(s, c);
      assert.equal(r.ok, true);
      assert.equal(r.message, h);
      s = r.session;
    });
    assert.equal(Diag.useHint(s, c).ok, false, "no hay una cuarta pista");
    assert.doesNotMatch(c.hints[0], REVEAL, "la primera pista orienta, no nombra la pieza");
    ["whatWasHappening", "why", "howToDiagnose", "howToFix", "optimalProcedure", "prevention"].forEach((k) => assert.ok(c.explanation[k] && c.explanation[k].length > 20, k));
  });
}

test("L05. identidad por equipo en el progreso y en el panel del instructor (datos antiguos intactos)", () => {
  const api = W.__hwlabAdminTest__;
  const state = {
    hwlab_desktop_diagnosis_caso_04: { result: { score: 100, status: "APROBADO" } },
    hwlab_laptop_diagnosis_laptop_case_01: { result: { score: 90, status: "APROBADO" } },
    hwlab_laptop_disassembly_guided: { mode: "disassembly-guided" },
  };
  const parsed = api.parseHwlabState(state);
  const byKey = Object.fromEntries(parsed.diagnosisCases.map((c) => [c.key, c]));
  assert.equal(byKey.hwlab_desktop_diagnosis_caso_04.equipmentId, "desktop");
  assert.equal(byKey.hwlab_laptop_diagnosis_laptop_case_01.equipmentId, "laptop");
  assert.equal(parsed.practices.length, 1, "la practica del portatil no se confunde con diagnostico");
  const src = read("js/admin_hardware_lab.js");
  assert.match(src, /esc\(caseLabel\(c\.caseKey, c\.equipmentId\)\)/);
});

test("L06. controlador y bootstrap: multiequipo, sin encuadre automatico y la tarjeta del portatil SIGUE bloqueada", () => {
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  const boot = read("js/hardware_lab_3d_bootstrap.js");
  // Release 20260928_1: el diagnostico del portatil queda HABILITADO (y solo escritorio + portatil).
  assert.match(boot, /available: equipmentId === "desktop" \|\| equipmentId === "laptop",/, "diagnostico disponible para escritorio y portatil");
  assert.match(boot, /"11 casos de diagnóstico: conexiones, mantenimiento, componentes averiados y fallas dobles\."/);
  assert.doesNotMatch(boot, /Próximamente para portátil/);
  assert.match(boot, /diagnosisController\.showCaseMenu\(selectedEquipmentId\)/);
  assert.match(ctl, /Storage\(\)\.persist\(equipmentId, storageModeFor\(caseDef\.id\), data\)/);
  assert.doesNotMatch(ctl, /loadLocal\("desktop"|persist\("desktop"|DESKTOP_EQUIPMENT;\n\s+if \(!stage/);
  assert.doesNotMatch(ctl, /setFramingPolicy/, "diagnostico no encuadra la pieza de la falla");
  // La sesion guardada del portatil conserva los tornillos.
  assert.match(ctl, /if \(mech\) data\.screws = mech\.screwState\(\);/);
});
