"use strict";

// Correccion critica de calificaciones (2026-10-27). Hallazgo del 2026-10-23
// (memory/respaldos/guias-2026-10-23/hallazgos): si la LECTURA de notas
// fallaba pero la ESCRITURA funcionaba, cloudGetGrades devolvia {}, el panel
// vaciaba el cache local del aprendiz y la siguiente nota REEMPLAZABA en la
// nube todas sus notas.
//
// Aqui se ejecuta el codigo real de js/firebase_db.js + js/activity_grades.js
// contra un Firestore simulado que honra las precondiciones
// (currentDocument.updateTime / currentDocument.exists) y updateMask como el
// REST real. Solo datos ficticios; ninguna red.
//
// Invariantes:
//   * lectura fallida / incompleta / cuota / permisos / sin red => CERO PATCH;
//   * la nota no se reporta como guardada si la nube no lo confirma;
//   * solo viaja la familia tocada (updateMask) y nunca se pisa lo ajeno;
//   * dos equipos concurrentes no se pisan (conflicto -> releer -> reaplicar);
//   * un fallo deja el cambio pendiente y se recupera despues.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const USER = "sim.aprendiz";
const DOC_KEY = "sena_portal_grades/" + USER;
const plain = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Notas historicas FICTICIAS (mismo escenario de la reproduccion original).
const HISTORICAS = {
  "guia-06-mantener-equipos": { caso311: "D", "caso311:obs": "Revisar la evidencia" },
  "guia-02-herramientas": { extensiones331: "A", "extensiones331:gradedAt": "2026-07-01T00:00:00.000Z" },
};

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
  return { fetchImpl, store, log, seed, grades: () => plain((store.get(DOC_KEY) || {}).data || null) };
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

// Un "equipo" del instructor: firebase_db.js + activity_grades.js reales.
// Los temporizadores de activity_grades (debounce y reintentos) se capturan
// para que la prueba decida cuando sincronizar; los de firebase_db (espera
// entre reintentos por conflicto) corren de verdad.
function loadDevice(fake, opts) {
  const options = opts || {};
  const localStorage = options.localStorage || makeLocalStorage();
  const timers = [];
  const events = [];
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: (ev) => { events.push(ev); return true; },
    location: { href: "https://example.test/panel-administrativo-usuarios.html" },
    portalFirebaseAuth: {
      currentUid: () => "uid-admin",
      getIdToken: async () => "token-admin",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {
      getCurrentSession: () => ({ role: options.role || "admin", usernameKey: options.sessionUser }),
      getStudentStorageKey: (u, k, o) => `sena_portal:student:${u}:${(o && o.area) || "app"}:${k}`,
    },
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fake.fetchImpl,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    URL,
  };
  windowObj.fetch = fake.fetchImpl;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "firebase_db.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "activity_grades.js"), "utf8"), sandbox);
  if (options.withoutStrictApi) {
    delete windowObj._firebaseDb.cloudUpdateGradesStrict;
    delete windowObj._firebaseDb.cloudGetGradesStrict;
  }
  return { db: windowObj._firebaseDb, mgr: windowObj.activityGradesManager, localStorage, timers, events, window: windowObj };
}

const patches = (fake) => fake.log.filter((e) => e.method === "PATCH");
const response = (status, errorStatus) => ({ ok: false, status, json: async () => ({ error: { status: errorStatus || "" } }) });

// Califica como lo hace handleGradeChange y fuerza la sincronizacion (sin esperar el debounce).
async function grade(device, family, activityId, value) {
  const pending = device.mgr.setStudentActivityGradeAndSolution(USER, family, activityId, value, null);
  device.mgr.flushGradesCloudSync(USER);
  return pending;
}

