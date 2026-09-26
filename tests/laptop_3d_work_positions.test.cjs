"use strict";
// Posiciones TECNICAS del portatil 3D (sep-26).
//
// El portatil ya no se atiende siempre derecho y "desde abajo": se cierra, se
// voltea y se abre segun el componente, con UN solo root (sin duplicar
// geometria) y trayectorias en coordenadas LOCALES del equipo. Aqui se mide,
// sin navegador y con la geometria y los tweens reales:
//   W  poses, transiciones, mesa y soporte
//   B  tapa inferior (WORK_BOTTOM)
//   K  teclado (WORK_KEYBOARD)
//   P  pantalla (WORK_DISPLAY)
// Los angulos tecnicos salen de una medicion (ver LAPTOP_LID_KEYBOARD_ANGLE en
// hardware_lab_3d_laptop_factory.js); aqui se fija que sigan cumpliendo lo
// que justifico elegirlos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, TABLE, createRig, createLaptopLayout, TweenGroup, LF, Screws, HL, EQ;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  ({ TABLE } = await import(U("js/hardware_lab_3d_constants.js")));
  ({ createRig } = await import(U("js/hardware_lab_3d_rig.js")));
  ({ createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js")));
  ({ TweenGroup } = await import(U("js/hardware_lab_3d_tween.js")));
  LF = await import(U("js/hardware_lab_3d_laptop_factory.js"));
  Screws = await import(U("js/hardware_lab_3d_screws.js"));
  const sandbox = { window: {}, console: { warn() {}, error() {}, info() {} } };
  vm.createContext(sandbox);
  ["hardware_lab_tools.js", "hardware_lab_data_laptop.js", "hardware_lab_engine.js"].forEach((f) =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox)
  );
  HL = sandbox.window.HardwareLab;
  EQ = HL.DataLaptop.LAPTOP_EQUIPMENT;
});

function build(tweenGroup = null) {
  const scene = new THREE.Scene();
  const rig = createRig({ scene, interactions: null, tweenGroup, layout: createLaptopLayout(), equipmentId: "laptop" });
  scene.updateMatrixWorld(true);
  return { rig, scene };
}
const allParts = (rig, v) => Object.fromEntries(rig.partIds.map((id) => [id, v]));
function withRemoved(rig, ids) {
  const st = allParts(rig, true);
  ids.forEach((id) => { st[id] = false; });
  rig.syncFromSessionParts(st);
  return st;
}
function runTweens(tg, done, max = 900, each) {
  for (let i = 0; i < max && !done(); i++) { tg.update(1 / 60); if (each) each(); }
  assert.ok(done(), "la animacion no termino");
}
function setPoseNow(rig, name) {
  assert.ok(rig.setPose(rig.presetPose(name), { animate: false }), "setPose rechazado: " + name);
  rig.root.updateMatrixWorld(true);
}
function animatePose(rig, tg, target, each) {
  let done = false;
  assert.ok(rig.setPose(target, { onDone: () => { done = true; } }));
  runTweens(tg, () => done, 900, each);
}
const PRE_KEYBOARD = ["bottom-cover", "cable-battery", "battery", "ram", "ssd-m2", "cable-cpu-fan-laptop", "cooler", "cpu",
  "wifi-antenna-1", "wifi-antenna-2", "wifi-card", "cable-keyboard-flex"];
const PRE_DISPLAY = PRE_KEYBOARD.concat(["keyboard", "cable-touchpad-flex", "touchpad", "cable-screen-flex"]);

