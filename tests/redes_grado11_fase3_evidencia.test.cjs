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
    if (a.type === "file" || a.type === "both") { const fid = "1DriveFileId_" + id; st[id + "-delivery"] = { status: "delivered", savedFileName: id + ".pdf", fileId: fid, driveUrl: "https://drive.google.com/file/d/" + fid + "/view" }; }
  });
  return st;
}
const GUIDE_FILES = [["guia-redes11-rap01", "grupo-11a-guia-09-redes-rap01.html"], ["guia-redes11-rap02", "grupo-11a-guia-10-redes-rap02.html"], ["guia-redes11-rap03", "grupo-11a-guia-11-redes-rap03.html"]];

// Verificacion documentada del instructor de la VERSION ACTUAL de cada evidencia (fase 3d).
// Identidad del aprendiz consultado (fase 3e).
// Fase 3f: en las pruebas se INYECTAN fuentes confiables simuladas (UID atestado y
// lectura autenticada de Drive) para comprobar la logica; en el portal real no existen
// todavia y los llamadores no las pasan (todo queda pendiente).
const SUBJ = { usernameKey: "aprendiz_prueba", ficha: "3168850", uid: "uid-aprendiz-1", identityVerified: true };
const TRUSTED = { driveFiles: new Proxy({}, { get: (_t, fid) => (typeof fid === "string" && fid.indexOf("1DriveFileId_") === 0 ? { revisionId: "rev-1-" + fid, sha256: "a".repeat(64) } : undefined) }) };
function verifyAll(mgr, acts, ids, st, grades, fam) {
  const family = fam || Object.keys(mgr.REQUIRED_EVIDENCE).find((f) => mgr.REQUIRED_EVIDENCE[f].indexOf(ids[0]) !== -1);
  const out = Object.assign({}, grades);
  ids.forEach((id) => {
    const a = acts.find((x) => x.id === id);
    const needsFile = a.type === "file" || a.type === "both";
    const fid = needsFile ? mgr.driveFileIdentity(st, id) : "";
    const drive = fid ? TRUSTED.driveFiles[fid] : null;
    out[id + ":verified"] = { at: "2026-11-09T08:00:00Z", by: "dubier", support: "Soporte autentico revisado: " + id, result: "autentica",
      usernameKey: SUBJ.usernameKey, ficha: SUBJ.ficha, uid: SUBJ.uid, family, activityId: id,
      reviewedVersion: mgr.evidenceVersion(st, a), reviewedFileId: fid,
      reviewedDriveRevisionId: drive ? drive.revisionId : "", reviewedDriveSha256: drive ? drive.sha256 : "" };
  });
  return out;
}

