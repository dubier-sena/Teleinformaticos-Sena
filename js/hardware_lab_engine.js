/* js/hardware_lab_engine.js
 *
 * Motor generico del Laboratorio Virtual de Hardware. NO conoce el DOM ni
 * un equipo en particular: recibe los datos de un equipo (ver
 * hardware_lab_data_desktop.js / hardware_lab_data_laptop.js) y una sesion, y
 * sabe:
 *   - que accion sigue en el modo guiado (orden fijo), o si el modo es
 *     "abierto" (practica libre / evaluacion / diagnostico: sin orden fijo,
 *     solo importan las dependencias fisicas reales);
 *   - si una accion es posible (dependencias, herramienta, gabinete
 *     abierto/cerrado) y por que no, si no lo es;
 *   - aplicar la accion y avanzar la sesion;
 *   - calcular el resultado final (rubrica de 4 categorias, igual espiritu
 *     que el ejemplo de "Resultado de la practica" del enunciado).
 *
 * Modos soportados (sufijo del "mode"):
 *   "-guided" -> orden fijo (usa equipmentData.sequences[direction] tal cual).
 *   "-open"   -> sin orden fijo entre las piezas; los pasos de seguridad
 *                previos/posteriores (los mismos datos, derivados por
 *                posicion) SI deben confirmarse en su fase correspondiente.
 *                Usado por practica libre, evaluacion Y diagnostico (este
 *                ultimo con un motor propio que reutiliza estas funciones,
 *                ver hardware_lab_diagnosis_engine.js).
 */
