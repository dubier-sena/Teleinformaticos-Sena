/* js/hardware_lab_3d_parts_factory.js
 *
 * Geometria 3D real construida por programa (item 30: no hay modelos GLB
 * todavia, pero la arquitectura ya queda lista para sustituir cualquiera de
 * estas funciones por un loader GLTF sin tocar al resto del motor). Cada
 * "build*" devuelve un THREE.Group independiente y liviano en poligonos
 * (item 26). hardware_lab_3d_rig.js decide donde colocar cada uno y le
 * asigna identidad (userData.partId); este archivo no sabe que es "RAM 1" ni
 * "RAM 2", solo sabe construir "una memoria RAM".
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor, materialInstanceFor } from "./hardware_lab_3d_constants.js";

function box(w, h, d, kind, overrides) {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, materialFor(kind, overrides));
}

function cyl(rTop, rBottom, h, kind, segments = 12, overrides) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  return new THREE.Mesh(geo, materialFor(kind, overrides));
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

/** Aspas de ventilador (reutilizado por gabinete, disipador y GPU). */
export function buildFan(diameter = 0.12, opts = {}) {
  const group = new THREE.Group();
  group.name = "fan";
  const radius = diameter / 2;
  const depth = opts.depth || 0.025;

  const frame = box(diameter * 1.05, depth, diameter * 1.05, "plasticBlack");
  frame.name = "fan-frame";
  group.add(frame);

  const hub = cyl(radius * 0.22, radius * 0.22, depth * 1.02, "plasticDark", 10);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  const blades = new THREE.Group();
  blades.name = "fan-blades";
  const bladeCount = opts.blades || 7;
  for (let i = 0; i < bladeCount; i++) {
    const blade = box(radius * 0.75, depth * 0.55, radius * 0.32, "fanBlade");
    blade.position.set(radius * 0.5, 0, 0);
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / bladeCount) * Math.PI * 2;
    pivot.add(blade);
    blades.add(pivot);
  }
  group.add(blades);
  group.userData.spinPart = blades; // referencia para animar giro (fx opcional)

  setShadow(group, true, true);
  return group;
}

/** Tuberia de calor curva (heatpipe) entre dos puntos locales. */
function buildHeatpipe(from, to, radius = 0.0035) {
  const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.015, 0));
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  const geo = new THREE.TubeGeometry(curve, 12, radius, 6, false);
  return new THREE.Mesh(geo, materialFor("copper"));
}

/** Disipador tipo torre (CPU cooler de escritorio) + su ventilador. */
export function buildTowerCooler(opts = {}) {
  const group = new THREE.Group();
  group.name = "cpu-cooler";
  const width = opts.width || 0.13;
  const height = opts.height || 0.155;
  const depth = opts.depth || 0.045;

  const base = cyl(0.022, 0.022, 0.012, "copper", 14);
  base.position.y = 0.006;
  group.add(base);

  const finCount = 16;
  for (let i = 0; i < finCount; i++) {
    const fin = box(width, height, 0.0016, "heatsinkFin");
    fin.position.set(0, height / 2 + 0.012, -depth / 2 + (i / (finCount - 1)) * depth);
    group.add(fin);
  }

  [-0.028, 0.028].forEach((dz) => {
    [0.02, 0.05].forEach((dx, idx) => {
      const from = new THREE.Vector3(idx === 0 ? -0.012 : 0.012, 0.012, dz);
      const to = new THREE.Vector3(dx * (idx === 0 ? -1 : 1), height + 0.01, dz);
      group.add(buildHeatpipe(from, to));
    });
  });

  const fan = buildFan(width * 0.92, { depth: 0.022 });
  fan.rotation.z = Math.PI / 2;
  fan.position.set(0, height / 2 + 0.012, 0);
  group.add(fan);

  setShadow(group);
  return group;
}

/** Modulo de refrigeracion del portatil: bloque de contacto + heatpipe +
 * paquete de aletas (mejora 3D: antes usaba buildGenericPart, una caja lisa
 * de un solo color -- el unico "disipador" del laboratorio sin geometria
 * propia, notorio en el preset "Refrigeracion" y el modo didactico (ambos lo
 * señalan por nombre). Proporciones pensadas para el hueco delgado real de
 * un portatil: mucho mas chato que la torre de escritorio, buildTowerCooler. */