test("4. RAP APROBADO solo con TODAS las evidencias oficiales completas, verificadas (version vigente) y aprobadas", () => {
  const decl = loadDeclarations();
  const { mgr } = loadGrades();
  for (const [fam, file] of GUIDE_FILES) {
    const acts = decl[file].activities;
    const req = mgr.REQUIRED_EVIDENCE[fam];
    req.forEach((id) => assert.ok(acts.some((a) => a.id === id), `${fam}: ${id} no existe`));
    const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
    assert.equal(mgr.evaluateRapStatus(fam, allA, {}, acts, SUBJ, TRUSTED).status, "pendiente", `${fam}: calificacion manual sin evidencia = pendiente`);
    assert.equal(mgr.evaluateRapStatus(fam, allA, null, acts, SUBJ, TRUSTED).status, "por-verificar", "estado no leido nunca es aprobado");
    const st = fullEvidenceState(acts, req, mgr);
    assert.equal(mgr.evaluateRapStatus(fam, allA, st, acts, SUBJ, TRUSTED).status, "pendiente-verificacion", `${fam}: completo sin verificacion del instructor = pendiente de verificacion`);
    const ok = verifyAll(mgr, acts, req, st, allA);
    assert.equal(mgr.evaluateRapStatus(fam, ok, st, acts, SUBJ, TRUSTED).status, "aprobado", `${fam}: completo + verificado + aprobado`);
    const formativas = acts.filter((a) => req.indexOf(a.id) === -1).map((a) => a.id);
    const soloOficiales = Object.assign({}, ok); formativas.forEach((id) => { delete soloOficiales[id]; });
    assert.equal(mgr.evaluateRapStatus(fam, soloOficiales, st, acts, SUBJ, TRUSTED).status, "aprobado", "formativas no condicionan");
    assert.notEqual(mgr.evaluateRapStatus(fam, Object.assign({}, ok, { [req[0]]: "D" }), st, acts, SUBJ, TRUSTED).status, "aprobado");
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
      const r1 = mgr.evaluateRapStatus(fam, allA, s1, acts, SUBJ, TRUSTED);
      assert.equal(r1.status, "pendiente", `${both.id}: archivo + formulario vacio`);
      assert.equal(r1.items.find((i) => i.id === both.id).delivered, false);
      // formulario completo + archivo faltante
      const s2 = Object.assign({}, base); delete s2[both.id + "-delivery"];
      assert.equal(mgr.evaluateRapStatus(fam, allA, s2, acts, SUBJ, TRUSTED).status, "pendiente", `${both.id}: formulario sin archivo`);
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
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const st = fullEvidenceState(acts, req, mgr);
  st["c11Lab341-delivery"] = { status: "delivered", submittedAt: "2026-11-07T12:00:00Z" };   // historico: sin archivo
  const r = mgr.evaluateRapStatus(fam, allA, st, acts, SUBJ, TRUSTED);
  assert.equal(r.status, "pendiente-verificacion");
  assert.equal(r.items.find((i) => i.id === "c11Lab341").fileState, "uncertain");
  const before = JSON.stringify(st);
  // Fase 3e: un registro historico SIN ID real de Drive no se puede vincular a ningun
  // archivo: aunque el instructor registre una revision, sigue sin verificarse (limitacion
  // explicita; hace falta una entrega real con fileId). El resto si se puede verificar.
  const conRev = verifyAll(mgr, acts, req, st, allA, fam);
  const r2 = mgr.evaluateRapStatus(fam, conRev, st, acts, SUBJ, TRUSTED);
  assert.notEqual(r2.status, "aprobado");
  assert.equal(r2.items.find((i) => i.id === "c11Lab341").verified, false);
  assert.equal(r2.items.filter((i) => i.verified).length, req.length - 1);
  // con una entrega real (fileId de Drive) y su revision, si cuenta
  const st2 = fullEvidenceState(acts, req, mgr);
  assert.equal(mgr.evaluateRapStatus(fam, verifyAll(mgr, acts, req, st2, allA, fam), st2, acts, SUBJ, TRUSTED).status, "aprobado");
  assert.equal(JSON.stringify(st), before, "verificar no crea ni modifica entregas");
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", "guia-02-herramientas", "x", { support: "abc", result: "autentica", by: "d", reviewedVersion: "ev2:sha256:" + "0".repeat(64), ficha: "3168850" })).reason, "not-strict-family");
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", fam, "c11Lab341", { result: "autentica", by: "d", reviewedVersion: "ev2:sha256:" + "0".repeat(64), ficha: "3168850" })).reason, "missing-support", "sin soporte no registra");
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", fam, "c11Lab341", { support: "abc", result: "autentica", by: "d" })).reason, "missing-version", "sin version revisada no registra");
  const fn = extractFn(read("js/activity_grades.js"), "function setStudentEvidenceVerification(");
  assert.match(fn, /set\[activityId \+ ":verified"\] = rec;/);
  assert.match(fn, /set\[activityId \+ ":verifyLog"\] = log;/);
  assert.match(fn, /reviewedVersion: reviewedVersion,\s*reviewedFileId: td \?/);
  assert.doesNotMatch(fn, /-delivery|-locked|cloudSaveGuideData/);
});

test("4. el panel marca evidencia oficial vs formativa y calcula el RAP con entregas reales", () => {
  const admin = read("js/admin_usuarios.js");
  assert.match(admin, /&#9733; Evidencia oficial/);
  assert.match(admin, />Formativa<\/span>/);
  assert.match(admin, /gradesManager\.evaluateRapStatus\(guideFamily, g, guideStateByUser\[user\.usernameKey\], declaredActs, rapSubject\)/);
  assert.match(read("js/script_guia_redes11.js"), /mgr\.evaluateRapStatus\(family, grades, state, getConfig\(\)\.activities \|\| \[\], subject\)/);
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
  const st = fullEvidenceState(acts, req, mgr);
  const refl = acts.find((a) => a.id === "d11Reflexion311");
  delete st["d11Reflexion311-submission"];
  refl.formFields.forEach((k) => { st[k] = "respuesta modelo del banco"; });
  st["d11Reflexion311-locked"] = true;
  const notasAntes = {}; acts.forEach((a) => { notasAntes[a.id] = "A"; });
  const otras = req.filter((id) => id !== "d11Reflexion311");
  const grades = verifyAll(mgr, acts, otras, st, notasAntes);   // todo lo demas verificado
  const stateAntes = JSON.stringify(st);
  const r = mgr.evaluateRapStatus(fam, grades, st, acts, SUBJ, TRUSTED);
  assert.equal(r.status, "pendiente-verificacion");
  assert.equal(r.items.find((i) => i.id === "d11Reflexion311").delivered, false);
  for (const bad of [{ at: "x", by: "d", result: "autentica" }, { at: "x", by: "d", support: "ok soporte", result: "no-autentica" }, { at: "x", by: "d", support: "  ", result: "autentica" }]) {
    const v = Object.assign({}, bad, { reviewedVersion: mgr.evidenceVersion(st, refl) });
    assert.equal(mgr.evaluateRapStatus(fam, Object.assign({}, grades, { "d11Reflexion311:verified": v }), st, acts, SUBJ, TRUSTED).status, "pendiente-verificacion", JSON.stringify(bad));
  }
  const ok = verifyAll(mgr, acts, ["d11Reflexion311"], st, grades);
  assert.equal(mgr.evaluateRapStatus(fam, ok, st, acts, SUBJ, TRUSTED).status, "aprobado");
  assert.notEqual(mgr.evaluateRapStatus(fam, Object.assign({}, ok, { d11Protocolo341: "" }), st, acts, SUBJ, TRUSTED).status, "aprobado");
  assert.equal(JSON.stringify(st), stateAntes);
});

// ── Fase 3d (Codex): casos A, B y C ───────────────────────────────────────────
test("3d. CASO A: formulario completo + sello local valido + nota A, sin verificacion del instructor = RAP PENDIENTE", () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap01", file = "grupo-11a-guia-09-redes-rap01.html";
  const acts = decl[file].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);   // sellos del navegador VALIDOS en todos los formularios
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const act = acts.find((a) => a.id === "b11Reflexion311");
  assert.equal(mgr.formEvidenceState(st, act), "real", "el sello del navegador coincide");
  const r = mgr.evaluateRapStatus(fam, allA, st, acts, SUBJ, TRUSTED);
  assert.notEqual(r.status, "aprobado", "un sello del cliente no acredita entrega");
  assert.equal(r.status, "pendiente-verificacion");
  assert.equal(r.delivered, 0);
  // un aprendiz que fabrica en su navegador un registro de entrega con archivo y un sello tampoco aprueba
  const forjado = Object.assign({}, st, { "b11Lab1Estrella341-delivery": { status: "delivered", savedFileName: "falso.pkt", driveUrl: "https://drive.google.com/file/d/falso/view" } });
  assert.notEqual(mgr.evaluateRapStatus(fam, allA, forjado, acts, SUBJ, TRUSTED).status, "aprobado");
});

