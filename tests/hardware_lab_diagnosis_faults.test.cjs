"use strict";
// LOOP portatil, fases F-K (2026-10-01): componentes AVERIADOS (revisar y
// cambiar por repuesto), FALLAS DOBLES (por etapas), pantalla del equipo como
// sintoma observable y banco de EVALUACION (6 escenarios, rubrica 30/25/25/10).
// Motor y casos REALES en un sandbox, como el resto de pruebas del diagnostico.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function loadLab() {
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  ["hardware_lab_tools.js", "hardware_lab_data_desktop.js", "hardware_lab_data_laptop.js", "hardware_lab_engine.js", "hardware_lab_thermal.js", "hardware_lab_diagnosis_engine.js", "hardware_lab_diagnosis_cases.js", "hardware_lab_attempts.js"].forEach((f) =>
    vm.runInContext(read("js/" + f), sandbox, { filename: f })
  );
  return sandbox.window;
}
const H = loadLab().HardwareLab;
const Diag = H.DiagnosisEngine;
const LAPTOP = H.DataLaptop.LAPTOP_EQUIPMENT;
const Cases = H.DiagnosisCases;
const Att = H.Attempts;
const same = (a, b, msg) => assert.equal(JSON.stringify(a), JSON.stringify(b), msg);

function sessionFor(caseId, variantId) {
  const c = Cases.getCase("laptop", caseId);
  const i = c.faultPool.findIndex((f) => f.variantId === variantId);
  assert.ok(i >= 0, caseId + "@" + variantId);
  const s = Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (i + 0.5) / c.faultPool.length, now: "2026-10-01T10:00:00.000Z" });
  assert.equal(s.variantId, variantId);
  return s;
}
const act = (s, partId, action) => Diag.attemptAction(LAPTOP, s, { partId, action, toolId: Diag.getPart(LAPTOP, partId).tool || "hands" });
function must(r, what) {
  assert.equal(r.ok, true, what + ": " + r.message);
  return r.session;
}
const off = (id) => (Diag.getPart(LAPTOP, id).kind === "cable" ? "disconnect" : "remove");
const on = (id) => (Diag.getPart(LAPTOP, id).kind === "cable" ? "connect" : "install");
const take = (s, id) => must(act(s, id, off(id)), "retirar " + id);
const put = (s, id) => must(act(s, id, on(id)), "poner " + id);
const open = (s) => take(take(s, "bottom-cover"), "cable-battery");
const close = (s) => put(put(s, "cable-battery"), "bottom-cover");
const power = (s) => Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
const thermal = (s, task, amount) => {
  const r = Diag.applyThermalTask(LAPTOP, s, task, { amount });
  assert.equal(r.ok, true, task + ": " + r.message);
  return r.session;
};
const finish = (s) => Diag.finish(s, { equipmentData: LAPTOP, now: "2026-10-01T10:20:00.000Z" }).result;

// ── Componente averiado ─────────────────────────────────────────────────────
test("AV-1 reasentar un componente averiado NO corrige la falla; cambiarlo por repuesto si", () => {
  let s = open(sessionFor("laptop-case-09", "ram-damaged"));
  same(s.damagedPartIds, ["ram"]);
  s = put(take(s, "ram"), "ram");
  assert.equal(Diag.isFixConditionMet(LAPTOP, s), false, "reasentada sigue averiada");
  let r = power(close(s));
  assert.equal(r.fixed, false);
  assert.equal(r.screen, "no-post");
  s = take(open(r.session), "ram");
  const rep = Diag.replacePart(LAPTOP, s, "ram");
  assert.equal(rep.ok, true);
  assert.equal(rep.justified, true);
  assert.equal(Diag.isFixConditionMet(LAPTOP, rep.session), false, "el repuesto aun esta en la bandeja");
  s = close(put(rep.session, "ram"));
  r = power(s);
  assert.equal(r.fixed, true);
  assert.equal(r.screen, "desktop");
  const res = finish(r.session);
  same(res.replacedParts, ["ram"]);
  same(res.unjustifiedReplacements, []);
  assert.equal(res.breakdown.eficiencia.value, 10);
  assert.equal(res.score, 100);
});

