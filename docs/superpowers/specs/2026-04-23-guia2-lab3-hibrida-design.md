# Guia 2 Lab 3 Hibrida Design

## Objetivo

Agregar una nueva actividad `3.4.3` a la `Guia 2 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones` para `Santa Barbara 10A` y `10B`, con el mismo formato pedagogico de los laboratorios `3.4.1` y `3.4.2`.

El nuevo bloque debe presentar un laboratorio practico de `red hibrida estrella + arbol` aplicado a una `sede educativa`, donde el aprendiz identifique y use:

- `fibra optica` para los enlaces troncales entre bloques
- `cableado UTP` para la conexion interna de equipos
- `Wi-Fi` para clientes moviles

La actividad debe permitir:

- seguir pasos guiados en `Cisco Packet Tracer`
- subir `4` evidencias visuales
- responder preguntas de analisis
- guardar y bloquear respuestas
- reabrir la edicion desde el panel admin
- subir el archivo final `.pkt` al flujo de entrega en Drive

## Alcance aprobado

- Crear una nueva actividad `3.4.3` despues de `3.4.2` en:
  - [santa-barbara-10a-guia-02-redes-rap01.html](G:\Mi unidad\Para Subir\HTML\santa-barbara-10a-guia-02-redes-rap01.html)
  - [santa-barbara-10b-guia-02-redes-rap01.html](G:\Mi unidad\Para Subir\HTML\santa-barbara-10b-guia-02-redes-rap01.html)
- Mantener la misma estructura visual y didactica usada en `3.4.1` y `3.4.2`:
  - objetivo del laboratorio
  - lo que vas a construir
  - equipos y recursos
  - pasos guiados
  - tabla de direccionamiento
  - pruebas obligatorias
  - evidencias visuales
  - analisis del laboratorio
  - guardar respuestas
  - entrega final del `.pkt`
- Definir un escenario de `sede educativa` con `3 zonas`:
  - `Bloque Academico`
  - `Bloque Administrativo`
  - `Biblioteca`
- Explicar con claridad donde aparece la topologia `estrella` y donde aparece la topologia `arbol`.
- Incluir uso combinado de:
  - `fibra optica`
  - `cable UTP`
  - `Wi-Fi`
- Integrar el nuevo laboratorio con:
  - persistencia local y cloud de la guia de redes
  - bloqueo por guardado
  - desbloqueo desde panel admin
  - flujo de subida de evidencias y entrega final a Drive
- Agregar prueba automatizada que valide la estructura HTML y la integracion JS/admin del laboratorio.

## Escenario aprobado

La actividad se presentara como un caso de `institucion educativa` con tres zonas fisicas:

- `Bloque Academico`
- `Bloque Administrativo`
- `Biblioteca`

Diseno esperado:

- Dentro de cada zona, los equipos se conectan en `estrella` a un switch local.
- Los switches de cada zona se conectan a un `switch central`, formando la parte `arbol`.
- Los enlaces entre el switch central y los switches de bloque usan `fibra optica`.
- Las conexiones internas de PCs, impresora y access point usan `UTP`.
- Los clientes moviles se conectan por `Wi-Fi` a los access points.

El laboratorio no debe introducir ruteo avanzado. El foco aprobado es:

- reconocer dos topologias coexistiendo en la misma red
- diferenciar el uso pedagogico de `fibra`, `UTP` y `Wi-Fi`
- comprobar conectividad entre nodos cableados e inalambricos

## Estructura visual propuesta

### Cabecera del laboratorio

Tarjeta superior con:

- contexto del escenario
- `Objetivo del laboratorio`
- `Lo que vas a construir`
- `Evidencia esperada`

Texto guia esperado:

- objetivo: construir una red hibrida `estrella + arbol`
- foco: medios de transmision y conectividad
- evidencia: `4` pantallazos + analisis corto + archivo `.pkt`

### Equipos y recursos que debes agregar

Tarjetas o bloques cortos para:

