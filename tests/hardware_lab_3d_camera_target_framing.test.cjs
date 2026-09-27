"use strict";
// ENCUADRE POR PIEZA OBJETIVO (sep-26). Medido con clic real antes de corregir:
// tras cada pieza retirada la camara se acercaba a 0,22 m de ESA pieza y el
// objetivo siguiente quedaba fuera (390x844: antena Wi-Fi 1 al 2 %, cable del
// ventilador al 0 %; 768x1024: cable del ventilador al 0 %, antena al 24 %).
// Aqui se usa el rig REAL del portatil en el estado de cada paso, su posicion
// de trabajo y la direccion de su vista de trabajo, con el area segura de cada
// tamano de pantalla, y se proyecta la geometria VISIBLE de la pieza con una
// camara real de three.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;
let THREE, Cam, L, createRig, createLaptopLayout, DISASSEMBLY;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0, style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  Cam = await import(U("js/hardware_lab_3d_camera.js"));
  L = await import(U("js/hardware_lab_3d_ui_layout.js"));
  ({ createRig } = await import(U("js/hardware_lab_3d_rig.js")));
  ({ createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js")));
  // Secuencia real de desensamble (script clasico que cuelga de window).
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  new Function("window", fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"))(sandbox.window);
  DISASSEMBLY = sandbox.window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT.sequences.disassembly.filter((s) => s.kind === "action");
});

// Canvas y rectangulos de interfaz MEDIDOS en el navegador para cada tamano.
const VIEWPORTS = {
  "390x844": { w: 390, h: 644, card: [8, 8, 382, 63], dock: [8, 532, 382, 588], history: [8, 598, 382, 636] },
  "768x1024": { w: 768, h: 895, card: [417, 12, 755, 400], dock: [12, 12, 299, 68], history: [12, 845, 286, 883] },
  "1024x625": { w: 1024, h: 504, card: [693, 12, 1011, 371], dock: [8, 8, 295, 64], history: [8, 458, 282, 496] },
  "1440x900": { w: 1440, h: 771, card: [1089, 12, 1427, 371], dock: [12, 12, 202, 459], history: [12, 721, 286, 759] },
};
const R = (a) => (a ? { left: a[0], top: a[1], right: a[2], bottom: a[3] } : null);

function rigAtStep(targetId) {
  const rig = createRig({ scene: new THREE.Scene(), interactions: null, tweenGroup: null, layout: createLaptopLayout(), equipmentId: "laptop" });
  for (const st of DISASSEMBLY) {
    if (st.partId === targetId) break;
    rig.setPresence(st.partId, false, { animate: false });
  }
  const preset = rig.workPresetFor(targetId, rig.partAccess(targetId));
  rig.setPose(rig.presetPose(preset), { animate: false });
  rig.root.updateMatrixWorld(true);
  return { rig, preset };
}

function visibleWorldBox(obj) {
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);
  obj.traverse((m) => {
    if (!m.isMesh || (m.userData && m.userData.hwlabHitbox)) return;
    for (let q = m; q; q = q.parent) if (!q.visible) return;
    box.expandByObject(m);
  });
  return box;
}

function screenPoints(obj, cam, vp) {
  const pts = [];
  obj.traverse((n) => {
    if (!n.isMesh || (n.userData && n.userData.hwlabHitbox)) return;
    for (let q = n; q; q = q.parent) if (!q.visible) return;
    const push = (v) => { const p = v.project(cam); pts.push({ x: ((p.x + 1) / 2) * vp.w, y: ((1 - p.y) / 2) * vp.h, front: p.z > -1 && p.z < 1 }); };
    if (n.geometry.parameters && n.geometry.parameters.path) { for (let k = 0; k <= 24; k++) push(n.geometry.parameters.path.getPointAt(k / 24).applyMatrix4(n.matrixWorld)); return; }
    if (n.isInstancedMesh) {
      const m = new THREE.Matrix4(), c = new THREE.Vector3();
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      n.geometry.boundingBox.getCenter(c);
      for (let i = 0; i < n.count; i++) { n.getMatrixAt(i, m); push(c.clone().applyMatrix4(m).applyMatrix4(n.matrixWorld)); }
      return;
    }
    const pa = n.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pa.count / 24));
    for (let i = 0; i < pa.count; i += step) push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(n.matrixWorld));
  });
  return pts;
}

