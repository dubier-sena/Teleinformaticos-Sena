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
  // PCFSoftShadowMap esta deprecado en la version vendorizada (0.185.1):
  // WebGLShadowMap lo detecta y hace fallback SILENCIOSO a PCFShadowMap (mas
  // duro, sin el difuminado que el codigo ya pedia via shadow.radius) --
  // solo un warning en consola, ninguna excepcion, facil de pasar por alto.
  // VSMShadowMap es el reemplazo soportado para sombras suaves.
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  buildLighting(scene);
  buildEnvironment(scene);
  const envRenderTarget = buildEnvironmentLighting(renderer, scene);

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
    if (envRenderTarget) envRenderTarget.dispose();
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

/**
 * Genera un mapa de entorno (PMREM) sencillo, sin depender de una imagen HDR
 * externa (el proyecto no usa CDN/bundler, ver CLAUDE.md), y lo asigna a
 * `scene.environment`. Los materiales metalicos de la paleta (metalDark,
 * aluminum, heatsinkFin...) tienen metalness alto: sin un entorno que
 * reflejar, su color casi no depende de la luz difusa y se ven negros salvo
 * en el punto exacto donde cae un reflejo especular directo de una luz. Esto
 * NO cambia el fondo visible de la escena (`scene.background` sigue siendo
 * el mismo oscuro): solo aporta reflejos/luz ambiental a los materiales PBR.
 * Costo: una sola pasada offline al crear la escena, no por frame (item 26).
 */
function buildEnvironmentLighting(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();

  const envScene = new THREE.Scene();

  // MeshBasicMaterial (no depende de luces): esta escena auxiliar no tiene
  // ninguna luz propia, asi que un material "lit" (MeshStandardMaterial) se
  // veria negro sin importar su color -- justo el bug que dejaba el "cielo"
  // reflejado casi todo negro salvo por los paneles brillantes de abajo.
  // OJO: Three.js interpreta el hex como sRGB y lo convierte a lineal para
  // el sombreado -- un gris "moderado" a simple vista (p.ej. 0x3a4452) queda
  // MUY oscuro en lineal (aprox. valor^2.2) y el reflejo resultante en un
  // metal (que ademas atenua por su propio tinte F0) se ve casi negro. Por
  // eso la base del "cielo" debe ser notablemente mas clara de lo que
  // parece necesario con solo mirar el numero hex.
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(14, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xd7dde3, side: THREE.BackSide })
  );
  envScene.add(room);

  function lightPanel(color, intensity, w, h, x, y, z, rotX, rotY) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) })
    );
    mesh.position.set(x, y, z);
    if (rotX) mesh.rotation.x = rotX;
    if (rotY) mesh.rotation.y = rotY;
    envScene.add(mesh);
  }

  // Panel superior calido: simula la luz de techo de un taller.
  lightPanel(0xfff2df, 5.2, 9, 9, 0, 6.9, 0, Math.PI / 2, 0);
  // Panel lateral frio: coincide con la luz de relleno real de la escena.
  // Bajado de 3.2 (auditoria visual de mejora 3D): con los 4 paneles
  // originales, el balance de color de TODA la escena (no solo del acento
  // cian) quedaba dominado por tonos frios/azules -- la mesa (deberia verse
  // gris-verde oscuro mate) se veia como un vidrio celeste brillante, y
  // colores calidos de la paleta (dorado de los pines, cobre del heatpipe,
  // PCB verde) perdian saturacion contra ese fondo frio. Reducir este panel
  // Y el de acento cian de abajo deja que el panel calido superior domine el
  // ambiente reflejado, como corresponde a luz de taller/oficina interior.
  lightPanel(0x8fb4ff, 2.1, 7, 7, -6.9, 1.2, 0, 0, Math.PI / 2);
  // Panel de acento cian: coincide con la luz de borde real (estetica "lab").
  // Bajado de 3.6 -- sigue dando el toque "lab tecnico" en los bordes/metal
  // sin tenir de cian toda superficie con algo de rugosidad.
  lightPanel(0x35d0ff, 2.1, 5, 5, 2.5, 2.2, -6.9, 0, 0);
  // Panel frontal: evita que la cara que mira a la camara quede sin nada brillante que reflejar.
  lightPanel(0xc3ccd6, 2.4, 6, 6, 0, 1.5, 6.9, 0, Math.PI);

  const renderTarget = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  scene.environment = renderTarget.texture;
  return renderTarget;
}

