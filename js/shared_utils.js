// shared_utils.js — Utilidades compartidas del portal (fuente unica).
// Se carga temprano (script sincrono) en cada pagina, antes que los scripts
// que la consumen. Cada modulo que use estas utilidades debe delegar en
// window.portalUtils.* y conservar un fallback minimo por si esta pagina no
// llego a cargar este archivo (asi nunca se rompe el render).
(function (root) {
  "use strict";

  var utils = root.portalUtils || (root.portalUtils = {});

  // Escapa los 5 caracteres peligrosos para HTML. null/undefined -> "".
  if (typeof utils.escapeHtml !== "function") {
    utils.escapeHtml = function escapeHtml(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[ch];
      });
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
