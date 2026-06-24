// Cableado del banner de Plan de Mejoramiento que ve el aprendiz en la guia.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function guidePages() {
  const dir = path.join(ROOT, "pages", "guias");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".html"));
}

test("improvement_plans expone el render del banner del aprendiz", () => {
  const js = read("js/improvement_plans.js");
  assert.match(js, /function renderMyPlanBannersForFile\(pageFile\)/);
  assert.match(js, /function renderMyPlanBannersForFamily\(family\)/);
  assert.match(js, /Debes realizar y entregar esta actividad/);
  // Omite las superadas y deduplica.
  assert.match(js, /plan\.resultado === "A"/);
  assert.match(js, /data-plan-act/);
});

test("la guia (guia_template + induccion) invoca el render del banner", () => {
  assert.match(read("js/guia_template.js"), /improvementPlans\.renderMyPlanBannersForFile\(pageFile\)/);
  assert.match(read("js/script_induccion.js"), /improvementPlans\.renderMyPlanBannersForFile\(/);
});

test("las paginas de guia que tienen notas tambien cargan improvement_plans.js", () => {
  const faltan = guidePages().filter((f) => {
    const html = read(path.join("pages", "guias", f));
    return html.includes("activity_grades.js") && !html.includes("improvement_plans.js");
  });
  assert.deepStrictEqual(faltan, [], "estas guias cargan notas pero no improvement_plans.js: " + faltan.join(", "));
});

test("CSS del banner presente", () => {
  assert.match(read("css/guia_template.css"), /\.plan-mejora-banner\b/);
});

test("el banner ofrece entrega (canal propio) dentro de la fecha del plan", () => {
  const js = read("js/improvement_plans.js");
  assert.match(js, /Entregar a Drive/);
  assert.match(js, /function deliverPlanToDrive\(plan\)/);
  assert.match(js, /offerManualDriveFallback/);
  assert.match(js, /canDeliver = \(status === "asignado"\)/);  // re-bloqueo por fecha
});

test("regresión: se usa getCurrentSession (getSession no existe en portalAuth)", () => {
  for (const f of ["js/activity_grades.js", "js/improvement_plans.js"]) {
    assert.ok(!read(f).includes(".getSession("), f + " no debe usar .getSession()");
    assert.match(read(f), /\.getCurrentSession\(/);
  }
});
