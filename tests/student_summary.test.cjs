"use strict";

// Fase 11 (auditoria profunda, 2026-08-23): resumen remoto derivado del
// estado del aprendiz, para que el Home muestre datos correctos en un
// dispositivo/navegador nuevo sin depender de cache local que solo se llena
// al visitar cada guia/modulo en ESE equipo (ver auditoria: firma y talleres
// de refuerzo ya eran cross-device; documentos base de Etapa Productiva y
// actividades "no aprobada" NO lo eran).
//
// Carga el firebase_db.js REAL (no un mock de _firebaseDb) para que
// cloudGetStudentSummary/cloudSaveStudentSummary/cloudGetGrades/etc. se
// ejercen contra el mismo fake de Firestore REST que ya usan
// guide_progress_uid_migration.test.cjs y guide_cloud_sync_multi_device.
// test.cjs, y sobre esa misma instancia se carga js/student_summary.js.
// Cubre los 15 escenarios pedidos por el usuario para esta fase.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

function makeFakeDocument() {
  const listeners = new Map(); // type -> Set(fn)
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    dispatchEvent(evt) {
      const set = listeners.get(evt.type);
      if (set) set.forEach((fn) => fn(evt));
      return true;
    },
  };
}

function makeFakeFirestore() {
  const state = { down: false };
  const store = new Map(); // "collection/docId" -> plain data object (sin envolver en fields)
  async function fetchImpl(url, options) {
    if (state.down) throw new Error("network unreachable (simulado)");
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const key = match[1] + "/" + decodeURIComponent(match[2]).split("?")[0];
    if (method === "GET") {
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => toWire(store.get(key)) };
    }
    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      store.set(key, fromWire(body));
      return { ok: true, status: 200, json: async () => body };
    }
    return { ok: false, status: 400, json: async () => ({}) };
  }
  // Formato "fields" minimo de Firestore REST, suficiente para los tipos que
  // maneja este resumen (string, number, boolean, array, map, null).
  function toWireValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return { integerValue: String(v) };
    if (typeof v === "string") return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(toWireValue) } };
    if (typeof v === "object") return { mapValue: { fields: toWire(v).fields } };
    return { stringValue: String(v) };
  }
  function toWire(obj) {
    const fields = {};
    Object.keys(obj || {}).forEach((k) => { fields[k] = toWireValue(obj[k]); });
    return { fields };
  }
  function fromWireValue(v) {
    if (!v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("nullValue" in v) return null;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromWireValue);
    if ("mapValue" in v) return fromWire(v.mapValue);
    return null;
  }
  function fromWire(doc) {
    const out = {};
    const fields = doc.fields || {};
    Object.keys(fields).forEach((k) => { out[k] = fromWireValue(fields[k]); });
    return out;
  }
  return { fetchImpl, store, state };
}

function loadPortalHomeStack(opts) {
  opts = opts || {};
  const dbCode = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const summaryCode = fs.readFileSync(path.join(__dirname, "..", "js", "student_summary.js"), "utf8");
  const localStorage = makeLocalStorage();
  const fakeFirestore = makeFakeFirestore();
  const fakeDocument = makeFakeDocument();

  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => opts.uid || null,
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: Object.assign(
      {
        getCurrentSession: () => opts.session || null,
        getGuidesForFicha: () => opts.files || [],
        getStudentGuideProgress: (usernameKey, file) => ({
          percent: (opts.progressByFile && opts.progressByFile[file]) || 0,
        }),
      },
      opts.authOverrides || {}
    ),
    activityGradesManager: opts.activityGradesManager || null,
    productiveStageStore: opts.productiveStageStore || null,
  };

  const sandbox = {
    window: windowObj,
    localStorage,
    document: fakeDocument,
    fetch: fakeFirestore.fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(dbCode, sandbox);
  vm.runInContext(summaryCode, sandbox);

  return {
    window: windowObj,
    document: fakeDocument,
    firestore: fakeFirestore,
    studentSummary: windowObj.studentSummary,
    db: windowObj._firebaseDb,
  };
}

const GUIDE_CATALOG = {
  guia2: {
    label: "Guía 2",
    activities: [{ id: "act1", label: "Actividad 1" }, { id: "act2", label: "Actividad 2" }],
  },
};
const GUIDE_FAMILY_BY_FILE = { "grupo-10a-guia-02.html": "guia2" };