test("AV-2 revisar: gratis, exige la pieza retirada y describe el dano sin nombrar el caso", () => {
  let s = open(sessionFor("laptop-case-09", "battery-damaged"));
  const montada = Diag.inspectPart(LAPTOP, s, "battery");
  assert.equal(montada.ok, false);
  assert.match(montada.message, /primero retírala/);
  s = take(s, "battery");
  const e0 = s.errors;
  const danada = Diag.inspectPart(LAPTOP, s, "battery");
  assert.equal(danada.ok, true);
  assert.equal(danada.damaged, true);
  assert.match(danada.message, /hinchada/);
  assert.equal(danada.session.errors, e0, "revisar no penaliza");
  same(danada.session.inspectedPartIds, ["battery"]);
  // Una pieza sana retirada: sin dano.
  s = take(danada.session, "ram");
  const sana = Diag.inspectPart(LAPTOP, s, "ram");
  assert.equal(sana.damaged, false);
  assert.match(sana.message, /Sin daño visible/);
  // Tras cambiarla, la revision ve el repuesto.
  const nueva = Diag.inspectPart(LAPTOP, Diag.replacePart(LAPTOP, danada.session, "battery").session, "battery");
  assert.match(nueva.message, /repuesto nuevo/);
});

test("AV-3 sustitucion no justificada: se permite, no corrige y resta en eficiencia", () => {
  let s = open(sessionFor("laptop-case-09", "ram-damaged"));
  s = take(s, "ssd-m2");
  const rep = Diag.replacePart(LAPTOP, s, "ssd-m2");
  assert.equal(rep.ok, true);
  assert.equal(rep.justified, false);
  same(rep.session.unjustifiedReplacements, ["ssd-m2"]);
  s = put(rep.session, "ssd-m2");
  assert.equal(Diag.isFixConditionMet(LAPTOP, s), false);
  // Ahora la reparacion correcta.
  s = take(s, "ram");
  s = put(Diag.replacePart(LAPTOP, s, "ram").session, "ram");
  const r = power(close(s));
  assert.equal(r.fixed, true);
  const res = finish(r.session);
  same(res.unjustifiedReplacements, ["ssd-m2"]);
  // ssd-m2 fuera de las piezas relevantes (-2) + sustitucion no justificada (-3).
  assert.equal(res.breakdown.eficiencia.value, 5);
});

test("AV-4 repuestos: solo piezas del banco, solo retiradas y una vez", () => {
  let s = open(sessionFor("laptop-case-09", "ram-damaged"));
  assert.match(Diag.replacePart(LAPTOP, s, "ram").message, /Primero retira/);
  assert.match(Diag.replacePart(LAPTOP, s, "motherboard").message, /No hay repuesto/);
  s = take(s, "ram");
  s = Diag.replacePart(LAPTOP, s, "ram").session;
  assert.match(Diag.replacePart(LAPTOP, s, "ram").message, /ya es un repuesto nuevo/);
  LAPTOP.spares.forEach((id) => assert.ok(LAPTOP.parts[id], "repuesto de una pieza real: " + id));
  ["motherboard", "cpu", "screen-assembly", "bottom-cover"].forEach((id) => assert.ok(LAPTOP.spares.indexOf(id) === -1, id + " no tiene repuesto"));
  // Piezas retiradas visibles para revisar.
  const list = Diag.removedParts(LAPTOP, s).map((p) => p.partId + (p.replaced ? "*" : ""));
  assert.ok(list.includes("ram*") && list.includes("bottom-cover") && list.includes("cable-battery"), list.join(","));
});

