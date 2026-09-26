/* js/hardware_lab_equipment_check.js
 *
 * "COMPROBACION DEL EQUIPO" al terminar una practica (auditoria sep-26).
 * Funcion PURA: recibe el estado REAL de la practica (piezas, tornillos, estado
 * termico, posicion) y devuelve que se comprobo y con que resultado. No
 * inventa nada que el laboratorio no haya medido: una comprobacion sin datos
 * (p. ej. el termico en el escritorio) simplemente no aparece.
 */
(function (root) {
  "use strict";

  function item(label, status, detail) {
    return { label: label, status: status, detail: detail };
  }

  /**
   * input = {
   *   direction: "assembly" | "maintenance" | "disassembly",
   *   parts: { id: presente },            partNames: { id: nombre },
   *   pendingScrewPart: id | null,        // pieza puesta con tornillos por colocar
   *   screwsLoose: numero | null,         // (desensamble) tornillos fuera de la bandeja
   *   thermal: estado de hardware_lab_thermal.js | null,
   *   poseOk: true | false | null,        // portatil derecho y abierto
   * }
   */
  function equipmentCheck(input) {
    var inp = input || {};
    var parts = inp.parts || {};
    var names = inp.partNames || {};
    var ids = Object.keys(parts);
    var items = [];

    if (inp.direction === "disassembly") {
      var left = ids.filter(function (id) { return parts[id]; });
      items.push(
        left.length
          ? item("Piezas retiradas", "fail", "Siguen en el equipo: " + left.map(function (id) { return names[id] || id; }).join(", ") + ".")
          : item("Piezas retiradas", "ok", "Todas las piezas están fuera y ordenadas en la bandeja.")
      );
      if (inp.screwsLoose != null) {
        items.push(
          inp.screwsLoose > 0
            ? item("Tornillos", "warn", inp.screwsLoose + " tornillo(s) fuera de la bandeja magnética.")
            : item("Tornillos", "ok", "Todos los tornillos están en la bandeja magnética.")
        );
      }
      if (inp.thermal && inp.thermal.paste === "old") {
        items.push(item("Pasta térmica", "warn", "El procesador quedó con la pasta vieja: límpiala antes de guardarlo o reutilizarlo."));
      }
    } else {
      var missing = ids.filter(function (id) { return !parts[id]; });
      items.push(
        missing.length
          ? item("Piezas y cables", "fail", "Falta instalar o conectar: " + missing.map(function (id) { return names[id] || id; }).join(", ") + ".")
          : item("Piezas y cables", "ok", "Todas las piezas instaladas y todos los cables conectados.")
      );
      items.push(
        inp.pendingScrewPart
          ? item("Tornillos", "fail", (names[inp.pendingScrewPart] || inp.pendingScrewPart) + " no está asegurada con sus tornillos.")
          : item("Tornillos", "ok", "Todas las piezas atornilladas quedaron aseguradas.")
      );
      if (inp.thermal) {
        var t = inp.thermal;
        if (t.paste === "new" && t.amount === "adecuada") {
          items.push(item("Pasta térmica", "ok", "Capa fina y uniforme entre el procesador y el disipador: el calor se transfiere bien."));
        } else {
          items.push(item("Pasta térmica", "fail", "La interfaz térmica no es correcta: el procesador se sobrecalentará y el equipo bajará su rendimiento o se apagará."));
        }
        items.push(
          t.dust === "clean"
            ? item("Aletas y ventilador", "ok", "Sin polvo: el aire circula y el ventilador gira sin esfuerzo.")
            : item("Aletas y ventilador", "warn", "Con polvo: temperaturas más altas y ventilador más ruidoso.")
        );
        if (t.mistakes > 0) {
          items.push(item("Procedimiento de mantenimiento", "warn", t.mistakes + " paso(s) hechos fuera de orden o con la cantidad equivocada (corregidos)."));
        }
      }
      if (inp.poseOk != null) {
        items.push(
          inp.poseOk
            ? item("Posición final", "ok", "El portátil quedó derecho y con la pantalla abierta.")
            : item("Posición final", "warn", "El portátil no quedó derecho y abierto.")
        );
      }
    }

    var fails = items.filter(function (i) { return i.status === "fail"; }).length;
    var warns = items.filter(function (i) { return i.status === "warn"; }).length;
    var verdict;
    if (inp.direction === "disassembly") {
      verdict = fails ? { status: "fail", text: "El desensamble no está completo." } : { status: warns ? "warn" : "ok", text: warns ? "Desensamble completo, con observaciones." : "Desensamble completo y ordenado." };
    } else if (fails) {
      verdict = { status: "fail", text: "El equipo NO está listo para encender." };
    } else if (warns) {
      verdict = { status: "warn", text: "El equipo enciende, pero hay observaciones que conviene corregir." };
    } else {
      verdict = { status: "ok", text: "Equipo listo: enciende y trabaja con temperaturas normales." };
    }
    return { items: items, verdict: verdict };
  }

  var api = { equipmentCheck: equipmentCheck };
  root.HardwareLab = root.HardwareLab || {};
  root.HardwareLab.EquipmentCheck = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
