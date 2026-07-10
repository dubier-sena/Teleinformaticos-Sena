const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// El panel admin (js/admin_usuarios.js, keyMatchesActivity) reconoce las
// respuestas "dinamicas" de una actividad por el PREFIJO de su data-store,
// via un mapa `aliases` hardcodeado. Si una actividad guarda campos bajo un
// prefijo que no esta en ese mapa, el admin ve "Sin respuesta" en TODOS esos
// campos aunque el aprendiz si los haya guardado -- exactamente lo que le
// paso a "checklist:" (Lista de verificacion de competencias digitales,
// colaborativas334) y a las 4 sub-secciones de Ciberseguridad (3.3.5), que no
// tenian NINGUN alias registrado. Este test extrae el mapa `aliases` real del
// archivo y lo cruza contra los prefijos reales que usan las guias, para que
// esta clase de bug no se repita en silencio.
function extractAliasesMap() {
  const script = read(path.join("js", "admin_usuarios.js"));
  // OJO: hay OTRO `const aliases = {...}` no relacionado (getGuideStateKey,
  // pageFile -> storage key) mas arriba en el archivo. Hay que anclar la
  // busqueda a la funcion keyMatchesActivity para no extraer el equivocado.
  const fnMatch = script.match(/function keyMatchesActivity\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "no se encontro la funcion keyMatchesActivity en admin_usuarios.js");
  const aliasesMatch = fnMatch[0].match(/const aliases = \{[\s\S]*?\n    \};/);
  assert.ok(aliasesMatch, "no se encontro el mapa `aliases` dentro de keyMatchesActivity");
  // Es un objeto literal estatico (solo strings/arrays) -- seguro de evaluar
  // de forma aislada, sin tocar nada del resto del archivo.
  const objectSource = aliasesMatch[0].replace(/^const aliases = /, "").replace(/;$/, "");
  return new Function("return (" + objectSource + ");")();
}

test("colaborativas334 (Guia 2, Actividad 8) reconoce tanto la tabla comparativa como el checklist de 15 items", () => {
  const aliases = extractAliasesMap();
  const prefixes = aliases.colaborativas334 || [];
  assert.ok(prefixes.includes("collab:"), "debe seguir reconociendo la tabla comparativa (collab:)");
  assert.ok(
    prefixes.includes("checklist:"),
    "debe reconocer los 15 items de la Lista de verificacion de competencias digitales (checklist:)"
  );

  // El prefijo debe coincidir con el que usa REALMENTE la guia (evita que el
  // alias quede huerfano si algun dia cambia el prefijo en script_guia2.js).
  const guiaScript = read(path.join("js", "script_guia2.js"));
  assert.match(guiaScript, /`checklist:\$\{item\.id\}`/, "script_guia2.js debe seguir usando el prefijo checklist:");
});

test("las 4 sub-secciones de Ciberseguridad (Actividad 9, 3.3.5) tienen su alias de respuestas", () => {
  const aliases = extractAliasesMap();
  const expected = {
    cibersegAmenazas335: "ciberseg:amenazas:",
    cibersegGuia335: "ciberseg:guia:",
    cibersegPhishing335: "ciberseg:phishing:",
    cibersegChecklist335: "ciberseg:checklist:",
  };

  const guiaContent = read(path.join("partials", "guia-02-herramientas-content.html"));
  const guiaScript = read(path.join("js", "script_guia2.js"));

  Object.keys(expected).forEach((activityId) => {
    const prefix = expected[activityId];
    const registered = aliases[activityId] || [];
    assert.ok(
      registered.includes(prefix),
      `admin_usuarios.js debe reconocer "${prefix}" para la actividad "${activityId}"`
    );
    // El prefijo debe existir de verdad en el HTML o en el JS de la guia.
    const existsInGuide =
      guiaContent.includes(`data-store="${prefix}`) || guiaScript.includes(prefix);
    assert.ok(existsInGuide, `el prefijo "${prefix}" ya no aparece en la guia -- el alias quedo huerfano`);
  });
});
