"use strict";

// Auditoria 2026-08-22, Fases 9/10/11: fechas de entrega separadas
// (attemptedAt/uploadedAt/confirmedAt) y que una reentrega NUNCA borre el
// historial de la anterior. El mecanismo de historial (historialEntregas /
// fechaEntregaOriginal) YA existia en activity_standard.js._persistDeliveryToState
// antes de esta sesion, pero no tenia ninguna prueba -- este archivo lo cubre
// por primera vez, junto con los campos nuevos.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function loadActivityStandard() {
  const ctx = {
    window: {},
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, appendChild() {}, classList: { add() {} } }),
      addEventListener: () => {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    Date,
  };
  ctx.window.portalAuth = { getCurrentSession: () => null };
  ctx.window.activityGradesManager = null;
  ctx.window.sharedAppsScriptDelivery = null;
  vm.createContext(ctx);
  vm.runInContext(read(path.join("js", "activity_standard.js")), ctx);
  return ctx.window.ActivityStandard;
}

function loadSharedDelivery(overrides) {
  const source = read(path.join("js", "shared_apps_script_delivery.js"));
  const listeners = {};
  const sandbox = {
    URL,
    fetch: (overrides && overrides.fetch) || (async () => ({ ok: true, json: async () => ({}) })),
    navigator: { clipboard: null },
    window: {
      PROJECT_INTEGRATIONS: (overrides && overrides.integrations) || { googleAppsScriptUrl: "https://script.google.com/macros/s/test/exec" },
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      portalFirebaseAuth: (overrides && overrides.bridge) || { getIdToken: async () => "test-token", waitForAuthHydration: async () => true },
    },
    document: { addEventListener: () => {} },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  vm.runInNewContext(source, sandbox, { filename: "shared_apps_script_delivery.js" });
  return sandbox.window.sharedAppsScriptDelivery;
}

test("_persistDeliveryToState: una reentrega conserva la anterior en historialEntregas, nunca la borra", () => {
  const std = loadActivityStandard();
  let state = {};
  const stateCtx = {
    getState: () => state,
    saveState: () => {},
    getGuideMetadata: () => ({ guideNumber: "4" }),
  };

  const primeraEntrega = {
    fullName: "Ana Aprendiz", ficha: "3441939", activityNumber: "4.1.1", activityTitle: "Producto 1",
    savedFileName: "archivo_v1.pdf", driveUrl: "https://drive.google.com/file/d/AAA/view",
    submittedAt: "2026-08-18T14:35:00.000Z", confirmedAt: "2026-08-18T14:35:10.000Z",
    attemptedAt: "2026-08-18T14:34:50.000Z", uploadedAt: "2026-08-18T14:35:05.000Z", method: "automatic",
  };
  std._persistDeliveryToState("producto1", primeraEntrega, stateCtx);
  const afterFirst = state["producto1-delivery"];
  assert.equal(afterFirst.savedFileName, "archivo_v1.pdf");
  assert.equal(afterFirst.historialEntregas.length, 0, "la primera entrega no tiene historial previo que conservar");
  assert.equal(afterFirst.fechaEntregaOriginal, "2026-08-18T14:35:00.000Z");

  const reentrega = {
    fullName: "Ana Aprendiz", ficha: "3441939", activityNumber: "4.1.1", activityTitle: "Producto 1",
    savedFileName: "archivo_v2.pdf", driveUrl: "https://drive.google.com/file/d/BBB/view",
    submittedAt: "2026-08-20T16:10:00.000Z", confirmedAt: "2026-08-20T16:10:05.000Z",
    attemptedAt: "2026-08-20T16:09:50.000Z", uploadedAt: "2026-08-20T16:10:02.000Z", method: "automatic",
  };
  std._persistDeliveryToState("producto1", reentrega, stateCtx);
  const afterSecond = state["producto1-delivery"];

  // La entrega VISIBLE (principal) es la mas reciente...
  assert.equal(afterSecond.savedFileName, "archivo_v2.pdf");
  assert.match(afterSecond.driveUrl, /file\/d\/BBB\/view/);
  // ...pero la anterior sigue disponible en el historial, completa.
  assert.equal(afterSecond.historialEntregas.length, 1, "la reentrega debe conservar la anterior en el historial");
  assert.equal(afterSecond.historialEntregas[0].savedFileName, "archivo_v1.pdf");
  // toViewOnlyDriveUrl normaliza a formato "solo ver" (?usp=sharing) -- ver
  // activity_standard.js / CLAUDE.md "URL del archivo: solo visualizacion".
  assert.match(afterSecond.historialEntregas[0].driveUrl, /file\/d\/AAA\/view/);
  // La fecha de la PRIMERA entrega real se preserva aunque haya reentregas.
  assert.equal(afterSecond.fechaEntregaOriginal, "2026-08-18T14:35:00.000Z", "fechaEntregaOriginal no debe cambiar en una reentrega");

  // Tercera entrega: el historial debe acumular (no reemplazar) las 2 anteriores.
  const tercera = Object.assign({}, reentrega, { savedFileName: "archivo_v3.pdf", submittedAt: "2026-08-21T09:00:00.000Z" });
  std._persistDeliveryToState("producto1", tercera, stateCtx);
  const afterThird = state["producto1-delivery"];
  assert.equal(afterThird.historialEntregas.length, 2, "el historial debe acumular ambas entregas anteriores");
  assert.equal(afterThird.savedFileName, "archivo_v3.pdf");
  assert.equal(afterThird.fechaEntregaOriginal, "2026-08-18T14:35:00.000Z");
});

test("_persistDeliveryToState: propaga attemptedAt/uploadedAt/confirmedAt/method/fileId al estado", () => {
  const std = loadActivityStandard();
  let state = {};
  const stateCtx = { getState: () => state, saveState: () => {}, getGuideMetadata: () => ({}) };

  std._persistDeliveryToState("actX", {
    fullName: "Ana", ficha: "3441939", savedFileName: "a.pdf", driveUrl: "https://x/view",
    attemptedAt: "2026-08-20T10:00:00.000Z",
    uploadedAt: "2026-08-20T10:00:05.000Z",
    confirmedAt: "2026-08-20T10:00:06.000Z",
    method: "manual-verified",
    fileId: "abc123",
  }, stateCtx);

  const rec = state["actX-delivery"];
  assert.equal(rec.attemptedAt, "2026-08-20T10:00:00.000Z");
  assert.equal(rec.uploadedAt, "2026-08-20T10:00:05.000Z");
  assert.equal(rec.confirmedAt, "2026-08-20T10:00:06.000Z");
  assert.equal(rec.method, "manual-verified");
  assert.equal(rec.fileId, "abc123");
});

test("_persistDeliveryToState: registros viejos sin los campos nuevos no truenan (compatibilidad)", () => {
  const std = loadActivityStandard();
  let state = {};
  const stateCtx = { getState: () => state, saveState: () => {}, getGuideMetadata: () => ({}) };

  // Registro "viejo" tal cual lo dejaba el codigo antes de esta sesion: sin
  // attemptedAt/uploadedAt/confirmedAt/method/fileId.
  assert.doesNotThrow(() => {
    std._persistDeliveryToState("actOld", {
      fullName: "Ana", ficha: "3441939", savedFileName: "viejo.pdf",
      driveUrl: "https://x/view", submittedAt: "2026-07-01T10:00:00.000Z",
    }, stateCtx);
  });
  const rec = state["actOld-delivery"];
  assert.equal(rec.method, "automatic", "sin method explicito, se asume automatic (comportamiento historico)");
  assert.equal(rec.attemptedAt, "2026-07-01T10:00:00.000Z", "cae de vuelta a submittedAt si no hay attemptedAt");
});

test("buildDeliveryRecord: usa confirmedAt del servidor como fecha oficial (submittedAt/fechaEntrega), con caida a uploadedAt si el Apps Script viejo no lo manda", () => {
  const delivery = loadSharedDelivery();

  const dctxBase = {
    guideLabel: "Guia 4", activityLabel: "Producto 1", fullName: "Ana", ficha: "3441939",
    submittedAt: "2026-08-20T10:00:00.000Z", // attemptedAt
  };

  // Apps Script YA redesplegado: manda confirmedAt real de Drive.
  const withConfirmed = delivery._buildDeliveryRecord(
    Object.assign({}, dctxBase, { uploadedAt: "2026-08-20T10:00:05.000Z" }),
    { confirmedAt: "2026-08-20T10:00:07.000Z", driveUrl: "https://x/view", savedFileName: "a.pdf" }
  );
  assert.equal(withConfirmed.confirmedAt, "2026-08-20T10:00:07.000Z");
  assert.equal(withConfirmed.submittedAt, "2026-08-20T10:00:07.000Z", "submittedAt (compat) debe usar la fecha confirmada por Drive");
  assert.equal(withConfirmed.fechaEntrega, "2026-08-20T10:00:07.000Z");
  assert.equal(withConfirmed.attemptedAt, "2026-08-20T10:00:00.000Z");
  assert.equal(withConfirmed.uploadedAt, "2026-08-20T10:00:05.000Z");
  assert.equal(withConfirmed.method, "automatic");

  // Apps Script VIEJO (sin redeploy): no manda confirmedAt -> cae a uploadedAt,
  // nunca se queda sin fecha.
  const withoutConfirmed = delivery._buildDeliveryRecord(
    Object.assign({}, dctxBase, { uploadedAt: "2026-08-20T10:00:05.000Z" }),
    { driveUrl: "https://x/view", savedFileName: "a.pdf" }
  );
  assert.equal(withoutConfirmed.confirmedAt, "2026-08-20T10:00:05.000Z");
  assert.equal(withoutConfirmed.submittedAt, "2026-08-20T10:00:05.000Z");
});

test("buildDeliveryRecord: method se propaga desde dctx (Fase 10, entrega manual verificada)", () => {
  const delivery = loadSharedDelivery();
  const record = delivery._buildDeliveryRecord(
    { guideLabel: "G", activityLabel: "A", fullName: "Ana", ficha: "1", submittedAt: "2026-08-20T10:00:00.000Z", method: "manual-verified" },
    { confirmedAt: "2026-08-20T10:05:00.000Z", driveUrl: "https://x/view", savedFileName: "a.pdf", fileId: "fid1" }
  );
  assert.equal(record.method, "manual-verified");
  assert.equal(record.fileId, "fid1");
});

test("verifyManualDelivery: envia action=verify con el idToken y devuelve found:false sin marcar error cuando no encuentra el archivo", async () => {
  let sentBody = null;
  const delivery = loadSharedDelivery({
    fetch: async (url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, found: false, message: "no encontrado" }) };
    },
  });
  const result = await delivery.verifyManualDelivery({ ficha: "3441939", fullName: "Ana", activityLabel: "Producto 1" });
  assert.equal(sentBody.action, "verify");
  assert.equal(sentBody.idToken, "test-token");
  assert.equal(result.found, false);
});

