# Unificacion Global de Paginas HTML con Mezcla Runtime + Generacion

**Fecha:** 2026-04-23  
**Estado:** Aprobado en conversacion, pendiente de revision del documento  
**Alcance:** Portal local de guias SENA, fase global posterior al piloto de `Guia 2 Redes`

---

## Objetivo

Reducir la duplicacion de paginas HTML por grupo en el proyecto usando una estrategia mixta:

- `runtime` para guias grandes con mucho DOM compartido y comportamiento dinamico;
- `generacion` para paginas pequenas, estables o con diferencias cortas entre grupos.

La salida visible para el navegador debe mantenerse estable:

- mismos nombres de archivo en la raiz del proyecto;
- mismas URLs publicas;
- mismo comportamiento de autenticacion y aislamiento por grupo;
- misma compatibilidad con `window.location.pathname`;
- misma experiencia visual para estudiantes e instructores.

---

## Contexto

El piloto de `santa-barbara-10a/10b-guia-02-redes-rap01.html` ya demostro que el patron `wrapper + partial + loader runtime` funciona bien para una guia grande.

Sin embargo, no todas las paginas duplicadas del proyecto tienen el mismo perfil:

- algunas son guias grandes con mucho HTML repetido y scripts que dependen de IDs especificos;
- otras son paginas satelite o quizzes con diferencias minimas, donde un runtime adicional seria mas complejo de lo necesario;
- otras tienen diferencias reales entre grupos y requieren revision previa antes de decidir si son parametrizables.

Por eso se aprueba una estrategia mixta en vez de imponer un solo mecanismo a todo el repo.

---

## Decision aprobada

Se aprueba la arquitectura:

**Mezcla `runtime + generacion`**

La regla de decision es:

- usar `runtime` cuando la familia tenga mucho contenido comun, estructura grande y scripts que deban seguir trabajando sobre el mismo DOM compartido;
- usar `generacion` cuando la familia sea pequena o estable y sus diferencias entre grupos se reduzcan a textos, metadatos, defaults o enlaces;
- dejar fuera temporalmente cualquier familia que requiera demasiados condicionales o diferencias semanticas por grupo.

---

## Alcance aprobado

### Familias que entran por `runtime`

- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`

### Familias que entran por `generacion`

- `santa-barbara-10a-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10b-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10a-guia-02-redes-ip-quiz.html`
- `santa-barbara-10b-guia-02-redes-ip-quiz.html`
- `grupo-10a-guia-02-actividad-322-matriz.html`
- `grupo-10b-guia-02-actividad-322-matriz.html`

### Familias en revision previa

- `grupo-10a-guia-02-actividad-4-formulario.html`
- `grupo-10b-guia-02-actividad-4-formulario.html`
- `grupo-10a-guia-02-ficha-caso.html`
- `grupo-10b-guia-02-ficha-caso.html`

Estas paginas no quedan descartadas, pero no entran en la primera fase global hasta confirmar que sus diferencias entre grupos son realmente parametrizables.

---

## Fuera de alcance

No entran en esta fase:

- `index.html`
- `panel-administrativo-usuarios.html`
- `calendario-academico-2026.html`
- `etapa-productiva-admin.html`
- `etapa-productiva-estudiante.html`
- redisenos visuales;
- cambio de routing;
- migracion a SPA o framework;
- reescritura profunda de `portal_auth.js`, `firebase_db.js` o almacenamiento;
- unificacion total de cualquier familia que requiera logica condicional compleja por grupo.

---

## Arquitectura global

### 1. Runtime para familias grandes

Cada familia `runtime` tendra:

- un `partial` compartido con el contenido real de la pagina;
- wrappers minimos por grupo que preservan la URL publica;
- un registro publico de contextos;
- un loader runtime generico;
- un hook explicito de inicializacion por script de familia.

La estructura esperada es:

- wrapper publico en la raiz;
- `#page-root` como punto unico de inyeccion;
- `window.__PAGE_CONTEXT__` con la clave publica del wrapper;
- `data/page_runtime_contexts.json` para mapear archivo, grupo, ficha, parcial y hook de arranque;
- `js/page_runtime_loader.js` para cargar, validar e inicializar.

### 2. Generacion para familias pequenas

Cada familia `generada` tendra:

- una plantilla fuente editable;
- un archivo de variantes publicas por salida;
- un script local para generar los HTML finales;
- los archivos publicos resultantes escritos en la raiz, con los mismos nombres actuales.

La pagina final generada no sera la fuente primaria de mantenimiento. La fuente real vivira en plantilla + variantes.

---

## Contrato tecnico de `runtime`

### Wrappers publicos

Cada wrapper `runtime` mantiene:

- el mismo nombre de archivo publico;
- `title` y `meta description` especificos del grupo;
- los scripts base ya necesarios para auth y shell;
- la compatibilidad actual con `portal_auth.js`.

Cada wrapper se reduce a:

- declaracion de `window.__PAGE_CONTEXT__ = { key, family }`;
- `body` con `data-default-ficha`, `data-default-inst` y `data-default-grupo` vacios;
- `#page-root`;
- carga del loader runtime generico.

