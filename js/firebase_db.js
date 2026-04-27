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
  var COL_PROGRESS = "sena_portal_progress";
  var COL_CALENDAR = "sena_portal_calendar";
  var COL_GUIDE_STATE = "sena_portal_guide_state";
  var COL_TUTORING = "sena_portal_tutoring_bookings";
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
  var FIRESTORE_DAILY_BUDGET_LIMITS = {
    read: { warn: 30000, restrict: 40000, block: 45000 },
    write: { warn: 8000, restrict: 12000, block: 16000 },
    delete: { warn: 100, restrict: 300, block: 500 },
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
    var result = {};
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

  // GET un documento. Retorna objeto JS o null.
  async function fsGet(collection, docId) {
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        { method: "GET", cache: "no-store" },
        API_TIMEOUT_MS
      );
      if (res.status === 404) {
        registerFirestoreOperation("read", 1);
        return null;
      }
      if (!res.ok) return null;
      var payload = await res.json();
      registerFirestoreOperation("read", 1);
      return fromFsDoc(payload);
    } catch (e) { return null; }
  }

  // PATCH (upsert completo) de un documento.
  async function fsPatch(collection, docId, data) {
    if (shouldBlockCloudWrites()) return false;
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(toFsDoc(data)),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) registerFirestoreOperation("write", 1);
      return res.ok;
    } catch (e) { return false; }
  }

  async function fsDelete(collection, docId) {
    if (shouldBlockCloudDeletes()) return false;
    try {
      var res = await fetchWithTimeout(
        docUrl(collection, docId),
        { method: "DELETE" },
        API_TIMEOUT_MS
      );
      if (res.ok || res.status === 404) registerFirestoreOperation("delete", 1);
      return res.ok || res.status === 404;
    } catch (e) { return false; }
  }

  // PATCH con updateMask: actualiza solo el campo indicado sin borrar los demas.
  async function fsUpdateField(collection, docId, fieldName, fieldValue) {
    if (shouldBlockCloudWrites()) return false;
    try {
      var body = { fields: {} };
      body.fields[fieldName] = toFsValue(fieldValue);
      var res = await fetchWithTimeout(
        docUrl(collection, docId, "updateMask.fieldPaths=" + encodeURIComponent(fieldName)),
        {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        },
        API_TIMEOUT_MS
      );
      if (res.ok) registerFirestoreOperation("write", 1);
      return res.ok;
    } catch (e) { return false; }
  }

  // Lista todos los documentos de una coleccion (hasta 300).
  async function fsList(collection) {
    try {
      var url = BASE_URL + "/" + collection + "?key=" + FIREBASE_API_KEY + "&pageSize=300";
      var res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, API_TIMEOUT_MS);
      if (!res.ok) return [];
      var payload = await res.json();
      var docs = (payload.documents || []).map(fromFsDoc).filter(Boolean);
      registerFirestoreOperation("read", Math.max(1, docs.length));
      return docs;
    } catch (e) { return []; }
  }

  // BatchGet: obtiene multiples documentos en una sola solicitud.
  async function fsBatchGet(collection, docIds) {
    if (!docIds || docIds.length === 0) return [];
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
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ documents: docPaths }),
        },
        API_TIMEOUT_MS
      );
      if (!res.ok) return [];
      var results = await res.json();
      if (!Array.isArray(results)) return [];
      registerFirestoreOperation("read", Math.max(1, docIds.length));
      return results.map(function (r) { return r.found ? fromFsDoc(r.found) : null; }).filter(Boolean);
    } catch (e) { return []; }
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
        var res = await fetchWithTimeout(url, { method: "GET", cache: "no-store" }, CHECK_TIMEOUT_MS);
        var ok = res.ok || res.status === 200 || res.status === 404;
        if (ok) registerFirestoreOperation("read", 1);
        if (ok) availabilityCache = true; // Solo cachear si funciono
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

  async function cloudGetUser(usernameKey) {
    return fsGet(COL_USERS, usernameKey);
  }

  async function cloudSaveUser(user) {
    if (!user || !user.usernameKey) return false;
    return fsPatch(COL_USERS, user.usernameKey, user);
  }

  async function cloudListUsers() {
    return fsList(COL_USERS);
  }

  async function cloudGetProgress(usernameKey) {
    var doc = await fsGet(COL_PROGRESS, usernameKey);
    return doc || {};
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
      "11a_guia.html",
      "11b_guia.html",
      "11a_guia6.html",
      "11b_guia6.html",
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
      "grupo-10a-guia-02-ficha-caso.html",
      "grupo-10b-guia-02-ficha-caso.html",
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
    if (fallbackSaved) return true;
    return fsPatch(COL_CALENDAR, calendarId, payload);
  }

  function guideStateDocId(prefix, scopeKey, fileName) {
    return prefix + safeCloudKey(scopeKey) + ":" + fileNameToKey(fileName);
  }

  async function readGuideStateDoc(prefix, scopeKey, fileName) {
    var docId = guideStateDocId(prefix, scopeKey, fileName);
    var fallbackDoc = await fsGet(COL_PROGRESS, docId);
    if (fallbackDoc) return fallbackDoc;
    return fsGet(COL_GUIDE_STATE, docId);
  }

  async function saveGuideStateDoc(prefix, kind, scopeKey, fileName, payload) {
    var docId = guideStateDocId(prefix, scopeKey, fileName);
    var fallbackSaved = await fsPatch(COL_PROGRESS, docId, Object.assign({
      _usernameKey: docId,
      _kind: kind,
    }, payload));
    if (fallbackSaved) return true;
    return fsPatch(COL_GUIDE_STATE, docId, payload);
  }

  async function cloudGetGuideData(scopeKey, fileName) {
    if (!scopeKey || !fileName) return null;
    var doc = await readGuideStateDoc(GUIDE_DATA_FALLBACK_PREFIX, scopeKey, fileName);
    if (!doc) return null;
    if (typeof doc.snapshotJson === "string") {
      try { return JSON.parse(doc.snapshotJson); } catch (e) {}
    }
    return doc;
  }

  async function cloudSaveGuideData(scopeKey, fileName, snapshot) {
    if (!scopeKey || !fileName) return false;
    var updatedAt = (snapshot && snapshot.updatedAt) || new Date().toISOString();
    var payload = {
      scopeKey: scopeKey,
      fileName: fileName,
      updatedAt: updatedAt,
      snapshotJson: JSON.stringify(snapshot || {}),
    };
    return saveGuideStateDoc(
      GUIDE_DATA_FALLBACK_PREFIX,
      "guide-data",
      scopeKey,
      fileName,
      payload
    );
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
    if (!available) return localResult;

    var usernameKey = String((data && data.username) || "").trim().toLowerCase();
    var password    = String((data && data.password) || "").trim();
    if (!usernameKey || !password) return localResult;

    var cloudUser = await cloudGetUser(usernameKey);
    if (!cloudUser || !cloudUser.usernameKey) {
      return { ok: false, message: "No existe un usuario registrado con ese nombre." };
    }

    // Verificar contrasena contra el hash guardado en Firebase
    var hash = typeof auth.hashSecret === "function" ? await auth.hashSecret(password) : null;
    if (!hash || hash !== cloudUser.passwordHash) {
      return { ok: false, message: "La contrasena no es correcta." };
    }

    // Restaurar usuario y progreso en localStorage, luego reintentar el login local
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
          if (hash) {
            cloudSaveUser(Object.assign({}, cloudUser, {
              passwordHash: hash,
              updatedAt:    new Date().toISOString(),
            })).catch(function () {});
          }
        } catch (e) { /* silencioso */ }
      });
    }
    return result;
  };

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
    if (result && result.ok) {
      var ok = await checkAvailability();
      if (ok && result.user) {
        try {
          await syncStudentProfileToFirebase(result.previousUsernameKey || usernameKey, result.user);
        } catch (e) { /* silencioso */ }
      }
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

      // Indexar progreso por usernameKey
      var progressIndex = {};
      progressDocs.forEach(function (doc) {
        if (doc && doc._usernameKey) {
          progressIndex[doc._usernameKey] = doc;
        }
      });

      // Como batchGet no garantiza orden ni incluye el usernameKey en el doc,
      // hacemos la asociacion por posicion solo si los docs tienen alguna clave
      // identificadora. En su defecto, consultamos individualmente (cache local).
      // Solucion robusta: construir el mapa a partir del nombre del documento
      // (no disponible en fromFsDoc). Usamos la alternativa de leer el campo
      // especial que guardamos en cada documento de progreso.

      // Para mayor robustez, leemos el progreso de cada usuario en paralelo
      // solo cuando batchGet no devuelve datos con identificador claro.
      var needsIndividualFetch = progressDocs.length === 0 && cloudUsers.length > 0;
      var progressByUser       = {};

      if (needsIndividualFetch) {
        var fetches = cloudUsers.map(async function (u) {
          var p = await cloudGetProgress(u.usernameKey);
          progressByUser[u.usernameKey] = p || {};
        });
        await Promise.all(fetches);
      } else {
        // batchGet devuelve docs en el mismo orden que los IDs solicitados
        cloudUsers.forEach(function (u, i) {
          progressByUser[u.usernameKey] = progressDocs[i] || {};
        });
      }

      // Construir el array final con avance por guia
      var result = cloudUsers.map(function (user) {
        var progMap = progressByUser[user.usernameKey] || {};
        var guides  = auth.getGuidesForFicha(user.ficha || "").map(function (fileName) {
          var key   = fileNameToKey(fileName);
          var entry = progMap[key] || {};
          var tot   = Math.max(0, Number(entry.total)     || 0);
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

  // API de depuracion (solo disponible en consola del navegador)
  window._firebaseDb = {
    checkAvailability: checkAvailability,
    cloudGetCalendar:  cloudGetCalendar,
    cloudSaveCalendar: cloudSaveCalendar,
    cloudGetGuideData: cloudGetGuideData,
    cloudSaveGuideData: cloudSaveGuideData,
    cloudGetGuideUiState: cloudGetGuideUiState,
    cloudSaveGuideUiState: cloudSaveGuideUiState,
    cloudListTutoringBookings:        cloudListTutoringBookings,
    cloudListTutoringBookingsForDate: cloudListTutoringBookingsForDate,
    cloudGetTutoringBooking:          cloudGetTutoringBooking,
    cloudSaveTutoringBooking:         cloudSaveTutoringBooking,
    cloudDeleteTutoringBooking:       cloudDeleteTutoringBooking,
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

/* ═══════════════════════════════════════════════════════════════════════════
   INSTRUCCIONES DE CONFIGURACION PASO A PASO
   ═══════════════════════════════════════════════════════════════════════════

   1. Ve a: https://console.firebase.google.com/
   2. Haz clic en "Agregar proyecto" → ponle un nombre (ej: "sena-portal")
   3. Desactiva Google Analytics si no lo necesitas → "Crear proyecto"

   4. En el menu izquierdo: Compilacion → Firestore Database
   5. Clic en "Crear base de datos"
      - Ubicacion: nam5 (EE.UU.) o southamerica-east1 (Sao Paulo, mas cercano)
      - Reglas: elige "Comenzar en modo de produccion"
   6. Una vez creada, ve a la pestana "Reglas" y reemplaza el contenido con:

   ─────────────────────────────────────────────────────────────────────────
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ─────────────────────────────────────────────────────────────────────────
   Haz clic en "Publicar".

   7. En el menu izquierdo: Configuracion del proyecto (icono engranaje)
   8. Desplazate hasta "Tus apps" → Haz clic en el icono </> (web)
   9. Registra la app con cualquier apodo → "Registrar app"
   10. Firebase te mostrara un objeto firebaseConfig similar a este:
       const firebaseConfig = {
         apiKey:            "tu-api-key-web",
         authDomain:        "tu-proyecto.firebaseapp.com",
         projectId:         "tu-project-id-web",
         storageBucket:     "tu-proyecto.appspot.com",
         messagingSenderId: "123456789",
         appId:             "1:123456789:web:abc123"
       };

   11. En este archivo (firebase_db.js), reemplaza al inicio:
       localStorage.setItem("sena_portal_firebase_runtime_v1", JSON.stringify({
         enabled: true,
         projectId: "tu-project-id-web",
         apiKey: "tu-api-key-web"
       }));

   12. Sube los cambios a GitHub Pages y prueba registrando un usuario.
       Para verificar que funciona, abre la consola del navegador (F12)
       y escribe: _firebaseDb.checkAvailability()
       Debe retornar: Promise {true}

   ═══════════════════════════════════════════════════════════════════════════
   PLAN GRATUITO DE FIREBASE (Spark):
   - Almacenamiento: 1 GB (mas que suficiente para cientos de estudiantes)
   - Lecturas/dia:  50,000
   - Escrituras/dia: 20,000
   - Sin tarjeta de credito requerida
   ═══════════════════════════════════════════════════════════════════════════ */
