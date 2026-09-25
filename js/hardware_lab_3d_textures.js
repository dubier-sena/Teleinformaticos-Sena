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

/**
 * Textura de PLACA BASE DE PORTATIL (fase 2, sep-2026).
 *
 * Por que una funcion aparte y no reusar pcbTexture(): aquella reparte trazas
 * y pads al azar por todo el lienzo, lo que a la distancia de trabajo del
 * laboratorio (la camara llega a ~10 cm de la placa) se lee como MANCHAS, no
 * como electronica -- un circuito real no es ruido, es estructura: buses de
 * pistas paralelas, pares diferenciales serpenteando juntos, vias alineadas,
 * huellas rectangulares de componentes y serigrafia con designadores.
 *
 * Se genera en la PROPORCION REAL de la placa (300 x 84 mm) para que las
 * pistas no salgan estiradas al mapearla sobre la cara superior, y a 2048 px
 * de ancho (~6.8 px/mm) para que aguante el zoom.
 *
 * Todo el dibujo es propio y procedural: no reproduce ninguna placa comercial
 * ni procede de ningun recurso de terceros.
 */
export function laptopBoardTexture(seedKey = "laptop-mb", layout = null) {
  const key = "board:" + seedKey;
  if (cache.has(key)) return cache.get(key);
  // Con `layout.marks` (sep-18) la serigrafia REAL (contornos y designadores
  // de los componentes montados) se dibuja encima; las huellas aleatorias de
  // relleno se reducen para que no compitan con ella.
  const marks = layout && Array.isArray(layout.marks) ? layout.marks : null;

  const W = 2048, H = 573;                 // 300:84 aprox
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rng = makeRng(4211);

  // El `.map` MULTIPLICA por material.color, asi que el fondo va BLANCO:
  // el verde real lo sigue poniendo pcbGreen (mismo criterio que pcbTexture).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // ── Plano de masa: retícula tenue que rellena el fondo ──────────────────
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "#7f8c7f";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 14) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 14) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const trace = (pts, w, alpha, color) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };

  const TRACE = "#3f5a46";     // cobre bajo mascara verde
  const TRACE2 = "#4d6b52";

  // ── Buses: grupos de pistas paralelas que recorren la placa ─────────────
  // Es lo que de verdad hace que se lea como una placa y no como ruido.
  const buses = [
    { y: 96, n: 14, x0: 250, x1: 1500, step: 6 },
    { y: 250, n: 18, x0: 420, x1: 1850, step: 5.5 },
    { y: 400, n: 10, x0: 150, x1: 980, step: 6.5 },
    { y: 470, n: 12, x0: 900, x1: 1980, step: 5.5 },
  ];
  buses.forEach((b) => {
    for (let i = 0; i < b.n; i++) {
      const y = b.y + i * b.step;
      // Cada pista del bus hace un quiebre en escalera, como el enrutado real.
      const kx = b.x0 + (b.x1 - b.x0) * (0.35 + rng() * 0.3);
      const dy = (rng() - 0.5) * 26;
      trace([[b.x0, y], [kx, y], [kx + 18, y + dy], [b.x1, y + dy]], 1.6, 0.55, TRACE);
    }
  });

  // ── Pares diferenciales: dos pistas gemelas que serpentean juntas ───────
  for (let p = 0; p < 6; p++) {
    const y0 = 40 + rng() * (H - 90);
    const x0 = 120 + rng() * 400;
    const len = 500 + rng() * 900;
    const amp = 8 + rng() * 10;
    const mk = (off) => {
      const pts = [];
      for (let x = x0; x < x0 + len; x += 26) {
        pts.push([x, y0 + off + Math.sin((x - x0) / 46) * amp]);
      }
      return pts;
    };
    trace(mk(-2.6), 1.7, 0.6, TRACE2);
    trace(mk(2.6), 1.7, 0.6, TRACE2);
  }

  // ── Vias: taladro oscuro con anillo de cobre, alineadas en filas ────────
  const via = (x, y, r) => {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "#6b7f63";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#20291f";
    ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = 0; i < 26; i++) {
    const x = 90 + rng() * (W - 180), y = 30 + rng() * (H - 60);
    const n = 3 + Math.floor(rng() * 6);
    const horiz = rng() > 0.5;
    for (let k = 0; k < n; k++) via(x + (horiz ? k * 11 : 0), y + (horiz ? 0 : k * 11), 3.4);
  }

  // ── Huellas de componentes: marco de serigrafia + pads + designador ─────
  ctx.textBaseline = "middle";
  const footprint = (x, y, w, h, label, pads) => {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "#dfe6e2";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "#c8a84a";
    if (pads > 0) {
      const step = w / pads;
      for (let i = 0; i < pads; i++) {
        ctx.fillRect(x + step * i + step * 0.22, y - 3.4, step * 0.56, 3.4);
        ctx.fillRect(x + step * i + step * 0.22, y + h, step * 0.56, 3.4);
      }
    }
    if (label) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#e9efea";
      ctx.font = "11px monospace";
      ctx.fillText(label, x, y - 8);
    }
  };
  const REFS = ["U", "C", "R", "L", "Q", "D", "J", "FB"];
  for (let i = 0, nFp = marks ? 16 : 46; i < nFp; i++) {
    const w = 18 + rng() * 60, h = 12 + rng() * 34;
    const x = 60 + rng() * (W - 160), y = 24 + rng() * (H - 80);
    const ref = REFS[Math.floor(rng() * REFS.length)] + (1 + Math.floor(rng() * 60));
    footprint(x, y, w, h, ref, rng() > 0.45 ? 2 + Math.floor(rng() * 6) : 0);
  }

  // ── Resistencias/condensadores SMD 0402: pares de pads diminutos ────────
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 260; i++) {
    const x = 40 + rng() * (W - 80), y = 20 + rng() * (H - 40);
    const horiz = rng() > 0.5;
    ctx.fillStyle = "#b9a05a";
    if (horiz) { ctx.fillRect(x, y, 4.2, 3); ctx.fillRect(x + 7.5, y, 4.2, 3); }
    else { ctx.fillRect(x, y, 3, 4.2); ctx.fillRect(x, y + 7.5, 3, 4.2); }
    ctx.fillStyle = "#2b2f33";
    if (horiz) ctx.fillRect(x + 4, y + 0.3, 3.7, 2.4);
    else ctx.fillRect(x + 0.3, y + 4, 2.4, 3.7);
  }

  // ── Serigrafia de servicio: marcas propias del proyecto ────────────────
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#eef3ef";
  ctx.font = "bold 20px monospace";
  ctx.fillText("SENA LAB / MB-14 REV.B", 70, H - 26);
  ctx.font = "13px monospace";
  ctx.fillText("TELEINFORMATICOS", 70, H - 48);
  // Triangulo de advertencia ESD junto al conector de bateria.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#eef3ef";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W - 150, H - 30); ctx.lineTo(W - 132, H - 58); ctx.lineTo(W - 114, H - 30);
  ctx.closePath(); ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Serigrafia de los componentes montados ─────────────────────────────
  // Coordenadas locales de la placa (m). La cara de componentes es la -Y de
  // la caja: u = (x + w/2) / w, v = (z + d/2) / d, y la textura se voltea en
  // vertical (flipY), asi que la fila 0 del lienzo es z = +d/2. El texto se lee
  // derecho mirando esa cara, instalada (desde abajo) o en la bandeja.
  if (marks) {
    const bw = layout.width, bd = layout.depth;
    const px = (x) => ((x + bw / 2) / bw) * W;
    const py = (z) => ((bd / 2 - z) / bd) * H;
    ctx.strokeStyle = "#eef2ee";
    ctx.fillStyle = "#eef2ee";
    ctx.lineWidth = 1.6;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    marks.forEach((m) => {
      if (m.rect) {
        const [x, z, rw, rd] = m.rect;
        ctx.globalAlpha = 0.62;
        ctx.strokeRect(px(x - rw / 2), py(z + rd / 2), (rw / bw) * W, (rd / bd) * H);
      } else if (m.text) {
        ctx.globalAlpha = 0.8;
        ctx.font = "600 13px ui-monospace, 'SF Mono', Menlo, monospace";
        ctx.fillText(m.text, px(m.at[0]), py(m.at[1]));
      }
    });
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/**
 * Atlas de LEYENDAS DEL TECLADO (fase 2, sep-2026).
 *
 * Problema: las teclas no tenian ninguna leyenda. Dibujar cada letra como
 * geometria serian cientos de mallas; dibujar una textura POR TECLA serian
 * decenas de materiales y draw calls. La solucion es una sola textura con la
 * distribucion completa, que se aplica a UN unico plano del tamaño del
 * teclado colocado justo sobre las teclas: 1 malla, 1 material, 1 draw call
 * para las ~70 leyendas.
 *
 * `cols` x `rows` debe coincidir con la rejilla que construye el teclado
 * (buildLaptopKeyboard), porque el plano se alinea celda a celda.
 *
 * Distribucion QWERTY en español (la del teclado que usan los aprendices),
 * escrita aqui a mano: es contenido propio, no procede de ningun recurso de
 * terceros.
 */
export function keyboardLegendTexture(cols, rows) {
  const key = `kbd:${cols}x${rows}`;
  if (cache.has(key)) return cache.get(key);

  // Filas de 14 teclas. "" = tecla sin leyenda visible (relleno de la rejilla).
  const LAYOUT = [
    ["esc", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12", "supr"],
    ["º", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "'", "¡", "⌫"],
    ["↹", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "`", "+", "↵"],
    ["Bloq", "A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ", "´", "ç", "↵"],
    ["⇧", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "-", "↑", "↓", "⇧"],
  ];

  const CELL = 96;
  const W = cols * CELL, H = rows * CELL;
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo NEGRO: esta textura se usa como `.map` sobre un plano con
  // transparencia por alpha, asi que el fondo no llega a verse; el negro
  // evita halos claros en el borde de cada glifo al filtrar la textura.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let r = 0; r < rows; r++) {
    const row = LAYOUT[r] || [];
    for (let c = 0; c < cols; c++) {
      const label = row[c] != null ? row[c] : "";
      if (!label) continue;
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      // Leyendas cortas mas grandes; las largas ("Bloq", "supr") se reducen
      // para que quepan dentro de la tecla sin recortarse.
      const size = label.length <= 2 ? 44 : label.length <= 3 ? 32 : 26;
      ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#e8ecf2";
      ctx.fillText(label, cx, cy);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/**
 * Etiqueta impresa de la bateria del portatil (sep-2026). Dibujo PROPIO: la
 * etiqueta era una lamina blanca lisa y la bateria se leia como un bloque sin
 * identidad. Datos genericos de un pack de 3 celdas Li-ion (tension, capacidad,
 * energia), advertencias y un codigo de barras de patron determinista. No
 * procede de ningun recurso de terceros.
 */
export function batteryLabelTexture() {
  const key = "battery-label";
  if (cache.has(key)) return cache.get(key);

  const W = 512, H = 210;                  // 54.6 x 22.4 mm aprox
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rng = makeRng(9127);

  ctx.fillStyle = "#f2f3f1";
  ctx.fillRect(0, 0, W, H);
  // Franja superior oscura con el tipo de pack.
  ctx.fillStyle = "#1d1f23";
  ctx.fillRect(0, 0, W, 44);
  ctx.fillStyle = "#f2f3f1";
  ctx.textBaseline = "middle";
  ctx.font = "700 26px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("Li-ion BATTERY PACK", 16, 23);

  ctx.fillStyle = "#1d1f23";
  ctx.font = "600 22px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("11.55V  4200mAh  48.5Wh", 16, 68);
  ctx.font = "500 15px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("3 celdas  |  No perforar ni exponer al calor", 16, 96);

  // Triangulo de advertencia.
  ctx.beginPath();
  ctx.moveTo(40, 118); ctx.lineTo(66, 162); ctx.lineTo(14, 162); ctx.closePath();
  ctx.fillStyle = "#e0b400"; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = "#1d1f23"; ctx.stroke();
  ctx.fillStyle = "#1d1f23";
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("!", 40, 146);
  // Simbolo de reciclaje simplificado: circulo con flechas.
  ctx.beginPath(); ctx.arc(106, 140, 22, 0.2, Math.PI * 1.75); ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(126, 118); ctx.lineTo(128, 134); ctx.lineTo(114, 128); ctx.closePath(); ctx.fill();
  ctx.font = "700 12px system-ui, sans-serif";
  ctx.fillText("Li-ion", 106, 141);
  ctx.textAlign = "left";

  // Codigo de barras.
  let x = 160;
  while (x < W - 20) {
    const bw = 1 + Math.floor(rng() * 4);
    if (rng() > 0.42) { ctx.fillRect(x, 116, bw, 56); }
    x += bw + 1;
  }
  ctx.font = "500 13px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillText("SN 4B21-0967-3318", 160, 188);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/**
 * Etiqueta redonda del motor del ventilador del portatil (iteracion visual,
 * sep-18). Sin ella el centro del ventilador era un disco negro liso. Dibujo
 * PROPIO con datos genericos de un blower de 5 V (tension, corriente, sentido
 * de giro y un codigo de lote determinista); no reproduce ninguna marca ni
 * procede de ningun recurso de terceros. Se mapea sobre un CircleGeometry, asi
 * que solo se ve el circulo inscrito.
 */
export function fanLabelTexture() {
  const key = "fan-label";
  if (cache.has(key)) return cache.get(key);

  const S = 256;
  const canvas = makeCanvas(S);
  const ctx = canvas.getContext("2d");
  const rng = makeRng(5531);
  ctx.fillStyle = "#1a1c20";
  ctx.fillRect(0, 0, S, S);
  // Pegatina plateada con borde oscuro.
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.48, 0, Math.PI * 2);
  ctx.fillStyle = "#c9ccd0";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#5d6168";
  ctx.stroke();
  ctx.fillStyle = "#1d1f23";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 30px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("SL-BF14", S / 2, S * 0.30);
  ctx.font = "600 24px system-ui, -apple-system, 'Segoe UI', sans-serif";
  ctx.fillText("DC 5V  0.40A", S / 2, S * 0.45);
  ctx.font = "500 18px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillText("LOT 2634-B", S / 2, S * 0.58);
  // Flecha de sentido de giro (arco + punta).
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.38, Math.PI * 0.62, Math.PI * 0.92);
  ctx.lineWidth = 5;
  ctx.stroke();
  const ax = S / 2 + Math.cos(Math.PI * 0.62) * S * 0.38, ay = S / 2 + Math.sin(Math.PI * 0.62) * S * 0.38;
  ctx.beginPath();
  ctx.moveTo(ax + 12, ay - 4); ctx.lineTo(ax - 6, ay - 10); ctx.lineTo(ax - 2, ay + 10); ctx.closePath();
  ctx.fill();
  // Mini codigo de barras.
  let x = S * 0.36;
  while (x < S * 0.64) {
    const bw = 1 + Math.floor(rng() * 3);
    if (rng() > 0.4) ctx.fillRect(x, S * 0.66, bw, 26);
    x += bw + 1;
  }
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/**
 * Marcaje laser de un encapsulado (iteracion visual, sep-18): texto gris
 * tenue sobre el negro del chip, como se ve un circuito integrado real. Se
 * aplica en una calcomania sobre la cara visible del chip. Los codigos son
 * PROPIOS y genericos (prefijo "SL" del laboratorio), nunca referencias de un
 * fabricante real. `aspect` = ancho / largo del chip, para que el texto no
 * salga estirado.
 */
export function chipMarkingTexture(key, lines, aspect = 1) {
  const ck = "chip:" + key;
  if (cache.has(ck)) return cache.get(ck);
  const W = 256;
  const H = Math.max(64, Math.round(W / Math.max(0.3, aspect)));
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#16171b";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#7b7f85";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const n = lines.length;
  const size = Math.min(H / (n + 1.2), W / 6.2);
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${Math.round(size)}px ui-monospace, 'SF Mono', Menlo, monospace`;
    ctx.fillText(line, W / 2, H / 2 + (i - (n - 1) / 2) * size * 1.15);
  });
  // Marca de pin 1 grabada en la esquina.
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.14, Math.max(4, H * 0.045), 0, Math.PI * 2);
  ctx.fillStyle = "#2a2c31";
  ctx.fill();
  ctx.textAlign = "left";
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(ck, tex);
  return tex;
}

/**
 * Tapa del blindaje EMI (sep-18): chapa estañada con dos campos de
 * perforaciones de ventilacion, una zona lisa central (donde la toma la
 * maquina de montaje) y un reborde estampado. Fondo BLANCO: `.map` multiplica
 * por el color metalico del material.
 */
export function shieldLidTexture() {
  const key = "shield-lid";
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 284;                  // 36 x 20 mm
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  // Reborde estampado (una linea clara y otra oscura dan el relieve).
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#c9cdd2";
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = "#8e949b";
  ctx.strokeRect(18, 18, W - 36, H - 36);
  // Perforaciones en dos campos, dejando lisa la zona central.
  ctx.fillStyle = "#2c2f34";
  for (let y = 40; y < H - 30; y += 22) {
    for (let x = 40; x < W - 30; x += 22) {
      if (Math.abs(x - W / 2) < 70 && Math.abs(y - H / 2) < 60) continue;
      ctx.beginPath();
      ctx.arc(x + ((y / 22) % 2 ? 11 : 0), y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Muesca de orientacion en una esquina.
  ctx.beginPath();
  ctx.moveTo(W - 14, 14); ctx.lineTo(W - 44, 14); ctx.lineTo(W - 14, 44); ctx.closePath();
  ctx.fillStyle = "#7c8289";
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/**
 * Pasivo SMD visto en una caja unitaria (sep-18): terminales estañados en los
 * dos extremos y el cuerpo en el centro -- ceramico color canela ("cap") o
 * resistencia negra ("res"). Una textura por familia: todos los pasivos de la
 * placa se dibujan con dos mallas instanciadas.
 */
export function smdPassiveTexture(kind) {
  const key = "smd:" + kind;
  if (cache.has(key)) return cache.get(key);
  const W = 64, H = 32;
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = kind === "res" ? "#17181b" : "#8a7453";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#9da1a7";
  ctx.fillRect(0, 0, 14, H);
  ctx.fillRect(W - 14, 0, 14, H);
  if (kind === "res") {
    // Codigo impreso de la resistencia (3 cifras, apenas legible).
    ctx.fillStyle = "#8d9095";
    ctx.fillRect(24, 12, 3, 8); ctx.fillRect(31, 12, 3, 8); ctx.fillRect(38, 12, 3, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

/**
 * Etiquetas impresas de los modulos del portatil (sep-18): RAM, SSD, tarjeta
 * Wi-Fi y tapa del ventilador. Eran laminas blancas lisas; ahora llevan lo que
 * un tecnico lee en una pieza real (capacidad, tipo, formato, lote, codigo de
 * barras). Marca y codigos PROPIOS del laboratorio ("SENA LAB", prefijo SL);
 * los formatos (DDR4, NVMe, M.2) son estandares genericos, no productos.
 * La fila 0 del lienzo queda hacia -Z de la pieza (se lee derecha desde el
 * frente con la pieza boca arriba en la bandeja, y desde abajo instalada).
 */
export function moduleLabelTexture(kind) {
  const key = "mlabel:" + kind;
  if (cache.has(key)) return cache.get(key);
  const SPEC = {
    ram: { W: 512, H: 125, seed: 71 },
    ssd: { W: 512, H: 207, seed: 83 },
    wifi: { W: 300, H: 250, seed: 97 },
    fan: { W: 400, H: 255, seed: 101 },
  }[kind] || { W: 256, H: 128, seed: 1 };
  const { W, H } = SPEC;
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rng = makeRng(SPEC.seed);
  const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif";
  const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
  const barcode = (x0, x1, y, h) => {
    let x = x0;
    while (x < x1) {
      const bw = 1 + Math.floor(rng() * 3);
      if (rng() > 0.42) ctx.fillRect(x, y, bw, h);
      x += bw + 1;
    }
  };
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (kind === "wifi") {
    // Etiqueta blanca sobre el blindaje con codigo 2D.
    ctx.fillStyle = "#e9ebec";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d1f23";
    ctx.font = `700 34px ${SANS}`;
    ctx.fillText("SL-WX62", 16, 34);
    ctx.font = `600 22px ${SANS}`;
    ctx.fillText("Wi-Fi 6 + BT 5.2", 16, 74);
    ctx.font = `500 19px ${MONO}`;
    ctx.fillText("M.2 2230  2x2", 16, 106);
    ctx.fillText("MAC 7C:21:0A:3F", 16, 134);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      if (rng() > 0.5 || x === 0 || y === 0) ctx.fillRect(18 + x * 9, 158 + y * 9, 8, 8);
    }
    ctx.font = `500 15px ${MONO}`;
    ctx.fillText("SENA LAB", 120, 182);
    ctx.fillText("2236 A1", 120, 206);
  } else {
    ctx.fillStyle = "#eef0ee";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1d1f23";
    if (kind === "ram") {
      ctx.font = `800 30px ${SANS}`;
      ctx.fillText("SENA LAB  8GB DDR4", 12, 26);
      ctx.font = `600 22px ${MONO}`;
      ctx.fillText("1Rx8 PC4-3200AA-SC0-12", 12, 60);
      barcode(12, 300, 80, 34);
      ctx.font = `500 16px ${MONO}`;
      ctx.fillText("SL8G3200S16  2236", 312, 98);
    } else if (kind === "ssd") {
      ctx.fillRect(0, 0, W, 46);
      ctx.fillStyle = "#eef0ee";
      ctx.font = `800 30px ${SANS}`;
      ctx.fillText("SENA LAB  NVMe SSD", 14, 24);
      ctx.fillStyle = "#1d1f23";
      ctx.font = `700 34px ${SANS}`;
      ctx.fillText("512 GB", 14, 78);
      ctx.font = `600 20px ${MONO}`;
      ctx.fillText("M.2 2280  PCIe Gen3 x4", 14, 112);
      barcode(14, 360, 132, 40);
      ctx.font = `500 16px ${MONO}`;
      ctx.fillText("SN 7A21-3308-5512", 14, 188);
      ctx.fillText("DC 3.3V 2.5A", 380, 150);
    } else if (kind === "fan") {
      ctx.fillStyle = "#1d1f23";
      ctx.fillRect(0, 0, W, 54);
      ctx.fillStyle = "#eef0ee";
      ctx.font = `800 30px ${SANS}`;
      ctx.fillText("THERMAL MODULE", 16, 28);
      ctx.fillStyle = "#1d1f23";
      ctx.font = `700 28px ${MONO}`;
      ctx.fillText("SL-BF14", 16, 88);
      ctx.font = `600 22px ${MONO}`;
      ctx.fillText("DC 5V  0.40A  4-pin", 16, 124);
      barcode(16, 300, 146, 50);
      ctx.font = `500 17px ${MONO}`;
      ctx.fillText("SENA LAB  2234-B", 16, 222);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

/** Texto de serigrafia blanco sobre fondo TRANSPARENTE (se usa recortado con
 *  alphaTest, asi no pinta un rectangulo sobre el PCB). */
export function silkTextTexture(text) {
  const key = "silk:" + text;
  if (cache.has(key)) return cache.get(key);
  const W = 128, H = 64;
  const canvas = makeCanvas(W);
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#eef2ee";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 40px ui-monospace, 'SF Mono', Menlo, monospace";
  ctx.fillText(text, W / 2, H / 2 + 2);
  ctx.textAlign = "left";
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}
