"use strict";

// Proteccion de datos academicos (2026-10-27, segunda unidad): planes de
// mejoramiento, talleres de refuerzo y respuestas de talleres.
// Mismo defecto que las notas: cloudGetImprovementPlans / cloudGetReinforcement-
// Workshops devolvian [] (y cloudGetReinforcementAnswers {}) TAMBIEN cuando la
// lectura fallaba; el modulo copiaba eso al cache y el siguiente cambio
// REEMPLAZABA la lista/mapa completo en la nube.
// Se ejecuta el codigo real de js/firebase_db.js, js/improvement_plans.js y
// js/reinforcement_workshops.js contra un Firestore simulado que honra
// precondiciones y updateMask. Solo datos ficticios; ninguna red.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const USER = "sim.aprendiz";
const PLANS = "sena_portal_improvement_plans/" + USER;
const WS = "sena_portal_reinforcement_workshops/" + USER;
const ANS = "sena_portal_reinforcement_answers/" + USER;
const plain = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Conversion Firestore REST <-> JS (subconjunto que usan las notas) ────────
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
const docFields = (obj) => toFs(obj).mapValue.fields;
const fieldsToObj = (fields) => fromFs({ mapValue: { fields } });

// "grades.`guia-02`" -> ["grades", "guia-02"]
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

// Firestore simulado. hooks.onRequest(method, key, url) puede devolver una
// respuesta falsa o lanzar (fallo de red) para inyectar errores.
function makeFakeFirestore(hooks) {
  const h = hooks || {};
  const store = new Map();
  const log = [];
  let counter = 0;
  const nextUpdateTime = () => "2026-10-27T00:00:00." + String(++counter).padStart(6, "0") + "Z";
  const seed = (key, obj) => store.set(key, { data: plain(obj), updateTime: nextUpdateTime() });
  async function fetchImpl(url, init) {
    let method = (init && init.method) || "GET";
    // :commit (fsCommitStrict) se normaliza a la misma forma que un PATCH con
    // la precondicion y la mascara en la URL, para reutilizar las aserciones.
    if (method === "POST" && /:commit/.test(url)) {
      const w = JSON.parse(init.body).writes[0];
      const docPath = w.update.name.split("/documents/")[1];
      const params = [];
      if (w.currentDocument && w.currentDocument.updateTime) params.push("currentDocument.updateTime=" + encodeURIComponent(w.currentDocument.updateTime));
      if (w.currentDocument && w.currentDocument.exists === false) params.push("currentDocument.exists=false");
      ((w.updateMask && w.updateMask.fieldPaths) || []).forEach((f) => params.push("updateMask.fieldPaths=" + encodeURIComponent(f)));
      const slash = docPath.indexOf("/");
      url = "https://firestore.googleapis.com/v1/projects/x/databases/(default)/documents/" + docPath.slice(0, slash) + "/" + encodeURIComponent(docPath.slice(slash + 1)) + "?" + params.join("&");
      init = { method: "PATCH", body: JSON.stringify({ fields: w.update.fields }), commit: true };
    }
    method = (init && init.method) || "GET";
    const m = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = m[1] + "/" + decodeURIComponent(m[2]);
    const entry = { method, key, url, body: init && init.body ? JSON.parse(init.body) : null };
    log.push(entry);
    if (h.delayMs) await sleep(typeof h.delayMs === "function" ? h.delayMs(method, key) : h.delayMs);
    if (h.onRequest) {
      const forced = await h.onRequest(method, key, url);
      if (forced) return forced;
    }
    if (method === "GET") {
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      const doc = store.get(key);
      return { ok: true, status: 200, json: async () => ({ name: "x/documents/" + key, fields: docFields(doc.data), updateTime: doc.updateTime }) };
    }
    if (method === "PATCH") {
      const current = store.get(key);
      const upd = url.match(/currentDocument\.updateTime=([^&]+)/);
      if (upd && (!current || current.updateTime !== decodeURIComponent(upd[1]))) {
        return { ok: false, status: 400, json: async () => ({ error: { status: "FAILED_PRECONDITION" } }) };
      }
      if (/currentDocument\.exists=false/.test(url) && current) {
        return { ok: false, status: 409, json: async () => ({ error: { status: "ALREADY_EXISTS" } }) };
      }
      const incoming = fieldsToObj(entry.body.fields || {});
      const masks = [...url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map((x) => decodeURIComponent(x[1]));
      let next;
      if (masks.length) {
        next = plain(current ? current.data : {});
        masks.forEach((mask) => {
          const segs = splitFieldPath(mask);
          let src = incoming, dst = next;
          for (let i = 0; i < segs.length - 1; i += 1) {
            src = src && typeof src === "object" ? src[segs[i]] : undefined;
            if (!dst[segs[i]] || typeof dst[segs[i]] !== "object") dst[segs[i]] = {};
            dst = dst[segs[i]];
          }
          const last = segs[segs.length - 1];
          if (src && typeof src === "object" && last in src) dst[last] = src[last];
          else delete dst[last];
        });
      } else {
        next = incoming;
      }
      const updateTime = nextUpdateTime();
      store.set(key, { data: next, updateTime });
      if (init.commit) return { ok: true, status: 200, json: async () => ({ writeResults: [{ updateTime }], commitTime: updateTime }) };
      return { ok: true, status: 200, json: async () => ({ name: "x/documents/" + key, fields: docFields(next), updateTime }) };
    }
    throw new Error("metodo inesperado: " + method);
  }
  return { fetchImpl, store, log, seed, doc: (key) => plain((store.get(key) || {}).data || null) };
}

function makeLocalStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    dump: () => Object.fromEntries(map),
  };
}

