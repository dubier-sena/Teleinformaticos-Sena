const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const guideJs = fs.readFileSync(path.join(root, "js", "script_guia_redes.js"), "utf8");
const page10B = fs.readFileSync(
  path.join(root, "santa-barbara-10b-guia-02-redes-rap01.html"),
  "utf8"
);

function expectIncludes(snippet, message) {
  assert(guideJs.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

function expectNotIncludes(snippet, message) {
  assert(!guideJs.includes(snippet), `${message}\nNo esperado: ${snippet}`);
}

expectIncludes(
  "function readStateMetaRedes()",
  "La guia de redes debe leer la metadata local del estado."
);
expectIncludes(
  "function saveStateMetaRedes(meta)",
  "La guia de redes debe guardar la metadata local del estado."
);
expectIncludes(
  'document.addEventListener("input", (e) => {',
  "La guia de redes debe escuchar ediciones en todos los campos data-store."
);
expectIncludes(
  'const field = e.target.closest("[data-store]");',
  "La guia de redes debe usar el binding generico por data-store para cubrir todos los bloques editables."
);
expectIncludes(
  "saveStateMetaRedes({ updatedAt: new Date().toISOString() });",
  "Guardar el estado local debe actualizar la marca de tiempo para proteger lo escrito por el aprendiz."
);
expectIncludes(
  "scheduleCloudSyncRedes();",
  "Guardar el estado local debe programar el sync del borrador para toda la guia."
);
expectIncludes(
  "function localSnapshotTimeRedes()",
  "La guia de redes debe calcular el tiempo del snapshot local."
);
expectIncludes(
  "if (snapshotTimeRedes(refreshed) > localSnapshotTimeRedes()) {",
  "El refresco periodico solo debe aplicar datos remotos cuando sean mas nuevos que lo local."
);
expectIncludes(
  "saveStateMetaRedes({",
  "Al aplicar datos remotos debe persistirse la metadata del snapshot recibido."
);
expectNotIncludes(
  "state = { ...state, ...refreshed.data };",
  "La guia de redes no debe mezclar ciegamente datos remotos sobre el estado local durante el refresco."
);
assert(
  (page10B.match(/data-store="/g) || []).length >= 100,
  "La prueba debe ejecutarse sobre una guia con muchos campos editables para validar el bug a nivel general."
);

console.log("OK: la sincronizacion de redes protege las ediciones locales frente al refresh de Firebase.");