// ── 1. Lectura correcta ──────────────────────────────────────────────────────
test("G01 lectura correcta: se aplica solo la actividad y se conservan las demas guias", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "2026-07-01T00:00:00.000Z" });
  const dev = loadDevice(fake);

  const read = await dev.mgr.refreshStudentGradesFromCloud(USER);
  assert.equal(read.status, "found");
  assert.deepEqual(plain(read.grades), HISTORICAS);

  const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(result.ok, true, "la nube confirmo el guardado");
  assert.equal(result.pending, 0);

  const cloud = fake.grades();
  assert.deepEqual(cloud.grades["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
  assert.deepEqual(cloud.grades["guia-02-herramientas"], HISTORICAS["guia-02-herramientas"]);
  assert.equal(cloud.grades["guia-mant-rap03"].registro342, "A");

  // Solo viajo la familia tocada, con precondicion de version.
  const [patch] = patches(fake);
  assert.match(patch.url, /currentDocument\.updateTime=/);
  const masks = [...patch.url.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map((x) => decodeURIComponent(x[1]));
  assert.deepEqual(masks.sort(), ["grades.`guia-mant-rap03`", "updatedAt", "usernameKey"].sort());
  assert.deepEqual(Object.keys(fieldsToObj(patch.body.fields).grades), ["guia-mant-rap03"]);
});

test("G01b aprendiz sin documento de notas: se crea con exists=false (no es una lectura fallida)", async () => {
  const fake = makeFakeFirestore();
  const dev = loadDevice(fake);
  assert.equal((await dev.mgr.refreshStudentGradesFromCloud(USER)).status, "missing");
  const result = await grade(dev, "guia-02-herramientas", "extensiones331", "D");
  assert.equal(result.ok, true);
  assert.match(patches(fake)[0].url, /currentDocument\.exists=false/);
  assert.equal(fake.grades().grades["guia-02-herramientas"].extensiones331, "D");
});

// ── 2-5. Fallos de lectura: CERO escrituras ──────────────────────────────────
const READ_FAILURES = [
  ["G02 lectura fallida (500)", () => response(500), "read-failed", /servidor de Firestore no respondio/, "http-500"],
  ["G03 cuota agotada (429)", () => response(429, "RESOURCE_EXHAUSTED"), "read-failed", /cuota diaria/i, "http-429"],
  // Tras un 401/403 firebase_db entra en pausa de 60 s: el reintento inmediato
  // ya ni siquiera sale a la red ("unavailable"). El permiso se informa en la lectura.
  ["G04 error de permisos (403)", () => response(403, "PERMISSION_DENIED"), "read-failed", /no esta disponible|permiso/i, "unavailable", /permiso/i],
  ["G05 conexion interrumpida", () => { throw new TypeError("Failed to fetch"); }, "read-failed", /conexion/i, "network"],
];
for (const [name, failure, status, messageRe, reason, readMessageRe] of READ_FAILURES) {
  test(name + ": CERO escrituras, nada se reporta como guardado y la nube queda intacta", async () => {
    const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? failure() : null) });
    fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "2026-07-01T00:00:00.000Z" });
    const dev = loadDevice(fake);

    const read = await dev.mgr.refreshStudentGradesFromCloud(USER);
    assert.equal(read.status, "error");
    assert.equal(read.grades, null, "nunca se sustituye por {}");
    if (readMessageRe) assert.match(read.message, readMessageRe);

    const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
    assert.equal(result.ok, false);
    assert.equal(result.status, status);
    assert.equal(result.reason, reason);
    assert.match(result.message, messageRe);
    assert.equal(result.pending, 1, "el cambio queda pendiente, no se pierde");
    assert.equal(patches(fake).length, 0, "no debe existir ningun PATCH tras una lectura fallida");
    assert.deepEqual(fake.grades().grades, HISTORICAS);
  });
}

test("G03b limite diario de escrituras de este equipo: no se escribe y se informa", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const now = new Date();
  const dateKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  const localStorage = makeLocalStorage({
    sena_portal_firestore_budget_v1: JSON.stringify({ dateKey, counts: { read: 0, write: 12000, delete: 0 }, notices: {} }),
  });
  const dev = loadDevice(fake, { localStorage });
  const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(result.ok, false);
  assert.equal(result.status, "write-failed");
  assert.equal(result.reason, "write-budget");
  assert.equal(patches(fake).length, 0);
  assert.deepEqual(fake.grades().grades, HISTORICAS);
});

