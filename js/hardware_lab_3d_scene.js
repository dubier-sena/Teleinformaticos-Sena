/* js/hardware_lab_3d_scene.js
 *
 * Escena WebGL real (item 29) del Laboratorio Virtual de Hardware: crea el
 * renderer, la escena, las luces y el entorno de mesa de trabajo. No sabe
 * nada de "computador" ni de piezas: eso lo agregan hardware_lab_3d_rig.js y
 * los factories. Expone un pequeno bus de "tick" para que camara, tweens e
 * interacciones se enganchen al loop de render sin acoplarse entre si.
 */
import * as THREE from "./vendor/three.module.min.js";
import { TABLE } from "./hardware_lab_3d_constants.js";

export function createLabScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d12);
  scene.fog = new THREE.FogExp2(0x0a0d12, 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  camera.position.set(0.9, 1.85, 2.35);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (_e) {
    return { supported: false };
  }
  if (!renderer) return { supported: false };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  buildLighting(scene);
  buildEnvironment(scene);

  // ── Bus de tick: cada modulo (camara, tweens, interacciones) se suscribe. ─
  const tickCallbacks = new Set();
  function onTick(fn) {
    tickCallbacks.add(fn);
    return () => tickCallbacks.delete(fn);
  }

  const clock = new THREE.Clock();
  let running = true;

  renderer.setAnimationLoop(() => {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05); // clamp: evita saltos tras pestana inactiva
    tickCallbacks.forEach((fn) => fn(dt));
    renderer.render(scene, camera);
  });

  // ── Resize: el canvas ocupa su contenedor (item 21), no la ventana. ───────
  const container = canvas.parentElement;
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function setPaused(paused) {
    running = !paused;
    if (!paused) clock.getDelta(); // descarta el tiempo acumulado mientras estaba pausado
  }

  function dispose() {
    running = false;
    resizeObserver.disconnect();
    renderer.setAnimationLoop(null);
    scene.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
  }

  return {
    supported: true,
    scene,
    camera,
    renderer,
    onTick,
    resize,
    setPaused,
    dispose,
  };
}

function buildLighting(scene) {
  const hemi = new THREE.HemisphereLight(0x4a5b6b, 0x0a0a0c, 0.65);
  scene.add(hemi);

  // Luz principal (item 19): calida, con sombra suave, encuadra la mesa.
  const key = new THREE.DirectionalLight(0xfff2df, 1.45);
  key.position.set(2.2, 3.4, 1.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 8;
  key.shadow.camera.left = -1.8;
  key.shadow.camera.right = 1.8;
  key.shadow.camera.top = 1.8;
  key.shadow.camera.bottom = -1.8;
  key.shadow.bias = -0.0018;
  key.shadow.radius = 3;
  scene.add(key);

  // Luz secundaria fria, sin sombra (barata) para rellenar el lado opuesto.
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.35);
  fill.position.set(-2.5, 1.6, -1.2);
  scene.add(fill);

  // Acento cian trasero: separa el equipo del fondo (estetica "lab tecnico").
  const rim = new THREE.PointLight(0x35d0ff, 0.55, 6, 2);
  rim.position.set(-0.4, 1.7, -1.4);
  scene.add(rim);

  return { hemi, key, fill, rim };
}

function buildEnvironment(scene) {
  const group = new THREE.Group();
  group.name = "lab-environment";

  // Piso tecnico oscuro con leve rejilla (referencia de profundidad, item 20).
  const floorGeo = new THREE.PlaneGeometry(14, 14);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0f14, roughness: 0.95, metalness: 0.05 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const grid = new THREE.GridHelper(14, 28, 0x1c2733, 0x131a22);
  grid.position.y = 0.002;
  group.add(grid);

  // Mesa de trabajo antiestatica (item 1 y 9).
  const table = new THREE.Group();
  table.name = "workbench";

  const topGeo = new THREE.BoxGeometry(TABLE.width, TABLE.topThickness, TABLE.depth);
  const topMat = new THREE.MeshStandardMaterial({ color: 0x1c2b2e, roughness: 0.55, metalness: 0.1 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = TABLE.topY - TABLE.topThickness / 2;
  top.castShadow = false;
  top.receiveShadow = true;
  table.add(top);

  // Tapete antiestatico: una franja mas clara y con leve rejilla encima del tablero.
  const matGeo = new THREE.PlaneGeometry(TABLE.width * 0.94, TABLE.depth * 0.9);
  const matMat = new THREE.MeshStandardMaterial({ color: 0x123033, roughness: 0.8, metalness: 0.02 });
  const mat = new THREE.Mesh(matGeo, matMat);
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = TABLE.topY + 0.001;
  mat.receiveShadow = true;
  table.add(mat);

  const legGeo = new THREE.CylinderGeometry(0.035, 0.045, TABLE.legHeight, 12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.4, metalness: 0.7 });
  const legOffsets = [
    [-TABLE.width / 2 + 0.12, -TABLE.depth / 2 + 0.12],
    [TABLE.width / 2 - 0.12, -TABLE.depth / 2 + 0.12],
    [-TABLE.width / 2 + 0.12, TABLE.depth / 2 - 0.12],
    [TABLE.width / 2 - 0.12, TABLE.depth / 2 - 0.12],
  ];
  legOffsets.forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, TABLE.legHeight / 2, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    table.add(leg);
  });

  group.add(table);

  // Panel de fondo discreto (item 1: "fondo tecnico discreto").
  const backdropGeo = new THREE.PlaneGeometry(9, 4);
  const backdropMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 1, metalness: 0 });
  const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
  backdrop.position.set(0, 2, -1.55);
  backdrop.receiveShadow = true;
  group.add(backdrop);

  scene.add(group);
  return group;
}
