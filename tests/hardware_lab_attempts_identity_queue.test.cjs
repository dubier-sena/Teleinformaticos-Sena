"use strict";
// Seguimiento academico del Laboratorio Virtual — identidad, cola y recuperacion (LOOP 2026-10-01).
//
// Leccion del piloto de recuperacion: la cola de intentos vive en el navegador
// y se firma con el uid de Firebase que este activo. Estas pruebas fijan que:
//   - nada se envia si Firebase no es, sin ambiguedad, el usuario de la sesion;
//   - un intento solo sale de la cola cuando el servidor confirma que existe;
//   - cualquier fallo (red, permisos, cuota, sesion caducada) lo deja recuperable;
//   - un reintento tecnico nunca duplica, y un intento academico nuevo si crea documento.
// Se ejecuta el modulo REAL dentro de un "navegador" simulado (vm), con Firestore en memoria.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "js/hardware_lab_attempts.js"), "utf8");
const Att = require(path.join(ROOT, "js/hardware_lab_attempts.js"));

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] || null, get length() { return m.size; }, _m: m };
}
// Firestore en memoria con el contrato real de cloudCreateHwlabAttempt.
function memDb() {
  const docs = new Map(); const calls = [];
  const db = { docs, calls, modo: "ok",
    async cloudCreateHwlabAttempt(doc) {
      calls.push(doc.attemptId);
      if (db.modo === "offline") return { status: "offline" };
      if (db.modo === "timeout") return { status: "offline", httpStatus: 504 };
      if (db.modo === "quota") return { status: "quota" };
      if (db.modo === "denied") return { status: "denied", httpStatus: 403 };
      if (db.modo === "rejected") return { status: "rejected", httpStatus: 400 };
      if (db.modo === "lanza") throw new Error("fallo inesperado del navegador");
      if (docs.has(doc.attemptId)) return { status: "exists" }; // nunca sobrescribe
      docs.set(doc.attemptId, Object.assign({}, doc, { recibidoEn: "hora-del-servidor" }));
      return { status: "created" };
    },
    async cloudQueryHwlabAttempts(field, value) { const list = [...docs.values()].filter((d) => d[field] === value); return { status: "ok", docs: list, reads: Math.max(1, list.length) }; },
  };
  return db;
}
// "Navegador": sesion del portal + Firebase Auth + localStorage + _firebaseDb.
function browser(opts) {
  const store = opts.store || memStore();
  const state = { session: opts.session === undefined ? { role: "student", user: { usernameKey: "ana.gomez", ficha: "3441939" } } : opts.session,
    fb: opts.fb === undefined ? { uid: "UIDana0000000000000000000001", email: "ana.gomez@sena-portal.local" } : opts.fb };
  const win = {
    localStorage: store, crypto: require("node:crypto").webcrypto, document: { querySelector: () => ({ getAttribute: () => "js/hardware_lab_3d_bootstrap.js?v=20260929_1" }) },
    portalAuth: { getCurrentSession: () => state.session, getStudentStorageKey: (u, k, o) => `sena_portal:student:${String(u).toLowerCase().replace(/[^a-z0-9:_-]+/g, "_")}:${(o && o.area) || "app"}:${k}` },
    portalFirebaseAuth: { currentUid: () => (state.fb ? state.fb.uid : null), getCurrentUserEmail: async () => (state.fb ? state.fb.email : null) },
    _firebaseDb: opts.db,
  };
  const sandbox = { window: win, console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(SRC, sandbox);
  return { A: win.HardwareLab.Attempts, store, state, win, qkey: (u) => win.portalAuth.getStudentStorageKey(u, "hwlab-attempts-pending-v1", { area: "app" }) };
}
const cola = (b, user) => JSON.parse(b.store.getItem(b.qkey(user || "ana.gomez")) || "{}");
const ses = (nonce, when, score) => ({ startedAt: when || "2026-10-01T15:00:00.000Z", finishedAt: "2026-10-01T15:12:00.000Z", attemptNonce: nonce,
  result: { score: score == null ? 81 : score, status: "APROBADO", durationSeconds: 720, hintsUsed: 1, errors: 4, errorsByType: { outOfOrder: 4 }, breakdown: { procedimiento: { value: 27, max: 30 }, herramientas: { value: 20, max: 20 }, seguridad: { value: 20, max: 20 }, orden: { value: 14, max: 20 }, total: 81 } } });
const terminar = (b, nonce, when, practica, score) => b.A.recordFinished({ session: ses(nonce, when, score), equipo: "laptop", practica: practica || "disassembly-guided" });
const settle = () => new Promise((r) => setTimeout(r, 15));

// ── 1-4. Creacion, puntaje, normalizacion, id ───────────────────────────────
test("T01 creacion de intento: al terminar una practica queda UN documento con la identidad de la sesion", async () => {
  const db = memDb(); const b = browser({ db });
  assert.equal(terminar(b, "aaaa0001"), true); await settle();
  assert.equal(db.docs.size, 1);
  const d = [...db.docs.values()][0];
  assert.equal(d.uid, "UIDana0000000000000000000001"); assert.equal(d.usernameKey, "ana.gomez"); assert.equal(d.ficha, "3441939");
  assert.equal(d.attemptId, "UIDana0000000000000000000001__laptop__disassembly-guided__" + Date.parse("2026-10-01T15:00:00.000Z") + "__aaaa0001");
  assert.equal(d.origen, "new"); assert.equal(d.completado, true); assert.equal(d.versionSimulador, "20260929_1");
  assert.deepEqual(Object.keys(cola(b)), [], "confirmado -> sale de la cola");
});

test("T02 puntaje: rubricas reales (practicas 30+20+20+20 = 90; diagnostico 30+25+25+10+10 = 100); el documento guarda bruto, maximo y desglose sin tocarlos", () => {
  const d = Att.buildAttemptDoc(ses("aaaa0002"), { uid: "U", usernameKey: "ana.gomez", ficha: "3441939", equipo: "laptop", practica: "assembly-guided", nonce: "aaaa0002", origen: "new" });
  assert.equal(d.rawScore, 81); assert.equal(d.rawMaxScore, 90, "maximo = suma de los maximos del desglose");
  assert.deepEqual(d.breakdown.orden, { value: 14, max: 20 });
  assert.equal(d.duracion, 720); assert.equal(d.pistas, 1); assert.equal(d.errores, 4); assert.deepEqual(d.erroresPorTipo, { outOfOrder: 4 });
  const motor = fs.readFileSync(path.join(ROOT, "js/hardware_lab_engine.js"), "utf8");
  assert.match(motor, /CATEGORY_MAX = \{ procedimiento: 30, herramientas: 20, seguridad: 20, orden: 20 \}/);
  assert.match(fs.readFileSync(path.join(ROOT, "js/hardware_lab_diagnosis_engine.js"), "utf8"), /CATEGORY_MAX = \{ diagnostico: 30, procedimiento: 25, reparacion: 25, herramientas: 10, eficiencia: 10 \}/);
});

test("T03 normalizacion: bruto x 100 / maximo, sin redondear; aprueba con el valor exacto >= 70 (63/90 si, 62/90 no); diagnostico sobre 100", () => {
  assert.equal(Att.normalize(63, 90).normalizedScore, 70); assert.equal(Att.normalize(63, 90).estado, "APROBADO");
  assert.equal(Att.normalize(62, 90).estado, "POR MEJORAR"); assert.ok(Math.abs(Att.normalize(62, 90).normalizedScore - 68.8888888888889) < 1e-9);
  assert.equal(Att.normalize(67, 90).normalizedScore, (67 * 100) / 90);
  assert.equal(Att.normalize(72, 100).normalizedScore, 72);
  assert.equal(Att.rawMaxFromBreakdown({ diagnostico: { value: 30, max: 30 }, procedimiento: { value: 25, max: 25 }, reparacion: { value: 25, max: 25 }, herramientas: { value: 10, max: 10 }, eficiencia: { value: 10, max: 10 }, total: 100 }), 100);
  assert.deepEqual(Att.normalize(null, 90), { normalizedScore: null, normalizedMaxScore: null, estado: null }, "sin bruto no se inventa puntaje");
});

test("T04 id unico: {uid}__{equipo}__{practica}__{inicioMs}__{nonce}; determinista para el mismo intento, distinto para otro", () => {
  const id = (n, t) => Att.buildAttemptId("UID1", "laptop", "assembly-guided", t || "2026-10-01T15:00:00.000Z", n);
  assert.equal(id("aaaa0001"), id("aaaa0001")); assert.notEqual(id("aaaa0001"), id("aaaa0002")); assert.notEqual(id("aaaa0001"), id("aaaa0001", "2026-10-01T15:00:01.000Z"));
  assert.equal(Att.buildAttemptId("UID1", "tablet", "assembly-guided", "2026-10-01T15:00:00Z", "a"), null, "equipo desconocido");
  assert.equal(Att.buildAttemptId("U__X", "laptop", "assembly-guided", "2026-10-01T15:00:00Z", "a"), null, "uid que romperia el formato");
  const nonces = new Set(Array.from({ length: 500 }, () => Att.makeNonce())); assert.equal(nonces.size, 500); assert.ok([...nonces].every((n) => /^[0-9a-f]{8}$/.test(n)));
});

// ── 5-8, 14. Idempotencia, cola, fallos, reintento, doble envio ─────────────
test("T05 idempotencia: reenviar, recargar y restaurar una cola ya enviada no crea una segunda copia", async () => {
  const db = memDb(); const b = browser({ db });
  terminar(b, "bbbb0001"); await settle();
  const copiaDeLaCola = JSON.stringify({ x: { usernameKey: "ana.gomez", ficha: "3441939", equipo: "laptop", practica: "disassembly-guided", nonce: "bbbb0001", session: ses("bbbb0001"), origen: "new", versionSimulador: "20260929_1" } });
  b.store.setItem(b.qkey("ana.gomez"), copiaDeLaCola); // "restaurar" una cola vieja
  const b2 = browser({ db, store: b.store }); // reapertura del laboratorio
  const r = await b2.A.flushNow();
  assert.equal(r.exists, 1); assert.equal(r.created, 0); assert.equal(db.docs.size, 1);
  assert.deepEqual(Object.keys(cola(b2)), []);
});

test("T06 cola local: estructura, llave por usuario y persistencia; solo se borra con 'created' o 'exists'", async () => {
  const db = memDb(); db.modo = "denied"; const b = browser({ db });
  terminar(b, "cccc0001"); await settle();
  assert.equal(b.qkey("ana.gomez"), "sena_portal:student:ana_gomez:app:hwlab-attempts-pending-v1");
  const q = cola(b); const item = Object.values(q)[0];
  assert.deepEqual(Object.keys(q), ["laptop__disassembly-guided__" + Date.parse("2026-10-01T15:00:00.000Z") + "__cccc0001"]);
  assert.equal(item.usernameKey, "ana.gomez"); assert.equal(item.ficha, "3441939"); assert.equal(item.session.result.score, 81); assert.equal(item.origen, "new");
  assert.ok(item.enqueuedAt); assert.equal(item.tries, 1); assert.equal(item.lastError, "denied 403");
  assert.equal("uid" in item, false, "el uid no se guarda en la cola: se toma de Firebase al enviar, tras verificar la identidad");
});

test("T07 fallos: red, timeout, cuota, permisos, rechazo y excepcion del navegador dejan el intento recuperable", async () => {
  for (const modo of ["offline", "timeout", "quota", "denied", "rejected", "lanza"]) {
    const db = memDb(); db.modo = modo; const b = browser({ db });
    terminar(b, "dddd0001"); await settle();
    assert.equal(Object.keys(cola(b)).length, 1, modo + ": sigue en la cola"); assert.equal(db.docs.size, 0, modo);
    db.modo = "ok"; await b.A.flushNow();
    assert.equal(db.docs.size, 1, modo + ": se recupera despues"); assert.equal(Object.keys(cola(b)).length, 0, modo);
  }
});

test("T08 reintento: cada intento de envio cuenta, y el intento se envia una sola vez cuando la condicion se corrige", async () => {
  const db = memDb(); db.modo = "offline"; const b = browser({ db });
  terminar(b, "eeee0001"); await settle(); await b.A.flushNow(); await b.A.flushNow();
  assert.equal(Object.values(cola(b))[0].tries, 3);
  db.modo = "ok"; const r = await b.A.flushNow();
  assert.equal(r.created, 1); assert.equal(db.docs.size, 1); assert.equal(db.calls.filter((c) => c.endsWith("eeee0001")).length, 4);
});

test("T14 doble envio: doble clic y doble llamada del mismo intento -> 1 elemento en cola, 1 documento", async () => {
  const db = memDb(); const b = browser({ db });
  terminar(b, "ffff0001"); terminar(b, "ffff0001"); b.A.flushNow(); b.A.flushNow(); await settle();
  assert.equal(db.docs.size, 1);
  db.modo = "offline"; terminar(b, "ffff0002", "2026-10-01T16:00:00.000Z"); terminar(b, "ffff0002", "2026-10-01T16:00:00.000Z"); await settle();
  assert.equal(Object.keys(cola(b)).length, 1, "encolar dos veces el mismo intento no lo duplica");
});

// ── 9-13. Identidad ─────────────────────────────────────────────────────────
test("T09 sesion del portal caducada + Firebase disponible: no se pierde la cola, no se envia, y tras entrar de nuevo se envia una sola vez", async () => {
  const db = memDb(); db.modo = "denied"; const b = browser({ db });
  terminar(b, "aaaa1001"); await settle();
  db.modo = "ok"; db.calls.length = 0;
  b.state.session = null; // 12 horas despues: el portal borra la sesion caducada; Firebase sigue en IndexedDB
  assert.equal(await b.A.flushNow(), null, "sin sesion de aprendiz no se sincroniza");
  assert.equal(b.A.recordFinished({ session: ses("zzzz9999"), equipo: "laptop", practica: "assembly-guided" }), false, "sin sesion no se registra nada nuevo");
  assert.equal(db.calls.length, 0); assert.equal(Object.keys(cola(b)).length, 1, "la cola sigue intacta");
  b.state.session = { role: "student", user: { usernameKey: "ana.gomez", ficha: "3441939" } }; // inicia sesion otra vez
  const r = await b.A.flushNow(); await b.A.flushNow();
  assert.equal(r.created, 1); assert.equal(db.docs.size, 1); assert.equal(db.calls.length, 1, "una sola escritura"); assert.equal(Object.keys(cola(b)).length, 0);
});

test("T10 Firebase ausente: sesion del portal valida pero sin sesion en la nube -> pendiente, sin llamar a la red", async () => {
  const db = memDb(); const b = browser({ db, fb: null });
  terminar(b, "aaaa1002"); await settle();
  assert.equal(db.calls.length, 0); assert.equal(Object.keys(cola(b)).length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(b.A.pendingSummary())), { total: 1, sinConexion: 1, noAceptados: 0, identidad: 0 });
  b.state.fb = { uid: "UIDana0000000000000000000001", email: "ana.gomez@sena-portal.local" }; await b.A.flushNow();
  assert.equal(db.docs.size, 1);
});

