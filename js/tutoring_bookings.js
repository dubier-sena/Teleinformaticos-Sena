/**
 * tutoring_bookings.js
 *
 * Sistema de reserva de tutorias virtuales para etapa productiva.
 *
 * Reglas:
 *  - Slots de 30 min entre 14:00 y 18:00 (8 slots por fecha).
 *  - Una reserva ocupa 1 slot (30 min) o 2 consecutivos (1 hora).
 *  - No cruce de horarios DENTRO del mismo grupo (ficha): si un companero
 *    ya tiene un slot, queda bloqueado.
 *  - Grupos distintos pueden compartir hora (cada grupo tiene su tutor).
 *  - 1 reserva por aprendiz por fecha (re-guardar = sobreescribir).
 *
 * Persistencia: Firestore (sena_portal_tutoring_bookings) via firebase_db.js.
 *
 * Uso:
 *  - En etapa-productiva-estudiante.html: el script se auto-inicializa
 *    cuando detecta #student-tutoring-dates-body, escucha clicks en las
 *    tarjetas de fecha y abre el modal de reserva.
 *  - En etapa-productiva-admin.html: el script se auto-inicializa cuando
 *    detecta #tutoring-admin-section y renderiza la tabla de reservas
 *    con filtros y opcion de borrar.
 */