test("AV-5 las cuatro averias del caso 09: cada una solo se corrige con SU repuesto", () => {
  const c = Cases.getCase("laptop", "laptop-case-09");
  assert.equal(c.faultPool.length, 4);
  c.faultPool.forEach((f) => {
    assert.equal(f.fixCondition.type, "replaced");
    assert.ok(f.finding && f.finding.length > 30, "hallazgo de la revision: " + f.variantId);
    assert.ok(LAPTOP.spares.includes(f.fixCondition.partId));
    const target = f.fixCondition.partId;
    LAPTOP.spares.forEach((cand) => {
      let s = open(sessionFor("laptop-case-09", f.variantId));
      const path = (function need(id, seen) {
        if (seen.has(id)) return [];
        seen.add(id);
        const reqs = (Diag.getPart(LAPTOP, id).removeRequires || []).filter((r) => r !== "cable-battery");
        return reqs.flatMap((r) => need(r, seen)).concat([id]);
      })(cand, new Set());
      path.forEach((id) => (s = take(s, id)));
      s = Diag.replacePart(LAPTOP, s, cand).session;
      // El modulo de refrigeracion no se monta sin pasta nueva: ese camino no aplica aqui.
      if (path.includes("cooler")) return;
      path.slice().reverse().forEach((id) => (s = put(s, id)));
      assert.equal(Diag.isFixConditionMet(LAPTOP, s), cand === target, f.variantId + " con repuesto de " + cand);
    });
  });
});

// ── Fallas dobles ───────────────────────────────────────────────────────────
test("FD-1 falla doble: el sintoma es el de la primera etapa; al corregirla aparece el de la segunda", () => {
  let s = sessionFor("laptop-case-10", "screen-and-wifi");
  assert.equal(s.fixCondition.type, "all");
  assert.equal(s.stages.length, 2);
  let r = power(s);
  assert.equal(r.fixed, false);
  assert.equal(r.screen, "no-image");
  assert.equal(r.stagesFixed, 0);
  assert.match(Diag.observedSymptom(r.session), /sin imagen/);
  s = open(r.session);
  s = put(take(s, "cable-screen-flex"), "cable-screen-flex");
  // Reparar no cambia el sintoma A LA VISTA: hay que volver a encender.
  assert.match(Diag.observedSymptom(s), /sin imagen/);
  r = power(close(s));
  assert.equal(r.fixed, false, "queda la segunda falla");
  assert.equal(r.screen, "wifi-weak");
  assert.equal(r.stagesFixed, 1);
  assert.match(r.message, /^Una de las fallas quedó corregida/);
  assert.match(Diag.observedSymptom(r.session), /inalámbrica/);
  s = open(r.session);
  s = put(take(s, "wifi-antenna-1"), "wifi-antenna-1");
  r = power(close(s));
  assert.equal(r.fixed, true);
  assert.equal(r.screen, "desktop");
  const res = finish(r.session);
  assert.equal(res.faultsFixed, 2);
  assert.equal(res.faultsTotal, 2);
  assert.equal(res.score, 100, "dos comprobaciones no penalizan: es el procedimiento correcto");
});

test("FD-2 falla doble con averia y mantenimiento (caso 11)", () => {
  let s = sessionFor("laptop-case-11", "ram-damaged-and-dust");
  same(s.damagedPartIds, ["ram"]);
  assert.equal(s.thermal.dust, "dirty");
  assert.equal(power(s).screen, "no-post");
  s = take(open(s), "ram");
  s = close(put(Diag.replacePart(LAPTOP, s, "ram").session, "ram"));
  let r = power(s);
  assert.equal(r.fixed, false);
  assert.equal(r.screen, "overheat");
  s = take(take(open(r.session), "cable-cpu-fan-laptop"), "cooler");
  s = thermal(thermal(s, "brush"), "air");
  s = close(put(put(s, "cooler"), "cable-cpu-fan-laptop"));
  r = power(s);
  assert.equal(r.fixed, true);
  const trace = Diag.diagnosisTrace(LAPTOP, r.session);
  assert.equal(trace.identifiedBeforeRepair, true, JSON.stringify(trace));
  same(trace.replacedParts, ["ram"]);
});

