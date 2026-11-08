"use strict";
// Correccion critica 2026-11-08 (Codex NO FAVORABLE sobre 1feadb9 + 28fba33):
// la actualizacion selectiva de respuestas modelo de Redes 11.° debe ser ATOMICA
// (transaccion de Firestore con precondicion de version) y NO debe dejar
// reintentos automaticos (sin cola persistente, sin reejecucion al recargar).
//
// Se ejecuta el codigo REAL de js/firebase_db.js + js/activity_grades.js contra
// un Firestore SIMULADO que implementa beginTransaction / batchGet en la
// transaccion / commit en la transaccion (aborta si un documento leido cambio)
// / rollback, y las precondiciones currentDocument.updateTime. Datos ficticios.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const plain = (v) => JSON.parse(JSON.stringify(v));
const FAM = "guia-redes11-rap02";
const ACT = "c11Taller331";
const USER = "sim.aprendiz.11a";
const OTHER = "sim.otro.11b";
const ORIGINAL = "2026-10-01T15:00:00.000Z";
const BANK = {
  [FAM]: { [ACT]: { g11c_331_e1_cidr: "/25", g11c_331_e1_mascara: "255.255.255.128", __criterios: "rubrica interna" }, c11LanA321: { g11c_321_q1: "LAN" } },
  "guia-redes11-rap01": { b11TallerIP334: { b11_ip: "x" } },
};
const AUTHORIZED = { g11c_331_e1_cidr: "/25", g11c_331_e1_mascara: "255.255.255.128" };

function toFs(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFs) } };
  const fields = {};
  Object.keys(val).forEach((k) => { fields[k] = toFs(val[k]); });
  return { mapValue: { fields } };
}
function fromFs(v) {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fromFs);
  const out = {};
  Object.entries((v.mapValue && v.mapValue.fields) || {}).forEach(([k, x]) => { out[k] = fromFs(x); });
  return out;
}
function splitFieldPath(p) {
  const out = [];
  let i = 0;
  while (i < p.length) {
    if (p[i] === "`") {
      let j = i + 1, seg = "";
      while (p[j] !== "`") { if (p[j] === "\\") j += 1; seg += p[j]; j += 1; }
      out.push(seg); i = j + 2;
    } else {
      const j = p.indexOf(".", i);
      out.push(p.slice(i, j === -1 ? p.length : j)); i = j === -1 ? p.length : j + 1;
    }
  }
  return out;
}
const err = (status, code) => ({ ok: false, status, json: async () => ({ error: { status: code } }) });

