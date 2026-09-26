/* js/hardware_lab_3d_screws.js
 *
 * TORNILLOS INTERACTIVOS + DESTORNILLADO/ATORNILLADO AUTOMATICO.
 *
 * Antes, el destornillador era una herramienta que el aprendiz elegia en la
 * bandeja del HUD y los tornillos eran geometria decorativa dentro de cada
 * pieza: no se podian clickear, no tenian estado propio y nada impedia
 * retirar una tapa con sus cinco tornillos puestos.
 *
 * Aqui cada tornillo es una pieza 3D propia, con su estado
 * (INSTALADO / RETIRADO), asociada al componente que fija. El aprendiz hace
 * clic DIRECTAMENTE sobre el tornillo y el simulador representa solo el uso
 * de la herramienta:
 *
 *   CLIC EN TORNILLO -> DESTORNILLADOR APARECE -> SE POSICIONA -> ENCAJA ->
 *   GIRA -> EL TORNILLO SUBE -> TORNILLO RETIRADO -> DESTORNILLADOR SE RETIRA
 *
 * y el inverso al ensamblar. El objetivo educativo es que el aprendiz sepa
 * QUE tornillo va, CUANDO y QUE pieza libera -- no medir su punteria con el
 * mouse arrastrando una herramienta.
 *
 * El destornillador NO desaparece del laboratorio: sigue existiendo como
 * herramienta 3D (aqui en su version de PRECISION, que es la real para un
 * portatil) y la bandeja de herramientas del HUD sigue igual.
 *
 * Por que un destornillador de precision y no el grande de la bandeja: el
 * portatil se atiende sobre el soporte de servicio, con 156 mm libres entre
 * la mesa y la tapa inferior (medido). El destornillador de taller de
 * hardware_lab_3d_tools_factory.js mide 192 mm de la base del mango a la
 * punta: acercandolo por el eje del tornillo desde abajo, el mango
 * atravesaria el tablero de la mesa. El de precision (125 mm) entra con
 * holgura y ademas es el que se usa de verdad en un portatil.
 *
 * Este modulo no conoce el esquema de datos del laboratorio: recibe las
 * entradas de tornillo ya construidas por el rig (que es quien tiene los
 * anchors del equipo) y consulta hacia afuera, por callbacks, si una pieza
 * puede operarse en este momento.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor, ACCENT } from "./hardware_lab_3d_constants.js";
import { animateObject3D, animateValue, Easing, prefersReducedMotion } from "./hardware_lab_3d_tween.js";

const UP = new THREE.Vector3(0, 1, 0);

// Escala del proxy de clic: reducido mientras el tornillo no sea el que toca
// tocar (apenas la cabeza), completo cuando si lo es.
const SCREW_PROXY_IDLE = 0.45;
const SCREW_PROXY_ACTIVE = 1;

function setProxyScale(proxy, k) {
  proxy.scale.setScalar(k);
  proxy.position.y = ((proxy.userData.hitH || SCREW_SIZE.hitH) * k) / 2 - 0.0012;
}

// Medidas reales de un tornillo de servicio de portatil (M2.5 x 5).
export const SCREW_SIZE = {
  headR: 0.0021,
  headH: 0.0009,
  shankR: 0.00105,
  shankLen: 0.005,
  // Radio del proxy de clic invisible: un tornillo de 4 mm de cabeza es un
  // blanco imposible a la distancia de camara normal. El proxy no se ve
  // (opacity 0) pero si intercepta el rayo, igual que los que ya usa el
  // laboratorio para cables finos.
  hitR: 0.0044,
  hitH: 0.007,
};

// Largo total del destornillador de precision, de la base del mango a la
// punta. Ver comentario de cabecera: debe caber en el hueco de servicio.
export const DRIVER_LENGTH = 0.125;

/** Tornillo de servicio: cabeza con cruz Phillips y vastago roscado.
 * Eje local +Y = hacia AFUERA (la direccion en la que sale al destornillarlo);
 * el origen es el plano de asiento de la cabeza sobre la pieza. */
