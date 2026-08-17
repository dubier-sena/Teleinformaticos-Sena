/* js/hardware_lab_bootstrap.js
 *
 * Arma el menu "equipo -> tipo de practica [-> direccion]" de
 * laboratorio-virtual-hardware.html y monta el controlador correspondiente
 * (ensamble/desensamble, aprender componentes o diagnostico) segun lo que
 * elija el aprendiz. Todo el motor es agnostico del equipo: el mismo codigo
 * sirve para escritorio y portatil.
 */
(function () {
  "use strict";

  var EQUIPMENT_OPTIONS = [
    {
      id: "desktop",
      icon: "\u{1F5A5}️",
      title: "PC de escritorio",
      desc: "Gabinete, fuente, tarjeta madre, procesador, RAM, SSD, GPU y cableado principal.",
      available: true,
    },
    {
      id: "laptop",
      icon: "\u{1F4BB}",
      title: "Computador portatil",
      desc: "Bateria, refrigeracion, teclado, touchpad, pantalla y componentes propios del portatil.",
      available: true,
    },
  ];

  // "diagnosis" solo esta implementado para escritorio por ahora (10 casos,
  // ver hardware_lab_diagnosis_cases.js). Item 39 del enunciado ya anticipa
  // que no hace falta cubrir todo de una vez.
  function practiceOptionsFor(equipmentId) {
    return [
      {
        mode: "learn",
        icon: "\u{1F4DA}",
        title: "Aprender componentes",
        desc: "Explora libremente cada pieza y su ficha tecnica completa.",
        available: true,
      },
      {
        mode: "disassembly-guided",
        icon: "\u{1F527}",
        title: "Desensamble guiado",
        desc: "Sigue instrucciones paso a paso: seguridad, herramienta correcta y orden de retiro.",
        available: true,
      },
      {
        mode: "assembly-guided",
        icon: "\u{1F6E0}️",
        title: "Ensamble guiado",
        desc: "Vuelve a armar el equipo desde el gabinete vacio, en el orden correcto.",
        available: true,
      },
      {
        mode: "free",
        icon: "\u{1F9EA}",
        title: "Practica libre",
        desc: "Practica sin instrucciones constantes; consulta pistas si las necesitas.",
        available: true,
        needsDirection: true,
      },
      {
        mode: "evaluation",
        icon: "\u{2705}",
        title: "Evaluacion",
        desc: "Sin pistas de que sigue: se califica sobre 100 puntos con rubrica.",
        available: true,
        needsDirection: true,
      },
      {
        mode: "diagnosis",
        icon: "\u{1FA7A}",
        title: "Diagnostico y reparacion",
        desc: equipmentId === "desktop" ? "10 casos de diagnostico de fallas reales, de facil a moderado." : "Proximamente para portatil.",
        available: equipmentId === "desktop",
      },
    ];
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var selectedEquipmentId = null;
  var selectedPracticeMode = null;
  var assemblyController = null;
  var learnController = null;
  var diagnosisController = null;

  function equipmentData(id) {
    if (id === "laptop") return window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;
    return window.HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;
  }

  function renderOptionCard(kind, opt) {
    var disabledAttr = opt.available ? "" : " disabled";
    var suffix = opt.available ? "" : " (proximamente)";
    var dataAttr =
      kind === "equipment" ? "data-hwlab-equipment" : kind === "practice" ? "data-hwlab-practice" : "data-hwlab-direction";
    var value = kind === "equipment" ? opt.id : kind === "practice" ? opt.mode : opt.direction;
    return (
      '<button type="button" class="hwlab-option" ' +
      dataAttr +
      '="' +
      esc(value) +
      '"' +
      disabledAttr +
      ">" +
      '<span class="hwlab-option__icon">' +
      opt.icon +
      "</span>" +
      '<span class="hwlab-option__title">' +
      esc(opt.title) +
      esc(suffix) +
      "</span>" +
      '<span class="hwlab-option__desc">' +
      esc(opt.desc) +
      "</span>" +
      "</button>"
    );
  }

  function renderEquipmentGrid() {
    var grid = document.getElementById("hwlab-equipment-grid");
    if (!grid) return;
    grid.innerHTML = EQUIPMENT_OPTIONS.map(function (opt) {
      return renderOptionCard("equipment", opt);
    }).join("");
  }

  function renderPracticeGrid() {
    var grid = document.getElementById("hwlab-practice-grid");
    var group = document.getElementById("hwlab-practice-group");
    var directionGroup = document.getElementById("hwlab-direction-group");
    if (!grid || !group) return;
    grid.innerHTML = practiceOptionsFor(selectedEquipmentId)
      .map(function (opt) {
        return renderOptionCard("practice", opt);
      })
      .join("");
    group.hidden = false;
    if (directionGroup) directionGroup.hidden = true;
  }

  function renderDirectionGrid() {
    var grid = document.getElementById("hwlab-direction-grid");
    var group = document.getElementById("hwlab-direction-group");
    if (!grid || !group) return;
    var options = [
      { direction: "disassembly", icon: "\u{1F527}", title: "Desensamblar", desc: "Parte de un equipo completamente armado." },
      { direction: "assembly", icon: "\u{1F6E0}️", title: "Ensamblar", desc: "Parte de un equipo/gabinete vacio." },
    ];
    grid.innerHTML = options.map(function (opt) { return renderOptionCard("direction", opt); }).join("");
    group.hidden = false;
  }

  function selectEquipment(id) {
    selectedEquipmentId = id;
    selectedPracticeMode = null;
    renderPracticeGrid();
  }

  function selectPractice(mode) {
    selectedPracticeMode = mode;
    var options = practiceOptionsFor(selectedEquipmentId);
    var opt = options.find(function (o) { return o.mode === mode; });
    if (!opt || !opt.available) return;

    if (opt.needsDirection) {
      renderDirectionGrid();
      return;
    }
    if (mode === "learn") {
      startLearn();
      return;
    }
    if (mode === "diagnosis") {
      startDiagnosisMenu();
      return;
    }
    startAssembly(mode); // disassembly-guided | assembly-guided
  }

  function selectDirection(direction) {
    var suffix = selectedPracticeMode === "free" ? "-open-libre" : "-open-eval";
    startAssembly(direction + suffix);
  }

  function hideMenu() {
    var menu = document.getElementById("hwlab-menu");
    if (menu) menu.hidden = true;
  }
  function showMenu() {
    var menu = document.getElementById("hwlab-menu");
    if (menu) menu.hidden = false;
    var directionGroup = document.getElementById("hwlab-direction-group");
    if (directionGroup) directionGroup.hidden = true;
  }

  function startAssembly(engineMode) {
    var runtime = document.getElementById("hwlab-runtime");
    if (!runtime || !window.HardwareLab || !window.HardwareLab.UI) return;
    hideMenu();
    runtime.hidden = false;
    assemblyController = window.HardwareLab.UI.createController(window, equipmentData(selectedEquipmentId));
    assemblyController.mount(runtime);
    assemblyController.start(engineMode);
  }

  function startLearn() {
    var view = document.getElementById("hwlab-learn");
    if (!view || !window.HardwareLab || !window.HardwareLab.LearnUI) return;
    hideMenu();
    view.hidden = false;
    learnController = window.HardwareLab.LearnUI.createLearnController(window, equipmentData(selectedEquipmentId));
    learnController.mount(view);
    learnController.start();
  }

  function startDiagnosisMenu() {
    var menu = document.getElementById("hwlab-diag-menu");
    if (!menu || !window.HardwareLab || !window.HardwareLab.DiagnosisUI) return;
    hideMenu();
    menu.hidden = false;
    if (!diagnosisController) {
      diagnosisController = window.HardwareLab.DiagnosisUI.createDiagnosisController(window, equipmentData("desktop"));
      // Se monta sobre el contenedor PADRE comun de #hwlab-diag-menu y
      // #hwlab-diag-runtime (no solo el runtime): los botones de seleccion
      // de caso viven en el menu, y la delegacion de eventos del
      // controlador necesita verlos tambien.
      diagnosisController.mount(document.getElementById("hwlab-shell"));
    }
    diagnosisController.startMenu();
  }

  function backToMenu() {
    if (assemblyController && typeof assemblyController.stopTimer === "function") assemblyController.stopTimer();
    ["hwlab-runtime", "hwlab-learn"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    showMenu();
  }

  function diagBackToMenu() {
    ["hwlab-diag-menu", "hwlab-diag-runtime"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    showMenu();
  }

  document.addEventListener("DOMContentLoaded", function () {
    renderEquipmentGrid();

    var equipmentGrid = document.getElementById("hwlab-equipment-grid");
    if (equipmentGrid) {
      equipmentGrid.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-hwlab-equipment]");
        if (!btn || btn.disabled) return;
        selectEquipment(btn.getAttribute("data-hwlab-equipment"));
      });
    }

    var practiceGroup = document.getElementById("hwlab-practice-group");
    if (practiceGroup) {
      practiceGroup.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-hwlab-practice]");
        if (!btn || btn.disabled) return;
        selectPractice(btn.getAttribute("data-hwlab-practice"));
      });
    }

    var directionGroup = document.getElementById("hwlab-direction-group");
    if (directionGroup) {
      directionGroup.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-hwlab-direction]");
        if (!btn || btn.disabled) return;
        selectDirection(btn.getAttribute("data-hwlab-direction"));
      });
    }

    var backBtn = document.getElementById("hwlab-back-to-menu");
    if (backBtn) backBtn.addEventListener("click", backToMenu);
    var learnBackBtn = document.getElementById("hwlab-learn-back");
    if (learnBackBtn) learnBackBtn.addEventListener("click", backToMenu);
    var diagMenuBackBtn = document.getElementById("hwlab-diag-menu-back");
    if (diagMenuBackBtn) diagMenuBackBtn.addEventListener("click", diagBackToMenu);
    var diagBackBtn = document.getElementById("hwlab-diag-back-to-cases");
    if (diagBackBtn) {
      diagBackBtn.addEventListener("click", function () {
        if (diagnosisController) diagnosisController.startMenu();
      });
    }
  });
})();
