const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WRAPPER_FILES = [
  "santa-barbara-10a-guia-02-redes-rap01.html",
  "santa-barbara-10b-guia-02-redes-rap01.html",
];
const SHARED_HTML = fs.readFileSync(
  path.join(__dirname, "..", "partials", "guia-redes-rap01-content.html"),
  "utf8"
);

function getPanelBlock(script, panelKey) {
  const start = script.indexOf(`${panelKey}: {`);
  if (start === -1) {
    throw new Error(`No se encontro el panel ${panelKey}`);
  }
  const nextMatch = script
    .slice(start + panelKey.length + 1)
    .match(/\n\s{2}[a-z0-9]+:\s*\{/i);
  const end = nextMatch ? start + panelKey.length + 1 + nextMatch.index : script.length;
  return script.slice(start, end);
}

test("el ejercicio 1 del taller IP incluye boton y estado de guardado en la guia compartida", () => {
  assert.match(SHARED_HTML, /id="btnGuardarTallerIPEj1"/);
  assert.match(SHARED_HTML, /onclick="guardarTallerIPEj1\(\)"/);
  assert.match(SHARED_HTML, /id="tallerIPEj1Status"/);
});

test("el ejercicio 1 del taller IP incluye un boton de apoyo interactivo para clases de IP en la guia compartida", () => {
  assert.match(SHARED_HTML, /onclick="abrirTeoriaPanel\('ip2'\)"/);
  assert.match(SHARED_HTML, /MATERIAL DE APOYO INTERACTIVO/);
  assert.match(SHARED_HTML, /Tipos de Clase de IP con ejemplos/);
});

test("los wrappers de Guia 2 Redes siguen siendo shells validos", () => {
  WRAPPER_FILES.forEach((fileName) => {
    const html = fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
    assert.match(html, /window\.__GUIDE_CONTEXT__/);
    assert.match(html, /id="guide-root"/);
    assert.match(html, /guide_runtime_loader\.js/);
  });
});

test("el lock del ejercicio 1 del taller IP queda integrado en guia y panel admin", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );

  assert.match(guideScript, /taller-ip-ej1-locked/);
  assert.match(guideScript, /window\.guardarTallerIPEj1\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej1-locked/);
});

test("el panel teorico de clases IP muestra mascaras por defecto con ejemplos concretos", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /M[aÃƒÂ¡]scara por defecto/);
  assert.match(guideScript, /255\.0\.0\.0/);
  assert.match(guideScript, /255\.255\.0\.0/);
  assert.match(guideScript, /255\.255\.255\.0/);
  assert.match(guideScript, /10\.5\.20\.1/);
  assert.match(guideScript, /172\.20\.0\.1/);
  assert.match(guideScript, /192\.168\.1\.50/);
});

test("el ejercicio 2 del taller IP incluye boton de apoyo y guardado en la guia compartida", () => {
  assert.match(SHARED_HTML, /onclick="abrirTeoriaPanel\('ip4'\)"/);
  assert.match(SHARED_HTML, /Analizar una direcci(?:o|ÃƒÂ³|&oacute;)n IP paso a paso/);
  assert.match(SHARED_HTML, /id="btnGuardarTallerIPEj2"/);
  assert.match(SHARED_HTML, /onclick="guardarTallerIPEj2\(\)"/);
  assert.match(SHARED_HTML, /id="tallerIPEj2Status"/);
});

test("el ejercicio 2 del taller IP queda integrado con lock y panel teorico contextual", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );
  const ip4Panel = getPanelBlock(guideScript, "ip4");

  assert.match(guideScript, /taller-ip-ej2-locked/);
  assert.match(guideScript, /window\.guardarTallerIPEj2\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej2-locked/);
  assert.match(ip4Panel, /Analizar una direcci[oÃƒÂ³]n IP paso a paso/);
  assert.match(ip4Panel, /ejemplo guiado/i);
  assert.match(ip4Panel, /150\.20\.8\.12/);
  assert.match(ip4Panel, /255\.255\.0\.0/);
  assert.match(ip4Panel, /Clase B/);
  assert.match(ip4Panel, /65534 hosts/);
  assert.match(ip4Panel, /publica/i);
  assert.doesNotMatch(ip4Panel, /192\.168\.10\.45/);
});

test("el ejercicio 3 del taller IP incluye boton de apoyo y guardado en la guia compartida", () => {
  assert.match(SHARED_HTML, /onclick="abrirTeoriaPanel\('ip5'\)"/);
  assert.match(SHARED_HTML, /Asignar IPs en una red local paso a paso/);
  assert.match(SHARED_HTML, /id="btnGuardarTallerIPEj3"/);
  assert.match(SHARED_HTML, /onclick="guardarTallerIPEj3\(\)"/);
  assert.match(SHARED_HTML, /id="tallerIPEj3Status"/);
});

test("el ejercicio 3 del taller IP queda integrado con lock y panel teorico con ejemplo diferente", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );
  const ip5Panel = getPanelBlock(guideScript, "ip5");

  assert.match(guideScript, /taller-ip-ej3-locked/);
  assert.match(guideScript, /window\.guardarTallerIPEj3\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej3-locked/);
  assert.match(ip5Panel, /Asignar IPs en una red local paso a paso/);
  assert.match(ip5Panel, /ejemplo guiado distinto al taller/i);
  assert.match(ip5Panel, /192\.168\.50\.0/);
  assert.match(ip5Panel, /192\.168\.50\.10/);
  assert.match(ip5Panel, /192\.168\.50\.20/);
  assert.match(ip5Panel, /192\.168\.50\.255/);
  assert.match(ip5Panel, /empezar en \.10/i);
});

