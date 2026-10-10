# Laboratorio Virtual 3D V6 — integración en el portal principal

10 de octubre de 2026. La autorización vigente integra V6 en `main` del proyecto **Teleinformaticos-Sena** y utiliza su procedimiento existente de GitHub Pages. Sustituye la instrucción anterior de mantener una rama y preparar un piloto separado. No se crea otro portal, proyecto, rama ni servicio.

## Alcance disponible

Se incorpora el candidato V6 existente: portátil Standard/Gamer, mejoras de cámara/geometría/interacción/diagnóstico y persistencia local. Se conservan las funcionalidades del portal y del escritorio. Las copias históricas V3/V4/V5 y el árbol de guardado pausado no forman parte de esta operación y permanecen intactos.

**La sincronización remota V6 no está habilitada.** Su adaptador Firebase y sus contratos están probados en emuladores; el cliente solo permite su activación explícita en un entorno loopback de emuladores. No existe un gateway V6 remoto configurado. El progreso local no implica recuperación entre equipos ni seguimiento remoto del instructor.

No se modifica la configuración Firebase vigente, la autenticación del portal, las reglas publicadas ni las calificaciones existentes. No se provisionan permisos ni cuentas reales. Cualquier futura activación del adaptador exige autorización separada y configuración de backend; no se realiza durante esta publicación estática.

## Dirección y procedimiento de publicación

Dirección habitual:
https://dubier-sena.github.io/Teleinformaticos-Sena/laboratorio-virtual-hardware.html

El acceso conserva las restricciones del portal: cuenta existente autorizada. Sin sesión puede redirigir al inicio; no se han añadido contraseñas de demostración, accesos públicos ni bypass de autenticación en el sitio publicado.

`main` se publica mediante `.github/workflows/ci.yml`: suite Node, escaneo de secretos, smoke de navegador y build Windows deben terminar correctamente antes del job de GitHub Pages. No se omiten jobs ni se despliegan reglas, Apps Script o funciones Firebase.

La prueba de migración usa una fixture de los tres módulos exactos de la base `204dc4076b236516cf6c8d145625e9e5f67265a9`, protegida por SHA-256. Así conserva la comprobación del legado sin cambiar el checkout superficial del workflow existente. El smoke incluye el laboratorio, comprueba que V6 cloud esté desactivado y bloquea peticiones HTTPS externas durante las sesiones ficticias locales, sin contactar APIs de producción.

## Reproducción de pruebas

- Suite: `node --test tests/*.test.cjs` con Node 22 o posterior.
- Smoke: `node tools/smoke_test.mjs` con Chrome/Chromium instalado. Usa un perfil temporal propio; no requiere extensiones ni el perfil del usuario.
- Emuladores: en el layout `<workspace>/work/portatil-v6-cloud-20261009`, ejecutar `python3 v6/emulators/prepare-local.py` y `python3 v6/emulators/run-local.py`. Los scripts actuales están preparados para macOS ARM64, usan dependencias locales y la CLI existente `/usr/local/bin/firebase`; solo aceptan el proyecto ficticio de pruebas.
- Build de páginas: `tools/build-generated-pages.ps1` en Windows, ejecutado por el job existente.

La validación anterior del candidato tenía 2.178 PASS, 0 FAIL, 12 SKIP y 1 TODO en Node y 20/20 PASS en emuladores. La ejecución específica de esta integración y el resultado del despliegue deben consultarse en GitHub Actions y en el informe de entrega. Un PASS automatizado no equivale a validación funcional/gráfica definitiva.

## Disponibilidad para Claude y pruebas posteriores

Claude puede revisar `main`, los tests y este documento, y utilizar la dirección habitual con una sesión del portal que el usuario autorice. No se entregan credenciales, se crean cuentas ni se autoriza modificar notas o datos de producción. Para pruebas automáticas que escriban progreso remoto, utilizar exclusivamente los emuladores.

Fichas previstas: **3441939, 3441942, 3441944 y 3441950**. Esta lista no habilita permisos nuevos ni modifica sus datos.

Pendientes de validación completa: flujo real del aprendiz, Standard/Gamer con y sin recarga, cierre/reapertura de navegador, recuperación visual, interacción/cámara/cables/colisiones, viewports 390/768/1024/1440 y rendimiento gráfico. La recuperación entre equipos, sincronización, permisos remotos y seguimiento V6 del instructor requieren primero habilitación del backend autorizada; no se presentan como operativos en GitHub Pages.

El CSV existente `INCIDENCIAS_PILOTO.csv` se conserva como registro vacío de incidencias de validación; su nombre histórico no supone un piloto separado. Registrar pasos, resultado esperado/observado, navegador, viewport y evidencia anonimizada. No registrar nombres, documentos, contraseñas, tokens ni calificaciones reales.

**V6 no se declara validada definitivamente.** Los informes de respaldo y operaciones se conservan fuera del código publicado. Las correcciones posteriores se realizarán según las pruebas y las instrucciones del usuario.