// Registros historicos FICTICIOS.
const PLAN_A = { id: "plan_caso311_1", family: "guia-06-mantener-equipos", activityId: "caso311", motivo: "No entrego", fechaLimite: "2026-09-01", historialFechas: [{ fecha: "2026-09-01", cambiadoEn: "2026-08-20T00:00:00.000Z" }], estado: "asignado", entrega: null, resultado: "D", resultadoEn: "2026-09-05T00:00:00.000Z" };
const PLAN_B = { id: "plan_arbol312_2", family: "guia-01-induccion", activityId: "arbol312", motivo: "No entrego", fechaLimite: "2026-10-30", historialFechas: [], estado: "asignado", entrega: null, resultado: "", resultadoEn: "" };
const WS_A = { id: "taller_redes_1", workshopKey: "redes", title: "Taller redes", fechaLimite: "2026-10-01", historialFechas: [], estado: "asignado", entrega: { entregadoEn: "2026-09-30T00:00:00.000Z", archivo: "" }, resultado: "A", resultadoEn: "x" };
const WS_B = { id: "taller_excel_2", workshopKey: "excel", title: "Taller Excel", fechaLimite: "2026-11-15", historialFechas: [], estado: "asignado", entrega: null, resultado: "", resultadoEn: "" };

// Un equipo: firebase_db + los dos modulos reales. Los temporizadores largos
// (reintentos automaticos >= 10 s) se capturan; los cortos (espera entre
// reintentos por conflicto) corren de verdad.
function loadDevice(fake, opts) {
  const options = opts || {};
  const localStorage = options.localStorage || makeLocalStorage();
  const retryTimers = [];
  const events = [];
  const toasts = [];
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout: (fn, ms) => { if (ms >= 10000) { retryTimers.push(fn); return 900000 + retryTimers.length; } return setTimeout(fn, ms); },
    clearTimeout: (id) => { if (id < 900000) clearTimeout(id); },
    addEventListener: () => {},
    dispatchEvent: (ev) => { events.push(ev); return true; },
    location: { href: "https://example.test/panel.html" },
    portalFirebaseAuth: {
      currentUid: () => "uid-x",
      getIdToken: async () => "token-x",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {
      getCurrentSession: () => ({ role: options.role || "admin", usernameKey: options.sessionUser }),
      getStudentStorageKey: (u, k, o) => `sena_portal:student:${u}:${(o && o.area) || "app"}:${k}`,
    },
    portalSaveStatus: { error: (m) => toasts.push(["error", m]), saved: (m) => toasts.push(["saved", m]), saving() {} },
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fake.fetchImpl,
    setTimeout: windowObj.setTimeout,
    clearTimeout: windowObj.clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    URL,
  };
  windowObj.fetch = fake.fetchImpl;
  vm.createContext(sandbox);
  for (const f of ["guide_merge_utils.js", "firebase_db.js", "improvement_plans.js", "reinforcement_workshops.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox);
  }
  if (options.withoutStrictApi) {
    ["createRecordListSync", "cloudGetImprovementPlansStrict", "cloudGetReinforcementWorkshopsStrict", "cloudGetReinforcementAnswersStrict", "cloudSaveReinforcementAnswerFields"]
      .forEach((k) => { delete windowObj._firebaseDb[k]; });
  }
  return {
    db: windowObj._firebaseDb,
    plans: windowObj.improvementPlans,
    ws: windowObj.reinforcementWorkshops,
    localStorage, retryTimers, events, toasts,
    window: windowObj,
  };
}

const patches = (fake) => fake.log.filter((e) => e.method === "PATCH");
const gets = (fake) => fake.log.filter((e) => e.method === "GET");
const response = (status, errorStatus) => ({ ok: false, status, json: async () => ({ error: { status: errorStatus || "" } }) });
const ids = (list) => plain((list || []).map((r) => r.id).sort());   // plain: arrays de otro realm de vm
const seedPlans = (fake, list) => fake.seed(PLANS, { usernameKey: USER, plans: list, updatedAt: "x" });
const seedWs = (fake, list) => fake.seed(WS, { usernameKey: USER, workshops: list, updatedAt: "x" });
const newPlan = (activityId) => ({ family: "guia-02-herramientas", activityId, motivo: "Prueba", fechaLimite: "2026-12-01", now: Date.parse("2026-10-27T12:00:00Z") + activityId.length });

// ── Planes de mejoramiento ───────────────────────────────────────────────────
test("P01 lectura correcta SIN registros (documento inexistente) se distingue de una lectura fallida y se crea con exists=false", async () => {
  const fake = makeFakeFirestore();
  const dev = loadDevice(fake);
  const read = await dev.plans.refreshStudentPlansFromCloud(USER);
  assert.equal(read.status, "missing");
  assert.deepEqual(plain(read.list), []);
  const r = await dev.plans.createPlan(USER, newPlan("sistemas332"));
  assert.equal(r.ok, true);
  assert.equal(r.opOutcome, "applied");
  assert.match(patches(fake)[0].url, /currentDocument\.exists=false/);
  assert.deepEqual(ids(fake.doc(PLANS).plans), [r.record.id]);
});

test("P02 lista vacia REAL ([] guardado) es 'found', no error; lista con datos se conserva al crear", async () => {
  const fake = makeFakeFirestore();
  seedPlans(fake, []);
  const dev = loadDevice(fake);
  assert.equal((await dev.db.cloudGetImprovementPlansStrict(USER)).status, "found");
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const r = await dev.plans.createPlan(USER, newPlan("sistemas332"));
  assert.equal(r.ok, true);
  assert.deepEqual(ids(fake.doc(PLANS).plans), ids([PLAN_A, PLAN_B, r.record]));
  const masks = [...patches(fake)[0].url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map((x) => decodeURIComponent(x[1])).sort();
  assert.deepEqual(masks, ["plans", "updatedAt", "usernameKey"]);
  assert.match(patches(fake)[0].url, /currentDocument\.updateTime=/);
});

const READ_FAILURES = [
  ["lectura fallida (500)", () => response(500), /servidor de Firestore no respondio/],
  ["cuota agotada (429)", () => response(429, "RESOURCE_EXHAUSTED"), /cuota diaria/],
  ["permiso denegado (403)", () => response(403, "PERMISSION_DENIED"), /permiso/],
  ["conexion interrumpida", () => { throw new TypeError("Failed to fetch"); }, /conexion/],
];
for (const [name, failure, re] of READ_FAILURES) {
  test("P03 " + name + ": CERO escrituras en crear/modificar/eliminar; nada se reporta como guardado; la nube queda intacta", async () => {
    const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? failure() : null) });
    seedPlans(fake, [PLAN_A, PLAN_B]);
    const dev = loadDevice(fake);
    const read = await dev.plans.refreshStudentPlansFromCloud(USER);
    assert.equal(read.status, "error");
    assert.equal(read.list, null, "nunca se sustituye por []");
    assert.match(read.message, re);
    for (const op of [
      () => dev.plans.createPlan(USER, newPlan("sistemas332")),
      () => dev.plans.setPlanResult(USER, PLAN_B.id, "A"),
      () => dev.plans.updatePlanDeadline(USER, PLAN_B.id, "2026-12-24"),
      () => dev.plans.deletePlan(USER, PLAN_A.id),
    ]) {
      const r = await op();
      assert.equal(r.ok, false);
      assert.equal(r.status, "read-failed");
      assert.ok(r.message.length > 10);
    }
    assert.equal(patches(fake).length, 0);
    assert.deepEqual(plain(fake.doc(PLANS).plans), plain([PLAN_A, PLAN_B]));
    assert.equal(dev.plans.getPendingPlansCount(USER), 4, "los 4 cambios quedan pendientes, no se pierden");
  });
}

