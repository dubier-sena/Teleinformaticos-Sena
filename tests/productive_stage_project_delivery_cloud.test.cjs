"use strict";

// Etapa Productiva, 2026-09-25: entrega del proyecto de punta a punta.
//   * "Formato Proyecto Productivo" y "Anexo financiero" se descargan Y se
//     entregan (antes: "Solo consulta", sin boton de entrega);
//   * un avance del proyecto entregado por el aprendiz queda registrado en la
//     nube en SU doc propio (antes, desde cfea851, solo llegaba a Drive: el
//     historial seguia vacio y el instructor no lo veia);
//   * idempotencia por submissionId, reentrega real = entrega nueva;
//   * el instructor ve esos registros (vista fusionada, sin tocar su doc);
//   * "sin proyecto" y "error de carga" se distinguen (A8);
//   * un fallo al registrar en la nube queda en cola y se reintenta.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));
const store = require(path.join(root, "js/productive_stage_store.js"));

function resetGlobals() {
  delete global._firebaseDb;
  delete global.driveDb;
  delete global.portalAuth;
}

// "Nube" en memoria con el MISMO contrato que cloudUpdateGuideDataStrict /
// cloudGetGuideData de js/firebase_db.js (probado aparte contra un Firestore
// simulado en tests/firebase_db_strict_writes.test.cjs).
function makeCloud(opts) {
  const options = opts || {};
  const docs = {};
  const log = { writes: 0 };
  return {
    docs,
    log,
    cloudGetGuideData: async (scope, file) => (docs[scope + "|" + file] ? plain(docs[scope + "|" + file]) : null),
    cloudUpdateGuideDataStrict: async (scope, file, mutate) => {
      if (options.readFails) return { ok: false, status: "read-failed" };
      const key = scope + "|" + file;
      const next = mutate(docs[key] ? plain(docs[key]) : {});
      if (!next || next.abort) return { ok: false, status: "aborted" };
      if (options.writeFails) return { ok: false, status: "write-failed" };
      docs[key] = plain(next);
      log.writes += 1;
      return { ok: true, status: "saved", snapshot: next };
    },
  };
}

const ENTREGA = {
  projectId: "p-1",
  projectTitle: "Huerta hidroponica",
  fullName: "Ana Lopez",
  ficha: "3168850",
  grupo: "11A",
  submittedAt: "2026-09-25T15:00:00.000Z",
  savedFileName: "Avance_Ana.docx",
  driveUrl: "https://drive.google.com/file/d/F1/view",
  fileId: "F1",
};

// ── Store ────────────────────────────────────────────────────────────────────

test("A12: registrar un avance lo guarda en el doc PROPIO del aprendiz (nunca en el catalogo admin)", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  const result = await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(cloud.docs), ["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME]);
  const saved = cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].projectId, "p-1");
  assert.equal(saved[0].savedFileName, "Avance_Ana.docx");
  assert.equal(saved[0].status, "delivered");
  assert.ok(!("file" in saved[0]) && !("content" in saved[0]), "solo metadatos, nunca el binario");
});

test("A16: el MISMO registro (doble evento / refresh / reintento) no duplica", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  await store.saveOwnProjectDelivery("ana.lopez", Object.assign({}, ENTREGA));
  assert.equal(cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries.length, 1);
});

test("A15: una reentrega REAL (otro archivo) queda como entrega nueva", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  await store.saveOwnProjectDelivery("ana.lopez", Object.assign({}, ENTREGA, { fileId: "F2", submittedAt: "2026-09-26T10:00:00.000Z", savedFileName: "Avance_Ana_v2.docx" }));
  const list = cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries;
  assert.equal(list.length, 2);
  assert.notEqual(list[0].submissionId, list[1].submissionId);
});

test("submissionId es estable y no depende de un usernameKey dentro del registro", () => {
  const a = store.buildProjectSubmissionId("ana.lopez", ENTREGA);
  const b = store.buildProjectSubmissionId("ana.lopez", Object.assign({}, ENTREGA, { usernameKey: "beto.perez" }));
  assert.equal(a, b);
  assert.equal(a, "student:ana.lopez:p-1:F1");
  // sin fileId: fecha + nombre de archivo
  assert.equal(store.buildProjectSubmissionId("ana.lopez", Object.assign({}, ENTREGA, { fileId: "" })), "student:ana.lopez:p-1:2026-09-25T15:00:00.000Z|Avance_Ana.docx");
});

