// js/shared_shell.js
(function () {
  // ─────────────────────────────────────────────
  //  Page detection
  // ─────────────────────────────────────────────
  function getCurrentPageKey() {
    var path = window.location.pathname.toLowerCase();
    if (path.includes("calendario")) return "calendario";
    if (path.includes("panel-administrativo")) return "panel";
    if (path.includes("etapa-productiva")) return "etapa";
    if (
      path.includes("guia") ||
      path.includes("induccion") ||
      path.includes("plantilla") ||
      path.includes("formulario")
    ) return "guias";
    return "portal";
  }

  // ─────────────────────────────────────────────
  //  Root prefix (handles pages in subdirectories)
  // ─────────────────────────────────────────────
  function getNavRootPrefix() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/auxiliares/") !== -1) return "../../";
    if (path.indexOf("/pages/") !== -1) return "../";
    // file:// protocol: count depth from HTML root folder
    if (window.location.protocol === "file:") {
      var parts = path.replace(/\\/g, "/").split("/");
      // Remove filename
      parts.pop();
      // Count how many folders deep we are after the root HTML folder
      // by checking for known subfolder names
      if (parts.indexOf("auxiliares") !== -1) return "../../";
      if (parts.indexOf("pages") !== -1) return "../";
    }
    return "";
  }

  // ─────────────────────────────────────────────
  //  Build navbar HTML
  // ─────────────────────────────────────────────
  function buildNavbarHtml() {
    var p = getNavRootPrefix();
    return [
      '<nav class="app-navbar" id="app-navbar" aria-label="Navegación principal">',
      '  <div class="app-navbar__inner">',

      // Logo
      '    <a class="app-navbar__logo" href="' + p + 'index.html">',
      '      <img class="app-navbar__logo-img" src="' + p + 'assets/img/sena-logo.png" alt="SENA" aria-hidden="true">',
      '      <span>SENA <strong>Teleinformáticos</strong></span>',
      '    </a>',

      // Links
      '    <div class="app-navbar__links" id="app-navbar-links">',

      // Portal
      '      <a class="app-navbar__link" href="' + p + 'index.html" data-nav-key="portal">Portal</a>',

      // Guías dropdown
      '      <div class="app-navbar__drop" data-nav-key="guias">',
      '        <button class="app-navbar__link app-navbar__drop-btn" type="button" aria-expanded="false" aria-haspopup="true">',
      '          Guías <span class="app-navbar__caret" aria-hidden="true">▾</span>',
      '        </button>',
      '        <div class="app-navbar__drop-panel" role="menu">',
      '          <div class="app-navbar__drop-group" data-guide-group>',
      '            <span class="app-navbar__drop-heading">Grado 10</span>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-10a-guia-01-induccion.html" role="menuitem" data-guide-file="grupo-10a-guia-01-induccion.html">10A · Guía 1 — Inducción</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-10a-guia-02-herramientas-informaticas-digitales.html" role="menuitem" data-guide-file="grupo-10a-guia-02-herramientas-informaticas-digitales.html">10A · Guía 2 — Herramientas</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'santa-barbara-10a-guia-02-redes-rap01.html" role="menuitem" data-guide-file="santa-barbara-10a-guia-02-redes-rap01.html">10A · Guía 2 — Redes</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-10b-guia-01-induccion.html" role="menuitem" data-guide-file="grupo-10b-guia-01-induccion.html">10B · Guía 1 — Inducción</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-10b-guia-02-herramientas-informaticas-digitales.html" role="menuitem" data-guide-file="grupo-10b-guia-02-herramientas-informaticas-digitales.html">10B · Guía 2 — Herramientas</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'santa-barbara-10b-guia-02-redes-rap01.html" role="menuitem" data-guide-file="santa-barbara-10b-guia-02-redes-rap01.html">10B · Guía 2 — Redes</a>',
      '          </div>',
      '          <div class="app-navbar__drop-group" data-guide-group>',
      '            <span class="app-navbar__drop-heading">Grado 11</span>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-11a-guia-05-herramientas-informaticas-digitales.html" role="menuitem" data-guide-file="grupo-11a-guia-05-herramientas-informaticas-digitales.html">11A · Guía 5 — Herramientas</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-11a-guia-06-planificar-informacion.html" role="menuitem" data-guide-file="grupo-11a-guia-06-planificar-informacion.html">11A · Guía 6 — Planificar</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-11b-guia-05-herramientas-informaticas-digitales.html" role="menuitem" data-guide-file="grupo-11b-guia-05-herramientas-informaticas-digitales.html">11B · Guía 5 — Herramientas</a>',
      '            <a class="app-navbar__drop-link" href="' + p + 'grupo-11b-guia-06-planificar-informacion.html" role="menuitem" data-guide-file="grupo-11b-guia-06-planificar-informacion.html">11B · Guía 6 — Planificar</a>',
      '          </div>',
      '        </div>',
      '      </div>',

      // Calendario (admin only — shown by updateNavbarSession)
      '      <a class="app-navbar__link app-navbar__admin-only" href="' + p + 'calendario-academico-2026.html" data-nav-key="calendario" style="display:none">Calendario</a>',

      // Etapa Productiva dropdown
      '      <div class="app-navbar__drop" data-nav-key="etapa">',
      '        <button class="app-navbar__link app-navbar__drop-btn" type="button" aria-expanded="false" aria-haspopup="true">',
      '          Etapa Productiva <span class="app-navbar__caret" aria-hidden="true">▾</span>',
      '        </button>',
      '        <div class="app-navbar__drop-panel" role="menu">',
      '          <a class="app-navbar__drop-link app-navbar__admin-only" href="' + p + 'etapa-productiva-admin.html" role="menuitem" style="display:none">Panel del instructor</a>',
      '          <a class="app-navbar__drop-link" href="' + p + 'etapa-productiva-estudiante.html" role="menuitem">Mi proyecto</a>',
      '        </div>',
      '      </div>',

      // Panel Admin (admin only)
      '      <a class="app-navbar__link app-navbar__admin-only" href="' + p + 'panel-administrativo-usuarios.html" data-nav-key="panel" style="display:none">Panel Admin</a>',

      '    </div>',

      // Right end: user chip + hamburger
      '    <div class="app-navbar__end">',
      '      <div class="app-navbar__user" id="app-navbar-user" style="display:none">',
      '        <span class="app-navbar__user-role" id="app-navbar-role"></span>',
      '        <span id="app-navbar-username"></span>',
      '      </div>',
      '      <button class="app-navbar__hamburger" id="app-navbar-hamburger" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="app-navbar-links">',
      '        <span></span><span></span><span></span>',
      '      </button>',
      '    </div>',

      '  </div>',
      '</nav>',
    ].join("\n");
  }

  // ─────────────────────────────────────────────
  //  Inject navbar as first child of body
  // ─────────────────────────────────────────────
  function injectNavbar() {
    if (document.getElementById("app-navbar")) return;
    var wrapper = document.createElement("div");
    wrapper.innerHTML = buildNavbarHtml();
    var nav = wrapper.firstElementChild;
    document.body.insertBefore(nav, document.body.firstChild);
    setActiveNavLink();
  }

  // ─────────────────────────────────────────────
  //  Highlight current page link
  // ─────────────────────────────────────────────
  function setActiveNavLink() {
    var key = getCurrentPageKey();
    var nav = document.getElementById("app-navbar");
    if (!nav) return;

    // Direct links
    nav.querySelectorAll(".app-navbar__link[data-nav-key]").forEach(function (el) {
      if (el.getAttribute("data-nav-key") === key) {
        el.classList.add("is-active");
      }
    });

    // Dropdown wrappers
    nav.querySelectorAll(".app-navbar__drop[data-nav-key]").forEach(function (drop) {
      if (drop.getAttribute("data-nav-key") === key) {
        var btn = drop.querySelector(".app-navbar__drop-btn");
        if (btn) btn.classList.add("is-active");
      }
    });
  }

  // ─────────────────────────────────────────────
  //  Show session info + admin-only links
  // ─────────────────────────────────────────────
  function updateNavbarSession() {
    var auth = window.portalAuth || null;
    if (!auth) return;

    var session = null;
    try { session = auth.getCurrentSession(); } catch (e) { return; }
    if (!session) return;

    var isAdmin = session.role === "admin";
    var userEl = document.getElementById("app-navbar-user");
    var roleEl = document.getElementById("app-navbar-role");
    var usernameEl = document.getElementById("app-navbar-username");

    if (userEl && roleEl && usernameEl) {
      var displayName = isAdmin
        ? (session.user && session.user.username ? session.user.username : "Admin")
        : (session.user && (session.user.fullName || session.user.username) || "Aprendiz");

      if (displayName.length > 20) displayName = displayName.split(" ")[0];

      roleEl.textContent = isAdmin ? "Admin" : "Aprendiz";
      roleEl.className = "app-navbar__user-role" + (isAdmin ? " app-navbar__user-role--admin" : "");
      usernameEl.textContent = displayName;
      userEl.style.display = "";
    }

    if (isAdmin) {
      document.querySelectorAll(".app-navbar__admin-only").forEach(function (el) {
        el.style.display = "";
      });
    } else {
      // Estudiante: mostrar solo las guías de su ficha
      var studentGuides = [];
      try {
        studentGuides = auth.getGuidesForFicha(session.user && session.user.ficha) || [];
      } catch (e) {}

      document.querySelectorAll(".app-navbar__drop-link[data-guide-file]").forEach(function (link) {
        var file = link.getAttribute("data-guide-file");
        link.style.display = studentGuides.includes(file) ? "" : "none";
      });

      // Ocultar el encabezado del grupo si no tiene guías visibles
      document.querySelectorAll("[data-guide-group]").forEach(function (group) {
        var visibleLinks = Array.from(
          group.querySelectorAll(".app-navbar__drop-link[data-guide-file]")
        ).filter(function (l) { return l.style.display !== "none"; });
        var heading = group.querySelector(".app-navbar__drop-heading");
        if (heading) heading.style.display = visibleLinks.length ? "" : "none";
      });
    }
  }

  // ─────────────────────────────────────────────
  //  Dropdown & hamburger interactions
  // ─────────────────────────────────────────────
  function attachNavbarInteractions() {
    var nav = document.getElementById("app-navbar");
    if (!nav) return;

    var hamburger = document.getElementById("app-navbar-hamburger");
    var linksMenu = document.getElementById("app-navbar-links");

    // Hamburger toggle (mobile)
    if (hamburger && linksMenu) {
      hamburger.addEventListener("click", function () {
        var isOpen = linksMenu.classList.toggle("is-open");
        hamburger.classList.toggle("is-open", isOpen);
        hamburger.setAttribute("aria-expanded", String(isOpen));
        hamburger.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
      });
    }

    var drops = nav.querySelectorAll(".app-navbar__drop");

    // Click toggle for dropdowns
    drops.forEach(function (drop) {
      var btn = drop.querySelector(".app-navbar__drop-btn");
      if (!btn) return;

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = drop.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", String(isOpen));

        // Close siblings
        drops.forEach(function (other) {
          if (other !== drop) {
            other.classList.remove("is-open");
            var otherBtn = other.querySelector(".app-navbar__drop-btn");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
          }
        });
      });
    });

    // Close on outside click
    document.addEventListener("click", function () {
      drops.forEach(function (drop) {
        drop.classList.remove("is-open");
        var btn = drop.querySelector(".app-navbar__drop-btn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    });

    // Desktop: hover open/close with short delay
    drops.forEach(function (drop) {
      var leaveTimer = null;

      drop.addEventListener("mouseenter", function () {
        if (window.innerWidth <= 768) return;
        clearTimeout(leaveTimer);
        drop.classList.add("is-open");
        var btn = drop.querySelector(".app-navbar__drop-btn");
        if (btn) btn.setAttribute("aria-expanded", "true");
      });

      drop.addEventListener("mouseleave", function () {
        if (window.innerWidth <= 768) return;
        leaveTimer = setTimeout(function () {
          drop.classList.remove("is-open");
          var btn = drop.querySelector(".app-navbar__drop-btn");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }, 120);
      });
    });
  }

  // ─────────────────────────────────────────────
  //  Reveal motion
  // ─────────────────────────────────────────────
  function markShellReady() {
    document.documentElement.classList.add("shell-ready");
  }

  function attachRevealMotion() {
    document.querySelectorAll("[data-reveal]").forEach(function (element, index) {
      element.style.setProperty("--reveal-index", String(index));
      element.classList.add("is-visible");
    });
  }

  // ─────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    injectNavbar();
    markShellReady();
    attachRevealMotion();
    updateNavbarSession();
    attachNavbarInteractions();
  });
})();
