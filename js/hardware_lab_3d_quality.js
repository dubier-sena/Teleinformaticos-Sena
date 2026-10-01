/* js/hardware_lab_3d_quality.js
 *
 * Perfil de calidad y de movimiento del laboratorio 3D (LOOP portatil,
 * Fase E, 2026-10-01). Funcion pura: recibe datos del dispositivo y devuelve
 * los ajustes; no toca three.js ni el DOM (se prueba en Node).
 *
 * Por que existe: el render estaba pensado para un computador de escritorio y
 * se aplicaba igual a un telefono: pixel ratio hasta 2 con antialias, sombras
 * VSM de 2048 px recalculadas en CADA cuadro, ~1 180 draw calls por cuadro y
 * 60 cuadros por segundo aunque el aprendiz solo estuviera leyendo. Ademas
 * las animaciones duraban lo mismo en cualquier equipo (tornillo 3,1 s,
 * voltear 3,7 s; 25 tornillos = 78 s de espera).
 */

/**
 * @param {object} env
 *   coarse: boolean        puntero principal tactil
 *   minSide: number        lado menor de la pantalla en px CSS
 *   dpr: number            devicePixelRatio
 *   cores: number|null     navigator.hardwareConcurrency
 *   memoryGB: number|null  navigator.deviceMemory
 *   override: string|null  "mobile" | "desktop" (parametro ?hwq= de la URL)
 */
export function chooseQualityProfile(env = {}) {
  const dpr = env.dpr > 0 ? env.dpr : 1;
  const coarse = !!env.coarse;
  const small = env.minSide > 0 && env.minSide <= 900;
  const weak = (env.cores > 0 && env.cores <= 4) || (env.memoryGB > 0 && env.memoryGB <= 4);
  let mobile = coarse && (small || weak);
  if (env.override === "mobile") mobile = true;
  if (env.override === "desktop") mobile = false;
  if (mobile) {
    return {
      name: "mobile",
      // Un telefono de dpr 3 dibujaba a 2x: a 1,5x son un 44 % menos de pixeles.
      pixelRatio: Math.min(dpr, 1.5),
      // Con dpr >= 2 el suavizado MSAA apenas se nota y cuesta memoria y GPU.
      antialias: dpr < 2,
      shadowType: "pcf",
      shadowMapSize: 1024,
      // La sombra solo se recalcula cuando algo se mueve en la escena.
      shadowsOnDemand: true,
      // Las animaciones corren 1,5 veces mas rapido (tornillo ~2,1 s).
      motionScale: 1.5,
      idleFps: 6,
    };
  }
  return {
    name: "desktop",
    pixelRatio: Math.min(dpr, 2),
    antialias: true,
    shadowType: "vsm",
    shadowMapSize: 2048,
    shadowsOnDemand: false,
    motionScale: 1,
    idleFps: 12,
  };
}

/** Lee el dispositivo real. Separado de la decision para poder probarla. */
export function readDeviceEnv(win) {
  const w = win || (typeof window !== "undefined" ? window : null);
  if (!w) return {};
  let override = null;
  try {
    const q = new URLSearchParams(w.location.search).get("hwq");
    if (q === "mobile" || q === "desktop") override = q;
  } catch (_e) { /* sin URL: sin ajuste manual */ }
  const mm = (query) => { try { return !!(w.matchMedia && w.matchMedia(query).matches); } catch (_e) { return false; } };
  const nav = w.navigator || {};
  const scr = w.screen || {};
  const sides = [scr.width, scr.height, w.innerWidth, w.innerHeight].filter((n) => n > 0);
  return {
    coarse: mm("(pointer: coarse)"),
    minSide: sides.length ? Math.min(...sides) : 0,
    dpr: w.devicePixelRatio || 1,
    cores: nav.hardwareConcurrency || null,
    memoryGB: nav.deviceMemory || null,
    override,
  };
}
