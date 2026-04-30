(function () {
  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  if (!auth) {
    return;
  }

  let allUsers = [];
  let guide2WordSearchSummaries = {};
  let guide2MatchingGameSummaries = {};
  let fichaCasoSummaries = {};
  let matriz322Summaries = {};
  let redesSocializacionSummaries = {};
  let redesQuizSummaries = {};
  let activeActivitiesSubtab = null;
  let currentResponsesExport = null;

  const REDES_SB_CLOUD_FILES = {
    "3441944": "sb_10a_redes.html",
    "3441950": "sb_10b_redes.html",
  };
  const REDES_SB_GUIDE_FILES = {
    "santa-barbara-10a-guia-02-redes-rap01.html": "sb_10a_redes.html",
    "santa-barbara-10b-guia-02-redes-rap01.html": "sb_10b_redes.html",
  };
  const REDES_SB_GUIDE_FILES_BY_FICHA = {
    "3441944": "santa-barbara-10a-guia-02-redes-rap01.html",
    "3441950": "santa-barbara-10b-guia-02-redes-rap01.html",
  };
  const REDES_SB_LOCK_KEYS = [
    "reflexion-socializacion-locked",
    "reflexion-311-locked",
    "bloqueA-locked",
    "bloqueB-locked",
    "bloqueC-locked",
    "bloqueD-locked",
    "bloqueE-locked",
    "ip1-locked",
    "ip2-locked",
    "ip3-locked",
    "taller-ip-ej1-locked",
    "taller-ip-ej2-locked",
    "taller-ip-ej3-locked",
    "taller-ip-ej4-locked",
    "taller-ip-ej5-locked",
    "lab1-locked",
    "lab2-locked",
    "lab3-locked",
    "social-locked",
  ];
  const REDES_ADMIN_QUIZ_CONFIGS = Array.isArray(window.redesQuizUnlock?.REDES_ADMIN_QUIZ_CONFIGS)
    ? window.redesQuizUnlock.REDES_ADMIN_QUIZ_CONFIGS.map((config) => ({
        key: String(config?.key || "").trim(),
        label: String(config?.label || "Quiz de redes").trim(),
      })).filter((config) => config.key)
    : [
        { key: "quiz-redes-321h", label: "Quiz 3.2.1.H" },
        { key: "quiz-redes-33h", label: "Quiz IP" },
      ];
  const REDES_LAB_ACTIVITIES = [
    { id: "lab1", label: "Laboratorio 1 - Topologia estrella", keys: ["lab1-locked"] },
    { id: "lab2", label: "Laboratorio 2 - Topologia arbol", keys: ["lab2-locked"] },
    { id: "lab3", label: "Laboratorio 3 - Red hibrida", keys: ["lab3-locked"] },
  ];

  const FICHA_CASO_FILES = {
    "10A": "grupo-10a-guia-02-ficha-caso.html",
    "10B": "grupo-10b-guia-02-ficha-caso.html",
  };

  const GUIDE2_RESPONSE_FILES = {
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": {
      cloudFileName: "10a_guia2.html",
    },
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": {
      cloudFileName: "10b_guia2.html",
    },
  };
  const GUIDE2_EXTENSION_IDS = [
    "doc",
    "xlsx",
    "accdb",
    "mpp",
    "ppt",
    "pub",
    "cda",
    "ogv",
    "tar",
    "exe",
    "pdf",
    "rar",
    "wma",
    "vssm",
    "txt",
    "sys",
    "png",
    "html",
  ];
  const GUIDE2_EXTENSION_ACTIVITY_KEYS = [
    ...GUIDE2_EXTENSION_IDS.flatMap((id) => [`extension:${id}:program`, `extension:${id}:description`]),
    "extensions-category-summary",
    "extensions-category-why",
    "extensions-risk-list",
    "extensions-real-files",
    "extensiones331-locked",
  ];
  const GUIDE2_SYSTEM_IDS = [
    "linux-lite",
    "arcaos",
    "windows-10",
    "ubuntu",
    "macos-mojave",
    "windows-11",
    "chromium-os",
    "mac-os-x-leopard",
  ];
  const GUIDE2_SYSTEM_NAMES = {
    "linux-lite": "Linux Lite",
    arcaos: "ArcaOS",
    "windows-10": "Windows 10",
    ubuntu: "Ubuntu",
    "macos-mojave": "macOS Mojave",
    "windows-11": "Windows 11",
    "chromium-os": "Chromium OS",
    "mac-os-x-leopard": "Mac OS X Leopard",
  };
  const GUIDE2_SYSTEM_ACTIVITY_KEYS = [
    ...GUIDE2_SYSTEM_IDS.flatMap((id) => [
      `system:${id}:processor`,
      `system:${id}:ram`,
      `system:${id}:disk`,
      `system:${id}:source`,
    ]),
    "systems-lowest",
    "systems-highest",
    "systems-recommendation",
    "systems-peer-feedback",
    "sistemas332-locked",
  ];
  const GUIDE2_TRANSFER_RETO_KEYS = [
    "transfer-reto-uso",
    "transfer-reto-guia",
    "transfer-reto-locked",
  ];
  const GUIDE2_COLLABORATIVE_TOOLS = [
    { id: "microsoft-365", label: "Microsoft 365 (Teams, SharePoint, OneDrive)" },
    { id: "google-workspace", label: "Google Workspace (Meet, Drive, Docs)" },
    { id: "zoom", label: "Zoom" },
    { id: "wetransfer", label: "WeTransfer" },
    { id: "canva", label: "Canva" },
  ];
  const GUIDE2_COLLABORATIVE_ACTIVITY_KEYS = [
    ...GUIDE2_COLLABORATIVE_TOOLS.flatMap((tool) => [
      `collab:${tool.id}:function`,
      `collab:${tool.id}:advantage`,
      `collab:${tool.id}:limit`,
      `collab:${tool.id}:license`,
    ]),
    "colaborativas334-locked",
  ];
  const GUIDE2_RESPONSE_KEYS = [
    "wordSearch:guia2-sopa",
    "matchingGame:guia2-relaciona",
    ...GUIDE2_EXTENSION_ACTIVITY_KEYS,
    ...GUIDE2_SYSTEM_ACTIVITY_KEYS,
    ...GUIDE2_COLLABORATIVE_ACTIVITY_KEYS,
    ...GUIDE2_TRANSFER_RETO_KEYS,
  ];

  const GUIDE6_FILES = {
    "grupo-11a-guia-06-planificar-informacion.html": {
      stateKey: "guia_interactiva_11a_guia6_html",
      cloudFileName: "11a_guia6.html",
    },
    "grupo-11b-guia-06-planificar-informacion.html": {
      stateKey: "guia_interactiva_11b_guia6_html",
      cloudFileName: "11b_guia6.html",
    },
  };

  const GUIDE6_INSTALL_IDS = ["suite", "browser", "email", "zip", "antivirus", "diagnostic"];
  const GUIDE6_DIAG_IDS = ["hardware", "so", "disk", "software", "network"];
  const GUIDE6_BUDGET_IDS = ["suite", "diagnostic", "security", "cloud", "backup"];

  const GUIDE6_ACTIVITIES = [
    { id: "bitacora311", label: "Bitácora 3.1.1", keys: ["reflexion_herramientas", "reflexion_registro", "reflexion_consecuencias", "reflexion_experiencia", "bitacora311-locked"] },
    { id: "socializacion312", label: "Socialización 3.1.2", keys: ["socializacion_conclusion", "socializacion_pregunta_central", "socializacion312-locked"] },
    { id: "quiz312", label: "Quiz herramientas 3.1.2", keys: ["quiz-guia6-312"] },
    { id: "contexto321", label: "Apuntes 3.2.1", keys: ["ctx_apuntes"] },
    { id: "mapa322", label: "Mapa conceptual 3.2.2", keys: ["map_central", "map_ramas"] },
    {
      id: "instalacion331", label: "Checklist instalación 3.3.1",
      keys: GUIDE6_INSTALL_IDS.flatMap((id) => [`inst_source_${id}`, `inst_version_${id}`, `inst_verify_${id}`, `inst_done_${id}`, `inst_notes_${id}`]),
    },
    {
      id: "diagnostico331", label: "Diagnóstico 3.3.1",
      keys: [...GUIDE6_DIAG_IDS.flatMap((id) => [`diag_result_${id}`, `diag_action_${id}`]), "diag_conclusion"],
    },
    {
      id: "presupuesto341", label: "Presupuesto 3.4.1",
      keys: [...GUIDE6_BUDGET_IDS.flatMap((id) => [`budget_license_${id}`, `budget_price_${id}`, `budget_qty_${id}`, `budget_why_${id}`]), "budget_conclusion"],
    },
  ];

  const GUIDE2_ACTIVITIES = [
    { id: "wordsearch", label: "Sopa de letras", keys: ["wordSearch:guia2-sopa"] },
    { id: "matching", label: "Relaciona herramientas", keys: ["matchingGame:guia2-relaciona"] },
    { id: "extensiones331", label: "Actividad 5 - Extensiones de archivo", keys: GUIDE2_EXTENSION_ACTIVITY_KEYS },
    { id: "sistemas332", label: "Actividad 6 - Requerimientos minimos", keys: GUIDE2_SYSTEM_ACTIVITY_KEYS },
    { id: "colaborativas334", label: "Actividad 8 - Herramientas colaborativas", keys: GUIDE2_COLLABORATIVE_ACTIVITY_KEYS },
    { id: "transferReto341", label: "Actividad 10 - Reto final", keys: GUIDE2_TRANSFER_RETO_KEYS },
  ];

  function getById(id) {
    return document.getElementById(id);
  }

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

  function escapeWordText(value) {
    return escapeHtml(value);
  }

  function sanitizeFileName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 90);
  }

  function getSenaLogoUrl() {
    try {
      return new URL("assets/img/sena-logo.png", window.location.href).href;
    } catch {
      return "assets/img/sena-logo.png";
    }
  }

  const ADMIN_WORD_METADATA = {
    default: {
      guideName: "Consulta administrativa de respuestas",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado: "Evidencia administrativa de respuestas registradas por el aprendiz.",
    },
    guia2: {
      guideName: "Guia 2 - Operar Herramientas Informaticas y Digitales",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado: "RAP 01 - Caracterizar herramientas informaticas segun el contexto tecnologico de la organizacion.",
    },
    guia6: {
      guideName: "Guia 6 - Planificar la informacion",
      program: "Sistemas Teleinformaticos",
      competencia:
        "220501121 - Operar herramientas informaticas y digitales de acuerdo con protocolos y manuales tecnicos.",
      resultado: "RAP 02 - Implementar componentes de las herramientas tecnologicas segun procedimientos de la organizacion.",
    },
    redes: {
      guideName: "Guia 2 - Redes RAP01",
      program: "Sistemas Teleinformaticos",
      competencia:
        "280102129 - Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa tecnica.",
      resultado: "RAP 01 - Definir los parametros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
    },
  };

  function getAdminWordMetadata(title, subtitle) {
    const source = `${title || ""} ${subtitle || ""}`.toLowerCase();
    if (source.includes("redes") || source.includes("santa barbara")) return ADMIN_WORD_METADATA.redes;
    if (source.includes("guia 6") || source.includes("guía 6")) return ADMIN_WORD_METADATA.guia6;
    if (source.includes("guia 2") || source.includes("guía 2") || source.includes("ficha de caso") || source.includes("matriz 3.2.2")) {
      return ADMIN_WORD_METADATA.guia2;
    }
    return ADMIN_WORD_METADATA.default;
  }

  function readMetaField(meta, label) {
    const escapedLabel = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = String(meta || "").match(new RegExp(`${escapedLabel}:\\s*([^|]+)`, "i"));
    return match ? match[1].trim() : "";
  }

  function buildAdminResponsesWordStyles() {
    return `
      @page { size: 8.5in 11in; margin: 2.54cm; }
      body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 2; color: #111827; }
      .word-logo-line { display: flex; align-items: center; gap: 8pt; margin: 0 0 8pt; color: #0b6b2b; font-weight: bold; }
      .institutional-header, .answer-card table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0 0 14pt; }
      .institutional-header td, .answer-card th, .answer-card td { border: 1px solid #b7c7bc; padding: 6pt; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
      .institutional-header .label, .answer-card th { background: #f1f5f9; color: #0b5d28; font-weight: bold; }
      h1 { font-size: 16pt; color: #14532d; margin: 18pt 0 8pt; line-height: 1.35; }
      h2 { font-size: 14pt; color: #14532d; margin: 16pt 0 8pt; line-height: 1.35; }
      h3 { font-size: 12pt; color: #111827; margin: 12pt 0 6pt; line-height: 1.35; }
      .answer-card { page-break-inside: avoid; margin: 0 0 14pt; }
      .response-status { border: 1px solid #d1d5db; padding: 10pt; border-radius: 4pt; }
      p { margin: 0 0 10pt; }
      small { color: #4b5563; }
    `;
  }

  function buildAdminResponsesWordDocument(exportData) {
    const title = exportData?.title || "Respuestas del aprendiz";
    const subtitle = exportData?.subtitle || "";
    const meta = exportData?.meta || "";
    const bodyHtml = exportData?.bodyHtml || "";
    const metadata = getAdminWordMetadata(title, subtitle);
    const today = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const learnerName =
      readMetaField(meta, "Aprendiz") ||
      String(subtitle).split("|")[0]?.trim() ||
      "Aprendiz";
    const ficha = readMetaField(meta, "Ficha");
    const grupo = readMetaField(meta, "Grupo");
    const institucion = readMetaField(meta, "Institucion") || readMetaField(meta, "Institución");

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeWordText(title)}</title>
  <style>${buildAdminResponsesWordStyles()}</style>
</head>
<body>
  <div class="word-logo-line">
    <img src="${escapeWordText(getSenaLogoUrl())}" alt="Logo SENA" width="36" height="36" style="width:36pt;height:36pt;">
    <strong>Servicio Nacional de Aprendizaje - SENA</strong>
  </div>
  <table class="institutional-header" width="100%" align="left" style="width:100%;margin-left:0;margin-right:0;">
    <tr><td class="label">Programa</td><td>${escapeWordText(metadata.program)}</td></tr>
    <tr><td class="label">Fecha de elaboracion</td><td>${escapeWordText(today)}</td></tr>
    <tr><td class="label">Guia / actividad</td><td>${escapeWordText(`${metadata.guideName} - ${title}`)}</td></tr>
    <tr><td class="label">Competencia</td><td>${escapeWordText(metadata.competencia)}</td></tr>
    <tr><td class="label">Resultado de Aprendizaje</td><td>${escapeWordText(metadata.resultado)}</td></tr>
    <tr><td class="label">Nombre completo del aprendiz</td><td>${escapeWordText(learnerName)}</td></tr>
    <tr><td class="label">Numero de ficha</td><td>${escapeWordText(ficha)}</td></tr>
    <tr><td class="label">Grado</td><td>${escapeWordText(grupo)}</td></tr>
    <tr><td class="label">Institucion</td><td>${escapeWordText(institucion)}</td></tr>
  </table>
  <h1>${escapeWordText(title)}</h1>
  <p><strong>${escapeWordText(subtitle)}</strong></p>
  <p>${escapeWordText(meta)}</p>
  ${bodyHtml}
