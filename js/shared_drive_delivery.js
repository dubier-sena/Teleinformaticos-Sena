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

  function createDriveDeliveryPanel(config, handlers) {
    var panelConfig = config || {};
    var panelHandlers = handlers || {};

    var wrapper = document.createElement("div");
    wrapper.className = "info-box drive-submit-box";
    wrapper.setAttribute("data-drive-panel", panelConfig.panelKey || "");
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
        panelConfig.driveLabel || "Subir al portafolio de Drive",
        panelHandlers.onDriveClick
      )
    );
    actionGroup.appendChild(
      createActionButton(
        "btn-qr",
        panelConfig.qrLabel || "Abrir en movil - Ver QR",
        panelHandlers.onQrClick
      )
    );
    if (typeof panelHandlers.onSecureUploadClick === "function") {
      actionGroup.appendChild(
        createActionButton(
          "btn-drive btn-apps-script",
          panelConfig.secureLabel || "Entregar por formulario seguro",
          function () {
            panelHandlers.onSecureUploadClick(panelConfig.activityContext || {});
          }
        )
      );
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

      activityBody.appendChild(
        createDriveDeliveryPanel(
          {
            panelKey: config.panelKey,
            description: config.description,
            note: config.note,
            helperSuffix: settings.helperSuffix || "",
            driveLabel: settings.driveLabel,
            qrLabel: settings.qrLabel,
            secureLabel: settings.secureLabel,
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
        )
      );
    });
  }

  window.sharedDriveDelivery = {
    createDriveDeliveryPanel: createDriveDeliveryPanel,
    findActivityBodyByNumber: findActivityBodyByNumber,
    getActivityContextFromNode: getActivityContextFromNode,
    appendDriveDeliveryPanels: appendDriveDeliveryPanels,
  };
})();
