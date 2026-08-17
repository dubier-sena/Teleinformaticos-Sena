/* js/hardware_lab_storage.js
 *
 * Persistencia del Laboratorio Virtual de Hardware. Reutiliza POR COMPLETO
 * la arquitectura existente (ver CLAUDE.md "Storage: localStorage-first +
 * Firebase cloud backup"): ningun dato del simulador vive en una coleccion
 * nueva ni requiere cambios a firestore.rules.
 *
 * Como encaja en lo existente:
 *  - Se trata como una "guia" sintetica de fileKey fijo
 *    FILE_KEY = "laboratorio-virtual-hardware.html" (nunca se sirve como
 *    pagina de una ficha real; es solo el identificador de almacenamiento).
 *  - isOwnerOfComposedStudentDoc en firestore.rules autoriza el docId
 *    "__guide_data__:student:{usernameKey}:{archivo}" sin validar que
 *    {archivo} sea una guia registrada (confirmado leyendo firestore.rules),
 *    asi que cloudGetGuideData/cloudSaveGuideData funcionan tal cual.
 *  - Cada practica (equipo+modo) se guarda bajo su PROPIA llave plana dentro
 *    de "state" (igual que los campos data-store de cualquier guia), para
 *    que el merge por-campo de mergeGuideState (firebase_db.js) conserve el
 *    resto de practicas al guardar una sola. NO se anida un objeto
 *    "practices" (eso perderia el merge por-campo y una practica podria
 *    pisar a otra al guardar desde equipos distintos).
 *  - localStorage sigue siendo la fuente de verdad inmediata (offline-first);
 *    la nube se sincroniza en cuanto hay sesion y Firestore disponible.
 */
(function (root) {
  "use strict";

  var FILE_KEY = "laboratorio-virtual-hardware.html";
  var OPTIONAL_MODULE = "hardwareLab";

  function auth() {
    return root.portalAuth || null;
  }

  function db() {
    return root._firebaseDb || null;
  }

  function getSession() {
    var a = auth();
    try {
      return a && typeof a.getCurrentSession === "function" ? a.getCurrentSession() : null;
    } catch (e) {
      return null;
    }
  }

  // ── Acceso (gate por ficha, ver optionalModules.hardwareLab en FICHA_MAP) ──
  function canAccess() {
    var session = getSession();
    if (!session || session.role !== "student" || !session.user) return false;
    var a = auth();
    if (!a || typeof a.getFichaInfo !== "function") return false;
    var info = a.getFichaInfo(session.user.ficha);
    return !!(info && info.optionalModules && info.optionalModules[OPTIONAL_MODULE]);
  }

  function usernameKeyFromSession() {
    var session = getSession();
    var user = session && session.user;
    return (user && (user.usernameKey || user.username)) || null;
  }

  // ── Llave plana por practica (equipo + modo), segura para Firestore ───────
  // Solo [A-Za-z0-9_]: evita necesitar escapeFirestoreFieldPath (firebase_db.js).
  function practiceKey(equipmentId, mode) {
    var safeMode = String(mode || "").replace(/[^a-z0-9]+/gi, "_");
    var safeEquip = String(equipmentId || "").replace(/[^a-z0-9]+/gi, "_");
    return "hwlab_" + safeEquip + "_" + safeMode;
  }

  // ── localStorage (offline-first) ──────────────────────────────────────────
  function localKey(equipmentId, mode) {
    var a = auth();
    var usernameKey = usernameKeyFromSession();
    if (!a || typeof a.getStudentStorageKey !== "function" || !usernameKey) return null;
    return a.getStudentStorageKey(usernameKey, "hardware-lab:" + practiceKey(equipmentId, mode), {
      area: "guide-data",
    });
  }

  function loadLocal(equipmentId, mode) {
    var key = localKey(equipmentId, mode);
    if (!key) return null;
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(equipmentId, mode, serializedSession) {
    var key = localKey(equipmentId, mode);
    if (!key) return false;
    try {
      localStorage.setItem(key, JSON.stringify(serializedSession));
      return true;
    } catch (e) {
      // Almacenamiento lleno u otro fallo local: el intento de nube sigue
      // su curso por separado: no es fatal para el guardado en sesion.
      return false;
    }
  }

  // ── Firestore (fuente que lee el admin) ───────────────────────────────────
  var lastCloudSyncAt = {}; // practiceKey -> epoch ms del ultimo intento exitoso
  var CLOUD_SYNC_MIN_INTERVAL_MS = 1200; // mismo debounce que el resto del portal

  async function syncToCloud(equipmentId, mode, serializedSession, options) {
    var opts = options || {};
    var pKey = practiceKey(equipmentId, mode);
    var now = Date.now();
    if (!opts.force && lastCloudSyncAt[pKey] && now - lastCloudSyncAt[pKey] < CLOUD_SYNC_MIN_INTERVAL_MS) {
      return false;
    }
    var d = db();
    var usernameKey = usernameKeyFromSession();
    if (!d || typeof d.cloudSaveGuideData !== "function" || !usernameKey) return false;

    var scope = "student:" + usernameKey;
    var incomingSnapshot = {
      state: {},
      updatedAt: new Date().toISOString(),
    };
    incomingSnapshot.state[pKey] = serializedSession;

    try {
      var ok = await d.cloudSaveGuideData(scope, FILE_KEY, incomingSnapshot);
      if (ok) lastCloudSyncAt[pKey] = now;
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  async function loadFromCloud(equipmentId, mode) {
    var d = db();
    var usernameKey = usernameKeyFromSession();
    if (!d || typeof d.cloudGetGuideData !== "function" || !usernameKey) return null;
    var scope = "student:" + usernameKey;
    var pKey = practiceKey(equipmentId, mode);
    try {
      var snapshot = await d.cloudGetGuideData(scope, FILE_KEY);
      var state =
        snapshot && typeof snapshot === "object"
          ? snapshot.state || snapshot.data || null
          : null;
      return state && state[pKey] ? state[pKey] : null;
    } catch (e) {
      return null;
    }
  }

  // ── API combinada usada por la UI ─────────────────────────────────────────
  // Guarda local de inmediato (nunca bloquea la interaccion) y lanza la
  // sincronizacion a la nube sin esperarla (igual que el resto del portal:
  // localStorage es la fuente de verdad para la sesion en curso).
  function persist(equipmentId, mode, serializedSession, options) {
    saveLocal(equipmentId, mode, serializedSession);
    syncToCloud(equipmentId, mode, serializedSession, options).catch(function () {});
  }

  var api = {
    FILE_KEY: FILE_KEY,
    canAccess: canAccess,
    practiceKey: practiceKey,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    syncToCloud: syncToCloud,
    loadFromCloud: loadFromCloud,
    persist: persist,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Storage = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
