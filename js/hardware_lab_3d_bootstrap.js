/* js/hardware_lab_3d_bootstrap.js
 *
 * Punto de entrada del Laboratorio 3D: arma el menu "equipo -> tipo de
 * practica [-> direccion / caso]" (item 32) y despacha al controlador que
 * corresponda. Unico <script type="module"> de la pagina: todo lo demas se
 * resuelve via import (ver laboratorio-virtual-hardware.html).
 */
import { createStage } from "./hardware_lab_3d_stage.js";
import { createAssemblyController } from "./hardware_lab_3d_controller.js";
import { createDiagnosisController } from "./hardware_lab_3d_diagnosis_controller.js";

const ICONS = {
  desktop: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="11" rx="1"/><path d="M9 20h6M12 15v5"/></svg>',
  laptop: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="10" rx="1"/><path d="M2 19h20l-2-3H4l-2 3z"/></svg>',
  learn: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20"/></svg>',
  wrenchDown: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/><path d="M12 15l4 4"/></svg>',
  wrenchUp: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2-2 2.5-2.5z"/><path d="M18 3l3 3-3 3"/></svg>',
  free: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6M10 3v5l-5 9a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-9V3"/></svg>',
  evaluation: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
  diagnosis: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3v6a4 4 0 008 0V3M10 21a4 4 0 004-4v-3"/><circle cx="18" cy="16" r="2.3"/></svg>',
  disassemble: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v6M12 20v-2M7 9L4 6M17 9l3-3M7 15H4M20 15h-3"/><circle cx="12" cy="12" r="3"/></svg>',
  assemble: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 4v3M12 17v3M5 12h3M16 12h3"/></svg>',
};

const EQUIPMENT_OPTIONS = [
  { id: "desktop", icon: ICONS.desktop, title: "PC de escritorio", desc: "Gabinete, fuente, tarjeta madre, procesador, RAM, SSD, GPU y cableado principal.", available: true },
  { id: "laptop", icon: ICONS.laptop, title: "Computador portatil", desc: "Bateria, refrigeracion, teclado, touchpad, pantalla y componentes propios del portatil.", available: true },
];

function practiceOptionsFor(equipmentId) {
  return [
    { mode: "learn", icon: ICONS.learn, title: "Aprender componentes", desc: "Explora libremente cada pieza en 3D y su ficha tecnica completa.", available: true },
    { mode: "disassembly-guided", icon: ICONS.wrenchDown, title: "Desensamble guiado", desc: "Sigue instrucciones paso a paso: seguridad, herramienta correcta y orden de retiro.", available: true },
    { mode: "assembly-guided", icon: ICONS.wrenchUp, title: "Ensamble guiado", desc: "Vuelve a armar el equipo desde el gabinete vacio, en el orden correcto.", available: true },
    { mode: "free", icon: ICONS.free, title: "Practica libre", desc: "Practica sin instrucciones constantes; consulta pistas si las necesitas.", available: true, needsDirection: true },
    { mode: "evaluation", icon: ICONS.evaluation, title: "Evaluacion", desc: "Sin pistas de que sigue: se califica sobre 100 puntos con rubrica.", available: true, needsDirection: true },
    {
      mode: "diagnosis",
      icon: ICONS.diagnosis,
      title: "Diagnostico y reparacion",
      desc: equipmentId === "desktop" ? "10 casos de diagnostico de fallas reales, de facil a moderado." : "Proximamente para portatil.",
      available: equipmentId === "desktop",
    },
  ];
}

