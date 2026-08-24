// Ficha de caso (Actividad 4, Guia 2) nunca estuvo conectada al banco de
// respuestas: sus 4 preguntas (A-D) usaban solo `id="fc-resp-N"`, sin el
// atributo `data-store` que activityGradesManager.applyApprovedSolutionsForFamily
// necesita para rellenar un campo vacio con la respuesta modelo al aprobar
// (mismo mecanismo que ya usa la pagina de la Matriz). Pedido del usuario
// 2026-07-10 tras notar que una Ficha de caso ya aprobada (junto con
// matriz322, ver fix-jul9-guia2-calificar-bloqueo) seguia mostrando sus 4
// preguntas vacias en vez de la respuesta modelo.
//
// Cada uno de los 3 casos (tienda/cultivo/artesanias) tiene su PROPIA clave
// data-store por pregunta ("fichacaso-<caso>-<letra>"), porque el texto de
// las preguntas cambia segun cual ficha le toco al equipo.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const USERNAME_KEY = "prueba.aprendiz";
const FAMILY = "guia-02-herramientas";

function readFicha(fileName) {
  return fs.readFileSync(path.join(root, "pages", "auxiliares", fileName), "utf8");
}

// grade_solutions_bank.json esta en .gitignore a proposito (banco de
// respuestas modelo); ver la misma nota en
// tests/ciberseguridad335_grade_solutions.test.cjs.
const BANK_PATH = path.join(root, "grade_solutions_bank.json");
const BANK_EXISTS = fs.existsSync(BANK_PATH);
const SKIP_REASON = "grade_solutions_bank.json no existe en este checkout (gitignored a proposito)";

test(
  "grade_solutions_bank.json tiene las 12 respuestas modelo de Ficha de caso (3 casos x 4 preguntas)",
  { skip: !BANK_EXISTS && SKIP_REASON },
  () => {
  const bank = JSON.parse(fs.readFileSync(BANK_PATH, "utf8"));
  const matriz322 = bank[FAMILY] && bank[FAMILY].matriz322;
  assert.ok(matriz322, "debe existir bank['guia-02-herramientas'].matriz322");

  ["tienda", "cultivo", "artesanias"].forEach((caso) => {
    ["a", "b", "c", "d"].forEach((letra) => {
      const key = "fichacaso-" + caso + "-" + letra;
      const text = matriz322[key];
      assert.ok(typeof text === "string" && text.trim().length > 0, `falta o esta vacia la respuesta modelo '${key}'`);
    });
  });
});

test("Ficha de caso 10A/10B: renderRespuestas asigna data-store por caso asignado (fichacaso-<caso>-<letra>)", () => {
  ["grupo-10a-guia-02-ficha-caso.html", "grupo-10b-guia-02-ficha-caso.html"].forEach((file) => {
    const html = readFicha(file);
    assert.match(
      html,
      /ta\.setAttribute\("data-store", "fichacaso-" \+ ficha\.slug \+ "-" \+ letras\[i\]\.toLowerCase\(\)\)/,
      `${file}: renderRespuestas debe poner data-store="fichacaso-<caso>-<letra>" en cada textarea`
    );
    assert.match(
      html,
      /activityGradesManager[\s\S]{0,80}autoRenderForFile/,
      `${file}: revelarFicha debe llamar a activityGradesManager.autoRenderForFile para disparar el relleno del banco`
    );
  });
});

