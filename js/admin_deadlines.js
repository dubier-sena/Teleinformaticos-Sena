(function () {
  function getConfigGuides(users, deps) {
    const auth = deps?.auth || null;
    const deadlineManager = deps?.deadlineManager || null;
    const ficha = String(users?.[0]?.ficha || "").trim();
    if (!ficha || typeof auth?.getGuidesForFicha !== "function" || !deadlineManager) {
      return [];
    }
    return auth
      .getGuidesForFicha(ficha)
      .filter((fileName) => deadlineManager.getActivitiesForGuide(fileName).length);
  }

  function buildConfigPanel(users, deps) {
    const auth = deps?.auth || null;
    const deadlineManager = deps?.deadlineManager || null;
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");

    if (!deadlineManager || !users.length) {
      return "";
    }
    const guideFiles = getConfigGuides(users, deps);
    if (!guideFiles.length) {
      return "";
    }

    const guideBlocks = guideFiles
      .map((fileName) => {
        const activities = deadlineManager.getActivitiesForGuide(fileName);
        if (!activities.length) {
          return "";
        }
        const rows = activities
          .map((activity) => {
            const policy = deadlineManager.getPolicy(fileName, activity.id);
            const dueAt = String(policy?.dueAt || "").trim();
            const updatedText = dueAt
              ? `Fecha activa: ${escapeHtml(deadlineManager.formatDueAt(dueAt))}`
              : "Sin fecha de entrega configurada";
            return `
              <div class="activity-deadline-row">
                <div class="activity-deadline-label">
                  <strong>${escapeHtml(activity.label)}</strong>
                  <span>${updatedText}</span>
                </div>
                <input
                  class="activity-deadline-input"
                  type="datetime-local"
                  value="${escapeHtml(dueAt)}"
                  data-deadline-input="${escapeHtml(fileName)}::${escapeHtml(activity.id)}"
                >
                <button class="btn secondary" type="button"
                  data-save-activity-deadline="${escapeHtml(fileName)}"
                  data-activity-id="${escapeHtml(activity.id)}"
                  data-activity-label="${escapeHtml(activity.label)}">
                  Guardar fecha
                </button>
                <button class="btn ghost" type="button"
                  data-clear-activity-deadline="${escapeHtml(fileName)}"
                  data-activity-id="${escapeHtml(activity.id)}"
                  data-activity-label="${escapeHtml(activity.label)}">
                  Quitar fecha
                </button>
              </div>
            `;
          })
          .join("");

        return `
          <article class="activity-deadline-guide">
            <h3>${escapeHtml(auth.getGuideTitle(fileName))}</h3>
            <p>Si no defines fecha, esta guia sigue funcionando como ahora. Solo se cierra la actividad cuando guardes una fecha aqui.</p>
            <div class="activity-deadline-grid">${rows}</div>
          </article>
        `;
      })
      .join("");

    return `
      <section class="panel">
        <h2>Fechas opcionales de entrega</h2>
        <p class="activities-section-copy">
          Esta configuracion es opcional. Solo afecta las actividades donde asignes una fecha de cierre.
        </p>
        <div class="activity-deadline-admin">${guideBlocks}</div>
      </section>
    `;
  }

  window.adminDeadlines = Object.freeze({
    buildConfigPanel,
    getConfigGuides,
  });
})();
