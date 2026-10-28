"use strict";

// Optimizaciones de consumo Firebase (2026-10-28). Cada prueba verifica el
// AHORRO y, sobre todo, que la optimizacion NUNCA interpreta un error de
// lectura como ausencia de datos ni debilita las protecciones de notas,
// planes, talleres y respuestas. Codigo real contra un Firestore simulado
// (precondiciones, updateMask, runQuery y batchGet). Datos ficticios.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const plain = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
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

// Amplia el Firestore simulado con :runQuery y :batchGet (lo minimo que usan
// el listado del panel y la lectura detallada en lote).
function withQueries(fake) {
  const base = fake.fetchImpl;
  fake.fetchImpl = async (url, init) => {
    const u = String(url);
    if (u.includes(":runQuery")) {
      fake.log.push({ method: "RUNQUERY", key: "", url: u });
      if (fake.failQuery && fake.failQuery(JSON.parse(init.body))) return { ok: false, status: 503, json: async () => ({}) };
      const q = JSON.parse(init.body).structuredQuery;
      const col = q.from[0].collectionId;
      const filters = [];
      const w = q.where || {};
      (w.compositeFilter ? w.compositeFilter.filters : [w]).forEach((f) => { if (f && f.fieldFilter) filters.push(f.fieldFilter); });
      const rows = [];
      for (const [key, doc] of fake.store) {
        if (!key.startsWith(col + "/")) continue;
        const id = key.slice(col.length + 1);
        const name = "projects/x/databases/(default)/documents/" + key;
        const okAll = filters.every((f) => {
          if (f.field.fieldPath === "__name__") {
            const ref = f.value.referenceValue.split("/documents/")[1].slice(col.length + 1);
            return f.op === "GREATER_THAN_OR_EQUAL" ? id >= ref : id < ref;
          }
          const v = doc.data[f.field.fieldPath];
          if (f.op === "GREATER_THAN_OR_EQUAL") return typeof v === "string" && v >= f.value.stringValue;
          return true;
        });
        if (okAll) rows.push({ document: { name, fields: docFields(doc.data), updateTime: doc.updateTime } });
      }
      return { ok: true, status: 200, json: async () => (rows.length ? rows : [{ readTime: "x" }]) };
    }
    if (u.includes(":batchGet")) {
      const names = JSON.parse(init.body).documents;
      fake.log.push({ method: "BATCHGET", key: "", url: u, docs: names.length });
      if (fake.failBatch && fake.failBatch(names)) return { ok: false, status: 503, json: async () => ({}) };
      const out = names.map((name) => {
        const key = name.split("/documents/")[1];
        const doc = fake.store.get(key);
        return doc ? { found: { name, fields: docFields(doc.data), updateTime: doc.updateTime } } : { missing: name };
      });
      return { ok: true, status: 200, json: async () => out };
    }
    return base(url, init);
  };
  return fake;
}

function makeLocalStorage(init) {
  const m = new Map(init ? Object.entries(init) : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), get length() { return m.size; }, key: (i) => Array.from(m.keys())[i] || null };
}

