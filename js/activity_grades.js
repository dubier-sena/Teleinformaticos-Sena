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
        { id: "guia5-311", label: "3.1.1 Bitácora de análisis" },
        { id: "guia5-331", label: "3.3.1 Evidencias de herramientas" },
        { id: "guia5-341", label: "3.4.1 Informe final integrador" },
      ],
    },
    "guia-06-planificar": {
      label: "Guía 6 — Planificar la Información",
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
    var session = auth && auth.getSession ? auth.getSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return {};
    return getStudentGrades(session.usernameKey, guideFamily);
  }

  // ── Búsqueda en datos semilla estáticos (fallback) ──────────────────────────
  function lookupSeedGrades(guideFamily, session, seedData) {
    if (!seedData) return null;
    var ficha = String(session.ficha || "");
    var fichaData = seedData[ficha];
    if (!fichaData) return null;
    var normalized = normalizeName(session.fullName);
    var grades = fichaData[normalized];
    if (grades) return grades;
    // Partial match on first two words (apellidos)
    var parts = normalized.split(" ");
    var apellidos = parts.slice(0, 2).join(" ");
    var matchKey = Object.keys(fichaData).find(function (k) {
      return k === apellidos || k.startsWith(apellidos + " ");
    });
    return matchKey ? fichaData[matchKey] : null;
  }

  // ── Renderizado de badges en la guía ────────────────────────────────────────
  // options: {
  //   guideFamily: string,
  //   activities: [{ activityId, mountSelector, label }],
  //   seedData: window.__GRADES_INDUCCION__ (opcional, fallback estático),
  // }
  function renderGradeBadges(options) {
    var opts = options || {};
    var guideFamily = String(opts.guideFamily || "");
    var activities = Array.isArray(opts.activities) ? opts.activities : [];
    var seedData = opts.seedData || null;

    var auth = window.portalAuth;
    var session = auth && auth.getSession ? auth.getSession() : null;
    if (!session || session.role !== "student" || !session.usernameKey) return;

    // Admin-set grades take priority; fall back to seed if none exist
    var grades = getMyGrades(guideFamily);
    if (!Object.keys(grades).length && seedData) {
      grades = lookupSeedGrades(guideFamily, session, seedData) || {};
    }

    activities.forEach(function (cfg) {
      var mountSelector = cfg.mountSelector;
      if (!mountSelector) return;
      var mount = document.querySelector(mountSelector);
      if (!mount) return;
      if (mount.querySelector(".activity-grade-badge")) return;

      var grade = grades[cfg.activityId];
      var badgeClass, icon, text;
      if (grade === "A") {
        badgeClass = "activity-grade-badge activity-grade-badge--aprobado";
        icon = "✅";
        text = "Aprobado";
      } else if (grade === "D") {
        badgeClass = "activity-grade-badge activity-grade-badge--desaprobado";
        icon = "❌";
        text = "No aprobado";
      } else if (grade === "P") {
        badgeClass = "activity-grade-badge activity-grade-badge--pendiente";
        icon = "⏳";
        text = "Pendiente de evaluación";
      } else {
        badgeClass = "activity-grade-badge activity-grade-badge--sin-nota";
        icon = "📋";
        text = "Sin nota registrada";
      }

      var badge = document.createElement("div");
      badge.className = badgeClass;
      badge.innerHTML =
        '<span class="grade-badge-icon">' + icon + '</span>' +
        '<span class="grade-badge-text"><strong>Nota:</strong> ' + text + '</span>';
      mount.insertBefore(badge, mount.firstChild);
    });
  }

  // ── API pública ──────────────────────────────────────────────────────────────
  window.activityGradesManager = {
    GRADE_CATALOG: GRADE_CATALOG,
    getStudentGrades: getStudentGrades,
    setStudentGrades: setStudentGrades,
    setStudentActivityGrade: setStudentActivityGrade,
    setStudentActivityObservation: setStudentActivityObservation,
    getStudentActivityObservation: getStudentActivityObservation,
    getMyGrades: getMyGrades,
    renderGradeBadges: renderGradeBadges,
  };
})();
