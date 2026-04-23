const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");
const CONTEXT_FILE = path.join(REPO_ROOT, "data", "guide_contexts.json");
const LOADER_FILE = path.join(REPO_ROOT, "js", "guide_runtime_loader.js");

const SHARED_HTML =
  '<div class="guide-shell-fragment"><a id="quizRedesActionLink"></a><a id="quizIPActionLink"></a></div>';

const EXPECTED_CONTEXTS = {
  "sb-redes-10a": {
    template: "guia-redes-rap01",
    partialPath: "partials/guia-redes-rap01-content.html",
    pageFile: "santa-barbara-10a-guia-02-redes-rap01.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "10A",
    ficha: "3441944",
    cloudFileName: "sb_10a_redes.html",
    quizRedesUrl: "santa-barbara-10a-guia-02-redes-rap01-quiz.html",
    quizIpUrl: "santa-barbara-10a-guia-02-redes-ip-quiz.html",
  },
  "sb-redes-10b": {
    template: "guia-redes-rap01",
    partialPath: "partials/guia-redes-rap01-content.html",
    pageFile: "santa-barbara-10b-guia-02-redes-rap01.html",
    inst: "Institucion Educativa Santa Barbara",
    grupo: "10B",
    ficha: "3441950",
    cloudFileName: "sb_10b_redes.html",
    quizRedesUrl: "santa-barbara-10b-guia-02-redes-rap01-quiz.html",
    quizIpUrl: "santa-barbara-10b-guia-02-redes-ip-quiz.html",
  },
};

function createHarness({
  contextKey = "sb-redes-10a",
  pathname = "/santa-barbara-10a-guia-02-redes-rap01.html",
  registryOk = true,
  partialOk = true,
  registryPayload = EXPECTED_CONTEXTS,
  partialHtml = SHARED_HTML,
  guideRootPresent = true,
} = {}) {
  const loaderSource = fs.readFileSync(LOADER_FILE, "utf8");
  const eventLog = [];
  const lookupLog = [];
  const fetchLog = [];
  const testConsole = {
    error() {},
    info() {},
    log() {},
    warn() {},
  };

  let datasetsHydrated = false;
  let linksHydrated = false;
  let templateInitCalls = 0;
  let guideInitCalls = 0;

  const rootState = { html: "" };
  const root = {};
  Object.defineProperty(root, "innerHTML", {
    get() {
      return rootState.html;
    },
    set(value) {
      rootState.html = String(value);
      eventLog.push("root.innerHTML injected");
    },
    enumerable: true,
    configurable: true,
  });

  const datasetBacking = {};
  const body = {};
  Object.defineProperty(body, "dataset", {
    value: new Proxy(datasetBacking, {
      set(target, prop, value) {
        target[prop] = value;
        if (
          !datasetsHydrated &&
          target.defaultInst !== undefined &&
          target.defaultGrupo !== undefined &&
          target.defaultFicha !== undefined
        ) {
          datasetsHydrated = true;
          eventLog.push("datasets hydrated");
        }
        return true;
      },
    }),
    enumerable: true,
    configurable: true,
  });

  const quizRedesLink = {
    href: "",
    setAttribute(name, value) {
      this[name] = value;
      if (!linksHydrated && this.href && quizIpLink.href) {
        linksHydrated = true;
        eventLog.push("links hydrated");
      }
    },
  };
  const quizIpLink = {
    href: "",
    setAttribute(name, value) {
      this[name] = value;
      if (!linksHydrated && quizRedesLink.href && this.href) {
        linksHydrated = true;
        eventLog.push("links hydrated");
      }
    },
  };

  const document = {
    body,
    getElementById(id) {
      if (id === "guide-root") {
        return guideRootPresent ? root : null;
      }
      if (id === "quizRedesActionLink") {
        lookupLog.push({ id, rootReady: rootState.html.length > 0 });
        assert.ok(rootState.html.length > 0, "quizRedesActionLink should only be queried after root markup is injected");
        return quizRedesLink;
      }
      if (id === "quizIPActionLink") {
        lookupLog.push({ id, rootReady: rootState.html.length > 0 });
        assert.ok(rootState.html.length > 0, "quizIPActionLink should only be queried after root markup is injected");
        return quizIpLink;
      }
      return null;
    },
  };

  const runtimeWindow = {
    __GUIDE_CONTEXT__: { key: contextKey, template: "guia-redes-rap01" },
    location: { pathname },
    initGuiaTemplateShell() {
      templateInitCalls += 1;
      eventLog.push("initGuiaTemplateShell");
      assert.ok(datasetsHydrated, "template init should run after datasets are hydrated");
      assert.ok(linksHydrated, "template init should run after links are hydrated");
    },
    initGuiaRedes() {
      guideInitCalls += 1;
      eventLog.push("initGuiaRedes");
      assert.ok(
        eventLog.includes("initGuiaTemplateShell"),
        "guide init should run after template init"
      );
      assert.ok(datasetsHydrated, "guide init should run after datasets are hydrated");
      assert.ok(linksHydrated, "guide init should run after links are hydrated");
    },
    console: testConsole,
  };

  async function fetchStub(url) {
    fetchLog.push(url);
    if (url === "data/guide_contexts.json") {
      return {
        ok: registryOk,
        async json() {
          return registryPayload;
        },
      };
    }
    if (url === "partials/guia-redes-rap01-content.html") {
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
    console: testConsole,
    Promise,
    setTimeout,
    clearTimeout,
  };

  return {
    body,
    document,
    eventLog,
    fetchLog,
    guideIpLink: quizIpLink,
    guideRootPresent,
    guideRootState: rootState,
    lookupLog,
    loaderSource,
    quizIpLink,
    quizRedesLink,
    root,
    runtimeWindow,
    sandbox,
    getCounts() {
      return { templateInitCalls, guideInitCalls };
    },
  };
}

async function runLoader(options) {
  const harness = createHarness(options);
  vm.runInNewContext(harness.loaderSource, harness.sandbox, {
    filename: "guide_runtime_loader.js",
  });
  await harness.runtimeWindow.__guideRuntimePromise;
  return harness;
}

test("guide contexts expose the two Santa Barbara runtime entries", () => {
  const contexts = JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));

  assert.deepEqual(Object.keys(contexts).sort(), ["sb-redes-10a", "sb-redes-10b"]);
  assert.deepEqual(contexts["sb-redes-10a"], EXPECTED_CONTEXTS["sb-redes-10a"]);
  assert.deepEqual(contexts["sb-redes-10b"], EXPECTED_CONTEXTS["sb-redes-10b"]);
});

