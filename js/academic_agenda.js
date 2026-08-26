(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(typeof window !== "undefined" ? window.productiveStageDeadlines : require("./productive_stage_deadlines.js"));
    return;
  }
  root.academicAgenda = factory(root.productiveStageDeadlines);
})(typeof self !== "undefined" ? self : this, function (productiveStageDeadlines) {
  "use strict";

  // js/academic_agenda.js -- Agregador central de la Agenda Academica.
  //
  // PURO por diseño (pedido explicito del usuario): recibe snapshots YA
  // cargados por el llamador (activityDeadlineManager.getSnapshot(),
  // productiveStageStore.loadSnapshot(), CALENDAR_2026_RECORDS + overrides,
  // y un catalogo de guias ya resuelto) y devuelve una lista normalizada de
  // eventos. NUNCA hace fetch, nunca toca localStorage/Firestore/Drive,
  // nunca importa firebase_db.js ni portal_auth.js. Esto es deliberado:
  // - Testeable con require() plano, sin mocks de red ni de DOM.
  // - Cero lecturas nuevas: quien llama a este modulo ya tenia que cargar
  //   esos snapshots para otra cosa (el badge de deadline del Home, el
  //   propio calendario de clases, el panel de Etapa Productiva...); este
  //   modulo solo los NORMALIZA, no los vuelve a pedir.
  // - "No duplicar deadlines": cada evento derivado apunta a su fuente real
  //   via (source, sourceId) y NUNCA se persiste el resultado de esta
  //   funcion -- se recalcula en cada render a partir de la fuente viva.
  //
  // Depende de js/productive_stage_deadlines.js SOLO por su logica pura ya
  // probada (resolveEffectiveDeadline para bitacoras/Sofia Plus,
  // classifyStatus para el vocabulario Pendiente/Vence hoy/Vence
  // mañana/Vencida/Entregada, que es genfrico y aplica igual a un deadline
  // de guia). No se duplica esa aritmetica de zona horaria por tercera vez.

  var STATUS = productiveStageDeadlines ? productiveStageDeadlines.STATUS : {
    NO_DEADLINE: "no-deadline", DELIVERED: "delivered", OVERDUE: "overdue",
    DUE_TODAY: "due-today", DUE_TOMORROW: "due-tomorrow", PENDING: "pending",
  };

  var CALENDAR_STATUS = {
    SCHEDULED: "scheduled",
    CANCELLED: "cancelled",
    RESCHEDULED: "rescheduled",
  };

  var TYPE = {
    CLASE: "CLASE",
    ENTREGA: "ENTREGA",
    BITACORA: "BITACORA",
    DOCUMENTO: "DOCUMENTO",
    ACTIVIDAD_ESPECIAL: "ACTIVIDAD_ESPECIAL",
  };

  // Mapa tipo-de-registro-legacy -> tipo de agenda. Los marcadores de fin de
  // semana (SABADO/DOMINGO, grado "-") no representan un evento real para
  // ninguna ficha -- se excluyen a proposito (ver limitaciones en el
  // informe de cierre), no es un descuido.
  var LEGACY_RECORD_TYPE_MAP = {
    "CLASE": TYPE.CLASE,
    "DESPLAZAMIENTO": TYPE.ACTIVIDAD_ESPECIAL,
    "REUNIÓN RECTOR": TYPE.ACTIVIDAD_ESPECIAL,
    "SENA": TYPE.ACTIVIDAD_ESPECIAL,
  };

  function isFiniteDate(ms) {
    return typeof ms === "number" && Number.isFinite(ms);
  }

  // ── Horario legacy (string libre) -> franjas horarias reales ───────────
  // "9:00am-9:55am" o con varias franjas separadas por ; o / :
  // "10:50am-11:45am; 2:15pm-4:15pm". Ancla cada franja al "fecha" del
  // registro (YYYY-MM-DD) en hora Bogota. Un registro sin horario valido
  // ("-", vacio, o que no matchea el patron) se trata como "todo el dia".
  var SLOT_RE = /(\d{1,2}):(\d{2})\s*(am|pm)\s*[–\-]\s*(\d{1,2}):(\d{2})\s*(am|pm)/i;

  function to24h(hour, ampm) {
    var h = Number(hour) % 12;
    if (String(ampm).toLowerCase() === "pm") h += 12;
    return h;
  }

  function bogotaWallTimeToIso(dateOnly, hour, minute) {
    if (!productiveStageDeadlines) return "";
    var hh = String(hour).padStart(2, "0");
    var mm = String(minute).padStart(2, "0");
    return productiveStageDeadlines.normalizeDueAt(dateOnly + "T" + hh + ":" + mm + ":00");
  }

  function parseHorarioSlots(dateOnly, horario) {
    var raw = String(horario || "").trim();
    if (!raw || raw === "—" || raw === "-") {
      return [{ allDay: true, startAt: "", endAt: "" }];
    }
    var pieces = raw.split(/\s*(?:;|\/|\r?\n)+\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    var slots = [];
    pieces.forEach(function (piece) {
      var m = piece.match(SLOT_RE);
      if (!m) return;
      var startAt = bogotaWallTimeToIso(dateOnly, to24h(m[1], m[3]), m[2]);
      var endAt = bogotaWallTimeToIso(dateOnly, to24h(m[4], m[6]), m[5]);
      if (startAt && endAt) slots.push({ allDay: false, startAt: startAt, endAt: endAt });
    });
    return slots.length ? slots : [{ allDay: true, startAt: "", endAt: "" }];
  }

  function safeNow(now) {
    return now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  }

  // ── Adaptador 1: calendario/clases legacy ───────────────────────────────
  // Filtra por institucion (forma corta, igual que student_calendar.js:
  // record.colegio ya viene corto, p.ej. "I.E. Jhon F. Kennedy") + grado.
  // Aplica el override de Firestore (mismo shape que ya usa
  // student_calendar.js: {colegio, grado, horario, estado, obs, act}).
  function buildCalendarEvents(ctx, calendarRecords, calendarOverrides, now) {
    var events = [];
    var overrides = calendarOverrides && typeof calendarOverrides === "object" ? calendarOverrides : {};
    (Array.isArray(calendarRecords) ? calendarRecords : []).forEach(function (record) {
      var mappedType = LEGACY_RECORD_TYPE_MAP[record && record.tipo];
      if (!mappedType) return; // SABADO/DOMINGO y tipos desconocidos: sin evento (ver limitaciones)
      var recordInst = String(record.colegio || "");
      var recordGrado = String(record.grado || "").trim().toUpperCase();
      if (ctx.institucionShort && recordInst !== ctx.institucionShort) return;
      if (ctx.grupo && recordGrado !== String(ctx.grupo).trim().toUpperCase()) return;
      if (!ctx.institucionShort && !ctx.grupo) return; // modo admin sin filtro: el llamador debe iterar por ficha

      var override = overrides[record.id] || {};
      var estado = String(override.estado || record.defE || "Activa").toLowerCase();
      var obs = (override.obs === "" || override.obs == null) ? (record.defO || "") : override.obs;
      var horario = override.horario || record.horario;
      var tema = override.act && override.act.nombre ? String(override.act.nombre) : "";

      var status = CALENDAR_STATUS.SCHEDULED;
      if (estado === "cancelada") status = CALENDAR_STATUS.CANCELLED;
      else if (estado === "recuperada") status = CALENDAR_STATUS.RESCHEDULED;

      var slots = mappedType === TYPE.CLASE ? parseHorarioSlots(record.fecha, horario) : [{ allDay: true, startAt: "", endAt: "" }];
      slots.forEach(function (slot, index) {
        events.push({
          id: "calendar:" + record.id + ":" + index,
          type: mappedType,
          title: mappedType === TYPE.CLASE ? "Clase" : (record.tipo || "Actividad"),
          description: [obs, tema ? ("Trabajo para entregar: " + tema) : ""].filter(Boolean).join(" — "),
          source: "calendar",
          sourceId: record.id,
          date: record.fecha,
          startAt: slot.startAt,
          endAt: slot.endAt,
          dueAt: "",
          allDay: !!slot.allDay,
          status: status,
          ficha: ctx.ficha || null,
          group: ctx.grupo || null,
          institution: ctx.institucionLong || record.colegio || null,
          route: "pages/auxiliares/calendario-aprendiz.html",
          priority: status === CALENDAR_STATUS.CANCELLED ? 90 : 50,
          isDerived: true,
        });
      });
    });
    return events;
  }

  // ── Adaptador 2: deadlines de actividades de guia (incluye Taller
  //    Integrador -- ya registrado en guide_declarations.js, entra por el
  //    mismo activityDeadlineManager, sin adaptador propio) ──────────────
  function buildGuideDeadlineEvents(ctx, deadlinesSnapshot, guideCatalog, deliveredKeys, now) {
    var events = [];
    var policies = deadlinesSnapshot && deadlinesSnapshot.policies && typeof deadlinesSnapshot.policies === "object"
      ? deadlinesSnapshot.policies
      : {};
    var delivered = deliveredKeys instanceof Set ? deliveredKeys : new Set(Array.isArray(deliveredKeys) ? deliveredKeys : []);

    (Array.isArray(guideCatalog) ? guideCatalog : []).forEach(function (guide) {
      var pageFile = guide && guide.pageFile;
      if (!pageFile) return;
      var filePolicies = policies[pageFile] || {};
      (Array.isArray(guide.activities) ? guide.activities : []).forEach(function (activity) {
        var policy = filePolicies[activity.id];
        var dueAt = policy && policy.dueAt ? String(policy.dueAt) : "";
        if (!dueAt) return; // sin deadline configurado: no se inventa evento

        var deliveryKey = pageFile + "::" + activity.id;
        var isDelivered = delivered.has(deliveryKey);
        var status = productiveStageDeadlines
          ? productiveStageDeadlines.classifyStatus({ dueAt: dueAt, deliveredAt: isDelivered ? true : "", now: now })
          : STATUS.PENDING;

        events.push({
          id: "guide-deadline:" + (ctx.ficha || "*") + ":" + pageFile + ":" + activity.id,
          type: TYPE.ENTREGA,
          title: (guide.guideTitle || pageFile) + " — " + (activity.label || activity.id),
          description: activity.label || "",
          source: "guide-deadline",
          sourceId: pageFile + "::" + activity.id,
          date: dueAt.slice(0, 10),
          startAt: "",
          endAt: "",
          dueAt: dueAt,
          allDay: false,
          status: status,
          ficha: ctx.ficha || null,
          group: ctx.grupo || null,
          institution: ctx.institucionLong || null,
          route: guide.route || ("guia.html?g=" + encodeURIComponent(pageFile)),
          priority: 0,
          isDerived: true,
        });
      });
    });
    return events;
  }

  // ── Adaptador 3: Bitacoras 1-6 + Sofia Plus (con fecha, admin-editable o
  //    fallback legacy) y documentos base sin fecha (ficha-inscripcion,
  //    acuerdo) -- solo aplica a fichas con Etapa Productiva
  //    (ctx.hasProductiveStage, resuelto por el llamador: este modulo no
  //    hardcodea la lista de fichas por tercera vez). ─────────────────────
  function buildProductiveStageEvents(ctx, productiveStageSnapshot, documentCatalog, now) {
    if (!ctx.hasProductiveStage || !productiveStageDeadlines) return [];
    var snapshot = productiveStageSnapshot && typeof productiveStageSnapshot === "object" ? productiveStageSnapshot : {};
    var deliveries = Array.isArray(snapshot.documentDeliveries) ? snapshot.documentDeliveries : [];
    var usernameKey = String(ctx.usernameKey || "").trim().toLowerCase();

    function findDelivery(docId) {
      if (!usernameKey) return null;
      return deliveries.find(function (record) {
        return String((record && record.usernameKey) || "").trim().toLowerCase() === usernameKey &&
          String((record && record.docId) || "").trim() === docId;
      }) || null;
    }

    var events = [];
    (Array.isArray(documentCatalog) ? documentCatalog : []).forEach(function (doc) {
      if (!doc || !doc.id || !doc.deliveryLabel) return; // solo documentos entregables reales
      var hasLegacyDeadline = Object.prototype.hasOwnProperty.call(
        productiveStageDeadlines.LEGACY_DATE_ONLY_BY_DOC_ID || {}, doc.id
      );
      var record = findDelivery(doc.id);

      if (hasLegacyDeadline) {
        var effective = productiveStageDeadlines.resolveEffectiveDeadline(snapshot, doc.id);
        var status = productiveStageDeadlines.classifyStatus({
          dueAt: effective.dueAt,
          deliveredAt: record ? (record.submittedAt || true) : "",
          now: now,
        });
        events.push({
          id: "productive-doc:" + (ctx.ficha || "*") + ":" + doc.id,
          type: TYPE.BITACORA,
          title: doc.title,
          description: doc.deliveryLabel,
          source: "productive-stage-deadline",
          sourceId: doc.id,
          date: effective.dueAt ? effective.dueAt.slice(0, 10) : "",
          startAt: "",
          endAt: "",
          dueAt: effective.dueAt || "",
          allDay: false,
          status: status,
          ficha: ctx.ficha || null,
          group: ctx.grupo || null,
          institution: ctx.institucionLong || null,
          route: "etapa-productiva-estudiante.html",
          priority: 0,
          isDerived: true,
        });
      } else {
        // Sin fecha (ficha-inscripcion, acuerdo): pendiente sin fecha, NUNCA
        // inventada (punto explicito del usuario). "Entregado" gana si hay
        // registro; si no, "no-deadline" (se muestra como "Documento
        // faltante -- sin fecha limite", no como "Pendiente" generico).
        events.push({
          id: "productive-doc:" + (ctx.ficha || "*") + ":" + doc.id,
          type: TYPE.DOCUMENTO,
          title: doc.title,
          description: doc.deliveryLabel,
          source: "productive-stage-document",
          sourceId: doc.id,
          date: "",
          startAt: "",
          endAt: "",
          dueAt: "",
          allDay: false,
          status: record ? STATUS.DELIVERED : STATUS.NO_DEADLINE,
          ficha: ctx.ficha || null,
          group: ctx.grupo || null,
          institution: ctx.institucionLong || null,
          route: "etapa-productiva-estudiante.html",
          priority: 0,
          isDerived: true,
        });
      }
    });
    return events;
  }

  // ── Punto de entrada ─────────────────────────────────────────────────────
  // input.context: { ficha, grupo, institucionShort, institucionLong,
  //   usernameKey (modo aprendiz; ausente = vista de solo-ficha/admin),
  //   hasProductiveStage (bool, resuelto por el llamador) }
  // input.deliveredGuideActivityKeys: array/Set de "pageFile::activityId" ya
  //   entregados EN ESTE EQUIPO (fuente local, ver limitaciones) -- opcional.
  function buildAcademicAgenda(input) {
    var opts = input && typeof input === "object" ? input : {};
    var ctx = opts.context && typeof opts.context === "object" ? opts.context : {};
    var now = safeNow(opts.now);

    var events = [].concat(
      buildCalendarEvents(ctx, opts.calendarRecords, opts.calendarOverrides, now),
      buildGuideDeadlineEvents(ctx, opts.deadlinesSnapshot, opts.guideCatalog, opts.deliveredGuideActivityKeys, now),
      buildProductiveStageEvents(ctx, opts.productiveStageSnapshot, opts.documentCatalog, now)
    );

    // "No duplicar": mismo id nunca deberia repetirse (cada adaptador arma
    // ids deterministicos por fuente real), pero se deduplica de forma
    // defensiva por si dos fuentes coinciden en el mismo id.
    var seen = {};
    var deduped = events.filter(function (event) {
      if (seen[event.id]) return false;
      seen[event.id] = true;
      return true;
    });

    deduped.sort(function (a, b) {
      var ax = a.dueAt || a.startAt || (a.date ? a.date + "T00:00:00.000Z" : "");
      var bx = b.dueAt || b.startAt || (b.date ? b.date + "T00:00:00.000Z" : "");
      return String(ax).localeCompare(String(bx));
    });

    return { events: deduped, generatedAt: now.toISOString() };
  }

  return {
    TYPE: TYPE,
    STATUS: STATUS,
    CALENDAR_STATUS: CALENDAR_STATUS,
    buildAcademicAgenda: buildAcademicAgenda,
    parseHorarioSlots: parseHorarioSlots,
  };
});
