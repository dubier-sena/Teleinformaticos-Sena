"use strict";
// EMERGENCIA fase 3 (2026-11-08) — cuatro correctivos de Codex para las Guias 9/10/11
// de Redes de grado 11 (familias guia-redes11-rap01/02/03):
//  1. aprobar NO genera/completa/sustituye respuestas del aprendiz (todas las rutas);
//  2. aprobar NO registra entregas (status "delivered") inexistentes;
//  3. importacion del banco: respaldo, diferencias campo a campo, sin borrar, escritura
//     condicionada a la version leida y bloqueo ante conflictos;
//  4. el RAP solo es APROBADO con todas las evidencias oficiales entregadas Y aprobadas.
// Todas las pruebas son SIMULADAS (vm/sandbox): no tocan Firebase, Drive ni cuentas reales.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));
const STRICT = ["guia-redes11-rap01", "guia-redes11-rap02", "guia-redes11-rap03"];

function extractFn(src, signature) {
  const i = src.indexOf(signature);
  assert.ok(i >= 0, signature);
  let depth = 0;
  for (let j = src.indexOf("{", i); j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error("sin cierre " + signature);
}

// activity_grades.js en una VM con sesion de aprendiz y almacenamiento local en memoria.
function loadGrades(gradesForUser) {
  const store = {};
  const ctx = {
    console, URL,
    document: { querySelector: () => null, querySelectorAll: () => { ctx.__domQueries++; return []; }, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    __domQueries: 0,
  };
  ctx.window = { location: { href: "https://x/" } };
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "aprendiz_prueba" }),
    getStudentStorageKey: (u, k) => `sena_portal:student:${u}:app:${k}`,
  };
  vm.createContext(ctx);
  vm.runInContext(read("js/activity_grades.js"), ctx);
  const mgr = ctx.window.activityGradesManager;
  if (gradesForUser) store[ctx.window.portalAuth.getStudentStorageKey("aprendiz_prueba", "grades")] = JSON.stringify(gradesForUser);
  return { mgr, ctx, store };
}

function loadDeclarations() {
  const guides = [];
  const w = { ActivityStandard: { registerGuide: (c) => guides.push(c) } };
  new Function("window", "ActivityStandard", read("js/guide_declarations.js"))(w, w.ActivityStandard);
  const byFile = {};
  guides.forEach((g) => (g.files || []).forEach((f) => { byFile[f] = g; }));
  return byFile;
}

// ── 1. Respuestas ficticias ───────────────────────────────────────────────────
test("1. formulario vacio + aprobacion: la guia NO rellena campos, ni con soluciones ya embebidas", () => {
  for (const fam of STRICT) {
    const { mgr, ctx } = loadGrades({ [fam]: { actX: "A", "actX:solution": { campo: "respuesta modelo" } } });
    assert.equal(mgr.isEvidenceStrictFamily(fam), true);
    assert.equal(mgr.applyApprovedSolutionsForFamily(fam), false, fam);
    assert.equal(ctx.__domQueries, 0, `${fam}: ni siquiera busca campos para rellenar`);
  }
  // otras familias conservan su comportamiento (si buscan campos)
  const { mgr, ctx } = loadGrades({ "guia-02-herramientas": { a: "A", "a:solution": { k: "v" } } });
  mgr.applyApprovedSolutionsForFamily("guia-02-herramientas");
  assert.ok(ctx.__domQueries > 0, "familias no estrictas sin cambios");
});

