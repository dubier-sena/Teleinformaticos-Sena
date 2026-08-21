// Cableado de la página del aprendiz "Talleres de Refuerzo": el taller se
// desarrolla EN LÍNEA (campos de texto guardados/bloqueados con el mismo
// motor que las guías reales), no solo se descarga un PDF.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("la página auxiliar existe con el gate correcto (aprendiz o admin) y CSP sin dominios nuevos", () => {
  const html = read("pages/auxiliares/talleres-refuerzo.html");
  assert.match(html, /<base href="\.\.\/\.\.\/">/);
  assert.match(html, /session\.role !== "student" && session\.role !== "admin"/);
  // Misma CSP que autorizacion-firma.html -- ningun dominio externo nuevo.
  const firma = read("pages/auxiliares/autorizacion-firma.html");
  const cspOf = (html_) => (html_.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/) || [])[1];
  assert.equal(cspOf(html), cspOf(firma), "la CSP de la pagina nueva debe ser identica a la de autorizacion-firma.html");
});

test("la página carga ActivityStandard + sharedDriveDelivery + el catálogo (el taller se llena en línea, como una guía)", () => {
  const html = read("pages/auxiliares/talleres-refuerzo.html");
  assert.match(html, /shared_apps_script_delivery\.js/);
  assert.match(html, /shared_drive_delivery\.js/);
  assert.match(html, /activity_standard\.js/);
  assert.match(html, /reinforcement_workshops\.js/);
  assert.match(html, /reinforcement_workshops_catalog\.js/);
  assert.match(html, /reinforcement_workshops_student\.js/);
});

test("regresión: usa getCurrentSession (no el getSession inexistente)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.ok(!js.includes(".getSession("), "no debe usar .getSession(), ese método no existe en portalAuth");
  assert.match(js, /\.getCurrentSession\(/);
});

test("cada actividad se guarda/bloquea con ActivityStandard.mountFormActivity (mismo motor de las guías reales)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /AS\.mountFormActivity\(\{/);
  assert.match(js, /formFields: formFields/);
  assert.match(js, /buttonIds: \{ save: "btnGuardar_" \+ effectiveId, status: "status_" \+ effectiveId \}/);
});

test("la actividad 3 (mapa conceptual) usa sharedDriveDelivery.appendDriveDeliveryPanels, igual que 'Árbol de la Vida' en Inducción", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /function mountDriveActivity\(/);
  assert.match(js, /sdd\.appendDriveDeliveryPanels\(\{/);
  const catalog = read("js/reinforcement_workshops_catalog.js");
  const act3 = catalog.match(/id: "act3"[\s\S]*?driveTarget: \{[\s\S]*?\},\s*\},/);
  assert.ok(act3, "la actividad 3 del catálogo debe declarar driveTarget (es la única con contenido visual)");
});

test("regresión: NO se usa window.sharedDriveDelivery.offerManualDriveFallback (esa función no existe en ese objeto, ver bug real en improvement_plans.js)", () => {
  const student = read("js/reinforcement_workshops_student.js");
  const core = read("js/reinforcement_workshops.js");
  assert.ok(!student.includes("sharedDriveDelivery.offerManualDriveFallback"));
  assert.ok(!core.includes("sharedDriveDelivery.offerManualDriveFallback"));
});

test("los campos de actividad y de documento se escapan al pintarlos", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /function escapeHtml\(/);
  assert.match(js, /escapeHtml\(f\.label\)/);
  assert.match(js, /escapeHtml\(value\)/);
});

test("estado 'asignado' -> formulario editable; entregado/vencido/superado/no_superado -> solo lectura (no se pierde el historial)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /status === "asignado"/);
  assert.match(js, /function renderEditableWorkshop\(/);
  assert.match(js, /function renderReadOnlyWorkshop\(/);
  // renderList no filtra los talleres cerrados fuera de la lista: solo cambia
  // que rama de render usa (editable vs solo lectura).
  const fn = js.match(/async function renderList\([\s\S]*?\n  \}/);
  assert.ok(fn, "renderList debe existir");
  assert.match(fn[0], /renderReadOnlyWorkshop/);
});

test("respuestas: colección separada de la asignación, y el aprendiz SI puede escribir la suya", () => {
  const db = read("js/firebase_db.js");
  assert.match(db, /COL_REINFORCEMENT_ANSWERS = "sena_portal_reinforcement_answers"/);
  assert.match(db, /cloudGetReinforcementAnswers: cloudGetReinforcementAnswers/);
  assert.match(db, /cloudSaveReinforcementAnswers: cloudSaveReinforcementAnswers/);
  const rules = read("firestore.rules");
  const block = rules.match(/match \/sena_portal_reinforcement_answers\/\{usernameKey\} \{[\s\S]*?\}/);
  assert.ok(block, "debe existir el match de sena_portal_reinforcement_answers");
  assert.match(block[0], /allow read, write:\s*if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\)/);
  // El doc de la ASIGNACION (fechas/estado/resultado) sigue solo-admin-escribe:
  // separar las colecciones es lo que evita que el aprendiz pueda forjar su
  // propio "Superado" y enganar al admin (no solo a si mismo).
  const workshopsBlock = rules.match(/match \/sena_portal_reinforcement_workshops\/\{usernameKey\} \{[\s\S]*?\}/);
  assert.match(workshopsBlock[0], /allow write: if isAdmin\(\);/);
  const core = read("js/reinforcement_workshops.js");
  assert.match(core, /function saveWorkshopAnswers\(usernameKey, workshopId, respuestas\)/);
  assert.match(core, /saveWorkshopAnswers: saveWorkshopAnswers/);
});

test("el guardado de respuestas hace debounce a la nube (1.2s, mismo criterio que el resto del portal)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /CLOUD_SAVE_DEBOUNCE_MS = 1200/);
  assert.match(js, /function scheduleCloudSave\(/);
});
