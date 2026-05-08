(function () {
  const auth = window.portalAuth;
  const deadlineManager = window.activityDeadlineManager || null;
  const adminGrades = window.adminGrades || null;
  if (!auth) {
    return;
  }

  let allUsers = [];
  let guide2ResponseSnapshots = {};
  let guide2WordSearchSummaries = {};
  let guide2MatchingGameSummaries = {};
  let fichaCasoSummaries = {};
  let matriz322Summaries = {};
  let redesSocializacionSummaries = {};
  let redesQuizSummaries = {};
  let activeActivitiesSubtab = null;
  let activeActivitiesGuide = null;
  let activeActivitiesActivity = null;
  let activeGradesGroup = null;
  let currentResponsesExport = null;
  let habilitacionFilters = { name: "", ficha: "", guide: "", activity: "" };

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
    { id: "reflexion311", label: "Reflexion 3.1.1", keys: ["reflexion-311-locked"] },
    { id: "socializacion311", label: "Socializacion 3.1.1", keys: ["reflexion-socializacion-locked"] },
    { id: "bloqueA", label: "Bloque A - Tipos de redes", keys: ["bloqueA-locked"] },
    { id: "bloqueB", label: "Bloque B - Topologias de red", keys: ["bloqueB-locked"] },
    { id: "bloqueC", label: "Bloque C - Medios de transmision", keys: ["bloqueC-locked"] },
    { id: "bloqueD", label: "Bloque D - Dispositivos de interconexion", keys: ["bloqueD-locked"] },
    { id: "bloqueE", label: "Bloque E - Modelo OSI y TCP/IP", keys: ["bloqueE-locked"] },
    { id: "ip1", label: "Bloque IP 1", keys: ["ip1-locked"] },
    { id: "ip3", label: "Bloque IP 3", keys: ["ip3-locked"] },
    { id: "taller-ip-ej1", label: "Taller IP - Ejercicio 1", keys: ["taller-ip-ej1-locked"] },
    { id: "taller-ip-ej2", label: "Taller IP - Ejercicio 2", keys: ["taller-ip-ej2-locked"] },
    { id: "taller-ip-ej3", label: "Taller IP - Ejercicio 3", keys: ["taller-ip-ej3-locked"] },
    { id: "taller-ip-ej4", label: "Taller IP - Ejercicio 4", keys: ["taller-ip-ej4-locked"] },
    { id: "taller-ip-ej5", label: "Taller IP - Ejercicio 5", keys: ["taller-ip-ej5-locked"] },
    { id: "lab1", label: "Laboratorio 1 - Topologia estrella", keys: ["lab1-locked"] },
    { id: "lab2", label: "Laboratorio 2 - Topologia arbol", keys: ["lab2-locked"] },
    { id: "lab3", label: "Laboratorio 3 - Red hibrida", keys: ["lab3-locked"] },
    { id: "social", label: "Socializacion final", keys: ["social-locked"] },
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
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": {
      cloudFileName: "11a_guia.html",
    },
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": {
      cloudFileName: "11b_guia.html",
    },
  };
  const GUIDE2_WORD_SEARCH_LEADERBOARD_SCOPE = "leaderboard:guia2-sopa";
  const GUIDE2_MATCHING_GAME_LEADERBOARD_SCOPE = "leaderboard:guia2-relaciona";
  const GUIDE1_INDUCCION_FILES = {
    "grupo-10a-guia-01-induccion.html": { pageFile: "grupo-10a-guia-01-induccion" },
    "grupo-10b-guia-01-induccion.html": { pageFile: "grupo-10b-guia-01-induccion" },
  };
  const GUIDE1_ACTIVITIES = [
    { id: "arbol312",      label: "Actividad 3.1.2 - El Árbol de la Vida",              deliveryOnly: true },
    { id: "sena331",       label: "Actividad 3.3.1 - Análisis de símbolos SENA",         deliveryOnly: true },
    { id: "programa332",   label: "Actividad 3.3.2 - Cuestionario diseño curricular",    deliveryOnly: true },
    { id: "plataformas334",label: "Actividad 3.3.4 - Taller plataformas tecnológicas",   deliveryOnly: true },
    { id: "portafolio342", label: "Actividad 3.4.2 - Portafolio de evidencias",          deliveryOnly: true },
  ];
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
    "grupo-10a-guia-03-planificar-informacion.html": {
      stateKey: "guia_interactiva_10a_guia3_html",
      cloudFileName: "10a_guia3.html",
    },
    "grupo-10b-guia-03-planificar-informacion.html": {
      stateKey: "guia_interactiva_10b_guia3_html",
      cloudFileName: "10b_guia3.html",
    },
  };

  const GUIDE6_INSTALL_IDS = ["suite", "browser", "email", "zip", "antivirus", "diagnostic"];
  const GUIDE6_DIAG_IDS = ["hardware", "so", "disk", "software", "network"];
  const GUIDE6_BUDGET_IDS = ["suite", "diagnostic", "security", "cloud", "backup"];

  const GUIDE6_ACTIVITIES = [
    { id: "bitacora311", label: "Bitácora 3.1.1", keys: ["reflexion_herramientas", "reflexion_registro", "reflexion_consecuencias", "reflexion_experiencia", "bitacora311-locked"] },
    { id: "socializacion312", label: "Socialización 3.1.2", keys: ["socializacion_conclusion", "socializacion_pregunta_central", "socializacion312-locked"] },
    { id: "quiz312", label: "Quiz herramientas 3.1.2", keys: ["quiz-guia6-312", "quiz-guia3-312"] },
    { id: "tabla321", label: "Tabla resumen 3.2.1", keys: [] },
    { id: "mapa322", label: "Mapa conceptual 3.2.2", keys: [] },
    {
      id: "checklist331", label: "Checklist instalación 3.3.1",
      keys: GUIDE6_INSTALL_IDS.flatMap((id) => [`inst_source_${id}`, `inst_version_${id}`, `inst_verify_${id}`, `inst_done_${id}`, `inst_notes_${id}`]),
    },
    {
      id: "diagnostico332", label: "Diagnóstico técnico 3.3.2",
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
    { id: "matriz322", label: "Actividad 3.2.2 - Matriz de Diagnóstico Digital", auxiliar: true },
    { id: "fichaCaso", label: "Actividad 4 - Ficha de caso", auxiliar: true },
    { id: "extensiones331", label: "Actividad 5 - Extensiones de archivo", keys: GUIDE2_EXTENSION_ACTIVITY_KEYS },
    { id: "sistemas332", label: "Actividad 6 - Requerimientos minimos", keys: GUIDE2_SYSTEM_ACTIVITY_KEYS },
    { id: "colaborativas334", label: "Actividad 8 - Herramientas colaborativas", keys: GUIDE2_COLLABORATIVE_ACTIVITY_KEYS },
    { id: "transferReto341", label: "Actividad 10 - Reto final", keys: GUIDE2_TRANSFER_RETO_KEYS },
  ];

  function getById(id) {
    return document.getElementById(id);
  }

  async function confirmAdminAction(message) {
    if (typeof window.adminConfirmAction === "function") {
      return !!(await window.adminConfirmAction(message));
    }
    return window.confirm(message);
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

  function exportCurrentResponsesToWord() {
    if (!window.adminExport?.downloadWord(currentResponsesExport)) {
      setFeedback("No hay respuestas visibles para exportar.", "error");
    }
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

  function recordAdminAuditAction(entry) {
    if (!window.adminAudit || typeof window.adminAudit.recordAction !== "function") {
      return null;
    }
    return window.adminAudit.recordAction(entry);
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

  function isRedesSbGuideFile(fileName) {
    return Object.prototype.hasOwnProperty.call(REDES_SB_GUIDE_FILES, fileName);
  }

  function getRedesActivitiesForFile(fileName) {
    if (!isRedesSbGuideFile(fileName)) {
      return [];
    }
    return [
      ...REDES_ADMIN_QUIZ_CONFIGS.map((config) => ({
        id: config.key,
        label: config.label,
        redesQuiz: true,
      })),
      ...REDES_LAB_ACTIVITIES.map((activity) => ({
        ...activity,
        redesLab: true,
      })),
    ];
  }

  function getUnlockActivitiesForGuide(fileName) {
    const guide2Activities = getGuide2ActivitiesForFile(fileName);
    if (guide2Activities.length) return guide2Activities;
    const redesActivities = getRedesActivitiesForFile(fileName);
    if (redesActivities.length) return redesActivities;
    if (getGuide6Config(fileName)) return GUIDE6_ACTIVITIES;
    if (getGuide1Config(fileName)) return GUIDE1_ACTIVITIES;
    return [];
  }

  function getOfficialGuideFilesForUsers(users) {
    const ficha = String(users?.[0]?.ficha || "").trim();
    if (ficha && typeof auth.getGuidesForFicha === "function") {
      return auth.getGuidesForFicha(ficha);
    }
    const seen = new Set();
    const files = [];
    users.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        if (!seen.has(guide.fileName)) {
          seen.add(guide.fileName);
          files.push(guide.fileName);
        }
      });
    });
    return files;
  }

  function userHasOfficialGuide(user, fileName) {
    const ficha = String(user?.ficha || "").trim();
    if (ficha && typeof auth.getGuidesForFicha === "function") {
      return auth.getGuidesForFicha(ficha).includes(fileName);
    }
    return (user?.progress?.guides || []).some((guide) => guide.fileName === fileName);
  }

  function getGuideKind(fileName) {
    return getGuide2ResponseConfig(fileName) ? "guia2"
      : isRedesSbGuideFile(fileName) ? "redes"
      : getGuide6Config(fileName) ? "guia6"
      : getGuide1Config(fileName) ? "guia1"
      : "";
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

  function normalizeLookupText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function readGuide2LeaderboardSnapshot(scopeKey, cloudFileName) {
    if (
      !scopeKey ||
      !cloudFileName ||
      !window._firebaseDb ||
      typeof window._firebaseDb.cloudGetGuideData !== "function"
    ) {
      return [];
    }

    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName);
      const entries = Array.isArray(snapshot?.state?.entries) ? snapshot.state.entries : [];
      return entries.filter((entry) => entry && typeof entry === "object");
    } catch {
      return [];
    }
  }

  async function loadGuide2LeaderboardMaps(users) {
    const configs = new Map();
    users.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        const config = getGuide2ResponseConfig(guide.fileName);
        if (config?.cloudFileName) {
          configs.set(guide.fileName, config);
        }
      });
    });

    const maps = {
      wordSearch: {},
      matching: {},
    };

    await Promise.all(
      Array.from(configs.entries()).map(async ([fileName, config]) => {
        const [wordSearchEntries, matchingEntries] = await Promise.all([
          readGuide2LeaderboardSnapshot(GUIDE2_WORD_SEARCH_LEADERBOARD_SCOPE, config.cloudFileName),
          readGuide2LeaderboardSnapshot(GUIDE2_MATCHING_GAME_LEADERBOARD_SCOPE, config.cloudFileName),
        ]);
        maps.wordSearch[fileName] = wordSearchEntries;
        maps.matching[fileName] = matchingEntries;
      })
    );

    return maps;
  }

  function findGuide2LeaderboardEntry(entries, user) {
    const list = Array.isArray(entries) ? entries : [];
    const usernameKey = String(user?.usernameKey || "").trim().toLowerCase();
    const username = String(user?.username || "").trim().toLowerCase();
    const fullName = normalizeLookupText(user?.fullName);
    const ficha = String(user?.ficha || "").trim();

    const byKey = list.find((entry) => {
      const playerKey = String(entry?.playerKey || "").trim().toLowerCase();
      return playerKey && (playerKey === usernameKey || playerKey === username);
    });
    if (byKey) {
      return byKey;
    }

    return list.find((entry) => {
      const entryFicha = String(entry?.ficha || "").trim();
      const entryName = normalizeLookupText(entry?.playerName);
      return entryName && entryName === fullName && (!ficha || !entryFicha || entryFicha === ficha);
    }) || null;
  }

  function getGuide6Config(fileName) {
    const config = GUIDE6_FILES[fileName];
    if (!config) return null;
    return { ...config, title: auth.getGuideTitle(fileName) };
  }

  function getGuide1Config(fileName) {
    return GUIDE1_INDUCCION_FILES[fileName] || null;
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
  function buildMatriz322Table(rows) {
    return window.adminActivities.buildMatriz322Table(rows, { escapeHtml, formatDate });
  }

  function getFichaCasoFileName(user) {
    const grupo = String(user?.grupo || "").toUpperCase().trim();
    return FICHA_CASO_FILES[grupo] || "";
  }

  function buildFichaCasoTable(rows) {
    if (!rows.length) {
      return '<p class="activities-loading">Ningún aprendiz ha finalizado la Ficha de caso aún.</p>';
    }
    const headerHtml = ["Aprendiz", "Grupo", "Ficha asignada", "Fecha de entrega", ""]
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join("");
    const rowHtml = rows
      .map(({ user, snapshot }) => {
        const fichaEmoji = escapeHtml(snapshot.fichaEmoji || "");
        const fichaNombre = escapeHtml(snapshot.fichaNombre || "Ficha " + (snapshot.fichaIdx != null ? snapshot.fichaIdx + 1 : "—"));
        const savedAt = escapeHtml(snapshot.savedAt || formatDate(snapshot.updatedAt) || "—");
        return `
          <tr>
            <td><strong>${escapeHtml(user.fullName || user.username)}</strong></td>
            <td>${escapeHtml(user.grupo || "")}</td>
            <td>${fichaEmoji ? fichaEmoji + " " : ""}${fichaNombre}</td>
            <td>${savedAt}</td>
            <td>
              <button class="btn ghost btn--sm" type="button"
                data-ficha-caso-user="${escapeHtml(user.usernameKey)}">
                Ver respuestas
              </button>
            </td>
          </tr>`;
      })
      .join("");
    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>`;
  }

  function openMatriz322Modal(summary) {
    const payload = window.adminActivities.buildMatriz322ModalPayload(summary, { escapeHtml, formatDate });
    openGuide2ResponsesModal(payload);
  }

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

  // ── Helpers: word search & matching game ─────────────────────────────────
  function getWordSearchResult(state) {
    return state && typeof state["wordSearch:guia2-sopa"] === "object"
      ? state["wordSearch:guia2-sopa"]
      : {};
  }

  function getWordSearchWords(result) {
    if (Array.isArray(result.foundLabels)) return result.foundLabels;
    if (Array.isArray(result.found)) return result.found;
    return [];
  }

  function hasWordSearchResult(result, words) {
    return Boolean(result.completedAt || result.startedAt || (words && words.length));
  }

  function getMatchingGameResult(state) {
    return state && typeof state["matchingGame:guia2-relaciona"] === "object"
      ? state["matchingGame:guia2-relaciona"]
      : {};
  }

  function getMatchingGamePairs(result) {
    return Array.isArray(result.matchedPairs) ? result.matchedPairs : [];
  }

  function hasMatchingGameResult(result, pairs) {
    return Boolean(result.completedAt || result.startedAt || (pairs && pairs.length));
  }

  function extractWordSearchSummary(snapshot, user) {
    const state = snapshot?.state || {};
    const result = getWordSearchResult(state);
    if (!result.completedAt && !result.startedAt && !result.score) return null;
    const words = getWordSearchWords(result);
    return {
      completed: Boolean(result.completedAt),
      score: String(result.score || 0),
      playerName: result.playerName || user.fullName || "",
      ficha: result.ficha || user.ficha || "",
      elapsedMs: Number(result.elapsedMs) || 0,
      mistakes: String(result.mistakes || 0),
      wordCount: words.length,
      words,
      source: "snapshot",
    };
  }

  function extractMatchingGameSummary(snapshot, user) {
    const state = snapshot?.state || {};
    const result = getMatchingGameResult(state);
    if (!result.completedAt && !result.startedAt && !result.score) return null;
    const pairs = getMatchingGamePairs(result);
    return {
      completed: Boolean(result.completedAt),
      score: String(result.score || 0),
      playerName: result.playerName || user.fullName || "",
      ficha: result.ficha || user.ficha || "",
      elapsedMs: Number(result.elapsedMs) || 0,
      mistakes: String(result.mistakes || 0),
      correctCount: String(Number(result.correctCount) || pairs.length || 0),
      totalPairs: String(Number(result.totalPairs) || pairs.length || 0),
      source: "snapshot",
    };
  }

  async function hydrateGuide2WordSearchSummaries(users) {
    const tasks = users.map(async (user) => {
      const guide2Files = (user.progress?.guides || [])
        .map((g) => g.fileName)
        .filter((fileName) => getGuide2ResponseConfig(fileName));
      for (const fileName of guide2Files) {
        const key = getGuide2SummaryKey(user.usernameKey, fileName);
        if (key in guide2ResponseSnapshots) continue;
        const { snapshot } = await loadGuide2Responses(user.usernameKey, fileName);
        guide2ResponseSnapshots[key] = snapshot;
        guide2WordSearchSummaries[key] = snapshot ? extractWordSearchSummary(snapshot, user) : null;
        guide2MatchingGameSummaries[key] = snapshot ? extractMatchingGameSummary(snapshot, user) : null;
      }
    });
    await Promise.all(tasks);
    renderUsers();
  }
  // ── End helpers ───────────────────────────────────────────────────────────

  function renderWordSearchResult(state, context) {
    const result = getWordSearchResult(state);
    const words = getWordSearchWords(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const hasResult = hasWordSearchResult(result, words);
    const user = context?.user || {};

    const statsTable = renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz", result.playerName || state["actividad4:nombre_completo"] || user.fullName || "Sin registro"],
        ["Versión asignada", hasResult ? `Versión ${Number(result.variant) || 1}` : "Sin registro"],
        ["Puntaje", hasResult ? `${score.toLocaleString("es")} pts` : "Sin registro"],
        ["Palabras encontradas", hasResult ? `${words.length}` : "Sin registro"],
        ["Errores", hasResult ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Fecha de finalización", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );

    const wordsHtml = words.length
      ? `<div class="game-solution-title">Palabras encontradas en la sopa</div>
         <div class="game-words-grid">${words.map((w) => `<span class="game-word-chip">${escapeHtml(w)}</span>`).join("")}</div>`
      : `<p class="activities-empty">No se registraron palabras encontradas.</p>`;

    return statsTable + wordsHtml;
  }

  function renderMatchingGameResult(state, context) {
    const result = getMatchingGameResult(state);
    const pairs = getMatchingGamePairs(result);
    const score = Number(result.score) || 0;
    const elapsedMs = Number(result.elapsedMs) || 0;
    const hasResult = hasMatchingGameResult(result, pairs);
    const user = context?.user || {};
    const correctCount = Number(result.correctCount) || pairs.length || 0;
    const totalPairs = Number(result.totalPairs) || pairs.length || 0;

    const statsTable = renderAnswerTable(
      ["Dato", "Resultado"],
      [
        ["Aprendiz", result.playerName || state["actividad4:nombre_completo"] || user.fullName || "Sin registro"],
        ["Versión asignada", hasResult ? `Versión ${Number(result.variant) || 1}` : "Sin registro"],
        ["Puntaje", hasResult ? `${score.toLocaleString("es")} pts` : "Sin registro"],
        ["Parejas correctas", hasResult ? `${correctCount} / ${totalPairs}` : "Sin registro"],
        ["Errores", hasResult ? String(Number(result.mistakes) || 0) : "Sin registro"],
        ["Tiempo usado", elapsedMs ? formatDurationMs(elapsedMs) : "Sin registro"],
        ["Fecha de finalización", result.completedAt ? formatDate(result.completedAt) : "Sin registro"],
      ]
    );

    const pairsHtml = pairs.length
      ? `<div class="game-solution-title">Juego resuelto — parejas relacionadas por el aprendiz</div>
         <div class="answer-table-wrap">
           <table class="answer-table">
             <thead><tr><th>#</th><th>Herramienta</th><th>Función asignada por el aprendiz</th></tr></thead>
             <tbody>${pairs.map((pair, i) => `
               <tr>
                 <td>${i + 1}</td>
                 <td><strong>${escapeHtml(pair.tool || "—")}</strong></td>
                 <td>${escapeHtml(pair.answer || "Sin respuesta")}</td>
               </tr>`).join("")}
             </tbody>
           </table>
         </div>`
      : `<p class="activities-empty">No se registraron parejas relacionadas.</p>`;

    return statsTable + pairsHtml;
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

    if (guideKind === "guia1") {
      const payload = buildGuide1ActivityResponsePayload(user, fileName, activityId, activityLabel);
      openGuide2ResponsesModal({
        title: activityLabel,
        subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
        meta: payload?.meta || [
          `Aprendiz: ${user.fullName}`,
          `Grupo: ${user.grupo}`,
          `Ficha: ${user.ficha}`,
          `Guia: ${auth.getGuideTitle(fileName)}`,
          "Fuente: Sin entrega",
        ].join(" | "),
        bodyHtml: payload?.bodyHtml || '<div class="response-status">Este aprendiz aun no tiene entrega registrada para esta actividad.</div>',
      });
      return;
    }

    if (guideKind === "redes") {
      const payload = await buildRedesActivityResponsePayload(user, fileName, activityId, activityLabel);
      openGuide2ResponsesModal({
        title: activityLabel,
        subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
        meta: payload?.meta || [
          `Aprendiz: ${user.fullName}`,
          `Grupo: ${user.grupo}`,
          `Ficha: ${user.ficha}`,
          `Guia: ${auth.getGuideTitle(fileName)}`,
          "Fuente: Sin registro",
        ].join(" | "),
        bodyHtml: payload?.bodyHtml || '<div class="response-status">Este aprendiz aun no tiene respuestas guardadas para esta actividad.</div>',
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

  async function handleExportGuideActivityDirect(button) {
    const usernameKey = button.getAttribute("data-user") || "";
    const fileName = button.getAttribute("data-guide-file") || "";
    const activityId = button.getAttribute("data-export-activity") || "";
    const guideKind = button.getAttribute("data-guide-kind") || "";
    const activityLabel = button.getAttribute("data-activity-label") || "Actividad";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    const guide = user?.progress?.guides?.find((item) => item.fileName === fileName);

    if (!user || !fileName || !activityId) {
      setFeedback("No fue posible identificar la actividad seleccionada.", "error");
      return;
    }

    const origText = button.textContent;
    button.disabled = true;
    button.textContent = "Generando…";

    try {
      let bodyHtml = null;
      let meta = "";

      if (guideKind === "guia1") {
        const payload = buildGuide1ActivityResponsePayload(user, fileName, activityId, activityLabel);
        meta = payload?.meta || "";
        bodyHtml = payload?.bodyHtml || null;
      } else if (guideKind === "guia6") {
        const config = getGuide6Config(fileName);
        const snapshot = config ? await loadGuide6Responses(usernameKey, config) : null;
        meta = [
          `Aprendiz: ${user.fullName}`,
          `Grupo: ${user.grupo}`,
          `Ficha: ${user.ficha}`,
          `Guia: ${guide?.title || config?.title || auth.getGuideTitle(fileName)}`,
          `Fuente: ${snapshot?.sourceLabel || "Sin registro"}`,
          `Actualizado: ${formatDate(snapshot?.updatedAt)}`,
        ].join(" | ");
        bodyHtml = snapshot?.state
          ? `<div class="answers-grid">${renderGuide6ActivityResponsesBody(activityId, snapshot.state)}</div>`
          : null;
      } else if (guideKind === "redes") {
        const payload = await buildRedesActivityResponsePayload(user, fileName, activityId, activityLabel);
        meta = payload?.meta || "";
        bodyHtml = payload?.bodyHtml || null;
      } else {
        const { guideConfig, snapshot } = await loadGuide2Responses(usernameKey, fileName);
        meta = [
          `Aprendiz: ${user.fullName}`,
          `Grupo: ${user.grupo}`,
          `Ficha: ${user.ficha}`,
          `Guia: ${guide?.title || guideConfig?.title || auth.getGuideTitle(fileName)}`,
          `Fuente: ${snapshot?.sourceLabel || "Sin registro"}`,
          `Actualizado: ${formatDate(snapshot?.updatedAt)}`,
        ].join(" | ");
        bodyHtml = snapshot?.state
          ? `<div class="answers-grid">${renderGuide2ActivityResponsesBody(activityId, snapshot.state || {}, { user, guide })}</div>`
          : null;
      }

      if (!bodyHtml) {
        setFeedback(`${user.fullName} aún no tiene respuestas guardadas para esta actividad.`, "error");
        return;
      }

      const exportData = {
        title: activityLabel,
        subtitle: `${user.fullName} | ${auth.getGuideTitle(fileName)}`,
        meta,
        bodyHtml,
      };
      window.adminExport.downloadWord(exportData, {
        learnerName: user.fullName || user.usernameKey,
        title: activityLabel,
      });
      setFeedback(`Soporte exportado para ${user.fullName}.`, "success");
    } catch (err) {
      setFeedback(`No fue posible exportar: ${err?.message || "intenta de nuevo."}`, "error");
    } finally {
      button.disabled = false;
      button.textContent = origText;
    }
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

    const wordCount = Number(summary.wordCount) || (Array.isArray(summary.words) ? summary.words.length : 0);
    const sourceText = summary.source === "leaderboard" ? " | Fuente Top 5" : "";
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
          Palabras ${escapeHtml(wordCount)}${sourceText}
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

    const sourceText = summary.source === "leaderboard" ? " | Fuente Top 5" : "";
    return `
      <div class="word-search-admin-summary">
        <span>Actividad 2 - Relaciona funciones</span>
        <strong>${summary.completed ? "Actividad completada" : "Actividad iniciada"} por ${escapeHtml(summary.playerName)}</strong>
        <small>
          Ficha ${escapeHtml(summary.ficha)} |
          Puntaje ${escapeHtml(summary.score)} / 10000 |
          Tiempo ${escapeHtml(formatDurationMs(summary.elapsedMs))} |
          Errores ${escapeHtml(summary.mistakes)} |
          Correctas ${escapeHtml(summary.correctCount)} / ${escapeHtml(summary.totalPairs || summary.correctCount)}${sourceText}
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
        : tab === "fechas"
        ? "deadlines-container"
        : tab === "notas"
        ? "grades-container"
        : tab === "habilitacion"
        ? "habilitacion-container"
        : tab === "auditoria"
        ? "audit-container"
        : "users-container";
    const container = getById(id);
    if (!container) {
      return;
    }

    container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  function renderGuide6ResponsesBody(state) {
    return window.adminGuide6.renderFullResponsesBody(state, {
      renderAnswerTable,
      formatDate,
      escapeHtml,
    });
  }
  function renderGuide6ActivityResponsesBody(activityId, state) {
    return window.adminGuide6.renderActivityResponsesBody(activityId, state, {
      renderAnswerTable,
      formatDate,
      escapeHtml,
    });
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
    const confirmed = await confirmAdminAction(
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
    recordAdminAuditAction({
      action: "activity-unlock",
      target: user.fullName,
      detail: `${label} | ${auth.getGuideTitle(fileName)}`,
    });
    setFeedback(`Actividad "${label}" habilitada de nuevo para ${user.fullName}.`, "success");
    await refreshUsers();
  }

  function getGuide6UnlockActivities() {
    return GUIDE6_ACTIVITIES;
  }

  function buildProgressCard(user, guide) {
    return window.adminProgress.buildProgressCard({
        user,
        guide,
        guide2Config: getGuide2ResponseConfig(guide.fileName),
        guide6Config: getGuide6Config(guide.fileName),
        guide2Activities: getGuide2ActivitiesForFile(guide.fileName),
        guide6Activities: getGuide6UnlockActivities(),
        isRedesGuide: isRedesSbGuideFile(guide.fileName),
        redesAdminQuizConfigs: REDES_ADMIN_QUIZ_CONFIGS,
        redesLabActivities: REDES_LAB_ACTIVITIES,
      },
      {
        escapeHtml,
        formatDate,
        buildGuideUrl,
        getGuideActivityStateKey,
      }
    );
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
              minlength="6"
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

  function renderAuditTab() {
    const container = getById("audit-container");
    if (window.adminAudit && typeof window.adminAudit.renderAuditTab === "function") {
      window.adminAudit.renderAuditTab(container);
      return;
    }
    if (container) {
      container.innerHTML = `<div class="empty-state">La auditoria local no esta disponible.</div>`;
    }
  }

  function buildProgressUserCard(user) {
    let guides = user.progress?.guides || [];
    if (!guides.length && typeof auth.getGuidesForFicha === "function") {
      guides = (auth.getGuidesForFicha(user.ficha) || []).map((fileName) => ({
        fileName,
        title: auth.getGuideTitle ? auth.getGuideTitle(fileName) : fileName,
        completed: 0,
        total: 0,
        percent: 0,
        source: "default",
      }));
    }
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
        <div class="user-section-title user-section-title--progress">Avance por gu\u00eda</div>
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
    try {
      container.innerHTML = users.map((user) => buildProgressUserCard(user)).join("");
    } catch (e) {
      console.error("[admin] renderProgressTab error:", e);
      container.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Error al cargar avance de gu\u00edas: ${escapeHtml(e.message)}</div>`;
    }
  }


  async function unlockRedesGuideProgress(usernameKey, fileName, displayName) {
    const user = allUsers.find((item) => item.usernameKey === usernameKey) || null;
    const cloudFileName = getRedesGuideCloudFileName(fileName, user?.ficha);
    if (!cloudFileName) {
      setFeedback("No fue posible identificar la guia de redes a desbloquear.", "error");
      return;
    }

    const confirmed = await confirmAdminAction(
      `Habilitar nuevamente la edicion de la guia de redes para "${displayName}"?`
    );
    if (!confirmed) {
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
      recordAdminAuditAction({
        action: "redes-guide-unlock",
        target: displayName,
        detail: `${cloudFileName} | ${changed ? "bloqueos eliminados" : "sin bloqueos activos"}`,
      });
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

    const confirmed = await confirmAdminAction(
      `Habilitar nuevamente la edicion de "${activity.label}" para "${displayName}"?`
    );
    if (!confirmed) {
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
      recordAdminAuditAction({
        action: "redes-activity-unlock",
        target: displayName,
        detail: `${activity.label} | ${changed ? "bloqueos eliminados" : "sin bloqueo activo"}`,
      });
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

    const confirmed = await confirmAdminAction(
      `Reabrir ${quizConfig.label} para "${displayName}"?`
    );
    if (!confirmed) {
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
      recordAdminAuditAction({
        action: "redes-quiz-unlock",
        target: displayName,
        detail: `${quizConfig.label} | ${baseReopen.changed ? "quiz reabierto" : "ya habilitado"}`,
      });
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
              <td>${window.adminRedes.getQuizStatusLabel(summary)}</td>
              <td>
                <div class="redes-quiz-actions">
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

    const evidenceHtml = window.adminRedes.getQuizEvidenceHtml(summary, { formatDate, escapeHtml });

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
              ["Estado", window.adminRedes.getQuizStatusText(summary)],
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
              <td class="redes-socialization-notes">${escapeHtml(summary.text || "(sin respuesta)")}</td>
              <td>${window.adminRedes.getSocializationStatusLabel(summary.locked)}</td>
              <td>${formatDate(summary.updatedAt)}</td>
              <td>${summary.locked ? `<button class="btn ghost" type="button" onclick="unlockRedesStudent('${escapeHtml(summary.user.usernameKey)}','${escapeHtml(summary.user.ficha)}','${escapeHtml(summary.user.fullName || summary.user.usernameKey)}')">\uD83D\uDD13 Desbloquear</button>` : ""}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function getActivitiesGroups(users) {
    return window.adminActivities.getGroups(users);
  }

  function getUniqueInteractiveGuides(users) {
    return window.adminActivities.getUniqueInteractiveGuides(users, {
      getOfficialGuideFilesForUsers,
      getUnlockActivitiesForGuide,
      getGuideTitle: auth.getGuideTitle,
      getGuideKind,
    });
  }

  function readDeliveryRecord(usernameKey, pageFile, activityId) {
    const storageBase = `${pageFile}:delivery:${activityId}`;
    const key = auth.getStudentStorageKey(usernameKey, storageBase, { area: "guide-data" });
    return readJson(localStorage.getItem(key), null);
  }

  function buildStandardActivityButtons(activityId, guideKind, fileName, activityLabel, user) {
    return window.adminActivities.buildStandardButtons({
      activityId,
      guideKind,
      fileName,
      activityLabel,
      usernameKey: user.usernameKey,
    }, { escapeHtml });
  }

  function buildGuide1ActivityResponsePayload(user, fileName, activityId, activityLabel) {
    const g1Config = getGuide1Config(fileName);
    const record = g1Config ? readDeliveryRecord(user.usernameKey, g1Config.pageFile, activityId) : null;
    return window.adminActivities.buildGuide1ActivityResponsePayload({
      user,
      record,
      fileName,
      activityLabel,
    }, {
      getGuideTitle: auth.getGuideTitle,
      formatDate,
      escapeHtml,
      renderAnswerTable,
    });
  }

  function getRedesActivityStateRows(activity, state) {
    return window.adminRedes.getActivityStateRows(activity, state);
  }

  async function buildRedesActivityResponsePayload(user, fileName, activityId, activityLabel) {
    const guideTitle = auth.getGuideTitle(fileName);
    const metaParts = [
      `Aprendiz: ${user.fullName}`,
      `Grupo: ${user.grupo}`,
      `Ficha: ${user.ficha}`,
      `Guia: ${guideTitle}`,
    ];

    const activity = getRedesActivitiesForFile(fileName).find((item) => item.id === activityId);
    if (activity?.redesQuiz) {
      const summary = redesQuizSummaries[user.usernameKey] || null;
      if (!summary) return null;
      metaParts.push(`Fecha de presentacion: ${formatDate(summary.submittedAt)}`);
      metaParts.push(`Fuente: ${summary.sourceLabel || "Sin registro"}`);
      return {
        meta: metaParts.join(" | "),
        bodyHtml: renderRedesQuizDetail(summary),
      };
    }

    if (activityId === "socializacion311") {
      const summary = redesSocializacionSummaries[user.usernameKey] || null;
      return window.adminRedes.buildSocializationPayload({
        summary,
        metaParts,
        activityLabel,
      }, {
        formatDate,
        escapeHtml,
        renderAnswerTable,
      });
    }

    const snapshot = await loadRedesGuideSnapshot(user.usernameKey, fileName, user.ficha);
    const state =
      snapshot?.data && typeof snapshot.data === "object"
        ? snapshot.data
        : snapshot?.state && typeof snapshot.state === "object"
          ? snapshot.state
          : {};
    return window.adminRedes.buildActivityStatePayload({
      activity,
      state,
      metaParts,
      snapshot,
      activityLabel,
    }, {
      formatDate,
      escapeHtml,
      renderAnswerTable,
    });
  }

  function getGuide2ActivityStatusHtml(activityId, snapshot) {
    return window.adminActivities.getGuide2ActivityStatusHtml(activityId, snapshot, {
      activities: GUIDE2_ACTIVITIES,
      hasMeaningfulValue,
      formatDate,
      escapeHtml,
    });
  }

  function buildActivitiesStudentTable(groupUsers, fileName, activityId, activityLabel, guideKind) {
    return window.adminActivities.buildStudentActivityTable(
      {
        groupUsers,
        fileName,
        activityId,
        activityLabel,
        guideKind,
        summaries: {
          guide2Responses: guide2ResponseSnapshots,
          guide2WordSearch: guide2WordSearchSummaries,
          guide2MatchingGame: guide2MatchingGameSummaries,
          fichaCaso: fichaCasoSummaries,
          matriz322: matriz322Summaries,
          redesSocializacion: redesSocializacionSummaries,
          redesQuiz: redesQuizSummaries,
        },
      },
      {
        escapeHtml,
        formatDate,
        userHasOfficialGuide,
        getGuide2SummaryKey,
        buildStandardActivityButtons,
        buildMatriz322Table,
        buildFichaCasoTable,
        getFichaCasoFileName,
        getGuide1Config,
        readDeliveryRecord,
        getRedesActivitiesForFile,
        getGuide2ActivityStatusHtml,
        adminRedes: window.adminRedes,
      }
    );
  }

  function buildActivitiesPanels(groupUsers) {
    const result = window.adminActivities.buildExplorerPanel(
      {
        groupUsers,
        guides: getUniqueInteractiveGuides(groupUsers),
        activeGuide: activeActivitiesGuide,
        activeActivity: activeActivitiesActivity,
      },
      {
        escapeHtml,
        getUnlockActivitiesForGuide,
        buildActivitiesStudentTable,
      }
    );
    activeActivitiesGuide = result.activeGuide;
    activeActivitiesActivity = result.activeActivity;
    return result.html;
  }
  function getUserActivityLocked(usernameKey, fileName, activityId) {
    const stateKey = getGuideActivityStateKey(fileName);
    if (!stateKey) return false;
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    const state = readJson(localStorage.getItem(storageKey), {});
    const activities = getUnlockActivitiesForGuide(fileName);
    const activity = activities.find((a) => a.id === activityId);
    if (!activity || !Array.isArray(activity.keys)) return false;
    return activity.keys.some((k) => /-locked$/.test(k) && state[k] === true);
  }

  function renderHabilitacionTab(users) {
    const container = getById("habilitacion-container");
    if (!container) return;

    if (!window.adminHabilitacion) {
      container.innerHTML = '<div class="empty-state">El módulo de habilitación no está disponible.</div>';
      return;
    }

    try {
      container.innerHTML = window.adminHabilitacion.buildHabilitacionPanel(users.length ? users : allUsers, {
        auth,
        deadlineManager,
        readJson,
        getUnlockActivitiesForGuide,
        getGuideActivityStateKey,
        filters: habilitacionFilters,
      });

      // Wire habilitación filter inputs
      ["hab-filter-name", "hab-filter-ficha", "hab-filter-guide", "hab-filter-activity"].forEach((id) => {
        const el = getById(id);
        if (!el) return;
        const key = id.replace("hab-filter-", "");
        el.addEventListener("input", () => {
          habilitacionFilters[key] = el.value;
          renderHabilitacionTab(users.length ? users : allUsers);
        });
        el.addEventListener("change", () => {
          habilitacionFilters[key] = el.value;
          renderHabilitacionTab(users.length ? users : allUsers);
        });
      });
    } catch (e) {
      console.error("[admin] renderHabilitacionTab error:", e);
      container.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Error al cargar habilitación: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderDeadlinesTab(users) {
    const container = getById("deadlines-container");
    if (!container) return;

    if (!users.length) {
      container.innerHTML = '<div class="empty-state">No hay usuarios que coincidan con la búsqueda actual.</div>';
      return;
    }

    try {
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

      let configPanel = "";
      try {
        configPanel = window.adminDeadlines
          ? window.adminDeadlines.buildConfigPanel(groupUsers, { auth, deadlineManager, escapeHtml })
          : "";
      } catch (e) {
        console.error("[admin] buildConfigPanel error:", e);
        configPanel = `<div class="empty-state" style="color:#b91c1c;">Error en panel de fechas: ${escapeHtml(e.message)}</div>`;
      }

      let statusPanel = "";
      try {
        statusPanel = window.adminDeadlines?.buildStatusPanel
          ? window.adminDeadlines.buildStatusPanel(groupUsers, { auth, deadlineManager, escapeHtml, getUserActivityLocked })
          : "";
      } catch (e) {
        console.error("[admin] buildStatusPanel error:", e);
        statusPanel = "";
      }

      const combined = configPanel + statusPanel;
      container.innerHTML = subTabsHtml + (combined || '<div class="empty-state">No hay actividades con fechas de entrega configuradas para este grupo.</div>');
    } catch (e) {
      console.error("[admin] renderDeadlinesTab error:", e);
      container.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Error al cargar fechas de entrega: ${escapeHtml(e.message)}</div>`;
    }
  }

  function renderActivitiesTab(users) {
    const container = getById("activities-container");
    if (!container) return;

    if (!users.length) {
      container.innerHTML = '<div class="empty-state">No hay usuarios que coincidan con la b\u00fasqueda actual.</div>';
      return;
    }

    try {
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

      container.innerHTML = subTabsHtml + buildActivitiesPanels(groupUsers);
    } catch (e) {
      console.error("[admin] renderActivitiesTab error:", e);
      container.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Error al cargar actividades: ${escapeHtml(e.message)}</div>`;
    }
  }

  // â”€â”€ Pestaña Juicios de evaluación â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const GRADES_FAMILY_PATTERNS = {
    "guia-01-induccion":    /guia-01/,
    "guia-02-herramientas": /guia-02-herramientas/,
    "guia-redes-rap01":     /redes/,
    "guia-05-herramientas": /guia-05/,
    "guia-06-planificar":   /guia-06|guia-03-planificar/,
  };

  function buildGradesPanel(users) {
    const gradesManager = window.activityGradesManager;
    const catalog = gradesManager?.GRADE_CATALOG || {};
    const officialFiles = getOfficialGuideFilesForUsers(users);
    const guideFamilies = Object.entries(catalog).filter(([guideFamily]) => {
      const pattern = GRADES_FAMILY_PATTERNS[guideFamily];
      if (!pattern) return true;
      return officialFiles.some((f) => pattern.test(f));
    });
    if (!gradesManager || !Object.keys(catalog).length) {
      return '<div class="empty-state">El módulo de notas no está disponible.</div>';
    }
    if (!users.length) {
      return '<div class="empty-state">No hay aprendices para calificar en este grupo.</div>';
    }

    const rows = [];
    users.forEach((user) => {
      guideFamilies.forEach(([guideFamily, guideConfig]) => {
        const grades = gradesManager.getStudentGrades(user.usernameKey, guideFamily) || {};
        (guideConfig.activities || []).forEach((activity) => {
          const currentGrade = grades[activity.id] || "";
          const currentObs = typeof gradesManager.getStudentActivityObservation === "function"
            ? gradesManager.getStudentActivityObservation(user.usernameKey, guideFamily, activity.id)
            : (grades[activity.id + ":obs"] || "");
          rows.push(`
            <tr>
              <td>${escapeHtml(user.fullName)}</td>
              <td>${escapeHtml(user.grupo)}</td>
              <td>${escapeHtml(guideConfig.label || guideFamily)}</td>
              <td>${escapeHtml(activity.label || activity.id)}</td>
              <td>
                <select class="grades-panel-select"
                  data-user="${escapeHtml(user.usernameKey)}"
                  data-user-name="${escapeHtml(user.fullName)}"
                  data-guide-family="${escapeHtml(guideFamily)}"
                  data-activity-id="${escapeHtml(activity.id)}"
                  data-activity-label="${escapeHtml(activity.label || activity.id)}"
                  data-previous-grade="${escapeHtml(currentGrade)}">
                  <option value=""${currentGrade === "" ? " selected" : ""}>Sin nota</option>
                  <option value="A"${currentGrade === "A" ? " selected" : ""}>Aprobado</option>
                  <option value="D"${currentGrade === "D" ? " selected" : ""}>No aprobado</option>
                  <option value="P"${currentGrade === "P" ? " selected" : ""}>Pendiente</option>
                </select>
              </td>
              <td>
                <input
                  type="text"
                  class="grades-obs-input"
                  placeholder="Observación (opcional)"
                  maxlength="300"
                  value="${escapeHtml(currentObs)}"
                  data-obs-user="${escapeHtml(user.usernameKey)}"
                  data-obs-guide-family="${escapeHtml(guideFamily)}"
                  data-obs-activity="${escapeHtml(activity.id)}"
                  data-obs-label="${escapeHtml(activity.label || activity.id)}"
                  data-obs-user-name="${escapeHtml(user.fullName)}"
                >
              </td>
            </tr>`);
        });
      });
    });

    return `
      <div class="answer-table-wrap">
        <table class="answer-table activities-table">
          <thead>
            <tr>
              <th>Aprendiz</th>
              <th>Grupo</th>
              <th>Guía</th>
              <th>Actividad</th>
              <th>Juicio</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>`;
  }

  async function handleGradeChange(select) {
    const gradesManager = window.activityGradesManager;
    if (!gradesManager) {
      setFeedback("El modulo de notas no esta disponible.", "error");
      return;
    }
    const usernameKey = select.getAttribute("data-user") || "";
    const userName = select.getAttribute("data-user-name") || usernameKey;
    const guideFamily = select.getAttribute("data-guide-family") || "";
    const activityId = select.getAttribute("data-activity-id") || "";
    const activityLabel = select.getAttribute("data-activity-label") || activityId;
    const previousGrade = select.getAttribute("data-previous-grade") || "";
    const newGrade = select.value || "";
    const label = newGrade === "A" ? "Aprobado" : newGrade === "D" ? "No aprobado" : newGrade === "P" ? "Pendiente" : "Sin nota";

    const confirmed = await confirmAdminAction(
      `Guardar juicio "${label}" para ${userName} en ${activityLabel}?`
    );
    if (!confirmed) {
      select.value = previousGrade;
      return;
    }

    gradesManager.setStudentActivityGrade(usernameKey, guideFamily, activityId, newGrade);
    select.setAttribute("data-previous-grade", newGrade);
    recordAdminAuditAction({
      action: "grade-change",
      target: userName,
      detail: `${guideFamily} | ${activityLabel}: ${label}`,
    });
    setFeedback(`Nota actualizada para ${userName}.`, "success");
  }

  function patchGuideState(usernameKey, stateKey, keys, meta) {
    if (!usernameKey || !stateKey || !Array.isArray(keys)) {
      return;
    }
    const storageKey = auth.getStudentStorageKey(usernameKey, stateKey, { area: "guide-data" });
    const state = readJson(localStorage.getItem(storageKey), {});
    keys.forEach((key) => {
      delete state[key];
    });
    Object.assign(state, meta || {});
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  async function patchGuideCloudState(usernameKey, cloudFileName, keys, meta) {
    if (!window._firebaseDb?.cloudGetGuideData || !window._firebaseDb?.cloudSaveGuideData || !cloudFileName) {
      return;
    }
    const scopeKey = getGuide2ScopeKey(usernameKey);
    const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, cloudFileName);
    const base = snapshot && typeof snapshot === "object" ? snapshot : {};
    const state = Object.assign({}, base.state || {});
    keys.forEach((key) => {
      delete state[key];
    });
    Object.assign(state, meta || {});
    await window._firebaseDb.cloudSaveGuideData(scopeKey, cloudFileName, {
      ...base,
      state,
      updatedAt: meta?.updatedAt || new Date().toISOString(),
      updatedBy: meta?.updatedBy || "admin-activity-unlock",
    });
  }

  function renderGradesTab(users) {
    const container = getById("grades-container");
    if (!container) return;

    try {
      // Group selector
      const groups = [];
      const seen = new Set();
      users.forEach((u) => {
        const key = `${u.grupo}::${u.ficha}`;
        if (!seen.has(key)) { seen.add(key); groups.push({ key, label: `${u.grupo} — Ficha ${u.ficha}` }); }
      });

      if (!activeGradesGroup || !groups.find((g) => g.key === activeGradesGroup)) {
        activeGradesGroup = groups[0]?.key || null;
      }

      const groupSelectOptions = groups.map((g) =>
        `<option value="${escapeHtml(g.key)}"${activeGradesGroup === g.key ? " selected" : ""}>${escapeHtml(g.label)}</option>`
      ).join("");

      const groupSelector = groups.length > 1
        ? `<div class="grades-group-selector">
             <label for="grades-group-select"><strong>Grupo / Ficha:</strong></label>
             <select id="grades-group-select" class="activity-deadline-input grades-group-select">
               ${groupSelectOptions}
             </select>
           </div>`
        : "";

      const groupUsers = activeGradesGroup
        ? users.filter((u) => `${u.grupo}::${u.ficha}` === activeGradesGroup)
        : users;

      let gradesTableHtml = "";
      try {
        gradesTableHtml = buildGradesPanel(groupUsers);
      } catch (e) {
        console.error("[admin] buildGradesPanel error:", e);
        gradesTableHtml = `<div class="empty-state" style="color:#b91c1c;">Error al cargar tabla de notas: ${escapeHtml(e.message)}</div>`;
      }

      container.innerHTML = `
        <section class="panel">
          <h2>Juicios de evaluación</h2>
          <p class="activities-section-copy">
            Importa el archivo Excel <strong>Plan de Trabajo Concertado</strong> para cargar
            las notas automáticamente. También puedes editar cada nota directamente en la tabla.
            Los cambios quedan guardados de inmediato y el aprendiz los ve al abrir su guía.
          </p>

          ${groupSelector}

          <div class="grades-import-box">
            <p class="grades-import-title">📂 Importar desde Excel</p>
            <p class="grades-import-copy">
              Acepta el archivo <em>Plan de Trabajo Concertado</em> (.xlsx).
              Las notas se asignan automáticamente según el nombre del aprendiz.
            </p>
            <div class="grades-import-actions">
              <label class="btn secondary grades-import-button">
                🔄 Seleccionar Excel
                <input class="grades-import-input" type="file" accept=".xlsx,.xls" id="grades-excel-input">
              </label>
              <span class="grades-import-status" id="grades-import-status"></span>
            </div>
          </div>

          <hr class="grades-import-divider">

          <div id="grades-table-area">
            ${gradesTableHtml}
          </div>
        </section>`;
    } catch (e) {
      console.error("[admin] renderGradesTab error:", e);
      container.innerHTML = `<div class="empty-state" style="color:#b91c1c;">Error al cargar juicios de evaluación: ${escapeHtml(e.message)}</div>`;
    }

    // Wire file input
    const fileInput = container.querySelector("#grades-excel-input");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const status = container.querySelector("#grades-import-status");
        const validation = adminGrades.validateExcelFile(file);
        if (!validation.ok) {
          if (status) status.textContent = "❌ " + validation.message;
          fileInput.value = "";
          return;
        }
        if (status) status.textContent = "Leyendo archivo...";
        try {
          const parsed = await readGradesFromExcelFile(file);
          if (parsed.error) {
            if (status) status.textContent = "❌ " + parsed.error;
          } else {
            const confirmed = await confirmAdminAction(
              `Se importaran juicios de evaluacion para ${parsed.students.length} aprendices. ¿Deseas continuar?`
            );
            if (!confirmed) {
              if (status) status.textContent = "Importacion cancelada.";
              fileInput.value = "";
              return;
            }
            const result = adminGrades.applyParsedGrades(parsed.guideFamily, parsed.students, allUsers, window.activityGradesManager);
            recordAdminAuditAction({
              action: "grades-import",
              target: parsed.guideFamily,
              detail: `${result.saved} aprendices actualizados desde ${file.name || "Excel"}`,
            });
            const msg = `✅ ${result.saved} aprendices actualizados.` +
              (result.unmatched.length ? ` Sin coincidencia: ${result.unmatched.join(", ")}.` : "");
            if (status) status.textContent = msg;
            // Re-render table
            const tableArea = container.querySelector("#grades-table-area");
            if (tableArea) tableArea.innerHTML = buildGradesPanel(groupUsers);
          }
        } catch (err) {
          if (status) status.textContent = "❌ Error al procesar: " + err.message;
        }
        fileInput.value = "";
      });
    }
  }

  async function readGradesFromExcelFile(file) {
    if (!window.XLSX) return { error: "Librería XLSX no disponible." };
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = window.XLSX.read(data, { type: "array" });
          const parsed = adminGrades.parseWorkbook(wb);
          resolve(parsed);
        } catch (err) {
          resolve({ error: err.message });
        }
      };
      reader.readAsArrayBuffer(file);
    });
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
    } else if (tab === "fechas") {
      renderDeadlinesTab(users);
    } else if (tab === "notas") {
      renderGradesTab(users);
    } else if (tab === "habilitacion") {
      renderHabilitacionTab(users);
    } else if (tab === "auditoria") {
      renderAuditTab();
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

    guide2ResponseSnapshots = {};
    guide2WordSearchSummaries = {};
    guide2MatchingGameSummaries = {};
    fichaCasoSummaries = {};
    redesSocializacionSummaries = {};
    redesQuizSummaries = {};
    renderUsers();
    if (deadlineManager?.refreshPolicies) {
      await deadlineManager.refreshPolicies(true);
    }
    const hydrateTasks = [
      hydrateRedesSocializacionSummaries(allUsers),
      hydrateRedesQuizSummaries(allUsers),
    ];
    if (typeof hydrateGuide2WordSearchSummaries === "function") {
      hydrateTasks.push(hydrateGuide2WordSearchSummaries(allUsers));
    }
    if (typeof hydrateFichaCasoSummaries === "function") {
      hydrateTasks.push(hydrateFichaCasoSummaries(allUsers));
    }
    await Promise.all(hydrateTasks);
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
    const confirmed = await confirmAdminAction(
      `Se guardara la fecha de cierre de "${activityLabel}" para ${auth.getGuideTitle(fileName)}. ¿Deseas continuar?`
    );
    if (!confirmed) {
      return;
    }
    const session = auth.getCurrentSession?.();
    await deadlineManager.savePolicy(
      fileName,
      activityId,
      dueAt,
      session?.user?.usernameKey || session?.usernameKey || "admin"
    );
    recordAdminAuditAction({
      action: "deadline-save",
      target: auth.getGuideTitle(fileName),
      detail: `${activityLabel} | Cierre: ${dueAt}`,
    });
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
    const confirmed = await confirmAdminAction(
      `Se eliminara la fecha de cierre de "${activityLabel}" para ${auth.getGuideTitle(fileName)}. ¿Deseas continuar?`
    );
    if (!confirmed) {
      return;
    }
    const session = auth.getCurrentSession?.();
    await deadlineManager.clearPolicy(
      fileName,
      activityId,
      session?.user?.usernameKey || session?.usernameKey || "admin"
    );
    recordAdminAuditAction({
      action: "deadline-clear",
      target: auth.getGuideTitle(fileName),
      detail: activityLabel,
    });
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

    const confirmed = await confirmAdminAction(
      `Se cambiara la contrasena de ${user.fullName}. ¿Deseas continuar?`
    );
    if (!confirmed) {
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
    recordAdminAuditAction({
      action: "password-change",
      target: user.fullName,
      detail: `Usuario: ${user.username || usernameKey}`,
    });
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

    const confirmed = await confirmAdminAction(
      `Se actualizaran los datos de ${user.fullName}. ¿Deseas continuar?`
    );
    if (!confirmed) {
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

    recordAdminAuditAction({
      action: "account-update",
      target: user.fullName,
      detail: detail.join(" | ") || "Datos de aprendiz actualizados",
    });
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

    const confirmed = await confirmAdminAction(
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

    recordAdminAuditAction({
      action: "guide-reset",
      target: user.fullName,
      detail: auth.getGuideTitle(fileName),
    });
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

    const confirmed = await confirmAdminAction(
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

    recordAdminAuditAction({
      action: "all-progress-reset",
      target: user.fullName,
      detail: "Todo el avance guardado",
    });
    setFeedback(`Todo el avance de ${user.fullName} fue reiniciado.`, "success");
    await refreshUsers();
  }

  async function handleHabilitacionUnlock(button) {
    const usernameKey = button.getAttribute("data-hab-unlock") || "";
    const fileName = button.getAttribute("data-hab-guide") || "";
    const activityId = button.getAttribute("data-hab-activity") || "";
    const stateKey = button.getAttribute("data-hab-state-key") || "";
    const activityLabel = button.getAttribute("data-hab-label") || activityId;
    const guideTitle = button.getAttribute("data-hab-guide-title") || fileName;
    const learnerName = button.getAttribute("data-hab-learner") || usernameKey;
    const ficha = button.getAttribute("data-hab-ficha") || "";
    const lockKeysRaw = button.getAttribute("data-hab-lock-keys") || "";
    const lockKeys = lockKeysRaw ? lockKeysRaw.split(",").map((k) => k.trim()).filter(Boolean) : [];

    const user = allUsers.find((u) => u.usernameKey === usernameKey);
    if (!user || !stateKey || !activityId || !lockKeys.length) {
      setFeedback("No fue posible identificar la actividad a habilitar.", "error");
      return;
    }

    // Read motivo from the sibling input
    const motivoInput = document.querySelector(
      `[data-hab-motivo="${CSS.escape(usernameKey)}::${CSS.escape(fileName)}::${CSS.escape(activityId)}"]`
    );
    const motivo = motivoInput?.value?.trim() || "";

    const confirmed = await confirmAdminAction(
      `¿Habilitar nuevamente "${activityLabel}" para ${learnerName}?\n\nEsto borrará el bloqueo de la actividad y el aprendiz podrá modificarla o entregarla de nuevo.`
    );
    if (!confirmed) return;

    const updatedAt = new Date().toISOString();
    const updatedBy = `admin-hab-unlock:${activityId}`;

    // Patch local state
    patchGuideState(usernameKey, stateKey, lockKeys, { updatedAt, updatedBy });

    // Patch cloud state
    const guideConfig = getGuide6Config(fileName) || getGuide2ResponseConfig(fileName);
    if (guideConfig?.cloudFileName) {
      await patchGuideCloudState(usernameKey, guideConfig.cloudFileName, lockKeys, { updatedAt, updatedBy });
    }

    // Record trazabilidad
    if (window.adminHabilitacion?.recordUnlock) {
      window.adminHabilitacion.recordUnlock({
        usernameKey,
        learnerName,
        ficha,
        guideFile: fileName,
        guideTitle,
        activityId,
        activityLabel,
        motivo,
      });
    }
    recordAdminAuditAction({
      action: "activity-habilitacion",
      target: learnerName,
      detail: `${activityLabel} | ${guideTitle}${motivo ? ` | Motivo: ${motivo}` : ""}`,
    });

    setFeedback(`Actividad "${activityLabel}" habilitada nuevamente para ${learnerName}.`, "success");
    renderHabilitacionTab(getFilteredUsers());
  }

  async function handleObservationSave(input) {
    const gradesManager = window.activityGradesManager;
    if (!gradesManager || typeof gradesManager.setStudentActivityObservation !== "function") return;
    const usernameKey = input.getAttribute("data-obs-user") || "";
    const guideFamily = input.getAttribute("data-obs-guide-family") || "";
    const activityId = input.getAttribute("data-obs-activity") || "";
    const activityLabel = input.getAttribute("data-obs-label") || activityId;
    const userName = input.getAttribute("data-obs-user-name") || usernameKey;
    const obs = input.value?.trim() || "";
    gradesManager.setStudentActivityObservation(usernameKey, guideFamily, activityId, obs);
    recordAdminAuditAction({
      action: "observation-save",
      target: userName,
      detail: `${guideFamily} | ${activityLabel}`,
    });
    setFeedback(`Observación guardada para ${userName}.`, "success");
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

    document.addEventListener("change", async (event) => {
      const gradeSelect = event.target.closest(".grades-panel-select");
      if (gradeSelect) {
        await handleGradeChange(gradeSelect);
        return;
      }

      if (event.target.id === "grades-group-select") {
        activeGradesGroup = event.target.value || null;
        renderUsers();
        return;
      }
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

      const activitiesGuideBtn = event.target.closest("[data-activities-guide]");
      if (activitiesGuideBtn) {
        activeActivitiesGuide = activitiesGuideBtn.getAttribute("data-activities-guide") || null;
        activeActivitiesActivity = null;
        renderUsers();
        return;
      }

      const activitiesActivityBtn = event.target.closest("[data-activities-activity]");
      if (activitiesActivityBtn) {
        activeActivitiesActivity = activitiesActivityBtn.getAttribute("data-activities-activity") || null;
        renderUsers();
        return;
      }

      const exportActivityButton = event.target.closest("[data-export-activity]");
      if (exportActivityButton) {
        await handleExportGuideActivityDirect(exportActivityButton);
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
        return;
      }

      const habUnlockButton = event.target.closest("[data-hab-unlock]");
      if (habUnlockButton) {
        await handleHabilitacionUnlock(habUnlockButton);
        return;
      }
    });

    // Save observations on blur
    document.addEventListener("change", async (event) => {
      const obsInput = event.target.closest(".grades-obs-input");
      if (obsInput) {
        await handleObservationSave(obsInput);
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
