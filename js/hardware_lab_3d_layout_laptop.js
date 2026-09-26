/* js/hardware_lab_3d_layout_laptop.js
 *
 * Layout 3D del portatil: mapea cada id REAL de pieza de
 * js/hardware_lab_data_laptop.js a una posicion/geometria del motor generico
 * hardware_lab_3d_rig.js.
 *
 * RECONSTRUCCION POR SISTEMAS (sep-2026). La version anterior colocaba las
 * piezas por coordenadas sueltas relativas al socket del CPU, lo que produjo
 * (medido con una auditoria de cajas envolventes, no a ojo):
 *   - bateria atravesando la placa base 180 x 5 x 86 mm,
 *   - SSD y CPU y disipador metidos DENTRO de la bateria,
 *   - SSD y Wi-Fi atravesando el piso del chasis 3.3 y 5.8 mm,
 *   - 5 de 7 cables terminando fuera del equipo (las antenas Wi-Fi 50 mm por
 *     encima del teclado, a la vista).
 * Ahora la distribucion sigue la de un portatil real: PLACA en la banda
 * trasera (junto a bisagra, refrigeracion y puertos), BATERIA en la mitad
 * delantera bajo el reposamanos, y cada cable con origen y destino en un
 * conector que existe de verdad en la geometria.
 *
 * FASE 3 (acceso de servicio): el desensamble empieza retirando la TAPA
 * INFERIOR, asi que todo lo que se retira despues tiene que VERSE desde abajo.
 * La placa lleva sus componentes en la cara inferior y cada modulo cuelga de
 * ella (girado 180 grados sobre X, `rotationEuler`), y sale hacia abajo
 * (`detachAxis` -Y), que es por donde se extrae en un equipo real. Medidas y
 * holguras verificadas con la auditoria de colisiones y de visibilidad
 * (ver tests/laptop_3d_service_access.test.cjs).
 */
import * as THREE from "./vendor/three.module.min.js";
import {
  LAPTOP,
  LAPTOP_COVER_SCREWS,
  LAPTOP_COOLER_EARS,
  LAPTOP_BATTERY_SCREW_X,
  LAPTOP_BATTERY_SCREW_DZ,
  LAPTOP_KEYBOARD_SCREW_X,
  LAPTOP_TOUCHPAD_SCREW_X,
  LAPTOP_LID_OPEN_ANGLE,
  LAPTOP_LID_CLOSED_ANGLE,
  LAPTOP_LID_KEYBOARD_ANGLE,
  LAPTOP_LID_DISPLAY_ANGLE,
  LAPTOP_LID_MAX_OPEN_ANGLE,
  LAPTOP_SCREEN_SCREW_X,
  buildLaptopBase,
  buildLaptopBottomCover,
  buildLaptopLid,
  buildLaptopMotherboard,
  buildLaptopServiceStand,
} from "./hardware_lab_3d_laptop_factory.js";

const AXIS_Y = [0, 1, 0];
const AXIS_NEG_Y = [0, -1, 0];
// Modulo colgando de la cara inferior de la placa: boca abajo.
const FACE_DOWN = [Math.PI, 0, 0];
// En la bandeja vuelve a su postura natural (etiqueta y chips hacia arriba).
const FACE_UP = [0, 0, 0];

// Bandeja de piezas retiradas del portatil: centro {x, z} de cada pieza sobre
// la mesa, en coordenadas de escena (el equipo esta en x -0.15, z 0.05). Van a
// la derecha del equipo, por filas de mayor a menor tamaño, dentro del tapete
// (x ±1.22, z ±0.67) y lejos del monitor (x 0.55, z -0.55). Separacion minima
// entre piezas medida con sus cajas reales: 30 mm. Lo usa el rig
// (traySlotPose), que calcula la altura para dejar cada pieza apoyada.
const TRAY_SLOTS = {
  "screen-assembly": { x: 0.29, z: -0.08 },
  "bottom-cover": { x: 0.66, z: -0.08 },
  keyboard: { x: 0.285, z: 0.155 },
  motherboard: { x: 0.66, z: 0.155 },
  battery: { x: 0.24, z: 0.30 },
  touchpad: { x: 0.43, z: 0.30 },
  cooler: { x: 0.56, z: 0.30 },
  ram: { x: 0.67, z: 0.30 },
  "ssd-m2": { x: 0.785, z: 0.30 },
  "wifi-card": { x: 0.16, z: 0.42 },
  cpu: { x: 0.22, z: 0.42 },
  "cable-battery": { x: 0.30, z: 0.42 },
  "cable-cpu-fan-laptop": { x: 0.38, z: 0.42 },
  "cable-keyboard-flex": { x: 0.44, z: 0.42 },
  "cable-touchpad-flex": { x: 0.51, z: 0.42 },
  "cable-screen-flex": { x: 0.58, z: 0.42 },
  "wifi-antenna-1": { x: 0.66, z: 0.42 },
  "wifi-antenna-2": { x: 0.30, z: 0.54 },
};
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (anchor, dx, dy, dz) => anchor.clone().add(v(dx, dy, dz));

