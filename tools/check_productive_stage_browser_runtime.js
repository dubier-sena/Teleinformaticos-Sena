const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();

function createLocalStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function runBrowserScript(fileName, extraGlobals = {}) {
  const source = fs.readFileSync(path.join(root, "js", fileName), "utf8");
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Promise,
    AbortController,
    ...extraGlobals,
  };
  sandbox.self = sandbox.self || sandbox;
  sandbox.window = sandbox.window || sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: fileName });
  return sandbox;
}

(async function main() {
  const importSandbox = runBrowserScript("productive_stage_import.js", {
    mammoth: {
      async extractRawText() {
        return { value: "GRADO 11A\nFicha 3168850\nProyecto Demo\n👤 Aprendiz Demo" };
      },
    },
  });

  assert.ok(
    importSandbox.productiveStageImport &&
      typeof importSandbox.productiveStageImport.extractRawTextFromDocxArrayBuffer === "function",
    "El modulo de importacion debe exponerse en navegador."
  );

  const rawText = await importSandbox.productiveStageImport.extractRawTextFromDocxArrayBuffer(
    new ArrayBuffer(8)
  );
  assert.ok(
    String(rawText).includes("GRADO 11A"),
    "La extraccion de texto DOCX debe funcionar en el entorno de navegador sin depender de un identificador global root."
  );

  const localSnapshot = {
    schemaVersion: 1,
    updatedAt: "2026-04-11T10:00:00.000Z",
    projects: [{ id: "alpha" }],
    reports: [],
    imports: [],
    studentIndex: {},
    lastImportSummary: null,
  };

  const storeSandbox = runBrowserScript("productive_stage_store.js", {
    localStorage: createLocalStorage({
      sena_portal_admin_productive_stage_v1: JSON.stringify(localSnapshot),
    }),
    _firebaseDb: {
      async cloudGetGuideData() {
        return null;
      },
      async cloudSaveGuideData() {
        return true;
      },
    },
  });

  assert.ok(
    storeSandbox.productiveStageStore &&
      typeof storeSandbox.productiveStageStore.loadSnapshot === "function",
    "El store debe exponerse en navegador."
  );

  const loadedSnapshot = await storeSandbox.productiveStageStore.loadSnapshot();
  assert.strictEqual(
    loadedSnapshot.projects.length,
    1,
    "El store debe cargar el snapshot en navegador sin depender de un identificador global root."
  );

  console.log("OK: los modulos de etapa productiva funcionan en runtime de navegador sin depender de root global.");
})().catch((error) => {
  console.error("[FAIL]", error && error.message ? error.message : error);
  process.exit(1);
});