### Registro de contextos

Se crea:

- `data/page_runtime_contexts.json`

Cada entrada debe incluir al menos:

- `family`
- `pageFile`
- `partialPath`
- `inst`
- `grupo`
- `ficha`
- `boot`

Opcionalmente puede incluir:

- `title`
- `description`
- archivos relacionados
- enlaces o variantes cortas requeridas por la familia

### Loader generico

Se crea:

- `js/page_runtime_loader.js`

Responsabilidades:

1. leer `window.__PAGE_CONTEXT__`;
2. cargar `data/page_runtime_contexts.json`;
3. validar que el `pageFile` del contexto coincide con `window.location.pathname`;
4. cargar el `partialPath` correspondiente;
5. inyectar el partial en `#page-root`;
6. poblar `document.body.dataset.defaultInst/defaultGrupo/defaultFicha`;
7. ejecutar `window.initGuiaTemplateShell()` si la familia usa el shell de guia;
8. ejecutar el hook definido en `boot`.

### Hooks de inicializacion

Los scripts de pagina grandes deben exponer hooks explicitos:

- `window.initInduccion`
- `window.initGuia2`
- `window.initGuia5`
- `window.initGuia6`

Compatibilidad requerida:

- si `window.__PAGE_CONTEXT__` existe, el script no debe hacer autoboot por `DOMContentLoaded`;
- si `window.__PAGE_CONTEXT__` no existe, el comportamiento actual debe mantenerse para compatibilidad con paginas no migradas o pruebas legadas.

### Parciales compartidos

Se crean, como minimo:

- `partials/guia-01-induccion-content.html`
- `partials/guia-02-herramientas-content.html`
- `partials/guia-05-herramientas-content.html`
- `partials/guia-06-planificar-content.html`

Cada partial sera la unica fuente de verdad del cuerpo de su familia.

---

## Contrato tecnico de `generacion`

### Plantillas fuente

Se crea:

- `sources/generated/`

Archivos iniciales:

- `sources/generated/redes-rap01-quiz.template.html`
- `sources/generated/redes-ip-quiz.template.html`
- `sources/generated/guia-02-matriz-322.template.html`

### Variantes publicas

Se crea:

- `data/generated_page_variants.json`

Cada variante debe incluir:

- `template`
- `outputFile`
- `grupo`
- `ficha`
- `inst`
- `title`
- `description`

Opcionalmente:

- links relacionados;
- textos cortos;
- cualquier token variable necesario para evitar duplicacion del HTML completo.

### Generador local

Se crea:

- `tools/build-generated-pages.ps1`

Responsabilidades:

1. leer las plantillas en `sources/generated/`;
2. leer `data/generated_page_variants.json`;
3. sustituir tokens definidos;
4. escribir los HTML finales en la raiz;
5. producir salida deterministica;
6. incluir un comentario de advertencia indicando que el archivo final es generado.

No debe introducir dependencias externas obligatorias ni un pipeline complejo de build.

---

## Mapeo inicial por familia

### Runtime

#### Familia `guia-01-induccion`

- wrappers: `grupo-10a-guia-01-induccion.html`, `grupo-10b-guia-01-induccion.html`
- partial: `partials/guia-01-induccion-content.html`
- hook de pagina: `window.initInduccion`
- trabajo especial: extraer la logica inline actual del HTML a `js/script_induccion.js`

#### Familia `guia-02-herramientas`

- wrappers: `grupo-10a-guia-02-herramientas-informaticas-digitales.html`, `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- partial: `partials/guia-02-herramientas-content.html`
- hook de pagina: `window.initGuia2`
- base script: `js/script_guia2.js`

#### Familia `guia-05-herramientas`

- wrappers: `grupo-11a-guia-05-herramientas-informaticas-digitales.html`, `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- partial: `partials/guia-05-herramientas-content.html`
- hook de pagina: `window.initGuia5`
- base script: `js/script.js`

#### Familia `guia-06-planificar`

- wrappers: `grupo-11a-guia-06-planificar-informacion.html`, `grupo-11b-guia-06-planificar-informacion.html`
- partial: `partials/guia-06-planificar-content.html`
- hook de pagina: `window.initGuia6`
- base script: `js/script_guia6.js`

### Generacion

#### Familia `redes-rap01-quiz`

- salidas: `santa-barbara-10a-guia-02-redes-rap01-quiz.html`, `santa-barbara-10b-guia-02-redes-rap01-quiz.html`
- plantilla: `sources/generated/redes-rap01-quiz.template.html`

#### Familia `redes-ip-quiz`

- salidas: `santa-barbara-10a-guia-02-redes-ip-quiz.html`, `santa-barbara-10b-guia-02-redes-ip-quiz.html`
- plantilla: `sources/generated/redes-ip-quiz.template.html`

#### Familia `guia-02-matriz-322`

