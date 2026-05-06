const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");
const CONTEXT_FILE = path.join(REPO_ROOT, "data", "page_runtime_contexts.json");
const LOADER_FILE = path.join(REPO_ROOT, "js", "page_runtime_loader.js");

const EXPECTED_CONTEXTS = {
  "jfk-induccion-10a": {
    family: "guia-01-induccion",
    pageFile: "grupo-10a-guia-01-induccion.html",
    partialPath: "partials/guia-01-induccion-content.html",
    inst: "Institucion Educativa Jhon F. Kennedy",
    grupo: "10A",
    ficha: "3441939",
    boot: "initInduccion",
  },
  "jfk-induccion-10b": {
    family: "guia-01-induccion",
    pageFile: "grupo-10b-guia-01-induccion.html",
    partialPath: "partials/guia-01-induccion-content.html",
    inst: "Institucion Educativa Jhon F. Kennedy",
    grupo: "10B",
    ficha: "3441942",
    boot: "initInduccion",
  },
  "jfk-guia2-10a": {
    family: "guia-02-herramientas",
    pageFile: "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    partialPath: "partials/guia-02-herramientas-content.html",
    inst: "Institucion Educativa Jhon F. Kennedy",
    grupo: "10A",
    ficha: "3441939",
    boot: "initGuia2",
  },
  "jfk-guia2-10b": {
    family: "guia-02-herramientas",
    pageFile: "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
    partialPath: "partials/guia-02-herramientas-content.html",
    inst: "Institucion Educativa Jhon F. Kennedy",
    grupo: "10B",
    ficha: "3441942",
    boot: "initGuia2",
  },
  "sb-guia5-11a": {
    family: "guia-05-herramientas",
    pageFile: "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
    partialPath: "partials/guia-05-herramientas-content.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "11A",
    ficha: "3168850",
    boot: "initGuia5",
  },
  "sb-guia5-11b": {
    family: "guia-05-herramientas",
    pageFile: "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
    partialPath: "partials/guia-05-herramientas-content.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "11B",
    ficha: "3168852",
    boot: "initGuia5",
  },
  "sb-guia6-11a": {
    family: "guia-06-planificar",
    pageFile: "grupo-11a-guia-06-planificar-informacion.html",
    partialPath: "partials/guia-06-planificar-content.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "11A",
    ficha: "3168850",
    boot: "initGuia6",
  },
  "sb-guia6-11b": {
    family: "guia-06-planificar",
    pageFile: "grupo-11b-guia-06-planificar-informacion.html",
    partialPath: "partials/guia-06-planificar-content.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "11B",
    ficha: "3168852",
    boot: "initGuia6",
  },
};

const SHARED_HTML = '<section class="runtime-fragment"><button id="runtimeButton"></button></section>';
const SHARED_HTML_WITH_INLINE_SCRIPT =
  SHARED_HTML +
  '<script>window.recordPartialScript(document.body.dataset.defaultGrupo);</script>';

function createHarness({
  contextKey = "jfk-induccion-10a",
  pathname = "/grupo-10a-guia-01-induccion.html",
  registryOk = true,
  partialOk = true,
  registryPayload = EXPECTED_CONTEXTS,
  partialHtml = SHARED_HTML,
  pageRootPresent = true,
  bundledContexts = null,
  bundledPartials = null,
  routePageFile = "",
} = {}) {
  const loaderSource = fs.readFileSync(LOADER_FILE, "utf8");
  const eventLog = [];
  const fetchLog = [];
  const consoleStub = {
    error() {},
    info() {},
    log() {},
    warn() {},
  };

  let templateInitCalls = 0;
  let pageBootCalls = 0;
  const rootState = { html: "" };

  const root = {};
  Object.defineProperty(root, "innerHTML", {
    get() {
      return rootState.html;
    },
    set(value) {
      rootState.html = String(value);
      eventLog.push("root injected");
    },
    configurable: true,
    enumerable: true,
  });

  const datasetBacking = {};
  const body = {};
  Object.defineProperty(body, "dataset", {
    value: new Proxy(datasetBacking, {
      set(target, prop, value) {
        target[prop] = value;
        if (
          target.defaultInst !== undefined &&
          target.defaultGrupo !== undefined &&
          target.defaultFicha !== undefined &&
          !eventLog.includes("datasets hydrated")
        ) {
          eventLog.push("datasets hydrated");
        }
        return true;
      },
    }),
    configurable: true,
    enumerable: true,
  });

  const document = {
    body,
    getElementById(id) {
      if (id === "page-root") {
        return pageRootPresent ? root : null;
      }
      return null;
    },
  };

  const runtimeWindow = {
    __PAGE_CONTEXT__: {
      key: contextKey,
      family: registryPayload[contextKey]?.family || "unknown",
      ...(routePageFile ? { routePageFile } : {}),
    },
    location: { pathname },
    recordPartialScript(grupo) {
      eventLog.push("partial script executed");
      assert.equal(body.dataset.defaultGrupo, grupo);
    },
    initGuiaTemplateShell() {
      templateInitCalls += 1;
      eventLog.push("initGuiaTemplateShell");
      assert.ok(eventLog.includes("datasets hydrated"));
    },
    initInduccion() {
      pageBootCalls += 1;
      eventLog.push("initInduccion");
      assert.ok(eventLog.includes("initGuiaTemplateShell"));
    },
    initGuia2() {
      pageBootCalls += 1;
      eventLog.push("initGuia2");
      assert.ok(eventLog.includes("initGuiaTemplateShell"));
    },
    initGuia5() {
      pageBootCalls += 1;
      eventLog.push("initGuia5");
      assert.ok(eventLog.includes("initGuiaTemplateShell"));
    },
    initGuia6() {
      pageBootCalls += 1;
      eventLog.push("initGuia6");
      assert.ok(eventLog.includes("initGuiaTemplateShell"));
    },
    console: consoleStub,
  };
  if (bundledContexts) {
    runtimeWindow.__PAGE_RUNTIME_CONTEXTS__ = bundledContexts;
  }
  if (bundledPartials) {
    runtimeWindow.__PAGE_RUNTIME_PARTIALS__ = bundledPartials;
  }

  async function fetchStub(url) {
    fetchLog.push(url);
    if (url === "data/page_runtime_contexts.json") {
      return {
        ok: registryOk,
        async json() {
          return registryPayload;
        },
      };
    }

    const context = registryPayload[contextKey];
    if (context && url === context.partialPath) {
      return {
        ok: partialOk,
        async text() {
          return partialHtml;
        },
      };
    }

    throw new Error("Unexpected fetch: " + url);
  }

  const sandbox = {
    window: runtimeWindow,
    document,
    fetch: fetchStub,
    console: consoleStub,
    Promise,
    setTimeout,
    clearTimeout,
  };

  const evalStub = function (code) {
    return vm.runInNewContext(String(code), sandbox, {
      filename: "page_runtime_loader.inline.js",
    });
  };
  sandbox.eval = evalStub;
  runtimeWindow.eval = evalStub;

  return {
    body,
    eventLog,
    fetchLog,
    loaderSource,
    root,
    runtimeWindow,
    sandbox,
    getCounts() {
      return { templateInitCalls, pageBootCalls };
    },
  };
}

