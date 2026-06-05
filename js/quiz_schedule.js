/*
 * quiz_schedule.js
 * -----------------------------------------------------------------------------
 * Programacion de quizzes que bloquean la guia.
 *
 * Que hace:
 *  - El admin define una "fecha de realizacion" para un quiz desde la tarjeta del
 *    propio quiz dentro de la guia.
 *  - Ese dia, si el aprendiz de la ficha indicada aun NO finalizo el quiz, al abrir
 *    la guia se le redirige al quiz y no puede entrar a la guia hasta terminarlo.
 *  - El aprendiz ve un aviso con la fecha programada.
 *
 * Reglas de seguridad / alcance:
 *  - Por defecto (sin fecha programada) NO hay ningun bloqueo. El gate solo actua
 *    en quizzes que el admin programo para HOY.
 *  - Solo bloquea a estudiantes de la ficha declarada. Admin y otras fichas nunca.
 *  - La fecha se guarda con activityDeadlineManager (sincroniza admin -> aprendiz
 *    por Drive). CERO lecturas/escrituras a Firestore.
 *  - "Finalizado" se lee del estado de la guia (mismo storage que escribe el motor
 *    del quiz), por eso cada quiz debe compartir el cloud-file de su guia.
 *
 * Se carga unicamente en guia.html (paginas de guia).
 * -----------------------------------------------------------------------------
 */
