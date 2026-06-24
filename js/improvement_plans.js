// improvement_plans.js — Planes de mejoramiento (remediacion por aprendiz).
// El instructor (admin) asigna un plan a un aprendiz que no entrego a tiempo: re-habilita
// la actividad con un motivo + nueva fecha limite, y queda como evidencia documentable.
// Almacenamiento: sena_portal:student:{usernameKey}:app:improvement_plans (espejo en
// Firestore sena_portal_improvement_plans, admin escribe / aprendiz lee solo el suyo).
(function () {
  "use strict";

  var STORAGE_KEY = "improvement_plans";
  var DEFAULT_MOTIVO = "No entregó la actividad en el tiempo establecido.";

  // ── Logica pura (sin DOM/almacenamiento; exportada para tests) ───────────────
  function makePlan(opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var iso = new Date(now).toISOString();
    var fecha = opts.fechaLimite || "";
    return {
      id: "plan_" + (opts.activityId || "act") + "_" + now,
      family: opts.family || "",
      guideFile: opts.guideFile || "",
      activityId: opts.activityId || "",
      activityLabel: opts.activityLabel || "",
      descripcion: (opts.descripcion && String(opts.descripcion).trim()) || "",  // tarea de recuperación
      motivo: (opts.motivo && String(opts.motivo).trim()) || DEFAULT_MOTIVO,
      fechaAsignacion: iso,
      fechaLimite: fecha,
      historialFechas: fecha ? [{ fecha: fecha, cambiadoEn: iso }] : [],
      asignadoPor: opts.asignadoPor || "",
      estado: "asignado",
      entrega: null,           // { archivo, driveUrl, entregadoEn } (opcional)
      resultado: "",           // "A" | "D" tras re-evaluar
      resultadoEn: "",
    };
  }

  // Cambia la fecha limite, deja rastro en historialFechas y re-habilita si estaba vencido.
  function applyDeadlineChange(plan, nuevaFecha, now) {
    now = now || Date.now();
    var p = Object.assign({}, plan);
    p.fechaLimite = nuevaFecha || "";
    p.historialFechas = (Array.isArray(plan.historialFechas) ? plan.historialFechas.slice() : []);
    p.historialFechas.push({ fecha: nuevaFecha || "", cambiadoEn: new Date(now).toISOString() });
    if (p.estado === "vencido") p.estado = "asignado";
    return p;
  }

  // Estado efectivo del plan considerando la fecha y si hay entrega.
  function derivePlanStatus(plan, now, hasDelivery) {
    if (!plan) return "asignado";
    if (plan.resultado === "A") return "superado";
    if (plan.resultado === "D") return "no_superado";
    if (hasDelivery || plan.entrega) return "entregado";
    var nowMs = now || Date.now();
    if (plan.fechaLimite && new Date(plan.fechaLimite).getTime() < nowMs) return "vencido";
    return "asignado";
  }

  var STATUS_LABELS = {
    asignado: "Asignado",
    entregado: "Entregado",
    superado: "Superado",
    no_superado: "No superado",
    vencido: "Vencido",
  };

  // ── Almacenamiento local + nube (usa window; no se ejecuta al cargar) ────────
  function readJson(raw, fallback) {
    try { return raw ? (JSON.parse(raw) || fallback) : fallback; }
    catch (e) { return fallback; }
  }

  function getPlansKey(usernameKey) {
    var auth = window.portalAuth;
    if (!auth || !auth.getStudentStorageKey) return null;
    return auth.getStudentStorageKey(usernameKey, STORAGE_KEY, { area: "app" });
  }

  function plansCloudDb() {
    var db = window._firebaseDb;
    return db && typeof db.cloudGetImprovementPlans === "function" ? db : null;
  }
  function fetchPlansFromCloud(usernameKey) {
    var db = plansCloudDb();
    if (!db) return Promise.resolve(null);
    return Promise.resolve(db.cloudGetImprovementPlans(usernameKey)).catch(function () { return null; });
  }
  function savePlansToCloud(usernameKey, plans) {
    var db = plansCloudDb();
    if (!db || typeof db.cloudSaveImprovementPlans !== "function") return;
    Promise.resolve(db.cloudSaveImprovementPlans(usernameKey, plans)).catch(function () {});
  }

  function getStudentPlans(usernameKey) {
    var key = getPlansKey(usernameKey);
    if (!key) return [];
    var arr = readJson(localStorage.getItem(key), []);
    return Array.isArray(arr) ? arr : [];
  }

  // Escribe local + nube (lo invoca el admin; rule isAdmin lo autoriza).
  function setStudentPlans(usernameKey, plans) {
    var key = getPlansKey(usernameKey);
    if (!key) return;
    var arr = Array.isArray(plans) ? plans : [];
    localStorage.setItem(key, JSON.stringify(arr));
    savePlansToCloud(usernameKey, arr);
  }

  // ── Operaciones del admin ────────────────────────────────────────────────────
  function createPlan(usernameKey, opts) {
    if (!usernameKey) return null;
    var plans = getStudentPlans(usernameKey);
    var plan = makePlan(opts);
    plans.push(plan);
    setStudentPlans(usernameKey, plans);
    return plan;
  }

  function updatePlanDeadline(usernameKey, planId, nuevaFecha) {
    var plans = getStudentPlans(usernameKey);
    var i = plans.findIndex(function (p) { return p.id === planId; });
    if (i === -1) return null;
    plans[i] = applyDeadlineChange(plans[i], nuevaFecha);
    setStudentPlans(usernameKey, plans);
    return plans[i];
  }

  function setPlanResult(usernameKey, planId, grade) {
    var plans = getStudentPlans(usernameKey);
    var i = plans.findIndex(function (p) { return p.id === planId; });
    if (i === -1) return null;
    plans[i] = Object.assign({}, plans[i], {
      resultado: grade === "A" || grade === "D" ? grade : "",
      resultadoEn: new Date().toISOString(),
    });
    setStudentPlans(usernameKey, plans);
    return plans[i];
  }

  // Marca el plan como entregado y registra la fecha (la usa el Word: "Fecha de entrega").
  function markPlanDelivered(usernameKey, planId, fechaISO, archivo) {
    var plans = getStudentPlans(usernameKey);
    var i = plans.findIndex(function (p) { return p.id === planId; });
    if (i === -1) return null;
    plans[i] = Object.assign({}, plans[i], {
      entrega: { entregadoEn: fechaISO || new Date().toISOString(), archivo: archivo || "" },
    });
    setStudentPlans(usernameKey, plans);
    return plans[i];
  }

  function deletePlan(usernameKey, planId) {
    var plans = getStudentPlans(usernameKey).filter(function (p) { return p.id !== planId; });
    setStudentPlans(usernameKey, plans);
  }

  // Trae del cloud y cachea local (para el admin al abrir el panel).
  async function syncStudentPlansFromCloud(usernameKey) {
    var cloud = await fetchPlansFromCloud(usernameKey);
    if (Array.isArray(cloud)) {
      var key = getPlansKey(usernameKey);
      if (key) localStorage.setItem(key, JSON.stringify(cloud));
      return cloud;
    }
    return getStudentPlans(usernameKey);
  }

  // ── Lectura para el aprendiz activo ──────────────────────────────────────────
  function getMyPlans() {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return [];
    return getStudentPlans(session.usernameKey);
  }

  // Plan ACTIVO (no superado) para una actividad de una guia — para el banner.
  function getMyPlanForActivity(guideFile, activityId) {
    var plans = getMyPlans().filter(function (p) {
      return p.activityId === activityId && p.resultado !== "A";
    });
    if (!plans.length) return null;
    // El mas reciente por fechaAsignacion.
    plans.sort(function (a, b) { return String(b.fechaAsignacion).localeCompare(String(a.fechaAsignacion)); });
    return plans[0];
  }

  // ── Banner del aprendiz en la guia ───────────────────────────────────────────
  function escHtml(s) {
    var u = (typeof window !== "undefined" && window.portalUtils) || null;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(s);
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Mismas convenciones de montaje que los badges de nota, para anclar el banner
  // en la actividad correcta de cualquier guia.
  function resolvePlanMount(activityId) {
    var sels = [
      "#" + activityId + "GradeMount", "#" + activityId + "DeadlineControls",
      "#" + activityId + "DeliveryControls", "#" + activityId + "Status",
      '[data-plan-mount="' + activityId + '"]', '[data-act-grade="' + activityId + '"]',
    ];
    for (var i = 0; i < sels.length; i++) {
      var el = null; try { el = document.querySelector(sels[i]); } catch (e) { el = null; }
      if (el) return el;
    }
    return null;
  }

  function buildPlanBanner(plan, status) {
    var div = document.createElement("div");
    div.className = "plan-mejora-banner plan-mejora-banner--" + status;
    div.setAttribute("data-plan-act", plan.activityId);
    var fechaTxt = plan.fechaLimite
      ? '<div class="plan-mejora-banner__fecha">Fecha límite de entrega: <strong>' + escHtml(plan.fechaLimite) + "</strong>"
        + (status === "vencido" ? " — <em>vencido</em>" : "") + "</div>"
      : "";
    var estadoTxt = (STATUS_LABELS[status] || status);
    var canDeliver = (status === "asignado");   // dentro de la fecha del plan
    div.innerHTML =
      '<div class="plan-mejora-banner__title">📋 Plan de mejoramiento — ' + escHtml(estadoTxt) + "</div>" +
      '<div class="plan-mejora-banner__body">' +
        "<strong>Debes realizar y entregar esta actividad.</strong>" +
        (plan.descripcion ? '<div class="plan-mejora-banner__tarea">' + escHtml(plan.descripcion) + "</div>" : "") +
        (plan.motivo ? '<div class="plan-mejora-banner__motivo">Motivo: ' + escHtml(plan.motivo) + "</div>" : "") +
        fechaTxt +
        (canDeliver
          ? '<button type="button" class="plan-mejora-banner__btn c-btn">📤 Entregar a Drive</button>'
          : (status === "vencido"
              ? '<div class="plan-mejora-banner__cerrado">La entrega de este plan está cerrada (fecha vencida). Pide al instructor que la reabra.</div>'
              : "")) +
      "</div>";
    if (canDeliver) {
      var btn = div.querySelector(".plan-mejora-banner__btn");
      if (btn) btn.addEventListener("click", function () { deliverPlanToDrive(plan); });
    }
    return div;
  }

  // Entrega del plan: su propio canal (independiente del lock global de la actividad).
  // Reusa el respaldo manual a Drive (carpeta de la ficha + nombre sugerido).
  function deliverPlanToDrive(plan) {
    var sdd = window.sharedDriveDelivery;
    if (!sdd || typeof sdd.offerManualDriveFallback !== "function") {
      if (typeof window.portalAlert === "function") window.portalAlert("La entrega no está disponible en esta página.", { type: "warning" });
      return;
    }
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    var user = (session && session.user) || {};
    var ficha = user.ficha || "";
    var nombre = String(user.fullName || "Aprendiz").replace(/\s+/g, "");
    sdd.offerManualDriveFallback({
      ficha: ficha,
      suggestedName: "PlanMejoramiento_" + (plan.activityId || "act") + "_" + nombre + (ficha ? "_" + ficha : ""),
      message: "Entrega del plan de mejoramiento: " + (plan.activityLabel || plan.activityId) + ".",
    });
  }

  // Cachea local sin escribir a la nube (el aprendiz NO puede escribir el doc).
  function cacheStudentPlansLocal(usernameKey, plans) {
    var key = getPlansKey(usernameKey);
    if (key) localStorage.setItem(key, JSON.stringify(Array.isArray(plans) ? plans : []));
  }

  function renderMyPlanBannersForFamily(family) {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;
    var now = Date.now();
    getStudentPlans(session.usernameKey).forEach(function (plan) {
      if (plan.family !== family || plan.resultado === "A") return;  // omitir superadas
      var mount = resolvePlanMount(plan.activityId);
      if (!mount || !mount.parentNode) return;
      var parent = mount.parentNode;
      if (parent.querySelector('.plan-mejora-banner[data-plan-act="' + plan.activityId + '"]')) return;
      parent.insertBefore(buildPlanBanner(plan, derivePlanStatus(plan, now)), mount);
    });
  }

  // Lo invoca la guia al cargar: baja los planes del aprendiz de la nube y pinta banners.
  async function renderMyPlanBannersForFile(pageFile) {
    var map = (window.activityGradesManager && window.activityGradesManager.GUIDE_FAMILY_BY_FILE) || {};
    var family = map[String(pageFile || "")];
    if (!family) return;
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;
    var cloud = await fetchPlansFromCloud(session.usernameKey);
    if (Array.isArray(cloud)) cacheStudentPlansLocal(session.usernameKey, cloud);
    renderMyPlanBannersForFamily(family);
  }

  // ── API publica ──────────────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.improvementPlans = {
      DEFAULT_MOTIVO: DEFAULT_MOTIVO,
      STATUS_LABELS: STATUS_LABELS,
      makePlan: makePlan,
      applyDeadlineChange: applyDeadlineChange,
      derivePlanStatus: derivePlanStatus,
      getStudentPlans: getStudentPlans,
      setStudentPlans: setStudentPlans,
      createPlan: createPlan,
      updatePlanDeadline: updatePlanDeadline,
      setPlanResult: setPlanResult,
      markPlanDelivered: markPlanDelivered,
      deletePlan: deletePlan,
      syncStudentPlansFromCloud: syncStudentPlansFromCloud,
      getMyPlans: getMyPlans,
      getMyPlanForActivity: getMyPlanForActivity,
      renderMyPlanBannersForFamily: renderMyPlanBannersForFamily,
      renderMyPlanBannersForFile: renderMyPlanBannersForFile,
    };
  }

  // Export CJS para pruebas unitarias de la logica pura.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { makePlan: makePlan, applyDeadlineChange: applyDeadlineChange, derivePlanStatus: derivePlanStatus, STATUS_LABELS: STATUS_LABELS };
  }
})();
