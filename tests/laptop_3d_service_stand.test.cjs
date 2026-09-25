"use strict";
// Soporte de servicio del portatil 3D (sep-2026).
//
// El portatil esta elevado 160 mm sobre la mesa (vista y acceso por la cara
// inferior) y parecia flotar. El soporte lo explica, pero NO puede interferir
// con el ejercicio. Mide, con la geometria y los tweens reales:
//   1. Existe, es decorativo: fuera de rig.root, sin partId, fuera del
//      checklist, nunca registrado en interactions (ni pieza ni oclusor).
//   2. Solo toca el chasis donde lo sostiene (paredes en las esquinas); nunca
//      la tapa inferior removible ni los puertos; apoya sobre la mesa.
//   3. Ningun recorrido animado de desensamble/ensamble (piezas y cables) lo
//      atraviesa.
//   4. El escritorio no tiene soporte.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let THREE, TABLE, createRig, createLaptopLayout, createDesktopLayout, TweenGroup, EQ;

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
  ({ createDesktopLayout } = await import(U("js/hardware_lab_3d_layout_desktop.js")));
  ({ TweenGroup } = await import(U("js/hardware_lab_3d_tween.js")));
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"), ctx);
  EQ = ctx.window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;
  // El rig lee window.HardwareLab para el nombre visible de cada pieza registrada.
  globalThis.window = ctx.window;
});

function build({ tweenGroup = null, interactions = null } = {}) {
  const layout = createLaptopLayout();
  const scene = new THREE.Scene();
  const rig = createRig({ scene, interactions, tweenGroup, layout, equipmentId: "laptop" });
  rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, true])));
  scene.updateMatrixWorld(true);
  return { scene, rig, layout, stand: scene.getObjectByName("laptop-service-stand") };
}

function obbs(object, ownerOf) {
  object.updateMatrixWorld(true);
  const out = [];
  object.traverse((n) => {
    if (!n.isMesh) return;
    const mat = n.material;
    if (mat && mat.transparent && mat.opacity === 0) return;
    if (n.geometry.type === "TubeGeometry" || n.name === "cable-ribbon") return;
    const owner = ownerOf(n);
    if (!owner) return;
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
      const o = { owner, name: n.name, cylinder: !n.isInstancedMesh && geo.type === "CylinderGeometry", center: c.clone().applyMatrix4(mw), axes: raw.map((a, i) => a.clone().divideScalar(len[i] || 1)), half: [hs.x * len[0], hs.y * len[1], hs.z * len[2]] };
      const ext = new THREE.Vector3();
      for (let k = 0; k < 3; k++) { ext.x += Math.abs(o.axes[k].x) * o.half[k]; ext.y += Math.abs(o.axes[k].y) * o.half[k]; ext.z += Math.abs(o.axes[k].z) * o.half[k]; }
      o.aabb = new THREE.Box3(o.center.clone().sub(ext), o.center.clone().add(ext));
      out.push(o);
    });
  });
  return out;
}
/** >0 penetracion (SAT); <=0 separacion (cota inferior). */
function signedDepth(A, B) {
  const axes = [...A.axes, ...B.axes];
  for (const a of A.axes) for (const b of B.axes) { const cr = a.clone().cross(b); if (cr.lengthSq() > 1e-10) axes.push(cr.normalize()); }
  const d = B.center.clone().sub(A.center);
  let minOv = Infinity, maxGap = -Infinity;
  for (const L of axes) {
    const r = (O) => O.half[0] * Math.abs(O.axes[0].dot(L)) + O.half[1] * Math.abs(O.axes[1].dot(L)) + O.half[2] * Math.abs(O.axes[2].dot(L));
    const ov = r(A) + r(B) - Math.abs(d.dot(L));
    if (ov <= 0) maxGap = Math.max(maxGap, -ov); else minOv = Math.min(minOv, ov);
  }
  let s = maxGap > -Infinity ? -maxGap : minOv;
  if (s > 0) {
    for (const [C, O] of [[A, B], [B, A]]) {
      if (!C.cylinder) continue;
      const q = O.center.clone();
      const dd = C.center.clone().sub(O.center);
      for (let k = 0; k < 3; k++) q.addScaledVector(O.axes[k], Math.max(-O.half[k], Math.min(O.half[k], dd.dot(O.axes[k]))));
      const rel = q.sub(C.center);
      s = Math.min(s, Math.max(C.half[0], C.half[2]) - rel.clone().sub(C.axes[1].clone().multiplyScalar(rel.dot(C.axes[1]))).length());
    }
  }
  return s;
}
function laptopOwner(rig) {
  return (n) => {
    let o = n; let sub = "";
    while (o && o.parent !== rig.root) { if (o.name && o.name.startsWith("laptop-port-")) sub = ":puerto"; o = o.parent; }
    if (!o) return null;
    return (o.userData.partId || (o.name === "laptop-base" ? "base" : o.name)) + sub;
  };
}

