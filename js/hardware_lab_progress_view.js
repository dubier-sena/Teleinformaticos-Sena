/* js/hardware_lab_progress_view.js
 *
 * "MI PROGRESO" del Laboratorio Virtual (LOOP seguimiento, 2026-09-29) y
 * arranque del seguimiento en la pagina del laboratorio:
 *  - al cargar (aprendiz con sesion Firebase): migrador de datos antiguos del
 *    navegador + sincronizacion de la cola de intentos pendientes;
 *  - al volver la conexion ("online") y cada 60 s si hay pendientes: reintento;
 *  - boton "Mi progreso": UNA consulta (where uid == propio) y el historial
 *    propio. Nunca muestra datos de otro aprendiz (lo garantiza la regla).
 * Solo lectura de la UI; nada de esto bloquea el laboratorio si falla.
 */
(function (root) {
  "use strict";

  function A() { return root.HardwareLab && root.HardwareLab.Attempts; }
  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function session() {
    try { return root.portalAuth && root.portalAuth.getCurrentSession ? root.portalAuth.getCurrentSession() : null; } catch (e) { return null; }
  }
  var EQUIPO = { desktop: "PC de escritorio", laptop: "Portátil" };
  var ACTIVIDAD = { ensamble: "Ensamble", desensamble: "Desensamble", mantenimiento: "Mantenimiento", diagnostico: "Diagnóstico" };
  var MODO = { guiado: "guiado", libre: "práctica libre", evaluacion: "evaluación", diagnostico: "" };
  var ORIGEN = { new: "Registrado", migrated: "Migrado (histórico)", legacy_partial: "Histórico parcial" };

  function caseName(equipo, caso) {
    var DC = root.HardwareLab && root.HardwareLab.DiagnosisCases;
    var list = DC && typeof DC.casesFor === "function" ? DC.casesFor(equipo) : [];
    var c = (list || []).find(function (x) { return x.id === caso; });
    return c ? "Caso " + c.number + " — " + c.name : caso || "";
  }
  function fecha(iso) {
    var t = Date.parse(iso);
    return isFinite(t) ? new Date(t).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—";
  }
  function dur(s) {
    if (typeof s !== "number") return "—";
    var m = Math.floor(s / 60), r = Math.round(s % 60);
    return m + " min " + (r < 10 ? "0" : "") + r + " s";
  }

  function render(host, res) {
    var Att = A();
    var docs = (res && res.docs) || [];
    var pend = Att.pendingCount();
    if (res.status !== "ok" && !docs.length) {
      host.innerHTML = '<p class="hwlab-muted">No se pudo consultar tu progreso ahora (sin conexión o sin sesión en la nube). ' +
        (pend ? "Tienes " + pend + " intento(s) guardado(s) en este equipo, pendientes de enviar: se enviarán solos al volver la conexión." : "") + "</p>";
      return;
    }
    var sum = Att.summarize(docs);
    var html = '<div class="hwlab-progress__summary">' +
      "<p><strong>Intentos registrados:</strong> " + sum.intentos + "</p>" +
      "<p><strong>Mejor puntaje:</strong> " + (sum.mejor == null ? "—" : Att.formatScore(sum.mejor) + "/100") + "</p>" +
      "<p><strong>Último puntaje:</strong> " + (sum.ultimo == null ? "—" : Att.formatScore(sum.ultimo) + "/100") + "</p>" +
      "<p><strong>Actividades con al menos un intento completado:</strong> " + sum.progreso.completadas + " de " + sum.progreso.total + "</p>" +
      (pend ? "<p><strong>Pendientes de enviar desde este equipo:</strong> " + pend + "</p>" : "") +
      "</div>";
    html += '<div class="hwlab-progress__table-wrap"><table class="hwlab-progress__table"><caption>Estado por actividad</caption><thead><tr><th scope="col">Equipo</th><th scope="col">Actividad</th><th scope="col">Estado</th><th scope="col">Intentos</th><th scope="col">Mejor</th><th scope="col">Último</th></tr></thead><tbody>';
    Object.keys(Att.ACTIVITIES_BY_EQUIPMENT).forEach(function (eq) {
      Att.ACTIVITIES_BY_EQUIPMENT[eq].forEach(function (act) {
        var cell = sum.actividades[eq + "/" + act];
        var st = Att.cellStatus(cell);
        html += "<tr><td>" + esc(EQUIPO[eq]) + "</td><td>" + esc(ACTIVIDAD[act]) + '</td><td><span class="hwlab-state hwlab-state--' + st.code + '">' + esc(st.label) + "</span></td><td>" +
          (cell ? cell.intentos : 0) + "</td><td>" + (cell && cell.mejor != null ? Att.formatScore(cell.mejor) : "—") + "</td><td>" + (cell && cell.ultimo != null ? Att.formatScore(cell.ultimo) : "—") + "</td></tr>";
      });
    });
    html += "</tbody></table></div>";
    if (!docs.length) {
      html += '<p class="hwlab-muted">Todavía no hay intentos registrados. Los intentos que hiciste antes del registro centralizado pueden no aparecer: <strong>sin registros no significa que no hayas practicado</strong>.</p>';
    } else {
      html += '<div class="hwlab-progress__table-wrap"><table class="hwlab-progress__table"><caption>Mi historial (más reciente primero)</caption><thead><tr>' +
        '<th scope="col">Fecha</th><th scope="col">Equipo</th><th scope="col">Práctica</th><th scope="col">Intento</th><th scope="col">Puntaje /100</th><th scope="col">Rúbrica</th><th scope="col">Estado</th><th scope="col">Pistas</th><th scope="col">Errores</th><th scope="col">Duración</th><th scope="col">Origen</th>' +
        "</tr></thead><tbody>";
      var counter = {};
      var numbered = sum.historial.map(function (a) { var k = a.equipo + "/" + a.practica; counter[k] = (counter[k] || 0) + 1; return { a: a, n: counter[k] }; });
      numbered.reverse().forEach(function (x) {
        var a = x.a;
        var prac = ACTIVIDAD[a.actividad] + (a.caso ? " · " + caseName(a.equipo, a.caso) : MODO[a.modo] ? " (" + MODO[a.modo] + ")" : "");
        html += "<tr><td>" + esc(fecha(a.fechaFin || a.fechaInicio)) + "</td><td>" + esc(EQUIPO[a.equipo] || a.equipo) + "</td><td>" + esc(prac) + "</td><td>" + x.n + "</td><td>" +
          (a.normalizedScore == null ? "No disponible" : esc(Att.formatScore(a.normalizedScore))) + "</td><td>" +
          (a.rawScore == null ? "—" : esc(a.rawScore + "/" + a.rawMaxScore)) + "</td><td>" + esc(a.estado || (a.completado ? "Completado" : "—")) + "</td><td>" +
          (a.pistas == null ? "—" : a.pistas) + "</td><td>" + (a.errores == null ? "—" : a.errores) + "</td><td>" + esc(dur(a.duracion)) + "</td><td>" + esc(ORIGEN[a.origen] || a.origen) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    host.innerHTML = html;
  }

  async function openProgress() {
    var host = document.getElementById("hwlab-progress");
    if (!host) return;
    host.hidden = false;
    host.innerHTML = '<p class="hwlab-muted">Consultando tu progreso…</p>';
    await A().flushNow();
    var res = await A().loadOwnAttempts();
    render(host, res);
  }

  function init() {
    var s = session();
    if (!A() || !s || s.role !== "student") return;
    var entry = document.getElementById("hwlab-progress-entry");
    var btn = document.getElementById("hwlab-progress-btn");
    if (entry) entry.hidden = false;
    if (btn) btn.addEventListener("click", function () {
      var host = document.getElementById("hwlab-progress");
      if (host && !host.hidden && btn.getAttribute("aria-expanded") === "true") { host.hidden = true; btn.setAttribute("aria-expanded", "false"); return; }
      btn.setAttribute("aria-expanded", "true");
      openProgress();
    });
    // Migrador + cola: esperan a que Firebase Auth hidrate la sesion (UID).
    var bridge = root.portalFirebaseAuth;
    var ready = bridge && typeof bridge.waitForAuthHydration === "function" ? Promise.resolve(bridge.waitForAuthHydration(5000)).catch(function () {}) : Promise.resolve();
    ready.then(function () {
      A().migrateBrowserLegacy();
      A().flushNow();
    });
    root.addEventListener("online", function () { A().flushNow(); });
    root.setInterval(function () { if (A().pendingCount() > 0) A().flushNow(); }, 60000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.ProgressView = { render: render, openProgress: openProgress };
})(typeof window !== "undefined" ? window : this);
