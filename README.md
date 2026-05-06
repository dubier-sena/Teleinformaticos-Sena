# Portal de guias SENA

Proyecto estatico para guias didacticas del tecnico en sistemas
teleinformaticos.

## Uso local

Abre `index.html` o `guia.html` directamente desde el equipo, o sirve la carpeta
con un servidor local simple. Las paginas publicas y auxiliares siguen siendo
HTML/CSS/JS estatico.

## Seguridad

El modo 100% estatico sirve para contenido publico y navegacion local. Para
datos privados de aprendices, sesiones, roles administrativos y acciones
sensibles, la ruta recomendada es mantener GitHub Pages para las paginas y usar
Firebase Auth/Functions o un backend pequeno como autoridad segura.

Consulta:

- `docs/firebase-runtime-setup.md`
- `docs/firebase-seguridad-local.md`
