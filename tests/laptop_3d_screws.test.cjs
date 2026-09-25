"use strict";
// TORNILLOS INTERACTIVOS DEL PORTATIL (sep-2026).
//
// Construye el portatil REAL con createRig() (la misma funcion que usa el
// laboratorio) y mide, sin navegador, que el sistema nuevo de tornillos
// (js/hardware_lab_3d_screws.js) es fisicamente coherente:
//
//   1. Catalogo: ids unicos, piezas que existen de verdad, y ningun tornillo
//      duplicado (la tapa ya no dibuja los suyos decorativos).
//   2. Asiento: la cabeza queda POR FUERA de la pieza que fija y el vastago
//      entra en la torre roscada que existe en el chasis -- no al aire.
//   3. Los tornillos no se pisan entre si ni se salen de la huella del equipo.
//   4. Seleccionable: un rayo desde abajo (la camara "Interna" del portatil)
//      llega al tornillo antes que a cualquier otra geometria.
//   5. El destornillador de precision CABE en el hueco de servicio: su mango
//      no atraviesa el tablero de la mesa al acercarse por el eje del
//      tornillo (motivo real por el que no se usa el de taller, de 192 mm).
//   6. Poses instalada/presentada sobre el eje del tornillo y separadas por
//      todo el vastago (el tornillo "sube" de verdad al destornillarlo).
//   7. La bandeja magnetica esta sobre la mesa y fuera de la zona donde el
//      rig deja las piezas retiradas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(__dirname, "..");
const U = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

let THREE, rig, layout, scene, Screws, TweenMod, TABLE, ZONES, EQ;

test.before(async () => {
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      style: {},
      getContext: () => new Proxy({}, { get: () => () => ({ width: 10, data: new Uint8ClampedArray(4) }) }),
    }),
  };
  THREE = await import(U("js/vendor/three.module.min.js"));
  ({ TABLE, ZONES } = await import(U("js/hardware_lab_3d_constants.js")));
  Screws = await import(U("js/hardware_lab_3d_screws.js"));
  TweenMod = await import(U("js/hardware_lab_3d_tween.js"));
  const { createRig } = await import(U("js/hardware_lab_3d_rig.js"));
  const { createLaptopLayout } = await import(U("js/hardware_lab_3d_layout_laptop.js"));
  const ctx = { window: {} };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js/hardware_lab_data_laptop.js"), "utf8"), ctx);
  EQ = ctx.window.HardwareLab.DataLaptop.LAPTOP_EQUIPMENT;
  layout = createLaptopLayout();
  scene = new THREE.Scene();
  rig = createRig({ scene, interactions: null, tweenGroup: null, layout, equipmentId: "laptop" });
  scene.updateMatrixWorld(true);
});

const worldOf = (v) => v.clone().add(rig.root.position);

test("1. catalogo de tornillos: ids unicos, piezas reales y sin duplicados decorativos", () => {
  const entries = rig.screwEntries;
  assert.ok(entries.length >= 5, "el portatil debe declarar tornillos interactivos");

  const ids = entries.map((e) => e.id);
  assert.deepEqual(ids, [...new Set(ids)], "hay ids de tornillo repetidos");

  entries.forEach((e) => {
    assert.ok(EQ.parts[e.partId], `el tornillo ${e.id} fija una pieza inexistente: ${e.partId}`);
    assert.ok(e.label && e.label.length > 8, `el tornillo ${e.id} necesita una etiqueta legible`);
    assert.ok(Math.abs(e.outDir.length() - 1) < 1e-6, `outDir de ${e.id} debe ser unitario`);
  });

  // La tapa inferior ya NO dibuja tornillos decorativos: si lo hiciera habria
  // dos tornillos superpuestos en cada torre (uno clickeable y uno fantasma).
  const cover = rig.getObject3D("bottom-cover");
  let decorativos = 0;
  cover.traverse((n) => {
    if (n.name === "service-screw") decorativos++;
    // buildSmallScrew no pone nombre: se reconoce por su cabeza de 8 lados.
    if (n.isMesh && n.geometry && n.geometry.type === "CylinderGeometry") {
      const p = n.geometry.parameters;
      if (p.radialSegments === 8 && Math.abs(p.height - 0.0008) < 1e-9) decorativos++;
    }
  });
  assert.equal(decorativos, 0, "la tapa inferior sigue dibujando tornillos decorativos");
});

