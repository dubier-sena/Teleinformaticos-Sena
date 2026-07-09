/**
 * firebase_db.js — Persistencia en la nube para el Portal de Guias SENA
 *
 * Resuelve el problema de que los estudiantes pierdan su cuenta y avance
 * al cambiar de equipo o navegador. Usa Firebase Firestore como base de
 * datos gratuita en la nube, sin necesidad de servidor propio.
 *
 * CONFIGURACION SEGURA:
 *   1. Define window.PORTAL_FIREBASE_CONFIG antes de cargar este script
 *      o usa localStorage["sena_portal_firebase_runtime_v1"].
 *   2. No publiques projectId ni apiKey reales en GitHub.
 *
 * AVISO DE SEGURIDAD:
 *   Este modulo usa la API REST de Firestore solo con apiKey publica.
 *   No envia un token de Firebase Authentication ni usa el SDK oficial.
 *   Si despliegas reglas seguras de Firestore, esta sincronizacion dejara
 *   de funcionar hasta migrar el acceso a Firebase Auth + Firestore SDK
 *   o a un backend intermedio.
 */

(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════════════════════
  //  CONFIGURACION — Rellena con los datos de tu proyecto Firebase
  // ════════════════════════════════════════════════════════════════════════════
  var FIREBASE_RUNTIME_STORAGE_KEY = "sena_portal_firebase_runtime_v1";

  function normalizeRuntimeValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeRuntimeFirebaseConfig(rawConfig) {
    var source = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    return {
      enabled: source.enabled === true,
      projectId: normalizeRuntimeValue(source.projectId),
      apiKey: normalizeRuntimeValue(source.apiKey),
    };
  }

  function readStoredRuntimeFirebaseConfig() {
    try {
      var raw = window.localStorage.getItem(FIREBASE_RUNTIME_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getRuntimeFirebaseConfig() {
    if (window.PORTAL_FIREBASE_CONFIG && typeof window.PORTAL_FIREBASE_CONFIG === "object") {
      return normalizeRuntimeFirebaseConfig(window.PORTAL_FIREBASE_CONFIG);
    }
    return normalizeRuntimeFirebaseConfig(readStoredRuntimeFirebaseConfig());
  }

  var firebaseRuntime = getRuntimeFirebaseConfig();
  var FIREBASE_ENABLED = firebaseRuntime.enabled;
  var FIREBASE_PROJECT_ID = firebaseRuntime.projectId;
  var FIREBASE_API_KEY = firebaseRuntime.apiKey;
  // ════════════════════════════════════════════════════════════════════════════

  // Nombres de colecciones en Firestore
  var COL_USERS    = "sena_portal_users";
  var COL_USER_AUTH = "sena_portal_user_auth";
  var COL_USER_META = "sena_portal_user_meta";
  var COL_PROGRESS = "sena_portal_progress";
  var COL_CALENDAR = "sena_portal_calendar";
  var COL_GUIDE_STATE = "sena_portal_guide_state";
  var COL_TUTORING = "sena_portal_tutoring_bookings";
  var COL_GROUPS = "sena_portal_groups";
  var COL_USER_INDEX = "sena_portal_user_index";
  var COL_GRADES = "sena_portal_grades";
  var COL_GRADE_SOLUTIONS = "sena_portal_grade_solutions";
  var COL_IMPROVEMENT_PLANS = "sena_portal_improvement_plans";
  var COL_SIGNATURE_AUTH = "sena_portal_signature_auth";
  var CALENDAR_FALLBACK_PREFIX = "__calendar__:";
  var AVAILABILITY_DOC_ID = CALENDAR_FALLBACK_PREFIX + "calendario_2026_admin";
  var GUIDE_DATA_FALLBACK_PREFIX = "__guide_data__:";
  var GUIDE_UI_FALLBACK_PREFIX   = "__guide_ui__:";

  // Clave de localStorage donde portal_auth.js guarda los usuarios (debe coincidir)
  var LOCAL_USERS_KEY = "sena_portal_users_v1";

  // Prefijo de clave de progreso en localStorage (debe coincidir con portal_auth.js)
  // Formato completo: sena_portal:student:{usernameKey}:guide-meta:progress:{fileName}
  var LOCAL_PROGRESS_PREFIX = "sena_portal:student:";

  var SYNC_DELAY_MS    = 1200; // Espera antes de enviar progreso a Firebase (debounce)
  var API_TIMEOUT_MS   = 15000;
  var CHECK_TIMEOUT_MS = 10000;
  var FIRESTORE_BUDGET_STORAGE_KEY = "sena_portal_firestore_budget_v1";
  // Presupuesto diario calibrado al uso real del portal:
  //   - Capacidad maxima: 2 grupos x 30 aprendices = 60 aprendices/dia.
  //   - Lecturas esperadas en dia normal: ~8 K (intervalo 60 s + cargas + admin).
  //   - Escrituras esperadas en dia normal: ~300.
  // Los niveles `warn`/`restrict`/`block` dejan margen 1.5x/3x/5x sobre el uso
  // tipico, pero quedan por debajo del techo gratuito de Firebase (50K/20K).
  // Si se dispara `warn` en consola, hay tiempo de reaccionar antes del bloqueo.
  var FIRESTORE_DAILY_BUDGET_LIMITS = {
    read: { warn: 12000, restrict: 25000, block: 40000 },
    write: { warn: 1500, restrict: 5000, block: 12000 },
    delete: { warn: 50, restrict: 200, block: 450 },
  };

  // URL base de la API REST de Firestore
  var BASE_URL = "";

  // ── Estado interno ──────────────────────────────────────────────────────────
  var isConfigured = (
    FIREBASE_ENABLED === true &&
    FIREBASE_PROJECT_ID.length > 0 &&
    FIREBASE_API_KEY.length > 0
  );
  BASE_URL = isConfigured
    ? "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID + "/databases/(default)/documents"
    : "";
  var availabilityCache = null; // null = sin verificar | true | false
  var checkInProgress   = null;
  var progressTimers    = {};
  var firestoreBudgetCache = null;

  function getBudgetDateKey(date) {
    var value = date instanceof Date ? date : new Date();
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function normalizeBudgetCount(value) {
    return Math.max(0, Math.round(Number(value) || 0));
  }

  function createEmptyFirestoreBudgetState(dateKey) {
    return {
      dateKey: dateKey || getBudgetDateKey(new Date()),
      counts: {
        read: 0,
        write: 0,
        delete: 0,
      },
      notices: {},
      updatedAt: new Date().toISOString(),
    };
  }

  function normalizeFirestoreBudgetState(rawState, dateKey) {
    var currentDateKey = dateKey || getBudgetDateKey(new Date());
    var source = rawState && typeof rawState === "object" ? rawState : null;
    if (!source || source.dateKey !== currentDateKey) {
      return createEmptyFirestoreBudgetState(currentDateKey);
    }
    return {
      dateKey: currentDateKey,
      counts: {
        read: normalizeBudgetCount(source.counts && source.counts.read),
        write: normalizeBudgetCount(source.counts && source.counts.write),
        delete: normalizeBudgetCount(source.counts && source.counts.delete),
      },
      notices: source.notices && typeof source.notices === "object" ? source.notices : {},
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
    };
  }

  function readStoredFirestoreBudgetState() {
    try {
      var raw = window.localStorage.getItem(FIRESTORE_BUDGET_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function persistFirestoreBudgetState(state) {
    firestoreBudgetCache = state;
    try {
      window.localStorage.setItem(FIRESTORE_BUDGET_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
    }
  }

  function getFirestoreBudgetState() {
    var dateKey = getBudgetDateKey(new Date());
    var state = normalizeFirestoreBudgetState(readStoredFirestoreBudgetState(), dateKey);
    var shouldPersist =
      !firestoreBudgetCache ||
      firestoreBudgetCache.dateKey !== state.dateKey ||
      JSON.stringify(firestoreBudgetCache.counts || {}) !== JSON.stringify(state.counts || {});
    firestoreBudgetCache = state;
    if (shouldPersist) {
      persistFirestoreBudgetState(state);
    }
    return state;
  }

  function getFirestoreBudgetLevel(kind, count) {
    var limits = FIRESTORE_DAILY_BUDGET_LIMITS[kind] || FIRESTORE_DAILY_BUDGET_LIMITS.read;
    var value = normalizeBudgetCount(count);
    if (value >= limits.block) return "block";
    if (value >= limits.restrict) return "restrict";
    if (value >= limits.warn) return "warn";
    return "ok";
  }

  function budgetLevelRank(level) {
    if (level === "block") return 3;
    if (level === "restrict") return 2;
    if (level === "warn") return 1;
    return 0;
  }

  function maybeWarnBudgetLevel(kind, state) {
    var level = getFirestoreBudgetLevel(kind, state.counts[kind]);
    var previous = String((state.notices && state.notices[kind]) || "ok");
    if (budgetLevelRank(level) <= budgetLevelRank(previous) || level === "ok") {
      return;
    }
    state.notices[kind] = level;
    console.warn(
      "[firebase_db] Presupuesto diario en nivel " +
      level +
      " para " +
      kind +
      ": " +
      state.counts[kind] +
      "/" +
      FIRESTORE_DAILY_BUDGET_LIMITS[kind].block
    );
  }

  function buildFirestoreBudgetStatus(state) {
    var budgetState = state || getFirestoreBudgetState();
    var levels = {
      read: getFirestoreBudgetLevel("read", budgetState.counts.read),
      write: getFirestoreBudgetLevel("write", budgetState.counts.write),
      delete: getFirestoreBudgetLevel("delete", budgetState.counts.delete),
    };
    return {
      dateKey: budgetState.dateKey,
      updatedAt: budgetState.updatedAt,
      counts: {
        read: budgetState.counts.read,
        write: budgetState.counts.write,
        delete: budgetState.counts.delete,
      },
      levels: levels,
      limits: FIRESTORE_DAILY_BUDGET_LIMITS,
      shouldDeferCloudReads: levels.read === "restrict" || levels.read === "block",
      shouldSkipGuideUiCloudSave: levels.write === "restrict" || levels.write === "block",
      shouldBlockCloudWrites: levels.write === "block",
      shouldBlockCloudDeletes: levels.delete === "block",
    };
  }

  function getFirestoreBudgetStatus() {
    return buildFirestoreBudgetStatus(getFirestoreBudgetState());
  }

  function registerFirestoreOperation(kind, amount) {
    var normalizedKind = FIRESTORE_DAILY_BUDGET_LIMITS[kind] ? kind : "read";
    var increment = normalizeBudgetCount(amount);
    if (increment <= 0) {
      return getFirestoreBudgetStatus();
    }
    var state = getFirestoreBudgetState();
    state.counts[normalizedKind] = normalizeBudgetCount(state.counts[normalizedKind] + increment);
    state.updatedAt = new Date().toISOString();
    maybeWarnBudgetLevel(normalizedKind, state);
    persistFirestoreBudgetState(state);
    return buildFirestoreBudgetStatus(state);
  }

  function shouldDeferCloudReads() {
    var status = getFirestoreBudgetStatus();
    return status.levels.read === "restrict" || status.levels.read === "block";
  }

  function shouldSkipGuideUiCloudSave() {
    var status = getFirestoreBudgetStatus();
    return status.levels.write === "restrict" || status.levels.write === "block";
  }

  function shouldBlockCloudWrites() {
    return getFirestoreBudgetStatus().levels.write === "block";
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  SERIALIZACION FIRESTORE
  //  Firestore REST usa un formato propio; estas funciones convierten entre
  //  objetos JS simples y ese formato.
  // ════════════════════════════════════════════════════════════════════════════

  function toFsValue(val) {
    if (val === null || val === undefined)  return { nullValue: null };
    if (typeof val === "boolean")           return { booleanValue: val };
    if (typeof val === "number") {
      return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    }
    if (typeof val === "string")            return { stringValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(toFsValue) } };
    }
    if (typeof val === "object") {
      var fields = {};
      Object.keys(val).forEach(function (k) { fields[k] = toFsValue(val[k]); });
      return { mapValue: { fields: fields } };
    }
    return { stringValue: String(val) };
  }

  function fromFsValue(v) {
    if (!v || typeof v !== "object")  return null;
    if ("nullValue"    in v)          return null;
    if ("booleanValue" in v)          return Boolean(v.booleanValue);
    if ("integerValue" in v)          return Number(v.integerValue);
    if ("doubleValue"  in v)          return Number(v.doubleValue);
    if ("stringValue"  in v)          return String(v.stringValue);
    if ("arrayValue"   in v) {
      return ((v.arrayValue && v.arrayValue.values) || []).map(fromFsValue);
    }
    if ("mapValue" in v) {
      var fields = (v.mapValue && v.mapValue.fields) || {};
      var result = {};
      Object.keys(fields).forEach(function (k) { result[k] = fromFsValue(fields[k]); });
      return result;
    }
    return null;
  }

  function toFsDoc(obj) {
    var fields = {};
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach(function (k) { fields[k] = toFsValue(obj[k]); });
    }
    return { fields: fields };
  }

  function fromFsDoc(doc) {
    if (!doc || !doc.fields) return null;
    var result = {
      _docId: String(doc.name || "").split("/").pop(),
      _docName: doc.name || "",
    };
    Object.keys(doc.fields).forEach(function (k) {
      result[k] = fromFsValue(doc.fields[k]);
    });
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  HTTP / FIRESTORE REST
  // ════════════════════════════════════════════════════════════════════════════

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortController === "undefined") return fetch(url, options);
    var ctrl  = new AbortController();
    var timer = window.setTimeout(function () { ctrl.abort(); }, timeoutMs);
    var opts  = Object.assign({}, options, { signal: ctrl.signal });
    return fetch(url, opts).finally(function () { window.clearTimeout(timer); });
  }

  // Espera a que una promesa de sincronizacion a la nube termine, pero nunca mas
  // de timeoutMs. RESUELVE (no rechaza) al vencer el limite: el llamador ya hizo
  // el guardado local (fuente de verdad) y solo esta esperando el respaldo nube.
  // Sin esto, una parte de nube colgada (sin sesion Firebase, offline, cooldown,
  // driveDb sin timeout) dejaria el toast del panel girando para siempre.
  var CLOUD_SYNC_UI_TIMEOUT_MS = 8000;
  function boundCloudSync(promise, timeoutMs) {
    var limit = timeoutMs || CLOUD_SYNC_UI_TIMEOUT_MS;
    var safe = Promise.resolve(promise).catch(function () { return undefined; });
    return Promise.race([
      safe,
      new Promise(function (resolve) { window.setTimeout(resolve, limit); }),
    ]);
  }

  function docUrl(collection, docId, extraParams) {
    var url = BASE_URL + "/" + collection;
    if (docId) url += "/" + encodeURIComponent(docId);
    url += "?key=" + FIREBASE_API_KEY;
    if (extraParams) url += "&" + extraParams;
    return url;
  }

  function safeCloudKey(value) {
    return String(value || "").replace(/[^a-z0-9:_-]/gi, "_");
  }

  // Espera UNA VEZ a que Firebase Auth termine de hidratar la sesion desde
  // IndexedDB. Sin esta espera, las primeras lecturas tras un reload salen
  // sin Authorization, Firestore responde 403 y el banner amarillo de
  // "Sesion sin sincronizacion" parpadea durante la hidratacion (~1-2 s).
  var _authHydrationPromise = null;
  function ensureAuthHydrated() {
    if (_authHydrationPromise) return _authHydrationPromise;
    var bridge = window.portalFirebaseAuth;
    if (!bridge || typeof bridge.waitForAuthHydration !== "function") {
      _authHydrationPromise = Promise.resolve(false);
      return _authHydrationPromise;
    }
    _authHydrationPromise = Promise.resolve(bridge.waitForAuthHydration(2500))
      .catch(function () { return false; });
    return _authHydrationPromise;
  }

  // Obtiene los headers con Authorization: Bearer <idToken> si Firebase Auth
  // tiene una sesion activa. Sin sesion, se devuelven los headers base sin
  // Authorization — las Firestore Rules rechazaran la peticion (403) y el
  // codigo cae al modo localStorage.
  async function authHeaders(extra) {
    var headers = Object.assign({}, extra || {});
    var bridge = window.portalFirebaseAuth;
    if (bridge && typeof bridge.getIdToken === "function") {
      try {
        await ensureAuthHydrated();
        var token = await bridge.getIdToken();
        if (token) headers["Authorization"] = "Bearer " + token;
      } catch (_) { /* sin token, se hara la peticion sin auth */ }
    }
    return headers;
  }

  // ── Gate de pre-fetch ───────────────────────────────────────────────────────
  // Evita disparar peticiones a Firestore cuando se sabe que van a ser
  // rechazadas. Las reglas se evaluan en cada peticion (incluso rechazadas) y
  // consumen cuota de la API. Reduciendo rechazos protegemos el bloqueo diario
  // de la consola.
  //
  // Bloquea cuando:
  //   - Firebase Auth no esta hidratado o no hay currentUid (no podriamos
  //     mandar Authorization → 403 garantizado).
  //   - Hubo un 401/403 en los ultimos 60 s con el mismo uid (cooldown).
  //     Si el uid cambia (login real), se sale del cooldown.
  var FIRESTORE_COOLDOWN_AFTER_REJECTION_MS = 60000;
  var _firestoreCooldownUntil = 0;
  var _firestoreCooldownUid = null;

  function getBridgeCurrentUid() {
    var bridge = window.portalFirebaseAuth;
    if (!bridge || typeof bridge.currentUid !== "function") return null;
    try { return bridge.currentUid(); } catch (_) { return null; }
  }

  function markFirestoreRejection() {
    _firestoreCooldownUntil = Date.now() + FIRESTORE_COOLDOWN_AFTER_REJECTION_MS;
    _firestoreCooldownUid = getBridgeCurrentUid();
    notifyFallbackModeIfChanged();
  }

  function markFirestoreSuccess() {
    _firestoreCooldownUntil = 0;
    _firestoreCooldownUid = null;
    // Si hay escrituras pendientes de Drive→Firestore, programar flush.
    try { scheduleFlushPromotions(); } catch (_) {}
    notifyFallbackModeIfChanged();
  }

  function isFirestoreInCooldown() {
    if (Date.now() >= _firestoreCooldownUntil) return false;
    // Si el uid cambio (nuevo login), invalidamos el cooldown — el token es otro.
    if (getBridgeCurrentUid() !== _firestoreCooldownUid) return false;
    return true;
  }

  // Modo "fallback activo": gate bloquea Firestore Y Drive esta disponible.
  // Notifica a otros scripts (banner, UI) cuando cambia el estado.
  // Tambien se considera "fallback" si el modo Drive primario esta forzado.
  var _lastFallbackActive = false;
  function isInDriveFallbackMode() {
    if (!isDriveFallbackEnabled()) return false;
    if (isForceDriveEnabled()) return true;
    return isFirestoreInCooldown() || shouldBlockCloudWrites();
  }

  function notifyFallbackModeIfChanged() {
    var active = false;
    try { active = isInDriveFallbackMode(); } catch (_) { active = false; }
    if (active === _lastFallbackActive) return;
    _lastFallbackActive = active;
    try {
      window.dispatchEvent(new CustomEvent("sena-portal:fallback-mode-change", {
        detail: { active: active },
      }));
    } catch (_) {}
  }

  // Si `useDriveAsPrimary` esta encendido en PORTAL_FIREBASE_CONFIG, las ops de
  // DATOS de los APRENDICES se enrutan a Apps Script/Drive sin tocar Firestore.
  // Firebase Auth (login/signup/changePassword) NO se ve afectado.
  //
  // EXCEPCION ADMIN: el admin SIEMPRE usa Firestore. Razon: el panel lee el
  // progreso/estado de TODOS los aprendices, lo cual en Firestore es una sola
  // peticion batch (rapida y completa), pero en Drive serian lecturas
  // secuenciales una por una (~1-2s c/u = minutos para 45 aprendices). Como el
  // admin lee a todos pocas veces al dia, es volumen minimo en Firestore y no
  // lo bloquea. El alto volumen que satura la cuota es el de los aprendices.
  //
  // Kill switch por dispositivo: localStorage["sena_portal_force_drive"]="1".
  function isCurrentUserAdmin() {
    try {
      var a = window.portalAuth;
      return Boolean(a && typeof a.isAdminSession === "function" && a.isAdminSession());
    } catch (_) { return false; }
  }

  function isForceDriveEnabled() {
    if (isCurrentUserAdmin()) return false; // el admin siempre usa Firestore
    var cfg = window.PORTAL_FIREBASE_CONFIG;
    if (cfg && cfg.useDriveAsPrimary === true) return true;
    try {
      return window.localStorage.getItem("sena_portal_force_drive") === "1";
    } catch (_) { return false; }
  }

  // Colecciones de DATOS (alto volumen). En modo Drive primario, SOLO estas se
  // enrutan a Drive. Las colecciones de cuenta/auth (users, user_auth,
  // user_meta, roles) siguen SIEMPRE en Firestore porque son de bajo volumen
  // (~400 lecturas/dia) y no saturan la cuota, ademas de mantener la seguridad
  // de los hashes de password lejos de Drive.
  var DRIVE_PRIMARY_COLLECTIONS = {};
  DRIVE_PRIMARY_COLLECTIONS[COL_PROGRESS] = true;
  DRIVE_PRIMARY_COLLECTIONS[COL_GUIDE_STATE] = true;
  DRIVE_PRIMARY_COLLECTIONS[COL_CALENDAR] = true;
  // sena_portal_groups NO va a Drive a proposito: sus docId son hashes
  // deterministas (g2act10_/g6_/g7_<ficha>_<hash>) que NO contienen la
  // usernameKey del miembro. La autorizacion del Apps Script
  // (authorizeRequest/docIdHasKeySegment en respaldo_firestore.gs) decide la
  // propiedad por SEGMENTO del docId, asi que para un hash daria falso y
  // denegaria al propio integrante en cuanto se despliegue el fix C1. Los
  // equipos son de bajo volumen (pocos por ficha), por lo que se quedan en
  // Firestore, donde las reglas SI autorizan por memberEmails
  // (isGroupMemberOfResource). Ver tests/firebase_groups_routing.test.cjs.
  DRIVE_PRIMARY_COLLECTIONS[COL_TUTORING] = true;

  function isDriveDataCollection(collection) {
    return Boolean(collection && DRIVE_PRIMARY_COLLECTIONS[collection]);
  }

  // Patron REPLICA DE LECTURA:
  //   - ESCRITURAS (isWrite=true) siempre van a Firestore (bajo volumen,
  //     ~150/dia) + respaldo a Drive. Asi Firestore es la fuente de verdad y el
  //     admin ve datos actuales.
  //   - LECTURAS de DATOS de aprendices van a Drive (alto volumen que saturaba
  //     la cuota). El admin lee de Firestore (excepcion admin, batched/completo).
  //   - Cuenta/auth siempre en Firestore (bajo volumen).
  //   - Cooldown (bloqueo real) manda TODO a Drive (failover de emergencia).
  async function canCallFirestore(collection, isWrite) {
    if (!isConfigured) return false;
    if (!isWrite && isForceDriveEnabled() && isDriveDataCollection(collection)) return false;
    // Cooldown (bloqueo real de Firestore): aplica a TODO —
    // si Firestore esta caido de verdad, hasta las cuentas caen a Drive.
    if (isFirestoreInCooldown()) return false;
    var bridge = window.portalFirebaseAuth;
    if (!bridge) return false;
    await ensureAuthHydrated();
    if (!getBridgeCurrentUid()) return false;
    return true;
  }

  function isAuthRejection(status) {
    return status === 401 || status === 403;
  }

  // ── Respaldo pasivo a Drive via Apps Script ─────────────────────────────────
  // Tras cada fsPatch exitoso, mandamos una copia del documento al Web App
  // de respaldo (apps-script/respaldo_firestore.gs). Es fire-and-forget: el
  // aprendiz no espera, no se reintenta, los errores se silencian. El respaldo
  // queda como JSON en Drive y sirve como red de seguridad por si Firebase
  // vuelve a bloquearse.
  function getBackupUrl() {
    var pi = window.PROJECT_INTEGRATIONS;
    var url = pi && typeof pi.respaldoFirestoreUrl === "string" ? pi.respaldoFirestoreUrl : "";
    return url.trim();
  }

  function backupWriteToDrive(collection, docId, data) {
    try {
      var url = getBackupUrl();
      if (!url) return; // respaldo deshabilitado
      var bridge = window.portalFirebaseAuth;
      if (!bridge || typeof bridge.getIdToken !== "function") return;
      bridge.getIdToken().then(function (idToken) {
        if (!idToken) return;
        // Content-Type text/plain evita preflight CORS contra Apps Script.
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({
            action: "set",
            idToken: idToken,
            collection: collection,
            docId: docId,
            data: data,
          }),
          keepalive: true,
        }).catch(function () { /* silencioso: es solo respaldo */ });
      }).catch(function () { /* silencioso */ });
    } catch (_) { /* silencioso */ }
  }

  // Respaldo fire-and-forget de un updateField a Drive (mantiene la replica al
  // dia para que las lecturas de aprendices desde Drive vean el ultimo valor).
  function backupUpdateFieldToDrive(collection, docId, fieldName, fieldValue) {
    try {
      if (!window.driveDb || typeof window.driveDb.updateField !== "function") return;
      if (!window.driveDb.isEnabled || !window.driveDb.isEnabled()) return;
      window.driveDb.updateField(collection, docId, fieldName, fieldValue).catch(function () {});
    } catch (_) {}
  }

  // Respaldo fire-and-forget de un delete a Drive.
  function backupDeleteToDrive(collection, docId) {
    try {
      if (!window.driveDb || typeof window.driveDb.deleteDoc !== "function") return;
      if (!window.driveDb.isEnabled || !window.driveDb.isEnabled()) return;
      window.driveDb.deleteDoc(collection, docId).catch(function () {});
    } catch (_) {}
  }

  // ── Router de fallback a Drive (fase 2) ─────────────────────────────────────
  // Cuando el gate bloquea Firestore (sin sesion, en cooldown, budget en block)
  // o cuando Firestore responde 401/403 explicitamente, el portal enruta la
  // operacion al Web App de respaldo (apps-script/respaldo_firestore.gs) via
  // window.driveDb. El portal sigue funcionando sin interrupcion, solo mas
  // lento (~1-2s extra por la verificacion de idToken en el servidor).
  function isDriveFallbackEnabled() {
    return Boolean(window.driveDb && window.driveDb.isEnabled && window.driveDb.isEnabled());
  }

  // ── Promocion Drive → Firestore en recuperacion (fase 3) ────────────────────
  // Cada escritura que cae a Drive se registra en localStorage. Cuando una
  // operacion Firestore vuelve a tener exito, lanzamos un flush debounced que
  // intenta promover las escrituras pendientes. Se persiste en localStorage
  // para sobrevivir recargas del navegador durante un bloqueo prolongado.
  var FIRESTORE_PROMOTE_KEY = "sena_portal_pending_firestore_promote_v1";
  var FIRESTORE_PROMOTE_FLUSH_DEBOUNCE_MS = 5000;
  var _firestoreFlushTimer = null;

  function readPendingPromotions() {
    try {
      var raw = window.localStorage.getItem(FIRESTORE_PROMOTE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }

  function writePendingPromotions(list) {
    try {
      if (!list || list.length === 0) {
        window.localStorage.removeItem(FIRESTORE_PROMOTE_KEY);
      } else {
        window.localStorage.setItem(FIRESTORE_PROMOTE_KEY, JSON.stringify(list));
      }
    } catch (_) {}
  }

  function pendingPromotionKey(op) {
    return op.collection + ":" + op.docId + ":" + (op.fieldName || "");
  }

  function recordPendingPromotion(op) {
    var list = readPendingPromotions();
    var key = pendingPromotionKey(op);
    // Dedupe: una sola operacion por (collection, docId, fieldName).
    // Si llega un nuevo set despues de un updateField sobre el mismo doc,
    // el set lo reemplaza porque pisaria el campo de todas formas.
    list = list.filter(function (other) {
      if (op.type === "set" && other.collection === op.collection && other.docId === op.docId) {
        return false;
      }
      return pendingPromotionKey(other) !== key;
    });
    list.push(Object.assign({ at: Date.now() }, op));
    writePendingPromotions(list);
  }

  // Intenta promover una operacion a Firestore SIN fallback (para evitar bucles).
  async function tryFirestorePromote(op) {
    if (!isConfigured) return false;
    try {
      if (op.type === "set") {
        var res = await fetchWithTimeout(
          docUrl(op.collection, op.docId),
          {
            method: "PATCH",
            headers: await authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(toFsDoc(op.data)),
          },
          API_TIMEOUT_MS
        );
        if (res.ok) {
          registerFirestoreOperation("write", 1);
          return true;
        }
        return false;
      }
      if (op.type === "updateField") {
        var body = { fields: {} };
        body.fields[op.fieldName] = toFsValue(op.fieldValue);
        var res = await fetchWithTimeout(
          docUrl(op.collection, op.docId, "updateMask.fieldPaths=" + encodeURIComponent(escapeFirestoreFieldPath(op.fieldName))),
          {
            method: "PATCH",
            headers: await authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(body),
          },
          API_TIMEOUT_MS
        );
        if (res.ok) {
          registerFirestoreOperation("write", 1);
          return true;
        }
        return false;
      }
      if (op.type === "delete") {
        var res = await fetchWithTimeout(
          docUrl(op.collection, op.docId),
          { method: "DELETE", headers: await authHeaders() },
          API_TIMEOUT_MS
        );
        if (res.ok || res.status === 404) {
          registerFirestoreOperation("delete", 1);
          return true;
        }
        return false;
      }
    } catch (_) {}
    return false;
  }

  async function flushPendingPromotions() {
    var list = readPendingPromotions();
    if (list.length === 0) return;
    if (!(await canCallFirestore())) return;
    var remaining = [];
    for (var i = 0; i < list.length; i++) {
      var op = list[i];
      var ok = await tryFirestorePromote(op);
      if (!ok) remaining.push(op);
    }
    writePendingPromotions(remaining);
  }

  function scheduleFlushPromotions() {
    if (_firestoreFlushTimer) return;
    if (readPendingPromotions().length === 0) return; // no hay nada que promover
    _firestoreFlushTimer = setTimeout(function () {
      _firestoreFlushTimer = null;
      flushPendingPromotions().catch(function () {});
    }, FIRESTORE_PROMOTE_FLUSH_DEBOUNCE_MS);
  }

  // Solo promover Drive→Firestore si NO estamos en modo Drive permanente para
  // esta coleccion. En force-drive, Drive es el destino final (no un fallback
  // temporal), asi que no tiene sentido devolver esos datos a Firestore.
  function shouldRecordPromotion(collection) {
    return !(isForceDriveEnabled() && isDriveDataCollection(collection));
  }

  async function driveFallbackGet(collection, docId) {
    if (!isDriveFallbackEnabled()) return null;
    try { return await window.driveDb.get(collection, docId); } catch (_) { return null; }
  }

  async function driveFallbackSet(collection, docId, data) {
    if (!isDriveFallbackEnabled()) return false;
    try {
      var ok = await window.driveDb.set(collection, docId, data);
      if (ok && shouldRecordPromotion(collection)) {
        recordPendingPromotion({ type: "set", collection: collection, docId: docId, data: data });
      }
      return ok;
    } catch (_) { return false; }
  }

  async function driveFallbackUpdateField(collection, docId, fieldName, fieldValue) {
    if (!isDriveFallbackEnabled()) return false;
    try {
      var ok = await window.driveDb.updateField(collection, docId, fieldName, fieldValue);
      if (ok && shouldRecordPromotion(collection)) {
        recordPendingPromotion({
          type: "updateField",
          collection: collection,
          docId: docId,
          fieldName: fieldName,
          fieldValue: fieldValue,
        });
      }
      return ok;
    } catch (_) { return false; }
  }

  async function driveFallbackDelete(collection, docId) {
    if (!isDriveFallbackEnabled()) return false;
    try {
      var ok = await window.driveDb.deleteDoc(collection, docId);
      if (ok && shouldRecordPromotion(collection)) {
        recordPendingPromotion({ type: "delete", collection: collection, docId: docId });
      }
      return ok;
    } catch (_) { return false; }
  }

  async function driveFallbackList(collection) {
    if (!isDriveFallbackEnabled()) return [];
    try { return await window.driveDb.list(collection); } catch (_) { return []; }
  }

  async function driveFallbackBatchGet(collection, docIds) {
    if (!isDriveFallbackEnabled()) return [];
    try {
      var results = [];
      for (var i = 0; i < docIds.length; i++) {
        var data = await window.driveDb.get(collection, docIds[i]);
        if (data) results.push(data);
      }
      return results;
    } catch (_) { return []; }
  }

  // GET un documento. Retorna objeto JS o null.
  // Si Firestore no esta disponible (sin sesion, cooldown, budget), enruta a Drive.
  // opts.skipDriveOn404: un 404 de Firestore significa simplemente "este doc no
  // existe" (aprendiz que aun no guardo esta guia) -- NO que Firestore este caido.
  // Probar Drive en ese caso es Apps Script (10-25s bajo carga); en un barrido
  // masivo (ensureGuideStatesHydrated sobre cientos de combinaciones aprendiz x
  // guia) eso multiplica minutos de espera para informacion que casi siempre es
  // un miss real. Solo se salta el 404; los fallos de red/auth SI siguen
  // intentando Drive (Firestore realmente inalcanzable).
  async function fsGet(collection, docId, opts) {
    var skipDriveOn404 = Boolean(opts && opts.skipDriveOn404);
    if (!(await canCallFirestore(collection))) {
      return await driveFallbackGet(collection, docId);
    }
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        { method: "GET", cache: "no-store", headers: await authHeaders() },
        API_TIMEOUT_MS
      );
      if (res.status === 404) {
        registerFirestoreOperation("read", 1);
        markFirestoreSuccess();
        if (skipDriveOn404) return null;
        // Doc no existe en Firestore: probamos Drive por si lo tiene.
        var driveResult = await driveFallbackGet(collection, docId);
        return driveResult;
      }
      if (!res.ok) {
        if (isAuthRejection(res.status)) {
          markFirestoreRejection();
          return await driveFallbackGet(collection, docId);
        }
        return null;
      }
      var payload = await res.json();
      registerFirestoreOperation("read", 1);
      markFirestoreSuccess();
      return fromFsDoc(payload);
    } catch (e) {
      return await driveFallbackGet(collection, docId);
    }
  }

  // PATCH (upsert completo) de un documento.
  async function fsPatch(collection, docId, data) {
    if (shouldBlockCloudWrites()) {
      return await driveFallbackSet(collection, docId, data);
    }
    if (!(await canCallFirestore(collection, true))) {
      return await driveFallbackSet(collection, docId, data);
    }
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        {
          method:  "PATCH",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body:    JSON.stringify(toFsDoc(data)),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) {
        registerFirestoreOperation("write", 1);
        markFirestoreSuccess();
        backupWriteToDrive(collection, docId, data);
        return true;
      }
      if (isAuthRejection(res.status)) {
        markFirestoreRejection();
        return await driveFallbackSet(collection, docId, data);
      }
      return false;
    } catch (e) {
      return await driveFallbackSet(collection, docId, data);
    }
  }

  async function fsDelete(collection, docId) {
    if (shouldBlockCloudDeletes()) {
      return await driveFallbackDelete(collection, docId);
    }
    if (!(await canCallFirestore(collection, true))) {
      return await driveFallbackDelete(collection, docId);
    }
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        { method: "DELETE", headers: await authHeaders() },
        API_TIMEOUT_MS
      );
      if (res.ok || res.status === 404) {
        registerFirestoreOperation("delete", 1);
        markFirestoreSuccess();
        backupDeleteToDrive(collection, docId);
        return true;
      }
      if (isAuthRejection(res.status)) {
        markFirestoreRejection();
        return await driveFallbackDelete(collection, docId);
      }
      return false;
    } catch (e) {
      return await driveFallbackDelete(collection, docId);
    }
  }

  // PATCH con updateMask: actualiza solo el campo indicado sin borrar los demas.
  async function fsUpdateField(collection, docId, fieldName, fieldValue) {
    if (shouldBlockCloudWrites()) {
      return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
    }
    if (!(await canCallFirestore(collection, true))) {
      return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
    }
    try {
      var body = { fields: {} };
      body.fields[fieldName] = toFsValue(fieldValue);
      var res = await fetchWithTimeout(
        docUrl(collection, docId, "updateMask.fieldPaths=" + encodeURIComponent(escapeFirestoreFieldPath(fieldName))),
        {
          method:  "PATCH",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body:    JSON.stringify(body),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) {
        registerFirestoreOperation("write", 1);
        markFirestoreSuccess();
        backupUpdateFieldToDrive(collection, docId, fieldName, fieldValue);
        return true;
      }
      if (isAuthRejection(res.status)) {
        markFirestoreRejection();
        return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
      }
      return false;
    } catch (e) {
      return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
    }
  }

  // Lista todos los documentos de una coleccion (hasta 300).
  async function fsList(collection) {
    if (!(await canCallFirestore(collection))) {
      return await driveFallbackList(collection);
    }
    try {
      var url = BASE_URL + "/" + collection + "?key=" + FIREBASE_API_KEY + "&pageSize=300";
      var res = await fetchWithTimeout(
        url,
        { method: "GET", cache: "no-store", headers: await authHeaders() },
        API_TIMEOUT_MS
      );
      if (!res.ok) {
        if (isAuthRejection(res.status)) {
          markFirestoreRejection();
          return await driveFallbackList(collection);
        }
        return [];
      }
      var payload = await res.json();
      var docs = (payload.documents || []).map(fromFsDoc).filter(Boolean);
      registerFirestoreOperation("read", Math.max(1, docs.length));
      markFirestoreSuccess();
      return docs;
    } catch (e) {
      return await driveFallbackList(collection);
    }
  }

  // BatchGet: obtiene multiples documentos en una sola solicitud.
  async function fsBatchGet(collection, docIds) {
    if (!docIds || docIds.length === 0) return [];
    if (!(await canCallFirestore(collection))) {
      return await driveFallbackBatchGet(collection, docIds);
    }
    var batchUrl = "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID + "/databases/(default)/documents:batchGet?key=" + FIREBASE_API_KEY;
    var docPaths = docIds.map(function (id) {
      return "projects/" + FIREBASE_PROJECT_ID +
        "/databases/(default)/documents/" + collection + "/" + encodeURIComponent(id);
    });
    try {
      var res = await fetchWithTimeout(
        batchUrl,
        {
          method:  "POST",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body:    JSON.stringify({ documents: docPaths }),
        },
        API_TIMEOUT_MS
      );
      if (!res.ok) {
        if (isAuthRejection(res.status)) {
          markFirestoreRejection();
          return await driveFallbackBatchGet(collection, docIds);
        }
        return [];
      }
      var results = await res.json();
      if (!Array.isArray(results)) return [];
      registerFirestoreOperation("read", Math.max(1, docIds.length));
      markFirestoreSuccess();
      return results.map(function (r) { return r.found ? fromFsDoc(r.found) : null; }).filter(Boolean);
    } catch (e) {
      return await driveFallbackBatchGet(collection, docIds);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  VERIFICACION DE DISPONIBILIDAD
  // ════════════════════════════════════════════════════════════════════════════

  async function checkAvailability() {
    if (!isConfigured) return false;
    // Solo cachear exitos (true). Los fallos se reintentan para manejar
    // el caso donde Firestore aun se estaba creando al cargar la pagina.
    if (availabilityCache === true) return true;
    if (checkInProgress)            return checkInProgress;

    checkInProgress = (async function () {
      try {
        var url = docUrl(COL_PROGRESS, AVAILABILITY_DOC_ID);
        var res = await fetchWithTimeout(
          url,
          { method: "GET", cache: "no-store", headers: await authHeaders() },
          CHECK_TIMEOUT_MS
        );
        // 200 = OK, 404 = doc no existe (Firestore vivo), 401/403 = sin auth
        // pero Firestore vivo: aceptamos como "disponible" porque las
        // operaciones reales se haran tras login con idToken.
        var ok =
          res.ok ||
          res.status === 200 ||
          res.status === 404 ||
          res.status === 401 ||
          res.status === 403;
        if (res.ok || res.status === 404) registerFirestoreOperation("read", 1);
        if (ok) availabilityCache = true;
        return ok;
      } catch (e) {
        return false; // No cachear fallos — reintentar la proxima vez
      } finally {
        checkInProgress = null;
      }
    })();

    return checkInProgress;
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  OPERACIONES DE ALTO NIVEL
  // ════════════════════════════════════════════════════════════════════════════

  // Convierte un nombre de archivo en una clave segura para Firestore
  // (sin puntos ni caracteres especiales).
  function fileNameToKey(fileName) {
    return String(fileName || "").replace(/\./g, "_").replace(/[^a-z0-9_-]/gi, "_");
  }

  // Un "FieldPath" de Firestore (usado en updateMask.fieldPaths) solo acepta un
  // segmento SIN comillas si son letras/digitos/guion_bajo (y no empieza por
  // digito). fileNameToKey() deja guiones (-) para que los docIds sigan siendo
  // legibles (ej. "grupo-10a-guia-01-induccion_html"), pero un guion en un
  // fieldPath SIN escapar hace que Firestore responda 400 Bad Request. Por eso
  // TODA escritura de progreso (via fsUpdateField) fallaba en silencio: el
  // .catch(() => {}) del llamador tragaba el error y no quedaba ningun rastro.
  function escapeFirestoreFieldPath(name) {
    var raw = String(name || "");
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) return raw;
    return "`" + raw.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
  }

  function guideDataFileName(fileName) {
    var aliases = {
      "grupo-10a-guia-01-induccion.html": "10a_guia.html",
      "grupo-10b-guia-01-induccion.html": "10b_guia.html",
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "10a_guia2.html",
      "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "10b_guia2.html",
      "grupo-10a-guia-03-planificar-informacion.html": "10a_guia3.html",
      "grupo-10b-guia-03-planificar-informacion.html": "10b_guia3.html",
      "grupo-10a-guia-04-taller-integrador.html": "10a_guia4.html",
      "grupo-10b-guia-04-taller-integrador.html": "10b_guia4.html",
      "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
      "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
      "grupo-11a-guia-06-planificar-informacion.html": "11a_guia6.html",
      "grupo-11b-guia-06-planificar-informacion.html": "11b_guia6.html",
      "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "11a_guia7.html",
      "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "11b_guia7.html",
      "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
      "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
    };
    return aliases[fileName] || fileName;
  }

  async function cloudGetUser(usernameKey) {
    return fsGet(COL_USERS, usernameKey);
  }

  async function cloudSaveUser(user) {
    if (!user || !user.usernameKey) return false;
    // No persistir passwordHash en Firestore. Firebase Auth es la fuente de
    // verdad del password. El hash sigue en localStorage para que el login
    // local funcione offline-first en el equipo del aprendiz.
    var sanitized = Object.assign({}, user);
    delete sanitized.passwordHash;
    return fsPatch(COL_USERS, user.usernameKey, sanitized);
  }

  async function cloudListUsers() {
    return fsList(COL_USERS);
  }

  // Lista SOLO los aprendices de una ficha (server-side query via :runQuery).
  // Reemplaza el cloudListUsers() completo en el lado del aprendiz para que
  // las nuevas reglas (list constrained by requesterFicha()) permitan la
  // consulta y el aprendiz no traiga datos de otras fichas.
  async function cloudListUsersByFicha(ficha) {
    var f = String(ficha || "").trim();
    if (!f) return [];
    if (!(await canCallFirestore(COL_USERS))) return [];
    try {
      var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
        "/databases/(default)/documents:runQuery?key=" + FIREBASE_API_KEY;
      var body = { structuredQuery: {
        from: [{ collectionId: COL_USERS }],
        where: { fieldFilter: {
          field: { fieldPath: "ficha" }, op: "EQUAL", value: { stringValue: f },
        } },
        limit: 300,
      } };
      var res = await fetchWithTimeout(url, {
        method:  "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body:    JSON.stringify(body),
      }, API_TIMEOUT_MS);
      if (!res.ok) {
        if (isAuthRejection(res.status)) markFirestoreRejection();
        return [];
      }
      var rows = await res.json();
      var docs = (Array.isArray(rows) ? rows : [])
        .map(function (r) { return r && r.document ? fromFsDoc(r.document) : null; })
        .filter(Boolean);
      registerFirestoreOperation("read", Math.max(1, docs.length));
      markFirestoreSuccess();
      return docs;
    } catch (e) {
      return [];
    }
  }

  // Escribe el indice uid -> ficha (sena_portal_user_index/{uid}) que las
  // reglas usan para verificar la ficha del solicitante en la regla list de
  // sena_portal_users. Se llama en cada login exitoso (ver portal_auth.js).
  async function cloudSaveUserIndex(ficha) {
    var uid = getBridgeCurrentUid();
    if (!uid || !ficha) return false;
    return fsPatch(COL_USER_INDEX, uid, {
      ficha:     String(ficha),
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Hash de contrasena (coleccion paralela con rules estrictas) ───────────
  // Lee el doc sena_portal_user_auth/{usernameKey}. Requiere que la sesion
  // este autenticada como el propio aprendiz o como admin (ver firestore.rules).
  async function cloudGetUserAuth(usernameKey) {
    if (!usernameKey) return null;
    return fsGet(COL_USER_AUTH, usernameKey);
  }

  // Escribe el hash de contrasena de un aprendiz en la coleccion paralela.
  // Solo funciona si el caller esta autenticado como el propio aprendiz o
  // como admin.
  async function cloudSaveUserAuth(usernameKey, passwordHash) {
    if (!usernameKey || !passwordHash) return false;
    return fsPatch(COL_USER_AUTH, usernameKey, {
      usernameKey: usernameKey,
      passwordHash: passwordHash,
      updatedAt:   new Date().toISOString(),
    });
  }

  // ── Equipos de trabajo (grupos colaborativos) ─────────────────────────────
  // Doc Firestore por grupo. Identificador determinista a partir de los
  // usernameKeys ordenados (mismo set de miembros ⇒ mismo doc).
  async function cloudGetGroup(groupKey) {
    if (!groupKey) return null;
    return fsGet(COL_GROUPS, groupKey);
  }

  async function cloudSaveGroup(groupKey, data) {
    if (!groupKey || !data) return false;
    return fsPatch(COL_GROUPS, groupKey, data);
  }

  async function cloudUpdateGroupDelivery(groupKey, deliveryRecord) {
    if (!groupKey || !deliveryRecord) return false;
    return fsUpdateField(COL_GROUPS, groupKey, "delivery", deliveryRecord);
  }

  async function cloudGetProgress(usernameKey) {
    var doc = await fsGet(COL_PROGRESS, usernameKey);
    return doc || {};
  }

  // ── Notas / juicios de evaluacion ─────────────────────────────────────────
  // El aprendiz lee su propio doc (rule owner); el admin lee/escribe cualquiera.
  // Reemplaza el archivo semilla publico data/grades_*.js. Devuelve el mapa
  // { guideFamily: { actId: "A"|"D" } } o {} si no hay.
  async function cloudGetGrades(usernameKey) {
    if (!usernameKey) return {};
    var doc = await fsGet(COL_GRADES, usernameKey);
    return doc && doc.grades && typeof doc.grades === "object" ? doc.grades : {};
  }

  // Solo el admin puede escribir (rule isAdmin()). Reemplaza el doc completo.
  async function cloudSaveGrades(usernameKey, grades) {
    if (!usernameKey) return false;
    return fsPatch(COL_GRADES, usernameKey, {
      usernameKey: usernameKey,
      grades: grades && typeof grades === "object" ? grades : {},
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Autorizacion de uso de firma (evidencia de consentimiento) ────────────
  // El aprendiz sube una foto/escaneo de su firma (a Drive, via Apps Script) y
  // este doc queda como REGISTRO de que ya autorizo. El aprendiz lee/crea/
  // actualiza el suyo (rule isOwnerByUsernameKey) hasta que status=="delivered";
  // desde ahi solo el admin puede volver a escribir (re-habilitar reenvio).
  async function cloudGetSignatureAuth(usernameKey) {
    if (!usernameKey) return null;
    return fsGet(COL_SIGNATURE_AUTH, usernameKey);
  }

  async function cloudSaveSignatureAuth(usernameKey, data) {
    if (!usernameKey) return false;
    return fsPatch(COL_SIGNATURE_AUTH, usernameKey, Object.assign({}, data, {
      usernameKey: usernameKey,
      updatedAt: new Date().toISOString(),
    }));
  }

  // ── Banco de respuestas modelo (SOLO admin lo lee/escribe, rule isAdmin) ──
  // Doc unico "bank": { solutions: { guideFamily: { actId: { "<data-store>": "texto" } } } }.
  // NO se carga en el cliente del aprendiz; el admin lo consulta para copiar la
  // solucion puntual dentro de las notas del aprendiz al aprobar.
  async function cloudGetGradeSolutions() {
    var doc = await fsGet(COL_GRADE_SOLUTIONS, "bank");
    return doc && doc.solutions && typeof doc.solutions === "object" ? doc.solutions : {};
  }

  async function cloudSaveGradeSolutions(solutions) {
    return fsPatch(COL_GRADE_SOLUTIONS, "bank", {
      solutions: solutions && typeof solutions === "object" ? solutions : {},
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Planes de mejoramiento (admin escribe; aprendiz lee solo el suyo) ─────
  // Doc por aprendiz: { usernameKey, plans: [...], updatedAt }.
  async function cloudGetImprovementPlans(usernameKey) {
    if (!usernameKey) return [];
    var doc = await fsGet(COL_IMPROVEMENT_PLANS, usernameKey);
    return doc && Array.isArray(doc.plans) ? doc.plans : [];
  }

  async function cloudSaveImprovementPlans(usernameKey, plans) {
    if (!usernameKey) return false;
    return fsPatch(COL_IMPROVEMENT_PLANS, usernameKey, {
      usernameKey: usernameKey,
      plans: Array.isArray(plans) ? plans : [],
      updatedAt: new Date().toISOString(),
    });
  }

  // Guarda el progreso de UNA guia sin borrar el de las demas (updateMask).
  async function cloudSaveProgressEntry(usernameKey, fileName, entry) {
    if (!usernameKey || !fileName) return false;
    var key = fileNameToKey(fileName);
    return fsUpdateField(COL_PROGRESS, usernameKey, key, entry);
  }

  // Pone a cero el progreso de una guia concreta.
  async function cloudClearProgressEntry(usernameKey, fileName) {
    return cloudSaveProgressEntry(usernameKey, fileName, {
      completed: 0, total: 0, percent: 0, updatedAt: new Date().toISOString(),
    });
  }

  // Reemplaza el documento de progreso con uno vacio (borra todo el avance).
  async function cloudClearAllProgress(usernameKey) {
    return fsPatch(COL_PROGRESS, usernameKey, { _clearedAt: new Date().toISOString() });
  }

  function buildStudentScopeKeyVariants(usernameKey) {
    var normalized = String(usernameKey || "").trim().toLowerCase();
    if (!normalized) return [];
    var variants = [
      "student:" + normalized,
      "student:" + normalized.replace(/[^a-z0-9_-]+/g, "-"),
    ];
    var seen = {};
    return variants.filter(function (scopeKey) {
      if (!scopeKey || seen[scopeKey]) return false;
      seen[scopeKey] = true;
      return true;
    });
  }

  function getKnownStudentGuideStateFiles() {
    return [
      "10a_guia.html",
      "10b_guia.html",
      "10a_guia2.html",
      "10b_guia2.html",
      "10a_guia3.html",
      "10b_guia3.html",
      "11a_guia.html",
      "11b_guia.html",
      "11a_guia6.html",
      "11b_guia6.html",
      "11a_guia7.html",
      "11b_guia7.html",
      "sb_10a_redes.html",
      "sb_10b_redes.html",
      "santa-barbara-10a-guia-02-redes-rap01.html",
      "santa-barbara-10b-guia-02-redes-rap01.html",
      "grupo-10a-guia-01-induccion.html",
      "grupo-10b-guia-01-induccion.html",
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
      "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
      "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
      "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
      "grupo-11a-guia-06-planificar-informacion.html",
      "grupo-11b-guia-06-planificar-informacion.html",
      "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html",
      "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html",
      "grupo-10a-guia-03-planificar-informacion.html",
      "grupo-10b-guia-03-planificar-informacion.html",
      "grupo-10a-guia-02-ficha-caso.html",
      "grupo-10b-guia-02-ficha-caso.html",
      "10a_guia4.html",
      "10b_guia4.html",
      "grupo-10a-guia-04-taller-integrador.html",
      "grupo-10b-guia-04-taller-integrador.html",
    ];
  }

  async function copyStudentGuideStateSnapshots(currentUsernameKey, nextUsernameKey) {
    if (!currentUsernameKey || !nextUsernameKey || currentUsernameKey === nextUsernameKey) {
      return true;
    }

    var oldScopes = buildStudentScopeKeyVariants(currentUsernameKey);
    var newScopes = buildStudentScopeKeyVariants(nextUsernameKey);
    var files = getKnownStudentGuideStateFiles();
    for (var fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      var fileName = files[fileIndex];
      var guideDataSnapshot = null;
      var guideUiSnapshot = null;

      for (var oldIndex = 0; oldIndex < oldScopes.length; oldIndex += 1) {
        var oldScope = oldScopes[oldIndex];
        if (!guideDataSnapshot) {
          guideDataSnapshot = await cloudGetGuideData(oldScope, fileName);
        }
        if (!guideUiSnapshot) {
          guideUiSnapshot = await cloudGetGuideUiState(oldScope, fileName);
        }
        if (guideDataSnapshot && guideUiSnapshot) {
          break;
        }
      }

      if (!guideDataSnapshot && !guideUiSnapshot) {
        continue;
      }

      for (var newIndex = 0; newIndex < newScopes.length; newIndex += 1) {
        var newScope = newScopes[newIndex];
        if (guideDataSnapshot) {
          await cloudSaveGuideData(
            newScope,
            fileName,
            Object.assign({}, guideDataSnapshot, {
              scopeKey: newScope,
              fileName: fileName,
            })
          );
        }
        if (guideUiSnapshot) {
          await cloudSaveGuideUiState(
            newScope,
            fileName,
            Object.assign({}, guideUiSnapshot, {
              scopeKey: newScope,
              fileName: fileName,
            })
          );
        }
      }
    }

    return true;
  }

  async function syncStudentProfileToFirebase(previousUsernameKey, user) {
    var currentKey = String(previousUsernameKey || "").trim().toLowerCase();
    var nextUser = user && typeof user === "object" ? Object.assign({}, user) : null;
    var nextKey = String(nextUser && nextUser.usernameKey || "").trim().toLowerCase();
    if (!nextUser || !nextKey) return false;

    nextUser.usernameKey = nextKey;
    nextUser.updatedAt = nextUser.updatedAt || new Date().toISOString();

    var savedUser = await cloudSaveUser(nextUser);
    if (!savedUser) return false;

    if (!currentKey || currentKey === nextKey) {
      return true;
    }

    var previousProgress = await cloudGetProgress(currentKey);
    var nextProgress = await cloudGetProgress(nextKey);
    var mergedProgress = Object.assign({}, previousProgress || {}, nextProgress || {}, {
      _usernameKey: nextKey,
    });
    if (Object.keys(mergedProgress).length > 1) {
      await fsPatch(COL_PROGRESS, nextKey, mergedProgress);
    }

    await copyStudentGuideStateSnapshots(currentKey, nextKey);
    await fsDelete(COL_USERS, currentKey);
    await fsDelete(COL_PROGRESS, currentKey);
    return true;
  }

  function calendarFallbackDocId(calendarId) {
    return CALENDAR_FALLBACK_PREFIX + String(calendarId || "default");
  }

  async function cloudGetCalendar(calendarId) {
    if (!calendarId) return null;
    var fallbackDoc = await fsGet(COL_PROGRESS, calendarFallbackDocId(calendarId));
    if (fallbackDoc) {
      if (fallbackDoc && typeof fallbackDoc.snapshotJson === "string") {
        try {
          return JSON.parse(fallbackDoc.snapshotJson);
        } catch (error) {
        }
      }
      return fallbackDoc;
    }
    var directDoc = await fsGet(COL_CALENDAR, calendarId);
    if (directDoc && typeof directDoc.snapshotJson === "string") {
      try {
        return JSON.parse(directDoc.snapshotJson);
      } catch (error) {
      }
    }
    return directDoc;
  }

  async function cloudSaveCalendar(calendarId, snapshot) {
    if (!calendarId) return false;
    var payload = Object.assign({}, snapshot || {}, {
      calendarId: calendarId,
      updatedAt: (snapshot && snapshot.updatedAt) || new Date().toISOString(),
    });
    var fallbackSaved = await fsPatch(COL_PROGRESS, calendarFallbackDocId(calendarId), Object.assign({
      _usernameKey: calendarFallbackDocId(calendarId),
      _kind: "calendar",
    }, payload));
    // Publicar tambien en la coleccion canonica para que los aprendices puedan leerlo.
    // Las reglas de Firestore permiten lectura a cualquier sesion autenticada y
    // escritura solo al admin (que es quien dispara este save).
    var canonicalSaved = false;
    try {
      canonicalSaved = await fsPatch(COL_CALENDAR, calendarId, payload);
    } catch (e) {
      canonicalSaved = false;
    }
    return fallbackSaved || canonicalSaved;
  }

  function guideStateDocId(prefix, scopeKey, fileName) {
    return prefix + safeCloudKey(scopeKey) + ":" + fileNameToKey(fileName);
  }

  async function readGuideStateDoc(prefix, scopeKey, fileName, opts) {
    var docId = guideStateDocId(prefix, scopeKey, fileName);
    // NOTA: fsGet YA prueba Drive por su cuenta ante un 404 o un fallo de auth
    // (ver arriba), asi que un chequeo extra aqui era redundante (duplicaba la
    // llamada a Apps Script hasta 2 veces mas por cada doc que no existe).
    var fallbackDoc = await fsGet(COL_PROGRESS, docId, opts);
    if (fallbackDoc) return fallbackDoc;
    var stateDoc = await fsGet(COL_GUIDE_STATE, docId, opts);
    if (stateDoc) return stateDoc;
    return null;
  }

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

    var auth = window.portalAuth || {};
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

  async function saveGuideStateDoc(prefix, kind, scopeKey, fileName, payload) {
    var docId = guideStateDocId(prefix, scopeKey, fileName);
    var progressPayload = Object.assign({
      _usernameKey: docId,
      _kind: kind,
    }, payload);
    var fallbackSaved = await fsPatch(COL_PROGRESS, docId, progressPayload);
    // Entrega CONFIABLE a Drive cuando escribe el ADMIN (fechas de entrega,
    // desbloqueos, reaperturas). Los aprendices LEEN de Drive (useDriveAsPrimary),
    // pero el admin escribe en Firestore; el respaldo a Drive normal es
    // fire-and-forget y depende de la sesion. Aqui lo hacemos ESPERADO y al MISMO
    // doc (COL_PROGRESS/docId) que leen los aprendices. Es Drive via Apps Script:
    // NO consume cuota de Firestore.
    if (
      isCurrentUserAdmin() &&
      window.driveDb &&
      typeof window.driveDb.set === "function" &&
      typeof window.driveDb.isEnabled === "function" &&
      window.driveDb.isEnabled()
    ) {
      try {
        await window.driveDb.set(COL_PROGRESS, docId, progressPayload);
      } catch (_) { /* best-effort: si falla, queda el respaldo fire-and-forget */ }
    }
    if (fallbackSaved) return true;
    return fsPatch(COL_GUIDE_STATE, docId, payload);
  }

  async function cloudGetGuideData(scopeKey, fileName, opts) {
    if (!scopeKey || !fileName) return null;
    var doc = await readGuideStateDoc(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName, opts);
    if (!doc) return null;
    return readSnapshotPayload(doc);
  }

  async function cloudSaveGuideData(scopeKey, fileName, snapshot) {
    if (!scopeKey || !fileName) return false;
    var existing = readSnapshotPayload(await readGuideStateDoc(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName));
    var safeSnapshot = existing
      ? mergeGuideDataSnapshotForSave(existing, snapshot || {})
      : (snapshot || {});
    var updatedAt = (safeSnapshot && safeSnapshot.updatedAt) || new Date().toISOString();
    var payload = {
      scopeKey: scopeKey,
      fileName: fileName,
      updatedAt: updatedAt,
      snapshotJson: JSON.stringify(safeSnapshot || {}),
    };
    return saveGuideStateDoc(
      GUIDE_DATA_FALLBACK_PREFIX,
      "guide-data",
      scopeKey,
      fileName,
      payload
    );
  }

  // Admin: al aprobar una actividad con solucion del banco, escribe las respuestas
  // directamente en el estado del aprendiz en la nube (SOLO campos vacios) y actualiza
  // su progreso, para que el avance y las respuestas se vean al instante al consultar
  // desde el panel, sin que el aprendiz tenga que reabrir la guia (igual las vera al
  // abrirla). Requiere sesion admin: las reglas de Firestore permiten a isAdmin()
  // escribir el doc de cualquier aprendiz. `fields` = { "<data-store>": valor } (la
  // solucion de UNA actividad). Respeta lo que el aprendiz ya haya respondido.
  async function adminApplySolutionToGuide(usernameKey, fileName, fields) {
    var key = String(usernameKey || "").trim().toLowerCase();
    if (!key || !fileName || !plainObject(fields)) return { ok: false, filled: 0 };
    var scopeKey = "student:" + key;
    // El guide-data en la nube se guarda bajo el ALIAS canonico (p. ej.
    // "10a_guia.html"), no bajo el nombre crudo del HTML. Hay que leer/escribir con
    // el alias para que la hidratacion del panel y la derivacion del % lean el mismo
    // doc. El PROGRESO en cambio se indexa por el nombre crudo (fileNameToKey), que
    // es lo que usa la vista del panel; por eso ese se deja tal cual.
    var cloudFileName = guideDataFileName(fileName);

    var current = await cloudGetGuideData(scopeKey, cloudFileName).catch(function () { return null; });
    var currentState = plainObject(current && current.state) ? current.state : {};

    var nextState = Object.assign({}, currentState);
    var filled = 0;
    Object.keys(fields).forEach(function (k) {
      var v = fields[k];
      if (!hasMeaningfulGuideValue(v)) return;
      if (hasMeaningfulGuideValue(currentState[k])) return; // respeta la respuesta del aprendiz
      nextState[k] = v;
      filled++;
    });
    if (filled === 0) return { ok: true, filled: 0, state: currentState };

    var updatedAt = new Date().toISOString();
    var saved = await cloudSaveGuideData(scopeKey, cloudFileName, {
      state: nextState,
      updatedAt: updatedAt,
      updatedBy: "admin-grade-fill",
    });
    // Si la escritura a Firestore/Drive fallo (cuota, red, permisos), NO reportar
    // exito: antes `filled` se calculaba ANTES de guardar y se devolvia igual,
    // asi que el panel mostraba "Respuestas y avance aplicados" aunque nada
    // hubiera quedado guardado.
    if (!saved) return { ok: false, filled: 0, state: currentState };

    // Actualiza el progreso para que el % suba aunque el aprendiz ya tuviera un doc de
    // progreso en 0% (en cuyo caso la derivacion desde guide-data no se aplica). Se
    // cuenta igual que deriveProgressFromGuideDataDoc para mantener consistencia.
    var portal = window.portalAuth || {};
    var config = portal.GUIDE_PROGRESS_CONFIG && portal.GUIDE_PROGRESS_CONFIG[fileName];
    var total = Math.max(0, Number(config && config.total) || 0);
    var progress = null;
    if (total > 0) {
      var completed = Math.min(countMeaningfulGuideValues(nextState), total);
      progress = {
        completed: completed,
        total: total,
        percent: Math.round((completed / total) * 100),
        updatedAt: updatedAt,
      };
      await cloudSaveProgressEntry(key, fileName, progress).catch(function () {});
    }
    return { ok: true, filled: filled, state: nextState, progress: progress };
  }

  // Admin: al aprobar una actividad de archivo/checkbox (sin campo de texto que
  // el banco pueda rellenar) que el aprendiz entrego por un medio distinto al
  // portal, registra la entrega con la fecha de HOY y una nota aclarando que
  // fue el instructor quien la registro (no una subida real por Drive). No pisa
  // una entrega real ya existente. Pedido explicito del usuario 2026-07-03.
  async function adminMarkActivityDelivered(usernameKey, fileName, activityId) {
    var key = String(usernameKey || "").trim().toLowerCase();
    if (!key || !fileName || !activityId) return { ok: false, filled: 0 };
    var scopeKey = "student:" + key;
    var cloudFileName = guideDataFileName(fileName);

    var current = await cloudGetGuideData(scopeKey, cloudFileName).catch(function () { return null; });
    var currentState = plainObject(current && current.state) ? current.state : {};

    var deliveryKey = activityId + "-delivery";
    if (hasMeaningfulGuideValue(currentState[deliveryKey])) {
      return { ok: true, filled: 0, state: currentState }; // ya tiene entrega real: no se pisa
    }

    var updatedAt = new Date().toISOString();
    var nextState = Object.assign({}, currentState);
    nextState[deliveryKey] = {
      status: "delivered",
      submittedAt: updatedAt,
      note: "Entregado segun fecha indicada por el instructor.",
      registeredBy: "admin-grade-approval",
    };
    nextState[activityId + "-locked"] = true;

    var saved = await cloudSaveGuideData(scopeKey, cloudFileName, {
      state: nextState,
      updatedAt: updatedAt,
      updatedBy: "admin-grade-fill",
    });
    if (!saved) return { ok: false, filled: 0, state: currentState };

    var portal = window.portalAuth || {};
    var config = portal.GUIDE_PROGRESS_CONFIG && portal.GUIDE_PROGRESS_CONFIG[fileName];
    var total = Math.max(0, Number(config && config.total) || 0);
    var progress = null;
    if (total > 0) {
      var completed = Math.min(countMeaningfulGuideValues(nextState), total);
      progress = {
        completed: completed,
        total: total,
        percent: Math.round((completed / total) * 100),
        updatedAt: updatedAt,
      };
      await cloudSaveProgressEntry(key, fileName, progress).catch(function () {});
    }
    return { ok: true, filled: 1, state: nextState, progress: progress };
  }

  async function cloudGetGuideUiState(scopeKey, fileName) {
    if (!scopeKey || !fileName) return null;
    return readGuideStateDoc(GUIDE_UI_FALLBACK_PREFIX, scopeKey, fileName);
  }

  async function cloudSaveGuideUiState(scopeKey, fileName, snapshot) {
    if (!scopeKey || !fileName) return false;
    if (shouldSkipGuideUiCloudSave()) return false;
    var payload = Object.assign({}, snapshot || {}, {
      scopeKey: scopeKey,
      fileName: fileName,
      updatedAt: (snapshot && snapshot.updatedAt) || new Date().toISOString(),
    });
    return saveGuideStateDoc(
      GUIDE_UI_FALLBACK_PREFIX,
      "guide-ui",
      scopeKey,
      fileName,
      payload
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RESERVAS DE TUTORIA VIRTUAL
  //  Cada documento es una reserva de un aprendiz para una fecha SENA, con
  //  hora de inicio y duracion (30 o 60 min). El doc id es deterministico
  //  ({date}__{ficha}__{usernameKey}) para que el mismo aprendiz solo tenga
  //  una reserva por fecha (re-guardar = sobreescribir).
  // ════════════════════════════════════════════════════════════════════════════
  function tutoringDocId(date, ficha, usernameKey) {
    var d = String(date || "").trim();
    var f = String(ficha || "").trim();
    var u = String(usernameKey || "").trim().toLowerCase();
    if (!d || !f || !u) return "";
    return d + "__" + f + "__" + u;
  }

  async function cloudListTutoringBookings() {
    var list = await fsList(COL_TUTORING);
    return Array.isArray(list) ? list : [];
  }

  async function cloudListTutoringBookingsForDate(date, ficha) {
    // No filtramos en Firestore (la API REST sin SDK no soporta queries
    // estructuradas trivialmente); filtramos en cliente sobre la lista.
    var all = await cloudListTutoringBookings();
    return all.filter(function (b) {
      if (date && b.date !== date) return false;
      if (ficha && String(b.ficha || "") !== String(ficha)) return false;
      return true;
    });
  }

  async function cloudGetTutoringBooking(date, ficha, usernameKey) {
    var id = tutoringDocId(date, ficha, usernameKey);
    if (!id) return null;
    return fsGet(COL_TUTORING, id);
  }

  async function cloudSaveTutoringBooking(booking) {
    if (!booking) return false;
    var id = tutoringDocId(booking.date, booking.ficha, booking.usernameKey);
    if (!id) return false;
    return fsPatch(COL_TUTORING, id, booking);
  }

  async function cloudDeleteTutoringBooking(date, ficha, usernameKey) {
    var id = tutoringDocId(date, ficha, usernameKey);
    if (!id) return false;
    return fsDelete(COL_TUTORING, id);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RESTAURAR DATOS EN LOCALSTORAGE DESDE FIREBASE
  //  Necesario cuando el estudiante entra desde un equipo nuevo.
  // ════════════════════════════════════════════════════════════════════════════

  function upsertLocalUser(cloudUser) {
    if (!cloudUser || !cloudUser.usernameKey) return;
    try {
      var raw   = localStorage.getItem(LOCAL_USERS_KEY);
      var users = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];
      var idx   = users.findIndex(function (u) { return u.usernameKey === cloudUser.usernameKey; });
      if (idx === -1) {
        users.push(cloudUser);
      } else {
        // Preservar el hash de contrasena local si la nube no trae uno
        users[idx] = Object.assign({}, users[idx], cloudUser, {
          passwordHash: cloudUser.passwordHash || users[idx].passwordHash || "",
        });
      }
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    } catch (e) { /* ignorar errores de almacenamiento */ }
  }

  function writeProgressMeta(usernameKey, fileName, entry) {
    // La clave exacta que usa portal_auth.js para el meta de progreso:
    // sena_portal:student:{usernameKey}:guide-meta:progress:{fileName}
    var key = LOCAL_PROGRESS_PREFIX + usernameKey + ":guide-meta:progress:" + fileName;
    try {
      localStorage.setItem(key, JSON.stringify({
        fileName:  fileName,
        total:     Number(entry.total)     || 0,
        completed: Number(entry.completed) || 0,
        percent:   Number(entry.percent)   || 0,
        updatedAt: entry.updatedAt || new Date().toISOString(),
      }));
    } catch (e) { /* ignorar */ }
  }

  async function restoreStudentFromCloud(usernameKey, ficha) {
    try {
      var cloudUser = await cloudGetUser(usernameKey);
      if (!cloudUser) return;
      upsertLocalUser(cloudUser);

      var auth     = window.portalAuth;
      var guides   = auth ? auth.getGuidesForFicha(ficha || cloudUser.ficha || "") : [];
      var progMap  = await cloudGetProgress(usernameKey);

      guides.forEach(function (fileName) {
        var key   = fileNameToKey(fileName);
        var entry = progMap && progMap[key];
        if (entry && (Number(entry.completed) > 0 || Number(entry.total) > 0)) {
          writeProgressMeta(usernameKey, fileName, entry);
        }
      });
    } catch (e) { /* silencioso */ }
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  PARCHES A window.portalAuth
  //  Cada metodo encadena la implementacion previa (ya parcheada por la segunda
  //  IIFE de portal_auth.js) y luego agrega la sincronizacion con Firebase.
  // ════════════════════════════════════════════════════════════════════════════

  var auth = window.portalAuth;
  if (!auth) return;

  var prev = {
    registerStudent:           auth.registerStudent,
    loginStudent:              auth.loginStudent,
    writeGuideProgress:        auth.writeGuideProgress,
    updateStudentPassword:     auth.updateStudentPassword,
    updateStudentFicha:        auth.updateStudentFicha,
    updateStudentAccount:      auth.updateStudentAccount,
    resetStudentGuideProgress: auth.resetStudentGuideProgress,
    resetStudentAllProgress:   auth.resetStudentAllProgress,
    fetchStudentsWithProgress: auth.fetchStudentsWithProgress,
    getStorageContext:         auth.getStorageContext,
    getSharedStoreStatus:      auth.getSharedStoreStatus,
  };

  // ── Registro ─────────────────────────────────────────────────────────────────
  auth.registerStudent = async function (data) {
    var result = await prev.registerStudent.call(auth, data);
    if (result && result.ok) {
      // Obtener usuario del resultado o de la sesion actual (por si el PS1 server
      // o el servidor de red lo procesa y no viene directamente en result.user)
      checkAvailability().then(async function (ok) {
        if (!ok) {
          console.warn("[firebase_db] Firebase no disponible al registrar. Se reintentara en la proxima carga.");
          return;
        }
        var user = (result.user && result.user.usernameKey) ? result.user : null;
        if (!user && auth.getCurrentSession) {
          var s = auth.getCurrentSession();
          user = s && s.user && s.user.usernameKey ? s.user : null;
        }
        if (!user) return;
        var saved = await cloudSaveUser(user).catch(function (e) {
          console.warn("[firebase_db] Error guardando usuario en Firebase:", e && e.message);
          return false;
        });
        if (saved) {
          console.info("[firebase_db] Usuario guardado en Firebase: " + user.username);
        }
      });
    }
    return result;
  };

  // ── Login ─────────────────────────────────────────────────────────────────────
  // Si el usuario no existe en este equipo, se busca en Firebase y se restaura.
  auth.loginStudent = async function (data) {
    var localResult = await prev.loginStudent.call(auth, data);
    if (localResult && localResult.ok) return localResult;

    var available = await checkAvailability();
    if (!available) {
      console.warn("[firebase_db] Login fallback: Firestore no disponible. Devuelvo resultado local.");
      return localResult;
    }

    var usernameKey = String((data && data.username) || "").trim().toLowerCase();
    var password    = String((data && data.password) || "").trim();
    if (!usernameKey || !password) return localResult;

    var cloudUser = await cloudGetUser(usernameKey);
    if (!cloudUser) {
      // fsGet devuelve null cuando: 404 sin Drive fallback, 5xx, error de red,
      // o cuota Firestore agotada. Distinto a "doc realmente vacio".
      console.warn(
        "[firebase_db] Login fallback: cloudGetUser('" + usernameKey + "') devolvio null. " +
        "Posibles causas: doc no existe, Firestore inalcanzable, cuota agotada o sin permisos."
      );
      if (localResult && localResult.message) return localResult;
      return {
        ok: false,
        message: "No pudimos verificar tu usuario con la nube. Revisa tu conexion o intenta de nuevo.",
      };
    }
    if (!cloudUser.usernameKey) {
      // El doc existe pero le faltan los campos del perfil (corrupcion de datos).
      console.error(
        "[firebase_db] Login fallback: doc sena_portal_users/" + usernameKey +
        " esta corrupto (sin usernameKey). Campos disponibles:",
        Object.keys(cloudUser || {})
      );
      return {
        ok: false,
        message: "Tu perfil en la nube esta incompleto. Pide al instructor que lo recree.",
      };
    }

    // Verificar contrasena contra el hash guardado en Firebase
    var hash = typeof auth.hashSecret === "function" ? await auth.hashSecret(password) : null;

    // El doc de perfil NO almacena passwordHash (por seguridad: cualquier
    // aprendiz puede leer cualquier perfil). El hash vive en la coleccion
    // paralela sena_portal_user_auth con rules estrictas. Solo accesible si
    // el aprendiz YA esta autenticado en Firebase Auth como dueño del doc
    // — es decir, si el bridge ya logueo arriba en la cadena.
    var hashFromUserAuth = null;
    try {
      var userAuthDoc = await cloudGetUserAuth(usernameKey);
      if (userAuthDoc && userAuthDoc.passwordHash) {
        hashFromUserAuth = userAuthDoc.passwordHash;
      }
    } catch (e) { /* silencioso: best-effort */ }

    var referenceHash = cloudUser.passwordHash || hashFromUserAuth;
    if (!referenceHash) {
      // Ni el doc de perfil ni el doc user_auth tienen hash. El bridge de
      // Firebase Auth deberia haber resuelto antes. Si llegamos aqui es
      // porque el aprendiz no esta logueado en Firebase Auth (no podemos
      // leer user_auth) o porque nunca se sincronizo el hash.
      console.warn(
        "[firebase_db] Login fallback: sin hash en perfil ni en sena_portal_user_auth/" +
        usernameKey + ". El bridge de Firebase Auth debio resolver antes."
      );
      return { ok: false, message: "Usuario o contrasena incorrectos." };
    }
    if (!hash || hash !== referenceHash) {
      return { ok: false, message: "La contrasena no es correcta." };
    }

    // Hash valido: si vino del doc paralelo, dejamos el perfil sin tocar
    // (no escribimos passwordHash al doc de perfil porque otros aprendices
    // pueden leerlo). El hash queda en user_auth para sincronizacion futura.
    await restoreStudentFromCloud(usernameKey, cloudUser.ficha);
    return prev.loginStudent.call(auth, data);
  };

  // ── Guardar progreso ──────────────────────────────────────────────────────────
  // Escribe en localStorage de inmediato y sincroniza a Firebase con debounce.
  auth.writeGuideProgress = function (fileName, progress) {
    prev.writeGuideProgress.call(auth, fileName, progress);

    var session = auth.getCurrentSession();
    if (!session || session.role !== "student" || !session.user) return;

    var usernameKey = session.user.usernameKey;
    var total       = Math.max(0, Number(progress && progress.total) || 0);
    if (total <= 0) return;
    var completed   = Math.min(Math.max(0, Number(progress && progress.completed) || 0), total || 0);
    var percent     = total ? Math.round((completed / total) * 100) : 0;

    var timerKey = usernameKey + ":" + fileName;
    window.clearTimeout(progressTimers[timerKey]);
    progressTimers[timerKey] = window.setTimeout(function () {
      delete progressTimers[timerKey];
      checkAvailability().then(function (ok) {
        if (!ok) return;
        cloudSaveProgressEntry(usernameKey, fileName, {
          completed: completed,
          total:     total,
          percent:   percent,
          updatedAt: new Date().toISOString(),
        }).catch(function () {});
      });
    }, SYNC_DELAY_MS);
  };

  // ── Cambiar contrasena ────────────────────────────────────────────────────────
  // El admin no puede tocar Firebase Auth directamente desde el panel (no
  // tenemos Admin SDK en plan Spark). En vez de eso, incrementamos
  // authEmailVersion en el doc del aprendiz: el bridge construira un email
  // sintetico nuevo en el proximo login y Firebase Auth aceptara la
  // password nueva como si fuera una cuenta nueva. La cuenta Auth vieja
  // queda huerfana pero no afecta cuotas en Spark (50K MAU gratis).
  auth.updateStudentPassword = async function (usernameKey, newPassword) {
    var result = await prev.updateStudentPassword.call(auth, usernameKey, newPassword);
    if (result && result.ok) {
      checkAvailability().then(async function (ok) {
        if (!ok) return;
        try {
          var cloudUser = await cloudGetUser(usernameKey);
          if (!cloudUser) return;
          var hash = typeof auth.hashSecret === "function"
            ? await auth.hashSecret(newPassword) : null;
          if (!hash) return;

          // Incrementar authEmailVersion. v1 implicita si nunca se reseteo.
          // Consulta la version desde user_meta (fuente publica y autoritativa)
          // y si no esta, cae al campo en el doc de perfil.
          var metaVersion = await cloudGetAuthVersion(usernameKey);
          var profileVersion = Number(cloudUser.authEmailVersion) || 1;
          var currentVersion = Math.max(metaVersion, profileVersion);
          var nextVersion = currentVersion + 1;

          // Touch del doc de perfil (updatedAt + nueva version) y sync del
          // hash a la coleccion paralela con rules estrictas.
          cloudSaveUser(Object.assign({}, cloudUser, {
            authEmailVersion:       nextVersion,
            authEmailVersionBumpAt: new Date().toISOString(),
            updatedAt:              new Date().toISOString(),
          })).catch(function () {});
          cloudSaveUserAuth(usernameKey, hash).catch(function (e) {
            console.warn(
              "[firebase_db] No se pudo sincronizar hash a sena_portal_user_auth/" +
              usernameKey + ":", e && e.message
            );
          });
          // user_meta es la fuente que el bridge consulta sin auth previa
          // (chicken-and-egg). Critico que se escriba correctamente.
          cloudSaveAuthVersion(usernameKey, nextVersion).catch(function (e) {
            console.error(
              "[firebase_db] FALLO al escribir sena_portal_user_meta/" + usernameKey +
              ". El aprendiz NO podra entrar con la nueva password hasta que esto se arregle. " +
              "Error:", e && e.message
            );
          });
          console.info(
            "[firebase_db] Password de '" + usernameKey + "' rotada. " +
            "authEmailVersion: " + currentVersion + " -> " + nextVersion +
            ". El aprendiz puede entrar con la nueva password desde cualquier dispositivo."
          );
        } catch (e) { /* silencioso */ }
      });
    }
    return result;
  };

  // Lee la version del email Auth desde sena_portal_user_meta SIN requerir
  // autenticacion. Necesario porque el bridge tiene que conocer la version
  // ANTES de poder loguear en Firebase Auth (chicken-and-egg). Por eso esta
  // funcion NO usa fsGet/canCallFirestore (que requieren auth previa) sino
  // un fetch directo con solo el API key. Las rules permiten GET publico
  // sobre esta coleccion (solo expone el numero de version, sin PII).
  async function cloudGetAuthVersion(usernameKey) {
    var key = String(usernameKey || "").trim().toLowerCase();
    if (!key || !FIREBASE_API_KEY || !FIREBASE_PROJECT_ID) return 1;
    var url = "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID + "/databases/(default)/documents/" +
      COL_USER_META + "/" + encodeURIComponent(key) +
      "?key=" + FIREBASE_API_KEY;
    try {
      var res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, API_TIMEOUT_MS);
      if (res.status === 404) return 1; // doc no existe -> v1 implicita
      if (!res.ok) {
        console.warn(
          "[firebase_db] cloudGetAuthVersion('" + key + "') status=" + res.status +
          ". Asumo v1."
        );
        return 1;
      }
      var payload = await res.json();
      var obj = payload && payload.fields ? fromFsDoc(payload) : null;
      var v = Number(obj && obj.authEmailVersion);
      return Number.isFinite(v) && v >= 1 ? v : 1;
    } catch (e) {
      return 1;
    }
  }

  async function cloudSaveAuthVersion(usernameKey, version) {
    var key = String(usernameKey || "").trim().toLowerCase();
    var v = Math.max(1, Math.floor(Number(version) || 1));
    if (!key) return false;
    return fsPatch(COL_USER_META, key, {
      usernameKey:      key,
      authEmailVersion: v,
      updatedAt:        new Date().toISOString(),
    });
  }

  auth.updateStudentFicha = async function (usernameKey, newFicha) {
    if (typeof prev.updateStudentFicha !== "function") {
      return { ok: false, message: "La edicion de ficha no esta disponible." };
    }

    var result = await prev.updateStudentFicha.call(auth, usernameKey, newFicha);
    if (result && result.ok) {
      var ok = await checkAvailability();
      if (ok && result.user) {
        try {
          await syncStudentProfileToFirebase(usernameKey, result.user);
        } catch (e) { /* silencioso */ }
      }
    }
    return result;
  };

  auth.updateStudentAccount = async function (usernameKey, data) {
    if (typeof prev.updateStudentAccount !== "function") {
      return { ok: false, message: "La edicion de usuarios no esta disponible." };
    }

    var result = await prev.updateStudentAccount.call(auth, usernameKey, data);
    if (result && result.ok && result.user) {
      // El guardado local ya ocurrio dentro de prev.updateStudentAccount y es la
      // fuente de verdad. La sincronizacion a la nube se espera SOLO hasta un
      // limite: si se cuelga (sin sesion Firebase, offline, cooldown), no dejamos
      // el toast del panel girando para siempre; el respaldo se reintenta en la
      // proxima carga.
      var syncKey = result.previousUsernameKey || usernameKey;
      await boundCloudSync(
        checkAvailability().then(function (ok) {
          if (ok) return syncStudentProfileToFirebase(syncKey, result.user);
        })
      );
    }
    return result;
  };

  // ── Activar / desactivar aprendiz ─────────────────────────────────────────────
  // updateStudentStatus del portal es SINCRONO y solo escribia en localStorage,
  // asi que el cambio de estado desaparecia al recargar (fetchStudentsWithProgress
  // relee los usuarios desde Firebase). Aqui persistimos el estado a la nube en
  // segundo plano (fire-and-forget) para que sobreviva a recargas y se vea en
  // otros dispositivos. Se mantiene el retorno SINCRONO: el llamador del panel
  // hace `const result = auth.updateStudentStatus(...)` sin await.
  var prevUpdateStudentStatus = auth.updateStudentStatus;
  auth.updateStudentStatus = function (usernameKey, active) {
    if (typeof prevUpdateStudentStatus !== "function") {
      return { ok: false, message: "El cambio de estado no esta disponible." };
    }
    var result = prevUpdateStudentStatus.call(auth, usernameKey, active);
    if (result && result.ok && result.user) {
      var syncUser = result.user;
      checkAvailability().then(function (ok) {
        if (ok) return cloudSaveUser(syncUser);
      }).catch(function () { /* silencioso: se reintenta en la proxima carga */ });
    }
    return result;
  };

  // ── Reiniciar una guia ────────────────────────────────────────────────────────
  auth.resetStudentGuideProgress = async function (usernameKey, fileName) {
    var result = await prev.resetStudentGuideProgress.call(auth, usernameKey, fileName);
    checkAvailability().then(function (ok) {
      if (ok) cloudClearProgressEntry(usernameKey, fileName).catch(function () {});
    });
    return result;
  };

  // ── Reiniciar todo el avance ──────────────────────────────────────────────────
  auth.resetStudentAllProgress = async function (usernameKey) {
    var result = await prev.resetStudentAllProgress.call(auth, usernameKey);
    checkAvailability().then(function (ok) {
      if (ok) cloudClearAllProgress(usernameKey).catch(function () {});
    });
    return result;
  };

  // ── Panel administrativo: listar usuarios con avance ─────────────────────────
  // Lee de Firebase cuando esta disponible. Incluye usuarios que solo esten
  // en localStorage (los sube automaticamente a Firebase).
  auth.fetchStudentsWithProgress = async function () {
    var available = await checkAvailability();
    if (!available) return prev.fetchStudentsWithProgress.call(auth);

    try {
      var cloudUsers = await cloudListUsers();

      // Buscar usuarios locales que no esten en Firebase y subirlos
      if (auth.getUsers) {
        var cloudKeys  = {};
        cloudUsers.forEach(function (u) { cloudKeys[u.usernameKey] = true; });
        auth.getUsers().forEach(function (localUser) {
          if (!cloudKeys[localUser.usernameKey]) {
            cloudSaveUser(localUser).catch(function () {});
          }
        });
      }

      // Si Firebase no tiene usuarios aun, usar los locales
      if (!cloudUsers || cloudUsers.length === 0) {
        return prev.fetchStudentsWithProgress.call(auth);
      }

      // Obtener el progreso de todos los usuarios en una sola solicitud (batchGet)
      var usernames   = cloudUsers.map(function (u) { return u.usernameKey; });
      var progressDocs = await fsBatchGet(COL_PROGRESS, usernames);

      var progressByUser       = {};

      progressDocs.forEach(function (doc) {
        if (doc && doc._docId) {
          progressByUser[doc._docId] = doc;
          progressByUser[decodeURIComponent(doc._docId)] = doc;
        }
        if (doc && doc._usernameKey) {
          progressByUser[doc._usernameKey] = doc;
        }
      });

      cloudUsers.forEach(function (u) {
        if (!progressByUser[u.usernameKey]) {
          progressByUser[u.usernameKey] = {};
        }
      });

      var guideDataRequests = [];
      cloudUsers.forEach(function (user) {
        auth.getGuidesForFicha(user.ficha || "").forEach(function (fileName) {
          var progressKey = fileNameToKey(fileName);
          var entry = progressByUser[user.usernameKey] && progressByUser[user.usernameKey][progressKey];
          if (entry && Number(entry.total) > 0) return;
          guideDataRequests.push({
            usernameKey: user.usernameKey,
            fileName: fileName,
            progressKey: progressKey,
            docId: guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "student:" + user.usernameKey, guideDataFileName(fileName)),
          });
        });
      });

      if (guideDataRequests.length) {
        var guideDataDocIds = guideDataRequests.map(function (item) { return item.docId; });
        var guideDataDocs = await fsBatchGet(COL_PROGRESS, guideDataDocIds);
        // Las respuestas del aprendiz pueden quedar en COL_GUIDE_STATE cuando la
        // escritura con docId compuesto a COL_PROGRESS fue rechazada por reglas
        // (403). Por eso el admin tambien lee guide_state y lo usa para rellenar
        // lo que falte. COL_PROGRESS tiene precedencia si trae el documento.
        var guideStateDocs = await fsBatchGet(COL_GUIDE_STATE, guideDataDocIds);
        var guideDataByDocId = {};
        guideDataDocs.forEach(function (doc) {
          if (doc && doc._docId) {
            guideDataByDocId[decodeURIComponent(doc._docId)] = doc;
            guideDataByDocId[doc._docId] = doc;
          }
        });
        guideStateDocs.forEach(function (doc) {
          if (doc && doc._docId) {
            var decodedStateId = decodeURIComponent(doc._docId);
            if (!guideDataByDocId[decodedStateId]) guideDataByDocId[decodedStateId] = doc;
            if (!guideDataByDocId[doc._docId]) guideDataByDocId[doc._docId] = doc;
          }
        });
        guideDataRequests.forEach(function (item) {
          var doc = guideDataByDocId[item.docId];
          var derived = deriveProgressFromGuideDataDoc(item.fileName, doc);
          if (!derived) return;
          if (!progressByUser[item.usernameKey]) {
            progressByUser[item.usernameKey] = {};
          }
          progressByUser[item.usernameKey][item.progressKey] = derived;
        });
      }

      // Construir el array final con avance por guia
      var result = cloudUsers.map(function (user) {
        var progMap = progressByUser[user.usernameKey] || {};
        var guides  = auth.getGuidesForFicha(user.ficha || "").map(function (fileName) {
          var key   = fileNameToKey(fileName);
          var entry = progMap[key] || {};
          // Si el aprendiz AUN no ha abierto/guardado esta guia, no hay entry.total
          // (0). Sin este fallback, esa guia quedaba en "0/0" y NO restaba del %
          // general (el denominador la ignoraba por completo) -> un aprendiz que
          // termino UNA guia de 4 aparecia con 100% general. Se usa el total FIJO
          // de GUIDE_PROGRESS_CONFIG como denominador real de esa guia.
          var config = auth.GUIDE_PROGRESS_CONFIG && auth.GUIDE_PROGRESS_CONFIG[fileName];
          var configTotal = Math.max(0, Number(config && config.total) || 0);
          var tot   = Math.max(0, Number(entry.total) || 0) || configTotal;
          var comp  = Math.min(Math.max(0, Number(entry.completed) || 0), tot);
          var pct   = tot ? Math.round((comp / tot) * 100) : 0;
          return {
            fileName:  fileName,
            title:     auth.getGuideTitle(fileName),
            completed: comp,
            total:     tot,
            percent:   pct,
            updatedAt: entry.updatedAt || "",
            source:    "network",
          };
        });

        var totalComp  = guides.reduce(function (s, g) { return s + g.completed; }, 0);
        var totalItems = guides.reduce(function (s, g) { return s + g.total; }, 0);

        return Object.assign({}, user, {
          progress: {
            guides:    guides,
            completed: totalComp,
            total:     totalItems,
            percent:   totalItems ? Math.round((totalComp / totalItems) * 100) : 0,
          },
        });
      });

      // Sincronizar a localStorage como efecto secundario
      result.forEach(function (u) { upsertLocalUser(u); });

      return result.sort(function (a, b) {
        return String(a.fullName || "").localeCompare(String(b.fullName || ""), "es");
      });
    } catch (e) {
      return prev.fetchStudentsWithProgress.call(auth);
    }
  };

  // ── Contexto de almacenamiento ────────────────────────────────────────────────
  auth.getStorageContext = async function () {
    var ok = await checkAvailability();
    if (ok) {
      return {
        mode:    "firebase",
        message: "Panel conectado a Firebase. Los usuarios y avances se sincronizan automaticamente en todos los equipos.",
      };
    }
    if (typeof prev.getStorageContext === "function") {
      return prev.getStorageContext.call(auth);
    }
    return {
      mode:    "local",
      message: "Firebase no esta configurado. Solo se ven los datos guardados en este navegador.",
    };
  };

  // ── Estado del almacen compartido ─────────────────────────────────────────────
  auth.getSharedStoreStatus = async function (force) {
    if (force) availabilityCache = null;
    var ok = await checkAvailability();
    if (ok) {
      return { available: true, source: "firebase", checkedAt: new Date().toISOString() };
    }
    if (typeof prev.getSharedStoreStatus === "function") {
      return prev.getSharedStoreStatus.call(auth, force);
    }
    return { available: false, source: "local", checkedAt: new Date().toISOString() };
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  INICIALIZACION
  //  Al cargar la pagina, si hay un estudiante con sesion activa, se restauran
  //  sus datos desde Firebase (util cuando cambia de equipo).
  // ════════════════════════════════════════════════════════════════════════════
  window.setTimeout(async function () {
    if (!isConfigured) return;
    try {
      var ok = await checkAvailability();
      var session = auth.getCurrentSession();
      if (!session || session.role !== "student" || !session.user || !session.user.usernameKey) return;
      var usernameKey = session.user.usernameKey;
      var ficha       = session.user.ficha;

      if (ok) {
        // Verificar si el usuario ya existe en Firebase
        var cloudUser = await cloudGetUser(usernameKey);
        if (!cloudUser) {
          // No esta en Firebase: subir desde localStorage
          try {
            var raw = localStorage.getItem(LOCAL_USERS_KEY);
            var localUsers = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];
            var localUser = localUsers.find(function (u) { return u.usernameKey === usernameKey; });
            if (localUser) {
              await cloudSaveUser(localUser);
              console.info("[firebase_db] Usuario subido a Firebase en carga de pagina: " + localUser.username);
            }
          } catch (e2) { /* silencioso */ }
        } else {
          // Ya esta en Firebase: restaurar datos al localStorage (cambio de equipo)
          await restoreStudentFromCloud(usernameKey, ficha);
        }
      } else {
        console.info("[firebase_db] Firebase no disponible en carga. Usando datos locales.");
      }
    } catch (e) { /* silencioso */ }
  }, 500);

  // ── Backfill Firestore → Drive (migracion one-shot) ─────────────────────────
  // Copia los docs de cada coleccion a Drive para que el modo Drive primario
  // (y el failover) tengan datos. Lee Firestore DIRECTAMENTE (sin gate, con
  // paginacion) y escribe a Drive directamente. Ejecutar UNA vez con Firestore
  // disponible (no bloqueado). Idempotente: re-ejecutar solo sobreescribe.
  async function firestoreListDirect(collection) {
    var allDocs = [];
    var pageToken = "";
    try {
      do {
        var url = BASE_URL + "/" + collection + "?key=" + FIREBASE_API_KEY + "&pageSize=300";
        if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
        var res = await fetchWithTimeout(
          url,
          { method: "GET", cache: "no-store", headers: await authHeaders() },
          API_TIMEOUT_MS
        );
        if (!res.ok) break;
        var payload = await res.json();
        var docs = (payload.documents || []).map(fromFsDoc).filter(Boolean);
        allDocs = allDocs.concat(docs);
        pageToken = payload.nextPageToken || "";
      } while (pageToken && allDocs.length < 5000);
    } catch (_) {}
    return allDocs;
  }

  async function backfillToDrive(options) {
    var opts = options || {};
    var onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (!isDriveFallbackEnabled()) {
      return { ok: false, message: "Drive no configurado (falta respaldoFirestoreUrl)." };
    }
    // Por defecto migra TODAS las colecciones (datos + cuenta) para que el
    // failover funcione completo. Se puede limitar con opts.collections.
    var allCollections = [
      COL_USERS, COL_USER_AUTH, COL_USER_META,
      COL_PROGRESS, COL_GUIDE_STATE, COL_CALENDAR, COL_GROUPS, COL_TUTORING,
    ];
    var collections = Array.isArray(opts.collections) && opts.collections.length
      ? opts.collections
      : allCollections;
    var report = { ok: true, collections: {}, totalWritten: 0, errors: 0 };
    for (var c = 0; c < collections.length; c++) {
      var collection = collections[c];
      var docs = await firestoreListDirect(collection);
      var written = 0;
      for (var i = 0; i < docs.length; i++) {
        var doc = docs[i];
        var docId = doc._docId;
        if (!docId) continue;
        var clean = Object.assign({}, doc);
        delete clean._docId;
        delete clean._docName;
        var ok = false;
        try { ok = await window.driveDb.set(collection, docId, clean); } catch (_) { ok = false; }
        if (ok) { written++; report.totalWritten++; } else { report.errors++; }
        if (onProgress) onProgress({ collection: collection, done: i + 1, total: docs.length, written: written });
      }
      report.collections[collection] = { found: docs.length, written: written };
      console.info("[backfill] " + collection + ": " + written + "/" + docs.length + " copiados a Drive");
    }
    console.info("[backfill] Completado. Escritos: " + report.totalWritten + ", errores: " + report.errors);
    return report;
  }

  // API de depuracion (solo disponible en consola del navegador)
  window._firebaseDb = {
    checkAvailability: checkAvailability,
    backfillToDrive:   backfillToDrive,
    cloudGetCalendar:  cloudGetCalendar,
    cloudSaveCalendar: cloudSaveCalendar,
    cloudGetGuideData: cloudGetGuideData,
    cloudSaveGuideData: cloudSaveGuideData,
    adminApplySolutionToGuide: adminApplySolutionToGuide,
    adminMarkActivityDelivered: adminMarkActivityDelivered,
    cloudGetGrades: cloudGetGrades,
    cloudSaveGrades: cloudSaveGrades,
    cloudGetSignatureAuth: cloudGetSignatureAuth,
    cloudSaveSignatureAuth: cloudSaveSignatureAuth,
    cloudGetGradeSolutions: cloudGetGradeSolutions,
    cloudSaveGradeSolutions: cloudSaveGradeSolutions,
    cloudGetImprovementPlans: cloudGetImprovementPlans,
    cloudSaveImprovementPlans: cloudSaveImprovementPlans,
    mergeGuideDataSnapshotForSave: mergeGuideDataSnapshotForSave,
    cloudGetGuideUiState: cloudGetGuideUiState,
    cloudSaveGuideUiState: cloudSaveGuideUiState,
    cloudListTutoringBookings:        cloudListTutoringBookings,
    cloudListTutoringBookingsForDate: cloudListTutoringBookingsForDate,
    cloudGetTutoringBooking:          cloudGetTutoringBooking,
    cloudSaveTutoringBooking:         cloudSaveTutoringBooking,
    cloudDeleteTutoringBooking:       cloudDeleteTutoringBooking,
    cloudGetGroup:            cloudGetGroup,
    cloudSaveGroup:           cloudSaveGroup,
    cloudUpdateGroupDelivery: cloudUpdateGroupDelivery,
    cloudGetUserAuth:         cloudGetUserAuth,
    cloudSaveUserAuth:        cloudSaveUserAuth,
    cloudListUsersByFicha:    cloudListUsersByFicha,
    cloudSaveUserIndex:       cloudSaveUserIndex,
    cloudGetAuthVersion:      cloudGetAuthVersion,
    cloudSaveAuthVersion:     cloudSaveAuthVersion,
    shouldDeferCloudReads: shouldDeferCloudReads,
    shouldSkipGuideUiCloudSave: shouldSkipGuideUiCloudSave,
    getBudgetStatus:    getFirestoreBudgetStatus,
    isConfigured:      function () { return isConfigured; },
    getMode:           function () { return isConfigured ? "firebase" : "safe-local"; },
    resetCache:        function () { availabilityCache = null; },
  };

  if (isConfigured) {
    console.info("[firebase_db] Sincronizacion cloud habilitada desde configuracion runtime.");
  } else {
    console.info("[firebase_db] Sincronizacion cloud deshabilitada por seguridad. Se usa almacenamiento local o red.");
  }
})();