test("3d. CASO B: evidencia verificada y modificada despues (respuesta o archivo) = PENDIENTE DE NUEVA VERIFICACION", () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap02", file = "grupo-11a-guia-10-redes-rap02.html";
  const acts = decl[file].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const grades = verifyAll(mgr, acts, req, st, allA);
  assert.equal(mgr.evaluateRapStatus(fam, grades, st, acts, SUBJ, TRUSTED).status, "aprobado");
  const taller = acts.find((a) => a.id === "c11Taller331");
  // cambio de una respuesta exigida
  const s1 = Object.assign({}, st, { [taller.formFields[0]]: "respuesta cambiada despues de la revision" });
  const r1 = mgr.evaluateRapStatus(fam, grades, s1, acts, SUBJ, TRUSTED);
  assert.equal(r1.status, "pendiente-nueva-verificacion");
  const it = r1.items.find((i) => i.id === "c11Taller331");
  assert.equal(it.evidence, "nueva-verificacion");
  assert.equal(it.verified, false);
  // cambio del archivo exigido
  const s2 = Object.assign({}, st, { "c11Lab341-delivery": { status: "delivered", savedFileName: "Lab_v2.pkt", driveUrl: "https://drive.google.com/file/d/v2/view" } });
  assert.equal(mgr.evaluateRapStatus(fam, grades, s2, acts, SUBJ, TRUSTED).status, "pendiente-nueva-verificacion");
  // el historial y la nota anterior se conservan
  assert.equal(grades["c11Taller331"], "A");
  assert.ok(grades["c11Taller331:verified"].support);
});

