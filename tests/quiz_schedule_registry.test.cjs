"use strict";
// Consistencia del registro de js/quiz_schedule.js contra los quizzes reales.
// Un typo en cloudFile/storageKey/ficha/quizUrl romperia un gate en silencio.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(ROOT, "js", "quiz_schedule.js"), "utf8");

// Cargar el IIFE con shims minimos (boot() corre pero sin guia coincidente
// queda inerte: setTimeout es no-op).
const win = {
  location: { pathname: "/test" },
  __RUNTIME_PAGE_FILE__: "",
  setTimeout: function () { return 0; },
  MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
  alert: function () {},
  sessionStorage: { getItem: function () { return null; }, setItem: function () {} },
};
const doc = {
  readyState: "complete",
  addEventListener: function () {},
  body: null,
  querySelectorAll: function () { return []; },
  getElementById: function () { return null; },
  createElement: function () { return { setAttribute: function () {}, appendChild: function () {} }; },
};
const ls = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
const QS = new Function("window", "document", "localStorage", code + "\nreturn window.QuizSchedule;")(win, doc, ls);
const REGISTRY = QS && QS.REGISTRY;

// Default del motor cuando el quiz no declara data-quiz-storage-key.
const DEFAULT_STORAGE_KEY = "quiz-redes-321h";

function attr(html, name) {
  const m = html.match(new RegExp(name + '="([^"]*)"'));
  return m ? m[1] : null;
}

test("REGISTRY existe y tiene entradas", () => {
  assert.ok(Array.isArray(REGISTRY) && REGISTRY.length > 0, "REGISTRY debe ser un arreglo no vacio");
});

test("cada entrada tiene los campos requeridos y guideFile en minusculas", () => {
  for (const e of REGISTRY) {
    for (const k of ["guideFile", "cloudFile", "quizUrl", "storageKey", "ficha"]) {
      assert.ok(e[k] && String(e[k]).length, "falta " + k + " en " + JSON.stringify(e));
    }
    assert.strictEqual(e.guideFile, e.guideFile.toLowerCase(), "guideFile debe ir en minusculas: " + e.guideFile);
  }
});

test("no hay (guideFile, storageKey) duplicados", () => {
  const seen = new Set();
  for (const e of REGISTRY) {
    const key = e.guideFile + "::" + e.storageKey;
    assert.ok(!seen.has(key), "entrada duplicada: " + key);
    seen.add(key);
  }
});

test("el archivo del quiz (quizUrl) existe", () => {
  for (const e of REGISTRY) {
    assert.ok(fs.existsSync(path.join(ROOT, e.quizUrl)), "no existe el quiz: " + e.quizUrl);
  }
});

test("cloudFile/storageKey/ficha coinciden con los data-quiz-* del quiz", () => {
  for (const e of REGISTRY) {
    const html = fs.readFileSync(path.join(ROOT, e.quizUrl), "utf8");
    const cloud = attr(html, "data-quiz-cloud-file");
    const ficha = attr(html, "data-quiz-ficha");
    const sk = attr(html, "data-quiz-storage-key");
    assert.strictEqual(cloud, e.cloudFile, e.quizUrl + ": cloud-file " + cloud + " != registro " + e.cloudFile);
    assert.strictEqual(ficha, e.ficha, e.quizUrl + ": ficha " + ficha + " != registro " + e.ficha);
    const expectedSk = sk == null ? DEFAULT_STORAGE_KEY : sk;
    assert.strictEqual(expectedSk, e.storageKey, e.quizUrl + ": storage-key " + expectedSk + " != registro " + e.storageKey);
  }
});

test("cloudFile del quiz 3.2.1 es el de la guia (no uno aparte) para detectar 'finalizado'", () => {
  const e321 = REGISTRY.find((x) => x.storageKey === "quiz-guia3-321");
  assert.ok(e321, "debe existir la entrada del quiz 3.2.1");
  assert.strictEqual(e321.cloudFile, "10b_guia3.html", "el 3.2.1 debe compartir el cloud-file de la guia 10b_guia3");
});
