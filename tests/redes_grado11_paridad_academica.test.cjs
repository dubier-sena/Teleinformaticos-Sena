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
//
// EMERGENCIA 2026-11-07 (orden del instructor): esta prueba IMPONIA que las Guias 10
// y 11 de grado 11 compartieran el partial de grado 10. Era incorrecto: los Word
// oficiales de grado 11 (GA_Comprobar_Conectividad y GA_Documentar_Acciones_Red)
// tienen actividades distintas (subneteo FLSM + 2 subredes en Packet Tracer; y
// seguridad inalambrica + protocolo de politica de seguridad). Ahora:
//  - RAP 01 (Guia 9) sigue compartiendo el partial de grado 10 (no fue parte de la
//    correccion y se mantiene la paridad).
//  - RAP 02 y RAP 03 (Guias 10 y 11) DEBEN usar su partial oficial de grado 11 y no
//    pueden mezclar ids, campos ni familia de calificacion con grado 10.
const PARES = [
  { rap: "01", base: "sb-redes-10a", grado11: ["sb11-redes-rap01-11a", "sb11-redes-rap01-11b"], guia: "9" },
  { rap: "02", base: "sb-redes-rap02-10a", grado11: ["sb11-redes-rap02-11a", "sb11-redes-rap02-11b"], guia: "10" },
  { rap: "03", base: "sb-redes-rap03-10a", grado11: ["sb11-redes-rap03-11a", "sb11-redes-rap03-11b"], guia: "11" },
];
const PROPIOS = {
  "02": { template: "guia-redes11-rap02", partial: "partials/guia-redes11-rap02-content.html", family: "guia-redes11-rap02", prefix: "g11c_" },
  "03": { template: "guia-redes11-rap03", partial: "partials/guia-redes11-rap03-content.html", family: "guia-redes11-rap03", prefix: "g11d_" },
};

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

function loadDeclarations() {
  const guides = [];
  const w = { ActivityStandard: { registerGuide: (c) => guides.push(c) } };
  new Function("window", "ActivityStandard", read("js/guide_declarations.js"))(w, w.ActivityStandard);
  const byFile = {};
  guides.forEach((g) => (g.files || []).forEach((f) => { byFile[f] = g; }));
  return byFile;
}

test("Guia 9 (RAP 01) de grado 11 sigue reutilizando EL MISMO partial que Santa Barbara 10", () => {
  const ctx = loadContexts();
  const { base, grado11 } = PARES[0];
  for (const key of grado11) assert.equal(ctx[key].partialPath, ctx[base].partialPath, key);
});

test("Guias 10 y 11 de grado 11 usan su partial OFICIAL propio, distinto del de grado 10", () => {
  const ctx = loadContexts();
  for (const { rap, base, grado11 } of PARES.slice(1)) {
    for (const key of grado11) {
      assert.equal(ctx[key].template, PROPIOS[rap].template, key);
      assert.equal(ctx[key].partialPath, PROPIOS[rap].partial, key);
      assert.notEqual(ctx[key].partialPath, ctx[base].partialPath, `${key}: no debe reutilizar el partial de grado 10`);
      assert.ok(fs.existsSync(path.join(ROOT, PROPIOS[rap].partial)));
    }
    // grado 10 conserva su partial (no se toco)
    assert.equal(ctx[base].partialPath, `partials/guia-redes-rap${rap}-content.html`);
  }
});

test("grado 11 (Guias 10/11) no comparte ids de actividad, campos ni familia con grado 10", () => {
  const decl = loadDeclarations();
  for (const rap of ["02", "03"]) {
    const g10 = decl[`santa-barbara-10a-guia-0${Number(rap) + 1}-redes-rap${rap}.html`];
    const g11 = decl[`grupo-11a-guia-1${rap === "02" ? "0" : "1"}-redes-rap${rap}.html`];
    assert.ok(g10 && g11, rap);
    assert.equal(g11.gradeFamily, PROPIOS[rap].family);
    assert.notEqual(g11.gradeFamily, g10.gradeFamily);
    const ids10 = new Set(g10.activities.map((a) => a.id));
    const campos10 = new Set(g10.activities.flatMap((a) => a.formFields || []));
    for (const a of g11.activities) {
      assert.ok(!ids10.has(a.id), `id ${a.id} reutiliza un id de grado 10`);
      for (const k of (a.formFields || []).concat(a.optionalFields || [])) {
        assert.ok(!campos10.has(k), `campo ${k} reutiliza un campo de grado 10`);
        assert.ok(k.startsWith(PROPIOS[rap].prefix), `campo ${k} sin prefijo de grado 11`);
      }
      const pk = a.driveTarget && a.driveTarget.panelKey;
      if (pk) assert.ok(/^g11redes-rap0[23]-/.test(pk), `panelKey ${pk} de grado 11`);
    }
    // 11A y 11B comparten declaracion pero el estado se separa por pageFile (y por ficha en Drive)
    assert.deepEqual(g11.files.slice().sort(), [`grupo-11a-guia-1${rap === "02" ? "0" : "1"}-redes-rap${rap}.html`, `grupo-11b-guia-1${rap === "02" ? "0" : "1"}-redes-rap${rap}.html`]);
  }
});

