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
  // El portatil se abre por ABAJO (tapa inferior, ver caseGatePartId en
  // hardware_lab_data_laptop.js) -- ninguna vista existente (todas con Y
  // positiva respecto al centro) llega a mostrarla ni a la bandeja de
  // "recorded piezas" de abajo: encontrado al intentar completar el
  // desensamble guiado con clic real, ni siquiera el paso 1 (retirar tapa
  // inferior) era alcanzable. "Sticky": una vez fijado por equipo (ver
  // hardware_lab_3d_stage.js), se conserva aunque otras llamadas a
  // setRigBounds no lo repitan (p.ej. el reencuadre de modo Aprender).
  let viewFromBelow = false;

  function setRigBounds(center, radius, opts) {
    rigCenter = center.clone();
    rigRadius = Math.max(0.08, radius);
    if (opts && opts.viewFromBelow != null) {
      viewFromBelow = !!opts.viewFromBelow;
      // OrbitControls vuelve a acomodar (clampear) el angulo polar de la
      // camara en CADA tick contra maxPolarAngle, sin importar si la
      // posicion vino de un arrastre del usuario o de un flyTo() directo
      // (ver goToView): con el limite original (0.495*PI, nunca por debajo
      // del nivel del objetivo) la vista "internal" de abajo se
      // "correjia" sola de vuelta arriba un frame despues de terminar el
      // vuelo. Se relaja solo para el portatil (ver hardware_lab_3d_stage.js);
      // el escritorio conserva el limite original sin cambios.
      controls.maxPolarAngle = viewFromBelow ? Math.PI * 0.97 : Math.PI * 0.495;
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
          const belowY = TABLE.topY + 0.05;
          const belowTarget = new THREE.Vector3(c.x, belowY + 0.02, c.z);
          return { pos: new THREE.Vector3(c.x - r * 0.9, belowY, c.z - r * 0.95), target: belowTarget };
        }
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
    // Evita que la camara termine por debajo del tablero al enfocar piezas bajas.
    pos.y = Math.max(pos.y, sphere.center.y + sphere.radius * 0.35);
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

  return {
    controls,
    setRigBounds,
    goToView,
    focusOnObject,
    focusOnObjects,
    flyTo,
    isFlying,
    setFreeLook,
    dispose,
  };
}