(function () {
  "use strict";

  // Registro central de quizzes programables. Para habilitar un quiz nuevo basta
  // con agregar una entrada aqui (guideFile = nombre del archivo de la guia;
  // cloudFile = data-quiz-cloud-file del quiz, que debe coincidir con el de la guia;
  // quizUrl = ruta del quiz relativa a la raiz; storageKey = data-quiz-storage-key;
  // ficha = ficha del grupo que se bloquea).
  var REGISTRY = [
    // Guia 3 - 10B - Estudio de contenidos tematicos (3.2.1)
    {
      guideFile: "grupo-10b-guia-03-planificar-informacion.html",
      cloudFile: "10b_guia3.html",
      quizUrl: "pages/auxiliares/grupo-10b-guia-03-act-3-2-1-quiz.html",
      storageKey: "quiz-guia3-321",
      ficha: "3441942",
      label: "Quiz 3.2.1 - Estudio de contenidos tematicos",
    },
    // Guia 3 - Herramientas (3.1.2)
    {
      guideFile: "grupo-10a-guia-03-planificar-informacion.html",
      cloudFile: "10a_guia3.html",
      quizUrl: "pages/auxiliares/grupo-10a-guia-03-herramientas-quiz.html",
      storageKey: "quiz-guia3-312",
      ficha: "3441939",
      label: "Quiz de herramientas (3.1.2)",
    },
    {
      guideFile: "grupo-10b-guia-03-planificar-informacion.html",
      cloudFile: "10b_guia3.html",
      quizUrl: "pages/auxiliares/grupo-10b-guia-03-herramientas-quiz.html",
      storageKey: "quiz-guia3-312",
      ficha: "3441942",
      label: "Quiz de herramientas (3.1.2)",
    },
    // Guia 2 - Herramientas informaticas y digitales (3.4.2)
    {
      guideFile: "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
      cloudFile: "10a_guia2.html",
      quizUrl: "pages/auxiliares/grupo-10a-guia-02-herramientas-quiz.html",
      storageKey: "quiz-guia2-342",
      ficha: "3441939",
      label: "Quiz de herramientas (3.4.2)",
    },
    {
      guideFile: "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
      cloudFile: "10b_guia2.html",
      quizUrl: "pages/auxiliares/grupo-10b-guia-02-herramientas-quiz.html",
      storageKey: "quiz-guia2-342",
      ficha: "3441942",
      label: "Quiz de herramientas (3.4.2)",
    },
    // Guia 6 - Herramientas (3.1.2) - 11A / 11B
    {
      guideFile: "grupo-11a-guia-06-planificar-informacion.html",
      cloudFile: "11a_guia6.html",
      quizUrl: "pages/auxiliares/grupo-11a-guia-06-herramientas-quiz.html",
      storageKey: "quiz-guia6-312",
      ficha: "3168850",
      label: "Quiz de herramientas (3.1.2)",
    },
    {
      guideFile: "grupo-11b-guia-06-planificar-informacion.html",
      cloudFile: "11b_guia6.html",
      quizUrl: "pages/auxiliares/grupo-11b-guia-06-herramientas-quiz.html",
      storageKey: "quiz-guia6-312",
      ficha: "3168852",
      label: "Quiz de herramientas (3.1.2)",
    },
    // Santa Barbara - Guia 2 - Redes - 10A
    {
      guideFile: "santa-barbara-10a-guia-02-redes-rap01.html",
      cloudFile: "sb_10a_redes.html",
      quizUrl: "pages/auxiliares/santa-barbara-10a-guia-02-redes-rap01-quiz.html",
      storageKey: "quiz-redes-321h",
      ficha: "3441944",
      label: "Quiz de redes (RAP01)",
    },
    {
      guideFile: "santa-barbara-10a-guia-02-redes-rap01.html",
      cloudFile: "sb_10a_redes.html",
      quizUrl: "pages/auxiliares/santa-barbara-10a-guia-02-redes-ip-quiz.html",
      storageKey: "quiz-redes-33h",
      ficha: "3441944",
      label: "Quiz de redes IP",
    },
    // Santa Barbara - Guia 2 - Redes - 10B
    {
      guideFile: "santa-barbara-10b-guia-02-redes-rap01.html",
      cloudFile: "sb_10b_redes.html",
      quizUrl: "pages/auxiliares/santa-barbara-10b-guia-02-redes-rap01-quiz.html",
      storageKey: "quiz-redes-321h",
      ficha: "3441950",
      label: "Quiz de redes (RAP01)",
    },
    {
      guideFile: "santa-barbara-10b-guia-02-redes-rap01.html",
      cloudFile: "sb_10b_redes.html",
      quizUrl: "pages/auxiliares/santa-barbara-10b-guia-02-redes-ip-quiz.html",
      storageKey: "quiz-redes-33h",
      ficha: "3441950",
      label: "Quiz de redes IP",
    },
  ];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function bogotaDay(value) {
    try {
      return new Date(value).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    } catch (e) {
      return "";
    }
  }
  function todayBogota() {
    return bogotaDay(Date.now());
  }

  function currentGuideFile() {
    var f =
      window.__RUNTIME_PAGE_FILE__ ||
      (window.location.pathname.split("/").pop() || "");
    return String(f).toLowerCase();
  }

  function getSession() {
    var pa = window.portalAuth;
    return pa && typeof pa.getCurrentSession === "function"
      ? pa.getCurrentSession()
      : null;
  }

  function getMgr() {
    return window.activityDeadlineManager || null;
  }

  function scopedKey(cloudFile) {
    var pa = window.portalAuth;
    var base =
      "guia_interactiva_" + String(cloudFile || "").replace(/[^a-z0-9]+/g, "_");
    if (pa && typeof pa.getScopedStorageKey === "function") {
      return pa.getScopedStorageKey(base, { area: "guide-data" });
    }
    return base;
  }

  // Lee el intento del quiz del estado de la guia (mismo storage que usa el motor).
  function readAttempt(cloudFile, storageKey) {
    try {
      var raw = localStorage.getItem(scopedKey(cloudFile));
      if (!raw) return null;
      var state = JSON.parse(raw);
      return state && typeof state === "object" ? state[storageKey] || null : null;
    } catch (e) {
      return null;
    }
  }

  function attemptDone(attempt) {
    return !!(
      attempt &&
      (attempt.locked ||
        attempt.status === "completed" ||
        attempt.status === "terminated_visibility")
    );
  }

  function getScheduledIso(entry) {
    var mgr = getMgr();
    if (!mgr || typeof mgr.getPolicy !== "function") return "";
    var p = mgr.getPolicy(entry.guideFile, entry.storageKey);
    return (p && p.dueAt) || "";
  }

  function prettyDate(iso, dayStr) {
    var mgr = getMgr();
    if (mgr && typeof mgr.formatDueAt === "function") {
      try {
        return mgr.formatDueAt(iso) || dayStr;
      } catch (e) {}
    }
    return dayStr;
  }

  function escapeAttr(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------------------------------------------------------------------------
  // Gate: redirige a la guia hacia el quiz si hoy es el dia programado y el quiz
  // aun no esta finalizado.
  // ---------------------------------------------------------------------------
  var gateDone = false;
  function enforceGate(entries) {
    if (gateDone || !entries.length) return Promise.resolve();
    var session = getSession();
    if (!session || session.role !== "student") return Promise.resolve();
    var ficha = String((session.user && session.user.ficha) || "");
    var mgr = getMgr();
    var ready =
      mgr && typeof mgr.ready === "function"
        ? Promise.resolve(mgr.ready()).catch(function () {})
        : Promise.resolve();
    return ready.then(function () {
      if (gateDone) return;
      var today = todayBogota();
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.ficha && String(e.ficha) !== ficha) continue;
        var iso = getScheduledIso(e);
        if (!iso) continue;
        if (bogotaDay(iso) !== today) continue;
        if (attemptDone(readAttempt(e.cloudFile, e.storageKey))) continue;
        gateDone = true;
        try {
          window.sessionStorage.setItem(
            "__qsched_lastRedirect",
            e.quizUrl + " @ " + new Date().toISOString()
          );
        } catch (err) {}
        window.location.replace(e.quizUrl);
        return;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // UI: selector de fecha (admin) / aviso (aprendiz), montado junto al enlace del
  // quiz dentro de la guia.
  // ---------------------------------------------------------------------------
  function findQuizLink(quizUrl) {
    var base = String(quizUrl).split("/").pop().toLowerCase();
    var anchors = document.querySelectorAll("a[href]");
    for (var i = 0; i < anchors.length; i++) {
      var href = (anchors[i].getAttribute("href") || "").toLowerCase();
      if (href.indexOf(base) !== -1) return anchors[i];
    }
    return null;
  }

  // Aviso para el aprendiz (junto al enlace del quiz). Vacio si no hay fecha.
  function buildStudentNotice(iso) {
    if (!iso) return "";
    var dayStr = bogotaDay(iso);
    return (
      '<div class="qsched-inner" style="margin-top:8px;font-size:.82rem;color:#92400e;background:#fff8e5;border:1px solid #efd49a;border-radius:8px;padding:8px 10px">' +
      "&#128197; Fecha programada del quiz: <strong>" +
      escapeAttr(prettyDate(iso, dayStr)) +
      "</strong>. Ese dia debes presentar el quiz antes de entrar a la guia." +
      "</div>"
    );
  }

  // Una fila del panel admin (un quiz de la guia).
  function buildAdminRow(entry, iso) {
    var dayStr = iso ? bogotaDay(iso) : "";
    return (
      '<div class="qsched-row" data-sk="' + escapeAttr(entry.storageKey) + '" ' +
      'style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 0;border-top:1px solid #e3efe7">' +
      '<span style="flex:1 1 220px;min-width:170px;font-size:.84rem;color:#143e23;font-weight:600">' +
      escapeAttr(entry.label || entry.storageKey) + "</span>" +
      '<input type="date" class="qsched-input" value="' + escapeAttr(dayStr) +
      '" style="padding:6px 8px;border:1px solid #cfe0d3;border-radius:6px;font-family:inherit">' +
      '<button type="button" class="qsched-save" style="padding:6px 12px;border:none;border-radius:6px;background:#0a5c31;color:#fff;font-weight:700;cursor:pointer;font-family:inherit">Guardar</button>' +
      '<button type="button" class="qsched-clear" style="padding:6px 12px;border:1px solid #cfe0d3;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit">Quitar</button>' +
      "</div>"
    );
  }

  // Panel consolidado del admin: lista TODOS los quizzes de la guia (no depende
  // de que su enlace este renderizado en el DOM).
  function buildAdminPanelHtml(entries) {
    var rows = entries
      .map(function (e) { return buildAdminRow(e, getScheduledIso(e)); })
      .join("");
    return (
      '<div style="font-size:.9rem;font-weight:800;color:#0a5c31;display:flex;align-items:center;gap:8px">' +
      "&#128197; Programacion de quizzes " +
      '<span style="font-weight:600;color:#6b7280;font-size:.78rem">(solo admin)</span></div>' +
      '<p style="margin:4px 0 6px;font-size:.78rem;color:#6b7280">El dia fijado, el aprendiz de la ficha del quiz abrira el quiz primero y no podra entrar a la guia hasta finalizarlo.</p>' +
      rows
    );
  }

  function saveDate(entry, value) {
    var mgr = getMgr();
    if (!mgr || typeof mgr.savePolicy !== "function") {
      window.alert("Sistema de fechas no disponible.");
      return;
    }
    if (!value) {
      window.alert("Selecciona una fecha.");
      return;
    }
    var session = getSession();
    var who = (session && session.user && session.user.usernameKey) || "admin";
    var iso = new Date(value + "T12:00:00-05:00").toISOString();
    Promise.resolve(mgr.savePolicy(entry.guideFile, entry.storageKey, iso, who))
      .then(function () {
        window.alert("Fecha del quiz guardada: " + value);
        scheduleMount(true);
      })
      .catch(function () {
        window.alert("No se pudo guardar la fecha del quiz.");
      });
  }

  function clearDate(entry) {
    var mgr = getMgr();
    if (!mgr || typeof mgr.clearPolicy !== "function") return;
    var session = getSession();
    var who = (session && session.user && session.user.usernameKey) || "admin";
    Promise.resolve(mgr.clearPolicy(entry.guideFile, entry.storageKey, who))
      .then(function () {
        window.alert("Fecha del quiz quitada.");
        scheduleMount(true);
      })
      .catch(function () {});
  }

  function bindControl(host, entry) {
    var saveBtn = host.querySelector(".qsched-save");
    var clearBtn = host.querySelector(".qsched-clear");
    var input = host.querySelector(".qsched-input");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        saveDate(entry, input ? input.value.trim() : "");
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearDate(entry);
      });
    }
  }

  // Admin: panel consolidado al inicio del contenido de la guia.
  function mountAdminPanel(entries) {
    var html = buildAdminPanelHtml(entries);
    var panel = document.getElementById("qsched-admin-panel");
    if (!panel) {
      var root = document.getElementById("guide-root");
      if (!root || !root.children.length) root = document.getElementById("page-root");
      if (!root || !root.children.length) root = document.body;
      if (!root) return;
      panel = document.createElement("div");
      panel.id = "qsched-admin-panel";
      panel.style.cssText =
        "margin:14px auto;max-width:1100px;padding:14px 16px;border:1px solid #cfe0d3;border-radius:14px;background:#f6fbf7;box-shadow:0 6px 18px rgba(7,38,22,.06)";
      root.insertBefore(panel, root.firstChild);
    }
    if (panel.getAttribute("data-qsched-html") === html) return;
    panel.setAttribute("data-qsched-html", html);
    panel.innerHTML = html;
    entries.forEach(function (entry) {
      var row = panel.querySelector('.qsched-row[data-sk="' + entry.storageKey + '"]');
      if (row) bindControl(row, entry);
    });
  }

  // Aprendiz: aviso de fecha junto al enlace de cada quiz.
  function mountStudentNotices(entries) {
    entries.forEach(function (entry) {
      var id = "qsched-" + entry.storageKey;
      var host = document.getElementById(id);
      var html = buildStudentNotice(getScheduledIso(entry));
      if (!html) {
        if (host) host.remove();
        return;
      }
      if (!host) {
        var link = findQuizLink(entry.quizUrl);
        if (!link) return; // aun no se renderizo el enlace del quiz
        host = document.createElement("div");
        host.id = id;
        host.className = "qsched-card";
        var ref = link.closest(".info-box, .activity-body, .activity, p") || link;
        if (ref && ref.parentNode) {
          ref.parentNode.insertBefore(host, ref.nextSibling);
        } else {
          return;
        }
      }
      if (host.getAttribute("data-qsched-html") === html) return;
      host.setAttribute("data-qsched-html", html);
      host.innerHTML = html;
    });
  }

  function mountControls(entries) {
    var session = getSession();
    if (session && session.role === "admin") {
      mountAdminPanel(entries);
      return;
    }
    if (session && session.role === "student") {
      mountStudentNotices(entries);
    }
  }

  // ---------------------------------------------------------------------------
  // Ciclo de vida: las guias renderizan el enlace del quiz de forma asincrona y
  // pueden re-renderizarlo. Observamos el DOM y re-montamos con debounce.
  // ---------------------------------------------------------------------------
  var ENTRIES = [];
  var mountTimer = null;
  var observer = null;

  function resolveEntries() {
    var gf = currentGuideFile();
    ENTRIES = REGISTRY.filter(function (e) {
      return e.guideFile === gf;
    });
    return ENTRIES.length > 0;
  }

  function scheduleMount(immediate) {
    if (!ENTRIES.length) return;
    if (immediate) {
      runMount();
      return;
    }
    if (mountTimer) return;
    mountTimer = window.setTimeout(runMount, 200);
  }
  function runMount() {
    mountTimer = null;
    if (observer) observer.disconnect();
    try {
      mountControls(ENTRIES);
    } catch (e) {}
    if (observer && document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // __RUNTIME_PAGE_FILE__ lo define guia_router.js; si aun no esta listo,
  // reintentamos brevemente antes de activar gate + UI.
  var bootTries = 0;
  function boot() {
    if (!resolveEntries()) {
      if (bootTries++ < 25) {
        window.setTimeout(boot, 150);
      }
      return;
    }
    // Gate (independiente del DOM): correr cuanto antes.
    enforceGate(ENTRIES);
    // UI: montar y observar cambios del DOM de la guia.
    if (window.MutationObserver && document.body) {
      observer = new window.MutationObserver(function () {
        scheduleMount(false);
      });
    }
    scheduleMount(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Exposicion para pruebas / depuracion.
  window.QuizSchedule = {
    REGISTRY: REGISTRY,
    entriesForGuide: function (guideFile) {
      return REGISTRY.filter(function (e) {
        return e.guideFile === String(guideFile || "").toLowerCase();
      });
    },
    bogotaDay: bogotaDay,
    readAttempt: readAttempt,
    attemptDone: attemptDone,
    getScheduledIso: getScheduledIso,
    _enforceGate: enforceGate,
    _mount: function () {
      scheduleMount(true);
    },
  };
})();
