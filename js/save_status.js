/**
 * save_status.js — Helper global de estado de guardado
 *
 * Expone window.portalSaveStatus con un toast/chip discreto en la esquina
 * inferior derecha que cualquier guia o formulario puede usar:
 *
 *   portalSaveStatus.saving()                 // "Guardando..."
 *   portalSaveStatus.saved()                  // "Guardado ✓" (auto-oculta en 2.5s)
 *   portalSaveStatus.error("Sin conexion")    // mensaje persistente hasta el siguiente call
 *   portalSaveStatus.offline()                // "Sin conexion — guardado local"
 *   portalSaveStatus.hide()
 *
 * Si en una pagina hay un elemento con id="portal-save-status", el helper
 * tambien actualiza ese elemento (para casos donde se quiera anclar el
 * estado a un boton/panel especifico en vez del toast flotante).
 */

(function () {
  "use strict";

  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.portalSaveStatus) return;

  var TOAST_ID = "sena-portal-save-status";
  var ANCHOR_ID = "portal-save-status";
  var AUTO_HIDE_MS = 2500;
  var hideTimer = null;

  function ensureToast() {
    var existing = document.getElementById(TOAST_ID);
    if (existing) return existing;
    if (!document.body) return null;

    var el = document.createElement("div");
    el.id = TOAST_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "bottom:20px", "right:20px",
      "z-index:9998",
      "padding:10px 16px",
      "border-radius:999px",
      "background:#ffffff",
      "color:#102117",
      "font:600 13px/1.2 'Inter','Segoe UI',sans-serif",
      "box-shadow:0 14px 36px rgba(7,26,18,0.18)",
      "border:1px solid #d6e2da",
      "display:flex",
      "align-items:center",
      "gap:8px",
      "opacity:0",
      "transform:translateY(8px)",
      "transition:opacity 180ms ease,transform 180ms ease",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(el);
    return el;
  }

  // Diseno de iconos como spans inline para que respete tokens / sin SVG externo
  function dot(color) {
    return (
      '<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' +
      color +
      ';"></span>'
    );
  }
  function spinner() {
    // Un dot pulsante simple, sin keyframes externas
    return (
      '<span aria-hidden="true" style="' +
      "display:inline-block;width:10px;height:10px;border-radius:50%;" +
      "border:2px solid rgba(7,26,18,0.2);border-top-color:#007934;" +
      "animation:portal-save-spin 0.8s linear infinite;" +
      '"></span>'
    );
  }

  function injectKeyframesOnce() {
    if (document.getElementById("portal-save-status-anim")) return;
    var style = document.createElement("style");
    style.id = "portal-save-status-anim";
    style.textContent = "@keyframes portal-save-spin { to { transform: rotate(360deg); } }";
    document.head && document.head.appendChild(style);
  }

  function show(message, html, opts) {
    injectKeyframesOnce();
    var el = ensureToast();
    if (!el) return;
    var background = (opts && opts.background) || "#ffffff";
    var color = (opts && opts.color) || "#102117";
    var border = (opts && opts.border) || "#d6e2da";

    el.style.background = background;
    el.style.color = color;
    el.style.borderColor = border;
    el.innerHTML = html + "<span>" + message + "</span>";
    void el.offsetHeight;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";

    // Actualizar tambien el anchor opcional
    var anchor = document.getElementById(ANCHOR_ID);
    if (anchor) {
      anchor.textContent = message;
      anchor.setAttribute("data-state", (opts && opts.state) || "");
    }

    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    if (opts && opts.autoHide) {
      hideTimer = window.setTimeout(hide, AUTO_HIDE_MS);
    }
  }

  function hide() {
    var el = document.getElementById(TOAST_ID);
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
    var anchor = document.getElementById(ANCHOR_ID);
    if (anchor) {
      anchor.textContent = "";
      anchor.removeAttribute("data-state");
    }
  }

  window.portalSaveStatus = {
    saving: function (message) {
      show(message || "Guardando...", spinner(), { state: "saving" });
    },
    saved: function (message) {
      show(message || "Guardado", dot("#007934"), {
        state: "saved",
        autoHide: true,
        background: "#e9f8ef",
        color: "#0a5c31",
        border: "#9fe3b7",
      });
    },
    error: function (message) {
      show(message || "Error al guardar", dot("#c0382b"), {
        state: "error",
        background: "#fde6e3",
        color: "#a52a1f",
        border: "#f4b8b0",
      });
    },
    offline: function (message) {
      show(message || "Sin conexion — guardado local", dot("#c98d00"), {
        state: "offline",
        background: "#fff0c0",
        color: "#6e5300",
        border: "#f5b700",
      });
    },
    hide: hide,
  };
})();