- `1 Router/Gateway`
- `1 Switch central`
- `3 Switches de bloque`
- `10 PCs`
- `1 Impresora de red`
- `2 Access Point`
- `2 clientes Wi-Fi` (`laptops` o `laptop + tablet`)
- `Fibra optica`
- `Cable Copper Straight-Through`

### Pasos guiados en Packet Tracer

Bloques numerados:

1. Organiza la sede educativa por bloques.
2. Construye la parte `arbol` del diseno con el switch central.
3. Construye la parte `estrella` dentro de cada bloque.
4. Configura el direccionamiento IP y la conectividad inalambrica.
5. Ejecuta pruebas, guarda evidencias y analiza resultados.

### Tabla de direccionamiento sugerida

Se recomienda usar una sola red para mantener el foco en topologias y medios:

- `Red base`: `192.168.20.0/24`
- `Gateway`: `192.168.20.1`
- `Mascara`: `255.255.255.0`

Asignacion sugerida:

| Zona | Equipo | IP |
| --- | --- | --- |
| Bloque Academico | Academico_PC1 | `192.168.20.10` |
| Bloque Academico | Academico_PC2 | `192.168.20.11` |
| Bloque Academico | Academico_PC3 | `192.168.20.12` |
| Bloque Academico | Academico_PC4 | `192.168.20.13` |
| Bloque Administrativo | Admin_PC1 | `192.168.20.20` |
| Bloque Administrativo | Admin_PC2 | `192.168.20.21` |
| Bloque Administrativo | Admin_PC3 | `192.168.20.22` |
| Biblioteca | Biblioteca_PC1 | `192.168.20.30` |
| Biblioteca | Biblioteca_PC2 | `192.168.20.31` |
| Biblioteca | Biblioteca_PC3 | `192.168.20.32` |
| Biblioteca | Impresora | `192.168.20.29` |
| Wi-Fi | AP_Academico | `192.168.20.40` |
| Wi-Fi | AP_Biblioteca | `192.168.20.41` |
| Wi-Fi | Cliente_WiFi_1 | `192.168.20.50` |
| Wi-Fi | Cliente_WiFi_2 | `192.168.20.51` |

La tabla visible al aprendiz debe incluir:

- zona o bloque
- nombre del equipo
- IP
- mascara
- gateway

### Pruebas obligatorias

Seccion separada con comandos claros:

1. `Ping` desde un PC del `Bloque Academico` hacia un PC del `Bloque Administrativo`.
2. `Ping` desde un cliente `Wi-Fi` hacia un equipo cableado de `Biblioteca`.
3. Verificacion de parametros con `ipconfig` en un equipo cableado.
4. Verificacion de conectividad y parametros de un cliente inalambrico asociado al AP.

### Evidencias visuales obligatorias

Se usaran `4` slots de subida:

1. `Topologia completa`
2. `Ping entre bloques`
3. `Ping Wi-Fi a equipo cableado`
4. `ipconfig o parametros del cliente inalambrico`

Cada slot debe incluir:

- titulo corto
- instruccion visible
- boton `Subir pantallazo`
- preview de imagen
- nombre del archivo cargado

### Analisis del laboratorio

Preguntas en vertical:

1. `Donde aparece la topologia estrella y que elementos la evidencian?`
2. `Donde aparece la topologia arbol y por que el switch central cumple ese papel?`
3. `Por que se usa fibra optica entre bloques y UTP dentro de cada bloque?`
4. `Que ventaja aporta Wi-Fi dentro de la sede educativa y que diferencias observaste frente al acceso cableado?`

### Guardado y entrega final

Dos acciones separadas:

- boton `Guardar respuestas del laboratorio`
- boton `Subir archivo .pkt al Drive`

Nombre sugerido para la entrega:

`Lab3_HibridaColegio_NombreAprendiz_FICHA.pkt`

## Integracion funcional propuesta

### Persistencia en guia de redes

El laboratorio se integrara en el mismo archivo de estado usado por la guia de redes.

Se agregaran:

- nuevas claves de analisis
- nuevas claves para URLs y nombres de evidencias
- nuevo lock `lab3-locked`

