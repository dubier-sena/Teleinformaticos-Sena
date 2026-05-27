/**
 * drive_db.js — Cliente del Web App de respaldo (apps-script/respaldo_firestore.gs).
 *
 * Expone window.driveDb con get/set/updateField/deleteDoc. Lo usa firebase_db.js
 * como fallback cuando Firestore no responde (modo respaldo de fase 2).
 *
 * Cada llamada va por POST con body JSON: {action, idToken, collection, docId, ...}.
 * El Apps Script verifica el idToken contra Firebase Auth antes de aceptar nada.
 */
(function () {
  "use strict";

  if (window.driveDb) return;

  var DRIVE_DB_TIMEOUT_MS = 15000;

  function getBackupUrl() {
    var pi = window.PROJECT_INTEGRATIONS;
    var url = pi && typeof pi.respaldoFirestoreUrl === "string" ? pi.respaldoFirestoreUrl : "";
    return (url || "").trim();
  }

  function isEnabled() {
    return Boolean(getBackupUrl());
  }

  async function getIdToken() {
    var bridge = window.portalFirebaseAuth;
    if (!bridge || typeof bridge.getIdToken !== "function") return null;
    try {
      return await bridge.getIdToken();
    } catch (_) {
      return null;
    }
  }

  function fetchWithTimeout(url, init, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("drive_db timeout"));
      }, timeoutMs);
      fetch(url, init).then(
        function (res) {
          clearTimeout(timer);
          resolve(res);
        },
        function (err) {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  async function call(action, body) {
    var url = getBackupUrl();
    if (!url) return { ok: false };
    var idToken = await getIdToken();
    if (!idToken) return { ok: false };

    var payload = Object.assign({ action: action, idToken: idToken }, body || {});
    try {
      var res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          // text/plain evita preflight CORS contra Apps Script.
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        },
        DRIVE_DB_TIMEOUT_MS
      );
      if (!res.ok) return { ok: false };
      return await res.json();
    } catch (_) {
      return { ok: false };
    }
  }

  async function get(collection, docId) {
    var result = await call("get", { collection: collection, docId: docId });
    return result && result.ok && result.found ? result.data : null;
  }

  async function set(collection, docId, data) {
    var result = await call("set", { collection: collection, docId: docId, data: data });
    return Boolean(result && result.ok);
  }

  async function updateField(collection, docId, fieldName, fieldValue) {
    var result = await call("updateField", {
      collection: collection,
      docId: docId,
      fieldName: fieldName,
      fieldValue: fieldValue,
    });
    return Boolean(result && result.ok);
  }

  async function deleteDoc(collection, docId) {
    var result = await call("delete", { collection: collection, docId: docId });
    return Boolean(result && result.ok);
  }

  window.driveDb = {
    isEnabled: isEnabled,
    get: get,
    set: set,
    updateField: updateField,
    deleteDoc: deleteDoc,
  };
})();