// ── OBB por malla (mismo criterio que laptop_3d_tray / service_access) ──────
function ownerOf(rig, obj) {
  let n = obj;
  while (n && n.parent !== rig.root) n = n.parent;
  if (!n) return null;
  return n.userData.partId || (n.name === "laptop-base" ? "base" : n.name);
}
function obbsOf(rootObj, ownerFn, filter) {
  rootObj.updateMatrixWorld(true);
  const out = [];
  rootObj.traverse((n) => {
    if (!n.isMesh) return;
    const mat = n.material;
    if (!mat || (mat.transparent && mat.opacity === 0) || (mat.isMeshBasicMaterial && mat.blending === THREE.AdditiveBlending)) return;
    if (n.geometry.type === "TubeGeometry" || n.name === "cable-ribbon") return;
    const owner = ownerFn(n);
    if (!filter(owner, n)) return;
    const geo = n.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    const hs = geo.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const mats = [];
    if (n.isInstancedMesh) {
      for (let i = 0; i < n.count; i++) { const m = new THREE.Matrix4(); n.getMatrixAt(i, m); mats.push(n.matrixWorld.clone().multiply(m)); }
    } else mats.push(n.matrixWorld);
    mats.forEach((mw) => {
      const e = mw.elements;
      const raw = [new THREE.Vector3(e[0], e[1], e[2]), new THREE.Vector3(e[4], e[5], e[6]), new THREE.Vector3(e[8], e[9], e[10])];
      const len = raw.map((a) => a.length());
      const o = {
        owner, name: n.name, cylinder: !n.isInstancedMesh && geo.type === "CylinderGeometry",
        center: c.clone().applyMatrix4(mw), axes: raw.map((a, i) => a.clone().divideScalar(len[i] || 1)),
        half: [hs.x * len[0], hs.y * len[1], hs.z * len[2]],
      };
      const ext = new THREE.Vector3();
      for (let k = 0; k < 3; k++) {
        ext.x += Math.abs(o.axes[k].x) * o.half[k];
        ext.y += Math.abs(o.axes[k].y) * o.half[k];
        ext.z += Math.abs(o.axes[k].z) * o.half[k];
      }
      o.aabb = new THREE.Box3(o.center.clone().sub(ext), o.center.clone().add(ext));
      out.push(o);
    });
  });
  return out;
}
const obbs = (rig, filter) => obbsOf(rig.root, (n) => ownerOf(rig, n), filter);
function satAxes(A, B) {
  const axes = [...A.axes, ...B.axes];
  for (const a of A.axes) for (const b of B.axes) { const c = a.clone().cross(b); if (c.lengthSq() > 1e-10) axes.push(c.normalize()); }
  return axes;
}
const radius = (O, L) => O.half[0] * Math.abs(O.axes[0].dot(L)) + O.half[1] * Math.abs(O.axes[1].dot(L)) + O.half[2] * Math.abs(O.axes[2].dot(L));
function depth(A, B) {
  const d = B.center.clone().sub(A.center);
  let min = Infinity;
  for (const L of satAxes(A, B)) {
    const ov = radius(A, L) + radius(B, L) - Math.abs(d.dot(L));
    if (ov <= 0) return 0;
    min = Math.min(min, ov);
  }
  for (const [C, O] of [[A, B], [B, A]]) {
    if (!C.cylinder) continue;
    const q = O.center.clone();
    const dd = C.center.clone().sub(O.center);
    for (let k = 0; k < 3; k++) q.addScaledVector(O.axes[k], Math.max(-O.half[k], Math.min(O.half[k], dd.dot(O.axes[k]))));
    const rel = q.sub(C.center);
    const radial = rel.clone().sub(C.axes[1].clone().multiplyScalar(rel.dot(C.axes[1]))).length();
    min = Math.min(min, Math.max(C.half[0], C.half[2]) - radial);
  }
  return min;
}
/** Separacion (cota inferior de la distancia) entre OBB; negativa = contacto. */
function satGap(A, B) {
  const d = B.center.clone().sub(A.center);
  let best = -Infinity;
  for (const L of satAxes(A, B)) best = Math.max(best, Math.abs(d.dot(L)) - radius(A, L) - radius(B, L));
  return best;
}
function worstDepth(listA, listB) {
  let w = 0, who = "";
  listA.forEach((m) => listB.forEach((o) => {
    if (!m.aabb.intersectsBox(o.aabb)) return;
    const d = depth(m, o);
    if (d > w) { w = d; who = `${m.owner}:${m.name} / ${o.owner}:${o.name}`; }
  }));
  return { w, who };
}
// Nudillos coaxiales de tapa y base: contacto deslizante POR DISEÑO.
const isKnuckle = (o) => o.cylinder && Math.abs(o.half[1] * 2 - LF.LAPTOP.hinge.length / 2) < 1e-4;

// Camara de trabajo: mismo calculo que camera.workFrame (FOV 42, 25 % de aire).
function workCamera(rig, name) {
  const box = rig.workFocusBox(name);
  const s = box.getBoundingSphere(new THREE.Sphere());
  const dist = Math.max(0.24, (Math.max(s.radius, 0.02) / Math.sin(THREE.MathUtils.degToRad(21))) * 1.25);
  const pos = s.center.clone().addScaledVector(rig.workViewDir(name), dist);
  pos.y = Math.max(pos.y, TABLE.topY + 0.05);
  const cam = new THREE.PerspectiveCamera(42, 1.4, 0.05, 60);
  cam.position.copy(pos);
  cam.lookAt(s.center);
  cam.updateMatrixWorld(true);
  return cam;
}
/** Lo que el clic ve: piezas del equipo y tornillos (como interactions). */
function pickables(rig) {
  const out = [];
  [rig.root, rig.screwGroup].forEach((g) => g && g.traverse((n) => { if (n.isMesh && n.name !== "screw-pending-ring") out.push(n); }));
  return out;
}
const under = (n, root) => { for (let o = n; o; o = o.parent) if (o === root) return true; return false; };
/** Primer impacto del rayo camara -> punto: ¿es `target` (o un hijo)? */
function reaches(rig, cam, point, target) {
  const rc = new THREE.Raycaster();
  const d = point.clone().sub(cam.position);
  const L = d.length();
  rc.set(cam.position, d.normalize());
  rc.far = L + 0.003;
  const hit = rc.intersectObjects(pickables(rig), false)[0];
  return !!hit && under(hit.object, target);
}
function inFrustum(cam, p) {
  const v = p.clone().project(cam);
  return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
}
function screwEntry(rig, id) {
  return rig.screwEntries.find((e) => e.id === id);
}
function screwHeadWorld(rig, id) {
  const e = screwEntry(rig, id);
  rig.screwGroup.updateMatrixWorld(true);
  return rig.screwGroup.localToWorld(e.homePosition.clone().addScaledVector(e.outDir, Screws.SCREW_SIZE.headH * 0.6));
}
const standOf = (scene) => scene.getObjectByName("laptop-service-stand");
function standPenetration(rig, scene) {
  const stand = obbsOf(standOf(scene), () => "stand", () => true);
  return worstDepth(obbs(rig, () => true), stand);
}

