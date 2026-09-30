"use strict";
// Seguimiento academico del Laboratorio Virtual (LOOP seguimiento, 2026-09-29).
// Escala bruta + normalizada, ids de intento, documento (sin inventar), cola sin
// conexion (idempotencia), historial, migrador del navegador (casos A-F) y el
// dry-run del unico registro historico real (67/90).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const Att = require(path.join(ROOT, "js/hardware_lab_attempts.js"));

// ── Almacen y Firestore simulados ──────────────────────────────────────────
function memStore(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] || null,
    get length() { return m.size; },
    _m: m,
  };
}
const auth = { getStudentStorageKey: (u, k, o) => `sena_portal:student:${u}:${(o && o.area) || "app"}:${k}` };
function memDb() {
  const docs = new Map();
  let online = true;
  return {
    docs,
    setOnline: (v) => { online = v; },
    async cloudCreateHwlabAttempt(doc) {
      if (!online) return { status: "offline" };
      if (docs.has(doc.attemptId)) return { status: "exists" };
      docs.set(doc.attemptId, Object.assign({}, doc, { recibidoEn: "server-time" }));
      return { status: "created" };
    },
  };
}
const ID = { uid: "UIDalumnoA0000000000000000001", usernameKey: "alumno.a", ficha: "3441942" };
const QKEY = auth.getStudentStorageKey(ID.usernameKey, "hwlab-attempts-pending-v1", { area: "app" });

function finishedSession(score, max, extra) {
  const breakdown = max === 90
    ? { procedimiento: { value: score - 60 > 0 ? score - 60 : 0, max: 30 }, herramientas: { value: 20, max: 20 }, seguridad: { value: 20, max: 20 }, orden: { value: 20, max: 20 }, total: score }
    : { diagnostico: { value: 30, max: 30 }, procedimiento: { value: 25, max: 25 }, reparacion: { value: 25, max: 25 }, herramientas: { value: 10, max: 10 }, eficiencia: { value: 10, max: 10 }, total: score };
  return Object.assign({
    startedAt: "2026-09-29T19:45:53.466Z", finishedAt: "2026-09-29T21:10:04.107Z",
    result: { score, breakdown, status: score >= 70 ? "APROBADO" : "POR MEJORAR", durationSeconds: 5051, hintsUsed: 0, errors: 38, errorsByType: { blocked: 1 } },
  }, extra || {});
}

test("ESC-1. normalizado = bruto x 100 / maximo; aprobacion con el valor exacto (>= 70)", () => {
  const cases = [[90, 100, "APROBADO"], [81, 90, "APROBADO"], [72, 80, "APROBADO"], [63, 70, "APROBADO"], [62, 68.888, "POR MEJORAR"]];
  cases.forEach(([raw, norm, est]) => {
    const n = Att.normalize(raw, 90);
    assert.ok(Math.abs(n.normalizedScore - norm) < 0.001, `${raw}/90 -> ${n.normalizedScore}`);
    assert.equal(n.estado, est, `${raw}/90`);
    assert.equal(n.normalizedMaxScore, 100);
  });
  const r67 = Att.normalize(67, 90);
  assert.equal(r67.normalizedScore, (67 * 100) / 90);
  assert.equal(r67.estado, "APROBADO");
  assert.equal(Att.formatScore(r67.normalizedScore), "74,44");
  assert.equal(Att.formatScore(100), "100");
  assert.equal(Att.formatScore(70), "70");
  // El redondeo visual NO decide: 69,996 se ve "70" pero NO aprueba.
  const casi = Att.normalize(62.9964, 90);
  assert.equal(Att.formatScore(casi.normalizedScore), "70");
  assert.equal(casi.estado, "POR MEJORAR");
  // Diagnostico (maximo 100): identidad, sin cambios.
  assert.equal(Att.normalize(85, 100).normalizedScore, 85);
  // Sin bruto -> nada inventado.
  assert.deepEqual(Att.normalize(null, 90), { normalizedScore: null, normalizedMaxScore: null, estado: null });
});

