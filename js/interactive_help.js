/* js/interactive_help.js
 *
 * Componente "Material de apoyo interactivo" — boton verde que abre un panel
 * lateral con contenido rico. Mismo patron visual que el sistema preexistente
 * `abrirTeoriaPanel()` de la guia de Redes, pero generico y reusable en
 * cualquier guia.
 *
 * - Usa IDs distintos a los de la guia de Redes (ihelp-panel / ihelp-backdrop)
 *   para coexistir sin colisionar.
 * - Inyecta el panel y el backdrop una sola vez en document.body.
 * - Event delegation sobre document, asi funciona aun cuando los botones se
 *   inyectan dinamicamente desde un partial.
 * - Cada boton lleva data-ihelp-target="ID" apuntando a un <template id="ID"
 *   data-ihelp-title="...">. La JS extrae el title y el innerHTML del
 *   template y los muestra en el panel.
 * - Atajos: Escape cierra. Click en backdrop cierra.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (window.__INTERACTIVE_HELP_LOADED__) {
    return;
  }
  window.__INTERACTIVE_HELP_LOADED__ = true;

  var panelEl = null;
  var backdropEl = null;
  var titleEl = null;
  var bodyEl = null;
  var lastTrigger = null;

  function ensurePanel() {
    if (panelEl && document.body.contains(panelEl)) {
      return;
    }

    panelEl = document.createElement("div");
    panelEl.className = "ihelp-panel";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-modal", "true");
    panelEl.setAttribute("aria-labelledby", "ihelp-panel-title");
    panelEl.setAttribute("data-open", "false");
    panelEl.setAttribute("aria-hidden", "true");

    var header = document.createElement("div");
    header.className = "ihelp-panel__header";

    titleEl = document.createElement("h2");
    titleEl.className = "ihelp-panel__title";
    titleEl.id = "ihelp-panel-title";
    header.appendChild(titleEl);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ihelp-panel__close";
    closeBtn.setAttribute("aria-label", "Cerrar material de apoyo");
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closePanel);
    header.appendChild(closeBtn);

    bodyEl = document.createElement("div");
    bodyEl.className = "ihelp-panel__body";

    panelEl.appendChild(header);
    panelEl.appendChild(bodyEl);

    backdropEl = document.createElement("div");
    backdropEl.className = "ihelp-backdrop";
    backdropEl.setAttribute("data-open", "false");
    backdropEl.addEventListener("click", closePanel);

    document.body.appendChild(backdropEl);
    document.body.appendChild(panelEl);
  }

  function openPanel(title, html, triggerEl) {
    ensurePanel();
    titleEl.textContent = title || "";
    bodyEl.innerHTML = html || "";
    bodyEl.scrollTop = 0;
    panelEl.setAttribute("data-open", "true");
    panelEl.setAttribute("aria-hidden", "false");
    backdropEl.setAttribute("data-open", "true");
    document.body.style.overflow = "hidden";
    lastTrigger = triggerEl || null;
    // Move focus to close button for keyboard users
    try {
      var close = panelEl.querySelector(".ihelp-panel__close");
      if (close) {
        close.focus({ preventScroll: true });
      }
    } catch (e) {
      /* noop */
    }
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.setAttribute("data-open", "false");
    panelEl.setAttribute("aria-hidden", "true");
    if (backdropEl) backdropEl.setAttribute("data-open", "false");
    document.body.style.overflow = "";
    // Restore focus to the trigger that opened the panel
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
    lastTrigger = null;
  }

  function resolveContent(triggerBtn) {
    var targetId = triggerBtn.getAttribute("data-ihelp-target");
    if (!targetId) return null;
    var tpl = document.getElementById(targetId);
    if (!tpl) return null;
    var title =
      tpl.getAttribute("data-ihelp-title") ||
      (triggerBtn.querySelector(".ihelp-btn__title") &&
        triggerBtn.querySelector(".ihelp-btn__title").textContent.trim()) ||
      "Material de apoyo";

    // <template> exposes content via .innerHTML even if .content is empty
    var html = "";
    if (tpl.tagName && tpl.tagName.toUpperCase() === "TEMPLATE" && tpl.innerHTML) {
      html = tpl.innerHTML;
    } else if (tpl.tagName && tpl.tagName.toUpperCase() === "SCRIPT") {
      html = tpl.textContent || "";
    } else {
      html = tpl.innerHTML || "";
    }
    return { title: title, html: html };
  }

  function onDocumentClick(event) {
    var trigger = event.target && event.target.closest
      ? event.target.closest(".ihelp-btn[data-ihelp-target]")
      : null;
    if (!trigger) return;
    var content = resolveContent(trigger);
    if (!content) return;
    event.preventDefault();
    openPanel(content.title, content.html, trigger);
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape" || event.key === "Esc") {
      if (panelEl && panelEl.getAttribute("data-open") === "true") {
        event.preventDefault();
        closePanel();
      }
    }
  }

  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
  } else {
    ensurePanel();
  }

  window.InteractiveHelp = {
    open: openPanel,
    close: closePanel,
    ensurePanel: ensurePanel,
  };
})();
