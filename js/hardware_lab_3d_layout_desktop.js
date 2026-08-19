/* js/hardware_lab_3d_layout_desktop.js
 *
 * Layout 3D del PC de escritorio: mapea cada id REAL de pieza de
 * js/hardware_lab_data_desktop.js (16 piezas) a una posicion/geometria del
 * motor generico hardware_lab_3d_rig.js. Dato puro (funciones de montaje +
 * que factory usar); ninguna regla de negocio vive aqui, eso sigue en
 * hardware_lab_engine.js (intacto, ver CLAUDE.md).
 *
 * Los ids de aqui DEBEN coincidir exactamente con las llaves de PARTS en
 * hardware_lab_data_desktop.js (mas los 2 ids "virtuales" de diagnostico,
 * power-cable-wall / cable-video, ver hardware_lab_diagnosis_engine.js).
 */
import * as THREE from "./vendor/three.module.min.js";
import { buildDesktopCaseShell, buildDesktopSidePanel, buildMotherboard } from "./hardware_lab_3d_chassis_factory.js";

const AXIS_X = [1, 0, 0];
const AXIS_Y = [0, 1, 0];
const AXIS_NEG_Z = [0, 0, -1];

export function createDesktopLayout() {
  let chassisDims = null;

  const structure = [
    {
      id: "chassis",
      build: () => {
        const built = buildDesktopCaseShell();
        chassisDims = built.dims;
        return built;
      },
      mount: () => new THREE.Vector3(0, 0, 0),
    },
    {
      id: "motherboard",
      partId: "motherboard",
      tier: 0,
      build: () => buildMotherboard(),
      mount: (a) => a.chassis.motherboardOrigin,
    },
    {
      id: "side-panel-chassis",
      partId: "side-panel",
      tier: 3,
      build: () => buildDesktopSidePanel(chassisDims),
      mount: () => new THREE.Vector3(chassisDims.width / 2, chassisDims.height / 2, 0),
    },
  ];

  const psuBayOf = (a) => a.chassis.psuBay.clone();
  const driveBayOf = (a) => a.chassis.driveCageBottom.clone();
  const m2Of = (a) => a.motherboard.m2Slot.clone();

  const components = {
    ram: {
      kind: "ram-module",
      buildOpts: { count: 2 },
      mount: (a) => a.motherboard.ramSlots[0].clone().lerp(a.motherboard.ramSlots[1], 0.5),
      rotationEuler: [0, Math.PI / 2, Math.PI / 2],
      detachAxis: AXIS_X,
      tier: 1,
    },
    ssd: {
      kind: "ssd-2-5",
      mount: driveBayOf,
      detachAxis: AXIS_X,
      tier: 1,
    },
    "ssd-m2": {
      kind: "m2-ssd",
      mount: m2Of,
      rotationEuler: [0, Math.PI / 2, 0],
      detachAxis: AXIS_Y,
      tier: 1,
    },
    cooler: {
      kind: "cooler-tower",
      mount: (a) => a.motherboard.cpuSocket.clone().add(new THREE.Vector3(0.02, -0.01, 0)),
      rotationEuler: [0, Math.PI / 2, 0],
      detachAxis: AXIS_Y,
      tier: 1,
    },
    cpu: {
      kind: "cpu",
      mount: (a) => a.motherboard.cpuSocket.clone(),
      rotationEuler: [0, 0, Math.PI / 2],
      detachAxis: AXIS_Y,
      tier: 0,
    },
    gpu: {
      kind: "gpu",
      mount: (a) => a.motherboard.pcieSlot.clone().add(new THREE.Vector3(0.02, 0, 0)),
      rotationEuler: [0, Math.PI / 2, 0],
      detachAxis: AXIS_Y,
      tier: 2,
    },
    psu: {
      kind: "psu",
      mount: psuBayOf,
      detachAxis: AXIS_NEG_Z,
      tier: 2,
    },
    "cable-front-panel": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.motherboard.frontPanelHeader.clone(),
      to: (a) => a.chassis.frontPanelHeader.clone(),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-atx": {
      kind: "cable",
      cableKind: "atx24",
      from: (a) => a.motherboard.atxHeader.clone(),
      to: (a) => psuBayOf(a).add(new THREE.Vector3(0.03, 0.02, 0.03)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-cpu-eps": {
      kind: "cable",
      cableKind: "eps",
      from: (a) => a.motherboard.epsHeader.clone(),
      to: (a) => psuBayOf(a).add(new THREE.Vector3(0.03, 0.02, -0.03)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-sata-data": {
      kind: "cable",
      cableKind: "sata",
      from: (a) => a.motherboard.sataHeaders[0].clone(),
      to: (a) => driveBayOf(a).add(new THREE.Vector3(-0.03, 0, 0)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-sata-power": {
      kind: "cable",
      cableKind: "sata",
      from: (a) => psuBayOf(a).add(new THREE.Vector3(0.04, -0.01, 0.02)),
      to: (a) => driveBayOf(a).add(new THREE.Vector3(0.03, 0, 0)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-gpu-power": {
      kind: "cable",
      cableKind: "eps",
      from: (a) => psuBayOf(a).add(new THREE.Vector3(0.04, 0.01, -0.02)),
      to: (a) => a.motherboard.pcieSlot.clone().add(new THREE.Vector3(0.06, 0.05, 0)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    "cable-cpu-fan": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.motherboard.cpuSocket.clone().add(new THREE.Vector3(0.02, 0.03, 0.03)),
      to: (a) => a.motherboard.cpuSocket.clone().add(new THREE.Vector3(0.02, 0.09, 0)),
      detachAxis: AXIS_X,
      tier: 3,
    },
    // Piezas "virtuales" que solo usa el modulo de diagnostico (item 21: no
    // siempre hay que abrir el gabinete). No aparecen en las secuencias de
    // ensamble/desensamble normales, asi que quedan simplemente "conectadas"
    // por defecto durante esas practicas (comportamiento correcto: un cable
    // de pared y uno de video SI estarian conectados en un equipo armado).
    "power-cable-wall": {
      kind: "cable",
      cableKind: "atx24",
      from: (a) => psuBayOf(a).add(new THREE.Vector3(0, -0.02, -0.06)),
      to: () => new THREE.Vector3(0.9, -0.6, -1.3), // toma de corriente en el fondo de la escena
      detachAxis: AXIS_NEG_Z,
      tier: 4,
    },
    "cable-video": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.motherboard.pcieSlot.clone().add(new THREE.Vector3(0.06, -0.02, -0.03)),
      to: () => new THREE.Vector3(0.55, 0.15, -0.5), // hacia el monitor de diagnostico
      detachAxis: AXIS_X,
      tier: 4,
    },
  };

  return { structure, components };
}
