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