// ══════════════════════════════════════════════════════════════════════════
// W — poses, transiciones y mesa
// ══════════════════════════════════════════════════════════════════════════

test("W01. un solo root: las posiciones cambian su transformacion, no duplican geometria", () => {
  const { rig, scene } = build();
  const count = () => { let n = 0; scene.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const n0 = count();
  const ids = ["open", "closed", "bottom", "internal", "keyboard", "display"];
  ids.forEach((name) => assert.ok(rig.presetPose(name), "falta la posicion " + name));
  const locals = Object.fromEntries(rig.partIds.map((id) => [id, rig.getObject3D(id).position.clone()]));
  ids.forEach((name) => {
    setPoseNow(rig, name);
    assert.equal(count(), n0, `${name}: cambio la cantidad de mallas`);
    rig.partIds.filter((id) => id !== "screen-assembly").forEach((id) => {
      assert.ok(rig.getObject3D(id).position.distanceTo(locals[id]) < 1e-12, `${name}: ${id} se movio dentro del equipo`);
    });
  });
});

test("W02. la tapa CIERRA sin atravesar teclado ni reposamanos (antes se hundia 10 mm)", () => {
  const { rig } = build();
  setPoseNow(rig, "closed");
  const lid = obbs(rig, (o) => o === "screen-assembly").filter((o) => !isKnuckle(o));
  const rest = obbs(rig, (o) => o === "base" || o === "keyboard" || o === "touchpad").filter((o) => !isKnuckle(o));
  const r = worstDepth(lid, rest);
  assert.ok(r.w < 1e-4, `tapa cerrada atraviesa ${(r.w * 1000).toFixed(2)} mm (${r.who})`);
  // El CUERPO de la tapa (lo que queda sobre el teclado; los brazos estan en
  // la bisagra) libra las teclas.
  const body = new THREE.Box3().setFromObject(rig.getObject3D("screen-assembly").getObjectByName("laptop-lid-body"));
  const kbBox = new THREE.Box3().setFromObject(rig.getObject3D("keyboard"));
  assert.ok(body.min.y >= kbBox.max.y + 0.0003, "la cara de la tapa cerrada no libra el teclado");
});

test("W03. ida y vuelta por todas las posiciones: vuelve EXACTAMENTE a la pose inicial aprobada", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  const p0 = rig.root.position.clone(), q0 = rig.root.quaternion.clone();
  const lid0 = rig.getObject3D("screen-assembly").quaternion.clone();
  ["bottom", "keyboard", "display", "internal", "open"].forEach((name) => animatePose(rig, tg, rig.presetPose(name)));
  assert.ok(rig.isAtPreset("open"));
  assert.ok(rig.root.position.distanceTo(p0) < 1e-9, "posicion final distinta");
  assert.ok(Math.abs(rig.root.quaternion.dot(q0)) > 1 - 1e-12, "orientacion final distinta");
  assert.ok(Math.abs(rig.getObject3D("screen-assembly").quaternion.dot(lid0)) > 1 - 1e-12, "angulo de pantalla final distinto");
});

test("W04. volteado queda APOYADO en las repisas del soporte (0.3 mm), sin atravesarlo", () => {
  const { rig, scene } = build();
  setPoseNow(rig, "bottom");
  const box = new THREE.Box3().setFromObject(rig.root);
  const gap = box.min.y - rig.standOrigin.y;
  assert.ok(gap > 0 && gap < 0.0006, `apoyo a ${(gap * 1000).toFixed(2)} mm de las repisas`);
  const r = standPenetration(rig, scene);
  assert.ok(r.w < 1e-4, `atraviesa el soporte ${(r.w * 1000).toFixed(2)} mm (${r.who})`);
  const bottomUp = new THREE.Vector3(0, -1, 0).applyQuaternion(rig.root.quaternion);
  assert.ok(bottomUp.y > 0.999, "la cara inferior no quedo hacia arriba");
});

test("W05. transiciones animadas: nunca atraviesan mesa ni soporte; bandeja y tornillos guardados no se mueven", () => {
  const tg = new TweenGroup();
  const { rig, scene } = build(tg);
  withRemoved(rig, ["bottom-cover", "battery", "keyboard"]);
  const trayWorld = ["bottom-cover", "battery", "keyboard"].map((id) => rig.getObject3D(id).getWorldPosition(new THREE.Vector3()));
  const stand = obbsOf(standOf(scene), () => "stand", () => true);
  let worst = { w: 0 }, lowest = Infinity;
  const each = () => {
    rig.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.getObject3D("motherboard")).union(new THREE.Box3().setFromObject(rig.root.children[0]));
    lowest = Math.min(lowest, box.min.y);
    const r = worstDepth(obbs(rig, (o) => o === "base" || o === "screen-assembly" || o === "motherboard"), stand);
    if (r.w > worst.w) worst = r;
  };
  ["bottom", "keyboard", "display", "internal", "open"].forEach((name) => animatePose(rig, tg, rig.presetPose(name), each));
  assert.ok(worst.w < 1e-4, `una transicion atraviesa el soporte ${(worst.w * 1000).toFixed(2)} mm (${worst.who})`);
  assert.ok(lowest > TABLE.topY + 0.1, "el equipo bajo hasta la mesa durante una transicion");
  ["bottom-cover", "battery", "keyboard"].forEach((id, i) => {
    assert.ok(rig.getObject3D(id).getWorldPosition(new THREE.Vector3()).distanceTo(trayWorld[i]) < 1e-9, `${id} se movio en la bandeja`);
  });
});