test("el ejercicio 4 del taller IP presenta pasos claros, apoyo y carga de pantallazo en la guia compartida", () => {
  const uploadIndex = SHARED_HTML.indexOf("btnSubirTallerIPEj4");
  const supportIndex = SHARED_HTML.indexOf("abrirTeoriaPanel('ip6')");
  assert.notEqual(uploadIndex, -1);
  assert.notEqual(supportIndex, -1);
  assert.ok(uploadIndex < supportIndex, "el boton de subir pantallazo debe aparecer antes del material de apoyo");
  assert.match(SHARED_HTML, /onclick="abrirTeoriaPanel\('ip6'\)"/);
  assert.match(SHARED_HTML, /Interpretar IPv4, m(?:a|ÃƒÂ¡|&aacute;)scara, gateway y DNS/);
  assert.match(SHARED_HTML, /btnSubirTallerIPEj4/);
  assert.match(SHARED_HTML, /ej4CapturaInput/);
  assert.match(SHARED_HTML, /tallerIPEj4Preview/);
  assert.match(SHARED_HTML, /btnGuardarTallerIPEj4/);
  assert.match(SHARED_HTML, /tallerIPEj4Status/);
});

test("el ejercicio 4 del taller IP queda integrado con lock, pantallazo y panel teorico guiado", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );
  const ip6Panel = getPanelBlock(guideScript, "ip6");

  assert.match(guideScript, /taller-ip-ej4-locked/);
  assert.match(guideScript, /window\.subirPantallazoTallerIPEj4\s*=\s*async function/);
  assert.match(guideScript, /window\.guardarTallerIPEj4\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej4-locked/);
  assert.match(ip6Panel, /ip6:/);
  assert.match(ip6Panel, /Interpretar IPv4, m[aÃƒÂ¡]scara, gateway y DNS/);
  assert.match(ip6Panel, /ejemplo guiado/i);
  assert.match(ip6Panel, /10\.0\.5\.23/);
  assert.match(ip6Panel, /255\.255\.255\.0/);
  assert.match(ip6Panel, /10\.0\.5\.1/);
  assert.match(ip6Panel, /8\.8\.8\.8/);
  assert.match(ip6Panel, /1\.1\.1\.1/);
  assert.doesNotMatch(ip6Panel, /192\.168\.10\.45/);
});

test("el ejercicio 5 del taller IP incluye boton de apoyo y guardado en la guia compartida", () => {
  assert.match(SHARED_HTML, /onclick="abrirTeoriaPanel\('ip7'\)"/);
  assert.match(SHARED_HTML, /Elegir la clase IP seg(?:u|ÃƒÆ’Ã‚Âº|&uacute;)n cantidad de dispositivos/);
  assert.match(SHARED_HTML, /id="btnGuardarTallerIPEj5"/);
  assert.match(SHARED_HTML, /onclick="guardarTallerIPEj5\(\)"/);
  assert.match(SHARED_HTML, /id="tallerIPEj5Status"/);
});

test("el ejercicio 5 del taller IP queda integrado con lock y panel teorico con ejemplo diferente", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );
  const adminScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "admin_usuarios.js"),
    "utf8"
  );
  const ip7Panel = getPanelBlock(guideScript, "ip7");

  assert.match(guideScript, /taller-ip-ej5-locked/);
  assert.match(guideScript, /window\.guardarTallerIPEj5\s*=\s*async function/);
  assert.match(adminScript, /taller-ip-ej5-locked/);
  assert.match(ip7Panel, /ip7:/);
  assert.match(ip7Panel, /Elegir la clase IP seg[uÃƒÆ’Ã‚Âº]n cantidad de dispositivos/);
  assert.match(ip7Panel, /elige la clase mas pequena/i);
  assert.match(ip7Panel, /120 dispositivos/);
  assert.match(ip7Panel, /900 dispositivos/);
  assert.match(ip7Panel, /120000 dispositivos/);
  assert.match(ip7Panel, /Clase C/);
  assert.match(ip7Panel, /Clase B/);
  assert.match(ip7Panel, /Clase A/);
  assert.doesNotMatch(ip7Panel, /50 dispositivos/);
  assert.doesNotMatch(ip7Panel, /500 dispositivos/);
  assert.doesNotMatch(ip7Panel, /3\.000 dispositivos/);
});

test("el taller IP incluye un boton final para generar y subir un solo Word con ejercicios 1 a 5 en la guia compartida", () => {
  assert.match(SHARED_HTML, /onclick="exportarWordTallerIP\(event\)"/);
  assert.match(SHARED_HTML, /Generar Word(?:\s|&nbsp;|&#160;|&mdash;|&#8212;|-)+Taller IP/);
  assert.match(SHARED_HTML, /Cuando hayas completado los 5 ejercicios, genera tu entrega en Word y s(?:u|ú|Ãº|&uacute;)bela al Drive/i);
});

test("el taller IP genera un solo Word con ejercicios 1 a 5 y prepara la subida al Drive", () => {
  const guideScript = fs.readFileSync(
    path.join(__dirname, "..", "js", "script_guia_redes.js"),
    "utf8"
  );

  assert.match(guideScript, /window\.exportarWordTallerIP\s*=\s*function/);
  assert.match(guideScript, /Actividad 3\.3\.4 \u2014 Taller IP \(Ejercicios 1\u20135\)/);
  assert.match(guideScript, /Taller_IP_/);
  assert.match(guideScript, /Ejercicio 1 \u2014 Identificar clases de direcciones IP/);
  assert.match(guideScript, /Ejercicio 5 \u2014 Elegir la clase de IP correcta para cada caso/);
  assert.match(guideScript, /ej4-captura-url/);
  assert.match(guideScript, /openDeliveryModal/);
});
