/* js/hardware_lab_3d_tools_factory.js
 *
 * Bandeja de herramientas 3D (item 10): representaciones geometricas
 * simples pero volumetricas de las herramientas del laboratorio. Las claves
 * usadas aqui son los MISMOS ids reales de js/hardware_lab_tools.js
 * (phillips, flathead, spudger, tweezers, antistatic-strap,
 * antistatic-brush, compressed-air, thermal-paste, isopropyl-alcohol,
 * hands), asi el controlador no necesita una tabla de traduccion aparte.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialFor } from "./hardware_lab_3d_constants.js";

export const TOOL_KINDS = [
  "phillips",
  "flathead",
  "spudger",
  "tweezers",
  "antistatic-strap",
  "antistatic-brush",
  "compressed-air",
  "thermal-paste",
  "isopropyl-alcohol",
];

function box(w, h, d, kind, overrides) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materialFor(kind, overrides));
}
function cyl(rTop, rBottom, h, kind, segments = 12, overrides) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), materialFor(kind, overrides));
}
function cone(r, h, kind, segments = 12, overrides) {
  return new THREE.Mesh(new THREE.ConeGeometry(r, h, segments), materialFor(kind, overrides));
}
function setShadow(obj) {
  obj.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return obj;
}

function buildScrewdriver(flat) {
  const group = new THREE.Group();
  const handle = cyl(0.011, 0.013, 0.09, "plasticBlack", 10, { color: flat ? 0xc0392b : 0xf5b700 });
  handle.position.y = 0.045;
  group.add(handle);
  const ferrule = cyl(0.006, 0.007, 0.012, "metalSteel", 10);
  ferrule.position.y = 0.096;
  group.add(ferrule);
  const shaft = cyl(0.0026, 0.0026, 0.09, "metalSteel", 8);
  shaft.position.y = 0.147;
  group.add(shaft);
  if (flat) {
    const tip = box(0.006, 0.006, 0.0012, "metalSteel");
    tip.position.y = 0.192;
    group.add(tip);
  } else {
    const tipA = box(0.006, 0.006, 0.0012, "metalSteel");
    const tipB = box(0.006, 0.006, 0.0012, "metalSteel");
    tipB.rotation.y = Math.PI / 2;
    tipA.position.y = tipB.position.y = 0.192;
    group.add(tipA, tipB);
  }
  return group;
}

/** Espatula plastica de apertura (spudger): paleta plana, sin filo metalico. */
function buildSpudger() {
  const group = new THREE.Group();
  const handle = cyl(0.008, 0.009, 0.1, "plasticDark", 10, { color: 0x2f7cd6 });
  handle.position.y = 0.05;
  group.add(handle);
  const blade = box(0.014, 0.09, 0.0035, "plasticDark", { color: 0x3a8ce0 });
  blade.position.y = 0.145;
  group.add(blade);
  const tip = box(0.02, 0.006, 0.003, "plasticDark", { color: 0x3a8ce0 });
  tip.position.y = 0.192;
  group.add(tip);
  return group;
}

function buildTweezers() {
  const group = new THREE.Group();
  const pivot = cyl(0.005, 0.005, 0.01, "metalSteel", 10);
  pivot.rotation.x = Math.PI / 2;
  pivot.position.y = 0.06;
  group.add(pivot);

  [-1, 1].forEach((side) => {
    const arm = new THREE.Group();
    const handle = box(0.014, 0.075, 0.009, "plasticDark", { color: 0xc0392b });
    handle.position.y = -0.037;
    arm.add(handle);
    const jaw = box(0.008, 0.055, 0.006, "metalSteel");
    jaw.position.y = 0.087;
    arm.add(jaw);
    arm.position.y = 0.06;
    arm.rotation.z = side * 0.05;
    group.add(arm);
  });
  return group;
}

function buildWristStrap() {
  const group = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.006, 8, 20), materialFor("rubberBlack"));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.006;
  group.add(band);

  const stud = cyl(0.004, 0.004, 0.003, "metalSteel", 8);
  stud.position.set(0.032, 0.006, 0);
  group.add(stud);

  const coilCurve = new THREE.CatmullRomCurve3(
    Array.from({ length: 10 }, (_, i) => {
      const t = i / 9;
      return new THREE.Vector3(0.032 + t * 0.05, 0.006 + Math.sin(t * Math.PI * 6) * 0.006, Math.cos(t * Math.PI * 6) * 0.004);
    })
  );
  const coil = new THREE.Mesh(new THREE.TubeGeometry(coilCurve, 40, 0.0018, 6, false), materialFor("cableBlack"));
  group.add(coil);

  const clip = box(0.012, 0.006, 0.008, "metalDark");
  clip.position.set(0.088, 0.006, 0);
  group.add(clip);

  return group;
}

