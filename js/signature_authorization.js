// js/signature_authorization.js — pagina "Autorizacion de uso de firma".
// El aprendiz sube una foto/escaneo de su firma (reutiliza el formulario
// seguro de entregas a Drive, shared_apps_script_delivery.js) para autorizar
// al instructor a usarla en documentacion institucional del SENA. El registro
// de control (quien ya autorizo) vive en Firestore sena_portal_signature_auth
// y solo lo puede LISTAR el admin (panel "Autorizaciones"); el aprendiz solo
// ve la confirmacion de SU propio envio.
(function () {
  "use strict";

  var PANEL_KEY = "autorizacion-firma";

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatFecha(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString("es-CO", {
        year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
      });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  function getSession() {
    var auth = window.portalAuth;
    return auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
  }

  function fillMeta(session) {
    var user = session && session.user;
    var nameEl = document.getElementById("sig-meta-name");
    var instEl = document.getElementById("sig-meta-inst");
    var fichaEl = document.getElementById("sig-meta-ficha");
    if (nameEl) nameEl.textContent = (user && user.fullName) || "—";
    if (instEl) instEl.textContent = (user && user.inst) || "—";
    if (fichaEl) fichaEl.textContent = (user && user.ficha) || "—";
  }

  function openUploadModal() {
    var sdd = window.sharedAppsScriptDelivery;
    if (!sdd || typeof sdd.openDeliveryModal !== "function") {
      window.portalSaveStatus?.error("El formulario seguro no esta disponible en este momento.");
      return;
    }
    sdd.openDeliveryModal({
      panelKey: PANEL_KEY,
      guideLabel: "Autorizaciones",
      activityLabel: "Autorizacion de firma",
      activityTitle: "Autorizacion de uso de firma",
      activityNumber: "",
      fileNamePrefix: "AutorizacionFirma",
      learnerNameMode: "full",
      allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
    });
  }

  function renderPending() {
    var container = document.getElementById("sig-content");
    if (!container) return;
    container.innerHTML =
      "<h2>Aun no has enviado tu autorizacion</h2>" +
      "<p>Sube una foto o escaneo NITIDO de tu firma (formatos permitidos: jpg, png o pdf). Al enviarla, autorizas a tu instructor a usarla en documentacion institucional del SENA. Una vez enviada, no podras reemplazarla salvo que el instructor la re-habilite.</p>" +
      '<button type="button" class="c-btn c-btn--primary" id="sig-upload-btn">Subir foto de mi firma</button>';
    var btn = document.getElementById("sig-upload-btn");
    if (btn) btn.addEventListener("click", openUploadModal);
  }

  function renderConfirmation(record) {
    var container = document.getElementById("sig-content");
    if (!container) return;
    var fecha = formatFecha(record.submittedAt) || "—";
    var archivo = escapeHtml(record.savedFileName || record.fileName || "") || "—";
    var enlace = record.driveUrl
      ? '<a href="' + escapeHtml(record.driveUrl) + '" target="_blank" rel="noopener">Ver mi archivo en Drive</a>'
      : "Sin enlace disponible.";
    container.innerHTML =
      '<div class="sig-confirmation">' +
      '<div class="c-alert c-alert--success"><span class="c-alert__icon">✅</span>' +
      "<span>Ya enviaste tu autorizacion de uso de firma. Para modificar o reemplazar el envio, pide al instructor o administrador que lo re-habilite.</span></div>" +
      "<dl>" +
      "<dt>Enviado el</dt><dd>" + escapeHtml(fecha) + "</dd>" +
      "<dt>Archivo</dt><dd>" + archivo + "</dd>" +
      "<dt>Enlace</dt><dd>" + enlace + "</dd>" +
      "</dl>" +
      "</div>";
  }

  function renderNotStudent() {
    var container = document.getElementById("sig-content");
    if (!container) return;
    container.innerHTML = '<p class="sig-status">Inicia sesion como aprendiz para enviar tu autorizacion.</p>';
  }

  // Al terminar la entrega (evento de shared_apps_script_delivery.js), se
  // registra el envio en Firestore (doc propio, rule isOwnerByUsernameKey) y
  // se actualiza la vista sin esperar una relectura de la nube.
  async function handleDeliveryRegistered(event) {
    var detail = (event && event.detail) || {};
    if (detail.panelKey !== PANEL_KEY) return;
    var session = getSession();
    if (!session || session.role !== "student" || !session.user || !session.user.usernameKey) return;

    var record = {
      fullName: detail.fullName || session.user.fullName || "",
      ficha: detail.ficha || session.user.ficha || "",
      institucion: detail.institucion || session.user.inst || "",
      submittedAt: detail.submittedAt || new Date().toISOString(),
      fileName: detail.nombreArchivoOriginal || detail.originalFileName || "",
      savedFileName: detail.savedFileName || detail.nombreArchivoEstandar || "",
      driveUrl: detail.driveUrl || detail.enlaceDrive || "",
      status: "delivered",
    };

    var db = window._firebaseDb;
    if (db && typeof db.cloudSaveSignatureAuth === "function") {
      try { await db.cloudSaveSignatureAuth(session.user.usernameKey, record); } catch (e) { /* best-effort */ }
    }
    renderConfirmation(record);
  }

  async function init() {
    var session = getSession();
    fillMeta(session);

    if (!session || session.role !== "student" || !session.user || !session.user.usernameKey) {
      renderNotStudent();
      return;
    }

    var db = window._firebaseDb;
    var record = null;
    if (db && typeof db.cloudGetSignatureAuth === "function") {
      try { record = await db.cloudGetSignatureAuth(session.user.usernameKey); } catch (e) { record = null; }
    }

    if (record && record.status === "delivered") {
      renderConfirmation(record);
    } else {
      renderPending();
    }
  }

  document.addEventListener("guide-delivery-registered", handleDeliveryRegistered);
  document.addEventListener("DOMContentLoaded", init);
})();
