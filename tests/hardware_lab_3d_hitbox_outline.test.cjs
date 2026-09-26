"use strict";
// Geometria visible / hitbox / resaltado separados (auditoria sep-26).
//
// Medido antes: el contorno de "Pantalla (conjunto completo)" con la tapa
// abierta media 356x234x58 mm sobre los ejes de la pieza frente a 330x15x222
// visibles (4.5 veces el volumen): se construia con la caja de MUNDO y se
// colgaba como hija de la pieza, heredando su giro. Los cables salian 2-4 veces
// mas grandes porque la caja incluia su hitbox, y los 32 hitboxes (opacidad 0)
// se dibujaban igual.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let THREE, createRig, createLaptopLayout, createDesktopLayout, visibleLocalBox, isHitbox;

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
  ({ createDesktopLayout } = await import(U("js/hardware_lab_3d_layout_desktop.js")));
  ({ visibleLocalBox } = await import(U("js/hardware_lab_3d_interactions.js")));
  ({ isHitbox } = await import(U("js/hardware_lab_3d_constants.js")));
});

function build(equipmentId) {
  const scene = new THREE.Scene();
  const layout = equipmentId === "laptop" ? createLaptopLayout() : createDesktopLayout();
  const rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId });
  scene.updateMatrixWorld(true);
  return { rig, scene };
}

/** Caja visible de referencia: OBB por malla en el marco de la pieza, sin hitboxes ni mallas ocultas. */
function reference(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  root.traverse((n) => {
    if (!n.isMesh || isHitbox(n) || !n.visible) return;
    if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
    const bb = n.isInstancedMesh ? (n.computeBoundingBox(), n.boundingBox) : n.geometry.boundingBox;
    box.union(bb.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld)));
  });
  return box;
}

test("H01. el contorno de CADA pieza del portatil se ajusta a su geometria visible (tambien la pantalla abierta)", () => {
  const { rig } = build("laptop");
  const problems = [];
  for (const angle of [rig.lidConfig.openAngle, -Math.PI / 2, rig.lidConfig.closedAngle]) {
    rig.setPose({ lid: angle }, { animate: false });
    rig.partIds.forEach((id) => {
      const obj = rig.getObject3D(id);
      const got = visibleLocalBox(obj);
      const ref = reference(obj);
      const d = got.min.distanceTo(ref.min) + got.max.distanceTo(ref.max);
      if (d > 1e-6) problems.push(`${id} @${angle.toFixed(2)}: contorno desviado ${(d * 1000).toFixed(2)} mm`);
    });
  }
  assert.deepEqual(problems, []);
  // La pantalla: su contorno local es la losa de la tapa, no la caja de mundo.
  rig.setPose({ lid: rig.lidConfig.openAngle }, { animate: false });
  const s = visibleLocalBox(rig.getObject3D("screen-assembly")).getSize(new THREE.Vector3()).multiplyScalar(1000);
  assert.ok(s.y < 20, `pantalla: el eje de grosor del contorno mide ${s.y.toFixed(0)} mm (antes 234)`);
  assert.ok(Math.abs(s.x - 330) < 3 && Math.abs(s.z - 222) < 3, `pantalla: ${s.x.toFixed(0)}x${s.z.toFixed(0)} mm`);
});

test("H02. el contorno no crece por contornos ya colgados ni por la escala de hover", () => {
  const { rig } = build("laptop");
  const obj = rig.getObject3D("keyboard");
  const before = visibleLocalBox(obj).getSize(new THREE.Vector3());
  const hover = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial());
  hover.name = "hwlab-outline-hover";
  obj.add(hover);
  obj.scale.setScalar(1.035);
  const after = visibleLocalBox(obj).getSize(new THREE.Vector3());
  assert.ok(after.distanceTo(before) < 1e-9, "el contorno cambio al haber otro contorno o escala de hover");
});

