# Modulo de Etapa Productiva y Retroalimentacion Design

**Fecha:** 2026-04-11  
**Estado:** Aprobado en conversacion, pendiente de revision del documento  
**Alcance:** Portal local de guias SENA, grados 11A y 11B

---

## Objetivo

Agregar al proyecto un modulo de `Etapa Productiva` para grados 11 que permita:

- al administrador importar manualmente informes `.docx` desde el panel administrativo,
- descomponer cada informe en proyectos individuales,
- consultar y filtrar los proyectos e informes por ficha, nombre del proyecto, estudiante, estado y tipo,
- y permitir que cada estudiante vea unicamente la informacion de su proyecto y los `Informes de Retroalimentacion` o `Informes de Avance` asociados.

---

## Problema que resuelve

El proyecto actual ya gestiona aprendices, fichas, guias y avances, pero no tiene una capa estructurada para manejar los proyectos de `Etapa Productiva` de grados 11 ni sus informes de seguimiento. El instructor necesita consultar rapidamente los proyectos revisados, y los aprendices requieren una vista privada para conocer solamente la retroalimentacion que les corresponde a ellos y a su grupo.

El primer documento base es [Informe_Completo_11A_11B_2026.docx](/C:/Users/PC/Downloads/Informe_Completo_11A_11B_2026.docx), que incluye 15 proyectos distribuidos entre ficha `3168850` y ficha `3168852`.

---

## Opcion de implementacion elegida

Se aprueba la opcion:

**B. Importacion + catalogo sincronizado**

Esto significa que:

- el administrador importa un archivo `.docx` desde el panel administrativo,
- el sistema lo analiza y lo convierte a registros estructurados por proyecto,
- esos registros se guardan en el almacenamiento compartido del portal,
- y cada estudiante solo puede consultar los proyectos donde aparece como integrante.

Se descartan para esta iteracion:

- edicion manual de informes dentro del portal,
- exportacion o reescritura del `.docx`,
- comentarios por parrafo,
- comparacion visual entre versiones del mismo informe.

---

## Estructura funcional

### 1. Vista administrativa

Se incorporara una seccion nueva dentro de [panel-administrativo-usuarios.html](/C:/Users/PC/Downloads/Pagina_Web/panel-administrativo-usuarios.html) con estos bloques:

- `Importar informe DOCX`
- `Resumen de importacion`
- `Indicadores del modulo`
- `Filtros de proyectos`
- `Listado de proyectos`
- `Detalle del informe`

#### Acciones del administrador

El administrador podra:

- cargar un archivo `.docx`,
- ejecutar la importacion,
- revisar alertas de coincidencia o integridad,
- filtrar por ficha,
- filtrar por proyecto,
- filtrar por estudiante,
- filtrar por estado: `Completo`, `Parcial`, `Incompleto`,
- filtrar por tipo: `Retroalimentacion`, `Avance`,
- abrir el detalle completo de un proyecto,
- consultar integrantes asociados al proyecto.

### 2. Vista del estudiante

Se creara una vista privada del estudiante para `Etapa Productiva` donde vera:

- nombre del proyecto,
- ficha,
- integrantes del grupo,
- poblacion objetivo,
- herramienta propuesta,
- estado actual del proyecto,
- historial de informes,
- detalle de cada informe.

#### Restriccion de acceso

El estudiante solo podra ver proyectos donde aparezca como integrante.  
Si un proyecto tiene 2 o 3 integrantes, todos los integrantes veran exactamente el mismo historial y el mismo contenido de informe.

---

## Modelo de datos

Se agregara una nueva estructura de datos independiente de las guias:

### Catalogo administrativo de proyectos

Cada proyecto tendra una ficha principal con estos campos minimos:

- `id`
- `ficha`
- `grado`
- `grupoCategoria`
- `projectTitle`
- `studentNames[]`
- `studentUsernameKeys[]`
- `population`
- `tool`
- `currentStatus`
- `lastReportType`
- `lastReportAt`
- `sourceFileName`
- `importBatchId`
- `createdAt`
- `updatedAt`

### Historial de informes por proyecto

Cada proyecto tendra una coleccion hija o indice relacionado de informes. Cada informe tendra, como minimo:

- `reportId`
- `projectId`
- `reportType`
- `status`
- `summary`
- `strengths[]`
- `improvements[]`
- `advisorNote`
- `sourceFileName`
- `importBatchId`
- `importedAt`
- `reportDate`

Con esta separacion, el panel administrativo podra mostrar:

- el proyecto como unidad principal,
- el ultimo estado del proyecto,
- y el historial completo de `Informes de Retroalimentacion` o `Informes de Avance`.

### Espejo por estudiante

Se generara una vista derivada por aprendiz para que el consumo de datos del lado del estudiante no necesite cargar el catalogo completo.  
Cada estudiante quedara asociado a uno o varios `projectIds`, pero solo recibira los proyectos donde su nombre fue vinculado correctamente en la importacion.  
Cada proyecto visible en el lado del estudiante incluira un resumen del proyecto y su historial de informes ya filtrado.

---

## Reglas de importacion del DOCX

El importador debe:

1. leer el `.docx` en el navegador del administrador,
2. extraer el texto estructurado,
3. detectar cada bloque de proyecto,
4. identificar la ficha activa a la que pertenece el bloque,
5. extraer estos campos:
   - titulo del proyecto
   - estudiantes
   - poblacion
   - herramienta
   - estado del documento
   - resumen del proyecto
   - fortalezas
   - aspectos a mejorar
   - nota del asesor
