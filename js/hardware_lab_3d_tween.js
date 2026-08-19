/* js/hardware_lab_3d_tween.js
 *
 * Motor de interpolacion (tween) minimo para el Laboratorio Virtual de
 * Hardware. El proyecto no usa bundler/npm (ver CLAUDE.md): en vez de
 * vendorizar GSAP, esta rueda pequena de requestAnimationFrame + easing
 * cubre todo lo que la escena 3D necesita (desmontaje de piezas, vuelos de
 * camara, vista explotada). Sin dependencias, ES module puro.
 */
import * as THREE from "./vendor/three.module.min.js";

export const Easing = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  // Pequeno "overshoot" al asentar una pieza instalada (se siente a resorte).
  easeOutBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export function prefersReducedMotion() {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Grupo de tweens activos. Se actualiza una vez por frame desde el loop de
 * render de la escena (ver hardware_lab_3d_scene.js).
 */
export class TweenGroup {
  constructor() {
    this._tweens = [];
  }

  update(deltaSeconds) {
    if (!this._tweens.length) return;
    const stillRunning = [];
    for (const tw of this._tweens) {
      if (tw._delayRemaining > 0) {
        tw._delayRemaining -= deltaSeconds;
        stillRunning.push(tw);
        continue;
      }
      tw._elapsed += deltaSeconds;
      const t = tw.duration <= 0 ? 1 : Math.min(1, tw._elapsed / tw.duration);
      const eased = tw.easing(t);
      tw.onUpdate(eased, t);
      if (t >= 1) {
        if (tw.onComplete) tw.onComplete();
      } else {
        stillRunning.push(tw);
      }
    }
    this._tweens = stillRunning;
  }

  add(tween) {
    this._tweens.push(tween);
    return tween;
  }

  /** Cancela cualquier tween en curso asociado a `target` (evita animaciones que compiten). */
  killTarget(target) {
    this._tweens = this._tweens.filter((tw) => tw.target !== target);
  }

  clear() {
    this._tweens = [];
  }

  get activeCount() {
    return this._tweens.length;
  }
}

/**
 * Anima un valor numerico simple (opacidad, intensidad de luz, FOV...).
 */
export function animateValue(group, from, to, opts = {}) {
  const duration = prefersReducedMotion() ? 0 : opts.duration != null ? opts.duration : 0.6;
  const easing = opts.easing || Easing.easeInOutCubic;
  const tween = {
    target: opts.target || null,
    duration,
    easing,
    _elapsed: 0,
    _delayRemaining: opts.delay || 0,
    onUpdate: (eased) => {
      const v = from + (to - from) * eased;
      if (opts.onUpdate) opts.onUpdate(v);
    },
    onComplete: opts.onComplete,
  };
  if (duration === 0) {
    tween.onUpdate(1);
    if (tween.onComplete) tween.onComplete();
    return tween;
  }
  return group.add(tween);
}

// Los factories reutilizan materiales cacheados por rendimiento (varias
// piezas pueden compartir la MISMA instancia de MeshStandardMaterial). Mutar
// opacidad/transparencia directamente resaltaria/desvaneceria TODAS las
// piezas que comparten ese material. Por eso, antes de escribir, cada mesh
// recibe su propio clon (una sola vez, marcado en userData) sin afectar a
// nadie mas que comparta el original. No soporta arreglos de material
// (ningun factory de este laboratorio los usa).
function ensureOwnMaterial(node) {
  if (node.material.userData && node.material.userData.hwlabOwnedBy === node.uuid) return node.material;
  const owned = node.material.clone();
  owned.userData = Object.assign({}, owned.userData, { hwlabOwnedBy: node.uuid });
  node.material = owned;
  return owned;
}

function eachOwnMaterial(object3d, fn) {
  object3d.traverse((node) => {
    if (node.isMesh && node.material && !Array.isArray(node.material)) fn(ensureOwnMaterial(node));
  });
}

function readOpacity(object3d) {
  let value = 1;
  object3d.traverse((node) => {
    if (node.isMesh && node.material && !Array.isArray(node.material)) value = node.material.opacity;
  });
  return value;
}

function writeOpacity(object3d, value) {
  eachOwnMaterial(object3d, (m) => {
    m.opacity = value;
  });
}

function setTransparent(object3d, transparent) {
  eachOwnMaterial(object3d, (m) => {
    m.transparent = transparent;
  });
}

/**
 * Anima position/rotation(quaternion)/scale de un Object3D de Three.js hacia
 * los valores destino indicados (los que no se pasan quedan intactos).
 * `euler` acepta un THREE.Euler o un array [x,y,z] en radianes.
 *
 * `opts.targetKey` (por defecto: el propio object3d) es la clave que usa
 * killTarget() para cancelar tweens previos. Se puede pasar una clave
 * distinta (p.ej. object3d.uuid + ":hover") para que un pulso de escala por
 * hover NO cancele una animacion de posicion (desmontaje/instalacion) en
 * curso sobre el mismo objeto: son animaciones independientes que deben
 * poder coexistir.
 */
export function animateObject3D(group, object3d, opts = {}) {
  const targetKey = opts.targetKey || object3d;
  group.killTarget(targetKey);

  const duration = prefersReducedMotion() ? 0 : opts.duration != null ? opts.duration : 0.7;
  const easing = opts.easing || Easing.easeInOutCubic;

  const startPos = object3d.position.clone();
  const endPos = opts.position ? opts.position.clone() : null;

  const startQuat = object3d.quaternion.clone();
  let endQuat = null;
  if (opts.euler) {
    const e = Array.isArray(opts.euler)
      ? new THREE.Euler(opts.euler[0], opts.euler[1], opts.euler[2])
      : opts.euler;
    endQuat = new THREE.Quaternion().setFromEuler(e);
  } else if (opts.quaternion) {
    endQuat = opts.quaternion.clone();
  }

  const startScale = object3d.scale.clone();
  const endScale = opts.scale ? opts.scale.clone() : null;

  const startOpacity = opts.opacity != null ? readOpacity(object3d) : null;
  const endOpacity = opts.opacity != null ? opts.opacity : null;
  if (opts.opacity != null) setTransparent(object3d, true);

  const tween = {
    target: targetKey,
    duration,
    easing,
    _elapsed: 0,
    _delayRemaining: opts.delay || 0,
    onUpdate: (eased) => {
      if (endPos) object3d.position.lerpVectors(startPos, endPos, eased);
      if (endQuat) THREE.Quaternion.slerp(startQuat, endQuat, object3d.quaternion, eased);
      if (endScale) object3d.scale.lerpVectors(startScale, endScale, eased);
      if (endOpacity != null) writeOpacity(object3d, startOpacity + (endOpacity - startOpacity) * eased);
      if (opts.onUpdate) opts.onUpdate(eased);
    },
    onComplete: () => {
      if (endPos) object3d.position.copy(endPos);
      if (endQuat) object3d.quaternion.copy(endQuat);
      if (endScale) object3d.scale.copy(endScale);
      if (endOpacity != null) {
        writeOpacity(object3d, endOpacity);
        if (endOpacity >= 1) setTransparent(object3d, false);
      }
      if (opts.onComplete) opts.onComplete();
    },
  };

  if (duration === 0) {
    tween.onUpdate(1);
    tween.onComplete();
    return tween;
  }
  return group.add(tween);
}

/** Interpola linealmente entre dos numeros (util fuera de tweens tambien). */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
