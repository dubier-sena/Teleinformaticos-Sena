# Root HTML Cleanup Aux Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the root folder to the approved set of 15 main HTML pages by moving approved auxiliary HTML pages into `pages/auxiliares/`, updating all internal references, and keeping local navigation and automated verification working.

**Architecture:** Keep all main entry pages in the repo root, move auxiliary pages into a single `pages/auxiliares/` folder, and make the existing runtime/generation layer point to those new paths. Generated auxiliary pages will still be rendered from templates, but their outputs will be written to `pages/auxiliares/` instead of the root.

**Tech Stack:** Static HTML, vanilla JavaScript, Node `node:test`, PowerShell, existing runtime wrappers and generator scripts.

---

## File Map

- `pages/auxiliares/`
  New container for auxiliary HTML pages that should no longer live in the root.

- `grupo-10a-guia-02-actividad-4-formulario.html`
- `grupo-10b-guia-02-actividad-4-formulario.html`
- `grupo-10a-guia-02-ficha-caso.html`
- `grupo-10b-guia-02-ficha-caso.html`
- `plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html`
- `plantilla-grado-11-guia-06-planificar-informacion.html`
- `santa-barbara-guia-02-contenido-teorico-redes.html`
  Auxiliary source pages that will be moved physically into `pages/auxiliares/` and must have all relative paths corrected.

- `partials/guia-02-herramientas-content.html`
  Shared Guide 2 partial that currently points to auxiliary pages in the root and must be updated to `pages/auxiliares/...`.

- `partials/guia-redes-rap01-content.html`
  Shared Guide Redes partial that links to the shared theoretical content page and must point to `pages/auxiliares/...`.

- `data/guide_contexts.json`
  Runtime registry for the Redes guide wrappers. It currently publishes quiz URLs in the root and must be updated to `pages/auxiliares/...`.

- `data/generated_page_variants.json`
  Variant registry for generated auxiliary pages. The `outputFile` values must move from root HTML file names to `pages/auxiliares/...`.

- `tools/build-generated-pages.ps1`
  Generator that must continue writing deterministic outputs, now into `pages/auxiliares/`.

- `sources/generated/redes-rap01-quiz.template.html`
- `sources/generated/redes-ip-quiz.template.html`
- `sources/generated/guia-02-matriz-322.template.html`
  Templates for generated auxiliary pages. Their relative asset and back-link paths must be updated for `pages/auxiliares/`.

- `js/admin_usuarios.js`
- `js/firebase_db.js`
- `js/guia_template.js`
- `js/script.js`
- `js/script_guia2.js`
- `js/script_guia6.js`
  JavaScript modules with file-name maps or allowlists that currently reference moved HTML pages in the root.

- `tools/check_activity4_admin_report.js`
- `tools/check_activity4_apps_script_delivery.js`
- `tools/check_activity4_identity_gate.js`
- `tools/check_activity4_q1_selection.js`
- `tools/check_activity4_q2_dropdown.js`
- `tools/check_activity4_q4_selection.js`
- `tools/check_admin_guia2_respuestas.js`
- `tools/check_redes_quiz_visibility.js`
- `tools/check_redesign_rollout.js`
- `tools/check_shared_apps_script_button.js`
- `tools/check_shared_drive_delivery.js`
- `tools/validar_estructura_portal.ps1`
  Local verification scripts that read moved files by path and must follow the new `pages/auxiliares/` structure.

- `tests/generated_pages_build.test.cjs`
  Must assert generated outputs now exist under `pages/auxiliares/`.

- `tests/guia_redes_runtime_loader.test.cjs`
  Must assert quiz links now point into `pages/auxiliares/`.

- `tests/root_html_cleanup_structure.test.cjs`
  New regression test for root-vs-aux placement and key link rewrites.

---

## Task 0: Preflight In The Dedicated Worktree

**Files:**
- Create: none
- Modify: none
- Test: full current test suite

- [ ] **Step 1: Verify branch and worktree status**

Run:

```powershell
git status --short --branch
```

Expected: `## codex/root-html-cleanup` with no modified files.

