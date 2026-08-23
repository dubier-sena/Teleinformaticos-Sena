(function () {
  "use strict";

  var MODAL_ID = "shared-apps-script-modal";
  var STYLE_ID = "shared-apps-script-style";
  var DEFAULT_ALLOWED_HOSTS = ["script.google.com", "script.googleusercontent.com"];
  var BLOCKED_UPLOAD_EXTENSIONS = [
    ".bat",
    ".cmd",
    ".com",
    ".exe",
    ".html",
    ".hta",
    ".jar",
    ".js",
    ".msi",
    ".php",
    ".ps1",
    ".scr",
    ".sh",
    ".svg",
    ".vbs",
  ];
  var currentContext = null;

  function getPortalAuth() {
    return window.portalAuth || null;
  }

  function getIntegrations() {
    return window.PROJECT_INTEGRATIONS || {};
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    var u = window.portalUtils;
    if (u && typeof u.escapeHtml === "function") return u.escapeHtml(value);
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function sanitizeLabel(value, fallback) {
    var clean = normalizeText(value)
      .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return clean || fallback || "";
  }

  function getFileExtension(fileName) {
    var match = String(fileName || "").trim().match(/(\.[a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : "";
  }

  function sanitizeFileSegment(value, fallback) {
    var cleaned = sanitizeLabel(value, fallback)
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");

    return cleaned || fallback || "";
  }

  function normalizeLearnerLabel(value, mode) {
    var normalized = normalizeText(value);
    var source =
      mode === "full"
        ? normalized
        : normalized.split(/\s+/).filter(Boolean)[0] || "Aprendiz";

    return sanitizeFileSegment(source, "Aprendiz") || "Aprendiz";
  }

  function normalizeActivitySegment(value) {
    var clean = sanitizeLabel(value, "Actividad");
    var match = clean.match(/^Actividad\s*(.*)$/i);
    var suffix = match ? match[1] : clean;
    var normalizedSuffix = String(suffix || "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "");

    return normalizedSuffix ? "Actividad-" + normalizedSuffix : "Actividad";
  }

  function getAllowedExtensions(context) {
    var integrationsAllowed = Array.isArray(getIntegrations().allowedUploadExtensions)
      ? getIntegrations().allowedUploadExtensions
          .map(function (extension) {
            return String(extension || "").trim().toLowerCase();
          })
          .filter(Boolean)
      : [];
    var contextAllowed =
      context && Array.isArray(context.allowedExtensions)
        ? context.allowedExtensions
            .map(function (extension) {
              return String(extension || "").trim().toLowerCase();
            })
            .filter(Boolean)
        : [];

    if (!contextAllowed.length) {
      return integrationsAllowed;
    }

    var normalizedContext = contextAllowed.filter(function (extension, index, list) {
      return list.indexOf(extension) === index;
    });
    if (!integrationsAllowed.length) {
      return normalizedContext;
    }

    return normalizedContext.filter(function (extension) {
      return integrationsAllowed.indexOf(extension) >= 0;
    });
  }

  function getFileNamePrefix(context) {
    return context && context.fileNamePrefix
      ? sanitizeFileSegment(context.fileNamePrefix, "")
      : "";
  }

  function getLearnerNameMode(context) {
    return context && context.learnerNameMode === "full" ? "full" : "firstToken";
  }

  // Resuelve el número de guía y el shortName desde ActivityStandard para
  // generar el nombre estándar incluso si el contexto no los trae.
  function resolveGuideStandardContext(context) {
    var std = window.ActivityStandard;
    if (!std || typeof std.getConfigForGuide !== "function") return null;
    var pageFile =
      (context && context.pageFile) ||
      window.__RUNTIME_PAGE_FILE__ ||
      (window.location.pathname.split("/").pop() || "");
    var config = std.getConfigForGuide(pageFile);
    if (!config) return null;
    var actId =
      (context && (context.deadlineActivityId || context.activityId || context.panelKey)) || "";
    var actDef = (config.activities || []).find(function (act) {
      return (
        act.id === actId ||
        act.id === (context && context.deadlineActivityId) ||
        act.number === (context && context.activityNumber)
      );
    }) || null;
    return {
      guideNumber: config.guideNumber || "",
      shortName: (actDef && actDef.shortName) || "",
    };
  }

  function buildStandardFileName(fullName, context, originalFileName, ficha) {
    var std = window.ActivityStandard;
    if (!std || typeof std.generateEvidenceFileName !== "function") return "";
    var resolved = resolveGuideStandardContext(context) || {};
    var guideNumber = (context && context.guideNumber) || resolved.guideNumber || "";
    var shortName =
      (context && (context.shortName || context.activityShortName)) ||
      resolved.shortName ||
      (context && context.activityTitle) ||
      (context && context.activityLabel) ||
      "";
    var activityNumber =
      (context && (context.activityNumber || context.activityLabel)) || "";
    if (!guideNumber || !activityNumber) return "";
    return std.generateEvidenceFileName({
      guiaNumero: guideNumber,
      actividadNumero: activityNumber,
      actividadTitulo: shortName,
      ficha: (context && context.ficha) || ficha,
      nombreAprendiz: fullName,
      originalFileName: originalFileName || "",
    });
  }

  function buildDeliveryFileNamePreview(fullName, contextOrActivityLabel, fileName, ficha) {
    var context =
      contextOrActivityLabel && typeof contextOrActivityLabel === "object"
        ? contextOrActivityLabel
        : { activityLabel: contextOrActivityLabel };
    var extension = getFileExtension(fileName || ".ext");
    var prefix = getFileNamePrefix(context);
    var learnerLabel = normalizeLearnerLabel(fullName, getLearnerNameMode(context));

    var standard = buildStandardFileName(fullName, context, fileName, ficha);
    if (standard) return standard;

    if (prefix) {
      return (
        prefix +
        "_" +
        learnerLabel +
        "_" +
        sanitizeFileSegment((context && context.ficha) || ficha, "SIN_FICHA") +
        extension
      );
    }

    return learnerLabel + "_" + normalizeActivitySegment(context.activityLabel) + extension;
  }

  function buildGuideFolderLabel(context) {
    return sanitizeLabel(
      (context && context.guideLabel) || getGuideLabelFromDocument(),
      "Guia"
    );
  }

  function buildActivityFolderLabel(context) {
    var activityNumber = sanitizeLabel(context && context.activityNumber, "");
    var activityTitle = sanitizeLabel(
      context && (context.activityTitle || context.activityLabel),
      "Actividad"
    );

    if (activityNumber && activityTitle) {
      var normalizedLabel = ("Actividad " + activityNumber).toLowerCase();
      var normalizedTitle = activityTitle.toLowerCase();

      if (normalizedTitle === normalizedLabel || normalizedTitle === activityNumber.toLowerCase()) {
        return activityNumber;
      }

      return activityNumber + " - " + activityTitle;
    }

    return activityNumber || activityTitle;
  }

  function buildDestinationFolderPreview(identity, context) {
    var segments = ["Ficha " + sanitizeLabel(identity.ficha, "SIN_FICHA")];
    var guideLabel = buildGuideFolderLabel(context);
    var activityLabel = buildActivityFolderLabel(context);

    if (guideLabel) {
      segments.push(guideLabel);
    }
    if (activityLabel) {
      segments.push(activityLabel);
    }

    return segments.join(" / ");
  }

  function getDefaultSelection() {
    var body = document.body || {};
    return {
      ficha: body.dataset && body.dataset.defaultFicha ? body.dataset.defaultFicha : "",
      inst: body.dataset && body.dataset.defaultInst ? body.dataset.defaultInst : "",
      grupo: body.dataset && body.dataset.defaultGrupo ? body.dataset.defaultGrupo : "",
    };
  }

  function getCurrentSelection() {
    var defaults = getDefaultSelection();
    var auth = getPortalAuth();
    return auth && typeof auth.getCurrentSelection === "function"
      ? auth.getCurrentSelection(defaults)
      : defaults;
  }

  function getCurrentIdentity() {
    var auth = getPortalAuth();
    var session =
      auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
    var selection = getCurrentSelection();
    var user = session && session.role === "student" && session.user ? session.user : null;

    return {
      session: session,
      fullName: normalizeText(user && user.fullName),
      ficha: normalizeText((user && user.ficha) || selection.ficha),
      grupo: normalizeText((user && user.grupo) || selection.grupo),
      institucion: normalizeText((user && user.inst) || selection.inst),
      pageFile: window.location.pathname.split("/").pop() || "",
    };
  }

  function getDeliveryStorageKey(context) {
    var identity = getCurrentIdentity();
    var pageFile =
      (context && context.pageFile) ||
      window.__RUNTIME_PAGE_FILE__ ||
      identity.pageFile ||
      "guia.html";
    var activitySegment = sanitizeFileSegment(
      (context && (context.panelKey || context.activityNumber || context.activityLabel)) || "actividad",
      "actividad"
    );
    var storageBase = pageFile.replace(/\.html$/i, "") + ":delivery:" + activitySegment;
    var auth = getPortalAuth();

    return auth && typeof auth.getScopedStorageKey === "function"
      ? auth.getScopedStorageKey(storageBase, { area: "guide-data" })
      : storageBase;
  }

  function loadDeliveryRecord(context) {
    try {
      var raw = window.localStorage.getItem(getDeliveryStorageKey(context));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveDeliveryRecord(context, record) {
    try {
      window.localStorage.setItem(
        getDeliveryStorageKey(context),
        JSON.stringify(record || {})
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  function notifyDeliveryRegistered(record) {
    try {
      document.dispatchEvent(
        new CustomEvent("guide-delivery-registered", {
          detail: record || {},
        })
      );
    } catch (error) {
    }
  }

  function markGuideActivitySeenForRecord(record) {
    if (!record || typeof window.setGuideActivitySeen !== "function") {
      return;
    }

    var activity = Array.from(document.querySelectorAll(".activity")).find(function (node) {
      var number = normalizeText(
        node.querySelector(".activity-num") && node.querySelector(".activity-num").textContent
      );
      var title = normalizeText(
        node.querySelector(".activity-title") && node.querySelector(".activity-title").textContent
      );
      return (
        (record.activityNumber && number === normalizeText(record.activityNumber)) ||
        (record.activityTitle && title === normalizeText(record.activityTitle)) ||
        (record.activityLabel && title === normalizeText(record.activityLabel))
      );
    });

    if (activity) {
      window.setGuideActivitySeen(activity, true);
    }
  }

  function getGuideLabelFromDocument() {
    var heading = document.querySelector(".sidebar-logo h2");
    var titleSource = normalizeText(
      (heading && heading.textContent) || document.title || window.location.pathname
    );
    var match = titleSource.match(/Gu[ií]a\s*(\d+)/i);

    if (match) {
      return "Guia " + match[1];
    }

    if (/Inducci/i.test(titleSource)) {
      return "Guia 1";
    }

    return sanitizeLabel(titleSource.split("|")[0], "Guia");
  }

  function getActivityContextFromNode(node) {
    var sharedContext =
      window.sharedDriveDelivery &&
      typeof window.sharedDriveDelivery.getActivityContextFromNode === "function"
        ? window.sharedDriveDelivery.getActivityContextFromNode(node)
        : null;

    if (sharedContext && sharedContext.activityLabel) {
      return sharedContext;
    }

    var activity = node && typeof node.closest === "function" ? node.closest(".activity") : null;
    var numberNode = activity ? activity.querySelector(".activity-num") : null;
    var titleNode = activity ? activity.querySelector(".activity-title") : null;
    var activityNumber = sanitizeLabel(numberNode && numberNode.textContent, "");
    var activityTitle = sanitizeLabel(titleNode && titleNode.textContent, "");
    var activityLabel = activityNumber ? "Actividad " + activityNumber : "Actividad";

    return {
      guideLabel: getGuideLabelFromDocument(),
      activityNumber: activityNumber,
      activityTitle: activityTitle,
      activityLabel: activityLabel,
    };
  }

  function getAllowedHosts() {
    var configured = getIntegrations().googleAppsScriptAllowedHosts;
    return Array.isArray(configured) && configured.length ? configured : DEFAULT_ALLOWED_HOSTS;
  }

  function isValidAppsScriptUrl(value) {
    var raw = normalizeText(value);
    if (!raw) {
      return false;
    }

    try {
      var parsed = new URL(raw);
      if (parsed.protocol !== "https:") {
        return false;
      }

      var host = parsed.hostname.toLowerCase();
      var allowed = getAllowedHosts().some(function (allowedHost) {
        var normalized = String(allowedHost || "").toLowerCase();
        return host === normalized || host.endsWith("." + normalized);
      });

      if (!allowed) {
        return false;
      }

      return /\/macros\//.test(parsed.pathname) || /\/exec$/.test(parsed.pathname);
    } catch (error) {
      return false;
    }
  }

  function getAcceptedFileTypes(context) {
    var allowed = getAllowedExtensions(context);
    return allowed.length ? allowed.join(",") : "";
  }

  function validateFile(file, context) {
    var integrations = getIntegrations();

    if (!file) {
      throw new Error("Selecciona el archivo que vas a entregar.");
    }

    var maxUploadBytes =
      context && Number(context.maxUploadBytes) > 0
        ? Number(context.maxUploadBytes)
        : integrations.maxUploadBytes;

    if (maxUploadBytes && file.size > maxUploadBytes) {
      throw new Error("El archivo supera el tamano maximo permitido para esta entrega.");
    }

    var extension = getFileExtension(file.name);
    if (!extension || BLOCKED_UPLOAD_EXTENSIONS.indexOf(extension) >= 0) {
      throw new Error("El archivo no tiene una extension permitida para la entrega.");
    }

    var allowed = getAllowedExtensions(context);
    if (allowed.length) {
      var lowerName = String(file.name || "").toLowerCase();
      var matches = allowed.some(function (extension) {
        return lowerName.endsWith(String(extension || "").toLowerCase());
      });

      if (!matches) {
        throw new Error("El archivo no tiene una extension permitida para la entrega.");
      }
    }

    var allowedMimeTypes =
      context && Array.isArray(context.allowedMimeTypes)
        ? context.allowedMimeTypes
            .map(function (mimeType) {
              return String(mimeType || "").trim().toLowerCase();
            })
            .filter(Boolean)
        : [];
    var fileType = String(file.type || "").trim().toLowerCase();
    if (allowedMimeTypes.length && fileType && allowedMimeTypes.indexOf(fileType) < 0) {
      throw new Error("El tipo de archivo no esta permitido para esta entrega.");
    }
  }

  function readFileAsBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var base64 = result.indexOf(",") >= 0 ? result.split(",").pop() : result;
        resolve(base64 || "");
      };
      reader.onerror = function () {
        reject(new Error("No fue posible leer el archivo seleccionado."));
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Reintento automatico de la entrega (Capa 2) ──────────────────────────
  // En un laboratorio con la sala entregando a la vez, la subida puede fallar por
  // congestion o porque el token no estaba listo un instante. En vez de rendirse
  // al primer intento, reintentamos con backoff + jitter. Los errores PERMANENTES
  // (extension/tamano/datos/carpeta) NO se reintentan: fallarian igual.
  function isPermanentDeliveryError(error) {
    var msg = String((error && error.message) || "").toLowerCase();
    return (
      msg.indexOf("extension") >= 0 ||
      msg.indexOf("tamano") >= 0 ||
      msg.indexOf("tamaño") >= 0 ||
      msg.indexOf("selecciona el archivo") >= 0 ||
      msg.indexOf("faltan datos") >= 0 ||
      msg.indexOf("carpeta") >= 0 ||
      msg.indexOf("no esta configurada") >= 0 ||
      msg.indexOf("no cumple la politica") >= 0
    );
  }

  // Reintenta fn() ante errores transitorios con backoff exponencial + jitter.
  // Recibe sus dependencias (sleep/rand) para ser testeable de forma determinista.
  async function retryWithBackoff(fn, opts) {
    opts = opts || {};
    var maxAttempts = opts.maxAttempts || 4;
    var maxDelay = opts.maxDelayMs || 15000;
    var delay = opts.baseDelayMs || 3000;
    var rand = opts.rand || Math.random;
    var sleepFn =
      opts.sleep ||
      function (ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
      };
    var onRetry = opts.onRetry || function () {};
    var isPermanent = opts.isPermanent || function () { return false; };

    var lastError;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        if (isPermanent(error) || attempt >= maxAttempts) throw error;
        var wait = delay + Math.floor(rand() * delay);
        try { onRetry(attempt + 1, wait, error); } catch (_) {}
        await sleepFn(wait);
        delay = Math.min(delay * 2, maxDelay);
      }
    }
    throw lastError;
  }

  // ── Cola durable de entregas (Capa 2b): IndexedDB + reintento en background ──
  // Si la entrega no pasa en sesion (error transitorio), se guarda el payload
  // completo en IndexedDB y se reintenta solo en cargas posteriores hasta
  // entregarse: el aprendiz no pierde el archivo ni tiene que volver a subirlo.
  var DELIVERY_QUEUE_DB = "sena_portal_delivery_queue";
  var DELIVERY_QUEUE_STORE = "pending";
  var deliveryQueueRunning = false;

  function deliveryIdbAvailable() {
    return typeof window !== "undefined" && !!window.indexedDB;
  }

  function deliveryIdbOpen() {
    return new Promise(function (resolve, reject) {
      if (!deliveryIdbAvailable()) { reject(new Error("no-indexeddb")); return; }
      var req = window.indexedDB.open(DELIVERY_QUEUE_DB, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(DELIVERY_QUEUE_STORE)) {
          db.createObjectStore(DELIVERY_QUEUE_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open")); };
    });
  }

  function deliveryIdbGetAll() {
    return deliveryIdbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var req = db
          .transaction(DELIVERY_QUEUE_STORE, "readonly")
          .objectStore(DELIVERY_QUEUE_STORE)
          .getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function deliveryIdbPut(entry) {
    return deliveryIdbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DELIVERY_QUEUE_STORE, "readwrite");
        tx.objectStore(DELIVERY_QUEUE_STORE).put(entry);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function deliveryIdbRemove(key) {
    return deliveryIdbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DELIVERY_QUEUE_STORE, "readwrite");
        tx.objectStore(DELIVERY_QUEUE_STORE).delete(key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  var deliveryIdbStorage = {
    getAll: deliveryIdbGetAll,
    put: deliveryIdbPut,
    remove: deliveryIdbRemove,
  };

  // Una entrega pendiente por actividad/pagina (la ultima reemplaza a la previa).
  function deliveryQueueKey(deliveryCtx) {
    return (
      (deliveryCtx.pageFile || "guia") +
      "|" +
      (deliveryCtx.panelKey || deliveryCtx.activityNumber || deliveryCtx.activityLabel || "act")
    );
  }

  async function enqueueDelivery(payload, deliveryCtx) {
    if (!deliveryIdbAvailable()) return false;
    var identity = getCurrentIdentity();
    var entry = {
      key: deliveryQueueKey(deliveryCtx),
      payload: payload,
      deliveryCtx: deliveryCtx,
      // Seguridad (cierre de riesgos 2026-08-22, "computador compartido"):
      // runDeliveryQueue corre en CADA carga de pagina sin distinguir de
      // quien es la cola. Sin este campo, si esta entrega quedara pendiente
      // y despues OTRO aprendiz iniciara sesion en el MISMO equipo, se
      // reintentaria la subida con la sesion nueva -- el archivo de uno
      // terminaria registrado como entrega de otro. Ver el chequeo en
      // processDeliveryQueue.
      ownerUsernameKey: (identity.session && identity.session.user && identity.session.user.usernameKey) || "",
      createdAt: Date.now(),
      attempts: 0,
      status: "pending",
    };
    try {
      await deliveryIdbStorage.put(entry);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Auditoria 2026-08-22, Fase 9: separa el momento del INTENTO (clic del
  // aprendiz, dctx.submittedAt -- se fija una sola vez y viaja intacto a
  // traves de reintentos/cola durable) del momento en que Drive CONFIRMO la
  // creacion del archivo (response.confirmedAt, viene del Apps Script;
  // getDateCreated() del archivo real). Si el Apps Script desplegado todavia
  // no manda confirmedAt (version vieja, pendiente de redeploy), se usa
  // uploadedAt (cuando ESTE cliente recibio la respuesta exitosa) como mejor
  // alternativa disponible -- nunca se deja de tener una fecha.
  function buildDeliveryRecord(dctx, response) {
    response = response || {};
    var attemptedAt = dctx.submittedAt || new Date().toISOString();
    var uploadedAt = dctx.uploadedAt || new Date().toISOString();
    var confirmedAt = response.confirmedAt || uploadedAt;
    return {
      guideLabel: dctx.guideLabel,
      activityNumber: dctx.activityNumber || "",
      activityTitle: dctx.activityTitle || "",
      activityLabel: dctx.activityLabel || "Actividad",
      panelKey: dctx.panelKey || "",
      guiaNumero: dctx.guideNumber || "",
      actividadNumero: dctx.activityNumber || "",
      actividadTitulo: dctx.activityTitle || dctx.activityLabel || "",
      shortName: dctx.shortName || "",
      nombreAprendiz: dctx.fullName,
      nombreArchivoOriginal: dctx.fileName || "",
      originalFileName: dctx.fileName || "",
      nombreArchivoEstandar: response.savedFileName || dctx.standardName || "",
      pageFile: dctx.pageFile,
      fullName: dctx.fullName,
      ficha: dctx.ficha,
      grupo: dctx.grupo,
      institucion: dctx.institucion,
      // Compat (Fase 12): submittedAt/fechaEntrega son los campos que ya leen
      // paneles/exportaciones existentes como "la" fecha de entrega -- ahora
      // apuntan a la mejor fecha disponible (confirmada > subida > intento)
      // en vez de solo el reloj del navegador al momento del clic.
      submittedAt: confirmedAt,
      fechaEntrega: confirmedAt,
      attemptedAt: attemptedAt,
      uploadedAt: uploadedAt,
      confirmedAt: confirmedAt,
      method: dctx.method || "automatic",
      fileId: response.fileId || "",
      folderPath: response.folderPath || "",
      savedFileName: response.savedFileName || dctx.standardName || dctx.fileName || "",
      driveUrl: response.driveUrl || "",
      enlaceDrive: response.driveUrl || "",
      backupDriveUrl: response.backupDriveUrl || "",
      respaldoDriveUrl: response.backupDriveUrl || "",
      backupFolderPath: response.backupFolderPath || "",
      backupSavedFileName: response.backupSavedFileName || "",
      backupError: response.backupError || "",
      status: "delivered",
    };
  }

  // Finaliza una entrega exitosa: registra el record, marca la actividad y avisa
  // a la guia. Con nodes (entrega en sesion) ademas actualiza el modal; sin nodes
  // (reintento de la cola) finaliza headless. Reutilizado por ambos caminos.
  function finalizeDelivery(dctx, response, nodes) {
    response = response || {};
    dctx = Object.assign({}, dctx, { uploadedAt: dctx.uploadedAt || new Date().toISOString() });
    var record = buildDeliveryRecord(dctx, response);
    if (nodes) {
      if (response.folderPath && nodes.path) {
        nodes.path.textContent =
          response.folderPath + (response.savedFileName ? " / " + response.savedFileName : "");
      }
      setStatus(
        nodes.status,
        (response.message || "Entrega registrada correctamente en la carpeta correspondiente.") +
          (response.folderPath ? " Ruta: " + response.folderPath + "." : "") +
          (response.savedFileName ? " Archivo guardado como: " + response.savedFileName : ""),
        "success"
      );
      if (response.driveUrl && nodes.resultLink) {
        nodes.resultLink.href = response.driveUrl;
        nodes.resultLink.hidden = false;
      }
    }
    saveDeliveryRecord(dctx.context, record);
    markGuideActivitySeenForRecord(record);
    notifyDeliveryRegistered(record);
    return record;
  }

  // Logica pura (recibe storage/upload/finalize/isPermanent) para probarse sin
  // IndexedDB. Exito -> finaliza y quita; transitorio -> conserva e incrementa
  // intentos; permanente / agotada / muy vieja -> descarta.
  async function processDeliveryQueue(deps) {
    var storage = deps.storage;
    var upload = deps.upload;
    var finalize = deps.finalize;
    var isPermanent = deps.isPermanent || function () { return false; };
    var maxAttempts = deps.maxAttempts || 25;
    var maxAgeMs = deps.maxAgeMs || 7 * 24 * 60 * 60 * 1000;
    var now = deps.now || Date.now;
    // Seguridad (computador compartido): identidad de la sesion ACTUAL. Si
    // una entrada tiene un dueno registrado (ownerUsernameKey) que no
    // coincide, se deja pendiente SIN intentar -- nunca se sube con la
    // identidad de otro aprendiz. Entradas viejas sin ownerUsernameKey
    // (guardadas antes de este cambio) no tienen esa info: se reintentan
    // igual que siempre (compatibilidad; el riesgo ya existia antes de este
    // fix y desaparece solo cuando esas entradas se agoten/entreguen).
    var currentUsernameKey = deps.currentUsernameKey || function () { return ""; };

    var entries = await storage.getAll();
    var result = { delivered: 0, kept: 0, dropped: 0, skippedOtherSession: 0 };
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || entry.status === "delivered") continue;
      if (
        (entry.attempts || 0) >= maxAttempts ||
        (entry.createdAt && now() - entry.createdAt > maxAgeMs)
      ) {
        await storage.remove(entry.key);
        result.dropped += 1;
        continue;
      }
      if (entry.ownerUsernameKey && entry.ownerUsernameKey !== currentUsernameKey()) {
        result.skippedOtherSession += 1;
        continue;
      }
      try {
        var response = await upload(entry.payload);
        await finalize(entry, response);
        await storage.remove(entry.key);
        result.delivered += 1;
      } catch (error) {
        if (isPermanent(error)) {
          await storage.remove(entry.key);
          result.dropped += 1;
          continue;
        }
        entry.attempts = (entry.attempts || 0) + 1;
        entry.lastError = String((error && error.message) || "");
        try { await storage.put(entry); } catch (_) {}
        result.kept += 1;
      }
    }
    return result;
  }

  async function runDeliveryQueue() {
    if (deliveryQueueRunning || !deliveryIdbAvailable()) return;
    deliveryQueueRunning = true;
    try {
      await processDeliveryQueue({
        storage: deliveryIdbStorage,
        upload: function (payload) { return uploadToAppsScript(payload); },
        finalize: function (entry, response) {
          return finalizeDelivery(entry.deliveryCtx, response, null);
        },
        isPermanent: isPermanentDeliveryError,
        currentUsernameKey: function () {
          var identity = getCurrentIdentity();
          return (identity.session && identity.session.user && identity.session.user.usernameKey) || "";
        },
      });
    } catch (error) {
      /* best-effort: se reintenta en la proxima pasada */
    } finally {
      deliveryQueueRunning = false;
    }
  }

  // ── Respaldo manual a Drive (cuando la entrega automatica falla) ─────────────
  // Abre la carpeta de la ficha y dice el nombre EXACTO del archivo, para que el
  // aprendiz suba el archivo a mano. Nota: una subida manual NO queda registrada
  // en el portal (el instructor la ve por la fecha en Drive).
  function safEscape(value) {
    return String(value == null ? "" : value).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function getDriveFolderUrlForFicha(ficha) {
    var integrations = getIntegrations() || {};
    var map = integrations.fichaDriveFolders || {};
    return map[String(ficha == null ? "" : ficha).trim()] || "";
  }

  // Respaldo inline (para el modal, que ya esta abierto). Rellena `container`.
  //
  // Fase 8 (auditoria 2026-08-22): antes este bloque aparecia SIEMPRE junto al
  // mensaje de "quedo en cola" dando la impresion de que dos cosas ya habian
  // pasado a la vez. Ahora el titulo distingue explicitamente: la entrega
  // AUTOMATICA no se completo (punto), y presenta las dos opciones que
  // siguen como alternativas separadas, nunca como hechos consumados.
  //
  // Fase 10: si se pasa `verifyPayload`, se ofrece el boton "Ya subi el
  // archivo -- verificar entrega", que consulta al Apps Script (accion
  // "verify") si el archivo ya aparece en la carpeta correcta. Solo si lo
  // encuentra se llama a `opts.onVerified(response)`; si no, se avisa
  // claramente que todavia no se pudo confirmar -- nunca se marca como
  // entregada sin que el servidor lo confirme.
  function renderManualDriveFallback(container, opts) {
    if (!container) return false;
    opts = opts || {};
    var folderUrl = getDriveFolderUrlForFicha(opts.ficha);
    var name = opts.suggestedName || "";
    var parts = [];
    parts.push(
      '<div class="saf-title">&#9888;&#65039; La entrega automatica no pudo completarse.</div>'
    );
    if (opts.queued) {
      parts.push(
        '<p class="saf-option-label"><strong>Opcion 1 -- Reintentar automaticamente:</strong> ' +
          'ya quedo guardada en tu equipo y el portal seguira intentando enviarla solo, incluso si cierras esta ventana. ' +
          'No tienes que hacer nada para esto.</p>'
      );
    }
    parts.push(
      '<p class="saf-option-label"><strong>Opcion ' + (opts.queued ? "2" : "1") +
        ' -- Subir tu mismo ahora, sin esperar:</strong></p>'
    );
    if (folderUrl) {
      parts.push(
        '<a class="saf-open" href="' +
          safEscape(folderUrl) +
          '" target="_blank" rel="noopener noreferrer">&#128194; Abrir carpeta de Drive de tu ficha</a>'
      );
    } else {
      parts.push(
        '<div class="saf-nofolder">No hay carpeta de Drive configurada para tu ficha. Pide el enlace a tu instructor.</div>'
      );
    }
    if (name) {
      parts.push(
        '<div class="saf-name">Sube el archivo con este nombre exacto:<br>' +
          '<code data-saf-name>' + safEscape(name) + "</code> " +
          '<button type="button" class="saf-copy" data-saf-copy>Copiar nombre</button></div>'
      );
    }
    if (opts.verifyPayload) {
      parts.push(
        '<div class="saf-verify">' +
          '<button type="button" class="btn secondary saf-verify-btn" data-saf-verify>' +
          '&#128269; Ya subi el archivo -- verificar entrega</button>' +
          '<span class="saf-verify-status" data-saf-verify-status></span>' +
          '</div>'
      );
    }
    parts.push(
      '<div class="saf-hint">Si usas la opcion manual, tu instructor vera el archivo por la fecha en Drive ' +
        (opts.verifyPayload
          ? "hasta que uses el boton de verificar (arriba) para que el portal registre la entrega."
          : "; la entrega manual no queda registrada como entregada en el portal.") +
        '</div>'
    );
    container.innerHTML = parts.join("");
    container.hidden = false;
    var copyBtn = container.querySelector("[data-saf-copy]");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(name);
            copyBtn.textContent = "Nombre copiado";
          }
        } catch (clipError) {
          /* sin portapapeles: el aprendiz copia a mano */
        }
      });
    }
    var verifyBtn = container.querySelector("[data-saf-verify]");
    var verifyStatus = container.querySelector("[data-saf-verify-status]");
    if (verifyBtn && opts.verifyPayload) {
      verifyBtn.addEventListener("click", async function () {
        verifyBtn.setAttribute("disabled", "disabled");
        if (verifyStatus) verifyStatus.textContent = " Verificando en Drive...";
        try {
          var result = await verifyManualDelivery(opts.verifyPayload);
          if (result && result.found) {
            if (verifyStatus) verifyStatus.textContent = " ✅ Encontrada y registrada.";
            if (typeof opts.onVerified === "function") opts.onVerified(result);
          } else {
            if (verifyStatus) {
              verifyStatus.textContent =
                " Todavia no la encontramos. Confirma que ya terminaste de subirla con el nombre sugerido, " +
                "espera unos segundos y vuelve a intentar.";
            }
          }
        } catch (verifyError) {
          if (verifyStatus) {
            verifyStatus.textContent = " " + (verifyError && verifyError.message ? verifyError.message : "No se pudo verificar.");
          }
        } finally {
          verifyBtn.removeAttribute("disabled");
        }
      });
    }
    return true;
  }

  // Respaldo por dialogo (para subidas personalizadas sin modal, p.ej. imagenes).
  async function offerManualDriveFallback(opts) {
    opts = opts || {};
    var folderUrl = getDriveFolderUrlForFicha(opts.ficha);
    var name = opts.suggestedName
      ? "\n\nNombra tu archivo exactamente asi:\n" + opts.suggestedName
      : "";
    if (!folderUrl) {
      if (typeof window.portalAlert === "function") {
        window.portalAlert(
          "No se pudo entregar. Pide a tu instructor el enlace de la carpeta de Drive para subir el archivo manualmente." +
            name,
          { type: "warning" }
        );
      }
      return false;
    }
    var message =
      (opts.message || "No se pudo entregar automaticamente.") +
      " Puedes subir el archivo a mano a tu carpeta de Drive como respaldo." +
      name;
    var ok =
      typeof window.portalConfirm === "function"
        ? await window.portalConfirm(message, {
            title: "Subir manualmente a Drive",
            confirmText: "Abrir carpeta de Drive",
          })
        : true;
    if (ok) {
      try { window.open(folderUrl, "_blank", "noopener"); } catch (openError) {}
    }
    return ok;
  }

  // Extraido de uploadToAppsScript (antes duplicado) para que
  // verifyManualDelivery use exactamente la misma obtencion de token con
  // pre-chequeo (Fase 10, auditoria 2026-08-22).
  async function getDeliveryIdToken() {
    var idToken = null;
    try {
      var bridge = window.portalFirebaseAuth;
      if (bridge && typeof bridge.getIdToken === "function") {
        // Esperar a que la sesion de Firebase termine de hidratarse: al cambiar
        // de pagina (index -> guia) el SDK rehidrata la sesion persistida de
        // forma asincrona. Sin esta espera, getIdToken puede devolver null
        // aunque el aprendiz si tenga sesion.
        if (typeof bridge.waitForAuthHydration === "function") {
          try { await bridge.waitForAuthHydration(4000); } catch (hydrationError) {}
        }
        // Usar el token en cache (getIdToken(false)): el SDK de Firebase lo
        // refresca automaticamente SOLO si esta vencido o por vencer (~5 min).
        // Antes se forzaba un refresco en CADA entrega (getIdToken(true)), lo que
        // multiplicaba las llamadas a Firebase Auth y agravaba el limite
        // "auth/too-many-requests" cuando una sala completa entrega al mismo
        // tiempo. El caso de >1 hora en la pagina sigue cubierto porque el SDK
        // refresca al vencer, asi que no reaparece el rechazo "sesion expiro".
        idToken = await bridge.getIdToken(false);
      }
    } catch (tokenError) {
      idToken = null;
    }
    return idToken;
  }

  async function uploadToAppsScript(payload) {
    var integrations = getIntegrations();
    var endpoint = normalizeText(integrations.googleAppsScriptUrl);

    if (!isValidAppsScriptUrl(endpoint)) {
      throw new Error(
        "La URL del Google Apps Script aun no esta configurada o no cumple la politica segura del proyecto."
      );
    }

    // Seguridad: el Apps Script exige un idToken de Firebase Auth para verificar
    // que quien entrega es un usuario autenticado del portal. Pre-chequeo: sin
    // token el servidor rechazaria con "falta token de seguridad". Mejor no
    // gastar el intento: avisamos claro y accionable. El boton de entrega se
    // reactiva (finally del llamador), asi que el aprendiz puede reintentar
    // tras esperar o volver a iniciar sesion.
    var idToken = await getDeliveryIdToken();
    if (!idToken) {
      throw new Error(
        "No se pudo verificar tu sesion de seguridad para la entrega. Suele pasar " +
        "por congestion cuando muchos entregan al mismo tiempo. Tus respuestas estan " +
        "guardadas: espera 1-2 minutos y reintenta, o cierra sesion y vuelve a entrar " +
        "antes de subir el archivo."
      );
    }

    var finalPayload = Object.assign({}, payload, { idToken: idToken });

    var response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(finalPayload),
    });

    var data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok || data.ok === false) {
      throw new Error(
        data && data.message
          ? data.message
          : "No fue posible entregar el archivo en este momento."
      );
    }

    return data;
  }

  // Fase 10 (auditoria 2026-08-22): consulta al Apps Script si YA existe en
  // Drive un archivo que coincida con esta ficha+aprendiz+guia+actividad, sin
  // subir nada. Usada por el boton "Ya subi el archivo -- verificar entrega"
  // que se ofrece junto al respaldo manual. Nunca marca una entrega como
  // registrada sin que el servidor confirme el archivo real.
  async function verifyManualDelivery(payload) {
    var integrations = getIntegrations();
    var endpoint = normalizeText(integrations.googleAppsScriptUrl);
    if (!isValidAppsScriptUrl(endpoint)) {
      throw new Error("La URL del Google Apps Script aun no esta configurada.");
    }
    var idToken = await getDeliveryIdToken();
    if (!idToken) {
      throw new Error("No se pudo verificar tu sesion. Cierra sesion y vuelve a entrar, luego intenta de nuevo.");
    }
    var response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(Object.assign({}, payload, { action: "verify", idToken: idToken })),
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.ok === false) {
      throw new Error(data && data.message ? data.message : "No fue posible verificar la entrega en este momento.");
    }
    return data; // { ok:true, found:true|false, ... }
  }

  function buildDestinationPreview(identity, context, fileName) {
    return (
      buildDestinationFolderPreview(identity, context) +
      " / " +
      buildDeliveryFileNamePreview(
        identity.fullName,
        Object.assign({}, context || {}, { ficha: identity.ficha }),
        fileName,
        identity.ficha
      )
    );
  }

  function createElement(tagName, className, textContent) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof textContent === "string") {
      element.textContent = textContent;
    }
    return element;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".btn-apps-script{background:linear-gradient(135deg,#0b7a43,#0fbf64)!important;color:#fff!important;}",
      ".btn-apps-script:hover{filter:brightness(1.03);}",
      ".shared-apps-script-modal{position:fixed;inset:0;z-index:1200;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(4,20,13,.68);backdrop-filter:blur(8px);}",
      ".shared-apps-script-modal.is-open{display:flex;}",
      ".shared-apps-script-panel{width:min(780px,100%);max-height:min(88vh,920px);overflow:auto;border-radius:24px;border:1px solid rgba(15,191,100,.16);background:#fff;box-shadow:0 30px 80px rgba(5,20,14,.28);padding:24px;}",
      ".shared-apps-script-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px;}",
      ".shared-apps-script-head h3{font:800 1.25rem/1.2 var(--font-heading,Inter,Arial,sans-serif);color:#07221a;}",
      ".shared-apps-script-head p{margin-top:6px;color:#55706a;line-height:1.5;font-size:14px;}",
      ".shared-apps-script-close{border:none;border-radius:999px;background:#eef6f0;color:#0a5c31;width:40px;height:40px;font-size:22px;cursor:pointer;flex:0 0 auto;}",
      ".shared-apps-script-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.95fr);gap:16px;}",
      ".shared-apps-script-section{display:grid;gap:12px;}",
      ".shared-apps-script-field{display:grid;gap:8px;}",
      ".shared-apps-script-field span{font-size:13px;font-weight:800;color:#17332b;letter-spacing:.02em;}",
      ".shared-apps-script-field input,.shared-apps-script-field textarea{width:100%;border:1px solid rgba(9,66,38,.14);border-radius:14px;padding:13px 14px;background:#fff;color:#10261f;font:inherit;}",
      ".shared-apps-script-field input[readonly]{background:#f5fbf7;color:#45645b;}",
      ".shared-apps-script-field input[type='file']{padding:12px;border-style:dashed;background:#fbfefc;}",
      ".shared-apps-script-meta{padding:15px 16px;border-radius:18px;background:linear-gradient(180deg,rgba(239,253,244,.96),rgba(247,252,248,.96));border:1px solid rgba(15,191,100,.16);display:grid;gap:10px;color:#17332b;line-height:1.55;}",
      ".shared-apps-script-path{padding:10px 12px;border-radius:14px;background:#082419;color:#ddf9ea;font-size:13px;line-height:1.55;word-break:break-word;}",
      ".shared-apps-script-hint{font-size:12px;color:#5d746d;line-height:1.5;}",
      ".shared-apps-script-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:4px;}",
      ".shared-apps-script-btn{border:none;border-radius:14px;min-height:50px;padding:0 18px;font:800 15px/1 var(--font-body,Inter,Arial,sans-serif);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}",
      ".shared-apps-script-btn.primary{background:linear-gradient(135deg,#0b7a43,#0fbf64);color:#fff;}",
      ".shared-apps-script-btn.secondary{background:#172554;color:#fff;}",
      ".shared-apps-script-btn:disabled{opacity:.65;cursor:not-allowed;transform:none;}",
      ".shared-apps-script-status{padding:12px 14px;border-radius:14px;border:1px solid #dbe5f0;background:#f8fbff;color:#4e6572;font-size:14px;line-height:1.5;}",
      ".shared-apps-script-status.is-loading{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}",
      ".shared-apps-script-status.is-success{background:#edfdf3;border-color:#b7e4c7;color:#0f5132;}",
      ".shared-apps-script-status.is-error{background:#fef2f2;border-color:#fecaca;color:#b42318;}",
      ".shared-apps-script-status.is-warning{background:#fffbeb;border-color:#fde68a;color:#92400e;}",
      ".shared-apps-script-result{font-size:13px;font-weight:700;color:#145fcb;}",
      ".shared-apps-script-fallback{margin-top:12px;padding:14px 16px;border-radius:14px;border:1px solid #fde68a;background:#fffbeb;color:#7c4a03;line-height:1.55;display:grid;gap:8px;font-size:14px;}",
      ".shared-apps-script-fallback .saf-title{font-weight:800;}",
      ".shared-apps-script-fallback .saf-open{display:inline-block;font-weight:800;color:#1d4ed8;text-decoration:underline;}",
      ".shared-apps-script-fallback code{background:#fff;border:1px solid #fde68a;border-radius:8px;padding:3px 7px;font-weight:700;color:#7c2d12;word-break:break-all;}",
      ".shared-apps-script-fallback .saf-copy{margin-left:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:4px 10px;cursor:pointer;font:inherit;}",
      ".shared-apps-script-fallback .saf-hint{font-size:12px;color:#92671a;}",
      "@media (max-width: 760px){.shared-apps-script-modal{padding:14px;align-items:flex-end;}.shared-apps-script-panel{max-height:90vh;border-radius:24px 24px 18px 18px;padding:18px;}.shared-apps-script-grid{grid-template-columns:1fr;}.shared-apps-script-actions{flex-direction:column;}.shared-apps-script-btn{width:100%;}}",
    ].join("");
    document.head.appendChild(style);
  }

  function setStatus(statusNode, message, type) {
    if (!statusNode) {
      return;
    }
    statusNode.className = "shared-apps-script-status" + (type ? " is-" + type : "");
    statusNode.textContent = message;
  }

  function ensureModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) {
      return modal;
    }

    ensureStyles();

    modal = createElement("div", "shared-apps-script-modal");
    modal.id = MODAL_ID;
    modal.setAttribute("aria-hidden", "true");

    var panel = createElement("div", "shared-apps-script-panel");
    var head = createElement("div", "shared-apps-script-head");
    var headCopy = document.createElement("div");
    var title = createElement("h3", "", "Entrega segura de actividad");
    title.setAttribute("data-shared-apps-title", "");
    var subtitle = createElement(
      "p",
      "",
      "Sube el archivo al destino correcto por ficha usando el formulario propio del proyecto."
    );
    subtitle.setAttribute("data-shared-apps-subtitle", "");
    headCopy.appendChild(title);
    headCopy.appendChild(subtitle);

    var closeButton = createElement("button", "shared-apps-script-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Cerrar");

    head.appendChild(headCopy);
    head.appendChild(closeButton);

    var grid = createElement("div", "shared-apps-script-grid");
    var left = createElement("div", "shared-apps-script-section");
    var right = createElement("div", "shared-apps-script-section");

    var nameField = createElement("label", "shared-apps-script-field");
    var nameLabel = createElement("span", "", "Nombre completo");
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.setAttribute("data-shared-apps-name", "");
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);

    var fichaField = createElement("label", "shared-apps-script-field");
    var fichaLabel = createElement("span", "", "Número de ficha");
    var fichaInput = document.createElement("input");
    fichaInput.type = "text";
    fichaInput.inputMode = "numeric";
    fichaInput.setAttribute("data-shared-apps-ficha", "");
    fichaField.appendChild(fichaLabel);
    fichaField.appendChild(fichaInput);

    var fileField = createElement("label", "shared-apps-script-field");
    var fileLabel = createElement("span", "", "Archivo de entrega");
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.setAttribute("data-shared-apps-file", "");
    var fileName = createElement(
      "div",
      "shared-apps-script-hint",
      "Aun no has seleccionado archivo."
    );
    fileName.setAttribute("data-shared-apps-file-name", "");
    fileField.appendChild(fileLabel);
    fileField.appendChild(fileInput);
    fileField.appendChild(fileName);

    var identityHint = createElement("div", "shared-apps-script-hint");
    identityHint.setAttribute("data-shared-apps-identity-hint", "");

    left.appendChild(nameField);
    left.appendChild(fichaField);
    left.appendChild(fileField);
    left.appendChild(identityHint);

    var meta = createElement("div", "shared-apps-script-meta");
    meta.setAttribute("data-shared-apps-meta", "");
    var path = createElement("div", "shared-apps-script-path");
    path.setAttribute("data-shared-apps-path", "");
    right.appendChild(meta);
    right.appendChild(path);

    grid.appendChild(left);
    grid.appendChild(right);

    var status = createElement(
      "div",
      "shared-apps-script-status",
      "Completa los datos y selecciona el archivo para entregar."
    );
    status.setAttribute("data-shared-apps-status", "");

    var actions = createElement("div", "shared-apps-script-actions");
    var cancel = createElement("button", "shared-apps-script-btn secondary", "Cancelar");
    cancel.type = "button";
    cancel.setAttribute("data-shared-apps-cancel", "");
    var submit = createElement(
      "button",
      "shared-apps-script-btn primary",
      "Enviar al Drive de la ficha"
    );
    submit.type = "button";
    submit.setAttribute("data-shared-apps-submit", "");
    actions.appendChild(cancel);
    actions.appendChild(submit);

    var resultLink = createElement(
      "a",
      "shared-apps-script-result",
      "Abrir archivo registrado en Drive"
    );
    resultLink.href = "#";
    resultLink.hidden = true;
    resultLink.target = "_blank";
    resultLink.rel = "noopener noreferrer";
    resultLink.setAttribute("data-shared-apps-result", "");

    var fallback = createElement("div", "shared-apps-script-fallback");
    fallback.setAttribute("data-shared-apps-fallback", "");
    fallback.hidden = true;

    panel.appendChild(head);
    panel.appendChild(grid);
    panel.appendChild(status);
    panel.appendChild(actions);
    panel.appendChild(resultLink);
    panel.appendChild(fallback);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.removeProperty("overflow");
    }

    closeButton.addEventListener("click", closeModal);
    cancel.addEventListener("click", closeModal);
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeModal();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });

    nameInput.addEventListener("input", updateModalSummary);
    fichaInput.addEventListener("input", updateModalSummary);
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileName.textContent = file ? file.name : "Aun no has seleccionado archivo.";
      updateModalSummary();
    });
    submit.addEventListener("click", handleModalSubmit);

    return modal;
  }

  function getModalNodes() {
    var modal = ensureModal();
    return {
      modal: modal,
      title: modal.querySelector("[data-shared-apps-title]"),
      subtitle: modal.querySelector("[data-shared-apps-subtitle]"),
      nameInput: modal.querySelector("[data-shared-apps-name]"),
      fichaInput: modal.querySelector("[data-shared-apps-ficha]"),
      fileInput: modal.querySelector("[data-shared-apps-file]"),
      fileName: modal.querySelector("[data-shared-apps-file-name]"),
      identityHint: modal.querySelector("[data-shared-apps-identity-hint]"),
      meta: modal.querySelector("[data-shared-apps-meta]"),
      path: modal.querySelector("[data-shared-apps-path]"),
      status: modal.querySelector("[data-shared-apps-status]"),
      submit: modal.querySelector("[data-shared-apps-submit]"),
      resultLink: modal.querySelector("[data-shared-apps-result]"),
      fallback: modal.querySelector("[data-shared-apps-fallback]"),
    };
  }

  function updateModalSummary() {
    if (!currentContext) {
      return;
    }

    var nodes = getModalNodes();
    var auth = getPortalAuth();
    var identity = getCurrentIdentity();
    var session = identity.session;
    var usingStudentSession = session && session.role === "student";
    var fullName = usingStudentSession
      ? identity.fullName
      : normalizeText(nodes.nameInput && nodes.nameInput.value);
    var ficha = usingStudentSession
      ? identity.ficha
      : normalizeText(nodes.fichaInput && nodes.fichaInput.value);
    var file = nodes.fileInput && nodes.fileInput.files ? nodes.fileInput.files[0] : null;
    var previewName = buildDeliveryFileNamePreview(
      fullName || "Aprendiz",
      Object.assign({}, currentContext || {}, { ficha: ficha }),
      (file && file.name) || ".ext",
      ficha
    );
    var route = fullName && ficha
      ? buildDestinationPreview(
          { fullName: fullName, ficha: ficha },
          currentContext,
          (file && file.name) || ".ext"
        )
      : "Completa nombre y ficha para generar el nombre final del archivo.";

    if (nodes.path) {
      nodes.path.textContent = route;
    }

    if (nodes.meta) {
      nodes.meta.innerHTML =
        "<strong>Guia:</strong> " +
        escapeHtml(currentContext.guideLabel) +
        "<br><strong>Actividad:</strong> " +
        escapeHtml(currentContext.activityLabel) +
        "<br><strong>Grupo:</strong> " +
        escapeHtml(identity.grupo || "Sin grupo") +
        "<br><strong>Institucion:</strong> " +
        escapeHtml(identity.institucion || "Sin institucion");
    }

    if (nodes.identityHint) {
      if (usingStudentSession) {
        nodes.identityHint.textContent =
          "La entrega toma el nombre y la ficha de la sesion activa del aprendiz para evitar suplantaciones.";
      } else if (auth && typeof auth.isAdminSession === "function" && auth.isAdminSession()) {
        nodes.identityHint.textContent =
          "Estas en modo administrador. Para una prueba local controlada, completa nombre y ficha manualmente.";
      } else {
        nodes.identityHint.textContent =
          "Si no has iniciado sesion como aprendiz, completa manualmente nombre y ficha antes de enviar.";
      }
    }

    if (nodes.resultLink) {
      nodes.resultLink.hidden = true;
      nodes.resultLink.removeAttribute("href");
    }

    if (!isValidAppsScriptUrl(getIntegrations().googleAppsScriptUrl)) {
      setStatus(
        nodes.status,
        "La integracion segura ya esta visible, pero aun falta configurar la URL del Web App de Google Apps Script en js/project_integrations.js.",
        "warning"
      );
      return;
    }

    setStatus(
      nodes.status,
      "Archivo final previsto: " + previewName + (fullName && ficha ? " | Destino: " + route : ""),
      fullName && ficha ? "" : "warning"
    );
  }

  function openDeliveryModal(context) {
    currentContext = Object.assign(
      {
        guideLabel: getGuideLabelFromDocument(),
        activityNumber: "",
        activityTitle: "",
        activityLabel: "Actividad",
      },
      context || {}
    );

    currentContext.guideLabel = sanitizeLabel(currentContext.guideLabel, getGuideLabelFromDocument());
    currentContext.activityLabel = sanitizeLabel(
      currentContext.activityLabel || currentContext.activityNumber,
      "Actividad"
    );
    currentContext.allowedExtensions = getAllowedExtensions(currentContext);
    currentContext.fileNamePrefix = getFileNamePrefix(currentContext);
    currentContext.learnerNameMode = getLearnerNameMode(currentContext);

    var nodes = getModalNodes();
    var identity = getCurrentIdentity();
    var session = identity.session;
    var usingStudentSession = session && session.role === "student";

    nodes.title.textContent = "Entrega segura - " + currentContext.activityLabel;
    nodes.subtitle.textContent =
      "Se enviara el archivo a la carpeta correspondiente de la ficha usando el formulario propio del proyecto.";
    nodes.nameInput.value = identity.fullName || "";
    nodes.fichaInput.value = identity.ficha || "";
    nodes.nameInput.readOnly = !!usingStudentSession;
    nodes.fichaInput.readOnly = !!usingStudentSession;
    nodes.fileInput.value = "";
    nodes.fileInput.accept = getAcceptedFileTypes(currentContext);
    nodes.fileName.textContent = "Aun no has seleccionado archivo.";
    nodes.submit.removeAttribute("disabled");
    updateModalSummary();

    nodes.modal.classList.add("is-open");
    nodes.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  async function handleModalSubmit() {
    if (!currentContext) {
      return;
    }

    var nodes = getModalNodes();
    var identity = getCurrentIdentity();
    var session = identity.session;
    var usingStudentSession = session && session.role === "student";
    var fullName = usingStudentSession ? identity.fullName : normalizeText(nodes.nameInput.value);
    var ficha = usingStudentSession ? identity.ficha : normalizeText(nodes.fichaInput.value);
    var file = nodes.fileInput.files && nodes.fileInput.files[0];

    if (!fullName || !ficha) {
      setStatus(nodes.status, "Completa nombre completo y numero de ficha.", "error");
      return;
    }

    try {
      validateFile(file, currentContext);
    } catch (error) {
      setStatus(nodes.status, error.message, "error");
      return;
    }

    nodes.submit.setAttribute("disabled", "disabled");
    if (nodes.fallback) { nodes.fallback.hidden = true; nodes.fallback.innerHTML = ""; }
    setStatus(nodes.status, "Subiendo archivo a la carpeta correspondiente de Drive...", "loading");

    try {
      var fileBase64 = await readFileAsBase64(file);
      var stdCtx = resolveGuideStandardContext(currentContext) || {};
      var guideNumber = currentContext.guideNumber || stdCtx.guideNumber || "";
      var shortName =
        currentContext.shortName ||
        currentContext.activityShortName ||
        stdCtx.shortName ||
        currentContext.activityTitle ||
        currentContext.activityLabel ||
        "";
      var payload = {
        guideLabel: currentContext.guideLabel,
        activityLabel: currentContext.activityLabel,
        activityNumber: currentContext.activityNumber || "",
        activityTitle: currentContext.activityTitle || "",
        guideNumber: guideNumber,
        shortName: shortName,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: fileBase64,
        fullName: fullName,
        ficha: ficha,
        grupo: identity.grupo,
        institucion: identity.institucion,
        pageFile: identity.pageFile,
        allowedExtensions: currentContext.allowedExtensions,
        fileNamePrefix: currentContext.fileNamePrefix || "",
        learnerNameMode: currentContext.learnerNameMode || "firstToken",
        submittedAt: new Date().toISOString(),
      };

      var standardName = buildStandardFileName(fullName, currentContext, file.name, ficha);
      // Contexto serializable para finalizar la entrega (en sesion o headless
      // desde la cola). Fija pageFile para que el registro se guarde con la llave
      // de la pagina original aunque el reintento corra en otra pagina.
      var deliveryCtx = {
        context: Object.assign({}, currentContext, { pageFile: identity.pageFile }),
        guideLabel: currentContext.guideLabel,
        activityNumber: currentContext.activityNumber || "",
        activityTitle: currentContext.activityTitle || "",
        activityLabel: currentContext.activityLabel || "Actividad",
        panelKey: currentContext.panelKey || "",
        guideNumber: guideNumber,
        shortName: shortName,
        fullName: fullName,
        ficha: ficha,
        fileName: file.name || "",
        pageFile: identity.pageFile,
        grupo: identity.grupo,
        institucion: identity.institucion,
        submittedAt: payload.submittedAt,
        standardName: standardName,
      };

      var response = await retryWithBackoff(
        function () { return uploadToAppsScript(payload); },
        {
          isPermanent: isPermanentDeliveryError,
          onRetry: function (nextAttempt) {
            setStatus(
              nodes.status,
              "El servicio esta congestionado o tu sesion no estaba lista. " +
                "Reintentando la entrega automaticamente (intento " + nextAttempt + ")... " +
                "no cierres esta ventana.",
              "loading"
            );
          },
        }
      );
      finalizeDelivery(deliveryCtx, response, nodes);
    } catch (error) {
      var canQueue =
        !isPermanentDeliveryError(error) &&
        typeof payload !== "undefined" &&
        typeof deliveryCtx !== "undefined" &&
        deliveryIdbAvailable();
      if (canQueue) {
        // Transitorio y agotados los reintentos en sesion -> a la cola durable.
        try { await enqueueDelivery(payload, deliveryCtx); } catch (_) {}
        setStatus(
          nodes.status,
          "No se pudo entregar ahora (servicio congestionado). Tu entrega quedo EN COLA y se " +
            "enviara automaticamente cuando el servicio responda; no necesitas volver a subirla. " +
            "Puedes seguir trabajando o cerrar esta ventana.",
          "loading"
        );
      } else {
        setStatus(
          nodes.status,
          error && error.message
            ? error.message
            : "No fue posible completar la entrega segura.",
          "error"
        );
      }
      // Respaldo manual (cualquier fallo): abrir carpeta de Drive + nombre exacto,
      // y ofrecer verificar la entrega manual sin volver a subir nada (Fase 10).
      if (typeof deliveryCtx !== "undefined" && deliveryCtx) {
        renderManualDriveFallback(nodes.fallback, {
          ficha: ficha,
          suggestedName: deliveryCtx.standardName,
          queued: canQueue,
          verifyPayload: {
            ficha: deliveryCtx.ficha,
            fullName: deliveryCtx.fullName,
            guideLabel: deliveryCtx.guideLabel,
            activityLabel: deliveryCtx.activityLabel,
            activityNumber: deliveryCtx.activityNumber,
            guideNumber: deliveryCtx.guideNumber,
            shortName: deliveryCtx.shortName,
          },
          onVerified: function (result) {
            var verifiedCtx = Object.assign({}, deliveryCtx, { method: "manual-verified" });
            finalizeDelivery(verifiedCtx, result, nodes);
          },
        });
      }
    } finally {
      nodes.submit.removeAttribute("disabled");
    }
  }

  function createSecureButton(context) {
    var button = createElement("button", "btn-drive btn-apps-script", "📁 Entregar a Drive");
    button.type = "button";
    button.setAttribute("data-apps-script-trigger", "true");
    button.addEventListener("click", function () {
      openDeliveryModal(context);
    });
    return button;
  }

  function injectButtonsIntoExistingGroups(root) {
    var scope = root || document;
    Array.from(scope.querySelectorAll(".drive-action-group")).forEach(function (group) {
      if (group.querySelector("[data-apps-script-trigger]")) {
        return;
      }

      if (!group.querySelector(".btn-drive") || !group.querySelector(".btn-qr")) {
        return;
      }

      var context = getActivityContextFromNode(group);
      group.appendChild(createSecureButton(context));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    injectButtonsIntoExistingGroups(document);
    if (deliveryIdbAvailable()) {
      // Reintenta entregas en cola (Capa 2b): al cargar y luego periodicamente.
      // uploadToAppsScript ya espera la hidratacion de la sesion/token.
      setTimeout(runDeliveryQueue, 6000);
      setInterval(runDeliveryQueue, 60000);
      try { window.addEventListener("online", runDeliveryQueue); } catch (_) {}
    }
  });

  window.sharedAppsScriptDelivery = {
    buildDeliveryFileNamePreview: buildDeliveryFileNamePreview,
    buildDestinationFolderPreview: buildDestinationFolderPreview,
    buildDestinationPreview: buildDestinationPreview,
    getActivityContextFromNode: getActivityContextFromNode,
    injectButtonsIntoExistingGroups: injectButtonsIntoExistingGroups,
    isValidAppsScriptUrl: isValidAppsScriptUrl,
    loadDeliveryRecord: loadDeliveryRecord,
    notifyDeliveryRegistered: notifyDeliveryRegistered,
    openDeliveryModal: openDeliveryModal,
    readFileAsBase64: readFileAsBase64,
    saveDeliveryRecord: saveDeliveryRecord,
    uploadToAppsScript: uploadToAppsScript,
    validateFile: validateFile,
    getDriveFolderUrlForFicha: getDriveFolderUrlForFicha,
    renderManualDriveFallback: renderManualDriveFallback,
    offerManualDriveFallback: offerManualDriveFallback,
    verifyManualDelivery: verifyManualDelivery,
    // Expuestos solo para pruebas unitarias (logica pura).
    _retryWithBackoff: retryWithBackoff,
    _isPermanentDeliveryError: isPermanentDeliveryError,
    _processDeliveryQueue: processDeliveryQueue,
    _buildDeliveryRecord: buildDeliveryRecord,
    _finalizeDelivery: finalizeDelivery,
    _getCurrentIdentity: getCurrentIdentity,
    _enqueueDelivery: enqueueDelivery,
  };
})();
