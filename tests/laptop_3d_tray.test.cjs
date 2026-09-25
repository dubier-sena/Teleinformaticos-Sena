"use strict";
// Bandeja de piezas retiradas del portatil 3D (sep-2026).
//
// Hallazgo que esto cierra (medido con la geometria real, no a ojo): la
// rejilla generica de bandeja no descontaba el elevador de servicio del
// portatil (160 mm), asi que cada pieza retirada flotaba ~175 mm sobre la
// mesa, y sus 20 piezas en 3 columnas llegaban hasta z = 1.59 m, fuera del
// borde de la mesa (0.75 m). En ENSAMBLE esas piezas son las que el aprendiz
// tiene que encontrar y tocar en la bandeja. Ademas RAM, SSD, Wi-Fi, CPU y
// bateria quedaban boca abajo y la pantalla de pie (394 mm de alto).
//
// Mide, sin navegador y con los tweens reales del rig:
//   1. Cada pieza retirada queda APOYADA sobre la mesa, dentro del tapete, en
//      su postura natural y separada de las demas.
//   2. El recorrido animado de retiro e instalacion no atraviesa el chasis ni
//      las piezas instaladas en ese paso (ni al cruzar hacia la bandeja ni
//      al asentar la pieza, donde easeOutBack la metia hasta 4 mm).
//   3. El escritorio sigue usando su rejilla de siempre (no declara slots).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, TABLE, ZONES, createRig, createLaptopLayout, createDesktopLayout, TweenGroup, EQ;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  ({ TABLE, ZONES } = await import(U("js/hardware_lab_3d_constants.js")));
  ({ createRig } = await import(U("js/hardware_lab_3d_rig.js")));
  ({ createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js")));
  ({ createDesktopLayout } = await import(U("js/hardware_lab_3d_layout_desktop.js")));
  ({ TweenGroup } = await import(U("js/hardware_lab_3d_tween.js")));
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"), ctx);
  EQ = ctx.window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;
});

function build(tweenGroup = null) {
  const layout = createLaptopLayout();
  const scene = new THREE.Scene();
  const rig = createRig({ scene, interactions: null, tweenGroup, layout, equipmentId: "laptop" });
  scene.updateMatrixWorld(true);
  return { rig, layout };
}
const stateAll = (rig, value) => Object.fromEntries(rig.partIds.map((id) => [id, value]));

