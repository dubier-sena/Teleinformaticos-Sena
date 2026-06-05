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
      { id: "arbol312",      number: "3.1.2", label: "El Arbol de la Vida",                 shortName: "ArbolVida",   type: "form" },
      { id: "sena331",       number: "3.3.1", label: "Analisis de simbolos SENA",           shortName: "SimbolosSENA", type: "form" },
      { id: "programa332",   number: "3.3.2", label: "Cuestionario diseno curricular",      shortName: "Cuestionario", type: "form" },
      { id: "plataformas334",number: "3.3.4", label: "Taller plataformas tecnologicas",     shortName: "Plataformas",  type: "form" },
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
      { id: "analisis313",     number: "3.1.3", label: "Bitacora de analisis",              shortName: "Bitacora",        type: "form" },
      { id: "matriz322",       number: "3.2.2", label: "Matriz de Diagnostico Digital",     shortName: "MatrizDigital",   type: "form" },
      { id: "fichaCaso",       number: "3.2.1", label: "Ficha de caso",                     shortName: "FichaCaso",       type: "form" },
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
      { id: "transferReto341", number: "3.4.1", label: "Reto final",                        shortName: "RetoFinal",       type: "form" },
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
      {
        id: "tabla321", number: "3.2.1", label: "Tabla resumen", shortName: "TablaResumen", type: "form",
        teamRequirement: { required: true, allowSolo: false, min: 3, max: 3, scope: "activity" },
      },
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
      { id: "guia5-311", number: "3.1.1", label: "Bitacora o analisis del caso", shortName: "Bitacora",   type: "form" },
      { id: "guia5-331", number: "3.3.1", label: "Evidencias de herramientas",   shortName: "Evidencias", type: "form" },
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
      { id: "socializacion311", number: "3.1.1", label: "Socializacion",            shortName: "Socializacion", type: "form" },
      { id: "ip1",              number: "3.2.1", label: "Bloque IP 1",              shortName: "BloqueIP1",     type: "form" },
      { id: "ip3",              number: "3.2.3", label: "Bloque IP 3",              shortName: "BloqueIP3",     type: "form" },
      { id: "taller-ip-ej1",    number: "3.3.1", label: "Taller IP - Ejercicio 1",  shortName: "TallerIP1",     type: "form" },
      { id: "taller-ip-ej2",    number: "3.3.2", label: "Taller IP - Ejercicio 2",  shortName: "TallerIP2",     type: "form" },
      { id: "taller-ip-ej3",    number: "3.3.3", label: "Taller IP - Ejercicio 3",  shortName: "TallerIP3",     type: "form" },
      { id: "taller-ip-ej4",    number: "3.3.4", label: "Taller IP - Ejercicio 4",  shortName: "TallerIP4",     type: "form" },
      { id: "taller-ip-ej5",    number: "3.3.5", label: "Taller IP - Ejercicio 5",  shortName: "TallerIP5",     type: "form" },
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
        shortName: "Reflexion", type: "form",
        formFields: ["g3r_311_p1", "g3r_311_p2", "g3r_311_p3", "g3r_311_p4", "g3r_311_p5"],
        buttonIds: { save: "btnGuardarReflexion311", status: "statusReflexion311" },
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
    ],
  });

})();
