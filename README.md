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

La documentacion tecnica interna y las notas de configuracion no se publican en
el repositorio.

## CI

Cada push/PR a `main` corre `.github/workflows/ci.yml` (suite de pruebas,
escaneo de secretos, smoke test de navegador y verificacion del build de
paginas generadas). El detalle de cada job esta documentado como comentarios
dentro de ese mismo archivo. GitHub Pages hoy publica directamente desde
`main` de forma independiente de este CI (ver comentario al inicio del
workflow).
