/**
 * js/calendario_admin_agenda_page.js — Vista "Agenda administrativa" (Bloque D + E).
 *
 * Controlador de pagina (impuro, toca el DOM): combina
 * js/academic_agenda_admin_context.js (skeleton de eventos derivados + roster)
 * con js/calendario_admin_manual_events.js (CRUD de eventos manuales) y
 * renderiza 3 vistas (Agenda/Semana/Mes) usando el modelo PURO de
 * js/academic_agenda_views.js + el constructor de HTML de
 * js/academic_agenda_calendar_ui.js (compartidos con js/student_calendar.js
 * -- la aritmetica de grilla es identica, solo cambia si hay o no acciones
 * de edicion). Este archivo solo RENDERIZA/ORQUESTA -- ninguna agregacion
 * ni logica de fecha/hora vive aqui.
 *
 * Requisitos previos en la pagina (ver calendario-administrativo-agenda.html):
 *   - portal_auth.js, firebase_auth_bridge.js, firebase_db.js, access_guard_admin.js
 *   - data/calendario_2026_records.js (window.CALENDAR_2026_RECORDS)
 *   - activity_standard.js, guide_declarations.js, activity_deadlines.js
 *   - productive_stage_store.js, productive_stage_deadlines.js
 *   - academic_agenda.js, academic_agenda_context.js (solo por sus constantes
 *     publicas), academic_agenda_admin_context.js, academic_agenda_views.js,
 *     academic_agenda_calendar_ui.js, agenda_view_preference.js,
 *     calendario_admin_manual_events.js
 *
 * Filtros: institucion/ficha/grupo cambian el SCOPE (requieren volver a
 * resolver el contexto -- tienen costo de red). tipo/guia/estado/rango de
 * fechas son PURAMENTE de presentacion sobre los eventos ya cargados (sin
 * red) -- se aplican al vuelo, en las 3 vistas.
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
    "pending": { label: "Pendiente", cls: "pending" },
    "due-today": { label: "Vence hoy", cls: "soon" },
    "due-tomorrow": { label: "Vence mañana", cls: "soon" },
    "overdue": { label: "Vencida", cls: "overdue" },
    "delivered": { label: "Entregada", cls: "done" },
    "no-deadline": { label: "Sin fecha límite", cls: "pending" },
    "scheduled": { label: "Programada", cls: "scheduled" },
    "cancelled": { label: "Cancelada", cls: "cancelled" },
    "rescheduled": { label: "Reprogramada", cls: "rescheduled" },
  };

  var SOURCE_LABEL = {
    "calendar": "Calendario académico",
    "guide-deadline": "Guía",
    "productive-stage-deadline": "Etapa Productiva",
    "productive-stage-document": "Etapa Productiva",
    "manual": "Evento manual",
  };

  var DAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  var state = {
    events: [],
    manualRecords: [],
    roster: [],
    fichaOptions: [],
    filters: { institucion: "", ficha: "", tipo: "", estado: "", guia: "", desde: "", hasta: "" },
    editingManualId: "",
    // Id del evento/clase que se esta creando: se genera UNA vez al abrir el
    // formulario y se reutiliza en cada reintento (nunca duplica).
    manualDraftId: "",
    classEditingId: "",
    classDraftId: "",
    // true mientras hay una escritura en curso: bloquea doble envio y el
    // cierre del modal (el formulario no se pierde).
    saving: false,
    manualLoadFailed: false,
    view: "agenda",
    referenceDate: new Date(),
    slotsDraft: [{ start: "", end: "" }],
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

  // ── Dependencias ───────────────────────────────────────────────────────

  async function ensureDependenciesLoaded() {
    var timeoutMs = 6000;
    var start = Date.now();
    while (!(window.academicAgendaAdminContext && window.academicAgenda && window.calendarioAdminManualEvents &&
      window.academicAgendaViews && window.academicAgendaCalendarUi)) {
      if (Date.now() - start > timeoutMs) return false;
      await new Promise(function (r) { setTimeout(r, 100); });
    }
    return true;
  }

  // ── Carga + filtros de scope (institucion/ficha) ────────────────────────

  function resolveScopedFichas() {
    var all = state.fichaOptions;
    var f = state.filters;
    return all
      .filter(function (opt) { return !f.ficha || opt.ficha === f.ficha; })
      .filter(function (opt) { return !f.institucion || opt.institucionLong === f.institucion; })
      .map(function (opt) { return opt.ficha; });
  }

  function populateFichaFilterUI() {
    var instSel = byId("aa-filter-institucion");
    var fichaSel = byId("aa-filter-ficha");
    if (!instSel || !fichaSel) return;

    var institutions = [];
    var seenInst = {};
    state.fichaOptions.forEach(function (opt) {
      if (!seenInst[opt.institucionLong]) { seenInst[opt.institucionLong] = true; institutions.push(opt.institucionLong); }
    });

    instSel.innerHTML = '<option value="">Todas las instituciones</option>' +
      institutions.map(function (inst) {
        return '<option value="' + escapeHtml(inst) + '">' + escapeHtml(inst) + "</option>";
      }).join("");

    fichaSel.innerHTML = '<option value="">Todas las fichas</option>' +
      state.fichaOptions.map(function (opt) {
        return '<option value="' + escapeHtml(opt.ficha) + '">' + escapeHtml(opt.ficha) + " — " + escapeHtml(opt.grupo) + " (" + escapeHtml(opt.institucionShort) + ")</option>";
      }).join("");

    var classFichaSel = document.querySelector("#aa-class-form [name=ficha]");
    if (classFichaSel) {
      classFichaSel.innerHTML = '<option value="">Selecciona la ficha…</option>' +
        state.fichaOptions.map(function (opt) {
          return '<option value="' + escapeHtml(opt.ficha) + '">' + escapeHtml(opt.ficha) + " — " + escapeHtml(opt.grupo) + " (" + escapeHtml(opt.institucionShort) + ")</option>";
        }).join("");
    }

    var manualFichaSel = document.querySelector("#aa-manual-form [name=ficha]");
    if (manualFichaSel) {
      manualFichaSel.innerHTML = '<option value="">Todas las fichas</option>' +
        state.fichaOptions.map(function (opt) {
          return '<option value="' + escapeHtml(opt.ficha) + '">' + escapeHtml(opt.ficha) + " — " + escapeHtml(opt.grupo) + " (" + escapeHtml(opt.institucionShort) + ")</option>";
        }).join("");
    }
  }

  function populateGuideFilterUI() {
    var sel = byId("aa-filter-guia");
    if (!sel) return;
    var seen = {};
    var options = [];
    state.events.forEach(function (ev) {
      if (ev.type !== "ENTREGA") return;
      var pageFile = String(ev.sourceId || "").split("::")[0];
      if (!pageFile || seen[pageFile]) return;
      seen[pageFile] = true;
      options.push({ file: pageFile, title: ev.title.split(" — ")[0] });
    });
    sel.innerHTML = '<option value="">Todas las guías</option>' +
      options.map(function (o) {
        return '<option value="' + escapeHtml(o.file) + '">' + escapeHtml(o.title) + "</option>";
      }).join("");
  }

  // ── Carga principal ──────────────────────────────────────────────────────

  async function loadAndRender() {
    var listEl = byId("aa-list");
    var statusEl = byId("aa-status");
    if (!listEl) return;

    var session = window.portalAuth && typeof window.portalAuth.getCurrentSession === "function"
      ? window.portalAuth.getCurrentSession() : null;
    if (!session || session.role !== "admin") {
      renderMessage(listEl, "Acceso restringido", "Esta vista es solo para el panel administrativo.", "warn");
      return;
    }

    if (statusEl) statusEl.textContent = "Cargando…";

    var depsReady = await ensureDependenciesLoaded();
    if (!depsReady) {
      renderMessage(listEl, "No se pudo cargar la agenda", "Intenta recargar la página en unos segundos.", "error");
      if (statusEl) statusEl.textContent = "";
      return;
    }

    if (!state.fichaOptions.length) {
      state.fichaOptions = window.academicAgendaAdminContext.listFichaOptions();
      populateFichaFilterUI();
    }

    var fichas = resolveScopedFichas();

    var adminResult;
    var manualRecords;
    try {
      var results = await Promise.all([
        window.academicAgendaAdminContext.resolveAdminAgendaContext({ fichas: fichas }),
        window.calendarioAdminManualEvents.loadManualEventRecordsStrict().catch(function () { return { ok: false, records: [] }; }),
      ]);
      adminResult = results[0];
      // Lectura fallida != "no hay clases": se avisa en vez de pintar una
      // agenda vacia (y los formularios siguen protegidos: no escriben si no
      // pueden leer).
      state.manualLoadFailed = !(results[1] && results[1].ok);
      manualRecords = (results[1] && results[1].records) || [];
    } catch (e) {
      renderMessage(listEl, "Error al construir la agenda", "Intenta nuevamente más tarde.", "error");
      if (statusEl) statusEl.textContent = "";
      return;
    }

    // Un evento manual sin ficha (general) siempre se muestra; uno con
    // ficha propia solo si esa ficha esta dentro del scope actual.
    var scopedManualRecords = manualRecords.filter(function (r) {
      return !r.ficha || fichas.indexOf(String(r.ficha)) !== -1;
    });
    var scopedManualEvents = scopedManualRecords.reduce(function (all, r) {
      return all.concat(window.calendarioAdminManualEvents.toAgendaEvent(r));
    }, []);

    state.manualRecords = manualRecords;
    state.events = (adminResult.events || []).concat(scopedManualEvents);
    state.roster = adminResult.roster || [];
    state.generatedAt = adminResult.generatedAt;

    populateGuideFilterUI();
    renderCurrentView();

    if (statusEl) {
      statusEl.textContent = state.events.length + (state.events.length === 1 ? " evento" : " eventos") +
        " · Actualizado " + new Date(adminResult.generatedAt).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }) +
        (state.manualLoadFailed ? " · ⚠ No se pudieron cargar las clases y eventos creados a mano. Pulsa Actualizar." : "");
      statusEl.setAttribute("data-kind", state.manualLoadFailed ? "warn" : "");
    }
  }

  function renderMessage(rootEl, title, body, kind) {
    var cls = "msg " + (kind === "error" ? "msg--error" : kind === "warn" ? "msg--warn" : "msg--info");
    rootEl.innerHTML = '<div class="' + cls + '"><h3>' + escapeHtml(title) + "</h3><p>" + escapeHtml(body) + "</p></div>";
  }

  // ── Filtros de presentacion (sin red) ───────────────────────────────────

  function applyPresentationFilters(events, filters) {
    var f = filters || state.filters;
    return events.filter(function (ev) {
      if (f.tipo && ev.type !== f.tipo) return false;
      if (f.estado && ev.status !== f.estado) return false;
      if (f.guia && String(ev.sourceId || "").indexOf(f.guia) !== 0) return false;
      var dateKey = eventDateKey(ev);
      if (f.desde && dateKey && dateKey < f.desde) return false;
      if (f.hasta && dateKey && dateKey > f.hasta) return false;
      return true;
    });
  }

  // ── Render: tarjeta completa (Agenda + modal de detalle de dia) ─────────

  function renderDeliverySummary(ev) {
    if (ev.type !== "ENTREGA" && ev.type !== "BITACORA" && ev.type !== "DOCUMENTO") return "";
    var s = ev.deliverySummary;
    if (!s) {
      return '<p class="admin-agenda-counts__unavailable">Conteo de entregas no calculado todavía para este evento.</p>';
    }
    return (
      '<div class="admin-agenda-counts">' +
        "<span><strong>" + s.total + "</strong> aprendices</span>" +
        "<span><strong>" + s.delivered + "</strong> entregaron</span>" +
        "<span><strong>" + s.pending + "</strong> pendientes</span>" +
        "<span><strong>" + s.overdue + "</strong> vencidos</span>" +
      "</div>"
    );
  }

  function renderCard(event) {
    var typeMeta = TYPE_META[event.type] || { icon: "•", label: event.type };
    var statusMeta = STATUS_META[event.status] || { label: event.status || "—", cls: "pending" };
    var sourceLabel = SOURCE_LABEL[event.source] || event.source;
    var isManual = event.isDerived === false;

    var metaChips = [];
    if (event.institution) metaChips.push(event.institution);
    if (event.ficha) metaChips.push("Ficha " + event.ficha);
    if (event.group) metaChips.push("Grupo " + event.group);
    if (!event.ficha && isManual) metaChips.push("Todas las fichas");

    var actions = "";
    if (isManual) {
      actions =
        '<button type="button" class="c-btn c-btn--ghost" data-manual-edit="' + escapeHtml(event.sourceId) + '">Editar</button>' +
        '<button type="button" class="c-btn c-btn--ghost" data-manual-delete="' + escapeHtml(event.sourceId) + '">Eliminar</button>';
    } else {
      actions = '<span class="admin-agenda-readonly-note">Editar fecha en el módulo de origen.</span>';
    }
    if (event.route) {
      actions = '<a class="c-btn c-btn--ghost" href="' + escapeHtml(event.route) + '">Ir al módulo →</a>' + actions;
    }

    return (
      '<article class="agenda-card" data-status="' + escapeHtml(event.status) + '" data-type="' + escapeHtml(event.type) + '">' +
        '<header class="agenda-card__head">' +
          '<span class="agenda-card__type">' + typeMeta.icon + " " + escapeHtml(typeMeta.label) + "</span>" +
          '<span class="admin-agenda-badge admin-agenda-badge--' + (isManual ? "manual" : "derivado") + '">' + (isManual ? "Manual" : "Derivado") + "</span>" +
          '<span class="agenda-status agenda-status--' + escapeHtml(statusMeta.cls) + '">' + escapeHtml(statusMeta.label) + "</span>" +
        "</header>" +
        '<h3 class="agenda-card__title">' + escapeHtml(event.title) + "</h3>" +
        '<p class="agenda-card__datetime">' + escapeHtml(formatDateTime(event)) + "</p>" +
        '<div class="admin-agenda-card__meta">' + metaChips.map(function (c) { return '<span class="admin-agenda-chip">' + escapeHtml(c) + "</span>"; }).join("") + "</div>" +
        (event.description ? '<p class="agenda-card__desc">' + escapeHtml(event.description) + "</p>" : "") +
        renderDeliverySummary(event) +
        '<footer class="agenda-card__foot">' +
          '<span class="agenda-card__source">' + escapeHtml(sourceLabel) + "</span>" +
          '<div class="admin-agenda-card__actions">' + actions + "</div>" +
        "</footer>" +
      "</article>"
    );
  }

  // ── Render: Agenda (lista) ───────────────────────────────────────────────

  function renderList() {
    var listEl = byId("aa-list");
    if (!listEl) return;
    var filtered = applyPresentationFilters(state.events);
    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state"><h3>Sin eventos</h3><p>No hay eventos que coincidan con los filtros actuales.</p></div>';
      return;
    }
    listEl.innerHTML = filtered.map(renderCard).join("");
    bindCardActionHandlers();
  }

  function bindCardActionHandlers() {
    var listEl = byId("aa-list");
    if (!listEl) return;
    listEl.querySelectorAll("[data-manual-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () { openManualModal(btn.getAttribute("data-manual-edit")); });
    });
    listEl.querySelectorAll("[data-manual-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () { handleDeleteManual(btn.getAttribute("data-manual-delete")); });
    });
  }

  // ── Render: Semana / Mes (Bloque E) ──────────────────────────────────────

  function renderCurrentView() {
    var listEl = byId("aa-list");
    var weekEl = byId("aa-week");
    var monthEl = byId("aa-month");
    var switcherEl = byId("aa-view-switcher");
    var navEl = byId("aa-view-nav");
    if (switcherEl) switcherEl.innerHTML = window.academicAgendaCalendarUi.renderViewSwitcher(state.view, "aa");
    bindViewSwitcherHandlers();

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

  function renderNav() {
    var navEl = byId("aa-view-nav");
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
        '<button type="button" class="c-btn c-btn--ghost" id="aa-nav-prev">← Anterior</button>' +
        '<button type="button" class="c-btn c-btn--ghost" id="aa-nav-today">Hoy</button>' +
        '<span class="aac-nav__label">' + escapeHtml(label) + "</span>" +
        '<button type="button" class="c-btn c-btn--ghost" id="aa-nav-next">Siguiente →</button>' +
      "</div>";
    var prevBtn = byId("aa-nav-prev");
    var nextBtn = byId("aa-nav-next");
    var todayBtn = byId("aa-nav-today");
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
    var weekEl = byId("aa-week");
    if (!weekEl) return;
    var filtered = applyPresentationFilters(state.events);
    var model = window.academicAgendaViews.buildWeekView({ events: filtered, referenceIso: state.referenceDate.toISOString() });
    weekEl.innerHTML = window.academicAgendaCalendarUi.renderWeekGrid(model);
    bindChipHandlers(weekEl);
  }

  function renderMonth() {
    var monthEl = byId("aa-month");
    if (!monthEl) return;
    var filtered = applyPresentationFilters(state.events);
    var model = window.academicAgendaViews.buildMonthView({
      year: state.referenceDate.getFullYear(),
      month: state.referenceDate.getMonth() + 1,
      events: filtered,
    });
    monthEl.innerHTML = window.academicAgendaCalendarUi.renderMonthGrid(model, { maxPerDay: 3 });
    bindChipHandlers(monthEl);
    monthEl.querySelectorAll("[data-month-day]").forEach(function (el) {
      el.addEventListener("click", function (evt) {
        if (evt.target.closest(".aac-chip")) return; // el chip ya abre su propio detalle
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
    var modal = byId("aa-day-detail-modal");
    var body = byId("aa-day-detail-body");
    var title = byId("aa-day-detail-title");
    if (!modal || !body) return;
    var dayEvents = applyPresentationFilters(state.events).filter(function (ev) {
      return eventDateKey(ev) === dateKey || (ev.allDay && ev.date === dateKey);
    });
    if (title) {
      var d = new Date(dateKey + "T12:00:00-05:00");
      title.textContent = Number.isNaN(d.getTime()) ? dateKey : (DAY_NAMES[d.getUTCDay()] + " " + d.getUTCDate() + " de " + MONTH_NAMES[d.getUTCMonth()]);
    }
    body.innerHTML = window.academicAgendaCalendarUi.renderDayDetailList(dayEvents, { renderCard: renderCard });
    bindCardActionHandlersIn(body);
    modal.hidden = false;
  }

  function openEventDetail(eventId) {
    var event = state.events.find(function (ev) { return ev.id === eventId; });
    if (!event) return;
    var modal = byId("aa-day-detail-modal");
    var body = byId("aa-day-detail-body");
    var title = byId("aa-day-detail-title");
    if (!modal || !body) return;
    if (title) title.textContent = event.title;
    body.innerHTML = window.academicAgendaCalendarUi.renderDayDetailList([event], { renderCard: renderCard });
    bindCardActionHandlersIn(body);
    modal.hidden = false;
  }

  function bindCardActionHandlersIn(root) {
    root.querySelectorAll("[data-manual-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-manual-edit");
        closeDayDetailModal();
        // Una clase simple (una franja) se edita en el formulario de clase;
        // cualquier otro registro (evento especial, todo el dia, varias
        // franjas) en el editor completo, que conserva todos sus campos.
        if (isSimpleClassRecord(findManualRecordById(id))) openClassModal(id);
        else openManualModal(id);
      });
    });
    root.querySelectorAll("[data-manual-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () { handleDeleteManual(btn.getAttribute("data-manual-delete")); });
    });
  }

  function closeDayDetailModal() {
    var modal = byId("aa-day-detail-modal");
    if (modal) modal.hidden = true;
  }

  function bindViewSwitcherHandlers() {
    var switcherEl = byId("aa-view-switcher");
    if (!switcherEl) return;
    switcherEl.querySelectorAll("[data-aa-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var view = btn.getAttribute("data-aa-view");
        if (view === state.view) return;
        state.view = view;
        if (window.agendaViewPreference) window.agendaViewPreference.setPreferredView(view);
        renderCurrentView();
      });
    });
  }

  // ── Conteos de entrega de guia bajo demanda ─────────────────────────────

  async function handleRefreshGuideCounts() {
    var btn = byId("aa-refresh-counts");
    var statusEl = byId("aa-refresh-counts-status");
    if (!window.academicAgendaAdminContext) return;
    if (btn) btn.disabled = true;

    try {
      await window.academicAgendaAdminContext.computeGuideDeliveryCounts(state.events, state.roster, function (progress) {
        if (statusEl) statusEl.textContent = "Calculando " + progress.done + "/" + progress.total + "…";
      });
      renderCurrentView();
      if (statusEl) statusEl.textContent = "Conteos actualizados.";
    } catch (e) {
      if (statusEl) statusEl.textContent = "No se pudieron actualizar los conteos.";
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Modal de evento manual (Bloque E: todo-el-dia + multiples franjas) ──

  function findManualRecordById(id) {
    return state.manualRecords.find(function (r) { return r && r.id === id; }) || null;
  }

  function renderSlotsSection() {
    var list = byId("aa-manual-slots-list");
    if (!list) return;
    list.innerHTML = state.slotsDraft.map(function (slot, index) {
      return (
        '<div class="admin-agenda-form__row aa-slot-row" data-slot-index="' + index + '">' +
          '<label>Hora inicio<input class="c-input aa-slot-start" type="time" value="' + escapeHtml(slot.start) + '"></label>' +
          '<label>Hora fin<input class="c-input aa-slot-end" type="time" value="' + escapeHtml(slot.end) + '"></label>' +
          (state.slotsDraft.length > 1 ? '<button type="button" class="c-btn c-btn--ghost aa-slot-remove" data-slot-index="' + index + '">Quitar franja</button>' : "") +
        "</div>"
      );
    }).join("");

    list.querySelectorAll(".aa-slot-start").forEach(function (input, i) {
      input.addEventListener("change", function () { state.slotsDraft[i].start = input.value; });
    });
    list.querySelectorAll(".aa-slot-end").forEach(function (input, i) {
      input.addEventListener("change", function () { state.slotsDraft[i].end = input.value; });
    });
    list.querySelectorAll(".aa-slot-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = Number(btn.getAttribute("data-slot-index"));
        state.slotsDraft.splice(idx, 1);
        renderSlotsSection();
      });
    });
  }

  function toggleAllDaySection() {
    var checkbox = byId("aa-manual-allday");
    var section = byId("aa-manual-slots-section");
    if (!checkbox || !section) return;
    section.hidden = checkbox.checked;
  }

  // ── Guardado comun (clase y evento especial) ───────────────────────────
  // Estados del boton: "Guardar …" -> "Guardando…" -> "… guardada ✓", o en
  // error "Reintentar" SIN borrar el formulario. Mientras guarda: boton
  // deshabilitado (doble clic = 1 sola operacion) y el modal no se puede
  // cerrar (ni ✕, ni Cancelar, ni Escape).
  function setFormBusy(prefix, busy) {
    ["-submit", "-cancel", "-modal-close"].forEach(function (suffix) {
      var el = byId(prefix + suffix);
      if (el) el.disabled = !!busy;
    });
    var modal = byId(prefix + "-modal");
    if (modal) modal.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function setFeedback(prefix, text, kind) {
    var feedback = byId(prefix + "-feedback");
    if (!feedback) return;
    feedback.textContent = text || "";
    if (kind) feedback.setAttribute("data-kind", kind);
    else feedback.removeAttribute("data-kind");
  }

  async function runSave(prefix, input, labels) {
    if (state.saving) return null; // segundo clic mientras guarda: ignorado
    state.saving = true;
    var submit = byId(prefix + "-submit");
    setFormBusy(prefix, true);
    if (submit) submit.textContent = "Guardando…";
    setFeedback(prefix, "", "");
    // Dentro del modal el estado vive en el propio boton y en el mensaje del
    // formulario: el aviso flotante (portalSaveStatus) quedaria ENCIMA del pie
    // del modal en movil y taparia "Reintentar".
    if (window.portalSaveStatus) window.portalSaveStatus.hide();

    var result;
    try {
      result = await window.calendarioAdminManualEvents.saveManualEvent(input);
    } catch (e) {
      result = { ok: false, code: "unconfirmed", message: "Ocurrio un error inesperado al guardar. Usa Reintentar: no se duplicara." };
    }
    state.saving = false;
    setFormBusy(prefix, false);

    if (!result || !result.ok) {
      var message = (result && result.message) || "No se pudo guardar.";
      if (submit) submit.textContent = result && result.code === "validation" ? labels.idle : "Reintentar";
      setFeedback(prefix, message, "error");
      return result;
    }

    if (submit) { submit.textContent = labels.done; submit.disabled = true; }
    setFeedback(prefix, labels.done, "success");
    if (window.portalSaveStatus) window.portalSaveStatus.saved();
    return result;
  }

  function isModalBusy() { return state.saving; }

  // ── Modal "Agregar clase" ────────────────────────────────────────────────

  function isSimpleClassRecord(record) {
    if (!record || record.type !== "CLASE" || record.allDay) return false;
    var slots = Array.isArray(record.slots) && record.slots.length
      ? record.slots
      : ((record.startAt || record.endAt) ? [{ startAt: record.startAt, endAt: record.endAt }] : []);
    return slots.length === 1;
  }

  function fichaInfoFor(ficha) {
    var opt = state.fichaOptions.find(function (o) { return o.ficha === ficha; });
    return opt ? { ficha: opt.ficha, grupo: opt.grupo, inst: opt.institucionLong, instShort: opt.institucionShort } : null;
  }

  // Datos que el sistema YA conoce al elegir la ficha (grupo, institucion)
  // y horario sugerido del calendario academico para esa fecha, si existe.
  function updateClassContext(options) {
    var form = byId("aa-class-form");
    if (!form) return;
    var info = fichaInfoFor(form.querySelector("[name=ficha]").value);
    var ctx = byId("aa-class-context");
    if (ctx) {
      ctx.hidden = !info;
      ctx.textContent = info ? ("Grupo " + info.grupo + " · " + info.inst) : "";
    }
    var hint = byId("aa-class-schedule-hint");
    var date = form.querySelector("[name=date]").value;
    var suggestion = info && window.calendarioAdminManualEvents.suggestClassSlot
      ? window.calendarioAdminManualEvents.suggestClassSlot(window.CALENDAR_2026_RECORDS || [], info, date)
      : null;
    if (hint) {
      hint.hidden = !suggestion;
      hint.textContent = suggestion
        ? (suggestion.start ? "Horario del calendario académico para ese día: " : "Ese día el calendario académico tiene varias franjas: ") + suggestion.text + ". Puedes cambiarlo."
        : "";
    }
    // Solo precarga si el instructor no escribio ya una hora (nunca pisa lo escrito).
    if (suggestion && suggestion.start && !(options && options.keepTimes)) {
      var startInput = form.querySelector("[name=start]");
      var endInput = form.querySelector("[name=end]");
      if (!startInput.value && !endInput.value) {
        startInput.value = suggestion.start;
        endInput.value = suggestion.end;
      }
    }
  }

  function openClassModal(id) {
    var modal = byId("aa-class-modal");
    var form = byId("aa-class-form");
    if (!modal || !form || state.saving) return;
    form.reset();
    setFeedback("aa-class", "", "");
    var record = id ? findManualRecordById(id) : null;
    state.classEditingId = record ? record.id : "";
    state.classDraftId = record ? record.id : window.calendarioAdminManualEvents.newManualEventId();
    byId("aa-class-modal-title").textContent = record ? "Editar clase" : "Agregar clase";
    var submit = byId("aa-class-submit");
    if (submit) submit.textContent = "Guardar clase";
    setFormBusy("aa-class", false);
    if (record) {
      var slot = (Array.isArray(record.slots) && record.slots[0]) || { startAt: record.startAt, endAt: record.endAt };
      form.querySelector("[name=ficha]").value = record.ficha || "";
      form.querySelector("[name=date]").value = record.date || "";
      form.querySelector("[name=start]").value = String(slot.startAt || "").slice(11, 16);
      form.querySelector("[name=end]").value = String(slot.endAt || "").slice(11, 16);
      form.querySelector("[name=tema]").value = record.tema || record.title || "";
      form.querySelector("[name=description]").value = record.description || "";
      form.querySelector("[name=status]").value = record.status || "scheduled";
      state.classEditingRecord = record;
    } else {
      state.classEditingRecord = null;
      // Si la agenda esta filtrada por UNA ficha, se propone esa.
      if (state.filters.ficha) form.querySelector("[name=ficha]").value = state.filters.ficha;
    }
    updateClassContext({ keepTimes: !!record });
    modal.hidden = false;
    var first = form.querySelector(record ? "[name=tema]" : "[name=ficha]");
    if (first && typeof first.focus === "function") first.focus();
  }

  function closeClassModal() {
    if (isModalBusy()) return; // no se cierra mientras guarda
    var modal = byId("aa-class-modal");
    if (modal) modal.hidden = true;
    state.classEditingId = "";
    state.classDraftId = "";
    state.classEditingRecord = null;
  }

  function buildClassInput(form) {
    var ficha = form.querySelector("[name=ficha]").value.trim();
    var info = fichaInfoFor(ficha);
    var date = form.querySelector("[name=date]").value;
    var start = form.querySelector("[name=start]").value;
    var end = form.querySelector("[name=end]").value;
    var tema = form.querySelector("[name=tema]").value.trim();
    var previous = state.classEditingRecord || {};
    return {
      id: state.classDraftId,
      type: "CLASE",
      // Un solo campo para el instructor: el tema es tambien el titulo.
      title: tema,
      tema: tema,
      description: form.querySelector("[name=description]").value,
      date: date,
      allDay: false,
      slots: [{
        startAt: start && date ? (date + "T" + start + ":00-05:00") : "",
        endAt: end && date ? (date + "T" + end + ":00-05:00") : "",
      }],
      status: form.querySelector("[name=status]").value || "scheduled",
      ficha: ficha,
      group: info ? info.grupo : "",
      institution: info ? info.inst : "",
      // Campo avanzado que este formulario no muestra: se conserva al editar.
      route: previous.route || "",
    };
  }

  async function handleClassFormSubmit(evt) {
    evt.preventDefault();
    if (state.saving) return;
    var form = evt.target;
    var result = await runSave("aa-class", buildClassInput(form), { idle: "Guardar clase", done: "Clase guardada ✓" });
    if (result && result.ok) {
      setTimeout(function () { closeClassModal(); loadAndRender(); }, 700);
    }
  }

  // ── Modal de evento especial (editor completo) ──────────────────────────

  function openManualModal(id) {
    var modal = byId("aa-manual-modal");
    var form = byId("aa-manual-form");
    if (!modal || !form || state.saving) return;
    form.reset();
    setFeedback("aa-manual", "", "");

    var record = id ? findManualRecordById(id) : null;
    state.editingManualId = record ? record.id : "";
    state.manualDraftId = record ? record.id : window.calendarioAdminManualEvents.newManualEventId();
    byId("aa-manual-modal-title").textContent = record ? "Editar evento" : "Nuevo evento especial";
    var submit = byId("aa-manual-submit");
    if (submit) submit.textContent = "Guardar evento";
    setFormBusy("aa-manual", false);

    var allDayCheckbox = byId("aa-manual-allday");
    if (record) {
      form.querySelector("[name=title]").value = record.title || "";
      form.querySelector("[name=type]").value = record.type || "ACTIVIDAD_ESPECIAL";
      form.querySelector("[name=tema]").value = record.tema || "";
      form.querySelector("[name=description]").value = record.description || "";
      form.querySelector("[name=date]").value = record.date || "";
      form.querySelector("[name=status]").value = record.status || "scheduled";
      form.querySelector("[name=ficha]").value = record.ficha || "";
      form.querySelector("[name=route]").value = record.route || "";
      if (allDayCheckbox) allDayCheckbox.checked = !!record.allDay;
      var slots = Array.isArray(record.slots) && record.slots.length
        ? record.slots
        : ((record.startAt || record.endAt) ? [{ startAt: record.startAt, endAt: record.endAt }] : []);
      state.slotsDraft = slots.length
        ? slots.map(function (s) { return { start: (s.startAt || "").slice(11, 16), end: (s.endAt || "").slice(11, 16) }; })
        : [{ start: "", end: "" }];
    } else {
      if (allDayCheckbox) allDayCheckbox.checked = false;
      state.slotsDraft = [{ start: "", end: "" }];
    }
    renderSlotsSection();
    toggleAllDaySection();
    modal.hidden = false;
  }

  function closeManualModal() {
    if (isModalBusy()) return;
    var modal = byId("aa-manual-modal");
    if (modal) modal.hidden = true;
    state.editingManualId = "";
    state.manualDraftId = "";
  }

  async function handleManualFormSubmit(evt) {
    evt.preventDefault();
    if (state.saving) return;
    var form = evt.target;
    var fichaValue = form.querySelector("[name=ficha]").value.trim();
    var fichaInfo = fichaValue ? state.fichaOptions.find(function (o) { return o.ficha === fichaValue; }) : null;
    var date = form.querySelector("[name=date]").value;
    var isAllDay = !!(byId("aa-manual-allday") && byId("aa-manual-allday").checked);

    var slots = isAllDay ? [] : state.slotsDraft
      .filter(function (s) { return s.start || s.end; })
      .map(function (s) {
        return {
          startAt: s.start && date ? (date + "T" + s.start + ":00-05:00") : "",
          endAt: s.end && date ? (date + "T" + s.end + ":00-05:00") : "",
        };
      });

    var input = {
      id: state.manualDraftId,
      title: form.querySelector("[name=title]").value,
      type: form.querySelector("[name=type]").value,
      tema: form.querySelector("[name=tema]").value,
      description: form.querySelector("[name=description]").value,
      date: date,
      allDay: isAllDay,
      slots: slots,
      status: form.querySelector("[name=status]").value,
      ficha: fichaValue,
      group: fichaInfo ? fichaInfo.grupo : "",
      institution: fichaInfo ? fichaInfo.institucionLong : "",
      route: form.querySelector("[name=route]").value,
    };

    var result = await runSave("aa-manual", input, { idle: "Guardar evento", done: "Evento guardado ✓" });
    if (result && result.ok) {
      setTimeout(function () { closeManualModal(); loadAndRender(); }, 700);
    }
  }

  var deletingIds = {};

  async function handleDeleteManual(id) {
    if (!id || deletingIds[id]) return; // doble clic en Eliminar: 1 sola operacion
    var confirmFn = window.portalConfirm || function (msg) { return Promise.resolve(window.confirm(msg)); };
    var record = findManualRecordById(id);
    var isClass = record && record.type === "CLASE";
    var confirmed = await confirmFn(
      isClass ? "¿Eliminar esta clase? Solo se elimina esta clase; las demás no cambian." : "¿Eliminar este evento? Esta acción no se puede deshacer.",
      { title: isClass ? "Eliminar clase" : "Eliminar evento", confirmText: "Eliminar" }
    );
    if (!confirmed) return;

    deletingIds[id] = true;
    closeDayDetailModal();
    if (window.portalSaveStatus) window.portalSaveStatus.saving();
    var result;
    try {
      result = await window.calendarioAdminManualEvents.deleteManualEvent(id);
    } finally {
      delete deletingIds[id];
    }
    if (!result || !result.ok) {
      if (window.portalSaveStatus) window.portalSaveStatus.error((result && result.message) || "No se pudo eliminar.");
      if (result && result.code === "not-found") await loadAndRender();
      return;
    }
    if (window.portalSaveStatus) window.portalSaveStatus.saved();
    await loadAndRender();
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────

  function bindFilterHandlers() {
    var scopedIds = ["aa-filter-institucion", "aa-filter-ficha"];
    scopedIds.forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("change", function () {
        state.filters.institucion = byId("aa-filter-institucion").value;
        state.filters.ficha = byId("aa-filter-ficha").value;
        loadAndRender();
      });
    });

    var presentationIds = ["aa-filter-tipo", "aa-filter-estado", "aa-filter-guia", "aa-filter-desde", "aa-filter-hasta"];
    presentationIds.forEach(function (id) {
      var el = byId(id);
      if (!el) return;
      el.addEventListener("change", function () {
        state.filters.tipo = byId("aa-filter-tipo").value;
        state.filters.estado = byId("aa-filter-estado").value;
        state.filters.guia = byId("aa-filter-guia").value;
        state.filters.desde = byId("aa-filter-desde").value;
        state.filters.hasta = byId("aa-filter-hasta").value;
        renderCurrentView();
      });
    });
  }

  function bindClassHandlers() {
    var createBtn = byId("aa-class-create");
    if (createBtn) createBtn.addEventListener("click", function () { openClassModal(""); });
    var closeBtn = byId("aa-class-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeClassModal);
    var cancelBtn = byId("aa-class-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", closeClassModal);
    var form = byId("aa-class-form");
    if (!form) return;
    form.addEventListener("submit", handleClassFormSubmit);
    form.querySelector("[name=ficha]").addEventListener("change", function () { updateClassContext(); });
    form.querySelector("[name=date]").addEventListener("change", function () { updateClassContext(); });
    // Si el instructor cambia un dato despues de un error, el boton vuelve a
    // decir "Guardar clase" (el id de la clase sigue siendo el mismo).
    form.addEventListener("input", function () {
      var submit = byId("aa-class-submit");
      if (submit && !state.saving && submit.textContent === "Reintentar") submit.textContent = "Guardar clase";
    });
    document.addEventListener("keydown", function (evt) {
      if (evt.key !== "Escape") return;
      var modal = byId("aa-class-modal");
      if (modal && !modal.hidden) closeClassModal();
    });
  }

  function bindManualEventHandlers() {
    var createBtn = byId("aa-manual-create");
    if (createBtn) createBtn.addEventListener("click", function () { openManualModal(""); });
    var closeBtn = byId("aa-manual-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeManualModal);
    var cancelBtn = byId("aa-manual-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", closeManualModal);
    var form = byId("aa-manual-form");
    if (form) form.addEventListener("submit", handleManualFormSubmit);
    var allDayCheckbox = byId("aa-manual-allday");
    if (allDayCheckbox) allDayCheckbox.addEventListener("change", toggleAllDaySection);
    var addSlotBtn = byId("aa-manual-add-slot");
    if (addSlotBtn) addSlotBtn.addEventListener("click", function () { state.slotsDraft.push({ start: "", end: "" }); renderSlotsSection(); });
    var dayDetailClose = byId("aa-day-detail-close");
    if (dayDetailClose) dayDetailClose.addEventListener("click", closeDayDetailModal);
  }

  function bootstrap() {
    if (window.agendaViewPreference) state.view = window.agendaViewPreference.getPreferredView();
    var reloadBtn = byId("aa-reload");
    if (reloadBtn) reloadBtn.addEventListener("click", function () { loadAndRender(); });
    var refreshCountsBtn = byId("aa-refresh-counts");
    if (refreshCountsBtn) refreshCountsBtn.addEventListener("click", handleRefreshGuideCounts);
    bindFilterHandlers();
    bindManualEventHandlers();
    bindClassHandlers();
    loadAndRender();
  }

  window.calendarioAdminAgendaPage = {
    load: loadAndRender,
    __test: {
      applyPresentationFilters: applyPresentationFilters,
      eventDateKey: eventDateKey,
      isSimpleClassRecord: isSimpleClassRecord,
      openClassModal: openClassModal,
      closeClassModal: closeClassModal,
      getState: function () { return state; },
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
