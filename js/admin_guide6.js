(function () {
  const INSTALL_IDS = ["suite", "browser", "email", "zip", "antivirus", "diagnostic"];
  const DIAG_IDS = ["hardware", "so", "disk", "software", "network"];
  const BUDGET_IDS = ["suite", "diagnostic", "security", "cloud", "backup"];

  const TOOL_NAMES = {
    suite: "Suite ofimatica",
    browser: "Navegador web",
    email: "Cliente de correo",
    zip: "Compresion",
    antivirus: "Antivirus",
    diagnostic: "Herramienta diagnostico",
  };
  const DIAG_NAMES = {
    hardware: "Hardware",
    so: "Sistema operativo",
    disk: "Estado del disco",
    software: "Inventario software",
    network: "Conectividad de red",
  };
  const BUDGET_NAMES = {
    suite: "Suite ofimatica",
    diagnostic: "Diagnostico",
    security: "Antivirus / seguridad",
    cloud: "Servicios en la nube",
    backup: "Respaldo",
  };

  function renderActivityResponsesBody(activityId, state, deps) {
    const renderAnswerTable = typeof deps?.renderAnswerTable === "function" ? deps.renderAnswerTable : () => "";
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const val = (key) => String(state?.[key] ?? "").trim() || "Sin respuesta";
    const chk = (key) => state?.[key] ? "Si" : "No";

    if (activityId === "bitacora311") {
      return `<article class="answer-card"><h3>Bitacora 3.1.1</h3>${renderAnswerTable(["Pregunta", "Respuesta"], [
        ["Que herramientas usa", val("reflexion_herramientas")],
        ["Como registra su trabajo", val("reflexion_registro")],
        ["Que consecuencias tiene", val("reflexion_consecuencias")],
        ["Que experiencia tiene", val("reflexion_experiencia")],
      ])}</article>`;
    }
    if (activityId === "socializacion312") {
      return `<article class="answer-card"><h3>Socializacion 3.1.2</h3>${renderAnswerTable(["Campo", "Respuesta"], [
        ["Conclusion", val("socializacion_conclusion")],
        ["Pregunta central", val("socializacion_pregunta_central")],
      ])}</article>`;
    }
    if (activityId === "quiz312") {
      const quiz = state?.["quiz-guia6-312"];
      return `<article class="answer-card"><h3>Quiz herramientas 3.1.2</h3>${
        quiz && typeof quiz === "object"
          ? renderAnswerTable(["Campo", "Valor"], [
              ["Estado", quiz.status || "Sin registro"],
              ["Variante", quiz.variant != null ? String(quiz.variant) : "Sin registro"],
              ["Puntaje", quiz.score != null ? `${quiz.score} / 100` : "Sin registro"],
              ["Fecha envio", quiz.submittedAt ? formatDate(quiz.submittedAt) : "Sin registro"],
            ])
          : '<div class="answer-value empty">Sin intento registrado.</div>'
      }</article>`;
    }
    if (activityId === "contexto321") {
      return `<article class="answer-card"><h3>Apuntes contexto 3.2.1</h3><div class="answer-value">${escapeHtml(val("ctx_apuntes"))}</div></article>`;
    }
    if (activityId === "mapa322") {
      return `<article class="answer-card"><h3>Mapa conceptual 3.2.2</h3>${renderAnswerTable(["Campo", "Respuesta"], [
        ["Tema central", val("map_central")],
        ["Ramas principales", val("map_ramas")],
      ])}</article>`;
    }
    if (activityId === "instalacion331") {
      return `<article class="answer-card"><h3>Checklist instalacion 3.3.1</h3>${renderAnswerTable(
        ["Herramienta", "Fuente consultada", "Version", "Criterio verificacion", "Hecho", "Notas / evidencia"],
        INSTALL_IDS.map((id) => [TOOL_NAMES[id] || id, val(`inst_source_${id}`), val(`inst_version_${id}`), val(`inst_verify_${id}`), chk(`inst_done_${id}`), val(`inst_notes_${id}`)])
      )}</article>`;
    }
    if (activityId === "diagnostico331") {
      return `<article class="answer-card"><h3>Diagnostico 3.3.1</h3>${renderAnswerTable(
        ["Seccion", "Hallazgos y datos tecnicos", "Recomendaciones / acciones"],
        DIAG_IDS.map((id) => [DIAG_NAMES[id] || id, val(`diag_result_${id}`), val(`diag_action_${id}`)])
      )}<div class="answer-value">${escapeHtml(val("diag_conclusion"))}</div></article>`;
    }
    if (activityId === "presupuesto341") {
      return `<article class="answer-card"><h3>Presupuesto 3.4.1</h3>${renderAnswerTable(
        ["Elemento", "Licencia", "Precio unit.", "Cant.", "Justificacion tecnica"],
        BUDGET_IDS.map((id) => [BUDGET_NAMES[id] || id, val(`budget_license_${id}`), val(`budget_price_${id}`), val(`budget_qty_${id}`), val(`budget_why_${id}`)])
      )}<div class="answer-value">${escapeHtml(val("budget_conclusion"))}</div></article>`;
    }
    return '<article class="answer-card"><div class="response-status">Actividad sin vista configurada.</div></article>';
  }

  function renderFullResponsesBody(state, deps) {
    const renderAnswerTable = typeof deps?.renderAnswerTable === "function" ? deps.renderAnswerTable : () => "";
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const val = (key) => String(state?.[key] ?? "").trim() || "Sin respuesta";
    const chk = (key) => state?.[key] ? "Si" : "No";
    const quiz = state?.["quiz-guia6-312"];
    const quizHtml = quiz && typeof quiz === "object"
      ? renderAnswerTable(["Campo", "Valor"], [
          ["Estado", quiz.status || "Sin registro"],
          ["Variante", quiz.variant != null ? String(quiz.variant) : "Sin registro"],
          ["Puntaje", quiz.score != null ? `${quiz.score} / 100` : "Sin registro"],
          ["Enviado por cambio de pestana", quiz.terminatedByVisibility ? "Si" : "No"],
          ["Fecha envio", quiz.submittedAt ? formatDate(quiz.submittedAt) : "Sin registro"],
        ])
      : '<div class="answer-value empty">Sin intento registrado.</div>';

    return `
      <div class="answers-grid">
        ${renderActivityResponsesBody("bitacora311", state, deps)}
        ${renderActivityResponsesBody("socializacion312", state, deps)}
        <article class="answer-card">
          <h3>Quiz herramientas 3.1.2</h3>
          ${quizHtml}
        </article>
        ${renderActivityResponsesBody("contexto321", state, deps)}
        ${renderActivityResponsesBody("mapa322", state, deps)}
        <article class="answer-card answer-card--wide">
          <h3>Checklist instalacion 3.3.1</h3>
          ${renderAnswerTable(
            ["Herramienta", "Fuente consultada", "Version", "Criterio verificacion", "Hecho", "Notas / evidencia"],
            INSTALL_IDS.map((id) => [TOOL_NAMES[id] || id, val(`inst_source_${id}`), val(`inst_version_${id}`), val(`inst_verify_${id}`), chk(`inst_done_${id}`), val(`inst_notes_${id}`)])
          )}
        </article>
        <article class="answer-card answer-card--wide">
          <h3>Diagnostico 3.3.1</h3>
          ${renderAnswerTable(
            ["Seccion", "Hallazgos y datos tecnicos", "Recomendaciones / acciones"],
            DIAG_IDS.map((id) => [DIAG_NAMES[id] || id, val(`diag_result_${id}`), val(`diag_action_${id}`)])
          )}
          <div class="answer-conclusion">
            <strong class="answer-conclusion__label">Conclusion</strong>
            <div class="answer-value answer-conclusion__value">${escapeHtml(val("diag_conclusion"))}</div>
          </div>
        </article>
        <article class="answer-card answer-card--wide">
          <h3>Presupuesto 3.4.1</h3>
          ${renderAnswerTable(
            ["Elemento", "Licencia", "Precio unit.", "Cant.", "Justificacion tecnica"],
            BUDGET_IDS.map((id) => [BUDGET_NAMES[id] || id, val(`budget_license_${id}`), val(`budget_price_${id}`), val(`budget_qty_${id}`), val(`budget_why_${id}`)])
          )}
          <div class="answer-conclusion">
            <strong class="answer-conclusion__label">Conclusion</strong>
            <div class="answer-value answer-conclusion__value">${escapeHtml(val("budget_conclusion"))}</div>
          </div>
        </article>
      </div>
    `;
  }

  window.adminGuide6 = Object.freeze({
    renderActivityResponsesBody,
    renderFullResponsesBody,
  });
})();
