"use strict";
// Reemplaza tres checks de tooling que rastreaban la migración del rediseño
// (check_pilot_redesign.js, check_redesign_rollout.js,
// check_portal_header_simplified.js). Fallaban porque asertaban una estructura
// de portal ya superada DOS veces (el index se rediseñó luego a "sesión
// primero"), y leían guías desde la raíz que se movieron a pages/guias/.
// Aquí se conservan solo los invariantes del index que siguen vigentes y son
// durables: usa el shell compartido del portal, expone el hook de avisos, no
// reintroduce estilos en línea, no congela los mapas demasiado pronto y no
// vuelve al encabezado largo/insignias previas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test("el index usa el shell compartido del portal y su hook de avisos", () => {
  const html = read("index.html");
  assert.match(html, /<body[^>]*class="[^"]*\bapp-shell--portal\b/i);
  assert.match(html, /id="portal-flash"/);
});

test("el index no reintroduce estilos en línea ni congela los mapas al cargar", () => {
  const html = read("index.html");
  // El rediseño movió todo el estilo a hojas externas (tokens + shell).
  assert.doesNotMatch(html, /<style[\s>]/i);
  // GUIDE_NAMES/FICHA_MAP se leen de portal_auth de forma diferida, no se
  // redeclaran congeladas en el index (evita divergencias con la fuente única).
  assert.doesNotMatch(html, /const\s+GUIDE_NAMES\s*=/);
  assert.doesNotMatch(html, /const\s+FICHA_MAP\s*=/);
});

test("el encabezado del index no vuelve al título largo ni a las insignias previas", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /Fortalecimiento de los Servicios Teleinform/);
  assert.doesNotMatch(html, /<span class="label">Programa<\/span>/);
});
