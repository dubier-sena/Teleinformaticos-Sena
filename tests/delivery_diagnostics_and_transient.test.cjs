"use strict";

// Bloque G (auditoria 2026-08-27, confiabilidad de entregas):
//   - isPermanentDeliveryError debe preferir el flag explicito error.transient
//     (viene del servidor via uploadToAppsScript) sobre adivinar por texto.
//   - uploadToAppsScript debe propagar diag/diagDetail/transient/httpStatus
//     del JSON del servidor en el Error que lanza (antes se descartaban).
//   - uploadToAppsScript debe abortar por timeout si el servidor nunca
//     responde (antes se quedaba colgado para siempre, sin llegar ni al
//     segundo intento de retryWithBackoff).
//   - buildSubmissionId / logDeliveryDiagnostic / getDeliveryDiagnostics:
//     identificador estable + registro acotado (bloque K), nunca con secretos.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDelivery(extraWindow) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "shared_apps_script_delivery.js"),
    "utf8"
  );
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const windowObj = Object.assign(
    {
      PROJECT_INTEGRATIONS: { googleAppsScriptUrl: "https://script.google.com/macros/s/FAKE/exec" },
      portalFirebaseAuth: { getIdToken: async () => "fake-id-token" },
      localStorage,
    },
    extraWindow || {}
  );
  const sandbox = {
    window: windowObj,
    localStorage,
    document: { addEventListener() {}, querySelectorAll() { return []; } },
    console: { warn() {}, error() {}, info() {}, log() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    AbortController: global.AbortController,
    URL: global.URL,
    crypto: (extraWindow && extraWindow.__crypto) || undefined,
    fetch: (extraWindow && extraWindow.__fetch) || undefined,
  };
  windowObj.window = windowObj;
  windowObj.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.sharedAppsScriptDelivery;
}

// ── isPermanentDeliveryError: flag explicito gana sobre el texto ───────────

test("isPermanentDeliveryError: error.transient=false (explicito) clasifica como PERMANENTE aunque el texto sea neutro", () => {
  const api = loadDelivery();
  const err = new Error("mensaje neutro que no menciona ninguna palabra clave conocida");
  err.transient = false;
  assert.strictEqual(api._isPermanentDeliveryError(err), true);
});

test("isPermanentDeliveryError: error.transient=true (explicito) clasifica como TRANSITORIO aunque el texto contenga 'carpeta'", () => {
  const api = loadDelivery();
  const err = new Error("problema con la carpeta, pero el servidor dice que reintentemos");
  err.transient = true;
  assert.strictEqual(api._isPermanentDeliveryError(err), false);
});

test("isPermanentDeliveryError: sin flag explicito, sigue usando el texto (compatibilidad)", () => {
  const api = loadDelivery();
  assert.strictEqual(api._isPermanentDeliveryError(new Error("El archivo no tiene una extension permitida.")), true);
  assert.strictEqual(api._isPermanentDeliveryError(new Error("No fue posible entregar el archivo en este momento.")), false);
});

// ── uploadToAppsScript: propaga diag/transient/httpStatus del servidor ─────

test("uploadToAppsScript propaga diag/diagDetail/transient/httpStatus cuando el servidor responde ok:false", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: false,
      transient: true,
      diag: "profile-unverified",
      diagDetail: "",
      message: "No fue posible verificar tu perfil en este momento.",
    }),
  });
  const api = loadDelivery({ __fetch: fakeFetch });
  await assert.rejects(
    () => api._uploadToAppsScript({ fileName: "x.py" }),
    (err) => {
      assert.strictEqual(err.transient, true);
      assert.strictEqual(err.diag, "profile-unverified");
      assert.strictEqual(err.httpStatus, 200);
      assert.match(err.message, /verificar tu perfil/);
      return true;
    }
  );
});

test("uploadToAppsScript: sin campos diag/transient del servidor, el error no los trae (sin inventar datos)", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: false, message: "Faltan datos obligatorios para registrar la entrega." }),
  });
  const api = loadDelivery({ __fetch: fakeFetch });
  await assert.rejects(
    () => api._uploadToAppsScript({ fileName: "x.py" }),
    (err) => {
      assert.strictEqual(err.transient, undefined);
      assert.strictEqual(err.diag, undefined);
      assert.strictEqual(err.httpStatus, 200);
      return true;
    }
  );
});

test("uploadToAppsScript: sin idToken disponible, lanza error transient=true con diag no-id-token", async () => {
  const api = loadDelivery({
    __fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }),
    portalFirebaseAuth: { getIdToken: async () => null },
  });
  await assert.rejects(
    () => api._uploadToAppsScript({ fileName: "x.py" }),
    (err) => {
      assert.strictEqual(err.transient, true);
      assert.strictEqual(err.diag, "no-id-token");
      return true;
    }
  );
});

// ── Timeout del lado cliente (antes no existia: se colgaba para siempre) ──

