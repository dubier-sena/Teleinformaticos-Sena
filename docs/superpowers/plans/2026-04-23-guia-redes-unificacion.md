# Guia 2 Redes HTML Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated 10A/10B HTML bodies for Guia 2 Redes with one shared partial plus thin wrappers, without breaking current URLs, portal auth, progress UI, or guide persistence.

**Architecture:** Keep `santa-barbara-10a-guia-02-redes-rap01.html` and `santa-barbara-10b-guia-02-redes-rap01.html` as published entrypoints, but reduce them to wrapper pages that declare a public context key and a runtime root. A new runtime loader will fetch one shared HTML partial and one public context JSON, inject the guide body, hydrate group-specific links and datasets, and then call explicit init hooks in `js/guia_template.js` and `js/script_guia_redes.js`.

**Tech Stack:** Static HTML, vanilla JavaScript, existing `portal_auth` and `firebase_db` integrations, GitHub Pages, `node:test`, PowerShell, Git worktrees.

---

## File Map

- `data/guide_contexts.json`
  Public registry for the pilot contexts `sb-redes-10a` and `sb-redes-10b`. Each entry owns `template`, `partialPath`, `pageFile`, `inst`, `grupo`, `ficha`, `cloudFileName`, `quizRedesUrl`, and `quizIpUrl`.

- `partials/guia-redes-rap01-content.html`
  Single source of truth for the Guia 2 Redes body markup. This file will contain everything that is currently inside the two `<body>` tags, including the shared shell, activities, labs, glossary, evidence table, and support panels.

- `js/guide_runtime_loader.js`
  Runtime bootstrapper. Responsibilities: read `window.__GUIDE_CONTEXT__`, load `data/guide_contexts.json`, validate the wrapper page matches the selected context, fetch `partials/guia-redes-rap01-content.html`, inject it into `#guide-root`, set `document.body.dataset.defaultInst/defaultGrupo/defaultFicha`, fill the quiz links, and call `window.initGuiaTemplateShell()` plus `window.initGuiaRedes()`.

- `js/guia_template.js`
  Shared guide-shell controller. This file must expose an idempotent `window.initGuiaTemplateShell` so the loader can initialize sidebar, reveal animations, activity checks, and cloud UI sync after the shared partial exists in the DOM.

- `js/script_guia_redes.js`
  Guide-specific controller for Guia 2 Redes. This file must expose an idempotent `window.initGuiaRedes` so the loader can initialize evidence tables, support materials, progress, locks, and cloud sync after the shared partial exists in the DOM.

- `santa-barbara-10a-guia-02-redes-rap01.html`
  Thin wrapper for the 10A published URL. It keeps the existing CSP, metadata, script includes, and title/description, but its body becomes only the runtime root and the `window.__GUIDE_CONTEXT__` declaration for `sb-redes-10a`.

- `santa-barbara-10b-guia-02-redes-rap01.html`
  Thin wrapper for the 10B published URL. Same structure as 10A, but with the `sb-redes-10b` context key and the 10B metadata.

- `tests/guia_redes_runtime_loader.test.cjs`
  New runtime-loader regression coverage. This file will verify the public context registry and the loader bootstrap behavior using a small `vm` sandbox and fetch stubs.

- `tests/guia_template_runtime_boot.test.cjs`
  New regression test to guarantee `js/guia_template.js` exposes the explicit runtime init hook and does not auto-boot when `window.__GUIDE_CONTEXT__` is present.

- `tests/script_guia_redes_runtime_boot.test.cjs`
  New regression test to guarantee `js/script_guia_redes.js` exposes the explicit runtime init hook and does not auto-boot when `window.__GUIDE_CONTEXT__` is present.

- `tests/redes_taller_ej1_button.test.cjs`
- `tests/redes_lab1_transferencia.test.cjs`
- `tests/redes_lab2_arbol.test.cjs`
- `tests/redes_lab3_hibrida.test.cjs`
  Existing HTML-content tests that currently read the two full wrappers. These must be moved to read the shared partial instead, while still asserting that the wrappers remain valid runtime shells.

- `js/admin_usuarios.js`
  No code change expected in this pilot. Wrapper filenames stay the same, so the current admin-to-guide mappings should remain valid. Verify this by leaving the constants untouched and keeping the existing guide file names.

