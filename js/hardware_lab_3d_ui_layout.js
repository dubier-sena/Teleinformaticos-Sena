/**
 * hardware_lab_3d_ui_layout.js
 *
 * Colocacion de la interfaz flotante alrededor del TRABAJO del aprendiz
 * (sep-26). Funciones PURAS (rectangulos en pixeles de pantalla, sin DOM ni
 * three.js): el stage mide y aplica; aqui solo se decide. Probadas en Node.
 *
 * Prioridad espacial: pieza objetivo > instrucciones > controles > avisos >
 * historial. La tarjeta nunca se coloca encima del dock ni del historial.
 */

/** Rectangulo {left, top, right, bottom}. */
export function rect(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height };
}

export function area(r) {
  return r ? Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top) : 0;
}

export function intersection(a, b) {
  if (!a || !b) return 0;
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Fraccion (0..1) de la PIEZA que queda debajo del rectangulo de la interfaz.
 * Si el objetivo trae `points` (geometria visible proyectada) se cuentan los
 * puntos cubiertos: con el rectangulo envolvente, un cable fino en diagonal
 * parecia "casi libre" aunque el aviso tapara la mitad del cable (medido).
 */
export function coverRatio(ui, target) {
  if (!ui || !target) return 0;
  if (target.points && target.points.length) {
    let n = 0;
    for (const p of target.points) if (p.x >= ui.left && p.x <= ui.right && p.y >= ui.top && p.y <= ui.bottom) n++;
    return n / target.points.length;
  }
  const t = area(target);
  return t > 0 ? intersection(ui, target) / t : 0;
}

/**
 * Posiciones candidatas de la tarjeta dentro de la escena, en orden de
 * preferencia. `scene` es el rectangulo de la escena; `card` = {width, height}
 * (alto natural); `dock`/`history` son rectangulos a respetar (o null).
 * Devuelve [{slot, rect}] solo con las que caben sin pisar dock ni historial.
 */
export function cardCandidates({ scene, card, dock, history, gap = 12, mobile = false }) {
  const w = Math.min(card.width, scene.right - scene.left - 2 * gap);
  const out = [];
  const add = (slot, left, top, h) => {
    const height = Math.max(0, Math.min(card.height, h));
    if (height < 40) return;
    const r = rect(left, top, w, height);
    const clear = (o) => !o || intersection(grow(o, 6), r) === 0;
    // `full`: la tarjeta cabe entera (sin recortar ni scroll interno).
    if (r.left >= scene.left && r.right <= scene.right && r.top >= scene.top && r.bottom <= scene.bottom && clear(dock) && clear(history)) out.push({ slot, rect: r, full: height >= card.height - 1 });
  };
  const bottomLimit = (history ? history.top : scene.bottom) - gap;
  if (mobile) {
    // Banda arriba o, si tapa la pieza, banda encima de la barra de controles.
    const top = scene.top + gap;
    add("top", scene.left + gap, top, bottomLimit - top);
    const low = (dock ? dock.top : bottomLimit) - gap;
    add("bottom", scene.left + gap, low - Math.min(card.height, low - top), Math.min(card.height, low - top));
    return out;
  }
  const right = scene.right - gap - w;
  const left = scene.left + gap;
  const topY = scene.top + gap;
  add("tr", right, topY, bottomLimit - topY);
  // Columna izquierda: el dock puede estar ARRIBA (por defecto) o ABAJO (se
  // aparta de la pieza). La tarjeta usa el espacio que el dock deja libre.
  const dockLeft = dock && dock.left < left + w;
  const dockOnTop = dockLeft && (dock.top + dock.bottom) / 2 < (scene.top + scene.bottom) / 2;
  const tlTop = dockOnTop ? dock.bottom + gap : topY;
  const blBottom = dockLeft && !dockOnTop ? Math.min(bottomLimit, dock.top - gap) : bottomLimit;
  add("tl", left, tlTop, (dockLeft && !dockOnTop ? blBottom : bottomLimit) - tlTop);
  const brBottom = scene.bottom - gap;
  add("br", right, brBottom - Math.min(card.height, brBottom - topY), Math.min(card.height, brBottom - topY));
  add("bl", left, blBottom - Math.min(card.height, blBottom - tlTop), Math.min(card.height, blBottom - tlTop));
  return out;
}

function grow(r, d) {
  return { left: r.left - d, top: r.top - d, right: r.right + d, bottom: r.bottom + d };
}

/**
 * Elige la posicion que menos tapa la pieza. HISTERESIS: se queda en la
 * posicion actual mientras siga siendo aceptable (<= limit) o casi tan buena
 * como la mejor (dentro de `margin`), para que la tarjeta no "salte". Pero no
 * se queda en una posicion donde la tarjeta sale RECORTADA (con scroll) si hay
 * otra aceptable donde cabe entera (medido a 1440x900: 239 px con scroll bajo
 * el dock teniendo libre la esquina derecha).
 */
export function chooseSlot(candidates, target, current, { limit = 0.1, margin = 0.05 } = {}) {
  if (!candidates.length) return null;
  const scored = candidates.map((c) => ({ ...c, cover: coverRatio(c.rect, target), full: c.full !== false }));
  const best = scored.reduce((a, b) => (b.cover < a.cover ? b : a));
  const okFull = scored.filter((c) => c.full && c.cover <= limit);
  const cur = scored.find((c) => c.slot === current);
  if (cur && (cur.full || !okFull.length) && (cur.cover <= limit || cur.cover <= best.cover + margin)) return cur;
  if (okFull.length) return okFull.reduce((a, b) => (b.cover < a.cover ? b : a));
  return best;
}

/**
 * Posicion del aviso flotante. `spots` = [{pos, rect}] en orden de preferencia
 * (el primero es abajo al centro). Prioridades (microfase C.1): no tapar la
 * PIEZA (mas de `limit`) > no tapar un control OBLIGATORIO (`required`: el
 * boton de la tarjeta, "Encender y comprobar", "Preparar"...; medido en 390:
 * el aviso de "Preparar" tapaba el propio boton "Preparar") > no pisar la
 * tarjeta ni el dock (`avoid`: texto sobre texto no se lee) > no tapar la
 * ETIQUETA (`protect`) > no pisar el historial (`low`) > la preferida.
 */
export function chooseFeedbackSpot(spots, target, avoid = [], { limit = 0.1, protect = [], low = [], required = [] } = {}) {
  const hits = (r, list) => list.filter((a) => a && intersection(r, a) > 0).length;
  const scored = spots.map((s, i) => {
    const cover = target ? coverRatio(s.rect, target) : 0;
    // Dentro del limite se prefiere igual la que MENOS tapa (en pasos de 5 %).
    return { s, key: [cover > limit ? cover : 0, hits(s.rect, required), hits(s.rect, avoid), hits(s.rect, protect), Math.round(cover * 20), hits(s.rect, low), i] };
  });
  scored.sort((a, b) => { for (let k = 0; k < a.key.length; k++) if (a.key[k] !== b.key[k]) return a.key[k] - b.key[k]; return 0; });
  return scored[0].s;
}

/**
 * Esquina del dock COMPACTO: arriba a la izquierda salvo que tape la pieza;
 * entonces abajo a la izquierda (encima del historial). `spots` = [{pos, rect}].
 */
export function chooseDockSpot(spots, target, current, { limit = 0.1 } = {}) {
  const scored = spots.map((s) => ({ ...s, cover: coverRatio(s.rect, target) }));
  const cur = scored.find((s) => s.pos === current) || scored[0];
  if (cur.cover <= limit) return cur;
  return scored.reduce((a, b) => (b.cover < a.cover ? b : a));
}

/**
 * AREA SEGURA de la escena para el 3D (sep-26): la escena menos las BANDAS de
 * interfaz que no se apartan de la pieza. Una tarjeta que ocupa casi todo el
 * ancho (movil) recorta arriba o abajo; la barra del dock y el historial
 * anchos recortan abajo; la columna alta del dock de escritorio recorta a la
 * izquierda. La tarjeta flotante de escritorio NO recorta: ella se aparta de
 * la pieza (chooseSlot). Todo derivado de rectangulos medidos, sin tamanos
 * de pantalla fijos.
 */
export function safeViewRect({ scene, card, dock, history, gap = 8 }) {
  let left = scene.left + gap, top = scene.top + gap, right = scene.right - gap, bottom = scene.bottom - gap;
  const sw = scene.right - scene.left, sh = scene.bottom - scene.top;
  const w = (r) => r.right - r.left, h = (r) => r.bottom - r.top;
  if (card && w(card) > 0.6 * sw) {
    if ((card.top + card.bottom) / 2 < scene.top + sh / 2) top = Math.max(top, card.bottom + gap);
    else bottom = Math.min(bottom, card.top - gap);
  }
  if (dock) {
    if (w(dock) > 0.6 * sw) bottom = Math.min(bottom, dock.top - gap);
    else if (h(dock) > 0.4 * sh) left = Math.max(left, dock.right + gap);
  }
  // El historial NO se aparta de la pieza (a diferencia de la tarjeta y del
  // dock compacto): siempre recorta abajo, aunque sea estrecho (medido: un
  // tornillo del teclado quedaba debajo de el a 1024x625).
  if (history) bottom = Math.min(bottom, history.top - gap);
  return { left, top, right: Math.max(right, left + 1), bottom: Math.max(bottom, top + 1) };
}

/**
 * ¿El encuadre actual de la pieza es aceptable? `points` = proyeccion en
 * pantalla de su geometria visible ({x, y, front}); `safe` = safeViewRect.
 * Pide >= 90 % de la pieza dentro del area segura (>= 80 % si es muy grande:
 * pantalla, tapa, placa, donde el 100 % dejaria la vista inutil) y un tamano
 * aparente minimo para poder seleccionarla, y que sus tornillos pendientes
 * (`screws`) esten todos dentro. Devuelve { ok, inside, sizePx, screwsOut }.
 */
export function framingVerdict(points, safe, { large = false, need = large ? 0.8 : 0.9, minPx = 36, screws = [], minScrewPx = 10 } = {}) {
  if (!points || !points.length) return { ok: false, inside: 0, sizePx: 0 };
  // Cada tornillo que el paso pide tocar debe caer DENTRO (si no, hay que
  // cambiar de vista a mano para alcanzarlo: medido en la placa base) y
  // verse con un tamano seleccionable (una placa recien instalada vista
  // desde la vista general, a 2,4 m, tenia tornillos de 3-4 px).
  const screwsOut = screws.filter((p) => !p.front || p.x < safe.left || p.x > safe.right || p.y < safe.top || p.y > safe.bottom || (p.px != null && p.px < minScrewPx)).length;
  let n = 0;
  const xs = [], ys = [];
  points.forEach((p) => {
    if (!p.front) return;
    xs.push(p.x); ys.push(p.y);
    if (p.x >= safe.left && p.x <= safe.right && p.y >= safe.top && p.y <= safe.bottom) n++;
  });
  const inside = n / points.length;
  const q = (a, f) => { const b = a.slice().sort((u, v) => u - v); return b.length ? b[Math.min(b.length - 1, Math.floor(f * (b.length - 1)))] : 0; };
  const sizePx = xs.length ? Math.max(q(xs, 0.95) - q(xs, 0.05), q(ys, 0.95) - q(ys, 0.05)) : 0;
  return { ok: inside >= need && sizePx >= minPx && screwsOut === 0, inside, sizePx, screwsOut };
}
