"use strict";
// Fase 3 del portatil 3D (sep-2026): geometria fisicamente posible y
// accesible por donde se desarma un portatil real.
//
// Construye el portatil REAL con createRig() (la misma funcion que usa el
// laboratorio) y mide, sin navegador:
//   1. Colisiones entre piezas: cajas orientadas por malla (SAT), con los
//      cilindros medidos radialmente. Solo se toleran los ACOPLES reales
//      (borde de un modulo dentro de su conector) con un limite en mm.
//   2. Cables: el recorrido muestreado no atraviesa ninguna otra pieza.
//   3. Acceso de servicio: tras retirar la tapa inferior, cada pieza que el
//      desensamble guiado pide retirar a continuacion SE VE desde abajo
//      (raycast contra TODA la geometria visible, incluido el chasis).
//      Hallazgo que esto cierra: en la fase 2 habia un piso macizo bajo las
//      piezas y 10 de los 18 pasos apuntaban a piezas visibles en 0-3 % de
//      las direcciones de camara (solo se "seleccionaban" atravesando el
//      chasis).
//   4. SO-DIMM colgando de la placa: gira sobre sus contactos y se ALEJA de
//      la placa (antes solo se probaba boca arriba).
//   5. Cables flex: la cinta pasa por sus dos enchufes (bug de escala en Y).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, LF, rig, layout, EQ, TABLE;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  LF = await import(U("js/hardware_lab_3d_laptop_factory.js"));
  ({ TABLE } = await import(U("js/hardware_lab_3d_constants.js")));
  const { createRig } = await import(U("js/hardware_lab_3d_rig.js"));
  const { createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js"));
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"), ctx);
  EQ = ctx.window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;
  layout = createLaptopLayout();
  const scene = new THREE.Scene();
  rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "laptop" });
  scene.updateMatrixWorld(true);
});

// ── utilidades geometricas ──────────────────────────────────────────────────
function ownerOf(obj) {
  let n = obj;
  while (n && n.parent !== rig.root) n = n.parent;
  if (!n) return null;
  return n.userData.partId || (n.name === "laptop-base" ? "base" : n.name);
}
const isCablePart = (id) => !!(layout.components[id] && layout.components[id].kind === "cable");
function isInvisible(m) {
  const mat = m.material;
  return !mat || (mat.transparent && mat.opacity === 0) || (mat.isMeshBasicMaterial && mat.blending === THREE.AdditiveBlending);
}

function obbsOf(mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3());
  const hs = geo.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const mats = [];
  if (mesh.isInstancedMesh) {
    for (let i = 0; i < mesh.count; i++) {
      const m = new THREE.Matrix4();
      mesh.getMatrixAt(i, m);
      mats.push(mesh.matrixWorld.clone().multiply(m));
    }
  } else mats.push(mesh.matrixWorld);
  return mats.map((mw) => {
    const e = mw.elements;
    const raw = [new THREE.Vector3(e[0], e[1], e[2]), new THREE.Vector3(e[4], e[5], e[6]), new THREE.Vector3(e[8], e[9], e[10])];
    const len = raw.map((a) => a.length());
    const o = {
      mesh, cylinder: !mesh.isInstancedMesh && geo.type === "CylinderGeometry",
      center: c.clone().applyMatrix4(mw),
      axes: raw.map((a, i) => a.clone().divideScalar(len[i] || 1)),
      half: [hs.x * len[0], hs.y * len[1], hs.z * len[2]],
    };
    const ext = new THREE.Vector3();
    for (let k = 0; k < 3; k++) {
      ext.x += Math.abs(o.axes[k].x) * o.half[k];
      ext.y += Math.abs(o.axes[k].y) * o.half[k];
      ext.z += Math.abs(o.axes[k].z) * o.half[k];
    }
    o.aabb = new THREE.Box3(o.center.clone().sub(ext), o.center.clone().add(ext));
    return o;
  });
}

function satDepth(A, B) {
  const axes = [...A.axes, ...B.axes];
  for (const a of A.axes) for (const b of B.axes) {
    const c = a.clone().cross(b);
    if (c.lengthSq() > 1e-10) axes.push(c.normalize());
  }
  const d = B.center.clone().sub(A.center);
  let min = Infinity;
  for (const L of axes) {
    const r = (O) => O.half[0] * Math.abs(O.axes[0].dot(L)) + O.half[1] * Math.abs(O.axes[1].dot(L)) + O.half[2] * Math.abs(O.axes[2].dot(L));
    const ov = r(A) + r(B) - Math.abs(d.dot(L));
    if (ov <= 0) return 0;
    min = Math.min(min, ov);
  }
  return min;
}

