/**
 * firebase_auth_bridge.js — Bridge minimo a Firebase Authentication
 *
 * Disenado para mantener el proyecto en plan Spark (100% gratis):
 *   - Usa Firebase Auth con Email/Password (gratis, hasta 50K MAU).
 *   - NO usa Cloud Functions (que requieren plan Blaze).
 *   - NO usa Identity Platform.
 *
 * El cliente convierte el usernameKey local en un email sintetico
 *   {usernameKey}@sena-portal.local
 * Asi el aprendiz NUNCA escribe un email; sigue ingresando usuario + password
 * como antes. El email es solo un identificador interno para Firebase Auth.
 *
 * El bridge expone window.portalFirebaseAuth con:
 *   .ready(): Promise<boolean>             -> resuelve true si Auth esta listo
 *   .isEnabled(): boolean                  -> si PORTAL_FIREBASE_CONFIG esta activo
 *   .ensureSignedIn(usernameKey, password) -> {ok, uid, created, error}
 *   .signOut(): Promise<void>
 *   .getIdToken(forceRefresh): Promise<string|null>
 *   .currentUid(): string|null
 *   .getCurrentUserEmail(): Promise<string|null>
 *   .changePassword(usernameKey, oldPwd, newPwd) -> {ok, error}
 *   .buildEmail(usernameKey): string
 *
 * El SDK compat se carga desde https://www.gstatic.com/firebasejs/...
 * El HTML debe agregarlo ANTES de este script.
 */