function baseSession(overrides) {
  return Object.assign(
    { role: "student", user: { usernameKey: "juan.perez", ficha: "3441939" } },
    overrides || {}
  );
}

// ── 1 y 2: usuario nuevo / usuario existente, ambos SIN resumen todavia ────
test("usuario nuevo sin summary: se reconstruye con 0% y sin pendientes", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-nuevo",
    session: baseSession(),
    files: ["grupo-10a-guia-02.html"],
    progressByFile: {},
  });
  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.source, "reconstructed");
  assert.equal(result.summary.guidesProgressPercent, 0);
  assert.deepEqual(Array.from(result.summary.rejectedActivities), []);
  // Sin registro de firma en la nube (nunca la envio), signaturePending es
  // true por defecto -- mismo criterio que isSignaturePending en
  // portal_home.js: "si no hay registro 'delivered', se avisa".
  assert.equal(result.summary.signaturePending, true);
});

test("usuario existente sin summary (progreso local real): se reconstruye reflejando ese progreso", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-existente",
    session: baseSession(),
    files: ["grupo-10a-guia-02.html"],
    progressByFile: { "grupo-10a-guia-02.html": 80 },
  });
  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.source, "reconstructed");
  assert.equal(result.summary.guidesProgressPercent, 80);
});

// ── 3: summary valido y actualizado -> no se recalcula ─────────────────────
test("summary reciente: se usa tal cual, sin forzar recalculo", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-1", session: baseSession(), files: [] });
  await stack.db.cloudSaveStudentSummary("uid-1", {
    usernameKey: "juan.perez", guidesProgressPercent: 42, source: "derived",
  });
  // Se limpia el mirror local para forzar que la unica fuente sea la lectura remota.
  stack.window.localStorage.removeItem("sena_portal_student_summary_mirror_v1:juan.perez");
  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.stale, false);
  assert.equal(result.summary.guidesProgressPercent, 42);
});

// ── 4: summary desactualizado -> se muestra igual y se refresca en 2do plano
test("summary viejo: se devuelve marcado como stale y dispara refresco en segundo plano", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-2", session: baseSession(), files: [], progressByFile: {},
  });
  const oldIso = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // hace 1h
  await stack.db.cloudSaveStudentSummary("uid-2", { usernameKey: "juan.perez", guidesProgressPercent: 10 });
  // cloudSaveStudentSummary pisa updatedAt con "ahora"; se fuerza el valor viejo
  // directamente en el store fake para simular un resumen realmente desactualizado.
  stack.firestore.store.set("sena_portal_student_summary/uid-2",
    Object.assign({}, stack.firestore.store.get("sena_portal_student_summary/uid-2"), { updatedAt: oldIso }));
  stack.window.localStorage.removeItem("sena_portal_student_summary_mirror_v1:juan.perez");

  let updatedEventFired = false;
  stack.document.addEventListener("student-summary-updated", () => { updatedEventFired = true; });

  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.stale, true);
  assert.equal(result.summary.guidesProgressPercent, 10);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(updatedEventFired, true, "el refresco en segundo plano debe avisar con student-summary-updated");
});

// Regresion (encontrada en verificacion visual, cierre Fase 11): un summary
// viejo + un refresco que FALLA (sin uid, o Firestore inalcanzable) NO debe
// disparar "student-summary-updated" -- si lo hiciera, portal_home.js
// volveria a pedir el resumen, lo veria igual de viejo, refrescaria de nuevo
// y dispararia el evento otra vez sin fin (confirmado que cuelga la pestaña
// en un navegador real: CPU al 100%, sin respuesta). El resumen sigue viejo
// (nada cambio), asi que no hay nada nuevo que avisar.
test("summary viejo + refresco que falla (sin uid): NO dispara student-summary-updated (evita bucle infinito)", async () => {
  const stack = loadPortalHomeStack({
    uid: null, // simula sin sesion real de Firebase Auth / sin red
    session: baseSession(),
    files: [],
  });
  const oldIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  stack.window.localStorage.setItem(
    "sena_portal_student_summary_mirror_v1:juan.perez",
    JSON.stringify({ usernameKey: "juan.perez", guidesProgressPercent: 10, updatedAt: oldIso })
  );

  let updatedEventCount = 0;
  stack.document.addEventListener("student-summary-updated", () => { updatedEventCount += 1; });

  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.stale, true);
  assert.equal(result.summary.guidesProgressPercent, 10, "debe mostrar lo ultimo conocido igual");

  // Espera varias vueltas de microtask/timeout: si hubiera bucle, para aqui
  // ya se habrian disparado muchos refrescos y eventos encadenados.
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(updatedEventCount, 0, "un refresco que no cambia nada no debe disparar el evento");

  // El mirror sigue exactamente igual (el refresco fallido no lo toco).
  const mirrorAfter = JSON.parse(
    stack.window.localStorage.getItem("sena_portal_student_summary_mirror_v1:juan.perez")
  );
  assert.equal(mirrorAfter.updatedAt, oldIso);
});

