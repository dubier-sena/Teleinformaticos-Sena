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
    getCurrentSelection: (defaults) => defaults || {},
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

// Simula el DOM REAL (escaso) de grupo-10a-guia-02-actividad-322-matriz.html:
// a diferencia de loadScriptGuia2() (que devuelve un elemento falso para
// CUALQUIER id/selector, ocultando bugs de "acceso a propiedad de null"),
// aqui getElementById/querySelector devuelven null salvo los pocos ids que
// EXISTEN de verdad en esa pagina. Sirve para detectar si initGuia2() revienta
// a medio camino cuando corre fuera de la guia principal -- si revienta ANTES
// de reflectGradesForGuia2() (la ultima linea de initGuia2), el bloqueo por
// calificacion nunca se aplica, aunque autoRenderForFile (mecanismo aparte, en
// el <script> propio de la pagina) si funcione.
function loadScriptGuia2OnMatrixPage() {
  const knownIds = new Set([
    "btn-entregar-matriz", "btn-guardar", "drive-link-panel",
    "field-322-finalizada", "field-322-finalizada-at",
    "matriz322GradeMount", "save-status",
  ]);
  const elementsById = new Map();
  function getOrCreateEl(id) {
    if (!elementsById.has(id)) elementsById.set(id, makeEl());
    return elementsById.get(id);
  }
  const localStorageStub = {
    _data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };
  const documentStub = {
    addEventListener() {},
    removeEventListener() {},
    getElementById: (id) => (knownIds.has(id) ? getOrCreateEl(id) : null),
    querySelector: () => null,
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
    setTimeout, clearTimeout,
    // setInterval real dejaria un timer colgado (initializeCloudStateSync arma
    // un poll periodico que nunca se limpia) y el proceso de node --test nunca
    // terminaria de esperar. No-op: alcanza para esta prueba diagnostica.
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  ctx.window = ctx;
  ctx.window.location = { href: "https://x/pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html", pathname: "/pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html", search: "" };
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "prueba.aprendiz", user: { usernameKey: "prueba.aprendiz", fullName: "Aprendiz De Prueba" } }),
    getStudentStorageKey: (usernameKey, key, opts) => `sena_portal:student:${usernameKey}:${(opts && opts.area) || "app"}:${key}`,
    getScopedStorageKey: (key, opts) => `sena_portal:student:prueba.aprendiz:${(opts && opts.area) || "app"}:${key}`,
    requireFileAccess: () => true,
    getCurrentSelection: (defaults) => defaults || {},
  };
  ctx.window._firebaseDb = {};
  ctx.window.matchMedia = () => ({ matches: false });
  ctx.window.innerWidth = 1200;
  ctx.window.addEventListener = () => {};
  ctx.window.__RUNTIME_PAGE_FILE__ = "grupo-10a-guia-02-actividad-322-matriz.html";

  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8"), ctx, { filename: "script_guia2.js" });
  return ctx;
}

test("Guia 2: initGuia2 no debe reventar al correr en la pagina de la Matriz (DOM real, sin la mayoria de elementos de la guia principal)", () => {
  const ctx = loadScriptGuia2OnMatrixPage();
  let thrown = null;
  try {
    vm.runInContext("window.initGuia2()", ctx);
  } catch (e) {
    thrown = e;
  }
  assert.equal(
    thrown,
    null,
    "si initGuia2() revienta a medio camino, reflectGradesForGuia2() (su ULTIMA linea) nunca corre, y el bloqueo por calificacion del instructor nunca se aplica en esta pagina" +
      (thrown ? `\nError real: ${thrown.stack}` : "")
  );
});

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

test("Guia 2: applyMatriz322GradeLock no revienta cuando window.lockMatriz no existe (pagina principal de la guia)", () => {
  const ctx = loadScriptGuia2();
  assert.doesNotThrow(() => {
    vm.runInContext("applyMatriz322GradeLock()", ctx);
  });
});

test("Guia 2: applyMatriz322GradeLock llama a window.lockMatriz con un mensaje propio (pagina de la matriz)", () => {
  const ctx = loadScriptGuia2();
  const calls = [];
  ctx.window.lockMatriz = (finalizedAt, reasonText) => { calls.push({ finalizedAt, reasonText }); };
  vm.runInContext("applyMatriz322GradeLock()", ctx);

  assert.equal(calls.length, 1, "debe llamar a lockMatriz exactamente una vez");
  assert.match(calls[0].reasonText, /calificada por el instructor/, "el mensaje debe explicar que fue el instructor quien la califico, no una auto-entrega");
});

