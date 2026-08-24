"use strict";

// Auditoria 2026-08-22, Fase 5: cloudSaveGuideData (js/firebase_db.js) hacia
// su propio ciclo leer-modificar-escribir SIN serializar por documento. Si
// dos guardados del MISMO aprendiz+guia se solapaban (dos pestañas, o el
// autosave y el boton "Guardar respuestas" casi al mismo tiempo), cada uno
// leia un snapshot desactualizado y el ultimo PATCH en llegar (reemplazo
// COMPLETO del documento, sin updateMask) borraba lo que el otro ya habia
// guardado. Mismo patron que tests/firebase_admin_guide_state_race.test.cjs
// (ese cubre las escrituras del ADMIN), aqui se cubre cloudSaveGuideData
// llamado directamente como lo hace un guion de guia del aprendiz.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function makeLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mismo fake de Firestore que firebase_admin_guide_state_race.test.cjs: GET
// devuelve lo ultimo guardado (o 404), PATCH reemplaza el documento COMPLETO.
function makeFakeFirestore(delayMs) {
  const store = new Map();

  async function fetchImpl(url, options) {
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const collection = match[1];
    const docId = decodeURIComponent(match[2]);
    const key = collection + "/" + docId;

    if (method === "GET") {
      await sleep(delayMs);
      if (!store.has(key)) return { ok: false, status: 404, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: store.get(key), updateTime: new Date().toISOString() }),
      };
    }

    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      await sleep(delayMs);
      store.set(key, body.fields);
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: body.fields, updateTime: new Date().toISOString() }),
      };
    }

    throw new Error("metodo inesperado en el fake Firestore: " + method);
  }

  return { fetchImpl };
}

function loadFirebaseDb(fetchImpl) {
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "firebase_db.js"), "utf8");
  const localStorage = makeLocalStorage();
  const windowObj = {
    PORTAL_FIREBASE_CONFIG: { enabled: true, projectId: "test-project", apiKey: "test-key" },
    localStorage,
    setTimeout,
    clearTimeout,
    addEventListener: () => {},
    dispatchEvent: () => {},
    portalFirebaseAuth: {
      currentUid: () => "uid-test",
      getIdToken: async () => "token-test",
      waitForAuthHydration: async () => true,
      buildEmail: (key) => key + "@sena-portal.local",
    },
    portalAuth: {},
  };
  const sandbox = {
    window: windowObj,
    localStorage,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    console: { info() {}, warn() {}, error() {}, log() {} },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
  };
  windowObj.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  // Fase 14: firebase_db.js ahora requiere window.guideMergeUtils cargado antes.
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "guide_merge_utils.js"), "utf8"), sandbox);
  vm.runInContext(code, sandbox);
  return windowObj._firebaseDb;
}

test("dos guardados casi simultaneos del mismo aprendiz/guia (autosave + boton Guardar) no se pisan entre si", async () => {
  const { fetchImpl } = makeFakeFirestore(25);
  const db = loadFirebaseDb(fetchImpl);
  const scopeKey = "student:auditoria_claude";
  const fileName = "grupo-99-guia-race.html";

  // Simula: el autosave dispara con el estado hasta el campo 1, y CASI al
  // mismo tiempo el boton "Guardar respuestas" dispara con el estado hasta
  // el campo 2 (ambos snapshots completos, como realmente arma cada guion
  // de guia -- el bug real no era de merge de campos sueltos sino de la
  // lectura desactualizada de cada ciclo).
  const [r1, r2] = await Promise.all([
    db.cloudSaveGuideData(scopeKey, fileName, { state: { campo1: "Respuesta 1" }, updatedAt: new Date().toISOString() }),
    db.cloudSaveGuideData(scopeKey, fileName, { state: { campo1: "Respuesta 1", campo2: "Respuesta 2" }, updatedAt: new Date(Date.now() + 5).toISOString() }),
  ]);

  assert.strictEqual(r1, true, "el primer guardado debe reportar exito");
  assert.strictEqual(r2, true, "el segundo guardado debe reportar exito");

  const final = await db.cloudGetGuideData(scopeKey, fileName);
  const state = (final && final.state) || {};
  assert.strictEqual(state.campo1, "Respuesta 1", "no debe perderse el campo 1");
  assert.strictEqual(state.campo2, "Respuesta 2", "no debe perderse el campo 2 por la carrera de lecturas");
});

test("resolveGuideHydration nunca reemplaza una respuesta remota valida por un local vacio o mas viejo", () => {
  const db = loadFirebaseDb(makeFakeFirestore(0).fetchImpl);

  // Local vacio (equipo nuevo / cache borrada), remoto con respuestas reales.
  const r1 = db.resolveGuideHydration(
    { state: {}, updatedAt: "" },
    { state: { campo1: "Respuesta real guardada antes" }, updatedAt: "2026-08-01T10:00:00.000Z" }
  );
  assert.strictEqual(r1.state.campo1, "Respuesta real guardada antes");
  assert.strictEqual(r1.source, "remote");

  // Local mas reciente que el remoto (el aprendiz escribio offline y el
  // remoto todavia no se entero): debe ganar lo local, sin perder lo remoto
  // que no se solape.
  const r2 = db.resolveGuideHydration(
    { state: { campo1: "Editado offline" }, updatedAt: "2026-08-10T10:00:00.000Z" },
    { state: { campo1: "Vieja", campo2: "Otro campo remoto" }, updatedAt: "2026-08-01T10:00:00.000Z" }
  );
  assert.strictEqual(r2.state.campo1, "Editado offline", "lo local mas nuevo debe ganar su propio campo");
  assert.strictEqual(r2.state.campo2, "Otro campo remoto", "no debe perder un campo remoto que lo local ni toca");
  assert.strictEqual(r2.source, "local");

  // Sin remoto (primera vez o Firestore inalcanzable): se queda con lo local tal cual.
  const r3 = db.resolveGuideHydration({ state: { campo1: "Solo local" }, updatedAt: "" }, null);
  assert.strictEqual(r3.state.campo1, "Solo local");
  assert.strictEqual(r3.source, "local");
});
