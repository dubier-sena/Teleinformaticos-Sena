/* js/hardware_lab_diagnosis_engine.js
 *
 * Motor del modulo "Diagnostico y reparacion" (items 18-35). Reutiliza las
 * funciones SIN ESTADO del motor de ensamble (hardware_lab_engine.js):
 * canOperateOnPart, checkRequirements, ACTION_LABELS, ACTION_TARGET_PRESENT.
 * No reutiliza createSession/attemptAction de ese motor porque un caso de
 * diagnostico no tiene una "secuencia" fija que recorrer: empieza YA armado
 * (con una falla especifica) y el aprendiz decide libremente que inspeccionar
 * y que accion tomar, hasta encender y comprobar que quedo resuelto.
 *
 * Dos piezas EXTRA (cable de pared, cable de video) existen SOLO en el
 * contexto de diagnostico: son externas al equipo "de armado" (no se usan en
 * ensamble/desensamble) pero son necesarias para los Casos 1 y 3, que
 * enseñan que no siempre hay que abrir el computador (item 21).
 */
(function (root) {
  "use strict";

  var DIAGNOSIS_EXTRA_PARTS = {
    "power-cable-wall": {
      id: "power-cable-wall",
      kind: "cable",
      name: "Cable de alimentacion a la pared",
      location: "external",
      icon: "\u{1F50C}",
      tool: "hands",
      removeRequires: [],
      installRequires: [],
      info: {
        function: "Lleva la energia de la toma de corriente hasta la fuente de poder.",
        precautions: "Revisa tambien que el switch trasero de la fuente (0/1) este en la posicion correcta.",
      },
    },
    "cable-video": {
      id: "cable-video",
      kind: "cable",
      name: "Cable de video (HDMI/DisplayPort)",
      location: "external",
      icon: "\u{1F50C}",
      tool: "hands",
      removeRequires: [],
      installRequires: [],
      info: {
        function: "Lleva la señal de imagen desde la tarjeta grafica hasta el monitor.",
        precautions: "Verifica que este conectado en la salida de la GPU dedicada, no en la del panel trasero de la placa (si el equipo tiene ambas).",
      },
    },
  };

  function getEngine() {
    return root.HardwareLab.Engine;
  }

  function mergedEquipment(equipmentData) {
    return Object.assign({}, equipmentData, {
      parts: Object.assign({}, equipmentData.parts, DIAGNOSIS_EXTRA_PARTS),
    });
  }

  function getPart(equipmentData, partId) {
    var merged = mergedEquipment(equipmentData);
    return merged.parts[partId] || null;
  }

  function emptyErrorCounts() {
    return { wrongTool: 0, blocked: 0, caseClosed: 0 };
  }

  // ── Resolucion de la falla (soporta pool aleatorio, item 29) ─────────────
  function resolveFault(caseDef, rng) {
    var random = rng || Math.random;
    if (caseDef.faultPool && caseDef.faultPool.length) {
      var idx = Math.floor(random() * caseDef.faultPool.length);
      return caseDef.faultPool[idx];
    }
    return caseDef.fault;
  }

  // ── Creacion de sesion ────────────────────────────────────────────────────
  function createDiagnosisSession(equipmentData, caseDef, options) {
    var opts = options || {};
    var merged = mergedEquipment(equipmentData);
    var fault = resolveFault(caseDef, opts.rng);

    // Estado inicial: todo presente/conectado (equipo funcionando), excepto
    // lo que la falla indique.
    var parts = {};
    Object.keys(merged.parts).forEach(function (id) {
      parts[id] = true;
    });
    (fault.overrides || []).forEach(function (o) {
      parts[o.partId] = o.present;
    });

    return {
      caseId: caseDef.id,
      equipmentId: equipmentData.id,
      level: caseDef.level,
      parts: parts,
      faultPartIds: fault.relevantPartIds.slice(),
      relevantPartIds: fault.relevantPartIds.slice(),
      fixCondition: fault.fixCondition,
      symptomBroken: fault.symptomBroken || caseDef.symptom,
      symptomFixed: fault.symptomFixed || "El equipo funciona con normalidad.",
      errors: 0,
      errorsByType: emptyErrorCounts(),
      hints: { used: 0, max: 3 },
      actionLog: [],
      unnecessaryPartIds: [],
      checkAttempts: 0,
      fixed: false,
      startedAt: opts.now || new Date().toISOString(),
      finishedAt: null,
      result: null,
    };
  }

  function isCaseOpen(equipmentData, session) {
    var Engine = getEngine();
    return Engine.isCaseOpen(mergedEquipment(equipmentData), session);
  }

  // ── Intento de accion sobre una pieza ────────────────────────────────────
  function attemptAction(equipmentData, session, attempt) {
    var Engine = getEngine();
    var merged = mergedEquipment(equipmentData);
    var part = getPart(equipmentData, attempt.partId);
    if (!part) {
      return { ok: false, message: "Esa pieza no existe en este equipo.", session: session };
    }
    var actionInfo = Engine.ACTION_LABELS[attempt.action];
    if (!actionInfo) {
      return { ok: false, message: "Accion no reconocida.", session: session };
    }

    var caseCheck = Engine.canOperateOnPart(merged, session, attempt.partId);
    if (!caseCheck.ok) {
      return { ok: false, message: caseCheck.reason, session: recordError(session, caseCheck.code || "blocked") };
    }

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

    var reqCheck = Engine.checkRequirements(merged, session, attempt.partId, attempt.action);
    if (!reqCheck.ok) {
      var missingNames = reqCheck.missing.map(function (id) {
        return getPart(equipmentData, id).name;
      });
      var need = reqCheck.expected ? "Primero debes instalar/conectar: " : "Primero debes retirar/desconectar: ";
      return {
        ok: false,
        message: "No puedes " + actionInfo.verb + " " + part.name + " todavia. " + need + missingNames.join(", ") + ".",
        session: recordError(session, "blocked"),
      };
    }

    if (session.parts[attempt.partId] === Engine.ACTION_TARGET_PRESENT[attempt.action]) {
      return { ok: true, message: part.name + " ya se encontraba " + actionInfo.pastParticiple + ".", session: session };
    }

    var updatedParts = Object.assign({}, session.parts);
    updatedParts[attempt.partId] = Engine.ACTION_TARGET_PRESENT[attempt.action];
    var updated = Object.assign({}, session, { parts: updatedParts });
    updated = logAction(updated, { type: "action", action: attempt.action, partId: attempt.partId, toolId: attempt.toolId, ok: true });

    // Eficiencia (item 32): registra piezas tocadas que NO son parte de la
    // falla real, sin impedir la accion (es tecnicamente posible).
    if (session.relevantPartIds.indexOf(attempt.partId) === -1 && updated.unnecessaryPartIds.indexOf(attempt.partId) === -1) {
      updated = Object.assign({}, updated, {
        unnecessaryPartIds: updated.unnecessaryPartIds.concat([attempt.partId]),
      });
    }

    return { ok: true, message: part.name + " " + actionInfo.pastParticiple + " correctamente.", session: updated };
  }

  function toolLabel(toolId) {
    var tools = root.HardwareLab.Tools;
    var tool = tools && typeof tools.getTool === "function" ? tools.getTool(toolId) : null;
    return tool ? tool.name : toolId;
  }

  function recordError(session, type) {
    var errorsByType = Object.assign({}, session.errorsByType);
    errorsByType[type] = (errorsByType[type] || 0) + 1;
    return logAction(Object.assign({}, session, { errors: session.errors + 1, errorsByType: errorsByType }), {
      type: "error",
      errorType: type,
      ok: false,
    });
  }

  function logAction(session, entry) {
    var actionLog = session.actionLog.concat([Object.assign({ ts: new Date().toISOString() }, entry)]);
    if (actionLog.length > 200) actionLog = actionLog.slice(actionLog.length - 200);
    return Object.assign({}, session, { actionLog: actionLog });
  }

  // ── Condicion de arreglo: por estado o por "reasiento" (remover+instalar) ─
  function hasReseated(session, partId) {
    var removedAt = -1;
    for (var i = 0; i < session.actionLog.length; i++) {
      var e = session.actionLog[i];
      if (e.type !== "action" || e.partId !== partId) continue;
      if ((e.action === "remove" || e.action === "disconnect") && removedAt === -1) removedAt = i;
      if ((e.action === "install" || e.action === "connect") && removedAt !== -1) return true;
    }
    return false;
  }

  function isFixConditionMet(equipmentData, session) {
    var cond = session.fixCondition;
    if (cond.type === "stateEquals") {
      return session.parts[cond.partId] === cond.present;
    }
    if (cond.type === "reseated") {
      if (!hasReseated(session, cond.partId) || session.parts[cond.partId] !== true) return false;
      // No basta con que la pieza vuelva a estar presente: si tiene sus
      // propios cables (p.ej. GPU necesita su cable de alimentacion, el
      // disipador necesita el cable del ventilador), esos TAMBIEN deben
      // quedar reconectados para considerar la reparacion completa. Sin este
      // chequeo, "reasentar" la GPU sin reconectar su alimentacion se
      // marcaria como resuelto aunque en la realidad seguiria sin dar imagen.
      var part = getPart(equipmentData, cond.partId);
      var requires = (part && part.removeRequires) || [];
      return requires.every(function (id) {
        return session.parts[id] === true;
      });
    }
    return false;
  }

  // ── "Encender y comprobar" (no finaliza la sesion: eso lo decide la UI
  //    llamando a finish() cuando fixed=true, para poder mostrar el mensaje
  //    de exito antes de pasar a la pantalla de resultado) ──────────────────
  function checkPowerOn(equipmentData, session) {
    var fixed = isFixConditionMet(equipmentData, session);
    var updated = Object.assign({}, session, {
      checkAttempts: session.checkAttempts + 1,
      fixed: fixed,
    });
    updated = logAction(updated, { type: "power-on-check", ok: fixed });
    return { fixed: fixed, message: fixed ? updated.symptomFixed : updated.symptomBroken, session: updated };
  }

  // ── Pistas (item 31) ───────────────────────────────────────────────────────
  function useHint(session, caseDef) {
    if (session.hints.used >= session.hints.max) {
      return { ok: false, message: "Ya usaste el maximo de pistas disponibles.", session: session };
    }
    var hintText = (caseDef.hints || [])[session.hints.used] || "No hay mas pistas para este caso.";
    var updated = Object.assign({}, session, { hints: { used: session.hints.used + 1, max: session.hints.max } });
    updated = logAction(updated, { type: "hint", ok: true });
    return { ok: true, message: hintText, session: updated };
  }

  // ── Resultado final: rubrica de 5 categorias (item 33) ────────────────────
  var CATEGORY_MAX = { diagnostico: 30, procedimiento: 25, reparacion: 25, herramientas: 10, eficiencia: 10 };
  var PASS_THRESHOLD = 70;

  function computeScoreBreakdown(session) {
    var e = session.errorsByType;
    var diagnostico = session.fixed
      ? Math.max(10, CATEGORY_MAX.diagnostico - session.hints.used * 5)
      : 0;
    var procedimiento = Math.max(0, CATEGORY_MAX.procedimiento - (e.blocked || 0) * 3 - (e.caseClosed || 0) * 3);
    var reparacion = session.fixed ? CATEGORY_MAX.reparacion : 0;
    var herramientas = Math.max(0, CATEGORY_MAX.herramientas - (e.wrongTool || 0) * 3);
    var eficiencia = Math.max(0, CATEGORY_MAX.eficiencia - session.unnecessaryPartIds.length * 2);
    return {
      diagnostico: { value: diagnostico, max: CATEGORY_MAX.diagnostico },
      procedimiento: { value: procedimiento, max: CATEGORY_MAX.procedimiento },
      reparacion: { value: reparacion, max: CATEGORY_MAX.reparacion },
      herramientas: { value: herramientas, max: CATEGORY_MAX.herramientas },
      eficiencia: { value: eficiencia, max: CATEGORY_MAX.eficiencia },
      total: diagnostico + procedimiento + reparacion + herramientas + eficiencia,
    };
  }

  function finish(session, options) {
    var opts = options || {};
    var finishedAt = opts.now || new Date().toISOString();
    var durationSeconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(session.startedAt)) / 1000));
    var breakdown = computeScoreBreakdown(session);
    var result = {
      caseId: session.caseId,
      diagnosisCorrect: session.fixed,
      durationSeconds: durationSeconds,
      hintsUsed: session.hints.used,
      errors: session.errors,
      unnecessaryParts: session.unnecessaryPartIds.length,
      breakdown: breakdown,
      score: breakdown.total,
      status: breakdown.total >= PASS_THRESHOLD ? "APROBADO" : "POR MEJORAR",
    };
    return Object.assign({}, session, { finishedAt: finishedAt, result: result });
  }

  // ── Serializacion ──────────────────────────────────────────────────────────
  function serialize(session) {
    return {
      caseId: session.caseId,
      equipmentId: session.equipmentId,
      level: session.level,
      parts: session.parts,
      faultPartIds: session.faultPartIds,
      relevantPartIds: session.relevantPartIds,
      fixCondition: session.fixCondition,
      symptomBroken: session.symptomBroken,
      symptomFixed: session.symptomFixed,
      errors: session.errors,
      errorsByType: session.errorsByType,
      hints: session.hints,
      actionLog: session.actionLog,
      unnecessaryPartIds: session.unnecessaryPartIds,
      checkAttempts: session.checkAttempts,
      fixed: session.fixed,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      result: session.result,
    };
  }

  function deserialize(data) {
    return Object.assign({}, data);
  }

  var api = {
    DIAGNOSIS_EXTRA_PARTS: DIAGNOSIS_EXTRA_PARTS,
    getPart: getPart,
    createDiagnosisSession: createDiagnosisSession,
    isCaseOpen: isCaseOpen,
    attemptAction: attemptAction,
    checkPowerOn: checkPowerOn,
    useHint: useHint,
    finish: finish,
    computeScoreBreakdown: computeScoreBreakdown,
    serialize: serialize,
    deserialize: deserialize,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DiagnosisEngine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
