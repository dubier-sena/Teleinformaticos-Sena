/* js/hardware_lab_3d_rig.js
 *
 * Motor generico que arma un equipo (escritorio O portatil) dentro de la
 * escena a partir de un "layout": igual espiritu que hardware_lab_engine.js
 * (que es agnostico del equipo), pero para geometria 3D en vez de reglas.
 * No conoce ids reales de piezas: los toma del layout que le pasan
 * hardware_lab_3d_layout_desktop.js / _laptop.js.
 *
 * Estructura de un layout (ver esos archivos para la instancia real):
 *   {
 *     structure: [                    // se construye EN ORDEN (permite que
 *       { id, build, mount },         // una pieza posterior use los anchors
 *       ...                            // de una anterior, p.ej. la placa
 *     ],                              // usa el anchor del gabinete).
 *     components: {
 *       [partId]: {
 *         kind,                       // que factory usar (ver KIND_BUILDERS)
 *         mount: (anchors) => Vector3,// posicion instalada, espacio del rig
 *         rotationEuler: [x,y,z],
 *         buildOpts: {...},
 *         tier: 0..n,                 // capa de vista explotada
 *         detachAxis: [x,y,z],        // direccion local para el paso 1 del
 *                                      // desmontaje (levantar/salir), antes
 *                                      // de viajar a la bandeja.
 *       }
 *     },
 *     screwFor: { [partId]: ["screwPartId", ...] },  // decorativo/informativo
 *     screws: [                       // TORNILLOS INTERACTIVOS (opcional)
 *       { id, partId, label,          // ver hardware_lab_3d_screws.js
 *         position: (anchors) => Vector3,   // plano de asiento de la cabeza
 *         outDir: [x, y, z],          // hacia donde SALE el tornillo
 *         size: {...} },
 *     ],
 *     screwDish: (anchors) => Vector3,  // bandeja magnetica de tornillos
 *   }
 *
 * `session.parts[partId] === false` retira la pieza (se mueve a la bandeja);
 * `true` la instala (misma logica que hardware_lab_engine.js).
 */
import * as THREE from "./vendor/three.module.min.js";
import { animateObject3D, animateValue, Easing } from "./hardware_lab_3d_tween.js";
import { TABLE, ZONES } from "./hardware_lab_3d_constants.js";
import * as PartsFactory from "./hardware_lab_3d_parts_factory.js";
import * as LaptopFactory from "./hardware_lab_3d_laptop_factory.js";
import { computeM2Pose, computeSoDimmPose } from "./hardware_lab_3d_laptop_factory.js";
import { buildServiceScrew, buildScrewDish } from "./hardware_lab_3d_screws.js";

// Recorridos de montaje propios (portatil): pieza que pivota sobre su borde de
// contactos en vez de salir recta. Ver hardware_lab_3d_laptop_factory.js.
const INSERTION_POSES = { sodimm: computeSoDimmPose, m2: computeM2Pose };

const KIND_BUILDERS = {
  cpu: (opts) => PartsFactory.buildCpu(opts),
  "cpu-socket": (opts) => PartsFactory.buildCpuSocket(opts),
  "cooler-tower": (opts) => PartsFactory.buildTowerCooler(opts),
  "laptop-cooler": (opts) => LaptopFactory.buildLaptopCooler(opts),
  "ram-stick": (opts) => PartsFactory.buildRamStick(opts),
  "ram-module": (opts) => PartsFactory.buildRamModule(opts.count, opts),
  "ram-slot": (opts) => PartsFactory.buildRamSlot(opts),
  gpu: (opts) => PartsFactory.buildGpu(opts),
  psu: (opts) => PartsFactory.buildPsu(opts),
  "ssd-2-5": (opts) => PartsFactory.buildSsd25(opts),
  "hdd-3-5": (opts) => PartsFactory.buildHdd35(opts),
  "m2-ssd": (opts) => PartsFactory.buildM2(opts),
  screw: (opts) => PartsFactory.buildScrew(opts),
  fan: (opts) => PartsFactory.buildFan(opts.diameter, opts),
  port: (opts) => PartsFactory.buildPort(opts.portKind, opts),
  generic: (opts) => PartsFactory.buildGenericPart(opts),
  "laptop-keyboard": (opts) => LaptopFactory.buildLaptopKeyboard(opts),
  "laptop-touchpad": (opts) => LaptopFactory.buildLaptopTouchpad(opts),
  // Piezas propias del portatil reconstruido (sep-2026). Antes reusaban las
  // del equipo de escritorio ("ram-module", "m2-ssd") o cajas "generic", lo
  // que daba modulos con proporciones de DIMM de torre dentro de un portatil.
  "laptop-cpu": (opts) => LaptopFactory.buildLaptopCpu(opts),
  "laptop-sodimm": (opts) => LaptopFactory.buildSoDimm(opts),
  "laptop-m2-ssd": (opts) => LaptopFactory.buildM2Ssd(opts),
  "laptop-wifi-card": (opts) => LaptopFactory.buildWifiCard(opts),
  "laptop-battery": (opts) => LaptopFactory.buildLaptopBattery(opts),
};

function mapAnchors(rawAnchors, origin) {
  if (!rawAnchors) return null;
  const out = {};
  Object.keys(rawAnchors).forEach((key) => {
    const v = rawAnchors[key];
    if (Array.isArray(v)) {
      out[key] = v.map((item) => item.clone().add(origin));
    } else if (v && v.isVector3) {
      out[key] = v.clone().add(origin);
    } else {
      out[key] = v;
    }
  });
  return out;
}

/** Nombre visible de una pieza (ficha de datos, ver hardware_lab_data_desktop.js/_laptop.js),
 * usado para el tooltip de hover (item 8: "nombre claramente visible"). Sin
 * esto el tooltip mostraba el id interno crudo ("gpu", "side-panel"). */
function partDisplayName(equipmentId, partId) {
  // Sin navegador (tests de geometria en Node) no hay catalogo de datos: el
  // id crudo es una etiqueta valida y evita romper la construccion del rig.
  if (typeof window === "undefined") return partId;
  const HardwareLab = window.HardwareLab;
  const data =
    equipmentId === "laptop"
      ? HardwareLab && HardwareLab.DataLaptop && HardwareLab.DataLaptop.LAPTOP_EQUIPMENT
      : HardwareLab && HardwareLab.DataDesktop && HardwareLab.DataDesktop.DESKTOP_EQUIPMENT;
  const part = data && data.parts && data.parts[partId];
  return part ? part.name : partId;
}

