(function () {
  "use strict";

  const ADMIN_AUDIT_KEY = "sena_portal_admin_audit_v1";
  const MAX_ENTRIES = 80;

  function readJson(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getEntries() {
    const entries = readJson(localStorage.getItem(ADMIN_AUDIT_KEY), []);
    return Array.isArray(entries) ? entries : [];
  }

  function writeEntries(entries) {
    localStorage.setItem(ADMIN_AUDIT_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  }

  function getActor() {
    const auth = window.portalAuth;
    const session = auth?.getCurrentSession?.();
    return (
      session?.user?.username ||
      session?.user?.fullName ||
      session?.usernameKey ||
      "admin"
    );
  }

  function recordAction(entry) {
    const nextEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      actor: getActor(),
      action: String(entry?.action || "admin-action"),
      target: String(entry?.target || ""),
      detail: String(entry?.detail || ""),
    };
    writeEntries([nextEntry, ...getEntries()]);
    return nextEntry;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[char];
    });
  }

  function formatDate(value) {
    if (!value) return "Sin registro";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sin registro";
    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderAuditTab(container) {
    if (!container) {
      return;
    }
    const entries = getEntries();
    if (!entries.length) {
      container.innerHTML = `
        <section class="panel">
          <h2>Auditoria local</h2>
          <p>No hay acciones administrativas registradas en este navegador.</p>
        </section>
      `;
      return;
    }
    container.innerHTML = `
      <section class="panel">
        <h2>Auditoria local</h2>
        <p>Historial local de acciones sensibles. Para una auditoria segura se requiere backend o Firebase Functions.</p>
      </section>
      <div class="audit-log">
        ${entries
          .map(
            (entry) => `
              <article class="audit-entry">
                <p class="audit-entry__action">${escapeHtml(entry.action)}</p>
                <div class="audit-entry__meta">
                  <span>${escapeHtml(formatDate(entry.at))}</span>
                  <span>Admin: ${escapeHtml(entry.actor || "admin")}</span>
                  <span>Objetivo: ${escapeHtml(entry.target || "Sin objetivo")}</span>
                </div>
                ${entry.detail ? `<small>${escapeHtml(entry.detail)}</small>` : ""}
              </article>
            `
          )
          .join("")}
      </div>
    `;
  }

  window.adminAudit = {
    getEntries,
    recordAction,
    renderAuditTab,
  };
})();