// Firestore simulado con transacciones optimistas (como el REST real: el commit
// de una transaccion falla con ABORTED si un documento leido en ella cambio).
function makeFirestore(seed) {
  const store = new Map();
  let clock = 0;
  const next = () => "2026-11-08T00:00:00." + String(++clock).padStart(6, "0") + "Z";
  const put = (key, data) => store.set(key, { data: plain(data), updateTime: next() });
  Object.entries(seed || {}).forEach(([k, v]) => put(k, v));
  const txs = new Map();
  const log = [];
  const hooks = {};
  const fsDoc = (key) => { const d = store.get(key); return { name: "projects/test-project/databases/(default)/documents/" + key, fields: toFs(d.data).mapValue.fields, updateTime: d.updateTime }; };
  async function fetchImpl(url, init) {
    const method = (init && init.method) || "GET";
    const body = init && init.body ? JSON.parse(init.body) : null;
    const op = (url.match(/documents:([a-zA-Z]+)\?/) || [])[1] || "";
    log.push({ method, op, url, body });
    if (op === "beginTransaction") {
      if (hooks.beginFails) throw new Error("red");
      const id = "tx-" + (txs.size + 1);
      txs.set(id, { reads: {}, open: true });
      return { ok: true, status: 200, json: async () => ({ transaction: id }) };
    }
    if (op === "batchGet") {
      const tx = body.transaction && txs.get(body.transaction);
      const rows = body.documents.map((name) => {
        const key = name.split("/documents/")[1];
        if (!store.has(key)) return { missing: name };
        if (tx) tx.reads[key] = store.get(key).updateTime;
        return { found: fsDoc(key) };
      });
      return { ok: true, status: 200, json: async () => rows };
    }
    if (op === "rollback") { const tx = txs.get(body.transaction); if (tx) tx.open = false; return { ok: true, status: 200, json: async () => ({}) }; }
    if (op === "commit") {
      if (hooks.beforeCommit) await hooks.beforeCommit({ store, put });
      if (hooks.commitNetworkBeforeApply) throw new Error("red");
      if (hooks.commit500) return err(503, "UNAVAILABLE");
      const tx = body.transaction ? txs.get(body.transaction) : null;
      if (body.transaction) {
        if (!tx || !tx.open) return err(400, "INVALID_ARGUMENT");
        tx.open = false;
        for (const [key, t] of Object.entries(tx.reads)) {
          if (!store.has(key) || store.get(key).updateTime !== t) return err(409, "ABORTED");
        }
      }
      const w = body.writes[0];
      const key = w.update.name.split("/documents/")[1];
      const cur = store.get(key);
      if (w.currentDocument && w.currentDocument.updateTime && (!cur || cur.updateTime !== w.currentDocument.updateTime)) return err(400, "FAILED_PRECONDITION");
      if (w.currentDocument && w.currentDocument.exists === false && cur) return err(409, "ALREADY_EXISTS");
      const incoming = fromFs({ mapValue: { fields: w.update.fields } });
      const nextData = plain(cur ? cur.data : {});
      ((w.updateMask && w.updateMask.fieldPaths) || []).forEach((mask) => {
        const segs = splitFieldPath(mask);
        let src = incoming, dst = nextData;
        for (let i = 0; i < segs.length - 1; i++) { src = src && src[segs[i]]; if (!dst[segs[i]] || typeof dst[segs[i]] !== "object") dst[segs[i]] = {}; dst = dst[segs[i]]; }
        const last = segs[segs.length - 1];
        if (src && last in src) dst[last] = src[last]; else delete dst[last];
      });
      put(key, nextData);
      const ut = store.get(key).updateTime;
      if (hooks.commitNetworkAfterApply) throw new Error("red tras aplicar");
      return { ok: true, status: 200, json: async () => ({ writeResults: [{ updateTime: ut }], commitTime: ut }) };
    }
    if (method === "GET") {
      if (hooks.failGet) throw new Error("red");
      const m = url.match(/documents\/([^/?]+)\/([^?]+)/);
      const key = m[1] + "/" + decodeURIComponent(m[2]);
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => fsDoc(key) };
    }
    if (method === "PATCH") throw new Error("PATCH inesperado: " + url);
    throw new Error("peticion inesperada " + method + " " + url);
  }
  return { fetchImpl, store, log, hooks, put, data: (key) => plain((store.get(key) || {}).data || null), commits: () => log.filter((e) => e.op === "commit").length };
}

function memStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), dump: () => Object.fromEntries(map) };
}

// La actualizacion selectiva esta BLOQUEADA en el codigo publicado (sin fuente
// autoritativa aprendiz-ficha). Para seguir probando la transaccion conservada, SOLO
// en esta prueba se expone la implementacion interna en lugar del envoltorio bloqueado.
const EXPORT_LINE = "cloudAddModelSolutionAtomic: cloudAddModelSolutionAtomic,";
function loadDevice(fake, localStorage, opts) {
  const shipped = Boolean(opts && opts.shipped);
  const timers = [];
  const w = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage, setTimeout, clearTimeout, addEventListener: () => {}, dispatchEvent: () => true,
    location: { href: "https://example.test/panel-administrativo-usuarios.html" },
    portalFirebaseAuth: { currentUid: () => "uid-admin", getIdToken: async () => "token-admin", waitForAuthHydration: async () => true, buildEmail: (k) => k + "@sena-portal.local" },
    portalAuth: { getCurrentSession: () => ({ role: "admin", usernameKey: "dubier" }), getStudentStorageKey: (u, k, o) => `sena_portal:student:${u}:${(o && o.area) || "app"}:${k}` },
  };
  const sandbox = {
    window: w, localStorage, fetch: fake.fetchImpl,
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, URL,
  };
  w.fetch = fake.fetchImpl;
  vm.createContext(sandbox);
  for (const f of ["guide_merge_utils.js", "firebase_db.js", "activity_grades.js"]) {
    let src = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
    if (f === "firebase_db.js" && !shipped) {
      assert.equal(src.split(EXPORT_LINE).length, 2, "export unico de cloudAddModelSolutionAtomic");
      src = src.replace(EXPORT_LINE, "cloudAddModelSolutionAtomic: addModelSolutionTransaction,");
    }
    vm.runInContext(src, sandbox);
  }
  return { db: w._firebaseDb, mgr: w.activityGradesManager, timers, localStorage };
}