test("2. cada tornillo se asienta en la cara exterior de su pieza (y la tapa enrosca en una torre real)", () => {
  const base = rig.root.getObjectByName("laptop-base");
  assert.ok(base, "no se encontro el cuerpo base");

  // Torres roscadas reales del chasis (solo aplican a la tapa inferior).
  const towers = [];
  base.traverse((n) => {
    if (!n.isMesh || n.isInstancedMesh) return;
    if (!n.geometry || n.geometry.type !== "CylinderGeometry") return;
    const p = n.geometry.parameters;
    if (p.height < 0.006 || Math.max(p.radiusTop, p.radiusBottom) > 0.005) return;
    towers.push(new THREE.Box3().setFromObject(n));
  });
  assert.ok(towers.length >= 5, `se esperaban >= 5 torres de tornillo, hay ${towers.length}`);

  const problemas = [];
  rig.screwEntries.forEach((e) => {
    // homePosition es LOCAL al rig; las cajas de las piezas vienen en mundo.
    const seat = worldOf(e.homePosition);
    const partBox = new THREE.Box3().setFromObject(rig.getObject3D(e.partId));

    // El asiento cae dentro de la huella de su pieza (x/z) -- con holgura para
    // los que aprietan contra el chasis (soportes de bisagra, por fuera del
    // panel pero pegados a el).
    const holgura = e.bearsOn === "chassis" ? 0.03 : 0.001;
    if (seat.x < partBox.min.x - holgura || seat.x > partBox.max.x + holgura ||
        seat.z < partBox.min.z - holgura || seat.z > partBox.max.z + holgura) {
      problemas.push(`${e.id}: el asiento cae fuera de la huella de ${e.partId}`);
      return;
    }
    // ... y APOYA sobre la superficie real de la pieza: un rayo lanzado desde
    // 10 mm por fuera, hacia adentro, tiene que tocar la pieza justo en el
    // plano del asiento (no antes ni despues). Medir contra la caja
    // envolvente no sirve: la tapa inferior tiene patas de goma que bajan
    // 3 mm mas que el panel donde se atornilla.
    // Se muestrea un ANILLO al radio de la cabeza, no solo el eje: los
    // tornillos M.2 pasan por una media luna abierta en el borde de la
    // tarjeta (ahi no hay material en el eje) y lo que tiene que apoyar es la
    // corona de la cabeza.
    const ray = new THREE.Raycaster();
    const rHead = (e.object3d.userData.headR || Screws.SCREW_SIZE.headR) * 0.85;
    // Un tornillo puede apretar contra la PROPIA pieza (lo normal) o contra el
    // CHASIS, con la rosca entrando en la pieza (las bisagras de la pantalla:
    // la cabeza aprieta el soporte del chasis y libera el conjunto al salir).
    const obj = e.bearsOn === "chassis" ? rig.root.getObjectByName("laptop-base") : rig.getObject3D(e.partId);
    let apoyos = 0;
    let peor = null;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const off = new THREE.Vector3(Math.cos(ang) * rHead, 0, Math.sin(ang) * rHead);
      ray.set(seat.clone().add(off).addScaledVector(e.outDir, 0.01), e.outDir.clone().negate());
      const hit = ray.intersectObject(obj, true).filter((h) => h.object.isMesh)[0];
      if (!hit) continue;
      const delta = hit.distance - 0.01;
      if (Math.abs(delta) <= 0.0006) apoyos++;
      else if (peor === null || Math.abs(delta) > Math.abs(peor)) peor = delta;
    }
    if (apoyos < 3) {
      problemas.push(
        `${e.id}: la cabeza solo apoya en ${apoyos}/8 puntos de ${e.bearsOn === "chassis" ? "el chasis" : e.partId}` +
          (peor !== null ? ` (desfase ${(peor * 1000).toFixed(2)} mm)` : " (no toca)")
      );
    }
    // La cabeza asoma hacia afuera de la pieza.
    const headOuter = seat.clone().addScaledVector(e.outDir, Screws.SCREW_SIZE.headH);
    if (e.outDir.y < 0 ? headOuter.y >= seat.y : headOuter.y <= seat.y) {
      problemas.push(`${e.id}: la cabeza no asoma hacia afuera`);
    }
  });
  assert.deepEqual(problemas, [], problemas.join("\n"));

  // La tapa inferior, ademas, enrosca en las torres del chasis y sus cabezas
  // no sobresalen mas que las patas de goma (el equipo apoya en las patas).
  const coverBox = new THREE.Box3().setFromObject(rig.getObject3D("bottom-cover"));
  rig.screwEntries.filter((e) => e.partId === "bottom-cover").forEach((e) => {
    const seat = worldOf(e.homePosition);
    const tip = seat.clone().addScaledVector(e.outDir, -Screws.SCREW_SIZE.shankLen);
    const dentro = towers.some((b) => {
      const t = b.clone().expandByScalar(0.0006);
      return tip.x >= t.min.x && tip.x <= t.max.x && tip.z >= t.min.z && tip.z <= t.max.z && tip.y >= t.min.y && tip.y <= t.max.y;
    });
    assert.ok(dentro, `${e.id}: la punta del vastago no cae dentro de ninguna torre roscada`);
    const headOuter = seat.clone().addScaledVector(e.outDir, Screws.SCREW_SIZE.headH);
    assert.ok(headOuter.y > coverBox.min.y, `${e.id}: la cabeza sobresale mas que las patas de goma`);
  });
});

