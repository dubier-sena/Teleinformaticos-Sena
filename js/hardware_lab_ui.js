/* js/hardware_lab_ui.js
 *
 * Controlador de interfaz del Laboratorio Virtual de Hardware. Traduce el
 * estado del motor (hardware_lab_engine.js) a DOM y traduce los clics del
 * aprendiz a llamadas del motor. No conoce reglas de negocio: toda decision
 * de "se puede o no" vive en el motor, esta capa solo pinta y escucha
 * eventos. Es agnostica del equipo: recibe equipmentData al crearse (PC de
 * escritorio o portatil), y de sus datos (zones, caseGatePartId, icon...)
 * saca todo lo que necesita para dibujarse.
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

  function fmtTime(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  function capitalize(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  var MODE_TITLES = {
    "disassembly-guided": "Desensamble guiado",
    "assembly-guided": "Ensamble guiado",
    "disassembly-open-libre": "Practica libre — desensamble",
    "assembly-open-libre": "Practica libre — ensamble",
    "disassembly-open-eval": "Evaluacion — desensamble",
    "assembly-open-eval": "Evaluacion — ensamble",
  };

  function createController(root_, equipmentData) {
    var HardwareLab = root_.HardwareLab;
    var Engine = HardwareLab.Engine;
    var Tools = HardwareLab.Tools;
    var Storage = HardwareLab.Storage;

    var container = null;
    var session = null;
    var selectedPartId = null;
    var selectedToolId = null;
    var timerHandle = null;

    function byId(id) {
      return container.querySelector("#" + id);
    }

    // ── Arranque / reinicio de sesion ────────────────────────────────────
    function start(mode) {
      var restored = Storage.loadLocal(equipmentData.id, mode);
      session =
        restored && typeof restored === "object" && !restored.finishedAt
          ? Engine.deserialize(equipmentData, restored)
          : Engine.createSession(equipmentData, mode);
      selectedPartId = null;
      selectedToolId = null;
      clearFeedback();
      renderAll();
      startTimer();
    }

    function restart() {
      session = Engine.createSession(equipmentData, session.mode);
      selectedPartId = null;
      selectedToolId = null;
      clearFeedback();
      Storage.saveLocal(equipmentData.id, session.mode, Engine.serialize(session));
      renderAll();
      startTimer();
    }

    function persistSession() {
      Storage.persist(equipmentData.id, session.mode, Engine.serialize(session));
    }

    // ── Timer ──────────────────────────────────────────────────────────────
    function startTimer() {
      stopTimer();
      timerHandle = setInterval(renderTimer, 1000);
      renderTimer();
    }
    function stopTimer() {
      if (timerHandle) clearInterval(timerHandle);
      timerHandle = null;
    }
    function renderTimer() {
      var el = byId("hwlab-timer");
      if (!el) return;
      var endedAt = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
      var elapsed = (endedAt - Date.parse(session.startedAt)) / 1000;
      el.textContent = fmtTime(elapsed);
    }

    // ── Render principal ──────────────────────────────────────────────────
    function renderAll() {
      renderTopbar();
      renderInstructions();
      renderStage();
      renderTools();
      renderTray();
      renderResult();
    }

    function isOpenMode() {
      return session.kind === "open";
    }

    function remainingPartsCount() {
      var goalPresent = session.direction === "assembly";
      return Object.keys(session.parts).filter(function (id) {
        return session.parts[id] !== goalPresent;
      }).length;
    }

    function renderTopbar() {
      var title = (MODE_TITLES[session.mode] || session.mode) + " — " + equipmentData.name;
      setText("hwlab-mode-title", title);
      if (isOpenMode()) {
        setText("hwlab-step", String(Object.keys(session.parts).length - remainingPartsCount()));
        setText("hwlab-total", String(Object.keys(session.parts).length));
      } else {
        setText("hwlab-step", String(Math.min(session.stepIndex + 1, session.sequence.length)));
        setText("hwlab-total", String(session.sequence.length));
      }
      setText("hwlab-errors", String(session.errors));
      renderHintButton();
      renderTimer();
    }

    function renderHintButton() {
      var wrap = byId("hwlab-hint-wrap");
      if (!wrap) return;
      if (!isOpenMode()) {
        wrap.innerHTML = "";
        return;
      }
      var remaining = session.hints.max - session.hints.used;
      wrap.innerHTML =
        '<button type="button" class="c-btn c-btn--sm c-btn--gold" data-hwlab-hint' +
        (remaining <= 0 ? " disabled" : "") +
        ">&#128161; Pista (" +
        remaining +
        "/" +
        session.hints.max +
        ")</button>";
    }

    function renderInstructions() {
      var step = Engine.currentStep(session);
      var titleEl = byId("hwlab-step-title");
      var listEl = byId("hwlab-step-list");
      var confirmWrap = byId("hwlab-safety-confirm");
      if (!titleEl || !listEl) return;

      if (!step && Engine.isFinished(session)) {
        titleEl.textContent = "¡Practica completa!";
        listEl.innerHTML = "";
        if (confirmWrap) confirmWrap.innerHTML = "";
        renderSelectedPartPanel();
        return;
      }

      if (!step && isOpenMode()) {
        // Fase libre: sin paso forzado. El aprendiz elige que pieza tocar.
        titleEl.textContent = "Elige que pieza trabajar";
        listEl.innerHTML =
          "<li>Selecciona cualquier pieza disponible en el escenario o en la bandeja.</li>" +
          "<li>Elige primero la herramienta correcta si la pieza la requiere.</li>" +
          "<li>Respeta las dependencias: el sistema te explicara que falta si algo no es posible todavia.</li>";
        if (confirmWrap) confirmWrap.innerHTML = "";
        renderSelectedPartPanel();
        return;
      }

      if (step.kind === "safety") {
        titleEl.textContent = "⚠️ " + step.title;
        listEl.innerHTML = step.instructions
          .map(function (line) {
            return "<li>" + esc(line) + "</li>";
          })
          .join("");
        if (confirmWrap) {
          confirmWrap.innerHTML =
            '<button type="button" class="c-btn c-btn--sm" data-hwlab-confirm-safety="' +
            esc(step.id) +
            '">Confirmar paso</button>';
        }
      } else {
        var part = equipmentData.parts[step.partId];
        var actionInfo = Engine.ACTION_LABELS[step.action];
        titleEl.textContent =
          "Paso " +
          (session.stepIndex + 1) +
          " de " +
          session.sequence.length +
          ": " +
          capitalize(actionInfo.verb) +
          " " +
          part.name;
        var instructions =
          step.action === "remove" || step.action === "disconnect"
            ? part.removeInstructions
            : part.installInstructions;
        listEl.innerHTML = (instructions || [])
          .map(function (line) {
            return "<li>" + esc(line) + "</li>";
          })
          .join("");
        if (confirmWrap) confirmWrap.innerHTML = "";
      }

      renderSelectedPartPanel();
    }

    function renderSelectedPartPanel() {
      var panel = byId("hwlab-selected-part");
      if (!panel) return;
      if (!selectedPartId) {
        panel.innerHTML = "";
        panel.hidden = true;
        return;
      }
      var part = equipmentData.parts[selectedPartId];
      if (!part) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      var present = session.parts[selectedPartId];
      var isCable = part.kind === "cable";
      var stateLabel = present
        ? isCable
          ? "Conectada"
          : "Instalada"
        : isCable
        ? "Desconectada"
        : "Retirada";
      var action = present ? (isCable ? "disconnect" : "remove") : isCable ? "connect" : "install";
      var actionInfo = Engine.ACTION_LABELS[action];
      var toolNote =
        part.tool && part.tool !== "hands"
          ? "<p class=\"hwlab-part-panel__tool\">Herramienta requerida: <strong>" +
            esc((Tools.getTool(part.tool) || {}).name || part.tool) +
            "</strong></p>"
          : "";

      panel.innerHTML =
        '<div class="hwlab-part-panel">' +
        '<div class="hwlab-part-panel__head">' +
        '<span class="hwlab-part-panel__icon">' +
        esc(part.icon || "") +
        "</span>" +
        "<div>" +
        '<h4 class="hwlab-part-panel__name">' +
        esc(part.name) +
        "</h4>" +
        '<span class="hwlab-part-panel__state">' +
        stateLabel +
        "</span>" +
        "</div>" +
        "</div>" +
        '<p class="hwlab-part-panel__info">' +
        esc(part.info.function) +
        "</p>" +
        toolNote +
        '<button type="button" class="c-btn c-btn--sm" data-hwlab-act="' +
        action +
        '" data-hwlab-act-part="' +
        esc(selectedPartId) +
        '">' +
        capitalize(actionInfo.verb) +
        " " +
        esc(part.name) +
        "</button>" +
        "</div>";
    }

    function renderStage() {
      var stage = byId("hwlab-case");
      if (!stage) return;
      var caseOpen = Engine.isCaseOpen(equipmentData, session);
      var gateId = equipmentData.caseGatePartId;
      var gatePart = gateId ? equipmentData.parts[gateId] : null;

      if (gatePart && !caseOpen) {
        stage.innerHTML =
          '<div class="hwlab-closed-case" data-hwlab-select-part="' +
          esc(gateId) +
          '">' +
          '<span class="hwlab-closed-case__icon">' +
          esc(gatePart.icon) +
          "</span>" +
          '<p class="hwlab-closed-case__label">' +
          esc(equipmentData.closedLabel || "Equipo cerrado") +
          "</p>" +
          '<p class="hwlab-closed-case__hint">Selecciona "' +
          esc(gatePart.name) +
          '" para retirarla y ver el interior.</p>' +
          "</div>";
        return;
      }

      var zones = equipmentData.zones || [];
      stage.innerHTML =
        '<div class="hwlab-case-open">' +
        zones
          .map(function (zone) {
            var parts = Object.keys(equipmentData.parts)
              .filter(function (id) {
                return equipmentData.parts[id].zone === zone.id;
              })
              .map(renderPartChip)
              .join("");
            return (
              '<section class="hwlab-zone hwlab-zone--' +
              zone.id +
              '"><h5 class="hwlab-zone__title">' +
              esc(zone.title) +
              '</h5><div class="hwlab-zone__parts">' +
              parts +
              "</div></section>"
            );
          })
          .join("") +
        (gatePart
          ? '<button type="button" class="hwlab-close-case" data-hwlab-select-part="' +
            esc(gateId) +
            '">' +
            esc(gatePart.icon) +
            " Cerrar " +
            esc(gatePart.name.toLowerCase()) +
            "</button>"
          : "") +
        "</div>";
    }

    function renderPartChip(partId) {
      var part = equipmentData.parts[partId];
      var present = session.parts[partId];
      if (!present) return ""; // las piezas ausentes se muestran en la bandeja, no en el interior
      var isSelected = selectedPartId === partId;
      var kindClass = part.kind === "cable" ? "hwlab-chip--cable" : "hwlab-chip--component";
      return (
        '<button type="button" class="hwlab-chip ' +
        kindClass +
        (isSelected ? " is-selected" : "") +
        '" data-hwlab-select-part="' +
        esc(partId) +
        '" title="' +
        esc(part.name) +
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

    function renderTools() {
      var wrap = byId("hwlab-tools");
      if (!wrap) return;
      wrap.innerHTML = Tools.listTools()
        .map(function (tool) {
          var isActive = selectedToolId === tool.id;
          return (
            '<button type="button" class="hwlab-tool' +
            (isActive ? " is-active" : "") +
            '" data-hwlab-select-tool="' +
            esc(tool.id) +
            '" title="' +
            esc(tool.description) +
            '">' +
            '<span class="hwlab-tool__icon">' +
            esc(tool.icon) +
            "</span>" +
            '<span class="hwlab-tool__name">' +
            esc(tool.name) +
            "</span>" +
            "</button>"
          );
        })
        .join("");
    }

    function renderTray() {
      var wrap = byId("hwlab-tray");
      if (!wrap) return;
      var removedIds = Object.keys(equipmentData.parts).filter(function (id) {
        return session.parts[id] === false;
      });
      if (!removedIds.length) {
        wrap.innerHTML = '<p class="hwlab-tray__empty">Aun no hay piezas retiradas.</p>';
        return;
      }
      wrap.innerHTML = removedIds
        .map(function (id) {
          return renderTrayChip(id);
        })
        .join("");
    }

    function renderTrayChip(partId) {
      var part = equipmentData.parts[partId];
      var isSelected = selectedPartId === partId;
      return (
        '<button type="button" class="hwlab-chip hwlab-chip--tray hwlab-chip--reveal' +
        (isSelected ? " is-selected" : "") +
        '" data-hwlab-select-part="' +
        esc(partId) +
        '" title="' +
        esc(part.name) +
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

    function renderResult() {
      var wrap = byId("hwlab-result");
      if (!wrap) return;
      if (!session.result) {
        wrap.hidden = true;
        wrap.innerHTML = "";
        return;
      }
      wrap.hidden = false;
      var r = session.result;
      var b = r.breakdown;
      wrap.innerHTML =
        '<div class="hwlab-result c-card c-card--elevated">' +
        "<h3>Resultado de la practica</h3>" +
        '<dl class="hwlab-result__grid">' +
        "<dt>Equipo</dt><dd>" +
        esc(equipmentData.name) +
        "</dd>" +
        "<dt>Actividad</dt><dd>" +
        esc(MODE_TITLES[r.mode] || r.mode) +
        "</dd>" +
        "<dt>Tiempo</dt><dd>" +
        fmtTime(r.durationSeconds) +
        "</dd>" +
        "<dt>Errores</dt><dd>" +
        r.errors +
        "</dd>" +
        "<dt>Pistas usadas</dt><dd>" +
        r.hintsUsed +
        "</dd>" +
        "<dt>Procedimiento</dt><dd>" +
        b.procedimiento.value +
        "/" +
        b.procedimiento.max +
        "</dd>" +
        "<dt>Herramientas</dt><dd>" +
        b.herramientas.value +
        "/" +
        b.herramientas.max +
        "</dd>" +
        "<dt>Seguridad</dt><dd>" +
        b.seguridad.value +
        "/" +
        b.seguridad.max +
        "</dd>" +
        "<dt>Orden</dt><dd>" +
        b.orden.value +
        "/" +
        b.orden.max +
        "</dd>" +
        "<dt>Puntuacion</dt><dd><strong>" +
        r.score +
        "/100</strong></dd>" +
        "<dt>Estado</dt><dd><span class=\"c-badge " +
        (r.status === "APROBADO" ? "" : "c-badge--danger") +
        '">' +
        esc(r.status) +
        "</span></dd>" +
        "</dl>" +
        '<button type="button" class="c-btn c-btn--secondary" data-hwlab-restart>Repetir practica</button>' +
        "</div>";
    }

    function setText(id, text) {
      var el = byId(id);
      if (el) el.textContent = text;
    }

    // ── Feedback (mensajes educativos, item 16) ─────────────────────────────
    function showFeedback(ok, message) {
      var el = byId("hwlab-feedback");
      if (!el) return;
      el.hidden = false;
      el.className = "hwlab-feedback " + (ok ? "hwlab-feedback--ok" : "hwlab-feedback--error");
      el.textContent = message;
    }

    function clearFeedback() {
      var el = byId("hwlab-feedback");
      if (!el) return;
      el.hidden = true;
      el.textContent = "";
      el.className = "hwlab-feedback";
    }

    // ── Acciones disparadas por la UI ───────────────────────────────────────
    function selectPart(partId) {
      selectedPartId = selectedPartId === partId ? null : partId;
      renderSelectedPartPanel();
      renderStage();
      renderTray();
    }

    function selectTool(toolId) {
      selectedToolId = selectedToolId === toolId ? null : toolId;
      renderTools();
    }

    function performAction(action, partId) {
      var outcome = Engine.attemptAction(equipmentData, session, {
        action: action,
        partId: partId,
        toolId: selectedToolId,
      });
      session = outcome.session;
      showFeedback(outcome.ok, outcome.message);
      if (outcome.ok) {
        selectedPartId = null;
      }
      if (outcome.finished) {
        session = Engine.finish(session);
      }
      persistSession();
      renderAll();
    }

    function confirmSafety(stepId) {
      var outcome = Engine.attemptSafetyStep(session, stepId);
      session = outcome.session;
      showFeedback(outcome.ok, outcome.message);
      if (outcome.finished) {
        session = Engine.finish(session);
      }
      persistSession();
      renderAll();
    }

    function requestHint() {
      var outcome = Engine.useHint(session);
      session = outcome.session;
      if (outcome.ok) {
        showFeedback(true, "Pista: " + hintTextForCurrentGap());
      } else {
        showFeedback(false, outcome.message);
      }
      persistSession();
      renderAll();
    }

    // Pista generica del MVP: senala la primera pieza que aun no llego a su
    // estado meta y, si tiene dependencias pendientes, cuales son. Suficiente
    // para practica libre/evaluacion sin revelar el paso exacto a ciegas.
    function hintTextForCurrentGap() {
      var goalPresent = session.direction === "assembly";
      var pendingId = Object.keys(session.parts).find(function (id) {
        return session.parts[id] !== goalPresent;
      });
      if (!pendingId) return "Ya casi terminas: revisa los pasos de verificacion finales.";
      var part = equipmentData.parts[pendingId];
      var reqCheck = Engine.checkRequirements(
        equipmentData,
        session,
        pendingId,
        goalPresent ? "install" : "remove"
      );
      if (!reqCheck.ok) {
        var names = reqCheck.missing
          .map(function (id) {
            return equipmentData.parts[id].name;
          })
          .join(", ");
        return "Antes de trabajar en " + part.name + ", resuelve: " + names + ".";
      }
      return "Puedes continuar con: " + part.name + ".";
    }

    // ── Delegacion de eventos (un solo listener por contenedor) ─────────────
    function bindEvents() {
      container.addEventListener("click", function (event) {
        var selectBtn = event.target.closest("[data-hwlab-select-part]");
        if (selectBtn) {
          selectPart(selectBtn.getAttribute("data-hwlab-select-part"));
          return;
        }
        var toolBtn = event.target.closest("[data-hwlab-select-tool]");
        if (toolBtn) {
          selectTool(toolBtn.getAttribute("data-hwlab-select-tool"));
          return;
        }
        var actBtn = event.target.closest("[data-hwlab-act]");
        if (actBtn) {
          performAction(actBtn.getAttribute("data-hwlab-act"), actBtn.getAttribute("data-hwlab-act-part"));
          return;
        }
        var safetyBtn = event.target.closest("[data-hwlab-confirm-safety]");
        if (safetyBtn) {
          confirmSafety(safetyBtn.getAttribute("data-hwlab-confirm-safety"));
          return;
        }
        if (event.target.closest("[data-hwlab-hint]")) {
          requestHint();
          return;
        }
        if (event.target.closest("[data-hwlab-restart]")) {
          restart();
          return;
        }
      });
    }

    return {
      mount: function (rootEl) {
        container = rootEl;
        bindEvents();
      },
      start: start,
      getSession: function () {
        return session;
      },
      stopTimer: stopTimer,
    };
  }

  var api = { createController: createController };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.UI = api;
})(typeof window !== "undefined" ? window : this);