test("P04 escritura fallida (503 y red): no-ok, pendiente, reintento programado, nube intacta", async () => {
  for (const failure of [() => response(503, "UNAVAILABLE"), () => { throw new TypeError("Failed to fetch"); }]) {
    const fake = makeFakeFirestore({ onRequest: (method) => (method === "PATCH" ? failure() : null) });
    seedPlans(fake, [PLAN_A]);
    const dev = loadDevice(fake);
    const r = await dev.plans.createPlan(USER, newPlan("sistemas332"));
    assert.equal(r.ok, false);
    assert.equal(r.status, "write-failed");
    assert.equal(r.pending, 1);
    assert.equal(dev.retryTimers.length, 1, "un reintento automatico programado");
    assert.deepEqual(ids(fake.doc(PLANS).plans), [PLAN_A.id]);
  }
});

test("P05 datos incompletos (plans no es lista / registro sin id): CERO escrituras y sin reintento en bucle", async () => {
  for (const doc of [{ usernameKey: USER, plans: "corrupto" }, { usernameKey: USER }, { usernameKey: USER, plans: [{ motivo: "sin id" }] }]) {
    const fake = makeFakeFirestore();
    fake.seed(PLANS, doc);
    const dev = loadDevice(fake);
    const r = await dev.plans.createPlan(USER, newPlan("sistemas332"));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "incomplete");
    assert.match(r.message, /incompletos/);
    assert.equal(patches(fake).length, 0);
    assert.equal(dev.retryTimers.length, 0);
  }
});

