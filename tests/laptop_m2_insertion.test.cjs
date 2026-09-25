"use strict";
// Recorrido de montaje de las tarjetas M.2 del portatil (SSD 2280 y Wi-Fi
// 2230), sep-2026.
//
// Antes salian rectas hacia abajo (perpendiculares a la placa), algo
// imposible en un conector M.2 real: los contactos estan en el extremo corto
// de la tarjeta, metidos en un conector horizontal. Al quitar el tornillo la
// tarjeta sube ~20 grados pivotando sobre esos contactos y solo despues se
// desliza fuera del conector siguiendo su propio eje. Mismo principio que el
// SO-DIMM (ver laptop_sodimm_insertion.test.cjs), con otro pivote y otro eje.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, LF, layout, rig;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  LF = await import(U("js/hardware_lab_3d_laptop_factory.js"));
  const { createRig } = await import(U("js/hardware_lab_3d_rig.js"));
  const { createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js"));
  layout = createLaptopLayout();
  const scene = new THREE.Scene();
  rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "laptop" });
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, true])));
  scene.updateMatrixWorld(true);
});

const CARDS = ["ssd-m2", "wifi-card"];

function poseAt(id, t) {
  const obj = rig.getObject3D(id);
  const opts = layout.components[id].insertionOpts;
  return LF.computeM2Pose(t, Object.assign({ homePosition: obj.position.clone(), homeQuaternion: obj.quaternion.clone() }, opts));
}
function pointAt(id, pose, local) {
  return local.clone().applyQuaternion(pose.quaternion).add(pose.position);
}

test("1. el SSD y la Wi-Fi declaran el recorrido M.2 y el rig lo usa", () => {
  CARDS.forEach((id) => {
    assert.equal(layout.components[id].insertionMotion, "m2", `${id} sin recorrido M.2`);
    assert.ok(layout.components[id].insertionOpts.length > 0);
  });
  const rigSrc = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_rig.js"), "utf8");
  assert.match(rigSrc, /INSERTION_POSES = \{[^}]*m2: computeM2Pose/);
});

test("2. t=0 es exactamente la pose instalada", () => {
  CARDS.forEach((id) => {
    const obj = rig.getObject3D(id);
    const p = poseAt(id, 0);
    assert.ok(p.position.distanceTo(obj.position) < 1e-12, id);
    assert.ok(p.quaternion.angleTo(obj.quaternion) < 1e-9, id);
  });
});

test("3. PIVOTE: los contactos no se mueven mientras la tarjeta gira (siguen dentro del conector)", () => {
  CARDS.forEach((id) => {
    const o = layout.components[id].insertionOpts;
    const contacts = new THREE.Vector3(-o.length / 2, -o.thickness / 2, 0);
    const home = pointAt(id, poseAt(id, 0), contacts);
    for (let t = 0; t <= 0.6 + 1e-9; t += 0.05) {
      assert.ok(pointAt(id, poseAt(id, t), contacts).distanceTo(home) < 1e-9, `${id} t=${t.toFixed(2)}`);
    }
    assert.ok(Math.abs(poseAt(id, 0.6).angle - LF.M2_RELEASE_ANGLE) < 1e-12);
    assert.ok(LF.M2_RELEASE_ANGLE > 15 * Math.PI / 180 && LF.M2_RELEASE_ANGLE < 25 * Math.PI / 180);
  });
});

test("4. el extremo del tornillo se ALEJA de la placa (hacia abajo: la tarjeta cuelga de la cara inferior)", () => {
  const boardFaceY = new THREE.Box3().setFromObject(rig.getObject3D("motherboard")).min.y;
  CARDS.forEach((id) => {
    const o = layout.components[id].insertionOpts;
    const free = new THREE.Vector3(o.length / 2, -o.thickness / 2, 0);
    let prev = pointAt(id, poseAt(id, 0), free).y;
    for (let t = 0.1; t <= 0.6 + 1e-9; t += 0.1) {
      const y = pointAt(id, poseAt(id, t), free).y;
      assert.ok(y < prev, `${id} t=${t.toFixed(1)}: el extremo libre no baja`);
      assert.ok(y < boardFaceY, `${id} t=${t.toFixed(1)}: el extremo libre atraviesa la placa`);
      prev = y;
    }
  });
});

test("5. la salida sigue el eje de la tarjeta, alejandose del conector (no recta hacia abajo)", () => {
  CARDS.forEach((id) => {
    const o = layout.components[id].insertionOpts;
    const released = poseAt(id, 0.6);
    const out = poseAt(id, 1);
    const move = out.position.clone().sub(released.position);
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(released.quaternion);
    assert.ok(Math.abs(move.length() - o.travel) < 1e-9, `${id}: recorrido de salida`);
    assert.ok(move.clone().normalize().dot(axis) > 0.9999, `${id}: la salida no va por el eje de la tarjeta`);
    // El conector esta en -X: la tarjeta se aleja de el.
    assert.ok(move.x > 0, `${id}: la salida no se aleja del conector`);
    // angleTo usa acos: cerca de 1 amplifica el redondeo, 1e-6 rad sigue siendo "sin giro".
    assert.ok(out.quaternion.angleTo(released.quaternion) < 1e-6, `${id}: gira durante la salida`);
  });
});

test("6. el SO-DIMM conserva su recorrido (la funcion comun no lo cambia)", () => {
  const home = new THREE.Vector3(0.012, 0.0126, -0.052);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0));
  const p = LF.computeSoDimmPose(1, { homePosition: home, homeQuaternion: q, moduleDepth: 0.030, thickness: 0.0012, travel: 0.030 });
  // Valores de referencia medidos antes de extraer la funcion comun.
  assert.ok(Math.abs(p.angle - LF.SODIMM_RELEASE_ANGLE) < 1e-12);
  const pivot = new THREE.Vector3(0, -0.0006, 0.015).applyQuaternion(q).add(home);
  const pivotAfterRotation = new THREE.Vector3(0, -0.0006, 0.015).applyQuaternion(p.quaternion).add(p.position);
  const slide = new THREE.Vector3(0, 0, -1).applyQuaternion(p.quaternion).multiplyScalar(0.030);
  assert.ok(pivotAfterRotation.sub(slide).distanceTo(pivot) < 1e-12);
});