// Espacio libre bajo el portatil (item 7/8: la tapa inferior debe poder
// verse y clickearse desde abajo). En la mesa real, el portatil apoya
// directo sobre el tablero -- sin hueco, ninguna camara "desde abajo" cabe
// sin atravesar la mesa (se confirmo asi, literalmente viendo la pata de la
// mesa, antes de este ajuste). Representa que el equipo se apoya sobre un
// tapete/soporte de servicio elevado -- practica real de taller, no solo un
// truco de camara.
const LAPTOP_SERVICE_RISER_HEIGHT = 0.16;

export function createRig({ scene, interactions, tweenGroup, layout, equipmentId }) {
  const root = new THREE.Group();
  root.name = "hwlab-rig-" + equipmentId;
  root.position.copy(ZONES.equipmentCenter);
  if (equipmentId === "laptop") root.position.y += LAPTOP_SERVICE_RISER_HEIGHT;
  scene.add(root);

  const trayGroup = new THREE.Group();
  trayGroup.name = "hwlab-tray";
  scene.add(trayGroup);

  // Estructura DECORATIVA declarada por el layout (`decor`, hoy solo el
  // soporte de servicio del portatil). No es una pieza: no se registra en
  // interactions (ni como pieza ni como oclusor, asi que nunca intercepta un
  // clic), no va a la bandeja, no entra en la vista explotada ni en el
  // encuadre de camara (vive fuera de `root`, que es lo que mide
  // getBoundsWorld). Sin `decor` (escritorio) no se crea nada.
  let decorGroup = null;
  if (Array.isArray(layout.decor) && layout.decor.length) {
    decorGroup = new THREE.Group();
    decorGroup.name = "hwlab-decor-" + equipmentId;
    decorGroup.position.copy(root.position);
    const tableLocalY = TABLE.topY - root.position.y;
    layout.decor.forEach((item) => {
      const obj = item.build({ tableLocalY });
      if (!obj) return;
      obj.userData.decorId = item.id || "decor";
      decorGroup.add(obj);
    });
    scene.add(decorGroup);
  }

  const anchors = {};
  const structuralGroups = {};
  const partEntries = new Map(); // partId -> { object3d, config, installedPosition, installedQuaternion, present, trayPosition }

  // ── 1) Estructura (gabinete, placa base...) EN ORDEN ─────────────────────
  // Los indices de bandeja de piezas estructurales arrancan DESPUES del
  // ultimo indice de componente (ver bucle 2) para no colisionar con ellos.
  const structuralTrayBase = Object.keys(layout.components || {}).length;
  let structuralTrayOffset = 0;
  (layout.structure || []).forEach((entry) => {
    const built = entry.build();
    const origin = entry.mount ? entry.mount(anchors) : new THREE.Vector3();
    built.group.position.copy(origin);
    // BUG real (mejora 3D, encontrado con clic real): a diferencia del bucle
    // de COMPONENTES un poco mas abajo, esta rama nunca aplicaba
    // entry.rotationEuler. La unica estructura que lo declara ("screen-lid"
    // del portatil, ver hardware_lab_3d_layout_laptop.js) se montaba
    // siempre PLANA -- el portatil nunca mostro su pantalla realmente
    // abierta desde el rediseno 3D original, en NINGUN modo (aprender,
    // practicas, diagnostico). Debe ir ANTES de capturar homeQuaternion mas
    // abajo, para que "instalado" recuerde la pose abierta, no la identidad.
    if (entry.rotationEuler) {
      built.group.rotation.set(entry.rotationEuler[0], entry.rotationEuler[1], entry.rotationEuler[2]);
    }
    root.add(built.group);
    structuralGroups[entry.id] = built.group;
    // Portatil (fase 3): el cuerpo base (reposamanos, paredes, bisagras) no es
    // una pieza seleccionable, pero SI tapa lo que hay detras. Se registra
    // como oclusor para que el clic no lo atraviese. Solo el portatil: el
    // escritorio conserva su comportamiento de siempre.
    if (!entry.partId && equipmentId === "laptop" && interactions && interactions.registerOccluder) {
      interactions.registerOccluder(built.group);
    }
    if (built.anchors) anchors[entry.id] = mapAnchors(built.anchors, origin);
    else anchors[entry.id] = {};
    if (entry.partId) {
      registerTogglablePart(entry.partId, built.group, {
        kind: "structural",
        homePosition: origin.clone(),
        homeQuaternion: built.group.quaternion.clone(),
        // BUG critico (encontrado con clic real, no solo lectura de codigo):
        // esta rama nunca fijaba detachAxis, a diferencia de la de
        // componentes de mas abajo. setPresence() SIEMPRE lo usa
        // (homePosition.addScaledVector(entry.detachAxis, ...)) al retirar
        // una pieza -- sin este default, retirar CUALQUIER pieza estructural
        // (tapa lateral, tapa inferior del portatil, tarjeta madre) por clic
        // interactivo lanzaba "Cannot read properties of undefined (reading
        // 'x')" y abortaba la funcion completa: sin animacion, sin guardado,
        // sin avance de paso. Bloqueaba el primer paso de TODA practica de
        // ensamble/desensamble (guiada, libre, evaluacion).
        detachAxis: entry.detachAxis ? new THREE.Vector3().fromArray(entry.detachAxis) : new THREE.Vector3(0, 1, 0),
        tier: entry.tier != null ? entry.tier : 3,
        // BUG real (confirmado con retiro directo + verificacion de posicion
        // final, no visible a simple vista en una sola practica): esta rama
        // nunca fijaba trayIndex, asi que setPresence() caia siempre al
        // valor por defecto (0) -- CUALQUIER pieza estructural retirada
        // (tapa lateral en escritorio, tapa inferior en portatil) terminaba
        // superpuesta EXACTAMENTE sobre el primer componente de la bandeja
        // (aqui: "Modulo RAM"), ambas piezas ocupando el mismo punto 3D.
        trayIndex: structuralTrayBase + structuralTrayOffset++,
        trayRotationEuler: entry.trayRotationEuler || null,
      });
    }
  });

  // ── 2) Componentes normales ───────────────────────────────────────────────
  Object.keys(layout.components || {}).forEach((partId, i) => {
    const cfg = layout.components[partId];
    let object3d;
    let position;
    if (cfg.kind === "cable") {
      // Un cable NO tiene una unica posicion de montaje: su geometria (tubo)
      // ya codifica sus dos extremos en espacio local del rig, asi que el
      // grupo mismo queda en el origen (0,0,0) local.
      // `waypoints` (fase 2 del portatil) describe el RECORRIDO del cable, no
      // solo sus extremos: se resuelve aqui porque, igual que from/to, necesita
      // los anchors ya calculados.
      const cableOpts = Object.assign({}, cfg.buildOpts || {});
      if (typeof cfg.waypoints === "function") cableOpts.waypoints = cfg.waypoints(anchors);
      else if (Array.isArray(cfg.waypoints)) cableOpts.waypoints = cfg.waypoints;
      object3d = PartsFactory.buildCable(cfg.cableKind || "generic", cfg.from(anchors), cfg.to(anchors), cableOpts);
      position = new THREE.Vector3(0, 0, 0);
    } else {
      const builder = KIND_BUILDERS[cfg.kind] || KIND_BUILDERS.generic;
      object3d = builder(cfg.buildOpts || {});
      position = cfg.mount(anchors);
      object3d.position.copy(position);
    }
    if (cfg.rotationEuler) object3d.rotation.set(cfg.rotationEuler[0], cfg.rotationEuler[1], cfg.rotationEuler[2]);
    root.add(object3d);
    registerTogglablePart(partId, object3d, {
      kind: cfg.kind,
      homePosition: position.clone(),
      homeQuaternion: object3d.quaternion.clone(),
      detachAxis: cfg.detachAxis ? new THREE.Vector3().fromArray(cfg.detachAxis) : new THREE.Vector3(0, 1, 0),
      tier: cfg.tier != null ? cfg.tier : 1,
      trayIndex: i,
      trayRotationEuler: cfg.trayRotationEuler || null,
      insertionMotion: cfg.insertionMotion || null,
      insertionOpts: cfg.insertionOpts || null,
    });
  });

  // ── 3) Tornillos interactivos (opcional, ver hardware_lab_3d_screws.js) ──
  // Viven en su propio grupo, HERMANO de `root` y con su misma posicion (igual
  // que `decor`), no dentro de el. Dos razones medidas, no de estilo:
  //   1. getBoundsWorld() encuadra la camara con setFromObject(root): la
  //      bandeja magnetica de tornillos (que va sobre la MESA, 160 mm mas
  //      abajo y a un lado) habria estirado el encuadre de TODAS las vistas.
  //   2. La auditoria de colisiones (tests/laptop_3d_service_access.test.cjs)
  //      recorre rig.root: un tornillo tiene que atravesar la tapa y la torre
  //      que enrosca -- es su funcion -- y habria salido como "colision".
  //      Los tornillos se validan aparte (tests/laptop_3d_screws.test.cjs).
  // No son piezas: no van a la bandeja de piezas, no entran en la vista
  // explotada ni en partEntries. Se registran en interactions con kind
  // "screw" y SIN `partId`, para que los manejadores de clic de pieza ya
  // existentes los ignoren solos.
  let screwGroup = null;
  let dishGroup = null;
  let screwDishOrigin = null;
  const screwEntries = [];
  if (Array.isArray(layout.screws) && layout.screws.length) {
    screwGroup = new THREE.Group();
    screwGroup.name = "hwlab-screws";
    screwGroup.position.copy(root.position);
    scene.add(screwGroup);

    if (typeof layout.screwDish === "function") {
      screwDishOrigin = layout.screwDish(anchors, { tableLocalY: TABLE.topY - root.position.y });
      const dish = buildScrewDish();
      dish.position.copy(screwDishOrigin);
      // La bandeja magnetica se queda en la MESA (posiciones tecnicas,
      // sep-26): va en un grupo propio, fijo, no en el de los tornillos, que
      // ahora sigue al portatil cuando se gira o se voltea.
      dishGroup = new THREE.Group();
      dishGroup.name = "hwlab-screw-dish";
      dishGroup.position.copy(root.position);
      dishGroup.add(dish);
      scene.add(dishGroup);
    }

    layout.screws.forEach((decl) => {
      const object3d = buildServiceScrew(decl.size || {});
      object3d.userData.headR = (decl.size && decl.size.headR) || undefined;
      const position = decl.position(anchors);
      const outDir = new THREE.Vector3().fromArray(decl.outDir || [0, 1, 0]).normalize();
      object3d.position.copy(position);
      object3d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), outDir);
      object3d.userData.screwId = decl.id;
      object3d.userData.screwPartId = decl.partId;
      screwGroup.add(object3d);
      screwEntries.push({
        id: decl.id,
        partId: decl.partId,
        bearsOn: decl.bearsOn || "part",
        label: decl.label || decl.id,
        partName: partDisplayName(equipmentId, decl.partId),
        object3d,
        homePosition: position.clone(),
        outDir,
      });
      if (interactions) {
        interactions.registerInteractive(object3d, {
          kind: "screw",
          screwId: decl.id,
          screwPartId: decl.partId,
          label: decl.label || decl.id,
        });
      }
    });
  }

  function registerTogglablePart(partId, object3d, meta) {
    object3d.userData.partId = partId;
    partEntries.set(partId, Object.assign({ object3d, present: true }, meta));
    if (interactions) {
      interactions.registerInteractive(object3d, { partId, kind: "part", label: partDisplayName(equipmentId, partId) });
    }
  }

  function trayPositionFor(index) {
    const col = index % ZONES.trayCols;
    const row = Math.floor(index / ZONES.trayCols);
    return new THREE.Vector3(
      ZONES.trayOrigin.x - root.position.x + col * ZONES.trayStepX,
      0.02,
      ZONES.trayOrigin.z - root.position.z + row * ZONES.trayStepZ
    );
  }

  // Bandeja con posiciones declaradas por el layout (`traySlots`, solo el
  // portatil, sep-2026). La rejilla generica de arriba no servia al portatil
  // (medido con la geometria real): no descontaba el elevador de servicio, asi
  // que las piezas retiradas flotaban ~175 mm sobre la mesa, y sus 20 piezas en
  // 3 columnas llegaban hasta z = 1.59 m, fuera del borde de la mesa (0.75 m),
  // justo las piezas que el aprendiz debe tomar de la bandeja para ENSAMBLAR.
  // Cada slot es el centro {x, z} de la pieza sobre la mesa (coordenadas de
  // escena); la altura se calcula con la caja real de la pieza para que quede
  // apoyada, y `trayRotationEuler` la deja en su postura natural (los modulos
  // montados boca abajo vuelven boca arriba). Sin `traySlots` (escritorio) todo
  // sigue exactamente igual.
  const traySlots = layout.traySlots || null;
  const TRAY_REST_GAP = 0.0015;

  function computeSlotPose(entry, slot) {
    const obj = entry.object3d;
    const savedPosition = obj.position.clone();
    const savedQuaternion = obj.quaternion.clone();
    const quaternion = entry.trayRotationEuler
      ? new THREE.Quaternion().setFromEuler(new THREE.Euler(entry.trayRotationEuler[0], entry.trayRotationEuler[1], entry.trayRotationEuler[2]))
      : entry.homeQuaternion.clone();
    const savedScale = obj.scale.clone();
    obj.position.set(0, 0, 0);
    obj.quaternion.copy(quaternion);
    obj.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
    // Solo la geometria de la pieza: los contornos de hover/seleccion
    // (interactions) son hijos del objeto y agrandarian la caja.
    const box = new THREE.Box3();
    obj.traverse((n) => {
      if (n.isMesh && !(n.name && n.name.startsWith("hwlab-outline"))) box.expandByObject(n, false);
    });
    obj.position.copy(savedPosition);
    obj.quaternion.copy(savedQuaternion);
    obj.scale.copy(savedScale);
    root.updateMatrixWorld(true);
    const center = box.getCenter(new THREE.Vector3()).sub(root.position);
    const minY = box.min.y - root.position.y;
    return {
      position: new THREE.Vector3(
        slot.x - root.position.x - center.x,
        TABLE.topY + TRAY_REST_GAP - root.position.y - minY,
        slot.z - root.position.z - center.z
      ),
      quaternion,
    };
  }

  // La bandeja esta en la MESA, no en el portatil (posiciones tecnicas,
  // sep-26): la pose de cada ranura se guarda en coordenadas de MUNDO y se
  // traduce al espacio de `root` segun como este el equipo AHORA (girado,
  // volteado). Con el equipo en su pose inicial, la traduccion devuelve
  // exactamente la pose local de siempre.
  function localPoseFromWorld(world) {
    const qInv = root.quaternion.clone().invert();
    return {
      position: world.position.clone().sub(root.position).applyQuaternion(qInv),
      quaternion: qInv.multiply(world.quaternion),
    };
  }

  function traySlotPose(partId, entry) {
    const slot = traySlots && traySlots[partId];
    if (!slot) return null;
    if (!entry.trayWorldPose) {
      const local = computeSlotPose(entry, slot);
      entry.trayWorldPose = {
        position: local.position.clone().applyQuaternion(root.quaternion).add(root.position),
        quaternion: root.quaternion.clone().multiply(local.quaternion),
      };
    }
    return localPoseFromWorld(entry.trayWorldPose);
  }
  // Se calculan al construir el equipo, con cada pieza en su sitio, a escala 1
  // y sin contornos: el primer retiro real ocurre justo tras el clic, con la
  // pieza agrandada por el hover.
  if (traySlots) partEntries.forEach((entry, partId) => traySlotPose(partId, entry));

  // Recorrido de las piezas con slot (portatil). Medido con los tweens reales
  // contra el chasis: una recta directa del punto de extraccion a la mesa
  // atravesaba el chasis con el teclado o el touchpad, y un traslado a la
  // altura de extraccion rozaba la pared con la RAM inclinada o la placa al
  // girar. Por eso la pieza baja (o sube) primero a un plano de traslado con
  // holgura (`layout.trayTransit`, alturas locales del equipo), cruza en
  // horizontal girando a su postura de bandeja y solo entonces baja a la mesa.
  // Al instalar hace el camino inverso y asienta SIN "overshoot": easeOutBack
  // metia la pieza entre 1.2 y 4 mm dentro de lo que la rodea antes de volver.
  const trayTransit = layout.trayTransit || null;

  function runChain(obj, steps, onDone) {
    const next = (i) => {
      if (i >= steps.length) {
        if (onDone) onDone();
        return;
      }
      animateObject3D(tweenGroup, obj, Object.assign({}, steps[i], { onComplete: () => next(i + 1) }));
    };
    next(0);
  }

  // ── POSE DEL EQUIPO (posiciones tecnicas, sep-26) ──────────────────────────
  // Un solo `root` para todo el portatil: girarlo, cerrarlo o voltearlo es
  // cambiar la transformacion de ESE grupo (y el angulo de su tapa), nunca
  // duplicar geometria. Solo si el layout declara `pose` (el escritorio no).
  //   yaw     giro sobre la vertical, junto con su soporte (tornamesa)
  //   flipped volteado 180 grados sobre su eje de profundidad, boca abajo y
  //           apoyado sobre las repisas del soporte (tapa cerrada)
  //   lid     angulo de la tapa sobre el eje de bisagra (rotation.x)
  const poseCfg = layout.pose || null;
  const standOrigin = root.position.clone();
  const lidCfg = poseCfg && poseCfg.lid ? poseCfg.lid : null;
  const lidGroup = lidCfg ? structuralGroups[lidCfg.structureId] : null;
  const lidEntry = lidCfg ? partEntries.get(lidCfg.partId) : null;
  const leafFrame = lidGroup && lidCfg.leafFrame ? lidGroup.getObjectByName(lidCfg.leafFrame) : null;
  const pose = { yaw: 0, flipped: false, lid: lidCfg ? lidCfg.openAngle : 0 };
  let poseAnimating = false;
  const poseListeners = [];
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);

  function yawQuat(yaw) {
    return new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw);
  }

  /** Caja del equipo INSTALADO en el espacio local de `root` (no la AABB de
   *  mundo, que con el equipo girado se infla). Solo geometria de piezas. */
  function localInstalledBounds() {
    root.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    const m = new THREE.Matrix4();
    const absent = new Set();
    partEntries.forEach((entry) => { if (!entry.present) absent.add(entry.object3d); });
    root.children.forEach((child) => {
      if (absent.has(child)) return;
      child.traverse((n) => {
        if (!n.isMesh || (n.name && n.name.startsWith("hwlab-outline"))) return;
        // InstancedMesh (teclas, aletas): su geometria es la caja UNITARIA;
        // la caja real es la de todas sus instancias.
        let local;
        if (n.isInstancedMesh) {
          if (!n.boundingBox) n.computeBoundingBox();
          local = n.boundingBox;
        } else {
          if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
          local = n.geometry.boundingBox;
        }
        m.multiplyMatrices(inv, n.matrixWorld);
        tmp.copy(local).applyMatrix4(m);
        box.union(tmp);
      });
    });
    return box;
  }

  // Holgura de apoyo: la del equipo derecho sobre las repisas (la tapa
  // inferior queda a esa altura sobre ellas). Volteado, se apoya igual.
  // Volteado, el dorso de la tapa cerrada apoya en las repisas con la misma
  // holgura que la tapa inferior en la pose normal (0.3 mm, sin z-fighting).
  const FLIPPED_REST_GAP = 0.0003;

  /** Transformacion de `root` para una pose. `height` = alto local del equipo
   *  cerrado (solo se usa volteado: su cara superior pasa a ser la de abajo). */
  function rootTransformFor(p, height) {
    const q = yawQuat(p.yaw);
    if (!p.flipped) return { position: standOrigin.clone(), quaternion: q };
    return {
      position: standOrigin.clone().add(new THREE.Vector3(0, height + FLIPPED_REST_GAP, 0).applyQuaternion(q)),
      quaternion: q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.PI)),
    };
  }

  function applyLid(angle) {
    pose.lid = angle;
    if (!lidGroup) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    if (lidEntry) lidEntry.homeQuaternion = q.clone();
    // Solo se mueve si esta montada (en la bandeja conserva su postura).
    if (!lidEntry || lidEntry.present) {
      lidGroup.quaternion.copy(q);
      // La hoja de bisagra es de la BASE mientras la pantalla este montada:
      // se queda horizontal aunque la tapa gire.
      if (leafFrame) leafFrame.rotation.x = -angle;
    }
  }

  /** Recoloca lo que NO viaja con el portatil al cambiar su pose: la bandeja
   *  de piezas (mesa), los tornillos (siguen al equipo) y el soporte (solo
   *  gira con el yaw). Lo llama cada cuadro de una transicion. */
  function syncFollowers() {
    if (screwGroup) {
      screwGroup.position.copy(root.position);
      screwGroup.quaternion.copy(root.quaternion);
    }
    if (decorGroup) {
      decorGroup.position.copy(standOrigin);
      decorGroup.quaternion.copy(yawQuat(pose.yaw));
    }
    partEntries.forEach((entry, partId) => {
      if (entry.present || entry.moving) return;
      const slotPose = traySlotPose(partId, entry);
      if (!slotPose) return;
      entry.object3d.position.copy(slotPose.position);
      entry.object3d.quaternion.copy(slotPose.quaternion);
    });
    root.updateMatrixWorld(true);
    poseListeners.forEach((fn) => fn(getPose()));
  }

  function getPose() {
    return { yaw: pose.yaw, flipped: pose.flipped, lid: pose.lid };
  }

  /** Lado por el que se opera una pieza, deducido de su geometria. */
  function partAccess(partId) {
    const entry = partEntries.get(partId);
    if (!entry) return null;
    if (entry.kind === "cable") return "interior";
    return entry.detachAxis.y < -0.5 ? "interior" : "top";
  }
  function screwAccess(screwId) {
    const s = screwEntries.find((e) => e.id === screwId);
    if (!s) return null;
    return s.outDir.y < -0.5 ? "interior" : "top";
  }

  /** ¿La pose ACTUAL permite fisicamente operar por ese lado? (no exige el
   *  preset exacto: si el aprendiz dejo el equipo en una pose equivalente,
   *  sirve). Volteado se opera el interior; derecho, por arriba y con la tapa
   *  abierta lo bastante para no cubrir el teclado. */
  function poseAllows(access) {
    if (!poseCfg || !access) return true;
    if (access === "interior") return pose.flipped;
    if (pose.flipped) return false;
    if (lidEntry && lidEntry.present && poseCfg.minTopWorkLid != null) return pose.lid <= poseCfg.minTopWorkLid + 1e-6;
    return true;
  }

  function workPresetFor(partId, access) {
    if (!poseCfg || !poseCfg.workPresetFor) return null;
    return poseCfg.workPresetFor(partId, access || partAccess(partId));
  }

  function presetPose(name) {
    const p = poseCfg && poseCfg.presets && poseCfg.presets[name];
    return p ? { yaw: p.yaw, flipped: p.flipped, lid: p.lid } : null;
  }

  function isAtPreset(name) {
    const p = presetPose(name);
    if (!p) return false;
    const lidOk = !lidEntry || !lidEntry.present || Math.abs(pose.lid - p.lid) < 1e-4;
    return Math.abs(pose.yaw - p.yaw) < 1e-4 && pose.flipped === p.flipped && lidOk;
  }

  /** Caja de MUNDO que debe encuadrar una posicion de trabajo. */
  function workFocusBox(name) {
    const view = poseCfg && poseCfg.workViews && poseCfg.workViews[name];
    const box = new THREE.Box3();
    if (!view) return box;
    root.updateMatrixWorld(true);
    if (screwGroup) screwGroup.updateMatrixWorld(true);
    const f = view.focus || {};
    const addPart = (id) => {
      const e = partEntries.get(id);
      if (e && e.present) box.expandByObject(e.object3d);
      if (f.withScrews) screwEntries.filter((sc) => sc.partId === id && sc.object3d.visible).forEach((sc) => {
        // Tornillos puestos o presentados (no los de la bandeja magnetica).
        if (sc.object3d.parent === screwGroup && sc.object3d.position.distanceTo(sc.homePosition) < 0.02) box.expandByObject(sc.object3d);
      });
    };
    (f.parts || []).forEach(addPart);
    if (f.interior) {
      partEntries.forEach((e, id) => {
        if (id === "bottom-cover" || !e.present || partAccess(id) !== "interior") return;
        addPart(id);
      });
    }
    if (f.localBox) {
      const [a, b] = f.localBox;
      for (let i = 0; i < 8; i++) {
        box.expandByPoint(root.localToWorld(new THREE.Vector3(i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2])));
      }
    }
    if (box.isEmpty()) box.copy(new THREE.Box3().setFromObject(root));
    return box;
  }

  function workViewDir(name) {
    const view = poseCfg && poseCfg.workViews && poseCfg.workViews[name];
    if (!view) return null;
    return new THREE.Vector3().fromArray(view.dirLocal).normalize().applyQuaternion(root.quaternion);
  }

  /** Direccion LOCAL del equipo expresada en mundo (p.ej. detachAxis). */
  function worldDirection(localDir) {
    return new THREE.Vector3().fromArray(localDir.toArray ? localDir.toArray() : localDir).applyQuaternion(root.quaternion);
  }

  function runStages(stages, onDone) {
    const next = (i) => {
      if (i >= stages.length) {
        poseAnimating = false;
        syncFollowers();
        if (onDone) onDone();
        return;
      }
      const s = stages[i];
      if (!tweenGroup || s.duration === 0) {
        s.apply(1);
        syncFollowers();
        next(i + 1);
        return;
      }
      animateValue(tweenGroup, 0, 1, {
        target: root,
        duration: s.duration,
        easing: s.easing || Easing.easeInOutCubic,
        onUpdate: (t) => { s.apply(t); syncFollowers(); },
        onComplete: () => next(i + 1),
      });
    };
    poseAnimating = true;
    next(0);
  }

  /**
   * Lleva el equipo a la pose `target` ({yaw, flipped, lid}) con una
   * transicion que muestra el cambio fisico: cerrar la tapa, levantar,
   * voltear, apoyar y abrir. Devuelve false si no se puede ahora.
   */
  function setPose(target, opts = {}) {
    if (!poseCfg || poseAnimating) return false;
    const to = {
      yaw: target.yaw != null ? target.yaw : pose.yaw,
      flipped: target.flipped != null ? !!target.flipped : pose.flipped,
      lid: target.lid != null ? target.lid : pose.lid,
    };
    // Volteado, la tapa solo puede estar cerrada (abierta chocaria con el
    // soporte y la mesa).
    if (to.flipped) to.lid = lidCfg ? lidCfg.closedAngle : to.lid;
    const animate = opts.animate !== false && !!tweenGroup;
    const dur = (s) => (animate ? s : 0);
    // Alto del equipo cerrado, medido UNA vez (la cara que queda abajo al
    // voltearlo). Las piezas no cambian durante la transicion.
    const H = closedHeight();
    const stages = [];
    const lidFrom = pose.lid;
    const closed = lidCfg ? lidCfg.closedAngle : 0;
    const needFlip = to.flipped !== pose.flipped;
    // 1) Cerrar la tapa si hay que voltear.
    if (needFlip && lidEntry && lidEntry.present && Math.abs(lidFrom - closed) > 1e-6) {
      stages.push({ duration: dur(0.55), apply: (t) => applyLid(lidFrom + (closed - lidFrom) * t) });
    }
    // 2) Giro sobre la vertical (con su soporte).
    if (Math.abs(to.yaw - pose.yaw) > 1e-6) {
      const y0 = pose.yaw;
      stages.push({
        duration: dur(0.6),
        apply: (t) => {
          pose.yaw = y0 + (to.yaw - y0) * t;
          const tr = rootTransformFor({ yaw: pose.yaw, flipped: pose.flipped }, H);
          root.position.copy(tr.position);
          root.quaternion.copy(tr.quaternion);
        },
      });
    }
    // 3) Voltear: levantar, girar 180 grados sobre el eje de profundidad por el
    //    centro del equipo cerrado y apoyarlo del otro lado.
    if (needFlip) {
      const fromFlip = pose.flipped;
      let R = null, liftTo = 0;
      const prepare = () => {
        if (R != null) return;
        const b = localInstalledBounds();
        // Radio de barrido en el plano del giro (x-y) alrededor del centro del
        // equipo cerrado (con la tapa ya cerrada por la etapa 1).
        R = Math.hypot(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), H / 2);
        // El punto mas bajo del barrido libra los largueros del soporte (8 mm)
        // con 20 mm de margen.
        liftTo = standOrigin.y + R + 0.028;
      };
      const centerAt = (flipped) => {
        const tr = rootTransformFor({ yaw: pose.yaw, flipped }, H);
        return tr.position.clone().add(new THREE.Vector3(0, H / 2, 0).applyQuaternion(tr.quaternion));
      };
      const place = (center, phi) => {
        const q = yawQuat(pose.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, phi));
        root.quaternion.copy(q);
        root.position.copy(center).sub(new THREE.Vector3(0, H / 2, 0).applyQuaternion(q));
      };
      const phi0 = fromFlip ? Math.PI : 0;
      const phi1 = fromFlip ? 0 : Math.PI;
      stages.push({
        duration: dur(0.45),
        apply: (t) => {
          prepare();
          const c0 = centerAt(fromFlip);
          const c = c0.clone();
          c.y = c0.y + (liftTo - c0.y) * t;
          place(c, phi0);
        },
      });
      stages.push({
        duration: dur(0.8),
        apply: (t) => {
          prepare();
          const c = centerAt(fromFlip);
          c.y = liftTo;
          place(c, phi0 + (phi1 - phi0) * t);
        },
      });
      stages.push({
        duration: dur(0.45),
        apply: (t) => {
          prepare();
          const c1 = centerAt(!fromFlip);
          const c = c1.clone();
          c.y = liftTo + (c1.y - liftTo) * t;
          place(c, phi1);
          if (t >= 1) pose.flipped = !fromFlip;
        },
      });
    }
    // 4) Abrir/ajustar la tapa al angulo de destino.
    if (lidCfg) {
      const lidTo = to.lid;
      stages.push({
        duration: dur(Math.abs(lidTo - (needFlip ? closed : lidFrom)) > 1e-6 ? 0.55 : 0),
        apply: (t) => {
          const start = needFlip ? closed : lidFrom;
          applyLid(start + (lidTo - start) * t);
        },
      });
    }
    runStages(stages, () => {
      // Pose final exacta (sin error acumulado por la interpolacion).
      pose.flipped = to.flipped;
      pose.yaw = to.yaw;
      applyLid(to.lid);
      const tr = rootTransformFor(pose, H);
      root.position.copy(tr.position);
      root.quaternion.copy(tr.quaternion);
      if (opts.onDone) opts.onDone(getPose());
    });
    return true;
  }

  /** Alto local del equipo con la tapa cerrada (la cara que queda abajo al
   *  voltearlo). Se mide con la tapa cerrada aunque este abierta ahora. */
  function closedHeight() {
    if (!lidGroup || !lidEntry || !lidEntry.present) return localInstalledBounds().max.y;
    const saved = lidGroup.quaternion.clone();
    const savedLeaf = leafFrame ? leafFrame.rotation.x : 0;
    lidGroup.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), lidCfg.closedAngle);
    if (leafFrame) leafFrame.rotation.x = -lidCfg.closedAngle;
    const h = localInstalledBounds().max.y;
    lidGroup.quaternion.copy(saved);
    if (leafFrame) leafFrame.rotation.x = savedLeaf;
    root.updateMatrixWorld(true);
    return h;
  }

  function moveWithSlot(entry, slotPose, present, animate, opts) {
    const obj = entry.object3d;
    const isLid = !!(lidEntry && entry === lidEntry && leafFrame);
    if (!animate) {
      obj.position.copy(present ? entry.homePosition : slotPose.position);
      obj.quaternion.copy(present ? entry.homeQuaternion : slotPose.quaternion);
      if (isLid) leafFrame.rotation.x = present ? -pose.lid : -lidCfg.openAngle;
      return;
    }
    // Mientras viaja no la recoloca la compensacion de bandeja.
    entry.moving = true;
    const userSettled = opts.onSettled;
    opts = Object.assign({}, opts, {
      onSettled: () => {
        entry.moving = false;
        if (userSettled) userSettled();
      },
    });
    // La hoja de bisagra: horizontal (de la base) montada; en la bandeja
    // vuelve a la postura con la que se calculo su ranura.
    if (isLid) {
      const from = leafFrame.rotation.x;
      const to = present ? -pose.lid : -lidCfg.openAngle;
      if (Math.abs(to - from) > 1e-9) {
        animateValue(tweenGroup, from, to, { target: leafFrame, duration: 0.8, onUpdate: (v) => { leafFrame.rotation.x = v; } });
      }
    }
    const release = releasePoseFor(entry);
    const liftPos = release ? release.position
      : entry.homePosition.clone().addScaledVector(entry.detachAxis, 0.045);
    const liftQuat = release ? release.quaternion : entry.homeQuaternion;
    const below = liftPos.y < entry.homePosition.y;
    let transitY = liftPos.y;
    if (trayTransit) transitY = below ? Math.min(liftPos.y, trayTransit.below) : Math.max(liftPos.y, trayTransit.above);
    const overEquipment = new THREE.Vector3(liftPos.x, transitY, liftPos.z);
    const overTray = new THREE.Vector3(slotPose.position.x, transitY, slotPose.position.z);
    if (!present) {
      runChain(obj, [
        { position: liftPos, quaternion: liftQuat, duration: release ? 0.5 : 0.32, easing: Easing.easeOutQuad },
        { position: overEquipment, duration: 0.2, easing: Easing.easeInOutQuad },
        { position: overTray, quaternion: slotPose.quaternion, duration: 0.5, easing: Easing.easeInOutCubic },
        { position: slotPose.position, duration: 0.3, easing: Easing.easeInOutCubic },
      ], opts.onSettled);
    } else {
      runChain(obj, [
        { position: overTray, duration: 0.3, easing: Easing.easeInOutCubic },
        { position: overEquipment, quaternion: liftQuat, duration: 0.5, easing: Easing.easeInOutCubic },
        { position: liftPos, duration: 0.2, easing: Easing.easeInOutQuad },
        { position: entry.homePosition, quaternion: entry.homeQuaternion, duration: 0.3, easing: Easing.easeOutCubic },
      ], opts.onSettled);
    }
  }

  /**
   * Mueve una pieza a instalada/retirada. Animacion de 2 fases al retirar
   * (item 4): primero se separa un poco a lo largo de detachAxis (simula
   * abrir seguro / aflojar), luego viaja a la bandeja. Al instalar, el mismo
   * camino en reversa.
   */
  /** Pose de "liberada" de una pieza con recorrido de montaje propio, o null
   *  si usa el desmontaje recto de siempre. */
  function releasePoseFor(entry) {
    const poseFn = entry && INSERTION_POSES[entry.insertionMotion];
    if (!poseFn) return null;
    return poseFn(1, Object.assign({
      homePosition: entry.homePosition,
      homeQuaternion: entry.homeQuaternion,
    }, entry.insertionOpts || {}));
  }

  function setPresence(partId, present, opts = {}) {
    const entry = partEntries.get(partId);
    if (!entry || entry.present === present) return;
    entry.present = present;
    const animate = opts.animate !== false;
    const obj = entry.object3d;

    const slotPose = traySlotPose(partId, entry);
    if (slotPose) {
      moveWithSlot(entry, slotPose, present, animate, opts);
      return;
    }

    if (!present) {
      const trayIdx = opts.trayIndex != null ? opts.trayIndex : entry.trayIndex || 0;
      const trayPos = trayPositionFor(trayIdx);
      // Piezas con recorrido de montaje propio (SO-DIMM): la primera fase no
      // es un tiron recto por detachAxis, sino el giro sobre los contactos +
      // la salida siguiendo ese angulo. Ver computeSoDimmPose.
      const release = releasePoseFor(entry);
      const liftPos = release ? release.position
        : entry.homePosition.clone().addScaledVector(entry.detachAxis, 0.045);
      if (!animate) {
        obj.position.copy(trayPos);
        return;
      }
      animateObject3D(tweenGroup, obj, {
        position: liftPos,
        quaternion: release ? release.quaternion : undefined,
        duration: release ? 0.5 : 0.32,
        easing: Easing.easeOutQuad,
        onComplete: () => {
          const toTray = { position: trayPos, duration: 0.55, easing: Easing.easeInOutCubic, onComplete: opts.onSettled };
          if (entry.trayRotationEuler) toTray.euler = entry.trayRotationEuler;
          animateObject3D(tweenGroup, obj, toTray);
        },
      });
    } else {
      // Al instalar, el camino inverso: primero se aproxima INCLINADA hasta la
      // boca del socket y despues gira hasta quedar horizontal y asegurada.
      const releaseIn = releasePoseFor(entry);
      const liftPos = releaseIn ? releaseIn.position
        : entry.homePosition.clone().addScaledVector(entry.detachAxis, 0.045);
      if (!animate) {
        obj.position.copy(entry.homePosition);
        obj.quaternion.copy(entry.homeQuaternion);
        return;
      }
      animateObject3D(tweenGroup, obj, {
        position: liftPos,
        quaternion: releaseIn ? releaseIn.quaternion : undefined,
        duration: 0.45,
        easing: Easing.easeInOutCubic,
        onComplete: () => {
          animateObject3D(tweenGroup, obj, {
            position: entry.homePosition,
            quaternion: entry.homeQuaternion,
            duration: 0.3,
            easing: Easing.easeOutBack,
            onComplete: opts.onSettled,
          });
        },
      });
    }
  }

  /** Aplica session.parts completo sin animar (carga inicial / restaurar sesion). */
  function syncFromSessionParts(sessionParts) {
    let trayIdx = 0;
    Object.keys(sessionParts).forEach((partId) => {
      const entry = partEntries.get(partId);
      if (!entry) return;
      const present = sessionParts[partId] !== false;
      entry.present = present;
      entry.moving = false;
      if (lidEntry && entry === lidEntry && leafFrame) {
        leafFrame.rotation.x = present ? -pose.lid : -lidCfg.openAngle;
      }
      if (present) {
        entry.object3d.position.copy(entry.homePosition);
        entry.object3d.quaternion.copy(entry.homeQuaternion);
      } else {
        const slotPose = traySlotPose(partId, entry);
        if (slotPose) {
          entry.object3d.position.copy(slotPose.position);
          entry.object3d.quaternion.copy(slotPose.quaternion);
        } else {
          entry.object3d.position.copy(trayPositionFor(trayIdx));
        }
        trayIdx += 1;
      }
    });
  }

  function getObject3D(partId) {
    const entry = partEntries.get(partId);
    return entry ? entry.object3d : null;
  }

  /**
   * `installedOnly` (mejora 3D, item 8/9): excluye del calculo cualquier
   * pieza actualmente en la bandeja (present:false). Sin esto, encuadrar la
   * camara justo despues de mover piezas a la bandeja (p.ej. "Aprender
   * componentes", que abre el gabinete/tapa de entrada de una vez) infla la
   * esfera con la distancia hasta la bandeja y aleja la camara mucho mas de
   * lo necesario -- confirmado con clic real: el equipo se veia chico y las
   * piezas restantes quedaban dispersas/dificiles de leer en el primer
   * encuadre, mas notorio aun en el portatil (2 piezas van a bandeja de
   * entrada: tapa inferior y teclado).
   */
  function getBoundsWorld(opts = {}) {
    const box = new THREE.Box3();
    if (!opts.installedOnly) {
      box.setFromObject(root);
    } else {
      const excluded = new Set();
      partEntries.forEach((entry) => {
        if (!entry.present) excluded.add(entry.object3d);
      });
      root.children.forEach((child) => {
        if (!excluded.has(child)) box.expandByObject(child);
      });
    }
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return sphere;
  }

  /** Caja de mundo del equipo INSTALADO (solo lo que esta puesto). */
  function getBoundsBoxWorld() {
    const box = new THREE.Box3();
    const excluded = new Set();
    partEntries.forEach((entry) => { if (!entry.present) excluded.add(entry.object3d); });
    root.children.forEach((child) => { if (!excluded.has(child)) box.expandByObject(child); });
    return box;
  }

  function getExplodeEntries() {
    const entries = [];
    partEntries.forEach((entry) => {
      if (entry.present) {
        entries.push({ object3d: entry.object3d, tier: entry.tier, homePosition: entry.homePosition });
      }
    });
    return entries;
  }

  function dispose() {
    partEntries.forEach((entry) => {
      if (interactions) interactions.unregisterInteractive(entry.object3d);
    });
    screwEntries.forEach((entry) => {
      if (interactions) interactions.unregisterInteractive(entry.object3d);
    });
    if (interactions && interactions.unregisterOccluder) {
      Object.values(structuralGroups).forEach((g) => interactions.unregisterOccluder(g));
    }
    [root, trayGroup].concat(decorGroup ? [decorGroup] : []).concat(screwGroup ? [screwGroup] : []).concat(dishGroup ? [dishGroup] : []).forEach((g) => {
      scene.remove(g);
      g.traverse((n) => {
        if (n.geometry) n.geometry.dispose();
        if (n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
    });
    partEntries.clear();
  }

  return {
    root,
    anchors,
    // Posiciones tecnicas (solo si el layout declara `pose`).
    hasPose: !!poseCfg,
    getPose,
    setPose,
    isPoseAnimating: () => poseAnimating,
    onPoseChange: (fn) => { poseListeners.push(fn); return () => { const i = poseListeners.indexOf(fn); if (i >= 0) poseListeners.splice(i, 1); }; },
    worldDirection,
    localInstalledBounds,
    partAccess,
    screwAccess,
    isPresent: (partId) => { const e = partEntries.get(partId); return !!(e && e.present); },
    anyMoving: () => Array.from(partEntries.values()).some((e) => e.moving),
    poseAllows,
    workPresetFor,
    presetPose,
    isAtPreset,
    workFocusBox,
    workViewDir,
    get presets() {
      return poseCfg && poseCfg.presets ? poseCfg.presets : {};
    },
    get lidConfig() {
      return lidCfg;
    },
    get standOrigin() {
      return standOrigin.clone();
    },
    setPresence,
    syncFromSessionParts,
    getObject3D,
    getBoundsWorld,
    getBoundsBoxWorld,
    getExplodeEntries,
    get partIds() {
      return Array.from(partEntries.keys());
    },
    get screwEntries() {
      return screwEntries;
    },
    get screwGroup() {
      return screwGroup;
    },
    get tableWorldY() {
      return TABLE.topY;
    },
    get screwDishOrigin() {
      return screwDishOrigin ? screwDishOrigin.clone() : null;
    },
    // Origen de la bandeja magnetica en MUNDO (fija en la mesa, no depende de
    // la pose del portatil).
    get screwDishWorldOrigin() {
      return screwDishOrigin && dishGroup ? screwDishOrigin.clone().add(dishGroup.position) : null;
    },
    dispose,
  };
}
