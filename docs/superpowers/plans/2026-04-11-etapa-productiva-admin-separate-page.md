# Plan - Etapa Productiva en pagina administrativa dedicada

**Fecha:** 2026-04-11
**Estado:** En ejecucion
**Objetivo:** mover el modulo completo de "Etapa Productiva / Informes de Retroalimentacion" fuera del panel administrativo principal hacia una pagina propia, manteniendo importacion, filtros, resumen y detalle.

## Alcance

1. Crear una pagina administrativa nueva para Etapa Productiva.
2. Extraer del panel principal la logica de importacion, render, filtros y modal de detalle.
3. Dejar en el panel principal una tarjeta de acceso simple al nuevo modulo.
4. Mantener compatibilidad con el almacenamiento actual en `productive_stage_store`.
5. Actualizar pruebas para validar la nueva distribucion.

## Pasos

1. Crear `etapa-productiva-admin.html` con shell administrativo compartido.
2. Mover la logica de Etapa Productiva a `js/productive_stage_admin.js`.
3. Mover los estilos del modulo a `css/page_productive_stage_admin.css`.
4. Simplificar `panel-administrativo-usuarios.html` y `js/admin_usuarios.js`.
5. Verificar importacion, filtros, detalle y enlaces de acceso.
