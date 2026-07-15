const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// El banco de planes de mejoramiento (improvement_activities_bank.js) indexa por
// familia -> activityId. fillPlanDescription hace bank[familia][activityId] y si
// no encuentra nada cae en silencio a la tarea por defecto: una familia o un id
// mal escritos NUNCA dan error, simplemente la redaccion curada no se usa. Este
// test cruza cada entrada del banco contra las familias reales (GUIDE_FAMILY_BY_FILE
// de activity_grades.js) y las actividades reales de cada guia (guide_declarations.js)
// para que un typo no deje entradas muertas.

function loadBank() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "improvement_activities_bank.js")), ctx, { filename: "improvement_activities_bank.js" });
  const bank = ctx.window.improvementActivitiesBank;
  assert.ok(bank && typeof bank === "object", "el banco debe definir window.improvementActivitiesBank");
  return bank;
}

function extractFamilyByFile() {
  const script = read(path.join("js", "activity_grades.js"));
  const match = script.match(/GUIDE_FAMILY_BY_FILE = (\{[\s\S]*?\});/);
  assert.ok(match, "no se encontro GUIDE_FAMILY_BY_FILE en activity_grades.js");
  return new Function("return (" + match[1] + ");")();
}

function loadActivityStandard() {
  const ctx = {
    console,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {},
    },
    window: {},
  };
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "activity_standard.js")), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read(path.join("js", "guide_declarations.js")), ctx, { filename: "guide_declarations.js" });
  return ctx;
}

test("cada entrada del banco de mejoramiento apunta a una familia y una actividad reales", () => {
  const bank = loadBank();
  const famByFile = extractFamilyByFile();
  const fileByFam = {};
  for (const [file, fam] of Object.entries(famByFile)) {
    if (!fileByFam[fam]) fileByFam[fam] = file;
  }
  const ctx = loadActivityStandard();

  const families = Object.keys(bank);
  assert.ok(families.length >= 9, "el banco deberia cubrir al menos las 9 familias con contenido curado");

  for (const [fam, entries] of Object.entries(bank)) {
    const file = fileByFam[fam];
    assert.ok(file, `la familia "${fam}" del banco no existe en GUIDE_FAMILY_BY_FILE (activity_grades.js)`);

    const config = ctx.window.ActivityStandard.getConfigForGuide(file);
    assert.ok(config, `la guia "${file}" (familia "${fam}") no esta declarada en guide_declarations.js`);
    const realIds = new Set(config.activities.map((a) => a.id));

    const ids = Object.keys(entries);
    assert.ok(ids.length > 0, `la familia "${fam}" del banco esta vacia`);
    for (const actId of ids) {
      assert.ok(
        realIds.has(actId),
        `"${fam}" -> "${actId}" no es una actividad real de ${file}: fillPlanDescription la ` +
          "ignoraria en silencio y usaria la tarea por defecto"
      );
      const text = entries[actId];
      assert.ok(
        typeof text === "string" && text.trim().length >= 40,
        `"${fam}" -> "${actId}" debe tener una redaccion util (texto no vacio)`
      );
    }
  }
});
