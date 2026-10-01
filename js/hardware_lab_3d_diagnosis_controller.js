/* js/hardware_lab_3d_diagnosis_controller.js
 *
 * Controlador de "Diagnostico y reparacion" para ESCRITORIO y PORTATIL
 * (sep-27; antes solo escritorio). Usa hardware_lab_diagnosis_engine.js igual
 * que hardware_lab_3d_controller.js usa hardware_lab_engine.js: este archivo
 * solo traduce clics 3D <-> motor <-> HUD. Lo propio de cada equipo vive en
 * EQUIPMENT (modelo, datos, monitor) y, para el portatil, en
 * hardware_lab_3d_diagnosis_mechanics.js (tornillos, tapa, posiciones).
 *
 * Diagnostico es un modo ABIERTO: no hay encuadre automatico de la pieza
 * (revelaria la falla); el aprendiz inspecciona con los controles normales.
 */
import { createDesktopLayout } from "./hardware_lab_3d_layout_desktop.js?v=20260929_1";
import { createLaptopLayout } from "./hardware_lab_3d_layout_laptop.js?v=20260929_1";
import { createDiagnosticMonitor } from "./hardware_lab_3d_monitor.js?v=20260929_1";
import { createLaptopDiagnosisMechanics } from "./hardware_lab_3d_diagnosis_mechanics.js?v=20260929_1";
import { ZONES } from "./hardware_lab_3d_constants.js?v=20260929_1";
import { HardwareLabAudio } from "./hardware_lab_3d_audio.js?v=20260929_1";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEVEL_LABEL = {
  "muy-facil": "Muy fácil",
  facil: "Fácil",
  "facil-intermedio": "Fácil-intermedio",
  intermedio: "Intermedio",
  "intermedio-moderado": "Intermedio-moderado",
  moderado: "Moderado",
};

// Lo propio de cada equipo. El escritorio conserva su monitor externo en la
// escena; el portatil no tiene uno (su "monitor" es el panel de estado).
const EQUIPMENT = {
  desktop: {
    layout: () => createDesktopLayout(),
    data: () => window.HardwareLab.DataDesktop.DESKTOP_EQUIPMENT,
    monitor3d: true,
  },
  laptop: {
    layout: () => createLaptopLayout(),
    data: () => window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT,
    monitor3d: false,
  },
};

// Pieza MAL ASENTADA (portatil): unos milimetros fuera de su conector, a lo
// largo de su eje de extraccion. Se nota solo inspeccionando de cerca.
const MISSEAT_DISTANCE = 0.0015;
// Microfase C.1 (medido en 390/768/1024/1440, misma camara): con 1,5 mm el
// conector u.FL de una antena no dejaba ver nada; con 2,5 mm asoma el anillo
// del receptaculo al acercarse (2 mm solo se insinuaba en 1024) y en la vista
// Interna sigue siendo ~2 px. La tarjeta Wi-Fi ya se ve levantada de lado con
// 1,5 mm y conserva ese valor.
const MISSEAT_DISTANCE_BY_PART = { "wifi-antenna-1": 0.0025, "wifi-antenna-2": 0.0025 };
// Lo que va enganchado a la pieza y sale con ella: las antenas estan
// conectadas a la tarjeta Wi-Fi (sin esto la tarjeta levantada atravesaba sus
// conectores, medido por vertices).
const MISSEAT_CARRIES = { "wifi-card": ["wifi-antenna-1", "wifi-antenna-2"] };

