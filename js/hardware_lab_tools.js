/* js/hardware_lab_tools.js
 *
 * Catalogo de herramientas del Laboratorio Virtual de Hardware.
 * Compartido entre equipos (escritorio, portatil futuro): una herramienta
 * se define una sola vez y cada pieza del equipo declara cual necesita
 * (ver hardware_lab_data_desktop.js, campo "tool" de cada parte).
 */
(function (root) {
  "use strict";

  var TOOLS = {
    phillips: {
      id: "phillips",
      name: "Destornillador Phillips",
      icon: "\u{1FA9B}",
      description: "Para tornillos de cabeza en cruz: gabinete, fuente, tarjetas, unidades.",
    },
    flathead: {
      id: "flathead",
      name: "Destornillador plano",
      icon: "\u{1FA9B}",
      description: "Para tornillos de ranura simple y para hacer palanca con cuidado.",
    },
    spudger: {
      id: "spudger",
      name: "Herramienta plastica de apertura",
      icon: "\u{1FAB4}",
      description: "Palanca plastica para abrir carcasas sin rayar ni hacer corto con metal.",
    },
    tweezers: {
      id: "tweezers",
      name: "Pinzas",
      icon: "\u{1F4CE}",
      description: "Para tornillos pequenos o conectores dificiles de alcanzar con los dedos.",
    },
    "antistatic-strap": {
      id: "antistatic-strap",
      name: "Pulsera antiestatica",
      icon: "\u{1F9E4}",
      description: "Te conecta a tierra para no danar componentes con electricidad estatica.",
    },
    "antistatic-brush": {
      id: "antistatic-brush",
      name: "Brocha antiestatica",
      icon: "\u{1F58C}️",
      description: "Limpia polvo de disipadores y ventiladores sin generar estatica.",
    },
    hands: {
      id: "hands",
      name: "Manos (sin herramienta)",
      icon: "\u{1F590}️",
      description: "Algunas piezas se manipulan solo con las manos, sujetando por los bordes.",
    },
  };

  function getTool(toolId) {
    return TOOLS[toolId] || null;
  }

  function listTools() {
    return Object.keys(TOOLS).map(function (id) {
      return TOOLS[id];
    });
  }

  var api = { TOOLS: TOOLS, getTool: getTool, listTools: listTools };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Tools = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
