// Fase E (2026-10-01) — rendimiento movil del laboratorio 3D.
// Perfil de calidad por dispositivo (puro), render bajo demanda, sombras solo
// cuando algo se mueve y animaciones mas cortas en el telefono.
// Medido con Chrome headless emulando 390x844 dpr 3 tactil: 1,00 -> 0,57
// megapixeles; en reposo 60 -> 5,7 cuadros dibujados por segundo
// (70 000 -> 3 300 draw calls por segundo); tornillo 3,1 -> 2,2 s.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let Q;
test.before(async () => { Q = await import(pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_quality.js")).href); });

test("QL-1 telefono tactil: menos pixeles, sin MSAA con dpr alto, sombras bajo demanda, animaciones 1,5x", () => {
  const p = Q.chooseQualityProfile({ coarse: true, minSide: 390, dpr: 3, cores: 8, memoryGB: 4 });
  assert.deepStrictEqual(p, { name: "mobile", pixelRatio: 1.5, antialias: false, shadowType: "pcf", shadowMapSize: 1024, shadowsOnDemand: true, motionScale: 1.5, idleFps: 6 });
  assert.strictEqual(Q.chooseQualityProfile({ coarse: true, minSide: 360, dpr: 1 }).antialias, true, "con dpr 1 el suavizado si hace falta");
  assert.strictEqual(Q.chooseQualityProfile({ coarse: true, minSide: 360, dpr: 1 }).pixelRatio, 1);
});

test("QL-2 computador con raton: la misma calidad y las mismas duraciones de siempre", () => {
  const p = Q.chooseQualityProfile({ coarse: false, minSide: 900, dpr: 2, cores: 8 });
  assert.deepStrictEqual(p, { name: "desktop", pixelRatio: 2, antialias: true, shadowType: "vsm", shadowMapSize: 2048, shadowsOnDemand: false, motionScale: 1, idleFps: 12 });
  // Un portatil tactil grande y potente no es un telefono.
  assert.strictEqual(Q.chooseQualityProfile({ coarse: true, minSide: 1080, dpr: 1.5, cores: 12, memoryGB: 8 }).name, "desktop");
  // Una tableta tactil modesta si usa el perfil ligero.
  assert.strictEqual(Q.chooseQualityProfile({ coarse: true, minSide: 1080, dpr: 2, cores: 4 }).name, "mobile");
  // Un computador viejo con raton no se degrada (no hay queja medida ahi).
  assert.strictEqual(Q.chooseQualityProfile({ coarse: false, minSide: 768, dpr: 1, cores: 2, memoryGB: 2 }).name, "desktop");
});

test("QL-3 ajuste manual por URL (?hwq=) y lectura del dispositivo", () => {
  assert.strictEqual(Q.chooseQualityProfile({ coarse: false, minSide: 1440, dpr: 1, override: "mobile" }).name, "mobile");
  assert.strictEqual(Q.chooseQualityProfile({ coarse: true, minSide: 360, dpr: 3, override: "desktop" }).name, "desktop");
  const win = { location: { search: "?hwq=mobile&x=1" }, matchMedia: (q) => ({ matches: q === "(pointer: coarse)" }), navigator: { hardwareConcurrency: 8, deviceMemory: 4 }, screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 700, devicePixelRatio: 3 };
  assert.deepStrictEqual(Q.readDeviceEnv(win), { coarse: true, minSide: 390, dpr: 3, cores: 8, memoryGB: 4, override: "mobile" });
  assert.strictEqual(Q.readDeviceEnv({ location: { search: "?hwq=otro" }, navigator: {} }).override, null);
  assert.strictEqual(Q.chooseQualityProfile({}).name, "desktop", "sin datos: el comportamiento de siempre");
});

test("QL-4 la escena aplica el perfil y dibuja bajo demanda (la logica sigue en todos los cuadros)", () => {
  const scene = read("js/hardware_lab_3d_scene.js");
  assert.match(scene, /export function createLabScene\(canvas, profile\)/);
  assert.match(scene, /antialias: quality\.antialias,/);
  assert.match(scene, /renderer\.setPixelRatio\(quality\.pixelRatio\);/);
  assert.match(scene, /if \(quality\.shadowsOnDemand\) renderer\.shadowMap\.autoUpdate = false;/);
  assert.match(scene, /key\.shadow\.mapSize\.set\(quality\.shadowMapSize, quality\.shadowMapSize\);/);
  const loop = scene.slice(scene.indexOf("renderer.setAnimationLoop(() => {"), scene.indexOf("// Cualquier gesto del aprendiz"));
  assert.ok(loop.indexOf("tickCallbacks.forEach") < loop.indexOf("quality.idleFps) return;"), "los ticks corren antes de decidir si se dibuja");
  assert.match(loop, /if \(t >= awakeUntil && t - lastRender < 1000 \/ quality\.idleFps\) return;/);
  assert.match(loop, /if \(cameraMoved\(\)\) keepAwake\(350, \{ shadows: false \}\);/);
  assert.match(scene, /document\.addEventListener\("click", wakeAll, true\);/);
  assert.match(scene, /keepAwake,\s*\n\s*stats,\s*\n\s*quality,/);
});

test("QL-5 el escenario conecta perfil, animaciones y despertar por tweens", () => {
  const stage = read("js/hardware_lab_3d_stage.js");
  assert.match(stage, /const quality = chooseQualityProfile\(readDeviceEnv\(\)\);\s*\n\s*sceneApi = createLabScene\(canvas, quality\);/);
  assert.match(stage, /tweenGroup\.timeScale = quality\.motionScale;/);
  assert.match(stage, /if \(tweenGroup\.activeCount\) sceneApi\.keepAwake\(300\);/);
});

test("QL-6 la escala de tiempo acelera las animaciones sin cambiar su estado final", async () => {
  const T = await import(pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_tween.js")).href);
  const run = (scale) => {
    const g = new T.TweenGroup();
    g.timeScale = scale;
    let last = null, done = 0, frames = 0;
    T.animateValue(g, 0, 10, { duration: 3, easing: T.Easing.linear || ((t) => t), onUpdate: (v) => { last = v; }, onComplete: () => { done++; } });
    while (g.activeCount && frames < 1000) { g.update(0.1); frames++; }
    return { last, done, frames };
  };
  const normal = run(1), rapido = run(1.5);
  assert.strictEqual(normal.done, 1); assert.strictEqual(rapido.done, 1);
  assert.strictEqual(normal.last, 10); assert.strictEqual(rapido.last, 10);
  assert.ok(Math.abs(normal.frames - 30) <= 1, "3 s a 0,1 s por cuadro: " + normal.frames);
  assert.ok(Math.abs(rapido.frames - 20) <= 1, "a 1,5x: " + rapido.frames);
});
