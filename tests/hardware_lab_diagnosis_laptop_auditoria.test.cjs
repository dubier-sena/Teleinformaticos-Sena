"use strict";
// Auditoria final del diagnostico del portatil (sep-28): decisiones D2 (la
// inspeccion no penaliza; la manipulacion innecesaria y lo inseguro si), D4
// (la traza no cambia la nota), D6 (ortografia visible sin tocar claves), la
// estrategia "mantenimiento completo" del caso 07 y el defecto real hallado:
// la vista explotada borraba el desplazamiento de la pieza mal asentada.
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
const LAPTOP = H.DataLaptop.LAPTOP_EQUIPMENT;
const Cases = H.DiagnosisCases;
const C7 = Cases.getCase("laptop", "laptop-case-07");
const C8 = Cases.getCase("laptop", "laptop-case-08");

function sessionFor(caseDef, variantId) {
  if (!caseDef.faultPool) return Diag.createDiagnosisSession(LAPTOP, caseDef);
  const i = caseDef.faultPool.findIndex((f) => f.variantId === variantId);
  assert.ok(i >= 0, variantId);
  return Diag.createDiagnosisSession(LAPTOP, caseDef, { rng: () => (i + 0.5) / caseDef.faultPool.length });
}
function act(s, partId, action) {
  const r = Diag.attemptAction(LAPTOP, s, { partId, action, toolId: LAPTOP.parts[partId].tool || "hands" });
  assert.equal(r.ok, true, partId + " " + action + ": " + r.message);
  return r.session;
}
const check = (s) => Diag.checkPowerOn(LAPTOP, s, { screwsSecured: true });
const open = (s) => act(act(s, "bottom-cover", "remove"), "cable-battery", "disconnect");
const close = (s) => act(act(s, "cable-battery", "connect"), "bottom-cover", "install");
const fixRam = (s) => act(act(s, "ram", "remove"), "ram", "install");
const score = (s) => Diag.finish(check(s).session).result;

