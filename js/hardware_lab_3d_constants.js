/* js/hardware_lab_3d_constants.js
 *
 * Constantes compartidas por toda la escena 3D del Laboratorio Virtual de
 * Hardware: layout de la mesa de trabajo y paleta de materiales por tipo
 * (item 19: el metal debe verse distinto del plastico, el PCB distinto del
 * aluminio). Un solo lugar para que factory/rig/escena midan igual.
 */
import * as THREE from "./vendor/three.module.min.js";
import { pcbTexture, brushedRoughnessTexture } from "./hardware_lab_3d_textures.js";

// ── Layout de la mesa de trabajo (unidades = metros aprox.) ────────────────
export const TABLE = {
  width: 2.6,
  depth: 1.5,
  topThickness: 0.05,
  legHeight: 0.78,
  topY: 0.78, // altura de la superficie util (Y=0 es el piso)
};

export const ZONES = {
  // Zona central: equipo en mantenimiento.
  equipmentCenter: new THREE.Vector3(-0.15, TABLE.topY, 0.05),
  // Bandeja de piezas retiradas (item 9), a la derecha del equipo.
  trayOrigin: new THREE.Vector3(0.75, TABLE.topY, 0.15),
  trayStepX: 0.22,
  trayStepZ: 0.24,
  trayCols: 3,
  // Bandeja de herramientas (item 10), a la izquierda.
  toolTrayOrigin: new THREE.Vector3(-1.05, TABLE.topY, -0.15),
  toolStepX: 0.16,
  // Monitor de diagnostico (item 17), al fondo.
  monitorBase: new THREE.Vector3(0.55, TABLE.topY, -0.55),
};

