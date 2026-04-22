const test = require("node:test");
const assert = require("node:assert/strict");

const { reopenRedesQuizAttempt } = require("../js/redes_quiz_unlock.js");

test("reabre un quiz cerrado sin borrar respuestas ni variante", () => {
  const updatedAt = "2026-04-22T18:30:00.000Z";
  const nextState = reopenRedesQuizAttempt(
    {
      observacion: "Mantener",
      "quiz-redes-321h": {
        version: 1,
        variant: "B",
        startedAt: "2026-04-20T10:00:00.000Z",
        completedAt: "2026-04-20T10:15:00.000Z",
        submittedAt: "2026-04-20T10:15:00.000Z",
        updatedAt: "2026-04-20T10:15:00.000Z",
        score: 70,
        maxScore: 100,
        warningCount: 2,
        terminatedByVisibility: true,
        status: "terminated_visibility",
        answers: {
          p1: 2,
          p2: 1,
        },
        results: {
          p1: false,
          p2: true,
        },
        evidenceEvents: [
          {
            warningNumber: 1,
            timestamp: "2026-04-20T10:05:00.000Z",
            visibilityState: "hidden",
          },
        ],
        locked: true,
      },
    },
    "quiz-redes-321h",
    updatedAt
  );

  assert.equal(nextState.found, true);
  assert.equal(nextState.changed, true);
  assert.equal(nextState.state.observacion, "Mantener");
  assert.deepEqual(nextState.state["quiz-redes-321h"].answers, {
    p1: 2,
    p2: 1,
  });
  assert.equal(nextState.state["quiz-redes-321h"].variant, "B");
  assert.equal(nextState.state["quiz-redes-321h"].locked, false);
  assert.equal(nextState.state["quiz-redes-321h"].status, "in_progress");
  assert.equal(nextState.state["quiz-redes-321h"].completedAt, "");
  assert.equal(nextState.state["quiz-redes-321h"].submittedAt, "");
  assert.equal(nextState.state["quiz-redes-321h"].score, 0);
  assert.equal(nextState.state["quiz-redes-321h"].warningCount, 0);
  assert.equal(nextState.state["quiz-redes-321h"].terminatedByVisibility, false);
  assert.deepEqual(nextState.state["quiz-redes-321h"].results, {});
  assert.deepEqual(nextState.state["quiz-redes-321h"].evidenceEvents, []);
  assert.equal(nextState.state["quiz-redes-321h"].updatedAt, updatedAt);
});

test("no cambia el estado cuando el quiz no existe", () => {
  const originalState = {
    bloqueA: "Respuesta",
  };
  const nextState = reopenRedesQuizAttempt(originalState, "quiz-redes-33h", "2026-04-22T18:30:00.000Z");

  assert.equal(nextState.found, false);
  assert.equal(nextState.changed, false);
  assert.deepEqual(nextState.state, originalState);
});
