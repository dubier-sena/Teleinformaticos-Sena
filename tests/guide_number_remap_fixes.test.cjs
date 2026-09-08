// Cierre Bugs 2/3/4 (auditoria E2E Guias 10/11/12 Kennedy, 2026-09-08).
//
// Causa comun: partials/guia-redes-rap0N-content.html y
// sources/generated/redes-*-quiz.template.html son 100% compartidos entre
// Santa Barbara (numeracion nativa 2/3/4) y John F. Kennedy (adaptadas como
// 10/11/12 via context.guideNumberMap). Tres huecos distintos en ese
// mecanismo de adaptacion:
//   Bug 2: remapGuideNumberReferences() (script_guia_redes*.js) corre
//     DESPUES de que guia_template.js ya renderizo el widget "Guia asignada"
//     con los numeros REALES de cada guia de la ficha -- sin exclusion,
//     reescribia tambien esas entradas no relacionadas (ej. la Guia 2/3/4
//     real), duplicando/mal-rotulando numeros.
//   Bug 3: guia-redes-rap02/03-content.html (Guias 11/12) nunca tuvieron el
//     placeholder .nav-guide[data-current-file] que renderAssignedGuides()
//     necesita para saber DONDE inyectar el widget -- sin el, la funcion
//     retorna temprano y el widget completo no aparece.
//   Bug 4: dos metadatos "Guia 2" quedaron fuera del mecanismo de remap
//     existente: el kicker de los quiz generados (hardcodeado en el
//     template, no un {{token}}) y REDES_WORD_METADATA.guideName (constante
//     estatica que alimenta la exportacion a Word).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Extrae el cuerpo completo de una funcion por conteo de llaves (no por el
// primer "}" que aparezca, que cortaria en la primera funcion anidada).
function extractFunctionSource(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const braceStart = src.indexOf("{", start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

// ── Bug 2: exclusion del widget "Guia asignada" en el remap generico ───────
test("guia_template.js marca el widget 'Guia asignada' para excluirlo del remap de numeros", () => {
  const src = read("js/guia_template.js");
  assert.match(
    src,
    /guideSection\.setAttribute\("data-no-guide-remap",\s*"true"\)/,
    "renderAssignedGuides debe marcar su seccion con data-no-guide-remap ANTES de que remapGuideNumberReferences pueda tocarla"
  );
});

["js/script_guia_redes.js", "js/script_guia_redes_rap02.js", "js/script_guia_redes_rap03.js"].forEach((file) => {
  test(`${file}: remapGuideNumberReferences respeta data-no-guide-remap (no toca texto ni title dentro de el)`, () => {
    const src = read(file);
    const fn = extractFunctionSource(src, "function remapGuideNumberReferences(root)");
    assert.ok(fn, "no se encontro el cuerpo de remapGuideNumberReferences");
    assert.match(
      fn,
      /n\.parentElement\s*&&\s*n\.parentElement\.closest\("\[data-no-guide-remap\]"\)/,
      `${file}: el recorrido de nodos de texto debe saltar los que esten dentro de [data-no-guide-remap]`
    );
    assert.match(
      fn,
      /el\.closest\("\[data-no-guide-remap\]"\)/,
      `${file}: el recorrido de atributos [title] debe saltar los que esten dentro de [data-no-guide-remap]`
    );
  });
});

// ── Bug 3: placeholder de "Guia asignada" presente en Guias 11 y 12 ────────
["partials/guia-redes-rap01-content.html", "partials/guia-redes-rap02-content.html", "partials/guia-redes-rap03-content.html"].forEach(
  (file) => {
    test(`${file}: contiene el placeholder .nav-guide[data-current-file] que renderAssignedGuides() necesita`, () => {
      const html = read(file);
      // Debe existir un <a class="nav-guide...") con data-current-file, para
      // que document.querySelector(".nav-guide[data-current-file]") lo
      // encuentre dentro de ALGUN .nav-section real del archivo.
      assert.match(
        html,
        /<a class="nav-guide[^"]*"[^>]*data-current-file="[^"]+"/,
        `${file}: falta el <a class="nav-guide" data-current-file="..."> -- sin el, el widget "Guia asignada" nunca se renderiza`
      );
    });
  }
);

// ── Bug 4a: kicker de los quiz generados usa el numero real, no "Guia 2" fijo ──
test("las plantillas de quiz de redes generadas usan {{QUIZ_GUIDE_LABEL}}, no 'Guia 2' hardcodeado", () => {
  ["sources/generated/redes-rap01-quiz.template.html", "sources/generated/redes-ip-quiz.template.html"].forEach((file) => {
    const html = read(file);
    assert.match(html, /redes-quiz-kicker">\{\{QUIZ_GUIDE_LABEL\}\}/, `${file}: el kicker debe usar el token, no un numero fijo`);
    assert.doesNotMatch(html, /redes-quiz-kicker">Guia \d/, `${file}: no debe quedar un numero de guia hardcodeado en el kicker`);
  });
});

test("generated_page_variants.json: guideLabel correcto por institucion (Kennedy 10, Santa Barbara 2)", () => {
  const variants = JSON.parse(read("data/generated_page_variants.json"));
  ["redes-rap01-quiz-jfk10a", "redes-rap01-quiz-jfk10b", "redes-ip-quiz-jfk10a", "redes-ip-quiz-jfk10b"].forEach((key) => {
    assert.equal(variants[key].guideLabel, "Guia 10", `${key} deberia mapear a Guia 10 (Kennedy)`);
  });
  ["redes-rap01-quiz-10a", "redes-rap01-quiz-10b", "redes-ip-quiz-10a", "redes-ip-quiz-10b"].forEach((key) => {
    assert.equal(variants[key].guideLabel, "Guia 2", `${key} deberia mapear a Guia 2 (Santa Barbara, numeracion nativa)`);
  });
});

test("paginas de quiz de Guia 10 (Kennedy) ya generadas muestran 'Guia 10' en el kicker, no 'Guia 2'", () => {
  [
    "pages/auxiliares/grupo-10a-guia-10-redes-rap01-quiz.html",
    "pages/auxiliares/grupo-10b-guia-10-redes-rap01-quiz.html",
    "pages/auxiliares/grupo-10a-guia-10-redes-ip-quiz.html",
    "pages/auxiliares/grupo-10b-guia-10-redes-ip-quiz.html",
  ].forEach((file) => {
    const html = read(file);
    assert.match(html, /redes-quiz-kicker">Guia 10 &middot;/, `${file}: debe mostrar Guia 10`);
    assert.doesNotMatch(html, /redes-quiz-kicker">Guia 2 &middot;/, `${file}: no debe seguir mostrando Guia 2`);
  });
});

// ── Bug 4b: REDES_WORD_METADATA.guideName se recalcula segun guideNumberMap ──
// Comportamiento real, no solo texto: se extrae el cuerpo exacto de
// updateCurrentGuideLabel() + su estado asociado desde el archivo fuente
// real (nunca copiado a mano) y se ejecuta en una VM con un contexto de
// guia simulado, igual que lo haria script_guia_redes.js en produccion.
function loadGuideLabelLogicForTest() {
  const src = read("js/script_guia_redes.js");
  const metadataSrc = (() => {
    const start = src.indexOf("const REDES_WORD_METADATA = {");
    const end = src.indexOf("\n};", start);
    return start === -1 || end === -1 ? null : src.slice(start, end + 3);
  })();
  const labelMatch = src.match(/let CURRENT_GUIDE_LABEL = "Guia 2";/);
  const fnSrc = extractFunctionSource(src, "function updateCurrentGuideLabel()");
  assert.ok(metadataSrc && labelMatch && fnSrc, "no se pudo extraer REDES_WORD_METADATA/CURRENT_GUIDE_LABEL/updateCurrentGuideLabel del archivo real");

  // let/const de nivel superior no quedan como propiedades del objeto de
  // contexto de vm (a diferencia de function/var) -- se agrega un accesor
  // (si mismo una function, si expuesto) para leer su valor real tras
  // llamar updateCurrentGuideLabel(), sin copiar/reescribir la logica real.
  const snippet = `${metadataSrc}\n${labelMatch[0]}\n${fnSrc}\nfunction __readGuideLabelState() { return { CURRENT_GUIDE_LABEL: CURRENT_GUIDE_LABEL, REDES_WORD_METADATA: REDES_WORD_METADATA }; }\n`;
  const window = { __GUIDE_RUNTIME_CONTEXT__: null };
  const context = vm.createContext({ window });
  vm.runInContext(snippet, context, { filename: "script_guia_redes.js (extracto)" });
  return context;
}

test("updateCurrentGuideLabel(): sin contexto mapeado, conserva el valor nativo (Santa Barbara)", () => {
  const ctx = loadGuideLabelLogicForTest();
  ctx.updateCurrentGuideLabel();
  const state = ctx.__readGuideLabelState();
  assert.equal(state.CURRENT_GUIDE_LABEL, "Guia 2");
  assert.equal(state.REDES_WORD_METADATA.guideName, "Guia 2 - Redes RAP01");
});

test("updateCurrentGuideLabel(): con guideNumberMap de Kennedy, actualiza CURRENT_GUIDE_LABEL y el Word export", () => {
  const ctx = loadGuideLabelLogicForTest();
  ctx.window.__GUIDE_RUNTIME_CONTEXT__ = { guideNumberMap: { "2": "10", "3": "11", "4": "12" } };
  ctx.updateCurrentGuideLabel();
  const state = ctx.__readGuideLabelState();
  assert.equal(state.CURRENT_GUIDE_LABEL, "Guia 10");
  assert.equal(
    state.REDES_WORD_METADATA.guideName,
    "Guia 10 - Redes RAP01",
    "el documento Word exportado debe reflejar el numero real de la guia (antes quedaba fijo en 'Guia 2 - Redes RAP01')"
  );
});
