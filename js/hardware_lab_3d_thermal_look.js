/**
 * hardware_lab_3d_thermal_look.js
 *
 * Aspecto del mantenimiento termico del portatil (auditoria sep-26): la pasta
 * termica sobre el die del procesador y el polvo del modulo de refrigeracion
 * cambian a la vista con el estado puro de hardware_lab_thermal.js.
 *
 * Geometria propia y procedural. Todo queda DENTRO de la caja que ya tenian
 * las piezas (bandeja, recorridos y contornos no cambian): la pasta del CPU
 * se apoya en el die y solo se muestra con el modulo fuera; el polvo se
 * pega a la cara de entrada de las aletas y a la boca del ventilador.
 */
import * as THREE from "./vendor/three.module.min.js";
import { materialInstanceFor } from "./hardware_lab_3d_constants.js";

// Medidas del CPU y del modulo (hardware_lab_3d_laptop_factory.js).
const CPU_SIZE = 0.024;
const DIE = CPU_SIZE * 0.62;
const DIE_TOP = 0.0009 + 0.00035;
// El substrato llega a y 0.00055 y el die a 0.00125: la pasta "rebosada"
// cae sobre el sustrato alrededor del die. La pasta sobresale del die como
// maximo 0.3 mm y solo se ve con el modulo fuera.
const COOLER_FIN = { x0: -0.062, x1: -0.013, z: -0.041, depth: 0.010, h: 0.008 };
const COOLER_FAN = { x: -0.037, z: -0.017, bottom: -0.0012 - 0.0055, bottomT: 0.00055, hubR: 0.0072, intakeR: 0.0118 };

const LOOK = {
  old: { color: 0x6c6f73, roughness: 1, metalness: 0, opacity: 1 },
  residue: { color: 0x8f9296, roughness: 1, metalness: 0, opacity: 0.55 },
  fresh: { color: 0xc3c6ca, roughness: 0.38, metalness: 0.05, opacity: 1 },
  dustDirty: { color: 0x8a8378, roughness: 1, metalness: 0, opacity: 0.92 },
  dustLoose: { color: 0xa39c90, roughness: 1, metalness: 0, opacity: 0.45 },
};

function mat(look) {
  const m = materialInstanceFor("thermalPaste", { color: look.color, roughness: look.roughness, metalness: look.metalness });
  m.transparent = look.opacity < 1;
  m.opacity = look.opacity;
  m.depthWrite = look.opacity >= 1;
  return m;
}

function setLook(mesh, look) {
  mesh.material.color.setHex(look.color);
  mesh.material.roughness = look.roughness;
  mesh.material.metalness = look.metalness;
  mesh.material.opacity = look.opacity;
  mesh.material.transparent = look.opacity < 1;
  mesh.material.depthWrite = look.opacity >= 1;
  mesh.material.needsUpdate = true;
}

/** Capa de pasta vieja/restos: losa fina sobre el die (por debajo de su cara superior). */
function buildCpuPasteLayer() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(DIE * 0.96, 0.00012, DIE * 0.96), mat(LOOK.old));
  m.position.y = DIE_TOP + 0.00006;
  m.name = "thermal-paste-layer";
  return m;
}

/** Pasta nueva: gota aplastada en el centro (su tamaño depende de la cantidad). */
function buildCpuPasteDot() {
  const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(LOOK.fresh));
  m.name = "thermal-paste-dot";
  return m;
}

/** Rebose (cantidad excesiva): anillo sobre el sustrato alrededor del die. */
function buildCpuPasteSpill() {
  const outer = new THREE.Shape();
  const o = DIE * 0.72, i = DIE * 0.5;
  outer.moveTo(-o, -o); outer.lineTo(o, -o); outer.lineTo(o, o); outer.lineTo(-o, o); outer.lineTo(-o, -o);
  const hole = new THREE.Path();
  hole.moveTo(-i, -i); hole.lineTo(-i, i); hole.lineTo(i, i); hole.lineTo(i, -i); hole.lineTo(-i, -i);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.0005, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(LOOK.fresh));
  m.position.y = 0.00055;
  m.name = "thermal-paste-spill";
  return m;
}