test("1. calificacion individual, Excel y re-sincronizacion no obtienen ni embeben soluciones", () => {
  const admin = read("js/admin_usuarios.js");
  const ctx = {
    _gradeSolutionsBank: { "guia-redes11-rap02": { c11Taller331: { g11c_331_e1_cidr: "/25" } }, "guia-02-herramientas": { a: { k: "v" } } },
    getGradeCatalog: () => ({}),
    window: { activityGradesManager: { isEvidenceStrictFamily: (f) => /^guia-redes11-rap0[123]$/.test(f) } },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn(admin, "function isEvidenceStrictFamily(") + extractFn(admin, "function lookupBankSolution(") + ";this.l=lookupBankSolution;", ctx);
  for (const fam of STRICT) assert.equal(ctx.l(fam, "c11Taller331"), null, fam);
  assert.deepEqual(plain(ctx.l("guia-02-herramientas", "a")), { k: "v" }, "otras familias conservan el banco");
  // las 3 rutas (individual 3692, Excel, resync) pasan por lookupBankSolution / applyApprovedSolutionToStudentCloud
  assert.match(extractFn(admin, "async function applyApprovedSolutionToStudentCloud("), /if \(isEvidenceStrictFamily\(guideFamily\)\) return \{ filled: 0 \};/);
  const { mgr } = loadGrades({ "guia-redes11-rap01": { b11TallerIP334: "A" } });
  assert.equal(mgr.embedStudentActivitySolution("aprendiz_prueba", "guia-redes11-rap01", "b11TallerIP334", { x: "y" }), false, "resync no embebe");
  assert.match(extractFn(read("js/activity_grades.js"), "function setStudentActivityGradeAndSolution("), /if \(isEvidenceStrictFamily\(guideFamily\)\) \{\s*\/\/ Fase 3: nunca se embebe solucion; tampoco se borra nada historico\.\s*\} else if/);
});

test("1. el servidor de datos rechaza escribir respuestas modelo en las 3 guias de 11.°", async () => {
  const db = read("js/firebase_db.js");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(extractFn(db, "function isEvidenceStrictGuideFile(") + ";this.f=isEvidenceStrictGuideFile;", ctx);
  for (const f of ["grupo-11a-guia-09-redes-rap01.html", "grupo-11b-guia-10-redes-rap02.html", "grupo-11a-guia-11-redes-rap03.html"]) assert.equal(ctx.f(f), true, f);
  for (const f of ["santa-barbara-10a-guia-03-redes-rap02.html", "grupo-10a-guia-12-redes-rap03.html", "grupo-11a-guia-08-documentar-gestion-informacion.html"]) assert.equal(ctx.f(f), false, f);
  assert.match(extractFn(db, "async function adminApplySolutionToGuide("), /if \(isEvidenceStrictGuideFile\(fileName\)\) return \{ ok: true, filled: 0, skipped: "evidence-strict" \};/);
});

// ── 2. Entregas ficticias ─────────────────────────────────────────────────────
test("2. aprobacion sin entrega: la guia NO crea status delivered ni da por enviado un formulario", async () => {
  const decl = loadDeclarations();
  for (const [fam, file] of [["guia-redes11-rap01", "grupo-11a-guia-09-redes-rap01.html"], ["guia-redes11-rap02", "grupo-11a-guia-10-redes-rap02.html"], ["guia-redes11-rap03", "grupo-11a-guia-11-redes-rap03.html"]]) {
    const all = {};
    decl[file].activities.forEach((a) => { all[a.id] = "A"; });
    const { mgr, ctx } = loadGrades({ [fam]: all });
    ctx.window.ActivityStandard = { getConfigForGuide: () => decl[file] };
    const state = {};
    let changed = false;
    await mgr.reflectGradesIntoGuideState({ guideFamily: fam, pageFile: file, getState: () => state, onChanged: () => { changed = true; } });
    assert.deepEqual(plain(state), {}, `${fam}: el estado de la guia no cambia por aprobar`);
    assert.equal(changed, false);
  }
  // grado 10 conserva el comportamiento historico (registra la entrega del laboratorio aprobado)
  const decl10 = decl["santa-barbara-10a-guia-03-redes-rap02.html"];
  const { mgr, ctx } = loadGrades({ "guia-redes-rap02": { laboratorio341: "A" } });
  ctx.window.ActivityStandard = { getConfigForGuide: () => decl10 };
  const st = {};
  await mgr.reflectGradesIntoGuideState({ guideFamily: "guia-redes-rap02", pageFile: "santa-barbara-10a-guia-03-redes-rap02.html", getState: () => st });
  assert.equal(st["laboratorio341-delivery"].status, "delivered");
});