test("G04b permiso denegado AL ESCRIBIR: no se finge el guardado y la nube queda intacta", async () => {
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "PATCH" ? response(403, "PERMISSION_DENIED") : null) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);
  const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(result.ok, false);
  assert.equal(result.status, "write-failed");
  assert.match(result.message, /permiso/i);
  assert.deepEqual(fake.grades().grades, HISTORICAS);
});

// ── 6. Escritura fallida ─────────────────────────────────────────────────────
test("G06 escritura fallida (503 / red): resultado no-ok, cambio pendiente, sin respaldo a Drive ni reemplazo", async () => {
  for (const failure of [() => response(503, "UNAVAILABLE"), () => { throw new TypeError("Failed to fetch"); }]) {
    const fake = makeFakeFirestore({ onRequest: (method) => (method === "PATCH" ? failure() : null) });
    fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
    const dev = loadDevice(fake);
    const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
    assert.equal(result.ok, false);
    assert.equal(result.status, "write-failed");
    assert.equal(result.pending, 1);
    assert.equal(dev.mgr.getPendingGradesCount(USER), 1);
    assert.deepEqual(fake.grades().grades, HISTORICAS);
    assert.equal(dev.timers.length, 2, "debounce + un reintento automatico programado");
  }
});

// ── 7. Lectura incompleta ────────────────────────────────────────────────────
test("G07 lectura incompleta (doc sin mapa grades, o una familia que no es objeto): CERO escrituras", async () => {
  const variants = [
    { usernameKey: USER, updatedAt: "x" },                                   // falta grades
    { usernameKey: USER, grades: "corrupto", updatedAt: "x" },              // grades no es mapa
    { usernameKey: USER, grades: { "guia-02-herramientas": "A" } },         // familia no es mapa
  ];
  for (const doc of variants) {
    const fake = makeFakeFirestore();
    fake.seed(DOC_KEY, doc);
    const dev = loadDevice(fake);
    const read = await dev.db.cloudGetGradesStrict(USER);
    assert.equal(read.status, "error");
    assert.equal(read.reason, "incomplete");
    const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "incomplete");
    assert.match(result.message, /incompletas/);
    assert.equal(patches(fake).length, 0);
    assert.equal(dev.timers.length, 1, "solo el debounce: un documento incompleto no se reintenta en bucle");
  }
});

