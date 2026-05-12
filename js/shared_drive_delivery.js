(function () {
  "use strict";

  function createTextElement(tagName, className, textContent) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = textContent || "";
    return element;
  }

  function createActionButton(className, textContent, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = textContent;
    if (typeof onClick === "function") {
      button.addEventListener("click", onClick);
    }
    return button;
  }

  function formatDeliveryDate(value) {
    var parsed = Date.parse(value || "");
    if (!Number.isFinite(parsed)) {
      return "";
    }

    try {
      return new Date(parsed).toLocaleString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (error) {
      return new Date(parsed).toLocaleString();
    }
  }

  function sanitizeLabel(value, fallback) {
    var clean = String(value || "")
      .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return clean || fallback || "";
  }

  function getGuideLabelFromDocument() {
    var heading = document.querySelector(".sidebar-logo h2");
    var titleSource = sanitizeLabel(
      (heading && heading.textContent) || document.title || window.location.pathname,
      "Guia"
    );
    var match = titleSource.match(/Gu[ií]a\s*(\d+)/i);

    if (match) {
      return "Guia " + match[1];
    }

    if (/Inducci/i.test(titleSource)) {
      return "Guia 1";
    }

    return titleSource.split("|")[0].trim() || "Guia";
  }

  function getActivityContextFromNode(node) {
    var activity = node && typeof node.closest === "function" ? node.closest(".activity") : null;
    var numberNode = activity ? activity.querySelector(".activity-num") : null;
    var titleNode = activity ? activity.querySelector(".activity-title") : null;
    var activityNumber = sanitizeLabel(numberNode && numberNode.textContent, "");
    var activityTitle = sanitizeLabel(titleNode && titleNode.textContent, "");

    return {
      guideLabel: getGuideLabelFromDocument(),
      activityNumber: activityNumber,
      activityTitle: activityTitle,
      activityLabel: activityNumber ? "Actividad " + activityNumber : "Actividad",
    };
  }

  function renderDeliveryStatus(wrapper, record) {
    if (!wrapper) {
      return;
    }

    var statusNode = wrapper.querySelector("[data-drive-delivery-status]");
    if (!statusNode) {
      statusNode = createTextElement("div", "delivery-upload-status", "");
      statusNode.setAttribute("data-drive-delivery-status", "");
      statusNode.hidden = true;
      wrapper.appendChild(statusNode);
    }

    if (!record || record.status !== "delivered") {
      statusNode.hidden = true;
      statusNode.textContent = "";
      statusNode.className = "delivery-upload-status";
      return;
    }

    var parts = ["Entrega registrada"];
    var dateLabel = formatDeliveryDate(record.submittedAt);
    if (dateLabel) {
      parts.push("Fecha: " + dateLabel);
    }
    if (record.savedFileName) {
      parts.push("Archivo: " + record.savedFileName);
    }

    statusNode.hidden = false;
    statusNode.className = "delivery-upload-status is-success";
    statusNode.textContent = parts.join(" | ");
  }

  function applyDeliveryCompletion(activityNode, shouldMarkDone) {
    if (!activityNode || !shouldMarkDone) {
      return;
    }

    if (typeof window.setGuideActivitySeen === "function") {
      window.setGuideActivitySeen(activityNode, true);
      return;
    }

    if (typeof window.updateGuideProgress === "function") {
      window.updateGuideProgress();
    }
  }

  function buildPanelActivityContext(panel) {
    return Object.assign({}, getActivityContextFromNode(panel), {
      panelKey: panel.getAttribute("data-drive-panel") || "",
      deadlineActivityId: panel.getAttribute("data-deadline-activity") || "",
      pageFile:
        window.__RUNTIME_PAGE_FILE__ ||
        window.location.pathname.split("/").pop() ||
        "",
    });
  }

  function ensureDeliveryDeadlineSlots(wrapper) {
    var adminSlot = wrapper.querySelector(".delivery-deadline-admin-slot");
    if (!adminSlot) {
      adminSlot = document.createElement("div");
      adminSlot.className = "delivery-deadline-admin-slot";
      wrapper.appendChild(adminSlot);
    }

    var noteSlot = wrapper.querySelector(".delivery-deadline-note-slot");
    if (!noteSlot) {
      noteSlot = document.createElement("div");
      noteSlot.className = "delivery-deadline-note-slot";
      wrapper.appendChild(noteSlot);
    }

    return { adminSlot: adminSlot, noteSlot: noteSlot };
  }

  function buildDeliveryActionSelector(panel) {
    var panelKey = panel && panel.getAttribute("data-drive-panel");
    if (!panelKey) {
      return "";
    }
    return (
      "[data-drive-panel='" +
      String(panelKey) +
      "'] .drive-action-group .btn-drive, " +
      "[data-drive-panel='" +
      String(panelKey) +
      "'] .drive-action-group .btn-qr, " +
      "[data-drive-panel='" +
      String(panelKey) +
      "'] .drive-action-group [data-apps-script-trigger]"
    );
  }

  function applyDeliveryDeadlineState(panel, activityContext) {
    if (!panel || !window.activityDeadlineManager?.applyAvailability) {
      return { blocked: false, hasDeadline: false, state: "none" };
    }

    var deadlineActivityId =
      (activityContext && activityContext.deadlineActivityId) ||
      panel.getAttribute("data-deadline-activity") ||
      "";

    if (!deadlineActivityId) {
      return { blocked: false, hasDeadline: false, state: "none" };
    }

    var slots = ensureDeliveryDeadlineSlots(panel);
    return window.activityDeadlineManager.applyAvailability({
      pageFile:
        (activityContext && activityContext.pageFile) ||
        window.__RUNTIME_PAGE_FILE__ ||
        window.location.pathname.split("/").pop() ||
        "",
      activityId: deadlineActivityId,
      noticeMount: { mountElement: slots.noteSlot },
      adminMount: { mountElement: slots.adminSlot },
      extraDisableSelector: buildDeliveryActionSelector(panel),
    });
  }

  function applyStoredDeliveryStatus(panel, activityNode, activityContext) {
    var record =
      window.sharedAppsScriptDelivery &&
      typeof window.sharedAppsScriptDelivery.loadDeliveryRecord === "function"
        ? window.sharedAppsScriptDelivery.loadDeliveryRecord(activityContext)
        : null;

    renderDeliveryStatus(panel, record);
    applyDeliveryCompletion(activityNode, Boolean(record && record.status === "delivered"));
    applyDeliveryDeadlineState(panel, activityContext);
  }

  function createDriveDeliveryPanel(config, handlers) {
    var panelConfig = config || {};
    var panelHandlers = handlers || {};

    var wrapper = document.createElement("div");
    wrapper.className = "info-box drive-submit-box";
    wrapper.setAttribute("data-drive-panel", panelConfig.panelKey || "");
    if (panelConfig.deadlineActivityId) {
      wrapper.setAttribute("data-deadline-activity", panelConfig.deadlineActivityId);
    }
    wrapper.style.marginTop = "16px";

    wrapper.appendChild(
      createTextElement("div", "label", "Entrega de esta actividad en Drive")
    );
    wrapper.appendChild(createTextElement("p", "", panelConfig.description || ""));

    var actionGroup = document.createElement("div");
    actionGroup.className = "drive-action-group";
    actionGroup.appendChild(
      createActionButton(
        "btn-drive",
        panelConfig.driveLabel || "📂 Subir al portafolio de Drive",
        panelHandlers.onDriveClick
      )
    );
    if (typeof panelHandlers.onSecureUploadClick === "function") {
      var secureButton = createActionButton(
        "btn-drive btn-apps-script",
        panelConfig.secureLabel || "📤 Entregar por formulario seguro",
        function () {
          panelHandlers.onSecureUploadClick(panelConfig.activityContext || {});
        }
      );
      secureButton.setAttribute("data-apps-script-trigger", "true");
      actionGroup.appendChild(secureButton);
    }
    wrapper.appendChild(actionGroup);

    var helperParts = [];
    if (panelConfig.note) {
      helperParts.push(panelConfig.note);
    }
    if (panelConfig.helperSuffix) {
      helperParts.push(panelConfig.helperSuffix);
    }
    wrapper.appendChild(
      createTextElement("div", "drive-helper-note", helperParts.join(" "))
    );
    if (panelConfig.deadlineActivityId) {
      ensureDeliveryDeadlineSlots(wrapper);
    }
    renderDeliveryStatus(wrapper, null);

    return wrapper;
  }

  function findActivityBodyByNumber(activityNumber, root) {
    var scope = root || document;
    var activity = Array.from(scope.querySelectorAll(".activity")).find(function (item) {
      var number = item.querySelector(".activity-num")?.textContent?.trim() || "";
      return number === activityNumber;
    });

    return activity?.querySelector(".activity-body") || null;
  }

  function appendDriveDeliveryPanels(options) {
    var settings = options || {};
    var targets = Array.isArray(settings.targets) ? settings.targets : [];

    targets.forEach(function (config) {
      var activityBody = findActivityBodyByNumber(config.activityNumber, settings.root);
      if (!activityBody) {
        return;
      }

      var selector = "[data-drive-panel='" + String(config.panelKey || "") + "']";
      if (activityBody.querySelector(selector)) {
        return;
      }

      var activityContext = Object.assign(
        {},
        getActivityContextFromNode(activityBody),
        config.activityContext || {}
      );
      activityContext.panelKey = config.panelKey || activityContext.panelKey || "";
      activityContext.pageFile =
        window.__RUNTIME_PAGE_FILE__ ||
        window.location.pathname.split("/").pop() ||
        "";

      var panel = createDriveDeliveryPanel(
        {
          panelKey: config.panelKey,
          deadlineActivityId: config.deadlineActivityId || activityContext.deadlineActivityId || "",
          description: config.description,
          note: config.note,
          helperSuffix: settings.helperSuffix || "",
          driveLabel: settings.driveLabel,
          qrLabel: settings.qrLabel,
          secureLabel: settings.secureLabel,
          hideQr: config.hideQr || settings.hideQr,
          activityContext: activityContext,
        },
        {
          onDriveClick: settings.onDriveClick,
          onQrClick: settings.onQrClick,
          onSecureUploadClick:
            window.sharedAppsScriptDelivery &&
            typeof window.sharedAppsScriptDelivery.openDeliveryModal === "function"
              ? window.sharedAppsScriptDelivery.openDeliveryModal
              : null,
        }
      );
      activityBody.appendChild(panel);
      applyStoredDeliveryStatus(panel, activityBody.closest(".activity"), activityContext);
    });
  }

  document.addEventListener("guide-delivery-registered", function (event) {
    var detail = (event && event.detail) || {};

    document.querySelectorAll("[data-drive-panel]").forEach(function (panel) {
      var activityContext = buildPanelActivityContext(panel);
      var samePanelKey =
        detail.panelKey &&
        activityContext.panelKey &&
        detail.panelKey === activityContext.panelKey;
      var sameActivity =
        detail.activityNumber &&
        activityContext.activityNumber &&
        detail.activityNumber === activityContext.activityNumber;

      if (!samePanelKey && !sameActivity) {
        return;
      }

      renderDeliveryStatus(panel, detail);
      applyDeliveryCompletion(panel.closest(".activity"), true);
    });
  });

  window.addEventListener("activity-deadlines-updated", function () {
    syncExistingDeliveryPanels(document);
  });

  function syncExistingDeliveryPanels(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-drive-panel]").forEach(function (panel) {
      applyStoredDeliveryStatus(
        panel,
        panel.closest(".activity"),
        buildPanelActivityContext(panel)
      );
    });
  }

  window.sharedDriveDelivery = {
    applyDeliveryDeadlineState: applyDeliveryDeadlineState,
    createDriveDeliveryPanel: createDriveDeliveryPanel,
    findActivityBodyByNumber: findActivityBodyByNumber,
    getActivityContextFromNode: getActivityContextFromNode,
    appendDriveDeliveryPanels: appendDriveDeliveryPanels,
    renderDeliveryStatus: renderDeliveryStatus,
    syncExistingDeliveryPanels: syncExistingDeliveryPanels,
  };
})();