function buildDust() {
  const g = new THREE.Group();
  g.name = "thermal-dust";
  // Manta de polvo sobre la cara de ENTRADA de las aletas (lado del ventilador).
  const w = COOLER_FIN.x1 - COOLER_FIN.x0 - 0.002;
  const blanket = new THREE.Mesh(new THREE.BoxGeometry(w, COOLER_FIN.h - 0.0016, 0.0004), mat(LOOK.dustDirty));
  blanket.position.set((COOLER_FIN.x0 + COOLER_FIN.x1) / 2, -0.0008 - COOLER_FIN.h / 2, COOLER_FIN.z + COOLER_FIN.depth / 2 + 0.0002);
  blanket.name = "thermal-dust-fins";
  g.add(blanket);
  // Pelusa en la boca de admision del ventilador, sobre los alabes.
  const ring = new THREE.Mesh(new THREE.RingGeometry(COOLER_FAN.hubR, COOLER_FAN.intakeR - 0.0004, 28), mat(LOOK.dustDirty));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(COOLER_FAN.x, COOLER_FAN.bottom + COOLER_FAN.bottomT + 0.0003, COOLER_FAN.z);
  ring.material.side = THREE.DoubleSide;
  ring.name = "thermal-dust-intake";
  g.add(ring);
  g.traverse((n) => { n.castShadow = false; n.receiveShadow = false; });
  return g;
}

/** Crea (una sola vez) las mallas de pasta/polvo en las piezas del rig. */
export function ensureThermalMeshes(cpuRoot, coolerRoot) {
  if (cpuRoot && !cpuRoot.getObjectByName("thermal-paste")) {
    const g = new THREE.Group();
    g.name = "thermal-paste";
    g.add(buildCpuPasteLayer(), buildCpuPasteDot(), buildCpuPasteSpill());
    g.traverse((n) => { n.castShadow = false; n.receiveShadow = false; });
    cpuRoot.add(g);
  }
  if (coolerRoot && !coolerRoot.getObjectByName("thermal-dust")) coolerRoot.add(buildDust());
}

/**
 * Refleja el estado termico. `coolerInstalled`: con el modulo montado la pasta
 * del CPU queda tapada (la interfaz la representa la pasta del bloque de cobre).
 */
export function applyThermalLook(cpuRoot, coolerRoot, state, { coolerInstalled } = {}) {
  ensureThermalMeshes(cpuRoot, coolerRoot);
  const s = state || {};
  if (cpuRoot) {
    const layer = cpuRoot.getObjectByName("thermal-paste-layer");
    const dot = cpuRoot.getObjectByName("thermal-paste-dot");
    const spill = cpuRoot.getObjectByName("thermal-paste-spill");
    const show = !coolerInstalled;
    layer.visible = show && (s.paste === "old" || s.paste === "residue");
    if (layer.visible) {
      setLook(layer, s.paste === "old" ? LOOK.old : LOOK.residue);
      // Los restos no cubren todo el die: quedan en las esquinas y bordes.
      layer.scale.set(s.paste === "old" ? 1 : 0.8, 1, s.paste === "old" ? 1 : 0.7);
    }
    const fresh = show && s.paste === "new";
    const r = { insuficiente: [0.0011, 0.0011], adecuada: [0.0022, 0.0034], excesiva: [DIE * 0.46, DIE * 0.46] }[s.amount] || [0.0022, 0.0034];
    dot.visible = fresh;
    dot.scale.set(r[0], 0.0003, r[1]);
    dot.position.y = DIE_TOP;
    spill.visible = fresh && s.amount === "excesiva";
  }
  if (coolerRoot) {
    // Cara de contacto del bloque de cobre: pasta vieja/restos hasta limpiarla,
    // limpia despues y pasta fresca repartida una vez montado con pasta nueva.
    const contact = coolerRoot.getObjectByName("cooler-contact-paste");
    if (contact) {
      contact.visible = s.paste !== "clean" && !(s.paste === "new" && !coolerInstalled);
      if (contact.visible) {
        if (!contact.userData.ownMaterial) { contact.material = contact.material.clone(); contact.userData.ownMaterial = true; }
        setLook(contact, s.paste === "old" ? LOOK.old : s.paste === "residue" ? LOOK.residue : LOOK.fresh);
      }
    }
    const dust = coolerRoot.getObjectByName("thermal-dust");
    dust.visible = s.dust === "dirty" || s.dust === "loose";
    if (dust.visible) dust.children.forEach((m) => setLook(m, s.dust === "dirty" ? LOOK.dustDirty : LOOK.dustLoose));
  }
}
