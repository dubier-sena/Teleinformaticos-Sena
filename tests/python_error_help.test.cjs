"use strict";

// Prueba del explicador de errores del laboratorio de Python (la "ayuda" al
// aprendiz): dado el mensaje crudo del worker, explainPythonError devuelve
// { title, fix, example, line } con que paso, como arreglarlo y un ejemplo.
// Carga python_online_lab.js en un sandbox vm con window/document falsos.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadLab() {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "python_online_lab.js"),
    "utf8"
  );
  const sandbox = {
    window: {},
    document: {
      readyState: "complete",
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() { return 0; },
    clearTimeout() {},
    console: { warn() {}, error() {}, info() {}, log() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.PythonOnlineLab;
}

const lab = loadLab();
const explain = lab && lab.explainPythonError;

test("el modulo expone explainPythonError", () => {
  assert.strictEqual(typeof explain, "function");
});

test("variable no definida -> NameError con la variable y pista de crear/mayusculas", () => {
  const h = explain("NameError: la variable 'nombre' no esta definida.");
  assert.match(h.title, /nombre/);
  assert.match(h.fix.toLowerCase(), /antes de usarla|mayuscul/);
  assert.ok(h.example.length > 0);
});

test("int() no convierte -> pista de digitos", () => {
  const h = explain("int() no pudo convertir: dieciseis");
  assert.match(h.title.toLowerCase(), /entero/);
  assert.match(h.fix.toLowerCase(), /digitos/);
});

test("sumar texto con numeros -> usar str()", () => {
  const h = explain('No puedes sumar texto con numeros. Usa str(): "texto " + str(numero)');
  assert.match(h.example, /str\(/);
});

test("division entre cero", () => {
  const h = explain("ZeroDivisionError: division entre cero.");
  assert.match(h.title.toLowerCase(), /cero/);
});

test("indentacion incluye el numero de linea", () => {
  const h = explain("Linea 4: usa indentacion de 4 espacios.");
  assert.strictEqual(h.line, 4);
  assert.match(h.fix.toLowerCase(), /4 espacios/);
});

test("dos puntos faltante en condicional", () => {
  const h = explain("Linea 2: las condicionales terminan con dos puntos (:).");
  assert.match(h.title.toLowerCase(), /dos puntos/);
  assert.strictEqual(h.line, 2);
});

test("timeout / ciclo infinito", () => {
  const h = explain("El codigo tardo demasiado en ejecutarse. Revisa si tienes un ciclo infinito.");
  assert.match(h.title.toLowerCase(), /no termino|infinito/);
});

test("bloqueo por seguridad", () => {
  const h = explain("Uso de os/os.system bloqueado por seguridad.");
  assert.match(h.title.toLowerCase(), /seguridad/);
});

test("siempre devuelve ayuda aunque el error sea desconocido (fallback)", () => {
  const h = explain("algo raro inesperado xyz");
  assert.ok(h && h.title && h.fix);
});
