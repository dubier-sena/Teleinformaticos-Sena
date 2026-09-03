/* js/hardware_lab_3d_chassis_factory.js
 *
 * Estructuras "anfitrionas" del laboratorio: el gabinete de escritorio y el
 * chasis del portatil, junto con la placa base. A diferencia de
 * hardware_lab_3d_parts_factory.js (piezas sueltas), estas funciones tambien
 * devuelven "anchors": puntos locales donde encajan otras piezas, para que
 * hardware_lab_3d_rig.js no tenga que adivinar coordenadas.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor } from "./hardware_lab_3d_constants.js";
import { buildFan } from "./hardware_lab_3d_parts_factory.js";

function box(w, h, d, kind, overrides) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialFor(kind, overrides));
}

function setShadow(obj, cast = true, receive = true) {
  obj.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = cast;
      n.receiveShadow = receive;
    }
  });
  return obj;
}

/**
 * Gabinete ATX de escritorio: 5 paneles fijos (el sexto, lateral, es la
 * pieza removible que arma buildSidePanel). El eje +X mira hacia el panel
 * lateral removible; el eje +Z mira hacia el frente del equipo.
 */
export function buildDesktopCaseShell(opts = {}) {
  const width = opts.width || 0.205;
  const height = opts.height || 0.44;
  const depth = opts.depth || 0.41;
  const wall = 0.006;

  const group = new THREE.Group();
  group.name = "case-shell";

  const bottom = box(width, wall, depth, "metalDark");
  bottom.position.y = wall / 2;
  group.add(bottom);

  const top = box(width, wall, depth, "metalDark");
  top.position.y = height - wall / 2;
  group.add(top);

  const back = box(width, height, wall, "metalDark");
  back.position.set(0, height / 2, -depth / 2 + wall / 2);
  group.add(back);

  const front = box(width, height, wall, "plasticBlack");
  front.position.set(0, height / 2, depth / 2 - wall / 2);
  group.add(front);

  const left = box(wall, height, depth, "metalDark");
  left.position.set(-width / 2 + wall / 2, height / 2, 0);
  group.add(left);

  // Detalle frontal: boton de encendido + ventilador frontal visible tras la rejilla.
  const powerBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10),
    materialFor("aluminum")
  );
  powerBtn.rotation.x = Math.PI / 2;
  powerBtn.position.set(width * 0.32, height - 0.05, depth / 2 - wall);
  group.add(powerBtn);

  const frontFan = buildFan(Math.min(width, height) * 0.62, { depth: 0.02 });
  frontFan.rotation.y = Math.PI / 2;
  frontFan.position.set(-width / 2 + wall + 0.012, height * 0.28, depth / 2 - 0.05);
  group.add(frontFan);

  // Rejilla de expansion PCIe en la parte trasera (referencia visual del bracket de la GPU).
  for (let i = 0; i < 4; i++) {
    const slat = box(width - wall * 4, 0.006, 0.001, "metalDark", { color: 0x1c1f22 });
    slat.position.set(0, height * 0.22 + i * 0.011, -depth / 2 + wall + 0.001);
    group.add(slat);
  }

  // I/O trasero (referencia visual, no interactivo).
  const ioShield = box(width * 0.5, height * 0.16, 0.002, "plasticBlack", { color: 0x08090b });
  ioShield.position.set(width * 0.08, height * 0.72, -depth / 2 + wall + 0.002);
  group.add(ioShield);

  setShadow(group);

  const dims = { width, height, depth, wall };
  const anchors = {
    // Plano donde se atornilla la placa (contra la pared izquierda, mirando +X).
    motherboardMountX: -width / 2 + wall + 0.004,
    motherboardOrigin: new THREE.Vector3(-width / 2 + wall + 0.004, height * 0.14, -depth * 0.28),
    psuBay: new THREE.Vector3(width * 0.02, wall + 0.045, -depth / 2 + wall + 0.075),
    driveCageTop: new THREE.Vector3(width * 0.18, height * 0.62, depth * 0.18),
    driveCageBottom: new THREE.Vector3(width * 0.18, height * 0.5, depth * 0.18),
    m2OnBoard: new THREE.Vector3(0, 0, 0), // se resuelve relativo a la placa, ver buildMotherboard
    frontPanelHeader: new THREE.Vector3(width * 0.15, wall + 0.01, depth / 2 - 0.03),
    frontFanConnector: new THREE.Vector3(-width / 2 + wall + 0.012, height * 0.28 - 0.02, depth / 2 - 0.05),
    interiorTopFanMount: new THREE.Vector3(0, height - wall - 0.03, -depth * 0.05),
    sidePanelOpenOffset: new THREE.Vector3(width * 0.55, 0, 0.05),
  };

  return { group, dims, anchors };
}

