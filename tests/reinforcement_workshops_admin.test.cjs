// Cableado de la pestaña admin "Talleres de Refuerzo".
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const admin = read("js/admin_usuarios.js");
const html = read("panel-administrativo-usuarios.html");

test("módulo registrado y con render perezoso", () => {
  assert.match(admin, /talleres: "Talleres de Refuerzo"/);
  assert.match(admin, /if \(moduleName === "talleres"\) \{\s*renderReinforcementWorkshops\(\);/);
  assert.match(admin, /function renderReinforcementWorkshops\(\)/);
});

test("HTML: pestaña de nav + panel + scripts del módulo", () => {
  assert.match(html, /data-admin-module="talleres">Talleres de Refuerzo</);
  assert.match(html, /id="module-talleres" data-admin-panel="talleres"/);
  assert.match(html, /reinforcement_workshops\.js/);
  assert.match(html, /reinforcement_workshops_catalog\.js/);
});

test("no hay selector de 'Actividad' (el taller no reabre ninguna actividad real de la guía)", () => {
  const fn = admin.match(/function renderReinforcementWorkshops\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "renderReinforcementWorkshops debe existir");
  assert.ok(!fn[0].includes("taller-actividad"), "no debe existir un selector de actividad para el taller");
});

test("asignación múltiple: recorre los aprendices marcados, crea un taller por cada uno y audita una sola vez", () => {
  const fn = admin.match(/function handleAssignWorkshop\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handleAssignWorkshop debe existir");
  assert.match(fn[0], /getSelectedWorkshopLearners\(\)/);
  assert.match(fn[0], /usernameKeys\.forEach/);
  assert.match(fn[0], /mgr\.createWorkshop\(usernameKey, \{/);
  assert.match(fn[0], /action: "taller-asignar"/);
  // Guard anti-duplicados: no vuelve a asignar a quien ya tenga un taller activo del mismo tipo.
  assert.match(fn[0], /resultado !== "A" && w\.resultado !== "D"/);
});

test("regresión: usa getCurrentSession (no el getSession inexistente)", () => {
  const fn = admin.match(/function handleAssignWorkshop\(\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handleAssignWorkshop debe existir");
  assert.ok(!fn[0].includes(".getSession("), "no debe usar .getSession(), ese método no existe en portalAuth");
  assert.match(fn[0], /auth\.getCurrentSession\(\)/);
});

test("cambiar fecha, marcar entregada, calificar y eliminar usan el módulo reinforcementWorkshops", () => {
  const fn = admin.match(/function handleWorkshopGridClick\(event\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "handleWorkshopGridClick debe existir");
  assert.match(fn[0], /mgr\.updateWorkshopDeadline\(usernameKey, workshopId/);
  assert.match(fn[0], /mgr\.markWorkshopDelivered\(usernameKey, workshopId\)/);
  assert.match(fn[0], /mgr\.setWorkshopResult\(usernameKey, workshopId, action === "superado" \? "A" : "D"\)/);
  assert.match(fn[0], /mgr\.deleteWorkshop\(usernameKey, workshopId\)/);
});

test("sin botón de exportar a Word (decisión deliberada: el PDF del taller ya es el artefacto formal)", () => {
  assert.ok(!admin.includes('data-workshop-action="word"'), "no debe existir un botón de exportar a Word para el taller");
  assert.ok(!admin.includes("function exportWorkshopWord"), "no debe existir una función de exportar a Word para el taller");
});

test("firebase_db + reglas: colección de talleres solo-admin escribe / aprendiz lee suyo", () => {
  const db = read("js/firebase_db.js");
  assert.match(db, /COL_REINFORCEMENT_WORKSHOPS = "sena_portal_reinforcement_workshops"/);
  assert.match(db, /cloudGetReinforcementWorkshops: cloudGetReinforcementWorkshops/);
  assert.match(db, /cloudSaveReinforcementWorkshops: cloudSaveReinforcementWorkshops/);
  const rules = read("firestore.rules");
  const block = rules.match(/match \/sena_portal_reinforcement_workshops\/\{usernameKey\} \{[\s\S]*?\}/);
  assert.ok(block, "debe existir el match de sena_portal_reinforcement_workshops");
  assert.match(block[0], /allow read:\s*if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\)/);
  assert.match(block[0], /allow write: if isAdmin\(\)/);
});

test("catálogo cargado en el panel admin", () => {
  assert.match(html, /reinforcement_workshops_catalog\.js/);
  const catalog = read("js/reinforcement_workshops_catalog.js");
  assert.match(catalog, /window\.reinforcementWorkshopsCatalog/);
  assert.match(catalog, /"guia-01-induccion"/);
});
