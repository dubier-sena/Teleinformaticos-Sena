# Unificacion de Paginas de Guias Design

**Fecha:** 2026-04-16  
**Estado:** Aprobado en conversacion, pendiente de revision del documento  
**Alcance:** Portal local de guias SENA, fase 1 de refactor estructural

---

## Objetivo

Reducir la duplicacion de las paginas HTML de guias por grupo sin cambiar las URLs publicas, sin romper el comportamiento actual del portal y sin reescribir todavia la logica grande de `auth`, `template` o actividades.

La salida visible para el navegador debe seguir siendo la misma:

- archivos HTML finales en la raiz del proyecto;
- mismos nombres de archivo;
- misma navegacion y enlaces cruzados;
- mismo soporte para `window.location.pathname`;
- mismas claves funcionales derivadas del nombre de archivo.

---

## Problema que resuelve

El proyecto actual tiene varias guias duplicadas por grupo con diferencias muy pequenas entre copias. Esto genera tres problemas:

1. cada correccion manual debe repetirse en dos archivos casi identicos;
2. el riesgo de desalinear una copia frente a la otra es alto;
3. el mantenimiento futuro se vuelve mas costoso antes incluso de tocar la deuda tecnica de los scripts grandes.

En la revision del proyecto se confirmo que varias parejas de archivos difieren solo en unas pocas lineas relacionadas con:

- titulo de la pagina;
- grupo y ficha por defecto;
- nombres de archivos enlazados;
- textos cortos visibles en la interfaz.

---

## Decision aprobada

Se aprueba la opcion:

**Plantilla fuente + paginas generadas**

Esto significa que:

- seguiremos entregando HTML finales con los mismos nombres actuales;
- pero dejaremos de editarlos como fuente primaria;
- la fuente editable pasara a una plantilla compartida por familia de guias;
- y un generador local reconstruira los HTML finales desde esa plantilla y una definicion de variantes.

Se descartan en esta fase:

- una SPA o renderizado completo en tiempo de ejecucion;
- cambios de routing;
- cambio de nombres de archivos publicos;
- reescritura grande de `portal_auth.js`, `guia_template.js`, `script_guia2.js` o `script_guia6.js`;
- introduccion de bundlers, framework o pipeline de build complejo.

---

## Resultado esperado

Al finalizar esta fase:

- las guias duplicadas seleccionadas se mantendran desde una fuente unica;
- las paginas finales seguiran existiendo en la raiz con sus nombres actuales;
- el navegador, `localStorage`, `window.location.pathname` y los enlaces existentes no notaran el cambio;
- el mantenimiento de esas familias de paginas sera mas rapido y menos propenso a errores;
- el proyecto quedara listo para la siguiente fase, donde se separaran configuraciones y datos repetidos del codigo.

---

## No objetivos

Esta fase no busca:

- redisenar visualmente las guias;
- cambiar el contenido pedagogico aprobado;
- reestructurar toda la logica JavaScript del proyecto;
- eliminar todavia el uso actual de `onclick` inline;
- cambiar el modelo de almacenamiento o sincronizacion;
- resolver toda la deuda tecnica del repo en una sola iteracion.

---

## Alcance aprobado de la fase 1

Solo se unificaran primero las familias HTML con alta duplicacion y diferencias pequenas:

- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`

Quedan fuera por ahora:

- paginas administrativas;
- calendario;
- formularios auxiliares y paginas satelite;
- guias que necesiten revision adicional antes de confirmar que pueden plantillarse con seguridad.

---

## Arquitectura propuesta

### 1. Fuentes editables

Se agregara una carpeta de trabajo para las fuentes compartidas:

- `sources/guides/`

Dentro de esta carpeta viviran las plantillas editables por familia:

- `sources/guides/guide-01-induccion.template.html`
- `sources/guides/guide-02-herramientas.template.html`
- `sources/guides/guide-06-planificar.template.html`

Estas plantillas no representan una pagina publica directa. Son la fuente de verdad para regenerar los HTML finales.

### 2. Variantes por grupo

Se agregara un archivo estructurado con los datos variables:

- `sources/guides/variants.json`

Ese archivo definira, por cada salida:

- archivo destino;
- nombre del grupo;
- ficha por defecto;
- institucion;
- titulos y descripciones especificas;
- enlaces a guia relacionada;
- enlaces a formulario, ficha de caso o matriz cuando cambien por grupo;
- cualquier otro valor corto que hoy obliga a duplicar la pagina completa.

### 3. Generador local

Se agregara un script local:

- `tools/build-guides.ps1`

Este script tendra una responsabilidad unica:

- leer plantillas;
- leer variantes;
- sustituir tokens definidos;
- escribir los archivos HTML finales en la raiz del proyecto.

No debe introducir dependencias de Node, Python adicional ni herramientas externas obligatorias.

### 4. Salida publica estable

Los archivos publicos seguiran existiendo exactamente donde estan hoy:

- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`

Esto protege compatibilidad con:

- accesos directos del instructor;
- enlaces cruzados ya escritos;
- scripts que dependen del nombre del archivo;
- derivacion de claves de `localStorage`;
- logica de acceso basada en archivo actual.

---

## Modelo de plantilla

Las plantillas usaran tokens explicitos y legibles, por ejemplo:

- `{{PAGE_TITLE}}`
- `{{PAGE_DESCRIPTION}}`
- `{{DEFAULT_FICHA}}`
- `{{DEFAULT_INST}}`
- `{{DEFAULT_GRUPO}}`
- `{{CURRENT_GUIDE_FILE}}`
- `{{RELATED_GUIDE_FILE}}`
- `{{FORM_FILE}}`
- `{{CASO_FILE}}`
- `{{MATRIZ_FILE}}`

La sustitucion debe ser simple y transparente. No se busca crear un motor de templates generico; solo un mecanismo pequeno y confiable para este repo.

Si una plantilla necesitara bloques condicionales complejos, eso seria una senal de que esa familia aun no esta lista para entrar en esta fase.

---

## Reglas de migracion

### Regla 1: las URLs no cambian

No se renombraran ni se moveran los archivos publicos generados.

### Regla 2: la logica JS actual se preserva

No se alterara el comportamiento de scripts grandes salvo ajustes minimos de compatibilidad si se detecta una dependencia puntual.

### Regla 3: el archivo final no se edita a mano

Cada HTML generado llevara un comentario visible al inicio indicando:

- que es un archivo generado;
- cual es su plantilla fuente;
- y que las ediciones permanentes deben hacerse en `sources/guides/`.

### Regla 4: solo entra lo que sea claramente parametrizable

Antes de migrar una familia, se debe comprobar que sus diferencias reales son pequenas y estables. Si aparecen diferencias semanticas o estructurales mayores, esa familia debe posponerse.

### Regla 5: salida deterministica

Ejecutar el generador dos veces sin cambios de entrada debe producir exactamente el mismo HTML final.

---

## Flujo de trabajo esperado

El flujo de mantenimiento quedara asi:

1. editar la plantilla fuente correspondiente en `sources/guides/`;
2. editar `sources/guides/variants.json` si cambia un dato por grupo;
3. ejecutar `tools/build-guides.ps1`;
4. revisar el diff de los archivos generados;
5. validar localmente que las paginas siguen cargando.

---

## Archivos candidatos a intervenir

### Nuevos archivos

- `sources/guides/guide-01-induccion.template.html`
- `sources/guides/guide-02-herramientas.template.html`
- `sources/guides/guide-06-planificar.template.html`
- `sources/guides/variants.json`
- `tools/build-guides.ps1`
- documentacion corta de uso dentro de `docs/` o comentario dentro del propio flujo

### Archivos existentes a regenerar

- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`

### Archivos existentes que solo podrian tocarse si aparece una compatibilidad minima

- `js/portal_auth.js`
- `js/guia_template.js`
- `js/script_guia2.js`
- `js/script_guia6.js`

La expectativa es no modificarlos en esta fase o hacerlo de forma minima y justificada.

---

## Riesgos y mitigacion

### 1. Diferencias ocultas entre dos paginas aparentemente iguales

Mitigacion:

- comparar con diff antes de plantillar;
- empezar solo por familias con diferencias pequenas y explicables;
- dejar fuera cualquier archivo que muestre desviaciones reales de contenido o estructura.

### 2. Romper nombres de archivo de los que depende la logica JS

Mitigacion:

- conservar exactamente los nombres actuales en los archivos finales;
- no mover la salida fuera de la raiz;
- validar rutas y atributos `data-*` despues de regenerar.

### 3. Reintroducir ediciones manuales en archivos generados

Mitigacion:

- incluir encabezado de archivo generado;
- documentar el flujo minimo de trabajo;
- centralizar el mantenimiento en plantilla + variantes.

### 4. Hacer un sistema de templates demasiado complejo

Mitigacion:

- usar sustitucion de tokens simple;
- evitar condicionales elaborados en esta fase;
- si una familia requiere demasiada logica, posponerla para una iteracion posterior.

---

## Verificacion requerida

Antes de dar por buena la fase 1, se debe comprobar:

- que los archivos generados mantienen los mismos nombres publicos;
- que los titulos, `data-default-*`, enlaces cruzados y rutas relacionadas sean correctos por grupo;
- que `window.location.pathname` siga resolviendo el archivo esperado;
- que las paginas generadas carguen localmente sin errores evidentes;
- que el diff muestre solo cambios esperados por la migracion al sistema de plantillas;
- que una segunda ejecucion del generador no introduzca cambios extra.

---

## Entregable de la siguiente etapa

La siguiente etapa no sera aun la refactorizacion completa del proyecto, sino un `plan de implementacion detallado` para ejecutar esta fase 1 de forma segura.

Ese plan debe cubrir:

- preparacion de fuentes y variantes;
- construccion del generador local;
- migracion por familia de guias;
- validacion local;
- documentacion minima del nuevo flujo.