- [ ] **Step 2: Run the current full test baseline**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter *.cjs | Sort-Object Name | ForEach-Object { $_.FullName }
node --test $tests
```

Expected: PASS for the existing `61` tests before moving any HTML.

---

## Task 1: Add The Failing Root-Cleanup Regression Tests

**Files:**
- Create: `tests/root_html_cleanup_structure.test.cjs`
- Modify: `tests/generated_pages_build.test.cjs`
- Modify: `tests/guia_redes_runtime_loader.test.cjs`
- Test: `tests/root_html_cleanup_structure.test.cjs`
- Test: `tests/generated_pages_build.test.cjs`
- Test: `tests/guia_redes_runtime_loader.test.cjs`

- [ ] **Step 1: Write the failing root/aux placement test**

Create `tests/root_html_cleanup_structure.test.cjs` with assertions for:

```js
const EXPECTED_ROOT_HTML = [
  "index.html",
  "calendario-academico-2026.html",
  "etapa-productiva-admin.html",
  "etapa-productiva-estudiante.html",
  "panel-administrativo-usuarios.html",
  "grupo-10a-guia-01-induccion.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

const EXPECTED_AUX_HTML = [
  "grupo-10a-guia-02-actividad-4-formulario.html",
  "grupo-10b-guia-02-actividad-4-formulario.html",
  "grupo-10a-guia-02-ficha-caso.html",
  "grupo-10b-guia-02-ficha-caso.html",
  "grupo-10a-guia-02-actividad-322-matriz.html",
  "grupo-10b-guia-02-actividad-322-matriz.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html",
  "santa-barbara-10a-guia-02-redes-rap01-quiz.html",
  "santa-barbara-10b-guia-02-redes-rap01-quiz.html",
  "santa-barbara-10a-guia-02-redes-ip-quiz.html",
  "santa-barbara-10b-guia-02-redes-ip-quiz.html",
  "santa-barbara-guia-02-contenido-teorico-redes.html",
];
```

Also assert:

- every root page still exists in the repo root;
- every aux page exists under `pages/auxiliares/`;
- none of the aux pages still exists in the repo root;
- the Guide 2 shared partial contains `pages/auxiliares/`;
- the Redes shared partial points to `pages/auxiliares/santa-barbara-guia-02-contenido-teorico-redes.html`.

- [ ] **Step 2: Update the generated-pages test to expect `pages/auxiliares/` outputs**

In `tests/generated_pages_build.test.cjs`, change the expected `outputFile` values to:

```js
"pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html"
"pages/auxiliares/santa-barbara-10b-guia-02-redes-rap01-quiz.html"
"pages/auxiliares/santa-barbara-10a-guia-02-redes-ip-quiz.html"
"pages/auxiliares/santa-barbara-10b-guia-02-redes-ip-quiz.html"
"pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html"
"pages/auxiliares/grupo-10b-guia-02-actividad-322-matriz.html"
```

- [ ] **Step 3: Update the Redes runtime-loader test to expect `pages/auxiliares/` quiz links**

In `tests/guia_redes_runtime_loader.test.cjs`, change both the fixture context and the final `assert.equal(...)` expectations to the new auxiliary quiz URLs:

```js
"pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html"
"pages/auxiliares/santa-barbara-10a-guia-02-redes-ip-quiz.html"
"pages/auxiliares/santa-barbara-10b-guia-02-redes-rap01-quiz.html"
"pages/auxiliares/santa-barbara-10b-guia-02-redes-ip-quiz.html"
```

- [ ] **Step 4: Run the focused tests and verify they fail**

Run:

```powershell
node --test tests\root_html_cleanup_structure.test.cjs tests\generated_pages_build.test.cjs tests\guia_redes_runtime_loader.test.cjs
```

Expected: FAIL because the files still live in the root and current links still point to root HTML pages.

- [ ] **Step 5: Commit the failing tests**

Run:

```powershell
git add tests\root_html_cleanup_structure.test.cjs tests\generated_pages_build.test.cjs tests\guia_redes_runtime_loader.test.cjs
git commit -m "test: add root html cleanup regression coverage"
```

Expected: one commit with failing tests only.

---

## Task 2: Move The Static Auxiliary Pages Into `pages/auxiliares/`

**Files:**
- Create: `pages/auxiliares/`
- Modify: `pages/auxiliares/grupo-10a-guia-02-actividad-4-formulario.html`
- Modify: `pages/auxiliares/grupo-10b-guia-02-actividad-4-formulario.html`
- Modify: `pages/auxiliares/grupo-10a-guia-02-ficha-caso.html`
- Modify: `pages/auxiliares/grupo-10b-guia-02-ficha-caso.html`
- Modify: `pages/auxiliares/plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html`
- Modify: `pages/auxiliares/plantilla-grado-11-guia-06-planificar-informacion.html`
- Modify: `pages/auxiliares/santa-barbara-guia-02-contenido-teorico-redes.html`
- Test: `tests/root_html_cleanup_structure.test.cjs`

- [ ] **Step 1: Move the approved static auxiliary files**

Run:

```powershell
New-Item -ItemType Directory -Force -Path pages\aux | Out-Null
Move-Item -LiteralPath grupo-10a-guia-02-actividad-4-formulario.html -Destination pages\aux\
Move-Item -LiteralPath grupo-10b-guia-02-actividad-4-formulario.html -Destination pages\aux\
Move-Item -LiteralPath grupo-10a-guia-02-ficha-caso.html -Destination pages\aux\
Move-Item -LiteralPath grupo-10b-guia-02-ficha-caso.html -Destination pages\aux\
Move-Item -LiteralPath plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html -Destination pages\aux\
Move-Item -LiteralPath plantilla-grado-11-guia-06-planificar-informacion.html -Destination pages\aux\
Move-Item -LiteralPath santa-barbara-guia-02-contenido-teorico-redes.html -Destination pages\aux\
```

Expected: the seven static auxiliary pages disappear from the repo root and now exist under `pages/auxiliares/`.

- [ ] **Step 2: Rewrite relative asset paths in every moved file**

In each moved file, change root-relative local references like:

```html
href="css/site_tokens.css?v=20260412_2"
src="js/shared_shell.js?v=20260412_2"
src="data/calendario_2026_seed.js?v=20260410_1"
src="assets/img/..."
```

to:

```html
href="../css/site_tokens.css?v=20260412_2"
src="../js/shared_shell.js?v=20260412_2"
src="../data/calendario_2026_seed.js?v=20260410_1"
src="../assets/img/..."
```

- [ ] **Step 3: Rewrite local navigation links inside the moved files**

Where a moved page links back to root pages or `index.html`, keep those targets reachable from `pages/auxiliares/`:

```html
href="../index.html"
href="../grupo-10a-guia-02-herramientas-informaticas-digitales.html"
href="../grupo-11a-guia-05-herramientas-informaticas-digitales.html"
```

Keep any same-folder links between auxiliary pages as plain file names if both pages now live under `pages/auxiliares/`.

- [ ] **Step 4: Update cloud-file constants only when they encode a file path**

If a moved page stores only a logical cloud file name such as:

```js
var CLOUD_FILE = "grupo-10a-guia-02-ficha-caso.html";
```

preserve it **only if** the app treats it as a logical key. If any usage requires a path lookup, change it to:

```js
var CLOUD_FILE = "pages/auxiliares/grupo-10a-guia-02-ficha-caso.html";
```

Use the existing call sites in `js/firebase_db.js` and related tools to decide consistently.

- [ ] **Step 5: Run the root-structure test and verify it still fails for the not-yet-generated files**

Run:

```powershell
node --test tests\root_html_cleanup_structure.test.cjs
```

Expected: still FAIL, but now only for generated auxiliary pages or not-yet-rewritten links.

---

## Task 3: Update Runtime Pages, Registries, And Local Tools To Use `pages/auxiliares/`

**Files:**
- Modify: `partials/guia-02-herramientas-content.html`
- Modify: `partials/guia-redes-rap01-content.html`
- Modify: `data/guide_contexts.json`
- Modify: `js/admin_usuarios.js`
- Modify: `js/firebase_db.js`
- Modify: `js/guia_template.js`
- Modify: `js/script.js`
- Modify: `js/script_guia2.js`
- Modify: `js/script_guia6.js`
- Modify: `tools/check_activity4_admin_report.js`
- Modify: `tools/check_activity4_apps_script_delivery.js`
- Modify: `tools/check_activity4_identity_gate.js`
- Modify: `tools/check_activity4_q1_selection.js`
- Modify: `tools/check_activity4_q2_dropdown.js`
- Modify: `tools/check_activity4_q4_selection.js`
- Modify: `tools/check_admin_guia2_respuestas.js`
- Modify: `tools/check_redes_quiz_visibility.js`
- Modify: `tools/check_redesign_rollout.js`
- Modify: `tools/check_shared_apps_script_button.js`
- Modify: `tools/check_shared_drive_delivery.js`
- Modify: `tools/validar_estructura_portal.ps1`
- Test: `tests/root_html_cleanup_structure.test.cjs`
- Test: `tests/guia_redes_runtime_loader.test.cjs`

- [ ] **Step 1: Point Guide 2 links to `pages/auxiliares/`**

In `partials/guia-02-herramientas-content.html`, update the config block so the auxiliary URLs become:

```js
activity4Url: "pages/auxiliares/grupo-10a-guia-02-actividad-4-formulario.html?v=20260409_6"
fichaCasoUrl: "pages/auxiliares/grupo-10a-guia-02-ficha-caso.html"
matrizUrl: "pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html"
```

and the matching 10B equivalents.

- [ ] **Step 2: Point the Redes theoretical-content link to `pages/auxiliares/`**

In `partials/guia-redes-rap01-content.html`, change:

```html
href="santa-barbara-guia-02-contenido-teorico-redes.html"
```

to:

```html
href="pages/auxiliares/santa-barbara-guia-02-contenido-teorico-redes.html"
```

- [ ] **Step 3: Point Redes runtime context URLs to `pages/auxiliares/`**

In `data/guide_contexts.json`, update `quizRedesUrl` and `quizIpUrl` for both Santa Barbara groups to the new `pages/auxiliares/...` locations.

- [ ] **Step 4: Update JS file-name maps for moved pages**

Update the filename aliases in:

```js
js/script_guia2.js
js/script.js
js/script_guia6.js
js/guia_template.js
```

so any moved pages are represented by their new relative path strings, for example:

```js
"pages/auxiliares/grupo-10a-guia-02-actividad-4-formulario.html": "10a_guia2.html"
"pages/auxiliares/plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html": "grado_guia.html"
```

- [ ] **Step 5: Update allowlists and helper lookups**

In `js/admin_usuarios.js` and `js/firebase_db.js`, update every moved-page reference to use `pages/auxiliares/...` so admin tools, unlock logic, and scoped-storage handling still recognize the correct files.

- [ ] **Step 6: Update local verification scripts**

In every listed `tools/check_*.js` and `tools/validar_estructura_portal.ps1`, rewrite hardcoded root file paths to:

```js
path.join(root, "pages", "auxiliares", "grupo-10a-guia-02-actividad-4-formulario.html")
```

or the PowerShell equivalent.

- [ ] **Step 7: Run the focused link tests and verify they pass**

Run:

```powershell
node --test tests\root_html_cleanup_structure.test.cjs tests\guia_redes_runtime_loader.test.cjs
```

Expected: PASS for structure and quiz-link expectations, with generated-file failures now isolated to the generator layer if any remain.

---

## Task 4: Move Generated Auxiliary Outputs Into `pages/auxiliares/`

**Files:**
- Modify: `data/generated_page_variants.json`
- Modify: `tools/build-generated-pages.ps1`
- Modify: `sources/generated/redes-rap01-quiz.template.html`
- Modify: `sources/generated/redes-ip-quiz.template.html`
- Modify: `sources/generated/guia-02-matriz-322.template.html`
- Modify: `tests/generated_pages_build.test.cjs`
- Test: `tests/generated_pages_build.test.cjs`
- Test: `tests/root_html_cleanup_structure.test.cjs`

- [ ] **Step 1: Rewrite generated output targets**

In `data/generated_page_variants.json`, change each `outputFile` to the new location, for example:

```json
"outputFile": "pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html"
```

Apply the same pattern to both quiz families and both matrix outputs.

- [ ] **Step 2: Make the generator create nested output folders**

In `tools/build-generated-pages.ps1`, before `Set-Content`, create the destination directory:

```powershell
$outputDir = Split-Path -Parent $outputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}
```

- [ ] **Step 3: Fix relative assets and backlinks in generated templates**

Because the generated files now live under `pages/auxiliares/`, update each template so local references use `../` prefixes, for example:

```html
<link rel="stylesheet" href="../css/site_tokens.css?v=20260412_2">
<script defer src="../js/portal_auth.js?v=20260422_2"></script>
<a href="../{{BACK_LINK}}">
```

If a template needs a same-folder auxiliary link, keep it without `../`.

- [ ] **Step 4: Regenerate the auxiliary HTML outputs**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-generated-pages.ps1
```

