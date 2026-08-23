"use strict";

// Regresion (detectada 2026-07-25 calificando Guia 6 para el aprendiz de
// pruebas 11A): al calificar varias actividades de la MISMA guia seguidas
// desde el panel admin, cada aprobacion dispara su propio ciclo
// leer-modificar-escribir sobre el mismo documento de guide_state
// (adminApplySolutionToGuide / adminMarkActivityDelivered en js/firebase_db.js).
// Firestore REST sin `updateMask` trata un PATCH como un REEMPLAZO COMPLETO
// del documento, asi que si esos ciclos se solapan (network en vuelo), el
// ultimo PATCH en llegar al servidor gana entero y borra lo que las demas
// actividades ya habian escrito. En produccion esto se vio como: calificar 8
// actividades de Guia 6 en pocos segundos dejo solo 1 guardada.
//
// El fix serializa las escrituras por documento (scopeKey+archivo) con una
// cola de promesas (withGuideStateWriteQueue), sin tocar el merge por
// timestamp existente (que sigue protegiendo ediciones reales del aprendiz
// desde otro dispositivo). Generalizada 2026-08-22 para vivir DENTRO de
// cloudSaveGuideData (antes solo envolvia las llamadas admin desde afuera):
// asi protege por igual escrituras de admin y del propio aprendiz sobre el
// mismo documento, sin arriesgar el deadlock de encolar dos veces la misma
// llave (ver tests/guide_cloud_sync_store.test.cjs).

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

// Emula el backend REST de Firestore para UN documento: GET devuelve lo
// ultimo guardado (o 404 si no existe), PATCH reemplaza el documento
// COMPLETO (igual que Firestore real cuando la URL no lleva updateMask) --
// exactamente el comportamiento que hace real la condicion de carrera.
function makeFakeFirestore(delayMs) {
  const store = new Map(); // "<collection>/<docId>" -> fields (formato tipado de Firestore)
  const requestLog = [];

  async function fetchImpl(url, options) {
    const method = (options && options.method) || "GET";
    const match = url.match(/documents\/([^/?]+)\/([^?]+)/);
    const collection = match[1];
    const docId = decodeURIComponent(match[2]);
    const key = collection + "/" + docId;
    requestLog.push({ method, key, at: Date.now() });

    if (method === "GET") {
      await sleep(delayMs);
      if (!store.has(key)) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: store.get(key) }),
      };
    }

    if (method === "PATCH") {
      const body = JSON.parse(options.body);
      await sleep(delayMs);
      store.set(key, body.fields); // reemplazo completo, como Firestore real sin updateMask
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: "projects/test/databases/(default)/documents/" + key, fields: body.fields }),
      };
    }

    throw new Error("metodo inesperado en el fake Firestore: " + method);
  }

  return { fetchImpl, requestLog };
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
  vm.runInContext(code, sandbox);
  return windowObj._firebaseDb;
}

test("calificar varias actividades seguidas de la misma guia no pierde las respuestas de las anteriores (condicion de carrera)", async () => {
  const { fetchImpl } = makeFakeFirestore(30); // latencia de red simulada

  // Un archivo SIN alias en guideDataFileName(): asi el nombre que se lee al
  // verificar es el mismo que el que usan internamente adminApplySolutionToGuide
  // / adminMarkActivityDelivered para guardar (evita un falso mismatch en el
  // test si el archivo real tuviera alias, ej. "grupo-11a-guia-06...".html -> "11a_guia6.html").
  const usernameKey = "prueba11asb";
  const fileName = "grupo-11a-guia-99-race-test.html";
  const db = loadFirebaseDb(fetchImpl);

  // Simula al admin calificando 4 actividades de la MISMA guia casi al mismo
  // tiempo (el flujo real al calificar una guia completa): 2 con solucion de
  // banco (texto) y 2 tipo entrega/fallback (sin campos de texto).
  const results = await Promise.all([
    db.adminApplySolutionToGuide(usernameKey, fileName, { bitacora_campo: "Respuesta 1" }),
    db.adminMarkActivityDelivered(usernameKey, fileName, "quizGuia6"),
    db.adminApplySolutionToGuide(usernameKey, fileName, { socializacion_campo: "Respuesta 2" }),
    db.adminMarkActivityDelivered(usernameKey, fileName, "tabla321"),
  ]);

  results.forEach((r, i) => assert.strictEqual(r.ok, true, `la escritura ${i} debe reportar exito`));

  const final = await db.cloudGetGuideData("student:" + usernameKey, fileName);
  const state = (final && final.state) || {};

  assert.strictEqual(state.bitacora_campo, "Respuesta 1", "se perdio la respuesta de la actividad 1 (bitacora)");
  assert.strictEqual(state.socializacion_campo, "Respuesta 2", "se perdio la respuesta de la actividad 3 (socializacion)");
  assert.strictEqual(state["quizGuia6-locked"], true, "se perdio el bloqueo de la actividad 2 (quiz)");
  assert.strictEqual(state["tabla321-locked"], true, "se perdio el bloqueo de la actividad 4 (tabla)");
  assert.ok(state["quizGuia6-delivery"], "se perdio la entrega registrada de la actividad 2 (quiz)");
  assert.ok(state["tabla321-delivery"], "se perdio la entrega registrada de la actividad 4 (tabla)");
});

test("las escrituras admin para documentos distintos (otro aprendiz u otra guia) no esperan una a la otra", async () => {
  const { fetchImpl, requestLog } = makeFakeFirestore(20);
  const db = loadFirebaseDb(fetchImpl);
  const fileName = "grupo-11a-guia-99-race-test.html";

  await Promise.all([
    db.adminApplySolutionToGuide("prueba11asb", fileName, { campoA: "valorA" }),
    db.adminApplySolutionToGuide("otroaprendiz", fileName, { campoB: "valorB" }),
  ]);

  // Si compartieran cola (bug de sobre-alcance: la cola deberia ser por
  // aprendiz+archivo, no global), TODAS las peticiones del segundo aprendiz
  // llegarian despues de que el primero termine. Verificamos lo contrario:
  // la PRIMERA peticion de "otroaprendiz" se dispara antes de que termine la
  // ULTIMA peticion de "prueba11asb" (se intercalan, no se esperan).
  const firstOtroIdx = requestLog.findIndex((r) => r.key.includes("otroaprendiz"));
  const lastPruebaIdx = requestLog.map((r) => r.key.includes("prueba11asb")).lastIndexOf(true);
  assert.ok(
    firstOtroIdx < lastPruebaIdx,
    "las peticiones de dos documentos distintos deberian intercalarse, no esperar una cola compartida"
  );
});