Claves previstas:

- `lab3-topologia`
- `lab3-ping-bloques`
- `lab3-ping-wifi`
- `lab3-ipconfig-wifi`
- `lab3-topologia-image-url`
- `lab3-ping-bloques-image-url`
- `lab3-ping-wifi-image-url`
- `lab3-ipconfig-wifi-image-url`
- `lab3-topologia-image-name`
- `lab3-ping-bloques-image-name`
- `lab3-ping-wifi-image-name`
- `lab3-ipconfig-wifi-image-name`
- `lab3-locked`

### Reglas de guardado

El guardado exitoso exigira:

- las `4` respuestas de analisis completas
- las `4` evidencias visuales subidas

Cuando el guardado termine:

- se actualiza estado local
- se sincroniza en cloud
- se marca `lab3-locked = true`
- se deshabilitan `textarea`, botones de carga y boton de guardar
- se muestra mensaje de estado de solo lectura

### Integracion con panel admin

El panel admin debe reconocer `lab3-locked` dentro de la lista de locks de redes.

El boton `Habilitar edicion` debe:

- limpiar `lab3-locked`
- conservar respuestas y URLs de evidencias
- permitir que el aprendiz vuelva a editar analisis y volver a subir evidencias si hace falta

### Integracion con subida de evidencias

Cada pantallazo seguira el flujo ya existente:

- seleccion de imagen
- subida via `uploadToAppsScript(...)`
- almacenamiento de `driveUrl`
- restauracion del preview en recarga

La entrega final del `.pkt` usara `openDeliveryModal(...)` con:

- `guideLabel: "Guia 2"`
- `activityNumber: "3.4.3"`
- `activityTitle: "Laboratorio 3 - Red hibrida estrella y arbol con fibra optica, cableado y Wi-Fi"`
- `fileNamePrefix: "Lab3_HibridaColegio"`
- `allowedExtensions: [".pkt"]`

## Archivos previstos

### HTML

- `santa-barbara-10a-guia-02-redes-rap01.html`
- `santa-barbara-10b-guia-02-redes-rap01.html`

### JavaScript

- `js/script_guia_redes.js`
- `js/admin_usuarios.js`

### Pruebas

- `tests/redes_lab3_hibrida.test.cjs`

## Estrategia de implementacion prevista

1. Insertar la nueva actividad `3.4.3` en ambas guias.
2. Reutilizar el patron visual y de markup de `3.4.1` y `3.4.2`.
3. Agregar helpers nuevos en `js/script_guia_redes.js`:
   - restauracion de evidencias
   - carga de pantallazos
   - aplicacion de lock
   - guardado del laboratorio
   - entrega final del `.pkt`
4. Registrar `lab3-locked` en `js/admin_usuarios.js`.
5. Crear prueba automatizada para HTML y JS.

## Criterios de aceptacion

- `3.4.3` aparece en `10A` y `10B` con la misma estructura de los otros laboratorios.
- El escenario deja claro el uso combinado de `estrella`, `arbol`, `fibra`, `UTP` y `Wi-Fi`.
- El aprendiz puede subir `4` pantallazos con preview restaurable.
- El laboratorio puede guardarse y quedar bloqueado.
- Admin puede reabrirlo desde `Habilitar edicion`.
- El laboratorio permite subir el archivo final `.pkt`.
- La prueba automatizada valida presencia de la estructura y la integracion de las nuevas claves.

## Riesgos y decisiones

### Decision principal

Se mantiene `una sola red /24` para que el aprendizaje se centre en:

- topologias fisicas
- medios de transmision
- conectividad basica

No se introducira segmentacion por subredes en este laboratorio porque desviaria el foco hacia ruteo y subnetting.

### Riesgos controlados

- `Complejidad visual`: se evita agregando secciones iguales a `3.4.1` y `3.4.2`.
- `Carga cognitiva`: se usan pruebas concretas y direccionamiento unico.
- `Inconsistencia administrativa`: se evita integrando `lab3-locked` al mismo flujo de desbloqueo existente.