function frameFor(targetId, vpName) {
  const vp = VIEWPORTS[vpName];
  const { rig, preset } = rigAtStep(targetId);
  const obj = rig.getObject3D(targetId);
  const safe = L.safeViewRect({ scene: { left: 0, top: 0, right: vp.w, bottom: vp.h }, card: R(vp.card), dock: R(vp.dock), history: R(vp.history) });
  const ndcRect = [(safe.left / vp.w) * 2 - 1, (safe.right / vp.w) * 2 - 1, 1 - (safe.bottom / vp.h) * 2, 1 - (safe.top / vp.h) * 2];
  const focus = Cam.padFocusBox(visibleWorldBox(obj));
  const f = Cam.frameBoxInRect({ box: focus.box, dir: rig.workViewDir(preset), fovY: 42, aspect: vp.w / vp.h, ndcRect, minDist: 0.2, maxDist: 5.85 });
  const cam = new THREE.PerspectiveCamera(42, vp.w / vp.h, 0.05, 60);
  cam.position.copy(f.pos);
  cam.lookAt(f.target);
  cam.updateMatrixWorld(true);
  const pts = screenPoints(obj, cam, vp);
  return { f, focus, safe, pts, verdict: L.framingVerdict(pts, safe, { large: focus.large }), preset };
}

const CRITICAS = ["wifi-antenna-1", "wifi-antenna-2", "cable-cpu-fan-laptop", "ram", "cable-touchpad-flex", "screen-assembly", "bottom-cover", "motherboard", "cable-keyboard-flex", "ssd-m2"];

test("F01. area segura: se recortan las BANDAS de interfaz, no la tarjeta flotante de escritorio", () => {
  const movil = L.safeViewRect({ scene: { left: 0, top: 0, right: 390, bottom: 644 }, card: R(VIEWPORTS["390x844"].card), dock: R(VIEWPORTS["390x844"].dock), history: R(VIEWPORTS["390x844"].history) });
  assert.deepEqual([movil.top, movil.bottom], [71, 524], "movil: debajo de la banda de la tarjeta y encima de la barra del dock");
  const esc = L.safeViewRect({ scene: { left: 0, top: 0, right: 1440, bottom: 771 }, card: R(VIEWPORTS["1440x900"].card), dock: R(VIEWPORTS["1440x900"].dock), history: R(VIEWPORTS["1440x900"].history) });
  assert.equal(esc.left, 210, "escritorio: a la derecha de la columna del dock");
  assert.equal(esc.right, 1432, "la tarjeta flotante se aparta sola: no recorta");
  const tablet = L.safeViewRect({ scene: { left: 0, top: 0, right: 768, bottom: 895 }, card: R(VIEWPORTS["768x1024"].card), dock: R(VIEWPORTS["768x1024"].dock), history: R(VIEWPORTS["768x1024"].history) });
  assert.deepEqual([tablet.left, tablet.top, tablet.right, tablet.bottom], [8, 8, 760, 837], "el dock compacto (se aparta) no recorta; el historial SIEMPRE recorta abajo");
  assert.equal(esc.bottom, 713, "escritorio: el historial fijo recorta abajo");
});