/** Panel lateral removible (item: gabinete "abierto"/"cerrado" gobierna el acceso interno). */
export function buildDesktopSidePanel(dims) {
  const wall = 0.006;
  const panel = box(wall, dims.height, dims.depth, "plasticDark", { color: 0x1b1e22 });
  panel.name = "case-side-panel";
  const window_ = box(wall * 0.4, dims.height * 0.55, dims.depth * 0.55, "glassDark");
  window_.position.set(wall * 0.3, dims.height * 0.05, 0);
  panel.add(window_);
  setShadow(panel);
  return { group: panel };
}

/**
 * Placa base (ATX) autorada de pie: se extiende en Y (alto) y Z (profundo),
 * con espesor minimo en X. Asi el rig solo necesita fijar su posicion X
 * junto a la pared del gabinete, sin rotarla.
 */
export function buildMotherboard(opts = {}) {
  const h = opts.height || 0.305; // alto (Y)
  const d = opts.depth || 0.244; // profundo (Z)
  const t = 0.0022;

  const group = new THREE.Group();
  group.name = "motherboard";

  const board = box(t, h, d, "pcbGreen");
  group.add(board);

  // Zocalo CPU (bloque plastico + pequenos capacitores alrededor, look autentico).
  const socketPos = new THREE.Vector3(t / 2 + 0.001, h * 0.32, d * 0.06);
  const socketFrame = box(0.006, 0.05, 0.05, "plasticBlack");
  socketFrame.position.copy(socketPos);
  group.add(socketFrame);

  for (let i = 0; i < 14; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.004, 6), materialFor("metalDark"));
    cap.rotation.z = Math.PI / 2;
    const angle = (i / 14) * Math.PI * 2;
    cap.position.set(t / 2 + 0.002, socketPos.y + Math.sin(angle) * 0.034, socketPos.z + Math.cos(angle) * 0.034);
    group.add(cap);
  }

  // Chipset.
  const chipset = box(0.003, 0.03, 0.03, "aluminum");
  chipset.position.set(t / 2 + 0.0015, h * 0.1, -d * 0.08);
  group.add(chipset);

  // Ranuras RAM: 4, verticales junto al zocalo.
  const ramSlotAnchors = [];
  for (let i = 0; i < 4; i++) {
    const slotZ = socketPos.z + 0.045 + i * 0.017;
    const slot = box(0.006, h * 0.42, 0.012, "plasticBlack", { color: i % 2 === 0 ? 0x0c0d0f : 0x2a2d33 });
    slot.position.set(t / 2 + 0.002, h * 0.52, slotZ);
    group.add(slot);
    ramSlotAnchors.push(new THREE.Vector3(t / 2 + 0.003, h * 0.52, slotZ));
  }

  // Ranura PCIe (para la GPU), horizontal, tercio inferior.
  const pcieZ = d * 0.02;
  const pcieSlot = box(0.006, 0.008, 0.09, "plasticBlack");
  pcieSlot.position.set(t / 2 + 0.002, h * 0.08, pcieZ);
  group.add(pcieSlot);

  // Ranura M.2, cerca del borde inferior.
  const m2Pos = new THREE.Vector3(t / 2 + 0.001, h * 0.02, d * 0.28);
  const m2Slot = box(0.004, 0.006, 0.05, "plasticDark");
  m2Slot.position.copy(m2Pos);
  group.add(m2Slot);

  // Panel I/O soldado al borde trasero.
  const ioBlock = box(0.012, h * 0.18, 0.05, "metalDark");
  ioBlock.position.set(t / 2 + 0.006, h * 0.82, -d / 2 + 0.03);
  group.add(ioBlock);

  // Conector de 24 pines ATX (borde superior) y EPS (esquina superior).
  const atxHeader = new THREE.Vector3(t / 2 + 0.003, h * 0.94, -d * 0.32);
  const epsHeader = new THREE.Vector3(t / 2 + 0.003, h * 0.98, -d * 0.02);
  const sataHeaders = [0, 1].map(
    (i) => new THREE.Vector3(t / 2 + 0.003, h * 0.04, -d / 2 + 0.06 + i * 0.014)
  );
  const frontPanelHeader = new THREE.Vector3(t / 2 + 0.003, h * 0.06, d * 0.35);

  setShadow(group);

  return {
    group,
    dims: { height: h, depth: d, thickness: t },
    anchors: {
      cpuSocket: socketPos,
      ramSlots: ramSlotAnchors,
      pcieSlot: new THREE.Vector3(t / 2 + 0.003, h * 0.08, pcieZ),
      m2Slot: m2Pos,
      atxHeader,
      epsHeader,
      sataHeaders,
      frontPanelHeader,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PORTATIL
// ─────────────────────────────────────────────────────────────────────────

/** Base del chasis del portatil (donde va la placa, bateria...). El teclado y
 * el touchpad NO se construyen aqui: son piezas propias, removibles de
 * verdad (ver buildLaptopKeyboard/buildLaptopTouchpad mas abajo) -- antes
 * estaban baked directo en este grupo estatico (sin partId, nunca
 * interactivo), superpuestos a una copia SEPARADA e invisible ("keyboard"/
 * "touchpad" en hardware_lab_3d_layout_laptop.js, un simple box "generic")
 * que si era la pieza togglable real. Resultado: quitar el teclado en
 * cualquier practica no cambiaba nada visualmente, y ademas ocultaba
 * bateria/placa/CPU/RAM/Wi-Fi sin ninguna forma de revelarlos. */
export function buildLaptopBase(opts = {}) {
  const w = opts.width || 0.33;
  const d = opts.depth || 0.23;
  const h = 0.014;
  const wall = 0.0016;
  const group = new THREE.Group();
  group.name = "laptop-base";

  // Carcasa hueca (correccion visual, sep-2026): antes esto era un bloque
  // macizo box(w,h,d) sin cavidad -- motherboard/CPU/disipador/RAM/Wi-Fi/
  // bateria quedaban tapados por el solido (o directamente fuera de el, ver
  // pared izquierda mas abajo). Ahora es una bandeja de piso + 4 paredes
  // delgadas, abierta por arriba (el teclado, pieza propia, cubre esa
  // abertura -- ver keyboardMount). Mismo footprint y alto exterior que
  // antes (w, d, h sin cambios): nada que dependa del exterior del chasis
  // se ve afectado, solo el interior deja de ser solido.
  // "metalBrushed" (no "aluminum") a proposito (correccion visual, FASE D
  // sep-2026): las 3 superficies grandes originales (base/tapa/respaldo de
  // tapa) compartian el mismo "aluminum" (roughness 0.28) sin ninguna
  // ruptura -- se leian como una sola losa blanca y plana. El piso es la
  // unica superficie realmente interior (las paredes se ven tanto desde
  // afuera como desde la cavidad); usar el tono ya definido para el
  // touchpad (mas mate, roughness 0.5) le da al interior una textura
  // distinta de la carcasa exterior sin inventar un material nuevo ni
  // tocar ningun color.
  const floor = box(w, wall, d, "metalBrushed");
  floor.position.y = wall / 2;
  group.add(floor);

  const backWall = box(w, h, wall, "aluminum");
  backWall.position.set(0, h / 2, -d / 2 + wall / 2);
  group.add(backWall);

  const frontWall = box(w, h, wall, "aluminum");
  frontWall.position.set(0, h / 2, d / 2 - wall / 2);
  group.add(frontWall);

  const leftWall = box(wall, h, d, "aluminum");
  leftWall.position.set(-w / 2 + wall / 2, h / 2, 0);
  group.add(leftWall);

  const rightWall = box(wall, h, d, "aluminum");
  rightWall.position.set(w / 2 - wall / 2, h / 2, 0);
  group.add(rightWall);

  // Rejilla de ventilacion decorativa, borde trasero (auditoria visual de
  // mejora 3D: la base era una caja completamente lisa, sin ninguna
  // referencia de "aqui respira el equipo" -- justo donde un portatil real
  // la tiene, cerca de la bisagra/disipador). Apoyada justo AFUERA de la
  // cara exterior de la pared trasera (antes de la correccion visual, esa
  // cara era la del bloque macizo; ahora es la pared delgada) para no
  // competir en el mismo plano. Solo estetica: no es una pieza propia ni
  // afecta ningun anchor existente.
  for (let i = 0; i < 7; i++) {
    const slat = box(w * 0.045, h * 0.5, 0.0015, "plasticDark", { color: 0x0e0f11 });
    slat.position.set(-w * 0.28 + i * (w * 0.05), h * 0.5, -d / 2 - 0.0008);
    group.add(slat);
  }

  setShadow(group);

  return {
    group,
    dims: { width: w, depth: d, height: h },
    anchors: {
      hingeLine: new THREE.Vector3(0, h, -d / 2),
      // Y reubicado (correccion visual, sep-2026): antes -0.001, por DEBAJO
      // del bloque macizo (h=0..0.014) -- ni "dentro" ni realmente visible,
      // solo tapado por igual. Ahora wall+radio de la pieza: apoyada sobre
      // el piso de la bandeja, dentro de la cavidad real.
      batteryBay: new THREE.Vector3(0, wall + 0.003, d * 0.05),
      // X reubicado de -0.32*w a -0.12*w (correccion visual, sep-2026): con
      // -0.32 la placa (ancho 0.24 por defecto, ver buildLaptopMotherboard)
      // quedaba con su borde izquierdo en X=-0.2256, es decir 60mm AFUERA de
      // la pared izquierda de un chasis de 0.33 de ancho (borde interior en
      // -0.1634) -- la placa entera sobresalia del equipo, no solo la
      // Wi-Fi (que se monta relativa a este mismo origen y arrastraba el
      // mismo problema). Con -0.12 la placa completa (y todo lo montado
      // sobre ella: CPU, disipador, RAM, SSD M.2, Wi-Fi) queda con margen
      // real respecto a las 4 paredes. Y reubicado igual que bateria: apoyada
      // sobre el piso de la bandeja (t/2 de la placa, ver buildLaptopMotherboard).
      motherboardOrigin: new THREE.Vector3(-w * 0.12, wall + 0.0009, -d * 0.12),
      // Y reubicado (correccion visual, sep-2026): antes -0.001 + otro
      // -0.004 sumado en el mount() de hardware_lab_3d_layout_laptop.js
      // (sin tocar ese archivo) = -0.005 final, un salto de ~4mm respecto a
      // la cara inferior del piso (y=0) sin nada que lo explicara.
      // 0.00175 aqui = -0.00225 final, dejando la tapa con su cara superior
      // en y=-0.001: justo debajo del piso de la bandeja (y=0..wall), con
      // 1mm de separacion visual limpia (evita z-fighting) y CERO
      // superposicion con la bateria (que ahora vive por completo en
      // y>=wall=0.0016, muy por encima).
      bottomCoverCenter: new THREE.Vector3(0, 0.00175, 0),
      // Misma posicion absoluta que antes ocupaba el keyboardDeck/touchpad
      // estaticos -- al retirarse, no queda ningun hueco ni salto visual.
      keyboardMount: new THREE.Vector3(0, h + 0.001, -d * 0.03),
      touchpadMount: new THREE.Vector3(0, h + 0.0016, d * 0.32),
    },
  };
}

/** Teclado del portatil: deck + rejilla de teclas, como pieza propia y
 * removible (antes vivia baked dentro de buildLaptopBase, sin poder
 * quitarse nunca visualmente). El grupo se autora con el deck en su propio
 * origen local (0,0,0); hardware_lab_3d_layout_laptop.js lo monta en
 * `base.keyboardMount`, la misma posicion absoluta que ocupaba antes. */
export function buildLaptopKeyboard(opts = {}) {
  const w = opts.width || 0.33;
  const d = opts.depth || 0.23;
  const group = new THREE.Group();
  group.name = "laptop-keyboard-assembly";

  const deck = box(w * 0.94, 0.002, d * 0.88, "plasticDark");
  deck.name = "laptop-keyboard-deck";
  group.add(deck);

  // Teclas simplificadas: rejilla de pequenas teclas (bajo poligonaje).
  const keyGeo = new THREE.BoxGeometry(w * 0.045, 0.0025, d * 0.045);
  const keyMat = materialFor("plasticBlack");
  const keysGroup = new THREE.Group();
  keysGroup.name = "laptop-keys";
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 13; col++) {
      const key = new THREE.Mesh(keyGeo, keyMat);
      key.position.set(-w * 0.42 + col * (w * 0.066), 0.0016, -d * 0.27 + row * (d * 0.11));
      keysGroup.add(key);
    }
  }
  group.add(keysGroup);

  setShadow(group);
  // Devuelve el Group directo (no {group,...}): "laptop-keyboard" se
  // registra en KIND_BUILDERS como builder de COMPONENTE (ver
  // hardware_lab_3d_rig.js), y ese contrato exige el Object3D crudo -- a
  // diferencia de los builders de ESTRUCTURA (buildLaptopBase y similares),
  // que si envuelven {group, dims, anchors}. Envolverlo aqui rompia
  // "object3d.position.copy(...)" en createRig con cualquier equipo portatil.
  return group;
}

