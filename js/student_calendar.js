/**
 * student_calendar.js — Vista "Agenda" del aprendiz.
 *
 * Fase Agenda Academica (bloque C, 2026-08-24): reemplaza la logica anterior
 * (limitada a "proximas clases", ver historial en git) por consumo directo
 * del agregador central. Ya NO reimplementa filtrado por institucion/grado
 * ni override de calendario por su cuenta -- todo eso vive ahora en
 * js/academic_agenda_context.js (resolucion de contexto) y
 * js/academic_agenda.js (normalizacion, puro). Este archivo solo RENDERIZA.
 *
 * Bloque E (vistas y horarios, 2026-08-26): agrega las vistas Semana/Mes
 * (compartidas con la agenda admin via js/academic_agenda_views.js +
 * js/academic_agenda_calendar_ui.js) y los eventos manuales del admin EN
 * SOLO LECTURA (js/calendario_admin_manual_events.js expone
 * loadManualAgendaEvents() de forma segura para cualquier sesion firmada --
 * ver firestore.rules: lectura de sena_portal_calendar para cualquier
 * signedIn(), escritura solo admin). El aprendiz NUNCA ve botones de editar
 * ni eliminar -- eso es exclusivo del panel admin.
 *
 * Requisitos previos en la pagina (ver pages/auxiliares/calendario-aprendiz.html):
 *   - portal_auth.js, firebase_auth_bridge.js, firebase_db.js
 *   - data/calendario_2026_records.js  (window.CALENDAR_2026_RECORDS)
 *   - activity_deadlines.js, guide_declarations.js, activity_standard.js
 *   - productive_stage_store.js, productive_stage_deadlines.js
 *   - academic_agenda.js, academic_agenda_context.js,
 *     academic_agenda_views.js, academic_agenda_calendar_ui.js,
 *     agenda_view_preference.js, calendario_admin_manual_events.js
 */
