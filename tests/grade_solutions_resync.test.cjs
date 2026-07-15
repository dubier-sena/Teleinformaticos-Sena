const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const FAMILY = "guia-02-herramientas";
const USERNAME_KEY = "prueba.aprendiz";

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// Boton "Re-sincronizar soluciones" (jul-15). Reporte real del usuario validando
// Guia 2: la Actividad 10 (transferReto341) aparecia CALIFICADA pero con las
// respuestas vacias. Causa: la solucion modelo se embebe en la nota SOLO en el
// momento de marcar "A" -- una nota puesta antes de importar el banco a
// Firestore quedo sin solucion, y una puesta antes de AMPLIAR el banco (p. ej.
// el checklist de competencias) quedo con la solucion vieja. El boton recorre
// las notas "A" existentes y les copia la solucion actual sin tocar la nota ni
// su fecha de calificacion.

function extractComputeSolutionResyncUpdates() {
  const script = read(path.join("js", "admin_usuarios.js"));
  const fnMatch = script.match(/function computeSolutionResyncUpdates\(allGrades, bankLookup\) \{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "no se encontro computeSolutionResyncUpdates en admin_usuarios.js");
  return new Function("return (" + fnMatch[0] + ");")();
}

test("computeSolutionResyncUpdates: detecta notas A sin solucion o con solucion vieja; ignora D y llaves de payload", () => {
  const compute = extractComputeSolutionResyncUpdates();
  const bank = {
    [FAMILY]: {
      transferReto341: { "transfer-reto-guia": "modelo guia", "transfer-reto-uso": "modelo uso" },
      colaborativas334: { "collab:canva:function": "x", "checklist:doc-word": "domino" },
      extensiones331: { "extension:xlsx:program": "Excel" },
    },
  };
  const bankLookup = (family, actId) => (bank[family] || {})[actId] || null;

  const updates = compute({
    [FAMILY]: {
      // A sin solucion embebida (el caso de la Actividad 10 del usuario) -> update.
      transferReto341: "A",
      "transferReto341:gradedAt": "2026-07-01T00:00:00.000Z",
      // A con solucion VIEJA (el banco crecio despues, caso del checklist) -> update.
      colaborativas334: "A",
      "colaborativas334:solution": { "collab:canva:function": "x" },
      // A con la solucion ACTUAL ya embebida -> nada (idempotente).
      extensiones331: "A",
      "extensiones331:solution": { "extension:xlsx:program": "Excel" },
      // No aprobada -> nunca se rellena.
      sistemas332: "D",
      // Sin entrada en el banco -> nada.
      sopaletras311: "A",
    },
  }, bankLookup);

  const ids = updates.map((u) => u.activityId).sort();
  assert.deepEqual(ids, ["colaborativas334", "transferReto341"]);
  updates.forEach((u) => assert.equal(u.family, FAMILY));
});

test("computeSolutionResyncUpdates: una nota A guardada bajo un aliasId con banco propio tambien se re-embebe", () => {
  const compute = extractComputeSolutionResyncUpdates();
  const bankLookup = (family, actId) => (actId === "fichaCaso" ? { "fichacaso-tienda-a": "modelo" } : null);
  const updates = compute({ [FAMILY]: { fichaCaso: "A" } }, bankLookup);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].activityId, "fichaCaso");
});

// ── embedStudentActivitySolution: contra el codigo REAL de activity_grades.js ──

function makeField(initialValue) {
  return { value: initialValue || "", dispatchEvent() {} };
}

function loadActivityGrades() {
  const elementsByDataStore = {};
  const localStorageStub = {
    _data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };
  const ctx = {
    console,
    localStorage: localStorageStub,
    Event,
    document: {
      querySelectorAll(selector) {
        const m = /^\[data-store="(.*)"\]$/.exec(selector);
        if (!m) return [];
        const el = elementsByDataStore[m[1]];
        return el ? [el] : [];
      },
    },
  };
  ctx.window = ctx;
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: USERNAME_KEY, user: { usernameKey: USERNAME_KEY } }),
    getStudentStorageKey: (usernameKey, key, opts) => `sena_portal:student:${usernameKey}:${(opts && opts.area) || "app"}:${key}`,
  };
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "activity_grades.js")), ctx, { filename: "activity_grades.js" });
  return {
    ctx,
    registerField(dataStoreKey, initialValue) {
      const el = makeField(initialValue);
      elementsByDataStore[dataStoreKey] = el;
      return el;
    },
  };
}

