# Global HTML Unification Runtime + Generacion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the safely-parameterizable duplicated HTML families in the project using a mixed strategy: runtime wrappers for large guide pages and generated outputs for small quiz/matrix pages, while preserving current public URLs, auth behavior, storage isolation, and visible UX.

**Architecture:** Reuse the proven Guia Redes runtime pattern by extracting a generic page runtime loader and a shared runtime context registry, then migrate each large guide family to thin wrappers plus shared partials and explicit init hooks. In parallel, introduce a lightweight PowerShell generator for the small duplicated pages whose group differences are limited to tokens such as title, ficha, group, cloud file, and back links.

**Tech Stack:** Static HTML, vanilla JavaScript, Node `node:test`, PowerShell, Git worktrees, existing `portal_auth` and `firebase_db` integrations.

---

## File Map

- `data/page_runtime_contexts.json`
  Public runtime registry for all wrapper-driven families outside Guia Redes. Each entry owns `family`, `pageFile`, `partialPath`, `inst`, `grupo`, `ficha`, and `boot`.

- `js/page_runtime_loader.js`
  Generic loader for runtime families. It reads `window.__PAGE_CONTEXT__`, validates the selected wrapper, injects the shared partial into `#page-root`, hydrates `document.body.dataset`, and executes boot hooks in order.

- `js/guide_runtime_loader.js`
  Compatibility shim for the existing Guia Redes pilot. It should delegate to the new generic runtime primitives or preserve the current contract while reusing the new generic code.

- `tests/page_runtime_loader.test.cjs`
  Coverage for the generic runtime loader and runtime context registry.

- `tests/script_induccion_runtime_boot.test.cjs`
  Regression test guaranteeing `js/script_induccion.js` exposes `window.initInduccion` and does not auto-boot on runtime pages.

- `tests/script_guia2_runtime_boot.test.cjs`
  Regression test guaranteeing `js/script_guia2.js` exposes `window.initGuia2` and does not auto-boot on runtime pages.

- `tests/script_guia5_runtime_boot.test.cjs`
  Regression test guaranteeing `js/script.js` exposes `window.initGuia5` and does not auto-boot on runtime pages.

- `tests/script_guia6_runtime_boot.test.cjs`
  Regression test guaranteeing `js/script_guia6.js` exposes `window.initGuia6` and does not auto-boot on runtime pages.

- `partials/guia-01-induccion-content.html`
  Single source of truth for the body markup currently duplicated between `grupo-10a/10b-guia-01-induccion.html`.

- `partials/guia-02-herramientas-content.html`
  Single source of truth for the body markup currently duplicated between `grupo-10a/10b-guia-02-herramientas-informaticas-digitales.html`.

- `partials/guia-05-herramientas-content.html`
  Single source of truth for the body markup currently duplicated between `grupo-11a/11b-guia-05-herramientas-informaticas-digitales.html`.

- `partials/guia-06-planificar-content.html`
  Single source of truth for the body markup currently duplicated between `grupo-11a/11b-guia-06-planificar-informacion.html`.

- `sources/generated/redes-rap01-quiz.template.html`
  Canonical template for the duplicated `santa-barbara-10a/10b-guia-02-redes-rap01-quiz.html` pages.

- `sources/generated/redes-ip-quiz.template.html`
  Canonical template for the duplicated `santa-barbara-10a/10b-guia-02-redes-ip-quiz.html` pages.

- `sources/generated/guia-02-matriz-322.template.html`
  Canonical template for the duplicated `grupo-10a/10b-guia-02-actividad-322-matriz.html` pages.

- `data/generated_page_variants.json`
  Public token variants for the generated families. Each row owns `template`, `outputFile`, `grupo`, `ficha`, `inst`, `title`, `description`, and any family-specific token values.

- `tools/build-generated-pages.ps1`
  Deterministic local generator that renders generated families to their current public file names in the repo root.

- `tests/generated_pages_build.test.cjs`
  Regression coverage for the generator inputs and outputs.

- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`
  Runtime wrappers preserving current public URLs and per-group head metadata.

- `santa-barbara-10a-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10b-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10a-guia-02-redes-ip-quiz.html`
- `santa-barbara-10b-guia-02-redes-ip-quiz.html`
- `grupo-10a-guia-02-actividad-322-matriz.html`
- `grupo-10b-guia-02-actividad-322-matriz.html`
  Generated outputs. These must remain in the root and should stop being edited directly.

- `grupo-10a-guia-02-actividad-4-formulario.html`
- `grupo-10b-guia-02-actividad-4-formulario.html`
  Explicitly excluded from this plan. Current diff shows a functional divergence: the 10B page includes Drive delivery UI and supporting scripts that are missing in 10A. Do not unify these in this batch.

---

## Task 0: Preflight In The Dedicated Worktree

**Files:**
- Create: none
- Modify: none
- Test: full current test suite

- [ ] **Step 1: Verify the worktree branch is clean**

Run:

```powershell
git -C C:\Users\PC\.config\superpowers\worktrees\HTML\codex-global-html-unification status --short --branch
```

Expected: branch `codex/global-html-unification` with no modified files.

- [ ] **Step 2: Run the current Node test baseline**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter *.cjs | Sort-Object Name | ForEach-Object { $_.FullName }
node --test $tests
```

Expected: current suite passes cleanly before any global unification work starts.

---

## Task 1: Add The Shared Runtime/Generation Test Harness

**Files:**
- Create: `tests/page_runtime_loader.test.cjs`
- Create: `tests/generated_pages_build.test.cjs`
- Modify: `tests/guia_redes_runtime_loader.test.cjs`
- Test: `tests/page_runtime_loader.test.cjs`
- Test: `tests/generated_pages_build.test.cjs`

- [ ] **Step 1: Write the failing generic runtime loader test**

Create `tests/page_runtime_loader.test.cjs` covering:

- a generic `window.__PAGE_CONTEXT__`;
- `data/page_runtime_contexts.json`;
- boot hook ordering;
- dataset hydration;
- page mismatch errors.

The test should fail initially with `ENOENT` because `js/page_runtime_loader.js` and `data/page_runtime_contexts.json` do not exist yet.

- [ ] **Step 2: Run the new runtime test and verify it fails**

Run:

```powershell
node --test tests\page_runtime_loader.test.cjs
```

Expected: FAIL due to missing loader/registry files.

- [ ] **Step 3: Write the failing generated-pages test**

Create `tests/generated_pages_build.test.cjs` asserting:

- the variants file exists;
- every `outputFile` declared in the generated families resolves to an existing root file;
- quiz/matrix outputs can be regenerated from their templates;
- the generated files contain the expected group-specific tokens.

- [ ] **Step 4: Run the generator test and verify it fails**

Run:

```powershell
node --test tests\generated_pages_build.test.cjs
```

Expected: FAIL due to missing template or variants infrastructure.

- [ ] **Step 5: Commit the failing test harness**

Run:

```powershell
git add tests\page_runtime_loader.test.cjs tests\generated_pages_build.test.cjs
git commit -m "test: add global html unification harness"
```

Expected: one commit with the new failing tests only.

---

## Task 2: Implement The Shared Runtime Loader And Generator Infrastructure

**Files:**
- Create: `data/page_runtime_contexts.json`
- Create: `js/page_runtime_loader.js`
- Create: `data/generated_page_variants.json`
- Create: `tools/build-generated-pages.ps1`
- Modify: `js/guide_runtime_loader.js`
- Modify: `tests/guia_redes_runtime_loader.test.cjs`
- Test: `tests/page_runtime_loader.test.cjs`
- Test: `tests/generated_pages_build.test.cjs`
- Test: `tests/guia_redes_runtime_loader.test.cjs`

- [ ] **Step 1: Implement the minimal generic runtime registry**

Create `data/page_runtime_contexts.json` with initial entries for:

- `jfk-induccion-10a`
- `jfk-induccion-10b`
- `jfk-guia2-10a`
- `jfk-guia2-10b`
- `sb-guia5-11a`
- `sb-guia5-11b`
- `sb-guia6-11a`
- `sb-guia6-11b`

Include exact `pageFile`, `partialPath`, `inst`, `grupo`, `ficha`, and `boot`.

- [ ] **Step 2: Implement the generic runtime loader**

Create `js/page_runtime_loader.js` with:

- `window.__PAGE_CONTEXT__` bootstrap;
- fetch helpers for JSON/text;
- wrapper validation using `pageFile`;
- `#page-root` injection;
- `document.body.dataset` hydration;
- optional `window.initGuiaTemplateShell()`;
- required dynamic boot hook lookup using the `boot` string from the registry.

