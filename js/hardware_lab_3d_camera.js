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
import { TABLE } from "./hardware_lab_3d_constants.js";

// ── Limite fisico inferior de la camara (sep-26) ────────────────────────────
// Medido: con el maxPolarAngle FIJO del portatil (0.97*PI, pensado para la
// vista "desde abajo") la orbita manual llevaba la camara bajo la mesa y, con
// zoom out, hasta y = -5.5 m (6.3 m bajo el tablero, 0 % del equipo visible).
// La superficie real es el tapete de hardware_lab_3d_scene.js (TABLE.topY +
// 1 mm); la camara nunca baja de ella + 20 mm.
export const CAMERA_TABLE_MARGIN = 0.02;
export const CAMERA_MIN_WORLD_Y = TABLE.topY + 0.001 + CAMERA_TABLE_MARGIN;

/** Angulo polar maximo (desde +Y) que mantiene la camara a una altura >= minY
 *  para un objetivo a `targetY` y una distancia `distance`:
 *  y = targetY + distance * cos(phi) >= minY  =>  phi <= acos((minY - targetY) / distance). */
export function polarLimitForMinY(targetY, distance, minY = CAMERA_MIN_WORLD_Y) {
  if (!(distance > 1e-9)) return Math.PI;
  const c = (minY - targetY) / distance;
  if (c <= -1) return Math.PI;
  if (c >= 1) return 0;
  return Math.acos(c);
}

/** Si la camara quedo bajo minY, la lleva a minY conservando su distancia al
 *  objetivo y su acimut (sin saltos: solo corrige lo que se paso). Devuelve
 *  true si corrigio. */
export function clampCameraAboveY(position, target, minY = CAMERA_MIN_WORLD_Y) {
  if (position.y >= minY - 1e-9) return false;
  const r = position.distanceTo(target);
  const dy = minY - target.y;
  if (r > Math.abs(dy)) {
    const hx = position.x - target.x;
    const hz = position.z - target.z;
    const hLen = Math.hypot(hx, hz);
    const h = Math.sqrt(r * r - dy * dy);
    const ux = hLen > 1e-9 ? hx / hLen : 0;
    const uz = hLen > 1e-9 ? hz / hLen : 1;
    position.set(target.x + ux * h, minY, target.z + uz * h);
  } else {
    // Objetivo muy por debajo del limite (desplazado a mano): justo encima.
    position.set(target.x, minY, target.z);
  }
  return true;
}

