# Etapa Productiva Fase 1 Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al panel administrativo la importacion manual de informes `.docx` de etapa productiva para grados 11, con parser inicial, almacenamiento del catalogo y filtros administrativos.

**Architecture:** La fase 1 se implementa como un modulo aislado del panel administrativo. El parser del informe vive en un archivo propio reutilizable y testeable en Node y navegador; la persistencia usa una capa dedicada que guarda en localStorage y, cuando exista disponibilidad, sincroniza una copia al almacenamiento compartido del portal. La UI administrativa se integra sin romper el listado actual de aprendices.

**Tech Stack:** HTML, CSS, JavaScript vanilla, localStorage, helpers existentes de `portal_auth` y `firebase_db`, libreria local `mammoth.browser.min.js` para extraer texto del `.docx`.

---

### Task 1: Pruebas base y contrato del modulo

**Files:**
- Create: `C:\Users\PC\Downloads\Pagina_Web\tools\check_productive_stage_admin_import.js`
- Create: `C:\Users\PC\Downloads\Pagina_Web\tools\check_productive_stage_parser.js`

- [ ] **Step 1: Escribir la prueba de presencia del modulo en el panel**
- [ ] **Step 2: Ejecutar la prueba y confirmar que falle**
- [ ] **Step 3: Escribir la prueba del parser sobre un texto realista del informe**
- [ ] **Step 4: Ejecutar la prueba y confirmar que falle**

### Task 2: Parser y almacenamiento de etapa productiva

**Files:**
- Create: `C:\Users\PC\Downloads\Pagina_Web\js\productive_stage_import.js`
- Create: `C:\Users\PC\Downloads\Pagina_Web\js\productive_stage_store.js`
- Create: `C:\Users\PC\Downloads\Pagina_Web\js\vendor\mammoth.browser.min.js`

- [ ] **Step 1: Implementar utilidades puras de normalizacion y parseo del informe**
- [ ] **Step 2: Implementar extractor de texto `.docx` con `mammoth`**
- [ ] **Step 3: Implementar la capa de persistencia local + sincronizacion compartida**
- [ ] **Step 4: Ejecutar `node tools/check_productive_stage_parser.js` y dejarlo en verde**

### Task 3: UI administrativa del catalogo

**Files:**
- Modify: `C:\Users\PC\Downloads\Pagina_Web\panel-administrativo-usuarios.html`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\css\page_admin.css`
- Modify: `C:\Users\PC\Downloads\Pagina_Web\js\admin_usuarios.js`

- [ ] **Step 1: Agregar la seccion de importacion, indicadores, filtros y listado**
- [ ] **Step 2: Integrar el flujo de importacion al panel**
- [ ] **Step 3: Integrar filtros por ficha, proyecto, estudiante y estado**
- [ ] **Step 4: Agregar detalle del proyecto/importe dentro del panel**
- [ ] **Step 5: Ejecutar `node tools/check_productive_stage_admin_import.js` y dejarlo en verde**

### Task 4: Verificacion de regresiones

**Files:**
- Reuse tests existentes del panel administrador

- [ ] **Step 1: Ejecutar `node tools/check_admin_ficha_filter.js`**
- [ ] **Step 2: Ejecutar `node tools/check_admin_activity_identity_and_ficha.js`**
- [ ] **Step 3: Ejecutar `node tools/check_admin_guia2_respuestas.js`**
- [ ] **Step 4: Corregir cualquier regresion antes de cerrar la fase**

### Notas de alcance de esta fase

- Esta fase construye **solo el catalogo administrativo**.
- La vista privada del estudiante para proyectos e informes queda para la siguiente fase.
- La importacion soporta inicialmente documentos con formato equivalente a `Informe_Completo_11A_11B_2026.docx`.