test("3d. CASO C: nueva verificacion documentada de la nueva version = vuelve a contribuir al RAP", () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap02", file = "grupo-11a-guia-10-redes-rap02.html";
  const acts = decl[file].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const grades = verifyAll(mgr, acts, req, st, allA);
  const taller = acts.find((a) => a.id === "c11Taller331");
  const s1 = Object.assign({}, st, { [taller.formFields[0]]: "nueva version" });
  assert.equal(mgr.evaluateRapStatus(fam, grades, s1, acts, SUBJ, TRUSTED).status, "pendiente-nueva-verificacion");
  const re = verifyAll(mgr, acts, ["c11Taller331"], s1, grades);
  assert.equal(mgr.evaluateRapStatus(fam, re, s1, acts, SUBJ, TRUSTED).status, "aprobado");
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
  assert.match(conf, /setStudentEvidenceVerification\(ctx\.user\.usernameKey, ctx\.family, ctx\.item\.id, \{\s*support, result, note, by,/);
  assert.match(conf, /trustedDrive: null/);
  assert.match(conf, /ficha: ctx\.subject\.ficha, uid: ctx\.subject\.uid/);
  assert.match(extractFn(admin, "function handleEvidenceVerification("), /Respuesta registrada/);
  // grado 10 sin cambios en su evaluacion
  const { mgr } = loadGrades();
  assert.equal(mgr.evaluateRapStatus("guia-redes-rap01", {}, {}, []), null);
});

// ── Fase 3e (Codex): integridad SHA-256, archivo real de Drive e identidad de la revision ──
test("3e. huella SHA-256 canonica: 'ab' vs 'bA' (colision de la huella de 32 bits) ahora difieren; coincide con SHA-256 estandar", () => {
  const { mgr } = loadGrades();
  const crypto = require("node:crypto");
  for (const t of ["", "ab", "bA", "ñandú 🎲 192.168.20.0/25", "x".repeat(5000)]) {
    assert.equal(mgr.sha256Hex(t), crypto.createHash("sha256").update(t, "utf8").digest("hex"), JSON.stringify(t.slice(0, 12)));
  }
  const act = { id: "c11Reflexion311", type: "form", formFields: ["k"] };
  assert.notEqual(mgr.evidenceVersion({ k: "ab" }, act), mgr.evidenceVersion({ k: "bA" }, act));
  assert.match(mgr.evidenceVersion({ k: "ab" }, act), /^ev2:sha256:[0-9a-f]{64}$/);
  // nombres de campo incluidos: mismo valor en otro campo -> otra version
  const two = { id: "x", type: "form", formFields: ["a", "b"] };
  assert.notEqual(mgr.evidenceVersion({ a: "1", b: "" }, two), mgr.evidenceVersion({ a: "", b: "1" }, two));
  // la revision anterior con la huella vieja (ev1) deja de valer
  const decl = loadDeclarations();
  const acts = decl["grupo-11a-guia-10-redes-rap02.html"].activities;
  const req = mgr.REQUIRED_EVIDENCE["guia-redes11-rap02"];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const g = verifyAll(mgr, acts, req, st, allA, "guia-redes11-rap02");
  const refl = acts.find((a) => a.id === "c11Reflexion311");
  const s1 = Object.assign({}, st); s1[refl.formFields[0]] = "ab"; const g1 = verifyAll(mgr, acts, ["c11Reflexion311"], s1, g, "guia-redes11-rap02");
  const s2 = Object.assign({}, s1); s2[refl.formFields[0]] = "bA";
  assert.equal(mgr.evaluateRapStatus("guia-redes11-rap02", g1, s1, acts, SUBJ, TRUSTED).status, "aprobado");
  assert.equal(mgr.evaluateRapStatus("guia-redes11-rap02", g1, s2, acts, SUBJ, TRUSTED).status, "pendiente-nueva-verificacion", "ab -> bA invalida la revision");
});

test("3e. identidad completa: revision de otro aprendiz, ficha, familia, actividad o UID nunca habilita", () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap01";
  const acts = decl["grupo-11a-guia-09-redes-rap01.html"].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const g = verifyAll(mgr, acts, req, st, allA, fam);
  assert.equal(mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, TRUSTED).status, "aprobado");
  const id = "b11Reflexion311";
  for (const [campo, valor] of [["usernameKey", "otro_aprendiz"], ["ficha", "3168852"], ["family", "guia-redes11-rap02"], ["activityId", "b11Pares327"], ["uid", "uid-ajeno"]]) {
    const bad = JSON.parse(JSON.stringify(g)); bad[id + ":verified"][campo] = valor;
    const r = mgr.evaluateRapStatus(fam, bad, st, acts, SUBJ, TRUSTED);
    assert.notEqual(r.status, "aprobado", campo);
    assert.equal(r.items.find((i) => i.id === id).verified, false, campo);
  }
  // sin identidad del consultado no se acepta ninguna revision
  assert.notEqual(mgr.evaluateRapStatus(fam, g, st, acts, undefined, TRUSTED).status, "aprobado");
  assert.notEqual(mgr.evaluateRapStatus(fam, g, st, acts, { usernameKey: "aprendiz_prueba" }, TRUSTED).status, "aprobado");
  // UID atestado distinto -> rechazado
  assert.notEqual(mgr.evaluateRapStatus(fam, g, st, acts, Object.assign({}, SUBJ, { uid: "uid-otro" }), TRUSTED).status, "aprobado");
});

