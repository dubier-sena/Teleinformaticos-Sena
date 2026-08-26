(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.academicAgendaViews = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // js/academic_agenda_views.js -- Bloque E (vistas de calendario). PURO,
  // igual que academic_agenda.js: recibe la lista YA normalizada de eventos
  // (el resultado de academicAgenda.buildAcademicAgenda() + eventos
  // manuales ya normalizados) y construye el MODELO DE DATOS para las
  // vistas Semana/Mes. NO genera HTML (eso vive en
  // academic_agenda_calendar_ui.js) y NUNCA toca DOM/localStorage/red.
  //
  // Toda la aritmetica de dia/hora usa America/Bogota explicitamente via
  // Intl.DateTimeFormat -- Bogota no tiene horario de verano (UTC-5 fijo
  // todo el año), pero se evita asumir eso a mano para no acoplar el codigo
  // a ese detalle; se usa timeZone explicito como ya hace el resto del
  // proyecto (ver student_calendar.js#formatDateTime).

  var VIEW = { AGENDA: "agenda", WEEK: "week", MONTH: "month" };
  var DEFAULT_MARKER_MINUTES = 30; // duracion visual de un deadline puntual (dueAt sin endAt) SOLO para posicionar en el grid -- nunca se persiste ni se muestra como horario real.
  var MINUTES_PER_DAY = 1440;

  function pad2(n) { return String(n).length < 2 ? "0" + n : String(n); }

  // Partes de un instante ISO, leidas en hora de pared de America/Bogota.
  function bogotaParts(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    var parts = {};
    fmt.formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    // Quirk conocido de ICU/V8 con hour12:false: medianoche puede salir
    // como "24" en vez de "00" -- normalizar antes de usarlo.
    var hour = parts.hour === "24" ? 0 : Number(parts.hour);
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: hour,
      minute: Number(parts.minute),
      second: Number(parts.second),
      weekday: (function () {
        // 0=domingo..6=sabado, calculado a partir de la fecha civil ya
        // resuelta en Bogota (evita depender del dia civil del navegador).
        var anchor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
        return anchor.getUTCDay();
      })(),
      dateKey: parts.year + "-" + parts.month + "-" + parts.day,
    };
  }

  function bogotaDateKey(iso) {
    var p = bogotaParts(iso);
    return p ? p.dateKey : "";
  }

  function minutesOfDay(parts) { return parts.hour * 60 + parts.minute; }

  function addMinutesIso(iso, minutes) {
    return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
  }

  // Ventana de tiempo de UN evento ya normalizado (shape de
  // academicAgenda.buildAcademicAgenda() / calendarioAdminManualEvents),
  // partida por dia civil de Bogota. "segments" son 1 (caso normal) o 2
  // (evento que cruza medianoche Bogota) -- NUNCA se pierde el rango real,
  // solo se corta para poder dibujarse en columnas de dia.
  function resolveEventWindow(event) {
    if (!event) return { allDay: true, segments: [] };

    if (event.allDay) {
      var allDayKey = event.date || bogotaDateKey(event.startAt) || bogotaDateKey(event.dueAt);
      return allDayKey ? { allDay: true, segments: [{ dateKey: allDayKey }] } : { allDay: true, segments: [] };
    }

    var startIso = event.startAt || event.dueAt || "";
    if (!startIso) {
      // Sin ninguna hora conocida: si hay al menos una fecha (p.ej.
      // documento "Sin fecha limite" no aplica aqui porque no tiene date
      // tampoco), se muestra como todo-el-dia; si no hay nada, no se ubica
      // en ningun grid (el llamador simplemente no lo dibuja).
      return event.date ? { allDay: true, segments: [{ dateKey: event.date }] } : { allDay: true, segments: [] };
    }

    var startParts = bogotaParts(startIso);
    if (!startParts) return { allDay: true, segments: [] };

    var endIso = event.endAt || "";
    var endParts = endIso ? bogotaParts(endIso) : null;
    if (!endParts) {
      endParts = bogotaParts(addMinutesIso(startIso, DEFAULT_MARKER_MINUTES));
    }

    var startMin = minutesOfDay(startParts);

    if (endParts.dateKey === startParts.dateKey) {
      var endMin = minutesOfDay(endParts);
      if (endMin <= startMin) endMin = Math.min(MINUTES_PER_DAY, startMin + DEFAULT_MARKER_MINUTES);
      return { allDay: false, segments: [{ dateKey: startParts.dateKey, startMin: startMin, endMin: endMin }] };
    }

    // Cruza medianoche Bogota (p.ej. 11:00pm - 12:30am): 2 segmentos, uno
    // por dia civil real, cada uno con su propio rango de minutos.
    return {
      allDay: false,
      segments: [
        { dateKey: startParts.dateKey, startMin: startMin, endMin: MINUTES_PER_DAY },
        { dateKey: endParts.dateKey, startMin: 0, endMin: minutesOfDay(endParts) },
      ],
    };
  }

  function addDaysUTC(d, n) {
    var copy = new Date(d.getTime());
    copy.setUTCDate(copy.getUTCDate() + n);
    return copy;
  }

  function dateKeyFromUTCDate(d) {
    return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  // Ancla el "lunes de la semana" de un dateKey ("YYYY-MM-DD", ya en dia
  // civil Bogota) usando un Date UTC a mediodia -- evita que un
  // desplazamiento de huso corte al dia anterior/siguiente por accidente
  // (mismo patron ya usado en academic_agenda.js#bogotaWallTimeToIso).
  function mondayOfWeek(dateKey) {
    var d = new Date(dateKey + "T12:00:00Z");
    var jsDay = d.getUTCDay();
    var diffToMonday = (jsDay === 0) ? -6 : (1 - jsDay);
    return addDaysUTC(d, diffToMonday);
  }

  function nowDateKey(now) {
    var d = (now instanceof Date && !Number.isNaN(now.getTime())) ? now : new Date();
    return bogotaDateKey(d.toISOString());
  }

  function sortByStart(a, b) {
    var ax = a.dueAt || a.startAt || (a.date ? a.date + "T00:00:00" : "");
    var bx = b.dueAt || b.startAt || (b.date ? b.date + "T00:00:00" : "");
    return String(ax).localeCompare(String(bx));
  }

  // options.referenceIso: cualquier instante DENTRO de la semana a mostrar.
  // options.hourStart/hourEnd: rango base (default 6-20); se EXPANDE solo
  // si algun evento real cae fuera (nunca se recorta un evento real).
  function buildWeekView(options) {
    var opts = options || {};
    var events = Array.isArray(opts.events) ? opts.events : [];
    var referenceIso = opts.referenceIso || (opts.now instanceof Date ? opts.now.toISOString() : new Date().toISOString());
    var refKey = bogotaDateKey(referenceIso) || nowDateKey(opts.now);
    var monday = mondayOfWeek(refKey);
    var todayKey = nowDateKey(opts.now);

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = addDaysUTC(monday, i);
      var dateKey = dateKeyFromUTCDate(d);
      days.push({
        dateKey: dateKey,
        dayNumber: d.getUTCDate(),
        weekdayIndex: d.getUTCDay(),
        isToday: dateKey === todayKey,
        allDayEvents: [],
        timedSegments: [],
      });
    }
    var byDateKey = {};
    days.forEach(function (day) { byDateKey[day.dateKey] = day; });

    var hourStart = typeof opts.hourStart === "number" ? opts.hourStart : 6;
    var hourEnd = typeof opts.hourEnd === "number" ? opts.hourEnd : 20;

    events.forEach(function (event) {
      var win = resolveEventWindow(event);
      if (win.allDay) {
        win.segments.forEach(function (seg) {
          if (byDateKey[seg.dateKey]) byDateKey[seg.dateKey].allDayEvents.push(event);
        });
        return;
      }
      win.segments.forEach(function (seg) {
        if (!byDateKey[seg.dateKey]) return;
        byDateKey[seg.dateKey].timedSegments.push({ event: event, startMin: seg.startMin, endMin: seg.endMin });
        hourStart = Math.min(hourStart, Math.floor(seg.startMin / 60));
        hourEnd = Math.max(hourEnd, Math.ceil(seg.endMin / 60));
      });
    });

    days.forEach(function (day) {
      day.timedSegments.sort(function (a, b) { return a.startMin - b.startMin; });
      day.allDayEvents.sort(sortByStart);
    });

    return {
      weekStartDateKey: days[0].dateKey,
      weekEndDateKey: days[6].dateKey,
      days: days,
      hourStart: Math.max(0, hourStart),
      hourEnd: Math.min(24, hourEnd),
    };
  }

  // options.year/month (month 1-12) o options.referenceIso. Semanas
  // Lunes-Domingo; se generan EXACTAMENTE las necesarias para cubrir el mes
  // completo (sin filas vacias de mas).
  function buildMonthView(options) {
    var opts = options || {};
    var events = Array.isArray(opts.events) ? opts.events : [];
    var year = opts.year;
    var month = opts.month;
    if (!year || !month) {
      var refParts = bogotaParts(opts.referenceIso || new Date().toISOString());
      year = refParts.year;
      month = refParts.month;
    }

    var firstOfMonth = new Date(Date.UTC(year, month - 1, 1, 12));
    var firstWeekday = firstOfMonth.getUTCDay();
    var leading = (firstWeekday === 0) ? 6 : (firstWeekday - 1);
    var gridStart = addDaysUTC(firstOfMonth, -leading);
    var daysInMonth = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
    var weekCount = Math.ceil((leading + daysInMonth) / 7);
    var todayKey = nowDateKey(opts.now);

    var byDateKey = {};
    events.forEach(function (event) {
      var win = resolveEventWindow(event);
      win.segments.forEach(function (seg) {
        (byDateKey[seg.dateKey] || (byDateKey[seg.dateKey] = [])).push(event);
      });
    });

    var weeks = [];
    for (var w = 0; w < weekCount; w++) {
      var week = [];
      for (var i = 0; i < 7; i++) {
        var d = addDaysUTC(gridStart, w * 7 + i);
        var dateKey = dateKeyFromUTCDate(d);
        week.push({
          dateKey: dateKey,
          dayNumber: d.getUTCDate(),
          inMonth: d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month,
          isToday: dateKey === todayKey,
          events: (byDateKey[dateKey] || []).slice().sort(sortByStart),
        });
      }
      weeks.push(week);
    }

    return { year: year, month: month, weeks: weeks };
  }

  return {
    VIEW: VIEW,
    DEFAULT_MARKER_MINUTES: DEFAULT_MARKER_MINUTES,
    bogotaParts: bogotaParts,
    bogotaDateKey: bogotaDateKey,
    resolveEventWindow: resolveEventWindow,
    buildWeekView: buildWeekView,
    buildMonthView: buildMonthView,
    __test: { mondayOfWeek: mondayOfWeek, dateKeyFromUTCDate: dateKeyFromUTCDate, nowDateKey: nowDateKey },
  };
});
