(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.redesQuizUnlock = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const REDES_ADMIN_QUIZ_CONFIGS = [
    {
      key: "quiz-redes-321h",
      label: "Quiz 3.2.1.H",
    },
    {
      key: "quiz-redes-33h",
      label: "Quiz IP",
    },
  ];

  function clonePlainObject(value, fallback) {
    return value && typeof value === "object" ? { ...value } : fallback;
  }

  function reopenRedesQuizAttempt(snapshotState, quizKey, updatedAt) {
    const nextState = clonePlainObject(snapshotState, {}) || {};
    const normalizedQuizKey = String(quizKey || "").trim();
    const previousAttempt = clonePlainObject(nextState[normalizedQuizKey], null);

    if (!normalizedQuizKey || !previousAttempt) {
      return {
        state: nextState,
        changed: false,
        found: false,
      };
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
      answers: clonePlainObject(previousAttempt.answers, {}),
      results: {},
      evidenceEvents: [],
      locked: false,
    };

    nextState[normalizedQuizKey] = nextAttempt;

    return {
      state: nextState,
      changed: JSON.stringify(previousAttempt) !== JSON.stringify(nextAttempt),
      found: true,
    };
  }

  return {
    REDES_ADMIN_QUIZ_CONFIGS,
    reopenRedesQuizAttempt,
  };
});
