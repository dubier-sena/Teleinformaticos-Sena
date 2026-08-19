/* js/hardware_lab_3d_controller.js
 *
 * Controlador de "Aprender componentes" + las 4 practicas de
 * ensamble/desensamble (guiado x2, libre, evaluacion). Traduce clics en la
 * escena 3D a llamadas del motor puro hardware_lab_engine.js (intacto) y
 * refleja el resultado en el rig (hardware_lab_3d_rig.js) y el HUD
 * (hardware_lab_3d_stage.js). No conoce Three.js directamente: todo pasa
 * por `stage`.
 *
 * Nota sobre modos: el motor solo entiende "<direccion>-guided" o
 * "<direccion>-open" (ver modeKind en hardware_lab_engine.js, exige que el
 * string TERMINE en "-open"). "Practica libre" y "Evaluacion" son ambas
 * "-open" para el motor (mismas reglas de dependencias, sin secuencia fija);
 * lo que las distingue es el numero de pistas permitidas (0 en evaluacion,
 * item 23) y la llave de almacenamiento, que aqui SI se guarda por separado
 * (storageMode) para que evaluacion no pise el progreso de practica libre.
 */
import { createDesktopLayout } from "./hardware_lab_3d_layout_desktop.js";
import { createLaptopLayout } from "./hardware_lab_3d_layout_laptop.js";
import { HardwareLabAudio } from "./hardware_lab_3d_audio.js";

