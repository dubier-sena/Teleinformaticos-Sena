(function () {
  "use strict";

  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  const adminAudit = window.adminAudit || null;
  const adminExport = window.adminExport || null;

  if (!auth) return;

  const GUIDE2_SYSTEM_ACTIVITY_KEYS = ["sistemas332-locked"];
  const GUIDE2_COLLABORATIVE_ACTIVITY_KEYS = ["colaborativas334-locked"];
  const GUIDE2_TRANSFER_RETO_KEYS = ["transfer-reto-locked"];
  const GUIDE2_EXTENSION_ACTIVITY_KEYS = ["extensiones331-locked"];
  const GUIDE6_RESPONSE_CONFIGS = {
    "grupo-11a-guia-06-planificar-informacion.html": {
      cloudFileName: "11a_guia6.html",
      stateKey: "guia_interactiva_11a_guia6_html",
    },
    "grupo-11b-guia-06-planificar-informacion.html": {
      cloudFileName: "11b_guia6.html",
      stateKey: "guia_interactiva_11b_guia6_html",
    },
  };
  // Compatibilidad con reportes heredados: BitÃ¡cora 3.1.1
  const GUIDE6_UNLOCK_ACTIVITIES = [
    { id: "bitacora311", label: "Bitácora 3.1.1 - Bitacora inicial", keys: ["bitacora311-locked"] },
    { id: "socializacion312", label: "Actividad 3.1.2 - Socializacion", keys: ["socializacion312-locked"] },
    { id: "quiz312", label: "Actividad 3.1.2 - Quiz herramientas", keys: ["quiz312-locked", "quiz-guia6-312-locked"] },
    { id: "contexto321", label: "Actividad 3.2.1 - Contexto", keys: ["contexto321-locked"] },
    { id: "mapa322", label: "Actividad 3.2.2 - Mapa conceptual", keys: ["mapa322-locked"] },
    { id: "instalacion331", label: "Actividad 3.3.1 - Instalacion", keys: ["instalacion331-locked"] },
    { id: "diagnostico331", label: "Actividad 3.3.1 - Diagnostico", keys: ["diagnostico331-locked"] },
    { id: "presupuesto341", label: "Actividad 3.4.1 - Presupuesto", keys: ["presupuesto341-locked"] },
  ];
  const REDES_LAB_ACTIVITIES = [
    { id: "lab1", label: "Laboratorio 1 - Red en estrella", keys: ["lab1-locked"] },
    { id: "lab2", label: "Laboratorio 2 - Red en arbol", keys: ["lab2-locked"] },
    { id: "lab3", label: "Laboratorio 3 - Red hibrida", keys: ["lab3-locked"] },
    { id: "taller-ip-ej1", label: "Taller IP - Ejercicio 1", keys: ["taller-ip-ej1-locked"] },
    { id: "taller-ip-ej2", label: "Taller IP - Ejercicio 2", keys: ["taller-ip-ej2-locked"] },
    { id: "taller-ip-ej3", label: "Taller IP - Ejercicio 3", keys: ["taller-ip-ej3-locked"] },
    { id: "taller-ip-ej4", label: "Taller IP - Ejercicio 4", keys: ["taller-ip-ej4-locked"] },
    { id: "taller-ip-ej5", label: "Taller IP - Ejercicio 5", keys: ["taller-ip-ej5-locked"] },
  ];

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
      responsesLearner: "",
      responsesActivity: "",
      responsesStatus: "",
      responsesText: "",
      deliveriesFicha: "",
      deliveriesText: "",
    },
    modalExport: null,
  };
  let currentResponsesExport = null;

  const MODULE_TITLES = {
    dashboard: "Dashboard general",
    aprendices: "Gestion de aprendices",
    fichas: "Gestion de fichas",
    guias: "Gestion de guias",
    actividades: "Gestion de actividades",
    fechas: "Fechas de entrega",
    respuestas: "Seguimiento de respuestas",
    entregas: "Seguimiento de entregas",
    habilitacion: "Habilitacion de actividades",
    notas: "Calificaciones",
    mejoramiento: "Planes de Mejoramiento",
    reportes: "Reportes",
    configuracion: "Configuracion",
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function readJson(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // ── localStorage resiliente a cuota ─────────────────────────────────────────
  // El navegador tiene un limite (~5MB). Una escritura que no cabe lanza
  // QuotaExceededError. En el panel admin eso NO debe romper la accion en curso:
  // la nube (Firestore) es la fuente de verdad de todo dato compartido.
  function safeSetLocalAdmin(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { return false; }
  }

  // ── Cache de estados de guia de aprendices: MEMORIA, no localStorage ─────────
  // El panel baja el guide-data de TODOS los aprendices de la ficha (respuestas,
  // entregas, dashboard). Persistir eso en localStorage llenaba la cuota del
  // navegador del admin (datos de decenas de aprendices) y hacia fallar las
  // escrituras propias del admin (notas, auditoria, edicion de aprendiz) con
  // "quota exceeded". Ahora se cachea EN MEMORIA durante la sesion; localStorage
  // solo se usa como fallback best-effort para ediciones puntuales del admin.
  const _guideDataMem = new Map(); // storageKey -> { state, meta }

  function guideDataCacheSet(storageKey, state, meta) {
    if (!storageKey) return;
    _guideDataMem.set(storageKey, {
      state: state && typeof state === "object" ? state : null,
      meta: meta && typeof meta === "object" ? meta : {},
    });
  }

  function readGuideDataState(storageKey) {
    if (!storageKey) return null;
    if (_guideDataMem.has(storageKey)) return _guideDataMem.get(storageKey).state;
    return readJson(localStorage.getItem(storageKey), null);
  }

  function readGuideDataMeta(storageKey) {
    if (!storageKey) return {};
    if (_guideDataMem.has(storageKey)) return _guideDataMem.get(storageKey).meta || {};
    return readJson(localStorage.getItem(`${storageKey}__meta`), {});
  }

  // Edicion puntual del admin sobre UN aprendiz (reabrir entrega / habilitar):
  // actualiza la memoria y persiste best-effort (no rompe si localStorage esta lleno).
  function writeGuideDataLocal(storageKey, state, meta) {
    if (!storageKey) return;
    guideDataCacheSet(storageKey, state, meta);
    safeSetLocalAdmin(storageKey, JSON.stringify(state || {}));
    if (meta) safeSetLocalAdmin(`${storageKey}__meta`, JSON.stringify(meta));
  }

  // Purga (una vez por carga) los estados de guia de aprendices que sesiones
  // anteriores dejaron en localStorage. Son cache desechable: se re-hidratan a
  // memoria desde la nube. Libera la cuota para las escrituras propias del admin.
  // Solo corre en el panel admin, donde el usuario no es un aprendiz.
  let _guideDataPurged = false;
  function purgeStudentGuideDataFromLocal() {
    if (_guideDataPurged) return 0;
    _guideDataPurged = true;
    let removed = 0;
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^sena_portal:student:.*:guide-data:/.test(k)) toRemove.push(k);
      }
      toRemove.forEach((k) => {
        try { localStorage.removeItem(k); removed++; } catch (_) {}
      });
    } catch (_) { /* sin acceso a localStorage: no hay nada que purgar */ }
    return removed;
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

  function recordAdminAuditAction(entry) {
    if (!window.adminAudit || typeof window.adminAudit.recordAction !== "function") return;
    // Auditoria best-effort: nunca debe interrumpir la accion admin (p. ej. si
    // localStorage esta lleno y el registro lanza QuotaExceededError).
    try {
      window.adminAudit.recordAction(entry);
    } catch (e) {
      /* registro de auditoria omitido */
    }
  }

  function recordAudit(entry) {
    recordAdminAuditAction(entry);
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
    renderRecentDeliveries();
  }

  function formatRelativeOrDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, now)) return "hoy";
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (sameDay(d, yest)) return "ayer";
    return formatDate(iso);
  }

  function getRecentDeliveries(limit) {
    const rows = collectDeliveries();
    rows.sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
    return rows.slice(0, limit || 8);
  }

  // Tarjeta "Entregas recientes" del dashboard: lo primero que ve el admin al
  // iniciar sesion, para saber que aprendices han entregado trabajos. Los datos
  // se bajan una vez por sesion (ensureGuideStatesHydrated en loadUsers).
  function renderRecentDeliveries() {
    const host = byId("dashboard-deliveries");
    if (!host) return;
    if (!guideStatesHydrated) {
      host.innerHTML = '<p class="response-status">Cargando entregas recientes...</p>';
      return;
    }
    const rows = getRecentDeliveries(8);
    if (!rows.length) {
      host.innerHTML = '<p class="admin-empty">Aun no hay entregas registradas. Apareceran aqui cuando los aprendices entreguen trabajos.</p>';
      return;
    }
    host.innerHTML = rows.map((d) => {
      const name = escapeHtml((d.user && d.user.fullName) || (d.user && d.user.usernameKey) || "Aprendiz");
      const guide = escapeHtml(auth.getGuideTitle(d.fileName) || d.fileName || "");
      const act = escapeHtml(d.activityId || "");
      const when = escapeHtml(formatRelativeOrDate(d.submittedAt));
      return `<div class="delivery-line">
        <div class="delivery-line__main"><strong>${name}</strong><span class="admin-muted"> &middot; ${guide}${act ? " &middot; " + act : ""}</span></div>
        <span class="delivery-line__when">${when}</span>
      </div>`;
    }).join("");
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
      <p class="admin-risk-note">Contrato local activo: las fichas se leen desde FICHA_MAP para conservar rutas y accesos. La gestion de altas, bajas o cambios queda centralizada en ese mapa.</p>
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

  function buildUserCard(user) {
    const progress = progressForUser(user);
    return `
      <article class="user-card">
        <h3>${escapeHtml(user.fullName)}</h3>
        <div class="user-section-title user-section-title--progress">Progreso</div>
        <progress class="progress-bar" value="${escapeHtml(progress.percent)}" max="100">${escapeHtml(progress.percent)}%</progress>
      </article>`;
  }

  function buildProgressCard(user, guide) {
    return window.adminProgress.buildProgressCard({
      user,
      guide,
      guide2Config: null,
      guide6Config: getGuide6ResponseConfig(guide.fileName),
      guide2Activities: getUnlockActivitiesForGuide(guide.fileName),
      guide6Activities: getUnlockActivitiesForGuide(guide.fileName),
      isRedesGuide: /santa-barbara-10[ab]-guia-02-redes-rap01/.test(guide.fileName),
      redesAdminQuizConfigs: [],
      redesLabActivities: REDES_LAB_ACTIVITIES,
    }, { escapeHtml, formatDate, buildGuideUrl: guideHref, getGuideActivityStateKey });
  }

  function renderAnswerTable(headers, rows) {
    return `<table class="answer-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${
      rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    }</tbody></table>`;
  }

  function getActivitiesGroupsCore(users) {
    return window.adminActivities.getGroups(users);
  }

  function buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user) {
    return window.adminActivities.buildStandardButtons({
      activityId,
      guideKind,
      fileName,
      activityLabel,
      user,
    }, { escapeHtml });
  }

  function getUniqueInteractiveGuides(users) {
    return window.adminActivities.getUniqueInteractiveGuides(users, { auth, getUnlockActivitiesForGuide });
  }

  function getGuide2ActivityStatusHtml(activityId, snapshot) {
    return window.adminActivities.getGuide2ActivityStatusHtml(activityId, snapshot, { escapeHtml });
  }

  function buildGuide1ActivityResponsePayload(user, fileName, activityId, activityLabel) {
    return window.adminActivities.buildGuide1ActivityResponsePayload({
      user,
      fileName,
      activityId,
      activityLabel,
    }, { escapeHtml, formatDate, renderAnswerTable });
  }

  function buildMatriz322Table(rows) {
    return window.adminActivities.buildMatriz322Table(rows, { escapeHtml, formatDate });
  }

  function openMatriz322Modal(summary) {
    const payload = window.adminActivities.buildMatriz322ModalPayload(summary, { escapeHtml, formatDate });
    openModal(payload.title, payload.subtitle, payload.bodyHtml, payload);
  }

  function buildActivitiesStudentTable(groupUsers, fileName, activityId, activityLabel, guideKind) {
    return window.adminActivities.buildStudentActivityTable(
      {
        groupUsers,
        fileName,
        activityId,
        activityLabel,
        guideKind,
      },
      { escapeHtml, formatDate, buildStandardActivityButtons, getGuide2ActivityStatusHtml, adminRedes: window.adminRedes }
    );
  }

  function buildActivitiesPanels(groupUsers) {
    return window.adminActivities.buildExplorerPanel(
      {
        groupUsers,
        guides: getUniqueInteractiveGuides(groupUsers),
        activeGuide: state.filters.activityGuide,
        activeActivity: state.filters.activityActivity,
      },
      { escapeHtml, getUnlockActivitiesForGuide, buildActivitiesStudentTable }
    );
  }

  function renderGuide2ActivityResponsesBody(activityId, state, context) {
    return `<article class="answer-card"><h3>${escapeHtml(context?.activityLabel || activityId)}</h3>${renderAnswerTable(["Campo", "Valor"], Object.entries(state || {}))}</article>`;
  }

  function openGuide2ResponsesModal(user, fileName, activityId, state) {
    const bodyHtml = renderGuide2ActivityResponsesBody(activityId, state, { activityLabel: activityId });
    openModal("Respuestas Guia 2", `${user.fullName} | ${activityId}`, bodyHtml);
  }

  function renderGuide6ActivityResponsesBody(activityId, state) {
    return window.adminGuide6.renderActivityResponsesBody(activityId, state, { renderAnswerTable, formatDate, escapeHtml });
  }

  function renderGuide6ResponsesBody(state) {
    return window.adminGuide6.renderFullResponsesBody(state, { renderAnswerTable, formatDate, escapeHtml });
  }

  function handleViewGuideActivityResponses(button) {
    const action = "data-view-guide-activity";
    if (!button || !action) return;
    openResponses(button.dataset.viewGuideActivity || button.dataset.user, button.dataset.guideFile, button.dataset.activityId);
  }

  function buildRedesQuizTable(rows) {
    return `
      <table class="admin-data-table">
        <tbody>${(rows || []).map(({ user, summary }) => `
          <tr>
            <td>${escapeHtml(user?.fullName || "")}</td>
            <td>${window.adminRedes.getQuizStatusLabel(summary)}</td>
            <td>${escapeHtml(window.adminRedes.getQuizStatusText(summary))}</td>
            <td>${escapeHtml(window.adminRedes.getQuizScoreText(summary))}</td>
            <td><div class="redes-quiz-actions"><button class="admin-button admin-button--ghost" type="button">Ver</button></div></td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  function renderRedesQuizDetail(summary) {
    return window.adminRedes.getQuizEvidenceHtml(summary, { formatDate, escapeHtml });
  }

  function buildRedesSocializacionTable(rows) {
    return `
      <table class="admin-data-table">
        <tbody>${(rows || []).map(({ summary }) => `
          <tr>
            <td>${window.adminRedes.getSocializationStatusLabel(summary.locked)}</td>
            <td class="redes-socialization-notes">${escapeHtml(summary.text || "")}</td>
          </tr>`).join("")}</tbody>
      </table>`;
  }

  function getActivitiesGroups(users) {
    return getActivitiesGroupsCore(users);
  }

  async function unlockRedesGuideProgress(usernameKey, fileName, displayName) {
    const confirmed = await confirmAdminAction(`Reabrir progreso de redes para ${displayName}?`);
    if (!confirmed) {
      return;
    }
    recordAdminAuditAction({ action: "redes-guide-unlock", target: `${usernameKey}:${fileName}`, detail: displayName });
  }

  async function unlockRedesActivityProgress(usernameKey, fileName, activityId, displayName) {
    const confirmed = await confirmAdminAction(`Reabrir actividad de redes para ${displayName}?`);
    if (!confirmed) {
      return;
    }
    recordAdminAuditAction({ action: "redes-activity-unlock", target: `${usernameKey}:${fileName}:${activityId}`, detail: displayName });
  }

  async function unlockRedesQuizProgress(usernameKey, fileName, quizKey, displayName) {
    const confirmed = await confirmAdminAction(`Reabrir quiz de redes para ${displayName}?`);
    if (!confirmed) {
      return;
    }
    recordAdminAuditAction({ action: "redes-quiz-unlock", target: `${usernameKey}:${fileName}:${quizKey}`, detail: displayName });
  }

  async function unlockRedesStudent(usernameKey, ficha, displayName) {
    await unlockRedesGuideProgress(usernameKey, `redes:${ficha}`, displayName);
  }
  window.unlockRedesStudent = unlockRedesStudent;

  function buildRedesSocializationPayload(summary) {
    return window.adminRedes.buildSocializationPayload({ summary }, { renderAnswerTable, formatDate, escapeHtml });
  }

  function buildRedesActivityStatePayload(activity, state, snapshot) {
    window.adminRedes.getActivityStateRows(activity, state);
    return window.adminRedes.buildActivityStatePayload({ activity, state, snapshot }, { renderAnswerTable, formatDate, escapeHtml });
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

  function buildOptionalDeadlineConfigPanel() {
    if (!window.adminDeadlines || typeof window.adminDeadlines.buildConfigPanel !== "function") {
      return "";
    }

    return window.adminDeadlines.buildConfigPanel(state.users, {
      auth,
      deadlineManager,
      escapeHtml,
    });
  }

  function renderDeadlines() {
    renderDeadlineSelectors();
    const optionalConfigPanel = buildOptionalDeadlineConfigPanel();
    const selectedFicha = String(byId("deadline-ficha")?.value || "").trim();
    const selectedGuide = String(byId("deadline-guide")?.value || "").trim();
    const fichaEntries = getFichaEntries().filter(([ficha]) =>
      !selectedFicha || String(ficha).trim() === selectedFicha
    );
    const rows = fichaEntries.flatMap(([ficha, info]) =>
      (info.guias || [])
        .filter((fileName) => !selectedGuide || fileName === selectedGuide)
        .flatMap((fileName) =>
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
      ${optionalConfigPanel}
    `;
  }

  function getGuideStateKey(fileName) {
    const configured = window.ActivityStandard?.getStateKeyForGuide?.(fileName) ||
      auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey ||
      "";
    if (configured) return configured;
    const aliases = {
      "grupo-10a-guia-01-induccion.html": "guia_induccion_10a_guia_html",
      "grupo-10b-guia-01-induccion.html": "guia_induccion_10b_guia_html",
      "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
      "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
    };
    if (aliases[fileName] && /^guia_/.test(aliases[fileName])) return aliases[fileName];
    const storageFile = aliases[fileName] || fileName;
    if (!storageFile) return "";
    return "guia_interactiva_" + storageFile.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  }

  function readStudentGuideState(usernameKey, fileName) {
    const stateKey = getGuideStateKey(fileName);
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return null;
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    return readGuideDataState(storageKey);
  }

  function readStudentGuideMeta(usernameKey, fileName) {
    const stateKey = getGuideStateKey(fileName);
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return {};
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    return readGuideDataMeta(storageKey);
  }

  function getGuide6ResponseConfig(fileName) {
    return GUIDE6_RESPONSE_CONFIGS[String(fileName || "").toLowerCase()] || null;
  }

  function getStudentCloudScope(usernameKey) {
    return usernameKey ? `student:${usernameKey}` : "";
  }

  async function readGuide6CloudSnapshot(usernameKey, config) {
    const db = window._firebaseDb;
    if (!usernameKey || !config || !db || typeof db.cloudGetGuideData !== "function") return null;
    try {
      return await db.cloudGetGuideData(getStudentCloudScope(usernameKey), config.cloudFileName);
    } catch (error) {
      console.warn("[admin] No fue posible leer Guia 6 desde Firebase:", error);
      return null;
    }
  }

  function readGuide6LocalSnapshot(usernameKey, config) {
    if (!usernameKey || !config) return null;
    const fileName = config.pageFile || config.fileName || "";
    const stateKey = config.stateKey || getGuideStateKey(fileName);
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return null;
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    const state = readGuideDataState(storageKey);
    const meta = readGuideDataMeta(storageKey);
    if (!state || typeof state !== "object") return null;
    return {
      state,
      updatedAt: meta?.updatedAt || state.updatedAt || "",
      updatedBy: meta?.updatedBy || state.updatedBy || "local",
    };
  }

  function snapshotUpdatedTime(snapshot) {
    const value = snapshot?.updatedAt || snapshot?.state?.updatedAt || "";
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeGuide6Snapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return null;
    const snapshotState = snapshot.state && typeof snapshot.state === "object" ? snapshot.state : snapshot;
    return {
      state: snapshotState,
      updatedAt: snapshot.updatedAt || snapshotState.updatedAt || "",
      updatedBy: snapshot.updatedBy || snapshotState.updatedBy || "",
    };
  }

  function pickLatestSnapshot(cloudSnapshot, localSnapshot) {
    const cloud = normalizeGuide6Snapshot(cloudSnapshot);
    const local = normalizeGuide6Snapshot(localSnapshot);
    if (!cloud) return local;
    if (!local) return cloud;
    return snapshotUpdatedTime(cloud) >= snapshotUpdatedTime(local) ? cloud : local;
  }

  async function loadGuide6Responses(usernameKey, config) {
    const cloudSnapshot = await readGuide6CloudSnapshot(usernameKey, config);
    const localSnapshot = readGuide6LocalSnapshot(usernameKey, config);
    return pickLatestSnapshot(cloudSnapshot, localSnapshot);
  }

  // Resuelve cloudFileName + stateKey para CUALQUIER guia (no solo Guia 6). Lo
  // usan el unlock del admin (escribir el MISMO doc que lee el aprendiz) y la
  // vista de respuestas (leer ese doc desde la nube). Antes solo existia config
  // para Guia 6: por eso el unlock de otras guias no escribia nada a la nube y la
  // vista de respuestas solo miraba el localStorage del admin (vacio cuando el
  // aprendiz guardo en otro equipo).
  function getGuideCloudConfig(fileName) {
    const g6 = getGuide6ResponseConfig(fileName);
    if (g6) return g6;
    if (!fileName) return null;
    const stateKey = getGuideStateKey(fileName);
    if (!stateKey) return null;
    const cloudFileName =
      window.adminHabilitacion && typeof window.adminHabilitacion.getCloudFileName === "function"
        ? window.adminHabilitacion.getCloudFileName(fileName)
        : fileName;
    return { cloudFileName, stateKey, pageFile: fileName };
  }

  // ── Hidratacion del guide_state de los aprendices al localStorage del admin ──
  // La tabla "Respuestas" y el modulo "Entregas" leen con readStudentGuideState
  // (localStorage del admin), vacio cuando el aprendiz guardo en otro equipo. Para
  // mostrar datos cross-device SIN disparar N×M lecturas por render, bajamos el
  // guide_state de cada aprendiz UNA vez por sesion (al abrir esos modulos) y lo
  // cacheamos en localStorage. Reusa el mismo doc que lee "ver respuestas".
  let guideStatesHydrated = false;

  async function runWithConcurrency(items, limit, worker) {
    const queue = items.slice();
    const runners = [];
    for (let i = 0; i < Math.max(1, limit); i++) {
      runners.push((async () => {
        while (queue.length) {
          await worker(queue.shift());
        }
      })());
    }
    await Promise.all(runners);
  }

  async function ensureGuideStatesHydrated() {
    if (guideStatesHydrated) return false;
    // Recupera la cuota de localStorage que sesiones anteriores llenaron con el
    // guide-data de aprendices (ahora se cachea en memoria, ver helpers arriba).
    purgeStudentGuideDataFromLocal();
    const db = window._firebaseDb;
    if (!db || typeof db.cloudGetGuideData !== "function" || typeof auth.getStudentStorageKey !== "function") {
      guideStatesHydrated = true; // sin nube no hay nada que bajar; no reintentar cada render
      return false;
    }
    // Si el admin entra a Respuestas/Entregas ANTES de que loadUsers() termine
    // (carrera con la carga inicial), state.users aun esta vacio: NO hay nada
    // que hidratar todavia. Sin este check, la corrida vacia igual marcaba
    // guideStatesHydrated=true para siempre y ya NUNCA se reintentaba en la
    // sesion, aunque los aprendices se cargaran un instante despues.
    if (!(state.users || []).length) return false;
    const tasks = [];
    (state.users || []).forEach((user) => {
      if (!user || !user.usernameKey) return;
      getGuidesForFicha(user.ficha).forEach((fileName) => {
        const config = getGuideCloudConfig(fileName);
        const stateKey = getGuideStateKey(fileName);
        if (!config || !config.cloudFileName || !stateKey) return;
        tasks.push({ usernameKey: user.usernameKey, fileName, cloudFileName: config.cloudFileName, stateKey });
      });
    });
    let changed = false;
    await runWithConcurrency(tasks, 6, async (task) => {
      if (!task) return;
      try {
        const cloudSnapshot = await db.cloudGetGuideData(getStudentCloudScope(task.usernameKey), task.cloudFileName);
        if (!cloudSnapshot) return;
        const storageKey = auth.getStudentStorageKey(task.usernameKey, task.stateKey, { area: "guide-data" });
        const localState = readGuideDataState(storageKey);
        const localMeta = readGuideDataMeta(storageKey);
        // pickLatestSnapshot prefiere la nube solo si es >= que lo local (por updatedAt),
        // asi no pisa una edicion local mas nueva del admin (p.ej. reabrir entrega).
        const latest = pickLatestSnapshot(
          cloudSnapshot,
          localState ? { state: localState, updatedAt: localMeta?.updatedAt || "" } : null
        );
        if (!latest || !latest.state || typeof latest.state !== "object") return;
        // Cache EN MEMORIA (no localStorage): evita llenar la cuota del navegador.
        guideDataCacheSet(storageKey, latest.state, latest.updatedAt
          ? { updatedAt: latest.updatedAt, updatedBy: latest.updatedBy || "cloud" }
          : {});
        changed = true;
      } catch (_) { /* una guia que falle no debe romper la hidratacion del resto */ }
    });
    guideStatesHydrated = true;
    return changed;
  }

  async function patchGuideCloudState(usernameKey, fileName, patch) {
    const db = window._firebaseDb;
    const config = getGuideCloudConfig(fileName);
    if (!usernameKey || !config || !db || typeof db.cloudGetGuideData !== "function" || typeof db.cloudSaveGuideData !== "function") {
      return false;
    }
    const scopeKey = getStudentCloudScope(usernameKey);
    const current = await db.cloudGetGuideData(scopeKey, config.cloudFileName).catch(() => null);
    const currentState = current?.state && typeof current.state === "object" ? current.state : {};
    const updatedAt = new Date().toISOString();
    return db.cloudSaveGuideData(scopeKey, config.cloudFileName, {
      ...(current && typeof current === "object" ? current : {}),
      state: { ...currentState, ...(patch?.state || {}) },
      updatedAt,
      updatedBy: patch?.updatedBy || "admin-activity-unlock",
    });
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

  function getResponseActivities(fileName) {
    const activities = deadlineManager?.getActivitiesForGuide?.(fileName) || window.ActivityStandard?.getActivitiesForGuide?.(fileName) || [];
    const declared = activities.map((activity) => ({
      id: activity.id,
      label: activity.label || activity.id,
      keys: Array.isArray(activity.keys) ? activity.keys : [],
    }));
    // Fallback: si hay state-keys -delivery o -locked en localStorage de cualquier
    // aprendiz para esta guia que no correspondan a actividades declaradas,
    // surfacearlas como "Actividad <id>" para que el admin no pierda visibilidad.
    const known = new Set(declared.map((item) => item.id));
    const extra = new Map();
    (state.users || []).forEach((user) => {
      if (!user || !user.usernameKey) return;
      const record = readStudentGuideState(user.usernameKey, fileName);
      if (!record || typeof record !== "object") return;
      Object.keys(record).forEach((key) => {
        const match = String(key).match(/^(.+)-(?:delivery|locked)$/);
        if (!match) return;
        const id = match[1];
        if (!id || known.has(id) || extra.has(id)) return;
        extra.set(id, { id, label: "Actividad " + id + " (sin registrar)", keys: [] });
      });
    });
    return declared.concat(Array.from(extra.values()));
  }

  function getResponseActivity(fileName, activityId) {
    const unlockActivity = getUnlockActivitiesForGuide(fileName).find((activity) => activity.id === activityId);
    if (unlockActivity) {
      return unlockActivity;
    }
    return getResponseActivities(fileName).find((activity) => activity.id === activityId) || {
      id: activityId,
      label: activityId || "Actividad",
      keys: [],
    };
  }

  function responseValueText(value) {
    if (value == null || value === "") return "Sin respuesta";
    if (typeof value === "boolean") return value ? "Si" : "No";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "Sin respuesta";
    if (typeof value === "object") return Object.keys(value).length ? JSON.stringify(value, null, 2) : "Sin respuesta";
    const text = String(value).trim();
    return text || "Sin respuesta";
  }

  function humanizeResponseKey(key) {
    return String(key || "")
      .replace(/[-_:]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function isAnswerKey(key) {
    return !/(^_|-locked$|-delivery$|historial|updatedAt|updatedBy|fechaReapertura|reabiertaPor|observacionReapertura)/i.test(String(key || ""));
  }

  function keyMatchesActivity(key, activityId) {
    const text = String(key || "").toLowerCase();
    const activity = String(activityId || "").toLowerCase();
    if (!activity || !isAnswerKey(text)) return false;
    if (text === activity || text.startsWith(activity + "-") || text.startsWith(activity + "_") || text.startsWith(activity + ":")) return true;
    const aliases = {
      bitacora311: ["reflexion_"],
      socializacion312: ["socializacion_"],
      extensiones331: ["extension:", "extensions-"],
      sistemas332: ["system:", "systems-"],
      colaborativas334: ["collab:"],
      transferReto341: ["transfer-reto-"],
      reflexion311: ["reflexion_", "red-reflexion", "reflexion-redes"],
      ip1: ["ip1-", "ip1_"],
      ip3: ["ip3-", "ip3_"],
      "taller-ip-ej1": ["ej1-"],
      "taller-ip-ej2": ["ej2-"],
      "taller-ip-ej3": ["ej3-"],
      "taller-ip-ej4": ["ej4-"],
      "taller-ip-ej5": ["ej5-"],
      lab1: ["lab1-"],
      lab2: ["lab2-"],
      lab3: ["lab3-"],
      "guia5-311": ["bitacora-"],
      "guia5-331": ["evidencia-", "herramienta-"],
      "guia5-341": ["informe-", "transferencia-"],
      arbol312: ["arbol:"],
      programa332: ["curriculo:"],
      plataformas334: ["plataforma:"],
      portafolio342: ["portafolio:"],
    };
    return (aliases[activityId] || []).some((prefix) => text.startsWith(prefix.toLowerCase()));
  }

  function getActivityQuestionSpecs(fileName, activityId, guideState) {
    const stdConfig = window.ActivityStandard?.getConfigForGuide?.(fileName);
    const stdActivity = stdConfig?.activities?.find?.((activity) => activity.id === activityId);
    const sectionSpecs = stdActivity?.wordExport?.sections?.map((section) => ({
      key: section.storeKey,
      label: section.label || humanizeResponseKey(section.storeKey),
    })) || [];
    const fieldSpecs = (stdActivity?.formFields || []).map((key) => ({
      key,
      label: humanizeResponseKey(key),
    }));
    const known = [...sectionSpecs, ...fieldSpecs].filter((item) => item.key);
    const knownKeys = new Set(known.map((item) => item.key));
    const dynamicKeys = Object.keys(guideState || {})
      .filter((key) => !knownKeys.has(key) && keyMatchesActivity(key, activityId))
      .map((key) => ({ key, label: humanizeResponseKey(key) }));
    if (known.length || dynamicKeys.length) return [...known, ...dynamicKeys];

    return [];
  }

  function getActivityDates(guideState, guideMeta, activityId) {
    const delivery = guideState?.[`${activityId}-delivery`];
    const submittedAt = delivery?.submittedAt || delivery?.updatedAt || "";
    const first =
      guideState?.fechaElaboracion ||
      guideState?.fechaPrimerGuardado ||
      guideState?.[`${activityId}-fechaPrimerGuardado`] ||
      submittedAt ||
      guideMeta?.createdAt ||
      guideMeta?.updatedAt ||
      "";
    const last =
      guideState?.fechaUltimaActualizacion ||
      guideState?.[`${activityId}-fechaUltimaActualizacion`] ||
      guideMeta?.updatedAt ||
      submittedAt ||
      "";
    return { first, last, submittedAt };
  }

  function collectActivityResponses(user, fileName, activityId) {
    return collectActivityResponsesFromState(user, fileName, activityId, readStudentGuideState(user.usernameKey, fileName) || {}, readStudentGuideMeta(user.usernameKey, fileName));
  }

  function collectActivityResponsesFromState(user, fileName, activityId, guideState, guideMeta) {
    guideState = guideState && typeof guideState === "object" ? guideState : {};
    guideMeta = guideMeta && typeof guideMeta === "object" ? guideMeta : {};
    const activity = getResponseActivity(fileName, activityId);
    const questions = getActivityQuestionSpecs(fileName, activityId, guideState).map((spec) => {
      const raw = guideState[spec.key];
      const answer = responseValueText(raw);
      return {
        key: spec.key,
        question: spec.label || humanizeResponseKey(spec.key),
        answer,
        answered: answer !== "Sin respuesta",
      };
    });
    const answeredCount = questions.filter((item) => item.answered).length;
    const delivery = guideState[`${activityId}-delivery`] || null;
    const reopened = delivery?.estado === "reabierta" || delivery?.status === "reabierta";
    const delivered = Boolean(delivery?.submittedAt || delivery?.driveUrl || delivery?.status === "delivered");
    const locked = Boolean(guideState[`${activityId}-locked`]);
    const status = reopened
      ? "reabierta"
      : delivered
        ? "entregada"
        : questions.length && answeredCount === questions.length
          ? "completa"
          : answeredCount > 0 || locked
            ? "parcial"
            : "sin-respuesta";
    const dates = getActivityDates(guideState, guideMeta, activityId);
    return {
      user,
      fileName,
      guideTitle: auth.getGuideTitle(fileName),
      activityId,
      activityLabel: activity.label,
      guideState,
      guideMeta,
      questions,
      answeredCount,
      totalQuestions: questions.length,
      status,
      delivery,
      fechaPrimerGuardado: dates.first,
      fechaUltimaActualizacion: dates.last,
      fechaEntrega: dates.submittedAt,
    };
  }

  function buildResponsesView(summary) {
    const rows = summary.questions.map((item) => `
      <tr>
        <td>${escapeHtml(item.question)}</td>
        <td><div class="answer-value">${escapeHtml(item.answer)}</div></td>
      </tr>
    `).join("");
    return `
      <table class="admin-data-table">
        <tbody>
          <tr><th>Programa</th><td>Sistemas Teleinformaticos</td></tr>
          <tr><th>Institucion</th><td>${escapeHtml(summary.user.inst || summary.user.institucion || "")}</td></tr>
          <tr><th>Ficha / grupo</th><td>${escapeHtml(summary.user.ficha)} / ${escapeHtml(summary.user.grupo || "")}</td></tr>
          <tr><th>Aprendiz</th><td>${escapeHtml(summary.user.fullName)}</td></tr>
          <tr><th>Guia</th><td>${escapeHtml(summary.guideTitle)}</td></tr>
          <tr><th>Actividad</th><td>${escapeHtml(summary.activityLabel)}</td></tr>
          <tr><th>Fecha de elaboracion</th><td>${escapeHtml(formatDate(summary.fechaPrimerGuardado))}</td></tr>
          <tr><th>Ultima actualizacion</th><td>${escapeHtml(formatDate(summary.fechaUltimaActualizacion))}</td></tr>
          <tr><th>Fecha de entrega</th><td>${escapeHtml(formatDate(summary.fechaEntrega))}</td></tr>
          <tr><th>Estado</th><td>${escapeHtml(summary.status)}</td></tr>
        </tbody>
      </table>
      <h3>Preguntas y respuestas</h3>
      <table class="admin-data-table">
        <thead><tr><th>Pregunta / campo</th><th>Respuesta</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="2">Sin respuesta</td></tr>'}</tbody>
      </table>
    `;
  }

  function buildExportableActivityDocument(summary) {
    const bodyHtml = buildResponsesView(summary);
    return {
      title: "Soporte de respuestas por actividad",
      subtitle: `${summary.user.fullName} | ${summary.activityLabel}`,
      meta: [
        `Aprendiz: ${summary.user.fullName}`,
        `Ficha: ${summary.user.ficha}`,
        `Grupo: ${summary.user.grupo || ""}`,
        `Institucion: ${summary.user.inst || summary.user.institucion || ""}`,
        `Guia: ${summary.guideTitle}`,
        `Actividad: ${summary.activityLabel}`,
        `Fecha de elaboracion: ${formatDate(summary.fechaPrimerGuardado)}`,
        `Guardado: ${formatDate(summary.fechaUltimaActualizacion)}`,
        `Fecha de entrega: ${formatDate(summary.fechaEntrega)}`,
        `Estado: ${summary.status}`,
      ].join(" | "),
      bodyHtml,
    };
  }

  function renderResponses() {
    const ficha = state.filters.responsesFicha || "";
    const guide = state.filters.responsesGuide || "";
    const learner = state.filters.responsesLearner || "";
    const activity = state.filters.responsesActivity || "";
    const statusFilter = state.filters.responsesStatus || "";
    byId("responses-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    byId("responses-guide-filter").innerHTML = getGuideOptionsForFicha(ficha, guide, true);
    const learnersForFilter = state.users.filter((user) => !ficha || String(user.ficha) === ficha);
    byId("responses-learner-filter").innerHTML =
      '<option value="">Todos los aprendices</option>' +
      learnersForFilter.map((user) =>
        `<option value="${escapeHtml(user.usernameKey)}"${learner === user.usernameKey ? " selected" : ""}>${escapeHtml(user.fullName)}</option>`
      ).join("");
    const activitiesForFilter = guide ? getResponseActivities(guide) : [];
    byId("responses-activity-filter").innerHTML =
      '<option value="">Todas las actividades</option>' +
      activitiesForFilter.map((item) =>
        `<option value="${escapeHtml(item.id)}"${activity === item.id ? " selected" : ""}>${escapeHtml(item.label)}</option>`
      ).join("");
    byId("responses-status-filter").value = statusFilter;
    const text = normalizeText(state.filters.responsesText);
    const users = state.users.filter((user) =>
      (!ficha || String(user.ficha) === ficha) &&
      (!learner || user.usernameKey === learner) &&
      (!text || normalizeText(`${user.fullName} ${user.username}`).includes(text))
    );
    const rows = users.flatMap((user) => {
      const guides = guide ? [guide] : getGuidesForFicha(user.ficha);
      return guides.flatMap((fileName) => {
        const activities = activity ? [getResponseActivity(fileName, activity)] : getResponseActivities(fileName);
        return activities.map((activityItem) => {
          const summary = collectActivityResponses(user, fileName, activityItem.id);
          if (statusFilter && summary.status !== statusFilter) return "";
          const hasAnswers = summary.answeredCount > 0 || stateHasAnswers(summary.delivery);
          const statusClass = summary.status === "sin-respuesta"
            ? "admin-status--warn"
            : summary.status === "entregada" || summary.status === "completa"
              ? "admin-status--safe"
              : "admin-status--warn";
        return `
          <tr>
            <td>${escapeHtml(user.fullName)}<br><span class="admin-muted">${escapeHtml(user.usernameKey)}</span></td>
            <td>${escapeHtml(user.ficha)}</td>
            <td>${escapeHtml(auth.getGuideTitle(fileName))}</td>
            <td>${escapeHtml(summary.activityLabel)}</td>
            <td><span class="admin-status ${statusClass}">${escapeHtml(hasAnswers ? summary.status : "sin-respuesta")}</span></td>
            <td>${escapeHtml(formatDate(summary.fechaPrimerGuardado))}</td>
            <td>${escapeHtml(formatDate(summary.fechaUltimaActualizacion))}</td>
            <td>${escapeHtml(formatDate(summary.fechaEntrega))}</td>
            <td class="admin-row-actions">
              <button class="admin-button admin-button--ghost" type="button" data-view-activity-response="${escapeHtml(user.usernameKey)}" data-guide-file="${escapeHtml(fileName)}" data-activity-id="${escapeHtml(activityItem.id)}">Ver</button>
              <button class="admin-button admin-button--ghost" type="button" data-export-activity-response="${escapeHtml(user.usernameKey)}" data-guide-file="${escapeHtml(fileName)}" data-activity-id="${escapeHtml(activityItem.id)}">Exportar soporte</button>
            </td>
          </tr>
        `;
        });
      });
    }).filter(Boolean).join("");
    byId("responses-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Estado</th><th>Elaboracion</th><th>Actualizacion</th><th>Entrega</th><th>Acciones</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9">No hay respuestas visibles con los filtros actuales.</td></tr>'}</tbody>
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
            stateKey: getGuideStateKey(fileName),
            deliveryKey: key,
            submittedAt: value.submittedAt || value.updatedAt || "",
            savedFileName: value.savedFileName || "",
            driveUrl: value.driveUrl || "",
            status: value.status || "delivered",
            estado: value.estado || value.status || "delivered",
          });
        });
      });
    });
    return rows;
  }

  function buildConsolidatedReportRows() {
    const deliveries = collectDeliveries();
    return state.users.flatMap((user) => {
      const progress = progressForUser(user);
      const guides = getGuidesForFicha(user.ficha);
      return guides.map((fileName) => {
        const guideProgress = (progress.guides || []).find((item) => item.fileName === fileName) || {};
        const guideDeliveries = deliveries.filter((item) =>
          item.user.usernameKey === user.usernameKey && item.fileName === fileName
        );
        return {
          aprendiz: user.fullName || "",
          usuario: user.username || user.usernameKey || "",
          ficha: user.ficha || "",
          grupo: user.grupo || "",
          institucion: user.inst || user.institucion || "",
          guia: auth.getGuideTitle(fileName),
          archivoGuia: fileName,
          progreso: Number(guideProgress.percent || 0),
          completadas: Number(guideProgress.completed || 0),
          totalActividades: Number(guideProgress.total || 0),
          entregas: guideDeliveries.length,
          ultimaEntrega: guideDeliveries
            .map((item) => item.submittedAt)
            .filter(Boolean)
            .sort()
            .pop() || "",
          estadoAprendiz: isInactive(user) ? "Inactivo" : "Activo",
        };
      });
    });
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildConsolidatedReportCsv(rows) {
    const headers = [
      "aprendiz",
      "usuario",
      "ficha",
      "grupo",
      "institucion",
      "guia",
      "archivoGuia",
      "progreso",
      "completadas",
      "totalActividades",
      "entregas",
      "ultimaEntrega",
      "estadoAprendiz",
    ];
    return [headers.join(";")]
      .concat(rows.map((row) => headers.map((key) => csvCell(row[key])).join(";")))
      .join("\r\n");
  }

  function downloadTextFile(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadConsolidatedReport(format) {
    const rows = buildConsolidatedReportRows();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      downloadTextFile(
        `reporte_consolidado_${stamp}.json`,
        JSON.stringify({ generado: new Date().toISOString(), filas: rows }, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }
    downloadTextFile(
      `reporte_consolidado_${stamp}.csv`,
      buildConsolidatedReportCsv(rows),
      "text/csv;charset=utf-8"
    );
  }

  function appendUniqueDeliveryHistory(history, delivery) {
    const entries = Array.isArray(history) ? history.slice() : [];
    if (!delivery || typeof delivery !== "object") return entries;
    const fingerprint = [
      delivery.submittedAt || "",
      delivery.savedFileName || "",
      delivery.driveUrl || "",
    ].join("|");
    if (!fingerprint.replace(/\|/g, "")) return entries;
    const exists = entries.some((item) => [
      item?.submittedAt || "",
      item?.savedFileName || "",
      item?.driveUrl || "",
    ].join("|") === fingerprint);
    return exists ? entries : entries.concat([delivery]);
  }

  function getAdminActorLabel() {
    const session = auth.getCurrentSession?.();
    return session?.user?.fullName || session?.usernameKey || session?.role || "admin";
  }

  function buildReopenedDeliveryRecord(previous, context) {
    const now = context.now || new Date().toISOString();
    const motivo = String(context.motivo || "").trim();
    const previousRecord = previous && typeof previous === "object" ? previous : {};
    const previousStatus = previousRecord.estado || previousRecord.status || "entregada";
    const historyBase = appendUniqueDeliveryHistory(previousRecord.historialEntregas, previousRecord);
    return {
      ...previousRecord,
      status: "reabierta",
      estado: "reabierta",
      habilitada: true,
      permiteEdicion: true,
      permiteEntrega: true,
      reabierta: true,
      fechaReapertura: now,
      reabiertaPor: context.admin || "admin",
      observacionReapertura: motivo,
      fechaEntregaOriginal: previousRecord.fechaEntregaOriginal || previousRecord.submittedAt || "",
      historialEntregas: historyBase,
      historialReaperturas: (Array.isArray(previousRecord.historialReaperturas) ? previousRecord.historialReaperturas : []).concat([{
        fecha: now,
        admin: context.admin || "admin",
        motivo,
        estadoAnterior: previousStatus,
        estadoNuevo: "reabierta",
      }]),
    };
  }

  async function syncReopenedActivityToCloud(usernameKey, fileName, stateKey, activityId, deliveryRecord, updatedAt, adminLabel) {
    // Antes escribia con scope `usernameKey` (sin prefijo) y el pageFile crudo, por
    // lo que el aprendiz —que lee con scope `student:{usernameKey}` y el cloudFileName—
    // nunca veia la reapertura. Ahora se enruta por patchGuideCloudState, que usa el
    // scope y cloudFileName correctos y mezcla con el estado actual (no pierde respuestas).
    return patchGuideCloudState(usernameKey, fileName, {
      state: {
        [`${activityId}-locked`]: false,
        [`${activityId}-delivery`]: deliveryRecord,
        reabierta: true,
        permiteEdicion: true,
        permiteEntrega: true,
      },
      updatedBy: `admin-reopen:${adminLabel || "admin"}`,
    });
  }

  async function reopenDeliveredActivity(button) {
    if (!hasAdminPanelAccess()) {
      setFeedback("Solo el administrador o instructor puede reabrir actividades.", "error");
      return;
    }
    const usernameKey = button.dataset.reopenDelivery;
    const fileName = button.dataset.guideFile;
    const activityId = button.dataset.activityId;
    const user = getUser(usernameKey);
    const stateKey = getGuideStateKey(fileName);
    if (!usernameKey || !fileName || !activityId || !stateKey) {
      setFeedback("No fue posible identificar la actividad a reabrir.", "error");
      return;
    }

    const confirmed = await confirmAdminAction(
      "Desea reabrir esta actividad para el aprendiz? Las respuestas y entregas anteriores se conservaran. El aprendiz podra continuar o volver a entregar la actividad."
    );
    if (!confirmed) {
      return;
    }

    const motivo = window.prompt?.("Observacion de reapertura (opcional):", "") || "";
    let newDueAt = "";
    if (deadlineManager && typeof deadlineManager.savePolicy === "function") {
      newDueAt = window.prompt?.("Nueva fecha limite opcional (YYYY-MM-DDTHH:mm). Deja vacio para conservar la logica actual:", "") || "";
    }

    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    const guideState = readGuideDataState(storageKey) || {};
    const deliveryKey = `${activityId}-delivery`;
    const lockKey = `${activityId}-locked`;
    const now = new Date().toISOString();
    const adminLabel = getAdminActorLabel();
    const deliveryRecord = buildReopenedDeliveryRecord(guideState[deliveryKey], {
      now,
      admin: adminLabel,
      motivo,
    });

    guideState[lockKey] = false;
    guideState[deliveryKey] = deliveryRecord;
    writeGuideDataLocal(storageKey, guideState, {
      updatedAt: now,
      updatedBy: `admin-reopen:${adminLabel}`,
      reabierta: true,
      activityId,
    });

    if (newDueAt.trim()) {
      await deadlineManager.savePolicy(fileName, activityId, newDueAt.trim(), adminLabel);
    }

    await syncReopenedActivityToCloud(usernameKey, fileName, stateKey, activityId, deliveryRecord, now, adminLabel).catch(() => false);
    recordAudit({
      action: "activity-reopen",
      target: `${usernameKey}:${fileName}:${activityId}`,
      detail: motivo || "Actividad reabierta",
    });
    setFeedback(`Actividad reabierta para ${user?.fullName || usernameKey}.`, "success");
    renderAll();
  }

  function renderDeliveries() {
    const ficha = state.filters.deliveriesFicha || "";
    const text = normalizeText(state.filters.deliveriesText);
    const fromIso = state.filters.deliveriesFrom || "";
    const toIso = state.filters.deliveriesTo || "";
    const fromMs = fromIso ? Date.parse(fromIso + "T00:00:00-05:00") : null; // inicio del dia en Bogota
    const toMs = toIso ? Date.parse(toIso + "T23:59:59-05:00") : null;       // fin del dia en Bogota
    byId("deliveries-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    const deliveries = collectDeliveries().filter((item) => {
      if (ficha && String(item.user.ficha) !== ficha) return false;
      if (text && !normalizeText(`${item.user.fullName} ${item.savedFileName} ${item.activityId}`).includes(text)) return false;
      const submittedMs = item.submittedAt ? Date.parse(item.submittedAt) : null;
      if (fromMs != null) {
        if (submittedMs == null || isNaN(submittedMs) || submittedMs < fromMs) return false;
      }
      if (toMs != null) {
        if (submittedMs == null || isNaN(submittedMs) || submittedMs > toMs) return false;
      }
      return true;
    });
    state.filteredDeliveries = deliveries;
    const rows = deliveries.map((item) => {
      const policy = deadlineManager?.getPolicy?.(item.fileName, item.activityId);
      const late = policy?.dueAt && new Date(item.submittedAt).getTime() > new Date(policy.dueAt).getTime();
      const reopened = normalizeText(item.estado) === "reabierta" || normalizeText(item.status) === "reabierta";
      const statusText = reopened ? "Reabierta" : late ? "Tardia" : "Entregada";
      const statusClass = reopened ? "admin-status--warn" : late ? "admin-status--danger" : "admin-status--safe";
      return `
        <tr>
          <td>${escapeHtml(item.savedFileName || "Sin nombre")}</td>
          <td>${escapeHtml(item.user.fullName)}</td>
          <td>${escapeHtml(item.user.ficha)}</td>
          <td>${escapeHtml(auth.getGuideTitle(item.fileName))}</td>
          <td>${escapeHtml(item.activityId)}</td>
          <td>${escapeHtml(formatDate(item.submittedAt))}</td>
          <td><span class="admin-status ${statusClass}">${escapeHtml(statusText)}</span></td>
          <td class="admin-row-actions">
            ${item.driveUrl ? `<a class="admin-button admin-button--ghost" href="${escapeHtml(item.driveUrl)}" target="_blank" rel="noopener noreferrer">Ver</a>` : '<span class="admin-muted">Sin enlace</span>'}
            <button
              class="admin-button admin-button--ghost"
              type="button"
              data-reopen-delivery="${escapeHtml(item.user.usernameKey)}"
              data-guide-file="${escapeHtml(item.fileName)}"
              data-activity-id="${escapeHtml(item.activityId)}"
            >Reabrir actividad</button>
          </td>
        </tr>
      `;
    }).join("");
    byId("deliveries-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Archivo</th><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">No hay entregas registradas en los datos locales actuales.</td></tr>'}</tbody>
      </table>
    `;
  }

  // Convierte el array de entregas filtradas a CSV y descarga.
  function csvEscape(value) {
    const text = String(value == null ? "" : value);
    if (/[",\n;]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function exportDeliveriesCsv() {
    const rows = Array.isArray(state.filteredDeliveries) ? state.filteredDeliveries : collectDeliveries();
    if (!rows.length) {
      setFeedback("No hay entregas para exportar con los filtros actuales.", "info");
      return;
    }
    const header = [
      "Archivo", "Aprendiz", "Usuario", "Ficha", "Institucion", "Grupo",
      "Guia (archivo)", "Guia (titulo)", "Actividad", "Estado",
      "Fecha entrega (ISO)", "Fecha entrega (Bogota)", "URL Drive",
    ];
    const lines = [header.map(csvEscape).join(",")];
    rows.forEach((item) => {
      const submittedISO = item.submittedAt || "";
      let submittedLocal = "";
      const ms = submittedISO ? Date.parse(submittedISO) : NaN;
      if (Number.isFinite(ms)) {
        submittedLocal = new Date(ms).toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        });
      }
      lines.push([
        item.savedFileName || "",
        item.user.fullName || "",
        item.user.username || item.user.usernameKey || "",
        item.user.ficha || "",
        item.user.inst || "",
        item.user.grupo || "",
        item.fileName || "",
        auth.getGuideTitle ? auth.getGuideTitle(item.fileName) : "",
        item.activityId || "",
        item.estado || item.status || "",
        submittedISO,
        submittedLocal,
        item.driveUrl || "",
      ].map(csvEscape).join(","));
    });
    // BOM UTF-8 para que Excel reconozca acentos
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `entregas_sena_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    recordAudit({
      action: "deliveries-export-csv",
      target: "entregas",
      detail: `${rows.length} filas exportadas`,
    });
    setFeedback(`CSV exportado con ${rows.length} entregas.`, "success");
  }

  function renderReports() {
    const stats = getDashboardStats();
    const consolidatedRows = buildConsolidatedReportRows();
    const reports = [
      ["Progreso por ficha", "Disponible", "Calculado desde progreso local/meta."],
      ["Progreso por aprendiz", "Disponible", "Incluye porcentaje general por usuario."],
      ["Actividades entregadas", "Parcial", "Depende de registros -delivery en guias estandar."],
      ["Actividades pendientes", "Parcial", "Estimacion con catalogo actual."],
      ["Actividades vencidas", "Disponible", "Basado en fechas configuradas."],
      ["Respuestas guardadas", "Parcial", "Depende de stateKey por guia."],
      ["Entregas realizadas", "Parcial", "Depende de Drive/localStorage."],
      ["Consolidado por guia", "Disponible", `${consolidatedRows.length} filas listas para descargar en CSV o JSON.`],
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
          <tr><th>Filas consolidado</th><td>${consolidatedRows.length}</td></tr>
        </tbody>
      </table>
      <p class="admin-risk-note">Contrato local activo: el consolidado cruza aprendices, fichas, guias, progreso y entregas detectadas sin modificar datos.</p>
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
      <p class="admin-risk-note">Firebase Auth listo para activar: el panel ya separa roles admin/instructor/aprendiz y conserva las llamadas de mutacion en helpers administrativos.</p>
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
    renderGrades();
  }

  // Cache de sesion de la lista de aprendices (con avance). fetchStudentsWithProgress
  // lee MUCHO de Firestore (usuarios + progreso + guide-data de guias sin progreso).
  // Recargar el panel decenas de veces (p. ej. depurando) quemaba la cuota diaria
  // gratis. Con este cache, una RECARGA reutiliza la ultima lista (0 lecturas) durante
  // el TTL; cualquier MUTACION (editar, calificar, desactivar, reiniciar) lo invalida,
  // y "Actualizar datos" siempre baja fresco. Vive en sessionStorage (se limpia al
  // cerrar la pestana), no en localStorage (que ya cuidamos de no llenar).
  const USERS_CACHE_KEY = "sena_admin_users_progress_cache_v1";
  const USERS_CACHE_TTL_MS = 4 * 60 * 1000;

  function invalidateUsersCache() {
    try { sessionStorage.removeItem(USERS_CACHE_KEY); } catch (_) { /* sin sessionStorage */ }
  }

  async function loadUsers(options = {}) {
    if (!hasAdminPanelAccess()) {
      window.location.replace("index.html");
      return;
    }
    let fetched = null;
    // Solo se LEE el cache cuando se pide explicitamente (carga inicial / recarga).
    // Las mutaciones llaman loadUsers() sin opciones -> siempre bajan fresco.
    if (options.useCache) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(USERS_CACHE_KEY) || "null");
        if (cached && Array.isArray(cached.users) && (Date.now() - Number(cached.at)) < USERS_CACHE_TTL_MS) {
          fetched = cached.users;
        }
      } catch (_) { /* cache corrupto: se ignora y se baja fresco */ }
    }
    if (!fetched) {
      const loader = typeof auth.fetchStudentsWithProgress === "function"
        ? auth.fetchStudentsWithProgress()
        : Promise.resolve(auth.getStudentsWithProgress());
      fetched = await loader;
      try {
        sessionStorage.setItem(USERS_CACHE_KEY, JSON.stringify({ at: Date.now(), users: fetched }));
      } catch (_) { /* sessionStorage lleno: seguimos sin cachear */ }
    }
    state.users = fetched.map((user) => ({
      ...user,
      progress: progressForUser(user),
    }));
    renderAll();
    // NO se hidrata el guide_state de todos los aprendices aqui: eso disparaba
    // cientos de lecturas a Firestore en CADA carga del panel (leer el estado de
    // todas las guias de todos los aprendices) y acercaba la cuota diaria gratis
    // al limite. La hidratacion pesada ahora es BAJO DEMANDA: solo corre al abrir
    // Respuestas o Entregas (ver setActiveModule). El dashboard "Entregas recientes"
    // muestra lo que ya este en cache; tras visitar Entregas una vez, se completa.
    if (!state.users.length) {
      setFeedback(
        "No hay aprendices cargados en este navegador. Inicia sesion admin real, configura Firebase o crea/importa aprendices para ver respuestas, entregas y reportes completos.",
        "info"
      );
    }
  }

  // ── Backfill Firestore → Drive ──────────────────────────────────────────
  // Boton del panel Configuracion. Llama a window._firebaseDb.backfillToDrive()
  // y muestra el avance en #backfill-status.
  let backfillRunning = false;
  async function runBackfillToDrive() {
    if (backfillRunning) return;
    const btn = byId("btn-backfill-drive");
    const status = byId("backfill-status");
    const fb = window._firebaseDb;

    function show(message, color) {
      if (!status) return;
      status.style.display = "block";
      status.style.color = color || "var(--admin-text, #102117)";
      status.textContent = message;
    }

    if (!fb || typeof fb.backfillToDrive !== "function") {
      show("El modulo de respaldo no esta disponible. Recarga la pagina (Ctrl+Shift+R).", "#b91c1c");
      return;
    }

    backfillRunning = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Migrando...";
    }
    show("Iniciando migracion. Esto puede tardar varios minutos segun la cantidad de datos. No cierres esta pestana.", "#1f7a8c");

    try {
      const report = await fb.backfillToDrive({
        onProgress: (p) => {
          show(
            "Migrando " + p.collection + ": " + p.done + " de " + p.total + " (" + p.written + " copiados)...",
            "#1f7a8c"
          );
        },
      });

      if (report && report.ok) {
        const detail = Object.keys(report.collections || {})
          .map((c) => c + ": " + report.collections[c].written + "/" + report.collections[c].found)
          .join("  ·  ");
        show(
          "Migracion completada. " + report.totalWritten + " documentos copiados a Drive" +
          (report.errors ? " (" + report.errors + " errores)" : "") + ".  " + detail,
          report.errors ? "#b45309" : "#15803d"
        );
      } else {
        show("No se pudo completar la migracion: " + ((report && report.message) || "error desconocido") + ".", "#b91c1c");
      }
    } catch (error) {
      show("Error durante la migracion: " + ((error && error.message) || error) + ".", "#b91c1c");
    } finally {
      backfillRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Migrar datos a Drive";
      }
    }
  }

  function setActiveModule(moduleName, options = {}) {
    const tab = options.tab || "";
    if (!MODULE_TITLES[moduleName]) return;
    state.activeModule = moduleName;
    byId("admin-page-title").textContent = tab === "auditoria" ? "Auditoria local" : MODULE_TITLES[moduleName];
    document.querySelectorAll("[data-admin-module]").forEach((button) => {
      const buttonTab = button.dataset.tab || "";
      button.classList.toggle("is-active", button.dataset.adminModule === moduleName && buttonTab === tab);
    });
    // Menu "Mas": cerrarlo al elegir y resaltarlo si el modulo activo esta dentro.
    const moreEl = byId("admin-nav-more");
    if (moreEl) {
      moreEl.classList.toggle("is-active", !!moreEl.querySelector(`[data-admin-module="${moduleName}"]`));
      moreEl.open = false;
    }
    document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== moduleName;
      panel.classList.toggle("is-active", panel.dataset.adminPanel === moduleName);
    });
    // Render perezoso del panel de habilitacion (necesita el estado actual
    // de usuarios y se reconstruye cada vez que se entra al modulo).
    if (moduleName === "habilitacion") {
      renderHabilitacionPanel();
    }
    if (moduleName === "mejoramiento") {
      renderImprovementPlans();
    }
    if (moduleName === "configuracion") {
      renderAuditPanel();
    }
    // Respuestas/Entregas leen el localStorage del admin; al abrir el modulo
    // bajamos UNA vez el guide_state de la nube y re-renderizamos para mostrar
    // datos cross-device (aprendices que guardaron en otro equipo).
    if (moduleName === "respuestas" || moduleName === "entregas") {
      const rerender = moduleName === "respuestas" ? renderResponses : renderDeliveries;
      setFeedback("Sincronizando datos de los aprendices desde la nube...", "info");
      ensureGuideStatesHydrated()
        .then((changed) => {
          if (state.activeModule === moduleName && changed) rerender();
          setFeedback("", "info");
        })
        .catch(() => setFeedback("", "info"));
    }
    if (tab === "auditoria") {
      renderAuditPanel();
      window.requestAnimationFrame(() => {
        byId("audit-container")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }

  function renderAuditPanel() {
    const host = byId("audit-host");
    if (!host) return;
    if (window.adminAudit && typeof window.adminAudit.renderAuditTab === "function") {
      window.adminAudit.renderAuditTab(host);
    } else {
      host.innerHTML = '<p class="activities-empty">Modulo adminAudit no disponible.</p>';
    }
  }


  // ── Habilitacion de actividades ─────────────────────────────────────────
  // Helpers que admin_habilitacion.js consume vía deps. Derivan de
  // ActivityStandard (poblado por guide_declarations.js).
  function getUnlockActivitiesForGuide(fileName) {
    const std = window.ActivityStandard;
    if (std && typeof std.getActivitiesForGuide === "function") {
      const list = std.getActivitiesForGuide(fileName);
      if (Array.isArray(list) && list.length) return list;
    }
    const guide2Activities = [
      { id: "extensiones331", label: "Actividad 5. Extensiones de archivo", keys: GUIDE2_EXTENSION_ACTIVITY_KEYS, summaryKey: "extensions-category-summary" },
      { id: "sistemas332", label: "Actividad 6. Requerimientos minimos de sistemas operativos", keys: GUIDE2_SYSTEM_ACTIVITY_KEYS },
      { id: "colaborativas334", label: "Actividad 8. Herramientas colaborativas y comunicacion digital profesional", shortLabel: "Actividad 8 - Herramientas colaborativas", keys: GUIDE2_COLLABORATIVE_ACTIVITY_KEYS },
      { id: "transferReto341", label: "Actividad 10. Reto final de solucion digital", shortLabel: "Actividad 10 - Reto final", keys: GUIDE2_TRANSFER_RETO_KEYS },
    ];
    const normalizedFile = String(fileName || "");
    if (/guia-02-herramientas-informaticas-digitales/.test(normalizedFile)) {
      return guide2Activities;
    }
    if (/santa-barbara-10[ab]-guia-02-redes-rap01/.test(normalizedFile)) {
      return REDES_LAB_ACTIVITIES.map((activity) => ({
        ...activity,
        unlockAttr: `data-unlock-redes-activity="${escapeHtml(activity.id)}"`,
      }));
    }
    if (getGuide6ResponseConfig(normalizedFile)) {
      return GUIDE6_UNLOCK_ACTIVITIES;
    }
    return [];
  }

  function getGuideActivityStateKey(fileName) {
    const std = window.ActivityStandard;
    if (std && typeof std.getConfigForGuide === "function") {
      const cfg = std.getConfigForGuide(fileName);
      return cfg && cfg.stateKey ? cfg.stateKey : "";
    }
    return "";
  }

  function readJsonSafe(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function renderHabilitacionPanel() {
    const host = byId("habilitacion-host");
    if (!host) return;
    const hab = window.adminHabilitacion;
    if (!hab || typeof hab.buildHabilitacionPanel !== "function") {
      host.innerHTML = '<p class="activities-empty">Modulo adminHabilitacion no esta disponible.</p>';
      return;
    }
    const deps = {
      auth,
      deadlineManager: window.activityDeadlineManager,
      readJson: readJsonSafe,
      getUnlockActivitiesForGuide,
      getGuideActivityStateKey,
      filters: state.habilitacionFilters || {},
    };
    host.innerHTML = hab.buildHabilitacionPanel(state.users || [], deps);
    bindHabilitacionHandlers();
  }

  function bindHabilitacionHandlers() {
    const host = byId("habilitacion-host");
    if (!host) return;

    // Filtros (live)
    const onFilter = () => {
      state.habilitacionFilters = {
        name: host.querySelector("#hab-filter-name")?.value || "",
        ficha: host.querySelector("#hab-filter-ficha")?.value || "",
        guide: host.querySelector("#hab-filter-guide")?.value || "",
        activity: host.querySelector("#hab-filter-activity")?.value || "",
      };
      renderHabilitacionPanel();
    };
    host.querySelector("#hab-filter-name")?.addEventListener("input", debounce(onFilter, 250));
    host.querySelector("#hab-filter-ficha")?.addEventListener("change", onFilter);
    host.querySelector("#hab-filter-guide")?.addEventListener("change", onFilter);
    host.querySelector("#hab-filter-activity")?.addEventListener("input", debounce(onFilter, 250));

    // Botones "Habilitar"
    host.querySelectorAll("[data-hab-unlock]").forEach((button) => {
      button.addEventListener("click", () => handleUnlockClick(button));
    });

    // Boton "Cargar estado desde la nube"
    const cloudBtn = host.querySelector("#hab-cloud-sync");
    if (cloudBtn) {
      cloudBtn.addEventListener("click", () => handleHabilitacionCloudSync(cloudBtn));
    }
  }

  async function handleHabilitacionCloudSync(button) {
    const hab = window.adminHabilitacion;
    if (!hab || typeof hab.pullCloudStateForUsers !== "function") {
      window.portalAlert("El modulo de habilitacion no esta cargado.", { type: "error" });
      return;
    }
    const host = byId("habilitacion-host");
    const statusEl = host?.querySelector("#hab-cloud-sync-status");
    const filters = state.habilitacionFilters || {};
    const fichaFilter = String(filters.ficha || "").trim();
    const users = (state.users || []).filter((u) => {
      if (fichaFilter && String(u.ficha) !== fichaFilter) return false;
      return true;
    });
    if (!users.length) {
      window.portalAlert("No hay aprendices en el filtro actual.", { type: "warning" });
      return;
    }
    // Confirmacion con estimacion de costo de lecturas
    const guideCount = typeof auth.getGuidesForFicha === "function"
      ? (auth.getGuidesForFicha(users[0]?.ficha) || []).length
      : 0;
    const estimated = users.length * Math.max(1, guideCount);
    const fichaLabel = fichaFilter ? `ficha ${fichaFilter}` : "TODAS las fichas";
    const confirmed = await confirmAdminAction(
      `Traer estado desde Firestore para ${users.length} aprendices de ${fichaLabel}.\n` +
      `Aproximadamente ${estimated} lecturas de Firestore.\n\n` +
      `Continuar?`
    );
    if (!confirmed) return;

    button.disabled = true;
    const originalLabel = button.innerHTML;
    button.innerHTML = "&#9203; Sincronizando&hellip;";
    if (statusEl) statusEl.textContent = "Iniciando sincronizacion&hellip;";

    try {
      const result = await hab.pullCloudStateForUsers(users, {
        auth,
        getGuideActivityStateKey,
        onProgress: ({ idx, total, fullName, pageFile }) => {
          if (statusEl) {
            statusEl.textContent = `Sincronizando ${idx}/${total}: ${fullName} - ${pageFile}`;
          }
        },
      });
      if (statusEl) {
        statusEl.textContent =
          `Sincronizacion terminada. ${result.merged} estados actualizados, ` +
          `${result.fetched} lecturas, ${result.errors} errores. Refrescando lista...`;
      }
      // Re-render con los nuevos estados ya en localStorage
      renderHabilitacionPanel();
    } catch (err) {
      console.error("[admin] cloud sync failed:", err);
      if (statusEl) statusEl.textContent = "Error: " + (err?.message || "error desconocido");
      window.portalAlert("No se pudo sincronizar: " + (err?.message || "error"), { type: "error" });
    } finally {
      button.disabled = false;
      button.innerHTML = originalLabel;
    }
  }

  function debounce(fn, ms) {
    let timer = null;
    return function debounced(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn.apply(this, args); }, ms);
    };
  }

  async function handleUnlockClick(button) {
    const usernameKey = button.dataset.habUnlock;
    const guideFile = button.dataset.habGuide;
    const activityId = button.dataset.habActivity;
    const activity = { id: activityId };
    const stateKey = button.dataset.habStateKey;
    const activityLabel = button.dataset.habLabel;
    const guideTitle = button.dataset.habGuideTitle;
    const learnerName = button.dataset.habLearner;
    const ficha = button.dataset.habFicha;
    const lockKeys = String(button.dataset.habLockKeys || "").split(",").filter(Boolean);

    const motivoInput = byId("habilitacion-host")
      ?.querySelector(`[data-hab-motivo="${usernameKey}::${guideFile}::${activityId}"]`);
    const motivo = motivoInput ? String(motivoInput.value || "").trim() : "";

    const confirmed = await confirmAdminAction(
      `Habilitar la actividad "${activityLabel}" para ${learnerName} (ficha ${ficha})?\n` +
      "Se desbloqueara y el aprendiz podra modificar/reenviar su entrega."
    );
    if (!confirmed) return;

    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "Habilitando...";
    window.portalSaveStatus?.saving("Habilitando actividad...");

    try {
      if (!auth || !auth.getStudentStorageKey) throw new Error("portalAuth no disponible");
      const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
      if (!storageKey) throw new Error("No se pudo derivar la clave de almacenamiento.");

      const currentState = readGuideDataState(storageKey) || {};
      const nextState = Object.assign({}, currentState);
      lockKeys.forEach((key) => {
        if (/-locked$/.test(key)) delete nextState[key];
      });
      nextState.reabierta = true;
      nextState.permiteEdicion = true;
      nextState.updatedAt = new Date().toISOString();
      writeGuideDataLocal(storageKey, nextState, { updatedAt: nextState.updatedAt, updatedBy: "admin-activity-unlock" });
      await patchGuideCloudState(usernameKey, guideFile, {
        state: lockKeys.reduce((acc, key) => {
          if (/-locked$/.test(key)) acc[key] = false;
          return acc;
        }, {
          reabierta: true,
          permiteEdicion: true,
        }),
        updatedBy: `admin-activity-unlock:${activity.id}`,
      });

      // Registrar en el log especifico de habilitaciones
      window.adminHabilitacion?.recordUnlock({
        usernameKey,
        learnerName,
        ficha,
        guideFile,
        guideTitle,
        activityId,
        activityLabel,
        motivo,
      });
      // Y en el audit general (visible en Configuracion -> Auditoria local)
      recordAudit({
        action: "activity-unlock",
        target: usernameKey + " / " + activityId,
        detail: activityLabel + (motivo ? " · Motivo: " + motivo : ""),
      });

      // Refrescar usuarios desde portalAuth para que el siguiente render no
      // muestre la actividad como bloqueada.
      if (typeof auth.fetchStudentsWithProgress === "function") {
        try { state.users = await auth.fetchStudentsWithProgress(); } catch (_) {}
      }
      renderHabilitacionPanel();
      window.portalSaveStatus?.saved("Actividad habilitada");
      setFeedback(`Actividad "${activityLabel}" habilitada para ${learnerName}.`, "success");
    } catch (error) {
      console.warn("[admin] Error al habilitar actividad:", error);
      window.portalSaveStatus?.error("Error al habilitar");
      setFeedback("No se pudo habilitar la actividad: " + (error?.message || "error"), "error");
      button.disabled = false;
      button.textContent = previousLabel;
    }
  }

  function getUser(usernameKey) {
    return state.users.find((user) => user.usernameKey === usernameKey) || null;
  }

  function openModal(title, subtitle, bodyHtml, exportData) {
    state.modalExport = exportData || null;
    currentResponsesExport = state.modalExport;
    byId("admin-detail-title").textContent = title;
    byId("admin-detail-subtitle").textContent = subtitle || "";
    byId("admin-detail-body").innerHTML = bodyHtml || "";
    byId("admin-detail-export").hidden = !state.modalExport;
    byId("admin-detail-modal").hidden = false;
    document.body.classList.add("modal-open");
  }

  function exportCurrentResponsesToWord() {
    const exportSelector = "data-export-responses-word";
    if (!exportSelector) return;
    if (!currentResponsesExport) return;
    window.adminExport?.downloadWord(currentResponsesExport);
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
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <a class="admin-button admin-button--ghost" href="${escapeHtml(guideHref(guide.fileName, user.ficha))}">Abrir</a>
            <button
              class="admin-button admin-button--ghost"
              type="button"
              data-reset-guide="${escapeHtml(guide.fileName)}"
              data-reset-user="${escapeHtml(user.usernameKey)}"
              data-reset-guide-title="${escapeHtml(guide.title || auth.getGuideTitle(guide.fileName))}"
              title="Reiniciar el progreso de esta guia para este aprendiz"
            >Reiniciar</button>
          </div>
        </td>
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
        <thead><tr><th>Guia</th><th>Avance</th><th>Progreso</th><th>Acciones</th></tr></thead>
        <tbody>${guideRows || '<tr><td colspan="4">Sin guias asignadas.</td></tr>'}</tbody>
      </table>
      <div style="margin-top:1.2rem;display:flex;justify-content:flex-end;">
        <button
          class="admin-button"
          type="button"
          data-reset-all-user="${escapeHtml(user.usernameKey)}"
          style="background:var(--color-danger, #c0382b);color:#fff;"
          title="Reinicia el progreso de TODAS las guias del aprendiz"
        >Reiniciar TODO el progreso de este aprendiz</button>
      </div>
    `;
  }

  async function handleResetGuideOriginal(button) {
    const usernameKey = button.dataset.resetUser;
    const fileName = button.dataset.resetGuide;
    const guideTitle = button.dataset.resetGuideTitle || fileName;
    const user = getUser(usernameKey);
    if (!user || !fileName) return;
    const confirmed = await confirmAdminAction(
      `Reiniciar el progreso de "${guideTitle}" para ${user.fullName}? Esta accion no se puede deshacer.`
    );
    if (!confirmed) return;
    if (typeof auth.resetStudentGuideProgress !== "function") {
      setFeedback("La funcion de reset no esta disponible.", "error");
      return;
    }
    window.portalSaveStatus?.saving("Reiniciando progreso...");
    try {
      const result = await auth.resetStudentGuideProgress(usernameKey, fileName);
      if (result && result.ok === false) {
        window.portalSaveStatus?.error(result.message || "Error");
        setFeedback(result.message || "No se pudo reiniciar el progreso.", "error");
        return;
      }
      recordAdminAuditAction({
        action: "guide-reset",
        target: usernameKey + " / " + fileName,
        detail: "Reset una guia: " + guideTitle,
      });
      window.portalSaveStatus?.saved("Progreso reiniciado");
      setFeedback("Progreso reiniciado para esa guia.", "success");
      await loadUsers();
      const refreshedUser = getUser(usernameKey);
      if (refreshedUser) {
        openModal(
          "Detalle del aprendiz",
          refreshedUser.fullName,
          renderLearnerDetail(refreshedUser)
        );
      }
    } catch (error) {
      console.warn("[admin] Error al reiniciar progreso:", error);
      setFeedback("Error al reiniciar: " + (error?.message || "desconocido"), "error");
    }
  }

  async function handleResetAll(button) {
    const usernameKey = button.dataset.resetAllUser;
    const user = getUser(usernameKey);
    if (!user) return;
    const confirmed = await confirmAdminAction(
      `Reiniciar TODO el progreso de ${user.fullName}? Esto borrara las respuestas, entregas y avance de TODAS sus guias. No se puede deshacer.`
    );
    if (!confirmed) return;
    if (typeof auth.resetStudentAllProgress !== "function") {
      setFeedback("La funcion de reset total no esta disponible.", "error");
      return;
    }
    window.portalSaveStatus?.saving("Reiniciando todo el progreso...");
    try {
      const result = await auth.resetStudentAllProgress(usernameKey);
      if (result && result.ok === false) {
        window.portalSaveStatus?.error(result.message || "Error");
        setFeedback(result.message || "No se pudo reiniciar el progreso completo.", "error");
        return;
      }
      recordAdminAuditAction({
        action: "all-progress-reset",
        target: usernameKey,
        detail: "Reset total del aprendiz: " + user.fullName,
      });
      window.portalSaveStatus?.saved("Progreso total reiniciado");
      setFeedback("Progreso total reiniciado.", "success");
      await loadUsers();
      closeModal();
    } catch (error) {
      console.warn("[admin] Error al reset total:", error);
      window.portalSaveStatus?.error("Error al reiniciar");
      setFeedback("Error: " + (error?.message || "desconocido"), "error");
    }
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

  async function openResponses(usernameKey, fileName, activityId) {
    const user = getUser(usernameKey);
    if (!user) return;
    let summary = collectActivityResponses(user, fileName, activityId);
    // Lee las respuestas desde la nube para CUALQUIER guia (no solo Guia 6): el
    // aprendiz suele guardar en otro equipo, asi que el localStorage del admin
    // esta vacio. getGuideCloudConfig resuelve el cloudFileName de la guia y
    // loadGuide6Responses (generico pese al nombre) trae el doc de Firestore.
    const config = getGuideCloudConfig(fileName);
    if (config) {
      config.pageFile = fileName;
      openModal(
        "Respuestas por actividad",
        `${user.fullName} | Cargando...`,
        '<p class="response-status">Consultando respuestas sincronizadas del aprendiz...</p>'
      );
      const snapshot = await loadGuide6Responses(usernameKey, config);
      if (snapshot?.state) {
        summary = collectActivityResponsesFromState(user, fileName, activityId, snapshot.state, {
          updatedAt: snapshot.updatedAt,
          updatedBy: snapshot.updatedBy,
        });
      } else if (!summary.answeredCount && !stateHasAnswers(summary.delivery)) {
        // Ni la nube ni el localStorage del admin tienen datos: marcar sin-respuesta.
        summary = {
          ...summary,
          questions: [],
          answeredCount: 0,
          status: "sin-respuesta",
        };
      }
    }
    const bodyHtml = buildResponsesView(summary);
    const exportData = buildExportableActivityDocument(summary);
    openModal(
      "Respuestas por actividad",
      `${user.fullName} | ${summary.activityLabel}`,
      config && !summary.answeredCount && !stateHasAnswers(summary.delivery)
        ? bodyHtml + '<p class="response-status">El aprendiz aun no tiene respuestas guardadas sincronizadas para esta actividad.</p>'
        : bodyHtml,
      exportData
    );
  }

  function exportActivityResponse(usernameKey, fileName, activityId) {
    const user = getUser(usernameKey);
    if (!user || !window.adminExport) return;
    const summary = collectActivityResponses(user, fileName, activityId);
    const exportData = buildExportableActivityDocument(summary);
    window.adminExport.downloadWord(exportData, {
      learnerName: user.fullName,
      title: `${summary.activityId}_${summary.status}`,
    });
  }

  async function handleCreateStudent(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const confirmed = await confirmAdminAction(`Crear aprendiz ${data.fullName}?`);
    if (!confirmed) return;
    window.portalSaveStatus?.saving("Creando aprendiz...");
    const result = await auth.adminCreateStudent(data);
    if (!result.ok) {
      window.portalSaveStatus?.error(result.message || "Error al crear");
      setFeedback(result.message || "No fue posible crear el aprendiz.", "error");
      return;
    }
    recordAdminAuditAction({ action: "student-create", target: result.user.usernameKey, detail: result.user.fullName });
    form.reset();
    window.portalSaveStatus?.saved("Aprendiz creado");
    setFeedback("Aprendiz creado correctamente.", "success");
    await loadUsers();
  }

  async function handleSaveActivityDeadline(button) {
    if (!deadlineManager) {
      setFeedback("El gestor de fechas no esta disponible.", "error");
      return;
    }
    const guide = button.dataset.saveActivityDeadline;
    const activity = button.dataset.activityId;
    const activityLabel = button.dataset.activityLabel || deadlineManager.getActivityLabel?.(guide, activity) || activity;
    const input = document.querySelector(`[data-deadline-input="${CSS.escape(`${guide}::${activity}`)}"]`);
    const dueAt = input?.value || "";
    if (!guide || !activity || !dueAt) {
      setFeedback("Selecciona una fecha valida para guardar.", "error");
      return;
    }
    const confirmed = await confirmAdminAction(`Guardar fecha para ${activityLabel}?`);
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    await deadlineManager.savePolicy(guide, activity, dueAt, session?.usernameKey || "admin");
    recordAdminAuditAction({ action: "deadline-save", target: `${guide}:${activity}`, detail: dueAt });
    setFeedback("Fecha de entrega guardada.", "success");
    renderAll();
  }

  async function handleClearActivityDeadline(button) {
    if (!deadlineManager) return;
    const guide = button.dataset.clearActivityDeadline;
    const activity = button.dataset.activityId;
    const activityLabel = button.dataset.activityLabel || deadlineManager.getActivityLabel?.(guide, activity) || activity;
    const confirmed = await confirmAdminAction(`Quitar fecha de ${activityLabel}?`);
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    await deadlineManager.clearPolicy(guide, activity, session?.usernameKey || "admin");
    recordAdminAuditAction({ action: "deadline-clear", target: `${guide}:${activity}`, detail: "Fecha eliminada" });
    setFeedback("Fecha eliminada.", "success");
    renderAll();
  }

  // Banco de respuestas modelo (SOLO admin). Se lee una vez de Firestore y se cachea.
  // El aprendiz nunca lo recibe; al aprobar se le copia solo SU solucion (dentro de notas).
  let _gradeSolutionsBank = null;
  let _gradeSolutionsBankLoaded = false; // true SOLO si una lectura a Firestore tuvo exito
  async function ensureGradeSolutionsBank(force) {
    if (_gradeSolutionsBankLoaded && !force) return _gradeSolutionsBank;
    const db = window._firebaseDb;
    if (db && typeof db.cloudGetGradeSolutions === "function") {
      try {
        _gradeSolutionsBank = await db.cloudGetGradeSolutions();
        _gradeSolutionsBankLoaded = true;
      } catch (_) {
        // Fallo transitorio (red, token aun no listo): NO se marca como cargado, para
        // que el proximo intento (p. ej. al aprobar) reintente en vez de quedar vacio
        // en silencio por el resto de la sesion.
        _gradeSolutionsBank = _gradeSolutionsBank || {};
      }
    } else {
      _gradeSolutionsBank = _gradeSolutionsBank || {};
    }
    return _gradeSolutionsBank;
  }

  function lookupBankSolution(guideFamily, activityId) {
    const fam = (_gradeSolutionsBank || {})[guideFamily];
    return (fam && fam[activityId]) || null;
  }

  // Resuelve el archivo de guia (HTML) del aprendiz que pertenece a una familia de
  // calificacion (p. ej. "guia-01-induccion"), segun su ficha. Usa el mapa
  // archivo->familia expuesto por activityGradesManager.
  function resolveStudentGuideFileForFamily(usernameKey, guideFamily) {
    const famByFile = (window.activityGradesManager && window.activityGradesManager.GUIDE_FAMILY_BY_FILE) || {};
    const user = getUser(usernameKey);
    if (!user) return "";
    return getGuidesForFicha(user.ficha).find((f) => famByFile[f] === guideFamily) || "";
  }

  // Al APROBAR con solucion del banco, escribe las respuestas en el estado del aprendiz
  // en la nube (solo campos vacios) y actualiza su progreso, para que el avance y las
  // respuestas se vean al instante al consultar sin que el aprendiz reabra la guia.
  async function applyApprovedSolutionToStudentCloud(usernameKey, guideFamily, solution) {
    const db = window._firebaseDb;
    if (!db || typeof db.adminApplySolutionToGuide !== "function" || !solution) return { filled: 0 };
    const fileName = resolveStudentGuideFileForFamily(usernameKey, guideFamily);
    if (!fileName) return { filled: 0 };
    const result = await db.adminApplySolutionToGuide(usernameKey, fileName, solution);
    // Refresca el cache en memoria para que Respuestas/Ver del admin lo muestren sin recargar.
    if (result && result.ok && result.state) {
      const config = getGuideCloudConfig(fileName);
      if (config && config.stateKey && typeof auth.getStudentStorageKey === "function") {
        const storageKey = auth.getStudentStorageKey(usernameKey, config.stateKey, { area: "guide-data" });
        guideDataCacheSet(storageKey, result.state, { updatedAt: new Date().toISOString(), updatedBy: "admin-grade-fill" });
      }
    }
    // Refresca state.users EN MEMORIA para que "Progreso individual" y el dashboard
    // muestren el % nuevo sin esperar una recarga del panel (invalidateUsersCache solo
    // ayuda en la PROXIMA carga, no repinta lo que ya esta en pantalla).
    if (result && result.progress) {
      const user = getUser(usernameKey);
      if (user) {
        if (!user.progress || !Array.isArray(user.progress.guides)) {
          user.progress = { guides: [], completed: 0, total: 0, percent: 0 };
        }
        const guides = user.progress.guides;
        const idx = guides.findIndex((g) => g.fileName === fileName);
        const guideEntry = {
          fileName,
          title: auth.getGuideTitle(fileName),
          completed: result.progress.completed,
          total: result.progress.total,
          percent: result.progress.percent,
          updatedAt: result.progress.updatedAt,
          source: "network",
        };
        if (idx === -1) guides.push(guideEntry); else guides[idx] = guideEntry;
        const totalComp = guides.reduce((s, g) => s + (Number(g.completed) || 0), 0);
        const totalItems = guides.reduce((s, g) => s + (Number(g.total) || 0), 0);
        user.progress.completed = totalComp;
        user.progress.total = totalItems;
        user.progress.percent = totalItems ? Math.round((totalComp / totalItems) * 100) : 0;
      }
    }
    return { filled: (result && result.filled) || 0 };
  }

  async function handleGradeChange(select) {
    const usernameKey = select.dataset.gradeUser || select.dataset.user || "";
    const guideFamily = select.dataset.gradeFamily || "";
    const activityId = select.dataset.gradeActivity || "";
    const nextGrade = select.value || "";
    const gradesManager = window.activityGradesManager;
    // La celda "Aprobadas" refleja el estado visible de los selects: se recalcula
    // SIEMPRE y de primero, para que el % avance aunque el guardado posterior falle.
    refreshApprovalCell(select);
    if (!gradesManager || !usernameKey || !guideFamily || !activityId) {
      window.portalSaveStatus?.error("No se pudo guardar (faltan datos del aprendiz).");
      setFeedback("No se pudo guardar la calificacion: faltan datos del aprendiz.", "error");
      return;
    }
    // Al APROBAR (A) se embebe la solucion del banco dentro de las notas del aprendiz, en
    // una sola escritura (rule isAdmin). El aprendiz solo lee su doc -> ve solo SU solucion.
    // Se espera el banco (reintenta si una carga previa fallo, ver ensureGradeSolutionsBank)
    // para no perder la solucion por una carrera con la carga inicial del modulo.
    if (nextGrade === "A") await ensureGradeSolutionsBank();
    const solution = nextGrade === "A" ? lookupBankSolution(guideFamily, activityId) : null;
    // Toast visible abajo-derecha: el #admin-feedback queda fuera de pantalla en esta
    // vista, asi que el admin no veia ninguna confirmacion de guardado.
    window.portalSaveStatus?.saving("Guardando calificacion...");
    try {
      gradesManager.setStudentActivityGradeAndSolution(usernameKey, guideFamily, activityId, nextGrade, solution);
    } catch (err) {
      window.portalSaveStatus?.error("Error al guardar la calificacion.");
      setFeedback("Error al guardar la calificacion: " + (err && err.message ? err.message : err), "error");
      return;
    }
    select.dataset.previousGrade = nextGrade;
    // Calificar cambia el avance del aprendiz en la nube: invalida el cache de la
    // lista para que al recargar el panel se vea el % actualizado (no el cacheado).
    invalidateUsersCache();

    recordAdminAuditAction({ action: "grade-change", target: `${usernameKey}:${guideFamily}:${activityId}`, detail: nextGrade || "sin nota" });

    // Escribe las respuestas + avance en el estado del aprendiz en la nube (best-effort;
    // si falla, el aprendiz igual las rellena al abrir la guia). `filled` refleja lo que
    // REALMENTE se escribio (0 si ya tenia respuestas, o si la escritura fallo) para que
    // el mensaje de abajo no afirme un "aplicado" que no ocurrio.
    let filled = 0;
    if (nextGrade === "A" && solution) {
      try {
        const applyResult = await applyApprovedSolutionToStudentCloud(usernameKey, guideFamily, solution);
        filled = (applyResult && applyResult.filled) || 0;
      } catch (e) { /* no critico */ }
    }

    const msg = nextGrade
      ? "Calificacion guardada." + (filled > 0 ? " Respuestas y avance aplicados." : "")
      : "Calificacion borrada.";
    window.portalSaveStatus?.saved(msg);
    setFeedback(msg, "success");
  }

  // Importa el banco-semilla (grade_solutions_bank.json) a Firestore (solo admin).
  async function handleGradeBankImport() {
    const fileInput = byId("grades-bank-file");
    const statusEl = byId("grades-bank-status");
    const file = fileInput && fileInput.files && fileInput.files[0];
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    if (!file) { setStatus("Elige el archivo grade_solutions_bank.json primero."); return; }
    const db = window._firebaseDb;
    if (!db || typeof db.cloudSaveGradeSolutions !== "function") { setStatus("Firestore no disponible."); return; }
    try {
      const text = await file.text();
      const bank = JSON.parse(text);
      if (!bank || typeof bank !== "object") throw new Error("formato invalido");
      await db.cloudSaveGradeSolutions(bank);
      await ensureGradeSolutionsBank(true);
      const count = Object.values(bank).reduce((n, fam) =>
        n + Object.values(fam || {}).reduce((m, act) => m + Object.keys(act || {}).length, 0), 0);
      setStatus(`Banco guardado en la nube: ${count} respuestas.`);
      recordAdminAuditAction({ action: "grade-bank-import", target: "bank", detail: String(count) });
    } catch (e) {
      setStatus("Error al importar: " + (e && e.message ? e.message : e));
    }
  }

  function patchGuideState(usernameKey, guideFamily, patch) {
    if (!usernameKey || !guideFamily || !patch || typeof patch !== "object") return false;
    const key = `admin_grade_patch_${usernameKey}_${guideFamily}`;
    const current = readJson(localStorage.getItem(key), {});
    safeSetLocalAdmin(key, JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    return true;
  }

  // ── Calificaciones: entrada manual directa desde el panel ───────────────────
  // El admin elige ficha + guia y marca Aprobado / No aprobado por actividad. Se
  // guarda al instante en Firestore (sena_portal_grades); cada aprendiz ve solo
  // la suya. Reemplaza la importacion por Excel.
  function getGradeCatalog() {
    return (window.activityGradesManager && window.activityGradesManager.GRADE_CATALOG) || {};
  }

  // Familias de calificacion (guias) que en verdad pertenecen a una ficha, segun
  // FICHA_MAP. Cada grupo tiene sus propias guias (ej. 10A no tiene guia-06); el
  // desplegable de guia debe reflejar solo esas, no el catalogo completo.
  function getGuideFamiliesForFicha(ficha) {
    const famByFile = (window.activityGradesManager && window.activityGradesManager.GUIDE_FAMILY_BY_FILE) || {};
    const files = ficha ? getGuidesForFicha(ficha) : [];
    const families = [];
    const seen = new Set();
    files.forEach((file) => {
      const fam = famByFile[file];
      if (fam && !seen.has(fam)) { seen.add(fam); families.push(fam); }
    });
    return families;
  }

  function guideFilterOptionsMarkup(ficha, selected) {
    if (!ficha) return '<option value="">Selecciona una ficha primero</option>';
    const catalog = getGradeCatalog();
    const families = getGuideFamiliesForFicha(ficha).filter((fam) => catalog[fam]);
    if (!families.length) return '<option value="">Esta ficha no tiene guias con calificacion</option>';
    return '<option value="">Selecciona guia</option>' + families.map((fam) =>
      `<option value="${escapeHtml(fam)}"${fam === selected ? " selected" : ""}>${escapeHtml(catalog[fam].label || fam)}</option>`
    ).join("");
  }

  // Avance de evaluacion (instantaneo) por aprendiz que se muestra en la grilla de notas.
  function approvalCellText(approved, total) {
    const pct = total ? Math.round((approved / total) * 100) : 0;
    return `${approved}/${total} (${pct}%)`;
  }

  // Recalcula la celda "Aprobadas" de una fila al instante, contando las notas A actuales.
  function refreshApprovalCell(select) {
    const row = select.closest("tr[data-grade-row]");
    if (!row) return;
    const selects = row.querySelectorAll("select.grade-select");
    const approved = Array.from(selects).filter((s) => s.value === "A").length;
    const cell = row.querySelector(".grades-approved-cell");
    if (cell) cell.textContent = approvalCellText(approved, selects.length);
  }

  function gradeSelectMarkup(usernameKey, guideFamily, activityId, current) {
    const cur = current || "";
    function opt(value, label) {
      return `<option value="${value}"${cur === value ? " selected" : ""}>${label}</option>`;
    }
    return `<select class="grade-select" data-grade-user="${escapeHtml(usernameKey)}" `
      + `data-grade-family="${escapeHtml(guideFamily)}" data-grade-activity="${escapeHtml(activityId)}" `
      + `data-previous-grade="${escapeHtml(cur)}" aria-label="Calificacion">`
      + opt("", "&mdash;") + opt("A", "Aprobado") + opt("D", "No aprobado") + `</select>`;
  }

  function renderGrades() {
    const host = byId("module-notas");
    if (!host) return;
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>Calificaciones</h2>
        <p class="admin-muted">Elige ficha y guia, y marca Aprobado / No aprobado por actividad. Se guarda al instante; cada aprendiz ve solo la suya. Al aprobar una actividad vacia, se le copia la solucion del banco.</p>
      </div>
      <details class="grades-bank-import">
        <summary>Banco de respuestas (sincronizar a la nube)</summary>
        <p class="admin-muted">Sube <code>grade_solutions_bank.json</code> para guardar el banco en Firestore (solo el admin lo puede leer). El aprendiz nunca ve el banco; al aprobar se le copia unicamente la respuesta de su actividad.</p>
        <input type="file" id="grades-bank-file" accept=".json">
        <button type="button" id="grades-bank-import-btn" class="btn secondary">Importar a la nube</button>
        <span id="grades-bank-status" class="admin-muted"></span>
      </details>
      <div class="grades-manual__filters">
        <select id="grades-ficha-filter">${getFichaOptions("", false)}</select>
        <select id="grades-guide-filter" disabled>${guideFilterOptionsMarkup("", "")}</select>
      </div>
      <div id="grades-grid" class="grades-grid"></div>
    `;
    ensureGradeSolutionsBank();   // precarga el banco para aplicar soluciones al aprobar
    byId("grades-bank-import-btn")?.addEventListener("click", handleGradeBankImport);
  }

  async function renderGradesGrid() {
    const grid = byId("grades-grid");
    if (!grid) return;
    const ficha = byId("grades-ficha-filter")?.value || "";
    const guideFamily = byId("grades-guide-filter")?.value || "";
    const catalog = getGradeCatalog();
    if (!ficha || !guideFamily || !catalog[guideFamily]) {
      grid.innerHTML = '<p class="admin-muted">Selecciona una ficha y una guia para ver los aprendices.</p>';
      return;
    }
    const activities = catalog[guideFamily].activities || [];
    const students = getUsersForFicha(ficha);
    if (!students.length) {
      grid.innerHTML = '<p class="admin-muted">No hay aprendices en esta ficha.</p>';
      return;
    }
    grid.innerHTML = '<p class="response-status">Cargando calificaciones desde la nube...</p>';
    // Trae las notas de cada aprendiz desde Firestore (en paralelo) para prellenar.
    const db = window._firebaseDb;
    const gradesByUser = {};
    await Promise.all(students.map(async (user) => {
      let g = {};
      if (db && typeof db.cloudGetGrades === "function") {
        try {
          const all = await db.cloudGetGrades(user.usernameKey);
          g = (all && all[guideFamily]) || {};
        } catch (_) { /* sin nube: cae a cache local */ }
      }
      if (!Object.keys(g).length && window.activityGradesManager) {
        g = window.activityGradesManager.getStudentGrades(user.usernameKey, guideFamily) || {};
      }
      gradesByUser[user.usernameKey] = g;
    }));
    const head = "<th>Aprendiz</th>" + activities.map((a) => `<th>${escapeHtml(a.label)}</th>`).join("") + "<th>Aprobadas</th>";
    const rows = students.map((user) => {
      const g = gradesByUser[user.usernameKey] || {};
      const cells = activities.map((a) =>
        `<td>${gradeSelectMarkup(user.usernameKey, guideFamily, a.id, g[a.id])}</td>`
      ).join("");
      const approved = activities.filter((a) => g[a.id] === "A").length;
      return `<tr data-grade-row="${escapeHtml(user.usernameKey)}"><td>${escapeHtml(user.fullName)}</td>${cells}`
        + `<td class="grades-approved-cell">${approvalCellText(approved, activities.length)}</td></tr>`;
    }).join("");
    grid.innerHTML = `<table class="admin-data-table grades-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ── Planes de Mejoramiento (pestaña aparte) ─────────────────────────────────
  let _plansByUser = {};   // { usernameKey: { user, plans } } de la ficha mostrada

  function renderImprovementPlans() {
    const host = byId("module-mejoramiento");
    if (!host) return;
    const catalog = getGradeCatalog();
    const guideOptions = Object.keys(catalog).map((fam) =>
      `<option value="${escapeHtml(fam)}">${escapeHtml(catalog[fam].label || fam)}</option>`).join("");
    const defMotivo = (window.improvementPlans && window.improvementPlans.DEFAULT_MOTIVO) || "";
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>Planes de Mejoramiento</h2>
        <p class="admin-muted">Asigna un trabajo de recuperacion a un aprendiz que no entrego a tiempo: re-habilita la actividad con un motivo y una fecha limite. Queda registrado como evidencia (exportable a Word).</p>
      </div>
      <details class="mejora-nuevo">
        <summary>Asignar nuevo plan de mejoramiento</summary>
        <div class="mejora-form">
          <label>Ficha <select id="mejora-ficha">${getFichaOptions("", false)}</select></label>
          <label>Aprendiz <select id="mejora-aprendiz"></select></label>
          <label>Guia <select id="mejora-guia"><option value="">Selecciona</option>${guideOptions}</select></label>
          <label>Actividad <select id="mejora-actividad"><option value="">Selecciona la guia primero</option></select></label>
          <label>Actividad de recuperacion <small>(qué debe realizar; se prellena al elegir la actividad y la puedes ajustar)</small>
            <textarea id="mejora-descripcion" rows="3" placeholder="Tarea de recuperacion basada en la actividad de la guia."></textarea></label>
          <label>Motivo <textarea id="mejora-motivo" rows="2">${escapeHtml(defMotivo)}</textarea></label>
          <label>Fecha limite del plan <small>(independiente de la fecha de entrega de la guia)</small> <input type="date" id="mejora-fecha"></label>
          <button type="button" id="mejora-asignar" class="btn primary">Asignar plan</button>
          <span id="mejora-status" class="admin-muted"></span>
        </div>
      </details>
      <div class="mejora-filtros">
        <select id="mejora-filtro-ficha">${getFichaOptions("", false)}</select>
        <select id="mejora-filtro-estado">
          <option value="">Todos los estados</option>
          <option value="asignado">Asignado</option>
          <option value="entregado">Entregado</option>
          <option value="superado">Superado</option>
          <option value="no_superado">No superado</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      <div id="mejora-grid" class="mejora-grid"></div>
    `;
    populatePlanLearners();
    byId("mejora-ficha")?.addEventListener("change", populatePlanLearners);
    byId("mejora-guia")?.addEventListener("change", populatePlanActivities);
    byId("mejora-actividad")?.addEventListener("change", fillPlanDescription);
    byId("mejora-asignar")?.addEventListener("click", handleAssignPlan);
    byId("mejora-filtro-ficha")?.addEventListener("change", renderPlansGrid);
    byId("mejora-filtro-estado")?.addEventListener("change", renderPlansGrid);
    byId("mejora-grid")?.addEventListener("click", handlePlanGridClick);
    renderPlansGrid();
  }

  function populatePlanLearners() {
    const ficha = byId("mejora-ficha")?.value || "";
    const sel = byId("mejora-aprendiz");
    if (!sel) return;
    sel.innerHTML = getUsersForFicha(ficha)
      .map((u) => `<option value="${escapeHtml(u.usernameKey)}">${escapeHtml(u.fullName)}</option>`).join("");
  }

  function populatePlanActivities() {
    const fam = byId("mejora-guia")?.value || "";
    const sel = byId("mejora-actividad");
    if (!sel) return;
    // Las actividades del plan deben ir ACORDE a las actividades planteadas en la guia:
    // se listan las reales de la guia (ActivityStandard), no solo las evaluables.
    let acts = [];
    const AS = window.ActivityStandard;
    const map = (window.activityGradesManager && window.activityGradesManager.GUIDE_FAMILY_BY_FILE) || {};
    const file = Object.keys(map).find((f) => map[f] === fam);
    if (file && AS && typeof AS.getActivitiesForGuide === "function") {
      acts = (AS.getActivitiesForGuide(file) || []).map((a) => ({ id: a.id, label: a.label }));
    }
    if (!acts.length) {
      acts = ((getGradeCatalog()[fam] && getGradeCatalog()[fam].activities) || []).map((a) => ({ id: a.id, label: a.label }));
    }
    sel.innerHTML = acts.length
      ? acts.map((a) => `<option value="${escapeHtml(a.id)}" data-label="${escapeHtml(a.label)}">${escapeHtml(a.label)}</option>`).join("")
      : '<option value="">(sin actividades)</option>';
    fillPlanDescription();
  }

  // Pre-rellena la actividad de recuperacion. Funciona para TODAS las guias (actuales y
  // futuras): usa el banco redactado si existe; si no, genera una tarea por defecto basada
  // en la actividad. El instructor siempre la puede ajustar.
  function fillPlanDescription() {
    const fam = byId("mejora-guia")?.value || "";
    const actSel = byId("mejora-actividad");
    const activityId = actSel?.value || "";
    const activityLabel = actSel?.selectedOptions?.[0]?.dataset.label || "";
    const ta = byId("mejora-descripcion");
    if (!ta) return;
    const bank = (window.improvementActivitiesBank || {})[fam] || {};
    ta.value = bank[activityId] || defaultRemedialTask(activityLabel);
  }

  // Tarea de recuperacion por defecto, derivada de la actividad (cubre guias futuras).
  function defaultRemedialTask(label) {
    const a = String(label || "").trim();
    if (!a) return "";
    return 'Vuelve a realizar la actividad "' + a + '": desarróllala nuevamente sobre el '
      + "mismo caso y con el mismo programa de la guía, corrige lo que faltó y entrega la "
      + "evidencia completa.";
  }

  function handleAssignPlan() {
    const mgr = window.improvementPlans;
    const usernameKey = byId("mejora-aprendiz")?.value || "";
    const family = byId("mejora-guia")?.value || "";
    const actSel = byId("mejora-actividad");
    const activityId = actSel?.value || "";
    const activityLabel = actSel?.selectedOptions?.[0]?.dataset.label || "";
    const descripcion = byId("mejora-descripcion")?.value || "";
    const motivo = byId("mejora-motivo")?.value || "";
    const fechaLimite = byId("mejora-fecha")?.value || "";
    const setStatus = (m) => { const el = byId("mejora-status"); if (el) el.textContent = m; };
    if (!mgr || !usernameKey || !family || !activityId) { setStatus("Completa ficha, aprendiz, guia y actividad."); return; }
    if (!fechaLimite) { setStatus("Indica la fecha limite."); return; }
    const session = window.portalAuth?.getSession?.();
    mgr.createPlan(usernameKey, { family, activityId, activityLabel, descripcion, motivo, fechaLimite, asignadoPor: (session && session.usernameKey) || "admin" });
    recordAdminAuditAction({ action: "mejoramiento-asignar", target: `${usernameKey}:${family}:${activityId}`, detail: fechaLimite });
    setStatus("Plan asignado.");
    renderPlansGrid();
  }

  async function renderPlansGrid() {
    const grid = byId("mejora-grid");
    if (!grid) return;
    const ficha = byId("mejora-filtro-ficha")?.value || "";
    const estado = byId("mejora-filtro-estado")?.value || "";
    const mgr = window.improvementPlans;
    if (!ficha || !mgr) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    grid.innerHTML = '<p class="response-status">Cargando planes desde la nube...</p>';
    const users = getUsersForFicha(ficha);
    _plansByUser = {};
    await Promise.all(users.map(async (u) => {
      let plans = [];
      try { plans = await mgr.syncStudentPlansFromCloud(u.usernameKey); }
      catch (_) { plans = mgr.getStudentPlans(u.usernameKey); }
      _plansByUser[u.usernameKey] = { user: u, plans: plans || [] };
    }));
    const now = Date.now();
    const rows = [];
    users.forEach((u) => {
      (_plansByUser[u.usernameKey]?.plans || []).forEach((p) => {
        const st = mgr.derivePlanStatus(p, now);
        if (estado && st !== estado) return;
        rows.push(planRowMarkup(u, p, st));
      });
    });
    grid.innerHTML = rows.length
      ? `<table class="admin-data-table mejora-table"><thead><tr><th>Aprendiz</th><th>Actividad</th><th>Motivo</th><th>Asignado</th><th>Fecha limite</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : '<p class="admin-muted">No hay planes para esta ficha/estado.</p>';
  }

  function planRowMarkup(user, plan, status) {
    const label = (window.improvementPlans?.STATUS_LABELS || {})[status] || status;
    return `<tr data-plan-id="${escapeHtml(plan.id)}" data-plan-user="${escapeHtml(user.usernameKey)}">
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(plan.activityLabel || plan.activityId)}</td>
      <td>${escapeHtml(plan.motivo)}</td>
      <td>${escapeHtml(formatDate(plan.fechaAsignacion))}</td>
      <td>${escapeHtml(plan.fechaLimite || "—")}</td>
      <td><span class="mejora-estado mejora-estado--${escapeHtml(status)}">${escapeHtml(label)}</span></td>
      <td>
        <button type="button" class="btn small" data-plan-action="entregada">Entregada</button>
        <button type="button" class="btn small" data-plan-action="superado">&#10003; Superado</button>
        <button type="button" class="btn small" data-plan-action="nosuperado">&#10007; No superado</button>
        <button type="button" class="btn small" data-plan-action="fecha">Cambiar fecha</button>
        <button type="button" class="btn small" data-plan-action="word">Word</button>
        <button type="button" class="btn small danger" data-plan-action="eliminar">Eliminar</button>
      </td>
    </tr>`;
  }

  function handlePlanGridClick(event) {
    const btn = event.target.closest("[data-plan-action]");
    if (!btn) return;
    const row = btn.closest("tr[data-plan-id]");
    if (!row) return;
    const usernameKey = row.dataset.planUser;
    const planId = row.dataset.planId;
    const action = btn.dataset.planAction;
    const mgr = window.improvementPlans;
    const entry = _plansByUser[usernameKey];
    const plan = entry && entry.plans.find((p) => p.id === planId);
    if (!mgr || !plan) return;
    if (action === "fecha") {
      const nueva = window.prompt("Nueva fecha limite (AAAA-MM-DD):", plan.fechaLimite || "");
      if (nueva == null) return;
      mgr.updatePlanDeadline(usernameKey, planId, String(nueva).trim());
      recordAdminAuditAction({ action: "mejoramiento-fecha", target: `${usernameKey}:${planId}`, detail: String(nueva).trim() });
      renderPlansGrid();
    } else if (action === "word") {
      exportPlanWord(entry.user, plan);
    } else if (action === "entregada") {
      mgr.markPlanDelivered(usernameKey, planId);   // registra la fecha de entrega (Word)
      recordAdminAuditAction({ action: "mejoramiento-entregada", target: `${usernameKey}:${planId}`, detail: plan.activityId });
      renderPlansGrid();
    } else if (action === "superado" || action === "nosuperado") {
      mgr.setPlanResult(usernameKey, planId, action === "superado" ? "A" : "D");
      recordAdminAuditAction({ action: "mejoramiento-resultado", target: `${usernameKey}:${planId}`, detail: action === "superado" ? "A" : "D" });
      renderPlansGrid();
    } else if (action === "eliminar") {
      confirmAdminAction("Eliminar este plan de mejoramiento?").then((ok) => {
        if (!ok) return;
        mgr.deletePlan(usernameKey, planId);
        recordAdminAuditAction({ action: "mejoramiento-eliminar", target: `${usernameKey}:${planId}`, detail: plan.activityId });
        renderPlansGrid();
      });
    }
  }

  // Exporta el plan a Word con encabezado institucional SENA + Motivo y las dos fechas.
  function exportPlanWord(user, plan) {
    const AS = window.ActivityStandard;
    if (!AS || typeof AS.buildWordDocument !== "function") { setFeedback("Export Word no disponible.", "error"); return; }
    let meta = {};
    try {
      const map = (window.activityGradesManager && window.activityGradesManager.GUIDE_FAMILY_BY_FILE) || {};
      const file = Object.keys(map).find((f) => map[f] === plan.family);
      if (file && typeof AS.getConfigForGuide === "function") meta = AS.getConfigForGuide(file) || {};
    } catch (_) {}
    const catalog = getGradeCatalog();
    const entregaTxt = plan.entrega && plan.entrega.entregadoEn ? formatDate(plan.entrega.entregadoEn) : "Pendiente";
    const html = AS.buildWordDocument({
      title: "Plan de Mejoramiento - " + (plan.activityLabel || plan.activityId),
      learnerName: user.fullName || "",
      ficha: user.ficha || "",
      grupo: user.grupo || meta.grupo || "",
      inst: user.institucion || user.inst || meta.inst || "",
      fecha: formatDate(new Date().toISOString()),
      program: meta.program || "",
      competencia: meta.competencia || "",
      resultado: meta.resultado || "",
      guideTitle: meta.guideTitle || (catalog[plan.family] && catalog[plan.family].label) || "",
      extraHeaderRows: [
        { label: "Motivo del plan", value: plan.motivo || "" },
        { label: "Fecha limite programada", value: plan.fechaLimite || "" },
        { label: "Fecha de entrega", value: entregaTxt },
      ],
      sections: [
        { label: "Actividad a recuperar", value: plan.activityLabel || plan.activityId },
        { label: "Actividad de recuperacion (que debe realizar)", value: plan.descripcion || "" },
        { label: "Motivo", value: plan.motivo || "" },
      ],
    });
    AS.downloadWordDoc(html, "PlanMejoramiento_" + String(user.fullName || "Aprendiz").replace(/\s+/g, "") + ".doc");
    recordAdminAuditAction({ action: "mejoramiento-word", target: `${user.usernameKey}:${plan.id}`, detail: plan.activityId });
  }

  function renderUsers() {
    renderLearners();
  }

  async function handlePasswordSubmit(form) {
    const usernameKey = form.dataset.user;
    const password = form.querySelector("input[name='password']")?.value || "";
    const confirmed = await confirmAdminAction("Cambiar la contrasena del aprendiz?");
    if (!confirmed) {
      return;
    }
    window.portalSaveStatus?.saving("Actualizando contrasena...");
    const result = await auth.updateStudentPassword(usernameKey, password);
    if (!result.ok) {
      window.portalSaveStatus?.error(result.message || "Error al actualizar");
      setFeedback(result.message || "No fue posible actualizar la contrasena.", "error");
      return;
    }
    recordAdminAuditAction({ action: "password-change", target: usernameKey, detail: "Cambio desde panel admin" });
    closeModal();
    window.portalSaveStatus?.saved("Contrasena actualizada");
    setFeedback("Contrasena actualizada.", "success");
  }

  async function handleAccountSubmit(form) {
    const usernameKey = form.dataset.user;
    const data = Object.fromEntries(new FormData(form).entries());
    const confirmed = await confirmAdminAction("Guardar cambios del aprendiz?");
    if (!confirmed) {
      return;
    }
    window.portalSaveStatus?.saving("Guardando cambios...");
    const result = await auth.updateStudentAccount(usernameKey, data);
    if (!result.ok) {
      window.portalSaveStatus?.error(result.message || "Error al actualizar");
      setFeedback(result.message || "No fue posible actualizar el aprendiz.", "error");
      return;
    }
    recordAdminAuditAction({ action: "account-update", target: usernameKey, detail: data.fullName });
    closeModal();
    window.portalSaveStatus?.saved("Aprendiz actualizado");
    setFeedback("Aprendiz actualizado.", "success");
    await loadUsers();
  }

  async function handleResetGuide(button) {
    return handleResetGuideOriginal(button);
  }

  async function handleToggleLearner(button) {
    const usernameKey = button.dataset.toggleLearner;
    const nextActive = button.dataset.nextActive === "true";
    const user = getUser(usernameKey);
    const confirmed = await confirmAdminAction(`${nextActive ? "Activar" : "Desactivar"} a ${user?.fullName || usernameKey}?`);
    if (!confirmed) return;
    window.portalSaveStatus?.saving(nextActive ? "Activando..." : "Desactivando...");
    const result = auth.updateStudentStatus(usernameKey, nextActive);
    if (!result.ok) {
      window.portalSaveStatus?.error(result.message || "Error");
      setFeedback(result.message || "No fue posible cambiar el estado.", "error");
      return;
    }
    recordAdminAuditAction({ action: "student-status", target: usernameKey, detail: nextActive ? "active" : "inactive" });
    window.portalSaveStatus?.saved(nextActive ? "Aprendiz activado" : "Aprendiz desactivado");
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
    window.portalSaveStatus?.saving("Guardando fecha...");
    await deadlineManager.savePolicy(data.guide, data.activity, data.dueAt, session?.usernameKey || "admin");
    recordAdminAuditAction({ action: "deadline-save", target: `${data.guide}:${data.activity}`, detail: data.dueAt });
    window.portalSaveStatus?.saved("Fecha guardada");
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
    recordAdminAuditAction({ action: "deadline-clear", target: `${guide}:${activity}`, detail: "Fecha eliminada" });
    setFeedback("Fecha eliminada.", "success");
    renderAll();
  }

  async function handleDeadlineApplyToGuide() {
    if (!deadlineManager) {
      setFeedback("El gestor de fechas no esta disponible.", "error");
      return;
    }
    const { guide } = selectedDeadlineValues();
    const dueAt = byId("deadline-due-at")?.value || "";
    if (!guide) {
      setFeedback("Selecciona una guia.", "error");
      return;
    }
    if (!dueAt) {
      setFeedback("Indica una fecha y hora limite en el campo de arriba.", "error");
      return;
    }
    const activities = deadlineManager.getActivitiesForGuide?.(guide) || [];
    if (!activities.length) {
      setFeedback("La guia seleccionada no tiene actividades configuradas.", "error");
      return;
    }
    const guideTitle = auth.getGuideTitle?.(guide) || guide;
    const confirmed = await confirmAdminAction(
      `Aplicar la misma fecha a las ${activities.length} actividades de "${guideTitle}"?`
    );
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    window.portalSaveStatus?.saving("Aplicando fecha...");
    let ok = 0, failed = 0;
    for (const activity of activities) {
      try {
        await deadlineManager.savePolicy(guide, activity.id, dueAt, session?.usernameKey || "admin");
        ok += 1;
      } catch (_) {
        failed += 1;
      }
    }
    recordAudit({
      action: "deadline-bulk-save",
      target: guide,
      detail: `${ok}/${activities.length} actividades · dueAt=${dueAt}`,
    });
    if (failed) {
      window.portalSaveStatus?.error(`Aplicada en ${ok}, fallaron ${failed}`);
      setFeedback(`Fecha aplicada a ${ok} actividades; ${failed} fallaron.`, "error");
    } else {
      window.portalSaveStatus?.saved(`Fecha aplicada a ${ok} actividades`);
      setFeedback(`Fecha aplicada a ${ok} actividades de la guia.`, "success");
    }
    renderAll();
  }

  async function handleDeadlineClearGuide() {
    if (!deadlineManager) return;
    const { guide } = selectedDeadlineValues();
    if (!guide) {
      setFeedback("Selecciona una guia.", "error");
      return;
    }
    const activities = deadlineManager.getActivitiesForGuide?.(guide) || [];
    if (!activities.length) {
      setFeedback("La guia seleccionada no tiene actividades configuradas.", "error");
      return;
    }
    const guideTitle = auth.getGuideTitle?.(guide) || guide;
    const confirmed = await confirmAdminAction(
      `Quitar la fecha de entrega de las ${activities.length} actividades de "${guideTitle}"?`
    );
    if (!confirmed) return;
    const session = auth.getCurrentSession?.();
    window.portalSaveStatus?.saving("Quitando fechas...");
    let ok = 0, failed = 0;
    for (const activity of activities) {
      try {
        await deadlineManager.clearPolicy(guide, activity.id, session?.usernameKey || "admin");
        ok += 1;
      } catch (_) {
        failed += 1;
      }
    }
    recordAudit({
      action: "deadline-bulk-clear",
      target: guide,
      detail: `${ok}/${activities.length} actividades`,
    });
    if (failed) {
      window.portalSaveStatus?.error(`Quitadas ${ok}, fallaron ${failed}`);
      setFeedback(`Fechas eliminadas en ${ok} actividades; ${failed} fallaron.`, "error");
    } else {
      window.portalSaveStatus?.saved(`Fechas eliminadas en ${ok} actividades`);
      setFeedback(`Fechas eliminadas en ${ok} actividades de la guia.`, "success");
    }
    renderAll();
  }

  // ── Auditoria de nombres por listado oficial ──────────────────────────────
  // Usa window.nameAudit (js/name_audit.js): empareja el listado pegado contra
  // los aprendices de la ficha. Seguros = se actualizan en bloque; dudosos =
  // esperan la confirmacion individual del administrador antes de tocar nada.
  // Cada actualizacion pasa por auth.updateStudentAccount, que sincroniza el
  // nombre completo a Firebase (syncStudentProfileToFirebase en firebase_db.js).
  let nameAuditResult = null;
  let nameAuditFicha = "";

  function recomputeNameAudit() {
    const audit = window.nameAudit;
    const officialNames = audit.parseOfficialNames(byId("name-audit-input")?.value || "");
    nameAuditResult = audit.matchOfficialNames(officialNames, getUsersForFicha(nameAuditFicha));
    renderNameAudit();
  }

  function runNameAudit() {
    const audit = window.nameAudit;
    if (!audit || typeof audit.matchOfficialNames !== "function") {
      setFeedback("El modulo de auditoria de nombres no esta disponible.", "error");
      return;
    }
    const ficha = byId("name-audit-ficha")?.value || "";
    if (!ficha) {
      setFeedback("Selecciona una ficha para auditar.", "error");
      return;
    }
    const officialNames = audit.parseOfficialNames(byId("name-audit-input")?.value || "");
    if (officialNames.length === 0) {
      setFeedback("Pega al menos un nombre del listado oficial.", "error");
      return;
    }
    nameAuditFicha = ficha;
    nameAuditResult = audit.matchOfficialNames(officialNames, getUsersForFicha(ficha));
    setFeedback(`Listado analizado: ${officialNames.length} nombre(s).`, "info");
    renderNameAudit();
  }

  function renderNameAudit() {
    const host = byId("name-audit-results");
    if (!host) return;
    if (!nameAuditResult) { host.innerHTML = ""; return; }
    const r = nameAuditResult;

    const sureRows = r.sure.map((item) => `
      <tr>
        <td>${escapeHtml(item.user.fullName)}</td>
        <td><strong>${escapeHtml(item.official)}</strong></td>
        <td><span class="admin-muted">${escapeHtml(item.user.username || item.user.usernameKey)} / Ficha ${escapeHtml(item.user.ficha)}</span></td>
      </tr>`).join("");

    const uncertainRows = r.uncertain.map((item, idx) => {
      const cand = item.candidates && item.candidates[0];
      const action = cand
        ? `<button class="admin-button admin-button--ghost" type="button" data-name-audit-apply="${idx}">Aplicar a ${escapeHtml(cand.fullName)}</button>`
        : `<span class="admin-muted">Sin candidato claro. Edita manualmente desde la lista de aprendices.</span>`;
      return `
        <tr>
          <td><strong>${escapeHtml(item.official)}</strong></td>
          <td>${escapeHtml(item.reason)}${cand ? `<br><span class="admin-muted">Sugerido: ${escapeHtml(cand.fullName)}</span>` : ""}</td>
          <td>${action}</td>
        </tr>`;
    }).join("");

    const noChangeRows = r.noChange.map((item) => `
      <tr><td>${escapeHtml(item.user.fullName)}</td><td><span class="admin-muted">Ya coincide con el listado</span></td></tr>`).join("");

    const unmatchedRows = r.unmatchedStudents.map((u) => `
      <tr><td>${escapeHtml(u.fullName)}</td><td><span class="admin-muted">${escapeHtml(u.username || u.usernameKey)} / Ficha ${escapeHtml(u.ficha)}</span></td></tr>`).join("");

    host.innerHTML = `
      <div class="admin-panel" style="margin-top:1rem">
        <h3>Seguros para actualizar (${r.sure.length})</h3>
        ${r.sure.length ? `
          <div class="admin-table-wrap"><table class="admin-data-table">
            <thead><tr><th>Nombre actual</th><th>Nombre oficial nuevo</th><th>Aprendiz</th></tr></thead>
            <tbody>${sureRows}</tbody>
          </table></div>
          <button class="admin-button" type="button" id="name-audit-apply-sure">Aplicar todos los seguros (${r.sure.length})</button>
        ` : '<p class="admin-muted">No hay coincidencias seguras.</p>'}
      </div>
      <div class="admin-panel" style="margin-top:1rem">
        <h3>Dudosos: requieren tu confirmacion (${r.uncertain.length})</h3>
        ${r.uncertain.length ? `
          <p class="admin-muted">Estos no se tocan automaticamente. Revisa cada uno y pulsa "Aplicar" solo si estas de acuerdo.</p>
          <div class="admin-table-wrap"><table class="admin-data-table">
            <thead><tr><th>Nombre oficial</th><th>Motivo</th><th>Accion</th></tr></thead>
            <tbody>${uncertainRows}</tbody>
          </table></div>
        ` : '<p class="admin-muted">No hay nombres dudosos.</p>'}
      </div>
      ${r.noChange.length ? `<div class="admin-panel" style="margin-top:1rem"><h3>Sin cambios (${r.noChange.length})</h3><div class="admin-table-wrap"><table class="admin-data-table"><tbody>${noChangeRows}</tbody></table></div></div>` : ""}
      ${r.unmatchedStudents.length ? `<div class="admin-panel" style="margin-top:1rem"><h3>Aprendices sin emparejar (${r.unmatchedStudents.length})</h3><p class="admin-muted">Ningun nombre del listado coincide con estos aprendices. Revisa si faltan en el listado oficial o si su nombre actual esta muy distinto.</p><div class="admin-table-wrap"><table class="admin-data-table"><tbody>${unmatchedRows}</tbody></table></div></div>` : ""}
    `;

    byId("name-audit-apply-sure")?.addEventListener("click", applyNameAuditSure);
    host.querySelectorAll("[data-name-audit-apply]").forEach((btn) => {
      btn.addEventListener("click", () => applyNameAuditUncertain(Number(btn.dataset.nameAuditApply)));
    });
  }

  // updateStudentAccount guarda el nombre en localStorage de inmediato y LUEGO
  // sincroniza a Firebase. Si la parte de nube se cuelga (sin sesion Firebase,
  // SDK no cargado, offline), la promesa no resolveria nunca y el toast se
  // quedaria girando en "Actualizando...". Cortamos con un timeout: el guardado
  // local ya ocurrio, asi que tras el limite reportamos "guardado, sincronizando".
  const NAME_AUDIT_CLOUD_TIMEOUT_MS = 12000;

  async function applyOneAuditName(user, official) {
    const update = auth.updateStudentAccount(user.usernameKey, {
      fullName: official,
      username: user.username,
      ficha: user.ficha,
      // Confirmado contra el listado oficial de la ficha -> marca el nombre como
      // verificado (columna "Validacion" en verde) y sube el flag a Firebase.
      validacionNombre: "oficial",
      fuenteValidacion: "Listado oficial de la ficha",
    });
    const result = await Promise.race([
      Promise.resolve(update),
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: true, pendingSync: true }), NAME_AUDIT_CLOUD_TIMEOUT_MS)
      ),
    ]);
    if (result && result.ok) {
      recordAdminAuditAction({ action: "name-audit-update", target: user.usernameKey, detail: official });
    }
    return result;
  }

  async function applyNameAuditSure() {
    if (!nameAuditResult || !nameAuditResult.sure.length) return;
    const total = nameAuditResult.sure.length;
    const confirmed = await confirmAdminAction(`Actualizar ${total} nombre(s) seguros y subirlos a Firebase?`);
    if (!confirmed) return;
    window.portalSaveStatus?.saving("Actualizando nombres...");
    let ok = 0; let fail = 0; let pending = 0;
    for (const item of nameAuditResult.sure.slice()) {
      const res = await applyOneAuditName(item.user, item.official);
      if (res && res.ok) { ok++; if (res.pendingSync) pending++; } else fail++;
    }
    window.portalSaveStatus?.saved(`${ok} actualizados`);
    const pendingMsg = pending ? ` ${pending} con sincronizacion a la nube pendiente (recarga para verificar).` : "";
    setFeedback(`Nombres actualizados: ${ok}.${fail ? ` Errores: ${fail}.` : ""}${pendingMsg}`, fail ? "error" : "success");
    await loadUsers();
    recomputeNameAudit();
  }

  async function applyNameAuditUncertain(idx) {
    const item = nameAuditResult && nameAuditResult.uncertain[idx];
    const cand = item && item.candidates && item.candidates[0];
    if (!cand) return;
    const confirmed = await confirmAdminAction(`Aplicar el nombre oficial "${item.official}" al aprendiz "${cand.fullName}"?`);
    if (!confirmed) return;
    window.portalSaveStatus?.saving("Actualizando nombre...");
    const res = await applyOneAuditName(cand, item.official);
    if (res && res.ok) {
      window.portalSaveStatus?.saved("Nombre actualizado");
      setFeedback(
        res.pendingSync
          ? `Nombre guardado: ${item.official}. La sincronizacion con la nube esta tardando; recarga el panel para verificar.`
          : `Nombre actualizado: ${item.official}.`,
        res.pendingSync ? "info" : "success"
      );
    } else {
      window.portalSaveStatus?.error((res && res.message) || "Error al actualizar");
      setFeedback((res && res.message) || "No fue posible actualizar el nombre.", "error");
    }
    await loadUsers();
    recomputeNameAudit();
  }

  function bindEvents() {
    document.querySelectorAll("[data-admin-module]").forEach((button) => {
      button.addEventListener("click", () =>
        setActiveModule(button.dataset.adminModule, { tab: button.dataset.tab || "" })
      );
    });
    document.querySelectorAll("[data-jump-module]").forEach((button) => {
      button.addEventListener("click", () => setActiveModule(button.dataset.jumpModule));
    });
    byId("refresh-users")?.addEventListener("click", () => { guideStatesHydrated = false; loadUsers(); });
    byId("name-audit-run")?.addEventListener("click", runNameAudit);
    byId("btn-backfill-drive")?.addEventListener("click", () => runBackfillToDrive());
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
      byId(id)?.addEventListener("change", () => renderDeadlines());
    });
    byId("deadline-activity")?.addEventListener("change", () => renderDeadlineSelectors());
    byId("responses-ficha-filter")?.addEventListener("change", (event) => {
      state.filters.responsesFicha = event.target.value;
      state.filters.responsesLearner = "";
      state.filters.responsesGuide = "";
      state.filters.responsesActivity = "";
      renderResponses();
    });
    byId("responses-learner-filter")?.addEventListener("change", (event) => {
      state.filters.responsesLearner = event.target.value;
      renderResponses();
    });
    byId("responses-guide-filter")?.addEventListener("change", (event) => {
      state.filters.responsesGuide = event.target.value;
      state.filters.responsesActivity = "";
      renderResponses();
    });
    byId("responses-activity-filter")?.addEventListener("change", (event) => {
      state.filters.responsesActivity = event.target.value;
      renderResponses();
    });
    byId("responses-status-filter")?.addEventListener("change", (event) => {
      state.filters.responsesStatus = event.target.value;
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
    byId("deliveries-from")?.addEventListener("change", (event) => {
      state.filters.deliveriesFrom = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-to")?.addEventListener("change", (event) => {
      state.filters.deliveriesTo = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-export-csv")?.addEventListener("click", () => {
      exportDeliveriesCsv();
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
    byId("deadline-apply-guide")?.addEventListener("click", handleDeadlineApplyToGuide);
    byId("deadline-clear-guide")?.addEventListener("click", handleDeadlineClearGuide);
    byId("reports-download-csv")?.addEventListener("click", () => downloadConsolidatedReport("csv"));
    byId("reports-download-json")?.addEventListener("click", () => downloadConsolidatedReport("json"));
    byId("admin-detail-export")?.addEventListener("click", () => {
      exportCurrentResponsesToWord();
    });
    byId("guide2-responses-export")?.addEventListener("click", () => {
      exportCurrentResponsesToWord();
    });
    // Modulo Notas: delegacion de eventos (filtros + selects de calificacion).
    byId("module-notas")?.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.id === "grades-ficha-filter") {
        // Cada ficha tiene sus propias guias (FICHA_MAP); el desplegable de guia se
        // reconstruye para esa ficha en vez de mostrar el catalogo completo.
        const guideSelect = byId("grades-guide-filter");
        if (guideSelect) {
          guideSelect.innerHTML = guideFilterOptionsMarkup(target.value, "");
          guideSelect.disabled = !target.value;
        }
        renderGradesGrid();
        return;
      }
      if (target && target.id === "grades-guide-filter") {
        renderGradesGrid();
        return;
      }
      const sel = target && target.closest ? target.closest(".grade-select") : null;
      if (sel) handleGradeChange(sel);
    });
    document.addEventListener("submit", async (event) => {
      if (event.target?.id === "edit-learner-form") {
        event.preventDefault();
        await handleAccountSubmit(event.target);
      }
      if (event.target?.id === "password-learner-form") {
        event.preventDefault();
        await handlePasswordSubmit(event.target);
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
      const saveActivityDeadline = event.target.closest("[data-save-activity-deadline]");
      if (saveActivityDeadline) {
        await handleSaveActivityDeadline(saveActivityDeadline);
        return;
      }
      const clearActivityDeadline = event.target.closest("[data-clear-activity-deadline]");
      if (clearActivityDeadline) {
        await handleClearActivityDeadline(clearActivityDeadline);
        return;
      }
      const responses = event.target.closest("[data-view-responses]");
      if (responses) {
        openResponses(responses.dataset.viewResponses, responses.dataset.guideFile, responses.dataset.activityId);
        return;
      }
      const activityResponse = event.target.closest("[data-view-activity-response]");
      if (activityResponse) {
        openResponses(activityResponse.dataset.viewActivityResponse, activityResponse.dataset.guideFile, activityResponse.dataset.activityId);
        return;
      }
      const exportResponse = event.target.closest("[data-export-activity-response]");
      if (exportResponse) {
        exportActivityResponse(exportResponse.dataset.exportActivityResponse, exportResponse.dataset.guideFile, exportResponse.dataset.activityId);
        return;
      }
      const reopenDelivery = event.target.closest("[data-reopen-delivery]");
      if (reopenDelivery) {
        await reopenDeliveredActivity(reopenDelivery);
        return;
      }
      const resetGuide = event.target.closest("[data-reset-guide]");
      if (resetGuide) {
        await handleResetGuide(resetGuide);
        return;
      }
      const resetAll = event.target.closest("[data-reset-all-user]");
      if (resetAll) {
        await handleResetAll(resetAll);
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
    byId("responses-learner-filter").innerHTML = '<option value="">Todos los aprendices</option>';
    byId("responses-activity-filter").innerHTML = '<option value="">Todas las actividades</option>';
    byId("deliveries-ficha-filter").innerHTML = getFichaOptions("", true);
    const nameAuditFichaSel = byId("name-audit-ficha");
    if (nameAuditFichaSel) nameAuditFichaSel.innerHTML = getFichaOptions("", false);
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
    // Carga inicial / recarga del panel: reutiliza el cache de sesion si esta fresco
    // (0 lecturas a Firestore). Las mutaciones y "Actualizar datos" bajan fresco.
    await loadUsers({ useCache: true });
  });
})();
