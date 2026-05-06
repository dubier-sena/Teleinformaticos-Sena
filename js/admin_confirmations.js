(function () {
  "use strict";

  const MODAL_ID = "admin-confirmation-modal";

  function closeExistingModal() {
    const existing = document.getElementById(MODAL_ID);
    if (existing) {
      existing.remove();
    }
  }

  window.adminConfirmAction = function adminConfirmAction(message) {
    if (!document.body) {
      return Promise.resolve(window.confirm(message));
    }

    closeExistingModal();

    return new Promise((resolve) => {
      const previousFocus = document.activeElement;
      const modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "admin-confirmation-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "admin-confirmation-title");
      modal.innerHTML = `
        <section class="admin-confirmation-card">
          <div class="admin-confirmation-body">
            <h2 class="admin-confirmation-title" id="admin-confirmation-title">Confirmar accion administrativa</h2>
            <p class="admin-confirmation-message"></p>
          </div>
          <div class="admin-confirmation-actions">
            <button type="button" class="admin-confirmation-button admin-confirmation-button--cancel" data-admin-confirm-cancel>Cancelar</button>
            <button type="button" class="admin-confirmation-button admin-confirmation-button--confirm" data-admin-confirm-accept>Confirmar</button>
          </div>
        </section>
      `;
      modal.querySelector(".admin-confirmation-message").textContent = message;

      function finish(confirmed) {
        modal.remove();
        document.removeEventListener("keydown", handleKeydown);
        if (previousFocus && typeof previousFocus.focus === "function") {
          previousFocus.focus();
        }
        resolve(confirmed);
      }

      function handleKeydown(event) {
        if (event.key === "Escape") {
          finish(false);
        }
      }

      modal.addEventListener("click", (event) => {
        if (event.target === modal || event.target.closest("[data-admin-confirm-cancel]")) {
          finish(false);
          return;
        }
        if (event.target.closest("[data-admin-confirm-accept]")) {
          finish(true);
        }
      });
      document.addEventListener("keydown", handleKeydown);
      document.body.appendChild(modal);
      modal.querySelector("[data-admin-confirm-cancel]").focus();
    });
  };
})();