for (const vpName of Object.keys(VIEWPORTS)) {
  test(`F02. ${vpName}: cada pieza critica queda >= 90 % dentro del area segura (80 % las muy grandes), sin NaN ni sobre-zoom`, () => {
    for (const id of CRITICAS) {
      const r = frameFor(id, vpName);
      const nums = [r.f.pos.x, r.f.pos.y, r.f.pos.z, r.f.target.x, r.f.target.y, r.f.target.z, r.f.dist];
      assert.ok(nums.every(Number.isFinite), `${id}: NaN en la camara`);
      assert.ok(!r.focus.box.isEmpty(), `${id}: caja vacia`);
      assert.ok(r.f.dist >= 0.2 - 1e-9 && r.f.dist <= 5.85 + 1e-9, `${id}: distancia ${r.f.dist}`);
      assert.ok(r.f.pos.y >= Cam.CAMERA_MIN_WORLD_Y, `${id}: camara bajo la mesa (${r.f.pos.y})`);
      assert.ok(r.verdict.ok, `${id} @ ${vpName}: dentro ${Math.round(r.verdict.inside * 100)} %, ${Math.round(r.verdict.sizePx)} px`);
      // Contexto: una pieza no grande no llena el area segura (se ve donde esta).
      if (!r.focus.large) {
        const xs = r.pts.map((p) => p.x), ys = r.pts.map((p) => p.y);
        const fw = (Math.max(...xs) - Math.min(...xs)) / (r.safe.right - r.safe.left);
        const fh = (Math.max(...ys) - Math.min(...ys)) / (r.safe.bottom - r.safe.top);
        assert.ok(!(fw > 0.92 && fh > 0.92), `${id} @ ${vpName}: sobre-zoom (${fw.toFixed(2)} x ${fh.toFixed(2)})`);
      }
    }
  });
}

test("F03. estabilidad (histeresis): recalcular sobre el encuadre ya obtenido NO pide moverse", () => {
  for (const vpName of ["390x844", "1024x625"]) {
    for (const id of ["wifi-antenna-1", "cable-cpu-fan-laptop", "screen-assembly"]) {
      const r = frameFor(id, vpName);
      assert.ok(r.verdict.ok, `${id} @ ${vpName}: el propio encuadre no es aceptable`);
      // Mismo calculo desde la camara resultante: misma posicion (sin deriva).
      const vp = VIEWPORTS[vpName];
      const ndcRect = [(r.safe.left / vp.w) * 2 - 1, (r.safe.right / vp.w) * 2 - 1, 1 - (r.safe.bottom / vp.h) * 2, 1 - (r.safe.top / vp.h) * 2];
      const again = Cam.frameBoxInRect({ box: r.focus.box, dir: r.f.pos.clone().sub(r.f.target), fovY: 42, aspect: vp.w / vp.h, ndcRect, minDist: 0.2, maxDist: 5.85 });
      assert.ok(again.pos.distanceTo(r.f.pos) < 1e-3, `${id} @ ${vpName}: deriva ${again.pos.distanceTo(r.f.pos)}`);
    }
  }
});

test("F04. la direccion de trabajo se conserva (misma orientacion, solo distancia y centrado)", () => {
  const r = frameFor("wifi-antenna-1", "390x844");
  const { rig } = rigAtStep("wifi-antenna-1");
  const want = rig.workViewDir(r.preset).normalize();
  const got = r.f.pos.clone().sub(r.f.target).normalize();
  assert.ok(want.angleTo(got) < 1e-6, "el angulo de la vista cambio");
});

