"use strict";
// Guardia academica de las guias de Redes de grado 11 (2026-09-22).
//
// Las guias 9, 10 y 11 de 11A/11B deben conservar EXACTAMENTE las actividades,
// laboratorios, evidencias y productos de las guias de Redes de 10 Santa
// Barbara. La unica diferencia academica permitida es la ficha del programa:
// competencia, RAP, fase y duracion.
//
// La garantia mas fuerte posible es estructural: grado 10 y grado 11 comparten
// EL MISMO archivo de contenido (partials/guia-redes-rap0N-content.html). Si
// alguien clonara el partial para "adaptarlo", esta prueba lo detecta de
// inmediato, porque los contextos dejarian de apuntar al mismo archivo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

function loadContexts() {
  const sandbox = {};
  new Function("window", read("data/guide_contexts_bundle.js"))(sandbox);
  return sandbox.__GUIDE_RUNTIME_CONTEXTS__;
}

// RAP -> (contexto de referencia de 10 Santa Barbara, contextos de grado 11)
const PARES = [
  { rap: "01", base: "sb-redes-10a", grado11: ["sb11-redes-rap01-11a", "sb11-redes-rap01-11b"], guia: "9" },
  { rap: "02", base: "sb-redes-rap02-10a", grado11: ["sb11-redes-rap02-11a", "sb11-redes-rap02-11b"], guia: "10" },
  { rap: "03", base: "sb-redes-rap03-10a", grado11: ["sb11-redes-rap03-11a", "sb11-redes-rap03-11b"], guia: "11" },
];

const VALORES = {
  competencia: "280102129 — Evaluar red de acuerdo con procedimientos de telecomunicaciones y normativa técnica.",
  fase: "Análisis",
  "01": { rap: "RAP 01 — Definir los parámetros y recursos de la red de acuerdo con normativa de telecomunicaciones.",
          duracion: "60 horas (45 horas de formación directa y 15 horas de trabajo independiente)" },
  "02": { rap: "RAP 02 — Comprobar la conectividad de la red, de acuerdo con normativa de telecomunicaciones y orden de trabajo.",
          duracion: "40 horas" },
  "03": { rap: "RAP 03 — Documentar las acciones realizadas en la red de acuerdo con la normativa.",
          duracion: "40 horas (30 horas de trabajo directo y 10 horas de trabajo independiente)" },
};

test("grado 11 reutiliza EL MISMO partial de contenido que Santa Barbara 10", () => {
  const ctx = loadContexts();
  for (const { rap, base, grado11 } of PARES) {
    const esperado = ctx[base].partialPath;
    for (const key of grado11) {
      assert.equal(
        ctx[key].partialPath,
        esperado,
        `${key}: usa un partial distinto al de grado 10 (${ctx[key].partialPath} != ${esperado}). ` +
          "Las actividades deben ser literalmente las mismas, no una copia adaptada."
      );
    }
    assert.ok(fs.existsSync(path.join(ROOT, esperado)), `no existe ${esperado}`);
  }
});

test("los contextos de grado 11 solo añaden competencia, RAP, fase y duracion", () => {
  const ctx = loadContexts();
  // Campos que un contexto de grado 11 puede traer ademas de los de grado 10.
  const PERMITIDOS = new Set(["competencia", "rap", "fase", "duracion", "duracionCorta"]);
  for (const { base, grado11 } of PARES) {
    const clavesBase = new Set(Object.keys(ctx[base]));
    for (const key of grado11) {
      const extra = Object.keys(ctx[key]).filter((k) => !clavesBase.has(k) && !PERMITIDOS.has(k));
      assert.deepEqual(
        extra, [],
        `${key}: introduce campos de contexto no permitidos: ${extra.join(", ")}`
      );
    }
  }
});

test("los cuatro campos academicos de grado 11 tienen los valores oficiales", () => {
  const ctx = loadContexts();
  for (const { rap, grado11 } of PARES) {
    for (const key of grado11) {
      const c = ctx[key];
      assert.equal(c.competencia, VALORES.competencia, `${key}: competencia incorrecta`);
      assert.equal(c.rap, VALORES[rap].rap, `${key}: RAP incorrecto`);
      assert.equal(c.fase, VALORES.fase, `${key}: fase incorrecta`);
      assert.equal(c.duracion, VALORES[rap].duracion, `${key}: duracion incorrecta`);
    }
  }
});

test("la competencia 220501121 no aparece en ninguna guia de Redes de grado 11", () => {
  // 220501121 es "Operar herramientas informaticas": no es la competencia de
  // Redes. Estaba mal puesta en los registros de Santa Barbara 10 (ver informe)
  // y no debe heredarse a las guias nuevas ni al encabezado de los Word.
  const declaraciones = read("js/guide_declarations.js");
  const re = /register\(\{[\s\S]*?\n {2}\}\);/g;
  let m;
  let revisados = 0;
  while ((m = re.exec(declaraciones))) {
    const bloque = m[0];
    if (!/"grupo-11[ab]-guia-\d+-redes-rap0[123]\.html"/.test(bloque)) continue;
    revisados += 1;
    assert.ok(
      !bloque.includes("220501121"),
      "un registro de Redes de grado 11 declara la competencia 220501121"
    );
    assert.ok(
      /competencia: "280102129 - Evaluar red/.test(bloque),
      "un registro de Redes de grado 11 no declara la competencia 280102129"
    );
    assert.ok(
      /resultado: "RAP 0[123] - /.test(bloque),
      "el RAP del registro debe ir con dos digitos (RAP 01/02/03)"
    );
  }
  assert.equal(revisados, 3, "deben existir 3 registros de Redes de grado 11");
});

test("el partial marca los cuatro campos para que el contexto los sustituya", () => {
  for (const { rap } of PARES) {
    const partial = read(`partials/guia-redes-rap${rap}-content.html`);
    for (const attr of ["data-ctx-competencia", "data-ctx-rap", "data-ctx-fase", "data-ctx-duracion"]) {
      assert.ok(partial.includes(attr), `guia-redes-rap${rap}-content.html: falta ${attr}`);
    }
  }
  assert.ok(
    read("js/guide_runtime_loader.js").includes("setContextAcademicFields"),
    "el loader debe sustituir los campos academicos del contexto"
  );
});

test("las seis paginas de grado 11 existen y apuntan a su contexto", () => {
  const ctx = loadContexts();
  for (const { grado11 } of PARES) {
    for (const key of grado11) {
      const pageFile = ctx[key].pageFile;
      const ruta = path.join(ROOT, "pages/guias", pageFile);
      assert.ok(fs.existsSync(ruta), `falta la pagina ${pageFile}`);
      const html = fs.readFileSync(ruta, "utf8");
      assert.ok(
        html.includes(`key: "${key}"`),
        `${pageFile}: no declara __GUIDE_CONTEXT__ con key ${key}`
      );
    }
  }
});
