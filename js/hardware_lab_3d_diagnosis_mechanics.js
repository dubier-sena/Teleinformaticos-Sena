/* js/hardware_lab_3d_diagnosis_mechanics.js
 *
 * Mecanica fisica del PORTATIL para "Diagnostico y reparacion" (sep-27):
 * tornillos, tapa inferior, posiciones de trabajo y bateria. Reutiliza lo ya
 * validado del stage y del rig (controlador de tornillos, poses, "Preparar")
 * con las reglas de un modo ABIERTO: el aprendiz decide que revisar; no hay
 * pasos ni pieza objetivo. El controlador de practicas conserva su propia
 * version (guiada) intacta: aqui solo esta lo que el diagnostico necesita.
 *
 * Reglas (las mismas que ya aplica el laboratorio):
 *  - una pieza atornillada no sale mientras le queden tornillos puestos;
 *  - una pieza reinstalada se asegura con sus tornillos antes de seguir;
 *  - si la posicion del portatil no permite alcanzar la pieza o el tornillo,
 *    se explica y se ofrece "Preparar" (sin castigo);
 *  - trabajar un componente interno con la bateria conectada es INSEGURO: no
 *    se permite y se registra en el procedimiento.
 *
 * Refrigeracion (Fase C): el estado de polvo/pasta vive en la sesion y sus
 * reglas en hardware_lab_thermal.js (las mismas del mantenimiento); aqui solo
 * se refleja en el 3D (hardware_lab_3d_thermal_look.js) y se ofrecen las
 * tareas cuando el aprendiz ya saco el modulo, sin ordenarlas por el estado.
 */
import { applyThermalLook } from "./hardware_lab_3d_thermal_look.js?v=20260929_1";