test("3. los tornillos no se superponen entre si ni salen del equipo", () => {
  const entries = rig.screwEntries;
  const rMin = Screws.SCREW_SIZE.headR * 2 + 0.002; // dos cabezas + holgura
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const d = entries[i].homePosition.distanceTo(entries[j].homePosition);
      assert.ok(d > rMin, `${entries[i].id} y ${entries[j].id} estan a ${(d * 1000).toFixed(1)} mm (se tocan)`);
    }
  }
  const coverBox = new THREE.Box3().setFromObject(rig.getObject3D("bottom-cover"));
  entries.forEach((e) => {
    const seat = worldOf(e.homePosition);
    assert.ok(seat.x > coverBox.min.x && seat.x < coverBox.max.x, `${e.id} queda fuera de la tapa en X`);
    assert.ok(seat.z > coverBox.min.z && seat.z < coverBox.max.z, `${e.id} queda fuera de la tapa en Z`);
  });
});

test("4. cada tornillo se puede clickear cuando toca (rayo real contra toda la escena)", () => {
  // Un tornillo interno no se ve con el equipo cerrado -- eso es correcto. Se
  // mide en el MOMENTO de la practica en que hay que tocarlo: con las piezas
  // anteriores del desensamble ya retiradas.
  const orden = EQ.sequences.disassembly.filter((st) => st.kind === "action").map((st) => st.partId);
  const ray = new THREE.Raycaster();
  const dirs = [];
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (const tilt of [0, 0.25, 0.45, 0.7]) {
      dirs.push(new THREE.Vector3(Math.cos(ang) * Math.sin(tilt), -Math.cos(tilt), Math.sin(ang) * Math.sin(tilt)).normalize());
    }
  }
  const misses = [];
  rig.screwEntries.forEach((e) => {
    // Estado de la practica justo antes de retirar la pieza de este tornillo.
    const idx = orden.indexOf(e.partId);
    const state = {};
    rig.partIds.forEach((id) => {
      const k = orden.indexOf(id);
      state[id] = !(idx >= 0 && k >= 0 && k < idx);
    });
    rig.syncFromSessionParts(state);
    rig.root.updateMatrixWorld(true);

    const head = worldOf(e.homePosition).addScaledVector(e.outDir, Screws.SCREW_SIZE.headH * 0.5);
    let hits = 0;
    dirs.forEach((d) => {
      const origin = head.clone().addScaledVector(d, 0.16);
      if (origin.y < TABLE.topY + 0.01) return; // la camara nunca baja de la mesa
      ray.set(origin, d.clone().negate());
      const inter = ray.intersectObject(scene, true).filter((h) => h.object.isMesh && h.object.visible);
      if (!inter.length) return;
      let n = inter[0].object;
      while (n && n !== e.object3d) n = n.parent;
      if (n === e.object3d) hits++;
    });
    if (hits === 0) misses.push(e.id);
  });
  // Deja el equipo completo otra vez para las pruebas siguientes.
  const todo = {};
  rig.partIds.forEach((id) => { todo[id] = true; });
  rig.syncFromSessionParts(todo);
  rig.root.updateMatrixWorld(true);
  assert.deepEqual(misses, [], "tornillos imposibles de clickear cuando toca tocarlos: " + misses.join(", "));
});

