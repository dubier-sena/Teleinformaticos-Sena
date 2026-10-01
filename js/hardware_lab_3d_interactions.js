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
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js?v=20260929_1";
import { ACCENT, isHitbox } from "./hardware_lab_3d_constants.js?v=20260929_1";
import { pickTolerancePx, ringOffsets, choosePick } from "./hardware_lab_3d_pick_policy.js?v=20260929_1";

/**
 * Caja de la GEOMETRIA VISIBLE de una pieza en su propio espacio local
 * (auditoria sep-26). Excluye hitboxes, contornos, mallas ocultas y mallas
 * de opacidad 0. El contorno se construia con la caja de MUNDO
 * (setFromObject) pero se colgaba como hija de la pieza, asi que heredaba su
 * rotacion: con la pantalla abierta a ~100 grados medía 356x234x58 mm sobre
 * sus ejes frente a 330x15x222 reales (4.5 veces el volumen), y los cables
 * salian 2-4 veces mas grandes por su hitbox.
 */
export function visibleLocalBox(root) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const m = new THREE.Matrix4();
  const shown = (n) => {
    for (let o = n; o && o !== root.parent; o = o.parent) if (!o.visible) return false;
    return true;
  };
  root.traverse((n) => {
    if (!n.isMesh || isHitbox(n) || (n.name && n.name.startsWith("hwlab-outline")) || !shown(n)) return;
    const mat = n.material;
    if (mat && !Array.isArray(mat) && mat.transparent && mat.opacity === 0) return;
    let local;
    if (n.isInstancedMesh) {
      if (!n.boundingBox) n.computeBoundingBox();
      local = n.boundingBox;
    } else {
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      local = n.geometry.boundingBox;
    }
    tmp.copy(local).applyMatrix4(m.multiplyMatrices(inv, n.matrixWorld));
    box.union(tmp);
  });
  return box;
}

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
  // Oclusores (fase 3 del portatil): geometria NO seleccionable que igual
  // debe BLOQUEAR el rayo, como el chasis del portatil. Sin esto el clic
  // atravesaba el reposamanos y seleccionaba piezas que no se veian (medido:
  // hasta 55 % de los rayos). Opcional: si nadie registra oclusores (el
  // escritorio no lo hace) el comportamiento es exactamente el de siempre.
  const occluders = new Set();

  let hoveredRoot = null;
  let selectedRoot = null;
  let enabled = true;
  let downPos = null;
  let hoverListeners = [];
  let clickListeners = [];
  // Seleccion tolerante (Fase C): el modo activo declara que objetivos espera
  // el paso actual. null = no espera nada concreto (explorar, diagnostico).
  let pickExpectation = null;
  // Con el dedo no existe "pasar por encima": el rayo de hover por cuadro solo
  // gastaba CPU en el telefono (y dejaba un resaltado pegado tras cada toque).
  let lastPointerType = "mouse";

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

  function registerOccluder(object3d) {
    occluders.add(object3d);
  }

  function unregisterOccluder(object3d) {
    occluders.delete(object3d);
  }

  function clearInteractives() {
    registry.clear();
    meshToRoot.clear();
    occluders.clear();
    pickExpectation = null;
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

  function raycastRoot(ndc) {
    raycaster.setFromCamera(ndc || pointerNdc, camera);
    const targets = Array.from(registry.keys());
    occluders.forEach((o) => targets.push(o));
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      if (!hit.object.isMesh) continue;
      const root = findRoot(hit.object);
      if (root) return root;
      // Primer impacto en un oclusor visible: la pieza de detras no se ve,
      // asi que tampoco se puede seleccionar.
      if (hit.object.visible && isUnderOccluder(hit.object)) return null;
    }
    return null;
  }

  /**
   * Que se seleccionaria con un toque en (clientX, clientY). Consulta pura:
   * no selecciona ni notifica. Devuelve { root, assisted, reason, exact },
   * donde exact es lo que hay bajo el pixel exacto (lo unico que se miraba
   * antes de la seleccion tolerante).
   */
  function pickAt(clientX, clientY, pointerType) {
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2();
    const cast = (x, y) => {
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
      ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      return raycastRoot(ndc);
    };
    const exact = cast(clientX, clientY);
    const rule = (typeof pickExpectation === "function" ? pickExpectation() : null) || {};
    const metaOf = (root) => (root ? registry.get(root) || {} : null);
    const expected = typeof rule.expected === "function" ? (root, exactRoot) => !!rule.expected(metaOf(root), metaOf(exactRoot)) : null;
    // El pixel exacto ya basta: no hace falta muestrear alrededor.
    if (exact && (!expected || expected(exact, exact))) return { root: exact, assisted: false, reason: "exact", exact };
    const near = [];
    for (const o of ringOffsets(pickTolerancePx(pointerType))) {
      const root = cast(clientX + o.dx, clientY + o.dy);
      if (root) near.push({ key: root, dist: o.dist });
    }
    const pick = choosePick({ exact, near, expected, nearestOnEmpty: rule.nearestOnEmpty !== false });
    return { root: pick.key, assisted: pick.assisted, reason: pick.reason, exact };
  }

  /** fn() -> null | { expected: (meta, metaExacta) => boolean, nearestOnEmpty: boolean }.
   *  Ver hardware_lab_3d_pick_policy.js. */
  function setPickExpectation(fn) {
    pickExpectation = typeof fn === "function" ? fn : null;
  }

  function isUnderOccluder(mesh) {
    if (!occluders.size) return false;
    let n = mesh;
    while (n) {
      if (occluders.has(n)) return true;
      n = n.parent;
    }
    return false;
  }

  function buildOutline(root, color) {
    // En el espacio LOCAL de la pieza y solo con lo visible: el contorno es
    // hijo de la pieza y gira con ella (ver visibleLocalBox).
    const box = visibleLocalBox(root);
    if (box.isEmpty()) box.set(new THREE.Vector3(-0.002, -0.002, -0.002), new THREE.Vector3(0.002, 0.002, 0.002));
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

  function notePointerType(event) {
    const type = event.pointerType || "mouse";
    if (type !== lastPointerType) {
      lastPointerType = type;
      if (type !== "mouse") setHovered(null);
    }
  }

  function onPointerMove(event) {
    if (!enabled) return;
    notePointerType(event);
    updatePointer(event);
  }

  function onPointerDown(event) {
    notePointerType(event);
    downPos = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    if (!enabled || !downPos) return;
    const dx = event.clientX - downPos.x;
    const dy = event.clientY - downPos.y;
    downPos = null;
    if (Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) return; // fue arrastre de camara, no clic
    updatePointer(event);
    const pick = pickAt(event.clientX, event.clientY, event.pointerType || "mouse");
    const root = pick.root;
    setSelected(root);
    const meta = root ? registry.get(root) : null;
    clickListeners.forEach((fn) => fn(root, meta, event, pick));
  }

  el.addEventListener("pointermove", onPointerMove, { passive: true });
  el.addEventListener("pointerdown", onPointerDown, { passive: true });
  el.addEventListener("pointerup", onPointerUp, { passive: true });
  el.addEventListener("pointerleave", () => setHovered(null));

  const offTick = onTick(() => {
    if (!enabled || !registry.size || lastPointerType !== "mouse") return;
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
    registerOccluder,
    unregisterOccluder,
    clearInteractives,
    getMeta,
    pickAt,
    setPickExpectation,
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