// ── Paleta de materiales por tipo de superficie ─────────────────────────────
// roughness/metalness siguen el flujo PBR estandar de three.js MeshStandardMaterial.
export const MATERIAL_KIND = {
  metalSteel: { color: 0x8b93a1, roughness: 0.38, metalness: 0.85 },
  // metalBrushed/metalDark/aluminum: metalness/roughness recalibrados
  // (mejora visual, auditoria con clic real, sep-2026; primer intento a
  // metalness 0.5/0.5/0.55 -- verificado insuficiente, el blowout seguia
  // presente) de 0.75/0.8/0.9 a 0.2/0.2/0.28. Con los valores originales (y
  // con el primer intento a 0.5), las superficies GRANDES y planas que usan
  // estos 3 materiales (paneles del gabinete, base/tapa del portatil)
  // mostraban un "blowout" especular severo bajo el entorno PMREM de la
  // escena: el panel superior del gabinete se veia casi blanco puro (vista
  // "Superior") y el panel trasero casi 100% cian, reflejo directo de la luz
  // de acento (vista "Posterior") -- el color base (gris oscuro/plata)
  // practicamente no se percibia. Un metal pintado/anodizado real (el
  // acabado de un gabinete o chasis de portatil comun) es, en terminos PBR,
  // mayormente DIELECTRICO -- pintura/oxido sobre el metal, no metal puro
  // expuesto -- por eso metalness bajo (~0.2-0.3) es mas correcto que un
  // valor "medio", ademas de evitar el blowout. Roughness tambien subido
  // (mate satinado en vez de semi-espejo). Los metales chicos pensados para
  // verse brillantes a proposito (copper, goldPin, heatsinkFin, screwHead,
  // metalSteel) NO se tocan: el contraste "detalle pulido vs. carcasa mate"
  // sigue intacto. Se complementa con un roughnessMap (ver
  // applyProceduralTexture mas abajo) que dispersa el reflejo en vez de
  // concentrarlo en un solo punto.
  metalBrushed: { color: 0xa6adb8, roughness: 0.62, metalness: 0.2 },
  metalDark: { color: 0x4a4f58, roughness: 0.58, metalness: 0.2 },
  aluminum: { color: 0xc7ccd4, roughness: 0.5, metalness: 0.28 },
  // metalness bajado de 0.95 a 0.7 y color aclarado (fase 2, sep-2026): con
  // metalness casi 1 el color base practicamente no interviene -- la
  // superficie es puro reflejo del entorno, asi que la placa de contacto del
  // disipador (una cara plana y grande mirando hacia arriba) devolvia el
  // fondo oscuro de la escena y se leia como PLASTICO MARRON, no como cobre.
  // El heatpipe cilindrico no lo sufria porque su curvatura recoge luz desde
  // muchas direcciones. Es el mismo diagnostico ya aplicado a metalBrushed/
  // aluminum/goldPin: a esta escala manda el color, no el reflejo.
  copper: { color: 0xc87f3a, roughness: 0.38, metalness: 0.7 },
  // roughness/metalness recalibrados (reconstruccion del portatil, sep-2026):
  // con 0.3/0.95 las hileras de contactos de los sockets SO-DIMM y M.2 se
  // veian BLANCAS, no doradas -- el mismo blowout especular ya corregido en
  // metalBrushed/aluminum. Un contacto chapado en oro sigue siendo metalico,
  // pero a esta escala (0.6 mm) lo que domina es el color, no el reflejo.
  goldPin: { color: 0xc9a227, roughness: 0.45, metalness: 0.6 },
  // Color base oscurecido (mejora visual con clic real, sep-2026: 0x0d4f2c/
  // 0x0b2f5c -> mitad de brillo aprox.): a pesar de tener metalness casi nulo
  // (0.05, descarta el reflejo especular/entorno como causa), la placa base
  // se veia PRACTICAMENTE BLANCA en varias vistas (Interna, enfoque "Placa
  // base") -- la luz clave (`key`, DirectionalLight intensity 5.5 en
  // hardware_lab_3d_scene.js) es muy fuerte por diseño (evita que el
  // gabinete se vea como silueta negra, ver comentario en ese archivo) y,
  // combinada con el tonemapping ACES, empuja incluso un verde oscuro a
  // blanco cuando la cara recibe luz directa de lleno. Reducir esa luz
  // global arriesgaba oscurecer otras vistas ya calibradas; en cambio se
  // oscurece el color base de ESTE material especifico (sin tocar ninguna
  // luz compartida ni otro tipo de superficie) para que la textura de PCB
  // (ver hardware_lab_3d_textures.js) siga siendo legible bajo la misma luz.
  pcbGreen: { color: 0x062e1a, roughness: 0.75, metalness: 0.05 },
  pcbBlue: { color: 0x061a33, roughness: 0.72, metalness: 0.05 },
  plasticBlack: { color: 0x16181c, roughness: 0.55, metalness: 0.05 },
  plasticDark: { color: 0x2a2d33, roughness: 0.5, metalness: 0.08 },
  plasticGray: { color: 0x5c6067, roughness: 0.55, metalness: 0.1 },
  rubberBlack: { color: 0x0c0d0f, roughness: 0.9, metalness: 0 },
  glassDark: { color: 0x11151c, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55 },
  fanBlade: { color: 0x1c1f24, roughness: 0.45, metalness: 0.15 },
  heatsinkFin: { color: 0xb7bcc4, roughness: 0.25, metalness: 0.85 },
  screwHead: { color: 0x6b6f76, roughness: 0.35, metalness: 0.8 },
  cableBlack: { color: 0x0a0a0c, roughness: 0.7, metalness: 0 },
  cableSleeved: { color: 0x1a1c1f, roughness: 0.6, metalness: 0.1 },
  ledRed: { color: 0xff3b3b, roughness: 0.3, metalness: 0, emissive: 0xff2020, emissiveIntensity: 1.2 },
  ledGreen: { color: 0x35ff8a, roughness: 0.3, metalness: 0, emissive: 0x20ff70, emissiveIntensity: 1.2 },
  batteryCell: { color: 0x2f3237, roughness: 0.4, metalness: 0.6 },
  woodMat: { color: 0x2b2f33, roughness: 0.85, metalness: 0 },

  // ── Materiales de detalle del portatil (reconstruccion 3D, sep-2026) ─────
  // La auditoria visual mostro que TODO el interior se leia como "una losa
  // azul sobre una bandeja blanca": no habia forma de distinguir un chip de
  // un conector ni un PCB de una etiqueta. Estos 7 tipos son los minimos
  // necesarios para que cada familia de pieza se reconozca de un vistazo.
  // Son propios (color/roughness/metalness elegidos aqui); no proceden de
  // ningun recurso de terceros.
  //
  // Encapsulado de chip: negro mate con un punto de brillo, NO plastico puro
  // (un BGA real refleja poco pero no es goma).
  chipBlack: { color: 0x15161a, roughness: 0.42, metalness: 0.12 },
  // PCB de modulo (SO-DIMM/M.2/Wi-Fi): verde mas oscuro y mate que el
  // pcbGreen de la placa base, para que un modulo montado ENCIMA de la placa
  // no se confunda con ella.
  pcbDarkGreen: { color: 0x09291a, roughness: 0.8, metalness: 0.04 },
  // Die de silicio desnudo del SoC: gris azulado con brillo especular alto,
  // la pista visual de "aqui va la pasta termica".
  silicon: { color: 0x6f7c8a, roughness: 0.18, metalness: 0.55 },
  // Pasta termica: gris claro totalmente mate.
  thermalPaste: { color: 0xb9bcc0, roughness: 0.95, metalness: 0 },
  // Conectores FPC/ZIF y de bateria: el marfil claro es justo lo que los
  // hace saltar a la vista sobre el verde de la placa.
  connectorIvory: { color: 0xd2ccbd, roughness: 0.52, metalness: 0.08 },
  // Etiquetas de servicio (RAM, SSD, bateria).
  labelWhite: { color: 0xe6e8ea, roughness: 0.85, metalness: 0 },
  // Condensadores/bobinas: marron-tostado tipico del tantalio.
  capBrown: { color: 0x6b4a2a, roughness: 0.55, metalness: 0.2 },
  // Familias de cable, para poder distinguirlas de un vistazo dentro del
  // portatil (alimentacion / flex de datos / pantalla / antena principal /
  // antena auxiliar). cableBlack y cableSleeved, ya existentes arriba, siguen
  // cubriendo el equipo de escritorio sin cambios.
  cableRed: { color: 0x8c2b2b, roughness: 0.65, metalness: 0.05 },
  cableWhite: { color: 0xd9dade, roughness: 0.6, metalness: 0.05 },
  cableFlex: { color: 0xb8863c, roughness: 0.55, metalness: 0.15 },
  cableFlexDark: { color: 0x2c3d52, roughness: 0.55, metalness: 0.1 },
  // Cinta Kapton: la cinta ambar translucida que sujeta cables y flex dentro
  // de un portatil real. Se usa en los puntos de sujeción del recorrido.
  tapeKapton: { color: 0xa9741f, roughness: 0.45, metalness: 0.05 },
};

