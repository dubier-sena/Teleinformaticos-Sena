/* js/hardware_lab_diagnosis_ui.js
 *
 * Interfaz del modulo "Diagnostico y reparacion": selector de los 10 casos
 * (con progresion/bloqueo, item 35) + la practica de un caso (item 18-34).
 * Reutiliza hardware_lab_diagnosis_engine.js para toda la logica y
 * hardware_lab_storage.js para guardar el progreso (cada caso es una
 * "practica" mas: equipmentId="desktop", mode="diagnosis-{idCaso}").
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

  var LEVEL_GROUPS = [
    { title: "Nivel basico", from: 1, to: 3 },
    { title: "Nivel intermedio", from: 4, to: 7 },
    { title: "Nivel moderado", from: 8, to: 10 },
  ];

  function diagnosisMode(caseDef) {
    return "diagnosis-" + caseDef.id.replace(/-/g, "_");
  }

  function createDiagnosisController(root_, equipmentData) {
    var HardwareLab = root_.HardwareLab;
    var DiagEngine = HardwareLab.DiagnosisEngine;
    var CASES = HardwareLab.DiagnosisCases.CASES;
    var Tools = HardwareLab.Tools;
    var Storage = HardwareLab.Storage;

    var container = null;
    var session = null;
    var activeCaseDef = null;
    var selectedPartId = null;
    var selectedToolId = null;
    var timerHandle = null;
    var onExit = null;

    function byId(id) {
      return container.querySelector("#" + id);
    }

    // ── Progreso guardado por caso (para bloqueo/desbloqueo, item 35) ───────
    function caseResult(caseDef) {
      var raw = Storage.loadLocal(equipmentData.id, diagnosisMode(caseDef));
      return raw && raw.result ? raw.result : null;
    }

    function isCasePassed(caseDef) {
      var r = caseResult(caseDef);
      return !!(r && r.status === "APROBADO");
    }

    function isCaseUnlocked(caseDef) {
      if (caseDef.number <= 1) return true;
      var previous = CASES.find(function (c) {
        return c.number === caseDef.number - 1;
      });
      return !previous || isCasePassed(previous);
    }

    // ── Selector de casos ────────────────────────────────────────────────────
    function renderCaseGrid() {
      var grid = byId("hwlab-diag-grid");
      if (!grid) return;
      grid.innerHTML = LEVEL_GROUPS.map(function (group) {
        var cards = CASES.filter(function (c) {
          return c.number >= group.from && c.number <= group.to;
        })
          .map(renderCaseCard)
          .join("");
        return (
          '<div class="hwlab-menu__group"><h3>' +
          esc(group.title) +
          '</h3><div class="hwlab-menu__grid">' +
          cards +
          "</div></div>"
        );
      }).join("");
    }

    function renderCaseCard(caseDef) {
      var unlocked = isCaseUnlocked(caseDef);
      var passed = isCasePassed(caseDef);
      var statusIcon = passed ? "✅" : unlocked ? "▶️" : "\u{1F512}";
      var disabledAttr = unlocked ? "" : " disabled";
      return (
        '<button type="button" class="hwlab-option" data-hwlab-diag-case="' +
        esc(caseDef.id) +
        '"' +
        disabledAttr +
        ">" +
        '<span class="hwlab-option__icon">' +
        statusIcon +
        "</span>" +
        '<span class="hwlab-option__title">Caso ' +
        caseDef.number +
        " — " +
        esc(caseDef.name) +
        "</span>" +
        '<span class="hwlab-option__desc">' +
        (unlocked ? esc(caseDef.symptom) : "Aprueba el caso anterior para desbloquear.") +
        "</span>" +
        "</button>"
      );
    }

    // ── Arranque / reinicio de un caso ──────────────────────────────────────
    function startCase(caseId) {
      activeCaseDef = CASES.find(function (c) {
        return c.id === caseId;
      });
      if (!activeCaseDef || !isCaseUnlocked(activeCaseDef)) return;

      var restored = Storage.loadLocal(equipmentData.id, diagnosisMode(activeCaseDef));
      session =
        restored && typeof restored === "object" && !restored.finishedAt
          ? DiagEngine.deserialize(restored)
          : DiagEngine.createDiagnosisSession(equipmentData, activeCaseDef);
      selectedPartId = null;
      selectedToolId = null;
      clearFeedback();
      renderAll();
      startTimer();
      showView("hwlab-diag-runtime");
    }

    function restartCase() {
      session = DiagEngine.createDiagnosisSession(equipmentData, activeCaseDef);
      selectedPartId = null;
      selectedToolId = null;
      clearFeedback();
      persistSession();
      renderAll();
      startTimer();
    }

    function persistSession() {
      Storage.persist(equipmentData.id, diagnosisMode(activeCaseDef), DiagEngine.serialize(session));
    }

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
      var el = byId("hwlab-diag-timer");
      if (!el || !session) return;
      var endedAt = session.finishedAt ? Date.parse(session.finishedAt) : Date.now();
      el.textContent = fmtTime((endedAt - Date.parse(session.startedAt)) / 1000);
    }

    // ── Render principal ──────────────────────────────────────────────────
    function renderAll() {
      renderTopbar();
      renderCasePanel();
      renderStage();
      renderTools();
      renderTray();
      renderResult();
    }

    function renderTopbar() {
      var title = "Caso " + activeCaseDef.number + " — " + activeCaseDef.name;
      setText("hwlab-diag-title", title);
      setText("hwlab-diag-errors", String(session.errors));
      var remaining = session.hints.max - session.hints.used;
      var hintWrap = byId("hwlab-diag-hint-wrap");
      if (hintWrap) {
        hintWrap.innerHTML =
          '<button type="button" class="c-btn c-btn--sm c-btn--gold" data-hwlab-diag-hint' +
          (remaining <= 0 ? " disabled" : "") +
          ">&#128161; Pista (" +
          remaining +
          "/" +
          session.hints.max +
          ")</button>";
      }
      renderTimer();
    }

    function renderCasePanel() {
      var symptomEl = byId("hwlab-diag-symptom");
      if (symptomEl) {
        symptomEl.textContent = session.finishedAt ? session.symptomFixed : session.symptomBroken;
      }
      var powerOnWrap = byId("hwlab-diag-power-on-wrap");
      if (powerOnWrap) {
        powerOnWrap.innerHTML = session.finishedAt
          ? ""
          : '<button type="button" class="c-btn" data-hwlab-diag-power-on>&#9889; Encender y comprobar</button>';
      }
      renderSelectedPartPanel();
    }

    function renderSelectedPartPanel() {
      var panel = byId("hwlab-diag-selected-part");
      if (!panel) return;
      if (!selectedPartId) {
        panel.innerHTML = "";
        panel.hidden = true;
        return;
      }
      var part = DiagEngine.getPart(equipmentData, selectedPartId);
      if (!part) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      var present = session.parts[selectedPartId];
      var isCable = part.kind === "cable";
      var stateLabel = present ? (isCable ? "Conectada" : "Instalada") : isCable ? "Desconectada" : "Retirada";
      var action = present ? (isCable ? "disconnect" : "remove") : isCable ? "connect" : "install";
      var actionLabel = { remove: "Retirar", install: "Instalar", disconnect: "Desconectar", connect: "Conectar" }[action];
      var toolNote =
        part.tool && part.tool !== "hands"
          ? '<p class="hwlab-part-panel__tool">Herramienta requerida: <strong>' +
            esc((Tools.getTool(part.tool) || {}).name || part.tool) +
            "</strong></p>"
          : "";
      panel.innerHTML =
        '<div class="hwlab-part-panel">' +
        '<div class="hwlab-part-panel__head"><span class="hwlab-part-panel__icon">' +
        esc(part.icon || "") +
        '</span><div><h4 class="hwlab-part-panel__name">' +
        esc(part.name) +
        '</h4><span class="hwlab-part-panel__state">' +
        stateLabel +
        "</span></div></div>" +
        toolNote +
        '<button type="button" class="c-btn c-btn--sm" data-hwlab-diag-act="' +
        action +
        '" data-hwlab-diag-act-part="' +
        esc(selectedPartId) +
        '">' +
        esc(actionLabel) +
        " " +
        esc(part.name) +
        "</button>" +
        "</div>";
    }

    function renderStage() {
      var stage = byId("hwlab-diag-case");
      if (!stage) return;
      var caseOpen = DiagEngine.isCaseOpen(equipmentData, session);
      var gateId = equipmentData.caseGatePartId;
      var gatePart = gateId ? DiagEngine.getPart(equipmentData, gateId) : null;

      if (gatePart && !caseOpen) {
        stage.innerHTML =
          '<div class="hwlab-closed-case" data-hwlab-diag-select-part="' +
          esc(gateId) +
          '"><span class="hwlab-closed-case__icon">' +
          esc(gatePart.icon) +
          '</span><p class="hwlab-closed-case__label">' +
          esc(equipmentData.closedLabel || "Equipo cerrado") +
          '</p><p class="hwlab-closed-case__hint">Si el sintoma lo amerita, selecciona "' +
          esc(gatePart.name) +
          '" para abrirlo. No siempre hace falta.</p></div>';
      } else {
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
            ? '<button type="button" class="hwlab-close-case" data-hwlab-diag-select-part="' +
              esc(gateId) +
              '">' +
              esc(gatePart.icon) +
              " Cerrar " +
              esc(gatePart.name.toLowerCase()) +
              "</button>"
            : "") +
          "</div>";
      }

      // Cables externos propios del diagnostico (cable de pared, cable de
      // video): siempre visibles, sin importar si el gabinete esta abierto.
      var externalWrap = byId("hwlab-diag-external");
      if (externalWrap) {
        externalWrap.innerHTML = Object.keys(DiagEngine.DIAGNOSIS_EXTRA_PARTS)
          .map(renderPartChip)
          .join("");
      }
    }

    function renderPartChip(partId) {
      var part = DiagEngine.getPart(equipmentData, partId);
      var present = session.parts[partId];
      if (!present) return "";
      var isSelected = selectedPartId === partId;
      var kindClass = part.kind === "cable" ? "hwlab-chip--cable" : "hwlab-chip--component";
      return (
        '<button type="button" class="hwlab-chip ' +
        kindClass +
        (isSelected ? " is-selected" : "") +
        '" data-hwlab-diag-select-part="' +
        esc(partId) +
        '" title="' +
        esc(part.name) +
        '"><span class="hwlab-chip__icon">' +
        esc(part.icon || "") +
        '</span><span class="hwlab-chip__name">' +
        esc(part.name) +
        "</span></button>"
      );
    }

    function renderTools() {
      var wrap = byId("hwlab-diag-tools");
      if (!wrap) return;
      wrap.innerHTML = Tools.listTools()
        .map(function (tool) {
          var isActive = selectedToolId === tool.id;
          return (
            '<button type="button" class="hwlab-tool' +
            (isActive ? " is-active" : "") +
            '" data-hwlab-diag-select-tool="' +
            esc(tool.id) +
            '" title="' +
            esc(tool.description) +
            '"><span class="hwlab-tool__icon">' +
            esc(tool.icon) +
            '</span><span class="hwlab-tool__name">' +
            esc(tool.name) +
            "</span></button>"
          );
        })
        .join("");
    }

    function renderTray() {
      var wrap = byId("hwlab-diag-tray");
      if (!wrap) return;
      var allIds = Object.keys(equipmentData.parts).concat(Object.keys(DiagEngine.DIAGNOSIS_EXTRA_PARTS));
      var removedIds = allIds.filter(function (id) {
        return session.parts[id] === false;
      });
      if (!removedIds.length) {
        wrap.innerHTML = '<p class="hwlab-tray__empty">Ninguna pieza retirada o desconectada por ahora.</p>';
        return;
      }
      wrap.innerHTML = removedIds
        .map(function (id) {
          var part = DiagEngine.getPart(equipmentData, id);
          var isSelected = selectedPartId === id;
          return (
            '<button type="button" class="hwlab-chip hwlab-chip--tray hwlab-chip--reveal' +
            (isSelected ? " is-selected" : "") +
            '" data-hwlab-diag-select-part="' +
            esc(id) +
            '" title="' +
            esc(part.name) +
            '"><span class="hwlab-chip__icon">' +
            esc(part.icon || "") +
            '</span><span class="hwlab-chip__name">' +
            esc(part.name) +
            "</span></button>"
          );
        })
        .join("");
    }

    function renderResult() {
      var wrap = byId("hwlab-diag-result");
      if (!wrap) return;
      if (!session.result) {
        wrap.hidden = true;
        wrap.innerHTML = "";
        return;
      }
      wrap.hidden = false;
      var r = session.result;
      var b = r.breakdown;
      var ex = activeCaseDef.explanation || {};
      wrap.innerHTML =
        '<div class="hwlab-result c-card c-card--elevated">' +
        "<h3>Caso completado</h3>" +
        '<dl class="hwlab-result__grid">' +
        "<dt>Caso</dt><dd>" +
        activeCaseDef.number +
        " — " +
        esc(activeCaseDef.name) +
        "</dd>" +
        "<dt>Diagnostico</dt><dd>" +
        (r.diagnosisCorrect ? "Correcto" : "No resuelto") +
        "</dd>" +
        "<dt>Tiempo</dt><dd>" +
        fmtTime(r.durationSeconds) +
        "</dd>" +
        "<dt>Pistas</dt><dd>" +
        r.hintsUsed +
        "/3</dd>" +
        "<dt>Errores</dt><dd>" +
        r.errors +
        "</dd>" +
        "<dt>Componentes innecesarios</dt><dd>" +
        r.unnecessaryParts +
        "</dd>" +
        "<dt>Diagnostico correcto</dt><dd>" +
        b.diagnostico.value +
        "/" +
        b.diagnostico.max +
        "</dd>" +
        "<dt>Procedimiento</dt><dd>" +
        b.procedimiento.value +
        "/" +
        b.procedimiento.max +
        "</dd>" +
        "<dt>Reparacion</dt><dd>" +
        b.reparacion.value +
        "/" +
        b.reparacion.max +
        "</dd>" +
        "<dt>Herramientas</dt><dd>" +
        b.herramientas.value +
        "/" +
        b.herramientas.max +
        "</dd>" +
        "<dt>Eficiencia</dt><dd>" +
        b.eficiencia.value +
        "/" +
        b.eficiencia.max +
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
        '<div class="hwlab-diag-explain">' +
        "<h4>¿Que estaba ocurriendo?</h4><p>" +
        esc(ex.whatWasHappening || "") +
        "</p>" +
        "<h4>¿Por que ocurria?</h4><p>" +
        esc(ex.why || "") +
        "</p>" +
        "<h4>¿Como debia diagnosticarse?</h4><p>" +
        esc(ex.howToDiagnose || "") +
        "</p>" +
        "<h4>¿Como se solucionaba?</h4><p>" +
        esc(ex.howToFix || "") +
        "</p>" +
        "<h4>Procedimiento optimo</h4><p>" +
        esc(ex.optimalProcedure || "") +
        "</p>" +
        "</div>" +
        '<div class="hwlab__actions">' +
        '<button type="button" class="c-btn c-btn--secondary" data-hwlab-diag-restart>Repetir caso</button>' +
        '<button type="button" class="c-btn" data-hwlab-diag-back-to-cases>Volver a los casos</button>' +
        "</div>" +
        "</div>";
    }

    function setText(id, text) {
      var el = byId(id);
      if (el) el.textContent = text;
    }

    function showFeedback(ok, message) {
      var el = byId("hwlab-diag-feedback");
      if (!el) return;
      el.hidden = false;
      el.className = "hwlab-feedback " + (ok ? "hwlab-feedback--ok" : "hwlab-feedback--error");
      el.textContent = message;
    }
    function clearFeedback() {
      var el = byId("hwlab-diag-feedback");
      if (!el) return;
      el.hidden = true;
      el.textContent = "";
      el.className = "hwlab-feedback";
    }

    // ── Acciones ─────────────────────────────────────────────────────────
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
      var outcome = DiagEngine.attemptAction(equipmentData, session, {
        action: action,
        partId: partId,
        toolId: selectedToolId,
      });
      session = outcome.session;
      showFeedback(outcome.ok, outcome.message);
      if (outcome.ok) selectedPartId = null;
      persistSession();
      renderAll();
    }

    function requestHint() {
      var outcome = DiagEngine.useHint(session, activeCaseDef);
      session = outcome.session;
      showFeedback(outcome.ok, outcome.ok ? "Pista: " + outcome.message : outcome.message);
      persistSession();
      renderAll();
    }

    function powerOnCheck() {
      var outcome = DiagEngine.checkPowerOn(equipmentData, session);
      session = outcome.session;
      showFeedback(outcome.fixed, outcome.message);
      if (outcome.fixed) {
        session = DiagEngine.finish(session);
      }
      persistSession();
      renderAll();
    }

    function bindEvents() {
      container.addEventListener("click", function (event) {
        var caseBtn = event.target.closest("[data-hwlab-diag-case]");
        if (caseBtn && !caseBtn.disabled) {
          startCase(caseBtn.getAttribute("data-hwlab-diag-case"));
          return;
        }
        var selectBtn = event.target.closest("[data-hwlab-diag-select-part]");
        if (selectBtn) {
          selectPart(selectBtn.getAttribute("data-hwlab-diag-select-part"));
          return;
        }
        var toolBtn = event.target.closest("[data-hwlab-diag-select-tool]");
        if (toolBtn) {
          selectTool(toolBtn.getAttribute("data-hwlab-diag-select-tool"));
          return;
        }
        var actBtn = event.target.closest("[data-hwlab-diag-act]");
        if (actBtn) {
          performAction(actBtn.getAttribute("data-hwlab-diag-act"), actBtn.getAttribute("data-hwlab-diag-act-part"));
          return;
        }
        if (event.target.closest("[data-hwlab-diag-hint]")) {
          requestHint();
          return;
        }
        if (event.target.closest("[data-hwlab-diag-power-on]")) {
          powerOnCheck();
          return;
        }
        if (event.target.closest("[data-hwlab-diag-restart]")) {
          restartCase();
          return;
        }
        if (event.target.closest("[data-hwlab-diag-back-to-cases]")) {
          backToCases();
          return;
        }
      });
    }

    function backToCases() {
      stopTimer();
      activeCaseDef = null;
      session = null;
      renderCaseGrid();
      showView("hwlab-diag-menu");
    }

    function showView(viewId) {
      ["hwlab-diag-menu", "hwlab-diag-runtime"].forEach(function (id) {
        var el = byId(id);
        if (el) el.hidden = id !== viewId;
      });
    }

    return {
      mount: function (rootEl, exitCallback) {
        container = rootEl;
        onExit = exitCallback;
        bindEvents();
      },
      startMenu: function () {
        renderCaseGrid();
        showView("hwlab-diag-menu");
      },
      // startCase (interno) ya llama a showView("hwlab-diag-runtime") por su
      // cuenta -- lo hace tambien el click handler de bindEvents(), asi que
      // este metodo publico solo delega, sin duplicar la llamada.
      startCase: startCase,
      stopTimer: stopTimer,
    };
  }

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.DiagnosisUI = { createDiagnosisController: createDiagnosisController };
})(typeof window !== "undefined" ? window : this);
