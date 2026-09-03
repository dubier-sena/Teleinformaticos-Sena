/* js/hardware_lab_3d_constants.js
 *
 * Constantes compartidas por toda la escena 3D del Laboratorio Virtual de
 * Hardware: layout de la mesa de trabajo y paleta de materiales por tipo
 * (item 19: el metal debe verse distinto del plastico, el PCB distinto del
 * aluminio). Un solo lugar para que factory/rig/escena midan igual.
 */
import * as THREE from "./vendor/three.module.min.js";

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
  metalBrushed: { color: 0xa6adb8, roughness: 0.5, metalness: 0.75 },
  metalDark: { color: 0x4a4f58, roughness: 0.42, metalness: 0.8 },
  // roughness 0.38 (antes 0.28, correccion visual FASE D sep-2026): en las
  // superficies grandes del portatil (base/tapa inferior/respaldo de
  // pantalla, ver hardware_lab_3d_chassis_factory.js) el valor original se
  // leia casi como espejo, sin ninguna ruptura entre paneles -- "carcasa
  // blanca y plana" (auditoria visual previa). Sigue mas brillante que
  // metalDark (0.42, chasis de escritorio): aluminio pulido vs. acero
  // oscuro mate son materiales distintos y deben distinguirse.
  aluminum: { color: 0xc7ccd4, roughness: 0.38, metalness: 0.9 },
  copper: { color: 0xb87333, roughness: 0.32, metalness: 0.95 },
  goldPin: { color: 0xd4af37, roughness: 0.3, metalness: 0.95 },
  pcbGreen: { color: 0x0d4f2c, roughness: 0.75, metalness: 0.05 },
  pcbBlue: { color: 0x0b2f5c, roughness: 0.72, metalness: 0.05 },
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
};

const materialCache = new Map();

/** Devuelve (y cachea) un MeshStandardMaterial para el tipo indicado. */
export function materialFor(kind, overrides) {
  const key = kind + (overrides ? JSON.stringify(overrides) : "");
  if (materialCache.has(key)) return materialCache.get(key);
  const base = MATERIAL_KIND[kind] || MATERIAL_KIND.plasticGray;
  const params = Object.assign({}, base, overrides || {});
  const mat = new THREE.MeshStandardMaterial(params);
  materialCache.set(key, mat);
  return mat;
}

/** Clona un material base para un uso que necesita mutarse (highlight, fx) sin afectar al resto. */
export function materialInstanceFor(kind, overrides) {
  const base = MATERIAL_KIND[kind] || MATERIAL_KIND.plasticGray;
  return new THREE.MeshStandardMaterial(Object.assign({}, base, overrides || {}));
}

// ── Colores de acento de la interfaz (coinciden con css/page_hardware_lab.css) ─
export const ACCENT = {
  highlight: 0x35d0ff, // cian: hover/resaltado de componente
  select: 0xffb020, // ambar: pieza seleccionada / herramienta activa
  danger: 0xff4d4f,
  success: 0x35e07a,
  connection: 0xffd23f, // pulso de "origen -> destino" en cables (item 12)
};
