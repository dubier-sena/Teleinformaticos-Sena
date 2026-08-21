(function () {
  "use strict";

  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  const adminAudit = window.adminAudit || null;
  const adminExport = window.adminExport || null;

  if (!auth) return;

  const GUIDE2_SYSTEM_ACTIVITY_KEYS = ["sistemas332-locked"];
  const GUIDE2_COLLABORATIVE_ACTIVITY_KEYS = ["colaborativas334-locked"];
  const GUIDE2_TRANSFER_RETO_KEYS = ["transfer-reto-locked", "transferReto341-locked"];
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
    autorizaciones: "Autorizaciones de firma",
    habilitacion: "Habilitacion de actividades",
    notas: "Calificaciones",
    mejoramiento: "Planes de Mejoramiento",
    talleres: "Talleres de Refuerzo",
    laboratorio: "Laboratorio Virtual de Hardware",
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
    maybeAutoHydrateDashboard();
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
    const aliases = {
      "grupo-10a-guia-01-induccion.html": "guia_induccion_10a_guia_html",
      "grupo-10b-guia-01-induccion.html": "guia_induccion_10b_guia_html",
      "santa-barbara-10a-guia-02-redes-rap01.html": "guia_interactiva_sb_10a_redes_html",
      "santa-barbara-10b-guia-02-redes-rap01.html": "guia_interactiva_sb_10b_redes_html",
      "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia_interactiva_11b_guia_html",
      "grupo-11b-guia-06-planificar-informacion.html": "guia_interactiva_11b_guia6_html",
      "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia_interactiva_11b_guia7_html",
      "grupo-11b-guia-08-documentar-gestion-informacion.html": "guia_interactiva_11b_guia8_html",
      "grupo-11b-guia-09-taller-integrador.html": "guia_interactiva_11b_guia9_html",
    };
    // Los alias con clave COMPLETA ("guia_...") son la fuente de verdad real del
    // localStorage de la guia (ver STORAGE_KEY en script_induccion.js y
    // LEGACY_STORAGE_KEY_REDES en script_guia_redes.js: Redes RAP01 guarda bajo
    // su archivo-alias sb_10{a,b}_redes.html, no bajo el stateKey registrado en
    // guide_declarations.js, que ademas es el mismo para 10A y 10B). Tienen
    // PRIORIDAD sobre ActivityStandard/GUIDE_PROGRESS_CONFIG: Induccion registra
    // en guide_declarations.js un stateKey CORTO ("10a_guia", pensado para el
    // prefijo de progreso "10a_guia:checks"), NO la clave completa del estado
    // guardado. Si se prioriza ese valor corto, Respuestas y la hidratacion
    // leen/escriben en una clave que el aprendiz nunca usa -> siempre en blanco
    // aunque el aprendiz SI tenga respuestas guardadas (bug encontrado jul-3
    // depurando en vivo: el boton "Ver" no se veia afectado porque lee directo
    // de la nube por otra ruta que no pasa por esta funcion).
    if (aliases[fileName] && /^guia_/.test(aliases[fileName])) return aliases[fileName];
    const configured = window.ActivityStandard?.getStateKeyForGuide?.(fileName) ||
      auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey ||
      "";
    if (configured) return configured;
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

  // Tarjeta "Entregas recientes" del dashboard: debe auto-hidratarse al iniciar
  // sesion (para que el admin vea alertas frescas sin entrar antes a Respuestas
  // o Entregas), pero sin repetir el barrido pesado (N aprendices x M guias)
  // cada vez que se abre/recarga el panel -- eso fue justo lo que ae86612 evito.
  // Se guarda la marca de tiempo en localStorage (sobrevive recargas) y se
  // limita a una vez cada 30 minutos por navegador.
  const DASHBOARD_HYDRATE_THROTTLE_KEY = "sena_admin_dashboard_hydrate_last_v1";
  const DASHBOARD_HYDRATE_THROTTLE_MS = 30 * 60 * 1000;

  function markDashboardHydrateNow() {
    try { localStorage.setItem(DASHBOARD_HYDRATE_THROTTLE_KEY, String(Date.now())); } catch (_) { /* sin localStorage */ }
  }

  function isDashboardHydrateThrottled() {
    try {
      const last = Number(localStorage.getItem(DASHBOARD_HYDRATE_THROTTLE_KEY)) || 0;
      return (Date.now() - last) < DASHBOARD_HYDRATE_THROTTLE_MS;
    } catch (_) {
      return false;
    }
  }

  function maybeAutoHydrateDashboard() {
    if (state.activeModule !== "dashboard") return;
    if (guideStatesHydrated || isDashboardHydrateThrottled()) return;
    ensureGuideStatesHydrated()
      .then((changed) => {
        if (state.activeModule === "dashboard" && changed) renderRecentDeliveries();
      })
      .catch(() => {});
  }

  async function ensureGuideStatesHydrated() {
    if (guideStatesHydrated) return false;
    // Recupera la cuota de localStorage que sesiones anteriores llenaron con el
    // guide-data de aprendices (ahora se cachea en memoria, ver helpers arriba).
    purgeStudentGuideDataFromLocal();
    const db = window._firebaseDb;
    if (!db || typeof db.cloudGetGuideData !== "function" || typeof auth.getStudentStorageKey !== "function") {
      guideStatesHydrated = true; // sin nube no hay nada que bajar; no reintentar cada render
      markDashboardHydrateNow();
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
        // NO se usa skipDriveOn404 aqui: verificado en vivo (jul-9) que un 404
        // de Firestore NO es un miss real -- el guide-state de sena_portal_guide_state
        // es una coleccion Drive-primaria para lecturas de aprendices (ver
        // DRIVE_PRIMARY_COLLECTIONS en firebase_db.js), asi que Firestore
        // frecuentemente esta vacio/desactualizado aunque el aprendiz SI haya
        // guardado (confirmado: el boton "Ver" puntual, que si prueba Drive,
        // mostraba la respuesta real mientras la tabla masiva marcaba
        // "sin-respuesta" para las 3 fichas de caso). Se prefiere exactitud
        // sobre velocidad -- este barrido es soporte de documentacion oficial.
        // EXCEPCION: si la recuperacion Drive→Firestore ya corrio en este
        // navegador (boton "Recuperar datos de Drive" / backfillFromDrive),
        // Firestore vuelve a ser fuente completa y un 404 SI es un miss real:
        // se salta el viaje a Drive (10-25s por doc bajo carga) y el barrido
        // pasa de minutos a segundos.
        const promotionDone = typeof db.isDrivePromotionDone === "function" && db.isDrivePromotionDone();
        const cloudSnapshot = await db.cloudGetGuideData(
          getStudentCloudScope(task.usernameKey),
          task.cloudFileName,
          promotionDone ? { skipDriveOn404: true } : undefined
        );
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
    markDashboardHydrateNow();
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
      // "checklist:" = los 15 items de la Lista de verificacion de competencias
      // digitales (digitalCompetencyChecklist en script_guia2.js), que se
      // guardan junto con la tabla comparativa en la MISMA actividad 3.3.4.
      colaborativas334: ["collab:", "checklist:"],
      transferReto341: ["transfer-reto-"],
      // Actividad 9 (3.3.5 Ciberseguridad): 4 sub-secciones, cada una con su
      // propio prefijo namespaced (ver CIBERSEG_335_SECTIONS en script_guia2.js).
      // Sin estos alias, keyMatchesActivity() nunca las encontraba y el admin
      // veia "Sin respuesta" en las 4, aunque el aprendiz si las hubiera guardado.
      cibersegAmenazas335: ["ciberseg:amenazas:"],
      cibersegGuia335: ["ciberseg:guia:"],
      cibersegPhishing335: ["ciberseg:phishing:"],
      cibersegChecklist335: ["ciberseg:checklist:"],
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
          ${summary.delivery?.note ? `<tr><th>Nota</th><td>${escapeHtml(summary.delivery.note)}</td></tr>` : ""}
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
    // La hidratacion pesada del guide_state (N aprendices x M guias) no se
    // repite en cada carga del panel para no acercar la cuota diaria gratis al
    // limite: al abrir Respuestas/Entregas corre bajo demanda (ver setActiveModule),
    // y para la tarjeta "Entregas recientes" del dashboard corre sola pero
    // limitada a una vez cada 30 min por navegador (ver maybeAutoHydrateDashboard).
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

  // ── Recuperacion Drive → Firestore ──────────────────────────────────────
  // Boton del panel Configuracion. Promueve los docs de aprendices que quedaron
  // SOLO en Drive (periodo de reglas rechazando docIds compuestos) a Firestore.
  let promoteRunning = false;
  async function runPromoteFromDrive() {
    if (promoteRunning) return;
    const btn = byId("btn-promote-drive");
    const status = byId("promote-status");
    const fb = window._firebaseDb;

    function show(message, color) {
      if (!status) return;
      status.style.display = "block";
      status.style.color = color || "var(--admin-text, #102117)";
      status.textContent = message;
    }

    if (!fb || typeof fb.backfillFromDrive !== "function") {
      show("El modulo de recuperacion no esta disponible. Recarga la pagina (Ctrl+Shift+R).", "#b91c1c");
      return;
    }

    promoteRunning = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Recuperando...";
    }
    show("Recorriendo aprendices y guias. Esto puede tardar varios minutos. No cierres esta pestana.", "#1f7a8c");

    try {
      const report = await fb.backfillFromDrive({
        users: state.users,
        onProgress: (p) => show(
          "Revisando " + p.done + " de " + p.total + " documentos (" + p.promoted + " promovidos, " + p.errors + " errores)...",
          "#1f7a8c"
        ),
      });
      if (report && report.ok) {
        show(
          "Recuperacion completada: " + report.promoted + " promovidos a Firestore, " +
          report.skipped + " ya estaban al dia, " + report.missing + " sin datos en Drive" +
          (report.errors ? ", " + report.errors + " errores (vuelve a ejecutar)" : "") + ".",
          report.errors ? "#b45309" : "#15803d"
        );
        invalidateUsersCache();
      } else {
        show("No se pudo recuperar: " + ((report && report.message) || "error desconocido") + ".", "#b91c1c");
      }
    } catch (error) {
      show("Error durante la recuperacion: " + ((error && error.message) || error) + ".", "#b91c1c");
    } finally {
      promoteRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Recuperar datos de Drive";
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
    if (moduleName === "talleres") {
      renderReinforcementWorkshops();
    }
    if (moduleName === "autorizaciones") {
      renderSignatureAuth();
    }
    if (moduleName === "configuracion") {
      renderAuditPanel();
    }
    if (moduleName === "laboratorio") {
      renderHardwareLabPanel();
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

  // ── Laboratorio Virtual de Hardware (item 37) ─────────────────────────────
  // Modulo aislado en su propio archivo (js/admin_hardware_lab.js), igual
  // patron que adminHabilitacion: este hook solo monta el host y le pasa
  // datos + dependencias, sin logica propia aqui (minimiza el riesgo de
  // tocar este archivo tan grande).
  function renderHardwareLabPanel() {
    const host = byId("hwlab-admin-host");
    if (!host) return;
    const mod = window.adminHardwareLab;
    if (!mod || typeof mod.mount !== "function") {
      host.innerHTML = '<p class="activities-empty">Modulo adminHardwareLab no disponible.</p>';
      return;
    }
    mod.mount(host, {
      auth,
      db: window._firebaseDb,
      users: state.users || [],
    });
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
    if (!fam) return null;
    // Una columna con aliasIds califica tambien sus actividades gemelas: la
    // solucion embebida combina el banco del id dueño y el de cada alias (ej.
    // cibersegAmenazas335 lleva tambien guia/phishing/checklist). Sin esto, al
    // aprobar la Actividad 9 solo viajaban los 2 campos de "amenazas".
    const act = (((getGradeCatalog()[guideFamily] || {}).activities) || [])
      .find((a) => a.id === activityId);
    const ids = [activityId].concat((act && act.aliasIds) || []);
    const combined = {};
    let found = false;
    ids.forEach((id) => {
      const entry = fam[id];
      if (entry && typeof entry === "object" && Object.keys(entry).length) {
        found = true;
        Object.assign(combined, entry);
      }
    });
    return found ? combined : null;
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
  // Refresca el cache en memoria (Respuestas/Ver) y state.users (Progreso
  // individual/dashboard) tras una escritura admin->aprendiz, sin esperar una
  // recarga del panel. Compartido por el relleno de banco y el fallback de
  // entrega manual (ambos devuelven {ok, state, progress} con la misma forma).
  function applyGuideWriteSideEffects(usernameKey, fileName, result) {
    if (result && result.ok && result.state) {
      const config = getGuideCloudConfig(fileName);
      if (config && config.stateKey && typeof auth.getStudentStorageKey === "function") {
        const storageKey = auth.getStudentStorageKey(usernameKey, config.stateKey, { area: "guide-data" });
        guideDataCacheSet(storageKey, result.state, { updatedAt: new Date().toISOString(), updatedBy: "admin-grade-fill" });
      }
    }
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
  }

  async function applyApprovedSolutionToStudentCloud(usernameKey, guideFamily, solution) {
    const db = window._firebaseDb;
    if (!db || typeof db.adminApplySolutionToGuide !== "function" || !solution) return { filled: 0 };
    const fileName = resolveStudentGuideFileForFamily(usernameKey, guideFamily);
    if (!fileName) return { filled: 0 };
    const result = await db.adminApplySolutionToGuide(usernameKey, fileName, solution);
    applyGuideWriteSideEffects(usernameKey, fileName, result);
    return { filled: (result && result.filled) || 0 };
  }

  // Actividades registradas como "form" con fieldPrefixes en guide_declarations.js
  // pero cuyos campos reales son CHECKBOXES (booleanos), no texto: el banco NUNCA
  // podria rellenarlas (no hay texto que copiar en un checkbox) y tampoco son una
  // entrega de archivo real. Se tratan igual que type:"file" (fallback de
  // entrega). Lista curada a mano revisando el HTML/script real de la guia (no
  // hay forma generica de saber el tipo de <input> desde el catalogo).
  const CHECKBOX_ONLY_ACTIVITY_IDS = new Set([
    "plataformas334", // grupo-10a/10b-guia-01-induccion: plataforma:{slug}:acceso/evidencia
  ]);

  // Actividades de archivo/checkbox (sin campo de texto que el banco pueda
  // rellenar, p. ej. "Analisis de simbolos SENA" o "Portafolio de evidencias"):
  // el aprendiz puede haberlas entregado por un medio distinto al portal. Al
  // aprobar sin entrega real registrada, se marca como entregada con la fecha
  // de hoy y una nota de que fue el instructor quien la registro asi. Pedido
  // explicito del usuario 2026-07-03.
  function activityNeedsDeliveryFallback(fileName, activityId) {
    if (CHECKBOX_ONLY_ACTIVITY_IDS.has(activityId)) return true;
    const config = window.ActivityStandard?.getConfigForGuide?.(fileName);
    const act = config && Array.isArray(config.activities)
      ? config.activities.find((a) => a.id === activityId)
      : null;
    if (!act) return false;
    if (act.type === "file") return true;
    const hasTrackableFields = (act.formFields && act.formFields.length) || (act.fieldPrefixes && act.fieldPrefixes.length);
    return act.type === "form" && !hasTrackableFields;
  }

  // Algunas actividades type:"file" (p.ej. los laboratorios de Redes: lab1/2/3)
  // tienen ADEMAS campos de texto con solucion propia en el banco (la reflexion
  // del laboratorio) separados de la evidencia fotografica obligatoria ("Subir
  // pantallazo" por item). Rellenar el texto NO cubre esa evidencia -- sin este
  // chequeo, el fallback de entrega (que es lo que marca "-locked" y hace que
  // los botones de pantallazo muestren "Evidencia cargada") se saltaba siempre
  // que el banco lograba rellenar algo, dejando los botones de evidencia como
  // si nunca se hubiera aprobado la actividad. Pedido explicito del usuario
  // 2026-07-23.
  function isDeclaredFileType(fileName, activityId) {
    const config = window.ActivityStandard?.getConfigForGuide?.(fileName);
    const act = config && Array.isArray(config.activities)
      ? config.activities.find((a) => a.id === activityId)
      : null;
    return Boolean(act && act.type === "file");
  }

  async function applyDeliveryFallbackToStudentCloud(usernameKey, guideFamily, activityId) {
    const db = window._firebaseDb;
    if (!db || typeof db.adminMarkActivityDelivered !== "function") return { filled: 0 };
    const fileName = resolveStudentGuideFileForFamily(usernameKey, guideFamily);
    if (!fileName || !activityNeedsDeliveryFallback(fileName, activityId)) return { filled: 0 };
    const result = await db.adminMarkActivityDelivered(usernameKey, fileName, activityId);
    applyGuideWriteSideEffects(usernameKey, fileName, result);
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

    // El selector de motivo solo tiene sentido junto a "No aprobado". Al
    // salir de "D" (aprobado o sin nota) se oculta y se borra cualquier
    // motivo guardado -- no tiene sentido conservar "no entrego a tiempo"
    // sobre una actividad ya aprobada.
    const reasonSelect = select.closest(".grade-cell")?.querySelector(".grade-reason-select");
    if (reasonSelect) {
      if (nextGrade === "D") {
        reasonSelect.hidden = false;
      } else {
        reasonSelect.hidden = true;
        reasonSelect.value = "";
        try { gradesManager.setStudentActivityObservation(usernameKey, guideFamily, activityId, ""); } catch (e) { /* no critico */ }
      }
    }

    // Calificar cambia el avance del aprendiz en la nube: invalida el cache de la
    // lista para que al recargar el panel se vea el % actualizado (no el cacheado).
    invalidateUsersCache();

    recordAdminAuditAction({ action: "grade-change", target: `${usernameKey}:${guideFamily}:${activityId}`, detail: nextGrade || "sin nota" });

    // Escribe las respuestas + avance en el estado del aprendiz en la nube (best-effort;
    // si falla, el aprendiz igual las rellena al abrir la guia). `filled` refleja lo que
    // REALMENTE se escribio (0 si ya tenia respuestas, o si la escritura fallo) para que
    // el mensaje de abajo no afirme un "aplicado" que no ocurrio.
    let filled = 0;
    let delivered = false;
    if (nextGrade === "A" && solution) {
      try {
        const applyResult = await applyApprovedSolutionToStudentCloud(usernameKey, guideFamily, solution);
        filled = (applyResult && applyResult.filled) || 0;
      } catch (e) { /* no critico */ }
    }
    // Si no habia banco (o no rellenaba nada) y es una actividad de archivo/checkbox
    // sin campo de texto, se registra como entregada (fecha de hoy + nota del
    // instructor) en vez de dejarla en "sin-respuesta" para siempre. Para
    // actividades type:"file" con solucion de texto PROPIA (laboratorios: la
    // reflexion no cubre la evidencia fotografica obligatoria) se intenta
    // siempre, no solo cuando no se relleno nada.
    const fileNameForFallback = resolveStudentGuideFileForFamily(usernameKey, guideFamily);
    if (nextGrade === "A" && (filled === 0 || isDeclaredFileType(fileNameForFallback, activityId))) {
      try {
        const deliverResult = await applyDeliveryFallbackToStudentCloud(usernameKey, guideFamily, activityId);
        delivered = ((deliverResult && deliverResult.filled) || 0) > 0;
      } catch (e) { /* no critico */ }
    }

    const msg = nextGrade
      ? "Calificacion guardada." + (filled > 0 ? " Respuestas y avance aplicados." : delivered ? " Entrega registrada." : "")
      : "Calificacion borrada.";
    window.portalSaveStatus?.saved(msg);
    setFeedback(msg, "success");
  }

  // Guarda el motivo elegido para una actividad "No aprobado". Los dos motivos
  // predeterminados van directo; "Otro" pide el texto con un prompt nativo
  // (mismo patron ya usado en otras partes del portal, p. ej. confirmaciones
  // de entrega) para no armar un modal nuevo solo para esto.
  async function handleGradeReasonChange(select) {
    const usernameKey = select.dataset.gradeUser || "";
    const guideFamily = select.dataset.gradeFamily || "";
    const activityId = select.dataset.gradeActivity || "";
    const gradesManager = window.activityGradesManager;
    if (!gradesManager || !usernameKey || !guideFamily || !activityId) return;

    const code = select.value || "";
    let message = "";
    if (code === "custom") {
      const custom = window.prompt("Escribe el motivo (el aprendiz lo vera junto a su calificacion):", "");
      if (custom == null) {
        select.value = "";
        return; // el instructor cancelo el prompt
      }
      message = custom.trim();
    } else if (code) {
      message = GRADE_REJECTION_REASONS[code] || "";
    }

    window.portalSaveStatus?.saving("Guardando motivo...");
    try {
      gradesManager.setStudentActivityObservation(usernameKey, guideFamily, activityId, message);
      window.portalSaveStatus?.saved(message ? "Motivo guardado." : "Motivo borrado.");
    } catch (err) {
      window.portalSaveStatus?.error("Error al guardar el motivo.");
      setFeedback("Error al guardar el motivo: " + (err && err.message ? err.message : err), "error");
    }
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

  // Actualizaciones necesarias para que las notas "A" YA guardadas de un aprendiz
  // queden con la solucion ACTUAL del banco embebida: faltante si se califico antes
  // de importar el banco a Firestore, desactualizada si el banco crecio despues
  // (ej. checklist de competencias digitales, jul-15). Recorre las llaves de la
  // NOTA (no el catalogo), igual que applyApprovedSolutionsForFamily las lee, asi
  // cubre tambien notas guardadas bajo un aliasId (ej. fichaCaso). Pura: sin red
  // ni DOM, para poder probarla.
  function computeSolutionResyncUpdates(allGrades, bankLookup) {
    const updates = [];
    Object.keys(allGrades || {}).forEach((family) => {
      const grades = allGrades[family] || {};
      Object.keys(grades).forEach((actId) => {
        if (actId.indexOf(":") !== -1) return;          // saltar :solution/:gradedAt/:obs
        if (grades[actId] !== "A") return;              // solo aprobadas
        const solution = bankLookup(family, actId);
        if (!solution || typeof solution !== "object" || !Object.keys(solution).length) return;
        const current = grades[actId + ":solution"];
        // needsEmbed=false NO se descarta: la escritura de los campos en la guia
        // del aprendiz (applyApprovedSolutionToStudentCloud) pudo fallar en una
        // pasada anterior dejando "solucion embebida pero guia vacia" (caso real
        // jul-15, Actividad 10). Es idempotente, asi que se reintenta siempre.
        const needsEmbed = !(current && JSON.stringify(current) === JSON.stringify(solution));
        updates.push({ family: family, activityId: actId, solution: solution, needsEmbed: needsEmbed });
      });
    });
    return updates;
  }

  async function handleSolutionResync() {
    const statusEl = byId("grades-resync-status");
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    const db = window._firebaseDb;
    const gradesManager = window.activityGradesManager;
    if (!db || typeof db.cloudGetGrades !== "function" || !gradesManager ||
        typeof gradesManager.embedStudentActivitySolution !== "function") {
      setStatus("Firestore o el modulo de notas no estan disponibles.");
      return;
    }
    const confirmed = await confirmAdminAction(
      "Re-sincronizar soluciones: a cada actividad YA APROBADA cuya solucion embebida falte o " +
      "este desactualizada se le copiara la respuesta modelo del banco actual. No cambia " +
      "ninguna nota ni su fecha. ¿Continuar?"
    );
    if (!confirmed) return;
    const btn = byId("grades-resync-btn");
    if (btn) btn.disabled = true;
    try {
      await ensureGradeSolutionsBank(true);
      const students = state.users.filter((user) => String(user.ficha || "").trim());
      setStatus(`Revisando ${students.length} aprendices...`);
      let learners = 0, embedded = 0, fieldsFilled = 0, failures = 0;
      for (const user of students) {
        let all = null;
        try { all = await db.cloudGetGrades(user.usernameKey); } catch (_) { failures++; continue; }
        if (!all || typeof all !== "object") continue;
        // Sincroniza el cache local ANTES de re-guardar: saveGradesToCloud reemplaza
        // el doc completo (mismo cuidado que renderGradesGrid).
        gradesManager.setAllStudentGrades?.(user.usernameKey, all);
        const updates = computeSolutionResyncUpdates(all, lookupBankSolution);
        if (!updates.length) continue;
        learners += 1;
        const fieldsByFamily = {};
        for (const up of updates) {
          try {
            if (up.needsEmbed) {
              const ok = gradesManager.embedStudentActivitySolution(user.usernameKey, up.family, up.activityId, up.solution);
              if (ok) embedded += 1;
            }
            fieldsByFamily[up.family] = Object.assign(fieldsByFamily[up.family] || {}, up.solution);
          } catch (_) { failures++; }
        }
        // Una sola escritura de campos por guia: fusiona las soluciones de todas
        // las actividades "A" de la familia; en la nube solo se llenan los campos
        // que el aprendiz tenga vacios (y si no hay nada que llenar, no escribe).
        for (const family of Object.keys(fieldsByFamily)) {
          try {
            const applied = await applyApprovedSolutionToStudentCloud(user.usernameKey, family, fieldsByFamily[family]);
            fieldsFilled += (applied && applied.filled) || 0;
          } catch (_) { failures++; }
        }
        setStatus(`... ${embedded} soluciones re-embebidas, ${fieldsFilled} campos escritos (${learners} aprendices con actividades aprobadas)`);
      }
      setStatus(
        `Listo: ${embedded} soluciones re-embebidas en ${learners} aprendices; ` +
        `${fieldsFilled} campos escritos en sus guias.` +
        (failures ? ` ${failures} errores (vuelve a intentarlo mas tarde).` : "")
      );
      recordAdminAuditAction({ action: "grade-solutions-resync", target: "all", detail: `${embedded} soluciones / ${learners} aprendices` });
    } finally {
      if (btn) btn.disabled = false;
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

  // Motivos predeterminados al marcar "No aprobado" (pedido explicito del
  // usuario 2026-07-09): evita que cada instructor escriba el motivo a mano
  // cada vez. Se guarda con setStudentActivityObservation (activity_grades.js)
  // -- ya existia esa funcion pero no estaba conectada a ninguna UI -- y el
  // aprendiz lo ve junto al badge "No aprobado" (buildGradeBadge).
  const GRADE_REJECTION_REASONS = {
    "no-entrego-tiempo": "No entregó la actividad en los tiempos establecidos.",
    "no-entrego-como-solicitado": "No entregó la actividad como se solicitó en la guía.",
  };

  function gradeSelectMarkup(usernameKey, guideFamily, activityId, current, currentObs) {
    const cur = current || "";
    function opt(value, label) {
      return `<option value="${value}"${cur === value ? " selected" : ""}>${label}</option>`;
    }
    const reasonCode = Object.keys(GRADE_REJECTION_REASONS).find((code) => GRADE_REJECTION_REASONS[code] === currentObs)
      || (currentObs ? "custom" : "");
    function reasonOpt(value, label) {
      return `<option value="${value}"${reasonCode === value ? " selected" : ""}>${label}</option>`;
    }
    const gradeSelect = `<select class="grade-select" data-grade-user="${escapeHtml(usernameKey)}" `
      + `data-grade-family="${escapeHtml(guideFamily)}" data-grade-activity="${escapeHtml(activityId)}" `
      + `data-previous-grade="${escapeHtml(cur)}" aria-label="Calificacion">`
      + opt("", "&mdash;") + opt("A", "Aprobado") + opt("D", "No aprobado") + `</select>`;
    const reasonSelect = `<select class="grade-reason-select" data-grade-user="${escapeHtml(usernameKey)}" `
      + `data-grade-family="${escapeHtml(guideFamily)}" data-grade-activity="${escapeHtml(activityId)}" `
      + `aria-label="Motivo de no aprobado"${cur === "D" ? "" : " hidden"}>`
      + reasonOpt("", "Motivo (opcional)")
      + reasonOpt("no-entrego-tiempo", "No entregó a tiempo")
      + reasonOpt("no-entrego-como-solicitado", "No entregó como se solicitó")
      + reasonOpt("custom", "Otro (escribir)…")
      + `</select>`;
    return `<div class="grade-cell">${gradeSelect}${reasonSelect}</div>`;
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
        <hr>
        <p class="admin-muted">Las actividades aprobadas ANTES de importar el banco (o antes de una ampliacion del banco) quedaron sin la solucion embebida: se ven "calificadas pero vacias". Este boton copia la solucion actual a todas esas notas "A", de todos los aprendices, sin cambiar notas ni fechas.</p>
        <button type="button" id="grades-resync-btn" class="btn secondary">Re-sincronizar soluciones de actividades aprobadas</button>
        <span id="grades-resync-status" class="admin-muted"></span>
      </details>
      <div class="grades-manual__filters">
        <select id="grades-ficha-filter">${getFichaOptions("", false)}</select>
        <select id="grades-guide-filter" disabled>${guideFilterOptionsMarkup("", "")}</select>
      </div>
      <details class="grades-bank-import">
        <summary>Calificar en bloque con Excel</summary>
        <p class="admin-muted">Elige ficha y guia arriba, descarga el Excel con el listado de aprendices activos y una columna por actividad, califica escribiendo <strong>A</strong> (Aprobado) o <strong>D</strong> (No aprobado) en las celdas, y sube el archivo de vuelta. Las celdas que dejes en blanco no tocan la calificacion que ya exista. No edites la columna "Usuario" ni los encabezados: se usan para identificar al aprendiz y la actividad.</p>
        <button type="button" id="grades-excel-download-btn" class="btn secondary">Descargar Excel</button>
        <span id="grades-excel-download-status" class="admin-muted"></span>
        <hr>
        <input type="file" id="grades-excel-file" accept=".xlsx,.xls">
        <button type="button" id="grades-excel-upload-btn" class="btn secondary">Subir Excel calificado</button>
        <span id="grades-excel-upload-status" class="admin-muted"></span>
      </details>
      <p class="grades-scroll-hint" id="grades-scroll-hint" hidden>&#8596; Esta guia tiene varias actividades: desliza la tabla horizontalmente para verlas todas. La columna "Aprendiz" y "Aprobadas" quedan siempre visibles.</p>
      <div id="grades-grid" class="grades-grid"></div>
    `;
    ensureGradeSolutionsBank();   // precarga el banco para aplicar soluciones al aprobar
    byId("grades-bank-import-btn")?.addEventListener("click", handleGradeBankImport);
    byId("grades-resync-btn")?.addEventListener("click", handleSolutionResync);
    byId("grades-excel-download-btn")?.addEventListener("click", handleGradesExcelDownload);
    byId("grades-excel-upload-btn")?.addEventListener("click", handleGradesExcelUpload);
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
          // Sincroniza el cache local con el doc COMPLETO de la nube antes de leer la
          // familia actual. Sin esto, un edit posterior (setStudentActivityGradeAndSolution)
          // lee un cache local desactualizado/incompleto (p. ej. de otro equipo) y al
          // guardar hace un reemplazo completo del doc en la nube, borrando notas de otras
          // guias (o de esta misma) que nunca llegaron a este localStorage.
          if (all && window.activityGradesManager && window.activityGradesManager.setAllStudentGrades) {
            window.activityGradesManager.setAllStudentGrades(user.usernameKey, all);
          }
          g = (all && all[guideFamily]) || {};
        } catch (_) { /* sin nube: cae a cache local */ }
      }
      if (!Object.keys(g).length && window.activityGradesManager) {
        g = window.activityGradesManager.getStudentGrades(user.usernameKey, guideFamily) || {};
      }
      gradesByUser[user.usernameKey] = g;
    }));
    const head = "<th>Aprendiz</th>" + activities.map((a) => `<th>${escapeHtml(a.label)}</th>`).join("") + "<th>Aprobadas</th>";
    // resolveGradeValue cae a aliasIds: una fila fusionada (ej. matriz322+fichaCaso)
    // sigue mostrando una nota que haya quedado guardada bajo el id del alias
    // antes de la fusion, en vez de aparecer vacia.
    const resolveGrade = (window.activityGradesManager && window.activityGradesManager.resolveGradeValue)
      || ((g, a) => g[a.id]);
    const rows = students.map((user) => {
      const g = gradesByUser[user.usernameKey] || {};
      const cells = activities.map((a) =>
        `<td>${gradeSelectMarkup(user.usernameKey, guideFamily, a.id, resolveGrade(g, a), g[a.id + ":obs"])}</td>`
      ).join("");
      const approved = activities.filter((a) => resolveGrade(g, a) === "A").length;
      return `<tr data-grade-row="${escapeHtml(user.usernameKey)}"><td>${escapeHtml(user.fullName)}</td>${cells}`
        + `<td class="grades-approved-cell">${approvalCellText(approved, activities.length)}</td></tr>`;
    }).join("");
    const scrollHintEl = byId("grades-scroll-hint");
    if (scrollHintEl) scrollHintEl.hidden = activities.length <= 5;
    grid.innerHTML = `<table class="admin-data-table grades-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ── Calificar en bloque con Excel ────────────────────────────────────────────
  // Descarga/sube el mismo par (ficha, guia) que la grilla manual de arriba, y
  // escribe con las MISMAS funciones que usa handleGradeChange (setStudentGrades
  // + embebido de solucion del banco + fallback de entrega) para que una nota
  // puesta por Excel se comporte identico a una puesta a mano, actividad por
  // actividad. La columna "Usuario" (usernameKey) es la llave de emparejamiento
  // -- nunca por nombre -- para evitar el tipo de ambiguedad que tuvo el import
  // por Excel anterior (removido 2026-06-20).

  function currentGradesFichaAndFamily() {
    const ficha = byId("grades-ficha-filter")?.value || "";
    const guideFamily = byId("grades-guide-filter")?.value || "";
    return { ficha, guideFamily };
  }

  async function handleGradesExcelDownload() {
    const statusEl = byId("grades-excel-download-status");
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    if (typeof window.XLSX === "undefined") { setStatus("La libreria de Excel no cargo."); return; }
    const { ficha, guideFamily } = currentGradesFichaAndFamily();
    const catalog = getGradeCatalog();
    const entry = catalog[guideFamily];
    if (!ficha || !guideFamily || !entry) { setStatus("Elige ficha y guia arriba primero."); return; }
    const activities = entry.activities || [];
    const students = getUsersForFicha(ficha).filter((u) => !isInactive(u));
    if (!students.length) { setStatus("No hay aprendices activos en esta ficha."); return; }
    setStatus("Generando Excel...");
    const db = window._firebaseDb;
    const resolveGrade = (window.activityGradesManager && window.activityGradesManager.resolveGradeValue) || ((g, a) => g[a.id]);
    const gradesByUser = {};
    await Promise.all(students.map(async (user) => {
      let g = {};
      if (db && typeof db.cloudGetGrades === "function") {
        try {
          const all = await db.cloudGetGrades(user.usernameKey);
          g = (all && all[guideFamily]) || {};
        } catch (_) { /* cae a cache local */ }
      }
      if (!Object.keys(g).length && window.activityGradesManager) {
        g = window.activityGradesManager.getStudentGrades(user.usernameKey, guideFamily) || {};
      }
      gradesByUser[user.usernameKey] = g;
    }));
    // Nombre completo primero (lo que el instructor reconoce a simple vista);
    // Usuario queda visible pero en segundo lugar -- sigue siendo la llave real
    // de emparejamiento al subir, sin importar el orden de las columnas.
    const sortedStudents = students.slice().sort((a, b) =>
      String(a.fullName || "").localeCompare(String(b.fullName || ""), "es"));
    // Encabezado = id corto de la actividad (max ~19 caracteres en todo el
    // catalogo), no la etiqueta completa (algunas pasan de 40-50 caracteres,
    // ej. "Producto 6 - Informe de impacto (entrega final)"): con la etiqueta
    // completa la columna queda angosta y el texto se corta, o hay que hacer
    // columnas tan anchas que la tabla deja de caber en pantalla y es facil
    // perderse calificando. La hoja "Leyenda" trae el id -> descripcion.
    const header = ["Nombre completo", "Usuario", "% Aprobado", ...activities.map((a) => a.id)];
    const rows = [header];
    sortedStudents.forEach((user) => {
      const g = gradesByUser[user.usernameKey] || {};
      const values = activities.map((a) => resolveGrade(g, a) || "");
      const approved = values.filter((v) => v === "A").length;
      const pct = activities.length ? Math.round((approved / activities.length) * 100) : 0;
      rows.push([user.fullName, user.usernameKey, `${pct}%`, ...values]);
    });
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, ...activities.map(() => ({ wch: 15 }))];
    ws["!autofilter"] = { ref: window.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: header.length - 1 } }) };

    // Hoja de instrucciones + leyenda aparte, para no ensuciar la hoja de datos
    // (la libreria Excel de este proyecto es la version gratuita: no soporta
    // negrita, colores ni congelar paneles al escribir, asi que la organizacion
    // se hace con estructura -- hojas separadas, autofiltro, columnas cortas y
    // ordenadas -- en vez de formato visual).
    const instructions = window.XLSX.utils.aoa_to_sheet([
      [`Calificar en bloque -- ${entry.label || guideFamily} -- Ficha ${ficha}`],
      [""],
      ["Como usar este archivo:"],
      ["1. En la hoja \"Calificaciones\", escribe A (Aprobado) o D (No aprobado) en las celdas de cada actividad."],
      ["2. Deja en blanco las celdas que no quieras cambiar: la calificacion que ya exista no se toca."],
      ["3. No edites la columna \"Usuario\" ni los encabezados de las actividades: se usan para identificar al aprendiz y la actividad al subir el archivo."],
      ["4. Los encabezados de actividad son un codigo corto, no el nombre completo (para que la tabla no quede tan ancha). Revisa la hoja \"Leyenda\" para ver a que actividad corresponde cada codigo."],
      ["5. La columna \"% Aprobado\" es solo informativa (se recalcula sola en el portal); no hace falta editarla."],
      ["6. Guarda el archivo y subelo en el panel admin: Calificaciones > Calificar en bloque con Excel > Subir Excel calificado."],
      [""],
      [`Generado: ${new Date().toLocaleString("es-CO")}`],
      [`Aprendices activos: ${sortedStudents.length}    Actividades: ${activities.length}`],
    ]);
    instructions["!cols"] = [{ wch: 100 }];

    const legendRows = [["Codigo (encabezado en Calificaciones)", "Actividad completa"]];
    activities.forEach((a) => legendRows.push([a.id, a.label]));
    const legend = window.XLSX.utils.aoa_to_sheet(legendRows);
    legend["!cols"] = [{ wch: 22 }, { wch: 60 }];
    legend["!autofilter"] = { ref: window.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: legendRows.length - 1, c: 1 } }) };

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, instructions, "Instrucciones");
    window.XLSX.utils.book_append_sheet(wb, legend, "Leyenda");
    window.XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    const safeName = (entry.label || guideFamily).replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
    window.XLSX.writeFile(wb, `Calificaciones_${ficha}_${safeName}.xlsx`);
    setStatus(`Descargado: ${sortedStudents.length} aprendices, ${activities.length} actividades.`);
  }

  async function handleGradesExcelUpload() {
    const statusEl = byId("grades-excel-upload-status");
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    if (typeof window.XLSX === "undefined") { setStatus("La libreria de Excel no cargo."); return; }
    const fileInput = byId("grades-excel-file");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) { setStatus("Elige el archivo Excel calificado primero."); return; }
    const { ficha, guideFamily } = currentGradesFichaAndFamily();
    const catalog = getGradeCatalog();
    const entry = catalog[guideFamily];
    if (!ficha || !guideFamily || !entry) { setStatus("Elige ficha y guia arriba primero (las mismas del Excel)."); return; }
    const activities = entry.activities || [];

    let rows;
    try {
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      // La hoja de datos se llama "Calificaciones" (handleGradesExcelDownload
      // agrega "Instrucciones" y "Leyenda" ANTES de esa, asi que la hoja en
      // la posicion 0 ya no es la de datos). Si no se encuentra por nombre
      // -- archivo de otra fuente, hoja renombrada -- cae a la ultima hoja
      // del libro en vez de fallar directo.
      const sheetName = wb.SheetNames.includes("Calificaciones")
        ? "Calificaciones"
        : wb.SheetNames[wb.SheetNames.length - 1];
      const ws = wb.Sheets[sheetName];
      rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    } catch (e) {
      setStatus("No se pudo leer el Excel: " + (e && e.message ? e.message : e));
      return;
    }
    if (!rows || rows.length < 2) { setStatus("El Excel esta vacio."); return; }

    const header = rows[0].map((h) => String(h == null ? "" : h).trim());
    const usuarioIdx = header.indexOf("Usuario");
    if (usuarioIdx === -1) {
      setStatus('No se encontro la columna "Usuario". No cambies los encabezados del Excel descargado.');
      return;
    }
    // El encabezado exportado es el id corto de la actividad (ver
    // handleGradesExcelDownload); tambien se acepta la etiqueta completa por
    // si el archivo se descargo con una version anterior de este flujo.
    const headerToId = {};
    activities.forEach((a) => {
      headerToId[String(a.id).trim().toLowerCase()] = a.id;
      headerToId[String(a.label).trim().toLowerCase()] = a.id;
    });
    const colToActivityId = {};
    header.forEach((h, idx) => {
      const id = headerToId[h.toLowerCase()];
      if (id) colToActivityId[idx] = id;
    });
    if (!Object.keys(colToActivityId).length) {
      setStatus("No se reconocio ninguna columna de actividad de esta guia. No cambies los encabezados del Excel descargado.");
      return;
    }

    const activeStudents = getUsersForFicha(ficha).filter((u) => !isInactive(u));
    const studentsByKey = {};
    activeStudents.forEach((u) => { studentsByKey[u.usernameKey] = u; });

    const parsedRows = [];
    const unmatched = [];
    const invalidCells = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const usernameKey = String(row[usuarioIdx] == null ? "" : row[usuarioIdx]).trim().toLowerCase();
      if (!usernameKey) continue;
      if (!studentsByKey[usernameKey]) { unmatched.push(usernameKey); continue; }
      const grades = {};
      Object.keys(colToActivityId).forEach((idxStr) => {
        const idx = Number(idxStr);
        const actId = colToActivityId[idx];
        const raw = String(row[idx] == null ? "" : row[idx]).trim().toUpperCase();
        if (!raw) return; // celda vacia: no se toca
        if (raw === "A" || raw === "D") { grades[actId] = raw; return; }
        invalidCells.push(`${usernameKey}/${actId}="${raw}"`);
      });
      if (Object.keys(grades).length) parsedRows.push({ usernameKey, grades });
    }

    if (!parsedRows.length) {
      setStatus("No hay calificaciones validas (A/D) para aplicar."
        + (unmatched.length ? ` ${unmatched.length} filas sin coincidencia.` : "")
        + (invalidCells.length ? ` ${invalidCells.length} celdas con valor invalido (solo se acepta A o D).` : ""));
      return;
    }

    const totalCells = parsedRows.reduce((n, r) => n + Object.keys(r.grades).length, 0);
    const confirmed = await confirmAdminAction(
      `Se van a actualizar ${totalCells} calificaciones de ${parsedRows.length} aprendices con lo escrito en el Excel. `
      + "Las celdas vacias no se tocan y no cambia ninguna calificacion que no este en el archivo. ¿Continuar?"
    );
    if (!confirmed) return;

    const gradesManager = window.activityGradesManager;
    const db = window._firebaseDb;
    if (!gradesManager || !db) { setStatus("El modulo de notas o Firestore no estan disponibles."); return; }
    const btn = byId("grades-excel-upload-btn");
    if (btn) btn.disabled = true;
    setStatus(`Aplicando calificaciones a ${parsedRows.length} aprendices...`);
    await ensureGradeSolutionsBank();

    let studentsUpdated = 0, fieldsFilled = 0, failures = 0;
    try {
      for (const { usernameKey, grades } of parsedRows) {
        try {
          const all = await db.cloudGetGrades(usernameKey);
          // Sincroniza el cache local con el doc COMPLETO ANTES de escribir: setStudentGrades
          // reemplaza la familia completa a partir del cache local, y sin este paso un cache
          // desactualizado (de otro equipo) borraria notas de otras guias al guardar (mismo
          // cuidado que renderGradesGrid y handleSolutionResync).
          if (all && gradesManager.setAllStudentGrades) gradesManager.setAllStudentGrades(usernameKey, all);
          const familyGrades = Object.assign({}, (all && all[guideFamily]) || {});
          const solutionsToApply = {};
          Object.keys(grades).forEach((actId) => {
            const grade = grades[actId];
            familyGrades[actId] = grade;
            familyGrades[actId + ":gradedAt"] = new Date().toISOString();
            if (grade === "A") {
              const solution = lookupBankSolution(guideFamily, actId);
              if (solution) {
                familyGrades[actId + ":solution"] = solution;
                Object.assign(solutionsToApply, solution);
              }
            }
          });
          gradesManager.setStudentGrades(usernameKey, guideFamily, familyGrades);
          if (Object.keys(solutionsToApply).length) {
            try {
              const applied = await applyApprovedSolutionToStudentCloud(usernameKey, guideFamily, solutionsToApply);
              fieldsFilled += (applied && applied.filled) || 0;
            } catch (_) { /* no critico */ }
          }
          // Actividades aprobadas sin solucion de banco (archivo/checkbox): igual que al
          // calificar a mano, se registran como entregadas por el instructor. Las
          // type:"file" con solucion de texto propia (laboratorios) tambien lo
          // intentan siempre -- la reflexion no cubre la evidencia fotografica
          // obligatoria por separado (ver isDeclaredFileType).
          const fileNameForFallback = resolveStudentGuideFileForFamily(usernameKey, guideFamily);
          for (const actId of Object.keys(grades)) {
            if (grades[actId] !== "A") continue;
            const hasOwnSolution = Boolean(familyGrades[actId + ":solution"]);
            if (hasOwnSolution && !isDeclaredFileType(fileNameForFallback, actId)) continue;
            try { await applyDeliveryFallbackToStudentCloud(usernameKey, guideFamily, actId); } catch (_) { /* no critico */ }
          }
          recordAdminAuditAction({ action: "grade-excel-import", target: `${usernameKey}:${guideFamily}`, detail: Object.keys(grades).join(",") });
          studentsUpdated += 1;
        } catch (_) { failures += 1; }
        setStatus(`... ${studentsUpdated}/${parsedRows.length} aprendices aplicados`);
      }
    } finally {
      if (btn) btn.disabled = false;
    }

    invalidateUsersCache();
    setStatus(
      `Listo: ${studentsUpdated} aprendices actualizados (${totalCells} calificaciones), ${fieldsFilled} campos de respuesta rellenados.`
      + (unmatched.length ? ` ${unmatched.length} filas sin coincidencia (revisa la columna Usuario).` : "")
      + (invalidCells.length ? ` ${invalidCells.length} celdas ignoradas por valor invalido.` : "")
      + (failures ? ` ${failures} errores.` : "")
    );
    if (fileInput) fileInput.value = "";
    renderGradesGrid();
  }

  // ── Autorizaciones de firma (control de consentimiento) ─────────────────────
  // El aprendiz sube una foto/escaneo de su firma desde una pagina propia
  // (autorizacion-firma.html) para autorizar al instructor a usarla en
  // documentacion institucional del SENA. Este panel solo LISTA quien ya la
  // envio (Firestore sena_portal_signature_auth); el aprendiz nunca ve esta
  // lista ni la de otros companeros, solo la confirmacion de su propio envio.
  function formatSignatureDate(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("es-CO", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  let _signatureAuthRecordsByUser = {};

  function sanitizeSignatureFilePart(value) {
    return String(value || "aprendiz")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "aprendiz";
  }

  function drawSignatureCertificateText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    let line = "";
    let currentY = y;
    words.forEach((word) => {
      const testLine = line ? line + " " + word : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    });
    if (line) ctx.fillText(line, x, currentY);
    return currentY + lineHeight;
  }

  function downloadSignatureAuthCertificate(usernameKey) {
    const item = _signatureAuthRecordsByUser[usernameKey];
    if (!item || !item.record || item.record.status !== "delivered") {
      window.portalSaveStatus?.error("No hay una autorizacion entregada para generar la imagen.");
      return;
    }

    const user = item.user || {};
    const rec = item.record || {};
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f5132";
    ctx.fillRect(0, 0, canvas.width, 150);
    ctx.fillStyle = "#39a935";
    ctx.fillRect(0, 150, canvas.width, 10);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 42px Arial, sans-serif";
    ctx.fillText("Constancia de autorizacion de firma", 64, 74);
    ctx.font = "500 24px Arial, sans-serif";
    ctx.fillText("SENA - Sistemas Teleinformaticos", 64, 116);

    ctx.fillStyle = "#0f172a";
    ctx.font = "700 34px Arial, sans-serif";
    ctx.fillText(user.fullName || rec.fullName || "Aprendiz", 64, 230);

    const isManualRecord = rec.registeredBy === "admin-manual"
      || /registrado por el instructor/i.test(String(rec.savedFileName || ""));
    const evidenceLabel = isManualRecord
      ? "Evidencia de firma del aprendiz (registro manual por contingencia)"
      : (rec.savedFileName || rec.fileName || "");

    const details = [
      ["Ficha", user.ficha || rec.ficha || ""],
      ["Institucion", user.inst || user.institucion || rec.institucion || ""],
      ["Usuario", user.username || usernameKey],
      ["Fecha de envio", formatSignatureDate(rec.submittedAt) || ""],
      ["Evidencia", evidenceLabel],
    ];

    ctx.font = "700 22px Arial, sans-serif";
    let y = 286;
    details.forEach(([label, value]) => {
      ctx.fillStyle = "#475569";
      ctx.fillText(label + ":", 64, y);
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 22px Arial, sans-serif";
      drawSignatureCertificateText(ctx, value || "-", 250, y, 1030, 28);
      ctx.font = "700 22px Arial, sans-serif";
      y += 54;
    });

    ctx.fillStyle = "#dcfce7";
    ctx.fillRect(64, 582, 1272, 150);
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 3;
    ctx.strokeRect(64, 582, 1272, 150);
    ctx.fillStyle = "#14532d";
    ctx.font = "700 28px Arial, sans-serif";
    ctx.fillText("Estado: AUTORIZADO Y ENTREGADO", 96, 632);
    ctx.font = "500 23px Arial, sans-serif";
    drawSignatureCertificateText(
      ctx,
      "El aprendiz autorizo al instructor a usar su firma en documentacion institucional del SENA. La evidencia de esa autorizacion queda soportada por el archivo enlazado y el registro guardado en el portal.",
      96,
      676,
      1190,
      32
    );

    ctx.fillStyle = "#334155";
    ctx.font = "500 20px Arial, sans-serif";
    drawSignatureCertificateText(ctx, "Enlace de verificacion Drive: " + (rec.driveUrl || "No disponible"), 64, 790, 1270, 28);
    ctx.fillStyle = "#64748b";
    ctx.font = "500 18px Arial, sans-serif";
    ctx.fillText("Generado desde el panel administrativo el " + formatSignatureDate(new Date().toISOString()), 64, 850);

    const link = document.createElement("a");
    link.download = "Constancia_Firma_" + sanitizeSignatureFilePart(user.fullName || rec.fullName || usernameKey) + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    window.portalSaveStatus?.saved("Constancia de firma descargada.");
  }

  function renderSignatureAuth() {
    const host = byId("module-autorizaciones");
    if (!host) return;
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>Autorizaciones de firma</h2>
        <p class="admin-muted">Control de que aprendices ya autorizaron el uso de su firma para documentacion del SENA. El aprendiz solo ve la confirmacion de su propio envio; esta lista es exclusiva del panel admin.</p>
      </div>
      <div class="grades-manual__filters">
        <select id="firma-ficha-filter">${getFichaOptions("", false)}</select>
        <a id="firma-drive-folder-link" class="btn secondary" href="#" target="_blank" rel="noopener" style="display:none">&#128193; Abrir carpeta de Drive de esta ficha</a>
      </div>
      <p class="admin-muted" style="margin-top:-8px">Para "Registrar entrega manual": abre esta carpeta, busca el archivo del aprendiz, clic derecho &rarr; Obtener enlace, y pegalo cuando el panel lo pida.</p>
      <div id="firma-grid" class="grades-grid"></div>
    `;
  }

  function updateFirmaDriveFolderLink(ficha) {
    const link = byId("firma-drive-folder-link");
    if (!link) return;
    const url = window.PROJECT_INTEGRATIONS?.fichaDriveFolders?.[ficha] || "";
    if (url) {
      link.href = url;
      link.style.display = "";
    } else {
      link.href = "#";
      link.style.display = "none";
    }
  }

  async function renderSignatureAuthGrid() {
    const grid = byId("firma-grid");
    if (!grid) return;
    const ficha = byId("firma-ficha-filter")?.value || "";
    updateFirmaDriveFolderLink(ficha);
    if (!ficha) {
      grid.innerHTML = '<p class="admin-muted">Selecciona una ficha para ver los aprendices.</p>';
      return;
    }
    const students = getUsersForFicha(ficha);
    if (!students.length) {
      grid.innerHTML = '<p class="admin-muted">No hay aprendices en esta ficha.</p>';
      return;
    }
    grid.innerHTML = '<p class="response-status">Cargando autorizaciones desde la nube...</p>';
    const db = window._firebaseDb;
    const recordsByUser = {};
    await Promise.all(students.map(async (user) => {
      let rec = null;
      if (db && typeof db.cloudGetSignatureAuth === "function") {
        try { rec = await db.cloudGetSignatureAuth(user.usernameKey); } catch (_) { rec = null; }
      }
      recordsByUser[user.usernameKey] = rec;
    }));
    _signatureAuthRecordsByUser = {};
    const rows = students.map((user) => {
      const rec = recordsByUser[user.usernameKey];
      _signatureAuthRecordsByUser[user.usernameKey] = { user, record: rec };
      const delivered = !!(rec && rec.status === "delivered");
      const estado = delivered
        ? '<span class="c-badge">Entregada</span>'
        : '<span class="c-badge c-badge--neutral">Pendiente</span>';
      const fecha = delivered ? escapeHtml(formatSignatureDate(rec.submittedAt)) : "&mdash;";
      const archivo = delivered ? escapeHtml(
        (/registrado por el instructor/i.test(String(rec.savedFileName || "")) || rec.registeredBy === "admin-manual")
          ? "Evidencia de firma del aprendiz (registro manual por contingencia)"
          : (rec.savedFileName || rec.fileName || "")
      ) : "&mdash;";
      const enlace = delivered && rec.driveUrl
        ? `<a href="${escapeHtml(rec.driveUrl)}" target="_blank" rel="noopener">Ver archivo</a>`
        : "&mdash;";
      const accion = delivered
        ? `<div class="firma-actions"><button type="button" class="btn secondary firma-certificate-btn" data-firma-user="${escapeHtml(user.usernameKey)}">Descargar constancia</button><button type="button" class="btn secondary firma-reenable-btn" data-firma-user="${escapeHtml(user.usernameKey)}">Re-habilitar</button></div>`
        : `<button type="button" class="btn secondary firma-manual-btn" data-firma-user="${escapeHtml(user.usernameKey)}" data-firma-name="${escapeHtml(user.fullName)}">Registrar entrega manual</button>`;
      return `<tr><td>${escapeHtml(user.fullName)}</td><td>${estado}</td><td>${fecha}</td><td>${archivo}</td><td>${enlace}</td><td>${accion}</td></tr>`;
    }).join("");
    grid.innerHTML = `<table class="admin-data-table grades-table">
      <thead><tr><th>Aprendiz</th><th>Estado</th><th>Fecha de envio</th><th>Evidencia</th><th>Enlace</th><th>Accion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Re-habilita: limpia "status" en el doc EXISTENTE (fetch-then-write con lectura
  // fresca, no cache local) para que el aprendiz pueda volver a subir su firma.
  // Conserva el historial del envio anterior (fecha/archivo/enlace) como evidencia.
  async function handleSignatureReenable(usernameKey) {
    const db = window._firebaseDb;
    if (!db || typeof db.cloudGetSignatureAuth !== "function" || typeof db.cloudSaveSignatureAuth !== "function") return;
    window.portalSaveStatus?.saving("Re-habilitando autorizacion...");
    try {
      const current = (await db.cloudGetSignatureAuth(usernameKey)) || {};
      await db.cloudSaveSignatureAuth(usernameKey, { ...current, status: "" });
      recordAdminAuditAction({ action: "signature-auth-reenable", target: usernameKey, detail: "" });
      window.portalSaveStatus?.saved("Autorizacion re-habilitada: el aprendiz ya puede volver a subirla.");
      renderSignatureAuthGrid();
    } catch (err) {
      window.portalSaveStatus?.error("No se pudo re-habilitar la autorizacion.");
      setFeedback("Error al re-habilitar la autorizacion: " + (err && err.message ? err.message : err), "error");
    }
  }

  // Registro manual: para cuando el aprendiz SI subio el archivo a Drive (el
  // instructor lo confirma visualmente en la carpeta de la ficha) pero el
  // registro de control en Firestore nunca se creo -- por ejemplo, si las
  // reglas de Firestore para esta coleccion no estaban publicadas todavia en
  // el momento del envio (caso real: 4 aprendices el 2026-07-07). El aprendiz
  // NO necesita volver a subir nada; el admin solo pega el enlace del archivo
  // que ya esta en Drive.
  async function handleSignatureManualRegister(usernameKey, fullName) {
    const db = window._firebaseDb;
    if (!db || typeof db.cloudSaveSignatureAuth !== "function") return;
    const driveUrl = window.prompt(
      `Registrar entrega manual de "${fullName}".\n\nPega el enlace de Drive del archivo ya subido (clic derecho en el archivo → Obtener enlace):`,
      ""
    );
    if (driveUrl === null) return; // cancelado
    if (!driveUrl.trim()) {
      window.portalSaveStatus?.error("Debes pegar un enlace de Drive valido.");
      return;
    }
    const user = getUser(usernameKey);
    window.portalSaveStatus?.saving("Registrando entrega manual...");
    try {
      const submittedAt = new Date().toISOString();
      await db.cloudSaveSignatureAuth(usernameKey, {
        usernameKey,
        fullName: (user && user.fullName) || fullName || "",
        ficha: (user && user.ficha) || "",
        institucion: (user && user.inst) || "",
        submittedAt,
        fileName: "",
        savedFileName: "Evidencia de firma del aprendiz (registro manual por contingencia)",
        driveUrl: driveUrl.trim(),
        status: "delivered",
        registeredBy: "admin-manual",
      });
      recordAdminAuditAction({ action: "signature-auth-manual-register", target: usernameKey, detail: driveUrl.trim() });
      window.portalSaveStatus?.saved("Entrega registrada correctamente.");
      renderSignatureAuthGrid();
    } catch (err) {
      window.portalSaveStatus?.error("No se pudo registrar la entrega manual.");
      setFeedback("Error al registrar entrega manual de firma: " + (err && err.message ? err.message : err), "error");
    }
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

  // ── Talleres de Refuerzo (pestaña aparte) ───────────────────────────────────
  // A diferencia de Planes de Mejoramiento, un taller de refuerzo NO reabre
  // ninguna actividad real de una guia -- es un documento autocontenido (PDF ya
  // elaborado) que se asigna completo. Por eso no hay selector de "Actividad" ni
  // banner dentro de la guia: el aprendiz lo ve y lo entrega desde su propia
  // pagina (pages/auxiliares/talleres-refuerzo.html).
  let _workshopsByUser = {};   // { usernameKey: { user, workshops } } de la ficha mostrada

  function renderReinforcementWorkshops() {
    const host = byId("module-talleres");
    if (!host) return;
    const catalog = window.reinforcementWorkshopsCatalog || {};
    const workshopOptions = Object.keys(catalog).map((key) =>
      `<option value="${escapeHtml(key)}">${escapeHtml(catalog[key].title || key)}</option>`).join("");
    host.innerHTML = `
      <div class="admin-section-head">
        <h2>Talleres de Refuerzo</h2>
        <p class="admin-muted">Asigna un taller de refuerzo (documento ya elaborado, con sus propias actividades) a uno o varios aprendices. El aprendiz lo ve, lo descarga y lo entrega desde su propia pagina de "Talleres de Refuerzo" (aviso en su Inicio).</p>
      </div>
      <details class="taller-nuevo">
        <summary>Asignar nuevo taller</summary>
        <div class="taller-form">
          <label>Ficha <select id="taller-ficha">${getFichaOptions("", false)}</select></label>
          <label>Taller <select id="taller-taller"><option value="">Selecciona</option>${workshopOptions}</select></label>
          <div class="taller-roster">
            <div class="taller-roster__toolbar">
              <label><input type="checkbox" id="taller-roster-todos"> Seleccionar todos</label>
              <span id="taller-roster-contador" class="admin-muted">0 seleccionados</span>
            </div>
            <div class="taller-roster__list" id="taller-roster-list"></div>
          </div>
          <label>Observación <small>(opcional)</small>
            <textarea id="taller-motivo" rows="2" placeholder="Ej. refuerzo preventivo, apoyo adicional, etc. (no obligatorio)"></textarea></label>
          <label>Fecha límite <input type="date" id="taller-fecha"></label>
          <button type="button" id="taller-asignar" class="btn primary">Asignar taller</button>
          <span id="taller-status" class="admin-muted"></span>
        </div>
      </details>
      <div class="taller-filtros">
        <select id="taller-filtro-ficha">${getFichaOptions("", false)}</select>
        <select id="taller-filtro-estado">
          <option value="">Todos los estados</option>
          <option value="asignado">Asignado</option>
          <option value="entregado">Entregado</option>
          <option value="superado">Superado</option>
          <option value="no_superado">No superado</option>
          <option value="vencido">Vencido</option>
        </select>
      </div>
      <div id="taller-grid" class="taller-grid"></div>
    `;
    populateWorkshopRoster();
    byId("taller-ficha")?.addEventListener("change", populateWorkshopRoster);
    byId("taller-taller")?.addEventListener("change", prefillWorkshopDeadline);
    byId("taller-roster-todos")?.addEventListener("change", toggleWorkshopRosterAll);
    byId("taller-roster-list")?.addEventListener("change", updateWorkshopRosterCounter);
    byId("taller-asignar")?.addEventListener("click", handleAssignWorkshop);
    byId("taller-filtro-ficha")?.addEventListener("change", renderWorkshopsGrid);
    byId("taller-filtro-estado")?.addEventListener("change", renderWorkshopsGrid);
    byId("taller-grid")?.addEventListener("click", handleWorkshopGridClick);
    renderWorkshopsGrid();
  }

  function populateWorkshopRoster() {
    const ficha = byId("taller-ficha")?.value || "";
    const list = byId("taller-roster-list");
    if (!list) return;
    const users = getUsersForFicha(ficha);
    list.innerHTML = users.length
      ? users.map((u) => `
          <label class="taller-roster__item">
            <input type="checkbox" value="${escapeHtml(u.usernameKey)}">
            <span>${escapeHtml(u.fullName)}</span>
          </label>`).join("")
      : '<p class="admin-muted">No hay aprendices en esta ficha.</p>';
    const selectAll = byId("taller-roster-todos");
    if (selectAll) selectAll.checked = false;
    updateWorkshopRosterCounter();
  }

  function toggleWorkshopRosterAll() {
    const checked = byId("taller-roster-todos")?.checked;
    byId("taller-roster-list")?.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = !!checked; });
    updateWorkshopRosterCounter();
  }

  function updateWorkshopRosterCounter() {
    const n = getSelectedWorkshopLearners().length;
    const el = byId("taller-roster-contador");
    if (el) el.textContent = `${n} seleccionado${n === 1 ? "" : "s"}`;
  }

  function getSelectedWorkshopLearners() {
    const list = byId("taller-roster-list");
    if (!list) return [];
    return Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
  }

  // Al elegir el taller, prellena la fecha limite con hoy + defaultDays del
  // catalogo (solo si el admin aun no la toco a mano).
  function prefillWorkshopDeadline() {
    const key = byId("taller-taller")?.value || "";
    const entry = (window.reinforcementWorkshopsCatalog || {})[key];
    const fechaEl = byId("taller-fecha");
    if (!entry || !fechaEl || fechaEl.value) return;
    const dias = Number(entry.defaultDays) || 15;
    const fecha = new Date(Date.now() + dias * 86400000);
    fechaEl.value = fecha.toISOString().slice(0, 10);
  }

  function handleAssignWorkshop() {
    const mgr = window.reinforcementWorkshops;
    const catalog = window.reinforcementWorkshopsCatalog || {};
    const workshopKey = byId("taller-taller")?.value || "";
    const entry = catalog[workshopKey];
    const usernameKeys = getSelectedWorkshopLearners();
    const motivo = byId("taller-motivo")?.value || "";
    const fechaLimite = byId("taller-fecha")?.value || "";
    const setStatus = (m) => { const el = byId("taller-status"); if (el) el.textContent = m; };
    if (!mgr || !entry || !usernameKeys.length) { setStatus("Selecciona un taller y al menos un aprendiz."); return; }
    if (!fechaLimite) { setStatus("Indica la fecha limite."); return; }
    const session = auth.getCurrentSession();
    const asignadoPor = (session && session.usernameKey) || "admin";
    // Guard anti-duplicados: con varios aprendices marcados a la vez, un doble
    // clic en "Asignar" no debe crear registros repetidos para quien ya tenga
    // un taller de este tipo sin cerrar.
    let asignados = 0;
    let yaActivos = 0;
    usernameKeys.forEach((usernameKey) => {
      const existentes = mgr.getStudentWorkshops(usernameKey);
      const yaTiene = existentes.some((w) => w.workshopKey === workshopKey && w.resultado !== "A" && w.resultado !== "D");
      if (yaTiene) { yaActivos += 1; return; }
      mgr.createWorkshop(usernameKey, {
        workshopKey, title: entry.title, fileUrl: entry.fileUrl, motivo, fechaLimite, asignadoPor,
      });
      asignados += 1;
    });
    recordAdminAuditAction({ action: "taller-asignar", target: workshopKey, detail: `${asignados} aprendices` });
    setStatus(`Asignado a ${asignados}.` + (yaActivos ? ` ${yaActivos} ya tenian un taller activo de este tipo.` : ""));
    renderWorkshopsGrid();
  }

  async function renderWorkshopsGrid() {
    const grid = byId("taller-grid");
    if (!grid) return;
    const ficha = byId("taller-filtro-ficha")?.value || "";
    const estado = byId("taller-filtro-estado")?.value || "";
    const mgr = window.reinforcementWorkshops;
    if (!ficha || !mgr) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    grid.innerHTML = '<p class="response-status">Cargando talleres desde la nube...</p>';
    const users = getUsersForFicha(ficha);
    _workshopsByUser = {};
    await Promise.all(users.map(async (u) => {
      let workshops = [];
      try { workshops = await mgr.syncStudentWorkshopsFromCloud(u.usernameKey); }
      catch (_) { workshops = mgr.getStudentWorkshops(u.usernameKey); }
      _workshopsByUser[u.usernameKey] = { user: u, workshops: workshops || [] };
    }));
    const now = Date.now();
    const rows = [];
    users.forEach((u) => {
      (_workshopsByUser[u.usernameKey]?.workshops || []).forEach((w) => {
        const st = mgr.deriveWorkshopStatus(w, now);
        if (estado && st !== estado) return;
        rows.push(workshopRowMarkup(u, w, st));
      });
    });
    grid.innerHTML = rows.length
      ? `<table class="admin-data-table taller-table"><thead><tr><th>Aprendiz</th><th>Taller</th><th>Asignado</th><th>Fecha limite</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : '<p class="admin-muted">No hay talleres para esta ficha/estado.</p>';
  }

  function workshopRowMarkup(user, workshop, status) {
    const label = (window.reinforcementWorkshops?.WORKSHOP_STATUS_LABELS || {})[status] || status;
    return `<tr data-workshop-id="${escapeHtml(workshop.id)}" data-workshop-user="${escapeHtml(user.usernameKey)}">
      <td>${escapeHtml(user.fullName)}</td>
      <td>${escapeHtml(workshop.title || workshop.workshopKey)}</td>
      <td>${escapeHtml(formatDate(workshop.fechaAsignacion))}</td>
      <td>${escapeHtml(workshop.fechaLimite || "—")}</td>
      <td><span class="taller-estado taller-estado--${escapeHtml(status)}">${escapeHtml(label)}</span></td>
      <td>
        <button type="button" class="btn small" data-workshop-action="respuestas">Ver respuestas</button>
        <button type="button" class="btn small" data-workshop-action="entregada">Entregada</button>
        <button type="button" class="btn small" data-workshop-action="superado">&#10003; Superado</button>
        <button type="button" class="btn small" data-workshop-action="nosuperado">&#10007; No superado</button>
        <button type="button" class="btn small" data-workshop-action="fecha">Cambiar fecha</button>
        <button type="button" class="btn small danger" data-workshop-action="eliminar">Eliminar</button>
      </td>
    </tr>`;
  }

  // El aprendiz llena el taller EN LINEA (ver reinforcement_workshops_student.js):
  // sus respuestas viven en sena_portal_reinforcement_answers (coleccion
  // separada de la asignacion), con llaves saneadas (guiones -> guion_bajo,
  // ver safeId en reinforcement_workshops_student.js -- se replica aqui la
  // misma sanitizacion, pura y determinista, para poder leerlas).
  function tallerSafeId(value) {
    return String(value).replace(/[^a-zA-Z0-9_]/g, "_");
  }

  async function showWorkshopAnswers(usernameKey, user, workshop) {
    const mgr = window.reinforcementWorkshops;
    const catalog = window.reinforcementWorkshopsCatalog || {};
    const catalogEntry = catalog[workshop.workshopKey];
    if (!mgr || !catalogEntry) return;

    openModal(`Respuestas — ${workshop.title || workshop.workshopKey}`, user.fullName, '<p class="admin-muted">Cargando respuestas desde la nube...</p>');

    let respuestas = {};
    try {
      const all = await mgr.syncStudentAnswersFromCloud(usernameKey);
      respuestas = (all && all[workshop.id]) || {};
    } catch (_) { respuestas = {}; }

    const prefix = tallerSafeId(workshop.id) + "__";
    const rows = [];
    (catalogEntry.docFields || []).forEach((f) => {
      const v = respuestas[prefix + f.key];
      rows.push(`<p><strong>${escapeHtml(f.label)}:</strong> ${v ? escapeHtml(v) : "<em>(sin respuesta)</em>"}</p>`);
    });
    (catalogEntry.activities || []).forEach((act) => {
      rows.push(`<h4>Actividad ${escapeHtml(act.number)} — ${escapeHtml(act.label)}</h4>`);
      (act.fields || []).forEach((f) => {
        const v = respuestas[prefix + f.key];
        rows.push(`<p><strong>${escapeHtml(f.label)}:</strong> ${v ? escapeHtml(v) : "<em>(sin respuesta)</em>"}</p>`);
      });
    });
    openModal(`Respuestas — ${workshop.title || workshop.workshopKey}`, user.fullName, rows.join("") || '<p class="admin-muted">El aprendiz aun no ha guardado ninguna respuesta.</p>');
  }

  function handleWorkshopGridClick(event) {
    const btn = event.target.closest("[data-workshop-action]");
    if (!btn) return;
    const row = btn.closest("tr[data-workshop-id]");
    if (!row) return;
    const usernameKey = row.dataset.workshopUser;
    const workshopId = row.dataset.workshopId;
    const action = btn.dataset.workshopAction;
    const mgr = window.reinforcementWorkshops;
    const entry = _workshopsByUser[usernameKey];
    const workshop = entry && entry.workshops.find((w) => w.id === workshopId);
    if (!mgr || !workshop) return;
    if (action === "respuestas") {
      showWorkshopAnswers(usernameKey, entry.user, workshop);
    } else if (action === "fecha") {
      const nueva = window.prompt("Nueva fecha limite (AAAA-MM-DD):", workshop.fechaLimite || "");
      if (nueva == null) return;
      mgr.updateWorkshopDeadline(usernameKey, workshopId, String(nueva).trim());
      recordAdminAuditAction({ action: "taller-fecha", target: `${usernameKey}:${workshopId}`, detail: String(nueva).trim() });
      renderWorkshopsGrid();
    } else if (action === "entregada") {
      mgr.markWorkshopDelivered(usernameKey, workshopId);
      recordAdminAuditAction({ action: "taller-entregada", target: `${usernameKey}:${workshopId}`, detail: workshop.workshopKey });
      renderWorkshopsGrid();
    } else if (action === "superado" || action === "nosuperado") {
      mgr.setWorkshopResult(usernameKey, workshopId, action === "superado" ? "A" : "D");
      recordAdminAuditAction({ action: "taller-resultado", target: `${usernameKey}:${workshopId}`, detail: action === "superado" ? "A" : "D" });
      renderWorkshopsGrid();
    } else if (action === "eliminar") {
      confirmAdminAction("Eliminar este taller de refuerzo?").then((ok) => {
        if (!ok) return;
        mgr.deleteWorkshop(usernameKey, workshopId);
        recordAdminAuditAction({ action: "taller-eliminar", target: `${usernameKey}:${workshopId}`, detail: workshop.workshopKey });
        renderWorkshopsGrid();
      });
    }
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
    byId("refresh-users")?.addEventListener("click", () => {
      guideStatesHydrated = false;
      try { localStorage.removeItem(DASHBOARD_HYDRATE_THROTTLE_KEY); } catch (_) { /* sin localStorage */ }
      loadUsers();
    });
    byId("name-audit-run")?.addEventListener("click", runNameAudit);
    byId("btn-backfill-drive")?.addEventListener("click", () => runBackfillToDrive());
    byId("btn-promote-drive")?.addEventListener("click", () => runPromoteFromDrive());
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
      if (sel) { handleGradeChange(sel); return; }
      const reasonSel = target && target.closest ? target.closest(".grade-reason-select") : null;
      if (reasonSel) handleGradeReasonChange(reasonSel);
    });
    // Modulo Autorizaciones de firma: filtro, constancia y acciones admin.
    byId("module-autorizaciones")?.addEventListener("change", (event) => {
      if (event.target && event.target.id === "firma-ficha-filter") {
        renderSignatureAuthGrid();
      }
    });
    byId("module-autorizaciones")?.addEventListener("click", (event) => {
      const certBtn = event.target && event.target.closest ? event.target.closest(".firma-certificate-btn") : null;
      if (certBtn && certBtn.dataset.firmaUser) { downloadSignatureAuthCertificate(certBtn.dataset.firmaUser); return; }
      const reBtn = event.target && event.target.closest ? event.target.closest(".firma-reenable-btn") : null;
      if (reBtn && reBtn.dataset.firmaUser) { handleSignatureReenable(reBtn.dataset.firmaUser); return; }
      const manualBtn = event.target && event.target.closest ? event.target.closest(".firma-manual-btn") : null;
      if (manualBtn && manualBtn.dataset.firmaUser) handleSignatureManualRegister(manualBtn.dataset.firmaUser, manualBtn.dataset.firmaName || "");
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
