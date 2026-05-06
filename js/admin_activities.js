(function () {
  function getGroups(users) {
    const seen = new Set();
    const groups = [];
    (users || []).forEach((user) => {
      const key = `${user.grupo}::${user.ficha}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const instShort = String(user.inst || "").toLowerCase().includes("santa") ? "Santa B\u00e1rbara" : "Kennedy";
      groups.push({
        key,
        grupo: user.grupo,
        inst: user.inst,
        ficha: user.ficha,
        label: `${user.grupo} \u2014 ${instShort}`,
      });
    });
    return groups.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function buildStandardButtons(config, deps) {
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const activityId = config?.activityId || "";
    const guideKind = config?.guideKind || "";
    const fileName = config?.fileName || "";
    const activityLabel = config?.activityLabel || "";
    const usernameKey = config?.usernameKey || "";
    return `
      <button class="btn secondary btn--sm" type="button"
        data-view-guide-activity="${escapeHtml(activityId)}"
        data-guide-kind="${escapeHtml(guideKind)}"
        data-guide-file="${escapeHtml(fileName)}"
        data-activity-label="${escapeHtml(activityLabel)}"
        data-user="${escapeHtml(usernameKey)}">Ver respuestas</button>
      <button class="btn ghost btn--sm" type="button"
        data-export-activity="${escapeHtml(activityId)}"
        data-guide-kind="${escapeHtml(guideKind)}"
        data-guide-file="${escapeHtml(fileName)}"
        data-activity-label="${escapeHtml(activityLabel)}"
        data-user="${escapeHtml(usernameKey)}">Exportar soporte</button>`;
  }

  function getUniqueInteractiveGuides(users, deps) {
    const getOfficialGuideFilesForUsers = deps?.getOfficialGuideFilesForUsers;
    const getUnlockActivitiesForGuide = deps?.getUnlockActivitiesForGuide;
    const getGuideTitle = deps?.getGuideTitle;
    const getGuideKind = deps?.getGuideKind;
    if (
      typeof getOfficialGuideFilesForUsers !== "function" ||
      typeof getUnlockActivitiesForGuide !== "function" ||
      typeof getGuideTitle !== "function" ||
      typeof getGuideKind !== "function"
    ) {
      return [];
    }

    return getOfficialGuideFilesForUsers(users)
      .map((fileName) => {
        const activities = getUnlockActivitiesForGuide(fileName);
        if (!activities.length) return null;
        return {
          fileName,
          title: getGuideTitle(fileName),
          guideKind: getGuideKind(fileName),
        };
      })
      .filter(Boolean);
  }

  function getGuide2ActivityStatusHtml(activityId, snapshot, deps) {
    const activities = Array.isArray(deps?.activities) ? deps.activities : [];
    const hasMeaningfulValue = typeof deps?.hasMeaningfulValue === "function"
      ? deps.hasMeaningfulValue
      : (value) => value !== undefined && value !== null && String(value).trim() !== "";
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const activity = activities.find((item) => item.id === activityId);
    const keys = Array.isArray(activity?.keys) ? activity.keys : [];
    const state = snapshot?.state || {};
    const hasAnswers = keys.some((key) => hasMeaningfulValue(state[key]));

    if (!hasAnswers) {
      return '<span class="act-delivery-status act-delivery-status--pending">Sin respuestas guardadas</span>';
    }

    const locked = keys.some((key) => /-locked$/.test(key) && state[key] === true);
    const updatedAt = snapshot?.updatedAt
      ? `<small class="act-delivery-filename">${escapeHtml(formatDate(snapshot.updatedAt))}</small>`
      : "";
    return `<span class="act-delivery-status act-delivery-status--sent">${locked ? "Entregada" : "Respuestas guardadas"}</span>${updatedAt}`;
  }

  function buildGuide1ActivityResponsePayload(config, deps) {
    const user = config?.user || {};
    const record = config?.record || null;
    const fileName = config?.fileName || "";
    const activityLabel = config?.activityLabel || "Actividad";
    const getGuideTitle = typeof deps?.getGuideTitle === "function" ? deps.getGuideTitle : (value) => String(value || "");
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const renderAnswerTable = typeof deps?.renderAnswerTable === "function" ? deps.renderAnswerTable : () => "";
    const deliveredAt = record?.submittedAt || record?.updatedAt || "";

    if (!deliveredAt) {
      return null;
    }

    const savedFile = record?.savedFileName || "Sin nombre de archivo";
    const driveUrl = record?.driveUrl || "";
    const meta = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${user.ficha}`,
      `Guia: ${getGuideTitle(fileName)}`,
      `Fecha de entrega: ${formatDate(deliveredAt)}`,
    ].join(" | ");
    const bodyHtml = `<div class="answers-grid"><article class="answer-card">
      <h3>${escapeHtml(activityLabel)}</h3>
      ${renderAnswerTable(
        ["Campo", "Valor"],
        [
          ["Aprendiz", user.fullName],
          ["Grupo", user.grupo],
          ["Ficha", user.ficha],
          ["Fecha y hora de entrega", formatDate(deliveredAt)],
          ["Archivo entregado", savedFile],
          ...(driveUrl ? [["Enlace Drive", driveUrl]] : []),
        ]
      )}
    </article></div>`;
    return { meta, bodyHtml };
  }

  const MATRIZ322_ACTORS = [
    { label: "Tienda Don Ramiro (Puerto Boyaca)", usa: "matriz-tienda-usa", desconoce: "matriz-tienda-desconoce", recomienda: "matriz-tienda-recomienda" },
    { label: "Cultivo Familiar (Otanche)", usa: "matriz-cultivo-usa", desconoce: "matriz-cultivo-desconoce", recomienda: "matriz-cultivo-recomienda" },
    { label: "Artesanias (Pauna)", usa: "matriz-artesanias-usa", desconoce: "matriz-artesanias-desconoce", recomienda: "matriz-artesanias-recomienda" },
    { label: "Caso adicional del instructor", usa: "matriz-extra-usa", desconoce: "matriz-extra-desconoce", recomienda: "matriz-extra-recomienda" },
  ];

  function buildMatriz322Table(rows, deps) {
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    if (!rows.length) {
      return '<p class="activities-loading">Ningun aprendiz ha finalizado la Matriz 3.2.2 aun.</p>';
    }
    const headerHtml = ["Aprendiz", "Grupo", "Ficha", "Fecha finalizado", ""]
      .map((header) => `<th>${escapeHtml(header)}</th>`)
      .join("");
    const rowHtml = rows
      .map(({ summary }) => `
      <tr>
        <td>${escapeHtml(summary.fullName || summary.username)}</td>
        <td>${escapeHtml(summary.grupo)}</td>
        <td>${escapeHtml(summary.ficha)}</td>
        <td>${escapeHtml(formatDate(summary.finalizadaAt))}</td>
        <td>
          <button class="btn ghost" type="button"
            data-matriz322-user="${escapeHtml(summary.username)}">
            Ver respuestas
          </button>
        </td>
      </tr>`)
      .join("");
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;
  }

  function buildMatriz322ModalPayload(summary, deps) {
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const state = summary?.state || {};
    const valueOrEmpty = (key) => {
      const text = String(state[key] || "").trim();
      return text ? escapeHtml(text).replace(/\r?\n/g, "<br>") : "<em>Sin respuesta</em>";
    };
    const matrizRows = MATRIZ322_ACTORS.map((actor) => `
      <tr>
        <th scope="row" class="matriz322-actor-cell">${escapeHtml(actor.label)}</th>
        <td class="matriz322-response-cell">${valueOrEmpty(actor.usa)}</td>
        <td class="matriz322-response-cell">${valueOrEmpty(actor.desconoce)}</td>
        <td class="matriz322-response-cell">${valueOrEmpty(actor.recomienda)}</td>
      </tr>`)
      .join("");
    const bodyHtml = `
      <div class="answer-table-wrap matriz322-table-wrap">
        <table class="answer-table matriz322-table">
          <thead>
            <tr>
              <th>Actor productivo</th>
              <th>Herramientas que usa</th>
              <th>Herramientas que desconoce</th>
              <th>Herramientas recomendadas</th>
            </tr>
          </thead>
          <tbody>${matrizRows}</tbody>
        </table>
      </div>
      <div class="matriz322-note-card">
        <strong class="matriz322-note-title">Compromisos personales</strong>
        <div class="matriz322-note-copy">${valueOrEmpty("contexto-compromisos")}</div>
      </div>
      <div class="matriz322-note-card">
        <strong class="matriz322-note-title">Reto: cual caso genero mas dudas tecnicas?</strong>
        <div class="matriz322-note-copy">${valueOrEmpty("contexto-reto-caso")}</div>
      </div>
      <div class="matriz322-note-card">
        <strong class="matriz322-note-title">Reto: que herramienta digital ya usa el aprendiz?</strong>
        <div class="matriz322-note-copy">${valueOrEmpty("contexto-reto-herramienta")}</div>
      </div>`;
    return {
      title: "Matriz 3.2.2 - Diagnostico Digital",
      subtitle: `${summary.fullName} | Grupo ${summary.grupo}`,
      meta: `Aprendiz: ${escapeHtml(summary.fullName)} | Grupo: ${escapeHtml(summary.grupo)} | Ficha: ${escapeHtml(summary.ficha)} | Finalizado: ${escapeHtml(formatDate(summary.finalizadaAt))}`,
      bodyHtml,
    };
  }

  function buildStudentActivityTable(config, deps) {
    const groupUsers = Array.isArray(config?.groupUsers) ? config.groupUsers : [];
    const fileName = config?.fileName || "";
    const activityId = config?.activityId || "";
    const activityLabel = config?.activityLabel || "";
    const guideKind = config?.guideKind || "";
    const summaries = config?.summaries || {};
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const formatDate = typeof deps?.formatDate === "function" ? deps.formatDate : (value) => String(value || "");
    const userHasOfficialGuide = typeof deps?.userHasOfficialGuide === "function" ? deps.userHasOfficialGuide : () => true;
    const getGuide2SummaryKey = typeof deps?.getGuide2SummaryKey === "function" ? deps.getGuide2SummaryKey : () => "";
    const buildStandardActivityButtons = typeof deps?.buildStandardActivityButtons === "function"
      ? deps.buildStandardActivityButtons
      : () => "";
    const buildMatriz322Table = typeof deps?.buildMatriz322Table === "function" ? deps.buildMatriz322Table : () => "";
    const buildFichaCasoTable = typeof deps?.buildFichaCasoTable === "function" ? deps.buildFichaCasoTable : () => "";
    const getFichaCasoFileName = typeof deps?.getFichaCasoFileName === "function" ? deps.getFichaCasoFileName : () => "";
    const getGuide1Config = typeof deps?.getGuide1Config === "function" ? deps.getGuide1Config : () => null;
    const readDeliveryRecord = typeof deps?.readDeliveryRecord === "function" ? deps.readDeliveryRecord : () => null;
    const getRedesActivitiesForFile = typeof deps?.getRedesActivitiesForFile === "function" ? deps.getRedesActivitiesForFile : () => [];
    const getGuide2ActivityStatusHtml = typeof deps?.getGuide2ActivityStatusHtml === "function"
      ? deps.getGuide2ActivityStatusHtml
      : () => '<span class="act-delivery-status act-delivery-status--pending">Sin respuestas guardadas</span>';
    const adminRedes = deps?.adminRedes || null;

    if (activityId === "matriz322") {
      const usersWithGuide = groupUsers.filter((user) => userHasOfficialGuide(user, fileName));
      const stillLoading = usersWithGuide.some((user) => {
        const key = getGuide2SummaryKey(user.usernameKey, fileName);
        return !(key in (summaries.guide2WordSearch || {}));
      });
      if (stillLoading) return '<p class="activities-loading">Cargando resultados...</p>';
      const rows = usersWithGuide
        .filter((user) => summaries.matriz322?.[user.usernameKey])
        .map((user) => ({ summary: summaries.matriz322[user.usernameKey] }));
      return buildMatriz322Table(rows);
    }

    if (activityId === "fichaCaso") {
      const usersWithFicha = groupUsers.filter((user) => getFichaCasoFileName(user));
      if (!usersWithFicha.length) {
        return '<p class="activities-empty">Esta actividad no esta disponible para el grupo seleccionado.</p>';
      }
      const loading = usersWithFicha.some((user) => !(user.usernameKey in (summaries.fichaCaso || {})));
      if (loading) return '<p class="activities-loading">Cargando respuestas...</p>';
      const rows = [];
      usersWithFicha.forEach((user) => {
        const snapshot = summaries.fichaCaso?.[user.usernameKey];
        if (snapshot?.state) rows.push({ user, snapshot });
      });
      return buildFichaCasoTable(rows);
    }

    const usersWithGuide = groupUsers.filter((user) => userHasOfficialGuide(user, fileName));
    if (!usersWithGuide.length) {
      return '<p class="activities-empty">Ningun aprendiz tiene esta guia asignada en el grupo actual.</p>';
    }

    if (guideKind === "guia1") {
      const guide1Config = getGuide1Config(fileName);
      const rows = usersWithGuide.map((user) => {
        const record = guide1Config ? readDeliveryRecord(user.usernameKey, guide1Config.pageFile, activityId) : null;
        const deliveredAt = record?.submittedAt || record?.updatedAt || "";
        const savedFile = record?.savedFileName || "";
        const statusHtml = deliveredAt
          ? `<span class="act-delivery-status act-delivery-status--sent">${escapeHtml(formatDate(deliveredAt))}</span>${savedFile ? `<br><small class="act-delivery-filename">${escapeHtml(savedFile)}</small>` : ""}`
          : '<span class="act-delivery-status act-delivery-status--pending">Sin entrega registrada</span>';
        return `<tr>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.grupo)}</td>
          <td>${statusHtml}</td>
          <td class="act-explorer__actions">${buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user)}</td>
        </tr>`;
      }).join("");
      return buildStudentTableShell(usersWithGuide.length, ["Aprendiz", "Grupo", "Fecha y hora de entrega", "Acciones"], rows);
    }

    if (guideKind === "redes") {
      const activity = getRedesActivitiesForFile(fileName).find((item) => item.id === activityId);
      const rows = usersWithGuide.map((user) => {
        let statusHtml = '<span class="act-delivery-status act-delivery-status--pending">Pendiente por consultar</span>';
        let extraActionsHtml = "";
        if (activity?.redesQuiz) {
          const summary = summaries.redesQuiz?.[user.usernameKey];
          statusHtml = adminRedes?.getQuizActivityStatusHtml
            ? adminRedes.getQuizActivityStatusHtml(summary, { escapeHtml })
            : statusHtml;
          extraActionsHtml = adminRedes?.getUnlockButtonHtml
            ? adminRedes.getUnlockButtonHtml({ type: "quiz", id: activity.id, fileName, usernameKey: user.usernameKey }, { escapeHtml })
            : "";
        } else if (activityId === "socializacion311") {
          const summary = summaries.redesSocializacion?.[user.usernameKey];
          statusHtml = adminRedes?.getSocializationActivityStatusHtml
            ? adminRedes.getSocializationActivityStatusHtml(summary, { formatDate, escapeHtml })
            : statusHtml;
          extraActionsHtml = adminRedes?.getUnlockButtonHtml
            ? adminRedes.getUnlockButtonHtml({ type: "activity", id: activityId, fileName, usernameKey: user.usernameKey }, { escapeHtml })
            : "";
        } else {
          extraActionsHtml = adminRedes?.getUnlockButtonHtml
            ? adminRedes.getUnlockButtonHtml({ type: "activity", id: activityId, fileName, usernameKey: user.usernameKey }, { escapeHtml })
            : "";
        }
        return `<tr>
          <td>${escapeHtml(user.fullName)}</td>
          <td>${escapeHtml(user.grupo)}</td>
          <td>${statusHtml}</td>
          <td class="act-explorer__actions">
            ${buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user)}
            ${extraActionsHtml}
          </td>
        </tr>`;
      }).join("");
      return buildStudentTableShell(usersWithGuide.length, ["Aprendiz", "Grupo", "Estado", "Acciones"], rows);
    }

    const rows = usersWithGuide.map((user) => {
      const key = getGuide2SummaryKey(user.usernameKey, fileName);
      const isGameActivity = activityId === "wordsearch" || activityId === "matching";
      const hasLoadedSnapshot = key in (summaries.guide2Responses || {});
      const snapshot = summaries.guide2Responses?.[key] || null;
      const summary = activityId === "wordsearch"
        ? summaries.guide2WordSearch?.[key]
        : activityId === "matching"
        ? summaries.guide2MatchingGame?.[key]
        : null;
      const statusHtml = !isGameActivity
        ? hasLoadedSnapshot
          ? getGuide2ActivityStatusHtml(activityId, snapshot)
          : '<span class="act-delivery-status act-delivery-status--pending">Cargando respuestas...</span>'
        : summary
        ? `<span class="act-delivery-status act-delivery-status--sent">${summary.completed ? "Completada" : "Iniciada"}</span>
           <small class="act-delivery-filename">Puntaje ${escapeHtml(summary.score)} / 10000${summary.source === "leaderboard" ? " - Top 5" : ""}</small>`
        : hasLoadedSnapshot
          ? '<span class="act-delivery-status act-delivery-status--pending">Sin respuestas guardadas</span>'
          : '<span class="act-delivery-status act-delivery-status--pending">Cargando respuestas...</span>';
      return `<tr>
        <td>${escapeHtml(user.fullName)}</td>
        <td>${escapeHtml(user.grupo)}</td>
        <td>${statusHtml}</td>
        <td class="act-explorer__actions">
          ${buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user)}
        </td>
      </tr>`;
    }).join("");
    return buildStudentTableShell(usersWithGuide.length, ["Aprendiz", "Grupo", "Estado", "Acciones"], rows);
  }

  function buildStudentTableShell(count, headers, rowsHtml) {
    return `
      <div class="act-explorer__table-header">
        <span class="act-explorer__table-count">${count} aprendice${count !== 1 ? "s" : ""}</span>
      </div>
      <div class="answer-table-wrap">
        <table class="answer-table">
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  function buildExplorerPanel(config, deps) {
    const groupUsers = Array.isArray(config?.groupUsers) ? config.groupUsers : [];
    const guides = Array.isArray(config?.guides) ? config.guides : [];
    const activeGuide = config?.activeGuide || "";
    const activeActivity = config?.activeActivity || "";
    const escapeHtml = typeof deps?.escapeHtml === "function" ? deps.escapeHtml : (value) => String(value || "");
    const getUnlockActivitiesForGuide = typeof deps?.getUnlockActivitiesForGuide === "function"
      ? deps.getUnlockActivitiesForGuide
      : () => [];
    const buildActivitiesStudentTable = typeof deps?.buildActivitiesStudentTable === "function"
      ? deps.buildActivitiesStudentTable
      : () => "";

    if (!guides.length) {
      return {
        html: '<div class="empty-state">No hay actividades interactivas registradas para este grupo.</div>',
        activeGuide: null,
        activeActivity: null,
      };
    }

    const selectedGuide = guides.find((guide) => guide.fileName === activeGuide) || guides[0];
    const activities = getUnlockActivitiesForGuide(selectedGuide.fileName);
    const selectedActivity = activities.find((activity) => activity.id === activeActivity) || activities[0] || null;

    const guideFilterHtml = guides.length > 1
      ? `<div class="act-explorer__guide-filter">
          ${guides.map((guide) => `
            <button class="act-explorer__guide-btn${guide.fileName === selectedGuide.fileName ? " is-active" : ""}"
              type="button" data-activities-guide="${escapeHtml(guide.fileName)}">
              ${escapeHtml(guide.title)}
            </button>`).join("")}
         </div>`
      : `<div class="act-explorer__guide-title">${escapeHtml(selectedGuide.title)}</div>`;

    const activityListHtml = `
      <nav class="act-explorer__activity-list">
        ${activities.map((activity) => `
          <button class="act-explorer__activity-btn${selectedActivity && activity.id === selectedActivity.id ? " is-active" : ""}"
            type="button" data-activities-activity="${escapeHtml(activity.id)}">
            ${escapeHtml(activity.label)}
          </button>`).join("")}
      </nav>`;

    const studentPanelHtml = selectedActivity
      ? buildActivitiesStudentTable(
          groupUsers,
          selectedGuide.fileName,
          selectedActivity.id,
          selectedActivity.label,
          selectedGuide.guideKind
        )
      : '<p class="activities-empty">Selecciona una actividad.</p>';

    return {
      activeGuide: selectedGuide.fileName,
      activeActivity: selectedActivity?.id || null,
      html: `
      <section class="panel act-explorer">
        <h2>Respuestas por actividad</h2>
        ${guideFilterHtml}
        <div class="act-explorer__layout">
          ${activityListHtml}
          <div class="act-explorer__student-panel">
            ${selectedActivity ? `<h3 class="act-explorer__activity-heading">${escapeHtml(selectedActivity.label)}</h3>` : ""}
            ${studentPanelHtml}
          </div>
        </div>
      </section>`,
    };
  }

  window.adminActivities = Object.freeze({
    getGroups,
    buildStandardButtons,
    getUniqueInteractiveGuides,
    getGuide2ActivityStatusHtml,
    buildGuide1ActivityResponsePayload,
    buildMatriz322Table,
    buildMatriz322ModalPayload,
    buildStudentActivityTable,
    buildExplorerPanel,
  });
})();