- `js/portal_auth.js`
  No code change expected in this pilot. Existing file-level guards should continue to protect the published 10A/10B wrapper URLs because their filenames do not change.

## Task 0: Preflight In A Clean Worktree

**Files:**
- Create: none
- Modify: none
- Test: existing guide regression suite only

- [ ] **Step 1: Create a dedicated worktree for the pilot**

Run:

```powershell
git worktree add -b codex/guia-redes-unificacion ..\HTML-guia-redes-unificacion HEAD
```

Expected: a new sibling folder `..\HTML-guia-redes-unificacion` is created on branch `codex/guia-redes-unificacion`.

- [ ] **Step 2: Verify the worktree starts clean**

Run:

```powershell
git -C ..\HTML-guia-redes-unificacion status --short
```

Expected: no output.

- [ ] **Step 3: Freeze the current guide behavior before refactoring**

Run from `..\HTML-guia-redes-unificacion`:

```powershell
node --test tests\redes_taller_ej1_button.test.cjs tests\redes_lab1_transferencia.test.cjs tests\redes_lab2_arbol.test.cjs tests\redes_lab3_hibrida.test.cjs
```

Expected: all four test files PASS. This is the baseline that the shared partial must preserve.

## Task 1: Add The Public Context Registry And Runtime Loader

**Files:**
- Create: `data/guide_contexts.json`
- Create: `js/guide_runtime_loader.js`
- Create: `tests/guia_redes_runtime_loader.test.cjs`
- Test: `tests/guia_redes_runtime_loader.test.cjs`

- [ ] **Step 1: Write the failing runtime-loader regression test**

Create `tests/guia_redes_runtime_loader.test.cjs` with this content:

```js
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
```

- [ ] **Step 2: Run the new test and verify it fails before implementation**

Run:

```powershell
node --test tests\guia_redes_runtime_loader.test.cjs
```

Expected: FAIL with `ENOENT` for `data\guide_contexts.json` and `js\guide_runtime_loader.js`.

- [ ] **Step 3: Create the public context registry**

Create `data/guide_contexts.json` with this exact shape:

```json
{
  "sb-redes-10a": {
    "template": "guia-redes-rap01",
    "partialPath": "partials/guia-redes-rap01-content.html",
    "pageFile": "santa-barbara-10a-guia-02-redes-rap01.html",
    "inst": "Institucion Educativa Santa Barbara",
    "grupo": "10A",
    "ficha": "3441944",
    "cloudFileName": "sb_10a_redes.html",
    "quizRedesUrl": "santa-barbara-10a-guia-02-redes-rap01-quiz.html",
    "quizIpUrl": "santa-barbara-10a-guia-02-redes-ip-quiz.html"
  },
  "sb-redes-10b": {
    "template": "guia-redes-rap01",
    "partialPath": "partials/guia-redes-rap01-content.html",
    "pageFile": "santa-barbara-10b-guia-02-redes-rap01.html",
    "inst": "Institucion Educativa Santa Barbara",
    "grupo": "10B",
    "ficha": "3441950",
    "cloudFileName": "sb_10b_redes.html",
    "quizRedesUrl": "santa-barbara-10b-guia-02-redes-rap01-quiz.html",
    "quizIpUrl": "santa-barbara-10b-guia-02-redes-ip-quiz.html"
  }
}
```

- [ ] **Step 4: Implement the runtime loader**

Create `js/guide_runtime_loader.js` with this runtime contract:

```js
(function () {
  const runtimeRequest = window.__GUIDE_CONTEXT__ || null;

  function currentPageFile() {
    return window.location.pathname.split("/").pop() || "guia.html";
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("No se pudo cargar " + url);
    }
    return response.json();
  }

  async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("No se pudo cargar " + url);
    }
    return response.text();
  }

  function setContextDatasets(context) {
    document.body.dataset.defaultInst = context.inst || "";
    document.body.dataset.defaultGrupo = context.grupo || "";
    document.body.dataset.defaultFicha = context.ficha || "";
  }

  function setContextLinks(context) {
    const quizRedesLink = document.getElementById("quizRedesActionLink");
    const quizIpLink = document.getElementById("quizIPActionLink");
    if (quizRedesLink && context.quizRedesUrl) {
      quizRedesLink.setAttribute("href", context.quizRedesUrl);
    }
    if (quizIpLink && context.quizIpUrl) {
      quizIpLink.setAttribute("href", context.quizIpUrl);
    }
  }

  function showRuntimeError(message) {
    const root = document.getElementById("guide-root");
    if (!root) return;
    root.innerHTML = '<section class="card"><div class="info-box red">' + message + "</div></section>";
  }

  async function bootstrapGuideRuntime() {
    if (!runtimeRequest) {
      return;
    }

    const root = document.getElementById("guide-root");
    if (!root) {
      throw new Error("No existe #guide-root para cargar la guia.");
    }

    const contexts = await fetchJson("data/guide_contexts.json");
    const context = contexts[runtimeRequest.key];
    if (!context) {
      throw new Error("No existe el contexto " + runtimeRequest.key + ".");
    }

    if (context.pageFile !== currentPageFile()) {
      throw new Error("El wrapper no coincide con el contexto solicitado.");
    }

    const html = await fetchText(context.partialPath);
    root.innerHTML = html;
    window.__GUIDE_RUNTIME_CONTEXT__ = context;
    setContextDatasets(context);
    setContextLinks(context);

    if (typeof window.initGuiaTemplateShell === "function") {
      window.initGuiaTemplateShell();
    }
    if (typeof window.initGuiaRedes === "function") {
      window.initGuiaRedes();
    }
  }

  window.__guideRuntimePromise = bootstrapGuideRuntime().catch(function (error) {
    console.error("[guide_runtime_loader]", error);
    showRuntimeError("No fue posible cargar esta guia. Recarga la pagina o vuelve a entrar desde el portal.");
  });
})();
```

- [ ] **Step 5: Run the runtime-loader test and verify it passes**

Run:

```powershell
node --test tests\guia_redes_runtime_loader.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit the loader foundation**

Run:

```powershell
git add data\guide_contexts.json js\guide_runtime_loader.js tests\guia_redes_runtime_loader.test.cjs
git commit -m "feat: add runtime loader for guia redes wrappers"
```

Expected: one commit containing the public context registry, runtime loader, and its regression test.

## Task 2: Refactor `js/guia_template.js` For Runtime Boot

**Files:**
- Create: `tests/guia_template_runtime_boot.test.cjs`
- Modify: `js/guia_template.js`
- Test: `tests/guia_template_runtime_boot.test.cjs`

- [ ] **Step 1: Write the failing guard test for `js/guia_template.js`**

Create `tests/guia_template_runtime_boot.test.cjs` with this content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "guia_template.js"),
  "utf8"
);

test("guia_template exposes an idempotent runtime init hook", () => {
  assert.match(script, /let guideTemplateBooted = false/);
  assert.match(script, /function initGuiaTemplateShell\(\)/);
  assert.match(script, /if \(guideTemplateBooted\) \{\s*return;\s*\}/s);
  assert.match(script, /window\.initGuiaTemplateShell = initGuiaTemplateShell/);
});

test("guia_template keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__GUIDE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuiaTemplateShell\);\s*\}/s
  );
});
```

- [ ] **Step 2: Run the new guard test and verify it fails**

Run:

```powershell
node --test tests\guia_template_runtime_boot.test.cjs
```

Expected: FAIL because `js/guia_template.js` still initializes immediately and does not expose `window.initGuiaTemplateShell`.

- [ ] **Step 3: Refactor `js/guia_template.js` to expose an explicit runtime init hook**

Replace the current eager boot section with this structure:

```js
  let guideTemplateBooted = false;

  function initGuiaTemplateShell() {
    if (guideTemplateBooted) {
      applySelection(currentSelection());
      updateActivityNavDone();
      notifyGuideProgressChanged();
      applyResponsiveSidebarState();
      return;
    }

    guideTemplateBooted = true;
    ensureGuideRevealShell();
    initCollapsibleState();
    initActivityChecks();
    initializeGuideUiCloudSync();
    applySelection(currentSelection());
    bindSidebarLinks();
    updateActivityNavDone();
    notifyGuideProgressChanged();
    applyResponsiveSidebarState();
  }

  window.initGuiaTemplateShell = initGuiaTemplateShell;

  if (!window.__GUIDE_CONTEXT__) {
    document.addEventListener("DOMContentLoaded", initGuiaTemplateShell);
  }
```

