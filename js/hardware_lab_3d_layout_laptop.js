/* js/hardware_lab_3d_layout_laptop.js
 *
 * Layout 3D del portatil: mapea cada id REAL de pieza de
 * js/hardware_lab_data_laptop.js (18 piezas) a una posicion/geometria del
 * motor generico hardware_lab_3d_rig.js. Mismo espiritu que
 * hardware_lab_3d_layout_desktop.js. Piezas sin modelo dedicado (teclado,
 * touchpad, modulo de refrigeracion compacto) usan kind:"generic" con
 * proporciones realistas (item 30: geometria primero, GLB despues).
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
    },
    {
      id: "screen-lid",
      partId: "screen-assembly",
      tier: 2,
      build: () => buildLaptopLid({ width: baseDims ? baseDims.width : 0.33 }),
      // Pose abierta aproximada (bisagra real requeriria un grupo pivote
      // dedicado; para una primera version basta con la inclinacion visual).
      mount: (a) => a.base.hingeLine.clone().add(new THREE.Vector3(0, 0.135, -0.03)),
      rotationEuler: [-1.85, 0, 0],
    },
  ];

  const mbOf = (a) => a.motherboard;

  const components = {
    ram: {
      kind: "ram-module",
      buildOpts: { count: 1, stickOpts: { width: 0.066, bodyHeight: 0.02 } },
      mount: (a) => mbOf(a).ramSlot.clone(),
      rotationEuler: [0, 0, 0],
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
      buildOpts: { width: 0.03, height: 0.003, depth: 0.018, materialKind: "pcbBlue" },
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
      kind: "generic",
      buildOpts: { width: 0.02, height: 0.006, depth: 0.11, materialKind: "heatsinkFin" },
      mount: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.005, 0.03)),
      detachAxis: AXIS_Y,
      tier: 1,
    },
    keyboard: {
      kind: "generic",
      buildOpts: { width: 0.27, height: 0.006, depth: 0.11, materialKind: "plasticDark" },
      mount: (a) => new THREE.Vector3(0, 0.02, -baseDims.depth * 0.03),
      detachAxis: AXIS_Y,
      tier: 2,
    },
    touchpad: {
      kind: "generic",
      buildOpts: { width: 0.09, height: 0.003, depth: 0.055, materialKind: "metalBrushed" },
      mount: () => new THREE.Vector3(0, 0.017, baseDims.depth * 0.32),
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
    "cable-battery": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.base.batteryBay.clone().add(new THREE.Vector3(0.06, 0.006, 0)),
      to: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0.03, 0, 0)),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-cpu-fan-laptop": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.004, 0.02)),
      to: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0, 0.008, 0.07)),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-keyboard-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(-0.05, 0, -0.02)),
      to: () => new THREE.Vector3(0, 0.02, -0.02),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-touchpad-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(-0.05, 0, 0.02)),
      to: () => new THREE.Vector3(0, 0.017, 0.06),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "cable-screen-flex": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).cpuSocket.clone().add(new THREE.Vector3(0.05, 0, -0.04)),
      to: (a) => a.base.hingeLine.clone(),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "wifi-antenna-1": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).wifiSlot.clone().add(new THREE.Vector3(-0.01, 0.002, 0)),
      to: (a) => a.base.hingeLine.clone().add(new THREE.Vector3(-0.1, 0.05, 0)),
      detachAxis: AXIS_Y,
      tier: 3,
    },
    "wifi-antenna-2": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => mbOf(a).wifiSlot.clone().add(new THREE.Vector3(0.01, 0.002, 0)),
      to: (a) => a.base.hingeLine.clone().add(new THREE.Vector3(0.1, 0.05, 0)),
      detachAxis: AXIS_Y,
      tier: 3,
    },
  };

  return { structure, components };
}
