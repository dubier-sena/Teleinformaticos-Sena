"use strict";
// Reemplaza dos checks de tooling obsoletos (tools/check_admin_ficha_filter.js y
// tools/check_shared_page_layouts.js) que asertaban el diseño PREVIO al
// rediseño: anchos `min(1480px, ...)`, el id `summary-users-label`, funciones
// `getSelectedFichaFilter`/`renderFichaFilterOptions`, y las guías de inducción
// en la raíz del repo. El rediseño revirtió esos valores y movió las guías a
// pages/guias/, por lo que esos checks fallaban por estar desactualizados, no
// por un defecto del producto.
//
// Aquí se fijan los INVARIANTES durables del diseño actual: el panel admin sigue
// permitiendo filtrar por ficha, y cada shell (portal, calendario, guía) acota
// el ancho del contenido en escritorio. Se asertan patrones (un tope `min(<px>)`
// existe) en vez de píxeles o versiones `?v=` concretas, para no romperse en
// cada ajuste fino o bump de caché.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test("el panel admin permite filtrar aprendices por ficha", () => {
  const html = read("panel-administrativo-usuarios.html");
  const js = read(path.join("js", "admin_usuarios.js"));

  // El selector de ficha existe en el panel.
  assert.match(html, /id="ficha-filter"/);
  // Está cableado: reacciona al cambio y se rellena con las opciones de ficha.
  assert.match(js, /byId\("ficha-filter"\)\?\.addEventListener\("change"/);
  assert.match(js, /byId\("ficha-filter"\)\.innerHTML = getFichaOptions\(/);
  assert.match(js, /function getFichaOptions\(/);
});

test("cada shell acota el ancho del contenido en escritorio", () => {
  // Evita que el contenido se estire a todo lo ancho en monitores grandes.
  const portalCss = read("css/page_portal.css");
  const calendarCss = read("css/page_calendar.css");
  const guideCss = read("css/guia_template.css");

  // Portal: contenedor principal con width: min(<px>, calc(100% - <px>px)).
  assert.match(portalCss, /width:\s*min\(\d{3,4}px,\s*calc\(100% - \d+px\)\);/);

  // Calendario: el hero compartido recibe un override de ancho de escritorio.
  const calHero = calendarCss.match(/\.app-shell--calendar \.app-hero__inner \{[\s\S]*?\}/);
  assert.ok(calHero, "el hero del calendario debe tener su propio bloque de ancho");
  assert.match(calHero[0], /width:\s*min\(\d{3,4}px,/);

  // Guía: el área de contenido descuenta el ancho del sidebar.
  assert.match(
    guideCss,
    /width:\s*min\(\d{3,4}px,\s*calc\(100vw - var\(--sidebar-w\) - \d+px\)\);/
  );
});

test("las guías de inducción usan el shell y la hoja de estilos compartida", () => {
  for (const file of [
    "pages/guias/grupo-10a-guia-01-induccion.html",
    "pages/guias/grupo-10b-guia-01-induccion.html",
  ]) {
    const html = read(file);
    assert.match(html, /class="app-shell app-shell--guide"/, `${file} debe usar el shell de guía`);
    assert.match(html, /guia_template\.css/, `${file} debe enlazar la hoja de estilos compartida`);
  }
});