export function buildLaptopCooler(opts = {}) {
  const width = opts.width || 0.02;
  const height = opts.height || 0.006;
  const depth = opts.depth || 0.11;
  const group = new THREE.Group();
  group.name = "laptop-cooler";

  // Bloque de contacto con la CPU, en un extremo.
  const base = box(width * 0.85, height * 0.85, width * 0.9, "copper");
  base.position.z = -depth / 2 + width * 0.5;
  group.add(base);

  // Heatpipe: tubo delgado que recorre el largo del modulo hasta las aletas.
  const pipe = cyl(height * 0.28, height * 0.28, depth * 0.75, "copper", 8);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.z = depth * 0.05;
  group.add(pipe);

  // Paquete de aletas en el extremo opuesto (sale hacia el borde del equipo).
  const finCount = 9;
  for (let i = 0; i < finCount; i++) {
    const fin = box(width * 0.95, height * 0.95, 0.001, "heatsinkFin");
    fin.position.z = depth * 0.3 + (i / (finCount - 1)) * (depth * 0.18);
    group.add(fin);
  }

  setShadow(group);
  return group;
}

/** CPU: sustrato ceramico + tapa metalica (IHS). */
export function buildCpu(opts = {}) {
  const group = new THREE.Group();
  group.name = "cpu";
  const size = opts.size || 0.04;
  const substrate = box(size, 0.0028, size, "plasticDark", { color: 0x0b3d1f });
  group.add(substrate);
  const ihs = box(size * 0.92, 0.0022, size * 0.92, "metalBrushed");
  ihs.position.y = 0.0028 / 2 + 0.0022 / 2;
  group.add(ihs);
  const notch = box(size * 0.06, 0.0026, size * 0.06, "plasticBlack");
  notch.position.set(-size / 2 + size * 0.05, 0.0001, -size / 2 + size * 0.05);
  group.add(notch);
  setShadow(group);
  return group;
}

/** Socket de CPU con palanca de retencion. */
export function buildCpuSocket(opts = {}) {
  const group = new THREE.Group();
  group.name = "cpu-socket";
  const size = opts.size || 0.046;
  const frame = box(size, 0.003, size, "plasticBlack");
  group.add(frame);
  const lever = box(size * 0.85, 0.003, 0.004, "metalSteel");
  lever.position.set(0, 0.003, size / 2 + 0.002);
  lever.name = "socket-lever";
  group.add(lever);
  setShadow(group);
  return group;
}

/** Memoria RAM (DIMM de escritorio). */
export function buildRamStick(opts = {}) {
  const group = new THREE.Group();
  group.name = "ram-stick";
  const width = opts.width || 0.133;
  const bodyH = opts.bodyHeight || 0.03;
  const heatspreaderH = opts.heatspreaderHeight || 0.008;
  const thickness = opts.thickness || 0.0035;

  const pcb = box(width, bodyH, thickness * 0.5, "pcbGreen");
  group.add(pcb);

  const heatspreader = box(width * 0.97, bodyH + heatspreaderH, thickness, "plasticDark", { color: 0x24262b });
  heatspreader.position.y = heatspreaderH / 2;
  group.add(heatspreader);

  const accent = box(width * 0.97, 0.0035, thickness + 0.0006, "metalDark", { color: 0x35d0ff, roughness: 0.4, metalness: 0.3 });
  accent.position.y = bodyH * 0.18;
  group.add(accent);

  const contacts = box(width * 0.93, 0.004, thickness * 0.4, "goldPin");
  contacts.position.y = -bodyH / 2 - 0.001;
  group.add(contacts);

  setShadow(group);
  return group;
}

/**
 * Modulo de RAM completo: N sticks juntos como UN solo grupo interactivo
 * (el motor de datos trata "ram" como una sola pieza booleana aunque un PC
 * real tenga 2-4 modulos, ver hardware_lab_data_desktop.js/laptop.js).
 */
export function buildRamModule(count = 2, opts = {}) {
  const group = new THREE.Group();
  group.name = "ram-module";
  const gap = opts.gap != null ? opts.gap : 0.017;
  for (let i = 0; i < count; i++) {
    const stick = buildRamStick(opts.stickOpts || {});
    stick.position.z = (i - (count - 1) / 2) * gap;
    group.add(stick);
  }
  setShadow(group);
  return group;
}