(function () {
  "use strict";

  if (window.portalFirebaseAuth) return;

  var EMAIL_DOMAIN = "sena-portal.local";

  var sdkReadyPromise = null;
  var firebaseApp = null;
  var firebaseAuth = null;

  function getConfig() {
    return (window.PORTAL_FIREBASE_CONFIG && typeof window.PORTAL_FIREBASE_CONFIG === "object")
      ? window.PORTAL_FIREBASE_CONFIG
      : null;
  }

  function isEnabled() {
    var cfg = getConfig();
    return Boolean(cfg && cfg.enabled === true && cfg.projectId && cfg.apiKey);
  }

  function normalizeUsernameKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildEmail(usernameKey) {
    return normalizeUsernameKey(usernameKey) + "@" + EMAIL_DOMAIN;
  }

  function logWarn(message, error) {
    if (typeof console !== "undefined" && console.warn) {
      if (error !== undefined) {
        console.warn("[portalFirebaseAuth] " + message, error);
      } else {
        console.warn("[portalFirebaseAuth] " + message);
      }
    }
  }

  function waitForSDK() {
    return new Promise(function (resolve) {
      var attempts = 0;
      function check() {
        if (window.firebase && window.firebase.auth && typeof window.firebase.auth === "function") {
          resolve(true);
          return;
        }
        attempts += 1;
        if (attempts > 200) { // ~10 s
          resolve(false);
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  }

  function ensureSDK() {
    if (!isEnabled()) {
      return Promise.resolve(false);
    }
    if (sdkReadyPromise) return sdkReadyPromise;

    sdkReadyPromise = (async function () {
      var sdkAvailable = await waitForSDK();
      if (!sdkAvailable) {
        logWarn("Firebase SDK compat no esta cargado. ¿Falta el <script src=\"https://www.gstatic.com/firebasejs/.../firebase-auth-compat.js\">?");
        return false;
      }

      try {
        var cfg = getConfig();
        var appConfig = {
          apiKey: cfg.apiKey,
          authDomain: cfg.projectId + ".firebaseapp.com",
          projectId: cfg.projectId,
        };
        firebaseApp = (window.firebase.apps && window.firebase.apps.length)
          ? window.firebase.app()
          : window.firebase.initializeApp(appConfig);
        firebaseAuth = window.firebase.auth(firebaseApp);
        try {
          // Sesion persistente entre cierres del navegador. Default ya es LOCAL,
          // pero lo dejamos explicito para no depender del default.
          await firebaseAuth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        } catch (persistError) {
          logWarn("No se pudo fijar persistencia LOCAL:", persistError);
        }
        return true;
      } catch (error) {
        logWarn("Error inicializando Firebase Auth:", error);
        return false;
      }
    })();

    return sdkReadyPromise;
  }

  async function ensureSignedIn(usernameKey, password) {
    var ready = await ensureSDK();
    if (!ready) {
      return { ok: false, error: "auth/unavailable" };
    }

    var key = normalizeUsernameKey(usernameKey);
    if (!key) return { ok: false, error: "auth/invalid-usernameKey" };
    if (!password) return { ok: false, error: "auth/invalid-password" };

    var email = buildEmail(key);

    var currentUser = firebaseAuth.currentUser;
    if (currentUser && currentUser.email === email) {
      // Ya estamos logueados con la misma identidad
      return { ok: true, uid: currentUser.uid, alreadySignedIn: true };
    }
    if (currentUser && currentUser.email !== email) {
      try { await firebaseAuth.signOut(); } catch (_) {}
    }

    // Estrategia "create-first" para soportar email enumeration protection:
    // Firebase ya no devuelve user-not-found cuando el usuario no existe.
    // Intentamos crear primero; si la cuenta ya existe, caemos a signIn.
    try {
      var newCred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
      return { ok: true, uid: newCred.user.uid, created: true };
    } catch (createError) {
      var createCode = (createError && createError.code) || "auth/unknown";
      if (createCode === "auth/email-already-in-use") {
        try {
          var signInCred = await firebaseAuth.signInWithEmailAndPassword(email, password);
          return { ok: true, uid: signInCred.user.uid };
        } catch (signInError) {
          var signInCode = (signInError && signInError.code) || "auth/unknown";
          return { ok: false, error: signInCode, raw: signInError && signInError.message };
        }
      }
      // Password muy corta (<6) u otros errores reales de creacion
      return { ok: false, error: createCode, raw: createError && createError.message };
    }
  }

  async function signOut() {
    var ready = await ensureSDK();
    if (!ready || !firebaseAuth) return;
    try {
      await firebaseAuth.signOut();
    } catch (error) {
      logWarn("Error en signOut:", error);
    }
  }

  async function getIdToken(forceRefresh) {
    var ready = await ensureSDK();
    if (!ready || !firebaseAuth || !firebaseAuth.currentUser) return null;
    try {
      return await firebaseAuth.currentUser.getIdToken(forceRefresh === true);
    } catch (error) {
      logWarn("Error obteniendo idToken:", error);
      return null;
    }
  }

  function currentUid() {
    if (!firebaseAuth || !firebaseAuth.currentUser) return null;
    return firebaseAuth.currentUser.uid;
  }

  async function getCurrentUserEmail() {
    var ready = await ensureSDK();
    if (!ready || !firebaseAuth || !firebaseAuth.currentUser) return null;
    return firebaseAuth.currentUser.email || null;
  }

  // El aprendiz cambia su propia password tras autenticarse con la vieja.
  async function changePassword(usernameKey, oldPassword, newPassword) {
    var ready = await ensureSDK();
    if (!ready) return { ok: false, error: "auth/unavailable" };

    var key = normalizeUsernameKey(usernameKey);
    if (!key) return { ok: false, error: "auth/invalid-usernameKey" };
    if (!oldPassword || !newPassword) return { ok: false, error: "auth/invalid-password" };

    var email = buildEmail(key);
    try {
      var cred = await firebaseAuth.signInWithEmailAndPassword(email, oldPassword);
      if (!cred || !cred.user) return { ok: false, error: "auth/user-not-found" };
      await cred.user.updatePassword(newPassword);
      return { ok: true };
    } catch (error) {
      var code = (error && error.code) || "auth/unknown";
      return { ok: false, error: code, raw: error && error.message };
    }
  }

  // Espera N ms a que el SDK termine de hidratar la sesion previa.
  // Util al cargar paginas donde queremos chequear si el usuario ya estaba
  // logueado en Firebase Auth (la persistencia LOCAL se hidrata async).
  function waitForAuthHydration(timeoutMs) {
    return new Promise(async function (resolve) {
      var ready = await ensureSDK();
      if (!ready || !firebaseAuth) { resolve(false); return; }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(Boolean(firebaseAuth.currentUser));
      }, Math.max(500, Number(timeoutMs) || 2500));
      var unsub = firebaseAuth.onAuthStateChanged(function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { unsub(); } catch (_) {}
        resolve(Boolean(firebaseAuth.currentUser));
      });
    });
  }

  window.portalFirebaseAuth = {
    ready: ensureSDK,
    isEnabled: isEnabled,
    ensureSignedIn: ensureSignedIn,
    signOut: signOut,
    getIdToken: getIdToken,
    currentUid: currentUid,
    getCurrentUserEmail: getCurrentUserEmail,
    changePassword: changePassword,
    buildEmail: buildEmail,
    waitForAuthHydration: waitForAuthHydration,
    EMAIL_DOMAIN: EMAIL_DOMAIN,
  };
})();
