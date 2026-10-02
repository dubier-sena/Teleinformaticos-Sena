// Fase B (2026-10-01) — la tarjeta de instrucciones del laboratorio 3D:
//  1) contraerla y reabrirla nunca la deja recortada (max-height en linea);
//  2) la accion OBLIGATORIA del paso sigue visible con la tarjeta contraida;
//  3) hay un aviso persistente de accion pendiente;
//  4) los controles tactiles miden al menos 44 px.
// Pruebas estaticas de consistencia; el comportamiento real se mide con clic
// real en el banco headless (panel: 0 fallos de 20 en 320/360/390/430/768).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const stage = fs.readFileSync(path.join(ROOT, "js/hardware_lab_3d_stage.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "css/page_hardware_lab.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "laboratorio-virtual-hardware.html"), "utf8");

test("PA-1 placeCard no fija max-height con la tarjeta contraida", () => {
  assert.doesNotMatch(stage, /if \(!compact\) card\.style\.maxHeight = /, "el max-height incondicional recortaba la tarjeta al reabrir");
  assert.match(stage, /card\.style\.maxHeight = !compact && card\.getAttribute\("data-state"\) !== "closed" \?/);
});

test("PA-2 abrir o contraer descarta el alto forzado y recoloca", () => {
  const i = stage.indexOf('toggle.addEventListener("click"');
  assert.ok(i > 0);
  const handler = stage.slice(i, stage.indexOf("});", stage.indexOf("schedulePlaceCard(0);\n      });", i)) + 3);
  assert.strictEqual((handler.match(/card\.style\.maxHeight = "";/g) || []).length, 2, "las dos ramas del control limpian max-height");
  assert.strictEqual((handler.match(/schedulePlaceCard\(0\)/g) || []).length, 2, "las dos ramas recolocan la tarjeta");
});

test("PA-3 la accion obligatoria no se oculta con la tarjeta contraida", () => {
  assert.match(css, /\.hwlab-card\[data-state="closed"\]:not\(\[data-pending="true"\]\) \.hwlab-card__body/);
  assert.doesNotMatch(css, /\.hwlab-card\[data-state="closed"\] \.hwlab-card__body,/, "la regla antigua ocultaba el cuerpo siempre");
  for (const id of ["#hwlab-safety-confirm-btn", "#hwlab-prepare-btn", "#hwlab-power-check-btn", ".hwlab-thermal[data-required]", "[data-required-action]"]) {
    const band = css.split("\n").filter((l) => l.includes('[data-state="closed"][data-pending="true"]') && l.includes(":not("));
    assert.ok(band.length >= 3, "reglas de banda presentes");
    for (const l of band) assert.ok(l.includes(id), "la banda conserva " + id);
  }
});

test("PA-4 el escenario marca data-pending y muestra el aviso de accion pendiente", () => {
  assert.match(html, /id="hwlab-card-pending"[^>]*role="status"[^>]*hidden/);
  assert.match(stage, /if \(blocking\) card\.setAttribute\("data-pending", "true"\); else card\.removeAttribute\("data-pending"\);/, "solo lo que bloquea mantiene su boton con la tarjeta contraida");
  assert.match(stage, /function syncPendingAction\(panel\)/);
  assert.match(stage, /syncPendingAction\(panel\);\s*\n\s*const hasAction/);
  // Toda accion que el CSS mantiene visible esta en la lista del escenario.
  const m = stage.match(/const BLOCKING_ACTION = "([^"]+)"/);
  assert.ok(m);
  for (const id of ["#hwlab-safety-confirm-btn", "#hwlab-prepare-btn", ".hwlab-thermal[data-required]", "[data-required-action]"]) assert.ok(m[1].includes(id), id);
  assert.match(stage, /const MAIN_ACTION = BLOCKING_ACTION \+ ", #hwlab-power-check-btn"/);
});

test("PA-5 el control de la tarjeta anuncia lo que hara", () => {
  assert.match(stage, /function syncCardToggleLabel\(\)/);
  assert.match(stage, /const label = band \? "Mostrar instrucciones" : "Contraer instrucciones"/);
});

test("PA-6 objetivos tactiles de al menos 44 px", () => {
  const i = css.indexOf("@media (pointer: coarse), (max-width: 900px)");
  assert.ok(i > 0);
  const block = css.slice(i, css.indexOf("\n}\n", i));
  for (const sel of [".hwlab-card__more", ".hwlab-card__toggle", ".hwlab-history__toggle", "#hwlab-restart-btn", ".hwlab-card__body .c-btn"]) assert.ok(block.includes(sel), sel);
  assert.match(block, /min-height: var\(--hit-target-min\)/);
});
