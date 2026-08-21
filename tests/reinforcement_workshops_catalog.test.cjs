const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// El catálogo de talleres de refuerzo (reinforcement_workshops_catalog.js) indexa
// por familia de guía (misma llave que GUIDE_FAMILY_BY_FILE en activity_grades.js).
// Un typo en la llave NUNCA da error -- el selector del admin simplemente no
// tendría esa opción -- así que este test cruza cada entrada del catálogo contra
// las familias reales, y además (a diferencia del banco de Mejoramiento, que no
// apunta a archivos en disco) verifica que el PDF referenciado exista de verdad
// en el repo, para no dejar un enlace roto.

function loadCatalog() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "reinforcement_workshops_catalog.js")), ctx, { filename: "reinforcement_workshops_catalog.js" });
  const catalog = ctx.window.reinforcementWorkshopsCatalog;
  assert.ok(catalog && typeof catalog === "object", "el catálogo debe definir window.reinforcementWorkshopsCatalog");
  return catalog;
}

function extractFamilyByFile() {
  const script = read(path.join("js", "activity_grades.js"));
  const match = script.match(/GUIDE_FAMILY_BY_FILE = (\{[\s\S]*?\});/);
  assert.ok(match, "no se encontro GUIDE_FAMILY_BY_FILE en activity_grades.js");
  return new Function("return (" + match[1] + ");")();
}

test("cada entrada del catálogo de talleres apunta a una familia real y tiene los campos requeridos", () => {
  const catalog = loadCatalog();
  const famByFile = extractFamilyByFile();
  const families = new Set(Object.values(famByFile));

  const keys = Object.keys(catalog);
  assert.ok(keys.length >= 1, "el catálogo debería tener al menos el taller de Inducción");

  for (const [key, entry] of Object.entries(catalog)) {
    assert.ok(families.has(key), `la llave "${key}" del catálogo no existe en GUIDE_FAMILY_BY_FILE (activity_grades.js)`);
    assert.ok(typeof entry.title === "string" && entry.title.trim().length > 0, `"${key}" debe tener un título`);
    assert.ok(typeof entry.fileUrl === "string" && entry.fileUrl.trim().length > 0, `"${key}" debe tener un fileUrl`);
    assert.ok(Number.isFinite(entry.defaultDays) && entry.defaultDays > 0, `"${key}" debe tener un defaultDays positivo`);
  }
});

test("el PDF de cada taller existe de verdad en el repo (evita enlaces rotos)", () => {
  const catalog = loadCatalog();
  for (const [key, entry] of Object.entries(catalog)) {
    const filePath = path.join(root, entry.fileUrl);
    assert.ok(fs.existsSync(filePath), `"${key}": el archivo referenciado en fileUrl no existe: ${entry.fileUrl}`);
  }
});