test("W06. angulos tecnicos: dentro del tope mecanico y con la holgura que justifico elegirlos", () => {
  const { rig } = build();
  const lidCfg = rig.lidConfig;
  ["open", "keyboard", "display"].forEach((name) => {
    const a = rig.presetPose(name).lid;
    assert.ok(a <= lidCfg.closedAngle && a >= lidCfg.maxOpenAngle, `${name}: ${a} fuera del recorrido de la bisagra`);
  });
  assert.equal(rig.presetPose("keyboard").lid, LF.LAPTOP_LID_KEYBOARD_ANGLE);
  assert.equal(rig.presetPose("display").lid, LF.LAPTOP_LID_DISPLAY_ANGLE);
  // Holgura MONTADA del brazo de bisagra con la base: maxima (2.0 mm) a 90
  // grados; cae al abrir mas (tope medido ~112 grados).
  const armGap = (angle) => {
    const { rig: r } = build();
    r.setPose({ lid: angle }, { animate: false });
    let g = Infinity;
    const lid = obbs(r, (o) => o === "screen-assembly").filter((o) => !isKnuckle(o) && o.name !== "hinge-leaf");
    const base = obbs(r, (o) => o === "base").filter((o) => !isKnuckle(o));
    lid.forEach((a) => base.forEach((b) => { if (a.aabb.clone().expandByScalar(0.01).intersectsBox(b.aabb)) g = Math.min(g, satGap(a, b)); }));
    return g;
  };
  assert.ok(armGap(LF.LAPTOP_LID_DISPLAY_ANGLE) >= 0.0019, "la holgura a 90 grados bajo de lo medido");
  assert.ok(armGap(LF.LAPTOP_LID_MAX_OPEN_ANGLE) >= 0, "el tope mecanico ya no libra la base");
  assert.ok(armGap(-125 * Math.PI / 180) < 0, "abrir mas alla del tope deberia chocar (si no, el tope quedo desfasado)");
});

// ══════════════════════════════════════════════════════════════════════════
// B — tapa inferior
// ══════════════════════════════════════════════════════════════════════════

test("B01. WORK_BOTTOM: cerrado, boca abajo y con la tapa inferior encuadrada completa", () => {
  const { rig } = build();
  setPoseNow(rig, "bottom");
  const p = rig.getPose();
  assert.equal(p.flipped, true);
  assert.equal(p.lid, rig.lidConfig.closedAngle);
  const cam = workCamera(rig, "bottom");
  const cover = new THREE.Box3().setFromObject(rig.getObject3D("bottom-cover"));
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Vector3(i & 1 ? cover.max.x : cover.min.x, i & 2 ? cover.max.y : cover.min.y, i & 4 ? cover.max.z : cover.min.z);
    assert.ok(inFrustum(cam, c), "una esquina de la tapa queda fuera del cuadro");
  }
});

test("B02. los 5 tornillos de la tapa apuntan hacia arriba, estan en cuadro y el clic los alcanza", () => {
  const { rig } = build();
  setPoseNow(rig, "bottom");
  const cam = workCamera(rig, "bottom");
  rig.screwEntries.filter((e) => e.partId === "bottom-cover").forEach((e) => {
    const out = e.outDir.clone().applyQuaternion(rig.screwGroup.quaternion);
    assert.ok(out.y > 0.999, `${e.id} no sale hacia arriba`);
    const head = screwHeadWorld(rig, e.id);
    assert.ok(inFrustum(cam, head), `${e.id} fuera de cuadro`);
    assert.ok(reaches(rig, cam, head, e.object3d), `${e.id}: el clic no lo alcanza`);
  });
  assert.ok(rig.poseAllows("interior"));
  assert.equal(rig.workPresetFor("bottom-cover"), "bottom");
});

test("B03. la tapa sale HACIA ARRIBA (su eje local), sin atravesar el chasis, y llega a su sitio en la bandeja", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  setPoseNow(rig, "bottom");
  const obj = rig.getObject3D("bottom-cover");
  const home = obj.getWorldPosition(new THREE.Vector3());
  const others = obbs(rig, (o) => o !== "bottom-cover");
  let done = false, worst = { w: 0 }, firstDir = null;
  rig.setPresence("bottom-cover", false, { onSettled: () => { done = true; } });
  runTweens(tg, () => done, 600, () => {
    const p = obj.getWorldPosition(new THREE.Vector3());
    if (!firstDir && p.distanceTo(home) > 0.003) firstDir = p.clone().sub(home).normalize();
    if (p.distanceTo(home) < 0.004) return;
    const r = worstDepth(obbs(rig, (o) => o === "bottom-cover"), others);
    if (r.w > worst.w) worst = r;
  });
  assert.ok(firstDir && firstDir.y > 0.95, "la tapa no sale hacia arriba con el equipo volteado");
  assert.ok(worst.w < 0.0005, `atraviesa ${(worst.w * 1000).toFixed(1)} mm (${worst.who})`);
  const b = new THREE.Box3().setFromObject(obj);
  assert.ok(b.min.y - TABLE.topY >= 0 && b.min.y - TABLE.topY < 0.004, "la tapa no queda apoyada en la mesa");
});