test("2. el panel y el servidor de datos no registran entregas por aprobar (individual y Excel)", () => {
  const admin = read("js/admin_usuarios.js");
  assert.match(extractFn(admin, "async function applyDeliveryFallbackToStudentCloud("), /if \(isEvidenceStrictFamily\(guideFamily\)\) return \{ filled: 0 \};/);
  assert.match(extractFn(read("js/firebase_db.js"), "async function adminMarkActivityDelivered("), /if \(isEvidenceStrictGuideFile\(fileName\)\) return \{ ok: true, filled: 0, skipped: "evidence-strict" \};/);
  // la funcion de entrega real exige archivo/enlace y excluye las creadas por aprobacion
  const { mgr } = loadGrades();
  assert.equal(mgr.hasRealFileDelivery({ "x-delivery": { status: "delivered", submittedAt: "2026-11-08", registeredBy: "admin-grade-approval" } }, "x"), false);
  assert.equal(mgr.hasRealFileDelivery({ "x-delivery": { status: "delivered", submittedAt: "2026-11-08" } }, "x"), false, "sin archivo no es entrega");
  assert.equal(mgr.hasRealFileDelivery({ "x-delivery": { status: "delivered", savedFileName: "Lab.pkt", driveUrl: "https://drive.google.com/file/d/1/view" } }, "x"), true);
});

// ── 4. Aprobacion academica ───────────────────────────────────────────────────
// Estado con entregas AUTENTICAS: formularios enviados por el aprendiz (con sello de
// procedencia del flujo legitimo, fase 3c) y archivos reales.
function fullEvidenceState(acts, req, mgr) {
  const st = {};
  req.forEach((id) => {
    const a = acts.find((x) => x.id === id);
    if (a.type === "form" || a.type === "both") {
      st[id + "-locked"] = true; a.formFields.forEach((k) => { st[k] = "respuesta del aprendiz"; });
      st[id + "-submission"] = plain(mgr.buildStudentSubmissionRecord(st, a, "aprendiz_prueba"));
    }
    if (a.type === "file" || a.type === "both") st[id + "-delivery"] = { status: "delivered", savedFileName: id + ".pdf", driveUrl: "https://drive.google.com/file/d/x/view" };
  });
  return st;
}
const GUIDE_FILES = [["guia-redes11-rap01", "grupo-11a-guia-09-redes-rap01.html"], ["guia-redes11-rap02", "grupo-11a-guia-10-redes-rap02.html"], ["guia-redes11-rap03", "grupo-11a-guia-11-redes-rap03.html"]];

test("4. RAP APROBADO solo con TODAS las evidencias oficiales completas (todas sus partes) y aprobadas", () => {
  const decl = loadDeclarations();
  const { mgr } = loadGrades();
  for (const [fam, file] of GUIDE_FILES) {
    const acts = decl[file].activities;
    const req = mgr.REQUIRED_EVIDENCE[fam];
    req.forEach((id) => assert.ok(acts.some((a) => a.id === id), `${fam}: ${id} no existe`));
    const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
    assert.equal(mgr.evaluateRapStatus(fam, allA, {}, acts).status, "pendiente", `${fam}: calificacion manual sin evidencia = pendiente`);
    assert.equal(mgr.evaluateRapStatus(fam, allA, null, acts).status, "por-verificar", "estado no leido nunca es aprobado");
    const st = fullEvidenceState(acts, req, mgr);
    assert.equal(mgr.evaluateRapStatus(fam, allA, st, acts).status, "aprobado", `${fam}: ambas partes + aprobado = completo`);
    const formativas = acts.filter((a) => req.indexOf(a.id) === -1).map((a) => a.id);
    const soloOficiales = Object.assign({}, allA); formativas.forEach((id) => { delete soloOficiales[id]; });
    assert.equal(mgr.evaluateRapStatus(fam, soloOficiales, st, acts).status, "aprobado", "formativas no condicionan");
    assert.equal(mgr.evaluateRapStatus(fam, Object.assign({}, allA, { [req[0]]: "D" }), st, acts).status, "pendiente");
  }
});

