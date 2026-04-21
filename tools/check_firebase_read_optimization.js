const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectIncludes(source, snippet, message) {
  assert(source.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

const guideTemplate = read(path.join("js", "guia_template.js"));
const firebaseDb = read(path.join("js", "firebase_db.js"));
const guideScripts = [
  ["js/script.js", read(path.join("js", "script.js"))],
  ["js/script_guia2.js", read(path.join("js", "script_guia2.js"))],
  ["js/script_guia6.js", read(path.join("js", "script_guia6.js"))],
  ["js/script_induccion.js", read(path.join("js", "script_induccion.js"))],
  ["js/script_guia_redes.js", read(path.join("js", "script_guia_redes.js"))],
];

expectIncludes(
  firebaseDb,
  'var FIRESTORE_DAILY_BUDGET_LIMITS = {',
  "firebase_db debe definir umbrales diarios preventivos para lecturas, escrituras y eliminaciones."
);
expectIncludes(
  firebaseDb,
  'read: { warn: 30000, restrict: 40000, block: 45000 }',
  "firebase_db debe incluir el umbral recomendado para lecturas diarias."
);
expectIncludes(
  firebaseDb,
  'write: { warn: 8000, restrict: 12000, block: 16000 }',
  "firebase_db debe incluir el umbral recomendado para escrituras diarias."
);
expectIncludes(
  firebaseDb,
  'delete: { warn: 100, restrict: 300, block: 500 }',
  "firebase_db debe incluir el umbral recomendado para eliminaciones diarias."
);
expectIncludes(
  firebaseDb,
  "function shouldDeferCloudReads() {",
  "firebase_db debe exponer una decision central para pausar lecturas no esenciales cuando se alcanza el nivel de restriccion."
);
expectIncludes(
  firebaseDb,
  "function shouldSkipGuideUiCloudSave() {",
  "firebase_db debe poder desactivar escrituras no criticas de UI cuando el presupuesto diario se estrecha."
);
expectIncludes(
  firebaseDb,
  "getBudgetStatus:    getFirestoreBudgetStatus,",
  "firebase_db debe exponer el estado del presupuesto diario para diagnostico."
);

expectIncludes(
  guideTemplate,
  "const GUIDE_UI_REFRESH_MS = 60000;",
  "La plantilla compartida debe reducir el polling de UI hacia Firebase a 60 segundos."
);
expectIncludes(
  guideTemplate,
  "const GUIDE_CALENDAR_REMOTE_REFRESH_MS = 15 * 60 * 1000;",
  "La plantilla compartida debe definir una ventana de frescura para no releer el calendario remoto en cada apertura."
);
expectIncludes(
  guideTemplate,
  "function isGuideDocumentVisible() {",
  "La plantilla compartida debe poder pausar lecturas cuando la guia no esta visible."
);
expectIncludes(
  guideTemplate,
  "if (localSnapshot && isGuideCalendarSnapshotFresh(localSnapshot)) {",
  "La plantilla compartida debe reutilizar el snapshot local reciente del calendario antes de consultar Firebase."
);
expectIncludes(
  guideTemplate,
  "function saveGuideCalendarLocalSnapshot(snapshot) {",
  "La plantilla compartida debe guardar el calendario remoto en localStorage para reutilizarlo en aperturas futuras."
);
expectIncludes(
  guideTemplate,
  "if (!isGuideDocumentVisible()) {",
  "La plantilla compartida debe saltarse el polling remoto cuando la pestana esta en segundo plano."
);
expectIncludes(
  guideTemplate,
  "window._firebaseDb?.shouldSkipGuideUiCloudSave?.()",
  "La plantilla compartida debe omitir escrituras de UI cuando el limitador diario las restrinja."
);

for (const [label, script] of guideScripts) {
  const refreshSnippet = label.endsWith("script_guia_redes.js")
    ? "const CLOUD_REFRESH_REDES = 60000;"
    : "const CLOUD_REFRESH_MS = 60000;";

  expectIncludes(
    script,
    refreshSnippet,
    `${label} debe reducir el polling de datos de guia hacia Firebase a 60 segundos.`
  );
  expectIncludes(
    script,
    "if (document.hidden) {",
    `${label} debe evitar lecturas remotas cuando la pestana esta oculta.`
  );
  expectIncludes(
    script,
    "window._firebaseDb?.shouldDeferCloudReads?.()",
    `${label} debe pausar lecturas remotas no esenciales cuando el presupuesto diario lo requiera.`
  );
}

console.log("OK: el portal reduce lecturas de Firebase con polling mas espaciado y reuso de snapshots locales.");