test("B04. volteado, el destornillador no entra en la mesa ni en el equipo; los tornillos retirados quedan en la bandeja magnetica", () => {
  const { rig } = build();
  setPoseNow(rig, "bottom");
  const tg = new TweenGroup();
  const ctl = Screws.createScrewController({
    group: rig.screwGroup, entries: rig.screwEntries, tweenGroup: tg,
    dishOrigin: rig.screwDishOrigin, dishWorldOrigin: rig.screwDishWorldOrigin, floorY: TABLE.topY,
    canOperatePart: () => ({ ok: true }), onChanged: () => {}, notify: () => {}, onBusyChange: () => {},
  });
  // Estado inicial SIN mover nada: los tornillos ya estan en su sitio.
  rig.screwEntries.forEach((e) => { e.object3d.position.copy(e.homePosition); });
  const dishWorld = rig.screwDishOrigin.clone().add(rig.standOrigin);
  let minDriverY = Infinity;
  assert.equal(ctl.handleScrewClick("cover-1").ok, true);
  for (let i = 0; i < 200; i++) {
    tg.update(0.05);
    if (ctl.driver.visible) { rig.screwGroup.updateMatrixWorld(true); minDriverY = Math.min(minDriverY, new THREE.Box3().setFromObject(ctl.driver).min.y); }
  }
  assert.equal(ctl.get("cover-1").installed, false);
  assert.ok(minDriverY > rig.standOrigin.y, "el destornillador bajo por debajo del apoyo del equipo");
  const w = ctl.get("cover-1").object3d.getWorldPosition(new THREE.Vector3());
  assert.ok(w.distanceTo(dishWorld) < 0.05, "el tornillo retirado no quedo en la bandeja magnetica de la mesa");
  // Otra vuelta de pose: el tornillo guardado sigue en la mesa.
  rig.setPose(rig.presetPose("open"), { animate: false });
  ctl.refreshStowed();
  rig.screwGroup.updateMatrixWorld(true);
  assert.ok(ctl.get("cover-1").object3d.getWorldPosition(new THREE.Vector3()).distanceTo(w) < 1e-9, "el tornillo guardado se movio con el portatil");
});

// ══════════════════════════════════════════════════════════════════════════
// K — teclado
// ══════════════════════════════════════════════════════════════════════════

test("K01-K03. WORK_KEYBOARD existe: equipo derecho y pantalla en su angulo tecnico reproducible", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  assert.ok(rig.presetPose("keyboard"), "K01: falta WORK_KEYBOARD");
  animatePose(rig, tg, rig.presetPose("bottom"));
  animatePose(rig, tg, rig.presetPose("keyboard"));
  assert.ok(Math.abs(rig.root.quaternion.w) > 1 - 1e-12, "K02: el equipo no quedo derecho");
  const lidQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), LF.LAPTOP_LID_KEYBOARD_ANGLE);
  assert.ok(Math.abs(rig.getObject3D("screen-assembly").quaternion.dot(lidQ)) > 1 - 1e-12, "K03: angulo de pantalla distinto del tecnico");
  assert.notEqual(LF.LAPTOP_LID_KEYBOARD_ANGLE, LF.LAPTOP_LID_OPEN_ANGLE, "K03: no debe ser el angulo de la vista General");
});

test("K04/K12. desde WORK_KEYBOARD el teclado se ve completo y el clic lo alcanza en toda su superficie", () => {
  const { rig } = build();
  withRemoved(rig, PRE_KEYBOARD);
  setPoseNow(rig, "keyboard");
  const cam = workCamera(rig, "keyboard");
  const kb = rig.getObject3D("keyboard");
  const b = new THREE.Box3().setFromObject(kb);
  let ok = 0, n = 0;
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 4; j++) {
    const p = new THREE.Vector3(b.min.x + 0.004 + (b.max.x - b.min.x - 0.008) * (i / 10), b.max.y - 0.0002, b.min.z + 0.003 + (b.max.z - b.min.z - 0.006) * (j / 4));
    n++;
    assert.ok(inFrustum(cam, p), "K04: parte del teclado fuera de cuadro");
    if (reaches(rig, cam, p, kb)) ok++;
  }
  assert.ok(ok / n >= 0.95, `K12: el clic solo alcanza el ${Math.round((100 * ok) / n)} % del teclado`);
});

