/* js/hardware_lab_3d_laptop_factory.js
 *
 * Geometria PROPIA del portatil del laboratorio 3D, reconstruida por sistemas
 * (carcasa, placa base, refrigeracion, RAM, almacenamiento, Wi-Fi, bateria,
 * pantalla/bisagras y puertos).
 *
 * Por que un archivo nuevo en vez de seguir dentro de
 * hardware_lab_3d_chassis_factory.js: ese archivo es COMPARTIDO con el equipo
 * de escritorio y ya rondaba las 500 lineas. El portatil necesita mucho mas
 * detalle (sockets, chips, conectores, tornillos, rejillas, puertos), asi que
 * vive aparte y chassis_factory.js solo re-exporta. El escritorio no se toca.
 *
 * Todas las medidas son METROS y siguen las proporciones de un portatil real
 * de 14": base 330 x 230 x 21 mm, SO-DIMM 67.6 x 30 x 3.8 mm, M.2 2280
 * 22 x 80 mm, M.2 2230 (Wi-Fi) 22 x 30 mm. Mantener las proporciones reales es
 * lo que hace que el conjunto se lea como un equipo y no como cajas sueltas.
 *
 * REFERENCIA: se observo el simulador clasico de Cisco UNICAMENTE para
 * entender que nivel de detalle y que separacion de piezas hacen reconocible
 * un portatil desarmado. No se copio ni se reutilizo ningun archivo, imagen,
 * modelo, SWF, XML, textura, texto ni codigo suyo: toda la geometria y los
 * materiales de aqui son propios y se generan proceduralmente.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor, materialInstanceFor } from "./hardware_lab_3d_constants.js";
import {
  batteryLabelTexture,
  chipMarkingTexture,
  fanLabelTexture,
  keyboardLegendTexture,
  laptopBoardTexture,
  moduleLabelTexture,
  shieldLidTexture,
  silkTextTexture,
  smdPassiveTexture,
} from "./hardware_lab_3d_textures.js";

// ── Medidas maestras del equipo ───────────────────────────────────────────
//
// ACCESO DE SERVICIO (fase 3, sep-2026). En un portatil real el cuerpo base
// es el "top case" (reposamanos + paredes) y la TAPA INFERIOR es su piso: al
// retirarla quedan a la vista bateria, RAM, SSD, Wi-Fi y refrigeracion. La
// fase 2 tenia ademas un piso macizo propio y todas las piezas montadas
// ENCIMA de el, mirando hacia el teclado: al retirar la tapa inferior solo se
// veia ese piso (medido con raycast: 10 de los 18 pasos del desensamble
// apuntaban a piezas visibles en 0-3 % de las direcciones de camara, y solo
// se podian seleccionar "a traves" del chasis). Ahora:
//   - la base no tiene piso: lo cierra la tapa inferior;
//   - la placa va bajo el teclado con la cara de componentes HACIA ABAJO;
//   - RAM, SSD, Wi-Fi, CPU y refrigeracion cuelgan de esa cara;
//   - la bateria apoya sobre la tapa inferior, bajo el reposamanos.
// Colores de la CARCASA del portatil (sep-2026): antes usaba la paleta
// "aluminum" (0xc7ccd4) y el reposamanos 0xb3bac4, que con el tone mapping
// ACES se veian casi BLANCOS, como una maqueta. Un portatil de servicio real
// es gris oscuro/grafito (referencia visual local del simulador clasico).
// Solo afecta al portatil: el material "aluminum" compartido con el escritorio
// no se toca, se pasa el color como override. Elegido comparando capturas con
// contraste suficiente del interior (placa, cobre, cables) contra la carcasa.
export const LAPTOP_SHELL = {
  deck: 0x4a4e55,    // reposamanos
  wall: 0x3f434a,    // paredes del cuerpo y dorso de la pantalla
  cover: 0x363a40,   // tapa inferior
};

// Materiales de BATERIA y TECLADO (sep-2026). Con la luz de la escena (key
// 5.5, hemisferica 2.4, compartida con el escritorio y que no se toca) un
// plastico "negro" con rugosidad media refleja tanto que se ve gris claro:
// medido en la captura, las teclas 0x212429 daban luminancia 178/255 y las
// celdas de la bateria 145 en la bandeja (se leian azul claro). Mas rugosidad
// abre el reflejo especular y envMapIntensity baja el del entorno; solo asi
// el plastico oscuro se ve oscuro. Valores elegidos midiendo la luminancia de
// la captura (0-255) en 3 contextos de luz: teclas 95 contra huecos 130 (cada
// tecla se distingue) con leyendas legibles; celdas 118 contra marco 89 en la
// bandeja y 31 contra 20 vistas desde abajo (se reconocen como celdas).
const BATTERY_LOOK = {
  enclosure: { color: 0x0b0c0d, roughness: 0.92, metalness: 0, envMapIntensity: 0.25 },
  cells: { color: 0x1e2024, roughness: 0.88, metalness: 0.05, envMapIntensity: 0.3 },
  seam: { color: 0x08090a, roughness: 0.9, metalness: 0, envMapIntensity: 0.2 },
};
const KEYBOARD_LOOK = {
  plate: { color: 0x2a2d33, roughness: 0.8, metalness: 0.05, envMapIntensity: 0.4 },
  keys: { color: 0x0c0d0f, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 },
  bevel: { color: 0x101113, roughness: 0.93, metalness: 0, envMapIntensity: 0.25 },
};

// Silicio desnudo de los dies del SoC (sep-18).
const SILICON_LOOK = { color: 0x2a313b, roughness: 0.14, metalness: 0.45 };

export const LAPTOP = {
  width: 0.33,
  depth: 0.23,
  height: 0.021,   // antes 14mm: no cabian bateria + placa + refrigeracion sin atravesarse
  wall: 0.002,
  get innerY() { return this.wall; },
  get topY() { return this.height; },
  // Reposamanos (top case): chapa de 1.6 mm cuya cara superior es `height`.
  deckThickness: 0.0016,
  get deckBottomY() { return this.height - this.deckThickness; },
  // Placa base (espacio de la base). centerZ en la banda trasera; su borde
  // trasero queda por delante de las bisagras.
  board: { width: 0.30, depth: 0.072, thickness: 0.0016, centerY: 0.0164, centerZ: -0.063 },
  get boardFaceY() { return this.board.centerY - this.board.thickness / 2; },
  // Eje de bisagra en el borde superior trasero: la tapa gira POR ENCIMA del
  // reposamanos en vez de atravesarlo (fase 2: 4.1 mm de penetracion medida).
  hinge: { x: 0.112, y: 0.0210, z: -0.1095, radius: 0.0035, length: 0.026 },
};

// ── Geometrias reutilizadas ───────────────────────────────────────────────
// Un portatil detallado mete cientos de tornillos/chips/pines identicos. Se
// comparte la MISMA geometria entre todas las instancias (solo cambia la
// matriz) para no multiplicar memoria ni draw calls en una GPU integrada.
const GEO = {};
function unitBox() {
  if (!GEO.box) GEO.box = new THREE.BoxGeometry(1, 1, 1);
  return GEO.box;
}
function cyl(rt, rb, h, seg) {
  const key = `c${rt}_${rb}_${h}_${seg}`;
  if (!GEO[key]) GEO[key] = new THREE.CylinderGeometry(rt, rb, h, seg);
  return GEO[key];
}

/** Caja por escala sobre una geometria unitaria compartida. */
function box(w, h, d, kind, overrides) {
  const m = new THREE.Mesh(unitBox(), materialFor(kind, overrides));
  m.scale.set(w, h, d);
  return m;
}
function put(parent, mesh, x, y, z) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
// El portatil detallado tiene cientos de piezas diminutas (contactos, tornillos,
// teclas, chips). Proyectar sombra desde TODAS duplica las llamadas de dibujo
// (un pase extra por mesh para el shadow map) sin ninguna ganancia visual: la
// sombra de un contacto de 0.6 mm no se ve a ninguna distancia util. Solo
// proyectan sombra los meshes cuya arista mayor supera SHADOW_MIN_SIZE; el
// resto la RECIBE igual, que es lo que de verdad les da volumen.
const SHADOW_MIN_SIZE = 0.008;   // 8 mm

function setShadow(obj, cast = true, receive = true) {
  obj.traverse((n) => {
    if (!n.isMesh) return;
    let big = true;
    if (cast) {
      const s = n.scale;
      const geo = n.geometry;
      if (geo && geo.type === "BoxGeometry") {
        big = Math.max(s.x, s.y, s.z) >= SHADOW_MIN_SIZE;
      } else if (geo && geo.boundingSphere !== undefined) {
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        big = geo.boundingSphere.radius * Math.max(s.x, s.y, s.z) >= SHADOW_MIN_SIZE / 2;
      }
    }
    n.castShadow = cast && big;
    n.receiveShadow = receive;
  });
  return obj;
}


/**
 * Malla instanciada: N copias de la MISMA caja unitaria en una sola llamada de
 * dibujo. Se usa para los grupos numerosos e identicos (teclas, aletas, aspas,
 * contactos). Baja mucho el numero de draw calls, que es el coste que de
 * verdad importa en las GPU integradas de los equipos escolares.
 * `items` = [{ x, y, z, w, h, d, ry }].
 */
function instancedBoxes(items, kind, overrides) {
  const mesh = new THREE.InstancedMesh(unitBox(), materialFor(kind, overrides), items.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  items.forEach((it, i) => {
    pos.set(it.x, it.y, it.z);
    scl.set(it.w, it.h, it.d);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.ry || 0);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}


/**
 * PCB con contorno y RECORTES REALES (fase 2).
 *
 * Las muescas del SO-DIMM y del M.2 estaban simuladas con un bloque oscuro
 * encima: de cerca se notaba que el PCB seguia entero por debajo. Se evaluo
 * CSG (three-bvh-csg / three-csg-ts) y se DESCARTO: son dependencias de cientos
 * de KB para un recorte que three.js ya sabe hacer de fabrica. THREE.Shape
 * acepta `holes` y ExtrudeGeometry los respeta, asi que el hueco es geometria
 * de verdad -- se ve a traves de el -- sin sumar ni una dependencia.
 *
 * `outline` y `holes` son listas de puntos [x, z] en milimetros locales; el
 * grosor se extruye en Y. Se devuelve ya tumbada (plano XZ).
 */
function buildNotchedPcb(outline, holes, thickness, kind, overrides) {
  // Shape trabaja en XY y ExtrudeGeometry extruye en +Z. Al tumbar la pieza con
  // rotateX(-90) el mapeo real es (x, y, z) -> (x, z, -y): el eje Y del shape
  // termina INVERTIDO en Z. Por eso los puntos entran como (x, -z) -- sin esto
  // la pieza sale espejada y la muesca de contactos aparece en el lado
  // contrario al socket (bug real detectado al mirar la captura de detalle).
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  (holes || []).forEach((h) => {
    const path = new THREE.Path();
    h.forEach(([x, z], i) => (i === 0 ? path.moveTo(x, -z) : path.lineTo(x, -z)));
    path.closePath();
    shape.holes.push(path);
  });
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  // Tras rotar, la extrusion ocupa y = 0..thickness: se baja media altura para
  // dejarla CENTRADA en el origen, como las cajas del resto de la factory
  // (antes se subia +thickness/2, dejando el PCB 1.5 grosores por encima de sus
  // propios chips).
  geo.translate(0, -thickness / 2, 0);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, materialFor(kind, overrides));
}

/** Tornillo pequeño: cabeza + ranura. Geometria compartida. */
// Teclado y touchpad (sep-2026): 2 tornillos cada uno, desde abajo. La cabeza
// aprieta un soporte del chasis (pletina / travesano de buildLaptopBase) y la
// rosca entra en un boss propio de la pieza (addThreadedBosses). X absoluta.
export const LAPTOP_KEYBOARD_SCREW_X = 0.110;
export const LAPTOP_TOUCHPAD_SCREW_X = 0.035;
// Pantalla (sep-2026): apertura instalada de la tapa (giro en X sobre el eje
// de bisagra; ~100 grados desde la horizontal). La usa el layout como
// rotationEuler y buildLaptopLid para compensar la hoja de bisagra.
export const LAPTOP_LID_OPEN_ANGLE = -1.75;
// Tramo del soporte de bisagra (chasis) que queda bajo el nudillo de la TAPA:
// ahi se rebaja para alojar la hoja de bisagra de la pantalla.
const HINGE_LEAF_X0 = 0.1122, HINGE_LEAF_X1 = 0.125;
const HINGE_LEAF_T = 0.0009;
// Cara superior de la hoja: toca el nudillo de la tapa (radio 3.5 bajo el eje
// a 21 mm). El tramo exterior del soporte baja hasta su cara inferior.
const HINGE_LEAF_TOP_Y = 0.0175;
const HINGE_BRACKET_BOTTOM_Y = 0.0135, HINGE_BRACKET_TOP_Y = 0.0174;
const HINGE_LEAF_Z0 = -0.1125, HINGE_LEAF_Z1 = -0.1045;
// Z de los tornillos de bisagra = anclaje hingeBracket (-d/2 + pared + 5 mm).
const HINGE_SCREW_Z = -0.108;
// X de los 2 tornillos de cada bisagra (valor absoluto), ambos bajo la hoja.
export const LAPTOP_SCREEN_SCREW_X = [0.1145, 0.121];
// Z del tornillo del teclado respecto de su montaje (keyboardMount).
export const LAPTOP_KEYBOARD_SCREW_DZ = 0.018;
const THREADED_BOSS_R = 0.0024;
const THREADED_BOSS_H = 0.0015;
// Espesor de la chapa del soporte que aprieta la cabeza.
const SCREW_BRACKET_T = 0.0008;

/** Dos bosses roscados en +-x que BAJAN desde `topY` (coordenadas locales de
 *  la pieza), con el inserto de laton a la vista en su cara inferior. */
function addThreadedBosses(g, x, topY, z, color) {
  [-1, 1].forEach((s) => {
    const boss = new THREE.Mesh(cyl(THREADED_BOSS_R, THREADED_BOSS_R, THREADED_BOSS_H, 16), materialFor("plasticDark", { color }));
    boss.name = "threaded-boss";
    put(g, boss, s * x, topY - THREADED_BOSS_H / 2, z);
    put(g, new THREE.Mesh(cyl(0.0017, 0.0017, 0.0002, 12), materialFor("goldPin", { color: 0xb08d4a, roughness: 0.42, metalness: 0.72 })), s * x, topY - THREADED_BOSS_H + 0.0001, z);
  });
}

/** Poligono circular [x, z] (agujeros de buildNotchedPcb). */
function circlePoints(cx, cz, r, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

export function buildSmallScrew(r = 0.0016) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(cyl(r, r, 0.0008, 8), materialFor("screwHead"));
  head.rotation.x = 0; // eje Y = normal de la placa
  g.add(head);
  const slot = box(r * 1.5, 0.0003, r * 0.35, "plasticBlack");
  slot.position.y = 0.0005;
  g.add(slot);
  return g;
}

/** Chip encapsulado (BGA/QFN) con su marca de pin 1. */
export function buildChip(w, d, h = 0.0011, kind = "chipBlack") {
  const g = new THREE.Group();
  g.add(box(w, h, d, kind));
  const dot = new THREE.Mesh(cyl(Math.min(w, d) * 0.08, Math.min(w, d) * 0.08, 0.0002, 6), materialFor("plasticGray"));
  dot.position.set(-w * 0.35, h / 2 + 0.0001, -d * 0.35);
  g.add(dot);
  return g;
}

/** Condensador electrolitico/ceramico segun radio. */
function buildCap(r, h) {
  return new THREE.Mesh(cyl(r, r, h, 8), materialFor("capBrown"));
}

/** Hilera de contactos dorados (borde de un modulo o de un socket). */
function buildGoldFingers(parent, count, spanX, y, z, pinW, pinD) {
  const step = spanX / count;
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({ x: -spanX / 2 + step * (i + 0.5), y, z, w: pinW, h: 0.0004, d: pinD });
  }
  parent.add(instancedBoxes(items, "goldPin"));
}

// ── Puertos externos del portatil ─────────────────────────────────────────
// Tabla unica: la usan buildLaptopBase (boca en la pared) y
// buildLaptopMotherboard (conector soldado en el borde). Asi ningun puerto
// visible por fuera queda sin su correspondencia interna.
// `along` en espacio de la base. Todos quedan DENTRO de la banda de la placa
// (z -99..-27 mm): en la fase 2, audio, USB izquierdo y RJ45 caian por delante
// de la placa y no tenian conector al que llegar.
export const LAPTOP_PORTS = [
  { id: "power-in", side: "left", along: -0.088, kind: "power", w: 0.008, h: 0.006 },
  { id: "hdmi", side: "left", along: -0.072, kind: "hdmi", w: 0.015, h: 0.0055 },
  { id: "usb-a-left", side: "left", along: -0.056, kind: "usb", w: 0.013, h: 0.0055 },
  { id: "audio-jack", side: "left", along: -0.042, kind: "audio", w: 0.007, h: 0.007 },
  { id: "usb-a-right", side: "right", along: -0.086, kind: "usb", w: 0.013, h: 0.0055 },
  { id: "usb-c-right", side: "right", along: -0.070, kind: "usbc", w: 0.009, h: 0.0035 },
  { id: "rj45", side: "right", along: -0.052, kind: "rj45", w: 0.016, h: 0.012 },
];

/* ══════════════════════════════════════════════════════════════════════════
   1. CARCASA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Chasis inferior: bandeja con piso, 4 paredes, refuerzos internos, torres de
 * tornillo, huecos de puerto y rejilla de extraccion trasera. No es un bloque
 * macizo: la cavidad es el espacio real donde viven placa, bateria y
 * refrigeracion.
 */
