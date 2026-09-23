// Tarjeta + modal "Revision de bitacora con IA" (Etapa Productiva, grado 11).
//
// El portal NO procesa la bitacora ni llama a ninguna IA: solo entrega el
// LOOP completo (data/bitacora_review_prompt.js, fuente unica), como usarlo,
// que documentos adjuntar y un aviso de privacidad. El aprendiz lo copia y lo
// pega en la herramienta de IA que el elija.
//
// Visibilidad: SOLO fichas SB 11A/11B. No es un display:none -- la tarjeta ni
// siquiera se genera (buildResourcesMarkup en productive_stage_project_delivery.js
// consulta isAuthorizedFicha). El instructor la ve al previsualizar
// (?student=usuario) a un aprendiz de esas fichas: cuenta la ficha del
// aprendiz consultado, no la del instructor.
(function () {
  var AUTHORIZED_FICHAS = ["3168850", "3168852"];
  var COPIED_MESSAGE = "✓ LOOP copiado. Ahora pégalo en la herramienta de IA que vayas a utilizar.";
  var MODAL_ID = "bitacora-loop-modal";

  function isAuthorizedFicha(ficha) {
    return AUTHORIZED_FICHAS.indexOf(String(ficha == null ? "" : ficha).trim()) >= 0;
  }

  function getPreviewUsernameKey(search) {
    try {
      return String(new URLSearchParams(search || "").get("student") || "").trim().toLowerCase();
    } catch (error) {
      return "";
    }
  }

  // Ficha que decide la visibilidad: la del aprendiz en sesion o, para el
  // admin, la del aprendiz previsualizado (cache de usuarios del admin; si no
  // esta, la ficha del proyecto vinculado).
  function resolveContextFicha(options) {
    var session = options && options.session;
    if (!session) return "";
    if (session.role === "student") {
      return String((session.user && session.user.ficha) || "").trim();
    }
    if (session.role !== "admin") return "";
    var previewKey = getPreviewUsernameKey(options.search);
    if (!previewKey) return "";
    var auth = options.auth;
    var student = auth && typeof auth.getStudentByUsernameKey === "function"
      ? auth.getStudentByUsernameKey(previewKey)
      : null;
    if (student && student.ficha) return String(student.ficha).trim();
    return String(options.fallbackFicha || "").trim();
  }

  function getLoop() {
    var loop = window.BITACORA_REVIEW_LOOP;
    return loop && typeof loop.text === "string" && loop.text ? loop : null;
  }

  function buildCardHtml() {
    return (
      '<article class="student-project-download-card bitacora-loop-card" data-bitacora-loop-card>' +
        '<div class="student-project-download-card__heading">' +
          "<div>" +
            '<span class="student-project-download-card__type">Herramienta de apoyo</span>' +
            "<h4>Revisión de bitácora con IA</h4>" +
          "</div>" +
          '<span class="student-document-status student-document-status--reference">LOOP</span>' +
        "</div>" +
        "<p>Utiliza este LOOP para revisar y corregir las actividades de tu bitácora de Etapa Productiva " +
        "con apoyo de una herramienta de inteligencia artificial y el Diseño Curricular oficial del programa.</p>" +
        '<div class="student-project-download-card__actions">' +
          '<button class="app-btn app-btn--primary" type="button" data-bitacora-loop-open>Ver y copiar LOOP</button>' +
        "</div>" +
      "</article>"
    );
  }

  var HOW_TO_STEPS = [
    "Descarga el Diseño Curricular del programa utilizando la tarjeta disponible en esta misma sección.",
    "Ten disponible tu bitácora de Etapa Productiva que deseas revisar.",
    "Si tienes evidencias o soportes relacionados con las actividades registradas, tenlos disponibles.",
    "Pulsa “Copiar LOOP”.",
    "Abre la herramienta de inteligencia artificial que vayas a utilizar.",
    "Pega el LOOP completo en una conversación nueva.",
    "Adjunta en esa misma conversación: tu bitácora; el Diseño Curricular oficial; y, cuando sea necesario, las evidencias o soportes.",
    "Envía el mensaje y espera que la IA realice la revisión.",
    "La respuesta debe entregarte las actividades corregidas y listas para copiar y pegar.",
    "Si aparece “DATOS POR CONFIRMAR”, proporciona únicamente la información que la IA te solicite y continúa la revisión en la misma conversación.",
  ];

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function buildModalHtml(loop) {
    var steps = HOW_TO_STEPS.map(function (step) {
      return "<li>" + escapeHtml(step) + "</li>";
    }).join("");
    var loopBlock = loop
      ? '<pre class="bitacora-loop__text" tabindex="0" aria-label="Texto completo del LOOP" data-bitacora-loop-text>' +
          escapeHtml(loop.text) +
        "</pre>"
      : '<p class="bitacora-loop__error">El LOOP no está disponible en este momento. Recarga la página o consulta con tu instructor.</p>';
    return (
      '<div class="c-modal__card bitacora-loop__card" role="dialog" aria-modal="true" aria-labelledby="bitacora-loop-title">' +
        '<div class="c-modal__header">' +
          "<div>" +
            '<span class="student-project-download-card__type">Herramienta de apoyo</span>' +
            '<h3 class="c-modal__title" id="bitacora-loop-title">Revisión de bitácora con IA</h3>' +
          "</div>" +
          '<button class="c-modal__close" type="button" aria-label="Cerrar" data-bitacora-loop-close>&times;</button>' +
        "</div>" +

        '<p class="bitacora-loop__intro">El portal no revisa tu bitácora ni se conecta con ninguna IA: aquí copias el LOOP ' +
        "y lo usas en la herramienta de inteligencia artificial que tú prefieras.</p>" +

        '<section class="bitacora-loop__section" aria-labelledby="bitacora-loop-how">' +
          '<h4 id="bitacora-loop-how">¿Cómo utilizar este LOOP?</h4>' +
          '<ol class="bitacora-loop__steps">' + steps + "</ol>" +
          '<p class="bitacora-loop__important"><strong>IMPORTANTE:</strong> La IA NO debe modificar directamente tu archivo original. ' +
          "Revisa el resultado antes de copiarlo a tu bitácora.</p>" +
        "</section>" +

        '<section class="bitacora-loop__section" aria-labelledby="bitacora-loop-docs">' +
          '<h4 id="bitacora-loop-docs">¿Qué documentos necesitas?</h4>' +
          '<h5 class="bitacora-loop__docs-heading">Obligatorios</h5>' +
          '<ol class="bitacora-loop__docs">' +
            "<li><strong>Bitácora de Etapa Productiva.</strong> Debes adjuntar la bitácora que deseas revisar. " +
            "La revisión se concentra exclusivamente en la tabla “Descripción de las actividades realizadas”.</li>" +
            "<li><strong>Diseño Curricular oficial del programa.</strong> Debes adjuntar a la IA el mismo Diseño Curricular oficial " +
            "disponible en la tarjeta “Diseño Curricular del programa”. Este documento es indispensable porque contiene: " +
            "competencias oficiales; códigos; Resultados de Aprendizaje (RAP); relación entre RAP y competencia. " +
            "El LOOP ordena expresamente a la IA NO inventar esta información.</li>" +
          "</ol>" +
          '<h5 class="bitacora-loop__docs-heading">Recomendados cuando existan</h5>' +
          '<ol class="bitacora-loop__docs" start="3">' +
            "<li><strong>Evidencias o soportes.</strong> Adjúntalos cuando ayuden a demostrar qué actividad realizaste realmente. " +
            "Por ejemplo: documentos del proyecto; informes; diseños; diagramas; cronogramas; productos elaborados; " +
            "capturas pertinentes; anexos relacionados con las actividades. " +
            "No es necesario adjuntar documentos que no tengan relación con las actividades que deseas revisar.</li>" +
          "</ol>" +
        "</section>" +

        '<div class="bitacora-loop__privacy" role="note">' +
          "<strong>Privacidad.</strong> " +
          "<p>Antes de cargar documentos en una herramienta de inteligencia artificial, revisa si contienen información personal que no sea necesaria para la revisión.</p>" +
          "<p>No compartas innecesariamente documentos de identidad, firmas, datos bancarios, contraseñas u otra información sensible.</p>" +
          "<p>Utiliza únicamente los documentos y evidencias necesarios para revisar las actividades de tu bitácora.</p>" +
        "</div>" +

        '<section class="bitacora-loop__section" aria-labelledby="bitacora-loop-full">' +
          '<h4 id="bitacora-loop-full">LOOP completo</h4>' +
          loopBlock +
        "</section>" +

        '<p class="bitacora-loop__status" role="status" aria-live="polite" data-bitacora-loop-status></p>' +
        '<div class="c-modal__footer bitacora-loop__footer">' +
          '<button class="app-btn app-btn--outline" type="button" data-bitacora-loop-close>Cerrar</button>' +
          '<button class="app-btn app-btn--outline" type="button" data-bitacora-loop-download' + (loop ? "" : " disabled") + ">Descargar LOOP</button>" +
          '<button class="app-btn app-btn--primary" type="button" data-bitacora-loop-copy' + (loop ? "" : " disabled") + ">Copiar LOOP</button>" +
        "</div>" +
      "</div>"
    );
  }

  // Copia SIEMPRE el texto de la fuente unica (no lo visible del modal).
  // Respaldo con textarea + execCommand para navegadores sin
  // navigator.clipboard (contexto no seguro, WebViews, navegadores viejos).
  function copyText(text, env) {
    var nav = (env && env.navigator) || window.navigator;
    var doc = (env && env.document) || document;
    function legacyCopy() {
      var area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-9999px";
      area.style.opacity = "0";
      doc.body.appendChild(area);
      area.select();
      try { area.setSelectionRange(0, text.length); } catch (error) {}
      var ok = false;
      try { ok = !!doc.execCommand("copy"); } catch (error) { ok = false; }
      doc.body.removeChild(area);
      return ok;
    }
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
      return nav.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(); }
      );
    }
    return Promise.resolve(legacyCopy());
  }

  function downloadText(text, fileName) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  var lastFocused = null;

  function close() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    modal.hidden = true;
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function onKeydown(event) {
    if (event.key === "Escape") close();
  }

  function selectLoopText(modal) {
    var pre = modal.querySelector("[data-bitacora-loop-text]");
    if (!pre || !window.getSelection) return;
    var range = document.createRange();
    range.selectNodeContents(pre);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function open() {
    var loop = getLoop();
    var modal = document.getElementById(MODAL_ID);
    if (!modal) {
      modal = document.createElement("div");
      modal.id = MODAL_ID;
      modal.className = "c-modal bitacora-loop";
      modal.innerHTML = buildModalHtml(loop);
      document.body.appendChild(modal);

      modal.addEventListener("click", function (event) {
        if (event.target === modal) close();
      });
      modal.querySelectorAll("[data-bitacora-loop-close]").forEach(function (btn) {
        btn.addEventListener("click", close);
      });
      var status = modal.querySelector("[data-bitacora-loop-status]");
      var copyBtn = modal.querySelector("[data-bitacora-loop-copy]");
      if (copyBtn && loop) {
        copyBtn.addEventListener("click", function () {
          copyText(loop.text).then(function (ok) {
            status.classList.toggle("bitacora-loop__status--error", !ok);
            if (ok) {
              status.textContent = COPIED_MESSAGE;
            } else {
              selectLoopText(modal);
              status.textContent = "No se pudo copiar automáticamente. El LOOP quedó seleccionado: cópialo manualmente o usa “Descargar LOOP”.";
            }
          });
        });
      }
      var downloadBtn = modal.querySelector("[data-bitacora-loop-download]");
      if (downloadBtn && loop) {
        downloadBtn.addEventListener("click", function () {
          downloadText(loop.text, loop.fileName || "LOOP_Revision_Bitacora_SENA.txt");
          status.classList.remove("bitacora-loop__status--error");
          status.textContent = "LOOP descargado como archivo de texto.";
        });
      }
    }
    var statusEl = modal.querySelector("[data-bitacora-loop-status]");
    if (statusEl) statusEl.textContent = "";
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.addEventListener("keydown", onKeydown);
    var closeBtn = modal.querySelector(".c-modal__close");
    if (closeBtn) closeBtn.focus();
  }

  window.bitacoraReviewLoop = {
    AUTHORIZED_FICHAS: AUTHORIZED_FICHAS.slice(),
    COPIED_MESSAGE: COPIED_MESSAGE,
    isAuthorizedFicha: isAuthorizedFicha,
    resolveContextFicha: resolveContextFicha,
    buildCardHtml: buildCardHtml,
    buildModalHtml: buildModalHtml,
    copyText: copyText,
    open: open,
    close: close,
  };
})();