test("ESC-2. el motor de ensamble conserva el bruto (score) y aprueba con el normalizado: 63/90 = 70 = APROBADO", () => {
  globalThis.window = globalThis;
  globalThis.HardwareLab = Object.assign(globalThis.HardwareLab || {}, { Tools: require(path.join(ROOT, "js/hardware_lab_tools.js")) });
  const Engine = require(path.join(ROOT, "js/hardware_lab_engine.js"));
  const desk = require(path.join(ROOT, "js/hardware_lab_data_desktop.js")).DESKTOP_EQUIPMENT;
  const s = Engine.createSession(desk, "disassembly-free", { maxHints: 3 });
  // 9 bloqueos (-27 de procedimiento) -> bruto 63.
  const done = Engine.finish(Object.assign({}, s, { errorsByType: Object.assign({}, s.errorsByType, { blocked: 9 }) }));
  assert.equal(done.result.score, 63);
  assert.equal(done.result.rawScore, 63);
  assert.equal(done.result.rawMaxScore, 90);
  assert.equal(done.result.normalizedScore, 70);
  assert.equal(done.result.status, "APROBADO");
  const peor = Engine.finish(Object.assign({}, s, { errorsByType: Object.assign({}, s.errorsByType, { blocked: 10 }) }));
  assert.equal(peor.result.score, 60);
  assert.equal(peor.result.status, "POR MEJORAR");
  // El diagnostico (otro motor) no se toco.
  const src = fs.readFileSync(path.join(ROOT, "js/hardware_lab_diagnosis_engine.js"), "utf8");
  assert.match(src, /diagnostico: 30, procedimiento: 25, reparacion: 25, herramientas: 10, eficiencia: 10/);
});

test("ID-1. attemptId: formato exacto, mismo intento = mismo id, reintento = id nuevo, legacy determinista", () => {
  const id = Att.buildAttemptId(ID.uid, "laptop", "disassembly-guided", "2026-09-29T19:45:53.466Z", "a1b2c3d4");
  assert.equal(id, `${ID.uid}__laptop__disassembly-guided__1790711153466__a1b2c3d4`);
  assert.equal(Att.buildAttemptId(ID.uid, "laptop", "disassembly-guided", "2026-09-29T19:45:53.466Z", "a1b2c3d4"), id);
  assert.notEqual(Att.buildAttemptId(ID.uid, "laptop", "disassembly-guided", "2026-09-29T19:45:53.466Z", Att.makeNonce()), id);
  assert.equal(Att.buildAttemptId(ID.uid, "desktop", "diagnosis-caso-02", "x", "legacy"), `${ID.uid}__desktop__diagnosis-caso-02__sinfecha__legacy`);
  const nonces = new Set(Array.from({ length: 200 }, () => Att.makeNonce()));
  assert.equal(nonces.size, 200);
  [...nonces].forEach((n) => assert.match(n, /^[0-9a-f]{8}$/));
  assert.equal(Att.buildAttemptId("a__b", "laptop", "assembly-guided", "", "x"), null, "uid con separador");
  assert.equal(Att.buildAttemptId(ID.uid, "tablet", "assembly-guided", "", "x"), null);
  assert.equal(Att.buildAttemptId(ID.uid, "laptop", "teleport", "", "x"), null);
});

test("DOC-1. documento: bruto + maximo + normalizado; lo que falta queda null; nuevo sin estadoLegacy; version real", () => {
  const d = Att.buildAttemptDoc(finishedSession(81, 90), Object.assign({}, ID, { equipo: "desktop", practica: "assembly-evaluation", nonce: "abc12345", versionSimulador: "20260929_1", origen: "new" }));
  assert.equal(d.rawScore, 81); assert.equal(d.rawMaxScore, 90); assert.equal(d.normalizedScore, 90); assert.equal(d.estado, "APROBADO");
  assert.equal(d.estadoLegacy, null); assert.equal(d.versionSimulador, "20260929_1");
  assert.equal(d.actividad, "ensamble"); assert.equal(d.modo, "evaluacion"); assert.equal(d.caso, null); assert.equal(d.completado, true);
  const noRes = Att.buildAttemptDoc({ startedAt: "2026-09-29T10:00:00Z" }, Object.assign({}, ID, { equipo: "laptop", practica: "assembly-free", nonce: "legacy", origen: "legacy_partial", fuente: "browser" }));
  ["rawScore", "rawMaxScore", "normalizedScore", "estado", "fechaFin", "duracion", "pistas", "errores", "versionSimulador"].forEach((k) => assert.equal(noRes[k], null, k));
  assert.equal(noRes.completado, false);
});

