# Laboratorio Virtual 3D V6 — candidato para piloto

Preparación del 10 de octubre de 2026. Rama prevista: `loop-portatil-v6-cloud-20261009`.
Base publicada conservada: `204dc4076b236516cf6c8d145625e9e5f67265a9`.

Este candidato incorpora el laboratorio existente, sus mejoras de portátil acumuladas y el adaptador Firebase V6. Las mejoras locales anteriores eran dependencias sin commit sobre la base publicada; por eso el commit contiene el candidato completo, no solamente los archivos cuyo nombre termina en V6. No incorpora el árbol de guardado pausado. Las copias V3/V4/V5 permanecen intactas.

## Alcance de esta operación

Se autoriza commit y subida a una rama independiente. No se autoriza fusionar con `main`, sustituir el laboratorio vigente, activar Firebase real, modificar reglas publicadas ni escribir calificaciones. Esta rama no constituye un piloto desplegado y no acredita validación definitiva.

El workflow existente despliega GitHub Pages exclusivamente mediante push a `main`. Publicar esta rama no ejecuta ese despliegue. No se han añadido workflows ni modificado la configuración de Pages.

## Validación automatizada

- Suite Node: 2.191 pruebas, 2.178 PASS, 0 FAIL, 12 SKIP y 1 TODO previos.
- Auth/Firestore Emulator Suite: 20/20 PASS en `demo-hwlab-v6`, con cuentas ficticias y puertos loopback.
- Gitleaks 8.21.2 y comprobaciones propias de secretos sobre el contenido preparado para Git: sin secretos nuevos detectados. La configuración web pública Firebase preexistente no es una credencial Admin.
- Revisión independiente previa: sin hallazgos accionables abiertos en su alcance; no equivale a una validación gráfica completa.

Los dos ajustes de preparación afectan únicamente pruebas: contraseña aleatoria para cada usuario de emulador y hashes de referencia para comprobar archivos protegidos sin depender de una carpeta V5 hermana. No se desactivó el detector de secretos.

Repetir la suite desde la raíz del clon: `node --test tests/*.test.cjs` (Node 22 o posterior). Los 12 SKIP y el TODO son limitaciones/deuda anteriores, no validaciones aprobadas.

Para reproducir emuladores con los scripts actuales en macOS ARM64, colocar el clon en `<workspace>/work/portatil-v6-cloud-20261009`, ejecutar `python3 v6/emulators/prepare-local.py` y después `python3 v6/emulators/run-local.py`. Las dependencias portátiles se guardan en `<workspace>/.runtime-v6`; el lanzador reutiliza la CLI Firebase disponible en `/usr/local/bin/firebase`. No instalar ni ejecutar contra un projectId real. El benchmark comparativo histórico requiere la copia V5 hermana y no mide FPS ni latencia de Firestore.

## Piloto detenido: requisitos que deben aprobarse

No se publica un enlace porque el alojamiento existente sirve el portal vigente y el adaptador V6 solo admite emuladores en loopback. Subir estos archivos a otra URL sin preparar su ejecución no aislaría automáticamente la autenticación y las escrituras históricas del portal.

1. Elegir un origen HTTPS de piloto separado del alojamiento actual y un mecanismo de acceso acotado, sin cambiar el sitio de los aprendices.
2. Aprobar dónde ejecutar el gateway V6 y sus límites de origen, acceso y operación. El servidor incluido es local de pruebas; no desplegar el servidor de fixtures como si fuera un servicio real.
3. Definir el backend de pruebas aislado. Si requiere configurar Firebase real, dominios de Auth, credenciales de servidor o reglas, presentar y autorizar esos cambios antes de ejecutarlos. Mantener las credenciales fuera del cliente y de Git.
4. Aprobar una configuración de piloto que impida tanto las escrituras V6 como las rutas históricas hacia datos y calificaciones de producción. No crear otra autenticación ni cuentas nuevas de producción.
5. Si se autoriza posteriormente la identidad existente del portal, provisionar explícitamente permisos V6 para los UID y las fichas vigentes. Los checkpoints, las finalizaciones propuestas y las notas oficiales deben seguir separados.

Hasta entonces, no utilizar cuentas reales de aprendices en una copia alojada de esta rama. No hay un piloto remoto listo ni una promesa de sincronización entre equipos reales.

## Pruebas posteriores con aprendices

Fichas previstas: **3441939, 3441942, 3441944 y 3441950**. Son planificación; no se han habilitado permisos ni modificado datos de esas fichas.

Pendientes: acceso del portal, Standard/Gamer con y sin recarga, recuperación entre equipos, cierre completo de navegador, cámara/componentes/cables/colisiones, viewports 390/768/1024/1440, FPS/carga/memoria, concurrencia y seguimiento académico aislado.

Registrar cada incidencia en `INCIDENCIAS_PILOTO.csv` con un identificador de participante de prueba, pasos breves, esperado, observado, navegador/viewport y evidencia anonimizada. No incluir nombres, documentos, contraseñas, tokens ni calificaciones reales. El registro está vacío porque estas pruebas todavía no se han realizado.

Esta operación termina tras verificar el commit remoto y entregar el informe. Las correcciones derivadas de las pruebas posteriores requerirán una nueva instrucción; no se aplican cambios adicionales automáticamente.