test("verifyManualDelivery: found:true devuelve driveUrl/confirmedAt/fileId listos para registrar la entrega", async () => {
  const delivery = loadSharedDelivery({
    fetch: async () => ({
      ok: true,
      json: async () => ({ ok: true, found: true, driveUrl: "https://drive/x", savedFileName: "a.pdf", confirmedAt: "2026-08-20T10:00:00.000Z", fileId: "fid1" }),
    }),
  });
  const result = await delivery.verifyManualDelivery({ ficha: "3441939", fullName: "Ana", activityLabel: "Producto 1" });
  assert.equal(result.found, true);
  assert.equal(result.driveUrl, "https://drive/x");
  assert.equal(result.fileId, "fid1");
});

test("verifyManualDelivery: sin token de sesion, rechaza con mensaje claro y no llega a llamar fetch", async () => {
  let fetchCalled = false;
  const delivery = loadSharedDelivery({
    fetch: async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; },
    bridge: { getIdToken: async () => null, waitForAuthHydration: async () => true },
  });
  await assert.rejects(
    () => delivery.verifyManualDelivery({ ficha: "3441939", fullName: "Ana", activityLabel: "Producto 1" }),
    /sesion/i
  );
  assert.equal(fetchCalled, false, "no debe gastar una llamada de red sin token");
});

