/* global_error_handler.js
 * ----------------------------------------------------------------------------
 * Cinturon de seguridad final para errores NO capturados por el resto del
 * portal (Firestore, entregas y el laboratorio de Python ya tienen su propio
 * manejo de errores especifico -- ver firebase_db.js, shared_apps_script_delivery.js,
 * python_online_lab.js). Este script cubre lo que quede FUERA de esos try/catch:
 * una excepcion inesperada en un manejador de clic, una promesa sin .catch(), etc.
 *
 * Que hace:
 *   1. Registra SIEMPRE el detalle tecnico en consola (para devtools) y en un
 *      registro acotado en localStorage (para poder diagnosticar despues, ya
 *      que en un salon de clase nadie esta mirando la consola en el momento).
 *   2. Avisa al aprendiz UNA vez por error (no por cada repeticion) con un
 *      mensaje generico y accionable, sin exponer stack traces ni nombres de
 *      archivo internos.
 *   3. Nunca interrumpe ni recarga la pagina por su cuenta: la informacion ya
 *      guardada (localStorage/Firestore) no se toca. Es solo observacion.
 *
 * Reglas de diseno (mismo espiritu que integrity_monitor.js):
 *   - Este script NUNCA debe el mismo lanzar una excepcion sin atrapar.
 *   - No reintenta nada ni entra en bucle: cada entrada se escribe una sola
 *     vez; el aviso visual se limita con deduplicacion + un freno de emergencia.
 *   - No duplica el manejo de errores de red/entregas/Firestore ya existente;
 *     solo atrapa lo que se les escape.
 * ----------------------------------------------------------------------------
 */
(function () {
  "use strict";

  if (typeof window === "undefined") return;
  if (window.__senaGlobalErrorHandlerInstalled) return;
  window.__senaGlobalErrorHandlerInstalled = true;

  var STORAGE_KEY = "sena_portal_client_errors_v1";
  var MAX_ENTRIES = 25;
  // Un mismo mensaje no vuelve a mostrar aviso al aprendiz antes de este tiempo
  // (pero SIEMPRE se registra en el log, cada vez que ocurre).
  var DEDUPE_TOAST_MS = 10000;
  // Freno de emergencia: si se disparan demasiados errores en poco tiempo (un
  // bucle real de errores), se deja de mostrar avisos por un rato para no
  // saturar al aprendiz de toasts -- el registro tecnico sigue guardandose.
  var BURST_WINDOW_MS = 15000;
  var BURST_LIMIT = 8;

  var recentToastSignatures = {}; // signature -> timestamp del ultimo aviso mostrado
  var burstTimestamps = [];

  function safeReadLog() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function safeWriteLog(entries) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (_) {
      /* localStorage lleno o no disponible: seguimos sin log persistente,
         pero el error ya quedo en consola. No hay nada mas seguro que hacer. */
    }
  }

  function appendToLog(entry) {
    var entries = safeReadLog();
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(entries.length - MAX_ENTRIES);
    }
    safeWriteLog(entries);
  }

  function currentPageContext() {
    try {
      return String(window.location.pathname || "") + String(window.location.search || "");
    } catch (_) {
      return "";
    }
  }

  // Ruido conocido y NO accionable, no se registra ni se avisa:
  //   - "Script error." puro (sin linea/columna): viene de scripts de otro
  //     origen sin CORS (p. ej. extensiones del navegador o un bloqueador de
  //     anuncios instalado en el equipo del laboratorio), cero informacion util.
  //   - Errores originados en extensiones del navegador (chrome-extension://,
  //     moz-extension://): no son del portal, no se pueden corregir aqui.
  //   - Aviso de ResizeObserver: warning inofensivo y muy comun en Chrome/Safari
  //     que no indica ningun fallo real de la aplicacion.
  function isKnownNoise(message, source) {
    var msg = String(message || "");
    var src = String(source || "");
    if (/^chrome-extension:|^moz-extension:|^safari-extension:/i.test(src)) return true;
    if (msg === "Script error." && !src) return true;
    if (/ResizeObserver loop/i.test(msg)) return true;
    return false;
  }

  function shouldShowToast(signature) {
    var now = Date.now();

    // Freno de emergencia: contar errores recientes (de cualquier tipo).
    burstTimestamps.push(now);
    burstTimestamps = burstTimestamps.filter(function (t) { return now - t < BURST_WINDOW_MS; });
    if (burstTimestamps.length > BURST_LIMIT) return false;

    var last = recentToastSignatures[signature];
    if (last && now - last < DEDUPE_TOAST_MS) return false;
    recentToastSignatures[signature] = now;
    return true;
  }

  function notifyLearner() {
    if (!document.body || typeof window.portalAlert !== "function") return;
    window.portalAlert(
      "Ocurrio un problema tecnico inesperado. Tu informacion ya guardada sigue segura. " +
        "Si el problema continua, recarga la pagina o avisale a tu instructor.",
      { type: "error" }
    );
  }

  function recordError(kind, message, source, line, col, stack) {
    if (isKnownNoise(message, source)) return;

    var entry = {
      kind: kind, // "error" | "rejection"
      message: String(message || "").slice(0, 400),
      source: String(source || "").slice(0, 300),
      line: line || null,
      col: col || null,
      stack: String(stack || "").slice(0, 600),
      page: currentPageContext(),
      at: new Date().toISOString(),
    };

    // Consola: siempre, con un tag reconocible (mismo patron que guia_router.js).
    console.error("[global_error_handler]", entry);

    // Registro persistente: siempre, sin excepcion, aunque no se avise al aprendiz.
    appendToLog(entry);

    var signature = kind + "|" + entry.message + "|" + entry.source + "|" + entry.line;
    if (shouldShowToast(signature)) notifyLearner();
  }

  function describeRejectionReason(reason) {
    if (reason instanceof Error) {
      return { message: reason.message || String(reason), stack: reason.stack || "" };
    }
    try {
      return { message: typeof reason === "string" ? reason : JSON.stringify(reason), stack: "" };
    } catch (_) {
      return { message: String(reason), stack: "" };
    }
  }

  window.addEventListener("error", function (event) {
    try {
      if (!event) return;
      recordError(
        "error",
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error && event.error.stack
      );
    } catch (_) {
      /* el propio manejador nunca debe propagar una excepcion */
    }
  });

  window.addEventListener("unhandledrejection", function (event) {
    try {
      if (!event) return;
      var described = describeRejectionReason(event.reason);
      recordError("rejection", described.message, "", null, null, described.stack);
    } catch (_) {
      /* el propio manejador nunca debe propagar una excepcion */
    }
  });

  // API minima para diagnostico manual (consola del navegador, o una futura
  // vista de admin): revisar y limpiar el registro local de errores.
  window.senaErrorLog = {
    getAll: safeReadLog,
    clear: function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    },
  };
})();