(function (root) {
  "use strict";

  var ACTION_LABELS = {
    remove: { verb: "retirar", pastParticiple: "retirado" },
    install: { verb: "instalar", pastParticiple: "instalado" },
    disconnect: { verb: "desconectar", pastParticiple: "desconectado" },
    connect: { verb: "conectar", pastParticiple: "conectado" },
  };

  // Cada accion mueve la pieza a este valor de "present".
  var ACTION_TARGET_PRESENT = {
    remove: false,
    install: true,
    disconnect: false,
    connect: true,
  };

  function getTools() {
    return (root.HardwareLab && root.HardwareLab.Tools) || null;
  }

  function getPart(equipmentData, partId) {
    return (equipmentData.parts && equipmentData.parts[partId]) || null;
  }

  function partLabel(part) {
    return part ? part.name : "esa pieza";
  }

  function toolLabel(toolId) {
    var tools = getTools();
    var tool = tools && typeof tools.getTool === "function" ? tools.getTool(toolId) : null;
    return tool ? tool.name : toolId;
  }

  function emptyErrorCounts() {
    return {
      wrongTool: 0,
      blocked: 0,
      outOfOrder: 0,
      caseClosed: 0,
      wrongSafetyStep: 0,
      safetyPending: 0,
    };
  }

  // ── Particion de una secuencia en pre-seguridad / acciones / post-seguridad
  // Se deriva por POSICION (no hace falta un campo nuevo en los datos): todo
  // lo que va antes del primer paso "action" es seguridad previa; todo lo que
  // va despues del ultimo paso "action" es verificacion final.
  function partitionSequence(sequence) {
    var firstActionIdx = sequence.findIndex(function (s) {
      return s.kind === "action";
    });
    var lastActionIdx = -1;
    sequence.forEach(function (s, i) {
      if (s.kind === "action") lastActionIdx = i;
    });
    if (firstActionIdx === -1) {
      return { pre: sequence.slice(), actions: [], post: [] };
    }
    return {
      pre: sequence.slice(0, firstActionIdx),
      actions: sequence.slice(firstActionIdx, lastActionIdx + 1),
      post: sequence.slice(lastActionIdx + 1),
    };
  }

  function modeDirection(mode) {
    return /^assembly/.test(mode) ? "assembly" : "disassembly";
  }

  function modeKind(mode) {
    return /-open$/.test(mode) ? "open" : "guided";
  }

  // ── Creacion de sesion ────────────────────────────────────────────────────
  function createSession(equipmentData, mode, options) {
    var opts = options || {};
    var direction = modeDirection(mode);
    var kind = modeKind(mode);
    var sequence = equipmentData.sequences && equipmentData.sequences[direction];
    if (!sequence) {
      throw new Error("Modo no soportado por este equipo: " + mode);
    }
    var initialParts =
      direction === "assembly" ? equipmentData.initialStateAssembly : equipmentData.initialStateDisassembly;

    var session = {
      equipmentId: equipmentData.id,
      mode: mode,
      kind: kind,
      direction: direction,
      parts: Object.assign({}, initialParts),
      sequence: sequence,
      stepIndex: 0,
      errors: 0,
      errorsByType: emptyErrorCounts(),
      hints: { used: 0, max: opts.maxHints != null ? opts.maxHints : 3 },
      actionLog: [],
      startedAt: opts.now || new Date().toISOString(),
      finishedAt: null,
      result: null,
    };

    if (kind === "open") {
      var parts = partitionSequence(sequence);
      session.preIndex = 0;
      session.postIndex = 0;
      session._pre = parts.pre;
      session._post = parts.post;
    }

    return session;
  }

  function isFinished(session) {
    if (session.kind === "open") {
      return isGoalReachedOpen(session) && session.postIndex >= session._post.length;
    }
    return session.stepIndex >= session.sequence.length;
  }

  function isGoalReachedOpen(session) {
    var goalPresent = session.direction === "assembly";
    return Object.keys(session.parts).every(function (id) {
      return session.parts[id] === goalPresent;
    });
  }

  // Paso "forzado" actual: en guiado, siempre hay uno hasta terminar. En modo
  // abierto solo hay paso forzado durante las fases de seguridad (antes/
  // despues); en la fase intermedia (piezas) devuelve null: el aprendiz elige
  // libremente que pieza tocar.
  function currentStep(session) {
    if (session.kind === "open") {
      if (session.preIndex < session._pre.length) return session._pre[session.preIndex];
      if (!isGoalReachedOpen(session)) return null;
      if (session.postIndex < session._post.length) return session._post[session.postIndex];
      return null;
    }
    if (isFinished(session)) return null;
    return session.sequence[session.stepIndex];
  }

  // ── Reglas de gabinete/carcasa abierta o cerrada ─────────────────────────
  // equipmentData.caseGatePartId identifica QUE pieza gobierna el acceso a
  // las piezas "internal" (side-panel en escritorio, bottom-cover en
  // portatil): asi el motor no depende de un id fijo por equipo.
  function isCaseOpen(equipmentData, session) {
    var gateId = equipmentData.caseGatePartId;
    return !gateId || session.parts[gateId] === false;
  }

  function canOperateOnPart(equipmentData, session, partId) {
    var part = getPart(equipmentData, partId);
    if (!part) return { ok: false, reason: "Esa pieza no existe en este equipo." };
    if (part.location === "internal" && !isCaseOpen(equipmentData, session)) {
      return {
        ok: false,
        reason:
          "Primero debes " +
          (equipmentData.caseOpenActionLabel || "abrir la tapa lateral del gabinete") +
          " para acceder a esa pieza.",
        code: "caseClosed",
      };
    }
    return { ok: true };
  }

  // ── Dependencias fisicas ──────────────────────────────────────────────────
  function checkRequirements(equipmentData, session, partId, action) {
    var part = getPart(equipmentData, partId);
    if (!part) return { ok: false, missing: [] };
    var requiredIds =
      action === "remove" || action === "disconnect"
        ? part.removeRequires || []
        : part.installRequires || [];
    // remove/disconnect exige que los ids requeridos esten AUSENTES (false);
    // install/connect exige que esten PRESENTES (true).
    var expected = action === "remove" || action === "disconnect" ? false : true;
    var missing = requiredIds.filter(function (id) {
      return session.parts[id] !== expected;
    });
    return { ok: missing.length === 0, missing: missing, expected: expected };
  }

  function describeRequirementMessage(equipmentData, part, action, missingIds, expectedPresent) {
    var actionInfo = ACTION_LABELS[action];
    var missingNames = missingIds.map(function (id) {
      return partLabel(getPart(equipmentData, id));
    });
    var need = expectedPresent
      ? "Primero debes instalar/conectar: "
      : "Primero debes retirar/desconectar: ";
    return (
      "No puedes " +
      actionInfo.verb +
      " " +
      part.name +
      " todavia. " +
      need +
      missingNames.join(", ") +
      "."
    );
  }

  // ── Intento de paso de seguridad ──────────────────────────────────────────
  function attemptSafetyStep(session, stepId) {
    var step = currentStep(session);
    if (!step) {
      if (session.kind === "open" && !isFinished(session)) {
        return {
          ok: false,
          message: "No hay ningun paso de seguridad pendiente ahora: puedes actuar libremente sobre las piezas.",
          session: recordError(session, "wrongSafetyStep"),
        };
      }
      return { ok: false, message: "La practica ya esta completa.", session: session };
    }
    if (step.kind !== "safety") {
      return {
        ok: false,
        message: "Ese paso de seguridad no corresponde ahora; el paso actual es distinto.",
        session: recordError(session, "wrongSafetyStep"),
      };
    }
    if (step.id !== stepId) {
      return {
        ok: false,
        message: "Ese no es el paso de seguridad que sigue. Revisa las instrucciones actuales.",
        session: recordError(session, "wrongSafetyStep"),
      };
    }

    var next;
    if (session.kind === "open") {
      next = Object.assign({}, session);
      if (session.preIndex < session._pre.length) {
        next.preIndex = session.preIndex + 1;
      } else {
        next.postIndex = session.postIndex + 1;
      }
    } else {
      next = advance(session);
    }
    next = logAction(next, { type: "safety", stepId: stepId, ok: true });
    return { ok: true, message: "Paso de seguridad completado.", session: next, finished: isFinished(next) };
  }

  function attemptAction(equipmentData, session, attempt) {
    var step = currentStep(session);

    if (session.kind === "guided") {
      if (!step) {
        return { ok: false, message: "La practica ya esta completa.", session: session };
      }
      if (step.kind === "safety") {
        return {
          ok: false,
          message: "Primero debes completar el paso de seguridad actual: " + step.title + ".",
          session: recordError(session, "safetyPending"),
        };
      }
    } else {
      // Modo abierto: si hay un paso de seguridad forzado pendiente (pre o
      // post), bloquea cualquier accion sobre piezas hasta confirmarlo.
      if (step && step.kind === "safety") {
        return {
          ok: false,
          message: "Primero debes completar el paso de seguridad actual: " + step.title + ".",
          session: recordError(session, "safetyPending"),
        };
      }
      if (isFinished(session)) {
        return { ok: false, message: "La practica ya esta completa.", session: session };
      }
    }

    var part = getPart(equipmentData, attempt.partId);
    if (!part) {
      return { ok: false, message: "Esa pieza no existe en este equipo.", session: session };
    }

    var actionInfo = ACTION_LABELS[attempt.action];
    if (!actionInfo) {
      return { ok: false, message: "Accion no reconocida.", session: session };
    }

    // 1) Gabinete cerrado bloquea cualquier pieza interna, sin importar el orden.
    var caseCheck = canOperateOnPart(equipmentData, session, attempt.partId);
    if (!caseCheck.ok) {
      return {
        ok: false,
        message: caseCheck.reason,
        session: recordError(session, caseCheck.code || "blocked"),
      };
    }

    // 2) Herramienta incorrecta: no se permite la accion automaticamente.
    var requiredTool = part.tool || "hands";
    if (requiredTool !== "hands" && attempt.toolId !== requiredTool) {
      return {
        ok: false,
        message:
          "Herramienta incorrecta. Para " +
          actionInfo.verb +
          " " +
          part.name +
          " debes usar: " +
          toolLabel(requiredTool) +
          ".",
        session: recordError(session, "wrongTool"),
      };
    }

    // 3) Dependencias fisicas de la propia pieza (validas para CUALQUIER
    //    intento, no solo el paso actual: asi el mensaje educativo del item
    //    16 aparece aunque el aprendiz intente otra pieza fuera de orden).
    var reqCheck = checkRequirements(equipmentData, session, attempt.partId, attempt.action);
    if (!reqCheck.ok) {
      return {
        ok: false,
        message: describeRequirementMessage(equipmentData, part, attempt.action, reqCheck.missing, reqCheck.expected),
        session: recordError(session, "blocked"),
      };
    }

    // 4) Solo en modo guiado: ¿es el paso que sigue en la secuencia fija?
    if (session.kind === "guided") {
      var matchesCurrentStep =
        step.kind === "action" && step.action === attempt.action && step.partId === attempt.partId;
      if (!matchesCurrentStep) {
        var nextPart = getPart(equipmentData, step.partId);
        var nextInfo = ACTION_LABELS[step.action];
        return {
          ok: false,
          message:
            "Esa accion es posible, pero en la practica guiada el siguiente paso es: " +
            nextInfo.verb +
            " " +
            (nextPart ? nextPart.name : "") +
            ".",
          session: recordError(session, "outOfOrder"),
        };
      }
    }

    // 5) Ya esta en el estado pedido (idempotente, evita romper el conteo si
    //    la UI llega a reenviar una accion ya aplicada).
    if (session.parts[attempt.partId] === ACTION_TARGET_PRESENT[attempt.action]) {
      return {
        ok: true,
        message: part.name + " ya se encontraba " + actionInfo.pastParticiple + ".",
        session: session,
        finished: isFinished(session),
      };
    }

    // 6) Todo correcto: aplica el cambio de estado y avanza (solo el guiado
    //    tiene un indice de paso que avanzar; el abierto solo cambia parts).
    var updatedParts = Object.assign({}, session.parts);
    updatedParts[attempt.partId] = ACTION_TARGET_PRESENT[attempt.action];
    var updatedSession = Object.assign({}, session, { parts: updatedParts });
    if (session.kind === "guided") {
      updatedSession = advance(updatedSession);
    }
    updatedSession = logAction(updatedSession, {
      type: "action",
      action: attempt.action,
      partId: attempt.partId,
      toolId: attempt.toolId,
      ok: true,
    });

    return {
      ok: true,
      message: part.name + " " + actionInfo.pastParticiple + " correctamente.",
      session: updatedSession,
      finished: isFinished(updatedSession),
    };
  }

  // ── Pistas (item 31): maximo N por practica, cada una resta puntos ───────
  function useHint(session) {
    if (session.hints.used >= session.hints.max) {
      return { ok: false, message: "Ya usaste el maximo de pistas disponibles.", session: session };
    }
    var updated = Object.assign({}, session, {
      hints: { used: session.hints.used + 1, max: session.hints.max },
    });
    updated = logAction(updated, { type: "hint", ok: true });
    return { ok: true, hintsRemaining: updated.hints.max - updated.hints.used, session: updated };
  }

  function advance(session) {
    return Object.assign({}, session, { stepIndex: session.stepIndex + 1 });
  }

  function recordError(session, type) {
    var errorsByType = Object.assign({}, session.errorsByType);
    errorsByType[type] = (errorsByType[type] || 0) + 1;
    return logAction(
      Object.assign({}, session, {
        errors: session.errors + 1,
        errorsByType: errorsByType,
      }),
      { type: "error", errorType: type, ok: false }
    );
  }

  function logAction(session, entry) {
    var actionLog = session.actionLog.concat([
      Object.assign({ ts: new Date().toISOString() }, entry),
    ]);
    // Limite razonable para no crecer sin fin en sesiones muy largas.
    if (actionLog.length > 200) {
      actionLog = actionLog.slice(actionLog.length - 200);
    }
    return Object.assign({}, session, { actionLog: actionLog });
  }

  // ── Resultado final: rubrica de 4 categorias (item 17) ───────────────────
  // Procedimiento 30 · Herramientas 20 · Seguridad 20 · Orden 20 = 100.
  // En modo guiado "Orden" casi siempre queda perfecto (el motor ya impide
  // el desorden); en modo abierto es donde realmente se pone a prueba.
  var CATEGORY_MAX = { procedimiento: 30, herramientas: 20, seguridad: 20, orden: 20 };
  var PASS_THRESHOLD = 70;

  function computeScoreBreakdown(session) {
    var e = session.errorsByType;
    var procedimiento = Math.max(
      0,
      CATEGORY_MAX.procedimiento - (e.blocked || 0) * 3 - session.hints.used * 3
    );
    var herramientas = Math.max(0, CATEGORY_MAX.herramientas - (e.wrongTool || 0) * 4);
    var seguridad = Math.max(
      0,
      CATEGORY_MAX.seguridad -
        (e.caseClosed || 0) * 5 -
        (e.safetyPending || 0) * 5 -
        (e.wrongSafetyStep || 0) * 5
    );
    var orden = Math.max(0, CATEGORY_MAX.orden - (e.outOfOrder || 0) * 4);
    return {
      procedimiento: { value: procedimiento, max: CATEGORY_MAX.procedimiento },
      herramientas: { value: herramientas, max: CATEGORY_MAX.herramientas },
      seguridad: { value: seguridad, max: CATEGORY_MAX.seguridad },
      orden: { value: orden, max: CATEGORY_MAX.orden },
      total: procedimiento + herramientas + seguridad + orden,
    };
  }

  function totalStepsFor(session) {
    if (session.kind === "open") {
      return session._pre.length + Object.keys(session.parts).length + session._post.length;
    }
    return session.sequence.length;
  }

  function finish(session, options) {
    var opts = options || {};
    var finishedAt = opts.now || new Date().toISOString();
    var durationSeconds = Math.max(
      0,
      Math.round((Date.parse(finishedAt) - Date.parse(session.startedAt)) / 1000)
    );
    var breakdown = computeScoreBreakdown(session);
    var result = {
      equipmentId: session.equipmentId,
      mode: session.mode,
      totalSteps: totalStepsFor(session),
      errors: session.errors,
      errorsByType: session.errorsByType,
      hintsUsed: session.hints.used,
      durationSeconds: durationSeconds,
      breakdown: breakdown,
      score: breakdown.total,
      status: breakdown.total >= PASS_THRESHOLD ? "APROBADO" : "POR MEJORAR",
    };
    return Object.assign({}, session, { finishedAt: finishedAt, result: result });
  }

  // ── Serializacion (para localStorage / Firestore) ────────────────────────
  // No se guarda "sequence"/"_pre"/"_post" (son datos estaticos del equipo,
  // se reconstruyen al cargar) para mantener el documento liviano.
  function serialize(session) {
    return {
      equipmentId: session.equipmentId,
      mode: session.mode,
      kind: session.kind,
      direction: session.direction,
      parts: session.parts,
      stepIndex: session.stepIndex,
      preIndex: session.preIndex,
      postIndex: session.postIndex,
      errors: session.errors,
      errorsByType: session.errorsByType,
      hints: session.hints,
      actionLog: session.actionLog,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      result: session.result,
    };
  }

  function deserialize(equipmentData, data) {
    var direction = data.direction || modeDirection(data.mode);
    var sequence = equipmentData.sequences[direction];
    var restored = Object.assign({}, data, { sequence: sequence, direction: direction });
    if (!restored.errorsByType) restored.errorsByType = emptyErrorCounts();
    if (!restored.hints) restored.hints = { used: 0, max: 3 };
    if (restored.kind === "open") {
      var parts = partitionSequence(sequence);
      restored._pre = parts.pre;
      restored._post = parts.post;
      if (restored.preIndex == null) restored.preIndex = 0;
      if (restored.postIndex == null) restored.postIndex = 0;
    }
    return restored;
  }

  var api = {
    createSession: createSession,
    currentStep: currentStep,
    isFinished: isFinished,
    isGoalReachedOpen: isGoalReachedOpen,
    isCaseOpen: isCaseOpen,
    canOperateOnPart: canOperateOnPart,
    checkRequirements: checkRequirements,
    attemptAction: attemptAction,
    attemptSafetyStep: attemptSafetyStep,
    useHint: useHint,
    finish: finish,
    computeScoreBreakdown: computeScoreBreakdown,
    serialize: serialize,
    deserialize: deserialize,
    partitionSequence: partitionSequence,
    modeDirection: modeDirection,
    modeKind: modeKind,
    ACTION_LABELS: ACTION_LABELS,
    ACTION_TARGET_PRESENT: ACTION_TARGET_PRESENT,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Engine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
