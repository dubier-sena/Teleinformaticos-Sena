# Unificacion de HTML para Guia 2 Redes

## Objetivo

Reducir la cantidad de archivos HTML duplicados del proyecto empezando por `Guia 2 Redes` como piloto, sin romper:

- URLs actuales publicadas en GitHub Pages
- flujo de autenticacion del portal
- guardado de respuestas por grupo y ficha
- enlaces existentes desde panel admin, portada y quizzes

La propuesta aprobada es un enfoque `hibrido`:

- `1 contenido compartido` por guia
- `wrappers minimos` por grupo
- `configuracion publica` separada por contexto

## Problema actual

El proyecto tiene muchos pares de archivos casi identicos por grupo, por ejemplo:

- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

En estos pares normalmente solo cambian:

- grupo (`10A`, `10B`, etc.)
- ficha
- titulo/meta visibles
- algunos enlaces internos a quiz o actividades relacionadas

Esto genera varios costos:

- el mismo cambio visual o de contenido debe hacerse varias veces
- es facil que un grupo quede desactualizado respecto a otro
- aparecen errores por copiar y pegar, como cierres de `div` sobrantes o bloques antiguos repetidos
- el mantenimiento escala mal a medida que crecen cursos, guias y variantes

## Alcance del piloto

El piloto cubrira solo `Guia 2 Redes` de Santa Barbara:

- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

No se implementa todavia en:

- quizzes
- ficha caso
- matriz 3.2.2
- guias de otros grados o instituciones

Esos quedan para fases posteriores, una vez validado el patron.

## Resultado esperado del piloto

Despues del piloto, debe existir:

- `1 contenido real` de la guia de redes
- `2 wrappers minimos` para mantener las URLs actuales de `10A` y `10B`
- `1 loader runtime` que aplique el contexto correcto
- `1 JSON de configuracion publica` con datos por grupo

El objetivo no es llegar ya a `1 sola URL publica`, sino reducir la duplicacion sin aumentar el riesgo.

## Recomendacion aprobada

Se recomienda conservar las URLs actuales y convertir cada HTML por grupo en un `wrapper minimo`.

### Por que esta opcion es la mejor

- no rompe enlaces ya compartidos con aprendices o docentes
- no rompe accesos desde panel admin
- no obliga a reconfigurar GitHub Pages ni navegacion existente
- permite migrar por partes
- reduce fuertemente la duplicacion sin introducir una reescritura total del proyecto

## Arquitectura propuesta

### 1. Contenido compartido

Crear un archivo unico que contenga el HTML real de la guia:

- `partials/guia-redes-rap01-content.html`

Este archivo sera la unica fuente de verdad para:

- cabecera de la guia
- secciones `3.1`, `3.2`, `3.3`, `3.4`
- evidencias
- glosario
- referencias
- material de apoyo

### 2. Wrappers minimos por grupo

Mantener:

- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

Pero convertirlos en archivos ligeros que solo hagan esto:

- declarar el `contextKey` del grupo
- cargar estilos comunes
- cargar el loader
- exponer un contenedor raiz, por ejemplo `#guide-root`

Estos wrappers seguiran existiendo para conservar compatibilidad con URLs actuales.

### 3. Configuracion publica por contexto

Crear:

- `data/guide_contexts.json`

Este JSON guardara solo informacion publica y no sensible, por ejemplo:

- institucion
- grupo
- ficha
- nombre visible de la guia
- archivo cloud asociado
- URLs de quizzes relacionados

Ejemplo conceptual:

```json
{
  "sb-redes-10a": {
    "inst": "Institucion Educativa Santa Barbara",
    "grupo": "10A",
    "ficha": "3441944",
    "cloudFileName": "sb_10a_redes.html",
    "quizRedesUrl": "santa-barbara-10a-guia-02-redes-rap01-quiz.html",
    "quizIpUrl": "santa-barbara-10a-guia-02-redes-ip-quiz.html"
  },
  "sb-redes-10b": {
    "inst": "Institucion Educativa Santa Barbara",
    "grupo": "10B",
    "ficha": "3441950",
    "cloudFileName": "sb_10b_redes.html",
    "quizRedesUrl": "santa-barbara-10b-guia-02-redes-rap01-quiz.html",
    "quizIpUrl": "santa-barbara-10b-guia-02-redes-ip-quiz.html"
  }
}
```

### 4. Loader runtime

Crear:

- `js/guide_runtime_loader.js`

Responsabilidades del loader:

- leer `window.__GUIDE_CONTEXT__` definido por el wrapper
- cargar `data/guide_contexts.json`
- resolver el contexto correcto
- inyectar `partials/guia-redes-rap01-content.html` en `#guide-root`
- poblar `document.body.dataset.defaultInst`
- poblar `document.body.dataset.defaultGrupo`
- poblar `document.body.dataset.defaultFicha`
- completar enlaces dinamicos de quiz o actividades relacionadas
- invocar la inicializacion real de la guia

## Contrato con el JS existente

El proyecto ya tiene una ventaja importante: scripts como [js/script_guia_redes.js](</G:/Mi unidad/Para Subir/HTML/js/script_guia_redes.js>) ya consumen contexto desde:

- `document.body.dataset.defaultInst`
- `document.body.dataset.defaultGrupo`
- sesion de `portalAuth`

Por eso, la migracion debe respetar ese contrato y evitar una reescritura innecesaria.

### Decision tecnica

En vez de rehacer toda la guia, el loader debe preparar el DOM y el contexto de la forma que espera `script_guia_redes.js`.