const DIRECTION_OPTIONS = [
  { direction: "disassembly", icon: ICONS.disassemble, title: "Desensamblar", desc: "Parte de un equipo completamente armado." },
  { direction: "assembly", icon: ICONS.assemble, title: "Ensamblar", desc: "Parte de un equipo/gabinete vacio." },
];

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(kind, opt) {
  const disabledAttr = opt.available ? "" : " disabled";
  const suffix = opt.available ? "" : " (proximamente)";
  const dataAttr = kind === "equipment" ? "data-equipment" : kind === "practice" ? "data-practice" : "data-direction";
  const value = kind === "equipment" ? opt.id : kind === "practice" ? opt.mode : opt.direction;
  return (
    `<button type="button" class="hwlab-option" ${dataAttr}="${esc(value)}"${disabledAttr}>` +
    `<span class="hwlab-option__icon">${opt.icon}</span>` +
    `<span class="hwlab-option__title">${esc(opt.title)}${esc(suffix)}</span>` +
    `<span class="hwlab-option__desc">${esc(opt.desc)}</span>` +
    "</button>"
  );
}

document.addEventListener("DOMContentLoaded", () => {
  const stage = createStage();
  const assemblyController = createAssemblyController(stage);
  const diagnosisController = createDiagnosisController(stage);

  let selectedEquipmentId = null;
  let selectedPracticeMode = null;

  function renderEquipmentGrid() {
    const grid = document.getElementById("hwlab-equipment-grid");
    if (grid) grid.innerHTML = EQUIPMENT_OPTIONS.map((o) => renderCard("equipment", o)).join("");
  }

  function renderPracticeGrid() {
    const grid = document.getElementById("hwlab-practice-grid");
    const group = document.getElementById("hwlab-practice-group");
    if (!grid || !group) return;
    grid.innerHTML = practiceOptionsFor(selectedEquipmentId).map((o) => renderCard("practice", o)).join("");
    group.hidden = false;
    document.getElementById("hwlab-direction-group").hidden = true;
    document.getElementById("hwlab-diag-case-group").hidden = true;
  }

  function renderDirectionGrid() {
    const grid = document.getElementById("hwlab-direction-grid");
    const group = document.getElementById("hwlab-direction-group");
    if (!grid || !group) return;
    grid.innerHTML = DIRECTION_OPTIONS.map((o) => renderCard("direction", o)).join("");
    group.hidden = false;
    document.getElementById("hwlab-diag-case-group").hidden = true;
  }

  function selectEquipment(id) {
    selectedEquipmentId = id;
    selectedPracticeMode = null;
    document.querySelectorAll("[data-equipment]").forEach((b) => b.classList.toggle("is-selected", b.getAttribute("data-equipment") === id));
    renderPracticeGrid();
  }

  function selectPractice(mode) {
    selectedPracticeMode = mode;
    const opt = practiceOptionsFor(selectedEquipmentId).find((o) => o.mode === mode);
    if (!opt || !opt.available) return;
    document.querySelectorAll("[data-practice]").forEach((b) => b.classList.toggle("is-selected", b.getAttribute("data-practice") === mode));

    if (opt.needsDirection) {
      renderDirectionGrid();
      return;
    }
    document.getElementById("hwlab-direction-group").hidden = true;
    if (mode === "diagnosis") {
      diagnosisController.showCaseMenu();
      return;
    }
    document.getElementById("hwlab-diag-case-group").hidden = true;
    assemblyController.start(selectedEquipmentId, mode);
  }

  function selectDirection(direction) {
    assemblyController.start(selectedEquipmentId, selectedPracticeMode, direction);
  }

  const equipmentGrid = document.getElementById("hwlab-equipment-grid");
  if (equipmentGrid) {
    equipmentGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-equipment]");
      if (!btn || btn.disabled) return;
      selectEquipment(btn.getAttribute("data-equipment"));
    });
  }
  const practiceGroup = document.getElementById("hwlab-practice-group");
  if (practiceGroup) {
    practiceGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-practice]");
      if (!btn || btn.disabled) return;
      selectPractice(btn.getAttribute("data-practice"));
    });
  }
  const directionGroup = document.getElementById("hwlab-direction-group");
  if (directionGroup) {
    directionGroup.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-direction]");
      if (!btn || btn.disabled) return;
      selectDirection(btn.getAttribute("data-direction"));
    });
  }
  renderEquipmentGrid();
});
