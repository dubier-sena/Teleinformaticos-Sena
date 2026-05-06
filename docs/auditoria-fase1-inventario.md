# Auditoria fase 1 - inventario local

Fecha: 2026-05-05

## Alcance confirmado

Esta fase evita cambios destructivos. No se eliminan paginas publicas usadas por
aprendices, archivos auxiliares, materiales, ni artefactos de navegacion local.

## Rutas que se conservan

- `index.html`: entrada principal y autenticacion local.
- `guia.html`: entrada unificada para guias.
- `panel-administrativo-usuarios.html`: panel administrativo actual.
- `calendario-academico-2026.html`: calendario administrativo.
- `etapa-productiva-admin.html` y `etapa-productiva-estudiante.html`: modulo de etapa productiva.
- `pages/guias/`: wrappers legacy usados por aprendices.
- `pages/auxiliares/`: formularios, quizzes y paginas auxiliares usadas desde guias.

## Carpetas que no se limpian automaticamente

- `tmp/`: se conserva para navegacion local, previews y capturas.
- `assets/materiales/`: materiales descargables para aprendices.
- `assets/downloads/`: archivos descargables generados o publicados.

## Limpieza segura aplicada

- Se elimino una reasignacion duplicada de `GUIDE_TITLES` en `js/portal_auth.js`.
- Se movieron instrucciones largas de configuracion Firebase desde el runtime a
  `docs/firebase-runtime-setup.md`.

## Pendientes para fases siguientes

- Separar `js/admin_usuarios.js` por responsabilidades antes de redisenar el panel.
- Definir estrategia Firebase Auth/Functions para cerrar reglas de Firestore.
- Crear mapa legacy -> ruta unificada para completar la unificacion sin romper enlaces.
- Revisar `tmp/` por subcarpetas: conservar previews utiles y marcar capturas regenerables.
