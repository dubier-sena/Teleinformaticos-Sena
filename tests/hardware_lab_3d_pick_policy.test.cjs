// Fase C (2026-10-01) — seleccion tolerante del laboratorio 3D.
// Un toque impreciso junto al objetivo correcto cuenta como el objetivo
// correcto y nunca como error de orden. La politica es pura (sin three.js):
// se prueba aqui; el efecto real se mide con toques reales en el banco
// headless (390 px: a 9 px de un tornillo, 12 % -> 94 %; pieza vecina 53 % -> 0 %).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let P;
test.before(async () => { P = await import(pathToFileURL(path.join(ROOT, "js/hardware_lab_3d_pick_policy.js")).href); });

test("PK-1 el radio depende del puntero: dedo > lapiz > raton", () => {
  assert.strictEqual(P.pickTolerancePx("touch"), 18);
  assert.strictEqual(P.pickTolerancePx("pen"), 8);
  assert.strictEqual(P.pickTolerancePx("mouse"), 5);
  assert.strictEqual(P.pickTolerancePx(undefined), 5);
});

test("PK-2 el anillo cubre el radio sin huecos mayores que un tornillo (5 px)", () => {
  for (const radius of [5, 8, 18]) {
    const pts = P.ringOffsets(radius);
    assert.ok(pts.length >= 6);
    assert.ok(pts.every((p) => Math.hypot(p.dx, p.dy) <= radius + 1e-9), "ningun rayo sale del radio");
    assert.ok(pts.some((p) => Math.abs(p.dist - radius) < 1e-9), "llega hasta el borde");
    // Cualquier punto del disco tiene un rayo a menos de ~3,6 px.
    let worst = 0;
    for (let x = -radius; x <= radius; x += 1) for (let y = -radius; y <= radius; y += 1) {
      if (Math.hypot(x, y) > radius) continue;
      let d = Math.hypot(x, y); // el rayo exacto del centro
      for (const p of pts) d = Math.min(d, Math.hypot(x - p.dx, y - p.dy));
      worst = Math.max(worst, d);
    }
    assert.ok(worst <= 3.6, "hueco maximo " + worst.toFixed(2) + " px con radio " + radius);
  }
  assert.deepStrictEqual(P.ringOffsets(0), []);
});

test("PK-3 pixel exacto sobre el objetivo esperado: ese, sin asistencia", () => {
  const r = P.choosePick({ exact: "tornillo", near: [{ key: "tapa", dist: 3 }], expected: (k) => k === "tornillo", nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: "tornillo", assisted: false, reason: "exact" });
});

test("PK-4 pixel exacto en la pieza vecina con el objetivo esperado dentro del radio: se toma el esperado", () => {
  const r = P.choosePick({ exact: "tapa", near: [{ key: "tapa", dist: 4 }, { key: "tornillo", dist: 9 }], expected: (k) => k === "tornillo", nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: "tornillo", assisted: true, reason: "snap" });
});

test("PK-5 toque en vacio junto al objetivo esperado: se toma el esperado mas cercano", () => {
  const r = P.choosePick({ exact: null, near: [{ key: "t2", dist: 14 }, { key: "t1", dist: 6 }, { key: "t1", dist: 12 }], expected: (k) => /^t/.test(k), nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: "t1", assisted: true, reason: "snap" });
});

test("PK-6 eleccion deliberada de otra pieza (nada esperado cerca): se respeta y la juzga el procedimiento", () => {
  const r = P.choosePick({ exact: "ram", near: [{ key: "ssd", dist: 10 }], expected: (k) => k === "bateria", nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: "ram", assisted: false, reason: "exact" });
});

test("PK-7 practica: un toque al aire junto a una pieza equivocada NO se convierte en error", () => {
  const r = P.choosePick({ exact: null, near: [{ key: "ram", dist: 5 }], expected: (k) => k === "bateria", nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: null, assisted: false, reason: "none" });
});

test("PK-8 explorar/diagnosticar: un toque al aire toma la pieza mas cercana; entre dos, es ambiguo", () => {
  assert.deepStrictEqual(P.choosePick({ exact: null, near: [{ key: "antena", dist: 7 }, { key: "wifi", dist: 15 }] }), { key: "antena", assisted: true, reason: "nearest" });
  assert.deepStrictEqual(P.choosePick({ exact: null, near: [{ key: "antena", dist: 7 }, { key: "wifi", dist: 8 }] }), { key: null, assisted: false, reason: "ambiguous" });
  assert.deepStrictEqual(P.choosePick({ exact: null, near: [] }), { key: null, assisted: false, reason: "none" });
  assert.deepStrictEqual(P.choosePick({ exact: "ram", near: [{ key: "ssd", dist: 2 }] }), { key: "ram", assisted: false, reason: "exact" });
});