test("3e. archivo: la revision exige el MISMO ID real de Drive y su revision autenticada; IDs contradictorios no se verifican", async () => {
  const decl = loadDeclarations();
  const fam = "guia-redes11-rap02";
  const acts = decl["grupo-11a-guia-10-redes-rap02.html"].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  const g = verifyAll(mgr, acts, req, st, allA, fam);
  assert.equal(mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, TRUSTED).status, "aprobado");
  const sinRev = JSON.parse(JSON.stringify(g)); sinRev["c11Lab341:verified"].reviewedDriveRevisionId = "";
  assert.notEqual(mgr.evaluateRapStatus(fam, sinRev, st, acts, SUBJ, TRUSTED).status, "aprobado", "sin revision de Drive");
  const otroArchivo = JSON.parse(JSON.stringify(g)); otroArchivo["c11Lab341:verified"].reviewedFileId = "1OtroArchivoDistinto";
  assert.notEqual(mgr.evaluateRapStatus(fam, otroArchivo, st, acts, SUBJ, TRUSTED).status, "aprobado", "otro archivo");
  // nueva entrega (otro archivo real) -> pendiente de nueva verificacion aunque nombre y fecha no cambien
  const s2 = Object.assign({}, st, { "c11Lab341-delivery": Object.assign({}, st["c11Lab341-delivery"], { fileId: "1ArchivoNuevoDistinto", driveUrl: "https://drive.google.com/file/d/1ArchivoNuevoDistinto/view" }) });
  assert.equal(mgr.evaluateRapStatus(fam, g, s2, acts, SUBJ, TRUSTED).status, "pendiente-nueva-verificacion");
  // fileId y URL contradictorios -> sin identidad valida
  const s3 = Object.assign({}, st, { "c11Lab341-delivery": Object.assign({}, st["c11Lab341-delivery"], { driveUrl: "https://drive.google.com/file/d/1UrlDeOtroArchivo/view" }) });
  assert.equal(mgr.driveFileIdentity(s3, "c11Lab341"), "");
  assert.notEqual(mgr.evaluateRapStatus(fam, g, s3, acts, SUBJ, TRUSTED).status, "aprobado");
  // el registro exige ficha, version SHA-256 y, para archivos, ID + revision
  const base = { support: "soporte ok", result: "autentica", by: "d", reviewedVersion: "ev2:sha256:" + "a".repeat(64), ficha: "3168850" };
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", fam, "c11Lab341", Object.assign({}, base, { reviewedVersion: "ev1:abc" }))).reason, "missing-version");
  assert.equal((await mgr.setStudentEvidenceVerification("aprendiz_prueba", fam, "c11Lab341", Object.assign({}, base, { ficha: "" }))).reason, "missing-ficha");
  // fase 3f: los datos de archivo escritos a mano se ignoran (solo cuenta trustedDrive)
  assert.match(extractFn(read("js/activity_grades.js"), "function setStudentEvidenceVerification("), /var td = r\.trustedDrive && typeof r\.trustedDrive === "object" \? r\.trustedDrive : null;/);
});

