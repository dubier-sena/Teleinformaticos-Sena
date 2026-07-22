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
      ],
    },
    "guia-03-planificar-10": {
      label: "Guía 3 — Implementar componentes (grado 10)",
      activities: [
        { id: "bitacora311",     label: "3.1.1 Bitácora individual de análisis" },
        { id: "socializacion312", label: "3.1.2 Socialización del análisis" },
        { id: "tabla321",        label: "3.2.1 Tabla resumen" },
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
        { id: "guia5-331", label: "3.3.1 Evidencias de herramientas", mount: "#guia5331DeadlineControls" },
        { id: "guia5-341", label: "3.4.1 Informe final integrador", mount: "#guia5341DeadlineControls" },
      ],
    },
    "guia-06-planificar": {
      label: "Guía 6 — Implementar componentes (grado 11)",
      activities: [
        { id: "bitacora311",      label: "3.1.1 Bitácora individual de análisis" },
        { id: "socializacion312", label: "3.1.2 Socialización del análisis" },
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
    "guia-redes-rap01": {
      label: "Redes RAP 01 — Definir parámetros de la red",
      activities: [
        { id: "reflexion311",  label: "3.1.1 Reflexión / Socialización" },
        { id: "ip1",           label: "3.2.1 Bloque IP 1" },
        { id: "ip3",           label: "3.2.3 Bloque IP 3" },
        // El DOM usa ids sin guion (tallerIPEj1…, ver adminMount en
        // script_guia_redes.js); el catalogo conserva el id con guion para no
        // perder notas ya guardadas, y fija el mount explicito (mismo patron
        // que guia5-311/331/341 en "guia-05-herramientas" mas abajo).
        { id: "taller-ip-ej1", label: "3.3.1 Taller IP - Ejercicio 1", mount: "#tallerIPEj1DeadlineControls" },
        { id: "taller-ip-ej2", label: "3.3.2 Taller IP - Ejercicio 2", mount: "#tallerIPEj2DeadlineControls" },
        { id: "taller-ip-ej3", label: "3.3.3 Taller IP - Ejercicio 3", mount: "#tallerIPEj3DeadlineControls" },
        { id: "taller-ip-ej4", label: "3.3.4 Taller IP - Ejercicio 4", mount: "#tallerIPEj4DeadlineControls" },
        { id: "taller-ip-ej5", label: "3.3.5 Taller IP - Ejercicio 5", mount: "#tallerIPEj5DeadlineControls" },
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
  function fetchGradesFromCloud(usernameKey) {
    var db = gradesCloudDb();
    if (!db) return Promise.resolve(null);
    return Promise.resolve(db.cloudGetGrades(usernameKey)).catch(function () { return null; });
  }
  function saveGradesToCloud(usernameKey, allGrades) {
    var db = gradesCloudDb();
    if (!db || typeof db.cloudSaveGrades !== "function") return;
    // Fire-and-forget: lo invoca el admin; el rule isAdmin() lo autoriza.
    Promise.resolve(db.cloudSaveGrades(usernameKey, allGrades)).catch(function () {});
  }
  function setAllStudentGrades(usernameKey, allGrades) {
    var key = getGradesKey(usernameKey);
    if (key) safeSetLocal(key, JSON.stringify(allGrades || {}));
  }

  function getStudentGrades(usernameKey, guideFamily) {
    var key = getGradesKey(usernameKey);
    if (!key) return {};
    var all = readJson(localStorage.getItem(key), {});
    return guideFamily ? (all[guideFamily] || {}) : all;
  }

  function setStudentGrades(usernameKey, guideFamily, gradesObj) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    all[guideFamily] = Object.assign({}, gradesObj);
    safeSetLocal(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  function setStudentActivityGrade(usernameKey, guideFamily, activityId, grade) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    if (grade === "" || grade === null || grade === undefined) {
      delete all[guideFamily][activityId];
    } else {
      all[guideFamily][activityId] = grade;
    }
    safeSetLocal(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  // Admin: fija la nota Y embebe (o limpia) la solucion modelo dentro del doc de notas
  // del aprendiz, en UNA sola escritura. La solucion solo se embebe cuando la nota es "A".
  // El aprendiz solo lee su propio doc, asi ve unicamente la solucion de SU actividad
  // aprobada; el banco maestro nunca llega a su cliente.
  function setStudentActivityGradeAndSolution(usernameKey, guideFamily, activityId, grade, solutionObj) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    var solKey = activityId + ":solution";
    var gradedAtKey = activityId + ":gradedAt";
    if (grade === "" || grade === null || grade === undefined) {
      delete all[guideFamily][activityId];
      delete all[guideFamily][gradedAtKey];
    } else {
      all[guideFamily][activityId] = grade;
      all[guideFamily][gradedAtKey] = new Date().toISOString();
    }
    if (grade === "A" && solutionObj && typeof solutionObj === "object" && Object.keys(solutionObj).length) {
      all[guideFamily][solKey] = solutionObj;
    } else {
      delete all[guideFamily][solKey];   // sin "A" => sin solucion embebida
    }
    safeSetLocal(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  // Admin (re-sincronizacion): embebe la solucion modelo en una nota "A" YA
  // existente SIN tocar la nota ni su fecha de calificacion (gradedAt). Para
  // notas puestas antes de importar el banco a Firestore, o cuya solucion
  // embebida quedo vieja porque el banco crecio despues (ej. el checklist de
  // competencias digitales agregado el jul-15).
  function embedStudentActivitySolution(usernameKey, guideFamily, activityId, solutionObj) {
    var key = getGradesKey(usernameKey);
    if (!key) return false;
    var all = readJson(localStorage.getItem(key), {});
    var fam = all[guideFamily];
    if (!fam || fam[activityId] !== "A") return false;
    if (!solutionObj || typeof solutionObj !== "object" || !Object.keys(solutionObj).length) return false;
    fam[activityId + ":solution"] = solutionObj;
    safeSetLocal(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
    return true;
  }

  function setStudentActivityObservation(usernameKey, guideFamily, activityId, obs) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    var obsKey = activityId + ":obs";
    if (!obs || !String(obs).trim()) {
      delete all[guideFamily][obsKey];
    } else {
      all[guideFamily][obsKey] = String(obs).trim().slice(0, 500);
    }
    safeSetLocal(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
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
    if (grade === "A") {
      badgeClass = "activity-grade-badge activity-grade-badge--aprobado";
      icon = "✅";
      html = "<strong>¡Aprobado!</strong> Buen trabajo. 🎉" + fechaHtml;
    } else if (grade === "D") {
      badgeClass = "activity-grade-badge activity-grade-badge--desaprobado";
      icon = "❌";
      // Motivo que el instructor eligio/escribio al calificar (setStudentActivityObservation,
      // panel Calificaciones). Opcional: sin motivo, el badge se ve igual que antes.
      var obsHtml = obs ? '<br><span class="grade-badge-obs">' + escapeHtmlLocal(obs) + "</span>" : "";
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
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11a-guia-06-planificar-informacion.html": "guia-06-planificar",
    "grupo-11b-guia-06-planificar-informacion.html": "guia-06-planificar",
    "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "guia-07-ciberseguridad",
    "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia-07-ciberseguridad",
    "santa-barbara-10a-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10b-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10a-guia-03-redes-rap02.html": "guia-redes-rap02",
    "santa-barbara-10b-guia-03-redes-rap02.html": "guia-redes-rap02",
    "santa-barbara-guia-python.html": "guia-python",
    "grupo-10a-guia-04-taller-integrador.html": "taller-integrador-jfk",
    "grupo-10b-guia-04-taller-integrador.html": "taller-integrador-jfk",
    "santa-barbara-10a-guia-04-taller-integrador.html": "taller-integrador-sb",
    "santa-barbara-10b-guia-04-taller-integrador.html": "taller-integrador-sb",
  };

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
    var family = GUIDE_FAMILY_BY_FILE[String(pageFile || "")];
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
    var cloud;
    try { cloud = await db.cloudGetGrades(session.usernameKey); }
    catch (e) { return; }
    var grades = (cloud && cloud[guideFamily]) || {};

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
    GUIDE_FAMILY_BY_FILE: GUIDE_FAMILY_BY_FILE,
    autoRenderForFile: autoRenderForFile,
    applyApprovedSolutionsForFamily: applyApprovedSolutionsForFamily,
    reflectGradesIntoGuideState: reflectGradesIntoGuideState,
    resolveGradeValue: resolveGradeValue,
    getStudentGrades: getStudentGrades,
    setAllStudentGrades: setAllStudentGrades,
    setStudentGrades: setStudentGrades,
    setStudentActivityGrade: setStudentActivityGrade,
    setStudentActivityGradeAndSolution: setStudentActivityGradeAndSolution,
    embedStudentActivitySolution: embedStudentActivitySolution,
    setStudentActivityObservation: setStudentActivityObservation,
    getStudentActivityObservation: getStudentActivityObservation,
    getMyGrades: getMyGrades,
    renderGradeBadges: renderGradeBadges,
  };
})();