test("H03. hitboxes: ocultos, sin sombra, marcados y fuera del contorno, en portatil y escritorio", () => {
  for (const eq of ["laptop", "desktop"]) {
    const { rig } = build(eq);
    let n = 0;
    rig.root.traverse((m) => {
      if (!m.isMesh || !/hit-proxy/.test(m.name)) return;
      n++;
      assert.equal(isHitbox(m), true, `${eq}: ${m.name} sin marcar`);
      assert.equal(m.visible, false, `${eq}: ${m.name} se dibuja`);
      assert.equal(m.castShadow, false, `${eq}: ${m.name} proyecta sombra`);
      assert.equal(m.receiveShadow, false);
    });
    assert.ok(n > 0, `${eq}: no se encontraron hitboxes`);
  }
  // Los cables: su contorno visible es MENOR que la caja con hitbox (antes 2-4x).
  const { rig } = build("laptop");
  ["cable-battery", "cable-screen-flex", "wifi-antenna-2"].forEach((id) => {
    const obj = rig.getObject3D(id);
    const vis = visibleLocalBox(obj).getSize(new THREE.Vector3());
    const all = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    assert.ok(vis.x * vis.y * vis.z < all.x * all.y * all.z * 0.8, `${id}: el contorno sigue incluyendo el hitbox`);
  });
});

test("H04. el hitbox oculto SIGUE recibiendo el clic (raycast) y los tornillos tambien lo tienen oculto", async () => {
  const Screws = await import(U("js/hardware_lab_3d_screws.js"));
  const screw = Screws.buildServiceScrew();
  const proxy = screw.getObjectByName("screw-hit-proxy");
  assert.equal(isHitbox(proxy), true);
  assert.equal(proxy.visible, false);
  screw.updateMatrixWorld(true);
  // En reposo el hitbox esta a escala 0.45 (radio ~2 mm): el rayo va por dentro.
  const rc = new THREE.Raycaster(new THREE.Vector3(0.001, 0.2, 0), new THREE.Vector3(0, -1, 0));
  const hits = rc.intersectObject(screw, true);
  assert.ok(hits.some((h) => h.object === proxy), "el raycast no alcanza el hitbox oculto");
  // Un cable fino: el rayo que pasa JUNTO al tubo visible toca su hitbox.
  const { rig } = build("laptop");
  const cable = rig.getObject3D("cable-battery");
  const hb = []; cable.traverse((m) => { if (isHitbox(m)) hb.push(m); });
  assert.ok(hb.length === 1);
  const c = new THREE.Box3().setFromObject(hb[0]).getCenter(new THREE.Vector3());
  const r2 = new THREE.Raycaster(c.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(0, -1, 0));
  assert.ok(r2.intersectObject(cable, true).length > 0, "el cable dejo de ser clicable");
});

// Avisos de tornillos (sep-26): el controlador de la practica escribe en el
// MISMO aviso desde onChanged (bloqueos, "vuelve a ponerlo derecho..."). Si la
// confirmacion "Tornillo instalado/retirado" llegaba despues, lo tapaba: se
// reprodujo con clic real (mismo milisegundo, el ultimo en escribir gana).
test("H05. tornillos: la confirmacion (notify) llega ANTES que onChanged al colocar y al retirar", async () => {
  const Screws = await import(U("js/hardware_lab_3d_screws.js"));
  const { TweenGroup } = await import(U("js/hardware_lab_3d_tween.js"));
  const { rig } = build("laptop");
  const orden = [];
  const tweenGroup = new TweenGroup();
  const ctl = Screws.createScrewController({
    group: new THREE.Group(),
    entries: rig.screwEntries.map((e) => ({ id: e.id, partId: e.partId, label: e.label, partName: e.partName, object3d: e.object3d, homePosition: e.homePosition.clone(), outDir: e.outDir.clone() })),
    tweenGroup,
    dishOrigin: rig.screwDishOrigin,
    floorY: 0.78,
    canOperatePart: () => ({ ok: true }),
    onChanged: (id, installed) => orden.push("onChanged:" + (installed ? "puesto" : "fuera")),
    notify: (m) => orden.push("notify:" + m.split(":")[0]),
    onBusyChange: () => {},
  });
  ctl.setState(null, { defaultInstalled: true });
  const correr = () => { for (let i = 0; i < 300; i++) tweenGroup.update(0.05); };
  assert.equal(ctl.handleScrewClick("cover-1").ok, true);
  correr();
  assert.equal(ctl.get("cover-1").installed, false);
  assert.equal(ctl.handleScrewClick("cover-1").ok, true);
  correr();
  assert.equal(ctl.get("cover-1").installed, true);
  assert.deepEqual(orden, ["notify:Tornillo retirado", "onChanged:fuera", "notify:Tornillo instalado", "onChanged:puesto"]);
});