test("A17: si no se puede leer la nube, NO se escribe nada y se informa ok:false", async () => {
  resetGlobals();
  const cloud = makeCloud({ readFails: true });
  global._firebaseDb = cloud;
  const result = await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  assert.equal(result.ok, false);
  assert.equal(result.status, "read-failed");
  assert.equal(cloud.log.writes, 0);
});

test("registrar un avance NO borra los documentos base ya registrados del aprendiz", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  await store.saveOwnDocumentDelivery("ana.lopez", { docId: "bitacora-1", submittedAt: "2026-09-01T00:00:00.000Z" });
  await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  const doc = cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME];
  assert.equal(doc.documentDeliveries.length, 1);
  assert.equal(doc.projectDeliveries.length, 1);
});

test("A13/A19: OTRO dispositivo (sin localStorage) recupera el avance desde la nube y aparece en el historial", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  await store.saveOwnProjectDelivery("ana.lopez", ENTREGA);
  // "Dispositivo B": nada local; la vista server-side trae el proyecto.
  global.portalAuth = { getCurrentSession: () => ({ role: "student", user: { usernameKey: "ana.lopez" } }) };
  global.driveDb = {
    getStudentProductiveStageViewDetailed: async () => ({ status: "found", data: { projects: [{ id: "p-1", studentUsernameKeys: ["ana.lopez"] }], deliveries: [] } }),
  };
  const snapshot = await store.loadStudentSnapshot();
  assert.equal(snapshot.viewStatus, "ok");
  const history = store.getProjectDeliveries(snapshot, "p-1");
  assert.equal(history.length, 1);
  assert.equal(history[0].savedFileName, "Avance_Ana.docx");
});

test("A18: loadStudentSnapshot distingue error de carga de 'sin proyecto'", async () => {
  resetGlobals();
  global._firebaseDb = makeCloud();
  global.driveDb = { getStudentProductiveStageViewDetailed: async () => ({ status: "error", data: null }) };
  assert.equal((await store.loadStudentSnapshot()).viewStatus, "error");
  global.driveDb = { getStudentProductiveStageViewDetailed: async () => ({ status: "missing", data: null }) };
  const missing = await store.loadStudentSnapshot();
  assert.equal(missing.viewStatus, "ok");
  assert.equal(missing.projects.length, 0);
  global.driveDb = { getStudentProductiveStageViewDetailed: async () => { throw new Error("red"); } };
  assert.equal((await store.loadStudentSnapshot()).viewStatus, "error");
});

test("A7/A14: el instructor ve el avance del aprendiz; su doc admin NO se modifica y lo manual se conserva", () => {
  const admin = {
    projects: [{ id: "p-1", studentUsernameKeys: ["ana.lopez"] }],
    deliveries: [{ deliveryId: "p-1:manual", projectId: "p-1", savedFileName: "registrado-por-instructor.pdf", uploadedAt: "2026-09-10T00:00:00.000Z" }],
    documentDeliveries: [{ usernameKey: "ana.lopez", docId: "ficha-inscripcion", submittedAt: "2026-09-01T00:00:00.000Z", savedFileName: "manual.pdf" }],
  };
  const before = JSON.stringify(admin);
  const own = store.appendOwnProjectDelivery({}, "ana.lopez", ENTREGA);
  own.documentDeliveries = [
    { usernameKey: "ana.lopez", docId: "ficha-inscripcion", submittedAt: "2026-08-01T00:00:00.000Z", savedFileName: "vieja.pdf" },
    { usernameKey: "ana.lopez", docId: "formato-proyecto", submittedAt: "2026-09-20T00:00:00.000Z", savedFileName: "proyecto.docx" },
  ];
  const view = store.mergeStudentOwnRecordsIntoView(admin, { "ana.lopez": own });
  assert.equal(JSON.stringify(admin), before, "el snapshot admin no se muta");
  const history = store.getProjectDeliveries(view, "p-1").map((d) => d.savedFileName).sort();
  assert.deepEqual(plain(history), ["Avance_Ana.docx", "registrado-por-instructor.pdf"]);
  const byUser = store.getDocumentDeliveriesByUsername(view)["ana.lopez"];
  assert.equal(byUser["ficha-inscripcion"].savedFileName, "manual.pdf", "el registro admin mas reciente se conserva");
  assert.equal(byUser["formato-proyecto"].savedFileName, "proyecto.docx", "el documento entregado por el aprendiz aparece");
});