test("HIST-1. diagnostico 60 -> 80 -> 100: 3 documentos, mejor 100, ultimo 100, historial completo", async () => {
  const store = memStore(); const db = memDb();
  const ids = [];
  for (const [i, score] of [[1, 60], [2, 80], [3, 100]]) {
    const nonce = Att.makeNonce();
    const s = finishedSession(score, 100, { startedAt: `2026-09-29T1${i}:00:00Z`, finishedAt: `2026-09-29T1${i}:10:00Z` });
    Att.enqueue(store, QKEY, Object.assign({ equipo: "desktop", practica: "diagnosis-caso-02", nonce, session: s, origen: "new", versionSimulador: "20260929_1" }, ID));
    await Att.flush({ store, key: QKEY, db, identity: ID });
    ids.push(Att.buildAttemptId(ID.uid, "desktop", "diagnosis-caso-02", s.startedAt, nonce));
  }
  assert.equal(db.docs.size, 3);
  ids.forEach((id) => assert.ok(db.docs.has(id)));
  const sum = Att.summarize([...db.docs.values()]);
  assert.equal(sum.intentos, 3); assert.equal(sum.mejor, 100); assert.equal(sum.ultimo, 100);
  assert.deepEqual(sum.historial.map((a) => a.rawScore), [60, 80, 100]);
  assert.equal(sum.actividades["desktop/diagnostico"].intentos, 3);
  assert.equal(Att.cellStatus(sum.actividades["desktop/diagnostico"]).label, "Aprobado");
  assert.equal(Att.cellStatus(undefined).label, "Sin registros");
});

test("IDEM-1. mismo intento: doble clic, recarga y reconexion -> 1 documento", async () => {
  const store = memStore(); const db = memDb();
  const item = Object.assign({ equipo: "laptop", practica: "assembly-guided", nonce: "feed0001", session: finishedSession(90, 90), origen: "new" }, ID);
  Att.enqueue(store, QKEY, item); Att.enqueue(store, QKEY, item); // doble clic
  db.setOnline(false);
  let r = await Att.flush({ store, key: QKEY, db, identity: ID });
  assert.equal(r.pending, 1); assert.equal(db.docs.size, 0, "sin red no se pierde ni se escribe");
  const reloaded = memStore(Object.fromEntries(store._m)); // recarga de la pagina
  db.setOnline(true);
  r = await Att.flush({ store: reloaded, key: QKEY, db, identity: ID });
  assert.equal(r.created, 1);
  Att.enqueue(reloaded, QKEY, item); // reenvio tardio del mismo intento
  r = await Att.flush({ store: reloaded, key: QKEY, db, identity: ID });
  assert.equal(r.exists, 1);
  assert.equal(db.docs.size, 1);
  assert.equal(Object.keys(JSON.parse(reloaded.getItem(QKEY))).length, 0, "cola vacia al confirmar");
});

test("IDEM-2. reintentar = nonce nuevo = documento nuevo; el anterior permanece", async () => {
  const store = memStore(); const db = memDb();
  const s1 = finishedSession(72, 90, { startedAt: "2026-09-29T08:00:00Z" });
  const s2 = finishedSession(81, 90, { startedAt: "2026-09-29T09:00:00Z" });
  Att.enqueue(store, QKEY, Object.assign({ equipo: "laptop", practica: "maintenance-guided", nonce: Att.makeNonce(), session: s1, origen: "new" }, ID));
  Att.enqueue(store, QKEY, Object.assign({ equipo: "laptop", practica: "maintenance-guided", nonce: Att.makeNonce(), session: s2, origen: "new" }, ID));
  await Att.flush({ store, key: QKEY, db, identity: ID });
  assert.equal(db.docs.size, 2);
});

test("IDEM-3. un pendiente de OTRO usuario no se envia con la identidad actual; sin uid queda pendiente", async () => {
  const store = memStore(); const db = memDb();
  Att.enqueue(store, QKEY, Object.assign({ equipo: "laptop", practica: "assembly-guided", nonce: "aaaa0001", session: finishedSession(90, 90), origen: "new" }, ID, { usernameKey: "otro" }));
  let r = await Att.flush({ store, key: QKEY, db, identity: ID });
  assert.equal(r.pending, 1); assert.equal(db.docs.size, 0);
  const store2 = memStore(); Att.enqueue(store2, QKEY, Object.assign({ equipo: "laptop", practica: "assembly-guided", nonce: "aaaa0002", session: finishedSession(90, 90), origen: "new" }, ID));
  r = await Att.flush({ store: store2, key: QKEY, db, identity: Object.assign({}, ID, { uid: null }) });
  assert.equal(r.pending, 1); assert.equal(db.docs.size, 0);
});