function seedDocs() {
  return {
    ["sena_portal_grades/" + USER]: { usernameKey: USER, grades: {
      [FAM]: { [ACT]: "A", [ACT + ":gradedAt"]: ORIGINAL, [ACT + ":obs"]: "Buen trabajo", c11LanA321: "D", "c11LanA321:gradedAt": ORIGINAL, c11Lab341: "" },
      "guia-redes11-rap01": { b11TallerIP334: "A", "b11TallerIP334:gradedAt": ORIGINAL },
      "guia-02-herramientas": { a: "A", "a:gradedAt": ORIGINAL },
    } },
    ["sena_portal_grades/" + OTHER]: { usernameKey: OTHER, grades: { [FAM]: { [ACT]: "A", [ACT + ":gradedAt"]: ORIGINAL } } },
    "sena_portal_grade_solutions/bank": { solutions: BANK },
  };
}

// Igual que handleModelAnswerPreview: lectura estricta de nota y banco, con sus versiones.
async function preview(dev, user, act) {
  const read = await dev.db.cloudGetGradesStrict(user || USER);
  const bank = await dev.db.cloudGetGradeSolutionsVersioned();
  const before = plain((read.grades || {})[FAM] || {});
  const a = act || ACT;
  const plan = dev.mgr.planModelAnswerAddition(before, a, ((bank.solutions || {})[FAM] || {})[a]);
  const prev = before[a + ":solution"];
  return { plan, before, expected: { gradesUpdateTime: read.updateTime, bankUpdateTime: bank.updateTime, gradedAt: String(before[a + ":gradedAt"] || ""), previousSolution: prev === undefined ? null : prev, solution: plan.solution } };
}

test("6. nota A sin cambios + solucion autorizada: actualizacion atomica correcta; solo :solution, sin __criterios", async () => {
  const fake = makeFirestore(seedDocs());
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  assert.equal(p.plan.status, "ready");
  const r = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected);
  assert.equal(r.status, "ok", JSON.stringify(r));
  const doc = fake.data("sena_portal_grades/" + USER);
  const fam = doc.grades[FAM];
  assert.deepEqual(fam[ACT + ":solution"], AUTHORIZED);
  assert.equal(fam[ACT + ":gradedAt"], ORIGINAL);
  assert.equal(fam[ACT + ":obs"], "Buen trabajo");
  const expected = seedDocs()["sena_portal_grades/" + USER].grades;
  const withoutSol = plain(fam); delete withoutSol[ACT + ":solution"];
  assert.deepEqual(withoutSol, expected[FAM]);
  assert.deepEqual(doc.grades["guia-redes11-rap01"], expected["guia-redes11-rap01"]);
  assert.deepEqual(doc.grades["guia-02-herramientas"], expected["guia-02-herramientas"]);
  // 8. otras fichas / aprendices / banco intactos
  assert.deepEqual(fake.data("sena_portal_grades/" + OTHER), seedDocs()["sena_portal_grades/" + OTHER]);
  assert.deepEqual(fake.data("sena_portal_grade_solutions/bank"), seedDocs()["sena_portal_grade_solutions/bank"]);
  // una sola transaccion: begin -> batchGet(tx) -> commit(tx) con precondicion; sin PATCH ni Drive
  const commit = fake.log.find((e) => e.op === "commit");
  assert.ok(commit.body.transaction, "commit dentro de la transaccion");
  assert.equal(commit.body.writes.length, 1);
  assert.equal(commit.body.writes[0].currentDocument.updateTime, p.expected.gradesUpdateTime);
  assert.deepEqual(commit.body.writes[0].updateMask.fieldPaths, ["grades.`guia-redes11-rap02`", "updatedAt"]);
  assert.ok(fake.log.find((e) => e.op === "batchGet").body.transaction, "lecturas dentro de la transaccion");
  assert.ok(!fake.log.some((e) => e.method === "PATCH" || /script\.google/.test(e.url)));
  assert.equal(dev.mgr.getPendingGradesCount(), 0);
  assert.equal(dev.localStorage.getItem("sena_portal_grades_pending_ops_v1"), null);
  assert.ok(!JSON.stringify(doc).includes("rubrica interna"));
});

