const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const EXPORT_FILES = [
  "js/activity_standard.js",
  "js/admin_export.js",
  "js/script.js",
  "js/script_guia2.js",
  "js/script_guia3.js",
  "js/script_guia6.js",
  "js/script_guia_redes.js",
  "js/activity_deadlines.js",
  "js/activity4_admin_report.js",
  "js/shared_apps_script_delivery.js",
];

test("textos fijos de exportacion no contienen codificacion rota ni etiquetas sin tilde conocidas", () => {
  const badPatterns = [
    /m\?nimos/i,
    /Guia \/ actividad/,
    /Fecha de elaboracion/,
    /Numero de ficha/,
    /Sistemas Teleinformaticos/,
    /Herramientas Informaticas/,
    />Institucion</,
    />Guia</,
    />Numero de ficha</,
  ];

  const failures = [];
  EXPORT_FILES.forEach((file) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    badPatterns.forEach((pattern) => {
      if (pattern.test(source)) failures.push(`${file}: ${pattern}`);
    });
  });

  assert.deepEqual(failures, []);
});

function loadActivityStandard() {
  const source = fs.readFileSync(path.join(ROOT, "js", "activity_standard.js"), "utf8");
  const window = {
    location: { href: "file:///portal/index.html" },
    document: {
      getElementById: () => null,
      createElement: () => ({ style: {}, dataset: {}, appendChild() {}, setAttribute() {}, addEventListener() {} }),
      head: { appendChild() {} },
      body: { appendChild() {} },
      addEventListener() {},
    },
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    Blob,
    setTimeout: () => 0,
  };
  const context = vm.createContext({ window, document: window.document, Blob, URL: window.URL, setTimeout: window.setTimeout });
  vm.runInContext(source, context, { filename: "activity_standard.js" });
  return context.window.ActivityStandard;
}

function loadAdminExport() {
  const source = fs.readFileSync(path.join(ROOT, "js", "admin_export.js"), "utf8");
  const window = {
    location: { href: "https://example.com/panel-administrativo-usuarios.html" },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ click() {}, remove() {} }),
    },
    URL: { createObjectURL: () => "", revokeObjectURL() {} },
    Blob,
    setTimeout: () => 0,
  };
  const context = vm.createContext({ window, document: window.document, Blob, URL: window.URL, setTimeout: window.setTimeout });
  vm.runInContext(source, context, { filename: "admin_export.js" });
  return context.window.adminExport;
}

test("plantilla estandar de Word separa Guia y Actividad y conserva respuestas del aprendiz", () => {
  const api = loadActivityStandard();
  const learnerText = "Respuesta del aprendiz sin corregir: Guia, elaboracion, informaticas.";
  const html = api.buildWordDocument({
    title: "Actividad 1 - Prueba",
    learnerName: "Aprendiz de prueba",
    ficha: "3441942",
    grupo: "10B",
    inst: "IE Jhon F. Kennedy",
    fecha: "14 de mayo de 2026",
    program: "Sistemas Teleinformáticos",
    competencia: "Competencia técnica.",
    resultado: "Resultado de aprendizaje.",
    guideTitle: "Guía 2 - Operar herramientas informáticas y digitales",
    sections: [{ label: "Respuesta", value: learnerText }],
  });

  assert.match(html, /<td class="label">Guía<\/td>/);
  assert.match(html, /<td class="label">Actividad<\/td>/);
  assert.match(html, /Fecha de elaboración/);
  assert.match(html, /Número de ficha/);
  assert.match(html, /Institución/);
  assert.match(html, /SENA CIAS Puerto Boyacá\./);
  assert.match(html, new RegExp(learnerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("plantilla administrativa incrusta el logo SENA y agrega el enlace del proyecto", () => {
  const api = loadAdminExport();
  const html = api.buildWordDocument({
    title: "Respuestas del aprendiz",
    subtitle: "Aprendiz de prueba",
    meta: "Aprendiz: Aprendiz de prueba | Ficha: 3441942 | Grupo: 10B | Institución: IE Jhon F. Kennedy",
    bodyHtml: "<p>Respuesta de prueba</p>",
    projectLink: "https://example.com/proyecto",
  });

  assert.match(html, /<img src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /assets\/img\/sena-logo\.png/);
  assert.match(html, /Enlace del proyecto:/);
  assert.match(html, /href="https:\/\/example\.com\/proyecto"/);
});