test("4. actividades 'both': archivo + formulario vacio, formulario sin archivo, o solo guardado = RAP pendiente", () => {
  const decl = loadDeclarations();
  const { mgr } = loadGrades();
  let probadas = 0;
  for (const [fam, file] of GUIDE_FILES) {
    const acts = decl[file].activities;
    const req = mgr.REQUIRED_EVIDENCE[fam];
    const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
    for (const both of acts.filter((a) => a.type === "both" && req.indexOf(a.id) !== -1)) {
      probadas++;
      const base = fullEvidenceState(acts, req, mgr);
      // archivo entregado + formulario vacio
      const s1 = Object.assign({}, base); both.formFields.forEach((k) => { s1[k] = ""; });
      const r1 = mgr.evaluateRapStatus(fam, allA, s1, acts);
      assert.equal(r1.status, "pendiente", `${both.id}: archivo + formulario vacio`);
      assert.equal(r1.items.find((i) => i.id === both.id).delivered, false);
      // formulario completo + archivo faltante
      const s2 = Object.assign({}, base); delete s2[both.id + "-delivery"];
      assert.equal(mgr.evaluateRapStatus(fam, allA, s2, acts).status, "pendiente", `${both.id}: formulario sin archivo`);
      // formulario guardado (respuestas) pero sin enviar ni entrega formal
      const s3 = Object.assign({}, base); delete s3[both.id + "-delivery"]; delete s3[both.id + "-locked"];
      assert.equal(mgr.evaluateRapStatus(fam, allA, s3, acts).status, "pendiente", `${both.id}: solo guardado`);
    }
  }
  assert.ok(probadas >= 4, "taller IP y Lab 1 (RAP01), taller y lab (RAP02)");
});

test("4. evidencia historica de procedencia incierta = PENDIENTE DE VERIFICACION; el instructor la confirma sin crear entregas", async () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap02", file = "grupo-11a-guia-10-redes-rap02.html";
  const acts = decl[file].activities;
  const { mgr, store } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const st = fullEvidenceState(acts, req, mgr);
  // registro historico creado por la aprobacion (mecanismo anterior): sin archivo
  st["c11Lab341-delivery"] = { status: "delivered", submittedAt: "2026-11-07T12:00:00Z" };
  const r = mgr.evaluateRapStatus(fam, allA, st, acts);
  assert.equal(r.status, "pendiente-verificacion");
  assert.equal(r.items.find((i) => i.id === "c11Lab341").fileState, "uncertain");
  st["c11Exploracion325-delivery"] = { status: "delivered", registeredBy: "admin-grade-approval", submittedAt: "2026-11-07" };
  assert.equal(mgr.evaluateRapStatus(fam, allA, st, acts).toVerify, 2);
  // confirmacion del instructor: solo en las notas; el estado de la guia NO cambia
  const before = JSON.stringify(st);
  const doc = { at: "2026-11-08T10:00:00Z", by: "dubier", support: "Drive: archivo original revisado", result: "autentica" };
  const verified = Object.assign({}, allA, { "c11Lab341:verified": doc, "c11Exploracion325:verified": doc });
  assert.equal(mgr.evaluateRapStatus(fam, verified, st, acts).status, "aprobado");
  assert.equal(JSON.stringify(st), before, "verificar no crea ni modifica entregas");
  // la funcion de verificacion solo encola notas, solo en familias estrictas y solo con soporte
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", "guia-02-herramientas", "x", { support: "abc", result: "autentica", by: "d" })).reason, "not-strict-family");
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", fam, "c11Lab341", { result: "autentica", by: "d" })).reason, "missing-support", "sin soporte no registra");
  const src = read("js/activity_grades.js");
  const fn = extractFn(src, "function setStudentEvidenceVerification(");
  assert.match(fn, /set\[activityId \+ ":verified"\] = rec;/);
  assert.match(fn, /set\[activityId \+ ":verifyLog"\] = log;/);
  assert.doesNotMatch(fn, /-delivery|-locked|cloudSaveGuideData/);
  assert.ok(store);
});

