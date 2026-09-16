"use strict";
// El modulo de Calificaciones del panel admin arma su desplegable de guia asi:
//   ficha -> portalAuth.getGuidesForFicha(ficha)   (FICHA_MAP, js/portal_auth.js)
//        -> GUIDE_FAMILY_BY_FILE[archivo]          (js/activity_grades.js)
//        -> GRADE_CATALOG[familia]                 (js/activity_grades.js)
// getGuideFamiliesForFicha() (js/admin_usuarios.js) DESCARTA EN SILENCIO todo
// archivo que no resuelva a una familia con catalogo: no hay error, no hay log,
// la guia simplemente no existe para el modulo.
//
// Asi se perdieron las Guias 10/11/12 de Redes de John F. Kennedy (fichas
// 3441939 y 3441942): estaban en FICHA_MAP, en guide_declarations.js, en
// guia_router.js y con su HTML real, pero nunca se agregaron al mapa de
// familias -- no se podian calificar, y ademas se caian los badges de la guia,
// el relleno del banco de respuestas, el panel "Tus actividades", los avisos de
// "No aprobado" del home, los banners de plan de mejoramiento y el resumen del
// aprendiz (todos consultan GUIDE_FAMILY_BY_FILE y salen temprano si no hay
// familia).
//
// tests/grade_catalog_matches_declarations.test.cjs solo recorre las familias
// que YA estan en el catalogo, asi que este hueco le pasaba por debajo. Esta
// prueba cubre la direccion contraria, que es la que faltaba:
//
//   INVARIANTE: toda guia asignada a una ficha en FICHA_MAP debe resolver a una
//   familia de calificacion existente y con al menos una actividad.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}

// Extrae el objeto literal balanceado que sigue al ancla, ignorando cadenas y
// comentarios (FICHA_MAP lleva comentarios con llaves y apostrofes).
function extractObjectLiteral(source, anchor) {
  const from = source.indexOf(anchor);
  assert.notStrictEqual(from, -1, "no se encontro el ancla: " + anchor);
  const start = source.indexOf("{", from + anchor.length);
  assert.notStrictEqual(start, -1, "no hay llave de apertura tras: " + anchor);

  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      const nl = source.indexOf("\n", i);
      i = nl === -1 ? source.length : nl;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return source.slice(start, i);
}

const FICHA_MAP = new Function("return (" + extractObjectLiteral(read("js/portal_auth.js"), "FICHA_MAP =") + ");")();

