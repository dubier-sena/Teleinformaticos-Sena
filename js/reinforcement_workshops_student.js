// js/reinforcement_workshops_student.js — pagina "Talleres de Refuerzo".
// Lista los talleres de refuerzo asignados al aprendiz -- incluidos los ya
// cerrados (superado/no superado), para no perder el historial ni el enlace
// al PDF -- con: titulo, descarga del PDF, fecha limite, estado, y boton de
// entrega mientras el taller siga abierto.
(function () {
  "use strict";

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // fechaLimite es "yyyy-mm-dd" (input date); fechaAsignacion es ISO completo.
  function formatFecha(value) {
    if (!value) return "";
    var d = new Date(String(value).length <= 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return String(value);
    try {
      return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  function getSession() {
    var auth = window.portalAuth;
    return auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
  }

  function fillMeta(session) {
    var user = session && session.user;
    var nameEl = document.getElementById("taller-meta-name");
    var instEl = document.getElementById("taller-meta-inst");
    var fichaEl = document.getElementById("taller-meta-ficha");
    if (nameEl) nameEl.textContent = (user && user.fullName) || "—";
    if (instEl) instEl.textContent = (user && user.inst) || "—";
    if (fichaEl) fichaEl.textContent = (user && user.ficha) || "—";
  }

  function renderNotStudent() {
    var container = document.getElementById("taller-content");
    if (!container) return;
    container.innerHTML = '<p class="taller-status">Inicia sesion como aprendiz para ver tus talleres de refuerzo.</p>';
  }

  function renderEmpty() {
    var container = document.getElementById("taller-content");
    if (!container) return;
    container.innerHTML = '<p class="taller-status">No tienes ningun taller de refuerzo asignado por ahora.</p>';
  }

  function workshopCardMarkup(workshop, mgr) {
    var status = mgr.deriveWorkshopStatus(workshop, Date.now());
    var label = mgr.WORKSHOP_STATUS_LABELS[status] || status;
    var canDeliver = status === "asignado";
    var fecha = workshop.fechaLimite ? formatFecha(workshop.fechaLimite) : "—";
    return (
      '<div class="taller-card">' +
      '<div class="taller-card__head">' +
        "<h3>" + escapeHtml(workshop.title || workshop.workshopKey) + "</h3>" +
        '<span class="taller-estado taller-estado--' + escapeHtml(status) + '">' + escapeHtml(label) + "</span>" +
      "</div>" +
      (workshop.motivo ? '<p class="taller-card__motivo">' + escapeHtml(workshop.motivo) + "</p>" : "") +
      '<dl class="taller-card__meta">' +
        "<dt>Fecha límite</dt><dd>" + escapeHtml(fecha) + (status === "vencido" ? " — <em>vencido</em>" : "") + "</dd>" +
      "</dl>" +
      '<div class="taller-card__actions">' +
        (workshop.fileUrl
          ? '<a class="c-btn c-btn--secondary" href="' + escapeHtml(workshop.fileUrl) + '" target="_blank" rel="noopener">📄 Descargar taller (PDF)</a>'
          : "") +
        (canDeliver
          ? '<button type="button" class="c-btn c-btn--primary taller-card__entregar" data-taller-id="' + escapeHtml(workshop.id) + '">📤 Entregar a Drive</button>'
          : "") +
      "</div>" +
      (status === "vencido"
        ? '<p class="taller-card__cerrado">La entrega de este taller está cerrada (fecha vencida). Pide al instructor que la reabra.</p>'
        : "") +
      "</div>"
    );
  }

  function renderList(workshops) {
    var container = document.getElementById("taller-content");
    if (!container) return;
    if (!workshops.length) { renderEmpty(); return; }
    var mgr = window.reinforcementWorkshops;
    var sorted = workshops.slice().sort(function (a, b) {
      return String(b.fechaAsignacion).localeCompare(String(a.fechaAsignacion));
    });
    container.innerHTML = sorted.map(function (w) { return workshopCardMarkup(w, mgr); }).join("");
    Array.prototype.forEach.call(container.querySelectorAll("[data-taller-id]"), function (btn) {
      btn.addEventListener("click", function () {
        var workshop = workshops.filter(function (w) { return w.id === btn.dataset.tallerId; })[0];
        if (workshop) mgr.deliverWorkshopToDrive(workshop);
      });
    });
  }

  async function init() {
    var session = getSession();
    fillMeta(session);

    if (!session || session.role !== "student" || !session.usernameKey) {
      renderNotStudent();
      return;
    }
    var mgr = window.reinforcementWorkshops;
    if (!mgr) { renderEmpty(); return; }
    var workshops = await mgr.syncStudentWorkshopsFromCloud(session.usernameKey);
    renderList(Array.isArray(workshops) ? workshops : []);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