Keep the `pagehide`, `beforeunload`, `visibilitychange`, and `resize` listeners outside the guard exactly as they are today.

- [ ] **Step 4: Run the guide-template boot test and verify it passes**

Run:

```powershell
node --test tests\guia_template_runtime_boot.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit the guide-template runtime hook**

Run:

```powershell
git add js\guia_template.js tests\guia_template_runtime_boot.test.cjs
git commit -m "refactor: add runtime boot hook for guia template"
```

Expected: one commit exposing `window.initGuiaTemplateShell` with idempotent boot behavior.

## Task 3: Refactor `js/script_guia_redes.js` For Runtime Boot

**Files:**
- Create: `tests/script_guia_redes_runtime_boot.test.cjs`
- Modify: `js/script_guia_redes.js`
- Test: `tests/script_guia_redes_runtime_boot.test.cjs`

- [ ] **Step 1: Write the failing guard test for `js/script_guia_redes.js`**

Create `tests/script_guia_redes_runtime_boot.test.cjs` with this content:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const script = fs.readFileSync(
  path.join(__dirname, "..", "js", "script_guia_redes.js"),
  "utf8"
);

test("script_guia_redes exposes an idempotent runtime init hook", () => {
  assert.match(script, /let redesBooted = false/);
  assert.match(script, /function initGuiaRedes\(\)/);
  assert.match(script, /window\.initGuiaRedes = initGuiaRedes/);
  assert.match(script, /renderEvidenceTable\(\)/);
  assert.match(script, /renderQuizRedesStatus\(\)/);
  assert.match(script, /bindEventsRedes\(\)/);
  assert.match(script, /initCloudSyncRedes\(\)/);
});

test("script_guia_redes keeps DOMContentLoaded boot only for non-runtime pages", () => {
  assert.match(
    script,
    /if \(!window\.__GUIDE_CONTEXT__\) \{\s*document\.addEventListener\("DOMContentLoaded", initGuiaRedes\);\s*\}/s
  );
});
```

- [ ] **Step 2: Run the new guard test and verify it fails**

Run:

```powershell
node --test tests\script_guia_redes_runtime_boot.test.cjs
```

Expected: FAIL because `js/script_guia_redes.js` still boots directly inside `DOMContentLoaded`.

- [ ] **Step 3: Refactor `js/script_guia_redes.js` to expose an explicit runtime init hook**

Replace the current init block at the bottom with this shape:

```js
let redesBooted = false;

function initGuiaRedes() {
  if (redesBooted) {
    updateProgressRedes();
    return;
  }

  redesBooted = true;
  state = loadStateRedes();
  renderEvidenceTable();
  renderQuizRedesStatus();
  renderGlossary();
  renderSupportMaterialsRedes();
  renderTopbarCampus();
  hydrateFieldsRedes();
  bindEventsRedes();
  updateProgressRedes();
  initCloudSyncRedes();
}

window.initGuiaRedes = initGuiaRedes;

if (!window.__GUIDE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initGuiaRedes);
}
```

Do not change `PAGE_FILE_REDES`, `STORAGE_FILE_ALIASES_REDES`, or any of the current guide storage/file-name logic. This pilot keeps the wrapper filenames unchanged on purpose so storage and admin mappings remain stable.

- [ ] **Step 4: Run the guide boot test and verify it passes**

Run:

```powershell
node --test tests\script_guia_redes_runtime_boot.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit the guide runtime hook**

Run:

```powershell
git add js\script_guia_redes.js tests\script_guia_redes_runtime_boot.test.cjs
git commit -m "refactor: add runtime boot hook for guia redes"
```

Expected: one commit exposing `window.initGuiaRedes` while preserving the current storage and cloud-sync behavior.

## Task 4: Extract The Shared Partial, Slim The Wrappers, And Move HTML Tests To The Partial

**Files:**
- Create: `partials/guia-redes-rap01-content.html`
- Modify: `santa-barbara-10a-guia-02-redes-rap01.html`
- Modify: `santa-barbara-10b-guia-02-redes-rap01.html`
- Modify: `tests/redes_taller_ej1_button.test.cjs`
- Modify: `tests/redes_lab1_transferencia.test.cjs`
- Modify: `tests/redes_lab2_arbol.test.cjs`
- Modify: `tests/redes_lab3_hibrida.test.cjs`
- Test: `tests/guia_redes_runtime_loader.test.cjs`
- Test: `tests/redes_taller_ej1_button.test.cjs`
- Test: `tests/redes_lab1_transferencia.test.cjs`
- Test: `tests/redes_lab2_arbol.test.cjs`
- Test: `tests/redes_lab3_hibrida.test.cjs`

- [ ] **Step 1: Update the affected HTML-content tests to read the shared partial**

Move the guide-markup assertions from the wrappers to `partials/guia-redes-rap01-content.html`.

In `tests/redes_taller_ej1_button.test.cjs`, replace the wrapper HTML reads with this pattern:

```js
const WRAPPER_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];
const SHARED_HTML = fs.readFileSync(
  path.join(__dirname, "..", "partials", "guia-redes-rap01-content.html"),
  "utf8"
);

test("el ejercicio 1 del taller IP incluye boton y estado de guardado en la guia compartida", () => {
  assert.match(SHARED_HTML, /id="btnGuardarTallerIPEj1"/);
  assert.match(SHARED_HTML, /onclick="guardarTallerIPEj1\(\)"/);
  assert.match(SHARED_HTML, /id="tallerIPEj1Status"/);
});

test("los wrappers de Guia 2 Redes siguen siendo shells validos", () => {
  WRAPPER_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
    assert.match(html, /window\.__GUIDE_CONTEXT__/);
    assert.match(html, /id="guide-root"/);
    assert.match(html, /guide_runtime_loader\.js/);
  });
});
```

Apply the same strategy to the lab tests:

- `tests/redes_lab1_transferencia.test.cjs`: read `SHARED_HTML` for `btnSubirLab1Ping1`, `btnGuardarLab1`, and the descriptive copy.
- `tests/redes_lab2_arbol.test.cjs`: compute `lab2ToLab3` from `SHARED_HTML.match(/<!-- LAB 2 -->([\s\S]*?)<!-- LAB 3 -->/)`.
- `tests/redes_lab3_hibrida.test.cjs`: read `SHARED_HTML` for `btnSubirLab3Topologia`, `btnGuardarLab3`, and the `3.4.3` copy.

- [ ] **Step 2: Run the migrated HTML tests and verify they fail before the partial exists**

Run:

```powershell
node --test tests\redes_taller_ej1_button.test.cjs tests\redes_lab1_transferencia.test.cjs tests\redes_lab2_arbol.test.cjs tests\redes_lab3_hibrida.test.cjs
```

Expected: FAIL with `ENOENT` for `partials\guia-redes-rap01-content.html`.

- [ ] **Step 3: Extract the current guide body into the shared partial**

Create `partials/guia-redes-rap01-content.html` by copying every node that currently lives inside the `<body>` of `santa-barbara-10a-guia-02-redes-rap01.html`, starting at:

```html
<button class="hamburger" onclick="toggleSidebar()" aria-label="Menu">&#9776;</button>
```

and ending at the final closing `</div>` before `</body>`.

Keep all existing IDs, inline handlers, comments, section anchors, and activity markup untouched. Make only these two link edits inside the shared partial:

```html
<a id="quizRedesActionLink" class="btn-drive" href="#">
  &#128218; Presentar quiz aleatorio
</a>

<a id="quizIPActionLink" class="btn-drive" href="#">
  &#128218; Presentar quiz aleatorio
</a>
```

Do not hardcode `10A` or `10B` quiz URLs in the shared partial. The loader owns those two `href` values.

- [ ] **Step 4: Replace each full guide page with a thin runtime wrapper**

Reduce `santa-barbara-10a-guia-02-redes-rap01.html` to the existing head metadata plus this wrapper contract:

```html
<script>
  window.__GUIDE_CONTEXT__ = { key: "sb-redes-10a", template: "guia-redes-rap01" };
