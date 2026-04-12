(function () {
  const auth = window.portalAuth || null;
  const store = window.productiveStageStore || null;
  const sharedDelivery = window.sharedAppsScriptDelivery || null;

  const PROJECT_DOCUMENTS = [
    {
      id: "ficha-inscripcion",
      type: "Documento base",
      title: "1. Ficha de inscripcion",
      description:
        "Formato inicial para registrar el proyecto y consolidar los datos principales del grupo.",
      href: "assets/materiales/etapa-productiva/1.%20Ficha%20de%20inscripcion.docx",
      fileName: "1. Ficha de inscripcion.docx",
    },
    {
      id: "formato-proyecto",
      type: "Plantilla principal",
      title: "2. Formato Proyecto Productivo",
      description:
        "Documento guia para estructurar el proyecto, objetivos, propuesta y desarrollo tecnico.",
      href: "assets/materiales/etapa-productiva/2.%20Formato%20Proyecto%20Productivo.docx",
      fileName: "2. Formato Proyecto Productivo.docx",
    },
    {
      id: "anexo-financiero",
      type: "Anexo financiero",
      title: "2.1. Anexo financiero",
      description:
        "Archivo de apoyo para costos, presupuestos, ingresos estimados y sostenibilidad del proyecto.",
      href: "assets/materiales/etapa-productiva/2.1.%20Anexo%20financiero.xlsx",
      fileName: "2.1. Anexo financiero.xlsx",
    },
  ];

  let currentState = {
    snapshot: null,
    viewModel: null,
    session: null,
  };

  function getById(id) {
    return document.getElementById(id);
  }

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
      return "Sin fecha";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Sin fecha";
    }

    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getMainProject(viewModel) {
    const projects = Array.isArray(viewModel?.projects) ? viewModel.projects : [];
    return projects.length ? projects[0] : null;
  }

  function isStudentUploader(session) {
    return !!(session && session.role === "student" && session.user);
  }

  function buildResourcesMarkup() {
    return `
      <div class="student-project-downloads">
        ${PROJECT_DOCUMENTS.map(function (documentItem) {
          return `
            <article class="student-project-download-card">
              <span class="student-project-download-card__type">${escapeHtml(documentItem.type)}</span>
              <h4>${escapeHtml(documentItem.title)}</h4>
              <p>${escapeHtml(documentItem.description)}</p>
              <div class="student-project-download-card__actions">
                <a class="app-btn app-btn--primary" href="${escapeHtml(documentItem.href)}" download="${escapeHtml(documentItem.fileName)}">
                  Descargar
                </a>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function buildDeliveryHistoryMarkup(deliveries) {
    if (!deliveries.length) {
      return '<p class="student-project-placeholder">Todavia no se ha cargado ningun avance para este proyecto.</p>';
    }

    return `
      <div class="student-project-delivery-history">
        ${deliveries
          .map(function (delivery) {
            return `
              <article class="student-project-delivery-history__item">
                <div class="student-project-delivery-history__top">
                  <strong>${escapeHtml(delivery.savedFileName || "Archivo registrado")}</strong>
                  <span>${escapeHtml(formatDate(delivery.uploadedAt))}</span>
                </div>
                <p>Subido por ${escapeHtml(delivery.uploadedByName || "Aprendiz del grupo")}</p>
                ${
                  delivery.driveUrl
                    ? `<a class="student-project-delivery-history__link" href="${escapeHtml(delivery.driveUrl)}" target="_blank" rel="noopener noreferrer">Abrir archivo en Drive</a>`
                    : ""
                }
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderProjectResources() {
    const body = getById("student-project-resources-body");
    if (!body) {
      return;
    }

    body.innerHTML = buildResourcesMarkup();
  }

  function renderProjectDeliveryStatus(message, type) {
    const status = getById("student-project-delivery-status");
    if (!status) {
      return;
    }

    status.className = "student-project-delivery-status" + (type ? ` is-${type}` : "");
    status.textContent = message;
  }

  function updateProjectDeliverySummary(project, session) {
    const projectMeta = getById("student-project-delivery-meta");
    const summaryPath = getById("student-project-delivery-path");
    const fileInput = getById("student-project-delivery-file");
    const file = fileInput?.files?.[0] || null;
    const fullName = String(session?.user?.fullName || "").trim();
    const previewName =
      typeof sharedDelivery?.buildDeliveryFileNamePreview === "function"
        ? sharedDelivery.buildDeliveryFileNamePreview(fullName || "Aprendiz", "Avance-Proyecto", file?.name || ".ext")
        : (file?.name || "Archivo pendiente");

    if (projectMeta) {
      projectMeta.innerHTML = project
        ? `
            <strong>Proyecto:</strong> ${escapeHtml(project.projectTitle || "Proyecto sin titulo")}<br>
            <strong>Ficha:</strong> ${escapeHtml(project.ficha || session?.user?.ficha || "Sin ficha")}<br>
            <strong>Grupo:</strong> ${escapeHtml(project.grupo || session?.user?.grupo || "Sin grupo")}<br>
            <strong>Integrante que sube:</strong> ${escapeHtml(fullName || "No identificado")}
          `
        : '<strong>Proyecto:</strong> pendiente de vincular';
    }

    if (summaryPath) {
      summaryPath.textContent = project
        ? `Archivo previsto: ${previewName}`
        : "Cuando tu proyecto este vinculado, aqui veras el archivo final que se enviara a Drive.";
    }
  }

  function renderProjectDelivery() {
    const body = getById("student-project-delivery-body");
    if (!body) {
      return;
    }

    const project = getMainProject(currentState.viewModel);
    const session = currentState.session;
    const deliveries =
      project && store && typeof store.getProjectDeliveries === "function"
        ? store.getProjectDeliveries(currentState.snapshot, project.id)
        : [];
    const uploadEnabled = isStudentUploader(session);

    if (!project) {
      body.innerHTML = `
        <div class="student-project-delivery-card">
          <p class="student-project-placeholder">
            Cuando el instructor vincule tu nombre a un proyecto, aqui podras subir el avance grupal y ver su historial.
          </p>
        </div>
      `;
      renderProjectDeliveryStatus(
        "Todavia no hay proyecto vinculado para habilitar la entrega del avance.",
        "warning"
      );
      return;
    }

    body.innerHTML = `
      <div class="student-project-delivery-card">
        <div class="student-project-delivery-card__intro">
          <p>
            Un integrante del grupo puede subir el avance del proyecto. El historial quedara visible para todos
            los aprendices vinculados a este proyecto.
          </p>
        </div>
        <div class="student-project-delivery-meta" id="student-project-delivery-meta"></div>
        <label class="student-project-delivery-field">
          <span>Archivo del avance</span>
          <input id="student-project-delivery-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip">
        </label>
        <div class="student-project-delivery-path" id="student-project-delivery-path"></div>
        <div class="student-project-delivery-actions">
          <button class="app-btn app-btn--primary" type="button" id="student-project-delivery-submit"${uploadEnabled ? "" : " disabled"}>
            Subir avance del proyecto
          </button>
        </div>
        <div class="student-project-delivery-status" id="student-project-delivery-status">
          Selecciona el archivo del avance para enviarlo de forma segura.
        </div>
      </div>
      <div class="student-project-delivery-history-wrap">
        <h4>Historial compartido del proyecto</h4>
        ${buildDeliveryHistoryMarkup(deliveries)}
      </div>
    `;

      updateProjectDeliverySummary(project, session);
    if (!uploadEnabled) {
      renderProjectDeliveryStatus(
        "La subida del avance esta disponible solo para la sesion del aprendiz vinculada al proyecto.",
        "warning"
      );
    }
    getById("student-project-delivery-file")?.addEventListener("change", function () {
      updateProjectDeliverySummary(project, session);
    });
    getById("student-project-delivery-submit")?.addEventListener("click", handleProjectDeliverySubmit);
  }

  async function handleProjectDeliverySubmit() {
    const project = getMainProject(currentState.viewModel);
    const session = currentState.session;
    const fileInput = getById("student-project-delivery-file");
    const file = fileInput?.files?.[0] || null;

    if (!project || !session || !isStudentUploader(session) || !store || !sharedDelivery) {
      renderProjectDeliveryStatus(
        "No fue posible preparar la entrega del avance desde esta sesion.",
        "error"
      );
      return;
    }

    try {
      sharedDelivery.validateFile(file);
    } catch (error) {
      renderProjectDeliveryStatus(error.message, "error");
      return;
    }

    const submitButton = getById("student-project-delivery-submit");
    submitButton?.setAttribute("disabled", "disabled");
    renderProjectDeliveryStatus("Subiendo avance del proyecto a Drive...", "loading");

    try {
      const fileBase64 = await sharedDelivery.readFileAsBase64(file);
      const response = await sharedDelivery.uploadToAppsScript({
        guideLabel: "Etapa Productiva",
        activityLabel: "Avance-Proyecto",
        activityNumber: "",
        activityTitle: project.projectTitle || "Proyecto",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: fileBase64,
        fullName: session.user.fullName,
        ficha: project.ficha || session.user.ficha,
        grupo: project.grupo || session.user.grupo,
        institucion: project.inst || session.user.inst,
        pageFile: window.location.pathname.split("/").pop() || "",
        submittedAt: new Date().toISOString(),
        projectId: project.id,
        projectTitle: project.projectTitle || "Proyecto",
      });

      const uploadedAt = new Date().toISOString();
      const nextSnapshot = store.appendProjectDeliveryToSnapshot(currentState.snapshot, {
        deliveryId: `${project.id}:${uploadedAt}`,
        projectId: project.id,
        projectTitle: project.projectTitle || "Proyecto",
        uploadedAt: uploadedAt,
        uploadedByName: session.user.fullName,
        uploadedByUsernameKey: session.user.usernameKey,
        driveUrl: response.driveUrl || "",
        savedFileName: response.savedFileName || file.name,
      });

      const saveResult = await store.saveSnapshot(nextSnapshot);
      currentState.snapshot = nextSnapshot;
      renderProjectDelivery();
      if (!saveResult.ok) {
        renderProjectDeliveryStatus(
          "El archivo quedo en Drive, pero no fue posible guardar el historial del proyecto en este momento.",
          "warning"
        );
      } else if (saveResult.savedCloud === false && saveResult.savedLocal) {
        renderProjectDeliveryStatus(
          "El archivo quedo en Drive y el historial se guardo localmente en este navegador.",
          "warning"
        );
      } else {
        renderProjectDeliveryStatus(
          "Avance registrado correctamente y visible para el proyecto.",
          "success"
        );
      }
    } catch (error) {
      renderProjectDeliveryStatus(
        error?.message || "No fue posible completar la entrega del avance.",
        "error"
      );
    } finally {
      submitButton?.removeAttribute("disabled");
    }
  }

  function render(state) {
    currentState = Object.assign(
      {
        snapshot: null,
        viewModel: { projects: [] },
        session: null,
      },
      state || {}
    );

    renderProjectResources();
    renderProjectDelivery();
  }

  window.productiveStageProjectDelivery = {
    render: render,
    renderProjectResources: renderProjectResources,
    handleProjectDeliverySubmit: handleProjectDeliverySubmit,
  };
})();
