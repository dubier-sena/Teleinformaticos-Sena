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
      return;
    }

    body.innerHTML = `
      <div class="student-project-delivery-card">
        <div class="student-project-delivery-card__intro">
          <p>
            Un integrante del grupo puede subir el avance del proyecto. El historial quedara visible
            para todos los aprendices vinculados a este proyecto.
          </p>
        </div>
        <div class="student-project-delivery-actions">
          <button class="app-btn app-btn--primary" type="button" id="student-project-delivery-open"${uploadEnabled ? "" : " disabled"}>
            Subir avance del proyecto
          </button>
        </div>
        ${!uploadEnabled ? `
          <div class="student-project-delivery-status is-warning">
            La subida del avance esta disponible solo para la sesion del aprendiz vinculada al proyecto.
          </div>` : ""}
      </div>
      <div class="student-project-delivery-history-wrap">
        <h4>Historial compartido del proyecto</h4>
        ${buildDeliveryHistoryMarkup(deliveries)}
      </div>
    `;

    if (uploadEnabled) {
      getById("student-project-delivery-open")?.addEventListener("click", function () {
        openProjectDeliveryModal(project, session);
      });
    }
  }

  function openProjectDeliveryModal(project, session) {
    if (!sharedDelivery || typeof sharedDelivery.openDeliveryModal !== "function") {
      return;
    }
    sharedDelivery.openDeliveryModal({
      guideLabel: "Etapa Productiva",
      activityLabel: "Avance del Proyecto",
      activityTitle: project.projectTitle || "Proyecto",
      activityNumber: "",
      projectId: project.id,
      ficha: project.ficha || session?.user?.ficha || "",
      grupo: project.grupo || session?.user?.grupo || "",
    });
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
    openProjectDeliveryModal: openProjectDeliveryModal,
  };
})();
