"use strict";
// Bitacoras GFPI-F-147 (x6) y Diseno Curricular en "Documentos base del
// proyecto" de Etapa Productiva: ambos deben aparecer SOLO para grado 11
// (fichas 3168850/3168852, las unicas cuyo grupo no empieza por "10" -- ver
// isGrade10Ficha en productive_stage_project_delivery.js) y no para grado 10.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadDeliveryModule() {
  const els = {};
  const document = {
    getElementById(id) {
      if (!els[id]) {
        els[id] = { innerHTML: "", querySelectorAll: () => [] };
      }
      return els[id];
    },
    addEventListener() {},
  };

  const ctx = {
    console,
    document,
    window: {
      portalAuth: {
        FICHA_MAP: {
          "3441939": { grupo: "10A" },
          "3168850": { grupo: "11A" },
          "3168852": { grupo: "11B" },
        },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(read("js/productive_stage_project_delivery.js"), ctx, {
    filename: "productive_stage_project_delivery.js",
  });

  return { ctx, els };
}

function renderFor(ficha) {
  const { ctx, els } = loadDeliveryModule();
  ctx.window.productiveStageProjectDelivery.render({
    snapshot: null,
    viewModel: { projects: [] },
    session: { role: "student", user: { ficha } },
  });
  return els["student-project-resources-body"].innerHTML;
}

test("PROJECT_DOCUMENTS gana 6 bitacoras via push (BITACORA_COUNT) + 1 diseno curricular en el literal", () => {
  const code = read("js/productive_stage_project_delivery.js");
  assert.match(code, /id: "bitacora-" \+ i/);
  assert.match(code, /const BITACORA_COUNT = 6;/);
  assert.match(code, /"diseno-curricular"/);
});

test("grado 11 (ficha 3168850) ve las 6 bitacoras y el diseno curricular", () => {
  const html = renderFor("3168850");
  for (let i = 1; i <= 6; i++) {
    assert.match(html, new RegExp("Bitacora N° " + i));
  }
  assert.match(html, /Diseno Curricular del programa/);
});

test("grado 11 (ficha 3168852) tambien ve las 6 bitacoras y el diseno curricular", () => {
  const html = renderFor("3168852");
  for (let i = 1; i <= 6; i++) {
    assert.match(html, new RegExp("Bitacora N° " + i));
  }
  assert.match(html, /Diseno Curricular del programa/);
});

test("grado 10 (ficha 3441939) NO ve ninguna bitacora ni el diseno curricular", () => {
  const html = renderFor("3441939");
  for (let i = 1; i <= 6; i++) {
    assert.doesNotMatch(html, new RegExp("Bitacora N° " + i));
  }
  assert.doesNotMatch(html, /Diseno Curricular del programa/);
});

test("las 6 bitacoras enlazan el mismo formato GFPI-F-147 con href fijo (no dependen de la ficha)", () => {
  const html = renderFor("3168850");
  const matches = html.match(/GFPI-F-147%20Formato%20Bitacora/g) || [];
  assert.equal(matches.length, 6, "cada bitacora deberia tener su propio link de descarga al formato");
});

test("cada bitacora tiene su propio deliveryLabel y panelKey (entregas independientes)", () => {
  const code = read("js/productive_stage_project_delivery.js");
  assert.match(code, /deliveryLabel: "Bitacora " \+ i/);
  // El panelKey real se arma en openDocumentDeliveryModal como "etapa-doc-" + doc.id,
  // y doc.id es "bitacora-" + i -> panelKeys distintos por bitacora.
  assert.match(code, /id: "bitacora-" \+ i/);
});

// ── Fechas limite y aviso de graduacion ─────────────────────────────────────
// Las fechas viven en BITACORA_DEADLINES (productive_stage_project_delivery.js).
// El test calcula por su cuenta si cada fecha ya vencio a partir de la hora
// real del sistema (misma logica que isPastDeadline: fin de dia America/Bogota,
// UTC-5 fijo), asi que sigue siendo valido a medida que el tiempo avanza --
// no asume que "hoy" sea una fecha fija.
const BITACORA_DEADLINES = [
  "2026-03-27",
  "2026-04-30",
  "2026-05-29",
  "2026-07-31",
  "2026-08-28",
  "2026-10-23",
];

function getCardHtml(html, uniqueMarker) {
  const articles = html.split('<article class="student-project-download-card">');
  const found = articles.find((chunk) => chunk.includes(uniqueMarker));
  return found || "";
}

test("BITACORA_DEADLINES en el codigo coincide con las 6 fechas esperadas (en orden)", () => {
  const code = read("js/productive_stage_project_delivery.js");
  const match = code.match(/const BITACORA_DEADLINES = (\[[\s\S]*?\]);/);
  assert.ok(match, "no se encontro BITACORA_DEADLINES en productive_stage_project_delivery.js");
  const deadlinesInCode = new Function("return (" + match[1] + ");")();
  assert.deepEqual(deadlinesInCode, BITACORA_DEADLINES);
});

test("cada bitacora muestra el aviso correcto (vencida con advertencia de graduacion, o pendiente) segun su fecha limite real", () => {
  const html = renderFor("3168850");
  const now = Date.now();

  BITACORA_DEADLINES.forEach((deadlineValue, idx) => {
    const n = idx + 1;
    const overdue = now > new Date(deadlineValue + "T23:59:00-05:00").getTime();
    const card = getCardHtml(html, "Bitacora N° " + n + "</h4>");
    assert.ok(card, `no se encontro la tarjeta de la bitacora ${n}`);

    if (overdue) {
      assert.match(card, /Fecha limite vencida/, `bitacora ${n} (${deadlineValue}) ya vencio y deberia mostrarse como vencida`);
      assert.match(
        card,
        /NO se considera realizada y no podras graduarte/,
        `bitacora ${n} vencida deberia advertir que bloquea la graduacion`
      );
    } else {
      assert.doesNotMatch(card, /Fecha limite vencida/, `bitacora ${n} (${deadlineValue}) todavia no vence`);
      assert.match(card, /Fecha limite de entrega/, `bitacora ${n} deberia mostrar su fecha limite`);
      assert.match(card, /Es obligatoria para culminar la Etapa Productiva y graduarte/);
    }
  });
});

test("una vez registrada la entrega de una bitacora, ya no se muestra el aviso de fecha limite", () => {
  const { ctx, els } = loadDeliveryModule();
  ctx.window.sharedAppsScriptDelivery = {
    loadDeliveryRecord: function (opts) {
      if (opts.panelKey === "etapa-doc-bitacora-1") {
        return { status: "delivered", submittedAt: "2026-03-20T10:00:00-05:00", savedFileName: "Bitacora1.xlsx" };
      }
      return null;
    },
  };
  // sharedDelivery se captura como constante al cargar el modulo (const sharedDelivery
  // = window.sharedAppsScriptDelivery || null), asi que hay que recargar el modulo
  // DESPUES de definir el stub.
  vm.runInContext(read("js/productive_stage_project_delivery.js"), ctx, {
    filename: "productive_stage_project_delivery.js",
  });
  ctx.window.productiveStageProjectDelivery.render({
    snapshot: null,
    viewModel: { projects: [] },
    session: { role: "student", user: { ficha: "3168850" } },
  });
  const html = els["student-project-resources-body"].innerHTML;
  const card = getCardHtml(html, "Bitacora N° 1</h4>");
  assert.match(card, /Entregado el/);
  assert.doesNotMatch(card, /Fecha limite/);
});

// ── Pantallazo Sofia Plus (evidencia UNICA para todo el periodo, va al expediente) ──

test("hay UNA sola tarjeta de pantallazo Sofia Plus (no una por bitacora), gateada a grado 11", () => {
  const html11 = renderFor("3168850");
  const html10 = renderFor("3441939");
  const matches11 = html11.match(/Pantallazo Sofia Plus/g) || [];
  assert.equal(matches11.length, 1, "deberia aparecer una sola vez para grado 11");
  assert.doesNotMatch(html10, /Pantallazo Sofia Plus/);

  const code = read("js/productive_stage_project_delivery.js");
  assert.match(code, /id: "sofia-plus",/);
  assert.match(code, /deliveryLabel: "Pantallazo Sofia Plus",/);
  assert.match(code, /noDownload: true/);
  // No debe quedar dentro del for de bitacoras (eso generaria una por bitacora).
  assert.doesNotMatch(code, /id: "sofia-plus-" \+ i/);
});

test("la tarjeta de pantallazo Sofia Plus no muestra 'Aun no disponible' (noDownload evita ese aviso), tiene boton Entregar y su propio aviso de fecha limite", () => {
  const html = renderFor("3168850");
  const card = getCardHtml(html, "Pantallazo Sofia Plus</h4>");
  assert.ok(card, "no se encontro la tarjeta del pantallazo Sofia Plus");
  assert.doesNotMatch(card, /Aun no disponible/);
  assert.match(card, /data-delivery-doc="sofia-plus"/);
  assert.doesNotMatch(card, /class="app-btn app-btn--primary"/, "no deberia tener boton Descargar (es solo evidencia a subir)");

  const now = Date.now();
  const overdue = now > new Date(BITACORA_DEADLINES[0] + "T23:59:00-05:00").getTime();
  if (overdue) {
    assert.match(card, /Fecha limite vencida/);
    assert.match(card, /NO se considera realizada y no podras graduarte/);
  } else {
    assert.match(card, /Fecha limite de entrega/);
  }
});

test("los documentos se presentan como una ruta guiada con progreso y bloques comprensibles", () => {
  const html = renderFor("3168850");
  assert.match(html, /Ruta de documentos/);
  assert.match(html, /entregas completadas/);
  assert.match(html, /Descarga<\/strong> el formato indicado/);
  assert.match(html, /Diligencia<\/strong> y guarda el archivo/);
  assert.match(html, /Entrega<\/strong> el archivo desde esta pagina/);
  assert.match(html, /Documentos iniciales obligatorios/);
  assert.match(html, /Plantillas para desarrollar el proyecto/);
  assert.match(html, /Evidencia de actualizacion en Sofia Plus/);
  assert.match(html, /Bitacoras de seguimiento/);
  assert.match(html, /Documento de consulta/);
  assert.match(html, /Solo consulta/);
});

test("grado 10 recibe una ruta corta sin bloques que no le aplican", () => {
  const html = renderFor("3441939");
  assert.match(html, /Documentos iniciales obligatorios/);
  assert.doesNotMatch(html, /Plantillas para desarrollar el proyecto/);
  assert.doesNotMatch(html, /Evidencia de actualizacion en Sofia Plus/);
  assert.doesNotMatch(html, /Bitacoras de seguimiento/);
  assert.doesNotMatch(html, /Documento de consulta/);
});