export function buildLaptopBase(opts = {}) {
  const w = opts.width || LAPTOP.width;
  const d = opts.depth || LAPTOP.depth;
  const h = opts.height || LAPTOP.height;
  const wall = LAPTOP.wall;
  const group = new THREE.Group();
  group.name = "laptop-base";

  // SIN PISO (fase 3): el piso del cuerpo base es la tapa inferior removible.
  // Con un piso macizo aqui, retirar la tapa inferior no dejaba ver nada.
  // Un reborde interior muy bajo recorre el perimetro: es donde apoya el
  // labio de la tapa inferior y evita que el canto de las paredes se vea
  // como una lamina sin espesor desde abajo.
  const rim = 0.0016;
  put(group, box(w - wall * 2, rim, 0.0025, "metalDark", { color: 0x3c4149 }), 0, rim / 2, -d / 2 + wall + 0.00125);
  put(group, box(w - wall * 2, rim, 0.0025, "metalDark", { color: 0x3c4149 }), 0, rim / 2, d / 2 - wall - 0.00125);
  put(group, box(0.0025, rim, d - wall * 2 - 0.005, "metalDark", { color: 0x3c4149 }), -w / 2 + wall + 0.00125, rim / 2, 0);
  put(group, box(0.0025, rim, d - wall * 2 - 0.005, "metalDark", { color: 0x3c4149 }), w / 2 - wall - 0.00125, rim / 2, 0);

  // Paredes. La trasera se parte en 3 tramos para dejar el hueco real de la
  // salida de aire del disipador (izquierda) en vez de pintar una rejilla
  // decorativa pegada por fuera.
  const ventW = w * 0.22, ventX = -w * 0.26;
  const backLeftW = (ventX - ventW / 2) - (-w / 2);
  put(group, box(backLeftW, h, wall, "aluminum", { color: LAPTOP_SHELL.wall }), -w / 2 + backLeftW / 2, h / 2, -d / 2 + wall / 2);
  const backRightStart = ventX + ventW / 2;
  const backRightW = w / 2 - backRightStart;
  put(group, box(backRightW, h, wall, "aluminum", { color: LAPTOP_SHELL.wall }), backRightStart + backRightW / 2, h / 2, -d / 2 + wall / 2);
  // Dintel sobre el hueco de ventilacion (la pared no desaparece del todo).
  put(group, box(ventW, h * 0.28, wall, "aluminum", { color: LAPTOP_SHELL.wall }), ventX, h - h * 0.14, -d / 2 + wall / 2);

  put(group, box(w, h, wall, "aluminum", { color: LAPTOP_SHELL.wall }), 0, h / 2, d / 2 - wall / 2);
  put(group, box(wall, h, d, "aluminum", { color: LAPTOP_SHELL.wall }), -w / 2 + wall / 2, h / 2, 0);
  put(group, box(wall, h, d, "aluminum", { color: LAPTOP_SHELL.wall }), w / 2 - wall / 2, h / 2, 0);

  // Rejilla de la salida de aire: laminas verticales dentro del hueco.
  for (let i = 0; i < 9; i++) {
    const slat = box(0.0012, h * 0.55, 0.0016, "plasticDark", { color: 0x0e0f11 });
    put(group, slat, ventX - ventW / 2 + (ventW / 9) * (i + 0.5), h * 0.34, -d / 2 + wall / 2);
  }

  // Torres (bosses) de los tornillos de la tapa inferior: columnas que bajan
  // del reposamanos hasta la tapa. Solo en el perimetro: una columna en el
  // centro del equipo cortaria el paso de los cables (se midio). Cada torre
  // coincide con un tornillo de buildLaptopBottomCover (LAPTOP_COVER_SCREWS).
  const deckBottom = h - LAPTOP.deckThickness;
  // Moldeadas con el chasis (su mismo color: en metal claro se leian como
  // tubos blancos sueltos) y con el inserto roscado de laton a la vista.
  LAPTOP_COVER_SCREWS.forEach(([x, z]) => {
    const colH = deckBottom - rim;
    const t = new THREE.Mesh(cyl(0.0026, 0.0032, colH, 12), materialFor("aluminum", { color: LAPTOP_SHELL.wall }));
    put(group, t, x, rim + colH / 2, z);
    put(group, new THREE.Mesh(cyl(0.0017, 0.0017, 0.0005, 12), materialFor("goldPin", { color: 0xb08d4a, roughness: 0.42, metalness: 0.72 })), x, rim + 0.0002, z);
    const hole = new THREE.Mesh(cyl(0.0012, 0.0012, 0.0006, 8), materialFor("plasticBlack"));
    put(group, hole, x, rim + 0.0002, z);
  });

  // Torres de la bateria (sep-2026): mismo molde que las de la tapa, pero bajan
  // del reposamanos solo hasta la cara superior de la oreja del pack (la
  // bateria sale por abajo, asi que la oreja se separa de la torre sin
  // engancharse). Fuera del pack: el tornillo ya no lo atraviesa.
  const batteryScrewZ = d * 0.22 + LAPTOP_BATTERY_SCREW_DZ;
  [-1, 1].forEach((s) => {
    const x = s * LAPTOP_BATTERY_SCREW_X;
    const y0 = LAPTOP_BATTERY_EAR_TOP_Y;
    const colH = deckBottom - y0;
    const t = new THREE.Mesh(cyl(0.0026, 0.0032, colH, 12), materialFor("aluminum", { color: LAPTOP_SHELL.wall }));
    t.name = "battery-tower";
    put(group, t, x, y0 + colH / 2, batteryScrewZ);
    put(group, new THREE.Mesh(cyl(0.0017, 0.0017, 0.0005, 12), materialFor("goldPin", { color: 0xb08d4a, roughness: 0.42, metalness: 0.72 })), x, y0 + 0.00025, batteryScrewZ);
    put(group, new THREE.Mesh(cyl(0.0012, 0.0012, 0.0006, 8), materialFor("plasticBlack")), x, y0 + 0.0003, batteryScrewZ);
  });

  // Soportes del teclado (sep-2026): una pletina por lado, atornillada a la
  // cara interior de la pared lateral y que llega bajo el boss del teclado.
  // La cabeza del tornillo la aprieta desde abajo; el teclado sale hacia
  // arriba y la pletina queda en el chasis.
  const kbScrewZ = -d * 0.10 + LAPTOP_KEYBOARD_SCREW_DZ;
  const kbPlateTop = (h - 0.0022) - 0.0011 - THREADED_BOSS_H;   // cara inferior de los bosses
  const wallIn = w / 2 - wall;
  [-1, 1].forEach((s) => {
    const x0 = LAPTOP_KEYBOARD_SCREW_X - 0.004;
    const plate = box(wallIn - x0, SCREW_BRACKET_T, 0.008, "metalSteel", { color: 0x6d737b, roughness: 0.48, metalness: 0.6 });
    plate.name = "keyboard-bracket";
    put(group, plate, s * (x0 + wallIn) / 2, kbPlateTop - SCREW_BRACKET_T / 2, kbScrewZ);
  });

  // Soporte del touchpad (sep-2026): travesano de chapa bajo el touchpad,
  // colgado del reposamanos por dos colgantes FUERA de su hueco (x +-53 mm).
  // Los tornillos del touchpad lo aprietan desde abajo y roscan en los bosses
  // del modulo (buildLaptopTouchpad), que sale hacia arriba sin engancharse.
  const tpZ = d * 0.335;
  const tpBarTop = deckBottom - 0.0023 + SCREW_BRACKET_T;   // cara inferior de los bosses
  const bracketLook = { color: 0x6d737b, roughness: 0.48, metalness: 0.6 };
  const tpBar = box(0.124, SCREW_BRACKET_T, 0.008, "metalSteel", bracketLook);
  tpBar.name = "touchpad-bracket";
  put(group, tpBar, 0, tpBarTop - SCREW_BRACKET_T / 2, tpZ);
  [-1, 1].forEach((s) => {
    const hangH = deckBottom - tpBarTop;
    const hanger = box(0.006, hangH, 0.008, "metalSteel", bracketLook);
    hanger.name = "touchpad-bracket";
    put(group, hanger, s * 0.059, tpBarTop + hangH / 2, tpZ);
  });

  // Bisagras: barriles en el borde SUPERIOR trasero (asoman sobre el
  // reposamanos, como las de un portatil real) y su soporte atornillado por
  // dentro. El eje coincide con `hingeLine`, sobre el que gira la tapa.
  // Bisagra de NUDILLOS ALTERNADOS: la mitad interior del eje es del cuerpo
  // base y la mitad exterior es de la tapa (buildLaptopLid). Coaxiales y
  // contiguas, nunca superpuestas (fase 2: brazo de la tapa y barril se
  // interpenetraban 3.5 mm).
  const hg = LAPTOP.hinge;
  const knuckle = hg.length / 2;
  [-1, 1].forEach((s) => {
    const barrel = new THREE.Mesh(cyl(hg.radius, hg.radius, knuckle, 16), materialFor("metalSteel"));
    barrel.rotation.z = Math.PI / 2;
    put(group, barrel, s * (hg.x - knuckle / 2), hg.y, hg.z);
    // Soporte interior atornillado a la pared trasera, por DEBAJO del eje
    // (su cara superior a 17.4 mm deja libre el nudillo de la tapa). Partido en
    // dos tramos (sep-2026): el interior, bajo el nudillo del cuerpo, a altura
    // completa; el exterior, bajo el nudillo de la TAPA, rebajado el espesor
    // de la hoja de bisagra de la pantalla (buildLaptopLid), que apoya encima.
    // Los tornillos entran desde abajo, aprietan el soporte y roscan en la hoja.
    const bracketLook = { color: 0x6d737b, roughness: 0.48, metalness: 0.6 };
    const bx0 = hg.x - 0.015, bx1 = hg.x + 0.015, bz = -d / 2 + wall + 0.005;
    const innerH = HINGE_BRACKET_TOP_Y - HINGE_BRACKET_BOTTOM_Y;
    const outerH = (HINGE_LEAF_TOP_Y - HINGE_LEAF_T) - HINGE_BRACKET_BOTTOM_Y;
    const inner = box(HINGE_LEAF_X0 - bx0, innerH, 0.010, "metalSteel", bracketLook);
    inner.name = "hinge-bracket";
    put(group, inner, s * (bx0 + HINGE_LEAF_X0) / 2, HINGE_BRACKET_BOTTOM_Y + innerH / 2, bz);
    const outer = box(bx1 - HINGE_LEAF_X0, outerH, 0.010, "metalSteel", bracketLook);
    outer.name = "hinge-bracket";
    put(group, outer, s * (HINGE_LEAF_X0 + bx1) / 2, HINGE_BRACKET_BOTTOM_Y + outerH / 2, bz);
  });

  // Altavoces en las esquinas delanteras, a los lados de la bateria.
  [-0.135, 0.135].forEach((x) => {
    const spk = box(0.044, 0.005, 0.016, "plasticDark");
    put(group, spk, x, rim + 0.0025 + 0.0002, d * 0.365);
    // Rejilla en la cara inferior: es la que se ve al retirar la tapa.
    const grille = box(0.036, 0.0003, 0.010, "plasticBlack", { color: 0x0b0c0e });
    put(group, grille, x, rim + 0.0002 - 0.00015, d * 0.365);
  });

  // Reposamanos / top case: la superficie superior del chasis, con los dos
  // recortes reales (teclado y touchpad). Sin ella el teclado y el touchpad
  // quedaban apoyados SOBRE el borde de las paredes, flotando, y toda la
  // cavidad quedaba a la vista: el equipo no se leia como un portatil cerrado.
  // Es parte del chasis, no una pieza retirable -- al quitar teclado o
  // touchpad se ve su hueco, como en un equipo real.
  const kbW = w * 0.90, kbD = d * 0.46;
  const kbZ = -d * 0.10;
  const kbFront = kbZ + kbD / 2, kbBack = kbZ - kbD / 2;
  const tcW = 0.105, tcD = 0.062, tcZ = d * 0.335;
  const deckY = h - 0.0008;
  // El reposamanos va en su propio subgrupo con nombre: la bateria vive JUSTO
  // DEBAJO (que es su sitio real en un portatil), asi que poder ocultar esta
  // pieza es la unica forma de inspeccionar esa zona sin mover la bateria a un
  // lugar fisicamente incorrecto. Tambien deja preparado el terreno para que
  // los modos puedan descubrirla mas adelante.
  const deckGroup = new THREE.Group();
  deckGroup.name = "laptop-top-deck";
  group.add(deckGroup);
  const deck = (bw, bd, bx, bz) => put(deckGroup, box(bw, 0.0016, bd, "metalBrushed", { color: LAPTOP_SHELL.deck }), bx, deckY, bz);
  // Marco alrededor del teclado.
  deck((w - kbW) / 2, kbD, -(kbW + (w - kbW) / 2) / 2, kbZ);
  deck((w - kbW) / 2, kbD, (kbW + (w - kbW) / 2) / 2, kbZ);
  // Franja trasera, con las MUESCAS de las bisagras: los barriles asoman por
  // ellas y el brazo de la tapa gira dentro sin tocar el reposamanos.
  const notchHalfW = LAPTOP.hinge.length / 2 + 0.002;
  const notchBackZ = -d / 2, notchFrontZ = LAPTOP.hinge.z + LAPTOP.hinge.radius + 0.002;
  deck(w, kbBack - notchFrontZ, 0, (notchFrontZ + kbBack) / 2);
  const hx = LAPTOP.hinge.x;
  const rearD = notchFrontZ - notchBackZ, rearZ = (notchBackZ + notchFrontZ) / 2;
  deck((w / 2 - (hx + notchHalfW)), rearD, -((w / 2 + hx + notchHalfW) / 2), rearZ);
  deck((w / 2 - (hx + notchHalfW)), rearD, ((w / 2 + hx + notchHalfW) / 2), rearZ);
  deck(2 * (hx - notchHalfW), rearD, 0, rearZ);
  // Reposamanos delantero, partido para dejar el hueco del touchpad.
  const palmBack = kbFront, palmFront = d / 2;
  deck((w - tcW) / 2 - 0.001, palmFront - palmBack, -(tcW + w) / 4, (palmBack + palmFront) / 2);
  deck((w - tcW) / 2 - 0.001, palmFront - palmBack, (tcW + w) / 4, (palmBack + palmFront) / 2);
  deck(tcW + 0.002, tcZ - tcD / 2 - palmBack, 0, (palmBack + tcZ - tcD / 2) / 2);
  deck(tcW + 0.002, palmFront - (tcZ + tcD / 2), 0, (tcZ + tcD / 2 + palmFront) / 2);

  // Puertos externos: boca recortada en la pared lateral + cuerpo del
  // conector por dentro. Van en el chasis (no son piezas retirables: en un
  // portatil real van soldados a la placa y su boca es parte de la carcasa).
  LAPTOP_PORTS.forEach((spec) => {
    const sign = spec.side === "left" ? -1 : 1;
    // Soldados a la cara inferior de la placa: la boca queda justo debajo.
    const y = LAPTOP.boardFaceY - spec.h / 2 - 0.0002;
    const xWall = sign * (w / 2 - wall / 2);
    // Boca: hueco oscuro embutido en la pared.
    const mouth = box(wall * 1.6, spec.h, spec.w, "plasticBlack", { color: 0x07080a });
    put(group, mouth, xWall, y, spec.along);
    // Cuerpo del conector hacia el interior.
    const body = buildLaptopPort(spec);
    // Boca (-Z local) hacia AFUERA en ambos lados: antes los dos lados giraban
    // igual y los conectores del lado derecho tenian la boca hacia dentro.
    body.rotation.y = -sign * Math.PI / 2;
    body.position.set(sign * (w / 2 - wall - 0.006), y, spec.along);
    group.add(body);
  });

  setShadow(group);

  const hgA = LAPTOP.hinge;
  return {
    group,
    dims: { width: w, depth: d, height: h },
    anchors: {
      hingeLine: new THREE.Vector3(0, hgA.y, hgA.z),
      // Cara delantera de cada soporte de bisagra: por ahi entran a la tapa
      // el flex eDP y las antenas.
      hingeEntryLeft: new THREE.Vector3(-hgA.x, 0.0165, -d / 2 + wall + 0.010),
      hingeEntryRight: new THREE.Vector3(hgA.x, 0.0165, -d / 2 + wall + 0.010),
      // Cara INFERIOR del soporte interior de cada bisagra (chapa de 3.9 mm
      // centrada en y 15.45 mm): por ahi se atornilla la pantalla al chasis,
      // y es lo que se ve al abrir la tapa inferior.
      hingeBracketLeft: new THREE.Vector3(-hgA.x, 0.01545 - 0.00195, -d / 2 + wall + 0.005),
      hingeBracketRight: new THREE.Vector3(hgA.x, 0.01545 - 0.00195, -d / 2 + wall + 0.005),
      // Placa base: banda TRASERA bajo el teclado, cara de componentes abajo.
      motherboardOrigin: new THREE.Vector3(0, LAPTOP.board.centerY, LAPTOP.board.centerZ),
      // Bateria: mitad DELANTERA, bajo el reposamanos, apoyada sobre la tapa
      // inferior (5.5 mm de alto: 0.9 .. 6.4 mm; su PCB de proteccion baja
      // 0.8 mm mas y queda a 0.5 mm de la tapa).
      batteryBay: new THREE.Vector3(0, 0.0009 + 0.00275, d * 0.22),
      keyboardMount: new THREE.Vector3(0, h - 0.0022, -d * 0.10),
      touchpadMount: new THREE.Vector3(0, h - 0.0004, d * 0.335),
      bottomCoverCenter: new THREE.Vector3(0, -0.0013, 0),
      ventOut: new THREE.Vector3(ventX, h * 0.34, -d / 2),
    },
  };
}

/** Tornillos de la tapa inferior = torres del cuerpo base (mismas posiciones). */
// Bateria (sep-2026): sus 2 tornillos pasan por las orejas de los extremos del
// pack (buildLaptopBattery) y roscan en torres que bajan del reposamanos
// (buildLaptopBase). X absoluta del tornillo y Z respecto de la bahia.
export const LAPTOP_BATTERY_SCREW_X = 0.109;
export const LAPTOP_BATTERY_SCREW_DZ = 0.020;
// Cara de la oreja que mira a la tapa inferior (y del chasis): 0.9 mm, al ras
// de la cara inferior del pack; la oreja mide 0.8 mm.
const LAPTOP_BATTERY_EAR_TOP_Y = 0.0017;