test("T11 Firebase de OTRO usuario: la cola de A no se envia ni con la sesion de B ni firmada con el uid de B", async () => {
  const db = memDb(); db.modo = "denied";
  const a = browser({ db }); terminar(a, "aaaa1003"); await settle(); // A deja un intento en este equipo
  db.modo = "ok"; db.calls.length = 0;
  // (1) B inicia sesion en el mismo navegador (portal B + Firebase B): la cola de A ni se mira.
  const comoB = browser({ db, store: a.store, session: { role: "student", user: { usernameKey: "beto.ruiz", ficha: "3441939" } }, fb: { uid: "UIDbeto000000000000000000002", email: "beto.ruiz@sena-portal.local" } });
  await comoB.A.flushNow(); comoB.A.migrateBrowserLegacy(); await settle();
  assert.equal(db.calls.length, 0); assert.equal(db.docs.size, 0);
  // (2) Estado mixto: portal de A pero Firebase quedo como B. Sin la verificacion, el intento de A saldria con el uid de B.
  const mixto = browser({ db, store: a.store, fb: { uid: "UIDbeto000000000000000000002", email: "beto.ruiz@sena-portal.local" } });
  const r = await mixto.A.flushNow();
  assert.equal(r.identidad, 1); assert.equal(db.calls.length, 0, "ni siquiera se llama a la red"); assert.equal(db.docs.size, 0);
  assert.equal(Object.values(cola(mixto))[0].lastError, "identidad sesion_de_otro_usuario");
  assert.equal(mixto.A.pendingSummary().identidad, 1);
  assert.equal(JSON.stringify(Object.values(cola(mixto))[0].session), JSON.stringify(ses("aaaa1003")), "la cola de A queda intacta");
  // (3) Vuelve A con su Firebase: se envia una vez, con SU uid.
  const deNuevoA = browser({ db, store: a.store });
  await deNuevoA.A.flushNow();
  assert.equal(db.docs.size, 1); assert.equal([...db.docs.values()][0].uid, "UIDana0000000000000000000001"); assert.equal([...db.docs.keys()][0].indexOf("UIDbeto"), -1);
});

