# Etapa Productiva Fase 2 Estudiante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una vista privada para que cada aprendiz de 11A y 11B vea solamente su proyecto de etapa productiva y el historial de informes asociados.

**Architecture:** La fase 2 se apoya en el catalogo ya importado por el panel administrativo y reutiliza `productive_stage_store.js` como fuente de verdad. La nueva pagina del estudiante lee el snapshot, resuelve los proyectos visibles a partir del `studentIndex` y muestra una interfaz independiente, protegida por sesion, enlazada desde el portal y desde las guias de 11A y 11B.

**Tech Stack:** HTML, CSS y JavaScript vanilla, `portal_auth`, `productive_stage_store`, almacenamiento local/nube ya existente del portal, pruebas Node basadas en inspeccion de HTML/JS.

---

### Task 1: Pruebas base de visibilidad y enlaces

**Files:**
- Create: `C:\Users\PC\Downloads\Pagina_Web\tools\check_productive_stage_student_page.js`
- Create: `C:\Users\PC\Downloads\Pagina_Web\tools\check_productive_stage_student_links.js`

- [ ] **Step 1: Escribir la prueba de la nueva pagina privada**

```js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "etapa-productiva-estudiante.html");
if (!fs.existsSync(htmlPath)) {
  throw new Error("La pagina privada de etapa productiva aun no existe.");
}
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falle**

Run: `node tools/check_productive_stage_student_page.js`  
Expected: FAIL indicando que la pagina aun no existe o que faltan bloques clave.

- [ ] **Step 3: Escribir la prueba de enlaces desde portal y guias 11**

```js
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!indexHtml.includes("etapa-productiva-estudiante.html")) {
  throw new Error("El portal aun no enlaza la vista privada de etapa productiva.");
}
```

- [ ] **Step 4: Ejecutar la prueba y verificar que falle**

Run: `node tools/check_productive_stage_student_links.js`  
Expected: FAIL indicando ausencia de enlaces o marcadores de la vista privada.

### Task 2: Selectores de visibilidad por estudiante

**Files:**
- Modify: `C:\Users\PC\Downloads\Pagina_Web\js\productive_stage_store.js`
- Create: `C:\Users\PC\Downloads\Pagina_Web\tools\check_productive_stage_student_selector.js`

- [ ] **Step 1: Escribir la prueba de seleccion por `studentIndex`**

```js
const store = require("../js/productive_stage_store.js");

const snapshot = {
  projects: [
    { id: "p-1", projectTitle: "Proyecto A", studentUsernameKeys: ["ana"] },
    { id: "p-2", projectTitle: "Proyecto B", studentUsernameKeys: ["luis"] },
  ],
  reports: [
    { reportId: "r-1", projectId: "p-1", reportType: "Retroalimentacion" },
  ],
  studentIndex: { ana: ["p-1"], luis: ["p-2"] },
};

const visible = store.getStudentProjects(snapshot, "ana");
if (visible.length !== 1 || visible[0].id !== "p-1") {
  throw new Error("La seleccion por estudiante no filtra correctamente.");
}
```

- [ ] **Step 2: Ejecutar la prueba y verificar que falle**

Run: `node tools/check_productive_stage_student_selector.js`  
Expected: FAIL con `getStudentProjects is not a function`.

- [ ] **Step 3: Implementar helpers minimos y puros en el store**

```js
function getStudentProjectIds(snapshot, usernameKey) {
  const key = String(usernameKey || "").trim().toLowerCase();
  const index = snapshot && snapshot.studentIndex && typeof snapshot.studentIndex === "object"
    ? snapshot.studentIndex
    : {};
  return Array.isArray(index[key]) ? index[key].slice() : [];
}

function getStudentProjects(snapshot, usernameKey) {
  const ids = getStudentProjectIds(snapshot, usernameKey);
  return (Array.isArray(snapshot?.projects) ? snapshot.projects : []).filter((project) =>
    ids.includes(project.id)
  );
}

