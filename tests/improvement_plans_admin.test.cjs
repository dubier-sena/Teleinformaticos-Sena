// Cableado de la pestaña admin "Planes de Mejoramiento".
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const admin = read("js/admin_usuarios.js");
const html = read("panel-administrativo-usuarios.html");
const actStd = read("js/activity_standard.js");

test("módulo registrado y con render perezoso", () => {
  assert.match(admin, /mejoramiento: "Planes de Mejoramiento"/);
  assert.match(admin, /if \(moduleName === "mejoramiento"\) \{\s*renderImprovementPlans\(\);/);
  assert.match(admin, /function renderImprovementPlans\(\)/);
});

test("HTML: pestaña de nav + panel + script del módulo", () => {
  assert.match(html, /data-admin-module="mejoramiento">Planes de Mejoramiento</);
  assert.match(html, /id="module-mejoramiento" data-admin-panel="mejoramiento"/);
  assert.match(html, /improvement_plans\.js/);
});

test("asignar plan usa improvementPlans.createPlan + audita", () => {
  const fn = admin.match(/function handleAssignPlan\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handleAssignPlan debe existir");
  assert.match(fn[0], /mgr\.createPlan\(usernameKey, \{/);
  assert.match(fn[0], /action: "mejoramiento-asignar"/);
});

test("cambiar fecha y eliminar usan el módulo", () => {
  const fn = admin.match(/function handlePlanGridClick\(event\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handlePlanGridClick debe existir");
  assert.match(fn[0], /mgr\.updatePlanDeadline\(usernameKey, planId/);
  assert.match(fn[0], /mgr\.deletePlan\(usernameKey, planId\)/);
});

test("export Word del plan: encabezado institucional + Motivo y las DOS fechas", () => {
  const fn = admin.match(/function exportPlanWord\(user, plan\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "exportPlanWord debe existir");
  assert.match(fn[0], /AS\.buildWordDocument\(\{/);
  assert.match(fn[0], /label: "Motivo del plan"/);
  assert.match(fn[0], /label: "Fecha limite programada"/);
  assert.match(fn[0], /label: "Fecha de entrega"/);
  // El encabezado institucional acepta filas extra.
  assert.match(actStd, /opts\.extraHeaderRows/);
});

test("firebase_db + reglas: colección de planes solo-admin escribe / aprendiz lee suyo", () => {
  const db = read("js/firebase_db.js");
  assert.match(db, /COL_IMPROVEMENT_PLANS = "sena_portal_improvement_plans"/);
  assert.match(db, /cloudGetImprovementPlans: cloudGetImprovementPlans/);
  assert.match(db, /cloudSaveImprovementPlans: cloudSaveImprovementPlans/);
  const rules = read("firestore.rules");
  const block = rules.match(/match \/sena_portal_improvement_plans\/\{usernameKey\} \{[\s\S]*?\}/);
  assert.ok(block, "debe existir el match de sena_portal_improvement_plans");
  assert.match(block[0], /allow read:\s*if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\)/);
  assert.match(block[0], /allow write: if isAdmin\(\)/);
});

test("las actividades del plan salen de las actividades REALES de la guía (ActivityStandard)", () => {
  const fn = admin.match(/function populatePlanActivities\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "populatePlanActivities debe existir");
  assert.match(fn[0], /AS\.getActivitiesForGuide\(file\)/);
});

test("la fecha límite del plan es INDEPENDIENTE del sistema de fechas de la guía", () => {
  const plans = read("js/improvement_plans.js");
  assert.match(plans, /fechaLimite/);                      // el plan guarda su propia fecha
  assert.ok(!plans.includes("activityDeadlineManager") && !plans.includes("activity_deadlines"),
    "improvement_plans no debe acoplarse al sistema de fechas global de la guía");
});

test("banco de actividades de mejoramiento (lo redacto yo) -> prellena, guarda y muestra la tarea", () => {
  const bank = read("js/improvement_activities_bank.js");
  assert.match(bank, /window\.improvementActivitiesBank/);
  assert.match(bank, /"guia-02-herramientas"/);
  assert.match(bank, /"extensiones331":/);
  // El formulario la prellena desde el banco (editable) y la pasa a createPlan.
  assert.match(admin, /function fillPlanDescription\(\)/);
  assert.match(admin, /window\.improvementActivitiesBank/);
  assert.match(admin, /family, activityId, activityLabel, descripcion, motivo, fechaLimite/);
  // Cubre TODAS las guías (actuales y futuras): banco si existe, si no un default por actividad.
  assert.match(admin, /function defaultRemedialTask\(label\)/);
  assert.match(admin, /bank\[activityId\] \|\| defaultRemedialTask\(activityLabel\)/);
  // El plan guarda descripcion y el banner del aprendiz la muestra.
  const plans = read("js/improvement_plans.js");
  assert.match(plans, /descripcion: \(opts\.descripcion/);
  assert.match(plans, /plan-mejora-banner__tarea/);
  // El banco se carga en el panel admin.
  assert.match(read("panel-administrativo-usuarios.html"), /improvement_activities_bank\.js/);
});

test("el plan se cierra desde el panel: marcar entregada (fecha) + resultado superado/no superado", () => {
  const plans = read("js/improvement_plans.js");
  assert.match(plans, /function markPlanDelivered\(usernameKey, planId/);
  assert.match(plans, /markPlanDelivered: markPlanDelivered/);
  const fn = admin.match(/function handlePlanGridClick\(event\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handlePlanGridClick debe existir");
  assert.match(fn[0], /mgr\.markPlanDelivered\(usernameKey, planId\)/);
  assert.match(fn[0], /mgr\.setPlanResult\(usernameKey, planId, action === "superado" \? "A" : "D"\)/);
  // El Word toma la fecha de entrega del plan.
  assert.match(admin, /plan\.entrega && plan\.entrega\.entregadoEn \? formatDate\(plan\.entrega\.entregadoEn\)/);
});
