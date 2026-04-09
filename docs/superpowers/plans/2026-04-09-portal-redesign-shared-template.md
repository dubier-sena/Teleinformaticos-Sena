# Portal Redesign Shared Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar una nueva plantilla compartida para portal, guias, panel administrativo y calendario con la direccion visual `Laboratorio tecnologico / B1. SENA tecnico`, sin romper el contenido ni la logica actual.

**Architecture:** La implementacion se hara en capas. Primero se crea una base compartida de diseno y un shell reusable; luego se migra una pagina piloto (`index.html` + `grupo-10a-guia-02-herramientas-informaticas-digitales.html`), se valida su estabilidad y despues se extiende al resto de guias y modulos. La logica funcional existente se preserva, priorizando cambios visuales y de estructura ligera antes que reescrituras profundas.

**Tech Stack:** HTML estatico, CSS nativo, JavaScript vanilla, PowerShell para verificacion, Node.js para checks estructurales.

---

## File Structure

**Create:**
- `css/site_tokens.css`
- `css/shared_shell.css`
- `css/page_portal.css`
- `css/page_admin.css`
- `css/page_calendar.css`
- `js/shared_shell.js`
- `tools/check_shared_template_foundation.js`
- `tools/check_pilot_redesign.js`
- `tools/check_redesign_rollout.js`
- `docs/superpowers/plans/2026-04-09-portal-redesign-shared-template.md`

**Modify:**
- `.gitignore`
- `index.html`
- `css/guia_template.css`
- `js/guia_template.js`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11b-guia-06-planificar-informacion.html`
- `plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html`
- `plantilla-grado-11-guia-06-planificar-informacion.html`
- `panel-administrativo-usuarios.html`
- `calendario-academico-2026.html`
- `tools/publicar_github_pages.md`

**Verify:**
- `js/admin_usuarios.js`
- `js/script_guia2.js`
- `js/script_guia6.js`
- `js/script_induccion.js`
- `tools/validar_estructura_portal.ps1`

---

### Task 1: Create the Shared Design Foundation

**Files:**
- Create: `css/site_tokens.css`
- Create: `css/shared_shell.css`
- Create: `js/shared_shell.js`
- Create: `tools/check_shared_template_foundation.js`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing foundation check**

```js
// tools/check_shared_template_foundation.js
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const requiredFiles = [
  "css/site_tokens.css",
  "css/shared_shell.css",
  "js/shared_shell.js",
];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing shared foundation file: ${relativePath}`);
  }
}

const gitignore = fs.readFileSync(path.join(projectRoot, ".gitignore"), "utf8");
if (!gitignore.includes(".superpowers/")) {
  throw new Error("Missing .superpowers/ ignore rule in .gitignore");
}

console.log("Shared foundation files present.");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `node tools/check_shared_template_foundation.js`

Expected: FAIL with at least one message like `Missing shared foundation file`.

- [ ] **Step 3: Create the design tokens file**

```css
/* css/site_tokens.css */
:root {
  --font-display: "Outfit", "Segoe UI", system-ui, sans-serif;
  --font-body: "Inter", "Segoe UI", system-ui, sans-serif;

  --bg-canvas: #edf3ef;
  --surface-1: #ffffff;
  --surface-2: #f5faf7;
  --surface-dark: #071a12;

  --brand-700: #0a5c31;
  --brand-600: #007934;
  --brand-500: #0fbf64;
  --brand-300: #9fe3b7;
  --accent-gold: #f5b700;

  --text-strong: #102117;
  --text-muted: #5f7468;
  --border-soft: #d6e2da;

  --radius-sm: 10px;
  --radius-md: 18px;
  --radius-lg: 28px;

  --shadow-sm: 0 6px 18px rgba(7, 26, 18, 0.08);
  --shadow-md: 0 14px 36px rgba(7, 26, 18, 0.12);

  --motion-fast: 160ms ease;
  --motion-base: 240ms ease;
}
```

- [ ] **Step 4: Create the shared shell stylesheet**

```css
/* css/shared_shell.css */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--text-strong);
  background:
    radial-gradient(circle at top right, rgba(15, 191, 100, 0.12), transparent 28%),
    linear-gradient(180deg, #f4f8f5 0%, var(--bg-canvas) 100%);
}