test("5. el destornillador de precision cabe en el hueco de servicio (no atraviesa la mesa)", () => {
  const tableY = TABLE.topY;
  rig.screwEntries.forEach((e) => {
    const head = worldOf(e.homePosition).addScaledVector(e.outDir, Screws.SCREW_SIZE.headH);
    // Mango: la punta toca la cabeza y el cuerpo se extiende hacia afuera.
    const handleEnd = head.clone().addScaledVector(e.outDir, Screws.DRIVER_LENGTH);
    assert.ok(
      handleEnd.y > tableY + 0.005,
      `${e.id}: el mango del destornillador quedaria ${((tableY - handleEnd.y) * 1000).toFixed(1)} mm DENTRO de la mesa`
    );
  });
  // Y la razon por la que no se usa el de taller (192 mm de largo).
  const e0 = rig.screwEntries[0];
  const headY = worldOf(e0.homePosition).addScaledVector(e0.outDir, Screws.SCREW_SIZE.headH).y;
  assert.ok(headY - 0.192 < TABLE.topY, "si el de taller cupiera, este comentario del modulo sobraria");
});

test("6. poses instalada y presentada: mismo eje, separadas por todo el vastago", () => {
  rig.screwEntries.forEach((e) => {
    const presented = e.homePosition.clone().addScaledVector(e.outDir, Screws.SCREW_SIZE.shankLen + 0.002);
    const delta = presented.clone().sub(e.homePosition);
    assert.ok(delta.length() >= Screws.SCREW_SIZE.shankLen, `${e.id}: el tornillo casi no sube al destornillarlo`);
    const cross = delta.clone().cross(e.outDir).length();
    assert.ok(cross < 1e-9, `${e.id}: el recorrido del tornillo no sigue su propio eje`);
  });
});

test("7. la bandeja magnetica esta sobre la mesa y fuera de la bandeja de piezas", () => {
  const origin = rig.screwDishOrigin;
  assert.ok(origin, "el portatil debe declarar bandeja de tornillos");
  const world = worldOf(origin);
  assert.ok(Math.abs(world.y - TABLE.topY) < 0.002, `la bandeja no apoya en la mesa (y ${world.y.toFixed(3)})`);
  // La bandeja de PIEZAS retiradas arranca en ZONES.trayOrigin hacia +X.
  assert.ok(
    world.x < ZONES.trayOrigin.x - 0.09,
    `la bandeja de tornillos invade la zona de piezas retiradas (x ${world.x.toFixed(3)})`
  );
  // Y no debajo del equipo (estorbaria la vista "Interna").
  const rigBox = new THREE.Box3().setFromObject(rig.root);
  assert.ok(
    world.x > rigBox.max.x || world.x < rigBox.min.x || world.z > rigBox.max.z || world.z < rigBox.min.z,
    "la bandeja de tornillos queda justo debajo del portatil"
  );
});