test("4. el panel marca evidencia oficial vs formativa y calcula el RAP con entregas reales", () => {
  const admin = read("js/admin_usuarios.js");
  assert.match(admin, /&#9733; Evidencia oficial/);
  assert.match(admin, />Formativa<\/span>/);
  assert.match(admin, /gradesManager\.evaluateRapStatus\(guideFamily, g, guideStateByUser\[user\.usernameKey\], declaredActs\)/);
  assert.match(read("js/script_guia_redes11.js"), /mgr\.evaluateRapStatus\(family, grades, state, getConfig\(\)\.activities \|\| \[\]\)/);
});

// ── 3. Banco ──────────────────────────────────────────────────────────────────
function loadBankFns() {
  const admin = read("js/admin_usuarios.js");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([extractFn(admin, "function stableStringify("), extractFn(admin, "function diffGradeBanks("), extractFn(admin, "function mergeGradeBanksByField(")].join("\n")
    + ";this.d=diffGradeBanks;this.m=mergeGradeBanksByField;this.s=stableStringify;", ctx);
  return ctx;
}

test("3. banco: diferencias por familia/actividad/campo y fusion campo a campo que nunca borra", () => {
  const { d, m } = loadBankFns();
  const cloud = { famA: { a1: { k1: "v1", k2: "v2" }, a2: { z: "1" } }, famB: { b: { x: "1" } } };
  const file = { famA: { a1: { k1: "v1", k3: "nuevo" } }, famC: { c: { y: "2" } } };
  const diff = plain(d(cloud, file));
  assert.deepEqual(diff.addedFamilies, ["famC"]);
  assert.deepEqual(diff.addedFields.sort(), ["famA/a1/k3", "famC/c/y"]);
  assert.deepEqual(diff.modifiedFields, []);
  assert.equal(diff.unchangedFields, 1);
  assert.deepEqual(diff.keptOnlyInCloud.sort(), ["famA/a1/k2", "famA/a2/z", "famB/b/x"]);
  const merged = plain(m(cloud, file));
  assert.deepEqual(merged, { famA: { a1: { k1: "v1", k2: "v2", k3: "nuevo" }, a2: { z: "1" } }, famB: { b: { x: "1" } }, famC: { c: { y: "2" } } });
  // modificaciones = conflicto (y aun asi la fusion conserva el valor de la nube)
  const conf = plain(d({ f: { a: { k: "nube" } } }, { f: { a: { k: "archivo" } } }));
  assert.deepEqual(conf.modifiedFields, ["f/a/k"]);
  assert.equal(plain(m({ f: { a: { k: "nube" } } }, { f: { a: { k: "archivo" } } })).f.a.k, "nube");
});

async function loadBackupVerifier() {
  const admin = read("js/admin_usuarios.js");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext([extractFn(admin, "function stableStringify("), extractFn(admin, "async function verifyBankBackupText(")].join("\n") + ";this.v=verifyBankBackupText;this.s=stableStringify;", ctx);
  const hash = async (t) => require("node:crypto").createHash("sha256").update(t, "utf8").digest("hex");
  return { verify: (text, expected) => ctx.v(text, expected, hash), hash };
}

test("3. respaldo: solo se acepta el archivo EXACTO generado (cancelado, no seleccionado, corrupto, hash o version distintos = bloqueado)", async () => {
  const { verify, hash } = await loadBackupVerifier();
  const solutions = { famA: { a: { k: "v" } } };
  const text = JSON.stringify({ exportedAt: "2026-11-08T10:00:00Z", cloudUpdateTime: "T1", cloudStatus: "found", solutions }, null, 2);
  const expected = { hash: await hash(text), updateTime: "T1", solutions };
  assert.equal((await verify(text, expected)).ok, true, "respaldo correcto");
  assert.equal((await verify("", expected)).reason, "vacio", "descarga cancelada / archivo vacio");
  assert.equal((await verify(undefined, expected)).reason, "vacio", "respaldo no seleccionado");
  assert.equal((await verify(text.slice(0, 40), expected)).reason, "json-invalido", "archivo corrupto");
  assert.equal((await verify(text + "\n", expected)).reason, "sha256-distinto", "un byte distinto");
  const otro = JSON.stringify({ exportedAt: "x", cloudUpdateTime: "T1", cloudStatus: "found", solutions }, null, 2);
  assert.equal((await verify(otro, expected)).reason, "sha256-distinto", "otro respaldo");
  assert.equal((await verify(text, Object.assign({}, expected, { updateTime: "T2" }))).reason, "version-distinta");
  assert.equal((await verify(JSON.stringify({ solutions: 1 }), expected)).reason, "estructura-invalida");
});

test("3. banco: flujo bloqueado hasta verificar el respaldo; re-verifica la version antes de escribir; escritura condicionada", () => {
  const admin = read("js/admin_usuarios.js");
  const analyze = extractFn(admin, "async function handleGradeBankAnalyze(");
  const imp = extractFn(admin, "async function handleGradeBankImport(");
  const verifyH = extractFn(admin, "async function handleGradeBankVerifyBackup(");
  const backup = extractFn(admin, "async function handleGradeBankBackup(");
  assert.match(backup, /cloudGetGradeSolutionsVersioned\(\)/);
  assert.match(backup, /verified: false/);
  assert.match(verifyH, /byId\("grades-bank-backup-file"\)/);
  assert.match(verifyH, /verifyBankBackupText\(await file\.text\(\), _bankBackup, sha256Hex\)/);
  assert.match(analyze, /if \(!\(_bankBackup && _bankBackup\.verified\)\)/);
  assert.match(analyze, /\(now\.updateTime \|\| ""\) !== _bankBackup\.updateTime/);
  assert.match(analyze, /if \(diff\.modifiedFields\.length\) blocked = /);
  assert.match(imp, /if \(!plan \|\| !\(_bankBackup && _bankBackup\.verified\)\)/);
  assert.match(imp, /\(now\.updateTime \|\| ""\) !== plan\.updateTime/);
  assert.match(imp, /cloudSaveGradeSolutionsStrict\(plan\.merged, plan\.precondition\)/);
  assert.match(imp, /=== plan\.mergedHash/);
  assert.doesNotMatch(admin, /db\.cloudSaveGradeSolutions\(/);
  for (const id of ["grades-bank-verify-btn", "grades-bank-analyze-btn", "grades-bank-import-btn"]) {
    assert.match(admin, new RegExp(`id="${id}" class="btn secondary" disabled>`), `${id} deshabilitado por defecto`);
  }
  // no reemplaza funciones existentes del panel (una sola definicion por nombre)
  // y toda funcion que el flujo invoca existe (defecto real detectado en E2E: faltaba renderBankImportPreview)
  for (const name of ["renderBankImportPreview", "invalidateBank", "setBankButtons", "bankStatus", "handleGradeBankBackup", "handleGradeBankVerifyBackup"]) {
    assert.equal((admin.match(new RegExp(`function ${name}\\(`, "g")) || []).length, 1, `${name} definida una vez`);
  }
  for (const name of ["downloadTextFile", "stableStringify", "sha256Hex", "diffGradeBanks", "mergeGradeBanksByField", "verifyBankBackupText"]) {
    assert.equal((admin.match(new RegExp(`function ${name}\\(`, "g")) || []).length, 1, name);
  }
  const db = read("js/firebase_db.js");
  assert.match(extractFn(db, "async function cloudSaveGradeSolutionsStrict("), /missing-precondition/);
});

// Ensayo con el banco MAESTRO real (solo si esta disponible en este equipo; el banco
// esta en .gitignore y no existe en CI). Simula la nube con la base de 18 familias.
const MASTER = process.env.SENA_BANK_MASTER || "";
const BASE = process.env.SENA_BANK_BASE || "";
test("3. ensayo con el banco maestro: solo agrega las 3 familias de 11.°, sin conflictos ni perdidas", { skip: !(MASTER && BASE && fs.existsSync(MASTER) && fs.existsSync(BASE)) }, () => {
  const { d, m, s } = loadBankFns();
  const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
  const cloud = JSON.parse(fs.readFileSync(BASE, "utf8"));
  const diff = plain(d(cloud, master));
  assert.deepEqual(diff.addedFamilies.sort(), STRICT);
  assert.deepEqual(diff.modifiedFields, []);
  assert.deepEqual(diff.keptOnlyInCloud, []);
  const merged = m(cloud, master);
  assert.equal(s(merged), s(master), "el resultado es exactamente el banco maestro");
});

// ── Fase 3c (Codex): procedencia de formularios historicos ────────────────────
test("3c. REGRESION del fallo historico: respuestas del banco + bloqueo + nota A NO aprueban el RAP; solo la verificacion documentada", () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap03", file = "grupo-11a-guia-11-redes-rap03.html";
  const acts = decl[file].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  // 1. registro de la version anterior: todas las demas evidencias son autenticas
  const st = fullEvidenceState(acts, req, mgr);
  // 2-3. la version anterior copio respuestas MODELO del banco a un formulario oficial y lo bloqueo
  const bankLike = { "d11Reflexion311": "respuesta modelo del banco" };
  const refl = acts.find((a) => a.id === "d11Reflexion311");
  delete st["d11Reflexion311-submission"];
  refl.formFields.forEach((k) => { st[k] = bankLike.d11Reflexion311; });
  st["d11Reflexion311-locked"] = true;
  const notasAntes = {}; acts.forEach((a) => { notasAntes[a.id] = "A"; });       // 4. nota A en todo
  const grades = JSON.parse(JSON.stringify(notasAntes));
  const stateAntes = JSON.stringify(st);
  // 5-6. NO aprobado; PENDIENTE DE VERIFICACION
  const r = mgr.evaluateRapStatus(fam, grades, st, acts);
  assert.notEqual(r.status, "aprobado");
  assert.equal(r.status, "pendiente-verificacion");
  const it = r.items.find((i) => i.id === "d11Reflexion311");
  assert.equal(it.formState, "uncertain");
  assert.equal(it.delivered, false);
  // un "Verificar" sin soporte, o con resultado no autentico, no habilita nada
  for (const bad of [{ at: "x", by: "d", result: "autentica" }, { at: "x", by: "d", support: "ok soporte", result: "no-autentica" }, { at: "x", by: "d", support: "  ", result: "autentica" }]) {
    assert.equal(mgr.evaluateRapStatus(fam, Object.assign({}, grades, { "d11Reflexion311:verified": bad }), st, acts).status, "pendiente-verificacion", JSON.stringify(bad));
  }
  // 7-8. verificacion documentada con soporte autentico -> ahora si contribuye
  const doc = { at: "2026-11-09T08:00:00Z", by: "dubier", support: "Cuaderno del aprendiz revisado en clase 09/11", result: "autentica" };
  assert.equal(mgr.evaluateRapStatus(fam, Object.assign({}, grades, { "d11Reflexion311:verified": doc }), st, acts).status, "aprobado");
  // ...pero solo si todo lo demas tambien se cumple
  const sinLab = Object.assign({}, grades, { "d11Reflexion311:verified": doc, d11Protocolo341: "" });
  assert.equal(mgr.evaluateRapStatus(fam, sinLab, st, acts).status, "pendiente");
  // nada se modifica: notas, respuestas y archivos intactos
  assert.equal(JSON.stringify(st), stateAntes);
  assert.deepEqual(grades, notasAntes);
});

test("3c. sello de procedencia: entrega nueva autentica cuenta; respuestas cambiadas despues del sello o sello ajeno = incierto", () => {
  const decl = loadDeclarations();
  const acts = decl["grupo-11a-guia-09-redes-rap01.html"].activities;
  const { mgr } = loadGrades();
  const act = acts.find((a) => a.id === "b11Reflexion311");
  const st = { "b11Reflexion311-locked": true };
  act.formFields.forEach((k) => { st[k] = "mi respuesta"; });
  assert.equal(mgr.formEvidenceState(st, act), "uncertain", "completo+locked sin sello = incierto");
  st["b11Reflexion311-submission"] = plain(mgr.buildStudentSubmissionRecord(st, act, "aprendiz_prueba"));
  assert.equal(mgr.formEvidenceState(st, act), "real", "entrega nueva autentica");
  const alterado = Object.assign({}, st, { [act.formFields[0]]: "respuesta modelo del banco" });
  assert.equal(mgr.formEvidenceState(alterado, act), "uncertain", "respuestas cambiadas tras el sello");
  const ajeno = Object.assign({}, st, { "b11Reflexion311-submission": Object.assign({}, st["b11Reflexion311-submission"], { by: "admin" }) });
  assert.equal(mgr.formEvidenceState(ajeno, act), "uncertain");
  const sinEnviar = Object.assign({}, st, { "b11Reflexion311-locked": false });
  assert.equal(mgr.formEvidenceState(sinEnviar, act), "missing");
});

test("3c. el sello solo lo crea la guia en el flujo del aprendiz; ninguna ruta administrativa lo escribe", () => {
  const guide = read("js/script_guia_redes11.js");
  const stamp = extractFn(guide, "function stampStudentSubmission(");
  assert.match(stamp, /session\.role !== "student"/);
  assert.match(stamp, /_lockBeforeClick\[act\.id\] !== false \|\| state\[act\.id \+ "-locked"\] !== true/);
  assert.match(guide, /document\.addEventListener\("click", function \(event\) \{[\s\S]{0,300}_lockBeforeClick\[act\.id\] = state\[act\.id \+ "-locked"\] === true;\s*\}, true\);/);
  for (const f of ["js/admin_usuarios.js", "js/firebase_db.js", "js/activity_standard.js"]) {
    assert.doesNotMatch(read(f), /-submission"\]\s*=|buildStudentSubmissionRecord\(/, `${f} no crea sellos`);
  }
  // el panel exige soporte y resultado; registra instructor, fecha, soporte, resultado y bitacora
  const admin = read("js/admin_usuarios.js");
  const conf = extractFn(admin, "async function confirmEvidenceVerification(");
  assert.match(conf, /if \(support\.length < 3 \|\| !result\)/);
  assert.match(conf, /setStudentEvidenceVerification\(ctx\.user\.usernameKey, ctx\.family, ctx\.item\.id, \{ support, result, note, by,/);
  assert.match(extractFn(admin, "function handleEvidenceVerification("), /Respuesta registrada/);
  // grado 10 sin cambios en su evaluacion
  const { mgr } = loadGrades();
  assert.equal(mgr.evaluateRapStatus("guia-redes-rap01", {}, {}, []), null);
});
