(function () {
  "use strict";

  const auth = window.portalAuth || null;
  const body = document.body || {};
  const QUIZ_STORAGE_KEY = String(body.dataset.quizStorageKey || "quiz-redes-321h").trim();
  const WARNING_LIMIT = 2;
  const CLOUD_SYNC_DELAY_MS = 600;

  const config = {
    group: String(body.dataset.quizGroup || "").trim(),
    ficha: String(body.dataset.quizFicha || "").trim(),
    cloudFileName: String(body.dataset.quizCloudFile || "").trim(),
    pageFile: String(body.dataset.quizPageFile || "").trim(),
    backLink: String(body.dataset.quizBackLink || "").trim(),
  };

  const ui = {};
  let guideState = {};
  let attempt = null;
  let cloudSyncTimer = null;
  let lastVisibilityWarningAt = 0;
  let isBootstrapping = true;

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

  function getCurrentSession() {
    return auth && typeof auth.getCurrentSession === "function" ? auth.getCurrentSession() : null;
  }

  function getStudentUser() {
    const session = getCurrentSession();
    if (!session || session.role !== "student" || !session.user) {
      return null;
    }
    return session.user;
  }

  function getScopeKey() {
    const user = getStudentUser();
    if (!user?.usernameKey) {
      return "";
    }
    return `student:${String(user.usernameKey).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}`;
  }

  function getGuideStorageKey() {
    if (!config.cloudFileName) {
      return "";
    }
    const baseKey = `guia_interactiva_${config.cloudFileName.replace(/[^a-z0-9]+/g, "_")}`;
    if (auth && typeof auth.getScopedStorageKey === "function") {
      return auth.getScopedStorageKey(baseKey, { area: "guide-data" });
    }
    return baseKey;
  }

  function getGuideMetaStorageKey() {
    const storageKey = getGuideStorageKey();
    return storageKey ? `${storageKey}__meta` : "";
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

  function snapshotTime(snapshot) {
    const parsed = Date.parse(snapshot?.updatedAt || snapshot?.submittedAt || snapshot?.completedAt || "");
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

  function readLocalSnapshot() {
    const storageKey = getGuideStorageKey();
    if (!storageKey) {
      return null;
    }
    const data = readJson(localStorage.getItem(storageKey), null);
    if (!data || typeof data !== "object") {
      return null;
    }
    const meta = readJson(localStorage.getItem(getGuideMetaStorageKey()), null);
    return {
      data,
      updatedAt: meta?.updatedAt || "",
      updatedBy: meta?.updatedBy || "",
      sourceLabel: "Copia local del quiz",
    };
  }

  async function readCloudSnapshot() {
    if (!window._firebaseDb || typeof window._firebaseDb.cloudGetGuideData !== "function") {
      return null;
    }
    const scopeKey = getScopeKey();
    if (!scopeKey || !config.cloudFileName) {
      return null;
    }
    try {
      const snapshot = await window._firebaseDb.cloudGetGuideData(scopeKey, config.cloudFileName);
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

  function getVariantBank() {
    const varName = String(body.dataset.quizBankVar || "REDES_QUIZ_VARIANTS").trim();
    return window[varName] && typeof window[varName] === "object" ? window[varName] : {};
  }

  function chooseRandomVariant() {
    const variants = Object.keys(getVariantBank());
    if (!variants.length) {
      return "";
    }
    return variants[Math.floor(Math.random() * variants.length)];
  }

  function getActiveQuestions() {
    const variant = attempt?.variant || "";
    const bank = getVariantBank();
    return Array.isArray(bank[variant]) ? bank[variant] : [];
  }

  function normalizeAttempt(rawAttempt) {
    if (!rawAttempt || typeof rawAttempt !== "object") {
      return null;
    }

    return {
      version: Number(rawAttempt.version) || 1,
      variant: String(rawAttempt.variant || "").trim(),
      startedAt: String(rawAttempt.startedAt || "").trim(),
      completedAt: String(rawAttempt.completedAt || "").trim(),
      submittedAt: String(rawAttempt.submittedAt || "").trim(),
      updatedAt: String(rawAttempt.updatedAt || "").trim(),
      score: Number(rawAttempt.score) || 0,
      maxScore: Number(rawAttempt.maxScore) || 100,
      warningCount: Number(rawAttempt.warningCount) || 0,
      terminatedByVisibility: Boolean(rawAttempt.terminatedByVisibility),
      status: String(rawAttempt.status || "ready").trim(),
      answers:
        rawAttempt.answers && typeof rawAttempt.answers === "object" ? { ...rawAttempt.answers } : {},
      results:
        rawAttempt.results && typeof rawAttempt.results === "object" ? { ...rawAttempt.results } : {},
      evidenceEvents: Array.isArray(rawAttempt.evidenceEvents) ? rawAttempt.evidenceEvents.slice() : [],
      locked: Boolean(rawAttempt.locked),
    };
  }

  function writeAttemptIntoGuideState(updatedAt) {
    if (!guideState || typeof guideState !== "object") {
      guideState = {};
    }
    attempt.updatedAt = updatedAt;
    guideState[QUIZ_STORAGE_KEY] = {
      ...attempt,
      updatedAt,
    };
  }

  function saveLocalSnapshot(updatedAt) {
    const storageKey = getGuideStorageKey();
    if (!storageKey) {
      return;
    }
    writeAttemptIntoGuideState(updatedAt);
    localStorage.setItem(storageKey, JSON.stringify(guideState));
    localStorage.setItem(
      getGuideMetaStorageKey(),
      JSON.stringify({
        updatedAt,
        updatedBy: "redes-quiz",
      })
    );
  }

  async function saveCloudSnapshot(updatedAt) {
    if (!window._firebaseDb || typeof window._firebaseDb.cloudSaveGuideData !== "function") {
      return;
    }
    const scopeKey = getScopeKey();
    if (!scopeKey || !config.cloudFileName) {
      return;
    }
    writeAttemptIntoGuideState(updatedAt);
    await window._firebaseDb.cloudSaveGuideData(scopeKey, config.cloudFileName, {
      data: guideState,
      updatedAt,
      updatedBy: "redes-quiz",
    });
  }

  function queueCloudSave() {
    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(() => {
      const updatedAt = new Date().toISOString();
      void saveCloudSnapshot(updatedAt);
    }, CLOUD_SYNC_DELAY_MS);
  }

  async function persistAttempt(forceCloud) {
    if (!attempt) {
      return;
    }
    const updatedAt = new Date().toISOString();
    saveLocalSnapshot(updatedAt);
    if (forceCloud) {
      await saveCloudSnapshot(updatedAt);
      return;
    }
    queueCloudSave();
  }

  function getAnsweredCount() {
    return attempt?.answers ? Object.keys(attempt.answers).filter((key) => Number.isInteger(attempt.answers[key])).length : 0;
  }

  function computeAttemptResults() {
    const questions = getActiveQuestions();
    const results = {};
    let score = 0;

    questions.forEach((question) => {
      const selectedIndex = Number(attempt?.answers?.[question.id]);
      const isCorrect = Number.isInteger(selectedIndex) && selectedIndex === question.correctIndex;
      results[question.id] = isCorrect;
      if (isCorrect) {
        score += 10;
      }
    });

    return {
      results,
      score,
      answeredCount: getAnsweredCount(),
      totalCount: questions.length,
    };
  }

  function setStatus(message) {
    if (ui.status) {
      ui.status.textContent = message;
    }
  }

  function setAlert(message, type) {
    if (!ui.alertPanel) {
      return;
    }
    ui.alertPanel.classList.toggle("is-visible", Boolean(message));
    ui.alertPanel.dataset.kind = type || "";
    ui.alertPanel.innerHTML = message || "";
  }

  function setLockBanner(message) {
    if (!ui.lockBanner) {
      return;
    }
    ui.lockBanner.classList.toggle("is-visible", Boolean(message));
    ui.lockBanner.innerHTML = message || "";
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

  function renderStats() {
    const result = attempt && attempt.locked ? computeAttemptResults() : null;
    if (ui.variant) {
      ui.variant.textContent = attempt?.variant || "Sin asignar";
    }
    if (ui.answered) {
      ui.answered.textContent = `${getAnsweredCount()} / 10`;
    }
    if (ui.warnings) {
      ui.warnings.textContent = `${attempt?.warningCount || 0} / ${WARNING_LIMIT}`;
    }
    if (ui.score) {
      ui.score.textContent = result ? `${result.score} / 100` : attempt?.locked ? `${attempt.score || 0} / 100` : "Pendiente";
    }
  }

  function renderQuestionCard(question, index) {
    const selectedIndex = Number(attempt?.answers?.[question.id]);
    const locked = Boolean(attempt?.locked);
    const showResults = locked && attempt?.results && typeof attempt.results === "object";
    const isCorrectAnswer = (optionIndex) => showResults && optionIndex === question.correctIndex;

    const optionsHtml = question.options
      .map((option, optionIndex) => {
        const checked = selectedIndex === optionIndex ? ' checked="checked"' : "";
        const disabled = locked ? ' disabled="disabled"' : "";
        const classes = [
          "redes-quiz-option",
          locked ? "is-locked" : "",
          isCorrectAnswer(optionIndex) ? "is-correct" : "",
          showResults && selectedIndex === optionIndex && selectedIndex !== question.correctIndex ? "is-wrong" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `
          <label class="${classes}">
            <input type="radio" name="quiz-${escapeHtml(question.id)}" value="${optionIndex}" data-quiz-option="${escapeHtml(question.id)}"${checked}${disabled}>
            <span>${escapeHtml(option)}</span>
          </label>`;
      })
      .join("");

    return `
      <article class="redes-quiz-question">
        <div class="redes-quiz-question-header">
          <span class="redes-quiz-question-number">${index + 1}</span>
          <span class="redes-quiz-topic">${escapeHtml(question.topic)}</span>
        </div>
        <p>${escapeHtml(question.prompt)}</p>
        <div class="redes-quiz-options">${optionsHtml}</div>
      </article>`;
  }

  function renderQuestions() {
    const questions = getActiveQuestions();
    const shouldShowQuestions = Boolean(attempt?.startedAt);

    if (!ui.emptyState || !ui.questions) {
      return;
    }

    ui.emptyState.hidden = shouldShowQuestions;
    ui.questions.hidden = !shouldShowQuestions;

    if (!shouldShowQuestions) {
      ui.questions.innerHTML = "";
      return;
    }

    ui.questions.innerHTML = questions.map(renderQuestionCard).join("");
  }

  function renderLockedState() {
    if (!attempt?.locked) {
      setLockBanner("");
      return;
    }

    const statusLabel =
      attempt.status === "terminated_visibility"
        ? "Intento finalizado por segunda advertencia de cambio de pestana."
        : "Intento finalizado y bloqueado.";

    setLockBanner(
      `<strong>&#9989; Quiz cerrado.</strong><br>${escapeHtml(statusLabel)}<br>` +
        `Inicio: ${escapeHtml(formatDate(attempt.startedAt))} &nbsp;|&nbsp; ` +
        `Finalizacion: ${escapeHtml(formatDate(attempt.completedAt || attempt.submittedAt))} &nbsp;|&nbsp; ` +
        `Puntaje: ${escapeHtml(String(attempt.score || 0))} / 100`
    );
  }

  function renderView() {
    if (isBootstrapping) {
      if (ui.startBtn) {
        ui.startBtn.disabled = true;
      }
      if (ui.submitBtn) {
        ui.submitBtn.disabled = true;
      }
      setStatus("Cargando el estado del quiz...");
      return;
    }

    renderStats();
    renderQuestions();
    renderLockedState();

    const hasSession = Boolean(getStudentUser());
    if (!hasSession) {
      if (ui.startBtn) {
        ui.startBtn.disabled = true;
      }
      if (ui.submitBtn) {
        ui.submitBtn.disabled = true;
      }
      setStatus("Debes ingresar al portal como aprendiz para presentar este quiz.");
      return;
    }

    if (!attempt) {
      if (ui.startBtn) {
        ui.startBtn.disabled = false;
        ui.startBtn.hidden = false;
      }
      if (ui.submitBtn) {
        ui.submitBtn.disabled = true;
      }
      setStatus('Listo para iniciar. La variante se asignara al azar cuando pulses "Iniciar quiz".');
      return;
    }

    if (ui.startBtn) {
      ui.startBtn.hidden = Boolean(attempt.startedAt);
      ui.startBtn.disabled = attempt.locked;
    }

    if (ui.submitBtn) {
      ui.submitBtn.disabled = !attempt.startedAt || attempt.locked;
    }

    if (attempt.locked) {
      setAlert("", "");
      setStatus(
        attempt.status === "terminated_visibility"
          ? "El quiz fue finalizado automaticamente por la segunda advertencia de cambio de pestana."
          : "El quiz ya fue entregado. Solo puedes revisar el resultado."
      );
      return;
    }

    setStatus(
      `Intento en curso. Variante ${attempt.variant || "sin asignar"} activa. ` +
      `Advertencias: ${attempt.warningCount || 0} / ${WARNING_LIMIT}.`
    );
  }

  function buildEvidenceEvent(eventData) {
    return {
      type: "visibility-warning",
      warningNumber: Number(eventData.warningNumber) || 0,
      timestamp: String(eventData.timestamp || new Date().toISOString()),
      visibilityState: String(eventData.visibilityState || document.visibilityState || "hidden"),
    };
  }

  async function finalizeQuiz(reason) {
    if (!attempt || attempt.locked) {
      return;
    }

    const computed = computeAttemptResults();
    const finalizedAt = new Date().toISOString();
    attempt.results = computed.results;
    attempt.score = computed.score;
    attempt.maxScore = 100;
    attempt.completedAt = finalizedAt;
    attempt.submittedAt = finalizedAt;
    attempt.terminatedByVisibility = reason === "terminated_visibility";
    attempt.status = reason === "terminated_visibility" ? "terminated_visibility" : "completed";
    attempt.locked = true;

    await persistAttempt(true);
    renderView();
  }

  async function startQuiz() {
    const user = getStudentUser();
    if (!user) {
      setStatus("Debes ingresar al portal como aprendiz para presentar este quiz.");
      return;
    }

    if (!getVariantBank() || !Object.keys(getVariantBank()).length) {
      setStatus("No fue posible cargar el banco del quiz.");
      return;
    }

    if (attempt?.startedAt && !attempt.locked) {
      renderView();
      return;
    }

    const variant = chooseRandomVariant();
    if (!variant) {
      setStatus("No hay variantes disponibles para este quiz.");
      return;
    }

    attempt = {
      version: 1,
      variant,
      startedAt: new Date().toISOString(),
      completedAt: "",
      submittedAt: "",
      updatedAt: "",
      score: 0,
      maxScore: 100,
      warningCount: 0,
      terminatedByVisibility: false,
      status: "in_progress",
      answers: {},
      results: {},
      evidenceEvents: [],
      locked: false,
    };

    setAlert("", "");
    await persistAttempt(true);
    renderView();
  }

  async function handleManualSubmit() {
    if (!attempt || attempt.locked) {
      return;
    }

    const confirmed = window.confirm(
      "Al enviar y finalizar, el quiz quedara bloqueado y ya no podras cambiar tus respuestas. Deseas continuar?"
    );
    if (!confirmed) {
      return;
    }

    await finalizeQuiz("completed");
  }

  async function handleOptionChange(input) {
    if (!attempt || attempt.locked) {
      return;
    }

    const questionId = String(input.getAttribute("data-quiz-option") || "").trim();
    if (!questionId) {
      return;
    }

    attempt.answers[questionId] = Number(input.value);
    attempt.status = "in_progress";
    await persistAttempt(false);
    renderStats();
  }

  async function handleVisibilityChange() {
    if (!attempt || attempt.locked || attempt.status !== "in_progress") {
      return;
    }
    if (document.visibilityState !== "hidden") {
      return;
    }

    const now = Date.now();
    if (now - lastVisibilityWarningAt < 900) {
      return;
    }
    lastVisibilityWarningAt = now;

    attempt.warningCount = Number(attempt.warningCount) + 1;
    attempt.evidenceEvents = Array.isArray(attempt.evidenceEvents) ? attempt.evidenceEvents : [];
    attempt.evidenceEvents.push(
      buildEvidenceEvent({
        warningNumber: attempt.warningCount,
        timestamp: new Date().toISOString(),
        visibilityState: document.visibilityState,
      })
    );

    await persistAttempt(true);
    renderStats();

    if (attempt.warningCount >= 2) {
      window.alert(
        "Advertencia 2 de 2: cambiaste de pestana nuevamente. El quiz se cerrara ahora y se enviara con lo contestado hasta este momento."
      );
      await finalizeQuiz("terminated_visibility");
      return;
    }

    setAlert(
      `<strong>&#9888; Advertencia ${escapeHtml(String(attempt.warningCount))} de 2.</strong><br>` +
      "Se detecto un cambio de pestana durante el intento. En la segunda advertencia el quiz se finaliza automaticamente.",
      "warning"
    );
    window.alert(
      "Advertencia 1 de 2: se detecto un cambio de pestana. Si vuelves a salir, el quiz se enviara automaticamente y quedara bloqueado."
    );
    renderView();
  }

  async function loadInitialState() {
    const [cloudSnapshot, localSnapshot] = await Promise.all([
      readCloudSnapshot(),
      Promise.resolve(readLocalSnapshot()),
    ]);

    const latestSnapshot = pickLatestSnapshot(cloudSnapshot, localSnapshot);
    guideState =
      latestSnapshot?.data && typeof latestSnapshot.data === "object"
        ? { ...latestSnapshot.data }
        : {};
    attempt = normalizeAttempt(guideState[QUIZ_STORAGE_KEY]);
  }

  function cacheUi() {
    ui.startBtn = getById("quizStartBtn");
    ui.submitBtn = getById("quizSubmitBtn");
    ui.backLink = getById("quizBackLink");
    ui.status = getById("quizStatus");
    ui.variant = getById("quizVariant");
    ui.answered = getById("quizAnswered");
    ui.warnings = getById("quizWarnings");
    ui.score = getById("quizScore");
    ui.alertPanel = getById("quizAlertPanel");
    ui.lockBanner = getById("quizLockBanner");
    ui.questions = getById("quizQuestions");
    ui.emptyState = getById("quizEmptyState");
  }

  function bindEvents() {
    ui.startBtn?.addEventListener("click", () => {
      void startQuiz();
    });

    ui.submitBtn?.addEventListener("click", () => {
      void handleManualSubmit();
    });

    ui.questions?.addEventListener("change", (event) => {
      const option = event.target.closest("[data-quiz-option]");
      if (option) {
        void handleOptionChange(option);
      }
    });

    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cacheUi();
    if (ui.backLink && config.backLink) {
      ui.backLink.setAttribute("href", config.backLink);
    }
    await loadInitialState();
    isBootstrapping = false;
    renderView();
    bindEvents();
  });
})();
