/* js/hardware_lab_attempts.js
 *
 * SEGUIMIENTO ACADEMICO del Laboratorio Virtual (LOOP seguimiento, 2026-09-29).
 *
 * Antes: cada practica guardaba SOLO su ultimo estado (hardware_lab_storage.js,
 * llave hwlab_{equipo}_{modo}); "Reintentar" lo pisaba y el historial no
 * existia. Ahora cada intento TERMINADO se registra como un documento propio e
 * inmutable en Firestore (sena_portal_hwlab_attempts), sin tocar el guardado de
 * siempre (que sigue siendo el estado en curso de cada practica).
 *
 *   attemptId = {uid}__{equipo}__{practica}__{inicioMs}__{nonce}
 *     - nonce: aleatorio, creado UNA vez al iniciar el intento y guardado en la
 *       sesion (sobrevive a recarga, reconexion y cola pendiente). Reintentar =
 *       sesion nueva = nonce nuevo = documento nuevo.
 *     - "legacy": sesiones creadas antes de este sistema (sin nonce). El mismo
 *       historico migrado N veces produce el MISMO id: 1 documento.
 *
 * ESCALA: se conserva el puntaje BRUTO de la rubrica (rawScore / rawMaxScore,
 * p. ej. 67/90) y se calcula aparte normalizedScore = raw x 100 / rawMax. La
 * aprobacion usa el normalizado (>= 70), sin redondear. Nunca se reescribe un
 * bruto historico.
 *
 * LIMITE (documentado, no oculto): el puntaje se calcula en el navegador del
 * aprendiz. El sistema es AUDITABLE (historial inmutable, hora del servidor,
 * origen y version), NO antifraude.
 *
 * Funciones puras + dependencias inyectables (store/db/identidad) para probarlo
 * en Node sin navegador (tests/hardware_lab_attempts*.test.cjs).
 */
