// Cierre Bug 1 (validacion E2E Guias 10/11/12 Kennedy, 2026-09-07):
//
// Confirmado por inspeccion + reproduccion real en Chrome headless: ~27
// paginas reales de pages/auxiliares/ (quizzes de las guias 2/3/6/10/11,
// matriz 322, ficha de caso, formulario) cargan js/firebase_db.js pero NUNCA
// cargan js/guide_merge_utils.js. Antes del fix, firebase_db.js leia
// window.guideMergeUtils de forma incondicional al nivel superior del script
// (no dentro de una funcion) -- si no existia, ese acceso lanzaba
// "TypeError: Cannot read properties of undefined (reading
// 'readSnapshotPayload')" de inmediato y abortaba TODO el resto del archivo:
// window._firebaseDb quedaba sin definir para toda la sesion de esa pagina,
// incluyendo funciones sin relacion alguna con el merge de guias
// (calificaciones, calendario, resumen del aprendiz, etc.).
//
// Esta prueba NO busca texto en el codigo -- ejecuta firebase_db.js de
// verdad en un contexto vm SIN cargar guide_merge_utils.js antes (la misma
// condicion real de esas ~27 paginas) y comprueba el comportamiento
// resultante. Debe FALLAR contra el codigo viejo (la carga del script lanza
// y _firebaseDb nunca se define) y PASAR contra el codigo corregido.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadFirebaseDbWithoutGuideMergeUtils() {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const storage = new Map();
  const window = {
    PORTAL_FIREBASE_CONFIG: { enabled: false, projectId: "", apiKey: "" },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    portalAuth: { getCurrentSession: () => null },
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  const context = vm.createContext({ window, console, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  // A proposito: NO se carga guide_merge_utils.js aqui. Esto reproduce
  // exactamente lo que sirven hoy las ~27 paginas afectadas.
  vm.runInContext(source, context, { filename: "firebase_db.js" });
  return context.window._firebaseDb;
}

test("firebase_db.js define window._firebaseDb incluso si guide_merge_utils.js nunca se cargo", () => {
  const db = loadFirebaseDbWithoutGuideMergeUtils();
  assert.equal(typeof db, "object");
  assert.notEqual(db, null);
});

test("sin guide_merge_utils.js, las funciones NO relacionadas con el merge de guias siguen operativas", async () => {
  const db = loadFirebaseDbWithoutGuideMergeUtils();
  assert.equal(typeof db.checkAvailability, "function");
  assert.equal(typeof db.cloudGetCalendar, "function");
  assert.equal(typeof db.cloudSaveGrades, "function");
  // isConfigured=false (PORTAL_FIREBASE_CONFIG.enabled=false) hace que
  // checkAvailability retorne false sin red -- confirma que la funcion
  // existe y corre, no solo que la referencia no es undefined.
  const available = await db.checkAvailability();
  assert.equal(available, false);
});

test("sin guide_merge_utils.js, una operacion que SI necesita el merge falla con un mensaje claro (no rompe todo el modulo)", () => {
  const db = loadFirebaseDbWithoutGuideMergeUtils();
  assert.equal(typeof db.mergeGuideDataSnapshotForSave, "function");
  assert.throws(
    () => db.mergeGuideDataSnapshotForSave({ state: {} }, { state: {} }),
    /guideMergeUtils no esta disponible/
  );
});

test("sin guide_merge_utils.js, mergeGuideState (usado por el panel admin) falla con el mismo mensaje claro", () => {
  const db = loadFirebaseDbWithoutGuideMergeUtils();
  assert.equal(typeof db.mergeGuideState, "function");
  assert.throws(
    () => db.mergeGuideState({}, {}, false),
    /guideMergeUtils no esta disponible/
  );
});

test("con guide_merge_utils.js cargado (orden real de guia.html), el comportamiento no cambia", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const mergeUtilsSource = fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8");
  const storage = new Map();
  const window = {
    PORTAL_FIREBASE_CONFIG: { enabled: false, projectId: "", apiKey: "" },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    portalAuth: { getCurrentSession: () => null },
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  const context = vm.createContext({ window, console, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  vm.runInContext(mergeUtilsSource, context, { filename: "guide_merge_utils.js" });
  vm.runInContext(source, context, { filename: "firebase_db.js" });
  const db = context.window._firebaseDb;

  const merged = db.mergeGuideDataSnapshotForSave(
    { state: { pregunta1: "Respuesta previa" } },
    { state: { pregunta1: "" } }
  );
  assert.equal(merged.state.pregunta1, "Respuesta previa");
});
