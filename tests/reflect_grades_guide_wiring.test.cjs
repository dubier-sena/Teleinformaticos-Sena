const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// Cada guia ya tenia su propio "mountAvancePanelX" (IIFE) que llama
// ActivityStandard.renderAvancePanel con getGuideDataFile devolviendo la
// variable CORRECTA (el nombre de archivo crudo, tal como lo registra
// guide_declarations.js -- NO el alias de almacenamiento). reflectGradesForX
// (agregado despues, para reflejar la nota en el mismo `state`) DEBE usar esa
// MISMA variable. Si no coinciden, ActivityStandard.getConfigForGuide no
// encuentra la guia y el panel de avance se rompe -- exactamente el bug real
// que paso en Induccion (uso GUIDE_DATA_FILE en vez de PAGE_FILE).
function extractGetGuideDataFileVar(source, mountFnNamePattern) {
  const mountMatch = source.match(mountFnNamePattern);
  assert.ok(mountMatch, `no se encontro el bloque mountAvancePanelX que coincida con ${mountFnNamePattern}`);
  const varMatch = mountMatch[0].match(/getGuideDataFile:\s*function\s*\(\)\s*\{\s*return\s+(\w+);/);
  assert.ok(varMatch, "no se encontro getGuideDataFile dentro del bloque mountAvancePanelX");
  return varMatch[1];
}

function extractReflectFnBlock(source, reflectFnName) {
  const re = new RegExp(`function ${reflectFnName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`);
  const match = source.match(re);
  assert.ok(match, `no se encontro la funcion ${reflectFnName}`);
  return match[0];
}

const CASES = [
  {
    file: "js/script_guia2.js",
    mountFnPattern: /\(function mountAvancePanelGuia2\(\)[\s\S]*?\}\)\(\);/,
    reflectFnName: "reflectGradesForGuia2",
    expectedFamily: "guia-02-herramientas",
    expectedLockAppliers: ["applyExtensionesLock", "applySistemasLock", "applyColaborativasLock", "applyTransferRetoLock"],
  },
  {
    file: "js/script_guia3.js",
    mountFnPattern: /\(function mountAvancePanelGuia3\(\)[\s\S]*?\}\)\(\);/,
    reflectFnName: "reflectGradesForGuia3",
    expectedFamily: "guia-03-planificar-10",
    expectedLockAppliers: ["applyBitacoraLock", "applyBitacoraSocializacionLock", "applyTabla321Lock", "applyMapa322Lock", "applyChecklist331Lock"],
  },
  {
    file: "js/script_guia6.js",
    mountFnPattern: /\(function mountAvancePanelGuia6\(\)[\s\S]*?\}\)\(\);/,
    reflectFnName: "reflectGradesForGuia6",
    expectedFamily: "guia-06-planificar",
    expectedLockAppliers: ["applyBitacoraLock", "applyBitacoraSocializacionLock"],
  },
  {
    file: "js/script_guia_redes.js",
    mountFnPattern: /\(function mountAvancePanelGuiaRedes\(\)[\s\S]*?\}\)\(\);/,
    reflectFnName: "reflectGradesForGuiaRedes",
    expectedFamily: "guia-redes-rap01",
    expectedLockAppliers: [
      "applyBloqueIP1Lock", "applyBloqueIP3Lock",
      "applyTallerIPEj1Lock", "applyTallerIPEj2Lock", "applyTallerIPEj3Lock", "applyTallerIPEj4Lock", "applyTallerIPEj5Lock",
      "applyLab1Lock", "applyLab2Lock", "applyLab3Lock", "applySocialLock",
    ],
  },
  {
    // Guia 5 nunca tuvo reflectGradesForGuiaX (a diferencia de 2/3/6/redes):
    // calificar una actividad vacia desde el admin no marcaba "-locked", asi
    // que "Tu control de avance" seguia contando Pendiente. Fix 2026-07-24.
    file: "js/script.js",
    mountFnPattern: /\(function mountAvancePanelGuia5\(\)[\s\S]*?\}\)\(\);/,
    reflectFnName: "reflectGradesForGuia5",
    expectedFamily: "guia-05-herramientas",
    expectedLockAppliers: [],
  },
];