.app-shell {
  min-height: 100vh;
}

.app-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #04140d 0%, #0a2c1c 54%, #0d3f28 100%);
  color: #fff;
}

.app-hero__inner,
.app-main {
  width: min(1200px, calc(100% - 32px));
  margin: 0 auto;
}

.app-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 700;
  transition: transform var(--motion-fast), background var(--motion-fast);
}

.app-btn:hover {
  transform: translateY(-1px);
}

.app-btn--primary {
  background: linear-gradient(135deg, var(--brand-700), var(--brand-500));
  color: #fff;
}

.app-btn--ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}
```

- [ ] **Step 5: Create the shared shell behavior script**

```js
// js/shared_shell.js
(function () {
  function markShellReady() {
    document.documentElement.classList.add("shell-ready");
  }

  function attachRevealMotion() {
    document.querySelectorAll("[data-reveal]").forEach((element, index) => {
      element.style.setProperty("--reveal-index", String(index));
      element.classList.add("is-visible");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    markShellReady();
    attachRevealMotion();
  });
})();
```

- [ ] **Step 6: Ignore brainstorm artifacts**

```gitignore
tmp/
Thumbs.db
.DS_Store
.firebase/
firebase-debug.log
firebase-debug.*.log
.superpowers/
```

- [ ] **Step 7: Run the foundation check to verify it passes**

Run: `node tools/check_shared_template_foundation.js`

Expected: PASS with `Shared foundation files present.`

- [ ] **Step 8: Commit the foundation**

```bash
git add .gitignore css/site_tokens.css css/shared_shell.css js/shared_shell.js tools/check_shared_template_foundation.js
git commit -m "feat: add shared redesign foundation"
```

---

### Task 2: Migrate the Portal to the Shared Shell

**Files:**
- Create: `css/page_portal.css`
- Modify: `index.html`
- Test: `tools/check_pilot_redesign.js`

- [ ] **Step 1: Write a failing pilot structure check**

```js
// tools/check_pilot_redesign.js
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const guideHtml = fs.readFileSync(
  path.join(projectRoot, "grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
  "utf8"
);

const indexNeedles = [
  'href="css/site_tokens.css"',
  'href="css/shared_shell.css"',
  'href="css/page_portal.css"',
  'src="js/shared_shell.js"',
  'class="app-shell"',
];

for (const needle of indexNeedles) {
  if (!indexHtml.includes(needle)) {
    throw new Error(`Portal missing shared shell marker: ${needle}`);
  }
}

if (!guideHtml.includes('href="css/site_tokens.css"')) {
  throw new Error("Pilot guide is not connected to shared tokens yet.");
}

console.log("Pilot redesign markers present.");
```

- [ ] **Step 2: Run the pilot structure check to verify it fails**

Run: `node tools/check_pilot_redesign.js`

Expected: FAIL with a message like `Portal missing shared shell marker`.

- [ ] **Step 3: Create the portal-specific stylesheet**

```css
/* css/page_portal.css */
.portal-grid {
  display: grid;
  gap: 18px;
}

.portal-guides {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.guide-card {
  position: relative;
  padding: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.guide-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(15, 191, 100, 0.1);
  color: var(--brand-700);
  font-size: 12px;
  font-weight: 700;
}
```

- [ ] **Step 4: Move the portal onto the shared shell**

```html
<!-- index.html head -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/site_tokens.css?v=20260409_1">
<link rel="stylesheet" href="css/shared_shell.css?v=20260409_1">
<link rel="stylesheet" href="css/page_portal.css?v=20260409_1">
<script defer src="js/shared_shell.js?v=20260409_1"></script>
```

```html
<!-- index.html body wrapper -->
<body class="app-shell app-shell--portal">
  <header class="app-hero">
    <div class="app-hero__inner" data-reveal>
      <!-- hero actual remaquetado -->
    </div>
  </header>
  <main class="app-main portal-grid">
    <!-- tarjetas actuales adaptadas a guide-card -->
  </main>
</body>
```

- [ ] **Step 5: Rebuild the guide card markup on the portal**

```html
<article class="guide-card" data-reveal>
  <span class="guide-card__badge">Guia disponible</span>
  <h3>Guia 2 · Operar herramientas informaticas y digitales</h3>
  <p>Diagnostico digital, herramientas TIC y actividades interactivas por seccion.</p>
  <div class="guide-card__actions">
    <a class="app-btn app-btn--primary" href="grupo-10a-guia-02-herramientas-informaticas-digitales.html">Abrir guia</a>
  </div>
</article>
```

- [ ] **Step 6: Run the pilot structure check to verify the portal side passes**

Run: `node tools/check_pilot_redesign.js`

Expected: FAIL only because the pilot guide is still missing shared token imports.

- [ ] **Step 7: Commit the portal migration**

```bash
git add css/page_portal.css index.html tools/check_pilot_redesign.js
git commit -m "feat: migrate portal to shared shell"
```

---

### Task 3: Apply the Shared Template to the Pilot Guide

**Files:**
- Modify: `css/guia_template.css`
- Modify: `js/guia_template.js`
- Modify: `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- Test: `tools/check_pilot_redesign.js`

- [ ] **Step 1: Add shared foundation imports to the pilot guide**

```html
<!-- grupo-10a-guia-02-herramientas-informaticas-digitales.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/site_tokens.css?v=20260409_1">
<link rel="stylesheet" href="css/shared_shell.css?v=20260409_1">
<link rel="stylesheet" href="css/guia_template.css?v=20260409_1">
<script defer src="js/shared_shell.js?v=20260409_1"></script>
```

- [ ] **Step 2: Refactor guide CSS to consume shared tokens instead of hardcoded values**

```css
/* css/guia_template.css */
body {
  font-family: var(--font-body);
  color: var(--text-strong);
  background:
    radial-gradient(circle at top right, rgba(15, 191, 100, 0.12), transparent 28%),
    linear-gradient(180deg, #eff5f0 0%, var(--bg-canvas) 100%);
}

.sidebar {
  background: linear-gradient(180deg, #05140d 0%, #0a2618 100%);
}

.card,
.activity,
.support-card,
.checklist-card {
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 3: Upgrade the guide interaction shell**

```js
// js/guia_template.js
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".activity, .card, .support-card, .checklist-card").forEach(function (element) {
    element.setAttribute("data-reveal", "");
  });
});
```

- [ ] **Step 4: Reframe guide activities as mission cards without changing content**

```html
<!-- inside the pilot guide -->
<div class="activity open mission-card">
  <div class="activity-header">
    <span class="activity-num">3.2.1</span>
    <span class="activity-title">Cuestionario de conocimientos previos</span>
    <span class="mission-chip">Mision diagnostica</span>
  </div>
  <div class="activity-body">
    <!-- contenido actual intacto -->
  </div>
