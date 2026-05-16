/**
 * firebase_status_banner.js
 *
 * Banner discreto en la parte superior de la pagina que informa al aprendiz
 * cuando el portal NO esta sincronizando con la nube (Firebase Auth caido,
 * Firestore rechazando, sin conexion, etc.). El portal sigue funcionando
 * offline-first, pero el aprendiz debe saber que sus cambios viven solo en
 * este navegador hasta que se restaure la sync.
 *
 * Estados:
 *   - "online"    -> Firestore acepta lecturas/escrituras (banner oculto)
 *   - "offline"   -> sin conexion al navegador (window.online === false)
 *   - "no-auth"   -> Firestore responde 401/403 sistematicamente
 *   - "rejected"  -> peticion explicitamente rechazada (timeout largo, etc.)
 *
 * No bloquea ni interrumpe al aprendiz. Solo informa.
 */

(function () {
  "use strict";

  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.__senaPortalSyncBannerInstalled) return;
  window.__senaPortalSyncBannerInstalled = true;

  var BANNER_ID = "sena-portal-sync-banner";
  var STATE_KEY = "sena_portal_sync_banner_state_v1";
  // Cuantos fallos consecutivos antes de mostrar el banner. Reduce falsos
  // positivos por jitter de red.
  var FAILURE_THRESHOLD = 2;
  var failureStreak = 0;
  var lastStatus = null;

  function ensureBanner() {
    var existing = document.getElementById(BANNER_ID);
    if (existing) return existing;
    if (!document.body) return null;

    var el = document.createElement("div");
    el.id = BANNER_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "top:0", "left:0", "right:0",
      "z-index:99999",
      "padding:8px 16px",
      "background:#f5b700",
      "color:#102117",
      "font:600 13px/1.4 'Inter','Segoe UI',sans-serif",
      "text-align:center",
      "box-shadow:0 2px 8px rgba(7,26,18,0.18)",
      "transform:translateY(-100%)",
      "transition:transform 220ms ease",
      "display:none",
    ].join(";");
    document.body.appendChild(el);
    return el;
  }

  function setBannerMessage(message) {
    var el = ensureBanner();
    if (!el) return;
    el.textContent = message;
    // Forzar reflow para que la animacion arranque
    el.style.display = "block";
    void el.offsetHeight;
    el.style.transform = "translateY(0)";
  }

  function hideBanner() {
    var el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.style.transform = "translateY(-100%)";
    window.setTimeout(function () {
      if (el && el.parentNode) el.style.display = "none";
    }, 250);
  }

  function emitStatus(status, message) {
    if (lastStatus === status) return;
    lastStatus = status;
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify({ status: status, at: Date.now() }));
    } catch (_) {}
    var event = new CustomEvent("sena-portal:sync-status", { detail: { status: status, message: message } });
    window.dispatchEvent(event);
  }

  function markOnline() {
    failureStreak = 0;
    if (lastStatus !== "online") {
      hideBanner();
      emitStatus("online", "");
    }
  }

  function markFailure(reason) {
    failureStreak += 1;
    if (failureStreak < FAILURE_THRESHOLD) return;
    var status;
    var message;
    if (!navigator.onLine) {
      status = "offline";
      message = "Sin conexion a Internet. Tu trabajo se guarda localmente y se sincronizara cuando vuelvas en linea.";
    } else if (reason === "no-auth") {
      status = "no-auth";
      message = "Sesion sin sincronizacion. Vuelve a iniciar sesion para guardar cambios en la nube.";
    } else {
      status = "rejected";
      message = "No se pudo conectar con la nube. Tu trabajo se guarda localmente.";
    }
    setBannerMessage(message);
    emitStatus(status, message);
  }

  // ── Hook a fetch para detectar respuestas Firestore ─────────────────────────
  var FIRESTORE_HOST_RE = /firestore\.googleapis\.com/i;
  var originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function patchedFetch(input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var isFirestore = FIRESTORE_HOST_RE.test(url);
      var promise = originalFetch.call(this, input, init);
      if (!isFirestore) return promise;
      return promise.then(function (res) {
        // Solo consideramos auth issues como senal de "no-auth"
        if (res && (res.status === 401 || res.status === 403)) {
          markFailure("no-auth");
        } else if (res && res.ok) {
          markOnline();
        } else {
          markFailure("rejected");
        }
        return res;
      }).catch(function (err) {
        markFailure("rejected");
        throw err;
      });
    };
  }

  // ── Hooks a eventos de red del navegador ────────────────────────────────────
  window.addEventListener("online", function () {
    failureStreak = 0;
    // No marcamos "online" enseguida — esperamos a que un fetch real confirme.
  });
  window.addEventListener("offline", function () {
    failureStreak = FAILURE_THRESHOLD;
    markFailure("offline");
  });

  // Estado inicial: si el navegador esta offline al cargar, mostrar de inmediato.
  if (!navigator.onLine) {
    // Permitir que el body exista antes de inyectar el banner.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { markFailure("offline"); });
    } else {
      markFailure("offline");
    }
  }
})();