test("F05. el stage solo comprueba en momentos concretos: nunca en cada cuadro y nunca tras orbitar", () => {
  const stage = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_stage.js"), "utf8");
  const onTickBodies = stage.split("onTick(").slice(1).map((c) => c.slice(0, 900));
  onTickBodies.forEach((b) => assert.doesNotMatch(b, /tryFrameCheck\(|frameBoxInRect\(/));
  assert.match(stage, /if \(!frameState\.done\) scheduleFrameCheck\(80\);/, "tras un movimiento solo si hay una comprobacion PENDIENTE");
  assert.doesNotMatch(stage.slice(stage.indexOf('addEventListener("end"'), stage.indexOf('addEventListener("end"') + 120), /FrameCheck/, "orbitar no reencuadra");
  // Una vez comprobada la pieza, no se vuelve a mover por ella (hasta que cambie el objetivo o la ventana).
  assert.match(stage, /frameState\.done = true;\n\s+if \(!plan\.ok\) cameraRig\.flyTo\(plan\.frame\.pos, plan\.frame\.target\); \/\/ si ya se ve bien: la camara NO se mueve/);
  assert.match(stage, /if \(verdict\.ok\) return \{ ok: true \};/);
  // Preparar / Vista de trabajo: se planifica ANTES de volar y hay UN solo vuelo
  // (un segundo vuelo justo despues provoco un clic equivocado y penalizado).
  const fwv = stage.slice(stage.indexOf("function frameWorkView("), stage.indexOf("function frameWorkView(") + 1600);
  assert.match(fwv, /const plan = planTargetFrame\(cam, wf\.target\);[\s\S]*frameState\.done = true;[\s\S]*cameraRig\.flyTo\(plan\.frame\.pos, plan\.frame\.target, opts\);\n\s+return;/);
  assert.doesNotMatch(stage, /framingActive\(\)\) frameState\.done = false;/, "no se re-comprueba despues del vuelo de trabajo (seria un segundo vuelo)");
  // En la practica guiada la camara ya no persigue la pieza clicada.
  assert.match(stage, /function focusOnPart\(partId\) \{[\s\S]{0,700}if \(framingActive\(\)\) \{\n\s+frameState\.done = false;/);
  // Nada de setViewOffset ni cambios de FOV.
  assert.doesNotMatch(stage + fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_camera.js"), "utf8"), /setViewOffset|\.fov\s*=[^=]/);
});

test("F06. un tornillo pendiente fuera del area segura obliga a reencuadrar aunque la pieza se vea", () => {
  const safe = { left: 8, top: 71, right: 382, bottom: 524 };
  const pts = []; for (let i = 0; i < 50; i++) pts.push({ x: 100 + i * 4, y: 300, front: true });
  assert.equal(L.framingVerdict(pts, safe, { large: true }).ok, true);
  const tornillos = [{ x: 150, y: 300, front: true }, { x: 395, y: 300, front: true }];
  const v = L.framingVerdict(pts, safe, { large: true, screws: tornillos });
  assert.equal(v.ok, false);
  assert.equal(v.screwsOut, 1);
  // Demasiado pequena para seleccionarla: tambien se reencuadra.
  assert.equal(L.framingVerdict([{ x: 200, y: 300, front: true }, { x: 210, y: 305, front: true }], safe).ok, false);
});

test("F07. piezas muy grandes sin margen extra (no se encogen sus tornillos); pequenas con margen y contexto minimo", () => {
  const tapa = new THREE.Box3(new THREE.Vector3(-0.165, 0.9, -0.115), new THREE.Vector3(0.165, 0.91, 0.115));
  const g = Cam.padFocusBox(tapa);
  assert.equal(g.large, true);
  assert.ok(g.box.equals(tapa), "la caja de una pieza grande no se agranda");
  // Un cable LARGO y fino no es "grande" (antena Wi-Fi 2: 285 x 8 x 95 mm).
  assert.equal(Cam.padFocusBox(new THREE.Box3(new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0.285, 0.908, 0.095))).large, false);
  const conector = new THREE.Box3(new THREE.Vector3(0, 0.95, 0), new THREE.Vector3(0.006, 0.952, 0.004));
  const p = Cam.padFocusBox(conector);
  assert.equal(p.large, false);
  const sz = p.box.getSize(new THREE.Vector3());
  assert.ok(sz.x >= 0.12 - 1e-9 && sz.z >= 0.12 - 1e-9, "contexto minimo de 120 mm alrededor de un conector");
});

test("F08. tornillos pendientes demasiado pequenos para seleccionarlos obligan a acercarse", () => {
  const safe = { left: 8, top: 8, right: 1016, bottom: 450 };
  const placa = []; for (let i = 0; i < 40; i++) placa.push({ x: 380 + i * 2, y: 300, front: true });
  const lejos = [{ x: 400, y: 300, front: true, px: 3.5 }, { x: 440, y: 305, front: true, px: 3.6 }];
  const cerca = [{ x: 400, y: 300, front: true, px: 14 }, { x: 440, y: 305, front: true, px: 15 }];
  const v = L.framingVerdict(placa, safe, { large: true, screws: lejos });
  assert.equal(v.ok, false, "la placa se ve, pero sus tornillos (3-4 px) no se pueden clicar");
  assert.equal(v.screwsOut, 2);
  assert.equal(L.framingVerdict(placa, safe, { large: true, screws: cerca }).ok, true);
  // El tamano aparente del tornillo se calcula en el stage (radio real proyectado).
  const stage = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_stage.js"), "utf8");
  assert.match(stage, /const px = Math\.hypot\(\(q\.x - p\.x\) \* cr\.width, \(q\.y - p\.y\) \* cr\.height\);/);
});
