// Fase "Laboratorio Virtual 3D: pulido pedagogico" (2026-09-08).
//
// Bug real encontrado con clic real (no con automatizacion fallando): la
// Memoria RAM del escritorio era IMPOSIBLE de seleccionar en el escenario
// 3D, sin importar el angulo de camara probado (Lateral, superior, enfoque
// directo con focusOnObject). Confirmado con Box3 en vivo:
//
//   coolerBox.containsBox(ramBox) === true
//
// Causa raiz: buildTowerCooler (js/hardware_lab_3d_parts_factory.js) crea
// una torre ancha (width 0.13) que, tras rotationEuler:[0,PI/2,0] en
// hardware_lab_3d_layout_desktop.js, proyecta su dimension ancha hacia el
// eje Z del motherboard -- exactamente hacia las ranuras de RAM MAS
// CERCANAS al zocalo del CPU (ramSlots[0]/[1], ver buildMotherboard en
// hardware_lab_3d_chassis_factory.js: slotZ = socketPos.z + 0.045 + i*0.017).
// El resultado: cualquier rayo de clic apuntado a la RAM impactaba primero
// la geometria (mas grande y mas cercana a la camara desde cualquier lado)
// del cooler.
//
// Fix: el modulo de RAM removible ahora monta en ramSlots[2]/[3] (las 2
// ranuras MAS LEJANAS del zocalo) en vez de ramSlots[0]/[1]. Las 4 ranuras
// del motherboard se siguen dibujando siempre (buildMotherboard no cambio),
// asi que esto no altera nada visualmente salvo en cual par ocupa el modulo
// instalable -- y aleja lo suficiente el bounding box de la RAM del cooler
// para que quede clickeable (confirmado en vivo: coolerBox.containsBox(ramBox)
// paso a false, y la pieza abre su ficha tecnica y responde a desmontaje real
// tras el cambio).
//
// Este test es estructural (no instancia Three.js real, ver convencion ya
// establecida en tests/hardware_lab_3d_camera_focus_clip.test.cjs para el
// mismo tipo de logica dificil de simular sin un canvas real): verifica que
// el mount de "ram" en el layout de escritorio siga usando las ranuras
// lejanas (2/3), no las cercanas al cooler (0/1). Si alguien revierte este
// indice "para simplificar", este test debe fallar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("el modulo de RAM removible del escritorio monta en las ranuras 2/3 (lejanas del cooler), no en 0/1", () => {
  const src = read("js/hardware_lab_3d_layout_desktop.js");
  const start = src.indexOf("ram: {");
  assert.notEqual(start, -1, "no se encontro la entrada 'ram' en el layout de escritorio");
  const end = src.indexOf("ssd: {", start);
  assert.notEqual(end, -1, "no se encontro el limite de la entrada 'ram' (siguiente componente 'ssd')");
  const ramEntry = src.slice(start, end);

  assert.match(
    ramEntry,
    /ramSlots\[2\]\.clone\(\)\.lerp\(a\.motherboard\.ramSlots\[3\]/,
    "el mount de RAM debe usar ramSlots[2]/[3] (las ranuras mas lejanas del zocalo del CPU) -- " +
      "usar ramSlots[0]/[1] reintroduce el bug real donde el bounding box de buildTowerCooler " +
      "(ancho 0.13, rotado 90 grados) contiene completo al de la RAM y la deja imposible de " +
      "seleccionar con clic desde cualquier angulo de camara"
  );
  assert.doesNotMatch(
    ramEntry,
    /ramSlots\[0\]\.clone\(\)\.lerp\(a\.motherboard\.ramSlots\[1\]/,
    "el mount de RAM NO debe volver a usar ramSlots[0]/[1] -- esas son las ranuras mas cercanas " +
      "al cooler, geometricamente contenidas dentro de su bounding box"
  );
});
