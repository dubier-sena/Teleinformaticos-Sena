// Cableado de la página del aprendiz "Talleres de Refuerzo".
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

test("la página carga shared_apps_script_delivery.js y reinforcement_workshops.js, NO shared_drive_delivery.js", () => {
  const html = read("pages/auxiliares/talleres-refuerzo.html");
  assert.match(html, /shared_apps_script_delivery\.js/);
  assert.match(html, /reinforcement_workshops\.js/);
  assert.match(html, /reinforcement_workshops_student\.js/);
  assert.ok(!html.includes("shared_drive_delivery.js"), "esa lib es para paneles dentro de actividades de guia, no aplica aqui");
  // El catalogo NO hace falta: title/fileUrl ya quedan snapshoteados en cada asignacion.
  assert.ok(!html.includes("reinforcement_workshops_catalog.js"), "el catalogo solo se carga en el panel admin");
});

test("regresión: usa getCurrentSession (no el getSession inexistente)", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.ok(!js.includes(".getSession("), "no debe usar .getSession(), ese método no existe en portalAuth");
  assert.match(js, /\.getCurrentSession\(/);
});

test("regresión: la entrega usa sharedAppsScriptDelivery.offerManualDriveFallback, NO sharedDriveDelivery (bug real en improvement_plans.js)", () => {
  const js = read("js/reinforcement_workshops.js");
  assert.match(js, /function deliverWorkshopToDrive\(workshop\)/);
  assert.match(js, /window\.sharedAppsScriptDelivery/);
  assert.match(js, /sdd\.offerManualDriveFallback/);
  assert.ok(!js.includes("sharedDriveDelivery.offerManualDriveFallback"), "sharedDriveDelivery es un objeto distinto y NO tiene offerManualDriveFallback");
});

test("el título y el motivo se escapan al pintar las tarjetas", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /function escapeHtml\(/);
  assert.match(js, /escapeHtml\(workshop\.title/);
  assert.match(js, /escapeHtml\(workshop\.motivo\)/);
  assert.match(js, /escapeHtml\(workshop\.fileUrl\)/);
});

test("el botón de entrega solo aparece con estado 'asignado'; los talleres cerrados quedan visibles en el historial", () => {
  const js = read("js/reinforcement_workshops_student.js");
  assert.match(js, /canDeliver = status === "asignado"/);
  // renderList pinta TODOS los talleres (no solo los pendientes): ordena una
  // copia sin filtrar (workshops.slice()) y pinta esa copia completa, sin
  // excluir por estado/resultado en el camino.
  const fn = js.match(/function renderList\(workshops\) \{[\s\S]*?\n  \}/);
  assert.ok(fn, "renderList debe existir");
  assert.match(fn[0], /var sorted = workshops\.slice\(\)/);
  assert.match(fn[0], /sorted\.map\(/);
  assert.ok(!/resultado|deriveWorkshopStatus/.test(fn[0].split("sorted.map(")[0].split("workshops.slice()")[1] || ""),
    "no debe excluir talleres por estado/resultado antes de pintarlos");
});