export function buildServiceScrew(opts = {}) {
  const s = Object.assign({}, SCREW_SIZE, opts);
  const g = new THREE.Group();
  g.name = "service-screw";

  // Cabeza troncoconica (cilindrica por fuera, ligeramente avellanada abajo).
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(s.headR, s.headR * 0.82, s.headH, 14),
    materialFor("screwHead")
  );
  head.position.y = s.headH / 2;
  g.add(head);

  // Cruz Phillips: dos ranuras oscuras hundidas en la cara de la cabeza.
  const recessMat = materialFor("plasticBlack");
  [0, Math.PI / 2].forEach((rot) => {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(s.headR * 1.35, 0.00022, s.headR * 0.42), recessMat);
    slot.position.y = s.headH - 0.00008;
    slot.rotation.y = rot;
    g.add(slot);
  });

  // Vastago roscado: cono muy suave (efecto rosca a esta escala) + punta.
  const shank = new THREE.Mesh(
    new THREE.CylinderGeometry(s.shankR, s.shankR * 0.92, s.shankLen, 10),
    materialFor("metalSteel")
  );
  shank.position.y = -s.shankLen / 2;
  g.add(shank);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(s.shankR * 0.92, s.shankR * 1.2, 10), materialFor("metalSteel"));
  tip.position.y = -s.shankLen - s.shankR * 0.6;
  tip.rotation.x = Math.PI;
  g.add(tip);

  // Aro de "tornillo pendiente" (item 12: el aprendiz tiene que poder VER
  // cual tornillo toca). Oculto por defecto; lo enciende setHighlight() para
  // los tornillos de la pieza del paso actual. A 4 mm de cabeza sobre una
  // tapa de 330 mm, sin esto el tornillo es un punto oscuro indistinguible.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(s.headR * 2.0, s.headR * 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2; // el plano del aro queda perpendicular al eje
  // 1.2 mm por FUERA de la cara: pegado a la superficie (0.35 mm) el aro se
  // recortaba contra la propia tapa en los angulos rasantes de la vista
  // "Interna" -- medido en una captura ampliada, se veia menos de medio aro.
  ring.position.y = 0.0012;
  ring.name = "screw-pending-ring";
  ring.visible = false;
  ring.renderOrder = 998;
  // El aro NO participa del raycast. three.js NO omite los objetos invisibles
  // al raycastear (solo mira las capas): con el aro oculto pero raycasteable,
  // un disco de 14 mm alrededor de un tornillo de 4 mm le robaba el clic a la
  // pieza que tuviera detras -- medido con clic real: el clic en el teclado
  // seleccionaba el tornillo del SSD. Para clickear el tornillo ya esta su
  // proxy propio.
  ring.raycast = function () {};
  g.add(ring);

  // Proxy de clic invisible (no se dibuja, si se raycastea). Arranca REDUCIDO
  // (ver setProxyScale): a tamaño completo, un cilindro de 8.8 x 7 mm alrededor
  // de un tornillo de 4 mm le roba el clic a la pieza que tenga detras --
  // medido con clic real: el clic en el teclado seleccionaba el tornillo del
  // SSD. Solo se agranda cuando ese tornillo es justo el que toca tocar.
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(s.hitR, s.hitR, s.hitH, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hit.name = "screw-hit-proxy";
  hit.userData.hitH = s.hitH;
  g.add(hit);
  setProxyScale(hit, SCREW_PROXY_IDLE);

  g.traverse((n) => {
    if (n.isMesh && n.name !== "screw-hit-proxy" && n.name !== "screw-pending-ring") {
      n.castShadow = false; // piezas de 4 mm: la sombra solo agrega ruido
      n.receiveShadow = true;
    }
  });
  return g;
}