// ── Fase 3f (Codex): identidad confiable e integridad de Drive ─────────────────
function fixture3f(fam, file) {
  const decl = loadDeclarations();
  const acts = decl[file].activities;
  const { mgr } = loadGrades();
  const req = mgr.REQUIRED_EVIDENCE[fam];
  const st = fullEvidenceState(acts, req, mgr);
  const allA = {}; acts.forEach((a) => { allA[a.id] = "A"; });
  return { acts, mgr, req, st, g: verifyAll(mgr, acts, req, st, allA, fam) };
}

test("3f.1 revision SIN identidad confiable (UID no atestado o ausente) = rechazada / pendiente de verificacion", () => {
  const fam = "guia-redes11-rap02";
  const { acts, mgr, st, g } = fixture3f(fam, "grupo-11a-guia-10-redes-rap02.html");
  for (const subj of [Object.assign({}, SUBJ, { identityVerified: false }), Object.assign({}, SUBJ, { uid: "" }), { usernameKey: SUBJ.usernameKey, ficha: SUBJ.ficha }]) {
    const r = mgr.evaluateRapStatus(fam, g, st, acts, subj, TRUSTED);
    assert.equal(r.status, "pendiente-verificacion", JSON.stringify(subj));
    assert.ok(r.blockers.indexOf("identidad") !== -1);
  }
  const sinUid = JSON.parse(JSON.stringify(g)); Object.keys(sinUid).filter((k) => /:verified$/.test(k)).forEach((k) => { sinUid[k].uid = ""; });
  assert.equal(mgr.evaluateRapStatus(fam, sinUid, st, acts, SUBJ, TRUSTED).status, "pendiente-verificacion", "registro sin UID");
});

test("3f.2 revision de OTRO aprendiz (UID/usuario distinto) = rechazada", () => {
  const fam = "guia-redes11-rap01";
  const { acts, mgr, st, g } = fixture3f(fam, "grupo-11a-guia-09-redes-rap01.html");
  assert.notEqual(mgr.evaluateRapStatus(fam, g, st, acts, Object.assign({}, SUBJ, { uid: "uid-de-otro" }), TRUSTED).status, "aprobado");
  assert.notEqual(mgr.evaluateRapStatus(fam, g, st, acts, Object.assign({}, SUBJ, { usernameKey: "otro_aprendiz" }), TRUSTED).status, "aprobado");
});

test("3f.3 mismo ID de Drive con NUEVA revision (o nuevo SHA-256) = verificacion invalidada", () => {
  const fam = "guia-redes11-rap02";
  const { acts, mgr, st, g } = fixture3f(fam, "grupo-11a-guia-10-redes-rap02.html");
  assert.equal(mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, TRUSTED).status, "aprobado");
  const fid = mgr.driveFileIdentity(st, "c11Lab341");
  const nuevaRev = { driveFiles: new Proxy({}, { get: (_t, k) => (k === fid ? { revisionId: "rev-2", sha256: "a".repeat(64) } : TRUSTED.driveFiles[k]) }) };
  const r = mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, nuevaRev);
  assert.equal(r.status, "pendiente-nueva-verificacion");
  assert.equal(r.items.find((i) => i.id === "c11Lab341").integrity, "cambio");
  const nuevoSha = { driveFiles: new Proxy({}, { get: (_t, k) => (k === fid ? { revisionId: TRUSTED.driveFiles[fid].revisionId, sha256: "b".repeat(64) } : TRUSTED.driveFiles[k]) }) };
  assert.equal(mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, nuevoSha).status, "pendiente-nueva-verificacion");
});

