/* js/hardware_lab_3d_stage.js
 *
 * "Caparazon" compartido del laboratorio 3D: crea la escena UNA sola vez
 * (evita agotar contextos WebGL si el aprendiz entra y sale de practicas
 * varias veces) y expone helpers de HUD genericos (tooltip, feedback,
 * historial, modales, barra de herramientas, vistas de camara, pantalla
 * completa, sonido) que hardware_lab_3d_controller.js y
 * hardware_lab_3d_diagnosis_controller.js reutilizan sin duplicar DOM.
 */
import * as THREE from "./vendor/three.module.min.js";
import { createLabScene } from "./hardware_lab_3d_scene.js";
import { createCameraRig } from "./hardware_lab_3d_camera.js";
import { createInteractionLayer, worldToScreen } from "./hardware_lab_3d_interactions.js";
import { TweenGroup } from "./hardware_lab_3d_tween.js";
import { createRig } from "./hardware_lab_3d_rig.js";
import { createExplodeController } from "./hardware_lab_3d_explode.js";
import { HardwareLabAudio } from "./hardware_lab_3d_audio.js";

const VIEW_ICONS = {
  front: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>',
  side: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8"/></svg>',
  top: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4v16"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="5" width="14" height="14" rx="1"/><path d="M9 9h6v6H9z"/></svg>',
  internal: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9-9 9-9-9z"/></svg>',
  overview: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M3 12h4M17 12h4M12 3v4M12 17v4"/></svg>',
};
const VIEW_LABELS = { front: "Frontal", side: "Lateral", top: "Superior", back: "Posterior", internal: "Interna", overview: "General" };

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createStage() {
  let sceneApi = null;
  let cameraRig = null;
  let interactions = null;
  let tweenGroup = null;
  let explodeCtl = null;
  let currentRig = null;
  let feedbackTimer = null;
  let toolSelectHandler = null;
  let activeToolId = null;
  let timerInterval = null;

  function ensureSceneReady() {
    if (sceneApi) return sceneApi.supported;
    const canvas = document.getElementById("hwlab-canvas");
    sceneApi = createLabScene(canvas);
    if (!sceneApi.supported) {
      const fallback = document.getElementById("hwlab-canvas-fallback");
      if (fallback) fallback.hidden = false;
      return false;
    }
    tweenGroup = new TweenGroup();
    sceneApi.onTick((dt) => tweenGroup.update(dt));
    cameraRig = createCameraRig({ camera: sceneApi.camera, renderer: sceneApi.renderer, tweenGroup, onTick: sceneApi.onTick });
    interactions = createInteractionLayer({ scene: sceneApi.scene, camera: sceneApi.camera, renderer: sceneApi.renderer, tweenGroup, onTick: sceneApi.onTick });
    explodeCtl = createExplodeController({ tweenGroup });

    interactions.onHover((root, meta) => {
      const tip = document.getElementById("hwlab-tooltip");
      if (!tip) return;
      if (!root || !meta || !meta.partId) {
        tip.hidden = true;
        return;
      }
      const pos = worldToScreen(root, sceneApi.camera, sceneApi.renderer.domElement);
      tip.style.left = pos.x + "px";
      tip.style.top = pos.y + "px";
      tip.textContent = meta.label || meta.partId;
      tip.hidden = pos.behindCamera;
    });

    renderViewButtons();
    wireFullscreen();
    wireSound();
    return true;
  }

  function renderViewButtons() {
    const grid = document.getElementById("hwlab-view-buttons");
    if (!grid) return;
    grid.innerHTML = Object.keys(VIEW_ICONS)
      .map((v) => `<button type="button" class="hwlab-view-btn" data-view="${v}">${VIEW_ICONS[v]}<span>${VIEW_LABELS[v]}</span></button>`)
      .join("");
    grid.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        grid.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        cameraRig.goToView(btn.getAttribute("data-view"));
      });
    });
  }

  function wireFullscreen() {
    const btn = document.getElementById("hwlab-fullscreen-btn");
    const stageEl = document.getElementById("hwlab-stage");
    if (!btn || !stageEl) return;
    function updateIcon() {
      const isFs = document.fullscreenElement === stageEl;
      btn.innerHTML = isFs
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>';
      btn.setAttribute("aria-pressed", String(isFs));
    }
    btn.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else stageEl.requestFullscreen().catch(() => {});
    });
    document.addEventListener("fullscreenchange", () => {
      updateIcon();
      if (sceneApi) setTimeout(() => sceneApi.resize(), 60);
    });
    updateIcon();
  }

  function wireSound() {
    const btn = document.getElementById("hwlab-sound-btn");
    if (!btn) return;
    function render() {
      const muted = HardwareLabAudio.isMuted();
      btn.innerHTML = muted
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
      btn.setAttribute("aria-pressed", String(muted));
      btn.title = muted ? "Activar sonido" : "Silenciar sonido";
    }
    btn.addEventListener("click", () => {
      HardwareLabAudio.toggleMuted();
      render();
    });
    render();
  }

  function showStage() {
    const intro = document.getElementById("hwlab-intro");
    const stage = document.getElementById("hwlab-stage");
    if (intro) intro.hidden = true;
    if (stage) stage.hidden = false;
    const ok = ensureSceneReady();
    if (ok) sceneApi.setPaused(false);
    return ok;
  }

  function hideStage() {
    const intro = document.getElementById("hwlab-intro");
    const stage = document.getElementById("hwlab-stage");
    if (stage) stage.hidden = true;
    if (intro) intro.hidden = false;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    stopTimer();
    if (sceneApi) sceneApi.setPaused(true);
  }

  function loadRig(layout, equipmentId) {
    if (currentRig) currentRig.dispose();
    if (interactions) interactions.clearInteractives();
    if (explodeCtl && explodeCtl.isExploded) explodeCtl.collapse({ duration: 0 });
    currentRig = createRig({ scene: sceneApi.scene, interactions, tweenGroup, layout, equipmentId });
    const sphere = currentRig.getBoundsWorld();
    cameraRig.setRigBounds(sphere.center, sphere.radius);
    cameraRig.goToView("overview", { duration: 0 });
    const activeBtn = document.querySelector('.hwlab-view-btn[data-view="overview"]');
    document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
    if (activeBtn) activeBtn.classList.add("is-active");
    return currentRig;
  }

  function focusOnPart(partId) {
    const obj = currentRig && currentRig.getObject3D(partId);
    if (obj) cameraRig.focusOnObject(obj);
  }

  function toggleExplode() {
    if (!currentRig) return false;
    return explodeCtl.toggle(currentRig.getExplodeEntries(), new THREE.Vector3(0, 0, 0));
  }

  // ── Herramientas (item 10) ────────────────────────────────────────────────
  function renderToolGrid(toolIds, onSelect) {
    const grid = document.getElementById("hwlab-tool-grid");
    const Tools = window.HardwareLab && window.HardwareLab.Tools;
    if (!grid || !Tools) return;
    toolSelectHandler = onSelect;
    activeToolId = null;
    grid.innerHTML = toolIds
      .map((id) => {
        const tool = Tools.getTool(id);
        return `<button type="button" class="hwlab-tool-btn" data-tool="${esc(id)}" title="${esc(tool ? tool.description : "")}">
          <span aria-hidden="true">${esc(tool ? tool.icon : "")}</span>
          <span>${esc(tool ? tool.name : id)}</span>
        </button>`;
      })
      .join("");
    grid.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => setActiveTool(btn.getAttribute("data-tool") === activeToolId ? null : btn.getAttribute("data-tool")));
    });
    updateToolActiveLabel();
  }

  function setActiveTool(toolId) {
    activeToolId = toolId;
    const grid = document.getElementById("hwlab-tool-grid");
    if (grid) {
      grid.querySelectorAll(".hwlab-tool-btn").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-tool") === toolId));
    }
    updateToolActiveLabel();
    HardwareLabAudio.playClick();
    if (toolSelectHandler) toolSelectHandler(toolId);
  }

  function updateToolActiveLabel() {
    const label = document.getElementById("hwlab-tool-active-label");
    const Tools = window.HardwareLab && window.HardwareLab.Tools;
    if (!label) return;
    const tool = activeToolId && Tools ? Tools.getTool(activeToolId) : null;
    label.textContent = tool ? "Activa: " + tool.name : "Ninguna seleccionada (usa las manos)";
  }

  function getActiveToolId() {
    return activeToolId || "hands";
  }

  // ── Feedback / historial ──────────────────────────────────────────────────
  function showFeedback(message, tone) {
    const el = document.getElementById("hwlab-feedback");
    if (!el) return;
    el.textContent = message;
    el.className = "hwlab-feedback hwlab-feedback--" + (tone || "info");
    el.hidden = false;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
    if (tone === "error") HardwareLabAudio.playError();
    else if (tone === "success") HardwareLabAudio.playSuccess();
  }

  function pushActionLog(text, tone) {
    const list = document.getElementById("hwlab-action-log");
    if (!list) return;
    const li = document.createElement("li");
    li.textContent = text;
    if (tone) li.className = "is-" + tone;
    list.appendChild(li);
    list.scrollLeft = list.scrollWidth;
    while (list.children.length > 60) list.removeChild(list.firstChild);
  }

  function clearActionLog() {
    const list = document.getElementById("hwlab-action-log");
    if (list) list.innerHTML = "";
  }

  // ── Barra superior / panel derecho ────────────────────────────────────────
  function setModeTitle(title, subtitle) {
    const t = document.getElementById("hwlab-mode-title");
    const s = document.getElementById("hwlab-mode-subtitle");
    if (t) t.textContent = title;
    if (s) s.textContent = subtitle || "";
  }

  function setStats({ step, total, errors }) {
    const stepEl = document.getElementById("hwlab-step");
    const totalEl = document.getElementById("hwlab-total");
    const errEl = document.getElementById("hwlab-errors");
    const stepStat = document.getElementById("hwlab-stat-step");
    if (stepEl && step != null) stepEl.textContent = String(step);
    if (totalEl && total != null) totalEl.textContent = String(total);
    if (errEl && errors != null) errEl.textContent = String(errors);
    if (stepStat) stepStat.hidden = step == null;
  }

  function setHintUi(used, max, onClick) {
    const btn = document.getElementById("hwlab-hint-btn");
    const count = document.getElementById("hwlab-hint-count");
    if (count) count.textContent = used + "/" + max;
    if (btn) {
      btn.disabled = used >= max;
      btn.onclick = onClick;
    }
  }

  function startTimer(startedAtIso) {
    stopTimer();
    const startedAt = startedAtIso ? Date.parse(startedAtIso) : Date.now();
    const timerEl = document.getElementById("hwlab-timer");
    function tick() {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = m + ":" + s;
    }
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function setInfoPanel(html) {
    const panel = document.getElementById("hwlab-info-panel");
    if (panel) panel.innerHTML = html;
  }

  // ── Ficha tecnica (item 7) ─────────────────────────────────────────────────
  function openPartModal(part) {
    const modal = document.getElementById("hwlab-part-modal");
    const title = document.getElementById("hwlab-part-modal-title");
    const body = document.getElementById("hwlab-part-modal-body");
    if (!modal || !body) return;
    if (title) title.textContent = part.name;
    const info = part.info || {};
    const rows = [
      ["Funcion", info.function],
      ["Ubicacion", info.location],
      ["Tipo de conexion", info.connectionType],
      ["Caracteristicas", info.characteristics],
      ["Precauciones", info.precautions],
      ["Compatibilidad", info.compatibility],
      ["Fallas frecuentes", info.commonErrors],
    ].filter((r) => r[1]);
    body.innerHTML =
      '<dl class="hwlab-spec-list">' +
      rows.map(([label, value]) => `<div class="hwlab-spec-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("") +
      "</dl>";
    modal.hidden = false;
  }

  function closePartModal() {
    const modal = document.getElementById("hwlab-part-modal");
    if (modal) modal.hidden = true;
  }

  function wirePartModalClose() {
    const closeBtn = document.getElementById("hwlab-part-modal-close");
    const modal = document.getElementById("hwlab-part-modal");
    if (closeBtn) closeBtn.addEventListener("click", closePartModal);
    if (modal) modal.addEventListener("click", (e) => {
      if (e.target === modal) closePartModal();
    });
  }
  wirePartModalClose();

  // ── Resultado final ────────────────────────────────────────────────────────
  function openResultModal(result, opts = {}) {
    const modal = document.getElementById("hwlab-result-modal");
    const body = document.getElementById("hwlab-result-modal-body");
    if (!modal || !body) return;
    const pass = result.status === "APROBADO";
    const categories = Object.keys(result.breakdown).filter((k) => k !== "total");
    body.innerHTML =
      '<div class="hwlab-result-score">' +
      `<div class="hwlab-result-score__value">${result.score}<span style="font-size:1.2rem;color:var(--hwlab-text-muted)">/100</span></div>` +
      `<span class="hwlab-result-score__status hwlab-result-score__status--${pass ? "pass" : "fail"}">${pass ? "Aprobado" : "Por mejorar"}</span>` +
      "</div>" +
      '<div class="hwlab-result-bars">' +
      categories
        .map((k) => {
          const cat = result.breakdown[k];
          const pct = Math.round((cat.value / cat.max) * 100);
          return (
            `<div><div class="hwlab-result-bar__label"><span>${esc(k)}</span><span>${cat.value}/${cat.max}</span></div>` +
            `<div class="hwlab-result-bar__track"><div class="hwlab-result-bar__fill" style="width:${pct}%"></div></div></div>`
          );
        })
        .join("") +
      "</div>";
    if (pass) HardwareLabAudio.playComplete();
    const retryBtn = document.getElementById("hwlab-result-retry");
    const menuBtn = document.getElementById("hwlab-result-menu");
    if (retryBtn) retryBtn.onclick = () => { modal.hidden = true; if (opts.onRetry) opts.onRetry(); };
    if (menuBtn) menuBtn.onclick = () => { modal.hidden = true; if (opts.onMenu) opts.onMenu(); };
    modal.hidden = false;
  }

  return {
    showStage,
    hideStage,
    loadRig,
    focusOnPart,
    toggleExplode,
    renderToolGrid,
    setActiveTool,
    getActiveToolId,
    showFeedback,
    pushActionLog,
    clearActionLog,
    setModeTitle,
    setStats,
    setHintUi,
    startTimer,
    stopTimer,
    setInfoPanel,
    openPartModal,
    closePartModal,
    openResultModal,
    get interactions() {
      return interactions;
    },
    get cameraRig() {
      return cameraRig;
    },
    get currentRig() {
      return currentRig;
    },
    get sceneApi() {
      return sceneApi;
    },
  };
}