/** Destornillador de PRECISION (PH00): mango moleteado con tapa giratoria,
 * virola, vastago delgado y punta en cruz. Eje local +Y = hacia la PUNTA
 * (la punta queda en y = DRIVER_LENGTH), igual convencion que el
 * destornillador de taller de hardware_lab_3d_tools_factory.js. */
export function buildPrecisionScrewdriver() {
  const g = new THREE.Group();
  g.name = "precision-screwdriver";
  const steel = materialFor("metalSteel");

  // Tapa giratoria del extremo (la que se apoya con el indice).
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0072, 0.008, 16), materialFor("metalDark"));
  cap.position.y = 0.004;
  g.add(cap);

  // Mango moleteado de aluminio: cuerpo + 10 nervios verticales.
  const handleH = 0.05;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0072, 0.0068, handleH, 18),
    materialFor("aluminum", { color: 0x9aa3ad, roughness: 0.42, metalness: 0.7 })
  );
  handle.position.y = 0.008 + handleH / 2;
  g.add(handle);
  const ribGeo = new THREE.BoxGeometry(0.0009, handleH * 0.82, 0.0016);
  const ribMat = materialFor("aluminum", { color: 0x7f8891, roughness: 0.55, metalness: 0.6 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rib = new THREE.Mesh(ribGeo, ribMat);
    rib.position.set(Math.cos(a) * 0.0069, handle.position.y, Math.sin(a) * 0.0069);
    rib.rotation.y = -a;
    g.add(rib);
  }

  // Virola y vastago.
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0042, 0.006, 14), steel);
  ferrule.position.y = 0.008 + handleH + 0.003;
  g.add(ferrule);
  const shaftLen = DRIVER_LENGTH - (0.008 + handleH + 0.006) - 0.004;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, shaftLen, 10), steel);
  shaft.position.y = 0.008 + handleH + 0.006 + shaftLen / 2;
  g.add(shaft);

  // Punta en cruz PH00: dos aletas cruzadas que rematan en cono.
  const tipY = DRIVER_LENGTH - 0.002;
  [0, Math.PI / 2].forEach((rot) => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0035, 0.0007), steel);
    wing.position.y = tipY;
    wing.rotation.y = rot;
    g.add(wing);
  });
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.0009, 0.002, 8), steel);
  point.position.y = DRIVER_LENGTH - 0.0005;
  g.add(point);

  g.traverse((n) => {
    if (n.isMesh) n.castShadow = true;
  });
  return g;
}

/** Bandeja magnetica donde se dejan los tornillos retirados (practica real de
 * taller: los tornillos de un portatil no son todos iguales y no se mezclan). */
export function buildScrewDish(radius = 0.036) {
  const g = new THREE.Group();
  g.name = "screw-dish";
  const look = { color: 0x24272c, roughness: 0.55, metalness: 0.45 };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.94, 0.0026, 28), materialFor("metalDark", look));
  base.position.y = 0.0013;
  g.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0018, 8, 28), materialFor("metalDark", look));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.0032;
  g.add(rim);
  g.traverse((n) => {
    if (n.isMesh) n.receiveShadow = true;
  });
  return g;
}

/**
 * Controlador de tornillos. `entries` viene del rig:
 *   { id, partId, label, object3d, homePosition: Vector3, outDir: Vector3 }
 * (homePosition/outDir en el espacio LOCAL del rig, que es donde vive el
 * grupo de tornillos).
 *
 * Callbacks:
 *   canOperatePart(partId, action) -> { ok, reason }   (motor puro)
 *   onChanged(screwId, installed)                      (persistencia/HUD)
 *   notify(message, kind)                              (feedback del HUD)
 *   onBusyChange(busy)                                 (bloquea otros clics)
 */