test("T12 UID incorrecto: si el perfil local declara un uid y Firebase tiene otro (cuenta de una version anterior), no se envia", async () => {
  const db = memDb();
  const b = browser({ db, session: { role: "student", user: { usernameKey: "ana.gomez", ficha: "3441939", uid: "UIDana-NUEVO-00000000000003" } }, fb: { uid: "UIDana0000000000000000000001", email: "ana.gomez@sena-portal.local" } });
  terminar(b, "aaaa1004"); await settle();
  assert.equal(db.calls.length, 0); assert.equal(Object.values(cola(b))[0].lastError, "identidad uid_distinto_al_perfil");
  b.state.fb = { uid: "UIDana-NUEVO-00000000000003", email: "ana.gomez.v2@sena-portal.local" }; await b.A.flushNow();
  assert.equal(db.docs.size, 1); assert.equal([...db.docs.values()][0].uid, "UIDana-NUEVO-00000000000003");
  // Reglas de coincidencia del correo sintetico.
  assert.equal(Att.emailMatchesUser("ana.gomez@sena-portal.local", "ana.gomez"), true); assert.equal(Att.emailMatchesUser("ana.gomez.v3@sena-portal.local", "Ana.Gomez"), true);
  for (const mal of ["ana.gomez2@sena-portal.local", "ana.gomez.v@sena-portal.local", "ana.gomez.v0@sena-portal.local", "ana.gomez.vx@sena-portal.local", "ana@sena-portal.local", "ana.gomez@otro.dominio", "", null]) assert.equal(Att.emailMatchesUser(mal, "ana.gomez"), false, String(mal));
  assert.deepEqual(Att.checkIdentity({ uid: "U", usernameKey: "ana.gomez" }), { ok: false, motivo: "correo_no_verificable" }, "sin correo verificable se falla cerrado");
});

