/* admin_integridad.js
 * ----------------------------------------------------------------------------
 * Panel SOLO-ADMIN para revisar la evidencia de integridad académica capturada
 * en silencio por js/integrity_monitor.js (pegados, salidas de pestaña, tiempo
 * de escritura). Lee del canal Drive (window.driveDb) — sin cuota de Firestore.
 *
 * Exportación CSV SEPARADA: no toca la exportación de respuestas de la actividad.
 * ----------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var COLLECTION = "integrity_evidence";

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function msToText(ms) {
    ms = Math.max(0, Math.round(Number(ms) || 0));
    var s = Math.round(ms / 1000);
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + " min" + (rest ? " " + rest + " s" : "");
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
  }

  // Normaliza distintos formatos que pueda devolver driveDb.list().
  function normalizeRows(list) {
    if (!Array.isArray(list)) {
      if (list && typeof list === "object") list = Object.keys(list).map(function (k) { return list[k]; });
      else return [];
    }
    return list.map(function (item) {
      if (!item || typeof item !== "object") return null;
      if (item.usernameKey || item.pasteCount != null) return item;
      return item.data || item.payload || item.value || item.doc || item;
    }).filter(function (r) { return r && (r.usernameKey || r.fileName || r.learnerName); });
  }

  function riskBadges(r) {
    var out = [];
    var pasteChars = Number(r.pasteChars) || 0;
    var pasteCount = Number(r.pasteCount) || 0;
    var tabAwayCount = Number(r.tabAwayCount) || 0;
    var tabAwayMs = Number(r.tabAwayMs) || 0;
    var typingMs = Number(r.typingMs) || 0;
    if (pasteCount >= 3 || pasteChars >= 400) out.push({ t: "Pegado alto", c: "danger" });
    if (tabAwayCount >= 3 || tabAwayMs >= 120000) out.push({ t: "Muchas salidas", c: "warn" });
    if (pasteChars > 200 && typingMs < 30000) out.push({ t: "Poca escritura", c: "warn" });
    if (!out.length) out.push({ t: "Sin alertas", c: "ok" });
    return out;
  }

  var _rows = [];

  function render(rows) {
    var tbody = $("ev-rows");
    var empty = $("ev-empty");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!rows.length) {
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    rows.forEach(function (r) {
      var badges = riskBadges(r).map(function (b) {
        return '<span class="ev-badge ev-badge--' + b.c + '">' + esc(b.t) + "</span>";
      }).join(" ");
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><strong>" + esc(r.learnerName || r.usernameKey) + "</strong><br><small>" + esc(r.usernameKey) + "</small></td>" +
        "<td>" + esc(r.ficha || "—") + "<br><small>" + esc(r.grupo || "") + "</small></td>" +
        "<td>" + esc((r.guideTitle || r.fileName || "—")).slice(0, 60) + "</td>" +
        "<td class='ev-num'>" + esc(r.pasteCount || 0) + "<br><small>" + esc(r.pasteChars || 0) + " car.</small></td>" +
        "<td class='ev-num'>" + esc(r.tabAwayCount || 0) + "<br><small>" + esc(msToText(r.tabAwayMs)) + "</small></td>" +
        "<td class='ev-num'>" + esc(msToText(r.typingMs)) + "</td>" +
        "<td>" + badges + "</td>" +
        "<td><small>" + esc(fmtDate(r.updatedAt)) + "</small></td>";
      tbody.appendChild(tr);
    });
  }

  function applyFilter() {
    var q = ($("ev-search") ? $("ev-search").value : "").trim().toLowerCase();
    if (!q) { render(_rows); return; }
    render(_rows.filter(function (r) {
      return [r.learnerName, r.usernameKey, r.ficha, r.grupo, r.guideTitle, r.fileName]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    }));
  }

  function toCsv(rows) {
    var head = ["Aprendiz", "Usuario", "Ficha", "Grupo", "Guia", "Pegados", "CaracteresPegados",
      "CambiosPestana", "TiempoFuera_seg", "TiempoEscritura_seg", "Alertas", "Actualizado"];
    function cell(v) {
      var s = String(v == null ? "" : v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var lines = [head.join(",")];
    rows.forEach(function (r) {
      lines.push([
        cell(r.learnerName || ""), cell(r.usernameKey || ""), cell(r.ficha || ""), cell(r.grupo || ""),
        cell(r.guideTitle || r.fileName || ""), cell(r.pasteCount || 0), cell(r.pasteChars || 0),
        cell(r.tabAwayCount || 0), cell(Math.round((Number(r.tabAwayMs) || 0) / 1000)),
        cell(Math.round((Number(r.typingMs) || 0) / 1000)),
        cell(riskBadges(r).map(function (b) { return b.t; }).join(" / ")),
        cell(fmtDate(r.updatedAt)),
      ].join(","));
    });
    return "﻿" + lines.join("\r\n"); // BOM para Excel
  }

  function exportCsv() {
    var rows = _rows;
    if (!rows.length) { window.portalAlert("No hay evidencia para exportar.", { type: "warning" }); return; }
    var blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "evidencia_integridad_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  async function load() {
    var status = $("ev-status");
    var d = window.driveDb;
    if (!d || typeof d.list !== "function") {
      if (status) status.textContent = "El canal Drive no está disponible en esta página.";
      return;
    }
    if (status) status.textContent = "Cargando evidencia desde Drive…";
    try {
      var list = await d.list(COLLECTION);
      _rows = normalizeRows(list).sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
      });
      if (status) status.textContent = _rows.length + " registro(s) de integridad.";
      render(_rows);
    } catch (e) {
      if (status) status.textContent = "No se pudo cargar la evidencia (Drive). Intenta recargar.";
      _rows = [];
      render(_rows);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pa = window.portalAuth;
    // Verificación de acceso admin (redirige si no es admin, salvo file:// para previsualizar).
    if (pa && typeof pa.requireAdminAccess === "function") {
      var ok = pa.requireAdminAccess("panel-evidencias-integridad.html", { redirectUrl: "index.html" });
      if (ok === false) return;
    }
    var btn = $("ev-export");
    if (btn) btn.addEventListener("click", exportCsv);
    var reload = $("ev-reload");
    if (reload) reload.addEventListener("click", load);
    var search = $("ev-search");
    if (search) search.addEventListener("input", applyFilter);
    load();
  });
})();