CASES.forEach((testCase) => {
  test(`${testCase.reflectFnName}: usa la MISMA variable getGuideDataFile que mountAvancePanel (${testCase.file})`, () => {
    const source = read(testCase.file);

    const mountVar = extractGetGuideDataFileVar(source, testCase.mountFnPattern);
    const reflectBlock = extractReflectFnBlock(source, testCase.reflectFnName);

    // La funcion reflect debe pasar pageFile: <mountVar> a reflectGradesIntoGuideState.
    assert.match(
      reflectBlock,
      new RegExp(`pageFile:\\s*${mountVar}\\b`),
      `${testCase.reflectFnName} debe usar "pageFile: ${mountVar}" (la misma variable que mountAvancePanel), no otra`
    );

    // Y si reflectBlock ADEMAS vuelve a llamar renderAvancePanel directamente
    // (para refrescar la tabla tras calificar), esa llamada TAMBIEN debe usar
    // la misma variable.
    const innerGetGuideDataFile = reflectBlock.match(/getGuideDataFile:\s*function\s*\(\)\s*\{\s*return\s+(\w+);/);
    if (innerGetGuideDataFile) {
      assert.equal(
        innerGetGuideDataFile[1],
        mountVar,
        `${testCase.reflectFnName} refresca renderAvancePanel con una variable distinta a la de mountAvancePanel`
      );
    }

    assert.equal(reflectBlock.includes(`guideFamily: "${testCase.expectedFamily}"`), true,
      `${testCase.reflectFnName} debe usar guideFamily "${testCase.expectedFamily}"`);
  });

  test(`${testCase.reflectFnName}: cada lockApplier referenciado existe como funcion real en ${testCase.file}`, () => {
    const source = read(testCase.file);
    testCase.expectedLockAppliers.forEach((fnName) => {
      assert.match(
        source,
        new RegExp(`function ${fnName}\\s*\\(`),
        `${fnName} deberia estar definida en ${testCase.file} (referenciada desde ${testCase.reflectFnName})`
      );
      const reflectBlock = extractReflectFnBlock(source, testCase.reflectFnName);
      assert.ok(
        reflectBlock.includes(fnName),
        `${testCase.reflectFnName} deberia referenciar ${fnName} en su mapa de lockAppliers`
      );
    });
  });
});

test("induccion: bridgeInduccionStateSync usa PAGE_FILE (no GUIDE_DATA_FILE) en refreshAvancePanel", () => {
  const source = read("partials/guia-01-induccion-content.html");
  const refreshBlock = source.match(/function refreshAvancePanel\s*\(\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(refreshBlock, "no se encontro refreshAvancePanel en el partial de induccion");
  assert.match(
    refreshBlock[0],
    /getGuideDataFile:\s*function\s*\(\)\s*\{\s*return\s+PAGE_FILE;/,
    "refreshAvancePanel debe usar PAGE_FILE (el nombre crudo registrado en guide_declarations.js), no GUIDE_DATA_FILE (el alias de almacenamiento)"
  );
});

test("induccion: updateProgress/saveProgress excluyen el boton generico .activity-check (sin id) que inyecta guia_template.js", () => {
  const source = read("partials/guia-01-induccion-content.html");
  const updateProgressBlock = source.match(/function updateProgress\s*\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(updateProgressBlock, "no se encontro updateProgress en el partial de induccion");
  assert.match(
    updateProgressBlock[0],
    /\.activity-check\[id\^="chk-"\]/,
    "updateProgress debe filtrar por [id^=\"chk-\"] -- guia_template.js inyecta su PROPIO boton .activity-check (sin id) en cualquier .activity-header sin uno, y ese boton nunca se marca (queda contando de mas en el total, atascando el % por debajo de 100)"
  );

  const saveProgressBlock = source.match(/function saveProgress\s*\(\)\s*\{[\s\S]*?\n\}/);
  assert.ok(saveProgressBlock, "no se encontro saveProgress en el partial de induccion");
  assert.match(
    saveProgressBlock[0],
    /\.activity-check\[id\^="chk-"\]/,
    "saveProgress tambien debe filtrar por [id^=\"chk-\"] para no guardar una entrada con llave vacia"
  );
});

// Mismo bug que Induccion (arriba), encontrado 2026-07-25 calificando Guia 5 y
// Guia 6 para QA: el aprendiz de pruebas tenia el 100% de los campos reales
// completos y las 4/8 actividades aprobadas, pero el "Progreso" del sidebar se
// quedaba en 95%/46% porque .activity-check (el boton generico "marcar como
// vista" que inyecta guia_template.js, SIN id) seguia contando en el total sin
// que nada lo marque nunca. Las guias mas nuevas (7, 8) ya no lo cuentan.
[
  { file: "js/script.js", label: "Guia 5" },
  { file: "js/script_guia6.js", label: "Guia 6" },
].forEach(({ file, label }) => {
  test(`${label} (${file}): updateProgress no cuenta el boton generico .activity-check`, () => {
    const source = read(file);
    const updateProgressBlock = source.match(/function updateProgress\s*\(\)\s*\{[\s\S]*?\n\}/);
    assert.ok(updateProgressBlock, `no se encontro updateProgress en ${file}`);
    assert.doesNotMatch(
      updateProgressBlock[0],
      /activityChecks\.length/,
      `${file}: updateProgress no debe sumar activityChecks.length al total (bloquea el 100% aunque todo este respondido/aprobado)`
    );
  });
});

// Guia 7 y Guia 8 usan SOLO ActivityStandard.mountActivities() (sin lockAppliers
// propios como Guia 6) -- mountFormActivity() ya escucha "activity-deadlines-updated"
// para reaplicar applyLock() por su cuenta, asi que su reflectGradesForGuiaN NO
// necesita lockAppliers: basta con que exista, se llame desde el init, use la
// familia correcta y dispare ese evento en onChanged. Sin esto, el admin podia
// calificar con el banco de respuestas y el campo seguia editable para el
// aprendiz aunque la actividad apareciera "Aprobada" (reportado por el usuario
// 2026-07-25 en Guia 7; mismo hueco confirmado en Guia 8 y en "equipoTaller"
// del Taller Integrador, su unica actividad type:"form").
[
  { file: "js/script_guia7.js", reflectFnName: "reflectGradesForGuia7", initFnName: "initGuia7", expectedFamily: "guia-07-ciberseguridad" },
  { file: "js/script_guia8.js", reflectFnName: "reflectGradesForGuia8", initFnName: "initGuia8", expectedFamily: "guia-08-documentar-gestion" },
].forEach(({ file, reflectFnName, initFnName, expectedFamily }) => {
  test(`${reflectFnName} (${file}): existe, se llama desde ${initFnName}, usa la familia correcta y refresca el bloqueo via evento`, () => {
    const source = read(file);
    const initBlock = source.match(new RegExp(`function ${initFnName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n  \\}`));
    assert.ok(initBlock, `no se encontro ${initFnName} en ${file}`);
    assert.match(
      initBlock[0],
      new RegExp(`${reflectFnName}\\(\\)`),
      `${initFnName} debe llamar ${reflectFnName}() (si no, el campo nunca se bloquea al calificar sin que el aprendiz haya guardado el mismo)`
    );

    const reflectBlock = extractReflectFnBlock(source, reflectFnName);
    assert.match(
      reflectBlock,
      /reflectGradesIntoGuideState/,
      `${reflectFnName} debe llamar activityGradesManager.reflectGradesIntoGuideState`
    );
    assert.ok(
      reflectBlock.includes(`guideFamily: "${expectedFamily}"`),
      `${reflectFnName} debe usar guideFamily "${expectedFamily}"`
    );
    assert.match(
      reflectBlock,
      /dispatchEvent\(new Event\("activity-deadlines-updated"\)\)/,
      `${reflectFnName} debe disparar "activity-deadlines-updated" en onChanged para que mountFormActivity() reaplique el bloqueo sin recargar la pagina`
    );
  });
});

test('reflectGradesForTaller (js/script_taller_integrador.js): existe, se llama desde initTallerIntegrador y resuelve la familia por PAGE_FILE', () => {
  const source = read("js/script_taller_integrador.js");
  const initBlock = source.match(/function initTallerIntegrador\s*\([^)]*\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(initBlock, "no se encontro initTallerIntegrador");
  assert.match(
    initBlock[0],
    /reflectGradesForTaller\(\)/,
    "initTallerIntegrador debe llamar reflectGradesForTaller() (si no, 'equipoTaller' -- el unico producto type:\"form\" del taller -- nunca se bloquea al calificarlo sin que el aprendiz lo haya guardado el mismo)"
  );

  const reflectBlock = extractReflectFnBlock(source, "reflectGradesForTaller");
  assert.match(reflectBlock, /reflectGradesIntoGuideState/);
  assert.match(
    reflectBlock,
    /GUIDE_FAMILY_BY_FILE/,
    "reflectGradesForTaller debe resolver la familia via GUIDE_FAMILY_BY_FILE[PAGE_FILE] (el script sirve 3 variantes: JFK/SB grado 10, SB grado 11)"
  );
  assert.match(
    reflectBlock,
    /dispatchEvent\(new Event\("activity-deadlines-updated"\)\)/,
    "reflectGradesForTaller debe disparar 'activity-deadlines-updated' en onChanged"
  );
});
