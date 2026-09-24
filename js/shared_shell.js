// js/shared_shell.js
(function () {
  // ─────────────────────────────────────────────
  //  Page detection
  // ─────────────────────────────────────────────
  function getCurrentPageKey() {
    var path = window.location.pathname.toLowerCase();
    if (path.includes("calendario")) return "calendario";
    if (path.includes("autorizacion-firma")) return "firma";
    if (path.includes("panel-administrativo")) return "panel";
    if (path.includes("etapa-productiva")) return "etapa";
    if (path.includes("laboratorio-virtual-hardware")) return "laboratorio";
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
    // Si la pagina define <base href> (p. ej. pages/auxiliares/*.html con
    // <base href="../../">), las rutas relativas YA se resuelven desde esa base
    // (la raiz del proyecto), asi que NO se debe anteponer prefijo: hacerlo
    // duplica el salto y rompe los enlaces del navbar (404 al dominio raiz).
    if (typeof document !== "undefined" && document.querySelector("base[href]")) {
      return "";
    }
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
  //  Menu "Guias": capa de PRESENTACION sobre FICHA_MAP
  // ─────────────────────────────────────────────
  // FICHA_MAP (portal_auth.js) es la UNICA fuente de verdad de que guias tiene
  // cada ficha, sus archivos, institucion y grupo; las URLs salen de
  // getGuideHref(). Aqui solo hay metadatos de presentacion (orden de los
  // grupos, etiqueta corta de institucion, nombre corto de cada tema y guias que
  // van al final). Una guia registrada en FICHA_MAP aparece en el menu sin tocar
  // este archivo; si no tiene nombre corto se usa su titulo oficial.

  // Orden visual de los grupos del instructor. Una ficha que exista en
  // FICHA_MAP y no este aqui se agrega al final (nunca se pierde).
  var NAV_GROUP_ORDER = ["3441939", "3441942", "3441944", "3441950", "3168850", "3168852"];

  var NAV_INSTITUTIONS = [
    { pattern: /kennedy/i, label: "Kennedy", slug: "kennedy" },
    { pattern: /santa\s*b[aá]rbara/i, label: "Santa Bárbara", slug: "santa-barbara" },
  ];

  // Orden visual: se respeta el orden de FICHA_MAP salvo estas guias, que van al
  // final del menu (orden ya publicado). NO reordena FICHA_MAP: la portada, la
  // "Guia asignada" y el panel admin siguen usando su propio orden.
  var NAV_GUIDES_LAST = ["santa-barbara-guia-python.html"];

  // Nombre corto por tema (patron del archivo). Solo texto del menu: los titulos
  // academicos (GUIDE_TITLES) no cambian. "$1" toma el grupo capturado.
  var NAV_GUIDE_SHORT_NAMES = [
    { pattern: /-induccion\.html$/, name: "Inducción" },
    { pattern: /-herramientas-informaticas-digitales\.html$/, name: "Herramientas" },
    { pattern: /^grupo-10[ab]-guia-03-planificar-informacion\.html$/, name: "Planificar" },
    { pattern: /^grupo-11[ab]-guia-06-planificar-informacion\.html$/, name: "Implementar componentes" },
    { pattern: /-planificar-informacion-ciberseguridad\.html$/, name: "Ciberseguridad" },
    { pattern: /-documentar-gestion-informacion\.html$/, name: "Documentar la gestión" },
    { pattern: /-mantener-equipos\.html$/, name: "Mantener equipos" },
    { pattern: /-redes-rap(\d+)\.html$/, name: "Redes RAP$1" },
    { pattern: /-taller-integrador\.html$/, name: "Taller Integrador", standalone: true },
    { pattern: /-guia-python\.html$/, name: "Práctica de Python", standalone: true },
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getGuideMenuLabel(auth, fileName) {
    var title = "";
    try { title = String(auth.getGuideTitle(fileName) || ""); } catch (e) {}
    var numberMatch = title.match(/^Gu[ií]a\s+(\d+)/i);
    for (var i = 0; i < NAV_GUIDE_SHORT_NAMES.length; i++) {
      var rule = NAV_GUIDE_SHORT_NAMES[i];
      var match = fileName.match(rule.pattern);
      if (!match) continue;
      var name = rule.name.replace(/\$(\d)/g, function (_, n) { return match[Number(n)] || ""; });
      if (rule.standalone || !numberMatch) return name;
      return "Guía " + numberMatch[1] + " — " + name;
    }
    // Fallback seguro: el titulo oficial sin el sufijo "| Grupo X".
    var official = title.replace(/\s*\|\s*[^|]*$/, "").replace(/\s+-\s+/, " — ").trim();
    return official && official !== fileName ? official : fileName;
  }

  function orderGuidesForMenu(files) {
    var seen = {};
    var unique = (files || []).filter(function (file) {
      if (!file || seen[file]) return false;
      seen[file] = true;
      return true;
    });
    var head = unique.filter(function (file) { return NAV_GUIDES_LAST.indexOf(file) === -1; });
    var tail = NAV_GUIDES_LAST.filter(function (file) { return seen[file]; });
    return head.concat(tail);
  }

  function describeGuideGroup(auth, ficha) {
    var info = auth.getFichaInfo(ficha);
    if (!info) return null;
    var inst = null;
    for (var i = 0; i < NAV_INSTITUTIONS.length; i++) {
      if (NAV_INSTITUTIONS[i].pattern.test(info.inst || "")) { inst = NAV_INSTITUTIONS[i]; break; }
    }
    var grupo = String(info.grupo || "").trim();
    var grade = (grupo.match(/\d{1,2}/) || [""])[0];
    var slug = ((inst ? inst.slug : "ficha") + "-" + (grupo || ficha)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    return {
      ficha: String(ficha),
      instLabel: inst ? inst.label : String(info.inst || "Ficha " + ficha),
      grade: grade,
      grupo: grupo,
      slug: slug,
      files: orderGuidesForMenu(auth.getGuidesForFicha(ficha)),
    };
  }

  function getGuideMenuGroups(auth) {
    var map = (auth && auth.FICHA_MAP) || {};
    var fichas = NAV_GROUP_ORDER.filter(function (f) { return map[f]; })
      .concat(Object.keys(map).filter(function (f) { return NAV_GROUP_ORDER.indexOf(f) === -1; }));
    return fichas.map(function (f) { return describeGuideGroup(auth, f); }).filter(Boolean);
  }

  // Archivo de la guia abierta (guia.html?g=… o pages/guias/<archivo>.html).
  function getCurrentGuideFile() {
    try {
      var g = new URLSearchParams(window.location.search || "").get("g");
      if (g) return g;
    } catch (e) {}
    var last = String(window.location.pathname || "").split("/").pop();
    return /\.html$/i.test(last) ? decodeURIComponent(last) : "";
  }

  function renderGuideList(auth, p, files, currentFile) {
    return '<ul class="app-navbar__guide-list">' + files.map(function (file) {
      var current = currentFile && file === currentFile ? ' aria-current="page"' : "";
      return '<li><a class="app-navbar__drop-link" href="' + escapeHtml(p + auth.getGuideHref(file)) + '"' +
        ' data-guide-file="' + escapeHtml(file) + '"' + current + ">" +
        escapeHtml(getGuideMenuLabel(auth, file)) + "</a></li>";
    }).join("") + "</ul>";
  }

  // Contenido del menu segun la sesion. Solo genera lo que corresponde: un
  // aprendiz NUNCA recibe en el DOM grupos de otras fichas (antes se ocultaban y
  // sus bordes quedaban como lineas sueltas).
  function buildGuidesMenuHtml(auth, session, idPrefix) {
    var p = getNavRootPrefix();
    if (!auth || !session) {
      return '<p class="app-navbar__guide-empty"><a href="' + p + 'index.html">Inicia sesión</a> para ver tus guías.</p>';
    }
    var currentFile = getCurrentGuideFile();

    if (session.role !== "admin") {
      var group = describeGuideGroup(auth, session.user && session.user.ficha);
      if (!group || !group.files.length) {
        return '<p class="app-navbar__guide-empty">No hay guías asignadas a tu ficha.</p>';
      }
      var headingId = idPrefix + "-heading";
      return '<section class="app-navbar__guide-student" aria-labelledby="' + headingId + '" data-guide-ficha="' + escapeHtml(group.ficha) + '">' +
        '<p class="app-navbar__drop-heading" id="' + headingId + '">' +
        escapeHtml(group.instLabel + " · Grado " + group.grade + " · " + group.grupo) + "</p>" +
        renderGuideList(auth, p, group.files, currentFile) +
        "</section>";
    }

    var groups = getGuideMenuGroups(auth);
    // Grupo abierto por defecto (y aria-current) SOLO si la guia actual pertenece
    // a una unica ficha; Induccion o Python (varias fichas) no eligen ninguna.
    var owners = groups.filter(function (g) { return currentFile && g.files.indexOf(currentFile) !== -1; });
    var openFicha = owners.length === 1 ? owners[0].ficha : "";
    return '<div class="app-navbar__guide-groups">' + groups.map(function (g) {
      var panelId = idPrefix + "-" + g.slug;
      var isOpen = g.ficha === openFicha;
      return '<div class="app-navbar__guide-group" data-guide-ficha="' + escapeHtml(g.ficha) + '">' +
        '<button class="app-navbar__guide-group-btn" type="button" aria-expanded="' + isOpen + '" aria-controls="' + panelId + '" data-guide-group-toggle>' +
        "<span>" + escapeHtml(g.instLabel + " · " + g.grupo) + '</span><span class="app-navbar__caret" aria-hidden="true">▾</span>' +
        "</button>" +
        '<div class="app-navbar__guide-group-panel" id="' + panelId + '"' + (isOpen ? "" : " hidden") + ">" +
        renderGuideList(auth, p, g.files, isOpen ? currentFile : "") +
        "</div></div>";
    }).join("") + "</div>";
  }

  // Acordeon del instructor: un solo grupo abierto a la vez (abrir 11B cierra 11A).
  function bindGuideAccordion(container) {
    var groups = container.querySelectorAll(".app-navbar__guide-group");
    groups.forEach(function (group) {
      var btn = group.querySelector("[data-guide-group-toggle]");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var willOpen = btn.getAttribute("aria-expanded") !== "true";
        groups.forEach(function (other) {
          var otherBtn = other.querySelector("[data-guide-group-toggle]");
          var otherPanel = other.querySelector(".app-navbar__guide-group-panel");
          var open = willOpen && other === group;
          if (otherBtn) otherBtn.setAttribute("aria-expanded", String(open));
          if (otherPanel) otherPanel.hidden = !open;
        });
      });
    });
  }

  function renderGuidesMenu(container, idPrefix) {
    if (!container) return false;
    var auth = window.portalAuth || null;
    var session = null;
    try { session = auth ? auth.getCurrentSession() : null; } catch (e) { session = null; }
    container.innerHTML = buildGuidesMenuHtml(auth, session, idPrefix || "app-navbar-guias");
    bindGuideAccordion(container);
    return true;
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

      // Identidad dentro del menu: solo se ve en modo compacto/movil, donde el
      // chip de la barra se oculta. Texto, no interactivo (fuera del orden de Tab).
      '      <p class="app-navbar__menu-user" id="app-navbar-menu-user" hidden>',
      '        <span class="app-navbar__user-role" id="app-navbar-menu-role"></span>',
      '        <span class="app-navbar__menu-user-name" id="app-navbar-menu-username"></span>',
      '      </p>',

      // Portal
      '      <a class="app-navbar__link" href="' + p + 'index.html" data-nav-key="portal">Portal</a>',

      // Guías dropdown. El contenido NO se escribe aqui: renderGuidesMenu() lo
      // genera desde FICHA_MAP (portal_auth.js) segun la sesion -- un solo bloque
      // para el aprendiz, acordeon por ficha para el instructor.
      '      <div class="app-navbar__drop" data-nav-key="guias">',
      '        <button class="app-navbar__link app-navbar__drop-btn" type="button" aria-expanded="false" aria-controls="app-navbar-guias-panel">',
      '          Guías <span class="app-navbar__caret" aria-hidden="true">▾</span>',
      '        </button>',
      '        <div class="app-navbar__drop-panel app-navbar__drop-panel--guides" id="app-navbar-guias-panel" data-guides-panel></div>',
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

      // Laboratorio Virtual de Hardware. TEMPORAL: solo admin (pedido
      // 2026-08-16, mientras se revisa el modulo antes de abrirlo a
      // aprendices) -- misma clase/oculto que "Calendario" y "Panel Admin",
      // updateNavbarSession() lo revela para sesion admin.
      '      <a class="app-navbar__link app-navbar__admin-only" href="' + p + 'laboratorio-virtual-hardware.html" data-nav-key="laboratorio" style="display:none">Laboratorio Virtual</a>',

      // Autorizacion de uso de firma (cualquier sesion; no depende de ficha/guia)
      '      <a class="app-navbar__link" href="' + p + 'pages/auxiliares/autorizacion-firma.html" data-nav-key="firma">Autorización de firma</a>',

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
    renderGuidesMenu(document.querySelector("[data-guides-panel]"), "app-navbar-guias");

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

      // La misma identidad del chip, dentro del menu compacto.
      var menuUser = document.getElementById("app-navbar-menu-user");
      var menuRole = document.getElementById("app-navbar-menu-role");
      var menuName = document.getElementById("app-navbar-menu-username");
      if (menuUser && menuRole && menuName) {
        menuRole.textContent = roleEl.textContent;
        menuRole.className = roleEl.className;
        menuName.textContent = displayName;
        menuUser.hidden = false;
      }
    }

    if (isAdmin) {
      document.querySelectorAll(".app-navbar__admin-only").forEach(function (el) {
        el.style.display = "";
      });
    }

    // Rol, enlaces o nombre pueden haber cambiado el ancho de la barra.
    scheduleNavbarMeasurement();
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

    // Desplegables del navbar (Guías, Etapa Productiva...): el CLIC es la unica
    // forma de abrir/cerrar, en cualquier ancho de pantalla. Antes un
    // mouseenter abria el panel y el clic siguiente lo cerraba (toggle), y en
    // tablets tactiles el toque disparaba ambos a la vez.
    var drops = nav.querySelectorAll(".app-navbar__drop");

    function setDropOpen(drop, open) {
      drop.classList.toggle("is-open", open);
      var btn = drop.querySelector(".app-navbar__drop-btn");
      if (btn) btn.setAttribute("aria-expanded", String(open));
    }

    drops.forEach(function (drop) {
      var btn = drop.querySelector(".app-navbar__drop-btn");
      if (!btn) return;

      btn.addEventListener("click", function () {
        var willOpen = !drop.classList.contains("is-open");
        drops.forEach(function (other) {
          if (other !== drop) setDropOpen(other, false);
        });
        setDropOpen(drop, willOpen);
      });

      // Tab fuera del desplegable lo cierra. Un clic dentro sobre algo no
      // enfocable deja relatedTarget en null y NO debe cerrarlo.
      drop.addEventListener("focusout", function (e) {
        var next = e.relatedTarget;
        if (next && !drop.contains(next)) setDropOpen(drop, false);
      });
    });

    // Clic fuera cierra; un clic dentro del panel (encabezado, grupo del
    // acordeon) no.
    document.addEventListener("click", function (e) {
      drops.forEach(function (drop) {
        if (!drop.contains(e.target)) setDropOpen(drop, false);
      });
    });

    // Escape cierra y devuelve el foco al boton que lo abrio.
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" && e.key !== "Esc") return;
      drops.forEach(function (drop) {
        if (!drop.classList.contains("is-open")) return;
        setDropOpen(drop, false);
        var btn = drop.querySelector(".app-navbar__drop-btn");
        if (btn) btn.focus();
      });
    });
  }

  // ─────────────────────────────────────────────
  //  Modo compacto segun el contenido
  // ─────────────────────────────────────────────
  // La barra de escritorio es una fila rigida (el logo y el chip no encogen y los
  // enlaces no parten linea): con la sesion de instructor necesita ~1240px y hasta
  // ahora, entre 769px y ese ancho, "Panel Admin" y el chip quedaban fuera de la
  // pantalla. Cuando el contenido no cabe se activa .app-navbar--compact, que
  // aplica el mismo diseno del movil (reglas espejo del bloque <=768px en
  // shared_shell.css; ese bloque sigue siendo la garantia si este JS falla).
  // Se mide SIEMPRE el ancho del estado escritorio -- quitando la clase un
  // instante dentro de la misma tarea, sin llegar a pintar --, asi que la
  // decision no depende del estado actual y no puede oscilar.
  var NAVBAR_COMPACT_CLASS = "app-navbar--compact";
  var NAVBAR_MOBILE_QUERY = "(max-width: 768px)";
  // Margen para salir del modo compacto: absorbe redondeos subpixel (<1px)
  // entre mediciones; la decision ya es estable porque siempre se mide el
  // estado escritorio.
  var NAVBAR_COMPACT_HYSTERESIS = 4;
  var navbarMeasureFrame = 0;
  var navbarCompactReady = false;

  function measureDesktopNavbarWidth(nav) {
    var inner = nav.querySelector(".app-navbar__inner");
    var logo = nav.querySelector(".app-navbar__logo");
    var links = document.getElementById("app-navbar-links");
    var end = nav.querySelector(".app-navbar__end");
    if (!inner || !logo || !links || !end || typeof logo.getBoundingClientRect !== "function") return null;
    var wasCompact = nav.classList.contains(NAVBAR_COMPACT_CLASS);
    if (wasCompact) nav.classList.remove(NAVBAR_COMPACT_CLASS);
    var required = logo.getBoundingClientRect().width + end.getBoundingClientRect().width;
    Array.prototype.forEach.call(links.children, function (child) {
      required += child.getBoundingClientRect().width;
    });
    var available = inner.clientWidth;
    if (wasCompact) nav.classList.add(NAVBAR_COMPACT_CLASS);
    return { required: required, available: available };
  }

  function setNavbarCompact(nav, compact) {
    if (nav.classList.contains(NAVBAR_COMPACT_CLASS) === compact) return;
    nav.classList.toggle(NAVBAR_COMPACT_CLASS, compact);
    if (compact) return;
    // De vuelta al escritorio: el menu desplegable del modo compacto se cierra.
    var links = document.getElementById("app-navbar-links");
    var hamburger = document.getElementById("app-navbar-hamburger");
    if (links) links.classList.remove("is-open");
    if (hamburger) {
      hamburger.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "Abrir menú");
    }
  }

  function updateNavbarCompactState() {
    navbarMeasureFrame = 0;
    var nav = document.getElementById("app-navbar");
    if (!nav) return;
    if (typeof window.matchMedia === "function" && window.matchMedia(NAVBAR_MOBILE_QUERY).matches) {
      setNavbarCompact(nav, true);
      return;
    }
    var m = measureDesktopNavbarWidth(nav);
    if (!m || !(m.available > 0)) return;
    var compact = nav.classList.contains(NAVBAR_COMPACT_CLASS)
      ? m.available < m.required + NAVBAR_COMPACT_HYSTERESIS
      : m.required > m.available;
    setNavbarCompact(nav, compact);
  }

  // Un solo calculo por frame, aunque lleguen muchos avisos (resize continuo).
  function scheduleNavbarMeasurement() {
    if (!navbarCompactReady || navbarMeasureFrame) return;
    navbarMeasureFrame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(updateNavbarCompactState)
      : window.setTimeout(updateNavbarCompactState, 16);
  }

  function setupNavbarCompactMode() {
    var nav = document.getElementById("app-navbar");
    if (!nav || navbarCompactReady) return;
    navbarCompactReady = true;
    // Primera decision sincrona, en la misma tarea que inyecta la barra: no se
    // llega a pintar la barra de escritorio cortada.
    updateNavbarCompactState();
    if (typeof window.ResizeObserver === "function") {
      new window.ResizeObserver(scheduleNavbarMeasurement).observe(nav);
    } else if (typeof window.addEventListener === "function") {
      window.addEventListener("resize", scheduleNavbarMeasurement);
    }
    if (typeof window.matchMedia === "function") {
      var mq = window.matchMedia(NAVBAR_MOBILE_QUERY);
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", scheduleNavbarMeasurement);
    }
    // Las fuentes web cambian el ancho de los textos al terminar de cargar.
    if (document.fonts) {
      if (document.fonts.ready && typeof document.fonts.ready.then === "function") {
        document.fonts.ready.then(scheduleNavbarMeasurement);
      }
      if (typeof document.fonts.addEventListener === "function") {
        document.fonts.addEventListener("loadingdone", scheduleNavbarMeasurement);
      }
    }
    // Cambios del nombre del chip o de la visibilidad de enlaces (rol).
    var user = document.getElementById("app-navbar-user");
    var links = document.getElementById("app-navbar-links");
    if (typeof window.MutationObserver === "function") {
      var mo = new window.MutationObserver(scheduleNavbarMeasurement);
      if (user) mo.observe(user, { childList: true, characterData: true, subtree: true });
      if (links) mo.observe(links, { attributes: true, attributeFilter: ["style", "hidden"], subtree: true });
    }
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

  var sharedShellBooted = false;

  function initSharedShell() {
    if (sharedShellBooted) return;
    sharedShellBooted = true;
    injectNavbar();
    markShellReady();
    attachRevealMotion();
    updateNavbarSession();
    attachNavbarInteractions();
    setupNavbarCompactMode();
  }

  // ─────────────────────────────────────────────
  //  Init
  // ─────────────────────────────────────────────
  window.initSharedShell = initSharedShell;
  // Mismo contenido del menu "Guias" montado en otro contenedor (p. ej. el
  // selector de guias del Panel de gestion en index.html), con sus propios ids.
  window.portalGuideNav = { mount: renderGuidesMenu };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSharedShell);
  } else {
    initSharedShell();
  }
})();