// ── Migrador del navegador ─────────────────────────────────────────────────
const LEG = (user, tail) => `sena_portal:student:${user}:guide-data:hardware-lab:hwlab_${tail}`;
test("MIG-A. historico completo del navegador -> migrado, conserva actividad, bruto, maximo, fecha y estado anterior", async () => {
  const store = memStore({ [LEG(ID.usernameKey, "laptop_disassembly_guided")]: JSON.stringify(finishedSession(67, 90)) });
  const scan = Att.scanBrowserLegacy({ store, auth, identity: ID, now: "2026-10-01T00:00:00Z" });
  assert.equal(scan.items.length, 1); assert.equal(scan.conflicts.length, 0);
  const it = scan.items[0];
  assert.equal(it.origen, "migrated"); assert.equal(it.fuente, "browser"); assert.equal(it.nonce, "legacy");
  const db = memDb();
  scan.items.forEach((x) => Att.enqueue(store, QKEY, x));
  await Att.flush({ store, key: QKEY, db, identity: ID });
  const d = [...db.docs.values()][0];
  assert.equal(d.actividad, "desensamble"); assert.equal(d.rawScore, 67); assert.equal(d.rawMaxScore, 90);
  assert.equal(d.fechaFin, "2026-09-29T21:10:04.107Z"); assert.equal(d.fechaMigracion, "2026-10-01T00:00:00Z");
  assert.equal(d.estadoLegacy, "POR MEJORAR"); assert.equal(d.estado, "APROBADO"); assert.equal(d.versionSimulador, null);
  assert.ok(d.attemptId.endsWith("__legacy"));
});

test("MIG-B. completado sin puntaje -> legacy_partial, SIN puntaje inventado", () => {
  const s = finishedSession(50, 90); delete s.result.score;
  const store = memStore({ [LEG(ID.usernameKey, "desktop_assembly_free")]: JSON.stringify(s) });
  const it = Att.scanBrowserLegacy({ store, auth, identity: ID }).items[0];
  assert.equal(it.origen, "legacy_partial");
  const d = Att.buildAttemptDoc(it.session, Object.assign({}, it, { uid: ID.uid }));
  assert.equal(d.rawScore, null); assert.equal(d.normalizedScore, null); assert.equal(d.estado, null); assert.equal(d.completado, true);
});

test("MIG-C. migrar dos veces el mismo historico -> 1 documento", async () => {
  const store = memStore({ [LEG(ID.usernameKey, "laptop_disassembly_guided")]: JSON.stringify(finishedSession(67, 90)) });
  const db = memDb();
  for (let k = 0; k < 2; k++) {
    Att.scanBrowserLegacy({ store, auth, identity: ID }).items.forEach((x) => Att.enqueue(store, QKEY, x));
    await Att.flush({ store, key: QKEY, db, identity: ID });
  }
  assert.equal(db.docs.size, 1);
  // Y si la misma sesion antigua se termina/registra desde el laboratorio: mismo id.
  const idLab = Att.buildAttemptId(ID.uid, "laptop", "disassembly-guided", "2026-09-29T19:45:53.466Z", "legacy");
  assert.ok(db.docs.has(idLab));
});

test("MIG-D. datos de A en el navegador + sesion de B -> NO se migran; conflicto registrado", () => {
  const store = memStore({ [LEG("alumno.a", "laptop_disassembly_guided")]: JSON.stringify(finishedSession(67, 90)) });
  const scan = Att.scanBrowserLegacy({ store, auth, identity: { uid: "UIDdeB", usernameKey: "alumno.b", ficha: "3441942" } });
  assert.equal(scan.items.length, 0);
  assert.deepEqual(scan.conflicts.map((c) => c.tipo), ["otro_usuario"]);
});

