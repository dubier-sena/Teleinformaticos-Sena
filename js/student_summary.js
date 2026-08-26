/* js/student_summary.js
 *
 * Resumen remoto derivado del estado del aprendiz (Fase 11 - Home cross-
 * device). Se calcula y escribe SIEMPRE desde el propio navegador del
 * aprendiz -- nunca desde el panel admin -- porque es el unico que tiene a
 * mano su progreso local de guias. NO es fuente de verdad de nada (ver
 * comentario en firestore.rules junto a sena_portal_student_summary): las
 * respuestas siguen en sena_portal_guide_state, las notas oficiales en
 * sena_portal_grades, las entregas quedan en Drive. Sirve solo para que
 * portal_home.js pueda mostrar un estado razonable en un dispositivo o
 * navegador nuevo, sin depender de que el aprendiz haya visitado antes cada
 * guia/modulo en ESE equipo puntual (ver auditoria Fase 11: firma y talleres
 * de refuerzo ya eran cross-device por leer Firestore directo; documentos
 * base de Etapa Productiva y actividades "No aprobada" NO lo eran, porque
 * dependian de localStorage/cache que solo se llena al usar ese modulo en
 * ese equipo).
 */
(function () {
  "use strict";

  // Mismas fichas que PRODUCTIVE_FICHAS en portal_home.js: solo ellas tienen
  // Etapa Productiva, evita leer el catalogo (doc compartido pesado) para el
  // resto de aprendices.
  var PRODUCTIVE_FICHAS = ["3168850", "3168852"];
  // ids reales en PROJECT_DOCUMENTS (productive_stage_project_delivery.js);
  // el docId guardado en el catalogo es exactamente doc.id (ver
  // appendDocumentDeliveryToSnapshot / panelKey "etapa-doc-" + doc.id).
  var PRODUCTIVE_BASE_DOC_LABELS = {
    "ficha-inscripcion": "Ficha de inscripción",
    "acuerdo-etapa-productiva": "Acuerdo de Etapa Productiva",
  };
  // Pasado esto, el resumen se considera "viejo": el Home lo muestra igual
  // (marcado como tal) mientras se refresca en segundo plano. No es un TTL de
  // borrado, solo el umbral para decidir si vale la pena recalcular ahora.
  // 60 min: los eventos que de verdad importan (una entrega propia) ya se
  // capturan al instante via "guide-delivery-registered" sin esperar este
  // umbral; este solo cubre cambios hechos por el admin (calificar, asignar
  // un taller) que el navegador del aprendiz no puede saber que ocurrieron
  // hasta preguntar de nuevo. Un valor mas corto (p.ej. 15 min) refresca en
  // segundo plano en cada visita espaciada del dia, sin bajar el tiempo de
  // pintado (el refresco no bloquea), pero si sube lecturas de Firestore sin
  // beneficio real para este tipo de aviso formativo.
  var STALE_AFTER_MS = 60 * 60 * 1000;
  var LOCAL_MIRROR_PREFIX = "sena_portal_student_summary_mirror_v1:";

  function auth() { return window.portalAuth; }
  function db() { return window._firebaseDb; }

  function currentUid() {
    var bridge = window.portalFirebaseAuth;
    if (!bridge || typeof bridge.currentUid !== "function") return null;
    try { return bridge.currentUid(); } catch (e) { return null; }
  }

  function mirrorKey(usernameKey) {
    return LOCAL_MIRROR_PREFIX + String(usernameKey || "");
  }

  function readMirror(usernameKey) {
    try {
      var raw = window.localStorage.getItem(mirrorKey(usernameKey));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeMirror(usernameKey, summary) {
    try {
      window.localStorage.setItem(mirrorKey(usernameKey), JSON.stringify(summary || {}));
    } catch (e) {
      // Almacenamiento lleno: el mirror es solo un atajo de pintado, no pasa nada.
    }
  }

  function isStale(summary) {
    return !summary || !summary.updatedAt ||
      (Date.now() - Date.parse(summary.updatedAt)) >= STALE_AFTER_MS;
  }

  // ── Recoleccion de cada campo derivado (cada uno falla en silencio hacia
  //    "no se sabe" en vez de tumbar todo el resumen) ─────────────────────
  async function collectRejectedActivities(usernameKey) {
    var mgr = window.activityGradesManager;
    var dbApi = db();
    if (!mgr || !mgr.GUIDE_FAMILY_BY_FILE || !mgr.GRADE_CATALOG) return [];
    if (!dbApi || typeof dbApi.cloudGetGrades !== "function") return [];
    var grades;
    try {
      grades = await dbApi.cloudGetGrades(usernameKey);
    } catch (e) {
      return [];
    }
    if (!grades || typeof grades !== "object") return [];
    var rejected = [];
    Object.keys(grades).forEach(function (family) {
      var catalogEntry = mgr.GRADE_CATALOG[family];
      var activities = catalogEntry && Array.isArray(catalogEntry.activities) ? catalogEntry.activities : [];
      if (!activities.length) return;
      var familyGrades = grades[family] || {};
      activities.forEach(function (act) {
        if (familyGrades[act.id] !== "D") return;
        rejected.push({
          family: family,
          activityId: act.id,
          activityLabel: (catalogEntry.label || family) + ": " + (act.label || act.id),
          reason: familyGrades[act.id + ":obs"] || "",
        });
      });
    });
    // Resumen liviano: un tope razonable evita que un caso extremo lo infle.
    return rejected.slice(0, 20);
  }

  async function collectSignaturePending(usernameKey) {
    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudGetSignatureAuth !== "function") return false;
    try {
      var record = await dbApi.cloudGetSignatureAuth(usernameKey);
      return !(record && record.status === "delivered");
    } catch (e) {
      return false;
    }
  }

  async function collectReinforcementPendingCount(usernameKey) {
    var dbApi = db();
    if (!dbApi || typeof dbApi.cloudGetReinforcementWorkshops !== "function") return 0;
    try {
      var workshops = await dbApi.cloudGetReinforcementWorkshops(usernameKey);
      if (!Array.isArray(workshops)) return 0;
      return workshops.filter(function (w) {
        return w && w.resultado !== "A" && w.resultado !== "D";
      }).length;
    } catch (e) {
      return 0;
    }
  }

  // Devuelve null cuando no aplica/no se pudo saber (el llamador NO debe
  // interpretar null como "al dia" -- solo [] significa "sin pendientes").
  async function collectProductiveDocsPending(usernameKey, ficha) {
    if (PRODUCTIVE_FICHAS.indexOf(String(ficha)) === -1) return null;
    var store = window.productiveStageStore;
    if (!store || typeof store.loadStudentSnapshot !== "function" ||
      typeof store.getDocumentDeliveriesByUsername !== "function") {
      return null;
    }
    try {
      // Bloque C.1: vista propia (server-side, por idToken) en vez del
      // snapshot completo -- este resumen del aprendiz nunca necesito datos
      // de otros, solo lo parecia porque loadSnapshot() traia todo.
      var snapshot = await store.loadStudentSnapshot();
      var byUsername = store.getDocumentDeliveriesByUsername(snapshot) || {};
      var delivered = byUsername[String(usernameKey || "").trim().toLowerCase()] || {};
      return Object.keys(PRODUCTIVE_BASE_DOC_LABELS).filter(function (docId) {
        return !delivered[docId];
      }).map(function (docId) {
        return PRODUCTIVE_BASE_DOC_LABELS[docId];
      });
    } catch (e) {
      return null;
    }
  }

  // Promedio simple sobre las guias habilitadas de la ficha, leyendo el mismo
  // progreso local que ya usan las tarjetas del Home (getStudentGuideProgress).
  // No agrega una lectura nueva: es un aprovechamiento de datos que este mismo
  // equipo ya tiene, util sobre todo para el PROXIMO equipo que lea el resumen.
  function averageGuideProgress(usernameKey, files) {
    var a = auth();
    if (!a || typeof a.getStudentGuideProgress !== "function" || !files.length) return 0;
    var total = 0;
    files.forEach(function (file) {
      var progress = a.getStudentGuideProgress(usernameKey, file);
      total += Math.max(0, Math.min(100, Math.round((progress && progress.percent) || 0)));
    });
    return Math.round(total / files.length);
  }

  async function computeStudentSummary(session) {
    var user = (session && session.user) || {};
    var usernameKey = user.usernameKey || user.username;
    var ficha = user.ficha;
    var uid = currentUid();
    if (!usernameKey || !uid) return null;

    var a = auth();
    var files = (a && typeof a.getGuidesForFicha === "function" ? a.getGuidesForFicha(ficha) : []) || [];

    var results;
    try {
      results = await Promise.all([
        collectRejectedActivities(usernameKey),
        collectSignaturePending(usernameKey),
        collectReinforcementPendingCount(usernameKey),
        collectProductiveDocsPending(usernameKey, ficha),
      ]);
    } catch (e) {
      return null;
    }

    return {
      uid: uid,
      usernameKey: usernameKey,
      ficha: ficha || null,
      guidesProgressPercent: averageGuideProgress(usernameKey, files),
      rejectedActivities: results[0],
      signaturePending: !!results[1],
      reinforcementPendingCount: results[2] || 0,
      productiveDocsPending: results[3],
      source: "derived",
    };
  }

  // ── Escritura con throttle: evita recalcular/reescribir en cada visita si
  //    el resumen ya es reciente. `force` lo salta (evento de entrega real, o
  //    reconstruccion porque no existia ninguna copia) ────────────────────
  var _refreshing = {};
  async function refreshStudentSummary(session, opts) {
    var force = !!(opts && opts.force);
    var user = (session && session.user) || {};
    var usernameKey = user.usernameKey || user.username;
    if (!usernameKey) return null;
    if (_refreshing[usernameKey]) return _refreshing[usernameKey];

    var mirror = readMirror(usernameKey);
    if (!force && !isStale(mirror)) return mirror;

    var task = (async function () {
      var summary = await computeStudentSummary(session);
      if (!summary) return mirror;
      summary.updatedAt = new Date().toISOString();
      writeMirror(usernameKey, summary);
      var dbApi = db();
      if (dbApi && typeof dbApi.cloudSaveStudentSummary === "function") {
        try {
          await dbApi.cloudSaveStudentSummary(summary.uid, summary);
        } catch (e) {
          // Mejor esfuerzo: si falla la escritura remota, el mirror local
          // igual sirve para este equipo hasta el proximo intento.
        }
      }
      return summary;
    })();
    _refreshing[usernameKey] = task;
    try {
      return await task;
    } finally {
      delete _refreshing[usernameKey];
    }
  }

  // ── Carga para el Home: 1 lectura remota (si hay uid) + reconstruccion
  //    automatica si no existe ninguna copia en ningun lado ────────────────
  async function loadStudentSummaryForHome(session) {
    var user = (session && session.user) || {};
    var usernameKey = user.usernameKey || user.username;
    if (!usernameKey) return { summary: null, stale: true, source: "none" };

    var mirror = readMirror(usernameKey);
    var uid = currentUid();
    var dbApi = db();
    var remote = null;
    if (uid && dbApi && typeof dbApi.cloudGetStudentSummary === "function") {
      try {
        remote = await dbApi.cloudGetStudentSummary(uid);
      } catch (e) {
        remote = null;
      }
    }

    var best = mirror;
    if (remote && remote.updatedAt &&
      (!mirror || !mirror.updatedAt || Date.parse(remote.updatedAt) >= Date.parse(mirror.updatedAt))) {
      best = remote;
      writeMirror(usernameKey, remote);
    }

    if (!best) {
      // Ni mirror local ni resumen remoto: primera vez de este aprendiz (o
      // primer equipo). Se espera el computo completo una sola vez para no
      // dejar el Home sin nada que mostrar en las alertas.
      best = await refreshStudentSummary(session, { force: true });
      return { summary: best, stale: false, source: best ? "reconstructed" : "unavailable" };
    }

    if (isStale(best)) {
      // Se muestra YA lo ultimo conocido (el llamador lo marca como posible-
      // mente viejo) y se refresca en segundo plano sin bloquear el render.
      // BUG real encontrado en verificacion visual (Fase 11, cierre): cuando
      // el computo fallaba (sin uid / sin red), refreshStudentSummary
      // devolvia el MISMO mirror viejo sin cambiar nada, pero este callback
      // igual disparaba "student-summary-updated" -> portal_home.js volvia a
      // renderizar -> volvia a pedir el resumen -> lo seguia viendo stale ->
      // refrescaba otra vez -> disparaba el evento otra vez, sin fin (bucle
      // infinito, confirmado que cuelga la pestaña). Comparar updatedAt antes
      // y despues corta el bucle: solo se avisa si el refresco de verdad
      // trajo un resumen mas nuevo.
      var previousUpdatedAt = best.updatedAt;
      refreshStudentSummary(session, { force: true }).then(function (fresh) {
        if (fresh && fresh.updatedAt && fresh.updatedAt !== previousUpdatedAt) {
          try {
            document.dispatchEvent(new CustomEvent("student-summary-updated", { detail: fresh }));
          } catch (e) { /* CustomEvent no disponible: sin re-render automatico */ }
        }
      }).catch(function () {});
    }

    return { summary: best, stale: isStale(best), source: remote === best ? "remote" : "local-mirror" };
  }

  // Una entrega real (cualquier guia, Etapa Productiva, firma, etc.) es la
  // señal de mayor confianza de que el estado cambio: se reutiliza el mismo
  // evento global que ya dispara shared_apps_script_delivery.js, sin tener
  // que enganchar cada flujo de entrega por separado.
  document.addEventListener("guide-delivery-registered", function () {
    var a = auth();
    var session = a && typeof a.getCurrentSession === "function" ? a.getCurrentSession() : null;
    if (session && session.role === "student") {
      refreshStudentSummary(session, { force: true }).catch(function () {});
    }
  });

  window.studentSummary = {
    loadForHome: loadStudentSummaryForHome,
    refreshNow: refreshStudentSummary,
    compute: computeStudentSummary,
    isStale: isStale,
  };
})();