function buildLighting(scene) {
  // Three.js r155+ usa un modelo de iluminacion fisicamente correcto (lumens/
  // candela reales, no las "intensidades" arbitrarias de versiones viejas):
  // los valores originales aqui (hemi 0.65, key 1.45, fill 0.35, rim 0.55)
  // databan de ese modelo antiguo y quedaban casi imperceptibles con el
  // renderer actual -- el gabinete se veia como una silueta negra sobre
  // fondo negro. Los valores de abajo estan recalibrados para ese modelo
  // (referencia: luz de estudio/oficina interior, no luz solar directa).
  const hemi = new THREE.HemisphereLight(0x6b8299, 0x23272c, 2.4);
  scene.add(hemi);

  // Luz principal (item 19): calida, con sombra suave, encuadra la mesa.
  const key = new THREE.DirectionalLight(0xfff2df, 5.5);
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
  // Bajada de 2.2 a 1.5 (auditoria visual de mejora 3D): junto con el
  // acento cian de abajo, el balance global quedaba demasiado frio/azul --
  // opacaba el dorado/cobre/PCB verde de la paleta de materiales.
  const fill = new THREE.DirectionalLight(0x8fb4ff, 1.5);
  fill.position.set(-2.5, 1.6, -1.2);
  scene.add(fill);

  // Tercera luz, casi cenital, suave: evita que la cara superior de piezas
  // metalicas (la que mas mira hacia la camara en la vista "General") quede
  // sin ninguna luz directa entre key y fill.
  const top = new THREE.DirectionalLight(0xd8e6ff, 1.6);
  top.position.set(-0.3, 4, 0.6);
  scene.add(top);

  // Acento cian trasero: separa el equipo del fondo (estetica "lab tecnico").
  // PointLight usa candela (cae con el cuadrado de la distancia): necesita un
  // valor mucho mayor que una DirectionalLight para notarse a ~1.5-2m.
  // Bajado de 18 a 11 (auditoria visual de mejora 3D): a 18 tenia demasiado
  // alcance -- teñia de cian superficies neutras lejos del equipo (mesa,
  // piso) en vez de quedarse como un simple acento de borde/fondo.
  const rim = new THREE.PointLight(0x35d0ff, 11, 8, 2);
  rim.position.set(-0.4, 1.7, -1.4);
  scene.add(rim);

  return { hemi, key, fill, top, rim };
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
  // Auditoria visual de mejora 3D: con 0x1c2b2e el pixel renderizado real
  // (medido, no estimado) salia RGB(~117,153,160) -- un cian claro y
  // brillante, muy lejos del "tablero oscuro mate" que el hex sugiere. La
  // combinacion ACES+exposicion 1.15 (necesaria para que el EQUIPO se vea
  // bien, no se toca) levanta mucho los tonos oscuros con algo de tinte
  // azul/verde. Se compensa con un color base bastante mas oscuro y neutro
  // (menos verde/azul) para que el resultado FINAL en pantalla sea el
  // oscuro mate esperado.
  const topMat = new THREE.MeshStandardMaterial({ color: 0x080c0d, roughness: 0.65, metalness: 0.05 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = TABLE.topY - TABLE.topThickness / 2;
  top.castShadow = false;
  top.receiveShadow = true;
  table.add(top);

  // Tapete antiestatico: una franja mas clara y con leve rejilla encima del tablero.
  const matGeo = new THREE.PlaneGeometry(TABLE.width * 0.94, TABLE.depth * 0.9);
  // Mismo ajuste que topMat de arriba, y por la misma razon medida con
  // muestreo de pixel real.
  const matMat = new THREE.MeshStandardMaterial({ color: 0x061214, roughness: 0.9, metalness: 0.02 });
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
