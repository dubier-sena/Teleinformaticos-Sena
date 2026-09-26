"use strict";
// Aspecto del mantenimiento termico sobre el rig REAL del portatil (sep-26).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let THREE, createRig, createLaptopLayout, Look;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  ({ createRig } = await import(U("js/hardware_lab_3d_rig.js")));
  ({ createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js")));
  Look = await import(U("js/hardware_lab_3d_thermal_look.js"));
});

function build() {
  const scene = new THREE.Scene();
  const rig = createRig({ scene, interactions: null, tweenGroup: null, layout: createLaptopLayout(), equipmentId: "laptop" });
  scene.updateMatrixWorld(true);
  return { rig, cpu: rig.getObject3D("cpu"), cooler: rig.getObject3D("cooler") };
}
const vis = (root, name) => {
  const o = root.getObjectByName(name);
  let v = !!o;
  for (let p = o; p && p !== root.parent; p = p.parent) v = v && p.visible;
  return v;
};
const localBox = (root) => {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const b = new THREE.Box3().setFromObject(root);
  return b.applyMatrix4(inv);
};

test("L01. las mallas de pasta y polvo no agrandan el modulo y apenas el CPU (<= 0.35 mm, solo hacia arriba)", () => {
  const { cpu, cooler } = build();
  const c0 = localBox(cooler), p0 = localBox(cpu);
  Look.applyThermalLook(cpu, cooler, { dust: "dirty", paste: "new", amount: "excesiva" }, { coolerInstalled: false });
  const c1 = localBox(cooler), p1 = localBox(cpu);
  assert.ok(c1.min.distanceTo(c0.min) < 1e-9 && c1.max.distanceTo(c0.max) < 1e-9, "el polvo cambio la caja del modulo");
  assert.ok(p1.min.distanceTo(p0.min) < 1e-9, "la pasta bajo el minimo del CPU");
  assert.ok(Math.abs(p1.max.x - p0.max.x) < 1e-9 && Math.abs(p1.max.z - p0.max.z) < 1e-9, "la pasta salio del sustrato");
  assert.ok(p1.max.y - p0.max.y <= 0.00035 + 1e-9, `la pasta sobresale ${((p1.max.y - p0.max.y) * 1000).toFixed(2)} mm`);
  // Idempotente: aplicar otra vez no duplica mallas.
  Look.applyThermalLook(cpu, cooler, { dust: "dirty", paste: "old" }, { coolerInstalled: false });
  let n = 0; cpu.traverse((o) => { if (o.name === "thermal-paste") n++; });
  assert.equal(n, 1);
});

test("L02. cada estado se ve distinto: vieja, restos, limpia, nueva por cantidad, rebose, polvo", () => {
  const { cpu, cooler } = build();
  const apply = (s, installed = false) => Look.applyThermalLook(cpu, cooler, s, { coolerInstalled: installed });
  apply({ dust: "dirty", paste: "old" });
  assert.equal(vis(cpu, "thermal-paste-layer"), true);
  assert.equal(vis(cpu, "thermal-paste-dot"), false);
  assert.equal(vis(cooler, "thermal-dust"), true);
  assert.equal(vis(cooler, "cooler-contact-paste"), true);
  const oldColor = cpu.getObjectByName("thermal-paste-layer").material.color.getHex();
  apply({ dust: "loose", paste: "residue" });
  const layer = cpu.getObjectByName("thermal-paste-layer");
  assert.notEqual(layer.material.color.getHex(), oldColor);
  assert.ok(layer.material.opacity < 1 && layer.scale.x < 1);
  assert.ok(cooler.getObjectByName("thermal-dust-fins").material.opacity < 0.9, "el polvo suelto debe verse mas tenue");
  apply({ dust: "clean", paste: "clean" });
  assert.equal(vis(cpu, "thermal-paste-layer"), false);
  assert.equal(vis(cpu, "thermal-paste-dot"), false);
  assert.equal(vis(cooler, "thermal-dust"), false);
  assert.equal(vis(cooler, "cooler-contact-paste"), false);
  const sizes = {};
  for (const amount of ["insuficiente", "adecuada", "excesiva"]) {
    apply({ dust: "clean", paste: "new", amount });
    assert.equal(vis(cpu, "thermal-paste-dot"), true);
    const d = cpu.getObjectByName("thermal-paste-dot").scale;
    sizes[amount] = d.x * d.z;
    assert.equal(vis(cpu, "thermal-paste-spill"), amount === "excesiva");
  }
  assert.ok(sizes.insuficiente < sizes.adecuada && sizes.adecuada < sizes.excesiva);
  // Montado: la pasta del CPU queda tapada y la del bloque se ve fresca.
  apply({ dust: "clean", paste: "new", amount: "adecuada" }, true);
  assert.equal(vis(cpu, "thermal-paste-dot"), false);
  assert.equal(vis(cooler, "cooler-contact-paste"), true);
});

test("L03. la pasta de contacto del modulo usa material propio (no tiñe otras piezas que compartan material)", () => {
  const { cpu, cooler } = build();
  const contact = cooler.getObjectByName("cooler-contact-paste");
  const shared = contact.material;
  Look.applyThermalLook(cpu, cooler, { dust: "clean", paste: "residue" }, { coolerInstalled: false });
  assert.notEqual(contact.material, shared);
  assert.ok(shared.opacity === 1 && shared.transparent === false, "se modifico el material compartido");
});