// Instancia de firebase_db (+ modulos) con sesion configurable.
function loadDb(fake, opts) {
  const o = opts || {};
  const localStorage = o.localStorage || makeLocalStorage();
  const session = o.session || { role: "admin", usernameKey: "dubier" };
  const auth = Object.assign({
    getCurrentSession: () => session,
    getStudentStorageKey: (u, k, x) => `sena_portal:student:${u}:${(x && x.area) || "app"}:${k}`,
    getGuidesForFicha: () => (o.guides || []),
    getGuideTitle: (f) => f,
    writeGuideProgress() {},
    getUsers: () => [],
    GUIDE_PROGRESS_CONFIG: {},
  }, o.auth || {});
  const w = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "x", apiKey: "k" }, localStorage,
    setTimeout, clearTimeout, addEventListener() {}, dispatchEvent() { return true; },
    location: { href: "https://example.test/x" },
    portalFirebaseAuth: { currentUid: () => o.uid || "uid-admin", getIdToken: async () => "tok", waitForAuthHydration: async () => true, buildEmail: (k) => k + "@sena-portal.local" },
    portalAuth: auth,
  };
  const sb = { window: w, localStorage, fetch: fake.fetchImpl, setTimeout, clearTimeout, console: { info() {}, warn() {}, error() {}, log() {} }, CustomEvent: function (t, i) { this.type = t; this.detail = i && i.detail; }, document: { addEventListener() {}, dispatchEvent() {}, querySelector: () => null, querySelectorAll: () => [] }, URL, navigator: { onLine: true } };
  Object.assign(sb, o.globals || {});
  w.fetch = fake.fetchImpl; w.navigator = sb.navigator;
  vm.createContext(sb);
  (o.files || ["guide_merge_utils.js", "firebase_db.js"]).forEach((f) => vm.runInContext(read("js/" + f), sb));
  return { db: w._firebaseDb, w, auth, localStorage, sb };
}
const gets = (fake, frag) => fake.log.filter((e) => e.method === "GET" && e.key.includes(frag)).length;
const writes = (fake, frag) => fake.log.filter((e) => e.method === "PATCH" && e.key.includes(frag)).length;
const queries = (fake) => fake.log.filter((e) => e.method === "RUNQUERY").length;
const GD = (key, file, ts, state) => ["sena_portal_progress/__guide_data__:student:" + key + ":" + file.replace(/\./g, "_"),
  { _usernameKey: "x", usernameKey: "x", _kind: "guide-data", scopeKey: "student:" + key, fileName: file, updatedAt: ts, snapshotJson: JSON.stringify({ state: state, updatedAt: ts }) }];

// ── 4. Lecturas duplicadas ───────────────────────────────────────────────────
test("O4a scope compartido (admin:activity-deadlines) ya NO busca users/admin:..., y el uid de un aprendiz se recuerda solo si se encontro", async () => {
  const fake = withQueries(makeFakeFirestore());
  fake.seed("sena_portal_users/ana", { usernameKey: "ana", uid: "uid-ana" });
  const { db } = loadDb(fake);
  await db.cloudGetGuideData("admin:activity-deadlines", "__activity_deadlines__");
  assert.equal(gets(fake, "sena_portal_users/admin"), 0, "no se consulta un usuario inexistente");
  await db.cloudGetGuideData("student:ana", "g1.html");
  await db.cloudGetGuideData("student:ana", "g2.html");
  assert.equal(gets(fake, "sena_portal_users/ana"), 1, "uid de ana leido una sola vez");
  await db.cloudGetGuideData("student:beto", "g1.html");
  await db.cloudGetGuideData("student:beto", "g2.html");
  assert.equal(gets(fake, "sena_portal_users/beto"), 2, "un perfil inexistente NO se recuerda como 'sin uid': se vuelve a consultar");
});

test("O4b la restauracion del aprendiz reutiliza el perfil ya leido (1 lectura de users en vez de 2)", () => {
  const src = read("js/firebase_db.js");
  assert.match(src, /async function restoreStudentFromCloud\(usernameKey, ficha, knownCloudUser\)/);
  assert.match(src, /var cloudUser = knownCloudUser \|\| await cloudGetUser\(usernameKey\);/);
  assert.match(src, /await restoreStudentFromCloud\(usernameKey, ficha, cloudUser\);/);
});

test("O4c/d/e memorias breves: solo reutilizan respuestas CONFIRMADAS (fechas, notas del aprendiz, resumen)", () => {
  const dl = read("js/activity_deadlines.js");
  assert.match(dl, /lastCloudLoadAt = cloudSnapshot \? Date\.now\(\) : 0;/, "fechas: un null (fallo o ausencia) no se memoriza");
  const ag = read("js/activity_grades.js");
  assert.match(ag, /if \(!result\) delete gradesFetchMemo\[usernameKey\];/, "notas: un null no se memoriza");
  const ss = read("js/student_summary.js");
  assert.match(ss, /if \(!r\) summaryMemo = null;/);
  assert.match(ss, /function \(e\) \{ summaryMemo = null; throw e; \}/);
});

