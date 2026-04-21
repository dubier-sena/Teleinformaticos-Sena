const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const adminJs = fs.readFileSync(path.join(root, "js", "admin_usuarios.js"), "utf8");

function expectIncludes(snippet, message) {
  assert(adminJs.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

expectIncludes(
  "const REDES_SB_GUIDE_FILES = {",
  "El panel admin debe reconocer explicitamente las guias de redes de Santa Barbara para ofrecer reapertura."
);
expectIncludes(
  "const REDES_SB_LOCK_KEYS = [",
  "El panel admin debe conocer los locks de la guia de redes para quitar solo el bloqueo y no borrar respuestas."
);
expectIncludes(
  "function clearRedesGuideLocks(snapshotState) {",
  "La reapertura de la guia de redes debe limpiar los locks en una sola rutina reutilizable."
);
expectIncludes(
  "async function unlockRedesGuideProgress(usernameKey, fileName, displayName) {",
  "El panel admin debe exponer una accion dedicada para habilitar otra vez la edicion en la guia de redes."
);
expectIncludes(
  'data-unlock-redes-guide="${escapeHtml(',
  "La tarjeta de progreso debe renderizar el boton de habilitar edicion para la guia de redes."
);
expectIncludes(
  'Habilitar edicion</button>`',
  "El boton de reapertura de la guia de redes debe quedar visible con una etiqueta clara."
);
expectIncludes(
  'const unlockRedesGuideButton = event.target.closest("[data-unlock-redes-guide]");',
  "El panel admin debe escuchar el nuevo boton de reapertura de la guia de redes."
);

console.log("OK: el panel admin muestra y procesa la reapertura de la Guia 2 redes.");
