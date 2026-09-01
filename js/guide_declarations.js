/**
 * guide_declarations.js
 *
 * Registra la configuración de cada guía en ActivityStandard.
 * Este archivo se carga tanto en el panel admin como en cada página de guía,
 * para que las fechas límite y el panel de habilitación detecten las actividades
 * sin depender de los scripts específicos de cada guía.
 *
 * Cada nueva guía que use activity_standard.js debe agregar aquí su llamada a
 * ActivityStandard.registerGuide({ files, guideNumber, guideTitle, stateKey,
 *   program, competencia, resultado, activities }).
 *
 * Los scripts de guía (script_guiaN.js) pueden omitir la llamada a registerGuide()
 * si ya está aquí, o repetirla de forma idempotente (el registro sobrescribe
 * con los mismos datos, sin efectos negativos).
 *
 * NOTA: las actividades aquí declaradas reflejan el catálogo conocido por el
 * panel admin (auto-detección de unlock + deadlines). Los `script_guiaN.js`
 * actuales aún manejan su propia lógica de guardado/exportación; cuando una
 * guía migre por completo a ActivityStandard.mountActivities() bastará con
 * añadir formFields, buttonIds y wordExport a su entrada aquí.
 */

(function () {
  "use strict";

  function register(config) {
    if (window.ActivityStandard && typeof window.ActivityStandard.registerGuide === "function") {
      window.ActivityStandard.registerGuide(config);
    }
  }

  var PROGRAM = "Sistemas Teleinformaticos";
  var COMPETENCIA = "220501121 - Procesar la informacion de acuerdo con las necesidades de la organizacion.";
  var RAP_INDUCCION = "Induccion al programa Sistemas Teleinformaticos";
  var RAP_HERRAMIENTAS = "RAP 1 - Operar herramientas informaticas y digitales segun normativa vigente.";
  var RAP_PLANIFICAR = "RAP 2 - Planificar la informacion de acuerdo con normativa vigente.";
  var RAP_REDES = "RAP 1 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.";

  // ── Guia 1 — Induccion (10A + 10B) ─────────────────────────────────────────
  register({
    files: [
      "grupo-10a-guia-01-induccion.html",
      "grupo-10b-guia-01-induccion.html",
    ],
    guideNumber: "1",
    guideTitle: "Guia 1 - Induccion al programa",
    stateKey: "10a_guia",
    program: PROGRAM,
    competencia: COMPETENCIA,
    resultado: RAP_INDUCCION,
    activities: [
      { id: "arbol312",      number: "3.1.2", label: "El Arbol de la Vida",                 shortName: "ArbolVida",   type: "form", fieldPrefixes: ["arbol:"] },
      // Juego (sopa de letras + crucigrama externo), sin campo de texto -- solo
      // Aprobado/No aprobado por observacion/finalizacion del juego.
      { id: "sopaletras321", number: "3.2.1", label: "Sopa de Letras y Crucigrama SENA",     shortName: "SopaLetras",   type: "form" },
      { id: "sena331",       number: "3.3.1", label: "Analisis de simbolos SENA",           shortName: "SimbolosSENA", type: "form" },
      { id: "programa332",   number: "3.3.2", label: "Cuestionario diseno curricular",      shortName: "Cuestionario", type: "form", fieldPrefixes: ["curriculo:"] },
      // Sin campo de texto ni entrega Drive en la guia (evidencias en papel,
      // calificadas por observacion del instructor) -- ya tenia mount listo
      // (#reglamento333GradeMount) pero faltaba en el catalogo de Calificaciones.
      { id: "reglamento333", number: "3.3.3", label: "Reglamento del Aprendiz SENA",        shortName: "Reglamento",   type: "form" },
      { id: "plataformas334",number: "3.3.4", label: "Taller plataformas tecnologicas",     shortName: "Plataformas",  type: "form", fieldPrefixes: ["plataforma:"] },
      { id: "compromiso341", number: "3.4.1", label: "Mi Compromiso como Aprendiz SENA",    shortName: "Compromiso",   type: "form", fieldPrefixes: ["compromiso:"] },
      { id: "portafolio342", number: "3.4.2", label: "Portafolio de evidencias",            shortName: "Portafolio",   type: "file" },
    ],
  });

  // ── Guia 2 — Herramientas informaticas y digitales (10A + 10B) ─────────────
  register({
    files: [
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
      "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
    ],
    guideNumber: "2",
    guideTitle: "Guia 2 - Operar herramientas informaticas y digitales",
    stateKey: "guia_interactiva_10a_guia2_html",
    program: PROGRAM,
    competencia: COMPETENCIA,
    resultado: RAP_HERRAMIENTAS,
    activities: [
      // Actividades 1 y 2 (mision de arranque): juegos de puntaje (sopa de letras /
      // relacionar herramienta-funcion), sin campo de texto que calificar -- se
      // comparten el mismo numero para que Calificaciones las una en UNA sola
      // columna (mismo patron que 3.3.5 Ciberseguridad, mas abajo).
      { id: "sopaletras311",   number: "3.1.1", label: "Sopa de letras de conceptos basicos", shortName: "SopaLetras",      type: "form" },
      { id: "relaciona311",    number: "3.1.1", label: "Relaciona la herramienta con su funcion", shortName: "Relaciona",   type: "form" },
      { id: "analisis313",     number: "3.1.3", label: "Bitacora de analisis",              shortName: "Bitacora",        type: "form" },
      // matriz322 y fichaCaso son la Parte 3 y Parte 2 de la Actividad 4 (mismo
      // trabajo en equipo: el aprendiz LEE el caso que le toco -- 0 campos de
      // texto en esa pagina propia -- y con esa info completa la Matriz).
      // Comparten numero "3.2.1" para que Calificaciones las una en UNA sola
      // columna (mismo patron que sopaletras311/relaciona311 mas arriba).
      { id: "matriz322",       number: "3.2.1", label: "Matriz de Diagnostico Digital",     shortName: "MatrizDigital",   type: "form" },
      { id: "fichaCaso",       number: "3.2.1", label: "Ficha de caso",                     shortName: "FichaCaso",       type: "form" },
      // Cuestionario individual (10 preguntas, "contexto-*") de la Actividad 4 --
      // pagina APARTE (grupo-10a/10b-guia-02-actividad-4-formulario.html), no usa
      // ActivityStandard.mountActivities. Registrado aqui solo para que
      // Calificaciones tenga su columna (numero propio "3.2.3" porque "3.2.1"
      // ya lo usan matriz322/fichaCaso, actividad DISTINTA dentro de la misma tarjeta).
      { id: "diagnostico323",  number: "3.2.3", label: "Diagnostico individual del contexto digital", shortName: "DiagnosticoIndividual", type: "form" },
      { id: "extensiones331",  number: "3.3.1", label: "Extensiones de archivo",            shortName: "Extensiones",     type: "form" },
      { id: "sistemas332",     number: "3.3.2", label: "Requerimientos minimos",            shortName: "Requerimientos",  type: "form" },
      { id: "suite333",        number: "3.3.3", label: "Suite ofimatica en accion",         shortName: "Suite",           type: "form" },
      { id: "colaborativas334",number: "3.3.4", label: "Herramientas colaborativas",        shortName: "Colaborativas",   type: "form" },
      // Actividad 9 (3.3.5) - Ciberseguridad: 4 secciones inline + entrega Drive.
      { id: "cibersegAmenazas335",  number: "3.3.5", label: "Ciberseguridad - Amenazas",     shortName: "CiberAmenazas",   type: "form" },
      { id: "cibersegGuia335",      number: "3.3.5", label: "Ciberseguridad - Guia",         shortName: "CiberGuia",       type: "form" },
      { id: "cibersegPhishing335",  number: "3.3.5", label: "Ciberseguridad - Phishing",     shortName: "CiberPhishing",   type: "form" },
      { id: "cibersegChecklist335", number: "3.3.5", label: "Ciberseguridad - Checklist",    shortName: "CiberChecklist",  type: "form" },
      { id: "ciberseguridad335",    number: "3.3.5", label: "Ciberseguridad - Entrega Drive",shortName: "CiberDoc",        type: "file" },
      // El boton Guardar historico de la guia bloquea el reto con la llave suelta
      // "transfer-reto-locked"; declararla para que home/avance/habilitacion la vean.
      { id: "transferReto341", number: "3.4.1", label: "Reto final",                        shortName: "RetoFinal",       type: "form", legacyLockKeys: ["transfer-reto-locked"] },
      // Mismo hueco que los quiz de Redes RAP01: nunca estuvo en el catalogo.
      // Detectado 2026-07-23.
      { id: "quiz-guia2-342",  number: "3.4.2", label: "Quiz individual de herramientas informaticas y digitales", shortName: "QuizHerramientas", type: "form" },
    ],
  });

  // ── Guia 3 — Implementar componentes de las herramientas tecnologicas (10A + 10B) ────
  register({
    files: [
      "grupo-10a-guia-03-planificar-informacion.html",
      "grupo-10b-guia-03-planificar-informacion.html",
    ],
    guideNumber: "3",
    guideTitle: "Guia 3 - Implementar componentes de las herramientas tecnologicas",
    stateKey: "guia_interactiva_10a_guia3_html",
    program: PROGRAM,
    competencia: "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
    resultado: "RAP 02 - Implementar componentes de las herramientas tecnologicas segun procedimientos de la organizacion.",
    activities: [
      { id: "bitacora311",    number: "3.1.1", label: "Bitacora individual de analisis",     shortName: "Bitacora",      type: "form" },
      // 3.1.2, 3.2.1 y 3.2.2: la guia dice "equipos de tres (3)" - cada actividad puede tener su PROPIO equipo (scope: "activity").
      {
        id: "socializacion312", number: "3.1.2", label: "Socializacion del analisis", shortName: "Socializacion", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "activity" },
      },
      // Quiz embebido en 3.1.2. El HTML no tenia el enlace de acceso (bug
      // aparte, corregido junto con esto). Detectado 2026-07-23.
      { id: "quiz-guia3-312", number: "3.1.2.1", label: "Quiz individual de herramientas", shortName: "QuizHerramientas", type: "form" },
      {
        id: "tabla321", number: "3.2.1", label: "Tabla resumen", shortName: "TablaResumen", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "activity" },
      },
      // Quiz embebido en 3.2.1, SOLO 10B (asimetria intencional de la guia).
      { id: "quiz-guia3-321", number: "3.2.1.1", label: "Quiz de contenidos tematicos (solo 10B)", shortName: "QuizContenidos", type: "form" },
      {
        id: "mapa322", number: "3.2.2", label: "Mapa conceptual", shortName: "MapaConceptual", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "activity" },
      },
      // 3.3.1 y 3.3.2: la guia indica carpeta individual con plantilla especifica.
      {
        id: "checklist331", number: "3.3.1", label: "Checklist de instalacion", shortName: "Checklist", type: "form",
        dedicatedFolder: { enabled: true, template: "Evidencias_Act331_{learnerLastFirst}", fileLabel: "Checklist Instalacion" },
      },
      {
        id: "diagnostico332", number: "3.3.2", label: "Diagnostico tecnico", shortName: "Diagnostico", type: "form",
        dedicatedFolder: { enabled: true, template: "Diagnostico_{learnerLastFirst}_{date}", fileLabel: "Diagnostico Tecnico" },
      },
      { id: "documento333",   number: "3.3.3", label: "Documento tecnico de gestion de informacion", shortName: "DocTecnico", type: "file" },
      { id: "presupuesto341", number: "3.4.1", label: "Presupuesto final",                   shortName: "Presupuesto",   type: "form" },
      { id: "sustentacion342",number: "3.4.2", label: "Presentacion y sustentacion oral",    shortName: "Sustentacion",  type: "file" },
    ],
  });

  // ── Taller Integrador (JFK 10A + 10B, solo grado 10) — NO es una "guia" ────
  // pedagogica mas (no lleva numero de guia visible para el aprendiz), es un
  // proyecto de cierre aparte. guideNumber:"4" se deja solo como identificador
  // interno para el nombre de archivo entregado (Guia_4_Actividad_N_...),
  // convencion compartida con el resto de guias en activity_standard.js.
  // Proyecto de cierre por equipos (3-4 aprendices) con un actor productivo real.
  // Los 6 productos son documentos externos (Word/Excel); el listado del equipo
  // va en la portada de cada documento, por eso ninguna actividad usa
  // teamRequirement (igual que documento333/sustentacion342 arriba). En cambio,
  // para el CONTROL INTERNO de entregas (pedido explicito del usuario), cada
  // integrante del equipo debe entregar el mismo documento desde su PROPIA
  // cuenta (no solo uno por el equipo) — asi cada aprendiz queda con su propio
  // registro de entrega (fecha/archivo/link), sin depender de un mecanismo de
  // equipo nuevo. Ver notas de cada driveTarget. Las fechas (distintas entre
  // 10A y 10B) no se hardcodean: el admin las configura en el panel de Fechas
  // limite si quiere bloqueo automatico.
  register({
    files: [
      "grupo-10a-guia-04-taller-integrador.html",
      "grupo-10b-guia-04-taller-integrador.html",
    ],
    guideNumber: "4",
    guideTitle: "Taller Integrador",
    stateKey: "guia_interactiva_10a_guia4_html",
    program: PROGRAM,
    competencia: "Proyecto formativo integrador - Diagnostico, intervencion y evaluacion de un actor productivo real en alfabetizacion digital, soporte tecnico y ciberseguridad.",
    resultado: "Taller Integrador - Trabajo en equipo con un actor productivo real de la zona de influencia del Centro de Formacion.",
    activities: [
      {
        id: "equipoTaller", number: "0", label: "Conformacion del equipo de trabajo",
        shortName: "Equipo", type: "form", formFields: ["equipoTaller"],
        buttonIds: { save: "btnGuardarEquipoTaller", status: "statusEquipoTaller" },
      },
      {
        id: "diagnostico", number: "1", label: "Informe diagnostico de capacidades digitales y necesidades tecnologicas locales",
        shortName: "InformeDiagnostico", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-1",
          deadlineActivityId: "diagnostico",
          activityTitle: "Producto 1 - Informe diagnostico",
          description: "Sube el informe diagnostico del actor productivo: caracterizacion, manejo ofimatico, riesgos de ciberseguridad y necesidades de mantenimiento.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "planAlfabetizacion", number: "2", label: "Plan de alfabetizacion digital, soporte tecnico y formacion en ciberseguridad",
        shortName: "PlanIntervencion", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-2",
          deadlineActivityId: "planAlfabetizacion",
          activityTitle: "Producto 2 - Plan de intervencion",
          description: "Sube el plan de alfabetizacion digital, soporte tecnico y ciberseguridad, con cronograma y responsables.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "plantillaExcel", number: "3", label: "Plantilla en Excel personalizada segun la necesidad del cliente",
        shortName: "PlantillaExcel", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-3",
          deadlineActivityId: "plantillaExcel",
          activityTitle: "Producto 3 - Plantilla Excel personalizada",
          description: "Sube el documento que describe la plantilla en Excel (y el archivo .xlsx si tu instructor lo pide).",
          note: "Mismo documento para todo el equipo (adjunta el .xlsx si aplica), pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "bitacoraAsesorias", number: "4", label: "Bitacora de asesorias tecnicas, talleres digitales y practicas de ciberseguridad",
        shortName: "Bitacora", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-4",
          deadlineActivityId: "bitacoraAsesorias",
          activityTitle: "Producto 4 - Bitacora de asesorias",
          description: "Sube la bitacora cronologica de las sesiones con el actor productivo, con evidencia fotografica o de firma.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "fichaEquipos", number: "5", label: "Ficha tecnica de equipos intervenidos",
        shortName: "FichaTecnica", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-5",
          deadlineActivityId: "fichaEquipos",
          activityTitle: "Producto 5 - Ficha tecnica de equipos",
          description: "Sube la ficha tecnica de los equipos de computo revisados o intervenidos.",
          note: "Mismo documento para todo el equipo (junto con el Producto 4), pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "informeImpacto", number: "6", label: "Informe de impacto, lecciones aprendidas y propuesta de continuidad comunitaria",
        shortName: "InformeImpacto", type: "file",
        driveTarget: {
          panelKey: "taller-jfk-6",
          deadlineActivityId: "informeImpacto",
          activityTitle: "Producto 6 - Informe de impacto (entrega final)",
          description: "Sube el informe final de impacto, lecciones aprendidas y propuesta de continuidad.",
          note: "Entrega final: mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
    ],
  });

  // ── Taller Integrador (Santa Barbara 10A + 10B, solo grado 10) ─────────────
  // Mismo proyecto de cierre que el de JFK (ver bloque anterior), pero registro
  // SEPARADO porque el stateKey, los panelKeys de Drive y las fechas por corte
  // son propios de la institucion Santa Barbara (no comparte doc/carpeta con
  // JFK). El script js/script_taller_integrador.js es el mismo para ambas
  // instituciones (generico via STORAGE_FILE_ALIASES); solo cambia el HTML/
  // partial (institucion + fechas) y este registro.
  register({
    files: [
      "santa-barbara-10a-guia-04-taller-integrador.html",
      "santa-barbara-10b-guia-04-taller-integrador.html",
    ],
    guideNumber: "4",
    guideTitle: "Taller Integrador",
    stateKey: "guia_interactiva_sb_10a_guia4_html",
    program: PROGRAM,
    competencia: "Proyecto formativo integrador - Diagnostico, intervencion y evaluacion de un actor productivo real en alfabetizacion digital, soporte tecnico y ciberseguridad.",
    resultado: "Taller Integrador - Trabajo en equipo con un actor productivo real de la zona de influencia del Centro de Formacion.",
    activities: [
      {
        id: "equipoTaller", number: "0", label: "Conformacion del equipo de trabajo",
        shortName: "Equipo", type: "form", formFields: ["equipoTaller"],
        buttonIds: { save: "btnGuardarEquipoTaller", status: "statusEquipoTaller" },
      },
      {
        id: "diagnostico", number: "1", label: "Informe diagnostico de capacidades digitales y necesidades tecnologicas locales",
        shortName: "InformeDiagnostico", type: "file",
        driveTarget: {
          panelKey: "taller-sb-1",
          deadlineActivityId: "diagnostico",
          activityTitle: "Producto 1 - Informe diagnostico",
          description: "Sube el informe diagnostico del actor productivo: caracterizacion, manejo ofimatico, riesgos de ciberseguridad y necesidades de mantenimiento.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "planAlfabetizacion", number: "2", label: "Plan de alfabetizacion digital, soporte tecnico y formacion en ciberseguridad",
        shortName: "PlanIntervencion", type: "file",
        driveTarget: {
          panelKey: "taller-sb-2",
          deadlineActivityId: "planAlfabetizacion",
          activityTitle: "Producto 2 - Plan de intervencion",
          description: "Sube el plan de alfabetizacion digital, soporte tecnico y ciberseguridad, con cronograma y responsables.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "plantillaExcel", number: "3", label: "Plantilla en Excel personalizada segun la necesidad del cliente",
        shortName: "PlantillaExcel", type: "file",
        driveTarget: {
          panelKey: "taller-sb-3",
          deadlineActivityId: "plantillaExcel",
          activityTitle: "Producto 3 - Plantilla Excel personalizada",
          description: "Sube el documento que describe la plantilla en Excel (y el archivo .xlsx si tu instructor lo pide).",
          note: "Mismo documento para todo el equipo (adjunta el .xlsx si aplica), pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "bitacoraAsesorias", number: "4", label: "Bitacora de asesorias tecnicas, talleres digitales y practicas de ciberseguridad",
        shortName: "Bitacora", type: "file",
        driveTarget: {
          panelKey: "taller-sb-4",
          deadlineActivityId: "bitacoraAsesorias",
          activityTitle: "Producto 4 - Bitacora de asesorias",
          description: "Sube la bitacora cronologica de las sesiones con el actor productivo, con evidencia fotografica o de firma.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "fichaEquipos", number: "5", label: "Ficha tecnica de equipos intervenidos",
        shortName: "FichaTecnica", type: "file",
        driveTarget: {
          panelKey: "taller-sb-5",
          deadlineActivityId: "fichaEquipos",
          activityTitle: "Producto 5 - Ficha tecnica de equipos",
          description: "Sube la ficha tecnica de los equipos de computo revisados o intervenidos.",
          note: "Mismo documento para todo el equipo (junto con el Producto 4), pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "informeImpacto", number: "6", label: "Informe de impacto, lecciones aprendidas y propuesta de continuidad comunitaria",
        shortName: "InformeImpacto", type: "file",
        driveTarget: {
          panelKey: "taller-sb-6",
          deadlineActivityId: "informeImpacto",
          activityTitle: "Producto 6 - Informe de impacto (entrega final)",
          description: "Sube el informe final de impacto, lecciones aprendidas y propuesta de continuidad.",
          note: "Entrega final: mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
    ],
  });

  // ── Taller Integrador (Santa Barbara 11A + 11B, solo grado 11) ─────────────
  // Proyecto de cierre, distinto del Taller Integrador de grado 10 (mismo
  // js/script_taller_integrador.js, generalizado por GUIDE_DATA_FILE): 4
  // productos (no 6), un solo corte por producto, dirigido a una MiPyme real
  // de Boyaca. Es el ULTIMO ano de contrato de estos grupos (cierra 30-nov):
  // no hay grado 12 al que trasladar pendientes del Producto 4. Igual que el
  // taller de grado 10, ninguna actividad usa teamRequirement (el equipo va
  // en la portada del documento), pero cada integrante entrega el mismo
  // documento desde su PROPIA cuenta para el control interno del instructor.
  register({
    files: [
      "grupo-11a-guia-09-taller-integrador.html",
      "grupo-11b-guia-09-taller-integrador.html",
    ],
    guideNumber: "9",
    guideTitle: "Taller Integrador",
    stateKey: "guia_interactiva_11a_guia9_html",
    program: PROGRAM,
    competencia: "Proyecto formativo integrador - Diagnostico, planeacion, ejecucion y validacion del mantenimiento de equipos de computo y redes de datos en una MiPyme real de la region de Boyaca.",
    resultado: "Taller Integrador - Trabajo en equipo con una MiPyme real de la region de Boyaca (ultimo ano de contrato del grupo, cierra el 30 de noviembre).",
    activities: [
      {
        id: "equipoTaller", number: "0", label: "Conformacion del equipo de trabajo",
        shortName: "Equipo", type: "form", formFields: ["equipoTaller"],
        buttonIds: { save: "btnGuardarEquipoTaller", status: "statusEquipoTaller" },
      },
      {
        id: "informeInfraestructura", number: "1", label: "Informe del estado de la infraestructura, equipos, redes y herramientas",
        shortName: "InformeInfraestructura", type: "file",
        driveTarget: {
          panelKey: "taller-sb11-1",
          deadlineActivityId: "informeInfraestructura",
          activityTitle: "Producto 1 - Informe del estado de la infraestructura",
          description: "Sube el informe del estado de la infraestructura, equipos, redes y herramientas de la MiPyme seleccionada.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "planMejora", number: "2", label: "Plan de mejora",
        shortName: "PlanMejora", type: "file",
        driveTarget: {
          panelKey: "taller-sb11-2",
          deadlineActivityId: "planMejora",
          activityTitle: "Producto 2 - Plan de mejora",
          description: "Sube el plan de mejora: parametros y recursos de red, mantenimiento preventivo/correctivo, cronograma y herramientas de control.",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "informeEjecucion", number: "3", label: "Informe de ejecucion",
        shortName: "InformeEjecucion", type: "file",
        driveTarget: {
          panelKey: "taller-sb11-3",
          deadlineActivityId: "informeEjecucion",
          activityTitle: "Producto 3 - Informe de ejecucion",
          description: "Sube el informe de ejecucion del mantenimiento fisico y logico realizado en la MiPyme (cubre las sesiones de septiembre y octubre).",
          note: "Mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta.",
        },
      },
      {
        id: "reporteCumplimiento", number: "4", label: "Reporte de cumplimiento (entrega final)",
        shortName: "ReporteCumplimiento", type: "file",
        driveTarget: {
          panelKey: "taller-sb11-4",
          deadlineActivityId: "reporteCumplimiento",
          activityTitle: "Producto 4 - Reporte de cumplimiento (entrega final)",
          description: "Sube el reporte de cumplimiento: validacion frente al plan de mejora, resultados y lecciones aprendidas.",
          note: "Entrega final: mismo documento para todo el equipo, pero cada integrante debe entregarlo desde su propia cuenta. No hay grado 12 al cual trasladar pendientes.",
        },
      },
    ],
  });

  // ── Guia 5 — Herramientas informaticas y digitales (11A + 11B) ─────────────
  register({
    files: [
      "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
      "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
    ],
    guideNumber: "5",
    guideTitle: "Guia 5 - Operar herramientas informaticas y digitales (Grado 11)",
    stateKey: "guia_interactiva_11a_guia_html",
    program: PROGRAM,
    competencia: COMPETENCIA,
    resultado: RAP_HERRAMIENTAS,
    activities: [
      { id: "guia5-311", number: "3.1.1", label: "Bitacora o analisis del caso", shortName: "Bitacora",   type: "form", fieldPrefixes: ["bitacora:", "reflexion:"] },
      // Juego (Educaplay: sopa de letras + relaciona nombre y concepto), sin
      // campo de texto -- solo Aprobado/No aprobado por observacion (mismo
      // patron que sopaletras321 en Guia 1). Faltaba por completo del
      // catalogo de guide_declarations y de Calificaciones -- por eso en
      // "Tus actividades de esta guia" solo aparecian 3 en vez de 4.
      // Detectado 2026-07-24.
      { id: "guia5-321", number: "3.2.1", label: "Reconocimiento de conceptos y herramientas", shortName: "Reconocimiento", type: "form" },
      { id: "guia5-331", number: "3.3.1", label: "Evidencias de herramientas",   shortName: "Evidencias", type: "form", fieldPrefixes: ["extension:", "system:", "matching:"] },
      { id: "guia5-341", number: "3.4.1", label: "Informe final integrador",     shortName: "InformeFinal", type: "file" },
    ],
  });

  // ── Guia 6 — Implementar componentes de las herramientas tecnologicas (11A + 11B) ────
  var RAP_IMPLEMENTAR_HERRAMIENTAS = "RAP 02 - Implementar componentes de las herramientas tecnologicas segun procedimientos de la organizacion.";
  var COMP_OPERAR_HERRAMIENTAS = "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.";
  register({
    files: [
      "grupo-11a-guia-06-planificar-informacion.html",
      "grupo-11b-guia-06-planificar-informacion.html",
    ],
    guideNumber: "6",
    guideTitle: "Guia 6 - Implementar componentes de las herramientas tecnologicas segun procedimientos de la organizacion (Grado 11)",
    stateKey: "guia_interactiva_11a_guia6_html",
    program: PROGRAM,
    competencia: COMP_OPERAR_HERRAMIENTAS,
    resultado: RAP_IMPLEMENTAR_HERRAMIENTAS,
    activities: [
      { id: "bitacora311",     number: "3.1.1", label: "Bitacora individual de analisis", shortName: "Bitacora",      type: "form" },
      // 3.1.2, 3.2.1 y 3.2.2: la guia 6 (grado 11) dice "equipos de 3" - comparten el mismo equipo.
      {
        id: "socializacion312", number: "3.1.2", label: "Socializacion del analisis", shortName: "Socializacion", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "guide" },
      },
      // Quiz autocalificado embebido en la tarjeta 3.1.2. Detectado 2026-07-23.
      { id: "quiz-guia6-312", number: "3.1.2.1", label: "Quiz individual de herramientas", shortName: "QuizHerramientas", type: "form" },
      {
        id: "tabla321", number: "3.2.1", label: "Tabla resumen", shortName: "TablaResumen", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "guide" },
      },
      {
        id: "mapa322", number: "3.2.2", label: "Mapa conceptual", shortName: "MapaConceptual", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "guide" },
      },
      // 3.3.1 y 3.3.2: la guia indica carpeta individual con plantilla especifica.
      {
        id: "checklist331", number: "3.3.1", label: "Checklist de instalacion", shortName: "Checklist", type: "form",
        dedicatedFolder: { enabled: true, template: "Evidencias_Act331_{learnerLastFirst}", fileLabel: "Checklist Instalacion" },
      },
      {
        id: "diagnostico332", number: "3.3.2", label: "Diagnostico tecnico", shortName: "Diagnostico", type: "form",
        dedicatedFolder: { enabled: true, template: "Diagnostico_{learnerLastFirst}_{date}", fileLabel: "Diagnostico Tecnico" },
      },
      { id: "presupuesto341",  number: "3.4.1", label: "Presupuesto final",               shortName: "Presupuesto",   type: "form" },
    ],
  });

  // ── Guia 7 — Planificar la informacion segun criterios de ciberseguridad (11A + 11B) ────
  var RAP_CIBERSEGURIDAD = "RAP 03 - Planificar la informacion segun criterios de ciberseguridad.";
  var COMP_CIBERSEG = "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.";
  register({
    files: [
      "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html",
      "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html",
    ],
    guideNumber: "7",
    guideTitle: "Guia 7 - Planificar la informacion segun criterios de ciberseguridad (Grado 11)",
    stateKey: "guia_interactiva_11a_guia7_html",
    program: PROGRAM,
    competencia: COMP_CIBERSEG,
    resultado: RAP_CIBERSEGURIDAD,
    activities: [
      {
        id: "caso311", number: "3.1.1", label: "Analisis del caso ElectroBoyca",
        shortName: "CasoElectroBoyca", type: "form",
        formFields: ["g7_311_pregunta1", "g7_311_pregunta2", "g7_311_pregunta3", "g7_311_pregunta4", "g7_311_pregunta5", "g7_311_pregunta6"],
        buttonIds: { save: "btnGuardarCaso311", status: "statusCaso311" },
        wordExport: {
          contextBox:
            "Caso ElectroBoyca S.A.S. (Puerto Boyaca): distribuidora victima de phishing y ransomware. Sin copias de seguridad, antivirus desactivado, sin politica de seguridad.",
          sections: [
            { label: "1. Vector de ataque y senales del caso", storeKey: "g7_311_pregunta1" },
            { label: "2. Debilidades y evidencias del caso", storeKey: "g7_311_pregunta2" },
            { label: "3. Impacto en Confidencialidad, Integridad y Disponibilidad", storeKey: "g7_311_pregunta3" },
            { label: "4. Controles preventivos y prioridad alta", storeKey: "g7_311_pregunta4" },
            { label: "5. Activos criticos en mayor riesgo", storeKey: "g7_311_pregunta5" },
            { label: "6. Primeras 24 horas de contencion y recuperacion", storeKey: "g7_311_pregunta6" },
          ],
        },
      },
      {
        id: "plenaria312", number: "3.1.2", label: "Socializacion en plenaria",
        shortName: "Plenaria", type: "form",
        formFields: ["g7_312_acuerdos", "g7_312_hallazgo", "g7_312_medida", "g7_312_preguntas", "g7_312_bitacora"],
        buttonIds: { save: "btnGuardarPlenaria312", status: "statusPlenaria312" },
        wordExport: {
          contextBox: "Plenaria grupal sobre el caso ElectroBoyca y los saberes previos de ciberseguridad.",
          sections: [
            { label: "1. Acuerdos del equipo despues de comparar 3.1.1", storeKey: "g7_312_acuerdos" },
            { label: "2. Hallazgo mas importante del equipo", storeKey: "g7_312_hallazgo" },
            { label: "3. Medida de seguridad mas urgente para ElectroBoyca", storeKey: "g7_312_medida" },
            { label: "4. Preguntas pendientes para resolver durante la guia", storeKey: "g7_312_preguntas" },
            { label: "5. Sintesis personal de la socializacion", storeKey: "g7_312_bitacora" },
          ],
        },
      },
      {
        id: "bloqueAB321", number: "3.2.1", label: "Estudio de contenidos (Bloques A y B) - Tabla resumen",
        shortName: "BloqueAB", type: "both",
        formFields: ["g7_321_reparto", "g7_321_temas", "g7_321_concepto", "g7_321_consiste", "g7_321_ejemplo", "g7_321_aporte", "g7_321_dudas"],
        buttonIds: { save: "btnGuardarBloqueAB321", status: "statusBloqueAB321" },
        wordExport: {
          contextBox:
            "Estudio en equipo de los 9 temas conceptuales de ciberseguridad (Bloques A y B). Entregable de equipo: tabla resumen PDF.",
          sections: [
            { label: "1. Reparto de temas del equipo", storeKey: "g7_321_reparto" },
            { label: "2. Temas que estudiaste", storeKey: "g7_321_temas" },
            { label: "3. Concepto / control de tu fila", storeKey: "g7_321_concepto" },
            { label: "4. En que consiste", storeKey: "g7_321_consiste" },
            { label: "5. Ejemplo aplicado a una MiPyme de Boyaca", storeKey: "g7_321_ejemplo" },
            { label: "6. Aporte agregado despues de la socializacion", storeKey: "g7_321_aporte" },
            { label: "7. Dudas pendientes para el mapa conceptual", storeKey: "g7_321_dudas" },
            { label: "8. Tabla resumen construida en la guia (Paso 2)", storeKey: "g7_321_tabla_text" },
          ],
        },
        driveTarget: {
          panelKey: "guia7-3-2-1",
          deadlineActivityId: "bloqueAB321",
          activityTitle: "Tabla resumen de los Bloques A y B (BloqueAB_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive la tabla resumen en PDF construida por el equipo (3 columnas: Concepto, En que consiste, Ejemplo en una MiPyme).",
          note: "Nombre sugerido: BloqueAB_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "mapa322", number: "3.2.2", label: "Mapa conceptual de ciberseguridad RAP 03",
        shortName: "MapaConceptual", type: "both",
        formFields: ["g7_322_central", "g7_322_ramas", "g7_322_enlaces", "g7_322_cia_mipyme"],
        buttonIds: { save: "btnGuardarMapa322", status: "statusMapa322" },
        wordExport: {
          contextBox:
            "Mapa conceptual de ciberseguridad RAP 03: minimo 15 conceptos, Triada CIA, normativa (ISO 27001, NIST CSF, Ley 1273), 2 controles de hardening. Evidencia de Conocimiento (IE-01).",
          sections: [
            { label: "1. Concepto central elegido", storeKey: "g7_322_central" },
            { label: "2. Ramas principales (min. 4)", storeKey: "g7_322_ramas" },
            { label: "3. Palabras de enlace mas usadas", storeKey: "g7_322_enlaces" },
            { label: "4. Aplicacion concreta de la Triada CIA en una MiPyme", storeKey: "g7_322_cia_mipyme" },
          ],
        },
        driveTarget: {
          panelKey: "guia7-3-2-2",
          deadlineActivityId: "mapa322",
          activityTitle: "Mapa conceptual RAP 03 (MapaConceptual_RAP03_[Equipo]_v1.0.pdf)",
          description: "Sube a Drive el mapa conceptual exportado a PDF y la evidencia de la presentacion oral del equipo.",
          note: "Nombre sugerido: MapaConceptual_RAP03_[Equipo]_v1.0.pdf",
        },
      },
      {
        id: "diagnostico331", number: "3.3.1", label: "Diagnostico del estado de seguridad del equipo",
        shortName: "Diagnostico", type: "both",
        formFields: ["g7_331_estado", "g7_331_hallazgos", "g7_331_prioridades", "g7_331_conclusion"],
        buttonIds: { save: "btnGuardarDiagnostico331", status: "statusDiagnostico331" },
        wordExport: {
          contextBox:
            "Diagnostico del estado de seguridad de un equipo Windows real con Windows Security, Belarc Advisor, secpol.msc, lusrmgr.msc. Evidencia de Conocimiento + Desempeno (IE-02 items 1-6).",
          sections: [
            { label: "1. Estado general de seguridad del equipo", storeKey: "g7_331_estado" },
            { label: "2. Los 3 hallazgos mas criticos (con nivel de riesgo)", storeKey: "g7_331_hallazgos" },
            { label: "3. Controles que priorizarias y por que", storeKey: "g7_331_prioridades" },
            { label: "4. Conclusion tecnica (minimo 8 lineas)", storeKey: "g7_331_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia7-3-3-1",
          deadlineActivityId: "diagnostico331",
          activityTitle: "Diagnostico de seguridad (Diagnostico_[TuNombre]_[Fecha])",
          description: "Sube a Drive la Tabla de Diagnostico, las 6 capturas numeradas y el reporte HTML de Belarc Advisor.",
          note: "Carpeta sugerida: Diagnostico_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "hardening332", number: "3.3.2", label: "Implementacion de controles de hardening",
        shortName: "Hardening", type: "both",
        formFields: ["g7_332_orden", "g7_332_resumen", "g7_332_errores", "g7_332_conclusion"],
        buttonIds: { save: "btnGuardarHardening332", status: "statusHardening332" },
        wordExport: {
          contextBox:
            "Implementacion de 7 controles de hardening de Windows priorizando por nivel de riesgo del diagnostico. Evidencia de Desempeno (IE-02 items 7-13).",
          sections: [
            { label: "1. Orden de aplicacion de los 7 controles", storeKey: "g7_332_orden" },
            { label: "2. Resumen de cambios (antes / accion / despues)", storeKey: "g7_332_resumen" },
            { label: "3. Errores encontrados y solucion aplicada", storeKey: "g7_332_errores" },
            { label: "4. Conclusion comparativa (minimo 10 lineas)", storeKey: "g7_332_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia7-3-3-2",
          deadlineActivityId: "hardening332",
          activityTitle: "Hardening del equipo (Hardening_[TuNombre]_[Fecha])",
          description: "Sube a Drive la Bitacora de cambios y las 7 capturas numeradas y descriptivas de los controles aplicados.",
          note: "Carpeta sugerida: Hardening_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "plan341", number: "3.4.1", label: "Plan de Ciberseguridad para una MiPyme + Sustentacion oral",
        shortName: "PlanCiberseguridad", type: "both",
        formFields: [
          "g7_341_sec_a", "g7_341_sec_b", "g7_341_sec_c", "g7_341_sec_d",
          "g7_341_sec_e", "g7_341_sec_f", "g7_341_sec_g",
        ],
        buttonIds: { save: "btnGuardarPlan341", status: "statusPlan341" },
        wordExport: {
          contextBox:
            "Plan de Ciberseguridad para ElectroBoyca S.A.S. integrando diagnostico, controles, inventario y estrategia 3-2-1. Producto + Sustentacion oral (IE-03). Indice borrador previo a la redaccion.",
          sections: [
            { label: "A. Resumen ejecutivo", storeKey: "g7_341_sec_a" },
            { label: "B. Diagnostico de seguridad", storeKey: "g7_341_sec_b" },
            { label: "C. Controles implementados", storeKey: "g7_341_sec_c" },
            { label: "D. Inventario de activos con valoracion de riesgos", storeKey: "g7_341_sec_d" },
            { label: "E. Estrategia de copias de seguridad 3-2-1", storeKey: "g7_341_sec_e" },
            { label: "F. Recomendaciones a mediano plazo (minimo 3 con norma)", storeKey: "g7_341_sec_f" },
            { label: "G. Bibliografia (minimo 5 fuentes, APA o IEEE)", storeKey: "g7_341_sec_g" },
          ],
        },
        driveTarget: {
          panelKey: "guia7-3-4-1",
          deadlineActivityId: "plan341",
          activityTitle: "Plan de Ciberseguridad (PlanCiberseguridad_[TuNombre].pdf)",
          description: "Sube a Drive el Plan de Ciberseguridad en PDF (minimo 8 paginas, secciones A-G) y la presentacion para la sustentacion oral.",
          note: "Nombre sugerido: PlanCiberseguridad_[TuNombre].pdf",
        },
      },
    ],
  });

  // ── Guia 8 — Documentar la gestion de la informacion (11A + 11B) ────────
  var RAP_DOCUMENTAR_GESTION = "RAP 04 - Documentar la gestion de la informacion de acuerdo a protocolos establecidos.";
  register({
    files: [
      "grupo-11a-guia-08-documentar-gestion-informacion.html",
      "grupo-11b-guia-08-documentar-gestion-informacion.html",
    ],
    guideNumber: "8",
    guideTitle: "Guia 8 - Documentar la gestion de la informacion (Grado 11)",
    stateKey: "guia_interactiva_11a_guia8_html",
    // Bloque G (auditoria 2026-08-27): fuente unica del alias de Firestore de
    // esta guia. admin_habilitacion.js (panel de habilitacion) lo consulta
    // ANTES de su tabla CLOUD_FILE_ALIASES -- sin esto, el pull de habilitacion
    // buscaba el doc con el nombre crudo, no encontraba nada, y el grupo
    // aparecia vacio sin error (detectado porque faltaba tambien en esa tabla).
    // Debe coincidir con STORAGE_FILE_ALIASES en js/script_guia8.js.
    cloudFileNames: {
      "grupo-11a-guia-08-documentar-gestion-informacion.html": "11a_guia8.html",
      "grupo-11b-guia-08-documentar-gestion-informacion.html": "11b_guia8.html",
    },
    program: PROGRAM,
    competencia: COMP_CIBERSEG,
    resultado: RAP_DOCUMENTAR_GESTION,
    activities: [
      {
        id: "caso411", number: "4.1.1", label: "Analisis del caso Agropecuaria La Esperanza",
        shortName: "CasoAgropecuaria", type: "form",
        formFields: ["g8_411_datos", "g8_411_consecuencias", "g8_411_experiencia", "g8_411_documento"],
        buttonIds: { save: "btnGuardarCaso411", status: "statusCaso411" },
        wordExport: {
          contextBox:
            "Caso Agropecuaria La Esperanza (Chiquinquira): el tecnico anterior no dejo ningun documento y la empresa no puede resolver una falla de impresora ni el archivo de cartera.",
          sections: [
            { label: "1. Informacion que debio documentar el tecnico anterior (min. 5 datos)", storeKey: "g8_411_datos" },
            { label: "2. Consecuencias que sufre hoy la empresa (min. 3)", storeKey: "g8_411_consecuencias" },
            { label: "3. Experiencia propia de perdida de informacion o tiempo", storeKey: "g8_411_experiencia" },
            { label: "4. Documento que elaborarias primero y por que", storeKey: "g8_411_documento" },
          ],
        },
      },
      {
        id: "plenaria412", number: "4.1.2", label: "Socializacion en plenaria",
        shortName: "Plenaria", type: "form",
        formFields: ["g8_412_comunes", "g8_412_documento_urgente", "g8_412_reflexion"],
        buttonIds: { save: "btnGuardarPlenaria412", status: "statusPlenaria412" },
        wordExport: {
          contextBox: "Plenaria grupal sobre el caso Agropecuaria La Esperanza y los tipos documentales que surgieron en el tablero.",
          sections: [
            { label: "1. Puntos en comun y diferencias del grupo de 3", storeKey: "g8_412_comunes" },
            { label: "2. Documento mas urgente y que debe contener", storeKey: "g8_412_documento_urgente" },
            { label: "3. Que cambio en tu comprension del caso y preguntas pendientes", storeKey: "g8_412_reflexion" },
          ],
        },
      },
      {
        id: "bloqueAB421", number: "4.2.1", label: "Estudio de contenidos (Bloques A y B) - Tabla resumen",
        shortName: "BloqueAB", type: "both",
        formFields: ["g8_421_reparto", "g8_421_temas", "g8_421_documento", "g8_421_paraque", "g8_421_ejemplo", "g8_421_aporte", "g8_421_dudas"],
        buttonIds: { save: "btnGuardarBloqueAB421", status: "statusBloqueAB421" },
        wordExport: {
          contextBox:
            "Estudio en equipo de los 9 temas conceptuales de gestion documental (Bloques A y B). Entregable de equipo: tabla resumen PDF.",
          sections: [
            { label: "1. Reparto de temas del equipo", storeKey: "g8_421_reparto" },
            { label: "2. Temas que estudiaste", storeKey: "g8_421_temas" },
            { label: "3. Documento / Protocolo de tu fila", storeKey: "g8_421_documento" },
            { label: "4. Para que sirve", storeKey: "g8_421_paraque" },
            { label: "5. Ejemplo aplicado a una MiPyme de Boyaca", storeKey: "g8_421_ejemplo" },
            { label: "6. Aporte agregado despues de la plenaria de cierre", storeKey: "g8_421_aporte" },
            { label: "7. Dudas pendientes para el mapa conceptual", storeKey: "g8_421_dudas" },
          ],
        },
        driveTarget: {
          panelKey: "guia8-4-2-1",
          deadlineActivityId: "bloqueAB421",
          activityTitle: "Tabla resumen de los Bloques A y B (BloqueAB_RAP04_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive la tabla resumen en PDF construida por el equipo (3 columnas: Documento/Protocolo, Para que sirve, Ejemplo en una MiPyme).",
          note: "Nombre sugerido: BloqueAB_RAP04_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "mapa422", number: "4.2.2", label: "Mapa conceptual del sistema documental",
        shortName: "MapaConceptual", type: "both",
        formFields: ["g8_422_central", "g8_422_relacion", "g8_422_protocolo", "g8_422_aplicacion"],
        buttonIds: { save: "btnGuardarMapa422", status: "statusMapa422" },
        wordExport: {
          contextBox:
            "Mapa conceptual del sistema documental RAP 04: minimo 15 conceptos, relacion activo->ficha tecnica->hoja de vida->registros->informe->mejora, 5 tipos documentales, un protocolo de organizacion y una aplicacion en MiPyme. Evidencia de Conocimiento (IE-01).",
          sections: [
            { label: "1. Concepto central elegido", storeKey: "g8_422_central" },
            { label: "2. Relacion logica del mapa (activo -> ficha -> hoja de vida -> registros -> informe -> mejora)", storeKey: "g8_422_relacion" },
            { label: "3. Protocolo de organizacion explicado con un ejemplo", storeKey: "g8_422_protocolo" },
            { label: "4. Aplicacion concreta en una MiPyme regional", storeKey: "g8_422_aplicacion" },
          ],
        },
        driveTarget: {
          panelKey: "guia8-4-2-2",
          deadlineActivityId: "mapa422",
          activityTitle: "Mapa conceptual RAP 04 (MapaConceptual_RAP04_[Equipo]_v1.0.pdf)",
          description: "Sube a Drive el mapa conceptual exportado a PDF y la evidencia de la presentacion oral del equipo.",
          note: "Nombre sugerido: MapaConceptual_RAP04_[Equipo]_v1.0.pdf",
        },
      },
      {
        id: "portafolio431", number: "4.3.1", label: "Construccion del portafolio documental del equipo asignado",
        shortName: "Portafolio", type: "both",
        formFields: [
          "g8_431_ficha_tecnica", "g8_431_hoja_vida", "g8_431_inventario",
          "g8_431_backup", "g8_431_chequeo", "g8_431_procedimientos", "g8_431_conclusion",
        ],
        buttonIds: { save: "btnGuardarPortafolio431", status: "statusPortafolio431" },
        wordExport: {
          contextBox:
            "Portafolio documental de un equipo real del laboratorio: ficha tecnica, hoja de vida, inventario de software, registro de copias de seguridad, lista de chequeo de operatividad y registro de procedimientos. Evidencia de Desempeno (IE-02).",
          sections: [
            { label: "1. Ficha tecnica del equipo", storeKey: "g8_431_ficha_tecnica" },
            { label: "2. Hoja de vida del equipo", storeKey: "g8_431_hoja_vida" },
            { label: "3. Inventario de software", storeKey: "g8_431_inventario" },
            { label: "4. Registro de copias de seguridad", storeKey: "g8_431_backup" },
            { label: "5. Lista de chequeo de operatividad", storeKey: "g8_431_chequeo" },
            { label: "6. Registro de procedimientos", storeKey: "g8_431_procedimientos" },
            { label: "7. Conclusion tecnica (trabajo independiente, minimo 8 lineas)", storeKey: "g8_431_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia8-4-3-1",
          deadlineActivityId: "portafolio431",
          activityTitle: "Portafolio documental del equipo (6 documentos + capturas numeradas)",
          description: "Sube a Drive los 6 documentos del portafolio diligenciados y las capturas de soporte numeradas (01_FichaTecnica.png ... 06_Procedimientos.png).",
          note: "Carpeta sugerida: Portafolio_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "organizacion432", number: "4.3.2", label: "Organizacion digital: carpetas, convencion de nombres y control de versiones",
        shortName: "OrganizacionDigital", type: "both",
        formFields: ["g8_432_estructura", "g8_432_convencion", "g8_432_versiones", "g8_432_protocolo"],
        buttonIds: { save: "btnGuardarOrganizacion432", status: "statusOrganizacion432" },
        wordExport: {
          contextBox:
            "Organizacion digital del portafolio de la Act. 4.3.1: estructura de carpetas por tipo documental, convencion de nombres, tabla de control de versiones y respaldo en la nube. Evidencia de Desempeno (IE-02).",
          sections: [
            { label: "1. Estructura de carpetas aplicada (7 carpetas por tipo documental)", storeKey: "g8_432_estructura" },
            { label: "2. Convencion de nombres aplicada (ejemplos correctos e incorrectos)", storeKey: "g8_432_convencion" },
            { label: "3. Tabla de control de versiones (cambio real v1.0 -> v1.1)", storeKey: "g8_432_versiones" },
            { label: "4. Protocolo de nombres y versiones (trabajo independiente, max. 1 pagina)", storeKey: "g8_432_protocolo" },
          ],
        },
        driveTarget: {
          panelKey: "guia8-4-3-2",
          deadlineActivityId: "organizacion432",
          activityTitle: "Organizacion digital (carpetas renombradas + arbol tree /f + respaldo en la nube)",
          description: "Sube a Drive la captura del arbol de carpetas (tree /f), la captura de la sincronizacion en la nube y el Protocolo_Nombres_[TuNombre]_v1.0.pdf.",
          note: "Nombre sugerido: Protocolo_Nombres_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "documento441", number: "4.4.1", label: "Documento Tecnico de Gestion de la Informacion + Sustentacion oral",
        shortName: "DocumentoTecnico", type: "both",
        formFields: [
          "g8_441_sec_a", "g8_441_sec_b", "g8_441_sec_c", "g8_441_sec_d",
          "g8_441_sec_e", "g8_441_sec_f", "g8_441_sec_g",
        ],
        buttonIds: { save: "btnGuardarDocumento441", status: "statusDocumento441" },
        wordExport: {
          contextBox:
            "Documento Tecnico de Gestion de la Informacion para Agropecuaria La Esperanza, integrando el portafolio (4.3.1) y el protocolo de organizacion (4.3.2). Producto + Sustentacion oral (IE-03). Indice borrador previo a la redaccion.",
          sections: [
            { label: "A. Introduccion y contexto", storeKey: "g8_441_sec_a" },
            { label: "B. Inventario de activos informaticos", storeKey: "g8_441_sec_b" },
            { label: "C. Fichas tecnicas y hoja de vida", storeKey: "g8_441_sec_c" },
            { label: "D. Registros de procedimientos y de copias de seguridad", storeKey: "g8_441_sec_d" },
            { label: "E. Protocolo de organizacion de la informacion", storeKey: "g8_441_sec_e" },
            { label: "F. Conclusiones y recomendaciones de mejora (minimo 3 con justificacion)", storeKey: "g8_441_sec_f" },
            { label: "G. Bibliografia (minimo 5 fuentes, APA o IEEE)", storeKey: "g8_441_sec_g" },
          ],
        },
        driveTarget: {
          panelKey: "guia8-4-4-1",
          deadlineActivityId: "documento441",
          activityTitle: "Documento Tecnico de Gestion de la Informacion (DocTecnico_GestionInfo_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive el Documento Tecnico en PDF (minimo 8 paginas, secciones A-G) y la presentacion para la sustentacion oral.",
          note: "Nombre sugerido: DocTecnico_GestionInfo_[TuNombre]_v1.0.pdf",
        },
      },
    ],
  });

  // ── Guia 4 — Planificar la informacion segun criterios de ciberseguridad ──
  // (JFK 10A + 10B). Mismo RAP 03 que la Guia 7 de grado 11, pero con la guia
  // de aprendizaje propia del proyecto "Alfabetizacion Digital, Asesoria
  // Tecnica y Ciberseguridad" del CIAS Puerto Boyaca (56 h): caso ElectroBoyca
  // en version Tunja/ransomware, actividad 3.3.3 de documentacion tecnica
  // (documentos A-D) y Plan Integral de minimo 12 paginas. OJO: el Taller
  // Integrador tambien usa guideNumber "4" como identificador interno de
  // archivos entregados; los stateKey/panelKey de esta guia usan el sufijo
  // "guia4ciber"/"guia4c" para no colisionar con el taller
  // (guia_interactiva_10a_guia4_html / taller-jfk-*).
  register({
    files: [
      "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html",
      "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html",
    ],
    guideNumber: "4",
    guideTitle: "Guia 4 - Planificar la informacion segun criterios de ciberseguridad",
    stateKey: "guia_interactiva_10a_guia4ciber_html",
    program: PROGRAM,
    competencia: COMP_CIBERSEG,
    resultado: RAP_CIBERSEGURIDAD,
    activities: [
      {
        id: "caso311", number: "3.1.1", label: "Analisis del caso ElectroBoyca",
        shortName: "CasoElectroBoyca", type: "form",
        formFields: ["g4c_311_pregunta1", "g4c_311_pregunta2", "g4c_311_pregunta3", "g4c_311_pregunta4", "g4c_311_pregunta5"],
        buttonIds: { save: "btnGuardarCaso311", status: "statusCaso311" },
        wordExport: {
          contextBox:
            "Caso ElectroBoyca S.A.S. (Tunja): distribuidora de materiales electricos con 12 empleados atacada con ransomware (rescate de USD 2.500). Antivirus vencido, sin copias de seguridad, sin formacion del personal; cerro operaciones 3 semanas.",
          sections: [
            { label: "1. Que sabes de ataques como el de ElectroBoyca", storeKey: "g4c_311_pregunta1" },
            { label: "2. Por que una empresa pequena puede ser victima", storeKey: "g4c_311_pregunta2" },
            { label: "3. Que habrias recomendado ANTES del ataque", storeKey: "g4c_311_pregunta3" },
            { label: "4. Informacion mas valiosa de una empresa y por que protegerla", storeKey: "g4c_311_pregunta4" },
            { label: "5. Como has protegido tu informacion personal", storeKey: "g4c_311_pregunta5" },
          ],
        },
      },
      {
        id: "plenaria312", number: "3.1.2", label: "Socializacion guiada en plenaria",
        shortName: "Plenaria", type: "form",
        formFields: ["g4c_312_compartida", "g4c_312_aporte", "g4c_312_tablero", "g4c_312_sintesis"],
        buttonIds: { save: "btnGuardarPlenaria312", status: "statusPlenaria312" },
        wordExport: {
          contextBox: "Plenaria grupal moderada por el instructor sobre el caso ElectroBoyca y los saberes previos de ciberseguridad.",
          sections: [
            { label: "1. Respuesta que compartiste con el grupo", storeKey: "g4c_312_compartida" },
            { label: "2. Idea de un companero que te aporto", storeKey: "g4c_312_aporte" },
            { label: "3. Ideas clave registradas en el tablero", storeKey: "g4c_312_tablero" },
            { label: "4. Sintesis personal de la plenaria", storeKey: "g4c_312_sintesis" },
          ],
        },
      },
      {
        id: "bloques321", number: "3.2.1", label: "Estudio de los bloques tematicos A y B",
        shortName: "BloquesAB", type: "form",
        formFields: ["g4c_321_cia", "g4c_321_ataques", "g4c_321_normativa", "g4c_321_documentos", "g4c_321_activos", "g4c_321_dudas"],
        buttonIds: { save: "btnGuardarBloques321", status: "statusBloques321" },
        wordExport: {
          contextBox:
            "Estudio de los bloques tematicos: Bloque A (fundamentos, ataques, normativa, controles, hardening, copias) y Bloque B (documentos de seguridad, inventario de activos, protocolos, versionado).",
          sections: [
            { label: "1. Triada CIA con ejemplos en una MiPyme", storeKey: "g4c_321_cia" },
            { label: "2. Tres tipos de ciberataque: como funcionan y como se previenen", storeKey: "g4c_321_ataques" },
            { label: "3. Ley 1273 de 2009 e ISO 27001", storeKey: "g4c_321_normativa" },
            { label: "4. Politica, procedimiento, instructivo y registro", storeKey: "g4c_321_documentos" },
            { label: "5. Criticidad de activos y versionado de documentos", storeKey: "g4c_321_activos" },
            { label: "6. Dudas para resolver antes del mapa conceptual", storeKey: "g4c_321_dudas" },
          ],
        },
      },
      {
        id: "mapa322", number: "3.2.2", label: "Mapa conceptual integrador",
        shortName: "MapaConceptual", type: "both",
        formFields: ["g4c_322_central", "g4c_322_ramas", "g4c_322_enlaces", "g4c_322_conexion"],
        buttonIds: { save: "btnGuardarMapa322", status: "statusMapa322" },
        wordExport: {
          contextBox:
            "Mapa conceptual integrador en equipo: minimo 20 conceptos, conexion ataques -> controles -> documentacion, al menos una normativa (ISO 27001 o Ley 1273). Elaborado en CmapTools, MindMeister o Canva, exportado a PDF y sustentado en 10 minutos.",
          sections: [
            { label: "1. Concepto central elegido", storeKey: "g4c_322_central" },
            { label: "2. Ramas principales (min. 4)", storeKey: "g4c_322_ramas" },
            { label: "3. Palabras de enlace mas usadas", storeKey: "g4c_322_enlaces" },
            { label: "4. Ejemplo de la conexion ataques -> controles -> documentacion", storeKey: "g4c_322_conexion" },
          ],
        },
        driveTarget: {
          panelKey: "guia4c-3-2-2",
          deadlineActivityId: "mapa322",
          activityTitle: "Mapa conceptual integrador (MapaConceptual_RAP03_[Equipo]_v1.0.pdf)",
          description: "Sube a Drive el mapa conceptual del equipo exportado a PDF (minimo 20 conceptos).",
          note: "Nombre sugerido: MapaConceptual_RAP03_[Equipo]_v1.0.pdf",
        },
      },
      {
        id: "diagnostico331", number: "3.3.1", label: "Diagnostico del estado de seguridad del equipo",
        shortName: "Diagnostico", type: "both",
        formFields: ["g4c_331_estado", "g4c_331_hallazgos", "g4c_331_prioridades", "g4c_331_conclusion"],
        buttonIds: { save: "btnGuardarDiagnostico331", status: "statusDiagnostico331" },
        wordExport: {
          contextBox:
            "Diagnostico del estado de seguridad de un equipo Windows real con Windows Security, Belarc Advisor, secpol.msc, lusrmgr.msc y services.msc. Evidencia LC-01: tabla de diagnostico + capturas por categoria.",
          sections: [
            { label: "1. Estado general de seguridad del equipo", storeKey: "g4c_331_estado" },
            { label: "2. Los 3 hallazgos mas criticos (con nivel de riesgo)", storeKey: "g4c_331_hallazgos" },
            { label: "3. Controles que priorizarias y por que", storeKey: "g4c_331_prioridades" },
            { label: "4. Conclusion tecnica (minimo 8 lineas)", storeKey: "g4c_331_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia4c-3-3-1",
          deadlineActivityId: "diagnostico331",
          activityTitle: "Diagnostico de seguridad (Diagnostico_[TuNombre]_[Fecha])",
          description: "Sube a Drive la Tabla de Diagnostico, las 6 capturas numeradas y el reporte HTML de Belarc Advisor (puede ser un ZIP de la carpeta).",
          note: "Carpeta sugerida: Diagnostico_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "hardening332", number: "3.3.2", label: "Implementacion de controles de hardening",
        shortName: "Hardening", type: "both",
        formFields: ["g4c_332_orden", "g4c_332_resumen", "g4c_332_errores", "g4c_332_conclusion"],
        buttonIds: { save: "btnGuardarHardening332", status: "statusHardening332" },
        wordExport: {
          contextBox:
            "Implementacion de los 7 controles de hardening de Windows priorizando por nivel de riesgo del diagnostico. Evidencia LC-02: capturas de configuracion + bitacora breve de cambios.",
          sections: [
            { label: "1. Orden de aplicacion de los 7 controles", storeKey: "g4c_332_orden" },
            { label: "2. Resumen de cambios (antes / accion / despues)", storeKey: "g4c_332_resumen" },
            { label: "3. Errores encontrados y solucion aplicada", storeKey: "g4c_332_errores" },
            { label: "4. Conclusion comparativa (minimo 10 lineas)", storeKey: "g4c_332_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia4c-3-3-2",
          deadlineActivityId: "hardening332",
          activityTitle: "Hardening del equipo (Hardening_[TuNombre]_[Fecha])",
          description: "Sube a Drive la bitacora de cambios y las 7 capturas numeradas de los controles aplicados (puede ser un ZIP de la carpeta).",
          note: "Carpeta sugerida: Hardening_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "documentos333", number: "3.3.3", label: "Elaboracion de documentacion tecnica (documentos A-D)",
        shortName: "DocumentosTecnicos", type: "both",
        formFields: ["g4c_333_informe", "g4c_333_politica", "g4c_333_inventario", "g4c_333_protocolo"],
        buttonIds: { save: "btnGuardarDocumentos333", status: "statusDocumentos333" },
        wordExport: {
          contextBox:
            "Documentacion tecnica LC-03 con convencion NombreDocumento_FICHA_v1.0_AAAAMMDD: A) Informe de diagnostico (min. 4 pag.), B) Politica basica de seguridad para MiPyme (min. 3 pag.), C) Inventario de activos con valoracion de riesgos, D) Protocolo de copias de seguridad (min. 2 pag.). Carpetas: 01_Diagnostico / 02_Politica_Seguridad / 03_Inventario_Activos / 04_Protocolo_Backup / 05_Evidencias.",
          sections: [
            { label: "A. Informe de diagnostico: hallazgo principal y recomendacion", storeKey: "g4c_333_informe" },
            { label: "B. Politica de seguridad: 3 controles incluidos", storeKey: "g4c_333_politica" },
            { label: "C. Inventario: 3 activos mas criticos con criticidad y amenaza", storeKey: "g4c_333_inventario" },
            { label: "D. Protocolo de backup: estrategia definida", storeKey: "g4c_333_protocolo" },
          ],
        },
        driveTarget: {
          panelKey: "guia4c-3-3-3",
          deadlineActivityId: "documentos333",
          activityTitle: "Documentacion tecnica A-D (ZIP con las 5 carpetas)",
          description: "Sube a Drive un ZIP con las carpetas 01_Diagnostico / 02_Politica_Seguridad / 03_Inventario_Activos / 04_Protocolo_Backup / 05_Evidencias y los 4 documentos con la convencion de nombres.",
          note: "Nombre sugerido: Documentos_[TuNombre]_[Ficha].zip",
        },
      },
      {
        id: "plan341", number: "3.4.1", label: "Plan Integral de Ciberseguridad para MiPyme + Sustentacion oral",
        shortName: "PlanCiberseguridad", type: "both",
        formFields: [
          "g4c_341_sec_resumen", "g4c_341_sec_diagnostico", "g4c_341_sec_controles", "g4c_341_sec_politica",
          "g4c_341_sec_backup", "g4c_341_sec_inventario", "g4c_341_sec_recomendaciones",
        ],
        buttonIds: { save: "btnGuardarPlan341", status: "statusPlan341" },
        wordExport: {
          contextBox:
            "Plan Integral de Ciberseguridad para ElectroBoyca S.A.S. (u otra MiPyme asignada): PDF de minimo 12 paginas (Arial 11, interlineado 1.15) integrando diagnostico, controles, politica, backup, inventario y recomendaciones, con sustentacion oral de 10-15 minutos (max. 10 diapositivas). Evidencia LC-04. Indice borrador previo a la redaccion.",
          sections: [
            { label: "1. Resumen ejecutivo", storeKey: "g4c_341_sec_resumen" },
            { label: "2. Diagnostico (tabla resumen y grafico)", storeKey: "g4c_341_sec_diagnostico" },
            { label: "3. Controles implementados (tabla SI/NO)", storeKey: "g4c_341_sec_controles" },
            { label: "4. Politica de seguridad (documento B)", storeKey: "g4c_341_sec_politica" },
            { label: "5. Estrategia de copias de seguridad (protocolo D + cronograma)", storeKey: "g4c_341_sec_backup" },
            { label: "6. Inventario de activos con valoracion", storeKey: "g4c_341_sec_inventario" },
            { label: "7. Recomendaciones adicionales (minimo 3 con justificacion)", storeKey: "g4c_341_sec_recomendaciones" },
          ],
        },
        driveTarget: {
          panelKey: "guia4c-3-4-1",
          deadlineActivityId: "plan341",
          activityTitle: "Plan Integral de Ciberseguridad (PlanCiberseguridad_NombreAprendiz_FICHA_v1.0_FECHA.pdf)",
          description: "Sube a Drive el Plan Integral en PDF (minimo 12 paginas, con los documentos del 3.3.3 integrados o adjuntos) y la presentacion de la sustentacion.",
          note: "Nombre: PlanCiberseguridad_NombreAprendiz_FICHA_v1.0_FECHA.pdf",
        },
      },
    ],
  });

  // ── Guia 5 — Documentar la gestion de la informacion (Kennedy, Grado 10) ──
  // Mismo RAP 04 y mismo caso (Agropecuaria La Esperanza) que la Guia 8 de
  // grado 11 (Santa Barbara) -- ver register() de "guia-08-documentar-gestion"
  // mas arriba -- pero para las fichas 3441939/3441942 del proyecto "Alfabetizacion
  // Digital, Asesoria Tecnica y Ciberseguridad" del CIAS Puerto Boyaca (mismo
  // proyecto que la Guia 4 - ciberseguridad). Duracion propia: 48 horas (36
  // directas + 12 independientes), distinta de las 40h de la Guia 8.
  register({
    files: [
      "grupo-10a-guia-05-documentar-gestion-informacion.html",
      "grupo-10b-guia-05-documentar-gestion-informacion.html",
    ],
    guideNumber: "5",
    guideTitle: "Guia 5 - Documentar la gestion de la informacion (Grado 10)",
    stateKey: "guia_interactiva_10a_guia5doc_html",
    // Bloque G (auditoria 2026-08-27): ver el mismo comentario en el registro
    // de Guia 8 mas arriba -- misma causa, mismo fix. Debe coincidir con
    // STORAGE_FILE_ALIASES en js/script_guia5_documentar_gestion.js.
    cloudFileNames: {
      "grupo-10a-guia-05-documentar-gestion-informacion.html": "10a_guia5doc.html",
      "grupo-10b-guia-05-documentar-gestion-informacion.html": "10b_guia5doc.html",
    },
    program: PROGRAM,
    competencia: COMP_CIBERSEG,
    resultado: RAP_DOCUMENTAR_GESTION,
    activities: [
      {
        id: "caso411", number: "4.1.1", label: "Analisis del caso Agropecuaria La Esperanza",
        shortName: "CasoAgropecuaria", type: "form",
        formFields: ["g5doc_411_datos", "g5doc_411_consecuencias", "g5doc_411_experiencia", "g5doc_411_documento"],
        buttonIds: { save: "btnGuardarCaso411", status: "statusCaso411" },
        wordExport: {
          contextBox:
            "Caso Agropecuaria La Esperanza (Chiquinquira): el tecnico anterior no dejo ningun documento y la empresa no puede resolver una falla de impresora ni el archivo de cartera.",
          sections: [
            { label: "1. Informacion que debio documentar el tecnico anterior (min. 5 datos)", storeKey: "g5doc_411_datos" },
            { label: "2. Consecuencias que sufre hoy la empresa (min. 3)", storeKey: "g5doc_411_consecuencias" },
            { label: "3. Experiencia propia de perdida de informacion o tiempo", storeKey: "g5doc_411_experiencia" },
            { label: "4. Documento que elaborarias primero y por que", storeKey: "g5doc_411_documento" },
          ],
        },
      },
      {
        id: "plenaria412", number: "4.1.2", label: "Socializacion en plenaria",
        shortName: "Plenaria", type: "form",
        formFields: ["g5doc_412_comunes", "g5doc_412_documento_urgente", "g5doc_412_reflexion"],
        buttonIds: { save: "btnGuardarPlenaria412", status: "statusPlenaria412" },
        wordExport: {
          contextBox: "Plenaria grupal sobre el caso Agropecuaria La Esperanza y los tipos documentales que surgieron en el tablero.",
          sections: [
            { label: "1. Puntos en comun y diferencias del grupo de 3", storeKey: "g5doc_412_comunes" },
            { label: "2. Documento mas urgente y que debe contener", storeKey: "g5doc_412_documento_urgente" },
            { label: "3. Que cambio en tu comprension del caso y preguntas pendientes", storeKey: "g5doc_412_reflexion" },
          ],
        },
      },
      {
        id: "bloqueAB421", number: "4.2.1", label: "Estudio de contenidos (Bloques A y B) - Tabla resumen",
        shortName: "BloqueAB", type: "both",
        formFields: ["g5doc_421_reparto", "g5doc_421_temas", "g5doc_421_documento", "g5doc_421_paraque", "g5doc_421_ejemplo", "g5doc_421_aporte", "g5doc_421_dudas"],
        buttonIds: { save: "btnGuardarBloqueAB421", status: "statusBloqueAB421" },
        wordExport: {
          contextBox:
            "Estudio en equipo de los 9 temas conceptuales de gestion documental (Bloques A y B). Entregable de equipo: tabla resumen PDF.",
          sections: [
            { label: "1. Reparto de temas del equipo", storeKey: "g5doc_421_reparto" },
            { label: "2. Temas que estudiaste", storeKey: "g5doc_421_temas" },
            { label: "3. Documento / Protocolo de tu fila", storeKey: "g5doc_421_documento" },
            { label: "4. Para que sirve", storeKey: "g5doc_421_paraque" },
            { label: "5. Ejemplo aplicado a una MiPyme de Boyaca", storeKey: "g5doc_421_ejemplo" },
            { label: "6. Aporte agregado despues de la plenaria de cierre", storeKey: "g5doc_421_aporte" },
            { label: "7. Dudas pendientes para el mapa conceptual", storeKey: "g5doc_421_dudas" },
          ],
        },
        driveTarget: {
          panelKey: "guia5doc-4-2-1",
          deadlineActivityId: "bloqueAB421",
          activityTitle: "Tabla resumen de los Bloques A y B (BloqueAB_RAP04_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive la tabla resumen en PDF construida por el equipo (3 columnas: Documento/Protocolo, Para que sirve, Ejemplo en una MiPyme).",
          note: "Nombre sugerido: BloqueAB_RAP04_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "mapa422", number: "4.2.2", label: "Mapa conceptual del sistema documental",
        shortName: "MapaConceptual", type: "both",
        formFields: ["g5doc_422_central", "g5doc_422_relacion", "g5doc_422_protocolo", "g5doc_422_aplicacion"],
        buttonIds: { save: "btnGuardarMapa422", status: "statusMapa422" },
        wordExport: {
          contextBox:
            "Mapa conceptual del sistema documental RAP 04: minimo 15 conceptos, relacion activo->ficha tecnica->hoja de vida->registros->informe->mejora, 5 tipos documentales, un protocolo de organizacion y una aplicacion en MiPyme. Evidencia de Conocimiento (IE-01).",
          sections: [
            { label: "1. Concepto central elegido", storeKey: "g5doc_422_central" },
            { label: "2. Relacion logica del mapa (activo -> ficha -> hoja de vida -> registros -> informe -> mejora)", storeKey: "g5doc_422_relacion" },
            { label: "3. Protocolo de organizacion explicado con un ejemplo", storeKey: "g5doc_422_protocolo" },
            { label: "4. Aplicacion concreta en una MiPyme regional", storeKey: "g5doc_422_aplicacion" },
          ],
        },
        driveTarget: {
          panelKey: "guia5doc-4-2-2",
          deadlineActivityId: "mapa422",
          activityTitle: "Mapa conceptual RAP 04 (MapaConceptual_RAP04_[Equipo]_v1.0.pdf)",
          description: "Sube a Drive el mapa conceptual exportado a PDF y la evidencia de la presentacion oral del equipo.",
          note: "Nombre sugerido: MapaConceptual_RAP04_[Equipo]_v1.0.pdf",
        },
      },
      {
        id: "portafolio431", number: "4.3.1", label: "Construccion del portafolio documental del equipo asignado",
        shortName: "Portafolio", type: "both",
        formFields: [
          "g5doc_431_ficha_tecnica", "g5doc_431_hoja_vida", "g5doc_431_inventario",
          "g5doc_431_backup", "g5doc_431_chequeo", "g5doc_431_procedimientos", "g5doc_431_conclusion",
        ],
        buttonIds: { save: "btnGuardarPortafolio431", status: "statusPortafolio431" },
        wordExport: {
          contextBox:
            "Portafolio documental de un equipo real del laboratorio: ficha tecnica, hoja de vida, inventario de software, registro de copias de seguridad, lista de chequeo de operatividad y registro de procedimientos. Evidencia de Desempeno (IE-02).",
          sections: [
            { label: "1. Ficha tecnica del equipo", storeKey: "g5doc_431_ficha_tecnica" },
            { label: "2. Hoja de vida del equipo", storeKey: "g5doc_431_hoja_vida" },
            { label: "3. Inventario de software", storeKey: "g5doc_431_inventario" },
            { label: "4. Registro de copias de seguridad", storeKey: "g5doc_431_backup" },
            { label: "5. Lista de chequeo de operatividad", storeKey: "g5doc_431_chequeo" },
            { label: "6. Registro de procedimientos", storeKey: "g5doc_431_procedimientos" },
            { label: "7. Conclusion tecnica (trabajo independiente, minimo 8 lineas)", storeKey: "g5doc_431_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia5doc-4-3-1",
          deadlineActivityId: "portafolio431",
          activityTitle: "Portafolio documental del equipo (6 documentos + capturas numeradas)",
          description: "Sube a Drive los 6 documentos del portafolio diligenciados y las capturas de soporte numeradas (01_FichaTecnica.png ... 06_Procedimientos.png).",
          note: "Carpeta sugerida: Portafolio_[TuNombre]_[Fecha]",
        },
      },
      {
        id: "organizacion432", number: "4.3.2", label: "Organizacion digital: carpetas, convencion de nombres y control de versiones",
        shortName: "OrganizacionDigital", type: "both",
        formFields: ["g5doc_432_estructura", "g5doc_432_convencion", "g5doc_432_versiones", "g5doc_432_protocolo"],
        buttonIds: { save: "btnGuardarOrganizacion432", status: "statusOrganizacion432" },
        wordExport: {
          contextBox:
            "Organizacion digital del portafolio de la Act. 4.3.1: estructura de carpetas por tipo documental, convencion de nombres, tabla de control de versiones y respaldo en la nube. Evidencia de Desempeno (IE-02).",
          sections: [
            { label: "1. Estructura de carpetas aplicada (7 carpetas por tipo documental)", storeKey: "g5doc_432_estructura" },
            { label: "2. Convencion de nombres aplicada (ejemplos correctos e incorrectos)", storeKey: "g5doc_432_convencion" },
            { label: "3. Tabla de control de versiones (cambio real v1.0 -> v1.1)", storeKey: "g5doc_432_versiones" },
            { label: "4. Protocolo de nombres y versiones (trabajo independiente, max. 1 pagina)", storeKey: "g5doc_432_protocolo" },
          ],
        },
        driveTarget: {
          panelKey: "guia5doc-4-3-2",
          deadlineActivityId: "organizacion432",
          activityTitle: "Organizacion digital (carpetas renombradas + arbol tree /f + respaldo en la nube)",
          description: "Sube a Drive la captura del arbol de carpetas (tree /f), la captura de la sincronizacion en la nube y el Protocolo_Nombres_[TuNombre]_v1.0.pdf.",
          note: "Nombre sugerido: Protocolo_Nombres_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "documento441", number: "4.4.1", label: "Documento Tecnico de Gestion de la Informacion + Sustentacion oral",
        shortName: "DocumentoTecnico", type: "both",
        formFields: [
          "g5doc_441_sec_a", "g5doc_441_sec_b", "g5doc_441_sec_c", "g5doc_441_sec_d",
          "g5doc_441_sec_e", "g5doc_441_sec_f", "g5doc_441_sec_g",
        ],
        buttonIds: { save: "btnGuardarDocumento441", status: "statusDocumento441" },
        wordExport: {
          contextBox:
            "Documento Tecnico de Gestion de la Informacion para Agropecuaria La Esperanza, integrando el portafolio (4.3.1) y el protocolo de organizacion (4.3.2). Producto + Sustentacion oral (IE-03). Indice borrador previo a la redaccion.",
          sections: [
            { label: "A. Introduccion y contexto", storeKey: "g5doc_441_sec_a" },
            { label: "B. Inventario de activos informaticos", storeKey: "g5doc_441_sec_b" },
            { label: "C. Fichas tecnicas y hoja de vida", storeKey: "g5doc_441_sec_c" },
            { label: "D. Registros de procedimientos y de copias de seguridad", storeKey: "g5doc_441_sec_d" },
            { label: "E. Protocolo de organizacion de la informacion", storeKey: "g5doc_441_sec_e" },
            { label: "F. Conclusiones y recomendaciones de mejora (minimo 3 con justificacion)", storeKey: "g5doc_441_sec_f" },
            { label: "G. Bibliografia (minimo 5 fuentes, APA o IEEE)", storeKey: "g5doc_441_sec_g" },
          ],
        },
        driveTarget: {
          panelKey: "guia5doc-4-4-1",
          deadlineActivityId: "documento441",
          activityTitle: "Documento Tecnico de Gestion de la Informacion (DocTecnico_GestionInfo_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive el Documento Tecnico en PDF (minimo 8 paginas, secciones A-G) y la presentacion para la sustentacion oral.",
          note: "Nombre sugerido: DocTecnico_GestionInfo_[TuNombre]_v1.0.pdf",
        },
      },
    ],
  });

  // ── Guia 6 (Mantener equipos - Kennedy grado 10) ───────────────────────────
  // Mismo proyecto/fichas que la Guia 5 (documentar gestion) y la Guia 4
  // (ciberseguridad): 3441939/3441942, CIAS Puerto Boyaca. Duracion propia:
  // 80 horas (60 directas + 20 independientes), competencia y RAP distintos.
  var COMP_MANTENER_EQUIPOS = "220501001 - Mantener equipos de computo segun procedimiento tecnico.";
  var RAP_PREPARAR_MANTENIMIENTO = "RAP 01 - Preparar el mantenimiento de los equipos de computo de acuerdo con procedimientos tecnicos y administrativos.";

  register({
    files: [
      "grupo-10a-guia-06-mantener-equipos.html",
      "grupo-10b-guia-06-mantener-equipos.html",
    ],
    guideNumber: "6",
    guideTitle: "Guia 6 - Preparar el mantenimiento de equipos de computo (Grado 10)",
    stateKey: "guia_interactiva_10a_guia6mant_html",
    // Alias corto de storage (ver STORAGE_FILE_ALIASES en
    // script_guia6_mantener_equipos.js): debe coincidir exactamente, o
    // "Habilitar actividades entregadas"/"Ver respuestas" en el panel admin
    // resuelven al documento equivocado (ver checklist "Adding a New Guide").
    cloudFileNames: {
      "grupo-10a-guia-06-mantener-equipos.html": "10a_guia6mant.html",
      "grupo-10b-guia-06-mantener-equipos.html": "10b_guia6mant.html",
    },
    program: PROGRAM,
    competencia: COMP_MANTENER_EQUIPOS,
    resultado: RAP_PREPARAR_MANTENIMIENTO,
    activities: [
      {
        id: "caso311", number: "3.1.1", label: "Detectives del mantenimiento: caso Ferreteria Puerto Real",
        shortName: "CasoPuertoReal", type: "form",
        formFields: ["g6mant_311_sintomas", "g6mant_311_causas", "g6mant_311_herramientas", "g6mant_311_precauciones", "g6mant_311_experiencia"],
        buttonIds: { save: "btnGuardarCaso311", status: "statusCaso311" },
        wordExport: {
          contextBox:
            "Caso Ferreteria y Miscelanea Puerto Real (Puerto Boyaca): 4 computadores sin mantenimiento programado. El de facturacion se calienta, el ventilador suena fuerte y a veces no reconoce el USB del lector de codigo de barras.",
          sections: [
            { label: "1. Sintomas del computador de facturacion (min. 3)", storeKey: "g6mant_311_sintomas" },
            { label: "2. Posibles causas tecnicas de cada sintoma", storeKey: "g6mant_311_causas" },
            { label: "3. Herramientas / EPP necesarios antes de abrir el equipo", storeKey: "g6mant_311_herramientas" },
            { label: "4. Precauciones para no perder informacion ni danar el equipo", storeKey: "g6mant_311_precauciones" },
            { label: "5. Experiencia propia con sintomas parecidos", storeKey: "g6mant_311_experiencia" },
          ],
        },
      },
      {
        id: "plenaria312", number: "3.1.2", label: "Socializacion en plenaria",
        shortName: "Plenaria", type: "form",
        formFields: ["g6mant_312_sintoma_grupo", "g6mant_312_reflexion"],
        buttonIds: { save: "btnGuardarPlenaria312", status: "statusPlenaria312" },
        wordExport: {
          contextBox: "Plenaria grupal sobre el caso Ferreteria Puerto Real: sintomas y causas agrupados en el tablero por tipo (mecanicas, electricas, de software, de falta de limpieza).",
          sections: [
            { label: "1. Sintoma mas preocupante compartido con el grupo y causa mas probable", storeKey: "g6mant_312_sintoma_grupo" },
            { label: "2. Idea final: relacion entre mantenimiento preventivo y correctivo urgente", storeKey: "g6mant_312_reflexion" },
          ],
        },
      },
      {
        id: "bloqueAB321", number: "3.2.1", label: "Estudio de contenidos de mantenimiento (Bloques A y B) - Tabla resumen",
        shortName: "BloqueAB", type: "both",
        formFields: ["g6mant_321_reparto", "g6mant_321_temas", "g6mant_321_tema_fila", "g6mant_321_paraque", "g6mant_321_ejemplo"],
        buttonIds: { save: "btnGuardarBloqueAB321", status: "statusBloqueAB321" },
        wordExport: {
          contextBox:
            "Estudio en equipo de los 7 temas conceptuales de mantenimiento de equipos (Bloques A y B: tipos/diagnostico de mantenimiento; materiales, herramientas y proteccion personal). Entregable de equipo: tabla resumen PDF.",
          sections: [
            { label: "1. Reparto de temas del equipo", storeKey: "g6mant_321_reparto" },
            { label: "2. Temas que estudiaste", storeKey: "g6mant_321_temas" },
            { label: "3. Tema de tu fila en la tabla resumen", storeKey: "g6mant_321_tema_fila" },
            { label: "4. Para que sirve", storeKey: "g6mant_321_paraque" },
            { label: "5. Ejemplo aplicado en la Ferreteria Puerto Real", storeKey: "g6mant_321_ejemplo" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-2-1",
          deadlineActivityId: "bloqueAB321",
          activityTitle: "Tabla resumen de los Bloques A y B (BloqueAB_RAP01_[TuNombre]_v1.0.pdf)",
          description: "Sube a Drive la tabla resumen en PDF construida por el equipo (3 columnas: Tema, Para que sirve, Ejemplo aplicado en la Ferreteria Puerto Real).",
          note: "Nombre sugerido: BloqueAB_RAP01_[TuNombre]_v1.0.pdf",
        },
      },
      {
        id: "inspeccion322", number: "3.2.2", label: "Ejercicio de inspeccion externa de equipos de computo",
        shortName: "InspeccionExterna", type: "both",
        formFields: ["g6mant_322_hallazgos", "g6mant_322_conclusion", "g6mant_322_disp_entrada", "g6mant_322_disp_salida", "g6mant_322_disp_almacenamiento"],
        buttonIds: { save: "btnGuardarInspeccion322", status: "statusInspeccion322" },
        wordExport: {
          contextBox:
            "Inspeccion puramente externa de un equipo real del taller: estado fisico, puertos, cables, ventilacion, ruidos y temperatura. Se diligencia el formato de inspeccion externa suministrado por el instructor.",
          sections: [
            { label: "1. Hallazgos de la inspeccion externa", storeKey: "g6mant_322_hallazgos" },
            { label: "2. Conclusiones (preventivo/correctivo/ambos, justificado)", storeKey: "g6mant_322_conclusion" },
            { label: "3. Dispositivo(s) de entrada identificados", storeKey: "g6mant_322_disp_entrada" },
            { label: "4. Dispositivo(s) de salida identificados", storeKey: "g6mant_322_disp_salida" },
            { label: "5. Dispositivo(s) de almacenamiento identificados", storeKey: "g6mant_322_disp_almacenamiento" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-2-2",
          deadlineActivityId: "inspeccion322",
          activityTitle: "Informe de inspeccion externa + tabla de dispositivos",
          description: "Sube a Drive el formato de inspeccion externa diligenciado, el informe corto de conclusiones y la tabla de dispositivos de entrada/salida/almacenamiento.",
          note: "Formato de entrega: PDF o DOCX.",
        },
      },
      {
        id: "analisis331", number: "3.3.1", label: "Consulta y analisis guiado de fallas comunes",
        shortName: "AnalisisFallas", type: "both",
        formFields: ["g6mant_331_bloqueC", "g6mant_331_reporte1", "g6mant_331_reporte2", "g6mant_331_recomendacion"],
        buttonIds: { save: "btnGuardarAnalisis331", status: "statusAnalisis331" },
        wordExport: {
          contextBox:
            "Bloque C (diagnostico avanzado) aplicado a dos nuevos reportes del caso Ferreteria Puerto Real: equipo de facturacion se reinicia solo con el software contable; equipo de bodega no reconoce la impresora de codigo de barras.",
          sections: [
            { label: "1. Estudio del Bloque C (fallas fisicas/logicas, sintoma-causa, priorizacion)", storeKey: "g6mant_331_bloqueC" },
            { label: "2. Reporte 1: tipo de mantenimiento, causas y urgencia", storeKey: "g6mant_331_reporte1" },
            { label: "3. Reporte 2: tipo de mantenimiento, causas y urgencia", storeKey: "g6mant_331_reporte2" },
            { label: "4. Recomendacion tecnica redactada para el propietario", storeKey: "g6mant_331_recomendacion" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-3-1",
          deadlineActivityId: "analisis331",
          activityTitle: "Documento de analisis tecnico (diagnostico, causas, urgencia, recomendacion)",
          description: "Sube a Drive el documento de analisis tecnico de los dos reportes del caso.",
          note: "Formato: DOCX o PDF.",
        },
      },
      {
        id: "diagnostico332", number: "3.3.2", label: "Diagnostico tecnico y diligenciamiento de hoja de vida del equipo",
        shortName: "DiagnosticoHV", type: "both",
        formFields: ["g6mant_332_diagnostico", "g6mant_332_hv_identificacion", "g6mant_332_hv_especificaciones", "g6mant_332_hv_recomendacion"],
        buttonIds: { save: "btnGuardarDiagnostico332", status: "statusDiagnostico332" },
        wordExport: {
          contextBox:
            "Diagnostico tecnico completo de un equipo distinto al de la Actividad 3.2.2 y diligenciamiento de su hoja de vida (identificacion, especificaciones, historial, diagnostico, recomendacion).",
          sections: [
            { label: "1. Diagnostico tecnico completo", storeKey: "g6mant_332_diagnostico" },
            { label: "2. Hoja de vida - identificacion del equipo", storeKey: "g6mant_332_hv_identificacion" },
            { label: "3. Hoja de vida - especificaciones e historial", storeKey: "g6mant_332_hv_especificaciones" },
            { label: "4. Recomendacion de mantenimiento en la hoja de vida", storeKey: "g6mant_332_hv_recomendacion" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-3-2",
          deadlineActivityId: "diagnostico332",
          activityTitle: "Hoja de vida del equipo diligenciada",
          description: "Sube a Drive la hoja de vida del equipo diligenciada en su totalidad, firmada por el equipo de trabajo.",
          note: "Formato: el suministrado por el instructor, en PDF.",
        },
      },
      {
        id: "hwmonitor341", number: "3.4.1", label: "Laboratorio de monitoreo tecnico con HWMonitor",
        shortName: "LabHWMonitor", type: "both",
        formFields: ["g6mant_341_registros", "g6mant_341_comparativa", "g6mant_341_conclusion"],
        buttonIds: { save: "btnGuardarHwmonitor341", status: "statusHwmonitor341" },
        wordExport: {
          contextBox:
            "Monitoreo de temperatura y velocidad de ventiladores con HWMonitor durante 3 dias (encendido, 30 min uso normal, 30 min uso exigente), consolidado en tabla comparativa de equipo con conclusiones.",
          sections: [
            { label: "1. Registros individuales de los 3 dias", storeKey: "g6mant_341_registros" },
            { label: "2. Tabla comparativa consolidada del equipo", storeKey: "g6mant_341_comparativa" },
            { label: "3. Conclusiones y recomendaciones de mantenimiento preventivo", storeKey: "g6mant_341_conclusion" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-4-1",
          deadlineActivityId: "hwmonitor341",
          activityTitle: "Tabla de registros (3 dias) + tabla comparativa consolidada",
          description: "Sube a Drive la tabla de registros individuales de 3 dias y la tabla comparativa consolidada del equipo con conclusiones.",
          note: "Formato: hoja de calculo (XLSX) exportada a PDF.",
        },
      },
      {
        id: "planMantenimiento342", number: "3.4.2", label: "Plan de Mantenimiento Preventivo y sustentacion",
        shortName: "PlanMantenimiento", type: "both",
        formFields: ["g6mant_342_cronograma", "g6mant_342_actividades", "g6mant_342_materiales", "g6mant_342_epp", "g6mant_342_responsables"],
        buttonIds: { save: "btnGuardarPlanMantenimiento342", status: "statusPlanMantenimiento342" },
        wordExport: {
          contextBox:
            "Plan de Mantenimiento Preventivo para los 4 equipos de la Ferreteria Puerto Real: cronograma anual, actividades por visita, materiales/herramientas, EPP y responsables. Anexa las hojas de vida de la Actividad 3.3.2. Sustentacion oral de maximo 10 minutos por equipo.",
          sections: [
            { label: "1. Cronograma anual de intervenciones (4 equipos)", storeKey: "g6mant_342_cronograma" },
            { label: "2. Actividades a realizar en cada visita", storeKey: "g6mant_342_actividades" },
            { label: "3. Materiales y herramientas necesarias", storeKey: "g6mant_342_materiales" },
            { label: "4. Elementos de proteccion personal (EPP) requeridos", storeKey: "g6mant_342_epp" },
            { label: "5. Responsable de cada actividad del plan", storeKey: "g6mant_342_responsables" },
          ],
        },
        driveTarget: {
          panelKey: "guia6mant-3-4-2",
          deadlineActivityId: "planMantenimiento342",
          activityTitle: "Plan de Mantenimiento Preventivo (con hojas de vida como anexos)",
          description: "Sube a Drive el Plan de Mantenimiento Preventivo completo, incluyendo las hojas de vida de la Actividad 3.3.2 como anexos.",
          note: "Formato: DOCX o PDF.",
        },
      },
    ],
  });

  // ── Guia 2 (Redes - Santa Barbara) (10A + 10B) ─────────────────────────────
  register({
    files: [
      "santa-barbara-10a-guia-02-redes-rap01.html",
      "santa-barbara-10b-guia-02-redes-rap01.html",
    ],
    guideNumber: "2",
    guideTitle: "Guia 2 - Definir parametros y recursos de la red (RAP 01)",
    stateKey: "guia_interactiva_santa_barbara_10a_guia_02_redes_rap01_html",
    program: PROGRAM,
    competencia: "220501121 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
    resultado: RAP_REDES,
    activities: [
      { id: "reflexion311",     number: "3.1.1", label: "Reflexion individual",     shortName: "Reflexion",     type: "form" },
      // El applier a medida de reflexion311 (ver script_guia_redes.js) bloquea
      // esta actividad bajo la llave "reflexion-socializacion-locked", NO bajo
      // "socializacion311-locked" (la convencion generica {id}-locked). Sin
      // legacyLockKeys, el panel "Tus actividades de esta guia" (activity_standard.js)
      // la mostraba "Pendiente" para siempre aunque el contenido ya estuviera
      // guardado y bloqueado. Detectado 2026-07-23.
      { id: "socializacion311", number: "3.1.1", label: "Socializacion",            shortName: "Socializacion", type: "form", legacyLockKeys: ["reflexion-socializacion-locked"] },
      // "Exploracion Visual por Bloques Tematicos" (Actividad 3.2.1 en el export
      // Word): 5 bloques independientes, cada uno con su propio boton Guardar/
      // lock (guardarBloqueA..E en script_guia_redes.js). Numeracion 3.2.1.1..5
      // para no chocar con el "3.2.1" ya usado (de forma inconsistente) por ip1.
      { id: "bloqueA", number: "3.2.1.1", label: "Bloque A - Tipos de redes: LAN, MAN y WAN", shortName: "BloqueA", type: "form" },
      { id: "bloqueB", number: "3.2.1.2", label: "Bloque B - Topologias de red",              shortName: "BloqueB", type: "form" },
      { id: "bloqueC", number: "3.2.1.3", label: "Bloque C - Medios de transmision",          shortName: "BloqueC", type: "form" },
      { id: "bloqueD", number: "3.2.1.4", label: "Bloque D - Dispositivos de interconexion",  shortName: "BloqueD", type: "form" },
      { id: "bloqueE", number: "3.2.1.5", label: "Bloque E - Modelo OSI y TCP/IP",            shortName: "BloqueE", type: "form" },
      // Entrega de solo archivo (mapa mental en PNG/PDF, sin campos de texto).
      // Antes era un boton de sharedAppsScriptDelivery.openDeliveryModal suelto
      // (sin panelKey) sin ningun rastro en el catalogo ni en el state: no se
      // podia calificar ni mostraba confirmacion de entrega. Se agrego panelKey
      // "mapaMental322" al boton + candado/confirmacion propios en
      // script_guia_redes.js (applyMapaMental322Lock). Agregado 2026-07-23.
      { id: "mapaMental322", number: "3.2.2", label: "Mapa mental integrador de fundamentos de redes", shortName: "MapaMental", type: "file" },
      // Quiz autocalificado (numero real "3.2.1.H", no numerico -> se usa
      // "3.2.1.6" para el conteo de entregables). Al aprobar sin intento real
      // se copia un intento completo desde el banco (ver activity_grades.js).
      { id: "quiz-redes-321h", number: "3.2.1.6", label: "Quiz individual de fundamentos de redes", shortName: "QuizFundamentos", type: "form" },
      // Numeros reales confirmados por el propio HTML (activity-num badges),
      // js/redes_quiz_bank.js (topic:"3.3.1/2/3") y los exports Word con
      // activityNumber propio (script_guia_redes.js): ip1=3.3.1, ip2=3.3.2,
      // ip3=3.3.3. Las etiquetas anteriores (3.2.1/3.2.2/3.2.3) eran
      // incorrectas (no visibles para el aprendiz, pero rompian el conteo de
      // "Tus actividades de esta guia" al no coincidir con nada real, y mi
      // primer intento de agregar ip2 con "3.2.2" chocaba ademas con el
      // numero real de "Mapa mental integrador de fundamentos de redes",
      // que no esta en este catalogo). Taller IP - Ejercicios 1-5 son 5
      // columnas calificables por separado (igual que bloqueA-E) pero
      // comparten el numero real "3.3.4" (un solo badge en el HTML para
      // los 5 ejercicios) -- se subnumeran 3.3.4.1..5, mismo patron que
      // 3.2.1.1..5 para bloqueA-E. Corregido 2026-07-23.
      { id: "ip1",              number: "3.3.1", label: "Bloque IP 1",              shortName: "BloqueIP1",     type: "form" },
      { id: "ip2",              number: "3.3.2", label: "Bloque IP 2 - Clases de IP", shortName: "BloqueIP2",   type: "form" },
      { id: "ip3",              number: "3.3.3", label: "Bloque IP 3",              shortName: "BloqueIP3",     type: "form" },
      { id: "taller-ip-ej1",    number: "3.3.4.1", label: "Taller IP - Ejercicio 1",  shortName: "TallerIP1",     type: "form" },
      { id: "taller-ip-ej2",    number: "3.3.4.2", label: "Taller IP - Ejercicio 2",  shortName: "TallerIP2",     type: "form" },
      { id: "taller-ip-ej3",    number: "3.3.4.3", label: "Taller IP - Ejercicio 3",  shortName: "TallerIP3",     type: "form" },
      { id: "taller-ip-ej4",    number: "3.3.4.4", label: "Taller IP - Ejercicio 4",  shortName: "TallerIP4",     type: "form" },
      { id: "taller-ip-ej5",    number: "3.3.4.5", label: "Taller IP - Ejercicio 5",  shortName: "TallerIP5",     type: "form" },
      // Quiz autocalificado (numero real "3.3.H", no numerico -> se usa "3.3.9").
      { id: "quiz-redes-33h",   number: "3.3.9", label: "Quiz individual de parametros de red", shortName: "QuizIP", type: "form" },
      { id: "lab1",             number: "3.4.1", label: "Laboratorio 1 - Topologia estrella", shortName: "LabEstrella", type: "file" },
      { id: "lab2",             number: "3.4.2", label: "Laboratorio 2 - Topologia arbol",    shortName: "LabArbol",    type: "file" },
      { id: "lab3",             number: "3.4.3", label: "Laboratorio 3 - Red hibrida",        shortName: "LabHibrida",  type: "file" },
      { id: "social",           number: "3.5.1", label: "Socializacion final",                shortName: "SocialFinal", type: "form" },
    ],
  });

  // ── Guia 3 (Redes RAP02 - Comprobar conectividad - Santa Barbara) (10A + 10B) ──
  var RAP_REDES_02 = "RAP 02 - Comprobar la conectividad de la red, de acuerdo con normativa de telecomunicaciones y orden de trabajo.";
  register({
    files: [
      "santa-barbara-10a-guia-03-redes-rap02.html",
      "santa-barbara-10b-guia-03-redes-rap02.html",
    ],
    guideNumber: "3",
    guideTitle: "Guia 3 - Comprobar la conectividad de la red (RAP 02)",
    stateKey: "guia_interactiva_santa_barbara_10a_guia_03_redes_rap02_html",
    program: PROGRAM,
    competencia: "220501121 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
    resultado: RAP_REDES_02,
    activities: [
      {
        id: "reflexion311", number: "3.1.1", label: "Reflexion inicial - Caso Ferreteria Don Misael",
        shortName: "Reflexion", type: "both",
        formFields: ["g3r_311_p1", "g3r_311_p2", "g3r_311_p3", "g3r_311_p4", "g3r_311_p5"],
        buttonIds: { save: "btnGuardarReflexion311", status: "statusReflexion311" },
        allowedExtensions: [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"],
        driveTarget: {
          panelKey: "guia3-reflexion311",
          deadlineActivityId: "reflexion311",
          activityTitle: "Reflexion inicial - Caso Ferreteria Don Misael",
          description: "Entrega tu reflexion individual escrita exportada a Word o en PDF.",
          note: "Entrega sugerida: exporta a Word y convierte a PDF antes de subir.",
        },
        wordExport: {
          contextBox: "Caso Ferreteria Don Misael (Sogamoso): 5 PC en red, impresora compartida, camara IP y punto de venta. Fallas multiples de conectividad antes de visitar el local.",
          sections: [
            { label: "1. Por que el PC de caja no imprime si la LAN funciona", storeKey: "g3r_311_p1" },
            { label: "2. Diferencia entre 'no tener internet' y 'no estar en la red'", storeKey: "g3r_311_p2" },
            { label: "3. Por que la camara IP puede desaparecer aunque el cable siga conectado", storeKey: "g3r_311_p3" },
            { label: "4. Que revisaria primero (router, cables o PCs) y por que ese orden", storeKey: "g3r_311_p4" },
            { label: "5. Comandos de Windows que conoce para diagnosticar", storeKey: "g3r_311_p5" },
          ],
        },
      },
      {
        id: "bloqueA321", number: "3.2.1", label: "Bloque A - Router, Switch y Access Point",
        shortName: "BloqueA", type: "form",
        formFields: ["g3r_321_q1", "g3r_321_q2", "g3r_321_q3"],
        buttonIds: { save: "btnGuardarBloqueA321", status: "statusBloqueA321" },
        wordExport: {
          contextBox: "Bloque A: dispositivos activos (router, switch, access point) en la Ferreteria Don Misael.",
          sections: [
            { label: "1. Que dispositivo conecta los 5 PC y cual da salida a internet", storeKey: "g3r_321_q1" },
            { label: "2. Por que el router tiene dos interfaces IP (LAN y WAN)", storeKey: "g3r_321_q2" },
            { label: "3. Diferencia entre puerto LAN y puerto WAN", storeKey: "g3r_321_q3" },
          ],
        },
      },
      {
        id: "bloqueB322", number: "3.2.2", label: "Bloque B - Protocolo TCP/IP y modelo de capas",
        shortName: "BloqueB", type: "form",
        formFields: ["g3r_322_q1", "g3r_322_q2", "g3r_322_q3"],
        buttonIds: { save: "btnGuardarBloqueB322", status: "statusBloqueB322" },
        wordExport: {
          contextBox: "Bloque B: modelo TCP/IP de 4 capas y sus protocolos.",
          sections: [
            { label: "1. Que hace la capa de Red y que protocolo opera en ella", storeKey: "g3r_322_q1" },
            { label: "2. Capa de Transporte: diferencia entre TCP y UDP", storeKey: "g3r_322_q2" },
            { label: "3. En que capa opera ICMP cuando un PC hace ping", storeKey: "g3r_322_q3" },
          ],
        },
      },
      {
        id: "bloqueC323", number: "3.2.3", label: "Bloque C - Servicios DHCP, DNS y Firewall",
        shortName: "BloqueC", type: "form",
        formFields: ["g3r_323_q1", "g3r_323_q2", "g3r_323_q3"],
        buttonIds: { save: "btnGuardarBloqueC323", status: "statusBloqueC323" },
        wordExport: {
          contextBox: "Bloque C: servicios de red DHCP, DNS y Firewall y su impacto en la conectividad.",
          sections: [
            { label: "1. Que servicio asigna IPs automaticamente y que pasa si falla", storeKey: "g3r_323_q1" },
            { label: "2. Por que dos PC de la misma red, uno sin internet (relacion con DHCP)", storeKey: "g3r_323_q2" },
            { label: "3. Que tiene que ver el DNS con una pagina que no carga", storeKey: "g3r_323_q3" },
          ],
        },
      },
      {
        id: "bloqueD324", number: "3.2.4", label: "Bloque D - IP publica vs privada y NAT",
        shortName: "BloqueD", type: "form",
        formFields: ["g3r_324_q1", "g3r_324_q2", "g3r_324_q3"],
        buttonIds: { save: "btnGuardarBloqueD324", status: "statusBloqueD324" },
        wordExport: {
          contextBox: "Bloque D: IP publica vs privada y NAT en una MiPyme.",
          sections: [
            { label: "1. Por que 5 PC con IP privada salen con una sola IP publica", storeKey: "g3r_324_q1" },
            { label: "2. Que es NAT y cual dispositivo lo realiza", storeKey: "g3r_324_q2" },
            { label: "3. Ping a 8.8.8.8 funciona pero no abre google.com: que servicio fallo", storeKey: "g3r_324_q3" },
          ],
        },
      },
      {
        // Exportación consolidada de los 4 bloques A-D — solo Word, sin save ni Drive
        id: "exportBloques321a324", number: "3.2.x", label: "Exportar bloques A-D a Word",
        shortName: "BloquesFinal", type: "form",
        formFields: [],
        buttonIds: { save: "_btnExportConsolidado_noexiste", status: "_statusExportConsolidado_noexiste" },
        wordExport: {
          contextBox: "Contextualización — Ferretería Don Misael (Sogamoso): 5 PC en red, impresora compartida, cámara IP y punto de venta. Análisis de dispositivos, protocolos TCP/IP, servicios de red e IPs públicas/privadas.",
          sections: [
            { label: "BLOQUE A — Router, Switch y Access Point", storeKey: "" },
            { label: "A1. Dispositivo que conecta los 5 PC y cuál da salida a internet", storeKey: "g3r_321_q1" },
            { label: "A2. Por qué el router tiene dos interfaces IP (LAN y WAN)", storeKey: "g3r_321_q2" },
            { label: "A3. Diferencia entre puerto LAN y puerto WAN", storeKey: "g3r_321_q3" },
            { label: "BLOQUE B — Protocolo TCP/IP y modelo de capas", storeKey: "" },
            { label: "B1. Qué hace la capa de Red y qué protocolo opera en ella", storeKey: "g3r_322_q1" },
            { label: "B2. Capa de Transporte: diferencia entre TCP y UDP", storeKey: "g3r_322_q2" },
            { label: "B3. En qué capa opera ICMP cuando un PC hace ping", storeKey: "g3r_322_q3" },
            { label: "BLOQUE C — Servicios DHCP, DNS y Firewall", storeKey: "" },
            { label: "C1. Qué servicio asigna IPs automáticamente y qué pasa si falla", storeKey: "g3r_323_q1" },
            { label: "C2. Por qué dos PC de la misma red, uno sin internet (relación con DHCP)", storeKey: "g3r_323_q2" },
            { label: "C3. Qué tiene que ver el DNS con una página que no carga", storeKey: "g3r_323_q3" },
            { label: "BLOQUE D — IP pública vs privada y NAT", storeKey: "" },
            { label: "D1. Por qué 5 PC con IP privada salen con una sola IP pública", storeKey: "g3r_324_q1" },
            { label: "D2. Qué es NAT y cuál dispositivo lo realiza", storeKey: "g3r_324_q2" },
            { label: "D3. Ping a 8.8.8.8 funciona pero no abre google.com: qué servicio falló", storeKey: "g3r_324_q3" },
          ],
        },
      },
      {
        id: "entregaContexto325", number: "3.2.5", label: "Entrega - Productos de contextualizacion (PDF)",
        shortName: "Contextualizacion", type: "file",
        driveTarget: {
          panelKey: "g3redes-3-2-5", deadlineActivityId: "entregaContexto325",
          activityTitle: "Contextualizacion de conectividad (PDF con los 4 productos)",
          description: "Sube a Drive un solo PDF con los 4 productos: diagrama de red, tabla TCP/IP, analisis DHCP/DNS/Firewall y esquema NAT.",
          note: "Nombre sugerido: Contextualizacion_Conectividad_NombreAprendiz_FICHA.pdf",
        },
      },
      {
        id: "comandos331", number: "3.3.1", label: "Comandos de diagnostico CLI",
        shortName: "ComandosCLI", type: "form",
        formFields: ["g3r_331_ipconfig", "g3r_331_ping_local", "g3r_331_ping_gw", "g3r_331_ping_8888", "g3r_331_ping_google", "g3r_331_tracert", "g3r_331_nslookup", "g3r_331_netstat"],
        buttonIds: { save: "btnGuardarComandos331", status: "statusComandos331" },
        wordExport: {
          contextBox: "Registro de resultados de los comandos de diagnostico ejecutados en CMD (Windows + R -> cmd).",
          sections: [
            { label: "ipconfig /all (IP/DHCP, gateway, DNS)", storeKey: "g3r_331_ipconfig" },
            { label: "ping 127.0.0.1 (tarjeta de red propia)", storeKey: "g3r_331_ping_local" },
            { label: "ping [gateway] (comunicacion con el router)", storeKey: "g3r_331_ping_gw" },
            { label: "ping 8.8.8.8 (internet por IP)", storeKey: "g3r_331_ping_8888" },
            { label: "ping google.com (internet + DNS)", storeKey: "g3r_331_ping_google" },
            { label: "tracert 8.8.8.8 (saltos hasta el destino)", storeKey: "g3r_331_tracert" },
            { label: "nslookup google.com (resolucion DNS)", storeKey: "g3r_331_nslookup" },
            { label: "netstat -n (conexiones activas)", storeKey: "g3r_331_netstat" },
          ],
        },
      },
      {
        id: "presentacion332", number: "3.3.2", label: "Presentacion tecnica de averias (5 escenarios)",
        shortName: "PresentacionAverias", type: "file",
        driveTarget: {
          panelKey: "g3redes-3-3-2", deadlineActivityId: "presentacion332",
          activityTitle: "Presentacion de averias (minimo 15 diapositivas)",
          description: "Sube a Drive la presentacion (PowerPoint, Canva o Google Slides, minimo 15 diapositivas) con los 5 escenarios de falla y el procedimiento de resolucion.",
          note: "Nombre sugerido: PresentacionAverias_NombreAprendiz_FICHA",
        },
      },
      {
        id: "laboratorio341", number: "3.4.1", label: "Laboratorio Packet Tracer - Red de 2 plantas + 10 pruebas",
        shortName: "LabConectividad", type: "file",
        driveTarget: {
          panelKey: "g3redes-3-4-1", deadlineActivityId: "laboratorio341",
          activityTitle: "Laboratorio de conectividad (.pkt + PDF con 10 pruebas)",
          description: "Sube a Drive el archivo .pkt y el PDF con las 10 capturas de las pruebas de conectividad, organizadas y comentadas.",
          note: "Nombre sugerido: Lab_Conectividad_NombreAprendiz_FICHA.pkt",
          allowedExtensions: [".pkt", ".pdf", ".zip"],
        },
      },
      {
        id: "caso342", number: "3.4.2",
        label: "Laboratorio integral - Red con DHCP, DNS, AP y NAT (Packet Tracer)",
        shortName: "LabIntegral", type: "file",
        driveTarget: {
          panelKey: "g3redes-3-4-2", deadlineActivityId: "caso342",
          activityTitle: "Laboratorio integral - Red con DHCP, DNS, AP y NAT",
          description: "Sube a Drive el archivo .pkt y el PDF con las 10 capturas de las pruebas comentadas.",
          note: "Nombre sugerido: LabIntegral_NombreAprendiz_FICHA.pkt + PDF",
          allowedExtensions: [".pkt", ".pdf", ".zip"],
        },
      },
      // Quiz autocalificado de cierre, sin numero propio en la guia (seccion
      // aparte al final, "Quiz de conectividad"). Mismo hueco que los demas
      // quiz del portal: nunca estuvo en el catalogo. Detectado 2026-07-23.
      { id: "quiz-redes-321h-rap02", number: "3.5.1", label: "Quiz de conectividad", shortName: "QuizConectividad", type: "form" },
    ],
  });

  // ── Guia 4 (Redes RAP03 - Documentar acciones red - Santa Barbara) (10A + 10B) ──
  register({
    files: [
      "santa-barbara-10a-guia-04-redes-rap03.html",
      "santa-barbara-10b-guia-04-redes-rap03.html",
    ],
    guideNumber: "4",
    guideTitle: "Guia 4 - Documentar las acciones realizadas en la red (RAP 03)",
    stateKey: "guia_interactiva_santa_barbara_10a_guia_04_redes_rap03_html",
    program: PROGRAM,
    competencia: "280102129 - Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa tecnica.",
    resultado: "RAP 03 - Documentar las acciones realizadas en la red de acuerdo con la normativa.",
    activities: [
      {
        id: "reflexion311", number: "3.1.1", label: "Reflexion inicial - Caso consultorio medico Tunja",
        shortName: "Reflexion", type: "form",
        formFields: ["g5r_311_p1", "g5r_311_p2", "g5r_311_p3", "g5r_311_p4", "g5r_311_p5"],
        buttonIds: { save: "btnGuardarReflexion311", status: "statusReflexion311" },
        wordExport: {
          contextBox: "Caso: el tecnico Juan instalo la red de un consultorio medico en Tunja (8 PC, 2 switches, 1 router, impresora de red) sin dejar documentacion. Tres meses despues, el nuevo tecnico no pudo resolver una falla sencilla por falta de registros.",
          sections: [
            { label: "1. Documentos que deberia haber dejado Juan (minimo 4)", storeKey: "g5r_311_p1" },
            { label: "2. Informacion especifica a registrar de cada dispositivo", storeKey: "g5r_311_p2" },
            { label: "3. Experiencia propia con falta de documentacion", storeKey: "g5r_311_p3" },
            { label: "4. Diferencia entre un tecnico que documenta y uno que no, desde el cliente", storeKey: "g5r_311_p4" },
            { label: "5. Formato o plantilla de documentacion tecnica conocido", storeKey: "g5r_311_p5" },
          ],
        },
      },
      {
        id: "bloqueA321", number: "3.2.1", label: "Bloque A - Estandares de documentacion: TIA-568, TIA-606 e ISO/IEC 11801",
        shortName: "BloqueA", type: "form",
        formFields: ["g5r_321_q1", "g5r_321_q2", "g5r_321_q3"],
        buttonIds: { save: "btnGuardarBloqueA321", status: "statusBloqueA321" },
        wordExport: {
          contextBox: "Bloque A: estandares TIA-568, TIA-606 e ISO/IEC 11801 que regulan la documentacion de redes.",
          sections: [
            { label: "1. Que establece la norma TIA-568 sobre el cableado estructurado", storeKey: "g5r_321_q1" },
            { label: "2. Que es la norma TIA-606 y para que sirve en la documentacion", storeKey: "g5r_321_q2" },
            { label: "3. Elementos minimos a documentar segun estos estandares", storeKey: "g5r_321_q3" },
          ],
        },
      },
      {
        id: "bloqueB322", number: "3.2.2", label: "Bloque B - Herramientas de verificacion y certificacion de cableado",
        shortName: "BloqueB", type: "form",
        formFields: ["g5r_322_q1", "g5r_322_q2", "g5r_322_q3"],
        buttonIds: { save: "btnGuardarBloqueB322", status: "statusBloqueB322" },
        wordExport: {
          contextBox: "Bloque B: tester de cable vs. certificador de cableado (p. ej. Fluke DTX-1800).",
          sections: [
            { label: "1. Diferencia entre tester de cable y certificador de cableado", storeKey: "g5r_322_q1" },
            { label: "2. Parametros que mide un certificador y no un tester simple", storeKey: "g5r_322_q2" },
            { label: "3. Resultado que genera el certificador y como se documenta", storeKey: "g5r_322_q3" },
          ],
        },
      },
      {
        id: "bloqueC323", number: "3.2.3", label: "Bloque C - Parametros de certificacion de cableado",
        shortName: "BloqueC", type: "form",
        formFields: ["g5r_323_q1", "g5r_323_q2", "g5r_323_q3"],
        buttonIds: { save: "btnGuardarBloqueC323", status: "statusBloqueC323" },
        wordExport: {
          contextBox: "Bloque C: parametros de certificacion (atenuacion, NEXT, BER, longitud de cable).",
          sections: [
            { label: "1. Que es la atenuacion (perdida de insercion) y como afecta la red", storeKey: "g5r_323_q1" },
            { label: "2. Que significa un test BER aprobado y su implicacion documental", storeKey: "g5r_323_q2" },
            { label: "3. Por que registrar la longitud del cable en el informe tecnico", storeKey: "g5r_323_q3" },
          ],
        },
      },
      {
        id: "bloqueD324", number: "3.2.4", label: "Bloque D - Estructura de un informe tecnico de red",
        shortName: "BloqueD", type: "form",
        formFields: ["g5r_324_q1", "g5r_324_q2", "g5r_324_q3"],
        buttonIds: { save: "btnGuardarBloqueD324", status: "statusBloqueD324" },
        wordExport: {
          contextBox: "Bloque D: estructura de un informe tecnico de red segun norma ICONTEC NTC 1486.",
          sections: [
            { label: "1. Diferencia entre informe tecnico e informe ejecutivo", storeKey: "g5r_324_q1" },
            { label: "2. Secciones obligatorias de un informe tecnico de instalacion de red", storeKey: "g5r_324_q2" },
            { label: "3. Evidencias graficas que debe incluir un informe tecnico de red", storeKey: "g5r_324_q3" },
          ],
        },
      },
      {
        // Exportacion consolidada de los 4 bloques A-D — solo Word, sin save ni Drive.
        // Mismo truco que exportBloques321a324 en la Guia 3 (script_guia_redes_rap02).
        id: "exportBloques321a324", number: "3.2.x", label: "Exportar bloques A-D a Word",
        shortName: "BloquesFinal", type: "form",
        formFields: [],
        buttonIds: { save: "_btnExportConsolidado_noexiste", status: "_statusExportConsolidado_noexiste" },
        wordExport: {
          contextBox: "Contextualizacion — estandares TIA-568/606/ISO 11801, herramientas de verificacion y certificacion, parametros de certificacion y estructura de un informe tecnico de red.",
          sections: [
            { label: "BLOQUE A — Estandares de documentacion: TIA-568, TIA-606 e ISO/IEC 11801", storeKey: "" },
            { label: "A1. Que establece la norma TIA-568 sobre el cableado estructurado", storeKey: "g5r_321_q1" },
            { label: "A2. Que es la norma TIA-606 y para que sirve en la documentacion", storeKey: "g5r_321_q2" },
            { label: "A3. Elementos minimos a documentar segun estos estandares", storeKey: "g5r_321_q3" },
            { label: "BLOQUE B — Herramientas de verificacion y certificacion de cableado", storeKey: "" },
            { label: "B1. Diferencia entre tester de cable y certificador de cableado", storeKey: "g5r_322_q1" },
            { label: "B2. Parametros que mide un certificador y no un tester simple", storeKey: "g5r_322_q2" },
            { label: "B3. Resultado que genera el certificador y como se documenta", storeKey: "g5r_322_q3" },
            { label: "BLOQUE C — Parametros de certificacion de cableado", storeKey: "" },
            { label: "C1. Que es la atenuacion (perdida de insercion) y como afecta la red", storeKey: "g5r_323_q1" },
            { label: "C2. Que significa un test BER aprobado y su implicacion documental", storeKey: "g5r_323_q2" },
            { label: "C3. Por que registrar la longitud del cable en el informe tecnico", storeKey: "g5r_323_q3" },
            { label: "BLOQUE D — Estructura de un informe tecnico de red", storeKey: "" },
            { label: "D1. Diferencia entre informe tecnico e informe ejecutivo", storeKey: "g5r_324_q1" },
            { label: "D2. Secciones obligatorias de un informe tecnico de instalacion de red", storeKey: "g5r_324_q2" },
            { label: "D3. Evidencias graficas que debe incluir un informe tecnico de red", storeKey: "g5r_324_q3" },
          ],
        },
      },
      {
        id: "entregaContexto", number: "3.2.5", label: "Entrega - Productos de contextualizacion (PDF)",
        shortName: "Contextualizacion", type: "file",
        driveTarget: {
          panelKey: "g5redes-3-2-5", deadlineActivityId: "entregaContexto",
          activityTitle: "Contextualizacion de documentacion (PDF con los 4 productos)",
          description: "Sube a Drive un solo PDF con los 4 productos: tabla comparativa de estandares, cuadro de herramientas, tabla de parametros e indice comentado.",
          note: "Nombre sugerido: Contextualizacion_Documentacion_NombreAprendiz_FICHA.pdf",
        },
      },
      {
        id: "demoHerramientas331", number: "3.3.1", label: "Demostracion practica de herramientas de cableado",
        shortName: "DemoHerramientas", type: "form",
        formFields: ["g5r_331_punchdown", "g5r_331_crimpadora", "g5r_331_tester", "g5r_331_certificador"],
        buttonIds: { save: "btnGuardarDemoHerramientas331", status: "statusDemoHerramientas331" },
        wordExport: {
          contextBox: "Demostracion practica: Punch Down, crimpadora RJ-45, tester de cable y certificador de redes.",
          sections: [
            { label: "Punch Down — resultado y anotaciones", storeKey: "g5r_331_punchdown" },
            { label: "Crimpadora RJ-45 — resultado y anotaciones", storeKey: "g5r_331_crimpadora" },
            { label: "Tester de cable — resultado y anotaciones", storeKey: "g5r_331_tester" },
            { label: "Certificador de redes — resultado y anotaciones", storeKey: "g5r_331_certificador" },
          ],
        },
      },
      {
        id: "plantilla1Inventario", number: "3.3.2.1", label: "Plantilla 1 - Inventario de dispositivos de red",
        shortName: "Plantilla1Inventario", type: "form",
        formFields: [
          "g5r_p1_r1", "g5r_p1_r2", "g5r_p1_r3", "g5r_p1_r4", "g5r_p1_r5", "g5r_p1_r6",
          "g5r_p1_r7", "g5r_p1_r8", "g5r_p1_r9", "g5r_p1_r10", "g5r_p1_r11", "g5r_p1_r12",
        ],
        buttonIds: { save: "btnGuardarPlantilla1Inventario", status: "statusPlantilla1Inventario" },
        wordExport: {
          contextBox: "Plantilla 1 — Inventario de dispositivos de red de OccidenteServicios Ltda. (12 dispositivos: R1, S1, S2, PC0-PC7).",
          sections: [
            { label: "R1 — Gi0/0/0 (Router, enlace Planta 1)", storeKey: "g5r_p1_r1" },
            { label: "R1 — Gi0/0/1 (Router, enlace Planta 2)", storeKey: "g5r_p1_r2" },
            { label: "S1 — VLAN 1 (Switch Planta 1)", storeKey: "g5r_p1_r3" },
            { label: "S2 — VLAN 1 (Switch Planta 2)", storeKey: "g5r_p1_r4" },
            { label: "PC0 — Contabilidad (Planta 1)", storeKey: "g5r_p1_r5" },
            { label: "PC1 — Gerencia (Planta 1)", storeKey: "g5r_p1_r6" },
            { label: "PC2 — Recepcion (Planta 1)", storeKey: "g5r_p1_r7" },
            { label: "PC3 — Soporte (Planta 1)", storeKey: "g5r_p1_r8" },
            { label: "PC4 — Bodega (Planta 2)", storeKey: "g5r_p1_r9" },
            { label: "PC5 — Despacho (Planta 2)", storeKey: "g5r_p1_r10" },
            { label: "PC6 — Calidad (Planta 2)", storeKey: "g5r_p1_r11" },
            { label: "PC7 — Sistemas (Planta 2)", storeKey: "g5r_p1_r12" },
          ],
        },
      },
      {
        id: "plantilla2IP", number: "3.3.2.2", label: "Plantilla 2 - Tabla de direccionamiento IP",
        shortName: "Plantilla2IP", type: "form",
        formFields: [
          "g5r_p2_r1", "g5r_p2_r2", "g5r_p2_r3", "g5r_p2_r4", "g5r_p2_r5", "g5r_p2_r6",
          "g5r_p2_r7", "g5r_p2_r8", "g5r_p2_r9", "g5r_p2_r10", "g5r_p2_r11", "g5r_p2_r12",
        ],
        buttonIds: { save: "btnGuardarPlantilla2IP", status: "statusPlantilla2IP" },
        wordExport: {
          contextBox: "Plantilla 2 — Tabla de direccionamiento IP de OccidenteServicios Ltda. (192.168.1.0/24 Planta 1, 192.168.2.0/24 Planta 2).",
          sections: [
            { label: "R1 — Gi0/0/0", storeKey: "g5r_p2_r1" },
            { label: "R1 — Gi0/0/1", storeKey: "g5r_p2_r2" },
            { label: "S1 — VLAN 1", storeKey: "g5r_p2_r3" },
            { label: "S2 — VLAN 1", storeKey: "g5r_p2_r4" },
            { label: "PC0 — Contabilidad", storeKey: "g5r_p2_r5" },
            { label: "PC1 — Gerencia", storeKey: "g5r_p2_r6" },
            { label: "PC2 — Recepcion", storeKey: "g5r_p2_r7" },
            { label: "PC3 — Soporte", storeKey: "g5r_p2_r8" },
            { label: "PC4 — Bodega", storeKey: "g5r_p2_r9" },
            { label: "PC5 — Despacho", storeKey: "g5r_p2_r10" },
            { label: "PC6 — Calidad", storeKey: "g5r_p2_r11" },
            { label: "PC7 — Sistemas", storeKey: "g5r_p2_r12" },
          ],
        },
      },
      {
        id: "plantilla3Pruebas", number: "3.3.2.3", label: "Plantilla 3 - Registro de pruebas de conectividad",
        shortName: "Plantilla3Pruebas", type: "form",
        formFields: [
          "g5r_p3_r1", "g5r_p3_r2", "g5r_p3_r3", "g5r_p3_r4", "g5r_p3_r5",
          "g5r_p3_r6", "g5r_p3_r7", "g5r_p3_r8", "g5r_p3_r9", "g5r_p3_r10",
        ],
        buttonIds: { save: "btnGuardarPlantilla3Pruebas", status: "statusPlantilla3Pruebas" },
        wordExport: {
          contextBox: "Plantilla 3 — Registro de las 10 pruebas de conectividad de la red de OccidenteServicios Ltda. (mismas pruebas de la Guia 3).",
          sections: [
            { label: "1. PC0: ping 192.168.1.1 (Gateway Planta 1)", storeKey: "g5r_p3_r1" },
            { label: "2. PC2: ping 192.168.1.13 (comunicacion PCs Planta 1)", storeKey: "g5r_p3_r2" },
            { label: "3. PC4: ping 192.168.2.1 (Gateway Planta 2)", storeKey: "g5r_p3_r3" },
            { label: "4. PC6: ping 192.168.2.13 (comunicacion PCs Planta 2)", storeKey: "g5r_p3_r4" },
            { label: "5. PC0: ping 192.168.2.10 (enrutamiento Planta 1 a Planta 2)", storeKey: "g5r_p3_r5" },
            { label: "6. PC7: ping 192.168.1.11 (enrutamiento inverso Planta 2 a Planta 1)", storeKey: "g5r_p3_r6" },
            { label: "7. PC3: ping 192.168.1.2 (gestion del switch S1)", storeKey: "g5r_p3_r7" },
            { label: "8. PC5: ping 192.168.2.2 (gestion del switch S2)", storeKey: "g5r_p3_r8" },
            { label: "9. PC0: tracert 192.168.2.13 (ruta entre plantas)", storeKey: "g5r_p3_r9" },
            { label: "10. PC4: telnet 192.168.1.1 (acceso administrativo remoto)", storeKey: "g5r_p3_r10" },
          ],
        },
      },
      {
        id: "informeTecnico", number: "3.4.1", label: "Informe tecnico completo de la red",
        shortName: "InformeTecnico", type: "file",
        driveTarget: {
          panelKey: "g5redes-3-4-1", deadlineActivityId: "informeTecnico",
          activityTitle: "Informe tecnico completo de la red (OccidenteServicios Ltda.)",
          description: "Sube a Drive el informe tecnico completo en PDF (minimo 8 paginas, 10 secciones, con topologia exportada de Packet Tracer y las 3 plantillas incluidas).",
          note: "Nombre sugerido: InformeTecnico_OccidenteServicios_NombreAprendiz_FICHA.pdf",
          allowedExtensions: [".pdf"],
        },
      },
    ],
  });

  // ── Guia practica de Python (todos los grupos, 10 retos + 1 entrega final) ─
  register({
    files: ["santa-barbara-guia-python.html"],
    guideNumber: "Python",
    guideTitle: "Guia - Practica de Python",
    stateKey: "guia_interactiva_santa_barbara_guia_python_html",
    program: PROGRAM,
    competencia: "220501121 - Procesar la informacion de acuerdo con las necesidades de la organizacion.",
    resultado: "Fundamentos de programacion en Python: variables, condicionales y Programacion Orientada a Objetos.",
    activities: [
      {
        id: "retoEj1", number: "1", label: "Reto ejercicio 1 - Registro basico del aprendiz",
        shortName: "RetoEj1", type: "file",
        driveTarget: {
          panelKey: "python-ej1", deadlineActivityId: "retoEj1",
          activityTitle: "Reto ejercicio 1 - Registro basico del aprendiz",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 1 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj2", number: "2", label: "Reto ejercicio 2 - Edad y condicional simple",
        shortName: "RetoEj2", type: "file",
        driveTarget: {
          panelKey: "python-ej2", deadlineActivityId: "retoEj2",
          activityTitle: "Reto ejercicio 2 - Edad y condicional simple",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 2 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj3", number: "3", label: "Reto ejercicio 3 - Nota final con if y else",
        shortName: "RetoEj3", type: "file",
        driveTarget: {
          panelKey: "python-ej3", deadlineActivityId: "retoEj3",
          activityTitle: "Reto ejercicio 3 - Nota final con if y else",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 3 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj4", number: "4", label: "Reto ejercicio 4 - Promedio, asistencia y if-elif-else",
        shortName: "RetoEj4", type: "file",
        driveTarget: {
          panelKey: "python-ej4", deadlineActivityId: "retoEj4",
          activityTitle: "Reto ejercicio 4 - Promedio, asistencia y if-elif-else",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 4 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj5", number: "5", label: "Reto ejercicio 5 - Control de entrega de actividad",
        shortName: "RetoEj5", type: "file",
        driveTarget: {
          panelKey: "python-ej5", deadlineActivityId: "retoEj5",
          activityTitle: "Reto ejercicio 5 - Control de entrega de actividad",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 5 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj6", number: "6", label: "Reto ejercicio 6 - Lista de actividades entregadas",
        shortName: "RetoEj6", type: "file",
        driveTarget: {
          panelKey: "python-ej6", deadlineActivityId: "retoEj6",
          activityTitle: "Reto ejercicio 6 - Lista de actividades entregadas",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 6 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj7", number: "7", label: "Reto ejercicio 7 - Ficha con diccionario, conjunto y match-case",
        shortName: "RetoEj7", type: "file",
        driveTarget: {
          panelKey: "python-ej7", deadlineActivityId: "retoEj7",
          activityTitle: "Reto ejercicio 7 - Ficha con diccionario, conjunto y match-case",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 7 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj8", number: "8", label: "Reto ejercicio 8 - POO 1: Clase Estudiante",
        shortName: "RetoEj8", type: "file",
        driveTarget: {
          panelKey: "python-ej8", deadlineActivityId: "retoEj8",
          activityTitle: "Reto ejercicio 8 - POO 1: Clase Estudiante",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 8 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj9", number: "9", label: "Reto ejercicio 9 - POO 2: Clase EntregaActividad",
        shortName: "RetoEj9", type: "file",
        driveTarget: {
          panelKey: "python-ej9", deadlineActivityId: "retoEj9",
          activityTitle: "Reto ejercicio 9 - POO 2: Clase EntregaActividad",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 9 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoEj10", number: "10", label: "Reto ejercicio 10 - POO 3: Clase Ficha con lista de aprendices",
        shortName: "RetoEj10", type: "file",
        driveTarget: {
          panelKey: "python-ej10", deadlineActivityId: "retoEj10",
          activityTitle: "Reto ejercicio 10 - POO 3: Clase Ficha con lista de aprendices",
          description: "Sube la captura de pantalla o el archivo .py con el reto del ejercicio 10 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj1", number: "1A", label: "Ejercicio adicional 1 - Datos del instructor",
        shortName: "AdicionalEj1", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej1", deadlineActivityId: "adicionalEj1",
          activityTitle: "Ejercicio adicional 1 - Datos del instructor",
          description: "Sube el archivo .py o captura del ejercicio adicional 1 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj2", number: "2A", label: "Ejercicio adicional 2 - Nota aprobatoria",
        shortName: "AdicionalEj2", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej2", deadlineActivityId: "adicionalEj2",
          activityTitle: "Ejercicio adicional 2 - Nota aprobatoria",
          description: "Sube el archivo .py o captura del ejercicio adicional 2 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj3", number: "3A", label: "Ejercicio adicional 3 - Promedio de dos calificaciones",
        shortName: "AdicionalEj3", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej3", deadlineActivityId: "adicionalEj3",
          activityTitle: "Ejercicio adicional 3 - Promedio de dos calificaciones",
          description: "Sube el archivo .py o captura del ejercicio adicional 3 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj4", number: "4A", label: "Ejercicio adicional 4 - Actividades y asistencia",
        shortName: "AdicionalEj4", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej4", deadlineActivityId: "adicionalEj4",
          activityTitle: "Ejercicio adicional 4 - Actividades y asistencia",
          description: "Sube el archivo .py o captura del ejercicio adicional 4 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj5", number: "5A", label: "Ejercicio adicional 5 - Asistencia a laboratorio",
        shortName: "AdicionalEj5", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej5", deadlineActivityId: "adicionalEj5",
          activityTitle: "Ejercicio adicional 5 - Asistencia a laboratorio",
          description: "Sube el archivo .py o captura del ejercicio adicional 5 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj6", number: "6A", label: "Ejercicio adicional 6 - Equipos del salon",
        shortName: "AdicionalEj6", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej6", deadlineActivityId: "adicionalEj6",
          activityTitle: "Ejercicio adicional 6 - Equipos del salon",
          description: "Sube el archivo .py o captura del ejercicio adicional 6 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj7", number: "7A", label: "Ejercicio adicional 7 - Computador del aula con menu",
        shortName: "AdicionalEj7", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej7", deadlineActivityId: "adicionalEj7",
          activityTitle: "Ejercicio adicional 7 - Computador del aula con menu",
          description: "Sube el archivo .py o captura del ejercicio adicional 7 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj8", number: "8A", label: "Ejercicio adicional 8 - Clase Computador",
        shortName: "AdicionalEj8", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej8", deadlineActivityId: "adicionalEj8",
          activityTitle: "Ejercicio adicional 8 - Clase Computador",
          description: "Sube el archivo .py o captura del ejercicio adicional 8 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj9", number: "9A", label: "Ejercicio adicional 9 - Clase Asistencia",
        shortName: "AdicionalEj9", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej9", deadlineActivityId: "adicionalEj9",
          activityTitle: "Ejercicio adicional 9 - Clase Asistencia",
          description: "Sube el archivo .py o captura del ejercicio adicional 9 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "adicionalEj10", number: "10A", label: "Ejercicio adicional 10 - Clase Aula con equipos",
        shortName: "AdicionalEj10", type: "file",
        driveTarget: {
          panelKey: "python-adicional-ej10", deadlineActivityId: "adicionalEj10",
          activityTitle: "Ejercicio adicional 10 - Clase Aula con equipos",
          description: "Sube el archivo .py o captura del ejercicio adicional 10 resuelto.",
          note: "Formato sugerido: .py o captura de pantalla.",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf", ".zip"],
        },
      },
      {
        id: "retoPython", number: "5.1", label: "Reto integrador - Sistema basico de seguimiento academico",
        shortName: "RetoIntegrador", type: "file",
        driveTarget: {
          panelKey: "python-reto", deadlineActivityId: "retoPython",
          activityTitle: "Reto integrador de Python",
          description: "Sube tu programa .py funcionando y una captura de pantalla del reporte que genera.",
          note: "",
          allowedExtensions: [".py", ".png", ".jpg", ".jpeg", ".pdf"],
          // Bloque E (auditoria 2026-08-27): antes se le pedia al aprendiz
          // comprimir .py + evidencia en un solo .zip subido por el flujo de
          // archivo unico -- sin ninguna verificacion de que el zip trajera
          // los 2 archivos realmente. Ahora cada archivo se sube por su
          // propio boton (misma cantidad de solicitudes que subir 2 archivos
          // hoy), pero ActivityStandard los trata como UNA entrega logica:
          // "N/2 archivos subidos" mientras falte alguno, y la actividad solo
          // se marca "entregada" (o cuenta para el % de progreso) cuando
          // ambos estan. Ver buildDriveTargets/_mountGroupedDeliveryWatcher
          // en js/activity_standard.js.
          requiredFiles: [
            {
              key: "programa", label: "Programa .py",
              description: "Sube tu archivo .py funcionando.",
              allowedExtensions: [".py"],
            },
            {
              key: "evidencia", label: "Captura de pantalla o documento de evidencia",
              description: "Sube una captura de pantalla o documento que muestre el reporte generado por tu programa.",
              allowedExtensions: [".png", ".jpg", ".jpeg", ".pdf"],
            },
          ],
        },
      },
    ],
  });

})();