test("O4d notas del aprendiz: insignias y bloqueo comparten UNA lectura; un fallo NO se reutiliza", async () => {
  const fake = withQueries(makeFakeFirestore());
  fake.seed("sena_portal_grades/ana", { usernameKey: "ana", grades: { fam: { a1: "A" } }, updatedAt: "x" });
  const { w } = loadDb(fake, { session: { role: "student", usernameKey: "ana", user: { usernameKey: "ana" } }, files: ["guide_merge_utils.js", "firebase_db.js", "activity_grades.js"] });
  const mgr = w.activityGradesManager;
  await Promise.all([mgr.renderGradeBadges({ guideFamily: "fam", activities: [] }), mgr.renderGradeBadges({ guideFamily: "fam", activities: [] })]);
  await mgr.renderGradeBadges({ guideFamily: "fam", activities: [] });
  assert.equal(gets(fake, "sena_portal_grades/ana"), 1, "tres llamadas en la misma carga = una lectura");
  // Con la nube caida la lectura falla -> no se memoriza -> se reintenta
  const fake2 = withQueries(makeFakeFirestore({ onRequest: (m) => (m === "GET" ? { ok: false, status: 503, json: async () => ({}) } : null) }));
  const two = loadDb(fake2, { session: { role: "student", usernameKey: "ana", user: { usernameKey: "ana" } }, files: ["guide_merge_utils.js", "firebase_db.js", "activity_grades.js"] });
  await two.w.activityGradesManager.renderGradeBadges({ guideFamily: "fam", activities: [] });
  await two.w.activityGradesManager.renderGradeBadges({ guideFamily: "fam", activities: [] });
  assert.ok(gets(fake2, "sena_portal_grades/ana") >= 2, "un fallo no se reutiliza");
});

// ── 5. Progreso sin cambios ──────────────────────────────────────────────────
async function studentPage(fake, progress) {
  if (progress) fake.seed("sena_portal_progress/ana", Object.assign({ usernameKey: "ana" }, progress));
  fake.seed("sena_portal_users/ana", { usernameKey: "ana", ficha: "f1" });
  const env = loadDb(fake, { session: { role: "student", usernameKey: "ana", user: { usernameKey: "ana", ficha: "f1" } }, guides: ["g1.html"], uid: "uid-ana" });
  await sleep(900); // la restauracion de carga corre a los ~500 ms
  return env;
}
test("O5 progreso: abrir la guia con el MISMO avance que la nube no escribe; un avance distinto si", async () => {
  const fake = withQueries(makeFakeFirestore());
  const env = await studentPage(fake, { g1_html: { completed: 3, total: 10, percent: 30 } });
  const before = writes(fake, "sena_portal_progress/ana");
  env.auth.writeGuideProgress("g1.html", { completed: 3, total: 10 });
  await sleep(1500);
  assert.equal(writes(fake, "sena_portal_progress/ana"), before, "sin cambios: 0 escrituras");
  env.auth.writeGuideProgress("g1.html", { completed: 4, total: 10 });
  await sleep(1500);
  assert.equal(writes(fake, "sena_portal_progress/ana"), before + 1, "avance distinto: se escribe");
  env.auth.writeGuideProgress("g1.html", { completed: 4, total: 10 });
  await sleep(1500);
  assert.equal(writes(fake, "sena_portal_progress/ana"), before + 1, "lo recien escrito queda como valor confirmado");
});

test("O5b progreso: si la lectura de la nube FALLO (valor desconocido) se escribe como siempre", async () => {
  let fail = true;
  const fake = withQueries(makeFakeFirestore({ onRequest: (m, key) => (fail && m === "GET" && key === "sena_portal_progress/ana" ? { ok: false, status: 503, json: async () => ({}) } : null) }));
  const env = await studentPage(fake, { g1_html: { completed: 3, total: 10, percent: 30 } });
  fail = false;
  const before = writes(fake, "sena_portal_progress/ana");
  env.auth.writeGuideProgress("g1.html", { completed: 3, total: 10 });
  await sleep(1500);
  assert.equal(writes(fake, "sena_portal_progress/ana"), before + 1, "la duda lleva a escribir, nunca a omitir");
});

