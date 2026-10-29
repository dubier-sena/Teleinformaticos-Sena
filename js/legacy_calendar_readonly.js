/**
 * legacy_calendar_readonly.js — calendario anterior en SOLO CONSULTA (2026-10-28).
 *
 * Con el calendario seguro por ficha activo (window.SENA_CALENDAR_FIRESTORE.enabled), las clases
 * que ve el aprendiz salen de las sesiones de sena_portal_calendar_fichas. Lo que se guardaba aqui
 * (documento global __calendar__:calendario_2026_admin) ya no llega al aprendiz, asi que editarlo
 * creaba diferencias silenciosas (caso real: 27-oct Kennedy 10B marcada Impartida solo aqui).
 *
 * Se carga con defer DESPUES del motor en linea de calendario-academico-2026.html y reemplaza sus
 * funciones globales de escritura (saveModal, toggleFestivo, resetCalendar, syncFirebaseState),
 * que los botones invocan por nombre. La consulta y "Cargar" siguen funcionando. Nada se borra.
 */
(function () {
  "use strict";
  var cfg = window.SENA_CALENDAR_FIRESTORE;
  if (!cfg || !cfg.enabled) return;

  var MESSAGE = "Calendario anterior en solo consulta. Las clases que ve el aprendiz se editan en el Calendario por ficha.";
  var TARGET = "calendario-academico-sesiones.html";

  function notify() {
    var chip = document.getElementById("save-chip");
    if (chip) chip.textContent = "Solo consulta";
    var notice = document.getElementById("calendar-readonly-notice");
    if (notice && typeof notice.scrollIntoView === "function") notice.scrollIntoView({ block: "nearest" });
    return false;
  }

  window.saveModal = function () {
    if (typeof window.closeModal === "function") window.closeModal();
    return notify();
  };
  window.toggleFestivo = notify;
  window.resetCalendar = notify;
  window.syncFirebaseState = function () { return Promise.resolve(false); };

  function hide(id) {
    var el = document.getElementById(id);
    if (el) { el.hidden = true; el.disabled = true; }
  }

  function mount() {
    hide("firebase-sync-button");
    hide("calendar-reset-button");
    var saveBtn = document.querySelector("#modal .btn-save, .btn-save");
    if (saveBtn) { saveBtn.hidden = true; saveBtn.disabled = true; }
    var chip = document.getElementById("save-chip");
    if (chip) chip.textContent = "Solo consulta";
    if (document.getElementById("calendar-readonly-notice")) return;
    var notice = document.createElement("div");
    notice.id = "calendar-readonly-notice";
    notice.className = "calendar-readonly-notice";
    notice.setAttribute("role", "status");
    var text = document.createElement("span");
    text.textContent = MESSAGE + " ";
    var link = document.createElement("a");
    link.href = TARGET;
    link.textContent = "Abrir el Calendario por ficha";
    notice.appendChild(text);
    notice.appendChild(link);
    var header = document.getElementById("header");
    if (header && header.parentNode) header.parentNode.insertBefore(notice, header.nextSibling);
    else document.body.insertBefore(notice, document.body.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.legacyCalendarReadonly = Object.freeze({ active: true, message: MESSAGE, target: TARGET });
})();