test("la vista del instructor nunca atribuye a un aprendiz un registro que no es suyo", () => {
  const own = { projectDeliveries: [Object.assign({}, store.appendOwnProjectDelivery({}, "beto.perez", ENTREGA).projectDeliveries[0])] };
  const view = store.mergeStudentOwnRecordsIntoView({ deliveries: [] }, { "ana.lopez": own });
  assert.equal(view.deliveries.length, 0);
});

// ── Pagina del aprendiz ─────────────────────────────────────────────────────

function loadPage(opts) {
  const options = opts || {};
  const els = {};
  const listeners = {};
  const localData = new Map(options.localStorage || []);
  const toasts = [];
  const document = {
    getElementById(id) {
      if (!els[id]) els[id] = { innerHTML: "", querySelectorAll: () => [], addEventListener() {} };
      return els[id];
    },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  };
  const windowObj = {
    portalAuth: { FICHA_MAP: { "3441939": { grupo: "10A" }, "3168850": { grupo: "11A" } } },
    productiveStageStore: options.store || store,
    localStorage: {
      getItem: (k) => (localData.has(k) ? localData.get(k) : null),
      setItem: (k, v) => localData.set(k, String(v)),
      removeItem: (k) => localData.delete(k),
    },
    portalSaveStatus: { error: (m) => toasts.push(m) },
    location: { reload() {} },
  };
  const ctx = { console, document, window: windowObj, Date, JSON, Promise, setTimeout };
  vm.createContext(ctx);
  vm.runInContext(read("js/productive_stage_project_delivery.js"), ctx, { filename: "productive_stage_project_delivery.js" });
  return {
    api: windowObj.productiveStageProjectDelivery,
    els,
    localData,
    toasts,
    // El listener real lanza el registro en la nube sin esperarlo (como en
    // el navegador): se deja correr la cola de microtareas antes de comprobar.
    emit: async (detail) => {
      (listeners["guide-delivery-registered"] || []).forEach((fn) => fn({ detail }));
      await new Promise((resolve) => setTimeout(resolve, 5));
    },
  };
}

const STUDENT = { role: "student", user: { usernameKey: "ana.lopez", ficha: "3168850", grupo: "11A", fullName: "Ana Lopez" } };

test("A01-A04: Formato Proyecto y Anexo financiero tienen Descargar formato Y Entregar archivo", () => {
  const page = loadPage();
  page.api.render({ snapshot: null, viewModel: { projects: [] }, session: STUDENT });
  const html = page.els["student-project-resources-body"].innerHTML;
  ["formato-proyecto", "anexo-financiero"].forEach((id) => {
    assert.match(html, new RegExp('data-delivery-doc="' + id + '"'), "falta Entregar archivo en " + id);
  });
  assert.match(html, /2\.%20Formato%20Proyecto%20Productivo\.docx|Formato Proyecto Productivo\.docx/);
  assert.match(html, /2\.1\.%20Anexo%20financiero\.xlsx|Anexo financiero\.xlsx/);
  assert.equal((html.match(/Descargar formato/g) || []).length >= 4, true);
});

test("A06: una sesion que no es de aprendiz ve los botones de entrega deshabilitados", () => {
  const page = loadPage();
  page.api.render({ snapshot: null, viewModel: { projects: [] }, session: { role: "admin", user: { ficha: "3168850" } } });
  const html = page.els["student-project-resources-body"].innerHTML;
  const button = html.match(/<button[^>]*data-delivery-doc="formato-proyecto"[^>]*>/)[0];
  assert.match(button, /disabled/);
});

test("A07: grado 10 sigue sin Formato Proyecto ni Anexo financiero", () => {
  const page = loadPage();
  page.api.render({ snapshot: null, viewModel: { projects: [] }, session: { role: "student", user: { usernameKey: "x", ficha: "3441939" } } });
  const html = page.els["student-project-resources-body"].innerHTML;
  assert.doesNotMatch(html, /formato-proyecto|anexo-financiero/);
});

test("A18: error de carga muestra 'No fue posible cargar…' + Reintentar, NO 'no estas vinculado'", () => {
  const page = loadPage();
  page.api.render({ snapshot: { viewStatus: "error" }, viewModel: { projects: [] }, session: STUDENT });
  const html = page.els["student-project-delivery-body"].innerHTML;
  assert.match(html, /No fue posible cargar la informacion del proyecto/);
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /Aún no tienes un proyecto vinculado/);
});