/** Touchpad del portatil: misma logica que el teclado (pieza propia y
 * removible, autorada en su propio origen local). */
export function buildLaptopTouchpad(opts = {}) {
  const w = opts.width || 0.33;
  const d = opts.depth || 0.23;
  const group = new THREE.Group();
  group.name = "laptop-touchpad-assembly";

  const pad = box(w * 0.28, 0.0015, d * 0.16, "metalBrushed");
  pad.name = "laptop-touchpad";
  group.add(pad);

  setShadow(group);
  return group; // ver nota de contrato en buildLaptopKeyboard.
}

/** Tapa inferior removible del portatil (item 13-14). */
export function buildLaptopBottomCover(dims) {
  const panel = box(dims.width * 0.97, 0.0025, dims.depth * 0.97, "aluminum");
  panel.name = "laptop-bottom-cover";

  // Patas de goma decorativas en las 4 esquinas (auditoria visual de
  // mejora 3D): el panel era liso por completo, sin ninguna referencia de
  // "esta pieza apoya el equipo sobre la mesa". Solo estetica.
  const footR = Math.min(dims.width, dims.depth) * 0.018;
  const cornerOffsets = [
    [dims.width * 0.42, dims.depth * 0.42],
    [-dims.width * 0.42, dims.depth * 0.42],
    [dims.width * 0.42, -dims.depth * 0.42],
    [-dims.width * 0.42, -dims.depth * 0.42],
  ];
  cornerOffsets.forEach(([x, z]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(footR, footR, 0.0018, 10), materialFor("rubberBlack"));
    foot.position.set(x, -0.0025 / 2 - 0.0009, z);
    panel.add(foot);
  });

  setShadow(panel);
  return { group: panel };
}

