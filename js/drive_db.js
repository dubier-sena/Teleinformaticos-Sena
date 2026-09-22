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

  // Un fallo de TRANSPORTE (el Apps Script no responde, responde 404/5xx, o se
  // agota DRIVE_DB_TIMEOUT_MS) NO es lo mismo que "el documento no existe".
  // Hasta 2026-09-22 ambos casos devolvian exactamente lo mismo (null) y el
  // llamador no podia distinguirlos: firebase_db.js interpretaba la caida de la
  // replica como "documento vacio" y el guardado de guia escribia el estado
  // local ENCIMA del documento de Firestore sin fusionar nada.
  //
  // Medicion en produccion el 2026-09-22 contra el Web App de respaldo: con solo
  // 3 peticiones simultaneas, 1 de 3 respondio 404 tras 34 s; con 6, dos 404; con
  // 10, tres 404 y latencias de 10-32 s (el mismo documento en Firestore: 0,8 s y
  // 100% de exito). Un salon entero abriendo guias supera ese umbral de sobra,
  // asi que este caso no es teorico.
  //
  // `transport: true` marca ese fallo para que quien llame pueda reintentar
  // contra Firestore en vez de dar por buena una lectura vacia.
  async function call(action, body) {
    var url = getBackupUrl();
    if (!url) return { ok: false, transport: true };
    var idToken = await getIdToken();
    if (!idToken) return { ok: false, transport: true };

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
      if (!res.ok) return { ok: false, transport: true, status: res.status };
      return await res.json();
    } catch (_) {
      return { ok: false, transport: true };
    }
  }

  // Lectura con el resultado DESGLOSADO:
  //   { status: "found",       data }  -> la replica tiene el documento
  //   { status: "missing",     data: null } -> la replica respondio y NO lo tiene
  //   { status: "unavailable", data: null } -> la replica no respondio (no se sabe)
  async function getDetailed(collection, docId) {
    var result = await call("get", { collection: collection, docId: docId });
    if (!result || (result.ok !== true && result.transport === true)) {
      return { status: "unavailable", data: null };
    }
    if (!result.ok) return { status: "missing", data: null };
    return result.found
      ? { status: "found", data: result.data }
      : { status: "missing", data: null };
  }

  // Se conserva con el MISMO contrato de siempre (dato o null) para no cambiar
  // el comportamiento de ningun llamador que no necesite el desglose.
  async function get(collection, docId) {
    var detailed = await getDetailed(collection, docId);
    return detailed.status === "found" ? detailed.data : null;
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

  // Bloque C.1 (cierre de hallazgo de privacidad): vista PROPIA del
  // catalogo de Etapa Productiva. Sin collection/docId -- a proposito: la
  // identidad la resuelve el Apps Script SOLO desde el idToken ya
  // verificado (nunca desde nada que este cliente pudiera mandar), y el
  // filtrado (solo los documentDeliveries del propio aprendiz) ocurre
  // SERVER-SIDE (ver apps-script/respaldo_firestore.gs,
  // handleStudentProductiveStageView). El cliente nunca ve ni podria pedir
  // el documento completo por este camino.
  async function getStudentProductiveStageView() {
    var result = await call("studentProductiveStageView", {});
    return result && result.ok && result.found ? result.data : null;
  }

  async function list(collection) {
    var result = await call("list", { collection: collection });
    if (!result || !result.ok || !Array.isArray(result.docs)) return [];
    return result.docs.map(function (entry) {
      // Devolvemos solo el data para que sea espejo de fsList.
      // Si el caller necesita docId, viene en entry.data si fue guardado ahi.
      return entry.data && typeof entry.data === "object"
        ? Object.assign({ usernameKey: entry.docId }, entry.data)
        : entry.data;
    }).filter(Boolean);
  }

  window.driveDb = {
    isEnabled: isEnabled,
    get: get,
    getDetailed: getDetailed,
    set: set,
    updateField: updateField,
    deleteDoc: deleteDoc,
    list: list,
    getStudentProductiveStageView: getStudentProductiveStageView,
  };
})();