(function () {
  "use strict";

  var SLOT_TIMES = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"];
  var SLOT_COUNT = SLOT_TIMES.length;
  var END_TIME = "18:00";
  var STYLE_ID = "tutoring-bookings-style";
  var MODAL_ID = "tutoring-booking-modal";
  var MONTH_NAMES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function getAuth() { return window.portalAuth || null; }
  function getFdb()  { return window._firebaseDb || null; }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getSession() {
    var auth = getAuth();
    return auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
  }

  function getStudentUser() {
    var session = getSession();
    if (!session || session.role !== "student" || !session.user) return null;
    return session.user;
  }

  function isAdmin() {
    var session = getSession();
    return Boolean(session && session.role === "admin");
  }

  function formatDateLong(isoDate) {
    if (!isoDate) return "";
    var parts = String(isoDate).split("-");
    if (parts.length !== 3) return isoDate;
    var year = parseInt(parts[0], 10);
    var monthIdx = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (Number.isNaN(year) || Number.isNaN(monthIdx) || Number.isNaN(day)) return isoDate;
    var monthName = MONTH_NAMES[monthIdx] || "";
    return day + " de " + monthName + " de " + year;
  }

  function todayIso() {
    return new Date().toLocaleDateString("en-CA");
  }

  // ─── Slot logic ─────────────────────────────────────────────────────────────
  function getSlotsForBooking(startTime, durationMinutes) {
    var startIdx = SLOT_TIMES.indexOf(startTime);
    if (startIdx < 0) return [];
    var slotCount = durationMinutes === 60 ? 2 : 1;
    if (startIdx + slotCount > SLOT_COUNT) return [];
    return SLOT_TIMES.slice(startIdx, startIdx + slotCount);
  }

  function computeEndTime(startTime, durationMinutes) {
    var slots = getSlotsForBooking(startTime, durationMinutes);
    if (!slots.length) return startTime;
    var lastIdx = SLOT_TIMES.indexOf(slots[slots.length - 1]);
    if (lastIdx < 0) return startTime;
    if (lastIdx + 1 < SLOT_COUNT) return SLOT_TIMES[lastIdx + 1];
    return END_TIME;
  }

  function getOccupiedSlots(bookings, excludeUsernameKey) {
    var occupied = {};
    bookings.forEach(function (b) {
      if (excludeUsernameKey && b.usernameKey === excludeUsernameKey) return;
      getSlotsForBooking(b.startTime, Number(b.durationMinutes) || 30).forEach(function (s) {
        occupied[s] = true;
      });
    });
    return occupied;
  }

  function getAvailableStartTimes(bookings, durationMinutes, currentUsernameKey) {
    var occupied = getOccupiedSlots(bookings, currentUsernameKey);
    var slotCount = durationMinutes === 60 ? 2 : 1;
    return SLOT_TIMES.filter(function (startTime, idx) {
      if (idx + slotCount > SLOT_COUNT) return false;
      for (var i = 0; i < slotCount; i += 1) {
        if (occupied[SLOT_TIMES[idx + i]]) return false;
      }
      return true;
    });
  }

  // ─── Calendario: fechas SENA futuras ───────────────────────────────────────
  function getUpcomingTutoringDates() {
    var records = window.CALENDAR_2026_RECORDS;
    if (!Array.isArray(records)) return [];
    var today = todayIso();
    return records
      .filter(function (r) {
        if (r.tipo !== "SENA") return false;
        if (String(r.defE || "").toLowerCase() === "cancelada") return false;
        return r.fecha >= today;
      })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  }

  function findRecordByDate(date) {
    var records = window.CALENDAR_2026_RECORDS;
    if (!Array.isArray(records)) return null;
    return records.find(function (r) { return r.tipo === "SENA" && r.fecha === date; }) || null;
  }

  // ─── Estilos (inyectados una sola vez) ─────────────────────────────────────
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".tutoring-date { cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }",
      ".tutoring-date:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); }",
      ".tutoring-date.tutoring-date--has-booking { background: #e8f5e9; border-color: #43a047; }",
      ".tutoring-date__booking { display: block; margin-top: 6px; font-size: 11px; font-weight: 700; color: #1b5e20; }",
      ".tutoring-modal { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }",
      ".tutoring-modal[hidden] { display: none; }",
      ".tutoring-modal__backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.5); }",
      ".tutoring-modal__panel { position: relative; background: #fff; border-radius: 12px; max-width: 480px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2); }",
      ".tutoring-modal__panel header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }",
      ".tutoring-modal__panel header h3 { margin: 0; font-size: 1.25rem; }",
      ".tutoring-modal__close { background: none; border: none; font-size: 1.6rem; cursor: pointer; line-height: 1; color: #64748b; }",
      ".tutoring-modal__close:hover { color: #0f172a; }",
      ".tutoring-modal__panel fieldset { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 0 0 12px; }",
      ".tutoring-modal__panel fieldset legend { padding: 0 6px; font-weight: 600; color: #334155; font-size: 0.9rem; }",
      ".tutoring-modal__panel fieldset label { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; cursor: pointer; }",
      ".tutoring-modal__panel > label { display: block; margin-bottom: 12px; font-weight: 600; color: #334155; }",
      ".tutoring-modal__panel select, .tutoring-modal__panel input[type=text] { display: block; width: 100%; margin-top: 6px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1rem; font-family: inherit; box-sizing: border-box; }",
      ".tutoring-modal__panel footer { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }",
      ".tutoring-modal__status { margin: 8px 0; padding: 8px 12px; border-radius: 6px; font-size: 0.9rem; min-height: 1.2em; }",
      ".tutoring-modal__status.is-error { background: #fee2e2; color: #991b1b; }",
      ".tutoring-modal__status.is-success { background: #dcfce7; color: #166534; }",
      ".tutoring-modal__status.is-info { background: #dbeafe; color: #1e3a8a; }",
      ".tutoring-modal__current { margin: 12px 0; padding: 12px; background: #f1f5f9; border-radius: 8px; font-size: 0.9rem; }",
      ".tutoring-modal__current strong { color: #0f172a; }",
      ".tutoring-modal__btn { padding: 10px 18px; border-radius: 8px; border: 1px solid transparent; font-size: 0.95rem; font-weight: 600; cursor: pointer; }",
      ".tutoring-modal__btn--primary { background: #16a34a; color: #fff; }",
      ".tutoring-modal__btn--primary:hover { background: #15803d; }",
      ".tutoring-modal__btn--primary:disabled { background: #94a3b8; cursor: not-allowed; }",
      ".tutoring-modal__btn--ghost { background: #fff; color: #475569; border-color: #cbd5e1; }",
      ".tutoring-modal__btn--ghost:hover { background: #f1f5f9; }",
      ".tutoring-modal__btn--danger { background: #fff; color: #dc2626; border-color: #fca5a5; }",
      ".tutoring-modal__btn--danger:hover { background: #fee2e2; }",
      ".tutoring-admin-table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.9rem; }",
      ".tutoring-admin-table th, .tutoring-admin-table td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }",
      ".tutoring-admin-table th { background: #f8fafc; font-weight: 600; color: #334155; }",
      ".tutoring-admin-table tr:nth-child(even) td { background: #f8fafc; }",
      ".tutoring-admin-toolbar { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; align-items: end; }",
      ".tutoring-admin-toolbar label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; color: #334155; font-size: 0.85rem; }",
      ".tutoring-admin-toolbar select, .tutoring-admin-toolbar input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; min-width: 180px; }",
      ".tutoring-admin-empty { padding: 24px; text-align: center; color: #64748b; }",
      // Grilla visual de slots
      ".tutoring-slots-label { font-weight: 600; color: #334155; margin: 0 0 8px; display: block; }",
      ".tutoring-slots-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }",
      "@media (max-width: 460px) { .tutoring-slots-grid { grid-template-columns: repeat(2, 1fr); } }",
      ".tutoring-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 9px 5px; border-radius: 10px; font-family: inherit; font-size: 0.78rem; text-align: center; border: 2px solid transparent; box-sizing: border-box; transition: transform 0.12s, border-color 0.12s; }",
      ".tutoring-slot__time { font-weight: 700; white-space: nowrap; }",
      ".tutoring-slot__badge { font-size: 0.7rem; font-weight: 700; padding: 2px 7px; border-radius: 999px; }",
      ".tutoring-slot--free { background: #f0fdf4; border-color: #86efac; color: #15803d; cursor: pointer; }",
      ".tutoring-slot--free:hover { background: #dcfce7; border-color: #4ade80; transform: translateY(-1px); }",
      ".tutoring-slot--free .tutoring-slot__badge { background: #dcfce7; color: #166534; }",
      ".tutoring-slot--occupied { background: #fef2f2; border-color: #fecaca; color: #991b1b; }",
      ".tutoring-slot--occupied .tutoring-slot__badge { background: #fee2e2; color: #b91c1c; }",
      ".tutoring-slot--selected { background: #15803d; border-color: #166534; color: #fff; cursor: pointer; }",
      ".tutoring-slot--selected:hover { background: #166534; }",
      ".tutoring-slot--selected .tutoring-slot__badge { background: rgba(255,255,255,0.2); color: #fff; }",
      ".tutoring-slot--selected-cont { background: #166534; border-color: #14532d; color: #bbf7d0; }",
      ".tutoring-slot--selected-cont .tutoring-slot__badge { background: rgba(255,255,255,0.12); color: #bbf7d0; }",
      ".tutoring-slot--unavailable { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; }",
      ".tutoring-slot--unavailable .tutoring-slot__badge { background: #f1f5f9; color: #94a3b8; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  // ─── Modal de reserva (estudiante) ─────────────────────────────────────────
  function buildModal() {
    if (document.getElementById(MODAL_ID)) return;
    var modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "tutoring-modal";
    modal.hidden = true;
    modal.innerHTML = [
      '<div class="tutoring-modal__backdrop" data-tutoring-close></div>',
      '<div class="tutoring-modal__panel" role="dialog" aria-modal="true" aria-labelledby="tutoring-modal-title">',
      '  <header>',
      '    <div>',
      '      <h3 id="tutoring-modal-title">Reservar tutoria virtual</h3>',
      '      <p id="tutoring-modal-date" style="margin:6px 0 0;color:#64748b;font-size:0.9rem;"></p>',
      '    </div>',
      '    <button type="button" class="tutoring-modal__close" data-tutoring-close aria-label="Cerrar">&times;</button>',
      '  </header>',
      '  <div id="tutoring-modal-current" class="tutoring-modal__current" hidden></div>',
      '  <form id="tutoring-modal-form">',
      '    <fieldset>',
      '      <legend>Duracion</legend>',
      '      <label><input type="radio" name="duration" value="30" checked> 30 minutos</label>',
      '      <label><input type="radio" name="duration" value="60"> 1 hora</label>',
      '    </fieldset>',
      '    <div>',
      '      <p class="tutoring-slots-label">Hora de inicio</p>',
      '      <div id="tutoring-slots-grid" class="tutoring-slots-grid"></div>',
      '      <input type="hidden" id="tutoring-modal-start-time">',
      '    </div>',
      '    <label>',
      '      Tema (opcional)',
      '      <input type="text" id="tutoring-modal-topic" maxlength="120" placeholder="Ej: revisar avance del proyecto">',
      '    </label>',
      '    <div id="tutoring-modal-status" class="tutoring-modal__status"></div>',
      '    <footer>',
      '      <button type="button" class="tutoring-modal__btn tutoring-modal__btn--danger" id="tutoring-modal-cancel-btn" hidden>Cancelar mi reserva</button>',
      '      <button type="button" class="tutoring-modal__btn tutoring-modal__btn--ghost" data-tutoring-close>Cerrar</button>',
      '      <button type="submit" class="tutoring-modal__btn tutoring-modal__btn--primary" id="tutoring-modal-submit">Confirmar reserva</button>',
      '    </footer>',
      '  </form>',
      '</div>',
    ].join("");
    document.body.appendChild(modal);

    modal.addEventListener("click", function (event) {
      if (event.target.closest("[data-tutoring-close]")) {
        closeModal();
      }
    });
    modal.querySelector("#tutoring-modal-form").addEventListener("submit", handleSubmit);
    modal.querySelectorAll('input[name="duration"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        selectedStartTime = "";
        renderSlotGrid();
      });
    });
    document.getElementById("tutoring-modal-cancel-btn").addEventListener("click", handleCancelExisting);
  }

  var modalState = {
    date: "",
    record: null,
    user: null,
    bookings: [],
    existingBooking: null,
  };

  var selectedStartTime = "";

  function openModal(date) {
    var user = getStudentUser();
    if (!user) {
      window.alert("Debes iniciar sesion como aprendiz para reservar tutorias.");
      return;
    }
    var record = findRecordByDate(date);
    if (!record) {
      window.alert("Esta fecha no esta disponible para reservar.");
      return;
    }

    modalState.date = date;
    modalState.record = record;
    modalState.user = user;

    var modal = document.getElementById(MODAL_ID);
    var title = document.getElementById("tutoring-modal-date");
    title.textContent = formatDateLong(date) + (record.defE ? " - " + record.defE : "");

    setStatus("info", "Consultando disponibilidad...");
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    loadBookingsAndPopulate();
  }

  function closeModal() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    modalState = { date: "", record: null, user: null, bookings: [], existingBooking: null };
    selectedStartTime = "";
    setStatus("", "");
  }

  function setStatus(kind, message) {
    var el = document.getElementById("tutoring-modal-status");
    if (!el) return;
    el.className = "tutoring-modal__status" + (kind ? " is-" + kind : "");
    el.textContent = message || "";
  }

  async function loadBookingsAndPopulate() {
    var fdb = getFdb();
    if (!fdb || typeof fdb.cloudListTutoringBookingsForDate !== "function") {
      setStatus("error", "El servicio de reservas no esta disponible.");
      return;
    }
    try {
      var ok = typeof fdb.checkAvailability === "function" ? await fdb.checkAvailability() : true;
      if (!ok) {
        setStatus("error", "Sin conexion a la base de reservas. Intenta de nuevo en un momento.");
        return;
      }
      var bookings = await fdb.cloudListTutoringBookingsForDate(modalState.date, modalState.user.ficha);
      modalState.bookings = bookings || [];
      modalState.existingBooking = modalState.bookings.find(function (b) {
        return String(b.usernameKey || "").toLowerCase() === String(modalState.user.usernameKey || "").toLowerCase();
      }) || null;
      renderModalContent();
      setStatus("", "");
    } catch (error) {
      setStatus("error", "No fue posible cargar las reservas: " + (error && error.message ? error.message : error));
    }
  }

  function renderModalContent() {
    var current = document.getElementById("tutoring-modal-current");
    var cancelBtn = document.getElementById("tutoring-modal-cancel-btn");
    var submitBtn = document.getElementById("tutoring-modal-submit");

    if (modalState.existingBooking) {
      var b = modalState.existingBooking;
      current.hidden = false;
      current.innerHTML =
        "Ya tienes una reserva en esta fecha: <strong>" +
        escapeHtml(b.startTime + " - " + b.endTime) +
        "</strong> (" + escapeHtml(String(b.durationMinutes) + " min") + ")" +
        (b.topic ? "<br>Tema: " + escapeHtml(b.topic) : "");
      cancelBtn.hidden = false;
      submitBtn.textContent = "Cambiar mi reserva";

      // Pre-rellenar el form con la reserva existente
      var radio = document.querySelector('#tutoring-modal-form input[name="duration"][value="' + b.durationMinutes + '"]');
      if (radio) radio.checked = true;
      selectedStartTime = b.startTime || "";
      var topicEl = document.getElementById("tutoring-modal-topic");
      if (topicEl) topicEl.value = b.topic || "";
    } else {
      current.hidden = true;
      cancelBtn.hidden = true;
      submitBtn.textContent = "Confirmar reserva";
    }

    renderSlotGrid();
  }

  function renderSlotGrid() {
    var radio = document.querySelector('#tutoring-modal-form input[name="duration"]:checked');
    var duration = radio ? Number(radio.value) || 30 : 30;
    var slotCount = duration === 60 ? 2 : 1;

    var occupied = getOccupiedSlots(
      modalState.bookings,
      modalState.user ? modalState.user.usernameKey : ""
    );

    // Slots válidos como hora de inicio para la duración elegida
    var validStarts = SLOT_TIMES.filter(function (t, idx) {
      if (idx + slotCount > SLOT_COUNT) return false;
      for (var i = 0; i < slotCount; i++) {
        if (occupied[SLOT_TIMES[idx + i]]) return false;
      }
      return true;
    });

    // Si la selección actual ya no es válida, limpiarla
    if (selectedStartTime && validStarts.indexOf(selectedStartTime) < 0) {
      selectedStartTime = "";
    }

    var grid = document.getElementById("tutoring-slots-grid");
    var hiddenInput = document.getElementById("tutoring-modal-start-time");
    if (!grid) return;

    var html = SLOT_TIMES.map(function (slotTime, idx) {
      var end30 = idx + 1 < SLOT_COUNT ? SLOT_TIMES[idx + 1] : END_TIME;
      var isOccupied = !!occupied[slotTime];
      var isValidStart = validStarts.indexOf(slotTime) >= 0;

      var selIdx = selectedStartTime ? SLOT_TIMES.indexOf(selectedStartTime) : -1;
      var isSelectedStart = selIdx >= 0 && idx === selIdx;
      var isSelectedCont  = selIdx >= 0 && duration === 60 && idx === selIdx + 1;

      if (isOccupied) {
        return '<div class="tutoring-slot tutoring-slot--occupied">' +
          '<span class="tutoring-slot__time">' + escapeHtml(slotTime + " – " + end30) + '</span>' +
          '<span class="tutoring-slot__badge">Ocupado</span>' +
          '</div>';
      }

      if (isSelectedStart) {
        var selEnd = computeEndTime(selectedStartTime, duration);
        return '<button type="button" class="tutoring-slot tutoring-slot--selected" data-slot-start="' + escapeHtml(slotTime) + '">' +
          '<span class="tutoring-slot__time">' + escapeHtml(slotTime + " – " + selEnd) + '</span>' +
          '<span class="tutoring-slot__badge">✓ Seleccionada</span>' +
          '</button>';
      }

      if (isSelectedCont) {
        return '<div class="tutoring-slot tutoring-slot--selected-cont">' +
          '<span class="tutoring-slot__time">' + escapeHtml(slotTime + " – " + end30) + '</span>' +
          '<span class="tutoring-slot__badge">+ incluida</span>' +
          '</div>';
      }

      if (isValidStart) {
        var freeEnd = computeEndTime(slotTime, duration);
        return '<button type="button" class="tutoring-slot tutoring-slot--free" data-slot-start="' + escapeHtml(slotTime) + '">' +
          '<span class="tutoring-slot__time">' + escapeHtml(slotTime + " – " + freeEnd) + '</span>' +
          '<span class="tutoring-slot__badge">Libre</span>' +
          '</button>';
      }

      // Franja libre pero no usable como inicio (p. ej. último slot en modo 1h,
      // o el slot siguiente está ocupado y bloquea la 2ª mitad de 1h)
      return '<div class="tutoring-slot tutoring-slot--unavailable">' +
        '<span class="tutoring-slot__time">' + escapeHtml(slotTime + " – " + end30) + '</span>' +
        '<span class="tutoring-slot__badge">No disponible</span>' +
        '</div>';
    }).join("");

    grid.innerHTML = html;

    if (hiddenInput) hiddenInput.value = selectedStartTime;

    grid.querySelectorAll(".tutoring-slot--free, .tutoring-slot--selected").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedStartTime = btn.getAttribute("data-slot-start") || "";
        renderSlotGrid();
      });
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!modalState.user || !modalState.record) return;

    var radio = document.querySelector('#tutoring-modal-form input[name="duration"]:checked');
    var duration = radio ? Number(radio.value) || 30 : 30;
    var startTime = document.getElementById("tutoring-modal-start-time").value;
    var topic = String(document.getElementById("tutoring-modal-topic").value || "").trim();

    if (!startTime) {
      setStatus("error", "Selecciona una hora de inicio.");
      return;
    }

    // Re-verificar conflicto justo antes de guardar (defensa contra carrera)
    var occupied = getOccupiedSlots(modalState.bookings, modalState.user.usernameKey);
    var requestedSlots = getSlotsForBooking(startTime, duration);
    var clash = requestedSlots.find(function (s) { return occupied[s]; });
    if (clash) {
      setStatus("error", "Otro estudiante de tu grupo acaba de reservar el slot " + clash + ". Recarga e intenta otra hora.");
      return;
    }

    var endTime = computeEndTime(startTime, duration);
    var nowIso = new Date().toISOString();
    var booking = {
      date: modalState.date,
      ficha: String(modalState.user.ficha || ""),
      grupo: String(modalState.user.grupo || ""),
      inst: String(modalState.user.inst || ""),
      startTime: startTime,
      endTime: endTime,
      durationMinutes: duration,
      usernameKey: String(modalState.user.usernameKey || "").toLowerCase(),
      studentName: String(modalState.user.fullName || ""),
      topic: topic,
      createdAt: modalState.existingBooking ? (modalState.existingBooking.createdAt || nowIso) : nowIso,
      updatedAt: nowIso,
    };

    setStatus("info", "Guardando reserva...");
    try {
      var fdb = getFdb();
      var saved = await fdb.cloudSaveTutoringBooking(booking);
      if (!saved) {
        setStatus("error", "No fue posible guardar la reserva. Intenta de nuevo.");
        return;
      }
      setStatus("success", "Reserva confirmada. " + startTime + " - " + endTime);
      // Refrescar
      modalState.existingBooking = booking;
      modalState.bookings = (modalState.bookings.filter(function (b) {
        return String(b.usernameKey || "").toLowerCase() !== booking.usernameKey;
      })).concat([booking]);
      renderModalContent();
      refreshDateCardsBookingBadge();
    } catch (error) {
      setStatus("error", "Error: " + (error && error.message ? error.message : error));
    }
  }

  async function handleCancelExisting() {
    if (!modalState.existingBooking) return;
    if (!window.confirm("Seguro que deseas cancelar tu reserva de " + modalState.existingBooking.startTime + "?")) {
      return;
    }
    setStatus("info", "Cancelando...");
    try {
      var fdb = getFdb();
      var deleted = await fdb.cloudDeleteTutoringBooking(
        modalState.date,
        modalState.user.ficha,
        modalState.user.usernameKey
      );
      if (!deleted) {
        setStatus("error", "No fue posible cancelar. Intenta otra vez.");
        return;
      }
      setStatus("success", "Reserva cancelada.");
      modalState.bookings = modalState.bookings.filter(function (b) {
        return String(b.usernameKey || "").toLowerCase() !== String(modalState.user.usernameKey || "").toLowerCase();
      });
      modalState.existingBooking = null;
      renderModalContent();
      refreshDateCardsBookingBadge();
    } catch (error) {
      setStatus("error", "Error: " + (error && error.message ? error.message : error));
    }
  }

  // ─── Cache de reservas del aprendiz para mostrar en las tarjetas ───────────
  var studentBookingsCache = {};
  var studentBookingsLoaded = false;

  async function loadStudentBookingsCache() {
    var user = getStudentUser();
    if (!user) return;
    var fdb = getFdb();
    if (!fdb || typeof fdb.cloudListTutoringBookings !== "function") return;
    try {
      var all = await fdb.cloudListTutoringBookings();
      studentBookingsCache = {};
      all.forEach(function (b) {
        if (String(b.usernameKey || "").toLowerCase() === String(user.usernameKey || "").toLowerCase()) {
          studentBookingsCache[b.date] = b;
        }
      });
      studentBookingsLoaded = true;
      refreshDateCardsBookingBadge();
    } catch (error) {
      // Silencioso: las tarjetas siguen funcionando, solo sin badge.
    }
  }

  function refreshDateCardsBookingBadge() {
    var container = document.getElementById("student-tutoring-dates-body");
    if (!container) return;
    var cards = container.querySelectorAll(".tutoring-date[data-tutoring-date]");
    cards.forEach(function (card) {
      var date = card.getAttribute("data-tutoring-date");
      var existing = card.querySelector(".tutoring-date__booking");
      if (existing) existing.remove();
      card.classList.remove("tutoring-date--has-booking");
      var booking = studentBookingsCache[date];
      if (booking) {
        card.classList.add("tutoring-date--has-booking");
        var label = document.createElement("span");
        label.className = "tutoring-date__booking";
        label.textContent = "Reservado " + booking.startTime + "-" + booking.endTime;
        card.appendChild(label);
      }
    });
  }

  // ─── Wiring estudiante: hacer las tarjetas clickables ──────────────────────
  function attachClicksToDateCards() {
    var container = document.getElementById("student-tutoring-dates-body");
    if (!container) return;
    var cards = container.querySelectorAll(".tutoring-date");
    cards.forEach(function (card, idx) {
      if (card.hasAttribute("data-tutoring-bound")) return;
      // Determinar la fecha del card a partir del orden y los datos disponibles.
      var date = card.getAttribute("data-tutoring-date");
      if (!date) {
        var dates = getUpcomingTutoringDates();
        if (dates[idx]) {
          date = dates[idx].fecha;
          card.setAttribute("data-tutoring-date", date);
        }
      }
      if (!date) return;

      // Excluir cards en estado past/cancelled
      if (card.classList.contains("tutoring-date--past") ||
          card.classList.contains("tutoring-date--cancelled")) {
        card.style.cursor = "default";
        card.setAttribute("data-tutoring-bound", "true");
        return;
      }

      card.setAttribute("data-tutoring-bound", "true");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Reservar tutoria del " + formatDateLong(date));
      card.addEventListener("click", function () { openModal(date); });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModal(date);
        }
      });
    });
    refreshDateCardsBookingBadge();
  }

  function initStudent() {
    if (!getStudentUser()) {
      // Si entra el admin como vista previa, no hacemos nada en este modulo;
      // el admin tiene su seccion separada.
      return;
    }
    ensureStyles();
    buildModal();

    var container = document.getElementById("student-tutoring-dates-body");
    if (!container) return;

    // Las tarjetas las renderiza productive_stage_student.js de forma asincrona.
    // Observamos cambios para enganchar el listener cuando aparezcan.
    var observer = new MutationObserver(function () { attachClicksToDateCards(); });
    observer.observe(container, { childList: true, subtree: true });

    // Intento inicial por si ya estan renderizadas.
    attachClicksToDateCards();

    // Cargar reservas del aprendiz para mostrar badges.
    setTimeout(loadStudentBookingsCache, 800);
  }

  // ─── Admin: tabla de reservas con filtros ──────────────────────────────────
  var adminState = {
    bookings: [],
    filterDate: "",
    filterFicha: "",
  };

  function buildAdminUI() {
    var section = document.getElementById("tutoring-admin-section");
    if (!section) return;
    section.innerHTML = [
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">',
      '  <div>',
      '    <h2>Reservas de tutoria virtual</h2>',
      '    <p>Consulta las tutorias agendadas por los aprendices. Slots de 14:00 a 18:00 los dias SENA.</p>',
      '  </div>',
      '  <button type="button" class="btn secondary" id="tutoring-admin-refresh">Actualizar</button>',
      '</div>',
      '<div class="tutoring-admin-toolbar">',
      '  <label>Fecha',
      '    <select id="tutoring-admin-filter-date"><option value="">Todas</option></select>',
      '  </label>',
      '  <label>Ficha',
      '    <select id="tutoring-admin-filter-ficha"><option value="">Todas</option></select>',
      '  </label>',
      '  <label>Buscar',
      '    <input type="search" id="tutoring-admin-filter-query" placeholder="Aprendiz, tema...">',
      '  </label>',
      '</div>',
      '<div id="tutoring-admin-table-wrap"><p class="tutoring-admin-empty">Cargando reservas...</p></div>',
    ].join("");
    document.getElementById("tutoring-admin-refresh").addEventListener("click", loadAdminBookings);
    document.getElementById("tutoring-admin-filter-date").addEventListener("change", renderAdminTable);
    document.getElementById("tutoring-admin-filter-ficha").addEventListener("change", renderAdminTable);
    document.getElementById("tutoring-admin-filter-query").addEventListener("input", renderAdminTable);
  }

  async function loadAdminBookings() {
    var wrap = document.getElementById("tutoring-admin-table-wrap");
    if (wrap) wrap.innerHTML = '<p class="tutoring-admin-empty">Cargando reservas...</p>';
    var fdb = getFdb();
    if (!fdb || typeof fdb.cloudListTutoringBookings !== "function") {
      if (wrap) wrap.innerHTML = '<p class="tutoring-admin-empty">El servicio de reservas no esta disponible.</p>';
      return;
    }
    try {
      var ok = typeof fdb.checkAvailability === "function" ? await fdb.checkAvailability() : true;
      if (!ok) {
        if (wrap) wrap.innerHTML = '<p class="tutoring-admin-empty">Sin conexion al servicio de reservas.</p>';
        return;
      }
      adminState.bookings = await fdb.cloudListTutoringBookings();
      populateAdminFilters();
      renderAdminTable();
    } catch (error) {
      if (wrap) wrap.innerHTML = '<p class="tutoring-admin-empty">Error: ' + escapeHtml(String(error && error.message || error)) + '</p>';
    }
  }

  function populateAdminFilters() {
    var dateSel = document.getElementById("tutoring-admin-filter-date");
    var fichaSel = document.getElementById("tutoring-admin-filter-ficha");
    if (!dateSel || !fichaSel) return;
    var dates = {}, fichas = {};
    adminState.bookings.forEach(function (b) {
      if (b.date) dates[b.date] = true;
      if (b.ficha) fichas[b.ficha] = true;
    });
    var sortedDates = Object.keys(dates).sort();
    var sortedFichas = Object.keys(fichas).sort();
    var prevDate = dateSel.value;
    var prevFicha = fichaSel.value;
    dateSel.innerHTML = ['<option value="">Todas</option>']
      .concat(sortedDates.map(function (d) {
        return '<option value="' + escapeHtml(d) + '">' + escapeHtml(formatDateLong(d)) + '</option>';
      }))
      .join("");
    fichaSel.innerHTML = ['<option value="">Todas</option>']
      .concat(sortedFichas.map(function (f) {
        return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>';
      }))
      .join("");
    dateSel.value = prevDate;
    fichaSel.value = prevFicha;
  }

  function renderAdminTable() {
    var wrap = document.getElementById("tutoring-admin-table-wrap");
    if (!wrap) return;
    var dateFilter = document.getElementById("tutoring-admin-filter-date").value;
    var fichaFilter = document.getElementById("tutoring-admin-filter-ficha").value;
    var query = String(document.getElementById("tutoring-admin-filter-query").value || "").trim().toLowerCase();

    var rows = adminState.bookings
      .filter(function (b) {
        if (dateFilter && b.date !== dateFilter) return false;
        if (fichaFilter && String(b.ficha || "") !== fichaFilter) return false;
        if (query) {
          var hay = (b.studentName || "") + " " + (b.usernameKey || "") + " " + (b.topic || "") + " " + (b.grupo || "");
          if (!hay.toLowerCase().includes(query)) return false;
        }
        return true;
      })
      .sort(function (a, b) {
        var c = String(a.date || "").localeCompare(String(b.date || ""));
        if (c !== 0) return c;
        c = String(a.ficha || "").localeCompare(String(b.ficha || ""));
        if (c !== 0) return c;
        return String(a.startTime || "").localeCompare(String(b.startTime || ""));
      });

    if (!rows.length) {
      wrap.innerHTML = '<p class="tutoring-admin-empty">No hay reservas que coincidan con el filtro.</p>';
      return;
    }

    var tableHtml = [
      '<table class="tutoring-admin-table">',
      '<thead><tr>',
      '<th>Fecha</th><th>Hora</th><th>Duracion</th><th>Aprendiz</th><th>Usuario</th><th>Ficha / Grupo</th><th>Tema</th><th></th>',
      '</tr></thead><tbody>',
    ];
    rows.forEach(function (b) {
      tableHtml.push(
        '<tr>',
        '<td>' + escapeHtml(formatDateLong(b.date)) + '</td>',
        '<td>' + escapeHtml(b.startTime + " - " + b.endTime) + '</td>',
        '<td>' + escapeHtml(String(b.durationMinutes) + " min") + '</td>',
        '<td>' + escapeHtml(b.studentName || "Sin nombre") + '</td>',
        '<td>' + escapeHtml(b.usernameKey || "") + '</td>',
        '<td>' + escapeHtml((b.ficha || "") + (b.grupo ? " / " + b.grupo : "")) + '</td>',
        '<td>' + escapeHtml(b.topic || "") + '</td>',
        '<td><button type="button" class="tutoring-modal__btn tutoring-modal__btn--danger" data-tutoring-admin-delete="' +
          escapeHtml(b.date + "|" + b.ficha + "|" + b.usernameKey) + '">Borrar</button></td>',
        '</tr>'
      );
    });
    tableHtml.push('</tbody></table>');
    wrap.innerHTML = tableHtml.join("");

    wrap.querySelectorAll("[data-tutoring-admin-delete]").forEach(function (btn) {
      btn.addEventListener("click", handleAdminDelete);
    });
  }

  async function handleAdminDelete(event) {
    var key = event.currentTarget.getAttribute("data-tutoring-admin-delete");
    if (!key) return;
    var parts = key.split("|");
    var date = parts[0], ficha = parts[1], usernameKey = parts[2];
    if (!window.confirm("Borrar la reserva de " + usernameKey + " del " + date + "?")) return;
    var fdb = getFdb();
    if (!fdb) return;
    try {
      var ok = await fdb.cloudDeleteTutoringBooking(date, ficha, usernameKey);
      if (!ok) {
        window.alert("No fue posible borrar la reserva. Verifica conexion.");
        return;
      }
      adminState.bookings = adminState.bookings.filter(function (b) {
        return !(b.date === date && String(b.ficha) === ficha && String(b.usernameKey).toLowerCase() === String(usernameKey).toLowerCase());
      });
      renderAdminTable();
    } catch (error) {
      window.alert("Error al borrar: " + (error && error.message ? error.message : error));
    }
  }

  function initAdmin() {
    if (!isAdmin()) return;
    if (!document.getElementById("tutoring-admin-section")) return;
    ensureStyles();
    buildAdminUI();
    setTimeout(loadAdminBookings, 600);
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  function boot() {
    // El portal usa carga diferida; esperamos a que portalAuth y CALENDAR esten listos.
    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      if (window.portalAuth && Array.isArray(window.CALENDAR_2026_RECORDS) && window._firebaseDb) {
        clearInterval(timer);
        initStudent();
        initAdmin();
      } else if (attempts > 50) {
        // ~10 segundos sin dependencias listas; intentamos lo que se pueda.
        clearInterval(timer);
        initStudent();
        initAdmin();
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