test("P06 dos equipos a la vez (crear en uno, cambiar fecha y eliminar en otro): ningun registro se pierde ni revive", async () => {
  const fake = makeFakeFirestore({ delayMs: (method) => (method === "GET" ? 15 : 1) });
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const a = loadDevice(fake);
  const b = loadDevice(fake);
  const [ra, rb] = await Promise.all([
    a.plans.createPlan(USER, newPlan("sistemas332")),
    b.plans.updatePlanDeadline(USER, PLAN_B.id, "2026-12-24"),
  ]);
  assert.ok(ra.ok && rb.ok);
  const [rc, rd] = await Promise.all([
    a.plans.deletePlan(USER, PLAN_A.id),
    b.plans.setPlanResult(USER, PLAN_B.id, "A"),
  ]);
  assert.ok(rc.ok && rd.ok);
  const cloud = fake.doc(PLANS).plans;
  assert.deepEqual(ids(cloud), ids([PLAN_B, ra.record]));
  const b2 = cloud.find((p) => p.id === PLAN_B.id);
  assert.equal(b2.fechaLimite, "2026-12-24");
  assert.equal(b2.resultado, "A");
  assert.ok(patches(fake).length > 4, "hubo conflictos resueltos releyendo");
});

test("P07 recuperacion sin duplicados: la escritura SI se aplico pero la respuesta se perdio; el reintento no duplica", async () => {
  let dropResponse = true;
  const fake = makeFakeFirestore();
  const realFetch = fake.fetchImpl;
  fake.fetchImpl = async (url, init) => {
    const res = await realFetch(url, init);
    const isWrite = init && (init.method === "PATCH" || /:commit/.test(String(url)));
    if (isWrite && dropResponse) { dropResponse = false; throw new TypeError("respuesta perdida (la escritura se aplico)"); }
    return res;
  };
  seedPlans(fake, [PLAN_A]);
  const dev = loadDevice(fake);
  const r1 = await dev.plans.createPlan(USER, newPlan("sistemas332"));
  assert.equal(r1.ok, false, "sin respuesta no se puede afirmar que se guardo");
  const r2 = await dev.plans.updatePlanDeadline(USER, PLAN_A.id, "2026-11-11");   // cambio extra mientras tanto
  assert.equal(r2.ok, true);
  const cloud = fake.doc(PLANS).plans;
  assert.equal(cloud.filter((p) => p.id === r1.record.id).length, 1, "el plan existe UNA sola vez");
  assert.equal(cloud.find((p) => p.id === PLAN_A.id).historialFechas.filter((h) => h.fecha === "2026-11-11").length, 1);
  assert.equal(dev.plans.getPendingPlansCount(USER), 0);
});

