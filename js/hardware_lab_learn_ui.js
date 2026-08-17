/* js/hardware_lab_learn_ui.js
 *
 * Modo "Aprender componentes" (item 11): exploracion libre, sin sesion del
 * motor (no hay pasos ni puntuacion). Muestra todas las piezas del equipo;
 * al seleccionar una se despliega su ficha completa: funcion,
 * caracteristicas, ubicacion, tipo de conexion, precauciones,
 * compatibilidad, errores frecuentes y procedimientos de instalacion/retiro.
 */
(function (root) {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createLearnController(root_, equipmentData) {
    var container = null;
    var selectedPartId = null;

    function byId(id) {
      return container.querySelector("#" + id);
    }

    function start() {
      selectedPartId = null;
      renderGrid();
      renderDetail();
    }

    function renderGrid() {
      var grid = byId("hwlab-learn-grid");
      if (!grid) return;
      var zones = equipmentData.zones || [];
      var partsByZone = zones.map(function (zone) {
        var ids = Object.keys(equipmentData.parts).filter(function (id) {
          return equipmentData.parts[id].zone === zone.id;
        });
        return { zone: zone, ids: ids };
      });
      // Piezas sin zona (por ejemplo la que gobierna el gabinete) al final.
      var zoned = {};
      partsByZone.forEach(function (g) {
        g.ids.forEach(function (id) {
          zoned[id] = true;
        });
      });
      var unzoned = Object.keys(equipmentData.parts).filter(function (id) {
        return !zoned[id];
      });
      if (unzoned.length) {
        partsByZone.push({ zone: { id: "otras", title: "Otras piezas" }, ids: unzoned });
      }

      grid.innerHTML = partsByZone
        .map(function (g) {
          if (!g.ids.length) return "";
          return (
            '<section class="hwlab-zone"><h5 class="hwlab-zone__title">' +
            esc(g.zone.title) +
            '</h5><div class="hwlab-zone__parts">' +
            g.ids.map(renderPartChip).join("") +
            "</div></section>"
          );
        })
        .join("");
    }

    function renderPartChip(partId) {
      var part = equipmentData.parts[partId];
      var isSelected = selectedPartId === partId;
      var kindClass = part.kind === "cable" ? "hwlab-chip--cable" : "hwlab-chip--component";
      return (
        '<button type="button" class="hwlab-chip ' +
        kindClass +
        (isSelected ? " is-selected" : "") +
        '" data-hwlab-learn-select="' +
        esc(partId) +
        '">' +
        '<span class="hwlab-chip__icon">' +
        esc(part.icon || "") +
        "</span>" +
        '<span class="hwlab-chip__name">' +
        esc(part.name) +
        "</span>" +
        "</button>"
      );
    }

    function fieldRow(label, value) {
      if (!value) return "";
      return "<dt>" + esc(label) + "</dt><dd>" + esc(value) + "</dd>";
    }

    function stepsList(label, steps) {
      if (!steps || !steps.length) return "";
      return (
        "<h5>" +
        esc(label) +
        "</h5><ol>" +
        steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") +
        "</ol>"
      );
    }

    function renderDetail() {
      var wrap = byId("hwlab-learn-detail");
      if (!wrap) return;
      if (!selectedPartId) {
        wrap.innerHTML = '<p class="hwlab-tray__empty">Selecciona una pieza para ver su ficha tecnica completa.</p>';
        return;
      }
      var part = equipmentData.parts[selectedPartId];
      if (!part) {
        wrap.innerHTML = "";
        return;
      }
      var info = part.info || {};
      wrap.innerHTML =
        '<div class="hwlab-learn-card">' +
        '<div class="hwlab-part-panel__head">' +
        '<span class="hwlab-part-panel__icon">' +
        esc(part.icon || "") +
        "</span>" +
        "<h4 class=\"hwlab-part-panel__name\">" +
        esc(part.name) +
        "</h4>" +
        "</div>" +
        '<dl class="hwlab-learn-card__fields">' +
        fieldRow("Que es / para que sirve", info.function) +
        fieldRow("Caracteristicas", info.characteristics) +
        fieldRow("Ubicacion", info.location) +
        fieldRow("Tipo de conexion", info.connectionType) +
        fieldRow("Precauciones", info.precautions) +
        fieldRow("Compatibilidad", info.compatibility) +
        fieldRow("Errores frecuentes", info.commonErrors) +
        "</dl>" +
        stepsList("Procedimiento de retiro", part.removeInstructions) +
        stepsList("Procedimiento de instalacion", part.installInstructions) +
        "</div>";
    }

    function selectPart(partId) {
      selectedPartId = selectedPartId === partId ? null : partId;
      renderGrid();
      renderDetail();
    }

    function bindEvents() {
      container.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-hwlab-learn-select]");
        if (btn) selectPart(btn.getAttribute("data-hwlab-learn-select"));
      });
    }

    return {
      mount: function (rootEl) {
        container = rootEl;
        bindEvents();
      },
      start: start,
    };
  }

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.LearnUI = { createLearnController: createLearnController };
})(typeof window !== "undefined" ? window : this);
