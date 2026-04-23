const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scriptPath = path.join(__dirname, "..", "js", "guia_template.js");
const source = fs.readFileSync(scriptPath, "utf8").replace(/\r\n/g, "\n");

function instrumentBootFunctions(script) {
  const replacements = [
    [
      "function ensureGuideRevealShell() {\n",
      'function ensureGuideRevealShell() {\n    window.__callLog.push("ensureGuideRevealShell");\n    return;\n',
    ],
    [
      "function initCollapsibleState() {\n",
      'function initCollapsibleState() {\n    window.__callLog.push("initCollapsibleState");\n    return;\n',
    ],
    [
      "function initActivityChecks() {\n",
      'function initActivityChecks() {\n    window.__callLog.push("initActivityChecks");\n    return;\n',
    ],
    [
      "async function initializeGuideUiCloudSync() {\n",
      'async function initializeGuideUiCloudSync() {\n    window.__callLog.push("initializeGuideUiCloudSync");\n    return;\n',
    ],
    [
      "function currentSelection() {\n",
      'function currentSelection() {\n    window.__callLog.push("currentSelection");\n    return window.__selectionResult;\n',
    ],
    [
      "function applySelection(selection) {\n",
      'function applySelection(selection) {\n    window.__callLog.push("applySelection(currentSelection())");\n    window.__selectionCalls.push(selection);\n    return;\n',
    ],
    [
      "function bindSidebarLinks() {\n",
      'function bindSidebarLinks() {\n    window.__callLog.push("bindSidebarLinks");\n    return;\n',
    ],
    [
      "function updateActivityNavDone() {\n",
      'function updateActivityNavDone() {\n    window.__callLog.push("updateActivityNavDone");\n    return;\n',
    ],
    [
      "function notifyGuideProgressChanged() {\n",
      'function notifyGuideProgressChanged() {\n    window.__callLog.push("notifyGuideProgressChanged");\n    return;\n',
    ],
    [
      "function applyResponsiveSidebarState() {\n",
      'function applyResponsiveSidebarState() {\n    window.__callLog.push("applyResponsiveSidebarState");\n    return;\n',
    ],
  ];

  return replacements.reduce((result, [from, to]) => {
    assert.notEqual(result.includes(from), false, "Missing expected function signature: " + from);
    return result.replace(from, to);
  }, script);
}

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false;
    },
  };
}

function createHarness({ runtimeContextPresent }) {
  const windowListeners = [];
  const documentListeners = [];
  const localStorageState = new Map();
  const document = {
    hidden: false,
    visibilityState: "visible",
    body: {
      dataset: {
        defaultFicha: "3441944",
        defaultInst: "Institucion Educativa Santa Barbara",
        defaultGrupo: "10A",
      },
      classList: createClassList(),
    },
    documentElement: {
      classList: createClassList(),
    },
    addEventListener(type, listener) {
      documentListeners.push({ type, listener });
    },
    dispatchEvent() {},
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return {
        classList: createClassList(),
        dataset: {},
        setAttribute() {},
        appendChild() {},
        insertBefore() {},
      };
    },
  };

  const windowObject = {
    __GUIDE_CONTEXT__: runtimeContextPresent ? { key: "sb-redes-10a" } : undefined,
    __callLog: [],
    __selectionCalls: [],
    __selectionResult: {
      ficha: "3441944",
      inst: "Institucion Educativa Santa Barbara",
      grupo: "10A",
    },
    location: {
      pathname: "/santa-barbara-10a-guia-02-redes-rap01.html",
      search: "",
    },
    innerWidth: 1024,
    addEventListener(type, listener) {
      windowListeners.push({ type, listener });
    },
    clearTimeout() {},
    clearInterval() {},
    setTimeout() {
      return 1;
    },
    setInterval() {
      return 1;
    },
  };

  const sandbox = {
    window: windowObject,
    document,
    localStorage: {
      getItem(key) {
        return localStorageState.has(key) ? localStorageState.get(key) : null;
      },
      setItem(key, value) {
        localStorageState.set(key, String(value));
      },
      removeItem(key) {
        localStorageState.delete(key);
      },
      key(index) {
        return Array.from(localStorageState.keys())[index] || null;
      },
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    CustomEvent: function CustomEvent(type) {
      this.type = type;
    },
    URLSearchParams,
    console,
  };

  vm.runInNewContext(instrumentBootFunctions(source), sandbox, {
    filename: "guia_template.js",
  });

  return {
    window: windowObject,
    documentListeners,
    windowListeners,
  };
}

test("guia_template exposes runtime boot behavior and non-runtime autoboot wiring", () => {
  const harness = createHarness({ runtimeContextPresent: false });

  assert.equal(typeof harness.window.initGuiaTemplateShell, "function");
  assert.deepEqual(
    harness.documentListeners.map((entry) => entry.type),
    ["visibilitychange", "DOMContentLoaded"]
  );
  assert.deepEqual(
    harness.windowListeners.map((entry) => entry.type),
    ["pagehide", "beforeunload", "resize"]
  );

  harness.window.__callLog.length = 0;
  harness.window.initGuiaTemplateShell();
  assert.deepEqual(harness.window.__callLog, [
    "ensureGuideRevealShell",
    "initCollapsibleState",
    "initActivityChecks",
    "initializeGuideUiCloudSync",
    "currentSelection",
    "applySelection(currentSelection())",
    "bindSidebarLinks",
    "updateActivityNavDone",
    "notifyGuideProgressChanged",
    "applyResponsiveSidebarState",
  ]);
  assert.deepEqual(harness.window.__selectionCalls, [harness.window.__selectionResult]);

  harness.window.__callLog.length = 0;
  harness.window.__selectionCalls.length = 0;
  harness.window.initGuiaTemplateShell();
  assert.deepEqual(harness.window.__callLog, [
    "currentSelection",
    "applySelection(currentSelection())",
    "updateActivityNavDone",
    "notifyGuideProgressChanged",
    "applyResponsiveSidebarState",
  ]);
  assert.deepEqual(harness.window.__selectionCalls, [harness.window.__selectionResult]);
});

test("guia_template skips DOMContentLoaded autoboot on runtime pages but keeps global listeners", () => {
  const harness = createHarness({ runtimeContextPresent: true });

  assert.equal(typeof harness.window.initGuiaTemplateShell, "function");
  assert.deepEqual(
    harness.documentListeners.map((entry) => entry.type),
    ["visibilitychange"]
  );
  assert.deepEqual(
    harness.windowListeners.map((entry) => entry.type),
    ["pagehide", "beforeunload", "resize"]
  );
});

test("guia_template returns directly from the already-booted branch", () => {
  assert.doesNotMatch(
    source,
    /if \(guideTemplateBooted\) \{\s*applySelection\(currentSelection\(\)\);\s*updateActivityNavDone\(\);\s*notifyGuideProgressChanged\(\);\s*applyResponsiveSidebarState\(\);\s*if \(guideTemplateBooted\) \{\s*return;\s*\}\s*\}/s
  );
});
