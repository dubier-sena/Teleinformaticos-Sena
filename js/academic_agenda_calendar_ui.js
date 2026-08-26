(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.academicAgendaCalendarUi = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // js/academic_agenda_calendar_ui.js -- Bloque E. Constructor de HTML
  // (strings) para las vistas Semana/Mes, compartido por la agenda admin
  // (js/calendario_admin_agenda_page.js) y la del aprendiz
  // (js/student_calendar.js). NO toca el DOM directamente (no hace
  // document.querySelector ni addEventListener) -- solo arma HTML a partir
  // del modelo de js/academic_agenda_views.js. El llamador inyecta el HTML
  // y conecta los eventos de clic (data-event-id / data-month-day).
  //
  // Por que un modulo compartido: la aritmetica de grilla (semana/mes) es
  // identica para admin y aprendiz -- la unica diferencia real es que el
  // admin puede editar eventos manuales. Esa diferencia se resuelve dejando
  // que cada pagina arme su PROPIA tarjeta completa (via opts.renderCard)
  // para el modal de detalle; este modulo solo arma el "chip" compacto de
  // la grilla (siempre de solo lectura, clic abre el detalle).

  function escapeHtml(value) {
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

  var STATUS_CLASS = {
    "pending": "pending", "due-today": "soon", "due-tomorrow": "soon", "overdue": "overdue",
    "delivered": "done", "no-deadline": "pending",
    "scheduled": "scheduled", "cancelled": "cancelled", "rescheduled": "rescheduled",
  };

  var WEEKDAY_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  var WEEKDAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function typeMetaOf(event) { return TYPE_META[event.type] || { icon: "•", label: event.type }; }
  function statusClassOf(event) { return STATUS_CLASS[event.status] || "pending"; }

  function formatHourLabel(hour) {
    var h = hour % 24;
    var suffix = h < 12 ? "a. m." : "p. m.";
    var display = h % 12 === 0 ? 12 : h % 12;
    return display + " " + suffix;
  }

  function chipHtml(event, extraClass) {
    var meta = typeMetaOf(event);
    var isManual = event.isDerived === false;
    return (
      '<button type="button" class="aac-chip aac-chip--' + statusClassOf(event) + (extraClass ? " " + extraClass : "") +
        (isManual ? " aac-chip--manual" : "") + '" data-event-id="' + escapeHtml(event.id) + '" title="' + escapeHtml(event.title) + '">' +
        '<span class="aac-chip__ico">' + meta.icon + "</span>" +
        '<span class="aac-chip__label">' + escapeHtml(event.title) + "</span>" +
      "</button>"
    );
  }

  // ── Selector de vista (Agenda / Semana / Mes) ───────────────────────────

  function renderViewSwitcher(activeView, idPrefix) {
    var prefix = idPrefix || "aac";
    var views = [
      { key: "agenda", label: "Agenda" },
      { key: "week", label: "Semana" },
      { key: "month", label: "Mes" },
    ];
    return (
      '<div class="aac-view-switcher" role="tablist" aria-label="Vista del calendario">' +
        views.map(function (v) {
          var active = v.key === activeView;
          return '<button type="button" class="aac-view-switcher__btn' + (active ? " is-active" : "") + '" ' +
            'role="tab" aria-selected="' + active + '" data-' + prefix + '-view="' + v.key + '">' + v.label + "</button>";
        }).join("") +
      "</div>"
    );
  }

  // ── Vista Semana ─────────────────────────────────────────────────────────
  // weekModel: salida de academicAgendaViews.buildWeekView().

  function renderWeekGrid(weekModel, opts) {
    opts = opts || {};
    var totalMinutes = (weekModel.hourEnd - weekModel.hourStart) * 60;
    if (totalMinutes <= 0) totalMinutes = 60;

    function topPct(startMin) {
      return Math.max(0, ((startMin - weekModel.hourStart * 60) / totalMinutes) * 100);
    }
    function heightPct(startMin, endMin) {
      var h = ((endMin - startMin) / totalMinutes) * 100;
      return Math.max(2, h);
    }

    var hourRows = [];
    for (var h = weekModel.hourStart; h < weekModel.hourEnd; h++) hourRows.push(h);

    var headerCells = weekModel.days.map(function (day) {
      return (
        '<div class="aac-week__daycol-head' + (day.isToday ? " is-today" : "") + '">' +
          '<span class="aac-week__weekday">' + WEEKDAY_SHORT[day.weekdayIndex] + "</span>" +
          '<span class="aac-week__daynum">' + day.dayNumber + "</span>" +
        "</div>"
      );
    }).join("");

    var allDayCells = weekModel.days.map(function (day) {
      return '<div class="aac-week__allday-col">' + day.allDayEvents.map(function (ev) { return chipHtml(ev, "aac-chip--allday"); }).join("") + "</div>";
    }).join("");

    var hourGutter = hourRows.map(function (h) { return '<div class="aac-week__hour-label">' + formatHourLabel(h) + "</div>"; }).join("");

    var dayColumns = weekModel.days.map(function (day) {
      var blocks = day.timedSegments.map(function (seg) {
        var top = topPct(seg.startMin);
        var height = heightPct(seg.startMin, seg.endMin);
        return (
          '<div class="aac-week__block" style="top:' + top.toFixed(2) + '%;height:' + height.toFixed(2) + '%">' +
            chipHtml(seg.event) +
          "</div>"
        );
      }).join("");
      return '<div class="aac-week__daycol' + (day.isToday ? " is-today" : "") + '" data-day-key="' + escapeHtml(day.dateKey) + '">' + blocks + "</div>";
    }).join("");

    var hasAllDay = weekModel.days.some(function (d) { return d.allDayEvents.length > 0; });

    return (
      '<div class="aac-week">' +
        '<div class="aac-week__header"><div class="aac-week__gutter-spacer"></div>' + headerCells + "</div>" +
        (hasAllDay ? '<div class="aac-week__allday-row"><div class="aac-week__gutter-spacer">Todo el día</div>' + allDayCells + "</div>" : "") +
        '<div class="aac-week__body">' +
          '<div class="aac-week__gutter">' + hourGutter + "</div>" +
          '<div class="aac-week__grid" style="--aac-week-rows:' + hourRows.length + '">' + dayColumns + "</div>" +
        "</div>" +
      "</div>"
    );
  }

  // ── Vista Mes ────────────────────────────────────────────────────────────
  // monthModel: salida de academicAgendaViews.buildMonthView().

  function renderMonthGrid(monthModel, opts) {
    opts = opts || {};
    var maxPerDay = typeof opts.maxPerDay === "number" ? opts.maxPerDay : 3;

    var headerRow = WEEKDAY_SHORT.slice(1).concat(WEEKDAY_SHORT.slice(0, 1)).map(function (label) {
      return '<div class="aac-month__weekday-head">' + label + "</div>";
    }).join("");

    var weekRows = monthModel.weeks.map(function (week) {
      var cells = week.map(function (day) {
        var shown = day.events.slice(0, maxPerDay);
        var overflow = day.events.length - shown.length;
        return (
          '<div class="aac-month__day' + (day.inMonth ? "" : " is-outside") + (day.isToday ? " is-today" : "") + '" data-month-day="' + escapeHtml(day.dateKey) + '">' +
            '<span class="aac-month__daynum">' + day.dayNumber + "</span>" +
            '<div class="aac-month__events">' +
              shown.map(function (ev) { return chipHtml(ev, "aac-chip--compact"); }).join("") +
              (overflow > 0 ? '<button type="button" class="aac-month__more" data-month-day="' + escapeHtml(day.dateKey) + '">+' + overflow + " más</button>" : "") +
            "</div>" +
          "</div>"
        );
      }).join("");
      return '<div class="aac-month__week-row">' + cells + "</div>";
    }).join("");

    return (
      '<div class="aac-month">' +
        '<div class="aac-month__header">' + MONTH_NAMES[monthModel.month - 1] + " de " + monthModel.year + "</div>" +
        '<div class="aac-month__weekday-row">' + headerRow + "</div>" +
        weekRows +
      "</div>"
    );
  }

  // ── Detalle de un dia (usado por el "+N mas" del mes, y por un clic en
  //    un chip de semana) -- el llamador decide COMO renderizar cada
  //    tarjeta completa (opts.renderCard), este modulo solo arma el marco.

  function renderDayDetailList(events, opts) {
    opts = opts || {};
    var renderCard = typeof opts.renderCard === "function" ? opts.renderCard : function (ev) { return chipHtml(ev); };
    if (!events.length) return '<p class="aac-day-detail__empty">Sin eventos este día.</p>';
    return '<div class="aac-day-detail__list">' + events.map(renderCard).join("") + "</div>";
  }

  return {
    WEEKDAY_SHORT: WEEKDAY_SHORT,
    WEEKDAY_LONG: WEEKDAY_LONG,
    MONTH_NAMES: MONTH_NAMES,
    renderViewSwitcher: renderViewSwitcher,
    renderWeekGrid: renderWeekGrid,
    renderMonthGrid: renderMonthGrid,
    renderDayDetailList: renderDayDetailList,
    __test: { chipHtml: chipHtml, formatHourLabel: formatHourLabel, escapeHtml: escapeHtml },
  };
});