test("FD-3 todas las variantes de 09-11 declaran pantalla, sintomas que no nombran la pieza y piezas reales", () => {
  const REVEAL = /\b(ram|so-dimm|ssd|m\.2|flex|antena|tarjeta wi-fi|pasta|polvo|ventilador mal|averiad)/i;
  ["laptop-case-09", "laptop-case-10", "laptop-case-11"].forEach((id) => {
    const c = Cases.getCase("laptop", id);
    assert.equal(c.revealSymptomOnCheck, true);
    assert.doesNotMatch(c.symptom, REVEAL, id + ": el enunciado no delata la causa");
    assert.equal(c.hints.length, 3);
    c.faultPool.forEach((f) => {
      const s = sessionFor(id, f.variantId);
      s.stages.forEach((st) => assert.ok(st.screen, id + "@" + f.variantId + ": cada etapa tiene pantalla"));
      assert.equal(s.screenFixed, "desktop");
      Diag.conditionList(s.fixCondition).forEach((cond) => { if (cond.partId) assert.ok(LAPTOP.parts[cond.partId], cond.partId); });
      f.relevantPartIds.forEach((p) => assert.ok(LAPTOP.parts[p], p));
      // Lo que hay que tocar para repararla esta entre las piezas "relevantes" (no penaliza eficiencia).
      Diag.conditionList(s.fixCondition).forEach((cond) => { if (cond.partId) assert.ok(f.relevantPartIds.includes(cond.partId), f.variantId + ": " + cond.partId); });
    });
  });
});

test("FD-4 compatibilidad: una sesion guardada ANTES de las etapas se sigue evaluando igual", () => {
  const c = Cases.getCase("laptop", "laptop-case-01");
  const s = Diag.createDiagnosisSession(LAPTOP, c);
  const viejo = JSON.parse(JSON.stringify(Diag.serialize(s)));
  ["stages", "damagedPartIds", "replaced", "unjustifiedReplacements", "inspectedPartIds", "screenFixed", "thermalVariant", "evaluation"].forEach((k) => delete viejo[k]);
  let x = Diag.deserialize(viejo);
  assert.equal(Diag.stagesOf(x).length, 1);
  assert.match(Diag.observedSymptom(x), /sin arrancar/);
  x = open(x);
  x = close(put(take(x, "ram"), "ram"));
  const r = power(x);
  assert.equal(r.fixed, true);
  assert.equal(r.screen, "desktop");
  assert.equal(finish(r.session).score, 100);
  assert.equal(Diag.removedParts(LAPTOP, x).length, 0);
});

test("FD-5 los casos 01-08 no cambiaron de puntaje ni de condicion: solo ganaron pantalla", () => {
  const expected = { "laptop-case-01": "no-post", "laptop-case-02": "no-boot", "laptop-case-03": "touchpad-fail", "laptop-case-04": "keyboard-fail", "laptop-case-05": "no-image" };
  Object.keys(expected).forEach((id) => {
    const c = Cases.getCase("laptop", id);
    assert.equal(c.fault.fixCondition.type, "reseated");
    const s = Diag.createDiagnosisSession(LAPTOP, c);
    assert.equal(s.hints.max, 3);
    assert.equal(power(s).screen, expected[id], id);
  });
  const engine = read("js/hardware_lab_diagnosis_engine.js");
  assert.match(engine, /var CATEGORY_MAX = \{ diagnostico: 30, procedimiento: 25, reparacion: 25, herramientas: 10, eficiencia: 10 \};/);
  assert.match(engine, /Math\.max\(10, CATEGORY_MAX\.diagnostico - session\.hints\.used \* 5\)/);
  assert.equal(Cases.getCase("laptop", "laptop-case-08").faultPool.length, 11, "el pool del caso 08 no recibe las averias ni las fallas dobles");
});