/** Ranura DIMM con seguros laterales (item 4: abrir seguro -> levantar -> extraer). */
export function buildRamSlot(opts = {}) {
  const group = new THREE.Group();
  group.name = "ram-slot";
  const width = opts.width || 0.14;
  const base = box(width, 0.006, 0.012, "plasticBlack");
  group.add(base);
  const latchGeo = new THREE.BoxGeometry(0.012, 0.014, 0.006);
  const latchL = new THREE.Mesh(latchGeo, materialInstanceFor("plasticBlack"));
  latchL.position.set(-width / 2 - 0.002, 0.008, 0);
  latchL.name = "latch-left";
  const latchR = latchL.clone();
  latchR.material = materialInstanceFor("plasticBlack");
  latchR.position.x = width / 2 + 0.002;
  latchR.name = "latch-right";
  group.add(latchL, latchR);
  setShadow(group);
  return group;
}

/** Tarjeta grafica (shroud + doble ventilador + backplate). */
export function buildGpu(opts = {}) {
  const group = new THREE.Group();
  group.name = "gpu";
  const length = opts.length || 0.26;
  const height = opts.height || 0.115;
  const depth = opts.depth || 0.038;

  const pcb = box(length, 0.0022, depth, "pcbBlue");
  pcb.position.y = -height / 2 + 0.001;
  group.add(pcb);

  const shroud = box(length * 0.96, height, depth, "plasticBlack");
  group.add(shroud);

  const backplate = box(length * 0.97, height * 0.95, 0.0025, "aluminum");
  backplate.position.z = -depth / 2 - 0.0015;
  group.add(backplate);

  [-length * 0.25, length * 0.25].forEach((x) => {
    const fan = buildFan(height * 0.82, { depth: 0.018 });
    fan.rotation.x = Math.PI / 2;
    fan.position.set(x, 0, depth / 2 + 0.001);
    group.add(fan);
  });

  const bracket = box(0.02, height * 0.9, 0.004, "metalDark");
  bracket.position.set(-length / 2 - 0.002, 0, -depth / 2 + 0.01);
  bracket.name = "gpu-bracket";
  group.add(bracket);

  const powerNub = box(0.018, 0.012, 0.012, "plasticBlack");
  powerNub.position.set(length * 0.32, height / 2 + 0.006, 0);
  powerNub.name = "gpu-power-connector";
  group.add(powerNub);

  const goldEdge = box(length * 0.5, 0.006, 0.002, "goldPin");
  goldEdge.position.set(-length * 0.18, -height / 2 - 0.001, depth / 2 - 0.002);
  group.add(goldEdge);

  setShadow(group);
  return group;
}

/** Fuente de alimentacion (PSU) con rejilla y cableado. */
export function buildPsu(opts = {}) {
  const group = new THREE.Group();
  group.name = "psu";
  const w = opts.width || 0.15;
  const h = opts.height || 0.086;
  const d = opts.depth || 0.14;

  const shell = box(w, h, d, "metalDark");
  group.add(shell);

  const fan = buildFan(Math.min(w, d) * 0.72, { depth: 0.02 });
  fan.rotation.x = Math.PI / 2;
  fan.position.set(0, h / 2 + 0.001, 0);
  group.add(fan);

  const label = box(w * 0.55, h * 0.4, 0.001, "plasticGray", { color: 0xd8dbe0 });
  label.position.set(0, 0, d / 2 + 0.0006);
  group.add(label);

  // Panel trasero: toma IEC + interruptor + rejilla de ventilacion (mejora
  // 3D: la fuente era una caja lisa con un solo detalle -- la etiqueta --
  // uno de los componentes mas planos segun la auditoria visual, notorio de
  // cerca en el preset "Energia"). Cara opuesta a la etiqueta (-Z); ninguno
  // de estos meshes es interactivo ni afecta un anchor.
  const iecSocket = box(w * 0.16, h * 0.22, 0.006, "plasticBlack");
  iecSocket.position.set(-w * 0.32, -h * 0.1, -d / 2 - 0.002);
  group.add(iecSocket);

  const powerSwitch = box(w * 0.12, h * 0.14, 0.006, "plasticDark", { color: 0x2a2d33 });
  powerSwitch.position.set(-w * 0.12, -h * 0.1, -d / 2 - 0.002);
  group.add(powerSwitch);

  for (let i = 0; i < 5; i++) {
    const slat = box(w * 0.32, 0.003, 0.002, "metalDark", { color: 0x1c1f22 });
    slat.position.set(w * 0.12, -h * 0.28 + i * (h * 0.13), -d / 2 - 0.0015);
    group.add(slat);
  }

  setShadow(group);
  return group;
}

