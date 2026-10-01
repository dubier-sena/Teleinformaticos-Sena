/* js/hardware_lab_guidance.js
 *
 * Orientacion al aprendiz del Laboratorio Virtual de Hardware (LOOP portatil,
 * Fase D, 2026-10-01). Funciones PURAS: reciben un resumen del estado y
 * devuelven texto. No conocen three.js, el DOM ni el motor, para poder
 * probarlas en Node.
 *
 * Por que existe (medido con clic real antes de esta fase):
 *  - El boton de los 5 pasos de seguridad decia siempre "Confirmar paso".
 *  - La pista de las practicas gastaba una pista (-3 puntos) y mostraba un
 *    aviso VACIO: el motor no devolvia texto y nadie lo construia.
 *  - En el diagnostico no habia "paso actual": solo el sintoma y un boton.
 *
 * Tres piezas:
 *  - safetyConfirmLabel(step): el boton dice QUE se confirma.
 *  - whatToDo(ctx): "¿Que debo hacer?" -- gratis, explica que espera la
 *    interfaz ahora. En los modos sin guia NUNCA revela la pieza que sigue.
 *  - practiceHint(ctx) / diagnosisPhase(ctx): contenido real de la pista y
 *    fase actual del diagnostico (observar, diagnosticar, reparar, comprobar).
 */
