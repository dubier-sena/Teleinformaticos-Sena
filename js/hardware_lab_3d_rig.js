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
 *   }
 *
 * `session.parts[partId] === false` retira la pieza (se mueve a la bandeja);
 * `true` la instala (misma logica que hardware_lab_engine.js).
 */
import * as THREE from "./vendor/three.module.min.js";
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js";
import { ZONES } from "./hardware_lab_3d_constants.js";
import * as PartsFactory from "./hardware_lab_3d_parts_factory.js";
import { buildLaptopKeyboard, buildLaptopTouchpad } from "./hardware_lab_3d_chassis_factory.js";

const KIND_BUILDERS = {
  cpu: (opts) => PartsFactory.buildCpu(opts),
  "cpu-socket": (opts) => PartsFactory.buildCpuSocket(opts),
  "cooler-tower": (opts) => PartsFactory.buildTowerCooler(opts),
  "laptop-cooler": (opts) => PartsFactory.buildLaptopCooler(opts),
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
  "laptop-keyboard": (opts) => buildLaptopKeyboard(opts),
  "laptop-touchpad": (opts) => buildLaptopTouchpad(opts),
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
      object3d = PartsFactory.buildCable(cfg.cableKind || "generic", cfg.from(anchors), cfg.to(anchors), cfg.buildOpts || {});
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
    });
  });

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

  /**
   * Mueve una pieza a instalada/retirada. Animacion de 2 fases al retirar
   * (item 4): primero se separa un poco a lo largo de detachAxis (simula
   * abrir seguro / aflojar), luego viaja a la bandeja. Al instalar, el mismo
   * camino en reversa.
   */
  function setPresence(partId, present, opts = {}) {
    const entry = partEntries.get(partId);
    if (!entry || entry.present === present) return;
    entry.present = present;
    const animate = opts.animate !== false;
    const obj = entry.object3d;

    if (!present) {
      const trayIdx = opts.trayIndex != null ? opts.trayIndex : entry.trayIndex || 0;
      const trayPos = trayPositionFor(trayIdx);
      const liftPos = entry.homePosition.clone().addScaledVector(entry.detachAxis, 0.045);
      if (!animate) {
        obj.position.copy(trayPos);
        return;
      }
      animateObject3D(tweenGroup, obj, {
        position: liftPos,
        duration: 0.32,
        easing: Easing.easeOutQuad,
        onComplete: () => {
          const toTray = { position: trayPos, duration: 0.55, easing: Easing.easeInOutCubic, onComplete: opts.onSettled };
          if (entry.trayRotationEuler) toTray.euler = entry.trayRotationEuler;
          animateObject3D(tweenGroup, obj, toTray);
        },
      });
    } else {
      const liftPos = entry.homePosition.clone().addScaledVector(entry.detachAxis, 0.045);
      if (!animate) {
        obj.position.copy(entry.homePosition);
        obj.quaternion.copy(entry.homeQuaternion);
        return;
      }
      animateObject3D(tweenGroup, obj, {
        position: liftPos,
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
        entry.object3d.position.copy(trayPositionFor(trayIdx));
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
    [root, trayGroup].forEach((g) => {
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
    dispose,
  };
}
