/* js/hardware_lab_3d_diagnosis_controller.js
 *
 * Controlador de "Diagnostico y reparacion" (10 casos, solo escritorio por
 * ahora — misma restriccion que ya tenia hardware_lab_bootstrap.js). Usa
 * hardware_lab_diagnosis_engine.js (intacto) igual que
 * hardware_lab_3d_controller.js usa hardware_lab_engine.js: este archivo
 * solo traduce clics 3D <-> motor <-> HUD.
 */
import { createDesktopLayout } from "./hardware_lab_3d_layout_desktop.js";
import { createDiagnosticMonitor } from "./hardware_lab_3d_monitor.js";
import { ZONES } from "./hardware_lab_3d_constants.js";
import { HardwareLabAudio } from "./hardware_lab_3d_audio.js";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LEVEL_LABEL = {
  "muy-facil": "Muy facil",
  facil: "Facil",
  "facil-intermedio": "Facil-intermedio",
  intermedio: "Intermedio",
  "intermedio-moderado": "Intermedio-moderado",
  moderado: "Moderado",
};

export function createDiagnosisController(stage) {
  let equipmentData = null;
  let session = null;
  let caseDef = null;
  let offClick = null;
  let monitor = null;

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
    return window.HardwareLab.DiagnosisCases.CASES;
  }
  function Tools() {
    return window.HardwareLab.Tools;
  }

  function storageModeFor(caseId) {
    return "diagnosis-" + caseId;
  }

  function isPassed(id) {
    const saved = Storage().loadLocal("desktop", storageModeFor(id));
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
  function showCaseMenu() {
    const directionGroup = document.getElementById("hwlab-direction-group");
    if (directionGroup) directionGroup.hidden = true;
    const group = document.getElementById("hwlab-diag-case-group");
    if (group) group.hidden = false;
    renderCaseMenu();
  }

  // ── Caso en curso (escena 3D compartida) ──────────────────────────────────
  function startCase(caseId) {
    caseDef = Cases().find((c) => c.id === caseId);
    if (!caseDef) return;
    equipmentData = window.HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;

    if (!stage.showStage()) return;
    const rig = stage.loadRig(createDesktopLayout(), "desktop");

    if (offClick) {
      offClick();
      offClick = null;
    }

    if (!monitor) {
      monitor = createDiagnosticMonitor();
      monitor.group.position.copy(ZONES.monitorBase);
      monitor.group.rotation.y = Math.PI * 0.15;
      stage.sceneApi.onTick((dt) => monitor.update(dt));
    }
    stage.sceneApi.scene.add(monitor.group);

    const saved = Storage().loadLocal("desktop", storageModeFor(caseId));
    session =
      saved && !saved.result
        ? Object.assign({}, saved)
        : Engine().createDiagnosisSession(equipmentData, caseDef);
    stage.currentRig.syncFromSessionParts(session.parts);

    stage.setModeTitle("Diagnostico - Caso " + caseDef.number, caseDef.name);
    stage.startTimer(session.startedAt);
    stage.renderToolGrid(
      Tools()
        .listTools()
        .map((t) => t.id)
        .filter((id) => id !== "hands"),
      () => {}
    );
    stage.clearActionLog();
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    document.getElementById("hwlab-tools-panel").hidden = false;
    document.getElementById("hwlab-hint-btn").hidden = false;
    document.getElementById("hwlab-restart-btn").hidden = false;
    document.getElementById("hwlab-timer").parentElement.hidden = false;

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToCaseMenu;
    document.getElementById("hwlab-restart-btn").onclick = () => {
      session = Engine().createDiagnosisSession(equipmentData, caseDef);
      stage.currentRig.syncFromSessionParts(session.parts);
      stage.startTimer(session.startedAt);
      stage.clearActionLog();
      updateMonitor();
      renderInfoPanel();
    };

    offClick = stage.interactions.onClick((root, meta) => {
      if (!meta || !meta.partId) return;
      handlePartClick(meta.partId);
    });

    updateMonitor();
    renderInfoPanel();
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
    stage.focusOnPart(partId);
    const action = inferAction(partId);
    const toolId = stage.getActiveToolId();
    const result = Engine().attemptAction(equipmentData, session, { partId, action, toolId });
    session = result.session;
    if (result.ok) {
      const nowPresent = session.parts[partId];
      stage.currentRig.setPresence(partId, nowPresent, { onSettled: () => HardwareLabAudio.playPlace() });
      if (part.tool && part.tool !== "hands") HardwareLabAudio.playScrew();
      else HardwareLabAudio[nowPresent ? "playConnect" : "playDisconnect"]();
      stage.showFeedback(result.message, "success");
      stage.pushActionLog(part.name + " " + (nowPresent ? "✓" : "✗"), "success");
    } else {
      stage.showFeedback(result.message, "error");
      stage.pushActionLog(part.name + ": bloqueado", "error");
    }
    persist();
    updateMonitor();
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

  function checkPowerOn() {
    const result = Engine().checkPowerOn(equipmentData, session);
    session = result.session;
    monitor.setPowered(true);
    updateMonitor();
    persist();
    if (result.fixed) {
      stage.stopTimer();
      const finished = Engine().finish(session);
      session = finished;
      persist();
      stage.showFeedback(result.message, "success");
      HardwareLabAudio.playComplete();
      stage.openResultModal(finished.result, {
        onRetry: () => {
          session = Engine().createDiagnosisSession(equipmentData, caseDef);
          stage.currentRig.syncFromSessionParts(session.parts);
          stage.startTimer(session.startedAt);
          stage.clearActionLog();
          updateMonitor();
          renderInfoPanel();
        },
        onMenu: backToCaseMenu,
      });
    } else {
      stage.showFeedback(result.message, "error");
      stage.pushActionLog("Encendido: sigue con falla", "error");
    }
    renderInfoPanel();
  }

  function updateMonitor() {
    if (!monitor) return;
    const open = CoreEngine().isCaseOpen(equipmentData, session);
    monitor.setLines(computeMonitorLines(open));
  }

  // Fuente unica de verdad para el monitor en escena (CanvasTexture) Y su
  // duplicado accesible en el HUD (item: no depender solo de texto diminuto
  // dentro del mundo 3D para informacion critica).
  function computeMonitorLines(open) {
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

  function refreshStats() {
    stage.setStats({ step: null, errors: session.errors });
  }

  function renderInfoPanel() {
    const lines = computeMonitorLines(CoreEngine().isCaseOpen(equipmentData, session));
    const html =
      '<div class="hwlab-info-block">' +
      "<h3>&#129517; Sintoma reportado</h3>" +
      `<p>${esc(session.fixed ? session.symptomFixed : session.symptomBroken)}</p>` +
      '<button type="button" class="c-btn c-btn--primary c-btn--block" id="hwlab-power-check-btn">Encender y comprobar</button>' +
      "</div>" +
      '<div class="hwlab-info-block"><h3>Monitor de diagnostico</h3>' +
      '<div class="hwlab-monitor-readout">' +
      lines.map((l) => `<div class="row"><span class="label">${esc(l.label)}</span><span class="value--${l.tone}">${esc(l.value)}</span></div>`).join("") +
      "</div></div>";
    stage.setInfoPanel(html);
    const btn = document.getElementById("hwlab-power-check-btn");
    if (btn) btn.onclick = checkPowerOn;
  }

  function persist() {
    Storage().persist("desktop", storageModeFor(caseDef.id), Engine().serialize(session));
  }

  function backToCaseMenu() {
    stage.stopTimer();
    stage.hideStage();
    showCaseMenu();
  }

  return { showCaseMenu, startCase };
}