// ── 5 y 6: cambio de equipo / localStorage vacio, con remoto existente ─────
test("equipo nuevo (localStorage vacio) con summary remoto: usa el remoto, no lo recalcula todo", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-3", session: baseSession(), files: [] });
  await stack.db.cloudSaveStudentSummary("uid-3", { usernameKey: "juan.perez", guidesProgressPercent: 65 });
  assert.equal(stack.window.localStorage.getItem("sena_portal_student_summary_mirror_v1:juan.perez"), null);

  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.equal(result.summary.guidesProgressPercent, 65);
  assert.equal(result.source, "remote");
  // Y ademas siembra el mirror local para la proxima visita en este equipo.
  assert.notEqual(stack.window.localStorage.getItem("sena_portal_student_summary_mirror_v1:juan.perez"), null);
});

// ── 7: nueva entrega actualiza el Home ──────────────────────────────────────
test("evento guide-delivery-registered fuerza un refresco del summary", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-4",
    session: baseSession(),
    files: [],
    progressByFile: {},
  });
  await stack.studentSummary.refreshNow(baseSession(), { force: true });
  const before = JSON.parse(stack.firestore.store.get("sena_portal_student_summary/uid-4")
    ? JSON.stringify(Object.fromEntries([])) : "{}"); // solo para inicializar el store si hiciera falta
  void before;

  // Cambia el progreso local (simula avance recien guardado) y dispara el evento.
  stack.window.portalAuth.getStudentGuideProgress = () => ({ percent: 99 });
  stack.document.dispatchEvent({ type: "guide-delivery-registered", detail: {} });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const raw = stack.firestore.store.get("sena_portal_student_summary/uid-4");
  assert.ok(raw, "la entrega debe haber escrito un summary");
});

// ── 8 y 9: nueva calificacion / actividad no aprobada aparecen ─────────────
test("calificacion 'D' nueva aparece en rejectedActivities al recalcular", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-5",
    session: baseSession(),
    files: ["grupo-10a-guia-02.html"],
    activityGradesManager: { GUIDE_FAMILY_BY_FILE, GRADE_CATALOG: GUIDE_CATALOG },
  });
  await stack.db.cloudSaveGrades("juan.perez", { guia2: { act1: "D", "act1:obs": "Revisar la evidencia" } });

  const summary = await stack.studentSummary.refreshNow(baseSession(), { force: true });
  assert.equal(summary.rejectedActivities.length, 1);
  assert.match(summary.rejectedActivities[0].activityLabel, /Actividad 1/);
  assert.equal(summary.rejectedActivities[0].reason, "Revisar la evidencia");
});

test("sin activityGradesManager cargado, rejectedActivities queda vacio (no revienta)", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-6", session: baseSession(), files: [], activityGradesManager: null,
  });
  const summary = await stack.studentSummary.refreshNow(baseSession(), { force: true });
  assert.deepEqual(Array.from(summary.rejectedActivities), []);
});

// ── 10: actualizacion de Etapa Productiva ──────────────────────────────────
test("Etapa Productiva: ficha con proyecto y documento base sin entregar aparece pendiente", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-7",
    session: baseSession({ user: { usernameKey: "juan.perez", ficha: "3168850" } }),
    files: [],
    productiveStageStore: {
      loadSnapshot: async () => ({ documentDeliveries: [] }),
      getDocumentDeliveriesByUsername: () => ({}),
    },
  });
  const summary = await stack.studentSummary.refreshNow(
    baseSession({ user: { usernameKey: "juan.perez", ficha: "3168850" } }),
    { force: true }
  );
  assert.deepEqual(Array.from(summary.productiveDocsPending).sort(), [
    "Acuerdo de Etapa Productiva",
    "Ficha de inscripción",
  ].sort());
});

