(function () {
  const STORAGE_PREFIX = "sena_portal";
  const USERS_KEY = `${STORAGE_PREFIX}_users_v1`;
  const SESSION_KEY = `${STORAGE_PREFIX}_session_v1`;
  const FLASH_KEY = `${STORAGE_PREFIX}_flash_v1`;

  const ADMIN_PROFILE = {
    fullName: "Dubier Orlando Millan Barbosa",
    username: "Dubier",
    usernameKey: "dubier",
    passwordHash: "d7ee7806b5161383528f4256cceb048a6cd50c80783eb6425428f832916361a7",
  };

  const GUIDE_TITLES = {
    "grupo-10a-guia-01-induccion.html": "Guía 1 - Inducción | Grupo 10A",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html":
      "Guía 2 - Operar herramientas informáticas y digitales | Grupo 10A",
    "grupo-10b-guia-01-induccion.html": "Guía 1 - Inducción | Grupo 10B",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html":
      "Guía 2 - Operar herramientas informáticas y digitales | Grupo 10B",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html":
      "Guía 5 - Operar herramientas informáticas y digitales | Grupo 11A",
    "grupo-11a-guia-06-planificar-informacion.html":
      "Guía 6 - Planificar la información | Grupo 11A",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html":
      "Guía 5 - Operar herramientas informáticas y digitales | Grupo 11B",
    "grupo-11b-guia-06-planificar-informacion.html":
      "Guía 6 - Planificar la información | Grupo 11B",
    "santa-barbara-10a-guia-02-redes-rap01.html":
      "Guía 2 - Definir los parámetros y recursos de la red de acuerdo con normativa de telecomunicaciones | Grupo 10A",
    "santa-barbara-10b-guia-02-redes-rap01.html":
      "Guía 2 - Definir los parámetros y recursos de la red de acuerdo con normativa de telecomunicaciones | Grupo 10B",
  };

  Object.assign(GUIDE_TITLES, {
    "grupo-10a-guia-01-induccion.html": "Gu\u00eda 1 - Inducci\u00f3n | Grupo 10A",
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html":
      "Gu\u00eda 2 - Operar herramientas inform\u00e1ticas y digitales | Grupo 10A",
    "grupo-10b-guia-01-induccion.html": "Gu\u00eda 1 - Inducci\u00f3n | Grupo 10B",
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html":
      "Gu\u00eda 2 - Operar herramientas inform\u00e1ticas y digitales | Grupo 10B",
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html":
      "Gu\u00eda 5 - Operar herramientas inform\u00e1ticas y digitales | Grupo 11A",
    "grupo-11a-guia-06-planificar-informacion.html":
      "Gu\u00eda 6 - Planificar la informaci\u00f3n | Grupo 11A",
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html":
      "Gu\u00eda 5 - Operar herramientas inform\u00e1ticas y digitales | Grupo 11B",
    "grupo-11b-guia-06-planificar-informacion.html":
      "Gu\u00eda 6 - Planificar la informaci\u00f3n | Grupo 11B",
  });

  const GUIDE_PROGRESS_CONFIG = {
    "grupo-10a-guia-01-induccion.html": {
      mode: "custom-checks",
      total: 10,
      pageKey: "10a_guia",
      dataKey: "10a_guia:checks",
      dataPrefix: "10a_guia:",
      legacyDataPrefixes: ["grupo-10a-guia-01-induccion:"],
    },
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html": {
      mode: "state-with-activity",
      total: 111,
      activityTotal: 4,
      pageKey: "10a_guia2",
      stateKey: "guia_interactiva_10a_guia2_html",
    },
    "grupo-10b-guia-01-induccion.html": {
      mode: "custom-checks",
      total: 10,
      pageKey: "10b_guia",
      dataKey: "10b_guia:checks",
      dataPrefix: "10b_guia:",
      legacyDataPrefixes: ["grupo-10b-guia-01-induccion:"],
    },
    "grupo-10b-guia-02-herramientas-informaticas-digitales.html": {
      mode: "state-with-activity",
      total: 111,
      activityTotal: 4,
      pageKey: "10b_guia2",
      stateKey: "guia_interactiva_10b_guia2_html",
    },
    "grupo-11a-guia-05-herramientas-informaticas-digitales.html": {
      mode: "state-with-activity",
      total: 111,
      activityTotal: 4,
      pageKey: "11a_guia",
      stateKey: "guia_interactiva_11a_guia_html",
    },
    "grupo-11b-guia-05-herramientas-informaticas-digitales.html": {
      mode: "state-with-activity",
      total: 111,
      activityTotal: 4,
      pageKey: "11b_guia",
      stateKey: "guia_interactiva_11b_guia_html",
    },
    "grupo-11a-guia-06-planificar-informacion.html": {
      mode: "state-with-activity",
      total: 105,
      activityTotal: 7,
      pageKey: "11a_guia6",
      stateKey: "guia_interactiva_11a_guia6_html",
    },
    "grupo-11b-guia-06-planificar-informacion.html": {
      mode: "state-with-activity",
      total: 105,
      activityTotal: 7,
      pageKey: "11b_guia6",
      stateKey: "guia_interactiva_11b_guia6_html",
    },
  };

  const FICHA_MAP = {
    "3441939": {
      inst: "Institucion Educativa Jhon F. Kennedy",
      grupo: "10A",
      guias: [
        "grupo-10a-guia-01-induccion.html",
        "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
      ],
    },
    "3441942": {
      inst: "Institucion Educativa Jhon F. Kennedy",
      grupo: "10B",
      guias: [
        "grupo-10b-guia-01-induccion.html",
        "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
      ],
    },
    "3441944": {
      inst: "Institucion Educativa Santa Barbara",
      grupo: "10A",
      guias: ["grupo-10a-guia-01-induccion.html", "santa-barbara-10a-guia-02-redes-rap01.html"],
    },
    "3441950": {
      inst: "Institucion Educativa Santa Barbara",
      grupo: "10B",
      guias: ["grupo-10b-guia-01-induccion.html", "santa-barbara-10b-guia-02-redes-rap01.html"],
    },
    "3168850": {
      inst: "Institucion Educativa Santa Barbara",
      grupo: "11A",
      guias: ["grupo-11a-guia-05-herramientas-informaticas-digitales.html", "grupo-11a-guia-06-planificar-informacion.html"],
    },
    "3168852": {
      inst: "Institucion Educativa Santa Barbara",
      grupo: "11B",
      guias: ["grupo-11b-guia-05-herramientas-informaticas-digitales.html", "grupo-11b-guia-06-planificar-informacion.html"],
    },
  };

  const FILE_ACCESS = Object.keys(FICHA_MAP).reduce((accumulator, ficha) => {
    (FICHA_MAP[ficha].guias || []).forEach((file) => {
      if (!accumulator[file]) {
        accumulator[file] = [];
      }
      accumulator[file].push(ficha);
    });
    return accumulator;
  }, {});

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeFicha(value) {
    return normalizeText(value).replace(/\D+/g, "");
  }

  function normalizeUsername(value) {
    return normalizeText(value).toLowerCase();
  }

  function sanitizeScopePart(value) {
    return (
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "app"
    );
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  function buildScopedStorageKey(scope, key, options) {
    const area = sanitizeScopePart(options?.area || "app");
    return `${STORAGE_PREFIX}:${scope}:${area}:${key}`;
  }

  function getStudentScope(usernameKey) {
    return `student:${sanitizeScopePart(usernameKey)}`;
  }

  function getStudentStorageKey(usernameKey, key, options) {
    return buildScopedStorageKey(getStudentScope(usernameKey), key, options);
  }

  function listScopedStorage(scope, options) {
    const area = sanitizeScopePart(options?.area || "app");
    const keyPrefix = options?.keyPrefix || "";
    const prefix = `${STORAGE_PREFIX}:${scope}:${area}:${keyPrefix}`;
    const entries = [];

    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf(prefix) !== 0) {
        return;
      }

      entries.push({
        key,
        value: localStorage.getItem(key),
      });
    });

    return entries;
  }

  function listStudentScopedStorage(usernameKey, options) {
    return listScopedStorage(getStudentScope(usernameKey), options);
  }

  function removeStudentScopedStorageByPrefix(usernameKey, keyPrefix, options) {
    listStudentScopedStorage(usernameKey, {
      area: options?.area,
      keyPrefix,
    }).forEach((entry) => {
      localStorage.removeItem(entry.key);
    });
  }

  function removeUnscopedStorageByPrefix(keyPrefix) {
    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf(keyPrefix) === 0) {
        localStorage.removeItem(key);
      }
    });
  }

  function getUsers() {
    const users = readJson(USERS_KEY, []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    writeJson(USERS_KEY, users);
  }

  function listStudents() {
    return getUsers()
      .slice()
      .sort((left, right) => left.fullName.localeCompare(right.fullName, "es"));
  }

  function getStudentByUsernameKey(usernameKey) {
    const key = normalizeUsername(usernameKey);
    return getUsers().find((item) => item.usernameKey === key) || null;
  }

  function getAdminProfile() {
    return {
      role: "admin",
      fullName: ADMIN_PROFILE.fullName,
      username: ADMIN_PROFILE.username,
      usernameKey: ADMIN_PROFILE.usernameKey,
    };
  }

  function getFichaInfo(ficha) {
    return FICHA_MAP[normalizeFicha(ficha)] || null;
  }

  function getGuideTitle(fileName) {
    return GUIDE_TITLES[fileName] || fileName;
  }

  function getGuidesForFicha(ficha) {
    return (getFichaInfo(ficha)?.guias || []).slice();
  }

  function getSelectionForFicha(ficha) {
    const info = getFichaInfo(ficha);
    if (!info) {
      return { ficha: normalizeFicha(ficha), inst: "", grupo: "" };
    }
    return {
      ficha: normalizeFicha(ficha),
      inst: info.inst,
      grupo: info.grupo,
    };
  }

  function applySelection(selection) {
    if (selection?.ficha) {
      localStorage.setItem("sena_ficha", selection.ficha);
    } else {
      localStorage.removeItem("sena_ficha");
    }

    if (selection?.inst) {
      localStorage.setItem("sena_inst", selection.inst);
    } else {
      localStorage.removeItem("sena_inst");
    }

    if (selection?.grupo) {
      localStorage.setItem("sena_grupo", selection.grupo);
    } else {
      localStorage.removeItem("sena_grupo");
    }
  }

  function clearSelection() {
    applySelection({ ficha: "", inst: "", grupo: "" });
  }

  function getSessionRecord() {
    const session = readJson(SESSION_KEY, null);
    if (!session || typeof session !== "object") {
      return null;
    }
    return session;
  }

  function getCurrentSession() {
    const session = getSessionRecord();
    if (!session) {
      return null;
    }

    if (session.role === "student") {
      const user = getStudentByUsernameKey(session.usernameKey);
      if (!user) {
        writeJson(SESSION_KEY, null);
        clearSelection();
        return null;
      }

      const hydrated = {
        role: "student",
        user,
        usernameKey: user.usernameKey,
        loggedAt: session.loggedAt || "",
      };
      applySelection(getSelectionForFicha(user.ficha));
      return hydrated;
    }

    if (session.role === "admin") {
      return {
        role: "admin",
        user: getAdminProfile(),
        usernameKey: ADMIN_PROFILE.usernameKey,
        loggedAt: session.loggedAt || "",
      };
    }

    return null;
  }

  function persistSession(session) {
    if (!session) {
      writeJson(SESSION_KEY, null);
      clearSelection();
      return;
    }

    if (session.role === "student" && session.usernameKey) {
      writeJson(SESSION_KEY, {
        role: "student",
        usernameKey: session.usernameKey,
        loggedAt: session.loggedAt || new Date().toISOString(),
      });
      const user = getStudentByUsernameKey(session.usernameKey);
      if (user) {
        applySelection(getSelectionForFicha(user.ficha));
      }
      return;
    }

    if (session.role === "admin") {
      clearSelection();
      writeJson(SESSION_KEY, {
        role: "admin",
        usernameKey: ADMIN_PROFILE.usernameKey,
        loggedAt: session.loggedAt || new Date().toISOString(),
      });
    }
  }

  function getCurrentUser() {
    const session = getCurrentSession();
    return session?.role === "student" ? session.user : null;
  }

  function isStudentSession() {
    return getCurrentSession()?.role === "student";
  }

  function isAdminSession() {
    return getCurrentSession()?.role === "admin";
  }

  function getCurrentSelection(defaults) {
    const normalizedDefaults = defaults || {};
    const session = getCurrentSession();
    if (session?.role === "student") {
      return {
        ...normalizedDefaults,
        ...getSelectionForFicha(session.user.ficha),
      };
    }

    return {
      ficha: localStorage.getItem("sena_ficha") || normalizedDefaults.ficha || "",
      inst: localStorage.getItem("sena_inst") || normalizedDefaults.inst || "",
      grupo: localStorage.getItem("sena_grupo") || normalizedDefaults.grupo || "",
    };
  }

  function getAccessibleGuideFiles() {
    const session = getCurrentSession();
    if (!session) {
      return [];
    }

    if (session.role === "admin") {
      return Object.keys(FILE_ACCESS);
    }

    return getGuidesForFicha(session.user.ficha);
  }

  function canAccessFile(fileName) {
    const session = getCurrentSession();
    if (!session) {
      return false;
    }

    if (session.role === "admin") {
      return true;
    }

    return getGuidesForFicha(session.user.ficha).includes(fileName);
  }

  function logout() {
    persistSession(null);
  }

  function setFlashMessage(message, type) {
    const text = normalizeText(message);
    if (!text) {
      localStorage.removeItem(FLASH_KEY);
      return;
    }

    writeJson(FLASH_KEY, {
      message: text,
      type: normalizeText(type) || "info",
      createdAt: new Date().toISOString(),
    });
  }

  function consumeFlashMessage() {
    const flash = readJson(FLASH_KEY, null);
    localStorage.removeItem(FLASH_KEY);
    return flash;
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256Fallback(value) {
    let normalized = String(value || "");
    normalized = unescape(encodeURIComponent(normalized));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const words = [];
    const bitLength = normalized.length * 8;
    let result = "";
    let hashSeed = sha256Fallback.hashCache;
    let k = sha256Fallback.kCache;

    if (!hashSeed || !k) {
      hashSeed = [];
      k = [];
      const isComposite = {};
      let candidate = 2;

      while (k.length < 64) {
        if (!isComposite[candidate]) {
          for (let multiple = candidate * candidate; multiple < 312; multiple += candidate) {
            isComposite[multiple] = true;
          }

          hashSeed.push((mathPow(candidate, 0.5) * maxWord) | 0);
          k.push((mathPow(candidate, 1 / 3) * maxWord) | 0);
        }

        candidate += 1;
      }

      sha256Fallback.hashCache = hashSeed.slice();
      sha256Fallback.kCache = k;
    }

    const hash = hashSeed.slice();

    normalized += "\x80";
    while ((normalized.length % 64) !== 56) {
      normalized += "\x00";
    }

    for (let index = 0; index < normalized.length; index += 1) {
      const code = normalized.charCodeAt(index);
      words[index >> 2] |= code << ((3 - (index % 4)) * 8);
    }

    words[words.length] = (bitLength / maxWord) | 0;
    words[words.length] = bitLength;

    for (let offset = 0; offset < words.length; ) {
      const schedule = words.slice(offset, (offset += 16));
      const workingHash = hash.slice(0, 8);

      for (let round = 0; round < 64; round += 1) {
        const word15 = schedule[round - 15];
        const word2 = schedule[round - 2];

        if (round >= 16) {
          const sigma0 =
            rightRotate(word15, 7) ^
            rightRotate(word15, 18) ^
            (word15 >>> 3);
          const sigma1 =
            rightRotate(word2, 17) ^
            rightRotate(word2, 19) ^
            (word2 >>> 10);

          schedule[round] =
            (schedule[round - 16] + sigma0 + schedule[round - 7] + sigma1) | 0;
        }

        const temp1 =
          workingHash[7] +
          (rightRotate(workingHash[4], 6) ^
            rightRotate(workingHash[4], 11) ^
            rightRotate(workingHash[4], 25)) +
          ((workingHash[4] & workingHash[5]) ^
            (~workingHash[4] & workingHash[6])) +
          k[round] +
          (schedule[round] | 0);
        const temp2 =
          (rightRotate(workingHash[0], 2) ^
            rightRotate(workingHash[0], 13) ^
            rightRotate(workingHash[0], 22)) +
          ((workingHash[0] & workingHash[1]) ^
            (workingHash[0] & workingHash[2]) ^
            (workingHash[1] & workingHash[2]));

        workingHash.unshift((temp1 + temp2) | 0);
        workingHash[4] = (workingHash[4] + temp1) | 0;
        workingHash.pop();
      }

      for (let index = 0; index < 8; index += 1) {
        hash[index] = (hash[index] + workingHash[index]) | 0;
      }
    }

    for (let index = 0; index < 8; index += 1) {
      for (let shift = 3; shift >= 0; shift -= 1) {
        const byte = (hash[index] >> (shift * 8)) & 255;
        result += byte.toString(16).padStart(2, "0");
      }
    }

    return result;
  }

  async function hashSecret(secret) {
    const value = normalizeText(secret);
    if (!value) {
      return "";
    }

    if (window.crypto?.subtle && window.TextEncoder) {
      const buffer = new TextEncoder().encode(value);
      const digest = await window.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((chunk) => chunk.toString(16).padStart(2, "0"))
        .join("");
    }

    return sha256Fallback(value);
  }

  async function verifySecret(secret, storedHash) {
    const value = normalizeText(secret);
    const normalizedStoredHash = normalizeText(storedHash);
    if (!value || !normalizedStoredHash) {
      return { ok: false, hash: "", migrated: false };
    }

    const computedHash = await hashSecret(value);
    if (normalizedStoredHash === computedHash) {
      return { ok: true, hash: computedHash, migrated: false };
    }

    if (normalizedStoredHash === `plain:${value}`) {
      return { ok: true, hash: computedHash, migrated: true };
    }

    return { ok: false, hash: computedHash, migrated: false };
  }

  function buildProgressResult(fileName, completed, total, source, updatedAt) {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeCompleted = clampNumber(Math.max(0, Number(completed) || 0), 0, safeTotal || 0);
    const percent = safeTotal ? Math.round((safeCompleted / safeTotal) * 100) : 0;

    return {
      fileName,
      title: auth.getGuideTitle(fileName),
      completed: safeCompleted,
      total: safeTotal,
      percent,
      updatedAt: updatedAt || "",
      source: typeof source === "string" ? source : "meta",
    };
  }

  function isMeaningfulValue(value) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return !Number.isNaN(value);
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return normalizeText(value).length > 0;
  }

  function countMeaningfulValues(record) {
    if (!record || typeof record !== "object") {
      return 0;
    }
    return Object.values(record).filter((value) => isMeaningfulValue(value)).length;
  }

  function readGuideProgressMetaLocal(usernameKey, fileName) {
    return readJson(
      getStudentStorageKeyLocal(usernameKey, getGuideProgressMetaKey(fileName), {
        area: "guide-meta",
      }),
      null
    );
  }

  function computeGuideProgressFallbackLocal(usernameKey, fileName) {
    const config = auth.GUIDE_PROGRESS_CONFIG[fileName];
    if (!config) {
      return buildProgressResult(fileName, 0, 0, "fallback", "");
    }

    if (config.mode === "custom-checks") {
      const checks = readJson(
        getStudentStorageKeyLocal(usernameKey, config.dataKey, { area: "guide-data" }),
        {}
      );
      return buildProgressResult(
        fileName,
        countMeaningfulValues(checks),
        config.total,
        "fallback",
        ""
      );
    }

    if (config.mode === "state-with-activity") {
      const state = readJson(
        getStudentStorageKeyLocal(usernameKey, config.stateKey, { area: "guide-data" }),
        {}
      );
      const fieldTotal = Math.max(0, config.total - config.activityTotal);
      const fieldCompleted = Math.min(countMeaningfulValues(state), fieldTotal);
      const activityCompleted = listStudentScopedStorage(usernameKey, {
        area: "guide-ui",
        keyPrefix: `${config.pageKey}:activity_seen:`,
      }).filter((entry) => entry.value === "1").length;

      return buildProgressResult(
        fileName,
        fieldCompleted + Math.min(activityCompleted, config.activityTotal),
        config.total,
        "fallback",
        ""
      );
    }

    return buildProgressResult(fileName, 0, 0, "fallback", "");
  }

  function getStudentGuideProgressLocal(usernameKey, fileName) {
    const meta = readGuideProgressMetaLocal(usernameKey, fileName);
    if (meta && typeof meta === "object") {
      return buildProgressResult(
        fileName,
        meta.completed,
        meta.total,
        "meta",
        meta.updatedAt || ""
      );
    }
    return computeGuideProgressFallbackLocal(usernameKey, fileName);
  }

  function getStudentGuideSummariesLocal(usernameKey) {
    const user = getLocalUser(usernameKey);
    if (!user) {
      return [];
    }
    return auth.getGuidesForFicha(user.ficha).map((fileName) =>
      getStudentGuideProgressLocal(user.usernameKey, fileName)
    );
  }

  function getStudentsWithProgressLocal() {
    return sortUsers(getLocalUsers()).map((user) => {
      const guides = auth.getGuidesForFicha(user.ficha).map((fileName) =>
        getStudentGuideProgressLocal(user.usernameKey, fileName)
      );
      const completed = guides.reduce((sum, item) => sum + item.completed, 0);
      const total = guides.reduce((sum, item) => sum + item.total, 0);
      return {
        ...sanitizeUser(user),
        progress: {
          guides,
          completed,
          total,
          percent: total ? Math.round((completed / total) * 100) : 0,
        },
      };
    });
  }

  async function verifySecret(secret, storedHash) {
    const value = normalizeText(secret);
    const normalizedStoredHash = normalizeText(storedHash);
    if (!value || !normalizedStoredHash) {
      return {
        ok: false,
        hash: "",
        migrated: false,
      };
    }

    const computedHash = await hashSecret(value);
    if (normalizedStoredHash === computedHash) {
      return {
        ok: true,
        hash: computedHash,
        migrated: false,
      };
    }

    if (normalizedStoredHash === `plain:${value}`) {
      return {
        ok: true,
        hash: computedHash,
        migrated: computedHash !== normalizedStoredHash,
      };
    }

    return {
      ok: false,
      hash: computedHash,
      migrated: false,
    };
  }

  function validateStudentPayload(data) {
    const fullName = normalizeText(data?.fullName);
    const username = normalizeText(data?.username);
    const usernameKey = normalizeUsername(data?.username);
    const ficha = normalizeFicha(data?.ficha);
    const password = normalizeText(data?.password);

    if (fullName.length < 6) {
      return { ok: false, message: "Ingresa el nombre completo del aprendiz." };
    }

    if (!/^[a-z0-9._-]{3,30}$/i.test(username)) {
      return {
        ok: false,
        message:
          "El nombre de usuario debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo.",
      };
    }

    if (usernameKey === ADMIN_PROFILE.usernameKey) {
      return {
        ok: false,
        message: "Ese nombre de usuario esta reservado para el administrador.",
      };
    }

    if (!getFichaInfo(ficha)) {
      return {
        ok: false,
        message: "La ficha no existe en el portal. Verifica el numero e intenta de nuevo.",
      };
    }

    if (password.length < 4) {
      return {
        ok: false,
        message: "La contrase\u00f1a debe tener al menos 4 caracteres.",
      };
    }

    return {
      ok: true,
      fullName,
      username,
      usernameKey,
      ficha,
      password,
    };
  }

  async function registerStudent(data) {
    const validation = validateStudentPayload(data);
    if (!validation.ok) {
      return validation;
    }

    const users = getUsers();
    if (users.some((item) => item.usernameKey === validation.usernameKey)) {
      return {
        ok: false,
        message: "Ese nombre de usuario ya existe. Usa otro diferente.",
      };
    }

    const selection = getSelectionForFicha(validation.ficha);
    const user = {
      id: `student_${Date.now()}`,
      fullName: validation.fullName,
      username: validation.username,
      usernameKey: validation.usernameKey,
      ficha: validation.ficha,
      inst: selection.inst,
      grupo: selection.grupo,
      passwordHash: await hashSecret(validation.password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    users.push(user);
    saveUsers(users);
    persistSession({
      role: "student",
      usernameKey: user.usernameKey,
      loggedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      user,
    };
  }

  async function loginStudent(data) {
    const usernameKey = normalizeUsername(data?.username);
    const password = normalizeText(data?.password);

    if (!usernameKey || !password) {
      return {
        ok: false,
        message: "Ingresa el nombre de usuario y la contrase\u00f1a.",
      };
    }

    const user = getStudentByUsernameKey(usernameKey);
    if (!user) {
      return {
        ok: false,
        message: "No existe un usuario registrado con ese nombre.",
      };
    }

    const verification = await verifySecret(password, user.passwordHash);
    if (!verification.ok) {
      return {
        ok: false,
        message: "La contrase\u00f1a no es correcta.",
      };
    }

    if (verification.migrated) {
      const users = getUsers();
      const index = users.findIndex((item) => item.usernameKey === usernameKey);
      if (index >= 0) {
        users[index] = {
          ...users[index],
          passwordHash: verification.hash,
          updatedAt: new Date().toISOString(),
        };
        saveUsers(users);
      }
    }

    persistSession({
      role: "student",
      usernameKey,
      loggedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      user,
    };
  }

  function isLocalAdminContext() {
    const protocol = String(window.location.protocol || "").toLowerCase();
    const hostname = String(window.location.hostname || "").toLowerCase();
    return (
      protocol === "file:" ||
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  }

  function isAdminConfigured() {
    return true;
  }

  async function configureAdmin(data) {
    return loginAdmin(data);
  }

  async function loginAdmin(data) {
    const username =
      typeof data === "string" ? ADMIN_PROFILE.username : normalizeText(data?.username);
    const usernameKey = normalizeUsername(username);
    const password =
      typeof data === "string" ? normalizeText(data) : normalizeText(data?.password);

    if (!usernameKey || !password) {
      return {
        ok: false,
        message: "Ingresa el usuario y la contrase\u00f1a del administrador.",
      };
    }

    if (usernameKey !== ADMIN_PROFILE.usernameKey) {
      return {
        ok: false,
        message: "El usuario administrador no existe.",
      };
    }

    const verification = await verifySecret(password, ADMIN_PROFILE.passwordHash);
    if (!verification.ok) {
      return {
        ok: false,
        message: "La contrase\u00f1a del administrador no es correcta.",
      };
    }

    persistSession({
      role: "admin",
      loggedAt: new Date().toISOString(),
    });

    return {
      ok: true,
      admin: getAdminProfile(),
    };
  }

  function getScopedStorageKey(key, options) {
    const session = getCurrentSession();
    let scope = "anon";

    if (session?.role === "student" && session.user?.usernameKey) {
      scope = getStudentScope(session.user.usernameKey);
    } else if (session?.role === "admin") {
      scope = "admin";
    }

    return buildScopedStorageKey(scope, key, options);
  }

  function clearScopedStorageByPrefix(prefix, options) {
    const targetPrefix = getScopedStorageKey(prefix, options);
    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf(targetPrefix) === 0) {
        localStorage.removeItem(key);
      }
    });
  }

  function shouldBypassAccessGuardsForLocalPreview() {
    return /^file:$/i.test(String(window.location.protocol || ""));
  }

  function requireFileAccess(fileName, options) {
    if (shouldBypassAccessGuardsForLocalPreview()) {
      return true;
    }

    if (canAccessFile(fileName)) {
      return true;
    }

    if (options?.redirect !== false) {
      setFlashMessage(
          "Debes iniciar sesi\u00f3n con un usuario autorizado para abrir esa gu\u00eda.",
        "warn"
      );
      window.location.replace(options?.redirectUrl || "index.html");
    }

    return false;
  }

  function requireAdminAccess(options) {
    if (shouldBypassAccessGuardsForLocalPreview()) {
      return true;
    }

    if (isAdminSession()) {
      return true;
    }

    if (options?.redirect !== false) {
      setFlashMessage(
        "Este modulo solo esta disponible para el administrador.",
        "warn"
      );
      window.location.replace(options?.redirectUrl || "index.html");
    }

    return false;
  }

  function isMeaningfulValue(value) {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return !Number.isNaN(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return normalizeText(value).length > 0;
  }

  function countMeaningfulValues(record) {
    if (!record || typeof record !== "object") {
      return 0;
    }

    return Object.values(record).filter((value) => isMeaningfulValue(value)).length;
  }

  function buildProgressResult(fileName, completed, total, source, updatedAt) {
    const safeTotal = Math.max(0, Number(total) || 0);
    const safeCompleted = clampNumber(Math.max(0, Number(completed) || 0), 0, safeTotal || 0);
    const percent = safeTotal ? Math.round((safeCompleted / safeTotal) * 100) : 0;

    return {
      fileName,
      title: getGuideTitle(fileName),
      completed: safeCompleted,
      total: safeTotal,
      percent,
      updatedAt: updatedAt || "",
      source: typeof source === "string" ? source : "meta",
    };
  }

  function getGuideProgressMetaKey(fileName) {
    return `progress:${fileName}`;
  }

  function writeGuideProgress(fileName, progress) {
    const session = getCurrentSession();
    if (session?.role !== "student" || !fileName) {
      return;
    }

    const total = Math.max(0, Number(progress?.total) || 0);
    const completed = clampNumber(Math.max(0, Number(progress?.completed) || 0), 0, total || 0);
    const percent = total
      ? Math.round((completed / total) * 100)
      : clampNumber(Math.round(Number(progress?.percent) || 0), 0, 100);

    writeJson(
      getStudentStorageKey(session.user.usernameKey, getGuideProgressMetaKey(fileName), {
        area: "guide-meta",
      }),
      {
        fileName,
        total,
        completed,
        percent,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  function readGuideProgressMeta(usernameKey, fileName) {
    return readJson(
      getStudentStorageKey(usernameKey, getGuideProgressMetaKey(fileName), {
        area: "guide-meta",
      }),
      null
    );
  }

  function computeGuideProgressFallback(usernameKey, fileName) {
    const config = GUIDE_PROGRESS_CONFIG[fileName];
    if (!config) {
      return buildProgressResult(fileName, 0, 0, "fallback", "");
    }

    if (config.mode === "custom-checks") {
      const checks = readJson(
        getStudentStorageKey(usernameKey, config.dataKey, { area: "guide-data" }),
        {}
      );
      const completed = countMeaningfulValues(checks);
      return buildProgressResult(fileName, completed, config.total, "fallback", "");
    }

    if (config.mode === "state-with-activity") {
      const state = readJson(
        getStudentStorageKey(usernameKey, config.stateKey, { area: "guide-data" }),
        {}
      );
      const fieldTotal = Math.max(0, config.total - config.activityTotal);
      const fieldCompleted = Math.min(countMeaningfulValues(state), fieldTotal);
      const activityCompleted = listStudentScopedStorage(usernameKey, {
        area: "guide-ui",
        keyPrefix: `${config.pageKey}:activity_seen:`,
      }).filter((entry) => entry.value === "1").length;

      return buildProgressResult(
        fileName,
        fieldCompleted + Math.min(activityCompleted, config.activityTotal),
        config.total,
        "fallback",
        ""
      );
    }

    return buildProgressResult(fileName, 0, 0, "fallback", "");
  }

  function getStudentGuideProgress(usernameKey, fileName) {
    const meta = readGuideProgressMeta(usernameKey, fileName);
    if (meta && typeof meta === "object") {
      return buildProgressResult(
        fileName,
        meta.completed,
        meta.total,
        "meta",
        meta.updatedAt || ""
      );
    }

    return computeGuideProgressFallback(usernameKey, fileName);
  }

  function getStudentGuideSummaries(usernameKey) {
    const user = getStudentByUsernameKey(usernameKey);
    if (!user) {
      return [];
    }

    return getGuidesForFicha(user.ficha).map((fileName) =>
      getStudentGuideProgress(user.usernameKey, fileName)
    );
  }

  function getUserScopedProgressSummary(user) {
    const guides = getGuidesForFicha(user.ficha);
    const summaries = guides.map((fileName) => getStudentGuideProgress(user.usernameKey, fileName));
    const totalCompleted = summaries.reduce((sum, item) => sum + item.completed, 0);
    const totalTrackers = summaries.reduce((sum, item) => sum + item.total, 0);
    const percent = totalTrackers ? Math.round((totalCompleted / totalTrackers) * 100) : 0;

    return {
      guides: summaries,
      completed: totalCompleted,
      total: totalTrackers,
      percent,
    };
  }

  function getStudentsWithProgress() {
    return listStudents().map((user) => ({
      ...user,
      progress: getUserScopedProgressSummary(user),
    }));
  }

  async function updateStudentPassword(usernameKey, newPassword) {
    if (!isAdminSession()) {
      return {
        ok: false,
        message: "Solo el administrador puede cambiar contrase\u00f1as.",
      };
    }

    const normalizedKey = normalizeUsername(usernameKey);
    const cleanPassword = normalizeText(newPassword);
    if (!cleanPassword || cleanPassword.length < 4) {
      return {
        ok: false,
        message: "La nueva contrase\u00f1a debe tener al menos 4 caracteres.",
      };
    }

    const users = getUsers();
    const index = users.findIndex((item) => item.usernameKey === normalizedKey);
    if (index === -1) {
      return {
        ok: false,
        message: "No se encontro el usuario solicitado.",
      };
    }

    users[index] = {
      ...users[index],
      passwordHash: await hashSecret(cleanPassword),
      updatedAt: new Date().toISOString(),
    };
    saveUsers(users);

    return {
      ok: true,
      user: users[index],
    };
  }

  function updateStudentFicha(usernameKey, newFicha) {
    if (!isAdminSession()) {
      return {
        ok: false,
        message: "Solo el administrador puede corregir fichas.",
      };
    }

    const normalizedKey = normalizeUsername(usernameKey);
    const cleanFicha = normalizeFicha(newFicha);
    const selection = getSelectionForFicha(cleanFicha);
    if (!getFichaInfo(cleanFicha)) {
      return {
        ok: false,
        message: "La ficha seleccionada no existe en el portal.",
      };
    }

    const users = getUsers();
    const index = users.findIndex((item) => item.usernameKey === normalizedKey);
    if (index === -1) {
      return {
        ok: false,
        message: "No se encontro el usuario solicitado.",
      };
    }

    users[index] = {
      ...users[index],
      ficha: cleanFicha,
      inst: selection.inst,
      grupo: selection.grupo,
      updatedAt: new Date().toISOString(),
    };
    saveUsers(users);

    return {
      ok: true,
      user: users[index],
    };
  }

  function resetStudentGuideProgress(usernameKey, fileName) {
    if (!isAdminSession()) {
      return {
        ok: false,
        message: "Solo el administrador puede modificar avances.",
      };
    }

    const user = getStudentByUsernameKey(usernameKey);
    const config = GUIDE_PROGRESS_CONFIG[fileName];
    if (!user || !config) {
      return {
        ok: false,
        message: "No se encontr\u00f3 el usuario o la gu\u00eda solicitada.",
      };
    }

    if (config.mode === "custom-checks") {
      removeStudentScopedStorageByPrefix(user.usernameKey, config.dataPrefix, {
        area: "guide-data",
      });
      removeUnscopedStorageByPrefix(config.dataPrefix);
      (config.legacyDataPrefixes || []).forEach((prefix) => {
        removeUnscopedStorageByPrefix(prefix);
      });
    }

    if (config.mode === "state-with-activity") {
      localStorage.removeItem(
        getStudentStorageKey(user.usernameKey, config.stateKey, { area: "guide-data" })
      );
      localStorage.removeItem(config.stateKey);
      removeStudentScopedStorageByPrefix(user.usernameKey, `${config.pageKey}:`, {
        area: "guide-ui",
      });
    }

    localStorage.removeItem(
      getStudentStorageKey(user.usernameKey, getGuideProgressMetaKey(fileName), {
        area: "guide-meta",
      })
    );

    return {
      ok: true,
    };
  }

  function resetStudentAllProgress(usernameKey) {
    if (!isAdminSession()) {
      return {
        ok: false,
        message: "Solo el administrador puede modificar avances.",
      };
    }

    const user = getStudentByUsernameKey(usernameKey);
    if (!user) {
      return {
        ok: false,
        message: "No se encontro el usuario solicitado.",
      };
    }

    getGuidesForFicha(user.ficha).forEach((fileName) => {
      resetStudentGuideProgress(user.usernameKey, fileName);
    });

    return {
      ok: true,
    };
  }

window.portalAuth = {
    ADMIN_PROFILE: getAdminProfile(),
    GUIDE_TITLES,
    GUIDE_PROGRESS_CONFIG,
    FICHA_MAP,
    FILE_ACCESS,
    getUsers,
    listStudents,
    getStudentByUsernameKey,
    getStudentsWithProgress,
    getStudentGuideProgress,
    getStudentGuideSummaries,
    getGuideTitle,
    getGuidesForFicha,
    getSelectionForFicha,
    getFichaInfo,
    getAdminProfile,
    getCurrentSession,
    getCurrentUser,
    getCurrentSelection,
    getAccessibleGuideFiles,
    canAccessFile,
    logout,
    setFlashMessage,
    consumeFlashMessage,
    registerStudent,
    loginStudent,
    isLocalAdminContext,
    isAdminConfigured,
    configureAdmin,
    loginAdmin,
    isAdminSession,
    isStudentSession,
    getScopedStorageKey,
    getStudentStorageKey,
    clearScopedStorageByPrefix,
    requireFileAccess,
    requireAdminAccess,
    applySelection,
    clearSelection,
    writeGuideProgress,
    updateStudentPassword,
    updateStudentFicha,
    resetStudentGuideProgress,
    resetStudentAllProgress,
  };
})();

(function () {
  const auth = window.portalAuth;
  if (!auth) {
    return;
  }

  const STORAGE_PREFIX = "sena_portal";
  const USERS_KEY = `${STORAGE_PREFIX}_users_v1`;
  const SESSION_KEY = `${STORAGE_PREFIX}_session_v1`;
  const FLASH_KEY = `${STORAGE_PREFIX}_flash_v1`;
  const ADMIN_PASSWORD_HASH =
    "d7ee7806b5161383528f4256cceb048a6cd50c80783eb6425428f832916361a7";
  const PROGRESS_SYNC_DELAY = 900;
  const API_TIMEOUT_MS = 4500;

  const original = {
    writeGuideProgress: auth.writeGuideProgress,
    registerStudent: auth.registerStudent,
    loginStudent: auth.loginStudent,
    loginAdmin: auth.loginAdmin,
    updateStudentPassword: auth.updateStudentPassword,
    updateStudentFicha: auth.updateStudentFicha,
    resetStudentGuideProgress: auth.resetStudentGuideProgress,
    resetStudentAllProgress: auth.resetStudentAllProgress,
    getStudentsWithProgress: auth.getStudentsWithProgress,
  };
  const originalGetStudentGuideProgress = auth.getStudentGuideProgress;
  const originalGetStudentGuideSummaries = auth.getStudentGuideSummaries;

  let sharedStoreStatus = null;
  let sharedStorePromise = null;
  let migrationPromise = null;
  const progressTimers = new Map();

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeFicha(value) {
    return normalizeText(value).replace(/\D+/g, "");
  }

  function normalizeUsername(value) {
    return normalizeText(value).toLowerCase();
  }

  function sanitizeScopePart(value) {
    return (
      String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9:_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "app"
    );
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(value));
  }

  function buildScopedStorageKey(scope, key, options) {
    const area = sanitizeScopePart((options && options.area) || "app");
    return `${STORAGE_PREFIX}:${scope}:${area}:${key}`;
  }

  function getStudentScope(usernameKey) {
    return `student:${sanitizeScopePart(usernameKey)}`;
  }

  function getStudentStorageKeyLocal(usernameKey, key, options) {
    if (typeof auth.getStudentStorageKey === "function") {
      return auth.getStudentStorageKey(usernameKey, key, options);
    }
    return buildScopedStorageKey(getStudentScope(usernameKey), key, options);
  }

  function listScopedStorage(scope, options) {
    const area = sanitizeScopePart((options && options.area) || "app");
    const keyPrefix = (options && options.keyPrefix) || "";
    const prefix = `${STORAGE_PREFIX}:${scope}:${area}:${keyPrefix}`;
    const entries = [];

    Object.keys(localStorage).forEach((key) => {
      if (key.indexOf(prefix) !== 0) {
        return;
      }
      entries.push({
        key,
        value: localStorage.getItem(key),
      });
    });

    return entries;
  }

  function listStudentScopedStorage(usernameKey, options) {
    return listScopedStorage(getStudentScope(usernameKey), options);
  }

  function getGuideProgressMetaKey(fileName) {
    return `progress:${fileName}`;
  }

  function getLocalUsers() {
    const users = readJson(USERS_KEY, []);
    return Array.isArray(users) ? users : [];
  }

  function saveLocalUsers(users) {
    writeJson(USERS_KEY, Array.isArray(users) ? users : []);
  }

  function sortUsers(users) {
    return users
      .slice()
      .sort((left, right) =>
        String(left.fullName || "").localeCompare(String(right.fullName || ""), "es")
      );
  }

  function sanitizeUser(user) {
    if (!user || typeof user !== "object") {
      return null;
    }

    return {
      id: normalizeText(user.id),
      fullName: normalizeText(user.fullName),
      username: normalizeText(user.username),
      usernameKey: normalizeUsername(user.usernameKey || user.username),
      ficha: normalizeFicha(user.ficha),
      inst: normalizeText(user.inst),
      grupo: normalizeText(user.grupo),
      createdAt: normalizeText(user.createdAt),
      updatedAt: normalizeText(user.updatedAt),
      passwordHash: normalizeText(user.passwordHash),
    };
  }

  function upsertLocalUser(user, options) {
    const incoming = sanitizeUser(user);
    if (!incoming || !incoming.usernameKey) {
      return null;
    }

    const preservePasswordHash = Boolean(options && options.preservePasswordHash);
    const users = getLocalUsers();
    const index = users.findIndex((item) => item.usernameKey === incoming.usernameKey);

    if (index === -1) {
      users.push(incoming);
      saveLocalUsers(users);
      return incoming;
    }

    const current = sanitizeUser(users[index]) || {};
    users[index] = {
      ...current,
      ...incoming,
      passwordHash:
        incoming.passwordHash ||
        (preservePasswordHash ? current.passwordHash || "" : current.passwordHash || ""),
    };
    saveLocalUsers(users);
    return users[index];
  }

  function getLocalUser(usernameKey) {
    const normalized = normalizeUsername(usernameKey);
    return getLocalUsers().find((item) => item.usernameKey === normalized) || null;
  }

  function getSessionRecord() {
    const session = readJson(SESSION_KEY, null);
    return session && typeof session === "object" ? session : null;
  }

  function persistSessionRecord(session) {
    if (!session) {
      writeJson(SESSION_KEY, null);
      auth.clearSelection();
      return;
    }

    if (session.role === "student" && session.user) {
      const safeUser = sanitizeUser(session.user);
      writeJson(SESSION_KEY, {
        role: "student",
        usernameKey: safeUser.usernameKey,
        user: safeUser,
        token: normalizeText(session.token),
        loggedAt: normalizeText(session.loggedAt) || new Date().toISOString(),
      });
      auth.applySelection(auth.getSelectionForFicha(safeUser.ficha));
      return;
    }

    if (session.role === "admin") {
      auth.clearSelection();
      writeJson(SESSION_KEY, {
        role: "admin",
        token: normalizeText(session.token),
        loggedAt: normalizeText(session.loggedAt) || new Date().toISOString(),
      });
    }
  }

  function getCurrentSessionPatched() {
    const record = getSessionRecord();
    if (!record) {
      return null;
    }

    if (record.role === "student") {
      const localUser = getLocalUser(record.usernameKey);
      const fallbackUser = sanitizeUser(record.user);
      const user = sanitizeUser(localUser || fallbackUser);
      if (!user) {
        persistSessionRecord(null);
        return null;
      }

      if (fallbackUser && !localUser) {
        upsertLocalUser(fallbackUser, { preservePasswordHash: true });
      }

      auth.applySelection(auth.getSelectionForFicha(user.ficha));
      return {
        role: "student",
        user,
        usernameKey: user.usernameKey,
        token: normalizeText(record.token),
        loggedAt: normalizeText(record.loggedAt),
      };
    }

    if (record.role === "admin") {
      return {
        role: "admin",
        user: auth.getAdminProfile(),
        usernameKey: auth.ADMIN_PROFILE.usernameKey,
        token: normalizeText(record.token),
        loggedAt: normalizeText(record.loggedAt),
      };
    }

    return null;
  }

  function isHttpContext() {
    return /^https?:$/i.test(String(window.location.protocol || ""));
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortController === "undefined") {
      return fetch(url, options);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
      window.clearTimeout(timer);
    });
  }

  async function apiRequest(path, options) {
    const settings = options || {};
    const headers = {
      Accept: "application/json",
      ...(settings.headers || {}),
    };
    const requestOptions = {
      method: settings.method || "GET",
      cache: "no-store",
      headers,
    };

    if (settings.body !== undefined) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      requestOptions.body = JSON.stringify(settings.body);
    }

    if (settings.token) {
      headers["X-Portal-Token"] = settings.token;
    }

    const url = new URL(path, window.location.origin);
    if (settings.cacheBust !== false) {
      url.searchParams.set("_", String(Date.now()));
    }

    const response = await fetchWithTimeout(url.toString(), requestOptions, settings.timeoutMs || API_TIMEOUT_MS);
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }

    if (!response.ok) {
      const message =
        normalizeText(payload.message) || `No fue posible completar la solicitud (${response.status}).`;
      return { ok: false, message, status: response.status, payload };
    }

    return payload && typeof payload === "object"
      ? { ok: payload.ok !== false, ...payload, status: response.status }
      : { ok: true, status: response.status };
  }

  async function getSharedStoreStatus(force) {
    if (!isHttpContext()) {
      return { available: false, reason: "file-context" };
    }

    if (!force && sharedStoreStatus) {
      return sharedStoreStatus;
    }

    if (!force && sharedStorePromise) {
      return sharedStorePromise;
    }

    sharedStorePromise = apiRequest("/api/portal/capabilities", {
      method: "GET",
      timeoutMs: 2500,
    })
      .then((result) => {
        sharedStoreStatus = {
          available: Boolean(result && result.ok && result.sharedStore),
          source: result && result.ok ? "network" : "local",
          checkedAt: new Date().toISOString(),
        };
        return sharedStoreStatus;
      })
      .catch(() => {
        sharedStoreStatus = {
          available: false,
          source: "local",
          checkedAt: new Date().toISOString(),
        };
        return sharedStoreStatus;
      })
      .finally(() => {
        sharedStorePromise = null;
      });

    return sharedStorePromise;
  }

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256Fallback(value) {
    let normalized = String(value || "");
    normalized = unescape(encodeURIComponent(normalized));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const words = [];
    const bitLength = normalized.length * 8;
    let result = "";
    let hashSeed = sha256Fallback.hashCache;
    let k = sha256Fallback.kCache;

    if (!hashSeed || !k) {
      hashSeed = [];
      k = [];
      const isComposite = {};
      let candidate = 2;

      while (k.length < 64) {
        if (!isComposite[candidate]) {
          for (let multiple = candidate * candidate; multiple < 312; multiple += candidate) {
            isComposite[multiple] = true;
          }

          hashSeed.push((mathPow(candidate, 0.5) * maxWord) | 0);
          k.push((mathPow(candidate, 1 / 3) * maxWord) | 0);
        }

        candidate += 1;
      }

      sha256Fallback.hashCache = hashSeed.slice();
      sha256Fallback.kCache = k;
    }

    const hash = hashSeed.slice();

    normalized += "\x80";
    while ((normalized.length % 64) !== 56) {
      normalized += "\x00";
    }

    for (let index = 0; index < normalized.length; index += 1) {
      const code = normalized.charCodeAt(index);
      words[index >> 2] |= code << ((3 - (index % 4)) * 8);
    }

    words[words.length] = (bitLength / maxWord) | 0;
    words[words.length] = bitLength;

    for (let offset = 0; offset < words.length; ) {
      const schedule = words.slice(offset, (offset += 16));
      const workingHash = hash.slice(0, 8);

      for (let round = 0; round < 64; round += 1) {
        const word15 = schedule[round - 15];
        const word2 = schedule[round - 2];

        if (round >= 16) {
          const sigma0 =
            rightRotate(word15, 7) ^
            rightRotate(word15, 18) ^
            (word15 >>> 3);
          const sigma1 =
            rightRotate(word2, 17) ^
            rightRotate(word2, 19) ^
            (word2 >>> 10);

          schedule[round] =
            (schedule[round - 16] + sigma0 + schedule[round - 7] + sigma1) | 0;
        }

        const temp1 =
          workingHash[7] +
          (rightRotate(workingHash[4], 6) ^
            rightRotate(workingHash[4], 11) ^
            rightRotate(workingHash[4], 25)) +
          ((workingHash[4] & workingHash[5]) ^
            (~workingHash[4] & workingHash[6])) +
          k[round] +
          (schedule[round] | 0);
        const temp2 =
          (rightRotate(workingHash[0], 2) ^
            rightRotate(workingHash[0], 13) ^
            rightRotate(workingHash[0], 22)) +
          ((workingHash[0] & workingHash[1]) ^
            (workingHash[0] & workingHash[2]) ^
            (workingHash[1] & workingHash[2]));

        workingHash.unshift((temp1 + temp2) | 0);
        workingHash[4] = (workingHash[4] + temp1) | 0;
        workingHash.pop();
      }

      for (let index = 0; index < 8; index += 1) {
        hash[index] = (hash[index] + workingHash[index]) | 0;
      }
    }

    for (let index = 0; index < 8; index += 1) {
      for (let shift = 3; shift >= 0; shift -= 1) {
        const byte = (hash[index] >> (shift * 8)) & 255;
        result += byte.toString(16).padStart(2, "0");
      }
    }

    return result;
  }

  async function hashSecret(secret) {
    const value = normalizeText(secret);
    if (!value) {
      return "";
    }

    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buffer = new TextEncoder().encode(value);
      const digest = await window.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((chunk) => chunk.toString(16).padStart(2, "0"))
        .join("");
    }

    return sha256Fallback(value);
  }
  const NETWORK_SYNC_KEY = `${STORAGE_PREFIX}_network_sync_v2`;

  async function verifySecret(secret, storedHash) {
    const value = normalizeText(secret);
    const normalizedStoredHash = normalizeText(storedHash);
    if (!value || !normalizedStoredHash) {
      return {
        ok: false,
        hash: "",
        migrated: false,
      };
    }

    const computedHash = await hashSecret(value);
    if (normalizedStoredHash === computedHash) {
      return {
        ok: true,
        hash: computedHash,
        migrated: false,
      };
    }

    if (normalizedStoredHash === `plain:${value}`) {
      return {
        ok: true,
        hash: computedHash,
        migrated: true,
      };
    }

    return {
      ok: false,
      hash: computedHash,
      migrated: false,
    };
  }

  async function normalizeStoredPasswordHash(passwordHash) {
    const cleanHash = normalizeText(passwordHash);
    if (/^[a-f0-9]{64}$/i.test(cleanHash)) {
      return cleanHash.toLowerCase();
    }

    if (cleanHash.indexOf("plain:") === 0) {
      return hashSecret(cleanHash.slice(6));
    }

    return "";
  }

  function buildLocalSelection(ficha) {
    return auth.getSelectionForFicha(ficha);
  }

  function bumpNetworkSyncSignature() {
    writeJson(NETWORK_SYNC_KEY, null);
  }

  function getStorageContextMessage(mode) {
    if (mode === "network") {
      return "Este panel esta leyendo usuarios y avances desde el almacenamiento compartido del portal.";
    }

    return "Este panel muestra la copia guardada en este mismo navegador. Si no hay almacenamiento compartido disponible, aqui solo apareceran los registros creados desde este equipo.";
  }

  async function getStorageContext() {
    const status = await getSharedStoreStatus();
    return {
      mode: status.available ? "network" : "local",
      message: getStorageContextMessage(status.available ? "network" : "local"),
    };
  }

  function getCurrentUserPatched() {
    const session = getCurrentSessionPatched();
    return session && session.role === "student" ? session.user : null;
  }

  function isStudentSessionPatched() {
    const session = getCurrentSessionPatched();
    return Boolean(session && session.role === "student");
  }

  function isAdminSessionPatched() {
    const session = getCurrentSessionPatched();
    return Boolean(session && session.role === "admin");
  }

  function getCurrentSelectionPatched(defaults) {
    const normalizedDefaults = defaults || {};
    const session = getCurrentSessionPatched();
    if (session && session.role === "student" && session.user) {
      return {
        ...normalizedDefaults,
        ...auth.getSelectionForFicha(session.user.ficha),
      };
    }

    return {
      ficha: localStorage.getItem("sena_ficha") || normalizedDefaults.ficha || "",
      inst: localStorage.getItem("sena_inst") || normalizedDefaults.inst || "",
      grupo: localStorage.getItem("sena_grupo") || normalizedDefaults.grupo || "",
    };
  }

  function getAccessibleGuideFilesPatched() {
    const session = getCurrentSessionPatched();
    if (!session) {
      return [];
    }

    if (session.role === "admin") {
      return Object.keys(auth.FILE_ACCESS || {});
    }

    return auth.getGuidesForFicha(session.user.ficha);
  }

  function canAccessFilePatched(fileName) {
    const session = getCurrentSessionPatched();
    if (!session) {
      return false;
    }

    if (session.role === "admin") {
      return true;
    }

    return auth.getGuidesForFicha(session.user.ficha).includes(fileName);
  }

  function requireFileAccessPatched(fileName, options) {
    if (shouldBypassAccessGuardsForLocalPreview()) {
      return true;
    }

    if (canAccessFilePatched(fileName)) {
      return true;
    }

    if (!options || options.redirect !== false) {
      auth.setFlashMessage(
          "Debes iniciar sesi\u00f3n con un usuario autorizado para abrir esa gu\u00eda.",
        "warn"
      );
      window.location.replace((options && options.redirectUrl) || "index.html");
    }

    return false;
  }

  function requireAdminAccessPatched(options) {
    if (shouldBypassAccessGuardsForLocalPreview()) {
      return true;
    }

    if (isAdminSessionPatched()) {
      return true;
    }

    if (!options || options.redirect !== false) {
      auth.setFlashMessage(
        "Este modulo solo esta disponible para el administrador.",
        "warn"
      );
      window.location.replace((options && options.redirectUrl) || "index.html");
    }

    return false;
  }

  function validateStudentPayloadShared(data) {
    const fullName = normalizeText(data && data.fullName);
    const username = normalizeText(data && data.username);
    const usernameKey = normalizeUsername(data && data.username);
    const ficha = normalizeFicha(data && data.ficha);
    const password = normalizeText(data && data.password);

    if (fullName.length < 6) {
      return {
        ok: false,
        message: "Ingresa el nombre completo del aprendiz.",
      };
    }

    if (!/^[a-z0-9._-]{3,30}$/i.test(username)) {
      return {
        ok: false,
        message:
          "El nombre de usuario debe tener entre 3 y 30 caracteres y solo usar letras, numeros, punto, guion o guion bajo.",
      };
    }

    if (usernameKey === auth.ADMIN_PROFILE.usernameKey) {
      return {
        ok: false,
        message: "Ese nombre de usuario esta reservado para el administrador.",
      };
    }

    if (!auth.getFichaInfo(ficha)) {
      return {
        ok: false,
        message: "La ficha no existe en el portal. Verifica el numero e intenta de nuevo.",
      };
    }

    if (password.length < 4) {
      return {
        ok: false,
        message: "La contrase\u00f1a debe tener al menos 4 caracteres.",
      };
    }

    return {
      ok: true,
      fullName,
      username,
      usernameKey,
      ficha,
      password,
    };
  }

  function buildProgressSummaryFromGuides(guides) {
    const safeGuides = Array.isArray(guides) ? guides : [];
    const completed = safeGuides.reduce((sum, item) => sum + (Number(item.completed) || 0), 0);
    const total = safeGuides.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    return {
      guides: safeGuides,
      completed,
      total,
      percent: total ? Math.round((completed / total) * 100) : 0,
    };
  }

  function removeLocalGuideProgress(usernameKey, fileName) {
    const config = auth.GUIDE_PROGRESS_CONFIG[fileName];
    if (!config) {
      return;
    }

    if (config.mode === "custom-checks") {
      removeStudentScopedStorageByPrefix(usernameKey, config.dataPrefix, {
        area: "guide-data",
      });
      removeUnscopedStorageByPrefix(config.dataPrefix);
      (config.legacyDataPrefixes || []).forEach((prefix) => {
        removeUnscopedStorageByPrefix(prefix);
      });
    }

    if (config.mode === "state-with-activity") {
      localStorage.removeItem(
        getStudentStorageKeyLocal(usernameKey, config.stateKey, {
          area: "guide-data",
        })
      );
      localStorage.removeItem(config.stateKey);
      removeStudentScopedStorageByPrefix(usernameKey, `${config.pageKey}:`, {
        area: "guide-ui",
      });
    }

    localStorage.removeItem(
      getStudentStorageKeyLocal(usernameKey, getGuideProgressMetaKey(fileName), {
        area: "guide-meta",
      })
    );
  }

  async function buildMigrationPayload() {
    const users = [];
    const guideProgress = [];

    for (const rawUser of getLocalUsers()) {
      const user = sanitizeUser(rawUser);
      if (!user || !user.usernameKey) {
        continue;
      }

      const passwordHash = await normalizeStoredPasswordHash(user.passwordHash);
      if (!passwordHash) {
        continue;
      }

      users.push({
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        usernameKey: user.usernameKey,
        ficha: user.ficha,
        passwordHash,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      auth.getGuidesForFicha(user.ficha).forEach((fileName) => {
        const progress = originalGetStudentGuideProgress.call(auth, user.usernameKey, fileName);
        if (!progress || !progress.total) {
          return;
        }

        guideProgress.push({
          usernameKey: user.usernameKey,
          fileName,
          completed: progress.completed,
          total: progress.total,
          updatedAt: progress.updatedAt || user.updatedAt || new Date().toISOString(),
        });
      });
    }

    const signature = [
      window.location.origin,
      users
        .map((user) => `${user.usernameKey}|${user.updatedAt}|${user.passwordHash}`)
        .sort()
        .join(";"),
      guideProgress
        .map((entry) => `${entry.usernameKey}|${entry.fileName}|${entry.completed}|${entry.total}|${entry.updatedAt}`)
        .sort()
        .join(";"),
    ].join("::");

    return {
      users,
      guideProgress,
      signature,
    };
  }

  async function migrateLocalDataIfNeeded(force) {
    const status = await getSharedStoreStatus(force);
    if (!status.available) {
      return {
        ok: false,
        skipped: true,
        reason: "no-shared-store",
      };
    }

    if (!force && migrationPromise) {
      return migrationPromise;
    }

    migrationPromise = (async () => {
      const payload = await buildMigrationPayload();
      const syncRecord = readJson(NETWORK_SYNC_KEY, null);
      const origin = window.location.origin;

      if (
        !force &&
        syncRecord &&
        syncRecord.origin === origin &&
        syncRecord.signature === payload.signature
      ) {
        return {
          ok: true,
          skipped: true,
          syncedUsers: 0,
          syncedProgress: 0,
        };
      }

      const result = await apiRequest("/api/auth/migrate-local", {
        method: "POST",
        body: {
          users: payload.users,
          guideProgress: payload.guideProgress,
        },
      });

      if (result.ok) {
        writeJson(NETWORK_SYNC_KEY, {
          origin,
          signature: payload.signature,
          syncedAt: new Date().toISOString(),
        });
      }

      return result;
    })().finally(() => {
      migrationPromise = null;
    });

    return migrationPromise;
  }

  function scheduleProgressSync(fileName, progress) {
    const session = getCurrentSessionPatched();
    if (!session || session.role !== "student" || !session.token || !fileName) {
      return;
    }

    const timerKey = `${session.usernameKey}:${fileName}`;
    window.clearTimeout(progressTimers.get(timerKey));
    const timerId = window.setTimeout(async () => {
      progressTimers.delete(timerKey);
      const status = await getSharedStoreStatus();
      if (!status.available) {
        return;
      }

      await migrateLocalDataIfNeeded();
      await apiRequest("/api/progress", {
        method: "POST",
        token: session.token,
        body: {
          fileName,
          completed: progress.completed,
          total: progress.total,
        },
      });
    }, PROGRESS_SYNC_DELAY);

    progressTimers.set(timerKey, timerId);
  }

  auth.writeGuideProgress = function writeGuideProgressPatched(fileName, progress) {
    original.writeGuideProgress.call(auth, fileName, progress);
    const session = getCurrentSessionPatched();
    if (!session || session.role !== "student") {
      return;
    }

    const total = Math.max(0, Number(progress && progress.total) || 0);
    const completed = clampNumber(Math.max(0, Number(progress && progress.completed) || 0), 0, total || 0);
    const percent = total
      ? Math.round((completed / total) * 100)
      : clampNumber(Math.round(Number(progress && progress.percent) || 0), 0, 100);

    bumpNetworkSyncSignature();
    scheduleProgressSync(fileName, {
      completed,
      total,
      percent,
    });
  };

  auth.registerStudent = async function registerStudentPatched(data) {
    const validation = validateStudentPayloadShared(data);
    if (!validation.ok) {
      return validation;
    }

    const passwordHash = await hashSecret(validation.password);
    const status = await getSharedStoreStatus();
    if (!status.available) {
      const localResult = await original.registerStudent.call(auth, data);
      bumpNetworkSyncSignature();
      return localResult;
    }

    const result = await apiRequest("/api/auth/register", {
      method: "POST",
      body: {
        fullName: validation.fullName,
        username: validation.username,
        usernameKey: validation.usernameKey,
        ficha: validation.ficha,
        passwordHash,
      },
    });

    if (!result.ok) {
      return result;
    }

    const user = {
      ...result.user,
      passwordHash,
    };
    upsertLocalUser(user, { preservePasswordHash: true });
    persistSessionRecord({
      role: "student",
      user,
      token: result.session && result.session.token,
      loggedAt: result.session && result.session.loggedAt,
    });
    bumpNetworkSyncSignature();

    return {
      ok: true,
      user: sanitizeUser(user),
      session: getCurrentSessionPatched(),
    };
  };

  auth.loginStudent = async function loginStudentPatched(data) {
    const usernameKey = normalizeUsername(data && data.username);
    const password = normalizeText(data && data.password);
    if (!usernameKey || !password) {
      return {
        ok: false,
        message: "Ingresa el nombre de usuario y la contrase\u00f1a.",
      };
    }

    const passwordHash = await hashSecret(password);
    const status = await getSharedStoreStatus();
    if (!status.available) {
      const localResult = await original.loginStudent.call(auth, data);
      bumpNetworkSyncSignature();
      return localResult;
    }

    await migrateLocalDataIfNeeded();
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: {
        username: usernameKey,
        usernameKey,
        passwordHash,
      },
    });

    if (!result.ok) {
      return result;
    }

    const user = {
      ...result.user,
      passwordHash,
    };
    upsertLocalUser(user, { preservePasswordHash: true });
    persistSessionRecord({
      role: "student",
      user,
      token: result.session && result.session.token,
      loggedAt: result.session && result.session.loggedAt,
    });

    return {
      ok: true,
      user: sanitizeUser(user),
      session: getCurrentSessionPatched(),
    };
  };

  auth.loginAdmin = async function loginAdminPatched(data) {
    const password =
      typeof data === "string"
        ? normalizeText(data)
        : normalizeText(data && data.password);

    if (!password) {
      return {
        ok: false,
        message: "Ingresa la clave del administrador.",
      };
    }

    const passwordHash = await hashSecret(password);
    const status = await getSharedStoreStatus();
    if (!status.available) {
      return original.loginAdmin.call(auth, data);
    }

    await migrateLocalDataIfNeeded();
    const result = await apiRequest("/api/auth/admin/login", {
      method: "POST",
      body: {
        passwordHash,
      },
    });

    if (!result.ok) {
      return result;
    }

    persistSessionRecord({
      role: "admin",
      token: result.session && result.session.token,
      loggedAt: result.session && result.session.loggedAt,
    });

    return {
      ok: true,
      admin: auth.getAdminProfile(),
      session: getCurrentSessionPatched(),
    };
  };

  auth.logout = async function logoutPatched() {
    const session = getCurrentSessionPatched();
    persistSessionRecord(null);

    const status = await getSharedStoreStatus();
    if (!status.available || !session || !session.token) {
      return {
        ok: true,
      };
    }

    return apiRequest("/api/auth/logout", {
      method: "POST",
      token: session.token,
      body: {},
    });
  };

  auth.fetchStudentsWithProgress = async function fetchStudentsWithProgressPatched() {
    if (!isAdminSessionPatched()) {
      return original.getStudentsWithProgress.call(auth);
    }

    const status = await getSharedStoreStatus();
    if (!status.available) {
      return original.getStudentsWithProgress.call(auth);
    }

    await migrateLocalDataIfNeeded();
    const session = getCurrentSessionPatched();
    const result = await apiRequest("/api/admin/users", {
      method: "GET",
      token: session && session.token,
    });

    if (!result.ok || !Array.isArray(result.users)) {
      if (result.status === 401) {
        persistSessionRecord(null);
      auth.setFlashMessage("La sesi\u00f3n administrativa ha expirado. Inicia sesi\u00f3n de nuevo.", "warn");
        window.location.replace("index.html");
        return [];
      }
      return original.getStudentsWithProgress.call(auth);
    }

    result.users.forEach((user) => {
      upsertLocalUser(user, { preservePasswordHash: true });
    });

    return result.users;
  };

  auth.updateStudentPassword = async function updateStudentPasswordPatched(usernameKey, newPassword) {
    const cleanUsernameKey = normalizeUsername(usernameKey);
    const cleanPassword = normalizeText(newPassword);
    if (!cleanPassword || cleanPassword.length < 4) {
      return {
        ok: false,
        message: "La nueva contrase\u00f1a debe tener al menos 4 caracteres.",
      };
    }

    const status = await getSharedStoreStatus();
    if (!status.available) {
      const localResult = await original.updateStudentPassword.call(auth, cleanUsernameKey, cleanPassword);
      bumpNetworkSyncSignature();
      return localResult;
    }

    const session = getCurrentSessionPatched();
    const passwordHash = await hashSecret(cleanPassword);
    const result = await apiRequest("/api/admin/password", {
      method: "POST",
      token: session && session.token,
      body: {
        usernameKey: cleanUsernameKey,
        passwordHash,
      },
    });

    if (!result.ok) {
      return result;
    }

    const existing = getLocalUser(cleanUsernameKey);
    upsertLocalUser({
      ...(existing || {}),
      ...(result.user || {}),
      usernameKey: cleanUsernameKey,
      passwordHash,
      updatedAt: new Date().toISOString(),
    }, {
      preservePasswordHash: true,
    });
    bumpNetworkSyncSignature();

    return {
      ok: true,
      user: sanitizeUser(getLocalUser(cleanUsernameKey)),
    };
  };

  auth.updateStudentFicha = async function updateStudentFichaPatched(usernameKey, newFicha) {
    const cleanUsernameKey = normalizeUsername(usernameKey);
    const cleanFicha = normalizeFicha(newFicha);
    const selection = auth.getSelectionForFicha(cleanFicha);

    if (!auth.getFichaInfo(cleanFicha)) {
      return {
        ok: false,
        message: "La ficha seleccionada no existe en el portal.",
      };
    }

    const status = await getSharedStoreStatus();
    if (!status.available) {
      const localResult = original.updateStudentFicha.call(auth, cleanUsernameKey, cleanFicha);
      bumpNetworkSyncSignature();
      return localResult;
    }

    const session = getCurrentSessionPatched();
    const result = await apiRequest("/api/admin/ficha", {
      method: "POST",
      token: session && session.token,
      body: {
        usernameKey: cleanUsernameKey,
        ficha: cleanFicha,
      },
    });

    if (!result.ok) {
      return result;
    }

    const existing = getLocalUser(cleanUsernameKey);
    upsertLocalUser(
      {
        ...(existing || {}),
        ...(result.user || {}),
        usernameKey: cleanUsernameKey,
        ficha: cleanFicha,
        inst: selection.inst,
        grupo: selection.grupo,
        updatedAt: new Date().toISOString(),
      },
      {
        preservePasswordHash: true,
      }
    );
    bumpNetworkSyncSignature();

    return {
      ok: true,
      user: sanitizeUser(getLocalUser(cleanUsernameKey)),
    };
  };

  auth.resetStudentGuideProgress = async function resetStudentGuideProgressPatched(usernameKey, fileName) {
    const cleanUsernameKey = normalizeUsername(usernameKey);
    removeLocalGuideProgress(cleanUsernameKey, fileName);
    bumpNetworkSyncSignature();

    const status = await getSharedStoreStatus();
    if (!status.available) {
      return original.resetStudentGuideProgress.call(auth, cleanUsernameKey, fileName);
    }

    const session = getCurrentSessionPatched();
    const result = await apiRequest("/api/admin/reset-guide", {
      method: "POST",
      token: session && session.token,
      body: {
        usernameKey: cleanUsernameKey,
        fileName,
      },
    });

    return result.ok ? { ok: true } : result;
  };

  auth.resetStudentAllProgress = async function resetStudentAllProgressPatched(usernameKey) {
    const cleanUsernameKey = normalizeUsername(usernameKey);
    const user = getLocalUser(cleanUsernameKey);
    if (user) {
      auth.getGuidesForFicha(user.ficha).forEach((fileName) => {
        removeLocalGuideProgress(cleanUsernameKey, fileName);
      });
    }
    bumpNetworkSyncSignature();

    const status = await getSharedStoreStatus();
    if (!status.available) {
      return original.resetStudentAllProgress.call(auth, cleanUsernameKey);
    }

    const session = getCurrentSessionPatched();
    const result = await apiRequest("/api/admin/reset-all", {
      method: "POST",
      token: session && session.token,
      body: {
        usernameKey: cleanUsernameKey,
      },
    });

    return result.ok ? { ok: true } : result;
  };

  auth.getCurrentSession = getCurrentSessionPatched;
  auth.getCurrentUser = getCurrentUserPatched;
  auth.isStudentSession = isStudentSessionPatched;
  auth.isAdminSession = isAdminSessionPatched;
  auth.getCurrentSelection = getCurrentSelectionPatched;
  auth.getAccessibleGuideFiles = getAccessibleGuideFilesPatched;
  auth.canAccessFile = canAccessFilePatched;
  auth.requireFileAccess = requireFileAccessPatched;
  auth.requireAdminAccess = requireAdminAccessPatched;
  auth.getStudentsWithProgress = function getStudentsWithProgressPatched() {
    return original.getStudentsWithProgress.call(auth);
  };
  auth.getStudentGuideProgress = function getStudentGuideProgressPatched(usernameKey, fileName) {
    return originalGetStudentGuideProgress.call(auth, usernameKey, fileName);
  };
  auth.getStudentGuideSummaries = function getStudentGuideSummariesPatched(usernameKey) {
    return originalGetStudentGuideSummaries.call(auth, usernameKey);
  };
  auth.getStorageContext = getStorageContext;
  auth.getSharedStoreStatus = getSharedStoreStatus;
  auth.migrateLocalDataIfNeeded = migrateLocalDataIfNeeded;
  auth.hashSecret = hashSecret;

  if (isHttpContext()) {
    window.setTimeout(() => {
      migrateLocalDataIfNeeded().catch(() => {});
    }, 120);
  }
})();