test("K05/K06. fijaciones del teclado: se operan desde el interior, en cuadro, y siguen coaxiales con sus bosses en toda pose", () => {
  const { rig } = build();
  withRemoved(rig, PRE_KEYBOARD);
  const kb = rig.getObject3D("keyboard");
  const rel = {};
  ["open", "internal", "keyboard", "display"].forEach((name) => {
    setPoseNow(rig, name);
    ["keyboard-1", "keyboard-2"].forEach((id) => {
      // Posicion del tornillo en el marco del TECLADO: constante = coaxial.
      const local = kb.worldToLocal(screwHeadWorld(rig, id));
      if (!rel[id]) rel[id] = local;
      assert.ok(local.distanceTo(rel[id]) < 1e-9, `K06: ${id} se desalineo del teclado en ${name}`);
    });
  });
  assert.equal(rig.screwAccess("keyboard-1"), "interior");
  setPoseNow(rig, "internal");
  const cam = workCamera(rig, "internal");
  ["keyboard-1", "keyboard-2"].forEach((id) => {
    const head = screwHeadWorld(rig, id);
    assert.ok(inFrustum(cam, head), `K05: ${id} fuera del cuadro interior`);
    assert.ok(reaches(rig, cam, head, screwEntry(rig, id).object3d), `K05: el clic no alcanza ${id}`);
  });
});

test("K07/K08/K10. el teclado sale por arriba sin tocar pantalla ni chasis y llega a su sitio de bandeja (aun con el equipo girado)", () => {
  for (const yaw of [0, Math.PI / 2]) {
    const tg = new TweenGroup();
    const { rig } = build(tg);
    const trayWorld = (() => {
      const { rig: ref } = build();
      withRemoved(ref, PRE_KEYBOARD.concat(["keyboard"]));
      return ref.getObject3D("keyboard").getWorldPosition(new THREE.Vector3());
    })();
    withRemoved(rig, PRE_KEYBOARD);
    rig.setPose(Object.assign(rig.presetPose("keyboard"), { yaw }), { animate: false });
    const kb = rig.getObject3D("keyboard");
    const home = kb.position.clone();
    const lidObbs = obbs(rig, (o) => o === "screen-assembly");
    const chassis = obbs(rig, (o) => o === "base" || o === "touchpad" || o === "motherboard");
    let done = false, wLid = { w: 0 }, wChassis = { w: 0 };
    rig.setPresence("keyboard", false, { onSettled: () => { done = true; } });
    runTweens(tg, () => done, 600, () => {
      if (kb.position.distanceTo(home) < 0.004) return;
      const mine = obbs(rig, (o) => o === "keyboard");
      const a = worstDepth(mine, lidObbs); if (a.w > wLid.w) wLid = a;
      const c = worstDepth(mine, chassis); if (c.w > wChassis.w) wChassis = c;
    });
    assert.ok(wLid.w < 1e-4, `K07 (yaw ${yaw}): atraviesa la pantalla ${(wLid.w * 1000).toFixed(1)} mm`);
    assert.ok(wChassis.w < 0.0005, `K08 (yaw ${yaw}): atraviesa el chasis ${(wChassis.w * 1000).toFixed(1)} mm (${wChassis.who})`);
    assert.ok(kb.getWorldPosition(new THREE.Vector3()).distanceTo(trayWorld) < 1e-9, `K10 (yaw ${yaw}): no llego a su sitio de bandeja`);
  }
});

test("K09. flex del teclado: se desconecta antes (el motor lo exige) y su cinta sigue unida a sus conectores en toda pose", () => {
  const E = HL.Engine;
  let s = E.createSession(EQ, "disassembly-open", {});
  PRE_KEYBOARD.filter((id) => id !== "cable-keyboard-flex").forEach((id) => { s.parts[id] = false; });
  const req = E.checkRequirements(EQ, s, "keyboard", "remove");
  assert.equal(req.ok, false, "el teclado no deberia salir con el flex conectado");
  assert.ok((req.missing || []).includes("cable-keyboard-flex"));
  const { rig } = build();
  const flex = rig.getObject3D("cable-keyboard-flex");
  const kb = rig.getObject3D("keyboard");
  const ends = () => {
    flex.updateMatrixWorld(true);
    const pos = [];
    flex.traverse((n) => { if (n.isMesh && n.geometry.attributes.position) pos.push(n); });
    const box = new THREE.Box3(); pos.forEach((m) => box.expandByObject(m));
    return kb.worldToLocal(box.getCenter(new THREE.Vector3()));
  };
  const ref = ends();
  ["bottom", "keyboard", "display"].forEach((name) => {
    setPoseNow(rig, name);
    assert.ok(ends().distanceTo(ref) < 1e-9, `el flex se separo del teclado en ${name}`);
  });
});

test("K11. reinstalar el teclado lo deja EXACTAMENTE en su pose instalada local", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  withRemoved(rig, PRE_KEYBOARD);
  const kb = rig.getObject3D("keyboard");
  const homeP = kb.position.clone(), homeQ = kb.quaternion.clone();
  setPoseNow(rig, "keyboard");
  let done = false;
  rig.setPresence("keyboard", false, { onSettled: () => { done = true; } });
  runTweens(tg, () => done);
  // Se gira y voltea con el teclado en la bandeja, y se vuelve a WORK_KEYBOARD.
  animatePose(rig, tg, { yaw: Math.PI / 2 });
  animatePose(rig, tg, rig.presetPose("bottom"));
  animatePose(rig, tg, rig.presetPose("keyboard"));
  done = false;
  rig.setPresence("keyboard", true, { onSettled: () => { done = true; } });
  runTweens(tg, () => done);
  assert.ok(kb.position.distanceTo(homeP) < 1e-9, "posicion instalada distinta");
  assert.ok(Math.abs(kb.quaternion.dot(homeQ)) > 1 - 1e-12, "orientacion instalada distinta");
});