test("Guia 2: calificar matriz322 dispara lockMatriz en la pagina de la matriz (integracion con reflectGradesIntoGuideState)", async () => {
  // reflectGradesForGuia2() no espera su promesa interna (fire-and-forget, ver
  // js/script_guia2.js), asi que aqui se invoca reflectGradesIntoGuideState
  // directamente -- con las MISMAS opciones que arma reflectGradesForGuia2 --
  // para poder esperar (await) el resultado real en la prueba.
  const ctx = loadScriptGuia2();
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx, { filename: "activity_grades.js" });
  const calls = [];
  ctx.window.lockMatriz = (finalizedAt, reasonText) => { calls.push({ finalizedAt, reasonText }); };
  ctx.window.portalAuth.getCurrentSession = () => ({ role: "student", usernameKey: "prueba.aprendiz", user: { usernameKey: "prueba.aprendiz" } });
  ctx.window._firebaseDb.cloudGetGrades = async () => ({
    "guia-02-herramientas": { matriz322: "A", "matriz322:gradedAt": "2026-07-09T00:00:00.000Z" },
  });
  ctx.window.ActivityStandard = {
    getConfigForGuide: () => ({ activities: [{ id: "matriz322", type: "form" }, { id: "fichaCaso", type: "form" }] }),
  };

  await vm.runInContext(`
    window.activityGradesManager.reflectGradesIntoGuideState({
      guideFamily: "guia-02-herramientas",
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      lockAppliers: { matriz322: applyMatriz322GradeLock },
    })
  `, ctx);

  assert.equal(calls.length, 1, "calificar matriz322 debe bloquear la pagina de la matriz");
});

// Carga SOLO el <script> propio de la pagina de la Matriz (no script_guia2.js)
// en un sandbox minimo, para probar applyMatrizDeadlineLock()/isMatrizGradeLocked()
// tal como existen en el archivo real -- reproduce el bug reportado: esa
// pagina reaplica isLocked varias veces (al cargar, 1.5s despues, al
// sincronizar con la nube) usando SOLO el campo de auto-envio del aprendiz:
// sin isMatrizGradeLocked(), cada repeticion reactivaba los campos aunque el
// instructor ya hubiera calificado (quedaban grises por lockMatriz() pero
// editables, porque applyAvailability solo toca disabled/opacity/pointer-events).
function loadMatrizPageInlineScript() {
  const html = fs.readFileSync(
    path.join(root, "pages", "auxiliares", "grupo-10a-guia-02-actividad-322-matriz.html"),
    "utf8"
  );
  const scriptMatch = html.match(/<script>\n\/\* ── Descarga plantilla[\s\S]*?<\/script>/);
  assert.ok(scriptMatch, "no se encontro el <script> principal de la pagina de la Matriz -- ¿cambio la estructura del archivo?");
  const code = scriptMatch[0].replace(/^<script>/, "").replace(/<\/script>$/, "");

  const ctx = {
    console,
    state: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      addEventListener() {},
    },
    window: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Date,
  };
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "matriz-322-inline.js" });
  return ctx;
}

test("Guia 2 Matriz: applyMatrizDeadlineLock NO reactiva los campos si la actividad ya fue calificada", () => {
  const ctx = loadMatrizPageInlineScript();
  const availabilityCalls = [];
  ctx.window.activityDeadlineManager = {
    applyAvailability: (config) => { availabilityCalls.push(config.isLocked); },
  };

  // Sin nota: no deberia bloquear (comportamiento normal, sin cambios).
  vm.runInContext("applyMatrizDeadlineLock()", ctx);
  assert.equal(availabilityCalls[0], false, "sin calificar y sin auto-envio, no debe bloquear");

  // El instructor califica -> reflectGradesForGuia2 (en script_guia2.js) pone
  // esta bandera en el estado compartido de la guia.
  vm.runInContext('state["matriz322-locked"] = true;', ctx);

  // applyMatrizDeadlineLock se vuelve a llamar mas tarde (1.5s despues, o al
  // sincronizar con la nube) -- ANTES del fix, esto pasaba isLocked:false
  // (solo miraba el auto-envio) y reactivaba los campos.
  vm.runInContext("applyMatrizDeadlineLock()", ctx);
  assert.equal(availabilityCalls[1], true, "calificada por el instructor, las repeticiones NO deben reactivar los campos");
});

test("Guia 2: applyDiagnostico323GradeLock no revienta cuando window.applyLock no existe (pagina principal de la guia)", () => {
  const ctx = loadScriptGuia2();
  assert.doesNotThrow(() => {
    vm.runInContext("applyDiagnostico323GradeLock()", ctx);
  });
});

test("Guia 2: applyDiagnostico323GradeLock llama a window.applyLock (pagina del Formulario de la Actividad 4)", () => {
  const ctx = loadScriptGuia2();
  const calls = [];
  ctx.window.applyLock = (fechaGuardado) => { calls.push(fechaGuardado); };
  vm.runInContext("applyDiagnostico323GradeLock()", ctx);

  assert.equal(calls.length, 1, "debe llamar a applyLock exactamente una vez");
});

