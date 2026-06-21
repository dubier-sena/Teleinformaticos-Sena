"use strict";

// Prueba del resaltado por colores del editor del laboratorio de Python:
// comandos (keyword), funciones (builtin), VARIABLES, texto, numeros y comentarios
// deben recibir clases distintas para diferenciarse con color.

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
const highlight = lab && lab.highlightPythonCode;

test("el modulo expone highlightPythonCode", () => {
  assert.strictEqual(typeof highlight, "function");
});

test("las VARIABLES reciben su propia clase de color", () => {
  const html = highlight('nombre = "Laura"');
  assert.match(html, /pytok-variable">nombre</);
  assert.match(html, /pytok-string">&quot;Laura&quot;</);
});

test("comandos de control, funciones, numeros y variables se diferencian", () => {
  const html = highlight("for i in range(3):\n    print(nombre)");
  assert.match(html, /pytok-keyword">for</);   // comando de control
  assert.match(html, /pytok-builtin">range</); // funcion
  assert.match(html, /pytok-builtin">print</); // funcion
  assert.match(html, /pytok-number">3</);      // dato numerico
  assert.match(html, /pytok-variable">i</);    // variable del ciclo
  assert.match(html, /pytok-variable">nombre</);
});

test("los comentarios reciben su clase", () => {
  const html = highlight("edad = 16  # mi edad");
  assert.match(html, /pytok-comment"># mi edad</);
  assert.match(html, /pytok-variable">edad</);
  assert.match(html, /pytok-number">16</);
});

test("no confunde una variable con un comando del mismo prefijo", () => {
  // 'forma' empieza con 'for' pero es una variable, no el comando for.
  const html = highlight("forma = 4");
  assert.match(html, /pytok-variable">forma</);
  assert.doesNotMatch(html, /pytok-keyword">for</);
});