// ── OBB por malla (mismo criterio que laptop_3d_service_access) ─────────────
function ownerOf(rig, obj) {
  let n = obj;
  while (n && n.parent !== rig.root) n = n.parent;
  if (!n) return null;
  return n.userData.partId || (n.name === "laptop-base" ? "base" : n.name);
}
function obbs(rig, filter) {
  rig.root.updateMatrixWorld(true);
  const out = [];
  rig.root.traverse((n) => {
    if (!n.isMesh) return;
    const mat = n.material;
    if (!mat || (mat.transparent && mat.opacity === 0) || (mat.isMeshBasicMaterial && mat.blending === THREE.AdditiveBlending)) return;
    if (n.geometry.type === "TubeGeometry" || n.name === "cable-ribbon") return;
    const owner = ownerOf(rig, n);
    if (!filter(owner)) return;
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
        owner, cylinder: !n.isInstancedMesh && geo.type === "CylinderGeometry",
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
function depth(A, B) {
  const axes = [...A.axes, ...B.axes];
  for (const a of A.axes) for (const b of B.axes) { const c = a.clone().cross(b); if (c.lengthSq() > 1e-10) axes.push(c.normalize()); }
  const d = B.center.clone().sub(A.center);
  let min = Infinity;
  for (const L of axes) {
    const r = (O) => O.half[0] * Math.abs(O.axes[0].dot(L)) + O.half[1] * Math.abs(O.axes[1].dot(L)) + O.half[2] * Math.abs(O.axes[2].dot(L));
    const ov = r(A) + r(B) - Math.abs(d.dot(L));
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

// Modulos que van montados boca abajo en la placa (fase 3) y la placa misma,
// que en la bandeja se deja con sus sockets a la vista.
const FLIPPED_ON_BOARD = ["ram", "ssd-m2", "wifi-card", "cpu", "battery"];

test("1. cada pieza retirada queda apoyada en la mesa, dentro del tapete, en postura natural y separada", () => {
  const { rig } = build();
  rig.syncFromSessionParts(stateAll(rig, false));
  rig.root.updateMatrixWorld(true);
  const mat = { x: (TABLE.width * 0.94) / 2, z: (TABLE.depth * 0.9) / 2 };
  const boxes = {};
  const problems = [];
  rig.partIds.forEach((id) => {
    const obj = rig.getObject3D(id);
    const box = new THREE.Box3().setFromObject(obj);
    boxes[id] = box;
    const lift = box.min.y - TABLE.topY;
    if (lift < 0 || lift > 0.004) problems.push(`${id}: base a ${(lift * 1000).toFixed(1)} mm de la mesa`);
    if (Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) > mat.x || Math.max(Math.abs(box.min.z), Math.abs(box.max.z)) > mat.z) {
      problems.push(`${id}: fuera del tapete`);
    }
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion);
    if (FLIPPED_ON_BOARD.includes(id) && up.y < 0.99) problems.push(`${id}: boca abajo en la bandeja`);
    if (box.max.y - TABLE.topY > 0.06) problems.push(`${id}: ${((box.max.y - TABLE.topY) * 1000).toFixed(0)} mm de alto (de pie)`);
  });
  const ids = Object.keys(boxes);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = boxes[ids[i]], b = boxes[ids[j]];
      const gap = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, a.min.z - b.max.z, b.min.z - a.max.z);
      if (gap < 0.02) problems.push(`${ids[i]} y ${ids[j]} a ${(gap * 1000).toFixed(0)} mm`);
    }
  }
  assert.deepEqual(problems, []);
});

test("1b. la bandeja no invade el equipo: el retiro con animacion y sin ella terminan en el mismo lugar", () => {
  const { rig } = build();
  rig.syncFromSessionParts(stateAll(rig, true));
  rig.root.updateMatrixWorld(true);
  const equipment = new THREE.Box3().setFromObject(rig.root);
  const viaSync = {};
  rig.syncFromSessionParts(stateAll(rig, false));
  rig.partIds.forEach((id) => { viaSync[id] = rig.getObject3D(id).position.clone(); });
  rig.root.updateMatrixWorld(true);
  rig.partIds.forEach((id) => {
    const box = new THREE.Box3().setFromObject(rig.getObject3D(id));
    assert.ok(box.min.x > equipment.max.x + 0.05, `${id} en la bandeja se mete bajo el equipo`);
  });
  const { rig: rig2 } = build();
  rig2.syncFromSessionParts(stateAll(rig2, true));
  rig2.partIds.forEach((id) => rig2.setPresence(id, false, { animate: false }));
  rig2.partIds.forEach((id) => {
    assert.ok(rig2.getObject3D(id).position.distanceTo(viaSync[id]) < 1e-9, `${id}: la bandeja no depende del orden de retiro`);
  });
});

test("1c. retirar una pieza con hover (agrandada y con contorno) la deja en el mismo lugar de la bandeja", () => {
  const { rig: clean } = build();
  clean.syncFromSessionParts(stateAll(clean, true));
  const { rig } = build();
  rig.syncFromSessionParts(stateAll(rig, true));
  ["battery", "ram", "cooler", "motherboard"].forEach((id) => {
    // Lo que hace interactions al pasar el mouse y hacer clic: escala 1.035 y
    // un contorno (caja) como hijo del objeto, algo mas grande que la pieza.
    const obj = rig.getObject3D(id);
    obj.scale.setScalar(1.035);
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()).addScalar(0.01);
    const outline = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
    outline.name = "hwlab-outline-hover";
    obj.add(outline);
    rig.setPresence(id, false, { animate: false });
    clean.setPresence(id, false, { animate: false });
    assert.ok(obj.position.distanceTo(clean.getObject3D(id).position) < 1e-9, `${id}: la bandeja cambia si la pieza estaba con hover`);
  });
});

