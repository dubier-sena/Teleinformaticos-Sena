(function () {
  const auth = window.portalAuth;
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
    "social-locked",
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
  const GUIDE2_RESPONSE_KEYS = [
    "wordSearch:guia2-sopa",
    "matchingGame:guia2-relaciona",
    "contexto-q1",
    "contexto-rel-drive",
    "contexto-rel-excel",
    "contexto-rel-canva",
    "contexto-rel-whatsapp",
    "contexto-tendero",
    "contexto-q4",
    "contexto-docente-correo-si",
    "contexto-docente-correo-porque",
    "contexto-docente-classroom-si",
    "contexto-docente-classroom-porque",
    "contexto-docente-whatsapp-si",
    "contexto-docente-whatsapp-porque",
    "contexto-docente-usb-si",
    "contexto-docente-usb-porque",
    "contexto-nube",
    "contexto-backup-verificar",
    "contexto-backup-seleccionar",
    "contexto-backup-copiar",
    "contexto-backup-confirmar",
    "contexto-info-problem",
    "contexto-uso-word-si",
    "contexto-uso-word-porque",
    "contexto-uso-excel-si",
    "contexto-uso-excel-porque",
    "contexto-uso-drive-si",
    "contexto-uso-drive-porque",
    "contexto-uso-correo-si",
    "contexto-uso-correo-porque",
    "contexto-uso-meet-si",
    "contexto-uso-meet-porque",
    "contexto-otanche",
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
    return `
      <div class="answers-grid">
        <article class="answer-card">
          <h3>Actividad 1. Sopa de letras de conceptos basicos.</h3>
          ${renderWordSearchResult(state, context)}
        </article>

        <article class="answer-card">
          <h3>Actividad 2. Relaciona la herramienta con su funcion.</h3>
          ${renderMatchingGameResult(state, context)}
        </article>

        <article class="answer-card">
          <h3>Identificacion registrada en el formulario.</h3>
          ${renderAnswerTable(
            ["Campo", "Respuesta del aprendiz"],
            [
              ["Nombre completo", state["actividad4:nombre_completo"]],
              ["Numero de ficha", state["actividad4:ficha"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>1. \u00bfCu\u00e1l de las siguientes opciones describe mejor qu\u00e9 es una herramienta TIC?</h3>
          ${renderAnswerValue(state["contexto-q1"])}
        </article>

        <article class="answer-card">
          <h3>2. Relaciona cada herramienta con su funci\u00f3n principal.</h3>
          ${renderAnswerTable(
            ["Herramienta", "Respuesta del aprendiz"],
            [
              ["Google Drive", state["contexto-rel-drive"]],
              ["Microsoft Excel", state["contexto-rel-excel"]],
              ["Canva", state["contexto-rel-canva"]],
              ["WhatsApp Business", state["contexto-rel-whatsapp"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>3. Recomendaci\u00f3n para el tendero de Puerto Boyac\u00e1.</h3>
          ${renderAnswerValue(state["contexto-tendero"])}
        </article>

        <article class="answer-card">
          <h3>4. Acci\u00f3n que NO corresponde a un procesador de texto.</h3>
          ${renderAnswerValue(state["contexto-q4"])}
        </article>

        <article class="answer-card">
          <h3>5. Herramientas para enviar el mismo mensaje a 30 estudiantes.</h3>
          ${renderAnswerTable(
            ["Herramienta", "\u00bfLa usar\u00eda?", "\u00bfPor qu\u00e9 la usar\u00eda?"],
            [
              [
                "Correo electr\u00f3nico (Gmail, Outlook)",
                state["contexto-docente-correo-si"],
                state["contexto-docente-correo-porque"],
              ],
              [
                "Google Classroom o plataforma educativa",
                state["contexto-docente-classroom-si"],
                state["contexto-docente-classroom-porque"],
              ],
              [
                "WhatsApp con lista de difusi\u00f3n",
                state["contexto-docente-whatsapp-si"],
                state["contexto-docente-whatsapp-porque"],
              ],
              ["USB copiado uno por uno", state["contexto-docente-usb-si"], state["contexto-docente-usb-porque"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>6. \u00bfQu\u00e9 significa guardar en la nube?</h3>
          ${renderAnswerValue(state["contexto-nube"])}
        </article>

        <article class="answer-card">
          <h3>7. Orden propuesto para crear una copia de seguridad.</h3>
          ${renderAnswerTable(
            ["Paso", "Orden escrito"],
            [
              [
                "Verificar que el archivo se abrio correctamente en la ubicacion de respaldo",
                state["contexto-backup-verificar"],
              ],
              ["Seleccionar el archivo que deseas respaldar", state["contexto-backup-seleccionar"]],
              [
                "Copiar o subir el archivo a una memoria USB o servicio en la nube",
                state["contexto-backup-copiar"],
              ],
              [
                "Confirmar que el archivo original sigue disponible en su ubicacion original",
                state["contexto-backup-confirmar"],
              ],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>8. Situaci\u00f3n que representa un problema de gesti\u00f3n de la informaci\u00f3n.</h3>
          ${renderAnswerValue(state["contexto-info-problem"])}
        </article>

        <article class="answer-card">
          <h3>9. Herramientas digitales que ya ha usado el aprendiz.</h3>
          ${renderAnswerTable(
            ["Herramienta", "\u00bfLa ha usado?", "\u00bfPara qu\u00e9 la us\u00f3?"],
            [
              ["Microsoft Word o Writer", state["contexto-uso-word-si"], state["contexto-uso-word-porque"]],
              ["Microsoft Excel o Calc", state["contexto-uso-excel-si"], state["contexto-uso-excel-porque"]],
              ["Google Drive", state["contexto-uso-drive-si"], state["contexto-uso-drive-porque"]],
              ["Correo electronico", state["contexto-uso-correo-si"], state["contexto-uso-correo-porque"]],
              ["Zoom o Google Meet", state["contexto-uso-meet-si"], state["contexto-uso-meet-porque"]],
            ]
          )}
        </article>

        <article class="answer-card">
          <h3>10. Recomendaciones para organizar la informaci\u00f3n del emprendedor de Otanche.</h3>
          ${renderAnswerValue(state["contexto-otanche"])}
        </article>
      </div>
    `;
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
    if (!title || !subtitle || !meta || !body) {
      return;
    }

    title.textContent = options.title || "Resultados de la Guia 2";
    subtitle.textContent = options.subtitle || "Consulta administrativa de la Guia 2.";
    meta.textContent = options.meta || "";
    body.innerHTML = options.bodyHtml || '<div class="response-status">Sin contenido disponible.</div>';
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeGuide2ResponsesModal() {
    const modal = getById("guide2-responses-modal");
    if (!modal || modal.hidden) {
      return;
    }

    modal.hidden = true;
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

  function buildProgressCard(user, guide) {
    const fillWidth = Math.max(0, Math.min(100, Number(guide.percent) || 0));
    const guide2Config = getGuide2ResponseConfig(guide.fileName);
    const sourceText =
      guide.source === "meta" || guide.source === "network"
        ? `\u00daltima actualizaci\u00f3n: ${formatDate(guide.updatedAt)}`
        : "Resumen reconstruido desde el almacenamiento local.";

    return `
      <article class="progress-card">
        <h4>${escapeHtml(guide.title)}</h4>
        <div class="progress-meta">
          <span>${guide.completed} / ${guide.total || 0}</span>
          <strong>${fillWidth}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${fillWidth}%"></div>
        </div>
        <div class="progress-actions">
          <a class="btn ghost" href="${escapeHtml(buildGuideUrl(user, guide.fileName))}">Abrir gu\u00eda</a>
          ${
            guide2Config
              ? `<button class="btn secondary" type="button" data-view-guide2="${escapeHtml(
                  guide.fileName
                )}" data-user="${escapeHtml(user.usernameKey)}">Ver resultados Guia 2</button>`
              : ""
          }
          ${
            isRedesSbGuideFile(guide.fileName)
              ? `<button class="btn secondary" type="button" data-unlock-redes-guide="${escapeHtml(
                  guide.fileName
                )}" data-user="${escapeHtml(user.usernameKey)}">Habilitar edicion</button>`
              : ""
          }
          <button class="btn warn" type="button" data-reset-guide="${escapeHtml(
            guide.fileName
          )}" data-user="${escapeHtml(user.usernameKey)}">Reiniciar gu\u00eda</button>
        </div>
        <div class="progress-source">${escapeHtml(sourceText)}</div>
        ${guide2Config ? renderWordSearchAdminSummary(user, guide.fileName) : ""}
        ${guide2Config ? renderMatchingGameAdminSummary(user, guide.fileName) : ""}
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
              <div>Usuario: <strong>${escapeHtml(user.username)}</strong></div>
              <div>Ficha ${escapeHtml(user.ficha)} | ${escapeHtml(user.grupo)} | ${escapeHtml(
      user.inst
    )}</div>
              <div>Creado: ${escapeHtml(createdText)} | \u00daltima edici\u00f3n de cuenta: ${escapeHtml(
      updatedText
    )}</div>
            </div>
          </div>
          <div class="user-badge">${overall}%</div>
        </div>

        <div class="user-section-title">Cambiar contrase\u00f1a</div>
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

        <div class="user-section-title" style="margin-top:16px">Corregir ficha</div>
        <form class="ficha-row" data-ficha-form="${escapeHtml(user.usernameKey)}">
          <select name="ficha" aria-label="Nueva ficha para ${escapeHtml(user.fullName)}">
            ${renderFichaOptions(user.ficha)}
          </select>
          <button class="btn secondary" type="submit">Actualizar ficha</button>
        </form>
        <div class="user-note">
          Al corregir la ficha se actualizan automaticamente la institucion, el grupo y las guias visibles.
        </div>

        <div class="user-note">
          Para ver el avance por gu\u00eda o reiniciar actividades espec\u00edficas, usa la pesta\u00f1a "Avance de guias".
        </div>

        <div class="user-actions" style="margin-top:12px">
          <button class="btn warn" type="button" data-reset-all="${escapeHtml(
            user.usernameKey
          )}">Reiniciar todo el avance</button>
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
          await window._firebaseDb.cloudSaveGuideData(scopeKey, cloudFileName, {
            ...(snapshot && typeof snapshot === "object" ? snapshot : {}),
            state: cloudUnlock.state,
            updatedAt,
            updatedBy: "admin-redes-unlock",
          });
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
          <tbody>${rows.map(({ summary }) => `
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
                <button class="btn ghost" type="button" data-view-redes-quiz="${escapeHtml(summary.user.usernameKey)}">
                  Ver detalle
                </button>
              </td>
            </tr>`).join("")}
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

  function renderActivitiesTab(users) {
    const container = getById("activities-container");
    if (!container) {
      return;
    }

    const wordSearchRows = [];
    const matchingRows = [];

    users.forEach((user) => {
      (user.progress?.guides || []).forEach((guide) => {
        if (!getGuide2ResponseConfig(guide.fileName)) {
          return;
        }
        const key = getGuide2SummaryKey(user.usernameKey, guide.fileName);
        const ws = guide2WordSearchSummaries[key];
        const mg = guide2MatchingGameSummaries[key];
        if (ws) {
          wordSearchRows.push({ summary: ws, user, guide });
        }
        if (mg) {
          matchingRows.push({ summary: mg, user, guide });
        }
      });
    });

    const stillLoading =
      users.some((user) =>
        (user.progress?.guides || []).some((guide) => {
          if (!getGuide2ResponseConfig(guide.fileName)) {
            return false;
          }
          const key = getGuide2SummaryKey(user.usernameKey, guide.fileName);
          return !(key in guide2WordSearchSummaries);
        })
      );

    // Ficha de caso rows
    const fichaCasoRows = [];
    const fichaCasoLoading = users
      .filter((user) => getFichaCasoFileName(user))
      .some((user) => !(user.usernameKey in fichaCasoSummaries));

    users.forEach((user) => {
      if (!getFichaCasoFileName(user)) return;
      const snapshot = fichaCasoSummaries[user.usernameKey];
      if (snapshot && snapshot.state) {
        fichaCasoRows.push({ user, snapshot });
      }
    });

    const loadingHtml = '<p class="activities-loading">Cargando resultados\u2026</p>';

    const matriz322Rows = [];
    users.forEach((user) => {
      const summary = matriz322Summaries[user.usernameKey];
      if (summary) {
        matriz322Rows.push({ summary });
      }
    });

    const redesSbUsers = users.filter((u) => REDES_SB_CLOUD_FILES[u.ficha]);
    const redesLoading = redesSbUsers.some((u) => !(u.usernameKey in redesSocializacionSummaries));
    const redesRows = redesSbUsers
      .map((u) => redesSocializacionSummaries[u.usernameKey])
      .filter(Boolean)
      .map((summary) => ({ summary }));
    const redesQuizLoading = redesSbUsers.some((u) => !(u.usernameKey in redesQuizSummaries));
    const redesQuizRows = redesSbUsers
      .map((u) => redesQuizSummaries[u.usernameKey])
      .filter(Boolean)
      .map((summary) => ({ summary }));

    container.innerHTML = `
      <section class="panel">
        <h2>Actividad 1 \u2014 Sopa de letras</h2>
        ${stillLoading ? loadingHtml : buildActivitiesTable(wordSearchRows, "wordsearch")}
      </section>
      <section class="panel">
        <h2>Actividad 2 \u2014 Relacionar funciones</h2>
        ${stillLoading ? loadingHtml : buildActivitiesTable(matchingRows, "matching")}
      </section>
      <section class="panel">
        <h2>Actividad 4 \u2014 Ficha de caso (respuestas guardadas)</h2>
        ${fichaCasoLoading ? loadingHtml : buildFichaCasoTable(fichaCasoRows)}
      </section>
      <section class="panel">
        <h2>Actividad 3.2.2 \u2014 Matriz de Diagn\u00f3stico Digital (finalizadas)</h2>
        ${stillLoading ? loadingHtml : buildMatriz322Table(matriz322Rows)}
      </section>
      <section class="panel">
        <h2>Quiz 3.2.1.H - Redes Santa Barbara</h2>
        ${redesQuizLoading ? loadingHtml : buildRedesQuizTable(redesQuizRows)}
      </section>
      <section class="panel">
        <h2>Socializaci\u00f3n 3.1.1 \u2014 Santa B\u00e1rbara (notas enviadas)</h2>
        ${redesLoading ? loadingHtml : buildRedesSocializacionTable(redesRows)}
      </section>
    `;
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
    await Promise.all([
      hydrateGuide2WordSearchSummaries(allUsers),
      hydrateFichaCasoSummaries(allUsers),
      hydrateRedesSocializacionSummaries(allUsers),
      hydrateRedesQuizSummaries(allUsers),
    ]);
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

  async function handleFichaSubmit(form) {
    const usernameKey = form.getAttribute("data-ficha-form") || "";
    const select = form.querySelector("select[name='ficha']");
    const ficha = select?.value || "";
    const user = allUsers.find((item) => item.usernameKey === usernameKey);
    if (!user) {
      setFeedback("No se encontro el usuario solicitado.", "error");
      return;
    }

    if (ficha === user.ficha) {
      setFeedback(`La ficha de ${user.fullName} ya esta registrada como ${ficha}.`, "success");
      return;
    }

    const result = await auth.updateStudentFicha(usernameKey, ficha);
    if (!result.ok) {
      setFeedback(result.message, "error");
      return;
    }

    const updatedFicha = result.user?.ficha || ficha;
    setFeedback(`Ficha actualizada para ${user.fullName}. Nueva ficha: ${updatedFicha}.`, "success");
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
      const passwordForm = event.target.closest("[data-password-form]");
      if (passwordForm) {
        event.preventDefault();
        await handlePasswordSubmit(passwordForm);
        return;
      }

      const fichaForm = event.target.closest("[data-ficha-form]");
      if (fichaForm) {
        event.preventDefault();
        await handleFichaSubmit(fichaForm);
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