// cable-cpu-fan del ESCRITORIO (sep-26): el cable estaba trazado por DENTRO
// del disipador, asi que ningun clic lo alcanzaba (0 % de los rayos) y el
// aprendiz era penalizado al pulsar el disipador, el cable EPS o la fuente.
// Misma regla que el producto (interactions.raycastRoot): la PRIMERA malla de
// una pieza registrada, visible u oculta (Raycaster no filtra `visible`).
test("H06. escritorio: cable-cpu-fan seleccionable en su paso, sin quitar la fuente ni el disipador", () => {
  const { createRequire } = require("node:module");
  const req = createRequire(path.join(ROOT, "x.js"));
  globalThis.window = globalThis;
  globalThis.HardwareLab = Object.assign(globalThis.HardwareLab || {}, { Tools: req("./js/hardware_lab_tools.js") });
  const Engine = req("./js/hardware_lab_engine.js");
  const desk = req("./js/hardware_lab_data_desktop.js").DESKTOP_EQUIPMENT;
  // Estado REAL del desensamble guiado justo en "desconectar cable-cpu-fan".
  let s = Engine.createSession(desk, "disassembly-guided");
  for (let g = 0; g < 100; g++) {
    const st = Engine.currentStep(s);
    if (st.kind === "action" && st.partId === "cable-cpu-fan") break;
    s = (st.kind === "safety" ? Engine.attemptSafetyStep(s, st.id) : Engine.attemptAction(desk, s, { partId: st.partId, action: st.action, toolId: desk.parts[st.partId].tool || "hands" })).session;
  }
  const { rig, scene } = build("desktop");
  rig.syncFromSessionParts(s.parts);
  scene.updateMatrixWorld(true);
  const roots = rig.partIds.filter((id) => s.parts[id] !== false).map((id) => rig.getObject3D(id));
  const partOf = (n) => { for (let o = n; o; o = o.parent) if (o.userData && o.userData.partId) return o.userData.partId; return null; };
  // 24 direcciones del lado abierto del gabinete (+x, donde iba la tapa lateral).
  const dirs = [];
  for (const el of [-0.35, 0, 0.35, 0.7]) for (const az of [-0.9, -0.5, -0.15, 0.15, 0.5, 0.9]) dirs.push(new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize());
  const samples = (id) => { const pts = []; rig.getObject3D(id).traverse((m) => { if (!m.isMesh || isHitbox(m)) return; const pa = m.geometry.attributes.position; const step = Math.max(1, Math.floor(pa.count / 30)); for (let i = 0; i < pa.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld)); }); return pts; };
  const rc = new THREE.Raycaster();
  const selectable = (id) => {
    let ok = 0, n = 0;
    for (const p of samples(id)) for (const d of dirs) {
      rc.set(p.clone().addScaledVector(d, 1.5), d.clone().negate());
      const h = rc.intersectObjects(roots, true).find((x) => x.object.isMesh);
      if (!h) continue;
      n++; if (partOf(h.object) === id) ok++;
    }
    return ok / Math.max(1, n);
  };
  // La causa: ningun punto del cable dentro del volumen del disipador.
  const cooler = new THREE.Box3(); rig.getObject3D("cooler").traverse((m) => { if (m.isMesh && !isHitbox(m)) cooler.union(new THREE.Box3().setFromObject(m, true)); });
  const inside = samples("cable-cpu-fan").filter((p) => cooler.containsPoint(p)).length;
  assert.equal(inside, 0, `${inside} puntos del cable siguen dentro del disipador`);
  const cable = selectable("cable-cpu-fan");
  assert.ok(cable >= 0.6, `cable-cpu-fan solo es el primer impacto en ${(cable * 100).toFixed(1)} % de los rayos (antes 0 %)`);
  // Y no se arregla a costa de sus vecinos (medido antes: fuente 82.5 %, disipador 72.2 %).
  assert.ok(selectable("psu") >= 0.8, "la fuente dejo de ser facil de seleccionar");
  assert.ok(selectable("cooler") >= 0.7, "el disipador dejo de ser facil de seleccionar");
});