test("1. otra sesion cambia la solucion despues de la vista previa: rechazada sin escribir", async () => {
  const fake = makeFirestore(seedDocs());
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  const d = fake.data("sena_portal_grades/" + USER); d.grades[FAM][ACT + ":solution"] = { otra: "sesion" };
  fake.put("sena_portal_grades/" + USER, d);
  const snapshot = fake.data("sena_portal_grades/" + USER);
  const r = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected);
  assert.equal(r.status, "changed");
  assert.equal(fake.commits(), 0);
  assert.ok(fake.log.some((e) => e.op === "rollback"));
  assert.deepEqual(fake.data("sena_portal_grades/" + USER), snapshot);
  // aunque la version coincidiera, la solucion existente debe ser la de la vista previa
  const fake2 = makeFirestore(seedDocs());
  const dev2 = loadDevice(fake2, memStorage());
  const p2 = await preview(dev2);
  p2.expected.previousSolution = { mostrada: "otra" };
  assert.equal((await dev2.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p2.expected)).status, "changed");
  assert.equal(fake2.commits(), 0);
});

test("1b. el cambio llega ENTRE la lectura transaccional y el commit: la transaccion aborta (sin escritura)", async () => {
  const fake = makeFirestore(seedDocs());
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  fake.hooks.beforeCommit = ({ store, put }) => { const d = plain(store.get("sena_portal_grades/" + USER).data); d.grades[FAM][ACT + ":solution"] = { carrera: "1" }; put("sena_portal_grades/" + USER, d); };
  const r = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected);
  assert.equal(r.status, "changed");
  assert.deepEqual(fake.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], { carrera: "1" }, "se conserva lo de la otra sesion");
  // el banco cambiado en la carrera tambien aborta
  const fake2 = makeFirestore(seedDocs());
  const dev2 = loadDevice(fake2, memStorage());
  const p2 = await preview(dev2);
  fake2.hooks.beforeCommit = ({ store, put }) => { put("sena_portal_grade_solutions/bank", store.get("sena_portal_grade_solutions/bank").data); };
  assert.equal((await dev2.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p2.expected)).status, "changed");
  assert.equal(fake2.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], undefined);
});

test("2. otra sesion cambia la nota o la fecha (o el banco autorizado): rechazada sin escribir", async () => {
  const cases = [
    (d) => { d.grades[FAM][ACT] = "D"; },
    (d) => { d.grades[FAM][ACT + ":gradedAt"] = "2026-11-08T12:00:00.000Z"; },
    (d) => { d.grades[FAM][ACT + ":obs"] = "otra observacion"; },
  ];
  for (const mutate of cases) {
    const fake = makeFirestore(seedDocs());
    const dev = loadDevice(fake, memStorage());
    const p = await preview(dev);
    const d = fake.data("sena_portal_grades/" + USER); mutate(d); fake.put("sena_portal_grades/" + USER, d);
    const snap = fake.data("sena_portal_grades/" + USER);
    assert.equal((await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected)).status, "changed");
    assert.equal(fake.commits(), 0);
    assert.deepEqual(fake.data("sena_portal_grades/" + USER), snap);
  }
  // misma version pero fecha distinta a la mostrada (vista previa manipulada) => rechazada
  const fake = makeFirestore(seedDocs());
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  assert.equal((await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, Object.assign({}, p.expected, { gradedAt: "2026-11-08T00:00:00Z" }))).status, "changed");
  // banco con nueva version tras la vista previa
  const bank = fake.data("sena_portal_grade_solutions/bank"); bank.solutions[FAM][ACT].g11c_331_e1_cidr = "/26";
  fake.put("sena_portal_grade_solutions/bank", bank);
  assert.equal((await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected)).status, "changed");
  // solucion distinta a la autorizada por el banco (misma version) => rechazada
  const fake3 = makeFirestore(seedDocs());
  const dev3 = loadDevice(fake3, memStorage());
  const p3 = await preview(dev3);
  assert.equal((await dev3.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, Object.assign({}, p3.expected, { solution: { g11c_331_e1_cidr: "/30" } }))).status, "changed");
  // identidad / familia / actividad no permitidas
  assert.equal((await dev3.db.cloudAddModelSolutionAtomic(USER, "guia-02-herramientas", "a", p3.expected)).reason, "invalid-args");
  assert.equal((await dev3.db.cloudAddModelSolutionAtomic(OTHER, FAM, ACT, p3.expected)).status, "changed", "otro aprendiz: otra version de documento");
  assert.equal(fake3.commits(), 0);
  assert.deepEqual(fake3.data("sena_portal_grades/" + OTHER), seedDocs()["sena_portal_grades/" + OTHER]);
});