function buildBrush() {
  const group = new THREE.Group();
  const handle = cyl(0.007, 0.008, 0.1, "woodMat", 10);
  handle.position.y = 0.05;
  group.add(handle);
  const ferrule = cyl(0.009, 0.007, 0.018, "metalDark", 10);
  ferrule.position.y = 0.109;
  group.add(ferrule);
  const bristles = cone(0.011, 0.035, "plasticGray", 10, { color: 0xe4d9a8 });
  bristles.position.y = 0.135;
  group.add(bristles);
  return group;
}

function buildAirDuster() {
  const group = new THREE.Group();
  const canBody = cyl(0.019, 0.019, 0.11, "plasticGray", 14, { color: 0xd7dadf });
  canBody.position.y = 0.055;
  group.add(canBody);
  const shoulder = cyl(0.012, 0.019, 0.014, "plasticGray", 14);
  shoulder.position.y = 0.117;
  group.add(shoulder);
  const nozzleTube = cyl(0.0035, 0.0035, 0.05, "plasticDark", 8);
  nozzleTube.rotation.z = Math.PI / 2.4;
  nozzleTube.position.set(0.02, 0.13, 0);
  group.add(nozzleTube);
  const trigger = box(0.02, 0.006, 0.014, "plasticDark", { color: 0xc0382b });
  trigger.position.set(0, 0.122, 0.012);
  group.add(trigger);
  return group;
}

function buildThermalPaste() {
  const group = new THREE.Group();
  const barrel = cyl(0.008, 0.008, 0.07, "plasticGray", 12, { color: 0xe7e9ec });
  barrel.position.y = 0.035;
  group.add(barrel);
  const shoulder = cone(0.008, 0.014, "plasticGray", 12, { color: 0xe7e9ec });
  shoulder.position.y = 0.077;
  group.add(shoulder);
  const nozzle = cyl(0.0016, 0.0022, 0.014, "metalDark", 8);
  nozzle.position.y = 0.09;
  group.add(nozzle);
  const plunger = cyl(0.0075, 0.0075, 0.012, "plasticDark", 12);
  plunger.position.y = -0.004;
  group.add(plunger);
  return group;
}

function buildAlcoholBottle() {
  const group = new THREE.Group();
  const body = cyl(0.017, 0.02, 0.075, "plasticGray", 12, { color: 0xbfe3e0, transparent: true, opacity: 0.72 });
  body.position.y = 0.0375;
  group.add(body);
  const neck = cyl(0.008, 0.011, 0.018, "plasticGray", 12, { color: 0xbfe3e0, transparent: true, opacity: 0.72 });
  neck.position.y = 0.084;
  group.add(neck);
  const cap = cyl(0.009, 0.009, 0.014, "plasticDark", 12, { color: 0xc0382b });
  cap.position.y = 0.1;
  group.add(cap);
  const label = box(0.03, 0.03, 0.001, "plasticGray", { color: 0xf3f5f7 });
  label.position.set(0, 0.04, 0.0175);
  group.add(label);
  return group;
}

const BUILDERS = {
  phillips: () => buildScrewdriver(false),
  flathead: () => buildScrewdriver(true),
  spudger: buildSpudger,
  tweezers: buildTweezers,
  "antistatic-strap": buildWristStrap,
  "antistatic-brush": buildBrush,
  "compressed-air": buildAirDuster,
  "thermal-paste": buildThermalPaste,
  "isopropyl-alcohol": buildAlcoholBottle,
};

export function buildToolMesh(toolId) {
  const builder = BUILDERS[toolId];
  const group = builder ? builder() : buildScrewdriver(false);
  group.name = "tool-" + toolId;
  group.rotation.x = Math.PI / 2; // las herramientas se autoran "de pie"; acostadas sobre la bandeja por defecto
  setShadow(group);
  return group;
}

/** Bandeja fisica sobre la que se apoyan las herramientas. */
export function buildToolTray(width = 0.32, depth = 0.16) {
  const group = new THREE.Group();
  group.name = "tool-tray";
  const base = box(width, 0.006, depth, "plasticDark", { color: 0x1f2226 });
  group.add(base);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(width, depth) * 0.5, 0.004, 6, 24),
    materialFor("plasticDark")
  );
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1, depth / width, 1);
  rim.position.y = 0.006;
  group.add(rim);
  setShadow(group);
  return group;
}