test("los partials de grado 11 no contienen contenido de las guias de grado 10", () => {
  const p02 = read(PROPIOS["02"].partial);
  const p03 = read(PROPIOS["03"].partial);
  for (const marca of ["Ferretería Don Misael", "g3r_", "presentacion332", "Quiz de conectividad"]) assert.ok(!p02.includes(marca), marca);
  for (const marca of ["consultorio", "g5r_", "TIA-606", "OccidenteServicios", "certificador"]) assert.ok(!p03.includes(marca), marca);
  // Contenido oficial
  for (const marca of ["192.168.20.0/24", "Taller de subneteo", "PC_Gerencia", "Lab_Subredes_Carmen", "MapaMental_Redes"]) assert.ok(p02.includes(marca), marca);
  for (const marca of ["Panadería Doña Rosa", "Evil Twin", "WPA3", "Plantilla 3", "Protocolo_SeguridadInalambrica", "Ley 1273 de 2009"]) assert.ok(p03.includes(marca), marca);
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

// ── Correccion academica de 10 Santa Barbara (2026-09-22) ─────────────────
// Las Guias 2 y 3 de Redes de 10 SB declaraban la competencia 220501121
// ("Operar herramientas informaticas"), que no es la de Redes. Ese texto no se
// veia en pantalla -- el partial ya mostraba la correcta -- pero SI viajaba en
// el encabezado de los Word que el aprendiz entrega como evidencia, que es
// donde importa. Esta guardia impide que vuelva a colarse en cualquier guia de
// Redes, de cualquier grado.
test("ninguna guia de Redes declara la competencia 220501121", () => {
  const src = read("js/guide_declarations.js");
  const malas = [];
  for (const m of src.matchAll(/register\(\{[\s\S]*?\n {2}\}\);/g)) {
    const bloque = m[0];
    const archivos = [...bloque.matchAll(/"([a-z0-9-]*guia-\d+-redes-rap0[123]\.html)"/g)].map((x) => x[1]);
    if (!archivos.length) continue;
    // Solo el valor declarado, no los comentarios que explican la correccion.
    const competencia = (bloque.match(/^\s*competencia:\s*"([^"]+)"/m) || [])[1] || "";
    if (competencia.startsWith("220501121")) malas.push(archivos[0]);
  }
  assert.deepEqual(malas, [], `guias de Redes con la competencia equivocada:\n  ${malas.join("\n  ")}`);
});

test("toda guia de Redes declara la competencia 280102129 y el RAP a dos digitos", () => {
  const src = read("js/guide_declarations.js");
  const constantes = Object.fromEntries(
    [...src.matchAll(/var (RAP_REDES[A-Z0-9_]*) = "([^"]+)"/g)].map((m) => [m[1], m[2]])
  );
  const problemas = [];
  for (const m of src.matchAll(/register\(\{[\s\S]*?\n {2}\}\);/g)) {
    const bloque = m[0];
    const archivos = [...bloque.matchAll(/"([a-z0-9-]*guia-\d+-redes-rap0[123]\.html)"/g)].map((x) => x[1]);
    if (!archivos.length) continue;
    const competencia = (bloque.match(/^\s*competencia:\s*"([^"]+)"/m) || [])[1] || "";
    if (!competencia.startsWith("280102129")) {
      problemas.push(`${archivos[0]}: competencia "${competencia.slice(0, 40)}"`);
    }
    const crudo = (bloque.match(/^\s*resultado:\s*([^,\n]+)/m) || [])[1] || "";
    const resultado = crudo.startsWith('"') ? crudo.slice(1, -1) : constantes[crudo.trim()] || crudo;
    // Sin excepciones: desde el 2026-09-22 las 18 declaraciones de Redes (Santa
    // Barbara 10, Kennedy 10 y grado 11) usan el RAP a dos digitos, igual que el
    // titulo de cada guia. La excepcion que aqui dejaba fuera a Kennedy 10 ya no
    // hace falta -- si vuelve a aparecer un "RAP 1", esta prueba lo detiene.
    if (!/^RAP 0[123] - /.test(resultado)) {
      problemas.push(`${archivos[0]}: resultado "${resultado.slice(0, 40)}"`);
    }
  }
  assert.deepEqual(problemas, [], `declaraciones de Redes incorrectas:\n  ${problemas.join("\n  ")}`);
});