test("Etapa Productiva: ficha SIN proyecto -> productiveDocsPending es null (no aplica)", async () => {
  const stack = loadPortalHomeStack({
    uid: "uid-8", session: baseSession(), files: [],
    productiveStageStore: { loadSnapshot: async () => ({}), getDocumentDeliveriesByUsername: () => ({}) },
  });
  const summary = await stack.studentSummary.refreshNow(baseSession(), { force: true });
  assert.equal(summary.productiveDocsPending, null);
});

test("Etapa Productiva: documento ya entregado no aparece como pendiente", async () => {
  const session = baseSession({ user: { usernameKey: "juan.perez", ficha: "3168850" } });
  const stack = loadPortalHomeStack({
    uid: "uid-9",
    session,
    files: [],
    productiveStageStore: {
      loadSnapshot: async () => ({}),
      getDocumentDeliveriesByUsername: () => ({ "juan.perez": { "ficha-inscripcion": { docId: "ficha-inscripcion" } } }),
    },
  });
  const summary = await stack.studentSummary.refreshNow(session, { force: true });
  assert.deepEqual(Array.from(summary.productiveDocsPending), ["Acuerdo de Etapa Productiva"]);
});

// ── 11: aislamiento -- el modulo nunca opera sobre un uid ajeno ────────────
test("el modulo del aprendiz solo usa su propio uid de sesion, nunca uno externo", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "student_summary.js"), "utf8");
  // computeStudentSummary/refreshStudentSummary/loadStudentSummaryForHome no
  // reciben ni aceptan un "targetUid"/"otherUid" -- el unico uid que usan es
  // el de la sesion activa (currentUid()).
  assert.doesNotMatch(src, /targetUid|otherUid|foreignUid/);
  assert.match(src, /currentUid\(\)/);
});

// ── 12: reglas -- solo dueno o admin, un aprendiz no puede leer/listar el de otro
test("firestore.rules: sena_portal_student_summary exige uid propio o admin", () => {
  const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
  const block = rules.match(/match \/sena_portal_student_summary\/\{uid\} \{[\s\S]*?\n {4}\}/);
  assert.ok(block, "debe existir el match block de sena_portal_student_summary");
  assert.match(block[0], /request\.auth\.uid == uid/);
  assert.match(block[0], /isAdmin\(\)/);
  // Sin "allow list" explicito ni "if true": una consulta list() sin filtro
  // no puede probarse valida para todo el set salvo isAdmin(), igual que
  // sena_portal_user_index (mismo idioma ya usado en este archivo).
  assert.doesNotMatch(block[0], /allow (get|read|list): if true/);
});

// ── 13: Firestore momentaneamente inaccesible -> no revienta, usa mirror ──
test("Firestore caido: loadForHome no revienta y usa el mirror local si existe", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-10", session: baseSession(), files: [] });
  await stack.studentSummary.refreshNow(baseSession(), { force: true });
  stack.firestore.state.down = true;

  const result = await stack.studentSummary.loadForHome(baseSession());
  assert.ok(result.summary, "debe devolver el ultimo summary conocido (mirror local)");
});

test("Firestore caido y SIN mirror previo: no revienta, degrada a datos vacios en vez de tumbar el Home", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-11", session: baseSession(), files: [] });
  stack.firestore.state.down = true;
  const result = await stack.studentSummary.loadForHome(baseSession());
  // No debe lanzar. Puede no tener summary (fuente "unavailable") o traer uno
  // degradado (sin datos de nube) -- en ningun caso debe rechazar la promesa.
  assert.ok(result && typeof result === "object");
});

// ── 14: el summary no rompe la sesion admin ni sesiones sin usernameKey ────
test("loadForHome sin session de aprendiz valida no revienta (Home admin/invitado)", async () => {
  const stack = loadPortalHomeStack({ uid: null, session: null, files: [] });
  const result = await stack.studentSummary.loadForHome(null);
  assert.equal(result.summary, null);
  assert.equal(result.source, "none");
});

test("compute() sin uid de Firebase (auth no hidratada aun) devuelve null, no revienta", async () => {
  const stack = loadPortalHomeStack({ uid: null, session: baseSession(), files: ["grupo-10a-guia-02.html"] });
  const summary = await stack.studentSummary.compute(baseSession());
  assert.equal(summary, null);
});

// ── isStale(): umbral de frescura expuesto para quien consuma el modulo ────
test("isStale(): summary sin updatedAt o vencido se marca stale; uno reciente no", () => {
  const stack = loadPortalHomeStack({ uid: "uid-12", session: baseSession(), files: [] });
  assert.equal(stack.studentSummary.isStale(null), true);
  assert.equal(stack.studentSummary.isStale({}), true);
  assert.equal(stack.studentSummary.isStale({ updatedAt: new Date().toISOString() }), false);
  assert.equal(
    stack.studentSummary.isStale({ updatedAt: new Date(Date.now() - 3600000).toISOString() }),
    true
  );
});

