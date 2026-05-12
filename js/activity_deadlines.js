(function () {
  const LOCAL_STORAGE_KEY = "sena_portal_admin_activity_deadlines_v1";
  const CLOUD_SCOPE_KEY = "admin:activity-deadlines";
  const CLOUD_FILE_NAME = "__activity_deadlines_v1";
  const catalog = {
    "grupo-10a-guia-01-induccion.html": [
      { id: "arbol312", label: "Actividad 3.1.2 - El Arbol de la Vida" },
      { id: "sena331", label: "Actividad 3.3.1 - Analisis de simbolos SENA" },
      { id: "programa332", label: "Actividad 3.3.2 - Cuestionario diseno curricular" },
      { id: "plataformas334", label: "Actividad 3.3.4 - Taller plataformas tecnologicas" },
      { id: "portafolio342", label: "Actividad 3.4.2 - Portafolio de evidencias" },
    ],
    "grupo-10b-guia-01-induccion.html": [
      { id: "arbol312", label: "Actividad 3.1.2 - El Arbol de la Vida" },
      { id: "sena331", label: "Actividad 3.3.1 - Analisis de simbolos SENA" },
      { id: "programa332", label: "Actividad 3.3.2 - Cuestionario diseno curricular" },
      { id: "plataformas334", label: "Actividad 3.3.4 - Taller plataformas tecnologicas" },
      { id: "portafolio342", label: "Actividad 3.4.2 - Portafolio de evidencias" },
    ],
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": [
      { id: "analisis313", label: "Actividad 3 - Bitacora de analisis" },
      { id: "matriz322", label: "Actividad 3.2.2 - Matriz de Diagnostico Digital" },
      { id: "extensiones331", label: "Actividad 5 - Extensiones de archivo" },
      { id: "sistemas332", label: "Actividad 6 - Requerimientos minimos" },
      { id: "fichaCaso", label: "Actividad 4 - Ficha de caso" },
      { id: "suite333", label: "Actividad 7 - Suite ofimatica en accion" },
      { id: "colaborativas334", label: "Actividad 8 - Herramientas colaborativas" },
      { id: "transferReto341", label: "Actividad 10 - Reto final" },
    ],
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": [
      { id: "analisis313", label: "Actividad 3 - Bitacora de analisis" },
      { id: "matriz322", label: "Actividad 3.2.2 - Matriz de Diagnostico Digital" },
      { id: "extensiones331", label: "Actividad 5 - Extensiones de archivo" },
      { id: "sistemas332", label: "Actividad 6 - Requerimientos minimos" },
      { id: "fichaCaso", label: "Actividad 4 - Ficha de caso" },
      { id: "suite333", label: "Actividad 7 - Suite ofimatica en accion" },
      { id: "colaborativas334", label: "Actividad 8 - Herramientas colaborativas" },
      { id: "transferReto341", label: "Actividad 10 - Reto final" },
    ],
    "grupo-11a-guia-06-planificar-informacion.html": [
      { id: "bitacora311", label: "Bitacora 3.1.1" },
      { id: "socializacion312", label: "Socializacion 3.1.2" },
      { id: "tabla321", label: "Actividad 3.2.1 - Tabla resumen" },
      { id: "mapa322", label: "Actividad 3.2.2 - Mapa conceptual" },
      { id: "checklist331", label: "Actividad 3.3.1 - Checklist de instalacion" },
      { id: "diagnostico332", label: "Actividad 3.3.2 - Diagnostico tecnico" },
      { id: "presupuesto341", label: "Actividad 3.4.1 - Presupuesto final" },
    ],
    "grupo-11b-guia-06-planificar-informacion.html": [
      { id: "bitacora311", label: "Bitacora 3.1.1" },
      { id: "socializacion312", label: "Socializacion 3.1.2" },
      { id: "tabla321", label: "Actividad 3.2.1 - Tabla resumen" },
      { id: "mapa322", label: "Actividad 3.2.2 - Mapa conceptual" },
      { id: "checklist331", label: "Actividad 3.3.1 - Checklist de instalacion" },
      { id: "diagnostico332", label: "Actividad 3.3.2 - Diagnostico tecnico" },
      { id: "presupuesto341", label: "Actividad 3.4.1 - Presupuesto final" },
    ],
    "grupo-10a-guia-03-planificar-informacion.html": [
      { id: "bitacora311", label: "Bitacora 3.1.1" },
      { id: "socializacion312", label: "Socializacion 3.1.2" },
      { id: "tabla321", label: "Actividad 3.2.1 - Tabla resumen" },
      { id: "mapa322", label: "Actividad 3.2.2 - Mapa conceptual" },
      { id: "checklist331", label: "Actividad 3.3.1 - Checklist de instalacion" },
      { id: "diagnostico332", label: "Actividad 3.3.2 - Diagnostico tecnico" },
      { id: "presupuesto341", label: "Actividad 3.4.1 - Presupuesto final" },
    ],
    "grupo-10b-guia-03-planificar-informacion.html": [
      { id: "bitacora311", label: "Bitacora 3.1.1" },
      { id: "socializacion312", label: "Socializacion 3.1.2" },
      { id: "tabla321", label: "Actividad 3.2.1 - Tabla resumen" },
      { id: "mapa322", label: "Actividad 3.2.2 - Mapa conceptual" },
      { id: "checklist331", label: "Actividad 3.3.1 - Checklist de instalacion" },
      { id: "diagnostico332", label: "Actividad 3.3.2 - Diagnostico tecnico" },
      { id: "presupuesto341", label: "Actividad 3.4.1 - Presupuesto final" },
    ],
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": [
      { id: "guia5-311", label: "Actividad 3.1.1 - Bitacora o analisis del caso" },
      { id: "guia5-331", label: "Actividad 3.3.1 - Evidencias de herramientas" },
      { id: "guia5-341", label: "Actividad 3.4.1 - Informe final integrador" },
    ],
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": [
      { id: "guia5-311", label: "Actividad 3.1.1 - Bitacora o analisis del caso" },
      { id: "guia5-331", label: "Actividad 3.3.1 - Evidencias de herramientas" },
      { id: "guia5-341", label: "Actividad 3.4.1 - Informe final integrador" },
    ],
    "santa-barbara-10a-guia-02-redes-rap01.html": [
      { id: "reflexion311", label: "Actividad 3.1.1 - Reflexion individual" },
      { id: "socializacion311", label: "Actividad 3.1.1 - Socializacion" },
      { id: "ip1", label: "Bloque IP 1" },
      { id: "ip3", label: "Bloque IP 3" },
      { id: "taller-ip-ej1", label: "Taller IP - Ejercicio 1" },
      { id: "taller-ip-ej2", label: "Taller IP - Ejercicio 2" },
      { id: "taller-ip-ej3", label: "Taller IP - Ejercicio 3" },
      { id: "taller-ip-ej4", label: "Taller IP - Ejercicio 4" },
      { id: "taller-ip-ej5", label: "Taller IP - Ejercicio 5" },
      { id: "lab1", label: "Laboratorio 1 - Topologia estrella" },
      { id: "lab2", label: "Laboratorio 2 - Topologia arbol" },
      { id: "lab3", label: "Laboratorio 3 - Red hibrida" },
      { id: "social", label: "Socializacion 3.1.1" },
    ],
    "santa-barbara-10b-guia-02-redes-rap01.html": [
      { id: "reflexion311", label: "Actividad 3.1.1 - Reflexion individual" },
      { id: "socializacion311", label: "Actividad 3.1.1 - Socializacion" },
      { id: "ip1", label: "Bloque IP 1" },
      { id: "ip3", label: "Bloque IP 3" },
      { id: "taller-ip-ej1", label: "Taller IP - Ejercicio 1" },
      { id: "taller-ip-ej2", label: "Taller IP - Ejercicio 2" },
      { id: "taller-ip-ej3", label: "Taller IP - Ejercicio 3" },
      { id: "taller-ip-ej4", label: "Taller IP - Ejercicio 4" },
      { id: "taller-ip-ej5", label: "Taller IP - Ejercicio 5" },
      { id: "lab1", label: "Laboratorio 1 - Topologia estrella" },
      { id: "lab2", label: "Laboratorio 2 - Topologia arbol" },
      { id: "lab3", label: "Laboratorio 3 - Red hibrida" },
      { id: "social", label: "Socializacion 3.1.1" },
    ],
  };

  let cachedSnapshot = { policies: {}, updatedAt: "", updatedBy: "" };
  let loadingPromise = null;
  let nowProvider = null;
  const pageFileAliases = {
    "10a_guia.html": "grupo-10a-guia-01-induccion.html",
    "10b_guia.html": "grupo-10b-guia-01-induccion.html",
    "10a_guia2.html": "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "10b_guia2.html": "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
    "11a_guia.html": "grupo-11a-guia-05-herramientas-informaticas-digitales.html",
    "11b_guia.html": "grupo-11b-guia-05-herramientas-informaticas-digitales.html",
    "11a_guia6.html": "grupo-11a-guia-06-planificar-informacion.html",
    "11b_guia6.html": "grupo-11b-guia-06-planificar-informacion.html",
    "10a_guia3.html": "grupo-10a-guia-03-planificar-informacion.html",
    "10b_guia3.html": "grupo-10b-guia-03-planificar-informacion.html",
    "sb_10a_redes.html": "santa-barbara-10a-guia-02-redes-rap01.html",
    "sb_10b_redes.html": "santa-barbara-10b-guia-02-redes-rap01.html",
  };

  function cloneSnapshot(snapshot) {
    const source = snapshot && typeof snapshot === "object" ? snapshot : {};
    return {
      policies: normalizePolicies(source.policies || source.state || source.data || {}),
      updatedAt: String(source.updatedAt || "").trim(),
      updatedBy: String(source.updatedBy || "").trim(),
    };
  }

  function normalizeDueAt(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return "";
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function normalizePolicies(rawPolicies) {
    const next = {};
    const source = rawPolicies && typeof rawPolicies === "object" ? rawPolicies : {};
    Object.keys(source).forEach((fileName) => {
      const activities = source[fileName];
      if (!activities || typeof activities !== "object") {
        return;
      }
      Object.keys(activities).forEach((activityId) => {
        const rawPolicy = activities[activityId];
        const dueAt = normalizeDueAt(rawPolicy?.dueAt || rawPolicy?.fechaEntrega || "");
        if (!dueAt) {
          return;
        }
        if (!next[fileName]) {
          next[fileName] = {};
        }
        next[fileName][activityId] = {
          dueAt,
          updatedAt: String(rawPolicy?.updatedAt || "").trim(),
          updatedBy: String(rawPolicy?.updatedBy || "").trim(),
        };
      });
    });
    return next;
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

  function readLocalSnapshot() {
    try {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? cloneSnapshot(JSON.parse(raw)) : cloneSnapshot(null);
    } catch (error) {
      return cloneSnapshot(null);
    }
  }

  function writeLocalSnapshot(snapshot) {
    cachedSnapshot = cloneSnapshot(snapshot);
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cachedSnapshot));
    } catch (error) {
    }
    dispatchUpdated();
    return cachedSnapshot;
  }

  function dispatchUpdated() {
    try {
      window.dispatchEvent(
        new CustomEvent("activity-deadlines-updated", {
          detail: cloneSnapshot(cachedSnapshot),
        })
      );
    } catch (error) {
    }
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse(snapshot?.updatedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async function readCloudSnapshot(force) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function" ||
      window._firebaseDb.shouldDeferCloudReads?.()
    ) {
      return null;
    }

    if (force && typeof window._firebaseDb.resetCache === "function") {
      window._firebaseDb.resetCache();
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(CLOUD_SCOPE_KEY, CLOUD_FILE_NAME);
      return cloneSnapshot(snapshot);
    } catch (error) {
      return null;
    }
  }

  async function saveCloudSnapshot(snapshot) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudSaveGuideData !== "function" ||
      window._firebaseDb.shouldBlockCloudWrites?.()
    ) {
      return false;
    }

    try {
      return await window._firebaseDb.cloudSaveGuideData(CLOUD_SCOPE_KEY, CLOUD_FILE_NAME, {
        state: snapshot.policies,
        data: snapshot.policies,
        policies: snapshot.policies,
        updatedAt: snapshot.updatedAt,
        updatedBy: snapshot.updatedBy,
      });
    } catch (error) {
      return false;
    }
  }

  async function loadPolicies(force) {
    if (!force && loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = Promise.all([
      Promise.resolve(readLocalSnapshot()),
      readCloudSnapshot(force),
    ]).then(([localSnapshot, cloudSnapshot]) => {
      const winner =
        cloudSnapshot && snapshotTime(cloudSnapshot) >= snapshotTime(localSnapshot)
          ? cloudSnapshot
          : localSnapshot;
      cachedSnapshot = cloneSnapshot(winner);
      if (winner === cloudSnapshot) {
        writeLocalSnapshot(cachedSnapshot);
      } else {
        dispatchUpdated();
      }
      return cloneSnapshot(cachedSnapshot);
    });

    return loadingPromise.finally(() => {
      loadingPromise = null;
    });
  }

  function getActivitiesForGuide(fileName) {
    const resolvedFileName = resolvePageFile(fileName);
    if (Array.isArray(catalog[resolvedFileName])) {
      return catalog[resolvedFileName].map((item) => ({ ...item }));
    }
    // Fallback: guías registradas con ActivityStandard.registerGuide()
    const std = window.ActivityStandard;
    if (std && typeof std.getActivitiesForGuide === "function") {
      return std.getActivitiesForGuide(resolvedFileName).map((act) => ({
        id: act.id,
        label: act.label,
      }));
    }
    return [];
  }

  function resolvePageFile(fileName) {
    const clean = String(fileName || "").trim();
    return pageFileAliases[clean] || clean;
  }

  function getPolicy(fileName, activityId) {
    return cachedSnapshot.policies?.[resolvePageFile(fileName)]?.[activityId] || null;
  }

  function formatDueAt(dueAt) {
    const value = normalizeDueAt(dueAt);
    if (!value) {
      return "Sin fecha";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Sin fecha";
    }
    return parsed.toLocaleString("es-CO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getActivityLabel(fileName, activityId) {
    const match = getActivitiesForGuide(fileName).find((item) => item.id === activityId);
    return match?.label || activityId;
  }

  function getMountNode(config, fallbackNode) {
    if (config?.mountElement && typeof config.mountElement.appendChild === "function") {
      return config.mountElement;
    }
    if (config?.mountSelector) {
      const selected = document.querySelector(config.mountSelector);
      if (selected) {
        return selected;
      }
    }
    if (fallbackNode?.parentElement) {
      return fallbackNode.parentElement;
    }
    return null;
  }

  function isAdminSession() {
    const session = window.portalAuth?.getCurrentSession?.();
    return session?.role === "admin";
  }

  function ensureAdminControlShell(config, fallbackButton, fileName, activityId) {
    const mountNode = getMountNode(config?.adminMount || null, fallbackButton);
    if (!mountNode || !isAdminSession()) {
      return null;
    }
    const controlId = `activity-deadline-admin-${fileName.replace(/[^a-z0-9]+/gi, "-")}-${activityId}`;
    let shell = document.getElementById(controlId);
    if (shell) {
      return shell;
    }

    shell = document.createElement("div");
    shell.id = controlId;
    shell.className = "activity-deadline-admin-inline";
    shell.innerHTML = `
      <div class="activity-deadline-admin-inline__head">
        <strong>Admin</strong>
        <span>${escapeHtml(getActivityLabel(fileName, activityId))}</span>
      </div>
      <div class="activity-deadline-admin-inline__body">
        <input type="datetime-local" class="activity-deadline-admin-inline__input">
        <button type="button" class="activity-deadline-admin-inline__btn" data-deadline-save-inline>Guardar fecha</button>
        <button type="button" class="activity-deadline-admin-inline__btn ghost" data-deadline-clear-inline>Quitar</button>
      </div>
    `;
    mountNode.insertBefore(shell, mountNode.firstChild);

    const input = shell.querySelector(".activity-deadline-admin-inline__input");
    const saveButton = shell.querySelector("[data-deadline-save-inline]");
    const clearButton = shell.querySelector("[data-deadline-clear-inline]");

    saveButton?.addEventListener("click", async function () {
      const dueAt = String(input?.value || "").trim();
      if (!dueAt) {
        window.alert("Indica la fecha y hora de cierre.");
        return;
      }
      const session = window.portalAuth?.getCurrentSession?.();
      await savePolicy(fileName, activityId, dueAt, session?.user?.usernameKey || session?.usernameKey || "admin");
      applyAvailability({ ...(config || {}), pageFile: fileName, activityId });
    });

    clearButton?.addEventListener("click", async function () {
      const session = window.portalAuth?.getCurrentSession?.();
      await clearPolicy(fileName, activityId, session?.user?.usernameKey || session?.usernameKey || "admin");
      if (input) {
        input.value = "";
      }
      applyAvailability({ ...(config || {}), pageFile: fileName, activityId });
    });

    return shell;
  }

  function evaluatePolicy(policy, nowValue) {
    if (!policy?.dueAt) {
      return {
        hasDeadline: false,
        state: "none",
        dueAt: "",
      };
    }
    const dueAt = normalizeDueAt(policy.dueAt);
    if (!dueAt) {
      return {
        hasDeadline: false,
        state: "none",
        dueAt: "",
      };
    }
    const now = nowValue instanceof Date ? nowValue : (typeof nowProvider === "function" ? nowProvider() : new Date());
    const dueDate = new Date(dueAt);
    return {
      hasDeadline: true,
      dueAt,
      state: now.getTime() > dueDate.getTime() ? "closed" : "active",
      isClosed: now.getTime() > dueDate.getTime(),
    };
  }

  function ensureNotice(config, fallbackButton, activityId) {
    const mountNode = getMountNode(config?.noticeMount || null, fallbackButton);
    if (!mountNode) {
      return null;
    }
    const noticeId = `activity-deadline-note-${activityId}`;
    let notice = document.getElementById(noticeId);
    if (!notice) {
      notice = document.createElement("div");
      notice.id = noticeId;
      notice.className = "activity-deadline-note";
      mountNode.insertBefore(notice, mountNode.firstChild);
    }
    return notice;
  }

  function setElementDisabledState(element, disabled) {
    if (!element) {
      return;
    }
    if ("disabled" in element) {
      element.disabled = disabled;
    }
    element.setAttribute("aria-disabled", disabled ? "true" : "false");
    element.style.opacity = disabled ? "0.75" : "";
    element.style.pointerEvents = disabled ? "none" : "";
    element.style.cursor = disabled ? "not-allowed" : "";
    if (element.tagName === "LABEL") {
      element.style.pointerEvents = disabled ? "none" : "";
    }
    if (element.tagName === "A") {
      if (disabled) {
        if (!element.dataset.deadlineHref) {
          element.dataset.deadlineHref = element.getAttribute("href") || "";
        }
        element.removeAttribute("href");
        element.setAttribute("tabindex", "-1");
      } else {
        if (element.dataset.deadlineHref) {
          element.setAttribute("href", element.dataset.deadlineHref);
        }
        element.removeAttribute("tabindex");
      }
    }
  }

  function toggleDisabledBySelector(selector, disabled) {
    if (!selector) {
      return;
    }
    document.querySelectorAll(selector).forEach((element) => {
      setElementDisabledState(element, disabled);
    });
  }

  function toggleDisabledByIds(ids, disabled) {
    (Array.isArray(ids) ? ids : []).forEach((id) => {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }
      setElementDisabledState(element, disabled);
    });
  }

  function applyAvailability(config) {
    const pageFile = resolvePageFile(config?.pageFile || "");
    const activityId = String(config?.activityId || "").trim();
    if (!pageFile || !activityId) {
      return { blocked: false, hasDeadline: false, state: "none" };
    }

    const policy = getPolicy(pageFile, activityId);
    const evaluation = evaluatePolicy(policy);
    const isLocked = Boolean(config?.isLocked);
    const blocked = !isLocked && evaluation.state === "closed";
    const button = config?.buttonId ? document.getElementById(config.buttonId) : null;
    const status = config?.statusId ? document.getElementById(config.statusId) : null;
    const notice = ensureNotice(config, button, activityId);
    const adminShell = ensureAdminControlShell(config, button, pageFile, activityId);

    toggleDisabledBySelector(config?.fieldSelector || "", isLocked);
    toggleDisabledBySelector(config?.extraDisableSelector || "", isLocked || blocked);
    toggleDisabledByIds(config?.extraDisableIds || [], isLocked || blocked);

    if (button) {
      button.disabled = isLocked || blocked;
      if (isLocked) {
        button.textContent = config.lockedButtonText || "Respuestas enviadas";
      } else if (blocked) {
        button.textContent = config.closedButtonText || "Entrega cerrada";
      } else {
        button.textContent = config.activeButtonText || "Guardar respuestas";
      }
    }

    if (notice) {
      if (!evaluation.hasDeadline) {
        notice.hidden = true;
        notice.textContent = "";
        notice.className = "activity-deadline-note";
      } else {
        notice.hidden = false;
        notice.className =
          "activity-deadline-note" + (blocked ? " is-closed" : " is-active");
        notice.textContent = blocked
          ? `Entrega cerrada el ${formatDueAt(evaluation.dueAt)}.`
          : `Disponible para entrega hasta ${formatDueAt(evaluation.dueAt)}.`;
      }
    }

    if (adminShell) {
      const input = adminShell.querySelector(".activity-deadline-admin-inline__input");
      const summary = adminShell.querySelector(".activity-deadline-admin-inline__head span");
      if (input) {
        input.value = evaluation.hasDeadline ? evaluation.dueAt : "";
      }
      if (summary) {
        summary.textContent = evaluation.hasDeadline
          ? `${getActivityLabel(pageFile, activityId)} · ${formatDueAt(evaluation.dueAt)}`
          : `${getActivityLabel(pageFile, activityId)} · sin fecha`;
      }
    }

    if (status && !isLocked && blocked) {
      status.style.display = "block";
      status.innerHTML = "&#9888; La fecha de entrega de esta actividad ya vencio.";
    }

    return {
      blocked,
      hasDeadline: evaluation.hasDeadline,
      state: evaluation.state,
      dueAt: evaluation.dueAt,
    };
  }

  function canSubmit(config) {
    const pageFile = resolvePageFile(config?.pageFile || "");
    const activityId = String(config?.activityId || "").trim();
    if (!pageFile || !activityId) {
      return true;
    }
    const evaluation = evaluatePolicy(getPolicy(pageFile, activityId));
    if (evaluation.state !== "closed") {
      return true;
    }
    if (config?.showAlert !== false) {
      window.alert(`La fecha de entrega de esta actividad ya vencio (${formatDueAt(evaluation.dueAt)}).`);
    }
    return false;
  }

  async function savePolicy(fileName, activityId, dueAt, updatedBy) {
    const cleanDueAt = normalizeDueAt(dueAt);
    if (!cleanDueAt) {
      throw new Error("Debes indicar una fecha valida.");
    }
    const next = cloneSnapshot(cachedSnapshot);
    if (!next.policies[fileName]) {
      next.policies[fileName] = {};
    }
    next.policies[fileName][activityId] = {
      dueAt: cleanDueAt,
      updatedAt: new Date().toISOString(),
      updatedBy: String(updatedBy || "admin").trim() || "admin",
    };
    next.updatedAt = next.policies[fileName][activityId].updatedAt;
    next.updatedBy = next.policies[fileName][activityId].updatedBy;
    writeLocalSnapshot(next);
    await saveCloudSnapshot(next);
    return cloneSnapshot(cachedSnapshot);
  }

  async function clearPolicy(fileName, activityId, updatedBy) {
    const next = cloneSnapshot(cachedSnapshot);
    if (next.policies[fileName]) {
      delete next.policies[fileName][activityId];
      if (!Object.keys(next.policies[fileName]).length) {
        delete next.policies[fileName];
      }
    }
    next.updatedAt = new Date().toISOString();
    next.updatedBy = String(updatedBy || "admin").trim() || "admin";
    writeLocalSnapshot(next);
    await saveCloudSnapshot(next);
    return cloneSnapshot(cachedSnapshot);
  }

  function getSnapshot() {
    return cloneSnapshot(cachedSnapshot);
  }

  function ready() {
    return loadPolicies(false);
  }

  cachedSnapshot = readLocalSnapshot();

  window.activityDeadlineManager = {
    getActivitiesForGuide,
    getPolicy,
    getSnapshot,
    formatDueAt,
    evaluatePolicy,
    getActivityLabel,
    applyAvailability,
    canSubmit,
    savePolicy,
    clearPolicy,
    setElementDisabledState,
    refreshPolicies: loadPolicies,
    ready,
    __test: {
      normalizeDueAt,
      normalizePolicies,
      cloneSnapshot,
      resolvePageFile,
      setNowProvider(provider) {
        nowProvider = typeof provider === "function" ? provider : null;
      },
    },
  };

  loadPolicies(false).catch(function () {
  });
})();

