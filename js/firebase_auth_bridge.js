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

  // Normaliza la version del email Auth. v1 (o ausente) usa el formato
  // historico "{key}@dominio". v2 y superiores usan "{key}.v{N}@dominio".
  // El versionado existe porque Firebase Auth en plan Spark no permite que
  // un admin cambie la password de otra cuenta — cuando el admin resetea
  // desde el panel, se incrementa la version y el aprendiz al loguear
  // crea una cuenta Auth fresca con el nuevo email. La cuenta vieja queda
  // huerfana pero no afecta cuotas relevantes (50K MAU en Spark).
  function normalizeAuthEmailVersion(value) {
    var n = Number(value);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  }

  function buildEmail(usernameKey, version) {
    var key = normalizeUsernameKey(usernameKey);
    var v = normalizeAuthEmailVersion(version);
    if (v <= 1) {
      return key + "@" + EMAIL_DOMAIN;
    }
    return key + ".v" + v + "@" + EMAIL_DOMAIN;
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

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, Math.floor(Number(ms) || 0)));
    });
  }

  // Estrategia de autenticacion del bridge (logica pura y testeable):
  //  - SIGN-IN primero: el caso comun en clase (aprendiz que YA tiene cuenta) se
  //    resuelve con UNA sola llamada a Auth, no dos. Reduce a la mitad la presion
  //    sobre Firebase Auth cuando una sala entera inicia sesion a la vez.
  //  - Fallback a CREAR si la cuenta no existe. Cubre tambien "email enumeration
  //    protection": con ella activa, signIn de un usuario inexistente devuelve
  //    invalid-credential; intentamos crear y, si la cuenta SI existia,
  //    createUser devuelve email-already-in-use -> era password incorrecta real.
  //  - BACKOFF + jitter ante "auth/too-many-requests" (o red caida): los inicios
  //    de sesion simultaneos desde la IP del colegio se reparten en segundos y
  //    todos entran, en vez de fallar en bloque (la causa del "falta token").
  // Recibe sus dependencias (signIn/create/sleep/rand) para poder probarse sin
  // tocar Firebase. Mantiene el mismo contrato de retorno {ok,uid,created,error}.
  async function resolveSignInOrCreate(deps, email, password) {
    var signIn = deps.signIn;
    var create = deps.create;
    var sleepFn = deps.sleep || function () { return Promise.resolve(); };
    var rand = deps.rand || Math.random;
    var maxAttempts = deps.maxAttempts || 5;
    var maxDelay = deps.maxDelayMs || 8000;
    var delay = deps.baseDelayMs || 800;

    function isTransient(code) {
      return code === "auth/too-many-requests" || code === "auth/network-request-failed";
    }
    function isMissingOrBadCredential(code) {
      return (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials" ||
        code === "auth/wrong-password"
      );
    }
    function backoff() {
      var wait = delay + Math.floor(rand() * delay);
      delay = Math.min(delay * 2, maxDelay);
      return sleepFn(wait);
    }

    var lastError = "auth/unknown";
    for (var attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        var cred = await signIn(email, password);
        return { ok: true, uid: cred && cred.user ? cred.user.uid : undefined };
      } catch (signInError) {
        var code = (signInError && signInError.code) || "auth/unknown";
        lastError = code;

        if (isTransient(code)) {
          if (attempt < maxAttempts - 1) { await backoff(); continue; }
          return { ok: false, error: code };
        }

        if (isMissingOrBadCredential(code)) {
          try {
            var newCred = await create(email, password);
            return {
              ok: true,
              uid: newCred && newCred.user ? newCred.user.uid : undefined,
              created: true,
            };
          } catch (createError) {
            var createCode = (createError && createError.code) || "auth/unknown";
            if (createCode === "auth/email-already-in-use") {
              // La cuenta SI existe -> el fallo de sign-in fue password incorrecta.
              return { ok: false, error: "auth/wrong-password", raw: signInError && signInError.message };
            }
            if (isTransient(createCode) && attempt < maxAttempts - 1) { await backoff(); continue; }
            return { ok: false, error: createCode, raw: createError && createError.message };
          }
        }

        // Error no recuperable (operation-not-allowed, config, etc.)
        return { ok: false, error: code, raw: signInError && signInError.message };
      }
    }
    return { ok: false, error: lastError };
  }

  async function ensureSignedIn(usernameKey, password, version) {
    var ready = await ensureSDK();
    if (!ready) {
      return { ok: false, error: "auth/unavailable" };
    }

    var key = normalizeUsernameKey(usernameKey);
    if (!key) return { ok: false, error: "auth/invalid-usernameKey" };
    if (!password) return { ok: false, error: "auth/invalid-password" };

    var email = buildEmail(key, version);

    var currentUser = firebaseAuth.currentUser;
    if (currentUser && currentUser.email === email) {
      // Ya estamos logueados con la misma identidad
      return { ok: true, uid: currentUser.uid, alreadySignedIn: true };
    }
    if (currentUser && currentUser.email !== email) {
      try { await firebaseAuth.signOut(); } catch (_) {}
    }

    // Sign-in primero (1 llamada en el caso comun) + fallback a crear + backoff
    // ante rate-limit. La logica vive en resolveSignInOrCreate (arriba).
    return await resolveSignInOrCreate(
      {
        signIn: function (e, p) { return firebaseAuth.signInWithEmailAndPassword(e, p); },
        create: function (e, p) { return firebaseAuth.createUserWithEmailAndPassword(e, p); },
        sleep: sleep,
      },
      email,
      password
    );
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
  // version: numero opcional con la version del email Auth (default 1).
  async function changePassword(usernameKey, oldPassword, newPassword, version) {
    var ready = await ensureSDK();
    if (!ready) return { ok: false, error: "auth/unavailable" };

    var key = normalizeUsernameKey(usernameKey);
    if (!key) return { ok: false, error: "auth/invalid-usernameKey" };
    if (!oldPassword || !newPassword) return { ok: false, error: "auth/invalid-password" };

    var email = buildEmail(key, version);
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
    // Expuesto solo para pruebas unitarias (logica pura, no toca Firebase).
    _resolveSignInOrCreate: resolveSignInOrCreate,
  };
})();
