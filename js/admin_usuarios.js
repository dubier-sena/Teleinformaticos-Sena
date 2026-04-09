(function () {
  const auth = window.portalAuth;
  if (!auth) {
    return;
  }

  let allUsers = [];
  const GUIDE2_RESPONSE_FILES = {
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": {
      cloudFileName: "10a_guia2.html",
    },
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": {
      cloudFileName: "10b_guia2.html",
    },
  };
  const GUIDE2_RESPONSE_KEYS = [
    "contexto-q1",
    "contexto-rel-drive",
    "contexto-rel-excel",
    "contexto-rel-canva",
    "contexto-rel-whatsapp",
    "contexto-tendero",
    "contexto-q4",
    "contexto-docente-correo-si",
    "contexto-docente-correo-porque",
    "contexto-docente-classroom-si",
    "contexto-docente-classroom-porque",
    "contexto-docente-whatsapp-si",
    "contexto-docente-whatsapp-porque",
    "contexto-docente-usb-si",
    "contexto-docente-usb-porque",
    "contexto-nube",
    "contexto-backup-verificar",
    "contexto-backup-seleccionar",
    "contexto-backup-copiar",
    "contexto-backup-confirmar",
    "contexto-info-problem",
    "contexto-uso-word-si",
    "contexto-uso-word-porque",
    "contexto-uso-excel-si",
    "contexto-uso-excel-porque",
    "contexto-uso-drive-si",
    "contexto-uso-drive-porque",
    "contexto-uso-correo-si",
    "contexto-uso-correo-porque",
    "contexto-uso-meet-si",
    "contexto-uso-meet-porque",
    "contexto-otanche",
  ];

  function getById(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return map[char];
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

  function readJson(value, fallback) {
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function hasMeaningfulValue(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value);
    }
    return String(value ?? "").trim().length > 0;
  }

  function hasGuide2Responses(state) {
    return GUIDE2_RESPONSE_KEYS.some((key) => hasMeaningfulValue(state?.[key]));
  }

  function getGuide2ResponseConfig(fileName) {
    const config = GUIDE2_RESPONSE_FILES[fileName];
    if (!config) {
      return null;
    }

    return {
      ...config,
      localStateKey: auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey || "",
      title: auth.getGuideTitle(fileName),
    };
  }

  function getGuide2ScopeKey(usernameKey) {
    return `student:${String(usernameKey || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")}`;
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse(snapshot?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pickLatestSnapshot(cloudSnapshot, localSnapshot) {
    if (!cloudSnapshot) {
      return localSnapshot;
    }
    if (!localSnapshot) {
      return cloudSnapshot;
    }
    return snapshotTime(cloudSnapshot) >= snapshotTime(localSnapshot) ? cloudSnapshot : localSnapshot;
  }

  function readGuide2LocalSnapshot(usernameKey, guideConfig) {
    if (!guideConfig?.localStateKey) {
      return null;
    }

    const storageKey = auth.getStudentStorageKey(usernameKey, guideConfig.localStateKey, {
      area: "guide-data",
    });
    const state = readJson(localStorage.getItem(storageKey), null);
    if (!state || typeof state !== "object" || !hasGuide2Responses(state)) {
      return null;
    }

    const meta = readJson(localStorage.getItem(`${storageKey}__meta`), null);
    return {
      state,
      updatedAt: meta?.updatedAt || "",
      updatedBy: meta?.updatedBy || "",
      sourceLabel: "Copia local disponible en este navegador",
    };
  }

  async function readGuide2CloudSnapshot(usernameKey, guideConfig) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function" ||
      !guideConfig?.cloudFileName
    ) {
      return null;
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(
        getGuide2ScopeKey(usernameKey),
        guideConfig.cloudFileName
      );
      if (!snapshot?.state || !hasGuide2Responses(snapshot.state)) {
        return null;
      }

      return {
        ...snapshot,
        sourceLabel: "Sincronizacion compartida",
      };
    } catch {
      return null;
    }
  }

  async function loadGuide2Responses(usernameKey, fileName) {
    const guideConfig = getGuide2ResponseConfig(fileName);
    if (!guideConfig) {
      return {
        guideConfig: null,
        snapshot: null,
      };
    }

    const [cloudSnapshot, localSnapshot] = await Promise.all([
      readGuide2CloudSnapshot(usernameKey, guideConfig),
      Promise.resolve(readGuide2LocalSnapshot(usernameKey, guideConfig)),
    ]);

    return {
      guideConfig,
      snapshot: pickLatestSnapshot(cloudSnapshot, localSnapshot),
    };
  }

  function renderAnswerValue(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return '<div class="answer-value empty">Sin respuesta registrada.</div>';
    }

    return `<div class="answer-value">${escapeHtml(text)}</div>`;
  }

  function renderAnswerTable(headers, rows) {
    const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const rowHtml = rows
      .map(
        (row) => `
          <tr>
            ${row
              .map(
                (cell) =>
                  `<td>${
                    hasMeaningfulValue(cell)
                      ? escapeHtml(String(cell)).replace(/\r?\n/g, "<br>")
                      : "Sin respuesta"
                  }</td>`
              )
              .join("")}
          </tr>
        `
      )
      .join("");

    return `
      <div class="answer-table-wrap">
        <table class="answer-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderGuide2ResponsesBody(state) {
    return `
      <div class="answers-grid">
        <article class="answer-card">
          <h3>Identificacion registrada en el formulario.</h3>
          ${renderAnswerTable(
            ["Campo", "Respuesta del aprendiz"],
            [
              ["Nombre completo", state["actividad4:nombre_completo"]],
              ["Numero de ficha", state["actividad4:ficha"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>1. \u00bfCu\u00e1l de las siguientes opciones describe mejor qu\u00e9 es una herramienta TIC?</h3>
          ${renderAnswerValue(state["contexto-q1"])}
        </article>

        <article class="answer-card">
          <h3>2. Relaciona cada herramienta con su funci\u00f3n principal.</h3>
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

        <article class="answer-card">
          <h3>3. Recomendaci\u00f3n para el tendero de Puerto Boyac\u00e1.</h3>
          ${renderAnswerValue(state["contexto-tendero"])}
        </article>

        <article class="answer-card">
          <h3>4. Acci\u00f3n que NO corresponde a un procesador de texto.</h3>
          ${renderAnswerValue(state["contexto-q4"])}
        </article>

        <article class="answer-card">
          <h3>5. Herramientas para enviar el mismo mensaje a 30 estudiantes.</h3>
          ${renderAnswerTable(
            ["Herramienta", "\u00bfLa usar\u00eda?", "\u00bfPor qu\u00e9 la usar\u00eda?"],
            [
              [
                "Correo electr\u00f3nico (Gmail, Outlook)",
                state["contexto-docente-correo-si"],
                state["contexto-docente-correo-porque"],
              ],
              [
                "Google Classroom o plataforma educativa",
                state["contexto-docente-classroom-si"],
                state["contexto-docente-classroom-porque"],
              ],
              [
                "WhatsApp con lista de difusi\u00f3n",
                state["contexto-docente-whatsapp-si"],
                state["contexto-docente-whatsapp-porque"],
              ],
              ["USB copiado uno por uno", state["contexto-docente-usb-si"], state["contexto-docente-usb-porque"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>6. \u00bfQu\u00e9 significa guardar en la nube?</h3>
          ${renderAnswerValue(state["contexto-nube"])}
        </article>

        <article class="answer-card">
          <h3>7. Orden propuesto para crear una copia de seguridad.</h3>
          ${renderAnswerTable(
            ["Paso", "Orden escrito"],
            [
              [
                "Verificar que el archivo se abrio correctamente en la ubicacion de respaldo",
                state["contexto-backup-verificar"],
              ],
              ["Seleccionar el archivo que deseas respaldar", state["contexto-backup-seleccionar"]],
              [
                "Copiar o subir el archivo a una memoria USB o servicio en la nube",
                state["contexto-backup-copiar"],
              ],
              [
                "Confirmar que el archivo original sigue disponible en su ubicacion original",
                state["contexto-backup-confirmar"],
              ],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>8. Situaci\u00f3n que representa un problema de gesti\u00f3n de la informaci\u00f3n.</h3>
          ${renderAnswerValue(state["contexto-info-problem"])}
        </article>

        <article class="answer-card">
          <h3>9. Herramientas digitales que ya ha usado el aprendiz.</h3>
          ${renderAnswerTable(
            ["Herramienta", "\u00bfLa ha usado?", "\u00bfPara qu\u00e9 la us\u00f3?"],
            [
              ["Microsoft Word o Writer", state["contexto-uso-word-si"], state["contexto-uso-word-porque"]],
              ["Microsoft Excel o Calc", state["contexto-uso-excel-si"], state["contexto-uso-excel-porque"]],
              ["Google Drive", state["contexto-uso-drive-si"], state["contexto-uso-drive-porque"]],
              ["Correo electronico", state["contexto-uso-correo-si"], state["contexto-uso-correo-porque"]],
              ["Zoom o Google Meet", state["contexto-uso-meet-si"], state["contexto-uso-meet-porque"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>10. Recomendaciones para organizar la informaci\u00f3n del emprendedor de Otanche.</h3>
          ${renderAnswerValue(state["contexto-otanche"])}
        </article>
      </div>
    `;
  }

  function openGuide2ResponsesModal(options) {
    const modal = getById("guide2-responses-modal");
    if (!modal) {
      return;
    }

    const title = getById("guide2-responses-title");
    const subtitle = getById("guide2-responses-subtitle");
    const meta = getById("guide2-responses-meta");
    const body = getById("guide2-responses-body");
    if (!title || !subtitle || !meta || !body) {
      return;
    }

    title.textContent = options.title || "Respuestas del cuestionario 3.2.1";
    subtitle.textContent = options.subtitle || "Consulta administrativa de la Guia 2.";
    meta.textContent = options.meta || "";
    body.innerHTML = options.bodyHtml || '<div class="response-status">Sin contenido disponible.</div>';
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeGuide2ResponsesModal() {
    const modal = getById("guide2-responses-modal");
    if (!modal || modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  async function handleViewGuide2Responses(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-view-guide2") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    const guide = user?.progress?.guides?.find((item) => item.fileName === fileName);

    if (!user || !fileName) {
      setFeedback("No fue posible identificar el usuario o la guia seleccionada.", "error");
      return;
    }

    openGuide2ResponsesModal({
      title: "Respuestas del cuestionario 3.2.1",
      subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
      meta: "Cargando respuestas guardadas...",
      bodyHtml: '<div class="response-status">Consultando la copia sincronizada y el respaldo local del aprendiz.</div>',
    });

    const { guideConfig, snapshot } = await loadGuide2Responses(usernameKey, fileName);
    const metaParts = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${user.ficha}`,
      `Guia: ${guide?.title || guideConfig?.title || auth.getGuideTitle(fileName)}`,
    ];

    if (!snapshot) {
      openGuide2ResponsesModal({
        title: "Respuestas del cuestionario 3.2.1",
        subtitle: `${user.fullName} | ${guideConfig?.title || auth.getGuideTitle(fileName)}`,
        meta: metaParts.join(" | "),
        bodyHtml:
          '<div class="response-status">Este aprendiz aun no tiene respuestas guardadas en el punto 3.2.1 de la Guia 2 o la sincronizacion todavia no se ha completado.</div>',
      });
      return;
    }

    if (snapshot.sourceLabel) {
      metaParts.push(`Origen: ${snapshot.sourceLabel}`);
    }
    metaParts.push(`Ultima actualizacion: ${formatDate(snapshot.updatedAt)}`);
    if (snapshot.updatedBy) {
      metaParts.push(`Actualizado por: ${snapshot.updatedBy}`);
    }

    openGuide2ResponsesModal({
      title: "Respuestas del cuestionario 3.2.1",
      subtitle: `${user.fullName} | ${guideConfig?.title || auth.getGuideTitle(fileName)}`,
      meta: metaParts.join(" | "),
      bodyHtml: renderGuide2ResponsesBody(snapshot.state || {}),
    });
  }

  function setFeedback(message, type) {
    const box = getById("admin-feedback");
    if (!box) {
      return;
    }

    if (!message) {
      box.className = "admin-feedback";
      box.textContent = "";
      return;
    }

    box.className = `admin-feedback ${type || "success"}`;
    box.textContent = message;
  }

  function setStorageContext(message) {
    const copy = getById("storage-context-copy");
    if (copy) {
      copy.textContent = message;
    }
  }

  function buildGuideUrl(user, fileName) {
    const params = new URLSearchParams({
      ficha: user.ficha,
      inst: user.inst,
      grupo: user.grupo,
    });
    return `${fileName}?${params.toString()}`;
  }

  function renderSummary(users) {
    const fichas = new Set(users.map((user) => user.ficha));
    const activeUsers = users.filter((user) => (user.progress?.percent || 0) > 0);

    getById("summary-users").textContent = String(users.length);
    getById("summary-active").textContent = String(activeUsers.length);
    getById("summary-fichas").textContent = String(fichas.size);
    getById("summary-admin").textContent = "Protegido";
  }

  function renderEmptyState(message) {
    const container = getById("users-container");
    if (!container) {
      return;
    }

    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function buildProgressCard(user, guide) {
    const fillWidth = Math.max(0, Math.min(100, Number(guide.percent) || 0));
    const guide2Config = getGuide2ResponseConfig(guide.fileName);
    const sourceText =
      guide.source === "meta" || guide.source === "network"
        ? `\u00daltima actualizaci\u00f3n: ${formatDate(guide.updatedAt)}`
        : "Resumen reconstruido desde el almacenamiento local.";

    return `
      <article class="progress-card">
        <h4>${escapeHtml(guide.title)}</h4>
        <div class="progress-meta">
          <span>${guide.completed} / ${guide.total || 0}</span>
          <strong>${fillWidth}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${fillWidth}%"></div>
        </div>
        <div class="progress-actions">
          <a class="btn ghost" href="${escapeHtml(buildGuideUrl(user, guide.fileName))}">Abrir gu\u00eda</a>
          ${
            guide2Config
              ? `<button class="btn secondary" type="button" data-view-guide2="${escapeHtml(
                  guide.fileName
                )}" data-user="${escapeHtml(user.usernameKey)}">Ver respuestas 3.2.1</button>`
              : ""
          }
          <button class="btn warn" type="button" data-reset-guide="${escapeHtml(
            guide.fileName
          )}" data-user="${escapeHtml(user.usernameKey)}">Reiniciar gu\u00eda</button>
        </div>
        <div class="progress-source">${escapeHtml(sourceText)}</div>
      </article>
    `;
  }

  function buildUserCard(user) {
    const guides = user.progress?.guides || [];
    const createdText = formatDate(user.createdAt);
    const updatedText = formatDate(user.updatedAt);
    const overall = user.progress?.percent || 0;

    return `
      <article class="user-card" data-user-card="${escapeHtml(user.usernameKey)}">
        <div class="user-top">
          <div>
            <h3>${escapeHtml(user.fullName)}</h3>
            <div class="user-meta">
              <div>Usuario: <strong>${escapeHtml(user.username)}</strong></div>
              <div>Ficha ${escapeHtml(user.ficha)} | ${escapeHtml(user.grupo)} | ${escapeHtml(
      user.inst
    )}</div>
              <div>Creado: ${escapeHtml(createdText)} | \u00daltima edici\u00f3n de cuenta: ${escapeHtml(
      updatedText
    )}</div>
            </div>
          </div>
          <div class="user-badge">${overall}%</div>
        </div>

        <div class="user-section-title">Cambiar contrase\u00f1a</div>
        <form class="password-row" data-password-form="${escapeHtml(user.usernameKey)}">
          <input
            type="password"
            name="password"
            minlength="4"
            maxlength="60"
            placeholder="Nueva contrase\u00f1a para ${escapeHtml(user.username)}"
          >
          <button class="btn primary" type="submit">Actualizar</button>
        </form>

        <div class="user-note">
          Si necesitas reiniciar el trabajo del aprendiz, puedes borrar una gu\u00eda concreta o todo su avance.
        </div>

        <div class="user-actions" style="margin-top:12px">
          <button class="btn warn" type="button" data-reset-all="${escapeHtml(
            user.usernameKey
          )}">Reiniciar todo el avance</button>
        </div>

        <div class="user-section-title" style="margin-top:18px">Avance por gu\u00eda</div>
        <div class="progress-grid">
          ${guides.map((guide) => buildProgressCard(user, guide)).join("")}
        </div>
      </article>
    `;
  }

  function getFilteredUsers() {
    const search = (getById("user-search")?.value || "").trim().toLowerCase();
    if (!search) {
      return allUsers;
    }

    return allUsers.filter((user) => {
      const haystack = [user.fullName, user.username, user.ficha, user.grupo, user.inst]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  function renderUsers() {
    const users = getFilteredUsers();
    renderSummary(allUsers);

    if (!users.length) {
      renderEmptyState("No hay usuarios que coincidan con la b\u00fasqueda actual.");
      return;
    }

    const container = getById("users-container");
    if (!container) {
      return;
    }

    container.innerHTML = users.map((user) => buildUserCard(user)).join("");
  }

  async function refreshUsers() {
    setFeedback("Actualizando usuarios y avances...", "success");
    const context = await auth.getStorageContext();
    setStorageContext(context.message);

    try {
      allUsers = await auth.fetchStudentsWithProgress();
      setFeedback("", "success");
    } catch (error) {
      allUsers = auth.getStudentsWithProgress();
      setFeedback(
        "No fue posible leer el servidor compartido. Se muestra la copia local disponible.",
        "error"
      );
    }

    renderUsers();
  }

  async function handlePasswordSubmit(form) {
    const usernameKey = form.getAttribute("data-password-form") || "";
    const input = form.querySelector("input[name='password']");
    const password = input?.value || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No se encontr\u00f3 el usuario solicitado.", "error");
      return;
    }

    const result = await auth.updateStudentPassword(usernameKey, password);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    if (input) {
      input.value = "";
    }
    setFeedback(`Contrase\u00f1a actualizada para ${user.fullName}.`, "success");
    await refreshUsers();
  }

  async function handleResetGuide(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-reset-guide") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user || !fileName) {
      setFeedback("No fue posible identificar el usuario o la gu\u00eda.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Se reiniciar\u00e1 el avance de ${user.fullName} en ${auth.getGuideTitle(fileName)}. \u00bfDeseas continuar?`
    );
    if (!confirmed) {
      return;
    }

    const result = await auth.resetStudentGuideProgress(usernameKey, fileName);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    setFeedback(`Avance reiniciado para ${user.fullName} en ${auth.getGuideTitle(fileName)}.`, "success");
    await refreshUsers();
  }

  async function handleResetAll(button) {
    const usernameKey = button.getAttribute("data-reset-all") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No fue posible identificar el usuario seleccionado.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Se borrar\u00e1 todo el avance guardado de ${user.fullName}. \u00bfDeseas continuar?`
    );
    if (!confirmed) {
      return;
    }

    const result = await auth.resetStudentAllProgress(usernameKey);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    setFeedback(`Todo el avance de ${user.fullName} fue reiniciado.`, "success");
    await refreshUsers();
  }

  function bindEvents() {
    getById("refresh-users")?.addEventListener("click", () => {
      refreshUsers();
    });

    getById("user-search")?.addEventListener("input", () => {
      renderUsers();
    });

    document.addEventListener("submit", async (event) => {
      const form = event.target.closest("[data-password-form]");
      if (!form) {
        return;
      }

      event.preventDefault();
      await handlePasswordSubmit(form);
    });

    document.addEventListener("click", async (event) => {
      const closeGuide2ModalButton = event.target.closest("[data-close-guide2-modal]");
      if (closeGuide2ModalButton) {
        closeGuide2ResponsesModal();
        return;
      }

      const viewGuide2Button = event.target.closest("[data-view-guide2]");
      if (viewGuide2Button) {
        await handleViewGuide2Responses(viewGuide2Button);
        return;
      }

      const resetGuideButton = event.target.closest("[data-reset-guide]");
      if (resetGuideButton) {
        await handleResetGuide(resetGuideButton);
        return;
      }

      const resetAllButton = event.target.closest("[data-reset-all]");
      if (resetAllButton) {
        await handleResetAll(resetAllButton);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeGuide2ResponsesModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await refreshUsers();
  });
})();