test("embedStudentActivitySolution: embebe en una A existente SIN tocar gradedAt, y el relleno de la guia funciona despues", () => {
  const { ctx, registerField } = loadActivityGrades();
  const campoUso = registerField("transfer-reto-uso", "");
  const gradedAt = "2026-07-01T00:00:00.000Z";
  const mgr = ctx.window.activityGradesManager;

  mgr.setStudentGrades(USERNAME_KEY, FAMILY, {
    transferReto341: "A",
    "transferReto341:gradedAt": gradedAt,
  });

  const ok = mgr.embedStudentActivitySolution(USERNAME_KEY, FAMILY, "transferReto341", {
    "transfer-reto-uso": "respuesta modelo del banco",
  });
  assert.equal(ok, true);

  const grades = mgr.getStudentGrades(USERNAME_KEY, FAMILY);
  assert.equal(grades["transferReto341:gradedAt"], gradedAt, "la fecha de calificacion NO debe cambiar");
  // Comparacion por propiedad (el objeto sale de otro realm de vm y deepEqual
  // falla por prototipos distintos, ver nota jul-14).
  assert.equal(grades["transferReto341:solution"]["transfer-reto-uso"], "respuesta modelo del banco");
  assert.equal(Object.keys(grades["transferReto341:solution"]).length, 1);

  // Ciclo completo: con la solucion ya embebida, la guia rellena el campo vacio.
  const filled = mgr.applyApprovedSolutionsForFamily(FAMILY);
  assert.equal(filled, true);
  assert.equal(campoUso.value, "respuesta modelo del banco");
});

test("embedStudentActivitySolution: NO embebe si la nota no es A", () => {
  const { ctx } = loadActivityGrades();
  const mgr = ctx.window.activityGradesManager;
  mgr.setStudentGrades(USERNAME_KEY, FAMILY, { transferReto341: "D" });
  const ok = mgr.embedStudentActivitySolution(USERNAME_KEY, FAMILY, "transferReto341", { "transfer-reto-uso": "x" });
  assert.equal(ok, false);
  const grades = mgr.getStudentGrades(USERNAME_KEY, FAMILY);
  assert.equal(Object.prototype.hasOwnProperty.call(grades, "transferReto341:solution"), false);
});

test("cableado del panel: boton de re-sincronizacion conectado al flujo correcto", () => {
  const admin = read(path.join("js", "admin_usuarios.js"));
  assert.match(admin, /id="grades-resync-btn"/);
  assert.match(admin, /byId\("grades-resync-btn"\)\?\.addEventListener\("click", handleSolutionResync\)/);
  const handler = admin.match(/async function handleSolutionResync\(\) \{[\s\S]*?\n  \}/);
  assert.ok(handler, "no se encontro handleSolutionResync");
  assert.match(handler[0], /ensureGradeSolutionsBank\(true\)/);
  assert.match(handler[0], /computeSolutionResyncUpdates\(all, lookupBankSolution\)/);
  assert.match(handler[0], /embedStudentActivitySolution\(user\.usernameKey, up\.family, up\.activityId, up\.solution\)/);
  assert.match(handler[0], /applyApprovedSolutionToStudentCloud\(user\.usernameKey, up\.family, up\.solution\)/);
  // El cache local se sincroniza con el doc COMPLETO antes de re-guardar
  // (saveGradesToCloud reemplaza el doc entero; sin esto se pierden notas).
  assert.match(handler[0], /setAllStudentGrades\?\.\(user\.usernameKey, all\)/);
});
