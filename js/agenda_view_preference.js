/* js/agenda_view_preference.js
 *
 * Bloque E: recuerda LOCALMENTE (nunca en Firestore, pedido explicito) la
 * ultima vista de calendario elegida (Agenda/Semana/Mes), compartido por la
 * agenda admin y la del aprendiz. Modulo minimo, solo toca localStorage --
 * ninguna logica de fecha/hora vive aqui (eso es academic_agenda_views.js).
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;

  var STORAGE_KEY = "sena_portal_agenda_view_pref_v1";
  var VALID_VIEWS = ["agenda", "week", "month"];
  var MOBILE_MAX_WIDTH = 720;

  function isMobile() {
    try {
      return typeof window.innerWidth === "number" && window.innerWidth <= MOBILE_MAX_WIDTH;
    } catch (e) {
      return false;
    }
  }

  // "Agenda" es el default universal cuando no hay preferencia guardada --
  // esto YA satisface el pedido "en movil, Agenda por defecto" (localStorage
  // es por dispositivo: un telefono que nunca guardo preferencia siempre
  // cae aqui). Si el usuario SI eligio Semana/Mes en ese dispositivo, se
  // respeta esa eleccion igual en movil que en escritorio -- no se ignora
  // la preferencia ya guardada solo por el ancho de pantalla.
  function getPreferredView() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_VIEWS.indexOf(stored) !== -1) return stored;
    } catch (e) { /* localStorage no disponible: usar default */ }
    return "agenda";
  }

  function setPreferredView(view) {
    if (VALID_VIEWS.indexOf(view) === -1) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, view);
    } catch (e) { /* no persistir si localStorage falla: no es critico */ }
  }

  window.agendaViewPreference = Object.freeze({
    STORAGE_KEY: STORAGE_KEY,
    VALID_VIEWS: VALID_VIEWS.slice(),
    getPreferredView: getPreferredView,
    setPreferredView: setPreferredView,
    __test: { isMobile: isMobile },
  });
})();