test("P08 recarga de pagina: los cambios pendientes sobreviven y se envian despues, en orden", async () => {
  let offline = true;
  const fake = makeFakeFirestore({ onRequest: () => (offline ? response(503) : null) });
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const first = loadDevice(fake);
  const created = await first.plans.createPlan(USER, newPlan("sistemas332"));
  await first.plans.deletePlan(USER, PLAN_B.id);
  assert.equal(first.plans.getPendingPlansCount(USER), 2);
  offline = false;
  const reloaded = loadDevice(fake, { localStorage: first.localStorage });
  assert.equal(reloaded.plans.getPendingPlansCount(USER), 2);
  const [r] = await reloaded.plans.retryPendingPlansSync();
  assert.equal(r.ok, true);
  assert.deepEqual(ids(fake.doc(PLANS).plans), ids([PLAN_A, created.record]));
  assert.equal(reloaded.localStorage.getItem("sena_portal_improvement_plans_pending_ops_v1"), null);
});

test("P09 eliminacion LEGITIMA: borra solo ese plan, incluso con cache vacio; eliminar uno inexistente no toca nada", async () => {
  const fake = makeFakeFirestore();
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const dev = loadDevice(fake);
  dev.plans.setStudentPlans(USER, []);   // cache vacio/viejo
  const r = await dev.plans.deletePlan(USER, PLAN_A.id);
  assert.equal(r.ok, true);
  assert.equal(r.opOutcome, "applied");
  assert.deepEqual(ids(fake.doc(PLANS).plans), [PLAN_B.id]);
  const writes = patches(fake).length;
  const again = await dev.plans.deletePlan(USER, PLAN_A.id);
  assert.equal(again.opOutcome, "missing");
  assert.equal(patches(fake).length, writes, "sin cambios no se escribe");
  assert.deepEqual(ids(fake.doc(PLANS).plans), [PLAN_B.id]);
});

test("P10 conservacion de historicos: cache vacio tras lectura caida + plan nuevo => al volver la red se conservan todos", async () => {
  let readsFail = true;
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" && readsFail ? response(429) : null) });
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const dev = loadDevice(fake);
  dev.plans.setStudentPlans(USER, []);
  const r1 = await dev.plans.createPlan(USER, newPlan("sistemas332"));
  assert.equal(r1.ok, false);
  readsFail = false;
  const [r2] = await dev.plans.retryPendingPlansSync();
  assert.equal(r2.ok, true);
  const cloud = fake.doc(PLANS).plans;
  assert.deepEqual(ids(cloud), ids([PLAN_A, PLAN_B, r1.record]));
  assert.deepEqual(plain(cloud.find((p) => p.id === PLAN_A.id)), plain(PLAN_A), "el historico queda identico");
  assert.deepEqual(ids(dev.plans.getStudentPlans(USER)), ids(cloud), "cache = nube confirmada");
});

test("P11 guardia de integridad: una mutacion que pierde registros no pedidos se rechaza sin escribir", async () => {
  const fake = makeFakeFirestore();
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const dev = loadDevice(fake);
  const r = await dev.db.cloudUpdateRecordListStrict("sena_portal_improvement_plans", USER, "plans", () => ({ list: [PLAN_B], removedIds: [] }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, "integrity");
  assert.equal(patches(fake).length, 0);
});

test("P12 intentos repetidos acotados: con la nube caida se detienen tras 8 reintentos automaticos", async () => {
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? response(503) : null) });
  seedPlans(fake, [PLAN_A]);
  const dev = loadDevice(fake);
  await dev.plans.createPlan(USER, newPlan("sistemas332"));
  let fired = 0;
  while (dev.retryTimers.length && fired < 50) {
    const fn = dev.retryTimers.shift();
    fn();
    fired += 1;
    await sleep(5);
  }
  assert.equal(fired, 8);
  assert.equal(gets(fake).length, 9, "1 intento + 8 automaticos; despues solo con accion del usuario");
  assert.equal(patches(fake).length, 0);
  assert.equal(dev.plans.getPendingPlansCount(USER), 1, "el cambio sigue pendiente, no se pierde");
});

test("P13 aprendiz: lectura fallida no vacia su cache de planes (banners se conservan); no escribe nunca", async () => {
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? response(503) : null) });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.plans.setStudentPlans(USER, [PLAN_A, PLAN_B]);
  await dev.plans.renderMyPlanBannersForFile("x.html");
  assert.deepEqual(ids(dev.plans.getStudentPlans(USER)), ids([PLAN_A, PLAN_B]));
  assert.equal(patches(fake).length, 0);
});