// ── Pantalla ────────────────────────────────────────────────────────────────
test("PT-1 cada pantalla que usa un caso existe; sin imagen = equipo encendido sin imagen", async () => {
  const S = await import(pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_laptop_screen.js")).href).catch((e) => ({ error: e }));
  // El modulo importa three.js (ES module del proyecto): si Node puede cargarlo, se prueba screenModel.
  const used = new Set(["desktop"]);
  Cases.casesFor("laptop").concat(Cases.evaluationScenarios("laptop")).forEach((c) =>
    (c.faultPool || [c.fault]).forEach((f) => {
      if (f.screen && f.screen.broken) used.add(f.screen.broken);
      (f.faults || []).forEach((x) => x.screen && x.screen.broken && used.add(x.screen.broken));
    })
  );
  const src = read("js/hardware_lab_3d_laptop_screen.js");
  used.forEach((id) => assert.match(src, new RegExp('(^|\\n)  "?' + id.replace(/-/g, "\\-") + '"?: \\{'), "estado de pantalla sin definir: " + id));
  if (!S.error) {
    used.forEach((id) => assert.equal(S.screenModel(id).id, id));
    assert.equal(S.screenModel("no-post").powered, true);
    assert.equal(S.screenModel("no-post").image, false);
    assert.equal(S.screenModel("off").powered, false);
    assert.equal(S.screenModel("no-existe").id, "off");
    // Ninguna pantalla nombra la pieza responsable.
    S.SCREEN_STATE_IDS.forEach((id) => {
      const m = S.screenModel(id);
      assert.doesNotMatch([m.title, m.banner, (m.lines || []).join(" ")].join(" "), /\b(RAM|SSD|flex|antena|tarjeta|pasta|polvo)\b/i, id);
    });
  }
});

test("PT-2 el controlador enciende la pantalla al comprobar y la apaga cuando el aprendiz vuelve a trabajar", () => {
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /screen\.powerOn\(result\.screen\)\.then\(show\);/);
  assert.match(ctl, /stage\.cameraRig\.goToView\("front"\);/);
  assert.match(ctl, /onPoseStart: screenOff,/);
  assert.match(ctl, /function handlePartClick\(partId\) \{\s*\n\s*const part = getPart\(partId\);\s*\n\s*if \(!part\) return;\s*\n\s*screenOff\(\);/);
  assert.match(ctl, /if \(btn\) \{ btn\.onclick = checkPowerOn; btn\.disabled = checking; \}/);
  // Solo el portatil; el escritorio conserva su monitor externo.
  assert.match(ctl, /if \(equipmentId !== "laptop"\) return;\s*\n\s*const root = stage\.currentRig\.getObject3D\("screen-assembly"\);/);
});

// ── Evaluacion ──────────────────────────────────────────────────────────────
test("EV-1 banco de 6 escenarios independientes, sin pistas, fuera del menu de casos", () => {
  const sc = Cases.evaluationScenarios("laptop");
  same(sc.map((c) => c.id), ["eval-e1", "eval-e2", "eval-e3", "eval-e4", "eval-e5", "eval-e6"]);
  assert.equal(Cases.evaluationScenarios("desktop").length, 0, "la evaluacion del escritorio no cambia");
  const menu = Cases.casesFor("laptop").map((c) => c.id);
  sc.forEach((c) => {
    assert.ok(!menu.includes(c.id));
    assert.equal(c.evaluation, true);
    assert.equal(c.hints.length, 0);
    assert.ok(c.faultPool.length >= 2, c.id + ": al menos dos variantes");
    assert.equal(Cases.getCase("laptop", c.id), c);
    assert.doesNotMatch(c.symptom, /\b(ram|ssd|flex|antena|tarjeta|pasta|polvo|ventilador|bater[ií]a)\b/i, c.id + ": la orden de servicio no nombra la pieza");
    c.faultPool.forEach((f, i) => {
      const s = Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (i + 0.5) / c.faultPool.length });
      assert.equal(s.evaluation, true);
      assert.equal(s.hints.max, 0);
      assert.equal(Diag.useHint(s, c).ok, false);
      assert.ok(Diag.variantOf(c, s), "el repaso encuentra la variante");
    });
  });
  // Cubre los cuatro tipos de trabajo.
  const tipos = new Set();
  sc.forEach((c) => c.faultPool.forEach((f) => { Diag.conditionList(f.fixCondition).forEach((x) => tipos.add(x.type)); if (f.faults) tipos.add("doble"); }));
  ["reseated", "replaced", "thermalReady", "doble"].forEach((t) => assert.ok(tipos.has(t), t));
});

