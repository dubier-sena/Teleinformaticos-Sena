/**
 * legacy_calendar_redirect.js — fuente única del calendario (2026-10-29).
 * La programación vigente es el calendario oficial por ficha (calendario-academico-sesiones.html).
 * Quien llegue a la dirección antigua va al oficial; el registro anterior solo se abre a propósito,
 * como «Histórico 2026 — Solo consulta», con ?historico=1. Se carga bloqueante, antes que todo.
 */
(function () {
  "use strict";
  var historico = /[?&]historico=1(?:&|$)/.test(window.location.search);
  window.legacyCalendarHistorical = historico;
  if (!historico) window.location.replace("calendario-academico-sesiones.html");
})();
