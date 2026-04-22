const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("el script del quiz carga y registra el bootstrap sin romperse al iniciar", () => {
  const scriptSource = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_redes_quiz.js"),
    "utf8"
  );

  const listeners = {};
  const context = {
    console,
    Math,
    JSON,
    Date,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    window: {
      portalAuth: null,
    },
    document: {
      body: {
        dataset: {
          quizCloudFile: "sb_10a_redes.html",
          quizPageFile: "santa-barbara-10a-guia-02-redes-rap01.html",
        },
      },
      visibilityState: "visible",
      getElementById() {
        return null;
      },
      addEventListener(name, handler) {
        listeners[name] = handler;
      },
    },
  };

  assert.doesNotThrow(() => {
    vm.runInNewContext(scriptSource, context, { filename: "script_redes_quiz.js" });
  });
  assert.equal(typeof listeners.DOMContentLoaded, "function");
});
