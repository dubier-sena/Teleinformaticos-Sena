/**
 * guide_deadline_summary.js
 *
 * Inyecta una tarjeta compacta al inicio de la pagina de guia con la lista
 * de actividades que tienen fecha limite y su estado (abierta / cerrada).
 *
 * Antes de este modulo, solo las guias que adoptaban activity_standard.js
 * mostraban el deadline al aprendiz, asi que la mayoria de aprendices NO
 * veian las fechas (solo el admin). Este modulo lo arregla de forma global,
 * sin tocar el script_guiaN.js de cada guia.
 *
 * Comportamiento:
 *   - Espera a window.activityDeadlineManager.ready().
 *   - Lee getActivitiesForGuide(currentPageFile) y filtra las que tienen
 *     policy con dueAt.
 *   - Si hay al menos una, inserta una <section> con la tabla al inicio
 *     del <main>. Si no hay <main>, usa el body.
 *   - No hace nada en pages admin/login/etc. (solo guias).
 *
 * Estilo: usa tokens de site_tokens.css y la clase .c-card de components.css.
 */

(function () {
  "use strict";

  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.__senaPortalDeadlineSummaryInstalled) return;
  window.__senaPortalDeadlineSummaryInstalled = true;

  function detectPageFile() {
    if (typeof window.__RUNTIME_PAGE_FILE__ === "string" && window.__RUNTIME_PAGE_FILE__) {
      return window.__RUNTIME_PAGE_FILE__;
    }
    var last = (window.location.pathname || "").split("/").pop() || "";
    return last;
  }

  function isGuidePageFile(name) {
    if (!name) return false;
    return /grupo-\d+[ab]-guia/.test(name) || /santa-barbara/.test(name) || name === "guia.html";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function findMount() {
    return (
      document.querySelector("[data-deadline-summary-mount]") ||
      document.querySelector("main.app-main") ||
      document.querySelector("main") ||
      document.querySelector(".app-main") ||
      null
    );
  }

  function waitForMount(timeoutMs) {
    return new Promise(function (resolve) {
      var existing = findMount();
      if (existing) {
        resolve(existing);
        return;
      }
      var resolved = false;
      var observer = new MutationObserver(function () {
        var mount = findMount();
        if (mount && !resolved) {
          resolved = true;
          observer.disconnect();
          resolve(mount);
        }
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
      window.setTimeout(function () {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(findMount() || document.body);
        }
      }, Math.max(1000, timeoutMs || 5000));
    });
  }

  function buildSection(rows) {
    var section = document.createElement("section");
    section.id = "guide-deadline-summary";
    section.setAttribute("aria-labelledby", "guide-deadline-summary-title");
    section.style.cssText = [
      "background:var(--surface-1, #fff)",
      "border:1px solid var(--border-soft, #d6e2da)",
      "border-radius:var(--radius-md, 18px)",
      "box-shadow:var(--shadow-sm, 0 6px 18px rgba(7,26,18,0.08))",
      "padding:var(--space-5, 20px) var(--space-6, 24px)",
      "margin:var(--space-5, 20px) auto",
      "max-width:var(--container-max, 1200px)",
      "color:var(--text-body, #1e2f24)",
    ].join(";");

    var listItems = rows
      .map(function (row) {
        var stateBg, stateColor, label;
        if (row.isClosed) {
          stateBg = "var(--color-danger-soft, #fde6e3)";
          stateColor = "var(--color-danger, #c0382b)";
          label = "Cerrada";
        } else if (row.isSoon) {
          stateBg = "var(--gold-light, #fff0c0)";
          stateColor = "#6e5300";
          label = "Proxima";
        } else {
          stateBg = "var(--brand-100, #e9f8ef)";
          stateColor = "var(--brand-700, #0a5c31)";
          label = "Abierta";
        }
        return (
          '<li style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-3, 12px);' +
          "padding:var(--space-3, 12px) 0;border-bottom:1px solid var(--border-soft, #d6e2da);\">" +
          '<span style="flex:1 1 240px;min-width:0;font-weight:600;color:var(--text-strong, #102117);">' +
          escapeHtml(row.label) +
          "</span>" +
          '<span style="color:var(--text-muted, #5f7468);font-variant-numeric:tabular-nums;">' +
          escapeHtml(row.formattedDate) +
          "</span>" +
          '<span style="display:inline-flex;align-items:center;padding:2px 12px;' +
          "border-radius:var(--radius-pill, 999px);font:600 12px/1.4 var(--font-body, sans-serif);" +
          "background:" + stateBg + ";color:" + stateColor + ';">' +
          label +
          "</span>" +
          "</li>"
        );
      })
      .join("");

    section.innerHTML =
      '<h2 id="guide-deadline-summary-title" style="margin:0 0 var(--space-4, 16px) 0;' +
      "font:700 var(--font-size-xl, 1.375rem)/1.2 var(--font-display, sans-serif);" +
      'color:var(--text-strong, #102117);">Fechas de entrega de esta guia</h2>' +
      '<p style="margin:0 0 var(--space-3, 12px) 0;color:var(--text-muted, #5f7468);font-size:var(--font-size-sm, 0.875rem);">' +
      "Horario en zona America/Bogota. Despues de la hora limite, la entrega se cierra automaticamente." +
      "</p>" +
      '<ul style="list-style:none;margin:0;padding:0;">' + listItems + "</ul>";

    return section;
  }

  async function init() {
    var pageFile = detectPageFile();
    if (!isGuidePageFile(pageFile)) return;

    var mgr = window.activityDeadlineManager;
    if (!mgr || typeof mgr.ready !== "function") return;
    try { await mgr.ready(); } catch (_) {}

    var activities = mgr.getActivitiesForGuide(pageFile);
    if (!Array.isArray(activities) || activities.length === 0) return;

    var nowMs = Date.now();
    var soonThresholdMs = 48 * 3600 * 1000; // 48 horas

    var rows = activities
      .map(function (act) {
        var policy = mgr.getPolicy(pageFile, act.id);
        if (!policy || !policy.dueAt) return null;
        var dueMs = Date.parse(policy.dueAt);
        if (!Number.isFinite(dueMs)) return null;
        return {
          label: act.label || act.id,
          dueAt: policy.dueAt,
          formattedDate: mgr.formatDueAt(policy.dueAt),
          isClosed: nowMs > dueMs,
          isSoon: !nowMs > dueMs && dueMs - nowMs < soonThresholdMs && dueMs > nowMs,
        };
      })
      .filter(Boolean)
      .sort(function (a, b) { return Date.parse(a.dueAt) - Date.parse(b.dueAt); });

    if (rows.length === 0) return;

    var mount = await waitForMount(5000);
    if (!mount) return;

    var existing = document.getElementById("guide-deadline-summary");
    if (existing) existing.remove();

    var section = buildSection(rows);
    if (mount.firstChild) {
      mount.insertBefore(section, mount.firstChild);
    } else {
      mount.appendChild(section);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      // Esperar un breve momento para que activity_deadlines termine la carga inicial
      window.setTimeout(init, 600);
    });
  } else {
    window.setTimeout(init, 600);
  }
})();
