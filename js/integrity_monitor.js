/* integrity_monitor.js
 * ----------------------------------------------------------------------------
 * Registro SILENCIOSO de integridad académica, SOLO para el admin.
 *
 * Captura, sin que el aprendiz lo note, señales de comportamiento mientras
 * responde una guía:
 *   - Pegados en los campos de respuesta (cuántos y cuánto texto).
 *   - Cambios de pestaña / salidas de la guía (cuántas y cuánto tiempo fuera).
 *   - Tiempo de escritura activa.
 *
 * Se guarda en el canal Drive del proyecto (window.driveDb), NO en Firestore,
 * así que NO consume cuota de Firestore. El admin lo revisa y exporta aparte
 * (no afecta la exportación de respuestas de la actividad).
 *
 * Reglas de diseño:
 *   - Nunca lanza errores ni interfiere con el guardado de respuestas.
 *   - No muestra nada al aprendiz (sin UI, sin avisos, sin bloqueos).
 *   - Solo corre para sesiones de APRENDIZ en páginas de GUÍA.
 *   - Es un indicio para el instructor, no una prueba infalible.
 * ----------------------------------------------------------------------------
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__senaIntegrityInstalled) return;
  window.__senaIntegrityInstalled = true;

  var COLLECTION = "integrity_evidence";
  var SAVE_DEBOUNCE_MS = 4000;
  var TYPING_GAP_CAP_MS = 12000; // pausas mayores no cuentan como "escribiendo"
  var MAX_PASTE_SAMPLES = 60;

  // ── Utilidades seguras ─────────────────────────────────────────────────────
  function safe(fn) { try { return fn(); } catch (_) { return undefined; } }
  function nowIso() { return new Date().toISOString(); }
  function sanitizeId(s) { return String(s || "").replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120); }

  function getSession() {
    var pa = window.portalAuth;
    return pa && typeof pa.getCurrentSession === "function" ? safe(function () { return pa.getCurrentSession(); }) : null;
  }

  function detectPageFile() {
    if (typeof window.__RUNTIME_PAGE_FILE__ === "string" && window.__RUNTIME_PAGE_FILE__) return window.__RUNTIME_PAGE_FILE__;
    var ctx = window.__GUIDE_CONTEXT__;
    if (ctx && ctx.template) {
      var qp = safe(function () { return new URLSearchParams(location.search).get("g"); });
      if (qp) return qp;
    }
    var qg = safe(function () { return new URLSearchParams(location.search).get("g"); });
    if (qg) return qg;
    return (location.pathname || "").split("/").pop() || "";
  }

  function isGuidePage() {
    if (document.body && document.body.classList.contains("app-shell--guide")) return true;
    return /guia\.html$/.test(location.pathname) || /-guia-/.test(detectPageFile());
  }

  function isAnswerField(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    if (tag === "INPUT") {
      var t = (el.getAttribute("type") || "text").toLowerCase();
      return ["text", "search", "email", "url", "tel", "number", ""].indexOf(t) !== -1;
    }
    return false;
  }

  function fieldKeyOf(el) {
    if (!el) return "campo";
    var k = el.id || el.name || el.getAttribute("data-store") || el.getAttribute("data-field");
    if (k) return String(k).slice(0, 60);
    var act = el.closest && el.closest(".activity");
    if (act) {
      var num = act.querySelector(".activity-num, .mission-chip");
      if (num && num.textContent.trim()) return "act-" + num.textContent.trim().slice(0, 14);
    }
    return "campo";
  }

  // ── Estado / evidencia acumulada ───────────────────────────────────────────
  var session = getSession();
  if (!session || session.role !== "student" || !session.user) return;
  if (!isGuidePage()) return;

  var user = session.user;
  var usernameKey = user.usernameKey || user.username || "";
  if (!usernameKey) return;

  var pageFile = detectPageFile();
  var docId = sanitizeId(usernameKey + "__" + pageFile);
  var localKey = "sena_portal_integrity_v1:" + docId;

  function blankEvidence() {
    return {
      schema: 1,
      usernameKey: usernameKey,
      learnerName: user.fullName || user.username || "",
      ficha: user.ficha || "",
      institucion: user.inst || "",
      grupo: user.grupo || "",
      fileName: pageFile,
      guideTitle: safe(function () { return document.title.split("|")[0].trim(); }) || pageFile,
      startedAt: nowIso(),
      updatedAt: nowIso(),
      pasteCount: 0,
      pasteChars: 0,
      tabAwayCount: 0,
      tabAwayMs: 0,
      typingMs: 0,
      pastes: [],
      fields: {},
    };
  }

  var ev = safe(function () {
    var raw = localStorage.getItem(localKey);
    return raw ? JSON.parse(raw) : null;
  }) || blankEvidence();
  // Reconcilia estructura por si viene de una versión vieja.
  ev.pastes = ev.pastes || [];
  ev.fields = ev.fields || {};

  // ── Persistencia (local siempre; Drive best-effort, SIN Firestore) ─────────
  var saveTimer = null;
  function persist() {
    ev.updatedAt = nowIso();
    safe(function () { localStorage.setItem(localKey, JSON.stringify(ev)); });
    var d = window.driveDb;
    if (d && typeof d.set === "function" && (typeof d.isEnabled !== "function" || safe(function () { return d.isEnabled(); }))) {
      safe(function () {
        var p = d.set(COLLECTION, docId, ev);
        if (p && typeof p.catch === "function") p.catch(function () {});
      });
    }
  }
  function schedulePersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, SAVE_DEBOUNCE_MS);
  }

  // ── Captura: pegado ─────────────────────────────────────────────────────────
  document.addEventListener("paste", function (e) {
    safe(function () {
      var el = e.target;
      if (!isAnswerField(el)) return;
      var text = (e.clipboardData && e.clipboardData.getData("text")) || "";
      var len = text.length;
      var key = fieldKeyOf(el);
      ev.pasteCount += 1;
      ev.pasteChars += len;
      if (ev.pastes.length < MAX_PASTE_SAMPLES) ev.pastes.push({ field: key, len: len, at: nowIso() });
      var f = ev.fields[key] || (ev.fields[key] = { pasteCount: 0, pasteChars: 0 });
      f.pasteCount += 1;
      f.pasteChars += len;
      schedulePersist();
    });
  }, true);

  // ── Captura: tiempo de escritura activa ────────────────────────────────────
  var lastInputTs = 0;
  document.addEventListener("input", function (e) {
    safe(function () {
      if (!isAnswerField(e.target)) return;
      var t = Date.now();
      if (lastInputTs && t - lastInputTs < TYPING_GAP_CAP_MS) ev.typingMs += t - lastInputTs;
      lastInputTs = t;
      schedulePersist();
    });
  }, true);

  // ── Captura: cambios de pestaña / salidas ──────────────────────────────────
  var awayStart = 0;
  function onHide() { if (!awayStart) awayStart = Date.now(); }
  function onShow() {
    if (awayStart) {
      ev.tabAwayCount += 1;
      ev.tabAwayMs += Date.now() - awayStart;
      awayStart = 0;
      schedulePersist();
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) onHide(); else onShow();
  });
  window.addEventListener("blur", onHide);
  window.addEventListener("focus", onShow);

  // ── Flush al salir ─────────────────────────────────────────────────────────
  function flushNow() { if (awayStart) onShow(); if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } persist(); }
  window.addEventListener("pagehide", flushNow);
  document.addEventListener("visibilitychange", function () { if (document.hidden) flushNow(); });

  // Guarda una marca inicial (presencia) sin esperar a un evento.
  schedulePersist();

  // Exponer para depuración del admin/maintainer (no visible al aprendiz).
  window.__senaIntegrity = { get: function () { return ev; }, flush: flushNow, docId: docId };
})();