test("MIG-E. sin Internet: pendiente -> reconexion -> 1 documento", async () => {
  const store = memStore({ [LEG(ID.usernameKey, "desktop_diagnosis_caso_03")]: JSON.stringify(finishedSession(85, 100)) });
  const db = memDb(); db.setOnline(false);
  Att.scanBrowserLegacy({ store, auth, identity: ID }).items.forEach((x) => Att.enqueue(store, QKEY, x));
  await Att.flush({ store, key: QKEY, db, identity: ID });
  assert.equal(db.docs.size, 0);
  db.setOnline(true);
  await Att.flush({ store, key: QKEY, db, identity: ID });
  await Att.flush({ store, key: QKEY, db, identity: ID });
  assert.equal(db.docs.size, 1);
  assert.equal([...db.docs.values()][0].caso, "caso-03");
});

test("MIG-F. legacy corrupto, ambiguo, sin uid o sin terminar: no bloquea, no migra, se reporta", () => {
  const store = memStore({
    [LEG(ID.usernameKey, "laptop_assembly_guided")]: "{no es json",
    [LEG(ID.usernameKey, "laptop_teleport")]: JSON.stringify(finishedSession(90, 90)),
    [LEG(ID.usernameKey, "desktop_assembly_guided")]: JSON.stringify({ startedAt: "2026-09-28T10:00:00Z" }),
  });
  let scan;
  assert.doesNotThrow(() => { scan = Att.scanBrowserLegacy({ store, auth, identity: ID }); });
  assert.equal(scan.items.length, 0);
  assert.deepEqual(scan.conflicts.map((c) => c.tipo).sort(), ["corrupto", "estructura_ambigua"]);
  assert.deepEqual(scan.skipped.map((s) => s.motivo), ["no_terminado"]);
  const store2 = memStore({ [LEG(ID.usernameKey, "laptop_assembly_guided")]: JSON.stringify(finishedSession(90, 90)) });
  assert.deepEqual(Att.scanBrowserLegacy({ store: store2, auth, identity: Object.assign({}, ID, { uid: null }) }).conflicts.map((c) => c.tipo), ["sin_uid"]);
  // Una sesion ya del sistema nuevo (con nonce) no se trata como legado.
  const store3 = memStore({ [LEG(ID.usernameKey, "laptop_assembly_guided")]: JSON.stringify(finishedSession(90, 90, { attemptNonce: "abcd1234" })) });
  assert.deepEqual(Att.scanBrowserLegacy({ store: store3, auth, identity: ID }).skipped.map((s) => s.motivo), ["ya_es_intento_nuevo"]);
});

test("REAL-1. dry-run del unico registro historico real (67/90): documento exacto que SE CREARIA (no se escribe)", () => {
  // Datos leidos en produccion por el dry-run del 2026-09-29 (solo lectura). El
  // desglose por criterio no se leyo: aqui es ilustrativo (suma 67); el real se
  // copia tal cual del documento historico.
  const legacy = {
    startedAt: "2026-09-29T19:45:53.466Z", finishedAt: "2026-09-29T21:10:04.107Z",
    result: { score: 67, status: "POR MEJORAR", durationSeconds: 5051, hintsUsed: 0, errors: 38,
      breakdown: { procedimiento: { value: 7, max: 30 }, herramientas: { value: 20, max: 20 }, seguridad: { value: 20, max: 20 }, orden: { value: 20, max: 20 }, total: 67 } },
  };
  const real = Att.buildAttemptDoc(legacy, { uid: "UIDREAL0000000000000000000A1", usernameKey: "u", ficha: "3441942", equipo: "laptop", practica: "disassembly-guided", nonce: "legacy", versionSimulador: null, origen: "migrated", fuente: "cloud", fechaMigracion: "2026-10-01T00:00:00Z" });
  assert.equal(real.attemptId, "UIDREAL0000000000000000000A1__laptop__disassembly-guided__1790711153466__legacy");
  assert.equal(real.rawScore, 67); assert.equal(real.rawMaxScore, 90);
  assert.ok(Math.abs(real.normalizedScore - 74.444444) < 1e-5); assert.equal(real.normalizedMaxScore, 100);
  assert.equal(real.estado, "APROBADO"); assert.equal(real.estadoLegacy, "POR MEJORAR");
  assert.equal(real.origen, "migrated"); assert.equal(real.fuente, "cloud"); assert.equal(real.versionSimulador, null);
  assert.equal(real.duracion, 5051); assert.equal(real.pistas, 0); assert.equal(real.errores, 38);
  assert.equal(real.fechaInicio, "2026-09-29T19:45:53.466Z"); assert.equal(real.fechaFin, "2026-09-29T21:10:04.107Z");
});

