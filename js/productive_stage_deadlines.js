(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.productiveStageDeadlines = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Fechas limite HISTORICAS de bitacoras/Sofia Plus, hardcodeadas antes de
  // esta migracion a admin-editable (ver productive_stage_project_delivery.js,
  // BITACORA_DEADLINES). Se conservan aqui TAL CUAL como fallback legacy --
  // pedido explicito del usuario: no se borran ni se migran automaticamente,
  // solo se usan cuando el admin NUNCA configuro una fecha para ese docId
  // (ver resolveEffectiveDeadline). No cambiar estos valores sin coordinar:
  // son las fechas reales ya acordadas con el instructor de seguimiento.
  var LEGACY_DATE_ONLY_BY_DOC_ID = {
    "sofia-plus": "2026-03-27",
    "bitacora-1": "2026-03-27",
    "bitacora-2": "2026-04-30",
    "bitacora-3": "2026-05-29",
    "bitacora-4": "2026-07-31",
    "bitacora-5": "2026-08-28",
    "bitacora-6": "2026-10-23",
  };

  // Colombia no usa horario de verano: offset fijo -05:00 todo el ano (misma
  // convencion que js/activity_deadlines.js). Copia local deliberada en vez
  // de una dependencia compartida: este modulo y activity_deadlines.js viven
  // en paginas distintas (admin vs. aprendiz de Etapa Productiva) con su
  // propio orden de carga; una extraccion compartida obligaria a tocar el
  // <script> de cada pagina que hoy carga cualquiera de los dos. La logica es
  // pequena, estable y ya esta cubierta por tests en ambos lados.
  var BOGOTA_OFFSET = "-05:00";
  var BOGOTA_OFFSET_HOURS = -5;

  function normalizeDueAt(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    var localMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/);
    if (localMatch) {
      var y = localMatch[1], mo = localMatch[2], d = localMatch[3], hh = localMatch[4], mm = localMatch[5], ss = localMatch[6] || "00";
      var parsedLocal = new Date(y + "-" + mo + "-" + d + "T" + hh + ":" + mm + ":" + ss + BOGOTA_OFFSET);
      return Number.isNaN(parsedLocal.getTime()) ? "" : parsedLocal.toISOString();
    }
    var parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }

  function dueAtForInput(isoValue) {
    if (!isoValue) return "";
    var parsed = new Date(isoValue);
    if (Number.isNaN(parsed.getTime())) return "";
    var bogotaMs = parsed.getTime() + BOGOTA_OFFSET_HOURS * 3600000;
    var b = new Date(bogotaMs);
    var y = b.getUTCFullYear();
    var mo = String(b.getUTCMonth() + 1).padStart(2, "0");
    var d = String(b.getUTCDate()).padStart(2, "0");
    var hh = String(b.getUTCHours()).padStart(2, "0");
    var mm = String(b.getUTCMinutes()).padStart(2, "0");
    return y + "-" + mo + "-" + d + "T" + hh + ":" + mm;
  }

  // "YYYY-MM-DD" (fecha sola, como vive el legacy) -> ISO UTC de fin de dia
  // en Bogota (23:59). Mismo criterio que isPastDeadline() en
  // productive_stage_project_delivery.js, ahora centralizado aqui.
  function legacyDeadlineIso(docId) {
    var dateOnly = LEGACY_DATE_ONLY_BY_DOC_ID[String(docId || "").trim()];
    return dateOnly ? normalizeDueAt(dateOnly + "T23:59:00") : "";
  }

  function getDeadlineRecord(snapshot, docId) {
    var deadlines = snapshot && snapshot.documentDeadlines && typeof snapshot.documentDeadlines === "object"
      ? snapshot.documentDeadlines
      : {};
    return deadlines[String(docId || "").trim()] || null;
  }

  // Precedencia (pedido del usuario, puntos 6/7/8/9):
  //   1. El admin configuro una fecha real  -> se usa esa.
  //   2. El admin la elimino explicitamente ("cleared") -> SIN fecha limite,
  //      nunca se "resucita" el legacy.
  //   3. Nunca se configuro nada (no hay registro) -> legacy hardcodeado.
  // "fuente no disponible" (snapshot vacio/carga fallida) cae solo en el
  // caso 3 de forma natural: sin registro = mismo comportamiento de hoy.
  function resolveEffectiveDeadline(snapshot, docId) {
    var record = getDeadlineRecord(snapshot, docId);
    if (record && record.cleared) {
      return { dueAt: "", source: "cleared", updatedAt: record.updatedAt || "", updatedBy: record.updatedBy || "" };
    }
    if (record && record.dueAt) {
      return { dueAt: record.dueAt, source: "admin", updatedAt: record.updatedAt || "", updatedBy: record.updatedBy || "" };
    }
    var legacy = legacyDeadlineIso(docId);
    return { dueAt: legacy, source: legacy ? "legacy" : "none", updatedAt: "", updatedBy: "" };
  }

  function setDeadline(snapshot, docId, dueAtInput, updatedBy) {
    var cleanDueAt = normalizeDueAt(dueAtInput);
    if (!cleanDueAt) {
      throw new Error("Debes indicar una fecha y hora validas.");
    }
    var store = (typeof window !== "undefined" && window.productiveStageStore) || null;
    if (!store || typeof store.setDocumentDeadlineInSnapshot !== "function") {
      throw new Error("productiveStageStore no esta disponible.");
    }
    return store.setDocumentDeadlineInSnapshot(snapshot, docId, {
      dueAt: cleanDueAt,
      updatedAt: new Date().toISOString(),
      updatedBy: String(updatedBy || "admin").trim() || "admin",
    });
  }

  // El admin "quita" la fecha: NO borra el registro (eso lo dejaria
  // indistinguible de "nunca configurado" y resucitaria el legacy sin
  // querer, punto 9 del pedido) -- escribe un tombstone explicito.
  function clearDeadline(snapshot, docId, updatedBy) {
    var store = (typeof window !== "undefined" && window.productiveStageStore) || null;
    if (!store || typeof store.setDocumentDeadlineInSnapshot !== "function") {
      throw new Error("productiveStageStore no esta disponible.");
    }
    return store.setDocumentDeadlineInSnapshot(snapshot, docId, {
      cleared: true,
      updatedAt: new Date().toISOString(),
      updatedBy: String(updatedBy || "admin").trim() || "admin",
    });
  }

  // ── Estados visibles (punto 10 del pedido) ──────────────────────────────
  var STATUS = {
    NO_DEADLINE: "no-deadline",
    DELIVERED: "delivered",
    OVERDUE: "overdue",
    DUE_TODAY: "due-today",
    DUE_TOMORROW: "due-tomorrow",
    PENDING: "pending",
  };

  var STATUS_LABEL = {
    "no-deadline": "Sin fecha límite",
    "delivered": "Entregada",
    "overdue": "Vencida",
    "due-today": "Vence hoy",
    "due-tomorrow": "Vence mañana",
    "pending": "Pendiente",
  };

  // Dia calendario en Bogota (no en la zona del navegador/runner) de un
  // instante UTC -- mismo criterio que dueAtForInput, aislado aqui para
  // poder comparar "hoy"/"mañana" sin depender de Intl/ICU (determinista en
  // cualquier entorno, incluido un runner de CI en UTC).
  function bogotaDateKey(date) {
    var bogotaMs = date.getTime() + BOGOTA_OFFSET_HOURS * 3600000;
    var b = new Date(bogotaMs);
    return b.getUTCFullYear() + "-" + String(b.getUTCMonth() + 1).padStart(2, "0") + "-" + String(b.getUTCDate()).padStart(2, "0");
  }

  function addDaysToKey(key, days) {
    var parts = key.split("-").map(Number);
    var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
  }

  function classifyStatus(options) {
    var opts = options || {};
    if (opts.deliveredAt) {
      return STATUS.DELIVERED;
    }
    var dueAt = String(opts.dueAt || "").trim();
    if (!dueAt) {
      return STATUS.NO_DEADLINE;
    }
    var dueMs = Date.parse(dueAt);
    if (!Number.isFinite(dueMs)) {
      return STATUS.NO_DEADLINE;
    }
    var now = opts.now instanceof Date ? opts.now : new Date();
    if (now.getTime() > dueMs) {
      return STATUS.OVERDUE;
    }
    var nowKey = bogotaDateKey(now);
    var dueKey = bogotaDateKey(new Date(dueMs));
    if (nowKey === dueKey) {
      return STATUS.DUE_TODAY;
    }
    if (addDaysToKey(nowKey, 1) === dueKey) {
      return STATUS.DUE_TOMORROW;
    }
    return STATUS.PENDING;
  }

  return {
    LEGACY_DATE_ONLY_BY_DOC_ID: LEGACY_DATE_ONLY_BY_DOC_ID,
    STATUS: STATUS,
    STATUS_LABEL: STATUS_LABEL,
    normalizeDueAt: normalizeDueAt,
    dueAtForInput: dueAtForInput,
    legacyDeadlineIso: legacyDeadlineIso,
    getDeadlineRecord: getDeadlineRecord,
    resolveEffectiveDeadline: resolveEffectiveDeadline,
    setDeadline: setDeadline,
    clearDeadline: clearDeadline,
    classifyStatus: classifyStatus,
    bogotaDateKey: bogotaDateKey,
  };
});