test("runtime loader injects the shared guide and boots both init hooks in order", async () => {
  const harness = await runLoader();
  const counts = harness.getCounts();

  assert.deepEqual(harness.eventLog, [
    "root.innerHTML injected",
    "datasets hydrated",
    "links hydrated",
    "initGuiaTemplateShell",
    "initGuiaRedes",
  ]);
  assert.match(harness.root.innerHTML, /guide-shell-fragment/);
  assert.deepEqual(harness.runtimeWindow.__GUIDE_RUNTIME_CONTEXT__, EXPECTED_CONTEXTS["sb-redes-10a"]);
  assert.equal(harness.body.dataset.defaultInst, "Institucion Educativa Santa Barbara");
  assert.equal(harness.body.dataset.defaultGrupo, "10A");
  assert.equal(harness.body.dataset.defaultFicha, "3441944");
  assert.equal(harness.quizRedesLink.href, "santa-barbara-10a-guia-02-redes-rap01-quiz.html");
  assert.equal(harness.quizIpLink.href, "santa-barbara-10a-guia-02-redes-ip-quiz.html");
  assert.equal(counts.templateInitCalls, 1);
  assert.equal(counts.guideInitCalls, 1);
  assert.deepEqual(harness.lookupLog, [
    { id: "quizRedesActionLink", rootReady: true },
    { id: "quizIPActionLink", rootReady: true },
  ]);
  assert.equal(harness.fetchLog[0], "data/guide_contexts.json");
  assert.equal(harness.fetchLog[1], "partials/guia-redes-rap01-content.html");
});

test("runtime loader handles a missing guide root guard cleanly", async () => {
  const harness = await runLoader({ guideRootPresent: false });
  const counts = harness.getCounts();

  assert.deepEqual(harness.eventLog, []);
  assert.equal(harness.runtimeWindow.__GUIDE_RUNTIME_CONTEXT__, undefined);
  assert.equal(counts.templateInitCalls, 0);
  assert.equal(counts.guideInitCalls, 0);
  assert.deepEqual(harness.fetchLog, []);
});

for (const scenario of [
  {
    name: "unknown context key",
    options: { contextKey: "missing-context" },
  },
  {
    name: "pageFile mismatch",
    options: {
      pathname: "/santa-barbara-10a-guia-02-redes-ip-quiz.html",
    },
  },
  {
    name: "registry fetch failure",
    options: { registryOk: false },
  },
  {
    name: "partial fetch failure",
    options: { partialOk: false },
  },
]) {
  test(`runtime loader renders an error card for ${scenario.name}`, async () => {
    const harness = await runLoader(scenario.options);
    const counts = harness.getCounts();

    assert.match(harness.root.innerHTML, /info-box red/);
    assert.doesNotMatch(harness.root.innerHTML, /guide-shell-fragment/);
    assert.equal(harness.runtimeWindow.__GUIDE_RUNTIME_CONTEXT__, undefined);
    assert.equal(counts.templateInitCalls, 0);
    assert.equal(counts.guideInitCalls, 0);
  });
}
