/* js/hardware_lab_3d_pick_policy.js
 *
 * Politica de seleccion TOLERANTE (LOOP portatil, Fase C, 2026-10-01).
 * Funciones puras (sin three.js ni DOM) para poder probarlas en Node.
 *
 * Por que existe: la seleccion era UN rayo exacto en el pixel del toque. En
 * un telefono los tornillos miden 5-9 px y un dedo cubre ~40 px, asi que un
 * toque 1-2 px fuera caia en la pieza vecina y el motor lo contaba como error
 * de orden (-4 puntos). El laboratorio evalua conocimiento y procedimiento, no
 * punteria: un toque impreciso nunca debe costar puntos.
 *
 * Reglas (en este orden):
 *  1. El pixel exacto cae en un objetivo PRIORITARIO (el que el paso espera,
 *     o un tornillo de la pieza tocada)                          -> ese.
 *  2. Hay un objetivo prioritario dentro del radio de tolerancia -> el mas
 *     cercano (aunque el pixel exacto cayera en la pieza de al lado).
 *  3. El pixel exacto cae en otra pieza                          -> esa pieza
 *     (eleccion deliberada: la juzga el procedimiento, como siempre).
 *  4. El pixel exacto cae en vacio:
 *     - en las practicas no pasa nada (un toque al aire junto a una pieza
 *       equivocada no debe convertirse en un error de orden);
 *     - al explorar o diagnosticar (nearestOnEmpty) se toma la pieza mas
 *       cercana dentro del radio, salvo que haya dos casi a la misma
 *       distancia: entonces el toque es AMBIGUO y no se hace nada.
 */

/** Radio de tolerancia en px CSS segun el tipo de puntero. */
export function pickTolerancePx(pointerType) {
  if (pointerType === "touch") return 18;
  if (pointerType === "pen") return 8;
  return 5;
}

/** Desplazamientos (px) de los rayos de muestreo alrededor del toque: anillos
 *  cada ~4,5 px con puntos cada ~5 px de arco, para que un tornillo de 5 px no
 *  se cuele entre dos rayos (con 8 rayos por anillo se escapaba 1 de cada 4 a
 *  12 px; medido con clic real). */
export function ringOffsets(radius) {
  const out = [];
  if (!(radius > 0)) return out;
  const rings = Math.max(1, Math.round(radius / 4.5));
  for (let k = 1; k <= rings; k++) {
    const r = (radius * k) / rings;
    const n = Math.max(6, Math.ceil((2 * Math.PI * r) / 5));
    for (let i = 0; i < n; i++) {
      const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2;
      out.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, dist: r });
    }
  }
  return out;
}

/**
 * @param {object} o
 * @param {*} o.exact      clave del objeto bajo el pixel exacto, o null
 * @param {Array<{key:*, dist:number}>} o.near  objetos alcanzados por los rayos del anillo
 * @param {null|function(*, *):boolean} o.expected  (clave, claveExacta) -> ¿objetivo prioritario?
 * @param {boolean} o.nearestOnEmpty  un toque en vacio toma la pieza mas cercana
 * @returns {{key:*, assisted:boolean, reason:"exact"|"snap"|"nearest"|"ambiguous"|"none"}}
 */
export function choosePick({ exact = null, near = [], expected = null, nearestOnEmpty = true } = {}) {
  const isExpected = typeof expected === "function" ? (key) => !!expected(key, exact) : null;
  if (exact != null && (!isExpected || isExpected(exact))) return { key: exact, assisted: false, reason: "exact" };
  // Distancia minima por objeto.
  const best = new Map();
  for (const n of near) {
    if (n == null || n.key == null || n.key === exact) continue;
    const d = best.get(n.key);
    if (d == null || n.dist < d) best.set(n.key, n.dist);
  }
  const sorted = Array.from(best, ([key, dist]) => ({ key, dist })).sort((a, b) => a.dist - b.dist);
  if (isExpected) {
    const snap = sorted.find((c) => isExpected(c.key));
    if (snap) return { key: snap.key, assisted: true, reason: "snap" };
    if (exact != null) return { key: exact, assisted: false, reason: "exact" };
  }
  // exact == null aqui (si no, ya se devolvio arriba).
  if (!nearestOnEmpty || !sorted.length) return { key: null, assisted: false, reason: "none" };
  if (sorted.length > 1 && sorted[1].dist - sorted[0].dist < 3) return { key: null, assisted: false, reason: "ambiguous" };
  return { key: sorted[0].key, assisted: true, reason: "nearest" };
}