test("fichas_casos.js: cada ficha tiene 'slug' (tienda/cultivo/artesanias) usado por el data-store de Ficha de caso", () => {
  const code = fs.readFileSync(path.join(root, "js", "fichas_casos.js"), "utf8");
  const ctx = {
    window: {},
    document: {
      readyState: "complete",
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: "fichas_casos.js" });
  const fichas = ctx.window.fichasCasos.FICHAS;
  assert.equal(fichas.length, 3, "se esperaban las 3 fichas de caso conocidas");
  // fichas viene del "realm" del vm context -- Array.from() lo copia a un
  // array plano de este proceso antes de comparar (deepEqual contra un [])
  // falla por identidad de prototipo aunque el contenido sea igual, ver el
  // mismo caveat en tests/portal_home_pending_activities.test.cjs.
  const slugs = Array.from(fichas, (f) => f.slug).sort();
  assert.deepEqual(slugs, ["artesanias", "cultivo", "tienda"], "cada ficha debe tener el slug correcto");
  Array.from(fichas).forEach((f) => {
    assert.equal(f.preguntas.length, 4, `ficha '${f.slug}' debe tener 4 preguntas (A-D)`);
  });
});

// ── Prueba funcional del relleno real, contra el codigo REAL de activity_grades.js
// (no una reimplementacion) -- reproduce exactamente el escenario reportado:
// matriz322 aprobada, con la solucion del banco embebida en la nota del
// aprendiz (asi es como llega en produccion, ver setStudentActivityGradeAndSolution),
// y una pregunta de Ficha de caso vacia en el DOM.
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

test("applyApprovedSolutionsForFamily rellena una pregunta VACIA de Ficha de caso con la respuesta modelo al aprobar matriz322", () => {
  const { ctx, registerField } = loadActivityGrades();
  const campoVacio = registerField("fichacaso-cultivo-a", "");

  vm.runInContext(
    `window.activityGradesManager.setStudentGrades("${USERNAME_KEY}", "${FAMILY}", {
      matriz322: "A",
      "matriz322:solution": { "fichacaso-cultivo-a": "Respuesta modelo de prueba." },
    })`,
    ctx
  );

  const filledAny = vm.runInContext(`window.activityGradesManager.applyApprovedSolutionsForFamily("${FAMILY}")`, ctx);

  assert.equal(filledAny, true, "debe reportar que si relleno algo");
  assert.equal(campoVacio.value, "Respuesta modelo de prueba.", "debe copiar la respuesta modelo al campo vacio");
});

test("applyApprovedSolutionsForFamily NO sobrescribe una pregunta que el aprendiz SI respondio", () => {
  const { ctx, registerField } = loadActivityGrades();
  const campoConRespuesta = registerField("fichacaso-cultivo-a", "Mi propia respuesta real.");

  vm.runInContext(
    `window.activityGradesManager.setStudentGrades("${USERNAME_KEY}", "${FAMILY}", {
      matriz322: "A",
      "matriz322:solution": { "fichacaso-cultivo-a": "Respuesta modelo de prueba." },
    })`,
    ctx
  );

  vm.runInContext(`window.activityGradesManager.applyApprovedSolutionsForFamily("${FAMILY}")`, ctx);

  assert.equal(
    campoConRespuesta.value,
    "Mi propia respuesta real.",
    "la respuesta real del aprendiz nunca debe ser reemplazada por la del banco"
  );
});

test("applyApprovedSolutionsForFamily no toca preguntas de OTRO caso (data-store distinto no coincide)", () => {
  const { ctx, registerField } = loadActivityGrades();
  // El equipo tiene asignado el caso "tienda", asi que solo existen en el DOM
  // los data-store de "tienda"; el banco puede traer las 12 claves (3 casos)
  // pero solo debe encontrar/rellenar las que SI existen en esta pagina.
  const campoTienda = registerField("fichacaso-tienda-a", "");

  vm.runInContext(
    `window.activityGradesManager.setStudentGrades("${USERNAME_KEY}", "${FAMILY}", {
      matriz322: "A",
      "matriz322:solution": {
        "fichacaso-tienda-a": "Respuesta modelo tienda.",
        "fichacaso-cultivo-a": "Respuesta modelo cultivo (no deberia aplicarse aqui).",
      },
    })`,
    ctx
  );

  vm.runInContext(`window.activityGradesManager.applyApprovedSolutionsForFamily("${FAMILY}")`, ctx);

  assert.equal(campoTienda.value, "Respuesta modelo tienda.", "debe rellenar solo el data-store que existe en esta pagina");
});
