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
      deliveryLabel: "Ficha de Inscripcion",
    },
    {
      id: "formato-proyecto",
      type: "Plantilla principal",
      title: "2. Formato Proyecto Productivo",
      description:
        "Documento guia para estructurar el proyecto, objetivos, propuesta y desarrollo tecnico.",
      href: "assets/materiales/etapa-productiva/2.%20Formato%20Proyecto%20Productivo.docx",
      fileName: "2. Formato Proyecto Productivo.docx",
      // Grado 10 no tiene proyecto de Etapa Productiva este ano (ver
      // applyGrade10DocumentsOnlyView en productive_stage_student.js).
      hideForGrade10: true,
    },
    {
      id: "anexo-financiero",
      type: "Anexo financiero",
      title: "2.1. Anexo financiero",
      description:
        "Archivo de apoyo para costos, presupuestos, ingresos estimados y sostenibilidad del proyecto.",
      href: "assets/materiales/etapa-productiva/2.1.%20Anexo%20financiero.xlsx",
      fileName: "2.1. Anexo financiero.xlsx",
      hideForGrade10: true,
    },
    {
      id: "acuerdo-etapa-productiva",
      type: "Acuerdo del grupo",
      title: "Acuerdo de seleccion de Etapa Productiva",
      description:
        "Formato con los datos ya diligenciados de tu grupo (ficha). Descargalo, revisa tu fila, firmalo y vuelve a subirlo.",
      // El archivo VIVE en Drive (no en este repo publico): contiene cedula y
      // datos de TODO el grupo, no solo del aprendiz que lo descarga. El link
      // real por ficha se resuelve en tiempo de ejecucion via
      // PROJECT_INTEGRATIONS.fichaAcuerdoExcelUrls (ver project_integrations.js).
      hrefByFicha: true,
      fileName: "Acuerdo Etapa Productiva.xlsx",
      deliveryLabel: "Acuerdo de Etapa Productiva",
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
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
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

  // Grado 10 (Kennedy y SB) no tiene proyecto de Etapa Productiva este ano --
  // mismo criterio que isGrade10Ficha en productive_stage_student.js.
  function isGrade10Ficha(ficha) {
    const fichas = (auth && auth.FICHA_MAP) || {};
    const grupo = String((fichas[String(ficha || "")] || {}).grupo || "");
    return grupo.indexOf("10") === 0;
  }

  // Documentos "hrefByFicha": el archivo real no vive en este repo (puede traer
  // datos de todo el grupo, p. ej. el acuerdo con cedulas de los aprendices) sino
  // en una carpeta/archivo de Drive con permisos acotados a esa ficha. El link se
  // resuelve en tiempo de ejecucion desde PROJECT_INTEGRATIONS.fichaAcuerdoExcelUrls.
  function resolveFichaHref(ficha) {
    const urls = window.PROJECT_INTEGRATIONS && window.PROJECT_INTEGRATIONS.fichaAcuerdoExcelUrls;
    return (urls && urls[String(ficha || "")]) || "";
  }

  function buildResourcesMarkup() {
    const session = currentState.session;
    // Los documentos base (ficha de inscripcion, acuerdo) se entregan ANTES de
    // que exista un proyecto vinculado -- de hecho, el acuerdo es justamente lo
    // que inicia ese proceso. No condicionar la entrega a tener un proyecto ya
    // asignado (eso si aplica al "Avance del proyecto", ver renderProjectDelivery).
    const canUpload = isStudentUploader(session);
    const ficha = session?.user?.ficha || "";
    const grade10 = isGrade10Ficha(ficha);
    const visibleDocuments = PROJECT_DOCUMENTS.filter(function (documentItem) {
      return !(grade10 && documentItem.hideForGrade10);
    });

    return `
      <div class="student-project-downloads">
        ${visibleDocuments.map(function (documentItem) {
          const hasDelivery = !!documentItem.deliveryLabel;
          const deliveryBtn = hasDelivery
            ? `<button
                 class="app-btn app-btn--outline"
                 type="button"
                 data-delivery-doc="${escapeHtml(documentItem.id)}"
                 ${canUpload ? "" : "disabled"}
               >Entregar</button>`
            : "";

          const resolvedHref = documentItem.hrefByFicha ? resolveFichaHref(ficha) : documentItem.href;
          const downloadBtn = resolvedHref
            ? `<a class="app-btn app-btn--primary" href="${escapeHtml(resolvedHref)}" target="_blank" rel="noopener noreferrer" ${documentItem.hrefByFicha ? "" : `download="${escapeHtml(documentItem.fileName)}"`}>
                 Descargar
               </a>`
            : `<span class="student-project-download-card__unavailable">Aun no disponible para tu ficha. Consulta con tu instructor.</span>`;

          return `
            <article class="student-project-download-card">
              <span class="student-project-download-card__type">${escapeHtml(documentItem.type)}</span>
              <h4>${escapeHtml(documentItem.title)}</h4>
              <p>${escapeHtml(documentItem.description)}</p>
              <div class="student-project-download-card__actions">
                ${downloadBtn}
                ${deliveryBtn}
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

    // Wire up delivery buttons
    body.querySelectorAll("[data-delivery-doc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const docId = btn.getAttribute("data-delivery-doc");
        const doc = PROJECT_DOCUMENTS.find(function (d) { return d.id === docId; });
        if (!doc) return;
        const session = currentState.session;
        if (!session) return;
        // Sin proyecto vinculado (caso normal en grado 10, que aun no tiene uno)
        // se entrega igual; getMainProject devuelve null y openDocumentDeliveryModal
        // ya usa la ficha/grupo de la sesion como respaldo.
        const project = getMainProject(currentState.viewModel);
        openDocumentDeliveryModal(doc, project, session);
      });
    });
  }

  function openDocumentDeliveryModal(doc, project, session) {
    if (!sharedDelivery || typeof sharedDelivery.openDeliveryModal !== "function") {
      return;
    }
    sharedDelivery.openDeliveryModal({
      guideLabel: "Etapa Productiva",
      activityLabel: doc.deliveryLabel,
      activityTitle: project?.projectTitle || "Proyecto",
      activityNumber: "",
      projectId: project?.id || "",
      ficha: project?.ficha || session?.user?.ficha || "",
      grupo: project?.grupo || session?.user?.grupo || "",
    });
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