// ── D2 ───────────────────────────────────────────────────────────────────────
test("D2. inspeccionar (encender y comprobar, pistas aparte) no resta; solo cuenta intentos", () => {
  const c1 = Cases.getCase("laptop", "laptop-case-01");
  let a = sessionFor(c1);
  let b = sessionFor(c1);
  for (let k = 0; k < 6; k++) b = check(b).session; // comprobar varias veces = observar
  a = close(fixRam(open(a)));
  b = close(fixRam(open(b)));
  const ra = score(a), rb = score(b);
  assert.equal(rb.score, ra.score, "comprobar varias veces no cambia la nota");
  assert.equal(ra.score, 100);
  assert.ok(check(b).session.checkAttempts > check(a).session.checkAttempts);
  // Las acciones de inspeccion del 3D (vistas, puntero, posicion, vista explotada)
  // no pasan por el motor: el controlador solo llama a attemptAction al MANIPULAR.
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.equal((ctl.match(/Engine\(\)\.attemptAction\(/g) || []).length, 1, "un unico punto de manipulacion (clic en pieza)");
  assert.match(ctl, /document\.getElementById\("hwlab-explode-btn"\)\.onclick = \(\) => stage\.toggleExplode\(\);/);
});

test("D2. manipular otro subsistema sin necesidad resta Eficiencia (-2 por pieza); lo inseguro, Procedimiento (-3)", () => {
  const c1 = Cases.getCase("laptop", "laptop-case-01");
  let s = open(sessionFor(c1));
  s = act(act(s, "ssd-m2", "remove"), "ssd-m2", "install"); // hipotesis descartada: manipulacion
  s = act(act(s, "ssd-m2", "remove"), "ssd-m2", "install"); // repetirla no suma otra vez
  const r = score(close(fixRam(s)));
  assert.equal(r.breakdown.eficiencia.value, 8);
  assert.equal(r.unnecessaryParts, 1);
  // Inseguro: la misma pieza con la bateria conectada.
  let u = act(sessionFor(c1), "bottom-cover", "remove");
  const bad = Diag.attemptAction(LAPTOP, u, { partId: "ram", action: "remove", toolId: "hands" });
  assert.equal(bad.ok, false);
  u = act(bad.session, "cable-battery", "disconnect");
  const ru = score(close(fixRam(u)));
  assert.equal(ru.breakdown.procedimiento.value, 22);
  assert.equal(ru.breakdown.eficiencia.value, 10, "el intento inseguro no cuenta ademas como pieza innecesaria");
});

test("D2. acceso seguro (tapa y bateria) nunca cuenta como innecesario en ninguna condicion del 08", () => {
  C8.faultPool.forEach((f) => {
    ["bottom-cover", "cable-battery"].forEach((id) => assert.ok(f.relevantPartIds.indexOf(id) !== -1, f.variantId + " " + id));
  });
});

// ── D4 + punto 6: estrategias del caso 07 ────────────────────────────────────
function thermalRun(caseDef, variantId, full) {
  let s = open(sessionFor(caseDef, variantId));
  const v = variantId.split(":").pop();
  const T = (t, amount) => (s = Diag.applyThermalTask(LAPTOP, s, t, { amount }).session);
  if (!full && v === "fan-cable") {
    s = act(act(s, "cable-cpu-fan-laptop", "disconnect"), "cable-cpu-fan-laptop", "connect");
  } else {
    s = act(act(s, "cable-cpu-fan-laptop", "disconnect"), "cooler", "remove");
    if (full || v === "dust") { T("brush"); T("air"); }
    if (full || v === "paste") { T("scrape"); T("alcohol"); T("apply", "adecuada"); }
    s = act(act(s, "cooler", "install"), "cable-cpu-fan-laptop", "connect");
  }
  s = close(s);
  const r = check(s);
  return { fixed: r.fixed, result: Diag.finish(r.session).result, trace: Diag.diagnosisTrace(LAPTOP, r.session) };
}
for (const caseDef of [C7, C8]) {
  for (const v of ["dust", "paste", "fan-cable"]) {
    const id = caseDef === C8 ? "laptop-case-07:" + v : v;
    test(`07-${caseDef.number}/${v}. dirigido y mantenimiento completo reparan; solo la traza los distingue (la nota NO)`, () => {
      const a = thermalRun(caseDef, id, false);
      const b = thermalRun(caseDef, id, true);
      assert.equal(a.fixed, true);
      assert.equal(b.fixed, true);
      assert.equal(a.trace.identifiedBeforeRepair, true);
      assert.equal(b.trace.repairedWithoutDiagnosis, true);
      assert.equal(b.result.score, a.result.score, "D4: la traza no cambia la nota (hoy: misma nota)");
      assert.ok(b.trace.extraThermalTasks.length > 0);
    });
  }
}

// ── Defecto real: vista explotada ────────────────────────────────────────────
test("AF-1. la vista explotada parte de la pose 'mal asentada' y vuelve a ella; reasentar o sincronizar la anula", () => {
  const rig = read("js/hardware_lab_3d_rig.js");
  assert.match(rig, /entry\.restOffset = entry\.detachAxis\.clone\(\)\.multiplyScalar\(distance > 0 \? distance : 0\);/);
  assert.match(rig, /homePosition: entry\.restOffset \? entry\.homePosition\.clone\(\)\.add\(entry\.restOffset\) : entry\.homePosition/);
  // Se anula al retirar/reinstalar la pieza (setPresence) y al sincronizar con la sesion.
  assert.equal((rig.match(/entry\.restOffset = null;/g) || []).length, 2);
  const setPresence = rig.match(/function setPresence\(partId, present, opts = \{\}\) \{[\s\S]*?entry\.restOffset = null;/);
  assert.ok(setPresence, "setPresence reasienta");
  // homeOffset sigue midiendo contra la pose NOMINAL (no contra la de reposo).
  assert.match(rig, /entry\.object3d\.position\.distanceTo\(entry\.homePosition\)/);
});

// ── D6: ortografia visible, claves intactas ─────────────────────────────────
test("D6. textos visibles con tildes; ids, claves y categorias sin cambios", () => {
  const tools = read("js/hardware_lab_tools.js");
  ["Pasta térmica", "Alcohol isopropílico", "Brocha antiestática", "Pulsera antiestática", "Herramienta plástica de apertura"].forEach((t) => assert.ok(tools.includes('name: "' + t + '"'), t));
  ["thermal-paste", "isopropyl-alcohol", "antistatic-brush", "antistatic-strap", "spudger"].forEach((id) => assert.ok(tools.includes('id: "' + id + '"'), id));
  const thermal = read("js/hardware_lab_thermal.js");
  assert.match(thermal, /label: "Aplicar pasta térmica nueva"/);
  assert.match(thermal, /label: "Limpiar con alcohol isopropílico"/);
  assert.match(thermal, /tool: "isopropyl-alcohol",/);
  const ctl = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(ctl, /"muy-facil": "Muy fácil",/, "la clave del nivel no cambia; solo su texto");
  assert.match(ctl, /"facil-intermedio": "Fácil-intermedio",/);
  ["Diagnóstico - Caso ", "Qué estaba pasando", "Por qué ocurría", "Cómo diagnosticarlo", "Cómo se soluciona", "Procedimiento óptimo", "Síntoma reportado", "Monitor de diagnóstico"].forEach((t) => assert.ok(ctl.includes(t), t));
  const data = read("js/hardware_lab_data_laptop.js");
  assert.match(data, /name: "Módulo de refrigeración \(heatpipe \+ ventilador\)",\s*category: "refrigeracion",/, "la categoria (clave) no cambia");
  assert.doesNotMatch(data, /varios anos de uso/);
  const boot = read("js/hardware_lab_3d_bootstrap.js");
  assert.match(boot, /"8 casos de diagnóstico: fallas reales y una falla desconocida\."/);
  assert.match(boot, /available: equipmentId === "desktop" \|\| equipmentId === "laptop",/, "habilitado para escritorio y portatil");
  // Ningun texto visible del modulo termico queda sin tilde.
  const literals = (src) => src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).flatMap((l) => [...l.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]));
  const sinTilde = literals(tools + "\n" + thermal).filter((t) => /\b(termica|termico|isopropilico|antiestatica|plastica)\b/i.test(t));
  assert.deepEqual(sinTilde, [], "textos visibles sin tilde: " + sinTilde.join(" | "));
});