Expected: six generated HTML files are written under `pages/auxiliares/` and none are regenerated in the repo root.

- [ ] **Step 5: Run the generator and structure tests**

Run:

```powershell
node --test tests\generated_pages_build.test.cjs tests\root_html_cleanup_structure.test.cjs
```

Expected: PASS.

---

## Task 5: Full Verification And Integration Commit

**Files:**
- Modify: none
- Test: full current test suite plus generator rerun

- [ ] **Step 1: Run syntax checks on touched scripts**

Run:

```powershell
node --check js\guia_template.js
node --check js\script.js
node --check js\script_guia2.js
node --check js\script_guia6.js
```

Expected: no output.

- [ ] **Step 2: Re-run the generator to verify deterministic output**

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-generated-pages.ps1
git status --short
```

Expected: no unexpected drift after the second generation pass.

- [ ] **Step 3: Run the full automated suite**

Run:

```powershell
$tests = Get-ChildItem -LiteralPath tests -Filter *.cjs | Sort-Object Name | ForEach-Object { $_.FullName }
node --test $tests
```

Expected: PASS for the full suite.

- [ ] **Step 4: Smoke-check the main navigations manually**

Verify manually:

```text
1. Open both Guide 2 main pages and follow links to formulario, ficha de caso, and matriz under pages/auxiliares/.
2. Open both Redes main pages and follow links to quiz pages and theoretical content under pages/auxiliares/.
3. Open one moved plantilla page and confirm CSS, JS, and local assets still load.
4. Confirm the repo root only contains the approved 15 HTML files.
```

Expected: navigation and assets still work after the move.

- [ ] **Step 5: Commit the completed cleanup**

Run:

```powershell
git add pages\aux partials\guia-02-herramientas-content.html partials\guia-redes-rap01-content.html data\guide_contexts.json data\generated_page_variants.json tools\build-generated-pages.ps1 sources\generated\redes-rap01-quiz.template.html sources\generated\redes-ip-quiz.template.html sources\generated\guia-02-matriz-322.template.html js\admin_usuarios.js js\firebase_db.js js\guia_template.js js\script.js js\script_guia2.js js\script_guia6.js tools\check_activity4_admin_report.js tools\check_activity4_apps_script_delivery.js tools\check_activity4_identity_gate.js tools\check_activity4_q1_selection.js tools\check_activity4_q2_dropdown.js tools\check_activity4_q4_selection.js tools\check_admin_guia2_respuestas.js tools\check_redes_quiz_visibility.js tools\check_redesign_rollout.js tools\check_shared_apps_script_button.js tools\check_shared_drive_delivery.js tools\validar_estructura_portal.ps1 tests\root_html_cleanup_structure.test.cjs tests\generated_pages_build.test.cjs tests\guia_redes_runtime_loader.test.cjs
git commit -m "refactor: move auxiliary html pages out of root"
```

Expected: one commit with the root cleanup fully implemented and verified.