export const LAPTOP_COVER_SCREWS = [
  [-0.152, -0.106], [0.152, -0.106],
  [-0.150, 0.104], [0.150, 0.104],
  // Medido con un rayo contra la superficie real: en z 0.1095 este tornillo
  // caia sobre el LABIO perimetral de la tapa (que baja 2.4 mm mas que el
  // panel), asi que su cabeza quedaba enterrada en el labio en vez de apoyar
  // en el panel. Se alinea con los otros dos delanteros.
  [0, 0.104],
];

/** Tapa inferior: panel con patas de goma, tornillos y rejilla de admision.
 * `opts.serviceScrews === false` omite los tornillos DECORATIVOS: los dibuja
 * (y los hace clickeables, con estado propio) el sistema de tornillos
 * interactivos, ver hardware_lab_3d_screws.js. Sin esta opcion habria dos
 * tornillos superpuestos en cada torre. */
export function buildLaptopBottomCover(dims, opts = {}) {
  const w = (dims?.width || LAPTOP.width) * 0.985;
  const d = (dims?.depth || LAPTOP.depth) * 0.985;
  const group = new THREE.Group();
  group.name = "laptop-bottom-cover";

  put(group, box(w, 0.0022, d, "aluminum", { color: LAPTOP_SHELL.cover }), 0, 0, 0);
  // Labio perimetral HACIA ABAJO (bug visual real, medido: antes subia +2.2 mm
  // y se metia 2 mm dentro del piso de la bandeja, produciendo el borde
  // dentado por z-fighting que se veia en las vistas laterales). En un equipo
  // real la tapa inferior encaja por debajo y su labio rodea el borde del
  // chasis; nunca invade la cavidad.
  [[0, -d / 2 + 0.002], [0, d / 2 - 0.002]].forEach(([x, z]) => {
    put(group, box(w, 0.0024, 0.004, "aluminum", { color: LAPTOP_SHELL.cover }), x, -0.0023, z);
  });
  [[-w / 2 + 0.002, 0], [w / 2 - 0.002, 0]].forEach(([x, z]) => {
    put(group, box(0.004, 0.0024, d, "aluminum", { color: LAPTOP_SHELL.cover }), x, -0.0023, z);
  });

  // Rejilla de admision de aire: justo DEBAJO del ventilador (centro en
  // x -85, z -80 mm del cuerpo base). En la fase 2 quedaba desplazada 20 mm
  // del ventilador, sin sentido fisico.
  const holes = [];
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const hx = -0.100 + i * 0.005, hz = -0.095 + j * 0.005;
      if (Math.hypot(hx + 0.085, hz + 0.080) > 0.018) continue;   // circular
      holes.push({ x: hx, y: 0, z: hz, w: 0.0026, h: 0.0024, d: 0.0026 });
    }
  }
  group.add(instancedBoxes(holes, "plasticBlack"));

  // Patas de goma y tornillos de servicio.
  const footR = 0.005;
  [[w * 0.42, d * 0.40], [-w * 0.42, d * 0.40], [w * 0.42, -d * 0.40], [-w * 0.42, -d * 0.40]].forEach(([x, z]) => {
    const foot = new THREE.Mesh(cyl(footR, footR * 0.9, 0.0018, 12), materialFor("rubberBlack"));
    put(group, foot, x, -0.0041, z);
  });
  // Tornillos: los mismos puntos que las torres del cuerpo base.
  if (opts.serviceScrews !== false) {
    LAPTOP_COVER_SCREWS.forEach(([x, z]) => {
      const s = buildSmallScrew(0.0018);
      s.position.set(x, -0.0016, z);
      s.rotation.x = Math.PI;
      group.add(s);
    });
  }

  setShadow(group);
  return { group };
}

/* ══════════════════════════════════════════════════════════════════════════
   2. PLACA BASE
   ══════════════════════════════════════════════════════════════════════════ */

// Aspecto de la PLACA BASE (iteracion visual, sep-18). En las capturas de
// cerca la placa se leia como un modelo simplificado: el blindaje EMI era un
// bloque gris casi blanco y liso, los conectores cajas de color marfil sin
// pestaña ni contactos, los chips cajas negras sin marcaje, una rejilla de 14
// cuadritos claros perfectamente alineados y grandes zonas de PCB vacias. Estos
// acabados (propios, elegidos midiendo capturas con la luz de la escena)
// separan las familias que en una placa real se distinguen de un vistazo:
// estaño del blindaje, encapsulados negros, terminales estañados, polimero de
// los condensadores, ferrita de las bobinas.
const BOARD_LOOK = {
  shield: { color: 0x7f868e, roughness: 0.4, metalness: 0.72 },
  shieldFence: { color: 0x737a82, roughness: 0.45, metalness: 0.7 },
  inductor: { color: 0x2f3237, roughness: 0.82, metalness: 0.08, envMapIntensity: 0.5 },
  polymer: { color: 0x121316, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.5 },
  polymerBand: { color: 0x7a5530, roughness: 0.6, metalness: 0.05 },
  terminal: { color: 0xb9bdc3, roughness: 0.36, metalness: 0.8 },
  zifFlap: { color: 0x3d2b1c, roughness: 0.55, metalness: 0.05 },
  slot: { color: 0x0b0c0e, roughness: 0.8, metalness: 0 },
  edpShell: { color: 0x737981, roughness: 0.5, metalness: 0.58 },
  plating: { color: 0xc2ad73, roughness: 0.38, metalness: 0.75 },
  crystal: { color: 0xaeb3b9, roughness: 0.3, metalness: 0.85 },
  standoff: { color: 0xb59a5c, roughness: 0.4, metalness: 0.7 },
};

// Materiales con textura propia (pegatinas, marcajes, pasivos): uno por
// textura+acabado, compartido por todas las mallas que lo usan.
const TEX_MAT = new Map();
function texturedMaterial(tex, look) {
  const key = tex.uuid + (look ? JSON.stringify(look) : "");
  if (!TEX_MAT.has(key)) {
    TEX_MAT.set(key, new THREE.MeshStandardMaterial(Object.assign({ map: tex, roughness: 0.6, metalness: 0.05 }, look || {})));
  }
  return TEX_MAT.get(key);
}

/**
 * Calcomania plana (marcaje laser, serigrafia, etiqueta) de w x d sobre una
 * cara horizontal. `facing` -1: mira hacia -Y (cara de componentes de la placa,
 * que cuelga); +1: mira hacia +Y (modulos, en su espacio local). En ambos casos
 * el texto se lee derecho mirando esa cara desde delante del equipo. Una
 * geometria unitaria compartida; el tamaño va en la escala.
 */
function decal(w, d, tex, facing = -1, look) {
  if (!GEO.plane) GEO.plane = new THREE.PlaneGeometry(1, 1);
  const m = new THREE.Mesh(GEO.plane, texturedMaterial(tex, look));
  m.scale.set(w, d, 1);
  m.rotation.x = facing < 0 ? Math.PI / 2 : -Math.PI / 2;
  m.name = "decal";
  return m;
}

/** InstancedMesh de una geometria cualquiera con N matrices (anillos, etc.). */
function instancedGeometry(geo, material, matrices) {
  const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

/** Pasivos SMD instanciados: una malla por familia (ceramicos canela y
 *  resistencias negras), con terminales estañados pintados en la textura.
 *  `list` = [{ x, y, z, w, h, d, ry, kind: "cap" | "res" }] en locales. */
function passiveMeshes(list) {
  const out = [];
  ["cap", "res"].forEach((kind) => {
    const items = list.filter((it) => it.kind === kind);
    if (!items.length) return;
    const mesh = new THREE.InstancedMesh(unitBox(), texturedMaterial(smdPassiveTexture(kind), { roughness: 0.66, metalness: 0.08, envMapIntensity: 0.5 }), items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.ry || 0);
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.w, it.h, it.d));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = "smd-passives";
    out.push(mesh);
  });
  return out;
}

/** Fila de pasivos (0402) a lo largo de X, en la cara superior (+Y) de un
 *  modulo cuyo PCB mide `t` de grueso. */
function passiveRow(list, x0, x1, z, t, count, rotated, seed) {
  let s = seed >>> 0 || 1;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = x0 + ((x1 - x0) * (i + 0.5)) / count;
    list.push({ x, y: t / 2 + 0.000175, z, w: 0.0010, h: 0.00035, d: 0.0005, ry: rotated ? Math.PI / 2 : 0, kind: s / 4294967296 > 0.4 ? "cap" : "res" });
  }
}

/** Las calcomanias y los pasivos diminutos no proyectan sombra: una sombra
 *  de 0.4 mm no se ve y el plano coplanar con su cara solo produciria acne. */
function noShadowForTiny(group) {
  group.traverse((n) => {
    if (n.isMesh && (n.name === "decal" || n.name === "smd-passives")) n.castShadow = false;
  });
}

/** Puntos de tornillo de la placa base, en coordenadas BASE del equipo
 * ([x, z], las mismas que usan los sockets). El catalogo de tornillos
 * interactivos los toma del anchor `mountScrews` que devuelve el builder. */
export const LAPTOP_BOARD_SCREWS = [
  [-0.146, -0.095],
  [0.146, -0.095],
  [-0.146, -0.031],
  [0.146, -0.031],
  [-0.040, -0.095],
];

/**
 * Placa base del portatil: banda trasera en PCB verde con chipset bajo
 * blindaje EMI, controlador principal, memoria soldada, VRM, sockets reales
 * (SO-DIMM, M.2 2280, M.2 2230), conectores FPC, header de ventilador,
 * conector de bateria y puntos de tornillo.
 *
 * Los "anchors" que devuelve son los puntos de montaje que usa el layout: cada
 * pieza se apoya donde de verdad esta su socket, no en coordenadas sueltas.
 *
 * ITERACION VISUAL (sep-18): mismas posiciones, sockets, conectores, anclajes y
 * caja envolvente (la bandeja y los recorridos dependen de ella); solo se
 * sustituyen bloques genericos por componentes reconocibles y se puebla la
 * placa. Para no multiplicar las llamadas de dibujo en GPUs integradas, las
 * familias numerosas van instanciadas: encapsulados, terminales/patas,
 * pasivos SMD (~300, dos mallas), ranuras de conector y anillos metalizados.
 * Los pasivos se colocan con una semilla fija y SOLO fuera de las huellas de
 * los demas componentes y de los modulos (RAM, SSD, Wi-Fi, CPU) y a 0.45 mm
 * de alto como maximo: ningun cable ni modulo pasa tan cerca de la placa.
 */