test("P14 firebase_db.js antiguo en cache (sin API estricta): NO cae al reemplazo completo", async () => {
  const fake = makeFakeFirestore();
  seedPlans(fake, [PLAN_A]);
  const dev = loadDevice(fake, { withoutStrictApi: true });
  let legacy = 0;
  dev.db.cloudSaveImprovementPlans = async () => { legacy += 1; return true; };
  const r = await dev.plans.createPlan(USER, newPlan("sistemas332"));
  assert.equal(r.ok, false);
  assert.equal(r.status, "unsupported");
  assert.equal(legacy, 0);
  assert.equal(patches(fake).length, 0);
});

// ── Talleres de refuerzo ─────────────────────────────────────────────────────
test("T01 creacion, edicion de fecha, entrega, resultado y eliminacion autorizada sobre la version real", async () => {
  const fake = makeFakeFirestore();
  seedWs(fake, [WS_A]);
  const dev = loadDevice(fake);
  const c = await dev.ws.createWorkshop(USER, { workshopKey: "excel", title: "Taller Excel", fechaLimite: "2026-11-15" });
  assert.equal(c.ok, true);
  const id = c.record.id;
  assert.equal((await dev.ws.updateWorkshopDeadline(USER, id, "2026-11-30")).ok, true);
  assert.equal((await dev.ws.markWorkshopDelivered(USER, id)).ok, true);
  assert.equal((await dev.ws.setWorkshopResult(USER, id, "D")).ok, true);
  let cloud = fake.doc(WS).workshops;
  const w = cloud.find((x) => x.id === id);
  assert.equal(w.fechaLimite, "2026-11-30");
  assert.equal(w.historialFechas.length, 2);
  assert.ok(w.entrega && w.entrega.entregadoEn);
  assert.equal(w.resultado, "D");
  assert.deepEqual(plain(cloud.find((x) => x.id === WS_A.id)), plain(WS_A), "el taller anterior queda identico");
  assert.equal((await dev.ws.deleteWorkshop(USER, id)).ok, true);
  cloud = fake.doc(WS).workshops;
  assert.deepEqual(ids(cloud), [WS_A.id]);
});

test("T02 anti-duplicados decidido por la NUBE: con cache vacio no se crea un segundo taller activo del mismo tipo", async () => {
  const fake = makeFakeFirestore();
  seedWs(fake, [WS_A, WS_B]);
  const dev = loadDevice(fake);
  dev.ws.setStudentWorkshops(USER, []);
  const r = await dev.ws.createWorkshop(USER, { workshopKey: "excel", title: "Taller Excel", fechaLimite: "2026-12-01" });
  assert.equal(r.ok, true);
  assert.equal(r.opOutcome, "duplicate-active");
  assert.equal(patches(fake).length, 0);
  const again = await dev.ws.createWorkshop(USER, { workshopKey: "redes", title: "Taller redes", fechaLimite: "2026-12-01" });
  assert.equal(again.opOutcome, "applied", "redes estaba cerrado (A): se puede reasignar");
});

test("T03 lecturas/escrituras fallidas: ninguna operacion de talleres borra o sobrescribe", async () => {
  for (const [method, failure] of [["GET", () => response(429)], ["GET", () => response(403)], ["PATCH", () => response(503)], ["GET", () => { throw new TypeError("offline"); }]]) {
    const fake = makeFakeFirestore({ onRequest: (m) => (m === method ? failure() : null) });
    seedWs(fake, [WS_A, WS_B]);
    const dev = loadDevice(fake);
    const results = [
      await dev.ws.createWorkshop(USER, { workshopKey: "python", fechaLimite: "2026-12-01" }),
      await dev.ws.deleteWorkshop(USER, WS_B.id),
      await dev.ws.setWorkshopResult(USER, WS_B.id, "A"),
    ];
    assert.ok(results.every((r) => !r.ok && r.message));
    assert.deepEqual(plain(fake.doc(WS).workshops), plain([WS_A, WS_B]));
  }
});

test("T04 cambios concurrentes en talleres desde dos equipos + recuperacion", async () => {
  let offline = false;
  const fake = makeFakeFirestore({ delayMs: (m) => (m === "GET" ? 12 : 1), onRequest: () => (offline ? response(503) : null) });
  seedWs(fake, [WS_A, WS_B]);
  const a = loadDevice(fake);
  const b = loadDevice(fake);
  const [r1, r2] = await Promise.all([
    a.ws.createWorkshop(USER, { workshopKey: "python", fechaLimite: "2026-12-01" }),
    b.ws.markWorkshopDelivered(USER, WS_B.id),
  ]);
  assert.ok(r1.ok && r2.ok);
  offline = true;
  const r3 = await a.ws.setWorkshopResult(USER, WS_B.id, "A");
  assert.equal(r3.ok, false);
  offline = false;
  const [r4] = await a.ws.retryPendingWorkshopsSync();
  assert.equal(r4.ok, true);
  const cloud = fake.doc(WS).workshops;
  assert.deepEqual(ids(cloud), ids([WS_A, WS_B, r1.record]));
  const wb = cloud.find((x) => x.id === WS_B.id);
  assert.ok(wb.entrega, "la entrega registrada por el otro equipo se conserva");
  assert.equal(wb.resultado, "A");
});

