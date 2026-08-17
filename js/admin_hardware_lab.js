/* js/admin_hardware_lab.js
 *
 * Panel del instructor para el Laboratorio Virtual de Hardware (item 37).
 * Modulo aislado (no toca admin_usuarios.js mas alla de un hook de una
 * linea, ver renderHardwareLabPanel): lee, por cada aprendiz, el mismo doc
 * de "guia sintetica" que usa hardware_lab_storage.js
 * (scope "student:{usernameKey}", fileKey "laboratorio-virtual-hardware.html")
 * y reconstruye sus practicas a partir de las llaves planas "hwlab_*" que
 * hay dentro de su "state".
 *
 * No requiere coleccion nueva en Firestore ni cambios a firestore.rules: el
 * admin ya puede leer cualquier guide_state via las reglas existentes
 * (isAdmin()).
 */
(function (root) {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var FILE_KEY = "laboratorio-virtual-hardware.html";

  function fmtTime(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function labelForMode(mode) {
    var known = {
      "disassembly-guided": "Desensamble guiado",
      "assembly-guided": "Ensamble guiado",
      "disassembly-open-libre": "Practica libre (desensamble)",
      "assembly-open-libre": "Practica libre (ensamble)",
      "disassembly-open-eval": "Evaluacion (desensamble)",
      "assembly-open-eval": "Evaluacion (ensamble)",
    };
    return known[mode] || mode;
  }

  function caseLabel(caseKeySuffix) {
    var HardwareLab = root.HardwareLab;
    var cases = (HardwareLab && HardwareLab.DiagnosisCases && HardwareLab.DiagnosisCases.CASES) || [];
    var normalized = caseKeySuffix.replace(/_/g, "-");
    var found = cases.find(function (c) {
      return c.id === normalized;
    });
    return found ? "Caso " + found.number + " — " + found.name : caseKeySuffix;
  }

  // ── Parseo de las llaves planas "hwlab_*" dentro del state de un aprendiz ─
  function parseHwlabState(state) {
    var practices = []; // ensamble/desensamble (guiado, libre, evaluacion)
    var diagnosisCases = []; // casos de diagnostico
    Object.keys(state || {}).forEach(function (key) {
      if (key.indexOf("hwlab_") !== 0) return;
      var value = state[key];
      if (!value || typeof value !== "object") return;
      var rest = key.slice("hwlab_".length);
      if (rest.indexOf("desktop_diagnosis_caso_") === 0 || rest.indexOf("laptop_diagnosis_caso_") === 0) {
        var casoSuffix = rest.replace(/^(desktop|laptop)_diagnosis_/, "");
        diagnosisCases.push({ key: key, equipmentId: rest.split("_")[0], caseKey: casoSuffix, session: value });
        return;
      }
      // hwlab_{equipo}_{modo con guiones bajos}
      var match = rest.match(/^(desktop|laptop)_(.+)$/);
      if (!match) return;
      var equipmentId = match[1];
      var mode = match[2].replace(/_/g, "-");
      practices.push({ key: key, equipmentId: equipmentId, mode: mode, session: value });
    });
    return { practices: practices, diagnosisCases: diagnosisCases };
  }

  // ── Agregado por aprendiz ──────────────────────────────────────────────────
  function summarizeStudent(user, parsed) {
    var allSessions = parsed.practices.map(function (p) { return p.session; }).concat(
      parsed.diagnosisCases.map(function (c) { return c.session; })
    );
    var finished = allSessions.filter(function (s) { return s.result; });
    var casesCompleted = parsed.diagnosisCases.filter(function (c) {
      return c.session.result && c.session.result.status === "APROBADO";
    });
    var casesPending = parsed.diagnosisCases.length - casesCompleted.length;
    var totalTime = finished.reduce(function (sum, s) { return sum + (s.result.durationSeconds || 0); }, 0);
    var totalErrors = allSessions.reduce(function (sum, s) { return sum + (s.errors || 0); }, 0);
    var totalHints = allSessions.reduce(function (sum, s) { return sum + ((s.hints && s.hints.used) || 0); }, 0);
    var scores = finished.map(function (s) { return s.result.score; });
    var avgScore = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : null;
    var highestCasePassed = casesCompleted.reduce(function (max, c) {
      var num = parseInt((c.caseKey.match(/caso_(\d+)/) || [])[1], 10);
      return isFinite(num) ? Math.max(max, num) : max;
    }, 0);
    var lastActivity = allSessions.reduce(function (max, s) {
      var t = Date.parse(s.finishedAt || s.startedAt || 0);
      return isFinite(t) ? Math.max(max, t) : max;
    }, 0);

    return {
      user: user,
      practices: parsed.practices,
      diagnosisCases: parsed.diagnosisCases,
      attempts: allSessions.length,
      casesCompleted: casesCompleted.length,
      casesPending: Math.max(0, casesPending),
      totalTime: totalTime,
      totalErrors: totalErrors,
      totalHints: totalHints,
      avgScore: avgScore,
      highestCasePassed: highestCasePassed,
      lastActivity: lastActivity,
    };
  }

  // ── Estado del modulo ──────────────────────────────────────────────────────
  var moduleState = {
    host: null,
    deps: null,
    filters: { ficha: "", search: "", equipo: "", estado: "" },
    summaries: null, // null = aun no cargado
    loading: false,
    expandedUser: null,
  };

  function usernameKeyOf(user) {
    return user.usernameKey || user.username;
  }

  async function loadSummaries(deps) {
    var db = deps.db;
    var users = deps.users || [];
    if (!db || typeof db.cloudGetGuideData !== "function") return [];
    var results = await Promise.all(
      users.map(async function (user) {
        var usernameKey = usernameKeyOf(user);
        if (!usernameKey) return null;
        var scope = "student:" + usernameKey;
        var snapshot = null;
        try {
          snapshot = await db.cloudGetGuideData(scope, FILE_KEY);
        } catch (e) {
          return null;
        }
        var state = snapshot && typeof snapshot === "object" ? snapshot.state || snapshot.data : null;
        if (!state || !Object.keys(state).length) return null;
        var parsed = parseHwlabState(state);
        if (!parsed.practices.length && !parsed.diagnosisCases.length) return null;
        return summarizeStudent(user, parsed);
      })
    );
    return results.filter(Boolean);
  }

  function matchesFilters(summary) {
    var f = moduleState.filters;
    var user = summary.user;
    if (f.ficha && String(user.ficha) !== String(f.ficha)) return false;
    if (f.search) {
      var needle = f.search.toLowerCase();
      var haystack = (String(user.fullName || "") + " " + String(user.username || "")).toLowerCase();
      if (haystack.indexOf(needle) === -1) return false;
    }
    if (f.equipo) {
      var hasEquipo = summary.practices.some(function (p) { return p.equipmentId === f.equipo; }) ||
        summary.diagnosisCases.some(function (c) { return c.equipmentId === f.equipo; });
      if (!hasEquipo) return false;
    }
    if (f.estado === "aprobado" && summary.casesCompleted === 0 && !summary.practices.some(function (p) { return p.session.result && p.session.result.status === "APROBADO"; })) {
      return false;
    }
    return true;
  }

  function uniqueFichas(summaries) {
    var set = {};
    summaries.forEach(function (s) {
      if (s.user.ficha) set[s.user.ficha] = true;
    });
    return Object.keys(set).sort();
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    var host = moduleState.host;
    if (!host) return;

    if (moduleState.loading) {
      host.innerHTML = '<p class="activities-empty">Cargando resultados del Laboratorio Virtual desde la nube...</p>';
      return;
    }
    if (!moduleState.summaries) {
      host.innerHTML = '<p class="activities-empty">Sin datos todavia. Pulsa "Actualizar" para cargar los resultados.</p>' + renderRefreshButton();
      bindStaticEvents();
      return;
    }

    var visible = moduleState.summaries.filter(matchesFilters);
    var fichas = uniqueFichas(moduleState.summaries);

    host.innerHTML =
      '<div class="admin-panel">' +
      '<div class="admin-panel__header"><div><h2>Resultados del Laboratorio Virtual</h2>' +
      "<p>" + visible.length + " aprendiz(es) con actividad registrada.</p></div>" +
      renderRefreshButton() +
      "</div>" +
      renderFilters(fichas) +
      renderTable(visible) +
      "</div>";

    bindEvents();
  }

  function renderRefreshButton() {
    return '<button type="button" class="admin-button" id="hwlab-admin-refresh">Actualizar</button>';
  }

  function renderFilters(fichas) {
    var f = moduleState.filters;
    return (
      '<div class="admin-filters">' +
      '<input type="search" id="hwlab-admin-search" placeholder="Buscar aprendiz..." value="' +
      esc(f.search) +
      '">' +
      '<select id="hwlab-admin-ficha"><option value="">Todas las fichas</option>' +
      fichas
        .map(function (fi) {
          return '<option value="' + esc(fi) + '"' + (f.ficha === fi ? " selected" : "") + ">" + esc(fi) + "</option>";
        })
        .join("") +
      "</select>" +
      '<select id="hwlab-admin-equipo"><option value="">Todos los equipos</option>' +
      '<option value="desktop"' + (f.equipo === "desktop" ? " selected" : "") + ">PC de escritorio</option>" +
      '<option value="laptop"' + (f.equipo === "laptop" ? " selected" : "") + ">Portatil</option>" +
      "</select>" +
      '<select id="hwlab-admin-estado"><option value="">Cualquier estado</option>' +
      '<option value="aprobado"' + (f.estado === "aprobado" ? " selected" : "") + ">Con al menos un APROBADO</option>" +
      "</select>" +
      "</div>"
    );
  }

  function renderTable(summaries) {
    if (!summaries.length) {
      return '<p class="activities-empty">Ningun aprendiz coincide con los filtros actuales.</p>';
    }
    var rows = summaries
      .map(function (s) {
        var expanded = moduleState.expandedUser === usernameKeyOf(s.user);
        var row =
          "<tr>" +
          "<td>" + esc(s.user.fullName || s.user.username || "") + "</td>" +
          "<td>" + esc(s.user.ficha || "") + "</td>" +
          "<td>" + s.casesCompleted + "</td>" +
          "<td>" + s.casesPending + "</td>" +
          "<td>" + s.attempts + "</td>" +
          "<td>" + fmtTime(s.totalTime) + "</td>" +
          "<td>" + s.totalErrors + "</td>" +
          "<td>" + s.totalHints + "</td>" +
          "<td>" + (s.avgScore == null ? "—" : s.avgScore + "/100") + "</td>" +
          "<td>" + (s.highestCasePassed || "—") + "</td>" +
          "<td>" + (s.lastActivity ? new Date(s.lastActivity).toLocaleString("es-CO") : "—") + "</td>" +
          '<td><button type="button" class="admin-button admin-button--ghost" data-hwlab-admin-toggle="' +
          esc(usernameKeyOf(s.user)) +
          '">' +
          (expanded ? "Ocultar" : "Detalle") +
          "</button></td>" +
          "</tr>";
        if (expanded) {
          row += '<tr><td colspan="12">' + renderDetail(s) + "</td></tr>";
        }
        return row;
      })
      .join("");

    return (
      '<div class="admin-table-wrap"><table class="admin-table">' +
      "<thead><tr><th>Nombre</th><th>Ficha</th><th>Casos completados</th><th>Casos pendientes</th>" +
      "<th>Intentos</th><th>Tiempo</th><th>Errores</th><th>Pistas</th><th>Puntuacion</th>" +
      "<th>Nivel alcanzado</th><th>Ultima actividad</th><th></th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function renderDetail(summary) {
    var practiceRows = summary.practices
      .map(function (p) {
        var r = p.session.result;
        return (
          "<li><strong>" +
          esc(labelForMode(p.mode)) +
          " (" + esc(p.equipmentId) + ")</strong>: " +
          (r ? r.score + "/100 — " + esc(r.status) + " — " + fmtTime(r.durationSeconds) : "en curso") +
          "</li>"
        );
      })
      .join("");
    var caseRows = summary.diagnosisCases
      .map(function (c) {
        var r = c.session.result;
        return (
          "<li><strong>" +
          esc(caseLabel(c.caseKey)) +
          "</strong>: " +
          (r ? r.score + "/100 — " + esc(r.status) + " — " + fmtTime(r.durationSeconds) : "en curso") +
          "</li>"
        );
      })
      .join("");
    return (
      '<div class="hwlab-admin-detail">' +
      "<h4>Practicas de ensamble/desensamble</h4><ul>" +
      (practiceRows || "<li>Sin intentos.</li>") +
      "</ul>" +
      "<h4>Casos de diagnostico</h4><ul>" +
      (caseRows || "<li>Sin intentos.</li>") +
      "</ul>" +
      "</div>"
    );
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  function bindStaticEvents() {
    var btn = document.getElementById("hwlab-admin-refresh");
    if (btn) btn.addEventListener("click", refresh);
  }

  function bindEvents() {
    bindStaticEvents();
    var search = document.getElementById("hwlab-admin-search");
    if (search) {
      search.addEventListener("input", function () {
        moduleState.filters.search = search.value;
        render();
      });
    }
    var ficha = document.getElementById("hwlab-admin-ficha");
    if (ficha) {
      ficha.addEventListener("change", function () {
        moduleState.filters.ficha = ficha.value;
        render();
      });
    }
    var equipo = document.getElementById("hwlab-admin-equipo");
    if (equipo) {
      equipo.addEventListener("change", function () {
        moduleState.filters.equipo = equipo.value;
        render();
      });
    }
    var estado = document.getElementById("hwlab-admin-estado");
    if (estado) {
      estado.addEventListener("change", function () {
        moduleState.filters.estado = estado.value;
        render();
      });
    }
    moduleState.host.querySelectorAll("[data-hwlab-admin-toggle]").forEach(function (el) {
      el.addEventListener("click", function () {
        var key = el.getAttribute("data-hwlab-admin-toggle");
        moduleState.expandedUser = moduleState.expandedUser === key ? null : key;
        render();
      });
    });
  }

  async function refresh() {
    moduleState.loading = true;
    render();
    moduleState.summaries = await loadSummaries(moduleState.deps);
    moduleState.loading = false;
    render();
  }

  function mount(host, deps) {
    moduleState.host = host;
    moduleState.deps = deps;
    render();
  }

  root.adminHardwareLab = { mount: mount };

  // Exportado solo para tests (funciones puras, sin DOM): ver
  // tests/admin_hardware_lab.test.cjs.
  root.__hwlabAdminTest__ = { parseHwlabState: parseHwlabState, summarizeStudent: summarizeStudent };
})(typeof window !== "undefined" ? window : this);