export function buildLaptopMotherboard(opts = {}) {
  const B = LAPTOP.board;
  const w = opts.width || B.width;
  const d = opts.depth || B.depth;
  const t = B.thickness;
  const group = new THREE.Group();
  group.name = "laptop-motherboard";
  const K = BOARD_LOOK;

  // Textura de placa (buses, vias, huellas, serigrafia) en un mesh propio. Se
  // crea primero (mismo orden de hijos que antes) y su textura se asigna al
  // final, cuando ya se conoce la serigrafia real de lo montado.
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), materialFor("pcbGreen").clone());
  group.add(board);

  // CARA DE COMPONENTES = CARA INFERIOR (fase 3). Todo lo que se monta en la
  // placa cuelga de `face` hacia -Y, que es lo que queda a la vista al quitar
  // la tapa inferior. Las posiciones se escriben en coordenadas del CUERPO
  // BASE (mm reales medibles) y se pasan a locales con L(): asi cada pieza se
  // puede contrastar directamente con la auditoria de colisiones.
  const face = -t / 2;
  const L = (xBase, zBase) => [xBase, zBase - B.centerZ];
  const hang = (mesh, xBase, zBase, height) => {
    const [x, z] = L(xBase, zBase);
    return put(group, mesh, x, face - height / 2, z);
  };
  // Huellas ocupadas (coordenadas base, [x0, z0, x1, z1]): los pasivos SMD se
  // reparten despues solo por lo que queda libre.
  const keepOut = [];
  const occupy = (x, z, fw, fd, margin = 0.0006) => keepOut.push([x - fw / 2 - margin, z - fd / 2 - margin, x + fw / 2 + margin, z + fd / 2 + margin]);
  // Familias instanciadas (una llamada de dibujo cada una).
  const packages = [];    // encapsulados negros (QFP, SOIC, QFN, MOSFET, polimero)
  const terminals = [];   // patas, terminales y pestañas estañadas
  const slots = [];       // ranuras oscuras de los conectores
  const itemAt = (list, xBase, zBase, y, bw, bh, bd, ry) => {
    const [x, z] = L(xBase, zBase);
    list.push({ x, y, z, w: bw, h: bh, d: bd, ry: ry || 0 });
  };
  // Serigrafia real: contornos y designadores alineados con los componentes
  // (coordenadas base), dibujados en la textura de la placa.
  const marks = [];
  const silk = (xBase, zBase, fw, fd, label, lx, lz) => {
    const [x, z] = L(xBase, zBase);
    marks.push({ rect: [x, z, fw + 0.0012, fd + 0.0012] });
    if (label) {
      const [tx, tz] = L(lx != null ? lx : xBase - fw / 2, lz != null ? lz : zBase + fd / 2 + 0.0022);
      marks.push({ text: label, at: [tx, tz] });
    }
  };
  const marking = (xBase, zBase, fw, fd, height, lines, aspectKey) => {
    const [x, z] = L(xBase, zBase);
    put(group, decal(fw * 0.9, fd * 0.9, chipMarkingTexture(aspectKey || lines.join("|"), lines, fw / fd)), x, face - height - 0.00002, z);
  };

  // ── CPU/SoC: marco (4 listones) alrededor del sustrato ─────────────────
  // Antes era una losa de 26 x 26 mm donde el sustrato quedaba HUNDIDO
  // 0.6 mm (colision medida). Ahora rodea al sustrato sin tocarlo.
  const cpu = [-0.048, -0.063];
  [[0.029, 0.0018, 0, 0.01345], [0.029, 0.0018, 0, -0.01345], [0.0018, 0.025, 0.01345, 0], [0.0018, 0.025, -0.01345, 0]]
    .forEach(([bw, bd, dx, dz]) => hang(box(bw, 0.0008, bd, "plasticDark"), cpu[0] + dx, cpu[1] + dz, 0.0008));
  occupy(cpu[0], cpu[1], 0.031, 0.031);

  // ── Socket SO-DIMM con sus brazos de retencion ──────────────────────────
  // El cuerpo del conector va hacia la pared trasera; el modulo se extiende
  // hacia el frente. Los clips NO estan junto al conector (fase 2): en un
  // socket real son brazos que llegan hasta las muescas laterales del modulo
  // y lo sujetan por ahi. Los ganchos entran en esas muescas (recortes reales
  // del PCB, ver buildSoDimm) sin tocar el PCB.
  const ram = [0.012, -0.093];
  hang(box(0.070, 0.0022, 0.0075, "plasticBlack"), ram[0], ram[1], 0.0022);
  {
    const items = [];
    const [x0, z0] = L(ram[0], ram[1]);
    for (let i = 0; i < 34; i++) {
      items.push({ x: x0 - 0.032 + (0.064 / 34) * (i + 0.5), y: face - 0.0022 - 0.0002, z: z0 + 0.0022, w: 0.0009, h: 0.0004, d: 0.0016 });
    }
    group.add(instancedBoxes(items, "goldPin"));
  }
  [-1, 1].forEach((s) => {
    const armX = ram[0] + s * 0.0353;
    hang(box(0.0015, 0.0012, 0.020, "metalSteel"), armX, ram[1] + 0.0135, 0.0012);
    // Gancho: baja al nivel del modulo y entra 1.5 mm en la muesca lateral.
    const [hx, hz] = L(ram[0] + s * 0.0342, -0.0735);
    put(group, box(0.0032, 0.0014, 0.0024, "metalSteel"), hx, face - 0.0019, hz);
    // Patas de anclaje de cada extremo del socket.
    itemAt(terminals, ram[0] + s * 0.0362, ram[1], face - 0.0002, 0.0024, 0.0004, 0.0030);
  });
  // Huella del socket + modulo instalado (67.6 x 30 mm hacia el frente).
  occupy(ram[0], -0.0790, 0.0740, 0.0335);
  silk(ram[0], ram[1], 0.070, 0.0075, "DIMM1", ram[0] - 0.035, ram[1] - 0.0058);

  // ── Conector M.2 2280 (SSD) + standoff ──────────────────────────────────
  const m2 = [0.098, -0.063];    // centro del modulo
  hang(box(0.0045, 0.0022, 0.023, "plasticBlack"), m2[0] - 0.040, m2[1], 0.0022);
  {
    const items = [];
    const [x0, z0] = L(m2[0] - 0.040, m2[1]);
    for (let i = 0; i < 20; i++) items.push({ x: x0 + 0.001, y: face - 0.0022 - 0.0002, z: z0 - 0.010 + i * 0.001, w: 0.0018, h: 0.0004, d: 0.0006 });
    group.add(instancedBoxes(items, "goldPin"));
  }
  [-1, 1].forEach((s) => itemAt(terminals, m2[0] - 0.040, m2[1] + s * 0.0122, face - 0.0002, 0.0030, 0.0004, 0.0012));
  // Standoff COAXIAL con la media luna de la tarjeta (su centro esta 1.2 mm
  // adentro del borde, ver buildM2Ssd): antes estaba en el borde exacto, 1.2 mm
  // desplazado respecto del agujero que tiene que roscar.
  hang(new THREE.Mesh(cyl(0.0022, 0.0022, 0.00165, 12), materialFor("metalBrushed", K.standoff)), m2[0] + 0.0388, m2[1], 0.00165);
  occupy(m2[0], m2[1], 0.0850, 0.0250);
  silk(m2[0] - 0.040, m2[1], 0.0045, 0.023, "SSD1  M.2 2280", m2[0] - 0.034, m2[1] + 0.0142);

  // ── Conector M.2 2230 (Wi-Fi) + standoff ────────────────────────────────
  const wifi = [-0.125, -0.040];  // centro del modulo
  hang(box(0.0045, 0.0022, 0.020, "plasticBlack"), wifi[0] - 0.013, wifi[1], 0.0022);
  // Coaxial con la media luna de la tarjeta Wi-Fi (centro a 1 mm del borde).
  hang(new THREE.Mesh(cyl(0.0020, 0.0020, 0.0017, 12), materialFor("metalBrushed", K.standoff)), wifi[0] + 0.014, wifi[1], 0.0017);
  occupy(wifi[0], wifi[1], 0.0340, 0.0240);
  silk(wifi[0] - 0.013, wifi[1], 0.0045, 0.020, "WLAN1", wifi[0] - 0.016, wifi[1] - 0.0128);

  // ── Chipset bajo blindaje EMI estampado ─────────────────────────────────
  // Antes: un bloque gris liso que se leia como una caja blanca. Un blindaje
  // real es una lata de chapa estañada: cerco perimetral soldado + tapa con
  // perforaciones de ventilacion y una zona lisa central (donde la toma la
  // maquina de montaje). Mismo volumen que antes (36 x 20 x 1.6 mm).
  {
    const sx = -0.005, sz = -0.045, sw = 0.036, sd = 0.020, sh = 0.0016;
    const fence = [];
    const [lx, lz] = L(sx, sz);
    const fy = face - sh / 2;
    fence.push({ x: lx, y: fy, z: lz - sd / 2 + 0.00015, w: sw, h: sh, d: 0.0003 });
    fence.push({ x: lx, y: fy, z: lz + sd / 2 - 0.00015, w: sw, h: sh, d: 0.0003 });
    fence.push({ x: lx - sw / 2 + 0.00015, y: fy, z: lz, w: 0.0003, h: sh, d: sd });
    fence.push({ x: lx + sw / 2 - 0.00015, y: fy, z: lz, w: 0.0003, h: sh, d: sd });
    group.add(instancedBoxes(fence, "metalDark", K.shieldFence));
    put(group, box(sw - 0.0002, 0.00025, sd - 0.0002, "metalDark", K.shield), lx, face - sh + 0.000125, lz);
    put(group, decal(sw - 0.0004, sd - 0.0004, shieldLidTexture(), -1, K.shield), lx, face - sh - 0.00002, lz);
    occupy(sx, sz, sw, sd);
    silk(sx, sz, sw, sd, "SH1", sx - sw / 2, sz - sd / 2 - 0.0016);
  }

  // ── Memoria soldada, controlador y chips de soporte (con marcaje) ───────
  [[-0.135, -0.085, "SL4G16|D9XHV 2231"], [-0.135, -0.070, "SL4G16|D9XHV 2231"]].forEach(([x, z, txt], i) => {
    const chip = buildChip(0.012, 0.010, 0.0010);
    chip.rotation.x = Math.PI;                      // marca de pin 1 hacia abajo
    const [lx, lz] = L(x, z);
    chip.position.set(lx, face - 0.0005, lz);
    group.add(chip);
    marking(x, z, 0.012, 0.010, 0.0010, txt.split("|"));
    occupy(x, z, 0.012, 0.010);
    silk(x, z, 0.012, 0.010, "U" + (21 + i), x + 0.0068, z + 0.0035);
  });
  {
    const chip = buildChip(0.016, 0.016, 0.0013);
    chip.rotation.x = Math.PI;
    const [lx, lz] = L(0.120, -0.088);
    chip.position.set(lx, face - 0.00065, lz);
    group.add(chip);
    marking(0.120, -0.088, 0.016, 0.016, 0.0013, ["SLPD-5210", "2236  B1", "TAIWAN"]);
    occupy(0.120, -0.088, 0.016, 0.016);
    silk(0.120, -0.088, 0.016, 0.016, "U7", 0.1105, -0.0785);
  }
  // Controlador embebido (EC) en QFP con sus patas en los 4 lados.
  {
    const ec = [-0.096, -0.050], s = 0.012, hgt = 0.0014, n = 16, pitch = 0.00065;
    itemAt(packages, ec[0], ec[1], face - hgt / 2 - 0.0001, s, hgt, s);
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * pitch;
      itemAt(terminals, ec[0] + o, ec[1] - s / 2 - 0.0005, face - 0.00022, 0.00026, 0.00035, 0.0011);
      itemAt(terminals, ec[0] + o, ec[1] + s / 2 + 0.0005, face - 0.00022, 0.00026, 0.00035, 0.0011);
      itemAt(terminals, ec[0] - s / 2 - 0.0005, ec[1] + o, face - 0.00022, 0.0011, 0.00035, 0.00026);
      itemAt(terminals, ec[0] + s / 2 + 0.0005, ec[1] + o, face - 0.00022, 0.0011, 0.00035, 0.00026);
    }
    marking(ec[0], ec[1], s, s, hgt + 0.0001, ["SLEC-8128", "2229  A3", "●"]);
    occupy(ec[0], ec[1], s + 0.0026, s + 0.0026);
    silk(ec[0], ec[1], s + 0.0022, s + 0.0022, "U12", ec[0] - 0.0075, ec[1] + 0.0092);
  }
  // Flash de BIOS (SOIC-8) + cristal de reloj + controlador de red (QFN),
  // en lugar de la rejilla de 14 cuadritos alineados que habia aqui.
  {
    const bios = [0.070, -0.037];
    itemAt(packages, bios[0], bios[1], face - 0.00075 - 0.0001, 0.0049, 0.0015, 0.0039);
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 0.00127;
      itemAt(terminals, bios[0] + o, bios[1] - 0.0026, face - 0.0003, 0.0004, 0.0004, 0.0012);
      itemAt(terminals, bios[0] + o, bios[1] + 0.0026, face - 0.0003, 0.0004, 0.0004, 0.0012);
    }
    marking(bios[0], bios[1], 0.0049, 0.0039, 0.0016, ["SL25Q128", "2236"]);
    occupy(bios[0], bios[1], 0.0052, 0.0068);
    silk(bios[0], bios[1], 0.0052, 0.0064, "U31", bios[0] - 0.0026, bios[1] + 0.0048);
    // Cristal de 32.768 kHz: cilindro metalico tumbado con sus dos patas.
    const xt = [0.0835, -0.0365];
    const [lx, lz] = L(xt[0], xt[1]);
    const can = new THREE.Mesh(cyl(0.00095, 0.00095, 0.0060, 14), materialFor("metalSteel", K.crystal));
    can.rotation.z = Math.PI / 2;
    put(group, can, lx, face - 0.00105, lz);
    itemAt(terminals, xt[0] - 0.0039, xt[1], face - 0.0002, 0.0018, 0.0004, 0.0009);
    itemAt(terminals, xt[0] + 0.0039, xt[1], face - 0.0002, 0.0018, 0.0004, 0.0009);
    occupy(xt[0], xt[1], 0.0098, 0.0022);
    silk(xt[0], xt[1], 0.0096, 0.0022, "Y1", xt[0] - 0.0048, xt[1] + 0.0026);
    // Controlador Ethernet junto a los puertos derechos (QFN).
    const lan = [0.118, -0.040];
    itemAt(packages, lan[0], lan[1], face - 0.00045 - 0.0001, 0.007, 0.0009, 0.007);
    for (let i = 0; i < 6; i++) {
      const o = (i - 2.5) * 0.001;
      itemAt(terminals, lan[0] + o, lan[1] - 0.0036, face - 0.0001, 0.0004, 0.0002, 0.0005);
      itemAt(terminals, lan[0] + o, lan[1] + 0.0036, face - 0.0001, 0.0004, 0.0002, 0.0005);
    }
    marking(lan[0], lan[1], 0.007, 0.007, 0.001, ["SL8111", "2232"]);
    occupy(lan[0], lan[1], 0.0078, 0.0078);
    silk(lan[0], lan[1], 0.0076, 0.0076, "U40", lan[0] - 0.0038, lan[1] + 0.0056);
    // Codec de audio junto al jack izquierdo (QFN).
    const aud = [-0.118, -0.060];
    itemAt(packages, aud[0], aud[1], face - 0.00045 - 0.0001, 0.005, 0.0009, 0.005);
    marking(aud[0], aud[1], 0.005, 0.005, 0.001, ["SLA256", "2230"]);
    occupy(aud[0], aud[1], 0.0058, 0.0058);
    silk(aud[0], aud[1], 0.0056, 0.0056, "U52", aud[0] - 0.0028, aud[1] + 0.0046);
  }

  // ── VRM del procesador ──────────────────────────────────────────────────
  // Bobinas de ferrita moldeada con sus terminales y marcaje, 3 MOSFET de
  // potencia entre bobinas y CPU, y condensadores de POLIMERO rectangulares
  // (negros con banda de polaridad): los cilindros marrones de antes eran de
  // placa de escritorio, no de portatil.
  for (let i = 0; i < 4; i++) {
    const x = -0.060 + i * 0.008, z = -0.089;
    hang(box(0.0055, 0.0022, 0.0055, "plasticDark", K.inductor), x, z, 0.0022);
    itemAt(terminals, x - 0.0024, z, face - 0.00055, 0.0012, 0.0011, 0.0044);
    itemAt(terminals, x + 0.0024, z, face - 0.00055, 0.0012, 0.0011, 0.0044);
    marking(x, z, 0.0055, 0.0055, 0.0022, ["R47"], "ind-r47");
    occupy(x, z, 0.0058, 0.0058);
  }
  silk(-0.048, -0.089, 0.0318, 0.0058, "PL1-PL4", -0.064, -0.0942);
  for (let i = 0; i < 3; i++) {
    const x = -0.060 + i * 0.008, z = -0.0815;
    itemAt(packages, x, z, face - 0.0004 - 0.00005, 0.0033, 0.0008, 0.0033);
    itemAt(terminals, x, z - 0.00195, face - 0.00015, 0.0030, 0.0003, 0.0006);
    occupy(x, z, 0.0034, 0.0040);
  }
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      const x = -0.098 + i * 0.009, z = r === 0 ? -0.0955 : -0.0885;
      itemAt(packages, x, z, face - 0.00095 - 0.00005, 0.0073, 0.0019, 0.0043);
      // Banda de polaridad (anodo) y terminales en los extremos.
      const [lx, lz] = L(x + 0.0026, z);
      put(group, box(0.0012, 0.00004, 0.0041, "plasticDark", K.polymerBand), lx, face - 0.0019 - 0.00007, lz);
      itemAt(terminals, x - 0.0038, z, face - 0.0005, 0.0006, 0.0010, 0.0024);
      itemAt(terminals, x + 0.0038, z, face - 0.0005, 0.0006, 0.0010, 0.0024);
      occupy(x, z, 0.0078, 0.0045);
    }
  }
  silk(-0.0845, -0.092, 0.0348, 0.0118, "PC1-PC8", -0.1018, -0.0843);

  // ── Conectores: bateria, ventilador, ZIF teclado/touchpad, eDP ─────────
  // Todos junto al borde delantero de la placa (salvo eDP, junto a la
  // bisagra derecha): es por donde llegan sus cables sin cruzar modulos.
  // Mismo volumen que antes (sus anclajes no cambian); cada tipo lleva ahora
  // lo que lo identifica: pestaña de cierre marron del ZIF, ranuras de los
  // contactos, pestañas de soldadura, carcasa metalica del eDP.
  const conn = {
    battery: [0.048, -0.033, 0.014, 0.0030, 0.006],
    fan: [-0.080, -0.036, 0.005, 0.0028, 0.004],
    kb: [-0.018, -0.032, 0.028, 0.0022, 0.004],
    tp: [0.014, -0.032, 0.012, 0.0022, 0.0035],
    edp: [0.088, -0.092, 0.016, 0.0026, 0.004],
  };
  Object.entries(conn).forEach(([id, [x, z, cw, ch, cd]]) => {
    const edp = id === "edp";
    hang(box(cw, ch, cd, edp ? "metalBrushed" : "connectorIvory", edp ? K.edpShell : undefined), x, z, ch);
    // Pestañas de soldadura a los lados.
    itemAt(terminals, x - cw / 2 - 0.0005, z, face - 0.0002, 0.0010, 0.0004, Math.min(0.0024, cd * 0.6));
    itemAt(terminals, x + cw / 2 + 0.0005, z, face - 0.0002, 0.0010, 0.0004, Math.min(0.0024, cd * 0.6));
    const [lx, lz] = L(x, z);
    if (id === "kb" || id === "tp") {
      // Pestaña de cierre (actuador) del ZIF: franja marron oscuro en el borde
      // por donde entra la cinta, a ras de la cara inferior del conector.
      put(group, box(cw - 0.0004, 0.0006, 0.0013, "plasticDark", K.zifFlap), lx, face - ch + 0.00028, lz + cd / 2 - 0.0007);
    } else if (edp) {
      // Aislante negro con los contactos y barra de bloqueo.
      put(group, box(cw - 0.0014, 0.0004, cd - 0.0012, "plasticBlack"), lx, face - ch + 0.00018, lz);
    } else {
      // Ranuras de los contactos en los costados del cuerpo.
      const nSl = id === "battery" ? 6 : 3;
      for (let i = 0; i < nSl; i++) {
        const o = (i - (nSl - 1) / 2) * (cw / (nSl + 0.5));
        itemAt(slots, x + o, z + cd / 2 - 0.0003, face - ch * 0.55, cw / (nSl + 2), ch * 0.5, 0.0007);
      }
    }
    occupy(x, z, cw + 0.002, cd);
  });
  silk(conn.battery[0], conn.battery[1], 0.014, 0.006, "JBAT1", conn.battery[0] + 0.0082, conn.battery[1] + 0.0032);
  silk(conn.fan[0], conn.fan[1], 0.005, 0.004, "JFAN1", conn.fan[0] + 0.0036, conn.fan[1] + 0.0022);
  silk(conn.kb[0], conn.kb[1], 0.028, 0.004, "JKB1", conn.kb[0] - 0.0140, conn.kb[1] - 0.0034);
  silk(conn.tp[0], conn.tp[1], 0.012, 0.0035, "JTP1", conn.tp[0] + 0.0068, conn.tp[1] + 0.0020);
  silk(conn.edp[0], conn.edp[1], 0.016, 0.004, "JEDP1", conn.edp[0] - 0.0080, conn.edp[1] + 0.0036);

  // ── Correspondencia con los puertos externos ────────────────────────────
  LAPTOP_PORTS.forEach((spec) => {
    const sign = spec.side === "left" ? -1 : 1;
    if (Math.abs(spec.along - B.centerZ) > d / 2) return;
    hang(box(0.006, 0.0018, spec.w * 0.9, "metalBrushed", K.edpShell), sign * (w / 2 - 0.004), spec.along, 0.0018);
    for (let i = 0; i < 4; i++) {
      hang(box(0.0008, 0.0005, 0.0008, "goldPin"), sign * (w / 2 - 0.009), spec.along - 0.0015 + i * 0.001, 0.0005);
    }
    // Patas de anclaje de la carcasa, a ambos lados del conector.
    itemAt(terminals, sign * (w / 2 - 0.004), spec.along - spec.w * 0.45 - 0.0006, face - 0.0002, 0.0024, 0.0004, 0.0009);
    itemAt(terminals, sign * (w / 2 - 0.004), spec.along + spec.w * 0.45 + 0.0006, face - 0.0002, 0.0024, 0.0004, 0.0009);
    occupy(sign * (w / 2 - 0.0055), spec.along, 0.012, spec.w + 0.002);
  });

  // ── Tornillos de la placa (cabeza hacia abajo) con su anillo metalizado ──
  const screws = LAPTOP_BOARD_SCREWS;
  const rings = [];
  screws.forEach(([x, z]) => {
    const [lx, lz] = L(x, z);
    // Tornillo DECORATIVO solo si el sistema interactivo no se hace cargo
    // (ver hardware_lab_3d_screws.js). El anillo metalizado del agujero se
    // dibuja siempre: es parte de la placa, no del tornillo.
    if (opts.serviceScrews !== false) {
      const s = buildSmallScrew(0.0017);
      s.rotation.x = Math.PI;
      s.position.set(lx, face - 0.0004, lz);
      group.add(s);
    }
    rings.push(new THREE.Matrix4().compose(new THREE.Vector3(lx, face - 0.00002, lz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Vector3(1, 1, 1)));
    occupy(x, z, 0.0062, 0.0062);
  });
  if (!GEO.mountRing) GEO.mountRing = new THREE.RingGeometry(0.0018, 0.0030, 24);
  const ringMesh = instancedGeometry(GEO.mountRing, materialFor("goldPin", K.plating), rings);
  ringMesh.name = "decal";
  group.add(ringMesh);

  // ── Pasivos SMD (0402 / 0603) en la superficie libre ────────────────────
  // Racimos alrededor de lo que los necesita en una placa real (desacoplo
  // junto a chips y VRM, filtros junto a conectores) y dispersos por el resto.
  // Semilla fija: la placa es identica en cada carga.
  {
    let seed = 7193;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const placed = [];
    const free = (r) => {
      if (r[0] < -w / 2 + 0.0015 || r[2] > w / 2 - 0.0015) return false;
      if (r[1] < B.centerZ - d / 2 + 0.0015 || r[3] > B.centerZ + d / 2 - 0.0015) return false;
      const hit = (o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1];
      return !keepOut.some(hit) && !placed.some(hit);
    };
    const caps = [], res = [];
    const clusters = [
      // [x0, z0, x1, z1, cantidad]
      [-0.030, -0.060, 0.020, -0.033, 46],   // alrededor del blindaje
      [-0.108, -0.066, -0.080, -0.034, 30],  // alrededor del EC
      [0.056, -0.050, 0.100, -0.028, 30],    // BIOS / cristal / conector de bateria
      [0.104, -0.099, 0.140, -0.076, 26],    // controlador y eDP
      [-0.070, -0.099, -0.030, -0.078, 26],  // VRM
      [-0.148, -0.098, -0.112, -0.052, 30],  // memoria soldada, codec
      [0.104, -0.050, 0.140, -0.030, 22],    // controlador de red
      [-0.030, -0.035, 0.040, -0.028, 20],   // franja de conectores FPC
      [-0.148, -0.099, 0.148, -0.028, 90],   // dispersos
    ];
    clusters.forEach(([x0, z0, x1, z1, n]) => {
      let tries = 0, ok = 0;
      while (ok < n && tries++ < n * 30) {
        const big = rnd() > 0.72;
        const len = big ? 0.0016 : 0.0010, wid = big ? 0.0008 : 0.0005, hgt = big ? 0.00045 : 0.00035;
        const rot = rnd() > 0.5;
        const fw = rot ? wid : len, fd = rot ? len : wid;
        const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
        const r = [x - fw / 2 - 0.00025, z - fd / 2 - 0.00025, x + fw / 2 + 0.00025, z + fd / 2 + 0.00025];
        if (!free(r)) continue;
        placed.push(r);
        const [lx, lz] = L(x, z);
        (rnd() > 0.38 ? caps : res).push({ x: lx, y: face - hgt / 2, z: lz, w: len, h: hgt, d: wid, ry: rot ? Math.PI / 2 : 0 });
        ok++;
      }
    });
    passiveMeshes(caps.map((it) => Object.assign(it, { kind: "cap" })).concat(res.map((it) => Object.assign(it, { kind: "res" })))).forEach((m) => group.add(m));
  }

  // Familias instanciadas.
  if (packages.length) group.add(instancedBoxes(packages, "chipBlack"));
  if (terminals.length) group.add(instancedBoxes(terminals, "metalSteel", K.terminal));
  if (slots.length) group.add(instancedBoxes(slots, "plasticBlack", K.slot));

  // Textura de placa + serigrafia REAL de lo montado.
  board.material.map = laptopBoardTexture("laptop-mb-v2", { width: w, depth: d, marks });
  board.material.needsUpdate = true;

  setShadow(group);
  noShadowForTiny(group);
  const A = (xBase, zBase, dy) => {
    const [x, z] = L(xBase, zBase);
    return new THREE.Vector3(x, face - (dy || 0), z);
  };
  return {
    group,
    dims: { width: w, depth: d, thickness: t },
    anchors: {
      // Puntos EN LA CARA de componentes (y = face).
      cpuSocket: A(cpu[0], cpu[1]),
      ramSlot: A(ram[0], ram[1]),
      m2Slot: A(m2[0], m2[1]),
      wifiSlot: A(wifi[0], wifi[1]),
      // Conectores: punto en su cara inferior (donde entra el enchufe).
      batteryConnector: A(conn.battery[0], conn.battery[1], conn.battery[3]),
      fanHeader: A(conn.fan[0], conn.fan[1], conn.fan[3]),
      keyboardFpc: A(conn.kb[0], conn.kb[1], conn.kb[3]),
      touchpadFpc: A(conn.tp[0], conn.tp[1], conn.tp[3]),
      edpConnector: A(conn.edp[0], conn.edp[1], conn.edp[3]),
      // Puntos de tornillo de la placa, en el plano de la cara de componentes
      // (donde se asienta la cabeza). mapAnchors del rig soporta arrays.
      mountScrews: LAPTOP_BOARD_SCREWS.map(([x, z]) => A(x, z)),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   3. PROCESADOR Y REFRIGERACION
   ══════════════════════════════════════════════════════════════════════════ */

/** SoC del portatil: die de silicio sobre sustrato, sin IHS (como en un
 *  portatil real, donde el die va desnudo contra el disipador). */
export function buildLaptopCpu(opts = {}) {
  const s = opts.size || 0.024;
  const g = new THREE.Group();
  g.name = "laptop-cpu";
  g.add(box(s, 0.0011, s, "pcbDarkGreen"));          // sustrato
  // Die de silicio desnudo: espejo oscuro (iteracion visual sep-18: el gris
  // claro de antes se leia como una pastilla de plastico blanca) y, al lado,
  // el die mas pequeño del chipset integrado en el mismo encapsulado.
  const die = box(s * 0.62, 0.0007, s * 0.62, "silicon", SILICON_LOOK);
  die.position.y = 0.0009;
  g.add(die);
  put(g, box(0.0030, 0.0006, 0.0060, "silicon", SILICON_LOOK), s * 0.41, 0.00085, 0);
  // Condensadores del sustrato en filas junto a los bordes (como en un
  // encapsulado BGA real) y marca dorada de la esquina del pin 1.
  const caps = [];
  for (let i = 0; i < 9; i++) caps.push({ x: -s * 0.41, y: 0.0008, z: -0.008 + i * 0.002, w: 0.0012, h: 0.0005, d: 0.0006, ry: Math.PI / 2, kind: "cap" });
  for (let i = 0; i < 7; i++) {
    caps.push({ x: -0.006 + i * 0.002, y: 0.0008, z: s * 0.41, w: 0.0012, h: 0.0005, d: 0.0006, kind: "cap" });
    caps.push({ x: -0.006 + i * 0.002, y: 0.0008, z: -s * 0.41, w: 0.0012, h: 0.0005, d: 0.0006, kind: "cap" });
  }
  passiveMeshes(caps).forEach((m) => g.add(m));
  put(g, box(0.0016, 0.00005, 0.0016, "goldPin"), s * 0.44, 0.000575, s * 0.44);
  setShadow(g);
  noShadowForTiny(g);
  return g;
}

// Aspecto del MODULO TERMICO (iteracion visual, sep-18). La version anterior
// se leia como un modelo simplificado (auditoria con capturas de cerca): el
// ventilador era un "donut" gris claro sin carcasa, el heatpipe una varilla
// con una esfera en el codo y la tapa plana a la vista, las 18 aletas un
// peine blanco y la placa de contacto una losa sin brida. Cada familia tiene
// ahora su acabado propio para que se distingan entre si: cobre pulido
// (bloque) frente a cobre con patina (tubo), acero pavonado (brida), plastico
// negro (carcasa del ventilador) y aluminio satinado (aletas y tapa).
// Valores elegidos midiendo la luminancia de capturas con la luz de la escena
// (compartida con el escritorio, que no se toca).
const THERMAL_LOOK = {
  plate: { color: 0xc98446, roughness: 0.3, metalness: 0.72 },
  pipe: { color: 0xa45a2c, roughness: 0.44, metalness: 0.62 },
  solder: { color: 0x9d9a92, roughness: 0.42, metalness: 0.6 },
  bracket: { color: 0x5d636b, roughness: 0.46, metalness: 0.6 },
  fanBody: { color: 0x121316, roughness: 0.68, metalness: 0.04, envMapIntensity: 0.35 },
  fanCover: { color: 0x7a8088, roughness: 0.5, metalness: 0.5 },
  blades: { color: 0x1d1f23, roughness: 0.58, metalness: 0.04, envMapIntensity: 0.4 },
  hub: { color: 0x0d0e10, roughness: 0.55, metalness: 0.08, envMapIntensity: 0.35 },
  fins: { color: 0x8e959e, roughness: 0.46, metalness: 0.66 },
  finFlange: { color: 0x7f868f, roughness: 0.52, metalness: 0.6 },
  paste: { color: 0x8a8d92, roughness: 0.95, metalness: 0 },
};

/** Codo del heatpipe: cuarto de toroide aplanado (seccion 6.4 x 3.5 mm). La
 *  version anterior ponia una ESFERA en la union de los dos tramos rectos, que
 *  se leia como una rotula. Queda en el plano XZ, del eje +X al eje -Z
 *  alrededor de su centro; geometria compartida (cache GEO). */
function pipeBendGeometry(bendR, pipeR, flat) {
  const key = `bend${bendR}_${pipeR}_${flat}`;
  if (!GEO[key]) {
    const geo = new THREE.TorusGeometry(bendR, pipeR, 12, 12, Math.PI / 2);
    geo.rotateX(-Math.PI / 2);   // (R cos t, R sin t, 0) -> (R cos t, 0, -R sin t)
    geo.scale(1, flat, 1);       // aplanado en Y, como los tramos rectos
    GEO[key] = geo;
  }
  return GEO[key];
}

/** Caja delgada tendida entre dos puntos 3D (brazos inclinados de la brida).
 *  Su eje X local sigue el segmento y su ancho queda horizontal. */
function strutBetween(a, b, width, thickness, kind, overrides) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  const m = box(len, thickness, width, kind, overrides);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, up, side.negate()));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  return m;
}