function sweep(sequenceName, presentEnd) {
  const tg = new TweenGroup();
  const { rig } = build(tg);
  const homes = {};
  rig.syncFromSessionParts(stateAll(rig, true));
  rig.partIds.forEach((id) => { homes[id] = rig.getObject3D(id).position.clone(); });
  const installed = new Set(presentEnd ? [] : rig.partIds);
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, installed.has(id)])));
  const cableIds = new Set(Object.keys(createLaptopLayout().components).filter((id) => createLaptopLayout().components[id].kind === "cable"));
  const problems = [];
  EQ.sequences[sequenceName].filter((s) => s.kind === "action").forEach((step) => {
    const id = step.partId;
    const others = obbs(rig, (o) => o !== id && (o === "base" || installed.has(o)));
    let settled = false;
    let worst = 0;
    let worstWith = null;
    rig.setPresence(id, presentEnd, { onSettled: () => { settled = true; } });
    for (let k = 0; k < 300 && !settled; k++) {
      tg.update(1 / 60);
      if (cableIds.has(id)) continue;
      rig.root.updateMatrixWorld(true);
      // A menos de 4 mm de su sitio la pieza esta entrando/saliendo de su
      // conector (acople real, medido aparte en laptop_3d_service_access).
      if (rig.getObject3D(id).position.distanceTo(homes[id]) < 0.004) continue;
      const mine = obbs(rig, (o) => o === id);
      others.forEach((o) => {
        mine.forEach((m) => {
          if (!m.aabb.intersectsBox(o.aabb)) return;
          const d = depth(m, o);
          if (d > worst) { worst = d; worstWith = o.owner; }
        });
      });
    }
    assert.ok(settled, `${id}: la animacion no termino`);
    if (worst > 0.0005) problems.push(`${step.action} ${id}: atraviesa ${worstWith} ${(worst * 1000).toFixed(1)} mm`);
    if (presentEnd) installed.add(id); else installed.delete(id);
    const obj = rig.getObject3D(id);
    if (presentEnd && obj.position.distanceTo(homes[id]) > 1e-6) problems.push(`${id}: no quedo en su sitio`);
  });
  return problems;
}

test("2. el recorrido animado del DESENSAMBLE no atraviesa el chasis ni piezas instaladas", () => {
  assert.deepEqual(sweep("disassembly", false), []);
});

test("2b. el recorrido animado del ENSAMBLE no atraviesa nada y cada pieza queda en su sitio", () => {
  assert.deepEqual(sweep("assembly", true), []);
});

test("3. el escritorio no declara bandeja propia y conserva su rejilla de siempre", () => {
  const layout = createDesktopLayout();
  assert.equal(layout.traySlots, undefined);
  const scene = new THREE.Scene();
  const rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "desktop" });
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, true])));
  const before = Object.fromEntries(rig.partIds.map((id) => [id, rig.getObject3D(id).quaternion.clone()]));
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, false])));
  rig.partIds.forEach((id, i) => {
    const p = rig.getObject3D(id).position;
    const col = i % ZONES.trayCols;
    const row = Math.floor(i / ZONES.trayCols);
    assert.ok(Math.abs(p.y - 0.02) < 1e-9, `${id}: altura de bandeja del escritorio cambio`);
    assert.ok(Math.abs(p.x - (ZONES.trayOrigin.x - rig.root.position.x + col * ZONES.trayStepX)) < 1e-9, `${id}: x cambio`);
    assert.ok(Math.abs(p.z - (ZONES.trayOrigin.z - rig.root.position.z + row * ZONES.trayStepZ)) < 1e-9, `${id}: z cambio`);
    assert.ok(rig.getObject3D(id).quaternion.equals(before[id]), `${id}: el escritorio no gira piezas en la bandeja`);
  });
});