// ── 1. Listado incremental del panel ─────────────────────────────────────────
test("O1 listado: 2a consulta trae SOLO lo cambiado y el resultado es identico al listado completo", async () => {
  const fake = withQueries(makeFakeFirestore());
  const old = "2026-01-01T00:00:00.000Z";
  for (let i = 1; i <= 20; i++) { const [k, d] = GD("a" + i, "g1.html", old, { r: "v" + i }); fake.seed(k, d); }
  const { db } = loadDb(fake);
  const full = await db.cloudListAllGuideDataDocs();
  assert.equal(full.status, "ok");
  assert.equal(full.docs.progress.size, 20);
  // un aprendiz guarda (fecha actual) y aparece uno nuevo; el admin escribe -> listado "sucio"
  const now = new Date().toISOString();
  { const [k, d] = GD("a3", "g1.html", now, { r: "CAMBIADO" }); fake.seed(k, d); }
  { const [k, d] = GD("a99", "g1.html", now, { r: "nuevo" }); fake.seed(k, d); }
  await db.cloudSaveGuideData("student:a50", "g9.html", { state: { x: 1 }, updatedAt: now });
  fake.log.length = 0;
  const delta = await db.cloudListAllGuideDataDocs();
  assert.equal(delta.status, "ok");
  assert.equal(delta.delta, true, "consulta incremental");
  assert.ok(delta.stats.firestoreDocs <= 3, "solo los documentos cambiados: " + delta.stats.firestoreDocs);
  const fresh = await db.cloudListAllGuideDataDocs({ force: true });
  const norm = (m) => plain(Array.from(m.entries()).map(([k, v]) => [k, v.snapshotJson]).sort());
  assert.deepEqual(norm(delta.docs.progress), norm(fresh.docs.progress), "incremental == completo");
  assert.match(delta.docs.progress.get("__guide_data__:student:a3:g1_html").snapshotJson, /CAMBIADO/);
});

test("O1b listado: si la consulta incremental falla se hace el listado COMPLETO (nunca se devuelve la base sin verificar)", async () => {
  const fake = withQueries(makeFakeFirestore());
  for (let i = 1; i <= 5; i++) { const [k, d] = GD("a" + i, "g1.html", "2026-01-01T00:00:00.000Z", { r: i }); fake.seed(k, d); }
  const { db } = loadDb(fake);
  await db.cloudListAllGuideDataDocs();
  await db.cloudSaveGuideData("student:z", "g9.html", { state: { x: 1 }, updatedAt: new Date().toISOString() });
  fake.failQuery = (body) => JSON.stringify(body).includes("updatedAt");   // falla solo la incremental
  const r = await db.cloudListAllGuideDataDocs();
  assert.equal(r.status, "ok");
  assert.notEqual(r.delta, true, "se recurrio al listado completo");
  assert.equal(r.docs.progress.size, 6);
});

test("O1c listado: 'Actualizar datos' (force) siempre hace el listado completo; sin cambios se reutiliza en memoria", async () => {
  const fake = withQueries(makeFakeFirestore());
  { const [k, d] = GD("a1", "g1.html", "2026-01-01T00:00:00.000Z", { r: 1 }); fake.seed(k, d); }
  const { db } = loadDb(fake);
  await db.cloudListAllGuideDataDocs();
  fake.log.length = 0;
  const again = await db.cloudListAllGuideDataDocs();
  assert.equal(again.reused, true);
  assert.equal(queries(fake), 0);
  const forced = await db.cloudListAllGuideDataDocs({ force: true });
  assert.notEqual(forced.delta, true);
  assert.ok(queries(fake) >= 2, "listado completo de las dos colecciones");
});

// ── 3. Calificaciones: reutilizar lecturas verificadas ───────────────────────
test("O3 notas del panel: cambiar de guia reutiliza la lectura verificada; 'fresco' relee; un fallo borra lo recordado; escribir sigue releyendo", async () => {
  let down = false;
  const fake = withQueries(makeFakeFirestore({ onRequest: (m) => (down && m === "GET" ? { ok: false, status: 503, json: async () => ({}) } : null) }));
  fake.seed("sena_portal_grades/ana", { usernameKey: "ana", grades: { g2: { a: "A" }, g6: { b: "D" } }, updatedAt: "x" });
  const { w } = loadDb(fake, { files: ["guide_merge_utils.js", "firebase_db.js", "activity_grades.js"] });
  const mgr = w.activityGradesManager;
  const r1 = await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 120000 });
  const r2 = await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 120000 });
  assert.equal(r1.status, "found"); assert.equal(r2.reused, true);
  assert.equal(gets(fake, "sena_portal_grades/ana"), 1);
  await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 0 });
  assert.equal(gets(fake, "sena_portal_grades/ana"), 2, "lectura fresca");
  down = true;
  const bad = await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 0 });
  assert.equal(bad.status, "error");
  const after = await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 120000 });
  assert.equal(after.status, "error", "tras un fallo NO se reutiliza la lectura anterior");
  down = false;
  // La escritura sigue releyendo con precondicion aunque haya lectura reciente
  await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 0 });
  const before = gets(fake, "sena_portal_grades/ana");
  const p = mgr.setStudentActivityGradeAndSolution("ana", "g2", "c", "A", null);
  mgr.flushGradesCloudSync("ana");
  const res = await p;
  assert.equal(res.ok, true);
  assert.equal(gets(fake, "sena_portal_grades/ana"), before + 1, "la escritura releyo la nube");
  const reused = await mgr.refreshStudentGradesFromCloud("ana", { maxAgeMs: 120000 });
  assert.equal(reused.reused, true);
  assert.equal(reused.grades.g2.c, "A", "lo recordado es la version CONFIRMADA tras escribir");
  assert.equal(reused.grades.g6.b, "D");
});