/** SSD 2.5" (delgado y plano). */
export function buildSsd25(opts = {}) {
  const w = opts.width || 0.07;
  const h = opts.height || 0.007;
  const d = opts.depth || 0.1;
  const group = new THREE.Group();
  group.name = "ssd-2-5";
  const shell = box(w, h, d, "metalDark");
  group.add(shell);
  // Auditoria visual de mejora 3D: era una caja lisa sin ningun detalle --
  // la unica pieza de almacenamiento sin etiqueta (buildHdd35, arriba, si
  // tiene una). Misma solucion: una etiqueta clara para que se lea como
  // "unidad SSD real", no como un bloque generico.
  const label = box(w * 0.7, 0.001, d * 0.5, "plasticGray", { color: 0xe7e9ec });
  label.position.y = h / 2 + 0.0006;
  group.add(label);
  setShadow(group);
  return group;
}

/** HDD 3.5" (mas grueso, con etiqueta). */
export function buildHdd35(opts = {}) {
  const group = new THREE.Group();
  group.name = "hdd-3-5";
  const w = opts.width || 0.1;
  const h = opts.height || 0.026;
  const d = opts.depth || 0.147;
  const shell = box(w, h, d, "metalBrushed");
  group.add(shell);
  const label = box(w * 0.75, 0.001, d * 0.55, "plasticGray", { color: 0xe7e9ec });
  label.position.y = h / 2 + 0.0006;
  group.add(label);
  setShadow(group);
  return group;
}

/** SSD M.2 (tarjeta diminuta de una sola cara). */
export function buildM2(opts = {}) {
  const group = new THREE.Group();
  group.name = "m2-ssd";
  const w = opts.width || 0.022;
  const l = opts.length || 0.08;
  const pcb = box(w, 0.0012, l, "pcbBlue");
  group.add(pcb);
  const chip = box(w * 0.7, 0.0018, l * 0.28, "plasticBlack");
  chip.position.set(0, 0.0015, l * 0.12);
  group.add(chip);
  const gold = box(w * 0.85, 0.0009, 0.006, "goldPin");
  gold.position.set(0, -0.0001, -l / 2 + 0.002);
  group.add(gold);
  setShadow(group);

  // Proxy de clic invisible (item de mejora 3D: el M.2 real mide ~2.2cm de
  // ancho y apenas ~1-2mm de alto, la pieza mas fina y dificil de acertar
  // del laboratorio. Mismo criterio que en buildCable()). Se agrega DESPUES
  // de setShadow(group) a proposito (mejora 3D): setShadow() fuerza
  // castShadow/receiveShadow=true en todo lo que encuentre en el grupo en
  // ese momento -- si el proxy se agregara antes, su castShadow=false de
  // abajo quedaria pisado y una malla invisible terminaria proyectando una
  // sombra visible con la forma/tamano del hitbox ampliado, no de la pieza
  // real (bug silencioso: nunca lanza excepcion, solo se ve mal).
  const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w * 2.2, 0.012, l * 1.08), hitBoxMat);
  hitBox.name = "m2-hit-proxy";
  hitBox.castShadow = false;
  hitBox.receiveShadow = false;
  group.add(hitBox);

  return group;
}

/** Tornillo generico (cabeza + vastago), reutilizado en todo el equipo. */
export function buildScrew(opts = {}) {
  const group = new THREE.Group();
  group.name = "screw";
  const headR = opts.headRadius || 0.0055;
  const shaftR = opts.shaftRadius || 0.0026;
  const shaftLen = opts.shaftLength || 0.012;

  const head = cyl(headR, headR, 0.003, "screwHead", 8);
  group.add(head);
  const slotA = box(headR * 1.5, 0.0032, headR * 0.28, "plasticBlack");
  const slotB = slotA.clone();
  slotB.material = materialInstanceFor("plasticBlack");
  slotB.rotation.y = Math.PI / 2;
  group.add(slotA, slotB);

  const shaft = cyl(shaftR, shaftR * 0.7, shaftLen, "screwHead", 8);
  shaft.position.y = -shaftLen / 2 - 0.0014;
  group.add(shaft);

  setShadow(group);
  return group;
}