/** Orejas atornilladas de la brida del disipador, en coordenadas LOCALES del
 * modulo: [x, z, xArranqueDelBrazo, zArranqueDelBrazo]. El catalogo de
 * tornillos interactivos (hardware_lab_3d_layout_laptop.js) las usa para
 * colocar cada tornillo sobre una oreja que existe de verdad en la geometria.
 */
export const LAPTOP_COOLER_EARS = [
  [0.018, 0.012, 0.010, 0.003],
  [-0.018, -0.012, -0.010, -0.003],
  [0.012, -0.018, 0.006, -0.0035],
];

/**
 * Modulo de refrigeracion completo, como una sola pieza de servicio (asi se
 * retira en un portatil real): bloque de contacto sobre el CPU -> heatpipe de
 * cobre -> bloque de aletas -> ventilador centrifugo -> salida de aire.
 * La relacion fisica entre las 5 partes queda visible de un vistazo.
 *
 * ITERACION VISUAL (sep-18): misma pieza de servicio, mismo origen, mismo
 * anclaje del cable del ventilador y MISMA CAJA ENVOLVENTE (la bandeja y los
 * recorridos se calculan con ella); solo cambia el detalle interior:
 *   - ventilador tipo blower real: carcasa en VOLUTA (espiral que se abre
 *     hacia la boca de salida contra las aletas), boca de admision con 3
 *     soportes y el motor con su etiqueta, 31 alabes curvos;
 *   - heatpipe continuo: tramos aplanados unidos por un codo toroidal (no una
 *     esfera) y extremos SELLADOS aplastados, soldado al bloque de cobre;
 *   - brida de resorte de acero con 3 brazos hasta los tornillos;
 *   - pila de 40 aletas finas (antes 18: se leia como un peine) con sus
 *     pestañas plegadas y chapas laterales.
 * Todo propio y procedural: no reproduce ningun modelo ni recurso de terceros.
 */
export function buildLaptopCooler(opts = {}) {
  const g = new THREE.Group();
  g.name = "laptop-cooler";
  const T = THERMAL_LOOK;
  // Geometria COLGANTE (fase 3): el origen local es la cara superior del
  // bloque de contacto, que toca el die del CPU; todo lo demas queda debajo
  // (-Y), hacia la tapa inferior, que es por donde el ventilador toma aire.
  // Medidas relativas al centro del CPU (base: x -48, z -63 mm). Las aletas
  // estan contra la rejilla trasera y el heatpipe llega a ellas.
  const fanR = opts.fanRadius || 0.019;
  const fan = opts.fanCenter || [-0.037, -0.017];
  const backZ = opts.pipeBackZ != null ? opts.pipeBackZ : -0.041;   // tramo hacia las aletas
  const finX0 = -0.062, finX1 = -0.013;                               // bloque de aletas (x)
  const finZ = backZ;                                                  // centrado en el heatpipe
  const finDepth = 0.010, finH = 0.008;

  // ── Bloque de contacto (cobre pulido) + pasta termica sobre el die ──────
  put(g, box(0.030, 0.0016, 0.030, "copper", T.plate), 0, -0.0008, 0);
  put(g, box(0.017, 0.0003, 0.017, "thermalPaste", T.paste), 0, -0.0001, 0);

  // ── Heatpipe (seccion aplanada 6.4 x 3.5 mm) ────────────────────────────
  // Tramo A cruza el bloque de cobre (soldado a el) hacia la pared trasera,
  // codo de radio 7 mm y tramo B a lo largo del bloque de aletas.
  const pipeR = 0.0032, flat = 0.55;
  const pipeY = -0.0016 - 0.00175;
  const bendR = 0.007;
  const zA0 = 0.0075, zA1 = backZ + bendR;
  const pipeA = new THREE.Mesh(cyl(pipeR, pipeR, zA0 - zA1, 16), materialFor("copper", T.pipe));
  pipeA.rotation.x = Math.PI / 2;
  pipeA.scale.z = flat;                   // aplanado en Y tras la rotacion
  put(g, pipeA, 0, pipeY, (zA0 + zA1) / 2);
  put(g, new THREE.Mesh(pipeBendGeometry(bendR, pipeR, flat), materialFor("copper", T.pipe)), -bendR, pipeY, zA1);
  const xB0 = -bendR, xB1 = finX0 + 0.0030;
  const pipeB = new THREE.Mesh(cyl(pipeR, pipeR, xB0 - xB1, 16), materialFor("copper", T.pipe));
  pipeB.rotation.z = Math.PI / 2;
  pipeB.scale.x = flat;
  put(g, pipeB, (xB0 + xB1) / 2, pipeY, backZ);
  // Extremos SELLADOS: el tubo se estrecha y termina aplastado en una lengueta
  // (la soldadura de cierre), no en una tapa redonda: con la tapa plana a la
  // vista se leia como una varilla de plastico. Tramo conico aplanado + lengueta.
  const taperL = 0.003;
  const taperA = new THREE.Mesh(cyl(pipeR * 0.55, pipeR, taperL, 16), materialFor("copper", T.pipe));
  taperA.rotation.x = Math.PI / 2;        // radio mayor hacia el tubo (-Z)
  taperA.scale.z = flat;
  put(g, taperA, 0, pipeY, zA0 + taperL / 2);
  put(g, box(0.0030, 0.0005, 0.0022, "copper", T.pipe), 0, pipeY, zA0 + taperL + 0.0009);
  const taperB = new THREE.Mesh(cyl(pipeR * 0.55, pipeR, taperL, 16), materialFor("copper", T.pipe));
  taperB.rotation.z = -Math.PI / 2;       // radio mayor hacia el tubo (+X)
  taperB.scale.x = flat;
  put(g, taperB, xB1 - taperL / 2, pipeY, backZ);
  put(g, box(0.0011, 0.0005, 0.0030, "copper", T.pipe), xB1 - taperL - 0.0004, pipeY, backZ);
  // Soldadura del tubo al bloque: dos cordones plateados a lo largo del tubo.
  [-1, 1].forEach((s) => put(g, box(0.0007, 0.0004, 0.027, "metalSteel", T.solder), s * (pipeR + 0.0002), -0.0016 - 0.0002, 0));

  // ── Brida de resorte (acero pavonado) ───────────────────────────────────
  // Fleje transversal que abraza el tubo por debajo del bloque y 3 brazos
  // inclinados que suben hasta las orejas atornilladas a la placa base (asi
  // presiona el bloque contra el die). Los brazos pasan por debajo del cobre
  // hasta salir de su huella.
  const strapY = pipeY - 0.00176 - 0.00025;
  put(g, box(0.024, 0.0005, 0.008, "metalDark", T.bracket), 0, strapY, 0);
  const ears = LAPTOP_COOLER_EARS;
  ears.forEach(([x, z, sx, sz]) => {
    const toEar = new THREE.Vector2(x - sx, z - sz).normalize();
    const end = new THREE.Vector3(x - toEar.x * 0.0025, -0.0011, z - toEar.y * 0.0025);
    g.add(strutBetween(new THREE.Vector3(sx, strapY, sz), end, 0.0032, 0.0005, "metalDark", T.bracket));
    // Oreja redonda y tornillo cautivo.
    put(g, new THREE.Mesh(cyl(0.0035, 0.0035, 0.0008, 16), materialFor("metalDark", T.bracket)), x, -0.0004, z);
    // Tornillo DECORATIVO solo si el sistema de tornillos interactivos no se
    // hace cargo de estas orejas (ver hardware_lab_3d_screws.js).
    if (opts.serviceScrews !== false) {
      const s = buildSmallScrew(0.0015);
      s.rotation.x = Math.PI;
      s.position.set(x, -0.0012, z);
      g.add(s);
    }
  });

  // ── Pila de aletas contra la rejilla trasera (salida de aire) ───────────
  const fins = [];
  const nFins = 40;
  const pitch = (finX1 - finX0 - 0.001) / (nFins - 1);
  for (let i = 0; i < nFins; i++) {
    fins.push({ x: finX0 + 0.0005 + pitch * i, y: -0.0008 - finH / 2, z: finZ, w: 0.00022, h: finH, d: finDepth });
  }
  g.add(instancedBoxes(fins, "heatsinkFin", T.fins));
  // Pestañas plegadas arriba y abajo (el plegado de cada aleta forma una
  // superficie continua) y chapas laterales de la pila.
  put(g, box(finX1 - finX0 + 0.002, 0.0006, finDepth + 0.001, "heatsinkFin", T.finFlange), (finX0 + finX1) / 2, -0.0008 - 0.0003, finZ);
  put(g, box(finX1 - finX0 + 0.002, 0.0006, finDepth + 0.001, "heatsinkFin", T.finFlange), (finX0 + finX1) / 2, -0.0008 - finH + 0.0003, finZ);
  [finX0 - 0.00025, finX1 + 0.00025].forEach((x) => put(g, box(0.0005, finH - 0.0012, finDepth + 0.0006, "metalSteel", T.finFlange), x, -0.0008 - finH / 2, finZ));

  // ── Ventilador centrifugo (blower) ──────────────────────────────────────
  // Contorno de la carcasa en planta (x, z): espiral (VOLUTA) que arranca en
  // la lengueta junto a la boca de salida con 16.8 mm de radio y se abre hasta
  // el radio completo; luego baja recta hasta la cara de las aletas y cierra
  // por la boca. Del lado del cable del ventilador (+x +z) la espiral es mas
  // estrecha: su enchufe queda a 19.8 mm del eje y la carcasa no lo toca.
  const [fx, fz] = fan;
  const fanTop = -0.0012, fanH = 0.0055;
  const fanBottom = fanTop - fanH;                 // -6.7 mm
  const fanCY = fanTop - fanH / 2;
  const tongueA = -Math.PI / 3, rTongue = fanR - 0.0022;
  const outletZ = fz - fanR;                       // cara delantera de las aletas
  const outline = [];
  for (let i = 0, n = 40; i <= n; i++) {
    const a = tongueA + (Math.PI - tongueA) * (i / n);
    const r = rTongue + (fanR - rTongue) * (i / n);
    outline.push([fx + Math.cos(a) * r, fz + Math.sin(a) * r]);
  }
  outline.push([fx - fanR, outletZ]);
  outline.push([fx + Math.cos(tongueA) * rTongue + 0.0026, outletZ]);
  const intakeR = 0.0118;
  const intake = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    intake.push([fx + Math.cos(a) * intakeR, fz + Math.sin(a) * intakeR]);
  }
  // Tapa superior de aluminio (mira a la placa) y fondo de plastico negro con
  // la boca de admision (mira a la tapa inferior del equipo: es lo que se ve).
  const coverT = 0.00055;
  put(g, buildNotchedPcb(outline, [], coverT, "metalBrushed", T.fanCover), 0, fanTop - coverT / 2, 0);
  // Etiqueta del modulo sobre la tapa (mira a la placa; se lee en la bandeja).
  put(g, decal(0.022, 0.014, moduleLabelTexture("fan"), 1, { roughness: 0.8 }), fx - 0.002, fanTop + 0.00002, fz + 0.001);
  // Orejas de montaje de la carcasa con su tornillo: dos del lado de la pared
  // y una junto a la lengueta.
  [[fx - fanR - 0.0025, fz + 0.007], [fx - fanR - 0.0025, outletZ + 0.006], [fx + 0.0205, fz - 0.009]].forEach(([x, z]) => {
    put(g, new THREE.Mesh(cyl(0.0024, 0.0024, coverT, 16), materialFor("metalBrushed", T.fanCover)), x, fanTop - coverT / 2, z);
    const sc = buildSmallScrew(0.0013);
    sc.rotation.x = Math.PI;
    sc.position.set(x, fanTop - coverT - 0.0004, z);
    g.add(sc);
  });
  const bottomT = 0.00055;
  put(g, buildNotchedPcb(outline, [intake], bottomT, "plasticBlack", T.fanBody), 0, fanBottom + bottomT / 2, 0);
  // Pared lateral: tramos rectos a lo largo del contorno (salvo la boca).
  const wallTop = fanTop - coverT, wallBottom = fanBottom + bottomT;
  const walls = [];
  for (let i = 0; i < outline.length - 1; i++) {
    const [ax, az] = outline[i];
    const [bx, bz] = outline[i + 1];
    if (Math.abs(az - outletZ) < 1e-6 && Math.abs(bz - outletZ) < 1e-6) continue;   // boca de salida
    const len = Math.hypot(bx - ax, bz - az);
    walls.push({ x: (ax + bx) / 2, y: (wallTop + wallBottom) / 2, z: (az + bz) / 2, w: len + 0.0002, h: wallTop - wallBottom, d: 0.0006, ry: Math.atan2(-(bz - az), bx - ax) });
  }
  // Cierre entre la lengueta y la boca.
  {
    const [ax, az] = outline[outline.length - 1];
    const [bx, bz] = outline[0];
    const len = Math.hypot(bx - ax, bz - az);
    walls.push({ x: (ax + bx) / 2, y: (wallTop + wallBottom) / 2, z: (az + bz) / 2, w: len, h: wallTop - wallBottom, d: 0.0006, ry: Math.atan2(-(bz - az), bx - ax) });
  }
  g.add(instancedBoxes(walls, "plasticBlack", T.fanBody));

  // Rotor: copa del motor y 31 alabes curvados hacia delante (dos tramos cada
  // uno), del alto de la carcasa. Se ven a traves de la boca de admision.
  const rotorTop = wallTop - 0.0001, rotorBottom = wallBottom + 0.00015;
  put(g, new THREE.Mesh(cyl(0.0071, 0.0071, rotorTop - rotorBottom, 24), materialFor("plasticBlack", T.hub)), fx, (rotorTop + rotorBottom) / 2, fz);
  const blades = [];
  const bladeY = (rotorTop + rotorBottom) / 2, bladeH = rotorTop - rotorBottom;
  const seg = (ra, rb, aa, ab) => {
    const x0 = fx + Math.cos(aa) * ra, z0 = fz + Math.sin(aa) * ra;
    const x1 = fx + Math.cos(ab) * rb, z1 = fz + Math.sin(ab) * rb;
    blades.push({ x: (x0 + x1) / 2, y: bladeY, z: (z0 + z1) / 2, w: Math.hypot(x1 - x0, z1 - z0) + 0.0003, h: bladeH, d: 0.00035, ry: Math.atan2(-(z1 - z0), x1 - x0) });
  };
  for (let i = 0, n = 31; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    seg(0.0071, 0.0118, a0, a0 + 0.12);
    seg(0.0118, 0.0158, a0 + 0.12, a0 + 0.30);
  }
  g.add(instancedBoxes(blades, "fanBlade", T.blades));

  // Soporte del motor en la boca de admision: disco central y 3 radios en el
  // plano del fondo, con la etiqueta del ventilador en el disco.
  const bottomY = fanBottom + bottomT / 2;
  put(g, new THREE.Mesh(cyl(0.0072, 0.0072, bottomT, 24), materialFor("plasticBlack", T.fanBody)), fx, bottomY, fz);
  [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3].forEach((a) => {
    const r0 = 0.0068, r1 = intakeR + 0.0004;
    put(g, box(r1 - r0, bottomT, 0.0013, "plasticBlack", T.fanBody), fx + Math.cos(a) * (r0 + r1) / 2, bottomY, fz + Math.sin(a) * (r0 + r1) / 2).rotation.y = -a;
  });
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.0060, 28), materialInstanceFor("labelWhite", { roughness: 0.6 }));
  label.material.map = fanLabelTexture();
  label.material.needsUpdate = true;
  label.rotation.x = Math.PI / 2;          // mira hacia abajo (-Y), a la tapa inferior
  label.name = "fan-label";
  put(g, label, fx, fanBottom - 0.00003, fz);

  setShadow(g);
  noShadowForTiny(g);
  label.castShadow = false;
  g.userData.anchors = {
    // Salida del cable del ventilador, en el borde de la carcasa.
    fanCable: new THREE.Vector3(fan[0] + fanR * 0.72, fanCY, fan[1] + fanR * 0.78),
  };
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   4. MEMORIA RAM (SO-DIMM)
   ══════════════════════════════════════════════════════════════════════════ */