test("O3b panel: 'Volver a leer' y 'Reintentar ahora' piden lectura fresca", () => {
  const admin = read("js/admin_usuarios.js");
  assert.match(admin, /data-grades-reload\]"\)\?\.addEventListener\("click", \(\) => renderGradesGrid\(\{ fresh: true \}\)\)/);
  assert.match(admin, /refreshStudentGradesFromCloud\(user\.usernameKey, \{ maxAgeMs: opts\.fresh \? 0 : GRADES_GRID_REUSE_MS \}\)/);
  const download = admin.match(/async function handleGradesExcelDownload\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(download, /refreshStudentGradesFromCloud\(user\.usernameKey\)/, "la descarga a Excel siempre lee de la nube");
});

// ── 2. Inicio del aprendiz: cache negativa ───────────────────────────────────
function homeHydrator(detailed, storage) {
  const src = read("js/portal_home.js");
  const aliases = src.match(/var REAL_STATE_KEY_ALIASES = \{[\s\S]*?\n  \};/)[0];
  const block = src.match(/var hydrateTriedFiles = \{\};[\s\S]*?(?=\n  \/\/ Devuelve las etiquetas)/)[0];
  const ls = storage || makeLocalStorage();
  const auth = { getStudentStorageKey: (u, k, x) => `s:${u}:${(x && x.area) || "app"}:${k}` };
  const window = { _firebaseDb: { cloudGetGuideData: async () => { throw new Error("no debe usarse"); }, guideDataFileName: (f) => f, cloudReadGuideDataDetailed: detailed }, ActivityStandard: { getStateKeyForGuide: (f) => "st_" + f } };
  const fn = new Function("window", "auth", "localStorage", aliases + "\n" + block + "\nreturn hydrateMissingGuideStates;")(window, auth, ls);
  return { fn, ls };
}
test("O2 inicio: solo un 'missing' CONFIRMADO se recuerda; 'found' se hidrata; un error se reintenta en la siguiente visita", async () => {
  let calls = 0;
  const answers = { "g1.html": { status: "found", data: { state: { r: 1 }, updatedAt: "t" } }, "g2.html": { status: "missing", data: null }, "g3.html": { status: "quota", data: null }, "g4.html": { status: "unverified", data: null } };
  const detailed = async (scope, files) => { calls++; const files2 = {}; files.forEach((f) => { files2[f] = answers[f]; }); return { status: "partial", files: files2 }; };
  const ls = makeLocalStorage();
  const v1 = homeHydrator(detailed, ls);
  const changed = await v1.fn({ usernameKey: "ana" }, ["g1.html", "g2.html", "g3.html", "g4.html"]);
  assert.equal(changed, true);
  assert.ok(ls.getItem("s:ana:guide-data:st_g1.html"), "found -> copia local");
  const neg = JSON.parse(ls.getItem("sena_portal_home_sin_nube_v1:ana"));
  assert.ok(neg["g2.html"], "missing confirmado -> recordado");
  assert.equal(neg["g3.html"], undefined, "cuota agotada NO se recuerda");
  assert.equal(neg["g4.html"], undefined, "sin verificar NO se recuerda");
  // Siguiente visita (pagina nueva, mismo navegador)
  let asked = [];
  const v2 = homeHydrator(async (scope, files) => { asked = files; calls++; return { status: "ok", files: Object.fromEntries(files.map((f) => [f, { status: "missing" }])) }; }, ls);
  await v2.fn({ usernameKey: "ana" }, ["g1.html", "g2.html", "g3.html", "g4.html"]);
  assert.deepEqual(asked.slice().sort(), ["g3.html", "g4.html"], "solo se reintentan las que fallaron");
});

test("O2b inicio: si la consulta en lote lanza o no responde, no se recuerda nada", async () => {
  const ls = makeLocalStorage();
  const v = homeHydrator(async () => { throw new Error("red"); }, ls);
  await v.fn({ usernameKey: "ana" }, ["g1.html", "g2.html"]);
  assert.equal(ls.getItem("sena_portal_home_sin_nube_v1:ana"), null);
});

// ── 6. Actualizar un solo aprendiz ───────────────────────────────────────────
function learnerPatcher(state, localUsers) {
  const src = read("js/admin_usuarios.js");
  const fnSrc = src.match(/function patchLearnersFromLocal\(usernameKeys\) \{[\s\S]*?\n  \}/)[0];
  const calls = { loadUsers: 0, renderAll: 0 };
  const sessionStorage = { removeItem() {} };
  const fn = new Function("state", "auth", "loadUsers", "renderAll", "sessionStorage", "USERS_CACHE_KEY", fnSrc + "\nreturn patchLearnersFromLocal;")(
    state, { getUsers: () => localUsers }, async () => { calls.loadUsers++; }, () => { calls.renderAll++; }, sessionStorage, "k");
  return { fn, calls };
}
test("O6 un aprendiz editado se actualiza sin recargar la lista (conserva su progreso); cambio de ficha o registro ausente recarga todo", async () => {
  const progress = { guides: [{ fileName: "g1.html", completed: 3 }], completed: 3, total: 10 };
  const state = { users: [{ usernameKey: "ana", fullName: "Ana Vieja", ficha: "f1", active: true, progress }, { usernameKey: "beto", fullName: "Beto", ficha: "f1", progress }] };
  const a = learnerPatcher(state, [{ usernameKey: "ana", fullName: "Ana Nueva", ficha: "f1", active: false, passwordHash: "h" }]);
  await a.fn(["ana"]);
  assert.equal(a.calls.loadUsers, 0); assert.equal(a.calls.renderAll, 1);
  assert.equal(state.users[0].fullName, "Ana Nueva"); assert.equal(state.users[0].active, false);
  assert.equal(state.users[0].progress, progress, "el progreso se conserva");
  assert.equal(state.users[0].passwordHash, undefined, "nunca se copia el hash");
  const b = learnerPatcher(state, [{ usernameKey: "ana", fullName: "Ana", ficha: "f2" }]);
  await b.fn(["ana"]);
  assert.equal(b.calls.loadUsers, 1, "cambio de ficha -> recarga completa (cambian sus guias)");
  const c = learnerPatcher(state, []);
  await c.fn(["ana"]);
  assert.equal(c.calls.loadUsers, 1, "sin registro local -> recarga completa");
});

// ── Candidata 2026-10-28: riesgos A (relojes) y B (IndexedDB) del listado ────
// Firestore simulado "realista": updateTime y readTime son la hora del servidor.
function realisticFake() {
  const fake = withQueries(makeFakeFirestore());
  const inner = fake.fetchImpl;
  fake.fetchImpl = async (url, init) => {
    const res = await inner(url, init);
    if (!String(url).includes(":runQuery") || !res.ok) return res;
    const rows = await res.json();
    const readTime = new Date().toISOString();
    const out = rows.filter((r) => r.document).map((r) => Object.assign({}, r, { readTime }));
    return { ok: true, status: 200, json: async () => (out.length ? out : [{ readTime }]) };
  };
  fake.put = (key, obj, updateTimeMs) => fake.store.set(key, { data: plain(obj), updateTime: new Date(updateTimeMs).toISOString() });
  return fake;
}
function makeIdb() {
  const dbs = new Map();
  const idb = {
    dbs, deleted: [],
    open(name) {
      const req = {};
      setTimeout(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const store = dbs.get(name);
        const op = (fn) => { const o = {}; setTimeout(() => { o.result = fn(); if (o.onsuccess) o.onsuccess(); }); return o; };
        req.result = {
          createObjectStore() {},
          transaction() { return { objectStore() { return { get: (k) => op(() => store.get(k)), put: (v, k) => op(() => { store.set(k, v); return k; }) }; } }; },
          close() {},
        };
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    deleteDatabase(name) { idb.deleted.push(name); dbs.delete(name); },
  };
  return idb;
}
const tick = () => new Promise((r) => setTimeout(r, 30));
const adminAuth = { isAdminSession: () => true };
const GDK = (key) => "sena_portal_progress/__guide_data__:student:" + key + ":g1_html";
const gdDoc = (key, ts, r) => ({ usernameKey: key, scopeKey: "student:" + key, fileName: "g1.html", updatedAt: ts, snapshotJson: JSON.stringify({ state: { r }, updatedAt: ts }) });

test("A1 reloj atrasado de un aprendiz: el listado completo mide el retraso y el incremental lo cubre", async () => {
  const fake = realisticFake();
  const H = 3600 * 1000, now = Date.now();
  for (let i = 1; i <= 10; i++) fake.put(GDK("a" + i), gdDoc("a" + i, new Date(now - 5 * H).toISOString(), i), now - 5 * H);
  // el equipo de "lento" va 2 h atrasado: su updatedAt queda 2 h por detras de la hora real
  fake.put(GDK("lento"), gdDoc("lento", new Date(now - 2 * H).toISOString(), "v1"), now);
  const { db } = loadDb(fake);
  assert.equal((await db.cloudListAllGuideDataDocs()).status, "ok");
  // nueva escritura del mismo equipo atrasado, despues del listado
  fake.put(GDK("lento"), gdDoc("lento", new Date(now - 2 * H + 60000).toISOString(), "v2"), now + 1000);
  await db.cloudSaveGuideData("student:otro", "g9.html", { state: { x: 1 }, updatedAt: new Date().toISOString() });
  const delta = await db.cloudListAllGuideDataDocs();
  assert.equal(delta.delta, true);
  assert.match(delta.docs.progress.get("__guide_data__:student:lento:g1_html").snapshotJson, /v2/, "el cambio con reloj atrasado llega por el incremental");
  assert.ok(delta.stats.firestoreDocs < 11, "no relee todo: " + delta.stats.firestoreDocs);
});

test("A1b un documento viejo (promocion Drive->Firestore) no desactiva el incremental: el margen se limita a 24 h", async () => {
  const fake = realisticFake();
  const D = 24 * 3600 * 1000, now = Date.now();
  fake.put(GDK("promovido"), gdDoc("promovido", new Date(now - 30 * D).toISOString(), "viejo"), now);
  for (let i = 1; i <= 5; i++) fake.put(GDK("a" + i), gdDoc("a" + i, new Date(now - 40 * D).toISOString(), i), now - 40 * D);
  const { db } = loadDb(fake);
  await db.cloudListAllGuideDataDocs();
  fake.put(GDK("a1"), gdDoc("a1", new Date().toISOString(), "nuevo"), Date.now());
  await db.cloudSaveGuideData("student:otro", "g9.html", { state: { x: 1 }, updatedAt: new Date().toISOString() });
  const delta = await db.cloudListAllGuideDataDocs();
  assert.equal(delta.delta, true, "sigue siendo incremental");
  assert.match(delta.docs.progress.get("__guide_data__:student:a1:g1_html").snapshotJson, /nuevo/);
  assert.ok(delta.stats.firestoreDocs <= 3, "ventana acotada: " + delta.stats.firestoreDocs);
});

test("A2 reloj del administrador adelantado 3 h: la ventana usa la hora del servidor y no pierde cambios", async () => {
  const fake = realisticFake();
  const H = 3600 * 1000, real = Date.now();
  for (let i = 1; i <= 5; i++) fake.put(GDK("a" + i), gdDoc("a" + i, new Date(real - 5 * H).toISOString(), i), real - 5 * H);
  const RealDate = Date;
  class AdelantadoDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + 3 * H); }
    static now() { return RealDate.now() + 3 * H; }
  }
  const { db } = loadDb(fake, { globals: { Date: AdelantadoDate } });
  await db.cloudListAllGuideDataDocs();
  fake.put(GDK("a2"), gdDoc("a2", new RealDate().toISOString(), "cambio"), RealDate.now());
  await db.cloudSaveGuideData("student:otro", "g9.html", { state: { x: 1 }, updatedAt: new RealDate().toISOString() });
  const delta = await db.cloudListAllGuideDataDocs();
  assert.equal(delta.status, "ok");
  assert.match(delta.docs.progress.get("__guide_data__:student:a2:g1_html").snapshotJson, /cambio/, "con el reloj local se habria perdido");
});