</div>
```

- [ ] **Step 5: Run the pilot structure check to verify it now passes**

Run: `node tools/check_pilot_redesign.js`

Expected: PASS with `Pilot redesign markers present.`

- [ ] **Step 6: Run syntax checks for shared guide behavior**

Run: `node --check js/guia_template.js`

Expected: PASS with no output.

- [ ] **Step 7: Commit the pilot guide migration**

```bash
git add css/guia_template.css js/guia_template.js grupo-10a-guia-02-herramientas-informaticas-digitales.html
git commit -m "feat: apply shared redesign to pilot guide"
```

---

### Task 4: Roll Out the Shared Template Across All Guides

**Files:**
- Modify: `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- Modify: `grupo-10a-guia-01-induccion.html`
- Modify: `grupo-10b-guia-01-induccion.html`
- Modify: `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- Modify: `grupo-11a-guia-06-planificar-informacion.html`
- Modify: `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- Modify: `grupo-11b-guia-06-planificar-informacion.html`
- Modify: `plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html`
- Modify: `plantilla-grado-11-guia-06-planificar-informacion.html`
- Create: `tools/check_redesign_rollout.js`

- [ ] **Step 1: Write the failing rollout check**

```js
// tools/check_redesign_rollout.js
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const guideFiles = [
  "grupo-10a-guia-01-induccion.html",
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-01-induccion.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11a-guia-06-planificar-informacion.html",
  "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
  "grupo-11b-guia-06-planificar-informacion.html",
  "plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html",
  "plantilla-grado-11-guia-06-planificar-informacion.html",
];

for (const fileName of guideFiles) {
  const html = fs.readFileSync(path.join(projectRoot, fileName), "utf8");
  if (!html.includes('href="css/site_tokens.css"')) {
    throw new Error(`Guide missing site tokens import: ${fileName}`);
  }
  if (!html.includes('src="js/shared_shell.js"')) {
    throw new Error(`Guide missing shared shell script: ${fileName}`);
  }
}

console.log("Shared redesign rollout markers present on all guides.");
```