async function runLoader(options) {
  const harness = createHarness(options);
  vm.runInNewContext(harness.loaderSource, harness.sandbox, {
    filename: "page_runtime_loader.js",
  });
  await harness.runtimeWindow.__pageRuntimePromise;
  return harness;
}

test("page runtime contexts expose the approved guide families", () => {
  const contexts = JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));

  assert.deepEqual(Object.keys(contexts).sort(), Object.keys(EXPECTED_CONTEXTS).sort());
  assert.deepEqual(contexts["jfk-induccion-10a"], EXPECTED_CONTEXTS["jfk-induccion-10a"]);
  assert.deepEqual(contexts["jfk-guia2-10b"], EXPECTED_CONTEXTS["jfk-guia2-10b"]);
  assert.deepEqual(contexts["sb-guia6-11b"], EXPECTED_CONTEXTS["sb-guia6-11b"]);
});

test("generic runtime loader injects the partial and boots the configured page hook", async () => {
  const harness = await runLoader({
    contextKey: "jfk-guia2-10a",
    pathname: "/grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  });
  const counts = harness.getCounts();

  assert.deepEqual(harness.eventLog, [
    "root injected",
    "datasets hydrated",
    "initGuiaTemplateShell",
    "initGuia2",
  ]);
  assert.match(harness.root.innerHTML, /runtime-fragment/);
  assert.equal(harness.body.dataset.defaultInst, "Institucion Educativa Jhon F. Kennedy");
  assert.equal(harness.body.dataset.defaultGrupo, "10A");
  assert.equal(harness.body.dataset.defaultFicha, "3441939");
  assert.equal(counts.templateInitCalls, 1);
  assert.equal(counts.pageBootCalls, 1);
  assert.equal(harness.fetchLog[0], "data/page_runtime_contexts.json");
  assert.equal(harness.fetchLog[1], "partials/guia-02-herramientas-content.html");
});

test("generic runtime loader can boot from bundled data for local file navigation", async () => {
  const harness = await runLoader({
    contextKey: "jfk-guia2-10a",
    pathname: "/grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    bundledContexts: EXPECTED_CONTEXTS,
    bundledPartials: {
      "partials/guia-02-herramientas-content.html": SHARED_HTML,
    },
  });

  assert.match(harness.root.innerHTML, /runtime-fragment/);
  assert.deepEqual(harness.fetchLog, []);
  assert.equal(harness.getCounts().templateInitCalls, 1);
  assert.equal(harness.getCounts().pageBootCalls, 1);
});

test("generic runtime loader accepts legacy short bundled partial keys on routed guia.html", async () => {
  const harness = await runLoader({
    contextKey: "jfk-induccion-10a",
    pathname: "/guia.html",
    routePageFile: "guia.html",
    bundledContexts: EXPECTED_CONTEXTS,
    bundledPartials: {
      "guia-01-induccion-content": SHARED_HTML,
    },
  });

  assert.match(harness.root.innerHTML, /runtime-fragment/);
  assert.deepEqual(harness.fetchLog, []);
  assert.equal(harness.getCounts().templateInitCalls, 1);
  assert.equal(harness.getCounts().pageBootCalls, 1);
});

test("generic runtime loader executes inline scripts from the injected partial before booting", async () => {
  const harness = await runLoader({
    contextKey: "jfk-guia2-10a",
    pathname: "/grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    partialHtml: SHARED_HTML_WITH_INLINE_SCRIPT,
  });

  assert.deepEqual(harness.eventLog, [
    "root injected",
    "datasets hydrated",
    "partial script executed",
    "initGuiaTemplateShell",
    "initGuia2",
  ]);
});

test("generic runtime loader renders an error card for page mismatches", async () => {
  const harness = await runLoader({
    contextKey: "sb-guia5-11a",
    pathname: "/grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  });

  assert.match(harness.root.innerHTML, /No fue posible cargar esta pagina/i);
});

test("generic runtime loader tolerates missing page root without crashing the harness", async () => {
  const harness = await runLoader({
    pageRootPresent: false,
  });

  assert.equal(harness.getCounts().templateInitCalls, 0);
  assert.equal(harness.getCounts().pageBootCalls, 0);
});
