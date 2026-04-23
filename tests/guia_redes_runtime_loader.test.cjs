const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");
const CONTEXT_FILE = path.join(REPO_ROOT, "data", "guide_contexts.json");
const LOADER_FILE = path.join(REPO_ROOT, "js", "guide_runtime_loader.js");

test("guide contexts expose the two Santa Barbara runtime entries", () => {
  const contexts = JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf8"));

  assert.deepEqual(Object.keys(contexts).sort(), ["sb-redes-10a", "sb-redes-10b"]);
  assert.equal(contexts["sb-redes-10a"].pageFile, "santa-barbara-10a-guia-02-redes-rap01.html");
  assert.equal(contexts["sb-redes-10a"].partialPath, "partials/guia-redes-rap01-content.html");
  assert.equal(contexts["sb-redes-10a"].quizRedesUrl, "santa-barbara-10a-guia-02-redes-rap01-quiz.html");
  assert.equal(contexts["sb-redes-10b"].pageFile, "santa-barbara-10b-guia-02-redes-rap01.html");
  assert.equal(contexts["sb-redes-10b"].quizIpUrl, "santa-barbara-10b-guia-02-redes-ip-quiz.html");
});

test("runtime loader injects the shared guide and boots both init hooks", async () => {
  const loaderSource = fs.readFileSync(LOADER_FILE, "utf8");
  const root = { innerHTML: "" };
  const quizRedesLink = {
    href: "",
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const quizIpLink = {
    href: "",
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const body = { dataset: {} };
  let templateInitCalls = 0;
  let guideInitCalls = 0;

  const document = {
    body,
    getElementById(id) {
      if (id === "guide-root") return root;
      if (id === "quizRedesActionLink") return quizRedesLink;
      if (id === "quizIPActionLink") return quizIpLink;
      return null;
    },
  };

  const contextPayload = {
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
  };

  const runtimeWindow = {
    __GUIDE_CONTEXT__: { key: "sb-redes-10a", template: "guia-redes-rap01" },
    location: { pathname: "/santa-barbara-10a-guia-02-redes-rap01.html" },
    initGuiaTemplateShell() {
      templateInitCalls += 1;
    },
    initGuiaRedes() {
      guideInitCalls += 1;
    },
    console,
  };

  async function fetchStub(url) {
    if (url === "data/guide_contexts.json") {
      return {
        ok: true,
        async json() {
          return contextPayload;
        },
      };
    }
    if (url === "partials/guia-redes-rap01-content.html") {
      return {
        ok: true,
        async text() {
          return '<div class="guide-shell-fragment"><a id="quizRedesActionLink"></a><a id="quizIPActionLink"></a></div>';
        },
      };
    }
    throw new Error("Unexpected fetch: " + url);
  }

  const sandbox = {
    window: runtimeWindow,
    document,
    fetch: fetchStub,
    console,
    Promise,
    setTimeout,
    clearTimeout,
  };

  vm.runInNewContext(loaderSource, sandbox, { filename: "guide_runtime_loader.js" });
  await runtimeWindow.__guideRuntimePromise;

  assert.match(root.innerHTML, /guide-shell-fragment/);
  assert.equal(body.dataset.defaultInst, "Institucion Educativa Santa Barbara");
  assert.equal(body.dataset.defaultGrupo, "10A");
  assert.equal(body.dataset.defaultFicha, "3441944");
  assert.equal(quizRedesLink.href, "santa-barbara-10a-guia-02-redes-rap01-quiz.html");
  assert.equal(quizIpLink.href, "santa-barbara-10a-guia-02-redes-ip-quiz.html");
  assert.equal(templateInitCalls, 1);
  assert.equal(guideInitCalls, 1);
});