test("3-4. escritura fallida: nada pendiente; recargar la pagina no reintenta", async () => {
  for (const hook of ["commit500", "beginFails"]) {
    const fake = makeFirestore(seedDocs());
    const ls = memStorage();
    const dev = loadDevice(fake, ls);
    const p = await preview(dev);
    fake.hooks[hook] = true;
    const r = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected);
    assert.ok(r.status === "uncertain" || r.status === "error", hook + " " + r.status);
    assert.equal(fake.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], undefined);
    assert.equal(ls.getItem("sena_portal_grades_pending_ops_v1"), null, "sin cola persistente");
    assert.equal(dev.mgr.getPendingGradesCount(), 0);
    assert.equal(dev.timers.length, 0, "sin temporizadores de reintento");
    // "recarga": un equipo nuevo con el mismo almacenamiento; la red vuelve
    fake.hooks[hook] = false;
    const before = fake.log.length;
    const dev2 = loadDevice(fake, ls);
    await dev2.mgr.retryPendingGradesSync();
    dev2.timers.forEach((fn) => fn());
    await new Promise((res) => setImmediate(res));
    assert.equal(fake.log.slice(before).filter((e) => e.op === "commit" || e.method === "PATCH").length, 0, hook + ": sin reintento automatico");
    assert.equal(fake.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], undefined);
  }
});

test("4b. un intento selectivo pendiente de la version anterior (cola) se neutraliza sin tocar operaciones legitimas", async () => {
  const fake = makeFirestore(seedDocs());
  const legacyOp = { id: "old-1", family: FAM, set: { [ACT + ":solution"]: { viejo: "x" } }, del: [], at: "2026-11-08T06:00:00Z", requireApproved: ACT };
  const legitOp = { id: "ok-1", family: "guia-02-herramientas", set: { b: "D", "b:gradedAt": "2026-11-08T06:00:00Z" }, del: [], at: "2026-11-08T06:00:00Z" };
  const ls = memStorage({ sena_portal_grades_pending_ops_v1: JSON.stringify({ [USER]: [legacyOp, legitOp] }) });
  const dev = loadDevice(fake, ls);
  assert.equal(dev.mgr.getNeutralizedSelectiveOpsCount(), 1);
  assert.equal(dev.mgr.getPendingGradesCount(USER), 1);
  assert.deepEqual(JSON.parse(ls.getItem("sena_portal_grades_pending_ops_v1"))[USER].map((o) => o.id), ["ok-1"], "persistido sin la operacion antigua");
  const r = await dev.mgr.flushGradesCloudSync(USER);
  assert.equal(r.ok, true);
  const g = fake.data("sena_portal_grades/" + USER).grades;
  assert.equal(g[FAM][ACT + ":solution"], undefined, "la operacion antigua nunca se aplica");
  assert.equal(g["guia-02-herramientas"].b, "D", "la operacion legitima si se aplica");
  assert.equal(g[FAM][ACT + ":gradedAt"], ORIGINAL);
});

