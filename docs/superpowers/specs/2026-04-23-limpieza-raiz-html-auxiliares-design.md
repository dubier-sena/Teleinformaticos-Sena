# Limpieza de la Raiz HTML con Reubicacion de Paginas Auxiliares

**Fecha:** 2026-04-23  
**Estado:** Aprobado en conversacion, pendiente de revision del documento  
**Alcance:** Segunda fase posterior a la unificacion global `runtime + generacion`

---

## Objetivo

Reducir la cantidad de archivos `.html` visibles en la raiz del proyecto sin romper las paginas principales del flujo academico.

La mejora buscada no es volver a unificar contenido interno, porque eso ya se hizo en la fase anterior. La meta ahora es **ordenar la superficie publica del repo**:

- dejar en la raiz solo las paginas principales;
- mover a una carpeta dedicada las paginas auxiliares, satelite o derivadas;
- mantener funcional la navegacion normal desde las paginas principales;
- conservar compatibilidad de apertura local con rutas relativas.

---

## Problema actual

Despues de la unificacion `runtime + generacion`, la raiz del proyecto sigue mostrando muchos `.html`.

Eso ocurre porque la fase anterior mantuvo estables los nombres publicos de archivo para no romper enlaces existentes. El resultado fue correcto a nivel de mantenimiento interno, pero visualmente la raiz sigue cargada.

Estado observado al momento de aprobar este diseno:

- `28` archivos `.html` en la raiz;
- varias guias ya reducidas a wrappers minimos de `39-45` lineas;
- contenido real consolidado en `partials/`;
- paginas auxiliares que todavia viven mezcladas con las entradas principales.

El problema ya no es la duplicacion grande de markup. El problema ahora es **organizacion y claridad del arbol del proyecto**.

---

## Alternativas evaluadas

### Opcion 1: Mantener todas las URLs en la raiz

Ventajas:

- riesgo minimo;
- no requiere mover archivos;
- no cambia rutas actuales.

Desventajas:

- la raiz casi no mejora;
- no resuelve la queja principal del usuario;
- mantiene mezcladas paginas principales y auxiliares.

### Opcion 2: Mover solo paginas auxiliares a una subcarpeta

Ventajas:

- reduce de forma real la cantidad de `.html` visibles en la raiz;
- mantiene en la raiz las paginas de entrada mas importantes;
- evita una reestructuracion total del sitio;
- el riesgo es manejable y acotado.

Desventajas:

- cambia las rutas directas de paginas auxiliares;
- exige corregir `href`, assets y salidas generadas.

### Opcion 3: Reestructuracion total del routing HTML

Ventajas:

- raiz muy limpia;
- arquitectura mas uniforme a futuro.

Desventajas:

- riesgo alto;
- rompe demasiadas rutas directas;
- requiere una migracion mucho mas amplia que esta fase.

---

## Decision aprobada

Se aprueba la **Opcion 2**:

**Mover a `pages/aux/` las paginas auxiliares y dejar en la raiz solo las paginas principales.**

La compatibilidad que se preserva es:

- apertura normal desde `index` y desde las guias principales;
- navegacion interna entre paginas principales y auxiliares;
- apertura local del proyecto con rutas relativas correctas.

La compatibilidad que se libera en esta fase es:

- abrir manualmente una URL auxiliar antigua ubicada en la raiz.

No se dejaran copias espejo en la raiz, porque eso volveria a ensuciar el arbol y desharía parte del beneficio.

---

## Alcance aprobado

### Paginas que deben permanecer en la raiz

- `index.html`
- `calendario-academico-2026.html`
- `etapa-productiva-admin.html`
- `etapa-productiva-estudiante.html`
- `panel-administrativo-usuarios.html`
- `grupo-10a-guia-01-induccion.html`
- `grupo-10b-guia-01-induccion.html`
- `grupo-10a-guia-02-herramientas-informaticas-digitales.html`
- `grupo-10b-guia-02-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11b-guia-05-herramientas-informaticas-digitales.html`
- `grupo-11a-guia-06-planificar-informacion.html`
- `grupo-11b-guia-06-planificar-informacion.html`
- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

### Paginas que deben moverse a `pages/aux/`

- `grupo-10a-guia-02-actividad-4-formulario.html`
- `grupo-10b-guia-02-actividad-4-formulario.html`
- `grupo-10a-guia-02-ficha-caso.html`
- `grupo-10b-guia-02-ficha-caso.html`
- `grupo-10a-guia-02-actividad-322-matriz.html`
- `grupo-10b-guia-02-actividad-322-matriz.html`
- `plantilla-grado-11-guia-05-herramientas-informaticas-digitales.html`
- `plantilla-grado-11-guia-06-planificar-informacion.html`
- `santa-barbara-10a-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10b-guia-02-redes-rap01-quiz.html`
- `santa-barbara-10a-guia-02-redes-ip-quiz.html`
- `santa-barbara-10b-guia-02-redes-ip-quiz.html`
- `santa-barbara-guia-02-contenido-teorico-redes.html`

### Regla de excepcion

Si durante la implementacion se descubre que una pagina marcada como auxiliar actua realmente como entrada publica principal del sistema, esa pagina no se mueve en esta fase y se documenta la excepcion en el plan.

---

## Fuera de alcance

No forman parte de esta fase:

- rehacer la unificacion `runtime` ya completada;
- redisenar el shell visual;
- convertir el proyecto en SPA;
- cambiar la logica de autenticacion o Firestore;
- introducir redirecciones servidor-side;
- dejar aliases legacy en la raiz;
- mover `partials/`, `data/`, `js/`, `css/` o `assets/` a otra estructura.

---

## Estructura objetivo

Se crea la carpeta:

- `pages/aux/`

La raiz queda reservada para las paginas principales del flujo.

Las paginas auxiliares deben quedar agrupadas por funcion, aunque no necesariamente en subcarpetas adicionales dentro de esta fase. La prioridad es limpiar la raiz con el menor numero de movimientos conceptuales posible.

---

## Reglas tecnicas de implementacion

### 1. Rutas relativas

Toda pagina movida a `pages/aux/` debe corregir sus referencias relativas para que siga cargando correctamente en apertura local.

Esto incluye, segun corresponda:

- `../css/...`
- `../js/...`
- `../data/...`
- `../assets/...`
- `../partials/...`
- enlaces de vuelta a paginas principales en la raiz

No se deben introducir rutas absolutas tipo `/css/...`, porque el proyecto se usa como sitio local y tambien por apertura directa de archivos.

### 2. Enlaces desde paginas principales

Las paginas principales que hoy apuntan a auxiliares en la raiz deben actualizar sus `href` para usar `pages/aux/...`.

Esto incluye:

- enlaces escritos directamente en wrappers principales;
- enlaces definidos dentro de parciales compartidos;
- enlaces resueltos por scripts inline de configuracion por grupo;
- salidas del sistema de generacion.

### 3. Paginas generadas

Las paginas auxiliares que ya dependen de `tools/build-generated-pages.ps1` deben pasar a generarse dentro de `pages/aux/`.

La fuente real sigue siendo:

- `sources/generated/*.template.html`
- `data/generated_page_variants.json`

Los archivos finales ya no se deben volver a escribir en la raiz si forman parte del conjunto auxiliar.

### 4. Wrappers runtime

Las paginas principales que ya quedaron como wrappers runtime permanecen en la raiz.

Sus contextos y parciales deben seguir funcionando sin cambiar su papel arquitectonico. Solo deben cambiar los enlaces salientes hacia paginas auxiliares cuando corresponda.

### 5. Contenido teorico de redes

`santa-barbara-guia-02-contenido-teorico-redes.html` se considera auxiliar compartida y debe moverse tambien a `pages/aux/`, ajustando cualquier referencia entrante desde las guias o quizzes relacionados.

---

## Impacto esperado

Objetivo visible:

- dejar la raiz con `15` archivos `.html`, correspondientes al conjunto principal aprobado

Si durante la implementacion se activa alguna excepcion documentada, el conteo final podra ser mayor, pero solo por una dependencia real confirmada y no por conservadurismo general.

Beneficios esperados:

- arbol principal mas limpio;
- separacion clara entre entradas principales y pantallas auxiliares;
- menor friccion al navegar el repo;
- mejor mantenimiento futuro de familias pequeñas.

---

## Riesgos y mitigaciones

### Riesgo 1: enlaces rotos por cambio de ubicacion

Mitigacion:

- revisar referencias entrantes a cada auxiliar movida;
- agregar pruebas especificas de `href`;
- ejecutar verificacion completa despues del movimiento.

### Riesgo 2: assets que dejan de cargar en apertura local

Mitigacion:

- corregir todas las rutas relativas de paginas movidas;
- validar manualmente al menos una muestra representativa por familia.

### Riesgo 3: generador escribiendo aun en la raiz

Mitigacion:

- mover la salida esperada del generador a `pages/aux/`;
- ajustar pruebas de build para reflejar la nueva ubicacion;
- verificar que una segunda regeneracion no deje drift inesperado.

### Riesgo 4: pagina aparentemente auxiliar pero con uso principal real

Mitigacion:

- mantener regla de excepcion documentada;
- no forzar el movimiento si la evidencia del repo muestra que esa pagina funciona como entrypoint real.

---

## Validacion requerida

### Pruebas automaticas

Se deben agregar o actualizar pruebas para verificar:

- que las paginas principales apunten a `pages/aux/...` cuando corresponda;
- que el generador emita los archivos auxiliares en su nueva ubicacion;
- que las rutas auxiliares esperadas existan en `pages/aux/`;
- que la raiz ya no contenga las paginas auxiliares migradas.

### Verificacion manual

Se debe comprobar manualmente:

1. apertura de al menos una guia principal de cada familia que enlace a auxiliares;
2. apertura del formulario y ficha de caso desde Guia 2;
3. apertura de quizzes y contenido teorico desde Redes;
4. carga correcta de CSS, JS y assets en paginas movidas;
5. regreso correcto desde auxiliares hacia paginas principales cuando aplique.

---

## Criterio de exito

La fase se considera exitosa si:

- la raiz queda reducida al conjunto principal de paginas;
- `pages/aux/` concentra las pantallas auxiliares aprobadas;
- la navegacion principal del proyecto sigue funcionando;
- el generador y las pruebas quedan alineados con la nueva estructura;
- no quedan duplicados legacy en la raiz para las auxiliares migradas.

---

## Entregables esperados

- nueva carpeta `pages/aux/`
- paginas auxiliares reubicadas
- enlaces internos actualizados
- generador actualizado
- pruebas nuevas o adaptadas
- verificacion automatica completa
- smoke-check manual minimo documentado en el cierre
