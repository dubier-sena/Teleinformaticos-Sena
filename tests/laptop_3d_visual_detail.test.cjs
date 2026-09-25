"use strict";
// Iteracion visual del portatil 3D (sep-18): placa base, modulo termico, RAM,
// SSD, Wi-Fi, CPU, conectores y cableado con detalle propio. El contrato de la
// iteracion era SOLO VISUAL: mismas posiciones, recorridos, zonas de clic y
// orden de desmontaje. Este archivo fija lo que lo garantiza (colisiones,
// barridos animados y visibilidad ya los cubren laptop_3d_service_access y
// laptop_3d_tray):
//   1. El VOLUMEN de cada pieza tocada no cambia: la bandeja (traySlotPose),
//      el contorno de seleccion y el encuadre de camara se calculan con esa
//      caja. Si una mejora futura la cambia a proposito, hay que re-medir
//      bandeja, recorridos y seleccion antes de actualizar estos numeros.
//   2. El par trenzado de los cables de alimentacion queda dentro del radio
//      del cable (la curva, las holguras medidas y el proxy de clic son los
//      mismos que antes).
//   3. Los pasivos SMD de la placa quedan pegados a ella (<= 0.45 mm) y fuera
//      de las huellas de RAM, SSD, Wi-Fi y CPU.
//   4. Presupuesto de llamadas de dibujo: el detalle va instanciado.
//   5. La boca de cada puerto mira hacia AFUERA en ambos lados (antes los del
//      lado derecho miraban hacia dentro).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, LF, rig, layout;

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
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"), ctx);
  layout = createLaptopLayout();
  const scene = new THREE.Scene();
  rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "laptop" });
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, true])));
  scene.updateMatrixWorld(true);
});

/** Caja de la geometria en el espacio LOCAL de la pieza (instancias incluidas). */
function localBox(obj) {
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  obj.traverse((n) => {
    if (!n.isMesh) return;
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    const toLocal = inv.clone().multiply(n.matrixWorld);
    if (n.isInstancedMesh) {
      const m = new THREE.Matrix4();
      for (let i = 0; i < n.count; i++) {
        n.getMatrixAt(i, m);
        box.union(n.geometry.boundingBox.clone().applyMatrix4(toLocal.clone().multiply(m)));
      }
    } else box.union(n.geometry.boundingBox.clone().applyMatrix4(toLocal));
  });
  return box;
}

// Medidas de la version anterior a la iteracion (m), en local de cada pieza.
const VOLUME = {
  cooler: [[-0.063, -0.0088, -0.0465], [0.0215, 0.00005, 0.0155]],
  motherboard: [[-0.15, -0.0038, -0.036], [0.15, 0.0008, 0.036]],
  cpu: [[-0.012, -0.00055, -0.012], [0.012, 0.00125, 0.012]],
  ram: [[-0.0343, -0.0006, -0.015], [0.0343, 0.0017, 0.0155]],
  "ssd-m2": [[-0.0405, -0.00055, -0.011], [0.04, 0.00175, 0.011]],
  "wifi-card": [[-0.015, -0.0005, -0.011], [0.015, 0.00165, 0.011]],
  // Ancho con las orejas de fijacion de los extremos (sep-2026): pack 210 mm + 2 x 7.5.
  battery: [[-0.1125, -0.002887, -0.033], [0.1125, 0.00335, 0.033]],
};

test("1. el detalle nuevo no cambia el volumen de ninguna pieza (bandeja, contorno y encuadre dependen de el)", () => {
  const off = [];
  Object.entries(VOLUME).forEach(([id, [mn, mx]]) => {
    const b = localBox(rig.getObject3D(id));
    const got = [...b.min.toArray(), ...b.max.toArray()];
    const want = [...mn, ...mx];
    if (got.some((v, i) => Math.abs(v - want[i]) > 2e-6)) off.push(`${id}: ${got.map((v) => (v * 1000).toFixed(3)).join(", ")} mm`);
  });
  const base = rig.root.children.find((c) => c.name === "laptop-base");
  const bb = localBox(base);
  if (Math.abs(bb.max.x - 0.1656) > 2e-6 || Math.abs(bb.max.y - 0.0245) > 2e-6 || Math.abs(bb.max.z - 0.115) > 2e-6 || Math.abs(bb.min.y) > 2e-6) off.push("base");
  assert.deepEqual(off, [], "cambio el volumen de:\n" + off.join("\n"));
});