test("1. el soporte existe, es decorativo y queda fuera de las piezas, del checklist y de la interaccion", () => {
  const registered = [];
  const interactions = {
    registerInteractive: (obj) => registered.push(obj),
    registerOccluder: (obj) => registered.push(obj),
    unregisterInteractive() {}, unregisterOccluder() {},
  };
  const { rig, stand } = build({ interactions });
  assert.ok(stand, "no existe el soporte");
  let n = stand; let underRoot = false;
  while (n) { if (n === rig.root) underRoot = true; n = n.parent; }
  assert.equal(underRoot, false, "el soporte no debe colgar de rig.root (entraria en el encuadre y la vista explotada)");
  stand.traverse((o) => assert.equal(o.userData.partId, undefined, "el soporte no puede tener partId"));
  registered.forEach((obj) => {
    let a = obj; while (a) { assert.notEqual(a, stand, "el soporte (o un padre suyo) quedo registrado en interactions"); a = a.parent; }
    let inside = false; stand.traverse((o) => { if (o === obj) inside = true; });
    assert.equal(inside, false, "una malla del soporte quedo registrada en interactions");
  });
  const ids = new Set([...EQ.sequences.disassembly, ...EQ.sequences.assembly].map((s) => s.partId).filter(Boolean));
  [...ids].forEach((id) => assert.ok(!/stand|soporte/i.test(id), `el checklist menciona el soporte: ${id}`));
  assert.ok(!Object.keys(EQ.parts).some((id) => /stand|soporte/i.test(id)));
});

test("2. solo toca el chasis donde lo sostiene; nunca la tapa inferior, los puertos ni piezas; apoya en la mesa", () => {
  const { rig, stand } = build();
  const S = obbs(stand, (n) => n.name);
  const E = obbs(rig.root, laptopOwner(rig));
  const problems = [];
  let contactsWithBase = 0;
  for (const s of S) {
    for (const e of E) {
      if (!s.aabb.clone().expandByScalar(0.002).intersectsBox(e.aabb)) continue;
      const d = signedDepth(s, e);
      if (d > 0.00005) problems.push(`${s.name} atraviesa ${e.owner} ${(d * 1000).toFixed(2)} mm`);
      else if (e.owner === "base" && d > -0.00005) contactsWithBase++;
      else if (e.owner === "base:puerto" && d > -0.001) problems.push(`${s.name} a menos de 1 mm de un puerto`);
      else if (e.owner !== "base" && e.owner !== "base:puerto" && d > -0.0002) problems.push(`${s.name} a ${(-d * 1000).toFixed(2)} mm de ${e.owner} (solo puede tocar la base)`);
    }
  }
  assert.deepEqual([...new Set(problems)], []);
  assert.ok(contactsWithBase >= 8, `el soporte debe sostener el chasis (contactos con la base: ${contactsWithBase})`);
  const plate = new THREE.Box3().setFromObject(stand.getObjectByName("stand-base-plate"));
  assert.ok(Math.abs(plate.min.y - TABLE.topY) < 1e-6, "la base del soporte no apoya en la mesa");
  assert.ok(new THREE.Box3().setFromObject(stand).min.y >= TABLE.topY - 1e-6, "el soporte atraviesa la mesa");
});

test("3. ningun recorrido animado de desensamble ni de ensamble atraviesa el soporte (piezas y cables)", () => {
  const tg = new TweenGroup();
  const { rig, layout, stand } = build({ tweenGroup: tg });
  const S = obbs(stand, (n) => n.name);
  const isCable = (id) => layout.components[id] && layout.components[id].kind === "cable";
  const problems = [];
  for (const [seqName, presentEnd] of [["disassembly", false], ["assembly", true]]) {
    rig.syncFromSessionParts(Object.fromEntries(rig.partIds.map((id) => [id, !presentEnd])));
    for (const step of EQ.sequences[seqName].filter((s) => s.kind === "action")) {
      const id = step.partId;
      let settled = false;
      let worst = 0;
      rig.setPresence(id, presentEnd, { onSettled: () => { settled = true; } });
      for (let k = 0; k < 300 && !settled; k++) {
        tg.update(1 / 60);
        const obj = rig.getObject3D(id);
        rig.root.updateMatrixWorld(true);
        if (isCable(id)) {
          const bo = layout.components[id].buildOpts || {};
          const pts = [];
          if (bo.flat) {
            const ribbon = obj.children.find((c) => c.name === "cable-ribbon");
            const pos = ribbon.geometry.attributes.position;
            for (let i = 0; i < pos.count; i += 2) pts.push([new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(ribbon.matrixWorld), 0.0001]);
          } else {
            for (let s = 0; s <= 40; s++) pts.push([obj.userData.curve.getPointAt(s / 40).clone().applyMatrix4(obj.matrixWorld), bo.radius || 0.0012]);
          }
          for (const [p, r] of pts) for (const o of S) {
            const d = p.clone().sub(o.center); let out2 = 0, inside = true, minIn = Infinity;
            for (let a = 0; a < 3; a++) { const ex = Math.abs(d.dot(o.axes[a])) - o.half[a]; if (ex > 0) { out2 += ex * ex; inside = false; } else minIn = Math.min(minIn, -ex); }
            worst = Math.max(worst, inside ? r + minIn : r - Math.sqrt(out2));
          }
          continue;
        }
        const mine = obbs(obj, () => id);
        for (const m of mine) for (const s of S) if (m.aabb.intersectsBox(s.aabb)) worst = Math.max(worst, signedDepth(m, s));
      }
      assert.ok(settled, `${id}: la animacion no termino`);
      if (worst > 0.00005) problems.push(`${step.action} ${id}: atraviesa el soporte ${(worst * 1000).toFixed(2)} mm`);
    }
  }
  assert.deepEqual(problems, []);
});

test("4. el escritorio no tiene soporte ni estructura decorativa", () => {
  const layout = createDesktopLayout();
  assert.equal(layout.decor, undefined);
  const scene = new THREE.Scene();
  createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "desktop" });
  assert.equal(scene.getObjectByName("hwlab-decor-desktop"), undefined);
  assert.equal(scene.getObjectByName("laptop-service-stand"), undefined);
});