test("B1 IndexedDB: solo la misma cuenta admin reutiliza el listado; otra cuenta, una copia alterada o de mas de 12 h hacen el completo", async () => {
  const fake = realisticFake();
  for (let i = 1; i <= 6; i++) fake.put(GDK("a" + i), gdDoc("a" + i, "2026-01-01T00:00:00.000Z", i), Date.now() - 86400000 * 30);
  const idb = makeIdb();
  const first = loadDb(fake, { uid: "uid-admin", auth: adminAuth, globals: { indexedDB: idb } });
  await first.db.cloudListAllGuideDataDocs();
  await tick();
  const key = "guias:x:uid-admin";
  assert.ok(idb.dbs.get("sena_portal_admin_cache_v1").has(key), "guardado bajo la cuenta admin");
  const same = loadDb(fake, { uid: "uid-admin", auth: adminAuth, globals: { indexedDB: idb } });
  assert.equal((await same.db.cloudListAllGuideDataDocs()).delta, true, "misma cuenta: incremental desde IndexedDB");
  const other = loadDb(fake, { uid: "uid-otro-admin", auth: adminAuth, globals: { indexedDB: idb } });
  assert.notEqual((await other.db.cloudListAllGuideDataDocs()).delta, true, "otra cuenta no usa la copia ajena");
  await tick();
  idb.dbs.get("sena_portal_admin_cache_v1").get(key).uid = "uid-ajeno";
  const tampered = loadDb(fake, { uid: "uid-admin", auth: adminAuth, globals: { indexedDB: idb } });
  assert.notEqual((await tampered.db.cloudListAllGuideDataDocs()).delta, true, "copia con otro uid");
  await tick();
  const fresh = idb.dbs.get("sena_portal_admin_cache_v1").get(key);
  fresh.fullAt = Date.now() - 13 * 3600 * 1000; fresh.at = fresh.fullAt;
  const stale = loadDb(fake, { uid: "uid-admin", auth: adminAuth, globals: { indexedDB: idb } });
  assert.notEqual((await stale.db.cloudListAllGuideDataDocs()).delta, true, "copia de mas de 12 h");
});

