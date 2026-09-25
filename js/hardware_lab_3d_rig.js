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
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js";
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
      screwGroup.add(dish);
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

  function traySlotPose(partId, entry) {
    const slot = traySlots && traySlots[partId];
    if (!slot) return null;
    if (!entry.traySlotPose) entry.traySlotPose = computeSlotPose(entry, slot);
    return entry.traySlotPose;
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

  function moveWithSlot(entry, slotPose, present, animate, opts) {
    const obj = entry.object3d;
    if (!animate) {
      obj.position.copy(present ? entry.homePosition : slotPose.position);
      obj.quaternion.copy(present ? entry.homeQuaternion : slotPose.quaternion);
      return;
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
    [root, trayGroup].concat(decorGroup ? [decorGroup] : []).concat(screwGroup ? [screwGroup] : []).forEach((g) => {
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
    setPresence,
    syncFromSessionParts,
    getObject3D,
    getBoundsWorld,
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
    dispose,
  };
}
