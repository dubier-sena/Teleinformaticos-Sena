(function () {
  const integrations = window.PROJECT_INTEGRATIONS || {};
  const portalAuth = window.portalAuth || null;
  const sharedAppsScriptDelivery = window.sharedAppsScriptDelivery || null;
  const ACTIVITY_CONFIGS = {
    "guia2-actividad4": {
      guideLabel: "Guia 2",
      activityLabel: "Actividad 4",
    },
  };

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

  function getGuideSelection() {
    const body = document.body;
    const defaults = {
      ficha: body.dataset.defaultFicha || "",
      inst: body.dataset.defaultInst || "",
      grupo: body.dataset.defaultGrupo || "",
    };

    return portalAuth ? portalAuth.getCurrentSelection(defaults) : defaults;
  }

  function getActivityIdentity() {
    const selection = getGuideSelection();
    const session = portalAuth?.getCurrentSession?.();
    const nameField = document.querySelector('[data-store="actividad4:nombre_completo"]');
    const fichaField = document.querySelector('[data-store="actividad4:ficha"]');

    return {
      fullName: String(nameField?.value || session?.user?.fullName || "").trim(),
      ficha: String(fichaField?.value || session?.user?.ficha || selection.ficha || "").trim(),
      grupo: selection.grupo || session?.user?.grupo || "",
      institucion: selection.inst || session?.user?.inst || "",
      pageFile: window.location.pathname.split("/").pop() || "",
    };
  }

  function buildDestinationPreview(identity, config, fileName) {
    if (
      sharedAppsScriptDelivery &&
      typeof sharedAppsScriptDelivery.buildDestinationPreview === "function"
    ) {
      return sharedAppsScriptDelivery.buildDestinationPreview(identity, config, fileName);
    }

    return `Ficha ${identity.ficha} / ${config.activityLabel}`;
  }

  function readFileAsBase64(file) {
    if (
      sharedAppsScriptDelivery &&
      typeof sharedAppsScriptDelivery.readFileAsBase64 === "function"
    ) {
      return sharedAppsScriptDelivery.readFileAsBase64(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",").pop() : result;
        resolve(base64 || "");
      };
      reader.onerror = () => reject(new Error("No fue posible leer el archivo seleccionado."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadDeliveryToAppsScript(payload) {
    if (
      sharedAppsScriptDelivery &&
      typeof sharedAppsScriptDelivery.uploadToAppsScript === "function"
    ) {
      return sharedAppsScriptDelivery.uploadToAppsScript(payload);
    }

    if (!integrations.googleAppsScriptUrl) {
      throw new Error(
        "La URL del Google Apps Script aun no esta configurada en js/project_integrations.js."
      );
    }

    const response = await fetch(integrations.googleAppsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(
        data.message || "No fue posible entregar el archivo en este momento."
      );
    }
    return data;
  }

  function setStatus(panel, message, type) {
    const status = panel.querySelector("[data-delivery-status]");
    if (!status) {
      return;
    }
    status.className = `delivery-upload-status${type ? ` is-${type}` : ""}`;
    status.textContent = message;
  }

  function updateIdentitySummary(panel, config) {
    const identity = getActivityIdentity();
    const summary = panel.querySelector("[data-delivery-identity]");
    const path = panel.querySelector("[data-delivery-path]");
    const selectedFile = panel.querySelector("[data-delivery-file]")?.files?.[0];
    const previewName =
      sharedAppsScriptDelivery?.buildDeliveryFileNamePreview?.(
        identity.fullName || "Aprendiz",
        config.activityLabel,
        selectedFile?.name || ".ext"
      ) || (selectedFile?.name || "Archivo pendiente");
    const destinationPreview =
      identity.ficha && identity.fullName
        ? buildDestinationPreview(identity, config, selectedFile?.name || ".ext")
        : "Completa nombre y ficha para generar el nombre final.";

    if (summary) {
      summary.innerHTML = `
        <strong>Aprendiz:</strong> ${escapeHtml(identity.fullName || "Pendiente")}<br>
        <strong>Ficha:</strong> ${escapeHtml(identity.ficha || "Pendiente")}<br>
        <strong>Archivo final:</strong> ${escapeHtml(previewName)}<br>
        <strong>Destino:</strong> ${escapeHtml(destinationPreview)}
      `;
    }

    if (path) {
      path.textContent =
        identity.ficha && identity.fullName
          ? destinationPreview
          : "Ruta pendiente de completar con nombre y ficha.";
    }
  }

  function validateFile(file) {
    if (
      sharedAppsScriptDelivery &&
      typeof sharedAppsScriptDelivery.validateFile === "function"
    ) {
      sharedAppsScriptDelivery.validateFile(file);
      return;
    }

    if (!file) {
      throw new Error("Selecciona el archivo que vas a entregar.");
    }

    if (integrations.maxUploadBytes && file.size > integrations.maxUploadBytes) {
      throw new Error("El archivo supera el tamano maximo permitido para esta entrega.");
    }

    const allowed = integrations.allowedUploadExtensions || [];
    if (allowed.length) {
      const lowerName = file.name.toLowerCase();
      const matches = allowed.some((extension) => lowerName.endsWith(extension));
      if (!matches) {
        throw new Error("El archivo no tiene una extension permitida para la entrega.");
      }
    }
  }

  async function handleDeliverySubmit(panel) {
    const activityKey = panel.getAttribute("data-activity-delivery") || "";
    const config = ACTIVITY_CONFIGS[activityKey];
    const fileInput = panel.querySelector('[data-delivery-file]');
    const button = panel.querySelector("[data-delivery-send]");
    const file = fileInput?.files?.[0];
    const identity = getActivityIdentity();

    if (!config) {
      setStatus(panel, "No se encontro la configuracion de esta entrega.", "error");
      return;
    }

    if (!identity.fullName || !identity.ficha) {
      setStatus(panel, "Completa primero tu nombre completo y numero de ficha.", "error");
      return;
    }

    try {
      validateFile(file);
    } catch (error) {
      setStatus(panel, error.message, "error");
      return;
    }

    button?.setAttribute("disabled", "disabled");
    setStatus(panel, "Subiendo archivo a la carpeta correspondiente de Drive...", "loading");

    try {
      const fileBase64 = await readFileAsBase64(file);
      const response = await uploadDeliveryToAppsScript({
        guideLabel: config.guideLabel,
        activityLabel: config.activityLabel,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64,
        fullName: identity.fullName,
        ficha: identity.ficha,
        grupo: identity.grupo,
        institucion: identity.institucion,
        pageFile: identity.pageFile,
        submittedAt: new Date().toISOString(),
      });

      const pathNode = panel.querySelector("[data-delivery-path]");
      if (pathNode && response.folderPath) {
        pathNode.textContent =
          response.folderPath +
          (response.savedFileName ? ` / ${response.savedFileName}` : "");
      }

      setStatus(
        panel,
        (response.message || "Entrega realizada en la carpeta correspondiente.") +
          (response.folderPath ? ` Ruta: ${response.folderPath}.` : "") +
          (response.savedFileName ? ` Archivo guardado como: ${response.savedFileName}.` : ""),
        "success"
      );

      if (response.driveUrl) {
        const resultLink = panel.querySelector("[data-delivery-result-link]");
        if (resultLink) {
          resultLink.href = response.driveUrl;
          resultLink.hidden = false;
        }
      }
    } catch (error) {
      setStatus(panel, error.message || "No fue posible completar la entrega.", "error");
    } finally {
      button?.removeAttribute("disabled");
    }
  }

  function bindPanel(panel) {
    const activityKey = panel.getAttribute("data-activity-delivery") || "";
    const config = ACTIVITY_CONFIGS[activityKey];
    if (!config) {
      return;
    }

    updateIdentitySummary(panel, config);

    panel.querySelector("[data-delivery-send]")?.addEventListener("click", () => {
      handleDeliverySubmit(panel);
    });

    panel.querySelector("[data-delivery-file]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      const fileName = panel.querySelector("[data-delivery-file-name]");
      if (fileName) {
        fileName.textContent = file ? file.name : "Aun no has seleccionado archivo.";
      }
      updateIdentitySummary(panel, config);
    });

    ['[data-store="actividad4:nombre_completo"]', '[data-store="actividad4:ficha"]'].forEach(
      (selector) => {
        document.querySelector(selector)?.addEventListener("input", () => {
          updateIdentitySummary(panel, config);
        });
      }
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-activity-delivery]").forEach(bindPanel);
  });

  window.uploadDeliveryToAppsScript = uploadDeliveryToAppsScript;
  window.readFileAsBase64 = readFileAsBase64;
})();