test("PK-9 la prioridad puede depender de lo tocado: tornillo de la MISMA pieza (diagnostico)", () => {
  const owner = { s1: "tapa", s9: "placa" };
  const expected = (k, exact) => k in owner && owner[k] === exact;
  assert.strictEqual(P.choosePick({ exact: "tapa", near: [{ key: "s9", dist: 4 }, { key: "s1", dist: 10 }], expected }).key, "s1");
  assert.strictEqual(P.choosePick({ exact: "ram", near: [{ key: "s9", dist: 4 }], expected }).key, "ram");
});

test("PK-10 la capa de interaccion usa la politica y la expone; el dedo no hace hover por cuadro", () => {
  const src = read("js/hardware_lab_3d_interactions.js");
  assert.match(src, /import \{ pickTolerancePx, ringOffsets, choosePick \} from "\.\/hardware_lab_3d_pick_policy\.js\?v=\d{8}_\d+";/);
  assert.match(src, /const pick = pickAt\(event\.clientX, event\.clientY, event\.pointerType \|\| "mouse"\);/);
  assert.match(src, /clickListeners\.forEach\(\(fn\) => fn\(root, meta, event, pick\)\);/);
  assert.match(src, /if \(!enabled \|\| !registry\.size \|\| lastPointerType !== "mouse"\) return;/);
  assert.match(src, /pickAt,\s*\n\s*setPickExpectation,/);
  assert.match(src, /occluders\.clear\(\);\s*\n\s*pickExpectation = null;/, "cambiar de equipo o modo olvida la expectativa anterior");
});

test("PK-11 las practicas declaran el objetivo del paso; el diagnostico, los tornillos de la pieza tocada", () => {
  const ctl = read("js/hardware_lab_3d_controller.js");
  assert.match(ctl, /stage\.interactions\.setPickExpectation\(pickExpectation\);/);
  assert.match(ctl, /nearestOnEmpty: false,/);
  assert.match(ctl, /canOperateScrewPart\(entry\.partId, entry\.installed \? "remove" : "install", true\)\.ok/);
  assert.match(ctl, /if \(dry\) return \{ ok: true \};/, "la consulta no mueve el panel ni la posicion pedida");
  const diag = read("js/hardware_lab_3d_diagnosis_controller.js");
  assert.match(diag, /stage\.interactions\.setPickExpectation\(\(\) => \(\{\s*\n\s*nearestOnEmpty: true,/);
  assert.match(diag, /entry\.installed && entry\.partId === exact\.partId/);
});

test("PK-12 tocar la pieza en vez de sus tornillos es un aviso neutro, no un error", () => {
  const ctl = read("js/hardware_lab_3d_controller.js");
  const i = ctl.indexOf('" por retirar en " + part.name');
  assert.ok(i > 0);
  assert.match(ctl.slice(i, i + 200), /"info"/);
  assert.doesNotMatch(ctl.slice(i, i + 320), /"error"/);
  const mech = read("js/hardware_lab_3d_diagnosis_mechanics.js");
  const j = mech.indexOf('" por retirar en " + part.name');
  assert.match(mech.slice(j - 200, j), /tone: "info"/);
  assert.match(read("js/hardware_lab_3d_stage.js"), /pick\.reason === "ambiguous"\) showFeedback\("Tocaste entre dos piezas\./);
});

test("PK-13 objetivos diminutos: ademas del anillo se mira el centro en pantalla de cada objetivo esperado", () => {
  const src = read("js/hardware_lab_3d_interactions.js");
  const i = src.indexOf("function pickAt(");
  const body = src.slice(i, src.indexOf("function setPickExpectation", i));
  assert.match(body, /registry\.forEach\(\(meta, root\) => \{\s*\n\s*if \(root === exact \|\| !root\.visible \|\| !expected\(root, exact\)\) return;/);
  assert.match(body, /if \(dist > tolerance\) return;/, "nunca mas alla del radio de tolerancia: sin hitbox gigante");
  assert.match(body, /if \(cast\(Math\.round\(cx\), Math\.round\(cy\)\) === root\) near\.push\(\{ key: root, dist \}\);/, "solo si el objetivo esta a la vista");
  // Con el candidato del centro, la politica elige el objetivo esperado aunque el anillo no lo tocara.
  const r = P.choosePick({ exact: "tapa", near: [{ key: "tapa", dist: 4.5 }, { key: "tornillo", dist: 6 }], expected: (k) => k === "tornillo", nearestOnEmpty: false });
  assert.deepStrictEqual(r, { key: "tornillo", assisted: true, reason: "snap" });
});