// ══════════════════════════════════════════════════════════════════════════
// P — pantalla
// ══════════════════════════════════════════════════════════════════════════

test("P01/P02. WORK_DISPLAY existe y su angulo es reproducible desde cualquier pose", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  assert.ok(rig.presetPose("display"), "P01: falta WORK_DISPLAY");
  const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), LF.LAPTOP_LID_DISPLAY_ANGLE);
  ["open", "bottom", "keyboard"].forEach((from) => {
    animatePose(rig, tg, rig.presetPose(from));
    animatePose(rig, tg, rig.presetPose("display"));
    assert.ok(Math.abs(rig.getObject3D("screen-assembly").quaternion.dot(want)) > 1 - 1e-12, `P02: desde ${from} el angulo no se repite`);
  });
});

test("P03-P06. screen-1..4: alcanzables en su pose de operacion y sus agujeros identificables desde WORK_DISPLAY", () => {
  const { rig } = build();
  withRemoved(rig, PRE_DISPLAY);
  setPoseNow(rig, "internal");
  const cam = workCamera(rig, "internal");
  ["screen-1", "screen-2", "screen-3", "screen-4"].forEach((id) => {
    assert.equal(rig.screwAccess(id), "interior", `${id}: se opera desde el interior`);
    const head = screwHeadWorld(rig, id);
    assert.ok(inFrustum(cam, head), `${id} fuera del cuadro interior`);
    assert.ok(reaches(rig, cam, head, screwEntry(rig, id).object3d), `${id}: el clic no lo alcanza`);
  });
  setPoseNow(rig, "display");
  const dcam = workCamera(rig, "display");
  ["screen-1", "screen-2", "screen-3", "screen-4"].forEach((id) => {
    const e = screwEntry(rig, id);
    const hole = rig.root.localToWorld(e.homePosition.clone().add(new THREE.Vector3(0, 0.0013, 0)));
    assert.ok(inFrustum(dcam, hole), `${id}: su agujero queda fuera del cuadro de WORK_DISPLAY`);
  });
});

test("P07. las hojas de bisagra se quedan con la base (alineadas) en toda pose, con los agujeros coaxiales a screen-1..4", () => {
  const { rig } = build();
  const leaves = [];
  rig.getObject3D("screen-assembly").traverse((n) => { if (n.name === "hinge-leaf") leaves.push(n); });
  assert.equal(leaves.length, 2);
  let ref = null;
  ["open", "closed", "bottom", "keyboard", "display"].forEach((name) => {
    setPoseNow(rig, name);
    const local = leaves.map((l) => rig.root.worldToLocal(l.getWorldPosition(new THREE.Vector3())));
    if (!ref) ref = local;
    local.forEach((p, i) => assert.ok(p.distanceTo(ref[i]) < 1e-9, `hoja ${i + 1} se movio respecto de la base en ${name}`));
  });
  // Cada tornillo cae dentro de la huella de una hoja (mismo eje X/Z local).
  ["screen-1", "screen-2", "screen-3", "screen-4"].forEach((id) => {
    const p = screwEntry(rig, id).homePosition;
    const inside = leaves.some((l) => {
      const b = new THREE.Box3().setFromObject(l);
      const lp = rig.root.worldToLocal(b.getCenter(new THREE.Vector3()));
      const size = b.getSize(new THREE.Vector3());
      return Math.abs(p.x - lp.x) <= size.x / 2 && Math.abs(p.z - lp.z) <= size.z / 2;
    });
    assert.ok(inside, `${id} no queda bajo ninguna hoja de bisagra`);
  });
});

function displaySweep({ keepCooler = false, keepAntennas = false, yaw = 0 } = {}) {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  const off = PRE_DISPLAY.filter((id) => !(keepCooler && id === "cooler") && !(keepAntennas && id.startsWith("wifi-antenna")));
  withRemoved(rig, off);
  rig.setPose(Object.assign(rig.presetPose("display"), { yaw }), { animate: false });
  const obj = rig.getObject3D("screen-assembly");
  const home = obj.position.clone();
  const targets = obbs(rig, (o) => ["base", "cooler", "motherboard"].includes(o)).filter((o) => !isKnuckle(o));
  let done = false, worst = { w: 0 }, minCooler = Infinity, antennaHits = 0;
  const antennas = keepAntennas ? ["wifi-antenna-1", "wifi-antenna-2"].map((id) => rig.getObject3D(id)) : [];
  rig.setPresence("screen-assembly", false, { onSettled: () => { done = true; } });
  runTweens(tg, () => done, 700, () => {
    if (obj.position.distanceTo(home) < 0.004) return;
    const mine = obbs(rig, (o) => o === "screen-assembly").filter((o) => !isKnuckle(o));
    const r = worstDepth(mine, targets); if (r.w > worst.w) worst = r;
    if (keepCooler) {
      const cool = targets.filter((o) => o.owner === "cooler");
      mine.forEach((m) => cool.forEach((c) => { if (m.aabb.clone().expandByScalar(0.02).intersectsBox(c.aabb)) minCooler = Math.min(minCooler, satGap(m, c)); }));
    }
    antennas.forEach((a) => {
      const pts = a.children.filter((n) => n.geometry && n.geometry.type === "TubeGeometry");
      pts.forEach((tube) => {
        const pos = tube.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 7) {
          const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(tube.matrixWorld);
          if (mine.some((m) => { const d = p.clone().sub(m.center); return [0, 1, 2].every((k) => Math.abs(d.dot(m.axes[k])) < m.half[k] - 0.0002); })) antennaHits++;
        }
      });
    });
  });
  return { rig, worst, minCooler, antennaHits };
}

