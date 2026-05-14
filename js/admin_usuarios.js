(function () {
  "use strict";

  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  const adminAudit = window.adminAudit || null;
  const adminExport = window.adminExport || null;

  if (!auth) return;

  const state = {
    users: [],
    activeModule: "dashboard",
    filters: {
      text: "",
      ficha: "",
      status: "",
      activityFicha: "",
      activityGuide: "",
      responsesFicha: "",
      responsesGuide: "",
      responsesText: "",
      deliveriesFicha: "",
      deliveriesText: "",
    },
    modalExport: null,
  };

  const MODULE_TITLES = {
    dashboard: "Dashboard general",
    aprendices: "Gestion de aprendices",
    fichas: "Gestion de fichas",
    guias: "Gestion de guias",
    actividades: "Gestion de actividades",
    fechas: "Fechas de entrega",
    respuestas: "Seguimiento de respuestas",
    entregas: "Seguimiento de entregas",
    reportes: "Reportes",
    configuracion: "Configuracion",
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function readJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function formatDate(value) {
    if (!value) return "Sin registro";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sin registro";
    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function isInactive(user) {
    return user?.active === false || String(user?.status || "").toLowerCase() === "inactive";
  }

  function setFeedback(message, type) {
    const box = byId("admin-feedback");
    if (!box) return;
    box.className = `admin-feedback ${message ? type || "info" : ""}`;
    box.textContent = message || "";
  }

  function hasAdminPanelAccess() {
    if (typeof auth.requireAdminAccess === "function") {
      return auth.requireAdminAccess({ redirect: false });
    }
    return Boolean(auth.isAdminSession?.());
  }

  async function confirmAdminAction(message) {
    if (typeof window.adminConfirmAction === "function") {
      return !!(await window.adminConfirmAction(message));
    }
    return window.confirm(message);
  }

  function recordAudit(entry) {
    if (!adminAudit || typeof adminAudit.recordAction !== "function") return;
    adminAudit.recordAction(entry);
  }

  function getFichaEntries() {
    return Object.entries(auth.FICHA_MAP || {});
  }

  function getFichaOptions(selected, includeAll) {
    const first = includeAll ? '<option value="">Todas las fichas</option>' : '<option value="">Selecciona ficha</option>';
    return first + getFichaEntries().map(([ficha, info]) => {
      const label = `${ficha} - Grupo ${info.grupo} | ${info.inst}`;
      return `<option value="${escapeHtml(ficha)}"${String(selected || "") === ficha ? " selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function getUsersForFicha(ficha) {
    return state.users.filter((user) => String(user.ficha || "") === String(ficha || ""));
  }

  function getGuidesForFicha(ficha) {
    return typeof auth.getGuidesForFicha === "function" ? auth.getGuidesForFicha(ficha) : [];
  }

  function getAllGuideFiles() {
    const seen = new Set();
    getFichaEntries().forEach(([, info]) => {
      (info.guias || []).forEach((fileName) => seen.add(fileName));
    });
    return Array.from(seen);
  }

  function getGuideOptionsForFicha(ficha, selected, includeAll) {
    const files = ficha ? getGuidesForFicha(ficha) : getAllGuideFiles();
    const first = includeAll ? '<option value="">Todas las guias</option>' : '<option value="">Selecciona guia</option>';
    return first + files.map((fileName) =>
      `<option value="${escapeHtml(fileName)}"${fileName === selected ? " selected" : ""}>${escapeHtml(auth.getGuideTitle(fileName))}</option>`
    ).join("");
  }

  function getActivityOptions(fileName, selected, includeAll) {
    const activities = deadlineManager?.getActivitiesForGuide?.(fileName) || window.ActivityStandard?.getActivitiesForGuide?.(fileName) || [];
    const first = includeAll ? '<option value="">Todas las actividades</option>' : '<option value="">Selecciona actividad</option>';
    return first + activities.map((activity) =>
      `<option value="${escapeHtml(activity.id)}"${activity.id === selected ? " selected" : ""}>${escapeHtml(activity.label)}</option>`
    ).join("");
  }

  function guideHref(fileName, ficha) {
    const params = new URLSearchParams();
    if (ficha) {
      const selection = auth.getSelectionForFicha(ficha);
      params.set("ficha", selection.ficha);
      params.set("inst", selection.inst);
      params.set("grupo", selection.grupo);
    }
    const route = typeof auth.getGuideHref === "function" ? auth.getGuideHref(fileName) : `guia.html?g=${encodeURIComponent(fileName)}`;
    return params.toString() ? `${route}&${params.toString()}` : route;
  }

  function progressForUser(user) {
    if (user?.progress?.guides) return user.progress;
    const guides = getGuidesForFicha(user.ficha).map((fileName) => auth.getStudentGuideProgress(user.usernameKey, fileName));
    const completed = guides.reduce((sum, item) => sum + (Number(item.completed) || 0), 0);
    const total = guides.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    return {
      guides,
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
    };
  }

  function getDashboardStats() {
    const fichas = getFichaEntries();
    const guideFiles = getAllGuideFiles();
    const activities = guideFiles.flatMap((fileName) =>
      (deadlineManager?.getActivitiesForGuide?.(fileName) || []).map((activity) => ({ ...activity, fileName }))
    );
    const policies = deadlineManager?.getSnapshot?.().policies || {};
    const dueItems = [];
    Object.keys(policies).forEach((fileName) => {
      Object.keys(policies[fileName] || {}).forEach((activityId) => {
        const policy = policies[fileName][activityId];
        const evaluation = deadlineManager?.evaluatePolicy?.(policy);
        dueItems.push({ fileName, activityId, state: evaluation?.state || "none" });
      });
    });
    const deliveries = collectDeliveries();
    return {
      learners: state.users.length,
      activeLearners: state.users.filter((user) => !isInactive(user)).length,
      fichas: fichas.length,
      guides: guideFiles.length,
      activities: activities.length,
      deliveries: deliveries.length,
      pending: activities.length ? Math.max(0, activities.length * Math.max(1, state.users.length) - deliveries.length) : 0,
      expired: dueItems.filter((item) => item.state === "closed").length,
    };
  }

  function renderKpis() {
    const stats = getDashboardStats();
    const items = [
      ["Aprendices", stats.learners, `${stats.activeLearners} activos`],
      ["Fichas", stats.fichas, "Grupos disponibles"],
      ["Guias", stats.guides, "Rutas conservadas"],
      ["Actividades", stats.activities, "Catalogo actual"],
      ["Entregas", stats.deliveries, "Registros detectados"],
      ["Pendientes", stats.pending, "Estimacion general"],
      ["Vencidas", stats.expired, "Fechas cerradas"],
      ["Seguridad", "Admin", "Rol validado"],
    ];
    byId("dashboard-kpis").innerHTML = items.map(([label, value, hint]) => `
      <article class="admin-kpi">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(hint)}</small>
      </article>
    `).join("");
  }

  function getFichaProgressRows() {
    return getFichaEntries().map(([ficha, info]) => {
      const users = getUsersForFicha(ficha);
      const totals = users.map(progressForUser);
      const average = totals.length
        ? Math.round(totals.reduce((sum, item) => sum + item.percent, 0) / totals.length)
        : 0;
      return { ficha, info, users, average };
    });
  }

  function renderDashboard() {
    renderKpis();
    byId("dashboard-progress").innerHTML = getFichaProgressRows().map((row) => `
      <div class="progress-line">
        <div class="progress-line__top">
          <strong>${escapeHtml(row.ficha)} - Grupo ${escapeHtml(row.info.grupo)}</strong>
          <span>${row.average}% | ${row.users.length} aprendices</span>
        </div>
        <progress value="${row.average}" max="100">${row.average}%</progress>
      </div>
    `).join("") || '<p class="admin-empty">No hay fichas configuradas.</p>';
  }

  function getFilteredUsers() {
    const text = normalizeText(state.filters.text);
    return state.users.filter((user) => {
      const status = isInactive(user) ? "inactive" : "active";
      const haystack = normalizeText(`${user.fullName} ${user.username} ${user.usernameKey} ${user.ficha} ${user.grupo} ${status}`);
      return (!text || haystack.includes(text)) &&
        (!state.filters.ficha || String(user.ficha || "") === state.filters.ficha) &&
        (!state.filters.status || status === state.filters.status);
    });
  }

  function getNameValidationInfo(user) {
    const normalized = normalizeText(user.nombreNormalizado || user.fullName || user.nombreCompleto);
    const sameNameCount = state.users.filter((item) =>
      String(item.ficha || "") === String(user.ficha || "") &&
      normalizeText(item.nombreNormalizado || item.fullName || item.nombreCompleto) === normalized
    ).length;
    if (sameNameCount > 1) {
      return { label: "Posible duplicado", css: "admin-status--danger" };
    }
    if (String(user.validacionNombre || "").toLowerCase() === "oficial") {
      return { label: "Nombre oficial", css: "admin-status--safe" };
    }
    return { label: "Pendiente revision", css: "admin-status--warn" };
  }

  function renderLearners() {
    const users = getFilteredUsers();
    const rows = users.map((user) => {
      const progress = progressForUser(user);
      const status = isInactive(user) ? "inactive" : "active";
      const validation = getNameValidationInfo(user);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(user.fullName)}</strong>
            <div class="admin-muted">${escapeHtml(user.username || user.usernameKey)}</div>
          </td>
          <td>${escapeHtml(user.ficha)}<br><span class="admin-muted">Grupo ${escapeHtml(user.grupo || "")}</span></td>
          <td>${escapeHtml(user.inst || user.institucion || "")}</td>
          <td><span class="admin-status admin-status--${status}">${status === "active" ? "Activo" : "Inactivo"}</span></td>
          <td>
            <span class="admin-status ${validation.css}">${escapeHtml(validation.label)}</span>
            <div class="admin-muted">${escapeHtml(user.fuenteValidacion || user.observacionValidacion || "")}</div>
          </td>
          <td>
            <progress value="${progress.percent}" max="100">${progress.percent}%</progress>
            <span class="admin-muted">${progress.percent}% general</span>
          </td>
          <td class="admin-row-actions">
            <button class="admin-button admin-button--ghost" type="button" data-view-learner="${escapeHtml(user.usernameKey)}">Ver</button>
            <button class="admin-button admin-button--ghost" type="button" data-edit-learner="${escapeHtml(user.usernameKey)}">Editar</button>
            <button class="admin-button admin-button--ghost" type="button" data-password-learner="${escapeHtml(user.usernameKey)}">Contrasena</button>
            <button class="admin-button admin-button--danger" type="button" data-toggle-learner="${escapeHtml(user.usernameKey)}" data-next-active="${status === "active" ? "false" : "true"}">${status === "active" ? "Desactivar" : "Activar"}</button>
          </td>
        </tr>
      `;
    }).join("");

    byId("learners-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Aprendiz</th><th>Ficha</th><th>Institucion</th><th>Estado</th><th>Validacion</th><th>Progreso</th><th>Acciones</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">No hay aprendices que coincidan con los filtros.</td></tr>'}</tbody>
      </table>
    `;
  }

  function renderFichas() {
    const rows = getFichaProgressRows().map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.ficha)}</strong><br><span class="admin-muted">${escapeHtml(row.info.inst)}</span></td>
        <td>Grupo ${escapeHtml(row.info.grupo)}</td>
        <td>${row.users.length}</td>
        <td>${(row.info.guias || []).length}</td>
        <td><progress value="${row.average}" max="100">${row.average}%</progress> ${row.average}%</td>
        <td><span class="admin-status admin-status--active">Activa</span></td>
      </tr>
    `).join("");
    byId("fichas-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Ficha</th><th>Grupo</th><th>Aprendices</th><th>Guias</th><th>Progreso</th><th>Estado</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="admin-todo">TODO(reportes): crear/editar/desactivar fichas requiere persistir un mapa de fichas administrable. Por ahora se conserva FICHA_MAP para no romper rutas ni acceso por ficha.</p>
    `;
  }

  function renderGuides() {
    const rows = getFichaEntries().flatMap(([ficha, info]) =>
      (info.guias || []).map((fileName) => `
        <tr>
          <td>${escapeHtml(ficha)}<br><span class="admin-muted">Grupo ${escapeHtml(info.grupo)}</span></td>
          <td><strong>${escapeHtml(auth.getGuideTitle(fileName))}</strong><br><span class="admin-muted">${escapeHtml(fileName)}</span></td>
          <td>${(deadlineManager?.getActivitiesForGuide?.(fileName) || []).length}</td>
          <td><span class="admin-status admin-status--active">Habilitada</span></td>
          <td><a class="admin-button admin-button--ghost" href="${escapeHtml(guideHref(fileName, ficha))}">Abrir guia</a></td>
        </tr>
      `)
    ).join("");
    byId("guides-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Ficha</th><th>Guia</th><th>Actividades</th><th>Estado</th><th>Acceso</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function selectedActivityFicha() {
    return state.filters.activityFicha || getFichaEntries()[0]?.[0] || "";
  }

  function selectedActivityGuide() {
    const ficha = selectedActivityFicha();
    return state.filters.activityGuide || getGuidesForFicha(ficha)[0] || "";
  }

  function activityKind(activity) {
    if (activity.deliveryOnly) return "Entrega de archivo";
    if (/-delivery$/.test(String(activity.id || ""))) return "Entrega de archivo";
    if ((activity.keys || []).length) return "Preguntas/formulario";
    return "Informativa";
  }

  function renderActivities() {
    const fichaSelect = byId("activity-ficha-filter");
    const guideSelect = byId("activity-guide-filter");
    const ficha = selectedActivityFicha();
    const guide = selectedActivityGuide();
    fichaSelect.innerHTML = getFichaOptions(ficha, false);
    guideSelect.innerHTML = getGuideOptionsForFicha(ficha, guide, false);

    const activities = deadlineManager?.getActivitiesForGuide?.(guide) || window.ActivityStandard?.getActivitiesForGuide?.(guide) || [];
    const rows = activities.map((activity) => {
      const policy = deadlineManager?.getPolicy?.(guide, activity.id);
      const evaluation = deadlineManager?.evaluatePolicy?.(policy);
      const status = evaluation?.state === "closed" ? "Vencida" : evaluation?.state === "active" ? "Abierta" : "Sin fecha";
      return `
        <tr>
          <td><strong>${escapeHtml(activity.label)}</strong><br><span class="admin-muted">${escapeHtml(activity.id)}</span></td>
          <td>${escapeHtml(activityKind(activity))}</td>
          <td><span class="admin-status ${evaluation?.state === "closed" ? "admin-status--danger" : "admin-status--safe"}">${escapeHtml(status)}</span></td>
          <td>${escapeHtml(policy?.dueAt ? deadlineManager.formatDueAt(policy.dueAt) : "Sin fecha")}</td>
          <td><span class="admin-muted">Visualizacion habilitada / respuesta segun fecha / entrega segun fecha.</span></td>
        </tr>
      `;
    }).join("");

    byId("activities-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Actividad</th><th>Tipo</th><th>Estado</th><th>Fecha limite</th><th>Permisos</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Esta guia no tiene actividades configuradas en el catalogo.</td></tr>'}</tbody>
      </table>
    `;
  }

  function selectedDeadlineValues() {
    const ficha = byId("deadline-ficha")?.value || getFichaEntries()[0]?.[0] || "";
    const guide = byId("deadline-guide")?.value || getGuidesForFicha(ficha)[0] || "";
    const activity = byId("deadline-activity")?.value || "";
    return { ficha, guide, activity };
  }

  function renderDeadlineSelectors() {
    const { ficha, guide, activity } = selectedDeadlineValues();
    byId("deadline-ficha").innerHTML = getFichaOptions(ficha, false);
    byId("deadline-guide").innerHTML = getGuideOptionsForFicha(ficha, guide, false);
    byId("deadline-activity").innerHTML = getActivityOptions(guide, activity, false);
    const nextActivity = byId("deadline-activity").value;
    const policy = deadlineManager?.getPolicy?.(guide, nextActivity);
    byId("deadline-due-at").value = policy?.dueAt || "";
  }

  function renderDeadlines() {
    renderDeadlineSelectors();
    const rows = getFichaEntries().flatMap(([ficha, info]) =>
      (info.guias || []).flatMap((fileName) =>
        (deadlineManager?.getActivitiesForGuide?.(fileName) || []).map((activity) => {
          const policy = deadlineManager?.getPolicy?.(fileName, activity.id);
          const evaluation = deadlineManager?.evaluatePolicy?.(policy);
          const label = !policy ? "Sin fecha" : evaluation?.state === "closed" ? "Vencida / bloquea entrega" : "Abierta";
          return `
            <tr>
              <td>${escapeHtml(ficha)}<br><span class="admin-muted">Grupo ${escapeHtml(info.grupo)}</span></td>
              <td>${escapeHtml(auth.getGuideTitle(fileName))}</td>
              <td>${escapeHtml(activity.label)}</td>
              <td>${escapeHtml(policy?.dueAt ? deadlineManager.formatDueAt(policy.dueAt) : "Sin fecha")}</td>
              <td><span class="admin-status ${evaluation?.state === "closed" ? "admin-status--danger" : policy ? "admin-status--safe" : "admin-status--warn"}">${escapeHtml(label)}</span></td>
            </tr>
          `;
        })
      )
    ).join("");
    byId("deadlines-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Fecha limite</th><th>Estado</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No hay actividades con fechas configurables.</td></tr>'}</tbody>
      </table>
    `;
  }

  function getGuideStateKey(fileName) {
    return window.ActivityStandard?.getStateKeyForGuide?.(fileName) ||
      auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey ||
      "";
  }

  function readStudentGuideState(usernameKey, fileName) {
    const stateKey = getGuideStateKey(fileName);
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return null;
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    return readJson(localStorage.getItem(storageKey), null);
  }

  function stateHasAnswers(record) {
    if (!record || typeof record !== "object") return false;
    return Object.values(record).some((value) => {
      if (typeof value === "boolean") return value;
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return String(value || "").trim().length > 0;
    });
  }

  function renderResponses() {
    const ficha = state.filters.responsesFicha || "";
    const guide = state.filters.responsesGuide || "";
    byId("responses-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    byId("responses-guide-filter").innerHTML = getGuideOptionsForFicha(ficha, guide, true);
    const text = normalizeText(state.filters.responsesText);
    const users = state.users.filter((user) =>
      (!ficha || String(user.ficha) === ficha) &&
      (!text || normalizeText(`${user.fullName} ${user.username}`).includes(text))
    );
    const rows = users.flatMap((user) => {
      const guides = guide ? [guide] : getGuidesForFicha(user.ficha);
      return guides.map((fileName) => {
        const record = readStudentGuideState(user.usernameKey, fileName);
        const hasAnswers = stateHasAnswers(record);
        return `
          <tr>
            <td>${escapeHtml(user.fullName)}<br><span class="admin-muted">${escapeHtml(user.usernameKey)}</span></td>
            <td>${escapeHtml(user.ficha)}</td>
            <td>${escapeHtml(auth.getGuideTitle(fileName))}</td>
            <td><span class="admin-status ${hasAnswers ? "admin-status--safe" : "admin-status--warn"}">${hasAnswers ? "Guardada" : "Sin registro"}</span></td>
            <td>${escapeHtml(formatDate(readJson(localStorage.getItem(`${auth.getStudentStorageKey?.(user.usernameKey, getGuideStateKey(fileName), { area: "guide-data" })}__meta`), {})?.updatedAt))}</td>
            <td><button class="admin-button admin-button--ghost" type="button" data-view-responses="${escapeHtml(user.usernameKey)}" data-guide-file="${escapeHtml(fileName)}">Ver</button></td>
          </tr>
        `;
      });
    }).join("");
    byId("responses-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Estado</th><th>Guardado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="6">No hay respuestas visibles con los filtros actuales.</td></tr>'}</tbody>
      </table>
    `;
  }

  function collectDeliveries() {
    const rows = [];
    state.users.forEach((user) => {
      getGuidesForFicha(user.ficha).forEach((fileName) => {
        const record = readStudentGuideState(user.usernameKey, fileName);
        if (!record || typeof record !== "object") return;
        Object.keys(record).forEach((key) => {
          const value = record[key];
          if (!/-delivery$/.test(key) || !value || typeof value !== "object") return;
          rows.push({
            user,
            fileName,
            activityId: key.replace(/-delivery$/, ""),
            submittedAt: value.submittedAt || value.updatedAt || "",
            savedFileName: value.savedFileName || "",
            driveUrl: value.driveUrl || "",
            status: value.status || "delivered",
          });
        });
      });
    });
    return rows;
  }

  function renderDeliveries() {
    const ficha = state.filters.deliveriesFicha || "";
    const text = normalizeText(state.filters.deliveriesText);
    byId("deliveries-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    const deliveries = collectDeliveries().filter((item) =>
      (!ficha || String(item.user.ficha) === ficha) &&
      (!text || normalizeText(`${item.user.fullName} ${item.savedFileName} ${item.activityId}`).includes(text))
    );
    const rows = deliveries.map((item) => {
      const policy = deadlineManager?.getPolicy?.(item.fileName, item.activityId);
      const late = policy?.dueAt && new Date(item.submittedAt).getTime() > new Date(policy.dueAt).getTime();
      return `
        <tr>
          <td>${escapeHtml(item.savedFileName || "Sin nombre")}</td>
          <td>${escapeHtml(item.user.fullName)}</td>
          <td>${escapeHtml(item.user.ficha)}</td>
          <td>${escapeHtml(auth.getGuideTitle(item.fileName))}</td>
          <td>${escapeHtml(item.activityId)}</td>
          <td>${escapeHtml(formatDate(item.submittedAt))}</td>
          <td><span class="admin-status ${late ? "admin-status--danger" : "admin-status--safe"}">${late ? "Tardia" : "Entregada"}</span></td>
          <td>${item.driveUrl ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(item.driveUrl)}" target="_blank" rel="noopener noreferrer">Ver</a>` : "Sin enlace"}</td>
        </tr>
      `;
    }).join("");
    byId("deliveries-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Archivo</th><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Enlace</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">No hay entregas registradas en los datos locales actuales.</td></tr>'}</tbody>
      </table>
    `;
  }

  function renderReports() {
    const stats = getDashboardStats();
    const reports = [
      ["Progreso por ficha", "Disponible", "Calculado desde progreso local/meta."],
      ["Progreso por aprendiz", "Disponible", "Incluye porcentaje general por usuario."],
      ["Actividades entregadas", "Parcial", "Depende de registros -delivery en guias estandar."],
      ["Actividades pendientes", "Parcial", "Estimacion con catalogo actual."],
      ["Actividades vencidas", "Disponible", "Basado en fechas configuradas."],
      ["Respuestas guardadas", "Parcial", "Depende de stateKey por guia."],
      ["Entregas realizadas", "Parcial", "Depende de Drive/localStorage."],
      ["Consolidado por guia", "Preparado", "TODO(reportes): exportacion consolidada avanzada."],
    ];
    byId("reports-list").innerHTML = reports.map(([name, status, note]) => `
      <div class="admin-card" style="padding:12px;margin-bottom:10px">
        <strong>${escapeHtml(name)}</strong>
        <span class="admin-status ${status === "Disponible" ? "admin-status--safe" : "admin-status--warn"}">${escapeHtml(status)}</span>
        <p>${escapeHtml(note)}</p>
      </div>
    `).join("");
    byId("reports-summary").innerHTML = `
      <table class="admin-data-table">
        <tbody>
          <tr><th>Total aprendices</th><td>${stats.learners}</td></tr>
          <tr><th>Total fichas</th><td>${stats.fichas}</td></tr>
          <tr><th>Total guias</th><td>${stats.guides}</td></tr>
          <tr><th>Total actividades</th><td>${stats.activities}</td></tr>
          <tr><th>Entregas detectadas</th><td>${stats.deliveries}</td></tr>
          <tr><th>Vencidas</th><td>${stats.expired}</td></tr>
        </tbody>
      </table>
      <p class="admin-todo">TODO(reportes): agregar descarga consolidada cuando exista un contrato unico para respuestas, notas y Drive.</p>
    `;
  }

  function renderSettings() {
    const session = auth.getCurrentSession?.();
    const storage = auth.getStorageContext?.();
    byId("settings-panel").innerHTML = `
      <table class="admin-data-table">
        <tbody>
          <tr><th>Sesion</th><td>${escapeHtml(session?.role || "Sin sesion")}</td></tr>
          <tr><th>Usuario admin</th><td>${escapeHtml(session?.user?.fullName || session?.usernameKey || "Admin")}</td></tr>
          <tr><th>Almacenamiento</th><td>${escapeHtml(storage?.label || "localStorage / sincronizacion opcional")}</td></tr>
          <tr><th>Firebase</th><td>${window._firebaseDb ? "Modulo cargado" : "No disponible en este contexto"}</td></tr>
          <tr><th>Fechas</th><td>${deadlineManager ? "activityDeadlineManager activo" : "No disponible"}</td></tr>
          <tr><th>Drive</th><td>${window.sharedAppsScriptDelivery ? "Apps Script cargado" : "Disponible solo en paginas de guia"}</td></tr>
        </tbody>
      </table>
      <p class="admin-risk-note">Seguridad: este panel valida rol antes de renderizar y antes de mutaciones. En previsualizacion local file: el proyecto permite bypass por compatibilidad; no debe asumirse como seguridad productiva.</p>
      <p class="admin-todo">TODO(seguridad): migrar autenticacion local a Firebase Authentication con reglas Firestore por rol admin/instructor/aprendiz.</p>
    `;
  }

  function renderAll() {
    renderDashboard();
    renderLearners();
    renderFichas();
    renderGuides();
    renderActivities();
    renderDeadlines();
    renderResponses();
    renderDeliveries();
    renderReports();
    renderSettings();
  }

  async function loadUsers() {
    if (!hasAdminPanelAccess()) {
      window.location.replace("index.html");
      return;
    }
    const loader = typeof auth.fetchStudentsWithProgress === "function"
      ? auth.fetchStudentsWithProgress()
      : Promise.resolve(auth.getStudentsWithProgress());
    state.users = (await loader).map((user) => ({
      ...user,
      progress: progressForUser(user),
    }));
    renderAll();
  }

  function setActiveModule(moduleName) {
    if (!MODULE_TITLES[moduleName]) return;
    state.activeModule = moduleName;
    byId("admin-page-title").textContent = MODULE_TITLES[moduleName];
    document.querySelectorAll("[data-admin-module]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.adminModule === moduleName);
    });
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== moduleName;
      panel.classList.toggle("is-active", panel.dataset.adminPanel === moduleName);
    });
  }

  function getUser(usernameKey) {
    return state.users.find((user) => user.usernameKey === usernameKey) || null;
  }

  function openModal(title, subtitle, bodyHtml, exportData) {
    state.modalExport = exportData || null;
    byId("admin-detail-title").textContent = title;
    byId("admin-detail-subtitle").textContent = subtitle || "";
    byId("admin-detail-body").innerHTML = bodyHtml || "";
    byId("admin-detail-export").hidden = !state.modalExport;
    byId("admin-detail-modal").hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    byId("admin-detail-modal").hidden = true;
    state.modalExport = null;
    document.body.classList.remove("modal-open");
  }

  function renderLearnerDetail(user) {
    const progress = progressForUser(user);
    const guideRows = progress.guides.map((guide) => `
      <tr>
        <td>${escapeHtml(guide.title || auth.getGuideTitle(guide.fileName))}</td>
        <td>${escapeHtml(guide.completed)} / ${escapeHtml(guide.total)}</td>
        <td><progress value="${escapeHtml(guide.percent)}" max="100">${escapeHtml(guide.percent)}%</progress></td>
        <td><a class="admin-button admin-button--ghost" href="${escapeHtml(guideHref(guide.fileName, user.ficha))}">Abrir</a></td>
      </tr>
    `).join("");
    return `
      <table class="admin-data-table">
        <tbody>
          <tr><th>Nombre</th><td>${escapeHtml(user.fullName)}</td></tr>
          <tr><th>Usuario</th><td>${escapeHtml(user.username || user.usernameKey)}</td></tr>
          <tr><th>Ficha</th><td>${escapeHtml(user.ficha)} - Grupo ${escapeHtml(user.grupo || "")}</td></tr>
          <tr><th>Estado</th><td>${isInactive(user) ? "Inactivo" : "Activo"}</td></tr>
          <tr><th>Progreso general</th><td>${progress.percent}%</td></tr>
        </tbody>
      </table>
      <h3>Guias asignadas</h3>
      <table class="admin-data-table">
        <thead><tr><th>Guia</th><th>Avance</th><th>Progreso</th><th>Acceso</th></tr></thead>
        <tbody>${guideRows || '<tr><td colspan="4">Sin guias asignadas.</td></tr>'}</tbody>
      </table>
    `;
  }

  function openEditLearner(user) {
    openModal("Editar aprendiz", user.fullName, `
      <form class="admin-form" id="edit-learner-form" data-user="${escapeHtml(user.usernameKey)}">
        <input name="fullName" value="${escapeHtml(user.fullName)}" placeholder="Nombre completo" required>
        <input name="username" value="${escapeHtml(user.username || user.usernameKey)}" placeholder="Usuario" required>
        <select name="ficha" required>${getFichaOptions(user.ficha, false)}</select>
        <button class="admin-button" type="submit">Guardar cambios</button>
      </form>
    `);
  }

  function openPasswordLearner(user) {
    openModal("Cambiar contrasena", user.fullName, `
      <form class="admin-form" id="password-learner-form" data-user="${escapeHtml(user.usernameKey)}">
        <input name="password" type="password" minlength="6" placeholder="Nueva contrasena" required>
        <button class="admin-button" type="submit">Actualizar contrasena</button>
      </form>
      <p class="admin-risk-note">No se mostrara la contrasena. Se guardara como hash local mientras se migra a Firebase Authentication.</p>
    `);
  }

  function openResponses(usernameKey, fileName) {
    const user = getUser(usernameKey);
    const record = user ? readStudentGuideState(usernameKey, fileName) : null;
    const rows = record && typeof record === "object"
      ? Object.keys(record).map((key) => `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td><div class="answer-value">${escapeHtml(typeof record[key] === "object" ? JSON.stringify(record[key], null, 2) : record[key])}</div></td>
          </tr>
        `).join("")
      : "";
    const bodyHtml = `
      <table class="admin-data-table">
        <thead><tr><th>Campo</th><th>Respuesta / registro</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2">No hay respuestas guardadas para esta guia.</td></tr>'}</tbody>
      </table>
    `;
    openModal(
      "Respuestas guardadas",
      `${user?.fullName || usernameKey} | ${auth.getGuideTitle(fileName)}`,
      bodyHtml,
      rows ? {
        title: "Respuestas guardadas",
        subtitle: `${user?.fullName || usernameKey} | ${auth.getGuideTitle(fileName)}`,
        meta: `Aprendiz: ${user?.fullName || usernameKey} | Ficha: ${user?.ficha || ""} | Guia: ${auth.getGuideTitle(fileName)}`,
        bodyHtml,
      } : null
    );
  }

  async function handleCreateStudent(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const confirmed = await confirmAdminAction(`Crear aprendiz ${data.fullName}?`);
    if (!confirmed) return;
    const result = await auth.adminCreateStudent(data);
    if (!result.ok) {
      setFeedback(result.message || "No fue posible crear el aprendiz.", "error");
      return;
    }
    recordAudit({ action: "student-create", target: result.user.usernameKey, detail: result.user.fullName });
    form.reset();
    setFeedback("Aprendiz creado correctamente.", "success");
    await loadUsers();
  }

  async function handleEditLearner(form) {
    const usernameKey = form.dataset.user;
    const data = Object.fromEntries(new FormData(form).entries());
    const confirmed = await confirmAdminAction("Guardar cambios del aprendiz?");
    if (!confirmed) return;
    const result = await auth.updateStudentAccount(usernameKey, data);
    if (!result.ok) {
      setFeedback(result.message || "No fue posible actualizar el aprendiz.", "error");
      return;
    }
    recordAudit({ action: "account-update", target: usernameKey, detail: data.fullName });
    closeModal();
    setFeedback("Aprendiz actualizado.", "success");
    await loadUsers();
  }

  async function handlePasswordLearner(form) {
    const usernameKey = form.dataset.user;
    const password = form.querySelector("input[name='password']")?.value || "";
    const confirmed = await confirmAdminAction("Cambiar la contrasena del aprendiz?");
    if (!confirmed) return;
    const result = await auth.updateStudentPassword(usernameKey, password);
    if (!result.ok) {
      setFeedback(result.message || "No fue posible actualizar la contrasena.", "error");
      return;
    }
    recordAudit({ action: "password-change", target: usernameKey, detail: "Cambio desde panel admin" });
    closeModal();
    setFeedback("Contrasena actualizada.", "success");
  }

  async function handleToggleLearner(button) {
    const usernameKey = button.dataset.toggleLearner;
    const nextActive = button.dataset.nextActive === "true";
    const user = getUser(usernameKey);
    const confirmed = await confirmAdminAction(`${nextActive ? "Activar" : "Desactivar"} a ${user?.fullName || usernameKey}?`);
    if (!confirmed) return;
    const result = auth.updateStudentStatus(usernameKey, nextActive);
    if (!result.ok) {
      setFeedback(result.message || "No fue posible cambiar el estado.", "error");
      return;
    }
    recordAudit({ action: "student-status", target: usernameKey, detail: nextActive ? "active" : "inactive" });
    setFeedback("Estado actualizado.", "success");
    await loadUsers();
  }

  async function handleDeadlineSubmit(form) {
    if (!deadlineManager) {
      setFeedback("El gestor de fechas no esta disponible.", "error");
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    const activityLabel = deadlineManager.getActivityLabel(data.guide, data.activity);
    const confirmed = await confirmAdminAction(`Guardar fecha para ${activityLabel}?`);
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    await deadlineManager.savePolicy(data.guide, data.activity, data.dueAt, session?.usernameKey || "admin");
    recordAudit({ action: "deadline-save", target: `${data.guide}:${data.activity}`, detail: data.dueAt });
    setFeedback("Fecha de entrega guardada.", "success");
    renderAll();
  }

  async function handleDeadlineClear() {
    if (!deadlineManager) return;
    const { guide, activity } = selectedDeadlineValues();
    if (!guide || !activity) {
      setFeedback("Selecciona guia y actividad.", "error");
      return;
    }
    const confirmed = await confirmAdminAction("Eliminar la fecha de entrega seleccionada?");
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    await deadlineManager.clearPolicy(guide, activity, session?.usernameKey || "admin");
    recordAudit({ action: "deadline-clear", target: `${guide}:${activity}`, detail: "Fecha eliminada" });
    setFeedback("Fecha eliminada.", "success");
    renderAll();
  }

  function bindEvents() {
    document.querySelectorAll("[data-admin-module]").forEach((button) => {
      button.addEventListener("click", () => setActiveModule(button.dataset.adminModule));
    });
    document.querySelectorAll("[data-jump-module]").forEach((button) => {
      button.addEventListener("click", () => setActiveModule(button.dataset.jumpModule));
    });
    byId("refresh-users")?.addEventListener("click", () => loadUsers());
    byId("user-search")?.addEventListener("input", (event) => {
      state.filters.text = event.target.value;
      renderLearners();
    });
    byId("ficha-filter")?.addEventListener("change", (event) => {
      state.filters.ficha = event.target.value;
      renderLearners();
    });
    byId("status-filter")?.addEventListener("change", (event) => {
      state.filters.status = event.target.value;
      renderLearners();
    });
    byId("activity-ficha-filter")?.addEventListener("change", (event) => {
      state.filters.activityFicha = event.target.value;
      state.filters.activityGuide = "";
      renderActivities();
    });
    byId("activity-guide-filter")?.addEventListener("change", (event) => {
      state.filters.activityGuide = event.target.value;
      renderActivities();
    });
    ["deadline-ficha", "deadline-guide"].forEach((id) => {
      byId(id)?.addEventListener("change", () => renderDeadlineSelectors());
    });
    byId("deadline-activity")?.addEventListener("change", () => renderDeadlineSelectors());
    byId("responses-ficha-filter")?.addEventListener("change", (event) => {
      state.filters.responsesFicha = event.target.value;
      state.filters.responsesGuide = "";
      renderResponses();
    });
    byId("responses-guide-filter")?.addEventListener("change", (event) => {
      state.filters.responsesGuide = event.target.value;
      renderResponses();
    });
    byId("responses-search")?.addEventListener("input", (event) => {
      state.filters.responsesText = event.target.value;
      renderResponses();
    });
    byId("deliveries-ficha-filter")?.addEventListener("change", (event) => {
      state.filters.deliveriesFicha = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-search")?.addEventListener("input", (event) => {
      state.filters.deliveriesText = event.target.value;
      renderDeliveries();
    });
    byId("create-student-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleCreateStudent(event.currentTarget);
    });
    byId("deadline-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleDeadlineSubmit(event.currentTarget);
    });
    byId("deadline-clear")?.addEventListener("click", handleDeadlineClear);
    byId("admin-detail-export")?.addEventListener("click", () => {
      if (adminExport && state.modalExport) adminExport.downloadWord(state.modalExport);
    });
    document.addEventListener("submit", async (event) => {
      if (event.target?.id === "edit-learner-form") {
        event.preventDefault();
        await handleEditLearner(event.target);
      }
      if (event.target?.id === "password-learner-form") {
        event.preventDefault();
        await handlePasswordLearner(event.target);
      }
    });
    document.addEventListener("click", async (event) => {
      const viewLearner = event.target.closest("[data-view-learner]");
      if (viewLearner) {
        const user = getUser(viewLearner.dataset.viewLearner);
        if (user) openModal("Progreso individual", user.fullName, renderLearnerDetail(user));
        return;
      }
      const editLearner = event.target.closest("[data-edit-learner]");
      if (editLearner) {
        const user = getUser(editLearner.dataset.editLearner);
        if (user) openEditLearner(user);
        return;
      }
      const passLearner = event.target.closest("[data-password-learner]");
      if (passLearner) {
        const user = getUser(passLearner.dataset.passwordLearner);
        if (user) openPasswordLearner(user);
        return;
      }
      const toggleLearner = event.target.closest("[data-toggle-learner]");
      if (toggleLearner) {
        await handleToggleLearner(toggleLearner);
        return;
      }
      const responses = event.target.closest("[data-view-responses]");
      if (responses) {
        openResponses(responses.dataset.viewResponses, responses.dataset.guideFile);
        return;
      }
      if (event.target.closest("[data-close-admin-modal]")) {
        closeModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal();
    });
  }

  function initSelects() {
    byId("ficha-filter").innerHTML = getFichaOptions("", true);
    byId("create-student-form").querySelector("select[name='ficha']").innerHTML = getFichaOptions("", false);
    byId("activity-ficha-filter").innerHTML = getFichaOptions("", false);
    byId("responses-ficha-filter").innerHTML = getFichaOptions("", true);
    byId("deliveries-ficha-filter").innerHTML = getFichaOptions("", true);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!hasAdminPanelAccess()) {
      window.location.replace("index.html");
      return;
    }
    initSelects();
    bindEvents();
    if (deadlineManager?.ready) {
      await deadlineManager.ready().catch(() => null);
    }
    await loadUsers();
  });
})();