export function createLaptopDiagnosisMechanics({ stage, getSession, setSession, getEquipmentData, onChanged, onRender }) {
  let neededPreset = null;
  let screwsBusy = false;
  let thermalOpen = false; // el aprendiz desplego a mano el panel de refrigeracion
  let thermalShown = false;

  const rig = () => stage.currentRig;
  const ctl = () => stage.screws;
  const Core = () => window.HardwareLab.Engine;
  const Diag = () => window.HardwareLab.DiagnosisEngine;
  const partOf = (id) => Diag().getPart(getEquipmentData(), id);
  const powerPart = () => Diag().POWER_SOURCE_PART_BY_EQUIPMENT.laptop;

  function presetLabel(name) {
    const p = rig() && rig().presets[name];
    return p ? p.label : name;
  }

  function poseBlockMessage(access, preset, what) {
    if (access === "interior") {
      return "Para " + what + " el portátil tiene que estar boca abajo, con el interior hacia arriba. Usa \"Preparar para " +
        presetLabel(preset).toLowerCase() + "\" o \"Vista de trabajo\".";
    }
    return "Para " + what + " el portátil tiene que estar derecho y con la pantalla abierta. Usa \"Preparar para " +
      presetLabel(preset).toLowerCase() + "\" o \"Vista de trabajo\".";
  }

  /** Pieza presente con tornillos sin colocar (no se deja una pieza a medio asegurar). */
  function partWithPendingScrews(exceptPartId) {
    const c = ctl();
    if (!c) return null;
    const parts = getSession().parts;
    const ids = Object.keys(parts).filter((id) => parts[id] && id !== exceptPartId && c.hasScrews(id) && c.pendingInstall(id) > 0);
    return ids.length ? ids[0] : null;
  }

  /** ¿La accion sobre la pieza la aceptaria el motor (orden y tapa)? Sin modificar nada. */
  function actionWouldBeValid(partId, action) {
    const session = getSession();
    const data = getEquipmentData();
    if (!Core().canOperateOnPart(data, session, partId).ok) return false;
    return Core().checkRequirements(data, session, partId, action).ok;
  }

  /** Reglas de un tornillo, derivadas del motor (igual criterio que las piezas). */
  function canOperateScrewPart(partId, action) {
    const session = getSession();
    const part = partOf(partId);
    if (!part) return { ok: false, reason: "Esa pieza no existe en este equipo." };
    if (action !== "remove" && session.parts[partId] === false) {
      return { ok: false, reason: "Primero instala " + part.name + ": todavía no hay donde atornillar este tornillo." };
    }
    const data = getEquipmentData();
    const gate = Core().canOperateOnPart(data, session, partId);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const partAction = action === "remove" ? "remove" : "install";
    const req = Core().checkRequirements(data, session, partId, partAction);
    if (!req.ok) {
      if (partAction === "remove" && req.missing.indexOf(powerPart()) !== -1) {
        setSession(Diag().recordUnsafeAttempt(session, partId));
        onChanged();
        return {
          ok: false,
          reason: "Por seguridad, desconecta primero la batería antes de trabajar en " + part.name + ": el equipo sigue energizado.",
        };
      }
      return {
        ok: false,
        reason:
          "Este tornillo todavía no debe " + (partAction === "remove" ? "retirarse" : "colocarse") + ": primero hay que " +
          (partAction === "remove" ? "retirar o desconectar" : "instalar") + " " +
          req.missing.map((id) => (partOf(id) ? partOf(id).name : id)).join(", ") + ".",
      };
    }
    const r = rig();
    if (r.isPoseAnimating()) return { ok: false, reason: "Espera a que el portátil termine de moverse." };
    const first = ctl().forPart(partId)[0];
    const access = first ? r.screwAccess(first.id) : null;
    if (access && !r.poseAllows(access)) {
      neededPreset = r.workPresetFor(partId, access);
      setTimeout(onRender, 0);
      return { ok: false, reason: poseBlockMessage(access, neededPreset, "trabajar este tornillo") };
    }
    return { ok: true };
  }

  function refreshFraming() {
    // La vista "Interna" encuadra la tapa mientras siga puesta; despues, nada
    // en particular (NUNCA la pieza de la falla: eso revelaria la respuesta).
    stage.setBelowFraming(getSession().parts["bottom-cover"] !== false ? "bottom-cover" : null);
  }

  function refreshHighlight() {
    const c = ctl();
    if (!c || !c.setHighlight) return;
    const pending = partWithPendingScrews(null);
    if (pending) c.setHighlight(pending, "install"); // lo que el propio aprendiz acaba de reinstalar
    else if (getSession().parts["bottom-cover"] !== false) c.setHighlight("bottom-cover", "remove");
    else c.setHighlight(null, "remove");
  }

  function setup(savedScrews) {
    const r = rig();
    r.setPose(r.presetPose("open"), { animate: false });
    stage.refreshRigBounds();
    stage.renderPoseStatus();
    neededPreset = null;
    stage.setScrewHooks({
      canOperatePart: canOperateScrewPart,
      onChanged: () => {
        refreshHighlight();
        onChanged();
      },
      onBusyChange: (busy) => {
        screwsBusy = busy;
      },
    });
    const c = ctl();
    c.setEnabled(true);
    if (savedScrews) c.setState(savedScrews, { defaultInstalled: true });
    else c.syncFromParts(getSession().parts, { installedWhenPresent: true });
    stage.setPoseHooks({
      contextualPreset: () => neededPreset,
      onPoseStart: () => {},
      onPoseEnd: () => {
        refreshFraming();
        onRender();
      },
    });
    refreshFraming();
    refreshHighlight();
    thermalOpen = false;
    refreshThermalLook();
  }

  // ── Refrigeracion ─────────────────────────────────────────────────────────
  function refreshThermalLook() {
    const r = rig();
    const session = getSession();
    if (!r || !session || !session.thermal) return;
    applyThermalLook(r.getObject3D("cpu"), r.getObject3D("cooler"), session.thermal, { coolerInstalled: session.parts.cooler !== false });
  }

  function thermalTaskButton(taskId, label, amount, esc) {
    const Thermal = window.HardwareLab.Thermal;
    const task = Thermal.TASKS[taskId];
    const tools = window.HardwareLab.Tools;
    const tool = tools && tools.getTool ? tools.getTool(task.tool) : null;
    return `<button type="button" class="c-btn c-btn--secondary c-btn--sm c-btn--block hwlab-thermal-btn" data-diag-thermal="${esc(taskId)}"` +
      (amount ? ` data-amount="${esc(amount)}"` : "") +
      `>${esc(label)}<span class="hwlab-thermal-btn__tool">${esc(tool ? tool.name : task.tool)}</span></button>`;
  }

  /** Panel de refrigeracion: solo con el modulo FUERA (el aprendiz llego ahi
   *  por su cuenta). Muestra lo que se observa y TODAS las tareas, siempre en
   *  el mismo orden: no se filtran por el estado, para no dictar la secuencia. */
  function thermalSectionHtml(esc) {
    const session = getSession();
    const Thermal = window.HardwareLab.Thermal;
    if (!session || !session.thermal || !Thermal || session.parts.cooler !== false) {
      // Modulo montado de nuevo: el panel desaparece y la tarjeta vuelve a
      // poder compactarse sola (abrirlo conto como expansion manual).
      if (thermalShown && stage.resetCardExpansion) stage.resetCardExpansion();
      thermalShown = false;
      thermalOpen = false;
      return "";
    }
    thermalShown = true;
    const d = Thermal.describe(session.thermal);
    const T = Thermal.TASKS;
    let html = `<details class="hwlab-thermal" id="hwlab-diag-thermal"${thermalOpen ? " open" : ""}>` +
      '<summary class="hwlab-thermal__summary">Inspeccionar la refrigeración</summary>' +
      `<p class="hwlab-muted">Aletas y ventilador: <strong>${esc(d.dust)}</strong></p>`;
    if (session.parts.cpu !== false) html += `<p class="hwlab-muted">Pasta térmica: <strong>${esc(d.paste)}</strong></p>`;
    html += thermalTaskButton("brush", T.brush.label, null, esc) + thermalTaskButton("air", T.air.label, null, esc) +
      thermalTaskButton("scrape", T.scrape.label, null, esc) + thermalTaskButton("alcohol", T.alcohol.label, null, esc) +
      `<p class="hwlab-muted">${esc(T.apply.label)}: ¿cuánta?</p>`;
    Object.keys(Thermal.AMOUNTS).forEach((k) => {
      html += thermalTaskButton("apply", Thermal.AMOUNTS[k].label, k, esc);
    });
    return html + "</details>";
  }

  function wireThermalSection(onTask) {
    const details = document.getElementById("hwlab-diag-thermal");
    if (details) details.addEventListener("toggle", () => { thermalOpen = details.open; stage.refreshLayout(thermalOpen); });
    document.querySelectorAll("[data-diag-thermal]").forEach((b) => {
      b.onclick = () => onTask(b.getAttribute("data-diag-thermal"), b.getAttribute("data-amount") || undefined);
    });
  }

  /** Antes de intentar una accion sobre una pieza: tornillos y posicion. */
  function beforePartAction(partId, action) {
    const part = partOf(partId);
    const c = ctl();
    if (screwsBusy) return { ok: false, tone: "info", message: "Espera a que termine el destornillador antes de tocar otra pieza." };
    if (c && action === "remove" && c.pendingRemoval(partId) > 0) {
      const n = c.pendingRemoval(partId);
      return {
        ok: false,
        tone: "error",
        log: part.name + ": tornillos puestos",
        message: (n === 1 ? "Falta 1 tornillo" : "Faltan " + n + " tornillos") + " por retirar en " + part.name + ". Haz clic directamente sobre cada tornillo.",
      };
    }
    if (c && (action === "install" || action === "connect")) {
      const pending = partWithPendingScrews(partId);
      if (pending) {
        const p = partOf(pending);
        return { ok: false, tone: "error", message: "Antes de continuar, asegura " + (p ? p.name : pending) + " con sus tornillos." };
      }
    }
    const r = rig();
    if (r.isPoseAnimating()) return { ok: false, tone: "info", message: "Espera a que el portátil termine de moverse." };
    const access = r.partAccess(partId);
    if (access && !r.poseAllows(access) && actionWouldBeValid(partId, action)) {
      neededPreset = r.workPresetFor(partId, access);
      const verb = (Core().ACTION_LABELS[action] || { verb: "operar" }).verb.toLowerCase();
      return { ok: false, tone: "info", message: poseBlockMessage(access, neededPreset, verb + " " + part.name) };
    }
    return { ok: true };
  }

  function afterPartAction(partId, nowPresent) {
    const c = ctl();
    if (c && c.hasScrews(partId)) {
      if (nowPresent) c.presentScrewsFor(partId);
      else c.stowScrewsFor(partId);
    }
    refreshFraming();
    refreshHighlight();
    refreshThermalLook();
  }

  function handleScrewClick(screwId) {
    const c = ctl();
    if (!c) return;
    const before = c.get(screwId);
    const result = c.handleScrewClick(screwId);
    if (result && result.ok && before) {
      stage.pushActionLog(before.label + (result.direction === "remove" ? " retirado" : " instalado"), "success");
    }
  }

  /** Tornillos sin colocar en piezas instaladas (lo que el aprendiz dejo suelto). */
  function looseScrews() {
    const c = ctl();
    if (!c) return 0;
    const parts = getSession().parts;
    return Object.keys(parts).reduce((n, id) => n + (parts[id] && c.hasScrews(id) ? c.pendingInstall(id) : 0), 0);
  }

  /** Para encender se necesita la posicion normal (derecho y con la pantalla abierta). */
  function powerPosition() {
    const r = rig();
    if (r.isPoseAnimating()) return { ok: false, reason: "Espera a que el portátil termine de moverse." };
    if (!r.isAtPreset("open")) {
      neededPreset = "open";
      return { ok: false, reason: "Para encender y comprobar, deja el portátil derecho y con la pantalla abierta (posición normal)." };
    }
    return { ok: true };
  }

  function poseSectionHtml(esc) {
    if (!neededPreset) return "";
    const r = rig();
    const ok = r.isAtPreset(neededPreset);
    const label = presetLabel(neededPreset);
    let html = `<p class="hwlab-muted">Posición de trabajo: <strong>${esc(label)}</strong>${ok ? " &#9989;" : ""}</p>`;
    if (!ok) {
      html += `<button type="button" class="c-btn c-btn--primary c-btn--sm c-btn--block hwlab-prepare-btn" id="hwlab-prepare-btn" data-preset="${esc(neededPreset)}">` +
        (neededPreset === "open" ? "Dejar el portátil abierto (posición normal)" : "Preparar para " + esc(label.toLowerCase())) + "</button>";
    }
    return html;
  }

  function wirePrepareButton() {
    const btn = document.getElementById("hwlab-prepare-btn");
    if (btn) btn.onclick = () => stage.goToWorkPose(btn.getAttribute("data-preset"));
  }

  return {
    setup,
    beforePartAction,
    afterPartAction,
    handleScrewClick,
    looseScrews,
    screwsSecured: () => looseScrews() === 0,
    powerPosition,
    poseSectionHtml,
    wirePrepareButton,
    refreshThermalLook,
    thermalSectionHtml,
    wireThermalSection,
    screwState: () => (ctl() ? ctl().getState() : null),
  };
}