// ── Release 20260928_1: habilitacion y versionado ───────────────────────────
test("REL-1. diagnostico habilitado SOLO para escritorio y portatil; 8 casos del portatil y 10 del escritorio", () => {
  const boot = read("js/hardware_lab_3d_bootstrap.js");
  const equipos = [...boot.matchAll(/\{ id: "([a-z]+)", icon: ICONS\.[a-z]+, title:/g)].map((m) => m[1]);
  assert.deepEqual(equipos, ["desktop", "laptop"], "ningun otro equipo");
  assert.match(boot, /available: equipmentId === "desktop" \|\| equipmentId === "laptop",/);
  assert.doesNotMatch(boot, /mode: "diagnosis",[\s\S]{0,400}available: true/, "sin habilitacion generica");
  assert.equal(Cases.casesFor("laptop").length, 8);
  assert.equal(Cases.casesFor("desktop").length, 10);
  // La entrada al diagnostico pasa el equipo elegido al menu de casos.
  assert.match(boot, /diagnosisController\.showCaseMenu\(selectedEquipmentId\)/);
});

test("REL-2. cache-bust: TODOS los imports internos de los modulos 3D llevan la misma version de release; vendor sin version", () => {
  const dir = path.join(ROOT, "js");
  const files = fs.readdirSync(dir).filter((f) => /^hardware_lab_3d_.*\.js$/.test(f));
  const versions = new Set();
  let count = 0;
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/(?:from|import)\s+"\.\/(hardware_lab_3d_[a-z0-9_]+\.js)([^"]*)"/g)) {
      count++;
      assert.match(m[2], /^\?v=\d{8}_\d+$/, `${f} importa ${m[1]} sin version`);
      versions.add(m[2]);
      assert.ok(fs.existsSync(path.join(dir, m[1])), m[1]);
    }
    for (const m of src.matchAll(/(?:from|import)\s+"\.\/vendor\/([^"]+)"/g)) assert.doesNotMatch(m[1], /\?/, "vendor sin query: una sola instancia de three");
  });
  assert.ok(count >= 40);
  assert.equal(versions.size, 1, "una sola version para todo el grafo: " + [...versions].join(","));
  const v = [...versions][0];
  const html = read("laboratorio-virtual-hardware.html");
  assert.ok(html.includes('src="js/hardware_lab_3d_bootstrap.js' + v + '"'), "el punto de entrada usa la misma version");
  ["css/page_hardware_lab.css", "js/hardware_lab_tools.js", "js/hardware_lab_data_laptop.js", "js/hardware_lab_thermal.js", "js/hardware_lab_diagnosis_engine.js", "js/hardware_lab_diagnosis_cases.js"].forEach((r) =>
    assert.ok(html.includes(r + v), r + " con la version del release"));
  const panel = read("panel-administrativo-usuarios.html");
  ["js/hardware_lab_diagnosis_cases.js", "js/admin_hardware_lab.js"].forEach((r) => assert.ok(panel.includes(r + v), "panel: " + r));
});