test("5. error de conexion con resultado incierto: no se duplica; el estado real se consulta y una nueva confirmacion se rechaza o no hace falta", async () => {
  // a) el commit SI se aplico pero la respuesta se perdio
  const fake = makeFirestore(seedDocs());
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  fake.hooks.commitNetworkAfterApply = true;
  assert.equal((await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected)).status, "uncertain");
  fake.hooks.commitNetworkAfterApply = false;
  const after = await dev.db.cloudGetGradesStrict(USER);
  assert.equal(dev.mgr.verifyModelAnswerAddition(p.before, after.grades[FAM], ACT, AUTHORIZED).ok, true, "la consulta muestra que ya quedo");
  // reenviar la MISMA autorizacion no duplica: la version cambio -> rechazada
  assert.equal((await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p.expected)).status, "changed");
  assert.equal(fake.commits(), 1, "el segundo intento ni siquiera llega a enviarse");
  // una nueva vista previa indica que ya no hace falta
  assert.equal((await preview(dev)).plan.status, "already-present");
  // b) el commit NO se aplico y la respuesta se perdio: nada escrito, nada pendiente
  const fake2 = makeFirestore(seedDocs());
  const ls2 = memStorage();
  const dev2 = loadDevice(fake2, ls2);
  const p2 = await preview(dev2);
  fake2.hooks.commitNetworkBeforeApply = true;
  assert.equal((await dev2.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p2.expected)).status, "uncertain");
  fake2.hooks.commitNetworkBeforeApply = false;
  assert.equal(fake2.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], undefined);
  assert.equal(ls2.getItem("sena_portal_grades_pending_ops_v1"), null);
  assert.equal(dev2.timers.length, 0);
  // solo una NUEVA vista previa + confirmacion expresa puede escribir
  const p3 = await preview(dev2);
  assert.equal(p3.plan.status, "ready");
  assert.equal((await dev2.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, p3.expected)).status, "ok");
  assert.deepEqual(fake2.data("sena_portal_grades/" + USER).grades[FAM][ACT + ":solution"], AUTHORIZED);
});

test("7. operacion repetida con solucion identica: sin escrituras innecesarias", async () => {
  const docs = seedDocs();
  docs["sena_portal_grades/" + USER].grades[FAM][ACT + ":solution"] = AUTHORIZED;
  const fake = makeFirestore(docs);
  const dev = loadDevice(fake, memStorage());
  const p = await preview(dev);
  assert.equal(p.plan.status, "already-present");
  // incluso si se forzara la llamada, la transaccion detecta que ya esta y no escribe
  const forced = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, ACT, Object.assign({}, p.expected, { solution: AUTHORIZED }));
  assert.equal(forced.status, "already-present");
  assert.equal(fake.commits(), 0);
  assert.deepEqual(fake.data("sena_portal_grades/" + USER), docs["sena_portal_grades/" + USER]);
});

test("pendiente o no aprobada: la vista previa no habilita; la transaccion tampoco escribiria", async () => {
  for (const act of ["c11LanA321", "c11Lab341"]) {
    const fake = makeFirestore(seedDocs());
    const dev = loadDevice(fake, memStorage());
    const p = await preview(dev, USER, act);
    assert.equal(p.plan.status, "not-approved", act);
    const forced = await dev.db.cloudAddModelSolutionAtomic(USER, FAM, act, Object.assign({}, p.expected, { solution: { g11c_321_q1: "LAN" } }));
    assert.equal(forced.status, "changed", act);
    assert.equal(fake.commits(), 0);
  }
});

