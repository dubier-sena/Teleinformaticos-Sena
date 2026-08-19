/* js/hardware_lab_3d_camera.js
 *
 * Camara inteligente del laboratorio (item 5): orbita libre con
 * OrbitControls + vuelos suaves a vistas nombradas (frontal/lateral/
 * superior/posterior/interna/libre) y a un componente especifico. Cualquier
 * gesto del usuario interrumpe un vuelo en curso (regla "interruptible"):
 * el aprendiz nunca queda atrapado esperando una animacion de camara.
 */
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { Easing, prefersReducedMotion } from "./hardware_lab_3d_tween.js";

export function createCameraRig({ camera, renderer, tweenGroup, onTick }) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 0.18;
  controls.maxDistance = 6.5;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 0.95, 0);
  controls.update();

  let rigCenter = new THREE.Vector3(0, 0.95, 0);
  let rigRadius = 0.5;
  let flightActive = false;

  function setRigBounds(center, radius) {
    rigCenter = center.clone();
    rigRadius = Math.max(0.08, radius);
  }

  function cancelFlight() {
    if (!flightActive) return;
    tweenGroup.killTarget(camera);
    flightActive = false;
    controls.enabled = true;
  }

  // Cualquier gesto del usuario corta el vuelo automatico de inmediato.
  function onPointerDownDuringFlight() {
    if (flightActive) cancelFlight();
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDownDuringFlight, { passive: true });

  const offTick = onTick(() => {
    controls.update();
  });

  function flyTo(position, target, opts = {}) {
    cancelFlight();
    flightActive = true;
    controls.enabled = false;
    const duration = prefersReducedMotion() ? 0 : opts.duration != null ? opts.duration : 1.05;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const easing = Easing.easeInOutCubic;

    const tween = {
      target: camera,
      duration,
      easing,
      _elapsed: 0,
      _delayRemaining: 0,
      onUpdate: (eased) => {
        camera.position.lerpVectors(startPos, position, eased);
        controls.target.lerpVectors(startTarget, target, eased);
      },
      onComplete: () => {
        camera.position.copy(position);
        controls.target.copy(target);
        flightActive = false;
        controls.enabled = true;
        if (opts.onComplete) opts.onComplete();
      },
    };
    if (duration === 0) {
      tween.onUpdate(1);
      tween.onComplete();
      return;
    }
    tweenGroup.add(tween);
  }

  // ── Vistas nombradas (item 5), proporcionales al tamano del equipo cargado. ─
  function viewPreset(name) {
    const c = rigCenter;
    const r = rigRadius;
    switch (name) {
      case "front":
        return { pos: new THREE.Vector3(c.x, c.y + r * 0.25, c.z + r * 2.1), target: c };
      case "side":
        return { pos: new THREE.Vector3(c.x + r * 2.2, c.y + r * 0.2, c.z), target: c };
      case "top":
        return { pos: new THREE.Vector3(c.x + 0.001, c.y + r * 2.6, c.z + 0.15), target: c };
      case "back":
        return { pos: new THREE.Vector3(c.x, c.y + r * 0.25, c.z - r * 2.1), target: c };
      case "internal":
        return { pos: new THREE.Vector3(c.x + r * 1.1, c.y + r * 0.85, c.z + r * 1.35), target: c };
      case "overview":
      default:
        return { pos: new THREE.Vector3(c.x + r * 1.5, c.y + r * 1.15, c.z + r * 2.6), target: c };
    }
  }

  function goToView(name, opts) {
    const preset = viewPreset(name);
    flyTo(preset.pos, preset.target, opts);
  }

  /** Acerca la camara suavemente a un objeto especifico (item 5: RAM, CPU, discos...). */
  function focusOnObject(object3d, opts = {}) {
    const box = new THREE.Box3().setFromObject(object3d);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
    dir.normalize();
    const distance = Math.max(0.22, sphere.radius * (opts.distanceFactor || 3.4));
    const pos = sphere.center.clone().addScaledVector(dir, distance);
    // Evita que la camara termine por debajo del tablero al enfocar piezas bajas.
    pos.y = Math.max(pos.y, sphere.center.y + sphere.radius * 0.35);
    flyTo(pos, sphere.center, opts);
  }

  function isFlying() {
    return flightActive;
  }

  function setFreeLook(enabled) {
    cancelFlight();
    controls.enabled = enabled;
  }

  function dispose() {
    offTick();
    renderer.domElement.removeEventListener("pointerdown", onPointerDownDuringFlight);
    controls.dispose();
  }

  return {
    controls,
    setRigBounds,
    goToView,
    focusOnObject,
    flyTo,
    isFlying,
    setFreeLook,
    dispose,
  };
}