Eso reduce el riesgo y permite migracion incremental.

## Modelo de seguridad

La parte mas importante del diseno es esta:

> La URL o el HTML nunca deben autorizar acceso, guardado o entrega.

### Reglas de seguridad

- la URL solo decide `que interfaz cargar`
- la sesion autenticada decide `que datos puede ver o guardar`
- el frontend no debe confiar en `?grupo=10A`, `data-default-ficha` o valores del wrapper como fuente de autorizacion
- Firebase y Apps Script deben seguir validando identidad real del usuario y su alcance

### Comportamiento esperado para aprendices

Si un aprendiz abre manualmente una URL de otro grupo:

- el loader compara el contexto solicitado con la sesion real
- si no coincide, se redirige a su guia correcta o se bloquea el acceso
- no se permite guardar en el contexto de otro grupo

### Comportamiento esperado para admin

El admin puede tener `modo preview` o navegacion cruzada entre grupos, pero:

- siempre como accion explicita
- sin mezclar datos de un aprendiz con otro

### Que puede ir en el JSON

Permitido:

- nombres visibles
- grupo
- ficha
- institucion
- URLs publicas
- nombres de archivo cloud publicos si ya existen en el cliente

No permitido:

- secretos
- tokens
- reglas de autorizacion
- logica admin sensible
- decisiones de permisos basadas solo en frontend

## Estructura de archivos propuesta

### Nuevos archivos

- `partials/guia-redes-rap01-content.html`
- `data/guide_contexts.json`
- `js/guide_runtime_loader.js`

### Archivos que seguiran existiendo, pero minimizados

- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

### Archivos a adaptar

- `js/script_guia_redes.js`
- `js/admin_usuarios.js`
- cualquier JS que hoy dependa de links hardcodeados por grupo dentro del HTML

## Flujo de carga propuesto

1. El usuario abre una URL existente, por ejemplo:
   - `santa-barbara-10a-guia-02-redes-rap01.html`
2. El wrapper define:
   - `window.__GUIDE_CONTEXT__ = { key: "sb-redes-10a", template: "guia-redes-rap01" }`
3. El loader lee esa clave.
4. El loader carga `data/guide_contexts.json`.
5. El loader resuelve el contexto.
6. El loader valida la sesion:
   - aprendiz: solo su grupo
   - admin: puede previsualizar
7. El loader inyecta `partials/guia-redes-rap01-content.html`.
8. El loader completa `dataset` y enlaces dinamicos.
9. El loader inicia la guia real.

## Cambios de comportamiento esperados

### Lo que no debe cambiar para el usuario

- la URL que usa hoy
- la apariencia general de la guia
- el guardado de respuestas
- el flujo de entrega a Drive
- el panel admin

### Lo que si cambia internamente

- el contenido ya no vive duplicado en dos HTML grandes
- los links por grupo se resuelven por configuracion
- los wrappers dejan de ser la fuente principal del contenido

## Fases de implementacion propuestas

### Fase 1. Piloto de Guia 2 Redes

- extraer contenido comun a `partials/guia-redes-rap01-content.html`
- crear `guide_contexts.json`
- crear `guide_runtime_loader.js`
- convertir `10A` y `10B` en wrappers minimos
- adaptar `script_guia_redes.js` para inicializacion segura desde loader

### Fase 2. Unificacion de dependencias relacionadas

Si el piloto sale bien, aplicar el mismo patron a:

- quiz de redes
- quiz IP
- ficha caso
- matriz 3.2.2

### Fase 3. Expansion al resto del portal

Repetir el patron en:

- `grupo-10a/10b-guia-02-herramientas-informaticas-digitales`
- `grupo-11a/11b`
- otras guias con duplicacion alta

## Criterios de aceptacion

- cambiar un bloque comun de `Guia 2 Redes` debe requerir editar `1` solo archivo de contenido
- las URLs actuales de `10A` y `10B` deben seguir funcionando
- cada grupo debe conservar su guardado aislado
- un aprendiz no debe poder cambiar de grupo solo alterando la URL
- el panel admin no debe perder funcionalidad
- los enlaces a quiz deben seguir apuntando al grupo correcto
- el contenido visible entre grupos debe seguir siendo consistente

## Riesgos y mitigaciones

### Riesgo 1. Romper enlaces existentes

Mitigacion:

- conservar wrappers con las URLs actuales

### Riesgo 2. Mezclar datos entre grupos

Mitigacion:

- separar `cloudFileName`, ficha y contexto por configuracion
- validar siempre contra sesion real

### Riesgo 3. Depender demasiado del HTML inyectado

Mitigacion:

- estandarizar ids y puntos de inicializacion
- mantener contrato estable con `script_guia_redes.js`

### Riesgo 4. Introducir un bypass por query string o contexto manual

Mitigacion:

- el loader no autoriza guardado por contexto solicitado
- la identidad autenticada es la unica fuente valida para operaciones de persistencia

## No objetivos de este piloto

- migrar todo el portal a SPA
- introducir React, Vue u otro framework
- eliminar todas las URLs historicas
- rehacer por completo el sistema de autenticacion
- mover toda la autorizacion al frontend

## Decision final

Se aprueba un piloto de `unificacion con wrappers minimos` para `Guia 2 Redes`, porque ofrece la mejor relacion entre:

- reduccion real de duplicacion
- continuidad operativa
- bajo riesgo en GitHub Pages
- seguridad razonable basada en sesion y backend, no en la URL