test("2. los cables de alimentacion son un par trenzado DENTRO del radio del cable", () => {
  ["cable-battery", "cable-cpu-fan-laptop"].forEach((id) => {
    const group = rig.getObject3D(id);
    const pair = group.getObjectByName("cable-twisted-pair");
    assert.ok(pair, `${id}: falta el par trenzado`);
    const wires = pair.children.filter((c) => c.isMesh && c.name === "cable-wire");
    assert.equal(wires.length, 2, `${id}: deben ser 2 hilos`);
    const radius = layout.components[id].buildOpts.radius;
    const curve = group.userData.curve;
    const samples = curve.getSpacedPoints(600);
    let worst = 0;
    wires.forEach((w) => {
      const pos = w.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 3) {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i);
        let dmin = Infinity;
        for (const q of samples) dmin = Math.min(dmin, p.distanceTo(q));
        worst = Math.max(worst, dmin);
      }
    });
    assert.ok(worst <= radius + 0.00005, `${id}: un hilo sale ${(worst * 1000).toFixed(2)} mm del eje (radio ${radius * 1000} mm)`);
  });
});

test("3. los pasivos SMD van pegados a la placa y fuera de las huellas de los modulos", () => {
  const mb = rig.getObject3D("motherboard");
  const face = -LF.LAPTOP.board.thickness / 2;
  const footprints = ["ram", "ssd-m2", "wifi-card", "cpu"].map((id) => {
    const b = new THREE.Box3().setFromObject(rig.getObject3D(id));
    return { id, b };
  });
  const meshes = [];
  mb.traverse((n) => { if (n.isInstancedMesh && n.name === "smd-passives") meshes.push(n); });
  assert.ok(meshes.length >= 1, "la placa debe llevar pasivos SMD");
  let count = 0;
  const problems = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  meshes.forEach((mesh) => {
    assert.equal(mesh.castShadow, false, "los pasivos no proyectan sombra");
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      count++;
      if (s.y > 0.00045 + 1e-9 || p.y + s.y / 2 > face + 1e-9 || p.y - s.y / 2 < face - 0.00045 - 1e-9) problems.push(`pasivo ${i} a ${(p.y * 1000).toFixed(2)} mm`);
      const w = p.clone().applyMatrix4(mesh.matrixWorld);
      footprints.forEach(({ id, b }) => {
        if (w.x > b.min.x && w.x < b.max.x && w.z > b.min.z && w.z < b.max.z) problems.push(`pasivo ${i} bajo ${id}`);
      });
    }
  });
  assert.ok(count >= 200, `se esperaban >= 200 pasivos, hay ${count}`);
  assert.deepEqual(problems.slice(0, 8), []);
});

test("4. presupuesto de llamadas de dibujo: el detalle va instanciado", () => {
  let meshes = 0;
  rig.root.traverse((n) => { if (n.isMesh) meshes++; });
  // Antes de la iteracion: 425 mallas. El detalle nuevo es instanciado y los
  // contactos de RAM/SSD/Wi-Fi pasaron a una malla cada uno.
  assert.ok(meshes <= 440, `el portatil dibuja ${meshes} mallas (limite 440)`);
  // Calcomanias sin sombra (planos coplanares: solo producirian acne).
  rig.root.traverse((n) => { if (n.isMesh && n.name === "decal") assert.equal(n.castShadow, false, "una calcomania proyecta sombra"); });
});

test("5. la boca de cada puerto mira hacia afuera en los dos lados del chasis", () => {
  const base = rig.root.children.find((c) => c.name === "laptop-base");
  LF.LAPTOP_PORTS.forEach((spec) => {
    const g = base.getObjectByName("laptop-port-" + spec.id);
    assert.ok(g, `falta el puerto ${spec.id}`);
    const mouth = new THREE.Vector3(0, 0, -1).applyQuaternion(g.getWorldQuaternion(new THREE.Quaternion()));
    const want = spec.side === "left" ? -1 : 1;
    assert.ok(Math.sign(mouth.x) === want && Math.abs(mouth.x) > 0.99, `${spec.id}: la boca mira hacia ${mouth.x > 0 ? "+X" : "-X"}`);
  });
});
