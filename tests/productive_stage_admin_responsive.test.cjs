"use strict";

// Etapa Productiva admin, responsive (2026-09-23). Tres defectos con causas
// distintas, medidos en Chrome real:
//  - 320-412px: input[type=file] (~307px nativo + relleno) no encogia y
//    ensanchaba el documento a 421px.
//  - 721-869px: la barra de filtros (260 + 3x180 + huecos = 836px) no cabia.
//  - La onda (svg.wave, fill=currentColor) no tenia color (heredaba el texto,
//    casi negro) y el main subia 46px sobre ella: titulo oscuro sobre franja
//    oscura. Ahora la onda se monta sobre el borde del hero con el color del
//    lienzo y el main ya no sube.
// Geometria real (barrido 320-1440px, intersecciones, hit-test) se verifica en
// navegador; aqui se protegen las reglas para que no vuelvan.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "css", "page_productive_stage_admin.css"), "utf8");

// Bloques @media (max-width: N) de primer nivel, en orden de aparicion.
function mediaBlocks(source) {
  const out = [];
  const re = /@media\s*\(max-width:\s*(\d+)px\)\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    out.push({ width: Number(m[1]), start: m.index, body: source.slice(re.lastIndex, i - 1) });
  }
  return out;
}

function ruleBody(source, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = source.match(new RegExp("(?:^|\\n|\\})\\s*" + esc + "\\s*\\{([^}]*)\\}"));
  return m ? m[1] : null;
}

const baseCss = mediaBlocks(css).reduce((s, b) => s.replace(b.body, ""), css);

test("movil (<=560px): el input de archivo ocupa el ancho de su columna", () => {
  const b560 = mediaBlocks(css).find((b) => b.width === 560);
  assert.ok(b560, "falta el bloque @media (max-width: 560px)");
  const rule = ruleBody(b560.body, '.productive-stage-import input[type="file"]');
  assert.ok(rule && /width:\s*100%/.test(rule), "falta width:100% en el input de archivo");
});

test("barra de filtros: escritorio intacto, 2 columnas <=900px, 1 columna <=720px", () => {
  const base = ruleBody(baseCss, ".productive-stage-toolbar");
  assert.match(base, /grid-template-columns:\s*minmax\(260px,\s*1\.6fr\)\s*repeat\(3,\s*minmax\(180px,\s*1fr\)\)/, "cambio el layout de escritorio");
  const blocks = mediaBlocks(css);
  const b900 = blocks.find((b) => b.width === 900);
  const b720 = blocks.find((b) => b.width === 720);
  assert.ok(b900 && b720);
  assert.match(ruleBody(b900.body, ".productive-stage-toolbar"), /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(ruleBody(b720.body, ".productive-stage-toolbar"), /grid-template-columns:\s*1fr/);
  // Misma especificidad: el de 720 debe ir DESPUES para que su 1 columna gane.
  assert.ok(b900.start < b720.start, "el bloque de 900px debe ir antes que el de 720px");
});

test("main ya no sube sobre la onda: margin-top 0 y ningun margen negativo en ningun breakpoint", () => {
  assert.match(ruleBody(baseCss, ".productive-stage-admin-main"), /margin-top:\s*0\s*;/);
  for (const b of mediaBlocks(css)) {
    const rule = ruleBody(b.body, ".productive-stage-admin-main");
    assert.ok(!rule || !/margin-top:\s*-/.test(rule), `margen negativo en @media ${b.width}px`);
  }
});

test("onda: color explicito del lienzo (token --surface-2), bloque y montada sobre el hero", () => {
  const rule = ruleBody(baseCss, ".app-shell--productive-stage .wave");
  assert.ok(rule, "falta la regla de la onda");
  assert.match(rule, /color:\s*var\(--surface-2/);
  assert.match(rule, /display:\s*block/);
  assert.match(rule, /margin-top:\s*-40px/);
  assert.match(rule, /position:\s*relative/, "sin position la onda queda oculta bajo el hero (posicionado)");
});

// Contraste y casilla (2026-09-23). La 1ª cabecera de .document-delivery-table
// tenia background: var(--text-strong) (#102117) sin color propio: texto
// #16211b sobre #102117 = 1.01:1. Sin ese fondo hereda el #fff (opaco, sticky)
// de th:first-child: 16.57:1. La casilla "Solo con pendientes" heredaba el
// min-height:46px de los campos de la barra (13x46, texto 17px desalineado).
test("primera cabecera de las tablas: sin fondo oscuro, y sigue opaca y fija (sticky)", () => {
  const head = ruleBody(baseCss, ".document-delivery-table thead th:first-child");
  assert.ok(head, "falta la regla de la primera cabecera");
  assert.doesNotMatch(head, /background/, "la primera cabecera no debe redefinir el fondo (era var(--text-strong): contraste 1.01:1)");
  assert.match(head, /z-index:\s*2/);
  const col = ruleBody(baseCss, ".document-delivery-table th:first-child");
  assert.match(col, /position:\s*sticky/);
  assert.match(col, /background:\s*#fff\b/, "la columna fija necesita un fondo opaco");
});

test("casilla de la barra: no hereda el min-height de los campos de texto", () => {
  assert.match(ruleBody(baseCss, ".productive-stage-toolbar input,\n.productive-stage-toolbar select") || "", /min-height:\s*46px/, "la regla general de campos no debe cambiar");
  const cb = ruleBody(baseCss, '.productive-stage-toolbar input[type="checkbox"]');
  assert.ok(cb && /min-height:\s*0/.test(cb), "falta la excepcion min-height:0 para la casilla");
});

test("no se oculta el sintoma con overflow-x", () => {
  assert.doesNotMatch(css, /overflow-x:\s*(hidden|clip)/);
});
