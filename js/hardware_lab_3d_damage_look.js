/* js/hardware_lab_3d_damage_look.js
 *
 * Aspecto de un componente AVERIADO (LOOP portatil, fase I, 2026-10-01).
 * Cuando el aprendiz retira una pieza averiada, el dano se VE en la pieza
 * (una marca de quemado sobre sus dos caras y el conjunto oscurecido), no
 * solo se lee en el texto de "Revisar". Montada en el equipo no se marca: la
 * averia se descubre retirando y observando la pieza, como en un taller.
 *
 * No modifica la geometria ni los materiales compartidos de la pieza: anade
 * dos mallas propias (hijas, con nombre) y las quita al limpiar.
 */
import * as THREE from "./vendor/three.module.min.js";
import { visibleLocalBox } from "./hardware_lab_3d_interactions.js?v=20260929_1";

const MARK_NAME = "hwlab-damage-mark";

/** Eje mas delgado de una caja y sus dos ejes de cara: { normal, u, v } (indices 0..2). Puro. */
export function thinAxis(size) {
  const dims = [size.x, size.y, size.z];
  let normal = 0;
  for (let i = 1; i < 3; i++) if (dims[i] < dims[normal]) normal = i;
  const faces = [0, 1, 2].filter((i) => i !== normal);
  return { normal, u: faces[0], v: faces[1] };
}

export function clearDamageLook(root) {
  if (!root) return false;
  const old = [];
  root.traverse((n) => { if (n.name === MARK_NAME) old.push(n); });
  old.forEach((n) => { if (n.parent) n.parent.remove(n); if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
  return old.length > 0;
}

/** Marca de dano sobre las dos caras grandes de la pieza. Idempotente. */
export function applyDamageLook(root) {
  if (!root) return false;
  let has = false;
  root.traverse((n) => { if (n.name === MARK_NAME) has = true; });
  if (has) return true;
  const box = visibleLocalBox(root);
  if (box.isEmpty()) return false;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const { normal, u, v } = thinAxis(size);
  const dims = [size.x, size.y, size.z];
  const radius = Math.max(0.0025, Math.min(dims[u], dims[v]) * 0.32);
  [1, -1].forEach((side) => {
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 20),
      new THREE.MeshBasicMaterial({ color: 0x2a0f06, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false })
    );
    mark.name = MARK_NAME;
    const pos = [center.x, center.y, center.z];
    pos[normal] += side * (dims[normal] / 2 + 0.0004);
    // Descentrada: se lee como un dano localizado, no como un adorno.
    pos[u] += dims[u] * 0.16;
    pos[v] -= dims[v] * 0.12;
    mark.position.set(pos[0], pos[1], pos[2]);
    // El circulo nace en el plano XY (normal +Z): se orienta hacia la cara.
    const n = new THREE.Vector3(normal === 0 ? side : 0, normal === 1 ? side : 0, normal === 2 ? side : 0);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mark.renderOrder = 5;
    mark.castShadow = false;
    mark.receiveShadow = false;
    mark.raycast = () => {};
    root.add(mark);
  });
  return true;
}
