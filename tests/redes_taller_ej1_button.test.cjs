const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HTML_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];

test("el ejercicio 1 del taller IP incluye boton y estado de guardado en ambas guias", () => {
  HTML_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
    assert.match(html, /id="btnGuardarTallerIPEj1"/);
    assert.match(html, /onclick="guardarTallerIPEj1\(\)"/);
    assert.match(html, /id="tallerIPEj1Status"/);
  });
});

test("el ejercicio 1 del taller IP incluye un boton de apoyo interactivo para clases de IP", () => {
  HTML_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
    assert.match(html, /onclick="abrirTeoriaPanel\('ip2'\)"/);
    assert.match(html, /MATERIAL DE APOYO INTERACTIVO/);
    assert.match(html, /Tipos de Clase de IP con ejemplos/);
  });
});

test("el lock del ejercicio 1 del taller IP queda integrado en guia y panel admin", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );

  assert.match(guideScript, /taller-ip-ej1-locked/);
  assert.match(guideScript, /window\.guardarTallerIPEj1\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej1-locked/);
});

test("el panel teorico de clases IP muestra mascaras por defecto con ejemplos concretos", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /M[aá]scara por defecto/);
  assert.match(guideScript, /255\.0\.0\.0/);
  assert.match(guideScript, /255\.255\.0\.0/);
  assert.match(guideScript, /255\.255\.255\.0/);
  assert.match(guideScript, /10\.5\.20\.1/);
  assert.match(guideScript, /172\.20\.0\.1/);
  assert.match(guideScript, /192\.168\.1\.50/);
});
