/* js/hardware_lab_3d_controller.js
 *
 * Controlador de "Aprender componentes" + las 4 practicas de
 * ensamble/desensamble (guiado x2, libre, evaluacion). Traduce clics en la
 * escena 3D a llamadas del motor puro hardware_lab_engine.js (intacto) y
 * refleja el resultado en el rig (hardware_lab_3d_rig.js) y el HUD
 * (hardware_lab_3d_stage.js). No conoce Three.js directamente: todo pasa
 * por `stage`.
 *
 * Nota sobre modos: el motor solo entiende "<direccion>-guided" o
 * "<direccion>-open" (ver modeKind en hardware_lab_engine.js, exige que el
 * string TERMINE en "-open"). "Practica libre" y "Evaluacion" son ambas
 * "-open" para el motor (mismas reglas de dependencias, sin secuencia fija);
 * lo que las distingue es el numero de pistas permitidas (0 en evaluacion,
 * item 23) y la llave de almacenamiento, que aqui SI se guarda por separado
 * (storageMode) para que evaluacion no pise el progreso de practica libre.
 */
import { createDesktopLayout } from "./hardware_lab_3d_layout_desktop.js";
import { createLaptopLayout } from "./hardware_lab_3d_layout_laptop.js";
import { HardwareLabAudio } from "./hardware_lab_3d_audio.js";