// Un cilindro medido como caja da falsos positivos en sus esquinas.
function radialPen(C, O) {
  if (!C.cylinder) return Infinity;
  const q = O.center.clone();
  const d = C.center.clone().sub(O.center);
  for (let k = 0; k < 3; k++) q.addScaledVector(O.axes[k], Math.max(-O.half[k], Math.min(O.half[k], d.dot(O.axes[k]))));
  const rel = q.sub(C.center);
  const radial = rel.clone().sub(C.axes[1].clone().multiplyScalar(rel.dot(C.axes[1]))).length();
  return Math.max(C.half[0], C.half[2]) - radial;
}

function solidObbs() {
  const out = [];
  rig.root.traverse((n) => {
    if (!n.isMesh || isInvisible(n)) return;
    const owner = ownerOf(n);
    const geoType = n.geometry && n.geometry.type;
    // Tubos y cintas de cable se miden por muestreo del recorrido (test 2).
    if (geoType === "TubeGeometry" || n.name === "cable-ribbon") return;
    obbsOf(n).forEach((o) => { o.owner = owner; out.push(o); });
  });
  return out;
}

// Acoples reales: el borde de contactos de un modulo DENTRO de su conector
// (y los ganchos del socket SO-DIMM, que entran en las muescas del PCB: la
// caja envolvente del PCB no ve la muesca). Limite en metros.
const MATING = {
  "motherboard|ram": 0.0015,
  "motherboard|ssd-m2": 0.0009,
  "motherboard|wifi-card": 0.0009,
};

test("1. ninguna pieza del portatil atraviesa a otra (salvo acoples reales modulo-conector)", () => {
  const obbs = solidObbs();
  const problems = new Map();
  for (let i = 0; i < obbs.length; i++) {
    for (let j = i + 1; j < obbs.length; j++) {
      const A = obbs[i], B = obbs[j];
      if (A.owner === B.owner || !A.aabb.intersectsBox(B.aabb)) continue;
      let depth = satDepth(A, B);
      if (depth <= 0.0002) continue;
      depth = Math.min(depth, radialPen(A, B), radialPen(B, A));
      if (depth <= 0.0002) continue;
      const key = [A.owner, B.owner].sort().join("|");
      if (MATING[key] != null && depth <= MATING[key]) continue;
      problems.set(key, Math.max(problems.get(key) || 0, depth));
    }
  }
  const list = [...problems.entries()].map(([k, v]) => `${k}: ${(v * 1000).toFixed(2)} mm`);
  assert.deepEqual(list, [], "colisiones fisicas:\n" + list.join("\n"));
});

test("2. ningun cable atraviesa otra pieza en su recorrido", () => {
  const obbs = solidObbs();
  const problems = [];
  rig.partIds.filter(isCablePart).forEach((id) => {
    const obj = rig.getObject3D(id);
    const bo = layout.components[id].buildOpts || {};
    // Puntos a medir: para un tubo, su eje (con su radio); para una CINTA, las
    // esquinas y los centros de sus bordes anchos en cada seccion, con su
    // espesor real (una esfera del medio ancho la haria chocar con todo).
    const samples = [];
    if (bo.flat) {
      const ribbon = obj.children.find((c) => c.name === "cable-ribbon");
      const pos = ribbon.geometry.attributes.position;
      const rings = pos.count / 4;
      for (let i = 0; i < rings; i++) {
        const t = i / (rings - 1);
        if (t < 0.06 || t > 0.94) continue;
        const c = [0, 1, 2, 3].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i * 4 + k).applyMatrix4(ribbon.matrixWorld));
        [c[0], c[1], c[2], c[3], c[0].clone().lerp(c[1], 0.5), c[2].clone().lerp(c[3], 0.5)].forEach((p) => samples.push({ p, t, radius: 0.0001 }));
      }
    } else {
      for (let s = 0; s <= 60; s++) {
        const t = s / 60;
        if (t < 0.06 || t > 0.94) continue; // los extremos entran a su conector
        samples.push({ p: obj.userData.curve.getPointAt(t).clone().applyMatrix4(obj.matrixWorld), t, radius: bo.radius || 0.0012 });
      }
    }
    for (const { p, t, radius } of samples) {
      for (const o of obbs) {
        if (o.owner === id) continue;
        const d = p.clone().sub(o.center);
        let out2 = 0, inside = true, minIn = Infinity;
        for (let k = 0; k < 3; k++) {
          const ex = Math.abs(d.dot(o.axes[k])) - o.half[k];
          if (ex > 0) { out2 += ex * ex; inside = false; } else minIn = Math.min(minIn, -ex);
        }
        let pen = inside ? radius + minIn : radius - Math.sqrt(out2);
        if (pen > 0 && o.cylinder) {
          const rel = p.clone().sub(o.center);
          const radial = rel.clone().sub(o.axes[1].clone().multiplyScalar(rel.dot(o.axes[1]))).length();
          pen = Math.min(pen, radius + Math.max(o.half[0], o.half[2]) - radial);
        }
        if (pen > 0.0004) problems.push(`${id} t=${t.toFixed(2)} dentro de ${o.owner} ${(pen * 1000).toFixed(2)} mm`);
      }
    }
  });
  assert.deepEqual([...new Set(problems)].slice(0, 12), []);
});

