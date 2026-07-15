// Actividad 9 (Ciberseguridad basica, Guia 2): al aprobar como "A" sin que el
// aprendiz haya respondido, applyApprovedSolutionsForFamily/
// applyApprovedSolutionToStudentCloud necesitan una respuesta modelo en
// grade_solutions_bank.json para rellenar los campos vacios (mismo mecanismo
// que ya usa matriz322/Ficha de caso). Las 4 sub-secciones (amenazas, guia,
// phishing, checklist) no tenian NINGUNA entrada -- pedido del usuario
// 2026-07-10 tras ver, con capturas, el badge "Aprobado" mostrado pero los
// campos seguian en blanco.
//
// A diferencia de Ficha de caso, Ciberseguridad usa la MISMA llave data-store
// sin importar cual de los 3 casos (Minimercado Los Pinos / Agroinsumos La
// Cosecha / Estudio Creativo Brillo Digital) le toco al aprendiz -- por eso
// la respuesta modelo es generica (valida para cualquiera de los 3), no
// especifica de un caso. "ciberseg:guia:actor" (nombre del actor productivo)
// se deja fuera del banco a proposito: inventar un nombre de negocio que no
// coincida con el caso real del aprendiz seria incorrecto.
//
// El checklist de competencias digitales (colaborativas334 / "checklist:*"):
// primero se dejo SIN banco (jul-14, autoevaluacion honesta), pero el usuario
// REVIRTIO esa decision el jul-15 al validar en vivo: una cuenta calificada
// mostraba la lista de 15 items en blanco. Ahora el banco rellena los 15 con
// "domino" (nivel maximo) para que la actividad aprobada se vea completa.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const FAMILY = "guia-02-herramientas";
const USERNAME_KEY = "prueba.aprendiz";

function loadBank() {
  return JSON.parse(fs.readFileSync(path.join(root, "grade_solutions_bank.json"), "utf8"));
}

// Misma tecnica que tests/ficha_caso_grade_solutions.test.cjs: corre el
// codigo REAL de activity_grades.js (no una reimplementacion) contra un DOM
// minimo, para probar el relleno de principio a fin con el contenido REAL
// del banco.
function makeField(initialValue) {
  return { value: initialValue || "", dispatchEvent() {} };
}

function loadActivityGrades() {
  const elementsByDataStore = {};
  const localStorageStub = {
    _data: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };
  const ctx = {
    console,
    localStorage: localStorageStub,
    Event,
    document: {
      querySelectorAll(selector) {
        const m = /^\[data-store="(.*)"\]$/.exec(selector);
        if (!m) return [];
        const el = elementsByDataStore[m[1]];
        return el ? [el] : [];
      },
    },
  };
  ctx.window = ctx;
  ctx.window.portalAuth = {
    getCurrentSession: () => ({ role: "student", usernameKey: USERNAME_KEY, user: { usernameKey: USERNAME_KEY } }),
    getStudentStorageKey: (usernameKey, key, opts) => `sena_portal:student:${usernameKey}:${(opts && opts.area) || "app"}:${key}`,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx, { filename: "activity_grades.js" });

  return {
    ctx,
    registerField(dataStoreKey, initialValue) {
      const el = makeField(initialValue);
      elementsByDataStore[dataStoreKey] = el;
      return el;
    },
  };
}

test("grade_solutions_bank.json tiene respuesta modelo para las 4 sub-secciones de Ciberseguridad (Actividad 9)", () => {
  const bank = loadBank();
  const fam = bank[FAMILY];
  assert.ok(fam, `debe existir bank['${FAMILY}']`);

  const expectedKeysByActivity = {
    cibersegAmenazas335: ["ciberseg:amenazas:listado", "ciberseg:amenazas:consecuencia"],
    cibersegGuia335: ["ciberseg:guia:recomendaciones"],
    cibersegPhishing335: ["ciberseg:phishing:senales", "ciberseg:phishing:reaccion", "ciberseg:phishing:guion"],
    cibersegChecklist335: [
      "ciberseg:checklist:antivirus",
      "ciberseg:checklist:backup",
      "ciberseg:checklist:contrasenas",
      "ciberseg:checklist:bloqueo",
      "ciberseg:checklist:actualizaciones",
      "ciberseg:checklist:adjuntos",
      "ciberseg:checklist:remitente",
      "ciberseg:checklist:cuentas",
      "ciberseg:checklist:wifi",
      "ciberseg:checklist:reporte",
    ],
  };

  Object.keys(expectedKeysByActivity).forEach((activityId) => {
    const entry = fam[activityId];
    assert.ok(entry, `falta bank['${FAMILY}']['${activityId}']`);
    expectedKeysByActivity[activityId].forEach((key) => {
      const value = entry[key];
      assert.ok(typeof value === "string" && value.trim().length > 0, `falta o esta vacia la respuesta modelo '${key}' en ${activityId}`);
    });
  });
});

