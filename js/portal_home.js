/* portal_home.js
 *
 * Controlador del inicio rediseñado "sesión primero".
 * - Invitado  -> pantalla de login / crear usuario / admin.
 * - Aprendiz  -> "Mis guías": el portal detecta su ficha y muestra solo
 *                sus guías (dinámicas) con avance y estado, para elegir una.
 * - Admin     -> panel de gestión.
 *
 * Reutiliza window.portalAuth (login, fichas, guías y avance ya existentes).
 * El avance se lee de localStorage (getStudentGuideProgress) => CERO lecturas
 * a Firestore, no consume cuota.
 */
(function () {
  "use strict";

  var auth = window.portalAuth;
  if (!auth) {
    return;
  }

  var PRODUCTIVE_FICHAS = ["3168850", "3168852"];

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showView(viewId) {
    ["home-guest", "home-student", "home-admin"].forEach(function (id) {
      var el = byId(id);
      if (el) {
        el.hidden = id !== viewId;
      }
    });
  }

  function setFeedback(id, message, type) {
    var box = byId(id);
    if (!box) {
      return;
    }
    if (!message) {
      box.textContent = "";
      box.className = "auth-feedback";
      box.style.display = "none";
      return;
    }
    box.textContent = message;
    box.className = "auth-feedback " + (type || "info");
    box.style.display = "block";
  }

  function consumeFlash() {
    if (typeof auth.consumeFlashMessage !== "function") {
      return;
    }
    var flash = auth.consumeFlashMessage();
    if (flash && flash.message) {
      setFeedback("portal-flash", flash.message, flash.type || "info");
    }
  }

  // ── Pestañas de acceso (login / registro / admin) ────────────────────────
  function bindAuthTabs() {
    document.querySelectorAll("[data-auth-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        var tab = button.dataset.authTab;
        document.querySelectorAll("[data-auth-tab]").forEach(function (b) {
          b.classList.toggle("active", b.dataset.authTab === tab);
        });
        document.querySelectorAll("[data-auth-pane]").forEach(function (pane) {
          pane.classList.toggle("active", pane.dataset.authPane === tab);
        });
      });
    });
  }

  // ── Estado por avance ─────────────────────────────────────────────────────
  function estadoFor(percent) {
    if (percent >= 100) {
      return { cls: "done", label: "Completada", cta: "Repasar guía", secondary: true };
    }
    if (percent > 0) {
      return { cls: "prog", label: "En progreso", cta: "Continuar guía", secondary: false };
    }
    return { cls: "todo", label: "Por iniciar", cta: "Abrir guía", secondary: false };
  }

  function guideNumber(title, index) {
    var match = String(title || "").match(/gu[ií]a\s*(\d+)/i);
    return match ? match[1] : String(index + 1);
  }

  // ── Fechas de entrega (lee la caché local que ya sincroniza el sistema de
  //    deadlines; NO hace lecturas a la nube → cero cuota Firestore) ──────────
  var _dlPolicies = null;
  function deadlinePolicies() {
    if (_dlPolicies) return _dlPolicies;
    try {
      var raw = localStorage.getItem("sena_portal_admin_activity_deadlines_v1");
      var snap = raw ? JSON.parse(raw) : null;
      _dlPolicies = (snap && snap.policies) || {};
    } catch (e) { _dlPolicies = {}; }
    return _dlPolicies;
  }
  function fmtDay(ts) {
    try {
      return new Date(ts).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
    } catch (e) { return ""; }
  }
  function deadlineBadge(file) {
    var pol = deadlinePolicies()[file];
    if (!pol || typeof pol !== "object") return "";
    var times = Object.keys(pol).map(function (k) {
      var d = pol[k] && pol[k].dueAt;
      var t = d ? Date.parse(d) : NaN;
      return isFinite(t) ? t : null;
    }).filter(function (t) { return t != null; });
    if (!times.length) return "";
    var now = Date.now();
    var future = times.filter(function (t) { return t >= now; }).sort(function (a, b) { return a - b; });
    var cls, icon, label;
    if (future.length) {
      var t = future[0];
      var soon = (t - now) < 72 * 3600 * 1000; // 3 días
      cls = soon ? "soon" : "open";
      icon = soon ? "🟡" : "📅";
      label = (soon ? "Entrega próxima · " : "Entrega · ") + fmtDay(t);
    } else {
      var last = times.sort(function (a, b) { return b - a; })[0];
      cls = "late"; icon = "🔴"; label = "Entrega vencida · " + fmtDay(last);
    }
    return '<div class="guide__deadline-row"><span class="guide__deadline guide__deadline--' +
      cls + '">' + icon + " " + esc(label) + "</span></div>";
  }

  function firstName(user) {
    return String(user.fullName || user.username || "")
      .trim()
      .split(/\s+/)[0] || "aprendiz";
  }

  // ── Actividades pendientes por guia (lee el estado local ya sincronizado;
  //    NO hace lecturas a la nube → cero cuota Firestore, igual que el resto
  //    de este archivo) ────────────────────────────────────────────────────
  // Induccion y Redes RAP01 (Santa Barbara) tienen un script propio/legacy que
  // guarda el estado real bajo una clave de localStorage DISTINTA a la que
  // ActivityStandard.getStateKeyForGuide() devuelve -- ese valor registrado es
  // corto (p.ej. "10a_guia", pensado solo como prefijo de avance/catalogo, ver
  // GUIDE_PROGRESS_CONFIG en portal_auth.js), no la clave completa donde el
  // aprendiz realmente guarda (ver STORAGE_KEY en script_induccion.js /
  // STORAGE_KEY_REDES en script_guia_redes.js). Mismo criterio que
  // getGuideStateKey() en admin_usuarios.js (bug ya encontrado ahi jul-3);
  // se repite aqui porque portal_home.js no carga ese script (exclusivo del
  // panel admin). Sin este alias, guideState() siempre leia {} para estas
  // guias -> el checklist de "Pendiente en esta guia" mostraba TODO como
  // pendiente aunque el aprendiz ya hubiera guardado o el avance mostrara
  // 100% (bug reportado jul-10).
  // Guias 5/6/7/8 y Taller Integrador de grado 11 (Santa Barbara) registran
  // 11A y 11B en un solo register({files:[...], stateKey:"...11a_guia..."}) --
  // el stateKey declarado es UN solo literal con "11a", asi que
  // getStateKeyForGuide() devuelve ese mismo valor tambien para el archivo
  // 11B (la clave real de 11B tiene "11b" en vez de "11a"). Mismo sintoma que
  // el caso Induccion/RAP01 de arriba, aunque aqui la causa es otra: no hay
  // script propio, es que el stateKey de la declaracion no varia por archivo.
  // Detectado 2026-07-26 en QA de grado 11 SB (10B mostraba 100% en la guia
  // pero "Pendiente en esta guia" seguia listando todo en el home).
  var REAL_STATE_KEY_ALIASES = {
    "grupo-10a-guia-01-induccion.html": "guia_induccion_10a_guia_html",
    "grupo-10b-guia-01-induccion.html": "guia_induccion_10b_guia_html",
    "santa-barbara-10a-guia-02-redes-rap01.html": "guia_interactiva_sb_10a_redes_html",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": "guia_interactiva_11b_guia_html",
    "grupo-11b-guia-06-planificar-informacion.html": "guia_interactiva_11b_guia6_html",
    "grupo-11b-guia-07-planificar-informacion-ciberseguridad.html": "guia_interactiva_11b_guia7_html",
    "grupo-11b-guia-08-documentar-gestion-informacion.html": "guia_interactiva_11b_guia8_html",
    "grupo-11b-guia-09-taller-integrador.html": "guia_interactiva_11b_guia9_html",
    "santa-barbara-10b-guia-02-redes-rap01.html": "guia_interactiva_sb_10b_redes_html",
  };
  function guideState(file, usernameKey) {
    var std = window.ActivityStandard;
    var stateKey = REAL_STATE_KEY_ALIASES[file] ||
      (std && typeof std.getStateKeyForGuide === "function" ? std.getStateKeyForGuide(file) : "");
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return {};
    var storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    try {
      var raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // ── Hidratación de equipo nuevo (navegador sin datos locales) ─────────────
  // El estado de cada guia solo se copiaba a localStorage al ABRIR esa guia:
  // en un PC nuevo o ventana privada el home mostraba "0% / todo pendiente"
  // hasta entrar a los modulos uno por uno. Esto baja UNA vez el estado de las
  // guias SIN copia local (mismo doc, scope y alias que usa la propia guia) y
  // lo deja bajo la clave local real. En visitas normales (con copia local)
  // sigue siendo 0 lecturas. El % oficial llega aparte: firebase_db restaura
  // el progreso al cargar y dispara "portal-student-restored" (re-render).
  var hydrateTriedFiles = {};
  async function hydrateMissingGuideStates(user, files) {
    var db = window._firebaseDb;
    var std = window.ActivityStandard;
    if (!db || typeof db.cloudGetGuideData !== "function") return false;
    if (typeof auth.getStudentStorageKey !== "function") return false;
    if (typeof db.shouldDeferCloudReads === "function" && db.shouldDeferCloudReads()) return false;
    var usernameKey = user.usernameKey || user.username;
    if (!usernameKey) return false;
    var scope = "student:" + usernameKey;
    var changed = false;
    await Promise.all((files || []).map(async function (file) {
      if (hydrateTriedFiles[file]) return;
      hydrateTriedFiles[file] = true;
      var stateKey = REAL_STATE_KEY_ALIASES[file] ||
        (std && typeof std.getStateKeyForGuide === "function" ? std.getStateKeyForGuide(file) : "");
      if (!stateKey) return;
      var storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
      try { if (localStorage.getItem(storageKey)) return; } catch (e) { return; }
      var cloudFile = typeof db.guideDataFileName === "function" ? db.guideDataFileName(file) : file;
      var snapshot = null;
      try { snapshot = await db.cloudGetGuideData(scope, cloudFile); } catch (e) { return; }
      var state = snapshot && typeof snapshot.state === "object" && snapshot.state
        ? snapshot.state
        : (snapshot && typeof snapshot.data === "object" && snapshot.data ? snapshot.data : null);
      if (!state || !Object.keys(state).length) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
        // El __meta con updatedAt preserva el LWW de la guia al abrirla luego.
        localStorage.setItem(storageKey + "__meta", JSON.stringify({
          updatedAt: (snapshot && snapshot.updatedAt) || state.updatedAt || new Date().toISOString(),
          updatedBy: "home-hydrate",
        }));
        changed = true;
      } catch (e) { /* almacenamiento lleno: la guia hidratara al abrirse */ }
    }));
    return changed;
  }

  // Devuelve las etiquetas de las actividades AUN pendientes de esta guia.
  // Varias sub-actividades comparten "number" cuando son partes de una misma
  // actividad visible (p. ej. las 5 partes de Ciberseguridad en Guia 2) --
  // se cuenta una sola vez por number, igual que ya hace Calificaciones.
  function pendingActivitiesFor(file, usernameKey) {
    var std = window.ActivityStandard;
    if (!std || typeof std.getConfigForGuide !== "function" || typeof std.getActivityDeliveryInfo !== "function") {
      return [];
    }
    var config = std.getConfigForGuide(file);
    var activities = config && Array.isArray(config.activities) ? config.activities : [];
    if (!activities.length) return [];

    var state = guideState(file, usernameKey);
    var seenNumbers = {};
    var pending = [];
    activities.forEach(function (act) {
      if (act.number) {
        if (seenNumbers[act.number]) return;
        seenNumbers[act.number] = true;
      }
      var info = std.getActivityDeliveryInfo(act, state);
      if (info.kind === "pending") {
        pending.push(act.label || act.shortName || act.id);
      }
    });
    return pending;
  }

  function pendingListHtml(pending) {
    if (!pending.length) return "";
    var MAX_SHOWN = 5;
    var shown = pending.slice(0, MAX_SHOWN);
    var extra = pending.length - shown.length;
    var items = shown.map(function (label) {
      return '<li class="guide__pending-item">' + esc(label) + "</li>";
    }).join("");
    if (extra > 0) {
      items += '<li class="guide__pending-item guide__pending-item--more">y ' + extra + " más…</li>";
    }
    return (
      '<div class="guide__pending">' +
      '<span class="guide__pending-label">📋 Pendiente en esta guía</span>' +
      '<ul class="guide__pending-list">' + items + "</ul>" +
      "</div>"
    );
  }

  // ── Vista aprendiz ────────────────────────────────────────────────────────
  function renderStudent(session) {
    var user = session.user || {};
    var info = typeof auth.getFichaInfo === "function" ? auth.getFichaInfo(user.ficha) : null;
    var inst = user.inst || (info && info.inst) || "";
    var grupo = user.grupo || (info && info.grupo) || "";

    var nameEl = byId("welcome-name");
    if (nameEl) {
      nameEl.textContent = "Hola, " + firstName(user) + " 👋";
    }

    var ctx = byId("welcome-ctx");
    if (ctx) {
      var parts = [];
      if (inst) parts.push('<span>🏫 ' + esc(inst) + "</span>");
      if (grupo) parts.push('<span>🎓 Grupo ' + esc(grupo) + "</span>");
      if (user.ficha) parts.push('<span>🪪 Ficha ' + esc(user.ficha) + "</span>");
      ctx.innerHTML = parts.join("");
    }

    var quick = byId("student-quick");
    if (quick) {
      var links = [
        '<a href="pages/auxiliares/calendario-aprendiz.html">📅 Mi calendario de clases</a>',
      ];
      if (PRODUCTIVE_FICHAS.indexOf(String(user.ficha)) !== -1) {
        links.push('<a href="etapa-productiva-estudiante.html">💼 Mi proyecto y retroalimentación</a>');
      }
      // Laboratorio Virtual de Hardware: TEMPORALMENTE solo admin (pedido
      // 2026-08-16), por eso NO se ofrece aqui como acceso rapido del
      // aprendiz aunque su ficha ya tenga optionalModules.hardwareLab. La
      // pagina en si redirige a cualquier sesion que no sea admin.
      quick.innerHTML = links.join("");
    }

    var files = (typeof auth.getGuidesForFicha === "function" ? auth.getGuidesForFicha(user.ficha) : []) || [];
    var key = user.usernameKey || user.username;
    var container = byId("student-guides");
    if (!container) {
      return;
    }

    if (!files.length) {
      container.innerHTML =
        '<p class="guides-empty">Aún no hay guías habilitadas para tu ficha. Consulta con tu instructor.</p>';
      return;
    }

    container.innerHTML = files
      .map(function (file, index) {
        var progress = typeof auth.getStudentGuideProgress === "function"
          ? auth.getStudentGuideProgress(key, file)
          : { percent: 0 };
        var percent = Math.max(0, Math.min(100, Math.round((progress && progress.percent) || 0)));
        var title = typeof auth.getGuideTitle === "function" ? auth.getGuideTitle(file) : file;
        var href = typeof auth.getGuideHref === "function" ? auth.getGuideHref(file) : "guia.html?g=" + encodeURIComponent(file);
        var st = estadoFor(percent);
        var pending = pendingActivitiesFor(file, key);
        return (
          '<article class="guide">' +
          '<div class="guide__top">' +
          '<div class="guide__num">' + esc(guideNumber(title, index)) + "</div>" +
          '<span class="estado ' + st.cls + '">' + st.label + "</span>" +
          "</div>" +
          '<h4 class="guide__title">' + esc(title) + "</h4>" +
          '<div class="guide__pbar"><div class="guide__pfill" style="width:' + percent + '%"></div></div>' +
          '<div class="guide__pmeta"><span>Avance</span><span>' + percent + "%</span></div>" +
          deadlineBadge(file) +
          pendingListHtml(pending) +
          '<a class="guide__btn' + (st.secondary ? " sec" : "") + '" href="' + esc(href) + '">' + st.cta + " →</a>" +
          "</article>"
        );
      })
      .join("");

    renderCallouts(user, files);

    // Equipo nuevo: baja los estados de guia que falten y re-pinta una vez.
    // hydrateTriedFiles evita lecturas repetidas (y el re-render en bucle).
    hydrateMissingGuideStates(user, files).then(function (changed) {
      if (changed) renderStudent(session);
    }).catch(function () {});
  }

  // El restore de "cambio de equipo" (usuario + % de progreso) corre ~500ms
  // despues de cargar la pagina (firebase_db.js): cuando termina, el home ya
  // se pinto con los datos vacios. Re-render con los metas ya restaurados.
  document.addEventListener("portal-student-restored", function () {
    var session = typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    if (session && session.role === "student" && byId("student-guides")) {
      renderStudent(session);
    }
  });

  // ── Avisos arriba de "Mis guías" (firma sin enviar, actividades no
  //    aprobadas, etc.) ─────────────────────────────────────────────────────
  // A diferencia del resto de este archivo, la firma SI requiere una lectura
  // a Firestore: sena_portal_signature_auth no tiene cache local propio (ver
  // signature_authorization.js, que siempre llama cloudGetSignatureAuth).
  // Es una excepcion deliberada y acotada -- UNA sola lectura por visita al
  // home -- para poder avisar aunque el envio se haya hecho desde otro
  // dispositivo. Se ejecuta despues del render principal (no bloquea las
  // tarjetas de guias, que siguen siendo 100% locales).
  async function isSignaturePending(usernameKey) {
    var db = window._firebaseDb;
    if (!db || typeof db.cloudGetSignatureAuth !== "function") return false;
    try {
      var record = await db.cloudGetSignatureAuth(usernameKey);
      return !(record && record.status === "delivered");
    } catch (e) {
      return false; // si falla la lectura, mejor no mostrar un aviso incierto
    }
  }

  // Talleres de Refuerzo (ver js/reinforcement_workshops.js): documento de
  // refuerzo asignado por el instructor, NO ligado a una actividad real de
  // una guia -- por eso se avisa aqui (como la firma) en vez de en una guia
  // puntual. Misma excepcion deliberada y acotada que isSignaturePending: UNA
  // lectura a Firestore por visita al home, fail-soft si no hay lectura.
  async function hasPendingReinforcementWorkshops(usernameKey) {
    var db = window._firebaseDb;
    if (!db || typeof db.cloudGetReinforcementWorkshops !== "function") return false;
    try {
      var workshops = await db.cloudGetReinforcementWorkshops(usernameKey);
      return Array.isArray(workshops) && workshops.some(function (w) {
        return w && w.resultado !== "A" && w.resultado !== "D";
      });
    } catch (e) {
      return false; // si falla la lectura, mejor no mostrar un aviso incierto
    }
  }

  // Actividades marcadas "No aprobado" (D) por el instructor, en cualquiera
  // de las guias del aprendiz -- junto con el motivo, si el instructor eligio
  // uno (ver GRADE_REJECTION_REASONS en admin_usuarios.js). Lee SOLO el cache
  // local de activityGradesManager (mismo criterio que pendingActivitiesFor):
  // si el aprendiz nunca visito esa guia en este dispositivo, su cache de
  // notas sigue vacio y esa "D" no aparecera aqui hasta que la visite una vez.
  function rejectedActivitiesFor(files, usernameKey) {
    var mgr = window.activityGradesManager;
    if (!mgr || typeof mgr.getStudentGrades !== "function" || !mgr.GUIDE_FAMILY_BY_FILE || !mgr.GRADE_CATALOG) {
      return [];
    }
    var seenFamilies = {};
    var rejected = [];
    files.forEach(function (file) {
      var family = mgr.GUIDE_FAMILY_BY_FILE[file];
      if (!family || seenFamilies[family]) return;
      seenFamilies[family] = true;

      var catalogEntry = mgr.GRADE_CATALOG[family];
      var activities = catalogEntry && Array.isArray(catalogEntry.activities) ? catalogEntry.activities : [];
      if (!activities.length) return;

      var grades = mgr.getStudentGrades(usernameKey, family) || {};
      var href = typeof auth.getGuideHref === "function" ? auth.getGuideHref(file) : "guia.html?g=" + encodeURIComponent(file);
      activities.forEach(function (act) {
        if (grades[act.id] !== "D") return;
        rejected.push({
          text: (catalogEntry.label || family) + ": \"" + (act.label || act.id) + "\" no aprobada." +
            (grades[act.id + ":obs"] ? " " + grades[act.id + ":obs"] : ""),
          href: href,
          cta: "Ver guía",
        });
      });
    });
    return rejected;
  }

  // ── Etapa Productiva: documentos base (ficha de inscripción y acuerdo) ────
  // La entrega de estos documentos queda registrada SOLO en el localStorage del
  // navegador donde se hizo (shared_apps_script_delivery.js, clave
  // "etapa-productiva-estudiante:delivery:{segment}"). Igual que el resto del
  // home, el aviso es 100% local: una entrega hecha desde otro equipo no consta
  // aquí — por eso el CTA es "Revisar" y no exige volver a entregar.
  // Cada documento lleva dos segments: el panelKey estable actual
  // ("etapa-doc-{id}" saneado) y la clave histórica derivada del deliveryLabel
  // (entregas previas a jul-2026). La sincronía con
  // productive_stage_project_delivery.js la verifica
  // tests/productive_stage_docs_callout.test.cjs.
  var PRODUCTIVE_BASE_DOCS = [
    {
      label: "Ficha de inscripción",
      segments: ["etapa_doc_ficha_inscripcion", "Ficha_de_Inscripcion"],
    },
    {
      label: "Acuerdo de Etapa Productiva",
      segments: ["etapa_doc_acuerdo_etapa_productiva", "Acuerdo_de_Etapa_Productiva"],
    },
  ];

  function productiveDocDeliveredLocally(usernameKey, doc) {
    if (typeof auth.getStudentStorageKey !== "function") return true;
    return doc.segments.some(function (segment) {
      var key = auth.getStudentStorageKey(
        usernameKey,
        "etapa-productiva-estudiante:delivery:" + segment,
        { area: "guide-data" }
      );
      try {
        var record = JSON.parse(localStorage.getItem(key) || "null");
        return !!(record && record.status === "delivered");
      } catch (e) {
        return false;
      }
    });
  }

  function pendingProductiveDocsFor(usernameKey) {
    return PRODUCTIVE_BASE_DOCS.filter(function (doc) {
      return !productiveDocDeliveredLocally(usernameKey, doc);
    });
  }

  function calloutsBox() {
    return byId("student-callouts");
  }

  async function renderCallouts(user, files) {
    var box = calloutsBox();
    if (!box) return;
    var key = user.usernameKey || user.username;
    var items = [];

    if (await isSignaturePending(key)) {
      items.push({
        text: "Autorización de firma sin enviar.",
        href: "pages/auxiliares/autorizacion-firma.html",
        cta: "Enviar",
      });
    }

    if (await hasPendingReinforcementWorkshops(key)) {
      items.push({
        text: "Tienes un Taller de Refuerzo asignado.",
        href: "pages/auxiliares/talleres-refuerzo.html",
        cta: "Ver",
      });
    }

    pendingProductiveDocsFor(key).forEach(function (doc) {
      items.push({
        text: 'Etapa Productiva: falta entregar "' + doc.label + '".',
        href: "etapa-productiva-estudiante.html",
        cta: "Revisar",
      });
    });

    items = items.concat(rejectedActivitiesFor(files || [], key));

    if (!items.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = items
      .map(function (item) {
        return (
          '<div class="callout">' +
          '<span class="callout__icon">⚠️</span>' +
          '<span class="callout__text">' + esc(item.text) + "</span>" +
          '<a class="callout__link" href="' + esc(item.href) + '">' + esc(item.cta) + " →</a>" +
          "</div>"
        );
      })
      .join("");
  }

  // ── Render principal según sesión ─────────────────────────────────────────
  function render() {
    var session = typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    document.body.classList.toggle("is-admin-session", !!(session && session.role === "admin"));

    if (!session) {
      showView("home-guest");
      return;
    }
    if (session.role === "admin") {
      showView("home-admin");
      return;
    }
    showView("home-student");
    renderStudent(session);
  }

  // ── Handlers de formularios ───────────────────────────────────────────────
  async function onLogin(event) {
    event.preventDefault();
    var result = await auth.loginStudent({
      username: byId("login-user") ? byId("login-user").value : "",
      password: byId("login-pass") ? byId("login-pass").value : "",
    });
    if (!result.ok) {
      setFeedback("login-feedback", result.message, "error");
      return;
    }
    var user = result.user || {};
    auth.setFlashMessage(
      "¡Hola, " + firstName(user) + "! Ingresaste correctamente.",
      "success"
    );
    window.location.reload();
  }

  async function onRegister(event) {
    event.preventDefault();
    var result = await auth.registerStudent({
      fullName: byId("reg-name") ? byId("reg-name").value : "",
      username: byId("reg-user") ? byId("reg-user").value : "",
      ficha: byId("reg-ficha") ? byId("reg-ficha").value : "",
      password: byId("reg-pass") ? byId("reg-pass").value : "",
    });
    if (!result.ok) {
      setFeedback("register-feedback", result.message, "error");
      return;
    }
    auth.setFlashMessage("Usuario creado correctamente. Tu avance se guarda en este equipo y en la nube.", "success");
    window.location.reload();
  }

  async function onAdmin(event) {
    event.preventDefault();
    var result = await auth.loginAdmin((byId("admin-pass") ? byId("admin-pass").value : "") || "");
    if (!result.ok) {
      setFeedback("admin-feedback", result.message, "error");
      return;
    }
    auth.setFlashMessage("Acceso administrativo activado.", "success");
    window.location.reload();
  }

  async function onLogout() {
    await auth.logout();
    window.location.reload();
  }

  // ── Selector de guías para el admin (Panel de gestión) ───────────────────
  // El admin no tiene "Mis guías" (no pertenece a una ficha). Ofrecemos un
  // acceso desde el panel: un modal que CLONA la lista ya construida del navbar
  // (fuente única en shared_shell.js), agrupada por institución. Los enlaces ya
  // apuntan a guia.html?g=… así que funcionan tal cual.
  function openGuidePicker() {
    var modal = byId("guide-picker");
    var body = byId("guide-picker-body");
    if (!modal || !body) return;
    var src = document.querySelector('.app-navbar__drop[data-nav-key="guias"] .app-navbar__drop-panel');
    if (src && src.children.length) {
      body.innerHTML = src.innerHTML;
    } else {
      body.innerHTML = '<p class="guide-picker__empty">No se pudo cargar la lista de guías. Usa el menú <strong>Guías</strong> de la barra superior.</p>';
    }
    modal.hidden = false;
    document.body.classList.add("guide-picker-open");
    var firstLink = body.querySelector("a");
    if (firstLink) { try { firstLink.focus(); } catch (e) {} }
  }

  function closeGuidePicker() {
    var modal = byId("guide-picker");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("guide-picker-open");
  }

  function bindGuidePicker() {
    document.querySelectorAll("[data-open-guide-picker]").forEach(function (btn) {
      btn.addEventListener("click", openGuidePicker);
    });
    document.querySelectorAll("[data-guide-picker-close]").forEach(function (el) {
      el.addEventListener("click", closeGuidePicker);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var modal = byId("guide-picker");
      if (modal && !modal.hidden) closeGuidePicker();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bindAuthTabs();
    bindGuidePicker();
    var loginForm = byId("login-form");
    var registerForm = byId("register-form");
    var adminForm = byId("admin-form");
    if (loginForm) loginForm.addEventListener("submit", onLogin);
    if (registerForm) registerForm.addEventListener("submit", onRegister);
    if (adminForm) adminForm.addEventListener("submit", onAdmin);
    document.querySelectorAll("[data-logout]").forEach(function (button) {
      button.addEventListener("click", onLogout);
    });
    consumeFlash();
    render();
  });

  window.refreshPortalHome = render;
})();
