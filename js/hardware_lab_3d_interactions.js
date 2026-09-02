/* js/hardware_lab_3d_interactions.js
 *
 * Raycasting, resaltado y clic directo sobre piezas 3D (items 7 y 8: la
 * interaccion ocurre DENTRO de la escena, no solo con botones externos).
 * No conoce el esquema de datos del laboratorio: solo trabaja con
 * "objetos interactivos registrados" (registerInteractive) y notifica
 * hover/click hacia afuera con lo que el objeto traiga en userData.
 *
 * El resaltado se implementa con un contorno (LineSegments de EdgesGeometry)
 * agregado como hijo, nunca mutando el material original: como el factory de
 * piezas reutiliza materiales compartidos por rendimiento, tocar
 * `material.emissive` resaltaria TODAS las piezas que comparten ese
 * material. El contorno + un leve escalado evita ese problema por completo.
 */
import * as THREE from "./vendor/three.module.min.js";
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js";
import { ACCENT } from "./hardware_lab_3d_constants.js";

const CLICK_MOVE_THRESHOLD = 6; // px: mas que esto se considera arrastre de camara, no clic

// Clave de tween separada del objeto mismo: un pulso de escala por hover no
// debe cancelar una animacion de posicion/rotacion (desmontaje) en curso
// sobre la misma pieza (ver comentario de targetKey en hardware_lab_3d_tween.js).
function hoverScaleKey(object3d) {
  return object3d.uuid + ":hover-scale";
}

// ── Emissive suave al SELECCIONAR (mejora 3D, item 5) ──────────────────────
// Complementa el contorno existente (arriba) sin sus limitaciones: un tinte
// emissive muy leve en el material real de la pieza, para que la pieza
// seleccionada tambien se sienta "encendida", no solo enmarcada. Mismo
// cuidado que el contorno: clona el material UNA vez (nunca toca el
// compartido) y en la restauracion vuelve al valor ORIGINAL exacto -- no a
// 0 a secas, porque unos pocos kinds de la paleta (ledRed, ledGreen) ya
// traen emissive propio y apagarlo sin mas los dejaria "muertos".
function eachGlowableMesh(root, fn) {
  root.traverse((n) => {
    if (!n.isMesh || !n.material || Array.isArray(n.material)) return;
    if (!n.material.emissive) return; // MeshBasicMaterial (proxies de clic invisibles): nada que tintar
    if (n.material.transparent && n.material.opacity === 0) return;
    fn(n);
  });
}

function ensureOwnMaterialForGlow(mesh) {
  if (!mesh.userData.hwlabGlowOwned) {
    mesh.userData.hwlabGlowOwned = true;
    mesh.userData.hwlabGlowOriginalEmissive = mesh.material.emissive.getHex();
    mesh.userData.hwlabGlowOriginalEmissiveIntensity = mesh.material.emissiveIntensity;
    mesh.material = mesh.material.clone();
  }
  return mesh.material;
}

function setSelectGlow(root, color, intensity) {
  eachGlowableMesh(root, (mesh) => {
    const mat = ensureOwnMaterialForGlow(mesh);
    mat.emissive.set(color);
    mat.emissiveIntensity = intensity;
  });
}

function clearSelectGlow(root) {
  root.traverse((n) => {
    if (n.isMesh && n.userData.hwlabGlowOwned) {
      n.material.emissive.setHex(n.userData.hwlabGlowOriginalEmissive);
      n.material.emissiveIntensity = n.userData.hwlabGlowOriginalEmissiveIntensity;
    }
  });
}