test("el panel usa SOLO la transaccion atomica: sin cola, sin reintentos y autorizacion de un solo uso", () => {
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  const start = admin.indexOf("async function handleModelAnswerApply(");
  const apply = admin.slice(start, admin.indexOf("\n  function patchGuideState(", start));
  assert.match(apply, /resetModelAnswerPlan\("Guardando[^"]*"\);\s*\/\/ autorizacion consumida[\s\S]*cloudAddModelSolutionAtomic/, "la autorizacion se consume antes de escribir");
  assert.doesNotMatch(apply, /flushGradesCloudSync|queueGradeOp|applyStudentGradeChanges|setStudentActivityGradeAndSolution|retryPendingGradesSync|setTimeout|setInterval|indexedDB|localStorage/);
  assert.equal((apply.match(/cloudAddModelSolutionAtomic\(/g) || []).length, 1, "un unico intento por confirmacion");
  assert.match(apply, /La información cambió\. Vuelva a consultar la vista previa\.|MODEL_ANSWER_CHANGED_MSG/);
  assert.match(admin, /const MODEL_ANSWER_CHANGED_MSG = "La información cambió\. Vuelva a consultar la vista previa\.";/);
  const dbSrc = fs.readFileSync(path.join(ROOT, "js", "firebase_db.js"), "utf8");
  const fnStart = dbSrc.indexOf("async function addModelSolutionTransaction(");
  const fn = dbSrc.slice(fnStart, dbSrc.indexOf("// BLOQUEADA (correccion final", fnStart));
  assert.ok(fn.length > 2000, "transaccion conservada");
  assert.doesNotMatch(fn, /backupWriteToDrive|recordPendingFirestorePromote|driveDb|setTimeout|strictRetryDelay|for \(var attempt/, "sin respaldo diferido ni reintentos");
});

// ── Correccion final 2026-11-08: identidad y ficha (dictamen de Codex sobre 7102485) ──
// No existe fuente autoritativa aprendiz-ficha => la actualizacion selectiva queda
// BLOQUEADA en todos los casos (incluso el "correcto"): cero peticiones, cero escrituras.
test("identidad-ficha: no hay fuente autoritativa; el propio aprendiz puede reescribir su ficha (reglas vigentes)", () => {
  const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
  const users = rules.slice(rules.indexOf("match /sena_portal_users/{usernameKey}"), rules.indexOf("match /sena_portal_user_auth/"));
  assert.match(users, /allow create, update: if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\);/, "sena_portal_users.ficha escribible por el aprendiz");
  const index = rules.slice(rules.indexOf("match /sena_portal_user_index/{uid}"));
  assert.match(index.slice(0, 200), /allow read, write: if signedIn\(\) && \(request\.auth\.uid == uid \|\| isAdmin\(\)\);/, "user_index.ficha escribible por el aprendiz");
  // si algun dia las reglas cambian, esta prueba avisa para revisar el bloqueo
});

test("identidad-ficha: el codigo publicado BLOQUEA toda actualizacion selectiva sin tocar la red (ficha correcta, trasladado, cambiada tras la vista previa, inexistente, sin vinculo)", async () => {
  const docs = seedDocs();
  const fake = makeFirestore(docs);
  const dev = loadDevice(fake, memStorage(), { shipped: true });
  const p = await preview(dev);
  assert.equal(p.plan.status, "ready", "la vista previa sigue siendo solo lectura");
  const before = fake.log.length;
  const cases = [
    [USER, FAM, ACT, p.expected],                                    // aprendiz en la ficha correcta
    [OTHER, FAM, ACT, p.expected],                                   // trasladado / otra ficha
    ["no.existe", FAM, ACT, p.expected],                             // usuario inexistente
    ["", FAM, ACT, p.expected],                                      // identidad incompleta
    [USER, FAM, ACT, Object.assign({}, p.expected, { gradesUpdateTime: "otra" })], // version cambiada
  ];
  for (const c of cases) {
    const r = await dev.db.cloudAddModelSolutionAtomic(...c);
    assert.equal(r.status, "blocked", JSON.stringify(c.slice(0, 2)));
    assert.equal(r.reason, "sin-fuente-autoritativa-aprendiz-ficha");
  }
  assert.equal(fake.log.length, before, "ninguna peticion a Firestore");
  assert.equal(fake.commits(), 0);
  assert.deepEqual(fake.data("sena_portal_grades/" + USER), docs["sena_portal_grades/" + USER]);
  assert.deepEqual(fake.data("sena_portal_grades/" + OTHER), docs["sena_portal_grades/" + OTHER]);
  assert.equal(dev.mgr.getPendingGradesCount(), 0);
});

test("identidad-ficha: el panel deshabilita la herramienta (controles, vista previa y confirmacion) y lo explica", () => {
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  assert.match(admin, /const MODEL_ANSWER_SELECTIVE_BLOCKED = true;/);
  const bind = admin.slice(admin.indexOf("function bindModelAnswerTool("), admin.indexOf("async function handleModelAnswerPreview("));
  assert.match(bind, /if \(MODEL_ANSWER_SELECTIVE_BLOCKED\) \{[\s\S]*el\.disabled = true[\s\S]*return;\s*\}/);
  const preview = admin.slice(admin.indexOf("async function handleModelAnswerPreview("), admin.indexOf("async function handleModelAnswerApply("));
  assert.match(preview.slice(0, 200), /if \(MODEL_ANSWER_SELECTIVE_BLOCKED\) \{ resetModelAnswerPlan\(MODEL_ANSWER_BLOCKED_MSG\); return; \}/);
  const apply = admin.slice(admin.indexOf("async function handleModelAnswerApply("));
  assert.match(apply.slice(0, 200), /if \(MODEL_ANSWER_SELECTIVE_BLOCKED\) \{ resetModelAnswerPlan\(MODEL_ANSWER_BLOCKED_MSG\); return; \}/);
  assert.match(admin, /fuente autoritativa de la relacion aprendiz-ficha/);
});