export function createCameraRig({ camera, renderer, tweenGroup, onTick }) {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 0.18;
  controls.maxDistance = 6.5;
  controls.maxPolarAngle = Math.PI * 0.495;
  // Limite polar "de diseño" de cada equipo (0.495*PI escritorio, 0.97*PI
  // portatil). El efectivo en cada cuadro es el menor entre este y el que
  // impone la mesa (ver polarLimitForMinY).
  let basePolarMax = controls.maxPolarAngle;
  controls.target.set(0, 0.95, 0);
  controls.update();

  let rigCenter = new THREE.Vector3(0, 0.95, 0);
  let rigRadius = 0.5;
  // Alto real del equipo (caja de mundo). Con el portatil VOLTEADO el equipo
  // es una losa de 38 mm: las vistas Frontal/Lateral/Posterior, casi rasantes
  // (unos 6 grados), lo veian de canto -- medido: 0 % de la imagen.
  let rigHeight = null;
  let flightActive = false;
  // El portatil se abre por ABAJO (tapa inferior, ver caseGatePartId en
  // hardware_lab_data_laptop.js) -- ninguna vista existente (todas con Y
  // positiva respecto al centro) llega a mostrarla ni a la bandeja de
  // "recorded piezas" de abajo: encontrado al intentar completar el
  // desensamble guiado con clic real, ni siquiera el paso 1 (retirar tapa
  // inferior) era alcanzable. "Sticky": una vez fijado por equipo (ver
  // hardware_lab_3d_stage.js), se conserva aunque otras llamadas a
  // setRigBounds no lo repitan (p.ej. el reencuadre de modo Aprender).
  let viewFromBelow = false;
  // Punto al que mira la vista "Interna" desde abajo: el centro de la BASE del
  // portatil (no el de todo el equipo, que la pantalla abierta sube mucho).
  // Lo fija hardware_lab_3d_stage.js al cargar el equipo; sticky como el flag.
  let belowTarget = null;
  // Encuadre de la vista "Interna" cuando el equipo sigue CERRADO por abajo
  // (ver setBelowFrameProvider): devuelve el radio de lo que hay que encuadrar
  // (la tapa inferior completa) o null si ya esta abierto.
  let belowFrameProvider = null;
  // Posiciones tecnicas (sep-26): el portatil puede estar VOLTEADO, con su
  // interior mirando hacia arriba. Quien sabe como esta el equipo (el stage)
  // responde { up, box, dir }: si `up`, la vista "Interna" encuadra el
  // interior desde arriba; si no, sigue la vista desde abajo de siempre, con
  // `belowTarget` (centro de la base) recalculado segun la pose actual.
  let interiorProvider = null;

  function setRigBounds(center, radius, opts) {
    rigCenter = center.clone();
    rigRadius = Math.max(0.08, radius);
    rigHeight = opts && opts.height != null ? opts.height : null;
    if (opts && opts.belowTarget) belowTarget = opts.belowTarget.clone();
    if (opts && opts.viewFromBelow != null) {
      viewFromBelow = !!opts.viewFromBelow;
      if (!viewFromBelow) belowTarget = null;
      // OrbitControls vuelve a acomodar (clampear) el angulo polar de la
      // camara en CADA tick contra maxPolarAngle, sin importar si la
      // posicion vino de un arrastre del usuario o de un flyTo() directo
      // (ver goToView): con el limite original (0.495*PI, nunca por debajo
      // del nivel del objetivo) la vista "internal" de abajo se
      // "correjia" sola de vuelta arriba un frame despues de terminar el
      // vuelo. Se relaja solo para el portatil (ver hardware_lab_3d_stage.js);
      // el escritorio conserva el limite original sin cambios.
      basePolarMax = viewFromBelow ? Math.PI * 0.97 : Math.PI * 0.495;
      controls.maxPolarAngle = basePolarMax;
    }
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

  /** Limite de la mesa ANTES de que OrbitControls aplique la orbita. */
  function applyTableLimit() {
    const distance = camera.position.distanceTo(controls.target);
    controls.maxPolarAngle = Math.min(basePolarMax, polarLimitForMinY(controls.target.y, distance));
  }
  // Los manejadores de OrbitControls llaman a update() tambien fuera del
  // tick; el limite queda fijado para esas llamadas.
  controls.addEventListener("change", () => {
    if (clampCameraAboveY(camera.position, controls.target)) camera.lookAt(controls.target);
  });

  const offTick = onTick(() => {
    applyTableLimit();
    controls.update();
    // Respaldo: OrbitControls limita phi ANTES de aplicar el zoom (el radio se
    // multiplica despues), asi que alejar con la camara en el limite podia
    // dejarla por debajo. Se corrige conservando distancia y acimut.
    if (clampCameraAboveY(camera.position, controls.target)) camera.lookAt(controls.target);
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
    // Elevacion de las vistas laterales: la de siempre (0.32r) salvo que el
    // equipo sea una losa (alto menor que medio radio), que se ve de arriba en
    // angulo (~19 grados) para que ocupe cuadro.
    const sideLift = rigHeight != null && rigHeight < r * 0.5 ? r * 1.1 : r * 0.32;
    switch (name) {
      case "front":
        // Distancia subida de 2.1 a 3.2 (mejora visual, auditoria con clic
        // real): a 2.1r el equipo de escritorio (angosto y alto: 0.205 x
        // 0.44 x 0.41) llenaba el cuadro de borde a borde, recortado arriba
        // y abajo -- "overview" ya usaba ~3.2r de distancia total y ese si
        // se veia bien encuadrado, asi que se empareja esa misma escala para
        // front/side/back en vez de inventar un numero nuevo sin referencia.
        return { pos: new THREE.Vector3(c.x, c.y + sideLift, c.z + r * 3.2), target: c };
      case "side":
        // Lado NEGATIVO de X (mejora visual, auditoria con clic real): la
        // bandeja de piezas retiradas (ZONES.trayOrigin, hardware_lab_3d_
        // constants.js) vive del lado +X del equipo -- con la camara
        // tambien en +X, cualquier pieza ya retirada (p.ej. la propia tapa
        // lateral, que arranca "afuera" en el modo Aprender) quedaba
        // exactamente en la linea de vision, tapando el gabinete casi por
        // completo. Mirando desde -X se evita esa colision sin tocar la
        // posicion de la bandeja ni ningun otro preset.
        return { pos: new THREE.Vector3(c.x - r * 3.2, c.y + (sideLift === r * 0.32 ? r * 0.28 : sideLift), c.z), target: c };
      case "top":
        return { pos: new THREE.Vector3(c.x + 0.001, c.y + r * 2.6, c.z + 0.15), target: c };
      case "back":
        return { pos: new THREE.Vector3(c.x, c.y + sideLift, c.z - r * 3.2), target: c };
      case "internal":
        if (interiorProvider) {
          const info = interiorProvider();
          if (info && info.up && info.box && !info.box.isEmpty()) return workFrame(info.box, info.dir);
          if (info && info.belowTarget) belowTarget = info.belowTarget.clone();
        }
        if (viewFromBelow) {
          // Mira hacia arriba desde debajo del equipo -- el unico angulo
          // desde el que la tapa inferior (y lo que hay detras) es visible.
          // OJO: la Y NO puede derivarse de rigRadius como las demas vistas
          // -- el portatil descansa muy cerca de la mesa (ver
          // LAPTOP_SERVICE_RISER_HEIGHT en hardware_lab_3d_rig.js), y un
          // offset proporcional al radio del equipo terminaba atravesando
          // el tablero (la camara quedaba mirando la pata de la mesa por
          // debajo, confirmado con una captura real). Se ancla directo a
          // la altura de la mesa + un margen fijo pequeno, nunca por debajo.
          // Offset en -X/-Z (no +X/+Z): la bandeja de piezas retiradas
          // (ZONES.trayOrigin, hardware_lab_3d_constants.js) esta del lado
          // +X/+Z del equipo. Con la camara mirando desde ESE mismo lado,
          // cada pieza recien retirada (p.ej. la propia tapa inferior) caia
          // justo en la linea de vision hacia el resto de piezas -- se
          // confirmo con clic real: bottom-cover, ya en su bandeja, tapaba
          // cable-battery. Mirando desde el lado opuesto, la bandeja queda
          // detras de la camara en vez de en medio.
          // El objetivo NO puede derivarse de c.y/r (centro/radio de TODO el
          // equipo, incluida la pantalla inclinada, que lo empuja muy
          // arriba): eso apuntaba la camara al nivel del TECLADO en vez de
          // al de los componentes recien expuestos (bateria, RAM..., todos
          // muy cerca del piso de la base) -- confirmado con clic real, el
          // teclado (aun instalado en este punto de la secuencia) tapaba
          // todo lo demas. Se ancla a un offset fijo y pequeno sobre la
          // camara, al nivel real de esos componentes.
          // Fase 3: con la geometria nueva los componentes cuelgan de la
          // placa hacia la tapa inferior; la vista debe MIRAR HACIA ARRIBA al
          // interior con un angulo claro (~27 grados), no rasante: a 0.05 m
          // de la mesa y ~0.33 m de distancia horizontal (antes) la pared
          // del chasis tapaba casi todo. Se usa el centro de la base
          // (belowTarget, fijado por el stage) y se baja la camara hasta
          // casi la mesa.
          if (belowTarget) {
            const camY = TABLE.topY + 0.022;
            const rise = Math.max(0.05, belowTarget.y - camY);
            // ENCUADRE ADAPTATIVO (ver setBelowFrameProvider). Quien llama
            // (el stage) dice QUE hay que ver desde abajo en este momento: la
            // tapa inferior completa mientras siga puesta, o la pieza del paso
            // actual una vez abierto. Medido con clic real antes de esto:
            //   - con la tapa puesta, 3 de los 5 tornillos caian FUERA del
            //     frustum (|NDC| hasta 1.5);
            //   - ya abierto, el tornillo trasero izquierdo de la placa base
            //     quedaba en NDC -1.31.
            // Ninguno de los dos se podia clickear sin orbitar a mano.
            // El angulo de ~27 grados se conserva SIEMPRE que alcance: solo se
            // abre (camara mas lejos, vista mas rasante) cuando lo que hay que
            // encuadrar no cabe -- y no puede caber de otra forma, porque la
            // camara no baja de la mesa y el equipo esta a 160 mm de ella.
            // ~27 grados: suficiente para ver el interior sin que las paredes
            // lo tapen, y lejos para encuadrar toda la cara inferior (330 mm).
            let horiz = rise / Math.tan(THREE.MathUtils.degToRad(27));
            const frameRadius = belowFrameProvider ? belowFrameProvider() : null;
            if (frameRadius > 0) {
              const need = (frameRadius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.12;
              horiz = Math.max(horiz, Math.sqrt(Math.max(need * need - rise * rise, 1e-4)));
            }
            const pos = new THREE.Vector3(belowTarget.x - horiz * 0.62, camY, belowTarget.z + horiz * 0.78);
            return { pos, target: belowTarget.clone() };
          }
          const belowY = TABLE.topY + 0.05;
          const belowTargetFallback = new THREE.Vector3(c.x, belowY + 0.02, c.z);
          return { pos: new THREE.Vector3(c.x - r * 0.9, belowY, c.z - r * 0.95), target: belowTargetFallback };
        }
        return { pos: new THREE.Vector3(c.x + r * 1.1, c.y + r * 0.85, c.z + r * 1.35), target: c };
      case "overview":
      default:
        return { pos: new THREE.Vector3(c.x + r * 1.5, c.y + r * 1.15, c.z + r * 2.6), target: c };
    }
  }

  /** Encuadre de trabajo: la caja completa, vista desde `dir` (mundo), con la
   *  camara siempre por encima del tablero. */
  function workFrame(box, dir) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const d = dir.clone().normalize();
    // Margen: el cuadro vertical es el mas estrecho; se usa el FOV vertical y
    // un 25 % de aire para que lo encuadrado no toque los bordes (medido en
    // las capturas de teclado y pantalla, que con 10 % quedaban al ras).
    const dist = Math.max(0.24, (Math.max(sphere.radius, 0.02) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.25);
    const pos = sphere.center.clone().addScaledVector(d, dist);
    pos.y = Math.max(pos.y, TABLE.topY + 0.05);
    return { pos, target: sphere.center.clone() };
  }

  function frameWork(box, dir, opts) {
    if (!box || box.isEmpty()) return;
    const f = workFrame(box, dir);
    flyTo(f.pos, f.target, opts);
  }

  function goToView(name, opts) {
    const preset = viewPreset(name);
    flyTo(preset.pos, preset.target, opts);
  }

  function flyToBox(box, opts = {}) {
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Nota (mejora 3D): se intento cambiar esta direccion a "radial hacia
    // afuera desde el centro del equipo" (mismo criterio que
    // hardware_lab_3d_explode.js), pensado para el caso de la GPU (pegada a
    // una pared lateral, encuadre pobre si nunca se roto la vista antes).
    // Se revirtio: probado con clic real, mejoraba ese caso puntual pero
    // rompia el preset "Refrigeracion" (grupo cooler+cable-cpu-fan, ya
    // verificado y funcionando bien) -- terminaba con la camara adentro del
    // gabinete, mirando una pared de muy cerca. Sin una forma barata de
    // detectar oclusion real contra la geometria, ninguna heuristica simple
    // funciona para TODOS los casos por igual; se prefiere no arriesgar un
    // preset que ya funcionaba bien por mejorar uno que no era el foco
    // pedido (la GPU no tiene boton de enfoque propio).
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
    dir.normalize();
    const distance = Math.max(0.22, sphere.radius * (opts.distanceFactor || 3.4));
    const pos = sphere.center.clone().addScaledVector(dir, distance);
    // Portatil visto desde abajo (fase 3): sus piezas internas solo se ven
    // por la cara inferior. Si la camara ya esta por debajo de la pieza, se
    // conserva ABAJO en vez de subirla por encima (donde el reposamanos y la
    // placa la tapan). Solo aplica con viewFromBelow (portatil).
    const interiorUp = interiorProvider ? !!(interiorProvider() || {}).up : false;
    const keepBelow = viewFromBelow && !interiorUp && dir.y < 0;
    if (keepBelow) {
      pos.y = Math.min(pos.y, sphere.center.y - sphere.radius * 0.35);
    } else {
      // Evita que la camara termine por debajo del tablero al enfocar piezas bajas.
      pos.y = Math.max(pos.y, sphere.center.y + sphere.radius * 0.35);
    }
    // Evita que la camara quede DENTRO del volumen del equipo (mejora 3D,
    // encontrado con clic real): los botones de "Enfoque rapido" para grupos
    // pequenos cercanos a una pared externa (Almacenamiento, Energia) usan un
    // distanceFactor ajustado (ver renderFocusButtons en hardware_lab_3d_stage.js)
    // que, visto desde el angulo "Lateral", colocaba la camara mas cerca del
    // grupo que la propia tapa lateral -- atravesandola, con el resultado de
    // quedar pegada a la cara interna de la tapa (aunque el equipo este cerrado)
    // en vez de mostrar la pieza enfocada. Si el punto calculado cae dentro de
    // la esfera envolvente completa del equipo, se empuja hacia afuera en la
    // misma direccion, sin tocar el objetivo ni el encuadre de las vistas que
    // ya funcionaban bien (quedan fuera de la esfera y no se modifican).
    const minDistFromRig = rigRadius * 1.05;
    const outFromRig = new THREE.Vector3().subVectors(pos, rigCenter);
    if (outFromRig.lengthSq() < minDistFromRig * minDistFromRig) {
      if (outFromRig.lengthSq() < 1e-6) outFromRig.copy(dir);
      outFromRig.normalize();
      pos.copy(rigCenter).addScaledVector(outFromRig, minDistFromRig);
    }
    // Nunca por debajo del tablero (la camara del portatil puede quedar bajo
    // el equipo, pero no atravesar la mesa).
    if (viewFromBelow) pos.y = Math.max(pos.y, TABLE.topY + 0.025);
    flyTo(pos, sphere.center, opts);
  }

  /** Acerca la camara suavemente a un objeto especifico (item 5: RAM, CPU, discos...). */
  function focusOnObject(object3d, opts = {}) {
    flyToBox(new THREE.Box3().setFromObject(object3d), opts);
  }

  /**
   * Igual que focusOnObject, pero para un GRUPO de piezas relacionadas
   * (mejora 3D, item 8: presets "Placa base"/"Almacenamiento"/
   * "Refrigeracion"/"Energia"): encuadra la union de todas, no una sola.
   * Ignora silenciosamente cualquier objeto ausente (p.ej. una pieza ya
   * retirada a la bandeja en este momento de la practica -- igual se
   * encuadra, solo que en su posicion actual dentro de la bandeja).
   */
  function focusOnObjects(objects3d, opts = {}) {
    const box = new THREE.Box3();
    let any = false;
    (objects3d || []).forEach((obj) => {
      if (!obj) return;
      const objBox = new THREE.Box3().setFromObject(obj);
      if (objBox.isEmpty()) return;
      any = true;
      box.union(objBox);
    });
    if (!any) return;
    flyToBox(box, opts);
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

  /** Quien llama (el stage) decide QUE hay que encuadrar cuando se mira desde
   * abajo: devuelve el radio de la tapa inferior mientras siga instalada, o
   * null cuando ya se retiro (ahi manda el encuadre cerrado del interior). */
  function setBelowFrameProvider(fn) {
    belowFrameProvider = typeof fn === "function" ? fn : null;
  }

  function setInteriorProvider(fn) {
    interiorProvider = typeof fn === "function" ? fn : null;
  }

  return {
    controls,
    setRigBounds,
    setBelowFrameProvider,
    setInteriorProvider,
    frameWork,
    workFrame,
    goToView,
    focusOnObject,
    focusOnObjects,
    flyTo,
    isFlying,
    setFreeLook,
    dispose,
  };
}
