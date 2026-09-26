"use strict";
// La camara nunca baja de la mesa (sep-26).
//
// Medido antes de corregir, con arrastre REAL en el navegador: el
// maxPolarAngle fijo del portatil (0.97*PI) dejaba orbitar bajo el tablero y,
// con zoom out, llegar a y = -5.5 m (0 % del portatil visible) en General y en
// las cuatro posiciones tecnicas. Aqui se usa el OrbitControls REAL
// (rotateUp / rotateLeft / dollyIn / dollyOut, el mismo camino que los
// gestos del mouse) sobre el rig real del portatil, y se exige en TODO momento
// camera.position.y >= CAMERA_MIN_WORLD_Y (mesa + tapete + 20 mm).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let THREE, TABLE, Cam, createRig, createLaptopLayout, TweenGroup;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  ({ TABLE } = await import(U("js/hardware_lab_3d_constants.js")));
  Cam = await import(U("js/hardware_lab_3d_camera.js"));
  ({ createRig } = await import(U("js/hardware_lab_3d_rig.js")));
  ({ createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js")));
  ({ TweenGroup } = await import(U("js/hardware_lab_3d_tween.js")));
});

const TOL = 1e-6;

function fakeDom() {
  const noop = () => {};
  const el = { style: {}, addEventListener: noop, removeEventListener: noop, setPointerCapture: noop, releasePointerCapture: noop, clientWidth: 1200, clientHeight: 800, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }) };
  el.ownerDocument = { addEventListener: noop, removeEventListener: noop };
  el.getRootNode = () => el.ownerDocument;
  return el;
}

/** Camara como la del laboratorio: FOV 42, bucle de ticks manual. */
function setup({ laptop = true } = {}) {
  const camera = new THREE.PerspectiveCamera(42, 1.5, 0.05, 60);
  camera.position.set(0.9, 1.85, 2.35);
  const ticks = [];
  const tg = new TweenGroup();
  const cam = Cam.createCameraRig({ camera, renderer: { domElement: fakeDom() }, tweenGroup: tg, onTick: (fn) => { ticks.push(fn); return () => {}; } });
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { tg.update(1 / 60); ticks.forEach((fn) => fn(1 / 60)); } };
  let rig = null, scene = null;
  if (laptop) {
    scene = new THREE.Scene();
    rig = createRig({ scene, interactions: null, tweenGroup: null, layout: createLaptopLayout(), equipmentId: "laptop" });
    scene.updateMatrixWorld(true);
  }
  const refresh = () => {
    const s = rig.getBoundsWorld({ installedOnly: true });
    const box = rig.getBoundsBoxWorld();
    cam.setRigBounds(s.center, s.radius, { viewFromBelow: true, height: box.max.y - box.min.y });
  };
  if (rig) refresh();
  const work = (name) => { rig.setPose(rig.presetPose(name), { animate: false }); refresh(); cam.frameWork(rig.workFocusBox(name), rig.workViewDir(name), { duration: 0 }); tick(2); };
  const general = () => { refresh(); cam.goToView("overview", { duration: 0 }); tick(2); };
  return { camera, cam, controls: cam.controls, tick, rig, work, general, refresh };
}

/** Gesto exagerado: arrastrar "hacia arriba" (la camara baja) muchas veces,
 *  comprobando la altura DESPUES DE CADA LLAMADA del control (no solo por tick). */
function forceDown(env, steps = 60, sideways = 0) {
  let minY = Infinity;
  for (let i = 0; i < steps; i++) {
    env.controls.rotateUp(-0.12);
    if (sideways) env.controls.rotateLeft(sideways);
    minY = Math.min(minY, env.camera.position.y);
    env.tick();
    minY = Math.min(minY, env.camera.position.y);
  }
  return minY;
}
function zoom(env, out, steps = 60) {
  let minY = Infinity;
  for (let i = 0; i < steps; i++) {
    // Misma convencion que la rueda del mouse en OrbitControls: escala < 1.
    if (out) env.controls.dollyOut(0.8); else env.controls.dollyIn(0.8);
    minY = Math.min(minY, env.camera.position.y);
    env.tick();
    minY = Math.min(minY, env.camera.position.y);
  }
  return minY;
}
const above = (y, label) => assert.ok(y >= Cam.CAMERA_MIN_WORLD_Y - TOL, `${label}: la camara bajo a y=${y.toFixed(4)} (minimo ${Cam.CAMERA_MIN_WORLD_Y.toFixed(3)})`);

test("C00. limite derivado de la geometria: mesa (tapete) + 20 mm, y formula del angulo polar", () => {
  assert.equal(Cam.CAMERA_TABLE_MARGIN, 0.02);
  assert.ok(Math.abs(Cam.CAMERA_MIN_WORLD_Y - (TABLE.topY + 0.001 + 0.02)) < 1e-12);
  // y = ty + d*cos(phi) con phi en el limite cae EXACTAMENTE en el minimo.
  for (const [ty, d] of [[1.05, 0.8], [0.96, 6.5], [0.9, 0.2], [0.79, 0.5]]) {
    const phi = Cam.polarLimitForMinY(ty, d);
    assert.ok(Math.abs(ty + d * Math.cos(phi) - Cam.CAMERA_MIN_WORLD_Y) < 1e-9 || phi === Math.PI || phi === 0);
  }
});