</script>
<script defer src="js/portal_auth.js?v=20260422_2"></script>
<script src="js/firebase-config.js?v=20260414_1"></script>
<script defer src="js/firebase_db.js?v=20260422_2"></script>
<script defer src="js/shared_shell.js?v=20260412_2"></script>
<script defer src="js/project_integrations.js?v=20260411_1"></script>
<script defer src="js/shared_apps_script_delivery.js?v=20260411_1"></script>
<script defer src="js/shared_drive_delivery.js?v=20260410_2"></script>
<script defer src="data/calendario_2026_records.js?v=20260410_1"></script>
<script defer src="data/calendario_2026_seed.js?v=20260410_1"></script>
<script defer src="js/redes_lock_sync.js?v=20260422_2"></script>
<script defer src="js/guia_template.js?v=20260411_1"></script>
<script defer src="js/script_guia_redes.js?v=20260423_1"></script>
<script defer src="js/guide_runtime_loader.js?v=20260423_1"></script>
```

And this body:

```html
<body class="app-shell app-shell--guide" data-default-ficha="" data-default-inst="" data-default-grupo="">
  <div id="guide-root"></div>
  <noscript>Necesitas JavaScript para cargar esta guia.</noscript>
</body>
```

Apply the same wrapper structure to `santa-barbara-10b-guia-02-redes-rap01.html`, changing only:

```html
window.__GUIDE_CONTEXT__ = { key: "sb-redes-10b", template: "guia-redes-rap01" };
```

Keep each wrapper's current `<title>` and `<meta name="description">` group-specific.

- [ ] **Step 5: Run the shared-content and runtime-loader tests and verify they pass**

Run:

```powershell
node --test tests\guia_redes_runtime_loader.test.cjs tests\redes_taller_ej1_button.test.cjs tests\redes_lab1_transferencia.test.cjs tests\redes_lab2_arbol.test.cjs tests\redes_lab3_hibrida.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit the shared partial migration**

Run:

```powershell
git add partials\guia-redes-rap01-content.html santa-barbara-10a-guia-02-redes-rap01.html santa-barbara-10b-guia-02-redes-rap01.html tests\redes_taller_ej1_button.test.cjs tests\redes_lab1_transferencia.test.cjs tests\redes_lab2_arbol.test.cjs tests\redes_lab3_hibrida.test.cjs
git commit -m "refactor: unify guia redes markup behind runtime wrappers"
```

Expected: one commit that removes the duplicated body markup from the wrappers and moves HTML assertions to the shared partial.

## Task 5: Final Verification For The Pilot

**Files:**
- Create: none
- Modify: none
- Test: full targeted regression suite

- [ ] **Step 1: Run syntax checks on the three runtime-controlled scripts**

Run:

```powershell
node --check js\guide_runtime_loader.js
node --check js\guia_template.js
node --check js\script_guia_redes.js
```

Expected: all three commands exit cleanly with no output.

- [ ] **Step 2: Run the full targeted regression suite**

Run:

```powershell
node --test tests\guia_redes_runtime_loader.test.cjs tests\guia_template_runtime_boot.test.cjs tests\script_guia_redes_runtime_boot.test.cjs tests\redes_taller_ej1_button.test.cjs tests\redes_lab1_transferencia.test.cjs tests\redes_lab2_arbol.test.cjs tests\redes_lab3_hibrida.test.cjs tests\redes_lock_sync.test.cjs tests\script_redes_quiz_boot.test.cjs
```

Expected: PASS for every listed test file.

- [ ] **Step 3: Smoke-check both wrappers in the browser**

Verify manually:

```text
1. Open santa-barbara-10a-guia-02-redes-rap01.html as a 10A student and confirm the guide renders, progress appears, and both quiz buttons point to the 10A quiz URLs.
2. Open santa-barbara-10b-guia-02-redes-rap01.html as a 10B student and confirm the guide renders, progress appears, and both quiz buttons point to the 10B quiz URLs.
3. Open the 10B wrapper while logged in as a 10A student and confirm existing portal auth still blocks or redirects access.
```

Expected: render works for the matching group and access remains blocked for the wrong wrapper.

- [ ] **Step 4: Create the integration commit**

Run:

```powershell
git status --short
git commit --allow-empty -m "chore: verify guia redes runtime unification"
```

Expected: `git status --short` shows a clean tree, so the final command creates a verification marker commit only if the team wants a separate checkpoint. If the team does not want an empty verification commit, skip this step and keep the previous Task 4 commit as the integration point.