(function (root) {
  "use strict";

  var PASS_THRESHOLD = 70; // sobre la escala normalizada de 100
  var NORMALIZED_MAX = 100;
  var LEGACY_NONCE = "legacy";
  var QUEUE_AREA = "app";
  var QUEUE_KEY = "hwlab-attempts-pending-v1";
  var MIGRATED_KEY = "hwlab-legacy-migrated-v1";
  var CONFLICTS_KEY = "hwlab-legacy-conflicts-v1";
  var LEGACY_PREFIX_TAIL = ":guide-data:hardware-lab:hwlab_";

  // ── Actividades reales (storageMode que escriben los controladores 3D) ──
  var PRACTICES = {
    "disassembly-guided": { actividad: "desensamble", modo: "guiado" },
    "assembly-guided": { actividad: "ensamble", modo: "guiado" },
    "maintenance-guided": { actividad: "mantenimiento", modo: "guiado" },
    "disassembly-free": { actividad: "desensamble", modo: "libre" },
    "assembly-free": { actividad: "ensamble", modo: "libre" },
    "disassembly-evaluation": { actividad: "desensamble", modo: "evaluacion" },
    "assembly-evaluation": { actividad: "ensamble", modo: "evaluacion" },
  };

  function describePractice(practica) {
    var p = String(practica || "");
    if (p.indexOf("diagnosis-") === 0) return { actividad: "diagnostico", modo: "diagnostico", caso: p.slice("diagnosis-".length) };
    var known = PRACTICES[p];
    return known ? { actividad: known.actividad, modo: known.modo, caso: null } : null;
  }

  // ── Escala ───────────────────────────────────────────────────────────────
  function rawMaxFromBreakdown(breakdown) {
    if (!breakdown || typeof breakdown !== "object") return null;
    var sum = 0;
    var n = 0;
    Object.keys(breakdown).forEach(function (k) {
      if (k === "total") return;
      var c = breakdown[k];
      if (c && typeof c.max === "number" && isFinite(c.max)) { sum += c.max; n++; }
    });
    return n ? sum : null;
  }

  /** { normalizedScore, normalizedMaxScore, estado } o nulls si falta el bruto. */
  function normalize(rawScore, rawMaxScore) {
    if (typeof rawScore !== "number" || !isFinite(rawScore) || typeof rawMaxScore !== "number" || !(rawMaxScore > 0)) {
      return { normalizedScore: null, normalizedMaxScore: null, estado: null };
    }
    var n = (rawScore * NORMALIZED_MAX) / rawMaxScore;
    return { normalizedScore: n, normalizedMaxScore: NORMALIZED_MAX, estado: n >= PASS_THRESHOLD ? "APROBADO" : "POR MEJORAR" };
  }

  /** Presentacion: entero si lo es, si no hasta 2 decimales con coma. Solo para mostrar. */
  function formatScore(n) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    var r = Math.round(n * 100) / 100;
    return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "").replace(".", ",");
  }

  // ── Identificadores ─────────────────────────────────────────────────────
  function makeNonce() {
    var c = root.crypto;
    if (c && typeof c.getRandomValues === "function") {
      var a = new Uint8Array(4);
      c.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    }
    return Math.random().toString(16).slice(2, 10).padEnd(8, "0");
  }

  function startMs(startedAt) {
    var t = Date.parse(startedAt);
    return isFinite(t) ? String(t) : "sinfecha";
  }

  function buildAttemptId(uid, equipo, practica, startedAt, nonce) {
    if (!uid || /__|\//.test(uid)) return null;
    if (equipo !== "desktop" && equipo !== "laptop") return null;
    if (!describePractice(practica)) return null;
    var n = String(nonce || "");
    if (!/^[a-z0-9]{1,16}$/i.test(n)) return null;
    return uid + "__" + equipo + "__" + practica + "__" + startMs(startedAt) + "__" + n;
  }

  // ── Documento de intento (nunca inventa: lo que falta queda en null) ─────
  function num(v) { return typeof v === "number" && isFinite(v) ? v : null; }
  function iso(v) { return typeof v === "string" && isFinite(Date.parse(v)) ? new Date(Date.parse(v)).toISOString() : null; }

  /**
   * @param session  sesion serializada del motor (con .result si termino)
   * @param ctx      { uid, usernameKey, ficha, equipo, practica, nonce,
   *                   versionSimulador, origen, fuente, fechaMigracion }
   */
  function buildAttemptDoc(session, ctx) {
    var s = session || {};
    var d = describePractice(ctx.practica);
    var attemptId = buildAttemptId(ctx.uid, ctx.equipo, ctx.practica, s.startedAt, ctx.nonce);
    if (!d || !attemptId) return null;
    var r = s.result && typeof s.result === "object" ? s.result : null;
    var rawScore = r ? num(r.score) : null;
    var rawMaxScore = r ? rawMaxFromBreakdown(r.breakdown) : null;
    var norm = normalize(rawScore, rawMaxScore);
    return {
      attemptId: attemptId,
      uid: ctx.uid,
      usernameKey: ctx.usernameKey || null,
      ficha: ctx.ficha != null && ctx.ficha !== "" ? String(ctx.ficha) : null,
      equipo: ctx.equipo,
      practica: ctx.practica,
      actividad: d.actividad,
      modo: d.modo,
      caso: d.caso,
      completado: !!r,
      rawScore: rawScore,
      rawMaxScore: rawMaxScore,
      normalizedScore: norm.normalizedScore,
      normalizedMaxScore: norm.normalizedMaxScore,
      estado: norm.estado,
      // Estado que mostraba el sistema ANTIGUO (umbral 70 sobre el bruto):
      // solo en historicos; en intentos nuevos el estado vigente es "estado".
      estadoLegacy: ctx.origen === "new" ? null : (r && typeof r.status === "string" ? r.status : null),
      breakdown: r && r.breakdown && typeof r.breakdown === "object" ? r.breakdown : null,
      fechaInicio: iso(s.startedAt),
      fechaFin: iso(s.finishedAt),
      duracion: r ? num(r.durationSeconds) : null,
      pistas: r ? num(r.hintsUsed) : null,
      errores: r ? num(r.errors) : null,
      erroresPorTipo: r && r.errorsByType && typeof r.errorsByType === "object" ? r.errorsByType : null,
      versionSimulador: ctx.versionSimulador || null,
      origen: ctx.origen,
      fuente: ctx.fuente || null,
      fechaMigracion: ctx.fechaMigracion || null,
    };
  }

  // ── Cola local (sin conexion) ────────────────────────────────────────────
  // Un pendiente guarda la SESION terminada + contexto; el id se arma al
  // sincronizar (el uid puede no estar disponible todavia si termino sin red
  // antes de que Firebase Auth hidratara). Llave por practica+inicio+nonce:
  // encolar dos veces el mismo intento no lo duplica.
  function queueStoreKey(auth, usernameKey) {
    if (!auth || typeof auth.getStudentStorageKey !== "function" || !usernameKey) return null;
    return auth.getStudentStorageKey(usernameKey, QUEUE_KEY, { area: QUEUE_AREA });
  }
  function readJson(store, key, fallback) {
    try { var raw = store.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }
  function writeJson(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function pendingKeyOf(item) {
    return item.equipo + "__" + item.practica + "__" + startMs(item.session && item.session.startedAt) + "__" + item.nonce;
  }

  function enqueue(store, key, item) {
    if (!store || !key) return false;
    var q = readJson(store, key, {});
    var k = pendingKeyOf(item);
    if (!q[k]) q[k] = Object.assign({}, item, { enqueuedAt: new Date().toISOString(), tries: 0 });
    return writeJson(store, key, q);
  }

  /**
   * Sincroniza la cola. `identity` = { uid, usernameKey, ficha }. Los pendientes
   * de OTRO usernameKey no se tocan (no se envian con la identidad actual).
   * -> { created, exists, pending, rejected }
   */
  async function flush(deps) {
    var out = { created: 0, exists: 0, pending: 0, rejected: 0 };
    var store = deps.store, key = deps.key, db = deps.db, id = deps.identity || {};
    if (!store || !key) return out;
    var q = readJson(store, key, {});
    var keys = Object.keys(q);
    for (var i = 0; i < keys.length; i++) {
      var item = q[keys[i]];
      if (!item || item.usernameKey !== id.usernameKey || !id.uid || !db || typeof db.cloudCreateHwlabAttempt !== "function") { out.pending++; continue; }
      var doc = buildAttemptDoc(item.session, {
        uid: id.uid, usernameKey: item.usernameKey, ficha: item.ficha != null ? item.ficha : id.ficha,
        equipo: item.equipo, practica: item.practica, nonce: item.nonce,
        versionSimulador: item.versionSimulador, origen: item.origen, fuente: item.fuente, fechaMigracion: item.fechaMigracion,
      });
      if (!doc) { item.lastError = "invalido"; out.rejected++; continue; }
      var res = await db.cloudCreateHwlabAttempt(doc);
      item.tries = (item.tries || 0) + 1;
      if (res && (res.status === "created" || res.status === "exists")) {
        delete q[keys[i]];
        out[res.status === "created" ? "created" : "exists"]++;
        if (typeof deps.onConfirmed === "function") deps.onConfirmed(item, doc, res.status);
      } else if (res && (res.status === "denied" || res.status === "rejected" || res.status === "invalid")) {
        item.lastError = res.status + (res.httpStatus ? " " + res.httpStatus : "");
        out.rejected++;
      } else {
        item.lastError = (res && res.status) || "offline";
        out.pending++;
      }
    }
    writeJson(store, key, q);
    return out;
  }

  // ── Migrador de datos ANTIGUOS del navegador ─────────────────────────────
  // Solo migra sesiones TERMINADAS (con result): una sesion a medias no es un
  // intento; cuando se termine, el laboratorio la registra con nonce "legacy"
  // (mismo id que tendria migrada: nunca se duplica).
  function classifyLegacySession(value) {
    if (!value || typeof value !== "object") return { ok: false, motivo: "corrupto" };
    if (!value.result || typeof value.result !== "object") return { ok: false, motivo: "no_terminado" };
    if (value.attemptNonce) return { ok: false, motivo: "ya_es_intento_nuevo" };
    var hasScore = typeof value.result.score === "number" && isFinite(value.result.score);
    var hasEnd = !!iso(value.finishedAt);
    return { ok: true, origen: hasScore && hasEnd ? "migrated" : "legacy_partial" };
  }

  /**
   * Recorre localStorage buscando llaves antiguas del laboratorio.
   * deps: { store, auth, identity {uid, usernameKey, ficha}, now }
   * -> { items: [pendientes a encolar], conflicts: [...], skipped: [...] }
   * No escribe nada por si mismo (lo hace migrateBrowserLegacy).
   */
  function scanBrowserLegacy(deps) {
    var store = deps.store, id = deps.identity || {};
    var out = { items: [], conflicts: [], skipped: [] };
    if (!store || typeof store.length !== "number") return out;
    var ownPrefix = id.usernameKey && deps.auth && typeof deps.auth.getStudentStorageKey === "function"
      ? deps.auth.getStudentStorageKey(id.usernameKey, "hardware-lab:hwlab_", { area: "guide-data" })
      : null;
    var migrated = deps.migratedMap || {};
    for (var i = 0; i < store.length; i++) {
      var k = store.key(i);
      if (!k || k.indexOf(LEGACY_PREFIX_TAIL) === -1) continue;
      var tail = k.slice(k.indexOf(LEGACY_PREFIX_TAIL) + LEGACY_PREFIX_TAIL.length);
      if (!ownPrefix || k.indexOf(ownPrefix) !== 0) {
        // Datos de OTRO aprendiz en este navegador: nunca se migran con la sesion actual.
        out.conflicts.push({ key: k, tipo: "otro_usuario" });
        continue;
      }
      if (migrated[k]) { out.skipped.push({ key: k, motivo: "ya_migrado" }); continue; }
      var m = tail.match(/^(desktop|laptop)_(.+)$/);
      if (!m) { out.conflicts.push({ key: k, tipo: "estructura_ambigua" }); continue; }
      var practica = m[2].replace(/_/g, "-");
      if (!describePractice(practica)) { out.conflicts.push({ key: k, tipo: "estructura_ambigua" }); continue; }
      var value;
      try { value = JSON.parse(store.getItem(k)); } catch (e) { out.conflicts.push({ key: k, tipo: "corrupto" }); continue; }
      var c = classifyLegacySession(value);
      if (!c.ok) {
        if (c.motivo === "corrupto") out.conflicts.push({ key: k, tipo: "corrupto" });
        else out.skipped.push({ key: k, motivo: c.motivo });
        continue;
      }
      if (!id.uid) { out.conflicts.push({ key: k, tipo: "sin_uid" }); continue; }
      out.items.push({
        storageKey: k, usernameKey: id.usernameKey, ficha: id.ficha != null ? String(id.ficha) : null,
        equipo: m[1], practica: practica, nonce: LEGACY_NONCE, session: value,
        versionSimulador: null, origen: c.origen, fuente: "browser", fechaMigracion: deps.now || new Date().toISOString(),
      });
    }
    return out;
  }

  // ── Integracion con el navegador (portalAuth + _firebaseDb) ──────────────
  function browserDeps() {
    var auth = root.portalAuth || null;
    var session = null;
    try { session = auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null; } catch (e) { session = null; }
    var user = session && session.user;
    var bridge = root.portalFirebaseAuth || null;
    var uid = null;
    try { uid = bridge && typeof bridge.currentUid === "function" ? bridge.currentUid() : null; } catch (e) { uid = null; }
    var usernameKey = user ? user.usernameKey || user.username || null : null;
    return {
      role: session ? session.role : null,
      auth: auth,
      store: root.localStorage || null,
      db: root._firebaseDb || null,
      identity: { uid: uid, usernameKey: usernameKey, ficha: user && user.ficha != null ? String(user.ficha) : null },
    };
  }

  /** Version del simulador = sufijo de version del bootstrap cargado (no se inventa). */
  function currentSimVersion() {
    try {
      var el = root.document && root.document.querySelector('script[src*="hardware_lab_3d_bootstrap"]');
      var m = el && el.getAttribute("src").match(/[?&]v=([A-Za-z0-9_.-]+)/);
      return m ? m[1] : null;
    } catch (e) { return null; }
  }

  var flushing = null;
  function flushNow() {
    if (flushing) return flushing;
    var d = browserDeps();
    if (d.role !== "student") return Promise.resolve(null);
    var key = queueStoreKey(d.auth, d.identity.usernameKey);
    flushing = flush({ store: d.store, key: key, db: d.db, identity: d.identity, onConfirmed: markMigrated })
      .catch(function () { return null; })
      .then(function (r) { flushing = null; return r; });
    return flushing;
  }

  function markMigrated(item) {
    if (!item || !item.storageKey) return;
    var d = browserDeps();
    var key = d.auth && d.auth.getStudentStorageKey(d.identity.usernameKey, MIGRATED_KEY, { area: QUEUE_AREA });
    if (!key) return;
    var map = readJson(d.store, key, {});
    map[item.storageKey] = { at: new Date().toISOString() };
    writeJson(d.store, key, map);
  }

  /**
   * Llamado por los controladores al TERMINAR un intento. Nunca bloquea ni lanza:
   * encola y dispara la sincronizacion. Solo aprendices (el admin practica sin
   * contaminar el seguimiento).
   */
  function recordFinished(opts) {
    try {
      var d = browserDeps();
      if (d.role !== "student" || !opts || !opts.session || !opts.session.result) return false;
      var key = queueStoreKey(d.auth, d.identity.usernameKey);
      var ok = enqueue(d.store, key, {
        usernameKey: d.identity.usernameKey, ficha: d.identity.ficha,
        equipo: opts.equipo, practica: opts.practica,
        nonce: opts.session.attemptNonce || LEGACY_NONCE,
        session: opts.session, versionSimulador: currentSimVersion(), origen: "new", fuente: null, fechaMigracion: null,
      });
      flushNow();
      return ok;
    } catch (e) {
      return false;
    }
  }

  /** Migrador del navegador: detecta, valida, encola y sincroniza. Nunca bloquea. */
  function migrateBrowserLegacy() {
    try {
      var d = browserDeps();
      if (d.role !== "student" || !d.identity.usernameKey) return { items: 0, conflicts: 0 };
      var mkey = d.auth.getStudentStorageKey(d.identity.usernameKey, MIGRATED_KEY, { area: QUEUE_AREA });
      var scan = scanBrowserLegacy({ store: d.store, auth: d.auth, identity: d.identity, migratedMap: readJson(d.store, mkey, {}) });
      var qkey = queueStoreKey(d.auth, d.identity.usernameKey);
      scan.items.forEach(function (it) { enqueue(d.store, qkey, it); });
      if (scan.conflicts.length) {
        var ckey = d.auth.getStudentStorageKey(d.identity.usernameKey, CONFLICTS_KEY, { area: QUEUE_AREA });
        writeJson(d.store, ckey, { at: new Date().toISOString(), conflicts: scan.conflicts });
      }
      if (scan.items.length) flushNow();
      return { items: scan.items.length, conflicts: scan.conflicts.length };
    } catch (e) {
      return { items: 0, conflicts: 0, error: true };
    }
  }

  /** Intentos propios (Mi progreso): una consulta where uid == propio. */
  async function loadOwnAttempts() {
    var d = browserDeps();
    if (!d.identity.uid || !d.db || typeof d.db.cloudQueryHwlabAttempts !== "function") return { status: "offline", docs: [], reads: 0 };
    return d.db.cloudQueryHwlabAttempts("uid", d.identity.uid);
  }

  function pendingCount() {
    var d = browserDeps();
    var key = queueStoreKey(d.auth, d.identity.usernameKey);
    return key ? Object.keys(readJson(d.store, key, {})).length : 0;
  }

  // ── Resumen para paneles (puro; nunca reemplaza el historial) ────────────
  var ACTIVITIES_BY_EQUIPMENT = {
    desktop: ["ensamble", "desensamble", "diagnostico"],
    laptop: ["ensamble", "desensamble", "mantenimiento", "diagnostico"],
  };

  function sortByTime(list) {
    return list.slice().sort(function (a, b) {
      var ta = Date.parse(a.fechaFin || a.fechaInicio || a.recibidoEn || 0) || 0;
      var tb = Date.parse(b.fechaFin || b.fechaInicio || b.recibidoEn || 0) || 0;
      return ta - tb;
    });
  }

  /** attempts de UN aprendiz -> resumen por equipo/actividad + global. */
  function summarize(attempts) {
    var list = sortByTime(attempts || []);
    var cells = {};
    list.forEach(function (a) {
      var k = a.equipo + "/" + a.actividad;
      var c = cells[k] || (cells[k] = { intentos: 0, completados: 0, mejor: null, ultimo: null, ultimoFecha: null, aprobado: false, parcial: false, casos: {} });
      c.intentos++;
      if (a.completado) c.completados++;
      if (a.origen === "legacy_partial") c.parcial = true;
      if (typeof a.normalizedScore === "number") {
        c.mejor = c.mejor == null ? a.normalizedScore : Math.max(c.mejor, a.normalizedScore);
        c.ultimo = a.normalizedScore;
      }
      c.ultimoFecha = a.fechaFin || a.fechaInicio || c.ultimoFecha;
      if (a.estado === "APROBADO") c.aprobado = true;
      if (a.caso) c.casos[a.caso] = c.casos[a.caso] || a.estado === "APROBADO";
    });
    var total = 0, hechas = 0;
    Object.keys(ACTIVITIES_BY_EQUIPMENT).forEach(function (eq) {
      ACTIVITIES_BY_EQUIPMENT[eq].forEach(function (act) {
        total++;
        var c = cells[eq + "/" + act];
        if (c && c.completados > 0) hechas++;
      });
    });
    var scored = list.filter(function (a) { return typeof a.normalizedScore === "number"; });
    return {
      intentos: list.length,
      mejor: scored.length ? Math.max.apply(null, scored.map(function (a) { return a.normalizedScore; })) : null,
      ultimo: scored.length ? scored[scored.length - 1].normalizedScore : null,
      ultimoFecha: list.length ? list[list.length - 1].fechaFin || list[list.length - 1].fechaInicio || null : null,
      actividades: cells,
      progreso: { completadas: hechas, total: total },
      historial: list,
    };
  }

  /** Estado legible de una celda (texto, no solo color). */
  function cellStatus(cell) {
    if (!cell) return { code: "sin_registros", label: "Sin registros" };
    if (cell.completados === 0) return { code: "en_progreso", label: "En progreso" };
    if (cell.parcial && cell.mejor == null) return { code: "historico_parcial", label: "Histórico parcial" };
    return cell.aprobado ? { code: "aprobado", label: "Aprobado" } : { code: "por_mejorar", label: "Por mejorar" };
  }

  var api = {
    PASS_THRESHOLD: PASS_THRESHOLD,
    LEGACY_NONCE: LEGACY_NONCE,
    ACTIVITIES_BY_EQUIPMENT: ACTIVITIES_BY_EQUIPMENT,
    describePractice: describePractice,
    rawMaxFromBreakdown: rawMaxFromBreakdown,
    normalize: normalize,
    formatScore: formatScore,
    makeNonce: makeNonce,
    buildAttemptId: buildAttemptId,
    buildAttemptDoc: buildAttemptDoc,
    enqueue: enqueue,
    flush: flush,
    classifyLegacySession: classifyLegacySession,
    scanBrowserLegacy: scanBrowserLegacy,
    summarize: summarize,
    cellStatus: cellStatus,
    currentSimVersion: currentSimVersion,
    recordFinished: recordFinished,
    migrateBrowserLegacy: migrateBrowserLegacy,
    flushNow: flushNow,
    loadOwnAttempts: loadOwnAttempts,
    pendingCount: pendingCount,
    queueStoreKey: queueStoreKey,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Attempts = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
