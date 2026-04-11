const fs = require("fs");
const path = require("path");

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "calendario-academico-2026.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "page_calendar.css"), "utf8");

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

function assertNotIncludes(content, expected, label) {
  if (content.includes(expected)) {
    throw new Error(`Sobra ${label}: ${expected}`);
  }
}

assertIncludes(html, 'href="css/page_calendar.css?v=20260411_2"', "cache actualizado de estilos calendario");
assertIncludes(html, 'class="calendar-hero__range"', "rango compacto del calendario");
assertIncludes(css, ".calendar-hero__range", "estilos del rango compacto");
assertIncludes(css, ".calendar-hero__actions-row", "fila compacta de acciones");
assertIncludes(css, ".calendar-hero__panel", "panel del encabezado compactado");
assertNotIncludes(html, 'class="calendar-chip-row"', "chips informativos grandes");
assertNotIncludes(html, "Laboratorio tecnologico SENA", "kicker innecesario");
assertNotIncludes(html, "<span>Sistemas Teleinformaticos</span>", "chip de programa sobrante");
assertNotIncludes(html, "<span>I.E. Jhon F. Kennedy</span>", "chip de institucion JFK sobrante");
assertNotIncludes(html, "<span>I.E. Santa Barbara</span>", "chip de institucion Santa Barbara sobrante");
assertNotIncludes(html, 'id="sync-help"', "linea auxiliar sobrante");

console.log("OK: el calendario usa un encabezado compacto sin chips sobrantes.");
