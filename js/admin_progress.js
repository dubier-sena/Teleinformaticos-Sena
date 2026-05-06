(function () {
  function buildProgressCard(config, deps) {
    const user = config?.user || {};
    const guide = config?.guide || {};
    const guide2Config = config?.guide2Config || null;
    const guide6Config = config?.guide6Config || null;
    const guide2Activities = Array.isArray(config?.guide2Activities) ? config.guide2Activities : [];
    const guide6Activities = Array.isArray(config?.guide6Activities) ? config.guide6Activities : [];
    const isRedesGuide = Boolean(config?.isRedesGuide);
    const redesAdminQuizConfigs = Array.isArray(config?.redesAdminQuizConfigs) ? config.redesAdminQuizConfigs : [];
    const redesLabActivities = Array.isArray(config?.redesLabActivities) ? config.redesLabActivities : [];
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const buildGuideUrl = typeof deps?.buildGuideUrl === "function" ? deps.buildGuideUrl : () => "#";
    const getGuideActivityStateKey =
      typeof deps?.getGuideActivityStateKey === "function" ? deps.getGuideActivityStateKey : () => "";

    const fillWidth = Math.max(0, Math.min(100, Number(guide.percent) || 0));
    const redesQuizButtons = isRedesGuide
      ? redesAdminQuizConfigs
          .map(
            (quizConfig) => `<button
                class="btn secondary"
                type="button"
                data-unlock-redes-quiz="${escapeHtml(quizConfig.key)}"
                data-guide-file="${escapeHtml(guide.fileName)}"
                data-user="${escapeHtml(user.usernameKey)}"
              >${escapeHtml(`Reabrir ${quizConfig.label}`)}</button>`
          )
          .join("")
      : "";
    const redesLabUnlockButtons = isRedesGuide
      ? redesLabActivities
          .map(
            (activity) =>
              `<button class="btn ghost" type="button"
              data-unlock-redes-activity="${escapeHtml(activity.id)}"
              data-guide-file="${escapeHtml(guide.fileName)}"
              data-user="${escapeHtml(user.usernameKey)}"
            >${escapeHtml(activity.label)}</button>`
          )
          .join("")
      : "";
    const sourceText =
      guide.source === "meta" || guide.source === "network"
        ? `Ultima actualizacion: ${formatDate(guide.updatedAt)}`
        : "Resumen reconstruido desde el almacenamiento local.";
    const unlockableCount = isRedesGuide
      ? redesLabActivities.length + redesAdminQuizConfigs.length
      : guide2Config
      ? guide2Activities.length
      : guide6Config
      ? guide6Activities.length
      : 0;

    const activityStateKey = escapeHtml(getGuideActivityStateKey(guide.fileName));
    const activityUnlockButtons = (activities) =>
      activities
        .map(
          (activity) =>
            `<button class="btn ghost unlock-activity-btn" type="button"
              data-unlock-activity="${escapeHtml(activity.id)}"
              data-activity-label="${escapeHtml(activity.label)}"
              data-state-key="${activityStateKey}"
              data-guide-file="${escapeHtml(guide.fileName)}"
              data-user="${escapeHtml(user.usernameKey)}"
            >${escapeHtml(activity.label)}</button>`
        )
        .join("");

    const unlockSection = isRedesGuide
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${redesLabUnlockButtons}</div>
         </div>`
      : guide2Config
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${activityUnlockButtons(guide2Activities)}</div>
         </div>`
      : guide6Config
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${activityUnlockButtons(guide6Activities)}</div>
         </div>`
      : "";

    return `
      <article class="progress-card">
        <div class="progress-card__head">
          <div>
            <h4>${escapeHtml(guide.title)}</h4>
            <div class="progress-source">${escapeHtml(sourceText)}</div>
          </div>
          <strong class="progress-card__percent">${fillWidth}%</strong>
        </div>
        <div class="progress-card__summary">
          <div>
            <span>Progreso</span>
            <strong>${guide.completed} / ${guide.total || 0}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>${fillWidth >= 100 ? "Completada" : fillWidth > 0 ? "En desarrollo" : "Sin iniciar"}</strong>
          </div>
          <div>
            <span>Actividades habilitables</span>
            <strong>${unlockableCount}</strong>
          </div>
        </div>
        <progress class="progress-bar" max="100" value="${fillWidth}" aria-label="Progreso ${fillWidth}%"></progress>
        <div class="progress-card__actions progress-actions">
          <a class="btn ghost" href="${escapeHtml(buildGuideUrl(user, guide.fileName))}">Abrir guia</a>
          ${redesQuizButtons}
          <button class="btn warn" type="button" data-reset-guide="${escapeHtml(
            guide.fileName
          )}" data-user="${escapeHtml(user.usernameKey)}">Reiniciar guia</button>
        </div>
        ${unlockSection}
      </article>
    `;
  }

  window.adminProgress = Object.freeze({
    buildProgressCard,
  });
})();