test("B2 IndexedDB: un aprendiz o una sesion sin uid nunca leen ni escriben la copia; sin sesion admin se borra", async () => {
  const fake = realisticFake();
  fake.put(GDK("a1"), gdDoc("a1", "2026-01-01T00:00:00.000Z", 1), Date.now());
  const idb = makeIdb();
  const student = loadDb(fake, { uid: "uid-a1", session: { role: "student", usernameKey: "a1" }, auth: { isAdminSession: () => false }, globals: { indexedDB: idb } });
  assert.deepEqual(idb.deleted, ["sena_portal_admin_cache_v1"], "al cargar sin sesion admin se borra la copia");
  await student.db.cloudListAllGuideDataDocs();
  await tick();
  assert.equal(idb.dbs.size, 0, "un aprendiz no crea la base");
  const noUid = loadDb(fake, { uid: "", auth: adminAuth, globals: { indexedDB: idb } });
  noUid.w.portalFirebaseAuth.currentUid = () => "";
  await noUid.db.cloudListAllGuideDataDocs();
  await tick();
  assert.equal(idb.dbs.size, 0, "sin uid no se guarda");
  const admin = loadDb(fake, { uid: "uid-admin", auth: adminAuth, globals: { indexedDB: idb } });
  await admin.db.cloudListAllGuideDataDocs();
  await tick();
  assert.equal(idb.dbs.size, 1);
  admin.db.clearAdminListingCache();
  assert.equal(idb.dbs.size, 0, "clearAdminListingCache borra la base");
});

test("B3 cerrar sesion borra el listado guardado (portal_auth llama a clearAdminListingCache antes del logout)", () => {
  const src = read("js/portal_auth.js");
  const i = src.indexOf("auth.logout = async function logoutWithFirebaseBridge");
  assert.ok(i > 0);
  const body = src.slice(i, i + 1200);
  assert.match(body, /clearAdminListingCache\(\)/);
  assert.ok(body.indexOf("clearAdminListingCache") < body.indexOf("prevLogout.call"), "antes del logout local");
});
