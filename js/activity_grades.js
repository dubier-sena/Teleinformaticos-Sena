// activity_grades.js — Gestión y visualización de juicios de evaluación por actividad.
// Funciona para cualquier guía, presente o futura. El admin registra las notas en el
// panel administrativo; los aprendices las ven en cada actividad de la guía.
//
// Almacenamiento: sena_portal:student:{usernameKey}:app:grades
// Valor: JSON { "guia-01-induccion": { "arbol312": "A"|"D" }, ... }

(function () {
  "use strict";

  // ── Catálogo de actividades evaluadas por guía ──────────────────────────────
  // Agrega aquí nuevas guías a medida que se creen.
  var GRADE_CATALOG = {
    "guia-01-induccion": {
      label: "Guía 1 — Inducción",
      activities: [
        { id: "arbol312",      label: "3.1.2 Árbol de la Vida" },
        { id: "sena331",       label: "3.3.1 Logo-Símbolos SENA" },
        { id: "programa332",   label: "3.3.2 Cuestionario Diseño Curricular" },
        { id: "reglamento333", label: "3.3.3 Reglamento del Aprendiz" },
      ],
    },
    "guia-02-herramientas": {
      label: "Guía 2 — Herramientas Informáticas",
      activities: [
        { id: "extensiones331", label: "3.3.1 Extensiones y complementos" },
        { id: "sistemas332",    label: "3.3.2 Sistemas operativos" },
        { id: "colaborativas334", label: "3.3.4 Herramientas colaborativas" },
        { id: "transferReto341", label: "3.4.1 Reto de transferencia" },
      ],
    },
    "guia-redes-rap01": {
      label: "Guía Redes — RAP 01",
      activities: [
        { id: "reflexion311",    label: "3.1.1 Reflexión inicial" },
        { id: "socializacion311", label: "3.1.1 Socialización" },
        { id: "bloqueA",         label: "Bloque A — Tipos de redes" },
        { id: "bloqueB",         label: "Bloque B — Topologías" },
        { id: "bloqueC",         label: "Bloque C — Medios de transmisión" },
        { id: "bloqueD",         label: "Bloque D — Dispositivos" },
        { id: "bloqueE",         label: "Bloque E — Modelo OSI/TCP-IP" },
        { id: "ip1",             label: "Bloque IP 1" },
        { id: "ip3",             label: "Bloque IP 3" },
        { id: "lab1",            label: "Lab 1 — Topología estrella" },
        { id: "lab2",            label: "Lab 2 — Topología árbol" },
        { id: "lab3",            label: "Lab 3 — Red híbrida" },
        { id: "social",          label: "Socialización final" },
      ],
    },
    "guia-05-herramientas": {
      label: "Guía 5 — Herramientas (11°)",
      activities: [
        // El DOM usa ids sin guion (guia5311…); el catálogo conserva el id con guion
        // para no perder notas ya guardadas, y fija el mount explícito.
        { id: "guia5-311", label: "3.1.1 Bitácora de análisis", mount: "#guia5311DeadlineControls" },
        { id: "guia5-331", label: "3.3.1 Evidencias de herramientas", mount: "#guia5331DeadlineControls" },
        { id: "guia5-341", label: "3.4.1 Informe final integrador", mount: "#guia5341DeadlineControls" },
      ],
    },
    "guia-06-planificar": {
      label: "Guía 6 — Implementar componentes de las herramientas tecnológicas",
      activities: [
        { id: "bitacora311",      label: "3.1.1 Bitácora estudio de caso" },
        { id: "socializacion312", label: "3.1.2 Socialización" },
        { id: "tabla321",         label: "3.2.1 Tabla resumen" },
        { id: "mapa322",          label: "3.2.2 Mapa conceptual" },
        { id: "checklist331",     label: "3.3.1 Checklist instalación" },
        { id: "diagnostico332",   label: "3.3.2 Diagnóstico técnico" },
        { id: "presupuesto341",   label: "3.4.1 Presupuesto" },
      ],
    },
  };

  var GRADES_STORAGE_KEY = "grades";

  // ── Normalización de nombres ─────────────────────────────────────────────────
  function normalizeName(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ── Lectura / escritura en localStorage ─────────────────────────────────────
  function readJson(raw, fallback) {
    try { return raw ? (JSON.parse(raw) || fallback) : fallback; }
    catch (e) { return fallback; }
  }

  function getGradesKey(usernameKey) {
    var auth = window.portalAuth;
    if (!auth || !auth.getStudentStorageKey) return null;
    return auth.getStudentStorageKey(usernameKey, GRADES_STORAGE_KEY, { area: "app" });
  }

  // ── Sincronizacion con Firestore (sena_portal_grades) ───────────────────────
  // El admin escribe las notas (rule isAdmin); el aprendiz lee SOLO las suyas.
  // Reemplaza el archivo semilla publico data/grades_*.js (PII de menores).
  function gradesCloudDb() {
    var db = window._firebaseDb;
    return db && typeof db.cloudGetGrades === "function" ? db : null;
  }
  function fetchGradesFromCloud(usernameKey) {
    var db = gradesCloudDb();
    if (!db) return Promise.resolve(null);
    return Promise.resolve(db.cloudGetGrades(usernameKey)).catch(function () { return null; });
  }
  function saveGradesToCloud(usernameKey, allGrades) {
    var db = gradesCloudDb();
    if (!db || typeof db.cloudSaveGrades !== "function") return;
    // Fire-and-forget: lo invoca el admin; el rule isAdmin() lo autoriza.
    Promise.resolve(db.cloudSaveGrades(usernameKey, allGrades)).catch(function () {});
  }
  function setAllStudentGrades(usernameKey, allGrades) {
    var key = getGradesKey(usernameKey);
    if (key) localStorage.setItem(key, JSON.stringify(allGrades || {}));
  }

  function getStudentGrades(usernameKey, guideFamily) {
    var key = getGradesKey(usernameKey);
    if (!key) return {};
    var all = readJson(localStorage.getItem(key), {});
    return guideFamily ? (all[guideFamily] || {}) : all;
  }

  function setStudentGrades(usernameKey, guideFamily, gradesObj) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    all[guideFamily] = Object.assign({}, gradesObj);
    localStorage.setItem(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  function setStudentActivityGrade(usernameKey, guideFamily, activityId, grade) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    if (grade === "" || grade === null || grade === undefined) {
      delete all[guideFamily][activityId];
    } else {
      all[guideFamily][activityId] = grade;
    }
    localStorage.setItem(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  // Admin: fija la nota Y embebe (o limpia) la solucion modelo dentro del doc de notas
  // del aprendiz, en UNA sola escritura. La solucion solo se embebe cuando la nota es "A".
  // El aprendiz solo lee su propio doc, asi ve unicamente la solucion de SU actividad
  // aprobada; el banco maestro nunca llega a su cliente.
  function setStudentActivityGradeAndSolution(usernameKey, guideFamily, activityId, grade, solutionObj) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    var solKey = activityId + ":solution";
    if (grade === "" || grade === null || grade === undefined) {
      delete all[guideFamily][activityId];
    } else {
      all[guideFamily][activityId] = grade;
    }
    if (grade === "A" && solutionObj && typeof solutionObj === "object" && Object.keys(solutionObj).length) {
      all[guideFamily][solKey] = solutionObj;
    } else {
      delete all[guideFamily][solKey];   // sin "A" => sin solucion embebida
    }
    localStorage.setItem(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  function setStudentActivityObservation(usernameKey, guideFamily, activityId, obs) {
    var key = getGradesKey(usernameKey);
    if (!key) return;
    var all = readJson(localStorage.getItem(key), {});
    if (!all[guideFamily]) all[guideFamily] = {};
    var obsKey = activityId + ":obs";
    if (!obs || !String(obs).trim()) {
      delete all[guideFamily][obsKey];
    } else {
      all[guideFamily][obsKey] = String(obs).trim().slice(0, 500);
    }
    localStorage.setItem(key, JSON.stringify(all));
    saveGradesToCloud(usernameKey, all);
  }

  function getStudentActivityObservation(usernameKey, guideFamily, activityId) {
    var key = getGradesKey(usernameKey);
    if (!key) return "";
    var all = readJson(localStorage.getItem(key), {});
    return String((all[guideFamily] || {})[activityId + ":obs"] || "");
  }

  // ── Lectura para el aprendiz activo ─────────────────────────────────────────
  function getMyGrades(guideFamily) {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return {};
    return getStudentGrades(session.usernameKey, guideFamily);
  }

  // ── Punto de montaje del badge ──────────────────────────────────────────────
  // Resuelve dónde colocar el badge probando convenciones de id hasta hallar un
  // elemento existente. El badge se inserta como hermano ANTERIOR del contenedor,
  // así queda visible aunque el contenedor (p. ej. un *Status) esté display:none.
  function resolveGradeMount(activityId, explicitSelector) {
    var selectors = [];
    if (explicitSelector) selectors.push(explicitSelector);
    selectors.push(
      "#" + activityId + "GradeMount",
      "#" + activityId + "DeadlineControls",
      "#" + activityId + "DeliveryControls",
      "#" + activityId + "Status",
      '[data-act-grade="' + activityId + '"]'
    );
    for (var i = 0; i < selectors.length; i++) {
      var el = null;
      try { el = document.querySelector(selectors[i]); } catch (e) { el = null; }
      if (el) return el;
    }
    return null;
  }

  // Construye el badge. Solo Aprobado (A) y No aprobado (D) — las únicas notas que
  // registra el admin. Sin nota => devuelve null (no se muestra nada).
  function buildGradeBadge(grade, activityId) {
    var badgeClass, icon, html;
    if (grade === "A") {
      badgeClass = "activity-grade-badge activity-grade-badge--aprobado";
      icon = "✅";
      html = "<strong>¡Aprobado!</strong> Buen trabajo. 🎉";
    } else if (grade === "D") {
      badgeClass = "activity-grade-badge activity-grade-badge--desaprobado";
      icon = "❌";
      html = "<strong>No aprobado.</strong> Habla con tu instructor para reforzar esta actividad.";
    } else {
      return null;
    }
    var badge = document.createElement("div");
    badge.className = badgeClass;
    badge.setAttribute("data-grade-act", activityId);
    badge.innerHTML =
      '<span class="grade-badge-icon">' + icon + '</span>' +
      '<span class="grade-badge-text">' + html + '</span>';
    return badge;
  }

  // ── Renderizado de badges en la guía ────────────────────────────────────────
  // options: { guideFamily: string, activities: [{ activityId, mountSelector }] }
  // Lee las notas del aprendiz desde Firestore (las escribe el admin) y las cachea
  // en localStorage para reintentos/offline. Ya NO usa archivo semilla publico.
  async function renderGradeBadges(options) {
    var opts = options || {};
    var guideFamily = String(opts.guideFamily || "");
    var activities = Array.isArray(opts.activities) ? opts.activities : [];

    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;

    // Cache local primero; luego Firestore (fuente de verdad escrita por el admin).
    var grades = getStudentGrades(session.usernameKey, guideFamily);
    var cloud = await fetchGradesFromCloud(session.usernameKey);
    if (cloud && typeof cloud === "object") {
      setAllStudentGrades(session.usernameKey, cloud);
      grades = cloud[guideFamily] || {};
    }

    activities.forEach(function (cfg) {
      var grade = grades[cfg.activityId];
      // Solo notas reales (Aprobado / No aprobado). Sin nota => no se monta badge.
      if (grade !== "A" && grade !== "D") return;

      var mount = resolveGradeMount(cfg.activityId, cfg.mountSelector);
      if (!mount || !mount.parentNode) return;

      var parent = mount.parentNode;
      // Evitar duplicados del mismo badge para esta actividad.
      if (parent.querySelector('.activity-grade-badge[data-grade-act="' + cfg.activityId + '"]')) return;

      var badge = buildGradeBadge(grade, cfg.activityId);
      if (badge) parent.insertBefore(badge, mount);
    });
  }

  // ── Mapa archivo de guía → familia de calificaciones ────────────────────────
  // Cada página de guía (cargada con guia_template.js) declara aquí su familia para
  // que el badge se monte solo, sin tener que cablear cada guía a mano.
  var GUIDE_FAMILY_BY_FILE = {
    "grupo-10a-guia-01-induccion.html": "guia-01-induccion",
    "grupo-10b-guia-01-induccion.html": "guia-01-induccion",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": "guia-02-herramientas",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": "guia-02-herramientas",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia-05-herramientas",
    "grupo-11a-guia-06-planificar-informacion.html": "guia-06-planificar",
    "grupo-11b-guia-06-planificar-informacion.html": "guia-06-planificar",
    "santa-barbara-10a-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10b-guia-02-redes-rap01.html": "guia-redes-rap01",
    "santa-barbara-10a-guia-03-redes-rap02.html": "guia-redes-rap01",
    "santa-barbara-10b-guia-03-redes-rap02.html": "guia-redes-rap01",
  };

  // ── Banco de respuestas: relleno de actividades aprobadas y vacías ──────────
  // Cuando una actividad fue APROBADA (A) y el aprendiz dejó el/los campo(s) vacío(s),
  // se rellenan con la solución que el admin EMBEBIÓ en las notas del aprendiz al aprobar
  // ({actId}:solution dentro de sena_portal_grades). El banco maestro nunca llega al
  // cliente: el aprendiz solo lee su propia nota, así ve únicamente SU solución.
  // Si el aprendiz YA respondió, su respuesta se respeta (no se sobrescribe).
  // El relleno dispara `input`/`change` para que la guía guarde y sincronice como siempre.
  function applyApprovedSolutionsForFamily(family) {
    var auth = window.portalAuth;
    var session = auth && auth.getCurrentSession ? auth.getCurrentSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return false;

    // Las soluciones llegan EMBEBIDAS en las notas del aprendiz ({actId}:solution), que el
    // admin copia al aprobar. El banco maestro NUNCA se carga aqui: el aprendiz solo puede
    // ver la respuesta de su propia actividad aprobada, jamas el banco completo.
    var grades = getStudentGrades(session.usernameKey, family);
    var filledAny = false;
    Object.keys(grades).forEach(function (activityId) {
      if (activityId.indexOf(":solution") !== -1) return;  // saltar las llaves de payload
      if (grades[activityId] !== "A") return;              // solo actividades aprobadas
      var fields = grades[activityId + ":solution"];
      if (!fields || typeof fields !== "object") return;
      Object.keys(fields).forEach(function (storeKey) {
        var text = fields[storeKey];
        if (text == null || String(text) === "") return;
        var el = null;
        try { el = document.querySelector('[data-store="' + String(storeKey).replace(/"/g, '\\"') + '"]'); }
        catch (e) { el = null; }
        if (!el) return;                               // campo no existe (p. ej. archivo o fila ausente)
        var cur = (el.value != null ? String(el.value) : "").trim();
        if (cur.length > 0) return;                    // respeta la respuesta del aprendiz
        el.value = String(text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        filledAny = true;
      });
    });
    return filledAny;
  }

  // Auto-render para guías basadas en guia_template.js. Lo invoca initGuiaTemplateShell
  // después de inyectar el contenido. Resuelve el mount de cada actividad por convención,
  // y rellena desde el banco las actividades aprobadas que quedaron vacías.
  async function autoRenderForFile(pageFile) {
    var family = GUIDE_FAMILY_BY_FILE[String(pageFile || "")];
    if (!family) return;
    var entry = GRADE_CATALOG[family];
    if (!entry || !Array.isArray(entry.activities)) return;
    var activities = entry.activities.map(function (a) {
      return { activityId: a.id, mountSelector: a.mount || null };
    });
    await renderGradeBadges({ guideFamily: family, activities: activities });
    applyApprovedSolutionsForFamily(family);
  }

  // ── API pública ──────────────────────────────────────────────────────────────
  window.activityGradesManager = {
    GRADE_CATALOG: GRADE_CATALOG,
    GUIDE_FAMILY_BY_FILE: GUIDE_FAMILY_BY_FILE,
    autoRenderForFile: autoRenderForFile,
    applyApprovedSolutionsForFamily: applyApprovedSolutionsForFamily,
    getStudentGrades: getStudentGrades,
    setStudentGrades: setStudentGrades,
    setStudentActivityGrade: setStudentActivityGrade,
    setStudentActivityGradeAndSolution: setStudentActivityGradeAndSolution,
    setStudentActivityObservation: setStudentActivityObservation,
    getStudentActivityObservation: getStudentActivityObservation,
    getMyGrades: getMyGrades,
    renderGradeBadges: renderGradeBadges,
  };
})();
