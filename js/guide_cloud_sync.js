/**
 * guide_cloud_sync.js — Guardado/sincronizacion ESTANDAR para TODAS las guias.
 *
 * Antes de este modulo, cada script_guiaX.js reimplementaba (copiado, no
 * reutilizado) su propio ciclo local<->nube: cargar de localStorage,
 * guardar con debounce, sincronizar a Firebase. Auditoria 2026-08-22 encontro
 * que 9 de ~15 guiones no hidrataban desde la nube al cargar, ninguno
 * revisaba si el guardado remoto realmente habia tenido exito, y ninguno
 * protegia el guardado al cerrar la pestaña. Este modulo centraliza ese
 * ciclo una sola vez, para que las guias futuras hereden el comportamiento
 * correcto por defecto en vez de copiar y pegar el mismo bug otra vez.
 *
 * Uso desde un script_guiaX.js:
 *
 *   const cloudStore = GuideCloudSync.createStore({
 *     storageKey: STORAGE_KEY,          // ya resuelto (scoped) por el guion
 *     guideDataFile: GUIDE_DATA_FILE,   // alias de archivo usado en la nube
 *     getState:  () => state,          // getter al `state` local del guion
 *     setState:  (next) => { state = next; }, // setter (solo se llama al hidratar)
 *     getActor:  getActor,             // nombre del aprendiz/admin, para 'updatedBy'
 *     onHydrated: hydrateFields,       // se llama tras aplicar el merge remoto
 *   });
 *
 *   function saveState() {
 *     localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
 *     cloudStore.notifyChanged();
 *   }
 *
 *   // Al iniciar (despues de pintar el DOM con el estado local):
 *   cloudStore.hydrate();
 *
 * Flujo real que implementa (auditoria 2026-08-22, Fases 1-4):
 *   cargar local -> pintar -> hidratar desde la nube (merge seguro por
 *   timestamp, JAMAS reemplaza una respuesta remota valida por un local
 *   vacio/viejo) -> pintar de nuevo si cambio algo -> el aprendiz escribe ->
 *   guardado local INMEDIATO -> estado visible real (Guardando.../Guardado en
 *   la nube/Guardado localmente, pendiente/Sin conexion/Error) -> intento de
 *   sincronizar con reintento y backoff -> proteccion best-effort al cerrar
 *   la pestaña -> auto-recuperacion cuando vuelve la conexion/sesion.
 */

