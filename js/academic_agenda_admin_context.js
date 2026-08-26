/* js/academic_agenda_admin_context.js
 *
 * Capa de resolucion de contexto ADMIN para js/academic_agenda.js (agregador
 * PURO, ver ese archivo -- NO SE MODIFICA). Paralela a
 * js/academic_agenda_context.js (que resuelve el contexto de UN aprendiz),
 * pero para el rol admin: itera VARIAS fichas (nunca pasa usernameKey, ver
 * "modo admin sin filtro" en academic_agenda.js) y agrega, aparte, conteos
 * reales de entrega por ficha -- algo fuera del alcance del agregador puro.
 *
 * SEGURIDAD: este modulo asume que quien lo carga ya paso
 * portalAuth.requireAdminAccess() (ver access_guard_admin.js en la pagina
 * que lo consume). No repite esa validacion -- no es su responsabilidad, y
 * repetirla aqui daria una falsa sensacion de que el modulo es seguro de
 * cargar sin guardia de pagina.
 *
 * Reutiliza sin duplicar: window.academicAgendaContext.DOCUMENT_CATALOG /
 * .PRODUCTIVE_FICHAS / .SHORT_INST (constantes ya publicas de ese modulo
 * cerrado) y window._firebaseDb.guideDataFileName (mismo alias canonico que
 * ya usa academic_agenda_context.js para el aprendiz) -- NO se copian de
 * nuevo aqui.
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;

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

  function unwrapCalendarSnapshot(doc) {
    if (!doc || typeof doc !== "object") return {};
    var state = doc.state && typeof doc.state === "object" && !Array.isArray(doc.state) ? doc.state : doc;
    return state && typeof state === "object" ? state : {};
  }

  function allFichas() {
    var auth = window.portalAuth;
    return auth && auth.FICHA_MAP ? Object.keys(auth.FICHA_MAP) : [];
  }

  // Catalogo de fichas + institucion/grupo/Etapa Productiva para poblar los
  // selects de filtro de la vista admin. No requiere ninguna lectura de red.
  function listFichaOptions() {
    var auth = window.portalAuth;
    var ac = window.academicAgendaContext;
    var map = (auth && auth.FICHA_MAP) || {};
    var productive = (ac && ac.PRODUCTIVE_FICHAS) || [];
    var shortInst = (ac && ac.SHORT_INST) || {};
    return Object.keys(map).map(function (ficha) {
      var info = map[ficha] || {};
      var institucionLong = info.inst || "";
      return {
        ficha: ficha,
        grupo: info.grupo || "",
        institucionLong: institucionLong,
        institucionShort: shortInst[institucionLong] || institucionLong,
        hasProductiveStage: productive.indexOf(String(ficha)) !== -1,
      };
    });
  }

  function resolveFichaList(filterFichas) {
    var all = allFichas();
    var wanted = Array.isArray(filterFichas) && filterFichas.length
      ? filterFichas.map(String)
      : all;
    return wanted.filter(function (f) { return all.indexOf(f) !== -1; });
  }

  // Mismo patron que academic_agenda_context.js#buildGuideCatalog (no
  // exportado alli mas que via __test, uso reservado a pruebas): copia
  // pequeña y deliberada, no una API compartida nueva.
  function buildGuideCatalogForFicha(ficha) {
    var a = window.portalAuth;
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

  async function loadRoster() {
    var auth = window.portalAuth;
    if (!auth) return [];
    if (typeof auth.fetchStudentsWithProgress === "function") {
      var fresh = await withTimeout(auth.fetchStudentsWithProgress().catch(function () { return null; }), 8000, null);
      if (Array.isArray(fresh) && fresh.length) return fresh;
    }
    if (typeof auth.getStudentsWithProgress === "function") {
      var cached = auth.getStudentsWithProgress();
      if (Array.isArray(cached) && cached.length) return cached;
    }
    return typeof auth.listStudents === "function" ? auth.listStudents() : [];
  }

  // Conteo real de Etapa Productiva (BITACORA/DOCUMENTO): unico snapshot ya
  // admin-autorizado (productiveStageStore.loadSnapshot()), sin lecturas por
  // estudiante -- mismo costo que ya paga etapa-productiva-admin.html. Se
  // ejecuta siempre (no es opcional/bajo demanda) porque es barato.
  function computeProductiveStageCounts(events, productiveStageSnapshot, roster) {
    var store = window.productiveStageStore;
    if (!store || typeof store.getDocumentDeliveriesByUsername !== "function" || !productiveStageSnapshot) return;
    var deliveryIndex = store.getDocumentDeliveriesByUsername(productiveStageSnapshot) || {};

    var rosterByFicha = {};
    (roster || []).forEach(function (u) {
      var f = String((u && u.ficha) || "");
      if (!f) return;
      (rosterByFicha[f] || (rosterByFicha[f] = [])).push(u);
    });

    events.forEach(function (ev) {
      if (ev.type !== "BITACORA" && ev.type !== "DOCUMENTO") return;
      var fichaUsers = rosterByFicha[String(ev.ficha || "")] || [];
      if (!fichaUsers.length) return; // sin roster para esa ficha: no se inventa conteo

      var delivered = 0;
      fichaUsers.forEach(function (u) {
        var key = String((u && (u.usernameKey || u.username)) || "").trim().toLowerCase();
        if (key && (deliveryIndex[key] || {})[ev.sourceId]) delivered += 1;
      });
      var total = fichaUsers.length;
      ev.deliverySummary = {
        total: total,
        delivered: delivered,
        pending: total - delivered,
        overdue: ev.status === "overdue" ? (total - delivered) : 0,
      };
    });
  }

  // Conteo real de entregas de actividad de guia (ENTREGA). A DIFERENCIA de
  // Etapa Productiva, aqui no existe un solo doc admin-autorizado -- son
  // documentos por-estudiante-por-guia (misma razon por la que
  // admin_habilitacion.js expone su propio boton "Cargar estado desde la
  // nube" en vez de barrerlos en cada carga de pagina). Por eso ESTA funcion
  // es bajo demanda (el llamador decide cuando invocarla, tipicamente un
  // boton), nunca automatica -- y agrupa por (ficha,pageFile) para no pedir
  // el mismo documento una vez por actividad.
  async function computeGuideDeliveryCounts(events, roster, onProgress) {
    var dbApi = window._firebaseDb;
    var std = window.ActivityStandard;
    var targets = events.filter(function (ev) { return ev.type === "ENTREGA"; });

    if (!dbApi || typeof dbApi.cloudGetGuideData !== "function" ||
        typeof dbApi.guideDataFileName !== "function" ||
        !std || typeof std.getActivitiesForGuide !== "function") {
      targets.forEach(function (ev) { ev.deliverySummary = null; });
      return { computed: 0, skipped: targets.length };
    }

    var rosterByFicha = {};
    (roster || []).forEach(function (u) {
      var f = String((u && u.ficha) || "");
      if (!f) return;
      (rosterByFicha[f] || (rosterByFicha[f] = [])).push(u);
    });

    var groups = {};
    targets.forEach(function (ev) {
      var parts = String(ev.sourceId || "").split("::");
      var pageFile = parts[0] || "";
      var activityId = parts[1] || "";
      if (!pageFile || !activityId) { ev.deliverySummary = null; return; }
      var key = String(ev.ficha || "") + "::" + pageFile;
      if (!groups[key]) groups[key] = { ficha: String(ev.ficha || ""), pageFile: pageFile, items: [] };
      groups[key].items.push({ event: ev, activityId: activityId });
    });

    var groupKeys = Object.keys(groups);
    var computed = 0;
    var skipped = 0;

    for (var i = 0; i < groupKeys.length; i++) {
      var group = groups[groupKeys[i]];
      var fichaUsers = rosterByFicha[group.ficha] || [];
      var activities = std.getActivitiesForGuide(group.pageFile) || [];

      if (!fichaUsers.length || !activities.length) {
        group.items.forEach(function (item) { item.event.deliverySummary = null; skipped += 1; });
      } else {
        var cloudFileName = dbApi.guideDataFileName(group.pageFile);
        var scopePrefix = "student:";
        var states = await Promise.all(fichaUsers.map(function (u) {
          return withTimeout(
            dbApi.cloudGetGuideData(scopePrefix + u.usernameKey, cloudFileName).catch(function () { return null; }),
            8000,
            null
          );
        }));

        group.items.forEach(function (item) {
          var activityDef = activities.filter(function (a) { return a && a.id === item.activityId; })[0];
          var lockKeys = activityDef && Array.isArray(activityDef.keys)
            ? activityDef.keys.filter(function (k) { return /-locked$/.test(k); })
            : [];
          if (!lockKeys.length) {
            item.event.deliverySummary = null;
            skipped += 1;
            return;
          }
          var delivered = 0;
          states.forEach(function (snapshot) {
            var state = snapshot && typeof snapshot === "object"
              ? (snapshot.state && typeof snapshot.state === "object" ? snapshot.state : snapshot)
              : null;
            if (state && lockKeys.some(function (k) { return state[k] === true; })) delivered += 1;
          });
          var total = fichaUsers.length;
          item.event.deliverySummary = {
            total: total,
            delivered: delivered,
            pending: total - delivered,
            overdue: item.event.status === "overdue" ? (total - delivered) : 0,
          };
          computed += 1;
        });
      }

      if (typeof onProgress === "function") {
        onProgress({ done: i + 1, total: groupKeys.length });
      }
    }

    return { computed: computed, skipped: skipped };
  }

  // Punto de entrada. options.fichas: array opcional de numeros de ficha
  // (string) para acotar la vista; vacio/ausente = todas las fichas.
  async function resolveAdminAgendaContext(options) {
    var opts = options && typeof options === "object" ? options : {};
    var fichas = resolveFichaList(opts.fichas);
    var ac = window.academicAgendaContext;
    var documentCatalog = (ac && ac.DOCUMENT_CATALOG) || [];
    var productiveFichas = (ac && ac.PRODUCTIVE_FICHAS) || [];
    var shortInst = (ac && ac.SHORT_INST) || {};
    var fichaMap = (window.portalAuth && window.portalAuth.FICHA_MAP) || {};

    var mgr = window.activityDeadlineManager;
    if (mgr && typeof mgr.ready === "function") {
      try { await mgr.ready(); } catch (e) { /* se sigue con lo que haya en cache */ }
    }
    var deadlinesSnapshot = mgr && typeof mgr.getSnapshot === "function" ? mgr.getSnapshot() : null;

    var needsProductiveStage = fichas.some(function (f) { return productiveFichas.indexOf(String(f)) !== -1; });
    var store = window.productiveStageStore;
    var productiveStageSnapshotPromise = (needsProductiveStage && store && typeof store.loadSnapshot === "function")
      ? withTimeout(store.loadSnapshot().catch(function () { return null; }), 8000, null)
      : Promise.resolve(null);

    var dbApi = window._firebaseDb;
    var calendarOverridesPromise = (dbApi && typeof dbApi.cloudGetCalendar === "function")
      ? withTimeout(dbApi.cloudGetCalendar("calendario_2026_admin").catch(function () { return null; }), 8000, null)
      : Promise.resolve(null);

    var results = await Promise.all([productiveStageSnapshotPromise, calendarOverridesPromise, loadRoster()]);
    var productiveStageSnapshot = results[0];
    var calendarOverrides = unwrapCalendarSnapshot(results[1]);
    var roster = Array.isArray(results[2]) ? results[2] : [];
    var calendarRecords = Array.isArray(window.CALENDAR_2026_RECORDS) ? window.CALENDAR_2026_RECORDS : [];

    var allEvents = [];
    fichas.forEach(function (ficha) {
      var info = fichaMap[ficha] || {};
      var institucionLong = info.inst || "";
      var institucionShort = shortInst[institucionLong] || institucionLong;
      var grupo = info.grupo || "";
      var hasProductiveStage = productiveFichas.indexOf(String(ficha)) !== -1;

      var ctx = {
        ficha: ficha,
        grupo: grupo,
        institucionShort: institucionShort,
        institucionLong: institucionLong,
        hasProductiveStage: hasProductiveStage,
        // usernameKey deliberadamente ausente: modo admin/solo-ficha (ver
        // academic_agenda.js). El "status" individual de ENTREGA/BITACORA/
        // DOCUMENTO que devuelve el agregador queda como estimado por fecha
        // (nunca "Entregada") hasta que se agregue deliverySummary abajo.
      };

      var result = window.academicAgenda.buildAcademicAgenda({
        context: ctx,
        now: opts.now,
        calendarRecords: calendarRecords,
        calendarOverrides: calendarOverrides,
        deadlinesSnapshot: deadlinesSnapshot,
        guideCatalog: buildGuideCatalogForFicha(ficha),
        productiveStageSnapshot: hasProductiveStage ? productiveStageSnapshot : null,
        documentCatalog: documentCatalog,
      });

      (result.events || []).forEach(function (ev) { allEvents.push(ev); });
    });

    var seen = {};
    var deduped = allEvents.filter(function (ev) {
      if (seen[ev.id]) return false;
      seen[ev.id] = true;
      return true;
    });
    deduped.sort(function (a, b) {
      var ax = a.dueAt || a.startAt || (a.date ? a.date + "T00:00:00.000Z" : "");
      var bx = b.dueAt || b.startAt || (b.date ? b.date + "T00:00:00.000Z" : "");
      return String(ax).localeCompare(String(bx));
    });

    computeProductiveStageCounts(deduped, productiveStageSnapshot, roster);

    return {
      events: deduped,
      generatedAt: new Date().toISOString(),
      fichaOptions: listFichaOptions(),
      fichas: fichas,
      roster: roster,
    };
  }

  window.academicAgendaAdminContext = Object.freeze({
    listFichaOptions: listFichaOptions,
    resolveAdminAgendaContext: resolveAdminAgendaContext,
    computeGuideDeliveryCounts: computeGuideDeliveryCounts,
    __test: {
      resolveFichaList: resolveFichaList,
      buildGuideCatalogForFicha: buildGuideCatalogForFicha,
      unwrapCalendarSnapshot: unwrapCalendarSnapshot,
      computeProductiveStageCounts: computeProductiveStageCounts,
      withTimeout: withTimeout,
    },
  });
})();
