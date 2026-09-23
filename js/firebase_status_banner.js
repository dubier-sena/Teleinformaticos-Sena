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
 *   - "online"        -> Firestore acepta lecturas/escrituras (banner oculto)
 *   - "offline"       -> sin conexion al navegador (window.online === false)
 *   - "no-auth"       -> Firestore responde 401/403 sistematicamente
 *   - "rejected"      -> peticion explicitamente rechazada (timeout largo, etc.)
 *   - "drive-fallback"-> Firestore bloqueado pero Drive activo (sigue funcionando)
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

  // Los banners de diagnostico tecnico (offline, no-auth, drive-fallback,
  // etc.) usaban texto pensado para el admin. Los aprendices SI necesitan
  // saber cuando su sesion de Firebase dejo de sincronizar -- de lo contrario
  // pueden pasar sesiones enteras escribiendo respuestas que solo quedan en
  // este navegador, creyendo que todo esta guardado en la nube (auditoria
  // 2026-08-22, Fase 6: watchdog de Firebase para el aprendiz, espejo del que
  // ya existia solo para el admin). Por eso el banner ahora SI se muestra
  // para aprendices, pero con un mensaje mas simple y tranquilizador --
  // "tus respuestas siguen guardandose en este equipo" -- en vez de la jerga
  // tecnica ("Firestore", "token", etc.) que solo el admin necesita.
  function isAdmin() {
    try {
      var auth = window.portalAuth;
      if (auth && typeof auth.isAdminSession === "function") {
        return Boolean(auth.isAdminSession());
      }
    } catch (_) {}
    return false;
  }

  // Mensaje para aprendices: nunca bloquea, siempre deja claro que su trabajo
  // sigue a salvo localmente y que se sincronizara solo.
  function studentMessageFor(status) {
    switch (status) {
      case "offline":
        return "Sin conexion a Internet. Tus respuestas se siguen guardando en este equipo y se sincronizaran automaticamente cuando vuelvas a estar en linea.";
      case "no-auth":
        return "Tu sesion con la nube se desconecto. Tus respuestas se siguen guardando en este equipo; cierra sesion y vuelve a entrar cuando puedas para sincronizarlas.";
      case "rejected":
        return "No se pudo conectar con la nube en este momento. Tus respuestas se siguen guardando en este equipo y se sincronizaran automaticamente en cuanto se restablezca la conexion.";
      default:
        return "";
    }
  }

  function ensureBanner() {
    var existing = document.getElementById(BANNER_ID);
    if (existing) return existing;
    if (!document.body) return null;

    var el = document.createElement("div");
    el.id = BANNER_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    // z-index 490: por DEBAJO del navbar (500), sus desplegables y el menu
    // movil. Antes era top 0 con z-index 99999 y tapaba el navbar entero (en
    // movil, con 5 lineas, tambien la hamburguesa): ningun control recibia el
    // clic. `top` lo fija applyBannerLayout() bajo la barra real.
    el.style.cssText = [
      "position:fixed",
      "top:0", "left:0", "right:0",
      "z-index:490",
      "padding:8px 16px",
      "background:#f5b700",
      "color:#102117",
      "font:600 13px/1.4 'Inter','Segoe UI',sans-serif",
      "text-align:center",
      "box-shadow:0 2px 8px rgba(7,26,18,0.18)",
      // Aparece con un fundido en su sitio (bajo el navbar). Un deslizamiento
      // desde translateY(-100%) lo haria pasar por detras de la barra, que es
      // semitransparente.
      "opacity:0",
      "transition:opacity 220ms ease",
      "display:none",
    ].join(";");
    document.body.appendChild(el);
    return el;
  }

  // ── Presentacion: el aviso reserva su propio espacio bajo el navbar ────────
  // El layout del portal ya se desplaza con --navbar-height (padding del body,
  // barras laterales fijas/sticky, cabeceras, modales y menu movil). Mientras
  // el aviso esta visible, esa variable pasa a ser "barra + altura REAL del
  // aviso" (medida, nunca un valor fijo: el texto ocupa de 1 a 5+ lineas) y
  // todo baja exactamente una vez. El navbar usa --navbar-bar-height para su
  // propia altura, asi que medirlo no depende de --navbar-height (sin ciclos).
  // Se calcula siempre desde cero (barra + aviso), por lo que mostrar/ocultar
  // muchas veces no acumula desplazamiento. Sin navbar: top:0 y no se reserva
  // nada (no se inventa el hueco de una barra inexistente).
  var layoutObserver = null;

  function getRoot() {
    return document.documentElement || null;
  }

  function measureHeight(node) {
    if (!node || typeof node.getBoundingClientRect !== "function") return 0;
    var height = node.getBoundingClientRect().height;
    return height > 0 ? height : 0;
  }

  function isBannerShown(el) {
    return Boolean(el) && el.style.display !== "none" && el.style.display !== "";
  }

  function applyBannerLayout() {
    var el = document.getElementById(BANNER_ID);
    var root = getRoot();
    if (!el) return;
    var bar = measureHeight(document.getElementById("app-navbar"));
    el.style.top = bar + "px";
    if (!root || !root.style || typeof root.style.setProperty !== "function") return;
    if (isBannerShown(el) && bar > 0) {
      root.style.setProperty("--navbar-height", bar + measureHeight(el) + "px");
    } else {
      root.style.removeProperty("--navbar-height");
    }
  }

  function startBannerLayout() {
    applyBannerLayout();
    if (layoutObserver || typeof ResizeObserver !== "function") return;
    // Un solo observer mientras el aviso esta visible: detecta cambios de
    // mensaje (1 -> 5 lineas) y de ancho de pantalla sin recargar.
    layoutObserver = new ResizeObserver(applyBannerLayout);
    var el = document.getElementById(BANNER_ID);
    if (el) layoutObserver.observe(el);
    var navbar = document.getElementById("app-navbar");
    if (navbar) layoutObserver.observe(navbar);
    // Si el aviso aparece antes de que shared_shell.js inyecte el navbar
    // (p. ej. offline al cargar), se recoloca en cuanto la barra existe.
    if (!navbar && document.readyState !== "complete" && typeof window.addEventListener === "function") {
      window.addEventListener("load", function onLoad() {
        var nav = document.getElementById("app-navbar");
        if (layoutObserver && nav) layoutObserver.observe(nav);
        applyBannerLayout();
      }, { once: true });
    }
  }

  function stopBannerLayout() {
    if (layoutObserver) {
      layoutObserver.disconnect();
      layoutObserver = null;
    }
    applyBannerLayout();
  }

  // `studentMessage` es opcional: si se omite y quien mira la pagina NO es
  // admin, no se muestra nada (mismo comportamiento de antes para estados sin
  // texto pensado para aprendices, ej. estados internos futuros).
  function setBannerMessage(message, studentMessage) {
    var admin = isAdmin();
    if (!admin && !studentMessage) return;
    var el = ensureBanner();
    if (!el) return;
    el.textContent = admin ? message : studentMessage;
    // Visible, colocado bajo el navbar y con su espacio reservado ANTES del
    // fundido: el contenido nunca queda un instante debajo del aviso.
    el.style.display = "block";
    startBannerLayout();
    // Forzar reflow para que la animacion arranque
    void el.offsetHeight;
    el.style.opacity = "1";
  }

  function hideBanner() {
    var el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.style.opacity = "0";
    window.setTimeout(function () {
      if (el && el.parentNode) el.style.display = "none";
      // Ya oculto: se libera el espacio reservado y el observer.
      stopBannerLayout();
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
    setBannerMessage(message, studentMessageFor(status));
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
        } else if (res && (res.ok || res.status === 404)) {
          // 404 = "el doc aun no existe" — Firestore esta respondiendo bien.
          // Es normal cuando el aprendiz abre una guia que nunca ha guardado
          // (cloudGetGuideData, cloudGetGuideUiState, etc.). No es un fallo.
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

  // ── Hook a modo respaldo (fase 2) ──────────────────────────────────────────
  // Cuando firebase_db.js notifica que entro en modo fallback (Firestore caido
  // pero Drive disponible), reemplazamos el banner por un mensaje informativo
  // de color distinto. Al salir del modo, ocultamos.
  window.addEventListener("sena-portal:fallback-mode-change", function (e) {
    var active = e && e.detail && e.detail.active;
    // Estado se sigue emitiendo (otros scripts pueden consumirlo) pero el
    // banner visual solo aparece para admin.
    if (active) {
      emitStatus("drive-fallback", "Modo respaldo activo");
      if (!isAdmin()) return;
      var el = ensureBanner();
      if (el) {
        // Color azul/turquesa para distinguir de los amarillos de error.
        el.style.background = "#1f7a8c";
        el.style.color = "#ffffff";
      }
      setBannerMessage(
        "Modo respaldo activo: tus cambios se estan guardando en Drive. El sincronizado normal se restablecera automaticamente cuando la nube vuelva."
      );
    } else {
      var el2 = document.getElementById(BANNER_ID);
      if (el2) {
        el2.style.background = "#f5b700";
        el2.style.color = "#102117";
      }
      // Solo ocultar si estabamos en drive-fallback (evita borrar otro estado).
      if (lastStatus === "drive-fallback") {
        markOnline();
      }
    }
  });

  // ── API publica minima ──────────────────────────────────────────────────────
  // Permite a otros modulos mostrar el banner directamente cuando detectan un
  // estado que el hook de fetch no puede ver: el gate de pre-fetch de
  // firebase_db.js bloquea las peticiones cuando no hay sesion Firebase, asi
  // que sin token no hay fetch, no hay 401 y este banner nunca se enteraria
  // (causa del "admin sin sync en silencio" del 02-jun-2026).
  window.portalSyncBanner = {
    warn: function (message, status) {
      setBannerMessage(String(message || ""));
      emitStatus(status || "no-auth", String(message || ""));
    },
    hide: function () {
      hideBanner();
      emitStatus("online", "");
    },
  };

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