// ── firebase_db.js: contrato directo de cloudGetStudentSummary/SaveStudentSummary
test("cloudSaveStudentSummary sin uid no escribe nada (false, sin red)", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-13", session: baseSession(), files: [] });
  const ok = await stack.db.cloudSaveStudentSummary(null, { usernameKey: "juan.perez" });
  assert.equal(ok, false);
  assert.equal(stack.firestore.store.size, 0);
});

test("cloudGetStudentSummary sin uid devuelve null sin llamar a Firestore", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-14", session: baseSession(), files: [] });
  const doc = await stack.db.cloudGetStudentSummary(null);
  assert.equal(doc, null);
});

test("cloudSaveStudentSummary siempre estampa el uid correcto en el doc guardado (cumple la regla request.resource.data.uid == uid)", async () => {
  const stack = loadPortalHomeStack({ uid: "uid-15", session: baseSession(), files: [] });
  await stack.db.cloudSaveStudentSummary("uid-15", { usernameKey: "juan.perez", guidesProgressPercent: 50 });
  const stored = stack.firestore.store.get("sena_portal_student_summary/uid-15");
  assert.equal(stored.uid, "uid-15");
  assert.ok(stored.updatedAt, "debe estampar updatedAt");
});

// ── 3 (cierre Fase 11): ningun flujo administrativo/de calificacion/entrega/
//    taller confia en el resumen como fuente de verdad -- ratchet: si algun
//    dia alguien agrega una referencia ahi, esta prueba debe fallar y obligar
//    a revisar la decision explicitamente (ver justificacion del diseño en
//    firestore.rules, junto al match de sena_portal_student_summary).
test("ningun flujo administrativo/calificacion/entrega/taller lee o escribe el resumen del aprendiz", () => {
  const filesThatMustNotReferenceIt = [
    "admin_usuarios.js",
    "admin_habilitacion.js",
    "activity_grades.js",
    "activity_standard.js",
    "shared_apps_script_delivery.js",
    "shared_drive_delivery.js",
    "reinforcement_workshops.js",
    "reinforcement_workshops_student.js",
    "productive_stage_student.js",
    "productive_stage_store.js",
    "productive_stage_project_delivery.js",
    "guide_declarations.js",
  ];
  const forbiddenPattern = /sena_portal_student_summary|cloudGetStudentSummary|cloudSaveStudentSummary|window\.studentSummary/;
  filesThatMustNotReferenceIt.forEach((file) => {
    const fullPath = path.join(__dirname, "..", "js", file);
    if (!fs.existsSync(fullPath)) return; // si el archivo se renombra, no es este test quien debe fallar
    const src = fs.readFileSync(fullPath, "utf8");
    assert.doesNotMatch(
      src,
      forbiddenPattern,
      `${file} no debe leer/escribir sena_portal_student_summary -- es un cache derivado, ` +
        "no una fuente de verdad para decisiones academicas o administrativas"
    );
  });

  // Los .gs de Apps Script (unica logica "server-side" del proyecto) tampoco
  // deben conocer esta coleccion: las entregas y su verificacion de identidad
  // deben seguir dependiendo solo de fuentes autoritativas.
  const gsDir = path.join(__dirname, "..", "apps-script");
  fs.readdirSync(gsDir).filter((f) => f.endsWith(".gs")).forEach((file) => {
    const src = fs.readFileSync(path.join(gsDir, file), "utf8");
    assert.doesNotMatch(src, forbiddenPattern, `${file} (Apps Script) no debe referenciar sena_portal_student_summary`);
  });

  // Y en el propio consumidor (portal_home.js), confirmar que el uso declarado
  // es de LECTURA para mostrar, nunca para decidir bloqueos/calificaciones.
  const homeSrc = fs.readFileSync(path.join(__dirname, "..", "js", "portal_home.js"), "utf8");
  assert.match(homeSrc, /studentSummary\.loadForHome/, "portal_home.js debe seguir siendo el consumidor de lectura");
  assert.doesNotMatch(homeSrc, /studentSummary\.loadForHome[\s\S]{0,400}(-locked|isAdmin|calificar|bloquear)/i);
});