function getProjectReports(snapshot, projectId) {
  return (Array.isArray(snapshot?.reports) ? snapshot.reports : [])
    .filter((report) => report.projectId === projectId)
    .sort((left, right) => Date.parse(right.importedAt || right.reportDate || 0) - Date.parse(left.importedAt || left.reportDate || 0));
}
```

- [ ] **Step 4: Ejecutar la prueba y verificar que pase**

Run: `node tools/check_productive_stage_student_selector.js`  
Expected: PASS confirmando helpers de visibilidad por estudiante.

### Task 3: Pagina privada del estudiante

**Files:**
- Create: `C:\Users\PC\Downloads\Pagina_Web\etapa-productiva-estudiante.html`
- Create: `C:\Users\PC\Downloads\Pagina_Web\css\page_productive_stage_student.css`
- Create: `C:\Users\PC\Downloads\Pagina_Web\js\productive_stage_student.js`

- [ ] **Step 1: Escribir la estructura HTML con proteccion de acceso**

```html
<script src="js/portal_auth.js?v=20260409_2"></script>
<script src="js/firebase_db.js?v=20260410_1"></script>
<script defer src="js/productive_stage_store.js?v=20260411_1"></script>
<script>
if (!window.portalAuth) {
  document.documentElement.innerHTML = "";
  throw new Error("Portal auth requerido.");
}
</script>
```

- [ ] **Step 2: Implementar la validacion minima de sesion y ficha**

```js
function isAllowedStudentSession(session) {
  if (!session) return false;
  if (session.role === "admin") return true;
  return session.role === "student" && ["3168850", "3168852"].includes(String(session.user?.ficha || ""));
}
```

- [ ] **Step 3: Renderizar proyecto, integrantes, estado e historial**

```js
const projects = store.getStudentProjects(snapshot, session.user.usernameKey);
const project = projects[0] || null;
const reports = project ? store.getProjectReports(snapshot, project.id) : [];
```

- [ ] **Step 4: Ejecutar la prueba de pagina y verificar que pase**

Run: `node tools/check_productive_stage_student_page.js`  
Expected: PASS indicando que existen la pagina privada, el guion de render y los bloques principales.

### Task 4: Integracion desde portal y guias 11A/11B

**Files:**
- Modify: `C:\Users\PC\Downloads\Pagina_Web\index.html`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\js\index_auth.js`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\grupo-11a-guia-06-planificar-informacion.html`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\grupo-11b-guia-06-planificar-informacion.html`

- [ ] **Step 1: Agregar enlace contextual en la tarjeta de sesion del portal**

```js
if (session.role === "student" && ["3168850", "3168852"].includes(String(session.user.ficha || ""))) {
  labels.push("Mi proyecto de etapa productiva");
}
```

- [ ] **Step 2: Agregar boton real hacia la pagina privada**

```html
<a class="btn-share tertiary" id="btn-productive-stage-access" href="etapa-productiva-estudiante.html">
  Mi proyecto y retroalimentacion
</a>
```

- [ ] **Step 3: Agregar enlace lateral en las guias 11A y 11B**

```html
<a class="nav-home-link" href="etapa-productiva-estudiante.html">&#128188; <span>Mi proyecto</span></a>
```

- [ ] **Step 4: Ejecutar la prueba de enlaces y verificar que pase**

Run: `node tools/check_productive_stage_student_links.js`  
Expected: PASS confirmando accesos desde portal y guias 11.

### Task 5: Verificacion de regresiones y estado final

**Files:**
- Reuse pruebas existentes y nuevas del modulo

- [ ] **Step 1: Ejecutar `node tools/check_productive_stage_student_selector.js`**
- [ ] **Step 2: Ejecutar `node tools/check_productive_stage_student_page.js`**
- [ ] **Step 3: Ejecutar `node tools/check_productive_stage_student_links.js`**
- [ ] **Step 4: Ejecutar `node tools/check_productive_stage_admin_import.js`**
- [ ] **Step 5: Ejecutar `node tools/check_admin_ficha_filter.js`**
- [ ] **Step 6: Ejecutar `node tools/check_shared_page_layouts.js`**
- [ ] **Step 7: Corregir cualquier regresion antes de cerrar la fase**

### Notas de alcance de esta fase

- Esta fase no crea edicion manual de informes.
- Esta fase no permite que el estudiante vea proyectos sin vinculacion valida.
- Si un estudiante de 11 no tiene proyecto asociado en `studentIndex`, vera un estado vacio guiado y no el catalogo completo.
