const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

const USERNAME_KEY = "prueba.aprendiz";

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

// Aviso del home "Etapa Productiva: falta entregar ..." (jul-15). La entrega de
// los 2 documentos base (ficha de inscripcion y acuerdo) queda registrada en
// localStorage por shared_apps_script_delivery.js bajo
// "etapa-productiva-estudiante:delivery:{segment}", donde el segment sale de
// sanitizeFileSegment(panelKey || activityNumber || activityLabel). portal_home.js
// NO carga ese modulo (es pesado y trae el modal), asi que replica la clave con
// segments literales -- estos tests son los que garantizan que esa replica y el
// panelKey que envia productive_stage_project_delivery.js no diverjan.

function getStudentStorageKey(usernameKey, key, options) {
  const area = (options && options.area) || "app";
  return `sena_portal:student:${usernameKey}:${area}:${key}`;
}

function loadPortalHome(localStorageData) {
  const localStorageStub = {
    _data: localStorageData || {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
  };

  const ctx = {
    console,
    localStorage: localStorageStub,
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {},
  };
  ctx.window.portalAuth = {
    getCurrentSession: () => null,
    getStudentStorageKey: getStudentStorageKey,
  };
  vm.createContext(ctx);

  vm.runInContext(read(path.join("js", "activity_standard.js")), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read(path.join("js", "guide_declarations.js")), ctx, { filename: "guide_declarations.js" });

  let code = read(path.join("js", "portal_home.js"));
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE de portal_home.js");
  code = code.replace(
    /\n\}\)\(\);\s*$/,
    "\n  window.pendingProductiveDocsFor = pendingProductiveDocsFor;\n  window.PRODUCTIVE_BASE_DOCS = PRODUCTIVE_BASE_DOCS;\n})();"
  );
  vm.runInContext(code, ctx, { filename: "portal_home.js" });

  return ctx;
}

function docDeliveryKey(segment) {
  return getStudentStorageKey(
    USERNAME_KEY,
    "etapa-productiva-estudiante:delivery:" + segment,
    { area: "guide-data" }
  );
}

test("sin registros locales -> los 2 documentos base aparecen pendientes", () => {
  const ctx = loadPortalHome({});
  const pending = ctx.window.pendingProductiveDocsFor(USERNAME_KEY);
  assert.equal(pending.length, 2);
  assert.ok(pending.some((d) => /inscripci/i.test(d.label)));
  assert.ok(pending.some((d) => /acuerdo/i.test(d.label)));
});

test("una entrega registrada con la clave NUEVA (panelKey) deja de aparecer", () => {
  const data = {};
  data[docDeliveryKey("etapa_doc_ficha_inscripcion")] = JSON.stringify({ status: "delivered" });
  const ctx = loadPortalHome(data);
  const pending = ctx.window.pendingProductiveDocsFor(USERNAME_KEY);
  assert.equal(pending.length, 1);
  assert.match(pending[0].label, /acuerdo/i);
});

test("una entrega registrada con la clave HISTORICA (label, previa a jul-2026) tambien cuenta", () => {
  const data = {};
  data[docDeliveryKey("Ficha_de_Inscripcion")] = JSON.stringify({ status: "delivered" });
  data[docDeliveryKey("Acuerdo_de_Etapa_Productiva")] = JSON.stringify({ status: "delivered" });
  const ctx = loadPortalHome(data);
  assert.equal(ctx.window.pendingProductiveDocsFor(USERNAME_KEY).length, 0);
});

test("un registro sin status delivered NO cuenta como entregado", () => {
  const data = {};
  data[docDeliveryKey("etapa_doc_ficha_inscripcion")] = JSON.stringify({ status: "pending" });
  const ctx = loadPortalHome(data);
  assert.equal(ctx.window.pendingProductiveDocsFor(USERNAME_KEY).length, 2);
});

// ── Sincronia de claves entre los 3 archivos ────────────────────────────────

// Misma derivacion que sanitizeLabel + sanitizeFileSegment del modulo de
// entregas (normalizeText alli es solo String().trim()).
function sanitizeFileSegment(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
}

test("la formula de sanitizeFileSegment del modulo de entregas no cambio (si esto falla, revisar los segments replicados)", () => {
  const shared = read(path.join("js", "shared_apps_script_delivery.js"));
  const mustContain = [
    'return String(value == null ? "" : value).trim();',
    '.replace(/[\\\\/:*?"<>|#%{}~&]/g, " ")',
    '.replace(/[^a-z0-9]+/gi, "_")',
    ".replace(/^_+|_+$/g, \"\")",
    "context.panelKey || context.activityNumber || context.activityLabel",
  ];
  for (const fragment of mustContain) {
    assert.ok(
      shared.includes(fragment),
      "shared_apps_script_delivery.js cambio la derivacion de la clave de registro; " +
        "ya no contiene: " + fragment
    );
  }
});

test("los segments de portal_home derivan del panelKey y el deliveryLabel reales de la pagina de Etapa Productiva", () => {
  const deliveryScript = read(path.join("js", "productive_stage_project_delivery.js"));
  // El modal de documentos debe enviar el panelKey estable.
  assert.match(deliveryScript, /panelKey: "etapa-doc-" \+ doc\.id/);

  const docsMatch = deliveryScript.match(/const PROJECT_DOCUMENTS = (\[[\s\S]*?\n  \]);/);
  assert.ok(docsMatch, "no se encontro PROJECT_DOCUMENTS en productive_stage_project_delivery.js");
  const projectDocs = new Function("return (" + docsMatch[1] + ");")();
  const baseDocs = projectDocs.filter((d) => d.deliveryLabel && !d.hideForGrade10);
  assert.equal(baseDocs.length, 2, "deberia haber exactamente 2 documentos base con entrega");

  const ctx = loadPortalHome({});
  const homeDocs = ctx.window.PRODUCTIVE_BASE_DOCS;
  assert.equal(homeDocs.length, 2);

  baseDocs.forEach((doc) => {
    const expected = [
      sanitizeFileSegment("etapa-doc-" + doc.id),
      sanitizeFileSegment(doc.deliveryLabel),
    ];
    const homeDoc = homeDocs.find((d) => Array.from(d.segments)[0] === expected[0]);
    assert.ok(homeDoc, `portal_home no tiene el documento con segment "${expected[0]}"`);
    assert.deepEqual(Array.from(homeDoc.segments), expected);
  });
});

test("la card del documento muestra la entrega registrada (lectura dual nueva/historica)", () => {
  const deliveryScript = read(path.join("js", "productive_stage_project_delivery.js"));
  assert.match(deliveryScript, /function getDocumentDeliveryRecord\(doc\)/);
  assert.match(deliveryScript, /\["etapa-doc-" \+ doc\.id, doc\.deliveryLabel\]/);
  assert.match(deliveryScript, /student-project-download-card__delivered/);
  assert.match(read(path.join("css", "page_productive_stage_student.css")), /\.student-project-download-card__delivered/);
});
