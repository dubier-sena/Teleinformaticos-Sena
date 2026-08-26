/* js/calendario_admin_manual_events.js
 *
 * CRUD de "eventos manuales" para la Agenda Administrativa (Bloque D).
 * Estos son eventos que el admin escribe a mano (reunion, recuperacion,
 * aviso...) SIN una fuente derivada existente (clase, deadline de guia,
 * bitacora...). Se guardan en su PROPIA coleccion de calendario
 * (sena_portal_calendar/calendario_2026_manual_events, misma coleccion que
 * ya usa calendario_2026_admin -- ver firestore.rules: lectura para
 * cualquier sesion autenticada, escritura solo admin -- por eso NO hace
 * falta ningun cambio de reglas) para que NUNCA se mezclen con datos
 * derivados de otras fuentes (deadlines, clases, Etapa Productiva): un
 * evento manual vive SOLO aqui, un evento derivado NUNCA se escribe aqui.
 *
 * reglas de negocio:
 * - type siempre "ACTIVIDAD_ESPECIAL" (mismo bucket que ya usa
 *   academic_agenda.js para REUNIÓN RECTOR/DESPLAZAMIENTO/SENA del
 *   calendario legacy -- no se inventa un tipo nuevo en el agregador).
 * - status: uno de academicAgenda.CALENDAR_STATUS (scheduled/cancelled/
 *   rescheduled) -- vocabulario ya existente, sin duplicarlo aqui.
 * - ficha/grupo/institucion son OPCIONALES: vacio = evento general (visible
 *   para todas las fichas en la vista admin).
 *
 * Bloque E (vistas y horarios, 2026-08-26): un evento manual ahora puede
 * ser "todo el dia" (record.allDay explicito, ya NO inferido de si vinieron
 * horas) o tener VARIAS franjas horarias en el mismo dia (record.slots,
 * array de {startAt,endAt} ISO). toAgendaEvent() SIEMPRE devuelve un array
 * (1 evento normalizado por franja) -- mismo patron que ya usa
 * academic_agenda.js#buildCalendarEvents para horarios legacy con varias
 * franjas separadas por ";". Los campos singulares startAt/endAt del
 * registro se conservan (primera franja / ultima franja) solo como
 * compatibilidad de lectura, nunca como la fuente real una vez hay slots.
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;

  var CALENDAR_ID = "calendario_2026_manual_events";
  var CLOUD_TIMEOUT_MS = 12000;

  function db() { return window._firebaseDb; }

  function unwrapCalendarSnapshot(doc) {
    if (!doc || typeof doc !== "object") return {};
    var state = doc.state && typeof doc.state === "object" && !Array.isArray(doc.state) ? doc.state : doc;
    return state && typeof state === "object" ? state : {};
  }

  // Verificado en navegador real (Bloque D): con el token de sesion admin
  // desincronizado, cloudGetCalendar/cloudSaveCalendar pueden quedar
  // pendientes indefinidamente (nunca resuelven ni rechazan) en vez de
  // fallar rapido -- comportamiento heredado de firebase_db.js, no de este
  // archivo. Sin este limite, el admin se queda mirando "Guardando..." para
  // siempre, sin ningun mensaje -- exactamente el tipo de falla silenciosa
  // que este bloque pide evitar. fallbackValue se resuelve como si la
  // llamada hubiera fallado (mismo shape que ya usa el .catch de al lado).
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

  function currentActor() {
    var auth = window.portalAuth;
    var session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    return (session && session.user && (session.user.fullName || session.user.username)) || "admin";
  }

  async function loadManualEventRecords() {
    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudGetCalendar !== "function") return [];
    var snapshot = await withTimeout(dbApi.cloudGetCalendar(CALENDAR_ID).catch(function () { return null; }), CLOUD_TIMEOUT_MS, null);
    var state = unwrapCalendarSnapshot(snapshot);
    return Array.isArray(state.events) ? state.events : [];
  }

  // Une input.slots (array de {startAt,endAt} ISO) con el fallback legacy
  // input.startAt/input.endAt (una sola franja) -- filtra filas vacias que
  // el formulario pudo dejar sin completar.
  function normalizeSlotsInput(input) {
    if (Array.isArray(input && input.slots) && input.slots.length) {
      return input.slots
        .filter(function (s) { return s && (String(s.startAt || "").trim() || String(s.endAt || "").trim()); })
        .map(function (s) { return { startAt: String(s.startAt || "").trim(), endAt: String(s.endAt || "").trim() }; });
    }
    if (input && (input.startAt || input.endAt)) {
      return [{ startAt: String(input.startAt || "").trim(), endAt: String(input.endAt || "").trim() }];
    }
    return [];
  }

  function validateInput(input) {
    var title = String((input && input.title) || "").trim();
    var date = String((input && input.date) || "").trim();
    if (!title) return "El titulo es obligatorio.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La fecha debe tener formato AAAA-MM-DD.";

    if (!(input && input.allDay)) {
      var slots = normalizeSlotsInput(input);
      if (!slots.length) return "Indica al menos una franja horaria (hora inicio y hora fin) o marca Todo el día.";
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i].startAt || !slots[i].endAt) return "Cada franja horaria necesita hora de inicio y hora de fin.";
      }
    }
    return "";
  }

  // Crea o actualiza (si input.id ya existe en la lista guardada). Lectura +
  // escritura del documento completo -- mismo patron y mismo riesgo de
  // carrera ya aceptado hoy por calendario-academico-2026.html para
  // calendario_2026_admin (uso admin-only, de baja concurrencia).
  async function saveManualEvent(input) {
    var error = validateInput(input);
    if (error) return { ok: false, message: error };

    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudSaveCalendar !== "function" || typeof dbApi.cloudGetCalendar !== "function") {
      return { ok: false, message: "El guardado en la nube no esta disponible en este momento." };
    }

    var nowIso = new Date().toISOString();
    var id = String((input && input.id) || "").trim() || ("manual-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7));

    var events;
    try {
      events = await loadManualEventRecords();
    } catch (e) {
      return { ok: false, message: "No se pudo leer los eventos manuales existentes." };
    }

    var isAllDay = !!input.allDay;
    var slots = isAllDay ? [] : normalizeSlotsInput(input);

    var record = {
      id: id,
      type: "ACTIVIDAD_ESPECIAL",
      title: String(input.title).trim(),
      description: String(input.description || "").trim(),
      date: String(input.date).trim(),
      allDay: isAllDay,
      slots: slots,
      // startAt/endAt singulares: compatibilidad de lectura (primera franja
      // / ultima franja) para cualquier consumidor que aun no conozca
      // "slots" -- toAgendaEvent() SIEMPRE usa "slots" cuando existe.
      startAt: !isAllDay && slots.length ? slots[0].startAt : "",
      endAt: !isAllDay && slots.length ? slots[slots.length - 1].endAt : "",
      status: ["scheduled", "cancelled", "rescheduled"].indexOf(input.status) !== -1 ? input.status : "scheduled",
      ficha: String(input.ficha || "").trim(),
      group: String(input.group || "").trim(),
      institution: String(input.institution || "").trim(),
      route: String(input.route || "").trim(),
      createdBy: (input && input.__existingCreatedBy) || currentActor(),
      createdAt: (input && input.__existingCreatedAt) || nowIso,
      updatedAt: nowIso,
    };

    var existingIdx = -1;
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].id === id) { existingIdx = i; break; }
    }
    if (existingIdx !== -1) {
      record.createdBy = events[existingIdx].createdBy || record.createdBy;
      record.createdAt = events[existingIdx].createdAt || record.createdAt;
      events[existingIdx] = record;
    } else {
      events.push(record);
    }

    try {
      // cloudSaveCalendar devuelve boolean (ver js/firebase_db.js). Con
      // timeout: si la nube nunca responde, no se deja al admin esperando
      // indefinidamente (ver comentario de withTimeout arriba).
      var saved = await withTimeout(dbApi.cloudSaveCalendar(CALENDAR_ID, { events: events }), CLOUD_TIMEOUT_MS, false);
      if (!saved) {
        return { ok: false, message: "No se pudo guardar el evento manual en la nube (sin respuesta o tiempo de espera agotado). Intenta de nuevo." };
      }
    } catch (e) {
      return { ok: false, message: "No se pudo guardar el evento manual en la nube." };
    }

    return { ok: true, record: record };
  }

  async function deleteManualEvent(id) {
    var targetId = String(id || "").trim();
    if (!targetId) return { ok: false, message: "Falta el id del evento a eliminar." };

    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudSaveCalendar !== "function") {
      return { ok: false, message: "El guardado en la nube no esta disponible en este momento." };
    }

    var events;
    try {
      events = await loadManualEventRecords();
    } catch (e) {
      return { ok: false, message: "No se pudo leer los eventos manuales existentes." };
    }

    var filtered = events.filter(function (ev) { return ev && ev.id !== targetId; });
    if (filtered.length === events.length) {
      return { ok: false, message: "El evento ya no existe." };
    }

    try {
      var saved = await withTimeout(dbApi.cloudSaveCalendar(CALENDAR_ID, { events: filtered }), CLOUD_TIMEOUT_MS, false);
      if (!saved) {
        return { ok: false, message: "No se pudo eliminar el evento en la nube (sin respuesta o tiempo de espera agotado). Intenta de nuevo." };
      }
    } catch (e) {
      return { ok: false, message: "No se pudo eliminar el evento en la nube." };
    }

    return { ok: true };
  }

  // Normaliza un registro manual al MISMO shape de evento que produce
  // academicAgenda.buildAcademicAgenda(), para que la vista pueda
  // renderizar ambos tipos de forma uniforme. isDerived:false es la unica
  // marca que distingue un evento manual de uno derivado en el render.
  //
  // SIEMPRE devuelve un ARRAY (1 evento por franja horaria) -- un registro
  // con varias "slots" se expande en varios eventos normalizados que
  // comparten sourceId (para que Editar/Eliminar sigan operando sobre el
  // UNICO registro real), igual que academic_agenda.js#buildCalendarEvents
  // ya hace con horarios legacy de varias franjas.
  function toAgendaEvent(record) {
    var base = {
      type: record.type || "ACTIVIDAD_ESPECIAL",
      title: record.title,
      description: record.description || "",
      source: "manual",
      sourceId: record.id,
      date: record.date,
      dueAt: "",
      status: record.status || "scheduled",
      ficha: record.ficha || null,
      group: record.group || null,
      institution: record.institution || null,
      route: record.route || "",
      priority: record.status === "cancelled" ? 90 : 50,
      isDerived: false,
      createdBy: record.createdBy || "",
      createdAt: record.createdAt || "",
      updatedAt: record.updatedAt || "",
    };

    if (record.allDay) {
      return [Object.assign({}, base, { id: "manual:" + record.id, startAt: "", endAt: "", allDay: true })];
    }

    var slots = Array.isArray(record.slots) && record.slots.length
      ? record.slots
      : ((record.startAt || record.endAt) ? [{ startAt: record.startAt || "", endAt: record.endAt || "" }] : []);

    if (!slots.length) {
      // Ni horas ni todo-el-dia (registro legacy incompleto): se trata como
      // todo-el-dia para no perder el evento -- nunca se descarta en silencio.
      return [Object.assign({}, base, { id: "manual:" + record.id, startAt: "", endAt: "", allDay: true })];
    }

    return slots.map(function (slot, index) {
      return Object.assign({}, base, {
        id: slots.length > 1 ? "manual:" + record.id + ":" + index : "manual:" + record.id,
        startAt: slot.startAt || "",
        endAt: slot.endAt || "",
        allDay: false,
      });
    });
  }

  async function loadManualAgendaEvents() {
    var records = await loadManualEventRecords();
    return records.reduce(function (all, record) { return all.concat(toAgendaEvent(record)); }, []);
  }

  window.calendarioAdminManualEvents = Object.freeze({
    CALENDAR_ID: CALENDAR_ID,
    loadManualEventRecords: loadManualEventRecords,
    loadManualAgendaEvents: loadManualAgendaEvents,
    saveManualEvent: saveManualEvent,
    deleteManualEvent: deleteManualEvent,
    toAgendaEvent: toAgendaEvent,
    __test: {
      validateInput: validateInput,
      unwrapCalendarSnapshot: unwrapCalendarSnapshot,
      withTimeout: withTimeout,
      CLOUD_TIMEOUT_MS: CLOUD_TIMEOUT_MS,
      normalizeSlotsInput: normalizeSlotsInput,
    },
  });
})();