test("T05 pagina del aprendiz: lectura de talleres fallida conserva el cache (no muestra 'sin talleres' por error)", async () => {
  const fake = makeFakeFirestore({ onRequest: (m) => (m === "GET" ? response(503) : null) });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.ws.setStudentWorkshops(USER, [WS_A, WS_B]);
  const list = await dev.ws.syncStudentWorkshopsFromCloud(USER);
  assert.deepEqual(ids(list), ids([WS_A, WS_B]));
});

// ── Respuestas de talleres (escribe el aprendiz) ─────────────────────────────
const ANSWERS = {
  [WS_A.id]: { taller_redes_1__ip: "192.168.1.1", taller_redes_1__mascara: "255.255.255.0" },
  [WS_B.id]: { "taller_excel_2__formula-1": "=SUMA(A1:A3)" },
};

test("R01 guardar respuestas con cache VACIO (lectura fallida) solo envia los campos cambiados; no borra otros talleres ni campos", async () => {
  const fake = makeFakeFirestore();
  fake.seed(ANS, { usernameKey: USER, answers: ANSWERS, updatedAt: "x" });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.ws.setStudentAnswers(USER, {});   // lo que dejaba la version anterior
  dev.ws.saveWorkshopAnswers(USER, WS_A.id, { taller_redes_1__gateway: "192.168.1.254" });
  const r = await dev.ws.flushWorkshopAnswers(USER, WS_A.id);
  assert.equal(r.ok, true);
  const cloud = fake.doc(ANS).answers;
  assert.deepEqual(plain(cloud[WS_B.id]), ANSWERS[WS_B.id], "las respuestas de otro taller se conservan");
  assert.equal(cloud[WS_A.id].taller_redes_1__ip, "192.168.1.1", "campos no tocados se conservan");
  assert.equal(cloud[WS_A.id].taller_redes_1__gateway, "192.168.1.254");
  const masks = [...patches(fake)[0].url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map((x) => decodeURIComponent(x[1])).sort();
  assert.deepEqual(masks, ["answers.taller_redes_1.taller_redes_1__gateway", "updatedAt", "usernameKey"]);
  assert.equal(gets(fake).length, 0, "guardar respuestas no cuesta lecturas");
});

test("R02 lectura de respuestas fallida no vacia el cache; un guardado fallido queda pendiente y se reenvia al volver", async () => {
  let offline = true;
  const fake = makeFakeFirestore({ onRequest: () => (offline ? response(503) : null) });
  fake.seed(ANS, { usernameKey: USER, answers: ANSWERS, updatedAt: "x" });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.ws.setStudentAnswers(USER, plain(ANSWERS));
  const read = await dev.ws.refreshStudentAnswersFromCloud(USER);
  assert.equal(read.status, "error");
  assert.deepEqual(plain(dev.ws.getStudentAnswers(USER)), ANSWERS, "cache intacto");
  dev.ws.saveWorkshopAnswers(USER, WS_B.id, { "taller_excel_2__formula-1": "=SUMA(A1:A9)" });
  const failed = await dev.ws.flushWorkshopAnswers(USER, WS_B.id);
  assert.equal(failed.ok, false);
  assert.equal(failed.pending, 1);
  assert.ok(dev.toasts.some(([kind, msg]) => kind === "error" && /solo en este equipo/.test(msg)), "se avisa al aprendiz");
  offline = false;
  const answers = await dev.ws.syncStudentAnswersFromCloud(USER);   // al reabrir la pagina
  assert.equal(answers[WS_B.id]["taller_excel_2__formula-1"], "=SUMA(A1:A9)", "lo pendiente se superpone a lo leido");
  await sleep(10);
  assert.equal(fake.doc(ANS).answers[WS_B.id]["taller_excel_2__formula-1"], "=SUMA(A1:A9)");
  assert.deepEqual(plain(fake.doc(ANS).answers[WS_A.id]), ANSWERS[WS_A.id]);
  assert.ok(dev.toasts.some(([kind]) => kind === "saved"));
});

test("R03 borrar un campo de respuesta es explicito; el resto del taller queda", async () => {
  const fake = makeFakeFirestore();
  fake.seed(ANS, { usernameKey: USER, answers: ANSWERS, updatedAt: "x" });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.ws.setStudentAnswers(USER, plain(ANSWERS));
  dev.ws.saveWorkshopAnswers(USER, WS_A.id, { taller_redes_1__ip: "192.168.1.1" });   // quito mascara
  assert.equal((await dev.ws.flushWorkshopAnswers(USER, WS_A.id)).ok, true);
  const a = fake.doc(ANS).answers[WS_A.id];
  assert.equal(a.taller_redes_1__ip, "192.168.1.1");
  assert.equal("taller_redes_1__mascara" in a, false);
  assert.deepEqual(plain(fake.doc(ANS).answers[WS_B.id]), ANSWERS[WS_B.id]);
});

test("R04 admin: si la lectura de respuestas falla se informa, no se muestra '(sin respuesta)'", () => {
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  const fn = admin.match(/async function showWorkshopAnswers\([\s\S]*?\n  \}/)[0];
  assert.match(fn, /No se pudieron leer las respuestas del aprendiz/);
  assert.match(fn, /mgr\.refreshStudentAnswersFromCloud\(usernameKey\)/);
});

// ── Panel: resultado real y sin lecturas repetidas ──────────────────────────
test("U01 panel: planes/talleres anuncian exito solo con confirmacion y no releen la ficha tras cada accion", () => {
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  for (const name of ["handlePlanGridClick", "handleWorkshopGridClick"]) {
    const fn = admin.match(new RegExp("async function " + name + "\\(event\\) \\{[\\s\\S]*?\\n  \\}"))[0];
    assert.match(fn, /announceRecordOp\(describeRecordOpResult\(result, okMsg/);
    assert.match(fn, /if \(result && result\.ok && audit\) recordAdminAuditAction\(audit\)/);
    assert.doesNotMatch(fn.split("data-records-retry")[1], /renderPlansGrid\(\);\s*\}\s*else|renderWorkshopsGrid\(\);\s*\}\s*else/);
  }
  assert.match(admin, /addEventListener\("change", paintPlansGrid\)/);
  assert.match(admin, /addEventListener\("change", paintWorkshopsGrid\)/);
  const assign = admin.match(/async function handleAssignPlan\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(assign, /result = await mgr\.createPlan\(/);
  assert.doesNotMatch(assign, /setStatus\("Plan asignado\."\)/);
});

test("R05 respuestas: la escritura por campo NO manda un respaldo parcial a Drive (reemplazaria la copia)", async () => {
  const fake = makeFakeFirestore();
  fake.seed(ANS, { usernameKey: USER, answers: ANSWERS, updatedAt: "x" });
  const backups = [];
  const realFetch = fake.fetchImpl;
  fake.fetchImpl = async (url, init) => {
    if (String(url).startsWith("https://script.google.com/")) { backups.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; }
    return realFetch(url, init);
  };
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.window.PROJECT_INTEGRATIONS = { respaldoFirestoreUrl: "https://script.google.com/macros/s/simulado/exec" };
  dev.ws.saveWorkshopAnswers(USER, WS_A.id, { taller_redes_1__ip: "10.0.0.1" });
  assert.equal((await dev.ws.flushWorkshopAnswers(USER, WS_A.id)).ok, true);
  await sleep(10);
  assert.equal(backups.length, 0);
});

test("P15 planes: el respaldo de Drive recibe la lista COMPLETA confirmada", async () => {
  const fake = makeFakeFirestore();
  seedPlans(fake, [PLAN_A, PLAN_B]);
  const backups = [];
  const realFetch = fake.fetchImpl;
  fake.fetchImpl = async (url, init) => {
    if (String(url).startsWith("https://script.google.com/")) { backups.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; }
    return realFetch(url, init);
  };
  const dev = loadDevice(fake);
  dev.window.PROJECT_INTEGRATIONS = { respaldoFirestoreUrl: "https://script.google.com/macros/s/simulado/exec" };
  const r0 = await dev.plans.createPlan(USER, newPlan("respaldo1"));
  assert.equal(r0.ok, true);
  await sleep(10);
  assert.equal(backups.length, 1, "un respaldo por escritura confirmada");
  assert.deepEqual(ids(backups[0].data.plans), ids([PLAN_A, PLAN_B, r0.record]), "lista completa, no un fragmento");
});