(function (root) {
  "use strict";

  function lower(text) {
    return String(text || "").toLowerCase();
  }

  function plural(n, one, many) {
    return n === 1 ? one : many.replace("{n}", String(n));
  }

  /** Texto del boton que confirma un paso de seguridad o de verificacion. */
  function safetyConfirmLabel(step) {
    if (step && step.confirmLabel) return step.confirmLabel;
    var title = step && step.title ? String(step.title) : "";
    return title ? "Hecho: " + lower(title) : "Confirmar paso";
  }

  /**
   * "¿Que debo hacer?" de una practica (desensamble, ensamble, mantenimiento).
   * @param {object} ctx
   *   mode: "guided" | "open" | "learn"
   *   finished: boolean
   *   safety: { title, confirmLabel } | null        paso de seguridad actual
   *   pose: { label } | null                        falta colocar el equipo
   *   pendingInstall: { partName, n } | null        tornillos por colocar de una pieza ya puesta
   *   thermalRequired: boolean                      mantenimiento termico obligatorio ahora
   *   target: { partName, verb, screws: n, tool } | null   paso guiado
   *   hintsLeft: number                             pistas que quedan (0 en la evaluacion)
   */
  function whatToDo(ctx) {
    ctx = ctx || {};
    if (ctx.mode === "learn") {
      return "Explora con calma: gira el equipo arrastrando y toca cualquier pieza para ver su ficha técnica. Aquí no hay puntuación.";
    }
    if (ctx.finished) return "La práctica ya terminó. Revisa tu resultado o pulsa «Reiniciar» para repetirla.";
    if (ctx.safety) {
      return "Lee el paso «" + ctx.safety.title + "» en la tarjeta y, cuando lo hayas hecho, pulsa el botón verde «" + ctx.safety.confirmLabel + "». No hay que tocar el equipo en este paso.";
    }
    if (ctx.pendingInstall) {
      return "Asegura " + ctx.pendingInstall.partName + ": toca cada tornillo marcado con un aro para colocarlo (" +
        plural(ctx.pendingInstall.n, "falta 1", "faltan {n}") + ")." + (ctx.pose ? " Antes pulsa «" + ctx.pose.label + "» para alcanzarlos." : "");
    }
    if (ctx.thermalRequired) {
      return "Completa el mantenimiento de la refrigeración con los botones de la tarjeta: limpia el polvo, retira la pasta vieja y aplica pasta nueva en la cantidad correcta.";
    }
    if (ctx.mode === "guided" && ctx.target) {
      var t = ctx.target;
      if (ctx.pose) return "Primero pulsa «" + ctx.pose.label + "» en la tarjeta: así el equipo queda en la posición correcta para " + t.verb + " " + t.partName + ".";
      if (t.screws > 0) {
        return "Toca cada tornillo marcado con un aro en " + t.partName + " (" + plural(t.screws, "queda 1", "quedan {n}") +
          "). Cuando no quede ninguno, toca " + t.partName + " para " + t.verb + " esa pieza.";
      }
      return "Toca " + t.partName + " en el equipo para " + t.verb + " esa pieza" + (t.tool ? " (herramienta: " + t.tool + ")" : "") + ". Si no la ves, pulsa «Ayuda» otra vez y te la muestro.";
    }
    if (ctx.pose) return "Pulsa «" + ctx.pose.label + "» en la tarjeta para colocar el equipo en posición de trabajo.";
    // Practica libre / evaluacion: se explica COMO actuar, no QUE pieza sigue.
    return "Decide tú qué pieza sigue según el procedimiento y tócala en el equipo. Si tiene tornillos, toca primero cada tornillo. " +
      (ctx.hintsLeft > 0
        ? "Si necesitas que te indique la pieza, usa una pista (el botón de la bombilla): resta 3 puntos."
        : "Aquí no hay pistas: aplica el orden que practicaste en el modo guiado.");
  }

  /**
   * Contenido de una pista de practica (cuesta lo mismo que siempre).
   * @param {object} ctx  { mode, safety, target: { partName, verb, where, tool, screws, missing: [nombres] } }
   */
  function practiceHint(ctx) {
    ctx = ctx || {};
    if (ctx.safety) {
      return "Pista: este paso no se hace sobre el equipo. Léelo y pulsa «" + ctx.safety.confirmLabel + "» en la tarjeta.";
    }
    var t = ctx.target;
    if (!t) return "Pista: no hay una pieza pendiente ahora. Revisa la tarjeta de instrucciones.";
    var text = "Pista: lo que sigue es " + t.verb + " " + t.partName + ".";
    if (t.where) text += " Ubicación: " + t.where.replace(/\.$/, "") + ".";
    if (t.missing && t.missing.length) text += " Antes hay que retirar o desconectar: " + t.missing.join(", ") + ".";
    if (t.screws > 0) text += " Tiene " + plural(t.screws, "1 tornillo pendiente", "{n} tornillos pendientes") + ": toca cada uno.";
    if (t.tool) text += " Herramienta: " + t.tool + ".";
    return text + " Te la enfoco en la escena.";
  }

  var DIAGNOSIS_PHASES = [
    { id: "observar", label: "Observar" },
    { id: "diagnosticar", label: "Diagnosticar" },
    { id: "reparar", label: "Reparar" },
    { id: "comprobar", label: "Comprobar" },
  ];

  /**
   * Fase actual de un caso de diagnostico.
   * @param {object} ctx
   *   checks: numero de veces que se pulso "Encender y comprobar"
   *   actionsSinceCheck: acciones sobre el equipo desde la ultima comprobacion
   *   actions: acciones sobre el equipo en total
   *   fixed: boolean
   * @returns {{ id, index, label, text, phases }}
   */
  function diagnosisPhase(ctx) {
    ctx = ctx || {};
    var id;
    var text;
    if (ctx.fixed) {
      id = "comprobar";
      text = "Falla corregida y comprobada. Revisa el repaso del caso.";
    } else if (!ctx.checks && !ctx.actions) {
      id = "observar";
      text = "Lee el síntoma y pulsa «Encender y comprobar» para ver cómo falla el equipo.";
    } else if (!ctx.actions) {
      id = "diagnosticar";
      text = "Piensa qué piezas pueden causar ese síntoma. Abre el equipo y revisa primero la más probable.";
    } else if (ctx.actionsSinceCheck > 0) {
      id = "comprobar";
      text = "Cuando el equipo esté armado de nuevo, pulsa «Encender y comprobar» para verificar si la falla quedó corregida.";
    } else {
      id = "reparar";
      text = "La falla sigue. Revisa otra pieza relacionada con el síntoma: reasienta, reconecta, limpia o reemplaza según lo que encuentres.";
    }
    var index = 0;
    for (var i = 0; i < DIAGNOSIS_PHASES.length; i++) if (DIAGNOSIS_PHASES[i].id === id) index = i;
    return { id: id, index: index, label: DIAGNOSIS_PHASES[index].label, text: text, phases: DIAGNOSIS_PHASES };
  }

  /** "¿Que debo hacer?" de un caso de diagnostico. */
  function whatToDoDiagnosis(ctx) {
    ctx = ctx || {};
    if (ctx.pose) return "Pulsa «" + ctx.pose.label + "» en la tarjeta para colocar el equipo en posición de trabajo.";
    var phase = diagnosisPhase(ctx);
    var how = " Para actuar sobre una pieza, tócala en el equipo; si tiene tornillos, toca primero cada tornillo.";
    return "Fase " + (phase.index + 1) + " de " + DIAGNOSIS_PHASES.length + " · " + phase.label + ": " + phase.text + (phase.id === "observar" || ctx.fixed ? "" : how);
  }

  var api = {
    safetyConfirmLabel: safetyConfirmLabel,
    whatToDo: whatToDo,
    practiceHint: practiceHint,
    diagnosisPhase: diagnosisPhase,
    whatToDoDiagnosis: whatToDoDiagnosis,
    DIAGNOSIS_PHASES: DIAGNOSIS_PHASES,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Guidance = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