test("Guia 2: calificar diagnostico323 dispara applyLock en la pagina del Formulario de la Actividad 4", async () => {
  const ctx = loadScriptGuia2();
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx, { filename: "activity_grades.js" });
  const calls = [];
  ctx.window.applyLock = (fechaGuardado) => { calls.push(fechaGuardado); };
  ctx.window.portalAuth.getCurrentSession = () => ({ role: "student", usernameKey: "prueba.aprendiz", user: { usernameKey: "prueba.aprendiz" } });
  ctx.window._firebaseDb.cloudGetGrades = async () => ({
    "guia-02-herramientas": { diagnostico323: "A", "diagnostico323:gradedAt": "2026-07-09T00:00:00.000Z" },
  });
  ctx.window.ActivityStandard = {
    getConfigForGuide: () => ({ activities: [{ id: "diagnostico323", type: "form" }] }),
  };

  await vm.runInContext(`
    window.activityGradesManager.reflectGradesIntoGuideState({
      guideFamily: "guia-02-herramientas",
      pageFile: PAGE_FILE,
      getState: function () { return state; },
      lockAppliers: { diagnostico323: applyDiagnostico323GradeLock },
    })
  `, ctx);

  assert.equal(calls.length, 1, "calificar diagnostico323 debe bloquear la pagina del Formulario de la Actividad 4");
});

// A diferencia de la Matriz y el Formulario de la Actividad 4, la pagina de
// Ficha de caso NO carga script_guia2.js (tiene su propio almacenamiento en
// localStorage/Firestore) -- por eso su bloqueo por calificacion no puede
// pasar por reflectGradesForGuia2. Se prueba directamente contra el <script>
// real de la pagina.
// applyLock() y checkInstructorGradeLock() son funciones LOCALES al IIFE de
// la pagina (no se exponen en window, a proposito -- solo revelarFicha/
// exportarWord/guardarRespuestas lo estan, porque son las que usan los
// onclick del HTML). Para poder invocar checkInstructorGradeLock() desde la
// prueba, se inserta una exposicion extra SOLO en esta copia de prueba (no
// se toca el archivo real) justo antes del cierre del IIFE.
function loadFichaCasoInlineScript() {
  const html = fs.readFileSync(
    path.join(root, "pages", "auxiliares", "grupo-10a-guia-02-ficha-caso.html"),
    "utf8"
  );
  const scriptMatch = html.match(/<script>\n\(function \(\) \{[\s\S]*?\n\}\)\(\);\n<\/script>/);
  assert.ok(scriptMatch, "no se encontro el <script> principal de la pagina de Ficha de caso -- ¿cambio la estructura del archivo?");
  let code = scriptMatch[0].replace(/^<script>/, "").replace(/<\/script>$/, "");
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE para exponer checkInstructorGradeLock en la prueba");
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.checkInstructorGradeLock = checkInstructorGradeLock;\n})();");

  const elementsById = new Map();
  function getOrCreateEl(id) {
    if (!elementsById.has(id)) elementsById.set(id, makeEl());
    return elementsById.get(id);
  }

  const ctx = {
    console,
    document: {
      getElementById: (id) => getOrCreateEl(id),
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => makeEl(),
    },
    window: {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    Date,
    URL,
  };
  ctx.window.addEventListener = () => {};
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "ficha-caso-inline.js" });
  ctx.__submitBtn = getOrCreateEl("ficha-submit-btn");
  return ctx;
}

test("Ficha de caso: checkInstructorGradeLock no revienta sin sesion ni activityGradesManager", () => {
  const ctx = loadFichaCasoInlineScript();
  assert.doesNotThrow(() => {
    ctx.window.checkInstructorGradeLock();
  });
});

test("Ficha de caso: checkInstructorGradeLock bloquea de inmediato si la nota ya esta en el cache local", () => {
  const ctx = loadFichaCasoInlineScript();
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "prueba.aprendiz" }),
  };
  ctx.window.activityGradesManager = {
    getStudentGrades: () => ({ matriz322: "A" }),
  };
  ctx.window._firebaseDb = { cloudGetGrades: () => new Promise(() => {}) }; // nunca resuelve

  ctx.window.checkInstructorGradeLock();

  assert.equal(ctx.__submitBtn.disabled, true, "debe bloquear (boton deshabilitado) desde el cache local, sin esperar la red");
});

test("Ficha de caso: checkInstructorGradeLock confirma con la nube si no esta en el cache local", async () => {
  const ctx = loadFichaCasoInlineScript();
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "prueba.aprendiz" }),
  };
  ctx.window.activityGradesManager = {
    getStudentGrades: () => ({}), // nada en cache todavia
  };
  ctx.window._firebaseDb = {
    cloudGetGrades: async () => ({ "guia-02-herramientas": { matriz322: "D" } }),
  };

  await ctx.window.checkInstructorGradeLock();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(ctx.__submitBtn.disabled, true, "debe bloquear tras confirmar con la nube que ya fue calificada (D)");
});

test("Ficha de caso: checkInstructorGradeLock NO bloquea si no hay nota (ni en cache ni en la nube)", async () => {
  const ctx = loadFichaCasoInlineScript();
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: "prueba.aprendiz" }),
  };
  ctx.window.activityGradesManager = {
    getStudentGrades: () => ({}),
  };
  ctx.window._firebaseDb = {
    cloudGetGrades: async () => ({}),
  };

  await ctx.window.checkInstructorGradeLock();
  await Promise.resolve();
  await Promise.resolve();

  assert.notEqual(ctx.__submitBtn.disabled, true, "sin calificar, no debe bloquear la ficha");
});
