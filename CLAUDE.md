# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static educational portal for SENA (Colombian vocational training) — "Sistemas Teleinformáticos" program. Serves groups 10A, 10B, 11A, 11B with interactive learning guides, activity tracking, and admin management. No build pipeline; pure vanilla JS + HTML + CSS deployed via Firebase Hosting.

## Deployment

```bash
firebase deploy          # Deploy to Firebase Hosting + Firestore rules
firebase deploy --only hosting   # Hosting only (skip Firestore rules)
```

There is no build step, npm, or bundler. Edits to source files are deployed directly.

## Architecture

### Static Site Structure
- **No framework, no bundler** — plain HTML files link JS/CSS via `<script>` and `<link>` tags with manual cache-busting query strings in the format `?v=YYYYMMDD_N` (e.g., `?v=20260412_2`). When modifying a JS or CSS file, bump the version string in every HTML file that references it.
- Firebase Hosting serves all files with `Cache-Control: no-store, max-age=0`.

### Authentication & State
- `js/portal_auth.js` — core auth, session management, user registry, SHA-256 password hashing. Admin credentials are hardcoded here.
- `js/index_auth.js` — auth logic specific to the portal landing page (`index.html`).
- All state persists in **localStorage** with the prefix `sena_portal_*`.
- Cloud sync to Firestore via `js/firebase_db.js` (Firestore REST API, not the real-time SDK). `js/firebase-config.js` embeds the real `projectId` and `apiKey` (public by design — security is enforced by Firestore rules + Spark plan rate limits, not secrets). See `docs/firebase-seguridad-local.md` for how to override config from the browser console without editing source.
- **Firestore rules** (`firestore.rules`): the four portal collections (`sena_portal_users`, `sena_portal_progress`, `sena_portal_guide_state`, `sena_portal_calendar`) have `allow read, write: if true`. All other collections are denied. This is intentional; the app has no Firebase Auth.

### Shell Layer
- `js/shared_shell.js` + `css/shared_shell.css` — shared sidebar/nav shell rendered on every page (hamburger menu, sidebar toggle, etc.).

### Guide System
- Each guide is a self-contained HTML file. Guide-specific logic lives in a matching `js/script_*.js` file.
- `js/guia_template.js` — shared template engine for all interactive guides (chapters, activities, progress tracking, calendar sidebar widget).
- `js/script.js` — general guide state management and Firestore sync (used by guides that don't have a dedicated script).
- `js/script_guia2.js` — largest module (3800+ lines), powers the Guía 2 tools/activities guide. **Both** `grupo-10a-guia-02-*.html` and `grupo-10b-guia-02-*.html` load this same script; the page filename determines which localStorage namespace is used (see `STORAGE_FILE_ALIASES` at the top of the file).
- `js/script_guia6.js` — guide logic for Guía 6 (11A/11B).
- `js/fichas_casos.js` — random "ficha de caso" (case card) assignment for Activity 4.

### Admin & Productive Stage
- `js/admin_usuarios.js` — user management UI (`panel-administrativo-usuarios.html`).
- `js/productive_stage_store.js` — shared data layer (localStorage + Firestore) for productive stage records; used by both admin and student modules.
- `js/productive_stage_admin.js` / `js/productive_stage_student.js` — UI for project delivery tracking.
- `js/productive_stage_project_delivery.js` — project delivery form logic.
- `js/productive_stage_import.js` — bulk import utility for productive stage data.
- `js/activity4_admin_report.js` — reporting for Activity 4 (case study assignments).

### Integrations
- `js/project_integrations.js` — defines `window.PROJECT_INTEGRATIONS` with the Google Apps Script URL and upload constraints. Load this before `shared_apps_script_delivery.js`.
- `js/shared_apps_script_delivery.js` — sends form/file submissions to the Google Apps Script endpoint.
- `js/shared_drive_delivery.js` — handles file delivery via Google Drive links.
- `js/activity_delivery.js` — activity-level delivery helpers.
- `apps-script/entregas_actividades.gs` — Google Apps Script source (deployed separately to Google Apps Script; see `docs/google-apps-script-entregas.md`).

### CSS Architecture
- `css/site_tokens.css` — all CSS custom properties (colors, spacing, typography). Always modify tokens here rather than hardcoding values.
- `css/guia_template.css` — shared guide styling (~62KB, largest stylesheet).
- `css/shared_shell.css` — sidebar/nav shell styling.
- `css/page_portal.css` — main portal/login page styling.
- Page-specific stylesheets follow `page_<name>.css` naming.

### Data & Utilities
- `data/` — academic calendar seed and records for 2026 (JS files consumed by `calendario-academico-2026.html`).
- `import_cuestionario_10b.py` — Python utility for importing quiz/questionnaire data.
- `.exe` installers are stored in Google Drive (`G:\Mi unidad\Programas_EXE`), not in this repo. Guide pages link to the Drive folder, not local binaries.
- `docs/superpowers/plans/` and `docs/superpowers/specs/` — design plans and specs for past and ongoing features.

## Key Conventions

- **Version strings** on asset URLs must be bumped manually (`YYYYMMDD_N`) after every change to a JS or CSS file. Check all HTML files that reference the changed asset.
- **localStorage keys** always use the `sena_portal_` prefix to avoid collisions.
- **Firestore** is active and open for the four portal collections. The app must still work fully offline via localStorage (Firestore is additive, not required).
- HTML guide files for paired groups follow the naming pattern `grupo-<group>-guia-NN-<slug>.html`. Paired groups (10A/10B, 11A/11B) share JS logic; the page filename determines the storage namespace.
- The CSP `meta` tag in guide HTML files restricts external connections; if adding a new third-party host, update the CSP on each affected HTML file.

## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.