test("apps-script: doPost despacha por action (verify vs upload) y el upload devuelve confirmedAt/fileId reales de Drive", () => {
  const gs = read(path.join("apps-script", "entregas_actividades.gs"));
  assert.match(gs, /const action = String\(payload\.action \|\| "upload"\)\.toLowerCase\(\);/);
  assert.match(gs, /if \(action === "verify"\) \{\s*return handleVerifyDelivery\(payload\);/);
  assert.match(gs, /confirmedAt: uploaded\.getDateCreated\(\)\.toISOString\(\)/);
  assert.match(gs, /fileId: uploaded\.getId\(\)/);
});

test("apps-script: handleVerifyDelivery busca por nombre esperado (ficha+aprendiz+guia+actividad), no cualquier archivo de la carpeta", () => {
  const gs = read(path.join("apps-script", "entregas_actividades.gs"));
  assert.match(gs, /function handleVerifyDelivery\(payload\)/);
  assert.match(gs, /buildDeliveryFileNameStem/);
  // Cierre de riesgos 2026-08-22: el match por prefijo se endurecio (ver
  // tests/entregas_actividades_verify_matching.test.cjs) para que solo
  // tolere una extension distinta o el sufijo "(N)" de Drive -- ya NO
  // acepta cualquier texto pegado despues del stem exacto.
  assert.match(gs, /nameStem === expectedStem \|\| isTolerableVariant/);
  assert.match(gs, /found:\s*false/);
  assert.match(gs, /found:\s*true/);
});
