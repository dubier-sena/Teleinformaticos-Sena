"use strict";

// Prueba de la revision EN VIVO de estructura (liveStructuralIssues): mientras el
// aprendiz escribe, detecta errores de estructura para subrayar la linea. NO debe
// inventar errores de logica/ejecucion (eso es solo al Ejecutar).

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
const check = lab && lab.liveStructuralIssues;
// liveStructuralIssues corre dentro del sandbox vm: sus arrays tienen otro
// Array.prototype, asi que se copian con Array.from antes de comparar.
function lines(code) { return Array.from(check(code).lines); }

test("el modulo expone liveStructuralIssues", () => {
  assert.strictEqual(typeof check, "function");
});

test("falta el dos puntos en if/for/while -> subraya esa linea", () => {
  assert.deepStrictEqual(lines("if edad >= 18"), [1]);
  assert.deepStrictEqual(lines("for i in range(3)"), [1]);
  assert.deepStrictEqual(lines("while activo"), [1]);
  assert.match(check("if edad >= 18").note.toLowerCase(), /dos puntos/);
});

test("con los dos puntos NO subraya", () => {
  assert.deepStrictEqual(lines("if edad >= 18:"), []);
  assert.deepStrictEqual(lines("if edad >= 18:\n    print(edad)"), []);
});

test("indentacion que no es de 4 en 4 -> subraya", () => {
  assert.deepStrictEqual(lines("if x:\n  print(x)"), [2]);
  assert.match(check("if x:\n  print(x)").note.toLowerCase(), /indentacion/);
});

test("tabulaciones -> subraya y lo avisa", () => {
  const r = check("if x:\n\tprint(x)");
  assert.ok(Array.from(r.lines).indexOf(2) >= 0);
  assert.match(r.note.toLowerCase(), /tabulaciones/);
});

test("parentesis sin cerrar -> nota (sin linea precisa)", () => {
  const r = check('print("hola"');
  assert.strictEqual(Array.from(r.lines).length, 0);
  assert.match(r.note, /sin cerrar/);
});

test("codigo correcto -> sin errores ni nota", () => {
  const r = check('nombre = "Ana"\nfor i in range(3):\n    print(nombre, i)');
  assert.deepStrictEqual(Array.from(r.lines), []);
  assert.strictEqual(r.note, "");
});

test("una variable que empieza como un comando no se confunde", () => {
  // 'forma' empieza con 'for' pero no es el comando for -> no exige dos puntos.
  assert.deepStrictEqual(lines("forma = 4"), []);
});

test("no inventa errores de ejecucion (variable no definida es solo al correr)", () => {
  // Usar una variable no creada es valido de ESTRUCTURA; el error real surge al Ejecutar.
  assert.deepStrictEqual(lines("print(desconocida)"), []);
});

test("las lineas de comentario no se subrayan", () => {
  assert.deepStrictEqual(lines("# for i in range"), []);
});
