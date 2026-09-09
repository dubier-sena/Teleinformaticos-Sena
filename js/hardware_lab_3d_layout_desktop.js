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
      detachAxis: AXIS_X, // se desliza hacia el costado, no hacia arriba (item 4).
    },
  ];

  const psuBayOf = (a) => a.chassis.psuBay.clone();
  const driveBayOf = (a) => a.chassis.driveCageBottom.clone();
  const m2Of = (a) => a.motherboard.m2Slot.clone();

  const components = {
    ram: {
      kind: "ram-module",
      buildOpts: { count: 2 },
      // Ranuras 2 y 3 (no 0 y 1): con la torre del cooler (buildTowerCooler,
      // ancho 0.13) rotada 90 grados sobre Y para el escritorio, su huella
      // queda orientada hacia las ranuras MAS CERCANAS al zocalo del CPU --
      // encontrado con clic real: el bounding box del cooler contenia
      // COMPLETO al de la RAM (coolerBox.containsBox(ramBox) === true) en
      // las ranuras 0/1, dejando la RAM geometricamente sin poder
      // seleccionarse (el rayo del clic siempre golpea primero al cooler,
      // sin importar el angulo de camara probado). Las 4 ranuras del
      // motherboard siguen dibujandose siempre (buildMotherboard); mover el
      // modulo instalable a las ranuras 2/3 no cambia nada visualmente salvo
      // en cual par queda la RAM removible, y las aleja lo suficiente del
      // cooler para que el clic las alcance.
      mount: (a) => a.motherboard.ramSlots[2].clone().lerp(a.motherboard.ramSlots[3], 0.5),
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
      // Toma de corriente cerca de la fuente (item 7: nunca dejar al
      // aprendiz "perdiendo completamente el modelo"). El valor original,
      // (0.9,-0.6,-1.3), quedaba casi fuera de cuadro incluso en la vista
      // "Superior" -- inaceptable para el Caso 1 de diagnostico, el mas
      // facil de los 10 y pensado como primer contacto con el modulo.
      // Ademas, al desconectarse este cable (a diferencia de una pieza
      // normal) NO queda "colgando junto a la fuente": todo el grupo se
      // traslada rigido a la bandeja de piezas (ver trayPositionFor en
      // hardware_lab_3d_rig.js) conservando su forma local -- un "to" lejano
      // hacia produce un tubo largo que, sumado al desplazamiento a la
      // bandeja, terminaba fuera del area visible/clicable. Por eso el
      // extremo se mantiene cerca de "from" (cable corto), no solo cerca de
      // la camara.
      to: () => new THREE.Vector3(0.15, -0.35, -0.25),
      detachAxis: AXIS_NEG_Z,
      tier: 4,
    },
    "cable-video": {
      kind: "cable",
      cableKind: "front-panel",
      from: (a) => a.motherboard.pcieSlot.clone().add(new THREE.Vector3(0.06, -0.02, -0.03)),
      // Corregido (mejora visual): el "to" original, (0.55,0.15,-0.5), apunta
      // literalmente al monitor de diagnostico (ZONES.monitorBase), un objeto
      // que solo existe en el modulo de Diagnostico. Como este cable esta
      // SIEMPRE "conectado por defecto" (ver comentario mas arriba) tambien
      // en Aprender/Practica libre/Evaluacion/Guiado -- donde ese monitor
      // nunca se construye -- el resultado era un cable larguisimo saliendo
      // del gabinete hacia la nada, visible en TODAS las vistas de camara de
      // esos modos (confirmado con clic real). Ademas, al ser parte del rig
      // desde el primer instante, su geometria (incluido el hit-proxy 4x mas
      // grueso, ver buildCable) se sumaba al Box3 que calcula
      // rigCenter/rigRadius (hardware_lab_3d_rig.js:getBoundsWorld, llamado
      // en stage.js:loadRig ANTES de que Diagnostico exista o no) -- un
      // punto a 0.55/-0.5 infla y descentra esa esfera muchisimo mas que el
      // propio gabinete (~0.1-0.2 de semi-extension), rompiendo el encuadre
      // de los presets "Frontal"/"Lateral" y de varios enfoques rapidos en
      // TODOS los modos, no solo en Diagnostico. Se acorta a un punto corto
      // y creible saliendo por la parte trasera del gabinete (misma idea que
      // el fix ya aplicado a power-cable-wall, arriba): sigue leyendose como
      // "cable de video conectado", sin el efecto secundario sobre camara.
      to: () => new THREE.Vector3(0.05, 0.03, -0.22),
      detachAxis: AXIS_X,
      tier: 4,
    },
  };

  return { structure, components };
}
