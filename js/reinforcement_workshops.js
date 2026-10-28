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

  // Antes: cada cambio guardaba la lista local COMPLETA y
  // cloudSaveReinforcementWorkshops la reemplazaba en la nube; una lectura
  // fallida ([] ambiguo) dejaba esa lista vacia y el siguiente taller borraba
  // los demas (2026-10-27). Ahora: operaciones por id sobre una lectura
  // verificada con precondicion (firebase_db.createRecordListSync). La
  // eliminacion solo ocurre por una operacion "delete" explicita.
  var _workshopsSync = null;
  function workshopsSync() {
    if (_workshopsSync) return _workshopsSync;
    var db = window._firebaseDb;
    if (!db || typeof db.createRecordListSync !== "function") return null;
    _workshopsSync = db.createRecordListSync({
      collection: "sena_portal_reinforcement_workshops",
      field: "workshops",
      pendingStorageKey: "sena_portal_reinforcement_workshops_pending_ops_v1",
      eventName: "reinforcement-workshops-sync-status",
      getCacheKey: getWorkshopsKey,
    });
    return _workshopsSync;
  }

  function unsupportedResult() {
    return {
      ok: false,
      status: "unsupported",
      reason: "no-strict-api",
      message: "El modulo de la nube esta desactualizado. Recargue la pagina (Ctrl+F5).",
      pending: 0,
    };
  }

  function queueWorkshopOp(usernameKey, op) {
    var sync = workshopsSync();
    if (!sync) return Promise.resolve(unsupportedResult());
    return sync.queue(usernameKey, op);
  }

  function getStudentWorkshops(usernameKey) {
    var key = getWorkshopsKey(usernameKey);
    if (!key) return [];
    var arr = readJson(localStorage.getItem(key), []);
    return Array.isArray(arr) ? arr : [];
  }

  // Compatibilidad: ya NO reemplaza la lista de la nube; solo cachea local.
  function setStudentWorkshops(usernameKey, workshops) {
    var key = getWorkshopsKey(usernameKey);
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(Array.isArray(workshops) ? workshops : []));
  }

  // ── Operaciones del admin ────────────────────────────────────────────────────
  // Todas devuelven Promise<{ ok, status, reason, message, pending, opOutcome }>.
  // createWorkshop: opOutcome "duplicate-active" si, segun la NUBE (no el cache
  // de este equipo), el aprendiz ya tiene un taller de ese tipo sin cerrar.
  function createWorkshop(usernameKey, opts) {
    if (!usernameKey) return Promise.resolve({ ok: false, status: "aborted", reason: "invalid-args", message: "Falta el aprendiz." });
    var workshop = makeWorkshop(opts);
    return queueWorkshopOp(usernameKey, {
      type: "create",
      record: workshop,
      uniqueActive: workshop.workshopKey ? { field: "workshopKey", value: workshop.workshopKey } : null,
    }).then(function (r) { return Object.assign({}, r, { record: workshop }); });
  }

  function updateWorkshopDeadline(usernameKey, workshopId, nuevaFecha) {
    return queueWorkshopOp(usernameKey, { type: "deadline", id: workshopId, fecha: nuevaFecha || "", cambiadoEn: new Date().toISOString() });
  }

  function setWorkshopResult(usernameKey, workshopId, grade) {
    return queueWorkshopOp(usernameKey, {
      type: "patch",
      id: workshopId,
      set: { resultado: grade === "A" || grade === "D" ? grade : "", resultadoEn: new Date().toISOString() },
    });
  }

  // Marca el taller como entregado y registra la fecha.
  function markWorkshopDelivered(usernameKey, workshopId, fechaISO, archivo) {
    return queueWorkshopOp(usernameKey, {
      type: "patch",
      id: workshopId,
      set: { entrega: { entregadoEn: fechaISO || new Date().toISOString(), archivo: archivo || "" } },
    });
  }

  // Eliminacion LEGITIMA: solo la pide el instructor, por id.
  function deleteWorkshop(usernameKey, workshopId) {
    return queueWorkshopOp(usernameKey, { type: "delete", id: workshopId });
  }

  // Lectura estricta. -> Promise<{ status, list, reason, message }>; con
  // status "error" la lista es null y el cache NO se toca.
  function refreshStudentWorkshopsFromCloud(usernameKey) {
    var sync = workshopsSync();
    if (sync) return sync.refresh(usernameKey);
    // firebase_db.js antiguo (solo lado aprendiz): la lectura legada solo se
    // acepta si trae registros; su [] es ambiguo.
    var db = workshopsCloudDb();
    if (!db) return Promise.resolve({ status: "error", list: null, reason: "no-db", message: "" });
    return Promise.resolve(db.cloudGetReinforcementWorkshops(usernameKey))
      .then(function (list) {
        if (Array.isArray(list) && list.length) {
          setStudentWorkshops(usernameKey, list);
          return { status: "found", list: list, reason: "", message: "" };
        }
        return { status: "error", list: null, reason: "ambiguous", message: "" };
      })
      .catch(function () { return { status: "error", list: null, reason: "exception", message: "" }; });
  }

  // Compatibilidad (pagina del aprendiz): la lista leida, o el cache si fallo.
  async function syncStudentWorkshopsFromCloud(usernameKey) {
    var r = await refreshStudentWorkshopsFromCloud(usernameKey);
    return r && r.list ? r.list : getStudentWorkshops(usernameKey);
  }

  function retryPendingWorkshopsSync(usernameKey) {
    var sync = workshopsSync();
    return sync ? sync.retry(usernameKey) : Promise.resolve([unsupportedResult()]);
  }

  function getPendingWorkshopsCount(usernameKey) {
    var sync = workshopsSync();
    return sync ? sync.pendingCount(usernameKey) : 0;
  }

  // ── Respuestas (coleccion separada, el aprendiz SI escribe la suya) ──────────
  // sena_portal_reinforcement_answers/{usernameKey}: { answers: { [workshopId]:
  // {...respuestas} } }. Separado de sena_portal_reinforcement_workshops a
  // proposito -- ese doc guarda datos autoritativos (fechaLimite, estado,
  // resultado) que solo el admin puede escribir; aqui solo texto del aprendiz.
  // 2026-10-27: antes se reemplazaba el mapa COMPLETO de respuestas; con una
  // lectura fallida ({} ambiguo) el cache quedaba vacio y el siguiente
  // guardado borraba las respuestas de los demas talleres. Ahora solo se
  // envian los CAMPOS que el aprendiz cambio (answers.<taller>.<campo>), y los
  // no confirmados quedan pendientes en este equipo hasta que la nube los acepte.
  var ANSWERS_STORAGE_KEY = "reinforcement_answers";
  var ANSWERS_PENDING_STORAGE_KEY = "sena_portal_reinforcement_answers_pending_v1";
  var ANSWER_REMOVED = { __removed: true };

  function getAnswersKey(usernameKey) {
    var auth = window.portalAuth;
    if (!auth || !auth.getStudentStorageKey) return null;
    return auth.getStudentStorageKey(usernameKey, ANSWERS_STORAGE_KEY, { area: "guide-data" });
  }

  function answersCloudDb() {
    var db = window._firebaseDb;
    return db && typeof db.cloudGetReinforcementAnswers === "function" ? db : null;
  }

  function getStudentAnswers(usernameKey) {
    var key = getAnswersKey(usernameKey);
    if (!key) return {};
    var obj = readJson(localStorage.getItem(key), {});
    return obj && typeof obj === "object" ? obj : {};
  }

  function writeAnswersCache(usernameKey, answers) {
    var key = getAnswersKey(usernameKey);
    if (key) localStorage.setItem(key, JSON.stringify(answers && typeof answers === "object" ? answers : {}));
  }

  // { usernameKey: { workshopId: { campo: valor | ANSWER_REMOVED } } }
  function loadPendingAnswers() {
    var parsed = readJson((function () { try { return localStorage.getItem(ANSWERS_PENDING_STORAGE_KEY); } catch (e) { return null; } })(), {});
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  }
  function savePendingAnswers(all) {
    try {
      var clean = {};
      Object.keys(all).forEach(function (user) {
        Object.keys(all[user] || {}).forEach(function (ws) {
          if (Object.keys(all[user][ws] || {}).length) {
            clean[user] = clean[user] || {};
            clean[user][ws] = all[user][ws];
          }
        });
      });
      if (Object.keys(clean).length) localStorage.setItem(ANSWERS_PENDING_STORAGE_KEY, JSON.stringify(clean));
      else localStorage.removeItem(ANSWERS_PENDING_STORAGE_KEY);
    } catch (e) { /* sin almacenamiento: se reintentara al proximo guardado */ }
  }

  function isRemovedMarker(v) { return Boolean(v) && typeof v === "object" && v.__removed === true; }

  function overlayPendingAnswers(usernameKey, answers) {
    var out = JSON.parse(JSON.stringify(answers || {}));
    var pend = loadPendingAnswers()[usernameKey] || {};
    Object.keys(pend).forEach(function (ws) {
      out[ws] = out[ws] && typeof out[ws] === "object" ? out[ws] : {};
      Object.keys(pend[ws]).forEach(function (k) {
        if (isRemovedMarker(pend[ws][k])) delete out[ws][k];
        else out[ws][k] = pend[ws][k];
      });
    });
    return out;
  }

  // Compatibilidad: reemplaza el cache local (NO escribe en la nube).
  function setStudentAnswers(usernameKey, answers) {
    writeAnswersCache(usernameKey, answers);
  }

  // Respuestas de UN taller (por su id de asignacion).
  function getWorkshopAnswers(usernameKey, workshopId) {
    var all = getStudentAnswers(usernameKey);
    return (all[workshopId] && typeof all[workshopId] === "object") ? all[workshopId] : {};
  }

  var _answersInFlight = {};
  var _answersLastFailed = {};

  // Envia los campos pendientes de UN taller. -> Promise<{ ok, status, reason, message, pending }>
  function flushWorkshopAnswers(usernameKey, workshopId) {
    var db = window._firebaseDb;
    var pendAll = loadPendingAnswers();
    var fields = (pendAll[usernameKey] || {})[workshopId] || {};
    var keys = Object.keys(fields);
    if (!keys.length) return Promise.resolve({ ok: true, status: "saved", reason: "no-changes", message: "", pending: 0 });
    if (!db || typeof db.cloudSaveReinforcementAnswerFields !== "function") {
      return Promise.resolve(Object.assign(unsupportedResult(), { pending: keys.length }));
    }
    var flightKey = usernameKey + "|" + workshopId;
    if (_answersInFlight[flightKey]) return _answersInFlight[flightKey];
    var changes = {};
    var removed = [];
    keys.forEach(function (k) { if (isRemovedMarker(fields[k])) removed.push(k); else changes[k] = fields[k]; });
    var sentSnapshot = JSON.stringify(fields);
    var run = Promise.resolve(db.cloudSaveReinforcementAnswerFields(usernameKey, workshopId, changes, removed))
      .catch(function () { return { status: "error", reason: "exception" }; })
      .then(function (r) {
        _answersInFlight[flightKey] = null;
        var ok = r && r.status === "ok";
        var latest = loadPendingAnswers();
        if (ok) {
          // Solo se limpian los campos que no cambiaron mientras se enviaban.
          var sent = JSON.parse(sentSnapshot);
          var now = (latest[usernameKey] || {})[workshopId] || {};
          Object.keys(sent).forEach(function (k) {
            if (JSON.stringify(now[k]) === JSON.stringify(sent[k])) delete now[k];
          });
          if (latest[usernameKey]) latest[usernameKey][workshopId] = now;
          savePendingAnswers(latest);
        }
        var remaining = Object.keys(((loadPendingAnswers()[usernameKey] || {})[workshopId]) || {}).length;
        var outcome = { ok: ok, status: ok ? "saved" : "write-failed", reason: (r && r.reason) || "", pending: remaining };
        outcome.message = ok ? "" : (db.describeCloudWriteFailure ? db.describeCloudWriteFailure(outcome) : "No se pudo guardar en la nube.");
        var toast = window.portalSaveStatus;
        if (!ok) {
          _answersLastFailed[flightKey] = true;
          if (toast && typeof toast.error === "function") toast.error("Respuestas guardadas solo en este equipo: " + outcome.message + " Se enviaran a la nube al reintentar.");
        } else if (_answersLastFailed[flightKey]) {
          delete _answersLastFailed[flightKey];
          if (toast && typeof toast.saved === "function") toast.saved("Respuestas pendientes enviadas a la nube.");
        }
        if (ok && remaining) return flushWorkshopAnswers(usernameKey, workshopId);
        return outcome;
      });
    _answersInFlight[flightKey] = run;
    return run;
  }

  function flushAllPendingAnswers(usernameKey) {
    var pend = loadPendingAnswers()[usernameKey] || {};
    return Promise.all(Object.keys(pend).map(function (ws) { return flushWorkshopAnswers(usernameKey, ws); }));
  }

  // Lo invoca el ESTUDIANTE al guardar/tipear (rule isOwnerByUsernameKey lo
  // autoriza en sena_portal_reinforcement_answers). Devuelve las respuestas
  // del taller (como antes) y deja el envio en curso; el resultado real se
  // obtiene con flushWorkshopAnswers.
  function saveWorkshopAnswers(usernameKey, workshopId, respuestas) {
    var all = getStudentAnswers(usernameKey);
    var prev = (all[workshopId] && typeof all[workshopId] === "object") ? all[workshopId] : {};
    var next = respuestas && typeof respuestas === "object" ? JSON.parse(JSON.stringify(respuestas)) : {};
    var pendAll = loadPendingAnswers();
    pendAll[usernameKey] = pendAll[usernameKey] || {};
    var dirty = pendAll[usernameKey][workshopId] || {};
    Object.keys(next).forEach(function (k) {
      if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) dirty[k] = next[k];
    });
    Object.keys(prev).forEach(function (k) { if (!(k in next)) dirty[k] = ANSWER_REMOVED; });
    pendAll[usernameKey][workshopId] = dirty;
    savePendingAnswers(pendAll);
    all[workshopId] = next;
    writeAnswersCache(usernameKey, all);
    flushWorkshopAnswers(usernameKey, workshopId);
    return all[workshopId];
  }

  // Lectura estricta. -> Promise<{ status, answers, reason, message }>.
  // Con status "error" el cache NO se toca (antes {} lo vaciaba).
  function refreshStudentAnswersFromCloud(usernameKey) {
    var db = answersCloudDb();
    if (!db) return Promise.resolve({ status: "error", answers: null, reason: "no-db", message: "" });
    var read = typeof db.cloudGetReinforcementAnswersStrict === "function"
      ? Promise.resolve(db.cloudGetReinforcementAnswersStrict(usernameKey))
      : Promise.resolve(db.cloudGetReinforcementAnswers(usernameKey)).then(function (a) {
          return a && typeof a === "object" && Object.keys(a).length
            ? { status: "found", answers: a }
            : { status: "error", reason: "ambiguous" };
        });
    return read
      .catch(function () { return { status: "error", reason: "exception" }; })
      .then(function (r) {
        if (r && (r.status === "found" || r.status === "missing")) {
          var view = overlayPendingAnswers(usernameKey, r.answers || {});
          writeAnswersCache(usernameKey, view);
          return { status: r.status, answers: view, reason: "", message: "" };
        }
        var reason = (r && r.reason) || "unknown";
        var msg = db.describeCloudWriteFailure ? db.describeCloudWriteFailure({ status: "read-failed", reason: reason }) : "No se pudieron leer las respuestas.";
        return { status: "error", answers: null, reason: reason, message: msg };
      });
  }

  // Trae del cloud y cachea local (lo usa el aprendiz al abrir su pagina, y el
  // admin al revisar respuestas). Si hay campos pendientes de este equipo, se
  // reenvian despues de leer.
  async function syncStudentAnswersFromCloud(usernameKey) {
    var r = await refreshStudentAnswersFromCloud(usernameKey);
    if (Object.keys(loadPendingAnswers()[usernameKey] || {}).length) flushAllPendingAnswers(usernameKey);
    return r && r.answers ? r.answers : getStudentAnswers(usernameKey);
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("online", function () {
      Object.keys(loadPendingAnswers()).forEach(function (user) { flushAllPendingAnswers(user); });
    });
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
      getStudentAnswers: getStudentAnswers,
      setStudentAnswers: setStudentAnswers,
      getWorkshopAnswers: getWorkshopAnswers,
      saveWorkshopAnswers: saveWorkshopAnswers,
      syncStudentAnswersFromCloud: syncStudentAnswersFromCloud,
      refreshStudentWorkshopsFromCloud: refreshStudentWorkshopsFromCloud,
      refreshStudentAnswersFromCloud: refreshStudentAnswersFromCloud,
      flushWorkshopAnswers: flushWorkshopAnswers,
      retryPendingWorkshopsSync: retryPendingWorkshopsSync,
      getPendingWorkshopsCount: getPendingWorkshopsCount,
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
