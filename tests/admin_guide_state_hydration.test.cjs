const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adminScript = fs.readFileSync(
  path.join(__dirname, "..", "js", "admin_usuarios.js"),
  "utf8"
);
const html = fs.readFileSync(
  path.join(__dirname, "..", "panel-administrativo-usuarios.html"),
  "utf8"
);
const slice = (from, to) => adminScript.slice(adminScript.indexOf(from), adminScript.indexOf(to, adminScript.indexOf(from) + 1));

// Historia: "Respuestas" y "Entregas" leen readStudentGuideState (cache en
// memoria del panel). Hasta oct-22 se llenaba con ensureGuideStatesHydrated:
// TODOS los aprendices x TODAS sus guias al abrir esos modulos (y antes, el
// dashboard) -- ~8000 lecturas y ~3500 llamadas a Apps Script con 159
// aprendices. Desde oct-22: consulta SELECTIVA por aprendiz con boton, y los
// indicadores del dashboard/Reportes salen del listado que la carga de la lista
// de aprendices ya descargo para el progreso (0 lecturas adicionales).

test("ya no existe la hidratacion completa de todos los aprendices", () => {
  // Definicion, llamadas y bandera (los comentarios historicos pueden nombrarla).
  assert.ok(!/async function ensureGuideStatesHydrated|ensureGuideStatesHydrated\(\)|let guideStatesHydrated|runWithConcurrency\(tasks, 6,/.test(adminScript));
});

test("abrir Respuestas/Entregas NO consulta la nube", () => {
  const block = slice('if (moduleName === "respuestas") renderResponses();', "if (tab === \"auditoria\")");
  assert.match(block, /if \(moduleName === "entregas"\) renderDeliveries\(\);/);
  assert.doesNotMatch(block, /consultLearner|cloudGetGuideData|cloudReadGuideDataDetailed/);
});

test("consulta selectiva: solo el aprendiz y las guias elegidos, con lectura detallada y criterio de Drive", () => {
  const fn = slice("async function consultLearnerGuides", "const LEARNER_MESSAGES");
  assert.match(fn, /db\.cloudReadGuideDataDetailed\(getStudentCloudScope\(user\.usernameKey\), names, \{ skipDrive: promotionDone \}\)/);
  assert.match(fn, /isDrivePromotionDone/);
  assert.match(fn, /cloudNamesForGuide|t\.names/);
  assert.match(fn, /learnerConsult\.inflight\.has\(inflightKey\)/, "doble clic: no duplica");
  assert.match(fn, /LEARNER_TTL_MS/, "reutiliza lo vigente");
  assert.match(fn, /hasAdminPanelAccess\(\)/);
});

test("lo consultado no pisa ediciones locales mas nuevas (merge por updatedAt) y vive en MEMORIA", () => {
  const fn = slice("async function consultLearnerGuides", "const LEARNER_MESSAGES");
  assert.match(fn, /pickLatestSnapshot\(\s*\{ state, updatedAt, updatedBy: "cloud" \},/);
  assert.match(fn, /guideDataCacheSet\(storageKey/);
  assert.doesNotMatch(adminScript, /function writeGuideDataLocal/, "nada academico a localStorage");
});

test("solo los botones consultan; filtros y buscadores no", () => {
  const consultCalls = adminScript.match(/consultLearnerModule\("(respuestas|entregas)"(, \{ force: true \})?\)/g) || [];
  assert.strictEqual(consultCalls.length, 4, "Consultar y Actualizar de cada modulo");
  ["responses-consult", "responses-refresh", "deliveries-consult", "deliveries-refresh"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.match(adminScript, new RegExp(`byId\\("${id}"\\)\\?\\.addEventListener\\("click", \\(\\) => \\{ void consultLearnerModule`));
  });
  const responsesRender = slice("function renderResponses()", "async function consultLearnerModule");
  const deliveriesRender = slice("function renderDeliveries()", "function applyDeliveriesPeriod");
  [responsesRender, deliveriesRender].forEach((r) => assert.doesNotMatch(r, /consultLearner|cloudGet|cloudRead|cloudList/));
});

test("busqueda de aprendiz local y por identificador real (usernameKey)", () => {
  const fn = slice("function learnerOptionsHtml", "function selectedLearner");
  assert.match(fn, /value="\$\{escapeHtml\(u\.usernameKey\)\}"/);
  assert.match(fn, /normalizeText\(`\$\{u\.fullName\}/);
  assert.match(html, /id="deliveries-learner-search"/);
});

test("indicadores del dashboard y Reportes: desde el listado ya descargado (0 lecturas)", () => {
  const fn = slice("function hydrateFromLastListing()", "\n  }\n");
  assert.match(fn, /getGuideStatesFromLastListing/);
  assert.match(fn, /pickLatestSnapshot/);
  assert.match(adminScript, /if \(!fromCache\) hydrateFromLastListing\(\);/);
  assert.match(adminScript, /purgeStudentGuideDataFromLocal\(\);\s*\n\s*\/\/ Indicadores/);
});

test("'Ver' reutiliza lo consultado y vigente; 'Reabrir' lo marca como desactualizado", () => {
  const ver = slice("async function openResponses", "function exportActivityResponse");
  assert.match(ver, /const fresh = Boolean\(pair && pair\.status === "ok" && !pair\.stale/);
  assert.match(ver, /if \(config && !fresh\) \{/);
  const reopen = slice("async function reopenDeliveredActivity", "function renderDeliveries()");
  assert.match(reopen, /markLearnerPairStale\(usernameKey, fileName\);/);
  assert.match(reopen, /guideDataCacheSet\(storageKey, guideState,/);
});

test("entregas: el periodo filtra DESPUES de la consulta (sin reduccion ficticia de lecturas)", () => {
  const fn = slice("function renderDeliveries()", "function applyDeliveriesPeriod");
  assert.match(fn, /El filtro de fechas se aplica DESPUES de la consulta selectiva/);
  assert.match(html, /<option value="7">Ultimos 7 dias<\/option>/);
  assert.match(html, /<option value="custom">Personalizado<\/option>/);
});

test("la cache por aprendiz se limpia al salir y al cambiar de sesion", () => {
  assert.match(adminScript, /addEventListener\("pagehide"[\s\S]{0,260}learnerConsult\.pairs\.clear\(\)/);
  assert.match(slice("function ensureLearnerSession()", "function learnerPairKey"), /habSessionKey\(\)/);
});

test("dashboard: tarjeta 'Entregas recientes' (render existe; se puebla bajo demanda)", () => {
  assert.match(html, /<h2>Entregas recientes<\/h2>/);
  assert.match(html, /id="dashboard-deliveries"/);
  assert.match(html, /data-jump-module="entregas">Ver todas/);
  assert.match(adminScript, /function renderRecentDeliveries\(\)/);
  assert.match(adminScript, /renderRecentDeliveries\(\);/);
});

test("dashboard: 'Entregas recientes' NO hidrata a todos al abrir el panel y nunca queda en 'Cargando' (oct-22)", () => {
  assert.doesNotMatch(adminScript, /maybeAutoHydrateDashboard/);
  assert.doesNotMatch(adminScript, /isDashboardHydrateThrottled/);
  const render = adminScript.slice(adminScript.indexOf("function renderRecentDeliveries()"), adminScript.indexOf("function getFilteredUsers()"));
  const calls = render.match(/consultRecentDeliveries\(/g) || [];
  const inClicks = render.match(/addEventListener\("click", \(\) => \{ void consultRecentDeliveries\(/g) || [];
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(inClicks.length, 2);
  assert.match(adminScript, /Elija la ficha y el período y pulse «Consultar entregas recientes»/);
  assert.match(adminScript, /db\.cloudListGuideDataSince\(since\)/);
});
