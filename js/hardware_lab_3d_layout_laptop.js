/* js/hardware_lab_3d_layout_laptop.js
 *
 * Layout 3D del portatil: mapea cada id REAL de pieza de
 * js/hardware_lab_data_laptop.js (18 piezas) a una posicion/geometria del
 * motor generico hardware_lab_3d_rig.js. Mismo espiritu que
 * hardware_lab_3d_layout_desktop.js. Piezas sin modelo dedicado (modulo de
 * refrigeracion compacto, tarjeta Wi-Fi) usan kind:"generic" con
 * proporciones realistas (item 30: geometria primero, GLB despues). Teclado
 * y touchpad SI tienen modelo propio (buildLaptopKeyboard/buildLaptopTouchpad
 * en hardware_lab_3d_chassis_factory.js): son piezas grandes que de otro
 * modo tapan visualmente todo lo que hay debajo al desmontarlas.
 */
import * as THREE from "./vendor/three.module.min.js";
import {
  buildLaptopBase,
  buildLaptopBottomCover,
  buildLaptopLid,
  buildLaptopMotherboard,
} from "./hardware_lab_3d_chassis_factory.js";

const AXIS_X = [1, 0, 0];
const AXIS_Y = [0, 1, 0];
const AXIS_NEG_Y = [0, -1, 0];

