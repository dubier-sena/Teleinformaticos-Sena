"use strict";

// Bloque G (auditoria 2026-08-27): getCloudFileName() ahora consulta primero
// ActivityStandard.getConfigForGuide(pageFile).cloudFileNames -- fuente unica
// para guias NUEVAS, colocada junto al resto del registro en
// guide_declarations.js -- antes de caer a la tabla CLOUD_FILE_ALIASES
// hardcodeada (que sigue viva para las guias ya existentes, sin migrarlas).
// Esto evita que una tercera guia futura repita el bug real de Guia 5 doc /
// Guia 8 (faltaban en esa tabla y el pull de habilitacion no traia nada).
//
// Carga js/admin_habilitacion.js en un sandbox vm real (no regex/eval de
// literal) para probar el COMPORTAMIENTO de la funcion, no solo su forma.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadAdminHabilitacion(activityStandardMock) {
  const code = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_habilitacion.js"),
    "utf8"
  );
  const windowObj = { ActivityStandard: activityStandardMock };
  const sandbox = {
    window: windowObj,
    localStorage: {
      getItem() { return null; },
      setItem() {},
    },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.adminHabilitacion;
}

test("getCloudFileName prefiere ActivityStandard.getConfigForGuide(file).cloudFileNames cuando existe", () => {
  const hab = loadAdminHabilitacion({
    getConfigForGuide(fileName) {
      if (fileName === "grupo-99a-guia-99-futura.html") {
        return { cloudFileNames: { "grupo-99a-guia-99-futura.html": "99a_guia99.html" } };
      }
      return null;
    },
  });
  assert.strictEqual(hab.getCloudFileName("grupo-99a-guia-99-futura.html"), "99a_guia99.html");
});

test("getCloudFileName cae a CLOUD_FILE_ALIASES cuando ActivityStandard no tiene cloudFileNames para ese archivo", () => {
  const hab = loadAdminHabilitacion({ getConfigForGuide: () => null });
  // Entrada real y ya existente en la tabla hardcodeada (sin tocar).
  assert.strictEqual(
    hab.getCloudFileName("santa-barbara-10a-guia-02-redes-rap01.html"),
    "sb_10a_redes.html"
  );
});

test("getCloudFileName sin ActivityStandard cargado (undefined) no revienta y usa la tabla hardcodeada", () => {
  const hab = loadAdminHabilitacion(undefined);
  assert.strictEqual(
    hab.getCloudFileName("grupo-10a-guia-05-documentar-gestion-informacion.html"),
    "10a_guia5doc.html"
  );
});

test("getCloudFileName con pageFile totalmente desconocido devuelve el nombre crudo (comportamiento previo intacto)", () => {
  const hab = loadAdminHabilitacion({ getConfigForGuide: () => null });
  assert.strictEqual(hab.getCloudFileName("archivo-que-no-existe.html"), "archivo-que-no-existe.html");
});
