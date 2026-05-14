(function () {
  const auth = window.portalAuth || null;
  const source = window.guia2Activity4ReportSource || null;
  const MODAL_ID = "activity4-admin-report-modal";
  const STYLE_ID = "activity4-admin-report-style";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function formatDate(value) {
    if (!value) {
      return "Sin registro";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Sin registro";
    }

    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDurationMs(value) {
    const totalSeconds = Math.max(0, Math.floor((Number(value) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const two = function (number) {
      return String(number).padStart(2, "0");
    };
    return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  }

  function hasMeaningfulValue(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value) && value !== 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return String(value ?? "").trim().length > 0;
  }

  function renderAnswerValue(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return '<div class="activity4-admin-report-value is-empty">Sin respuesta registrada.</div>';
    }

    return `<div class="activity4-admin-report-value">${escapeHtml(text)}</div>`;
  }

  function renderAnswerTable(headers, rows) {
    return (
      '<div class="activity4-admin-report-table-wrap">' +
      '<table class="activity4-admin-report-table">' +
      "<thead><tr>" +
      headers.map(function (header) {
        return `<th>${escapeHtml(header)}</th>`;
      }).join("") +
      "</tr></thead>" +
      "<tbody>" +
      rows
        .map(function (row) {
          return (
            "<tr>" +
            row
              .map(function (cell) {
                return `<td>${
                  hasMeaningfulValue(cell)
                    ? escapeHtml(String(cell)).replace(/\r?\n/g, "<br>")
                    : "Sin respuesta"
                }</td>`;
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }

  var WORD_SEARCH_FOUND_COLORS = [
    "#0f766e", "#2563eb", "#7c3aed", "#be123c",
    "#b45309", "#15803d", "#0369a1", "#a21caf",
  ];

  function getWordSearchResult(state) {
    return state && typeof state["wordSearch:guia2-sopa"] === "object" ? state["wordSearch:guia2-sopa"] : {};
  }

  function getWordSearchWords(result) {
    if (Array.isArray(result.foundLabels)) {
      return result.foundLabels;
    }
    if (Array.isArray(result.found)) {
      return result.found;
    }
    return [];
  }

  function renderWordSearchGrid(result) {
    var api = window.guia2WordSearch;
    if (!api || typeof api.getPuzzle !== "function") {
      return '<p style="color:#71877f;font-size:13px;margin:0">La grilla se muestra al abrir el reporte desde el formulario de la Actividad 4.</p>';
    }
    var variant = Number(result.variant) || 1;
    var puzzle = api.getPuzzle(variant);
    var found = Array.isArray(result.found) ? result.found : [];
    var foundColorCount = api.foundColorCount || 8;

    var cellColors = {};
    found.forEach(function (word, index) {
      var placement = puzzle.placements[word];
      if (!placement) { return; }
      var color = WORD_SEARCH_FOUND_COLORS[index % foundColorCount];
      placement.cells.forEach(function (cell) {
        cellColors[cell.row + ":" + cell.col] = color;
      });
    });

    var cellBase = "display:inline-flex;align-items:center;justify-content:center;" +
      "width:21px;height:21px;font-size:9.5px;font-weight:700;border-radius:4px;" +
      "border:1px solid rgba(0,0,0,0.07);font-family:monospace;line-height:1;";

    var rows = puzzle.grid.map(function (row, rowIndex) {
      var cells = row.map(function (letter, colIndex) {
        var key = rowIndex + ":" + colIndex;
        var color = cellColors[key];
        var extra = color
          ? "background:" + color + ";color:#fff;border-color:" + color + ";"
          : "background:#eef3f0;color:#2a3d33;";
        return '<span style="' + cellBase + extra + '">' + escapeHtml(letter) + '</span>';
      }).join("");
      return '<div style="display:flex;gap:2px;">' + cells + "</div>";
    }).join("");

    var labels = Array.isArray(result.foundLabels) ? result.foundLabels : found;
    var legend = labels.map(function (label, index) {
      var color = WORD_SEARCH_FOUND_COLORS[index % foundColorCount];
      return '<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;">' +
        '<span style="width:11px;height:11px;border-radius:3px;background:' + color + ';flex-shrink:0;display:inline-block;"></span>' +
        '<span style="font-size:11px;font-weight:600;color:#1a3329;">' + escapeHtml(label) + "</span>" +
        "</span>";
    }).join("");

    var notFoundCount = puzzle.targets.length - found.length;
    var notFoundNote = notFoundCount > 0
      ? '<p style="margin:8px 0 0;font-size:12px;color:#71877f;">' +
          notFoundCount + ' palabra(s) sin encontrar (celdas grises sin resaltar).' +
        '</p>'
      : '<p style="margin:8px 0 0;font-size:12px;color:#0b8c42;font-weight:700;">Sopa completada al 100%.</p>';

    return '<div style="overflow:auto;margin-bottom:4px;">' +
      '<div style="display:grid;gap:2px;width:fit-content;">' + rows + "</div>" +
      "</div>" +
      (legend ? '<div style="margin-top:8px;display:flex;flex-wrap:wrap;">' + legend + "</div>" : "") +
      notFoundNote;
  }

  function renderWordSearchResult(state, context) {
    const result = getWordSearchResult(state);
    const words = getWordSearchWords(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const wordsText = words.length ? words.join(" | ") : "Sin palabras registradas";

    const statsTable = renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz que realizo", result.playerName || context.fullName],
        ["Ficha registrada", result.ficha || context.ficha],
        ["Puntaje", result.completedAt || score ? `${score} / 10000` : "Sin registro"],
        ["Sopa asignada", result.variant ? `Version ${Number(result.variant) || 1}` : "Sin registro"],
        ["Errores", result.completedAt || result.startedAt ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Palabras encontradas", `${words.length} — ${wordsText}`],
        ["Fecha de finalizacion", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );

    const gridSection =
      '<div style="margin-top:14px;">' +
      '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0b2f21;">Sopa resuelta por el aprendiz:</p>' +
      renderWordSearchGrid(result) +
      "</div>";

    return statsTable + gridSection;
  }

  function getMatchingGameResult(state) {
    return state && typeof state["matchingGame:guia2-relaciona"] === "object"
      ? state["matchingGame:guia2-relaciona"]
      : {};
  }

  function getMatchingGamePairs(result) {
    return Array.isArray(result.matchedPairs) ? result.matchedPairs : [];
  }

  function renderMatchingGameResult(state, context) {
    const result = getMatchingGameResult(state);
    const pairs = getMatchingGamePairs(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const correctCount = Number(result.correctCount) || pairs.length;
    const totalPairs = Number(result.totalPairs) || 0;

    const statsTable = renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz que realizo", result.playerName || context.fullName],
        ["Ficha registrada", result.ficha || context.ficha],
        ["Puntaje", result.completedAt || score ? `${score} / 10000` : "Sin registro"],
        ["Version asignada", result.variant ? `Version ${Number(result.variant) || 1}` : "Sin registro"],
        ["Respuestas correctas", result.completedAt || correctCount ? `${correctCount} / ${totalPairs || correctCount}` : "Sin registro"],
        ["Errores", result.completedAt || result.startedAt ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Fecha de finalizacion", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );

    let pairsSection = "";
    if (pairs.length) {
      const pairRows = pairs.map(function (pair) {
        const isCorrect = pair.correct !== false;
        const badge = isCorrect
          ? '<span style="color:#0b8c42;font-weight:700;">✓ Correcto</span>'
          : '<span style="color:#be123c;font-weight:700;">✗ Incorrecto</span>';
        return "<tr>" +
          "<td>" + escapeHtml(pair.tool || "Herramienta") + "</td>" +
          "<td>" + escapeHtml(pair.answer || "Sin respuesta") + "</td>" +
          "<td>" + badge + "</td>" +
          "</tr>";
      }).join("");

      pairsSection =
        '<div style="margin-top:14px;">' +
        '<p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0b2f21;">Parejas respondidas por el aprendiz:</p>' +
        '<div class="activity4-admin-report-table-wrap">' +
        '<table class="activity4-admin-report-table">' +
        "<thead><tr><th>Herramienta</th><th>Funcion asignada</th><th>Estado</th></tr></thead>" +
        "<tbody>" + pairRows + "</tbody>" +
        "</table></div></div>";
    }

    return statsTable + pairsSection;
  }

  function renderGuide2ResponsesBody(state, context) {
    return `
      <div class="activity4-admin-report-grid">
        <article class="activity4-admin-report-card">
          <h3>Actividad 1. Sopa de letras de conceptos basicos.</h3>
          ${renderWordSearchResult(state, context)}
        </article>

        <article class="activity4-admin-report-card">
          <h3>Actividad 2. Relaciona la herramienta con su funcion.</h3>
          ${renderMatchingGameResult(state, context)}
        </article>

        <article class="activity4-admin-report-card">
          <h3>Identificacion registrada en el formulario.</h3>
          ${renderAnswerTable(
            ["Campo", "Respuesta del aprendiz"],
            [
              ["Nombre completo", state["actividad4:nombre_completo"]],
              ["Número de ficha", state["actividad4:ficha"]],
            ]
          )}
        </article>

        <article class="activity4-admin-report-card">
          <h3>1. ¿Cuál de las siguientes opciones describe mejor qué es una herramienta TIC?</h3>
          ${renderAnswerValue(state["contexto-q1"])}
        </article>

        <article class="activity4-admin-report-card">
          <h3>2. Relaciona cada herramienta con su función principal.</h3>
          ${renderAnswerTable(
            ["Herramienta", "Respuesta del aprendiz"],
            [
              ["Google Drive", state["contexto-rel-drive"]],
              ["Microsoft Excel", state["contexto-rel-excel"]],
              ["Canva", state["contexto-rel-canva"]],
              ["WhatsApp Business", state["contexto-rel-whatsapp"]],
            ]
          )}
        </article>

        <article class="activity4-admin-report-card">
          <h3>3. Recomendación para el tendero de Puerto Boyacá.</h3>
          ${renderAnswerValue(state["contexto-tendero"])}
        </article>

        <article class="activity4-admin-report-card">
          <h3>4. Acción que NO corresponde a un procesador de texto.</h3>
          ${renderAnswerValue(state["contexto-q4"])}
        </article>

        <article class="activity4-admin-report-card">
          <h3>5. Herramientas para enviar el mismo mensaje a 30 estudiantes.</h3>
          ${renderAnswerTable(
            ["Herramienta", "¿La usaría?", "¿Por qué la usaría?"],
            [
              ["Correo electrónico (Gmail, Outlook)", state["contexto-docente-correo-si"], state["contexto-docente-correo-porque"]],
              ["Google Classroom o plataforma educativa", state["contexto-docente-classroom-si"], state["contexto-docente-classroom-porque"]],
              ["WhatsApp con lista de difusión", state["contexto-docente-whatsapp-si"], state["contexto-docente-whatsapp-porque"]],
              ["USB copiado uno por uno", state["contexto-docente-usb-si"], state["contexto-docente-usb-porque"]],
            ]
          )}
        </article>

        <article class="activity4-admin-report-card">
          <h3>6. ¿Qué significa guardar en la nube?</h3>
          ${renderAnswerValue(state["contexto-nube"])}
        </article>

        <article class="activity4-admin-report-card">
          <h3>7. Orden propuesto para crear una copia de seguridad.</h3>
          ${renderAnswerTable(
            ["Paso", "Orden escrito"],
            [
              ["Verificar que el archivo se abrió correctamente en la ubicación de respaldo", state["contexto-backup-verificar"]],
              ["Seleccionar el archivo que deseas respaldar", state["contexto-backup-seleccionar"]],
              ["Copiar o subir el archivo a una memoria USB o servicio en la nube", state["contexto-backup-copiar"]],
              ["Confirmar que el archivo original sigue disponible en su ubicación original", state["contexto-backup-confirmar"]],
            ]
          )}
        </article>

        <article class="activity4-admin-report-card">
          <h3>8. Situación que representa un problema de gestión de la información.</h3>
          ${renderAnswerValue(state["contexto-info-problem"])}
        </article>

        <article class="activity4-admin-report-card">
          <h3>9. Herramientas digitales que ya ha usado el aprendiz.</h3>
          ${renderAnswerTable(
            ["Herramienta", "¿La ha usado?", "¿Para qué la usó?"],
            [
              ["Microsoft Word o Writer", state["contexto-uso-word-si"], state["contexto-uso-word-porque"]],
              ["Microsoft Excel o Calc", state["contexto-uso-excel-si"], state["contexto-uso-excel-porque"]],
              ["Google Drive", state["contexto-uso-drive-si"], state["contexto-uso-drive-porque"]],
              ["Correo electronico", state["contexto-uso-correo-si"], state["contexto-uso-correo-porque"]],
              ["Zoom o Google Meet", state["contexto-uso-meet-si"], state["contexto-uso-meet-porque"]],
            ]
          )}
        </article>

        <article class="activity4-admin-report-card">
          <h3>10. Recomendaciones para organizar la información del emprendedor de Otanche.</h3>
          ${renderAnswerValue(state["contexto-otanche"])}
        </article>
      </div>
    `;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".activity4-admin-report-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(4,16,12,.72);backdrop-filter:blur(8px);z-index:1300;}",
      ".activity4-admin-report-modal.is-open{display:flex;}",
      ".activity4-admin-report-panel{width:min(1100px,100%);max-height:min(90vh,920px);overflow:auto;border-radius:24px;border:1px solid rgba(15,63,43,.12);background:#fff;box-shadow:0 30px 80px rgba(4,16,12,.28);padding:22px;}",
      ".activity4-admin-report-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px;}",
      ".activity4-admin-report-head h2{margin:0;font:800 1.35rem/1.15 Outfit,Inter,sans-serif;color:#0b2f21;}",
      ".activity4-admin-report-head p{margin:6px 0 0;color:#587167;line-height:1.55;}",
      ".activity4-admin-report-close{border:none;border-radius:999px;background:#eef6f0;color:#0a5c31;width:40px;height:40px;font-size:22px;cursor:pointer;flex:0 0 auto;}",
      ".activity4-admin-report-meta{padding:12px 14px;border-radius:16px;border:1px solid #ddece3;background:#f7fbf8;color:#516860;font-size:14px;line-height:1.6;margin-bottom:16px;}",
      ".activity4-admin-report-grid{display:grid;gap:14px;}",
      ".activity4-admin-report-card{border:1px solid #dcefe3;border-radius:18px;background:#fbfefd;padding:16px;display:grid;gap:12px;}",
      ".activity4-admin-report-card h3{margin:0;color:#0b2f21;font-size:1rem;font-weight:800;}",
      ".activity4-admin-report-table-wrap{overflow:auto;}",
      ".activity4-admin-report-table{width:100%;border-collapse:collapse;min-width:320px;}",
      ".activity4-admin-report-table th,.activity4-admin-report-table td{padding:10px 12px;border:1px solid #dcefe3;text-align:left;vertical-align:top;}",
      ".activity4-admin-report-table th{background:#0b8c42;color:#fff;font-size:13px;}",
      ".activity4-admin-report-value{padding:12px 14px;border-radius:14px;border:1px solid #dcefe3;background:#fff;color:#10261f;line-height:1.65;}",
      ".activity4-admin-report-value.is-empty{color:#71877f;background:#f8fbf9;}",
      ".activity4-admin-report-empty{padding:16px;border-radius:16px;border:1px dashed #cfe3d7;background:#fbfefd;color:#5b7368;line-height:1.6;}",
      "@media (max-width: 720px){.activity4-admin-report-modal{padding:12px;align-items:flex-end;}.activity4-admin-report-panel{max-height:92vh;padding:16px;border-radius:22px 22px 16px 16px;}}",
    ].join("");
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById(MODAL_ID);
    if (modal) {
      return modal;
    }

    ensureStyles();
    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.className = "activity4-admin-report-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="activity4-admin-report-panel" role="dialog" aria-modal="true" aria-labelledby="activity4-admin-report-title">
        <div class="activity4-admin-report-head">
          <div>
            <h2 id="activity4-admin-report-title">Reporte del aprendiz</h2>
            <p id="activity4-admin-report-subtitle">Consulta administrativa del formulario local.</p>
          </div>
          <button class="activity4-admin-report-close" type="button" aria-label="Cerrar">×</button>
        </div>
        <div class="activity4-admin-report-meta" id="activity4-admin-report-meta"></div>
        <div id="activity4-admin-report-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeModal();
      }
    });
    modal.querySelector(".activity4-admin-report-close").addEventListener("click", closeModal);
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });

    return modal;
  }

  function closeModal() {
    const modal = document.getElementById(MODAL_ID);
    if (!modal) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.removeProperty("overflow");
  }

  function openModal(payload) {
    const modal = ensureModal();
    modal.querySelector("#activity4-admin-report-title").textContent = payload.title || "Reporte del aprendiz";
    modal.querySelector("#activity4-admin-report-subtitle").textContent = payload.subtitle || "";
    modal.querySelector("#activity4-admin-report-meta").textContent = payload.meta || "";
    modal.querySelector("#activity4-admin-report-body").innerHTML =
      payload.bodyHtml || '<div class="activity4-admin-report-empty">Sin contenido disponible.</div>';
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function buildContext(snapshot) {
    const identity = snapshot.identity || {};
    const selection = snapshot.selection || {};
    const fullName = String(identity.fullName || "").trim();
    const ficha = String(identity.ficha || selection.ficha || "").trim();
    const grupo = String(selection.grupo || "").trim();

    return {
      fullName: fullName || "Aprendiz sin identificar",
      ficha: ficha || "Sin ficha",
      grupo: grupo || "Sin grupo",
      updatedAt: snapshot.meta && snapshot.meta.updatedAt ? snapshot.meta.updatedAt : "",
      updatedBy: snapshot.meta && snapshot.meta.updatedBy ? snapshot.meta.updatedBy : "",
    };
  }

  function hasReportableAnswers(state) {
    return Object.keys(state || {}).some(function (key) {
      return hasMeaningfulValue(state[key]);
    });
  }

  function handleOpenReport() {
    if (!source || typeof source.getSnapshot !== "function") {
      openModal({
        title: "Reporte del aprendiz",
        subtitle: "No se pudo leer el formulario actual.",
        meta: "",
        bodyHtml: '<div class="activity4-admin-report-empty">La fuente del formulario no esta disponible en esta pagina.</div>',
      });
      return;
    }

    const snapshot = source.getSnapshot();
    const state = snapshot && snapshot.state ? snapshot.state : {};
    const context = buildContext(snapshot || {});
    const metaParts = [
      `Aprendiz: ${context.fullName}`,
      `Ficha: ${context.ficha}`,
      `Grupo: ${context.grupo}`,
    ];

    if (context.updatedAt) {
      metaParts.push(`Ultima actualizacion: ${formatDate(context.updatedAt)}`);
    }
    if (context.updatedBy) {
      metaParts.push(`Actualizado por: ${context.updatedBy}`);
    }

    if (!String(state["actividad4:nombre_completo"] || "").trim() || !String(state["actividad4:ficha"] || "").trim()) {
      openModal({
        title: "Reporte del aprendiz",
        subtitle: "Aun no hay identificacion completa en este formulario.",
        meta: metaParts.join(" | "),
        bodyHtml:
          '<div class="activity4-admin-report-empty">Para visualizar el reporte, primero debe estar diligenciado el nombre completo y el numero de ficha en este formulario local.</div>',
      });
      return;
    }

    if (!hasReportableAnswers(state)) {
      openModal({
        title: "Reporte del aprendiz",
        subtitle: `${context.fullName} | Actividad 4`,
        meta: metaParts.join(" | "),
        bodyHtml:
          '<div class="activity4-admin-report-empty">Todavia no hay respuestas registradas para mostrar en el reporte.</div>',
      });
      return;
    }

    openModal({
      title: "Reporte del aprendiz",
      subtitle: `${context.fullName} | Diagnostico inicial del contexto digital local`,
      meta: metaParts.join(" | "),
      bodyHtml: renderGuide2ResponsesBody(state, context),
    });
  }

  function injectButton() {
    if (!auth || !source || typeof source.isActivity4FormPage !== "function") {
      return;
    }

    const session = auth.getCurrentSession && auth.getCurrentSession();
    if (!session || session.role !== "admin") {
      return;
    }

    if (!source.isActivity4FormPage()) {
      return;
    }

    const actions = document.querySelector(".activity4-actions");
    if (!actions || actions.querySelector("[data-admin-report-trigger]")) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-drive";
    button.textContent = "Ver reporte del aprendiz";
    button.setAttribute("data-admin-report-trigger", "true");
    button.addEventListener("click", handleOpenReport);
    actions.appendChild(button);
  }

  document.addEventListener("DOMContentLoaded", function () {
    injectButton();
  });
})();
