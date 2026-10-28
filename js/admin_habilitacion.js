(function () {
  "use strict";

  const UNLOCK_LOG_KEY = "sena_portal_admin_unlock_log_v1";
  const MAX_LOG_ENTRIES = 200;

  // ── Estado consultado de los aprendices: MEMORIA del modulo ────────────────
  // Auditoria 2026-10-22. (1) Nada se guarda en localStorage: el panel purga
  // esas claves en cada carga (purgeStudentGuideDataFromLocal) y no debe
  // acumular datos academicos en el navegador. (2) Carga SELECTIVA: solo se
  // consulta al pulsar "Consultar actividades" o "Cargar estado desde la nube",
  // y solo el aprendiz y la(s) guia(s) seleccionados (antes se descargaba la
  // ficha entera: ~aprendices x guias x 5 lecturas). Cada entrada es UN
  // aprendiz + UNA guia (storageKey ya contiene ambos) y guarda cuando se
  // consulto, con que resultado y en que sesion de admin; se descarta al
  // cambiar de sesion, al habilitar (se vuelve a leer) y caduca a los
  // CACHE_TTL_MS (se muestra marcada y "Consultar" la vuelve a leer).
  const pulledStates = new Map(); // storageKey -> { state, updatedAt, lockSources, fetchedAt, status, usernameKey, pageFile }
  const CACHE_TTL_MS = 10 * 60 * 1000;
  let cacheSessionKey = "";
  const inflight = new Map(); // clave de consulta -> promesa (evita duplicados)

  // ── Documentos de nube ADICIONALES por guia ───────────────────────────────
  // Guia 10 Redes RAP01 (Kennedy): la guia guarda en el documento con su
  // nombre crudo (script_guia_redes.js no le da alias), pero sus paginas de
  // quiz (pages/auxiliares/grupo-10?-guia-10-*-quiz.html, ver
  // data/generated_page_variants.json) guardan en jfk_10?_guia10_redes_rap01.html,
  // que es el alias principal declarado en guide_declarations.js. El estado de
  // esta guia vive en DOS documentos: se leen ambos y al habilitar se escribe
  // en el documento del que vino cada candado. Confirmado en produccion
  // (lectura 2026-10-22): 1 documento con el nombre crudo, 0 con el alias.
  // Una guia futura puede declarar lo mismo como extraCloudFileNames en su
  // registerGuide() en vez de agregarse aqui.
  const EXTRA_CLOUD_FILE_NAMES = {
    "grupo-10a-guia-10-redes-rap01.html": ["grupo-10a-guia-10-redes-rap01.html"],
    "grupo-10b-guia-10-redes-rap01.html": ["grupo-10b-guia-10-redes-rap01.html"],
  };

  // ── Trazabilidad ────────────────────────────────────────────────────────────

  // Candidata 2026-10-28: nombre corto uniforme para mostrar (ver admin_usuarios guideLabel).
  function guideLabelFor(auth, file) {
    const label = auth && typeof auth.getGuideDisplayLabel === "function" ? auth.getGuideDisplayLabel(file) : "";
    return label || (auth && typeof auth.getGuideTitle === "function" ? auth.getGuideTitle(file) : "") || file;
  }

  function readUnlockLog() {
    try {
      const raw = localStorage.getItem(UNLOCK_LOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeUnlockLog(entries) {
    localStorage.setItem(UNLOCK_LOG_KEY, JSON.stringify(entries.slice(0, MAX_LOG_ENTRIES)));
  }

  function recordUnlock(entry) {
    const auth = window.portalAuth;
    const session = auth?.getCurrentSession?.();
    const actor =
      session?.user?.username ||
      session?.user?.fullName ||
      session?.usernameKey ||
      "admin";
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      actor,
      usernameKey: String(entry?.usernameKey || ""),
      learnerName: String(entry?.learnerName || ""),
      ficha: String(entry?.ficha || ""),
      guideFile: String(entry?.guideFile || ""),
      guideTitle: String(entry?.guideTitle || ""),
      activityId: String(entry?.activityId || ""),
      activityLabel: String(entry?.activityLabel || ""),
      motivo: String(entry?.motivo || "Sin motivo registrado"),
    };
    writeUnlockLog([record, ...readUnlockLog()]);
    return record;
  }

  // ── Utilidades de presentación ───────────────────────────────────────────────

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtDate(v) {
    if (!v) return "Sin registro";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "Sin registro";
    return d.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function normalize(v) {
    return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  // ── Aliases de archivo para sincronizacion Firestore ──────────────────────
  // Cada script de guia define su STORAGE_FILE_ALIASES (pageFile → cloudAlias).
  // El admin necesita conocer esos aliases para hacer cloudGetGuideData con
  // la cloudAlias correcta. Mantener sincronizado con los scripts de guia.
  const CLOUD_FILE_ALIASES = {
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
    // Redes (Santa Barbara) Guia 2 / RAP01: el script guarda en Firestore bajo el
    // alias sb_{grupo}_redes.html (ver STORAGE_FILE_ALIASES_REDES en
    // js/script_guia_redes.js). Sin estos aliases el pull buscaba el documento con
    // el nombre crudo y no traia nada -> el grupo aparecia vacio en habilitacion.
    "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
    "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
    // Redes Guia 3 / RAP02 (redes-rap02) NO usa alias: guarda con su propio nombre,
    // asi que getCloudFileName devuelve el archivo tal cual y ya coincide.
    "santa-barbara-10a-guia-04-taller-integrador.html": "sb_10a_guia4.html",
    "santa-barbara-10b-guia-04-taller-integrador.html": "sb_10b_guia4.html",
    "grupo-11a-guia-09-taller-integrador.html": "11a_guia9.html",
    "grupo-11b-guia-09-taller-integrador.html": "11b_guia9.html",
    // Bloque G (auditoria 2026-08-27): faltaban estas 2 guias (4 pageFiles) --
    // el pull de habilitacion buscaba el doc con el nombre crudo, no traia
    // nada, y el grupo aparecia vacio en habilitacion SIN error (mismo patron
    // que el bug de Redes documentado arriba). Confirmado contra el alias
    // propio de cada script (STORAGE_FILE_ALIASES en script_guia5_documentar_gestion.js
    // / script_guia8.js), que SI resuelve bien -- por eso el aprendiz guarda
    // sin problema y solo el panel admin salia afectado.
    "grupo-10a-guia-05-documentar-gestion-informacion.html": "10a_guia5doc.html",
    "grupo-10b-guia-05-documentar-gestion-informacion.html": "10b_guia5doc.html",
    "grupo-11a-guia-08-documentar-gestion-informacion.html": "11a_guia8.html",
    "grupo-11b-guia-08-documentar-gestion-informacion.html": "11b_guia8.html",
  };

  // Fuente unica para GUIAS NUEVAS (Bloque G): si guide_declarations.js
  // registro un mapa cloudFileNames para esta guia, se usa DIRECTO, sin tocar
  // esta tabla ni su copia en firebase_db.js (guideDataFileName). Las guias ya
  // existentes siguen resolviendo por CLOUD_FILE_ALIASES de arriba (sin
  // migrarlas: cero riesgo de regresion en lo que ya funciona). El checklist
  // de "Adding a New Guide" en CLAUDE.md nunca mencionaba esta tabla -- por
  // eso se olvido 2 veces seguidas (Guia 5 doc en ago, Guia 8 en jul); con
  // cloudFileNames declarado junto al resto del registro, ya no hay una
  // tabla aparte que se pueda olvidar actualizar.
  function getCloudFileName(pageFile) {
    var std = window.ActivityStandard;
    var config = std && typeof std.getConfigForGuide === "function" ? std.getConfigForGuide(pageFile) : null;
    if (config && config.cloudFileNames && config.cloudFileNames[pageFile]) {
      return config.cloudFileNames[pageFile];
    }
    return CLOUD_FILE_ALIASES[pageFile] || pageFile;
  }

  // Todos los documentos de nube de una guia: el principal (getCloudFileName)
  // primero y luego los adicionales, sin repetir.
  function getCloudFileNamesForGuide(pageFile) {
    const names = [getCloudFileName(pageFile)];
    const std = window.ActivityStandard;
    const config = std && typeof std.getConfigForGuide === "function" ? std.getConfigForGuide(pageFile) : null;
    const declared = config && config.extraCloudFileNames && Array.isArray(config.extraCloudFileNames[pageFile])
      ? config.extraCloudFileNames[pageFile]
      : [];
    declared.concat(EXTRA_CLOUD_FILE_NAMES[pageFile] || []).forEach((name) => {
      if (name && !names.includes(name)) names.push(name);
    });
    return names;
  }

  // ── Catalogo de guias (independiente de los estados) ──────────────────────
  // Las opciones del selector salen de las guias ASIGNADAS a la ficha
  // (FICHA_MAP via getGuidesForFicha), no de las guias que ya tienen algun
  // candado: antes una guia sin bloqueos (p. ej. Guias 10-11 de Redes de 11B,
  // sin entregas todavia) no aparecia nunca en el selector, ni siquiera tras
  // "Cargar estado desde la nube". Sin ficha: union de las fichas de `users`.
  function getGuideCatalog(users, fichaFilter, deps) {
    const auth = deps?.auth || window.portalAuth;
    if (typeof auth?.getGuidesForFicha !== "function") return [];
    const fichas = fichaFilter
      ? [String(fichaFilter)]
      : [...new Set((users || []).map((u) => String(u.ficha || "")).filter(Boolean))].sort();
    const seen = new Set();
    const catalog = [];
    fichas.forEach((ficha) => {
      (auth.getGuidesForFicha(ficha) || []).forEach((file) => {
        if (!file || seen.has(file)) return;
        seen.add(file);
        catalog.push({
          file,
          title: guideLabelFor(auth, file),
        });
      });
    });
    return catalog;
  }

  function plainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  // El payload puede traer el estado en .state (guias) o en .data (paginas de
  // quiz); un payload sin ninguno de los dos se toma tal cual (formato antiguo).
  function snapshotState(remote) {
    if (plainObject(remote?.state)) return remote.state;
    if (plainObject(remote?.data)) return remote.data;
    return remote;
  }

  function timeOf(value) {
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Combina los documentos de una guia (principal primero). En un conflicto de
  // campo gana el documento principal, salvo los candados: una actividad esta
  // bloqueada si CUALQUIER documento la tiene bloqueada, y se recuerda de que
  // documento(s) vino cada candado para habilitarla en el sitio correcto.
  function combineGuideDocs(docs) {
    const state = {};
    const lockSources = {};
    let updatedAt = "";
    docs.slice().reverse().forEach(({ cloudFileName, remote }) => {
      const remoteState = snapshotState(remote);
      if (!plainObject(remoteState)) return;
      Object.assign(state, remoteState);
      if (remote.updatedAt && timeOf(remote.updatedAt) > timeOf(updatedAt)) updatedAt = remote.updatedAt;
    });
    docs.forEach(({ cloudFileName, remote }) => {
      const remoteState = snapshotState(remote);
      if (!plainObject(remoteState)) return;
      Object.keys(remoteState).forEach((key) => {
        if (!/-locked$/.test(key) || remoteState[key] !== true) return;
        state[key] = true;
        (lockSources[key] = lockSources[key] || []).push(cloudFileName);
      });
    });
    return { state, updatedAt, lockSources };
  }

  // Datos de otra sesion de admin (cierre de sesion / cambio de usuario en
  // esta pestaña) no se reutilizan nunca.
  function ensureCacheSession(sessionKey) {
    const key = String(sessionKey || "");
    if (key !== cacheSessionKey) {
      pulledStates.clear();
      inflight.clear();
      cacheSessionKey = key;
    }
  }

  function clearCache() {
    pulledStates.clear();
    inflight.clear();
  }

  function invalidate(storageKey) {
    pulledStates.delete(storageKey);
  }

  function isFresh(entry, now) {
    return Boolean(entry) && entry.status === "ok" && (now - entry.fetchedAt) < CACHE_TTL_MS;
  }

  // Severidad para agregar el resultado de varias guias en uno solo.
  const STATUS_RANK = { ok: 0, incomplete: 1, timeout: 2, unavailable: 2, error: 2, offline: 3, quota: 4, denied: 5 };
  const worst = (a, b) => ((STATUS_RANK[b] || 0) > (STATUS_RANK[a] || 0) ? b : a);

  // ── Consulta SELECTIVA de un aprendiz (solo lectura) ──────────────────────
  // Consulta las guias `pageFiles` (todas las de su ficha o una sola) de UN
  // aprendiz. Reutiliza lo ya consultado y vigente salvo deps.force. Una
  // consulta identica en curso se reutiliza (doble clic). Usa
  // _firebaseDb.cloudReadGuideDataDetailed: todos los documentos de esas guias
  // en 2-3 peticiones y con el motivo real de cada fallo (sin red, permisos,
  // tiempo agotado...), en vez de null para todo.
  // -> { status: "ok"|"incomplete"|"offline"|"denied"|"timeout"|"unavailable"|"error",
  //      files: { pageFile: status }, fromCache, consulted, stats }
  function consultLearner(user, pageFiles, deps) {
    const auth = deps?.auth || window.portalAuth;
    const getStateKey = deps?.getGuideActivityStateKey;
    const fb = window._firebaseDb;
    ensureCacheSession(deps?.sessionKey);
    if (!user?.usernameKey || typeof getStateKey !== "function" || typeof auth?.getStudentStorageKey !== "function") {
      return Promise.resolve({ status: "error", reason: "deps", files: {}, fromCache: 0, consulted: 0, stats: null });
    }
    const now = Date.now();
    const targets = [];
    let fromCache = 0;
    (pageFiles || []).forEach((pageFile) => {
      const stateKey = getStateKey(pageFile);
      if (!stateKey) return;
      const storageKey = auth.getStudentStorageKey(user.usernameKey, stateKey, { area: "guide-data" });
      if (!deps?.force && isFresh(pulledStates.get(storageKey), now)) { fromCache += 1; return; }
      targets.push({ pageFile, storageKey, cloudNames: getCloudFileNamesForGuide(pageFile) });
    });
    if (!targets.length) {
      return Promise.resolve({ status: "ok", reason: "", files: {}, fromCache, consulted: 0, stats: null });
    }
    const cloudNames = [...new Set(targets.flatMap((t) => t.cloudNames))].sort();
    const inflightKey = `${user.usernameKey}|${cloudNames.join(",")}`;
    if (inflight.has(inflightKey)) return inflight.get(inflightKey);

    const run = (async () => {
      const scopeKey = `student:${user.usernameKey}`;
      let detailed;
      if (fb && typeof fb.cloudReadGuideDataDetailed === "function") {
        detailed = await fb.cloudReadGuideDataDetailed(scopeKey, cloudNames, { skipDrive: Boolean(deps?.skipDrive) });
      } else if (fb && typeof fb.cloudGetGuideData === "function") {
        // firebase_db.js anterior (sin lectura detallada): null no distingue
        // "no existe" de "fallo", asi que el resultado se marca sin verificar.
        detailed = { status: "incomplete", reason: "legacy-api", files: {}, stats: null };
        for (const name of cloudNames) {
          try {
            const data = await fb.cloudGetGuideData(scopeKey, name, deps?.skipDrive ? { skipDriveOn404: true } : undefined);
            detailed.files[name] = { status: data ? "found" : "unverified", data };
          } catch (_) {
            detailed.files[name] = { status: "error", data: null };
          }
        }
      } else {
        return { status: "error", reason: "no-firebase", files: {}, fromCache, consulted: 0, stats: null };
      }

      const result = { status: "ok", reason: detailed.reason || "", files: {}, fromCache, consulted: targets.length, stats: detailed.stats || null };
      const fetchedAt = Date.now();
      targets.forEach((t) => {
        let fileStatus = "ok";
        const docs = [];
        t.cloudNames.forEach((name) => {
          const r = detailed.files?.[name] || { status: detailed.status, data: null };
          if (r.data && plainObject(r.data)) docs.push({ cloudFileName: name, remote: r.data });
          if (r.status === "found" || r.status === "missing") return;
          fileStatus = worst(fileStatus, r.status === "partial" || r.status === "unverified" ? "incomplete" : (STATUS_RANK[r.status] ? r.status : "error"));
        });
        result.files[t.pageFile] = fileStatus;
        result.status = worst(result.status, fileStatus);
        const previous = pulledStates.get(t.storageKey);
        if (fileStatus !== "ok" && !docs.length) {
          // Fallo sin datos: se conserva lo anterior (si lo hay) marcado como
          // posiblemente desactualizado; nunca se presenta "sin bloqueos".
          if (previous) pulledStates.set(t.storageKey, Object.assign({}, previous, { status: fileStatus, failedAt: fetchedAt }));
          else pulledStates.set(t.storageKey, { state: {}, updatedAt: "", lockSources: {}, fetchedAt, status: fileStatus, usernameKey: user.usernameKey, pageFile: t.pageFile, empty: true });
          return;
        }
        const combined = docs.length ? combineGuideDocs(docs) : { state: {}, updatedAt: "", lockSources: {} };
        // No se reemplaza un estado mas nuevo ya conocido por una lectura mas vieja.
        const keepPrevious = previous && !previous.empty && previous.updatedAt && combined.updatedAt
          && timeOf(combined.updatedAt) < timeOf(previous.updatedAt);
        pulledStates.set(t.storageKey, Object.assign(keepPrevious ? previous : combined, {
          fetchedAt, status: fileStatus, usernameKey: user.usernameKey, pageFile: t.pageFile, empty: false,
        }));
      });
      // Agregado: si se recupero ALGO (alguna guia completa o parcial) y otra
      // parte fallo, es una consulta INCOMPLETA (se muestra lo recuperado con
      // aviso), no un error total. Si nada se recupero, se informa la causa
      // (la mas grave si hubo varias).
      if (result.status !== "ok") {
        const all = Object.values(result.files);
        const recovered = all.some((st) => st === "ok" || st === "incomplete");
        result.status = recovered ? "incomplete" : all.reduce(worst, "ok");
      }
      return result;
    })();
    inflight.set(inflightKey, run);
    run.finally(() => { if (inflight.get(inflightKey) === run) inflight.delete(inflightKey); }).catch(() => {});
    return run.catch((err) => {
      console.warn("[adminHabilitacion] consulta fallo:", err);
      return { status: "error", reason: "exception", files: {}, fromCache, consulted: 0, stats: null };
    });
  }

  // Que se sabe ya (sin consultar) de un aprendiz para un conjunto de guias.
  function getConsultInfo(user, pageFiles, deps) {
    const auth = deps?.auth || window.portalAuth;
    const getStateKey = deps?.getGuideActivityStateKey;
    ensureCacheSession(deps?.sessionKey);
    const info = { consulted: 0, total: 0, oldestAt: 0, stale: 0, failed: 0 };
    if (!user?.usernameKey || typeof getStateKey !== "function" || typeof auth?.getStudentStorageKey !== "function") return info;
    const now = Date.now();
    (pageFiles || []).forEach((pageFile) => {
      const stateKey = getStateKey(pageFile);
      if (!stateKey) return;
      info.total += 1;
      const entry = pulledStates.get(auth.getStudentStorageKey(user.usernameKey, stateKey, { area: "guide-data" }));
      if (!entry) return;
      info.consulted += 1;
      if (!info.oldestAt || entry.fetchedAt < info.oldestAt) info.oldestAt = entry.fetchedAt;
      if (entry.status !== "ok") info.failed += 1;
      else if (now - entry.fetchedAt >= CACHE_TTL_MS) info.stale += 1;
    });
    return info;
  }

  // Tras habilitar una actividad: refleja el desbloqueo en la memoria del
  // modulo para que el siguiente render no la vuelva a mostrar bloqueada.
  function clearLockKeys(storageKey, lockKeys, updatedAt) {
    const entry = pulledStates.get(storageKey);
    if (!entry) return;
    const state = Object.assign({}, entry.state);
    const lockSources = Object.assign({}, entry.lockSources);
    (lockKeys || []).forEach((key) => {
      if (!/-locked$/.test(key)) return;
      delete state[key];
      delete lockSources[key];
    });
    state.reabierta = true;
    state.permiteEdicion = true;
    pulledStates.set(storageKey, Object.assign({}, entry, { state, updatedAt: updatedAt || new Date().toISOString(), lockSources }));
  }

  function readJsonFromLocalStorage(key, readJson) {
    try { return readJson(localStorage.getItem(key), null); } catch (_) { return null; }
  }

  // ── Detección de actividades bloqueadas ────────────────────────────────────
  // Recibe una lista de usuarios y el catálogo de actividades por guía;
  // devuelve un array plano de { user, guideFile, guideTitle, activityId, activityLabel, lockedAt }.

  function getLockedActivities(users, deps) {
    const auth = deps?.auth || window.portalAuth;
    const deadlineManager = deps?.deadlineManager || window.activityDeadlineManager;
    const readJson = deps?.readJson || ((v, fb) => { try { return v ? JSON.parse(v) : fb; } catch { return fb; } });
    const getUnlockActivities = deps?.getUnlockActivitiesForGuide;
    const getStateKey = deps?.getGuideActivityStateKey;

    if (typeof getUnlockActivities !== "function" || typeof getStateKey !== "function") return [];

    const results = [];

    users.forEach((user) => {
      const usernameKey = user.usernameKey;
      const guideFiles = typeof auth?.getGuidesForFicha === "function"
        ? auth.getGuidesForFicha(user.ficha)
        : (user.progress?.guides || []).map((g) => g.fileName);

      guideFiles.forEach((fileName) => {
        if (deps?.onlyGuides && !deps.onlyGuides.includes(fileName)) return;
        const activities = getUnlockActivities(fileName);
        if (!activities.length) return;

        const stateKey = getStateKey(fileName);
        if (!stateKey) return;

        const storageKey = typeof auth?.getStudentStorageKey === "function"
          ? auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" })
          : null;

        // Orden de lectura: lo traido de la nube por este modulo -> la cache
        // del panel (deps.readGuideState: hidratacion de Respuestas/Entregas o
        // una habilitacion reciente) -> localStorage (formato anterior).
        const pulled = storageKey ? pulledStates.get(storageKey) : null;
        // cacheOnly: el panel solo muestra lo que el admin CONSULTO (nada de
        // datos de otras vistas cuya vigencia no se conoce).
        if (deps?.cacheOnly && !pulled) return;
        const state = pulled
          ? pulled.state
          : (storageKey
            ? ((typeof deps?.readGuideState === "function" ? deps.readGuideState(storageKey) : null)
              || readJsonFromLocalStorage(storageKey, readJson) || {})
            : {});
        const meta = pulled
          ? { updatedAt: pulled.updatedAt }
          : (storageKey
            ? ((typeof deps?.readGuideMeta === "function" ? deps.readGuideMeta(storageKey) : null)
              || readJsonFromLocalStorage(`${storageKey}__meta`, readJson) || {})
            : {});
        const lockSources = pulled?.lockSources || {};

        activities.forEach((activity) => {
          if (!Array.isArray(activity.keys) || activity.keys.length === 0) return;
          // Una actividad puede tener varias llaves -locked (canonica + legacy,
          // ej. transferReto341 o quiz312): basta que cualquiera este activa.
          const lockKeys = activity.keys.filter((k) => /-locked$/.test(k));
          if (lockKeys.length === 0) return;
          if (!lockKeys.some((k) => state[k] === true)) return;

          // También chequear deadline-lock
          let deadlineLocked = false;
          let dueAt = null;
          if (deadlineManager) {
            const policy = deadlineManager.getPolicy(fileName, activity.id);
            dueAt = policy?.dueAt || null;
            if (dueAt && new Date() > new Date(dueAt)) deadlineLocked = true;
          }

          results.push({
            user,
            guideFile: fileName,
            guideTitle: guideLabelFor(auth, fileName),
            activityId: activity.id,
            activityLabel: activity.label || activity.id,
            lockedAt: meta?.updatedAt || "",
            dueAt,
            deadlineLocked,
            stateKey,
            storageKey,
            lockKeys: activity.keys,
            cacheStatus: pulled?.status || "",
            fetchedAt: pulled?.fetchedAt || 0,
            // Documentos de nube donde estan activos los candados de esta
            // actividad (vacio = solo el documento principal / desconocido).
            lockSources: [...new Set(lockKeys.filter((k) => state[k] === true)
              .flatMap((k) => lockSources[k] || []))],
          });
        });
      });
    });

    return results;
  }

  // ── Panel principal de habilitación ────────────────────────────────────────
  // Flujo SELECTIVO: ficha -> aprendiz -> guia (opcional) -> "Consultar
  // actividades". Construir el panel nunca consulta la nube: solo muestra lo
  // que el admin ya consulto (cache del modulo) y el estado de esa consulta.

  const MESSAGES = {
    waiting: "Seleccione una ficha y un aprendiz para consultar las actividades.",
    ready: "Pulse «Consultar actividades» para ver las actividades bloqueadas de este aprendiz.",
    loading: "Consultando actividades del aprendiz seleccionado…",
    none: "El aprendiz no tiene actividades bloqueadas que requieran habilitación.",
    noneGuide: "Esta guía no tiene actividades bloqueadas que requieran habilitación.",
    noneFilter: "No se encontraron actividades bloqueadas que coincidan con los filtros actuales.",
    offline: "No fue posible conectar con la nube. Verifique su conexión e intente nuevamente.",
    denied: "No tiene autorización para consultar esta información.",
    incomplete: "No fue posible recuperar toda la información. Algunos resultados podrían no aparecer.",
    service: "Ocurrió un problema al consultar la información. Intente nuevamente.",
    quota: "Se alcanzó el límite diario de consultas de la nube. No se harán más intentos automáticos; intente de nuevo más tarde.",
  };

  function errorMessage(status) {
    if (status === "offline") return MESSAGES.offline;
    if (status === "denied") return MESSAGES.denied;
    if (status === "incomplete") return MESSAGES.incomplete;
    if (status === "quota") return MESSAGES.quota;
    if (status === "timeout") return MESSAGES.service + " (tiempo de espera agotado)";
    return MESSAGES.service;
  }

  function fmtTime(ms) {
    if (!ms) return "";
    return new Date(ms).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  function fichaLabel(ficha, deps) {
    const auth = deps?.auth || window.portalAuth;
    const sel = typeof auth?.getSelectionForFicha === "function" ? auth.getSelectionForFicha(ficha) : null;
    if (!sel || !sel.inst) return String(ficha);
    const inst = /kennedy/i.test(sel.inst) ? "John F. Kennedy" : (/santa b/i.test(normalize(sel.inst)) ? "Santa Bárbara" : sel.inst);
    return `${ficha} — ${inst} ${sel.grupo || ""}`.trim();
  }

  // Opciones del selector de aprendices: filtrado LOCAL por nombre (nunca
  // consulta la nube). El valor es el usernameKey (identificador real de la
  // cuenta), no el nombre. El aprendiz elegido se conserva aunque el texto de
  // busqueda ya no lo incluya.
  function buildLearnerOptionsHtml(allUsers, ficha, search, selected) {
    const term = normalize(search || "");
    const learners = (allUsers || [])
      .filter((u) => u?.usernameKey && String(u.ficha) === String(ficha))
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "es"));
    const shown = learners.filter((u) => !term || normalize(u.fullName).includes(term) || u.usernameKey === selected);
    const head = `<option value="">${ficha ? (term && shown.length === 0 ? "Ningún aprendiz coincide" : `Seleccione un aprendiz (${shown.length})`) : "Primero seleccione una ficha"}</option>`;
    return head + shown.map((u) =>
      `<option value="${esc(u.usernameKey)}"${u.usernameKey === selected ? " selected" : ""}>${esc(u.fullName || u.usernameKey)}</option>`
    ).join("");
  }

  function buildHabilitacionPanel(allUsers, deps) {
    const filters = deps?.filters || {};
    const consult = deps?.consult || null; // { status, text, at } de la seleccion actual
    const fichaFilter = String(filters.ficha || "").trim();
    const activityFilter = normalize(filters.activity || "");
    const learnerKey = String(filters.learner || "").trim();
    const learner = learnerKey
      ? (allUsers || []).find((u) => u.usernameKey === learnerKey && String(u.ficha) === fichaFilter) || null
      : null;

    const catalog = fichaFilter ? getGuideCatalog(allUsers, fichaFilter, deps) : [];
    const catalogFiles = catalog.map((g) => g.file);
    const guideFilter = catalogFiles.includes(String(filters.guide || "").trim()) ? String(filters.guide || "").trim() : "";
    const selectedGuides = guideFilter ? [guideFilter] : catalogFiles;

    let lockedInScope = [];
    if (learner) {
      lockedInScope = getLockedActivities([learner], Object.assign({}, deps, { cacheOnly: true, onlyGuides: catalogFiles }));
    }
    const lockedByGuide = new Map();
    lockedInScope.forEach((r) => lockedByGuide.set(r.guideFile, (lockedByGuide.get(r.guideFile) || 0) + 1));
    let locked = lockedInScope.filter((r) => selectedGuides.includes(r.guideFile));
    if (activityFilter) locked = locked.filter((r) => normalize(r.activityLabel).includes(activityFilter));

    const info = learner ? getConsultInfo(learner, selectedGuides, deps) : { consulted: 0, total: 0 };
    const status = consult?.status || "";
    const consultedAll = info.total > 0 && info.consulted === info.total;
    const optionLabel = (file, title) => {
      const count = lockedByGuide.get(file) || 0;
      return count ? `${title} (${count} bloqueada${count !== 1 ? "s" : ""})` : title;
    };

    const fichaOptions = [...new Set((allUsers || []).map((u) => String(u.ficha || "")).filter(Boolean))].sort();
    const canConsult = Boolean(fichaFilter && learner) && status !== "loading";

    const filterBar = `
      <div class="hab-filters toolbar admin-toolbar">
        <label class="toolbar-select" for="hab-filter-ficha">
          <span>Ficha</span>
          <select id="hab-filter-ficha">
            <option value="">Seleccione una ficha</option>
            ${fichaOptions.map((f) => `<option value="${esc(f)}"${fichaFilter === f ? " selected" : ""}>${esc(fichaLabel(f, deps))}</option>`).join("")}
          </select>
        </label>
        <label class="toolbar-select" for="hab-learner-search">
          <span>Buscar aprendiz</span>
          <input type="search" id="hab-learner-search" placeholder="Escriba parte del nombre" autocomplete="off"
            value="${esc(filters.learnerSearch || "")}"${fichaFilter ? "" : " disabled"}>
        </label>
        <label class="toolbar-select" for="hab-filter-learner">
          <span>Aprendiz</span>
          <select id="hab-filter-learner"${fichaFilter ? "" : " disabled"}>
            ${buildLearnerOptionsHtml(allUsers, fichaFilter, filters.learnerSearch, learnerKey)}
          </select>
        </label>
        <label class="toolbar-select" for="hab-filter-guide">
          <span>Guía</span>
          <select id="hab-filter-guide"${fichaFilter ? "" : " disabled"}>
            <option value="">Todas las guías</option>
            ${catalog.map((g) => `<option value="${esc(g.file)}"${guideFilter === g.file ? " selected" : ""}>${esc(optionLabel(g.file, g.title))}</option>`).join("")}
          </select>
        </label>
        <label class="toolbar-select" for="hab-filter-activity">
          <span>Filtrar actividad</span>
          <input type="search" id="hab-filter-activity" placeholder="Nombre de la actividad"
            value="${esc(filters.activity || "")}">
        </label>
        <div class="hab-actions">
          <button type="button" id="hab-consult" class="btn primary btn--sm"${canConsult ? "" : " disabled"}>
            Consultar actividades
          </button>
          <button type="button" id="hab-cloud-sync" class="btn secondary btn--sm"
            title="Vuelve a leer de la nube (solo lectura) el aprendiz y la guía seleccionados, aunque ya estén consultados."${canConsult ? "" : " disabled"}>
            &#128260; Cargar estado desde la nube
          </button>
        </div>
      </div>
      <div id="hab-cloud-sync-status" role="status" aria-live="polite" style="margin-top:8px;font-size:.82rem;color:#4b5563;min-height:18px">${esc(consult?.text || "")}</div>
    `;

    // Aviso sobre la tabla: errores, consulta incompleta o datos vencidos.
    let notice = null;
    if (learner && status && status !== "ok" && status !== "loading") {
      notice = { tone: status === "incomplete" ? "warning" : "danger", text: errorMessage(status) };
      if (locked.length && status !== "incomplete") {
        notice.text += ` Se muestra la última información recuperada${info.oldestAt ? ` (${fmtTime(info.oldestAt)})` : ""}, que podría estar desactualizada.`;
      }
    } else if (learner && status === "loading" && locked.length) {
      notice = { tone: "info", text: MESSAGES.loading };
    } else if (learner && info.consulted && (info.stale || info.failed)) {
      notice = { tone: "warning", text: "Parte de esta información se consultó hace más de 10 minutos o con errores. Pulse «Consultar actividades» para actualizarla." };
    } else if (learner && info.consulted && !consultedAll && locked.length) {
      notice = { tone: "info", text: "Solo se muestran las guías ya consultadas de este aprendiz. Pulse «Consultar actividades» para revisar las demás." };
    }

    if (!locked.length) {
      let emptyMessage;
      let emptyClass = "activities-empty";
      if (!fichaFilter || !learner) emptyMessage = MESSAGES.waiting;
      else if (status === "loading") emptyMessage = MESSAGES.loading;
      else if (status && status !== "ok") {
        emptyMessage = errorMessage(status);
        emptyClass = status === "incomplete" ? "c-alert c-alert--warning" : "c-alert c-alert--danger";
      } else if (!consultedAll) emptyMessage = MESSAGES.ready;
      else if (activityFilter) emptyMessage = MESSAGES.noneFilter;
      else if (guideFilter) emptyMessage = MESSAGES.noneGuide;
      else emptyMessage = MESSAGES.none;
      return `
        <section class="panel">
          <h2>Habilitación de actividades bloqueadas</h2>
          <p class="activities-section-copy">
            Seleccione la ficha, el aprendiz y, si lo desea, una guía; luego pulse «Consultar actividades».
            Solo se consulta en la nube la información del aprendiz seleccionado. Cada habilitación queda registrada con motivo y fecha.
          </p>
          ${filterBar}
          ${notice && emptyClass === "activities-empty" ? `<p class="c-alert c-alert--${notice.tone}" id="hab-load-notice" style="margin-top:1rem;">${esc(notice.text)}</p>` : ""}
          <p class="${emptyClass}" id="hab-empty-message" data-hab-status="${esc(status)}" style="margin-top:1.5rem;">
            ${esc(emptyMessage)}
          </p>
        </section>
        ${buildLogSection()}
      `;
    }

    const rows = locked.map((r) => {
      const statusLabel = r.deadlineLocked
        ? '<span class="act-delivery-status act-delivery-status--blocked">Vencida y bloqueada</span>'
        : '<span class="act-delivery-status act-delivery-status--sent">Entregada y bloqueada</span>';

      return `
        <tr>
          <td>${esc(r.user.fullName)}</td>
          <td>${esc(r.user.ficha)}</td>
          <td>${esc(r.user.inst)}</td>
          <td title="${esc(r.guideTitle)}">${esc(r.guideTitle.split("|")[0].trim())}</td>
          <td>${esc(r.activityLabel)}</td>
          <td>${statusLabel}</td>
          <td>${r.lockedAt ? esc(fmtDate(r.lockedAt)) : "Sin registro"}</td>
          <td>
            <div class="hab-action-cell">
              <input
                type="text"
                class="hab-motivo-input"
                placeholder="Motivo (opcional)"
                data-hab-motivo="${esc(r.user.usernameKey)}::${esc(r.guideFile)}::${esc(r.activityId)}"
                maxlength="200"
              >
              <button
                class="btn secondary btn--sm"
                type="button"
                data-hab-unlock="${esc(r.user.usernameKey)}"
                data-hab-guide="${esc(r.guideFile)}"
                data-hab-activity="${esc(r.activityId)}"
                data-hab-state-key="${esc(r.stateKey)}"
                data-hab-label="${esc(r.activityLabel)}"
                data-hab-guide-title="${esc(r.guideTitle)}"
                data-hab-learner="${esc(r.user.fullName)}"
                data-hab-ficha="${esc(r.user.ficha)}"
                data-hab-lock-keys="${esc(r.lockKeys.join(","))}"
                data-hab-lock-sources="${esc((r.lockSources || []).join(","))}"
              >
                Habilitar
              </button>
            </div>
          </td>
        </tr>`;
    }).join("");

    return `
      <section class="panel">
        <h2>Habilitación de actividades bloqueadas</h2>
        <p class="activities-section-copy">
          Seleccione la ficha, el aprendiz y, si lo desea, una guía; luego pulse «Consultar actividades».
          Solo se consulta en la nube la información del aprendiz seleccionado. Cada habilitación queda registrada con motivo, fecha y responsable.
        </p>
        ${filterBar}
        ${notice ? `<p class="c-alert c-alert--${notice.tone}" id="hab-load-notice" style="margin-top:1rem;">${esc(notice.text)}</p>` : ""}
        <p class="hab-count">${esc(learner.fullName || learner.usernameKey)}: ${locked.length} actividad${locked.length !== 1 ? "es" : ""} bloqueada${locked.length !== 1 ? "s" : ""} encontrada${locked.length !== 1 ? "s" : ""}.</p>
        <div class="answer-table-wrap">
          <table class="answer-table activities-table">
            <thead>
              <tr>
                <th>Aprendiz</th>
                <th>Ficha</th>
                <th>Institución</th>
                <th>Guía</th>
                <th>Actividad</th>
                <th>Estado</th>
                <th>Bloqueada el</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      ${buildLogSection()}
    `;
  }

  // ── Sección de trazabilidad ────────────────────────────────────────────────

  function buildLogSection() {
    const log = readUnlockLog();
    if (!log.length) return "";

    const rows = log.slice(0, 30).map((entry) => `
      <tr>
        <td>${esc(fmtDate(entry.at))}</td>
        <td>${esc(entry.actor)}</td>
        <td>${esc(entry.learnerName)}</td>
        <td>${esc(entry.ficha)}</td>
        <td title="${esc(entry.guideTitle)}">${esc(entry.activityLabel)}</td>
        <td>${esc(entry.motivo)}</td>
      </tr>`).join("");

    return `
      <section class="panel" style="margin-top:2rem;">
        <h2>Historial de habilitaciones</h2>
        <p class="activities-section-copy">Últimas ${Math.min(log.length, 30)} habilitaciones registradas en este navegador.</p>
        <div class="answer-table-wrap">
          <table class="answer-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Responsable</th>
                <th>Aprendiz</th>
                <th>Ficha</th>
                <th>Actividad</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  window.adminHabilitacion = Object.freeze({
    buildHabilitacionPanel,
    buildLearnerOptionsHtml,
    recordUnlock,
    readUnlockLog,
    getLockedActivities,
    consultLearner,
    getConsultInfo,
    getCloudFileName,
    getCloudFileNamesForGuide,
    getGuideCatalog,
    clearLockKeys,
    invalidate,
    clearCache,
    MESSAGES,
  });
})();
