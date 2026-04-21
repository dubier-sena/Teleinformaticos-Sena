(function () {
  const auth = window.portalAuth;
  if (!auth) {
    return;
  }

  const sharedDelivery = window.sharedAppsScriptDelivery || null;

  let allUsers = [];
  let productiveStageSnapshot =
    window.productiveStageStore && typeof window.productiveStageStore.createEmptySnapshot === "function"
      ? window.productiveStageStore.createEmptySnapshot()
      : {
          projects: [],
          reports: [],
          imports: [],
          studentIndex: {},
          lastImportSummary: null,
          updatedAt: "",
        };
  let currentDetailProjectId = "";

  function getById(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
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

  function snapshotTime(snapshot) {
    const parsed = Date.parse((snapshot && (snapshot.updatedAt || snapshot.importedAt || snapshot.reportDate)) || "");
    return Number.isFinite(parsed) ? parsed : 0;
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

  function setProductiveStageFeedback(message, type) {
    const box = getById("productive-stage-feedback");
    if (!box) {
      return;
    }

    if (!message) {
      box.className = "admin-feedback";
      box.textContent = "";
      return;
    }

    box.className = "admin-feedback " + (type || "success");
    box.textContent = message;
  }

  function setStorageContext(message) {
    const copy = getById("productive-stage-storage-copy");
    if (copy) {
      copy.textContent = message;
    }
  }

  function getProductiveStageProjects() {
    return Array.isArray(productiveStageSnapshot && productiveStageSnapshot.projects)
      ? productiveStageSnapshot.projects
      : [];
  }

  function getProductiveStageReports() {
    return Array.isArray(productiveStageSnapshot && productiveStageSnapshot.reports)
      ? productiveStageSnapshot.reports
      : [];
  }

  function getProductiveStageAlerts() {
    return Array.isArray(productiveStageSnapshot && productiveStageSnapshot.lastImportSummary && productiveStageSnapshot.lastImportSummary.alerts)
      ? productiveStageSnapshot.lastImportSummary.alerts
      : [];
  }

  function getProjectParticipants(project) {
    const names = Array.isArray(project && project.studentNames) ? project.studentNames : [];
    const keys = Array.isArray(project && project.studentUsernameKeys) ? project.studentUsernameKeys : [];

    return names
      .map(function (name, index) {
        return {
          name: String(name || "").trim(),
          usernameKey: String(keys[index] || "").trim(),
        };
      })
      .filter(function (participant) {
        return participant.name;
      });
  }

  function getProjectInfo(project) {
    const fichaInfo = auth.getFichaInfo && auth.getFichaInfo(project && project.ficha);
    return {
      institucion: (project && project.inst) || (fichaInfo && fichaInfo.inst) || "",
      grupo: (project && project.grupo) || (fichaInfo && fichaInfo.grupo) || "",
    };
  }

  function getProductiveStageStatusClass(status) {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    return normalized ? "status-" + normalized : "";
  }

  function getProductiveStageSelectedFilters() {
    return {
      query: String(getById("productive-stage-filter-query") && getById("productive-stage-filter-query").value || "")
        .trim()
        .toLowerCase(),
      ficha: String(getById("productive-stage-filter-ficha") && getById("productive-stage-filter-ficha").value || ""),
      status: String(getById("productive-stage-filter-status") && getById("productive-stage-filter-status").value || ""),
      type: String(getById("productive-stage-filter-type") && getById("productive-stage-filter-type").value || ""),
    };
  }

  function updateProductiveStageFichaFilterOptions() {
    const select = getById("productive-stage-filter-ficha");
    if (!select) {
      return;
    }

    const selected = select.value || "";
    const fichas = Array.from(
      new Set(
        getProductiveStageProjects()
          .map(function (project) {
            return String(project.ficha || "").trim();
          })
          .filter(Boolean)
      )
    ).sort();

    select.innerHTML = ['<option value="">Todas las fichas</option>']
      .concat(
        fichas.map(function (ficha) {
          const info = auth.getFichaInfo && auth.getFichaInfo(ficha);
          const suffix = info && info.grupo ? " - Grupo " + info.grupo : "";
          return '<option value="' + escapeHtml(ficha) + '">' + escapeHtml(ficha + suffix) + "</option>";
        })
      )
      .join("");

    select.value = fichas.indexOf(selected) >= 0 ? selected : "";
  }

  function getFilteredProductiveStageProjects() {
    const filters = getProductiveStageSelectedFilters();
    return getProductiveStageProjects().filter(function (project) {
      if (filters.ficha && String(project.ficha || "") !== filters.ficha) {
        return false;
      }
      if (filters.status && String(project.currentStatus || "") !== filters.status) {
        return false;
      }
      if (filters.type && String(project.lastReportType || "") !== filters.type) {
        return false;
      }
      if (!filters.query) {
        return true;
      }

      const haystack = [
        project.projectTitle,
        project.ficha,
        project.grado,
        project.groupCategory,
        project.population,
        project.tool,
        (project.studentNames || []).join(" "),
        (project.studentUsernameKeys || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(filters.query);
    });
  }

  function renderProductiveStageSummary(projects) {
    const statusCounts = {
      Completo: 0,
      Parcial: 0,
      Incompleto: 0,
    };

    projects.forEach(function (project) {
      if (statusCounts[project.currentStatus] !== undefined) {
        statusCounts[project.currentStatus] += 1;
      }
    });

    const totalBox = getById("productive-stage-summary-total");
    const reportsBox = getById("productive-stage-summary-reports");
    const completeBox = getById("productive-stage-summary-complete");
    const alertsBox = getById("productive-stage-summary-alerts");

    if (totalBox) totalBox.textContent = String(projects.length);
    if (reportsBox) reportsBox.textContent = String(getProductiveStageReports().length);
    if (completeBox) completeBox.textContent = String(statusCounts.Completo);
    if (alertsBox) alertsBox.textContent = String(getProductiveStageAlerts().length);
  }

  function buildProductiveStageCard(project) {
    const info = auth.getFichaInfo && auth.getFichaInfo(project.ficha);
    const students = (project.studentNames || []).join(", ") || "Sin aprendices detectados";
    const summaryText = String(project.summary || "").trim() || "Sin resumen disponible en la importacion.";
    const reportCount = getProductiveStageReports().filter(function (report) {
      return report.projectId === project.id;
    }).length;

    return (
      '<article class="productive-stage-card">' +
        '<div class="productive-stage-card__top">' +
          "<div>" +
            '<h3 class="productive-stage-card__title">' + escapeHtml(project.projectTitle || "Proyecto sin titulo") + "</h3>" +
            '<div class="productive-stage-card__meta">' +
              "Ficha " + escapeHtml(project.ficha || "Sin ficha") + " · " + escapeHtml(project.grado || "Sin grado") +
              (info && info.grupo ? " · Grupo " + escapeHtml(info.grupo) : "") +
            "</div>" +
            '<div class="productive-stage-card__meta">Integrantes: ' + escapeHtml(students) + "</div>" +
          "</div>" +
          '<div class="productive-stage-card__tags">' +
            '<span class="productive-stage-chip ' + getProductiveStageStatusClass(project.currentStatus) + '">' +
              escapeHtml(project.currentStatus || "Sin estado") +
            "</span>" +
            '<span class="productive-stage-chip">' + escapeHtml(project.lastReportType || "Retroalimentacion") + "</span>" +
            '<span class="productive-stage-chip">' + reportCount + " informe(s)</span>" +
          "</div>" +
        "</div>" +
        '<div class="productive-stage-card__summary">' + escapeHtml(summaryText) + "</div>" +
        '<div class="productive-stage-card__meta" style="margin-top:10px">' +
          "Herramienta: " + escapeHtml(project.tool || "Sin herramienta") + " · Poblacion: " + escapeHtml(project.population || "Sin poblacion") +
        "</div>" +
        '<div class="productive-stage-card__actions">' +
          '<button class="btn secondary" type="button" data-open-productive-stage="' + escapeHtml(project.id) + '">Ver detalle</button>' +
        "</div>" +
      "</article>"
    );
  }

  function renderProductiveStageSection() {
    updateProductiveStageFichaFilterOptions();
    const projects = getFilteredProductiveStageProjects();
    const container = getById("productive-stage-projects");
    const lastImportBox = getById("productive-stage-last-import");

    renderProductiveStageSummary(projects);

    if (lastImportBox) {
      const importSummary = productiveStageSnapshot && productiveStageSnapshot.lastImportSummary;
      if (importSummary && importSummary.summary) {
        lastImportBox.textContent =
          (importSummary.summary.totalProjects || 0) +
          " proyecto(s) importados desde " +
          (importSummary.sourceFileName || "el informe") +
          " el " +
          formatDate(importSummary.importedAt) +
          ". Alertas: " +
          ((importSummary.alerts || []).length) +
          ".";
      } else {
        lastImportBox.textContent = "Aun no se ha importado ningun informe de etapa productiva.";
      }
    }

    if (!container) {
      return;
    }

    if (!projects.length) {
      container.innerHTML =
        '<div class="productive-stage-empty">No hay proyectos que coincidan con los filtros actuales.</div>';
      return;
    }

    container.innerHTML = projects.map(buildProductiveStageCard).join("");
  }

  function buildProductiveStageDeliveryHistoryMarkup(projectId) {
    const deliveries =
      store && typeof store.getProjectDeliveries === "function"
        ? store.getProjectDeliveries(productiveStageSnapshot, projectId)
        : [];

    if (!deliveries.length) {
      return '<p class="productive-stage-placeholder">Todavia no se ha cargado ningun avance para este proyecto.</p>';
    }

    return (
      '<div class="productive-stage-delivery-history">' +
      deliveries
        .map(function (delivery) {
          return (
            '<article class="productive-stage-delivery-history__item">' +
              '<div class="productive-stage-delivery-history__top">' +
                '<strong>' + escapeHtml(delivery.savedFileName || "Archivo registrado") + "</strong>" +
                "<span>" + escapeHtml(formatDate(delivery.uploadedAt)) + "</span>" +
              "</div>" +
              "<p>Registrado por " + escapeHtml(delivery.uploadedByName || "Aprendiz del grupo") + "</p>" +
              (delivery.driveUrl
                ? '<a class="productive-stage-delivery-history__link" href="' +
                    escapeHtml(delivery.driveUrl) +
                    '" target="_blank" rel="noopener noreferrer">Abrir archivo en Drive</a>'
                : "") +
            "</article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function updateProductiveStageDeliverySummary(project) {
    const studentSelect = getById("productive-stage-delivery-student");
    const fileInput = getById("productive-stage-delivery-file");
    const summaryPath = getById("productive-stage-delivery-path");
    const meta = getById("productive-stage-delivery-meta");
    const participantName = String(studentSelect && studentSelect.value || "").trim();
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const fileNamePreview =
      sharedDelivery && typeof sharedDelivery.buildDeliveryFileNamePreview === "function"
        ? sharedDelivery.buildDeliveryFileNamePreview(participantName || "Aprendiz", "Avance-Proyecto", file && file.name)
        : (file && file.name) || "Archivo pendiente";
    const info = getProjectInfo(project);

    if (meta) {
      meta.innerHTML =
        "<strong>Proyecto:</strong> " +
        escapeHtml(project.projectTitle || "Proyecto sin titulo") +
        "<br><strong>Ficha:</strong> " +
        escapeHtml(project.ficha || "Sin ficha") +
        "<br><strong>Grupo:</strong> " +
        escapeHtml(info.grupo || project.grado || "Sin grupo") +
        "<br><strong>Institucion:</strong> " +
        escapeHtml(info.institucion || "Sin institucion") +
        "<br><strong>Aprendiz que registra:</strong> " +
        escapeHtml(participantName || "Selecciona un integrante");
    }

    if (summaryPath) {
      summaryPath.textContent = participantName
        ? "Archivo previsto: Ficha " +
          escapeHtml(project.ficha || "SIN_FICHA") +
          " / " +
          escapeHtml(fileNamePreview)
        : "Selecciona el integrante que registra el avance para generar el nombre final del archivo.";
    }
  }

  function setProductiveStageDeliveryStatus(message, type) {
    const status = getById("productive-stage-delivery-status");
    if (!status) {
      return;
    }

    status.className = "productive-stage-delivery-status" + (type ? " is-" + type : "");
    status.textContent = message;
  }

  function closeProductiveStageDetailModal() {
    const modal = getById("productive-stage-detail-modal");
    if (!modal || modal.hidden) {
      return;
    }
    modal.hidden = true;
    modal.removeAttribute("data-project-id");
    currentDetailProjectId = "";
    document.body.classList.remove("modal-open");
  }

  function openProductiveStageDetailModal(projectId) {
    const project = getProductiveStageProjects().find(function (item) {
      return item.id === projectId;
    });
    const modal = getById("productive-stage-detail-modal");
    if (!project || !modal) {
      return;
    }

    const reports = getProductiveStageReports()
      .filter(function (report) {
        return report.projectId === projectId;
      })
      .sort(function (left, right) {
        return snapshotTime(right) - snapshotTime(left);
      });
    const alerts = getProductiveStageAlerts().filter(function (alert) {
      return alert.projectTitle === project.projectTitle;
    });
    const participants = getProjectParticipants(project);

    getById("productive-stage-detail-title").textContent = project.projectTitle || "Detalle del proyecto";
    getById("productive-stage-detail-subtitle").textContent =
      (project.ficha || "Sin ficha") +
      " · " +
      (project.grado || "Sin grado") +
      " · " +
      ((project.studentNames || []).join(", ") || "Sin integrantes");
    getById("productive-stage-detail-meta").textContent =
      "Herramienta: " +
      (project.tool || "Sin registro") +
      " · Poblacion: " +
      (project.population || "Sin registro");

    getById("productive-stage-detail-body").innerHTML =
      '<div class="productive-stage-detail-grid">' +
        '<article class="answer-card">' +
          "<h3>Resumen del proyecto</h3>" +
          "<p>" + escapeHtml(project.summary || "Sin resumen importado.") + "</p>" +
        "</article>" +
        '<article class="answer-card">' +
          "<h3>Fortalezas</h3>" +
          "<ul>" +
            ((project.strengths || []).map(function (item) {
              return "<li>" + escapeHtml(item) + "</li>";
            }).join("") || "<li>Sin fortalezas registradas.</li>") +
          "</ul>" +
        "</article>" +
        '<article class="answer-card">' +
          "<h3>Aspectos a mejorar</h3>" +
          "<ul>" +
            ((project.improvements || []).map(function (item) {
              return "<li>" + escapeHtml(item) + "</li>";
            }).join("") || "<li>Sin aspectos a mejorar registrados.</li>") +
          "</ul>" +
        "</article>" +
        '<article class="answer-card">' +
          "<h3>Nota del asesor</h3>" +
          "<p>" + escapeHtml(project.advisorNote || "Sin nota del asesor.") + "</p>" +
        "</article>" +
        '<article class="answer-card">' +
          "<h3>Historial de informes</h3>" +
          "<ul>" +
            (reports.map(function (report) {
              return (
                "<li>" +
                escapeHtml(report.reportType || "Informe") +
                " · " +
                escapeHtml(report.status || "Sin estado") +
                " · " +
                escapeHtml(formatDate(report.importedAt || report.reportDate)) +
                "</li>"
              );
            }).join("") || "<li>Sin informes registrados.</li>") +
          "</ul>" +
        "</article>" +
        '<article class="answer-card">' +
          "<h3>Alertas de vinculacion</h3>" +
          (alerts.length
            ? '<ul class="productive-stage-alert-list">' +
              alerts.map(function (alert) {
                return "<li>" + escapeHtml((alert.studentName || "Sin nombre") + ": " + (alert.message || "")) + "</li>";
              }).join("") +
              "</ul>"
            : '<div class="response-status">No hay alertas para este proyecto.</div>') +
        "</article>" +
        '<article class="answer-card productive-stage-delivery-card">' +
          "<h3>Avance del proyecto</h3>" +
          '<p class="productive-stage-delivery-copy">Selecciona el aprendiz del grupo que registra el avance y sube el archivo de apoyo directamente al Drive de la ficha.</p>' +
          '<label class="productive-stage-delivery-field">' +
            "<span>Aprendiz que registra</span>" +
            '<select id="productive-stage-delivery-student">' +
              (participants.length
                ? participants
                    .map(function (participant) {
                      return (
                        '<option value="' +
                        escapeHtml(participant.name) +
                        '" data-username-key="' +
                        escapeHtml(participant.usernameKey || "") +
                        '">' +
                        escapeHtml(participant.name) +
                        "</option>"
                      );
                    })
                    .join("")
                : '<option value="">Sin integrantes detectados</option>') +
            "</select>" +
          "</label>" +
          '<label class="productive-stage-delivery-field">' +
            "<span>Archivo del avance</span>" +
            '<input id="productive-stage-delivery-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip">' +
          "</label>" +
          '<div class="productive-stage-delivery-meta" id="productive-stage-delivery-meta"></div>' +
          '<div class="productive-stage-delivery-path" id="productive-stage-delivery-path"></div>' +
          '<div class="productive-stage-delivery-actions">' +
            '<button class="btn primary" type="button" id="productive-stage-delivery-submit"' +
              (participants.length ? "" : " disabled") +
            ">Registrar avance en Drive</button>" +
          "</div>" +
          '<div class="productive-stage-delivery-status" id="productive-stage-delivery-status">' +
            (participants.length
              ? "Selecciona el archivo del avance para enviarlo al Drive de la ficha."
              : "No hay integrantes detectados para registrar el avance de este proyecto.") +
          "</div>" +
          '<div class="productive-stage-delivery-history-wrap">' +
            "<h4>Historial compartido del proyecto</h4>" +
            buildProductiveStageDeliveryHistoryMarkup(project.id) +
          "</div>" +
        "</article>" +
      "</div>";

    modal.dataset.projectId = project.id;
    currentDetailProjectId = project.id;
    modal.hidden = false;
    document.body.classList.add("modal-open");

    getById("productive-stage-delivery-student")?.addEventListener("change", function () {
      updateProductiveStageDeliverySummary(project);
    });
    getById("productive-stage-delivery-file")?.addEventListener("change", function () {
      updateProductiveStageDeliverySummary(project);
    });
    getById("productive-stage-delivery-submit")?.addEventListener("click", handleProductiveStageDeliverySubmit);

    updateProductiveStageDeliverySummary(project);
    if (!participants.length) {
      setProductiveStageDeliveryStatus(
        "No hay integrantes detectados para registrar el avance de este proyecto.",
        "warning"
      );
    }
  }

  async function handleProductiveStageDeliverySubmit() {
    const modal = getById("productive-stage-detail-modal");
    const projectId = String((modal && modal.dataset.projectId) || currentDetailProjectId || "").trim();
    const project = getProductiveStageProjects().find(function (item) {
      return item.id === projectId;
    });
    const studentSelect = getById("productive-stage-delivery-student");
    const fileInput = getById("productive-stage-delivery-file");
    const submitButton = getById("productive-stage-delivery-submit");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!project || !store || !sharedDelivery) {
      setProductiveStageDeliveryStatus(
        "No fue posible preparar la entrega del avance desde la vista administrativa.",
        "error"
      );
      return;
    }

    const participantName = String(studentSelect && studentSelect.value || "").trim();
    const selectedOption = studentSelect && studentSelect.options ? studentSelect.options[studentSelect.selectedIndex] : null;
    const usernameKey = String(selectedOption && selectedOption.dataset && selectedOption.dataset.usernameKey || "").trim();
    const info = getProjectInfo(project);

    if (!participantName) {
      setProductiveStageDeliveryStatus("Selecciona el aprendiz que registra el avance.", "error");
      return;
    }

    try {
      sharedDelivery.validateFile(file);
    } catch (error) {
      setProductiveStageDeliveryStatus(error && error.message ? error.message : "Archivo invalido.", "error");
      return;
    }

    submitButton && submitButton.setAttribute("disabled", "disabled");
    setProductiveStageDeliveryStatus("Subiendo avance del proyecto a Drive...", "loading");

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
        fullName: participantName,
        ficha: project.ficha || "",
        grupo: info.grupo || project.grado || "",
        institucion: info.institucion || "",
        pageFile: window.location.pathname.split("/").pop() || "",
        submittedAt: new Date().toISOString(),
        projectId: project.id,
        projectTitle: project.projectTitle || "Proyecto",
      });

      const uploadedAt = new Date().toISOString();
      const nextSnapshot = store.appendProjectDeliveryToSnapshot(productiveStageSnapshot, {
        deliveryId: project.id + ":" + uploadedAt,
        projectId: project.id,
        projectTitle: project.projectTitle || "Proyecto",
        uploadedAt: uploadedAt,
        uploadedByName: participantName,
        uploadedByUsernameKey: usernameKey,
        driveUrl: response.driveUrl || "",
        savedFileName: response.savedFileName || file.name,
      });
      const saveResult = await store.saveSnapshot(nextSnapshot);
      productiveStageSnapshot = nextSnapshot;
      renderProductiveStageSection();
      openProductiveStageDetailModal(project.id);

      if (!saveResult.ok) {
        setProductiveStageDeliveryStatus(
          "El archivo quedo en Drive, pero el historial no se pudo guardar en este momento.",
          "warning"
        );
      } else if (saveResult.savedCloud === false && saveResult.savedLocal) {
        setProductiveStageDeliveryStatus(
          "El archivo quedo en Drive y el historial se guardo localmente en este navegador.",
          "warning"
        );
      } else {
        setProductiveStageDeliveryStatus(
          "Avance registrado correctamente y visible para el proyecto.",
          "success"
        );
      }
    } catch (error) {
      setProductiveStageDeliveryStatus(
        error && error.message ? error.message : "No fue posible completar la entrega del avance.",
        "error"
      );
    } finally {
        submitButton && submitButton.removeAttribute("disabled");
    }
  }

  async function loadProductiveStageSnapshot() {
    if (!window.productiveStageStore || typeof window.productiveStageStore.loadSnapshot !== "function") {
      productiveStageSnapshot = {
        schemaVersion: 2,
        projects: [],
        reports: [],
        imports: [],
        deliveries: [],
        studentIndex: {},
        lastImportSummary: null,
        updatedAt: "",
      };
      renderProductiveStageSection();
      return;
    }

    productiveStageSnapshot = await window.productiveStageStore.loadSnapshot();
    renderProductiveStageSection();
  }

  async function loadUsersForMatching() {
    try {
      allUsers = await auth.fetchStudentsWithProgress();
      setStorageContext(
        "Este modulo esta usando el almacenamiento compartido del portal para vincular aprendices e informes."
      );
      setProductiveStageFeedback("", "success");
    } catch (error) {
      allUsers = auth.getStudentsWithProgress();
      setStorageContext(
        "No fue posible leer el almacenamiento compartido. Se usara la copia local disponible en este navegador."
      );
      setProductiveStageFeedback(
        "No fue posible leer el almacenamiento compartido. Se muestra la copia local disponible para etapa productiva.",
        "error"
      );
    }
  }

  async function refreshProductiveStageModule() {
    await loadUsersForMatching();
    await loadProductiveStageSnapshot();
  }

  async function handleProductiveStageImport() {
    const fileInput = getById("productive-stage-file");
    const button = getById("productive-stage-import-button");
    const file = fileInput && fileInput.files && fileInput.files[0];

    if (!file) {
      setProductiveStageFeedback("Selecciona primero el informe DOCX que deseas importar.", "error");
      return;
    }

    if (!window.productiveStageImport || !window.productiveStageStore) {
      setProductiveStageFeedback("El modulo de etapa productiva no esta disponible en esta pagina.", "error");
      return;
    }

    button.disabled = true;
    setProductiveStageFeedback("Importando informe de etapa productiva...", "success");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawText = await window.productiveStageImport.extractRawTextFromDocxArrayBuffer(arrayBuffer);
      const importResult = window.productiveStageImport.parseProductiveStageReportText(rawText, {
        sourceFileName: file.name,
        importedAt: new Date().toISOString(),
        users: allUsers,
      });
      const mergedSnapshot = window.productiveStageStore.mergeImportIntoSnapshot(
        productiveStageSnapshot,
        importResult
      );
      const saveResult = await window.productiveStageStore.saveSnapshot(mergedSnapshot);

      productiveStageSnapshot = mergedSnapshot;
      renderProductiveStageSection();
      setProductiveStageFeedback(
        "Importacion completada: " +
          importResult.summary.totalProjects +
          " proyecto(s), " +
          importResult.summary.matchedStudents +
          " coincidencia(s) de aprendices y " +
          importResult.alerts.length +
          " alerta(s)." +
          (saveResult.savedCloud ? " Sincronizado al almacenamiento compartido." : " Guardado localmente en este navegador."),
        "success"
      );
      if (fileInput) {
        fileInput.value = "";
      }
    } catch (error) {
      setProductiveStageFeedback(
        "No fue posible importar el informe. " +
          (error && error.message ? error.message : "Verifica el archivo e intenta de nuevo."),
        "error"
      );
    } finally {
      button.disabled = false;
    }
  }

  function bindEvents() {
    getById("productive-stage-refresh-button") && getById("productive-stage-refresh-button").addEventListener("click", function () {
      refreshProductiveStageModule();
    });

    getById("productive-stage-import-button") && getById("productive-stage-import-button").addEventListener("click", function () {
      handleProductiveStageImport();
    });

    ["productive-stage-filter-query", "productive-stage-filter-ficha", "productive-stage-filter-status", "productive-stage-filter-type"].forEach(function (id) {
      const element = getById(id);
      if (!element) {
        return;
      }
      element.addEventListener(id === "productive-stage-filter-query" ? "input" : "change", function () {
        renderProductiveStageSection();
      });
    });

    document.addEventListener("click", function (event) {
      const closeButton = event.target.closest("[data-close-productive-stage-modal]");
      if (closeButton) {
        closeProductiveStageDetailModal();
        return;
      }

      const detailButton = event.target.closest("[data-open-productive-stage]");
      if (detailButton) {
        openProductiveStageDetailModal(detailButton.getAttribute("data-open-productive-stage") || "");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeProductiveStageDetailModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async function () {
    bindEvents();
    await refreshProductiveStageModule();
  });
})();
