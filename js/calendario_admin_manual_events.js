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
 * - type: "ACTIVIDAD_ESPECIAL" (default, mismo bucket que ya usa
 *   academic_agenda.js para REUNIÓN RECTOR/DESPLAZAMIENTO/SENA del
 *   calendario legacy) o "CLASE" (Bloque F.1: "Nueva clase" desde la Agenda
 *   Administrativa -- se guarda aqui, NUNCA en CALENDAR_2026_RECORDS ni en
 *   calendario_2026_admin, para no tocar el registro legacy). No se inventa
 *   ningun otro tipo nuevo en el agregador.
 * - status: uno de academicAgenda.CALENDAR_STATUS (scheduled/cancelled/
 *   rescheduled) -- vocabulario ya existente, sin duplicarlo aqui.
 * - ficha/grupo/institucion son OPCIONALES: vacio = evento general (visible
 *   para todas las fichas en la vista admin).
 * - tema (Bloque F.1): opcional, se antepone a la descripcion como
 *   "Tema: {tema}" al normalizar el evento (toAgendaEvent) -- igual que el
 *   admin ya podia asignarle un "tema" (via act.nombre) a una clase legacy.
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
  var MANUAL_EVENT_TYPES = ["ACTIVIDAD_ESPECIAL", "CLASE"];

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

  function slotMinutes(iso) {
    var match = String(iso || "").match(/T(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  }

  function validateInput(input) {
    var title = String((input && input.title) || "").trim();
    var date = String((input && input.date) || "").trim();
    var isClass = input && input.type === "CLASE";
    if (isClass && !String((input && input.ficha) || "").trim()) return "Selecciona la ficha de la clase.";
    if (!title) return isClass ? "Escribe el tema de la clase." : "El titulo es obligatorio.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "La fecha debe tener formato AAAA-MM-DD.";

    if (!(input && input.allDay)) {
      var slots = normalizeSlotsInput(input);
      if (!slots.length) return isClass ? "Indica la hora de inicio y la hora de fin." : "Indica al menos una franja horaria (hora inicio y hora fin) o marca Todo el día.";
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i].startAt || !slots[i].endAt) return "Cada franja horaria necesita hora de inicio y hora de fin.";
        var start = slotMinutes(slots[i].startAt);
        var end = slotMinutes(slots[i].endAt);
        if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
          return "La hora de fin debe ser posterior a la hora de inicio.";
        }
      }
    }
    return "";
  }

  // Id de un evento NUEVO. El formulario lo genera UNA sola vez al abrirse y
  // lo reenvia en cada reintento: asi un timeout + reintento nunca crea una
  // segunda clase (la escritura es un upsert por id).
  function newManualEventId() {
    return "manual-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  function strictApiAvailable(dbApi) {
    return Boolean(dbApi && typeof dbApi.cloudUpdateCalendarStrict === "function" && typeof dbApi.cloudGetCalendarStrict === "function");
  }

  var MESSAGES = {
    unavailable: "El guardado seguro en la nube no esta disponible. Recarga la pagina e intenta de nuevo.",
    readFailed: "No se pudo leer la agenda en la nube. No se guardo nada (asi no se borra ninguna clase existente). Intenta de nuevo.",
    conflict: "La agenda cambio varias veces seguidas desde otro equipo o pestaña. No se guardo nada; intenta de nuevo.",
    notSaved: "No se pudo guardar. Tus datos siguen en el formulario: usa Reintentar.",
    unconfirmed: "No fue posible confirmar si se guardo (la nube no respondio). Revisa tu conexion y usa Reintentar: no se duplicara.",
  };

  // Relee (estricto) y busca el id: la unica forma honesta de responder
  // despues de una escritura ambigua (timeout / respuesta perdida).
  // -> "present" (con ese updatedAt si se pasa) | "absent" | "unknown"
  async function verifyRecord(dbApi, id, expectedUpdatedAt) {
    var read = await withTimeout(dbApi.cloudGetCalendarStrict(CALENDAR_ID), CLOUD_TIMEOUT_MS, { status: "error" });
    if (!read || read.status === "error") return "unknown";
    var list = unwrapCalendarSnapshot(read.snapshot).events;
    var found = (Array.isArray(list) ? list : []).find(function (ev) { return ev && ev.id === id; });
    if (!found) return "absent";
    if (expectedUpdatedAt && found.updatedAt !== expectedUpdatedAt) return "absent";
    return "present";
  }

  // Crea o actualiza (upsert por id) SIN riesgo de borrar lo ajeno:
  //   * lectura fallida           -> cero escrituras (read-failed);
  //   * otra pestaña escribio     -> se relee y se reaplica por id;
  //   * respuesta ambigua/timeout -> se verifica releyendo antes de decir
  //     "no se guardo" (y el reintento usa el MISMO id: nunca duplica).
  // -> { ok, record, code, message }
  async function saveManualEvent(input) {
    var error = validateInput(input);
    if (error) return { ok: false, code: "validation", message: error };

    var dbApi = db();
    if (!strictApiAvailable(dbApi)) return { ok: false, code: "unavailable", message: MESSAGES.unavailable };

    var nowIso = new Date().toISOString();
    var id = String((input && input.id) || "").trim() || newManualEventId();

    var isAllDay = !!input.allDay;
    var slots = isAllDay ? [] : normalizeSlotsInput(input);

    var record = {
      id: id,
      type: MANUAL_EVENT_TYPES.indexOf(input.type) !== -1 ? input.type : "ACTIVIDAD_ESPECIAL",
      title: String(input.title).trim(),
      tema: String(input.tema || "").trim(),
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

    // Se aplica sobre la version LEIDA en cada intento (si hubo conflicto,
    // sobre la version nueva): nunca sobre una lista vieja en memoria.
    function applyUpsert(state) {
      var events = Array.isArray(state.events) ? state.events.slice() : [];
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
      return Object.assign({}, state, { events: events });
    }

    var result = await withTimeout(
      Promise.resolve().then(function () { return dbApi.cloudUpdateCalendarStrict(CALENDAR_ID, applyUpsert); }),
      CLOUD_TIMEOUT_MS,
      { ok: false, status: "timeout" }
    );
    if (result && result.ok) return { ok: true, code: "saved", record: record };
    if (result && result.status === "read-failed") return { ok: false, code: "read-failed", message: MESSAGES.readFailed, id: id };
    if (result && result.status === "conflict-exhausted") return { ok: false, code: "conflict", message: MESSAGES.conflict, id: id };

    // write-failed / timeout: la escritura pudo haberse aplicado igual.
    var check = await verifyRecord(dbApi, id, record.updatedAt);
    if (check === "present") return { ok: true, code: "saved-verified", record: record };
    if (check === "absent") return { ok: false, code: "not-saved", message: MESSAGES.notSaved, id: id };
    return { ok: false, code: "unconfirmed", message: MESSAGES.unconfirmed, id: id };
  }

  // Elimina SOLO ese id. Mismas garantias que saveManualEvent: lectura
  // fallida = cero escrituras, conflicto = releer (nunca revive ni borra lo
  // que otra pestaña cambio), respuesta ambigua = verificar releyendo.
  async function deleteManualEvent(id) {
    var targetId = String(id || "").trim();
    if (!targetId) return { ok: false, code: "validation", message: "Falta el id del evento a eliminar." };

    var dbApi = db();
    if (!strictApiAvailable(dbApi)) return { ok: false, code: "unavailable", message: MESSAGES.unavailable };

    function applyDelete(state) {
      var events = Array.isArray(state.events) ? state.events : [];
      var filtered = events.filter(function (ev) { return !(ev && ev.id === targetId); });
      if (filtered.length === events.length) return { abort: "not-found" };
      return Object.assign({}, state, { events: filtered });
    }

    var result = await withTimeout(
      Promise.resolve().then(function () { return dbApi.cloudUpdateCalendarStrict(CALENDAR_ID, applyDelete); }),
      CLOUD_TIMEOUT_MS,
      { ok: false, status: "timeout" }
    );
    if (result && result.ok) return { ok: true, code: "deleted" };
    if (result && result.status === "aborted") return { ok: false, code: "not-found", message: "El evento ya no existe." };
    if (result && result.status === "read-failed") return { ok: false, code: "read-failed", message: "No se pudo leer la agenda en la nube. No se elimino nada. Intenta de nuevo." };
    if (result && result.status === "conflict-exhausted") return { ok: false, code: "conflict", message: MESSAGES.conflict };

    var check = await verifyRecord(dbApi, targetId, "");
    if (check === "absent") return { ok: true, code: "deleted-verified" };
    if (check === "present") return { ok: false, code: "not-deleted", message: "No se pudo eliminar. Intenta de nuevo." };
    return { ok: false, code: "unconfirmed", message: "No fue posible confirmar si se elimino (la nube no respondio). Revisa tu conexion e intenta de nuevo." };
  }

  // Lectura para PINTAR la agenda del admin, distinguiendo "no hay eventos"
  // de "no se pudo leer" (para avisarlo en vez de mostrar una agenda vacia).
  // -> { ok, records }
  async function loadManualEventRecordsStrict() {
    var dbApi = db();
    if (!strictApiAvailable(dbApi)) return { ok: false, records: [] };
    var read = await withTimeout(dbApi.cloudGetCalendarStrict(CALENDAR_ID), CLOUD_TIMEOUT_MS, { status: "error" });
    if (!read || read.status === "error") return { ok: false, records: [] };
    var list = unwrapCalendarSnapshot(read.snapshot).events;
    return { ok: true, records: Array.isArray(list) ? list : [] };
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
    var tema = String(record.tema || "").trim();
    var description = [tema ? ("Tema: " + tema) : "", record.description || ""].filter(Boolean).join(" — ");
    var base = {
      type: record.type || "ACTIVIDAD_ESPECIAL",
      title: record.title,
      description: description,
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

  // ── Horario sugerido para "Agregar clase" (puro, sin red) ───────────────
  // Fuente: los registros del calendario academico (CALENDAR_2026_RECORDS,
  // mismo dato que ya pinta la agenda) para ESE colegio + grupo + fecha. Se
  // sugiere hora solo si ese dia hay exactamente UNA franja de clase: con
  // varias franjas no hay forma honesta de elegir una, y sin registro no se
  // inventa ninguna (el instructor la escribe).
  function normalizeInst(value) {
    return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/institucion educativa|i\.e\./g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function parseClock(text) {
    var m = String(text || "").trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
    if (!m) return "";
    var h = Number(m[1]);
    var min = Number(m[2]);
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return "";
    return (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min;
  }

  function parseHorario(horario) {
    // Varias franjas vienen separadas por ";" o por salto de linea (ambos
    // formatos existen en CALENDAR_2026_RECORDS).
    return String(horario || "").split(/[;\n]+/).filter(function (part) { return part.trim(); }).map(function (part) {
      var pieces = part.split(/[–—-]/);
      if (pieces.length !== 2) return null;
      var start = parseClock(pieces[0]);
      var end = parseClock(pieces[1]);
      return start && end && end > start ? { start: start, end: end } : null;
    });
  }

  // -> { start, end, text } | { start:"", end:"", text } (varias franjas) | null
  function suggestClassSlot(records, info, date) {
    var inst = normalizeInst(info && info.inst);
    var grupo = String((info && info.grupo) || "").trim().toUpperCase();
    if (!inst || !grupo || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return null;
    var match = (Array.isArray(records) ? records : []).find(function (r) {
      return r && r.tipo === "CLASE" && r.fecha === date &&
        String(r.grado || "").trim().toUpperCase() === grupo &&
        normalizeInst(r.colegio) === inst;
    });
    if (!match) return null;
    var slots = parseHorario(match.horario);
    var text = String(match.horario || "").split(/[;\n]+/).map(function (p) { return p.trim(); }).filter(Boolean).join(" y ");
    if (slots.length === 1 && slots[0]) return { start: slots[0].start, end: slots[0].end, text: text };
    return { start: "", end: "", text: text };
  }

  async function loadManualAgendaEvents() {
    var records = await loadManualEventRecords();
    return records.reduce(function (all, record) { return all.concat(toAgendaEvent(record)); }, []);
  }

  window.calendarioAdminManualEvents = Object.freeze({
    CALENDAR_ID: CALENDAR_ID,
    MANUAL_EVENT_TYPES: MANUAL_EVENT_TYPES.slice(),
    loadManualEventRecords: loadManualEventRecords,
    loadManualEventRecordsStrict: loadManualEventRecordsStrict,
    loadManualAgendaEvents: loadManualAgendaEvents,
    saveManualEvent: saveManualEvent,
    deleteManualEvent: deleteManualEvent,
    newManualEventId: newManualEventId,
    suggestClassSlot: suggestClassSlot,
    toAgendaEvent: toAgendaEvent,
    __test: {
      validateInput: validateInput,
      MESSAGES: MESSAGES,
      unwrapCalendarSnapshot: unwrapCalendarSnapshot,
      withTimeout: withTimeout,
      CLOUD_TIMEOUT_MS: CLOUD_TIMEOUT_MS,
      normalizeSlotsInput: normalizeSlotsInput,
    },
  });
})();