- [ ] **Step 2: Run the rollout check to verify it fails**

Run: `node tools/check_redesign_rollout.js`

Expected: FAIL for the first guide that has not been migrated yet.

- [ ] **Step 3: Apply the shared imports to every guide and template**

```html
<link rel="stylesheet" href="css/site_tokens.css?v=20260409_1">
<link rel="stylesheet" href="css/shared_shell.css?v=20260409_1">
<script defer src="js/shared_shell.js?v=20260409_1"></script>
```

- [ ] **Step 4: Align guide wrappers and mission styling on all guide pages**

```html
<body class="app-shell app-shell--guide">
  <div class="layout app-layout">
    <!-- sidebar existente -->
    <div class="main app-main">
      <!-- contenido existente -->
    </div>
  </div>
</body>
```

- [ ] **Step 5: Keep 10A and 10B mirrored after the redesign**

```powershell
@'
const fs = require("fs");
const a = fs.readFileSync("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "utf8");
const b = fs.readFileSync("grupo-10b-guia-02-herramientas-informaticas-digitales.html", "utf8");
const normalizedA = a
  .replaceAll("3441939", "3441942")
  .replaceAll("10A", "10B")
  .replaceAll("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "grupo-10b-guia-02-herramientas-informaticas-digitales.html")
  .replaceAll("grupo-10a-guia-01-induccion.html", "grupo-10b-guia-01-induccion.html");
if (normalizedA !== b) {
  throw new Error("10A and 10B redesign drift detected.");
}
console.log("10A and 10B remain aligned.");
'@ | node -
```

- [ ] **Step 6: Run the rollout check to verify it passes**

Run: `node tools/check_redesign_rollout.js`

Expected: PASS with `Shared redesign rollout markers present on all guides.`

- [ ] **Step 7: Commit the guide rollout**

```bash
git add tools/check_redesign_rollout.js grupo-10a-guia-01-induccion.html grupo-10b-guia-01-induccion.html grupo-10b-guia-02-herramientas-informaticas-digitales.html grupo-11a-guia-05-herramientas-informaticas-digitales.html grupo-11a-guia-06-planificar-informacion.html grupo-11b-guia-05-herramientas-informaticas-digitales.html grupo-11b-guia-06-planificar-informacion.html plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html plantilla-grado-11-guia-06-planificar-informacion.html
git commit -m "feat: roll out shared redesign to all guides"
```

---

### Task 5: Migrate the Admin Panel and Calendar

**Files:**
- Create: `css/page_admin.css`
- Create: `css/page_calendar.css`
- Modify: `panel-administrativo-usuarios.html`
- Modify: `calendario-academico-2026.html`
- Verify: `js/admin_usuarios.js`

- [ ] **Step 1: Externalize the admin styles into a page stylesheet**