</body>
</html>`;
  }

  function exportCurrentResponsesToWord() {
    if (!currentResponsesExport?.bodyHtml) {
      setFeedback("No hay respuestas visibles para exportar.", "error");
      return;
    }
    const html = buildAdminResponsesWordDocument(currentResponsesExport);
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const safeLearner = sanitizeFileName(readMetaField(currentResponsesExport.meta, "Aprendiz") || "Aprendiz");
    const safeTitle = sanitizeFileName(currentResponsesExport.title || "Respuestas");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}_${safeLearner}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  function formatDurationMs(value) {
    const totalSeconds = Math.max(0, Math.floor((Number(value) || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const two = (number) => String(number).padStart(2, "0");
    return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
  }

  function readJson(value, fallback) {
    if (!value) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function hasMeaningfulValue(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value);
    }
    return String(value ?? "").trim().length > 0;
  }

  function hasGuide2Responses(state) {
    return GUIDE2_RESPONSE_KEYS.some((key) => hasMeaningfulValue(state?.[key]));
  }

  function getGuide2ResponseConfig(fileName) {
    const config = GUIDE2_RESPONSE_FILES[fileName];
    if (!config) {
      return null;
    }

    return {
      ...config,
      localStateKey: auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey || "",
      title: auth.getGuideTitle(fileName),
    };
  }

  function getGuide2ActivitiesForFile(fileName) {
    return getGuide2ResponseConfig(fileName) ? GUIDE2_ACTIVITIES : [];
  }

  function getUnlockActivitiesForGuide(fileName) {
    const guide2Activities = getGuide2ActivitiesForFile(fileName);
    if (guide2Activities.length) return guide2Activities;
    if (getGuide6Config(fileName)) return GUIDE6_ACTIVITIES;
    return [];
  }

  function getGuide2ScopeKey(usernameKey) {
    return `student:${String(usernameKey || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")}`;
  }

  function snapshotTime(snapshot) {
    const parsed = Date.parse(snapshot?.updatedAt || snapshot?.importedAt || snapshot?.completedAt || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function pickLatestSnapshot(cloudSnapshot, localSnapshot) {
    if (!cloudSnapshot) {
      return localSnapshot;
    }
    if (!localSnapshot) {
      return cloudSnapshot;
    }
    return snapshotTime(cloudSnapshot) >= snapshotTime(localSnapshot) ? cloudSnapshot : localSnapshot;
  }

  function readGuide2LocalSnapshot(usernameKey, guideConfig) {
    if (!guideConfig?.localStateKey) {
      return null;
    }

    const storageKey = auth.getStudentStorageKey(usernameKey, guideConfig.localStateKey, {
      area: "guide-data",
    });
    const state = readJson(localStorage.getItem(storageKey), null);
    if (!state || typeof state !== "object" || !hasGuide2Responses(state)) {
      return null;
    }

    const meta = readJson(localStorage.getItem(`${storageKey}__meta`), null);
    return {
      state,
      updatedAt: meta?.updatedAt || "",
      updatedBy: meta?.updatedBy || "",
      sourceLabel: "Copia local disponible en este navegador",
    };
  }

  async function readGuide2CloudSnapshot(usernameKey, guideConfig) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function" ||
      !guideConfig?.cloudFileName
    ) {
      return null;
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(
        getGuide2ScopeKey(usernameKey),
        guideConfig.cloudFileName
      );
      if (!snapshot?.state || !hasGuide2Responses(snapshot.state)) {
        return null;
      }

      return {
        ...snapshot,
        sourceLabel: "Sincronizacion compartida",
      };
    } catch {
      return null;
    }
  }

  async function loadGuide2Responses(usernameKey, fileName) {
    const guideConfig = getGuide2ResponseConfig(fileName);
    if (!guideConfig) {
      return {
        guideConfig: null,
        snapshot: null,
      };
    }

    const [cloudSnapshot, localSnapshot] = await Promise.all([
      readGuide2CloudSnapshot(usernameKey, guideConfig),
      Promise.resolve(readGuide2LocalSnapshot(usernameKey, guideConfig)),
    ]);

    return {
      guideConfig,
      snapshot: pickLatestSnapshot(cloudSnapshot, localSnapshot),
    };
  }

  function getGuide2SummaryKey(usernameKey, fileName) {
    return `${String(usernameKey || "").trim().toLowerCase()}::${fileName}`;
  }

  function getGuide6Config(fileName) {
    const config = GUIDE6_FILES[fileName];
    if (!config) return null;
    return { ...config, title: auth.getGuideTitle(fileName) };
  }

  function isGuide6File(fileName) {
    return Boolean(GUIDE6_FILES[fileName]);
  }

  function readGuide6LocalSnapshot(usernameKey, config) {
    if (!config?.stateKey) return null;
    const storageKey = auth.getStudentStorageKey(usernameKey, config.stateKey, { area: "guide-data" });
    const state = readJson(localStorage.getItem(storageKey), null);
    if (!state || typeof state !== "object") return null;
    const meta = readJson(localStorage.getItem(`${storageKey}__meta`), null);
    return { state, updatedAt: meta?.updatedAt || "", sourceLabel: "Copia local" };
  }

  async function readGuide6CloudSnapshot(usernameKey, config) {
    if (
      !config?.cloudFileName ||
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return null;
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(
        getGuide2ScopeKey(usernameKey),
        config.cloudFileName
      );
      const state =
        snapshot?.state && typeof snapshot.state === "object"
          ? snapshot.state
          : snapshot?.data && typeof snapshot.data === "object"
            ? snapshot.data
            : null;
      if (!state) return null;
      return {
        state,
        updatedAt: snapshot.updatedAt || snapshot.importedAt || "",
        updatedBy: snapshot.updatedBy || "",
        sourceLabel: "Sincronizacion compartida",
      };
    } catch {
      return null;
    }
  }

  async function loadGuide6Responses(usernameKey, config) {
    const [cloudSnapshot, localSnapshot] = await Promise.all([
      readGuide6CloudSnapshot(usernameKey, config),
      Promise.resolve(readGuide6LocalSnapshot(usernameKey, config)),
    ]);
    return pickLatestSnapshot(cloudSnapshot, localSnapshot);
  }

  function getGuideActivityStateKey(fileName) {
    const g6 = GUIDE6_FILES[fileName];
    if (g6) return g6.stateKey;
    return auth.GUIDE_PROGRESS_CONFIG?.[fileName]?.stateKey || "";
  }

  function getDeadlineConfigGuides(users) {
    const ficha = String(users?.[0]?.ficha || "").trim();
    if (!ficha || typeof auth.getGuidesForFicha !== "function" || !deadlineManager) {
      return [];
    }
    return auth
      .getGuidesForFicha(ficha)
      .filter((fileName) => deadlineManager.getActivitiesForGuide(fileName).length);
  }

  function buildDeadlineConfigPanel(users) {
    if (!deadlineManager || !users.length) {
      return "";
    }
    const guideFiles = getDeadlineConfigGuides(users);
    if (!guideFiles.length) {
      return "";
    }

    const guideBlocks = guideFiles
      .map((fileName) => {
        const activities = deadlineManager.getActivitiesForGuide(fileName);
        if (!activities.length) {
          return "";
        }
        const rows = activities
          .map((activity) => {
            const policy = deadlineManager.getPolicy(fileName, activity.id);
            const dueAt = String(policy?.dueAt || "").trim();
            const updatedText = dueAt
              ? `Fecha activa: ${escapeHtml(deadlineManager.formatDueAt(dueAt))}`
              : "Sin fecha de entrega configurada";
            return `
              <div class="activity-deadline-row">
                <div class="activity-deadline-label">
                  <strong>${escapeHtml(activity.label)}</strong>
                  <span>${updatedText}</span>
                </div>
                <input
                  class="activity-deadline-input"
                  type="datetime-local"
                  value="${escapeHtml(dueAt)}"
                  data-deadline-input="${escapeHtml(fileName)}::${escapeHtml(activity.id)}"
                >
                <button class="btn secondary" type="button"
                  data-save-activity-deadline="${escapeHtml(fileName)}"
                  data-activity-id="${escapeHtml(activity.id)}"
                  data-activity-label="${escapeHtml(activity.label)}">
                  Guardar fecha
                </button>
                <button class="btn ghost" type="button"
                  data-clear-activity-deadline="${escapeHtml(fileName)}"
                  data-activity-id="${escapeHtml(activity.id)}"
                  data-activity-label="${escapeHtml(activity.label)}">
                  Quitar fecha
                </button>
              </div>
            `;
          })
          .join("");

        return `
          <article class="activity-deadline-guide">
            <h3>${escapeHtml(auth.getGuideTitle(fileName))}</h3>
            <p>Si no defines fecha, esta guia sigue funcionando como ahora. Solo se cierra la actividad cuando guardes una fecha aqui.</p>
            <div class="activity-deadline-grid">${rows}</div>
          </article>
        `;
      })
      .join("");

    return `
      <section class="panel">
        <h2>Fechas opcionales de entrega</h2>
        <p class="activities-section-copy">
          Esta configuracion es opcional. Solo afecta las actividades donde asignes una fecha de cierre.
        </p>
        <div class="activity-deadline-admin">${guideBlocks}</div>
      </section>
    `;
  }

  function patchGuideState(usernameKey, stateKey, keysToDelete, options = {}) {
    if (!stateKey || typeof auth.getStudentStorageKey !== "function") return false;
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    const current = readJson(localStorage.getItem(storageKey), {});
    let changed = false;
    keysToDelete.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(current, k)) {
        changed = true;
        delete current[k];
      }
    });
    localStorage.setItem(storageKey, JSON.stringify(current));
    localStorage.setItem(
      `${storageKey}__meta`,
      JSON.stringify({
        updatedAt: options.updatedAt || new Date().toISOString(),
        updatedBy: options.updatedBy || "admin-activity-unlock",
      })
    );
    return changed;
  }

  function buildGuideSnapshotPayload(snapshot, nextState, updatedAt, updatedBy) {
    const safeSnapshot =
      snapshot && typeof snapshot === "object" ? { ...snapshot } : {};
    const safeState =
      nextState && typeof nextState === "object" ? { ...nextState } : {};

    return {
      ...safeSnapshot,
      data: safeState,
      state: safeState,
      updatedAt,
      updatedBy,
    };
  }

  async function patchGuideCloudState(usernameKey, cloudFileName, keysToDelete, options = {}) {
    if (
      !cloudFileName ||
      !window._firebaseDb?.cloudGetGuideData ||
      !window._firebaseDb?.cloudSaveGuideData
    ) {
      return false;
    }

    const scopeKey = getGuide2ScopeKey(usernameKey);
    const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName);
    const current =
      snapshot?.state && typeof snapshot.state === "object"
        ? { ...snapshot.state }
        : snapshot?.data && typeof snapshot.data === "object"
          ? { ...snapshot.data }
          : {};
    let changed = false;
    keysToDelete.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        changed = true;
        delete current[key];
      }
    });
    if (!changed) return false;

    await window._firebaseDb.cloudSaveGuideData(
      scopeKey,
      cloudFileName,
      buildGuideSnapshotPayload(
        snapshot,
        current,
        options.updatedAt || new Date().toISOString(),
        options.updatedBy || "admin-activity-unlock"
      )
    );
    return true;
  }

  function isRedesSbGuideFile(fileName) {
    return Boolean(REDES_SB_GUIDE_FILES[fileName]);
  }

  function getRedesGuideCloudFileName(fileName, ficha) {
    return REDES_SB_GUIDE_FILES[fileName] || REDES_SB_CLOUD_FILES[String(ficha || "").trim()] || "";
  }

  function getRedesGuidePageFileByFicha(ficha) {
    return REDES_SB_GUIDE_FILES_BY_FICHA[String(ficha || "").trim()] || "";
  }

  function getRedesGuideLocalStorageKey(usernameKey, fileName) {
    const cloudFileName = getRedesGuideCloudFileName(fileName, "");
    if (!cloudFileName || typeof auth.getStudentStorageKey !== "function") {
      return "";
    }
    const storageKeyBase = `guia_interactiva_${cloudFileName.replace(/[^a-z0-9]+/g, "_")}`;
    return auth.getStudentStorageKey(usernameKey, storageKeyBase, {
      area: "guide-data",
    });
  }

  function readRedesGuideLocalSnapshot(usernameKey, fileName, ficha) {
    const resolvedFileName = fileName || getRedesGuidePageFileByFicha(ficha);
    const storageKey = getRedesGuideLocalStorageKey(usernameKey, resolvedFileName);
    if (!storageKey) {
      return null;
    }

    const data = readJson(localStorage.getItem(storageKey), null);
    if (!data || typeof data !== "object") {
      return null;
    }

    const meta = readJson(localStorage.getItem(`${storageKey}__meta`), null);
    return {
      data,
      updatedAt: meta?.updatedAt || "",
      updatedBy: meta?.updatedBy || "",
      sourceLabel: "Copia local disponible en este navegador",
    };
  }

  async function readRedesGuideCloudSnapshot(usernameKey, fileName, ficha) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return null;
    }

    const cloudFileName = getRedesGuideCloudFileName(fileName, ficha);
    if (!cloudFileName) {
      return null;
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(
        getGuide2ScopeKey(usernameKey),
        cloudFileName
      );
      if (!snapshot || typeof snapshot !== "object") {
        return null;
      }

      return {
        ...snapshot,
        data:
          snapshot.data && typeof snapshot.data === "object"
            ? snapshot.data
            : snapshot.state && typeof snapshot.state === "object"
              ? snapshot.state
              : {},
        sourceLabel: "Sincronizacion compartida",
      };
    } catch {
      return null;
    }
  }

  async function loadRedesGuideSnapshot(usernameKey, fileName, ficha) {
    const [cloudSnapshot, localSnapshot] = await Promise.all([
      readRedesGuideCloudSnapshot(usernameKey, fileName, ficha),
      Promise.resolve(readRedesGuideLocalSnapshot(usernameKey, fileName, ficha)),
    ]);
    return pickLatestSnapshot(cloudSnapshot, localSnapshot);
  }

  function getRedesQuizQuestions(variant) {
    const bank = window.REDES_QUIZ_VARIANTS || {};
    return Array.isArray(bank[variant]) ? bank[variant] : [];
  }

  function extractRedesQuizSummary(snapshot, user) {
    const state =
      snapshot?.data && typeof snapshot.data === "object"
        ? snapshot.data
        : snapshot?.state && typeof snapshot.state === "object"
          ? snapshot.state
          : {};
    const attempt =
      state?.["quiz-redes-321h"] && typeof state["quiz-redes-321h"] === "object"
        ? state["quiz-redes-321h"]
        : null;
    if (!attempt) {
      return null;
    }

    return {
      user,
      variant: String(attempt.variant || "").trim(),
      startedAt: attempt.startedAt || "",
      completedAt: attempt.completedAt || "",
      submittedAt: attempt.submittedAt || attempt.completedAt || snapshot?.updatedAt || "",
      score: Number(attempt.score) || 0,
      maxScore: Number(attempt.maxScore) || 100,
      warningCount: Number(attempt.warningCount) || 0,
      status: String(attempt.status || (attempt.locked ? "completed" : "in_progress")),
      answers: attempt.answers && typeof attempt.answers === "object" ? { ...attempt.answers } : {},
      results: attempt.results && typeof attempt.results === "object" ? { ...attempt.results } : {},
      evidenceEvents: Array.isArray(attempt.evidenceEvents) ? attempt.evidenceEvents.slice() : [],
      terminatedByVisibility: Boolean(attempt.terminatedByVisibility),
      locked: Boolean(attempt.locked),
      sourceLabel: snapshot?.sourceLabel || "",
      updatedAt: attempt.submittedAt || snapshot?.updatedAt || "",
    };
  }

  function clearRedesGuideLocks(snapshotState) {
    const nextState =
      snapshotState && typeof snapshotState === "object" ? { ...snapshotState } : {};
    let changed = false;
    REDES_SB_LOCK_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextState, key)) {
        changed = true;
        delete nextState[key];
      }
    });
    return { state: nextState, changed };
  }

  function clearSelectedRedesGuideLocks(snapshotState, lockKeys) {
    if (typeof window.redesLockSync?.clearSelectedRedesGuideLocks === "function") {
      return window.redesLockSync.clearSelectedRedesGuideLocks(snapshotState, lockKeys);
    }

    const nextState =
      snapshotState && typeof snapshotState === "object" ? { ...snapshotState } : {};
    let changed = false;
    (Array.isArray(lockKeys) ? lockKeys : []).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(nextState, key)) {
        changed = true;
        delete nextState[key];
      }
    });
    return { state: nextState, changed };
  }

  function buildRedesGuideSnapshotPayload(snapshot, nextState, updatedAt, updatedBy) {
    if (typeof window.redesLockSync?.buildRedesGuideSnapshot === "function") {
      return window.redesLockSync.buildRedesGuideSnapshot(snapshot, nextState, {
        updatedAt,
        updatedBy,
      });
    }

    const safeSnapshot =
      snapshot && typeof snapshot === "object" ? { ...snapshot } : {};
    const safeState =
      nextState && typeof nextState === "object" ? { ...nextState } : {};

    return {
      ...safeSnapshot,
      data: safeState,
      state: safeState,
      updatedAt,
      updatedBy,
    };
  }

  function getRedesQuizConfig(quizKey) {
    const cleanQuizKey = String(quizKey || "").trim();
    return REDES_ADMIN_QUIZ_CONFIGS.find((config) => config.key === cleanQuizKey) || null;
  }

  function reopenRedesQuizState(snapshotState, quizKey, updatedAt) {
    if (typeof window.redesQuizUnlock?.reopenRedesQuizAttempt === "function") {
      return window.redesQuizUnlock.reopenRedesQuizAttempt(snapshotState, quizKey, updatedAt);
    }

    const nextState =
      snapshotState && typeof snapshotState === "object" ? { ...snapshotState } : {};
    const cleanQuizKey = String(quizKey || "").trim();
    const previousAttempt =
      cleanQuizKey && nextState[cleanQuizKey] && typeof nextState[cleanQuizKey] === "object"
        ? { ...nextState[cleanQuizKey] }
        : null;

    if (!previousAttempt) {
      return { state: nextState, changed: false, found: false };
    }

    const nextAttempt = {
      ...previousAttempt,
      completedAt: "",
      submittedAt: "",
      updatedAt: String(updatedAt || previousAttempt.updatedAt || "").trim(),
      score: 0,
      maxScore: Number(previousAttempt.maxScore) || 100,
      warningCount: 0,
      terminatedByVisibility: false,
      status: previousAttempt.startedAt ? "in_progress" : "ready",
      answers:
        previousAttempt.answers && typeof previousAttempt.answers === "object"
          ? { ...previousAttempt.answers }
          : {},
      results: {},
      evidenceEvents: [],
      locked: false,
    };

    nextState[cleanQuizKey] = nextAttempt;
    return {
      state: nextState,
      changed: JSON.stringify(previousAttempt) !== JSON.stringify(nextAttempt),
      found: true,
    };
  }

  function getWordSearchResult(state) {
    return state?.["wordSearch:guia2-sopa"] && typeof state["wordSearch:guia2-sopa"] === "object"
      ? state["wordSearch:guia2-sopa"]
      : {};
  }

  function getMatchingGameResult(state) {
    return state?.["matchingGame:guia2-relaciona"] &&
      typeof state["matchingGame:guia2-relaciona"] === "object"
      ? state["matchingGame:guia2-relaciona"]
      : {};
  }

  function getWordSearchWords(result) {
    if (Array.isArray(result.foundLabels)) {
      return result.foundLabels;
    }
    if (Array.isArray(result.found)) {
      return result.found;
    }
    return [];
  }

  function hasWordSearchResult(result, words) {
    return Boolean(
      result.startedAt ||
        result.completedAt ||
        (Array.isArray(words) && words.length) ||
        Number(result.mistakes)
    );
  }

  function getMatchingGamePairs(result) {
    if (Array.isArray(result.matchedPairs)) {
      return result.matchedPairs;
    }
    return [];
  }

  function hasMatchingGameResult(result, pairs) {
    return Boolean(
      result.startedAt ||
        result.completedAt ||
        (Array.isArray(pairs) && pairs.length) ||
        Number(result.mistakes)
    );
  }

  function extractWordSearchSummary(snapshot, user) {
    const state = snapshot?.state || {};
    const result = getWordSearchResult(state);
    const words = getWordSearchWords(result);
    if (!hasWordSearchResult(result, words)) {
      return null;
    }

    return {
      playerName: result.playerName || state["actividad4:nombre_completo"] || user.fullName,
      username: user.username,
      ficha: state["actividad4:ficha"] || user.ficha,
      score: Number(result.score) || 0,
      elapsedMs: Number(result.elapsedMs) || 0,
      mistakes: Number(result.mistakes) || 0,
      variant: Number(result.variant) || 1,
      words,
      completed: Boolean(result.completedAt),
      completedAt: result.completedAt || "",
      updatedAt: snapshot?.updatedAt || result.completedAt || result.startedAt || "",
    };
  }

  function extractMatchingGameSummary(snapshot, user) {
    const state = snapshot?.state || {};
    const result = getMatchingGameResult(state);
    const pairs = getMatchingGamePairs(result);
    if (!hasMatchingGameResult(result, pairs)) {
      return null;
    }

    return {
      playerName: result.playerName || state["actividad4:nombre_completo"] || user.fullName,
      username: user.username,
      ficha: state["actividad4:ficha"] || user.ficha,
      score: Number(result.score) || 0,
      elapsedMs: Number(result.elapsedMs) || 0,
      mistakes: Number(result.mistakes) || 0,
      variant: Number(result.variant) || 1,
      correctCount: Number(result.correctCount) || pairs.length || 0,
      totalPairs: Number(result.totalPairs) || 0,
      completed: Boolean(result.completedAt),
      completedAt: result.completedAt || "",
      updatedAt: snapshot?.updatedAt || result.completedAt || result.startedAt || "",
    };
  }

  async function hydrateGuide2WordSearchSummaries(users) {
    const nextSummaries = {};
    const nextMatchingSummaries = {};
    const tasks = [];

    users.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        if (!getGuide2ResponseConfig(guide.fileName)) {
          return;
        }

        const key = getGuide2SummaryKey(user.usernameKey, guide.fileName);
        tasks.push(
          loadGuide2Responses(user.usernameKey, guide.fileName)
            .then(({ snapshot }) => {
              nextSummaries[key] = extractWordSearchSummary(snapshot, user);
              nextMatchingSummaries[key] = extractMatchingGameSummary(snapshot, user);
              const st = snapshot?.state || {};
              if (st["322-finalizada"] === true || st["322-finalizada"] === "true") {
                matriz322Summaries[user.usernameKey] = {
                  fullName: user.fullName,
                  username: user.username,
                  grupo: user.grupo,
                  ficha: user.ficha,
                  finalizadaAt: st["322-finalizada-at"] || snapshot?.updatedAt || "",
                  state: st,
                };
              }
            })
            .catch(() => {
              nextSummaries[key] = null;
              nextMatchingSummaries[key] = null;
            })
        );
      });
    });

    if (!tasks.length) {
      guide2WordSearchSummaries = {};
      guide2MatchingGameSummaries = {};
      return;
    }

    await Promise.all(tasks);
    guide2WordSearchSummaries = nextSummaries;
    guide2MatchingGameSummaries = nextMatchingSummaries;
  }

  // ── Ficha de caso ──────────────────────────────────────────────────────────

  function getFichaCasoFileName(user) {
    const grupo = String(user?.grupo || "").toUpperCase().trim();
    return FICHA_CASO_FILES[grupo] || null;
  }

  async function readFichaCasoSnapshot(usernameKey, cloudFileName) {
    if (
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return null;
    }
    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(
        getGuide2ScopeKey(usernameKey),
        cloudFileName
      );
      return snapshot || null;
    } catch {
      return null;
    }
  }

  async function hydrateFichaCasoSummaries(users) {
    const next = {};
    const tasks = users
      .filter((user) => getFichaCasoFileName(user))
      .map((user) => {
        const cloudFileName = getFichaCasoFileName(user);
        return readFichaCasoSnapshot(user.usernameKey, cloudFileName)
          .then((snapshot) => {
            next[user.usernameKey] = snapshot || null;
          })
          .catch(() => {
            next[user.usernameKey] = null;
          });
      });

    if (!tasks.length) {
      fichaCasoSummaries = {};
      return;
    }

    await Promise.all(tasks);
    fichaCasoSummaries = next;
  }

  function renderFichaCasoAnswersBody(snapshot, user) {
    const state = snapshot?.state || {};
    const preguntas = [];
    const respuestas = [];
    let i = 0;
    while (state["preg_" + i] !== undefined) {
      preguntas.push(state["preg_" + i]);
      respuestas.push(state["resp_" + i] || "");
      i++;
    }

    const letras = ["A", "B", "C", "D", "E"];
    const rows = preguntas.map((preg, idx) => [
      `${letras[idx] || idx + 1}) ${preg}`,
      respuestas[idx] || "",
    ]);

    return `
      <div class="answers-grid">
        <article class="answer-card">
          <h3>Ficha asignada</h3>
          ${renderAnswerTable(
            ["Campo", "Valor"],
            [
              ["Ficha", snapshot?.fichaNombre || "Sin registro"],
              ["Guardado el", snapshot?.savedAt || formatDate(snapshot?.updatedAt)],
              ["Aprendiz", user.fullName || user.username],
              ["Grupo", user.grupo],
            ]
          )}
        </article>
        <article class="answer-card" style="grid-column:1/-1">
          <h3>Respuestas a las preguntas gu\u00eda</h3>
          ${rows.length
            ? renderAnswerTable(["Pregunta", "Respuesta del aprendiz"], rows)
            : '<div class="answer-value empty">Sin preguntas registradas.</div>'}
        </article>
      </div>
    `;
  }

  async function handleViewFichaCaso(button) {
    const usernameKey = button.getAttribute("data-ficha-caso-user") || "";
    const user = allUsers.find((u) => u.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No se encontró el usuario.", "error");
      return;
    }

    openGuide2ResponsesModal({
      title: "Ficha de Caso \u2014 Actividad 4",
      subtitle: `${user.fullName} | Grupo ${user.grupo}`,
      meta: "Cargando respuestas guardadas\u2026",
      bodyHtml: '<div class="response-status">Consultando Firestore\u2026</div>',
    });

    const cloudFileName = getFichaCasoFileName(user);
    const snapshot = cloudFileName
      ? await readFichaCasoSnapshot(usernameKey, cloudFileName)
      : null;

    if (!snapshot || !snapshot.state) {
      openGuide2ResponsesModal({
        title: "Ficha de Caso \u2014 Actividad 4",
        subtitle: `${user.fullName} | Grupo ${user.grupo}`,
        meta: `Aprendiz: ${user.fullName} | Grupo: ${user.grupo} | Ficha: ${user.ficha}`,
        bodyHtml:
          '<div class="response-status">Este aprendiz a\u00fan no ha guardado sus respuestas de la ficha de caso.</div>',
      });
      return;
    }

    const metaParts = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${snapshot.fichaNombre || user.ficha}`,
      `Guardado: ${snapshot.savedAt || formatDate(snapshot.updatedAt)}`,
    ];

    openGuide2ResponsesModal({
      title: "Ficha de Caso \u2014 Actividad 4",
      subtitle: `${user.fullName} | Grupo ${user.grupo}`,
      meta: metaParts.join(" | "),
      bodyHtml: renderFichaCasoAnswersBody(snapshot, user),
    });
  }

  function buildFichaCasoTable(rows) {
    if (!rows.length) {
      return '<p class="activities-loading">Ning\u00fan aprendiz ha guardado respuestas de la ficha de caso a\u00fan.</p>';
    }
    const headerHtml = ["Aprendiz", "Ficha asignada", "Grupo", "Fecha guardado", ""].map(
      (h) => `<th>${escapeHtml(h)}</th>`
    ).join("");
    const rowHtml = rows.map(({ user, snapshot }) => {
      const fichaNombre = snapshot?.fichaNombre || "Sin registro";
      const emoji = snapshot?.fichaEmoji || "";
      const savedAt = snapshot?.savedAt || formatDate(snapshot?.updatedAt) || "Sin registro";
      return `
        <tr>
          <td>${escapeHtml(user.fullName || user.username)}</td>
          <td>${escapeHtml(emoji ? emoji + " " + fichaNombre : fichaNombre)}</td>
          <td>${escapeHtml(user.grupo)}</td>
          <td>${escapeHtml(savedAt)}</td>
          <td>
            <button class="btn ghost" type="button"
              data-ficha-caso-user="${escapeHtml(user.usernameKey)}">
              Ver respuestas
            </button>
          </td>
        </tr>`;
    }).join("");
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;
  }

  // ── Fin Ficha de caso ──────────────────────────────────────────────────────

  // ── Matriz 3.2.2 ────────────────────────────────────────────────────────────

  const MATRIZ322_ACTORS = [
    { label: "Tienda Don Ramiro (Puerto Boyac\u00e1)", usa: "matriz-tienda-usa", desconoce: "matriz-tienda-desconoce", recomienda: "matriz-tienda-recomienda" },
    { label: "Cultivo Familiar (Otanche)",              usa: "matriz-cultivo-usa", desconoce: "matriz-cultivo-desconoce", recomienda: "matriz-cultivo-recomienda" },
    { label: "Artesan\u00edas (Pauna)",                 usa: "matriz-artesanias-usa", desconoce: "matriz-artesanias-desconoce", recomienda: "matriz-artesanias-recomienda" },
    { label: "Caso adicional del instructor",           usa: "matriz-extra-usa", desconoce: "matriz-extra-desconoce", recomienda: "matriz-extra-recomienda" },
  ];

  function buildMatriz322Table(rows) {
    if (!rows.length) {
      return '<p class="activities-loading">Ning\u00fan aprendiz ha finalizado la Matriz 3.2.2 a\u00fan.</p>';
    }
    const headerHtml = ["Aprendiz", "Grupo", "Ficha", "Fecha finalizado", ""].map(
      (h) => `<th>${escapeHtml(h)}</th>`
    ).join("");
    const rowHtml = rows.map(({ summary }) => `
      <tr>
        <td>${escapeHtml(summary.fullName || summary.username)}</td>
        <td>${escapeHtml(summary.grupo)}</td>
        <td>${escapeHtml(summary.ficha)}</td>
        <td>${escapeHtml(formatDate(summary.finalizadaAt))}</td>
        <td>
          <button class="btn ghost" type="button"
            data-matriz322-user="${escapeHtml(summary.username)}">
            Ver respuestas
          </button>
        </td>
      </tr>`
    ).join("");
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;
  }

  function openMatriz322Modal(summary) {
    const st = summary.state || {};
    const val = (k) => {
      const v = String(st[k] || "").trim();
      return v ? escapeHtml(v).replace(/\r?\n/g, "<br>") : "<em>Sin respuesta</em>";
    };

    const matrizRows = MATRIZ322_ACTORS.map((a) => `
      <tr>
        <th scope="row" style="background:#f0f9ff;font-size:.82rem;width:22%;">${escapeHtml(a.label)}</th>
        <td style="font-size:.82rem;">${val(a.usa)}</td>
        <td style="font-size:.82rem;">${val(a.desconoce)}</td>
        <td style="font-size:.82rem;">${val(a.recomienda)}</td>
      </tr>`
    ).join("");

    const bodyHtml = `
      <div class="answer-table-wrap" style="margin-bottom:16px;">
        <table class="answer-table" style="min-width:580px;">
          <thead>
            <tr>
              <th>Actor productivo</th>
              <th>Herramientas que usa</th>
              <th>Herramientas que desconoce</th>
              <th>Herramientas recomendadas</th>
            </tr>
          </thead>
          <tbody>${matrizRows}</tbody>
        </table>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <strong style="display:block;font-size:.85rem;color:#1e293b;margin-bottom:6px;">Compromisos personales</strong>
        <div style="font-size:.87rem;color:#334155;white-space:pre-wrap;">${val("contexto-compromisos")}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <strong style="display:block;font-size:.85rem;color:#1e293b;margin-bottom:6px;">Reto: ¿Cuál caso generó más dudas técnicas?</strong>
        <div style="font-size:.87rem;color:#334155;white-space:pre-wrap;">${val("contexto-reto-caso")}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;">
        <strong style="display:block;font-size:.85rem;color:#1e293b;margin-bottom:6px;">Reto: ¿Qué herramienta digital ya usa el aprendiz?</strong>
        <div style="font-size:.87rem;color:#334155;white-space:pre-wrap;">${val("contexto-reto-herramienta")}</div>
      </div>`;

    openGuide2ResponsesModal({
      title: "Matriz 3.2.2 \u2014 Diagn\u00f3stico Digital",
      subtitle: `${summary.fullName} | Grupo ${summary.grupo}`,
      meta: `Aprendiz: ${escapeHtml(summary.fullName)} | Grupo: ${escapeHtml(summary.grupo)} | Ficha: ${escapeHtml(summary.ficha)} | Finalizado: ${escapeHtml(formatDate(summary.finalizadaAt))}`,
      bodyHtml,
    });
  }

  // ── Fin Matriz 3.2.2 ─────────────────────────────────────────────────────────

  function renderAnswerValue(value) {
    const text = String(value ?? "").trim();
    if (!text) {
      return '<div class="answer-value empty">Sin respuesta registrada.</div>';
    }

    return `<div class="answer-value">${escapeHtml(text)}</div>`;
  }

  function renderAnswerTable(headers, rows) {
    const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
    const rowHtml = rows
      .map(
        (row) => `
          <tr>
            ${row
              .map(
                (cell) =>
                  `<td>${
                    hasMeaningfulValue(cell)
                      ? escapeHtml(String(cell)).replace(/\r?\n/g, "<br>")
                      : "Sin respuesta"
                  }</td>`
              )
              .join("")}
          </tr>
        `
      )
      .join("");

    return `
      <div class="answer-table-wrap">
        <table class="answer-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderWordSearchResult(state, context) {
    const result = getWordSearchResult(state);
    const words = getWordSearchWords(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const hasResult = hasWordSearchResult(result, words);
    const user = context?.user || {};

    return renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz que realizo", result.playerName || state["actividad4:nombre_completo"] || user.fullName],
        ["Usuario", user.username || result.playerKey || "Sin registro"],
        ["Ficha registrada", state["actividad4:ficha"] || user.ficha || "Sin registro"],
        ["Puntaje", hasResult ? `${score} / 10000` : "Sin registro"],
        ["Sopa asignada", hasResult ? `Version ${Number(result.variant) || 1}` : "Sin registro"],
        ["Errores", hasResult ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Palabras encontradas", words.length ? words.join(", ") : "Sin registro"],
        ["Total de palabras", words.length ? String(words.length) : "Sin registro"],
        ["Fecha de finalizacion", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );
  }

  function renderMatchingGameResult(state, context) {
    const result = getMatchingGameResult(state);
    const pairs = getMatchingGamePairs(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const hasResult = hasMatchingGameResult(result, pairs);
    const user = context?.user || {};
    const correctCount = Number(result.correctCount) || pairs.length || 0;
    const totalPairs = Number(result.totalPairs) || 0;
    const pairText = pairs
      .map((pair) => `${pair.tool || "Herramienta"}: ${pair.answer || "Sin respuesta"}`)
      .join(" | ");

    return renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz que realizo", result.playerName || state["actividad4:nombre_completo"] || user.fullName],
        ["Usuario", user.username || result.playerKey || "Sin registro"],
        ["Ficha registrada", state["actividad4:ficha"] || user.ficha || "Sin registro"],
        ["Puntaje", hasResult ? `${score} / 10000` : "Sin registro"],
        ["Version asignada", hasResult ? `Version ${Number(result.variant) || 1}` : "Sin registro"],
        ["Respuestas correctas", hasResult ? `${correctCount} / ${totalPairs || correctCount}` : "Sin registro"],
        ["Errores", hasResult ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Parejas correctas", pairText || "Sin registro"],
        ["Fecha de finalizacion", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );
  }

  function renderGuide2ResponsesBody(state, context) {
    return `<div class="answers-grid">${GUIDE2_ACTIVITIES.map((activity) =>
      renderGuide2ActivityResponsesBody(activity.id, state, context)
    ).join("")}</div>`;
  }

  function renderGuide2ActivityResponsesBody(activityId, state, context) {
    if (activityId === "wordsearch") {
      return `<article class="answer-card">
        <h3>Actividad 1. Sopa de letras de conceptos basicos.</h3>
        ${renderWordSearchResult(state, context)}
      </article>`;
    }
    if (activityId === "matching") {
      return `<article class="answer-card">
        <h3>Actividad 2. Relaciona la herramienta con su funcion.</h3>
        ${renderMatchingGameResult(state, context)}
      </article>`;
    }
    if (activityId === "extensiones331") {
      return `<article class="answer-card">
        <h3>Actividad 5. Extensiones de archivo.</h3>
        ${renderAnswerTable(
          ["Extension", "Programa asociado", "Descripcion"],
          GUIDE2_EXTENSION_IDS.map((id) => [
            `.${id}`,
            state[`extension:${id}:program`],
            state[`extension:${id}:description`],
          ])
        )}
        ${renderAnswerTable(
          ["Pregunta", "Respuesta del aprendiz"],
          [
            ["Categoria con mas extensiones", state["extensions-category-summary"]],
            ["Explicacion de la categoria", state["extensions-category-why"]],
            ["Extensiones de riesgo identificadas", state["extensions-risk-list"]],
            ["Hallazgos reales en el explorador", state["extensions-real-files"]],
            ["Estado de guardado", state["extensiones331-locked"] ? "Respuestas enviadas" : "Sin bloquear"],
          ]
        )}
      </article>`;
    }
    if (activityId === "sistemas332") {
      return `<article class="answer-card">
        <h3>Actividad 6. Requerimientos minimos de sistemas operativos.</h3>
        ${renderAnswerTable(
          ["Sistema operativo", "Procesador", "RAM", "Disco", "Fuente"],
          GUIDE2_SYSTEM_IDS.map((id) => [
            GUIDE2_SYSTEM_NAMES[id] || id,
            state[`system:${id}:processor`],
            state[`system:${id}:ram`],
            state[`system:${id}:disk`],
            state[`system:${id}:source`],
          ])
        )}
        ${renderAnswerTable(
          ["Pregunta", "Respuesta del aprendiz"],
          [
            ["Sistema con requerimientos mas bajos", state["systems-lowest"]],
            ["Sistema con requerimientos mas altos", state["systems-highest"]],
            ["Recomendacion tecnica", state["systems-recommendation"]],
            ["Retroalimentacion de companeros", state["systems-peer-feedback"]],
            ["Estado de guardado", state["sistemas332-locked"] ? "Respuestas enviadas" : "Sin bloquear"],
          ]
        )}
      </article>`;
    }
    if (activityId === "colaborativas334") {
      return `<article class="answer-card">
        <h3>Actividad 8. Herramientas colaborativas y comunicacion digital profesional.</h3>
        ${renderAnswerTable(
          ["Herramienta", "Funcion principal", "Ventaja clave", "Limitacion", "Precio/licencia"],
          GUIDE2_COLLABORATIVE_TOOLS.map((tool) => [
            tool.label,
            state[`collab:${tool.id}:function`],
            state[`collab:${tool.id}:advantage`],
            state[`collab:${tool.id}:limit`],
            state[`collab:${tool.id}:license`],
          ])
        )}
        ${renderAnswerTable(
          ["Campo", "Estado"],
          [["Estado de guardado", state["colaborativas334-locked"] ? "Respuestas enviadas" : "Sin bloquear"]]
        )}
      </article>`;
    }
    if (activityId === "transferReto341") {
      return `<article class="answer-card">
        <h3>Actividad 10. Reto final de solucion digital.</h3>
        ${renderAnswerTable(
          ["Pregunta", "Respuesta del aprendiz"],
          [
            ["El actor productivo podria usar la herramienta sin acompanamiento", state["transfer-reto-uso"]],
            ["La guia de uso rapido responde las preguntas del actor productivo", state["transfer-reto-guia"]],
            ["Estado de guardado", state["transfer-reto-locked"] ? "Respuestas enviadas" : "Sin bloquear"],
          ]
        )}
      </article>`;
    }
    return '<article class="answer-card"><div class="response-status">Actividad sin vista configurada.</div></article>';
  }

  function openGuide2ResponsesModal(options) {
    const modal = getById("guide2-responses-modal");
    if (!modal) {
      return;
    }

    const title = getById("guide2-responses-title");
    const subtitle = getById("guide2-responses-subtitle");
    const meta = getById("guide2-responses-meta");
    const body = getById("guide2-responses-body");
    const exportButton = getById("guide2-responses-export");
    if (!title || !subtitle || !meta || !body) {
      return;
    }

    const nextTitle = options.title || "Resultados de la Guia 2";
    const nextSubtitle = options.subtitle || "Consulta administrativa de la Guia 2.";
    const nextMeta = options.meta || "";
    const nextBodyHtml = options.bodyHtml || '<div class="response-status">Sin contenido disponible.</div>';
    const canExport = !/class=["'][^"']*response-status/i.test(nextBodyHtml);

    title.textContent = nextTitle;
    subtitle.textContent = nextSubtitle;
    meta.textContent = nextMeta;
    body.innerHTML = nextBodyHtml;
    currentResponsesExport = canExport
      ? {
          title: nextTitle,
          subtitle: nextSubtitle,
          meta: nextMeta,
          bodyHtml: nextBodyHtml,
        }
      : null;
    if (exportButton) {
      exportButton.hidden = !canExport;
    }
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeGuide2ResponsesModal() {
    const modal = getById("guide2-responses-modal");
    if (!modal || modal.hidden) {
      return;
    }

    modal.hidden = true;
    currentResponsesExport = null;
    document.body.classList.remove("modal-open");
  }

  async function handleViewGuide2Responses(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-view-guide2") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    const guide = user?.progress?.guides?.find((item) => item.fileName === fileName);

    if (!user || !fileName) {
      setFeedback("No fue posible identificar el usuario o la guia seleccionada.", "error");
      return;
    }

    openGuide2ResponsesModal({
      title: "Resultados de la Guia 2",
      subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
      meta: "Cargando respuestas guardadas...",
      bodyHtml: '<div class="response-status">Consultando la copia sincronizada y el respaldo local del aprendiz.</div>',
    });

    const { guideConfig, snapshot } = await loadGuide2Responses(usernameKey, fileName);
    const metaParts = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${user.ficha}`,
      `Guia: ${guide?.title || guideConfig?.title || auth.getGuideTitle(fileName)}`,
    ];

    if (!snapshot) {
      openGuide2ResponsesModal({
        title: "Resultados de la Guia 2",
        subtitle: `${user.fullName} | ${guideConfig?.title || auth.getGuideTitle(fileName)}`,
        meta: metaParts.join(" | "),
        bodyHtml:
          '<div class="response-status">Este aprendiz aun no tiene resultados guardados en la Guia 2 o la sincronizacion todavia no se ha completado.</div>',
      });
      return;
    }

    if (snapshot.sourceLabel) {
      metaParts.push(`Origen: ${snapshot.sourceLabel}`);
    }
    metaParts.push(`Ultima actualizacion: ${formatDate(snapshot.updatedAt)}`);
    if (snapshot.updatedBy) {
      metaParts.push(`Actualizado por: ${snapshot.updatedBy}`);
    }

    openGuide2ResponsesModal({
      title: "Resultados de la Guia 2",
      subtitle: `${user.fullName} | ${guideConfig?.title || auth.getGuideTitle(fileName)}`,
      meta: metaParts.join(" | "),
      bodyHtml: renderGuide2ResponsesBody(snapshot.state || {}, { user, guide }),
    });
  }

  async function handleViewGuideActivityResponses(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-guide-file") || "";
    const activityId = button.getAttribute("data-view-guide-activity") || "";
    const guideKind = button.getAttribute("data-guide-kind") || "";
    const activityLabel = button.getAttribute("data-activity-label") || "Actividad";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    const guide = user?.progress?.guides?.find((item) => item.fileName === fileName);
    if (!user || !fileName || !activityId) {
      setFeedback("No fue posible identificar la actividad seleccionada.", "error");
      return;
    }

    openGuide2ResponsesModal({
      title: activityLabel,
      subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
      meta: "Cargando respuestas guardadas...",
      bodyHtml: '<div class="response-status">Consultando la copia sincronizada y el respaldo local del aprendiz.</div>',
    });

    if (guideKind === "guia6") {
      const config = getGuide6Config(fileName);
      const snapshot = config ? await loadGuide6Responses(usernameKey, config) : null;
      const meta = [
        `Aprendiz: ${user.fullName}`,
        `Grupo: ${user.grupo}`,
        `Ficha: ${user.ficha}`,
        `Guia: ${guide?.title || config?.title || auth.getGuideTitle(fileName)}`,
        `Fuente: ${snapshot?.sourceLabel || "Sin registro"}`,
        `Actualizado: ${formatDate(snapshot?.updatedAt)}`,
      ].join(" | ");
      openGuide2ResponsesModal({
        title: activityLabel,
        subtitle: `${user.fullName} | ${config?.title || auth.getGuideTitle(fileName)}`,
        meta,
        bodyHtml: snapshot?.state
          ? `<div class="answers-grid">${renderGuide6ActivityResponsesBody(activityId, snapshot.state)}</div>`
          : '<div class="response-status">Este aprendiz aun no tiene respuestas guardadas para esta actividad.</div>',
      });
      return;
    }

    const { guideConfig, snapshot } = await loadGuide2Responses(usernameKey, fileName);
    const meta = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${user.ficha}`,
      `Guia: ${guide?.title || guideConfig?.title || auth.getGuideTitle(fileName)}`,
      `Fuente: ${snapshot?.sourceLabel || "Sin registro"}`,
      `Actualizado: ${formatDate(snapshot?.updatedAt)}`,
    ].join(" | ");
    openGuide2ResponsesModal({
      title: activityLabel,
      subtitle: `${user.fullName} | ${guideConfig?.title || auth.getGuideTitle(fileName)}`,
      meta,
      bodyHtml: snapshot?.state
        ? `<div class="answers-grid">${renderGuide2ActivityResponsesBody(activityId, snapshot.state || {}, { user, guide })}</div>`
        : '<div class="response-status">Este aprendiz aun no tiene respuestas guardadas para esta actividad.</div>',
    });
  }

  function setFeedback(message, type) {
    const box = getById("admin-feedback");
    if (!box) {
      return;
    }

    if (!message) {
      box.className = "admin-feedback";
      box.textContent = "";
      return;
    }

    box.className = `admin-feedback ${type || "success"}`;
    box.textContent = message;
  }

  function setStorageContext(message) {
    const copy = getById("storage-context-copy");
    if (copy) {
      copy.textContent = message;
    }
  }

  function buildGuideUrl(user, fileName) {
    const params = new URLSearchParams({
      ficha: user.ficha,
      inst: user.inst,
      grupo: user.grupo,
    });
    return `${fileName}?${params.toString()}`;
  }

  function renderFichaOptions(selectedFicha) {
    return Object.entries(auth.FICHA_MAP || {})
      .map(([ficha, info]) => {
        const selected = ficha === String(selectedFicha || "") ? " selected" : "";
        const label = `${ficha} - ${info.inst} | Grupo ${info.grupo}`;
        return `<option value="${escapeHtml(ficha)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function formatInstitutionShortName(value) {
    return String(value || "")
      .replace(/^Institucion Educativa\s+/i, "")
      .trim();
  }

  function formatGuideRouteName(fileName) {
    const title = String(auth.getGuideTitle(fileName) || fileName)
      .split("|")[0]
      .trim();
    return title.replace(/^Gu(?:i|\u00ed)a\s+\d+\s*-\s*/i, "").trim() || title;
  }

  function renderGuideAssignmentOptions(selectedFicha) {
    return Object.entries(auth.FICHA_MAP || {})
      .map(([ficha, info]) => {
        const selected = ficha === String(selectedFicha || "") ? " selected" : "";
        const guideSummary = (info.guias || [])
          .map((fileName) => formatGuideRouteName(fileName))
          .filter(Boolean)
          .join(" + ");
        const label = [
          `Grupo ${info.grupo}`,
          formatInstitutionShortName(info.inst) || info.inst,
          guideSummary || "Ruta sin guias",
          `Ficha ${ficha}`,
        ].join(" | ");
        return `<option value="${escapeHtml(ficha)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function renderFichaFilterOptions(selectedFicha) {
    const fichasWithUsers = new Set(allUsers.map((user) => String(user.ficha || "")));
    const fichaOptions = Object.entries(auth.FICHA_MAP || {})
      .filter(([ficha]) => fichasWithUsers.has(ficha))
      .map(([ficha, info]) => {
        const total = allUsers.filter((user) => String(user.ficha || "") === ficha).length;
        const selected = ficha === String(selectedFicha || "") ? " selected" : "";
        const label = `${ficha} - Grupo ${info.grupo} (${total})`;
        return `<option value="${escapeHtml(ficha)}"${selected}>${escapeHtml(label)}</option>`;
      })
      .join("");

    return `<option value="">Todas las fichas</option>${fichaOptions}`;
  }

  function getSelectedFichaFilter() {
    return String(getById("ficha-filter")?.value || "");
  }

  function updateFichaFilterOptions() {
    const select = getById("ficha-filter");
    if (!select) {
      return;
    }

    const selectedFicha = getSelectedFichaFilter();
    select.innerHTML = renderFichaFilterOptions(selectedFicha);

    if (selectedFicha && !Array.from(select.options).some((option) => option.value === selectedFicha)) {
      select.value = "";
      return;
    }
    select.value = selectedFicha;
  }

  function renderWordSearchAdminSummary(user, fileName) {
    const key = getGuide2SummaryKey(user.usernameKey, fileName);
    const summary = guide2WordSearchSummaries[key];

    if (summary === undefined) {
      return `
        <div class="word-search-admin-summary is-loading">
          <span>Actividad 1 - Sopa de letras</span>
          <strong>Consultando quien realizo la actividad...</strong>
        </div>
      `;
    }

    if (!summary) {
      return `
        <div class="word-search-admin-summary is-empty">
          <span>Actividad 1 - Sopa de letras</span>
          <strong>Realizo sopa: Sin registro</strong>
          <small>Aprendiz: ${escapeHtml(user.fullName)} | Ficha ${escapeHtml(user.ficha)}</small>
        </div>
      `;
    }

    return `
      <div class="word-search-admin-summary">
        <span>Actividad 1 - Sopa de letras</span>
        <strong>Realizo sopa: ${summary.completed ? "Si" : "En proceso"}</strong>
        <small>
          Aprendiz: ${escapeHtml(summary.playerName)} |
          Ficha ${escapeHtml(summary.ficha)} |
          Puntaje ${escapeHtml(summary.score)} / 10000 |
          Tiempo ${escapeHtml(formatDurationMs(summary.elapsedMs))} |
          Errores ${escapeHtml(summary.mistakes)} |
          Palabras ${escapeHtml(summary.words.length)}
        </small>
      </div>
    `;
  }

  function renderMatchingGameAdminSummary(user, fileName) {
    const key = getGuide2SummaryKey(user.usernameKey, fileName);
    const summary = guide2MatchingGameSummaries[key];

    if (summary === undefined) {
      return `
        <div class="word-search-admin-summary is-loading">
          <span>Actividad 2 - Relaciona funciones</span>
          <strong>Consultando quien realizo la actividad...</strong>
        </div>
      `;
    }

    if (!summary) {
      return `
        <div class="word-search-admin-summary is-empty">
          <span>Actividad 2 - Relaciona funciones</span>
          <strong>Actividad 2: Sin registro</strong>
          <small>Aprendiz: ${escapeHtml(user.fullName)} | Ficha ${escapeHtml(user.ficha)}</small>
        </div>
      `;
    }

    return `
      <div class="word-search-admin-summary">
        <span>Actividad 2 - Relaciona funciones</span>
        <strong>${summary.completed ? "Actividad completada" : "Actividad iniciada"} por ${escapeHtml(summary.playerName)}</strong>
        <small>
          Ficha ${escapeHtml(summary.ficha)} |
          Puntaje ${escapeHtml(summary.score)} / 10000 |
          Tiempo ${escapeHtml(formatDurationMs(summary.elapsedMs))} |
          Errores ${escapeHtml(summary.mistakes)} |
          Correctas ${escapeHtml(summary.correctCount)} / ${escapeHtml(summary.totalPairs || summary.correctCount)}
        </small>
      </div>
    `;
  }

  function renderSummary(users) {
    const fichas = new Set(users.map((user) => user.ficha));
    const activeUsers = users.filter((user) => (user.progress?.percent || 0) > 0);
    const selectedFicha = getSelectedFichaFilter();
    const fichaInfo = selectedFicha ? auth.getFichaInfo?.(selectedFicha) : null;
    const context = selectedFicha
      ? `Aprendices registrados en ficha ${selectedFicha}${
          fichaInfo?.grupo ? " | Grupo " + fichaInfo.grupo : ""
        }`
      : "Todas las fichas";

    getById("summary-users").textContent = String(users.length);
    getById("summary-active").textContent = String(activeUsers.length);
    getById("summary-fichas").textContent = String(fichas.size);
    getById("summary-admin").textContent = "Protegido";
    getById("summary-users-context").textContent = context;
    getById("filter-ficha-count").textContent = `${users.length} aprendiz${
      users.length === 1 ? "" : "es"
    } registrado${users.length === 1 ? "" : "s"}`;
  }

  function renderEmptyState(message) {
    const tab = getActiveTab();
    const id =
      tab === "avances"
        ? "progress-container"
        : tab === "actividades"
        ? "activities-container"
        : "users-container";
    const container = getById(id);
    if (!container) {
      return;
    }

    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderGuide6ResponsesBody(state) {
    const toolNames = { suite: "Suite ofimática", browser: "Navegador web", email: "Cliente de correo", zip: "Compresión", antivirus: "Antivirus", diagnostic: "Herramienta diagnóstico" };
    const diagNames = { hardware: "Hardware", so: "Sistema operativo", disk: "Estado del disco", software: "Inventario software", network: "Conectividad de red" };
    const budgetNames = { suite: "Suite ofimática", diagnostic: "Diagnóstico", security: "Antivirus / seguridad", cloud: "Servicios en la nube", backup: "Respaldo" };
    const val = (key) => String(state[key] ?? "").trim() || "Sin respuesta";
    const chk = (key) => state[key] ? "Sí ✓" : "No";
    const quiz = state["quiz-guia6-312"];
    const quizHtml = quiz && typeof quiz === "object"
      ? renderAnswerTable(["Campo", "Valor"], [
          ["Estado", quiz.status || "Sin registro"],
          ["Variante", quiz.variant != null ? String(quiz.variant) : "Sin registro"],
          ["Puntaje", quiz.score != null ? `${quiz.score} / 100` : "Sin registro"],
          ["Enviado por cambio de pestaña", quiz.terminatedByVisibility ? "Sí" : "No"],
          ["Fecha envío", quiz.submittedAt ? formatDate(quiz.submittedAt) : "Sin registro"],
        ])
      : '<div class="answer-value empty">Sin intento registrado.</div>';
    return `
      <div class="answers-grid">
        <article class="answer-card">
          <h3>Bitácora 3.1.1</h3>
          ${renderAnswerTable(["Pregunta", "Respuesta"], [
            ["¿Qué herramientas usa?", val("reflexion_herramientas")],
            ["¿Cómo registra su trabajo?", val("reflexion_registro")],
            ["¿Qué consecuencias tiene?", val("reflexion_consecuencias")],
            ["¿Qué experiencia tiene?", val("reflexion_experiencia")],
          ])}
        </article>
        <article class="answer-card">
          <h3>Socialización 3.1.2</h3>
          ${renderAnswerTable(["Campo", "Respuesta"], [
            ["Conclusión", val("socializacion_conclusion")],
            ["Pregunta central", val("socializacion_pregunta_central")],
          ])}
        </article>
        <article class="answer-card">
          <h3>Quiz herramientas 3.1.2</h3>
          ${quizHtml}
        </article>
        <article class="answer-card">
          <h3>Apuntes contexto 3.2.1</h3>
          <div class="answer-value">${escapeHtml(val("ctx_apuntes"))}</div>
        </article>
        <article class="answer-card">
          <h3>Mapa conceptual 3.2.2</h3>
          ${renderAnswerTable(["Campo", "Respuesta"], [
            ["Tema central", val("map_central")],
            ["Ramas principales", val("map_ramas")],
          ])}
        </article>
        <article class="answer-card" style="grid-column:1/-1">
          <h3>Checklist instalación 3.3.1</h3>
          ${renderAnswerTable(
            ["Herramienta", "Fuente consultada", "Versión", "Criterio verificación", "Hecho", "Notas / evidencia"],
            GUIDE6_INSTALL_IDS.map((id) => [toolNames[id] || id, val(`inst_source_${id}`), val(`inst_version_${id}`), val(`inst_verify_${id}`), chk(`inst_done_${id}`), val(`inst_notes_${id}`)])
          )}
        </article>
        <article class="answer-card" style="grid-column:1/-1">
          <h3>Diagnóstico 3.3.1</h3>
          ${renderAnswerTable(
            ["Sección", "Hallazgos y datos técnicos", "Recomendaciones / acciones"],
            GUIDE6_DIAG_IDS.map((id) => [diagNames[id] || id, val(`diag_result_${id}`), val(`diag_action_${id}`)])
          )}
          <div style="margin-top:12px">
            <strong style="font-size:.82rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted)">Conclusión</strong>
            <div class="answer-value" style="margin-top:6px">${escapeHtml(val("diag_conclusion"))}</div>
          </div>
        </article>
        <article class="answer-card" style="grid-column:1/-1">
          <h3>Presupuesto 3.4.1</h3>
          ${renderAnswerTable(
            ["Elemento", "Licencia", "Precio unit.", "Cant.", "Justificación técnica"],
            GUIDE6_BUDGET_IDS.map((id) => [budgetNames[id] || id, val(`budget_license_${id}`), val(`budget_price_${id}`), val(`budget_qty_${id}`), val(`budget_why_${id}`)])
          )}
          <div style="margin-top:12px">
            <strong style="font-size:.82rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted)">Conclusión</strong>
            <div class="answer-value" style="margin-top:6px">${escapeHtml(val("budget_conclusion"))}</div>
          </div>
        </article>
      </div>
    `;
  }

  function renderGuide6ActivityResponsesBody(activityId, state) {
    const toolNames = { suite: "Suite ofimatica", browser: "Navegador web", email: "Cliente de correo", zip: "Compresion", antivirus: "Antivirus", diagnostic: "Herramienta diagnostico" };
    const diagNames = { hardware: "Hardware", so: "Sistema operativo", disk: "Estado del disco", software: "Inventario software", network: "Conectividad de red" };
    const budgetNames = { suite: "Suite ofimatica", diagnostic: "Diagnostico", security: "Antivirus / seguridad", cloud: "Servicios en la nube", backup: "Respaldo" };
    const val = (key) => String(state[key] ?? "").trim() || "Sin respuesta";
    const chk = (key) => state[key] ? "Si" : "No";
    if (activityId === "bitacora311") {
      return `<article class="answer-card"><h3>Bitacora 3.1.1</h3>${renderAnswerTable(["Pregunta", "Respuesta"], [
        ["Que herramientas usa", val("reflexion_herramientas")],
        ["Como registra su trabajo", val("reflexion_registro")],
        ["Que consecuencias tiene", val("reflexion_consecuencias")],
        ["Que experiencia tiene", val("reflexion_experiencia")],
      ])}</article>`;
    }
    if (activityId === "socializacion312") {
      return `<article class="answer-card"><h3>Socializacion 3.1.2</h3>${renderAnswerTable(["Campo", "Respuesta"], [
        ["Conclusion", val("socializacion_conclusion")],
        ["Pregunta central", val("socializacion_pregunta_central")],
      ])}</article>`;
    }
    if (activityId === "quiz312") {
      const quiz = state["quiz-guia6-312"];
      return `<article class="answer-card"><h3>Quiz herramientas 3.1.2</h3>${
        quiz && typeof quiz === "object"
          ? renderAnswerTable(["Campo", "Valor"], [
              ["Estado", quiz.status || "Sin registro"],
              ["Variante", quiz.variant != null ? String(quiz.variant) : "Sin registro"],
              ["Puntaje", quiz.score != null ? `${quiz.score} / 100` : "Sin registro"],
              ["Fecha envio", quiz.submittedAt ? formatDate(quiz.submittedAt) : "Sin registro"],
            ])
          : '<div class="answer-value empty">Sin intento registrado.</div>'
      }</article>`;
    }
    if (activityId === "contexto321") {
      return `<article class="answer-card"><h3>Apuntes contexto 3.2.1</h3><div class="answer-value">${escapeHtml(val("ctx_apuntes"))}</div></article>`;
    }
    if (activityId === "mapa322") {
      return `<article class="answer-card"><h3>Mapa conceptual 3.2.2</h3>${renderAnswerTable(["Campo", "Respuesta"], [
        ["Tema central", val("map_central")],
        ["Ramas principales", val("map_ramas")],
      ])}</article>`;
    }
    if (activityId === "instalacion331") {
      return `<article class="answer-card"><h3>Checklist instalacion 3.3.1</h3>${renderAnswerTable(
        ["Herramienta", "Fuente consultada", "Version", "Criterio verificacion", "Hecho", "Notas / evidencia"],
        GUIDE6_INSTALL_IDS.map((id) => [toolNames[id] || id, val(`inst_source_${id}`), val(`inst_version_${id}`), val(`inst_verify_${id}`), chk(`inst_done_${id}`), val(`inst_notes_${id}`)])
      )}</article>`;
    }
    if (activityId === "diagnostico331") {
      return `<article class="answer-card"><h3>Diagnostico 3.3.1</h3>${renderAnswerTable(
        ["Seccion", "Hallazgos y datos tecnicos", "Recomendaciones / acciones"],
        GUIDE6_DIAG_IDS.map((id) => [diagNames[id] || id, val(`diag_result_${id}`), val(`diag_action_${id}`)])
      )}<div class="answer-value">${escapeHtml(val("diag_conclusion"))}</div></article>`;
    }
    if (activityId === "presupuesto341") {
      return `<article class="answer-card"><h3>Presupuesto 3.4.1</h3>${renderAnswerTable(
        ["Elemento", "Licencia", "Precio unit.", "Cant.", "Justificacion tecnica"],
        GUIDE6_BUDGET_IDS.map((id) => [budgetNames[id] || id, val(`budget_license_${id}`), val(`budget_price_${id}`), val(`budget_qty_${id}`), val(`budget_why_${id}`)])
      )}<div class="answer-value">${escapeHtml(val("budget_conclusion"))}</div></article>`;
    }
    return '<article class="answer-card"><div class="response-status">Actividad sin vista configurada.</div></article>';
  }

  async function handleViewGuide6Responses(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-view-guide6") || "";
    const user = allUsers.find((u) => u.usernameKey === usernameKey);
    if (!user || !fileName) return;
    const config = getGuide6Config(fileName);
    if (!config) return;
    openGuide2ResponsesModal({
      title: "Respuestas — Guía 6",
      subtitle: `${user.fullName} | ${config.title}`,
      meta: "Leyendo respuestas del aprendiz…",
      bodyHtml: '<div class="response-status">Consultando…</div>',
    });
    const snapshot = await loadGuide6Responses(usernameKey, config);
    if (!snapshot?.state) {
      openGuide2ResponsesModal({
        title: "Respuestas — Guía 6",
        subtitle: `${user.fullName} | ${config.title}`,
        meta: `Aprendiz: ${user.fullName} | Grupo: ${user.grupo}`,
        bodyHtml: '<div class="response-status">Este aprendiz aun no tiene respuestas guardadas en la Guia 6 sincronizadas.</div>',
      });
      return;
    }
    openGuide2ResponsesModal({
      title: "Respuestas — Guía 6",
      subtitle: `${user.fullName} | ${config.title}`,
      meta: `Aprendiz: ${user.fullName} | Grupo: ${user.grupo} | Fuente: ${snapshot.sourceLabel || "Sin registro"} | Actualizado: ${formatDate(snapshot.updatedAt)}`,
      bodyHtml: renderGuide6ResponsesBody(snapshot.state),
    });
  }

  async function handleUnlockActivity(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const activityId = button.getAttribute("data-unlock-activity") || "";
    const stateKey = button.getAttribute("data-state-key") || "";
    const fileName = button.getAttribute("data-guide-file") || "";
    const label = button.getAttribute("data-activity-label") || activityId;
    const user = allUsers.find((u) => u.usernameKey === usernameKey);
    if (!user || !stateKey || !activityId) {
      setFeedback("No fue posible identificar la actividad.", "error");
      return;
    }
    const activity = getUnlockActivitiesForGuide(fileName).find((a) => a.id === activityId);
    if (!activity) {
      setFeedback("No se encontró la configuración de la actividad.", "error");
      return;
    }
    const confirmed = window.confirm(
      `¿Habilitar de nuevo "${label}" para ${user.fullName}?\n\nEsto borrará las respuestas guardadas en esa actividad.`
    );
    if (!confirmed) return;
    const updatedAt = new Date().toISOString();
    const updatedBy = `admin-activity-unlock:${activity.id}`;
    const guideConfig = getGuide6Config(fileName) || getGuide2ResponseConfig(fileName);
    patchGuideState(usernameKey, stateKey, activity.keys, { updatedAt, updatedBy });
    await patchGuideCloudState(usernameKey, guideConfig?.cloudFileName || "", activity.keys, {
      updatedAt,
      updatedBy,
    });
    setFeedback(`Actividad "${label}" habilitada de nuevo para ${user.fullName}.`, "success");
    await refreshUsers();
  }

  function buildProgressCard(user, guide) {
    const fillWidth = Math.max(0, Math.min(100, Number(guide.percent) || 0));
    const guide2Config = getGuide2ResponseConfig(guide.fileName);
    const guide6Config = getGuide6Config(guide.fileName);
    const guide2Activities = getGuide2ActivitiesForFile(guide.fileName);
    const isRedesGuide = isRedesSbGuideFile(guide.fileName);
    const redesQuizButtons = isRedesGuide
      ? REDES_ADMIN_QUIZ_CONFIGS.map(
          (config) => `<button
                class="btn secondary"
                type="button"
                data-unlock-redes-quiz="${escapeHtml(config.key)}"
                data-guide-file="${escapeHtml(guide.fileName)}"
                data-user="${escapeHtml(user.usernameKey)}"
              >${escapeHtml(`Reabrir ${config.label}`)}</button>`
        ).join("")
      : "";
    const redesLabUnlockButtons = isRedesGuide
      ? REDES_LAB_ACTIVITIES.map(
          (activity) =>
            `<button class="btn ghost" type="button"
              data-unlock-redes-activity="${escapeHtml(activity.id)}"
              data-guide-file="${escapeHtml(guide.fileName)}"
              data-user="${escapeHtml(user.usernameKey)}"
            >${escapeHtml(activity.label)}</button>`
        ).join("")
      : "";
    const sourceText =
      guide.source === "meta" || guide.source === "network"
        ? `\u00daltima actualizaci\u00f3n: ${formatDate(guide.updatedAt)}`
        : "Resumen reconstruido desde el almacenamiento local.";
    const unlockableCount = isRedesGuide
      ? REDES_LAB_ACTIVITIES.length + REDES_ADMIN_QUIZ_CONFIGS.length
      : guide2Config
      ? guide2Activities.length
      : guide6Config
      ? GUIDE6_ACTIVITIES.length
      : 0;

    const activityStateKey = escapeHtml(getGuideActivityStateKey(guide.fileName));
    const activityUnlockButtons = (activities) =>
      activities
        .map(
          (act) =>
            `<button class="btn ghost unlock-activity-btn" type="button"
              data-unlock-activity="${escapeHtml(act.id)}"
              data-activity-label="${escapeHtml(act.label)}"
              data-state-key="${activityStateKey}"
              data-guide-file="${escapeHtml(guide.fileName)}"
              data-user="${escapeHtml(user.usernameKey)}"
            >${escapeHtml(act.label)}</button>`
        )
        .join("");

    const unlockSection = isRedesGuide
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${redesLabUnlockButtons}</div>
         </div>`
      : guide2Config
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${activityUnlockButtons(guide2Activities)}</div>
         </div>`
      : guide6Config
      ? `<div class="activity-unlock-panel">
           <div class="activity-unlock-title">Habilitar actividad</div>
           <div class="activity-unlock-buttons">${activityUnlockButtons(GUIDE6_ACTIVITIES)}</div>
         </div>`
      : "";

    return `
      <article class="progress-card">
        <div class="progress-card__head">
          <div>
            <h4>${escapeHtml(guide.title)}</h4>
            <div class="progress-source">${escapeHtml(sourceText)}</div>
          </div>
          <strong class="progress-card__percent">${fillWidth}%</strong>
        </div>
        <div class="progress-card__summary">
          <div>
            <span>Progreso</span>
            <strong>${guide.completed} / ${guide.total || 0}</strong>
          </div>
          <div>
            <span>Estado</span>
            <strong>${fillWidth >= 100 ? "Completada" : fillWidth > 0 ? "En desarrollo" : "Sin iniciar"}</strong>
          </div>
          <div>
            <span>Actividades habilitables</span>
            <strong>${unlockableCount}</strong>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${fillWidth}%"></div>
        </div>
        <div class="progress-card__actions progress-actions">
          <a class="btn ghost" href="${escapeHtml(buildGuideUrl(user, guide.fileName))}">Abrir gu\u00eda</a>
          ${redesQuizButtons}
          <button class="btn warn" type="button" data-reset-guide="${escapeHtml(
            guide.fileName
          )}" data-user="${escapeHtml(user.usernameKey)}">Reiniciar gu\u00eda</button>
        </div>
        ${unlockSection}
      </article>
    `;
  }

  function buildUserCard(user) {
    const createdText = formatDate(user.createdAt);
    const updatedText = formatDate(user.updatedAt);
    const overall = user.progress?.percent || 0;

    return `
      <article class="user-card" data-user-card="${escapeHtml(user.usernameKey)}">
        <div class="user-top">
          <div>
            <h3>${escapeHtml(user.fullName)}</h3>
            <div class="user-meta">
              <div>Usuario: <strong>${escapeHtml(user.username)}</strong> &nbsp;&middot;&nbsp; Ficha ${escapeHtml(user.ficha)} | ${escapeHtml(user.grupo)} | ${escapeHtml(user.inst)}</div>
              <div class="user-dates">Creado: ${escapeHtml(createdText)} &nbsp;&middot;&nbsp; Editado: ${escapeHtml(updatedText)}</div>
            </div>
          </div>
          <div class="user-badge">${overall}%</div>
        </div>

        <div class="user-section-title">Editar datos</div>
        <form class="account-form" data-account-form="${escapeHtml(user.usernameKey)}">
          <div class="account-grid">
            <label class="account-field">
              <span>Nombre completo</span>
              <input
                type="text"
                name="fullName"
                minlength="6"
                maxlength="120"
                value="${escapeHtml(user.fullName)}"
                placeholder="Nombre completo del aprendiz"
              >
            </label>
            <label class="account-field">
              <span>Usuario</span>
              <input
                type="text"
                name="username"
                minlength="3"
                maxlength="30"
                value="${escapeHtml(user.username)}"
                placeholder="Usuario de ingreso"
              >
            </label>
            <label class="account-field">
              <span>Guia / grupo</span>
              <select name="ficha" aria-label="Guia o grupo para ${escapeHtml(user.fullName)}">
                ${renderGuideAssignmentOptions(user.ficha)}
              </select>
            </label>
          </div>
          <div class="user-actions-row">
            <button class="btn secondary" type="submit">Guardar datos</button>
            <span class="user-hint">Al cambiar guia o grupo se actualizan la ficha e institucion.</span>
          </div>
        </form>

        <div class="user-password-section">
          <div class="user-section-title">Contrase\u00f1a</div>
          <form class="password-row" data-password-form="${escapeHtml(user.usernameKey)}">
            <input
              type="password"
              name="password"
              minlength="4"
              maxlength="60"
              placeholder="Nueva contrase\u00f1a para ${escapeHtml(user.username)}"
            >
            <button class="btn primary" type="submit">Actualizar</button>
          </form>
        </div>

        <div class="user-danger-zone">
          <button class="btn warn" type="button" data-reset-all="${escapeHtml(user.usernameKey)}">Reiniciar todo el avance</button>
          <span class="user-hint">Para reiniciar actividades espec\u00edficas usa la pesta\u00f1a "Avance de gu\u00edas".</span>
        </div>
      </article>
    `;
  }

  function getFilteredUsers() {
    const search = (getById("user-search")?.value || "").trim().toLowerCase();
    const selectedFicha = getSelectedFichaFilter();

    return allUsers.filter((user) => {
      if (selectedFicha && String(user.ficha || "") !== selectedFicha) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [user.fullName, user.username, user.ficha, user.grupo, user.inst]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  function getActiveTab() {
    const btn = document.querySelector(".admin-tab.is-active");
    return btn ? String(btn.dataset.tab || "usuarios") : "usuarios";
  }

  function setActiveTab(tabId) {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tabId);
    });
    document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabId;
    });
  }

  function renderUsersTab(users) {
    if (!users.length) {
      renderEmptyState("No hay usuarios que coincidan con la b\u00fasqueda actual.");
      return;
    }
    const container = getById("users-container");
    if (!container) {
      return;
    }
    container.innerHTML = users.map((user) => buildUserCard(user)).join("");
  }

  function buildProgressUserCard(user) {
    const guides = user.progress?.guides || [];
    const overall = user.progress?.percent || 0;
    return `
      <article class="user-card" data-user-card="${escapeHtml(user.usernameKey)}">
        <div class="user-top">
          <div>
            <h3>${escapeHtml(user.fullName)}</h3>
            <div class="user-meta">
              <div>Usuario: <strong>${escapeHtml(user.username)}</strong></div>
              <div>Ficha ${escapeHtml(user.ficha)} | ${escapeHtml(user.grupo)} | ${escapeHtml(user.inst)}</div>
            </div>
          </div>
          <div class="user-badge">${overall}%</div>
        </div>
        <div class="user-section-title" style="margin-top:12px">Avance por gu\u00eda</div>
        <div class="progress-grid">
          ${guides.map((guide) => buildProgressCard(user, guide)).join("")}
        </div>
      </article>
    `;
  }

  function renderProgressTab(users) {
    const container = getById("progress-container");
    if (!container) {
      return;
    }
    if (!users.length) {
      container.innerHTML = '<div class="empty-state">No hay usuarios que coincidan con la b\u00fasqueda actual.</div>';
      return;
    }
    container.innerHTML = users.map((user) => buildProgressUserCard(user)).join("");
  }

  function buildActivitiesTableRows(rows, type) {
    return rows
      .map(({ summary, user, guide }) => {
        const viewBtn = `<button class="btn ghost" type="button"
          data-view-guide2="${escapeHtml(guide.fileName)}"
          data-user="${escapeHtml(user.usernameKey)}">Ver soluci\u00f3n</button>`;
        if (type === "wordsearch") {
          return `<tr>
            <td>${escapeHtml(summary.playerName || user.fullName)}</td>
            <td>${escapeHtml(summary.ficha || user.ficha)}</td>
            <td>${escapeHtml(user.grupo)}</td>
            <td>${escapeHtml(String(summary.score))} / 10000</td>
            <td>${summary.elapsedMs ? escapeHtml(formatDurationMs(summary.elapsedMs)) : "\u2014"}</td>
            <td>${escapeHtml(String(summary.mistakes))}</td>
            <td>${escapeHtml(String(summary.words?.length || 0))}: ${escapeHtml((summary.words || []).join(", ") || "\u2014")}</td>
            <td>${summary.completedAt ? escapeHtml(formatDate(summary.completedAt)) : "\u2014"}</td>
            <td>${viewBtn}</td>
          </tr>`;
        }
        const correctCount = summary.correctCount || 0;
        const totalPairs = summary.totalPairs || correctCount;
        return `<tr>
          <td>${escapeHtml(summary.playerName || user.fullName)}</td>
          <td>${escapeHtml(summary.ficha || user.ficha)}</td>
          <td>${escapeHtml(user.grupo)}</td>
          <td>${escapeHtml(String(summary.score))} / 10000</td>
          <td>${summary.elapsedMs ? escapeHtml(formatDurationMs(summary.elapsedMs)) : "\u2014"}</td>
          <td>${escapeHtml(String(summary.mistakes))}</td>
          <td>${escapeHtml(String(correctCount))} / ${escapeHtml(String(totalPairs))}</td>
          <td>${summary.completedAt ? escapeHtml(formatDate(summary.completedAt)) : "\u2014"}</td>
          <td>${viewBtn}</td>
        </tr>`;
      })
      .join("");
  }

  function buildActivitiesTable(rows, type) {
    const headers =
      type === "wordsearch"
        ? ["Aprendiz", "Ficha", "Grupo", "Puntaje", "Tiempo", "Errores", "Palabras encontradas", "Fecha", ""]
        : ["Aprendiz", "Ficha", "Grupo", "Puntaje", "Tiempo", "Errores", "Parejas correctas", "Fecha", ""];

    if (!rows.length) {
      return '<p class="activities-empty">Sin resultados registrados.</p>';
    }

    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${buildActivitiesTableRows(rows, type)}</tbody>
        </table>
      </div>`;
  }

  function buildAvailableGuideActivityCards(groupUsers) {
    const cards = [];
    groupUsers.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        const guide2Config = getGuide2ResponseConfig(guide.fileName);
        const guide6Config = getGuide6Config(guide.fileName);
        const activities = guide2Config ? GUIDE2_ACTIVITIES : guide6Config ? GUIDE6_ACTIVITIES : [];
        const guideKind = guide2Config ? "guia2" : guide6Config ? "guia6" : "";
        activities.forEach((activity) => {
          cards.push(`
            <article class="activity-response-card">
              <div>
                <span class="activity-response-card__eyebrow">${escapeHtml(user.grupo)} | Ficha ${escapeHtml(user.ficha)}</span>
                <h3>${escapeHtml(activity.label)}</h3>
                <p>${escapeHtml(user.fullName)}<br>${escapeHtml(guide.title || auth.getGuideTitle(guide.fileName))}</p>
              </div>
              <button class="btn secondary" type="button"
                data-view-guide-activity="${escapeHtml(activity.id)}"
                data-guide-kind="${escapeHtml(guideKind)}"
                data-guide-file="${escapeHtml(guide.fileName)}"
                data-activity-label="${escapeHtml(activity.label)}"
                data-user="${escapeHtml(user.usernameKey)}">Ver respuestas</button>
            </article>
          `);
        });
      });
    });

    if (!cards.length) {
      return '<p class="activities-empty">No hay actividades de guias interactivas disponibles para este grupo.</p>';
    }
    return `<div class="activity-response-grid">${cards.join("")}</div>`;
  }

  async function unlockRedesGuideProgress(usernameKey, fileName, displayName) {
    const user = allUsers.find((item) => item.usernameKey === usernameKey) || null;
    const cloudFileName = getRedesGuideCloudFileName(fileName, user?.ficha);
    if (!cloudFileName) {
      setFeedback("No fue posible identificar la guia de redes a desbloquear.", "error");
      return;
    }

    if (!confirm(`¿Habilitar nuevamente la edicion de la guia de redes para "${displayName}"?`)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    let changed = false;

    try {
      const localStorageKey = getRedesGuideLocalStorageKey(usernameKey, fileName);
      const localState = localStorageKey
        ? readJson(localStorage.getItem(localStorageKey), null)
        : null;

      if (localStorageKey && localState && typeof localState === "object") {
        const localUnlock = clearRedesGuideLocks(localState);
        if (localUnlock.changed) {
          changed = true;
          localStorage.setItem(localStorageKey, JSON.stringify(localUnlock.state));
          localStorage.setItem(
            `${localStorageKey}__meta`,
            JSON.stringify({ updatedAt, updatedBy: "admin-redes-unlock" })
          );
        }
      }

      if (window._firebaseDb?.cloudGetGuideData && window._firebaseDb?.cloudSaveGuideData) {
        const scopeKey = getGuide2ScopeKey(usernameKey);
        const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName);
        const cloudUnlock = clearRedesGuideLocks(snapshot?.state || snapshot?.data || {});
        if (cloudUnlock.changed) {
          changed = true;
          await window._firebaseDb.cloudSaveGuideData(
            scopeKey,
            cloudFileName,
            buildRedesGuideSnapshotPayload(
              snapshot,
              cloudUnlock.state,
              updatedAt,
              "admin-redes-unlock"
            )
          );
        }
      }

      if (redesSocializacionSummaries[usernameKey]) {
        redesSocializacionSummaries[usernameKey].locked = false;
        redesSocializacionSummaries[usernameKey].updatedAt = updatedAt;
      }

      renderUsers();
      setFeedback(
        changed
          ? `Edicion habilitada para ${displayName} en la Guia 2 redes.`
          : `No se encontraron bloqueos activos para ${displayName} en la Guia 2 redes.`,
        "success"
      );
    } catch (err) {
      setFeedback(`No fue posible habilitar la edicion: ${err?.message || "intenta de nuevo."}`, "error");
    }
  }

  async function unlockRedesActivityProgress(usernameKey, fileName, activityId, displayName) {
    const user = allUsers.find((item) => item.usernameKey === usernameKey) || null;
    const activity = REDES_LAB_ACTIVITIES.find((item) => item.id === activityId);
    const cloudFileName = getRedesGuideCloudFileName(fileName, user?.ficha);
    if (!activity || !cloudFileName) {
      setFeedback("No fue posible identificar la actividad de redes a habilitar.", "error");
      return;
    }

    if (!confirm(`¿Habilitar nuevamente la edicion de "${activity.label}" para "${displayName}"?`)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const updatedBy = `admin-redes-activity-unlock:${activity.id}`;
    let changed = false;

    try {
      const localStorageKey = getRedesGuideLocalStorageKey(usernameKey, fileName);
      const localState = localStorageKey
        ? readJson(localStorage.getItem(localStorageKey), null)
        : null;

      if (localStorageKey && localState && typeof localState === "object") {
        const localUnlock = clearSelectedRedesGuideLocks(localState, activity.keys);
        if (localUnlock.changed) {
          changed = true;
          localStorage.setItem(localStorageKey, JSON.stringify(localUnlock.state));
          localStorage.setItem(
            `${localStorageKey}__meta`,
            JSON.stringify({ updatedAt, updatedBy })
          );
        }
      }

      if (window._firebaseDb?.cloudGetGuideData && window._firebaseDb?.cloudSaveGuideData) {
        const scopeKey = getGuide2ScopeKey(usernameKey);
        const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName);
        const cloudUnlock = clearSelectedRedesGuideLocks(snapshot?.state || snapshot?.data || {}, activity.keys);
        if (cloudUnlock.changed) {
          changed = true;
          await window._firebaseDb.cloudSaveGuideData(
            scopeKey,
            cloudFileName,
            buildRedesGuideSnapshotPayload(
              snapshot,
              cloudUnlock.state,
              updatedAt,
              updatedBy
            )
          );
        }
      }

      renderUsers();
      setFeedback(
        changed
          ? `Edicion habilitada para ${displayName} en ${activity.label}.`
          : `No se encontro bloqueo activo para ${displayName} en ${activity.label}.`,
        "success"
      );
    } catch (err) {
      setFeedback(`No fue posible habilitar la actividad: ${err?.message || "intenta de nuevo."}`, "error");
    }
  }

  async function unlockRedesQuizProgress(usernameKey, fileName, quizKey, displayName) {
    const user = allUsers.find((item) => item.usernameKey === usernameKey) || null;
    const quizConfig = getRedesQuizConfig(quizKey);
    const cloudFileName = getRedesGuideCloudFileName(fileName, user?.ficha);
    if (!quizConfig || !cloudFileName) {
      setFeedback("No fue posible identificar el quiz de redes a reabrir.", "error");
      return;
    }

    if (!confirm(`¿Reabrir ${quizConfig.label} para "${displayName}"?`)) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const updatedBy = `admin-redes-quiz-unlock:${quizConfig.key}`;

    try {
      const localStorageKey = getRedesGuideLocalStorageKey(usernameKey, fileName);
      const localState = localStorageKey
        ? readJson(localStorage.getItem(localStorageKey), null)
        : null;
      const scopeKey = getGuide2ScopeKey(usernameKey);
      const cloudSnapshot = window._firebaseDb?.cloudGetGuideData
        ? await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName)
        : null;
      const cloudState =
        cloudSnapshot?.state && typeof cloudSnapshot.state === "object"
          ? cloudSnapshot.state
          : cloudSnapshot?.data && typeof cloudSnapshot.data === "object"
            ? cloudSnapshot.data
            : null;

      const localReopen = reopenRedesQuizState(localState, quizKey, updatedAt);
      const cloudReopen = reopenRedesQuizState(cloudState, quizKey, updatedAt);
      const baseReopen = localReopen.found ? localReopen : cloudReopen;

      if (!baseReopen.found) {
        setFeedback(`No se encontro un intento guardado de ${quizConfig.label} para ${displayName}.`, "error");
        return;
      }

      if (localStorageKey) {
        localStorage.setItem(localStorageKey, JSON.stringify(baseReopen.state));
        localStorage.setItem(
          `${localStorageKey}__meta`,
          JSON.stringify({ updatedAt, updatedBy })
        );
      }

      if (window._firebaseDb?.cloudSaveGuideData) {
        await window._firebaseDb.cloudSaveGuideData(scopeKey, cloudFileName, {
          ...(cloudSnapshot && typeof cloudSnapshot === "object" ? cloudSnapshot : {}),
          state: baseReopen.state,
          data: baseReopen.state,
          updatedAt,
          updatedBy,
        });
      }

      delete redesQuizSummaries[usernameKey];
      await refreshUsers();
      setFeedback(
        baseReopen.changed
          ? `${quizConfig.label} reabierto para ${displayName}.`
          : `${quizConfig.label} ya estaba habilitado para ${displayName}.`,
        "success"
      );
    } catch (err) {
      setFeedback(`No fue posible reabrir ${quizConfig.label}: ${err?.message || "intenta de nuevo."}`, "error");
    }
  }

  async function unlockRedesStudent(usernameKey, ficha, displayName) {
    const fileName = getRedesGuidePageFileByFicha(ficha);
    if (!fileName) {
      setFeedback("No fue posible ubicar la guia de redes asociada a esa ficha.", "error");
      return;
    }
    await unlockRedesGuideProgress(usernameKey, fileName, displayName);
    return;
    if (!confirm(`¿Desbloquear campos de "${displayName}" para que pueda editar de nuevo?`)) return;

  }

  window.unlockRedesStudent = unlockRedesStudent;

  async function hydrateRedesSocializacionSummaries(users) {
    const tasks = users
      .filter((u) => REDES_SB_CLOUD_FILES[u.ficha])
      .map(async (user) => {
        if (user.usernameKey in redesSocializacionSummaries) return;
        const cloudFileName = REDES_SB_CLOUD_FILES[user.ficha];
        try {
          const snapshot = await window._firebaseDb?.cloudGetGuideData?.(
            getGuide2ScopeKey(user.usernameKey),
            cloudFileName
          );
          redesSocializacionSummaries[user.usernameKey] =
            snapshot?.state ? { text: String(snapshot.state["reflexion-socializacion"] || ""), locked: Boolean(snapshot.state["reflexion-socializacion-locked"]), updatedAt: snapshot.updatedAt || "", user } : null;
        } catch {
          redesSocializacionSummaries[user.usernameKey] = null;
        }
      });
    await Promise.all(tasks);
  }

  async function hydrateRedesQuizSummaries(users) {
    const tasks = users
      .filter((u) => REDES_SB_CLOUD_FILES[u.ficha])
      .map(async (user) => {
        if (user.usernameKey in redesQuizSummaries) return;
        const fileName = getRedesGuidePageFileByFicha(user.ficha);
        const snapshot = await loadRedesGuideSnapshot(user.usernameKey, fileName, user.ficha);
        redesQuizSummaries[user.usernameKey] = snapshot ? extractRedesQuizSummary(snapshot, user) : null;
      });
    await Promise.all(tasks);
  }

  function getRedesQuizStatusLabel(summary) {
    if (summary.status === "terminated_visibility") {
      return '<span style="color:#b45309;font-weight:700">Finalizado por visibilidad</span>';
    }
    if (summary.locked || summary.status === "completed") {
      return '<span style="color:#166534;font-weight:700">Completado</span>';
    }
    return '<span style="color:#1d4ed8;font-weight:700">En progreso</span>';
  }

  function buildRedesQuizTable(rows) {
    if (!rows.length) {
      return '<p class="activities-loading">Ningun aprendiz de Santa Barbara ha presentado el quiz 3.2.1.H aun.</p>';
    }
    const headers = [
      "Aprendiz",
      "Ficha",
      "Grupo",
      "Variante",
      "Inicio",
      "Finalizacion",
      "Fecha de presentacion",
      "Puntaje",
      "Advertencias",
      "Estado",
      "",
    ];
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(({ summary }) => {
            const guideFileName = getRedesGuidePageFileByFicha(summary.user.ficha);
            return `
            <tr>
              <td>${escapeHtml(summary.user.fullName || summary.user.usernameKey)}</td>
              <td>${escapeHtml(summary.user.ficha)}</td>
              <td>${escapeHtml(summary.user.grupo)}</td>
              <td>${escapeHtml(summary.variant || "Sin asignar")}</td>
              <td>${escapeHtml(formatDate(summary.startedAt))}</td>
              <td>${escapeHtml(formatDate(summary.completedAt))}</td>
              <td>${escapeHtml(formatDate(summary.submittedAt))}</td>
              <td>${escapeHtml(String(summary.score))} / ${escapeHtml(String(summary.maxScore || 100))}</td>
              <td>${escapeHtml(String(summary.warningCount))}</td>
              <td>${getRedesQuizStatusLabel(summary)}</td>
              <td>
                <div style="display:grid;gap:8px">
                  <button class="btn ghost" type="button" data-view-redes-quiz="${escapeHtml(summary.user.usernameKey)}">
                    Ver detalle
                  </button>
                  ${
                    guideFileName
                      ? `<button
                          class="btn secondary"
                          type="button"
                          data-unlock-redes-quiz="quiz-redes-321h"
                          data-guide-file="${escapeHtml(guideFileName)}"
                          data-user="${escapeHtml(summary.user.usernameKey)}"
                        >Reabrir quiz</button>`
                      : ""
                  }
                </div>
              </td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderRedesQuizDetail(summary) {
    const questions = getRedesQuizQuestions(summary.variant);
    const rows = questions.map((question, index) => {
      const selectedIndex = Number(summary.answers?.[question.id]);
      const selectedText =
        Number.isInteger(selectedIndex) && question.options?.[selectedIndex]
          ? question.options[selectedIndex]
          : "(sin respuesta)";
      const correctText = question.options?.[question.correctIndex] || "Sin respuesta correcta";
      return [
        `${index + 1}. ${question.prompt}`,
        selectedText,
        correctText,
        summary.results?.[question.id] ? "Correcta" : "Incorrecta",
      ];
    });

    const evidenceHtml = summary.evidenceEvents.length
      ? `<div class="answer-card">
          <h3>Evidencia de visibilidad</h3>
          <ul style="margin:0;padding-left:18px;line-height:1.7">
            ${summary.evidenceEvents.map((event) => `
              <li>
                Advertencia ${escapeHtml(String(event.warningNumber || "?"))}
                &mdash; ${escapeHtml(formatDate(event.timestamp))}
                &mdash; estado ${escapeHtml(event.visibilityState || "hidden")}
              </li>`).join("")}
          </ul>
        </div>`
      : `<div class="answer-card">
          <h3>Evidencia de visibilidad</h3>
          <p>Sin advertencias registradas.</p>
        </div>`;

    return `
      <div class="guide2-response-grid">
        <article class="answer-card">
          <h3>Resumen del intento</h3>
          ${renderAnswerTable(
            ["Campo", "Valor"],
            [
              ["Variante", summary.variant || "Sin asignar"],
              ["Inicio", formatDate(summary.startedAt)],
              ["Finalizacion", formatDate(summary.completedAt)],
              ["Fecha de presentacion", formatDate(summary.submittedAt)],
              ["Puntaje", `${summary.score} / ${summary.maxScore || 100}`],
              ["Advertencias", String(summary.warningCount)],
              [
                "Estado",
                summary.status === "terminated_visibility"
                  ? "Finalizado por visibilidad"
                  : summary.locked
                    ? "Completado"
                    : "En progreso",
              ],
              ["Origen", summary.sourceLabel || "Sin registro"],
            ]
          )}
        </article>
        <article class="answer-card">
          <h3>Preguntas y respuestas</h3>
          ${renderAnswerTable(
            ["Pregunta", "Respuesta del aprendiz", "Respuesta correcta", "Resultado"],
            rows
          )}
        </article>
        ${evidenceHtml}
      </div>
    `;
  }

  async function handleViewRedesQuiz(button) {
    const usernameKey = button.getAttribute("data-view-redes-quiz") || "";
    const summary = redesQuizSummaries[usernameKey] || null;
    const user = allUsers.find((item) => item.usernameKey === usernameKey) || summary?.user || null;

    if (!summary || !user) {
      setFeedback("No fue posible cargar el detalle del quiz de redes.", "error");
      return;
    }

    openGuide2ResponsesModal({
      title: "Quiz 3.2.1.H - Redes Santa Barbara",
      subtitle: `${user.fullName || user.usernameKey} | Variante ${summary.variant || "Sin asignar"}`,
      meta: [
        `Aprendiz: ${user.fullName || user.usernameKey}`,
        `Grupo: ${user.grupo}`,
        `Ficha: ${user.ficha}`,
        `Fecha de presentacion: ${formatDate(summary.submittedAt)}`,
      ].join(" | "),
      bodyHtml: renderRedesQuizDetail(summary),
    });
  }

  function buildRedesSocializacionTable(rows) {
    if (!rows.length) {
      return '<p class="activities-loading">Ning\u00fan aprendiz de Santa B\u00e1rbara ha enviado notas de socializaci\u00f3n a\u00fan.</p>';
    }
    const headers = ["Aprendiz", "Ficha", "Grupo", "Notas enviadas", "Estado", "Fecha", ""];
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(({ summary }) => `
            <tr>
              <td>${escapeHtml(summary.user.fullName || summary.user.usernameKey)}</td>
              <td>${escapeHtml(summary.user.ficha)}</td>
              <td>${escapeHtml(summary.user.grupo)}</td>
              <td style="max-width:340px;white-space:pre-wrap;word-break:break-word">${escapeHtml(summary.text || "(sin respuesta)")}</td>
              <td>${summary.locked ? '<span style="color:#2e7d32;font-weight:600">\u2705 Enviado</span>' : '<span style="color:#b45309">\u23f3 Pendiente</span>'}</td>
              <td>${formatDate(summary.updatedAt)}</td>
              <td>${summary.locked ? `<button class="btn ghost" type="button" onclick="unlockRedesStudent('${escapeHtml(summary.user.usernameKey)}','${escapeHtml(summary.user.ficha)}','${escapeHtml(summary.user.fullName || summary.user.usernameKey)}')">\uD83D\uDD13 Desbloquear</button>` : ""}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function getActivitiesGroups(users) {
    const seen = new Set();
    const groups = [];
    users.forEach((u) => {
      const key = `${u.grupo}::${u.ficha}`;
      if (!seen.has(key)) {
        seen.add(key);
        const instShort = String(u.inst || "").toLowerCase().includes("santa") ? "Santa B\u00e1rbara" : "Kennedy";
        groups.push({ key, grupo: u.grupo, inst: u.inst, ficha: u.ficha, label: `${u.grupo} \u2014 ${instShort}` });
      }
    });
    return groups.sort((a, b) => a.label.localeCompare(b.label, "es"));
  }

  function buildActivitiesPanels(groupUsers) {
    const wordSearchRows = [];
    const matchingRows = [];

    groupUsers.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        if (!getGuide2ResponseConfig(guide.fileName)) return;
        const key = getGuide2SummaryKey(user.usernameKey, guide.fileName);
        const ws = guide2WordSearchSummaries[key];
        const mg = guide2MatchingGameSummaries[key];
        if (ws) wordSearchRows.push({ summary: ws, user, guide });
        if (mg) matchingRows.push({ summary: mg, user, guide });
      });
    });

    const stillLoading = groupUsers.some((user) =>
      (user.progress?.guides || []).some((guide) => {
        if (!getGuide2ResponseConfig(guide.fileName)) return false;
        const key = getGuide2SummaryKey(user.usernameKey, guide.fileName);
        return !(key in guide2WordSearchSummaries);
      })
    );

    const fichaCasoRows = [];
    const fichaCasoLoading = groupUsers
      .filter((u) => getFichaCasoFileName(u))
      .some((u) => !(u.usernameKey in fichaCasoSummaries));
    groupUsers.forEach((user) => {
      if (!getFichaCasoFileName(user)) return;
      const snapshot = fichaCasoSummaries[user.usernameKey];
      if (snapshot?.state) fichaCasoRows.push({ user, snapshot });
    });

    const matriz322Rows = [];
    groupUsers.forEach((user) => {
      const summary = matriz322Summaries[user.usernameKey];
      if (summary) matriz322Rows.push({ summary });
    });

    const redesSbUsers = groupUsers.filter((u) => REDES_SB_CLOUD_FILES[u.ficha]);
    const hasRedes = redesSbUsers.length > 0;
    const redesLoading = redesSbUsers.some((u) => !(u.usernameKey in redesSocializacionSummaries));
    const redesRows = redesSbUsers.map((u) => redesSocializacionSummaries[u.usernameKey]).filter(Boolean).map((s) => ({ summary: s }));
    const redesQuizLoading = redesSbUsers.some((u) => !(u.usernameKey in redesQuizSummaries));
    const redesQuizRows = redesSbUsers.map((u) => redesQuizSummaries[u.usernameKey]).filter(Boolean).map((s) => ({ summary: s }));

    const loadingHtml = '<p class="activities-loading">Cargando resultados\u2026</p>';

    const hasGuia2Activities = groupUsers.some((u) =>
      (u.progress?.guides || []).some((g) => getGuide2ResponseConfig(g.fileName))
    );
    const hasFichaCaso = groupUsers.some((u) => getFichaCasoFileName(u));

    let html = "";

    html += `
      <section class="panel">
        <h2>Respuestas por actividad individual</h2>
        <p class="activities-section-copy">Selecciona una actividad para ver solo sus respuestas y exportarlas como soporte en Word.</p>
        ${buildAvailableGuideActivityCards(groupUsers)}
      </section>
    `;

    if (hasGuia2Activities) {
      html += `
        <section class="panel">
          <h2>Actividad 1 \u2014 Sopa de letras</h2>
          ${stillLoading ? loadingHtml : buildActivitiesTable(wordSearchRows, "wordsearch")}
        </section>
        <section class="panel">
          <h2>Actividad 2 \u2014 Relacionar funciones</h2>
          ${stillLoading ? loadingHtml : buildActivitiesTable(matchingRows, "matching")}
        </section>
        <section class="panel">
          <h2>Actividad 3.2.2 \u2014 Matriz de Diagn\u00f3stico Digital</h2>
          ${stillLoading ? loadingHtml : buildMatriz322Table(matriz322Rows)}
        </section>
      `;
    }
    if (hasFichaCaso) {
      html += `
        <section class="panel">
          <h2>Actividad 4 \u2014 Ficha de caso</h2>
          ${fichaCasoLoading ? loadingHtml : buildFichaCasoTable(fichaCasoRows)}
        </section>
      `;
    }
    if (hasRedes) {
      html += `
        <section class="panel">
          <h2>Quiz 3.2.1.H \u2014 Redes Santa B\u00e1rbara</h2>
          ${redesQuizLoading ? loadingHtml : buildRedesQuizTable(redesQuizRows)}
        </section>
        <section class="panel">
          <h2>Socializaci\u00f3n 3.1.1 \u2014 Santa B\u00e1rbara</h2>
          ${redesLoading ? loadingHtml : buildRedesSocializacionTable(redesRows)}
        </section>
      `;
    }
    if (!html) {
      html = '<div class="empty-state">No hay actividades registradas para este grupo.</div>';
    }
    return html;
  }

  function renderActivitiesTab(users) {
    const container = getById("activities-container");
    if (!container) return;

    if (!users.length) {
      container.innerHTML = '<div class="empty-state">No hay usuarios que coincidan con la b\u00fasqueda actual.</div>';
      return;
    }

    const groups = getActivitiesGroups(users);

    if (!activeActivitiesSubtab || !groups.find((g) => g.key === activeActivitiesSubtab)) {
      activeActivitiesSubtab = groups[0]?.key || null;
    }

    const subTabsHtml = groups.length > 1
      ? `<nav class="activities-subtabs">
          ${groups.map((g) => `
            <button class="activities-subtab${g.key === activeActivitiesSubtab ? " is-active" : ""}"
              type="button" data-activities-subtab="${escapeHtml(g.key)}">
              ${escapeHtml(g.label)}
            </button>`).join("")}
         </nav>`
      : "";

    const groupUsers = activeActivitiesSubtab
      ? users.filter((u) => `${u.grupo}::${u.ficha}` === activeActivitiesSubtab)
      : users;

    container.innerHTML = subTabsHtml + buildDeadlineConfigPanel(groupUsers) + buildActivitiesPanels(groupUsers);
  }

  function renderUsers() {
    updateFichaFilterOptions();
    const users = getFilteredUsers();
    renderSummary(users);
    const tab = getActiveTab();
    if (tab === "avances") {
      renderProgressTab(users);
    } else if (tab === "actividades") {
      renderActivitiesTab(users);
    } else {
      renderUsersTab(users);
    }
  }

  async function refreshUsers() {
    setFeedback("Actualizando usuarios y avances...", "success");
    const context = await auth.getStorageContext();
    setStorageContext(context.message);

    try {
      allUsers = await auth.fetchStudentsWithProgress();
      setFeedback("", "success");
    } catch (error) {
      allUsers = auth.getStudentsWithProgress();
      setFeedback(
        "No fue posible leer el almacenamiento compartido. Se muestra la copia local disponible.",
        "error"
      );
    }

    guide2WordSearchSummaries = {};
    guide2MatchingGameSummaries = {};
    fichaCasoSummaries = {};
    redesSocializacionSummaries = {};
    redesQuizSummaries = {};
    renderUsers();
    if (deadlineManager?.refreshPolicies) {
      await deadlineManager.refreshPolicies(true);
    }
    await Promise.all([
      hydrateGuide2WordSearchSummaries(allUsers),
      hydrateFichaCasoSummaries(allUsers),
      hydrateRedesSocializacionSummaries(allUsers),
      hydrateRedesQuizSummaries(allUsers),
    ]);
    renderUsers();
  }

  async function handleSaveActivityDeadline(button) {
    if (!deadlineManager) {
      setFeedback("La configuracion de fechas no esta disponible.", "error");
      return;
    }
    const fileName = button.getAttribute("data-save-activity-deadline") || "";
    const activityId = button.getAttribute("data-activity-id") || "";
    const activityLabel = button.getAttribute("data-activity-label") || activityId;
    const input = Array.from(document.querySelectorAll("[data-deadline-input]")).find(
      (element) => element.getAttribute("data-deadline-input") === `${fileName}::${activityId}`
    );
    const dueAt = String(input?.value || "").trim();
    if (!dueAt) {
      setFeedback(`Indica la fecha de cierre para "${activityLabel}".`, "error");
      return;
    }
    const session = auth.getCurrentSession?.();
    await deadlineManager.savePolicy(
      fileName,
      activityId,
      dueAt,
      session?.user?.usernameKey || session?.usernameKey || "admin"
    );
    setFeedback(`Fecha de entrega guardada para "${activityLabel}".`, "success");
    renderUsers();
  }

  async function handleClearActivityDeadline(button) {
    if (!deadlineManager) {
      setFeedback("La configuracion de fechas no esta disponible.", "error");
      return;
    }
    const fileName = button.getAttribute("data-clear-activity-deadline") || "";
    const activityId = button.getAttribute("data-activity-id") || "";
    const activityLabel = button.getAttribute("data-activity-label") || activityId;
    const session = auth.getCurrentSession?.();
    await deadlineManager.clearPolicy(
      fileName,
      activityId,
      session?.user?.usernameKey || session?.usernameKey || "admin"
    );
    setFeedback(`Fecha de entrega eliminada para "${activityLabel}".`, "success");
    renderUsers();
  }

  async function handlePasswordSubmit(form) {
    const usernameKey = form.getAttribute("data-password-form") || "";
    const input = form.querySelector("input[name='password']");
    const password = input?.value || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No se encontr\u00f3 el usuario solicitado.", "error");
      return;
    }

    const result = await auth.updateStudentPassword(usernameKey, password);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    if (input) {
      input.value = "";
    }
    setFeedback(`Contrase\u00f1a actualizada para ${user.fullName}.`, "success");
    await refreshUsers();
  }

  async function handleAccountSubmit(form) {
    const usernameKey = form.getAttribute("data-account-form") || "";
    const fullNameInput = form.querySelector("input[name='fullName']");
    const usernameInput = form.querySelector("input[name='username']");
    const select = form.querySelector("select[name='ficha']");
    const fullName = fullNameInput?.value || "";
    const username = usernameInput?.value || "";
    const ficha = select?.value || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No se encontro el usuario solicitado.", "error");
      return;
    }

    const unchanged =
      fullName.trim() === String(user.fullName || "").trim() &&
      username.trim() === String(user.username || "").trim() &&
      ficha === String(user.ficha || "");
    if (unchanged) {
      setFeedback(`No hay cambios pendientes para ${user.fullName}.`, "success");
      return;
    }

    const result = await auth.updateStudentAccount(usernameKey, {
      fullName,
      username,
      ficha,
    });
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    const updatedUser = result.user || {};
    const detail = [];
    if (String(updatedUser.fullName || "") !== String(user.fullName || "")) {
      detail.push(`nombre: ${updatedUser.fullName}`);
    }
    if (String(updatedUser.username || "") !== String(user.username || "")) {
      detail.push(`usuario: ${updatedUser.username}`);
    }
    if (String(updatedUser.ficha || "") !== String(user.ficha || "")) {
      detail.push(
        `guia/grupo: ${updatedUser.grupo || user.grupo || ""} (${updatedUser.ficha || ficha})`
      );
    }

    setFeedback(
      `Datos actualizados para ${updatedUser.fullName || user.fullName}.${detail.length ? ` Cambios: ${detail.join(" | ")}.` : ""}`,
      "success"
    );
    await refreshUsers();
  }

  async function handleResetGuide(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-reset-guide") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user || !fileName) {
      setFeedback("No fue posible identificar el usuario o la gu\u00eda.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Se reiniciar\u00e1 el avance de ${user.fullName} en ${auth.getGuideTitle(fileName)}. \u00bfDeseas continuar?`
    );
    if (!confirmed) {
      return;
    }

    const result = await auth.resetStudentGuideProgress(usernameKey, fileName);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    setFeedback(`Avance reiniciado para ${user.fullName} en ${auth.getGuideTitle(fileName)}.`, "success");
    await refreshUsers();
  }

  async function handleResetAll(button) {
    const usernameKey = button.getAttribute("data-reset-all") || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No fue posible identificar el usuario seleccionado.", "error");
      return;
    }

    const confirmed = window.confirm(
      `Se borrar\u00e1 todo el avance guardado de ${user.fullName}. \u00bfDeseas continuar?`
    );
    if (!confirmed) {
      return;
    }

    const result = await auth.resetStudentAllProgress(usernameKey);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    setFeedback(`Todo el avance de ${user.fullName} fue reiniciado.`, "success");
    await refreshUsers();
  }

  function bindEvents() {
    document.querySelectorAll(".admin-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.tab);
        renderUsers();
      });
    });

    getById("refresh-users")?.addEventListener("click", () => {
      refreshUsers();
    });

    getById("user-search")?.addEventListener("input", () => {
      renderUsers();
    });

    getById("ficha-filter")?.addEventListener("change", () => {
      renderUsers();
    });

    document.addEventListener("submit", async (event) => {
      const accountForm = event.target.closest("[data-account-form]");
      if (accountForm) {
        event.preventDefault();
        await handleAccountSubmit(accountForm);
        return;
      }

      const passwordForm = event.target.closest("[data-password-form]");
      if (passwordForm) {
        event.preventDefault();
        await handlePasswordSubmit(passwordForm);
        return;
      }
    });

    document.addEventListener("click", async (event) => {
      const closeGuide2ModalButton = event.target.closest("[data-close-guide2-modal]");
      if (closeGuide2ModalButton) {
        closeGuide2ResponsesModal();
        return;
      }

      const viewGuide2Button = event.target.closest("[data-view-guide2]");
      if (viewGuide2Button) {
        await handleViewGuide2Responses(viewGuide2Button);
        return;
      }

      const viewGuideActivityButton = event.target.closest("[data-view-guide-activity]");
      if (viewGuideActivityButton) {
        await handleViewGuideActivityResponses(viewGuideActivityButton);
        return;
      }

      const exportResponsesButton = event.target.closest("[data-export-responses-word]");
      if (exportResponsesButton) {
        exportCurrentResponsesToWord();
        return;
      }

      const viewRedesQuizButton = event.target.closest("[data-view-redes-quiz]");
      if (viewRedesQuizButton) {
        await handleViewRedesQuiz(viewRedesQuizButton);
        return;
      }

      const viewFichaCasoButton = event.target.closest("[data-ficha-caso-user]");
      if (viewFichaCasoButton) {
        await handleViewFichaCaso(viewFichaCasoButton);
        return;
      }

      const viewMatriz322Button = event.target.closest("[data-matriz322-user]");
      if (viewMatriz322Button) {
        const username = viewMatriz322Button.getAttribute("data-matriz322-user");
        const user = allUsers.find((u) => u.username === username || u.usernameKey === username);
        if (user) {
          const summary = matriz322Summaries[user.usernameKey];
          if (summary) {
            openMatriz322Modal(summary);
          }
        }
        return;
      }

      const unlockRedesGuideButton = event.target.closest("[data-unlock-redes-guide]");
      if (unlockRedesGuideButton) {
        const usernameKey = unlockRedesGuideButton.getAttribute("data-user") || "";
        const fileName = unlockRedesGuideButton.getAttribute("data-unlock-redes-guide") || "";
        const user = allUsers.find((item) => item.usernameKey === usernameKey);
        if (!user || !fileName) {
          setFeedback("No fue posible identificar la guia de redes a desbloquear.", "error");
          return;
        }
        await unlockRedesGuideProgress(usernameKey, fileName, user.fullName || user.usernameKey);
        return;
      }

      const unlockRedesActivityButton = event.target.closest("[data-unlock-redes-activity]");
      if (unlockRedesActivityButton) {
        const usernameKey = unlockRedesActivityButton.getAttribute("data-user") || "";
        const fileName = unlockRedesActivityButton.getAttribute("data-guide-file") || "";
        const activityId = unlockRedesActivityButton.getAttribute("data-unlock-redes-activity") || "";
        const user = allUsers.find((item) => item.usernameKey === usernameKey);
        if (!user || !fileName || !activityId) {
          setFeedback("No fue posible identificar la actividad de redes a habilitar.", "error");
          return;
        }
        await unlockRedesActivityProgress(usernameKey, fileName, activityId, user.fullName || user.usernameKey);
        return;
      }

      const unlockRedesQuizButton = event.target.closest("[data-unlock-redes-quiz]");
      if (unlockRedesQuizButton) {
        const usernameKey = unlockRedesQuizButton.getAttribute("data-user") || "";
        const fileName = unlockRedesQuizButton.getAttribute("data-guide-file") || "";
        const quizKey = unlockRedesQuizButton.getAttribute("data-unlock-redes-quiz") || "";
        const user = allUsers.find((item) => item.usernameKey === usernameKey);
        if (!user || !fileName || !quizKey) {
          setFeedback("No fue posible identificar el quiz de redes a reabrir.", "error");
          return;
        }
        await unlockRedesQuizProgress(usernameKey, fileName, quizKey, user.fullName || user.usernameKey);
        return;
      }

      const subtabButton = event.target.closest("[data-activities-subtab]");
      if (subtabButton) {
        activeActivitiesSubtab = subtabButton.getAttribute("data-activities-subtab") || null;
        renderUsers();
        return;
      }

      const viewGuide6Button = event.target.closest("[data-view-guide6]");
      if (viewGuide6Button) {
        await handleViewGuide6Responses(viewGuide6Button);
        return;
      }

      const unlockActivityButton = event.target.closest("[data-unlock-activity]");
      if (unlockActivityButton) {
        await handleUnlockActivity(unlockActivityButton);
        return;
      }

      const saveDeadlineButton = event.target.closest("[data-save-activity-deadline]");
      if (saveDeadlineButton) {
        await handleSaveActivityDeadline(saveDeadlineButton);
        return;
      }

      const clearDeadlineButton = event.target.closest("[data-clear-activity-deadline]");
      if (clearDeadlineButton) {
        await handleClearActivityDeadline(clearDeadlineButton);
        return;
      }

      const resetGuideButton = event.target.closest("[data-reset-guide]");
      if (resetGuideButton) {
        await handleResetGuide(resetGuideButton);
        return;
      }

      const resetAllButton = event.target.closest("[data-reset-all]");
      if (resetAllButton) {
        await handleResetAll(resetAllButton);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeGuide2ResponsesModal();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    bindEvents();
    await refreshUsers();
  });
})();