- [ ] **Step 3: Preserve Guia Redes compatibility**

Modify `js/guide_runtime_loader.js` so the current Guia Redes pilot keeps its public behavior. Either:

- delegate to shared helper logic while keeping `window.__GUIDE_CONTEXT__`, or
- preserve the current wrapper contract and re-share internal utility code.

Do not break the existing `tests/guia_redes_runtime_loader.test.cjs`.

- [ ] **Step 4: Implement the generator primitives**

Create `data/generated_page_variants.json` with initial variants for:

- `redes-rap01-quiz`
- `redes-ip-quiz`
- `guia-02-matriz-322`

Create `tools/build-generated-pages.ps1` to:

- read each template file under `sources/generated/`;
- substitute `{{TOKEN}}` placeholders from the variant object;
- write final HTML files to the repo root deterministically.

- [ ] **Step 5: Run the new infrastructure tests and verify they pass**

Run:

```powershell
node --test tests\page_runtime_loader.test.cjs tests\generated_pages_build.test.cjs tests\guia_redes_runtime_loader.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit the shared infrastructure**

Run:

```powershell
git add data\page_runtime_contexts.json js\page_runtime_loader.js data\generated_page_variants.json tools\build-generated-pages.ps1 js\guide_runtime_loader.js tests\page_runtime_loader.test.cjs tests\generated_pages_build.test.cjs tests\guia_redes_runtime_loader.test.cjs
git commit -m "feat: add shared html unification infrastructure"
```

Expected: one commit introducing the runtime/generator foundations.

---

## Task 3: Refactor `js/script_induccion.js` For Runtime Boot

**Files:**
- Modify: `js/script_induccion.js`
- Create: `tests/script_induccion_runtime_boot.test.cjs`
- Test: `tests/script_induccion_runtime_boot.test.cjs`

- [ ] **Step 1: Write the failing induccion runtime boot test**

Create `tests/script_induccion_runtime_boot.test.cjs` to verify:

- `window.initInduccion` exists;
- `DOMContentLoaded` auto-boot is skipped when `window.__PAGE_CONTEXT__` is present;
- legacy non-runtime auto-boot is preserved.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
node --test tests\script_induccion_runtime_boot.test.cjs
```

Expected: FAIL because the script currently auto-boots unconditionally.

- [ ] **Step 3: Implement `window.initInduccion`**

Refactor `js/script_induccion.js` so the current DOMContentLoaded body moves into an idempotent `initInduccion()` function, then expose:

```js
window.initInduccion = initInduccion;

if (!window.__PAGE_CONTEXT__) {
  document.addEventListener("DOMContentLoaded", initInduccion);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```powershell
node --test tests\script_induccion_runtime_boot.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit the induccion boot hook**

Run:

```powershell
git add js\script_induccion.js tests\script_induccion_runtime_boot.test.cjs
git commit -m "refactor: add runtime boot hook for induccion"
```

Expected: one commit exposing the explicit init hook.

---

## Task 4: Extract And Wrap The Induccion Family

**Files:**
- Create: `partials/guia-01-induccion-content.html`
- Modify: `grupo-10a-guia-01-induccion.html`
- Modify: `grupo-10b-guia-01-induccion.html`
- Test: `tests/page_runtime_loader.test.cjs`
- Test: `tests/script_induccion_runtime_boot.test.cjs`

- [ ] **Step 1: Extract the shared induccion body**

Copy the current body markup shared by both induccion pages into:

```text
partials/guia-01-induccion-content.html
```

Keep all IDs, inline handlers, and existing activity markup intact.

- [ ] **Step 2: Replace each induccion HTML with a runtime wrapper**

Each wrapper should keep:

- current `<title>`;
- current `<meta name="description">`;
- current auth/shared script includes;
- `window.__PAGE_CONTEXT__ = { key: "...", family: "guia-01-induccion" }`;
- `<div id="page-root"></div>`;
- `js/page_runtime_loader.js`.

- [ ] **Step 3: Run the focused tests**

Run:

```powershell
node --test tests\page_runtime_loader.test.cjs tests\script_induccion_runtime_boot.test.cjs
```

Expected: PASS.

- [ ] **Step 4: Commit the induccion runtime migration**

Run:

```powershell
git add partials\guia-01-induccion-content.html grupo-10a-guia-01-induccion.html grupo-10b-guia-01-induccion.html
git commit -m "refactor: unify induccion pages behind runtime wrappers"
```

Expected: one commit removing the duplicated induccion bodies from the public files.

---

## Task 5: Refactor And Wrap `guia-02-herramientas`

**Files:**
- Modify: `js/script_guia2.js`
- Create: `tests/script_guia2_runtime_boot.test.cjs`
- Create: `partials/guia-02-herramientas-content.html`
- Modify: `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- Modify: `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- Test: `tests/script_guia2_runtime_boot.test.cjs`
- Test: `tests/page_runtime_loader.test.cjs`

- [ ] **Step 1: Write the failing Guia 2 runtime boot test**

The test must assert:

- `window.initGuia2` exists;
- runtime pages skip `DOMContentLoaded` autoboot;
- legacy pages retain the current boot behavior.

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
node --test tests\script_guia2_runtime_boot.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Implement `window.initGuia2` in `js/script_guia2.js`**

Refactor the current DOMContentLoaded initialization into an idempotent function and gate auto-boot on `window.__PAGE_CONTEXT__`.

- [ ] **Step 4: Extract the shared Guia 2 body and wrap both public pages**

Create `partials/guia-02-herramientas-content.html`, then reduce 10A and 10B to thin wrappers.

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
node --test tests\script_guia2_runtime_boot.test.cjs tests\page_runtime_loader.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit the Guia 2 runtime migration**

Run:

```powershell
git add js\script_guia2.js tests\script_guia2_runtime_boot.test.cjs partials\guia-02-herramientas-content.html grupo-10a-guia-02-herramientas-informaticas-digitales.html grupo-10b-guia-02-herramientas-informaticas-digitales.html
git commit -m "refactor: unify guia 2 pages behind runtime wrappers"
```

Expected: one commit with the Guia 2 runtime family migrated.

---

## Task 6: Refactor And Wrap `guia-05` And `guia-06`

**Files:**
- Modify: `js/script.js`
- Modify: `js/script_guia6.js`
- Create: `tests/script_guia5_runtime_boot.test.cjs`
- Create: `tests/script_guia6_runtime_boot.test.cjs`
- Create: `partials/guia-05-herramientas-content.html`
- Create: `partials/guia-06-planificar-content.html`
- Modify: `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- Modify: `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- Modify: `grupo-11a-guia-06-planificar-informacion.html`
- Modify: `grupo-11b-guia-06-planificar-informacion.html`
- Test: `tests/script_guia5_runtime_boot.test.cjs`
- Test: `tests/script_guia6_runtime_boot.test.cjs`
- Test: `tests/page_runtime_loader.test.cjs`

- [ ] **Step 1: Write the failing Guia 5 and Guia 6 boot tests**

Verify:

- `window.initGuia5` and `window.initGuia6` exist;
- runtime pages skip `DOMContentLoaded` auto-boot;
- legacy non-runtime behavior remains intact.

- [ ] **Step 2: Run the boot tests and verify they fail**

Run:

```powershell
node --test tests\script_guia5_runtime_boot.test.cjs tests\script_guia6_runtime_boot.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Implement `window.initGuia5` and `window.initGuia6`**

Refactor `js/script.js` and `js/script_guia6.js` into idempotent init functions with runtime gating identical to the earlier families.

- [ ] **Step 4: Extract shared partials and reduce wrappers**

Create:

- `partials/guia-05-herramientas-content.html`
- `partials/guia-06-planificar-content.html`

Convert all four 11A/11B pages into runtime wrappers.

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
node --test tests\script_guia5_runtime_boot.test.cjs tests\script_guia6_runtime_boot.test.cjs tests\page_runtime_loader.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit the 11A/11B runtime migration**

Run:

```powershell
git add js\script.js js\script_guia6.js tests\script_guia5_runtime_boot.test.cjs tests\script_guia6_runtime_boot.test.cjs partials\guia-05-herramientas-content.html partials\guia-06-planificar-content.html grupo-11a-guia-05-herramientas-informaticas-digitales.html grupo-11b-guia-05-herramientas-informaticas-digitales.html grupo-11a-guia-06-planificar-informacion.html grupo-11b-guia-06-planificar-informacion.html
git commit -m "refactor: unify 11th-grade guide pages behind runtime wrappers"
```

Expected: one commit with both 11A/11B families migrated.

---

## Task 7: Add Generated Templates For The Small Families

**Files:**
- Create: `sources/generated/redes-rap01-quiz.template.html`
- Create: `sources/generated/redes-ip-quiz.template.html`
- Create: `sources/generated/guia-02-matriz-322.template.html`
- Modify: `santa-barbara-10a-guia-02-redes-rap01-quiz.html`
- Modify: `santa-barbara-10b-guia-02-redes-rap01-quiz.html`
- Modify: `santa-barbara-10a-guia-02-redes-ip-quiz.html`
- Modify: `santa-barbara-10b-guia-02-redes-ip-quiz.html`
- Modify: `grupo-10a-guia-02-actividad-322-matriz.html`
- Modify: `grupo-10b-guia-02-actividad-322-matriz.html`
- Test: `tests/generated_pages_build.test.cjs`
- Test: `tests/script_redes_quiz_boot.test.cjs`

- [ ] **Step 1: Create the canonical templates**

Extract the duplicated markup into the three `sources/generated/*.template.html` files, replacing the group-specific values with explicit tokens such as:

- `{{PAGE_TITLE}}`
- `{{PAGE_DESCRIPTION}}`
- `{{QUIZ_GROUP}}`
- `{{QUIZ_FICHA}}`
- `{{QUIZ_CLOUD_FILE}}`
- `{{QUIZ_PAGE_FILE}}`
- `{{QUIZ_BACK_LINK}}`

- [ ] **Step 2: Generate the public outputs**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-generated-pages.ps1
```

Expected: the six public HTML files are regenerated in the repo root.

- [ ] **Step 3: Run the generator and quiz tests**

Run:

```powershell
node --test tests\generated_pages_build.test.cjs tests\script_redes_quiz_boot.test.cjs
```

Expected: PASS.

- [ ] **Step 4: Commit the generated families**

Run:

```powershell
git add sources\generated data\generated_page_variants.json tools\build-generated-pages.ps1 santa-barbara-10a-guia-02-redes-rap01-quiz.html santa-barbara-10b-guia-02-redes-rap01-quiz.html santa-barbara-10a-guia-02-redes-ip-quiz.html santa-barbara-10b-guia-02-redes-ip-quiz.html grupo-10a-guia-02-actividad-322-matriz.html grupo-10b-guia-02-actividad-322-matriz.html tests\generated_pages_build.test.cjs
git commit -m "refactor: generate duplicated quiz and matrix pages"
```

Expected: one commit with the generated family migration.

---

## Task 8: Final Verification For The Global Batch

**Files:**
- Create: none
- Modify: none
- Test: full current test suite plus generated build

- [ ] **Step 1: Run syntax checks on all touched runtime scripts**

Run:

```powershell
node --check js\page_runtime_loader.js
node --check js\guide_runtime_loader.js
node --check js\script_induccion.js
node --check js\script_guia2.js
node --check js\script.js
node --check js\script_guia6.js
```

Expected: all commands exit with no output.

- [ ] **Step 2: Regenerate generated pages once more from templates**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-generated-pages.ps1
```

Expected: no errors and no unexpected file drift after a second run.

- [ ] **Step 3: Run the full current test suite**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter *.cjs | Sort-Object Name | ForEach-Object { $_.FullName }
node --test $tests
```

Expected: PASS for every listed test file.

- [ ] **Step 4: Smoke-check the migrated families manually**

Verify manually:

```text
1. Open both induccion wrappers and confirm the correct group/ficha appear.
2. Open both Guia 2 wrappers and confirm the correct group/ficha appear.
3. Open both Guia 5 wrappers and confirm the correct group/ficha appear.
4. Open both Guia 6 wrappers and confirm the correct group/ficha appear.
5. Open both quiz families and confirm the back link, group, and ficha match the wrapper.
6. Open both matrix pages and confirm group-specific metadata remains correct.
```

Expected: public behavior remains unchanged apart from the maintenance architecture.

- [ ] **Step 5: Create the integration commit**

Run:

```powershell
git status --short
git commit --allow-empty -m "chore: verify global html unification batch"
```

Expected: if the tree is already clean, the empty commit becomes an optional verification marker. If the team does not want a marker commit, skip this step.
