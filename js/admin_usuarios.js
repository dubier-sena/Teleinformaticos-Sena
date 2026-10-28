(function () {
  "use strict";

  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  const adminAudit = window.adminAudit || null;
  const adminExport = window.adminExport || null;

  if (!auth) return;

  // Fase 12 (rendimiento): xlsx.full.min.js pesa ~930 KB (la libreria de
  // Excel mas grande de todo el panel) y antes se cargaba de entrada en
  // CADA visita al panel admin, la use o no esa sesion -- se pide bajo
  // demanda, solo cuando el admin de verdad exporta o sube un Excel de
  // calificaciones (handleGradesExcelDownload/Upload, unicos consumidores).
  let _xlsxLoadPromise = null;
  function ensureXlsxLoaded() {
    if (window.XLSX) return Promise.resolve(true);
    if (_xlsxLoadPromise) return _xlsxLoadPromise;
    _xlsxLoadPromise = new Promise((resolve) => {
      const el = document.createElement("script");
      el.src = "js/xlsx.full.min.js?v=20260722_1";
      el.onload = () => resolve(true);
      el.onerror = () => resolve(false);
      document.head.appendChild(el);
    });
    return _xlsxLoadPromise;
  }

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

  // Candidata 2026-10-28 (normalizacion de guias): nombre corto uniforme para
  // MOSTRAR (selectores, tablas, avisos, exportaciones del panel). Los datos
  // guardados y los nombres de archivo de Drive siguen usando getGuideTitle.
  function guideLabel(fileName) {
    const label = typeof auth.getGuideDisplayLabel === "function" ? auth.getGuideDisplayLabel(fileName) : "";
    return label || auth.getGuideTitle(fileName) || fileName;
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
      `<option value="${escapeHtml(fileName)}"${fileName === selected ? " selected" : ""}>${escapeHtml(guideLabel(fileName))}</option>`
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
    // "Entregas recientes" ya NO hidrata a todos los aprendices al abrir el
    // panel (antes: aprendices x guias lecturas + una consulta a Drive por
    // documento ausente). Se consulta bajo demanda (ver consultRecentDeliveries).
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

  // ── Tarjeta "Entregas recientes" (consulta bajo demanda, 2026-10-22) ──────
  // Antes: al abrir el panel se descargaba el estado de TODOS los aprendices x
  // TODAS sus guias (ensureGuideStatesHydrated) para mostrar 8 lineas. Ahora:
  // ficha -> periodo -> "Consultar entregas recientes". La consulta pide solo
  // los documentos de guia ACTUALIZADOS en el periodo (consulta por rango sobre
  // updatedAt, _firebaseDb.cloudListGuideDataSince): se cobran solo esos
  // documentos y no se consulta Drive. La ficha se filtra en memoria (cambiarla
  // no consulta). Cache en memoria por sesion de admin y periodo, 10 minutos;
  // "Actualizar" fuerza la relectura. Nada se guarda en localStorage.
  const RECENT_PERIODS = [7, 30, 90];
  const RECENT_TTL_MS = 10 * 60 * 1000;
  const RECENT_MARGIN_MS = 24 * 60 * 60 * 1000; // tolerancia de relojes desfasados
  const recentDeliveries = { ficha: "", days: 7, session: "", cache: new Map(), inflight: null };

  const RECENT_MESSAGES = {
    waiting: "Elija la ficha y el período y pulse «Consultar entregas recientes».",
    loading: "Consultando entregas recientes…",
    none: "No hay entregas registradas en este período.",
    offline: "No fue posible conectar con la nube. Verifique su conexión e intente nuevamente.",
    denied: "No tiene autorización para consultar esta información.",
    quota: "Se alcanzó el límite diario de consultas de la nube. No se harán más intentos automáticos; intente de nuevo más tarde.",
    incomplete: "No fue posible recuperar toda la información. Algunas entregas podrían no aparecer.",
    service: "Ocurrió un problema al consultar la información. Intente nuevamente.",
  };

  function recentMessage(status) {
    if (RECENT_MESSAGES[status]) return RECENT_MESSAGES[status];
    return RECENT_MESSAGES.service + (status === "timeout" ? " (tiempo de espera agotado)" : "");
  }

  function ensureRecentSession() {
    const key = habSessionKey();
    if (key !== recentDeliveries.session) {
      recentDeliveries.cache.clear();
      recentDeliveries.session = key;
    }
  }

  function invalidateRecentDeliveries() {
    recentDeliveries.cache.clear();
  }

  function cloudKeyOf(name) {
    return String(name || "").replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
  }

  // Documentos -> entregas. Atribuye cada documento a su aprendiz por el campo
  // scopeKey ("student:{usernameKey}") que escribe cada guardado, o por el id
  // legado; y a su guia, entre las guias de la ficha del aprendiz, por el
  // nombre de documento. Fecha: la registrada en la entrega (submittedAt, o su
  // updatedAt); sin fecha registrada no se le asigna ninguna.
  function deliveriesFromGuideDocs(docs) {
    const byKey = new Map((state.users || []).map((u) => [u.usernameKey, u]));
    const bySafe = new Map((state.users || []).map((u) => [String(u.usernameKey).replace(/[^a-z0-9:_-]/gi, "_"), u]));
    const hab = window.adminHabilitacion;
    const guideKeyCache = new Map();
    const keysOf = (pageFile) => {
      if (!guideKeyCache.has(pageFile)) {
        const names = hab && typeof hab.getCloudFileNamesForGuide === "function"
          ? hab.getCloudFileNamesForGuide(pageFile)
          : [getGuideCloudConfig(pageFile)?.cloudFileName || pageFile];
        guideKeyCache.set(pageFile, new Set(names.concat([pageFile]).map(cloudKeyOf)));
      }
      return guideKeyCache.get(pageFile);
    };
    const latest = new Map();
    let undated = 0;
    (docs || []).forEach((doc) => {
      const docId = String(doc._docId || "");
      let user = null;
      const scope = String(doc.scopeKey || "");
      if (scope.indexOf("student:") === 0) user = byKey.get(scope.slice(8)) || bySafe.get(scope.slice(8).replace(/[^a-z0-9:_-]/gi, "_"));
      if (!user) {
        const m = docId.match(/^__guide_data__:student:([^:]+):/);
        if (m) user = bySafe.get(m[1]) || null;
      }
      if (!user) return;
      const fileKey = docId.split(":").pop();
      const pageFile = getGuidesForFicha(user.ficha).find((g) => keysOf(g).has(fileKey));
      if (!pageFile) return;
      let snapshot = null;
      try { snapshot = typeof doc.snapshotJson === "string" ? JSON.parse(doc.snapshotJson) : doc; } catch (_) { snapshot = null; }
      const st = snapshot && (snapshot.state || snapshot.data);
      if (!st || typeof st !== "object") return;
      Object.keys(st).forEach((key) => {
        const value = st[key];
        if (!/-delivery$/.test(key) || !value || typeof value !== "object") return;
        const submittedAt = String(value.submittedAt || value.updatedAt || "");
        if (!submittedAt) { undated += 1; return; }
        const activityId = key.replace(/-delivery$/, "");
        const id = `${user.usernameKey}|${pageFile}|${activityId}`;
        const prev = latest.get(id);
        if (!prev || submittedAt > prev.submittedAt) {
          latest.set(id, { user, fileName: pageFile, activityId, submittedAt, savedFileName: value.savedFileName || "", driveUrl: value.driveUrl || "" });
        }
      });
    });
    return { rows: Array.from(latest.values()), undated };
  }

  async function consultRecentDeliveries(options = {}) {
    ensureRecentSession();
    const days = recentDeliveries.days;
    const cached = recentDeliveries.cache.get(days);
    if (!options.force && cached && cached.status !== "loading" && (Date.now() - cached.fetchedAt) < RECENT_TTL_MS && cached.status === "ok") {
      renderRecentDeliveries();
      return cached;
    }
    if (recentDeliveries.inflight) return recentDeliveries.inflight; // doble clic
    const db = window._firebaseDb;
    const previous = cached && cached.rows ? cached : null;
    recentDeliveries.cache.set(days, Object.assign({}, previous || {}, { status: "loading" }));
    renderRecentDeliveries();
    const run = (async () => {
      let entry;
      if (!hasAdminPanelAccess()) {
        entry = { status: "denied" };
      } else if (!db || typeof db.cloudListGuideDataSince !== "function") {
        entry = { status: "error" };
      } else {
        const startedAt = Date.now();
        const since = new Date(Date.now() - days * 86400000 - RECENT_MARGIN_MS).toISOString();
        const result = await db.cloudListGuideDataSince(since);
        const mapped = deliveriesFromGuideDocs(result.docs || []);
        entry = {
          status: result.status,
          rows: mapped.rows,
          undated: mapped.undated,
          docs: (result.docs || []).length,
          stats: result.stats,
          ms: Date.now() - startedAt,
        };
      }
      entry.fetchedAt = Date.now();
      // Ante un fallo sin datos nuevos se conserva lo anterior, marcado.
      if (entry.status !== "ok" && !(entry.rows && entry.rows.length) && previous) {
        entry = Object.assign({}, previous, { status: entry.status, stale: true, fetchedAt: previous.fetchedAt });
      }
      recentDeliveries.cache.set(days, entry);
      return entry;
    })();
    recentDeliveries.inflight = run;
    try {
      return await run;
    } finally {
      recentDeliveries.inflight = null;
      if (state.activeModule === "dashboard") renderRecentDeliveries();
    }
  }

  function renderRecentDeliveries() {
    const host = byId("dashboard-deliveries");
    if (!host) return;
    ensureRecentSession();
    const fichas = [...new Set((state.users || []).map((u) => String(u.ficha || "")).filter(Boolean))].sort();
    if (recentDeliveries.ficha && !fichas.includes(recentDeliveries.ficha)) recentDeliveries.ficha = "";
    const entry = recentDeliveries.cache.get(recentDeliveries.days) || null;
    const loading = entry && entry.status === "loading";
    const controls = `
      <div class="recent-deliveries__filters">
        <label>Ficha
          <select id="recent-ficha">
            <option value="">Todas las fichas</option>
            ${fichas.map((f) => `<option value="${escapeHtml(f)}"${recentDeliveries.ficha === f ? " selected" : ""}>${escapeHtml(f)}</option>`).join("")}
          </select>
        </label>
        <label>Período
          <select id="recent-period">
            ${RECENT_PERIODS.map((d) => `<option value="${d}"${recentDeliveries.days === d ? " selected" : ""}>Últimos ${d} días</option>`).join("")}
          </select>
        </label>
        <button class="admin-button" type="button" id="recent-consult"${loading ? " disabled" : ""}>Consultar entregas recientes</button>
        ${entry && entry.fetchedAt ? `<button class="admin-button admin-button--ghost" type="button" id="recent-refresh"${loading ? " disabled" : ""}>Actualizar</button>` : ""}
      </div>`;
    let body = "";
    if (!entry) {
      body = `<p class="admin-empty" id="recent-message">${escapeHtml(RECENT_MESSAGES.waiting)}</p>`;
    } else if (loading && !(entry.rows && entry.rows.length)) {
      body = `<p class="response-status" id="recent-message">${escapeHtml(RECENT_MESSAGES.loading)}</p>`;
    } else {
      const since = new Date(Date.now() - recentDeliveries.days * 86400000).toISOString();
      const rows = (entry.rows || [])
        .filter((d) => !recentDeliveries.ficha || String(d.user.ficha) === recentDeliveries.ficha)
        .filter((d) => d.submittedAt >= since)
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
      const notices = [];
      if (loading) notices.push(RECENT_MESSAGES.loading);
      else if (entry.status !== "ok") {
        notices.push(recentMessage(entry.status) + (entry.stale ? " Se muestra la última información recuperada, que podría estar desactualizada." : ""));
      } else if (Date.now() - entry.fetchedAt >= RECENT_TTL_MS) {
        notices.push("Esta información se consultó hace más de 10 minutos. Pulse «Actualizar» para traerla de nuevo.");
      }
      const when = entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "";
      const summary = entry.status === "ok" || rows.length
        ? `<p class="admin-muted" id="recent-summary">${rows.length} entrega${rows.length !== 1 ? "s" : ""} en el período${recentDeliveries.ficha ? ` (ficha ${escapeHtml(recentDeliveries.ficha)})` : ""}. Consultado a las ${escapeHtml(when)}.</p>`
        : "";
      const list = rows.slice(0, 8).map((d) => {
        const name = escapeHtml((d.user && d.user.fullName) || (d.user && d.user.usernameKey) || "Aprendiz");
        const guide = escapeHtml(guideLabel(d.fileName) || d.fileName || "");
        const act = escapeHtml(d.activityId || "");
        return `<div class="delivery-line">
          <div class="delivery-line__main"><strong>${name}</strong><span class="admin-muted"> &middot; ${guide}${act ? " &middot; " + act : ""}</span></div>
          <span class="delivery-line__when">${escapeHtml(formatRelativeOrDate(d.submittedAt))}</span>
        </div>`;
      }).join("");
      const empty = !rows.length && entry.status === "ok" && !loading
        ? `<p class="admin-empty" id="recent-message">${escapeHtml(RECENT_MESSAGES.none)}</p>`
        : (!rows.length && entry.status !== "ok" && !loading ? "" : "");
      body = notices.map((n) => `<p class="c-alert ${entry.status === "incomplete" ? "c-alert--warning" : (entry.status === "ok" || loading ? "c-alert--info" : "c-alert--danger")}" id="recent-notice">${escapeHtml(n)}</p>`).join("") + summary + list + empty;
    }
    host.innerHTML = controls + `<div id="recent-body" role="status" aria-live="polite">${body}</div>`;
    host.querySelector("#recent-ficha")?.addEventListener("change", (event) => {
      recentDeliveries.ficha = event.target.value || "";
      renderRecentDeliveries(); // filtro en memoria: no consulta
    });
    host.querySelector("#recent-period")?.addEventListener("change", (event) => {
      recentDeliveries.days = Number(event.target.value) || 7;
      renderRecentDeliveries(); // muestra lo ya consultado de ese periodo, sin consultar
    });
    host.querySelector("#recent-consult")?.addEventListener("click", () => { void consultRecentDeliveries(); });
    host.querySelector("#recent-refresh")?.addEventListener("click", () => { void consultRecentDeliveries({ force: true }); });
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
        <td class="admin-row-actions">
          <button class="admin-button admin-button--ghost" type="button" data-generate-ficha-code="${escapeHtml(row.ficha)}">Generar codigo nuevo</button>
          <div class="admin-muted" data-ficha-code-status="${escapeHtml(row.ficha)}"></div>
        </td>
      </tr>
    `).join("");
    byId("fichas-table").innerHTML = `
      <table class="admin-data-table">
        <thead><tr><th>Ficha</th><th>Grupo</th><th>Aprendices</th><th>Guias</th><th>Progreso</th><th>Estado</th><th>Codigo de invitacion</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="admin-risk-note">Contrato local activo: las fichas se leen desde FICHA_MAP para conservar rutas y accesos. La gestion de altas, bajas o cambios queda centralizada en ese mapa.</p>
      <p class="admin-risk-note">Fase 6 (auditoria profunda): conocer la ficha ya no basta para registrarse -- el aprendiz tambien necesita este codigo. El servidor solo guarda un hash: NO existe forma de volver a ver un codigo ya generado, solo de reemplazarlo por uno nuevo. Copialo apenas se genere y entregaselo tu mismo a los aprendices autorizados de esa ficha; regenerarlo invalida el anterior de inmediato.</p>
    `;
    wireFichaCodeButtons();
  }

  // Genera un codigo aleatorio en el propio navegador del admin (alfabeto
  // sin caracteres ambiguos: sin 0/O, 1/I/L). Nunca se deriva de nada
  // predecible ni se envia a ningun lado hasta que el admin confirma.
  function generateRandomFichaCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(8);
    (window.crypto || {}).getRandomValues
      ? window.crypto.getRandomValues(bytes)
      : bytes.forEach((_, i) => { bytes[i] = Math.floor(Math.random() * 256); });
    let code = "";
    for (let i = 0; i < bytes.length; i++) code += chars[bytes[i] % chars.length];
    return code;
  }

  // Fase 6 (auditoria profunda): "Generar" reemplaza el codigo anterior de
  // inmediato (el servidor solo guarda el hash del ultimo) -- se pide
  // confirmacion porque invalida cualquier codigo ya entregado a los
  // aprendices de esa ficha. El codigo en texto plano SOLO existe en este
  // navegador, en este momento: se muestra una vez con una advertencia
  // clara y no queda ningun rastro recuperable despues.
  function wireFichaCodeButtons() {
    document.querySelectorAll("[data-generate-ficha-code]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ficha = btn.getAttribute("data-generate-ficha-code");
        const statusEl = document.querySelector('[data-ficha-code-status="' + ficha + '"]');
        const proceed = await confirmAdminAction(
          "Esto genera un codigo NUEVO para la ficha " + ficha + " y deja de aceptar el anterior de inmediato. ¿Continuar?"
        );
        if (!proceed) return;

        const db = window._firebaseDb;
        if (!db || typeof db.setRegistrationCode !== "function") {
          if (statusEl) statusEl.textContent = "La integracion con Apps Script no esta disponible.";
          return;
        }
        const code = generateRandomFichaCode();
        btn.setAttribute("disabled", "disabled");
        if (statusEl) statusEl.textContent = "Generando...";
        try {
          const result = await db.setRegistrationCode(ficha, code);
          if (result && result.ok) {
            if (statusEl) {
              statusEl.innerHTML =
                '<strong>Codigo nuevo (copialo ahora, no se volvera a mostrar):</strong> ' +
                '<code>' + escapeHtml(code) + '</code>';
            }
          } else {
            if (statusEl) statusEl.textContent = (result && result.message) || "No se pudo guardar el codigo. Intenta de nuevo.";
          }
        } catch (_) {
          if (statusEl) statusEl.textContent = "No se pudo guardar el codigo. Intenta de nuevo.";
        } finally {
          btn.removeAttribute("disabled");
        }
      });
    });
  }

  function renderGuides() {
    const rows = getFichaEntries().flatMap(([ficha, info]) =>
      (info.guias || []).map((fileName) => `
        <tr>
          <td>${escapeHtml(ficha)}<br><span class="admin-muted">Grupo ${escapeHtml(info.grupo)}</span></td>
          <td><strong>${escapeHtml(guideLabel(fileName))}</strong><br><span class="admin-muted">${escapeHtml(fileName)}</span></td>
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
              <td>${escapeHtml(guideLabel(fileName))}</td>
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

  // Clave antigua del limite de la hidratacion completa (ya no existe); se
  // conserva solo para que "Actualizar datos" limpie el valor que quede.
  const DASHBOARD_HYDRATE_THROTTLE_KEY = "sena_admin_dashboard_hydrate_last_v1";

  // ── Respuestas y Entregas: consulta SELECTIVA por aprendiz (2026-10-22) ──
  // Antes, al abrir Respuestas o Entregas se descargaba el estado de TODOS los
  // aprendices x TODAS sus guias (ensureGuideStatesHydrated: perfil + hasta 4
  // GET por guia y una consulta a Drive por documento ausente; ~8000 lecturas y
  // ~3500 llamadas a Apps Script con 159 aprendices). Ahora el flujo es
  // ficha -> aprendiz -> guia (opcional) -> "Consultar": solo ese aprendiz y
  // esas guias, con _firebaseDb.cloudReadGuideDataDetailed (2-3 peticiones
  // batchGet y el motivo real de cada fallo). Lo traido va a la MISMA cache en
  // memoria que leen las tablas, "Ver" y la exportacion (guideDataCacheSet), sin
  // pisar ediciones locales mas nuevas (pickLatestSnapshot). Cache por sesion
  // de admin + aprendiz + guia, 10 minutos; "Actualizar" relee.
  const LEARNER_TTL_MS = 10 * 60 * 1000;
  const learnerConsult = { session: "", pairs: new Map(), inflight: new Map(), status: { respuestas: null, entregas: null } };
  const LEARNER_STATUS_RANK = { ok: 0, incomplete: 1, timeout: 2, unavailable: 2, error: 2, offline: 3, quota: 4, denied: 5 };

  function ensureLearnerSession() {
    const key = habSessionKey();
    if (key !== learnerConsult.session) {
      learnerConsult.pairs.clear();
      learnerConsult.inflight.clear();
      learnerConsult.status = { respuestas: null, entregas: null };
      learnerConsult.session = key;
    }
  }

  function learnerPairKey(usernameKey, fileName) {
    return `${usernameKey}|${fileName}`;
  }

  // Guia de un aprendiz ya consultada en esta sesion (vigente o no).
  function getLearnerPair(usernameKey, fileName) {
    ensureLearnerSession();
    return learnerConsult.pairs.get(learnerPairKey(usernameKey, fileName)) || null;
  }

  function markLearnerPairStale(usernameKey, fileName) {
    const pair = learnerConsult.pairs.get(learnerPairKey(usernameKey, fileName));
    if (pair) pair.stale = true;
  }

  function cloudNamesForGuide(fileName) {
    const hab = window.adminHabilitacion;
    if (hab && typeof hab.getCloudFileNamesForGuide === "function") return hab.getCloudFileNamesForGuide(fileName);
    const config = getGuideCloudConfig(fileName);
    return [config?.cloudFileName || fileName];
  }

  // Consulta (solo lectura) las guias `files` de UN aprendiz.
  // -> { status, consulted, fromCache, stats }
  async function consultLearnerGuides(user, files, options = {}) {
    ensureLearnerSession();
    const db = window._firebaseDb;
    if (!user || !user.usernameKey) return { status: "error", consulted: 0, fromCache: 0 };
    if (!hasAdminPanelAccess()) return { status: "denied", consulted: 0, fromCache: 0 };
    if (!db || typeof db.cloudReadGuideDataDetailed !== "function") return { status: "error", consulted: 0, fromCache: 0 };
    const now = Date.now();
    let fromCache = 0;
    const targets = [];
    (files || []).forEach((fileName) => {
      const stateKey = getGuideStateKey(fileName);
      if (!stateKey) return;
      const pair = learnerConsult.pairs.get(learnerPairKey(user.usernameKey, fileName));
      if (!options.force && pair && pair.status === "ok" && !pair.stale && (now - pair.at) < LEARNER_TTL_MS) {
        fromCache += 1;
        return;
      }
      targets.push({ fileName, stateKey, names: cloudNamesForGuide(fileName) });
    });
    if (!targets.length) return { status: "ok", consulted: 0, fromCache };
    const names = [...new Set(targets.flatMap((t) => t.names))].sort();
    const inflightKey = `${user.usernameKey}|${names.join(",")}`;
    if (learnerConsult.inflight.has(inflightKey)) return learnerConsult.inflight.get(inflightKey); // doble clic
    const run = (async () => {
      const promotionDone = typeof db.isDrivePromotionDone === "function" && db.isDrivePromotionDone();
      const detailed = await db.cloudReadGuideDataDetailed(getStudentCloudScope(user.usernameKey), names, { skipDrive: promotionDone });
      const fetchedAt = Date.now();
      const statuses = [];
      targets.forEach((t) => {
        let fileStatus = "ok";
        const docs = [];
        t.names.forEach((name) => {
          const r = (detailed.files || {})[name] || { status: detailed.status, data: null };
          if (r.data && typeof r.data === "object") docs.push(r.data);
          if (r.status === "found" || r.status === "missing") return;
          const st = r.status === "partial" || r.status === "unverified" ? "incomplete" : (LEARNER_STATUS_RANK[r.status] ? r.status : "error");
          if ((LEARNER_STATUS_RANK[st] || 0) > (LEARNER_STATUS_RANK[fileStatus] || 0)) fileStatus = st;
        });
        statuses.push(docs.length ? (fileStatus === "ok" ? "ok" : "incomplete") : fileStatus);
        if (docs.length) {
          // Documento principal primero: gana los conflictos de campo.
          const state = {};
          let updatedAt = "";
          docs.slice().reverse().forEach((snap) => {
            const st = snap.state && typeof snap.state === "object" ? snap.state : (snap.data && typeof snap.data === "object" ? snap.data : null);
            if (st) Object.assign(state, st);
            if (String(snap.updatedAt || "") > updatedAt) updatedAt = String(snap.updatedAt || "");
          });
          const storageKey = auth.getStudentStorageKey(user.usernameKey, t.stateKey, { area: "guide-data" });
          const localState = readGuideDataState(storageKey);
          const localMeta = readGuideDataMeta(storageKey);
          const latest = pickLatestSnapshot(
            { state, updatedAt, updatedBy: "cloud" },
            localState ? { state: localState, updatedAt: localMeta?.updatedAt || "" } : null
          );
          if (latest && latest.state && typeof latest.state === "object") {
            guideDataCacheSet(storageKey, latest.state, latest.updatedAt ? { updatedAt: latest.updatedAt, updatedBy: latest.updatedBy || "cloud" } : {});
          }
        }
        if (!docs.length && fileStatus === "ok") {
          // La nube CONFIRMA que no hay documento: lo que hubiera en memoria
          // de una lectura anterior (p. ej. el listado general) ya no vale.
          // Se conservan solo las ediciones locales del admin (habilitar /
          // reabrir), que se guardan con updatedBy "admin-...".
          const storageKey = auth.getStudentStorageKey(user.usernameKey, t.stateKey, { area: "guide-data" });
          const localMeta = readGuideDataMeta(storageKey);
          if (!/^admin-/.test(String(localMeta?.updatedBy || ""))) {
            guideDataCacheSet(storageKey, {}, { updatedAt: "", updatedBy: "cloud-missing" });
          }
        }
        const prev = learnerConsult.pairs.get(learnerPairKey(user.usernameKey, t.fileName));
        learnerConsult.pairs.set(learnerPairKey(user.usernameKey, t.fileName), {
          status: docs.length ? (fileStatus === "ok" ? "ok" : "incomplete") : fileStatus,
          // Un fallo sin datos conserva la hora de la ultima lectura valida.
          at: !docs.length && fileStatus !== "ok" && prev ? prev.at : fetchedAt,
          stale: false,
          failed: !docs.length && fileStatus !== "ok",
        });
      });
      const recovered = statuses.some((s) => s === "ok" || s === "incomplete");
      const allOk = statuses.every((s) => s === "ok");
      const status = allOk ? "ok" : (recovered ? "incomplete" : statuses.reduce((a, b) => ((LEARNER_STATUS_RANK[b] || 0) > (LEARNER_STATUS_RANK[a] || 0) ? b : a), "ok"));
      return { status, consulted: targets.length, fromCache, stats: detailed.stats || null };
    })();
    learnerConsult.inflight.set(inflightKey, run);
    try {
      return await run;
    } catch (err) {
      console.warn("[admin] consulta selectiva fallo:", err);
      return { status: "error", consulted: 0, fromCache };
    } finally {
      learnerConsult.inflight.delete(inflightKey);
    }
  }

  const LEARNER_MESSAGES = {
    offline: "No fue posible conectar con la nube. Verifique su conexión e intente nuevamente.",
    denied: "No tiene autorización para consultar esta información.",
    quota: "Se alcanzó el límite diario de consultas de la nube. No se harán más intentos automáticos; intente de nuevo más tarde.",
    incomplete: "No fue posible recuperar toda la información. Algunos resultados podrían no aparecer.",
    service: "Ocurrió un problema al consultar la información. Intente nuevamente.",
  };

  function learnerStatusMessage(status) {
    if (LEARNER_MESSAGES[status]) return LEARNER_MESSAGES[status];
    return LEARNER_MESSAGES.service + (status === "timeout" ? " (tiempo de espera agotado)" : "");
  }

  // Indicadores del dashboard y Reportes: necesitan TODOS los aprendices. Se
  // alimentan del listado de documentos de guia que la carga de la lista de
  // aprendices YA descargo para calcular el progreso (0 lecturas adicionales).
  // No sustituye a lo consultado por aprendiz (que es mas reciente).
  let lastListingHydratedAt = 0;
  function hydrateFromLastListing() {
    const db = window._firebaseDb;
    const listing = db && typeof db.getGuideStatesFromLastListing === "function"
      ? db.getGuideStatesFromLastListing(state.users || [], (ficha) => getGuidesForFicha(ficha))
      : null;
    if (!listing || listing.at === lastListingHydratedAt) return false;
    listing.entries.forEach((entry) => {
      const stateKey = getGuideStateKey(entry.fileName);
      if (!stateKey) return;
      const storageKey = auth.getStudentStorageKey(entry.usernameKey, stateKey, { area: "guide-data" });
      const localState = readGuideDataState(storageKey);
      const localMeta = readGuideDataMeta(storageKey);
      const latest = pickLatestSnapshot(
        { state: entry.state, updatedAt: entry.updatedAt, updatedBy: "listado" },
        localState ? { state: localState, updatedAt: localMeta?.updatedAt || "" } : null
      );
      if (latest && latest.state && typeof latest.state === "object") {
        guideDataCacheSet(storageKey, latest.state, latest.updatedAt ? { updatedAt: latest.updatedAt, updatedBy: latest.updatedBy || "listado" } : {});
      }
    });
    lastListingHydratedAt = listing.at;
    return true;
  }

  // options.cloudFileName: escribir en un documento distinto del principal
  // (habilitacion de un candado que vive en un documento adicional de la guia).
  async function patchGuideCloudState(usernameKey, fileName, patch, options = {}) {
    const db = window._firebaseDb;
    const config = getGuideCloudConfig(fileName);
    if (!usernameKey || !config || !db || typeof db.cloudGetGuideData !== "function" || typeof db.cloudSaveGuideData !== "function") {
      return false;
    }
    const cloudFileName = options.cloudFileName || config.cloudFileName;
    const scopeKey = getStudentCloudScope(usernameKey);
    // Cambian datos del aprendiz: lo consultado de "Entregas recientes" deja de ser vigente.
    invalidateRecentDeliveries();
    const current = await db.cloudGetGuideData(scopeKey, cloudFileName).catch(() => null);
    const currentState = current?.state && typeof current.state === "object" ? current.state : {};
    const updatedAt = new Date().toISOString();
    return db.cloudSaveGuideData(scopeKey, cloudFileName, {
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
      guideTitle: guideLabel(fileName),
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

  // Auditoria 2026-08-22, Fase 11: una reentrega nunca borra la anterior (el
  // dato ya se conservaba en delivery.historialEntregas desde antes de esta
  // sesion, ver activity_standard.js._persistDeliveryToState), pero el panel
  // admin nunca lo mostraba -- el instructor no tenia forma de consultarlo.
  function buildDeliveryHistorySection(delivery) {
    const history = Array.isArray(delivery?.historialEntregas) ? delivery.historialEntregas : [];
    if (!history.length) return "";
    // Orden cronologico: la mas vieja primero ("Entrega 1"), terminando justo
    // antes de la actual (que ya se muestra arriba como "Fecha de entrega").
    const rows = history.map((item, index) => {
      const fecha = formatDate(item?.submittedAt || item?.confirmedAt || "");
      const hora = item?.submittedAt || item?.confirmedAt ? formatTime(item.submittedAt || item.confirmedAt) : "";
      const archivo = item?.savedFileName || "(sin archivo)";
      const link = item?.driveUrl
        ? `<a href="${escapeHtml(item.driveUrl)}" target="_blank" rel="noopener noreferrer">Ver archivo ↗</a>`
        : "—";
      const metodo = item?.method === "manual-verified" ? "Manual verificada" : "Automatica";
      return `
        <tr>
          <td>Entrega ${index + 1}</td>
          <td>${escapeHtml(fecha)}${hora ? " — " + escapeHtml(hora) : ""}</td>
          <td>${escapeHtml(archivo)}</td>
          <td>${escapeHtml(metodo)}</td>
          <td>${link}</td>
        </tr>
      `;
    }).join("");
    return `
      <h3>Historial de entregas (${history.length} anterior${history.length === 1 ? "" : "es"})</h3>
      <p class="admin-muted">La entrega actual se muestra arriba. Estas son las versiones anteriores: ninguna se borro al reemplazarla.</p>
      <table class="admin-data-table">
        <thead><tr><th>#</th><th>Fecha</th><th>Archivo</th><th>Metodo</th><th>Enlace</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function formatTime(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
    } catch (_) {
      return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    }
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
      ${buildDeliveryHistorySection(summary.delivery)}
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

  // Opciones de aprendiz de una ficha, filtradas LOCALMENTE por nombre. El
  // valor es el usernameKey (identificador real), nunca el nombre.
  function learnerOptionsHtml(ficha, selected, search, placeholder) {
    const term = normalizeText(search || "");
    const learners = getUsersForFicha(ficha)
      .slice()
      .sort((x, y) => String(x.fullName || "").localeCompare(String(y.fullName || ""), "es"))
      .filter((u) => !term || normalizeText(`${u.fullName} ${u.username || ""}`).includes(term) || u.usernameKey === selected);
    const head = !ficha
      ? '<option value="">Primero seleccione una ficha</option>'
      : `<option value="">${term && !learners.length ? "Ningun aprendiz coincide" : escapeHtml(placeholder)} (${learners.length})</option>`;
    return head + learners.map((u) =>
      `<option value="${escapeHtml(u.usernameKey)}"${u.usernameKey === selected ? " selected" : ""}>${escapeHtml(u.fullName || u.usernameKey)}</option>`
    ).join("");
  }

  function selectedLearner(ficha, learner) {
    if (!ficha || !learner) return null;
    return state.users.find((u) => u.usernameKey === learner && String(u.ficha) === String(ficha)) || null;
  }

  // Estado de la consulta del modulo para la seleccion actual (o null).
  function moduleConsultEntry(module, key) {
    const entry = learnerConsult.status[module];
    return entry && entry.key === key ? entry : null;
  }

  // Avisos comunes: consulta en curso, fallo, incompleta, informacion vencida.
  function learnerNoticesHtml(entry, user, guides) {
    const notes = [];
    const pairs = guides.map((g) => getLearnerPair(user.usernameKey, g)).filter(Boolean);
    if (entry && entry.status === "loading") notes.push(["info", "Consultando la información del aprendiz seleccionado…"]);
    else if (entry && entry.status && entry.status !== "ok") {
      const hasData = pairs.some((p) => !p.failed);
      notes.push([entry.status === "incomplete" ? "warning" : "danger",
        learnerStatusMessage(entry.status) + (hasData && entry.status !== "incomplete" ? " Se muestra la última información recuperada, que podría estar desactualizada." : "")]);
    } else if (pairs.some((p) => p.stale || (Date.now() - p.at) >= LEARNER_TTL_MS)) {
      notes.push(["warning", "Parte de esta información se consultó hace más de 10 minutos o cambió después. Pulse «Actualizar desde la nube» para traerla de nuevo."]);
    }
    if (pairs.length && pairs.length < guides.length && !(entry && entry.status === "loading")) {
      notes.push(["info", "Solo se muestran las guías ya consultadas de este aprendiz."]);
    }
    return notes.map(([tone, text]) => `<p class="c-alert c-alert--${tone}">${escapeHtml(text)}</p>`).join("");
  }

  function renderResponses() {
    ensureLearnerSession();
    const ficha = state.filters.responsesFicha || "";
    const guide = state.filters.responsesGuide || "";
    const learner = state.filters.responsesLearner || "";
    const activity = state.filters.responsesActivity || "";
    const statusFilter = state.filters.responsesStatus || "";
    byId("responses-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    byId("responses-guide-filter").innerHTML = getGuideOptionsForFicha(ficha, guide, true);
    // Busqueda LOCAL de aprendiz: filtra las opciones, nunca consulta la nube.
    byId("responses-learner-filter").innerHTML = learnerOptionsHtml(ficha, learner, state.filters.responsesText, "Seleccione un aprendiz");
    const activitiesForFilter = guide ? getResponseActivities(guide) : [];
    byId("responses-activity-filter").innerHTML =
      '<option value="">Todas las actividades</option>' +
      activitiesForFilter.map((item) =>
        `<option value="${escapeHtml(item.id)}"${activity === item.id ? " selected" : ""}>${escapeHtml(item.label)}</option>`
      ).join("");
    byId("responses-status-filter").value = statusFilter;
    const user = selectedLearner(ficha, learner);
    const key = `${ficha}|${learner}|${guide || "*"}`;
    const entry = moduleConsultEntry("respuestas", key);
    const loading = Boolean(entry && entry.status === "loading");
    ["responses-consult", "responses-refresh"].forEach((id) => { const btn = byId(id); if (btn) btn.disabled = !user || loading; });
    const statusEl = byId("responses-consult-status");
    if (statusEl) statusEl.textContent = entry && entry.status === "ok" ? entry.text : "";
    const table = (body) => `
      <table class="admin-data-table">
        <thead><tr><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Estado</th><th>Elaboracion</th><th>Actualizacion</th><th>Entrega</th><th>Acciones</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
    if (!user) {
      byId("responses-table").innerHTML = table('<tr><td colspan="9" id="responses-message">Seleccione una ficha y un aprendiz y pulse «Consultar respuestas».</td></tr>');
      return;
    }
    const guides = guide ? [guide] : getGuidesForFicha(user.ficha);
    // Solo las guias de ESTE aprendiz ya consultadas con datos validos.
    const consulted = guides.filter((g) => { const p = getLearnerPair(user.usernameKey, g); return p && !p.failed; });
    const notices = learnerNoticesHtml(entry, user, guides);
    if (!consulted.length) {
      const msg = loading
        ? "Consultando respuestas del aprendiz seleccionado…"
        : entry && entry.status && entry.status !== "ok"
          ? learnerStatusMessage(entry.status)
          : "Pulse «Consultar respuestas» para ver las respuestas de este aprendiz.";
      byId("responses-table").innerHTML = table(`<tr><td colspan="9" id="responses-message">${escapeHtml(msg)}</td></tr>`);
      return;
    }
    const rows = consulted.flatMap((fileName) => {
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
            <td>${escapeHtml(guideLabel(fileName))}</td>
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
    }).filter(Boolean).join("");
    byId("responses-table").innerHTML = notices + table(rows || '<tr><td colspan="9" id="responses-message">No hay respuestas que coincidan con los filtros actuales.</td></tr>');
  }

  // "Consultar"/"Actualizar" de Respuestas y Entregas: solo el aprendiz y las
  // guias seleccionados. Una consulta identica en curso no se repite.
  async function consultLearnerModule(module, options = {}) {
    const isResponses = module === "respuestas";
    const ficha = (isResponses ? state.filters.responsesFicha : state.filters.deliveriesFicha) || "";
    const learner = (isResponses ? state.filters.responsesLearner : state.filters.deliveriesLearner) || "";
    const guide = (isResponses ? state.filters.responsesGuide : state.filters.deliveriesGuide) || "";
    const user = selectedLearner(ficha, learner);
    if (!user) return null;
    const key = `${ficha}|${learner}|${guide || "*"}`;
    const current = learnerConsult.status[module];
    if (current && current.key === key && current.status === "loading") return null;
    const entry = { key, status: "loading", text: "", at: Date.now() };
    learnerConsult.status[module] = entry;
    const rerender = () => { if (state.activeModule === module) (isResponses ? renderResponses : renderDeliveries)(); };
    rerender();
    const files = guide ? [guide] : getGuidesForFicha(user.ficha);
    const result = await consultLearnerGuides(user, files, { force: Boolean(options.force) });
    if (learnerConsult.status[module] !== entry) return result; // la seleccion cambio
    entry.status = result.status;
    const when = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    const st = result.stats;
    entry.text = result.consulted
      ? `Consultado a las ${when}: ${result.consulted} guia${result.consulted !== 1 ? "s" : ""} de ${user.fullName}` +
        (st ? ` (${st.firestoreRequests} solicitudes, ${st.firestoreDocs} documentos${st.driveRequests ? `, ${st.driveRequests} a Drive` : ""}).` : ".")
      : `Consultado a las ${when}: informacion vigente reutilizada, sin nuevas lecturas.`;
    rerender();
    return result;
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
          guia: guideLabel(fileName),
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
    // Memoria del panel; nada academico a localStorage (igual que "Habilitar").
    guideDataCacheSet(storageKey, guideState, {
      updatedAt: now,
      updatedBy: `admin-reopen:${adminLabel}`,
      reabierta: true,
      activityId,
    });

    if (newDueAt.trim()) {
      await deadlineManager.savePolicy(fileName, activityId, newDueAt.trim(), adminLabel);
    }

    await syncReopenedActivityToCloud(usernameKey, fileName, stateKey, activityId, deliveryRecord, now, adminLabel).catch(() => false);
    // Lo consultado de esta guia ya no es vigente: el aviso invita a actualizar.
    markLearnerPairStale(usernameKey, fileName);
    recordAudit({
      action: "activity-reopen",
      target: `${usernameKey}:${fileName}:${activityId}`,
      detail: motivo || "Actividad reabierta",
    });
    setFeedback(`Actividad reabierta para ${user?.fullName || usernameKey}.`, "success");
    renderAll();
  }

  function renderDeliveries() {
    ensureLearnerSession();
    const ficha = state.filters.deliveriesFicha || "";
    const learner = state.filters.deliveriesLearner || "";
    const guide = state.filters.deliveriesGuide || "";
    const text = normalizeText(state.filters.deliveriesText);
    const fromIso = state.filters.deliveriesFrom || "";
    const toIso = state.filters.deliveriesTo || "";
    const fromMs = fromIso ? Date.parse(fromIso + "T00:00:00-05:00") : null; // inicio del dia en Bogota
    const toMs = toIso ? Date.parse(toIso + "T23:59:59-05:00") : null;       // fin del dia en Bogota
    byId("deliveries-ficha-filter").innerHTML = getFichaOptions(ficha, true);
    const learnerSel = byId("deliveries-learner-filter");
    if (learnerSel) learnerSel.innerHTML = learnerOptionsHtml(ficha, learner, state.filters.deliveriesLearnerSearch, "Seleccione un aprendiz");
    const guideSel = byId("deliveries-guide-filter");
    if (guideSel) guideSel.innerHTML = getGuideOptionsForFicha(ficha, guide, true);
    const periodSel = byId("deliveries-period");
    if (periodSel) periodSel.value = state.filters.deliveriesPeriod || "";
    if (byId("deliveries-from")) byId("deliveries-from").value = fromIso;
    if (byId("deliveries-to")) byId("deliveries-to").value = toIso;
    const user = selectedLearner(ficha, learner);
    const key = `${ficha}|${learner}|${guide || "*"}`;
    const entry = moduleConsultEntry("entregas", key);
    const loading = Boolean(entry && entry.status === "loading");
    ["deliveries-consult", "deliveries-refresh"].forEach((id) => { const btn = byId(id); if (btn) btn.disabled = !user || loading; });
    const statusEl = byId("deliveries-consult-status");
    if (statusEl) statusEl.textContent = entry && entry.status === "ok" ? entry.text : "";
    const table = (body) => `
      <table class="admin-data-table">
        <thead><tr><th>Archivo</th><th>Aprendiz</th><th>Ficha</th><th>Guia</th><th>Actividad</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
    if (!user) {
      state.filteredDeliveries = [];
      byId("deliveries-table").innerHTML = table('<tr><td colspan="8" id="deliveries-message">Seleccione una ficha y un aprendiz y pulse «Consultar entregas».</td></tr>');
      return;
    }
    const guides = guide ? [guide] : getGuidesForFicha(user.ficha);
    const consulted = new Set(guides.filter((g) => { const p = getLearnerPair(user.usernameKey, g); return p && !p.failed; }));
    const notices = learnerNoticesHtml(entry, user, guides);
    if (!consulted.size) {
      state.filteredDeliveries = [];
      const msg = loading
        ? "Consultando entregas del aprendiz seleccionado…"
        : entry && entry.status && entry.status !== "ok"
          ? learnerStatusMessage(entry.status)
          : "Pulse «Consultar entregas» para ver las entregas de este aprendiz.";
      byId("deliveries-table").innerHTML = table(`<tr><td colspan="8" id="deliveries-message">${escapeHtml(msg)}</td></tr>`);
      return;
    }
    // El filtro de fechas se aplica DESPUES de la consulta selectiva: las
    // entregas viven dentro del estado de cada guia (no hay un campo
    // consultable por fecha de entrega), asi que el periodo no reduce lecturas.
    const deliveries = collectDeliveries().filter((item) => {
      if (item.user.usernameKey !== user.usernameKey || !consulted.has(item.fileName)) return false;
      if (text && !normalizeText(`${item.savedFileName} ${item.activityId} ${auth.getGuideTitle(item.fileName)} ${guideLabel(item.fileName)}`).includes(text)) return false;
      const submittedMs = item.submittedAt ? Date.parse(item.submittedAt) : null;
      if (fromMs != null) {
        if (submittedMs == null || isNaN(submittedMs) || submittedMs < fromMs) return false;
      }
      if (toMs != null) {
        if (submittedMs == null || isNaN(submittedMs) || submittedMs > toMs) return false;
      }
      return true;
    }).sort((x, y) => String(y.submittedAt || "").localeCompare(String(x.submittedAt || "")));
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
          <td>${escapeHtml(guideLabel(item.fileName))}</td>
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
    const emptyMsg = fromIso || toIso || text
      ? "El aprendiz no tiene entregas registradas que coincidan con los filtros actuales."
      : "El aprendiz no tiene entregas registradas en las guías consultadas.";
    byId("deliveries-table").innerHTML = notices + table(rows || `<tr><td colspan="8" id="deliveries-message">${escapeHtml(emptyMsg)}</td></tr>`);
  }

  // Periodo predefinido -> rango de fechas (dias calendario en Bogota).
  function applyDeliveriesPeriod(value) {
    state.filters.deliveriesPeriod = value || "";
    if (!value || value === "custom") {
      if (!value) { state.filters.deliveriesFrom = ""; state.filters.deliveriesTo = ""; }
      return;
    }
    const days = Number(value) || 0;
    const bogotaDate = (ms) => new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
    state.filters.deliveriesTo = bogotaDate(Date.now());
    state.filters.deliveriesFrom = bogotaDate(Date.now() - (days - 1) * 86400000);
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
        guideLabel(item.fileName),
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

  // Optimizacion 2026-10-28: tras editar datos, activar/desactivar o corregir
  // nombres se recargaba la lista COMPLETA (usuarios + progreso de todos +
  // listado de guias: cientos de lecturas) para cambiar una fila. Ahora se
  // toma el registro LOCAL que portalAuth ya actualizo con la operacion
  // exitosa y se actualiza solo esa fila, conservando su progreso (0
  // lecturas). Si cambio la ficha (cambian sus guias) o no se encuentra el
  // registro, se recarga todo como antes. La cache de sesion de la lista se
  // invalida para que una recarga posterior traiga la nube.
  function patchLearnersFromLocal(usernameKeys) {
    const localUsers = typeof auth.getUsers === "function" ? (auth.getUsers() || []) : [];
    let needFull = false;
    (usernameKeys || []).forEach((key) => {
      const idx = state.users.findIndex((u) => u.usernameKey === key);
      const local = localUsers.find((u) => u && u.usernameKey === key);
      if (idx === -1 || !local) { needFull = true; return; }
      const current = state.users[idx];
      if (String(local.ficha || "") !== String(current.ficha || "")) { needFull = true; return; }
      const profile = Object.assign({}, local);
      delete profile.passwordHash;
      delete profile.progress;
      delete profile.guides;
      state.users[idx] = Object.assign({}, current, profile, { progress: current.progress });
    });
    try { sessionStorage.removeItem(USERS_CACHE_KEY); } catch (_) { /* sin sessionStorage */ }
    if (needFull || !(usernameKeys || []).length) return loadUsers();
    renderAll();
    return Promise.resolve();
  }

  async function loadUsers(options = {}) {
    if (!hasAdminPanelAccess()) {
      window.location.replace("index.html");
      return;
    }
    let fetched = null;
    let fromCache = false;
    // Solo se LEE el cache cuando se pide explicitamente (carga inicial / recarga).
    // Las mutaciones llaman loadUsers() sin opciones -> siempre bajan fresco.
    if (options.useCache) {
      try {
        const cached = JSON.parse(sessionStorage.getItem(USERS_CACHE_KEY) || "null");
        if (cached && Array.isArray(cached.users) && (Date.now() - Number(cached.at)) < USERS_CACHE_TTL_MS) {
          fetched = cached.users;
          fromCache = true;
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
    // Libera la cuota de localStorage que sesiones anteriores llenaron con el
    // guide-data de aprendices (ahora se cachea en memoria). Antes lo hacia la
    // hidratacion completa, que ya no existe.
    purgeStudentGuideDataFromLocal();
    // Indicadores del dashboard y Reportes desde el listado ya descargado para
    // el progreso (0 lecturas adicionales).
    if (!fromCache) hydrateFromLastListing();
    renderAll();
    // Si el respaldo de progreso desde datos de guia no se pudo consultar,
    // los porcentajes de algunas guias pueden estar incompletos: se avisa.
    const progressLoad = window._firebaseDb?.getLastStudentsProgressLoad?.();
    if (!fromCache && progressLoad && progressLoad.status && progressLoad.status !== "ok") {
      setFeedback(
        progressLoad.status === "quota"
          ? "Se alcanzó el límite diario de consultas de la nube: algunos porcentajes de avance podrían estar incompletos. Intente más tarde con «Actualizar datos»."
          : "No fue posible recuperar todos los datos de las guías: algunos porcentajes de avance podrían estar incompletos.",
        "warning"
      );
    }
    // Habilitacion no forma parte de renderAll: si el admin ya esta en el
    // modulo cuando llegan los aprendices, se pinta y arranca su carga.
    if (state.activeModule === "habilitacion") renderHabilitacionPanel();
    // La hidratacion pesada del guide_state (N aprendices x M guias) ya no corre
    // al cargar el panel: al abrir Respuestas/Entregas corre bajo demanda (ver
    // setActiveModule) y "Entregas recientes" consulta solo lo actualizado en
    // el periodo elegido, al pulsar su boton (ver consultRecentDeliveries).
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
    // Respuestas/Entregas: abrir el modulo NO consulta la nube (consulta
    // selectiva por aprendiz con su boton, ver consultLearnerGuides).
    if (moduleName === "respuestas") renderResponses();
    if (moduleName === "entregas") renderDeliveries();
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
    // Seguimiento del Laboratorio (historial de intentos, sep-29): una consulta
    // por ficha a sena_portal_hwlab_attempts; la vista anterior queda plegada.
    const trackHost = byId("hwtrack-host");
    if (trackHost && window.adminHwlabTracking && typeof window.adminHwlabTracking.mount === "function") {
      window.adminHwlabTracking.mount(trackHost, { auth, db: window._firebaseDb, users: state.users || [] });
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

  // ── Habilitacion: consulta SELECTIVA (auditoria 2026-10-22, 2a etapa) ─────
  // Flujo: ficha -> aprendiz -> guia (opcional) -> "Consultar actividades".
  // Entrar al modulo, elegir ficha/aprendiz/guia, escribir en los buscadores o
  // volver a dibujar el panel NO consultan la nube. Solo consultan "Consultar
  // actividades" (reutiliza lo ya consultado y vigente) y "Cargar estado desde
  // la nube" (fuerza la relectura de esa misma seleccion), y siempre solo el
  // aprendiz seleccionado. Reemplaza a la carga automatica por ficha anterior
  // (aprendices x guias x ~5 lecturas cada vez que se abria una ficha).
  const HAB_FICHA_PREF_KEY = "sena_portal_admin_hab_ficha_v1";
  const habConsult = { seq: 0, current: null }; // current: { key, status, text, at, token }
  // Al salir de la pagina (cerrar sesion, navegar, cache de retroceso del
  // navegador) no queda informacion academica consultada en memoria.
  window.addEventListener("pagehide", () => {
    habConsult.current = null;
    window.adminHabilitacion?.clearCache?.();
    recentDeliveries.cache.clear();
    learnerConsult.pairs.clear();
    learnerConsult.status = { respuestas: null, entregas: null };
  });

  function getHabilitacionFilters() {
    if (!state.habilitacionFilters) {
      let ficha = "";
      try { ficha = localStorage.getItem(HAB_FICHA_PREF_KEY) || ""; } catch (_) { /* sin localStorage */ }
      state.habilitacionFilters = { ficha, learnerSearch: "", learner: "", guide: "", activity: "" };
    }
    return state.habilitacionFilters;
  }

  function rememberHabilitacionFicha(ficha) {
    try {
      if (ficha) localStorage.setItem(HAB_FICHA_PREF_KEY, ficha);
      else localStorage.removeItem(HAB_FICHA_PREF_KEY);
    } catch (_) { /* preferencia opcional */ }
  }

  // Identifica la sesion de admin: la cache del modulo se descarta si cambia.
  function habSessionKey() {
    const session = auth?.getCurrentSession?.();
    if (!session) return "";
    return [session.role || "", session.usernameKey || session.user?.usernameKey || "", session.loggedAt || ""].join("|");
  }

  function habSelectionKey(filters) {
    return [filters.ficha || "", filters.learner || "", filters.guide || "*"].join("|");
  }

  function habSelectedLearner(filters) {
    if (!filters.ficha || !filters.learner) return null;
    return (state.users || []).find((u) => u.usernameKey === filters.learner && String(u.ficha) === String(filters.ficha)) || null;
  }

  function habSelectedGuides(filters) {
    const guides = filters.ficha && typeof auth.getGuidesForFicha === "function" ? auth.getGuidesForFicha(filters.ficha) : [];
    return filters.guide && guides.includes(filters.guide) ? [filters.guide] : guides;
  }

  function habDeps(extra) {
    return Object.assign({
      auth,
      deadlineManager: window.activityDeadlineManager,
      readJson: readJsonSafe,
      getUnlockActivitiesForGuide,
      getGuideActivityStateKey,
      sessionKey: habSessionKey(),
    }, extra || {});
  }

  function habStatusText(result, startedAt) {
    if (!result) return "";
    const when = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    const s = result.stats;
    const detail = s
      ? ` ${s.firestoreRequests} solicitud${s.firestoreRequests !== 1 ? "es" : ""} a Firestore (${s.firestoreDocs} documentos)` +
        (s.driveRequests ? `, ${s.driveRequests} a la réplica de Drive` : "") + `, ${Math.round((Date.now() - startedAt) / 100) / 10} s.`
      : "";
    if (!result.consulted) return `Consultado a las ${when}: información vigente reutilizada, sin nuevas lecturas.`;
    return `Consultado a las ${when}: ${result.consulted} guía${result.consulted !== 1 ? "s" : ""} del aprendiz.${detail}`;
  }

  // Consulta (solo lectura) la seleccion actual. Sin bucles: solo la invocan
  // los dos botones y la confirmacion posterior a "Habilitar"; una consulta
  // identica en curso no se duplica (doble clic).
  async function consultHabilitacionSelection(options = {}) {
    const hab = window.adminHabilitacion;
    const filters = getHabilitacionFilters();
    const learner = habSelectedLearner(filters);
    if (!hab || typeof hab.consultLearner !== "function" || !learner) return null;
    const key = habSelectionKey(filters);
    if (habConsult.current && habConsult.current.key === key && habConsult.current.status === "loading") return null;
    const token = ++habConsult.seq;
    const entry = { key, status: "loading", text: "Consultando actividades del aprendiz seleccionado…", at: Date.now(), token };
    habConsult.current = entry;
    if (state.activeModule === "habilitacion") renderHabilitacionPanel();

    let result;
    if (!hasAdminPanelAccess()) {
      result = { status: "denied", consulted: 0 };
    } else {
      const db = window._firebaseDb;
      const promotionDone = Boolean(db && typeof db.isDrivePromotionDone === "function" && db.isDrivePromotionDone());
      result = await hab.consultLearner(learner, options.guides || habSelectedGuides(filters), habDeps({
        force: Boolean(options.force),
        // Igual criterio que ensureGuideStatesHydrated: si la recuperacion
        // Drive->Firestore ya corrio, un documento ausente no se busca en Drive.
        skipDrive: promotionDone,
      }));
    }
    // Resultado de una seleccion que ya cambio: queda en cache, no se pinta.
    if (habConsult.current !== entry) return result;
    entry.status = result?.status || "error";
    entry.text = entry.status === "ok" ? habStatusText(result, entry.at) : "";
    if (state.activeModule === "habilitacion") renderHabilitacionPanel();
    return result;
  }

  function renderHabilitacionPanel() {
    const host = byId("habilitacion-host");
    if (!host) return;
    const hab = window.adminHabilitacion;
    if (!hab || typeof hab.buildHabilitacionPanel !== "function") {
      host.innerHTML = '<p class="activities-empty">Modulo adminHabilitacion no esta disponible.</p>';
      return;
    }
    const filters = getHabilitacionFilters();
    // Ficha recordada que ya no existe en la lista de aprendices.
    if (filters.ficha && (state.users || []).length && !(state.users || []).some((u) => String(u.ficha) === filters.ficha)) {
      Object.assign(filters, { ficha: "", learner: "", learnerSearch: "", guide: "" });
      rememberHabilitacionFicha("");
    }
    const current = habConsult.current && habConsult.current.key === habSelectionKey(filters) ? habConsult.current : null;
    host.innerHTML = hab.buildHabilitacionPanel(state.users || [], habDeps({
      filters,
      consult: current ? { status: current.status, text: current.text, at: current.at } : null,
    }));
    bindHabilitacionHandlers();
  }

  function bindHabilitacionHandlers() {
    const host = byId("habilitacion-host");
    if (!host) return;

    // Selectores: actualizan la seleccion y vuelven a dibujar; NUNCA consultan.
    const onSelect = () => {
      const filters = getHabilitacionFilters();
      const ficha = host.querySelector("#hab-filter-ficha")?.value || "";
      let learner = host.querySelector("#hab-filter-learner")?.value || "";
      let guide = host.querySelector("#hab-filter-guide")?.value || "";
      let learnerSearch = filters.learnerSearch || "";
      if (ficha !== filters.ficha) {
        // Otra ficha: el aprendiz y la guia anteriores no aplican.
        learner = "";
        learnerSearch = "";
        const allowed = ficha && typeof auth.getGuidesForFicha === "function" ? auth.getGuidesForFicha(ficha) : [];
        if (!allowed.includes(guide)) guide = "";
        rememberHabilitacionFicha(ficha);
      }
      Object.assign(filters, { ficha, learner, guide, learnerSearch });
      renderHabilitacionPanel();
    };
    host.querySelector("#hab-filter-ficha")?.addEventListener("change", onSelect);
    host.querySelector("#hab-filter-learner")?.addEventListener("change", onSelect);
    host.querySelector("#hab-filter-guide")?.addEventListener("change", onSelect);

    // Buscador de aprendiz: filtra LOCALMENTE las opciones del selector, sin
    // volver a dibujar el panel (el foco y el cursor no se pierden).
    host.querySelector("#hab-learner-search")?.addEventListener("input", (event) => {
      const filters = getHabilitacionFilters();
      filters.learnerSearch = event.target.value || "";
      const select = host.querySelector("#hab-filter-learner");
      if (select && window.adminHabilitacion?.buildLearnerOptionsHtml) {
        select.innerHTML = window.adminHabilitacion.buildLearnerOptionsHtml(state.users || [], filters.ficha, filters.learnerSearch, filters.learner);
      }
    });

    // Filtro de actividad: local sobre lo ya consultado; conserva el foco.
    host.querySelector("#hab-filter-activity")?.addEventListener("input", debounce((event) => {
      const filters = getHabilitacionFilters();
      filters.activity = event.target.value || "";
      const caret = event.target.selectionStart;
      renderHabilitacionPanel();
      const input = byId("habilitacion-host")?.querySelector("#hab-filter-activity");
      if (input) {
        input.focus();
        try { input.setSelectionRange(caret, caret); } catch (_) { /* sin seleccion */ }
      }
    }, 250));

    host.querySelectorAll("[data-hab-unlock]").forEach((button) => {
      button.addEventListener("click", () => handleUnlockClick(button));
    });

    host.querySelector("#hab-consult")?.addEventListener("click", () => { void consultHabilitacionSelection(); });
    host.querySelector("#hab-cloud-sync")?.addEventListener("click", () => { void consultHabilitacionSelection({ force: true }); });
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
      const unlockPatch = (extra) => patchGuideCloudState(usernameKey, guideFile, {
        state: lockKeys.reduce((acc, key) => {
          if (/-locked$/.test(key)) acc[key] = false;
          return acc;
        }, { reabierta: true, permiteEdicion: true }),
        updatedBy: `admin-activity-unlock:${activity.id}`,
      }, extra);
      // La habilitacion solo cuenta como hecha si la nube confirma la
      // escritura (antes el resultado se ignoraba: un fallo se veia como exito).
      const savedPrimary = await unlockPatch();
      if (!savedPrimary) throw new Error("la nube no confirmó el cambio; intente nuevamente");
      // Memoria del panel (Respuestas/Entregas); nada academico a localStorage.
      guideDataCacheSet(storageKey, nextState, { updatedAt: nextState.updatedAt, updatedBy: "admin-activity-unlock" });
      // Candados que viven en un documento ADICIONAL de la guia (p. ej. la
      // Guia 10 Redes RAP01 de Kennedy guarda la guia con su nombre crudo y el
      // quiz en el alias jfk_): se habilitan tambien en ese documento.
      const primaryCloudFile = getGuideCloudConfig(guideFile)?.cloudFileName || "";
      const lockSources = String(button.dataset.habLockSources || "").split(",").filter(Boolean);
      for (const cloudFileName of lockSources) {
        if (cloudFileName === primaryCloudFile) continue;
        const savedExtra = await unlockPatch({ cloudFileName });
        if (!savedExtra) throw new Error("la nube no confirmó el cambio en el documento adicional; intente nuevamente");
      }
      // Lo consultado antes ya no es vigente: se descarta y se vuelve a leer
      // SOLO esta guia de este aprendiz (confirma el cambio en la nube).
      window.adminHabilitacion?.clearLockKeys?.(storageKey, lockKeys, nextState.updatedAt);
      window.adminHabilitacion?.invalidate?.(storageKey);

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

      // Antes aqui se recargaba la lista COMPLETA de aprendices con progreso
      // (fetchStudentsWithProgress: miles de lecturas por cada habilitacion).
      // Basta con releer la guia habilitada de este aprendiz; la lista de
      // aprendices y la seleccion se conservan.
      await consultHabilitacionSelection({ force: true, guides: [guideFile] });
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
        <td>${escapeHtml(guideLabel(guide.fileName) || guide.title)}</td>
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
              data-reset-guide-title="${escapeHtml(guideLabel(guide.fileName) || guide.title)}"
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
    // Si esta guia de este aprendiz ya se consulto y sigue vigente, se usa lo
    // que hay en memoria (sin otra lectura a la nube).
    const pair = getLearnerPair(usernameKey, fileName);
    const fresh = Boolean(pair && pair.status === "ok" && !pair.stale && (Date.now() - pair.at) < LEARNER_TTL_MS);
    if (config && !fresh) {
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
    markGradeCellSync(select, "saving");
    // La promesa resuelve con el resultado REAL en la nube (lectura verificada +
    // escritura condicionada, ver activity_grades.js). Antes era
    // fire-and-forget y se anunciaba "Calificacion guardada." aunque la
    // escritura fallara.
    let saveResult;
    try {
      saveResult = await gradesManager.setStudentActivityGradeAndSolution(usernameKey, guideFamily, activityId, nextGrade, solution);
    } catch (err) {
      saveResult = { ok: false, status: "write-failed", message: err && err.message ? err.message : String(err) };
    }
    if (!saveResult || !saveResult.ok) {
      reportGradeSaveFailure(select, saveResult);
      return;
    }
    markGradeCellSync(select, "");
    select.dataset.previousGrade = nextGrade;

    // Controles de comentario: visibles con CUALQUIER nota (A o D). Al quitar la
    // nota (celda en "—") se ocultan y se borra la observacion, que ya no tiene
    // a que referirse. Al pasar de D a A la observacion SE CONSERVA (pedido
    // explicito del usuario 2026-09-15): antes se borraba, y con ello se perdia
    // la retroalimentacion al aprobar una actividad tras la correccion.
    // El desplegable se repuebla porque los comentarios de "Aprobado" no sirven
    // para una "D" y viceversa.
    const cell = select.closest(".grade-cell");
    const commentSelect = cell?.querySelector(".grade-comment-select");
    const obsInput = cell?.querySelector(".grade-obs-input");
    if (commentSelect) {
      commentSelect.innerHTML = commentOptionsMarkup(nextGrade);
      commentSelect.value = "";
      commentSelect.hidden = !nextGrade;
    }
    if (obsInput) {
      obsInput.hidden = !nextGrade;
      if (!nextGrade) {
        obsInput.value = "";
        try { await gradesManager.setStudentActivityObservation(usernameKey, guideFamily, activityId, ""); } catch (e) { /* no critico */ }
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

  // Insertar un comentario del banco en la celda: SOLO rellena el campo de texto
  // (que queda editable) y lo guarda. El desplegable vuelve a su estado neutro
  // porque no representa la observacion, solo es un atajo para escribirla.
  function handleGradeCommentSelect(select) {
    const obsInput = select.closest(".grade-cell")?.querySelector(".grade-obs-input");
    if (!obsInput) return;
    const chosen = getGradeComments().find((c) => c.id === select.value);
    select.value = "";
    if (!chosen) return;
    obsInput.value = chosen.texto;
    saveGradeObservation(obsInput);
  }

  // Guarda la observacion escrita/insertada. Es el UNICO camino de guardado
  // (insertar del banco tambien pasa por aqui), asi que el texto siempre queda
  // tal cual lo dejo el instructor, lo haya elegido o escrito a mano.
  async function saveGradeObservation(input) {
    const usernameKey = input.dataset.gradeUser || "";
    const guideFamily = input.dataset.gradeFamily || "";
    const activityId = input.dataset.gradeActivity || "";
    const gradesManager = window.activityGradesManager;
    if (!gradesManager || !usernameKey || !guideFamily || !activityId) return;
    const message = String(input.value || "").trim();
    window.portalSaveStatus?.saving("Guardando observacion...");
    let result;
    try {
      result = await gradesManager.setStudentActivityObservation(usernameKey, guideFamily, activityId, message);
    } catch (err) {
      result = { ok: false, status: "write-failed", message: err && err.message ? err.message : String(err) };
    }
    if (result && result.ok) {
      window.portalSaveStatus?.saved(message ? "Observacion guardada." : "Observacion borrada.");
      return;
    }
    const why = (result && result.message) || "No se pudo confirmar el guardado en la nube.";
    window.portalSaveStatus?.error("La observacion NO se guardo en la nube.");
    setFeedback("La observacion NO se guardo en la nube: " + why + pendingGradesSuffix(result), "error");
  }

  // Estado visual de una celda mientras su nota no este confirmada en la nube.
  function markGradeCellSync(select, stateName) {
    const cell = select && select.closest ? select.closest(".grade-cell") : null;
    if (!cell) return;
    if (stateName) cell.dataset.syncState = stateName;
    else delete cell.dataset.syncState;
    if (stateName === "pending") cell.title = "Calificacion pendiente: aun NO esta guardada en la nube.";
    else cell.removeAttribute("title");
  }

  function pendingGradesSuffix(result) {
    return result && result.pending
      ? " El cambio quedo pendiente en este equipo y se reintentara automaticamente; no se mostrara como guardado hasta confirmarlo."
      : "";
  }

  const GRADE_ROW_PENDING_MARKUP = '<span class="grade-row-pending">&#9888; Cambios sin guardar</span>';

  function reportGradeSaveFailure(select, result) {
    const why = (result && result.message) || "No se pudo confirmar el guardado en la nube.";
    markGradeCellSync(select, result && result.pending ? "pending" : "error");
    const nameCell = select.closest("tr[data-grade-row]")?.querySelector("td:first-child");
    if (nameCell && !nameCell.querySelector(".grade-row-pending")) nameCell.insertAdjacentHTML("beforeend", GRADE_ROW_PENDING_MARKUP);
    window.portalSaveStatus?.error("La calificacion NO se guardo en la nube.");
    setFeedback("La calificacion NO se guardo en la nube: " + why + pendingGradesSuffix(result), "error");
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
    if (!db || typeof db.cloudGetGradesStrict !== "function" || !gradesManager ||
        typeof gradesManager.embedStudentActivitySolution !== "function" ||
        typeof gradesManager.refreshStudentGradesFromCloud !== "function") {
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
        // Lectura estricta: si falla, este aprendiz se salta SIN tocar su
        // cache ni escribir nada (antes: {} -> cache vaciado -> la siguiente
        // nota reemplazaba en la nube todas sus notas).
        let read = null;
        try { read = await gradesManager.refreshStudentGradesFromCloud(user.usernameKey); } catch (_) { read = null; }
        if (!read || (read.status !== "found" && read.status !== "missing")) { failures++; continue; }
        const all = read.grades || {};
        const updates = computeSolutionResyncUpdates(all, lookupBankSolution);
        if (!updates.length) continue;
        learners += 1;
        const fieldsByFamily = {};
        let queuedEmbeds = 0;
        for (const up of updates) {
          try {
            if (up.needsEmbed) {
              const ok = gradesManager.embedStudentActivitySolution(user.usernameKey, up.family, up.activityId, up.solution);
              if (ok) queuedEmbeds += 1;
            }
            fieldsByFamily[up.family] = Object.assign(fieldsByFamily[up.family] || {}, up.solution);
          } catch (_) { failures++; }
        }
        if (queuedEmbeds) {
          // Solo se cuentan (y se aplican a la guia) si la nube CONFIRMA la escritura.
          const synced = await gradesManager.flushGradesCloudSync(user.usernameKey);
          if (!synced || !synced.ok) { failures++; continue; }
          embedded += queuedEmbeds;
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

  // ── Banco de comentarios de calificacion ────────────────────────────────────
  // Frases de retroalimentacion reutilizables. Sustituye a los 2 motivos fijos
  // + window.prompt que existian antes (GRADE_REJECTION_REASONS): esos dos
  // textos sobreviven como semillas de tipo "no-aprobado", asi que nada se
  // pierde. Se guardan en Firestore (sena_portal_grade_comments/bank, solo
  // admin) para que el instructor los tenga en cualquier equipo.
  // NO tiene relacion con grade_solutions_bank.json (respuestas modelo de las
  // actividades): aqui solo hay texto del instructor.
  // El texto elegido se guarda con setStudentActivityObservation
  // (activity_grades.js) dentro de las notas del aprendiz ({actId}:obs) y el
  // aprendiz lo ve junto a su badge, tanto en Aprobado como en No aprobado.
  const GRADE_COMMENT_TYPES = { aprobado: "Aprobado", "no-aprobado": "No aprobado", general: "General" };

  const GRADE_COMMENT_SEEDS = [
    { texto: "Actividad aprobada correctamente.", tipo: "aprobado" },
    { texto: "La actividad cumple con lo solicitado.", tipo: "aprobado" },
    { texto: "Buen trabajo, evidencia completa.", tipo: "aprobado" },
    { texto: "Actividad incompleta.", tipo: "no-aprobado" },
    { texto: "Faltan evidencias.", tipo: "no-aprobado" },
    { texto: "Debe corregir y volver a entregar.", tipo: "no-aprobado" },
    { texto: "El archivo entregado no corresponde a la actividad.", tipo: "no-aprobado" },
    { texto: "Evidencia insuficiente.", tipo: "no-aprobado" },
    { texto: "Debe mejorar la presentación.", tipo: "general" },
    { texto: "Debe completar los puntos faltantes.", tipo: "no-aprobado" },
    { texto: "No entregó la actividad.", tipo: "no-aprobado" },
    { texto: "Requiere revisión o corrección.", tipo: "general" },
    // Los 2 motivos que ya existian en el panel antes del banco (2026-07-09).
    { texto: "No entregó la actividad en los tiempos establecidos.", tipo: "no-aprobado" },
    { texto: "No entregó la actividad como se solicitó en la guía.", tipo: "no-aprobado" },
  ];

  // Clave anti-duplicados: mismo texto sin tildes, sin mayusculas, sin espacios
  // extra y sin puntuacion final cuenta como el mismo comentario.
  function gradeCommentKey(texto) {
    return String(texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[.;:,!¡?¿]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeGradeComment(entry, index) {
    const texto = String((entry && entry.texto) || "").trim().slice(0, 300);
    if (!texto) return null;
    const tipo = GRADE_COMMENT_TYPES[entry && entry.tipo] ? entry.tipo : "general";
    const id = String((entry && entry.id) || ("c" + Date.now() + "_" + index));
    return { id, texto, tipo };
  }

  // Deduplica conservando el PRIMERO (el mas antiguo gana: no se pierde el que
  // el instructor ya venia usando).
  function dedupeGradeComments(list) {
    const seen = new Set();
    const out = [];
    (Array.isArray(list) ? list : []).forEach((raw, i) => {
      const c = normalizeGradeComment(raw, i);
      if (!c) return;
      const key = gradeCommentKey(c.texto);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    });
    return out;
  }

  let _gradeComments = null;
  let _gradeCommentsLoaded = false;  // true SOLO tras una lectura CONFIRMADA de Firestore
  // Precondicion de la proxima escritura: la version leida (updateTime) o
  // "el banco aun no existe". Sin ella no se escribe.
  let _gradeCommentsPrecondition = null;
  let _gradeCommentsLoadError = "";
  // 403 = la regla de sena_portal_grade_comments no esta desplegada (ruleset
  // 00ffe530): no se reintenta en cada repintado de la grilla durante la sesion.
  let _gradeCommentsDenied = false;

  // Carga el banco una vez por sesion. Si esta COMPLETAMENTE vacio, lo siembra
  // con GRADE_COMMENT_SEEDS y lo persiste. Si ya tiene algo (aunque sea un solo
  // comentario del instructor) NO se siembra ni se sobrescribe nada.
  // Un fallo de lectura NO marca el banco como cargado ni lo siembra:
  // cloudGetGradeComments devuelve [] tambien cuando la lectura falla, y antes
  // ese [] se tomaba por "banco vacio" -> se sembraba y se REEMPLAZABAN en la
  // nube los comentarios reales del instructor. Ahora se usa la lectura
  // estricta (found / missing / error) y toda escritura lleva precondicion.
  async function ensureGradeCommentsBank(force) {
    if (_gradeCommentsLoaded && !force) return _gradeComments;
    if (_gradeCommentsDenied && !force) return _gradeComments;
    const db = window._firebaseDb;
    if (!db || typeof db.cloudGetGradeCommentsStrict !== "function") {
      _gradeComments = _gradeComments || dedupeGradeComments(GRADE_COMMENT_SEEDS);
      return _gradeComments;   // sin nube: semillas en memoria, sin persistir
    }
    let remote = null;
    try {
      remote = await db.cloudGetGradeCommentsStrict();
    } catch (_) {
      remote = { status: "error", reason: "exception" };
    }
    if (!remote || (remote.status !== "found" && remote.status !== "missing")) {
      if (remote && (remote.reason === "http-403" || remote.reason === "http-401")) {
        // Sin permiso en las reglas desplegadas: las frases base quedan
        // disponibles SOLO en memoria para insertarlas en la observacion (la
        // observacion se guarda en el doc de notas, que si tiene regla); el
        // banco no se puede editar ni sembrar.
        _gradeCommentsDenied = true;
        _gradeCommentsLoadError = "El banco de comentarios no esta habilitado en las reglas de Firestore desplegadas; se muestran las frases base (no se pueden editar).";
        _gradeComments = _gradeComments && _gradeComments.length ? _gradeComments : dedupeGradeComments(GRADE_COMMENT_SEEDS);
        return _gradeComments;
      }
      _gradeCommentsLoadError = "No se pudo leer el banco de comentarios de la nube; no se puede modificar hasta que vuelva la conexion.";
      _gradeComments = _gradeComments || [];
      return _gradeComments;   // transitorio: se reintenta en la proxima lectura
    }
    _gradeCommentsLoaded = true;
    _gradeCommentsLoadError = "";
    _gradeCommentsPrecondition = remote.status === "found"
      ? { expectedUpdateTime: remote.updateTime }
      : { mustNotExist: true };
    const clean = dedupeGradeComments(remote.comments);
    if (!clean.length) {
      const seeds = dedupeGradeComments(GRADE_COMMENT_SEEDS);
      _gradeComments = seeds;
      try { await writeGradeCommentsBank(seeds); } catch (_) { /* se reintenta al proximo cambio */ }
    } else {
      _gradeComments = clean;
    }
    return _gradeComments;
  }

  function getGradeComments() {
    return Array.isArray(_gradeComments) ? _gradeComments : [];
  }

  // Escritura condicionada a la version leida. Lanza un Error con un mensaje
  // para el instructor si no se pudo confirmar el guardado.
  async function writeGradeCommentsBank(list) {
    const db = window._firebaseDb;
    if (!db || typeof db.cloudSaveGradeCommentsStrict !== "function") {
      throw new Error("el modulo de la nube esta desactualizado; recargue la pagina");
    }
    if (!_gradeCommentsLoaded || !_gradeCommentsPrecondition) {
      throw new Error(_gradeCommentsLoadError || "el banco no se ha leido de la nube todavia");
    }
    const result = await db.cloudSaveGradeCommentsStrict(list, _gradeCommentsPrecondition);
    if (result && result.status === "ok" && result.updateTime) {
      _gradeCommentsPrecondition = { expectedUpdateTime: result.updateTime };
      return list;
    }
    if (result && result.status === "ok") {
      // Guardado, pero sin version nueva: la proxima escritura exige releer.
      _gradeCommentsLoaded = false;
      return list;
    }
    if (result && result.status === "conflict") {
      _gradeCommentsLoaded = false;
      const err = new Error("el banco fue modificado desde otro equipo; se recargo, repita el cambio");
      err.code = "conflict";
      throw err;
    }
    const describe = window.activityGradesManager?.describeGradesSyncFailure;
    throw new Error(describe ? describe({ status: "write-failed", reason: result && result.reason }) : "no se pudo guardar en la nube");
  }

  async function saveGradeCommentsBank(list) {
    const previous = getGradeComments();
    _gradeComments = dedupeGradeComments(list);
    try {
      await writeGradeCommentsBank(_gradeComments);
    } catch (err) {
      // No se confirmo: se vuelve a lo que habia (no se finge un guardado).
      _gradeComments = previous;
      if (err && err.code === "conflict") await ensureGradeCommentsBank(true).catch(() => null);
      throw err;
    }
    return _gradeComments;
  }

  // Comentarios ofrecidos para una nota concreta: los de su tipo + los generales.
  // Sin nota todavia (celda en "—") no se ofrece ninguno.
  function gradeCommentsForGrade(grade) {
    if (!grade) return [];
    const tipo = grade === "A" ? "aprobado" : "no-aprobado";
    return getGradeComments().filter((c) => c.tipo === tipo || c.tipo === "general");
  }

  function gradeSelectMarkup(usernameKey, guideFamily, activityId, current, currentObs) {
    const cur = current || "";
    const obs = String(currentObs || "");
    function opt(value, label) {
      return `<option value="${value}"${cur === value ? " selected" : ""}>${label}</option>`;
    }
    const dataAttrs = `data-grade-user="${escapeHtml(usernameKey)}" `
      + `data-grade-family="${escapeHtml(guideFamily)}" data-grade-activity="${escapeHtml(activityId)}"`;
    const gradeSelect = `<select class="grade-select" ${dataAttrs} `
      + `data-previous-grade="${escapeHtml(cur)}" aria-label="Calificacion">`
      + opt("", "&mdash;") + opt("A", "Aprobado") + opt("D", "No aprobado") + `</select>`;
    // Los controles de comentario aparecen con CUALQUIER nota (A o D), no solo
    // con "No aprobado": el instructor tambien quiere dejar constancia en una
    // actividad aprobada ("Buen trabajo, evidencia completa").
    const hidden = cur ? "" : " hidden";
    const commentSelect = `<select class="grade-comment-select" ${dataAttrs}`
      + ` aria-label="Comentario del banco"${hidden}>`
      + commentOptionsMarkup(cur)
      + `</select>`;
    const obsInput = `<input type="text" class="grade-obs-input" ${dataAttrs}`
      + ` maxlength="500" placeholder="Observación para el aprendiz (opcional)"`
      + ` aria-label="Observacion" value="${escapeHtml(obs)}"${hidden}>`;
    return `<div class="grade-cell">${gradeSelect}${commentSelect}${obsInput}</div>`;
  }

  // Opciones del desplegable de comentarios para una nota dada. Se regenera al
  // cambiar la nota (los comentarios de "Aprobado" no sirven para una "D").
  function commentOptionsMarkup(grade) {
    const list = gradeCommentsForGrade(grade);
    const head = '<option value="">Insertar comentario del banco…</option>';
    if (!list.length) return head;
    return head + list.map((c) =>
      `<option value="${escapeHtml(c.id)}">${escapeHtml(c.texto)}</option>`).join("");
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
      <details class="grades-bank-import" id="grades-comments-bank">
        <summary>Banco de comentarios <span id="grades-comments-count" class="admin-muted"></span></summary>
        <p class="admin-muted">Frases de retroalimentacion reutilizables. Al calificar, el desplegable de cada celda las ofrece segun la nota (Aprobado / No aprobado / General) y el texto queda editable antes de guardarse. Es independiente del banco de respuestas modelo de arriba.</p>
        <div class="grade-comment-new">
          <input type="text" id="grade-comment-text" maxlength="300" placeholder="Nuevo comentario">
          <select id="grade-comment-type">
            <option value="aprobado">Aprobado</option>
            <option value="no-aprobado">No aprobado</option>
            <option value="general">General</option>
          </select>
          <button type="button" id="grade-comment-add" class="btn secondary">Agregar</button>
        </div>
        <span id="grade-comment-status" class="admin-muted"></span>
        <ul id="grade-comment-list" class="grade-comment-list"></ul>
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
    // El banco de comentarios se carga (y se siembra si esta vacio) antes de que
    // la grilla arme sus desplegables; si tarda, renderGradesGrid lo vuelve a
    // esperar, asi que nunca se pinta una celda con el banco a medias.
    ensureGradeCommentsBank().then(renderGradeCommentBank).catch(() => renderGradeCommentBank());
    byId("grades-bank-import-btn")?.addEventListener("click", handleGradeBankImport);
    byId("grades-resync-btn")?.addEventListener("click", handleSolutionResync);
    byId("grades-excel-download-btn")?.addEventListener("click", handleGradesExcelDownload);
    byId("grades-excel-upload-btn")?.addEventListener("click", handleGradesExcelUpload);
    byId("grade-comment-add")?.addEventListener("click", handleGradeCommentAdd);
    bindGradesSyncListener();
  }

  // ── Banco de comentarios: lista + alta/edicion/borrado ──────────────────────
  function renderGradeCommentBank() {
    const list = byId("grade-comment-list");
    const count = byId("grades-comments-count");
    const comments = getGradeComments();
    if (count) count.textContent = `(${comments.length})`;
    if (!list) return;
    list.innerHTML = comments.length
      ? comments.map((c) => `
        <li class="grade-comment-item" data-comment-id="${escapeHtml(c.id)}">
          <span class="grade-comment-tag">${escapeHtml(GRADE_COMMENT_TYPES[c.tipo] || "General")}</span>
          <span class="grade-comment-text">${escapeHtml(c.texto)}</span>
          <button type="button" class="btn secondary grade-comment-edit" data-comment-id="${escapeHtml(c.id)}">Editar</button>
          <button type="button" class="btn secondary grade-comment-delete" data-comment-id="${escapeHtml(c.id)}">Eliminar</button>
        </li>`).join("")
      : '<li class="admin-muted">El banco esta vacio.</li>';
    // Si el banco no se pudo leer (o no tiene permiso), se dice aqui mismo:
    // la lista que se ve no es el banco de la nube.
    if (!_gradeCommentsLoaded && _gradeCommentsLoadError) setCommentStatus(_gradeCommentsLoadError);
  }

  function setCommentStatus(msg) {
    const el = byId("grade-comment-status");
    if (el) el.textContent = msg || "";
  }

  // Repuebla los desplegables ya pintados en la grilla tras cambiar el banco,
  // para no obligar a recargar el modulo. Conserva la nota y la observacion de
  // cada celda (solo se tocan las <option> del desplegable del banco).
  function refreshGradeCommentSelects() {
    document.querySelectorAll("#grades-grid .grade-cell").forEach((cell) => {
      const grade = cell.querySelector(".grade-select")?.value || "";
      const sel = cell.querySelector(".grade-comment-select");
      if (!sel) return;
      sel.innerHTML = commentOptionsMarkup(grade);
      sel.value = "";
    });
  }

  // Se pinta PRIMERO y se sincroniza despues (igual que el resto del panel).
  // Con la red lenta, esperar a Firestore antes de repintar dejaba la lista
  // congelada varios segundos: el instructor cree que el boton no hizo nada y
  // vuelve a pulsarlo. La lista en memoria ya quedo actualizada y deduplicada
  // por saveGradeCommentsBank, asi que lo que se pinta es el estado real.
  async function persistGradeCommentBank(next, okMsg) {
    const sync = saveGradeCommentsBank(next);   // actualiza _gradeComments de inmediato
    renderGradeCommentBank();
    refreshGradeCommentSelects();
    setCommentStatus("Guardando en la nube...");
    try {
      await sync;
      setCommentStatus(okMsg);
    } catch (err) {
      // saveGradeCommentsBank ya restauro el banco anterior: se repinta.
      renderGradeCommentBank();
      refreshGradeCommentSelects();
      setCommentStatus("NO se guardo el cambio: " + (err && err.message ? err.message : err));
    }
  }

  async function handleGradeCommentAdd() {
    const input = byId("grade-comment-text");
    const tipoSel = byId("grade-comment-type");
    const texto = String(input?.value || "").trim();
    if (!texto) { setCommentStatus("Escribe el comentario primero."); return; }
    const key = gradeCommentKey(texto);
    if (getGradeComments().some((c) => gradeCommentKey(c.texto) === key)) {
      setCommentStatus("Ese comentario ya esta en el banco.");
      return;
    }
    const next = getGradeComments().concat([{
      id: "c" + Date.now(),
      texto,
      tipo: (tipoSel && tipoSel.value) || "general",
    }]);
    if (input) input.value = "";
    await persistGradeCommentBank(next, "Comentario agregado.");
  }

  async function handleGradeCommentEdit(commentId) {
    const current = getGradeComments().find((c) => c.id === commentId);
    if (!current) return;
    const texto = window.prompt("Editar comentario:", current.texto);
    if (texto == null) return;                       // el instructor cancelo
    const limpio = String(texto).trim();
    if (!limpio) { setCommentStatus("El comentario no puede quedar vacio."); return; }
    const key = gradeCommentKey(limpio);
    if (getGradeComments().some((c) => c.id !== commentId && gradeCommentKey(c.texto) === key)) {
      setCommentStatus("Ya existe otro comentario con ese texto.");
      return;
    }
    const next = getGradeComments().map((c) =>
      (c.id === commentId ? { id: c.id, texto: limpio, tipo: c.tipo } : c));
    await persistGradeCommentBank(next, "Comentario actualizado.");
  }

  async function handleGradeCommentDelete(commentId) {
    const current = getGradeComments().find((c) => c.id === commentId);
    if (!current) return;
    const ok = await confirmAdminAction(`Eliminar del banco el comentario "${current.texto}"?`);
    if (!ok) return;
    const next = getGradeComments().filter((c) => c.id !== commentId);
    await persistGradeCommentBank(next, "Comentario eliminado.");
  }

  // Reutilizacion de lecturas verificadas al cambiar de guia/ficha (ver
  // refreshStudentGradesFromCloud). "Volver a leer" y "Reintentar ahora" leen
  // siempre de la nube (opts.fresh).
  const GRADES_GRID_REUSE_MS = 2 * 60 * 1000;
  async function renderGradesGrid(opts = {}) {
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
    // El banco de comentarios tiene que estar listo ANTES de armar las celdas:
    // gradeSelectMarkup pinta sus <option> una sola vez por render. Es idempotente
    // y cacheada, asi que en los siguientes renders no cuesta ninguna lectura.
    await ensureGradeCommentsBank().catch(() => null);
    renderGradeCommentBank();
    // Trae las notas de cada aprendiz desde Firestore (en paralelo) para prellenar.
    // Lectura ESTRICTA: antes cloudGetGrades devolvia {} tambien cuando la
    // lectura fallaba, la grilla lo copiaba al cache local y la siguiente nota
    // reemplazaba en la nube TODAS las notas del aprendiz (hallazgo critico
    // 2026-10-23). Ahora una fila cuya lectura fallo se muestra BLOQUEADA (sin
    // selects editables) y su cache no se toca. Las escrituras, ademas, ya no
    // dependen del cache: activity_grades.js relee la nube y aplica solo el
    // cambio de la actividad, con precondicion de version.
    const gradesManager = window.activityGradesManager;
    const gradesByUser = {};
    const unreadable = {};
    await Promise.all(students.map(async (user) => {
      let r = null;
      try {
        r = gradesManager && typeof gradesManager.refreshStudentGradesFromCloud === "function"
          ? await gradesManager.refreshStudentGradesFromCloud(user.usernameKey, { maxAgeMs: opts.fresh ? 0 : GRADES_GRID_REUSE_MS })
          : { status: "error", reason: "no-strict-api", message: "El modulo de notas esta desactualizado. Recargue la pagina." };
      } catch (_) {
        r = { status: "error", reason: "exception", message: "No se pudieron leer las notas actuales del aprendiz." };
      }
      if (r && (r.status === "found" || r.status === "missing")) {
        gradesByUser[user.usernameKey] = (r.grades && r.grades[guideFamily]) || {};
      } else {
        unreadable[user.usernameKey] = (r && r.message) || "No se pudieron leer las notas actuales del aprendiz.";
      }
    }));
    const head = "<th>Aprendiz</th>" + activities.map((a) => `<th>${escapeHtml(a.label)}</th>`).join("") + "<th>Aprobadas</th>";
    // resolveGradeValue cae a aliasIds: una fila fusionada (ej. matriz322+fichaCaso)
    // sigue mostrando una nota que haya quedado guardada bajo el id del alias
    // antes de la fusion, en vez de aparecer vacia.
    const resolveGrade = (window.activityGradesManager && window.activityGradesManager.resolveGradeValue)
      || ((g, a) => g[a.id]);
    const rows = students.map((user) => {
      if (unreadable[user.usernameKey]) {
        return `<tr data-grade-row="${escapeHtml(user.usernameKey)}" data-grade-unreadable="true">`
          + `<td>${escapeHtml(user.fullName)}</td>`
          + `<td colspan="${activities.length}" class="grades-row-error" role="alert"><div class="row-error__msg">`
          + `No se pudieron leer sus calificaciones: ${escapeHtml(unreadable[user.usernameKey])} `
          + `No se puede calificar a este aprendiz hasta leerlas (para no borrar notas existentes).</div></td>`
          + `<td class="grades-approved-cell">—</td></tr>`;
      }
      const g = gradesByUser[user.usernameKey] || {};
      const pendingActs = (gradesManager && typeof gradesManager.getPendingGradeActivities === "function"
        ? gradesManager.getPendingGradeActivities(user.usernameKey)[guideFamily] : null) || {};
      const cells = activities.map((a) => {
        const markup = gradeSelectMarkup(user.usernameKey, guideFamily, a.id, resolveGrade(g, a), g[a.id + ":obs"]);
        return `<td>${pendingActs[a.id]
          ? markup.replace('<div class="grade-cell">', '<div class="grade-cell" data-sync-state="pending" title="Calificacion pendiente: aun NO esta guardada en la nube.">')
          : markup}</td>`;
      }).join("");
      const approved = activities.filter((a) => resolveGrade(g, a) === "A").length;
      const rowPending = Object.keys(pendingActs).length ? GRADE_ROW_PENDING_MARKUP : "";
      return `<tr data-grade-row="${escapeHtml(user.usernameKey)}"><td>${escapeHtml(user.fullName)}${rowPending}</td>${cells}`
        + `<td class="grades-approved-cell">${approvalCellText(approved, activities.length)}</td></tr>`;
    }).join("");
    const scrollHintEl = byId("grades-scroll-hint");
    if (scrollHintEl) scrollHintEl.hidden = activities.length <= 5;
    const unreadableCount = Object.keys(unreadable).length;
    const pendingCount = gradesManager && typeof gradesManager.getPendingGradesCount === "function"
      ? gradesManager.getPendingGradesCount() : 0;
    const notices = [];
    if (unreadableCount) {
      notices.push(`<p class="c-alert c-alert--danger grades-read-alert" role="alert">No se pudieron leer las calificaciones de ${unreadableCount} aprendiz(es). `
        + `Sus filas quedan bloqueadas para no reemplazar notas existentes. `
        + `<button type="button" class="btn secondary" data-grades-reload>Volver a leer</button></p>`);
    }
    if (pendingCount) {
      notices.push(`<p class="c-alert c-alert--warning grades-pending-alert" role="status">Hay ${pendingCount} cambio(s) de calificacion pendientes de guardar en la nube desde este equipo. `
        + `<button type="button" class="btn secondary" data-grades-retry>Reintentar ahora</button></p>`);
    }
    grid.innerHTML = notices.join("")
      + `<table class="admin-data-table grades-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    bindGradesGridNotices(grid);
  }

  function bindGradesGridNotices(grid) {
    grid.querySelector("[data-grades-reload]")?.addEventListener("click", () => renderGradesGrid({ fresh: true }));
    grid.querySelector("[data-grades-retry]")?.addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      btn.disabled = true;
      const results = await window.activityGradesManager?.retryPendingGradesSync?.().catch(() => []);
      const failed = (results || []).filter((r) => r && !r.ok);
      if (failed.length) {
        setFeedback("Siguen pendientes " + failed.length + " aprendiz(es): " + (failed[0].message || ""), "error");
        window.portalSaveStatus?.error("Calificaciones pendientes sin guardar.");
      } else {
        window.portalSaveStatus?.saved("Calificaciones pendientes guardadas.");
      }
      renderGradesGrid({ fresh: true });
    });
  }

  // Un reintento automatico (activity_grades.js) que por fin guarda una nota
  // pendiente actualiza la celda y lo informa; uno que falla lo deja marcado.
  let gradesSyncListenerBound = false;
  function bindGradesSyncListener() {
    if (gradesSyncListenerBound || typeof window.addEventListener !== "function") return;
    gradesSyncListenerBound = true;
    window.addEventListener("grades-sync-status", (event) => {
      const detail = event && event.detail;
      if (!detail || !detail.result || !detail.usernameKey) return;
      const row = document.querySelector(`#grades-grid tr[data-grade-row="${CSS.escape(detail.usernameKey)}"]`);
      if (detail.result.ok && !detail.result.pending) {
        row?.querySelectorAll('.grade-cell[data-sync-state="pending"]').forEach((cell) => {
          delete cell.dataset.syncState;
          cell.removeAttribute("title");
        });
        row?.querySelector(".grade-row-pending")?.remove();
      }
    });
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
    if (!(await ensureXlsxLoaded())) { setStatus("La libreria de Excel no cargo."); return; }
    const { ficha, guideFamily } = currentGradesFichaAndFamily();
    const catalog = getGradeCatalog();
    const entry = catalog[guideFamily];
    if (!ficha || !guideFamily || !entry) { setStatus("Elige ficha y guia arriba primero."); return; }
    const activities = entry.activities || [];
    const students = getUsersForFicha(ficha).filter((u) => !isInactive(u));
    if (!students.length) { setStatus("No hay aprendices activos en esta ficha."); return; }
    setStatus("Generando Excel...");
    const gradesManager = window.activityGradesManager;
    const resolveGrade = (gradesManager && gradesManager.resolveGradeValue) || ((g, a) => g[a.id]);
    const gradesByUser = {};
    const unreadable = [];
    // Lectura estricta: un aprendiz cuya lectura falla NO sale "en blanco y 0 %"
    // (eso parecia una ausencia real de notas). Si alguno falla, no se genera.
    await Promise.all(students.map(async (user) => {
      let r = null;
      try {
        r = gradesManager && typeof gradesManager.refreshStudentGradesFromCloud === "function"
          ? await gradesManager.refreshStudentGradesFromCloud(user.usernameKey)
          : null;
      } catch (_) { r = null; }
      if (r && (r.status === "found" || r.status === "missing")) {
        gradesByUser[user.usernameKey] = (r.grades && r.grades[guideFamily]) || {};
      } else {
        unreadable.push(user.fullName || user.usernameKey);
      }
    }));
    if (unreadable.length) {
      setStatus(`No se genero el Excel: no se pudieron leer las calificaciones de ${unreadable.length} aprendiz(es) `
        + `(${unreadable.slice(0, 3).join(", ")}${unreadable.length > 3 ? "..." : ""}). Intente de nuevo cuando vuelva la conexion.`);
      return;
    }
    // Nombre completo primero (lo que el instructor reconoce a simple vista);
    // Usuario queda visible pero en segundo lugar -- sigue siendo la llave real
    // de emparejamiento al subir, sin importar el orden de las columnas.
    const sortedStudents = students.slice().sort((a, b) =>
      String(a.fullName || "").localeCompare(String(b.fullName || ""), "es"));

    // Fase 14: la construccion de filas/hojas es logica PURA, vive en
    // js/admin_grades_excel_transform.js (mismo codigo, sin cambios) para
    // poder probarla sin mockear XLSX ni el DOM. Encabezado = id corto de la
    // actividad (max ~19 caracteres en todo el catalogo), no la etiqueta
    // completa (algunas pasan de 40-50 caracteres, ej. "Producto 6 - Informe
    // de impacto (entrega final)"): con la etiqueta completa la columna queda
    // angosta y el texto se corta, o hay que hacer columnas tan anchas que la
    // tabla deja de caber en pantalla y es facil perderse calificando. La
    // hoja "Leyenda" trae el id -> descripcion.
    const transform = window.adminGradesExcelTransform;
    const { header, rows } = transform.buildGradesMainSheetRows(sortedStudents, activities, gradesByUser, resolveGrade);
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, ...activities.map(() => ({ wch: 15 }))];
    ws["!autofilter"] = { ref: window.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: header.length - 1 } }) };

    // Hoja de instrucciones + leyenda aparte, para no ensuciar la hoja de datos
    // (la libreria Excel de este proyecto es la version gratuita: no soporta
    // negrita, colores ni congelar paneles al escribir, asi que la organizacion
    // se hace con estructura -- hojas separadas, autofiltro, columnas cortas y
    // ordenadas -- en vez de formato visual).
    const instructionsRows = transform.buildGradesInstructionsRows(
      entry, guideFamily, ficha, sortedStudents.length, activities.length, new Date().toLocaleString("es-CO")
    );
    const instructions = window.XLSX.utils.aoa_to_sheet(instructionsRows);
    instructions["!cols"] = [{ wch: 100 }];

    const legendRows = transform.buildGradesLegendRows(activities);
    const legend = window.XLSX.utils.aoa_to_sheet(legendRows);
    legend["!cols"] = [{ wch: 22 }, { wch: 60 }];
    legend["!autofilter"] = { ref: window.XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: legendRows.length - 1, c: 1 } }) };

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, instructions, "Instrucciones");
    window.XLSX.utils.book_append_sheet(wb, legend, "Leyenda");
    window.XLSX.utils.book_append_sheet(wb, ws, "Calificaciones");
    window.XLSX.writeFile(wb, transform.buildGradesExportFileName(entry, guideFamily, ficha));
    setStatus(`Descargado: ${sortedStudents.length} aprendices, ${activities.length} actividades.`);
  }

  async function handleGradesExcelUpload() {
    const statusEl = byId("grades-excel-upload-status");
    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };
    if (!(await ensureXlsxLoaded())) { setStatus("La libreria de Excel no cargo."); return; }
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

    // Fase 14: el mapeo de encabezado y la validacion fila-a-fila son logica
    // PURA, viven en js/admin_grades_excel_transform.js (mismo codigo, sin
    // cambios) para poder probarlas sin mockear XLSX ni el DOM.
    const transform = window.adminGradesExcelTransform;
    const header = rows[0].map((h) => String(h == null ? "" : h).trim());
    const headerMap = transform.mapGradesExcelHeader(header, activities);
    if (!headerMap.ok) {
      setStatus(
        headerMap.reason === "no-usuario-column"
          ? 'No se encontro la columna "Usuario". No cambies los encabezados del Excel descargado.'
          : "No se reconocio ninguna columna de actividad de esta guia. No cambies los encabezados del Excel descargado."
      );
      return;
    }

    const activeStudents = getUsersForFicha(ficha).filter((u) => !isInactive(u));
    const studentsByKey = {};
    activeStudents.forEach((u) => { studentsByKey[u.usernameKey] = u; });

    const { parsedRows, unmatched, invalidCells } = transform.parseGradesExcelRows(
      rows, headerMap.usuarioIdx, headerMap.colToActivityId, studentsByKey
    );

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
    if (!gradesManager || !db || typeof gradesManager.applyStudentGradeChanges !== "function") {
      setStatus("El modulo de notas o Firestore no estan disponibles (recargue la pagina).");
      return;
    }
    const btn = byId("grades-excel-upload-btn");
    if (btn) btn.disabled = true;
    setStatus(`Aplicando calificaciones a ${parsedRows.length} aprendices...`);
    await ensureGradeSolutionsBank();

    let studentsUpdated = 0, fieldsFilled = 0, failures = 0;
    const failureReasons = [];
    try {
      for (const { usernameKey, grades } of parsedRows) {
        try {
          // Solo se envian las actividades escritas en el Excel, como cambios
          // puntuales: activity_grades.js relee la nube de forma estricta y los
          // aplica con precondicion de version. Si la lectura falla no se
          // escribe nada (antes: cloudGetGrades -> {} y la familia completa se
          // reemplazaba solo con lo del Excel, borrando lo demas).
          const nowIso = new Date().toISOString();
          const set = {};
          const del = [];
          const solutionsToApply = {};
          const hasSolution = {};
          Object.keys(grades).forEach((actId) => {
            const grade = grades[actId];
            set[actId] = grade;
            set[actId + ":gradedAt"] = nowIso;
            const solution = grade === "A" ? lookupBankSolution(guideFamily, actId) : null;
            if (solution) {
              set[actId + ":solution"] = solution;
              Object.assign(solutionsToApply, solution);
              hasSolution[actId] = true;
            } else if (grade !== "A") {
              del.push(actId + ":solution");   // igual que a mano: sin "A" no hay solucion embebida
            }
          });
          const pendingSave = gradesManager.applyStudentGradeChanges(usernameKey, guideFamily, set, del);
          gradesManager.flushGradesCloudSync(usernameKey);   // sin esperar el debounce de la grilla
          const saved = await pendingSave;
          if (!saved || !saved.ok) {
            failures += 1;
            failureReasons.push((saved && saved.message) || "no se pudo confirmar el guardado");
            setStatus(`... ${studentsUpdated}/${parsedRows.length} aprendices aplicados`);
            continue;
          }
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
            const hasOwnSolution = Boolean(hasSolution[actId]);
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
      + (failures ? ` ${failures} aprendices NO se guardaron en la nube (${failureReasons[0] || "error"}); sus cambios quedaron pendientes en este equipo.` : "")
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
    // Filtrar por estado no vuelve a consultar la nube: repinta lo ya leido.
    byId("mejora-filtro-estado")?.addEventListener("change", paintPlansGrid);
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

  // Resultado REAL de una operacion de planes/talleres (2026-10-27): el
  // mensaje de exito solo aparece cuando la nube confirma; si no, se dice que
  // NO se guardo, por que, y si quedo pendiente en este equipo.
  function describeRecordOpResult(result, okMsg, kind) {
    if (result && result.ok) {
      if (result.opOutcome === "missing") return { ok: false, text: `El ${kind} ya no existe en la nube (se elimino desde otro equipo). No se cambio nada.` };
      if (result.opOutcome === "duplicate-active") return { ok: false, text: `El aprendiz ya tiene un ${kind} de este tipo sin cerrar. No se creo otro.` };
      return { ok: true, text: okMsg };
    }
    const why = (result && result.message) || "No se pudo confirmar el guardado en la nube.";
    const pend = result && result.pending
      ? " El cambio quedo pendiente en este equipo y se reintentara; no se mostrara como guardado hasta confirmarlo."
      : "";
    return { ok: false, text: `NO se guardo en la nube: ${why}${pend}` };
  }

  function announceRecordOp(described, setStatus) {
    if (setStatus) setStatus(described.text);
    if (described.ok) {
      window.portalSaveStatus?.saved(described.text);
      setFeedback(described.text, "success");
    } else {
      window.portalSaveStatus?.error(described.text);
      setFeedback(described.text, "error");
    }
  }

  // Avisos de lectura fallida / cambios pendientes encima de una tabla.
  function recordGridNotices(unreadableCount, pendingCount, noun) {
    const out = [];
    if (unreadableCount) {
      out.push(`<p class="c-alert c-alert--danger records-read-alert" role="alert">No se pudieron leer los ${noun} de ${unreadableCount} aprendiz(es). `
        + `Sus registros no se muestran para no confundir datos viejos con los reales. `
        + `<button type="button" class="btn secondary" data-records-reload>Volver a leer</button></p>`);
    }
    if (pendingCount) {
      out.push(`<p class="c-alert c-alert--warning records-pending-alert" role="status">Hay ${pendingCount} cambio(s) de ${noun} pendientes de guardar en la nube desde este equipo. `
        + `<button type="button" class="btn secondary" data-records-retry>Reintentar ahora</button></p>`);
    }
    return out.join("");
  }

  let _plansUnreadable = {};   // { usernameKey: mensaje } cuya lectura fallo

  async function handleAssignPlan() {
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
    const btn = byId("mejora-asignar");
    if (btn) btn.disabled = true;
    setStatus("Guardando en la nube...");
    window.portalSaveStatus?.saving("Guardando plan...");
    let result;
    try {
      result = await mgr.createPlan(usernameKey, { family, activityId, activityLabel, descripcion, motivo, fechaLimite, asignadoPor: (session && session.usernameKey) || "admin" });
    } finally {
      if (btn) btn.disabled = false;
    }
    if (result && result.ok) recordAdminAuditAction({ action: "mejoramiento-asignar", target: `${usernameKey}:${family}:${activityId}`, detail: fechaLimite });
    announceRecordOp(describeRecordOpResult(result, "Plan asignado y guardado en la nube.", "plan"), setStatus);
    refreshPlansRowsFromCache(usernameKey);
  }

  // Lee de la nube (lectura estricta) los planes de la ficha elegida y pinta.
  async function renderPlansGrid() {
    const grid = byId("mejora-grid");
    if (!grid) return;
    const ficha = byId("mejora-filtro-ficha")?.value || "";
    const mgr = window.improvementPlans;
    if (!ficha || !mgr) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    grid.innerHTML = '<p class="response-status">Cargando planes desde la nube...</p>';
    const users = getUsersForFicha(ficha);
    _plansByUser = {};
    _plansUnreadable = {};
    await Promise.all(users.map(async (u) => {
      let r = null;
      try {
        r = typeof mgr.refreshStudentPlansFromCloud === "function"
          ? await mgr.refreshStudentPlansFromCloud(u.usernameKey)
          : { status: "error", message: "El modulo de planes esta desactualizado. Recargue la pagina." };
      } catch (_) { r = { status: "error", message: "No se pudieron leer los planes." }; }
      if (r && (r.status === "found" || r.status === "missing")) {
        _plansByUser[u.usernameKey] = { user: u, plans: r.list || [] };
      } else {
        _plansByUser[u.usernameKey] = { user: u, plans: [] };
        _plansUnreadable[u.usernameKey] = (r && r.message) || "No se pudieron leer los planes.";
      }
    }));
    paintPlansGrid();
  }

  // Tras una accion se repinta desde el cache que la cola dejo CONFIRMADO
  // (mas lo pendiente), sin volver a leer a toda la ficha: 0 lecturas extra.
  function refreshPlansRowsFromCache(usernameKey) {
    const mgr = window.improvementPlans;
    const entry = _plansByUser[usernameKey];
    if (mgr && entry && !_plansUnreadable[usernameKey]) entry.plans = mgr.getStudentPlans(usernameKey);
    paintPlansGrid();
  }

  function paintPlansGrid() {
    const grid = byId("mejora-grid");
    const mgr = window.improvementPlans;
    if (!grid || !mgr) return;
    const ficha = byId("mejora-filtro-ficha")?.value || "";
    if (!ficha) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    const estado = byId("mejora-filtro-estado")?.value || "";
    const now = Date.now();
    const rows = [];
    Object.values(_plansByUser).forEach(({ user, plans }) => {
      if (_plansUnreadable[user.usernameKey]) {
        rows.push(`<tr data-plan-user="${escapeHtml(user.usernameKey)}" data-records-unreadable="true">`
          + `<td colspan="7" class="records-row-error" role="alert"><div class="row-error__msg"><strong>${escapeHtml(user.fullName)}</strong>: no se pudieron leer sus planes. ${escapeHtml(_plansUnreadable[user.usernameKey])}</div></td></tr>`);
        return;
      }
      (plans || []).forEach((p) => {
        const st = mgr.derivePlanStatus(p, now);
        if (estado && st !== estado) return;
        rows.push(planRowMarkup(user, p, st));
      });
    });
    const pendingCount = typeof mgr.getPendingPlansCount === "function" ? mgr.getPendingPlansCount() : 0;
    const notices = recordGridNotices(Object.keys(_plansUnreadable).length, pendingCount, "planes");
    grid.innerHTML = notices + (rows.length
      ? `<table class="admin-data-table mejora-table"><thead><tr><th>Aprendiz</th><th>Actividad</th><th>Motivo</th><th>Asignado</th><th>Fecha limite</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : '<p class="admin-muted">No hay planes para esta ficha/estado.</p>');
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

  async function handlePlanGridClick(event) {
    if (event.target.closest("[data-records-reload]")) { renderPlansGrid(); return; }
    if (event.target.closest("[data-records-retry]")) {
      const results = await window.improvementPlans?.retryPendingPlansSync?.().catch(() => []);
      const failed = (results || []).filter((r) => r && !r.ok);
      announceRecordOp(failed.length
        ? { ok: false, text: `Siguen pendientes cambios de ${failed.length} aprendiz(es): ${failed[0].message || ""}` }
        : { ok: true, text: "Cambios pendientes de planes guardados en la nube." });
      renderPlansGrid();
      return;
    }
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
    if (action === "word") { exportPlanWord(entry.user, plan); return; }
    let result = null;
    let okMsg = "";
    let audit = null;
    if (action === "fecha") {
      const nueva = window.prompt("Nueva fecha limite (AAAA-MM-DD):", plan.fechaLimite || "");
      if (nueva == null) return;
      window.portalSaveStatus?.saving("Guardando fecha...");
      result = await mgr.updatePlanDeadline(usernameKey, planId, String(nueva).trim());
      okMsg = "Fecha del plan guardada en la nube.";
      audit = { action: "mejoramiento-fecha", target: `${usernameKey}:${planId}`, detail: String(nueva).trim() };
    } else if (action === "entregada") {
      window.portalSaveStatus?.saving("Guardando entrega...");
      result = await mgr.markPlanDelivered(usernameKey, planId);   // registra la fecha de entrega (Word)
      okMsg = "Entrega del plan registrada en la nube.";
      audit = { action: "mejoramiento-entregada", target: `${usernameKey}:${planId}`, detail: plan.activityId };
    } else if (action === "superado" || action === "nosuperado") {
      window.portalSaveStatus?.saving("Guardando resultado...");
      result = await mgr.setPlanResult(usernameKey, planId, action === "superado" ? "A" : "D");
      okMsg = "Resultado del plan guardado en la nube.";
      audit = { action: "mejoramiento-resultado", target: `${usernameKey}:${planId}`, detail: action === "superado" ? "A" : "D" };
    } else if (action === "eliminar") {
      const ok = await confirmAdminAction("Eliminar este plan de mejoramiento?");
      if (!ok) return;
      window.portalSaveStatus?.saving("Eliminando plan...");
      result = await mgr.deletePlan(usernameKey, planId);
      okMsg = "Plan eliminado en la nube.";
      audit = { action: "mejoramiento-eliminar", target: `${usernameKey}:${planId}`, detail: plan.activityId };
    } else {
      return;
    }
    if (result && result.ok && audit) recordAdminAuditAction(audit);
    announceRecordOp(describeRecordOpResult(result, okMsg, "plan"));
    refreshPlansRowsFromCache(usernameKey);
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
    // Filtrar por estado no vuelve a consultar la nube: repinta lo ya leido.
    byId("taller-filtro-estado")?.addEventListener("change", paintWorkshopsGrid);
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

  let _workshopsUnreadable = {};   // { usernameKey: mensaje } cuya lectura fallo

  async function handleAssignWorkshop() {
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
    const btn = byId("taller-asignar");
    if (btn) btn.disabled = true;
    setStatus(`Guardando en la nube (${usernameKeys.length} aprendices)...`);
    window.portalSaveStatus?.saving("Asignando taller...");
    // Guard anti-duplicados: lo decide la NUBE dentro de la misma escritura
    // condicionada (opOutcome "duplicate-active"), no el cache de este equipo,
    // asi un doble clic o un cache vacio no crean registros repetidos.
    let asignados = 0;
    let yaActivos = 0;
    const fallidos = [];
    try {
      const results = await Promise.all(usernameKeys.map((usernameKey) => mgr.createWorkshop(usernameKey, {
        workshopKey, title: entry.title, fileUrl: entry.fileUrl, motivo, fechaLimite, asignadoPor,
      })));
      results.forEach((r) => {
        if (r && r.ok && r.opOutcome === "duplicate-active") yaActivos += 1;
        else if (r && r.ok) asignados += 1;
        else fallidos.push((r && r.message) || "error");
      });
    } finally {
      if (btn) btn.disabled = false;
    }
    if (asignados) recordAdminAuditAction({ action: "taller-asignar", target: workshopKey, detail: `${asignados} aprendices` });
    const text = `Asignado y guardado en la nube para ${asignados}.`
      + (yaActivos ? ` ${yaActivos} ya tenian un taller activo de este tipo.` : "")
      + (fallidos.length ? ` ${fallidos.length} NO se guardaron en la nube (${fallidos[0]}); quedaron pendientes en este equipo.` : "");
    announceRecordOp({ ok: !fallidos.length, text }, setStatus);
    usernameKeys.forEach((u) => refreshWorkshopRowsFromCache(u, true));
    paintWorkshopsGrid();
  }

  async function renderWorkshopsGrid() {
    const grid = byId("taller-grid");
    if (!grid) return;
    const ficha = byId("taller-filtro-ficha")?.value || "";
    const mgr = window.reinforcementWorkshops;
    if (!ficha || !mgr) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    grid.innerHTML = '<p class="response-status">Cargando talleres desde la nube...</p>';
    const users = getUsersForFicha(ficha);
    _workshopsByUser = {};
    _workshopsUnreadable = {};
    await Promise.all(users.map(async (u) => {
      let r = null;
      try {
        r = typeof mgr.refreshStudentWorkshopsFromCloud === "function"
          ? await mgr.refreshStudentWorkshopsFromCloud(u.usernameKey)
          : { status: "error", message: "El modulo de talleres esta desactualizado. Recargue la pagina." };
      } catch (_) { r = { status: "error", message: "No se pudieron leer los talleres." }; }
      if (r && (r.status === "found" || r.status === "missing")) {
        _workshopsByUser[u.usernameKey] = { user: u, workshops: r.list || [] };
      } else {
        _workshopsByUser[u.usernameKey] = { user: u, workshops: [] };
        _workshopsUnreadable[u.usernameKey] = (r && r.message) || "No se pudieron leer los talleres.";
      }
    }));
    paintWorkshopsGrid();
  }

  // 0 lecturas extra tras una accion: se repinta desde el cache confirmado.
  function refreshWorkshopRowsFromCache(usernameKey, skipPaint) {
    const mgr = window.reinforcementWorkshops;
    const entry = _workshopsByUser[usernameKey];
    if (mgr && entry && !_workshopsUnreadable[usernameKey]) entry.workshops = mgr.getStudentWorkshops(usernameKey);
    if (!skipPaint) paintWorkshopsGrid();
  }

  function paintWorkshopsGrid() {
    const grid = byId("taller-grid");
    const mgr = window.reinforcementWorkshops;
    if (!grid || !mgr) return;
    const ficha = byId("taller-filtro-ficha")?.value || "";
    if (!ficha) { grid.innerHTML = '<p class="admin-muted">Selecciona una ficha.</p>'; return; }
    const estado = byId("taller-filtro-estado")?.value || "";
    const now = Date.now();
    const rows = [];
    Object.values(_workshopsByUser).forEach(({ user, workshops }) => {
      if (_workshopsUnreadable[user.usernameKey]) {
        rows.push(`<tr data-workshop-user="${escapeHtml(user.usernameKey)}" data-records-unreadable="true">`
          + `<td colspan="6" class="records-row-error" role="alert"><div class="row-error__msg"><strong>${escapeHtml(user.fullName)}</strong>: no se pudieron leer sus talleres. ${escapeHtml(_workshopsUnreadable[user.usernameKey])}</div></td></tr>`);
        return;
      }
      (workshops || []).forEach((w) => {
        const st = mgr.deriveWorkshopStatus(w, now);
        if (estado && st !== estado) return;
        rows.push(workshopRowMarkup(user, w, st));
      });
    });
    const pendingCount = typeof mgr.getPendingWorkshopsCount === "function" ? mgr.getPendingWorkshopsCount() : 0;
    const notices = recordGridNotices(Object.keys(_workshopsUnreadable).length, pendingCount, "talleres");
    grid.innerHTML = notices + (rows.length
      ? `<table class="admin-data-table taller-table"><thead><tr><th>Aprendiz</th><th>Taller</th><th>Asignado</th><th>Fecha limite</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : '<p class="admin-muted">No hay talleres para esta ficha/estado.</p>');
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

    // Lectura estricta: si falla NO se muestra "(sin respuesta)" como si el
    // aprendiz no hubiera escrito nada.
    let respuestas = {};
    let read = null;
    try {
      read = typeof mgr.refreshStudentAnswersFromCloud === "function"
        ? await mgr.refreshStudentAnswersFromCloud(usernameKey)
        : { status: "found", answers: await mgr.syncStudentAnswersFromCloud(usernameKey) };
    } catch (_) { read = { status: "error", message: "No se pudieron leer las respuestas." }; }
    if (!read || (read.status !== "found" && read.status !== "missing")) {
      openModal(`Respuestas — ${workshop.title || workshop.workshopKey}`, user.fullName,
        `<p class="c-alert c-alert--danger" role="alert">No se pudieron leer las respuestas del aprendiz: ${escapeHtml((read && read.message) || "error de lectura")} Intente de nuevo.</p>`);
      return;
    }
    respuestas = ((read.answers || {})[workshop.id]) || {};

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

  async function handleWorkshopGridClick(event) {
    if (event.target.closest("[data-records-reload]")) { renderWorkshopsGrid(); return; }
    if (event.target.closest("[data-records-retry]")) {
      const results = await window.reinforcementWorkshops?.retryPendingWorkshopsSync?.().catch(() => []);
      const failed = (results || []).filter((r) => r && !r.ok);
      announceRecordOp(failed.length
        ? { ok: false, text: `Siguen pendientes cambios de ${failed.length} aprendiz(es): ${failed[0].message || ""}` }
        : { ok: true, text: "Cambios pendientes de talleres guardados en la nube." });
      renderWorkshopsGrid();
      return;
    }
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
    if (action === "respuestas") { showWorkshopAnswers(usernameKey, entry.user, workshop); return; }
    let result = null;
    let okMsg = "";
    let audit = null;
    if (action === "fecha") {
      const nueva = window.prompt("Nueva fecha limite (AAAA-MM-DD):", workshop.fechaLimite || "");
      if (nueva == null) return;
      window.portalSaveStatus?.saving("Guardando fecha...");
      result = await mgr.updateWorkshopDeadline(usernameKey, workshopId, String(nueva).trim());
      okMsg = "Fecha del taller guardada en la nube.";
      audit = { action: "taller-fecha", target: `${usernameKey}:${workshopId}`, detail: String(nueva).trim() };
    } else if (action === "entregada") {
      window.portalSaveStatus?.saving("Guardando entrega...");
      result = await mgr.markWorkshopDelivered(usernameKey, workshopId);
      okMsg = "Entrega del taller registrada en la nube.";
      audit = { action: "taller-entregada", target: `${usernameKey}:${workshopId}`, detail: workshop.workshopKey };
    } else if (action === "superado" || action === "nosuperado") {
      window.portalSaveStatus?.saving("Guardando resultado...");
      result = await mgr.setWorkshopResult(usernameKey, workshopId, action === "superado" ? "A" : "D");
      okMsg = "Resultado del taller guardado en la nube.";
      audit = { action: "taller-resultado", target: `${usernameKey}:${workshopId}`, detail: action === "superado" ? "A" : "D" };
    } else if (action === "eliminar") {
      const ok = await confirmAdminAction("Eliminar este taller de refuerzo?");
      if (!ok) return;
      window.portalSaveStatus?.saving("Eliminando taller...");
      result = await mgr.deleteWorkshop(usernameKey, workshopId);
      okMsg = "Taller eliminado en la nube.";
      audit = { action: "taller-eliminar", target: `${usernameKey}:${workshopId}`, detail: workshop.workshopKey };
    } else {
      return;
    }
    if (result && result.ok && audit) recordAdminAuditAction(audit);
    announceRecordOp(describeRecordOpResult(result, okMsg, "taller"));
    refreshWorkshopRowsFromCache(usernameKey);
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
    await patchLearnersFromLocal([usernameKey]);
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
    // V6: withdraw the protected grant before a portal deactivation. Preserve
    // updateStudentStatus's synchronous API and the existing confirmation flow.
    if (!nextActive && window.PORTAL_FIREBASE_CONFIG?.hardwareLabV6?.enabled) {
      try {
        await window.HardwareLab.FirebaseV6.revokeAccess(usernameKey);
      } catch (_) {
        window.portalSaveStatus?.error("No se pudo proteger el acceso del laboratorio.");
        setFeedback("No se desactivó la cuenta. Reintenta para revocar también el acceso del laboratorio.", "error");
        return;
      }
    }
    const result = auth.updateStudentStatus(usernameKey, nextActive);
    if (!result.ok) {
      window.portalSaveStatus?.error(result.message || "Error");
      setFeedback(result.message || "No fue posible cambiar el estado.", "error");
      return;
    }
    recordAdminAuditAction({ action: "student-status", target: usernameKey, detail: nextActive ? "active" : "inactive" });
    window.portalSaveStatus?.saved(nextActive ? "Aprendiz activado" : "Aprendiz desactivado");
    setFeedback("Estado actualizado.", "success");
    await patchLearnersFromLocal([usernameKey]);
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
    const guideTitle = guideLabel(guide);
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
    const guideTitle = guideLabel(guide);
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
    const touched = [];
    for (const item of nameAuditResult.sure.slice()) {
      const res = await applyOneAuditName(item.user, item.official);
      if (res && res.ok) { ok++; if (res.pendingSync) pending++; touched.push(item.user && item.user.usernameKey); } else fail++;
    }
    window.portalSaveStatus?.saved(`${ok} actualizados`);
    const pendingMsg = pending ? ` ${pending} con sincronizacion a la nube pendiente (recarga para verificar).` : "";
    setFeedback(`Nombres actualizados: ${ok}.${fail ? ` Errores: ${fail}.` : ""}${pendingMsg}`, fail ? "error" : "success");
    await patchLearnersFromLocal(touched.filter(Boolean));
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
    // Solo se cambio (o no) un aprendiz: si fallo, no hay nada que repintar.
    await (res && res.ok ? patchLearnersFromLocal([cand.usernameKey]) : Promise.resolve());
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
      window._firebaseDb?.forceNextStudentsProgressListing?.();
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
    // Consultas SOLO con los botones (navegar y filtrar no consultan la nube).
    byId("responses-consult")?.addEventListener("click", () => { void consultLearnerModule("respuestas"); });
    byId("responses-refresh")?.addEventListener("click", () => { void consultLearnerModule("respuestas", { force: true }); });
    byId("deliveries-consult")?.addEventListener("click", () => { void consultLearnerModule("entregas"); });
    byId("deliveries-refresh")?.addEventListener("click", () => { void consultLearnerModule("entregas", { force: true }); });
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
      // Solo filtra las opciones de aprendiz (local): no redibuja la tabla
      // ni consulta, y el foco se conserva.
      state.filters.responsesText = event.target.value;
      const sel = byId("responses-learner-filter");
      if (sel) sel.innerHTML = learnerOptionsHtml(state.filters.responsesFicha || "", state.filters.responsesLearner || "", state.filters.responsesText, "Seleccione un aprendiz");
    });
    byId("deliveries-ficha-filter")?.addEventListener("change", (event) => {
      state.filters.deliveriesFicha = event.target.value;
      // Otra ficha: aprendiz, guia y busqueda anteriores no aplican.
      state.filters.deliveriesLearner = "";
      state.filters.deliveriesGuide = "";
      state.filters.deliveriesLearnerSearch = "";
      if (byId("deliveries-learner-search")) byId("deliveries-learner-search").value = "";
      renderDeliveries();
    });
    byId("deliveries-learner-search")?.addEventListener("input", (event) => {
      state.filters.deliveriesLearnerSearch = event.target.value;
      const sel = byId("deliveries-learner-filter");
      if (sel) sel.innerHTML = learnerOptionsHtml(state.filters.deliveriesFicha || "", state.filters.deliveriesLearner || "", state.filters.deliveriesLearnerSearch, "Seleccione un aprendiz");
    });
    byId("deliveries-learner-filter")?.addEventListener("change", (event) => {
      state.filters.deliveriesLearner = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-guide-filter")?.addEventListener("change", (event) => {
      state.filters.deliveriesGuide = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-period")?.addEventListener("change", (event) => {
      applyDeliveriesPeriod(event.target.value);
      renderDeliveries();
    });
    byId("deliveries-search")?.addEventListener("input", (event) => {
      state.filters.deliveriesText = event.target.value;
      renderDeliveries();
    });
    byId("deliveries-from")?.addEventListener("change", (event) => {
      state.filters.deliveriesFrom = event.target.value;
      state.filters.deliveriesPeriod = "custom";
      renderDeliveries();
    });
    byId("deliveries-to")?.addEventListener("change", (event) => {
      state.filters.deliveriesTo = event.target.value;
      state.filters.deliveriesPeriod = "custom";
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
      // Banco de comentarios: insertar uno en la celda, o guardar el texto que el
      // instructor escribio/ajusto a mano (el "change" de un <input type=text>
      // dispara al salir del campo o con Enter, no en cada tecla).
      const commentSel = target && target.closest ? target.closest(".grade-comment-select") : null;
      if (commentSel) { handleGradeCommentSelect(commentSel); return; }
      const obsInput = target && target.closest ? target.closest(".grade-obs-input") : null;
      if (obsInput) saveGradeObservation(obsInput);
    });
    // Modulo Notas: acciones del banco de comentarios (editar / eliminar).
    byId("module-notas")?.addEventListener("click", (event) => {
      const editBtn = event.target?.closest?.(".grade-comment-edit");
      if (editBtn) { handleGradeCommentEdit(editBtn.dataset.commentId || ""); return; }
      const delBtn = event.target?.closest?.(".grade-comment-delete");
      if (delBtn) handleGradeCommentDelete(delBtn.dataset.commentId || "");
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