test("P08/P09. al extraer la pantalla, disipador y antenas (aun puestos) conservan holgura", () => {
  const r = displaySweep({ keepCooler: true, keepAntennas: true });
  assert.ok(r.worst.w < 1e-4, `P08: la pantalla atraviesa ${(r.worst.w * 1000).toFixed(2)} mm (${r.worst.who})`);
  assert.ok(r.minCooler > 0, "P08: la pantalla toca el disipador");
  assert.equal(r.antennaHits, 0, "P09: la pantalla atraviesa una antena");
});

test("P10/P11. no sale con el eDP o las antenas conectadas; el eDP sigue unido a su conector en toda pose", () => {
  const E = HL.Engine;
  const s = E.createSession(EQ, "disassembly-open", {});
  PRE_DISPLAY.filter((id) => id !== "cable-screen-flex").forEach((id) => { s.parts[id] = false; });
  const r1 = E.checkRequirements(EQ, s, "screen-assembly", "remove");
  assert.equal(r1.ok, false, "P11: salio con el eDP conectado");
  assert.ok(r1.missing.includes("cable-screen-flex"));
  const s2 = E.createSession(EQ, "disassembly-open", {});
  PRE_DISPLAY.filter((id) => id !== "wifi-antenna-1").forEach((id) => { s2.parts[id] = false; });
  const r2 = E.checkRequirements(EQ, s2, "screen-assembly", "remove");
  assert.equal(r2.ok, false, "P11: salio con una antena conectada");
  const { rig } = build();
  const edp = rig.getObject3D("cable-screen-flex");
  const board = rig.getObject3D("motherboard");
  const c0 = board.worldToLocal(new THREE.Box3().setFromObject(edp).getCenter(new THREE.Vector3()));
  ["bottom", "keyboard", "display"].forEach((name) => {
    setPoseNow(rig, name);
    const c = board.worldToLocal(new THREE.Box3().setFromObject(edp).getCenter(new THREE.Vector3()));
    assert.ok(c.distanceTo(c0) < 1e-6, `P10: el eDP se separo de la placa en ${name}`);
  });
});

test("P12/P13. la pantalla sale sin atravesar el chasis (tambien con el equipo girado) y llega apoyada a la bandeja", () => {
  for (const yaw of [0, -Math.PI / 2]) {
    const r = displaySweep({ yaw });
    assert.ok(r.worst.w < 1e-4, `P12 (yaw ${yaw}): atraviesa ${(r.worst.w * 1000).toFixed(2)} mm (${r.worst.who})`);
    const b = new THREE.Box3().setFromObject(r.rig.getObject3D("screen-assembly"));
    assert.ok(b.min.y - TABLE.topY >= 0 && b.min.y - TABLE.topY < 0.004, `P13 (yaw ${yaw}): no queda apoyada en la mesa`);
    assert.ok(b.max.y - TABLE.topY < 0.06, `P13 (yaw ${yaw}): quedo de pie en la bandeja`);
  }
});

test("P14/P15. reinstalar recupera la pose instalada; despues abre y cierra sin perder la alineacion", () => {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  withRemoved(rig, PRE_DISPLAY);
  setPoseNow(rig, "display");
  const lid = rig.getObject3D("screen-assembly");
  const homeP = lid.position.clone();
  const leaf = []; lid.traverse((n) => { if (n.name === "hinge-leaf") leaf.push(n); });
  const leafRef = leaf.map((l) => rig.root.worldToLocal(l.getWorldPosition(new THREE.Vector3())));
  let done = false;
  rig.setPresence("screen-assembly", false, { onSettled: () => { done = true; } });
  runTweens(tg, () => done);
  animatePose(rig, tg, rig.presetPose("internal"));
  animatePose(rig, tg, rig.presetPose("display"));
  done = false;
  rig.setPresence("screen-assembly", true, { onSettled: () => { done = true; } });
  runTweens(tg, () => done);
  const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), LF.LAPTOP_LID_DISPLAY_ANGLE);
  assert.ok(lid.position.distanceTo(homeP) < 1e-9, "P14: posicion instalada distinta");
  assert.ok(Math.abs(lid.quaternion.dot(want)) > 1 - 1e-12, "P14: angulo instalado distinto");
  for (const name of ["closed", "open", "display"]) {
    animatePose(rig, tg, rig.presetPose(name));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rig.presetPose(name).lid);
    assert.ok(Math.abs(lid.quaternion.dot(q)) > 1 - 1e-12, `P15: ${name} no quedo en su angulo`);
    leaf.forEach((l, i) => {
      const p = rig.root.worldToLocal(l.getWorldPosition(new THREE.Vector3()));
      assert.ok(p.distanceTo(leafRef[i]) < 1e-9, `P15: la hoja ${i + 1} se desalineo al ${name}`);
    });
  }
});
