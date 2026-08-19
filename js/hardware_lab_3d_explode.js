/* js/hardware_lab_3d_explode.js
 *
 * Vista explotada (item 6): separa cada pieza instalada de su posicion real
 * y la deja flotando alrededor del equipo, en capas segun que tan "externa"
 * sea (gabinete/panel primero, procesador casi no se mueve). La direccion
 * de cada pieza se calcula sola (radial desde el centro del equipo): no
 * hace falta autorar un vector por pieza a mano.
 */
import * as THREE from "./vendor/three.module.min.js";
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js";

export function createExplodeController({ tweenGroup }) {
  let exploded = false;
  let activeEntries = [];

  /**
   * entries: [{ object3d, tier (0..n, mayor = se aleja mas), homePosition (Vector3 local) }]
   * center: Vector3 en el mismo espacio local que object3d.position (normalmente el padre del rig)
   */
  function explode(entries, center, opts = {}) {
    if (exploded) return;
    exploded = true;
    activeEntries = entries;
    const baseDistance = opts.baseDistance != null ? opts.baseDistance : 0.16;
    const tierStep = opts.tierStep != null ? opts.tierStep : 0.11;
    const stagger = opts.stagger != null ? opts.stagger : 0.03;

    entries.forEach((entry, i) => {
      const dir = entry.object3d.position.clone().sub(center);
      if (dir.lengthSq() < 1e-6) dir.set((Math.random() - 0.5) || 0.3, 0.6, (Math.random() - 0.5) || 0.3);
      dir.normalize();
      const distance = baseDistance + entry.tier * tierStep;
      const target = entry.homePosition.clone().addScaledVector(dir, distance);
      animateObject3D(tweenGroup, entry.object3d, {
        position: target,
        duration: opts.duration != null ? opts.duration : 0.85,
        easing: Easing.easeOutCubic,
        delay: i * stagger,
      });
    });
  }

  function collapse(opts = {}) {
    if (!exploded) return;
    exploded = false;
    const stagger = opts.stagger != null ? opts.stagger : 0.02;
    activeEntries.forEach((entry, i) => {
      animateObject3D(tweenGroup, entry.object3d, {
        position: entry.homePosition.clone(),
        duration: opts.duration != null ? opts.duration : 0.6,
        easing: Easing.easeInOutCubic,
        delay: i * stagger,
      });
    });
    activeEntries = [];
  }

  function toggle(entries, center, opts) {
    if (exploded) collapse(opts);
    else explode(entries, center, opts);
    return exploded;
  }

  return {
    explode,
    collapse,
    toggle,
    get isExploded() {
      return exploded;
    },
  };
}
