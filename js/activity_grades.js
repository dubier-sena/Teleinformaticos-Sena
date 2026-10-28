// activity_grades.js — Gestión y visualización de juicios de evaluación por actividad.
// Funciona para cualquier guía, presente o futura. El admin registra las notas en el
// panel administrativo; los aprendices las ven en cada actividad de la guía.
//
// Almacenamiento: sena_portal:student:{usernameKey}:app:grades
// Valor: JSON { "guia-01-induccion": { "arbol312": "A"|"D" }, ... }

(function () {
  "use strict";

  // ── Catálogo de actividades evaluadas por guía ──────────────────────────────
  // Agrega aquí nuevas guías a medida que se creen.
  // Catalogo de calificacion: UNA columna por actividad NUMERADA (un "entregable")
  // de cada guia. Debe coincidir con las actividades reales que ve el aprendiz
  // (js/guide_declarations.js -> lo que muestra "Respuestas"). Cuando varias
  // sub-actividades comparten numero (p. ej. las 5 partes de 3.3.5 en Guia 2, o
  // reflexion+socializacion 3.1.1 en Redes), se colapsan en UN entregable usando el
  // id de la primera. El test tests/grade_catalog_matches_declarations.test.cjs
  // verifica esta correspondencia para que no se vuelva a desincronizar.
  var GRADE_CATALOG = {
    "guia-01-induccion": {
      label: "Guía 1 — Inducción",
      activities: [
        { id: "arbol312",       label: "3.1.2 Árbol de la Vida" },
        // Mount agregado a proposito (juego de Sopa de Letras/Crucigrama, sin
        // campo de texto que calificar via banco -- solo Aprobado/No aprobado).
        { id: "sopaletras321",  label: "3.2.1 Sopa de Letras y Crucigrama SENA" },
        { id: "sena331",        label: "3.3.1 Análisis de Símbolos SENA" },
        { id: "programa332",    label: "3.3.2 Cuestionario Diseño Curricular" },
        // Ya tenia su punto de anclaje listo en la guia (#reglamento333GradeMount)
        // pero se quedo fuera del catalogo por descuido -- el admin no podia
        // calificarla aunque la guia ya esperaba mostrar el badge.
        { id: "reglamento333",  label: "3.3.3 Reglamento del Aprendiz", mount: "#reglamento333GradeMount" },
        { id: "plataformas334", label: "3.3.4 Taller de Plataformas Tecnológicas" },
        { id: "compromiso341",  label: "3.4.1 Mi Compromiso como Aprendiz" },
        { id: "portafolio342",  label: "3.4.2 Portafolio de Evidencias" },
      ],
    },
    "guia-02-herramientas": {
      label: "Guía 2 — Operar herramientas informáticas y digitales",
      activities: [
        // "relaciona311" es una actividad SEPARADA en la guia (3.1.2, su propia
        // tarjeta), pero se califica junto con sopaletras311 en UNA sola columna
        // (ambas son juegos de puntaje sin campo de texto). aliasIds hace que el
        // badge tambien se monte en la tarjeta de relaciona311 (aliasMounts) y que
        // "Tu control de avance" la marque hecha cuando se califica esta fila.
        { id: "sopaletras311",    label: "3.1.1 Actividades de inicio (Sopa de letras y Relaciona herramienta-función)", aliasIds: ["relaciona311"], aliasMounts: ["#relaciona311GradeMount"] },
        { id: "analisis313",      label: "3.1.3 Bitácora de análisis" },
        // "fichaCaso" (Parte 2: el aprendiz solo LEE el caso que le tocó, 0 campos
        // de texto en esa pagina) alimenta la Matriz (Parte 3, mismo trabajo en
        // equipo) -- se califican juntas en UNA sola columna (aliasIds), igual
        // patron que sopaletras311/relaciona311. "matriz322" queda como id
        // primario porque ahi vive el contenido real (y su entrada del banco de
        // respuestas en grade_solutions_bank.json).
        { id: "matriz322",        label: "3.2.1 Ficha de caso + Matriz de Diagnóstico Digital", aliasIds: ["fichaCaso"], aliasMounts: ["#fichaCasoGradeMount"] },
        // Cuestionario individual (10 preguntas, "contexto-*") de la Actividad 4 --
        // pagina aparte (grupo-10a/10b-guia-02-actividad-4-formulario.html), NO usa
        // guide_declarations.js/ActivityStandard (es standalone). mount vive en esa
        // misma pagina.
        { id: "diagnostico323",   label: "3.2.3 Diagnóstico inicial del contexto digital (formulario individual)" },
        { id: "extensiones331",   label: "3.3.1 Extensiones de archivo" },
        { id: "sistemas332",      label: "3.3.2 Requerimientos mínimos" },
        { id: "suite333",         label: "3.3.3 Suite ofimática en acción" },
        { id: "colaborativas334", label: "3.3.4 Herramientas colaborativas" },
        // La Actividad 9 (3.3.5) se califica en UNA columna: la nota vive bajo
        // cibersegAmenazas335 pero cubre las 4 sub-secciones + la entrega Drive
        // (mismo patron que matriz322/fichaCaso). Sin estos aliasIds, al aprobar
        // solo se embebia el banco de "amenazas" (2 campos): guia/phishing/
        // checklist quedaban "calificadas pero vacias", sin bloquear y sin badge.
        { id: "cibersegAmenazas335", label: "3.3.5 Ciberseguridad",
          aliasIds: ["cibersegGuia335", "cibersegPhishing335", "cibersegChecklist335", "ciberseguridad335"],
          aliasMounts: ["#cibersegGuia335DeadlineControls", "#cibersegPhishing335DeadlineControls", "#cibersegChecklist335DeadlineControls"] },
        { id: "transferReto341",  label: "3.4.1 Reto final" },
        // Quiz autocalificado "ACTIVIDAD 11" (script_redes_quiz.js, storage key
        // propio "quiz-guia2-342"): igual que los quiz de Redes RAP01, nunca
        // estuvo en el catalogo -- no habia forma de aprobarlo desde el panel
        // admin. Detectado 2026-07-23 al auditar si el mismo hueco de Redes
        // RAP01 tambien afectaba a Kennedy.
        { id: "quiz-guia2-342",   label: "3.4.2 Quiz individual de herramientas informáticas y digitales" },
      ],
    },
    "guia-03-planificar-10": {
      label: "Guía 3 — Implementar componentes (grado 10)",
      activities: [
        { id: "bitacora311",     label: "3.1.1 Bitácora individual de análisis" },
        { id: "socializacion312", label: "3.1.2 Socialización del análisis" },
        // Quiz autocalificado embebido en la tarjeta 3.1.2. El HTML no tenia ni
        // siquiera el enlace para presentarlo (bug de acceso aparte, corregido
        // junto con esto) -- nunca estuvo en el catalogo. Detectado 2026-07-23.
        { id: "quiz-guia3-312",  label: "3.1.2.1 Quiz individual de herramientas" },
        { id: "tabla321",        label: "3.2.1 Tabla resumen" },
        // Quiz de la actividad 3.2.1, SOLO existe para el grupo 10B (10A no
        // tiene esta pagina/contenido -- asimetria intencional de la guia, no
        // es un bug). Detectado 2026-07-23.
        { id: "quiz-guia3-321",  label: "3.2.1.1 Quiz de contenidos temáticos (solo 10B)" },
        { id: "mapa322",         label: "3.2.2 Mapa conceptual" },
        { id: "checklist331",    label: "3.3.1 Checklist de instalación" },
        { id: "diagnostico332",  label: "3.3.2 Diagnóstico técnico" },
        { id: "documento333",    label: "3.3.3 Documento técnico de gestión" },
        { id: "presupuesto341",  label: "3.4.1 Presupuesto final" },
        { id: "sustentacion342", label: "3.4.2 Presentación y sustentación oral" },
      ],
    },
    "guia-04-ciberseguridad": {
      label: "Guía 4 — Planificar información (ciberseguridad, grado 10)",
      activities: [
        { id: "caso311",        label: "3.1.1 Análisis del caso ElectroBoycá" },
        { id: "plenaria312",    label: "3.1.2 Socialización guiada en plenaria" },
        { id: "bloques321",     label: "3.2.1 Estudio de los bloques temáticos A y B" },
        { id: "mapa322",        label: "3.2.2 Mapa conceptual integrador" },
        { id: "diagnostico331", label: "3.3.1 Diagnóstico del estado de seguridad" },
        { id: "hardening332",   label: "3.3.2 Controles de hardening" },
        { id: "documentos333",  label: "3.3.3 Documentación técnica (A-D)" },
        { id: "plan341",        label: "3.4.1 Plan Integral de Ciberseguridad + Sustentación" },
      ],
    },
    "guia-05-herramientas": {
      label: "Guía 5 — Operar herramientas (grado 11)",
      activities: [
        // El DOM usa ids sin guion (guia5311…); el catálogo conserva el id con guion
        // para no perder notas ya guardadas, y fija el mount explícito.
        { id: "guia5-311", label: "3.1.1 Bitácora o análisis del caso", mount: "#guia5311DeadlineControls" },
        // Juego Educaplay (sopa de letras + relaciona nombre y concepto), sin
        // deadline mount propio -- usa el GradeMount dedicado del badge.
        // Faltaba del catalogo: por eso "Tus actividades de esta guia" solo
        // mostraba 3 en vez de 4. Detectado 2026-07-24.
        { id: "guia5-321", label: "3.2.1 Reconocimiento de conceptos y herramientas", mount: "#guia5321GradeMount" },
        { id: "guia5-331", label: "3.3.1 Evidencias de herramientas", mount: "#guia5331DeadlineControls" },
        { id: "guia5-341", label: "3.4.1 Informe final integrador", mount: "#guia5341DeadlineControls" },
      ],
    },
    "guia-06-planificar": {
      label: "Guía 6 — Implementar componentes (grado 11)",
      activities: [
        { id: "bitacora311",      label: "3.1.1 Bitácora individual de análisis" },
        { id: "socializacion312", label: "3.1.2 Socialización del análisis" },
        // Quiz autocalificado embebido dentro de la tarjeta 3.1.2 (mismo hueco
        // que los demas quiz del portal: nunca estuvo en el catalogo).
        // Detectado 2026-07-23.
        { id: "quiz-guia6-312",   label: "3.1.2.1 Quiz individual de herramientas" },
        { id: "tabla321",         label: "3.2.1 Tabla resumen" },
        { id: "mapa322",          label: "3.2.2 Mapa conceptual" },
        { id: "checklist331",     label: "3.3.1 Checklist de instalación" },
        { id: "diagnostico332",   label: "3.3.2 Diagnóstico técnico" },
        { id: "presupuesto341",   label: "3.4.1 Presupuesto final" },
      ],
    },
    "guia-07-ciberseguridad": {
      label: "Guía 7 — Planificar información (ciberseguridad, grado 11)",
      activities: [
        { id: "caso311",        label: "3.1.1 Análisis del caso ElectroBoyacá" },
        { id: "plenaria312",    label: "3.1.2 Socialización en plenaria" },
        { id: "bloqueAB321",    label: "3.2.1 Estudio de contenidos (Bloques A y B)" },
        { id: "mapa322",        label: "3.2.2 Mapa conceptual de ciberseguridad" },
        { id: "diagnostico331", label: "3.3.1 Diagnóstico del estado de seguridad" },
        { id: "hardening332",   label: "3.3.2 Controles de hardening" },
        { id: "plan341",        label: "3.4.1 Plan de Ciberseguridad + Sustentación" },
      ],
    },
    "guia-05-documentar-gestion": {
      label: "Guía 5 — Documentar la gestión de la información (grado 10, Kennedy)",
      activities: [
        { id: "caso411",          label: "4.1.1 Análisis del caso Agropecuaria La Esperanza" },
        { id: "plenaria412",      label: "4.1.2 Socialización en plenaria" },
        { id: "bloqueAB421",      label: "4.2.1 Estudio de contenidos (Bloques A y B)" },
        { id: "mapa422",          label: "4.2.2 Mapa conceptual del sistema documental" },
        { id: "portafolio431",    label: "4.3.1 Portafolio documental del equipo" },
        { id: "organizacion432",  label: "4.3.2 Organización digital y control de versiones" },
        { id: "documento441",     label: "4.4.1 Documento Técnico + Sustentación" },
      ],
    },
    "guia-06-mantener-equipos": {
      label: "Guía 6 — Preparar el mantenimiento de equipos de cómputo (grado 10, Kennedy; Guía 5 en Santa Bárbara)",
      activities: [
        { id: "caso311",             label: "3.1.1 Detectives del mantenimiento: caso Ferretería Puerto Real" },
        { id: "plenaria312",         label: "3.1.2 Socialización en plenaria" },
        { id: "bloqueAB321",         label: "3.2.1 Estudio de contenidos de mantenimiento (Bloques A y B)" },
        { id: "inspeccion322",       label: "3.2.2 Inspección externa de equipos de cómputo" },
        { id: "analisis331",         label: "3.3.1 Consulta y análisis guiado de fallas comunes" },
        { id: "diagnostico332",      label: "3.3.2 Diagnóstico técnico y hoja de vida del equipo" },
        { id: "hwmonitor341",        label: "3.4.1 Laboratorio de monitoreo con HWMonitor" },
        { id: "planMantenimiento342", label: "3.4.2 Plan de Mantenimiento Preventivo + Sustentación" },
      ],
    },
    // MANT-2026-10-22:START (generado por generar_guias_mantenimiento.py)
    "guia-mant-rap02": {
      label: "Realizar mantenimiento integral — RAP 02 de 220501001 (grado 10: Guía 7 Kennedy · Guía 6 Santa Bárbara)",
      activities: [
        { id: "nogal311", label: "3.1.1 Detectives del mantenimiento: caso Papelería El Nogal" },
        { id: "plenaria312", label: "3.1.2 Socialización en plenaria" },
        { id: "bloqueABC321", label: "3.2.1 Estudio de contenidos de mantenimiento integral (Bloques A, B y C) - Tabla resumen" },
        { id: "inspeccionCru322", label: "3.2.2 Inspección externa e identificación de componentes CRU" },
        { id: "fisicoCru331", label: "3.3.1 Mantenimiento preventivo físico CRU y aplicación de pasta térmica" },
        { id: "logico332", label: "3.3.2 Mantenimiento lógico: sistema operativo y software utilitario" },
        { id: "integrador341", label: "3.4.1 Laboratorio integrador: mantenimiento integral y disposición de RAEE" },
        { id: "informeFinal342", label: "3.4.2 Informe técnico final y sustentación" },
      ],
    },
    "guia-mant-rap03": {
      label: "Verificar la operación del sistema — RAP 03 de 220501001 (grado 10: Guía 8 Kennedy · Guía 7 Santa Bárbara)",
      activities: [
        { id: "nogal311", label: "3.1.1 Qué le pasa al computador de El Nogal" },
        { id: "plenaria312", label: "3.1.2 Socialización en plenaria" },
        { id: "bloquesABC321", label: "3.2.1 Estudio de contenidos de diagnóstico y verificación (Bloques A, B y C) - Tabla resumen" },
        { id: "protocolo322", label: "3.2.2 Elaboración del protocolo de verificación" },
        { id: "cpuz331", label: "3.3.1 Procesador, memoria y características del sistema con CPU-Z" },
        { id: "crystal332", label: "3.3.2 Estado del almacenamiento con CrystalDiskInfo" },
        { id: "windows333", label: "3.3.3 Dispositivos, rendimiento y memoria con herramientas de Windows" },
        { id: "ie01334", label: "3.3.4 Evaluación de conocimiento: cuestionario IE-01", mount: "#ie01334GradeMount" },
        { id: "integrador341", label: "3.4.1 Laboratorio integrador: verificación de la operación del equipo" },
        { id: "registro342", label: "3.4.2 Registro de resultados de diagnóstico y sustentación" },
      ],
    },
    // MANT-2026-10-22:END
    "guia-08-documentar-gestion": {
      label: "Guía 8 — Documentar la gestión de la información (grado 11)",
      activities: [
        { id: "caso411",          label: "4.1.1 Análisis del caso Agropecuaria La Esperanza" },
        { id: "plenaria412",      label: "4.1.2 Socialización en plenaria" },
        { id: "bloqueAB421",      label: "4.2.1 Estudio de contenidos (Bloques A y B)" },
        { id: "mapa422",          label: "4.2.2 Mapa conceptual del sistema documental" },
        { id: "portafolio431",    label: "4.3.1 Portafolio documental del equipo" },
        { id: "organizacion432",  label: "4.3.2 Organización digital y control de versiones" },
        { id: "documento441",     label: "4.4.1 Documento Técnico + Sustentación" },
      ],
    },
    "guia-redes-rap01": {
      label: "Redes RAP 01 — Definir parámetros de la red",
      activities: [
        // aliasIds: la nota de reflexion311 tambien cubre socializacion311 (el
        // applier a medida ya bloquea ambas juntas, ver script_guia_redes.js).
        // Sin este alias, "Tus actividades de esta guia" mostraba Socializacion
        // como "Guardada" en vez de "Aprobada" -- _getStudentGradeForActivity
        // no encontraba nota propia para "socializacion311" y el legacyLockKeys
        // que ya tenia (agregado antes) solo resuelve el candado, no la nota.
        // Detectado 2026-07-23.
        { id: "reflexion311",  label: "3.1.1 Reflexión / Socialización", aliasIds: ["socializacion311"] },
        // "Exploracion Visual por Bloques Tematicos" (actividad 3.2.1 en el
        // export Word, ver script_guia_redes.js linea ~1296): 5 bloques
        // independientes (cada uno con su propio boton Guardar/lock). Faltaban
        // por completo del catalogo -- no habia forma de calificarlos desde el
        // panel admin, por lo que nunca llegaban al 100% aunque el banco de
        // respuestas para estos 5 ya existia completo. Detectado 2026-07-22.
        { id: "bloqueA",       label: "3.2.1.A Tipos de redes: LAN, MAN y WAN" },
        { id: "bloqueB",       label: "3.2.1.B Topologías de red" },
        { id: "bloqueC",       label: "3.2.1.C Medios de transmisión" },
        { id: "bloqueD",       label: "3.2.1.D Dispositivos de interconexión" },
        { id: "bloqueE",       label: "3.2.1.E Modelo OSI y TCP/IP" },
        // Entrega de solo archivo (sin texto que el banco pueda rellenar): al
        // aprobar sin entrega real, el flujo de calificacion la marca como
        // "entregada por el instructor" igual que los laboratorios. Agregado
        // 2026-07-23 (ver nota completa en guide_declarations.js).
        { id: "mapaMental322", label: "3.2.2 Mapa mental integrador de fundamentos de redes" },
        // Quiz autocalificado (10 preguntas, ver script_redes_quiz.js): la nota
        // real la pone el propio motor del quiz cuando el aprendiz lo presenta,
        // pero al aprobar sin intento real (pedido explicito del usuario
        // 2026-07-23) se copia un intento completo (variante A, 100/100) al
        // "banco", con el mismo formato exacto que escribe el motor del quiz
        // en state["quiz-redes-321h"] (version/variante/respuestas/resultados/
        // locked). Ver grade_solutions_bank.json.
        { id: "quiz-redes-321h", label: "3.2.1.H Quiz individual de fundamentos de redes" },
        // Numeros reales 3.3.1/3.3.2/3.3.3 (ver nota completa en
        // guide_declarations.js) -- las etiquetas "3.2.x" anteriores eran
        // incorrectas. Corregido 2026-07-23.
        { id: "ip1",           label: "3.3.1 Bloque IP 1" },
        // Mismo hueco que bloqueA-E: applyBloqueIP2Lock ya existia en
        // script_guia_redes.js pero nunca estuvo en el catalogo ni en el banco
        // de respuestas. Detectado 2026-07-22 (segunda ronda).
        { id: "ip2",           label: "3.3.2 Bloque IP 2 - Clases de IP" },
        { id: "ip3",           label: "3.3.3 Bloque IP 3" },
        // Mismo mecanismo que el quiz de fundamentos, para el quiz de IP.
        { id: "quiz-redes-33h", label: "3.3.H Quiz individual de parámetros de red" },
        // El DOM usa ids sin guion (tallerIPEj1…, ver adminMount en
        // script_guia_redes.js); el catalogo conserva el id con guion para no
        // perder notas ya guardadas, y fija el mount explicito (mismo patron
        // que guia5-311/331/341 en "guia-05-herramientas" mas abajo). Numeros
        // reales 3.3.4.1..5 (un solo badge "3.3.4" en el HTML para los 5
        // ejercicios, igual que bloqueA-E bajo "3.2.1").
        { id: "taller-ip-ej1", label: "3.3.4.1 Taller IP - Ejercicio 1", mount: "#tallerIPEj1DeadlineControls" },
        { id: "taller-ip-ej2", label: "3.3.4.2 Taller IP - Ejercicio 2", mount: "#tallerIPEj2DeadlineControls" },
        { id: "taller-ip-ej3", label: "3.3.4.3 Taller IP - Ejercicio 3", mount: "#tallerIPEj3DeadlineControls" },
        { id: "taller-ip-ej4", label: "3.3.4.4 Taller IP - Ejercicio 4", mount: "#tallerIPEj4DeadlineControls" },
        { id: "taller-ip-ej5", label: "3.3.4.5 Taller IP - Ejercicio 5", mount: "#tallerIPEj5DeadlineControls" },
        { id: "lab1",          label: "3.4.1 Laboratorio 1 - Topología estrella" },
        { id: "lab2",          label: "3.4.2 Laboratorio 2 - Topología árbol" },
        { id: "lab3",          label: "3.4.3 Laboratorio 3 - Red híbrida" },
        { id: "social",        label: "3.5.1 Socialización final" },
      ],
    },
    "guia-redes-rap02": {
      label: "Redes RAP 02 — Comprobar la conectividad de la red",
      activities: [
        { id: "reflexion311",   label: "3.1.1 Reflexión inicial - Caso Ferretería" },
        { id: "bloqueA321",     label: "3.2.1 Bloque A - Router, Switch y AP" },
        { id: "bloqueB322",     label: "3.2.2 Bloque B - TCP/IP y modelo de capas" },
        { id: "bloqueC323",     label: "3.2.3 Bloque C - DHCP, DNS y Firewall" },
        { id: "bloqueD324",     label: "3.2.4 Bloque D - IP pública vs privada y NAT" },
        { id: "entregaContexto325", label: "3.2.5 Entrega - Productos de contextualización" },
        { id: "comandos331",    label: "3.3.1 Comandos de diagnóstico CLI" },
        { id: "presentacion332", label: "3.3.2 Presentación técnica de averías" },
        { id: "laboratorio341", label: "3.4.1 Laboratorio Packet Tracer - Red 2 plantas" },
        { id: "caso342",        label: "3.4.2 Laboratorio integral - DHCP/DNS/AP/NAT" },
        // Quiz autocalificado de cierre ("Quiz de conectividad"), sin numero
        // propio en la guia (seccion aparte al final). Mismo hueco que los
        // demas quiz del portal: nunca estuvo en el catalogo. El boton de
        // acceso SI funciona (usa data/guide_contexts_bundle.js). Detectado
        // 2026-07-23.
        { id: "quiz-redes-321h-rap02", label: "3.5.1 Quiz de conectividad" },
      ],
    },
    "guia-redes-rap03": {
      label: "Redes RAP 03 — Documentar las acciones realizadas en la red",
      activities: [
        { id: "reflexion311",        label: "3.1.1 Reflexión inicial - Caso consultorio médico" },
        { id: "bloqueA321",          label: "3.2.1 Bloque A - Estándares TIA-568/606/ISO 11801" },
        { id: "bloqueB322",          label: "3.2.2 Bloque B - Herramientas de verificación" },
        { id: "bloqueC323",          label: "3.2.3 Bloque C - Parámetros de certificación" },
        { id: "bloqueD324",          label: "3.2.4 Bloque D - Estructura de informe técnico" },
        { id: "entregaContexto",     label: "3.2.5 Entrega - Productos de contextualización" },
        { id: "demoHerramientas331", label: "3.3.1 Demostración práctica de herramientas" },
        { id: "plantilla1Inventario", label: "3.3.2.1 Plantilla 1 - Inventario de dispositivos" },
        { id: "plantilla2IP",        label: "3.3.2.2 Plantilla 2 - Direccionamiento IP" },
        { id: "plantilla3Pruebas",   label: "3.3.2.3 Plantilla 3 - Pruebas de conectividad" },
        { id: "informeTecnico",      label: "3.4.1 Informe técnico completo de la red" },
      ],
    },
    // Practica de Python: originalmente era UNA sola columna combinada
    // ("retoPython"), pero el usuario pidio calificar cada entrega por separado
    // (2026-07-16): 10 retos + 10 adicionales + reto integrador, igual que los
    // paneles de entrega de la guia. Los ids coinciden con guide_declarations.js.
    // "retoPython" conserva su id: las notas ya guardadas con la columna
    // combinada quedan sobre el Reto integrador, no se pierden.
    // Los mounts de badge resuelven al contenedor [data-act-std-delivery="id"]
    // del partial (ultimo fallback de resolveGradeMount).
    "guia-python": {
      label: "Guía - Práctica de Python",
      activities: [
        { id: "retoEj1",  label: "Reto 1 - Registro básico del aprendiz" },
        { id: "retoEj2",  label: "Reto 2 - Edad y condicional simple" },
        { id: "retoEj3",  label: "Reto 3 - Nota final con if y else" },
        { id: "retoEj4",  label: "Reto 4 - Promedio, asistencia y if-elif-else" },
        { id: "retoEj5",  label: "Reto 5 - Control de entrega de actividad" },
        { id: "retoEj6",  label: "Reto 6 - Lista de actividades entregadas" },
        { id: "retoEj7",  label: "Reto 7 - Diccionario, conjunto y match-case" },
        { id: "retoEj8",  label: "Reto 8 - POO 1: Clase Estudiante" },
        { id: "retoEj9",  label: "Reto 9 - POO 2: Clase EntregaActividad" },
        { id: "retoEj10", label: "Reto 10 - POO 3: Clase Ficha con aprendices" },
        { id: "adicionalEj1",  label: "Adicional 1 - Datos del instructor" },
        { id: "adicionalEj2",  label: "Adicional 2 - Nota aprobatoria" },
        { id: "adicionalEj3",  label: "Adicional 3 - Promedio de dos calificaciones" },
        { id: "adicionalEj4",  label: "Adicional 4 - Actividades y asistencia" },
        { id: "adicionalEj5",  label: "Adicional 5 - Asistencia a laboratorio" },
        { id: "adicionalEj6",  label: "Adicional 6 - Equipos del salón" },
        { id: "adicionalEj7",  label: "Adicional 7 - Computador del aula con menú" },
        { id: "adicionalEj8",  label: "Adicional 8 - Clase Computador" },
        { id: "adicionalEj9",  label: "Adicional 9 - Clase Asistencia" },
        { id: "adicionalEj10", label: "Adicional 10 - Clase Aula con equipos" },
        { id: "retoPython", label: "5.1 Reto integrador - Seguimiento académico" },
      ],
    },
    "taller-integrador-jfk": {
      label: "Taller Integrador (John F. Kennedy)",
      activities: [
        { id: "equipoTaller", label: "0 - Conformación del equipo de trabajo" },
        { id: "diagnostico", label: "Producto 1 - Informe diagnóstico" },
        { id: "planAlfabetizacion", label: "Producto 2 - Plan de intervención" },
        { id: "plantillaExcel", label: "Producto 3 - Plantilla Excel personalizada" },
        { id: "bitacoraAsesorias", label: "Producto 4 - Bitácora de asesorías" },
        { id: "fichaEquipos", label: "Producto 5 - Ficha técnica de equipos" },
        { id: "informeImpacto", label: "Producto 6 - Informe de impacto (entrega final)" },
      ],
    },
    "taller-integrador-sb": {
      label: "Taller Integrador (Santa Bárbara)",
      activities: [
        { id: "equipoTaller", label: "0 - Conformación del equipo de trabajo" },
        { id: "diagnostico", label: "Producto 1 - Informe diagnóstico" },
        { id: "planAlfabetizacion", label: "Producto 2 - Plan de intervención" },
        { id: "plantillaExcel", label: "Producto 3 - Plantilla Excel personalizada" },
        { id: "bitacoraAsesorias", label: "Producto 4 - Bitácora de asesorías" },
        { id: "fichaEquipos", label: "Producto 5 - Ficha técnica de equipos" },
        { id: "informeImpacto", label: "Producto 6 - Informe de impacto (entrega final)" },
      ],
    },
    "taller-integrador-sb11": {
      label: "Taller Integrador (Santa Bárbara - Grado 11)",
      activities: [
        { id: "equipoTaller", label: "0 - Conformación del equipo de trabajo" },
        { id: "informeInfraestructura", label: "Producto 1 - Informe del estado de la infraestructura" },
        { id: "planMejora", label: "Producto 2 - Plan de mejora" },
        { id: "informeEjecucion", label: "Producto 3 - Informe de ejecución" },
        { id: "reporteCumplimiento", label: "Producto 4 - Reporte de cumplimiento (entrega final)" },
      ],
    },
  };

  var GRADES_STORAGE_KEY = "grades";

  // ── Normalización de nombres ─────────────────────────────────────────────────
  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Lectura / escritura en localStorage ─────────────────────────────────────
  function readJson(raw, fallback) {
    try { return raw ? (JSON.parse(raw) || fallback) : fallback; }
    catch (e) { return fallback; }
  }

  // localStorage se puede llenar (el panel admin hidrata datos de muchos aprendices
  // + al aprobar se embebe la solucion del banco). Un fallo de cuota
  // (QuotaExceededError) NO debe impedir el guardado: la nube (Firestore) es la
  // fuente autoritativa que lee el aprendiz. Guardamos local best-effort y seguimos
  // SIEMPRE con la sincronizacion a la nube.
  function safeSetLocal(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  }

  function getGradesKey(usernameKey) {
    var auth = window.portalAuth;
    if (!auth || !auth.getStudentStorageKey) return null;
    return auth.getStudentStorageKey(usernameKey, GRADES_STORAGE_KEY, { area: "app" });
  }

  // ── Sincronizacion con Firestore (sena_portal_grades) ───────────────────────
  // El admin escribe las notas (rule isAdmin); el aprendiz lee SOLO las suyas.
  // Reemplaza el archivo semilla publico data/grades_*.js (PII de menores).
  function gradesCloudDb() {
    var db = window._firebaseDb;
    return db && typeof db.cloudGetGrades === "function" ? db : null;
  }

  // Lectura para el lado APRENDIZ (solo pinta badges / bloquea su actividad;
  // nunca escribe notas). Devuelve el mapa de notas, o null si NO se pudo
  // leer -- en ese caso el llamador conserva el cache local en vez de
  // vaciarlo. cloudGetGrades devuelve {} tambien cuando la lectura falla, asi
  // que primero se intenta la lectura estricta; si esa falla se acepta la de
  // cloudGetGrades (que tiene failover a la replica de Drive) solo cuando trae
  // datos, porque su {} es ambiguo.
  // Optimizacion 2026-10-28: las insignias (renderGradeBadges) y el bloqueo
  // (reflectGradesIntoGuideState) pedian las notas por separado en la misma
  // carga de la guia. Se comparte UNA lectura durante FETCH_REUSE_MS. Solo se
  // reutilizan resultados confirmados (mapa de notas); un null (no se pudo
  // leer) no se guarda y la siguiente llamada vuelve a consultar.
  var FETCH_REUSE_MS = 15000;
  var gradesFetchMemo = {};
  function fetchGradesFromCloud(usernameKey) {
    var memo = gradesFetchMemo[usernameKey];
    if (memo && (memo.pending || (Date.now() - memo.at) < FETCH_REUSE_MS)) return memo.promise;
    var promise = fetchGradesFromCloudUncached(usernameKey);
    var entry = { promise: promise, pending: true, at: 0 };
    gradesFetchMemo[usernameKey] = entry;
    promise.then(function (result) {
      entry.pending = false;
      entry.at = Date.now();
      if (!result) delete gradesFetchMemo[usernameKey];
    });
    return promise;
  }
  function fetchGradesFromCloudUncached(usernameKey) {
    var db = gradesCloudDb();
    if (!db) return Promise.resolve(null);
    var legacy = function () {
      return Promise.resolve(db.cloudGetGrades(usernameKey)).then(function (all) {
        return all && typeof all === "object" && Object.keys(all).length ? all : null;
      });
    };
    var read = typeof db.cloudGetGradesStrict === "function"
      ? Promise.resolve(db.cloudGetGradesStrict(usernameKey)).then(function (r) {
          if (r && (r.status === "found" || r.status === "missing")) return r.grades || {};
          return legacy();
        })
      : Promise.resolve(db.cloudGetGrades(usernameKey));
    return read.catch(function () { return null; });
  }

  // ── Escritura de notas (panel admin) ────────────────────────────────────────
  // Antes: cada cambio guardaba el cache local COMPLETO del aprendiz y
  // cloudSaveGrades REEMPLAZABA el documento de la nube con el. Si la lectura
  // previa habia fallado, ese cache estaba vacio (cloudGetGrades devuelve {}
  // tambien ante un error) y una sola nota nueva borraba en la nube las notas
  // de todas las demas guias (hallazgo critico 2026-10-23; reproduccion en
  // memory/respaldos/guias-2026-10-23/hallazgos).
  // Ahora cada cambio es una OPERACION por actividad ({ family, set, del }) que
  // se encola y se aplica SOBRE UNA LECTURA FRESCA Y VERIFICADA de la nube
  // (cloudUpdateGradesStrict): lectura fallida/incompleta => cero escrituras;
  // otro equipo escribio en medio => se relee y se reaplica; solo viajan las
  // familias tocadas. La cola se persiste en este equipo, asi que un fallo no
  // pierde la nota: queda pendiente y se reintenta.
  // El debounce por aprendiz se conserva (varios clics seguidos = una
  // escritura), igual que el ajuste del 2026-07-24 (Guia 5, 4 notas seguidas).
  var GRADES_CLOUD_SYNC_DELAY_MS = 900;
  var GRADES_PENDING_STORAGE_KEY = "sena_portal_grades_pending_ops_v1";
  var GRADES_RETRY_DELAYS_MS = [15000, 30000, 60000, 120000, 300000];
  // Reintentos AUTOMATICOS por aprendiz (~24 min en total) antes de esperar a
  // una accion del instructor ("Reintentar ahora", volver la conexion o un
  // nuevo cambio): sin tope, un dia de cuota agotada repetia lecturas cada
  // 5 min por cada aprendiz con cambios pendientes mientras el panel siguiera
  // abierto. El cambio NO se descarta: sigue pendiente en este equipo.
  var GRADES_MAX_AUTO_RETRIES = 8;
  var gradesCloudSyncTimers = {};
  var gradesCloudSyncInFlight = {};
  var gradesRetryTimers = {};
  var gradesRetryAttempts = {};
  var gradesOpWaiters = {};
  var gradesOpSeq = 0;
  // setTimeout/clearTimeout no existen en el sandbox minimo de vm.createContext
  // que usan varios tests de este archivo (sin browser real): sin este
  // fallback, saveGradesToCloud reventaba ahi con "setTimeout is not defined".
  var scheduleTimeout = typeof setTimeout === "function"
    ? setTimeout
    : function (fn) { fn(); return 0; };
  var cancelTimeout = typeof clearTimeout === "function" ? clearTimeout : function () {};

  function loadPendingGradeOps() {
    try {
      var parsed = readJson(localStorage.getItem(GRADES_PENDING_STORAGE_KEY), {});
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  }
  var gradesPendingOps = loadPendingGradeOps();

  function persistPendingGradeOps() {
    var clean = {};
    Object.keys(gradesPendingOps).forEach(function (user) {
      if (gradesPendingOps[user] && gradesPendingOps[user].length) clean[user] = gradesPendingOps[user];
    });
    gradesPendingOps = clean;
    try {
      if (Object.keys(clean).length) localStorage.setItem(GRADES_PENDING_STORAGE_KEY, JSON.stringify(clean));
      else localStorage.removeItem(GRADES_PENDING_STORAGE_KEY);
    } catch (e) { /* sin almacenamiento: la cola sigue en memoria */ }
  }

  function applyGradeOp(all, op) {
    var family = Object.assign({}, all[op.family] || {});
    Object.keys(op.set || {}).forEach(function (k) { family[k] = op.set[k]; });
    (op.del || []).forEach(function (k) { delete family[k]; });
    all[op.family] = family;
    return all;
  }

  function withPendingOps(usernameKey, grades) {
    var all = JSON.parse(JSON.stringify(grades || {}));
    (gradesPendingOps[usernameKey] || []).forEach(function (op) { applyGradeOp(all, op); });
    return all;
  }

  function readLocalGrades(usernameKey) {
    var key = getGradesKey(usernameKey);
    return key ? readJson(localStorage.getItem(key), {}) : {};
  }

  function emitGradesSyncEvent(detail) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
    try { window.dispatchEvent(new CustomEvent("grades-sync-status", { detail: detail })); } catch (e) { /* no critico */ }
  }

  function describeGradesSyncFailure(result) {
    var reason = String((result && result.reason) || "");
    var status = String((result && result.status) || "");
    if (status === "unsupported") return "El modulo de la nube esta desactualizado. Recargue la pagina (Ctrl+F5) antes de calificar.";
    if (status === "conflict-exhausted") return "Otro equipo esta modificando las notas de este aprendiz al mismo tiempo.";
    if (reason === "incomplete") return "Las notas guardadas en la nube llegaron incompletas; no se escribio nada para no perder informacion.";
    if (reason === "http-429") return "La cuota diaria de Firestore esta agotada.";
    if (reason === "write-budget") return "Se alcanzo el limite diario de escrituras de este equipo.";
    if (reason === "http-401" || reason === "http-403") return "Firestore rechazo el permiso (la sesion de administrador no esta autorizada o expiro).";
    if (reason === "network") return "No hay conexion con Firestore.";
    if (/^http-5\d\d$/.test(reason) || reason === "http-408") return "El servidor de Firestore no respondio (falla temporal del servicio).";
    if (reason === "unavailable") return "Firestore no esta disponible (sin sesion en la nube o en pausa tras errores).";
    if (status === "read-failed") return "No se pudieron leer las notas actuales del aprendiz.";
    return "No se pudo confirmar el guardado en la nube.";
  }

  function settleGradeOps(ops, outcome) {
    ops.forEach(function (op) {
      var waiters = gradesOpWaiters[op.id] || [];
      delete gradesOpWaiters[op.id];
      waiters.forEach(function (resolve) { resolve(outcome); });
    });
  }

  function isRetryableGradesFailure(result) {
    if (!result || result.status === "aborted" || result.status === "unsupported") return false;
    return result.reason !== "incomplete";
  }

  function scheduleGradesRetry(usernameKey) {
    if (gradesRetryTimers[usernameKey]) return;
    var attempt = gradesRetryAttempts[usernameKey] || 0;
    if (attempt >= GRADES_MAX_AUTO_RETRIES) return;
    var delay = GRADES_RETRY_DELAYS_MS[Math.min(attempt, GRADES_RETRY_DELAYS_MS.length - 1)];
    gradesRetryAttempts[usernameKey] = attempt + 1;
    // Sin setTimeout real (sandbox de tests) no se programa nada: reintentar
    // en el acto entraria en un ciclo sincrono.
    if (typeof setTimeout !== "function") return;
    gradesRetryTimers[usernameKey] = setTimeout(function () {
      gradesRetryTimers[usernameKey] = null;
      flushGradesCloudSync(usernameKey);
    }, delay);
  }

  // -> Promise<{ ok, status, reason, message, pending }>
  function flushGradesCloudSync(usernameKey) {
    if (gradesCloudSyncTimers[usernameKey]) {
      cancelTimeout(gradesCloudSyncTimers[usernameKey]);
      gradesCloudSyncTimers[usernameKey] = null;
    }
    var ops = (gradesPendingOps[usernameKey] || []).slice();
    if (!ops.length) return Promise.resolve({ ok: true, status: "saved", reason: "no-changes", pending: 0 });
    if (gradesCloudSyncInFlight[usernameKey]) return gradesCloudSyncInFlight[usernameKey];
    var db = window._firebaseDb;
    if (!db || typeof db.cloudUpdateGradesStrict !== "function") {
      // NUNCA se cae a cloudSaveGrades: sin la lectura verificada no hay
      // forma segura de escribir. La nota queda pendiente en este equipo.
      var unsupported = { ok: false, status: "unsupported", reason: "no-strict-api", pending: ops.length };
      unsupported.message = describeGradesSyncFailure(unsupported);
      settleGradeOps(ops, unsupported);
      emitGradesSyncEvent({ usernameKey: usernameKey, result: unsupported });
      return Promise.resolve(unsupported);
    }
    var families = [];
    ops.forEach(function (op) { if (families.indexOf(op.family) === -1) families.push(op.family); });
    var run = Promise.resolve()
      .then(function () {
        return db.cloudUpdateGradesStrict(usernameKey, function (cloudGrades) {
          ops.forEach(function (op) { applyGradeOp(cloudGrades, op); });
          return { grades: cloudGrades, families: families };
        });
      })
      .catch(function () { return { ok: false, status: "write-failed", reason: "exception" }; })
      .then(function (result) {
        gradesCloudSyncInFlight[usernameKey] = null;
        var outcome = Object.assign({}, result || { ok: false, status: "write-failed", reason: "unknown" });
        if (outcome.ok) {
          var sentIds = ops.map(function (op) { return op.id; });
          gradesPendingOps[usernameKey] = (gradesPendingOps[usernameKey] || []).filter(function (op) {
            return sentIds.indexOf(op.id) === -1;
          });
          persistPendingGradeOps();
          gradesRetryAttempts[usernameKey] = 0;
          // El cache pasa a ser la version CONFIRMADA de la nube (+ lo que siga
          // pendiente), no lo que este equipo creia tener.
          if (outcome.grades) {
            rememberVerifiedGrades(usernameKey, "found", outcome.grades);
            setLocalGradesCache(usernameKey, withPendingOps(usernameKey, outcome.grades));
          }
          outcome.message = "";
        } else {
          outcome.message = describeGradesSyncFailure(outcome);
          if (isRetryableGradesFailure(outcome)) scheduleGradesRetry(usernameKey);
        }
        outcome.pending = (gradesPendingOps[usernameKey] || []).length;
        delete outcome.grades;
        settleGradeOps(ops, outcome);
        emitGradesSyncEvent({ usernameKey: usernameKey, result: outcome });
        // Llegaron mas cambios mientras esta escritura estaba en vuelo: sincroniza de nuevo.
        if (outcome.ok && outcome.pending) flushGradesCloudSync(usernameKey);
        return outcome;
      });
    gradesCloudSyncInFlight[usernameKey] = run;
    return run;
  }

  function flushAllPendingGradesCloudSync() {
    Object.keys(gradesPendingOps).forEach(flushGradesCloudSync);
  }

  // Reintento manual (boton del panel / al volver la conexion).
  function retryPendingGradesSync(usernameKey) {
    var users = usernameKey ? [usernameKey] : Object.keys(gradesPendingOps);
    return Promise.all(users.map(function (user) {
      if (gradesRetryTimers[user]) { cancelTimeout(gradesRetryTimers[user]); gradesRetryTimers[user] = null; }
      gradesRetryAttempts[user] = 0;
      return flushGradesCloudSync(user);
    }));
  }

  // Actividades con un cambio aun NO confirmado en la nube, como
  // { "familia": { actividad: true } }: la grilla las marca al repintar para
  // que una nota pendiente nunca se vea igual que una guardada.
  function getPendingGradeActivities(usernameKey) {
    var out = {};
    (gradesPendingOps[usernameKey] || []).forEach(function (op) {
      Object.keys(op.set || {}).concat(op.del || []).forEach(function (k) {
        var act = String(k).split(":")[0];
        out[op.family] = out[op.family] || {};
        out[op.family][act] = true;
      });
    });
    return out;
  }

  function getPendingGradesCount(usernameKey) {
    if (usernameKey) return (gradesPendingOps[usernameKey] || []).length;
    return Object.keys(gradesPendingOps).reduce(function (n, user) { return n + gradesPendingOps[user].length; }, 0);
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flushAllPendingGradesCloudSync);
    window.addEventListener("beforeunload", flushAllPendingGradesCloudSync);
    window.addEventListener("online", function () { retryPendingGradesSync(); });
  }
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) flushAllPendingGradesCloudSync();
    });
  }

  // Encola una operacion, la refleja en el cache local (para que la grilla la
  // muestre al instante) y programa la escritura. -> Promise del resultado REAL.
  function queueGradeOp(usernameKey, family, set, del) {
    if (!usernameKey || !family) {
      return Promise.resolve({ ok: false, status: "aborted", reason: "invalid-args", message: "Faltan datos del aprendiz o de la guia." });
    }
    gradesOpSeq += 1;
    var op = {
      id: Date.now().toString(36) + "-" + gradesOpSeq,
      family: String(family),
      set: set || {},
      del: del || [],
      at: new Date().toISOString(),
    };
    if (!gradesPendingOps[usernameKey]) gradesPendingOps[usernameKey] = [];
    gradesPendingOps[usernameKey].push(op);
    persistPendingGradeOps();
    setLocalGradesCache(usernameKey, applyGradeOp(readLocalGrades(usernameKey), op));
    var done = new Promise(function (resolve) {
      gradesOpWaiters[op.id] = (gradesOpWaiters[op.id] || []).concat([resolve]);
    });
    if (gradesCloudSyncTimers[usernameKey]) cancelTimeout(gradesCloudSyncTimers[usernameKey]);
    gradesCloudSyncTimers[usernameKey] = scheduleTimeout(function () {
      flushGradesCloudSync(usernameKey);
    }, GRADES_CLOUD_SYNC_DELAY_MS);
    return done;
  }

  function setLocalGradesCache(usernameKey, allGrades) {
    var key = getGradesKey(usernameKey);
    if (key) safeSetLocal(key, JSON.stringify(allGrades || {}));
  }

  // Reemplaza el cache local con datos YA VERIFICADOS de la nube. Las
  // operaciones aun pendientes se vuelven a aplicar encima para que la grilla
  // no "pierda" una nota que todavia no llego a la nube.
  function setAllStudentGrades(usernameKey, allGrades) {
    if (!allGrades || typeof allGrades !== "object" || Array.isArray(allGrades)) return;
    setLocalGradesCache(usernameKey, withPendingOps(usernameKey, allGrades));
  }

  // Panel admin: lee la nube de forma ESTRICTA. Solo si la lectura se confirma
  // (found / missing) se actualiza el cache. -> Promise<{ status, grades, reason, message }>
  // status "error": no se pudo leer -- grades es null y el cache NO se toca.
  // Optimizacion 2026-10-28: ultima lectura VERIFICADA (found/missing) por
  // aprendiz, o la version confirmada por la nube tras una escritura exitosa.
  // La grilla del panel la reutiliza al cambiar de guia dentro de una ficha
  // (opts.maxAgeMs) en vez de releer los 30 documentos: cada doc de notas ya
  // trae TODAS las guias. No afecta a la proteccion: toda escritura sigue
  // releyendo la nube con precondicion (cloudUpdateGradesStrict). Una lectura
  // fallida borra lo recordado (nunca se reutiliza algo no verificado).
  var verifiedGradeReads = {};
  function rememberVerifiedGrades(usernameKey, status, grades) {
    verifiedGradeReads[usernameKey] = { at: Date.now(), status: status, grades: JSON.parse(JSON.stringify(grades || {})) };
  }

  function refreshStudentGradesFromCloud(usernameKey, opts) {
    var maxAgeMs = Number(opts && opts.maxAgeMs) || 0;
    var recent = verifiedGradeReads[usernameKey];
    if (maxAgeMs > 0 && recent && (Date.now() - recent.at) < maxAgeMs) {
      var reusedView = withPendingOps(usernameKey, recent.grades);
      setLocalGradesCache(usernameKey, reusedView);
      return Promise.resolve({ status: recent.status, grades: reusedView, reason: "", message: "", reused: true });
    }
    var db = window._firebaseDb;
    if (!db || typeof db.cloudGetGradesStrict !== "function") {
      var unsupported = { status: "error", grades: null, reason: "no-strict-api" };
      unsupported.message = describeGradesSyncFailure({ status: "unsupported" });
      return Promise.resolve(unsupported);
    }
    return Promise.resolve(db.cloudGetGradesStrict(usernameKey))
      .catch(function () { return { status: "error", reason: "exception" }; })
      .then(function (r) {
        if (r && (r.status === "found" || r.status === "missing")) {
          rememberVerifiedGrades(usernameKey, r.status, r.grades || {});
          var view = withPendingOps(usernameKey, r.grades || {});
          setLocalGradesCache(usernameKey, view);
          return { status: r.status, grades: view, reason: "", message: "" };
        }
        delete verifiedGradeReads[usernameKey];
        var failed = { status: "error", grades: null, reason: (r && r.reason) || "unknown" };
        failed.message = describeGradesSyncFailure({ status: "read-failed", reason: failed.reason });
        return failed;
      });
  }

  // Compatibilidad: firma historica. Ya no envia el mapa completo.
  function saveGradesToCloud(usernameKey) {
    return flushGradesCloudSync(usernameKey);
  }

  function getStudentGrades(usernameKey, guideFamily) {
    var all = readLocalGrades(usernameKey);
    return guideFamily ? (all[guideFamily] || {}) : all;
  }

  // Reemplaza las notas de UNA familia por `gradesObj` (lo usa la carga por
  // Excel, que ya parte de la familia leida de la nube). Las demas familias
  // no se tocan.
  function setStudentGrades(usernameKey, guideFamily, gradesObj) {
    if (!getGradesKey(usernameKey)) return Promise.resolve({ ok: false, status: "aborted", reason: "no-storage-key" });
    var next = Object.assign({}, gradesObj);
    var current = getStudentGrades(usernameKey, guideFamily);
    var del = Object.keys(current).filter(function (k) { return !(k in next); });
    return queueGradeOp(usernameKey, guideFamily, next, del);
  }

  function setStudentActivityGrade(usernameKey, guideFamily, activityId, grade) {
    if (!getGradesKey(usernameKey)) return Promise.resolve({ ok: false, status: "aborted", reason: "no-storage-key" });
    if (grade === "" || grade === null || grade === undefined) {
      return queueGradeOp(usernameKey, guideFamily, {}, [activityId]);
    }
    var set = {};
    set[activityId] = grade;
    return queueGradeOp(usernameKey, guideFamily, set, []);
  }

  // Admin: fija la nota Y embebe (o limpia) la solucion modelo dentro del doc de notas
  // del aprendiz, en UNA sola escritura. La solucion solo se embebe cuando la nota es "A".
  // El aprendiz solo lee su propio doc, asi ve unicamente la solucion de SU actividad
  // aprobada; el banco maestro nunca llega a su cliente.
  // -> Promise<{ ok, status, reason, message }> con el resultado REAL en la nube.
  function setStudentActivityGradeAndSolution(usernameKey, guideFamily, activityId, grade, solutionObj) {
    if (!getGradesKey(usernameKey)) return Promise.resolve({ ok: false, status: "aborted", reason: "no-storage-key" });
    var solKey = activityId + ":solution";
    var gradedAtKey = activityId + ":gradedAt";
    var set = {};
    var del = [];
    if (grade === "" || grade === null || grade === undefined) {
      del.push(activityId, gradedAtKey);
    } else {
      set[activityId] = grade;
      set[gradedAtKey] = new Date().toISOString();
    }
    if (grade === "A" && solutionObj && typeof solutionObj === "object" && Object.keys(solutionObj).length) {
      set[solKey] = solutionObj;
    } else {
      del.push(solKey);   // sin "A" => sin solucion embebida
    }
    return queueGradeOp(usernameKey, guideFamily, set, del);
  }

  // Admin (re-sincronizacion): embebe la solucion modelo en una nota "A" YA
  // existente SIN tocar la nota ni su fecha de calificacion (gradedAt). Para
  // notas puestas antes de importar el banco a Firestore, o cuya solucion
  // embebida quedo vieja porque el banco crecio despues (ej. el checklist de
  // competencias digitales agregado el jul-15).
  // Devuelve true si encolo el cambio; el resultado en la nube se consulta con
  // flushGradesCloudSync(usernameKey).
  function embedStudentActivitySolution(usernameKey, guideFamily, activityId, solutionObj) {
    if (!getGradesKey(usernameKey)) return false;
    var fam = getStudentGrades(usernameKey, guideFamily);
    if (!fam || fam[activityId] !== "A") return false;
    if (!solutionObj || typeof solutionObj !== "object" || !Object.keys(solutionObj).length) return false;
    var set = {};
    set[activityId + ":solution"] = solutionObj;
    queueGradeOp(usernameKey, guideFamily, set, []);
    return true;
  }

  function setStudentActivityObservation(usernameKey, guideFamily, activityId, obs) {
    if (!getGradesKey(usernameKey)) return Promise.resolve({ ok: false, status: "aborted", reason: "no-storage-key" });
    var obsKey = activityId + ":obs";
    if (!obs || !String(obs).trim()) return queueGradeOp(usernameKey, guideFamily, {}, [obsKey]);
    var set = {};
    set[obsKey] = String(obs).trim().slice(0, 500);
    return queueGradeOp(usernameKey, guideFamily, set, []);
  }

  function getStudentActivityObservation(usernameKey, guideFamily, activityId) {
    var key = getGradesKey(usernameKey);
    if (!key) return "";
    var all = readJson(localStorage.getItem(key), {});
    return String((all[guideFamily] || {})[activityId + ":obs"] || "");
  }

  // ── Lectura para el aprendiz activo ─────────────────────────────────────────
  function getMyGrades(guideFamily) {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return {};
    return getStudentGrades(session.usernameKey, guideFamily);
  }

  // ── Punto de montaje del badge ──────────────────────────────────────────────
  // Resuelve dónde colocar el badge probando convenciones de id hasta hallar un
  // elemento existente. El badge se inserta como hermano ANTERIOR del contenedor,
  // así queda visible aunque el contenedor (p. ej. un *Status) esté display:none.
  function resolveGradeMount(activityId, explicitSelector) {
    var selectors = [];
    if (explicitSelector) selectors.push(explicitSelector);
    selectors.push(
      "#" + activityId + "GradeMount",
      "#" + activityId + "DeadlineControls",
      "#" + activityId + "DeliveryControls",
      "#" + activityId + "Status",
      '[data-act-grade="' + activityId + '"]',
      // Ultimo recurso: el contenedor de confirmacion de entrega que
      // activity_standard.js pone en cada actividad de tipo "file" (unica
      // ancla estatica que tienen, p. ej. los retos de la guia de Python).
      '[data-act-std-delivery="' + activityId + '"]'
    );
    for (var i = 0; i < selectors.length; i++) {
      var el = null;
      try { el = document.querySelector(selectors[i]); } catch (e) { el = null; }
      if (el) return el;
    }
    return null;
  }

  function formatGradeDate(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }

  function escapeHtmlLocal(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // Construye el badge. Solo Aprobado (A) y No aprobado (D) — las únicas notas que
  // registra el admin. Sin nota => devuelve null (no se muestra nada).
  function buildGradeBadge(grade, activityId, gradedAtIso, obs) {
    var badgeClass, icon, html;
    var fecha = formatGradeDate(gradedAtIso);
    var fechaHtml = fecha ? '<br><span class="grade-badge-date">Calificado el ' + fecha + '</span>' : "";
    // Observacion que el instructor eligio del banco de comentarios o escribio a
    // mano al calificar (setStudentActivityObservation, panel Calificaciones).
    // Opcional: sin observacion, el badge se ve igual que antes. Se muestra en
    // AMBAS notas -- hasta 2026-09-15 solo se pintaba en "No aprobado", asi que
    // un comentario sobre una actividad aprobada se guardaba pero el aprendiz
    // nunca lo veia.
    var obsHtml = obs ? '<br><span class="grade-badge-obs">' + escapeHtmlLocal(obs) + "</span>" : "";
    if (grade === "A") {
      badgeClass = "activity-grade-badge activity-grade-badge--aprobado";
      icon = "✅";
      html = "<strong>¡Aprobado!</strong> Buen trabajo. 🎉" + obsHtml + fechaHtml;
    } else if (grade === "D") {
      badgeClass = "activity-grade-badge activity-grade-badge--desaprobado";
      icon = "❌";
      html = "<strong>No aprobado.</strong> Habla con tu instructor para reforzar esta actividad." + obsHtml + fechaHtml;
    } else {
      return null;
    }
    var badge = document.createElement("div");
    badge.className = badgeClass;
    badge.setAttribute("data-grade-act", activityId);
    badge.innerHTML =
      '<span class="grade-badge-icon">' + icon + '</span>' +
      '<span class="grade-badge-text">' + html + '</span>';
    return badge;
  }

  // ── Renderizado de badges en la guía ────────────────────────────────────────
  // options: { guideFamily: string, activities: [{ activityId, mountSelector }] }
  // Lee las notas del aprendiz desde Firestore (las escribe el admin) y las cachea
  // en localStorage para reintentos/offline. Ya NO usa archivo semilla publico.
  async function renderGradeBadges(options) {
    var opts = options || {};
    var guideFamily = String(opts.guideFamily || "");
    var activities = Array.isArray(opts.activities) ? opts.activities : [];

    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;

    // Cache local primero; luego Firestore (fuente de verdad escrita por el admin).
    var grades = getStudentGrades(session.usernameKey, guideFamily);
    var cloud = await fetchGradesFromCloud(session.usernameKey);
    if (cloud && typeof cloud === "object") {
      setAllStudentGrades(session.usernameKey, cloud);
      grades = cloud[guideFamily] || {};
    }

    activities.forEach(function (cfg) {
      var grade = grades[cfg.activityId];
      // Solo notas reales (Aprobado / No aprobado). Sin nota => no se monta badge.
      if (grade !== "A" && grade !== "D") return;

      var mount = resolveGradeMount(cfg.activityId, cfg.mountSelector);
      if (!mount || !mount.parentNode) return;

      var parent = mount.parentNode;
      // Evitar duplicados del mismo badge para esta actividad.
      if (parent.querySelector('.activity-grade-badge[data-grade-act="' + cfg.activityId + '"]')) return;

      var badge = buildGradeBadge(grade, cfg.activityId, grades[cfg.activityId + ":gradedAt"], grades[cfg.activityId + ":obs"]);
      if (badge) parent.insertBefore(badge, mount);
    });
  }

  // ── Mapa archivo de guía → familia de calificaciones ────────────────────────
  // Cada página de guía (cargada con guia_template.js) declara aquí su familia para
  // que el badge se monte solo, sin tener que cablear cada guía a mano.
  var GUIDE_FAMILY_BY_FILE = {
    "grupo-10a-guia-01-induccion.html": "guia-01-induccion",
    "grupo-10b-guia-01-induccion.html": "guia-01-induccion",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "guia-02-herramientas",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "guia-02-herramientas",
    "grupo-10a-guia-02-actividad-4-formulario.html": "guia-02-herramientas",
    "grupo-10b-guia-02-actividad-4-formulario.html": "guia-02-herramientas",
    "grupo-10a-guia-02-actividad-322-matriz.html": "guia-02-herramientas",
    "grupo-10b-guia-02-actividad-322-matriz.html": "guia-02-herramientas",
    "grupo-10a-guia-02-ficha-caso.html": "guia-02-herramientas",
    "grupo-10b-guia-02-ficha-caso.html": "guia-02-herramientas",
    "grupo-10a-guia-03-planificar-informacion.html": "guia-03-planificar-10",
    "grupo-10b-guia-03-planificar-informacion.html": "guia-03-planificar-10",
    "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html": "guia-04-ciberseguridad",
    "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html": "guia-04-ciberseguridad",
    "grupo-10a-guia-05-documentar-gestion-informacion.html": "guia-05-documentar-gestion",
    "grupo-10b-guia-05-documentar-gestion-informacion.html": "guia-05-documentar-gestion",
    "grupo-10a-guia-06-mantener-equipos.html": "guia-06-mantener-equipos",
    "grupo-10b-guia-06-mantener-equipos.html": "guia-06-mantener-equipos",
    // MANT-2026-10-22:START (generado por generar_guias_mantenimiento.py)
    "grupo-10a-guia-07-mantenimiento-integral.html": "guia-mant-rap02",
    "grupo-10b-guia-07-mantenimiento-integral.html": "guia-mant-rap02",
    "grupo-10a-guia-08-verificar-operacion.html": "guia-mant-rap03",
    "grupo-10b-guia-08-verificar-operacion.html": "guia-mant-rap03",
    "santa-barbara-10a-guia-05-preparar-mantenimiento.html": "guia-06-mantener-equipos",
    "santa-barbara-10b-guia-05-preparar-mantenimiento.html": "guia-06-mantener-equipos",
    "santa-barbara-10a-guia-06-mantenimiento-integral.html": "guia-mant-rap02",
    "santa-barbara-10b-guia-06-mantenimiento-integral.html": "guia-mant-rap02",
    "santa-barbara-10a-guia-07-verificar-operacion.html": "guia-mant-rap03",
    "santa-barbara-10b-guia-07-verificar-operacion.html": "guia-mant-rap03",
    // MANT-2026-10-22:END
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11a-guia-06-planificar-informacion.html": "guia-06-planificar",
    "grupo-11b-guia-06-planificar-informacion.html": "guia-06-planificar",
    "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "guia-07-ciberseguridad",
    "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia-07-ciberseguridad",
    "grupo-11a-guia-08-documentar-gestion-informacion.html": "guia-08-documentar-gestion",
    "grupo-11b-guia-08-documentar-gestion-informacion.html": "guia-08-documentar-gestion",
    "santa-barbara-10a-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10b-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10a-guia-03-redes-rap02.html": "guia-redes-rap02",
    "santa-barbara-10b-guia-03-redes-rap02.html": "guia-redes-rap02",
    "santa-barbara-10a-guia-04-redes-rap03.html": "guia-redes-rap03",
    "santa-barbara-10b-guia-04-redes-rap03.html": "guia-redes-rap03",
    "santa-barbara-guia-python.html": "guia-python",
    "grupo-10a-guia-04-taller-integrador.html": "taller-integrador-jfk",
    "grupo-10b-guia-04-taller-integrador.html": "taller-integrador-jfk",
    "santa-barbara-10a-guia-04-taller-integrador.html": "taller-integrador-sb",
    "santa-barbara-10b-guia-04-taller-integrador.html": "taller-integrador-sb",
    "grupo-11a-guia-09-taller-integrador.html": "taller-integrador-sb11",
    "grupo-11b-guia-09-taller-integrador.html": "taller-integrador-sb11",
  };

  // ── Familias declaradas por la propia guía (fuente única) ───────────────────
  // Una guía que ya se registra en js/guide_declarations.js puede declarar ahí
  // su `gradeFamily`; esa declaración se deposita en un buzón global
  // (window.__portalGuideGradeFamilies) y se absorbe aquí. Sirve para NO tener
  // que mantener dos listados: sin esto, una guía nueva queda invisible en el
  // módulo de Calificaciones sin ningún error (pasó con las Guias 10/11/12 de
  // John F. Kennedy, adaptadas de Santa Barbara: estaban en FICHA_MAP,
  // guide_declarations.js y guia_router.js, pero no en el mapa de arriba, asi
  // que el desplegable de guia del panel las descartaba en silencio).
  //
  // El buzón es un objeto global y no una llamada directa a proposito: el orden
  // de carga de los dos archivos NO es el mismo en todas las paginas
  // (activity_grades.js carga ANTES que guide_declarations.js en las guias, y
  // DESPUES en el panel admin), por lo que ninguno de los dos puede llamar al
  // otro al cargarse. Por eso la absorcion es perezosa: ocurre en el getter de
  // GUIDE_FAMILY_BY_FILE y en resolveGuideFamily, siempre en tiempo de lectura.
  //
  // El mapa explícito de arriba SIEMPRE manda: una familia ya existente nunca se
  // renombra ni se pisa (las llaves de familia estan persistidas en Firestore,
  // dentro de sena_portal_grades).
  var _absorbedFamilyCount = -1;
  function absorbDeclaredGuideFamilies() {
    var box = (typeof window !== "undefined" && window.__portalGuideGradeFamilies) || null;
    if (!box) return;
    var files = Object.keys(box);
    if (files.length === _absorbedFamilyCount) return;   // nada nuevo desde la ultima vez
    _absorbedFamilyCount = files.length;
    files.forEach(function (file) {
      if (!GUIDE_FAMILY_BY_FILE[file] && box[file]) GUIDE_FAMILY_BY_FILE[file] = box[file];
    });
  }

  function resolveGuideFamily(pageFile) {
    absorbDeclaredGuideFamilies();
    return GUIDE_FAMILY_BY_FILE[String(pageFile || "")] || "";
  }

  // ── Banco de respuestas: relleno de actividades aprobadas y vacías ──────────
  // Cuando una actividad fue APROBADA (A) y el aprendiz dejó el/los campo(s) vacío(s),
  // se rellenan con la solución que el admin EMBEBIÓ en las notas del aprendiz al aprobar
  // ({actId}:solution dentro de sena_portal_grades). El banco maestro nunca llega al
  // cliente: el aprendiz solo lee su propia nota, así ve únicamente SU solución.
  // Si el aprendiz YA respondió, su respuesta se respeta (no se sobrescribe).
  // El relleno dispara `input`/`change` para que la guía guarde y sincronice como siempre.
  function applyApprovedSolutionsForFamily(family) {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return false;

    // Las soluciones llegan EMBEBIDAS en las notas del aprendiz ({actId}:solution), que el
    // admin copia al aprobar. El banco maestro NUNCA se carga aqui: el aprendiz solo puede
    // ver la respuesta de su propia actividad aprobada, jamas el banco completo.
    var grades = getStudentGrades(session.usernameKey, family);
    var filledAny = false;
    Object.keys(grades).forEach(function (activityId) {
      if (activityId.indexOf(":solution") !== -1) return;  // saltar las llaves de payload
      if (grades[activityId] !== "A") return;              // solo actividades aprobadas
      var fields = grades[activityId + ":solution"];
      if (!fields || typeof fields !== "object") return;
      Object.keys(fields).forEach(function (storeKey) {
        var text = fields[storeKey];
        if (text == null || String(text) === "") return;
        var matches = [];
        try { matches = document.querySelectorAll('[data-store="' + String(storeKey).replace(/"/g, '\\"') + '"]'); }
        catch (e) { matches = []; }
        if (!matches.length) return;                   // campo no existe (p. ej. archivo o fila ausente)

        // Radios: varias opciones comparten el MISMO data-store (una por valor).
        // Asignar .value no selecciona nada -- hay que encontrar la opcion cuyo
        // value coincide con la solucion y marcarla .checked.
        if (matches[0].type === "radio") {
          var alreadyAnswered = Array.prototype.some.call(matches, function (r) { return r.checked; });
          if (alreadyAnswered) return;                 // respeta la respuesta del aprendiz
          var target = Array.prototype.filter.call(matches, function (r) { return r.value === String(text); })[0];
          if (!target) return;
          target.checked = true;
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
          filledAny = true;
          return;
        }

        var el = matches[0];
        var cur = (el.value != null ? String(el.value) : "").trim();
        if (cur.length > 0) return;                    // respeta la respuesta del aprendiz
        el.value = String(text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filledAny = true;
      });
    });
    return filledAny;
  }

  // Auto-render para guías basadas en guia_template.js. Lo invoca initGuiaTemplateShell
  // después de inyectar el contenido. Resuelve el mount de cada actividad por convención,
  // y rellena desde el banco las actividades aprobadas que quedaron vacías.
  async function autoRenderForFile(pageFile) {
    var family = resolveGuideFamily(pageFile);
    if (!family) return;
    var entry = GRADE_CATALOG[family];
    if (!entry || !Array.isArray(entry.activities)) return;
    var activities = [];
    entry.activities.forEach(function (a) {
      activities.push({ activityId: a.id, mountSelector: a.mount || null });
      // Actividades "gemelas" que comparten la misma columna de nota (ver
      // aliasIds/aliasMounts en la declaracion, ej. sopaletras311/relaciona311):
      // el mismo badge se monta TAMBIEN en la tarjeta de cada alias.
      (a.aliasMounts || []).forEach(function (sel) {
        activities.push({ activityId: a.id, mountSelector: sel });
      });
    });
    await renderGradeBadges({ guideFamily: family, activities: activities });
    applyApprovedSolutionsForFamily(family);
  }

  // ── Reflejar la calificacion en el `state` propio de cada guia ──────────────
  // Muchas guias (Induccion, Guia 2, Guia 3, Guia 6, Redes RAP01) NO usan
  // ActivityStandard.mountActivities() -- tienen su PROPIO sistema de guardado
  // (state + saveState + funciones applyXLock por actividad, ya escritas para
  // bloquear cuando el APRENDIZ hace clic en "Guardar respuestas"). Pero si el
  // ADMIN aprueba/reprueba una actividad que el aprendiz nunca guardo asi, ese
  // "-locked" nunca se pone: el campo sigue editable y "Tu control de avance"
  // (que revisa justamente ese flag) la marca "Pendiente" para siempre.
  //
  // Esta funcion es GENERICA y reusable desde cualquier guia: trae la nota real
  // de Firestore, y para cada actividad calificada fija {actId}-locked (o
  // {actId}-delivery si es tipo "file") en el `state` de la guia -- exactamente
  // el mismo flag que ya usa el applyXLock() propio de esa actividad (si existe,
  // se le pasa en `options.lockAppliers` y esta funcion lo invoca para que el
  // campo tambien quede visualmente bloqueado, sin reescribir esa logica).
  //
  // options: {
  //   guideFamily: string,          // familia en GRADE_CATALOG (ej. "guia-02-herramientas")
  //   pageFile: string,             // PAGE_FILE real (el registrado en guide_declarations.js)
  //   getState: () => object,       // devuelve el `state` actual de la guia
  //   lockAppliers: { [activityId]: () => void },  // funciones applyXLock ya existentes en la guia
  //   onChanged: () => void,        // se llama SOLO si algo cambio: debe guardar+sincronizar+refrescar avance
  // }
  // Nota efectiva de una actividad del catalogo: primero su propio id, y si no
  // tiene, cae a cualquiera de sus aliasIds. Esto evita perder una nota real que
  // haya quedado guardada bajo el id de un alias ANTES de que dos actividades se
  // fusionaran en una sola columna (ej. matriz322/fichaCaso, fusionadas 2026-07-09).
  function resolveGradeValue(grades, act) {
    var direct = grades[act.id];
    if (direct === "A" || direct === "D") return direct;
    var aliasIds = Array.isArray(act.aliasIds) ? act.aliasIds : [];
    for (var i = 0; i < aliasIds.length; i++) {
      var aliasGrade = grades[aliasIds[i]];
      if (aliasGrade === "A" || aliasGrade === "D") return aliasGrade;
    }
    return direct;
  }

  async function reflectGradesIntoGuideState(options) {
    var opts = options || {};
    var guideFamily = String(opts.guideFamily || "");
    var entry = GRADE_CATALOG[guideFamily];
    if (!entry || !Array.isArray(entry.activities) || typeof opts.getState !== "function") return;

    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;

    var std = window.ActivityStandard;
    var config = std && typeof std.getConfigForGuide === "function" ? std.getConfigForGuide(opts.pageFile) : null;
    var typeById = {};
    (config && Array.isArray(config.activities) ? config.activities : []).forEach(function (a) {
      typeById[a.id] = a.type;
    });

    var state = opts.getState();
    var lockAppliers = opts.lockAppliers || {};

    function applyGrades(grades) {
      var changedHere = false;
      entry.activities.forEach(function (act) {
        var grade = resolveGradeValue(grades, act);
        if (grade !== "A" && grade !== "D") return;
        // Actividades "gemelas" (aliasIds): comparten esta misma nota/columna
        // (ej. relaciona311 se califica junto con sopaletras311) -- tambien
        // reciben su propio {id}-locked para que "Tu control de avance" las
        // cuente como hechas, no solo la actividad "duena" de la nota.
        var idsToFlag = [act.id].concat(Array.isArray(act.aliasIds) ? act.aliasIds : []);
        idsToFlag.forEach(function (flagId) {
          var type = typeById[flagId] || "form";
          if (type === "file") {
            if (!state[flagId + "-delivery"] || state[flagId + "-delivery"].status !== "delivered") {
              state[flagId + "-delivery"] = {
                status: "delivered",
                submittedAt: grades[act.id + ":gradedAt"] || new Date().toISOString(),
              };
              changedHere = true;
            }
          } else if (state[flagId + "-locked"] !== true) {
            state[flagId + "-locked"] = true;
            changedHere = true;
          }
          if (typeof lockAppliers[flagId] === "function") {
            try { lockAppliers[flagId](); } catch (e) { /* no critico */ }
          }
        });
      });
      return changedHere;
    }

    // Pase INMEDIATO con el cache local (si ya se califico en una visita
    // anterior, getStudentGrades lo devuelve al instante, sin red). Sin esto,
    // una actividad calificada quedaba editable durante la ventana entre
    // "la pagina carga" y "termina de resolver cloudGetGrades" -- suficiente
    // para que el aprendiz alcanzara a escribir antes de que se bloqueara.
    var changedFromCache = applyGrades(getStudentGrades(session.usernameKey, guideFamily));
    applyApprovedSolutionsForFamily(guideFamily);
    if (changedFromCache && typeof opts.onChanged === "function") {
      try { opts.onChanged(); } catch (e) { /* no critico */ }
    }

    var db = window._firebaseDb;
    if (!db || typeof db.cloudGetGrades !== "function") return;
    // null = no se pudo leer: se conserva el cache (no se interpreta como "sin notas").
    var cloud = await fetchGradesFromCloud(session.usernameKey);
    if (!cloud) return;
    var grades = cloud[guideFamily] || {};

    // Refresca el cache local con lo recien traido de la nube (igual que hace
    // renderGradeBadges) -- sin esto, applyApprovedSolutionsForFamily seguiria
    // leyendo el cache viejo y nunca veria las soluciones ":solution" que el
    // admin acaba de embeber al calificar desde otro equipo.
    if (cloud && typeof cloud === "object") setAllStudentGrades(session.usernameKey, cloud);

    var changed = applyGrades(grades);
    applyApprovedSolutionsForFamily(guideFamily);
    if (changed && typeof opts.onChanged === "function") {
      try { opts.onChanged(); } catch (e) { /* no critico */ }
    }
  }

  // ── API pública ──────────────────────────────────────────────────────────────
  window.activityGradesManager = {
    GRADE_CATALOG: GRADE_CATALOG,
    resolveGuideFamily: resolveGuideFamily,
    autoRenderForFile: autoRenderForFile,
    applyApprovedSolutionsForFamily: applyApprovedSolutionsForFamily,
    reflectGradesIntoGuideState: reflectGradesIntoGuideState,
    resolveGradeValue: resolveGradeValue,
    getStudentGrades: getStudentGrades,
    setAllStudentGrades: setAllStudentGrades,
    refreshStudentGradesFromCloud: refreshStudentGradesFromCloud,
    applyStudentGradeChanges: queueGradeOp,
    flushGradesCloudSync: flushGradesCloudSync,
    retryPendingGradesSync: retryPendingGradesSync,
    getPendingGradesCount: getPendingGradesCount,
    getPendingGradeActivities: getPendingGradeActivities,
    describeGradesSyncFailure: describeGradesSyncFailure,
    setStudentGrades: setStudentGrades,
    setStudentActivityGrade: setStudentActivityGrade,
    setStudentActivityGradeAndSolution: setStudentActivityGradeAndSolution,
    embedStudentActivitySolution: embedStudentActivitySolution,
    setStudentActivityObservation: setStudentActivityObservation,
    getStudentActivityObservation: getStudentActivityObservation,
    getMyGrades: getMyGrades,
    renderGradeBadges: renderGradeBadges,
  };

  // GUIDE_FAMILY_BY_FILE se expone como GETTER (no como propiedad normal) para
  // que los 8 consumidores que ya hacen `mgr.GUIDE_FAMILY_BY_FILE[archivo]`
  // (admin_usuarios, activity_standard, improvement_plans, portal_home,
  // student_summary, script_taller_integrador...) reciban las familias
  // declaradas por las guias SIN tener que cambiar ni una linea en ellos:
  // la absorcion ocurre en el momento de la lectura, cuando guide_declarations.js
  // ya corrio, sea cual sea el orden de carga de esa pagina.
  Object.defineProperty(window.activityGradesManager, "GUIDE_FAMILY_BY_FILE", {
    enumerable: true,
    get: function () {
      absorbDeclaredGuideFamilies();
      return GUIDE_FAMILY_BY_FILE;
    },
  });
})();
