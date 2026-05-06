(function () {
  function getQuizStatusLabel(summary) {
    const statusText = getQuizStatusText(summary);
    const statusClass = summary?.status === "terminated_visibility"
      ? "redes-status-label--warning"
      : summary?.locked || summary?.status === "completed"
        ? "redes-status-label--success"
        : "redes-status-label--progress";
    return `<span class="redes-status-label ${statusClass}">${statusText}</span>`;
  }

  function getQuizStatusText(summary) {
    if (summary?.status === "terminated_visibility") {
      return "Finalizado por visibilidad";
    }
    if (summary?.locked || summary?.status === "completed") {
      return "Completado";
    }
    return "En progreso";
  }

  function getQuizScoreText(summary) {
    return `Puntaje ${summary?.score ?? 0} / ${summary?.maxScore || 100}`;
  }

  function getSocializationStatusLabel(locked) {
    return locked
      ? '<span class="redes-status-label redes-status-label--success">\\u2705 Enviado</span>'
      : '<span class="redes-status-label redes-status-label--warning">\\u23f3 Pendiente</span>';
  }

  function getSocializationActivityStatusHtml(summary, deps) {
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    return summary?.locked
      ? `<span class="act-delivery-status act-delivery-status--sent">Enviado</span>
         <small class="act-delivery-filename">${escapeHtml(formatDate(summary.updatedAt))}</small>`
      : '<span class="act-delivery-status act-delivery-status--pending">Sin envio registrado</span>';
  }

  function getQuizActivityStatusHtml(summary, deps) {
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    return summary
      ? `<span class="act-delivery-status act-delivery-status--sent">${escapeHtml(getQuizStatusText(summary))}</span>
         <small class="act-delivery-filename">${escapeHtml(getQuizScoreText(summary))}</small>`
      : '<span class="act-delivery-status act-delivery-status--pending">Sin registro</span>';
  }

  function getUnlockButtonHtml(config, deps) {
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const type = config?.type === "quiz" ? "quiz" : "activity";
    const attrName = type === "quiz" ? "data-unlock-redes-quiz" : "data-unlock-redes-activity";
    const label = config?.label || "Reabrir";
    return `<button class="btn ghost btn--sm" type="button"
        ${attrName}="${escapeHtml(config?.id)}"
        data-guide-file="${escapeHtml(config?.fileName)}"
        data-user="${escapeHtml(config?.usernameKey)}">${escapeHtml(label)}</button>`;
  }

  function getQuizEvidenceHtml(summary, deps) {
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const events = Array.isArray(summary?.evidenceEvents) ? summary.evidenceEvents : [];

    if (!events.length) {
      return `<div class="answer-card">
          <h3>Evidencia de visibilidad</h3>
          <p>Sin advertencias registradas.</p>
        </div>`;
    }

    return `<div class="answer-card">
        <h3>Evidencia de visibilidad</h3>
        <ul class="redes-quiz-evidence-list">
          ${events.map((event) => `
            <li>
              Advertencia ${escapeHtml(String(event.warningNumber || "?"))}
              - ${escapeHtml(formatDate(event.timestamp))}
              - estado ${escapeHtml(event.visibilityState || "hidden")}
            </li>`).join("")}
        </ul>
      </div>`;
  }

  function getActivityStateRows(activity, state) {
    const keys = Array.isArray(activity?.keys) ? activity.keys : [];
    return keys.flatMap((key) => {
      const answerKey = String(key).replace(/-locked$/, "");
      const rows = [[key, state?.[key] ? "Completada / bloqueada" : "Pendiente"]];
      if (answerKey && answerKey !== key && state?.[answerKey] !== undefined) {
        rows.unshift([answerKey, state?.[answerKey]]);
      }
      return rows;
    });
  }

  function buildSocializationPayload(config, deps) {
    const summary = config?.summary || null;
    if (!summary) {
      return null;
    }

    const metaParts = Array.isArray(config?.metaParts) ? config.metaParts.slice() : [];
    const activityLabel = config?.activityLabel || "Socializacion";
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const renderAnswerTable = typeof deps?.renderAnswerTable === "function" ? deps.renderAnswerTable : () => "";
    metaParts.push(`Actualizado: ${formatDate(summary.updatedAt)}`);

    return {
      meta: metaParts.join(" | "),
      bodyHtml: `<div class="answers-grid"><article class="answer-card">
        <h3>${escapeHtml(activityLabel)}</h3>
        ${renderAnswerTable(
          ["Campo", "Valor"],
          [
            ["Notas enviadas", summary.text || "(sin respuesta)"],
            ["Estado", summary.locked ? "Enviado" : "Pendiente"],
            ["Actualizado", formatDate(summary.updatedAt)],
          ]
        )}
      </article></div>`,
    };
  }

  function buildActivityStatePayload(config, deps) {
    const activity = config?.activity || null;
    const state = config?.state || {};
    const metaParts = Array.isArray(config?.metaParts) ? config.metaParts.slice() : [];
    const snapshot = config?.snapshot || null;
    const activityLabel = config?.activityLabel || "Actividad";
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const renderAnswerTable = typeof deps?.renderAnswerTable === "function" ? deps.renderAnswerTable : () => "";
    const rows = getActivityStateRows(activity, state);

    if (!rows.length || rows.every(([, value]) => !value || value === "Pendiente")) {
      return null;
    }

    metaParts.push(`Fuente: ${snapshot?.sourceLabel || "Sin registro"}`);
    metaParts.push(`Actualizado: ${formatDate(snapshot?.updatedAt)}`);
    return {
      meta: metaParts.join(" | "),
      bodyHtml: `<div class="answers-grid"><article class="answer-card">
        <h3>${escapeHtml(activityLabel)}</h3>
        ${renderAnswerTable(["Campo", "Valor"], rows)}
      </article></div>`,
    };
  }

  window.adminRedes = Object.freeze({
    getQuizStatusLabel,
    getQuizStatusText,
    getQuizScoreText,
    getSocializationStatusLabel,
    getSocializationActivityStatusHtml,
    getQuizActivityStatusHtml,
    getUnlockButtonHtml,
    getQuizEvidenceHtml,
    getActivityStateRows,
    buildSocializationPayload,
    buildActivityStatePayload,
  });
})();