test("PANEL-1. filas por aprendiz: sin registros != 0, discrepancia de ficha, intentos huerfanos, CSV seguro", () => {
  globalThis.window = globalThis;
  globalThis.HardwareLab = Object.assign(globalThis.HardwareLab || {}, { Attempts: Att });
  require(path.join(ROOT, "js/admin_hwlab_tracking.js"));
  const T = globalThis.adminHwlabTracking._test;
  T.state.deps = { users: [
    { usernameKey: "a", fullName: "Aprendiz A", ficha: "3441942", uid: "UA" },
    { usernameKey: "b", fullName: "Aprendiz B", ficha: "3441942", uid: "UB" },
    { usernameKey: "c", fullName: "Otra ficha", ficha: "3441939", uid: "UC" },
  ] };
  const mk = (uid, key, ficha, score, when) => Att.buildAttemptDoc(finishedSession(score, 100, { startedAt: when, finishedAt: when }), { uid, usernameKey: key, ficha, equipo: "desktop", practica: "diagnosis-caso-01", nonce: Att.makeNonce(), origen: "new" });
  const attempts = [mk("UA", "a", "3441942", 60, "2026-09-29T10:00:00Z"), mk("UA", "a", "3441939", 80, "2026-09-29T11:00:00Z"), mk("UZ", "z", "3441942", 90, "2026-09-29T12:00:00Z")];
  const built = T.buildRows("3441942", attempts);
  assert.equal(built.rows.length, 2);
  const a = built.rows.find((r) => r.user.usernameKey === "a");
  const b = built.rows.find((r) => r.user.usernameKey === "b");
  assert.equal(a.sum.intentos, 2); assert.equal(a.sum.mejor, 80); assert.equal(a.discrepancias, 1);
  assert.equal(b.sum.intentos, 0); assert.equal(b.sum.mejor, null, "sin registros no es 0");
  assert.equal(built.huerfanos.length, 1);
  assert.equal(T.csvCell('Pérez; "x"'), '"Pérez; ""x"""');
});

test("INT-1. integracion: controladores registran al terminar, nonce por sesion nueva, scripts y reglas en su sitio", () => {
  const ctl = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_controller.js"), "utf8");
  const diag = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_diagnosis_controller.js"), "utf8");
  assert.match(ctl, /Attempts\(\)\.recordFinished\(\{ session: done, equipo: equipmentId, practica: storageMode \}\)/);
  assert.match(ctl, /payload\.attemptNonce = session\.attemptNonce/);
  assert.equal((ctl.match(/Engine\(\)\.createSession\(/g) || []).length, 1, "toda sesion nueva pasa por freshSession (nonce)");
  assert.match(diag, /A\.recordFinished\(\{ session: done, equipo: equipmentId, practica: storageModeFor\(caseDef\.id\) \}\)/);
  assert.match(diag, /data\.attemptNonce = session\.attemptNonce/);
  const html = fs.readFileSync(path.join(ROOT, "laboratorio-virtual-hardware.html"), "utf8");
  const iStorage = html.indexOf("js/hardware_lab_storage.js"), iAtt = html.indexOf("js/hardware_lab_attempts.js"), iView = html.indexOf("js/hardware_lab_progress_view.js");
  assert.ok(iStorage > 0 && iAtt > iStorage && iView > iAtt, "orden: storage -> attempts -> progress_view");
  assert.ok(html.includes('id="hwlab-progress-btn"'));
  const panel = fs.readFileSync(path.join(ROOT, "panel-administrativo-usuarios.html"), "utf8");
  assert.ok(panel.indexOf("js/admin_hwlab_tracking.js") > 0 && panel.indexOf("js/admin_hwlab_tracking.js") < panel.indexOf("js/admin_usuarios.js"));
  assert.ok(panel.includes('id="hwtrack-host"'));
  const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
  const block = rules.slice(rules.indexOf("match /sena_portal_hwlab_attempts/{attemptId}"));
  assert.match(block, /allow update, delete: if false;/);
  assert.match(block, /isAdmin\(\) && request\.resource\.data\.origen != 'new'/);
  assert.match(rules, /d\.recibidoEn == request\.time/);
  const db = fs.readFileSync(path.join(ROOT, "js/firebase_db.js"), "utf8");
  assert.match(db, /currentDocument: \{ exists: false \}/);
  assert.match(db, /setToServerValue: "REQUEST_TIME"/);
});
