const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const guideJs = fs.readFileSync(path.join(root, "js", "script_guia_redes.js"), "utf8");

function expectIncludes(snippet, message) {
  assert(guideJs.includes(snippet), `${message}\nEsperado: ${snippet}`);
}

function expectNotIncludes(snippet, message) {
  assert(!guideJs.includes(snippet), `${message}\nNo esperado: ${snippet}`);
}

expectIncludes(
  "function getDeliveryIdentityRedes()",
  "La guia de redes debe centralizar la identidad usada para subir productos a Drive."
);
expectIncludes(
  "const selection = auth?.getCurrentSelection?.(defaults) || defaults;",
  "La identidad de entrega debe respetar la seleccion activa de ficha del portal."
);
expectIncludes(
  "const ficha = String((user && user.ficha) || selection.ficha || defaults.ficha || \"\").trim();",
  "La ficha usada para Drive debe salir del usuario o de la seleccion activa, no de un campo plano inexistente."
);
expectIncludes(
  "const identity = getDeliveryIdentityRedes();",
  "Las subidas de productos deben usar la identidad normalizada de la guia."
);
expectIncludes(
  "const ficha = identity.ficha || \"0000\";",
  "Las subidas de productos deben tomar la ficha desde la identidad normalizada."
);
expectIncludes(
  "fullName: identity.fullName || identity.usernameKey || \"Aprendiz\"",
  "Las subidas de productos deben enviar el nombre resuelto desde la identidad normalizada."
);
expectNotIncludes(
  "const ficha = (session && session.ficha) || \"0000\";",
  "Las subidas de productos no deben depender de session.ficha porque en este portal llega dentro de session.user."
);
expectNotIncludes(
  "fullName: (session && session.fullName) || usernameKey",
  "Las subidas de productos no deben depender de session.fullName porque en este portal llega dentro de session.user."
);

console.log("OK: las subidas de imagen en redes usan la identidad correcta para Drive.");