export function createInteractionLayer({ scene, camera, renderer, tweenGroup, onTick }) {
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2(2, 2); // fuera de pantalla hasta el primer movimiento
  const registry = new Map(); // root Object3D -> { partId, kind, data }
  const meshToRoot = new Map(); // Mesh -> root Object3D (acelera la busqueda de ancestro)

  let hoveredRoot = null;
  let selectedRoot = null;
  let enabled = true;
  let downPos = null;
  let hoverListeners = [];
  let clickListeners = [];

  const el = renderer.domElement;

  function registerInteractive(object3d, meta) {
    registry.set(object3d, meta || {});
    object3d.traverse((n) => {
      if (n.isMesh) meshToRoot.set(n, object3d);
    });
    object3d.userData.hwlabInteractive = true;
  }

  function unregisterInteractive(object3d) {
    registry.delete(object3d);
    object3d.traverse((n) => {
      if (n.isMesh) meshToRoot.delete(n);
    });
    if (hoveredRoot === object3d) setHovered(null);
    if (selectedRoot === object3d) setSelected(null);
  }

  /** Metadatos (partId/kind/label) registrados para un root -- reusa lo que
   * ya llega via registerInteractive() en vez de duplicar el nombre de
   * cada pieza en otro lugar (mejora 3D: etiquetas del "Modo didactico"). */
  function getMeta(object3d) {
    return registry.get(object3d) || null;
  }

  function clearInteractives() {
    registry.clear();
    meshToRoot.clear();
    setHovered(null);
    setSelected(null);
  }

  function findRoot(mesh) {
    return meshToRoot.get(mesh) || null;
  }

  function updatePointer(event) {
    const rect = el.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastRoot() {
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(Array.from(registry.keys()), true);
    for (const hit of hits) {
      const root = hit.object.isMesh ? findRoot(hit.object) : null;
      if (root) return root;
    }
    return null;
  }

  function buildOutline(root, color) {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const geo = new THREE.BoxGeometry(
      Math.max(size.x, 0.004) * 1.08,
      Math.max(size.y, 0.004) * 1.08,
      Math.max(size.z, 0.004) * 1.08
    );
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 1.5 }));
    root.worldToLocal(center);
    line.position.copy(center);
    line.name = "hwlab-outline";
    line.renderOrder = 999;
    return line;
  }

  function setHovered(root) {
    if (hoveredRoot === root) return;
    if (hoveredRoot) {
      const old = hoveredRoot.getObjectByName("hwlab-outline-hover");
      if (old) hoveredRoot.remove(old);
      if (hoveredRoot !== selectedRoot) {
        animateObject3D(tweenGroup, hoveredRoot, {
          scale: new THREE.Vector3(1, 1, 1),
          duration: 0.18,
          easing: Easing.easeOutQuad,
          targetKey: hoverScaleKey(hoveredRoot),
        });
      }
    }
    hoveredRoot = root;
    if (hoveredRoot) {
      const outline = buildOutline(hoveredRoot, ACCENT.highlight);
      outline.name = "hwlab-outline-hover";
      hoveredRoot.add(outline);
      if (hoveredRoot !== selectedRoot) {
        animateObject3D(tweenGroup, hoveredRoot, {
          scale: new THREE.Vector3(1.035, 1.035, 1.035),
          duration: 0.18,
          easing: Easing.easeOutQuad,
          targetKey: hoverScaleKey(hoveredRoot),
        });
      }
      el.style.cursor = "pointer";
    } else {
      el.style.cursor = "";
    }
    const meta = hoveredRoot ? registry.get(hoveredRoot) : null;
    hoverListeners.forEach((fn) => fn(hoveredRoot, meta));
  }

  function setSelected(root) {
    if (selectedRoot) {
      const old = selectedRoot.getObjectByName("hwlab-outline-select");
      if (old) selectedRoot.remove(old);
      clearSelectGlow(selectedRoot);
      if (selectedRoot !== hoveredRoot) {
        animateObject3D(tweenGroup, selectedRoot, { scale: new THREE.Vector3(1, 1, 1), duration: 0.18, targetKey: hoverScaleKey(selectedRoot) });
      }
    }
    selectedRoot = root;
    if (selectedRoot) {
      const outline = buildOutline(selectedRoot, ACCENT.select);
      outline.name = "hwlab-outline-select";
      selectedRoot.add(outline);
      // Intensidad baja a proposito (item 5: "emissive SUAVE"): debe leerse
      // como una pieza "encendida/activa", no como una luz propia que
      // compita con la iluminacion real de la escena.
      setSelectGlow(selectedRoot, ACCENT.select, 0.35);
    }
  }

  function onPointerMove(event) {
    if (!enabled) return;
    updatePointer(event);
  }

  function onPointerDown(event) {
    downPos = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!enabled || !downPos) return;
    const dx = event.clientX - downPos.x;
    const dy = event.clientY - downPos.y;
    downPos = null;
    if (Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) return; // fue arrastre de camara, no clic
    updatePointer(event);
    const root = raycastRoot();
    setSelected(root);
    const meta = root ? registry.get(root) : null;
    clickListeners.forEach((fn) => fn(root, meta, event));
  }

  el.addEventListener("pointermove", onPointerMove, { passive: true });
  el.addEventListener("pointerdown", onPointerDown, { passive: true });
  el.addEventListener("pointerup", onPointerUp, { passive: true });
  el.addEventListener("pointerleave", () => setHovered(null));

  const offTick = onTick(() => {
    if (!enabled || !registry.size) return;
    const root = raycastRoot();
    setHovered(root);
  });

  function setEnabled(value) {
    enabled = value;
    if (!value) setHovered(null);
  }

  function onHover(fn) {
    hoverListeners.push(fn);
    return () => {
      hoverListeners = hoverListeners.filter((f) => f !== fn);
    };
  }
  function onClick(fn) {
    clickListeners.push(fn);
    return () => {
      clickListeners = clickListeners.filter((f) => f !== fn);
    };
  }

  function clearSelection() {
    setSelected(null);
  }

  function dispose() {
    offTick();
    el.removeEventListener("pointermove", onPointerMove);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointerup", onPointerUp);
    clearInteractives();
  }

  return {
    registerInteractive,
    unregisterInteractive,
    clearInteractives,
    getMeta,
    setEnabled,
    onHover,
    onClick,
    clearSelection,
    setSelected,
    get hovered() {
      return hoveredRoot;
    },
    get selected() {
      return selectedRoot;
    },
    dispose,
  };
}

/** Convierte la posicion mundial de un Object3D a coordenadas de pantalla (para tooltips/paneles HTML). */
export function worldToScreen(object3d, camera, canvasEl) {
  const pos = new THREE.Vector3();
  object3d.getWorldPosition(pos);
  pos.project(camera);
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: rect.left + ((pos.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - pos.y) / 2) * rect.height,
    behindCamera: pos.z > 1,
  };
}
