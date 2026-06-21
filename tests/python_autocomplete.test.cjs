"use strict";

// Prueba del motor de autocompletado contextual del laboratorio de Python:
// detecta las variables del aprendiz y sugiere (por prefijo) sus variables,
// funciones soportadas y palabras clave. Es estatico/contextual, no IA.

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
const comp = lab && lab.getCompletions;
const vars = lab && lab.collectUserVariables;
// Arrays creados dentro del sandbox vm: copiar con Array.from antes de comparar.
function list(code, prefix) { return Array.from(comp(code, prefix)); }

test("el modulo expone getCompletions y collectUserVariables", () => {
  assert.strictEqual(typeof comp, "function");
  assert.strictEqual(typeof vars, "function");
});

test("detecta las variables que el aprendiz creo (asignacion y for)", () => {
  const found = Array.from(vars('nombre = "Ana"\nedad = 16\nfor i in range(3):\n    print(i)'));
  assert.deepStrictEqual(found, ["nombre", "edad", "i"]);
});

test("no confunde la comparacion == con una asignacion", () => {
  assert.deepStrictEqual(Array.from(vars("if edad == 18:\n    print(1)")), []);
});

test("sugiere la variable del aprendiz por su prefijo", () => {
  assert.ok(list('nombre = "Ana"', "nom").indexOf("nombre") >= 0);
});

test("sugiere funciones y palabras clave del lenguaje", () => {
  assert.ok(list("", "pri").indexOf("print") >= 0);
  assert.ok(list("", "ra").indexOf("range") >= 0);
  assert.ok(list("", "wh").indexOf("while") >= 0);
});

test("las variables del aprendiz aparecen primero (mas relevantes)", () => {
  // 'intento' (variable) debe ir antes que input/int/in.
  assert.strictEqual(list("intento = 5", "in")[0], "intento");
});

test("prefijo vacio o que no inicia identificador no sugiere nada", () => {
  assert.deepStrictEqual(list("x = 1", ""), []);
  assert.deepStrictEqual(list("x = 1", "3"), []);
});

test("no sugiere la palabra que ya esta escrita completa", () => {
  assert.ok(list("", "print").indexOf("print") < 0);
});

test("limita la cantidad de sugerencias", () => {
  assert.ok(list("", "i").length <= 8);
});