for (const [id, name] of [["C01", "general"], ["C02", "bottom"], ["C03", "internal"], ["C04", "keyboard"], ["C05", "display"]]) {
  test(`${id}. ${name.toUpperCase()}: la orbita extrema no baja la camara de la mesa`, () => {
    const env = setup();
    if (name === "general") env.general(); else env.work(name);
    above(forceDown(env), id);
    // y la orbita sigue funcionando: la camara se movio realmente
    assert.ok(env.camera.position.y < 1.2, `${id}: la orbita quedo bloqueada`);
  });
}

test("C06. zoom out maximo despues de intentar bajar la camara", () => {
  const env = setup(); env.work("keyboard");
  forceDown(env);
  above(zoom(env, true), "C06");
  const d = env.camera.position.distanceTo(env.controls.target);
  assert.ok(d > 5, `C06: el zoom out quedo bloqueado (distancia ${d.toFixed(2)})`);
});

test("C07. zoom in maximo despues de intentar bajar la camara", () => {
  const env = setup(); env.work("internal");
  forceDown(env);
  above(zoom(env, false), "C07");
  const d = env.camera.position.distanceTo(env.controls.target);
  assert.ok(d <= env.controls.minDistance + 1e-6 + 0.02, "C07: el zoom in no llego al minimo");
});

test("C08. orbita lateral completa pegada al limite: sin bajar, sin temblar y viendo la parte trasera", () => {
  const env = setup(); env.work("display");
  forceDown(env);
  let minY = Infinity, sawBack = false;
  for (let i = 0; i < 120; i++) { env.controls.rotateUp(-0.05); env.controls.rotateLeft((2 * Math.PI) / 120); env.tick(); minY = Math.min(minY, env.camera.position.y); if (env.camera.position.z < env.controls.target.z - 0.2) sawBack = true; }
  above(minY, "C08");
  assert.ok(sawBack, "C08: la orbita no permitio ver la parte posterior");
  // Se deja asentar la inercia (damping) y se exige: altura que nunca rebota
  // por debajo del limite ni oscila, y reposo total despues.
  let prevY = env.camera.position.y, dirChanges = 0, lastSign = 0;
  for (let i = 0; i < 200; i++) {
    env.tick();
    const y = env.camera.position.y;
    above(y, "C08 asentando");
    const d = y - prevY;
    const sign = Math.abs(d) < 1e-9 ? 0 : Math.sign(d);
    if (sign && lastSign && sign !== lastSign) dirChanges++;
    if (sign) lastSign = sign;
    prevY = y;
  }
  assert.ok(dirChanges <= 1, `C08: la altura oscilo ${dirChanges} veces en el limite (temblor/rebote)`);
  const q = env.camera.position.clone();
  env.tick(10);
  assert.ok(env.camera.position.distanceTo(q) < 1e-6, "C08: vibracion en reposo");
});

test("C09. portatil volteado + orbita extrema", () => {
  const env = setup(); env.work("bottom");
  assert.equal(env.rig.getPose().flipped, true);
  above(Math.min(forceDown(env, 60, 0.07), zoom(env, true)), "C09");
});

test("C10. portatil girado + orbita extrema", () => {
  const env = setup();
  env.rig.setPose({ yaw: Math.PI / 2 }, { animate: false }); env.general();
  above(Math.min(forceDown(env, 60, -0.05), zoom(env, true)), "C10");
});

test("C11. mover portatil -> Vista de trabajo -> orbita extrema", () => {
  const env = setup();
  env.rig.setPose({ yaw: -Math.PI / 2, flipped: true }, { animate: false }); env.general();
  env.work("internal");
  assert.ok(env.rig.isAtPreset("internal"));
  above(Math.min(forceDown(env), zoom(env, true), zoom(env, false)), "C11");
});

test("C12. General -> orbita extrema -> Vista de trabajo recupera el encuadre", () => {
  const env = setup(); env.general();
  above(Math.min(forceDown(env), zoom(env, true)), "C12");
  env.work("keyboard");
  above(env.camera.position.y, "C12 despues de Vista de trabajo");
  const box = env.rig.workFocusBox("keyboard");
  const c = box.getCenter(new THREE.Vector3());
  assert.ok(env.controls.target.distanceTo(c) < 0.05, "C12: Vista de trabajo no recupero el objetivo del teclado");
});

test("C13. la vista Interna desde abajo (equipo derecho) sigue siendo posible y queda sobre el limite", () => {
  const env = setup(); env.work("keyboard");
  env.cam.goToView("internal", { duration: 0 }); env.tick(3);
  above(env.camera.position.y, "C13");
  assert.ok(env.camera.position.y < env.rig.root.position.y, "C13: la vista Interna ya no mira desde abajo");
});

test("C14. escritorio: su limite de siempre (0.495*PI) no cambia en uso normal", () => {
  const env = setup({ laptop: false });
  env.cam.setRigBounds(new THREE.Vector3(-0.15, 0.99, 0.05), 0.33, { viewFromBelow: false });
  env.cam.goToView("overview", { duration: 0 }); env.tick(3);
  for (let i = 0; i < 60; i++) { env.controls.rotateUp(-0.12); env.tick(); }
  const off = env.camera.position.clone().sub(env.controls.target);
  const phi = Math.acos(off.y / off.length());
  assert.ok(Math.abs(phi - Math.PI * 0.495) < 1e-3, `C14: el escritorio tope polar cambio (${((phi * 180) / Math.PI).toFixed(2)} grados)`);
  above(Math.min(env.camera.position.y, zoom(env, true)), "C14");
});
