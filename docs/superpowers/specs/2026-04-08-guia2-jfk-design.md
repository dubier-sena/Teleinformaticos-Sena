# Guia 2 JFK Design

## Objetivo

Publicar la `Guia 2 - Operar Herramientas Informaticas y Digitales` para los grupos `10A` y `10B` de la `Institucion Educativa Jhon F. Kennedy` dentro del portal HTML existente.

## Alcance aprobado

- Reutilizar la implementacion existente de [`10a_guia2.html`](G:\Mi unidad\Para Subir\HTML\10a_guia2.html) como base de la guia para grado 10.
- Mantener en el punto `3.2.1 Reconocimiento de conceptos y herramientas` el contenido tomado de la referencia `Guia 5 - Operar Herramientas Informaticas y Digitales | Grupo 11A` de `Institucion Educativa Santa Barbara`.
- Crear una version espejo para `10B` con metadatos, ficha y navegacion del grupo correcto.
- Actualizar el portal principal para que `Jhon F. Kennedy` en `10A` y `10B` ofrezca `Guia 1` y `Guia 2`.
- No exponer `Guia 2` a `Santa Barbara` en los grupos de grado 10.

## Enfoque

Se conservara la estructura visual y funcional ya usada en las guias HTML del portal. La publicacion se resolvera con una pagina nueva para `10B` y con un ajuste en el indice para que las guias disponibles dependan de `institucion + grupo`, evitando que la oferta de `Guia 2` se filtre a otros cursos con el mismo nombre de grupo.

## Riesgos a controlar

- No romper la logica actual de seleccion de guia en `index.html`.
- No cambiar la guia predeterminada de otros grupos.
- Mantener consistencia de fichas y nombres de archivo entre `10A` y `10B`.
