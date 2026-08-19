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

const KIND_BUILDERS = {
  cpu: (opts) => PartsFactory.buildCpu(opts),
  "cpu-socket": (opts) => PartsFactory.buildCpuSocket(opts),
  "cooler-tower": (opts) => PartsFactory.buildTowerCooler(opts),
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

export function createRig({ scene, interactions, tweenGroup, layout, equipmentId }) {
  const root = new THREE.Group();
  root.name = "hwlab-rig-" + equipmentId;
  root.position.copy(ZONES.equipmentCenter);
  scene.add(root);

  const trayGroup = new THREE.Group();
  trayGroup.name = "hwlab-tray";
  scene.add(trayGroup);

  const anchors = {};
  const structuralGroups = {};
  const partEntries = new Map(); // partId -> { object3d, config, installedPosition, installedQuaternion, present, trayPosition }

  // ── 1) Estructura (gabinete, placa base...) EN ORDEN ─────────────────────
  (layout.structure || []).forEach((entry) => {
    const built = entry.build();
    const origin = entry.mount ? entry.mount(anchors) : new THREE.Vector3();
    built.group.position.copy(origin);
    root.add(built.group);
    structuralGroups[entry.id] = built.group;
    if (built.anchors) anchors[entry.id] = mapAnchors(built.anchors, origin);
    else anchors[entry.id] = {};
    if (entry.partId) {
      registerTogglablePart(entry.partId, built.group, {
        kind: "structural",
        homePosition: origin.clone(),
        homeQuaternion: built.group.quaternion.clone(),
        tier: entry.tier != null ? entry.tier : 3,
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
    if (interactions) interactions.registerInteractive(object3d, { partId, kind: "part" });
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

  function getBoundsWorld() {
    const box = new THREE.Box3().setFromObject(root);
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
