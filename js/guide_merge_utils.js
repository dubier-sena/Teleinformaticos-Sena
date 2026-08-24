// js/guide_merge_utils.js
// Fase 14 (mantenibilidad): utilidades PURAS de fusion y lectura de snapshots
// de estado de guia, extraidas de firebase_db.js sin cambiar su comportamiento
// (mismo codigo, movido literal). No hacen red, no tocan localStorage, no
// dependen de Firebase -- toman datos y devuelven datos, por eso se pueden
// probar aisladas sin mocks de Firestore/Drive.
//
// mergeGuideDataSnapshotForSave() es la logica de resolucion de conflictos
// (LWW por updatedAt, con tolerancia de 1s, y override si es una accion admin
// explicita) que usa TODO el guardado de guias -- ver "Trust model" y
// "mergeGuideDataSnapshotForSave" en CLAUDE.md. NO se le cambio nada aqui.
//
// Expuesta como window.guideMergeUtils (uso en pagina) y module.exports (tests).
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.guideMergeUtils = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function readSnapshotPayload(doc) {
    if (!doc || typeof doc !== "object") return null;
    if (typeof doc.snapshotJson === "string") {
      try { return JSON.parse(doc.snapshotJson); } catch (e) {}
    }
    return doc;
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function snapshotState(snapshot) {
    if (plainObject(snapshot && snapshot.state)) return snapshot.state;
    if (plainObject(snapshot && snapshot.data)) return snapshot.data;
    return {};
  }

  function hasMeaningfulGuideValue(value) {
    if (value == null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return !isNaN(value);
    if (typeof value === "boolean") return value === true;
    if (Array.isArray(value)) return value.length > 0;
    if (plainObject(value)) return Object.keys(value).length > 0;
    return true;
  }

  function countMeaningfulGuideValues(record) {
    if (!plainObject(record)) return 0;
    return Object.keys(record).filter(function (key) {
      return hasMeaningfulGuideValue(record[key]);
    }).length;
  }

  function deriveProgressFromGuideDataDoc(fileName, doc) {
    var snapshot = readSnapshotPayload(doc);
    var state = snapshotState(snapshot);
    var completedFromState = countMeaningfulGuideValues(state);
    if (completedFromState <= 0) return null;

    var auth = (typeof window !== "undefined" && window.portalAuth) || {};
    var config = auth.GUIDE_PROGRESS_CONFIG && auth.GUIDE_PROGRESS_CONFIG[fileName];
    var total = Math.max(0, Number(config && config.total) || 0);
    if (total <= 0) {
      total = completedFromState;
    }
    var completed = Math.min(completedFromState, total);
    return {
      completed: completed,
      total: total,
      percent: total ? Math.round((completed / total) * 100) : 0,
      updatedAt: (snapshot && snapshot.updatedAt) || (doc && doc.updatedAt) || "",
      source: "guide-data",
    };
  }

  function mergeGuideValue(previous, incoming) {
    if (plainObject(previous) && plainObject(incoming)) {
      var nested = Object.assign({}, previous);
      Object.keys(incoming).forEach(function (key) {
        nested[key] = mergeGuideValue(previous[key], incoming[key]);
      });
      return nested;
    }

    if (!hasMeaningfulGuideValue(incoming) && hasMeaningfulGuideValue(previous)) {
      return previous;
    }

    return incoming;
  }

  function mergeGuideState(previousState, incomingState, allowMissingLockRemoval) {
    var previous = plainObject(previousState) ? previousState : {};
    var incoming = plainObject(incomingState) ? incomingState : {};
    var next = Object.assign({}, previous);

    if (allowMissingLockRemoval) {
      Object.keys(previous).forEach(function (key) {
        if (/-locked$/.test(key) && !Object.prototype.hasOwnProperty.call(incoming, key)) {
          delete next[key];
        }
      });
    }

    Object.keys(incoming).forEach(function (key) {
      if (/-locked$/.test(key)) {
        if (incoming[key]) next[key] = true;
        else delete next[key];
        return;
      }
      next[key] = mergeGuideValue(previous[key], incoming[key]);
    });

    return next;
  }

  // Lee un timestamp ISO 8601 del snapshot. Devuelve epoch ms o NaN.
  function snapshotTimestamp(snapshot) {
    if (!plainObject(snapshot)) return NaN;
    var candidates = [
      snapshot.updatedAt,
      snapshot.lastModified,
      snapshot.savedAt,
      snapshot.timestamp,
    ];
    for (var i = 0; i < candidates.length; i++) {
      var parsed = Date.parse(candidates[i] || "");
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }

  function mergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot) {
    var existing = plainObject(existingSnapshot) ? existingSnapshot : {};
    var incoming = plainObject(incomingSnapshot) ? incomingSnapshot : {};
    var updatedBy = String(incoming.updatedBy || "").toLowerCase();
    var isAdminOverride = Boolean(
      incoming.reabierta ||
      incoming.permiteEdicion ||
      /admin|unlock|habilit|reabiert/.test(updatedBy)
    );

    // Resolución de conflictos por timestamp (LWW = Last Write Wins).
    // Si el doc remoto es más nuevo y el incoming no es una acción admin
    // explícita, preservamos el remoto para no sobreescribir cambios hechos
    // en otro equipo entre el load y el save. Tolerancia de 1s para jitter
    // de relojes mal sincronizados.
    var existingTs = snapshotTimestamp(existing);
    var incomingTs = snapshotTimestamp(incoming);
    if (
      !isAdminOverride &&
      Number.isFinite(existingTs) &&
      Number.isFinite(incomingTs) &&
      existingTs > incomingTs + 1000
    ) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "[firebase_db] Conflicto de sincronizacion: el doc remoto es mas nuevo (" +
          new Date(existingTs).toISOString() + ") que el incoming (" +
          new Date(incomingTs).toISOString() + "). Se preserva el remoto."
        );
      }
      return existing;
    }

    var mergedState = mergeGuideState(snapshotState(existing), snapshotState(incoming), isAdminOverride);
    var merged = Object.assign({}, existing, incoming);

    if (Object.prototype.hasOwnProperty.call(incoming, "data") || Object.prototype.hasOwnProperty.call(existing, "data")) {
      merged.data = mergedState;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "state") || Object.prototype.hasOwnProperty.call(existing, "state")) {
      merged.state = mergedState;
    }
    if (!Object.prototype.hasOwnProperty.call(merged, "state") && !Object.prototype.hasOwnProperty.call(merged, "data")) {
      merged.state = mergedState;
    }

    return merged;
  }

  return {
    readSnapshotPayload: readSnapshotPayload,
    plainObject: plainObject,
    snapshotState: snapshotState,
    hasMeaningfulGuideValue: hasMeaningfulGuideValue,
    countMeaningfulGuideValues: countMeaningfulGuideValues,
    deriveProgressFromGuideDataDoc: deriveProgressFromGuideDataDoc,
    mergeGuideValue: mergeGuideValue,
    mergeGuideState: mergeGuideState,
    snapshotTimestamp: snapshotTimestamp,
    mergeGuideDataSnapshotForSave: mergeGuideDataSnapshotForSave,
  };
});
