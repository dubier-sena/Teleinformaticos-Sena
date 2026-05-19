/**
 * student_calendar.js — Vista "Proximas clases" para el aprendiz.
 *
 * Lee la doc canonica `calendario_2026_admin` desde `sena_portal_calendar`
 * (publicada por el admin desde calendario-academico-2026.html) y combina los
 * overrides con los registros estaticos cargados desde
 * `data/calendario_2026_records.js`. Filtra por institucion + grupo del
 * aprendiz autenticado y muestra solo fechas desde hoy en adelante.
 *
 * Requisitos previos en la pagina:
 *   - portal_auth.js   (window.portalAuth)
 *   - firebase_auth_bridge.js  (auth Firebase activa)
 *   - firebase_db.js   (window._firebaseDb.cloudGetCalendar)
 *   - data/calendario_2026_records.js  (window.CALENDAR_2026_RECORDS)
 */

(function () {
  "use strict";

  var FIREBASE_CALENDAR_DOC = "calendario_2026_admin";
  var SHORT_INST = {
    "Institucion Educativa Jhon F. Kennedy": "I.E. Jhon F. Kennedy",
    "Institucion Educativa Santa Barbara":   "I.E. Santa Bárbara",
  };
  var DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // ───── Helpers ────────────────────────────────────────────────────────────
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function todayKey() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, "0");
    var d = String(now.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseFecha(fecha) {
    if (!fecha || typeof fecha !== "string") return null;
    var parts = fecha.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatFechaLarga(fecha) {
    var d = parseFecha(fecha);
    if (!d) return fecha || "";
    var dia = DAY_NAMES[d.getDay()];
    var mes = MONTH_NAMES[d.getMonth()];
    return dia + ", " + d.getDate() + " de " + mes + " de " + d.getFullYear();
  }

  function horarioStartMinutes(horario) {
    var label = String(horario || "");
    var match = label.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    if (!match) return 9999;
    var hour = Number(match[1]) % 12;
    if (match[3] && match[3].toLowerCase() === "pm") hour += 12;
    return hour * 60 + Number(match[2]);
  }

  function normalizeStateMap(rawState) {
    if (!rawState || typeof rawState !== "object") return {};
    // Si la doc viene con { state: {...} } usar ese sub-objeto.
    if (rawState.state && typeof rawState.state === "object" && !Array.isArray(rawState.state)) {
      return rawState.state;
    }
    return rawState;
  }

  function unwrapCalendarSnapshot(doc) {
    if (!doc || typeof doc !== "object") return null;
    // Estructura tipica: { calendarId, version, updatedAt, updatedBy, state: {...} }
    if (doc.state && typeof doc.state === "object") return doc;
    // Fallback: el doc completo es el state (legacy)
    return { state: doc };
  }

  function getStudentContext() {
    var auth = window.portalAuth;
    if (!auth || typeof auth.getCurrentSession !== "function") return null;
    var session = auth.getCurrentSession();
    if (!session) return null;

    if (session.role === "admin") {
      var fallbackInst = localStorage.getItem("sena_inst") || "Institucion Educativa Jhon F. Kennedy";
      var fallbackGrupo = localStorage.getItem("sena_grupo") || "10A";
      var fallbackFicha = localStorage.getItem("sena_ficha") || "";
      return {
        role: "admin",
        inst: fallbackInst,
        grupo: fallbackGrupo,
        ficha: fallbackFicha,
        learnerName: session.user && session.user.fullName ? session.user.fullName : "Administrador",
      };
    }

    if (session.role !== "student" || !session.user) return null;

    var info = (typeof auth.getFichaInfo === "function") ? auth.getFichaInfo(session.user.ficha) : null;
    var inst = (info && info.inst) || "";
    var grupo = (info && info.grupo) || "";
    if (!inst || !grupo) return null;

    return {
      role: "student",
      inst: inst,
      grupo: grupo,
      ficha: session.user.ficha,
      learnerName: session.user.fullName || session.user.username || "Aprendiz",
    };
  }

  function shortInstOf(instLong) {
    return SHORT_INST[instLong] || instLong;
  }

  function recordMatchesStudent(record, context) {
    if (!record || record.tipo !== "CLASE") return false;
    var targetInst = shortInstOf(context.inst);
    var recordInst = String(record.colegio || "");
    if (recordInst !== targetInst) return false;
    var recordGrado = String(record.grado || "").trim().toUpperCase();
    var targetGrado = String(context.grupo || "").trim().toUpperCase();
    if (!recordGrado || !targetGrado) return false;
    return recordGrado === targetGrado;
  }

  function applyOverride(record, overrideMap) {
    var override = overrideMap[record.id] || {};
    var merged = {
      id: record.id,
      fecha: record.fecha,
      dia: record.dia,
      tipo: record.tipo,
      colegio: override.colegio || record.colegio,
      grado: override.grado || record.grado,
      horario: override.horario || record.horario,
      estado: override.estado || record.defE || "Activa",
      obs: (override.obs === "" || override.obs == null) ? (record.defO || "") : override.obs,
      tema: (override.act && override.act.nombre) ? String(override.act.nombre) : "",
      temaFecha: (override.act && override.act.fecha) ? String(override.act.fecha) : "",
    };
    return merged;
  }

  function deriveStatusBadge(merged, todayStr) {
    var estado = String(merged.estado || "").toLowerCase();
    if (estado === "cancelada")   return { label: "Cancelada",   className: "status status--cancelada" };
    if (estado === "recuperada")  return { label: "Reprogramada", className: "status status--reprogramada" };
    if (merged.fecha === todayStr) return { label: "Hoy", className: "status status--hoy" };
    return { label: "Próxima", className: "status status--proxima" };
  }

  function splitHorarioSlots(horario) {
    if (!horario || horario === "—") return [];
    return String(horario).split(/\s*(?:\/|;|\r?\n)+\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function formatHorarioHtml(horario) {
    var slots = splitHorarioSlots(horario);
    if (!slots.length) return '<span class="hor-empty">Sin horario</span>';
    return slots.map(function (slot) { return '<span class="hor-slot">' + escapeHtml(slot) + "</span>"; }).join("");
  }

  // ───── Render ─────────────────────────────────────────────────────────────
  function renderCards(merged, todayStr, context, rootEl) {
    if (!merged.length) {
      rootEl.innerHTML =
        '<div class="empty-state">' +
        '<h3>Sin clases próximas</h3>' +
        '<p>No hay clases programadas próximamente para tu ficha o grupo.</p>' +
        "</div>";
      return;
    }

    var html = merged.map(function (m, index) {
      var status = deriveStatusBadge(m, todayStr);
      var fechaLarga = formatFechaLarga(m.fecha);
      var primero = index === 0 && status.label !== "Hoy";
      var firstTag = primero ? '<span class="tag tag--proxima-clase">Próxima clase</span>' : "";
      var temaBlock = "";
      if (m.tema) {
        var temaFechaTxt = m.temaFecha ? ' <span class="tema-fecha">(entrega: ' + escapeHtml(m.temaFecha) + ")</span>" : "";
        temaBlock = '<div class="row row--tema"><span class="row-key">Tema/actividad</span><span class="row-val">' + escapeHtml(m.tema) + temaFechaTxt + "</span></div>";
      }
      var obsBlock = m.obs
        ? '<div class="row row--obs"><span class="row-key">Observación</span><span class="row-val">' + escapeHtml(m.obs) + "</span></div>"
        : "";

      return (
        '<article class="class-card" data-status="' + escapeHtml(status.label) + '">' +
          '<header class="class-card__head">' +
            '<div class="class-card__date">' +
              '<span class="fecha-larga">' + escapeHtml(fechaLarga) + "</span>" +
              firstTag +
            "</div>" +
            '<span class="' + status.className + '">' + escapeHtml(status.label) + "</span>" +
          "</header>" +
          '<div class="class-card__body">' +
            '<div class="row row--hor"><span class="row-key">Horario</span><span class="row-val">' + formatHorarioHtml(m.horario) + "</span></div>" +
            '<div class="row"><span class="row-key">Institución</span><span class="row-val">' + escapeHtml(m.colegio) + "</span></div>" +
            '<div class="row"><span class="row-key">Grupo / Ficha</span><span class="row-val">' + escapeHtml(m.grado) + " · Ficha " + escapeHtml(context.ficha || "—") + "</span></div>" +
            temaBlock +
            obsBlock +
          "</div>" +
        "</article>"
      );
    }).join("");

    rootEl.innerHTML = html;
  }

  function renderMessage(rootEl, title, body, kind) {
    var cls = "msg " + (kind === "error" ? "msg--error" : kind === "warn" ? "msg--warn" : "msg--info");
    rootEl.innerHTML =
      '<div class="' + cls + '">' +
      "<h3>" + escapeHtml(title) + "</h3>" +
      "<p>" + escapeHtml(body) + "</p>" +
      "</div>";
  }

  function renderHeaderMeta(context) {
    var elInst = document.getElementById("sc-meta-inst");
    var elGrupo = document.getElementById("sc-meta-grupo");
    var elFicha = document.getElementById("sc-meta-ficha");
    var elName = document.getElementById("sc-meta-name");
    if (elInst) elInst.textContent = shortInstOf(context.inst);
    if (elGrupo) elGrupo.textContent = context.grupo;
    if (elFicha) elFicha.textContent = context.ficha || "—";
    if (elName) elName.textContent = context.learnerName || "";
  }

  // ───── Carga principal ────────────────────────────────────────────────────
  async function loadAndRender() {
    var rootEl = document.getElementById("sc-list");
    var statusEl = document.getElementById("sc-status");
    if (!rootEl) return;

    var context = getStudentContext();
    if (!context) {
      renderMessage(
        rootEl,
        "Sesión no válida",
        "No fue posible identificar tu ficha o grupo. Verifica tu sesión o consulta con el instructor.",
        "warn"
      );
      return;
    }
    renderHeaderMeta(context);

    if (statusEl) statusEl.textContent = "Cargando…";

    var records = Array.isArray(window.CALENDAR_2026_RECORDS) ? window.CALENDAR_2026_RECORDS : [];
    if (!records.length) {
      renderMessage(
        rootEl,
        "Datos no disponibles",
        "No se pudo cargar el listado de fechas del programa. Intenta nuevamente más tarde.",
        "error"
      );
      if (statusEl) statusEl.textContent = "";
      return;
    }

    var overrideMap = {};
    var snapshotMeta = null;
    try {
      var db = window._firebaseDb;
      if (db && typeof db.cloudGetCalendar === "function") {
        var snapshot = await db.cloudGetCalendar(FIREBASE_CALENDAR_DOC);
        var unwrapped = unwrapCalendarSnapshot(snapshot);
        if (unwrapped) {
          overrideMap = normalizeStateMap(unwrapped) || {};
          snapshotMeta = {
            updatedAt: snapshot && snapshot.updatedAt ? snapshot.updatedAt : "",
            updatedBy: snapshot && snapshot.updatedBy ? snapshot.updatedBy : "",
          };
        }
      }
    } catch (error) {
      console.warn("[student_calendar] Error cargando overrides desde Firebase:", error && error.message ? error.message : error);
    }

    var today = todayKey();
    var matched = records
      .filter(function (record) { return recordMatchesStudent(record, context); })
      .filter(function (record) { return record.fecha >= today; })
      .map(function (record) { return applyOverride(record, overrideMap); })
      .sort(function (a, b) {
        var dateCmp = String(a.fecha).localeCompare(String(b.fecha));
        if (dateCmp) return dateCmp;
        return horarioStartMinutes(a.horario) - horarioStartMinutes(b.horario);
      });

    renderCards(matched, today, context, rootEl);

    if (statusEl) {
      if (matched.length) {
        var metaText = matched.length + (matched.length === 1 ? " clase" : " clases");
        if (snapshotMeta && snapshotMeta.updatedAt) {
          try {
            metaText += " · Actualizado " + new Date(snapshotMeta.updatedAt).toLocaleString("es-CO");
          } catch (e) {}
        }
        statusEl.textContent = metaText;
      } else {
        statusEl.textContent = "";
      }
    }
  }

  function bootstrap() {
    var btnReload = document.getElementById("sc-reload");
    if (btnReload) {
      btnReload.addEventListener("click", function () { loadAndRender(); });
    }
    loadAndRender();
  }

  window.studentCalendar = {
    load: loadAndRender,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
