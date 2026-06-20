const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, "js", file), "utf8");
}

// Invariante: toda guia que muestra una barra de avance DEBE sincronizar ese
// avance a la nube via writeGuideProgress. Si no lo hace, el panel admin no
// encuentra el progreso del aprendiz (que suele guardar desde otro equipo) y
// cae a un derive heuristico que calcula un % incorrecto. Ver
// firebase_db.js fetchStudentsWithProgress + deriveProgressFromGuideDataDoc.

// El identificador pasado a writeGuideProgress debe ser el page-file (el nombre
// que FICHA_MAP lista), NO el alias de guide_state: el admin indexa el progreso
// por fileNameToKey(nombre-de-FICHA_MAP).
const GUIDES_THAT_SYNC = [
  { file: "script.js", pageVar: "PAGE_FILE" },
  { file: "script_guia2.js", pageVar: "PAGE_FILE" },
  { file: "script_guia3.js", pageVar: "PAGE_FILE" },
  { file: "script_guia6.js", pageVar: "PAGE_FILE" },
  { file: "script_guia7.js", pageVar: "PAGE_FILE" },
  { file: "script_guia_redes.js", pageVar: "PAGE_FILE_REDES" },
  { file: "script_guia_redes_rap02.js", pageVar: "PAGE_FILE" },
  { file: "script_guia_python.js", pageVar: "PAGE_FILE" },
];

for (const guide of GUIDES_THAT_SYNC) {
  test(`${guide.file} sincroniza el avance a la nube (writeGuideProgress)`, () => {
    const source = read(guide.file);
    assert.match(
      source,
      /writeGuideProgress\?\.\(/,
      `${guide.file} debe llamar writeGuideProgress para que el admin vea el %`
    );
    // El page-file correcto (no el alias) para que el admin lo encuentre.
    const pattern = new RegExp(
      "writeGuideProgress\\?\\.\\(\\s*" + guide.pageVar + "\\s*,"
    );
    assert.match(
      source,
      pattern,
      `${guide.file} debe pasar ${guide.pageVar} (page-file de FICHA_MAP) a writeGuideProgress`
    );
  });
}
