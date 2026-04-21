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
      if (res.status === 404) return null;
      if (!res.ok)            return null;
      return fromFsDoc(await res.json());
    } catch (e) { return null; }
  }

  // PATCH (upsert completo) de un documento.
  async function fsPatch(collection, docId, data) {
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
      return res.ok;
    } catch (e) { return false; }
  }

  // PATCH con updateMask: actualiza solo el campo indicado sin borrar los demas.
  async function fsUpdateField(collection, docId, fieldName, fieldValue) {
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
      return (payload.documents || []).map(fromFsDoc).filter(Boolean);
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
