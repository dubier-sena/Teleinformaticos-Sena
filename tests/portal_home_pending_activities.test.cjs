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
