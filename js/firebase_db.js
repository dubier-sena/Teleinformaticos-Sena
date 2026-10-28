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
  var COL_GRADE_COMMENTS = "sena_portal_grade_comments";
  var COL_IMPROVEMENT_PLANS = "sena_portal_improvement_plans";
  var COL_REINFORCEMENT_WORKSHOPS = "sena_portal_reinforcement_workshops";
  var COL_REINFORCEMENT_ANSWERS = "sena_portal_reinforcement_answers";
  var COL_SIGNATURE_AUTH = "sena_portal_signature_auth";
  var COL_STUDENT_SUMMARY = "sena_portal_student_summary";
  // Seguimiento academico del Laboratorio Virtual (LOOP seguimiento, sep-29):
  // un documento INMUTABLE por intento. Ver js/hardware_lab_attempts.js.
  var COL_HWLAB_ATTEMPTS = "sena_portal_hwlab_attempts";
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
      _updateTime: doc.updateTime || "",
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
  async function canCallFirestore(collection, isWrite, opts) {
    if (!isConfigured) return false;
    // opts.firestoreFirst: lecturas puntuales de docs COMPARTIDOS de bajo
    // volumen (hoy: el doc de fechas de entrega) van a Firestore aunque el
    // ruteo Drive-primario este activo. El admin escribe fechas en Firestore
    // de forma sincrona, asi que leer ahi garantiza que el aprendiz vea el
    // cambio (fecha nueva, movida o ELIMINADA) al instante, sin depender de
    // que la replica de Drive este al dia. Drive queda como failover (cooldown,
    // red caida) por los caminos normales de fsGet.
    var bypassDriveRouting = Boolean(opts && opts.firestoreFirst);
    if (!isWrite && !bypassDriveRouting && isForceDriveEnabled() && isDriveDataCollection(collection)) return false;
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

  // Estados HTTP transitorios: el servicio esta ocupado/caido momentaneamente,
  // no es un rechazo de auth ni un rechazo permanente (400 = documento mal
  // formado, no se arregla reintentando). Antes solo 401/403 y las excepciones
  // de red (fetch que lanza) activaban el respaldo a Drive; un 500/503 de
  // Firestore o un 429 de cuota hacian que fsPatch devolviera `false` sin mas
  // -- perdida silenciosa de sincronizacion (auditoria 2026-08-22, Fase 7).
  function isTransientHttpStatus(status) {
    return status === 408 || status === 429 || status === 500 ||
      status === 502 || status === 503 || status === 504;
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
        var dataToPromote = op.data;
        // Fase 10 (auditoria profunda): promover a ciegas el `data`
        // capturado en el momento de la caida de Firestore reemplazaria por
        // COMPLETO cualquier campo que OTRO dispositivo ya haya promovido
        // mientras tanto -- dos dispositivos, cada uno con su propia cola
        // pendiente en su propio localStorage, pueden promover el MISMO
        // docId en cualquier orden (uno mientras el otro sigue pendiente,
        // o ambos casi al mismo tiempo al recuperar conexion). Para
        // snapshots de guia (con snapshotJson) se relee el estado ACTUAL de
        // Firestore justo antes de promover y se combina con el mismo merge
        // por timestamp/campo que ya protege el guardado online normal
        // (mergeGuideDataSnapshotForSave) -- asi, sin importar el orden de
        // promocion entre dispositivos, ningun campo del otro se pierde.
        if (op.data && typeof op.data.snapshotJson === "string") {
          try {
            var currentRes = await fetchWithTimeout(
              docUrl(op.collection, op.docId),
              { method: "GET", headers: await authHeaders() },
              API_TIMEOUT_MS
            );
            if (currentRes.ok) {
              var currentDoc = fromFsDoc(await currentRes.json());
              if (currentDoc && typeof currentDoc.snapshotJson === "string") {
                var existingSnapshot = JSON.parse(currentDoc.snapshotJson);
                var incomingSnapshot = JSON.parse(op.data.snapshotJson);
                var mergedSnapshot = mergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot);
                dataToPromote = Object.assign({}, op.data, {
                  snapshotJson: JSON.stringify(mergedSnapshot),
                  updatedAt: mergedSnapshot.updatedAt || op.data.updatedAt,
                });
              }
            }
          } catch (mergeError) {
            // JSON corrupto o fallo de lectura: se promueve el data original
            // tal cual -- mejor promover algo que nada, y el proximo ciclo
            // de sincronizacion normal ya corrige por timestamp.
          }
        }
        var res = await fetchWithTimeout(
          docUrl(op.collection, op.docId),
          {
            method: "PATCH",
            headers: await authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(toFsDoc(dataToPromote)),
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

  // SIEMPRE registrar la promocion Drive→Firestore. En el patron "replica de
  // lectura" (useDriveAsPrimary con ruteo por coleccion), las ESCRITURAS deben
  // llegar a Firestore porque es la UNICA fuente que lee el panel admin. La
  // version anterior exceptuaba las colecciones de datos en force-drive
  // ("Drive es el destino final"), lo que contradecia ese patron: cualquier
  // guardado que caia a Drive (cooldown, red, 403) quedaba INVISIBLE para el
  // admin de forma permanente. Ver tests/firebase_db_admin_reads.test.cjs.
  function shouldRecordPromotion(collection) {
    void collection;
    return true;
  }

  async function driveFallbackGet(collection, docId) {
    if (!isDriveFallbackEnabled()) return null;
    try { return await window.driveDb.get(collection, docId); } catch (_) { return null; }
  }

  // Igual que driveFallbackGet pero conservando POR QUE no hay dato:
  //   "found" | "missing" (la replica respondio y no lo tiene) | "unavailable"
  //   (la replica no respondio: 404/5xx/timeout del Apps Script).
  // Distinguir "missing" de "unavailable" es lo que evita que una caida de la
  // replica se propague como "documento vacio" hasta el merge del guardado.
  async function driveFallbackGetDetailed(collection, docId) {
    if (!isDriveFallbackEnabled()) return { status: "unavailable", data: null };
    try {
      if (typeof window.driveDb.getDetailed === "function") {
        var detailed = await window.driveDb.getDetailed(collection, docId);
        if (detailed && typeof detailed.status === "string") return detailed;
      }
      // drive_db.js antiguo (sin getDetailed): se degrada al contrato viejo.
      var data = await window.driveDb.get(collection, docId);
      return data ? { status: "found", data: data } : { status: "missing", data: null };
    } catch (_) {
      return { status: "unavailable", data: null };
    }
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
    if (!(await canCallFirestore(collection, false, opts))) {
      // Ruteo Drive-primario (useDriveAsPrimary): la lectura va a la replica.
      var replica = await driveFallbackGetDetailed(collection, docId);
      if (replica.status !== "unavailable") return replica.data;
      // La replica NO respondio. Devolver null aqui equivaldria a afirmar que
      // el documento no existe, y esa afirmacion viaja hasta
      // cloudSaveGuideDataImpl, que entonces guarda el estado local SIN
      // fusionar y reemplaza en Firestore lo que este dispositivo no tenga.
      // Antes de eso se consulta la fuente de verdad. `firestoreFirst` salta
      // UNICAMENTE el ruteo a Drive: el resto de condiciones (configuracion,
      // cooldown, sesion Firebase hidratada con uid) se siguen exigiendo, asi
      // que si Firestore tampoco esta disponible se devuelve null como antes.
      var directOpts = Object.assign({}, opts || {}, { firestoreFirst: true });
      if (!(await canCallFirestore(collection, false, directOpts))) return null;
      // Ya sabemos que la replica no responde: si Firestore contesta 404 no
      // tiene sentido volver a preguntarle (seria otra espera de hasta 15 s).
      skipDriveOn404 = true;
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "[firebase_db] La replica de Drive no respondio; se lee de Firestore para no confundir la caida con un documento vacio.",
          collection, docId
        );
      }
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
        if (isTransientHttpStatus(res.status)) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[firebase_db] fsGet: Firestore respondio " + res.status + " (transitorio), usando respaldo Drive.", collection, docId);
          }
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

  // Firestore REST devuelve FAILED_PRECONDITION (o ABORTED) cuando un PATCH
  // lleva `currentDocument.updateTime` y el documento fue escrito por OTRO
  // proceso desde que lo leimos -- exactamente la señal que necesitamos para
  // distinguir "conflicto real, hay que releer y reintentar" de "fallo de
  // red/permiso, cae a Drive" (ver cloudSaveGuideDataImpl). Se lee el cuerpo
  // en vez de confiar solo en el codigo HTTP porque 400/409 tambien pueden
  // significar otra cosa (esto solo se evalua cuando el llamador PIDIO la
  // precondicion, asi que nunca cambia el comportamiento de nadie mas).
  async function isFirestorePreconditionConflict(res) {
    try {
      var body = await res.json();
      var status = body && body.error && body.error.status;
      return status === "FAILED_PRECONDITION" || status === "ABORTED";
    } catch (e) {
      return false;
    }
  }

  // PATCH (upsert completo) de un documento. `opts.expectedUpdateTime`
  // (opcional, solo lo usa cloudSaveGuideDataImpl) agrega la precondicion
  // optimista de Firestore: si el documento cambio desde que lo leimos, esta
  // llamada devuelve el string "conflict" en vez de true/false para que el
  // llamador releа y reintente su merge, en lugar de pisar a ciegas lo que el
  // otro proceso acaba de guardar. Sin ese campo, el comportamiento es
  // IDENTICO al de antes (ningun otro llamador de fsPatch pasa opts).
  async function fsPatch(collection, docId, data, opts) {
    if (shouldBlockCloudWrites()) {
      return await driveFallbackSet(collection, docId, data);
    }
    if (!(await canCallFirestore(collection, true))) {
      return await driveFallbackSet(collection, docId, data);
    }
    var expectedUpdateTime = opts && opts.expectedUpdateTime;
    try {
      var url = docUrl(
        collection,
        docId,
        expectedUpdateTime ? ("currentDocument.updateTime=" + encodeURIComponent(expectedUpdateTime)) : null
      );
      var res = await fetchWithTimeout(
        url,
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
      if (expectedUpdateTime && (res.status === 400 || res.status === 409) && (await isFirestorePreconditionConflict(res))) {
        return "conflict";
      }
      if (isAuthRejection(res.status)) {
        markFirestoreRejection();
        return await driveFallbackSet(collection, docId, data);
      }
      if (isTransientHttpStatus(res.status)) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[firebase_db] fsPatch: Firestore respondio " + res.status + " (transitorio), usando respaldo Drive.", collection, docId);
        }
        return await driveFallbackSet(collection, docId, data);
      }
      return false;
    } catch (e) {
      return await driveFallbackSet(collection, docId, data);
    }
  }

  // ── Lectura/escritura ESTRICTAS (Etapa Productiva + Agenda, 2026-09-25) ────
  // fsGet/fsPatch estan pensados para "que el guardado nunca se pierda": ante
  // cualquier falla caen a la replica de Drive y fsGet devuelve null tanto si
  // el documento no existe como si la lectura fallo. Para una escritura de
  // LISTA COMPLETA (leer -> agregar/quitar por id -> escribir todo) esa
  // ambigüedad es exactamente lo que borraba datos: lectura fallida -> "no hay
  // nada" -> se escribe solo el elemento nuevo encima de todo lo demas.
  // Estas dos funciones NO tienen failover a Drive y distinguen los tres
  // casos, para que el llamador pueda cumplir "lectura fallida = cero
  // escrituras" y detectar conflictos con la precondicion de Firestore.

  // -> { status: "found"|"missing"|"error", data, updateTime }
  // opts.noCooldown: un 401/403 de ESTA lectura no activa la pausa global de
  // 60 s (markFirestoreRejection). Para colecciones cuya regla puede no estar
  // desplegada (banco de comentarios): su 403 no significa que la sesion este
  // rota y no debe dejar al resto del panel sin Firestore.
  async function fsGetStrict(collection, docId, opts) {
    var noCooldown = Boolean(opts && opts.noCooldown);
    if (!(await canCallFirestore(collection, false, { firestoreFirst: true }))) {
      return { status: "error", data: null, updateTime: "", reason: "unavailable" };
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
        return { status: "missing", data: null, updateTime: "" };
      }
      if (!res.ok) {
        if (isAuthRejection(res.status) && !noCooldown) markFirestoreRejection();
        return { status: "error", data: null, updateTime: "", reason: "http-" + res.status };
      }
      var payload = await res.json();
      registerFirestoreOperation("read", 1);
      markFirestoreSuccess();
      var data = fromFsDoc(payload);
      return { status: "found", data: data || {}, updateTime: (payload && payload.updateTime) || "" };
    } catch (e) {
      return { status: "error", data: null, updateTime: "", reason: "network" };
    }
  }

  // Estados de Firestore que significan "la precondicion no se cumplio":
  // updateTime distinto, o exists=false sobre un documento que ya existe.
  async function isStrictPreconditionConflict(res) {
    try {
      var body = await res.json();
      var status = body && body.error && body.error.status;
      return status === "FAILED_PRECONDITION" || status === "ABORTED" || status === "ALREADY_EXISTS";
    } catch (e) {
      return false;
    }
  }

  // PATCH solo-Firestore con precondicion OBLIGATORIA:
  //   opts.expectedUpdateTime -> el documento no cambio desde que se leyo;
  //   opts.mustNotExist       -> el documento todavia no existe.
  // opts.updateMask (opcional): lista de rutas de campo de PRIMER nivel o
  // anidadas (p.ej. ["usernameKey", "grades.`guia-02`"]) -- solo esas rutas se
  // reemplazan y el resto del documento queda intacto en el servidor. Sin
  // ella el PATCH reemplaza el documento completo, como antes.
  // -> { status: "ok"|"conflict"|"error", updateTime }
  // "error" es AMBIGUO a proposito (p.ej. timeout: Firestore pudo haber
  // aplicado la escritura igual) -- el llamador debe verificar releyendo.
  async function fsPatchStrict(collection, docId, data, opts) {
    var expectedUpdateTime = opts && opts.expectedUpdateTime;
    var mustNotExist = Boolean(opts && opts.mustNotExist);
    var updateMask = opts && Array.isArray(opts.updateMask) ? opts.updateMask : null;
    // opts.maskOnly: escritura SIN precondicion, permitida solo con updateMask.
    // Es segura cuando cada ruta de la mascara es un dato que este cliente
    // acaba de cambiar (p.ej. un campo de respuesta): no depende de ninguna
    // lectura previa y no toca nada fuera de la mascara.
    var maskOnly = Boolean(opts && opts.maskOnly && updateMask && updateMask.length);
    if (!expectedUpdateTime && !mustNotExist && !maskOnly) {
      return { status: "error", updateTime: "", reason: "missing-precondition" };
    }
    if (shouldBlockCloudWrites()) {
      return { status: "error", updateTime: "", reason: "write-budget" };
    }
    if (!(await canCallFirestore(collection, true))) {
      return { status: "error", updateTime: "", reason: "unavailable" };
    }
    var precondition = expectedUpdateTime
      ? "currentDocument.updateTime=" + encodeURIComponent(expectedUpdateTime)
      : (mustNotExist ? "currentDocument.exists=false" : "");
    if (updateMask && updateMask.length) {
      precondition += updateMask.map(function (fieldPath) {
        return "&updateMask.fieldPaths=" + encodeURIComponent(fieldPath);
      }).join("");
    }
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId, precondition),
        {
          method: "PATCH",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(toFsDoc(data)),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) {
        registerFirestoreOperation("write", 1);
        markFirestoreSuccess();
        var written = null;
        try { written = await res.json(); } catch (_) { written = null; }
        // Con updateMask `data` es solo un FRAGMENTO: el respaldo de Drive usa
        // "set" (reemplaza la copia), asi que enviarlo la dejaria incompleta.
        if (!(updateMask && updateMask.length)) backupWriteToDrive(collection, docId, data);
        return { status: "ok", updateTime: (written && written.updateTime) || "" };
      }
      if ((res.status === 400 || res.status === 409 || res.status === 412) && (await isStrictPreconditionConflict(res))) {
        return { status: "conflict", updateTime: "" };
      }
      if (isAuthRejection(res.status)) markFirestoreRejection();
      return { status: "error", updateTime: "", reason: "http-" + res.status };
    } catch (e) {
      return { status: "error", updateTime: "", reason: "network" };
    }
  }

  // Escritura condicionada via :commit (2026-10-27). Misma interfaz que
  // fsPatchStrict pero con la precondicion en el CUERPO de la escritura:
  //   currentDocument.updateTime / currentDocument.exists=false.
  // Motivo: el emulador oficial de Firestore (v1.21) IGNORA la precondicion
  // cuando viaja como parametro de la URL de un PATCH (la lee como "version
  // 0" y rechaza toda escritura sobre un documento existente), mientras que en
  // :commit la respeta. :commit es el mecanismo canonico que usan los SDK, asi
  // que se comporta igual en el emulador y en produccion y se puede verificar.
  // opts.updateMask: rutas a escribir (el resto del documento no se toca).
  // opts.backupData: documento COMPLETO para el respaldo en Drive (que usa
  //   "set" y reemplaza la copia); sin el, una escritura parcial no se respalda.
  // opts.noCooldown: un 401/403 no activa la pausa global.
  // -> { status: "ok"|"conflict"|"error", updateTime, reason }
  async function fsCommitStrict(collection, docId, data, opts) {
    var expectedUpdateTime = opts && opts.expectedUpdateTime;
    var mustNotExist = Boolean(opts && opts.mustNotExist);
    var updateMask = opts && Array.isArray(opts.updateMask) ? opts.updateMask : null;
    var noCooldown = Boolean(opts && opts.noCooldown);
    if (!expectedUpdateTime && !mustNotExist) {
      return { status: "error", updateTime: "", reason: "missing-precondition" };
    }
    if (shouldBlockCloudWrites()) {
      return { status: "error", updateTime: "", reason: "write-budget" };
    }
    if (!(await canCallFirestore(collection, true))) {
      return { status: "error", updateTime: "", reason: "unavailable" };
    }
    var write = {
      update: {
        name: "projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/" + collection + "/" + docId,
        fields: toFsDoc(data).fields,
      },
      currentDocument: expectedUpdateTime ? { updateTime: expectedUpdateTime } : { exists: false },
    };
    if (updateMask && updateMask.length) write.updateMask = { fieldPaths: updateMask };
    try {
      var res = await fetchWithTimeout(
        BASE_URL + ":commit?key=" + FIREBASE_API_KEY,
        {
          method: "POST",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ writes: [write] }),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) {
        registerFirestoreOperation("write", 1);
        markFirestoreSuccess();
        var committed = null;
        try { committed = await res.json(); } catch (_) { committed = null; }
        var backup = opts && opts.backupData ? opts.backupData : (updateMask && updateMask.length ? null : data);
        if (backup) backupWriteToDrive(collection, docId, backup);
        var wr = committed && committed.writeResults && committed.writeResults[0];
        return { status: "ok", updateTime: (wr && wr.updateTime) || (committed && committed.commitTime) || "", reason: "" };
      }
      if ((res.status === 400 || res.status === 409 || res.status === 412) && (await isStrictPreconditionConflict(res))) {
        return { status: "conflict", updateTime: "", reason: "conflict" };
      }
      if (isAuthRejection(res.status) && !noCooldown) markFirestoreRejection();
      return { status: "error", updateTime: "", reason: "http-" + res.status };
    } catch (e) {
      return { status: "error", updateTime: "", reason: "network" };
    }
  }

  // Quita los metadatos que fromFsDoc agrega (_docId, _docName, _updateTime)
  // antes de volver a escribir un documento leido.
  function stripFsMeta(doc) {
    var out = {};
    Object.keys(doc || {}).forEach(function (k) {
      if (k === "_docId" || k === "_docName" || k === "_updateTime") return;
      out[k] = doc[k];
    });
    return out;
  }

  function strictRetryDelay(attempt) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, 40 * attempt + Math.floor(Math.random() * 80));
    });
  }

  var STRICT_MAX_ATTEMPTS = 4;

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
      if (isTransientHttpStatus(res.status)) {
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
      if (isTransientHttpStatus(res.status)) {
        return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
      }
      return false;
    } catch (e) {
      return await driveFallbackUpdateField(collection, docId, fieldName, fieldValue);
    }
  }

  // Lista todos los documentos de una coleccion, siguiendo nextPageToken.
  // ANTES solo pedia UNA pagina (pageSize=300, sin paginar): Firestore puede
  // devolver MENOS docs que pageSize aunque haya mas (limite de tamano de
  // respuesta), asi que el panel admin "perdia" aprendices silenciosamente.
  async function fsList(collection) {
    if (!(await canCallFirestore(collection))) {
      return await driveFallbackList(collection);
    }
    try {
      var allDocs = [];
      var pageToken = "";
      do {
        var url = BASE_URL + "/" + collection + "?key=" + FIREBASE_API_KEY + "&pageSize=300";
        if (pageToken) url += "&pageToken=" + encodeURIComponent(pageToken);
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
          // Error a mitad de paginado: devolver lo acumulado es mejor que [].
          return allDocs;
        }
        var payload = await res.json();
        var docs = (payload.documents || []).map(fromFsDoc).filter(Boolean);
        registerFirestoreOperation("read", Math.max(1, docs.length));
        allDocs = allDocs.concat(docs);
        pageToken = payload.nextPageToken || "";
      } while (pageToken && allDocs.length < 5000);
      markFirestoreSuccess();
      return allDocs;
    } catch (e) {
      return await driveFallbackList(collection);
    }
  }

  // BatchGet: obtiene multiples documentos en una sola solicitud.
  // Se trocea en lotes de 100: el barrido del panel admin puede pedir cientos
  // de docs (aprendices x guias) y una sola peticion gigante puede fallar por
  // tamano de respuesta — y el error se convertia en [] silencioso (secciones
  // vacias en el panel). Con lotes, un fallo afecta solo a su lote.
  var BATCH_GET_CHUNK_SIZE = 100;
  async function fsBatchGet(collection, docIds) {
    if (!docIds || docIds.length === 0) return [];
    if (docIds.length > BATCH_GET_CHUNK_SIZE) {
      var all = [];
      for (var chunkStart = 0; chunkStart < docIds.length; chunkStart += BATCH_GET_CHUNK_SIZE) {
        var part = await fsBatchGet(collection, docIds.slice(chunkStart, chunkStart + BATCH_GET_CHUNK_SIZE));
        all = all.concat(part);
      }
      return all;
    }
    if (!(await canCallFirestore(collection))) {
      return await driveFallbackBatchGet(collection, docIds);
    }
    var batchUrl = "https://firestore.googleapis.com/v1/projects/" +
      FIREBASE_PROJECT_ID + "/databases/(default)/documents:batchGet?key=" + FIREBASE_API_KEY;
    // Nombre LITERAL (sin encodeURIComponent): en el cuerpo de batchGet un
    // ":" codificado como "%3A" hace que Firestore busque OTRO documento y lo
    // reporte "missing" (comprobado en produccion 2026-10-22). Asi los
    // documentos __guide_data__:student:... nunca se encontraban, aunque cada
    // uno contaba como lectura.
    var docPaths = docIds.map(function (id) {
      return "projects/" + FIREBASE_PROJECT_ID +
        "/databases/(default)/documents/" + collection + "/" + id;
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
      "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html": "10a_guia4ciber.html",
      "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html": "10b_guia4ciber.html",
      "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "11a_guia.html",
      "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "11b_guia.html",
      "grupo-11a-guia-06-planificar-informacion.html": "11a_guia6.html",
      "grupo-11b-guia-06-planificar-informacion.html": "11b_guia6.html",
      "grupo-11a-guia-07-planificar-informacion-ciberseguridad.html": "11a_guia7.html",
      "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "11b_guia7.html",
      "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
      "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
      "santa-barbara-10a-guia-04-taller-integrador.html": "sb_10a_guia4.html",
      "santa-barbara-10b-guia-04-taller-integrador.html": "sb_10b_guia4.html",
      "grupo-11a-guia-09-taller-integrador.html": "11a_guia9.html",
      "grupo-11b-guia-09-taller-integrador.html": "11b_guia9.html",
      // Bloque G: mantener sincronizado con CLOUD_FILE_ALIASES en
      // js/admin_habilitacion.js (tests/admin_cloud_file_aliases.test.cjs lo
      // exige). Guias nuevas: preferir cloudFileNames en su registerGuide()
      // de guide_declarations.js en vez de agregar aqui.
      "grupo-10a-guia-05-documentar-gestion-informacion.html": "10a_guia5doc.html",
      "grupo-10b-guia-05-documentar-gestion-informacion.html": "10b_guia5doc.html",
      "grupo-11a-guia-08-documentar-gestion-informacion.html": "11a_guia8.html",
      "grupo-11b-guia-08-documentar-gestion-informacion.html": "11b_guia8.html",
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
  async function cloudSaveUserIndex(ficha, usernameKey) {
    var uid = getBridgeCurrentUid();
    if (!uid || !ficha) return false;
    if (usernameKey) {
      // Fase 5 (auditoria profunda): estampa el UID en el propio perfil
      // (sena_portal_users) para poder resolver mas tarde el uid de ESTE
      // aprendiz a partir de su usernameKey -- necesario cuando el admin
      // guarda/lee en su nombre desde otro navegador donde su sesion de
      // Firebase no esta activa (ver resolveUidForScope). Update de un solo
      // campo (fsUpdateField) para no pisar el resto del perfil. Best-effort:
      // si falla, el proximo login lo reintenta.
      var uidStamp = fsUpdateField(COL_USERS, usernameKey, "uid", uid).catch(function () { return false; });
    }
    var saved = await fsPatch(COL_USER_INDEX, uid, {
      ficha:     String(ficha),
      updatedAt: new Date().toISOString(),
    });
    // La promesa devuelta cubre TAMBIEN el uid del perfil: el login la espera
    // antes de recargar la pagina (ver settlePostLoginWrites en portal_auth.js).
    if (uidStamp) await uidStamp;
    return saved;
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
  // NO usar para calificar: cloudGetGrades devuelve {} tambien cuando la
  // lectura FALLA, y un reemplazo completo construido sobre ese {} borra en la
  // nube las notas de todas las demas guias del aprendiz (hallazgo 2026-10-23,
  // memory/respaldos/guias-2026-10-23/hallazgos). El panel usa
  // cloudUpdateGradesStrict; esta se conserva por compatibilidad.
  async function cloudSaveGrades(usernameKey, grades) {
    if (!usernameKey) return false;
    return fsPatch(COL_GRADES, usernameKey, {
      usernameKey: usernameKey,
      grades: grades && typeof grades === "object" ? grades : {},
      updatedAt: new Date().toISOString(),
    });
  }

  function isPlainGradesObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  // Lectura ESTRICTA de notas: distingue "el aprendiz no tiene notas todavia"
  // (missing) de "no se pudo leer" (error). Un documento que existe pero cuyo
  // mapa `grades` falta o no es un objeto (o alguna familia no es un objeto)
  // se trata como error "incomplete": no se sabe que habia y escribir encima
  // podria borrar algo.
  // -> { status: "found"|"missing"|"error", grades, updateTime, reason }
  async function cloudGetGradesStrict(usernameKey) {
    if (!usernameKey) return { status: "error", grades: null, updateTime: "", reason: "missing-user" };
    var r = await fsGetStrict(COL_GRADES, usernameKey);
    if (r.status === "missing") return { status: "missing", grades: {}, updateTime: "", reason: "" };
    if (r.status !== "found") return { status: "error", grades: null, updateTime: "", reason: r.reason || "unknown" };
    var grades = r.data && r.data.grades;
    var complete = isPlainGradesObject(grades) && Object.keys(grades).every(function (family) {
      return isPlainGradesObject(grades[family]);
    });
    if (!complete || !r.updateTime) {
      return { status: "error", grades: null, updateTime: "", reason: "incomplete" };
    }
    return { status: "found", grades: grades, updateTime: r.updateTime, reason: "" };
  }

  // Leer -> `mutate` -> escribir con precondicion, para calificar UNA o pocas
  // actividades. Mismas invariantes que cloudUpdateCalendarStrict:
  //   * lectura fallida/incompleta => CERO escrituras ("read-failed");
  //   * conflicto (otro equipo/pestaña escribio en medio) => se relee y se
  //     vuelve a aplicar `mutate` sobre la version nueva, max STRICT_MAX_ATTEMPTS;
  //   * `mutate(grades)` recibe una COPIA del mapa leido y devuelve
  //     { grades, families: [familias que cambio] } o { abort: "motivo" }.
  // Solo se envian las familias que `mutate` declara cambiadas (updateMask):
  // aunque algo saliera mal, las demas guias del aprendiz no viajan en la
  // escritura y no pueden quedar borradas.
  // -> { ok, status: "saved"|"read-failed"|"write-failed"|"conflict-exhausted"|"aborted", grades, reason }
  async function cloudUpdateGradesStrict(usernameKey, mutate) {
    if (!usernameKey || typeof mutate !== "function") return { ok: false, status: "aborted", grades: null, reason: "invalid-args" };
    for (var attempt = 1; attempt <= STRICT_MAX_ATTEMPTS; attempt++) {
      var current = await cloudGetGradesStrict(usernameKey);
      if (current.status === "error") return { ok: false, status: "read-failed", grades: null, reason: current.reason };
      var next = mutate(JSON.parse(JSON.stringify(current.grades || {})));
      if (!next || next.abort) return { ok: false, status: "aborted", grades: null, reason: next && next.abort };
      var families = (Array.isArray(next.families) ? next.families : []).filter(function (family, i, all) {
        return family && all.indexOf(family) === i;
      });
      if (!families.length) return { ok: true, status: "saved", grades: current.grades, reason: "no-changes" };
      var changed = {};
      for (var i = 0; i < families.length; i++) {
        var familyGrades = next.grades && next.grades[families[i]];
        if (!isPlainGradesObject(familyGrades)) return { ok: false, status: "aborted", grades: null, reason: "invalid-family" };
        changed[families[i]] = familyGrades;
      }
      var nowIso = new Date().toISOString();
      var merged = Object.assign({}, current.grades || {}, changed);
      var written = await fsCommitStrict(
        COL_GRADES,
        usernameKey,
        { usernameKey: usernameKey, grades: changed, updatedAt: nowIso },
        Object.assign(
          current.status === "found" ? { expectedUpdateTime: current.updateTime } : { mustNotExist: true },
          {
            updateMask: ["usernameKey", "updatedAt"].concat(families.map(function (family) {
              return "grades." + escapeFirestoreFieldPath(family);
            })),
            // El respaldo de Drive reemplaza su copia: se le manda el documento
            // COMPLETO ya fusionado, nunca solo las familias enviadas.
            backupData: { usernameKey: usernameKey, grades: merged, updatedAt: nowIso },
          }
        )
      );
      if (written.status === "ok") {
        return { ok: true, status: "saved", grades: merged, reason: "" };
      }
      if (written.status === "error") return { ok: false, status: "write-failed", grades: null, reason: written.reason || "unknown" };
      if (attempt < STRICT_MAX_ATTEMPTS) await strictRetryDelay(attempt);
    }
    return { ok: false, status: "conflict-exhausted", grades: null, reason: "conflict" };
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

  // ── Resumen remoto del aprendiz (Fase 11 - Home cross-device) ─────────────
  // Doc por UID (no usernameKey, ver Fase 5): { uid, usernameKey, ficha,
  // updatedAt, ...campos derivados }. Lo calcula y escribe el propio navegador
  // del aprendiz (js/student_summary.js) a partir de datos que ya puede leer;
  // nunca es fuente de verdad (ver comentario en firestore.rules). uid es
  // obligatorio: sin el no hay bajo que clave guardar ni forma de cumplir la
  // regla request.resource.data.uid == uid.
  async function cloudGetStudentSummary(uid) {
    if (!uid) return null;
    return fsGet(COL_STUDENT_SUMMARY, uid);
  }

  async function cloudSaveStudentSummary(uid, summary) {
    if (!uid) return false;
    return fsPatch(COL_STUDENT_SUMMARY, uid, Object.assign({}, summary, {
      uid: uid,
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

  // ── Banco de COMENTARIOS de calificacion (SOLO admin, rule isAdmin) ───────
  // Frases reutilizables que el instructor inserta en la observacion de una
  // actividad al calificar. NO tiene nada que ver con el banco de respuestas
  // modelo de arriba (ese guarda las soluciones de las actividades): aqui solo
  // hay texto de retroalimentacion del instructor.
  // Doc unico "bank": { comments: [ { id, texto, tipo } ], updatedAt }.
  // El aprendiz nunca lee este doc; solo ve la frase concreta que el instructor
  // dejo en SU actividad, copiada dentro de sus notas ({actId}:obs).
  async function cloudGetGradeComments() {
    var doc = await fsGet(COL_GRADE_COMMENTS, "bank");
    return doc && Array.isArray(doc.comments) ? doc.comments : [];
  }

  async function cloudSaveGradeComments(comments) {
    return fsPatch(COL_GRADE_COMMENTS, "bank", {
      comments: Array.isArray(comments) ? comments : [],
      updatedAt: new Date().toISOString(),
    });
  }

  // Variantes ESTRICTAS del banco de comentarios: cloudGetGradeComments
  // devuelve [] tambien cuando la lectura falla, y el panel interpretaba ese
  // [] como "banco vacio" -> lo sembraba y REEMPLAZABA en la nube los
  // comentarios reales del instructor.
  // -> { status: "found"|"missing"|"error", comments, updateTime, reason }
  async function cloudGetGradeCommentsStrict() {
    // noCooldown: en el ruleset desplegado 00ffe530 esta coleccion NO tiene
    // regla (cae en el cierre total) y responde 403; ese 403 no debe dejar al
    // resto del panel (las notas) sin Firestore durante 60 s.
    var r = await fsGetStrict(COL_GRADE_COMMENTS, "bank", { noCooldown: true });
    if (r.status === "missing") return { status: "missing", comments: [], updateTime: "", reason: "" };
    if (r.status !== "found") return { status: "error", comments: null, updateTime: "", reason: r.reason || "unknown" };
    if (!r.data || !Array.isArray(r.data.comments) || !r.updateTime) {
      return { status: "error", comments: null, updateTime: "", reason: "incomplete" };
    }
    return { status: "found", comments: r.data.comments, updateTime: r.updateTime, reason: "" };
  }

  // Escritura condicionada a la version leida (expectedUpdateTime) o a que el
  // banco aun no exista (mustNotExist). -> { status: "ok"|"conflict"|"error", updateTime, reason }
  async function cloudSaveGradeCommentsStrict(comments, precondition) {
    if (!Array.isArray(comments)) return { status: "error", updateTime: "", reason: "invalid-args" };
    return fsCommitStrict(COL_GRADE_COMMENTS, "bank", {
      comments: comments,
      updatedAt: new Date().toISOString(),
    }, Object.assign({}, precondition || {}, { noCooldown: true }));
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

  // ── Talleres de refuerzo (admin escribe; aprendiz lee solo el suyo) ───────
  // Doc por aprendiz: { usernameKey, workshops: [...], updatedAt }.
  async function cloudGetReinforcementWorkshops(usernameKey) {
    if (!usernameKey) return [];
    var doc = await fsGet(COL_REINFORCEMENT_WORKSHOPS, usernameKey);
    return doc && Array.isArray(doc.workshops) ? doc.workshops : [];
  }

  async function cloudSaveReinforcementWorkshops(usernameKey, workshops) {
    if (!usernameKey) return false;
    return fsPatch(COL_REINFORCEMENT_WORKSHOPS, usernameKey, {
      usernameKey: usernameKey,
      workshops: Array.isArray(workshops) ? workshops : [],
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Respuestas de talleres de refuerzo (el aprendiz escribe la suya) ──────
  // Doc por aprendiz: { usernameKey, answers: { [workshopId]: {...} }, updatedAt }.
  // Separado de cloudGetReinforcementWorkshops a proposito: ese doc guarda
  // datos autoritativos (solo-admin-escribe); este solo respuestas de texto.
  async function cloudGetReinforcementAnswers(usernameKey) {
    if (!usernameKey) return {};
    var doc = await fsGet(COL_REINFORCEMENT_ANSWERS, usernameKey);
    return doc && doc.answers && typeof doc.answers === "object" ? doc.answers : {};
  }

  async function cloudSaveReinforcementAnswers(usernameKey, answers) {
    if (!usernameKey) return false;
    return fsPatch(COL_REINFORCEMENT_ANSWERS, usernameKey, {
      usernameKey: usernameKey,
      answers: answers && typeof answers === "object" ? answers : {},
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Listas de registros por id: planes de mejoramiento y talleres (2026-10-27) ──
  // Mismo defecto que tenian las notas: cloudGetImprovementPlans /
  // cloudGetReinforcementWorkshops devuelven [] tambien cuando la lectura FALLA;
  // el modulo copiaba ese [] al cache y el siguiente cambio REEMPLAZABA la lista
  // de la nube con lo que este equipo tuviera, borrando los demas registros.
  // Aqui: lectura estricta (found / missing / error) y escritura
  // leer -> aplicar SOLO las operaciones por id -> escribir con precondicion.
  // La lista es un unico campo array de Firestore, asi que cambiar un registro
  // exige reescribir el campo; pero se reescribe sobre la version recien leida,
  // condicionado a esa version, y se rechaza si desaparece cualquier id que la
  // operacion no elimino explicitamente.
  function isRecordObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
      typeof value.id === "string" && value.id.length > 0;
  }

  // -> { status: "found"|"missing"|"error", list, updateTime, reason }
  async function cloudGetRecordListStrict(collection, docId, field) {
    if (!docId) return { status: "error", list: null, updateTime: "", reason: "missing-user" };
    var r = await fsGetStrict(collection, docId);
    if (r.status === "missing") return { status: "missing", list: [], updateTime: "", reason: "" };
    if (r.status !== "found") return { status: "error", list: null, updateTime: "", reason: r.reason || "unknown" };
    var list = r.data && r.data[field];
    if (!Array.isArray(list) || !list.every(isRecordObject) || !r.updateTime) {
      return { status: "error", list: null, updateTime: "", reason: "incomplete" };
    }
    return { status: "found", list: list, updateTime: r.updateTime, reason: "" };
  }

  // `mutate(copia)` devuelve { list, removedIds } o { abort: "motivo" }.
  // -> { ok, status: "saved"|"read-failed"|"write-failed"|"conflict-exhausted"|"aborted", list, reason }
  async function cloudUpdateRecordListStrict(collection, docId, field, mutate) {
    if (!docId || typeof mutate !== "function") return { ok: false, status: "aborted", list: null, reason: "invalid-args" };
    for (var attempt = 1; attempt <= STRICT_MAX_ATTEMPTS; attempt++) {
      var current = await cloudGetRecordListStrict(collection, docId, field);
      if (current.status === "error") return { ok: false, status: "read-failed", list: null, reason: current.reason };
      var before = current.list || [];
      var next = mutate(JSON.parse(JSON.stringify(before)));
      if (!next || next.abort) return { ok: false, status: "aborted", list: null, reason: (next && next.abort) || "aborted" };
      var list = next.list;
      if (!Array.isArray(list) || !list.every(isRecordObject)) return { ok: false, status: "aborted", list: null, reason: "invalid-list" };
      var removed = Array.isArray(next.removedIds) ? next.removedIds : [];
      var kept = {};
      list.forEach(function (rec) { kept[rec.id] = true; });
      var lost = before.filter(function (rec) { return !kept[rec.id] && removed.indexOf(rec.id) === -1; });
      if (lost.length) return { ok: false, status: "aborted", list: null, reason: "integrity" };
      if (JSON.stringify(list) === JSON.stringify(before)) {
        return { ok: true, status: "saved", list: before, reason: "no-changes" };
      }
      var data = { usernameKey: docId, updatedAt: new Date().toISOString() };
      data[field] = list;
      var written = await fsCommitStrict(
        collection,
        docId,
        data,
        Object.assign(
          current.status === "found" ? { expectedUpdateTime: current.updateTime } : { mustNotExist: true },
          { updateMask: [field, "usernameKey", "updatedAt"], backupData: data }
        )
      );
      if (written.status === "ok") return { ok: true, status: "saved", list: list, reason: "" };
      if (written.status === "error") return { ok: false, status: "write-failed", list: null, reason: written.reason || "unknown" };
      if (attempt < STRICT_MAX_ATTEMPTS) await strictRetryDelay(attempt);
    }
    return { ok: false, status: "conflict-exhausted", list: null, reason: "conflict" };
  }

  // Operaciones por registro. Todas son IDEMPOTENTES: reenviar una operacion
  // cuya escritura si se aplico (p.ej. respuesta perdida por tiempo agotado)
  // no duplica el registro ni la entrada del historial de fechas.
  //   { type: "create", record, uniqueActive: { field, value } }
  //   { type: "patch", id, set: { campo: valor } }
  //   { type: "deadline", id, fecha, cambiadoEn }
  //   { type: "delete", id }
  // -> { list, removedIds, outcome: "applied"|"exists"|"missing"|"duplicate-active" }
  function applyRecordListOp(list, op) {
    var out = list.slice();
    var idx = -1;
    var targetId = op.type === "create" ? (op.record && op.record.id) : op.id;
    for (var i = 0; i < out.length; i++) { if (out[i].id === targetId) { idx = i; break; } }
    if (op.type === "create") {
      if (idx !== -1) return { list: out, removedIds: [], outcome: "exists" };
      var unique = op.uniqueActive;
      if (unique && unique.field && out.some(function (rec) {
        return rec[unique.field] === unique.value && rec.resultado !== "A" && rec.resultado !== "D";
      })) {
        return { list: out, removedIds: [], outcome: "duplicate-active" };
      }
      out.push(JSON.parse(JSON.stringify(op.record)));
      return { list: out, removedIds: [], outcome: "applied" };
    }
    if (op.type === "delete") {
      if (idx === -1) return { list: out, removedIds: [], outcome: "missing" };
      out.splice(idx, 1);
      return { list: out, removedIds: [targetId], outcome: "applied" };
    }
    if (idx === -1) return { list: out, removedIds: [], outcome: "missing" };
    var rec = Object.assign({}, out[idx]);
    if (op.type === "patch") {
      Object.keys(op.set || {}).forEach(function (k) { if (k !== "id") rec[k] = op.set[k]; });
    } else if (op.type === "deadline") {
      rec.fechaLimite = op.fecha || "";
      var hist = Array.isArray(rec.historialFechas) ? rec.historialFechas.slice() : [];
      var seen = hist.some(function (h) { return h && h.fecha === (op.fecha || "") && h.cambiadoEn === op.cambiadoEn; });
      if (!seen) hist.push({ fecha: op.fecha || "", cambiadoEn: op.cambiadoEn });
      rec.historialFechas = hist;
      if (rec.estado === "vencido") rec.estado = "asignado";
    } else {
      return { list: out, removedIds: [], outcome: "missing" };
    }
    out[idx] = rec;
    return { list: out, removedIds: [], outcome: "applied" };
  }

  function describeCloudWriteFailure(result) {
    var reason = String((result && result.reason) || "");
    var status = String((result && result.status) || "");
    if (status === "unsupported") return "El modulo de la nube esta desactualizado. Recargue la pagina (Ctrl+F5).";
    if (status === "conflict-exhausted") return "Otro equipo esta modificando estos registros al mismo tiempo.";
    if (reason === "integrity") return "El cambio habria eliminado registros que no se pidio eliminar; no se escribio nada.";
    if (reason === "incomplete") return "Los registros guardados en la nube llegaron incompletos; no se escribio nada para no perder informacion.";
    if (reason === "http-429") return "La cuota diaria de Firestore esta agotada.";
    if (reason === "write-budget") return "Se alcanzo el limite diario de escrituras de este equipo.";
    if (reason === "http-401" || reason === "http-403") return "Firestore rechazo el permiso (la sesion no esta autorizada o expiro).";
    if (reason === "network") return "No hay conexion con Firestore.";
    if (/^http-5\d\d$/.test(reason) || reason === "http-408") return "El servidor de Firestore no respondio (falla temporal del servicio).";
    if (reason === "unavailable") return "Firestore no esta disponible (sin sesion en la nube o en pausa tras errores).";
    if (status === "read-failed") return "No se pudieron leer los registros actuales del aprendiz.";
    return "No se pudo confirmar el guardado en la nube.";
  }

  var RECORD_LIST_RETRY_DELAYS_MS = [15000, 30000, 60000, 120000, 300000];
  // Reintentos AUTOMATICOS por aprendiz antes de esperar a una accion del
  // usuario (boton, evento online o nuevo cambio): acota el consumo de cuota.
  var RECORD_LIST_MAX_AUTO_RETRIES = 8;

  // Cola persistida de operaciones por registro para un modulo (planes o
  // talleres). config: { collection, field, pendingStorageKey, eventName,
  // getCacheKey(usernameKey) }. Mismas garantias que la cola de notas
  // (activity_grades.js): lectura fallida = cero escrituras, resultado REAL
  // para la interfaz, reintento con espera creciente y sin duplicados.
  function createRecordListSync(config) {
    var cfg = config || {};
    var inFlight = {};
    var waiters = {};
    var retryTimers = {};
    var retryAttempts = {};
    var seq = 0;

    function loadPending() {
      try {
        var raw = window.localStorage.getItem(cfg.pendingStorageKey);
        var parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (e) { return {}; }
    }
    var pending = loadPending();

    function persistPending() {
      var clean = {};
      Object.keys(pending).forEach(function (user) {
        if (pending[user] && pending[user].length) clean[user] = pending[user];
      });
      pending = clean;
      try {
        if (Object.keys(clean).length) window.localStorage.setItem(cfg.pendingStorageKey, JSON.stringify(clean));
        else window.localStorage.removeItem(cfg.pendingStorageKey);
      } catch (e) { /* sin almacenamiento: la cola sigue en memoria */ }
    }

    function readCache(usernameKey) {
      var key = cfg.getCacheKey(usernameKey);
      if (!key) return [];
      try {
        var arr = JSON.parse(window.localStorage.getItem(key) || "[]");
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }

    function writeCache(usernameKey, list) {
      var key = cfg.getCacheKey(usernameKey);
      if (!key) return;
      try { window.localStorage.setItem(key, JSON.stringify(list || [])); } catch (e) { /* no critico */ }
    }

    function withPending(usernameKey, list) {
      var out = (list || []).slice();
      (pending[usernameKey] || []).forEach(function (op) { out = applyRecordListOp(out, op).list; });
      return out;
    }

    function emit(detail) {
      if (typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function" || !cfg.eventName) return;
      try { window.dispatchEvent(new CustomEvent(cfg.eventName, { detail: detail })); } catch (e) { /* no critico */ }
    }

    function settle(ops, outcome, perOp) {
      ops.forEach(function (op) {
        var list = waiters[op.opId] || [];
        delete waiters[op.opId];
        var result = Object.assign({}, outcome, { opOutcome: (perOp && perOp[op.opId]) || outcome.opOutcome || "" });
        list.forEach(function (resolve) { resolve(result); });
      });
    }

    function isRetryable(result) {
      if (!result || result.status === "aborted" || result.status === "unsupported") return false;
      return result.reason !== "incomplete" && result.reason !== "integrity";
    }

    function scheduleRetry(usernameKey) {
      if (retryTimers[usernameKey]) return;
      var attempt = retryAttempts[usernameKey] || 0;
      if (attempt >= RECORD_LIST_MAX_AUTO_RETRIES) return;
      var delay = RECORD_LIST_RETRY_DELAYS_MS[Math.min(attempt, RECORD_LIST_RETRY_DELAYS_MS.length - 1)];
      retryAttempts[usernameKey] = attempt + 1;
      if (typeof window.setTimeout !== "function") return;
      retryTimers[usernameKey] = window.setTimeout(function () {
        retryTimers[usernameKey] = null;
        flush(usernameKey);
      }, delay);
    }

    // -> Promise<{ ok, status, reason, message, pending }>
    function flush(usernameKey) {
      var ops = (pending[usernameKey] || []).slice();
      if (!ops.length) return Promise.resolve({ ok: true, status: "saved", reason: "no-changes", message: "", pending: 0 });
      if (inFlight[usernameKey]) return inFlight[usernameKey];
      var perOp = {};
      var run = cloudUpdateRecordListStrict(cfg.collection, usernameKey, cfg.field, function (list) {
        var current = list;
        var removedIds = [];
        ops.forEach(function (op) {
          var applied = applyRecordListOp(current, op);
          current = applied.list;
          removedIds = removedIds.concat(applied.removedIds);
          perOp[op.opId] = applied.outcome;
        });
        return { list: current, removedIds: removedIds };
      })
        .catch(function () { return { ok: false, status: "write-failed", reason: "exception" }; })
        .then(function (result) {
          inFlight[usernameKey] = null;
          var outcome = { ok: Boolean(result && result.ok), status: (result && result.status) || "write-failed", reason: (result && result.reason) || "" };
          if (outcome.ok) {
            var sent = ops.map(function (op) { return op.opId; });
            pending[usernameKey] = (pending[usernameKey] || []).filter(function (op) { return sent.indexOf(op.opId) === -1; });
            persistPending();
            retryAttempts[usernameKey] = 0;
            writeCache(usernameKey, withPending(usernameKey, result.list || []));
            outcome.message = "";
          } else {
            outcome.message = describeCloudWriteFailure(outcome);
            if (isRetryable(outcome)) scheduleRetry(usernameKey);
          }
          outcome.pending = (pending[usernameKey] || []).length;
          settle(ops, outcome, outcome.ok ? perOp : null);
          // Operaciones encoladas MIENTRAS esta escritura estaba en vuelo: si
          // fallo, se informa ya (quedan pendientes) en vez de dejar a la
          // interfaz esperando hasta el proximo reintento.
          if (!outcome.ok) settle(pending[usernameKey] || [], outcome, null);
          emit({ usernameKey: usernameKey, result: outcome });
          if (outcome.ok && outcome.pending) flush(usernameKey);
          return outcome;
        });
      inFlight[usernameKey] = run;
      return run;
    }

    // Encola, refleja en el cache (vista inmediata) y envia. -> Promise del resultado REAL.
    function queue(usernameKey, op) {
      if (!usernameKey || !op || !op.type) {
        return Promise.resolve({ ok: false, status: "aborted", reason: "invalid-args", message: "Faltan datos del aprendiz.", pending: 0 });
      }
      seq += 1;
      var entry = Object.assign({}, op, { opId: Date.now().toString(36) + "-" + seq, at: new Date().toISOString() });
      if (!pending[usernameKey]) pending[usernameKey] = [];
      pending[usernameKey].push(entry);
      persistPending();
      writeCache(usernameKey, applyRecordListOp(readCache(usernameKey), entry).list);
      var done = new Promise(function (resolve) { waiters[entry.opId] = [resolve]; });
      flush(usernameKey);
      return done;
    }

    function retry(usernameKey) {
      var users = usernameKey ? [usernameKey] : Object.keys(pending);
      return Promise.all(users.map(function (user) {
        if (retryTimers[user]) { window.clearTimeout(retryTimers[user]); retryTimers[user] = null; }
        retryAttempts[user] = 0;
        return flush(user);
      }));
    }

    function pendingCount(usernameKey) {
      if (usernameKey) return (pending[usernameKey] || []).length;
      return Object.keys(pending).reduce(function (n, user) { return n + pending[user].length; }, 0);
    }

    // Lectura estricta para pintar el panel. Solo found/missing tocan el cache.
    // -> Promise<{ status, list, reason, message }>
    function refresh(usernameKey) {
      return cloudGetRecordListStrict(cfg.collection, usernameKey, cfg.field)
        .catch(function () { return { status: "error", reason: "exception" }; })
        .then(function (r) {
          if (r && (r.status === "found" || r.status === "missing")) {
            var view = withPending(usernameKey, r.list || []);
            writeCache(usernameKey, view);
            return { status: r.status, list: view, reason: "", message: "" };
          }
          var failed = { status: "error", list: null, reason: (r && r.reason) || "unknown" };
          failed.message = describeCloudWriteFailure({ status: "read-failed", reason: failed.reason });
          return failed;
        });
    }

    if (typeof window.addEventListener === "function") {
      window.addEventListener("online", function () { if (pendingCount()) retry(); });
    }

    return {
      queue: queue,
      flush: flush,
      retry: retry,
      pendingCount: pendingCount,
      refresh: refresh,
      readCache: readCache,
    };
  }

  function cloudGetImprovementPlansStrict(usernameKey) {
    return cloudGetRecordListStrict(COL_IMPROVEMENT_PLANS, usernameKey, "plans");
  }
  function cloudGetReinforcementWorkshopsStrict(usernameKey) {
    return cloudGetRecordListStrict(COL_REINFORCEMENT_WORKSHOPS, usernameKey, "workshops");
  }

  // Respuestas de talleres (las escribe el APRENDIZ). Lectura estricta:
  // -> { status: "found"|"missing"|"error", answers, reason }
  async function cloudGetReinforcementAnswersStrict(usernameKey) {
    if (!usernameKey) return { status: "error", answers: null, reason: "missing-user" };
    var r = await fsGetStrict(COL_REINFORCEMENT_ANSWERS, usernameKey);
    if (r.status === "missing") return { status: "missing", answers: {}, reason: "" };
    if (r.status !== "found") return { status: "error", answers: null, reason: r.reason || "unknown" };
    var answers = r.data && r.data.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return { status: "error", answers: null, reason: "incomplete" };
    }
    return { status: "found", answers: answers, reason: "" };
  }

  // Escribe SOLO los campos de respuesta que cambiaron en UN taller
  // (answers.<taller>.<campo>), sin lectura previa: no puede borrar respuestas
  // de otros talleres ni campos que este equipo no toco, aunque su cache este
  // vacio o desactualizado. `changes` = { campo: valor }; `removedKeys` = campos
  // que el aprendiz elimino. -> { status: "ok"|"error", reason }
  async function cloudSaveReinforcementAnswerFields(usernameKey, workshopId, changes, removedKeys) {
    if (!usernameKey || !workshopId) return { status: "error", reason: "invalid-args" };
    var set = changes && typeof changes === "object" ? changes : {};
    var removed = Array.isArray(removedKeys) ? removedKeys : [];
    var keys = Object.keys(set);
    if (!keys.length && !removed.length) return { status: "ok", reason: "no-changes" };
    var answers = {};
    answers[workshopId] = set;
    var base = "answers." + escapeFirestoreFieldPath(workshopId) + ".";
    var mask = ["usernameKey", "updatedAt"].concat(keys.concat(removed).map(function (k) {
      return base + escapeFirestoreFieldPath(k);
    }));
    return fsPatchStrict(COL_REINFORCEMENT_ANSWERS, usernameKey, {
      usernameKey: usernameKey,
      answers: answers,
      updatedAt: new Date().toISOString(),
    }, { maskOnly: true, updateMask: mask });
  }

  // Optimizacion 2026-10-28: valor de progreso CONFIRMADO en la nube por
  // aprendiz+guia durante esta carga de pagina (lo que leyo
  // restoreStudentFromCloud o lo ultimo que se escribio con exito). La guia
  // llama writeGuideProgress al abrirse y tras cada guardado; si el avance no
  // cambio respecto a la nube, ya no se escribe. Una guia SIN dato conocido
  // (lectura fallida, doc ausente, aun no leido) se escribe como siempre: la
  // duda solo puede llevar a escribir, nunca a omitir un cambio.
  var _cloudProgressKnown = {};
  function rememberCloudProgress(usernameKey, key, entry) {
    if (!usernameKey || !key || !entry) return;
    var total = Number(entry.total);
    if (!Number.isFinite(total) || total <= 0) return;
    _cloudProgressKnown[usernameKey + "|" + key] = { completed: Number(entry.completed) || 0, total: total };
  }
  function cloudProgressUnchanged(usernameKey, key, completed, total) {
    var known = _cloudProgressKnown[usernameKey + "|" + key];
    return Boolean(known) && known.completed === completed && known.total === total;
  }

  // Guarda el progreso de UNA guia sin borrar el de las demas (updateMask).
  async function cloudSaveProgressEntry(usernameKey, fileName, entry) {
    if (!usernameKey || !fileName) return false;
    var key = fileNameToKey(fileName);
    var ok = await fsUpdateField(COL_PROGRESS, usernameKey, key, entry);
    if (ok === true) rememberCloudProgress(usernameKey, key, entry);
    return ok;
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
      "10a_guia4ciber.html",
      "10b_guia4ciber.html",
      "grupo-10a-guia-04-planificar-informacion-ciberseguridad.html",
      "grupo-10b-guia-04-planificar-informacion-ciberseguridad.html",
      "sb_10a_guia4.html",
      "sb_10b_guia4.html",
      "santa-barbara-10a-guia-04-taller-integrador.html",
      "santa-barbara-10b-guia-04-taller-integrador.html",
      "grupo-11a-guia-08-documentar-gestion-informacion.html",
      "grupo-11b-guia-08-documentar-gestion-informacion.html",
      "11a_guia9.html",
      "11b_guia9.html",
      "grupo-11a-guia-09-taller-integrador.html",
      "grupo-11b-guia-09-taller-integrador.html",
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

  // Version ESTRICTA de cloudGetCalendar (Agenda, 2026-09-25): mismo orden de
  // lectura (doc de respaldo en COL_PROGRESS primero, luego el canonico),
  // pero sin failover a Drive y distinguiendo "no existe" de "no se pudo
  // leer". cloudGetCalendar/cloudSaveCalendar NO cambian (las usa el
  // calendario legacy).
  // -> { status: "found"|"missing"|"error", snapshot, updateTime, source }
  function calendarDocToSnapshot(doc) {
    if (!doc) return {};
    if (typeof doc.snapshotJson === "string") {
      try { return JSON.parse(doc.snapshotJson) || {}; } catch (_) { return null; }
    }
    return stripFsMeta(doc);
  }

  async function cloudGetCalendarStrict(calendarId) {
    if (!calendarId) return { status: "error", snapshot: null, updateTime: "", source: "" };
    var fallbackId = calendarFallbackDocId(calendarId);
    var fallback = await fsGetStrict(COL_PROGRESS, fallbackId);
    if (fallback.status === "error") return { status: "error", snapshot: null, updateTime: "", source: "" };
    if (fallback.status === "found") {
      var fromFallback = calendarDocToSnapshot(fallback.data);
      if (fromFallback === null) return { status: "error", snapshot: null, updateTime: "", source: "" };
      return { status: "found", snapshot: fromFallback, updateTime: fallback.updateTime, source: "fallback" };
    }
    var canonical = await fsGetStrict(COL_CALENDAR, calendarId);
    if (canonical.status === "error") return { status: "error", snapshot: null, updateTime: "", source: "" };
    if (canonical.status === "found") {
      var fromCanonical = calendarDocToSnapshot(canonical.data);
      if (fromCanonical === null) return { status: "error", snapshot: null, updateTime: "", source: "" };
      // El doc de respaldo (destino de la precondicion) todavia no existe.
      return { status: "found", snapshot: fromCanonical, updateTime: "", source: "canonical" };
    }
    return { status: "missing", snapshot: {}, updateTime: "", source: "" };
  }

  // Leer -> aplicar `mutate` -> escribir con precondicion -> reintentar si otra
  // pestaña/equipo escribio en medio. Invariantes:
  //   * lectura fallida  => CERO escrituras (status "read-failed");
  //   * conflicto        => se relee y se vuelve a aplicar `mutate` sobre la
  //                         version nueva (nunca se pisa lo ajeno), maximo
  //                         STRICT_MAX_ATTEMPTS veces;
  //   * `mutate(state)` recibe una COPIA y devuelve el estado nuevo, o
  //     { abort: "motivo" } para no escribir nada.
  // El doc protegido por la precondicion es el de respaldo (COL_PROGRESS, el
  // que cloudGetCalendar lee primero); el canonico se actualiza despues con
  // el MISMO contenido, igual que cloudSaveCalendar.
  // -> { ok, status: "saved"|"read-failed"|"write-failed"|"conflict-exhausted"|"aborted", snapshot }
  async function cloudUpdateCalendarStrict(calendarId, mutate) {
    if (!calendarId || typeof mutate !== "function") return { ok: false, status: "aborted", snapshot: null };
    var fallbackId = calendarFallbackDocId(calendarId);
    for (var attempt = 1; attempt <= STRICT_MAX_ATTEMPTS; attempt++) {
      var current = await cloudGetCalendarStrict(calendarId);
      if (current.status === "error") return { ok: false, status: "read-failed", snapshot: null };
      var base = JSON.parse(JSON.stringify(current.snapshot || {}));
      delete base._usernameKey;
      delete base._kind;
      var next = mutate(base);
      if (!next || next.abort) return { ok: false, status: "aborted", reason: next && next.abort, snapshot: null };
      var payload = Object.assign({}, next, { calendarId: calendarId, updatedAt: new Date().toISOString() });
      var precondition = current.source === "fallback" && current.updateTime
        ? { expectedUpdateTime: current.updateTime }
        : { mustNotExist: true };
      var written = await fsPatchStrict(
        COL_PROGRESS,
        fallbackId,
        Object.assign({ _usernameKey: fallbackId, _kind: "calendar" }, payload),
        precondition
      );
      if (written.status === "ok") {
        try { await fsPatch(COL_CALENDAR, calendarId, payload); } catch (_) { /* canonico: best-effort, igual que cloudSaveCalendar */ }
        return { ok: true, status: "saved", snapshot: payload };
      }
      if (written.status === "error") return { ok: false, status: "write-failed", snapshot: null };
      if (attempt < STRICT_MAX_ATTEMPTS) await strictRetryDelay(attempt);
    }
    return { ok: false, status: "conflict-exhausted", snapshot: null };
  }

  function guideStateDocId(prefix, scopeKey, fileName) {
    return prefix + safeCloudKey(scopeKey) + ":" + fileNameToKey(fileName);
  }

  // ── Fase 5 (auditoria profunda): identidad por UID en vez de usernameKey ───
  // sena_portal_progress usa docIds compuestos donde el segmento de dueno es
  // el usernameKey SANEADO (safeCloudKey). Dos aprendices reales distintos
  // pueden sanear al mismo valor (p.ej. "eimy_alvarez" y "eimy.alvarez"), y la
  // regla de Firestore acepta AMBOS como dueños del mismo docId -- una
  // colision real, no solo teorica (ver firestore.rules, isOwnerOfComposedStudentDoc).
  // La migracion usa el UID de Firebase (unico por cuenta, nunca se sanea)
  // como nuevo segmento de dueno: "__guide_data__:uid:{uid}:{archivo}".
  // Progresiva y no destructiva: se sigue LEYENDO el doc legado (y
  // combinandolo por timestamp/campo con el nuevo si ambos existen), pero
  // las escrituras NUEVAS van solo al doc por UID.

  // Extrae el usernameKey de un scopeKey "student:{usernameKey}" (unico
  // formato usado en todo el repo para este parametro).
  function scopeUsernameKey(scopeKey) {
    return String(scopeKey || "").replace(/^student:/, "");
  }

  function currentSessionUsernameKey() {
    var auth = window.portalAuth;
    var session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    return (session && session.user && session.user.usernameKey) || "";
  }

  // Resuelve el UID de Firebase del aprendiz DUEÑO del scope -- no
  // necesariamente el de la sesion actual: el admin puede guardar en nombre
  // de OTRO aprendiz (ver patchGuideCloudState en admin_usuarios.js). Camino
  // rapido (sin red): si el scope es el de la propia sesion, se usa el uid ya
  // disponible en el SDK de Firebase Auth. Camino lento: se lee el campo
  // `uid` que el propio aprendiz deja en su perfil (sena_portal_users) en
  // cada login (ver cloudSaveUserIndex). Si el aprendiz aun no inicio sesion
  // desde que existe ese campo, no hay uid que resolver -- el llamador debe
  // seguir usando el esquema legado para ese caso (transicion, no un error).
  // Optimizacion 2026-10-28: solo los scopes de APRENDIZ tienen dueno con UID.
  // Antes, un scope compartido como "admin:activity-deadlines" se tomaba como
  // usernameKey y se leia users/admin:activity-deadlines (documento que no
  // existe) en CADA pagina. Y el UID resuelto de un aprendiz se recuerda
  // durante la carga de la pagina (solo resultados positivos: un fallo o un
  // perfil sin uid se vuelve a consultar, nunca se toma como "no tiene uid").
  var _scopeUidCache = {};
  async function resolveUidForScope(scopeKey) {
    var raw = String(scopeKey || "");
    if (raw.indexOf(":") !== -1 && raw.indexOf("student:") !== 0) return "";
    var usernameKey = scopeUsernameKey(scopeKey);
    if (!usernameKey) return "";
    var uid = getBridgeCurrentUid();
    if (uid && currentSessionUsernameKey() === usernameKey) return uid;
    if (_scopeUidCache[usernameKey]) return _scopeUidCache[usernameKey];
    try {
      var profile = await cloudGetUser(usernameKey);
      var resolved = (profile && profile.uid) || "";
      if (resolved) _scopeUidCache[usernameKey] = resolved;
      return resolved;
    } catch (e) {
      return "";
    }
  }

  async function readGuideStateDocByDocId(docId, opts) {
    // NOTA: fsGet YA prueba Drive por su cuenta ante un 404 o un fallo de auth
    // (ver arriba), asi que un chequeo extra aqui era redundante (duplicaba la
    // llamada a Apps Script hasta 2 veces mas por cada doc que no existe).
    var fallbackDoc = await fsGet(COL_PROGRESS, docId, opts);
    if (fallbackDoc) return fallbackDoc;
    var stateDoc = await fsGet(COL_GUIDE_STATE, docId, opts);
    if (stateDoc) return stateDoc;
    return null;
  }

  // Combina el doc LEGADO (por usernameKey saneado) y el doc NUEVO (por UID)
  // mientras dura la transicion. Ninguno de los dos es "lo que se esta
  // guardando" -- son dos lecturas remotas ya existentes -- asi que se
  // combinan con el MISMO merge por timestamp/campo que ya protege el
  // guardado normal (mergeGuideDataSnapshotForSave): el mas viejo entra como
  // "existing" (solo rellena huecos) y el mas nuevo como "incoming" (gana un
  // conflicto de campo real). Un doc UID vacio/parcial (recien creado) nunca
  // esconde respuestas validas del legado, y viceversa. El _updateTime del
  // resultado SIEMPRE es el del doc UID (el destino real de la proxima
  // escritura) -- usar el del legado aqui compararia la precondicion optimista
  // contra el documento equivocado y el guardado fallaria como falso conflicto.
  function mergeLegacyAndUidGuideStateDocs(legacyDoc, uidDoc) {
    if (!legacyDoc) return uidDoc;
    if (!uidDoc) {
      // No existe doc UID todavia: el contenido sale del legado, pero SIN
      // _updateTime -- el proximo guardado sera una creacion nueva del doc
      // UID, no un PATCH con una precondicion que no le pertenece.
      return Object.assign({}, legacyDoc, { _updateTime: undefined });
    }
    var legacySnapshot = readSnapshotPayload(legacyDoc) || {};
    var uidSnapshot = readSnapshotPayload(uidDoc) || {};
    var legacyTs = snapshotTimestamp(legacySnapshot);
    var uidTs = snapshotTimestamp(uidSnapshot);
    var uidIsNewer = !Number.isFinite(legacyTs) || (Number.isFinite(uidTs) && uidTs >= legacyTs);
    var older = uidIsNewer ? legacySnapshot : uidSnapshot;
    var newer = uidIsNewer ? uidSnapshot : legacySnapshot;
    var mergedSnapshot = mergeGuideDataSnapshotForSave(older, newer);
    return Object.assign({}, uidDoc, {
      snapshotJson: JSON.stringify(mergedSnapshot),
      updatedAt: mergedSnapshot.updatedAt || uidDoc.updatedAt,
    });
  }

  async function readGuideStateDoc(prefix, scopeKey, fileName, opts) {
    var legacyDocId = guideStateDocId(prefix, scopeKey, fileName);
    var legacyDoc = await readGuideStateDocByDocId(legacyDocId, opts);
    var uid = await resolveUidForScope(scopeKey);
    if (!uid) return legacyDoc;
    var uidDocId = guideStateDocId(prefix, "uid:" + uid, fileName);
    var uidDoc = await readGuideStateDocByDocId(uidDocId, opts);
    return mergeLegacyAndUidGuideStateDocs(legacyDoc, uidDoc);
  }

  // Fase 14 (mantenibilidad): estas utilidades de fusion/lectura de snapshot
  // vivian aqui mismo; ahora estan en js/guide_merge_utils.js (mismo codigo,
  // sin cambios de comportamiento) para poder probarlas aisladas sin mocks de
  // Firestore/Drive. Se alias-ean con los MISMOS nombres locales para que
  // absolutamente ninguna de las lecturas de mas abajo en este archivo tenga
  // que cambiar.
  //
  // Cierre Bug 1 (2026-09-07): la lectura de window.guideMergeUtils era
  // incondicional y ocurria al cargar el script (no dentro de una funcion).
  // En cualquier pagina donde guide_merge_utils.js no se hubiera cargado
  // todavia -- confirmado en ~27 paginas reales de pages/auxiliares/ que
  // nunca lo referencian, y en teoria en cualquier pagina ante un desfase de
  // cache entre el HTML y este archivo -- ese acceso lanzaba de inmediato y
  // abortaba TODO el resto del archivo: ninguna funcion de mas abajo llegaba
  // a definirse y window._firebaseDb quedaba sin definir para toda la sesion,
  // incluyendo funciones que no tienen nada que ver con el merge de guias
  // (calificaciones, calendario, resumen del aprendiz, etc.). Ahora cada
  // alias es una funcion que resuelve window.guideMergeUtils en el momento
  // en que de verdad se usa -- siempre dentro de una funcion async invocada
  // mucho despues de que este script ya termino de cargar -- asi que una
  // ausencia real solo afecta la operacion puntual que necesita el merge, no
  // el modulo completo.
  function _requireGuideMergeUtils() {
    var utils = window.guideMergeUtils;
    if (!utils) {
      throw new Error(
        "[firebase_db] window.guideMergeUtils no esta disponible en esta pagina " +
        "(falta cargar js/guide_merge_utils.js antes que js/firebase_db.js)."
      );
    }
    return utils;
  }
  function readSnapshotPayload(doc) { return _requireGuideMergeUtils().readSnapshotPayload(doc); }
  function plainObject(value) { return _requireGuideMergeUtils().plainObject(value); }
  function snapshotState(snapshot) { return _requireGuideMergeUtils().snapshotState(snapshot); }
  function hasMeaningfulGuideValue(value) { return _requireGuideMergeUtils().hasMeaningfulGuideValue(value); }
  function countMeaningfulGuideValues(record) { return _requireGuideMergeUtils().countMeaningfulGuideValues(record); }
  function deriveProgressFromGuideDataDoc(fileName, doc) { return _requireGuideMergeUtils().deriveProgressFromGuideDataDoc(fileName, doc); }
  function mergeGuideValue(previous, incoming) { return _requireGuideMergeUtils().mergeGuideValue(previous, incoming); }
  function mergeGuideState(previousState, incomingState, allowMissingLockRemoval) { return _requireGuideMergeUtils().mergeGuideState(previousState, incomingState, allowMissingLockRemoval); }
  function snapshotTimestamp(snapshot) { return _requireGuideMergeUtils().snapshotTimestamp(snapshot); }
  function mergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot) { return _requireGuideMergeUtils().mergeGuideDataSnapshotForSave(existingSnapshot, incomingSnapshot); }

  async function saveGuideStateDoc(prefix, kind, scopeKey, fileName, payload, expectedUpdateTime) {
    // Fase 5: las escrituras NUEVAS van UNICAMENTE al doc por UID (nunca al
    // legado por usernameKey saneado, que puede colisionar entre dos
    // aprendices reales). Si el uid todavia no se puede resolver (el
    // aprendiz no ha iniciado sesion desde que existe este campo), se sigue
    // usando el docId legado -- transicion, no perdida de datos: el proximo
    // login del aprendiz estampa su uid y el siguiente guardado ya usa el
    // doc nuevo.
    var uid = await resolveUidForScope(scopeKey);
    var docId = uid
      ? guideStateDocId(prefix, "uid:" + uid, fileName)
      : guideStateDocId(prefix, scopeKey, fileName);
    // usernameKey (ademas de _usernameKey, que ya existia): cierra el bug de
    // sena_portal_guide_state confirmado en la auditoria profunda -- la
    // regla de esa coleccion exige un campo `usernameKey` para autorizar al
    // dueno por ese camino, y el codigo nunca lo escribia (solo
    // `_usernameKey`). Ver firestore.rules (guideStateOwnerKey) para la
    // compatibilidad con docs antiguos que solo tengan `_usernameKey`.
    var progressPayload = Object.assign({
      _usernameKey: docId,
      usernameKey: docId,
      _kind: kind,
    }, payload);
    var fallbackSaved = await fsPatch(
      COL_PROGRESS,
      docId,
      progressPayload,
      expectedUpdateTime ? { expectedUpdateTime: expectedUpdateTime } : null
    );
    if (fallbackSaved === "conflict") return "conflict";
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
    // Sin precondicion aqui: COL_GUIDE_STATE es un documento distinto (aunque
    // comparta docId) del que leimos para obtener expectedUpdateTime, asi que
    // esa precondicion no le pertenece. Este camino ya era best-effort/legado
    // antes de este cambio (solo se alcanza si COL_PROGRESS fallo por algo que
    // no fue un conflicto de version). Usa progressPayload (con usernameKey)
    // en vez del payload crudo -- antes faltaba el campo que la regla exige,
    // asi que esta escritura SIEMPRE terminaba 403 -> respaldo Drive.
    return fsPatch(COL_GUIDE_STATE, docId, progressPayload);
  }

  async function cloudGetGuideData(scopeKey, fileName, opts) {
    if (!scopeKey || !fileName) return null;
    var doc = await readGuideStateDoc(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName, opts);
    if (!doc) return null;
    return readSnapshotPayload(doc);
  }

  // ── Lectura DETALLADA de varias guias de UN aprendiz (2026-10-22) ──────────
  // cloudGetGuideData devuelve null tanto si el documento no existe como si la
  // lectura fallo (sin red, 403, tiempo agotado, Firestore caido): sus
  // llamadores dependen de ese contrato y NO se cambia. Esta funcion
  // complementaria la usa el panel de habilitacion para no confundir "no hay
  // actividades" con "no se pudo consultar". Solo lectura.
  //
  // Lee los MISMOS documentos que readGuideStateDoc (legado por usernameKey y
  // nuevo por UID; progress y, si falta, guide_state) y los combina igual
  // (mergeLegacyAndUidGuideStateDocs), pero agrupados en peticiones batchGet:
  // 2-3 peticiones para todas las guias pedidas en vez de hasta 5 por guia
  // (perfil + 4 documentos), y el perfil del aprendiz (para su UID) se lee una
  // sola vez por sesion. Las lecturas facturadas no aumentan: guide_state solo
  // se pide para los duenos cuyo documento de progress no existe.
  //
  // -> { status: "ok"|"incomplete"|"offline"|"denied"|"timeout"|"unavailable"|"error",
  //      reason, files: { [fileName]: { status: "found"|"missing"|"partial"|"unverified"|<error>,
  //                                     data, source: "firestore"|"drive"|"" } },
  //      stats: { firestoreRequests, firestoreDocs, driveRequests, ms } }
  var _detailedUidCache = new Map(); // usernameKey -> uid (de su perfil)

  function _detailedHttpStatusClass(status) {
    if (status === 401 || status === 403) return "denied";
    if (status === 408 || status === 504) return "timeout";
    // 429 = RESOURCE_EXHAUSTED: cuota diaria agotada (plan Spark). Estado
    // propio: no se reintenta automaticamente y se informa como tal.
    if (status === 429) return "quota";
    if (status === 500 || status === 502 || status === 503) return "unavailable";
    return "error";
  }

  function _detailedFetchErrorClass(err) {
    if (err && err.name === "AbortError") return "timeout";
    return "offline"; // fetch solo lanza ante un fallo de red (TypeError)
  }

  async function _detailedPreflight() {
    if (!isConfigured) return { status: "error", reason: "not-configured" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { status: "offline", reason: "navigator-offline" };
    if (isFirestoreInCooldown()) return { status: "unavailable", reason: "cooldown" };
    if (getFirestoreBudgetStatus().levels.read === "block") return { status: "quota", reason: "budget-block" };
    if (!window.portalFirebaseAuth) return { status: "denied", reason: "no-auth-bridge" };
    await ensureAuthHydrated();
    if (!getBridgeCurrentUid()) return { status: "denied", reason: "no-session" };
    return null;
  }

  // Un batchGet de documentos de cualquier coleccion. -> { status, docs: Map(path -> doc|null) }
  async function _detailedBatchGet(paths, stats) {
    var docs = new Map();
    if (!paths.length) return { status: "ok", docs: docs };
    var root = "projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/";
    var url = "https://firestore.googleapis.com/v1/" + root.replace(/\/$/, "") + ":batchGet?key=" + FIREBASE_API_KEY;
    for (var start = 0; start < paths.length; start += BATCH_GET_CHUNK_SIZE) {
      var chunk = paths.slice(start, start + BATCH_GET_CHUNK_SIZE);
      stats.firestoreRequests += 1;
      stats.firestoreDocs += chunk.length;
      var res;
      try {
        res = await fetchWithTimeout(url, {
          method: "POST",
          cache: "no-store",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            // SIN encodeURIComponent: en el cuerpo de batchGet el nombre va
            // literal. Codificado ("%3A" en vez de ":"), Firestore busca otro
            // documento y lo reporta "missing" (comprobado en produccion,
            // lectura 2026-10-22).
            documents: chunk.map(function (p) { return root + p.collection + "/" + p.docId; }),
          }),
        }, API_TIMEOUT_MS);
      } catch (e) {
        return { status: _detailedFetchErrorClass(e), reason: "network", docs: docs };
      }
      if (!res.ok) {
        if (isAuthRejection(res.status)) markFirestoreRejection();
        return { status: _detailedHttpStatusClass(res.status), reason: "http-" + res.status, docs: docs };
      }
      var body;
      try { body = await res.json(); } catch (e) { return { status: "error", reason: "bad-json", docs: docs }; }
      if (!Array.isArray(body)) return { status: "error", reason: "bad-response", docs: docs };
      registerFirestoreOperation("read", chunk.length);
      markFirestoreSuccess();
      body.forEach(function (item) {
        var name = (item && (item.found ? item.found.name : item.missing)) || "";
        var idx = name.indexOf("/documents/");
        if (idx === -1) return;
        var rel = name.slice(idx + "/documents/".length);
        var slash = rel.indexOf("/");
        var key = rel.slice(0, slash) + "/" + rel.slice(slash + 1);
        docs.set(key, item.found ? fromFsDoc(item.found) : null);
      });
    }
    return { status: "ok", docs: docs };
  }

  async function cloudReadGuideDataDetailed(scopeKey, fileNames, opts) {
    opts = opts || {};
    var startedAt = Date.now();
    var stats = { firestoreRequests: 0, firestoreDocs: 0, driveRequests: 0, ms: 0 };
    var files = [];
    (Array.isArray(fileNames) ? fileNames : [fileNames]).forEach(function (f) {
      if (f && files.indexOf(f) === -1) files.push(f);
    });
    var out = { status: "ok", reason: "", files: {}, stats: stats };
    if (!scopeKey || !files.length) return out;

    var pre = await _detailedPreflight();
    if (pre) {
      out.status = pre.status;
      out.reason = pre.reason;
      files.forEach(function (f) { out.files[f] = { status: pre.status, data: null, source: "" }; });
      stats.ms = Date.now() - startedAt;
      return out;
    }

    var usernameKey = scopeUsernameKey(scopeKey);
    var uid = typeof opts.uid === "string" && opts.uid ? opts.uid : (_detailedUidCache.get(usernameKey) || "");
    if (!uid && usernameKey && currentSessionUsernameKey() === usernameKey) uid = getBridgeCurrentUid() || "";
    var needProfile = !uid && Boolean(usernameKey);

    // Cada dueno (legado / uid) de cada guia avanza: progress -> guide_state.
    var COLS = [COL_PROGRESS, COL_GUIDE_STATE];
    var lookups = [];
    function addOwner(owner, ownerScope) {
      files.forEach(function (file) {
        lookups.push({ file: file, owner: owner, docId: guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, ownerScope, file), step: 0, doc: null, done: false, failed: "" });
      });
    }
    addOwner("legacy", scopeKey);
    if (uid) addOwner("uid", "uid:" + uid);

    var failure = null;
    for (var round = 0; round < 4; round++) {
      var pending = lookups.filter(function (l) { return !l.done && !l.failed; });
      var paths = pending.map(function (l) { return { collection: COLS[l.step], docId: l.docId }; });
      var profilePath = needProfile ? { collection: COL_USERS, docId: usernameKey } : null;
      if (profilePath) paths.push(profilePath);
      if (!paths.length) break;
      var batch = await _detailedBatchGet(paths, stats);
      if (batch.status !== "ok") {
        failure = { status: batch.status, reason: batch.reason };
        pending.forEach(function (l) { l.failed = batch.status; });
        break;
      }
      pending.forEach(function (l) {
        var doc = batch.docs.get(COLS[l.step] + "/" + l.docId);
        if (doc) { l.doc = doc; l.done = true; return; }
        l.step += 1;
        if (l.step >= COLS.length) l.done = true;
      });
      if (profilePath) {
        needProfile = false;
        var profile = batch.docs.get(COL_USERS + "/" + usernameKey);
        if (profile && profile.uid) {
          uid = String(profile.uid);
          _detailedUidCache.set(usernameKey, uid);
          addOwner("uid", "uid:" + uid);
        }
      }
    }

    var driveChecks = [];
    files.forEach(function (file) {
      var mine = lookups.filter(function (l) { return l.file === file; });
      var legacy = mine.find(function (l) { return l.owner === "legacy"; }) || {};
      var own = mine.find(function (l) { return l.owner === "uid"; }) || {};
      var failed = mine.find(function (l) { return l.failed; });
      var merged = mergeLegacyAndUidGuideStateDocs(legacy.doc || null, own.doc || null);
      var data = merged ? readSnapshotPayload(merged) : null;
      var entry = { status: "missing", data: data, source: data ? "firestore" : "" };
      if (failed) entry.status = data ? "partial" : failed.failed;
      else if (data) entry.status = "found";
      out.files[file] = entry;
      // Un documento ausente en Firestore solo puede estar en la replica de
      // Drive si una escritura cayo alli y aun no se promovio: una consulta
      // (al documento al que escribe saveGuideStateDoc), no cuatro.
      if (entry.status === "missing" && !opts.skipDrive && isDriveFallbackEnabled()) {
        driveChecks.push({ file: file, docId: guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, uid ? "uid:" + uid : scopeKey, file) });
      }
    });

    var queue = driveChecks.slice();
    var runners = [];
    for (var r = 0; r < Math.min(3, queue.length); r++) {
      runners.push((async function () {
        while (queue.length) {
          var check = queue.shift();
          stats.driveRequests += 1;
          var replica = await driveFallbackGetDetailed(COL_PROGRESS, check.docId);
          var entry = out.files[check.file];
          if (replica.status === "found" && replica.data) {
            entry.status = "found";
            entry.data = readSnapshotPayload(replica.data);
            entry.source = "drive";
          } else if (replica.status === "unavailable") {
            entry.status = "unverified"; // Firestore: no existe; Drive: no respondio
          }
        }
      })());
    }
    await Promise.all(runners);

    var statuses = files.map(function (f) { return out.files[f].status; });
    var complete = statuses.filter(function (s) { return s === "found" || s === "missing"; }).length;
    if (complete === files.length) {
      out.status = "ok";
    } else if (failure && complete === 0 && statuses.every(function (s) { return s === failure.status; })) {
      out.status = failure.status;
      out.reason = failure.reason;
    } else {
      out.status = "incomplete";
      out.reason = failure ? failure.status : "drive-unavailable";
    }
    stats.ms = Date.now() - startedAt;
    return out;
  }

  // ── Consultas por rango (runQuery) con resultado DETALLADO (2026-10-22) ──────
  // Solo se cobran los documentos devueltos. Paginado por cursor; detiene la
  // paginacion ante el primer fallo y lo clasifica (offline/denied/quota/...).
  // -> { status, reason, docs: [doc con _docId/_updateTime], stats }
  var RUN_QUERY_PAGE_SIZE = 300;
  async function _detailedRunQuery(collection, where, orderBy, stats, maxDocs) {
    var url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
      "/databases/(default)/documents:runQuery?key=" + FIREBASE_API_KEY;
    var docs = [];
    var cursor = null;
    var readTime = 0;
    var limit = Math.max(1, Number(maxDocs) || 5000);
    while (docs.length < limit) {
      var query = { from: [{ collectionId: collection }], orderBy: orderBy, limit: RUN_QUERY_PAGE_SIZE };
      if (where) query.where = where;
      if (cursor) query.startAt = { values: cursor, before: false };
      stats.firestoreRequests += 1;
      var res;
      try {
        res = await fetchWithTimeout(url, {
          method: "POST",
          cache: "no-store",
          headers: await authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ structuredQuery: query }),
        }, API_TIMEOUT_MS);
      } catch (e) {
        return { status: _detailedFetchErrorClass(e), reason: "network", docs: docs, stats: stats };
      }
      if (!res.ok) {
        if (isAuthRejection(res.status)) markFirestoreRejection();
        return { status: _detailedHttpStatusClass(res.status), reason: "http-" + res.status, docs: docs, stats: stats };
      }
      var body;
      try { body = await res.json(); } catch (e) { return { status: "error", reason: "bad-json", docs: docs, stats: stats }; }
      if (!Array.isArray(body)) return { status: "error", reason: "bad-response", docs: docs, stats: stats };
      var page = body.filter(function (item) { return item && item.document; }).map(function (item) { return item.document; });
      body.forEach(function (item) {
        var rt = item && item.readTime ? Date.parse(item.readTime) : NaN;
        if (!isNaN(rt)) {
          noteServerTime(rt);
          if (!readTime || rt < readTime) readTime = rt;
        }
      });
      // Una consulta sin resultados se cobra como 1 lectura.
      registerFirestoreOperation("read", Math.max(1, page.length));
      stats.firestoreDocs += page.length;
      markFirestoreSuccess();
      page.forEach(function (raw) { docs.push(fromFsDoc(raw) || { _docId: String(raw.name || "").split("/").pop(), _docName: raw.name }); });
      if (page.length < RUN_QUERY_PAGE_SIZE) break;
      var last = page[page.length - 1];
      cursor = orderBy.map(function (o) {
        if (o.field.fieldPath === "__name__") return { referenceValue: last.name };
        var v = last.fields && last.fields[o.field.fieldPath];
        return v || { nullValue: null };
      });
    }
    return { status: "ok", reason: "", docs: docs, stats: stats, readTime: readTime };
  }

  function _guideDataNameRange(collection) {
    var root = "projects/" + FIREBASE_PROJECT_ID + "/databases/(default)/documents/" + collection + "/";
    return { compositeFilter: { op: "AND", filters: [
      { fieldFilter: { field: { fieldPath: "__name__" }, op: "GREATER_THAN_OR_EQUAL", value: { referenceValue: root + GUIDE_DATA_FALLBACK_PREFIX } } },
      // ";" es el caracter siguiente a ":" -> rango exacto del prefijo.
      { fieldFilter: { field: { fieldPath: "__name__" }, op: "LESS_THAN", value: { referenceValue: root + GUIDE_DATA_FALLBACK_PREFIX.slice(0, -1) + ";" } } },
    ] } };
  }

  // Todos los documentos __guide_data__ EXISTENTES de progress y guide_state
  // (solo admin). Para el progreso de la lista de aprendices: cuesta una
  // lectura por documento existente, en vez de pedir por nombre todas las
  // combinaciones aprendiz x guia x dueno (casi todas inexistentes, igual
  // cobradas). -> { status, reason, docs: { progress: Map, guideState: Map }, stats }
  // El listado se reutiliza en memoria (no en localStorage) durante
  // GUIDE_DATA_LISTING_TTL_MS: cada mutacion del panel (editar aprendiz,
  // calificar...) recarga la lista de aprendices y no debe volver a leer los
  // ~1000 documentos de guia, que esas acciones no cambian. Se invalida al
  // guardar cualquier dato de guia (cloudSaveGuideData) y con "Actualizar
  // datos" (opts.force). Solo se reutiliza un listado completo (status ok).
  var GUIDE_DATA_LISTING_TTL_MS = 4 * 60 * 1000;
  // Optimizacion 2026-10-28: el listado de documentos de guia (unas 1080
  // lecturas y ~4,5 MB con 180 aprendices) se repetia en CADA apertura del
  // panel y de la agenda. Ahora:
  //   * se conserva en memoria y en IndexedDB de este navegador (clave por
  //     proyecto + admin), con la hora de INICIO de la consulta;
  //   * las aperturas siguientes piden solo lo cambiado desde entonces
  //     (cloudListGuideDataSince, menos GUIDE_DATA_DELTA_SKEW_MS de margen por
  //     relojes de los equipos) y lo fusionan por id;
  //   * cada GUIDE_DATA_LISTING_FULL_TTL_MS, con "Actualizar datos" (force) o
  //     si la consulta incremental falla, se vuelve al listado completo.
  // Los documentos de guia nunca se borran, asi que la fusion no deja
  // "fantasmas". Limite conocido: updatedAt lo pone el equipo que escribe; un
  // equipo con el reloj muy atrasado puede tardar hasta el proximo listado
  // completo en reflejarse (solo afecta al % de respaldo e indicadores del
  // panel, nunca a notas ni guardados).
  var _guideDataListing = null; // { at, fullAt, result }
  var _guideDataListingDirty = false;
  var GUIDE_DATA_LISTING_FULL_TTL_MS = 90 * 60 * 1000;
  var GUIDE_DATA_DELTA_SKEW_MS = 30 * 60 * 1000;
  // Candidata 2026-10-28 (riesgo A de la auditoria): `updatedAt` lo pone el
  // equipo que escribe. El panel ya no confia en su propio reloj: la ventana
  // se calcula con la hora del servidor (readTime de runQuery) y se amplia con
  // el mayor retraso observado entre updatedAt y updateTime (hora real del
  // servidor) en los documentos escritos durante las ultimas 24 h (reloj
  // atrasado, o una promocion Drive->Firestore de un guardado viejo). El
  // margen extra se limita a 24 h; lo que quede fuera lo recoge el listado
  // completo de cada GUIDE_DATA_LISTING_FULL_TTL_MS, igual que antes.
  var GUIDE_DATA_MAX_WRITER_LAG_MS = 24 * 60 * 60 * 1000;
  // Riesgo B: la copia en IndexedDB caduca a las 12 h, solo la usa una sesion
  // admin con uid y se borra al cerrar sesion o al entrar sin sesion admin.
  var LISTING_IDB_MAX_AGE_MS = 12 * 60 * 60 * 1000;
  var _serverSkewMs = null;
  function noteServerTime(serverMs) { _serverSkewMs = serverMs - Date.now(); }
  function serverNowMs() { return Date.now() + (_serverSkewMs || 0); }
  // Edad en hora del servidor; un valor del futuro (reloj movido) cuenta como caducado.
  function listingAgeMs(t) {
    var a = serverNowMs() - Number(t || 0);
    return a < -5 * 60 * 1000 ? Infinity : Math.max(0, a);
  }
  function writerLagOf(docs) {
    var lag = 0;
    var recentFrom = serverNowMs() - GUIDE_DATA_MAX_WRITER_LAG_MS;
    docs.forEach(function (d) {
      var u = d && d._updateTime ? Date.parse(d._updateTime) : NaN;
      var w = d && d.updatedAt ? Date.parse(d.updatedAt) : NaN;
      if (!isNaN(u) && !isNaN(w) && u >= recentFrom && u - w > lag) lag = u - w;
    });
    return Math.min(lag, GUIDE_DATA_MAX_WRITER_LAG_MS);
  }
  function isMapLike(m) { return Object.prototype.toString.call(m) === "[object Map]"; }
  function mapValues(m) { var out = []; m.forEach(function (v) { out.push(v); }); return out; }
  function invalidateGuideDataListing() { _guideDataListingDirty = true; }

  var LISTING_IDB_NAME = "sena_portal_admin_cache_v1";
  var LISTING_IDB_STORE = "listados";
  function listingIdbKey() {
    var uid = getBridgeCurrentUid() || "";
    return uid ? "guias:" + FIREBASE_PROJECT_ID + ":" + uid : "";
  }
  function listingIdb(mode, value) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      try {
        if (typeof indexedDB === "undefined" || !indexedDB) return finish(null);
        if (!isCurrentUserAdmin() || !listingIdbKey()) return finish(null);
        window.setTimeout(function () { finish(null); }, 2000);
        var req = indexedDB.open(LISTING_IDB_NAME, 1);
        req.onupgradeneeded = function () { try { req.result.createObjectStore(LISTING_IDB_STORE); } catch (e) {} };
        req.onerror = function () { finish(null); };
        req.onblocked = function () { finish(null); };
        req.onsuccess = function () {
          try {
            var dbh = req.result;
            var tx = dbh.transaction(LISTING_IDB_STORE, mode === "put" ? "readwrite" : "readonly");
            var store = tx.objectStore(LISTING_IDB_STORE);
            var op = mode === "put" ? store.put(value, listingIdbKey()) : store.get(listingIdbKey());
            op.onsuccess = function () { finish(mode === "put" ? true : (op.result || null)); };
            op.onerror = function () { finish(null); };
            tx.oncomplete = function () { try { dbh.close(); } catch (e) {} };
          } catch (e) { finish(null); }
        };
      } catch (e) { finish(null); }
    });
  }
  function saveListing(entry) {
    _guideDataListing = entry;
    _guideDataListingDirty = false;
    listingIdb("put", { v: 2, uid: getBridgeCurrentUid() || "", at: entry.at, fullAt: entry.fullAt, writerLagMs: entry.writerLagMs || 0, docs: entry.result.docs }).catch(function () {});
  }
  // Borra la copia del listado (memoria + IndexedDB). Se llama al cerrar sesion
  // y al cargar cualquier pagina sin sesion admin; nunca falla.
  function clearAdminListingCache() {
    _guideDataListing = null;
    _guideDataListingDirty = false;
    try {
      if (typeof indexedDB !== "undefined" && indexedDB && indexedDB.deleteDatabase) indexedDB.deleteDatabase(LISTING_IDB_NAME);
    } catch (e) {}
  }

  async function cloudListAllGuideDataDocs(opts) {
    var force = Boolean(opts && opts.force);
    if (!force && !_guideDataListingDirty && _guideDataListing && listingAgeMs(_guideDataListing.at) < GUIDE_DATA_LISTING_TTL_MS) {
      var reused = _guideDataListing.result;
      return { status: reused.status, reason: reused.reason, docs: reused.docs, stats: { firestoreRequests: 0, firestoreDocs: 0, driveRequests: 0, ms: 0 }, reused: true };
    }
    var stats = { firestoreRequests: 0, firestoreDocs: 0, driveRequests: 0, ms: 0 };
    var startedAt = Date.now();
    var serverStartedAt = serverNowMs();
    var pre = await _detailedPreflight();
    if (pre) return { status: pre.status, reason: pre.reason, docs: null, stats: stats };

    // Base para la consulta incremental: memoria o IndexedDB (nunca si force).
    var base = null;
    if (!force) {
      base = _guideDataListing && _guideDataListing.fullAt ? _guideDataListing : null;
      if (!base) {
        var stored = await listingIdb("get");
        if (stored && stored.v === 2 && stored.uid && stored.uid === getBridgeCurrentUid() &&
            listingAgeMs(stored.fullAt) < LISTING_IDB_MAX_AGE_MS &&
            stored.docs && isMapLike(stored.docs.progress) && isMapLike(stored.docs.guideState)) {
          base = { at: stored.at, fullAt: stored.fullAt, writerLagMs: stored.writerLagMs || 0, result: { status: "ok", reason: "", docs: stored.docs } };
        }
      }
    }
    var baseLag = base ? Math.min(Number(base.writerLagMs) || 0, GUIDE_DATA_MAX_WRITER_LAG_MS) : 0;
    if (base && base.result && base.result.status === "ok" && base.fullAt &&
        listingAgeMs(base.fullAt) < GUIDE_DATA_LISTING_FULL_TTL_MS) {
      var delta = await cloudListGuideDataSince(new Date(base.at - GUIDE_DATA_DELTA_SKEW_MS - baseLag).toISOString());
      stats.firestoreRequests += (delta.stats && delta.stats.firestoreRequests) || 0;
      stats.firestoreDocs += (delta.stats && delta.stats.firestoreDocs) || 0;
      if (delta.status === "ok") {
        var progress = new Map(base.result.docs.progress);
        var guideState = new Map(base.result.docs.guideState);
        delta.docs.forEach(function (d) {
          var copy = Object.assign({}, d);
          var target = copy._collection === COL_GUIDE_STATE ? guideState : progress;
          delete copy._collection;
          if (copy._docId) target.set(copy._docId, copy);
        });
        var merged = { status: "ok", reason: "", docs: { progress: progress, guideState: guideState }, stats: stats, delta: true };
        stats.ms = Date.now() - startedAt;
        saveListing({ at: delta.readTime || serverStartedAt, fullAt: base.fullAt, writerLagMs: Math.max(baseLag, writerLagOf(delta.docs)), result: merged });
        return merged;
      }
      // La consulta incremental fallo: se intenta el listado completo (nunca se
      // devuelve la base sin haberla actualizado).
    }

    var out = { status: "ok", reason: "", docs: { progress: new Map(), guideState: new Map() }, stats: stats };
    var pairs = [[COL_PROGRESS, out.docs.progress], [COL_GUIDE_STATE, out.docs.guideState]];
    var fullReadTime = 0;
    for (var i = 0; i < pairs.length; i++) {
      var r = await _detailedRunQuery(pairs[i][0], _guideDataNameRange(pairs[i][0]), [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }], stats, 20000);
      r.docs.forEach(function (doc) { if (doc && doc._docId) pairs[i][1].set(doc._docId, doc); });
      if (r.readTime && (!fullReadTime || r.readTime < fullReadTime)) fullReadTime = r.readTime;
      if (r.status !== "ok") { out.status = r.status; out.reason = r.reason; break; }
    }
    stats.ms = Date.now() - startedAt;
    if (out.status === "ok") {
      // Base del proximo incremental: la hora del servidor de la primera consulta.
      var fullAt = fullReadTime || serverStartedAt;
      var lag = writerLagOf(mapValues(out.docs.progress).concat(mapValues(out.docs.guideState)));
      saveListing({ at: fullAt, fullAt: fullAt, writerLagMs: lag, result: out });
    }
    return out;
  }

  // Documentos __guide_data__ actualizados desde `sinceIso` (campo de primer
  // nivel updatedAt, texto ISO que escriben cloudSaveGuideData y las
  // escrituras del admin). Indice de un solo campo: lo crea Firestore solo.
  // Para "Entregas recientes": solo cuesta los documentos que cambiaron.
  async function cloudListGuideDataSince(sinceIso) {
    var stats = { firestoreRequests: 0, firestoreDocs: 0, driveRequests: 0, ms: 0 };
    var startedAt = Date.now();
    var pre = await _detailedPreflight();
    if (pre) return { status: pre.status, reason: pre.reason, docs: [], stats: stats };
    var since = String(sinceIso || "");
    var docs = [];
    var status = "ok";
    var reason = "";
    var colls = [COL_PROGRESS, COL_GUIDE_STATE];
    var readTime = 0;
    for (var i = 0; i < colls.length; i++) {
      var r = await _detailedRunQuery(
        colls[i],
        { fieldFilter: { field: { fieldPath: "updatedAt" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: since } } },
        [{ field: { fieldPath: "updatedAt" }, direction: "DESCENDING" }, { field: { fieldPath: "__name__" }, direction: "DESCENDING" }],
        stats,
        5000
      );
      if (r.readTime && (!readTime || r.readTime < readTime)) readTime = r.readTime;
      r.docs.forEach(function (doc) {
        if (doc && String(doc._docId || "").indexOf(GUIDE_DATA_FALLBACK_PREFIX) === 0) {
          docs.push(Object.assign({ _collection: colls[i] }, doc));
        }
      });
      if (r.status !== "ok") {
        // Lo ya recuperado se devuelve, marcado como incompleto.
        status = docs.length ? "incomplete" : r.status;
        reason = r.status;
        break;
      }
    }
    stats.ms = Date.now() - startedAt;
    return { status: status, reason: reason, docs: docs, stats: stats, readTime: readTime };
  }

  // Lee-combina-escribe SERIALIZADO por documento (scopeKey+fileName): antes,
  // dos llamadas concurrentes a esta funcion para el MISMO doc (dos pestañas,
  // el aprendiz y una escritura del admin, o dos guardados casi simultaneos
  // en la misma pestaña) podian leer el mismo "existing" desactualizado y la
  // que terminara de escribir despues borraba por completo lo que la otra
  // ya habia guardado (fsPatch reemplaza el documento entero). Reutiliza la
  // MISMA cola que ya protegia las escrituras del admin desde 2026-07-25
  // (antes "withGuideStateAdminQueue", mismo bug, ver auditoria 2026-08-22
  // Fase 5) — ahora sirve a cualquier llamador, admin o aprendiz, con la
  // MISMA llave de documento.
  async function cloudSaveGuideData(scopeKey, fileName, snapshot) {
    if (!scopeKey || !fileName) return false;
    invalidateGuideDataListing(); // el listado del panel deja de ser vigente
    return withGuideStateWriteQueue(scopeKey, fileName, function () {
      return cloudSaveGuideDataImpl(scopeKey, fileName, snapshot);
    });
  }

  // Lectura ESTRICTA de un doc de guia/registro: mismo conjunto de documentos
  // que readGuideStateDoc (legado por usernameKey + nuevo por UID, cada uno
  // en COL_PROGRESS y, si falta, COL_GUIDE_STATE) y misma fusion, pero sin
  // failover a Drive: si CUALQUIER lectura falla -> status "error".
  // -> { status: "found"|"missing"|"error", snapshot, targetDocId, targetUpdateTime }
  async function readStrictGuideStateDocById(docId) {
    var progress = await fsGetStrict(COL_PROGRESS, docId);
    if (progress.status !== "missing") return { result: progress, progress: progress };
    var state = await fsGetStrict(COL_GUIDE_STATE, docId);
    return { result: state, progress: progress };
  }

  async function cloudGetGuideDataStrict(scopeKey, fileName) {
    if (!scopeKey || !fileName) return { status: "error", snapshot: null };
    var legacyId = guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName);
    var legacy = await readStrictGuideStateDocById(legacyId);
    if (legacy.result.status === "error") return { status: "error", snapshot: null };
    var uid = await resolveUidForScope(scopeKey);
    var uidRead = null;
    var targetDocId = legacyId;
    var targetProgress = legacy.progress;
    if (uid) {
      targetDocId = guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "uid:" + uid, fileName);
      uidRead = await readStrictGuideStateDocById(targetDocId);
      if (uidRead.result.status === "error") return { status: "error", snapshot: null };
      targetProgress = uidRead.progress;
    }
    var legacyDoc = legacy.result.status === "found" ? legacy.result.data : null;
    var uidDoc = uidRead && uidRead.result.status === "found" ? uidRead.result.data : null;
    var merged = uid ? mergeLegacyAndUidGuideStateDocs(legacyDoc, uidDoc) : legacyDoc;
    var snapshot = merged ? readSnapshotPayload(merged) : null;
    if (merged && !snapshot) return { status: "error", snapshot: null };
    return {
      status: merged ? "found" : "missing",
      snapshot: snapshot || {},
      targetDocId: targetDocId,
      targetUpdateTime: targetProgress && targetProgress.status === "found" ? targetProgress.updateTime : "",
    };
  }

  // Leer -> `mutate` -> escribir con precondicion, para docs de registro que
  // son LISTAS por id (p.ej. entregas propias de Etapa Productiva). Mismas
  // invariantes que cloudUpdateCalendarStrict: lectura fallida = cero
  // escrituras; conflicto = releer y reaplicar; maximo STRICT_MAX_ATTEMPTS.
  // Escribe en el MISMO doc y con el MISMO formato que saveGuideStateDoc
  // (COL_PROGRESS, doc por UID cuando se conoce), asi que cloudGetGuideData
  // lo sigue leyendo sin cambios.
  // -> { ok, status: "saved"|"read-failed"|"write-failed"|"conflict-exhausted"|"aborted", snapshot }
  async function cloudUpdateGuideDataStrict(scopeKey, fileName, mutate) {
    if (!scopeKey || !fileName || typeof mutate !== "function") return { ok: false, status: "aborted", snapshot: null };
    for (var attempt = 1; attempt <= STRICT_MAX_ATTEMPTS; attempt++) {
      var current = await cloudGetGuideDataStrict(scopeKey, fileName);
      if (current.status === "error") return { ok: false, status: "read-failed", snapshot: null };
      var next = mutate(JSON.parse(JSON.stringify(current.snapshot || {})));
      if (!next || next.abort) return { ok: false, status: "aborted", reason: next && next.abort, snapshot: null };
      next.updatedAt = new Date().toISOString();
      var docId = current.targetDocId;
      var written = await fsPatchStrict(
        COL_PROGRESS,
        docId,
        {
          _usernameKey: docId,
          usernameKey: docId,
          _kind: "guide-data",
          scopeKey: scopeKey,
          fileName: fileName,
          updatedAt: next.updatedAt,
          snapshotJson: JSON.stringify(next),
        },
        current.targetUpdateTime ? { expectedUpdateTime: current.targetUpdateTime } : { mustNotExist: true }
      );
      if (written.status === "ok") return { ok: true, status: "saved", snapshot: next };
      if (written.status === "error") return { ok: false, status: "write-failed", snapshot: null };
      if (attempt < STRICT_MAX_ATTEMPTS) await strictRetryDelay(attempt);
    }
    return { ok: false, status: "conflict-exhausted", snapshot: null };
  }

  // withGuideStateWriteQueue (ver mas abajo) solo serializa escrituras DENTRO
  // del mismo proceso: dos DISPOSITIVOS reales (dos navegadores distintos)
  // tienen cada uno su propia cola en memoria, asi que si ambos leen el
  // mismo documento casi al mismo tiempo y luego escriben campos DISTINTOS,
  // cada uno mezcla su cambio sobre una copia que nunca vio el cambio del
  // otro -- el que termina de escribir despues reemplaza el documento
  // completo y borra en silencio lo que el otro ya habia guardado (confirmado
  // reproducible en tests/guide_cloud_sync_multi_device.test.cjs, Caso A2,
  // auditoria/cierre de riesgos 2026-08-22). La cola no puede arreglar esto
  // (no hay forma de coordinar procesos que no se conocen entre si), asi que
  // se usa la precondicion optimista nativa de Firestore
  // (currentDocument.updateTime, ver fsPatch/isFirestorePreconditionConflict):
  // si el documento cambio desde que lo leimos, la escritura se rechaza sola
  // (en vez de pisar a ciegas) y aqui simplemente se relee y se reintenta --
  // la relectura YA incluye el cambio del otro dispositivo, asi que el nuevo
  // merge no lo pierde.
  async function cloudSaveGuideDataImpl(scopeKey, fileName, snapshot) {
    var maxAttempts = 4;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      // La base de la fusion se lee de FIRESTORE, no de la replica de Drive.
      // Tres razones, todas comprobadas el 2026-09-22:
      //   1. El destino de esta escritura es Firestore. Fusionar contra una
      //      replica que va por detras puede revivir valores viejos.
      //   2. Solo el documento de Firestore trae `_updateTime`. Leyendo de la
      //      replica, expectedUpdateTime era SIEMPRE null y la precondicion
      //      optimista que protege de dos dispositivos escribiendo a la vez
      //      (ver el comentario largo sobre withGuideStateWriteQueue) nunca
      //      llegaba a activarse en produccion.
      //   3. Cada intento hacia hasta 4 lecturas encadenadas al Apps Script,
      //      medidas en 1,6-15 s cada una (un guardado real tardo 21 s), con
      //      un 20-33% de respuestas 404 en cuanto hay 3-10 peticiones a la
      //      vez. En Firestore la misma lectura son 0,8 s.
      // Drive sigue siendo el failover normal de fsGet si Firestore falla, y
      // las lecturas de HIDRATACION (alto volumen) siguen yendo a la replica:
      // esto solo afecta a la lectura previa de un guardado.
      var existingDoc = await readGuideStateDoc(
        GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName, { firestoreFirst: true }
      );
      var existing = readSnapshotPayload(existingDoc);
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
      var expectedUpdateTime = existingDoc && existingDoc._updateTime ? existingDoc._updateTime : null;
      var result = await saveGuideStateDoc(
        GUIDE_DATA_FALLBACK_PREFIX,
        "guide-data",
        scopeKey,
        fileName,
        payload,
        expectedUpdateTime
      );
      if (result !== "conflict") return result;
      if (attempt < maxAttempts) {
        await new Promise(function (resolve) {
          window.setTimeout(resolve, 30 + Math.floor(Math.random() * 70));
        });
      }
    }
    // Contencion inusual (varios dispositivos escribiendo el mismo documento
    // en el mismo instante, una y otra vez): se cede por esta vuelta. No se
    // pierde nada -- el reintento normal con backoff de guide_cloud_sync.js
    // (o el proximo guardado) lo resuelve en cuanto la contencion baje.
    return false;
  }

  // Guardado directo de UN solo intento (sin la lectura previa de "existing"):
  // pensado para el flush de "voy a cerrar la pestaña ya mismo" (pagehide),
  // donde encadenar una lectura + una escritura es demasiado lento para que
  // el navegador lo deje terminar. Sacrifica el merge fino a nivel de campo
  // por esta escritura puntual (podria pisar un cambio de OTRA pestaña que
  // llegue en el mismo instante), pero nunca pierde el cambio de ESTA pestaña:
  // si esa rara colision ocurre, la proxima vez que cualquiera de las dos
  // pestañas hidrate/reintente, el merge normal (mergeGuideDataSnapshotForSave)
  // se auto-corrige porque cada una sigue teniendo su propio cambio a salvo en
  // su localStorage. `keepalive:true` deja que el navegador complete la
  // peticion aunque el documento ya se haya descargado (limite ~64KB).
  async function cloudSaveGuideDataKeepalive(scopeKey, fileName, snapshot) {
    if (!scopeKey || !fileName || !isConfigured) return false;
    var bridge = window.portalFirebaseAuth;
    if (!bridge || typeof bridge.getIdToken !== "function") return false;
    var token;
    try {
      // false = no forzar refresh: en el instante de pagehide/visibilitychange
      // el token cacheado (si no esta vencido) resuelve casi al instante; uno
      // vencido intentaria refrescar por red, que puede no alcanzar a
      // completarse — mejor omitir este intento puntual y dejar que la cola de
      // reintento normal (siguiente carga) lo resuelva.
      token = await bridge.getIdToken(false);
    } catch (e) { token = null; }
    if (!token) return false;

    // Fase 5: mismo esquema por UID que el guardado normal, via el uid ya
    // disponible en el SDK (sin red extra -- este camino es para pagehide,
    // no puede esperar un fetch adicional para resolverlo). Si aun no hay
    // uid (transicion), sigue en el docId legado.
    var uid = getBridgeCurrentUid();
    var docId = uid
      ? guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "uid:" + uid, fileName)
      : guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName);
    var updatedAt = (snapshot && snapshot.updatedAt) || new Date().toISOString();
    var payload = {
      _usernameKey: docId,
      usernameKey: docId,
      _kind: "guide-data",
      scopeKey: scopeKey,
      fileName: fileName,
      updatedAt: updatedAt,
      snapshotJson: JSON.stringify(snapshot || {}),
    };
    try {
      fetch(docUrl(COL_PROGRESS, docId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(toFsDoc(payload)),
        keepalive: true,
      }).catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // Resuelve, al CARGAR una guia, cual version usar entre la copia local
  // (localStorage) y la de la nube: nunca reemplaza una respuesta remota
  // valida por una local vacia o mas vieja (auditoria 2026-08-22, Fase 1).
  // Reutiliza el MISMO merge por campo que ya protege el guardado
  // (mergeGuideState/mergeGuideValue) en vez de duplicar la logica de
  // "cual gana": aqui simplemente se decide el snapshot BASE segun el
  // timestamp y se combina con el otro para no perder campos sueltos.
  function resolveGuideHydration(localSnapshot, remoteSnapshot) {
    var local = plainObject(localSnapshot) ? localSnapshot : {};
    var remote = plainObject(remoteSnapshot) ? remoteSnapshot : null;
    if (!remote) return { state: snapshotState(local), updatedAt: local.updatedAt || "", source: "local" };

    var localTs = snapshotTimestamp(local);
    var remoteTs = snapshotTimestamp(remote);
    var remoteIsNewer = !Number.isFinite(localTs) || (Number.isFinite(remoteTs) && remoteTs > localTs);

    // mergeGuideState(previous, incoming) hace que "incoming" GANE cuando
    // ambos lados tienen valor (y "previous" solo sobrevive si incoming esta
    // vacio) -- por eso el snapshot MAS NUEVO va como "incoming" (gana el
    // conflicto real de un mismo campo) y el MAS VIEJO como "previous" (solo
    // rellena huecos que el mas nuevo ni toca).
    var newer = remoteIsNewer ? remote : local;
    var older = remoteIsNewer ? local : remote;
    var merged = mergeGuideState(snapshotState(older), snapshotState(newer), false);
    return {
      state: merged,
      updatedAt: (remoteIsNewer ? remote.updatedAt : local.updatedAt) || new Date().toISOString(),
      source: remoteIsNewer ? "remote" : "local",
    };
  }

  // Cola por documento (scopeKey+cloudFileName) para TODA escritura de
  // guide_state/guide-data, sin importar si la origina el admin o el propio
  // aprendiz. Cada escritura hace su propio ciclo leer-modificar-escribir
  // (varios round-trips: cloudGetGuideData, la re-lectura interna de
  // cloudSaveGuideData y el fsPatch final, que en Firestore REST sin
  // updateMask es un REEMPLAZO COMPLETO del documento). Si dos escrituras del
  // MISMO documento se solapan (el instructor califica varias actividades
  // seguidas, o el propio aprendiz dispara dos guardados casi simultaneos
  // desde la misma pestaña), cada una lee un snapshot desactualizado y la
  // ultima en llegar al servidor gana por completo, borrando lo que la otra ya
  // habia escrito -- el merge por timestamp (mergeGuideDataSnapshotForSave) no
  // alcanza a protegerlo porque solo compara contra lo que ELLA MISMA leyo, no
  // contra escrituras concurrentes de otro origen. Serializar por documento
  // (una escritura espera a que termine la anterior del MISMO aprendiz+archivo
  // antes de leer) elimina esa carrera sin tocar el merge por timestamp
  // existente (que sigue protegiendo ediciones reales llegadas desde OTRA
  // pestaña/dispositivo, ver resolveGuideHydration). Originalmente solo cubria
  // al admin (detectado 2026-07-25 calificando varias actividades seguidas);
  // generalizada 2026-08-22 (auditoria, Fase 5) porque el mismo bug aplicaba
  // igual a cloudSaveGuideData sin importar quien la llame.
  var guideStateWriteQueues = {};
  // Llaves para las que YA estamos ejecutando una tarea encolada ahora mismo.
  // Necesario porque adminApplySolutionToGuide/adminMarkActivityDelivered
  // encolan su *Impl COMPLETO (para que su propia lectura inicial tambien
  // quede serializada, ver mas abajo), y ese *Impl llama a su vez a
  // cloudSaveGuideData, que TAMBIEN encola con la MISMA llave. Sin este
  // marcador, la segunda llamada se encolaria detras de la primera -- pero la
  // primera nunca terminaria de resolverse porque esta esperando a que la
  // segunda (que ella misma disparo) resuelva primero: deadlock. Si la llave
  // ya esta "activa" (ya estamos dentro de su turno en la cola), se ejecuta
  // directamente: la serializacion de fondo ya esta garantizada por la tarea
  // exterior.
  var guideStateQueueActiveKeys = {};
  function withGuideStateWriteQueue(scopeKey, cloudFileName, task) {
    var queueKey = scopeKey + "|" + cloudFileName;
    if (guideStateQueueActiveKeys[queueKey]) {
      return Promise.resolve().then(task);
    }
    var previous = guideStateWriteQueues[queueKey] || Promise.resolve();
    var next = previous.catch(function () {}).then(function () {
      guideStateQueueActiveKeys[queueKey] = true;
      return Promise.resolve(task()).then(
        function (result) { guideStateQueueActiveKeys[queueKey] = false; return result; },
        function (err) { guideStateQueueActiveKeys[queueKey] = false; throw err; }
      );
    });
    guideStateWriteQueues[queueKey] = next;
    return next;
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
    var cloudFileNameForQueue = guideDataFileName(fileName);
    // Se encola el *Impl COMPLETO (no solo el guardado final): su propia
    // lectura inicial de cloudGetGuideData tambien debe esperar a que
    // terminen las escrituras previas de este mismo documento, o el
    // "nextState" que calcule quedaria basado en una foto vieja (ver el
    // comentario de withGuideStateWriteQueue sobre el marcador de reentrancia,
    // que evita que esto produzca un deadlock).
    return withGuideStateWriteQueue(scopeKey, cloudFileNameForQueue, function () {
      return adminApplySolutionToGuideImpl(usernameKey, fileName, fields);
    });
  }

  async function adminApplySolutionToGuideImpl(usernameKey, fileName, fields) {
    var key = String(usernameKey || "").trim().toLowerCase();
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
    var cloudFileNameForQueue = guideDataFileName(fileName);
    return withGuideStateWriteQueue(scopeKey, cloudFileNameForQueue, function () {
      return adminMarkActivityDeliveredImpl(usernameKey, fileName, activityId);
    });
  }

  async function adminMarkActivityDeliveredImpl(usernameKey, fileName, activityId) {
    var key = String(usernameKey || "").trim().toLowerCase();
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

  // knownCloudUser (opcional): el perfil YA leido por quien llama (la
  // comprobacion de carga de pagina) -- evita leer users/{key} dos veces.
  async function restoreStudentFromCloud(usernameKey, ficha, knownCloudUser) {
    try {
      var cloudUser = knownCloudUser || await cloudGetUser(usernameKey);
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
        // Solo entradas PRESENTES cuentan como "valor conocido en la nube"
        // (cloudGetProgress devuelve {} tambien ante un error: la ausencia no
        // se interpreta como nada).
        if (entry) rememberCloudProgress(usernameKey, key, entry);
      });

      // El home (portal_home.js) se pinta ANTES de que esta restauracion
      // termine (corre ~500ms despues de cargar): sin este aviso, en un equipo
      // nuevo el aprendiz veia "0% / todo pendiente" hasta recargar.
      try {
        document.dispatchEvent(new CustomEvent("portal-student-restored", {
          detail: { usernameKey: usernameKey },
        }));
      } catch (e2) { /* sin DOM (tests): ignorar */ }
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
      // Se espera (await) el guardado en Firebase antes de devolver el resultado:
      // el caller (index_auth.js) recarga la pagina justo despues de que esta
      // promesa resuelve, y un reload cancela cualquier fetch pendiente. Sin este
      // await, el registro quedaba solo en localStorage y nunca llegaba a
      // sena_portal_users, por lo que el aprendiz no aparecia en el panel admin.
      //
      // No se usa checkAvailability() como gate previo: es una sonda de red
      // aparte y si falla (timeout puntual) se abandonaba el guardado sin
      // pasar por la cola de reintento. cloudSaveUser -> fsPatch ya maneja
      // cuota/cooldown/red caida y cae a Drive con auto-promocion a Firestore
      // en la siguiente escritura exitosa (ver FIRESTORE_PROMOTE_KEY).
      try {
        var user = (result.user && result.user.usernameKey) ? result.user : null;
        if (!user && auth.getCurrentSession) {
          var s = auth.getCurrentSession();
          user = s && s.user && s.user.usernameKey ? s.user : null;
        }
        if (user) {
          var saved = await cloudSaveUser(user).catch(function (e) {
            console.warn("[firebase_db] Error guardando usuario en Firebase:", e && e.message);
            return false;
          });
          if (saved) {
            console.info("[firebase_db] Usuario guardado en Firebase: " + user.username);
          } else {
            console.warn("[firebase_db] No se pudo guardar el usuario al registrar (quedara en cola de reintento si cayo a Drive).");
          }
        }
      } catch (e) {
        console.warn("[firebase_db] Error inesperado sincronizando registro:", e && e.message);
      }
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
      // Sin cambios respecto al valor confirmado en la nube: no se escribe.
      if (cloudProgressUnchanged(usernameKey, fileNameToKey(fileName), completed, total)) return;
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
  // Pre-crea la cuenta Auth del email versionado "{key}.v{N}@sena-portal.local"
  // con la password nueva, via REST (identitytoolkit accounts:signUp). NO usa el
  // SDK para no tocar la sesion actual del admin. Dos razones:
  //   1. El aprendiz puede entrar desde cualquier equipo INMEDIATAMENTE (antes
  //      la cuenta solo se creaba en su proximo login exitoso).
  //   2. Seguridad: las reglas ahora aceptan el email versionado atestado en
  //      user_meta (isOwnerByVersionedEmail). Crear la cuenta EN el momento del
  //      reset cierra la ventana en la que un tercero podria registrar ese
  //      email versionado antes que el aprendiz.
  async function precreateVersionedAuthAccount(usernameKey, version, password) {
    try {
      if (!FIREBASE_API_KEY || !usernameKey || Number(version) <= 1 || !password) return false;
      var bridge = window.portalFirebaseAuth;
      var email = bridge && typeof bridge.buildEmail === "function"
        ? bridge.buildEmail(usernameKey, version)
        : String(usernameKey) + ".v" + Number(version) + "@sena-portal.local";
      var res = await fetchWithTimeout(
        "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + encodeURIComponent(FIREBASE_API_KEY),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password, returnSecureToken: false }),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) return true;
      var body = await res.json().catch(function () { return {}; });
      var code = (body && body.error && body.error.message) || res.status;
      console.warn(
        "[firebase_db] No se pudo pre-crear la cuenta Auth versionada " + email +
        " (" + code + "). El aprendiz aun puede entrar: el bridge creara la cuenta " +
        "en su proximo login. Si EMAIL_EXISTS persiste, vuelve a resetear la password."
      );
      return false;
    } catch (_) { return false; }
  }

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

          // Crear la cuenta Auth versionada ANTES de publicar la version en
          // user_meta (asi nadie puede adelantarse a reclamar ese email).
          await precreateVersionedAuthAccount(usernameKey, nextVersion, newPassword);

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

  // ── Codigo de invitacion por ficha (Fase 6) ─────────────────────────────────
  // Objetivo: conocer una ficha valida ya NO debe ser suficiente para
  // registrarse. CORREGIDO (revision de seguridad posterior al cierre
  // inicial de Fase 6): la primera version guardaba el codigo en Firestore
  // con lectura PUBLICA (sena_portal_ficha_codes, "allow get: if true") para
  // poder leerlo antes del login -- eso dejaba que CUALQUIERA que conociera
  // una ficha leyera el codigo real por Firestore REST sin sesion. El
  // codigo NUNCA fue secreto con ese diseno.
  //
  // Ahora ninguna de las dos funciones toca Firestore: ambas llaman al Apps
  // Script existente (entregas_actividades.gs, acciones
  // "verifyRegistrationCode"/"setRegistrationCode"), que compara/guarda un
  // HASH server-side (Script Properties, con un secreto que solo existe
  // ahi). El cliente nunca recibe el codigo ni un hash reutilizable -- solo
  // valido/no-valido.
  function getAppsScriptUrl() {
    var pi = window.PROJECT_INTEGRATIONS;
    var url = pi && typeof pi.googleAppsScriptUrl === "string" ? pi.googleAppsScriptUrl : "";
    return url.trim();
  }

  // Sin idToken (ocurre ANTES del login). Devuelve {ok, message} listo para
  // que registerStudentWithFirebaseBridge lo retorne tal cual si ok=false.
  // ok=false cubre TANTO "codigo incorrecto" como "no se pudo verificar" --
  // fail-closed en ambos casos, el registro nunca continua sin un ok=true
  // explicito del servidor.
  async function verifyRegistrationCode(ficha, code) {
    var endpoint = getAppsScriptUrl();
    if (!endpoint) {
      return { ok: false, message: "No fue posible verificar el codigo de registro en este momento. Intentalo nuevamente." };
    }
    try {
      var res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "verifyRegistrationCode", ficha: String(ficha || ""), code: String(code || "") }),
      }, API_TIMEOUT_MS);
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.ok === false) {
        return { ok: false, message: (data && data.message) || "No fue posible verificar el codigo de registro en este momento. Intentalo nuevamente." };
      }
      if (data.valid === true) return { ok: true };
      return { ok: false, message: "Codigo de registro no valido." };
    } catch (e) {
      return { ok: false, message: "No fue posible verificar el codigo de registro en este momento. Intentalo nuevamente." };
    }
  }

  // Admin-only (verificado server-side en Apps Script contra el idToken, no
  // contra nada que el cliente declare). El codigo en texto plano viaja UNA
  // sola vez, recien generado en el propio navegador del admin -- no se
  // guarda en ningun lado del lado cliente ni server, solo su hash.
  async function setRegistrationCode(ficha, code) {
    var endpoint = getAppsScriptUrl();
    if (!endpoint) return { ok: false, message: "Integracion con Apps Script no configurada." };
    var idToken = null;
    try {
      var bridge = window.portalFirebaseAuth;
      if (bridge && typeof bridge.getIdToken === "function") idToken = await bridge.getIdToken(false);
    } catch (e) { idToken = null; }
    if (!idToken) return { ok: false, message: "Sesion administrativa no disponible. Vuelve a iniciar sesion." };
    try {
      var res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "setRegistrationCode", idToken: idToken, ficha: String(ficha || ""), code: String(code || "") }),
      }, API_TIMEOUT_MS);
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || data.ok !== true) {
        return { ok: false, message: (data && data.message) || "No se pudo guardar el codigo." };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: "No se pudo guardar el codigo." };
    }
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
  // Estado de la ultima carga de progreso de aprendices (para avisar en el
  // panel si el respaldo desde datos de guia no se pudo consultar).
  var lastStudentsProgressLoad = null;
  var forceNextProgressListing = false; // "Actualizar datos": relee el listado
  var PROGRESS_CONTROL_KEYS = { reabierta: true, permiteEdicion: true, updatedAt: true, updatedBy: true };

  // Documentos de nube de una guia para derivar su avance: el alias de esta
  // tabla (guideDataFileName) y, si guide_declarations.js declara otro en
  // cloudFileNames, tambien ese (p. ej. 10?_guia6mant.html, o el quiz jfk_ de
  // la Guia 10 RAP01 de Kennedy, cuya guia guarda con el nombre crudo).
  // usernameKey -> uid de la ultima lista de aprendices (la lista del panel
  // pasa por sanitizeUser, que descarta el uid).
  var lastListedUids = {};

  // Estado combinado de UNA guia de UN aprendiz a partir de un listado
  // (cloudListAllGuideDataDocs): misma semantica que readGuideStateDoc
  // (progress antes que guide_state; legado + UID) para cada nombre de
  // documento de la guia; los estados de varios nombres se unen.
  // -> { state, updatedAt } | null
  function guideSnapshotFromListing(docs, usernameKey, uid, fileName) {
    if (!docs) return null;
    var pick = function (docId) { return docs.progress.get(docId) || docs.guideState.get(docId) || null; };
    var merged = {};
    var found = false;
    var newest = "";
    guideCloudFileNamesForProgress(fileName).forEach(function (name) {
      var legacy = pick(guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "student:" + usernameKey, name));
      var uidDoc = uid ? pick(guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "uid:" + uid, name)) : null;
      var doc = mergeLegacyAndUidGuideStateDocs(legacy, uidDoc);
      var snapshot = doc ? readSnapshotPayload(doc) : null;
      if (!snapshot || typeof snapshot !== "object") return;
      var st = snapshot.state && typeof snapshot.state === "object" ? snapshot.state
        : (snapshot.data && typeof snapshot.data === "object" ? snapshot.data : null);
      if (!st) return;
      found = true;
      Object.assign(merged, st);
      if (String(snapshot.updatedAt || "") > newest) newest = String(snapshot.updatedAt || "");
    });
    return found ? { state: merged, updatedAt: newest } : null;
  }

  // Estados de guia de TODOS los aprendices a partir del ULTIMO listado ya
  // descargado para el progreso (0 lecturas). Para los indicadores del
  // dashboard y Reportes. null si no hay listado en memoria.
  function getGuideStatesFromLastListing(users, guidesForFicha) {
    if (!_guideDataListing || !_guideDataListing.result || !_guideDataListing.result.docs) return null;
    var docs = _guideDataListing.result.docs;
    var entries = [];
    (users || []).forEach(function (u) {
      if (!u || !u.usernameKey) return;
      (guidesForFicha(u.ficha) || []).forEach(function (fileName) {
        var snap = guideSnapshotFromListing(docs, u.usernameKey, lastListedUids[u.usernameKey] || "", fileName);
        if (snap) entries.push({ usernameKey: u.usernameKey, fileName: fileName, state: snap.state, updatedAt: snap.updatedAt });
      });
    });
    return { at: _guideDataListing.at, entries: entries };
  }

  function guideCloudFileNamesForProgress(fileName) {
    var names = [guideDataFileName(fileName)];
    var std = window.ActivityStandard;
    var cfg = std && typeof std.getConfigForGuide === "function" ? std.getConfigForGuide(fileName) : null;
    var declared = cfg && cfg.cloudFileNames && cfg.cloudFileNames[fileName];
    if (declared && names.indexOf(declared) === -1) names.push(declared);
    return names;
  }

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

      // Respaldo de progreso desde los DATOS de la guia, solo para las guias
      // sin entrada de progreso (total > 0). Correccion 2026-10-22:
      //   - antes se pedian por nombre (batchGet) todas las combinaciones
      //     aprendiz x guia, con el nombre codificado: Firestore las reportaba
      //     TODAS como inexistentes (cada una contaba como lectura) y este
      //     respaldo nunca encontraba nada;
      //   - solo se miraba el documento legado (student:...), no el nuevo por
      //     UID (Fase 5), ni los alias declarados en guide_declarations.js.
      // Ahora se listan los documentos __guide_data__ que EXISTEN (una lectura
      // por documento existente) y se combinan como readGuideStateDoc:
      // progress antes que guide_state; legado + UID con
      // mergeLegacyAndUidGuideStateDocs.
      cloudUsers.forEach(function (user) {
        if (user && user.usernameKey && user.uid) lastListedUids[user.usernameKey] = String(user.uid);
      });
      var guideDataRequests = [];
      cloudUsers.forEach(function (user) {
        auth.getGuidesForFicha(user.ficha || "").forEach(function (fileName) {
          var progressKey = fileNameToKey(fileName);
          var entry = progressByUser[user.usernameKey] && progressByUser[user.usernameKey][progressKey];
          if (entry && Number(entry.total) > 0) return;
          guideDataRequests.push({ user: user, usernameKey: user.usernameKey, fileName: fileName, progressKey: progressKey });
        });
      });

      lastStudentsProgressLoad = { status: "ok", reason: "", guideDataDocs: 0, at: new Date().toISOString() };
      if (guideDataRequests.length) {
        var listed = await cloudListAllGuideDataDocs({ force: forceNextProgressListing });
        forceNextProgressListing = false;
        lastStudentsProgressLoad.status = listed.status;
        lastStudentsProgressLoad.reason = listed.reason;
        if (listed.docs) {
          lastStudentsProgressLoad.guideDataDocs = listed.docs.progress.size + listed.docs.guideState.size;
          guideDataRequests.forEach(function (item) {
            var snap = guideSnapshotFromListing(listed.docs, item.usernameKey, item.user.uid || "", item.fileName);
            if (!snap) return;
            var states = [snap.state];
            var newest = snap.updatedAt;
            var answers = {};
            states.forEach(function (st) {
              Object.keys(st).forEach(function (k) {
                // Candados, metadatos de entrega y banderas del admin NO son
                // respuestas del aprendiz: no cuentan como avance.
                if (/-(locked|delivery)$/.test(k) || /^_/.test(k) || PROGRESS_CONTROL_KEYS[k]) return;
                answers[k] = st[k];
              });
            });
            var derived = deriveProgressFromGuideDataDoc(item.fileName, { snapshotJson: JSON.stringify({ state: answers, updatedAt: newest }) });
            if (!derived) return;
            if (!progressByUser[item.usernameKey]) {
              progressByUser[item.usernameKey] = {};
            }
            progressByUser[item.usernameKey][item.progressKey] = derived;
          });
        }
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
          await restoreStudentFromCloud(usernameKey, ficha, cloudUser);
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

  // ── Promocion masiva Drive → Firestore (sanador one-shot, solo admin) ───────
  // Durante el periodo en que las reglas rechazaban los docIds compuestos (403),
  // TODAS las respuestas de guia de los aprendices quedaron SOLO en Drive.
  // Esta funcion recorre el roster (aprendices x guias), lee cada doc de Drive
  // y lo escribe en Firestore si alli falta o esta mas viejo (compara updatedAt).
  // Con eso el camino rapido del panel (fsBatchGet) vuelve a ver todo y el
  // barrido de Respuestas puede saltarse Drive en los 404 reales.
  var DRIVE_PROMOTED_FLAG_KEY = "sena_portal_drive_promoted_v1";

  function markDrivePromotionDone() {
    try { window.localStorage.setItem(DRIVE_PROMOTED_FLAG_KEY, new Date().toISOString()); } catch (_) {}
  }

  function isDrivePromotionDone() {
    try { return Boolean(window.localStorage.getItem(DRIVE_PROMOTED_FLAG_KEY)); } catch (_) { return false; }
  }

  async function firestoreGetDirect(collection, docId) {
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        { method: "GET", cache: "no-store", headers: await authHeaders() },
        API_TIMEOUT_MS
      );
      if (!res.ok) return null;
      registerFirestoreOperation("read", 1);
      return fromFsDoc(await res.json());
    } catch (_) { return null; }
  }

  async function backfillFromDrive(options) {
    var opts = options || {};
    var onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    if (!isDriveFallbackEnabled()) {
      return { ok: false, message: "Drive no configurado (falta respaldoFirestoreUrl)." };
    }
    var portal = window.portalAuth || {};
    if (typeof portal.getGuidesForFicha !== "function") {
      return { ok: false, message: "portalAuth no disponible: abre esta funcion desde el panel admin." };
    }
    var users = Array.isArray(opts.users) && opts.users.length
      ? opts.users
      : await cloudListUsers();
    if (!users.length) return { ok: false, message: "No hay aprendices para promover." };

    // Construir la lista exacta de docIds que puede tener cada aprendiz:
    // su doc simple de progreso + un doc compuesto de guide-data por guia.
    var tasks = [];
    users.forEach(function (user) {
      var key = user && user.usernameKey;
      if (!key) return;
      tasks.push({ collection: COL_PROGRESS, docId: key });
      portal.getGuidesForFicha(user.ficha || "").forEach(function (fileName) {
        tasks.push({
          collection: COL_PROGRESS,
          docId: guideStateDocId(GUIDE_DATA_FALLBACK_PREFIX, "student:" + key, guideDataFileName(fileName)),
        });
      });
    });

    var report = { ok: true, total: tasks.length, promoted: 0, skipped: 0, missing: 0, errors: 0 };
    var index = 0;
    var CONCURRENCY = 6;

    async function worker() {
      while (index < tasks.length) {
        var task = tasks[index];
        index += 1;
        try {
          var driveDoc = await driveFallbackGet(task.collection, task.docId);
          if (!driveDoc) { report.missing += 1; }
          else {
            var clean = Object.assign({}, driveDoc);
            delete clean._docId;
            delete clean._docName;
            var current = await firestoreGetDirect(task.collection, task.docId);
            var driveAt = String(driveDoc.updatedAt || "");
            var fsAt = String((current && current.updatedAt) || "");
            if (current && fsAt && driveAt && fsAt >= driveAt) {
              report.skipped += 1; // Firestore ya esta igual o mas nuevo
            } else {
              var promoted = await tryFirestorePromote({ type: "set", collection: task.collection, docId: task.docId, data: clean });
              if (promoted) report.promoted += 1; else report.errors += 1;
            }
          }
        } catch (_) { report.errors += 1; }
        if (onProgress) onProgress({ done: index, total: tasks.length, promoted: report.promoted, errors: report.errors });
      }
    }

    var workers = [];
    for (var w = 0; w < CONCURRENCY; w++) workers.push(worker());
    await Promise.all(workers);

    if (report.errors === 0) markDrivePromotionDone();
    console.info(
      "[backfillFromDrive] Total " + report.total + " · promovidos " + report.promoted +
      " · ya al dia " + report.skipped + " · sin datos " + report.missing + " · errores " + report.errors
    );
    return report;
  }

  // API de depuracion (solo disponible en consola del navegador)

  // ════════════════════════════════════════════════════════════════════════════
  //  SEGUIMIENTO DEL LABORATORIO VIRTUAL (sena_portal_hwlab_attempts)
  //  Estricto a proposito: SIN respaldo en Drive (el historial academico vive
  //  solo en Firestore) y sin reintentos aqui -- la cola local de
  //  hardware_lab_attempts.js reintenta. La creacion usa :commit con
  //  precondicion "el documento no existe" y la hora del SERVIDOR en
  //  recibidoEn (la regla exige recibidoEn == request.time): reenviar el mismo
  //  intento nunca crea un segundo documento ni reescribe el primero.
  // ════════════════════════════════════════════════════════════════════════════
  async function cloudCreateHwlabAttempt(attempt) {
    if (!attempt || !attempt.attemptId) return { status: "invalid" };
    if (shouldBlockCloudWrites()) return { status: "quota" };
    if (!(await canCallFirestore(COL_HWLAB_ATTEMPTS, true))) return { status: "offline" };
    var data = Object.assign({}, attempt);
    delete data.recibidoEn;
    var docName = BASE_URL.replace(/^https:\/\/firestore\.googleapis\.com\/v1\//, "") + "/" + COL_HWLAB_ATTEMPTS + "/" + attempt.attemptId;
    var body = { writes: [{
      update: { name: docName, fields: toFsDoc(data).fields },
      updateTransforms: [{ fieldPath: "recibidoEn", setToServerValue: "REQUEST_TIME" }],
      currentDocument: { exists: false },
    }] };
    try {
      var res = await fetchWithTimeout(BASE_URL + ":commit?key=" + FIREBASE_API_KEY, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      }, API_TIMEOUT_MS);
      if (res.ok) {
        registerFirestoreOperation("write", 1);
        markFirestoreSuccess();
        return { status: "created" };
      }
      // Ya existia (reenvio del mismo intento) o la regla lo trato como
      // "update" y lo nego: se confirma leyendo el propio documento.
      if (res.status === 409 || res.status === 400 || res.status === 403) {
        var existing = await cloudGetHwlabAttempt(attempt.attemptId);
        if (existing && existing.status === "found") return { status: "exists" };
        return { status: res.status === 403 ? "denied" : "rejected", httpStatus: res.status };
      }
      if (isTransientHttpStatus(res.status)) return { status: "offline", httpStatus: res.status };
      return { status: "rejected", httpStatus: res.status };
    } catch (e) {
      return { status: "offline" };
    }
  }

  async function cloudGetHwlabAttempt(attemptId) {
    if (!attemptId) return { status: "invalid" };
    if (!(await canCallFirestore(COL_HWLAB_ATTEMPTS, false, { firestoreFirst: true }))) return { status: "offline" };
    try {
      var res = await fetchWithTimeout(docUrl(COL_HWLAB_ATTEMPTS, attemptId), {
        method: "GET", cache: "no-store", headers: await authHeaders(),
      }, API_TIMEOUT_MS);
      registerFirestoreOperation("read", 1);
      if (res.ok) return { status: "found", doc: fromFsDoc(await res.json()) };
      if (res.status === 404) return { status: "missing" };
      return { status: isAuthRejection(res.status) ? "denied" : "error", httpStatus: res.status };
    } catch (e) {
      return { status: "offline" };
    }
  }

  // Consulta por UN campo de igualdad ("ficha" para el panel, "uid" para el
  // detalle y para "Mi progreso"): usa los indices automaticos de campo unico;
  // el orden por fecha se hace en el cliente. Devuelve tambien cuantas
  // lecturas facturo Firestore (1 minimo aunque no haya resultados).
  async function cloudQueryHwlabAttempts(field, value, opts) {
    if (field !== "ficha" && field !== "uid") return { status: "invalid", docs: [], reads: 0 };
    if (!(await canCallFirestore(COL_HWLAB_ATTEMPTS, false, { firestoreFirst: true }))) return { status: "offline", docs: [], reads: 0 };
    var limit = (opts && opts.limit) || 2000;
    try {
      var res = await fetchWithTimeout(BASE_URL + ":runQuery?key=" + FIREBASE_API_KEY, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: COL_HWLAB_ATTEMPTS }],
          where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: String(value) } } },
          limit: limit,
        } }),
      }, API_TIMEOUT_MS);
      if (!res.ok) return { status: isAuthRejection(res.status) ? "denied" : "error", httpStatus: res.status, docs: [], reads: 1 };
      var rows = await res.json();
      var docs = (Array.isArray(rows) ? rows : []).map(function (r) { return r && r.document ? fromFsDoc(r.document) : null; }).filter(Boolean);
      var reads = Math.max(1, docs.length);
      registerFirestoreOperation("read", reads);
      markFirestoreSuccess();
      return { status: "ok", docs: docs, reads: reads };
    } catch (e) {
      return { status: "offline", docs: [], reads: 0 };
    }
  }

  // Riesgo B: sin sesion admin en esta pagina no debe quedar ningun listado de
  // respuestas de aprendices en el navegador (cierre de sesion, otra cuenta).
  try {
    if (window.portalAuth && typeof window.portalAuth.isAdminSession === "function" && !isCurrentUserAdmin()) clearAdminListingCache();
  } catch (e) {}

  window._firebaseDb = {
    clearAdminListingCache: clearAdminListingCache,
    cloudCreateHwlabAttempt: cloudCreateHwlabAttempt,
    cloudGetHwlabAttempt: cloudGetHwlabAttempt,
    cloudQueryHwlabAttempts: cloudQueryHwlabAttempts,
    checkAvailability: checkAvailability,
    backfillToDrive:   backfillToDrive,
    backfillFromDrive: backfillFromDrive,
    isDrivePromotionDone: isDrivePromotionDone,
    fsList:            fsList,
    fsBatchGet:        fsBatchGet,
    _precreateVersionedAuthAccount: precreateVersionedAuthAccount,
    cloudGetCalendar:  cloudGetCalendar,
    cloudSaveCalendar: cloudSaveCalendar,
    cloudGetGuideData: cloudGetGuideData,
    cloudReadGuideDataDetailed: cloudReadGuideDataDetailed,
    cloudListAllGuideDataDocs: cloudListAllGuideDataDocs,
    cloudListGuideDataSince: cloudListGuideDataSince,
    getLastStudentsProgressLoad: function () { return lastStudentsProgressLoad; },
    // "Actualizar datos": la proxima carga de la lista vuelve a listar los datos de guia.
    getGuideStatesFromLastListing: getGuideStatesFromLastListing,
    forceNextStudentsProgressListing: function () { forceNextProgressListing = true; invalidateGuideDataListing(); },
    guideStateDocId: guideStateDocId,
    fileNameToKey: fileNameToKey,
    cloudSaveGuideData: cloudSaveGuideData,
    // Lectura/escritura ESTRICTAS (sin failover a Drive, con precondicion):
    // Agenda "Agregar clase" y registro propio de Etapa Productiva.
    cloudGetCalendarStrict: cloudGetCalendarStrict,
    cloudUpdateCalendarStrict: cloudUpdateCalendarStrict,
    cloudGetGuideDataStrict: cloudGetGuideDataStrict,
    cloudUpdateGuideDataStrict: cloudUpdateGuideDataStrict,
    guideDataFileName: guideDataFileName,
    adminApplySolutionToGuide: adminApplySolutionToGuide,
    adminMarkActivityDelivered: adminMarkActivityDelivered,
    cloudGetGrades: cloudGetGrades,
    cloudSaveGrades: cloudSaveGrades,
    // Calificar: lectura estricta + escritura por familia con precondicion.
    cloudGetGradesStrict: cloudGetGradesStrict,
    cloudUpdateGradesStrict: cloudUpdateGradesStrict,
    cloudGetGradeCommentsStrict: cloudGetGradeCommentsStrict,
    cloudSaveGradeCommentsStrict: cloudSaveGradeCommentsStrict,
    cloudGetSignatureAuth: cloudGetSignatureAuth,
    cloudSaveSignatureAuth: cloudSaveSignatureAuth,
    cloudGetStudentSummary: cloudGetStudentSummary,
    cloudSaveStudentSummary: cloudSaveStudentSummary,
    cloudGetGradeSolutions: cloudGetGradeSolutions,
    cloudSaveGradeSolutions: cloudSaveGradeSolutions,
    cloudGetGradeComments: cloudGetGradeComments,
    cloudSaveGradeComments: cloudSaveGradeComments,
    cloudGetImprovementPlans: cloudGetImprovementPlans,
    cloudSaveImprovementPlans: cloudSaveImprovementPlans,
    // Planes y talleres: lectura estricta + cola de operaciones por id (2026-10-27).
    cloudGetImprovementPlansStrict: cloudGetImprovementPlansStrict,
    cloudGetReinforcementWorkshopsStrict: cloudGetReinforcementWorkshopsStrict,
    cloudGetRecordListStrict: cloudGetRecordListStrict,
    cloudUpdateRecordListStrict: cloudUpdateRecordListStrict,
    applyRecordListOp: applyRecordListOp,
    createRecordListSync: createRecordListSync,
    describeCloudWriteFailure: describeCloudWriteFailure,
    cloudGetReinforcementAnswersStrict: cloudGetReinforcementAnswersStrict,
    cloudSaveReinforcementAnswerFields: cloudSaveReinforcementAnswerFields,
    cloudGetReinforcementWorkshops: cloudGetReinforcementWorkshops,
    cloudSaveReinforcementWorkshops: cloudSaveReinforcementWorkshops,
    cloudGetReinforcementAnswers: cloudGetReinforcementAnswers,
    cloudSaveReinforcementAnswers: cloudSaveReinforcementAnswers,
    mergeGuideDataSnapshotForSave: mergeGuideDataSnapshotForSave,
    resolveGuideHydration: resolveGuideHydration,
    mergeGuideState: mergeGuideState,
    cloudGetUser: cloudGetUser,
    cloudSaveUser: cloudSaveUser,
    // Fase 5 (migracion a UID): expuestos para pruebas unitarias directas.
    resolveUidForScope: resolveUidForScope,
    mergeLegacyAndUidGuideStateDocs: mergeLegacyAndUidGuideStateDocs,
    // Fase 5 (cierre promocion Drive -> Firestore): expuestos para probar
    // que la promocion nunca reconstruye el propietario desde username.
    tryFirestorePromote: tryFirestorePromote,
    flushPendingPromotions: flushPendingPromotions,
    readPendingPromotions: readPendingPromotions,
    cloudSaveGuideDataKeepalive: cloudSaveGuideDataKeepalive,
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
    verifyRegistrationCode:   verifyRegistrationCode,
    setRegistrationCode:      setRegistrationCode,
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