test("3f.4 archivo sin version comprobable (sin lectura autenticada de Drive) = pendiente de integridad; nunca aprobado", () => {
  const fam = "guia-redes11-rap03";
  const { acts, mgr, st, g } = fixture3f(fam, "grupo-11a-guia-11-redes-rap03.html");
  for (const tr of [undefined, null, { driveFiles: {} }]) {
    const r = mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, tr);
    assert.notEqual(r.status, "aprobado");
    assert.ok(r.blockers.indexOf("integridad-drive") !== -1);
    assert.equal(r.items.find((i) => i.id === "d11Protocolo341").evidence, "integridad-pendiente");
  }
  // los datos escritos a mano en la revision no sustituyen la lectura de Drive
  const manual = JSON.parse(JSON.stringify(g)); manual["d11Protocolo341:verified"].reviewedFileRevision = "Version del 09/11 08:14";
  assert.notEqual(mgr.evaluateRapStatus(fam, manual, st, acts, SUBJ, null).status, "aprobado");
});

test("3f.5 identidad atestada + archivo comprobado en Drive + version vigente + nota A = evaluacion valida", () => {
  for (const [fam, file] of GUIDE_FILES) {
    const { acts, mgr, st, g } = fixture3f(fam, file);
    const r = mgr.evaluateRapStatus(fam, g, st, acts, SUBJ, TRUSTED);
    assert.equal(r.status, "aprobado", fam);
    assert.deepEqual(plain(r.blockers), []);
  }
});

test("3f.0 sin funciones duplicadas en activity_grades.js ni admin_usuarios.js (una declaracion posterior reemplazaba a la nueva)", () => {
  for (const f of ["js/activity_grades.js", "js/admin_usuarios.js", "js/script_guia_redes11.js"]) {
    const names = [...read(f).matchAll(/\n {2}(?:async )?function (\w+)\(/g)].map((m) => m[1]);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(dup, [], f);
  }
});

test("3f.6 el portal real NO atesta identidad ni lee Drive (todo queda pendiente); grado 10 sin cambios", () => {
  const admin = read("js/admin_usuarios.js");
  const guide = read("js/script_guia_redes11.js");
  assert.match(admin, /const rapSubject = \{[^}]*identityVerified: false \};/);
  assert.match(admin, /gradesManager\.evaluateRapStatus\(guideFamily, g, guideStateByUser\[user\.usernameKey\], declaredActs, rapSubject\)/, "sin fuente de Drive");
  assert.match(guide, /identityVerified: false \};/);
  assert.match(guide, /mgr\.evaluateRapStatus\(family, grades, state, getConfig\(\)\.activities \|\| \[\], subject\)/);
  assert.doesNotMatch(admin, /grade-verify-fileid|grade-verify-revision/, "sin campos de archivo escritos a mano");
  assert.match(admin, /trustedDrive: null/);
  const { mgr } = loadGrades();
  assert.equal(mgr.evaluateRapStatus("guia-redes-rap02", {}, {}, []), null, "grado 10 sin RAP estricto");
  // registros historicos: la evaluacion es pura (no modifica estado ni notas)
  const decl = loadDeclarations();
  const acts = decl["grupo-11a-guia-10-redes-rap02.html"].activities;
  const st = { "c11Lab341-delivery": { status: "delivered", submittedAt: "2026-11-07" }, "c11Reflexion311-locked": true };
  const notas = { c11Lab341: "A" };
  const a1 = JSON.stringify(st), a2 = JSON.stringify(notas);
  mgr.evaluateRapStatus("guia-redes11-rap02", notas, st, acts, SUBJ, TRUSTED);
  assert.equal(JSON.stringify(st), a1); assert.equal(JSON.stringify(notas), a2);
});
