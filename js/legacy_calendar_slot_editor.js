(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.legacyCalendarSlotEditor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // js/legacy_calendar_slot_editor.js -- Bloque F.1. PURO (sin DOM): convierte
  // entre el string "horario" que ya usa calendario-academico-2026.html /
  // data/calendario_2026_records.js (p.ej. "7:00am–9:55am / 2:15pm–4:15pm",
  // separador "/" ";" o salto de linea -- ver splitHorarioSlots en ese HTML y
  // parseHorarioSlots en academic_agenda.js) y una lista de franjas en
  // formato de <input type="time"> (24h, "HH:MM") para poder editarlas con
  // un selector de hora nativo, sin bloques predefinidos.
  //
  // Se extrae a su propio modulo (en vez de vivir inline en el HTML) SOLO
  // para poder probarlo con node --test como el resto del proyecto -- el
  // HTML no tiene otro modulo JS separable de su DOM/estado global.
  //
  // IMPORTANTE: no se toca academic_agenda.js ni su SLOT_RE -- el formato de
  // salida aqui coincide a proposito con lo que esa funcion ya sabe leer
  // (separador "–" o "-", am/pm, sin ceros a la izquierda en la hora).

  var TIME_SLOT_RE = /(\d{1,2}):(\d{2})\s*(am|pm)\s*[–\-]\s*(\d{1,2}):(\d{2})\s*(am|pm)/i;
  var ALLDAY_VALUES = ["", "—", "-"];

  function pad2(n) { return String(n).length < 2 ? "0" + n : String(n); }

  function to24hInputValue(hour12, minute, ampm) {
    var h = Number(hour12) % 12;
    if (String(ampm).toLowerCase() === "pm") h += 12;
    return pad2(h) + ":" + pad2(minute);
  }

  function to12hLabel(hhmm) {
    var parts = String(hhmm || "").split(":");
    var h = Number(parts[0]);
    if (!Number.isFinite(h)) return "";
    var m = parts[1] != null ? pad2(parts[1]) : "00";
    var ampm = h >= 12 ? "pm" : "am";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + m + ampm;
  }

  function isAllDayHorario(horario) {
    return ALLDAY_VALUES.indexOf(String(horario == null ? "" : horario).trim()) !== -1;
  }

  // "7:00am–9:55am / 2:15pm–4:15pm" -> [{start:"07:00",end:"09:55"},{start:"14:15",end:"16:15"}]
  // Una pieza que no matchea el patron de hora se ignora (defensivo: nunca
  // truena la UI por un dato legacy con formato inesperado).
  function parseHorarioToSlots(horario) {
    if (isAllDayHorario(horario)) return [];
    var raw = String(horario || "").trim();
    var pieces = raw.split(/\s*(?:\/|;|\r?\n)+\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    var slots = [];
    pieces.forEach(function (piece) {
      var m = piece.match(TIME_SLOT_RE);
      if (!m) return;
      slots.push({
        start: to24hInputValue(m[1], m[2], m[3]),
        end: to24hInputValue(m[4], m[5], m[6]),
      });
    });
    return slots;
  }

  // Inverso: franjas en 24h -> el MISMO formato de string que ya consume
  // academic_agenda.js#parseHorarioSlots (separador " / ", am/pm, "–").
  // Slots sin start/end validos se descartan. Sin ninguna franja valida ->
  // "—" (todo el dia, mismo valor "sin horario" que ya usa el proyecto).
  function buildHorarioFromSlots(slots) {
    var valid = (Array.isArray(slots) ? slots : []).filter(function (s) {
      return s && String(s.start || "").trim() && String(s.end || "").trim();
    });
    if (!valid.length) return "—";
    return valid.map(function (s) {
      return to12hLabel(s.start) + "–" + to12hLabel(s.end);
    }).join(" / ");
  }

  return {
    TIME_SLOT_RE: TIME_SLOT_RE,
    isAllDayHorario: isAllDayHorario,
    parseHorarioToSlots: parseHorarioToSlots,
    buildHorarioFromSlots: buildHorarioFromSlots,
    to12hLabel: to12hLabel,
    __test: { to24hInputValue: to24hInputValue },
  };
});
