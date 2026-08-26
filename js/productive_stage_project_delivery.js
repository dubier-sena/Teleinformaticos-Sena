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
      // datos de TODO el grupo, no solo del aprendiz que lo descarga. Fase 2
      // (auditoria profunda, 2026-08-23): antes el ID de Drive viajaba en
      // texto plano en PROJECT_INTEGRATIONS.fichaAcuerdoExcelUrls (repo
      // publico) y el archivo estaba compartido "cualquiera con el enlace" --
      // cualquiera en internet podia descargarlo sin ser aprendiz. Ahora ni
      // el ID ni ningun link existen en el cliente: "secureAction" pide el
      // archivo al Apps Script (entregas_actividades.gs, action "agreement"),
      // que lo resuelve SOLO para la ficha verificada del propio idToken.
      secureAction: "agreement",
      fileName: "Acuerdo Etapa Productiva.xlsx",
      deliveryLabel: "Acuerdo de Etapa Productiva",
    },
    {
      id: "diseno-curricular",
      type: "Documento de referencia",
      title: "Diseno Curricular del programa",
      description:
        "Competencias y resultados de aprendizaje del programa Sistemas Teleinformaticos. Usalo como referencia para diligenciar el campo \"Competencias del programa de formacion aplicadas\" de cada bitacora.",
      href: "assets/materiales/etapa-productiva/Diseno%20Curricular%20Sistemas%20Teleinformaticos.pdf",
      fileName: "Diseno Curricular Sistemas Teleinformaticos.pdf",
      // Solo grado 11 (SB 11A/11B) ejecuta etapa productiva este ano.
      hideForGrade10: true,
    },
  ];

  // Bitacora de seguimiento (GFPI-F-147, hoja "Formato Bitacora Art. Media" --
  // aplica porque los aprendices de grado 11 son de articulacion con la media).
  // El SENA exige minimo 1 y maximo 2 entregas al mes durante la ejecucion; el
  // acuerdo local con el instructor de seguimiento es de 6 bitacoras para el
  // periodo de etapa productiva de este grupo. Un solo formato reutilizable,
  // con 6 cupos de entrega independientes (uno por bitacora).
  const BITACORA_HREF =
    "assets/materiales/etapa-productiva/GFPI-F-147%20Formato%20Bitacora%20Seguimiento%20Etapa%20Productiva.xlsx";
  const BITACORA_FILENAME = "GFPI-F-147 Formato Bitacora Seguimiento Etapa Productiva.xlsx";
  const BITACORA_COUNT = 6;

  // Fechas limite acordadas con el instructor de seguimiento (2026), alineadas
  // a las jornadas de asesoria SB 11A/11B del calendario academico (ultimo dia
  // de cada bloque mensual visible: sin bloque en junio, y se omite septiembre
  // para llegar a exactamente 6 entregas). Formato YYYY-MM-DD, fin de dia
  // America/Bogota (ver isPastDeadline). Sin la entrega correspondiente la
  // Etapa Productiva NO se considera realizada (bloquea la graduacion) -- ver
  // el aviso en buildResourcesMarkup.
  const BITACORA_DEADLINES = [
    "2026-03-27",
    "2026-04-30",
    "2026-05-29",
    "2026-07-31",
    "2026-08-28",
    "2026-10-23",
  ];

  // Evidencia adicional exigida por la coordinacion academica: pantallazo de
  // que la informacion de la Etapa Productiva quedo actualizada en Sofia Plus.
  // Se entrega UNA sola vez para todo el periodo (no una por bitacora). Sin
  // plantilla que descargar (noDownload: true -- ver buildResourcesMarkup) y
  // ligada a la fecha limite de la primera bitacora: para ese momento ya
  // deberia existir el registro en Sofia Plus.
  PROJECT_DOCUMENTS.push({
    id: "sofia-plus",
    type: "Evidencia Sofia Plus",
    title: "Pantallazo Sofia Plus",
    description:
      "Captura de pantalla que muestre la informacion de tu Etapa Productiva ya actualizada en Sofia Plus. Se entrega UNA sola vez (no por cada bitacora); es obligatoria y queda como soporte en tu expediente.",
    noDownload: true,
    hideForGrade10: true,
    deliveryLabel: "Pantallazo Sofia Plus",
    deadline: BITACORA_DEADLINES[0],
  });

  for (let i = 1; i <= BITACORA_COUNT; i++) {
    PROJECT_DOCUMENTS.push({
      id: "bitacora-" + i,
      type: "Bitacora de seguimiento",
      title: "Bitacora N° " + i,
      description:
        "Formato GFPI-F-147 (hoja \"Formato Bitacora Art. Media\"). Descargalo, diligencia el periodo, actividades y firmas, y entregalo.",
      href: BITACORA_HREF,
      fileName: BITACORA_FILENAME,
      hideForGrade10: true,
      deliveryLabel: "Bitacora " + i,
      deadline: BITACORA_DEADLINES[i - 1],
    });
  }

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

  // `value` es un ISO UTC ya resuelto (ver resolveDocumentDeadline): tanto el
  // legacy (fecha sola -> fin de dia Bogota) como una fecha+hora configurada
  // por el admin llegan aqui normalizados por igual, asi que ambos casos se
  // formatean con la misma funcion.
  function formatDeadlineDate(value) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Bogota",
    });
  }

  function isPastDeadline(value) {
    if (!value) {
      return false;
    }
    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) {
      return false;
    }
    return Date.now() > deadline.getTime();
  }

  // Fecha limite EFECTIVA de un documento base (bitacora, Sofia Plus...):
  // admin-configurada > eliminada explicitamente ("cleared", sin fecha) >
  // legacy hardcodeado en BITACORA_DEADLINES (ver
  // js/productive_stage_deadlines.js, resolveEffectiveDeadline). Si el
  // modulo compartido no cargo o el catalogo no tiene fecha, cae al legacy
  // hardcodeado de este mismo archivo (documentItem.deadline) -- mismo
  // comportamiento que existia antes de esta migracion.
  function resolveDocumentDeadline(documentItem) {
    const deadlines = window.productiveStageDeadlines;
    if (deadlines && typeof deadlines.resolveEffectiveDeadline === "function") {
      return deadlines.resolveEffectiveDeadline(currentState.snapshot, documentItem.id);
    }
    // js/productive_stage_deadlines.js no cargo: mismo comportamiento que
    // existia antes de esta migracion (solo el legacy hardcodeado, fin de
    // dia Bogota), sin admin-override ni estado "cleared".
    if (!documentItem.deadline) {
      return { dueAt: "", source: "none" };
    }
    const legacy = new Date(documentItem.deadline + "T23:59:00-05:00");
    return { dueAt: Number.isNaN(legacy.getTime()) ? "" : legacy.toISOString(), source: "legacy" };
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

  // Registro de la entrega de un documento base. Prioridad 1: registro LOCAL
  // (solo consta en el navegador donde se entrego -- clave nueva panelKey
  // estable, o la historica derivada del deliveryLabel, entregas previas a
  // jul-2026). Prioridad 2 (equipo limpio, sin registro local -- otro
  // dispositivo, cache borrada): el registro REMOTO propio, ya incluido en
  // currentState.snapshot por loadStudentSnapshot() (ver
  // mergeOwnDeliveriesIntoSnapshot en productive_stage_store.js, cierre del
  // hallazgo "syncDocumentDeliveryToCloud falla en silencio"). Nunca inventa
  // "entregada" sin al menos uno de los dos.
  function getDocumentDeliveryRecord(doc) {
    if (!doc.deliveryLabel) {
      return null;
    }
    if (sharedDelivery && typeof sharedDelivery.loadDeliveryRecord === "function") {
      const candidates = ["etapa-doc-" + doc.id, doc.deliveryLabel];
      for (let i = 0; i < candidates.length; i++) {
        const record = sharedDelivery.loadDeliveryRecord({ panelKey: candidates[i] });
        if (record && record.status === "delivered") {
          return record;
        }
      }
    }
    const session = currentState.session;
    const usernameKey = String(session?.user?.usernameKey || "").trim().toLowerCase();
    if (!usernameKey || !store || typeof store.getDocumentDeliveriesByUsername !== "function") {
      return null;
    }
    const byUsername = store.getDocumentDeliveriesByUsername(currentState.snapshot) || {};
    const remote = (byUsername[usernameKey] || {})[doc.id];
    return remote
      ? {
          status: "delivered",
          submittedAt: remote.submittedAt,
          savedFileName: remote.savedFileName,
          driveUrl: remote.driveUrl,
        }
      : null;
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
    const documentContexts = visibleDocuments.map(function (documentItem) {
      return {
        item: documentItem,
        record: documentItem.deliveryLabel ? getDocumentDeliveryRecord(documentItem) : null,
      };
    });
    const deliverableContexts = documentContexts.filter(function (context) {
      return !!context.item.deliveryLabel;
    });
    const deliveredCount = deliverableContexts.filter(function (context) {
      return !!context.record;
    }).length;
    const progressPercent = deliverableContexts.length
      ? Math.round((deliveredCount / deliverableContexts.length) * 100)
      : 0;

    function buildDocumentCard(context) {
      const documentItem = context.item;
      const record = context.record;
      const hasDelivery = !!documentItem.deliveryLabel;
      const deliveryBtn = hasDelivery
        ? `<button
             class="app-btn app-btn--outline"
             type="button"
             data-delivery-doc="${escapeHtml(documentItem.id)}"
             ${canUpload ? "" : "disabled"}
           >${record ? "Volver a entregar" : "Entregar archivo"}</button>`
        : "";
      const effectiveDeadline = hasDelivery ? resolveDocumentDeadline(documentItem) : { dueAt: "", source: "none" };
      const deadlineDueAt = effectiveDeadline.dueAt;
      // Punto 10 (pedido del usuario): estado visible del aprendiz --
      // Pendiente / Vence hoy / Vence mañana / Vencida / Entregada. Reusa el
      // mismo clasificador que alimentara agenda/calendario, para que el
      // criterio "hoy"/"mañana" sea identico en todos lados (hora Bogota).
      const deadlineState = window.productiveStageDeadlines && typeof window.productiveStageDeadlines.classifyStatus === "function"
        ? window.productiveStageDeadlines.classifyStatus({ dueAt: deadlineDueAt, deliveredAt: record ? (record.submittedAt || record.fechaEntrega || record.uploadedAt || true) : "" })
        : (record ? "delivered" : (deadlineDueAt && isPastDeadline(deadlineDueAt) ? "overdue" : (deadlineDueAt ? "pending" : "no-deadline")));
      const STATE_LABELS = { "delivered": "Entregada", "overdue": "Vencida", "due-today": "Vence hoy", "due-tomorrow": "Vence mañana", "pending": "Pendiente", "no-deadline": "Pendiente" };
      const STATE_CLASS = { "delivered": "done", "overdue": "blocked", "due-today": "soon", "due-tomorrow": "soon", "pending": "pending", "no-deadline": "pending" };
      const statusBadge = hasDelivery
        ? `<span class="student-document-status student-document-status--${escapeHtml(STATE_CLASS[deadlineState] || "pending")}">${escapeHtml(STATE_LABELS[deadlineState] || "Pendiente")}</span>`
        : '<span class="student-document-status student-document-status--reference">Solo consulta</span>';
      const deliveredNote = record
        ? `<p class="student-project-download-card__delivered">Entregado el ${escapeHtml(formatDate(record.submittedAt || record.fechaEntrega || record.uploadedAt))}${record.savedFileName ? ` &mdash; ${escapeHtml(record.savedFileName)}` : ""}</p>`
        : "";
      const deadlineNote = !record && deadlineDueAt
        ? isPastDeadline(deadlineDueAt)
          ? `<p class="student-project-download-card__deadline student-project-download-card__deadline--overdue"><strong>Fecha limite vencida:</strong> ${escapeHtml(formatDeadlineDate(deadlineDueAt))}. Sin esta entrega, la Etapa Productiva NO se considera realizada y no podras graduarte.</p>`
          : `<p class="student-project-download-card__deadline"><strong>Fecha limite de entrega:</strong> ${escapeHtml(formatDeadlineDate(deadlineDueAt))}. Es obligatoria para culminar la Etapa Productiva y graduarte.</p>`
        : "";
      const downloadBtn = documentItem.noDownload
        ? ""
        : documentItem.secureAction
          ? `<button class="app-btn app-btn--primary" type="button" data-secure-doc="${escapeHtml(documentItem.id)}">
               Descargar formato
             </button>
             <span class="student-project-download-card__secure-status" data-secure-doc-status="${escapeHtml(documentItem.id)}"></span>`
          : documentItem.href
            ? `<a class="app-btn app-btn--primary" href="${escapeHtml(documentItem.href)}" target="_blank" rel="noopener noreferrer" download="${escapeHtml(documentItem.fileName)}">
               Descargar formato
             </a>`
            : `<span class="student-project-download-card__unavailable">El archivo aun no esta disponible para tu ficha. Consulta con tu instructor.</span>`;

      return `
        <article class="student-project-download-card">
          <div class="student-project-download-card__heading">
            <div>
              <span class="student-project-download-card__type">${escapeHtml(documentItem.type)}</span>
              <h4>${escapeHtml(documentItem.title)}</h4>
            </div>
            ${statusBadge}
          </div>
          <p>${escapeHtml(documentItem.description)}</p>
          ${deadlineNote}
          ${deliveredNote}
          <div class="student-project-download-card__actions">
            ${downloadBtn}
            ${deliveryBtn}
          </div>
        </article>
      `;
    }

    function buildDocumentGroup(options) {
      if (!options.contexts.length) {
        return "";
      }
      return `
        <section class="student-document-group student-document-group--${escapeHtml(options.modifier)}" aria-labelledby="${escapeHtml(options.id)}">
          <div class="student-document-group__header">
            <span class="student-document-group__step" aria-hidden="true">${escapeHtml(options.step)}</span>
            <div>
              <h4 id="${escapeHtml(options.id)}">${escapeHtml(options.title)}</h4>
              <p>${escapeHtml(options.description)}</p>
            </div>
          </div>
          <div class="student-project-downloads">
            ${options.contexts.map(buildDocumentCard).join("")}
          </div>
        </section>
      `;
    }

    const initialContexts = documentContexts.filter(function (context) {
      return ["ficha-inscripcion", "acuerdo-etapa-productiva"].indexOf(context.item.id) >= 0;
    });
    const projectContexts = documentContexts.filter(function (context) {
      return ["formato-proyecto", "anexo-financiero"].indexOf(context.item.id) >= 0;
    });
    const referenceContexts = documentContexts.filter(function (context) {
      return context.item.id === "diseno-curricular";
    });
    const sofiaContexts = documentContexts.filter(function (context) {
      return context.item.id === "sofia-plus";
    });
    const logContexts = documentContexts.filter(function (context) {
      return context.item.id.indexOf("bitacora-") === 0;
    });

    return `
      <div class="student-document-workflow">
        <div class="student-document-overview">
          <div class="student-document-overview__copy">
            <span class="student-document-overview__eyebrow">Ruta de documentos</span>
            <h4>Completa cada bloque en orden</h4>
            <p>Descarga el formato, diligencialo con calma y usa el boton <strong>Entregar archivo</strong>. Los documentos marcados como <strong>Solo consulta</strong> sirven de apoyo y no se suben.</p>
          </div>
          <div class="student-document-progress" role="status" aria-label="${deliveredCount} de ${deliverableContexts.length} entregas completadas">
            <div class="student-document-progress__value">${deliveredCount}<span> / ${deliverableContexts.length}</span></div>
            <span>entregas completadas</span>
            <div class="student-document-progress__track" aria-hidden="true">
              <span style="width:${progressPercent}%"></span>
            </div>
          </div>
        </div>

        <ol class="student-document-help" aria-label="Como entregar un documento">
          <li><span>1</span><strong>Descarga</strong> el formato indicado.</li>
          <li><span>2</span><strong>Diligencia</strong> y guarda el archivo.</li>
          <li><span>3</span><strong>Entrega</strong> el archivo desde esta pagina.</li>
        </ol>

        ${buildDocumentGroup({
          id: "documentos-iniciales",
          step: "1",
          title: "Documentos iniciales obligatorios",
          description: "Empieza por estos documentos. Permiten registrar y formalizar tu Etapa Productiva.",
          modifier: "initial",
          contexts: initialContexts,
        })}
        ${buildDocumentGroup({
          id: "plantillas-proyecto",
          step: "2",
          title: "Plantillas para desarrollar el proyecto",
          description: "Usa estas plantillas como base para estructurar el proyecto y sus costos. No se entregan desde este bloque.",
          modifier: "project",
          contexts: projectContexts,
        })}
        ${buildDocumentGroup({
          id: "evidencia-sofia",
          step: "3",
          title: "Evidencia de actualizacion en Sofia Plus",
          description: "Sube una sola captura donde se vea que tu informacion de Etapa Productiva ya esta actualizada.",
          modifier: "evidence",
          contexts: sofiaContexts,
        })}
        ${buildDocumentGroup({
          id: "bitacoras-seguimiento",
          step: "4",
          title: "Bitacoras de seguimiento",
          description: "Son seis entregas independientes. Reutiliza el mismo formato GFPI-F-147 y respeta la fecha indicada en cada tarjeta.",
          modifier: "logs",
          contexts: logContexts,
        })}
        ${buildDocumentGroup({
          id: "documentos-consulta",
          step: "5",
          title: "Documento de consulta",
          description: "Consultalo cuando necesites identificar las competencias del programa que debes registrar en las bitacoras.",
          modifier: "reference",
          contexts: referenceContexts,
        })}
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

    // Wire up secure downloads (Fase 2): el Apps Script resuelve el archivo
    // por la ficha VERIFICADA del idToken, el boton no necesita (ni puede)
    // pasarle ningun ID de Drive.
    body.querySelectorAll("[data-secure-doc]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const docId = btn.getAttribute("data-secure-doc");
        const doc = PROJECT_DOCUMENTS.find(function (d) { return d.id === docId; });
        if (!doc || !doc.secureAction) return;
        handleSecureDocumentDownload(doc, btn);
      });
    });
  }

  function handleSecureDocumentDownload(doc, btn) {
    if (!sharedDelivery || typeof sharedDelivery.downloadSecureDocument !== "function") {
      return;
    }
    const statusEl = btn.parentElement?.querySelector('[data-secure-doc-status="' + doc.id + '"]');
    const originalText = btn.textContent;
    btn.setAttribute("disabled", "disabled");
    btn.textContent = "Obteniendo...";
    if (statusEl) statusEl.textContent = "";
    sharedDelivery
      .downloadSecureDocument(doc.secureAction, { fallbackFileName: doc.fileName })
      .catch(function (error) {
        if (statusEl) {
          statusEl.textContent = error && error.message ? error.message : "No fue posible obtener el documento.";
        }
      })
      .finally(function () {
        btn.removeAttribute("disabled");
        btn.textContent = originalText;
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
      // Clave estable del registro local de la entrega (getDeliveryStorageKey).
      // Las entregas anteriores a jul-2026 se guardaron sin panelKey (la clave
      // se derivaba del activityLabel); getDocumentDeliveryRecord lee ambas.
      panelKey: "etapa-doc-" + doc.id,
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

  // El registro de entrega de shared_apps_script_delivery.js solo vive en el
  // localStorage del navegador donde se entrego (ver getDocumentDeliveryRecord).
  // Para que otro dispositivo del MISMO aprendiz (y, mas adelante, el admin)
  // puedan saber que esto se entrego, esta funcion replica el registro al
  // doc PROPIO del aprendiz (ver store.saveOwnDocumentDelivery).
  //
  // HALLAZGO CORREGIDO (antes de este cambio): esta funcion llamaba a
  // store.loadSnapshot()/saveSnapshot(), que apuntan al doc AGREGADO del
  // admin ("admin:productive-stage") -- un aprendiz real NUNCA es dueño de
  // ese doc segun ninguna regla (ni Firestore Rules ni el fallback de Apps
  // Script), asi que tanto la lectura como la escritura eran denegadas
  // SIEMPRE, atrapadas en silencio por el catch de abajo. La entrega del
  // ARCHIVO (Drive + registro local) nunca se vio afectada -- lo que fallaba
  // en silencio era solo esta replica hacia otros dispositivos/admin. La
  // correccion es de RUTEO: el doc PROPIO del aprendiz ("student:{usernameKey}",
  // el MISMO esquema que ya usan las respuestas de guia) SI esta autorizado
  // sin ningun cambio de reglas. Best-effort en el sentido de "no bloquea la
  // entrega real", pero YA NO en silencio: si la replica falla, se avisa de
  // forma visible (portalSaveStatus) para que el aprendiz sepa que debe
  // reintentar o que el portal lo hara por su cuenta.
  async function syncDocumentDeliveryToCloud(record) {
    if (!store || typeof store.saveOwnDocumentDelivery !== "function" || !record || !record.panelKey) {
      return;
    }
    if (record.panelKey.indexOf("etapa-doc-") !== 0) {
      return;
    }
    const docId = record.panelKey.slice("etapa-doc-".length);
    const session = currentState.session;
    const usernameKey = String(session?.user?.usernameKey || "").trim().toLowerCase();
    if (!usernameKey || session?.role !== "student") {
      return;
    }

    let result;
    try {
      result = await store.saveOwnDocumentDelivery(usernameKey, {
        docId: docId,
        docLabel: record.activityLabel || docId,
        fullName: record.fullName || session?.user?.fullName || "",
        ficha: record.ficha || session?.user?.ficha || "",
        grupo: record.grupo || session?.user?.grupo || "",
        institucion: record.institucion || "",
        submittedAt: record.submittedAt || new Date().toISOString(),
        savedFileName: record.savedFileName || "",
        driveUrl: record.driveUrl || "",
      });
    } catch (error) {
      result = { ok: false };
    }

    // result.ok es false SOLO si tanto Firestore como el respaldo de Drive
    // fallaron (ver cloudSaveGuideData/driveFallbackSet en firebase_db.js) --
    // si solo Firestore fallo pero Drive respondio, result.ok ya es true Y la
    // escritura queda encolada para promoverse sola a Firestore en cuanto la
    // conexion vuelva (recordPendingPromotion/scheduleFlushPromotions, MISMO
    // mecanismo que ya usa cada guia). Por eso el aviso NO promete un
    // reintento automatico que no existe para este caso -- sugiere el unico
    // reintento real disponible: volver a entregar el archivo.
    if (!result || !result.ok) {
      if (window.portalSaveStatus && typeof window.portalSaveStatus.error === "function") {
        window.portalSaveStatus.error(
          "El archivo ya se entrego, pero no se pudo sincronizar el registro con la nube en este momento. Si el problema continua, vuelve a entregar el archivo."
        );
      }
    }
  }

  // Al completarse una entrega (evento del modulo de entregas), la card del
  // documento se re-pinta para mostrar "Entregado" sin recargar la pagina, y
  // se replica el registro al panel de control del admin.
  document.addEventListener("guide-delivery-registered", function (event) {
    renderProjectResources();
    syncDocumentDeliveryToCloud(event && event.detail);
  });

  // Catalogo de documentos entregables (id/label/deadline) de ESTE archivo.
  // HALLAZGO (2026-08-24, fase Agenda Academica): este catalogo NO es hoy la
  // fuente unica -- productive_stage_admin.js mantiene su PROPIO
  // DOCUMENT_CATALOG hardcodeado (misma lista de 9 ids, sin usar esta
  // funcion; el admin ni siquiera carga este script). getDocumentCatalog()
  // queda exportado por si algo mas lo necesita, pero no asumas que el panel
  // admin lo consume. Unificar ambos catalogos queda fuera del alcance de
  // esta fase (no fue pedido) -- documentado aqui para no repetir el
  // hallazgo.
  function getDocumentCatalog() {
    return PROJECT_DOCUMENTS.filter(function (documentItem) {
      return !!documentItem.deliveryLabel;
    }).map(function (documentItem) {
      return {
        id: documentItem.id,
        title: documentItem.title,
        deliveryLabel: documentItem.deliveryLabel,
        hideForGrade10: !!documentItem.hideForGrade10,
        deadline: documentItem.deadline || "",
      };
    });
  }

  window.productiveStageProjectDelivery = {
    render: render,
    renderProjectResources: renderProjectResources,
    openProjectDeliveryModal: openProjectDeliveryModal,
    getDocumentCatalog: getDocumentCatalog,
  };
})();