const materialCache = new Map();

// ── Texturas procedurales por tipo (mejora visual, sep-2026) ────────────────
// Un solo lugar que decide QUE tipo lleva textura y CUAL: el resto del motor
// (parts_factory/chassis_factory) sigue llamando materialFor("pcbGreen") tal
// cual, sin saber nada de canvas/texturas -- ver hardware_lab_3d_textures.js
// para el porque de cada una (PCB: "todo bloques de color basico"; metal:
// romper el reflejo especular uniforme de los paneles grandes).
function applyProceduralTexture(mat, kind) {
  switch (kind) {
    case "pcbGreen":
      // Fondo BLANCO a proposito (no el verde real): `.map` multiplica por
      // material.color, asi que un fondo blanco (neutro, x1) reproduce
      // exactamente el pcbGreen ya definido arriba sin oscurecerlo una
      // segunda vez -- solo las trazas/pads quedan como variacion sobre esa
      // base, en vez de hornear un segundo tono de verde que compita con el
      // color real del material.
      mat.map = pcbTexture("pcbGreen", "#ffffff", "#4a4438", "#2a2c2f");
      mat.needsUpdate = true;
      break;
    case "pcbBlue":
      mat.map = pcbTexture("pcbBlue", "#ffffff", "#324450", "#2a2c2f");
      mat.needsUpdate = true;
      break;
    case "metalDark":
      mat.roughnessMap = brushedRoughnessTexture("metalDark");
      mat.needsUpdate = true;
      break;
    case "aluminum":
      mat.roughnessMap = brushedRoughnessTexture("aluminum");
      mat.needsUpdate = true;
      break;
    case "metalBrushed":
      mat.roughnessMap = brushedRoughnessTexture("metalBrushed");
      mat.needsUpdate = true;
      break;
    default:
      break;
  }
}

/** Devuelve (y cachea) un MeshStandardMaterial para el tipo indicado. */
export function materialFor(kind, overrides) {
  const key = kind + (overrides ? JSON.stringify(overrides) : "");
  if (materialCache.has(key)) return materialCache.get(key);
  const base = MATERIAL_KIND[kind] || MATERIAL_KIND.plasticGray;
  const params = Object.assign({}, base, overrides || {});
  const mat = new THREE.MeshStandardMaterial(params);
  applyProceduralTexture(mat, kind);
  materialCache.set(key, mat);
  return mat;
}

/** Clona un material base para un uso que necesita mutarse (highlight, fx) sin afectar al resto. */
export function materialInstanceFor(kind, overrides) {
  const base = MATERIAL_KIND[kind] || MATERIAL_KIND.plasticGray;
  const mat = new THREE.MeshStandardMaterial(Object.assign({}, base, overrides || {}));
  applyProceduralTexture(mat, kind);
  return mat;
}

// ── Colores de acento de la interfaz (coinciden con css/page_hardware_lab.css) ─
export const ACCENT = {
  highlight: 0x35d0ff, // cian: hover/resaltado de componente
  select: 0xffb020, // ambar: pieza seleccionada / herramienta activa
  danger: 0xff4d4f,
  success: 0x35e07a,
  connection: 0xffd23f, // pulso de "origen -> destino" en cables (item 12)
};