/** Pantalla/tapa del portatil, articulada en el eje de la bisagra. */
export function buildLaptopLid(opts = {}) {
  const w = opts.width || 0.33;
  const d = opts.depth || 0.22;
  const t = 0.009;
  const group = new THREE.Group();
  group.name = "laptop-lid";

  // El origen local del grupo ES el eje de la bisagra (mejora 3D): antes el
  // panel estaba centrado en Z sobre el origen, asi que al aplicar
  // rotationEuler (abrir la tapa) la MITAD de la geometria giraba hacia
  // adentro/abajo de la bisagra en vez de girar completa hacia arriba --
  // resultado, la pantalla visible quedaba flotando con un hueco respecto a
  // la base, claramente desconectada del equipo (confirmado con clic real,
  // muy notorio en "Aprender componentes"). Desplazar todo +d/2 en Z deja el
  // borde de la bisagra en z=0 y el resto del panel se extiende hacia +Z,
  // que es el lado que efectivamente sube al rotar (ver mount() en
  // hardware_lab_3d_layout_laptop.js).
  const back = box(w, t, d, "aluminum");
  back.position.set(0, t / 2, d / 2);
  group.add(back);

  const screen = box(w * 0.94, 0.002, d * 0.92, "plasticBlack", { color: 0x050608 });
  screen.position.set(0, t + 0.001, d / 2);
  group.add(screen);

  const bezelGlow = box(w * 0.86, 0.0015, d * 0.82, "plasticBlack", {
    color: 0x0d3350,
    emissive: 0x0c2f66,
    emissiveIntensity: 0.35,
  });
  bezelGlow.position.set(0, t + 0.0021, d / 2);
  bezelGlow.name = "laptop-screen-emitter";
  group.add(bezelGlow);

  setShadow(group);
  return { group };
}

