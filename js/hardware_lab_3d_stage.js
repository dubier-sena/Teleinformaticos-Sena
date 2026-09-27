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
import { createCameraRig, frameBoxInRect, padFocusBox, CAMERA_MIN_WORLD_Y } from "./hardware_lab_3d_camera.js";
import { createInteractionLayer, worldToScreen, visibleLocalBox } from "./hardware_lab_3d_interactions.js";
import { rect as uiRect, area as uiArea, cardCandidates, chooseSlot, coverRatio, chooseFeedbackSpot, chooseDockSpot, safeViewRect, framingVerdict } from "./hardware_lab_3d_ui_layout.js";
import { TweenGroup } from "./hardware_lab_3d_tween.js";
import { createRig } from "./hardware_lab_3d_rig.js";
import { createScrewController } from "./hardware_lab_3d_screws.js";
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
// Interfaz v2 (sep-26): los botones son ICONOS dentro de la escena; el texto
// completo va en aria-label y en el tooltip (data-tip), orientado al aprendiz.
const VIEW_TIPS = { front: "Vista frontal", side: "Vista lateral", top: "Vista superior", back: "Vista posterior", internal: "Vista interna", overview: "Vista general" };

// ── "Mover portatil" (posiciones tecnicas, sep-26) ─────────────────────────
const POSE_ICONS = {
  yawLeft: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 108-8"/><path d="M4 4v6h6"/></svg>',
  yawRight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 11-8-8"/><path d="M20 4v6h-6"/></svg>',
  flip: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="9" width="16" height="6" rx="1"/><path d="M12 3v4M12 17v4M9 5l3-2 3 2M9 19l3 2 3-2"/></svg>',
  lid: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 18h16"/><path d="M6 18L9 6h9l-3 12"/></svg>',
};

// ── Presets de enfoque rapido por grupo de piezas (mejora 3D, item 8) ──────
// Cada equipo tiene su propio set (el portatil no tiene fuente de poder
// propia, usa bateria en su lugar). Los ids ausentes en un momento dado de
// la practica (pieza ya retirada) se ignoran solos via focusOnObjects().
const FOCUS_ICONS = {
  motherboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1"/><rect x="9" y="9" width="6" height="6"/><path d="M9 4v2M15 4v2M9 18v2M15 18v2M4 9h2M4 15h2M18 9h2M18 15h2"/></svg>',
  storage: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="10" rx="1"/><path d="M7 11h6M17 12h.01"/></svg>',
  cooling: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-6 4-6s2 5-2 7M14 12c4 0 6 1 6 4s-5 2-7-2M12 14c0 4-1 6-4 6s-2-5 2-7M10 12c-4 0-6-1-6-4s5-2 7 2"/></svg>',
  power: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="16" height="9" rx="1"/><path d="M19 11h2v3h-2M8 10l-2 3h4l-2 3"/></svg>',
};
const FOCUS_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>';
const FOCUS_PRESETS = {
  desktop: [
    { key: "motherboard", label: "Placa base", partIds: ["motherboard"] },
    { key: "storage", label: "Almacenamiento", partIds: ["ssd", "ssd-m2"] },
    { key: "cooling", label: "Refrigeración", partIds: ["cooler", "cable-cpu-fan"] },
    { key: "power", label: "Energía", partIds: ["psu", "cable-atx", "cable-cpu-eps"] },
  ],
  laptop: [
    { key: "motherboard", label: "Placa base", partIds: ["motherboard"] },
    { key: "storage", label: "Almacenamiento", partIds: ["ssd-m2"] },
    { key: "cooling", label: "Refrigeración", partIds: ["cooler", "cable-cpu-fan-laptop"] },
    { key: "power", label: "Batería", partIds: ["battery", "cable-battery"] },
  ],
};

// ── "Modo didactico" (mejora 3D, items 10-11): etiquetas 3D opcionales ─────
// Solo las piezas MAYORES (no cada cable/antena/tornillo): con 16-18
// piezas por equipo, etiquetar todo saturaria el canvas y se solaparia
// todo el tiempo -- item 11 pide justamente evitar eso. Un subconjunto
// curado por equipo es la forma mas simple de cumplirlo sin necesitar un
// algoritmo de anti-solape.
const DIDACTIC_LABEL_IDS = {
  desktop: ["motherboard", "cpu", "ram", "gpu", "cooler", "psu", "ssd", "ssd-m2"],
  laptop: ["motherboard", "cpu", "ram", "cooler", "ssd-m2", "battery", "keyboard", "touchpad", "screen-assembly"],
};