test("los valores del checklist de Ciberseguridad son niveles validos (cumple/mejora/no-aplica)", () => {
  const bank = loadBank();
  const entry = bank[FAMILY].cibersegChecklist335;
  const validLevels = new Set(["cumple", "mejora", "no-aplica"]);
  Object.keys(entry).forEach((key) => {
    assert.ok(validLevels.has(entry[key]), `valor invalido '${entry[key]}' para '${key}' (debe ser cumple/mejora/no-aplica)`);
  });
});

test("cibersegGuia335 NO incluye 'ciberseg:guia:actor' (evita inventar un nombre de negocio que no coincida con el caso real)", () => {
  const bank = loadBank();
  const entry = bank[FAMILY].cibersegGuia335 || {};
  assert.equal(Object.prototype.hasOwnProperty.call(entry, "ciberseg:guia:actor"), false);
});

test("colaborativas334 rellena los 15 items del checklist de competencias digitales con un nivel valido (pedido jul-15)", () => {
  const bank = loadBank();
  const entry = bank[FAMILY].colaborativas334 || {};
  // Ids reales de digitalCompetencyChecklist en script_guia2.js.
  const script = fs.readFileSync(path.join(root, "js", "script_guia2.js"), "utf8");
  const listMatch = script.match(/const digitalCompetencyChecklist = \[[\s\S]*?\n\];/);
  assert.ok(listMatch, "no se encontro digitalCompetencyChecklist en script_guia2.js");
  const ids = [...listMatch[0].matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 15, "el checklist de competencias digitales deberia tener 15 items");

  // Valores validos del <select> (DIGITAL_CHECKLIST_LEVELS + los que cuenta
  // updateDigitalChecklistSummary): un valor fuera de esta lista dejaria el
  // select sin seleccion y la fila seguiria "pendiente".
  const validLevels = new Set(["domino", "reforzar", "nopracticado"]);
  ids.forEach((id) => {
    const value = entry["checklist:" + id];
    assert.ok(
      typeof value === "string" && value.trim().length > 0,
      `falta la respuesta modelo 'checklist:${id}' en colaborativas334`
    );
    assert.ok(validLevels.has(value), `valor invalido '${value}' para 'checklist:${id}' (debe ser domino/reforzar/nopracticado)`);
  });
});

test("applyApprovedSolutionsForFamily rellena los selects vacios del checklist de competencias y respeta los ya respondidos", () => {
  const bank = loadBank();
  const solution = bank[FAMILY].colaborativas334;

  const { ctx, registerField } = loadActivityGrades();
  const empty = registerField("checklist:doc-word", "");
  const answered = registerField("checklist:excel-formulas", "reforzar");

  ctx.solutionForTest = solution;
  vm.runInContext(
    `window.activityGradesManager.setStudentGrades("${USERNAME_KEY}", "${FAMILY}", {
      colaborativas334: "A",
      "colaborativas334:solution": solutionForTest,
    })`,
    ctx
  );

  const filled = vm.runInContext(`window.activityGradesManager.applyApprovedSolutionsForFamily("${FAMILY}")`, ctx);

  assert.equal(filled, true, "debe reportar que relleno algo");
  assert.equal(empty.value, "domino", "el item vacio debe quedar en 'domino'");
  assert.equal(answered.value, "reforzar", "la autoevaluacion que el aprendiz SI hizo se respeta");
});

test("applyApprovedSolutionsForFamily rellena de principio a fin los campos vacios de cibersegAmenazas335 con el contenido REAL del banco", () => {
  const bank = loadBank();
  const solution = bank[FAMILY].cibersegAmenazas335;

  const { ctx, registerField } = loadActivityGrades();
  const campoListado = registerField("ciberseg:amenazas:listado", "");
  const campoConsecuencia = registerField("ciberseg:amenazas:consecuencia", "");

  vm.createContext(ctx);
  ctx.solutionForTest = solution;
  vm.runInContext(
    `window.activityGradesManager.setStudentGrades("${USERNAME_KEY}", "${FAMILY}", {
      cibersegAmenazas335: "A",
      "cibersegAmenazas335:solution": solutionForTest,
    })`,
    ctx
  );

  const filledAny = vm.runInContext(`window.activityGradesManager.applyApprovedSolutionsForFamily("${FAMILY}")`, ctx);

  assert.equal(filledAny, true);
  assert.equal(campoListado.value, solution["ciberseg:amenazas:listado"]);
  assert.equal(campoConsecuencia.value, solution["ciberseg:amenazas:consecuencia"]);
});
