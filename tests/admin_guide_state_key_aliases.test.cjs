const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// getGuideStateKey (js/admin_usuarios.js) resuelve con que clave de localStorage
// se lee/escribe la copia local del estado de una guia en el panel admin
// (Respuestas, hidratacion desde la nube, habilitacion). Para las guias legacy
// que NO guardan bajo el stateKey registrado en guide_declarations.js
// (Induccion, Redes RAP01), la clave REAL vive en un mapa `aliases` hardcodeado
// -- y solo se aplica si el valor empieza con "guia_" (asi distingue una clave
// completa de un simple alias de nombre de archivo).
//
// Regresion real (jul-15): los alias de Redes RAP01 eran "sb_10a_redes.html" /
// "sb_10b_redes.html" (nombres de archivo, no claves), asi que el filtro
// /^guia_/ nunca los dejaba pasar y la funcion caia al stateKey declarado
// ("guia_interactiva_santa_barbara_10a_guia_02_redes_rap01_html" -- ni es la
// clave real NI distingue 10A de 10B). El panel admin leia/escribia la copia
// local de Redes RAP01 en una clave que la guia del aprendiz jamas usa.
function extractGetGuideStateKeyAliases() {
  const script = read(path.join("js", "admin_usuarios.js"));
  const fnMatch = script.match(/function getGuideStateKey\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, "no se encontro la funcion getGuideStateKey en admin_usuarios.js");
  const aliasesMatch = fnMatch[0].match(/const aliases = \{[\s\S]*?\n    \};/);
  assert.ok(aliasesMatch, "no se encontro el mapa `aliases` dentro de getGuideStateKey");
  const objectSource = aliasesMatch[0].replace(/^const aliases = /, "").replace(/;$/, "");
  return new Function("return (" + objectSource + ");")();
}

function extractPortalHomeRealStateKeyAliases() {
  const script = read(path.join("js", "portal_home.js"));
  const aliasesMatch = script.match(/var REAL_STATE_KEY_ALIASES = \{[\s\S]*?\n  \};/);
  assert.ok(aliasesMatch, "no se encontro REAL_STATE_KEY_ALIASES en portal_home.js");
  const objectSource = aliasesMatch[0].replace(/^var REAL_STATE_KEY_ALIASES = /, "").replace(/;$/, "");
  return new Function("return (" + objectSource + ");")();
}

function extractRedesStorageFileAliases() {
  const script = read(path.join("js", "script_guia_redes.js"));
  const aliasesMatch = script.match(/const STORAGE_FILE_ALIASES_REDES = \{[\s\S]*?\n\};/);
  assert.ok(aliasesMatch, "no se encontro STORAGE_FILE_ALIASES_REDES en script_guia_redes.js");
  const objectSource = aliasesMatch[0].replace(/^const STORAGE_FILE_ALIASES_REDES = /, "").replace(/;$/, "");
  return new Function("return (" + objectSource + ");")();
}

test("todos los alias de getGuideStateKey son claves completas (pasan el filtro /^guia_/ que la propia funcion exige)", () => {
  const aliases = extractGetGuideStateKeyAliases();
  const entries = Object.entries(aliases);
  assert.ok(entries.length >= 4, "el mapa de alias deberia cubrir al menos Induccion 10A/10B y Redes RAP01 10A/10B");
  for (const [file, key] of entries) {
    assert.match(
      key,
      /^guia_/,
      `alias de "${file}" es "${key}": no empieza con "guia_", asi que el filtro de prioridad ` +
        "de getGuideStateKey lo ignora y el alias queda muerto (bug jul-15 de Redes RAP01)"
    );
  }
});

test("los alias del panel admin y los del home del aprendiz apuntan a las MISMAS claves reales", () => {
  const adminAliases = extractGetGuideStateKeyAliases();
  const homeAliases = extractPortalHomeRealStateKeyAliases();
  // portal_home.js duplico el mapa a proposito (no comparten carga de scripts);
  // este cruce es lo que impide que vuelvan a divergir en silencio.
  assert.deepEqual(adminAliases, homeAliases);
});

test("los alias de Redes RAP01 derivan de la clave real que construye script_guia_redes.js", () => {
  const adminAliases = extractGetGuideStateKeyAliases();
  const redesFileAliases = extractRedesStorageFileAliases();
  const entries = Object.entries(redesFileAliases);
  assert.ok(entries.length === 2, "STORAGE_FILE_ALIASES_REDES deberia tener las 2 paginas de Redes RAP01");
  for (const [pageFile, storageFile] of entries) {
    // Misma derivacion que script_guia_redes.js: PAGE_KEY_REDES + prefijo legacy.
    const expected = "guia_interactiva_" + storageFile.replace(/[^a-z0-9]+/g, "_");
    assert.equal(
      adminAliases[pageFile],
      expected,
      `el alias del admin para "${pageFile}" debe ser la clave real de la guia ("${expected}")`
    );
  }
});
