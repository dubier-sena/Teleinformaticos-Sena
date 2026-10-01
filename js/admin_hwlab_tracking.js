/* js/admin_hwlab_tracking.js
 *
 * SEGUIMIENTO DEL LABORATORIO (panel del instructor; LOOP seguimiento, sep-29).
 * Lee la coleccion de intentos sena_portal_hwlab_attempts con UNA consulta por
 * ficha (where ficha == F): Firestore factura 1 lectura por intento devuelto
 * (minimo 1). El detalle de un aprendiz se arma con esos mismos datos: 0
 * lecturas extra. La lista de aprendices sale del estado que el panel YA tiene
 * cargado (admin_usuarios.js): 0 lecturas. Antes, la vista de resultados leia
 * ~27 documentos por aprendiz (~3.000 lecturas por "Actualizar" con 110).
 *
 * SEGUIMIENTO != NOTA OFICIAL: muestra evidencia, no toca Calificaciones.
 * AUDITABLE, NO ANTIFRAUDE: el puntaje se calcula en el navegador del aprendiz
 * y la ficha del intento la declara su cliente; por eso se contrasta con la
 * ficha del PERFIL (administrada por el instructor) y se marca la diferencia.
 */
(function (root) {
  "use strict";

  function A() { return root.HardwareLab && root.HardwareLab.Attempts; }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var EQUIPO = { desktop: "PC", laptop: "Portátil" };
  var ACTIVIDAD = { ensamble: "Ensamble", desensamble: "Desensamble", mantenimiento: "Mantenimiento", diagnostico: "Diagnóstico" };
  var ORIGEN = { new: "Registrado", migrated: "Migrado", legacy_partial: "Histórico parcial" };
  var ACTS = ["ensamble", "desensamble", "mantenimiento", "diagnostico"];

  var st = { host: null, deps: null, ficha: "", filtros: { texto: "", equipo: "", actividad: "", estado: "" }, attempts: null, loading: false, lastReads: null, totalReads: 0, error: "", selected: null };
  root.__hwtrackReads = root.__hwtrackReads || [];

  function users() { return (st.deps && st.deps.users) || []; }
  function keyOf(u) { return u.usernameKey || u.username; }
  function enabledFichas() {
    var auth = st.deps && st.deps.auth;
    var set = {};
    users().forEach(function (u) {
      if (!u.ficha || (u.role && u.role !== "student")) return;
      var info = auth && typeof auth.getFichaInfo === "function" ? auth.getFichaInfo(u.ficha) : null;
      if (info && info.optionalModules && info.optionalModules.hardwareLab) set[String(u.ficha)] = true;
    });
    return Object.keys(set).sort();
  }

  function fecha(iso) {
    var t = Date.parse(iso);
    return isFinite(t) ? new Date(t).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";
  }
  function dur(s) { return typeof s === "number" ? Math.floor(s / 60) + " min " + (Math.round(s % 60) < 10 ? "0" : "") + Math.round(s % 60) + " s" : "—"; }
  function caseName(eq, caso) {
    var DC = root.HardwareLab && root.HardwareLab.DiagnosisCases;
    var list = DC && typeof DC.casesFor === "function" ? DC.casesFor(eq) : [];
    var c = (list || []).find(function (x) { return x.id === caso; });
    return c ? "Caso " + c.number : caso || "";
  }

  /** Agrupa intentos por aprendiz (uid; respaldo usernameKey) -> filas con resumen. */
  function buildRows(ficha, attempts) {
    var Att = A();
    var byUid = {}, byKey = {};
    (attempts || []).forEach(function (a) {
      (byUid[a.uid] = byUid[a.uid] || []).push(a);
      if (a.usernameKey) (byKey[a.usernameKey] = byKey[a.usernameKey] || []).push(a);
    });
    var used = {};
    var rows = users().filter(function (u) { return String(u.ficha) === String(ficha) && (!u.role || u.role === "student"); }).map(function (u) {
      var list = (u.uid && byUid[u.uid]) || byKey[keyOf(u)] || [];
      list.forEach(function (a) { used[a.attemptId] = true; });
      var discrepancias = list.filter(function (a) { return a.ficha && String(a.ficha) !== String(u.ficha); }).length;
      return { user: u, attempts: list, sum: Att.summarize(list), discrepancias: discrepancias };
    });
    var huerfanos = (attempts || []).filter(function (a) { return !used[a.attemptId]; });
    return { rows: rows, huerfanos: huerfanos };
  }

  function cellHtml(sum, act) {
    var Att = A();
    var parts = [];
    ["desktop", "laptop"].forEach(function (eq) {
      if (Att.ACTIVITIES_BY_EQUIPMENT[eq].indexOf(act) === -1) return;
      var c = sum.actividades[eq + "/" + act];
      var s = Att.cellStatus(c);
      parts.push('<span>' + esc(EQUIPO[eq]) + ': <span class="hwtrack-state hwtrack-state--' + s.code + '">' + esc(s.label) + "</span>" +
        (c && c.mejor != null ? " " + esc(Att.formatScore(c.mejor)) : "") + (c ? " (" + c.intentos + ")" : "") + "</span>");
    });
    return '<div class="hwtrack-cell">' + parts.join("") + "</div>";
  }

  function passesFilters(r) {
    var f = st.filtros;
    if (f.texto && (String(r.user.fullName || "") + " " + keyOf(r.user)).toLowerCase().indexOf(f.texto.toLowerCase()) === -1) return false;
    if (f.equipo && !r.attempts.some(function (a) { return a.equipo === f.equipo; })) return false;
    if (f.actividad && !r.attempts.some(function (a) { return a.actividad === f.actividad; })) return false;
    if (f.estado === "sin_registros" && r.attempts.length) return false;
    if (f.estado === "aprobado" && !r.attempts.some(function (a) { return a.estado === "APROBADO"; })) return false;
    if (f.estado === "por_mejorar" && !r.attempts.some(function (a) { return a.estado === "POR MEJORAR"; })) return false;
    if (f.estado === "parcial" && !r.attempts.some(function (a) { return a.origen === "legacy_partial"; })) return false;
    return true;
  }

  function render() {
    var host = st.host;
    if (!host) return;
    var Att = A();
    if (!Att) { host.innerHTML = '<p class="activities-empty">Módulo de seguimiento no disponible.</p>'; return; }
    var fichas = enabledFichas();
    var html = '<div class="admin-panel"><div class="admin-panel__header"><div><h2>Seguimiento del Laboratorio</h2>' +
      "<p>Historial de intentos por aprendiz. Es <strong>seguimiento, no nota oficial</strong>, y es <strong>auditable, no antifraude</strong>: el puntaje lo calcula el navegador del aprendiz.</p></div></div>" +
      '<div class="hwtrack-toolbar">' +
      '<label>Ficha <select id="hwtrack-ficha"><option value="">Selecciona una ficha</option>' +
      fichas.map(function (f) { return '<option value="' + esc(f) + '"' + (st.ficha === f ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select></label>" +
      '<button type="button" class="admin-button" id="hwtrack-load"' + (st.ficha ? "" : " disabled") + ">" + (st.attempts ? "Actualizar" : "Cargar") + "</button>" +
      '<input type="search" id="hwtrack-text" placeholder="Buscar aprendiz" value="' + esc(st.filtros.texto) + '" aria-label="Buscar aprendiz">' +
      '<select id="hwtrack-equipo" aria-label="Equipo"><option value="">Todos los equipos</option><option value="desktop"' + (st.filtros.equipo === "desktop" ? " selected" : "") + '>PC de escritorio</option><option value="laptop"' + (st.filtros.equipo === "laptop" ? " selected" : "") + ">Portátil</option></select>" +
      '<select id="hwtrack-actividad" aria-label="Actividad"><option value="">Todas las actividades</option>' + ACTS.map(function (a) { return '<option value="' + a + '"' + (st.filtros.actividad === a ? " selected" : "") + ">" + ACTIVIDAD[a] + "</option>"; }).join("") + "</select>" +
      '<select id="hwtrack-estado" aria-label="Estado"><option value="">Cualquier estado</option><option value="aprobado"' + (st.filtros.estado === "aprobado" ? " selected" : "") + '>Con algún aprobado</option><option value="por_mejorar"' + (st.filtros.estado === "por_mejorar" ? " selected" : "") + '>Con algún "por mejorar"</option><option value="parcial"' + (st.filtros.estado === "parcial" ? " selected" : "") + '>Con histórico parcial</option><option value="sin_registros"' + (st.filtros.estado === "sin_registros" ? " selected" : "") + ">Sin intentos sincronizados</option></select>" +
      '<button type="button" class="admin-button admin-button--ghost" id="hwtrack-export"' + (st.attempts ? "" : " disabled") + ">Exportar (CSV para Excel)</button>" +
      "</div>";
    if (st.loading) html += '<p class="activities-empty">Consultando intentos de la ficha…</p>';
    else if (st.error) html += '<p class="activities-empty">' + esc(st.error) + "</p>";
    else if (!st.attempts) html += '<p class="activities-empty">Selecciona una ficha y pulsa "Cargar". No se lee nada hasta entonces.</p>';
    else {
      var built = buildRows(st.ficha, st.attempts);
      html += '<p class="hwtrack-meta">Lecturas de Firestore de esta consulta: <strong>' + st.lastReads + "</strong> (" + st.attempts.length + " intento(s)); acumuladas en esta sesión del panel: " + st.totalReads +
        ". «Sin intentos sincronizados» significa que no ha llegado ningún intento al registro central, <strong>no</strong> que el aprendiz no haya realizado la actividad: puede haber intentos guardados solo en su navegador.</p>";
      html += '<div class="admin-table-wrap"><table class="admin-table hwtrack-table"><thead><tr><th scope="col">Aprendiz</th>' + ACTS.map(function (a) { return '<th scope="col">' + ACTIVIDAD[a] + "</th>"; }).join("") +
        '<th scope="col">Intentos</th><th scope="col">Mejor</th><th scope="col">Último</th><th scope="col">Progreso</th><th scope="col"></th></tr></thead><tbody>';
      built.rows.filter(passesFilters).forEach(function (r) {
        var k = keyOf(r.user);
        html += "<tr><td>" + esc(r.user.fullName || k) + (r.discrepancias ? '<div class="hwtrack-warn">⚠ ' + r.discrepancias + " intento(s) con ficha distinta al perfil</div>" : "") + "</td>" +
          ACTS.map(function (a) { return "<td>" + cellHtml(r.sum, a) + "</td>"; }).join("") +
          "<td>" + r.sum.intentos + "</td><td>" + (r.sum.mejor == null ? "—" : esc(Att.formatScore(r.sum.mejor))) + "</td><td>" + (r.sum.ultimo == null ? "—" : esc(Att.formatScore(r.sum.ultimo))) + "</td>" +
          "<td>" + r.sum.progreso.completadas + "/" + r.sum.progreso.total + " actividades</td>" +
          '<td><button type="button" class="admin-button admin-button--ghost" data-hwtrack-user="' + esc(k) + '">' + (st.selected === k ? "Ocultar" : "Detalle") + "</button></td></tr>";
      });
      html += "</tbody></table></div>";
      // Detalle FUERA de la tabla: anidado en una celda arrastraba el ancho de
      // la tabla principal y desbordaba la pagina (medido: +26 px a 1440).
      var sel = built.rows.find(function (r) { return keyOf(r.user) === st.selected; });
      if (sel) html += detailHtml(sel);
      if (built.huerfanos.length) html += '<p class="hwtrack-warn">⚠ ' + built.huerfanos.length + " intento(s) de esta ficha no coinciden con ningún aprendiz cargado en el panel (revisar perfil/UID).</p>";
    }
    html += "</div>";
    host.innerHTML = html;
    bind();
  }

  function detailHtml(r) {
    var Att = A();
    var s = r.sum;
    var pend = [];
    Object.keys(Att.ACTIVITIES_BY_EQUIPMENT).forEach(function (eq) {
      Att.ACTIVITIES_BY_EQUIPMENT[eq].forEach(function (act) {
        var c = s.actividades[eq + "/" + act];
        if (!c || !c.completados) pend.push(EQUIPO[eq] + " · " + ACTIVIDAD[act]);
      });
    });
    var counter = {};
    var rows = s.historial.map(function (a) { var k = a.equipo + "/" + a.practica; counter[k] = (counter[k] || 0) + 1; return { a: a, n: counter[k] }; }).reverse();
    return '<div class="hwtrack-detail"><h3>' + esc(r.user.fullName || keyOf(r.user)) + " — ficha " + esc(r.user.ficha) + "</h3>" +
      "<p><strong>Intentos:</strong> " + s.intentos + " · <strong>Mejor:</strong> " + (s.mejor == null ? "—" : esc(Att.formatScore(s.mejor)) + "/100") +
      " · <strong>Último:</strong> " + (s.ultimo == null ? "—" : esc(Att.formatScore(s.ultimo)) + "/100") + (s.ultimoFecha ? " (" + esc(fecha(s.ultimoFecha)) + ")" : "") +
      " · <strong>Progreso:</strong> " + s.progreso.completadas + " de " + s.progreso.total + " actividades con un intento completado</p>" +
      "<p><strong>Pendientes:</strong> " + (pend.length ? esc(pend.join(", ")) : "ninguna") + "</p>" +
      (rows.length ? '<div class="admin-table-wrap"><table class="admin-table hwtrack-table"><thead><tr><th scope="col">Fecha</th><th scope="col">Equipo</th><th scope="col">Práctica</th><th scope="col">Caso</th><th scope="col">Intento</th><th scope="col">Bruto</th><th scope="col">Máx. bruto</th><th scope="col">Normalizado /100</th><th scope="col">Estado</th><th scope="col">Estado anterior</th><th scope="col">Pistas</th><th scope="col">Errores</th><th scope="col">Duración</th><th scope="col">Versión</th><th scope="col">Origen</th><th scope="col">Ficha del intento</th></tr></thead><tbody>' +
        rows.map(function (x) {
          var a = x.a;
          return "<tr><td>" + esc(fecha(a.fechaFin || a.fechaInicio)) + "</td><td>" + esc(EQUIPO[a.equipo] || a.equipo) + "</td><td>" + esc(ACTIVIDAD[a.actividad] + (a.modo && a.modo !== "diagnostico" ? " (" + a.modo + ")" : "")) + "</td><td>" + esc(a.caso ? caseName(a.equipo, a.caso) : "—") + "</td><td>" + x.n + "</td><td>" +
            (a.rawScore == null ? "No disponible" : a.rawScore) + "</td><td>" + (a.rawMaxScore == null ? "—" : a.rawMaxScore) + "</td><td>" + (a.normalizedScore == null ? "—" : esc(Att.formatScore(a.normalizedScore))) + "</td><td>" + esc(a.estado || (a.completado ? "Completado" : "—")) + "</td><td>" + esc(a.estadoLegacy || "—") + "</td><td>" +
            (a.pistas == null ? "—" : a.pistas) + "</td><td>" + (a.errores == null ? "—" : a.errores) + "</td><td>" + esc(dur(a.duracion)) + "</td><td>" + esc(a.versionSimulador || "desconocida") + "</td><td>" + esc(ORIGEN[a.origen] || a.origen) + (a.fuente ? " · " + esc(a.fuente) : "") + "</td><td>" +
            esc(a.ficha || "—") + (a.ficha && String(a.ficha) !== String(r.user.ficha) ? ' <span class="hwtrack-warn">≠ perfil</span>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : "<p>Sin intentos sincronizados en el registro central. Esto no significa que no haya realizado la actividad: los intentos pueden estar guardados solo en el navegador donde practicó, pendientes de enviar.</p>") +
      "</div>";
  }

  /** CSV compatible con Excel en español (BOM, ";", coma decimal). Una fila por intento. */
  function exportCsv() {
    var Att = A();
    var built = buildRows(st.ficha, st.attempts || []);
    var num = function (n) { return typeof n === "number" ? String(Math.round(n * 100) / 100).replace(".", ",") : ""; };
    var cols = ["ficha", "aprendiz", "equipo", "actividad", "modo", "caso", "intento", "fecha", "rawScore", "rawMaxScore", "normalizedScore", "estado", "estadoLegacy", "intentos_aprendiz", "mejor_aprendiz", "ultimo_aprendiz", "progreso", "origen", "fuente", "version"];
    var lines = [cols.join(";")];
    built.rows.forEach(function (r) {
      var counter = {};
      if (!r.attempts.length) {
        lines.push([r.user.ficha, r.user.fullName || keyOf(r.user), "", "", "", "", "", "", "", "", "", "Sin intentos sincronizados", "", 0, "", "", r.sum.progreso.completadas + "/" + r.sum.progreso.total, "", "", ""].map(csvCell).join(";"));
      }
      r.sum.historial.forEach(function (a) {
        var k = a.equipo + "/" + a.practica; counter[k] = (counter[k] || 0) + 1;
        lines.push([r.user.ficha, r.user.fullName || keyOf(r.user), EQUIPO[a.equipo], ACTIVIDAD[a.actividad], a.modo, a.caso || "", counter[k], a.fechaFin || a.fechaInicio || "",
          a.rawScore == null ? "" : a.rawScore, a.rawMaxScore == null ? "" : a.rawMaxScore, num(a.normalizedScore), a.estado || (a.completado ? "Completado" : ""), a.estadoLegacy || "",
          r.sum.intentos, num(r.sum.mejor), num(r.sum.ultimo), r.sum.progreso.completadas + "/" + r.sum.progreso.total, ORIGEN[a.origen] || a.origen, a.fuente || "", a.versionSimulador || ""].map(csvCell).join(";"));
      });
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "seguimiento_laboratorio_" + st.ficha + ".csv" });
    document.body.appendChild(link); link.click(); link.remove();
    return lines.length - 1;
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  async function load() {
    var db = st.deps && st.deps.db;
    if (!st.ficha || !db || typeof db.cloudQueryHwlabAttempts !== "function") return;
    st.loading = true; st.error = ""; render();
    var res = await db.cloudQueryHwlabAttempts("ficha", st.ficha);
    st.loading = false;
    st.lastReads = res.reads || 0;
    st.totalReads += st.lastReads;
    root.__hwtrackReads.push({ accion: "ficha " + st.ficha, lecturas: st.lastReads, intentos: (res.docs || []).length });
    if (res.status !== "ok") { st.attempts = null; st.error = "No se pudo consultar (" + res.status + "). Revisa la conexión y la sesión de administrador."; }
    else st.attempts = res.docs;
    render();
  }

  function bind() {
    var byId = function (id) { return document.getElementById(id); };
    var sel = byId("hwtrack-ficha");
    if (sel) sel.addEventListener("change", function () { st.ficha = sel.value; st.attempts = null; st.selected = null; st.error = ""; render(); });
    var btn = byId("hwtrack-load"); if (btn) btn.addEventListener("click", load);
    var ex = byId("hwtrack-export"); if (ex) ex.addEventListener("click", exportCsv);
    [["hwtrack-text", "texto", "input"], ["hwtrack-equipo", "equipo", "change"], ["hwtrack-actividad", "actividad", "change"], ["hwtrack-estado", "estado", "change"]].forEach(function (x) {
      var el = byId(x[0]);
      if (el) el.addEventListener(x[2], function () { st.filtros[x[1]] = el.value; render(); var again = byId(x[0]); if (again && x[2] === "input") { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } });
    });
    st.host.querySelectorAll("[data-hwtrack-user]").forEach(function (b) {
      b.addEventListener("click", function () { var k = b.getAttribute("data-hwtrack-user"); st.selected = st.selected === k ? null : k; render(); });
    });
  }

  function mount(host, deps) {
    st.host = host;
    st.deps = deps;
    render();
  }

  root.adminHwlabTracking = { mount: mount, _test: { buildRows: buildRows, csvCell: csvCell, state: st, exportCsv: exportCsv } };
})(typeof window !== "undefined" ? window : this);
