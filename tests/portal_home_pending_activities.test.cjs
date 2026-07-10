const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

const USERNAME_KEY = "prueba.aprendiz";
const GUIDE2_FILE = "grupo-10a-guia-02-herramientas-informaticas-digitales.html";

// getStudentStorageKey sigue el patron documentado en CLAUDE.md:
// "sena_portal:student:{usernameKey}:{area}:{key}". Se usa la MISMA funcion
// para escribir el estado falso de la prueba y para lo que portal_home.js
// termina llamando (via window.portalAuth), asi ambos lados quedan
// consistentes sin tener que cargar portal_auth.js completo (archivo grande,
// pensado para <script src>, no para importarse en pruebas).
function getStudentStorageKey(usernameKey, key, options) {
  const area = (options && options.area) || "app";
  return `sena_portal:student:${usernameKey}:${area}:${key}`;
}

// Carga activity_standard.js + guide_declarations.js (para tener el CATALOGO
// REAL de actividades de cada guia) y despues portal_home.js, con una
// exposicion extra SOLO en esta copia de prueba para poder invocar
// pendingActivitiesFor (funcion privada del IIFE de portal_home.js, a
// proposito -- solo refreshPortalHome se expone en produccion).
function loadPortalHome(localStorageData) {
  const localStorageStub = {
    _data: localStorageData || {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };

  const ctx = {
    console,
    localStorage: localStorageStub,
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {},
  };
  ctx.window.portalAuth = {
    getCurrentSession: () => null,
    getStudentStorageKey: getStudentStorageKey,
  };
  vm.createContext(ctx);

  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_standard.js"), "utf8"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "guide_declarations.js"), "utf8"), ctx, { filename: "guide_declarations.js" });

  let code = fs.readFileSync(path.join(root, "js", "portal_home.js"), "utf8");
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE de portal_home.js para exponer pendingActivitiesFor en la prueba");
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.pendingActivitiesFor = pendingActivitiesFor;\n})();");
  vm.runInContext(code, ctx, { filename: "portal_home.js" });

  return ctx;
}

test("pendingActivitiesFor: guia recien empezada -> todas las actividades aparecen pendientes", () => {
  const ctx = loadPortalHome({});
  const pending = ctx.window.pendingActivitiesFor(GUIDE2_FILE, USERNAME_KEY);

  assert.ok(pending.length > 0, "una guia sin ningun estado guardado debe tener actividades pendientes");
  assert.ok(pending.some((label) => /extension/i.test(label)), "debe incluir 'Extensiones de archivo' (extensiones331) como pendiente");
});