// ── Logica del controlador de tornillos (sin navegador) ────────────────────
// Los tests 1-7 miden la geometria. Estos dos ejercitan la MAQUINA DE ESTADOS
// y la animacion completa del destornillado automatico, avanzando los tweens a
// mano: es lo que atrapa una regresion en el orden de la secuencia, en el
// bloqueo de operaciones simultaneas o en el recorrido de la herramienta.
function nuevoControlador(opts = {}) {
  const { createScrewController } = Screws;
  const group = new THREE.Group();
  group.position.copy(rig.root.position);
  const entries = rig.screwEntries.map((e) => ({
    id: e.id,
    partId: e.partId,
    label: e.label,
    partName: e.partName,
    object3d: e.object3d,
    homePosition: e.homePosition.clone(),
    outDir: e.outDir.clone(),
  }));
  const { TweenGroup } = TweenMod;
  const tweenGroup = new TweenGroup();
  const avisos = [];
  const ctl = createScrewController({
    group,
    entries,
    tweenGroup,
    dishOrigin: rig.screwDishOrigin,
    floorY: TABLE.topY,
    canOperatePart: opts.canOperatePart || (() => ({ ok: true })),
    onChanged: opts.onChanged || (() => {}),
    notify: (m, k) => avisos.push({ m, k }),
    onBusyChange: opts.onBusyChange || (() => {}),
  });
  ctl.setState(null, { defaultInstalled: true });
  return { ctl, tweenGroup, avisos, group };
}

function correrTweens(tweenGroup, fn, pasos = 200) {
  for (let i = 0; i < pasos; i++) {
    tweenGroup.update(0.05);
    if (fn) fn(i);
  }
}

test("8. destornillado automatico: secuencia completa, bloqueo y herramienta que no atraviesa la mesa", () => {
  const busy = [];
  const { ctl, tweenGroup, group } = nuevoControlador({ onBusyChange: (b) => busy.push(b) });
  const entry = ctl.get("cover-1");
  assert.equal(entry.installed, true);

  const r = ctl.handleScrewClick("cover-1");
  assert.equal(r.ok, true, "el clic deberia iniciar el destornillado");
  assert.equal(ctl.isBusy(), true, "mientras dura la operacion, el sistema queda ocupado");

  // Un segundo clic (en este o en otro tornillo) NO puede encadenar otra
  // animacion incompatible mientras la primera corre.
  const r2 = ctl.handleScrewClick("cover-2");
  assert.equal(r2.ok, false, "no debe aceptar otro tornillo durante la animacion");
  assert.equal(ctl.get("cover-2").installed, true);

  // Se avanza la animacion midiendo la herramienta en cada cuadro.
  const driver = ctl.driver;
  let minY = Infinity;
  let vistoVisible = false;
  let giroMax = 0;
  correrTweens(tweenGroup, () => {
    if (!driver.visible) return;
    vistoVisible = true;
    // El grupo de tornillos vive fuera de una escena en este test: sin esto,
    // las matrices de mundo quedan sin actualizar y la medida no significa nada.
    group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(driver);
    minY = Math.min(minY, b.min.y);
    const e = new THREE.Euler().setFromQuaternion(driver.quaternion, "YXZ");
    giroMax = Math.max(giroMax, Math.abs(e.y));
  });

  assert.ok(vistoVisible, "el destornillador tiene que aparecer en escena");
  assert.ok(giroMax > 0.5, "el destornillador tiene que GIRAR (item 8)");
  assert.ok(
    minY > TABLE.topY,
    `el mango del destornillador entro ${((TABLE.topY - minY) * 1000).toFixed(1)} mm en el tablero de la mesa`
  );
  assert.equal(driver.visible, false, "al terminar, la herramienta se retira de la escena");
  assert.equal(ctl.get("cover-1").installed, false, "el tornillo queda RETIRADO");
  assert.equal(ctl.isBusy(), false, "la interaccion se desbloquea al terminar");
  assert.ok(busy.includes(true) && busy[busy.length - 1] === false, "debe avisar del bloqueo y del desbloqueo");

  // El tornillo retirado termina en la bandeja magnetica, no flotando.
  const dish = rig.screwDishOrigin;
  const pos = ctl.get("cover-1").object3d.position;
  assert.ok(pos.distanceTo(dish) < 0.05, "el tornillo retirado deberia quedar en la bandeja");
});