```css
/* css/page_admin.css */
.admin-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.admin-user-card {
  background: linear-gradient(180deg, #ffffff 0%, #f7fbf8 100%);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 2: Connect the admin page to the shared shell**

```html
<!-- panel-administrativo-usuarios.html -->
<link rel="stylesheet" href="css/site_tokens.css?v=20260409_1">
<link rel="stylesheet" href="css/shared_shell.css?v=20260409_1">
<link rel="stylesheet" href="css/page_admin.css?v=20260409_1">
<script defer src="js/shared_shell.js?v=20260409_1"></script>
```

- [ ] **Step 3: Externalize the calendar styles into a page stylesheet**

```css
/* css/page_calendar.css */
.calendar-shell {
  background: linear-gradient(180deg, #f5f8f6 0%, var(--bg-canvas) 100%);
}

.calendar-month-card,
.calendar-filter-bar,
.calendar-kpi-card {
  background: var(--surface-1);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 4: Connect the calendar page to the shared shell**

```html
<!-- calendario-academico-2026.html -->
<link rel="stylesheet" href="css/site_tokens.css?v=20260409_1">
<link rel="stylesheet" href="css/shared_shell.css?v=20260409_1">
<link rel="stylesheet" href="css/page_calendar.css?v=20260409_1">
<script defer src="js/shared_shell.js?v=20260409_1"></script>
```

- [ ] **Step 5: Run admin script syntax verification**

Run: `node --check js/admin_usuarios.js`

Expected: PASS with no output.

- [ ] **Step 6: Commit the admin and calendar migration**

```bash
git add css/page_admin.css css/page_calendar.css panel-administrativo-usuarios.html calendario-academico-2026.html
git commit -m "feat: migrate admin and calendar to shared shell"
```

---

### Task 6: Prepare Static Deployment and Run Final Verification

**Files:**
- Modify: `tools/publicar_github_pages.md`
- Verify: `tools/check_shared_template_foundation.js`
- Verify: `tools/check_pilot_redesign.js`
- Verify: `tools/check_redesign_rollout.js`
- Verify: `tools/validar_estructura_portal.ps1`

- [ ] **Step 1: Update the GitHub Pages publication guide**

```md
## Flujo recomendado

1. Crear un repositorio en GitHub.
2. Subir el contenido de `Pagina_Web` en la rama principal.
3. Entrar a `Settings > Pages`.
4. Elegir `Deploy from a branch`.
5. Seleccionar la rama `main` y la carpeta `/root`.
6. Guardar y esperar la URL publica.
```

- [ ] **Step 2: Verify the shared foundation**

Run: `node tools/check_shared_template_foundation.js`

Expected: PASS with `Shared foundation files present.`

- [ ] **Step 3: Verify the pilot redesign**

Run: `node tools/check_pilot_redesign.js`

Expected: PASS with `Pilot redesign markers present.`

- [ ] **Step 4: Verify the guide rollout**

Run: `node tools/check_redesign_rollout.js`

Expected: PASS with `Shared redesign rollout markers present on all guides.`

- [ ] **Step 5: Run the project structure validation**

Run: `powershell -ExecutionPolicy Bypass -File tools/validar_estructura_portal.ps1`

Expected: PASS with the structure report completing without errors.

- [ ] **Step 6: Run JavaScript syntax checks**

Run: `node --check js/guia_template.js`

Expected: PASS with no output.

Run: `node --check js/shared_shell.js`

Expected: PASS with no output.

Run: `node --check js/admin_usuarios.js`

Expected: PASS with no output.

- [ ] **Step 7: Commit deployment prep and verification artifacts**

```bash
git add tools/publicar_github_pages.md tools/check_shared_template_foundation.js tools/check_pilot_redesign.js tools/check_redesign_rollout.js
git commit -m "docs: prepare GitHub Pages rollout and redesign checks"
```

---

## Self-Review

### Spec coverage

- Shared visual foundation: covered by Task 1.
- Portal redesign: covered by Task 2.
- Pilot guide redesign: covered by Task 3.
- Full guide rollout: covered by Task 4.
- Admin and calendar alignment: covered by Task 5.
- Static publishing readiness: covered by Task 6.

### Placeholder scan

- No `TODO`, `TBD` or open placeholders remain.
- Every task names exact files and exact verification commands.

### Consistency check

- Shared CSS/JS file names remain consistent across all tasks.
- The pilot verification script is introduced before it is reused later.
- The rollout verification script is introduced before final verification.