6. intentar emparejar cada estudiante con un aprendiz real del portal,
7. guardar advertencias cuando no haya coincidencia exacta,
8. construir o actualizar el registro base del proyecto,
9. registrar el informe importado dentro del historial del proyecto,
10. sincronizar el resultado al almacenamiento compartido.

### Regla de repeticion de importaciones

En esta primera version, cada importacion manual se tratara como un lote independiente (`importBatchId` unico).  
Si el administrador vuelve a importar el mismo archivo, el sistema agregara una nueva captura del informe en el historial del proyecto en vez de editar silenciosamente el registro anterior.  
La deduplicacion avanzada entre lotes queda fuera de esta fase.

### Reglas de coincidencia de estudiantes

La coincidencia entre nombres del DOCX y aprendices registrados seguira esta prioridad:

1. nombre completo exacto normalizado,
2. nombre normalizado sin tildes y sin dobles espacios,
3. coincidencia suficientemente cercana para marcar como sugerencia, pero no como union automatica segura.

Si no hay coincidencia confiable:

- el proyecto se importa,
- pero queda marcado con alerta administrativa,
- y no se publica todavia en la vista privada del estudiante hasta corregir la vinculacion.

---

## Indicadores administrativos

El modulo mostrara indicadores superiores con:

- total de proyectos importados,
- total de informes registrados,
- proyectos completos,
- proyectos parciales,
- proyectos incompletos,
- fichas con proyectos importados.

Los indicadores responderan a los filtros activos, igual que el resto del panel.

---

## Filtros administrativos

Los filtros soportados seran:

- `Ficha`
- `Nombre del proyecto`
- `Nombre del estudiante`
- `Estado`
- `Tipo de informe`

El filtro por estudiante buscara tanto por nombre visible como por usuario interno asociado.

---

## Seguridad y privacidad

### Administrador

- acceso exclusivo mediante `requireAdminAccess`
- puede importar, ver, filtrar y abrir cualquier proyecto

### Estudiante

- acceso exclusivo a proyectos donde aparezca como integrante
- no puede ver proyectos de otros grupos
- no puede importar, editar ni eliminar informes

### Integridad del contenido

- el importador no ejecutara macros ni contenido activo del `.docx`
- solo se procesara texto plano extraido del documento
- el archivo original se usara como fuente de lectura, no como ejecutable ni como HTML embebido

### Publicacion controlada

Un proyecto solo debe quedar visible al estudiante cuando tenga asociacion valida con al menos un aprendiz real del portal.

---

## Primera version aprobada

La primera version debe incluir:

- importacion manual `.docx` desde panel administrativo,
- parser inicial para documentos con formato similar al informe entregado,
- tabla/listado de proyectos importados,
- filtros administrativos,
- modal o vista de detalle del proyecto,
- almacenamiento sincronizado,
- vista privada para el estudiante,
- historial de informes por proyecto,
- soporte base para `Informe de Retroalimentacion` e `Informe de Avance`.

No debe incluir en esta fase:

- edicion de informes desde la web,
- carga de multiples archivos a la vez,
- fusion manual avanzada entre estudiantes y proyectos,
- comparacion entre versiones,
- comentarios por linea,
- exportacion PDF/DOCX.

---

## Archivos candidatos a intervenir

### Panel y administracion

- [panel-administrativo-usuarios.html](/C:/Users/PC/Downloads/Pagina_Web/panel-administrativo-usuarios.html)
- [js/admin_usuarios.js](/C:/Users/PC/Downloads/Pagina_Web/js/admin_usuarios.js)
- [css/page_admin.css](/C:/Users/PC/Downloads/Pagina_Web/css/page_admin.css)

### Autenticacion, acceso y almacenamiento

- [js/portal_auth.js](/C:/Users/PC/Downloads/Pagina_Web/js/portal_auth.js)
- [js/firebase_db.js](/C:/Users/PC/Downloads/Pagina_Web/js/firebase_db.js)

### Nuevos modulos probables

- `js/productive_stage_reports.js`
- `js/productive_stage_import.js`
- `data/` o almacenamiento compartido para indice de proyectos
- nueva pagina o bloque de estudiante para `Mi proyecto y retroalimentaciones`

---

## Riesgos y consideraciones

### 1. Variaciones del formato del DOCX

El parser inicial funcionara bien con documentos parecidos al informe ya entregado. Si el formato cambia demasiado entre informes futuros, se necesitara robustecer el reconocimiento de secciones.

### 2. Coincidencia de nombres

Los nombres del documento pueden no coincidir exactamente con los usuarios registrados. Por eso es necesario manejar alertas de coincidencia y no exponer informacion a estudiantes si la asociacion es dudosa.

### 3. Almacenamiento seguro

La visibilidad por estudiante no puede depender solo del filtro visual del navegador. Tambien debe generarse una capa derivada de datos para que la experiencia del estudiante no cargue registros ajenos.

---

## Resultado esperado

Al finalizar esta funcionalidad:

- el instructor podra importar un informe `.docx` de etapa productiva,
- el panel administrativo mostrara el catalogo de proyectos con filtros utiles,
- cada grupo de estudiantes de grados 11 podra ver solo la retroalimentacion correspondiente a su proyecto,
- y el portal quedara preparado para seguir incorporando `Informes de Avance` sin rehacer la arquitectura.
