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
import { animateObject3D, Easing } from "./hardware_lab_3d_tween.js?v=20261009_1";
import { ACCENT, isHitbox } from "./hardware_lab_3d_constants.js?v=20261009_1";
import { pickTolerancePx, ringOffsets, choosePick } from "./hardware_lab_3d_pick_policy.js?v=20261009_1";

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
  let laptopMode = false, pointerDirty = true;
  const targets = [], hits = [], lastCamera = new Float64Array(16);
  const lastProjection = new Float64Array(16);
  let pointerClient = null, lastRect = null, wasAnimating = false;
  const outlines = new Map();
  const offsetCache = new Map();
  const STATE_COLORS = { available: 0x93c5fd, target: 0x60a5fa, hover: 0x22d3ee, touch: 0xc4b5fd, selected: 0xf8fafc, correct: 0x4ade80, incorrect: 0xfb7185, blocked: 0xfbbf24 };
  function rebuildTargets() { targets.length=0; registry.forEach((_,r)=>targets.push(r));occluders.forEach(r=>targets.push(r));pointerDirty=true; }
  function setLaptopMode(value) { clearSelection();setHovered(null);laptopMode=!!value;pointerDirty=true; }
  function removeOutlines(root) {
    const cached=outlines.get(root);if(!cached)return;
    for(const line of cached.values()){root.remove(line);line.geometry.dispose();line.material.dispose()}
    outlines.delete(root);
  }
  function outlineFor(root, role, color) {
    if(!laptopMode)return buildOutline(root,color);
    let cache=outlines.get(root);if(!cache){cache=new Map();outlines.set(root,cache)}
    let line=cache.get(role);
    if(!line){line=buildOutline(root,color);cache.set(role,line)}
    line.material.color.setHex(color);return line;
  }
  function detachOutline(root, name) {
    const line=root.getObjectByName(name);if(!line)return;
    root.remove(line);
    if(!laptopMode){line.geometry.dispose();line.material.dispose()}
  }
  function setSelectionState(state) {
    if(!laptopMode||!selectedRoot)return;
    const line=selectedRoot.getObjectByName('hwlab-outline-select');
    if(line)line.material.color.setHex(STATE_COLORS[state]||STATE_COLORS.selected);
    selectedRoot.userData.selectionState=state;
  }

  let hoveredRoot = null;
  let selectedRoot = null;
  let enabled = true;
  let downPos = null;
  const activePointers = new Set();
  let multiTouch = false;
  let hoverListeners = [];
  let clickListeners = [], focusListeners = [];
  let freeGestures = false, clickGuard = null, pendingTap = null, tapTimer = null, dragged = false;
  function cancelTap() { if(tapTimer)clearTimeout(tapTimer);tapTimer=null;pendingTap=null; }
  function setFreeGestures(value) { cancelTap();freeGestures=!!value; }
  function setClickGuard(fn) { clickGuard=fn; }
  function onFocus(fn) { focusListeners.push(fn);return()=>{focusListeners=focusListeners.filter(f=>f!==fn)}; }
  function dispatchClick(root,meta,event,pick) {
    if(clickGuard && clickGuard(root,meta,event,pick)===false)return;
    clickListeners.forEach((fn) => fn(root, meta, event, pick));
  }
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
    rebuildTargets();
  }

  function unregisterInteractive(object3d) {
    registry.delete(object3d);
    object3d.traverse((n) => {
      if (n.isMesh) meshToRoot.delete(n);
    });
    if (hoveredRoot === object3d) setHovered(null);
    if (selectedRoot === object3d) setSelected(null);
    removeOutlines(object3d);
    rebuildTargets();
  }

  /** Metadatos (partId/kind/label) registrados para un root -- reusa lo que
   * ya llega via registerInteractive() en vez de duplicar el nombre de
   * cada pieza en otro lugar (mejora 3D: etiquetas del "Modo didactico"). */
  function getMeta(object3d) {
    return registry.get(object3d) || null;
  }

  function registerOccluder(object3d) {
    occluders.add(object3d); rebuildTargets();
  }

  function unregisterOccluder(object3d) {
    occluders.delete(object3d); rebuildTargets();
  }

  function clearInteractives() {
    cancelTap();
    setHovered(null); setSelected(null);
    for (const root of outlines.keys()) removeOutlines(root);
    registry.clear();
    meshToRoot.clear();
    occluders.clear();
    pickExpectation = null;
    rebuildTargets();
    setHovered(null);
    setSelected(null);
  }

  function findRoot(mesh) {
    return meshToRoot.get(mesh) || null;
  }

  function updatePointer(event) {
    pointerDirty = true;
    pointerClient = { clientX: event.clientX, clientY: event.clientY };
    const rect = el.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastRoot(ndc) {
    raycaster.setFromCamera(ndc || pointerNdc, camera);
    hits.length = 0;
    raycaster.intersectObjects(targets, true, hits);
    // In free orbit a proxy may protrude through another component. Respect
    // the first opaque visual surface; assistance samples nearby visible rays.
    if(freeGestures){
      for(const hit of hits){
        if(!hit.object.isMesh || isHitbox(hit.object))continue;
        const material=hit.object.material;
        if(material && !Array.isArray(material) && material.transparent && material.opacity===0)continue;
        let visible=true;for(let n=hit.object;n;n=n.parent)if(!n.visible){visible=false;break}
        if(!visible)continue;
        const visualRoot=findRoot(hit.object);
        if(visualRoot)return visualRoot;
        if(isUnderOccluder(hit.object))return null;
      }
      return null;
    }
    for (const hit of hits) {
      if (!hit.object.isMesh) continue;
      let shown = true; for(let n=isHitbox(hit.object)?hit.object.parent:hit.object;n;n=n.parent) if(!n.visible){shown=false;break}
      if(!shown)continue;
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
    const tolerance = laptopMode && pointerType === "touch" ? 24 : pickTolerancePx(pointerType);
    const near = [];
    if(!offsetCache.has(tolerance)) offsetCache.set(tolerance, ringOffsets(tolerance));
    for (const o of offsetCache.get(tolerance)) {
      const root = cast(clientX + o.dx, clientY + o.dy);
      if (root) near.push({ key: root, dist: o.dist });
    }
    // Objetivos DIMINUTOS (cierre prepublicacion, 2026-10-02): en un telefono
    // de 320 px un tornillo mide 3-4 px y se colaba entre los rayos del anillo
    // (medido con toque real: a 3, 6 y 14 px no lo encontraba, a 10 px si).
    // Para cada objetivo que el paso espera se mira ademas su CENTRO en
    // pantalla: si esta dentro del radio y a la vista, cuenta como candidato.
    if (expected) {
      const center = new THREE.Vector3();
      registry.forEach((meta, root) => {
        if (root === exact || !root.visible || !expected(root, exact)) return;
        root.getWorldPosition(center).project(camera);
        if (center.z > 1) return;
        const cx = rect.left + ((center.x + 1) / 2) * rect.width;
        const cy = rect.top + ((1 - center.y) / 2) * rect.height;
        const dist = Math.hypot(cx - clientX, cy - clientY);
        if (dist > tolerance) return;
        // A la vista: lo primero que hay bajo su centro es el propio objetivo.
        if (cast(Math.round(cx), Math.round(cy)) === root) near.push({ key: root, dist });
      });
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
    let edges;
    if(laptopMode){
      const p=geo.parameters, positions=[];
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
        const corner=[x*p.width/2,y*p.height/2,z*p.depth/2];
        for(let axis=0;axis<3;axis++){const end=corner.slice();end[axis]*=.64;positions.push(...corner,...end)}
      }
      edges=new THREE.BufferGeometry();edges.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    }else edges = new THREE.EdgesGeometry(geo);
    geo.dispose();
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 1.5 }));
    line.position.copy(center);
    line.name = "hwlab-outline";
    line.renderOrder = 999;
    return line;
  }

  function setHovered(root) {
    if (hoveredRoot === root) return;
    if (hoveredRoot) {
      detachOutline(hoveredRoot, "hwlab-outline-hover");
      if (!laptopMode && hoveredRoot !== selectedRoot) {
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
      const outline = outlineFor(hoveredRoot, "hover", laptopMode ? STATE_COLORS.hover : ACCENT.highlight);
      outline.name = "hwlab-outline-hover";
      hoveredRoot.add(outline);
      if (!laptopMode && hoveredRoot !== selectedRoot) {
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

  function setSelected(root, state = "selected") {
    if (selectedRoot === root) { setSelectionState(state); return; }
    if (selectedRoot) {
      detachOutline(selectedRoot, "hwlab-outline-select");
      if (!laptopMode) clearSelectGlow(selectedRoot);
      if (!laptopMode && selectedRoot !== hoveredRoot) {
        animateObject3D(tweenGroup, selectedRoot, { scale: new THREE.Vector3(1, 1, 1), duration: 0.18, targetKey: hoverScaleKey(selectedRoot) });
      }
    }
    selectedRoot = root;
    if (selectedRoot) {
      const outline = outlineFor(selectedRoot, "select", laptopMode ? STATE_COLORS[state] : ACCENT.select);
      outline.name = "hwlab-outline-select";
      selectedRoot.add(outline);
      // Intensidad baja a proposito (item 5: "emissive SUAVE"): debe leerse
      // como una pieza "encendida/activa", no como una luz propia que
      // compita con la iluminacion real de la escena.
      if (!laptopMode) setSelectGlow(selectedRoot, ACCENT.select, 0.35);
      else setSelectionState(state);
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
    if(freeGestures && downPos && Math.hypot(event.clientX-downPos.x,event.clientY-downPos.y)>CLICK_MOVE_THRESHOLD){dragged=true;cancelTap();}
    if (!enabled) return;
    notePointerType(event);
    updatePointer(event);
  }

  function onPointerDown(event) {
    if (laptopMode && (!enabled || (event.button != null && event.button !== 0))) {
      if(freeGestures){cancelTap();downPos=null;}
      return;
    }
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) { multiTouch = true; if(freeGestures)cancelTap(); }
    dragged=false;
    notePointerType(event);
    downPos = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event) {
    activePointers.delete(event.pointerId);
    if (laptopMode && multiTouch) { downPos=null; if (!activePointers.size) multiTouch=false; return; }
    if (!enabled || !downPos) return;
    const dx = event.clientX - downPos.x;
    const dy = event.clientY - downPos.y;
    downPos = null;
    if ((freeGestures && dragged) || Math.hypot(dx, dy) > CLICK_MOVE_THRESHOLD) return; // fue arrastre de camara, no clic
    updatePointer(event);
    const pick = pickAt(event.clientX, event.clientY, event.pointerType || "mouse");
    const root = pick.root;
    setSelected(root, event.pointerType === "touch" ? "touch" : "selected");
    const meta = root ? registry.get(root) : null;
    if (!freeGestures) { dispatchClick(root,meta,event,pick); return; }
    const now=performance.now();
    if(pendingTap && pendingTap.root===root && now-pendingTap.at<300 && Math.hypot(event.clientX-pendingTap.x,event.clientY-pendingTap.y)<24){
      cancelTap();if(root)focusListeners.forEach(fn=>fn(root,meta,event));return;
    }
    cancelTap();pendingTap={root,at:now,x:event.clientX,y:event.clientY};
    tapTimer=setTimeout(()=>{pendingTap=null;tapTimer=null;dispatchClick(root,meta,event,pick)},300);
  }

  el.addEventListener("pointermove", onPointerMove, { passive: true });
  el.addEventListener("pointerdown", onPointerDown, { passive: true });
  el.addEventListener("pointerup", onPointerUp, { passive: true });
  const onLeave = event => {
    // Touch emits leave AFTER up even for a stationary tap. Keep that tap;
    // cancel only an unfinished drag leaving the canvas.
    if (activePointers.has(event.pointerId) && freeGestures) cancelTap();
    activePointers.delete(event.pointerId);
    if (!activePointers.size) { multiTouch=false; downPos=null; }
    pointerClient=null;pointerNdc.set(2,2);pointerDirty=true;setHovered(null);
  };
  const onCancel = event => { if(freeGestures)cancelTap();activePointers.delete(event.pointerId); if(!activePointers.size)multiTouch=false; downPos=null; };
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("pointercancel", onCancel);
  const onWheel = () => { if(freeGestures){dragged=true;cancelTap();} };
  el.addEventListener("wheel", onWheel, {passive:true});

  const offTick = onTick(() => {
    if (!enabled || !registry.size || lastPointerType !== "mouse") return;
    if(laptopMode){
      const animating = !!tweenGroup.activeCount;
      let changed = pointerDirty || animating || wasAnimating;
      wasAnimating = animating;
      const matrix=camera.matrixWorld.elements;
      for(let i=0;i<16;i++)if(matrix[i]!==lastCamera[i]){changed=true;lastCamera[i]=matrix[i]}
      const projection = camera.projectionMatrix.elements;
      for (let i = 0; i < 16; i++) if (projection[i] !== lastProjection[i]) {
        changed = true; lastProjection[i] = projection[i];
      }
      const rect = el.getBoundingClientRect();
      if (!lastRect || rect.left !== lastRect.left || rect.top !== lastRect.top || rect.width !== lastRect.width || rect.height !== lastRect.height) {
        lastRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
        if (pointerClient) updatePointer(pointerClient);
        changed = true;
      }
      if(!changed)return;pointerDirty=false;
    }
    const root = raycastRoot();
    setHovered(root);
  });

  function setEnabled(value) {
    enabled = value; pointerDirty=true;
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
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("pointercancel", onCancel);
    el.removeEventListener("wheel", onWheel);
    clearInteractives();
    hoverListeners=[];clickListeners=[];focusListeners=[];clickGuard=null;
  }

  return {
    setLaptopMode,
    setFreeGestures,
    cancelPendingTap: cancelTap,
    setClickGuard,
    onFocus,
    setSelectionState,
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
