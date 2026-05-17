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
      { id: "transferReto341", number: "3.4.1", label: "Reto final",                        shortName: "RetoFinal",       type: "form" },
    ],
  });

  // ── Guia 3 — Planificar la informacion (10A + 10B) ─────────────────────────
  register({
    files: [
      "grupo-10a-guia-03-planificar-informacion.html",
      "grupo-10b-guia-03-planificar-informacion.html",
    ],
    guideNumber: "3",
    guideTitle: "Guia 3 - Planificar la informacion",
    stateKey: "guia_interactiva_10a_guia3_html",
    program: PROGRAM,
    competencia: COMPETENCIA,
    resultado: RAP_PLANIFICAR,
    activities: [
      { id: "bitacora311",    number: "3.1.1", label: "Bitacora individual de analisis",     shortName: "Bitacora",      type: "form" },
      { id: "socializacion312",number: "3.1.2", label: "Socializacion del analisis",         shortName: "Socializacion", type: "form" },
      { id: "tabla321",       number: "3.2.1", label: "Tabla resumen",                       shortName: "TablaResumen",  type: "form" },
      { id: "mapa322",        number: "3.2.2", label: "Mapa conceptual",                     shortName: "MapaConceptual",type: "form" },
      { id: "checklist331",   number: "3.3.1", label: "Checklist de instalacion",            shortName: "Checklist",     type: "form" },
      { id: "diagnostico332", number: "3.3.2", label: "Diagnostico tecnico",                 shortName: "Diagnostico",   type: "form" },
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

  // ── Guia 6 — Planificar la informacion (11A + 11B) ─────────────────────────
  register({
    files: [
      "grupo-11a-guia-06-planificar-informacion.html",
      "grupo-11b-guia-06-planificar-informacion.html",
    ],
    guideNumber: "6",
    guideTitle: "Guia 6 - Planificar la informacion (Grado 11)",
    stateKey: "guia_interactiva_11a_guia6_html",
    program: PROGRAM,
    competencia: COMPETENCIA,
    resultado: RAP_PLANIFICAR,
    activities: [
      { id: "bitacora311",     number: "3.1.1", label: "Bitacora individual de analisis", shortName: "Bitacora",      type: "form" },
      { id: "socializacion312",number: "3.1.2", label: "Socializacion del analisis",      shortName: "Socializacion", type: "form" },
      { id: "tabla321",        number: "3.2.1", label: "Tabla resumen",                   shortName: "TablaResumen",  type: "form" },
      { id: "mapa322",         number: "3.2.2", label: "Mapa conceptual",                 shortName: "MapaConceptual",type: "form" },
      { id: "checklist331",    number: "3.3.1", label: "Checklist de instalacion",        shortName: "Checklist",     type: "form" },
      { id: "diagnostico332",  number: "3.3.2", label: "Diagnostico tecnico",             shortName: "Diagnostico",   type: "form" },
      { id: "presupuesto341",  number: "3.4.1", label: "Presupuesto final",               shortName: "Presupuesto",   type: "form" },
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

})();
