/* js/academic_agenda_context.js
 *
 * Capa de resolucion de contexto para js/academic_agenda.js (agregador
 * PURO, sin lecturas propias -- ver ese archivo). Este modulo SI toca
 * window.portalAuth / activityDeadlineManager / productiveStageStore /
 * _firebaseDb / localStorage: es la pieza "impura" a proposito, deja
 * academic_agenda.js facil de testear con require() plano.
 *
 * Responsabilidad unica: dado un session de aprendiz, arma el objeto que
 * academicAgenda.buildAcademicAgenda() espera (context + snapshots ya
 * cargados). NO reconstruye pendientes ni normaliza eventos -- eso sigue
 * siendo trabajo exclusivo del agregador.
 *
 * SEGURIDAD: este modulo solo debe usarse con la sesion del PROPIO
 * aprendiz autenticado. Nunca acepta un usernameKey/ficha arbitrario desde
 * fuera -- lee siempre portalAuth.getCurrentSession().
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;

  // Mismas 2 fichas que ya usan js/student_summary.js y js/portal_home.js
  // para decidir si una ficha tiene Etapa Productiva. Copia deliberada (ver
  // hallazgo en el informe de cierre de este bloque): no existe hoy un
  // solo lugar compartido para esta lista, y unificarla tocaria esos dos
  // archivos ya en produccion sin que esta fase lo haya pedido.
  var PRODUCTIVE_FICHAS = ["3168850", "3168852"];

  // Mismo mapa que ya usaba (privado) js/student_calendar.js. Se centraliza
  // aqui porque este modulo reemplaza esa logica (pedido explicito del
  // usuario: "reemplaza la logica actual... por consumo del agregador").
  var SHORT_INST = {
    "Institucion Educativa Jhon F. Kennedy": "I.E. Jhon F. Kennedy",
    "Institucion Educativa Santa Barbara": "I.E. Santa Bárbara",
  };

  // Catalogo minimo de documentos base de Etapa Productiva que el
  // agregador necesita (id/title/deliveryLabel). Cuarta copia de esta
  // lista en el repo (ver DOCUMENT_CATALOG en productive_stage_admin.js y
  // PROJECT_DOCUMENTS en productive_stage_project_delivery.js) -- hallazgo
  // ya documentado, no se corrige en este bloque (ver informe de cierre).
  var DOCUMENT_CATALOG = [
    { id: "ficha-inscripcion", title: "Ficha de inscripción", deliveryLabel: "Ficha de Inscripcion" },
    { id: "acuerdo-etapa-productiva", title: "Acuerdo de Etapa Productiva", deliveryLabel: "Acuerdo de Etapa Productiva" },
    { id: "sofia-plus", title: "Pantallazo Sofía Plus", deliveryLabel: "Pantallazo Sofia Plus" },
    { id: "bitacora-1", title: "Bitácora N° 1", deliveryLabel: "Bitacora 1" },
    { id: "bitacora-2", title: "Bitácora N° 2", deliveryLabel: "Bitacora 2" },
    { id: "bitacora-3", title: "Bitácora N° 3", deliveryLabel: "Bitacora 3" },
    { id: "bitacora-4", title: "Bitácora N° 4", deliveryLabel: "Bitacora 4" },
    { id: "bitacora-5", title: "Bitácora N° 5", deliveryLabel: "Bitacora 5" },
    { id: "bitacora-6", title: "Bitácora N° 6", deliveryLabel: "Bitacora 6" },
  ];

  // Copiado de js/portal_home.js (REAL_STATE_KEY_ALIASES): necesario para
  // leer el localStorage CORRECTO de una guia cuyo stateKey declarado no
  // coincide con su clave real de guardado (ver comentario largo en ese
  // archivo). Tercera copia de esta tabla especifica -- mismo hallazgo que
  // el catalogo de documentos, documentado y no corregido aqui.
  var REAL_STATE_KEY_ALIASES = {
    "grupo-10a-guia-01-induccion.html": "guia_induccion_10a_guia_html",
    "grupo-10b-guia-01-induccion.html": "guia_induccion_10b_guia_html",
    "santa-barbara-10a-guia-02-redes-rap01.html": "guia_interactiva_sb_10a_redes_html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia_interactiva_11b_guia_html",
    "grupo-11b-guia-06-planificar-informacion.html": "guia_interactiva_11b_guia6_html",
    "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia_interactiva_11b_guia7_html",
    "grupo-11b-guia-08-documentar-gestion-informacion.html": "guia_interactiva_11b_guia8_html",
    "grupo-11b-guia-09-taller-integrador.html": "guia_interactiva_11b_guia9_html",
    "santa-barbara-10b-guia-02-redes-rap01.html": "guia_interactiva_sb_10b_redes_html",
  };

  function auth() { return window.portalAuth; }
  function db() { return window._firebaseDb; }

  // HALLAZGO DE RENDIMIENTO (verificado en navegador real, no solo teoria):
  // productiveStageStore.loadStudentSnapshot() para una sesion de aprendiz
  // NUNCA puede leer directo de Firestore (las reglas solo permiten ese doc
  // para admin -- ver isSharedDeadlinesDoc en firestore.rules, que NO cubre
  // "admin:productive-stage"), asi que SIEMPRE cae al respaldo de Drive via
  // Apps Script (accion "studentProductiveStageView", ver drive_db.js y
  // handleStudentProductiveStageView en respaldo_firestore.gs) -- misma
  // lectura de archivo Drive que antes, documentada en CLAUDE.md como
  // 10-25s bajo carga; medido aqui en ~8-12s incluso sin carga real. Esto ya
  // pasaba HOY para productive_stage_project_delivery.js y
  // student_summary.js -- no es una regresion de este bloque -- pero antes
  // de este bloque ninguna otra pagina dependia de esa misma lectura para
  // renderizar. Envolver esta llamada (y las otras 2 lecturas de red de
  // este archivo) con un tiempo maximo evita que el aprendiz se quede
  // mirando "Cargando..." 20+ segundos: pasado el limite, la agenda se
  // construye SIN esos eventos en vez de bloquear todo el render (mismo
  // criterio "mejor esfuerzo" que ya usa el resto del proyecto para
  // lecturas opcionales).
  function withTimeout(promise, ms, fallbackValue) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(fallbackValue);
      }, ms);
      promise.then(function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallbackValue);
      });
    });
  }

  function guideStateKey(pageFile) {
    var std = window.ActivityStandard;
    return REAL_STATE_KEY_ALIASES[pageFile] ||
      (std && typeof std.getStateKeyForGuide === "function" ? std.getStateKeyForGuide(pageFile) : "");
  }

  function readLocalGuideState(usernameKey, pageFile) {
    var a = auth();
    var stateKey = guideStateKey(pageFile);
    if (!stateKey || !a || typeof a.getStudentStorageKey !== "function") return null;
    var storageKey = a.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    try {
      var raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function lockedActivityIdsFromState(state) {
    var ids = [];
    if (!state || typeof state !== "object") return ids;
    Object.keys(state).forEach(function (key) {
      var m = key.match(/^(.+)-locked$/);
      if (m && state[key]) ids.push(m[1]);
    });
    return ids;
  }

  // Estado de entrega de actividades de guia, cross-device (pedido
  // explicito de este bloque). Prioridad: 1) registro remoto confirmado,
  // 2) estado local como fallback, 3) si no se puede determinar, NUNCA se
  // marca "Entregada" (el agregador ya trata una key ausente como "no
  // entregado", nunca como "vencido silencioso" -- ver
  // js/academic_agenda.js).
  //
  // Acotado A PROPOSITO a las guias que YA tienen un deadline configurado
  // (`guidesWithDeadlines`, tipicamente un puñado, no todas las guias de la
  // ficha): consultar el estado remoto de TODAS las guias en cada carga de
  // Home/calendario si violaria el punto de rendimiento de esta fase. Esto
  // es ADEMAS de (no en vez de) la hidratacion que portal_home.js ya hace
  // para el resto de guias sin deadline.
  async function resolveDeliveredGuideActivityKeys(usernameKey, guidesWithDeadlines) {
    var delivered = new Set();
    var dbApi = db();
    var canReadRemote = !!(
      dbApi &&
      typeof dbApi.cloudGetGuideData === "function" &&
      !(typeof dbApi.shouldDeferCloudReads === "function" && dbApi.shouldDeferCloudReads())
    );
    var scope = "student:" + usernameKey;

    await Promise.all((guidesWithDeadlines || []).map(async function (pageFile) {
      var localState = readLocalGuideState(usernameKey, pageFile);
      var remoteState = null;
      if (canReadRemote) {
        var cloudFile = typeof dbApi.guideDataFileName === "function" ? dbApi.guideDataFileName(pageFile) : pageFile;
        var snapshot = await withTimeout(
          dbApi.cloudGetGuideData(scope, cloudFile).catch(function () { return null; }),
          8000,
          null
        );
        remoteState = snapshot && typeof snapshot.state === "object" && snapshot.state
          ? snapshot.state
          : (snapshot && typeof snapshot.data === "object" && snapshot.data ? snapshot.data : null);
      }
      // Prioridad 1: remoto confirmado. Prioridad 2: local. Si ninguno
      // tiene el estado, sencillamente no se agrega ninguna key (=
      // "no se puede determinar" -> el agregador la deja Pendiente).
      var effectiveState = remoteState || localState;
      lockedActivityIdsFromState(effectiveState).forEach(function (activityId) {
        delivered.add(pageFile + "::" + activityId);
      });
    }));
    return delivered;
  }

  function buildGuideCatalog(ficha) {
    var a = auth();
    var mgr = window.activityDeadlineManager;
    if (!a || typeof a.getGuidesForFicha !== "function" || !mgr) return [];
    var files = a.getGuidesForFicha(ficha) || [];
    return files.map(function (file) {
      return {
        pageFile: file,
        guideTitle: typeof a.getGuideTitle === "function" ? a.getGuideTitle(file) : file,
        route: typeof a.getGuideHref === "function" ? a.getGuideHref(file) : ("guia.html?g=" + encodeURIComponent(file)),
        activities: mgr.getActivitiesForGuide(file) || [],
      };
    });
  }

  function unwrapCalendarSnapshot(doc) {
    if (!doc || typeof doc !== "object") return {};
    var state = doc.state && typeof doc.state === "object" && !Array.isArray(doc.state) ? doc.state : doc;
    return state && typeof state === "object" ? state : {};
  }

  async function loadCalendarOverrides() {
    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudGetCalendar !== "function") return {};
    var snapshot = await withTimeout(
      dbApi.cloudGetCalendar("calendario_2026_admin").catch(function () { return null; }),
      8000,
      null
    );
    return unwrapCalendarSnapshot(snapshot);
  }

  // Punto de entrada. SOLO usa la sesion real del aprendiz autenticado --
  // nunca un usernameKey/ficha pasado desde fuera (evita que un llamador
  // arme "el contexto de otro aprendiz" por error o a proposito).
  async function resolveStudentAgendaContext() {
    var a = auth();
    var session = a && typeof a.getCurrentSession === "function" ? a.getCurrentSession() : null;
    var user = session && session.user;
    if (!session || session.role !== "student" || !user) return null;

    var usernameKey = user.usernameKey || user.username;
    var ficha = user.ficha;
    if (!usernameKey || !ficha) return null;

    var fichaInfo = typeof a.getFichaInfo === "function" ? a.getFichaInfo(ficha) : null;
    var grupo = user.grupo || (fichaInfo && fichaInfo.grupo) || "";
    var institucionLong = user.inst || (fichaInfo && fichaInfo.inst) || "";
    var institucionShort = SHORT_INST[institucionLong] || institucionLong;
    var hasProductiveStage = PRODUCTIVE_FICHAS.indexOf(String(ficha)) !== -1;

    var guideCatalog = buildGuideCatalog(ficha);

    var deadlinesSnapshot = null;
    var mgr = window.activityDeadlineManager;
    if (mgr && typeof mgr.ready === "function") {
      try { await mgr.ready(); } catch (e) { /* se sigue con lo que haya en cache */ }
      deadlinesSnapshot = typeof mgr.getSnapshot === "function" ? mgr.getSnapshot() : null;
    }

    var guidesWithDeadlines = [];
    if (deadlinesSnapshot && deadlinesSnapshot.policies) {
      guideCatalog.forEach(function (guide) {
        if (deadlinesSnapshot.policies[guide.pageFile]) guidesWithDeadlines.push(guide.pageFile);
      });
    }

    // Rendimiento (verificado en navegador real): las 3 lecturas de abajo
    // son independientes entre si -- se disparan en PARALELO (Promise.all)
    // en vez de en cadena. Encadenadas secuencialmente, el peor caso suma
    // hasta 3x8s = 24s de espera; en paralelo, el peor caso queda acotado a
    // ~8s (el mas lento de los tres, no la suma).
    // Bloque C.1 (cierre de hallazgo de privacidad): loadStudentSnapshot()
    // pide la vista PROPIA server-side (Apps Script identifica al aprendiz
    // solo por su idToken ya verificado y filtra documentDeliveries/
    // projects/reports/deliveries antes de responder -- ver
    // handleStudentProductiveStageView en apps-script/respaldo_firestore.gs).
    // Ya NO se usa loadSnapshot() (el snapshot administrativo completo) para
    // una sesion de aprendiz. El filtro por ctx.usernameKey que ya hacia
    // buildProductiveStageEvents en academic_agenda.js se mantiene como
    // segunda capa (defensa en profundidad), no como el unico filtro.
    var productiveStageSnapshotPromise = (hasProductiveStage && window.productiveStageStore && typeof window.productiveStageStore.loadStudentSnapshot === "function")
      ? withTimeout(window.productiveStageStore.loadStudentSnapshot().catch(function () { return null; }), 8000, null)
      : Promise.resolve(null);

    var results = await Promise.all([
      productiveStageSnapshotPromise,
      resolveDeliveredGuideActivityKeys(usernameKey, guidesWithDeadlines),
      loadCalendarOverrides(),
    ]);
    var productiveStageSnapshot = results[0];
    var deliveredGuideActivityKeys = results[1];
    var calendarOverrides = results[2];
    var calendarRecords = Array.isArray(window.CALENDAR_2026_RECORDS) ? window.CALENDAR_2026_RECORDS : [];

    return {
      context: {
        ficha: ficha,
        grupo: grupo,
        institucionShort: institucionShort,
        institucionLong: institucionLong,
        usernameKey: usernameKey,
        hasProductiveStage: hasProductiveStage,
      },
      guideCatalog: guideCatalog,
      deadlinesSnapshot: deadlinesSnapshot,
      productiveStageSnapshot: productiveStageSnapshot,
      documentCatalog: DOCUMENT_CATALOG,
      calendarRecords: calendarRecords,
      calendarOverrides: calendarOverrides,
      deliveredGuideActivityKeys: deliveredGuideActivityKeys,
    };
  }

  window.academicAgendaContext = {
    PRODUCTIVE_FICHAS: PRODUCTIVE_FICHAS,
    SHORT_INST: SHORT_INST,
    DOCUMENT_CATALOG: DOCUMENT_CATALOG,
    resolveStudentAgendaContext: resolveStudentAgendaContext,
    __test: {
      resolveDeliveredGuideActivityKeys: resolveDeliveredGuideActivityKeys,
      buildGuideCatalog: buildGuideCatalog,
      unwrapCalendarSnapshot: unwrapCalendarSnapshot,
      withTimeout: withTimeout,
    },
  };
})();
