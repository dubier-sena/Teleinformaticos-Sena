// reinforcement_workshops.js — Talleres de Refuerzo (asignados por el instructor).
// El instructor (admin) asigna a uno o varios aprendices un taller de refuerzo:
// un documento autocontenido (PDF ya redactado, con sus propias actividades) que
// el aprendiz resuelve fuera del portal y entrega como un unico archivo. A
// diferencia de un Plan de Mejoramiento, NO reabre ninguna actividad real de una
// guia -- por eso no vive dentro de ninguna pagina de guia, sino en su propia
// pagina (pages/auxiliares/talleres-refuerzo.html).
// Almacenamiento: sena_portal:student:{usernameKey}:app:reinforcement_workshops
// (espejo en Firestore sena_portal_reinforcement_workshops, admin escribe /
// aprendiz lee solo el suyo).
(function () {
  "use strict";

  var STORAGE_KEY = "reinforcement_workshops";

  // ── Logica pura (sin DOM/almacenamiento; exportada para tests) ───────────────
  function makeWorkshop(opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    var iso = new Date(now).toISOString();
    var fecha = opts.fechaLimite || "";
    return {
      id: "taller_" + (opts.workshopKey || "taller") + "_" + now,
      workshopKey: opts.workshopKey || "",
      title: opts.title || "",
      fileUrl: opts.fileUrl || "",
      motivo: (opts.motivo && String(opts.motivo).trim()) || "",   // opcional
      fechaAsignacion: iso,
      fechaLimite: fecha,
      historialFechas: fecha ? [{ fecha: fecha, cambiadoEn: iso }] : [],
      asignadoPor: opts.asignadoPor || "",
      estado: "asignado",
      entrega: null,           // { entregadoEn } (opcional)
      resultado: "",           // "A" | "D" tras revisar
      resultadoEn: "",
    };
  }

  // Cambia la fecha limite, deja rastro en historialFechas y re-habilita si estaba vencido.
  function applyWorkshopDeadlineChange(workshop, nuevaFecha, now) {
    now = now || Date.now();
    var w = Object.assign({}, workshop);
    w.fechaLimite = nuevaFecha || "";
    w.historialFechas = (Array.isArray(workshop.historialFechas) ? workshop.historialFechas.slice() : []);
    w.historialFechas.push({ fecha: nuevaFecha || "", cambiadoEn: new Date(now).toISOString() });
    if (w.estado === "vencido") w.estado = "asignado";
    return w;
  }

  // Estado efectivo del taller considerando la fecha y si hay entrega. `estado`
  // guardado en el registro NUNCA se lee directamente para pintar -- solo sirve
  // como marca para "reabrir si estaba vencido" en applyWorkshopDeadlineChange.
  function deriveWorkshopStatus(workshop, now, hasDelivery) {
    if (!workshop) return "asignado";
    if (workshop.resultado === "A") return "superado";
    if (workshop.resultado === "D") return "no_superado";
    if (hasDelivery || workshop.entrega) return "entregado";
    var nowMs = now || Date.now();
    if (workshop.fechaLimite && new Date(workshop.fechaLimite).getTime() < nowMs) return "vencido";
    return "asignado";
  }

  var WORKSHOP_STATUS_LABELS = {
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

  function getWorkshopsKey(usernameKey) {
    var auth = window.portalAuth;
    if (!auth || !auth.getStudentStorageKey) return null;
    return auth.getStudentStorageKey(usernameKey, STORAGE_KEY, { area: "app" });
  }

  function workshopsCloudDb() {
    var db = window._firebaseDb;
    return db && typeof db.cloudGetReinforcementWorkshops === "function" ? db : null;
  }
  function fetchWorkshopsFromCloud(usernameKey) {
    var db = workshopsCloudDb();
    if (!db) return Promise.resolve(null);
    return Promise.resolve(db.cloudGetReinforcementWorkshops(usernameKey)).catch(function () { return null; });
  }
  function saveWorkshopsToCloud(usernameKey, workshops) {
    var db = workshopsCloudDb();
    if (!db || typeof db.cloudSaveReinforcementWorkshops !== "function") return;
    Promise.resolve(db.cloudSaveReinforcementWorkshops(usernameKey, workshops)).catch(function () {});
  }

  function getStudentWorkshops(usernameKey) {
    var key = getWorkshopsKey(usernameKey);
    if (!key) return [];
    var arr = readJson(localStorage.getItem(key), []);
    return Array.isArray(arr) ? arr : [];
  }

  // Escribe local + nube (lo invoca el admin; rule isAdmin lo autoriza).
  function setStudentWorkshops(usernameKey, workshops) {
    var key = getWorkshopsKey(usernameKey);
    if (!key) return;
    var arr = Array.isArray(workshops) ? workshops : [];
    localStorage.setItem(key, JSON.stringify(arr));
    saveWorkshopsToCloud(usernameKey, arr);
  }

  // ── Operaciones del admin ────────────────────────────────────────────────────
  function createWorkshop(usernameKey, opts) {
    if (!usernameKey) return null;
    var workshops = getStudentWorkshops(usernameKey);
    var workshop = makeWorkshop(opts);
    workshops.push(workshop);
    setStudentWorkshops(usernameKey, workshops);
    return workshop;
  }

  function updateWorkshopDeadline(usernameKey, workshopId, nuevaFecha) {
    var workshops = getStudentWorkshops(usernameKey);
    var i = workshops.findIndex(function (w) { return w.id === workshopId; });
    if (i === -1) return null;
    workshops[i] = applyWorkshopDeadlineChange(workshops[i], nuevaFecha);
    setStudentWorkshops(usernameKey, workshops);
    return workshops[i];
  }

  function setWorkshopResult(usernameKey, workshopId, grade) {
    var workshops = getStudentWorkshops(usernameKey);
    var i = workshops.findIndex(function (w) { return w.id === workshopId; });
    if (i === -1) return null;
    workshops[i] = Object.assign({}, workshops[i], {
      resultado: grade === "A" || grade === "D" ? grade : "",
      resultadoEn: new Date().toISOString(),
    });
    setStudentWorkshops(usernameKey, workshops);
    return workshops[i];
  }

  // Marca el taller como entregado y registra la fecha.
  function markWorkshopDelivered(usernameKey, workshopId, fechaISO, archivo) {
    var workshops = getStudentWorkshops(usernameKey);
    var i = workshops.findIndex(function (w) { return w.id === workshopId; });
    if (i === -1) return null;
    workshops[i] = Object.assign({}, workshops[i], {
      entrega: { entregadoEn: fechaISO || new Date().toISOString(), archivo: archivo || "" },
    });
    setStudentWorkshops(usernameKey, workshops);
    return workshops[i];
  }

  function deleteWorkshop(usernameKey, workshopId) {
    var workshops = getStudentWorkshops(usernameKey).filter(function (w) { return w.id !== workshopId; });
    setStudentWorkshops(usernameKey, workshops);
  }

  // Trae del cloud y cachea local (lo usa el admin al abrir el panel, y el
  // aprendiz al abrir su pagina de talleres).
  async function syncStudentWorkshopsFromCloud(usernameKey) {
    var cloud = await fetchWorkshopsFromCloud(usernameKey);
    if (Array.isArray(cloud)) {
      var key = getWorkshopsKey(usernameKey);
      if (key) localStorage.setItem(key, JSON.stringify(cloud));
      return cloud;
    }
    return getStudentWorkshops(usernameKey);
  }

  // ── Lectura para el aprendiz activo ──────────────────────────────────────────
  function getMyWorkshops() {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return [];
    return getStudentWorkshops(session.usernameKey);
  }

  // Entrega del taller: canal propio (manual a Drive), igual que Planes de
  // Mejoramiento -- el admin la marca "Entregada" tras verla por timestamp.
  // OJO: la funcion real vive en window.sharedAppsScriptDelivery (NO en
  // window.sharedDriveDelivery, que es un objeto distinto sin este metodo).
  function deliverWorkshopToDrive(workshop) {
    var sdd = window.sharedAppsScriptDelivery;
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
      suggestedName: "TallerRefuerzo_" + (workshop.workshopKey || "taller") + "_" + nombre + (ficha ? "_" + ficha : ""),
      message: "Entrega del taller de refuerzo: " + (workshop.title || workshop.workshopKey) + ".",
    });
  }

  // ── API publica ──────────────────────────────────────────────────────────────
  if (typeof window !== "undefined") {
    window.reinforcementWorkshops = {
      WORKSHOP_STATUS_LABELS: WORKSHOP_STATUS_LABELS,
      makeWorkshop: makeWorkshop,
      applyWorkshopDeadlineChange: applyWorkshopDeadlineChange,
      deriveWorkshopStatus: deriveWorkshopStatus,
      getStudentWorkshops: getStudentWorkshops,
      setStudentWorkshops: setStudentWorkshops,
      createWorkshop: createWorkshop,
      updateWorkshopDeadline: updateWorkshopDeadline,
      setWorkshopResult: setWorkshopResult,
      markWorkshopDelivered: markWorkshopDelivered,
      deleteWorkshop: deleteWorkshop,
      syncStudentWorkshopsFromCloud: syncStudentWorkshopsFromCloud,
      getMyWorkshops: getMyWorkshops,
      deliverWorkshopToDrive: deliverWorkshopToDrive,
    };
  }

  // Export CJS para pruebas unitarias de la logica pura.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      makeWorkshop: makeWorkshop,
      applyWorkshopDeadlineChange: applyWorkshopDeadlineChange,
      deriveWorkshopStatus: deriveWorkshopStatus,
      WORKSHOP_STATUS_LABELS: WORKSHOP_STATUS_LABELS,
    };
  }
})();