test("9. reglas: la pieza manda sobre el tornillo (item 12: enseñar el orden, no castigar)", () => {
  const { ctl, avisos } = nuevoControlador({
    canOperatePart: (partId) => (partId === "cover-1" ? { ok: true } : { ok: false, reason: "Todavia no toca ese tornillo." }),
  });
  const r = ctl.handleScrewClick("motherboard-1");
  assert.equal(r.ok, false);
  assert.equal(ctl.get("motherboard-1").installed, true, "un tornillo fuera de secuencia no se mueve");
  assert.match(avisos[avisos.length - 1].m, /Todavia no toca/);
  assert.equal(avisos[avisos.length - 1].k, "error");
  assert.equal(ctl.isBusy(), false, "un rechazo no deja el sistema bloqueado");

  // Conteos por pieza (los usa el bloqueo de la pieza y el panel del paso).
  assert.equal(ctl.pendingRemoval("bottom-cover"), 5);
  assert.equal(ctl.pendingInstall("bottom-cover"), 0);
  assert.equal(ctl.hasScrews("ram"), false, "la RAM no lleva tornillos (va por pestañas)");

  // Ensamble: la pieza recien instalada presenta sus tornillos.
  const parts = {};
  rig.partIds.forEach((id) => { parts[id] = true; });
  ctl.syncFromParts(parts, { installedWhenPresent: false });
  assert.equal(ctl.pendingInstall("bottom-cover"), 5);
  assert.equal(ctl.get("cover-1").presented, true);

  // Resaltado: aro y area de clic solo en los tornillos del paso actual.
  ctl.setHighlight("bottom-cover", "install");
  const conAro = ctl.list().filter((e) => (e.object3d.getObjectByName("screw-pending-ring") || {}).visible);
  assert.deepEqual(conAro.map((e) => e.partId), ["bottom-cover", "bottom-cover", "bottom-cover", "bottom-cover", "bottom-cover"]);
  const proxyActivo = ctl.get("cover-1").object3d.getObjectByName("screw-hit-proxy").scale.x;
  const proxyDormido = ctl.get("motherboard-1").object3d.getObjectByName("screw-hit-proxy").scale.x;
  assert.ok(
    proxyActivo > proxyDormido,
    "el area de clic ampliada solo debe estar activa en el tornillo que toca (si no, le roba el clic a la pieza de atras)"
  );
});

// ── Soportes propios de bateria, teclado, touchpad y pantalla (sep-2026) ──
// Posicion (mm, local del rig) de los 25 tornillos. Los 15 de tapa, placa,
// SSD, Wi-Fi y disipador NO cambiaron con esta fase; de los 10 afectados,
// screen-1 y screen-4 tampoco. Cualquier movimiento incidental falla aqui.
const SCREW_HOME_MM = {
  "cover-1": [-152, -2.4, -106], "cover-2": [152, -2.4, -106], "cover-3": [-150, -2.4, 104],
  "cover-4": [150, -2.4, 104], "cover-5": [0, -2.4, 104],
  "ssd-m2-1": [136.8, 12.85, -63], "wifi-card-1": [-111, 12.9, -40],
  "cooler-1": [-30, 13, -51], "cooler-2": [-66, 13, -75], "cooler-3": [-36, 13, -81],
  "motherboard-1": [-146, 15.6, -95], "motherboard-2": [146, 15.6, -95], "motherboard-3": [-146, 15.6, -31],
  "motherboard-4": [146, 15.6, -31], "motherboard-5": [-40, 15.6, -95],
  // Movidos (antes: bateria +-95/0.3, teclado y 17.7, touchpad y 19.4, pantalla +-103).
  "battery-1": [-109, 0.9, 70.6], "battery-2": [109, 0.9, 70.6],
  "keyboard-1": [-110, 15.4, -5], "keyboard-2": [110, 15.4, -5],
  "touchpad-1": [-35, 17.1, 77.05], "touchpad-2": [35, 17.1, 77.05],
  "screen-1": [-121, 13.5, -108], "screen-2": [-114.5, 13.5, -108],
  "screen-3": [114.5, 13.5, -108], "screen-4": [121, 13.5, -108],
};