- salidas: `grupo-10a-guia-02-actividad-322-matriz.html`, `grupo-10b-guia-02-actividad-322-matriz.html`
- plantilla: `sources/generated/guia-02-matriz-322.template.html`

---

## Secuencia de migracion aprobada

### Fase 1. Infraestructura compartida

Crear primero:

- `js/page_runtime_loader.js`
- `data/page_runtime_contexts.json`
- `data/generated_page_variants.json`
- `tools/build-generated-pages.ps1`
- tests base del loader y del generador

### Fase 2. Runtime para `guia-01-induccion`

Antes de unificar wrappers:

- extraer la logica inline del HTML a `js/script_induccion.js`;
- exponer `window.initInduccion`;
- mantener compatibilidad con el comportamiento actual.

### Fase 3. Runtime para `guia-02-herramientas`

- migrar el contenido a partial;
- adelgazar wrappers;
- refactorizar `js/script_guia2.js` para `window.initGuia2`.

### Fase 4. Runtime para `guia-05` y `guia-06`

- repetir el mismo contrato con `window.initGuia5` y `window.initGuia6`.

### Fase 5. Generacion para paginas pequenas

- quizzes de redes;
- quiz IP;
- matriz `3.2.2`.

### Fase 6. Revision previa de familias dudosas

Solo si las diferencias son parametrizables:

- `actividad-4-formulario`
- `ficha-caso`

Si aparecen diferencias semanticas o de flujo, esas familias se documentan y se posponen.

---

## Regla para decidir si una familia es unificable

Una familia entra en esta fase solo si:

- las diferencias entre grupos caben en contexto o variantes;
- no requiere condicionales complejos por grupo;
- no rompe dependencias basadas en `window.location.pathname`;
- no obliga a duplicar otra vez la logica JS;
- se puede cubrir con tests de contrato razonables.

Si una familia no cumple estas reglas, no debe forzarse su migracion dentro de esta fase global.

---

## Validacion y pruebas

### Para familias `runtime`

Cada familia debe tener:

- test del loader generico;
- test del hook de boot explicito del script correspondiente;
- test de contenido contra el partial compartido;
- test de wrapper minimo;
- smoke-check manual por grupo.

### Para familias `generadas`

Cada familia debe tener:

- test del generador;
- test de salida estructural del HTML generado;
- verificacion de que los archivos finales existen en la raiz;
- smoke-check manual minimo.

### Reglas de smoke-check manual

Como minimo se debe verificar:

1. la pagina del grupo A carga correctamente;
2. la pagina del grupo B carga correctamente;
3. los valores visibles y datasets corresponden al grupo correcto;
4. auth, progreso, entregas y enlaces asociados siguen funcionando.

---

## Riesgos y mitigaciones

### Riesgo 1. Mezclar dos estrategias y perder consistencia

Mitigacion:

- definir una regla clara de decision por familia;
- mantener convenciones de nombres estables;
- documentar el contrato de cada estrategia.

### Riesgo 2. Romper dependencias basadas en el nombre del archivo

Mitigacion:

- no cambiar los nombres publicos;
- mantener wrappers o salidas generadas con los mismos filenames;
- seguir derivando claves desde el archivo actual cuando el script lo necesite.

### Riesgo 3. Mover una familia a runtime sin aislar bien su boot

Mitigacion:

- exponer hooks explicitos;
- conservar el autoboot clasico solo cuando no haya contexto runtime;
- agregar tests de boot por familia.

### Riesgo 4. Forzar a generacion una familia con diferencias semanticas reales

Mitigacion:

- usar la fase de revision previa;
- posponer cualquier familia con diferencias de flujo o contenido no parametrizable.

### Riesgo 5. Introducir regresiones invisibles al cambiar la fuente de verdad

Mitigacion:

- migrar tests hacia la fuente primaria real;
- agregar smoke-check manual por lote;
- hacer la migracion por familias, no en un cambio unico gigantesco.

---

## Criterios de aceptacion

La fase global se considera exitosa si:

- cada familia migrada tiene una sola fuente primaria de mantenimiento;
- los archivos publicos siguen existiendo en la raiz con los mismos nombres;
- las paginas siguen funcionando con auth, progreso, storage y entregas;
- el comportamiento visible no cambia para el usuario final;
- editar contenido comun de una familia requiere tocar un solo archivo fuente;
- las familias no aptas quedan documentadas y fuera, sin bloquear el resto.

---

## No objetivos

Esta fase no busca:

- eliminar todas las diferencias entre grupos a cualquier costo;
- convertir el portal en una SPA;
- introducir bundlers o frameworks;
- reescribir toda la deuda tecnica JS;
- unificar admin, index o calendario;
- reemplazar la logica actual de autenticacion.

---

## Resultado esperado

Al finalizar esta fase:

- las guias grandes seleccionadas quedaran bajo `runtime`;
- las paginas pequenas estables quedaran bajo `generacion`;
- el repo tendra una convencion clara para futuras unificaciones;
- las URLs publicas seguiran intactas;
- el mantenimiento del contenido duplicado sera mas rapido y menos propenso a errores.