// "Tipo" de la ficha tecnica (mejora 3D, item 12): mapea la `category` cruda
// de hardware_lab_data_desktop.js/_laptop.js (minusculas, sin tilde, uso
// interno) a una etiqueta legible. Cubre las 11 categorias reales usadas en
// ambos catalogos (confirmado por grep antes de escribir esto).
const CATEGORY_LABELS = {
  alimentacion: "Alimentación",
  almacenamiento: "Almacenamiento",
  cableado: "Cableado",
  chasis: "Chasis",
  conectividad: "Conectividad",
  entrada: "Entrada",
  expansion: "Expansión",
  memoria: "Memoria",
  procesamiento: "Procesamiento",
  refrigeracion: "Refrigeración",
  salida: "Salida",
};

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
  // Tornillos interactivos (solo equipos cuyo layout los declara). Los hooks
  // los fija el controlador de practica, que es quien tiene la sesion del
  // motor: el stage no sabe de reglas, solo de escena y HUD.
  let currentScrews = null;
  let screwHooks = {};
  // Pieza que la vista "Interna" debe encuadrar completa mientras siga
  // instalada (la tapa inferior del portatil). La fija el controlador, que es
  // quien sabe si la pieza sigue puesta.
  let belowFramePartId = null;
  let feedbackTimer = null;
  let timerInterval = null;
  let didacticActive = false;
  let didacticEquipmentId = null;
  let offDidacticTick = null;
  let baseExposure = null;
  // Posiciones tecnicas: el controlador de practica dice que posicion pide la
  // tarea actual (Vista de trabajo contextual) y se entera de las transiciones.
  let poseHooks = {};

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
      // Los tornillos tambien tienen nombre propio (kind "screw", sin partId):
      // sin esto, pasar el mouse por un tornillo no mostraba nada y no habia
      // forma de saber cual es antes de hacer clic.
      if (!root || !meta || !(meta.partId || meta.label)) {
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
    wireFloatingUi();
    window.addEventListener("resize", () => {
      schedulePlaceCard(200);
      onViewportChange();
    });
    // Vigia de reposo: cada cuadro solo compara la posicion de la camara y del
    // equipo (unos pocos numeros). Cuando el movimiento TERMINA (encuadre de
    // trabajo, volteo, orbita) se programa UNA recolocacion; nunca se coloca
    // la interfaz en cada cuadro. Medido: sin esto la tarjeta se decidia con
    // la pieza en su posicion anterior (SSD tapado un 86 % en el movil).
    let motionSig = "", moving = false, stillSince = 0;
    sceneApi.onTick(() => {
      const c = sceneApi.camera;
      const r = currentRig && currentRig.root;
      const sig = c.position.x.toFixed(3) + c.position.y.toFixed(3) + c.position.z.toFixed(3) + c.quaternion.w.toFixed(4) +
        (r ? r.position.y.toFixed(3) + r.quaternion.x.toFixed(4) + r.quaternion.y.toFixed(4) : "");
      const now = performance.now();
      if (sig !== motionSig) { motionSig = sig; moving = true; stillSince = now; return; }
      if (moving && now - stillSince > 300) {
        moving = false;
        schedulePlaceCard(60);
        if (!frameState.done) scheduleFrameCheck(80);
      }
    });
    if (cameraRig.controls && cameraRig.controls.addEventListener) cameraRig.controls.addEventListener("end", () => schedulePlaceCard(300));
    wireFullscreen();
    wireSound();
    wireDidacticMode();
    return true;
  }

  // ── Interfaz flotante v2 (sep-26) ─────────────────────────────────────────
  // Dock de controles (grupos que en pantallas compactas se abren uno a la
  // vez), tarjeta de instrucciones (contraer / ver mas) e historial plegable.
  // Solo presentacion: ninguna regla del laboratorio vive aqui.
  // Abre/contrae la tarjeta de instrucciones (la asigna wireFloatingUi).
  let setCard = () => {};
  let lastSummary = "";
  function wireFloatingUi() {
    const dock = document.getElementById("hwlab-dock");
    if (dock) {
      const groups = Array.from(dock.querySelectorAll(".hwlab-dock__group"));
      const closeAll = (except) => groups.forEach((g) => { if (g !== except) { g.removeAttribute("data-open"); g.querySelector(".hwlab-dock__toggle").setAttribute("aria-expanded", "false"); } });
      groups.forEach((g) => {
        const t = g.querySelector(".hwlab-dock__toggle");
        t.addEventListener("click", () => {
          const open = g.hasAttribute("data-open");
          closeAll(g);
          if (open) g.removeAttribute("data-open"); else g.setAttribute("data-open", "");
          t.setAttribute("aria-expanded", String(!open));
        });
      });
      // En modo compacto, elegir una accion cierra el grupo (deja la escena libre).
      dock.addEventListener("click", (e) => {
        const btn = e.target.closest(".hwlab-dock__items button");
        if (btn && getComputedStyle(dock).getPropertyValue("--hwlab-dock-compact").trim() === "1") closeAll(null);
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(null); });
      // Tocar la escena (o cualquier cosa fuera del dock) cierra el panel del
      // grupo abierto: si no, quedaba encima de la pieza (medido en el movil).
      document.addEventListener("pointerdown", (e) => { if (!dock.contains(e.target)) closeAll(null); }, true);
    }
    const card = document.getElementById("hwlab-card");
    const toggle = document.getElementById("hwlab-card-toggle");
    setCard = (open) => {
      if (!card || !toggle) return;
      card.setAttribute("data-state", open ? "open" : "closed");
      toggle.setAttribute("aria-expanded", String(open));
      const label = open ? "Contraer instrucciones" : "Mostrar instrucciones";
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("data-tip", label);
    };
    const more = document.getElementById("hwlab-card-more");
    if (card && toggle) {
      toggle.addEventListener("click", () => {
        if (card.getAttribute("data-auto-compact") === "true") {
          // El aprendiz quiere ver el detalle: se respeta durante este paso.
          userExpandedFor = (document.getElementById("hwlab-card-summary") || {}).textContent || "";
          card.removeAttribute("data-auto-compact");
          card.style.maxHeight = "";
          setCard(true);
          return;
        }
        setCard(card.getAttribute("data-state") === "closed");
      });
    }
    if (card && more) {
      more.addEventListener("click", () => {
        const full = card.getAttribute("data-detail") === "full";
        card.setAttribute("data-detail", full ? "brief" : "full");
        more.setAttribute("aria-pressed", String(!full));
        more.textContent = full ? "Ver más" : "Ver menos";
      });
    }
    const hist = document.getElementById("hwlab-history");
    const ht = document.getElementById("hwlab-history-toggle");
    const log = document.getElementById("hwlab-action-log");
    if (hist && ht && log) {
      ht.addEventListener("click", () => {
        const open = hist.getAttribute("data-open") === "true";
        hist.setAttribute("data-open", String(!open));
        ht.setAttribute("aria-expanded", String(!open));
        log.hidden = open;
        layoutHistory();
        if (!open) log.scrollTop = log.scrollHeight;
      });
      window.addEventListener("resize", layoutHistory);
    }
  }

  /** El historial ABIERTO nunca tapa los controles (medido: en 1024x625 cubria
   *  Enfoque/Visualizacion y en el movil la barra de grupos). Escritorio: su
   *  lista no sube por encima del dock. Movil: el dock sube lo que crece. */
  function layoutHistory() {
    const scene = document.getElementById("hwlab-scene");
    const hist = document.getElementById("hwlab-history");
    const log = document.getElementById("hwlab-action-log");
    const dock = document.getElementById("hwlab-dock");
    if (!scene || !hist || !log || !dock) return;
    log.style.maxHeight = "";
    scene.style.setProperty("--hwlab-history-extra", "0px");
    if (hist.getAttribute("data-open") !== "true") return;
    if (window.matchMedia && window.matchMedia("(max-width: 600px)").matches) {
      scene.style.setProperty("--hwlab-history-extra", log.getBoundingClientRect().height + "px");
      return;
    }
    const d = dock.getBoundingClientRect(), h = hist.getBoundingClientRect(), l = log.getBoundingClientRect();
    if (d.left < h.right && d.right > h.left) {
      const room = Math.floor(l.bottom - (d.bottom + 8));
      if (room < l.height) log.style.maxHeight = Math.max(56, room) + "px";
    }
  }

  // ── Modo didactico (mejora 3D, items 10-11) ────────────────────────────────
  function wireDidacticMode() {
    const btn = document.getElementById("hwlab-didactic-btn");
    if (!btn) return;
    baseExposure = sceneApi.renderer.toneMappingExposure;
    btn.addEventListener("click", () => setDidacticMode(!didacticActive));
  }

  function setDidacticMode(on) {
    didacticActive = on;
    const btn = document.getElementById("hwlab-didactic-btn");
    if (btn) { btn.classList.toggle("is-active", on); btn.setAttribute("aria-pressed", String(on)); }
    const layer = document.getElementById("hwlab-labels-layer");
    if (layer) layer.hidden = !on;

    // "puede aumentar ligeramente el contraste" (item 10): un empujon
    // pequeno y reversible a la exposicion global, no un pase de
    // postprocesado nuevo (mas caro, mas riesgo -- ver item 14).
    if (sceneApi && sceneApi.renderer) {
      sceneApi.renderer.toneMappingExposure = on ? baseExposure + 0.12 : baseExposure;
    }

    if (offDidacticTick) {
      offDidacticTick();
      offDidacticTick = null;
    }
    if (layer) layer.innerHTML = "";

    if (!on) return;

    const ids = DIDACTIC_LABEL_IDS[didacticEquipmentId] || [];
    const labelEls = new Map();
    ids.forEach((partId) => {
      const el = document.createElement("div");
      el.className = "hwlab-3d-label";
      el.innerHTML = '<span class="hwlab-3d-label__dot"></span><span></span>';
      layer.appendChild(el);
      labelEls.set(partId, el);
    });

    const MIN_LABEL_GAP = 24; // px verticales minimos entre etiquetas vecinas
    const scratchVec3 = new THREE.Vector3(); // reusado cada tick (item 14: nada de asignar por frame)
    offDidacticTick = sceneApi.onTick(() => {
      if (!currentRig) return;
      const canvasRect = sceneApi.renderer.domElement.getBoundingClientRect();

      // Paso 1: posicion "real" de cada etiqueta visible, mas su distancia a
      // camara (para decidir quien cede el paso al superponerse: la pieza
      // mas cercana se queda en su lugar exacto).
      const visible = [];
      ids.forEach((partId) => {
        const el = labelEls.get(partId);
        const obj = currentRig.getObject3D(partId);
        if (!el || !obj) return;
        const pos = worldToScreen(obj, sceneApi.camera, sceneApi.renderer.domElement);
        const inCanvas =
          !pos.behindCamera && pos.x >= canvasRect.left && pos.x <= canvasRect.right && pos.y >= canvasRect.top && pos.y <= canvasRect.bottom;
        if (!inCanvas) {
          el.style.opacity = "0";
          return;
        }
        const meta = interactions.getMeta(obj);
        visible.push({
          el,
          x: pos.x - canvasRect.left,
          y: pos.y - canvasRect.top,
          dist: sceneApi.camera.position.distanceTo(obj.getWorldPosition(scratchVec3)),
          label: (meta && meta.label) || partId,
        });
      });

      // Paso 2: separacion vertical simple (item 11: "evitar solaparse en lo
      // posible") -- ordena de mas cerca a mas lejos de la camara para que
      // la pieza mas relevante en este encuadre conserve su punto real, y
      // empuja hacia abajo cualquier etiqueta que quede muy junto a otra ya
      // colocada. No es un layout perfecto, pero evita el amontonamiento
      // ilegible del caso mas comun (varias piezas internas cercanas).
      visible.sort((a, b) => a.dist - b.dist);
      const placed = [];
      visible.forEach((item) => {
        let y = item.y;
        const collides = () => placed.some((p) => Math.abs(p.x - item.x) < 90 && Math.abs(p.y - y) < MIN_LABEL_GAP);
        let guard = 0;
        while (collides() && guard++ < 12) y += MIN_LABEL_GAP;
        placed.push({ x: item.x, y });
        item.finalY = y;
      });

      visible.forEach((item) => {
        item.el.style.opacity = "1";
        item.el.style.left = item.x + "px";
        item.el.style.top = item.finalY + "px";
        const nameSpan = item.el.querySelector("span:last-child");
        if (nameSpan.textContent !== item.label) nameSpan.textContent = item.label;
      });
    });
  }

  function renderViewButtons() {
    const grid = document.getElementById("hwlab-view-buttons");
    if (!grid) return;
    grid.innerHTML = Object.keys(VIEW_ICONS)
      .map((v) => `<button type="button" class="hwlab-view-btn hwlab-dock__btn" data-view="${v}" aria-label="${VIEW_TIPS[v]}" data-tip="${VIEW_TIPS[v]}">${VIEW_ICONS[v]}<span class="hwlab-dock__label">${VIEW_LABELS[v]}</span></button>`)
      .join("");
    grid.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // GENERAL = ENCUADRE: reencuadra el equipo segun su transformacion
        // ACTUAL (girado, volteado...), sin cambiar su pose ni sus piezas.
        // Solo equipos con posiciones tecnicas: el escritorio no se mueve y
        // conserva su encuadre de siempre.
        if (currentRig && currentRig.hasPose) refreshRigBounds();
        // Selector global (no solo dentro de "grid"): "Vistas de camara" y
        // "Enfoque rapido" comparten la clase .hwlab-view-btn y son
        // mutuamente excluyentes -- solo un boton activo entre los dos
        // grupos a la vez.
        document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        cameraRig.goToView(btn.getAttribute("data-view"));
        schedulePlaceCard(CAMERA_SETTLE_MS);
      });
    });
  }

  /** Botones de enfoque rapido por grupo de piezas (mejora 3D, item 8). */
  function renderFocusButtons(equipmentId) {
    const panel = document.getElementById("hwlab-focus-panel");
    const grid = document.getElementById("hwlab-focus-buttons");
    const presets = FOCUS_PRESETS[equipmentId];
    if (!panel || !grid || !presets) {
      if (panel) panel.hidden = true;
      return;
    }
    panel.hidden = false;
    grid.innerHTML = presets
      .map((p) => `<button type="button" class="hwlab-view-btn hwlab-dock__btn" data-focus="${p.key}" aria-label="Enfocar: ${esc(p.label)}" data-tip="Enfocar: ${esc(p.label)}">${FOCUS_ICONS[p.key] || FOCUS_ICON}<span class="hwlab-dock__label">${esc(p.label)}</span></button>`)
      .join("");
    grid.querySelectorAll("[data-focus]").forEach((btn) => {
      const preset = presets.find((p) => p.key === btn.getAttribute("data-focus"));
      btn.addEventListener("click", () => {
        if (!currentRig || !preset) return;
        const objects = preset.partIds.map((id) => currentRig.getObject3D(id)).filter(Boolean);
        if (!objects.length) return;
        document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        // distanceFactor mas ajustado que el default (3.4, pensado para
        // focusOnObject de una sola pieza chica): un grupo como "Refrigeracion"
        // o "Energia" ya ocupa varias piezas, y con el default el resultado se
        // sentia casi igual de alejado que la vista "General" (confirmado con
        // clic real) -- 2.3 deja el grupo notablemente mas cerca sin llegar a
        // recortar piezas del encuadre.
        cameraRig.focusOnObjects(objects, { distanceFactor: 2.3 });
        schedulePlaceCard(CAMERA_SETTLE_MS);
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
    // Cada practica fija su propia politica de encuadre (la diagnostica no usa ninguna).
    framingPolicy = null;
    frameState = { key: null, done: true };
    if (currentRig) currentRig.dispose();
    if (interactions) interactions.clearInteractives();
    if (explodeCtl && explodeCtl.isExploded) explodeCtl.collapse({ duration: 0 });
    currentRig = createRig({ scene: sceneApi.scene, interactions, tweenGroup, layout, equipmentId });
    currentScrews = null;
    if (currentRig.screwEntries && currentRig.screwEntries.length) {
      currentScrews = createScrewController({
        group: currentRig.screwGroup,
        entries: currentRig.screwEntries,
        tweenGroup,
        dishOrigin: currentRig.screwDishOrigin || new THREE.Vector3(),
        dishWorldOrigin: currentRig.screwDishWorldOrigin || undefined,
        // Plano de la mesa: el destornillador nunca debe acercarse tanto que
        // su mango termine dentro del tablero.
        floorY: currentRig.tableWorldY,
        canOperatePart: (partId, action) => (screwHooks.canOperatePart ? screwHooks.canOperatePart(partId, action) : { ok: true }),
        onChanged: (screwId, installed, partId) => screwHooks.onChanged && screwHooks.onChanged(screwId, installed, partId),
        notify: (message, kind) => showFeedback(message, kind),
        onBusyChange: (busy) => screwHooks.onBusyChange && screwHooks.onBusyChange(busy),
        playSound: () => HardwareLabAudio.playScrew(),
      });
      // Posiciones tecnicas: al girar/voltear el portatil, los tornillos ya
      // retirados siguen en la bandeja magnetica de la mesa.
      if (currentRig.onPoseChange) {
        const screwsCtl = currentScrews;
        currentRig.onPoseChange(() => screwsCtl.refreshStowed());
      }
    }
    const sphere = currentRig.getBoundsWorld();
    // El portatil se abre por la tapa INFERIOR (ver caseGatePartId en
    // hardware_lab_data_laptop.js) -- la vista "Interna" necesita mirar
    // desde abajo hacia arriba para esa pieza, a diferencia del escritorio.
    cameraRig.setRigBounds(sphere.center, sphere.radius, {
      viewFromBelow: equipmentId === "laptop",
      // Centro de la BASE del portatil, a la altura de sus componentes.
      belowTarget: equipmentId === "laptop" ? currentRig.root.position.clone().add(new THREE.Vector3(0, 0.008, 0)) : null,
    });
    cameraRig.setBelowFrameProvider(() => {
      if (!belowFramePartId || !currentRig) return null;
      const obj = currentRig.getObject3D(belowFramePartId);
      if (!obj) return null;
      const box = new THREE.Box3().setFromObject(obj);
      // Los tornillos de esa pieza tambien tienen que entrar en el cuadro:
      // son parte del trabajo del paso, y algunos quedan en el borde exacto
      // de la pieza (medido: el trasero izquierdo de la placa base).
      if (currentScrews) {
        currentScrews.forPart(belowFramePartId).forEach((e) => box.expandByObject(e.object3d));
      }
      return box.getBoundingSphere(new THREE.Sphere()).radius;
    });
    setupPoseControls();
    cameraRig.goToView("overview", { duration: 0 });
    const activeBtn = document.querySelector('.hwlab-view-btn[data-view="overview"]');
    document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
    if (activeBtn) activeBtn.classList.add("is-active");
    renderFocusButtons(equipmentId);
    didacticEquipmentId = equipmentId;
    if (didacticActive) setDidacticMode(true); // reconstruye las etiquetas para el equipo nuevo
    return currentRig;
  }

  // ── POSICIONES TECNICAS (sep-26) ──────────────────────────────────────────
  /** Encuadre de camara con el equipo tal como esta AHORA (solo lo instalado:
   *  la bandeja no infla el cuadro). */
  function refreshRigBounds() {
    if (!currentRig || !cameraRig) return;
    const sphere = currentRig.getBoundsWorld({ installedOnly: true });
    const box = currentRig.getBoundsBoxWorld ? currentRig.getBoundsBoxWorld() : null;
    cameraRig.setRigBounds(sphere.center, sphere.radius, box ? { height: box.max.y - box.min.y } : undefined);
  }

  function poseBusy() {
    if (!currentRig || !currentRig.hasPose) return false;
    return currentRig.isPoseAnimating() || (currentRig.anyMoving && currentRig.anyMoving()) || (currentScrews && currentScrews.isBusy());
  }

  /** Posicion de trabajo que tiene sentido con el equipo como esta, cuando el
   *  controlador no pide una concreta (p.ej. "Aprender componentes"). */
  function defaultWorkPreset() {
    const pose = currentRig.getPose();
    if (pose.flipped) return isPresent("bottom-cover") ? "bottom" : "internal";
    return "keyboard";
  }
  function isPresent(partId) {
    return !!(currentRig && currentRig.isPresent && currentRig.isPresent(partId));
  }

  function frameWorkView(name, opts) {
    if (!currentRig || !currentRig.hasPose) return;
    const box = currentRig.workFocusBox(name);
    const dir = currentRig.workViewDir(name);
    if (!dir) return;
    document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
    // Encuadre de trabajo pedido (Preparar / Vista de trabajo): se evalua ANTES
    // de volar si dejara bien la pieza objetivo; si no, se vuela directamente
    // al encuadre corregido. UN solo vuelo: medido, un segundo vuelo 0,4 s
    // despues del primero hacia que un clic en un tornillo cayera en la placa
    // (error penalizado en el ensamble del movil).
    if (framingActive() && box && !box.isEmpty()) {
      const wf = cameraRig.workFrame(box, dir);
      const cam = sceneApi.camera.clone();
      cam.position.copy(wf.pos);
      cam.lookAt(wf.target);
      cam.updateMatrixWorld(true);
      const plan = planTargetFrame(cam, wf.target);
      if (plan) {
        frameState.done = true;
        if (!plan.ok) {
          cameraRig.flyTo(plan.frame.pos, plan.frame.target, opts);
          return;
        }
      }
    }
    cameraRig.frameWork(box, dir, opts);
  }

  /** Lleva el portatil a una posicion tecnica (con su transicion visible) y
   *  encuadra su vista de trabajo. Devuelve false si ahora no se puede. */
  function goToWorkPose(name, opts = {}) {
    if (!currentRig || !currentRig.hasPose) return false;
    const target = currentRig.presetPose(name);
    if (!target) return false;
    if (poseBusy()) {
      showFeedback("Espera a que termine la operacion en curso antes de mover el portatil.", "info");
      return false;
    }
    if (currentRig.isAtPreset(name)) {
      refreshRigBounds();
      if (opts.frame !== false) frameWorkView(name);
      if (opts.onDone) opts.onDone();
      renderPoseStatus();
      return true;
    }
    const label = (currentRig.presets[name] && currentRig.presets[name].label) || name;
    return movePose(target, {
      announce: "Preparando: " + label.toLowerCase(),
      onDone: () => {
        if (opts.frame !== false) frameWorkView(name);
        if (opts.onDone) opts.onDone();
      },
    });
  }

  function movePose(target, opts = {}) {
    if (poseBusy()) {
      showFeedback("Espera a que termine la operacion en curso antes de mover el portatil.", "info");
      return false;
    }
    if (poseHooks.onPoseStart) poseHooks.onPoseStart();
    const announceId = opts.announce ? showFeedback(opts.announce, "info", { transient: true }) : 0;
    setPoseButtonsEnabled(false);
    const ok = currentRig.setPose(target, {
      onDone: () => {
        if (announceId) endTransientFeedback(announceId);
        refreshRigBounds();
        setPoseButtonsEnabled(true);
        renderPoseStatus();
        if (opts.onDone) opts.onDone();
        if (poseHooks.onPoseEnd) poseHooks.onPoseEnd(currentRig.getPose());
        schedulePlaceCard(CAMERA_SETTLE_MS);
      },
    });
    if (!ok) {
      setPoseButtonsEnabled(true);
      if (announceId) endTransientFeedback(announceId);
    }
    return ok;
  }

  function setPoseButtonsEnabled(on) {
    // Solo los botones de la accion (no el que abre/cierra el grupo del dock).
    document.querySelectorAll("#hwlab-pose-items button").forEach((b) => { b.disabled = !on; });
  }

  function renderPoseStatus() {
    const el = document.getElementById("hwlab-pose-status");
    if (!el || !currentRig || !currentRig.hasPose) return;
    const presets = currentRig.presets;
    const pose = currentRig.getPose();
    // Volteado, "Tapa inferior" y "Componentes internos" son la misma
    // orientacion: el nombre depende de si la tapa sigue puesta.
    const skip = pose.flipped ? (isPresent("bottom-cover") ? "internal" : "bottom") : null;
    const match = Object.keys(presets).find((k) => k !== skip && currentRig.isAtPreset(k));
    let text;
    const lidId = currentRig.lidConfig ? currentRig.lidConfig.partId : null;
    if (!pose.flipped && lidId && !isPresent(lidId)) text = "Derecho, sin pantalla";
    // Teclado y pantalla comparten orientacion (tapa a 90 grados, medido).
    else if ((match === "keyboard" || match === "display") && currentRig.isAtPreset("keyboard") && currentRig.isAtPreset("display")) text = "Trabajo por arriba (pantalla a 90 grados)";
    else if (match) text = presets[match].label;
    else if (pose.flipped) text = "Boca abajo (girado)";
    else text = Math.abs(pose.lid) < 0.01 ? "Cerrado (girado)" : "Abierto (girado)";
    el.textContent = "Posición actual: " + text;
    const lidBtn = document.querySelector('[data-pose="lid"]');
    if (lidBtn) {
      const lidText = Math.abs(pose.lid) < 0.01 ? "Abrir pantalla" : "Cerrar pantalla";
      lidBtn.querySelector("span").textContent = lidText;
      lidBtn.setAttribute("aria-label", lidText);
      lidBtn.setAttribute("data-tip", lidText);
      // Boca abajo la pantalla queda cerrada contra el soporte.
      if (!currentRig.isPoseAnimating()) lidBtn.disabled = !!pose.flipped;
    }
  }

  function setupPoseControls() {
    const panel = document.getElementById("hwlab-pose-panel");
    const rig = currentRig;
    if (!rig || !rig.hasPose) {
      if (panel) panel.hidden = true;
      cameraRig.setInteriorProvider(null);
      return;
    }
    // La vista "Interna" mira el interior por donde este: desde arriba con el
    // equipo volteado, desde abajo (como siempre) con el equipo derecho.
    cameraRig.setInteriorProvider(() => {
      const pose = rig.getPose();
      if (pose.flipped) {
        const name = isPresent("bottom-cover") ? "bottom" : "internal";
        return { up: true, box: rig.workFocusBox(name), dir: rig.workViewDir(name) };
      }
      return { up: false, belowTarget: rig.root.localToWorld(new THREE.Vector3(0, 0.008, 0)) };
    });
    if (!panel) return;
    panel.hidden = false;
    const grid = document.getElementById("hwlab-pose-buttons");
    const btns = [
      ["yawLeft", "Girar izq.", "Girar el portátil 90° a la izquierda", POSE_ICONS.yawLeft],
      ["yawRight", "Girar der.", "Girar el portátil 90° a la derecha", POSE_ICONS.yawRight],
      ["flip", "Voltear", "Cerrar y voltear el portátil", POSE_ICONS.flip],
      ["lid", "Cerrar pantalla", "Cerrar la pantalla", POSE_ICONS.lid],
    ];
    grid.innerHTML = btns
      .map(([k, label, title, icon]) => `<button type="button" class="hwlab-view-btn hwlab-dock__btn hwlab-pose-btn" data-pose="${k}" aria-label="${esc(title)}" data-tip="${esc(title)}">${icon}<span class="hwlab-dock__label">${esc(label)}</span></button>`)
      .join("");
    grid.querySelectorAll("[data-pose]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pose = rig.getPose();
        const lidCfg = rig.lidConfig;
        const k = btn.getAttribute("data-pose");
        const reframe = () => { refreshRigBounds(); cameraRig.goToView("overview"); };
        if (k === "yawLeft" || k === "yawRight") {
          movePose({ yaw: pose.yaw + (k === "yawLeft" ? 1 : -1) * Math.PI / 2 }, { onDone: reframe });
        } else if (k === "flip") {
          movePose({ flipped: !pose.flipped, lid: lidCfg ? lidCfg.closedAngle : pose.lid }, {
            announce: pose.flipped ? "Volteando a su posición normal" : "Cerrando y volteando el portátil",
            onDone: reframe,
          });
        } else if (k === "lid") {
          if (pose.flipped) {
            showFeedback("Con el portátil boca abajo la pantalla queda cerrada: primero voltéalo a su posición normal.", "info");
            return;
          }
          const closed = Math.abs(pose.lid - (lidCfg ? lidCfg.closedAngle : 0)) < 0.01;
          movePose({ lid: closed ? lidCfg.openAngle : lidCfg.closedAngle }, { onDone: reframe });
        }
      });
    });
    const workBtn = document.getElementById("hwlab-work-view-btn");
    if (workBtn) {
      workBtn.onclick = () => {
        const name = (poseHooks.contextualPreset && poseHooks.contextualPreset()) || defaultWorkPreset();
        goToWorkPose(name);
      };
    }
    renderPoseStatus();
  }

  function setPoseHooks(hooks) {
    poseHooks = hooks || {};
  }

  /** El controlador de practica registra aqui las reglas que dependen de la
   * sesion del motor (que pieza puede operarse ahora, persistencia). */
  function setScrewHooks(hooks) {
    screwHooks = hooks || {};
  }

  /** Pieza que la vista "Interna" debe encuadrar completa en este momento
   * (con sus tornillos): la tapa mientras siga puesta, o la pieza del paso. */
  function setBelowFraming(partId) {
    const changed = (partId || null) !== belowFramePartId;
    if (changed) schedulePlaceCard(CAMERA_SETTLE_MS);
    belowFramePartId = partId || null;
    if (changed) {
      frameState = { key: belowFramePartId, done: false };
      scheduleFrameCheck(350);
    }
  }

  function focusOnPart(partId) {
    // Practica guiada: la camara no persigue cada pieza clicada (antes se
    // acercaba a 0,22 m de la pieza RECIEN RETIRADA y el objetivo siguiente
    // quedaba fuera de cuadro: antena Wi-Fi al 24 %, cable del ventilador al
    // 0 %, medido). Se re-verifica el encuadre de la pieza OBJETIVO y solo se
    // mueve si hace falta (p. ej. una pieza recien instalada con tornillos).
    if (framingActive()) {
      frameState.done = false;
      scheduleFrameCheck(350);
      schedulePlaceCard(CAMERA_SETTLE_MS);
      return;
    }
    const obj = currentRig && currentRig.getObject3D(partId);
    if (obj) cameraRig.focusOnObject(obj);
    schedulePlaceCard(CAMERA_SETTLE_MS);
  }

  // ── Encuadre por pieza objetivo (sep-26) ──────────────────────────────────
  // Al empezar una accion guiada se comprueba UNA vez si la pieza de trabajo
  // (belowFramePartId) se ve bien dentro del AREA SEGURA (escena sin las
  // bandas de interfaz). Solo si no (menos del 90 % dentro, o demasiado
  // pequena) se vuela a un encuadre que la muestra completa y centrada,
  // conservando el angulo de trabajo actual. Histeresis: una vez comprobada,
  // no se vuelve a mover por esa pieza salvo que cambie el objetivo, el
  // tamano de la ventana o se pida un nuevo enfoque. Nunca en cada cuadro ni
  // despues de que el aprendiz orbite.
  let framingPolicy = null; // { active(): bool, accessible(partId): bool } del controlador de practica
  let frameState = { key: null, done: true };
  let frameTimer = null;
  let frameViewport = "";
  let lastFraming = null; // diagnostico (lo leen las pruebas)

  function setFramingPolicy(policy) {
    framingPolicy = policy || null;
    frameState = { key: belowFramePartId, done: !framingPolicy };
    if (framingPolicy) scheduleFrameCheck(400);
  }

  function framingActive() {
    return !!(framingPolicy && framingPolicy.active && framingPolicy.active());
  }

  function scheduleFrameCheck(ms) {
    if (frameTimer) clearTimeout(frameTimer);
    frameTimer = setTimeout(() => {
      frameTimer = null;
      tryFrameCheck();
    }, ms);
  }

  function onViewportChange() {
    const scene = document.getElementById("hwlab-scene");
    if (!scene) return;
    const r = scene.getBoundingClientRect();
    const prev = frameViewport.split("x").map(Number);
    frameViewport = Math.round(r.width) + "x" + Math.round(r.height);
    // Solo un cambio SIGNIFICATIVO (giro del movil, ventana redimensionada).
    if (prev.length === 2 && (Math.abs(prev[0] - r.width) > prev[0] * 0.1 || Math.abs(prev[1] - r.height) > prev[1] * 0.1)) {
      frameState.done = false;
      scheduleFrameCheck(400);
    }
  }

  /** Caja de ENFOQUE de la pieza: su geometria visible (y sus tornillos en su
   *  sitio) + un margen que depende de su tamano + un minimo de contexto. */
  function targetFocusBox(partId) {
    const obj = currentRig && currentRig.getObject3D(partId);
    if (!obj || !obj.visible) return null;
    obj.updateMatrixWorld(true);
    const local = visibleLocalBox(obj);
    if (local.isEmpty()) return null;
    const box = new THREE.Box3();
    for (let i = 0; i < 8; i++) {
      box.expandByPoint(new THREE.Vector3(i & 1 ? local.max.x : local.min.x, i & 2 ? local.max.y : local.min.y, i & 4 ? local.max.z : local.min.z).applyMatrix4(obj.matrixWorld));
    }
    if (currentScrews && currentScrews.forPart) {
      currentScrews.forPart(partId).forEach((e) => {
        const o = e.object3d;
        if (o && o.visible && e.homePosition && o.position.distanceTo(e.homePosition) < 0.02) box.expandByObject(o);
      });
    }
    return padFocusBox(box);
  }

  /** Proyeccion de la geometria visible de la pieza (tambien lo que cae fuera de la pantalla). */
  function targetScreenPoints(partId, cam = sceneApi.camera) {
    const obj = currentRig && currentRig.getObject3D(partId);
    if (!obj) return [];
    const cr = sceneApi.renderer.domElement.getBoundingClientRect();
    const pts = [];
    const push = (v) => {
      const p = v.project(cam);
      pts.push({ x: cr.left + ((p.x + 1) / 2) * cr.width, y: cr.top + ((1 - p.y) / 2) * cr.height, front: p.z > -1 && p.z < 1 });
    };
    obj.updateMatrixWorld(true);
    obj.traverse((n) => {
      if (!n.isMesh || (n.userData && n.userData.hwlabHitbox)) return;
      for (let q = n; q; q = q.parent) if (!q.visible) return;
      if (n.geometry.parameters && n.geometry.parameters.path) { for (let k = 0; k <= 24; k++) push(n.geometry.parameters.path.getPointAt(k / 24).applyMatrix4(n.matrixWorld)); return; }
      // Mallas instanciadas (componentes SMD): cada copia esta en SU matriz;
      // con solo la plantilla, los puntos caian lejos de la pieza (medido: RAM).
      if (n.isInstancedMesh) {
        const m = new THREE.Matrix4();
        const c = new THREE.Vector3();
        if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
        n.geometry.boundingBox.getCenter(c);
        const step = Math.max(1, Math.floor(n.count / 24));
        for (let i = 0; i < n.count; i += step) { n.getMatrixAt(i, m); push(c.clone().applyMatrix4(m).applyMatrix4(n.matrixWorld)); }
        return;
      }
      const pa = n.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pa.count / 24));
      for (let i = 0; i < pa.count; i += step) push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(n.matrixWorld));
    });
    return pts;
  }

  /** Centro en pantalla de cada tornillo de la pieza que sigue en su sitio (por quitar o por apretar). */
  function pendingScrewPoints(partId, cam = sceneApi.camera) {
    if (!currentScrews || !currentScrews.forPart) return [];
    const cr = sceneApi.renderer.domElement.getBoundingClientRect();
    return currentScrews.forPart(partId)
      .filter((e) => e.object3d && e.object3d.visible && e.homePosition && e.object3d.position.distanceTo(e.homePosition) < 0.02)
      .map((e) => {
        const c = e.object3d.getWorldPosition(new THREE.Vector3());
        const sphere = new THREE.Box3().setFromObject(e.object3d).getBoundingSphere(new THREE.Sphere());
        const p = c.clone().project(cam);
        // Diametro aparente: el radio real del tornillo llevado al plano de la camara.
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).multiplyScalar(Math.max(sphere.radius, 0.001));
        const q = c.clone().add(right).project(cam);
        const px = Math.hypot((q.x - p.x) * cr.width, (q.y - p.y) * cr.height); // = 2 * radio en px
        return { x: cr.left + ((p.x + 1) / 2) * cr.width, y: cr.top + ((1 - p.y) / 2) * cr.height, front: p.z > -1 && p.z < 1, px };
      });
  }

  /** Decide el encuadre de la pieza objetivo para una camara dada (la real o
   *  una hipotetica: la del encuadre de trabajo que se va a pedir). Devuelve
   *  null si ahora no se puede decidir, { ok: true } si esa camara ya la
   *  muestra bien, o { ok: false, frame } con la posicion corregida. */
  function planTargetFrame(cam, lookTarget) {
    if (!framingActive() || !belowFramePartId || !currentRig || !sceneApi) return null;
    // Pieza aun inaccesible en esta posicion (p. ej. interior con el portatil
    // derecho): se espera a que el aprendiz prepare la posicion.
    if (framingPolicy.accessible && !framingPolicy.accessible(belowFramePartId)) return null;
    const scene = rectOf(document.getElementById("hwlab-scene"));
    const cr = sceneApi.renderer.domElement.getBoundingClientRect();
    if (!scene || !cr.width || !cr.height) return null;
    const focus = targetFocusBox(belowFramePartId);
    if (!focus) return null;
    const safe = safeViewRect({
      scene,
      card: rectOf(document.getElementById("hwlab-card")),
      dock: rectOf(document.getElementById("hwlab-dock")),
      history: rectOf(document.getElementById("hwlab-history-toggle")),
    });
    const verdict = framingVerdict(targetScreenPoints(belowFramePartId, cam), safe, { large: focus.large, screws: pendingScrewPoints(belowFramePartId, cam) });
    lastFraming = { part: belowFramePartId, verdict, moved: false };
    if (verdict.ok) return { ok: true };
    const dir = cam.position.clone().sub(lookTarget);
    // Vista desde ABAJO (portatil derecho, encuadre propio de la tapa): no se toca.
    if (dir.y < 0 || dir.lengthSq() < 1e-8) return { ok: true, skipped: true };
    const ndcRect = [
      ((safe.left - cr.left) / cr.width) * 2 - 1,
      ((safe.right - cr.left) / cr.width) * 2 - 1,
      1 - ((safe.bottom - cr.top) / cr.height) * 2,
      1 - ((safe.top - cr.top) / cr.height) * 2,
    ];
    const f = frameBoxInRect({ box: focus.box, dir, fovY: cam.fov, aspect: cam.aspect, ndcRect, minDist: cameraRig.controls.minDistance + 0.02, maxDist: cameraRig.controls.maxDistance * 0.9 });
    const finite = [f.pos.x, f.pos.y, f.pos.z, f.target.x, f.target.y, f.target.z].every(Number.isFinite);
    // Nunca por debajo del tablero.
    if (!finite || f.pos.y < CAMERA_MIN_WORLD_Y + 0.01) return { ok: true, skipped: true };
    lastFraming.moved = true;
    lastFraming.dist = f.dist;
    return { ok: false, frame: f };
  }

  function tryFrameCheck() {
    if (!framingActive() || frameState.done || !belowFramePartId || !currentRig || !sceneApi) return;
    // Nada se decide con la camara o el equipo en movimiento.
    if (cameraRig.isFlying() || poseBusy() || (currentRig.anyMoving && currentRig.anyMoving())) {
      scheduleFrameCheck(300);
      return;
    }
    const plan = planTargetFrame(sceneApi.camera, cameraRig.controls.target);
    if (!plan) return;
    frameState.done = true;
    if (!plan.ok) cameraRig.flyTo(plan.frame.pos, plan.frame.target); // si ya se ve bien: la camara NO se mueve
  }

  // ── Interfaz alrededor del trabajo (sep-26) ─────────────────────────────────
  // La tarjeta y los avisos evitan TAPAR la pieza del paso actual. Solo se
  // decide en momentos concretos (cambio de paso o de vista, fin de una
  // animacion u orbita, cambio de tamano de ventana), nunca en cada cuadro.
  const CAMERA_SETTLE_MS = 1200; // la camara anima ~1.05 s
  let placeTimer = null;
  let cardSlot = null;
  let userExpandedFor = null; // resumen del paso en que el aprendiz expandio a mano

  function schedulePlaceCard(ms) {
    if (placeTimer) clearTimeout(placeTimer);
    placeTimer = setTimeout(() => { placeTimer = null; placeCard(); }, ms == null ? 120 : ms);
  }

  /** Rectangulo en pantalla de la GEOMETRIA VISIBLE de la pieza del paso. */
  function targetScreenRect() {
    if (!belowFramePartId || !currentRig || !sceneApi) return null;
    const obj = currentRig.getObject3D(belowFramePartId);
    if (!obj || !obj.visible) return null;
    const box = visibleLocalBox(obj);
    if (box.isEmpty()) return null;
    const cam = sceneApi.camera;
    const cr = sceneApi.renderer.domElement.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, front = 0;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(obj.matrixWorld).project(cam);
      if (p.z > 1) continue;
      front++;
      const x = cr.left + ((p.x + 1) / 2) * cr.width, y = cr.top + ((1 - p.y) / 2) * cr.height;
      l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); b = Math.max(b, y);
    }
    if (!front) return null;
    const clip = { left: Math.max(l, cr.left), top: Math.max(t, cr.top), right: Math.min(r, cr.right), bottom: Math.min(b, cr.bottom) };
    if (!(clip.right > clip.left && clip.bottom > clip.top)) return null;
    // Muestra de la GEOMETRIA VISIBLE (linea central de los cables, vertices
    // del resto), solo los puntos dentro de la escena. Se calcula al colocar,
    // no en cada cuadro.
    const pts = [];
    const push = (v) => { const p = v.project(cam); if (p.z > 1) return; const x = cr.left + ((p.x + 1) / 2) * cr.width, y = cr.top + ((1 - p.y) / 2) * cr.height; if (x >= cr.left && x <= cr.right && y >= cr.top && y <= cr.bottom) pts.push({ x, y }); };
    obj.traverse((n) => {
      if (!n.isMesh || (n.userData && n.userData.hwlabHitbox)) return;
      for (let q = n; q; q = q.parent) if (!q.visible) return;
      if (n.geometry.parameters && n.geometry.parameters.path) { for (let k = 0; k <= 24; k++) push(n.geometry.parameters.path.getPointAt(k / 24).applyMatrix4(n.matrixWorld)); return; }
      const pa = n.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pa.count / 24));
      for (let i = 0; i < pa.count; i += step) push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(n.matrixWorld));
    });
    clip.points = pts;
    return clip;
  }

  const rectOf = (el) => { if (!el || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null; };

  function placeCard() {
    const card = document.getElementById("hwlab-card");
    const scene = document.getElementById("hwlab-scene");
    if (!card || !scene || !scene.offsetParent) return;
    const mobile = window.matchMedia && window.matchMedia("(max-width: 600px)").matches;
    const summary = (document.getElementById("hwlab-card-summary") || {}).textContent || "";
    // Medir el tamano NATURAL (sin compactar ni posiciones forzadas).
    card.removeAttribute("data-auto-compact");
    card.style.top = card.style.left = card.style.right = card.style.bottom = card.style.maxHeight = card.style.width = "";
    const natural = card.getBoundingClientRect();
    const sceneR = rectOf(scene);
    const gap = mobile ? 8 : 12;
    const target = targetScreenRect();
    placeDock(target, sceneR, mobile);
    const dock = rectOf(document.getElementById("hwlab-dock"));
    const hist = rectOf(document.getElementById("hwlab-history-toggle"));
    const cands = cardCandidates({ scene: sceneR, card: { width: natural.width, height: natural.height }, dock: mobile ? null : dock, history: hist, gap, mobile });
    if (mobile && dock) {
      // En el movil el dock es la barra inferior: la banda "abajo" queda encima de ella.
      cands.forEach((c) => { if (c.slot === "bottom" && c.rect.bottom > dock.top - gap) c.rect = uiRect(c.rect.left, dock.top - gap - (c.rect.bottom - c.rect.top), c.rect.right - c.rect.left, c.rect.bottom - c.rect.top); });
    }
    let pick = target ? chooseSlot(cands, target, cardSlot) : cands.find((c) => c.slot === (mobile ? "top" : "tr")) || null;
    if (!pick) return;
    // Segunda defensa: si ninguna esquina deja la pieza libre, la tarjeta se
    // COMPACTA sola (queda "Paso X/Y · accion"; se puede expandir a mano).
    let compact = false;
    // Movil: el espacio del modelo manda. La tarjeta es una BANDA compacta por
    // defecto (resumen + boton de accion si el paso lo pide); el detalle
    // (instruccion, herramienta, precaucion) se abre a mano.
    // Tablet/escritorio: la decision depende del ESPACIO y de la oclusion, no
    // del tipo de equipo: tambien se compacta si la tarjeta ocuparia mas del
    // 40 % de la escena (le quitaria demasiada area util al modelo).
    const crowding = uiArea(pick.rect) / Math.max(1, uiArea(sceneR)) > 0.4;
    if ((mobile || crowding || (target && pick.cover > 0.1)) && userExpandedFor !== summary) {
      card.setAttribute("data-auto-compact", "true");
      const bar = card.getBoundingClientRect().height;
      const small = cands.map((c) => ({ slot: c.slot, rect: c.slot === "br" || c.slot === "bl" || c.slot === "bottom" ? uiRect(c.rect.left, c.rect.bottom - bar, c.rect.right - c.rect.left, bar) : uiRect(c.rect.left, c.rect.top, c.rect.right - c.rect.left, bar) }));
      pick = (target ? chooseSlot(small, target, cardSlot) : small.find((c) => c.slot === pick.slot)) || pick;
      compact = true;
    }
    // Registro de diagnostico SOLO si una prueba lo activa (inerte en uso normal).
    if (Array.isArray(window.__HWLAB_UI_DEBUG__)) window.__HWLAB_UI_DEBUG__.push({ part: belowFramePartId, target: target && { l: Math.round(target.left), t: Math.round(target.top), r: Math.round(target.right), b: Math.round(target.bottom), n: target.points && target.points.length }, cands: cands.map((c) => ({ slot: c.slot, cover: target ? +coverRatio(c.rect, target).toFixed(2) : null, r: [Math.round(c.rect.left), Math.round(c.rect.top), Math.round(c.rect.right), Math.round(c.rect.bottom)] })), pick: pick.slot, compact, prev: cardSlot, dock: dock && [Math.round(dock.left), Math.round(dock.top), Math.round(dock.right), Math.round(dock.bottom)] });
    cardSlot = pick.slot;
    card.setAttribute("data-slot", pick.slot);
    const pr = pick.rect;
    card.style.left = (pr.left - sceneR.left) + "px";
    card.style.top = (pr.top - sceneR.top) + "px";
    card.style.right = "auto";
    card.style.bottom = "auto";
    card.style.width = (pr.right - pr.left) + "px";
    if (!compact) card.style.maxHeight = (pr.bottom - pr.top) + "px";
    card.dataset.cover = target ? String(Math.round(coverRatio(card.getBoundingClientRect(), target) * 100)) : "";
    // Un aviso aun visible se decidio para la pieza ANTERIOR: se recoloca.
    const fb = document.getElementById("hwlab-feedback");
    if (fb && !fb.hidden) {
      const c = placeFeedback(fb);
      // Confirmacion simple que ahora cae sobre la pieza del NUEVO paso: se retira ya.
      if (feedbackKind === "success" && c > 0.1) {
        if (feedbackTimer) clearTimeout(feedbackTimer);
        feedbackTimer = setTimeout(() => { fb.hidden = true; feedbackShown = { rank: 0, at: 0 }; }, 600);
      }
    }
  }

  /** Dock COMPACTO de escritorio/tablet: si tapa la pieza, baja sobre el historial. */
  let dockPos = "";
  function placeDock(target, sceneR, mobile) {
    const dock = document.getElementById("hwlab-dock");
    if (!dock) return;
    const compact = getComputedStyle(dock).getPropertyValue("--hwlab-dock-compact").trim() === "1";
    if (!compact || mobile || !target) { dock.removeAttribute("data-pos"); dockPos = ""; return; }
    dock.removeAttribute("data-pos");
    const top = rectOf(dock);
    if (!top) return;
    const hist = rectOf(document.getElementById("hwlab-history-toggle"));
    const h = top.bottom - top.top, gap = 12;
    const bottomY = (hist ? hist.top : sceneR.bottom) - 6 - h;
    const spots = [{ pos: "", rect: top }, { pos: "bottom", rect: uiRect(top.left, bottomY, top.right - top.left, h) }];
    const pick = chooseDockSpot(spots, target, dockPos);
    dockPos = pick.pos;
    if (dockPos) dock.setAttribute("data-pos", dockPos);
  }

  /** El aviso se aparta de la pieza objetivo y de su etiqueta (abajo o arriba
   *  al centro, a un lado, o sobre el historial). Se decide al mostrarlo y al
   *  recolocar la interfaz, nunca en cada cuadro. */
  function placeFeedback(el) {
    el.removeAttribute("data-pos");
    const target = targetScreenRect();
    if (!target) return 0;
    const sceneR = rectOf(document.getElementById("hwlab-scene"));
    const r = el.getBoundingClientRect();
    const w = r.width, h = r.height, gap = 12;
    const midY = sceneR.top + (sceneR.bottom - sceneR.top - h) / 2;
    const spots = [
      { pos: "", rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } },
      { pos: "top", rect: uiRect(sceneR.left + (sceneR.right - sceneR.left - w) / 2, sceneR.top + gap, w, h) },
    ];
    // A los lados solo si el aviso es ESTRECHO frente a la escena: en el movil
    // ocupa casi todo el ancho y "a un lado" seria el centro, donde esta el
    // modelo (medido: tapaba la etiqueta y los tornillos).
    if (w <= (sceneR.right - sceneR.left) * 0.45) {
      spots.push(
        { pos: "left", rect: uiRect(sceneR.left + gap, midY, w, h) },
        { pos: "right", rect: uiRect(sceneR.right - gap - w, midY, w, h) },
        { pos: "side", rect: uiRect(sceneR.right - gap - w, r.top, w, h) }
      );
    }
    // Sobre la barra del historial (lo menos prioritario de la escena).
    spots.push({ pos: "hist", rect: uiRect(sceneR.left + gap, sceneR.bottom - gap - h, w, h) });
    const tip = document.getElementById("hwlab-tooltip");
    const pick = chooseFeedbackSpot(spots, target, [rectOf(document.getElementById("hwlab-card")), rectOf(document.getElementById("hwlab-dock"))], {
      protect: [tip && !tip.hidden ? rectOf(tip) : null],
      low: [rectOf(document.getElementById("hwlab-history-toggle"))],
    });
    if (pick && pick.pos) el.setAttribute("data-pos", pick.pos);
    return pick ? coverRatio(pick.rect, target) : 0;
  }

  function toggleExplode() {
    if (!currentRig) return false;
    const nowExploded = explodeCtl.toggle(currentRig.getExplodeEntries(), new THREE.Vector3(0, 0, 0));
    const btn = document.getElementById("hwlab-explode-btn");
    if (btn) { btn.classList.toggle("is-active", nowExploded); btn.setAttribute("aria-pressed", String(nowExploded)); }
    if (nowExploded) {
      // Mejora 3D (item 7): sin esto, si el usuario ya estaba enfocado de
      // cerca (clic en una pieza, o un preset de "Enfoque rapido") al activar
      // la vista explotada, las piezas que se alejan del centro pueden
      // terminar mas cerca de la camara que el propio near-plane -- la
      // camara queda "adentro" de la geometria, mostrando solo caras
      // internas muy de cerca (confirmado con clic real). Volver a "General"
      // garantiza que la vista explotada siempre arranque desde un encuadre
      // que ya contiene el equipo completo con margen.
      cameraRig.goToView("overview");
      document.querySelectorAll(".hwlab-view-btn").forEach((b) => b.classList.remove("is-active"));
      const overviewBtn = document.querySelector('.hwlab-view-btn[data-view="overview"]');
      if (overviewBtn) overviewBtn.classList.add("is-active");
    }
    return nowExploded;
  }

  // ── Feedback / historial ──────────────────────────────────────────────────
  // Avisos flotantes (interfaz v2): icono + texto + estilo por TIPO (no solo
  // color). Prioridad: bloqueo/error > informacion > exito. Un exito
  // operacional ("Tornillo instalado") no tapa en el MISMO instante un aviso
  // mas importante: se queda solo en el historial.
  const FEEDBACK_ICONS = {
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  };
  const FEEDBACK_RANK = { success: 1, info: 2, warning: 3, error: 4 };
  const FEEDBACK_MS = { success: 3800, info: 7000, warning: 8000, error: 8000 };
  // Un aviso de TRANSICION ("Preparando: pantalla") solo vive lo que dura el
  // movimiento: al terminar se retira (tras un minimo para poder leerlo).
  const TRANSIENT_MIN_MS = 1200;
  let feedbackShown = { rank: 0, at: 0 };
  let feedbackKind = "";
  let feedbackSeq = 0;
  let transientFeedback = null; // { id, at }
  function endTransientFeedback(id) {
    if (!transientFeedback || transientFeedback.id !== id) return;
    const el = document.getElementById("hwlab-feedback");
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const wait = Math.max(0, TRANSIENT_MIN_MS - (now - transientFeedback.at));
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      if (!transientFeedback || transientFeedback.id !== id) return;
      if (el) el.hidden = true;
      transientFeedback = null;
      feedbackShown = { rank: 0, at: 0 };
    }, wait);
  }
  function showFeedback(message, tone, opts = {}) {
    const el = document.getElementById("hwlab-feedback");
    if (!el) return;
    const kind = FEEDBACK_ICONS[tone] ? tone : "info";
    const rank = FEEDBACK_RANK[kind];
    const now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (!el.hidden && rank < feedbackShown.rank && now - feedbackShown.at < 250) return 0;
    feedbackShown = { rank, at: now };
    const id = ++feedbackSeq;
    transientFeedback = opts.transient ? { id, at: now } : null;
    el.innerHTML = FEEDBACK_ICONS[kind] + '<span class="hwlab-feedback__text"></span>';
    el.lastChild.textContent = message;
    el.className = "hwlab-feedback hwlab-feedback--" + kind;
    feedbackKind = kind;
    el.hidden = false;
    const cover = placeFeedback(el);
    if (feedbackTimer) clearTimeout(feedbackTimer);
    // Una confirmacion simple que no encuentra hueco libre y cae sobre la pieza
    // se retira antes (sigue en el historial): la pieza manda.
    const ms = kind === "success" && cover > 0.1 ? 1400 : FEEDBACK_MS[kind];
    feedbackTimer = setTimeout(() => {
      el.hidden = true;
      transientFeedback = null;
      feedbackShown = { rank: 0, at: 0 };
    }, ms);
    if (kind === "error") HardwareLabAudio.playError();
    else if (kind === "success") HardwareLabAudio.playSuccess();
    return id;
  }

  function pushActionLog(text, tone) {
    const list = document.getElementById("hwlab-action-log");
    if (!list) return;
    const li = document.createElement("li");
    const time = document.createElement("time");
    const d = new Date();
    time.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
    li.appendChild(time);
    li.appendChild(document.createTextNode(" " + text));
    if (tone) li.className = "is-" + tone;
    list.appendChild(li);
    list.scrollLeft = list.scrollWidth;
    list.scrollTop = list.scrollHeight;
    while (list.children.length > 60) list.removeChild(list.firstChild);
    updateHistoryCount();
  }

  function updateHistoryCount() {
    const list = document.getElementById("hwlab-action-log");
    const c = document.getElementById("hwlab-history-count");
    if (list && c) c.textContent = String(list.children.length);
  }

  function clearActionLog() {
    const list = document.getElementById("hwlab-action-log");
    if (list) list.innerHTML = "";
    updateHistoryCount();
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
    updateCardSummary();
    schedulePlaceCard(CAMERA_SETTLE_MS);
  }

  /** Resumen de la tarjeta (se ve aun contraida): "Paso X de Y · accion". */
  function updateCardSummary() {
    const panel = document.getElementById("hwlab-info-panel");
    const out = document.getElementById("hwlab-card-summary");
    if (!panel || !out) return;
    const h = panel.querySelector("h3");
    const first = panel.querySelector(".hwlab-info-block > p");
    const title = h ? h.textContent.trim() : "";
    let action = /^Paso \d/.test(title) && first ? first.textContent.trim() : "";
    if (action) action = action.charAt(0).toUpperCase() + action.slice(1);
    out.textContent = action ? title + " · " + action : title;
    // Marca para el CSS: el "Paso X de Y" y la accion ya estan en el resumen.
    if (action) panel.setAttribute("data-step", ""); else panel.removeAttribute("data-step");
    // Paso NUEVO que se completa con un boton de la propia tarjeta (confirmar
    // seguridad, preparar posicion, mantenimiento): se abre aunque el
    // aprendiz la hubiera contraido, para que nunca quede oculto.
    const summary = out.textContent;
    if (summary !== lastSummary && panel.querySelector("#hwlab-safety-confirm-btn, #hwlab-prepare-btn, .hwlab-thermal[data-required] [data-thermal-task]")) setCard(true);
    lastSummary = summary;
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
      ["Tipo", CATEGORY_LABELS[part.category] || part.category],
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
      "</div>" +
      (opts.extraHtml || "");
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
    get screws() {
      return currentScrews;
    },
    setScrewHooks,
    setBelowFraming,
    setFramingPolicy,
    /** Diagnostico del ultimo encuadre automatico (solo lectura, para pruebas). */
    get lastFraming() {
      return lastFraming;
    },
    /** El contenido de la tarjeta cambio de tamano (p. ej. se abrio una seccion): recolocar una vez. */
    refreshLayout: (byUser) => {
      // Abrir una seccion a mano cuenta como "expandir": no se re-compacta sola.
      if (byUser) userExpandedFor = (document.getElementById("hwlab-card-summary") || {}).textContent || "";
      schedulePlaceCard(120);
    },
    setPoseHooks,
    goToWorkPose,
    frameWorkView,
    refreshRigBounds,
    renderPoseStatus,
    isPoseBusy: poseBusy,
    get sceneApi() {
      return sceneApi;
    },
  };
}