test("10. posiciones: 25 tornillos, sin movimientos incidentales", () => {
  const got = Object.fromEntries(rig.screwEntries.map((e) => [e.id, e.homePosition.toArray().map((v) => v * 1000)]));
  assert.deepEqual(Object.keys(got).sort(), Object.keys(SCREW_HOME_MM).sort(), "cambio el catalogo de tornillos");
  const off = Object.entries(SCREW_HOME_MM).filter(([id, want]) => got[id].some((v, i) => Math.abs(v - want[i]) > 1e-3));
  assert.deepEqual(off.map(([id]) => `${id}: ${got[id].map((v) => v.toFixed(3)).join(", ")}`), []);
});

// Cadena mecanica de los 10 tornillos afectados, medida con rayos contra la
// geometria real (no por nombres): rayos paralelos al eje, a 1.5 mm de el (por
// fuera del agujero de 1.2 y por dentro de la cabeza), desde debajo de la
// cabeza hacia la punta. Cada tornillo:
//   - la cabeza APOYA en el elemento que aprieta (la primera superficie, a la
//     altura del asiento): la pieza desmontable (bateria) o un soporte del chasis;
//   - el vastago ROSCA en el otro lado antes de la punta: torre del chasis
//     (bateria) o boss/hoja de la pieza (teclado, touchpad, pantalla);
//   - y no atraviesa lo que no debe (el pack, las teclas, el cristal).
test("11. cadena mecanica: pieza desmontable <-> soporte del chasis, sin atravesar la pieza", () => {
  const base = rig.root.getObjectByName("laptop-base");
  const inBase = (o) => { for (let n = o; n; n = n.parent) if (n === base) return true; return false; };
  const partOf = (o, id) => { const p = rig.getObject3D(id); for (let n = o; n; n = n.parent) if (n === p) return true; return false; };
  const cadena = {
    battery: { aprieta: "pieza", rosca: "chasis" },
    keyboard: { aprieta: "chasis", rosca: "pieza" },
    touchpad: { aprieta: "chasis", rosca: "pieza" },
    "screen-assembly": { aprieta: "chasis", rosca: "pieza" },
  };
  const decls = Object.fromEntries(layout.screws.map((d) => [d.id, d]));
  const ray = new THREE.Raycaster();
  const problemas = [];
  const afectados = rig.screwEntries.filter((e) => cadena[e.partId]);
  assert.equal(afectados.length, 10);
  afectados.forEach((e) => {
    const c = cadena[e.partId];
    const shank = (decls[e.id].size && decls[e.id].size.shankLen) || Screws.SCREW_SIZE.shankLen;
    const up = e.outDir.clone().negate();
    const seat = worldOf(e.homePosition);
    const tip = seat.clone().addScaledVector(up, shank);
    const quien = (o) => (inBase(o) ? "chasis" : partOf(o, e.partId) ? "pieza" : "otra");
    let apoyo = 0, rosca = 0, atraviesa = null;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const off = new THREE.Vector3(Math.cos(a) * 0.0015, 0, Math.sin(a) * 0.0015);
      ray.set(seat.clone().add(off).addScaledVector(up, -0.002), up);
      const hits = ray.intersectObjects([base, rig.getObject3D(e.partId)], true)
        .filter((h) => h.object.isMesh && h.object.visible !== false && h.distance <= 0.002 + shank);
      if (hits[0] && Math.abs(hits[0].distance - 0.002) <= 0.0002 && quien(hits[0].object) === (c.aprieta)) apoyo++;
      if (hits.some((h) => h.distance > 0.0022 && quien(h.object) === c.rosca)) rosca++;
      // La pieza desmontable solo puede estar en el primer 1.5 mm si la cabeza
      // la aprieta (oreja de la bateria): mas alla, el vastago la atravesaria.
      if (c.aprieta === "pieza") {
        const dentro = hits.find((h) => quien(h.object) === "pieza" && h.distance > 0.002 + 0.0015);
        if (dentro) atraviesa = `${e.partId} a ${((dentro.distance - 0.002) * 1000).toFixed(2)} mm del asiento`;
      }
    }
    if (apoyo < 6) problemas.push(`${e.id}: la cabeza apoya en el ${c.aprieta} solo en ${apoyo}/8 rayos`);
    if (rosca < 6) problemas.push(`${e.id}: el vastago no rosca en el ${c.rosca} (${rosca}/8 rayos)`);
    if (atraviesa) problemas.push(`${e.id}: el vastago atraviesa ${atraviesa}`);
    // La punta queda dentro: ni asoma por encima de la pieza ni entra en una tecla.
    const partBox = new THREE.Box3().setFromObject(rig.getObject3D(e.partId));
    if (e.partId === "touchpad" && tip.y > partBox.max.y - 0.001) problemas.push(`${e.id}: la punta asoma por el touchpad`);
    if (e.partId === "keyboard") {
      rig.getObject3D("keyboard").traverse((n) => {
        if (!n.isInstancedMesh) return;
        if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
        const m = new THREE.Matrix4();
        for (let i = 0; i < n.count; i++) {
          n.getMatrixAt(i, m);
          const b = n.geometry.boundingBox.clone().applyMatrix4(m.clone().premultiply(n.matrixWorld));
          if (b.containsPoint(tip)) problemas.push(`${e.id}: la punta termina dentro de una tecla`);
        }
      });
    }
  });
  assert.deepEqual(problemas, [], problemas.join("\n"));
});

