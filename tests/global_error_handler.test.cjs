const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const SOURCE = fs.readFileSync(path.join(root, "js", "global_error_handler.js"), "utf8");

function loadModule() {
  const listeners = {};
  const storage = {};
  const alerts = [];
  const consoleErrors = [];

  const ctx = {
    console: {
      error: function () { consoleErrors.push(Array.prototype.slice.call(arguments)); },
      warn: function () {},
      log: function () {},
    },
  };
  ctx.window = ctx;
  ctx.window.localStorage = {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; },
  };
  ctx.window.location = { pathname: "/guia.html", search: "?g=x" };
  ctx.window.addEventListener = function (type, fn) {
    (listeners[type] = listeners[type] || []).push(fn);
  };
  ctx.document = { body: {} };

  vm.createContext(ctx);
  vm.runInContext(SOURCE, ctx);

  return { ctx, listeners, storage, alerts, consoleErrors };
}

function fireError(mod, overrides) {
  const event = Object.assign(
    { message: "Boom", filename: "js/script.js", lineno: 10, colno: 2, error: { stack: "stack-trace-here" } },
    overrides
  );
  mod.listeners.error.forEach((fn) => fn(event));
}

function fireRejection(mod, reason) {
  mod.listeners.unhandledrejection.forEach((fn) => fn({ reason }));
}

function readLog(mod) {
  const raw = mod.storage["sena_portal_client_errors_v1"];
  return raw ? JSON.parse(raw) : [];
}

test("se instala sin necesitar portalAlert (no revienta si falta)", () => {
  const mod = loadModule();
  assert.equal(typeof mod.ctx.window.senaErrorLog.getAll, "function");
});

test("registra un error en consola y en el log persistente, y avisa una vez", () => {
  const mod = loadModule();
  mod.ctx.window.portalAlert = function (msg, opts) { mod.alerts.push({ msg, opts }); };

  fireError(mod);

  const log = readLog(mod);
  assert.equal(log.length, 1);
  assert.equal(log[0].kind, "error");
  assert.equal(log[0].message, "Boom");
  assert.equal(log[0].source, "js/script.js");
  assert.equal(log[0].stack, "stack-trace-here");
  assert.equal(mod.consoleErrors.length, 1);
  assert.equal(mod.alerts.length, 1);
  assert.equal(mod.alerts[0].opts.type, "error");
  // El mensaje al aprendiz debe ser generico: no debe filtrar el mensaje tecnico ni el archivo.
  assert.equal(mod.alerts[0].msg.includes("Boom"), false);
  assert.equal(mod.alerts[0].msg.includes("script.js"), false);
});

test("no repite el aviso visual para el mismo error (dedupe), pero SIEMPRE sigue registrando", () => {
  const mod = loadModule();
  mod.ctx.window.portalAlert = function (msg) { mod.alerts.push(msg); };

  fireError(mod);
  fireError(mod);
  fireError(mod);

  assert.equal(readLog(mod).length, 3, "las 3 ocurrencias deben quedar registradas");
  assert.equal(mod.alerts.length, 1, "solo la primera debe generar un aviso visual");
});

test("freno de emergencia: deja de avisar tras una rafaga, pero sigue registrando cada ocurrencia", () => {
  const mod = loadModule();
  mod.ctx.window.portalAlert = function (msg) { mod.alerts.push(msg); };

  for (let i = 0; i < 12; i++) {
    fireError(mod, { message: "Error distinto " + i });
  }

  assert.equal(readLog(mod).length, 12, "el registro tecnico no debe frenarse nunca");
  assert.ok(mod.alerts.length <= 8, "el freno de emergencia debe limitar los avisos visuales (BURST_LIMIT)");
  assert.ok(mod.alerts.length > 0, "debe haber avisado al menos las primeras veces antes de frenar");
});

test("ignora ruido conocido: Script error. sin detalle, ResizeObserver y errores de extensiones", () => {
  const mod = loadModule();
  mod.ctx.window.portalAlert = function (msg) { mod.alerts.push(msg); };

  fireError(mod, { message: "Script error.", filename: "", error: undefined });
  fireError(mod, { message: "ResizeObserver loop limit exceeded", filename: "js/script.js" });
  fireError(mod, { message: "cualquier cosa", filename: "chrome-extension://abcdefg/content.js" });

  assert.equal(readLog(mod).length, 0, "ninguno de estos casos deberia registrarse");
  assert.equal(mod.alerts.length, 0);
  assert.equal(mod.consoleErrors.length, 0);
});

test("unhandledrejection con un Error real conserva mensaje y stack", () => {
  const mod = loadModule();
  // El Error debe construirse DENTRO del contexto vm: un Error del realm de
  // Node no pasa "instanceof Error" contra el Error propio del contexto (cada
  // vm.createContext trae sus propios intrinsics), igual que en un navegador
  // real el reason siempre pertenece al mismo realm que la pagina.
  const reason = vm.runInContext('new Error("promesa rota")', mod.ctx);
  fireRejection(mod, reason);

  const log = readLog(mod);
  assert.equal(log.length, 1);
  assert.equal(log[0].kind, "rejection");
  assert.equal(log[0].message, "promesa rota");
  assert.ok(log[0].stack.length > 0);
});

test("unhandledrejection con una razon que no es Error (string) no revienta el manejador", () => {
  const mod = loadModule();
  assert.doesNotThrow(() => fireRejection(mod, "solo un texto"));

  const log = readLog(mod);
  assert.equal(log.length, 1);
  assert.equal(log[0].message, "solo un texto");
});

test("el log nunca crece mas alla de MAX_ENTRIES (25): descarta las entradas mas viejas", () => {
  const mod = loadModule();
  for (let i = 0; i < 30; i++) {
    fireError(mod, { message: "e" + i });
  }
  const log = readLog(mod);
  assert.equal(log.length, 25);
  assert.equal(log[0].message, "e5", "debe haber descartado las 5 mas antiguas (0..4)");
  assert.equal(log[log.length - 1].message, "e29");
});

test("no propaga una excepcion aunque localStorage.setItem falle (QuotaExceededError simulado)", () => {
  const mod = loadModule();
  mod.ctx.window.localStorage.setItem = function () {
    throw new Error("QuotaExceededError simulado");
  };
  assert.doesNotThrow(() => fireError(mod));
  assert.equal(mod.consoleErrors.length, 1, "la consola debe seguir registrando aunque falle el guardado local");
});

test("instalar el script dos veces en la misma pagina no duplica los listeners (guard de instalacion)", () => {
  const mod = loadModule();
  const firstCount = mod.listeners.error.length;
  vm.runInContext(SOURCE, mod.ctx);
  assert.equal(mod.listeners.error.length, firstCount, "el segundo require no debe volver a registrar listeners");
});

test("window.senaErrorLog.getAll/clear permiten inspeccionar y limpiar el registro manualmente", () => {
  const mod = loadModule();
  fireError(mod);
  assert.equal(mod.ctx.window.senaErrorLog.getAll().length, 1);
  mod.ctx.window.senaErrorLog.clear();
  assert.equal(mod.ctx.window.senaErrorLog.getAll().length, 0);
});
