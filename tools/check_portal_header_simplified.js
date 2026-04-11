const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "page_portal.css"), "utf8");

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

function assertNotIncludes(content, unexpected, label) {
  if (content.includes(unexpected)) {
    throw new Error(`Sobra ${label}: ${unexpected}`);
  }
}

assertIncludes(html, "Sistemas Teleinform", "titulo corto del portal");
assertIncludes(
  html,
  "¡Hola a todos! 👋 ¡Bienvenidos a una nueva aventura de aprendizaje! 🚀 Que sea un año genial y lleno de éxitos",
  "mensaje de bienvenida"
);
assertIncludes(html, 'class="hero-welcome anim-4"', "bloque visual de bienvenida");

assertNotIncludes(
  html,
  "Fortalecimiento de los Servicios Teleinform",
  "titulo largo anterior"
);
assertNotIncludes(
  html,
  "Sistemas Teleinform&aacute;ticos | 233108 | V1",
  "badge superior innecesario"
);
assertNotIncludes(html, '<span class="label">Programa</span>', "tarjeta programa");
assertNotIncludes(html, '<span class="label">Codigo</span>', "tarjeta codigo");

assertIncludes(css, ".hero-welcome", "estilos del saludo principal");
assertIncludes(css, "grid-column: 1;", "posicion del saludo en la columna principal");

console.log("OK: el encabezado del index quedo simplificado con saludo destacado.");
