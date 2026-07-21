const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// ── Carga guide_declarations.js con un mock de ActivityStandard ────────────────
function loadDeclarations() {
  const guides = [];
  const ctx = {
    window: {},
    ActivityStandard: { registerGuide: (c) => guides.push(c) },
    console,
  };
  ctx.window.ActivityStandard = ctx.ActivityStandard;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "guide_declarations.js"), "utf8"), ctx);
  const byFile = {};
  guides.forEach((g) => (g.files || []).forEach((f) => { byFile[f] = g; }));
  return byFile;
}

// ── Carga GRADE_CATALOG + GUIDE_FAMILY_BY_FILE de activity_grades.js ───────────
function loadGradeModule() {
  const ctx = {
    window: {},
    document: { querySelector: () => null, createElement: () => ({ setAttribute() {}, appendChild() {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
  };
  ctx.window.location = { href: "https://x/", };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx);
  const mgr = ctx.window.activityGradesManager;
  assert.ok(mgr && mgr.GRADE_CATALOG && mgr.GUIDE_FAMILY_BY_FILE, "activity_grades expone GRADE_CATALOG y GUIDE_FAMILY_BY_FILE");
  return mgr;
}

// Familias donde TODAS las actividades declaradas son columnas de calificacion,
// aunque usen numeracion simple ("1".."10", "1A".."10A"): son entregas a Drive
// reales, una por reto (pedido del usuario 2026-07-16 para la guia de Python).
const ALL_ACTIVITIES_FAMILIES = new Set(["guia-python", "taller-integrador-jfk", "taller-integrador-sb"]);

// Un numero es de "entregable" si es jerarquico estandar (3.2.5). Se excluyen
// helpers como "3.2.x" (boton Exportar a Word), que no son entregables calificables.
function isDeliverableNumber(num) {
  return /^\d+(\.\d+)+$/.test(String(num || ""));
}

// Entregables esperados de un archivo de guia: UNO por numero, id de la primera sub-actividad.
function expectedEntregables(guide, family) {
  const seen = new Set();
  const out = [];
  const allDeliverable = ALL_ACTIVITIES_FAMILIES.has(family);
  (guide.activities || []).forEach((a) => {
    if (!allDeliverable && !isDeliverableNumber(a.number)) return;
    if (seen.has(a.number)) return;
    seen.add(a.number);
    out.push({ number: a.number, id: a.id });
  });
  return out;
}

test("Calificaciones: cada familia mapea a una guia real y tiene una columna por numero", () => {
  const decls = loadDeclarations();
  const mgr = loadGradeModule();
  const catalog = mgr.GRADE_CATALOG;
  const familyByFile = mgr.GUIDE_FAMILY_BY_FILE;

  // Archivo representativo por familia (el primero que mapee a ella).
  const fileForFamily = {};
  Object.keys(familyByFile).forEach((file) => {
    const fam = familyByFile[file];
    if (!fileForFamily[fam]) fileForFamily[fam] = file;
  });

  Object.keys(catalog).forEach((family) => {
    const file = fileForFamily[family];
    assert.ok(file, `la familia ${family} debe tener al menos un archivo en GUIDE_FAMILY_BY_FILE`);
    const guide = decls[file];
    assert.ok(guide, `el archivo ${file} de la familia ${family} debe estar declarado en guide_declarations`);

    const expected = expectedEntregables(guide, family);
    const got = catalog[family].activities.map((a) => a.id);

    // Mismo numero de entregables (uno por numero).
    assert.equal(
      got.length,
      expected.length,
      `familia ${family}: el catalogo tiene ${got.length} entregables pero la guia tiene ${expected.length} numeros distintos`
    );

    // Cada id del catalogo es el id de la primera sub-actividad de un numero real.
    const expectedIds = new Set(expected.map((e) => e.id));
    got.forEach((id) => {
      assert.ok(expectedIds.has(id), `familia ${family}: el id "${id}" del catalogo no coincide con ninguna actividad numerada real de la guia`);
    });
  });
});

test("Calificaciones: guias 3 (grado 10) y 7 (ciberseguridad) estan incluidas", () => {
  const mgr = loadGradeModule();
  assert.ok(mgr.GRADE_CATALOG["guia-03-planificar-10"], "Guia 3 (grado 10) debe existir en el catalogo");
  assert.ok(mgr.GRADE_CATALOG["guia-07-ciberseguridad"], "Guia 7 (ciberseguridad) debe existir en el catalogo");
  assert.ok(mgr.GRADE_CATALOG["guia-redes-rap02"], "Redes RAP 02 debe existir como familia separada de RAP 01");
});
