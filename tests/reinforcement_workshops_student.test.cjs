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
  // Fase 13 (CSP): el gate inline se extrajo a js/access_guard_authenticated.js
  // (compartido con autorizacion-firma.html y calendario-aprendiz.html) --
  // se verifica que la pagina lo referencie Y que el archivo compartido
  // conserve la misma logica (aprendiz o admin).
  assert.match(html, /<script src="js\/access_guard_authenticated\.js\?v=[^"]+"><\/script>/);
  const guard = read("js/access_guard_authenticated.js");
  assert.match(guard, /session\.role !== "student" && session\.role !== "admin"/);
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

test("regresión: cada actividad se ve como una actividad real de guía (objetivo + instrucciones + .mission-card), no solo un textarea suelto", () => {
  const js = read("js/reinforcement_workshops_student.js");
  // Editable (activityCardMarkup) y solo-lectura (readOnlyActivityMarkup)
  // deben compartir la misma estructura visual real de guía.
  assert.match(js, /function activityCardMarkup\(/);
  assert.match(js, /function readOnlyActivityMarkup\(/);
  assert.match(js, /class="activity open mission-card"/);
  assert.match(js, /function objetivoMarkup\(/);
  assert.match(js, /function instruccionesMarkup\(/);
  assert.match(js, /class="support-card"><h3>Instrucciones<\/h3>/);
  // La pagina debe cargar guia_template.css para heredar esas clases reales.
  const html = read("pages/auxiliares/talleres-refuerzo.html");
  assert.match(html, /guia_template\.css/);
});

test("regresión: los campos de documento (intro/conclusiones/referencias) explican para qué sirven, no solo un textarea sin contexto", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /function docFieldsSectionMarkup\(/);
  assert.match(js, /function readOnlyDocFieldsMarkup\(/);
  assert.match(js, /intro-text.*arman la portada/);
});

test("feedback del usuario: 'Tu documento final' va DESPUÉS de las actividades (no antes, cuando el aprendiz aún no ha hecho nada)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  const editable = js.match(/function renderEditableWorkshop\([\s\S]*?\n  \}/)[0];
  assert.ok(
    editable.indexOf("activitiesHtml +") < editable.indexOf("docFieldsHtml +"),
    "en renderEditableWorkshop, activitiesHtml debe ir antes que docFieldsHtml"
  );
  const readOnly = js.match(/function renderReadOnlyWorkshop\([\s\S]*?\n  \}/)[0];
  assert.ok(
    readOnly.indexOf("actsHtml +") < readOnly.indexOf("docsHtml +"),
    "en renderReadOnlyWorkshop, actsHtml debe ir antes que docsHtml"
  );
});

test("feedback del usuario: cada actividad con documentos reales necesarios (Reglamento, Diseño Curricular, manuales) los enlaza, para que el aprendiz no se pierda", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /function recursosMarkup\(/);
  assert.match(js, /recursosMarkup\(act\)/);
  assert.match(js, /class="support-card" style="margin-top:12px"><h3>📎 Recursos que necesitas<\/h3>/);
  // El termino 3 de la Actividad 1 pide el glosario de la Guia de Induccion --
  // ese enlace se arma dinamicamente segun la ficha del aprendiz, no es un
  // recurso estatico del catalogo.
  assert.match(js, /function getInductionGuideHref\(/);
  assert.match(js, /getGuidesForFicha/);
  assert.match(js, /#glosario/);

  const catalog = read("js/reinforcement_workshops_catalog.js");
  // Los recursos deben ser archivos reales que YA existen en el repo (no
  // enlaces inventados) -- Reglamento, Diseño Curricular y manuales que la
  // Guia de Induccion real ya usa.
  assert.match(catalog, /Acuerdo_009_2024_Reglamento_Aprendiz_SENA\.pdf/);
  assert.match(catalog, /Diseno_Curricular_Sistemas_Teleinformaticos\.pdf/);
  assert.match(catalog, /Manual_Formacion_Virtual_SOFIA\.pdf/);
  const fs = require("fs");
  const path = require("path");
  ["Acuerdo_009_2024_Reglamento_Aprendiz_SENA.pdf",
   "Proyecto_Acuerdo_Reglamento_Aprendiz_Anexos.pdf",
   "Diseno_Curricular_Sistemas_Teleinformaticos.pdf",
   "Manual_Formacion_Virtual_SOFIA.pdf",
   "T1_Analisis_Logo_Simbolos_SENA.docx",
   "T2_Uso_Plataformas_Portafolio.docx"].forEach((name) => {
    const full = path.join(__dirname, "..", "assets", "materiales", "induccion", name);
    assert.ok(fs.existsSync(full), "debe existir el archivo real: " + name);
  });
});