const TITLES = {
  learn: "Aprender componentes",
  "disassembly-guided": "Desensamble guiado",
  "assembly-guided": "Ensamble guiado",
  free: "Practica libre",
  evaluation: "Evaluacion",
};

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function createAssemblyController(stage) {
  let equipmentData = null;
  let equipmentId = null;
  let session = null;
  let engineMode = null;
  let storageMode = null;
  let practiceMode = null;
  let direction = null;
  let offClick = null;
  let persistTimer = null;
  let isLearn = false;
  // Tornillos interactivos: el stage los construye (ver
  // hardware_lab_3d_screws.js) y aqui se les conectan las REGLAS, que son las
  // del motor puro -- un tornillo solo se puede tocar cuando su pieza se
  // podria operar de verdad en este momento.
  let screwsBusy = false;
  // Posiciones tecnicas (sep-26): ultima posicion que pidio una operacion que
  // el aprendiz intento con el portatil en otra orientacion (modos abiertos).
  let neededPreset = null;

  function Engine() {
    return window.HardwareLab.Engine;
  }
  function Storage() {
    return window.HardwareLab.Storage;
  }
  function Tools() {
    return window.HardwareLab.Tools;
  }

  function layoutFor(id) {
    return id === "laptop" ? createLaptopLayout() : createDesktopLayout();
  }

  function equipmentDataFor(id) {
    return id === "laptop" ? window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT : window.HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;
  }

  function allToolIds() {
    return Tools()
      .listTools()
      .map((t) => t.id)
      .filter((id) => id !== "hands");
  }

  function start(id, mode, dir) {
    equipmentId = id;
    equipmentData = equipmentDataFor(id);
    isLearn = mode === "learn";
    practiceMode = mode;
    direction = dir;

    if (!stage.showStage()) return;
    const rig = stage.loadRig(layoutFor(id), id);
    neededPreset = null;
    setupPoseHooks();

    if (offClick) {
      offClick();
      offClick = null;
    }

    if (isLearn) {
      startLearn(rig);
      return;
    }
    startPractice(rig);
  }

  // ── APRENDER COMPONENTES ────────────────────────────────────────────────
  function startLearn(rig) {
    stage.setModeTitle("Aprender componentes", equipmentData.name);
    stage.setStats({ step: null });
    stage.setHintUi(0, 0, null);
    document.getElementById("hwlab-hint-btn").hidden = true;
    document.getElementById("hwlab-restart-btn").hidden = true;
    stage.stopTimer();
    document.getElementById("hwlab-timer").parentElement.hidden = true;
    stage.renderToolGrid([], null);
    document.getElementById("hwlab-tools-panel").hidden = true;
    stage.clearActionLog();
    // El gabinete/tapa arranca ABIERTO en este modo (a diferencia de las
    // practicas de ensamble/desensamble): "explorar libremente cada pieza"
    // debe incluir de entrada la tarjeta madre, CPU, RAM, GPU, fuente y
    // cables -- todas "internal" (ver hardware_lab_data_desktop.js/_laptop.js)
    // y por lo tanto imposibles de clickear/raycastear mientras la tapa siga
    // instalada cubriendolas. Sin esto, mas de la mitad de las piezas del
    // equipo quedaban inalcanzables en el unico modo pensado para conocerlas.
    const learnState = Object.assign({}, equipmentData.initialStateDisassembly);
    if (equipmentData.caseGatePartId) learnState[equipmentData.caseGatePartId] = false;
    if (equipmentId === "laptop") {
      // El portatil no queda "abierto" solo con la tapa inferior: el teclado
      // (pieza propia, montada sobre la base) sigue cubriendo bateria,
      // placa, CPU, RAM y tarjeta Wi-Fi desde cualquier angulo de camara
      // razonable (a diferencia del gabinete de escritorio, que se abre
      // hacia el costado). Confirmado con clic real: sin esto, el clic
      // resolvia siempre al teclado en vez del componente real debajo.
      learnState.keyboard = false;
    }
    rig.syncFromSessionParts(learnState);
    setupScrews(learnState);
    refreshBelowFraming(learnState);
    // stage.loadRig() ya encuadro la camara "General" con las piezas en su
    // posicion INSTALADA (antes de que la linea de arriba las mandara a la
    // bandeja) -- en el portatil eso dejaba el teclado y la tapa inferior
    // fuera de cuadro por completo (bandeja lejos del equipo cerrado, mucho
    // mas chico que el gabinete de escritorio). Reencuadrar aqui, con el
    // estado YA sincronizado, evita piezas "inaccesibles" fuera de camara.
    // `installedOnly: true` (mejora 3D): la bandeja ya tiene 1-2 piezas en
    // este punto (tapa/teclado) -- sin esto, el encuadre las incluye igual y
    // aleja la camara mucho mas de lo necesario para ver el equipo abierto.
    const learnBounds = rig.getBoundsWorld({ installedOnly: true });
    stage.cameraRig.setRigBounds(learnBounds.center, learnBounds.radius);
    stage.cameraRig.goToView("overview", { duration: 0 });
    // Nota (mejora 3D): en el portatil, con la base solida (sin carcasa
    // hueca como el gabinete de escritorio), buena parte de las piezas
    // internas quedan mejor expuestas mirando desde abajo ("Interna") que
    // desde "General". Se probo poner "Interna" como default aqui para el
    // portatil, pero esa vista usa un encuadre con una altura fija (ver
    // viewFromBelow en hardware_lab_3d_camera.js, pensado para el paso de
    // desensamble donde se retira la tapa inferior) que no siempre encuadra
    // bien el equipo YA abierto de este modo -- quedaba mas cerrado/cortado
    // que "General". Se prefiere no arriesgar el primer encuadre que ve el
    // aprendiz por mejorar un caso puntual; queda como ajuste de camara a
    // futuro, no como bug que deba resolver esta pasada.

    stage.setInfoPanel(
      '<div class="hwlab-info-block"><h3>Explora cada pieza</h3>' +
        "<p>Gira el equipo, acercate y haz clic en cualquier componente para ver su ficha tecnica completa: funcion, ubicacion, tipo de conexion, precauciones y fallas frecuentes. El gabinete ya esta abierto para que puedas ver tambien las piezas internas.</p></div>"
    );

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToIntro;
    document.getElementById("hwlab-hint-btn").hidden = true;

    offClick = stage.interactions.onClick((root, meta) => {
      if (meta && meta.kind === "screw") {
        handleScrewClick(meta.screwId);
        return;
      }
      if (!meta || !meta.partId) return;
      const part = getPart(meta.partId);
      if (!part) return;
      HardwareLabAudio.playClick();
      stage.focusOnPart(meta.partId);
      stage.openPartModal(part);
    });
  }

  // ── PRACTICAS DE ENSAMBLE/DESENSAMBLE ────────────────────────────────────
  function startPractice(rig) {
    document.getElementById("hwlab-tools-panel").hidden = false;
    document.getElementById("hwlab-hint-btn").hidden = false;
    document.getElementById("hwlab-restart-btn").hidden = false;
    document.getElementById("hwlab-timer").parentElement.hidden = false;

    if (practiceMode === "disassembly-guided" || practiceMode === "assembly-guided") {
      engineMode = practiceMode;
      storageMode = practiceMode;
    } else {
      engineMode = direction + "-open";
      storageMode = direction + "-" + practiceMode;
    }
    const maxHints = practiceMode === "evaluation" ? 0 : 3;

    const saved = Storage().loadLocal(equipmentId, storageMode);
    session = saved ? Engine().deserialize(equipmentData, saved) : Engine().createSession(equipmentData, engineMode, { maxHints });
    rig.syncFromSessionParts(session.parts);
    // El estado de los tornillos viaja en la MISMA llave de almacenamiento que
    // la sesion (el motor ignora las claves que no conoce al deserializar).
    setupScrews(session.parts, {
      assembly: direction === "assembly" || engineMode === "assembly-guided",
      state: saved && saved.screws ? saved.screws : null,
    });

    stage.setModeTitle(TITLES[practiceMode], equipmentData.name + (direction ? " - " + (direction === "assembly" ? "Ensamble" : "Desensamble") : ""));
    stage.startTimer(session.startedAt);
    stage.renderToolGrid(allToolIds(), () => {});
    stage.clearActionLog();
    stage.setHintUi(session.hints.used, session.hints.max, onHint);

    document.getElementById("hwlab-explode-btn").onclick = () => stage.toggleExplode();
    document.getElementById("hwlab-back-to-intro").onclick = backToIntro;
    document.getElementById("hwlab-restart-btn").onclick = () => {
      session = Engine().createSession(equipmentData, engineMode, { maxHints });
      neededPreset = null;
      resetPose();
      rig.syncFromSessionParts(session.parts);
      setupScrews(session.parts, { assembly: direction === "assembly" || engineMode === "assembly-guided" });
      stage.startTimer(session.startedAt);
      stage.clearActionLog();
      stage.setHintUi(session.hints.used, session.hints.max, onHint);
      renderInfoPanel();
      // Encontrado con clic real: faltaba aqui (a diferencia del arranque
      // inicial de la practica, linea ~199, que si la llama) -- "Reiniciar"
      // devolvia las piezas a su sitio pero el contador "Paso X/Y" y el de
      // errores se quedaban mostrando los numeros de ANTES del reinicio.
      refreshStats();
    };

    offClick = stage.interactions.onClick((root, meta) => {
      if (meta && meta.kind === "screw") {
        handleScrewClick(meta.screwId);
        return;
      }
      if (!meta || !meta.partId) return;
      handlePartClick(meta.partId);
    });

    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  function getPart(partId) {
    return equipmentData.parts[partId] || null;
  }

  // ── POSICIONES TECNICAS (sep-26) ─────────────────────────────────────────
  function rig3d() {
    return stage.currentRig;
  }
  function hasPose() {
    const r = rig3d();
    return !!(r && r.hasPose);
  }
  function presetLabel(name) {
    const r = rig3d();
    const p = r && r.presets[name];
    return p ? p.label : name;
  }
  function isAssemblyPractice() {
    return direction === "assembly" || engineMode === "assembly-guided";
  }

  /** Posicion que pide operar `partId` ahora: la de sus tornillos mientras
   *  queden por retirar/colocar, si no la de la pieza. */
  function requiredPresetFor(partId, action) {
    const r = rig3d();
    if (!hasPose() || !partId) return null;
    const ctl = screws();
    const removing = action === "remove" || action === "disconnect";
    const pendingScrews = ctl && ctl.hasScrews(partId) && (removing ? ctl.pendingRemoval(partId) > 0 : session && session.parts[partId] && ctl.pendingInstall(partId) > 0);
    if (pendingScrews) {
      const first = ctl.forPart(partId)[0];
      return { preset: r.workPresetFor(partId, r.screwAccess(first.id)), access: r.screwAccess(first.id), forScrews: true };
    }
    return { preset: r.workPresetFor(partId, r.partAccess(partId)), access: r.partAccess(partId), forScrews: false };
  }

  /** Posicion de la tarea ACTUAL (para "Vista de trabajo" y el panel). */
  function contextualPreset() {
    if (!hasPose() || !session || isLearn) return null;
    if (Engine().isFinished(session) && isAssemblyPractice()) return "open";
    // Una pieza recien instalada con tornillos por colocar manda (solo al
    // ENSAMBLAR: al desensamblar, una pieza aun montada sin sus tornillos es
    // justo lo esperado antes de retirarla).
    const pendiente = isAssemblyPractice() ? partWithPendingScrews(null) : null;
    if (pendiente) return requiredPresetFor(pendiente, "install").preset;
    const step = Engine().currentStep(session);
    if (session.kind === "guided" && step && step.kind === "action") return requiredPresetFor(step.partId, step.action).preset;
    return neededPreset;
  }

  function setupPoseHooks() {
    stage.setPoseHooks({
      contextualPreset,
      onPoseStart: () => {},
      onPoseEnd: () => {
        if (!session || isLearn) return;
        renderInfoPanel();
        maybeFinish();
      },
    });
  }

  function resetPose() {
    const r = rig3d();
    if (!hasPose()) return;
    r.setPose(r.presetPose("open"), { animate: false });
    stage.refreshRigBounds();
    stage.renderPoseStatus();
  }

  /** Mensaje (sin castigo) cuando la operacion es correcta pero el portatil
   *  no esta en la orientacion que la permite fisicamente. */
  function poseBlockMessage(req, what) {
    if (req.access === "interior") {
      return "Para " + what + " el portatil tiene que estar boca abajo, con el interior hacia arriba. Usa \"Preparar para " +
        presetLabel(req.preset).toLowerCase() + "\" o \"Vista de trabajo\".";
    }
    return "Para " + what + " el portatil tiene que estar derecho y con la pantalla abierta. Usa \"Preparar para " +
      presetLabel(req.preset).toLowerCase() + "\" o \"Vista de trabajo\".";
  }

  /** Bloque del panel con la posicion de trabajo que pide la tarea. */
  function poseSectionHtml() {
    if (!hasPose() || !session) return "";
    const r = rig3d();
    const name = contextualPreset();
    if (!name) return "";
    let ok;
    if (name === "open") ok = r.isAtPreset("open");
    else {
      const step = Engine().currentStep(session);
      const pendiente = isAssemblyPractice() ? partWithPendingScrews(null) : null;
      const partId = pendiente || (step && step.kind === "action" ? step.partId : null);
      const req = partId ? requiredPresetFor(partId, pendiente ? "install" : step.action) : null;
      ok = req ? r.poseAllows(req.access) : r.isAtPreset(name);
    }
    const label = presetLabel(name);
    let html = `<p class="hwlab-muted">Posicion de trabajo: <strong>${esc(label)}</strong>${ok ? " &#9989;" : ""}</p>`;
    if (!ok) {
      html += `<button type="button" class="c-btn c-btn--primary c-btn--sm c-btn--block hwlab-prepare-btn" id="hwlab-prepare-btn" data-preset="${esc(name)}">` +
        (name === "open" ? "Dejar el portatil abierto (posicion normal)" : "Preparar para " + esc(label.toLowerCase())) + "</button>";
    }
    return html;
  }

  // ── TORNILLOS ────────────────────────────────────────────────────────────
  function screws() {
    return stage.screws;
  }

  /** Reglas de un tornillo, derivadas del motor puro (sin duplicar logica):
   * un tornillo se puede retirar/colocar solo si su pieza se podria
   * retirar/instalar ahora mismo. Mensajes educativos (item 12: enseñar el
   * orden, no castigar) -- no cuentan como error de la practica. */
  function canOperateScrewPart(partId, action) {
    if (isLearn) {
      return { ok: false, reason: "En \"Aprender componentes\" los tornillos solo se observan: practica el destornillado en Desensamble o Ensamble." };
    }
    const part = getPart(partId);
    if (!part) return { ok: false, reason: "Esa pieza no existe en este equipo." };
    const step = Engine().currentStep(session);
    // Asegurar una pieza YA instalada es terminar el trabajo que se acaba de
    // hacer, no empezar uno nuevo: no lo bloquea un paso de seguridad. Sin
    // esta excepcion (encontrado con clic real) la ultima pieza del ensamble
    // quedaba imposible de atornillar: al instalarla, el paso siguiente pasa a
    // ser la verificacion final ("conecta perifericos", "enciende el equipo"),
    // que es justo lo que va DESPUES de cerrar y atornillar el equipo. Los
    // pasos de seguridad iniciales siguen bloqueando todo lo demas: con el
    // equipo aun por armar ninguna pieza esta instalada, asi que esta rama no
    // se activa.
    const asegurandoPiezaPuesta = action !== "remove" && session.parts[partId] === true;
    if (step && step.kind === "safety" && !asegurandoPiezaPuesta) {
      return { ok: false, reason: "Primero debes completar el paso de seguridad actual: " + step.title + "." };
    }
    if (action !== "remove" && session.parts[partId] === false) {
      return {
        ok: false,
        reason: "Primero instala " + part.name + ": todavia no hay donde atornillar este tornillo.",
      };
    }
    const gate = Engine().canOperateOnPart(equipmentData, session, partId);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const partAction = action === "remove" ? "remove" : "install";
    const req = Engine().checkRequirements(equipmentData, session, partId, partAction);
    if (!req.ok) {
      return {
        ok: false,
        reason:
          "Este tornillo todavia no debe retirarse: primero hay que " +
          (partAction === "remove" ? "retirar o desconectar" : "instalar") +
          " " +
          (req.missing || []).map((id) => (getPart(id) ? getPart(id).name : id)).join(", ") +
          ".",
      };
    }
    if (session.kind === "guided" && step && step.kind === "action" && step.partId !== partId && !asegurandoPiezaPuesta) {
      const next = getPart(step.partId);
      const info = Engine().ACTION_LABELS[step.action];
      return {
        ok: false,
        reason:
          "Ese tornillo no corresponde todavia. En la practica guiada el siguiente paso es: " +
          info.verb +
          " " +
          (next ? next.name : step.partId) +
          ".",
      };
    }
    // Posicion tecnica: el tornillo es el correcto, pero hay que poder
    // alcanzarlo (p.ej. los de la tapa inferior, con el portatil boca abajo).
    if (hasPose()) {
      if (rig3d().isPoseAnimating()) return { ok: false, reason: "Espera a que el portatil termine de moverse." };
      const r = rig3d();
      const first = screws().forPart(partId)[0];
      const access = first ? r.screwAccess(first.id) : null;
      if (access && !r.poseAllows(access)) {
        neededPreset = r.workPresetFor(partId, access);
        setTimeout(renderInfoPanel, 0);
        return { ok: false, reason: poseBlockMessage({ access, preset: neededPreset }, "trabajar este tornillo") };
      }
    }
    return { ok: true };
  }

  /** Conecta las reglas y coloca los tornillos segun el estado de las piezas. */
  function setupScrews(parts, opts) {
    const ctl = screws();
    if (!ctl) return;
    stage.setScrewHooks({
      canOperatePart: canOperateScrewPart,
      onChanged: () => {
        persist();
        renderInfoPanel();
        // Un tornillo puede ser lo ultimo que faltaba para cerrar la practica.
        if (session) maybeFinish();
      },
      onBusyChange: (busy) => {
        screwsBusy = busy;
      },
    });
    // Siempre "activo": quien decide si un tornillo se puede tocar ahora es
    // canOperateScrewPart (que ya explica el caso de "Aprender componentes").
    ctl.setEnabled(true);
    if (opts && opts.state) {
      ctl.setState(opts.state, { defaultInstalled: true });
    } else {
      // Ensamble: la pieza instalada todavia NO esta asegurada (sus tornillos
      // se colocan despues, uno a uno). Desensamble: todo viene atornillado.
      ctl.syncFromParts(parts, { installedWhenPresent: !(opts && opts.assembly) });
    }
  }

  /** Piezas presentes con tornillos sin colocar (item 11: no dejar tornillos
   * sueltos antes de seguir con la siguiente pieza). */
  function partWithPendingScrews(exceptPartId) {
    const ctl = screws();
    if (!ctl) return null;
    const ids = Object.keys(session.parts).filter(
      (id) => session.parts[id] && id !== exceptPartId && ctl.hasScrews(id) && ctl.pendingInstall(id) > 0
    );
    return ids.length ? ids[0] : null;
  }

  function handleScrewClick(screwId) {
    const ctl = screws();
    if (!ctl) return;
    const before = ctl.get(screwId);
    const result = ctl.handleScrewClick(screwId);
    if (result && result.ok && before) {
      stage.pushActionLog(before.label + (result.direction === "remove" ? " retirado" : " instalado"), "success");
    }
  }

  function inferAction(partId) {
    const part = getPart(partId);
    if (!part) return null;
    const present = session.parts[partId];
    const isCable = part.kind === "cable";
    if (present) return isCable ? "disconnect" : "remove";
    return isCable ? "connect" : "install";
  }

  function handlePartClick(partId) {
    const part = getPart(partId);
    if (!part) return;
    const action = inferAction(partId);
    const ctl = screws();
    if (ctl) {
      if (screwsBusy) {
        stage.showFeedback("Espera a que termine el destornillador antes de tocar otra pieza.", "info");
        return;
      }
      // Item 11: una pieza atornillada no sale hasta que TODOS sus tornillos
      // esten fuera. Depende del estado real, no de la animacion.
      if (action === "remove" && ctl.pendingRemoval(partId) > 0) {
        const n = ctl.pendingRemoval(partId);
        stage.showFeedback(
          (n === 1 ? "Falta 1 tornillo" : "Faltan " + n + " tornillos") + " por retirar en " + part.name +
            ". Haz clic directamente sobre cada tornillo.",
          "error"
        );
        stage.pushActionLog(part.name + ": tornillos puestos", "error");
        return;
      }
      // Y al ensamblar, no se deja una pieza a medio asegurar para pasar a la
      // siguiente.
      if (action === "install" || action === "connect") {
        const pending = partWithPendingScrews(partId);
        if (pending) {
          const p = getPart(pending);
          stage.showFeedback(
            "Antes de continuar, asegura " + (p ? p.name : pending) + " con sus tornillos.",
            "error"
          );
          return;
        }
      }
    }
    if (hasPose()) {
      const r = rig3d();
      if (r.isPoseAnimating()) {
        stage.showFeedback("Espera a que el portatil termine de moverse.", "info");
        return;
      }
      const access = r.partAccess(partId);
      if (access && !r.poseAllows(access) && actionWouldBeValid(partId, action)) {
        neededPreset = r.workPresetFor(partId, access);
        const verb = (Engine().ACTION_LABELS[action] || { verb: "operar" }).verb.toLowerCase();
        stage.showFeedback(poseBlockMessage({ access, preset: neededPreset }, verb + " " + part.name), "info");
        renderInfoPanel();
        return;
      }
    }
    stage.focusOnPart(partId);
    const toolId = stage.getActiveToolId();
    const result = Engine().attemptAction(equipmentData, session, { partId, action, toolId });
    session = result.session;
    if (result.ok) {
      const nowPresent = session.parts[partId];
      stage.currentRig.setPresence(partId, nowPresent, {
        onSettled: () => {
          HardwareLabAudio.playPlace();
          // Recien instalada una pieza atornillada: la camara venia mirando la
          // BANDEJA (de donde salio la pieza), asi que los tornillos que ahora
          // hay que colocar quedaban fuera de cuadro -- medido con clic real:
          // NDC z 1.7, es decir detras de la camara. Se reencuadra sobre la
          // pieza YA instalada, que es donde estan sus tornillos.
          const ctl = screws();
          if (nowPresent && ctl && ctl.hasScrews(partId) && ctl.pendingInstall(partId) > 0) {
            stage.focusOnPart(partId);
          }
        },
      });
      if (part.tool && part.tool !== "hands") HardwareLabAudio.playScrew();
      else HardwareLabAudio[action === "connect" || action === "disconnect" ? (nowPresent ? "playConnect" : "playDisconnect") : "playClick"]();
      const screwCtl = screws();
      if (screwCtl && screwCtl.hasScrews(partId)) {
        if (nowPresent) screwCtl.presentScrewsFor(partId);
        else screwCtl.stowScrewsFor(partId);
      }
      stage.showFeedback(result.message, "success");
      stage.pushActionLog(part.name + " " + (nowPresent ? "✓" : "✗"), "success");
    } else {
      stage.showFeedback(result.message, "error");
      stage.pushActionLog(part.name + ": bloqueado", "error");
    }
    persist();
    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  /** ¿El motor aceptaria esta accion (orden, requisitos, herramienta)? Sin
   *  modificar la sesion. Solo entonces la posicion puede bloquearla SIN
   *  castigo; una accion invalida sigue yendo al motor, que la penaliza igual
   *  que siempre. */
  function actionWouldBeValid(partId, action) {
    const gate = Engine().canOperateOnPart(equipmentData, session, partId);
    if (!gate.ok) return false;
    const partAction = action === "remove" || action === "disconnect" ? "remove" : "install";
    const req = Engine().checkRequirements(equipmentData, session, partId, partAction);
    if (!req.ok) return false;
    const step = Engine().currentStep(session);
    if (step && step.kind === "safety") return false;
    if (session.kind === "guided" && step && step.kind === "action" && (step.partId !== partId || step.action !== action)) return false;
    const part = getPart(partId);
    const toolId = stage.getActiveToolId();
    if (part && part.tool && part.tool !== "hands" && toolId !== part.tool) return false;
    return true;
  }

  function onHint() {
    const result = Engine().useHint(session);
    session = result.session;
    stage.setHintUi(session.hints.used, session.hints.max, onHint);
    stage.showFeedback(result.message, result.ok ? "info" : "error");
    persist();
  }

  function attemptSafety(stepId) {
    const result = Engine().attemptSafetyStep(session, stepId);
    session = result.session;
    stage.showFeedback(result.message, result.ok ? "success" : "error");
    if (result.ok) stage.pushActionLog("Paso de seguridad confirmado", "success");
    persist();
    renderInfoPanel();
    refreshStats();
    maybeFinish();
  }

  /** La vista "Interna" encuadra la tapa inferior COMPLETA mientras siga
   * puesta (sus tornillos son clickeables y deben caber en el cuadro); una vez
   * retirada, vuelve al encuadre cerrado del interior. */
  function refreshBelowFraming(parts) {
    if (!stage.setBelowFraming) return;
    const gate = equipmentData.caseGatePartId;
    const gatePresent = gate && parts ? parts[gate] !== false : false;
    if (gatePresent) {
      // Equipo cerrado: lo unico que hay que ver desde abajo es la tapa.
      stage.setBelowFraming(gate);
      return;
    }
    // Equipo abierto: se encuadra lo que el aprendiz tiene entre manos AHORA.
    // Prioridad a la pieza con tornillos sin colocar: al instalar una pieza el
    // paso guiado YA avanzo al siguiente, pero el trabajo pendiente (sus
    // tornillos) sigue siendo el de la pieza anterior -- sin esta prioridad,
    // la vista encuadraba la pieza siguiente y los tornillos por colocar
    // quedaban fuera del cuadro (medido: NDC -1.31 en la placa base).
    const pendiente = session ? partWithPendingScrews(null) : null;
    if (pendiente) {
      stage.setBelowFraming(pendiente);
      return;
    }
    const step = session ? Engine().currentStep(session) : null;
    stage.setBelowFraming(step && step.kind === "action" ? step.partId : null);
  }

  function refreshStats() {
    refreshBelowFraming(session ? session.parts : null);
    stage.setStats({
      step: session.kind === "guided" ? Math.min(session.stepIndex + 1, session.sequence.length) : null,
      total: session.kind === "guided" ? session.sequence.length : null,
      errors: session.errors,
    });
  }

  function renderInfoPanel() {
    const step = Engine().currentStep(session);
    let html = '<div class="hwlab-info-block">';
    if (step && step.kind === "safety") {
      html +=
        `<h3>${esc(step.title)}</h3>` +
        "<ol>" +
        (step.instructions || []).map((i) => `<li>${esc(i)}</li>`).join("") +
        "</ol>" +
        `<button type="button" class="c-btn c-btn--primary c-btn--block" id="hwlab-safety-confirm-btn">Confirmar paso</button>`;
    } else if (session.kind === "guided" && step && step.kind === "action") {
      const part = getPart(step.partId);
      const actionInfo = Engine().ACTION_LABELS[step.action];
      html +=
        `<h3>Paso ${session.stepIndex + 1} de ${session.sequence.length}</h3>` +
        `<p>${esc(actionInfo.verb)} <strong>${esc(part ? part.name : step.partId)}</strong></p>` +
        "<ol>" +
        ((part && (step.action === "remove" || step.action === "disconnect" ? part.removeInstructions : part.installInstructions)) || [])
          .map((i) => `<li>${esc(i)}</li>`)
          .join("") +
        "</ol>";
      if (part && part.tool && part.tool !== "hands") {
        const tool = Tools().getTool(part.tool);
        html += `<p class="hwlab-muted">Herramienta necesaria: <strong>${esc(tool ? tool.name : part.tool)}</strong></p>`;
      }
      html += screwStatusHtml(step.partId, step.action);
    } else if (Engine().isFinished(session)) {
      html += "<h3>Practica completa</h3><p>Revisa el resultado en el panel de puntuacion.</p>";
    } else {
      html +=
        "<h3>Practica libre</h3><p>Elige una herramienta si la pieza la necesita y haz clic directamente sobre el componente en la escena para actuar sobre el.</p>" +
        '<ul class="hwlab-tray-list">' +
        Object.keys(equipmentData.parts)
          .filter((id) => session.parts[id] !== (direction === "assembly"))
          .slice(0, 8)
          .map((id) => `<li>${esc(equipmentData.parts[id].name)}</li>`)
          .join("") +
        "</ul>";
    }
    html += poseSectionHtml();
    html += "</div>";
    stage.setInfoPanel(html);
    refreshScrewHighlight();
    const safetyBtn = document.getElementById("hwlab-safety-confirm-btn");
    if (safetyBtn && step) safetyBtn.onclick = () => attemptSafety(step.id);
    const prepareBtn = document.getElementById("hwlab-prepare-btn");
    if (prepareBtn) prepareBtn.onclick = () => stage.goToWorkPose(prepareBtn.getAttribute("data-preset"));
  }

  /** Marca en la escena los tornillos que el paso actual pide tocar. En modo
   * abierto (practica libre/evaluacion, sin secuencia fija) no hay "paso
   * actual": se marcan los de la pieza que sigue atornillada y accesible. */
  function refreshScrewHighlight() {
    const ctl = screws();
    if (!ctl || !ctl.setHighlight) return;
    if (isLearn || !session) {
      ctl.setHighlight(null, "remove");
      return;
    }
    const step = Engine().currentStep(session);
    if (session.kind === "guided" && step && step.kind === "action") {
      const removing = step.action === "remove" || step.action === "disconnect";
      ctl.setHighlight(step.partId, removing ? "remove" : "install");
      return;
    }
    // Abierto: la primera pieza con tornillos que se pueda operar ahora.
    const ids = Object.keys(equipmentData.parts).filter((id) => ctl.hasScrews(id));
    const candidate = ids.find((id) => {
      const present = session.parts[id] !== false;
      const action = present ? "remove" : "install";
      if (present && ctl.pendingRemoval(id) === 0) return false;
      if (!present) return false;
      return canOperateScrewPart(id, action).ok;
    });
    ctl.setHighlight(candidate || null, "remove");
  }

  /** Estado de los tornillos de una pieza, en el panel del paso actual. */
  function screwStatusHtml(partId, action) {
    const ctl = screws();
    if (!ctl || !ctl.hasScrews(partId)) return "";
    const total = ctl.forPart(partId).length;
    const removing = action === "remove" || action === "disconnect";
    const done = removing ? total - ctl.pendingRemoval(partId) : total - ctl.pendingInstall(partId);
    const verb = removing ? "retirados" : "colocados";
    const complete = done >= total;
    return (
      `<p class="hwlab-muted">Tornillos ${esc(verb)}: <strong>${done} de ${total}</strong>` +
      (complete ? " &#9989;" : " &mdash; haz clic sobre cada tornillo en la escena") +
      "</p>"
    );
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const payload = Engine().serialize(session);
      const screwCtl = screws();
      if (screwCtl) payload.screws = screwCtl.getState();
      Storage().persist(equipmentId, storageMode, payload);
    }, 500);
  }

  function maybeFinish() {
    if (!Engine().isFinished(session)) return;
    // Item 11: un equipo con tornillos sueltos NO esta armado. El motor no
    // conoce los tornillos (es agnostico del equipo), asi que el cierre de la
    // practica se retiene aqui hasta que todos esten colocados.
    const pendiente = partWithPendingScrews(null);
    if (pendiente) {
      const p = getPart(pendiente);
      stage.showFeedback(
        "Ya colocaste todas las piezas, pero falta asegurar " + (p ? p.name : pendiente) +
          " con sus tornillos para terminar.",
        "info"
      );
      return;
    }
    // Ensamble: el equipo termina como empezo -- derecho y abierto (pose
    // inicial aprobada). No se castiga: solo se retiene el cierre.
    if (hasPose() && isAssemblyPractice() && !rig3d().isAtPreset("open")) {
      stage.showFeedback("Ya esta armado: vuelve a ponerlo derecho y abre la pantalla para terminar (\"Dejar el portatil abierto\").", "info");
      renderInfoPanel();
      return;
    }
    stage.stopTimer();
    const finished = Engine().finish(session);
    session = finished;
    persist();
    stage.openResultModal(finished.result, {
      onRetry: () => {
        session = Engine().createSession(equipmentData, engineMode, { maxHints: session.hints.max });
        neededPreset = null;
        resetPose();
        stage.currentRig.syncFromSessionParts(session.parts);
        setupScrews(session.parts, { assembly: isAssemblyPractice() });
        stage.startTimer(session.startedAt);
        stage.clearActionLog();
        renderInfoPanel();
        refreshStats();
      },
      onMenu: backToIntro,
    });
  }

  function backToIntro() {
    stage.stopTimer();
    stage.hideStage();
  }

  return { start };
}