/** SO-DIMM 67.6 x 30 x 3.8 mm: PCB, 8 chips, etiqueta, contactos dorados con
 *  su muesca descentrada y los semicirculos laterales del clip. */
export function buildSoDimm(opts = {}) {
  const w = opts.width || 0.0676;
  const d = opts.depth || 0.030;
  const t = 0.0012;
  const g = new THREE.Group();
  g.name = "laptop-sodimm";

  // PCB con RECORTES REALES (ya no bloques oscuros pegados encima): la muesca
  // descentrada del borde de contactos y las dos entalladuras laterales donde
  // muerden los clips del socket. Ver buildNotchedPcb.
  const notchX = -w * 0.08;
  const edge = d / 2;
  const outline = [
    [-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, edge], [-w / 2, edge],
  ];
  const holes = [
    // Muesca del borde de contactos: se abre hacia +Z (el lado del socket).
    [[notchX - 0.0011, edge - 0.0032], [notchX + 0.0011, edge - 0.0032],
     [notchX + 0.0011, edge + 0.0005], [notchX - 0.0011, edge + 0.0005]],
    // Entalladuras de los clips, en los dos costados.
    [[-w / 2 - 0.0005, -d * 0.24], [-w / 2 + 0.0016, -d * 0.24],
     [-w / 2 + 0.0016, -d * 0.12], [-w / 2 - 0.0005, -d * 0.12]],
    [[w / 2 - 0.0016, -d * 0.24], [w / 2 + 0.0005, -d * 0.24],
     [w / 2 + 0.0005, -d * 0.12], [w / 2 - 0.0016, -d * 0.12]],
  ];
  const pcb = buildNotchedPcb(outline, holes, t, "pcbDarkGreen");
  g.add(pcb);

  // Chips: 4 por cara, con su marcaje laser (codigos propios).
  for (let i = 0; i < 4; i++) {
    const chip = buildChip(0.0115, 0.0105, 0.0009);
    chip.position.set(-w * 0.34 + i * 0.0165, t / 2 + 0.00045, -d * 0.12);
    g.add(chip);
    put(g, decal(0.0104, 0.0094, chipMarkingTexture("dram-8g", ["SL8G08", "D4-3200", "2236"], 0.0115 / 0.0105), 1), chip.position.x, t / 2 + 0.0009 + 0.00002, chip.position.z);
  }
  // Etiqueta impresa (capacidad, tipo, velocidad, lote): antes una lamina
  // blanca lisa. Misma caja; solo cambia su material.
  const label = box(w * 0.40, 0.0002, d * 0.22, "labelWhite");
  label.material = texturedMaterial(moduleLabelTexture("ram"), { roughness: 0.82, metalness: 0 });
  put(g, label, -w * 0.20, t / 2 + 0.0001, d * 0.30);
  // SPD.
  const spd = buildChip(0.003, 0.0025, 0.0006);
  spd.position.set(w * 0.30, t / 2 + 0.0003, -d * 0.10);
  g.add(spd);
  // Resistencias de terminacion y condensadores de desacoplo: una fila entre
  // los chips y el borde de contactos y otra detras de los chips.
  const passives = [];
  passiveRow(passives, -w / 2 + 0.004, w / 2 - 0.004, 0.0035, t, 24, false, 311);
  passiveRow(passives, -w / 2 + 0.004, w * 0.22, -0.0118, t, 14, true, 617);
  passiveMeshes(passives).forEach((m) => g.add(m));

  // Borde de contactos: 2 bloques separados por la muesca (descentrada, como
  // en un SO-DIMM real: es la que impide montarlo al reves).
  const edgeZ = d / 2 - 0.0012;
  const leftSpan = (notchX - 0.0012) - (-w / 2 + 0.002);
  const rightSpan = (w / 2 - 0.002) - (notchX + 0.0012);
  // Contactos instanciados (antes un mesh por contacto: 34 llamadas de dibujo).
  const pins = [];
  const pinsIn = (startX, span, count) => {
    const step = span / count;
    for (let i = 0; i < count; i++) pins.push({ x: startX + step * (i + 0.5), y: 0, z: edgeZ, w: 0.0008, h: 0.0006, d: 0.0022 });
  };
  pinsIn(-w / 2 + 0.002, leftSpan, Math.round(leftSpan / 0.0018));
  pinsIn(notchX + 0.0012, rightSpan, Math.round(rightSpan / 0.0018));
  g.add(instancedBoxes(pins, "goldPin"));
  setShadow(g);
  noShadowForTiny(g);
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   5. ALMACENAMIENTO (SSD M.2 2280 - una sola interfaz, sin mezclar con SATA)
   ══════════════════════════════════════════════════════════════════════════ */

/** SSD M.2 2280: PCB 22 x 80 mm, controlador, 2 NAND, DRAM, etiqueta,
 *  contactos con muesca de llave M y muesca del tornillo de fijacion. */
export function buildM2Ssd(opts = {}) {
  const w = opts.width || 0.080;   // largo (eje X)
  const d = opts.depth || 0.022;   // ancho (eje Z)
  const t = 0.0011;
  const g = new THREE.Group();
  g.name = "laptop-m2-ssd";

  // PCB con la media luna del tornillo de fijacion recortada de verdad y la
  // muesca de llave M en el borde de contactos.
  const outlineM2 = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  const holesM2 = [
    // Media luna del tornillo (aproximada con un octagono: a 1.8 mm de radio
    // nadie distingue un octagono de un circulo, y cuesta 8 vertices).
    (() => {
      const r = 0.0018, cx = w / 2 - 0.0012, pts = [];
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * (0.5 + i / 7);
        pts.push([cx + Math.cos(a) * r, Math.sin(a) * r]);
      }
      return pts;
    })(),
    // Muesca de llave M.
    [[-w / 2 - 0.0005, d / 2 - 0.0052], [-w / 2 + 0.0038, d / 2 - 0.0052],
     [-w / 2 + 0.0038, d / 2 - 0.0030], [-w / 2 - 0.0005, d / 2 - 0.0030]],
  ];
  g.add(buildNotchedPcb(outlineM2, holesM2, t, "pcbDarkGreen", { color: 0x0b2a18 }));

  const ctrl = buildChip(0.010, 0.010, 0.0010);
  ctrl.position.set(-w * 0.10, t / 2 + 0.0005, 0);
  g.add(ctrl);
  put(g, decal(0.009, 0.009, chipMarkingTexture("ssd-ctrl", ["SLNV-E12", "2233  C0"], 1), 1), ctrl.position.x, t / 2 + 0.0010 + 0.00002, 0);
  for (let i = 0; i < 2; i++) {
    const nand = buildChip(0.013, 0.012, 0.0010);
    nand.position.set(w * 0.10 + i * 0.016, t / 2 + 0.0005, 0);
    g.add(nand);
  }
  const dram = buildChip(0.007, 0.006, 0.0008);
  dram.position.set(-w * 0.26, t / 2 + 0.0004, d * 0.22);
  g.add(dram);
  put(g, decal(0.0063, 0.0054, chipMarkingTexture("ssd-dram", ["SL4G16", "2231"], 0.007 / 0.006), 1), dram.position.x, t / 2 + 0.0008 + 0.00002, dram.position.z);
  // Etiqueta impresa sobre la NAND (capacidad, interfaz, numero de serie).
  const label = box(w * 0.34, 0.0002, d * 0.5, "labelWhite");
  label.material = texturedMaterial(moduleLabelTexture("ssd"), { roughness: 0.82, metalness: 0 });
  put(g, label, w * 0.14, t / 2 + 0.0011, 0);
  // Pasivos: desacoplo junto al controlador y la DRAM, y filtro de la
  // alimentacion junto al conector.
  const passives = [];
  passiveRow(passives, -w * 0.36, -w * 0.17, -d * 0.36, t, 10, false, 211);
  passiveRow(passives, -w * 0.20, -w * 0.02, d * 0.36, t, 9, false, 419);
  passiveRow(passives, -w * 0.43, -w * 0.38, -d * 0.05, t, 3, true, 523);
  passiveMeshes(passives).forEach((m) => g.add(m));

  // Contactos + muesca de llave M (hacia -X, el lado del conector).
  const cx = -w / 2 + 0.0015;
  const pins = [];
  for (let i = 0; i < 26; i++) pins.push({ x: cx, y: 0, z: -d / 2 + 0.0035 + i * 0.00065, w: 0.0006, h: 0.0005, d: 0.0016 });
  g.add(instancedBoxes(pins, "goldPin"));
  setShadow(g);
  noShadowForTiny(g);
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   6. TARJETA WI-FI (M.2 2230)
   ══════════════════════════════════════════════════════════════════════════ */

/** Tarjeta Wi-Fi M.2 2230: PCB, blindaje, chip, dos conectores u.FL
 *  diferenciados (principal / auxiliar) y contactos con llave A+E. */
export function buildWifiCard(opts = {}) {
  const w = opts.width || 0.030;   // largo (eje X)
  const d = opts.depth || 0.022;   // ancho (eje Z)
  const t = 0.0010;
  const g = new THREE.Group();
  g.name = "laptop-wifi-card";

  const outlineW = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  const holesW = [(() => {
    const r = 0.0016, cx = w / 2 - 0.001, pts = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.5 + i / 7);
      pts.push([cx + Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  })()];
  g.add(buildNotchedPcb(outlineW, holesW, t, "pcbDarkGreen", { color: 0x12301f }));
  // Blindaje de chapa estañada con su etiqueta impresa (modelo, bandas,
  // formato): sin ella era una placa gris lisa.
  const shield = box(w * 0.52, 0.0009, d * 0.6, "metalDark", BOARD_LOOK.shield);
  put(g, shield, w * 0.06, t / 2 + 0.00045, -d * 0.05);
  put(g, decal(w * 0.52 - 0.0008, d * 0.6 - 0.0008, moduleLabelTexture("wifi"), 1, { roughness: 0.8 }), w * 0.06, t / 2 + 0.0009 + 0.00002, -d * 0.05);
  // Serigrafia de los conectores de antena (MAIN / AUX), recortada.
  [["MAIN", d * 0.28], ["AUX", -d * 0.28]].forEach(([txt, z]) => {
    put(g, decal(0.0028, 0.0014, silkTextTexture(txt), 1, { alphaTest: 0.5, roughness: 0.8 }), -w * 0.28 - 0.0031, t / 2 + 0.00002, z);
  });
  const passives = [];
  passiveRow(passives, w * 0.00, w * 0.36, d * 0.36, t, 7, false, 733);
  passiveRow(passives, w * 0.40, w * 0.40, -d * 0.10, t, 1, true, 811);
  passiveMeshes(passives).forEach((m) => g.add(m));

  // Conectores u.FL: el principal (MAIN) con anillo claro, el auxiliar (AUX)
  // con anillo oscuro -- asi se distingue a que antena va cada cable.
  const mk = (x, z, ring) => {
    const base = new THREE.Mesh(cyl(0.0014, 0.0014, 0.0008, 10), materialFor("metalBrushed"));
    put(g, base, x, t / 2 + 0.0004, z);
    const r = new THREE.Mesh(cyl(0.0009, 0.0009, 0.0005, 8), materialFor(ring));
    put(g, r, x, t / 2 + 0.0009, z);
    return new THREE.Vector3(x, t / 2 + 0.0012, z);
  };
  const uflMain = mk(-w * 0.28, d * 0.28, "labelWhite");
  const uflAux = mk(-w * 0.28, -d * 0.28, "plasticBlack");

  const pins = [];
  for (let i = 0; i < 16; i++) pins.push({ x: -w / 2 + 0.0012, y: 0, z: -d / 2 + 0.003 + i * 0.001, w: 0.0005, h: 0.0005, d: 0.0014 });
  g.add(instancedBoxes(pins, "goldPin"));
  setShadow(g);
  noShadowForTiny(g);
  g.userData.anchors = { uflMain, uflAux };
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   7. BATERIA
   ══════════════════════════════════════════════════════════════════════════ */

/** Bateria de 3 celdas con su carcasa, separadores, etiqueta, PCB de
 *  proteccion y cable/conector hacia la placa. */
export function buildLaptopBattery(opts = {}) {
  const w = opts.width || 0.210;
  const d = opts.depth || 0.066;
  const h = opts.height || 0.0055;
  const g = new THREE.Group();
  g.name = "laptop-battery";

  // Marco del pack: plastico negro mate (ver BATTERY_LOOK).
  g.add(box(w, h, d, "batteryCell", BATTERY_LOOK.enclosure));
  // Celdas: 3 bolsas grafito satinado separadas por costuras negras.
  for (let i = 0; i < 3; i++) {
    const cell = box(w / 3 - 0.004, h * 1.02, d * 0.9, "batteryCell", BATTERY_LOOK.cells);
    put(g, cell, -w / 2 + (w / 3) * (i + 0.5), 0, 0);
  }
  for (let i = 1; i < 3; i++) {
    put(g, box(0.0018, h * 1.05, d, "plasticDark", BATTERY_LOOK.seam), -w / 2 + (w / 3) * i, 0, 0);
  }
  // Etiqueta impresa (tension, capacidad, advertencias, codigo de barras).
  const label = box(w * 0.26, 0.0002, d * 0.34, "labelWhite");
  label.material = materialInstanceFor("labelWhite");
  label.material.map = batteryLabelTexture();
  label.material.needsUpdate = true;
  put(g, label, -w * 0.02, h / 2 + 0.0001, 0);
  // PCB de proteccion en el borde, del lado del conector.
  put(g, box(0.030, 0.0016, 0.008, "pcbDarkGreen"), w * 0.34, h / 2 - 0.0002, d * 0.40);

  // Orejas de fijacion (sep-2026): antes los 2 tornillos iban a 10 mm del
  // borde, DENTRO del pack (lo atravesaban 3.45 mm). Ahora cada tornillo pasa
  // por una oreja que sobresale de los extremos y rosca en una torre del
  // chasis (buildLaptopBase, LAPTOP_BATTERY_SCREWS). La bateria va montada boca
  // abajo (FACE_DOWN): +y local es la cara que mira a la tapa inferior, donde
  // queda la oreja al ras, y z local = -(z del chasis - bahia).
  const earLen = 0.0075, earT = 0.0008, earD = 0.008;
  [-1, 1].forEach((s) => {
    const holeX = s * (LAPTOP_BATTERY_SCREW_X - (w / 2 + earLen / 2));
    const hole = circlePoints(holeX, 0, 0.0012, 12);
    const ear = buildNotchedPcb(
      [[-earLen / 2, -earD / 2], [earLen / 2, -earD / 2], [earLen / 2, earD / 2], [-earLen / 2, earD / 2]],
      [hole], earT, "metalDark", { color: 0x5b6068, roughness: 0.5, metalness: 0.55 }
    );
    ear.name = "battery-ear";
    put(g, ear, s * (w / 2 + earLen / 2), h / 2 - earT / 2, -LAPTOP_BATTERY_SCREW_DZ);
  });

  setShadow(g);
  g.userData.anchors = {
    // Punto de salida del cable hacia la placa (en el borde, no en el centro).
    plug: new THREE.Vector3(w * 0.40, h / 2, d * 0.40),
  };
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   9. PANTALLA, MARCO Y BISAGRAS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Conjunto de pantalla: tapa trasera, marco (bezel) de 4 lados, panel LCD,
 * camara INTEGRADA en el marco superior, microfonos, brazos de bisagra y el
 * punto de salida del cable eDP.
 *
 * El origen local del grupo es el EJE DE LA BISAGRA: al rotarlo, la tapa gira
 * completa hacia arriba en vez de hundir media geometria dentro de la base.
 */
export function buildLaptopLid(opts = {}) {
  const w = opts.width || LAPTOP.width;
  const d = opts.depth || 0.212;
  const t = 0.0045;                 // espesor de la tapa
  const bezel = 0.006;              // marco lateral/superior
  const chinBezel = 0.012;          // marco inferior (mas ancho, como es real)
  const g = new THREE.Group();
  g.name = "laptop-lid";

  // ORIENTACION (corregido tras ver las capturas): la tapa se autora con la
  // carcasa ARRIBA y el panel HACIA ABAJO, que es como queda con el portatil
  // CERRADO (la pantalla mira al teclado). Solo asi, al girar la tapa sobre la
  // bisagra para abrirla, el panel termina mirando al usuario. Autorado al
  // reves -- como estaba -- no existe ningun angulo que suba la tapa Y deje la
  // pantalla a la vista: se veia siempre el dorso de aluminio.
  // Cuerpo de la tapa desplazado 4.5 mm fuera del eje: asi el panel no
  // invade los nudillos de la bisagra al girar (fase 2: 3.5 mm de colision).
  const body = new THREE.Group();
  body.name = "laptop-lid-body";
  body.position.z = LAPTOP.hinge.radius + 0.001;
  g.add(body);
  put(body, box(w, t, d, "aluminum", { color: LAPTOP_SHELL.wall }), 0, -t / 2, d / 2);

  // Marco: 4 tiras en vez de una losa, para que el panel quede hundido.
  const fy = -(t + 0.0012);
  put(body, box(w, 0.0024, chinBezel, "plasticBlack"), 0, fy, chinBezel / 2);                 // inferior
  put(body, box(w, 0.0024, bezel, "plasticBlack"), 0, fy, d - bezel / 2);                     // superior
  put(body, box(bezel, 0.0024, d, "plasticBlack"), -w / 2 + bezel / 2, fy, d / 2);            // izquierdo
  put(body, box(bezel, 0.0024, d, "plasticBlack"), w / 2 - bezel / 2, fy, d / 2);             // derecho

  // Panel LCD hundido dentro del marco.
  const panelW = w - bezel * 2;
  const panelD = d - bezel - chinBezel;
  const panel = box(panelW, 0.0016, panelD, "plasticBlack", { color: 0x07080a });
  put(body, panel, 0, -(t + 0.0004), chinBezel + panelD / 2);
  const image = box(panelW * 0.995, 0.0004, panelD * 0.99, "plasticBlack", {
    color: 0x0d3350, emissive: 0x0c2f66, emissiveIntensity: 0.35,
  });
  image.name = "laptop-screen-emitter";
  put(body, image, 0, -(t + 0.0014), chinBezel + panelD / 2);

  // Camara integrada EN el marco superior (no flotando): alojamiento, lente
  // e indicador, mas dos microfonos a los lados.
  const camZ = d - bezel / 2;
  const camHousing = box(0.012, 0.0026, 0.005, "plasticBlack", { color: 0x0a0b0d });
  put(body, camHousing, 0, fy - 0.0002, camZ);
  const lens = new THREE.Mesh(cyl(0.0014, 0.0014, 0.0012, 12), materialFor("glassDark"));
  lens.rotation.x = Math.PI / 2;
  put(body, lens, 0, fy - 0.0012, camZ);
  const led = new THREE.Mesh(cyl(0.0005, 0.0005, 0.0008, 6), materialFor("ledGreen"));
  led.rotation.x = Math.PI / 2;
  put(body, led, 0.0042, fy - 0.0012, camZ);
  [-0.010, 0.010].forEach((x) => {
    const mic = new THREE.Mesh(cyl(0.0005, 0.0005, 0.0008, 6), materialFor("plasticDark"));
    mic.rotation.x = Math.PI / 2;
    put(body, mic, x, fy - 0.0012, camZ);
  });

  // Bisagra: nudillo EXTERIOR del eje (el interior es del cuerpo base) y su
  // brazo, que lo une a la tapa. Mismo eje que el origen del grupo.
  const hgL = LAPTOP.hinge, knuckleL = hgL.length / 2;
  [-1, 1].forEach((s) => {
    const kx = s * (hgL.x + knuckleL / 2);
    const k = new THREE.Mesh(cyl(hgL.radius, hgL.radius, knuckleL, 16), materialFor("metalSteel"));
    k.rotation.z = Math.PI / 2;
    put(g, k, kx, 0, 0);
    put(g, box(knuckleL, 0.0045, 0.012, "metalSteel"), kx, -t / 2, 0.008);
  });

  // Hojas de bisagra (sep-2026): chapa de la PANTALLA que asienta sobre el
  // tramo rebajado del soporte del chasis, bajo su propio nudillo, con los 2
  // agujeros roscados de sus tornillos. Antes los 4 tornillos terminaban en
  // el soporte y ninguna pieza de la pantalla quedaba sujeta. Estan definidas
  // en el marco del CHASIS (relativo al eje) dentro de un subgrupo que deshace
  // la apertura instalada: montada, la hoja queda horizontal; al retirar la
  // pantalla viaja con ella. Sale hacia arriba sin tocar nada: por encima
  // solo tiene el nudillo de la tapa.
  const leafFrame = new THREE.Group();
  leafFrame.name = "hinge-leaf-frame";
  leafFrame.rotation.x = -(opts.openAngle !== undefined ? opts.openAngle : LAPTOP_LID_OPEN_ANGLE);
  g.add(leafFrame);
  const leafW = HINGE_LEAF_X1 - HINGE_LEAF_X0, leafD = HINGE_LEAF_Z1 - HINGE_LEAF_Z0;
  const leafCx = (HINGE_LEAF_X0 + HINGE_LEAF_X1) / 2, leafCz = (HINGE_LEAF_Z0 + HINGE_LEAF_Z1) / 2;
  const leafY = HINGE_LEAF_TOP_Y - HINGE_LEAF_T / 2 - hgL.y;
  [-1, 1].forEach((s) => {
    const holes = LAPTOP_SCREEN_SCREW_X.map((sx) => circlePoints(s * (sx - leafCx), HINGE_SCREW_Z - leafCz, 0.0012, 12));
    const leaf = buildNotchedPcb(
      [[-leafW / 2, -leafD / 2], [leafW / 2, -leafD / 2], [leafW / 2, leafD / 2], [-leafW / 2, leafD / 2]],
      holes, HINGE_LEAF_T, "metalSteel", { color: 0x8a9099, roughness: 0.42, metalness: 0.65 }
    );
    leaf.name = "hinge-leaf";
    put(leafFrame, leaf, s * leafCx, leafY, leafCz - hgL.z);
  });

  setShadow(g);
  g.userData.anchors = {
    // Salida del cable eDP: por dentro del brazo de bisagra derecho.
    edpExit: new THREE.Vector3(w * 0.30, -t / 2, 0.004),
  };
  return { group: g };
}

/* ══════════════════════════════════════════════════════════════════════════
   10. PUERTOS EXTERNOS
   ══════════════════════════════════════════════════════════════════════════ */

// Cada puerto declara su lado, su posicion a lo largo del borde y su tamaño.
// El layout los usa para DOS cosas: dibujar el conector en la pared del
// chasis y llevar un cable interno hasta la placa. No hay puertos decorativos
// sueltos: todos nacen de esta tabla.

// Aspecto de los conectores de puerto (iteracion visual, sep-18): antes eran
// cajas de metal claro identicas que, vistas desde abajo, se leian como
// bloques blancos. Cada tipo real se distingue por su carcasa: acero (USB,
// HDMI), plastico negro con blindaje (RJ45) o plastico negro con barril
// (jack de audio, entrada de alimentacion).
const PORT_LOOK = {
  shell: { color: 0x6c727a, roughness: 0.52, metalness: 0.55 },
  springTab: { color: 0x585e66, roughness: 0.52, metalness: 0.55 },
  plastic: { color: 0x141518, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.5 },
  insulator: { color: 0x0b0c0e, roughness: 0.7, metalness: 0 },
};

/** Conector de un puerto, visto desde el interior. Boca hacia -Z local; el
 *  volumen es siempre spec.w x spec.h x 12 mm (+ patas de soldadura), el mismo
 *  que antes: el soporte de servicio y los cables se midieron contra el. */
export function buildLaptopPort(spec) {
  const g = new THREE.Group();
  g.name = "laptop-port-" + spec.id;
  const depth = 0.012;
  const P = PORT_LOOK;
  const plasticBody = spec.kind === "rj45" || spec.kind === "audio" || spec.kind === "power";
  if (spec.kind === "usbc") {
    // Carcasa ovalada: tramo recto + dos medios cilindros en los extremos.
    const r = spec.h / 2;
    g.add(box(spec.w - spec.h, spec.h, depth, "metalBrushed", P.shell));
    [-1, 1].forEach((sx) => {
      const c = new THREE.Mesh(cyl(r, r, depth, 12), materialFor("metalBrushed", P.shell));
      c.rotation.x = Math.PI / 2;
      put(g, c, sx * (spec.w / 2 - r), 0, 0);
    });
  } else {
    g.add(box(spec.w, spec.h, depth, plasticBody ? "plasticBlack" : "metalBrushed", plasticBody ? P.plastic : P.shell));
  }
  // Boca del conector (hacia afuera = -Z local).
  const mouth = box(spec.w * 0.78, spec.h * 0.62, 0.0015, "plasticBlack", { color: 0x08090b });
  put(g, mouth, 0, 0, -depth / 2 + 0.0006);
  if (spec.kind === "usb") {
    // Lengueta azul del USB 3.x: la pista visual que lo identifica.
    put(g, box(spec.w * 0.66, spec.h * 0.2, 0.0022, "plasticDark", { color: 0x1b4fa8 }), 0, -spec.h * 0.12, -depth / 2 + 0.0016);
    // Lenguetas de resorte estampadas en la carcasa (arriba y abajo).
    [-1, 1].forEach((sy) => [-1, 1].forEach((sx) => {
      put(g, box(0.0022, 0.00006, 0.0028, "metalBrushed", P.springTab), sx * spec.w * 0.24, sy * (spec.h / 2 + 0.00003), -depth / 2 + 0.0035);
    }));
  }
  if (spec.kind === "hdmi") {
    // Chaflanes inferiores de la carcasa trapezoidal.
    [-1, 1].forEach((sx) => {
      const ch = box(0.0024, 0.0016, depth - 0.0004, "metalBrushed", P.springTab);
      ch.rotation.z = sx * 0.5;
      put(g, ch, sx * (spec.w / 2 - 0.0009), -spec.h / 2 + 0.0007, 0);
    });
  }
  if (spec.kind === "audio") {
    const hole = new THREE.Mesh(cyl(spec.w * 0.28, spec.w * 0.28, 0.0016, 10), materialFor("plasticBlack", { color: 0x050607 }));
    hole.rotation.x = Math.PI / 2;
    put(g, hole, 0, 0, -depth / 2 + 0.0008);
  }
  if (spec.kind === "audio" || spec.kind === "power") {
    // Barril en la boca y contactos de soldadura atras.
    const br = Math.min(spec.w, spec.h) * 0.45;
    const barrel = new THREE.Mesh(cyl(br, br, 0.004, 16), materialFor(spec.kind === "power" ? "metalBrushed" : "plasticBlack", spec.kind === "power" ? P.shell : P.plastic));
    barrel.rotation.x = Math.PI / 2;
    put(g, barrel, 0, 0, -depth / 2 + 0.002);
    for (let i = 0; i < 3; i++) put(g, box(0.0008, 0.0004, 0.0018, "metalBrushed", P.shell), (i - 1) * spec.w * 0.3, -spec.h / 2 - 0.0002, depth / 2 - 0.0012);
  }
  if (spec.kind === "rj45") {
    for (let i = 0; i < 8; i++) {
      put(g, box(0.0006, 0.0018, 0.0008, "goldPin"), -spec.w * 0.28 + i * 0.0008, spec.h * 0.18, -depth / 2 + 0.003);
    }
    // Blindaje metalico superior y los dos LED de la boca (enlace/actividad).
    put(g, box(spec.w * 0.96, 0.0003, depth * 0.8, "metalBrushed", P.shell), 0, spec.h / 2 + 0.00015, 0.0008);
    [[-1, 0x2fd06a], [1, 0xd9a31f]].forEach(([sx, col]) => {
      put(g, box(0.0022, 0.0014, 0.0004, "plasticDark", { color: col, emissive: col, emissiveIntensity: 0.25 }), sx * spec.w * 0.36, spec.h * 0.36, -depth / 2 - 0.0001);
    });
  }
  // Tapa trasera aislante (lo que se ve desde dentro del equipo).
  if (!plasticBody) put(g, box(spec.w * 0.8, spec.h * 0.7, 0.0003, "plasticBlack", P.insulator), 0, 0, depth / 2 + 0.00015);
  // Patas de soldadura hacia la placa.
  [-1, 1].forEach((s) => {
    put(g, box(0.0012, 0.0022, 0.0012, "metalSteel", P.shell), s * spec.w * 0.42, -spec.h / 2 - 0.0009, depth * 0.3);
  });
  setShadow(g);
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   TECLADO Y TOUCHPAD
   ══════════════════════════════════════════════════════════════════════════ */

/** Teclado: bandeja metalica, teclas en rejilla con perfil real (mas hundidas
 *  y separadas), fila de funcion mas baja y cola FPC hacia la placa. */
export function buildLaptopKeyboard(opts = {}) {
  const w = (opts.width || LAPTOP.width) * 0.90;
  const d = (opts.depth || LAPTOP.depth) * 0.46;
  const g = new THREE.Group();
  g.name = "laptop-keyboard-assembly";

  // Bandeja (plato) del teclado.
  put(g, box(w, 0.0022, d, "metalDark", KEYBOARD_LOOK.plate), 0, 0, 0);

  const cols = 14, rows = 5;
  const padX = 0.004, padZ = 0.003;
  const cellW = (w - padX * 2) / cols;
  const cellD = (d - padZ * 2) / rows;
  const keyW = cellW - 0.0016, keyD = cellD - 0.0016;

  const keys = [], bevels = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Fila superior (funcion): teclas mas bajas, como en un teclado real.
      const isFn = r === 0;
      const kh = 0.0024;
      const kd = isFn ? keyD * 0.66 : keyD;
      const x = -w / 2 + padX + cellW * (c + 0.5);
      const z = -d / 2 + padZ + cellD * (r + 0.5);
      keys.push({ x, y: 0.0011 + kh / 2, z, w: keyW, h: kh, d: kd });
      // Bisel superior claro: da relieve sin costar geometria extra.
      bevels.push({ x, y: 0.0011 + kh + 0.0001, z, w: keyW * 0.82, h: 0.0002, d: kd * 0.78 });
    }
  }
  g.add(instancedBoxes(keys, "plasticBlack", KEYBOARD_LOOK.keys));
  g.add(instancedBoxes(bevels, "plasticDark", KEYBOARD_LOOK.bevel));

  // Leyendas: UN plano con el atlas completo, alineado celda a celda con la
  // rejilla de teclas. 1 malla y 1 draw call para las ~70 leyendas (una
  // textura por tecla habrian sido 70 materiales). Va aditivo y sin escribir
  // en el z-buffer para que no pelee con la cara superior de las teclas.
  const legendW = cellW * cols, legendD = cellD * rows;
  const legend = new THREE.Mesh(
    new THREE.PlaneGeometry(legendW, legendD),
    new THREE.MeshBasicMaterial({
      map: keyboardLegendTexture(cols, rows),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
    })
  );
  legend.rotation.x = -Math.PI / 2;
  legend.position.set(0, 0.0011 + 0.0024 + 0.0004, -d / 2 + padZ + legendD / 2);
  legend.renderOrder = 2;
  legend.castShadow = false;
  legend.receiveShadow = false;
  g.add(legend);
  // Barra espaciadora: sustituye 5 teclas de la ultima fila.
  const spaceW = cellW * 5 - 0.0016;
  put(g, box(spaceW, 0.0024, keyD, "plasticBlack", KEYBOARD_LOOK.keys), 0, 0.0023, -d / 2 + padZ + cellD * (rows - 0.5));

  // Cola FPC del teclado: pegada bajo la bandeja y saliendo por el hueco que
  // queda DELANTE del borde de la placa (la placa esta justo debajo de la
  // mitad trasera del teclado, fase 3). Antes salia por detras del teclado,
  // por encima de la placa, donde no cabe ningun conector.
  const fpc = box(0.024, 0.0004, 0.010, "connectorIvory", { color: 0xc8a25a });
  put(g, fpc, -0.018, -0.0013, 0.001);

  // Bosses roscados (sep-2026): bajan 1.5 mm bajo la bandeja, dentro de su
  // huella (el teclado sale hacia arriba). Su tornillo aprieta una pletina del
  // chasis desde abajo (buildLaptopBase) y rosca aqui; antes el vastago
  // atravesaba la bandeja y terminaba 1.8 mm dentro de una tecla.
  addThreadedBosses(g, LAPTOP_KEYBOARD_SCREW_X, -0.0011, LAPTOP_KEYBOARD_SCREW_DZ, KEYBOARD_LOOK.plate.color);

  setShadow(g);
  g.userData.anchors = { fpcTail: new THREE.Vector3(-0.018, -0.0015, 0.005) };
  return g;
}

/** Touchpad: superficie de cristal, marco hundido, linea de separacion de
 *  los dos botones y su cola FPC. */
export function buildLaptopTouchpad(opts = {}) {
  const w = opts.width || 0.105;
  const d = opts.depth || 0.062;
  const g = new THREE.Group();
  g.name = "laptop-touchpad-assembly";

  // Marco: cabe EXACTO en el hueco del reposamanos (fase 2: era 3 mm mas
  // grande y se metia 1.2 mm en el borde del reposamanos). La superficie de
  // cristal es un poco menor y queda enmarcada.
  put(g, box(w - 0.0002, 0.0012, d - 0.0002, "plasticDark", { color: 0x53585f }), 0, -0.0006, 0);
  // Superficie.
  put(g, box(w - 0.0016, 0.0012, d - 0.0016, "glassDark", { color: 0x2b3038 }), 0, 0.0004, 0);
  // Separacion de los dos botones (tercio inferior).
  put(g, box(0.0008, 0.0014, d * 0.3, "plasticDark", { color: 0x40454c }), 0, 0.0005, d * 0.33);
  put(g, box(w, 0.0014, 0.0008, "plasticDark", { color: 0x40454c }), 0, 0.0005, d * 0.18);
  // Cola FPC hacia la placa: por DEBAJO del marco y DENTRO de su huella. Antes
  // sobresalia 10 mm por detras del marco, metida bajo el borde del
  // reposamanos: al levantar el touchpad (sale por arriba) se enganchaba y lo
  // atravesaba 0.4 mm (barrido del recorrido de extraccion). Dentro de la
  // huella pasa por el mismo hueco que el marco; el cable flex continua desde
  // su punta por debajo del reposamanos.
  put(g, box(0.010, 0.0004, 0.008, "connectorIvory", { color: 0xc8a25a }), 0, -0.0021, -d / 2 + 0.0042);

  // Bosses roscados (sep-2026): bajan 1.5 mm bajo el marco, DENTRO de su
  // huella (el touchpad sale hacia arriba: una oreja bajo el reposamanos lo
  // engancharia). Su tornillo aprieta el travesano del chasis desde abajo
  // (buildLaptopBase) y rosca aqui; antes atravesaba el cristal y asomaba
  // 1.6 mm por encima.
  addThreadedBosses(g, LAPTOP_TOUCHPAD_SCREW_X, -0.0012, 0, 0x53585f);

  setShadow(g);
  g.userData.anchors = { fpcTail: new THREE.Vector3(0, -0.0023, -d / 2 + 0.0005) };
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   SOPORTE DE SERVICIO (decorativo)
   ══════════════════════════════════════════════════════════════════════════ */

/** Holgura de las repisas respecto de la tapa inferior removible (m). */
export const STAND_COVER_CLEARANCE = 0.0003;

/**
 * Soporte de servicio que explica por que el portatil esta elevado sobre la
 * mesa (LAPTOP_SERVICE_RISER_HEIGHT en el rig). Estructura ABIERTA: la cara
 * inferior queda libre para verla, seleccionar y extraer.
 *
 * Donde toca el chasis (y solo ahi), en las 4 esquinas:
 *   - Repisa de goma bajo la franja inferior de las paredes que la tapa
 *     inferior NO cubre (laterales x 163-165 mm, tapa hasta 162.5; delantera y
 *     trasera z 113.6-115, tapa hasta 113.3): la tapa sale y entra sin rozarlo.
 *   - Banda de goma contra la cara exterior de las paredes, solo en la esquina:
 *     los puertos laterales empiezan a 92.5 mm del centro y los topes llegan a
 *     94 mm; la salida de aire trasera queda libre.
 * Estructura: dos largueros DELANTE y DETRAS del equipo a la altura de sus
 * paredes (y 0..8 mm, donde no hay puertos), unidos a la izquierda por un
 * travesano, y dos columnas lejos del lado izquierdo (x -260 mm) sobre una base
 * apoyada en la mesa. Por que asi (medido con raycast y clics reales):
 *   - Un bastidor bajo el chasis (y -20..-10) tapaba desde las vistas bajas
 *     hasta 11 de 12 puntos visibles del touchpad o 24 de 25 del SSD. A la
 *     altura de las paredes no puede tapar la cara inferior: un rayo que llega
 *     a ella desde abajo ya paso por debajo de ese nivel.
 *   - Una columna en la esquina delantera izquierda tapaba desde la vista
 *     inferior (la "Interna" mira desde delante-izquierda y abajo) el 77 % del
 *     cable del ventilador y parte de placa, disipador, RAM y antena. A 95 mm
 *     del chasis ningun rayo hacia la cara inferior la cruza.
 *   - Nada del soporte baja del chasis a la derecha: por ahi viajan las piezas
 *     hacia la bandeja (plano de traslado a -60 mm).
 *
 * Coordenadas locales del portatil (mismo origen que buildLaptopBase).
 * `tableLocalY`: altura de la mesa en ese sistema (negativa: equipo elevado).
 */
export function buildLaptopServiceStand({ tableLocalY }) {
  const g = new THREE.Group();
  g.name = "laptop-service-stand";
  const W2 = LAPTOP.width / 2;                  // 0.165: cara exterior paredes laterales
  const D2 = LAPTOP.depth / 2;                  // 0.115: cara exterior pared delantera/trasera
  const coverW2 = (LAPTOP.width * 0.985) / 2;   // borde de la tapa inferior
  const coverD2 = (LAPTOP.depth * 0.985) / 2;
  // Acero con pintura en polvo negra: discreto y distinto de la carcasa grafito
  // (no debe leerse como una pieza del equipo). Goma negra en los contactos.
  const metal = { color: 0x1c1d20, roughness: 0.7, metalness: 0.25, envMapIntensity: 0.35 };
  const rubber = { color: 0x0d0e10, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 };
  const cornerLen = 0.018;                      // largo de repisas y bandas desde la esquina
  const pad = 0.0005;                           // espesor de la banda de goma
  const plateT = 0.003;                         // espesor de las escuadras
  const ledgeT = 0.003;                         // espesor de las repisas (bajo y = 0)
  const railY0 = 0, railY1 = 0.008, railT = 0.010;
  const railZ0 = D2 + pad + plateT;             // cara interior de los largueros
  const railZc = railZ0 + railT / 2;
  const xL = -W2 - 0.095;                       // columnas y travesano (lado izquierdo)
  const xRightEnd = W2 + pad + plateT;          // los largueros llegan hasta la escuadra derecha

  const add = (name, w, h, d, x, y, z, look) => {
    const m = box(w, h, d, "metalDark", look);
    m.name = name;
    return put(g, m, x, y, z);
  };

  // Largueros delantero y trasero a la altura de las paredes, y travesano.
  const railX0 = xL - railT / 2;
  [-1, 1].forEach((sz) => add("stand-rail", xRightEnd - railX0, railY1 - railY0, railT, (railX0 + xRightEnd) / 2, (railY0 + railY1) / 2, sz * railZc, metal));
  add("stand-crossbar", railT, railY1 - railY0, 2 * (railZ0 + railT), xL, (railY0 + railY1) / 2, 0, metal);
  // Columnas bajo el travesano, sobre la base.
  const plateH = 0.006;
  add("stand-base-plate", 0.080, plateH, 0.180, xL, tableLocalY + plateH / 2, 0, metal);
  const colH = railY0 - (tableLocalY + plateH);
  [-1, 1].forEach((sz) => add("stand-column", railT, colH, 0.014, xL, tableLocalY + plateH + colH / 2, sz * 0.045, metal));

  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => {
    // Repisas de goma bajo la franja libre de las paredes (fuera de la tapa).
    const ledgeSideW = W2 - (coverW2 + STAND_COVER_CLEARANCE);
    add("stand-ledge-side", ledgeSideW, ledgeT, cornerLen, sx * (W2 - ledgeSideW / 2), -ledgeT / 2, sz * (D2 - cornerLen / 2), rubber);
    const ledgeFbD = D2 - (coverD2 + STAND_COVER_CLEARANCE);
    add("stand-ledge-front-back", cornerLen, ledgeT, ledgeFbD, sx * (W2 - cornerLen / 2), -ledgeT / 2, sz * (D2 - ledgeFbD / 2), rubber);
    // Bandas de goma contra la cara exterior de las paredes.
    add("stand-pad-side", pad, railY1, cornerLen, sx * (W2 + pad / 2), railY1 / 2, sz * (D2 - cornerLen / 2), rubber);
    add("stand-pad-front-back", cornerLen, railY1, pad, sx * (W2 - cornerLen / 2), railY1 / 2, sz * (D2 + pad / 2), rubber);
    // Escuadra: placas que sostienen repisas y bandas y se unen al larguero.
    // Bajo y = 0 la placa llega hasta la pared (ahi no hay pared ni tapa).
    add("stand-bracket-side", plateT + pad, ledgeT, cornerLen, sx * (W2 + (plateT + pad) / 2), -ledgeT / 2, sz * (D2 - cornerLen / 2), metal);
    add("stand-bracket-side", plateT, railY1, cornerLen + pad + plateT, sx * (W2 + pad + plateT / 2), railY1 / 2, sz * (D2 - cornerLen + (cornerLen + pad + plateT) / 2), metal);
    add("stand-bracket-front-back", cornerLen + pad + plateT, ledgeT, plateT + pad, sx * (W2 - cornerLen + (cornerLen + pad + plateT) / 2), -ledgeT / 2, sz * (D2 + (plateT + pad) / 2), metal);
    add("stand-bracket-front-back", cornerLen + pad + plateT, railY1, plateT, sx * (W2 - cornerLen + (cornerLen + pad + plateT) / 2), railY1 / 2, sz * (D2 + pad + plateT / 2), metal);
  }));

  setShadow(g);
  return g;
}

/* ══════════════════════════════════════════════════════════════════════════
   INSERCION / EXTRACCION ANGULAR DEL SO-DIMM
   ══════════════════════════════════════════════════════════════════════════ */

/** Angulo de reposo de un SO-DIMM al liberar los clips (los sockets reales
 *  empujan el modulo a ~30 grados). */
export const SODIMM_RELEASE_ANGLE = 30 * Math.PI / 180;

/**
 * Pose del SO-DIMM a lo largo de su recorrido real de montaje.
 *
 * Un SO-DIMM NO sale hacia arriba en linea recta: al soltar los clips el
 * socket lo empuja hasta unos 25-35 grados, y solo entonces se desliza fuera
 * SIGUIENDO ESE ANGULO. Al instalar es el camino inverso: entra inclinado,
 * los contactos penetran en el socket y despues el modulo gira hacia abajo
 * hasta quedar horizontal y retenido por los clips.
 *
 * Lo esencial para que se lea como una instalacion real, y no como una caja
 * que gira en el aire, es el PIVOTE: esta en el borde de contactos (dentro del
 * socket), no en el centro de la pieza. Por eso la posicion se recalcula
 * rotando el origen del objeto alrededor de ese punto.
 *
 *   t = 0    -> instalado: horizontal, contactos dentro del socket
 *   t = 0.6  -> liberado:  inclinado SODIMM_RELEASE_ANGLE, contactos aun dentro
 *   t = 1    -> extraido:  mismo angulo, desplazado fuera del socket
 *
 * Funcion PURA (sin estado, sin DOM): la usa el rig para animar y se puede
 * probar en Node. Devuelve objetos THREE nuevos, nunca muta los argumentos.
 */
export function computeSoDimmPose(t, opts = {}) {
  const moduleDepth = opts.moduleDepth != null ? opts.moduleDepth : 0.030;
  const thickness = opts.thickness != null ? opts.thickness : 0.0012;
  // Pivote: borde de contactos, en la cara del modulo que mira a la placa. En
  // espacio local del objeto esta en (0, -thickness/2, +moduleDepth/2).
  // Giro alrededor del eje X LOCAL del modulo: separa el extremo libre (-Z
  // local) de la placa. Se compone en espacio local (homeQuat * giro) para que
  // funcione igual con el modulo boca arriba que COLGANDO de la cara inferior
  // de la placa (fase 3): en ese caso el extremo libre baja, alejandose de la
  // placa, en vez de subir y atravesarla. Con homeQuat = identidad el
  // resultado es identico al de la fase 2.
  return computeEdgePivotPose(t, {
    homePosition: opts.homePosition,
    homeQuaternion: opts.homeQuaternion,
    pivotLocal: new THREE.Vector3(0, -thickness / 2, moduleDepth / 2),
    axisLocal: new THREE.Vector3(1, 0, 0),
    slideLocal: new THREE.Vector3(0, 0, -1),
    angle: opts.angle != null ? opts.angle : SODIMM_RELEASE_ANGLE,
    travel: opts.travel != null ? opts.travel : 0.030,
  });
}

/** Angulo al que sube una tarjeta M.2 (SSD o Wi-Fi) al quitar su tornillo: el
 *  conector la empuja a ~20 grados. */
export const M2_RELEASE_ANGLE = 20 * Math.PI / 180;

/**
 * Pose de una tarjeta M.2 (SSD 2280 o Wi-Fi 2230) a lo largo de su recorrido
 * real. Igual que el SO-DIMM, NO sale recta hacia arriba: los contactos estan
 * en un EXTREMO (el corto, -X local) metidos en un conector horizontal, asi
 * que tirarla en perpendicular a la placa es imposible. Al quitar el tornillo
 * del extremo opuesto la tarjeta sube a ~20 grados pivotando sobre los
 * contactos y solo entonces se desliza fuera del conector siguiendo su propio
 * eje. Al instalar: entra inclinada y despues baja hasta el standoff.
 *
 *   t = 0    -> instalada: plana, contactos dentro del conector
 *   t = 0.6  -> liberada:  inclinada M2_RELEASE_ANGLE, contactos aun dentro
 *   t = 1    -> extraida:  mismo angulo, desplazada fuera del conector
 *
 * Funcion PURA: la usa el rig para animar y se prueba en Node.
 */
export function computeM2Pose(t, opts = {}) {
  const length = opts.length != null ? opts.length : 0.080;
  const thickness = opts.thickness != null ? opts.thickness : 0.0011;
  // Pivote: borde de contactos (-X local) en la cara que mira a la placa. El
  // extremo libre (+X) se aleja de la placa girando sobre el eje Z LOCAL (el
  // ancho de la tarjeta) y la salida es por su eje +X, lejos del conector.
  return computeEdgePivotPose(t, {
    homePosition: opts.homePosition,
    homeQuaternion: opts.homeQuaternion,
    pivotLocal: new THREE.Vector3(-length / 2, -thickness / 2, 0),
    axisLocal: new THREE.Vector3(0, 0, 1),
    slideLocal: new THREE.Vector3(1, 0, 0),
    angle: opts.angle != null ? opts.angle : M2_RELEASE_ANGLE,
    travel: opts.travel != null ? opts.travel : 0.030,
  });
}

/**
 * Recorrido comun de un modulo que se monta pivotando sobre su borde de
 * contactos (SO-DIMM, M.2): fase 1 (t 0 -> 0.6) giro sobre el pivote, fase 2
 * (0.6 -> 1) salida recta siguiendo el angulo ya alcanzado. Pivote, eje de
 * giro y direccion de salida se dan en espacio LOCAL del objeto; la rotacion
 * se compone como homeQuat * giro para que valga con el modulo boca arriba o
 * colgando boca abajo de la placa.
 */
function computeEdgePivotPose(t, opts) {
  const home = opts.homePosition || new THREE.Vector3();
  const homeQuat = opts.homeQuaternion || new THREE.Quaternion();
  const k = Math.min(1, Math.max(0, t));
  const liftT = Math.min(1, k / 0.6);
  const slideT = k <= 0.6 ? 0 : (k - 0.6) / 0.4;
  const angle = opts.angle * liftT;

  const pivot = opts.pivotLocal.clone().applyQuaternion(homeQuat).add(home);
  const localRot = new THREE.Quaternion().setFromAxisAngle(opts.axisLocal, angle);
  const quaternion = homeQuat.clone().multiply(localRot);
  const position = pivot.clone().sub(opts.pivotLocal.clone().applyQuaternion(quaternion));

  // Salida: a lo largo del eje del modulo ya inclinado (hacia fuera del socket).
  if (slideT > 0) {
    const dir = opts.slideLocal.clone().applyQuaternion(quaternion);
    position.addScaledVector(dir, opts.travel * slideT);
  }
  return { position, quaternion, angle };
}