test("A18: sin proyecto (carga correcta) muestra 'Aún no tienes un proyecto vinculado.'", () => {
  const page = loadPage();
  page.api.render({ snapshot: { viewStatus: "ok" }, viewModel: { projects: [] }, session: STUDENT });
  const html = page.els["student-project-delivery-body"].innerHTML;
  assert.match(html, /Aún no tienes un proyecto vinculado\./);
  assert.doesNotMatch(html, /No fue posible cargar/);
});

test("A03/A12: entrega del avance -> historial actualizado al instante y registro en la nube", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  const page = loadPage();
  const project = { id: "p-1", projectTitle: "Huerta hidroponica" };
  page.api.render({ snapshot: { viewStatus: "ok", deliveries: [] }, viewModel: { projects: [project] }, session: STUDENT });
  assert.match(page.els["student-project-delivery-body"].innerHTML, /Todavia no se ha cargado ningun avance/);
  await page.emit(Object.assign({ panelKey: "etapa-avance-p-1", activityLabel: "Avance del Proyecto", status: "delivered" }, ENTREGA));
  assert.match(page.els["student-project-delivery-body"].innerHTML, /Avance_Ana\.docx/);
  assert.equal(cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries.length, 1);
});

test("A16: el mismo evento de entrega disparado dos veces deja UN registro (pagina + nube)", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  const page = loadPage();
  page.api.render({ snapshot: { viewStatus: "ok", deliveries: [] }, viewModel: { projects: [{ id: "p-1" }] }, session: STUDENT });
  const detail = Object.assign({ panelKey: "etapa-avance-p-1", status: "delivered" }, ENTREGA);
  await page.emit(detail);
  await page.emit(detail);
  assert.equal(cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries.length, 1);
  assert.equal((page.els["student-project-delivery-body"].innerHTML.match(/Avance_Ana\.docx/g) || []).length, 1);
});

test("A17: si la nube falla, se avisa de forma visible y la entrega queda en cola; al volver a abrir se registra", async () => {
  resetGlobals();
  global._firebaseDb = makeCloud({ writeFails: true });
  const page = loadPage();
  page.api.render({ snapshot: { viewStatus: "ok" }, viewModel: { projects: [{ id: "p-1" }] }, session: STUDENT });
  await page.emit(Object.assign({ panelKey: "etapa-avance-p-1", status: "delivered" }, ENTREGA));
  assert.equal(page.toasts.length, 1);
  assert.match(page.toasts[0], /Se reintentara automaticamente/);
  assert.equal(page.api.__test.readPending("ana.lopez").length, 1);

  // "Volver a abrir la pagina" con la nube ya disponible.
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  const again = loadPage({ localStorage: Array.from(page.localData.entries()) });
  again.api.render({ snapshot: { viewStatus: "ok" }, viewModel: { projects: [{ id: "p-1" }] }, session: STUDENT });
  // render() ya lanza el vaciado de la cola; se espera a que termine.
  await again.api.__test.flushPendingCloudRecords();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].projectDeliveries.length, 1);
  assert.equal(again.api.__test.readPending("ana.lopez").length, 0);
});

test("entrega de Formato Proyecto (documento base) se registra en la nube con su docId", async () => {
  resetGlobals();
  const cloud = makeCloud();
  global._firebaseDb = cloud;
  const page = loadPage();
  page.api.render({ snapshot: { viewStatus: "ok" }, viewModel: { projects: [] }, session: STUDENT });
  await page.emit({ panelKey: "etapa-doc-formato-proyecto", activityLabel: "Formato Proyecto Productivo", submittedAt: "2026-09-25T15:00:00.000Z", savedFileName: "Proyecto.docx", status: "delivered" });
  const docs = cloud.docs["student:ana.lopez|" + store.OWN_DELIVERIES_FILE_NAME].documentDeliveries;
  assert.equal(docs.length, 1);
  assert.equal(docs[0].docId, "formato-proyecto");
});

test("openProjectDeliveryModal pasa un panelKey estable etapa-avance-{projectId}", () => {
  const code = read("js/productive_stage_project_delivery.js");
  const fn = code.match(/function openProjectDeliveryModal\([\s\S]*?\n  \}/)[0];
  assert.match(fn, /panelKey: PROJECT_ADVANCE_PANEL_PREFIX \+ project\.id/);
  assert.match(code, /const PROJECT_ADVANCE_PANEL_PREFIX = "etapa-avance-";/);
});
