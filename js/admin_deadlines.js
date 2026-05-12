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

  // ── Vista de estado por aprendiz ────────────────────────────────────────────
  // deps: { auth, deadlineManager, escapeHtml, getUserActivityStatus }
  // getUserActivityStatus(usernameKey, fileName, activityId) → "locked" | "open" | "expired" | "none"

  function getActivityStatusInfo(dueAt, isLocked) {
    if (isLocked) {
      return { label: "Entregada", css: "act-delivery-status--sent" };
    }
    if (dueAt) {
      const now = new Date();
      const due = new Date(dueAt);
      if (now > due) {
        return { label: "Vencida", css: "act-delivery-status--blocked" };
      }
      return { label: "En plazo", css: "act-delivery-status--pending" };
    }
    return { label: "Disponible", css: "act-delivery-status--pending" };
  }

  function buildStatusPanel(users, deps) {
    const auth = deps?.auth || null;
    const deadlineManager = deps?.deadlineManager || null;
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (v) => String(v || "");
    const getUserActivityLocked = typeof deps?.getUserActivityLocked === "function"
      ? deps.getUserActivityLocked
      : () => false;

    if (!deadlineManager || !users.length) return "";

    const ficha = String(users[0]?.ficha || "").trim();
    if (!ficha || typeof auth?.getGuidesForFicha !== "function") return "";

    const guideFiles = auth.getGuidesForFicha(ficha).filter(
      (f) => deadlineManager.getActivitiesForGuide(f).length
    );

    if (!guideFiles.length) return "";

    const guideBlocks = guideFiles.map((fileName) => {
      const activities = deadlineManager.getActivitiesForGuide(fileName);
      if (!activities.length) return "";

      const headers = ["Aprendiz", ...activities.map((a) => escapeHtml(a.label))];
      const headerRow = headers.map((h) => `<th>${h}</th>`).join("");

      const bodyRows = users.map((user) => {
        const cells = activities.map((activity) => {
          const policy = deadlineManager.getPolicy(fileName, activity.id);
          const dueAt = policy?.dueAt || null;
          const isLocked = getUserActivityLocked(user.usernameKey, fileName, activity.id);
          const info = getActivityStatusInfo(dueAt, isLocked);
          const dueText = dueAt
            ? `<small style="display:block;color:#6b7280;">${escapeHtml(deadlineManager.formatDueAt(dueAt))}</small>`
            : "";
          return `<td><span class="act-delivery-status ${escapeHtml(info.css)}">${escapeHtml(info.label)}</span>${dueText}</td>`;
        }).join("");
        return `<tr><td><strong>${escapeHtml(user.fullName)}</strong></td>${cells}</tr>`;
      }).join("");

      return `
        <article class="activity-deadline-guide" style="margin-bottom:2rem;">
          <h3>${escapeHtml(auth.getGuideTitle(fileName))}</h3>
          <div class="answer-table-wrap" style="overflow-x:auto;">
            <table class="answer-table activities-table" style="min-width:600px;">
              <thead><tr>${headerRow}</tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>
          </div>
        </article>
      `;
    }).join("");

    if (!guideBlocks.trim()) return "";

    return `
      <section class="panel" style="margin-top:2rem;">
        <h2>Estado por aprendiz</h2>
        <p class="activities-section-copy">
          Estado actual de cada actividad para los aprendices de este grupo.
          "Entregada" significa que el aprendiz bloqueó la actividad al enviarla;
          "Vencida" significa que la fecha límite ya pasó sin entrega;
          "En plazo" o "Disponible" significa que la actividad sigue abierta.
        </p>
        <div class="activity-deadline-admin">${guideBlocks}</div>
      </section>
    `;
  }

  window.adminDeadlines = Object.freeze({
    buildConfigPanel,
    buildStatusPanel,
    getConfigGuides,
  });
})();
