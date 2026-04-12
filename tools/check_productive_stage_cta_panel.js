const fs = require("fs");
const path = require("path");

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css", "page_portal.css"), "utf8");

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`Falta ${label}: ${expected}`);
  }
}

assertIncludes(html, 'id="btn-productive-stage-cta"', "boton de etapa productiva en el panel de grupo seleccionado");
assertIncludes(html, 'id="productive-stage-cta-wrap"', "contenedor del acceso secundario de etapa productiva");
assertIncludes(html, 'function canShowProductiveStageForFicha', "helper para decidir visibilidad en el CTA");
assertIncludes(html, 'updateProductiveStageCta(ficha, inst, grupo, accessState);', "actualizacion del CTA de etapa productiva al cambiar la guia");
assertIncludes(html, 'etapa-productiva-estudiante.html', "enlace a la vista privada de etapa productiva");
assertIncludes(html, 'session?.role === "admin"', "visibilidad del CTA para el administrador");
assertIncludes(html, 'button.href = "etapa-productiva-admin.html";', "enlace administrativo desde el CTA");
assertIncludes(html, 'button.textContent = "Administrar etapa productiva";', "rotulo administrativo del CTA");
assertIncludes(html, 'window.refreshSelectedGroupPanel = refreshSelectedGroupPanel;', "exposicion del refresco del panel seleccionado");
assertIncludes(fs.readFileSync(path.join(root, "js", "index_auth.js"), "utf8"), 'window.refreshSelectedGroupPanel();', "sincronizacion del CTA cuando cambia la sesion");
assertIncludes(css, '.productive-stage-cta-wrap', "estilos del acceso de etapa productiva en el CTA");
assertIncludes(css, '.btn-productive-stage-cta', "estilos del boton de etapa productiva en el CTA");

console.log("OK: el panel de grupo seleccionado incluye el acceso a etapa productiva para fichas 11 autorizadas.");
