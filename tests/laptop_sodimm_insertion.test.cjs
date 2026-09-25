"use strict";
// computeSoDimmPose() describe el recorrido REAL de montaje de un SO-DIMM:
// al liberar los clips el socket lo empuja a ~30 grados y solo entonces sale
// siguiendo ese angulo; al instalar, el camino inverso.
//
// Lo que de verdad puede romperse aqui no se ve en una captura: que el PIVOTE
// deje de estar en el borde de contactos. Si el modulo girase sobre su centro,
// los contactos se hundirian DENTRO de la placa al inclinarlo -- visualmente
// pasa desapercibido en un frame intermedio, pero es justo lo que hace que el
// gesto se lea como "una caja que gira en el aire" en vez de una instalacion.
// Por eso el test mide la posicion de los contactos a lo largo de todo el
// recorrido, no solo el angulo final.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, LF;
test.before(async () => {
  // Las factories tocan document/canvas al construir materiales; aqui solo se
  // usa la funcion PURA, pero el modulo entero se evalua al importarlo.
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  LF = await import(U("js/hardware_lab_3d_laptop_factory.js"));
});

const MODULE_DEPTH = 0.030;
const THICKNESS = 0.0012;

function poseAt(t, home) {
  return LF.computeSoDimmPose(t, {
    homePosition: home,
    moduleDepth: MODULE_DEPTH,
    thickness: THICKNESS,
    travel: 0.030,
  });
}

// Punto de los contactos en espacio de mundo para una pose dada.
function contactsWorld(pose) {
  return new THREE.Vector3(0, -THICKNESS / 2, MODULE_DEPTH / 2)
    .applyQuaternion(pose.quaternion)
    .add(pose.position);
}

test("t=0 devuelve exactamente la pose instalada (sin giro ni desplazamiento)", () => {
  const home = new THREE.Vector3(0.1, 0.005, -0.08);
  const p = poseAt(0, home);
  assert.ok(p.position.distanceTo(home) < 1e-9, "t=0 no debe mover la pieza");
  assert.equal(p.angle, 0);
  assert.ok(Math.abs(p.quaternion.x) < 1e-9, "t=0 no debe girar la pieza");
});

test("el modulo alcanza el angulo de liberacion (25-35 grados) y no lo supera", () => {
  const home = new THREE.Vector3(0, 0.005, 0);
  const deg = (t) => poseAt(t, home).angle * 180 / Math.PI;
  assert.ok(deg(0.6) >= 25 && deg(0.6) <= 35, `angulo de liberacion fuera de rango: ${deg(0.6)}`);
  // Una vez liberado, la salida NO sigue girando: solo se desplaza.
  assert.ok(Math.abs(deg(1) - deg(0.6)) < 1e-6, "el angulo debe congelarse tras la liberacion");
  // Y crece de forma monotona hasta ahi.
  assert.ok(deg(0.3) > 0 && deg(0.3) < deg(0.6), "el giro debe ser progresivo");
});

test("PIVOTE: los contactos permanecen en el socket durante todo el giro", () => {
  const home = new THREE.Vector3(0, 0.005, 0);
  const ref = contactsWorld(poseAt(0, home));
  // Fase de giro (0 -> 0.6): el borde de contactos es el eje, no debe moverse.
  for (const t of [0.1, 0.25, 0.4, 0.55, 0.6]) {
    const d = contactsWorld(poseAt(t, home)).distanceTo(ref);
    assert.ok(d < 1e-6, `en t=${t} los contactos se movieron ${(d * 1000).toFixed(2)} mm (el pivote no esta en los contactos)`);
  }
});

test("el extremo libre SUBE al girar (no baja ni atraviesa la placa)", () => {
  const home = new THREE.Vector3(0, 0.005, 0);
  const freeEnd = (t) => {
    const p = poseAt(t, home);
    return new THREE.Vector3(0, 0, -MODULE_DEPTH / 2).applyQuaternion(p.quaternion).add(p.position).y;
  };
  assert.ok(freeEnd(0.6) > freeEnd(0) + 0.005, "el extremo libre debe elevarse al menos 5 mm");
  assert.ok(freeEnd(0.3) > freeEnd(0), "la elevacion debe ser progresiva");
  // Ningun punto del modulo puede quedar por debajo de su altura instalada.
  for (const t of [0.2, 0.5, 0.8, 1]) {
    assert.ok(freeEnd(t) >= freeEnd(0) - 1e-9, `en t=${t} el extremo libre baja por debajo de la placa`);
  }
});

test("la extraccion sigue el angulo ya alcanzado (sale en diagonal, no recta)", () => {
  const home = new THREE.Vector3(0, 0.005, 0);
  const a = poseAt(0.6, home).position;
  const b = poseAt(1, home).position;
  const d = b.clone().sub(a);
  assert.ok(d.y > 0.010, "debe alejarse hacia arriba");
  assert.ok(d.z < -0.020, "y hacia fuera del socket (-Z)");
  // La direccion debe coincidir con el angulo de liberacion, no con la vertical.
  const ang = Math.atan2(d.y, -d.z) * 180 / Math.PI;
  assert.ok(Math.abs(ang - 30) < 1.5, `la salida no sigue el angulo de liberacion (${ang.toFixed(1)} grados)`);
});

test("es una funcion pura: no muta la posicion ni el cuaternion que recibe", () => {
  const home = new THREE.Vector3(0.1, 0.005, -0.08);
  const quat = new THREE.Quaternion();
  const snapshot = home.clone();
  LF.computeSoDimmPose(0.7, { homePosition: home, homeQuaternion: quat });
  assert.ok(home.equals(snapshot), "computeSoDimmPose no debe modificar homePosition");
  assert.equal(quat.x, 0);
  assert.equal(quat.w, 1);
});

test("t fuera de rango se recorta en vez de extrapolar", () => {
  const home = new THREE.Vector3(0, 0.005, 0);
  assert.ok(poseAt(-5, home).position.distanceTo(home) < 1e-9);
  assert.ok(poseAt(9, home).position.distanceTo(poseAt(1, home).position) < 1e-9);
});

test("el layout declara el recorrido en la RAM y el rig sabe aplicarlo", () => {
  const fs = require("node:fs");
  const layout = fs.readFileSync(path.join(ROOT, "js", "hardware_lab_3d_layout_laptop.js"), "utf8");
  assert.match(layout, /insertionMotion:\s*"sodimm"/, "la RAM debe declarar su recorrido de montaje");
  const rig = fs.readFileSync(path.join(ROOT, "js", "hardware_lab_3d_rig.js"), "utf8");
  assert.match(rig, /computeSoDimmPose/, "el rig debe resolver la pose de liberacion");
  assert.match(rig, /insertionMotion: cfg\.insertionMotion/, "el rig debe propagar insertionMotion al registro de piezas");
});