const TITLES = {
  learn: "Aprender componentes",
  "disassembly-guided": "Desensamble guiado",
  "assembly-guided": "Ensamble guiado",
  free: "Practica libre",
  evaluation: "Evaluacion",
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createAssemblyController(stage) {
  let equipmentData = null;
  let equipmentId = null;
  let session = null;
  let engineMode = null;
  let storageMode = null;
  let practiceMode = null;
  let direction = null;
  let offClick = null;
  let persistTimer = null;
  let isLearn = false;

  function Engine() {
    return window.HardwareLab.Engine;
  }
  function Storage() {
    return window.HardwareLab.Storage;
  }
  function Tools() {
    return window.HardwareLab.Tools;
  }

  function layoutFor(id) {
    return id === "laptop" ? createLaptopLayout() : createDesktopLayout();
  }

  function equipmentDataFor(id) {
    return id === "laptop" ? window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT : window.HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;
  }

  function allToolIds() {
    return Tools()
      .listTools()
      .map((t) => t.id)
      .filter((id) => id !== "hands");
  }

  function start(id, mode, dir) {
    equipmentId = id;
    equipmentData = equipmentDataFor(id);
    isLearn = mode === "learn";
    practiceMode = mode;
    direction = dir;

    if (!stage.showStage()) return;
    const rig = stage.loadRig(layoutFor(id), id);

    if (offClick) {
      offClick();
      offClick = null;
    }

    if (isLearn) {
      startLearn(rig);
      return;
    }
    startPractice(rig);
  }

  // ── APRENDER COMPONENTES ────────────────────────────────────────────────
  function startLearn(rig) {
    stage.setModeTitle("Aprender componentes", equipmentData.name);
    stage.setStats({ step: null });
    stage.setHintUi(0, 0, null);
    document.getElementById("hwlab-hint-btn").hidden = true;
    document.getElementById("hwlab-restart-btn").hidden = true;
    stage.stopTimer();
    document.getElementById("hwlab-timer").parentElement.hidden = true;
    stage.renderToolGrid([], null);
    document.getElementById("hwlab-tools-panel").hidden = true;
    stage.clearActionLog();
    rig.syncFromSessionParts(equipmentData.initialStateDisassembly);

    stage.setInfoPanel(
      '<div class="hwlab-info-block"><h3>Explora cada pieza</h3>' +
        "<p>Gira el equipo, acercate y haz clic en cualquier componente para ver su ficha tecnica completa: funcion, ubicacion, tipo de conexion, precauciones y fallas frecuentes.</p></div>"
    );

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToIntro;
    document.getElementById("hwlab-hint-btn").hidden = true;

    offClick = stage.interactions.onClick((root, meta) => {
      if (!meta || !meta.partId) return;
      const part = getPart(meta.partId);
      if (!part) return;
      HardwareLabAudio.playClick();
      stage.focusOnPart(meta.partId);
      stage.openPartModal(part);
    });
  }

  // ── PRACTICAS DE ENSAMBLE/DESENSAMBLE ────────────────────────────────────
  function startPractice(rig) {
    document.getElementById("hwlab-tools-panel").hidden = false;
    document.getElementById("hwlab-hint-btn").hidden = false;
    document.getElementById("hwlab-restart-btn").hidden = false;
    document.getElementById("hwlab-timer").parentElement.hidden = false;

    if (practiceMode === "disassembly-guided" || practiceMode === "assembly-guided") {
      engineMode = practiceMode;
      storageMode = practiceMode;
    } else {
      engineMode = direction + "-open";
      storageMode = direction + "-" + practiceMode;
    }
    const maxHints = practiceMode === "evaluation" ? 0 : 3;

    const saved = Storage().loadLocal(equipmentId, storageMode);
    session = saved ? Engine().deserialize(equipmentData, saved) : Engine().createSession(equipmentData, engineMode, { maxHints });
    rig.syncFromSessionParts(session.parts);

    stage.setModeTitle(TITLES[practiceMode], equipmentData.name + (direction ? " - " + (direction === "assembly" ? "Ensamble" : "Desensamble") : ""));
    stage.startTimer(session.startedAt);
    stage.renderToolGrid(allToolIds(), () => {});
    stage.clearActionLog();
    stage.setHintUi(session.hints.used, session.hints.max, onHint);

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToIntro;
    document.getElementById("hwlab-restart-btn").onclick = () => {
      session = Engine().createSession(equipmentData, engineMode, { maxHints });
      rig.syncFromSessionParts(session.parts);
      stage.startTimer(session.startedAt);
      stage.clearActionLog();
      renderInfoPanel();
    };

    offClick = stage.interactions.onClick((root, meta) => {
      if (!meta || !meta.partId) return;
      handlePartClick(meta.partId);
    });

    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  function getPart(partId) {
    return equipmentData.parts[partId] || null;
  }

  function inferAction(partId) {
    const part = getPart(partId);
    if (!part) return null;
    const present = session.parts[partId];
    const isCable = part.kind === "cable";
    if (present) return isCable ? "disconnect" : "remove";
    return isCable ? "connect" : "install";
  }

  function handlePartClick(partId) {
    const part = getPart(partId);
    if (!part) return;
    stage.focusOnPart(partId);
    const action = inferAction(partId);
    const toolId = stage.getActiveToolId();
    const result = Engine().attemptAction(equipmentData, session, { partId, action, toolId });
    session = result.session;
    if (result.ok) {
      const nowPresent = session.parts[partId];
      stage.currentRig.setPresence(partId, nowPresent, {
        onSettled: () => HardwareLabAudio.playPlace(),
      });
      if (part.tool && part.tool !== "hands") HardwareLabAudio.playScrew();
      else HardwareLabAudio[action === "connect" || action === "disconnect" ? (nowPresent ? "playConnect" : "playDisconnect") : "playClick"]();
      stage.showFeedback(result.message, "success");
      stage.pushActionLog(part.name + " " + (nowPresent ? "✓" : "✗"), "success");
    } else {
      stage.showFeedback(result.message, "error");
      stage.pushActionLog(part.name + ": bloqueado", "error");
    }
    persist();
    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  function onHint() {
    const result = Engine().useHint(session);
    session = result.session;
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    stage.showFeedback(result.message, result.ok ? "info" : "error");
    persist();
  }

  function attemptSafety(stepId) {
    const result = Engine().attemptSafetyStep(session, stepId);
    session = result.session;
    stage.showFeedback(result.message, result.ok ? "success" : "error");
    if (result.ok) stage.pushActionLog("Paso de seguridad confirmado", "success");
    persist();
    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  function refreshStats() {
    stage.setStats({
      step: session.kind === "guided" ? Math.min(session.stepIndex + 1, session.sequence.length) : null,
      total: session.kind === "guided" ? session.sequence.length : null,
      errors: session.errors,
    });
  }

  function renderInfoPanel() {
    const step = Engine().currentStep(session);
    let html = '<div class="hwlab-info-block">';
    if (step && step.kind === "safety") {
      html +=
        `<h3>${esc(step.title)}</h3>` +
        "<ol>" +
        (step.instructions || []).map((i) => `<li>${esc(i)}</li>`).join("") +
        "</ol>" +
        `<button type="button" class="c-btn c-btn--primary c-btn--block" id="hwlab-safety-confirm-btn">Confirmar paso</button>`;
    } else if (session.kind === "guided" && step && step.kind === "action") {
      const part = getPart(step.partId);
      const actionInfo = Engine().ACTION_LABELS[step.action];
      html +=
        `<h3>Paso ${session.stepIndex + 1} de ${session.sequence.length}</h3>` +
        `<p>${esc(actionInfo.verb)} <strong>${esc(part ? part.name : step.partId)}</strong></p>` +
        "<ol>" +
        ((part && (step.action === "remove" || step.action === "disconnect" ? part.removeInstructions : part.installInstructions)) || [])
          .map((i) => `<li>${esc(i)}</li>`)
          .join("") +
        "</ol>";
      if (part && part.tool && part.tool !== "hands") {
        const tool = Tools().getTool(part.tool);
        html += `<p class="hwlab-muted">Herramienta necesaria: <strong>${esc(tool ? tool.name : part.tool)}</strong></p>`;
      }
    } else if (Engine().isFinished(session)) {
      html += "<h3>Practica completa</h3><p>Revisa el resultado en el panel de puntuacion.</p>";
    } else {
      html +=
        "<h3>Practica libre</h3><p>Elige una herramienta si la pieza la necesita y haz clic directamente sobre el componente en la escena para actuar sobre el.</p>" +
        '<ul class="hwlab-tray-list">' +
        Object.keys(equipmentData.parts)
          .filter((id) => session.parts[id] !== (direction === "assembly"))
          .slice(0, 8)
          .map((id) => `<li>${esc(equipmentData.parts[id].name)}</li>`)
          .join("") +
        "</ul>";
    }
    html += "</div>";
    stage.setInfoPanel(html);
    const safetyBtn = document.getElementById("hwlab-safety-confirm-btn");
    if (safetyBtn && step) safetyBtn.onclick = () => attemptSafety(step.id);
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      Storage().persist(equipmentId, storageMode, Engine().serialize(session));
    }, 500);
  }

  function maybeFinish() {
    if (!Engine().isFinished(session)) return;
    stage.stopTimer();
    const finished = Engine().finish(session);
    session = finished;
    persist();
    stage.openResultModal(finished.result, {
      onRetry: () => {
        session = Engine().createSession(equipmentData, engineMode, { maxHints: session.hints.max });
        stage.currentRig.syncFromSessionParts(session.parts);
        stage.startTimer(session.startedAt);
        stage.clearActionLog();
        renderInfoPanel();
        refreshStats();
      },
      onMenu: backToIntro,
    });
  }

  function backToIntro() {
    stage.stopTimer();
    stage.hideStage();
  }

  return { start };
}
