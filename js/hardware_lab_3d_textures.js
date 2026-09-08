/* js/hardware_lab_3d_textures.js
 *
 * Texturas procedurales (mejora visual, sep-2026) generadas con
 * CanvasTexture: sin imagenes externas, sin dependencias nuevas, sin costo
 * de red -- coherente con CLAUDE.md ("no CDN/bundler"). Cada funcion arma
 * un <canvas> UNA sola vez (resultado cacheado) y lo envuelve en una
 * THREE.CanvasTexture; el costo real es una sola pasada 2D al cargar la
 * escena, nunca por frame.
 *
 * Objetivo (auditoria visual: "todo parece bloques de colores basicos, no
 * distingo los materiales"): romper la superficie 100% lisa/plana de los
 * materiales PBR de hardware_lab_3d_constants.js sin tocar su paleta de
 * colores base, para que el PCB se lea como un circuito real y el metal
 * cepillado disperse su brillo especular en vez de producir un reflejo
 * unico y uniforme (la misma causa raiz del "reflejo especular extremo"
 * reportado en superficies grandes de metalDark/aluminum).
 */
import * as THREE from "./vendor/three.module.min.js";

const cache = new Map();

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

/** PRNG determinista (mismo patron en cada carga de pagina, sin depender de
 * Math.random): dos escenas cargadas por separado deben verse identicas. */
function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return function rng() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Textura de circuito impreso: fondo del color base + rutas ortogonales
 * delgadas ("traces") + pads/vias circulares. Pensada para usarse como
 * `.map` sobre pcbGreen/pcbBlue -- el color base sigue siendo el mismo que
 * ya definia MATERIAL_KIND, solo se le agrega el patron encima.
 */
export function pcbTexture(kindKey, baseColorHex, traceColorHex, padColorHex) {
  const key = "pcb:" + kindKey;
  if (cache.has(key)) return cache.get(key);

  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = baseColorHex;
  ctx.fillRect(0, 0, size, size);

  const rng = makeRng(kindKey === "pcbBlue" ? 907 : 311);

  ctx.strokeStyle = traceColorHex;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 50; i++) {
    let x = rng() * size;
    let y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(rng() * 3);
    for (let s = 0; s < segments; s++) {
      if (rng() > 0.5) x += (rng() - 0.5) * 76;
      else y += (rng() - 0.5) * 76;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = padColorHex;
  for (let i = 0; i < 32; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1.3 + rng() * 1.7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Silkscreen tenue: un par de rectangulos finos, referencia de "capa de
  // texto/serigrafia" sin intentar dibujar letras reales (bajo poligonaje
  // conceptual, coherente con el resto de la geometria del laboratorio).
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#e8ecef";
  for (let i = 0; i < 4; i++) {
    const x = rng() * size * 0.6 + size * 0.1;
    const y = rng() * size * 0.6 + size * 0.1;
    ctx.fillRect(x, y, 14 + rng() * 10, 1.4);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/**
 * Mapa de rugosidad para metal "cepillado": franjas horizontales finas de
 * intensidad variable (escala de grises -- Three.js usa el canal G como
 * factor de roughness). Pensada como `.roughnessMap`, NUNCA `.map`: es
 * informacion de rugosidad, no de color, por eso no lleva colorSpace sRGB.
 * Repetida (wrapping) para que una sola textura sirva tanto en paneles
 * grandes (chasis) como en piezas chicas sin verse pixelada.
 */
export function brushedRoughnessTexture(seedKey) {
  const key = "brushed:" + seedKey;
  if (cache.has(key)) return cache.get(key);

  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#909090";
  ctx.fillRect(0, 0, size, size);

  // Three.js MULTIPLICA material.roughness (escalar) por el valor de este
  // mapa (canal G, normalizado 0-1) -- si el promedio de la textura fuera
  // ~0.5 (gris medio), el roughness EFECTIVO promedio terminaria en la
  // MITAD del valor base ya calibrado en MATERIAL_KIND, mas brillante de lo
  // pensado (bug real del primer intento: variacion 96-192, promedio ~0.56,
  // bajaba el roughness base en vez de solo variarlo). Se centra alto
  // (~0.86 promedio, 170-255) para que la MAYORIA de la superficie conserve
  // el roughness base tal cual, y las franjas mas oscuras (mas "pulidas")
  // sean la excepcion visible que rompe la uniformidad, no la regla.
  const rng = makeRng(seedKey === "aluminum" ? 51 : seedKey === "metalBrushed" ? 52 : 53);
  for (let y = 0; y < size; y++) {
    const shade = 170 + Math.floor(rng() * 85); // variacion 170-255 (~0.67-1.0 normalizado)
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(size, y + 0.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  cache.set(key, tex);
  return tex;
}
