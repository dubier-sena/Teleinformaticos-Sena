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
        precautions: "Revisa también que el switch trasero de la fuente (0/1) esté en la posición correcta.",
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

  // Las dos piezas externas son del PC de escritorio (fuente de poder, GPU
  // con monitor externo). El portatil no las tiene en su escena: no se mezclan.
  var EXTRA_PARTS_BY_EQUIPMENT = {
    desktop: DIAGNOSIS_EXTRA_PARTS,
  };

  // Pieza que, en el portatil, corta la energia interna: desconectarla ANTES de
  // tocar componentes internos es el procedimiento seguro (y reconectarla
  // ANTES de encender, para la comprobacion final).
  var POWER_SOURCE_PART_BY_EQUIPMENT = {
    laptop: "cable-battery",
  };

  // Acceso seguro minimo de cada equipo (traza de diagnostico, no nota).
  var EXTRA_ACCESS_BY_EQUIPMENT = {
    laptop: ["bottom-cover", "cable-battery"],
  };

  // Equipos con sistema de refrigeracion modelado (hardware_lab_thermal.js):
  // el diagnostico CONSUME ese estado (polvo, pasta, montaje del disipador),
  // no tiene uno propio.
  var THERMAL_EQUIPMENT = { laptop: true };

  function getEngine() {
    return root.HardwareLab.Engine;
  }

  function getThermal() {
    return root.HardwareLab.Thermal || null;
  }

  function hasThermal(equipmentData) {
    return !!(THERMAL_EQUIPMENT[equipmentData && equipmentData.id] && getThermal());
  }

  /** Estado termico inicial de la sesion: el de la variante, o "en buen
   *  estado" cuando la falla no es termica. */
  function initialThermal(equipmentData, fault) {
    if (!hasThermal(equipmentData)) return null;
    var Thermal = getThermal();
    return fault && fault.thermal ? Thermal.normalize(fault.thermal) : Thermal.createThermalState("serviced");
  }

  function extraPartsFor(equipmentData) {
    return EXTRA_PARTS_BY_EQUIPMENT[equipmentData && equipmentData.id] || {};
  }

  function mergedEquipment(equipmentData) {
    return Object.assign({}, equipmentData, {
      parts: Object.assign({}, equipmentData.parts, extraPartsFor(equipmentData)),
    });
  }

  function getPart(equipmentData, partId) {
    var merged = mergedEquipment(equipmentData);
    return merged.parts[partId] || null;
  }

  function emptyErrorCounts() {
    return { wrongTool: 0, blocked: 0, caseClosed: 0, unsafe: 0, thermal: 0 };
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
      // Variante activa (casos con varias causas posibles). Solo para la
      // evaluacion, las pruebas y el repaso final: la interfaz no la muestra.
      variantId: fault.variantId || null,
      thermal: initialThermal(equipmentData, fault),
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
      return { ok: false, message: "Acción no reconocida.", session: session };
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
    // Seguridad (portatil): manipular un componente interno con la bateria
    // aun conectada. No se permite (como en la realidad, es riesgoso) y se
    // registra como procedimiento INSEGURO, distinto de un simple orden.
    var powerPart = POWER_SOURCE_PART_BY_EQUIPMENT[equipmentData.id];
    if (!reqCheck.ok && powerPart && !reqCheck.expected && reqCheck.missing.indexOf(powerPart) !== -1) {
      return {
        ok: false,
        message:
          "Por seguridad, desconecta primero la batería antes de " +
          actionInfo.verb +
          " " +
          part.name +
          ": trabajar con el equipo energizado puede dañar los componentes.",
        session: recordError(session, "unsafe"),
      };
    }
    if (!reqCheck.ok) {
      var missingNames = reqCheck.missing.map(function (id) {
        return getPart(equipmentData, id).name;
      });
      var need = reqCheck.expected ? "Primero debes instalar/conectar: " : "Primero debes retirar/desconectar: ";
      return {
        ok: false,
        message: "No puedes " + actionInfo.verb + " " + part.name + " todavía. " + need + missingNames.join(", ") + ".",
        session: recordError(session, "blocked"),
      };
    }

    if (session.parts[attempt.partId] === Engine.ACTION_TARGET_PRESENT[attempt.action]) {
      return { ok: true, message: actionInfo.alreadyLabel + ": " + part.name + ".", session: session };
    }

    // Misma regla que el mantenimiento: el modulo de refrigeracion solo se
    // monta con pasta nueva bien dosificada. Explica que falta, sin castigo.
    if (attempt.partId === "cooler" && attempt.action === "install" && hasThermal(equipmentData) && session.thermal) {
      var gate = getThermal().coolerInstallGate(session.thermal);
      if (!gate.ok) return { ok: false, blockedByThermal: true, message: gate.reason, session: session };
    }

    var updatedParts = Object.assign({}, session.parts);
    updatedParts[attempt.partId] = Engine.ACTION_TARGET_PRESENT[attempt.action];
    var updated = Object.assign({}, session, { parts: updatedParts });
    updated = logAction(updated, { type: "action", action: attempt.action, partId: attempt.partId, toolId: attempt.toolId, ok: true });

    updated = noteFaultTransition(equipmentData, session, updated, { action: attempt.action, partId: attempt.partId });

    // Eficiencia (item 32): registra piezas tocadas que NO son parte de la
    // falla real, sin impedir la accion (es tecnicamente posible).
    if (session.relevantPartIds.indexOf(attempt.partId) === -1 && updated.unnecessaryPartIds.indexOf(attempt.partId) === -1) {
      updated = Object.assign({}, updated, {
        unnecessaryPartIds: updated.unnecessaryPartIds.concat([attempt.partId]),
      });
    }

    return { ok: true, message: actionInfo.doneLabel + ": " + part.name + ".", session: updated };
  }

  /** Intento de trabajar un componente interno con la bateria conectada que
   *  se detecta fuera de attemptAction (p. ej. un tornillo): mismo registro. */
  function recordUnsafeAttempt(session, partId) {
    var updated = recordError(session, "unsafe");
    var last = updated.actionLog[updated.actionLog.length - 1];
    if (last) last.partId = partId;
    return updated;
  }

  /**
   * Tarea de mantenimiento termico (brocha, aire, pasta...) durante el
   * diagnostico. La regla es la de hardware_lab_thermal.js (applyTask): el
   * orden incorrecto no cambia el estado y se registra como error de
   * procedimiento; una tarea innecesaria (p. ej. limpiar lo que ya esta
   * limpio) solo informa.
   */
  function applyThermalTask(equipmentData, session, taskId, opts) {
    if (!hasThermal(equipmentData) || !session.thermal) {
      return { ok: false, level: "info", message: "Este equipo no tiene tareas de refrigeración.", session: session };
    }
    // Igual que con cualquier componente interno: con la bateria conectada no
    // se trabaja (el modulo fuera no apaga el equipo).
    var powerPart = POWER_SOURCE_PART_BY_EQUIPMENT[equipmentData.id];
    if (powerPart && session.parts.cooler === false && session.parts[powerPart] === true) {
      var unsafe = recordError(session, "unsafe");
      unsafe.actionLog[unsafe.actionLog.length - 1].task = taskId;
      return {
        ok: false,
        level: "error",
        message: "Por seguridad, desconecta primero la batería antes de trabajar en la refrigeración: el equipo sigue energizado.",
        session: unsafe,
      };
    }
    var r = getThermal().applyTask(session.thermal, taskId, {
      coolerInstalled: session.parts.cooler !== false,
      cpuInstalled: session.parts.cpu !== false,
    }, opts);
    var updated = Object.assign({}, session, { thermal: r.state });
    if (r.level === "error") {
      updated = recordError(updated, "thermal");
      updated.actionLog[updated.actionLog.length - 1].task = taskId;
    } else if (r.ok) {
      updated = logAction(updated, { type: "thermal", task: taskId, amount: (opts && opts.amount) || null, ok: true });
      updated = noteFaultTransition(equipmentData, session, updated, { task: taskId });
    } else {
      // Tarea sin efecto (p. ej. limpiar lo ya limpio): no penaliza, pero
      // queda en la traza de diagnostico (reparacion "por si acaso").
      updated = logAction(updated, { type: "thermal-noop", task: taskId, ok: false });
    }
    return { ok: r.ok, level: r.level, message: r.message, session: updated };
  }

  /** Que accion REAL dejo corregida la falla (o la volvio a romper). Solo se
   *  registra el cambio de estado: el repaso lo explica sin inventar. */
  function noteFaultTransition(equipmentData, before, after, by) {
    var was = isFixConditionMet(equipmentData, before);
    var now = isFixConditionMet(equipmentData, after);
    if (was === now) return after;
    return logAction(after, Object.assign({ type: now ? "fault-fixed" : "fault-reopened", ok: now }, by));
  }

  /** Ultima accion que corrigio la falla (o null). */
  function fixedBy(session) {
    for (var i = session.actionLog.length - 1; i >= 0; i--) {
      var e = session.actionLog[i];
      if (e.type === "fault-reopened") return null;
      if (e.type === "fault-fixed") return e;
    }
    return null;
  }

  /**
   * Traza de diagnostico (microfase C.2, punto 56). NO cambia la nota: son
   * datos para decidir despues si "identificar la causa" se evalua aparte.
   *   corrected: la condicion de la falla quedo corregida.
   *   identifiedBeforeRepair: reparacion DIRIGIDA: solo se manipulo lo que esa
   *     causa exige (acceso seguro + la pieza y lo que fisicamente hay que
   *     retirar para llegar a ella) y ninguna tarea termica ajena a la causa.
   *   repairedWithoutDiagnosis: corregida, pero con manipulaciones o tareas de
   *     otras causas posibles ("servicio completo" que acerto sin distinguir).
   * Es una inferencia por acciones (no hay un control para declarar la
   * hipotesis): se informa como tal.
   */
  var NEEDED_THERMAL_TASKS = { dust: ["brush", "air"], paste: ["scrape", "alcohol", "apply"] };
  function minimalParts(equipmentData, session) {
    var need = {};
    (EXTRA_ACCESS_BY_EQUIPMENT[equipmentData.id] || []).forEach(function (id) { need[id] = true; });
    var powerPart = POWER_SOURCE_PART_BY_EQUIPMENT[equipmentData.id];
    function add(id) {
      if (need[id]) return;
      need[id] = true;
      var p = getPart(equipmentData, id);
      ((p && p.removeRequires) || []).forEach(function (r) { if (r !== powerPart) add(r); });
    }
    var cond = session.fixCondition || {};
    if (cond.type === "reseated" || cond.type === "stateEquals") add(cond.partId);
    if (cond.type === "thermalReady") add("cooler");
    return need;
  }
  function diagnosisTrace(equipmentData, session) {
    var need = minimalParts(equipmentData, session);
    var touched = [];
    var tasks = [];
    session.actionLog.forEach(function (e) {
      if (e.type === "action" && (e.action === "remove" || e.action === "disconnect") && touched.indexOf(e.partId) === -1) touched.push(e.partId);
      if ((e.type === "thermal" || e.type === "thermal-noop") && tasks.indexOf(e.task) === -1) tasks.push(e.task);
    });
    var variantKey = session.fixCondition && session.fixCondition.type === "thermalReady" && session.variantId
      ? String(session.variantId).split(":").pop()
      : null;
    var neededTasks = NEEDED_THERMAL_TASKS[variantKey] || [];
    var extraParts = touched.filter(function (id) { return !need[id]; });
    var extraTasks = tasks.filter(function (t) { return neededTasks.indexOf(t) === -1; });
    var corrected = isFixConditionMet(equipmentData, session);
    var targeted = corrected && extraParts.length === 0 && extraTasks.length === 0;
    return {
      corrected: corrected,
      identifiedBeforeRepair: targeted,
      repairedWithoutDiagnosis: corrected && !targeted,
      extraParts: extraParts,
      extraThermalTasks: extraTasks,
      fixedBy: fixedBy(session),
      basis: "acciones",
    };
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
      // La bateria del portatil es requisito de SEGURIDAD para retirar casi
      // cualquier pieza interna, no una conexion propia de la pieza: que este
      // desconectada no significa que la falla siga (eso lo exige, aparte, la
      // regla de "equipo listo para comprobar").
      var powerPart = POWER_SOURCE_PART_BY_EQUIPMENT[equipmentData && equipmentData.id];
      var requires = ((part && part.removeRequires) || []).filter(function (id) {
        return id !== powerPart;
      });
      return requires.every(function (id) {
        return session.parts[id] === true;
      });
    }
    if (cond.type === "thermalReady") {
      return hasThermal(equipmentData) && getThermal().isReady(session.thermal);
    }
    return false;
  }

  // ── Equipo LISTO para la comprobacion final (sep-27) ──────────────────────
  // Corregir la falla no basta: para encender y comprobar, el equipo debe
  // quedar en condiciones seguras y funcionales. Antes solo se evaluaba la
  // condicion de la falla y se aprobaba, por ejemplo, el caso del cable SATA
  // con la RAM retirada y el gabinete abierto (reproducido con clic real).
  //   Escritorio: todas sus piezas instaladas/conectadas (tapa lateral puesta
  //   y cables externos incluidos).
  //   Portatil: todas sus piezas instaladas/conectadas (bateria y su cable,
  //   tapa inferior) y los tornillos de cierre colocados. Durante la
  //   reparacion la bateria desconectada es lo CORRECTO; solo al comprobar
  //   debe estar conectada.
  // No se exige el estado original exacto (posicion de la camara, orden en
  // que se armo, etc.): solo lo necesario para encender con seguridad.
  // `external.screwsSecured` lo informa la UI (el motor no modela tornillos).
  function equipmentReadyForPowerTest(equipmentData, session, external) {
    var merged = mergedEquipment(equipmentData);
    var missing = Object.keys(merged.parts).filter(function (id) {
      return session.parts[id] !== true;
    });
    var screwsSecured = !external || external.screwsSecured !== false;
    return { ready: missing.length === 0 && screwsSecured, missingPartIds: missing, screwsSecured: screwsSecured };
  }

  var NOT_READY_MESSAGE =
    "La falla parece corregida, pero el equipo todavía no está en condiciones de encenderse para la " +
    "comprobación final. Revisa que todo quede bien montado, conectado y cerrado antes de volver a intentarlo.";

  // ── "Encender y comprobar" (no finaliza la sesion: eso lo decide la UI
  //    llamando a finish() cuando fixed=true, para poder mostrar el mensaje
  //    de exito antes de pasar a la pantalla de resultado) ──────────────────
  //    fixed = FALLA CORREGIDA y EQUIPO LISTO. outcome distingue el motivo:
  //    "fault" (la falla sigue) o "not-ready" (corregida, pero sin armar).
  function checkPowerOn(equipmentData, session, external) {
    var faultFixed = isFixConditionMet(equipmentData, session);
    var readiness = equipmentReadyForPowerTest(equipmentData, session, external);
    var fixed = faultFixed && readiness.ready;
    var outcome = fixed ? "fixed" : faultFixed ? "not-ready" : "fault";
    var updated = Object.assign({}, session, {
      checkAttempts: session.checkAttempts + 1,
      fixed: fixed,
    });
    updated = logAction(updated, { type: "power-on-check", ok: fixed, outcome: outcome });
    var message = fixed ? updated.symptomFixed : outcome === "not-ready" ? NOT_READY_MESSAGE : updated.symptomBroken;
    return { fixed: fixed, faultFixed: faultFixed, ready: readiness.ready, outcome: outcome, message: message, session: updated };
  }

  /** Variante activa dentro del pool del caso (o null). */
  function variantOf(caseDef, session) {
    var pool = (caseDef && caseDef.faultPool) || [];
    for (var i = 0; i < pool.length; i++) if (pool[i].variantId && pool[i].variantId === session.variantId) return pool[i];
    return null;
  }

  /** Pistas: las de la variante (Caso 08: adaptadas a la condicion activa) o las del caso. */
  function hintsFor(caseDef, session) {
    var v = variantOf(caseDef, session);
    return (v && v.hints) || (caseDef && caseDef.hints) || [];
  }

  // ── Pistas (item 31) ───────────────────────────────────────────────────────
  function useHint(session, caseDef) {
    if (session.hints.used >= session.hints.max) {
      return { ok: false, message: "Ya usaste el máximo de pistas disponibles.", session: session };
    }
    var hintText = hintsFor(caseDef, session)[session.hints.used] || "No hay más pistas para este caso.";
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
    var procedimiento = Math.max(
      0,
      CATEGORY_MAX.procedimiento - (e.blocked || 0) * 3 - (e.caseClosed || 0) * 3 - (e.unsafe || 0) * 3 - (e.thermal || 0) * 3
    );
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
      variantId: session.variantId || null,
      thermal: session.thermal || null,
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
    POWER_SOURCE_PART_BY_EQUIPMENT: POWER_SOURCE_PART_BY_EQUIPMENT,
    NOT_READY_MESSAGE: NOT_READY_MESSAGE,
    extraPartsFor: extraPartsFor,
    equipmentReadyForPowerTest: equipmentReadyForPowerTest,
    hasReseated: hasReseated,
    recordUnsafeAttempt: recordUnsafeAttempt,
    getPart: getPart,
    hasThermal: hasThermal,
    variantOf: variantOf,
    hintsFor: hintsFor,
    fixedBy: fixedBy,
    diagnosisTrace: diagnosisTrace,
    applyThermalTask: applyThermalTask,
    isFixConditionMet: isFixConditionMet,
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