export function createScrewController(options) {
  const {
    group,
    entries,
    tweenGroup,
    dishOrigin,
    dishWorldOrigin: dishWorldOriginOpt,
    floorY,
    canOperatePart,
    onChanged,
    notify,
    onBusyChange,
    playSound,
  } = options;

  const byId = new Map();
  entries.forEach((e) => byId.set(e.id, Object.assign({ installed: true }, e)));

  // El grupo de tornillos SIGUE al portatil (posiciones tecnicas, sep-26: se
  // gira y se voltea con el), pero la bandeja magnetica se queda en la mesa.
  // Su origen se fija en MUNDO al crear el controlador (el equipo esta en su
  // pose inicial) y cada tornillo guardado se traduce al espacio del grupo
  // segun como este el equipo ahora. Con el grupo sin girar, la traduccion
  // devuelve exactamente la posicion local de siempre.
  const dishWorldOrigin = dishWorldOriginOpt
    ? dishWorldOriginOpt.clone()
    : dishOrigin.clone().applyQuaternion(group.quaternion).add(group.position);
  const toGroupLocal = (world) => world.clone().sub(group.position).applyQuaternion(group.quaternion.clone().invert());
  const stowedQuaternion = () => group.quaternion.clone().invert();

  const driver = buildPrecisionScrewdriver();
  driver.visible = false;
  driver.scale.setScalar(1);
  group.add(driver);

  let busy = false;
  let enabled = true;

  function setBusy(value) {
    busy = value;
    if (onBusyChange) onBusyChange(value);
  }

  function list() {
    return Array.from(byId.values());
  }
  function forPart(partId) {
    return list().filter((s) => s.partId === partId);
  }
  function pendingRemoval(partId) {
    return forPart(partId).filter((s) => s.installed).length;
  }
  function pendingInstall(partId) {
    return forPart(partId).filter((s) => !s.installed).length;
  }
  function hasScrews(partId) {
    return forPart(partId).length > 0;
  }

  /** Posicion en la bandeja para el tornillo `index` (rejilla en espiral suave). */
  function dishSlot(index) {
    const ring = index < 1 ? 0 : Math.ceil((Math.sqrt(1 + (index * 4) / 3) - 1) / 2);
    const perRing = ring === 0 ? 1 : ring * 6;
    const first = ring === 0 ? 0 : 1 + 3 * ring * (ring - 1);
    const k = index - first;
    const a = (k / perRing) * Math.PI * 2 + ring * 0.6;
    // 13 mm entre centros: con 9.5 mm los proxys de clic (8.8 mm de diametro)
    // se tapaban entre si y un tornillo de la bandeja quedaba inseleccionable
    // (medido con clic real).
    const r = ring * 0.013;
    return toGroupLocal(new THREE.Vector3(dishWorldOrigin.x + Math.cos(a) * r, dishWorldOrigin.y + 0.0032, dishWorldOrigin.z + Math.sin(a) * r));
  }

  function orientScrew(entry, object3d) {
    object3d.quaternion.setFromUnitVectors(UP, entry.outDir.clone().normalize());
  }

  /** Pose "instalada" (cabeza asentada) y pose "presentada" (apoyada en la
   * boca del agujero, lista para atornillar). */
  function installedPose(entry) {
    return entry.homePosition.clone();
  }
  function presentedPose(entry) {
    return entry.homePosition.clone().addScaledVector(entry.outDir, SCREW_SIZE.shankLen + 0.002);
  }

  function applyState(entry, installed, dishIndex) {
    entry.installed = installed;
    const o = entry.object3d;
    orientScrew(entry, o);
    if (installed) {
      o.position.copy(installedPose(entry));
      o.visible = true;
    } else if (entry.presented) {
      o.position.copy(presentedPose(entry));
      o.visible = true;
    } else {
      o.position.copy(dishSlot(dishIndex != null ? dishIndex : entry.dishIndex || 0));
      o.quaternion.copy(stowedQuaternion());
      o.visible = true;
    }
  }

  /** Estado completo (para guardar/restaurar con la sesion). */
  function getState() {
    const out = {};
    list().forEach((s) => {
      out[s.id] = { installed: s.installed, presented: !!s.presented };
    });
    return out;
  }

  function setState(state, opts = {}) {
    let dishIndex = 0;
    list().forEach((entry) => {
      const st = state && state[entry.id];
      const installed = st ? !!st.installed : !!opts.defaultInstalled;
      entry.presented = st ? !!st.presented : false;
      if (!installed && !entry.presented) {
        entry.dishIndex = dishIndex++;
      }
      applyState(entry, installed, entry.dishIndex);
    });
  }

  /** Sincroniza con la presencia de piezas: una pieza ausente no puede tener
   * sus tornillos puestos, y una pieza instalada de nuevo los pide. */
  function syncFromParts(parts, opts = {}) {
    let dishIndex = 0;
    list().forEach((entry) => {
      const present = parts[entry.partId] !== false;
      if (!present) {
        entry.installed = false;
        entry.presented = false;
        entry.dishIndex = dishIndex++;
      } else if (opts.installedWhenPresent === false) {
        // Ensamble: la pieza acaba de colocarse, sus tornillos quedan
        // PRESENTADOS en la boca del agujero, a la espera.
        entry.installed = false;
        entry.presented = true;
      } else {
        entry.installed = true;
        entry.presented = false;
      }
      applyState(entry, entry.installed, entry.dishIndex);
    });
  }

  /** Una pieza acaba de instalarse: presenta sus tornillos. */
  function presentScrewsFor(partId) {
    forPart(partId).forEach((entry) => {
      if (entry.installed) return;
      entry.presented = true;
      applyState(entry, false);
    });
  }

  /** Una pieza acaba de retirarse: sus tornillos ya estaban fuera; se asegura
   * de que ninguno quede "presentado" flotando en el aire. */
  function stowScrewsFor(partId) {
    let dishIndex = list().filter((s) => !s.installed && !s.presented).length;
    forPart(partId).forEach((entry) => {
      entry.installed = false;
      entry.presented = false;
      entry.dishIndex = dishIndex++;
      applyState(entry, false, entry.dishIndex);
    });
  }

  // ── Animacion del destornillador ─────────────────────────────────────────

  // Holgura maxima con la que el destornillador puede acercarse por el eje del
  // tornillo SIN meter el mango dentro del tablero de la mesa. Medido con clic
  // real antes de este calculo: con una separacion fija de 75 mm el mango
  // entraba 25 mm en la mesa en cada tornillo de la tapa inferior (el portatil
  // esta elevado 160 mm y la herramienta mide 125).
  function maxApproachGap(entry) {
    // En MUNDO: con el portatil volteado, un tornillo que "sale hacia abajo"
    // del equipo sale hacia ARRIBA de la mesa y la herramienta no la toca.
    const outW = entry.outDir.clone().applyQuaternion(group.quaternion);
    const oy = outW.y;
    if (floorY == null || oy >= -1e-6) return 0.06; // no baja: la mesa no estorba
    const headWorld = entry.homePosition.clone().applyQuaternion(group.quaternion).add(group.position);
    const headWorldY = headWorld.y + oy * SCREW_SIZE.headH;
    const room = (headWorldY - (floorY + 0.006)) / -oy - DRIVER_LENGTH;
    return Math.max(0.004, Math.min(0.06, room));
  }

  function driverPoseFor(entry, gap) {
    // La punta del destornillador toca la cabeza del tornillo; el mango queda
    // hacia AFUERA (a lo largo de outDir), nunca dentro del equipo.
    const head = entry.object3d.position.clone().addScaledVector(entry.outDir, SCREW_SIZE.headH + (gap || 0));
    const origin = head.clone().addScaledVector(entry.outDir, DRIVER_LENGTH);
    return origin;
  }

  function placeDriver(entry, gap) {
    driver.quaternion.setFromUnitVectors(UP, entry.outDir.clone().negate().normalize());
    driver.position.copy(driverPoseFor(entry, gap));
  }

  function runSequence(entry, direction, onDone) {
    const removing = direction === "remove";
    const screw = entry.object3d;
    const fast = prefersReducedMotion();
    setBusy(true);

    const startPose = removing ? installedPose(entry) : presentedPose(entry);
    const endPose = removing ? presentedPose(entry) : installedPose(entry);
    if (!removing && !entry.presented) {
      // Viene de la bandeja magnetica: primero se PRESENTA en la boca de su
      // agujero (item 9, paso 1) y despues aparece el destornillador.
      entry.presented = true;
      animateObject3D(tweenGroup, screw, {
        position: startPose,
        quaternion: new THREE.Quaternion().setFromUnitVectors(UP, entry.outDir.clone().normalize()),
        duration: fast ? 0 : 0.42,
        easing: Easing.easeInOutCubic,
        onComplete: () => driveSequence(),
      });
      return;
    }
    screw.position.copy(startPose);
    orientScrew(entry, screw);
    screw.visible = true;
    driveSequence();

    function driveSequence() {
    // 1) El destornillador APARECE separado del tornillo (se ve entrar) ...
    const gapIn = maxApproachGap(entry);
    placeDriver(entry, gapIn);
    driver.visible = true;
    driver.scale.setScalar(0.72);
    animateObject3D(tweenGroup, driver, {
      position: driverPoseFor(entry, gapIn * 0.45),
      scale: new THREE.Vector3(1, 1, 1),
      duration: fast ? 0 : 0.34,
      easing: Easing.easeOutCubic,
      onComplete: () => {
        // 2) Baja hasta ENCAJAR en la cruz de la cabeza.
        animateObject3D(tweenGroup, driver, {
          position: driverPoseFor(entry, 0),
          duration: fast ? 0 : 0.42,
          easing: Easing.easeInOutCubic,
          onComplete: () => {
            // 3) GIRA mientras el tornillo sube (o baja) por su eje.
            if (playSound) playSound();
            const turns = 3.2;
            const dirSign = removing ? -1 : 1;
            const spinDur = fast ? 0 : 1.15;
            animateValue(tweenGroup, 0, 1, {
              target: driver,
              duration: spinDur,
              easing: Easing.easeInOutQuad,
              onUpdate: (t) => {
                const angle = dirSign * turns * Math.PI * 2 * t;
                driver.quaternion
                  .setFromUnitVectors(UP, entry.outDir.clone().negate().normalize())
                  .multiply(new THREE.Quaternion().setFromAxisAngle(UP, angle));
                screw.quaternion
                  .setFromUnitVectors(UP, entry.outDir.clone().normalize())
                  .multiply(new THREE.Quaternion().setFromAxisAngle(UP, angle));
                screw.position.lerpVectors(startPose, endPose, t);
                driver.position.copy(driverPoseFor(entry, 0));
              },
              onComplete: () => {
                screw.position.copy(endPose);
                // 4) El destornillador se aparta y desaparece.
                animateObject3D(tweenGroup, driver, {
                  position: driverPoseFor(entry, gapIn * 0.85),
                  scale: new THREE.Vector3(0.6, 0.6, 0.6),
                  duration: fast ? 0 : 0.28,
                  easing: Easing.easeInCubic,
                  onComplete: () => {
                    driver.visible = false;
                    driver.scale.setScalar(1);
                    finishSequence(entry, removing, onDone);
                  },
                });
              },
            });
          },
        });
      },
    });
    }
  }

  function finishSequence(entry, removing, onDone) {
    if (removing) {
      // 5) El tornillo viaja a la bandeja magnetica.
      entry.installed = false;
      entry.presented = false;
      entry.dishIndex = list().filter((s) => !s.installed && !s.presented && s !== entry).length;
      const slot = dishSlot(entry.dishIndex);
      entry.stowing = true;
      animateObject3D(tweenGroup, entry.object3d, {
        position: slot,
        quaternion: stowedQuaternion(),
        duration: prefersReducedMotion() ? 0 : 0.45,
        easing: Easing.easeInOutCubic,
        onComplete: () => {
          entry.stowing = false;
          setBusy(false);
          if (onChanged) onChanged(entry.id, false, entry.partId);
          if (onDone) onDone(true);
        },
      });
    } else {
      entry.installed = true;
      entry.presented = false;
      setBusy(false);
      if (onChanged) onChanged(entry.id, true, entry.partId);
      if (onDone) onDone(true);
    }
  }

  // ── Entrada de interaccion ───────────────────────────────────────────────

  /** Clic real sobre un tornillo. Devuelve { ok, message } (ya notificado). */
  function handleScrewClick(screwId) {
    const entry = byId.get(screwId);
    if (!entry) return { ok: false, message: "Ese tornillo no existe." };
    if (!enabled) return { ok: false, message: "Los tornillos no se manipulan en este modo." };
    if (busy) {
      const msg = "Espera a que termine la operacion en curso antes de tocar otro tornillo.";
      if (notify) notify(msg, "info");
      return { ok: false, message: msg };
    }

    const direction = entry.installed ? "remove" : "install";

    const check = canOperatePart ? canOperatePart(entry.partId, direction) : { ok: true };
    if (!check.ok) {
      const msg = check.reason || "Este tornillo todavia no debe retirarse. Revisa el procedimiento.";
      if (notify) notify(msg, "error");
      return { ok: false, message: msg };
    }

    runSequence(entry, direction, () => {
      if (notify) {
        notify(
          (direction === "remove" ? "Tornillo retirado: " : "Tornillo instalado: ") + (entry.label || entry.id) + ".",
          "success"
        );
      }
    });
    return { ok: true, started: true, direction };
  }

  /** El portatil cambio de pose: los tornillos guardados siguen en la bandeja
   *  magnetica de la mesa (los instalados y presentados viajan con el grupo). */
  function refreshStowed() {
    list().forEach((entry) => {
      if (entry.installed || entry.presented || entry.stowing) return;
      entry.object3d.position.copy(dishSlot(entry.dishIndex || 0));
      entry.object3d.quaternion.copy(stowedQuaternion());
    });
  }

  /** Enciende el aro de "pendiente" en los tornillos que el paso actual pide
   * tocar (los instalados si toca retirar, los que faltan si toca colocar). */
  function setHighlight(partId, action) {
    const removing = action !== "install";
    list().forEach((entry) => {
      const pending = entry.partId === partId && (removing ? entry.installed : !entry.installed);
      const ring = entry.object3d.getObjectByName("screw-pending-ring");
      if (ring) ring.visible = !!pending;
      const proxy = entry.object3d.getObjectByName("screw-hit-proxy");
      if (proxy) setProxyScale(proxy, pending ? SCREW_PROXY_ACTIVE : SCREW_PROXY_IDLE);
    });
  }

  function setEnabled(value) {
    enabled = !!value;
    group.visible = true;
  }

  function isBusy() {
    return busy;
  }

  function get(screwId) {
    return byId.get(screwId) || null;
  }

  function dispose() {
    tweenGroup && tweenGroup.killTarget(driver);
  }

  return {
    list,
    get,
    forPart,
    hasScrews,
    pendingRemoval,
    pendingInstall,
    presentScrewsFor,
    stowScrewsFor,
    syncFromParts,
    getState,
    setState,
    handleScrewClick,
    setHighlight,
    refreshStowed,
    setEnabled,
    isBusy,
    dispose,
    get driver() {
      return driver;
    },
  };
}

/** Color del resaltado que el HUD puede usar para "tornillo pendiente". */
export const SCREW_ACCENT = ACCENT.select;
