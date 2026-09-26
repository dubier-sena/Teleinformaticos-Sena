/* js/hardware_lab_thermal.js
 *
 * Mantenimiento termico del portatil (auditoria sep-26): estado PURO del polvo
 * del modulo de refrigeracion y de la pasta termica entre el procesador y el
 * bloque de cobre. Sin DOM ni three.js: lo usan el controlador 3D (reglas,
 * panel, resultado) y los tests de Node.
 *
 *   Polvo:  sucio --brocha--> suelto --aire--> limpio
 *   Pasta:  vieja --retirar el grueso--> residuo --alcohol--> limpia
 *           limpia --aplicar(cantidad)--> nueva (insuficiente|adecuada|excesiva)
 *           nueva (mal dosificada) --alcohol--> limpia (se vuelve a aplicar)
 *
 * El modulo de refrigeracion solo se reinstala con pasta nueva en cantidad
 * adecuada: sin pasta, con poca o con residuos queda aire entre el die y el
 * cobre; con demasiada se derrama sobre los componentes del sustrato.
 * Textos propios del portal.
 */
(function (root) {
  "use strict";

  var AMOUNTS = {
    insuficiente: {
      label: "Punto muy pequeño",
      result: "Cantidad insuficiente: no cubre el die y quedan zonas con aire, que conduce muy mal el calor.",
    },
    adecuada: {
      label: "Grano de arroz en el centro",
      result: "Cantidad adecuada: al apretar el disipador se reparte en una capa fina que cubre todo el die.",
    },
    excesiva: {
      label: "Capa gruesa que cubre todo",
      result: "Cantidad excesiva: al apretar el disipador rebosa por los bordes y ensucia los componentes del sustrato.",
    },
  };

  var TASKS = {
    brush: {
      id: "brush",
      label: "Aflojar el polvo con la brocha",
      tool: "antistatic-brush",
      target: "cooler",
    },
    air: {
      id: "air",
      label: "Soplar aletas y ventilador con aire comprimido",
      tool: "compressed-air",
      target: "cooler",
    },
    scrape: {
      id: "scrape",
      label: "Retirar el grueso de la pasta vieja",
      tool: "spudger",
      target: "paste",
    },
    alcohol: {
      id: "alcohol",
      label: "Limpiar con alcohol isopropilico",
      tool: "isopropyl-alcohol",
      target: "paste",
    },
    apply: {
      id: "apply",
      label: "Aplicar pasta termica nueva",
      tool: "thermal-paste",
      target: "paste",
    },
  };

  var DUST_LABELS = { dirty: "Con polvo acumulado", loose: "Polvo suelto", clean: "Limpio" };
  var PASTE_LABELS = { old: "Pasta vieja y reseca", residue: "Restos de pasta", clean: "Superficie limpia, sin pasta", new: "Pasta nueva" };

  /** "used": equipo con uso (polvo y pasta reseca). "new": piezas nuevas, sin pasta aplicada. */
  function createThermalState(kind) {
    if (kind === "new") return { dust: "clean", paste: "clean", amount: null, mistakes: 0 };
    return { dust: "dirty", paste: "old", amount: null, mistakes: 0 };
  }

  function normalize(state) {
    var s = state && typeof state === "object" ? state : {};
    return {
      dust: DUST_LABELS[s.dust] ? s.dust : "dirty",
      paste: PASTE_LABELS[s.paste] ? s.paste : "old",
      amount: s.paste === "new" && AMOUNTS[s.amount] ? s.amount : null,
      mistakes: Number(s.mistakes) > 0 ? Number(s.mistakes) : 0,
    };
  }

  /** Donde se puede hacer el mantenimiento: con el modulo FUERA del equipo.
   *  La pasta se trabaja sobre el die, asi que ademas el CPU debe estar puesto. */
  function accessFor(task, ctx) {
    if (ctx.coolerInstalled) {
      return { ok: false, reason: "Primero retira el módulo de refrigeración: el polvo de las aletas y la pasta térmica solo se alcanzan con el módulo fuera." };
    }
    if (task.target === "paste" && !ctx.cpuInstalled) {
      return { ok: false, reason: "La pasta térmica se trabaja sobre el procesador instalado en la placa." };
    }
    return { ok: true };
  }

  function result(ok, state, message, level) {
    return { ok: ok, state: state, message: message, level: level || (ok ? "success" : "info") };
  }

  function withMistake(state) {
    return Object.assign({}, state, { mistakes: state.mistakes + 1 });
  }

  /**
   * Aplica una tarea. ctx = { coolerInstalled, cpuInstalled }; opts.amount
   * para "apply". Un orden incorrecto NO cambia el estado: explica por que.
   */
  function applyTask(state, taskId, ctx, opts) {
    var s = normalize(state);
    var task = TASKS[taskId];
    if (!task) return result(false, s, "Tarea de mantenimiento no reconocida.", "error");
    var access = accessFor(task, ctx || {});
    if (!access.ok) return result(false, s, access.reason, "info");

    if (taskId === "brush") {
      if (s.dust !== "dirty") return result(false, s, "No queda polvo adherido que aflojar.", "info");
      return result(true, Object.assign({}, s, { dust: "loose" }), "Polvo aflojado entre las aletas y los álabes. Ahora retíralo con aire comprimido.");
    }
    if (taskId === "air") {
      if (s.dust === "clean") return result(false, s, "Las aletas y el ventilador ya están limpios.", "info");
      if (s.dust === "dirty") {
        return result(false, withMistake(s), "El polvo compactado entre las aletas no sale solo con aire: aflójalo antes con la brocha.", "error");
      }
      return result(true, Object.assign({}, s, { dust: "clean" }), "Aletas y ventilador limpios: el aire vuelve a circular por el disipador.");
    }
    if (taskId === "scrape") {
      if (s.paste !== "old") return result(false, s, "No queda pasta reseca gruesa por retirar.", "info");
      return result(true, Object.assign({}, s, { paste: "residue" }), "Retirado el grueso de la pasta vieja. Quedan restos: límpialos con alcohol isopropílico.");
    }
    if (taskId === "alcohol") {
      if (s.paste === "old") {
        return result(false, withMistake(s), "La pasta reseca no se disuelve con alcohol: retira antes el grueso con la herramienta plástica.", "error");
      }
      if (s.paste === "clean") return result(false, s, "El die y el bloque de cobre ya están limpios.", "info");
      if (s.paste === "new" && s.amount === "adecuada") {
        return result(false, s, "La pasta nueva ya está bien aplicada; no hace falta retirarla.", "info");
      }
      var redo = s.paste === "new";
      return result(
        true,
        Object.assign({}, s, { paste: "clean", amount: null }),
        redo
          ? "Pasta mal dosificada retirada. Deja evaporar el alcohol y vuelve a aplicar."
          : "Die y bloque de cobre limpios, sin restos de pasta. Deja evaporar el alcohol antes de aplicar pasta nueva."
      );
    }
    // apply
    var amount = opts && opts.amount;
    if (!AMOUNTS[amount]) return result(false, s, "Elige cuánta pasta aplicar.", "info");
    if (s.paste === "old" || s.paste === "residue") {
      return result(false, withMistake(s), "Nunca apliques pasta nueva sobre restos de la vieja: limpia primero el die por completo.", "error");
    }
    if (s.paste === "new") return result(false, s, "Ya hay pasta aplicada. Si la cantidad no es correcta, límpiala con alcohol y aplica de nuevo.", "info");
    var next = Object.assign({}, s, { paste: "new", amount: amount });
    if (amount !== "adecuada") next.mistakes = s.mistakes + 1;
    return result(amount === "adecuada", next, AMOUNTS[amount].result, amount === "adecuada" ? "success" : "error");
  }

  /** ¿Se puede montar el modulo de refrigeracion con la pasta actual? */
  function coolerInstallGate(state) {
    var s = normalize(state);
    if (s.paste === "new" && s.amount === "adecuada") return { ok: true };
    var reason;
    if (s.paste === "old" || s.paste === "residue") {
      reason = "Aún quedan restos de la pasta vieja: límpialos (herramienta plástica y alcohol isopropílico) y aplica pasta nueva antes de montar el disipador.";
    } else if (s.paste === "clean") {
      reason = "El procesador no tiene pasta térmica: sin ella queda aire entre el die y el cobre y el equipo se sobrecalienta. Aplica pasta antes de montar el disipador.";
    } else if (s.amount === "insuficiente") {
      reason = "Hay muy poca pasta: no cubriría el die. Límpiala con alcohol y aplica la cantidad adecuada.";
    } else {
      reason = "Hay demasiada pasta: rebosaría por los bordes. Límpiala con alcohol y aplica la cantidad adecuada.";
    }
    return { ok: false, reason: reason };
  }

  /** Estado que se muestra en el panel. */
  function describe(state) {
    var s = normalize(state);
    return {
      dust: DUST_LABELS[s.dust],
      paste: PASTE_LABELS[s.paste] + (s.paste === "new" && s.amount ? " (" + s.amount + ")" : ""),
      dustClean: s.dust === "clean",
      pasteReady: s.paste === "new" && s.amount === "adecuada",
    };
  }

  var api = {
    AMOUNTS: AMOUNTS,
    TASKS: TASKS,
    createThermalState: createThermalState,
    normalize: normalize,
    applyTask: applyTask,
    coolerInstallGate: coolerInstallGate,
    describe: describe,
  };

  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.Thermal = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