// Mitad de la altura del enchufe que dibuja buildCable (plugSize * 0.7 / 2):
// el extremo del cable se coloca de modo que el enchufe TOQUE su conector
// por debajo, en vez de quedar metido dentro de el.
const PLUG_HALF = { power: 0.0021, flex: 0.00175, display: 0.00175, antenna: 0.00098 };

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
      // Sin tornillos decorativos: los pone el sistema interactivo (ver SCREWS).
      build: () => buildLaptopMotherboard({ serviceScrews: false }),
      mount: (a) => a.base.motherboardOrigin,
      // Ultima pieza del desensamble: sale por abajo, como el resto.
      detachAxis: AXIS_NEG_Y,
      // En la bandeja, con sockets y conectores hacia arriba (a la vista).
      trayRotationEuler: [Math.PI, 0, 0],
    },
    {
      id: "bottom-cover-chassis",
      partId: "bottom-cover",
      tier: 3,
      // Sin tornillos decorativos: los pone el sistema interactivo (ver SCREWS).
      build: () => buildLaptopBottomCover(baseDims, { serviceScrews: false }),
      mount: (a) => a.base.bottomCoverCenter.clone(),
      detachAxis: AXIS_NEG_Y,
    },
    {
      id: "screen-lid",
      partId: "screen-assembly",
      tier: 2,
      build: () => buildLaptopLid({ width: baseDims ? baseDims.width : LAPTOP.width }),
      mount: (a) => a.base.hingeLine.clone(),
      // ~100 grados de apertura desde la horizontal (antes -1.85 rad = 106
      // grados hacia atras, que echaba la pantalla por detras del equipo).
      rotationEuler: [LAPTOP_LID_OPEN_ANGLE, 0, 0],
      // En la bandeja, abierta del todo y plana: panel hacia arriba.
      trayRotationEuler: [-Math.PI, 0, 0],
    },
  ];

  const mbOf = (a) => a.motherboard;
  const baseOf = (a) => a.base;

  const components = {
    // ── Placa: modulos en sus sockets, colgando de la cara inferior ──────
    ram: {
      kind: "laptop-sodimm",
      // Borde de contactos dentro del socket (a 1 mm de su fondo) y el cuerpo
      // hacia el frente; 1.9 mm por debajo de la cara de la placa.
      mount: (a) => at(mbOf(a).ramSlot, 0, -0.0019, 0.014),
      rotationEuler: FACE_DOWN,
      trayRotationEuler: FACE_UP,
      detachAxis: AXIS_NEG_Y,
      tier: 1,
      // Recorrido real de montaje: el modulo gira sobre sus contactos hasta
      // ~30 grados (alejandose de la placa) y solo entonces sale siguiendo ese
      // angulo. Lo resuelve computeSoDimmPose; el rig lo usa si la pieza
      // declara `insertionMotion`.
      insertionMotion: "sodimm",
      insertionOpts: { moduleDepth: 0.030, thickness: 0.0012, travel: 0.030 },
    },
    "ssd-m2": {
      kind: "laptop-m2-ssd",
      // Borde de contactos en el conector, extremo opuesto sobre el standoff.
      mount: (a) => at(mbOf(a).m2Slot, 0, -0.0022, 0),
      rotationEuler: FACE_DOWN,
      trayRotationEuler: FACE_UP,
      detachAxis: AXIS_NEG_Y,
      tier: 1,
      // Recorrido real M.2: sin el tornillo sube ~20 grados sobre sus
      // contactos y sale siguiendo su eje (nunca recta hacia abajo).
      insertionMotion: "m2",
      insertionOpts: { length: 0.080, thickness: 0.0011, travel: 0.030 },
    },
    "wifi-card": {
      kind: "laptop-wifi-card",
      mount: (a) => at(mbOf(a).wifiSlot, 0, -0.0022, 0),
      rotationEuler: FACE_DOWN,
      trayRotationEuler: FACE_UP,
      detachAxis: AXIS_NEG_Y,
      tier: 1,
      // Mismo recorrido M.2 que el SSD, con el largo de una 2230.
      insertionMotion: "m2",
      insertionOpts: { length: 0.030, thickness: 0.0010, travel: 0.020 },
    },
    cpu: {
      kind: "laptop-cpu",
      buildOpts: { size: 0.024 },
      // Sustrato contra la placa, die mirando hacia abajo (hacia el disipador).
      mount: (a) => at(mbOf(a).cpuSocket, 0, -0.00055, 0),
      rotationEuler: FACE_DOWN,
      trayRotationEuler: FACE_UP,
      detachAxis: AXIS_NEG_Y,
      tier: 0,
    },
    cooler: {
      // Modulo completo (contacto + heatpipe + aletas + ventilador). Su origen
      // es la cara de la placa de contacto que toca el die: 1.8 mm bajo la
      // placa base (1.1 sustrato + 0.7 die).
      kind: "laptop-cooler",
      // Los tornillos de sus orejas son interactivos (ver SCREWS abajo).
      buildOpts: { serviceScrews: false },
      mount: (a) => at(mbOf(a).cpuSocket, 0, -0.0018, 0),
      detachAxis: AXIS_NEG_Y,
      tier: 1,
    },

    // ── Mitad delantera ──────────────────────────────────────────────────
    battery: {
      kind: "laptop-battery",
      buildOpts: { width: 0.210, depth: 0.066, height: 0.0055 },
      // Boca abajo: etiqueta y PCB de proteccion hacia la tapa inferior, que es
      // lo que se ve al abrirla; el PCB queda en el borde trasero, junto a la
      // placa, que es de donde sale su cable.
      mount: (a) => baseOf(a).batteryBay.clone(),
      rotationEuler: FACE_DOWN,
      trayRotationEuler: FACE_UP,
      detachAxis: AXIS_NEG_Y,
      tier: 1,
    },
    keyboard: {
      kind: "laptop-keyboard",
      mount: (a) => baseOf(a).keyboardMount.clone(),
      detachAxis: AXIS_Y,
      tier: 2,
    },
    touchpad: {
      kind: "laptop-touchpad",
      mount: (a) => baseOf(a).touchpadMount.clone(),
      detachAxis: AXIS_Y,
      tier: 2,
    },

    // ── Cableado: ORIGEN -> RECORRIDO -> DESTINO ─────────────────────────
    // Cada cable describe su RECORRIDO con waypoints. Todos corren por el
    // espacio libre real: bajo la placa, o por la franja entre el borde
    // delantero de la placa (z -27 mm) y el trasero de la bateria (z +17.6),
    // por debajo de la bandeja del teclado (y 17.7 mm). Holguras medidas con
    // la auditoria de colisiones. Colores por familia: alimentacion rojo, flex
    // ambar, eDP azul, antena principal blanca, antena auxiliar negra.
    "cable-battery": {
      kind: "cable",
      cableKind: "power",
      // Sale del borde trasero de la bateria y sube al conector de la placa.
      from: (a) => at(baseOf(a).batteryBay, 0.084, 0, -0.033 - 0.0027),
      to: (a) => at(mbOf(a).batteryConnector, 0, -PLUG_HALF.power, 0),
      waypoints: (a) => {
        const b = baseOf(a).batteryBay;
        return [v(b.x + 0.082, 0.0065, 0.005), v(b.x + 0.054, 0.0095, -0.018)];
      },
      buildOpts: { radius: 0.0016, clipsAt: [0.45] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    "cable-cpu-fan-laptop": {
      kind: "cable",
      cableKind: "power",
      // Del borde de la carcasa del ventilador al header, por debajo de la
      // placa de contacto.
      from: (a) => at(mbOf(a).cpuSocket, -0.037 + 0.01615, -0.0018 - 0.00395, -0.017 + 0.01748),
      to: (a) => at(mbOf(a).fanHeader, 0, -PLUG_HALF.power, 0),
      waypoints: (a) => {
        const c = mbOf(a).cpuSocket;
        return [v(c.x - 0.026, c.y - 0.0053, c.z + 0.013)];
      },
      buildOpts: { radius: 0.0011, clipsAt: [0.55] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    "cable-keyboard-flex": {
      kind: "cable",
      cableKind: "flex",
      // Cola del teclado: baja por el hueco delante de la placa y entra al ZIF
      // desde abajo.
      // El enchufe queda BAJO la cola (antes metido dentro de ella).
      from: (a) => at(baseOf(a).keyboardMount, -0.018, -0.0015 - PLUG_HALF.flex, 0.006),
      to: (a) => at(mbOf(a).keyboardFpc, 0, -PLUG_HALF.flex, 0),
      waypoints: (a) => {
        const f = mbOf(a).keyboardFpc;
        // Baja delante del borde de la placa y llega al ZIF desde abajo, sin
        // rozar el conector.
        return [v(f.x, f.y + 0.0006, -0.0232), v(f.x, f.y - 0.0024, -0.029)];
      },
      buildOpts: { radius: 0.0018, flat: true, ribbonWidth: 0.012, clipsAt: [0.62] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    "cable-touchpad-flex": {
      kind: "cable",
      cableKind: "flex",
      // Del touchpad, por debajo de la bandeja del teclado y por encima de la
      // bateria, hasta su ZIF.
      // Punta de la cola FPC (dentro de la huella del touchpad, ver
      // buildLaptopTouchpad): 30.5 mm detras del centro del touchpad.
      from: (a) => at(baseOf(a).touchpadMount, 0, -0.0023 - PLUG_HALF.flex, -0.0305),
      to: (a) => at(mbOf(a).touchpadFpc, 0, -PLUG_HALF.flex, 0),
      waypoints: () => [v(0.004, 0.0152, 0.022), v(0.010, 0.0126, -0.016)],
      buildOpts: { radius: 0.0014, flat: true, ribbonWidth: 0.008, clipsAt: [0.5] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    "cable-screen-flex": {
      kind: "cable",
      cableKind: "display",
      // eDP: del conector junto a la bisagra derecha, por detras de la placa,
      // hasta la entrada del soporte de la bisagra (por ahi sube a la pantalla).
      from: (a) => at(mbOf(a).edpConnector, 0, -PLUG_HALF.display, 0),
      to: (a) => at(baseOf(a).hingeEntryRight, -0.008, -0.0027, 0.00225),
      waypoints: () => [v(0.096, 0.0112, -0.0985), v(0.101, 0.0126, -0.101)],
      buildOpts: { radius: 0.0015, flat: true, ribbonWidth: 0.008, clipsAt: [0.3, 0.55] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    // Antenas: salen de los u.FL (en la cara inferior de la tarjeta, que esta
    // boca abajo), corren bajo la placa pegadas a los bordes y entran al
    // soporte de su bisagra, por donde suben al marco de la pantalla.
    "wifi-antenna-1": {
      kind: "cable",
      cableKind: "antenna-main",
      // u.FL principal (MAIN), el mas cercano a la pared trasera.
      from: (a) => at(mbOf(a).wifiSlot, -0.0084, -0.0022 - 0.0017 - PLUG_HALF.antenna, -0.00616),
      to: (a) => at(baseOf(a).hingeEntryLeft, -0.002, -0.0005, 0.00125),
      waypoints: () => [v(-0.146, 0.0112, -0.048), v(-0.146, 0.0112, -0.097), v(-0.126, 0.0132, -0.1012)],
      buildOpts: { radius: 0.0008, hitRadius: 0.0025, clipsAt: [0.3, 0.72] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
    "wifi-antenna-2": {
      kind: "cable",
      cableKind: "antenna-aux",
      // u.FL auxiliar (AUX): cruza al lado derecho por la franja libre entre
      // placa y bateria, bajo la bandeja del teclado, y baja por el borde
      // derecho hasta su bisagra.
      from: (a) => at(mbOf(a).wifiSlot, -0.0084, -0.0022 - 0.0017 - PLUG_HALF.antenna, 0.00616),
      to: (a) => at(baseOf(a).hingeEntryRight, 0.004, -0.0005, 0.00125),
      waypoints: () => [
        v(-0.133, 0.0112, -0.022),
        v(-0.100, 0.0160, -0.012),
        v(0.100, 0.0160, -0.012),
        v(0.140, 0.0122, -0.022),
        v(0.146, 0.0112, -0.040),
        v(0.146, 0.0112, -0.097),
        v(0.126, 0.0132, -0.1012),
      ],
      buildOpts: { radius: 0.0008, hitRadius: 0.0025, clipsAt: [0.2, 0.5, 0.8] },
      detachAxis: AXIS_NEG_Y,
      tier: 3,
    },
  };

  // Los PUERTOS EXTERNOS no son componentes retirables: van soldados a la
  // placa y su boca forma parte de la pared del chasis. Se dibujan dentro de
  // buildLaptopBase (pared) + buildLaptopMotherboard (conector en el borde),
  // de modo que cada puerto visible por fuera tiene su conector por dentro.
  // Ver LAPTOP_PORTS en hardware_lab_3d_laptop_factory.js.

  // Plano de traslado hacia/desde la bandeja, en altura local del equipo
  // (chasis de y 0 a ~21 mm): 60 mm bajo el piso para lo que sale por abajo y
  // 75 mm sobre el origen para lo que sale por arriba. Holguras verificadas con
  // el recorrido animado real (ver hardware_lab_3d_rig.js, moveWithSlot).
  const trayTransit = { below: -0.060, above: 0.075 };

  // Soporte de servicio: explica la elevacion del equipo. Es decorativo (no es
  // pieza, no entra en el checklist ni en la interaccion), ver
  // buildLaptopServiceStand y `decor` en hardware_lab_3d_rig.js.
  const decor = [{ id: "service-stand", build: ({ tableLocalY }) => buildLaptopServiceStand({ tableLocalY }) }];

  // ── TORNILLOS INTERACTIVOS (ver hardware_lab_3d_screws.js) ─────────────
  // Cada tornillo es una pieza 3D con estado propio, asociada al componente
  // que fija: la tapa no se puede retirar hasta que sus cinco tornillos esten
  // fuera. Las posiciones son EXACTAMENTE las de las torres roscadas del
  // cuerpo base (LAPTOP_COVER_SCREWS), asi que cada tornillo entra en un
  // agujero que existe de verdad en la geometria.
  const COVER_SCREW_PLACE = [
    "trasero izquierdo",
    "trasero derecho",
    "delantero izquierdo",
    "delantero derecho",
    "delantero central",
  ];
  // Cara EXTERIOR de la tapa inferior: la cabeza se asienta ahi y el vastago
  // sube hacia el inserto de laton de la torre (y local +1.8 mm).
  const coverSeatY = () => -0.0013 - 0.0011;
  const DOWN = [0, -1, 0];
  const screws = LAPTOP_COVER_SCREWS.map(([x, z], i) => ({
    id: "cover-" + (i + 1),
    partId: "bottom-cover",
    label: "Tornillo " + (i + 1) + " de la tapa inferior (" + COVER_SCREW_PLACE[i] + ")",
    position: () => v(x, coverSeatY(), z),
    // Sale HACIA ABAJO: el portatil se atiende boca arriba sobre el soporte y
    // la tapa inferior se abre desde abajo.
    outDir: DOWN,
  }));

  // SSD M.2: UN tornillo en el standoff del extremo opuesto a los contactos
  // (40 mm del conector, ver buildLaptopMotherboard). Al quitarlo la tarjeta
  // se eleva sola en angulo -- eso ya lo hace computeM2Pose.
  screws.push({
    id: "ssd-m2-1",
    partId: "ssd-m2",
    label: "Tornillo de fijacion del SSD M.2",
    // 2.75 mm bajo la cara de la placa: cara inferior MEDIDA del PCB de la
    // tarjeta junto al standoff (no la de los chips NAND, que bajan 1.2 mm
    // mas pero quedan lejos del tornillo).
    position: (a) => at(mbOf(a).m2Slot, 0.0388, -0.00275, 0),
    outDir: DOWN,
    // Cabeza mas ancha que la media luna (1.8 mm de radio): si no, el tornillo
    // se colaria por la muesca en vez de sujetar la tarjeta.
    size: { headR: 0.0024, headH: 0.0008, shankR: 0.0009, shankLen: 0.004 },
  });

  // Tarjeta Wi-Fi (M.2 2230): su standoff esta a 13 mm del conector.
  screws.push({
    id: "wifi-card-1",
    partId: "wifi-card",
    label: "Tornillo de fijacion de la tarjeta Wi-Fi",
    // Cara inferior MEDIDA del PCB de la tarjeta junto a su standoff.
    position: (a) => at(mbOf(a).wifiSlot, 0.014, -0.0027, 0),
    outDir: DOWN,
    // Media luna de 1.6 mm de radio en esta tarjeta.
    size: { headR: 0.0022, headH: 0.0008, shankR: 0.0009, shankLen: 0.004 },
  });

  // Disipador: los 3 tornillos de la brida de resorte, sobre sus orejas
  // (LAPTOP_COOLER_EARS, coordenadas locales del modulo; el modulo se monta en
  // cpuSocket - 1.8 mm y la oreja tiene 0.8 mm de espesor).
  LAPTOP_COOLER_EARS.forEach(([x, z], i) => {
    screws.push({
      id: "cooler-" + (i + 1),
      partId: "cooler",
      label: "Tornillo " + (i + 1) + " de la brida del disipador",
      position: (a) => at(mbOf(a).cpuSocket, x, -0.0018 - 0.0008, z),
      outDir: DOWN,
      size: { headR: 0.0016, headH: 0.0008, shankR: 0.0009, shankLen: 0.004 },
    });
  });

  // Tarjeta madre: sus 5 puntos de tornillo vienen como anchor del propio
  // builder (mountScrews), ya en el plano de la cara de componentes.
  const BOARD_SCREW_PLACE = [
    "trasero izquierdo",
    "trasero derecho",
    "delantero izquierdo",
    "delantero derecho",
    "central",
  ];
  for (let i = 0; i < 5; i++) {
    screws.push({
      id: "motherboard-" + (i + 1),
      partId: "motherboard",
      label: "Tornillo " + (i + 1) + " de la tarjeta madre (" + BOARD_SCREW_PLACE[i] + ")",
      position: (a) => mbOf(a).mountScrews[i].clone(),
      outDir: DOWN,
      size: { headR: 0.0018, headH: 0.0008, shankR: 0.001, shankLen: 0.0045 },
    });
  }

  // Bateria: 2 tornillos de fijacion, uno en la oreja de cada extremo del pack
  // (buildLaptopBattery), roscados en las torres del chasis. Asiento = cara
  // inferior de la oreja, al ras de la del pack (bahia - 2.75 mm). Antes iban
  // a x +-95 mm, DENTRO del pack: lo atravesaban 3.45 mm.
  [-1, 1].forEach((sx, i) => {
    screws.push({
      id: "battery-" + (i + 1),
      partId: "battery",
      label: "Tornillo " + (i + 1) + " de fijacion de la bateria",
      position: (a) => at(baseOf(a).batteryBay, sx * LAPTOP_BATTERY_SCREW_X, -0.00275, LAPTOP_BATTERY_SCREW_DZ),
      outDir: [0, -1, 0],
      size: { headR: 0.0019, headH: 0.0008, shankR: 0.001, shankLen: 0.004 },
    });
  });

  // Teclado y touchpad: en un portatil real sus tornillos se ven DESDE LA
  // PARTE INFERIOR del chasis (asi lo dicen sus propias instrucciones en
  // hardware_lab_data_laptop.js), atravesando la chapa del reposamanos. El
  // asiento es la cara inferior de esa chapa (LAPTOP.deckBottomY).
  // Teclado (sep-2026): la cabeza aprieta la pletina del chasis y la rosca entra
  // en el boss del teclado. Asiento = cara inferior de la bandeja (1.7 mm bajo
  // el reposamanos) - boss 1.5 - pletina 0.8. El vastago de 4 mm termina dentro
  // de la bandeja (antes, dentro de una tecla).
  [-1, 1].forEach((sx, i) => {
    screws.push({
      id: "keyboard-" + (i + 1),
      partId: "keyboard",
      label: "Tornillo " + (i + 1) + " de fijacion del teclado",
      position: () => v(sx * LAPTOP_KEYBOARD_SCREW_X, LAPTOP.deckBottomY - 0.004, -0.005),
      outDir: [0, -1, 0],
      bearsOn: "chassis",
      size: { headR: 0.0018, headH: 0.0008, shankR: 0.001, shankLen: 0.004 },
    });
  });
  // Touchpad (sep-2026): la cabeza aprieta el travesano del chasis (2.3 mm bajo
  // el reposamanos) y la rosca entra en el boss del modulo. Vastago de 3.2 mm:
  // termina dentro del marco (antes, con 4 mm y asiento en el reposamanos,
  // atravesaba el cristal y asomaba 1.6 mm por encima).
  [-1, 1].forEach((sx, i) => {
    screws.push({
      id: "touchpad-" + (i + 1),
      partId: "touchpad",
      label: "Tornillo " + (i + 1) + " de fijacion del touchpad",
      position: (a) => v(sx * LAPTOP_TOUCHPAD_SCREW_X, LAPTOP.deckBottomY - 0.0023, baseOf(a).touchpadMount.z),
      outDir: [0, -1, 0],
      bearsOn: "chassis",
      size: { headR: 0.0018, headH: 0.0008, shankR: 0.001, shankLen: 0.0032 },
    });
  });

  // Pantalla: 2 tornillos por bisagra, en el soporte interior de cada una.
  [["Left", "izquierda"], ["Right", "derecha"]].forEach(([side, nombre], si) => {
    [-1, 1].forEach((dx, k) => {
      screws.push({
        id: "screen-" + (si * 2 + k + 1),
        partId: "screen-assembly",
        label: "Tornillo " + (k + 1) + " de la bisagra " + nombre,
        // Ambos bajo la hoja de bisagra de la pantalla (sep-2026): el exterior
        // sigue en +-121 mm; el interior paso de +-103 (bajo el nudillo del
        // CHASIS, donde la hoja no puede llegar sin quedar atrapada al sacar
        // la pantalla hacia arriba, y con la cabeza tocando el disipador) a
        // +-114.5.
        position: (a) => {
          const outer = (dx > 0) === (si === 1);
          const off = outer ? dx * 0.009 : (si === 1 ? 1 : -1) * (LAPTOP_SCREEN_SCREW_X[0] - LAPTOP.hinge.x);
          return at(baseOf(a)["hingeBracket" + side], off, 0, 0);
        },
        outDir: [0, -1, 0],
        // Estos NO apoyan en la pantalla: como en un portatil real, la cabeza
        // aprieta contra el soporte de la bisagra que forma parte del chasis y
        // la rosca entra en el brazo de la tapa. Al quitarlos se libera el
        // conjunto de pantalla completo.
        bearsOn: "chassis",
        size: { headR: 0.0019, headH: 0.0008, shankR: 0.001, shankLen: 0.0035 },
      });
    });
  });

  // Bandeja magnetica de tornillos: sobre la MESA, justo DELANTE del equipo.
  // Medido con clic real: puesta a un lado (x +0.25) los tornillos retirados
  // caian FUERA del cuadro de la camara "Interna" (NDC 1.26) -- se veian
  // desaparecer y no se podian volver a tomar. Delante del equipo entra en
  // cuadro por el borde inferior sin tapar la cara que se esta trabajando
  // (la camara mira HACIA ARRIBA desde 22 mm sobre la mesa: la bandeja queda
  // por debajo de la linea de vision).
  const screwDish = (anchors, opts) => v(0.0, (opts && opts.tableLocalY) || -0.16, 0.21);

  // POSICIONES TECNICAS (sep-26): el rig puede girar, cerrar y voltear el
  // portatil sobre su soporte. La tapa gira sobre el eje de bisagra; su hoja de
  // bisagra (hinge-leaf-frame) pertenece a la base mientras este montada.
  const pose = {
    lid: {
      structureId: "screen-lid",
      partId: "screen-assembly",
      leafFrame: "hinge-leaf-frame",
      openAngle: LAPTOP_LID_OPEN_ANGLE,
      closedAngle: LAPTOP_LID_CLOSED_ANGLE,
      maxOpenAngle: LAPTOP_LID_MAX_OPEN_ANGLE,
    },
    // Posiciones TECNICAS de trabajo. `yaw` 0: siempre la orientacion canonica
    // (asi "Vista de trabajo" devuelve el equipo exactamente a su sitio aunque
    // el aprendiz lo haya girado para inspeccionarlo).
    presets: {
      // Pose inicial aprobada: derecho, pantalla abierta como en General.
      open: { label: "Abierto (posicion normal)", yaw: 0, flipped: false, lid: LAPTOP_LID_OPEN_ANGLE },
      closed: { label: "Cerrado", yaw: 0, flipped: false, lid: LAPTOP_LID_CLOSED_ANGLE },
      // Tapa inferior: cerrado y boca abajo, la tapa inferior hacia arriba.
      bottom: { label: "Tapa inferior", yaw: 0, flipped: true, lid: LAPTOP_LID_CLOSED_ANGLE },
      // Componentes internos: misma orientacion, encuadre del interior util.
      internal: { label: "Componentes internos", yaw: 0, flipped: true, lid: LAPTOP_LID_CLOSED_ANGLE },
      keyboard: { label: "Teclado", yaw: 0, flipped: false, lid: LAPTOP_LID_KEYBOARD_ANGLE },
      display: { label: "Pantalla", yaw: 0, flipped: false, lid: LAPTOP_LID_DISPLAY_ANGLE },
    },
    // Apertura minima para trabajar por arriba: medido, por debajo de ~86
    // grados la tapa se proyecta sobre la huella del teclado.
    minTopWorkLid: -86 * Math.PI / 180,
    // Que posicion tecnica pide cada operacion. `access` lo deduce el rig de
    // la geometria: "interior" (sale por la cara inferior: detachAxis -Y,
    // cables del interior, tornillos que salen hacia -Y) o "top" (sale por
    // arriba: teclado, touchpad, pantalla).
    workPresetFor: (partId, access) => {
      if (access === "interior") return partId === "bottom-cover" ? "bottom" : "internal";
      return partId === "screen-assembly" ? "display" : "keyboard";
    },
    // Encuadre de cada posicion de trabajo. `dirLocal`: de donde mira la
    // camara, en el marco del portatil (asi sigue al equipo girado/volteado).
    // `focus`: que tiene que caber en el cuadro.
    workViews: {
      // Boca abajo: la cara inferior mira a +Y de mundo (-Y local). Desde
      // arriba y algo por delante, con toda la tapa y sus 5 tornillos.
      bottom: { dirLocal: [0.16, -1.3, 0.78], focus: { parts: ["bottom-cover"], withScrews: true } },
      // Interior UTIL (piezas internas instaladas + sus tornillos), no la mesa.
      internal: { dirLocal: [0.12, -1.55, 0.72], focus: { interior: true, withScrews: true } },
      // Teclado: vista elevada algo isometrica desde el frente; centro real de
      // la zona del teclado (su borde superior, el que se libera primero).
      keyboard: {
        dirLocal: [0.26, 0.95, 1.0],
        focus: { parts: ["keyboard"], localBox: [[-0.142, 0.017, -0.085], [0.142, 0.024, 0.04]] },
      },
      // Pantalla: las dos bisagras, sus hojas, las entradas de cable y el
      // arranque de la tapa, desde el frente y por encima del reposamanos.
      display: {
        dirLocal: [0.15, 0.85, 1.0],
        focus: { localBox: [[-0.15, 0.010, -0.125], [0.15, 0.09, -0.07]] },
      },
    },
  };

  return { structure, components, traySlots: TRAY_SLOTS, trayTransit, decor, screws, screwDish, pose };
}
