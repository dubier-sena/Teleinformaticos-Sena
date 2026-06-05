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
          '<a class="guide__btn' + (st.secondary ? " sec" : "") + '" href="' + esc(href) + '">' + st.cta + " →</a>" +
          "</article>"
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

  document.addEventListener("DOMContentLoaded", function () {
    bindAuthTabs();
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
