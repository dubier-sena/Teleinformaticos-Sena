const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// Carga script_guia2.js (archivo grande, no modular, pensado para <script src>)
// en un sandbox con mocks minimos de window/document/localStorage, solo lo
// suficiente para que el codigo de nivel superior (loadState() al final del
// archivo) no reviente. No se dispara initGuia2 ni se simula el DOM completo:
// solo se llaman directamente las funciones puras getWordSearchDisplayState /
// getMatchingGameDisplayState, que es lo que decide si el juego se muestra
// "resuelto" o invitando a jugar.
function makeEl() {
  const el = {
    dataset: {},
    style: { setProperty() {} },
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    appendChild(child) { return child; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html || ""; }, set(v) { el._html = v; } });
  Object.defineProperty(el, "textContent", { get() { return el._text || ""; }, set(v) { el._text = v; } });
  return el;
}

function loadScriptGuia2() {
  const localStorageStub = {
    _data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };
  const documentStub = {
    addEventListener() {},
    removeEventListener() {},
    getElementById: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    createElementNS: () => makeEl(),
    documentElement: makeEl(),
    body: makeEl(),
    visibilityState: "visible",
  };
  const ctx = {
    console,
    localStorage: localStorageStub,
    document: documentStub,
    navigator: { userAgent: "node" },
    URL,
    Date,
    Math,
    JSON,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
  };
  ctx.window = ctx;
  ctx.window.location = { href: "https://x/guia.html", pathname: "/guia.html", search: "" };
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "prueba.aprendiz", user: { usernameKey: "prueba.aprendiz", fullName: "Aprendiz De Prueba" } }),
    getStudentStorageKey: (usernameKey, key, opts) => `sena_portal:student:${usernameKey}:${(opts && opts.area) || "app"}:${key}`,
    getScopedStorageKey: (key, opts) => `sena_portal:student:prueba.aprendiz:${(opts && opts.area) || "app"}:${key}`,
    requireFileAccess: () => true,
  };
  ctx.window._firebaseDb = {};
  ctx.window.matchMedia = () => ({ matches: false });
  ctx.window.innerWidth = 1200;
  ctx.window.addEventListener = () => {};
  ctx.window.__RUNTIME_PAGE_FILE__ = "grupo-10a-guia-02-herramientas-informaticas-digitales.html";

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8"), ctx, { filename: "script_guia2.js" });
  return ctx;
}

test("Guia 2: sopa de letras calificada sin jugar se exhibe totalmente resuelta, sin tocar el estado real", () => {
  const ctx = loadScriptGuia2();
  const result = vm.runInContext(`
    (function () {
      state["sopaletras311-locked"] = true;
      const raw = getWordSearchState();
      const display = getWordSearchDisplayState(raw);
      const puzzle = getWordSearchPuzzle(display.variant);
      return {
        rawStartedAt: raw.startedAt,
        rawFoundCount: raw.found.length,
        displayStartedAt: display.startedAt,
        displayFoundCount: display.found.length,
        totalWords: puzzle.targets.length,
        displayScore: display.score,
        displayMistakes: display.mistakes,
      };
    })()
  `, ctx);

  assert.equal(result.rawFoundCount, 0, "el estado REAL guardado no debe tener palabras encontradas -- nunca se persiste nada sintetico");
  assert.equal(result.rawStartedAt, "", "el estado REAL no debe marcar la partida como iniciada");
  assert.ok(result.totalWords > 0, "el rompecabezas debe tener palabras objetivo");
  assert.equal(result.displayFoundCount, result.totalWords, "la EXHIBICION debe mostrar todas las palabras encontradas");
  assert.equal(result.displayStartedAt, "graded", "la EXHIBICION debe marcarse como resuelta");
  assert.equal(result.displayMistakes, 0, "la EXHIBICION no debe mostrar errores");
  assert.equal(result.displayScore, 10000, "la EXHIBICION debe mostrar el puntaje maximo");
});

test("Guia 2: Relaciona calificada sin jugar se exhibe con todas las parejas relacionadas, sin tocar el estado real", () => {
  const ctx = loadScriptGuia2();
  const result = vm.runInContext(`
    (function () {
      state["relaciona311-locked"] = true;
      const raw = getMatchingGameState();
      const display = getMatchingGameDisplayState(raw);
      return {
        rawStartedAt: raw.startedAt,
        rawCorrectCount: raw.correctCount,
        displayStartedAt: display.startedAt,
        displayCorrectCount: display.correctCount,
        displayTotalPairs: display.totalPairs,
        displayScore: display.score,
      };
    })()
  `, ctx);

  assert.equal(result.rawCorrectCount, 0, "el estado REAL guardado no debe tener parejas correctas -- nunca se persiste nada sintetico");
  assert.equal(result.rawStartedAt, "", "el estado REAL no debe marcar la partida como iniciada");
  assert.ok(result.displayTotalPairs > 0, "el juego debe tener parejas");
  assert.equal(result.displayCorrectCount, result.displayTotalPairs, "la EXHIBICION debe mostrar todas las parejas relacionadas");
  assert.equal(result.displayStartedAt, "graded", "la EXHIBICION debe marcarse como resuelta");
  assert.equal(result.displayScore, 10000, "la EXHIBICION debe mostrar el puntaje maximo");
});

test("Guia 2: si el aprendiz ya tiene progreso real en la sopa de letras, la calificacion NO lo sobreescribe", () => {
  const ctx = loadScriptGuia2();
  const result = vm.runInContext(`
    (function () {
      state["sopaletras311-locked"] = true;
      state["wordSearch:guia2-sopa"] = {
        startedAt: "2026-07-09T10:00:00.000Z",
        found: [],
        foundLabels: [],
        variant: 1,
        mistakes: 1,
      };
      const raw = getWordSearchState();
      const display = getWordSearchDisplayState(raw);
      return { sameObject: display === raw, rawStartedAt: raw.startedAt };
    })()
  `, ctx);

  assert.equal(result.rawStartedAt, "2026-07-09T10:00:00.000Z", "el progreso real del aprendiz debe leerse tal cual");
  assert.equal(result.sameObject, true, "con progreso real, la funcion de exhibicion debe devolver el estado SIN modificar (no reemplaza una partida real)");
});

test("Guia 2: sin calificar, la sopa de letras y Relaciona no se alteran (siguen invitando a jugar)", () => {
  const ctx = loadScriptGuia2();
  const result = vm.runInContext(`
    (function () {
      const rawWord = getWordSearchState();
      const rawMatch = getMatchingGameState();
      return {
        wordSame: getWordSearchDisplayState(rawWord) === rawWord,
        matchSame: getMatchingGameDisplayState(rawMatch) === rawMatch,
      };
    })()
  `, ctx);

  assert.equal(result.wordSame, true, "sin nota, la sopa de letras no debe alterarse");
  assert.equal(result.matchSame, true, "sin nota, Relaciona no debe alterarse");
});