test("EV-2 rubrica 30/25/25/10 = 90: escenario resuelto limpio = 90/90 = 100 normalizado", () => {
  same(Diag.EVALUATION_MAX, { diagnostico: 30, procedimiento: 25, reparacion: 25, herramientas: 10 });
  const c = Cases.getCase("laptop", "eval-e1");
  let s = Diag.createDiagnosisSession(LAPTOP, c, { rng: () => 0, now: "2026-10-01T10:00:00.000Z" });
  s = close(put(take(open(s), "ram"), "ram"));
  const r = power(s);
  assert.equal(r.fixed, true);
  const res = finish(r.session);
  assert.equal(res.evaluation, true);
  same(Object.keys(res.breakdown), ["diagnostico", "procedimiento", "reparacion", "herramientas", "total"]);
  assert.equal(res.score, 90);
  assert.equal(res.status, "APROBADO");
  const doc = Att.buildAttemptDoc(Object.assign(Diag.serialize(Diag.finish(r.session, { equipmentData: LAPTOP, now: "2026-10-01T10:20:00.000Z" })), {}), { uid: "U", usernameKey: "ana", ficha: "3441939", equipo: "laptop", practica: "diagnosis-eval-e1", nonce: "abcd1234", origen: "new" });
  assert.equal(doc.actividad, "diagnostico");
  assert.equal(doc.modo, "evaluacion");
  assert.equal(doc.caso, "eval-e1");
  assert.equal(doc.rawScore, 90);
  assert.equal(doc.rawMaxScore, 90);
  assert.equal(doc.normalizedScore, 100);
  assert.equal(doc.estado, "APROBADO");
  assert.match(doc.attemptId, /^U__laptop__diagnosis-eval-e1__\d+__abcd1234$/);
});

test("EV-3 el documento del intento solo usa campos que las reglas actuales admiten", () => {
  const rules = read("firestore.rules");
  const allowed = rules.slice(rules.indexOf("function hwlabAttemptValid"), rules.indexOf("match /sena_portal_hwlab_attempts")).match(/'([A-Za-z]+)'/g).map((x) => x.replace(/'/g, ""));
  const c = Cases.getCase("laptop", "eval-e5");
  const s = Diag.createDiagnosisSession(LAPTOP, c, { rng: () => 0, now: "2026-10-01T10:00:00.000Z" });
  const done = Diag.serialize(Diag.finish(s, { equipmentData: LAPTOP, now: "2026-10-01T10:05:00.000Z" }));
  const doc = Att.buildAttemptDoc(done, { uid: "U", usernameKey: "ana", ficha: "3441939", equipo: "laptop", practica: "diagnosis-eval-e5", nonce: "abcd1234", origen: "new" });
  Object.keys(doc).forEach((k) => assert.ok(allowed.includes(k), "campo fuera de las reglas: " + k));
  assert.ok(allowed.includes("actividad") && /d\.actividad in \['ensamble', 'desensamble', 'mantenimiento', 'diagnostico'\]/.test(rules));
  assert.match(rules, /attemptId\.matches\('\^' \+ d\.uid \+ '__\(desktop\|laptop\)__\[a-z0-9-\]\+__/);
  assert.ok(doc.rawMaxScore <= 100 && doc.rawScore >= 0);
});

test("EV-4 entrega sin resolver: nota parcial por lo logrado, nunca aprobado sin reparar", () => {
  const c = Cases.getCase("laptop", "eval-e5");
  const i = c.faultPool.findIndex((f) => f.variantId === "laptop-case-10:screen-and-wifi");
  let s = Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (i + 0.5) / c.faultPool.length, now: "2026-10-01T10:00:00.000Z" });
  // Entrega inmediata, sin haber hecho nada: 0 puntos (no hay puntos "gratis").
  let res = finish(s);
  same([res.breakdown.diagnostico.value, res.breakdown.procedimiento.value, res.breakdown.reparacion.value, res.breakdown.herramientas.value], [0, 0, 0, 0]);
  assert.equal(res.score, 0);
  assert.equal(res.status, "POR MEJORAR");
  // Abrio de forma segura pero no corrigio nada: 40 % de procedimiento y herramientas.
  res = finish(open(s));
  same([res.breakdown.diagnostico.value, res.breakdown.procedimiento.value, res.breakdown.reparacion.value, res.breakdown.herramientas.value], [0, 10, 0, 4]);
  // Una de dos fallas corregida y el equipo armado, sin comprobar la segunda.
  s = close(put(take(open(s), "cable-screen-flex"), "cable-screen-flex"));
  const r = power(s);
  res = finish(r.session);
  assert.equal(res.faultsFixed, 1);
  same([res.breakdown.diagnostico.value, res.breakdown.procedimiento.value, res.breakdown.reparacion.value, res.breakdown.herramientas.value], [15, 19, 8, 8]);
  assert.equal(res.score, 50);
  assert.equal(res.status, "POR MEJORAR");
});

test("EV-5 la evaluacion penaliza cambiar componentes sanos y los errores de procedimiento", () => {
  const c = Cases.getCase("laptop", "eval-e2");
  const i = c.faultPool.findIndex((f) => f.variantId === "laptop-case-09:ram-damaged");
  let s = open(Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (i + 0.5) / c.faultPool.length, now: "2026-10-01T10:00:00.000Z" }));
  s = take(s, "ssd-m2");
  s = put(Diag.replacePart(LAPTOP, s, "ssd-m2").session, "ssd-m2");
  s = take(s, "ram");
  s = close(put(Diag.replacePart(LAPTOP, s, "ram").session, "ram"));
  const r = power(s);
  assert.equal(r.fixed, true);
  let res = finish(r.session);
  assert.equal(res.breakdown.diagnostico.value, 20, "30 - 10 por la sustitucion no justificada");
  assert.equal(res.breakdown.reparacion.value, 25);
  assert.equal(res.score, 80);
  // Procedimiento inseguro: tocar un componente con la bateria conectada.
  let u = take(Diag.createDiagnosisSession(LAPTOP, c, { rng: () => (i + 0.5) / c.faultPool.length }), "bottom-cover");
  const inseguro = act(u, "ram", "remove");
  assert.equal(inseguro.ok, false);
  assert.equal(inseguro.session.errorsByType.unsafe, 1);
  // (25 - 3) al cerrar el escenario resuelto; aqui, sin reparar ni abrir con seguridad, aun no cuenta.
  assert.equal(Diag.computeEvaluationBreakdown(LAPTOP, Object.assign({}, inseguro.session, { fixed: true })).procedimiento.value, 22);
});