test("3. acceso de servicio: tras retirar la tapa inferior, cada pieza del desensamble se VE desde abajo", () => {
  const steps = EQ.sequences.disassembly.filter((s) => s.kind === "action");
  const fromTop = new Set(["keyboard", "touchpad", "screen-assembly"]);
  const raycaster = new THREE.Raycaster();
  const removed = new Set();
  const failures = [];
  steps.forEach((step) => {
    const state = {};
    rig.partIds.forEach((id) => { state[id] = !removed.has(id); });
    rig.syncFromSessionParts(state);
    rig.root.updateMatrixWorld(true);
    removed.add(step.partId);
    if (step.partId === "bottom-cover" || fromTop.has(step.partId)) return;

    const target = rig.getObject3D(step.partId);
    const visible = [];
    rig.root.traverse((n) => { if (n.isMesh && !isInvisible(n)) visible.push(n); });
    const pts = [];
    target.traverse((n) => { if (n.isMesh && !isInvisible(n)) obbsOf(n).slice(0, 6).forEach((o) => pts.push(o.center)); });
    const center = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
    // Camaras BAJO el equipo (nunca bajo la mesa), a 45 grados en 8 rumbos.
    let best = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const cam = center.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, -0.12, Math.sin(a) * 0.12));
      if (cam.y < TABLE.topY + 0.02) continue;
      let hits = 0;
      pts.forEach((p) => {
        const dir = p.clone().sub(cam);
        raycaster.set(cam, dir.clone().normalize());
        raycaster.far = dir.length() + 0.01;
        const h = raycaster.intersectObjects(visible, false);
        if (h.length && ownerOf(h[0].object) === step.partId) hits++;
      });
      best = Math.max(best, pts.length ? hits / pts.length : 0);
    }
    if (best < 0.4) failures.push(`${step.action} ${step.partId}: solo ${(best * 100).toFixed(0)} % visible desde abajo`);
  });
  assert.deepEqual(failures, []);
});

test("3b. el chasis del portatil bloquea el clic (oclusor) y solo el portatil lo registra", () => {
  const inter = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_interactions.js"), "utf8");
  assert.match(inter, /function registerOccluder\(/);
  assert.match(inter, /isUnderOccluder\(hit\.object\)\) return null/, "un impacto en el chasis debe cortar la seleccion");
  const rigSrc = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_rig.js"), "utf8");
  assert.match(rigSrc, /equipmentId === "laptop" && interactions && interactions\.registerOccluder/);
});