test("T13 ficha incorrecta: el servidor niega el intento cuya ficha no es la del indice; queda en cola con el motivo y la ficha nunca se reescribe", async () => {
  const db = memDb(); db.modo = "denied"; const b = browser({ db });
  terminar(b, "aaaa1005"); await settle();
  const it = Object.values(cola(b))[0];
  assert.equal(it.ficha, "3441939"); assert.equal(it.lastError, "denied 403");
  assert.deepEqual(JSON.parse(JSON.stringify(b.A.pendingSummary())), { total: 1, sinConexion: 0, noAceptados: 1, identidad: 0 });
  const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
  assert.match(rules, /d\.ficha == get\(\/databases\/\$\(database\)\/documents\/sena_portal_user_index\/\$\(d\.uid\)\)\.data\.ficha/, "la regla contrasta la ficha con el indice del uid");
});

// ── 15-16. Inmutabilidad y multiples intentos ───────────────────────────────
test("T15 intento inmutable: las reglas prohiben update y delete, el aprendiz solo crea con su uid, y el cliente nunca reescribe uno existente", async () => {
  const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
  const bloque = rules.slice(rules.indexOf("match /sena_portal_hwlab_attempts/{attemptId}"));
  const cuerpo = bloque.slice(0, bloque.indexOf("\n    }") + 6);
  assert.match(cuerpo, /allow update, delete: if false;/);
  assert.match(cuerpo, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.match(cuerpo, /isAdmin\(\) && request\.resource\.data\.origen != 'new'/, "el admin no puede fabricar intentos 'new'");
  assert.match(rules, /d\.attemptId == attemptId/); assert.match(rules, /d\.recibidoEn == request\.time/);
  const fb = fs.readFileSync(path.join(ROOT, "js/firebase_db.js"), "utf8");
  assert.match(fb, /currentDocument: \{ exists: false \}/, "la creacion lleva precondicion: nunca sobrescribe");
  const db = memDb(); const b = browser({ db });
  terminar(b, "aaaa1006", "2026-10-01T15:00:00.000Z", "disassembly-guided", 81); await settle();
  const antes = JSON.stringify([...db.docs.values()][0]);
  terminar(b, "aaaa1006", "2026-10-01T15:00:00.000Z", "disassembly-guided", 90); await settle(); // mismo intento con puntaje alterado
  assert.equal(JSON.stringify([...db.docs.values()][0]), antes, "el documento ya registrado no cambia"); assert.equal(db.docs.size, 1);
});

test("T16 multiples intentos reales: repetir la practica crea un documento por intento y conserva los anteriores", async () => {
  const db = memDb(); const b = browser({ db });
  terminar(b, "aaaa2001", "2026-10-01T15:00:00.000Z", "disassembly-guided", 54); await settle();
  terminar(b, "aaaa2002", "2026-10-01T15:30:00.000Z", "disassembly-guided", 72); await settle();
  terminar(b, "aaaa2003", "2026-10-01T16:00:00.000Z", "disassembly-guided", 90); await settle();
  assert.equal(db.docs.size, 3);
  const sum = Att.summarize([...db.docs.values()]);
  assert.equal(sum.intentos, 3); assert.deepEqual(sum.historial.map((a) => a.rawScore), [54, 72, 90]);
  assert.equal(sum.mejor, 100); assert.equal(sum.ultimo, 100); assert.equal(sum.actividades["laptop/desensamble"].intentos, 3);
});

// ── 17-19. Panel del instructor ─────────────────────────────────────────────
function panel() {
  globalThis.window = globalThis; globalThis.HardwareLab = Object.assign(globalThis.HardwareLab || {}, { Attempts: Att });
  require(path.join(ROOT, "js/admin_hwlab_tracking.js"));
  return globalThis.adminHwlabTracking._test;
}
const FICHAS = ["3441939", "3441942", "3441944", "3441950"];
const mk = (uid, key, ficha, score, when, practica) => Att.buildAttemptDoc(Object.assign(ses("n" + String(score).padStart(3, "0") + "a", when, score), {}), { uid, usernameKey: key, ficha, equipo: "laptop", practica: practica || "assembly-guided", nonce: Att.makeNonce(), origen: "new" });

test("T17 filtros por ficha: las cuatro fichas no mezclan aprendices ni resultados, y los totales salen de los datos", () => {
  const T = panel();
  T.state.deps = { users: FICHAS.flatMap((f, i) => [{ usernameKey: "a" + i, fullName: "A" + i, ficha: f, uid: "UA" + i }, { usernameKey: "b" + i, fullName: "B" + i, ficha: f, uid: "UB" + i }]) };
  const todos = FICHAS.flatMap((f, i) => Array.from({ length: i + 1 }, (_, n) => mk("UA" + i, "a" + i, f, 60 + n, `2026-10-01T1${n}:00:00.000Z`)));
  FICHAS.forEach((f, i) => {
    const deLaFicha = todos.filter((a) => a.ficha === f); // lo que devuelve la consulta where ficha == f
    const built = T.buildRows(f, deLaFicha);
    assert.deepEqual(built.rows.map((r) => r.user.usernameKey), ["a" + i, "b" + i], "solo aprendices de " + f);
    assert.equal(built.rows[0].sum.intentos, i + 1); assert.equal(built.rows[1].sum.intentos, 0); assert.equal(built.huerfanos.length, 0);
    assert.ok(built.rows.every((r) => r.attempts.every((a) => a.ficha === f)));
  });
});

test("T18 aprendiz sin intentos: se muestra 'Sin intentos sincronizados', sin puntaje (no 0) y sin afirmar que no practico", () => {
  const T = panel();
  T.state.deps = { users: [{ usernameKey: "sin", fullName: "Sin Intentos", ficha: "3441939", uid: "US" }] };
  const row = T.buildRows("3441939", []).rows[0];
  assert.equal(row.sum.intentos, 0); assert.equal(row.sum.mejor, null); assert.equal(row.sum.ultimo, null);
  assert.equal(Att.cellStatus(row.sum.actividades["laptop/ensamble"]).label, "Sin intentos sincronizados");
  const src = fs.readFileSync(path.join(ROOT, "js/admin_hwlab_tracking.js"), "utf8") + fs.readFileSync(path.join(ROOT, "js/hardware_lab_progress_view.js"), "utf8");
  assert.equal(/no realiz[oó] la actividad<|No practic[oó]/.test(src), false);
  assert.match(src, /<strong>no<\/strong> que el aprendiz no haya realizado la actividad/);
  assert.equal(/Sin registros/.test(src.replace(/sin_registros/g, "")), false, "ya no se usa la redaccion 'Sin registros'");
});

test("T19 panel del instructor: por aprendiz muestra total de intentos, mejor y ultimo por separado, y el historial completo", () => {
  const T = panel();
  T.state.deps = { users: [{ usernameKey: "ana.gomez", fullName: "Ana Gomez", ficha: "3441939", uid: "UA" }] };
  const intentos = [mk("UA", "ana.gomez", "3441939", 90, "2026-10-01T10:00:00.000Z"), mk("UA", "ana.gomez", "3441939", 54, "2026-10-01T11:00:00.000Z"), mk("UA", "ana.gomez", "3441939", 63, "2026-10-01T12:00:00.000Z", "disassembly-guided")];
  const r = T.buildRows("3441939", intentos).rows[0];
  assert.equal(r.sum.intentos, 3); assert.equal(r.sum.mejor, 100); assert.equal(r.sum.ultimo, 70, "ultimo != mejor: no se elige una nota definitiva");
  assert.equal(r.sum.historial.length, 3, "no se oculta ningun intento");
  assert.equal(r.sum.actividades["laptop/ensamble"].intentos, 2); assert.equal(r.sum.actividades["laptop/ensamble"].mejor, 100); assert.equal(r.sum.actividades["laptop/ensamble"].ultimo, 60);
  assert.equal(Att.cellStatus(r.sum.actividades["laptop/desensamble"]).label, "Aprobado");
  assert.equal(r.sum.progreso.completadas + "/" + r.sum.progreso.total, "2/7");
});

// ── 20. Recuperacion posterior ──────────────────────────────────────────────
test("T20 recuperacion posterior: dias despues, en el mismo navegador y con la identidad correcta, salen todos los pendientes una vez", async () => {
  const db = memDb(); db.modo = "denied"; const b = browser({ db });
  terminar(b, "aaaa3001", "2026-09-30T19:53:45.102Z", "disassembly-guided", 67); terminar(b, "aaaa3002", "2026-09-30T20:09:28.340Z", "assembly-guided", 52); terminar(b, "aaaa3003", "2026-09-30T20:31:18.450Z", "maintenance-guided", 67); await settle();
  assert.equal(Object.keys(cola(b)).length, 3); assert.equal(db.docs.size, 0);
  const serializada = b.store.getItem(b.qkey("ana.gomez")); // lo que queda en disco al cerrar el navegador
  const despues = memStore(); despues.setItem(b.qkey("ana.gomez"), serializada);
  db.modo = "ok"; // el instructor ya habilito la cuenta
  const b2 = browser({ db, store: despues }); const r = await b2.A.flushNow(); await b2.A.flushNow();
  assert.equal(r.created, 3); assert.equal(db.docs.size, 3); assert.equal(Object.keys(cola(b2)).length, 0);
  assert.deepEqual([...db.docs.values()].map((d) => [d.practica, d.rawScore, d.fechaInicio]).sort(), [["assembly-guided", 52, "2026-09-30T20:09:28.340Z"], ["disassembly-guided", 67, "2026-09-30T19:53:45.102Z"], ["maintenance-guided", 67, "2026-09-30T20:31:18.450Z"]]);
});

// ── Privacidad: la cola y el documento no llevan credenciales ───────────────
test("T21 privacidad: ni la cola ni el documento guardan contraseñas, tokens ni correos; el modulo no escribe en consola", async () => {
  const db = memDb(); db.modo = "denied"; const b = browser({ db });
  terminar(b, "aaaa4001"); await settle();
  const crudo = b.store.getItem(b.qkey("ana.gomez"));
  assert.equal(/password|token|@sena-portal|refresh|hash/i.test(crudo), false);
  db.modo = "ok"; await b.A.flushNow();
  assert.equal(/password|token|@sena-portal|refresh|hash/i.test(JSON.stringify([...db.docs.values()])), false);
  assert.equal(/console\.(log|info|warn|error)/.test(SRC), false);
});