/** Cable curvo entre dos puntos locales (ATX/EPS/SATA/panel frontal). */
export function buildCable(kind, fromLocal, toLocal, opts = {}) {
  const group = new THREE.Group();
  group.name = "cable-" + kind;
  const sagAmount = opts.sag != null ? opts.sag : 0.03;
  const mid = fromLocal.clone().lerp(toLocal, 0.5);
  mid.y -= sagAmount;
  const curve = new THREE.CatmullRomCurve3([fromLocal, mid, toLocal]);
  const radius = opts.radius || (kind === "sata" ? 0.0035 : kind === "front-panel" ? 0.0012 : 0.0045);
  const tubeGeo = new THREE.TubeGeometry(curve, 16, radius, 6, false);
  const cableMat = materialFor(kind === "sata" ? "cableSleeved" : "cableBlack");
  const tube = new THREE.Mesh(tubeGeo, cableMat);
  group.add(tube);

  const plugSize = kind === "atx24" ? 0.02 : kind === "eps" ? 0.014 : kind === "sata" ? 0.01 : 0.006;
  [fromLocal, toLocal].forEach((pt, i) => {
    const plug = box(plugSize, plugSize * 0.7, plugSize * 0.9, "plasticBlack");
    plug.position.copy(pt);
    plug.name = "cable-plug-" + (i === 0 ? "from" : "to");
    group.add(plug);
  });
  setShadow(group);

  // Proxy de clic invisible (item de mejora 3D: piezas pequenas dificiles
  // de acertar con mouse/touchpad): un tubo mas grueso, sin renderizar
  // nada (opacity 0, no cast/receive shadow), que SI participa en el
  // raycasting -- registerInteractive() registra el GRUPO completo, asi
  // que agregar este mesh extra amplia el area clicable del cable sin
  // tocar la geometria visible en absoluto. 4x el radio visible: sigue
  // siendo delgado en terminos absolutos, pero el area de clic real
  // (proporcional al radio) queda ~16x mayor. Se agrega DESPUES de
  // setShadow(group) a proposito (mejora 3D): ver el comentario equivalente
  // en buildM2 -- de lo contrario esta malla invisible terminaria
  // proyectando una sombra visible con la forma del hitbox ampliado.
  const hitGeo = new THREE.TubeGeometry(curve, 16, Math.max(radius * 4, 0.006), 6, false);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.name = "cable-hit-proxy";
  hitProxy.castShadow = false;
  hitProxy.receiveShadow = false;
  group.add(hitProxy);

  group.userData.curveEndpoints = [fromLocal.clone(), toLocal.clone()];
  return group;
}

/** Puerto/conector generico (USB, audio, red) para el I/O trasero o frontal. */
export function buildPort(kind = "usb", opts = {}) {
  const w = opts.width || 0.014;
  const h = opts.height || 0.007;
  const d = opts.depth || 0.01;
  const kindColor = { usb: 0x1c1e22, audio: 0x1fb15a, ethernet: 0xd8b23a, hdmi: 0x1c1e22, display: 0x1c1e22 };
  const g = box(w, h, d, "plasticBlack", { color: kindColor[kind] || 0x1c1e22 });
  g.name = "port-" + kind;
  setShadow(g);
  return g;
}

/** Caja generica: red de seguridad para cualquier id de pieza sin modelo dedicado (item 30). */
export function buildGenericPart(opts = {}) {
  const w = opts.width || 0.05;
  const h = opts.height || 0.03;
  const d = opts.depth || 0.05;
  const g = box(w, h, d, opts.materialKind || "plasticGray");
  g.name = "generic-part";
  setShadow(g);

  // Proxy de clic invisible opcional (mejora 3D, item 6): algunas piezas
  // "generic" son muy chicas/finas (p.ej. la tarjeta Wi-Fi del portatil,
  // ~3mm de alto) y dificiles de acertar con mouse/touchpad. Opt-in via
  // buildOpts.hitPadding para no ampliar el area clicable de las piezas
  // "generic" que ya tienen un tamano razonable (la mayoria). Se agrega
  // DESPUES de setShadow(g) a proposito, mismo motivo que en buildM2/
  // buildCable: evita que la malla invisible termine proyectando sombra.
  if (opts.hitPadding) {
    const pad = opts.hitPadding;
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w + pad, h + pad, d + pad), hitMat);
    hit.name = "generic-hit-proxy";
    hit.castShadow = false;
    hit.receiveShadow = false;
    g.add(hit);
  }

  return g;
}