test("4. SO-DIMM colgando de la placa: pivota en los contactos y el extremo libre se ALEJA de la placa", () => {
  const entryObj = rig.getObject3D("ram");
  const state = {};
  rig.partIds.forEach((id) => { state[id] = true; });
  rig.syncFromSessionParts(state);
  const home = entryObj.position.clone();
  const homeQuat = entryObj.quaternion.clone();
  const opts = { homePosition: home, homeQuaternion: homeQuat, moduleDepth: 0.030, thickness: 0.0012, travel: 0.030 };
  const contacts = (p) => new THREE.Vector3(0, -0.0006, 0.015).applyQuaternion(p.quaternion).add(p.position);
  const freeEnd = (p) => new THREE.Vector3(0, 0, -0.015).applyQuaternion(p.quaternion).add(p.position);
  const p0 = LF.computeSoDimmPose(0, opts);
  for (const t of [0.2, 0.4, 0.6]) {
    assert.ok(contacts(LF.computeSoDimmPose(t, opts)).distanceTo(contacts(p0)) < 1e-6, `contactos fuera del socket en t=${t}`);
  }
  // La placa esta ENCIMA del modulo: alejarse = bajar.
  assert.ok(freeEnd(LF.computeSoDimmPose(0.6, opts)).y < freeEnd(p0).y - 0.005, "el extremo libre debe bajar (alejarse de la placa)");
  const a = LF.computeSoDimmPose(0.6, opts).position, b = LF.computeSoDimmPose(1, opts).position;
  assert.ok(b.y < a.y - 0.010, "la extraccion sigue hacia abajo");
  assert.ok(Math.abs(b.z - a.z) > 0.020, "y hacia fuera del socket");
});

test("5. los cables flex son cintas que pasan por sus dos enchufes (no un recorrido aplastado en Y)", () => {
  ["cable-keyboard-flex", "cable-touchpad-flex", "cable-screen-flex"].forEach((id) => {
    const group = rig.getObject3D(id);
    const ribbon = group.children.find((c) => c.isMesh && c.name === "cable-ribbon");
    assert.ok(ribbon, `${id} debe dibujarse como cinta`);
    assert.equal(ribbon.scale.y, 1, `${id}: la cinta no debe escalarse en Y (aplastaba el recorrido)`);
    // Mismo espacio que curveEndpoints (local del equipo).
    ribbon.geometry.computeBoundingBox();
    const box = ribbon.geometry.boundingBox.clone().expandByScalar(0.002);
    // Cinta PLANA: su dimension menor (espesor) no puede ser el ancho que se ve
    // desde abajo. Se muestrea la seccion en un tramo que baja: el ancho medido
    // en horizontal debe ser el de la cinta, no su espesor.
    const bo = layout.components[id].buildOpts;
    const pos = ribbon.geometry.attributes.position;
    const ring = (i) => [0, 1, 2, 3].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i * 4 + k));
    const mid = Math.floor(pos.count / 8);
    const r = ring(mid);
    const horizWidth = Math.hypot(r[0].x - r[1].x, r[0].z - r[1].z);
    assert.ok(Math.abs(horizWidth - bo.ribbonWidth) < 0.0005, `${id}: ancho horizontal ${(horizWidth * 1000).toFixed(2)} mm, esperado ${bo.ribbonWidth * 1000} mm (cinta de canto)`);
    group.userData.curveEndpoints.forEach((p, i) => {
      assert.ok(box.containsPoint(p), `${id}: el extremo ${i} (${p.toArray().map((v) => (v * 1000).toFixed(1))}) queda fuera de la cinta`);
    });
  });
});

test("6. cada puerto externo queda dentro de la banda de la placa (tiene conector al que llegar)", () => {
  const B = LF.LAPTOP.board;
  LF.LAPTOP_PORTS.forEach((p) => {
    assert.ok(Math.abs(p.along - B.centerZ) + p.w / 2 <= B.depth / 2, `${p.id} fuera de la placa`);
  });
});

test("7. el equipo de escritorio sigue construyendose igual (cables tubulares, sin oclusores)", async () => {
  const { createRig } = await import(U("js/hardware_lab_3d_rig.js"));
  const { createDesktopLayout } = await import(U("js/hardware_lab_3d_layout_desktop.js"));
  const registered = [];
  const fakeInteractions = {
    registerInteractive: () => {},
    unregisterInteractive: () => {},
    registerOccluder: (o) => registered.push(o),
    unregisterOccluder: () => {},
  };
  globalThis.window = globalThis.window || globalThis;
  const scene = new THREE.Scene();
  const desk = createRig({ scene, interactions: fakeInteractions, tweenGroup: null, layout: createDesktopLayout(), equipmentId: "desktop" });
  assert.equal(registered.length, 0, "el escritorio no registra oclusores");
  desk.partIds.forEach((id) => {
    const obj = desk.getObject3D(id);
    obj.traverse((n) => {
      if (n.isMesh && n.name === "cable-ribbon") assert.fail(`${id}: el escritorio no usa cintas`);
    });
  });
});