(function () {
  "use strict";

  var BASE_DELAY_MS = 1200;
  var MAX_DELAY_MS = 30000;
  var META_SUFFIX = "__meta";

  function nowIso() { return new Date().toISOString(); }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }

  function readLocal(storageKey, legacyStorageKey) {
    try {
      var raw = window.localStorage.getItem(storageKey);
      if (raw) return safeParse(raw, {});
      if (legacyStorageKey && legacyStorageKey !== storageKey) {
        var legacy = window.localStorage.getItem(legacyStorageKey);
        if (legacy) {
          var parsed = safeParse(legacy, {});
          try { window.localStorage.setItem(storageKey, JSON.stringify(parsed)); } catch (e) {}
          return parsed;
        }
      }
    } catch (e) {}
    return {};
  }

  function readMeta(metaKey) {
    try { return safeParse(window.localStorage.getItem(metaKey), {}); } catch (e) { return {}; }
  }

  function writeMeta(metaKey, meta) {
    try { window.localStorage.setItem(metaKey, JSON.stringify(meta)); } catch (e) {}
  }

  function getCloudScopeKey() {
    var auth = window.portalAuth;
    var session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    if (!session) return "";
    if (session.role === "admin") return "admin:" + (session.usernameKey || "admin");
    if (session.role === "student") return "student:" + (session.user && session.user.usernameKey || "");
    return "";
  }

  function reflectStatus(key, message) {
    var ps = window.portalSaveStatus;
    if (!ps) return;
    if (key === "dirty" || key === "syncing") { ps.saving(message); return; }
    if (key === "synced") { ps.saved(message); return; }
    if (key === "local-only" || key === "pending-sync") { ps.pendingSync ? ps.pendingSync(message) : ps.offline(message); return; }
    if (key === "offline") { ps.offline(message); return; }
    if (key === "error") { ps.error(message); return; }
  }

  /**
   * Crea un store de sincronizacion para UNA guia (un storageKey/guideDataFile).
   * Ver comentario de cabecera para el contrato completo.
   */
  function createStore(options) {
    options = options || {};
    var storageKey = options.storageKey;
    var legacyStorageKey = options.legacyStorageKey || storageKey;
    var metaKey = storageKey + META_SUFFIX;
    var guideDataFile = options.guideDataFile;
    var getState = options.getState || function () { return {}; };
    var setState = options.setState || function () {};
    var getActor = options.getActor || function () { return "Aprendiz"; };
    var onHydrated = options.onHydrated || function () {};
    var onStatus = options.onStatus || function () {};

    // Overridables solo para pruebas deterministas (sin esperar segundos
    // reales de backoff); los guiones de guia reales nunca los pasan.
    var baseDelayMs = options.baseDelayMs || BASE_DELAY_MS;
    var maxDelayMs = options.maxDelayMs || MAX_DELAY_MS;
    // Reconciliacion periodica opcional (mismo patron ya probado en
    // script_guia_redes.js/script_guia2.js: cada tanto, si la pestaña esta
    // visible y no hay un guardado propio pendiente, se pregunta a la nube
    // por si otra pestaña/dispositivo guardo algo mas nuevo). Acorta a minutos
    // (en vez de indefinido) la ventana en la que dos pestañas podrian
    // divergir. Desactivado por defecto (0): cada guion la activa si quiere.
    var periodicRefreshMs = options.periodicRefreshMs || 0;

    var timer = null;
    var delay = baseDelayMs;
    var inFlight = false;
    var dirty = false;
    var hydrated = false;
    var consecutiveFailures = 0;

    function setStatus(key, message) {
      onStatus(key, message);
      reflectStatus(key, message);
    }

    function buildSnapshot() {
      return {
        scopeKey: getCloudScopeKey(),
        fileName: guideDataFile,
        updatedAt: nowIso(),
        updatedBy: getActor(),
        state: Object.assign({}, getState()),
      };
    }

    function scheduleSync(customDelay) {
      dirty = true;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(runSync, customDelay != null ? customDelay : delay);
    }

    async function runSync() {
      timer = null;
      var scopeKey = getCloudScopeKey();
      var db = window._firebaseDb;
      if (!scopeKey || !db || typeof db.cloudSaveGuideData !== "function") {
        setStatus("local-only", "Guardado localmente. Pendiente de sincronizar.");
        return;
      }
      if (typeof navigator !== "undefined" && navigator && navigator.onLine === false) {
        setStatus("offline", "Sin conexion — guardado local.");
        scheduleSync(delay); // reintenta solo; el listener "online" tambien dispara de inmediato
        return;
      }
      if (inFlight) {
        // Ya hay una sincronizacion en curso para este documento: no se
        // abren dos peticiones en paralelo (evita la carrera de lecturas
        // desactualizadas). Se vuelve a intentar cuando esa termine (ver
        // "then" de abajo, patron igual al de activity_grades.js).
        dirty = true;
        return;
      }

      inFlight = true;
      dirty = false;
      setStatus("syncing", "Guardando en la nube...");
      var snapshot = buildSnapshot();
      var saved = false;
      try {
        saved = await db.cloudSaveGuideData(scopeKey, guideDataFile, snapshot);
      } catch (e) {
        saved = false;
      }
      inFlight = false;

      if (saved) {
        delay = baseDelayMs;
        consecutiveFailures = 0;
        writeMeta(metaKey, { updatedAt: snapshot.updatedAt, updatedBy: snapshot.updatedBy, lastSyncedAt: snapshot.updatedAt });
        setStatus("synced", "Guardado.");
      } else {
        delay = Math.min(delay * 2 || baseDelayMs, maxDelayMs);
        consecutiveFailures += 1;
        // Los primeros fallos son probablemente un hipo de red/servidor --
        // "pendiente de sincronizar" (tono neutro) es mas honesto que un
        // "Error" en rojo para algo que se va a resolver solo en segundos.
        // Recien despues de varios intentos seguidos fallidos se sube a
        // "error" (mismo tono que offline/no-auth), porque a esa altura si
        // vale la pena que el aprendiz sepa que algo mas persistente ocurre.
        if (consecutiveFailures >= 3) {
          setStatus("error", "No se pudo sincronizar tras varios intentos. Tu respuesta esta guardada en este equipo; se seguira reintentando.");
        } else {
          setStatus("pending-sync", "Guardado localmente. Pendiente de sincronizar.");
        }
        scheduleSync(delay);
      }

      if (dirty) {
        // Llegaron mas cambios mientras esta sincronizacion estaba en vuelo.
        scheduleSync(saved ? baseDelayMs : delay);
      }
    }

    // Al recuperar conexion o sesion, reintenta de inmediato en vez de
    // esperar el backoff completo (Fase 6: "cuando la sesion vuelva a
    // funcionar, sincronizar automaticamente la informacion pendiente").
    function retryNowIfDirty() {
      if (!dirty && !hasUnsyncedLocalChanges()) return;
      delay = baseDelayMs;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(runSync, 150);
    }

    function hasUnsyncedLocalChanges() {
      var meta = readMeta(metaKey);
      var lastSyncedAt = meta.lastSyncedAt || "";
      var localUpdatedAt = meta.updatedAt || "";
      if (!localUpdatedAt) return false;
      return Date.parse(localUpdatedAt) > (Date.parse(lastSyncedAt) || 0);
    }

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("online", retryNowIfDirty);
      window.addEventListener("sena-portal:sync-status", function (e) {
        if (e && e.detail && e.detail.status === "online") retryNowIfDirty();
      });
    }

    // Dos pestañas de la MISMA guía comparten este localStorage (mismo
    // origen), pero cada una tiene su PROPIA copia en memoria de `state`. Sin
    // esto: la pestaña A escribe el campo 1 (localStorage al dia); la
    // pestaña B, que seguia con su copia vieja en memoria (sin el campo 1),
    // edita el campo 2 y guarda -- su propio saveState() hace
    // localStorage.setItem(JSON.stringify(su_state_viejo)), que NO tiene el
    // campo 1, así que lo BORRA de localStorage sin que ninguna de las dos
    // pestañas se entere. Confirmado en vivo (auditoria 2026-08-22, Fase 5 /
    // PRUEBA 7). El evento "storage" SOLO llega a las pestañas QUE NO
    // hicieron el cambio, justo cuando la otra ya escribio -- se fusiona de
    // inmediato en la copia en memoria de ESTA pestaña (mismo merge por
    // campo que ya protege el guardado a la nube), para que el proximo
    // saveState() de esta pestaña ya incluya lo que la otra acaba de guardar.
    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", function (e) {
        if (!e || e.key !== storageKey || !e.newValue) return;
        var incoming = safeParse(e.newValue, null);
        if (!incoming || typeof incoming !== "object") return;
        var db = window._firebaseDb;
        var merged = db && typeof db.mergeGuideState === "function"
          ? db.mergeGuideState(getState(), incoming, false)
          : Object.assign({}, incoming, getState());
        // A proposito NO se llama a onHydrated()/se re-pinta el DOM aqui: el
        // aprendiz de ESTA pestaña puede estar escribiendo en cualquier campo
        // en este mismo instante, y volver a pintar todos los [data-store]
        // le resetearia el cursor/valor a mitad de una tecla. Solo se
        // actualiza el modelo en memoria para que el PROXIMO guardado de
        // esta pestaña (el que sea) ya incluya lo que la otra acaba de
        // guardar, en vez de borrarlo.
        setState(merged);
      });
    }

    /**
     * Se llama cada vez que el guion local guarda un cambio (equivalente a lo
     * que antes hacia scheduleCloudSync()). Guarda local YA debe haber
     * ocurrido antes de llamar esto -- este modulo nunca toca localStorage
     * por su cuenta salvo para actualizar su propio `__meta`.
     */
    function notifyChanged() {
      writeMeta(metaKey, Object.assign({}, readMeta(metaKey), { updatedAt: nowIso(), updatedBy: getActor() }));
      setStatus("dirty", "Guardando...");
      scheduleSync(baseDelayMs);
    }

    /**
     * Hidrata el estado al cargar la guia: compara la copia local con la de
     * la nube y aplica SIEMPRE el merge seguro (nunca pisa una respuesta
     * remota valida con un local vacio/viejo, ver
     * firebase_db.js:resolveGuideHydration). Debe llamarse una vez al
     * iniciar, DESPUES de pintar el estado local (para que el aprendiz no
     * vea la guia vacia mientras se resuelve la red).
     */
    async function hydrate() {
      if (hydrated) return getState();
      hydrated = true;
      var scopeKey = getCloudScopeKey();
      var db = window._firebaseDb;
      if (!scopeKey || !db || typeof db.cloudGetGuideData !== "function" || typeof db.resolveGuideHydration !== "function") {
        return getState();
      }
      try {
        if (db.shouldDeferCloudReads && db.shouldDeferCloudReads()) return getState();
        var remote = await db.cloudGetGuideData(scopeKey, guideDataFile);
        var meta = readMeta(metaKey);
        var localSnapshot = { state: getState(), updatedAt: meta.updatedAt || "" };
        var resolved = db.resolveGuideHydration(localSnapshot, remote);
        setState(resolved.state || {});
        writeMeta(metaKey, Object.assign({}, meta, {
          updatedAt: resolved.updatedAt || meta.updatedAt || "",
          // Si gano lo remoto, ya esta sincronizado por definicion (viene de
          // la nube); si gano lo local, no se toca lastSyncedAt: sigue
          // pendiente hasta que runSync() confirme.
          lastSyncedAt: resolved.source === "remote" ? (resolved.updatedAt || meta.lastSyncedAt) : meta.lastSyncedAt,
        }));
        try { window.localStorage.setItem(storageKey, JSON.stringify(resolved.state || {})); } catch (e) {}
        onHydrated(resolved.state);
        if (resolved.source === "local") {
          // Lo local ganaba (mas nuevo que la nube): probablemente quedo sin
          // sincronizar de una sesion anterior (se cerro la pestaña antes de
          // tiempo). Se reintenta de una vez en lugar de esperar a que el
          // aprendiz toque otro campo.
          retryNowIfDirty();
        }
      } catch (e) {
        // Sin red/sesion: se sigue con lo local, tal como estaba.
      }
      if (periodicRefreshMs > 0) startPeriodicRefresh();
      return getState();
    }

    var refreshInterval = null;
    function startPeriodicRefresh() {
      if (refreshInterval || periodicRefreshMs <= 0) return;
      refreshInterval = window.setInterval(async function () {
        if (typeof document !== "undefined" && document.hidden) return;
        if (dirty || inFlight) return; // no pisar un cambio propio aun no confirmado
        var scopeKey = getCloudScopeKey();
        var db = window._firebaseDb;
        if (!scopeKey || !db || typeof db.cloudGetGuideData !== "function" || typeof db.resolveGuideHydration !== "function") return;
        if (db.shouldDeferCloudReads && db.shouldDeferCloudReads()) return;
        try {
          var remote = await db.cloudGetGuideData(scopeKey, guideDataFile);
          if (!remote) return;
          var meta = readMeta(metaKey);
          var localSnapshot = { state: getState(), updatedAt: meta.updatedAt || "" };
          var resolved = db.resolveGuideHydration(localSnapshot, remote);
          if (resolved.source !== "remote") return; // lo local ya estaba al dia o mas nuevo
          setState(resolved.state || {});
          writeMeta(metaKey, Object.assign({}, meta, { updatedAt: resolved.updatedAt, lastSyncedAt: resolved.updatedAt }));
          try { window.localStorage.setItem(storageKey, JSON.stringify(resolved.state || {})); } catch (e) {}
          onHydrated(resolved.state);
        } catch (e) { /* red caida: se reintenta en el proximo intervalo */ }
      }, periodicRefreshMs);
    }

    /**
     * Mejor esfuerzo al cerrar/ocultar la pestaña: un solo PATCH directo (sin
     * la lectura previa que hace runSync) con fetch keepalive, para que el
     * navegador intente completarlo aunque la pagina ya se haya descargado.
     * No reemplaza la proteccion real (todo ya esta en localStorage y se
     * reintenta solo en la proxima carga via hydrate()/retryNowIfDirty()) --
     * es una capa extra para acortar la ventana en la que el cambio solo vive
     * localmente.
     */
    function flushNow() {
      if (!dirty && !hasUnsyncedLocalChanges()) return;
      var scopeKey = getCloudScopeKey();
      var db = window._firebaseDb;
      if (!scopeKey || !db || typeof db.cloudSaveGuideDataKeepalive !== "function") return;
      try { db.cloudSaveGuideDataKeepalive(scopeKey, guideDataFile, buildSnapshot()); } catch (e) {}
    }

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("pagehide", flushNow);
      window.addEventListener("beforeunload", flushNow);
    }
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) flushNow();
      });
    }

    // Cancela el reintento pendiente sin perder nada (lo local ya esta
    // guardado): util en pruebas, y como higiene si algun dia una guia
    // necesita desmontar su store explicitamente.
    function stop() {
      if (timer) { window.clearTimeout(timer); timer = null; }
      if (refreshInterval) { window.clearInterval(refreshInterval); refreshInterval = null; }
    }

    return {
      hydrate: hydrate,
      notifyChanged: notifyChanged,
      flushNow: flushNow,
      forceSyncNow: runSync,
      getCloudScopeKey: getCloudScopeKey,
      stop: stop,
    };
  }

  window.GuideCloudSync = {
    createStore: createStore,
    // Lectura local inicial (con compat hacia la llave legada sin scope), para
    // que cada guion no reimplemente el mismo fallback. Sincrona: se usa para
    // pintar de inmediato, antes de que createStore().hydrate() (asincrono)
    // pueda traer una version mas nueva de la nube.
    loadLocal: readLocal,
  };
})();
