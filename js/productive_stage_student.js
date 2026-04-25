(function () {
  const auth = window.portalAuth || null;
  const store = window.productiveStageStore || null;
  const projectDelivery = window.productiveStageProjectDelivery || null;
  const ALLOWED_FICHAS = ["3168850", "3168852"];

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

  function getStatusClass(status) {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") || "sin-estado";
    return "student-status student-status--" + normalized;
  }

  function isAllowedStudentSession(session) {
    if (!session) {
      return false;
    }

    if (session.role === "admin") {
      return true;
    }

    return session.role === "student" && ALLOWED_FICHAS.includes(String(session.user?.ficha || ""));
  }

  function getPreviewUsernameFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      return String(params.get("student") || "").trim().toLowerCase();
    } catch (error) {
      return "";
    }
  }

  function resolveStudentUsernameKey(session) {
    if (!session) {
      return "";
    }

    if (session.role === "student") {
      return String(session.user?.usernameKey || "").trim().toLowerCase();
    }

    return getPreviewUsernameFromUrl();
  }

  function setHeaderState(title, meta, statusLabel) {
    const heading = getById("student-project-heading");
    const metaBox = getById("student-project-meta");
    const chip = getById("student-project-status-chip");

    if (heading) {
      heading.textContent = title;
    }
    if (metaBox) {
      metaBox.textContent = meta;
    }
    if (chip) {
      chip.textContent = statusLabel;
    }
  }

  function renderEmptyState(title, message, statusLabel) {
    setHeaderState(title, message, statusLabel || "Sin proyecto");

    const summary = getById("student-project-summary-body");
    const reports = getById("student-project-reports-body");

    if (summary) {
      summary.innerHTML = `<p class="student-project-placeholder">${escapeHtml(message)}</p>`;
    }
    if (reports) {
      reports.innerHTML =
        '<p class="student-project-placeholder">Cuando exista un informe vinculado a tu grupo, aparecera aqui.</p>';
    }
  }

  function buildProjectSummary(project) {
    const integrants = (project.studentNames || [])
      .map(function (name) {
        return `<span class="student-integrant-chip">${escapeHtml(name)}</span>`;
      })
      .join("");

    return `
      <div class="student-project-summary-grid">
        <div class="student-project-summary-item">
          <strong>Proyecto</strong>
          <span>${escapeHtml(project.projectTitle || "Proyecto sin titulo")}</span>
        </div>
        <div class="student-project-summary-item">
          <strong>Ficha</strong>
          <span>${escapeHtml(project.ficha || "Sin ficha")} · ${escapeHtml(project.grado || "Sin grado")}</span>
        </div>
        <div class="student-project-summary-item">
          <strong>Herramienta propuesta</strong>
          <span>${escapeHtml(project.tool || "Sin herramienta registrada")}</span>
        </div>
        <div class="student-project-summary-item">
          <strong>Poblacion objetivo</strong>
          <span>${escapeHtml(project.population || "Sin poblacion registrada")}</span>
        </div>
        <div class="student-project-summary-item">
          <strong>Integrantes del grupo</strong>
          <div class="student-integrant-list">${
            integrants || '<span class="student-project-placeholder">Sin integrantes vinculados.</span>'
          }</div>
        </div>
      </div>
    `;
  }

  function buildReportCard(report) {
    const strengths = (report.strengths || [])
      .map(function (item) {
        return `<li>${escapeHtml(item)}</li>`;
      })
      .join("");
    const improvements = (report.improvements || [])
      .map(function (item) {
        return `<li>${escapeHtml(item)}</li>`;
      })
      .join("");

    return `
      <article class="student-report-card">
        <div class="student-report-card__top">
          <div>
            <h4 class="student-report-card__title">${escapeHtml(report.reportType || "Informe")}</h4>
            <div class="student-report-card__meta">${escapeHtml(formatDate(report.importedAt || report.reportDate))}</div>
          </div>
          <span class="${getStatusClass(report.status)}">${escapeHtml(report.status || "Sin estado")}</span>
        </div>
        <div class="student-report-card__body">
          <div class="student-report-card__copy">
            <strong>Resumen</strong>
            <p>${escapeHtml(report.summary || "Sin resumen registrado.")}</p>
          </div>
          <div class="student-report-card__list">
            <strong>Fortalezas</strong>
            <ul>${strengths || "<li>Sin fortalezas registradas.</li>"}</ul>
          </div>
          <div class="student-report-card__list">
            <strong>Aspectos a mejorar</strong>
            <ul>${improvements || "<li>Sin aspectos a mejorar registrados.</li>"}</ul>
          </div>
          <div class="student-report-card__copy">
            <strong>Nota del asesor</strong>
            <p>${escapeHtml(report.advisorNote || "Sin nota del asesor.")}</p>
          </div>
        </div>
      </article>
    `;
  }

  function renderStudentProjectView(viewModel) {
    const projects = viewModel.projects || [];
    const summary = getById("student-project-summary-body");
    const reports = getById("student-project-reports-body");

    if (!projects.length) {
      renderEmptyState(
        "Aun no tienes proyecto vinculado",
        "El informe importado todavia no tiene una coincidencia segura con tu usuario. Cuando el instructor vincule tu nombre al proyecto, lo veras aqui.",
        "Pendiente"
      );
      return;
    }

    const latestProject = projects[0];
    setHeaderState(
      latestProject.projectTitle || "Mi proyecto de etapa productiva",
      `${viewModel.viewerLabel} · ${projects.length} proyecto(s) visible(s)`,
      latestProject.currentStatus || "Sin estado"
    );

    if (summary) {
      summary.innerHTML = projects.map(buildProjectSummary).join("");
    }

    if (reports) {
      const reportCards = projects
        .map(function (project) {
          const projectReports = viewModel.reportsByProject[project.id] || [];
          return `
            <section>
              <div class="student-project-summary-item" style="margin-bottom:12px">
                <strong>${escapeHtml(project.projectTitle || "Proyecto sin titulo")}</strong>
                <span>${escapeHtml(project.ficha || "Sin ficha")} · ${escapeHtml(project.currentStatus || "Sin estado")}</span>
              </div>
              <div class="student-report-list">
                ${
                  projectReports.length
                    ? projectReports.map(buildReportCard).join("")
                    : '<p class="student-project-placeholder">Todavia no hay informes en el historial de este proyecto.</p>'
                }
              </div>
            </section>
          `;
        })
        .join("");

      reports.innerHTML = reportCards;
    }
  }

  function getTutoringDates() {
    const records = window.CALENDAR_2026_RECORDS;
    if (!Array.isArray(records)) {
      return [];
    }

    return records
      .filter(function (r) {
        return r.tipo === "SENA";
      })
      .sort(function (a, b) {
        return a.fecha.localeCompare(b.fecha);
      });
  }

  function renderTutoringDates() {
    const container = getById("student-tutoring-dates-body");
    if (!container) {
      return;
    }

    const dates = getTutoringDates();
    if (!dates.length) {
      container.innerHTML = '<p class="student-project-placeholder">No hay fechas de tutoria registradas.</p>';
      return;
    }

    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local

    const items = dates
      .map(function (record) {
        const isPast = record.fecha < todayStr;
        const isToday = record.fecha === todayStr;
        const isCancelled = String(record.defE || "").toLowerCase() === "cancelada";

        const parts = record.fecha.split("-");
        const dateObj = new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10)
        );
        const dayNum = dateObj.getDate();
        const monthName = dateObj.toLocaleString("es-CO", { month: "long" });

        let stateClass = "tutoring-date--upcoming";
        let stateLabel = "Proxima";
        if (isCancelled) {
          stateClass = "tutoring-date--cancelled";
          stateLabel = "Cancelada";
        } else if (isToday) {
          stateClass = "tutoring-date--today";
          stateLabel = "Hoy";
        } else if (isPast) {
          stateClass = "tutoring-date--past";
          stateLabel = "Realizada";
        }

        return (
          '<div class="tutoring-date ' +
          stateClass +
          '">' +
          '<div class="tutoring-date__num">' +
          dayNum +
          "</div>" +
          '<div class="tutoring-date__month">' +
          escapeHtml(monthName) +
          "</div>" +
          '<div class="tutoring-date__badge">' +
          stateLabel +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML = '<div class="tutoring-dates-grid">' + items + "</div>";
  }

  function renderSupportModules(snapshot, viewModel, session) {
    if (!projectDelivery || typeof projectDelivery.render !== "function") {
      return;
    }

    projectDelivery.render({
      snapshot: snapshot,
      viewModel: viewModel,
      session: session,
    });
  }

  function buildStudentViewModel(snapshot, usernameKey, session) {
    const projects = store.getStudentProjects(snapshot, usernameKey).sort(function (left, right) {
      return Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0);
    });

    const reportsByProject = {};
    projects.forEach(function (project) {
      reportsByProject[project.id] = store.getProjectReports(snapshot, project.id);
    });

    return {
      viewerLabel:
        session?.role === "admin"
          ? "Vista administrativa de previsualizacion"
          : `Ficha ${session?.user?.ficha || ""} · ${session?.user?.fullName || ""}`,
      projects: projects,
      reportsByProject: reportsByProject,
    };
  }

  function renderAdminOverview(snapshot) {
    const projects = Array.isArray(snapshot?.projects) ? snapshot.projects : [];

    setHeaderState(
      "Vista administrativa — Etapa Productiva",
      `${projects.length} proyecto(s) en el catalogo`,
      "Admin"
    );

    const summary = getById("student-project-summary-body");
    const reports = getById("student-project-reports-body");

    if (summary) {
      if (!projects.length) {
        summary.innerHTML = '<p class="student-project-placeholder">No hay proyectos importados aun. Importa un informe DOCX desde el panel administrativo.</p>';
      } else {
        summary.innerHTML = projects.map(function (project) {
          const projectReports = store.getProjectReports(snapshot, project.id);
          const studentKeys = Array.isArray(project.studentUsernameKeys) ? project.studentUsernameKeys : [];
          const previewLinks = studentKeys.map(function (key) {
            return `<a class="student-integrant-chip" style="text-decoration:none;cursor:pointer" href="etapa-productiva-estudiante.html?student=${encodeURIComponent(key)}">${escapeHtml(key)}</a>`;
          }).join("");

          return `
            <div class="student-project-summary-item">
              <strong>${escapeHtml(project.ficha || "Sin ficha")} · ${escapeHtml(project.grado || "")} · ${escapeHtml(project.grupo || "")}</strong>
              <span style="font-size:1rem;font-weight:700;color:var(--text-strong);margin-bottom:6px;display:block">${escapeHtml(project.projectTitle || "Proyecto sin titulo")}</span>
              <span class="${getStatusClass(project.currentStatus)}" style="margin-bottom:8px">${escapeHtml(project.currentStatus || "Sin estado")}</span>
              <div style="margin-top:8px;font-size:12px;color:var(--text-muted)">${projectReports.length} informe(s) · Ver como aprendiz:</div>
              <div class="student-integrant-list" style="margin-top:6px">
                ${previewLinks || '<span class="student-project-placeholder" style="font-size:12px">Sin aprendices vinculados</span>'}
              </div>
            </div>
          `;
        }).join("");
      }
    }

    if (reports) {
      reports.innerHTML = '<p class="student-project-placeholder">Selecciona un aprendiz en "Resumen del proyecto" para ver su vista individual.</p>';
    }

    const intro = getById("student-project-intro");
    if (intro) {
      intro.textContent = "Vista administrativa. Haz clic en el nombre de un aprendiz para previsualizar su pagina de proyecto.";
    }
  }

  function isLocalFilePreview() {
    return /^file:$/i.test(String(window.location.protocol || ""));
  }

  async function initializeStudentProductiveStagePage() {
    if (!auth || !store) {
      renderEmptyState(
        "No fue posible iniciar la vista",
        "Faltan modulos base del portal para consultar la etapa productiva.",
        "Error"
      );
      return;
    }

    const session = auth.getCurrentSession();

    if (!isAllowedStudentSession(session)) {
      if (isLocalFilePreview()) {
        renderTutoringDates();
        renderEmptyState(
          "Vista local — Sin sesion activa",
          "Para ver tu proyecto inicia sesion desde el portal. Esta seccion solo esta disponible para aprendices de 11A y 11B.",
          "Sin sesion"
        );
        return;
      }
      auth.setFlashMessage(
        "Esta vista privada de etapa productiva solo esta disponible para los aprendices autorizados de 11A y 11B.",
        "warn"
      );
      window.location.replace("index.html");
      return;
    }

    const usernameKey = resolveStudentUsernameKey(session);
    const snapshot = await store.loadSnapshot();

    renderTutoringDates();

    if (session.role === "admin" && !usernameKey) {
      renderAdminOverview(snapshot);
      return;
    }

    const viewModel = buildStudentViewModel(snapshot, usernameKey, session);
    renderStudentProjectView(viewModel);
    renderSupportModules(snapshot, viewModel, session);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initializeStudentProductiveStagePage().catch(function () {
      renderEmptyState(
        "No fue posible cargar tu proyecto",
        "Ocurrio un problema al consultar el catalogo de etapa productiva. Intenta recargar la pagina.",
        "Error"
      );
    });
  });
})();