/** Bateria interna del portatil. */
export function buildLaptopBattery(opts = {}) {
  const w = opts.width || 0.2;
  const d = opts.depth || 0.09;
  const h = opts.height || 0.006;
  const group = new THREE.Group();
  group.name = "laptop-battery";
  const shell = box(w, h, d, "batteryCell");
  group.add(shell);
  for (let i = 0; i < 3; i++) {
    const seam = box(0.001, h * 1.02, d * 0.98, "plasticDark");
    seam.position.x = -w / 2 + (w / 3) * (i + 0.5);
    group.add(seam);
  }
  setShadow(group);
  return group;
}

/** Placa base compacta del portatil (autorada plana, se instala horizontal). */
export function buildLaptopMotherboard(opts = {}) {
  const w = opts.width || 0.24;
  const d = opts.depth || 0.16;
  const t = 0.0018;
  const group = new THREE.Group();
  group.name = "laptop-motherboard";
  const board = box(w, t, d, "pcbBlue");
  group.add(board);

  const socketPos = new THREE.Vector3(-w * 0.18, t, -d * 0.1);
  const socket = box(0.022, 0.0022, 0.022, "plasticBlack");
  socket.position.copy(socketPos);
  group.add(socket);

  const m2Pos = new THREE.Vector3(w * 0.22, t, d * 0.2);
  const m2Slot = box(0.05, 0.0016, 0.004, "plasticDark");
  m2Slot.position.copy(m2Pos);
  group.add(m2Slot);

  const ramPos = new THREE.Vector3(w * 0.02, t, -d * 0.32);
  const ramSlot = box(0.052, 0.002, 0.006, "plasticBlack");
  ramSlot.position.copy(ramPos);
  group.add(ramSlot);

  const wifiPos = new THREE.Vector3(-w * 0.36, t, d * 0.28);

  // Detalle decorativo (auditoria visual de mejora 3D): la placa del
  // portatil quedaba MUY por debajo del nivel de detalle de su equivalente
  // de escritorio (buildMotherboard, arriba) -- una tabla lisa con 3 cajas
  // planas. Nada de esto es funcional/interactivo (ningun partId propio,
  // no afecta anchors ni geometria de las piezas reales): solo blindaje
  // EMI + un puñado de capacitores + el chipset, autenticando la lectura
  // visual sin tocar ninguna posicion de montaje existente.
  const emiShield = box(w * 0.22, 0.0026, d * 0.24, "metalDark");
  emiShield.position.set(w * 0.05, t + 0.0002, d * 0.02);
  group.add(emiShield);

  const chipset = box(0.014, 0.0022, 0.014, "aluminum");
  chipset.position.set(w * 0.3, t, -d * 0.28);
  group.add(chipset);

  for (let i = 0; i < 6; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.0022, 6), materialFor("metalDark"));
    cap.position.set(-w * 0.32 + (i % 3) * 0.012, t + 0.0011, d * 0.1 + Math.floor(i / 3) * 0.012);
    group.add(cap);
  }

  setShadow(group);
  return {
    group,
    dims: { width: w, depth: d, thickness: t },
    anchors: { cpuSocket: socketPos, m2Slot: m2Pos, ramSlot: ramPos, wifiSlot: wifiPos },
  };
}
