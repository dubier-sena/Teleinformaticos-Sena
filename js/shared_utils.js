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

  // ---------------------------------------------------------------------------
  // Avisos y confirmaciones no bloqueantes (reemplazo de alert()/confirm()).
  //   window.portalAlert(mensaje, { type })  -> toast superior, fire-and-forget.
  //   window.portalConfirm(mensaje, opts)    -> Promise<boolean> con modal.
  // CSP-safe: estilos inline / <style> inyectado (mismo patron que save_status).
  // Si el DOM no existe, hacen fallback a alert()/confirm() nativos.
  // ---------------------------------------------------------------------------
  var hasDom = typeof document !== "undefined" && typeof window !== "undefined";

  var TOAST_TYPES = {
    info:    { bg: "#eaf1fb", color: "#1b3a6b", border: "#b9d0f0", icon: "ℹ" },
    success: { bg: "#e9f8ef", color: "#0a5c31", border: "#9fe3b7", icon: "✔" },
    warning: { bg: "#fff0c0", color: "#6e5300", border: "#f5b700", icon: "⚠" },
    error:   { bg: "#fde6e3", color: "#a52a1f", border: "#f4b8b0", icon: "⚠" },
  };
  TOAST_TYPES.danger = TOAST_TYPES.error;

  function injectDialogStylesOnce() {
    if (!hasDom || document.getElementById("portal-dialogs-style")) return;
    var style = document.createElement("style");
    style.id = "portal-dialogs-style";
    style.textContent =
      "#portal-toast-stack{position:fixed;top:16px;left:50%;transform:translateX(-50%);" +
      "z-index:10000;display:flex;flex-direction:column;gap:8px;width:min(92vw,420px);" +
      "pointer-events:none;}" +
      ".portal-toast{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;" +
      "border-radius:12px;border:1px solid #d6e2da;background:#fff;color:#102117;" +
      "font:600 13.5px/1.35 'Inter','Segoe UI',sans-serif;box-shadow:0 14px 36px rgba(7,26,18,0.18);" +
      "pointer-events:auto;opacity:0;transform:translateY(-8px);" +
      "transition:opacity 180ms ease,transform 180ms ease;}" +
      ".portal-toast.is-in{opacity:1;transform:translateY(0);}" +
      ".portal-toast__icon{flex:0 0 auto;font-weight:700;}" +
      ".portal-toast__msg{flex:1 1 auto;}" +
      ".portal-toast__close{flex:0 0 auto;border:0;background:transparent;cursor:pointer;" +
      "font-size:18px;line-height:1;color:inherit;opacity:0.6;padding:0 2px;}" +
      ".portal-toast__close:hover{opacity:1;}" +
      "#portal-confirm-overlay{position:fixed;inset:0;z-index:10001;display:flex;" +
      "align-items:center;justify-content:center;padding:20px;" +
      "background:rgba(7,26,18,0.55);opacity:0;transition:opacity 160ms ease;}" +
      "#portal-confirm-overlay.is-in{opacity:1;}" +
      ".portal-confirm-card{width:min(94vw,440px);background:#fff;border-radius:16px;" +
      "box-shadow:0 24px 60px rgba(7,26,18,0.32);padding:22px 22px 18px;" +
      "transform:translateY(10px);transition:transform 160ms ease;}" +
      "#portal-confirm-overlay.is-in .portal-confirm-card{transform:translateY(0);}" +
      ".portal-confirm-title{margin:0 0 8px;font:700 17px/1.3 'Inter','Segoe UI',sans-serif;color:#102117;}" +
      ".portal-confirm-msg{margin:0 0 18px;font:400 14.5px/1.5 'Inter','Segoe UI',sans-serif;color:#33433b;}" +
      ".portal-confirm-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}" +
      ".portal-confirm-btn{min-height:44px;padding:0 18px;border-radius:10px;cursor:pointer;" +
      "font:600 14px/1 'Inter','Segoe UI',sans-serif;border:1px solid transparent;}" +
      ".portal-confirm-btn--cancel{background:#eef2f0;color:#33433b;border-color:#d6e2da;}" +
      ".portal-confirm-btn--cancel:hover{background:#e2e8e5;}" +
      ".portal-confirm-btn--accept{background:#007934;color:#fff;}" +
      ".portal-confirm-btn--accept:hover{background:#026b2f;}";
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureToastStack() {
    if (!document.body) return null;
    var stack = document.getElementById("portal-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "portal-toast-stack";
      document.body.appendChild(stack);
    }
    return stack;
  }

  utils.alert = function portalAlert(message, opts) {
    var text = String(message == null ? "" : message);
    opts = opts || {};
    if (!hasDom || !document.body) {
      if (hasDom && typeof window.alert === "function") window.alert(text);
      return;
    }
    injectDialogStylesOnce();
    var stack = ensureToastStack();
    if (!stack) return;
    var theme = TOAST_TYPES[opts.type] || TOAST_TYPES.info;
    var duration = typeof opts.duration === "number" ? opts.duration
      : (opts.type === "error" || opts.type === "warning" || opts.type === "danger") ? 7000 : 5000;

    var toast = document.createElement("div");
    toast.className = "portal-toast";
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", opts.type === "error" ? "assertive" : "polite");
    toast.style.background = theme.bg;
    toast.style.color = theme.color;
    toast.style.borderColor = theme.border;
    toast.innerHTML =
      '<span class="portal-toast__icon" aria-hidden="true">' + theme.icon + "</span>" +
      '<span class="portal-toast__msg"></span>' +
      '<button type="button" class="portal-toast__close" aria-label="Cerrar">×</button>';
    toast.querySelector(".portal-toast__msg").textContent = text;
    stack.appendChild(toast);
    void toast.offsetHeight;
    toast.classList.add("is-in");

    var timer = null;
    function remove() {
      if (timer) { window.clearTimeout(timer); timer = null; }
      toast.classList.remove("is-in");
      window.setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 200);
    }
    toast.querySelector(".portal-toast__close").addEventListener("click", remove);
    if (duration > 0) timer = window.setTimeout(remove, duration);
    return remove;
  };

  utils.confirm = function portalConfirm(message, opts) {
    var text = String(message == null ? "" : message);
    opts = opts || {};
    if (!hasDom || !document.body) {
      return Promise.resolve(hasDom && typeof window.confirm === "function" ? window.confirm(text) : true);
    }
    injectDialogStylesOnce();

    var existing = document.getElementById("portal-confirm-overlay");
    if (existing) existing.remove();

    return new Promise(function (resolve) {
      var previousFocus = document.activeElement;
      var overlay = document.createElement("div");
      overlay.id = "portal-confirm-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "portal-confirm-title");
      overlay.innerHTML =
        '<div class="portal-confirm-card">' +
        '<h2 class="portal-confirm-title" id="portal-confirm-title"></h2>' +
        '<p class="portal-confirm-msg"></p>' +
        '<div class="portal-confirm-actions">' +
        '<button type="button" class="portal-confirm-btn portal-confirm-btn--cancel" data-cancel></button>' +
        '<button type="button" class="portal-confirm-btn portal-confirm-btn--accept" data-accept></button>' +
        "</div></div>";
      overlay.querySelector(".portal-confirm-title").textContent = opts.title || "Confirmar accion";
      overlay.querySelector(".portal-confirm-msg").textContent = text;
      overlay.querySelector("[data-cancel]").textContent = opts.cancelText || "Cancelar";
      overlay.querySelector("[data-accept]").textContent = opts.confirmText || "Confirmar";
      document.body.appendChild(overlay);
      void overlay.offsetHeight;
      overlay.classList.add("is-in");

      var acceptBtn = overlay.querySelector("[data-accept]");
      acceptBtn.focus();

      function finish(result) {
        document.removeEventListener("keydown", onKey, true);
        overlay.classList.remove("is-in");
        window.setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 180);
        if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
        resolve(result);
      }
      function onKey(ev) {
        if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
      }
      overlay.querySelector("[data-accept]").addEventListener("click", function () { finish(true); });
      overlay.querySelector("[data-cancel]").addEventListener("click", function () { finish(false); });
      overlay.addEventListener("mousedown", function (ev) { if (ev.target === overlay) finish(false); });
      document.addEventListener("keydown", onKey, true);
    });
  };

  // Alias globales convenientes (no pisan nada nativo critico; son propiedades nuevas).
  if (hasDom) {
    if (typeof window.portalAlert !== "function") window.portalAlert = utils.alert;
    if (typeof window.portalConfirm !== "function") window.portalConfirm = utils.confirm;
  }
})(typeof window !== "undefined" ? window : globalThis);