test("EV-6 asignacion al azar persistente y arranque desde 'Evaluacion' solo en el portatil", () => {
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /const EVAL_ASSIGN_MODE = "evaluation-assignment";/);
  assert.match(ctl, /if \(saved\.current && all\.indexOf\(saved\.current\) !== -1\) return saved\.current;/, "recargar no cambia el escenario");
  assert.match(ctl, /let pool = all\.filter\(\(id\) => done\.indexOf\(id\) === -1\);/, "no repite hasta completar la vuelta");
  assert.match(ctl, /if \(wasEvaluation\) closeAssignedScenario\(caseDef\.id\);/);
  assert.match(ctl, /document\.getElementById\("hwlab-hint-btn"\)\.hidden = evaluationMode;/);
  assert.match(ctl, /document\.getElementById\("hwlab-restart-btn"\)\.hidden = evaluationMode;/);
  assert.match(ctl, /A\.recordFinished\(\{ session: done, equipo: equipmentId, practica: storageModeFor\(caseDef\.id\) \}\);/);
  const boot = read("js/hardware_lab_3d_bootstrap.js");
  assert.match(boot, /equipmentId === "laptop"\s*\n\s*\? \{ mode: "evaluation",[^\n]*serviceOrder: true \}\s*\n\s*: \{ mode: "evaluation",[^\n]*needsDirection: true \},/);
  assert.match(boot, /if \(opt\.serviceOrder\) \{[\s\S]{0,160}diagnosisController\.startEvaluation\(selectedEquipmentId\);/);
  // Los intentos de evaluacion del desensamble/ensamble anteriores siguen siendo validos en el seguimiento.
  same(Att.describePractice("disassembly-evaluation"), { actividad: "desensamble", modo: "evaluacion", caso: null });
  same(Att.describePractice("diagnosis-eval-e3"), { actividad: "diagnostico", modo: "evaluacion", caso: "eval-e3" });
  same(Att.describePractice("diagnosis-laptop-case-09"), { actividad: "diagnostico", modo: "diagnostico", caso: "laptop-case-09" });
});