export function createDiagnosisController(stage) {
  let equipmentId = "desktop";
  let equipmentData = null;
  let session = null;
  let caseDef = null;
  let offClick = null;
  let monitor = null;
  let mech = null;

  function Engine() {
    return window.HardwareLab.DiagnosisEngine;
  }
  function CoreEngine() {
    return window.HardwareLab.Engine;
  }
  function Storage() {
    return window.HardwareLab.Storage;
  }
  function Cases() {
    return window.HardwareLab.DiagnosisCases.casesFor(equipmentId);
  }

  // La clave ya lleva el equipo (hwlab_<equipo>_diagnosis_<caso>): escritorio
  // y portatil nunca se pisan, y los resultados antiguos del escritorio
  // (caso-01..10) conservan exactamente su clave.
  function storageModeFor(caseId) {
    return "diagnosis-" + caseId;
  }

  function isPassed(id) {
    const saved = Storage().loadLocal(equipmentId, storageModeFor(id));
    return !!(saved && saved.result && saved.result.status === "APROBADO");
  }

  // ── Menu de casos (vive en #hwlab-intro, no en la escena 3D) ─────────────
  function renderCaseMenu() {
    const grid = document.getElementById("hwlab-diag-case-grid");
    if (!grid) return;
    let previousPassed = true;
    grid.innerHTML = Cases()
      .map((c) => {
        const passed = isPassed(c.id);
        const unlocked = previousPassed;
        previousPassed = previousPassed && passed;
        const badge = !unlocked
          ? '<span class="hwlab-case-badge hwlab-case-badge--locked">Bloqueado</span>'
          : passed
          ? '<span class="hwlab-case-badge hwlab-case-badge--passed">Aprobado</span>'
          : '<span class="hwlab-case-badge hwlab-case-badge--available">Disponible</span>';
        return (
          `<button type="button" class="hwlab-option" data-case="${esc(c.id)}" ${unlocked ? "" : "disabled"}>` +
          `<span class="hwlab-option__title">Caso ${c.number}: ${esc(c.name)}</span>` +
          `<span class="hwlab-option__desc">${esc(c.symptom)}</span>` +
          `<span class="hwlab-case-meta">${badge}<span class="hwlab-case-badge hwlab-case-badge--locked">${esc(LEVEL_LABEL[c.level] || c.level)}</span></span>` +
          "</button>"
        );
      })
      .join("");
    grid.querySelectorAll("[data-case]").forEach((btn) => {
      btn.addEventListener("click", () => startCase(btn.getAttribute("data-case")));
    });
  }

  // Igual que el paso "direccion": se agrega DEBAJO de equipo+practica, sin
  // ocultarlos (el aprendiz ve su recorrido completo, mismo patron que
  // hardware_lab_3d_bootstrap.js usa para practica libre/evaluacion).
  function showCaseMenu(forEquipmentId) {
    if (forEquipmentId && EQUIPMENT[forEquipmentId]) equipmentId = forEquipmentId;
    const directionGroup = document.getElementById("hwlab-direction-group");
    if (directionGroup) directionGroup.hidden = true;
    const group = document.getElementById("hwlab-diag-case-group");
    if (group) group.hidden = false;
    renderCaseMenu();
  }

  function createSession() {
    const s = Engine().createDiagnosisSession(equipmentData, caseDef);
    // Seguimiento academico: nonce del intento (ver hardware_lab_attempts.js).
    const A = window.HardwareLab.Attempts;
    return A ? Object.assign({}, s, { attemptNonce: A.makeNonce() }) : s;
  }

  /** Falla "mal asentada" aun sin reasentar: la pieza se ve un poco fuera. */
  function applyMisseat() {
    if (equipmentId !== "laptop" || !session || !stage.currentRig.setMisseated) return;
    const fix = session.fixCondition;
    if (!fix || fix.type !== "reseated" || session.parts[fix.partId] !== true) return;
    if (Engine().hasReseated(session, fix.partId)) return;
    const distance = MISSEAT_DISTANCE_BY_PART[fix.partId] || MISSEAT_DISTANCE;
    stage.currentRig.setMisseated(fix.partId, distance);
    (MISSEAT_CARRIES[fix.partId] || []).forEach((id) => {
      if (session.parts[id] === true) stage.currentRig.setMisseated(id, distance);
    });
  }

  // ── Caso en curso (escena 3D compartida) ──────────────────────────────────
  function startCase(caseId) {
    caseDef = Cases().find((c) => c.id === caseId);
    if (!caseDef) return;
    const eq = EQUIPMENT[equipmentId];
    equipmentData = eq.data();

    if (!stage.showStage()) return;
    stage.loadRig(eq.layout(), equipmentId);

    if (offClick) {
      offClick();
      offClick = null;
    }

    if (eq.monitor3d) {
      if (!monitor) {
        monitor = createDiagnosticMonitor();
        monitor.group.position.copy(ZONES.monitorBase);
        monitor.group.rotation.y = Math.PI * 0.15;
        stage.sceneApi.onTick((dt) => monitor.update(dt));
      }
      stage.sceneApi.scene.add(monitor.group);
    } else if (monitor) {
      stage.sceneApi.scene.remove(monitor.group);
    }

    const saved = Storage().loadLocal(equipmentId, storageModeFor(caseId));
    session = saved && !saved.result ? Object.assign({}, saved) : createSession();
    // Sesion guardada antes de la Fase C (sin estado termico): refrigeracion en buen estado.
    if (!session.thermal && Engine().hasThermal(equipmentData)) {
      session = Object.assign({}, session, { thermal: window.HardwareLab.Thermal.createThermalState("serviced") });
    }
    stage.currentRig.syncFromSessionParts(session.parts);

    mech =
      equipmentId === "laptop"
        ? createLaptopDiagnosisMechanics({
            stage,
            getSession: () => session,
            setSession: (s) => {
              session = s;
            },
            getEquipmentData: () => equipmentData,
            onChanged: () => {
              persist();
              renderInfoPanel();
              refreshStats();
            },
            onRender: renderInfoPanel,
          })
        : null;
    if (mech) mech.setup(saved && !saved.result ? saved.screws : null);
    applyMisseat();

    if (stage.resetCardExpansion) stage.resetCardExpansion();
    stage.setModeTitle("Diagnóstico - Caso " + caseDef.number, caseDef.name);
    stage.startTimer(session.startedAt);
    stage.clearActionLog();
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    document.getElementById("hwlab-hint-btn").hidden = false;
    document.getElementById("hwlab-restart-btn").hidden = false;
    document.getElementById("hwlab-timer").parentElement.hidden = false;

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToCaseMenu;
    document.getElementById("hwlab-restart-btn").onclick = restartCase;

    offClick = stage.interactions.onClick((root, meta) => {
      if (meta && meta.kind === "screw") {
        if (mech) mech.handleScrewClick(meta.screwId);
        return;
      }
      if (!meta || !meta.partId) return;
      handlePartClick(meta.partId);
    });
    // Seleccion tolerante (Fase C): tocar una pieza atornillada a pocos pixeles
    // de uno de SUS tornillos es tocar ese tornillo; un toque al aire junto a
    // una pieza la selecciona. Diagnosticar no depende de la punteria.
    stage.interactions.setPickExpectation(() => ({
      nearestOnEmpty: true,
      expected: (meta, exact) => {
        if (!meta || meta.kind !== "screw" || !exact || !exact.partId || !stage.screws) return false;
        const entry = stage.screws.get(meta.screwId);
        return !!entry && entry.installed && entry.partId === exact.partId;
      },
    }));

    updateMonitor();
    renderInfoPanel();
    refreshStats();
  }

  function restartCase() {
    session = createSession();
    stage.currentRig.syncFromSessionParts(session.parts);
    // Mecanica, desalineado y refrigeracion salen de la sesion NUEVA (otra
    // variante, polvo/pasta del inicio): nada del intento anterior sobrevive.
    if (mech) mech.setup(null);
    applyMisseat();
    if (stage.resetCardExpansion) stage.resetCardExpansion();
    stage.startTimer(session.startedAt);
    stage.clearActionLog();
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    updateMonitor();
    renderInfoPanel();
    // Mismo bug que en hardware_lab_3d_controller.js: sin esto, el
    // contador de errores se quedaba mostrando el numero de ANTES del
    // reinicio.
    refreshStats();
  }

  function getPart(partId) {
    return Engine().getPart(equipmentData, partId);
  }

  function inferAction(partId) {
    const part = getPart(partId);
    const present = session.parts[partId];
    const isCable = part && part.kind === "cable";
    if (present) return isCable ? "disconnect" : "remove";
    return isCable ? "connect" : "install";
  }

  function handlePartClick(partId) {
    const part = getPart(partId);
    if (!part) return;
    const action = inferAction(partId);
    // Portatil: tornillos y posicion antes de intentar (sin castigo: explica).
    if (mech) {
      const pre = mech.beforePartAction(partId, action);
      if (!pre.ok) {
        stage.showFeedback(pre.message, pre.tone || "info");
        if (pre.log) stage.pushActionLog(pre.log, pre.tone === "error" ? "error" : undefined);
        renderInfoPanel();
        return;
      }
    }
    stage.focusOnPart(partId);
    // Herramienta contextual: la que requiere la pieza (ver controller.js).
    const result = Engine().attemptAction(equipmentData, session, { partId, action, toolId: part.tool || "hands" });
    session = result.session;
    if (result.ok) {
      const nowPresent = session.parts[partId];
      stage.currentRig.setPresence(partId, nowPresent, {
        onSettled: () => {
          HardwareLabAudio.playPlace();
          // Una antena reconectada sobre la tarjeta aun mal asentada sigue a la tarjeta.
          applyMisseat();
        },
      });
      if (mech) mech.afterPartAction(partId, nowPresent);
      if (part.tool && part.tool !== "hands") HardwareLabAudio.playScrew();
      else HardwareLabAudio[nowPresent ? "playConnect" : "playDisconnect"]();
      stage.showFeedback(result.message, "success");
      stage.pushActionLog(part.name + " " + (nowPresent ? "✓" : "✗"), "success");
    } else if (result.blockedByThermal) {
      // Regla del mantenimiento (coolerInstallGate): explica, no castiga.
      stage.showFeedback(result.message, "info");
      stage.pushActionLog("Disipador sin montar: preparar la pasta térmica", "error");
    } else {
      stage.showFeedback(result.message, "error");
      stage.pushActionLog(part.name + ": bloqueado", "error");
    }
    persist();
    updateMonitor();
    renderInfoPanel();
    refreshStats();
  }

  function onThermalTask(taskId, amount) {
    const result = Engine().applyThermalTask(equipmentData, session, taskId, { amount });
    session = result.session;
    stage.showFeedback(result.message, result.level);
    const task = window.HardwareLab.Thermal.TASKS[taskId];
    if (result.ok || result.level === "error") {
      stage.pushActionLog((taskId === "apply" ? "Pasta térmica: " + (amount || "") : task.label) + (result.ok ? " ✓" : " ✗"), result.ok ? "success" : "error");
    }
    if (result.ok) HardwareLabAudio.playClick();
    if (mech) mech.refreshThermalLook();
    persist();
    renderInfoPanel();
    refreshStats();
  }

  function onHint() {
    const result = Engine().useHint(session, caseDef);
    session = result.session;
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    stage.showFeedback(result.message, result.ok ? "info" : "error");
    persist();
  }

  // Resumen educativo (item 11: que pasaba, por que, como diagnosticarlo,
  // como se arregla, procedimiento optimo). Cada caso ya trae este texto
  // (ver hardware_lab_diagnosis_cases.js) pero nunca se mostraba en ningun
  // lado: el aprendiz resolvia el caso sin un cierre que conectara lo que
  // hizo con el porque. Se muestra solo al aprobar (no es "la respuesta"
  // para copiar, es el repaso posterior).
  /** Casos con varias causas: el repaso cuenta la causa de ESTE intento. */
  function variantOf(s) {
    return s ? Engine().variantOf(caseDef, s) : null;
  }

  /** Caso 08: que accion corrigio la falla en este intento (y por que, si fue
   *  al desmontar otra pieza que exigia desconectarla). Solo en el repaso. */
  function fixedByText() {
    const e = Engine().fixedBy(session);
    if (!e) return "";
    if (e.task) {
      const t = window.HardwareLab.Thermal.TASKS[e.task];
      return "En tu intento, la falla quedó corregida con la tarea: " + (t ? t.label.toLowerCase() : e.task) + ", y el módulo montado de nuevo.";
    }
    const part = getPart(e.partId);
    const verb = (CoreEngine().ACTION_LABELS[e.action] || { verb: e.action }).verb;
    const fault = session.fixCondition && session.fixCondition.partId;
    // El ultimo paso puede ser una conexion que la pieza de la falla necesita
    // (p. ej. las antenas de la tarjeta Wi-Fi): no se presenta como la causa.
    let text = fault && e.partId !== fault
      ? "En tu intento, la falla quedó corregida al reasentar " + getPart(fault).name + "; el último paso necesario fue " + verb + " " + (part ? part.name : e.partId) + ", porque la pieza no funciona hasta que sus conexiones vuelven a estar puestas."
      : "En tu intento, la falla quedó corregida al " + verb + " " + (part ? part.name : e.partId) + ".";
    const removed = new Set(session.actionLog.filter((a) => a.type === "action" && (a.action === "remove" || a.action === "disconnect")).map((a) => a.partId));
    const via = fault ? Object.keys(equipmentData.parts).find((id) => id !== fault && removed.has(id) && (getPart(id).removeRequires || []).indexOf(fault) !== -1) : null;
    if (via) text += " Para retirar " + getPart(via).name + " tuviste que desconectar " + getPart(fault).name + ", y al volver a conectarla quedó bien asentada: esa fue la reparación real, aunque tu objetivo fuera otra pieza.";
    return text;
  }

  /** Sintoma que se muestra: el general del caso hasta reproducir la falla. */
  function visibleSymptom() {
    if (session.fixed) return session.symptomFixed;
    if (caseDef.revealSymptomOnCheck && !session.actionLog.some((e) => e.type === "power-on-check")) return caseDef.symptom;
    return session.symptomBroken;
  }

  function buildExplanationHtml() {
    const variant = variantOf(session);
    const ex = Object.assign({}, caseDef.explanation, variant && variant.explanation);
    if (!caseDef.explanation && !(variant && variant.explanation)) return "";
    const rows = [
      ["Qué estaba pasando", ex.whatWasHappening],
      ["Por qué ocurría", ex.why],
      ["Cómo diagnosticarlo", ex.howToDiagnose],
      ["Cómo se soluciona", ex.howToFix],
      ["Procedimiento óptimo", ex.optimalProcedure],
      ["Cómo funciona este subsistema", ex.background],
      ["Qué corrigió la falla", caseDef.unknown ? fixedByText() : ""],
      ["Prevención y buenas prácticas", ex.prevention],
    ].filter((r) => r[1]);
    return (
      '<div class="hwlab-result-explanation">' +
      "<h4>Repaso del caso</h4>" +
      rows.map(([label, value]) => `<p><strong>${esc(label)}:</strong> ${esc(value)}</p>`).join("") +
      "</div>"
    );
  }

  function checkPowerOn() {
    // Portatil: se enciende en su posicion normal (derecho y abierto). Es una
    // indicacion, no un intento de comprobacion: no se registra ni penaliza.
    if (mech) {
      const pos = mech.powerPosition();
      if (!pos.ok) {
        stage.showFeedback(pos.reason, "info");
        renderInfoPanel();
        return;
      }
    }
    const result = Engine().checkPowerOn(equipmentData, session, { screwsSecured: mech ? mech.screwsSecured() : true });
    session = result.session;
    if (monitor && EQUIPMENT[equipmentId].monitor3d) monitor.setPowered(true);
    updateMonitor();
    persist();
    if (result.fixed) {
      stage.stopTimer();
      const finished = Engine().finish(session);
      // Traza de identificacion (dato; no cambia la nota).
      finished.result.trace = Engine().diagnosisTrace(equipmentData, session);
      session = finished;
      persist();
      const A = window.HardwareLab.Attempts;
      if (A) {
        const done = Object.assign(Engine().serialize(finished), { attemptNonce: finished.attemptNonce });
        A.recordFinished({ session: done, equipo: equipmentId, practica: storageModeFor(caseDef.id) });
      }
      stage.showFeedback(result.message, "success");
      HardwareLabAudio.playComplete();
      stage.openResultModal(finished.result, {
        extraHtml: buildExplanationHtml(),
        onRetry: () => {
          restartCase();
        },
        onMenu: backToCaseMenu,
      });
    } else {
      // "La falla sigue" (error) frente a "corregida, pero el equipo no esta
      // listo para encender" (advertencia): no se revela que falta.
      const notReady = result.outcome === "not-ready";
      stage.showFeedback(result.message, notReady ? "warning" : "error");
      stage.pushActionLog(notReady ? "Encendido: equipo sin terminar de armar" : "Encendido: sigue con falla", "error");
    }
    renderInfoPanel();
  }

  /** Resultado de la ultima comprobacion (del historial de la sesion). */
  function lastCheckOutcome() {
    const log = (session && session.actionLog) || [];
    for (let i = log.length - 1; i >= 0; i--) if (log[i].type === "power-on-check") return log[i].outcome || (log[i].ok ? "fixed" : "fault");
    return null;
  }

  function updateMonitor() {
    if (!monitor || !EQUIPMENT[equipmentId].monitor3d) return;
    const open = CoreEngine().isCaseOpen(equipmentData, session);
    monitor.setLines(computeMonitorLines(open));
  }

  // Fuente unica de verdad para el monitor en escena (CanvasTexture) Y su
  // duplicado accesible en el HUD (item: no depender solo de texto diminuto
  // dentro del mundo 3D para informacion critica).
  function computeMonitorLines(open) {
    if (equipmentId === "laptop") return computeLaptopLines();
    const sataOk = session.parts["cable-sata-data"] && session.parts.ssd;
    return [
      { label: "GABINETE", value: open ? "ABIERTO" : "CERRADO", tone: "neutral" },
      { label: "CPU", value: session.parts.cpu ? "Detectado" : "No detectado", tone: session.parts.cpu ? "ok" : "danger" },
      { label: "RAM", value: session.parts.ram ? "OK" : "No detectada", tone: session.parts.ram ? "ok" : "danger" },
      { label: "GPU", value: session.parts.gpu ? "Detectada" : "No detectada", tone: session.parts.gpu ? "ok" : "warn" },
      { label: "SSD SATA", value: sataOk ? "Detectado" : "No detectado", tone: sataOk ? "ok" : "warn" },
      { label: "SSD M.2", value: session.parts["ssd-m2"] ? "Detectado" : "No detectado", tone: session.parts["ssd-m2"] ? "ok" : "warn" },
      { label: "POST", value: session.fixed ? "OK" : "En espera", tone: session.fixed ? "ok" : "warn" },
      { label: "ERRORES", value: String(session.errors), tone: session.errors > 0 ? "warn" : "ok" },
    ];
  }

  // Portatil: solo el ESTADO que el aprendiz puede observar de su propio
  // trabajo (tapa, bateria, tornillos, ultima prueba). Nunca el componente
  // de la falla: los sintomas se leen en el panel, la pieza se descubre.
  function computeLaptopLines() {
    const cover = session.parts["bottom-cover"] !== false;
    const battery = session.parts["cable-battery"] !== false;
    const loose = mech ? mech.looseScrews() : 0;
    const out = lastCheckOutcome();
    const check = {
      fixed: { value: "Correcta", tone: "ok" },
      fault: { value: "Persiste el síntoma", tone: "danger" },
      "not-ready": { value: "Equipo sin terminar de armar", tone: "warn" },
    }[out] || { value: "Sin comprobar", tone: "neutral" };
    // Observaciones del caso (lo que el usuario reporta y se ve al usar el
    // equipo): genericas, nunca el nombre de la pieza responsable.
    const obs = (caseDef && caseDef.observations && (session.fixed ? caseDef.observations.fixed : caseDef.observations.broken)) || [];
    return obs.concat([
      { label: "TAPA INFERIOR", value: cover ? "Cerrada" : "Abierta", tone: "neutral" },
      { label: "BATERÍA", value: battery ? "Conectada" : "Desconectada", tone: battery ? "ok" : "warn" },
      { label: "TORNILLOS SUELTOS", value: String(loose), tone: loose > 0 ? "warn" : "ok" },
      { label: "ÚLTIMA PRUEBA", value: check.value, tone: check.tone },
      { label: "ERRORES", value: String(session.errors), tone: session.errors > 0 ? "warn" : "ok" },
    ]);
  }

  function refreshStats() {
    stage.setStats({ step: null, errors: session.errors });
  }

  function renderInfoPanel() {
    const lines = computeMonitorLines(CoreEngine().isCaseOpen(equipmentData, session));
    const symptom = visibleSymptom();
    // data-card-summary: el sintoma es lo que se ve en la banda compacta (movil).
    const html =
      '<div class="hwlab-info-block">' +
      "<h3>&#129517; Síntoma reportado</h3>" +
      `<p data-card-summary="Síntoma">${esc(symptom)}</p>` +
      '<button type="button" class="c-btn c-btn--primary c-btn--block" id="hwlab-power-check-btn">Encender y comprobar</button>' +
      (mech ? mech.poseSectionHtml(esc) : "") +
      "</div>" +
      (mech && mech.thermalSectionHtml(esc) ? '<div class="hwlab-info-block">' + mech.thermalSectionHtml(esc) + "</div>" : "") +
      `<div class="hwlab-info-block"><h3>${equipmentId === "laptop" ? "Estado del equipo" : "Monitor de diagnóstico"}</h3>` +
      '<div class="hwlab-monitor-readout">' +
      lines.map((l) => `<div class="row"><span class="label">${esc(l.label)}</span><span class="value--${l.tone}">${esc(l.value)}</span></div>`).join("") +
      "</div></div>";
    stage.setInfoPanel(html);
    const btn = document.getElementById("hwlab-power-check-btn");
    if (btn) btn.onclick = checkPowerOn;
    if (mech) {
      mech.wirePrepareButton();
      mech.wireThermalSection(onThermalTask);
    }
  }

  function persist() {
    const data = Engine().serialize(session);
    if (session.attemptNonce) data.attemptNonce = session.attemptNonce;
    if (mech) data.screws = mech.screwState();
    Storage().persist(equipmentId, storageModeFor(caseDef.id), data);
  }

  function backToCaseMenu() {
    stage.stopTimer();
    stage.hideStage();
    showCaseMenu(equipmentId);
  }

  return {
    showCaseMenu,
    startCase,
    /** Solo lectura (pruebas y diagnostico): la sesion en curso. */
    getSession: () => session,
  };
}