test("pendingActivitiesFor: actividades guardadas (-locked) YA NO aparecen como pendientes", () => {
  const storageKey = getStudentStorageKey(USERNAME_KEY, "guia_interactiva_10a_guia2_html", { area: "guide-data" });
  const state = {
    "extensiones331-locked": true,
    "sistemas332-locked": true,
  };
  const ctx = loadPortalHome({ [storageKey]: JSON.stringify(state) });

  const pending = ctx.window.pendingActivitiesFor(GUIDE2_FILE, USERNAME_KEY);

  assert.ok(!pending.some((label) => /extension/i.test(label)), "extensiones331 ya esta guardada, no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /requerimientos/i.test(label)), "sistemas332 ya esta guardada, no debe aparecer pendiente");
  assert.ok(pending.some((label) => /suite of/i.test(label)), "suite333 sigue pendiente, debe aparecer");
});

test("pendingActivitiesFor: no duplica actividades que comparten 'number' (ej. Ciberseguridad, 5 partes -> 1 sola entrada)", () => {
  const ctx = loadPortalHome({});
  const pending = ctx.window.pendingActivitiesFor(GUIDE2_FILE, USERNAME_KEY);

  const ciberseg = pending.filter((label) => /ciberseg/i.test(label));
  assert.equal(ciberseg.length, 1, "las 5 sub-actividades de Ciberseguridad (mismo number 3.3.5) deben contarse como UNA sola pendiente, no 5");
});

test("pendingActivitiesFor: todas las actividades guardadas -> sin pendientes", () => {
  const ctxProbe = loadPortalHome({});
  // Toma el catalogo real de la guia para marcar TODO como guardado/entregado.
  const config = ctxProbe.window.ActivityStandard.getConfigForGuide(GUIDE2_FILE);
  const state = {};
  config.activities.forEach((act) => {
    if (act.type === "file") {
      state[act.id + "-delivery"] = { status: "delivered" };
    } else {
      state[act.id + "-locked"] = true;
    }
  });

  const storageKey = getStudentStorageKey(USERNAME_KEY, "guia_interactiva_10a_guia2_html", { area: "guide-data" });
  const ctx = loadPortalHome({ [storageKey]: JSON.stringify(state) });
  const pending = ctx.window.pendingActivitiesFor(GUIDE2_FILE, USERNAME_KEY);

  // pending es un array creado DENTRO del vm context (otro "realm" de V8);
  // compararlo con un [] literal del proceso principal via deepEqual falla
  // por identidad de prototipo aunque el contenido sea igual -- se compara
  // por longitud (un primitivo, sin ese problema).
  assert.equal(pending.length, 0, "si todo esta guardado/entregado, no debe quedar ninguna actividad pendiente");
});

test("pendingActivitiesFor: guia desconocida o sin ActivityStandard -> devuelve lista vacia sin reventar", () => {
  const ctx = loadPortalHome({});
  assert.doesNotThrow(() => {
    const pending = ctx.window.pendingActivitiesFor("archivo-que-no-existe.html", USERNAME_KEY);
    assert.equal(pending.length, 0);
  });
});

// ── Regresion bug jul-10: Induccion y Redes RAP01 usan un script propio/legacy
// que guarda su estado real bajo una clave de localStorage DISTINTA a la que
// ActivityStandard.getStateKeyForGuide() devuelve (ver REAL_STATE_KEY_ALIASES
// en portal_home.js). Sin el alias, guideState() siempre leia {} para estas
// guias -> el home mostraba TODAS las actividades como pendientes aunque el
// avance ya estuviera en 100% (reportado por el usuario en un PC nuevo: el
// avance subia al entrar/salir de la guia, pero "Pendiente en esta guia"
// seguia listando las 8 actividades de Induccion sin cambio).
const INDUCCION_FILE = "grupo-10a-guia-01-induccion.html";
const INDUCCION_REAL_STATE_KEY = "guia_induccion_10a_guia_html";
const REDES_FILE = "santa-barbara-10a-guia-02-redes-rap01.html";
const REDES_REAL_STATE_KEY = "guia_interactiva_sb_10a_redes_html";

test("pendingActivitiesFor: Induccion lee el estado real guardado por script_induccion.js (clave con alias), no el stateKey corto registrado", () => {
  const storageKey = getStudentStorageKey(USERNAME_KEY, INDUCCION_REAL_STATE_KEY, { area: "guide-data" });
  const state = {
    "arbol:respuesta1": "Mis raices son...",
    "curriculo:pregunta1": "Respuesta del cuestionario",
    "plataforma:pregunta1": "Respuesta del taller",
    "compromiso:texto": "Mi compromiso como aprendiz",
    "portafolio342-delivery": { status: "delivered" },
  };
  const ctx = loadPortalHome({ [storageKey]: JSON.stringify(state) });

  const pending = ctx.window.pendingActivitiesFor(INDUCCION_FILE, USERNAME_KEY);

  assert.ok(!pending.some((label) => /arbol/i.test(label)), "El Arbol de la Vida ya tiene contenido (arbol:), no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /cuestionario/i.test(label)), "Cuestionario diseno curricular ya tiene contenido (curriculo:), no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /plataformas/i.test(label)), "Taller plataformas ya tiene contenido (plataforma:), no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /compromiso/i.test(label)), "Mi Compromiso ya tiene contenido (compromiso:), no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /portafolio/i.test(label)), "Portafolio de evidencias ya fue entregado a Drive, no debe aparecer pendiente");
  // Actividades sin campo de texto ni entrega (juego/observacion): solo se
  // resuelven cuando el instructor las califica (reflectGradesIntoGuideState
  // pone "-locked"). Sin nota, siguen pendientes -- es el comportamiento
  // esperado, no el bug reportado.
  assert.ok(pending.some((label) => /sopa de letras/i.test(label)), "Sopa de Letras sin calificar sigue pendiente (no tiene campo ni entrega)");
});

test("pendingActivitiesFor: sin el alias, el estado de Induccion guardado bajo la clave real NO se encuentra (reproduce el bug reportado)", () => {
  // Guarda el estado SOLO bajo el stateKey corto que ActivityStandard tiene
  // registrado ("10a_guia", ver guide_declarations.js) -- la clave que
  // guideState() usaba ANTES del fix. Debe seguir sin encontrar nada real
  // (portal_home.js ya no confia en ese valor para estas dos guias), dejando
  // claro que el fix depende del alias y no de una coincidencia accidental.
  const wrongStorageKey = getStudentStorageKey(USERNAME_KEY, "10a_guia", { area: "guide-data" });
  const state = { "arbol:respuesta1": "Mis raices son..." };
  const ctx = loadPortalHome({ [wrongStorageKey]: JSON.stringify(state) });

  const pending = ctx.window.pendingActivitiesFor(INDUCCION_FILE, USERNAME_KEY);

  assert.ok(pending.some((label) => /arbol/i.test(label)), "el estado guardado bajo el stateKey corto no debe leerse: sigue pendiente");
});

test("pendingActivitiesFor: Redes RAP01 (Santa Barbara) lee el estado real guardado por script_guia_redes.js (clave con alias)", () => {
  const storageKey = getStudentStorageKey(USERNAME_KEY, REDES_REAL_STATE_KEY, { area: "guide-data" });
  const state = {
    "reflexion311-locked": true,
    "lab1-delivery": { status: "delivered" },
  };
  const ctx = loadPortalHome({ [storageKey]: JSON.stringify(state) });

  const pending = ctx.window.pendingActivitiesFor(REDES_FILE, USERNAME_KEY);

  assert.ok(!pending.some((label) => /reflexion individual/i.test(label)), "Reflexion individual ya esta guardada (-locked), no debe aparecer pendiente");
  assert.ok(!pending.some((label) => /topologia estrella/i.test(label)), "Laboratorio 1 ya fue entregado a Drive, no debe aparecer pendiente");
  assert.ok(pending.some((label) => /socializacion final/i.test(label)), "Socializacion final sigue sin guardar, debe seguir pendiente");
});