// ── 8. Dos actualizaciones concurrentes ──────────────────────────────────────
test("G08 dos equipos califican a la vez (misma y distinta guia): ninguna nota se pierde", async () => {
  // Las lecturas se demoran para que ambos lean la MISMA version antes de escribir.
  const fake = makeFakeFirestore({ delayMs: (method) => (method === "GET" ? 15 : 1) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const a = loadDevice(fake);
  const b = loadDevice(fake);

  const [ra, rb] = await Promise.all([
    grade(a, "guia-02-herramientas", "sistemas332", "A"),       // misma familia que una historica
    grade(b, "guia-02-herramientas", "colaborativas334", "D"),  // misma familia, otra actividad
  ]);
  assert.equal(ra.ok, true);
  assert.equal(rb.ok, true);
  const rc = await Promise.all([
    grade(a, "guia-mant-rap03", "registro342", "A"),
    grade(b, "guia-06-mantener-equipos", "informe321", "A"),
  ]);
  assert.ok(rc.every((r) => r.ok));

  const cloud = fake.grades().grades;
  assert.equal(cloud["guia-02-herramientas"].extensiones331, "A", "historica conservada");
  assert.equal(cloud["guia-02-herramientas"].sistemas332, "A");
  assert.equal(cloud["guia-02-herramientas"].colaborativas334, "D");
  assert.equal(cloud["guia-06-mantener-equipos"].caso311, "D", "historica conservada");
  assert.equal(cloud["guia-06-mantener-equipos"].informe321, "A");
  assert.equal(cloud["guia-mant-rap03"].registro342, "A");
  const conflicts = fake.log.filter((e) => e.method === "PATCH").length;
  assert.ok(conflicts > 4, "hubo al menos un conflicto que se resolvio releyendo (" + conflicts + " PATCH)");
});

test("G08b la misma actividad calificada en dos equipos: gana la ultima confirmada, sin borrar nada mas", async () => {
  const fake = makeFakeFirestore({ delayMs: (method) => (method === "GET" ? 10 : 1) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const a = loadDevice(fake);
  const b = loadDevice(fake);
  const results = await Promise.all([
    grade(a, "guia-02-herramientas", "extensiones331", "D"),
    grade(b, "guia-02-herramientas", "extensiones331", "D"),
  ]);
  assert.ok(results.every((r) => r.ok));
  const cloud = fake.grades().grades;
  assert.equal(cloud["guia-02-herramientas"].extensiones331, "D");
  assert.deepEqual(cloud["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
});

// ── 9. Recuperacion despues del error ────────────────────────────────────────
test("G09 recuperacion: la nota pendiente se guarda al volver la conexion, sobre la version real", async () => {
  let offline = true;
  const fake = makeFakeFirestore({ onRequest: () => (offline ? (() => { throw new TypeError("Failed to fetch"); })() : null) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);

  const first = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(first.ok, false);
  assert.equal(dev.mgr.getPendingGradesCount(), 1);

  // Mientras tanto otro equipo agrego una nota: la recuperacion no debe pisarla.
  fake.seed(DOC_KEY, {
    usernameKey: USER,
    grades: Object.assign(plain(HISTORICAS), { "guia-05-documentar": { bitacora311: "A" } }),
    updatedAt: "y",
  });
  offline = false;
  const [retry] = await dev.mgr.retryPendingGradesSync();
  assert.equal(retry.ok, true);
  assert.equal(retry.pending, 0);
  assert.equal(dev.mgr.getPendingGradesCount(), 0);
  const cloud = fake.grades().grades;
  assert.equal(cloud["guia-mant-rap03"].registro342, "A");
  assert.equal(cloud["guia-05-documentar"].bitacora311, "A", "la nota del otro equipo se conserva");
  assert.deepEqual(cloud["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
  assert.ok(dev.events.some((ev) => ev.type === "grades-sync-status" && ev.detail.result.ok), "se notifica al panel");
});

test("G09b el cambio pendiente sobrevive a recargar la pagina (cola persistida) y se envia despues", async () => {
  let offline = true;
  const fake = makeFakeFirestore({ onRequest: () => (offline ? response(503) : null) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const first = loadDevice(fake);
  assert.equal((await grade(first, "guia-mant-rap03", "registro342", "A")).ok, false);

  offline = false;
  const reloaded = loadDevice(fake, { localStorage: first.localStorage });   // misma maquina, pagina nueva
  assert.equal(reloaded.mgr.getPendingGradesCount(USER), 1);
  const [r] = await reloaded.mgr.retryPendingGradesSync();
  assert.equal(r.ok, true);
  assert.equal(fake.grades().grades["guia-mant-rap03"].registro342, "A");
  assert.equal(reloaded.localStorage.getItem("sena_portal_grades_pending_ops_v1"), null);
});

// ── 10. Conservacion de calificaciones previas (escenario exacto del hallazgo) ─
test("G10 escenario del hallazgo: lectura fallida + cache viejo/vacio + nota nueva => las historicas se conservan", async () => {
  let readsFail = true;
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" && readsFail ? response(429, "RESOURCE_EXHAUSTED") : null) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);

  // El cache de este equipo esta VACIO (lo que dejaba la version anterior tras la lectura fallida).
  dev.mgr.setAllStudentGrades(USER, {});
  const grid = await dev.mgr.refreshStudentGradesFromCloud(USER);
  assert.equal(grid.status, "error");

  const r1 = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(r1.ok, false);
  assert.equal(patches(fake).length, 0, "con la lectura caida no se escribe nada");
  assert.deepEqual(fake.grades().grades, HISTORICAS);

  readsFail = false;
  const [r2] = await dev.mgr.retryPendingGradesSync();
  assert.equal(r2.ok, true);
  const cloud = fake.grades().grades;
  assert.deepEqual(cloud["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
  assert.deepEqual(cloud["guia-02-herramientas"], HISTORICAS["guia-02-herramientas"]);
  assert.equal(cloud["guia-mant-rap03"].registro342, "A");
  // El cache queda igual a la nube confirmada.
  assert.deepEqual(plain(dev.mgr.getStudentGrades(USER)), cloud);
});

test("G10b cache desactualizado de otro dia: borrar una nota no arrastra las demas familias", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);
  dev.mgr.setAllStudentGrades(USER, { "guia-02-herramientas": { extensiones331: "A" } });   // viejo/incompleto
  const r = await grade(dev, "guia-02-herramientas", "extensiones331", "");
  assert.equal(r.ok, true);
  const cloud = fake.grades().grades;
  assert.equal(cloud["guia-02-herramientas"].extensiones331, undefined);
  assert.equal(cloud["guia-02-herramientas"]["extensiones331:gradedAt"], undefined);
  assert.deepEqual(cloud["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
});

test("G10c observacion y nota en rafaga: una sola escritura con ambos cambios", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);
  const p1 = dev.mgr.setStudentActivityGradeAndSolution(USER, "guia-mant-rap03", "registro342", "D", null);
  const p2 = dev.mgr.setStudentActivityObservation(USER, "guia-mant-rap03", "registro342", "Falta la evidencia");
  dev.mgr.flushGradesCloudSync(USER);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.ok(r1.ok && r2.ok);
  assert.equal(patches(fake).length, 1);
  const fam = fake.grades().grades["guia-mant-rap03"];
  assert.equal(fam.registro342, "D");
  assert.equal(fam["registro342:obs"], "Falta la evidencia");
});

// ── Compatibilidad y lado aprendiz ───────────────────────────────────────────
test("G11 firebase_db.js en cache viejo (sin API estricta): NO cae al reemplazo completo", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake, { withoutStrictApi: true });
  let legacyWrites = 0;
  dev.db.cloudSaveGrades = async () => { legacyWrites += 1; return true; };
  const result = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(result.ok, false);
  assert.equal(result.status, "unsupported");
  assert.match(result.message, /Recargue la pagina/);
  assert.equal(legacyWrites, 0);
  assert.equal(patches(fake).length, 0);
  assert.equal((await dev.mgr.refreshStudentGradesFromCloud(USER)).status, "error");
});

test("G12 aprendiz: una lectura fallida ya no vacia su cache de notas (badges y bloqueos se conservan)", async () => {
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? response(503) : null) });
  const dev = loadDevice(fake, { role: "student", sessionUser: USER });
  dev.mgr.setAllStudentGrades(USER, HISTORICAS);
  const state = {};
  await dev.mgr.reflectGradesIntoGuideState({
    guideFamily: "guia-02-herramientas",
    pageFile: "x.html",
    getState: () => state,
  });
  assert.deepEqual(plain(dev.mgr.getStudentGrades(USER)), HISTORICAS);
  assert.equal(patches(fake).length, 0, "el aprendiz nunca escribe notas");
});

test("G13 cloudGetGrades (legado) conserva su contrato; cloudSaveGrades ya no lo usa el gestor de notas", () => {
  const ag = fs.readFileSync(path.join(ROOT, "js", "activity_grades.js"), "utf8");
  assert.doesNotMatch(ag, /\.cloudSaveGrades\(/);
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  assert.doesNotMatch(admin, /db\.cloudGetGrades\(/, "el panel ya no lee notas con la lectura ambigua");
  assert.doesNotMatch(admin, /\.cloudSaveGrades\(/);
});

// ── Banco de comentarios (mismo patron "[] = vacio") ─────────────────────────
test("G14 banco de comentarios: lectura estricta y escritura condicionada a la version", async () => {
  const fake = makeFakeFirestore();
  const dev = loadDevice(fake);
  const BANK = "sena_portal_grade_comments/bank";

  assert.equal((await dev.db.cloudGetGradeCommentsStrict()).status, "missing");
  const created = await dev.db.cloudSaveGradeCommentsStrict([{ id: "c1", texto: "Propio", tipo: "general" }], { mustNotExist: true });
  assert.equal(created.status, "ok");

  const read = await dev.db.cloudGetGradeCommentsStrict();
  assert.equal(read.status, "found");
  // Otro equipo cambia el banco: la escritura con la version vieja se rechaza.
  fake.seed(BANK, { comments: [{ id: "c1", texto: "Propio", tipo: "general" }, { id: "c2", texto: "Ajeno", tipo: "general" }] });
  const stale = await dev.db.cloudSaveGradeCommentsStrict([], { expectedUpdateTime: read.updateTime });
  assert.equal(stale.status, "conflict");
  assert.equal(fieldsToObj(docFields(fake.store.get(BANK).data)).comments.length, 2, "el banco ajeno sigue intacto");
  assert.equal((await dev.db.cloudSaveGradeCommentsStrict([], null)).status, "error", "sin precondicion no se escribe");
});

test("G14b banco de comentarios: una lectura fallida NO siembra ni reemplaza el banco real", async () => {
  const fake = makeFakeFirestore({ onRequest: (method) => (method === "GET" ? response(429, "RESOURCE_EXHAUSTED") : null) });
  fake.seed("sena_portal_grade_comments/bank", { comments: [{ id: "c9", texto: "Comentario real del instructor", tipo: "general" }] });
  const dev = loadDevice(fake);
  const src = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  const pick = (re) => { const m = src.match(re); assert.ok(m, "no se encontro " + re); return m[0]; };
  const code = [
    pick(/const GRADE_COMMENT_TYPES = [^\n]+/),
    pick(/const GRADE_COMMENT_SEEDS = \[[\s\S]*?\n  \];/),
    pick(/function gradeCommentKey\(texto\) \{[\s\S]*?\n  \}/),
    pick(/function normalizeGradeComment\(entry, index\) \{[\s\S]*?\n  \}/),
    pick(/function dedupeGradeComments\(list\) \{[\s\S]*?\n  \}/),
    pick(/let _gradeComments = null;[\s\S]*?(?=\n  \/\/ Comentarios ofrecidos)/),
  ].join("\n");
  const api = new Function("window", code + "\nreturn { ensureGradeCommentsBank, saveGradeCommentsBank, getGradeComments };")(dev.window);

  await api.ensureGradeCommentsBank();
  assert.equal(patches(fake).length, 0, "no se siembra sobre un banco que no se pudo leer");
  await assert.rejects(api.saveGradeCommentsBank([{ id: "n1", texto: "Nuevo", tipo: "general" }]), /No se pudo leer el banco/);
  assert.equal(patches(fake).length, 0);
  assert.equal(api.getGradeComments().length, 0, "se revierte el cambio en memoria: no se finge el guardado");
  assert.equal(fieldsToObj(docFields(fake.store.get("sena_portal_grade_comments/bank").data)).comments[0].id, "c9");
});

// ── Panel: el mensaje de exito depende del resultado real ────────────────────
test("G15 panel: 'Calificacion guardada.' solo tras confirmacion de la nube; filas ilegibles bloqueadas", () => {
  const admin = fs.readFileSync(path.join(ROOT, "js", "admin_usuarios.js"), "utf8");
  const handler = admin.match(/async function handleGradeChange\(select\) \{[\s\S]*?\n  \}/)[0];
  const awaitIdx = handler.indexOf("saveResult = await gradesManager.setStudentActivityGradeAndSolution(");
  const failIdx = handler.indexOf("if (!saveResult || !saveResult.ok) {");
  const okIdx = handler.lastIndexOf('? "Calificacion guardada."');
  assert.ok(awaitIdx > 0 && failIdx > awaitIdx && okIdx > failIdx, "el exito se anuncia despues de comprobar el resultado");
  assert.match(handler.slice(failIdx, failIdx + 120), /reportGradeSaveFailure\(select, saveResult\);\s*return;/);
  const grid = admin.match(/async function renderGradesGrid\((?:opts = \{\})?\) \{[\s\S]*?\n  \}/)[0];
  assert.match(grid, /data-grade-unreadable="true"/);
  assert.match(grid, /No se puede calificar a este aprendiz hasta leerlas/);
  const download = admin.match(/async function handleGradesExcelDownload\(\) \{[\s\S]*?\n  \}/)[0];
  assert.match(download, /No se genero el Excel: no se pudieron leer/);
});

test("G16 reintentos automaticos acotados: con la nube caida se detienen tras 8; el cambio sigue pendiente y el boton lo reintenta", async () => {
  let down = true;
  const fake = makeFakeFirestore({ onRequest: (method) => (down && method === "GET" ? response(503) : null) });
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const dev = loadDevice(fake);
  await grade(dev, "guia-mant-rap03", "registro342", "A");
  // timers[0] es el debounce; los siguientes son reintentos encadenados.
  let fired = 0;
  dev.timers.shift();
  while (dev.timers.length && fired < 50) {
    dev.timers.shift()();
    fired += 1;
    await sleep(5);
  }
  assert.equal(fired, 8, "8 reintentos automaticos y luego se detiene");
  assert.equal(fake.log.filter((e) => e.method === "GET").length, 9);
  assert.equal(dev.mgr.getPendingGradesCount(USER), 1, "el cambio NO se pierde");
  down = false;
  const [r] = await dev.mgr.retryPendingGradesSync();
  assert.equal(r.ok, true, "Reintentar ahora sigue funcionando despues del tope");
  assert.equal(fake.grades().grades["guia-mant-rap03"].registro342, "A");
  assert.deepEqual(fake.grades().grades["guia-06-mantener-equipos"], HISTORICAS["guia-06-mantener-equipos"]);
});

test("G17 escritura via :commit con precondicion en el CUERPO y respaldo de Drive con el documento COMPLETO", async () => {
  const fake = makeFakeFirestore();
  fake.seed(DOC_KEY, { usernameKey: USER, grades: HISTORICAS, updatedAt: "x" });
  const backups = [];
  const realFetch = fake.fetchImpl;
  const raw = [];
  fake.fetchImpl = async (url, init) => {
    if (String(url).startsWith("https://script.google.com/")) { backups.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({}) }; }
    raw.push({ url: String(url), method: init && init.method, body: init && init.body });
    return realFetch(url, init);
  };
  const dev = loadDevice(fake);
  dev.window.PROJECT_INTEGRATIONS = { respaldoFirestoreUrl: "https://script.google.com/macros/s/simulado/exec" };
  const r = await grade(dev, "guia-mant-rap03", "registro342", "A");
  assert.equal(r.ok, true);
  const commit = raw.find((x) => /:commit/.test(x.url));
  assert.ok(commit && commit.method === "POST", "la escritura usa :commit");
  const w = JSON.parse(commit.body).writes[0];
  assert.ok(w.currentDocument && w.currentDocument.updateTime, "precondicion en el cuerpo");
  assert.ok(!/currentDocument/.test(commit.url), "nunca como parametro de URL (el emulador oficial la ignora ahi)");
  await sleep(10);
  assert.equal(backups.length, 1, "un respaldo");
  const g = backups[0].data.grades;
  assert.deepEqual(plain(g["guia-06-mantener-equipos"]), HISTORICAS["guia-06-mantener-equipos"], "el respaldo NO es parcial");
  assert.equal(g["guia-mant-rap03"].registro342, "A");
});