export function createLaptopLayout() {
  let baseDims = null;

  const structure = [
    {
      id: "base",
      build: () => {
        const built = buildLaptopBase();
        baseDims = built.dims;
        return built;
      },
      mount: () => new THREE.Vector3(0, 0, 0),
    },
    {
      id: "motherboard",
      partId: "motherboard",
      tier: 0,
      build: () => buildLaptopMotherboard(),
      mount: (a) => a.base.motherboardOrigin,
    },
    {
      id: "bottom-cover-chassis",
      partId: "bottom-cover",
      tier: 3,
      build: () => buildLaptopBottomCover(baseDims),
      mount: (a) => a.base.bottomCoverCenter.clone().add(new THREE.Vector3(0, -0.004, 0)),
      detachAxis: AXIS_NEG_Y, // se desliza hacia abajo, no hacia arriba (item 4).
    },
    {
      id: "screen-lid",
      partId: "screen-assembly",
      tier: 2,
      build: () => buildLaptopLid({ width: baseDims ? baseDims.width : 0.33 }),
      // Pose abierta: el origen local de buildLaptopLid AHORA es el propio
      // eje de la bisagra (mejora 3D, ver el comentario en buildLaptopLid),
      // asi que se monta directo en hingeLine -- el offset manual que habia
      // antes (0,0.135,-0.03) era un parche para compensar un pivote mal
      // ubicado; con el pivote corregido ya no hace falta.
      mount: (a) => a.base.hingeLine.clone(),
      rotationEuler: [-1.85, 0, 0],
    },
  ];

  const mbOf = (a) => a.motherboard;

  const components = {
    ram: {
      kind: "ram-module",
      buildOpts: { count: 1, stickOpts: { width: 0.066, bodyHeight: 0.02 } },
      mount: (a) => mbOf(a).ramSlot.clone(),
      // Rotada 90 grados en X (correccion visual, sep-2026): buildRamStick
      // autora el modulo como un DIMM de escritorio de pie (su dimension
      // "alta", bodyHeight, se extiende en Y). Sin rotar, esa altura
      // atravesaba el piso Y el techo de la bandeja del portatil por igual.
      // Un SO-DIMM real de portatil va acostado, paralelo a la placa: rotar
      // en X deja la cara delgada (grosor de la placa PCB) en Y y la
      // dimension larga (bodyHeight) acostada en Z, igual que en el equipo
      // real.
      rotationEuler: [Math.PI / 2, 0, 0],
      detachAxis: AXIS_Y,
      tier: 1,
    },
    "ssd-m2": {
      kind: "m2-ssd",
      buildOpts: { width: 0.017, length: 0.06 },
      mount: (a) => mbOf(a).m2Slot.clone(),
      detachAxis: AXIS_Y,
      tier: 1,
    },
    "wifi-card": {
      kind: "generic",
      // hitPadding (mejora 3D, item 6): 3mm de alto es la pieza mas fina de
      // "generic" en todo el laboratorio, similar al caso ya resuelto de
      // buildM2 -- misma solucion (proxy invisible mas grande).
      buildOpts: { width: 0.03, height: 0.003, depth: 0.018, materialKind: "pcbBlue", hitPadding: 0.014 },
      mount: (a) => mbOf(a).wifiSlot.clone(),
      detachAxis: AXIS_Y,
      tier: 1,
    },
    cpu: {
      kind: "cpu",
      buildOpts: { size: 0.032 },
      mount: (a) => mbOf(a).cpuSocket.clone(),
      detachAxis: AXIS_Y,
      tier: 0,
    },
    cooler: {
      // Antes "generic" (caja lisa de un solo color, materialKind:
      // "heatsinkFin"): ver buildLaptopCooler para el motivo del cambio
      // (mejora 3D).
      kind: "laptop-cooler",
      buildOpts: { width: 0.02, height: 0.006, depth: 0.11 },
      mount: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.005, 0.03)),
      detachAxis: AXIS_Y,
      tier: 1,
    },
    keyboard: {
      // Pieza real (deck + rejilla de teclas), no una caja generica: antes
      // esta era una caja invisible superpuesta a un teclado visual que
      // vivia baked en el chasis y nunca se podia retirar de verdad.
      kind: "laptop-keyboard",
      mount: (a) => a.base.keyboardMount.clone(),
      detachAxis: AXIS_Y,
      tier: 2,
    },
    touchpad: {
      kind: "laptop-touchpad",
      mount: (a) => a.base.touchpadMount.clone(),
      detachAxis: AXIS_Y,
      tier: 2,
    },
    battery: {
      kind: "generic",
      buildOpts: { width: 0.2, height: 0.006, depth: 0.09, materialKind: "batteryCell" },
      mount: (a) => a.base.batteryBay.clone(),
      detachAxis: AXIS_NEG_Y,
      tier: 1,
    },
    // sag: 0.004 en los 7 cables de abajo (correccion visual, sep-2026):
    // buildCable() (hardware_lab_3d_parts_factory.js) usa sag=0.03 (30mm)
    // por defecto -- pensado para el hueco grande de un gabinete de
    // escritorio. La cavidad real del portatil, tras hacer hueca la base
    // (buildLaptopBase), mide ~12mm de alto: con el sag por defecto, el
    // punto medio de CUALQUIER cable caia muy por debajo del piso de la
    // bandeja, atravesandolo. 4mm de combado es visible (no queda tieso)
    // sin cruzar piso ni paredes. No toca "radius" (grosor visible) ni el
    // hitbox invisible de buildCable(), ambos ajenos a "sag".
    "cable-battery": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.base.batteryBay.clone().add(new THREE.Vector3(0.06, 0.006, 0)),
      to: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0.03, 0, 0)),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-cpu-fan-laptop": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.004, 0.02)),
      to: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.008, 0.07)),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-keyboard-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(-0.05, 0, -0.02)),
      to: () => new THREE.Vector3(0, 0.02, -0.02),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-touchpad-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(-0.05, 0, 0.02)),
      to: () => new THREE.Vector3(0, 0.017, 0.06),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-screen-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0.05, 0, -0.04)),
      to: (a) => a.base.hingeLine.clone(),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "wifi-antenna-1": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).wifiSlot.clone().add(new THREE.Vector3(-0.01, 0.002, 0)),
      to: (a) => a.base.hingeLine.clone().add(new THREE.Vector3(-0.1, 0.05, 0)),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "wifi-antenna-2": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).wifiSlot.clone().add(new THREE.Vector3(0.01, 0.002, 0)),
      to: (a) => a.base.hingeLine.clone().add(new THREE.Vector3(0.1, 0.05, 0)),
      buildOpts: { sag: 0.004 },
      detachAxis: AXIS_Y,
      tier: 3,
    },
  };

  return { structure, components };
}
