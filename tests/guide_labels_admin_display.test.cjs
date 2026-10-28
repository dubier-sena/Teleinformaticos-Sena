"use strict";
// Candidata 2026-10-28 (normalizacion de guias, Fase 6D): el panel admin MUESTRA el
// nombre corto uniforme (getGuideDisplayLabel: "Guía N — Nombre", "Taller Integrador",
// "Práctica de Python") en selectores, tablas, avisos y exportaciones. getGuideTitle
// sigue siendo el dato (nombres en Drive, Word, progreso guardado) y no cambia.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("selectores, celdas y encabezados del panel no muestran el titulo largo", () => {
  for (const f of ["js/admin_usuarios.js", "js/admin_habilitacion.js", "js/admin_deadlines.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /<option[^`]*escapeHtml\(auth\.getGuideTitle\(/, f + ": <option> con titulo largo");
    assert.doesNotMatch(src, /<(td|h3)>\$\{escapeHtml\(auth\.getGuideTitle\(/, f + ": celda/encabezado con titulo largo");
  }
  const u = read("js/admin_usuarios.js");
  assert.match(u, /function guideLabel\(fileName\)[\s\S]{0,300}getGuideDisplayLabel/);
  assert.match(u, /guia: guideLabel\(fileName\),/, "exportacion Excel con nombre uniforme");
  assert.match(u, /archivoGuia: fileName,/, "el archivo de la guia se conserva en la exportacion");
  const h = read("js/admin_habilitacion.js");
  assert.match(h, /title: guideLabelFor\(auth, file\)/);
});

test("el dato guardado de progreso conserva getGuideTitle (no se reescriben registros)", () => {
  const u = read("js/admin_usuarios.js");
  assert.match(u, /title: auth\.getGuideTitle\(fileName\),\s*\n\s*completed: result\.progress\.completed/);
});

test("getGuideDisplayLabel: numeradas, Taller Integrador y Python sin institucion ajena", () => {
  const src = read("js/portal_auth.js");
  assert.match(src, /function getGuideDisplayLabel\(fileName\)/);
  assert.match(src, /return number == null \? name : "Guía " \+ number \+ " — " \+ name;/);
});