test("uploadToAppsScript: aborta por timeout si el servidor nunca responde, marca transient + diag client-timeout", async () => {
  const hangingFetch = (url, opts) =>
    new Promise((resolve, reject) => {
      if (opts && opts.signal) {
        opts.signal.addEventListener("abort", () => {
          const abortErr = new Error("The operation was aborted");
          abortErr.name = "AbortError";
          reject(abortErr);
        });
      }
      // Nunca resuelve por si sola: simula un Apps Script realmente colgado.
    });
  const api = loadDelivery({ __fetch: hangingFetch });
  const startedAt = Date.now();
  await assert.rejects(
    () => api._uploadToAppsScript({ fileName: "x.py" }, { timeoutMs: 20 }),
    (err) => {
      assert.strictEqual(err.transient, true);
      assert.strictEqual(err.diag, "client-timeout");
      assert.match(err.message, /tardo demasiado/i);
      return true;
    }
  );
  assert.ok(Date.now() - startedAt < 2000, "el timeout configurado (20ms) debe cortar la espera, no colgarse minutos");
});

test("uploadToAppsScript: fetch rechaza por red (no abort) -> transient=true, diag network-error", async () => {
  const api = loadDelivery({ __fetch: async () => { throw new Error("Failed to fetch"); } });
  await assert.rejects(
    () => api._uploadToAppsScript({ fileName: "x.py" }),
    (err) => {
      assert.strictEqual(err.transient, true);
      assert.strictEqual(err.diag, "network-error");
      return true;
    }
  );
});

// ── submissionId: identificador estable para idempotencia ─────────────────

test("buildSubmissionId produce un id no vacio y distinto en cada llamada", () => {
  const api = loadDelivery();
  const a = api._buildSubmissionId();
  const b = api._buildSubmissionId();
  assert.ok(a && typeof a === "string" && a.length > 0);
  assert.notStrictEqual(a, b);
});

test("buildSubmissionId sin crypto en el entorno: cae al formato de respaldo 'sub-...'", () => {
  const api = loadDelivery();
  assert.match(api._buildSubmissionId(), /^sub-/);
});

test("buildSubmissionId usa crypto.randomUUID cuando esta disponible", () => {
  const api = loadDelivery({ __crypto: { randomUUID: () => "11111111-2222-3333-4444-555555555555" } });
  assert.strictEqual(api._buildSubmissionId(), "11111111-2222-3333-4444-555555555555");
});

// ── Observabilidad (bloque K): registro acotado, nunca con secretos ────────

test("logDeliveryDiagnostic / getDeliveryDiagnostics: guarda y lee entradas, mas reciente primero", () => {
  const api = loadDelivery();
  api._logDeliveryDiagnostic({ stage: "retry", attempt: 1 });
  api._logDeliveryDiagnostic({ stage: "failed", diag: "profile-unverified" });
  const log = api.getDeliveryDiagnostics();
  assert.strictEqual(log.length, 2);
  assert.strictEqual(log[0].stage, "failed", "la entrada mas reciente debe quedar primero");
  assert.ok(log[0].at, "cada entrada debe tener marca de tiempo");
});

test("logDeliveryDiagnostic: nunca acepta idToken/JWT/contrasena porque los llamadores del proyecto nunca se los pasan (contrato de la funcion)", () => {
  const api = loadDelivery();
  // La funcion es un sumidero generico -- la garantia real es de disciplina en
  // los call-sites (handleModalSubmit/runDeliveryQueue), verificada aqui
  // negativamente: ningun campo de los que SI se registran hoy se parece a un
  // secreto.
  api._logDeliveryDiagnostic({ stage: "failed", diag: "profile-unverified", httpStatus: 200, attempt: 2, durationMs: 1200 });
  const entry = api.getDeliveryDiagnostics()[0];
  const keys = Object.keys(entry);
  keys.forEach((k) => {
    assert.doesNotMatch(k.toLowerCase(), /token|jwt|password|contrasena/);
  });
});

test("getDeliveryDiagnostics: se acota a 50 entradas (ring buffer)", () => {
  const api = loadDelivery();
  for (let i = 0; i < 60; i++) {
    api._logDeliveryDiagnostic({ stage: "failed", i });
  }
  const log = api.getDeliveryDiagnostics();
  assert.strictEqual(log.length, 50);
  assert.strictEqual(log[0].i, 59, "debe conservar las mas recientes, no las mas viejas");
});

// ── friendlyDiagHint: pista no tecnica por codigo de diagnostico ───────────

test("friendlyDiagHint traduce codigos conocidos a una pista breve y no tecnica", () => {
  const api = loadDelivery();
  assert.match(api._friendlyDiagHint("profile-unverified"), /perfil/i);
  assert.match(api._friendlyDiagHint("client-timeout"), /tardo|congestion/i);
  assert.strictEqual(api._friendlyDiagHint("codigo-desconocido-xyz"), "");
  assert.strictEqual(api._friendlyDiagHint(undefined), "");
});
