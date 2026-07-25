const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// activity_grades.js::resolveGradeMount() busca, EN ESTE ORDEN, el primer selector
// que exista en el DOM para dibujar el badge Aprobado/No aprobado. Si NINGUNO
// existe en el HTML de la guia, el badge nunca se muestra -- aunque el admin ya
// haya calificado -- y nadie lo nota hasta que un aprendiz o el usuario revisa
// esa actividad puntual (paso asi con "Suite ofimatica" en Guia 2 y con 14
// actividades mas repartidas en Guia 3/6/Redes RAP01/RAP02/Python, todas
// arregladas el 2026-07-10). Este test recorre TODO GRADE_CATALOG y falla si
// alguna actividad (o alias) no tiene NINGUN punto de montaje detectable de
// forma estatica en el HTML real de su guia.
function loadGradeModule() {
  const ctx = {
    window: {},
    document: { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
  };
  ctx.window.location = { href: "https://x/" };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx);
  const mgr = ctx.window.activityGradesManager;
  assert.ok(mgr && mgr.GRADE_CATALOG, "activity_grades.js debe exponer GRADE_CATALOG");
  return mgr;
}

// Un archivo por familia normalmente basta (el partial compartido de la guia).
// "guia-02-herramientas" es la UNICA familia con actividades que viven en
// paginas satelite aparte del partial principal (matriz322 y diagnostico323
// tienen su propio mount en su pagina standalone, no en el partial). Si se
// agrega una pagina satelite nueva a otra guia, sumarla aqui tambien.
const FAMILY_TO_FILES = {
  "guia-01-induccion": ["partials/guia-01-induccion-content.html"],
  "guia-02-herramientas": [
    "partials/guia-02-herramientas-content.html",
    "pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html",
    "pages/auxiliares/grupo-10a-guia-02-actividad-4-formulario.html",
    "pages/auxiliares/grupo-10a-guia-02-ficha-caso.html",
  ],
  "guia-03-planificar-10": ["partials/guia-03-planificar-content.html"],
  "guia-04-ciberseguridad": ["partials/guia-04-planificar-ciberseguridad-content.html"],
  "guia-05-herramientas": ["partials/guia-05-herramientas-content.html"],
  "guia-06-planificar": ["partials/guia-06-planificar-content.html"],
  "guia-07-ciberseguridad": ["partials/guia-07-planificar-ciberseguridad-content.html"],
  "guia-08-documentar-gestion": ["partials/guia-08-documentar-gestion-content.html"],
  "guia-redes-rap01": ["partials/guia-redes-rap01-content.html"],
  "guia-redes-rap02": ["partials/guia-redes-rap02-content.html"],
  "guia-python": ["partials/guia-python-content.html"],
  "taller-integrador-jfk": ["partials/taller-integrador-jfk-content.html"],
  "taller-integrador-sb": ["partials/taller-integrador-sb-content.html"],
};

function conventionSelectorsFor(id, explicitMount) {
  const sels = [];
  if (explicitMount) sels.push(explicitMount);
  // Mismo orden que resolveGradeMount(); data-act-std-delivery es el ultimo
  // fallback (contenedor de confirmacion de entrega de actividades "file").
  sels.push(`#${id}GradeMount`, `#${id}DeadlineControls`, `#${id}DeliveryControls`, `#${id}Status`, `[data-act-grade="${id}"]`, `[data-act-std-delivery="${id}"]`);
  return sels;
}

function selectorFoundInHtml(selector, html) {
  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    return new RegExp(`id\\s*=\\s*["']${id}["']`).test(html);
  }
  const attrMatch = selector.match(/^\[([a-zA-Z0-9_-]+)="([^"]+)"\]$/);
  if (attrMatch) {
    return new RegExp(`${attrMatch[1]}\\s*=\\s*["']${attrMatch[2]}["']`).test(html);
  }
  return html.includes(selector);
}

const mgr = loadGradeModule();
const catalog = mgr.GRADE_CATALOG;

Object.keys(catalog).forEach((family) => {
  const files = FAMILY_TO_FILES[family];

  test(`Calificaciones: familia "${family}" tiene archivo(s) HTML mapeados para verificar mounts`, () => {
    assert.ok(files && files.length, `agrega "${family}" a FAMILY_TO_FILES en este test (tests/grade_badge_mounts_exist.test.cjs)`);
  });

  if (!files) return;

  const htmls = files.map((f) => {
    const full = path.join(root, f);
    assert.ok(fs.existsSync(full), `falta el archivo ${f} declarado para la familia ${family}`);
    return fs.readFileSync(full, "utf8");
  });

  catalog[family].activities.forEach((act) => {
    test(`Calificaciones: "${family}" / ${act.id} (${act.label}) tiene un punto de montaje de badge`, () => {
      const sels = conventionSelectorsFor(act.id, act.mount);
      const found = sels.some((sel) => htmls.some((html) => selectorFoundInHtml(sel, html)));
      assert.ok(
        found,
        `ninguno de estos selectores existe en ${files.join(", ")}: ${sels.join(", ")}. ` +
        `Sin un mount, activity_grades.js.resolveGradeMount() no encuentra donde dibujar el badge y ` +
        `la actividad calificada por el admin nunca se muestra como Aprobada/No aprobada para el aprendiz.`
      );
    });

    (act.aliasMounts || []).forEach((sel) => {
      test(`Calificaciones: "${family}" / ${act.id} -- aliasMount ${sel} existe en el HTML`, () => {
        const found = htmls.some((html) => selectorFoundInHtml(sel, html));
        assert.ok(found, `el aliasMount "${sel}" declarado para ${act.id} no existe en ${files.join(", ")}`);
      });
    });
  });
});