// Carga activity_grades.js + guide_declarations.js en el MISMO sandbox, en el
// orden indicado. El orden importa de verdad: en las paginas de guia
// activity_grades.js carga ANTES que guide_declarations.js (ver las listas
// scripts[] de js/guia_router.js) y en el panel admin carga DESPUES (ver
// panel-administrativo-usuarios.html). La resolucion de familia tiene que
// funcionar en los dos casos, por eso cada prueba corre las dos variantes.
function loadManager(declarationsFirst) {
  const ctx = {
    window: {},
    document: { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
  };
  ctx.window.location = { href: "https://x/" };
  ctx.window.ActivityStandard = { registerGuide() {} };
  vm.createContext(ctx);
  const gradesSrc = read("js/activity_grades.js");
  const declSrc = read("js/guide_declarations.js");
  const order = declarationsFirst ? [declSrc, gradesSrc] : [gradesSrc, declSrc];
  order.forEach((src) => vm.runInContext(src, ctx));
  const mgr = ctx.window.activityGradesManager;
  assert.ok(mgr && mgr.GRADE_CATALOG && mgr.GUIDE_FAMILY_BY_FILE,
    "activity_grades.js debe exponer GRADE_CATALOG y GUIDE_FAMILY_BY_FILE");
  return mgr;
}

const ORDERS = [
  { label: "orden de las paginas de guia (activity_grades antes)", declarationsFirst: false },
  { label: "orden del panel admin (guide_declarations antes)", declarationsFirst: true },
];

test("FICHA_MAP produce guias (el literal se parseo bien)", () => {
  const fichas = Object.keys(FICHA_MAP);
  assert.ok(fichas.length > 0, "FICHA_MAP vacio");
  fichas.forEach((ficha) => {
    assert.ok(Array.isArray(FICHA_MAP[ficha].guias) && FICHA_MAP[ficha].guias.length > 0,
      `la ficha ${ficha} no declara guias`);
  });
});

ORDERS.forEach(({ label, declarationsFirst }) => {
  test(`toda guia de FICHA_MAP resuelve a una familia calificable con actividades (${label})`, () => {
    const mgr = loadManager(declarationsFirst);
    const familyByFile = mgr.GUIDE_FAMILY_BY_FILE;
    const catalog = mgr.GRADE_CATALOG;
    const faltantes = [];

    Object.keys(FICHA_MAP).forEach((ficha) => {
      const info = FICHA_MAP[ficha];
      (info.guias || []).forEach((file) => {
        const family = familyByFile[file];
        const entry = family ? catalog[family] : null;
        const activities = entry && Array.isArray(entry.activities) ? entry.activities : [];
        if (!family) {
          faltantes.push(`${file} (ficha ${ficha}, ${info.inst} ${info.grupo}): sin familia de calificacion`);
        } else if (!entry) {
          faltantes.push(`${file} (ficha ${ficha}): familia "${family}" no existe en GRADE_CATALOG`);
        } else if (!activities.length) {
          faltantes.push(`${file} (ficha ${ficha}): familia "${family}" no tiene actividades`);
        }
      });
    });

    assert.deepEqual(faltantes, [],
      "guias asignadas a una ficha que el modulo de Calificaciones descartaria en silencio:\n  - "
      + faltantes.join("\n  - "));
  });

  test(`las Guias 10/11/12 de Kennedy reusan la familia de Santa Barbara, sin duplicarla (${label})`, () => {
    const mgr = loadManager(declarationsFirst);
    const esperado = {
      "grupo-10a-guia-10-redes-rap01.html": "guia-redes-rap01",
      "grupo-10b-guia-10-redes-rap01.html": "guia-redes-rap01",
      "grupo-10a-guia-11-redes-rap02.html": "guia-redes-rap02",
      "grupo-10b-guia-11-redes-rap02.html": "guia-redes-rap02",
      "grupo-10a-guia-12-redes-rap03.html": "guia-redes-rap03",
      "grupo-10b-guia-12-redes-rap03.html": "guia-redes-rap03",
    };
    Object.keys(esperado).forEach((file) => {
      assert.equal(mgr.GUIDE_FAMILY_BY_FILE[file], esperado[file],
        `${file} debe calificarse bajo la familia ya existente ${esperado[file]}`);
    });
    // Ninguna familia nueva: el catalogo debe seguir teniendo las mismas 17.
    assert.equal(Object.keys(mgr.GRADE_CATALOG).length, 17,
      "no se deben crear familias nuevas para las guias de Kennedy (reusan las de Santa Barbara)");
  });
});

test("una guia que declare gradeFamily queda visible sin tocar activity_grades.js", () => {
  // Contrato de la fuente unica: guide_declarations.js deposita archivo->familia
  // en window.__portalGuideGradeFamilies y activity_grades.js lo absorbe al leer.
  // Esto es lo que impide que una guia FUTURA vuelva a quedar invisible.
  const ctx = {
    window: { __portalGuideGradeFamilies: { "guia-inventada.html": "guia-redes-rap01" } },
    document: { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
  };
  ctx.window.location = { href: "https://x/" };
  vm.createContext(ctx);
  vm.runInContext(read("js/activity_grades.js"), ctx);
  const mgr = ctx.window.activityGradesManager;
  assert.equal(mgr.GUIDE_FAMILY_BY_FILE["guia-inventada.html"], "guia-redes-rap01");
  assert.equal(mgr.resolveGuideFamily("guia-inventada.html"), "guia-redes-rap01");
});

test("el mapa explicito manda: una declaracion NUNCA renombra una familia existente", () => {
  // Las llaves de familia estan persistidas en Firestore (sena_portal_grades).
  // Si una declaracion pudiera pisarlas, las notas ya guardadas quedarian
  // huerfanas sin ningun aviso.
  const ctx = {
    window: {
      __portalGuideGradeFamilies: {
        "santa-barbara-10a-guia-02-redes-rap01.html": "familia-intrusa",
        "grupo-10a-guia-01-induccion.html": "familia-intrusa",
      },
    },
    document: { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
  };
  ctx.window.location = { href: "https://x/" };
  vm.createContext(ctx);
  vm.runInContext(read("js/activity_grades.js"), ctx);
  const mgr = ctx.window.activityGradesManager;
  assert.equal(mgr.GUIDE_FAMILY_BY_FILE["santa-barbara-10a-guia-02-redes-rap01.html"], "guia-redes-rap01");
  assert.equal(mgr.GUIDE_FAMILY_BY_FILE["grupo-10a-guia-01-induccion.html"], "guia-01-induccion");
});