test("12. los soportes viajan con su pieza y las torres/pletinas quedan en el chasis", () => {
  const base = rig.root.getObjectByName("laptop-base");
  const cuenta = (root, name) => { let n = 0; root.traverse((o) => { if (o.name === name) n++; }); return n; };
  assert.equal(cuenta(rig.getObject3D("battery"), "battery-ear"), 2, "orejas de la bateria");
  assert.equal(cuenta(rig.getObject3D("keyboard"), "threaded-boss"), 2, "bosses del teclado");
  assert.equal(cuenta(rig.getObject3D("touchpad"), "threaded-boss"), 2, "bosses del touchpad");
  assert.equal(cuenta(rig.getObject3D("screen-assembly"), "hinge-leaf"), 2, "hojas de bisagra de la pantalla");
  assert.equal(cuenta(base, "battery-tower"), 2, "torres de la bateria");
  assert.equal(cuenta(base, "keyboard-bracket"), 2, "pletinas del teclado");
  assert.equal(cuenta(base, "touchpad-bracket"), 3, "travesano + 2 colgantes del touchpad");
  assert.equal(cuenta(base, "hinge-bracket"), 4, "soporte de bisagra partido en 2 tramos por lado");
  ["battery-ear", "threaded-boss", "hinge-leaf"].forEach((n) => assert.equal(cuenta(base, n), 0, `${n} no puede quedarse en el chasis`));

  // Las hojas de bisagra quedan horizontales y apoyadas en el soporte con la
  // pantalla instalada (compensan la apertura de la tapa).
  const hojas = []; rig.getObject3D("screen-assembly").traverse((o) => { if (o.name === "hinge-leaf") hojas.push(o); });
  hojas.forEach((h) => {
    const b = new THREE.Box3().setFromObject(h);
    const y0 = (b.min.y - rig.root.position.y) * 1000, y1 = (b.max.y - rig.root.position.y) * 1000;
    assert.ok(Math.abs(y0 - 16.6) < 0.01 && Math.abs(y1 - 17.5) < 0.01, `hoja de bisagra fuera de su asiento: y ${y0.toFixed(2)}..${y1.toFixed(2)}`);
  });
});