(function () {
  "use strict";

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  var TYPE_META = {
    CLASE: { icon: "🕒", label: "Clase" },
    ENTREGA: { icon: "📌", label: "Entrega" },
    BITACORA: { icon: "📒", label: "Bitácora" },
    DOCUMENTO: { icon: "📄", label: "Documento" },
    ACTIVIDAD_ESPECIAL: { icon: "📋", label: "Actividad especial" },
  };

  var STATUS_META = {
    // Deliverable-shaped (ver productiveStageDeadlines.STATUS)
    "pending": { label: "Pendiente", cls: "pending" },
    "due-today": { label: "Vence hoy", cls: "soon" },
    "due-tomorrow": { label: "Vence mañana", cls: "soon" },
    "overdue": { label: "Vencida", cls: "overdue" },
    "delivered": { label: "Entregada", cls: "done" },
    "no-deadline": { label: "Sin fecha límite", cls: "pending" },
    // Calendario (ver academicAgenda.CALENDAR_STATUS)
    "scheduled": { label: "Programada", cls: "scheduled" },
    "cancelled": { label: "Cancelada", cls: "cancelled" },
    "rescheduled": { label: "Reprogramada", cls: "rescheduled" },
  };

  var SOURCE_LABEL = {
    "calendar": "Calendario académico",
    "guide-deadline": "Guía",
    "productive-stage-deadline": "Etapa Productiva",
    "productive-stage-document": "Etapa Productiva",
    "manual": "Aviso del instructor",
  };

  var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  var state = {
    events: [],
    context: null,
    view: "agenda",
    referenceDate: new Date(),
  };

  function byId(id) { return document.getElementById(id); }

  function formatDateTime(event) {
    if (event.allDay && event.date) {
      var d = new Date(event.date + "T12:00:00-05:00");
      if (!Number.isNaN(d.getTime())) {
        return DAY_NAMES[d.getUTCDay()] + " " + d.getUTCDate() + " de " + MONTH_NAMES[d.getUTCMonth()] + " · todo el día";
      }
    }
    var iso = event.dueAt || event.startAt || "";
    if (!iso) return event.date || "Sin fecha";
    var parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return event.date || "Sin fecha";
    var text = parsed.toLocaleString("es-CO", {
      timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
    });
    if (event.endAt) {
      var endParsed = new Date(event.endAt);
      if (!Number.isNaN(endParsed.getTime())) {
        text += " – " + endParsed.toLocaleString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
      }
    }
    return text;
  }

  function eventDateKey(event) {
    var iso = event.dueAt || event.startAt || (event.date ? event.date + "T00:00:00" : "");
    return iso ? String(iso).slice(0, 10) : "";
  }

  // El aprendiz SOLO visualiza -- este renderCard nunca incluye botones de
  // editar/eliminar, ni para eventos derivados ni para avisos manuales del
  // admin (a diferencia de calendario_admin_agenda_page.js).
  function renderCard(event) {
    var typeMeta = TYPE_META[event.type] || { icon: "•", label: event.type };
    var statusMeta = STATUS_META[event.status] || { label: event.status || "—", cls: "pending" };
    var sourceLabel = SOURCE_LABEL[event.source] || event.source;
    var goButton = event.route
      ? '<a class="c-btn c-btn--ghost agenda-card__go" href="' + escapeHtml(event.route) + '">Ir a la actividad →</a>'
      : "";

    return (
      '<article class="agenda-card" data-status="' + escapeHtml(event.status) + '" data-type="' + escapeHtml(event.type) + '">' +
        '<header class="agenda-card__head">' +
          '<span class="agenda-card__type">' + typeMeta.icon + " " + escapeHtml(typeMeta.label) + "</span>" +
          '<span class="agenda-status agenda-status--' + escapeHtml(statusMeta.cls) + '">' + escapeHtml(statusMeta.label) + "</span>" +
        "</header>" +
        '<h3 class="agenda-card__title">' + escapeHtml(event.title) + "</h3>" +
        '<p class="agenda-card__datetime">' + escapeHtml(formatDateTime(event)) + "</p>" +
        (event.description ? '<p class="agenda-card__desc">' + escapeHtml(event.description) + "</p>" : "") +
        '<footer class="agenda-card__foot">' +
          '<span class="agenda-card__source">' + escapeHtml(sourceLabel) + "</span>" +
          goButton +
        "</footer>" +
      "</article>"
    );
  }

  function renderMessage(rootEl, title, body, kind) {
    var cls = "msg " + (kind === "error" ? "msg--error" : kind === "warn" ? "msg--warn" : "msg--info");
    rootEl.innerHTML = '<div class="' + cls + '"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(body) + "</p></div>";
  }

  function renderHeaderMeta(context, learnerName) {
    var elInst = byId("sc-meta-inst");
    var elGrupo = byId("sc-meta-grupo");
    var elFicha = byId("sc-meta-ficha");
    var elName = byId("sc-meta-name");
    if (elInst) elInst.textContent = context.institucionShort || context.institucionLong || "—";
    if (elGrupo) elGrupo.textContent = context.grupo || "—";
    if (elFicha) elFicha.textContent = context.ficha || "—";
    if (elName) elName.textContent = learnerName || "";
  }

  async function ensureDependenciesLoaded() {
    var timeoutMs = 6000;
    var start = Date.now();
    while (!(window.academicAgendaContext && window.academicAgenda && window.academicAgendaViews && window.academicAgendaCalendarUi)) {
      if (Date.now() - start > timeoutMs) return false;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    return true;
  }

  // Eventos manuales del admin, en SOLO LECTURA: visibles si son generales
  // (sin ficha) o si coinciden con la ficha del aprendiz. Falla en silencio
  // hacia una lista vacia (nunca bloquea la agenda del aprendiz por esto).
  async function loadManualEventsForFicha(ficha) {
    var mod = window.calendarioAdminManualEvents;
    if (!mod || typeof mod.loadManualAgendaEvents !== "function") return [];
    try {
      var events = await mod.loadManualAgendaEvents();
      return events.filter(function (ev) { return !ev.ficha || String(ev.ficha) === String(ficha); });
    } catch (e) {
      return [];
    }
  }

  async function loadAndRender() {
    var rootEl = byId("sc-list");
    var statusEl = byId("sc-status");
    if (!rootEl) return;

    var auth = window.portalAuth;
    var session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.user) {
      renderMessage(rootEl, "Sesión no válida", "Inicia sesión como aprendiz para ver tu agenda académica.", "warn");
      return;
    }

    if (statusEl) statusEl.textContent = "Cargando…";

    var depsReady = await ensureDependenciesLoaded();
    if (!depsReady) {
      renderMessage(rootEl, "No se pudo cargar la agenda", "Intenta recargar la página en unos segundos.", "error");
      if (statusEl) statusEl.textContent = "";
      return;
    }

    var input;
    try {
      input = await window.academicAgendaContext.resolveStudentAgendaContext();
    } catch (e) {
      input = null;
    }
    if (!input) {
      renderMessage(rootEl, "No fue posible identificar tu ficha", "Verifica tu sesión o consulta con el instructor.", "warn");
      if (statusEl) statusEl.textContent = "";
      return;
    }

    state.context = input.context;
    renderHeaderMeta(input.context, session.user.fullName || session.user.username || "");

    var result;
    var manualEvents;
    try {
      result = window.academicAgenda.buildAcademicAgenda(input);
      manualEvents = await loadManualEventsForFicha(input.context.ficha);
    } catch (e) {
      renderMessage(rootEl, "Error al construir la agenda", "Intenta nuevamente más tarde.", "error");
      if (statusEl) statusEl.textContent = "";
      return;
    }

    state.events = (result.events || []).concat(manualEvents || []);
    renderCurrentView();

    if (statusEl) {
      statusEl.textContent = state.events.length + (state.events.length === 1 ? " evento" : " eventos") +
        " · Actualizado " + new Date(result.generatedAt).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
    }
  }

  // ── Vistas: Agenda (lista) / Semana / Mes (Bloque E) ────────────────────

  function renderCurrentView() {
    var listEl = byId("sc-list");
    var weekEl = byId("sc-week");
    var monthEl = byId("sc-month");
    var switcherEl = byId("sc-view-switcher");
    var navEl = byId("sc-view-nav");

    if (switcherEl) {
      switcherEl.innerHTML = window.academicAgendaCalendarUi.renderViewSwitcher(state.view, "sc");
      switcherEl.querySelectorAll("[data-sc-view]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var view = btn.getAttribute("data-sc-view");
          if (view === state.view) return;
          state.view = view;
          if (window.agendaViewPreference) window.agendaViewPreference.setPreferredView(view);
          renderCurrentView();
        });
      });
    }

    if (listEl) listEl.hidden = state.view !== "agenda";
    if (weekEl) weekEl.hidden = state.view !== "week";
    if (monthEl) monthEl.hidden = state.view !== "month";
    if (navEl) navEl.hidden = state.view === "agenda";

    if (state.view === "week") {
      renderWeek();
    } else if (state.view === "month") {
      renderMonth();
    } else {
      renderList();
    }
    renderNav();
  }

  function renderList() {
    var rootEl = byId("sc-list");
    if (!rootEl) return;
    if (!state.events.length) {
      rootEl.innerHTML = '<div class="empty-state"><h3>Sin eventos próximos</h3><p>No hay clases, entregas ni pendientes registrados para tu ficha por ahora.</p></div>';
      return;
    }
    rootEl.innerHTML = state.events.map(renderCard).join("");
  }

  function renderNav() {
    var navEl = byId("sc-view-nav");
    if (!navEl || state.view === "agenda") return;
    var label = "";
    if (state.view === "week") {
      var week = window.academicAgendaViews.buildWeekView({ events: [], referenceIso: state.referenceDate.toISOString() });
      var startD = new Date(week.weekStartDateKey + "T12:00:00-05:00");
      var endD = new Date(week.weekEndDateKey + "T12:00:00-05:00");
      label = startD.getUTCDate() + " – " + endD.getUTCDate() + " " + window.academicAgendaCalendarUi.MONTH_NAMES[endD.getUTCMonth()];
    } else {
      label = window.academicAgendaCalendarUi.MONTH_NAMES[state.referenceDate.getMonth()] + " " + state.referenceDate.getFullYear();
    }
    navEl.innerHTML =
      '<div class="aac-nav">' +
        '<button type="button" class="c-btn c-btn--ghost" id="sc-nav-prev">← Anterior</button>' +
        '<button type="button" class="c-btn c-btn--ghost" id="sc-nav-today">Hoy</button>' +
        '<span class="aac-nav__label">' + escapeHtml(label) + "</span>" +
        '<button type="button" class="c-btn c-btn--ghost" id="sc-nav-next">Siguiente →</button>' +
      "</div>";
    var prevBtn = byId("sc-nav-prev");
    var nextBtn = byId("sc-nav-next");
    var todayBtn = byId("sc-nav-today");
    if (prevBtn) prevBtn.addEventListener("click", function () { shiftReference(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { shiftReference(1); });
    if (todayBtn) todayBtn.addEventListener("click", function () { state.referenceDate = new Date(); renderCurrentView(); });
  }

  function shiftReference(direction) {
    var d = new Date(state.referenceDate.getTime());
    if (state.view === "week") {
      d.setUTCDate(d.getUTCDate() + direction * 7);
    } else {
      d.setUTCMonth(d.getUTCMonth() + direction);
    }
    state.referenceDate = d;
    renderCurrentView();
  }

  function renderWeek() {
    var weekEl = byId("sc-week");
    if (!weekEl) return;
    var model = window.academicAgendaViews.buildWeekView({ events: state.events, referenceIso: state.referenceDate.toISOString() });
    weekEl.innerHTML = window.academicAgendaCalendarUi.renderWeekGrid(model);
    bindChipHandlers(weekEl);
  }

  function renderMonth() {
    var monthEl = byId("sc-month");
    if (!monthEl) return;
    var model = window.academicAgendaViews.buildMonthView({
      year: state.referenceDate.getFullYear(),
      month: state.referenceDate.getMonth() + 1,
      events: state.events,
    });
    monthEl.innerHTML = window.academicAgendaCalendarUi.renderMonthGrid(model, { maxPerDay: 3 });
    bindChipHandlers(monthEl);
    monthEl.querySelectorAll("[data-month-day]").forEach(function (el) {
      el.addEventListener("click", function (evt) {
        if (evt.target.closest(".aac-chip")) return;
        openDayDetailModal(el.getAttribute("data-month-day"));
      });
    });
  }

  function bindChipHandlers(rootEl) {
    rootEl.querySelectorAll("[data-event-id]").forEach(function (chip) {
      chip.addEventListener("click", function (evt) {
        evt.stopPropagation();
        openEventDetail(chip.getAttribute("data-event-id"));
      });
    });
  }

  function openDayDetailModal(dateKey) {
    var modal = byId("sc-day-detail-modal");
    var body = byId("sc-day-detail-body");
    var title = byId("sc-day-detail-title");
    if (!modal || !body) return;
    var dayEvents = state.events.filter(function (ev) {
      return eventDateKey(ev) === dateKey || (ev.allDay && ev.date === dateKey);
    });
    if (title) {
      var d = new Date(dateKey + "T12:00:00-05:00");
      title.textContent = Number.isNaN(d.getTime()) ? dateKey : (DAY_NAMES[d.getUTCDay()] + " " + d.getUTCDate() + " de " + MONTH_NAMES[d.getUTCMonth()]);
    }
    body.innerHTML = window.academicAgendaCalendarUi.renderDayDetailList(dayEvents, { renderCard: renderCard });
    modal.hidden = false;
  }

  function openEventDetail(eventId) {
    var event = state.events.find(function (ev) { return ev.id === eventId; });
    if (!event) return;
    var modal = byId("sc-day-detail-modal");
    var body = byId("sc-day-detail-body");
    var title = byId("sc-day-detail-title");
    if (!modal || !body) return;
    if (title) title.textContent = event.title;
    body.innerHTML = window.academicAgendaCalendarUi.renderDayDetailList([event], { renderCard: renderCard });
    modal.hidden = false;
  }

  function closeDayDetailModal() {
    var modal = byId("sc-day-detail-modal");
    if (modal) modal.hidden = true;
  }

  function bootstrap() {
    if (window.agendaViewPreference) state.view = window.agendaViewPreference.getPreferredView();
    var btnReload = byId("sc-reload");
    if (btnReload) btnReload.addEventListener("click", function () { loadAndRender(); });
    var dayDetailClose = byId("sc-day-detail-close");
    if (dayDetailClose) dayDetailClose.addEventListener("click", closeDayDetailModal);
    loadAndRender();
  }

  window.studentCalendar = {
    load: loadAndRender,
    __test: { eventDateKey: eventDateKey },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
