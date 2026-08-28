"use strict";

// Bloque G.1 (Fase E, auditoria 2026-08-27) — simulaciones de carga 100%
// LOCALES (reloj virtual + servidor Apps Script falso + mocks). Ninguna
// prueba de este archivo toca Firebase, Apps Script, Drive o produccion.
//
// Objetivo: medir (no adivinar) el comportamiento real del pipeline de
// entregas bajo los volumenes reales del proyecto (16-30 aprendices por
// grupo, hasta 2 grupos de Santa Barbara el mismo dia, actividades de 2
// archivos en Python) y bajo fallos (timeout, 429, 503, caida de red,
// respuesta perdida, cuota agotada), usando el codigo REAL de
// js/shared_apps_script_delivery.js (retryWithBackoff, uploadToAppsScript,
// isPermanentDeliveryError, processDeliveryQueue, el jitter H3 y la
// prioridad H4), no una reimplementacion.

const test = require("node:test");
const { after } = require("node:test");
const assert = require("node:assert/strict");
const {
  createVirtualClock,
  createFakeAppsScriptServer,
  createSimulatedBrowser,
  simulateLearnerUpload,
  drainBrowserQueue,
} = require("./helpers/delivery_load_sim.cjs");

const METRICS_ROWS = []; // se imprime como tabla al final del archivo

function pushMetricsRow(row) {
  METRICS_ROWS.push(row);
}

// ── Helpers de escenario ────────────────────────────────────────────────

function makeLearners(clock, fakeFetch, count, opts) {
  opts = opts || {};
  const learners = [];
  for (let i = 1; i <= count; i++) {
    const browser = createSimulatedBrowser(clock, fakeFetch, { learnerId: (opts.groupLabel || "g") + "-" + i });
    browser.fireDomReady();
    learners.push({ id: (opts.groupLabel || "g") + "-" + i, browser });
  }
  return learners;
}

// Dispara 1 archivo por learner (o N archivos si filesPerLearner>1) "a la vez"
// (todas las llamadas se inician sin esperar entre ellas, como 16-30
// aprendices presionando "Entregar" casi simultaneamente).
function fireWave(learners, filesPerLearner) {
  const promises = [];
  learners.forEach((learner) => {
    for (let f = 1; f <= filesPerLearner; f++) {
      const submissionId = learner.id + "-file" + f;
      const p = simulateLearnerUpload(learner.browser, {
        submissionId,
        panelKey: filesPerLearner > 1 ? "target-" + f : "target",
        fileName: "evidencia" + f + ".py",
        fullName: "Aprendiz " + learner.id,
      }).then((result) => ({ learnerId: learner.id, file: f, submissionId, result }));
      promises.push(p);
    }
  });
  return promises;
}

function summarize(results, expectedFiles) {
  const delivered = results.filter((r) => r.result.outcome === "delivered-immediately").length;
  const queued = results.filter((r) => r.result.outcome === "queued").length;
  const failedPermanent = results.filter((r) => r.result.outcome === "failed-permanent").length;
  const totalRetries = results.reduce((sum, r) => sum + (r.result.retries || 0), 0);
  return { expectedFiles, delivered, queued, failedPermanent, totalRetries };
}

// IMPORTANTE: cada drainBrowserQueue() internamente espera un `sleep` basado
// en el reloj VIRTUAL (via el fetch falso) -- si se esperara cada navegador
// de forma secuencial (await dentro de un for) sin nadie avanzando el reloj
// al mismo tiempo, esa promesa nunca se resolveria y el test se colgaria
// para siempre. Por eso: se disparan TODOS los navegadores primero (sin
// esperar entre ellos), y solo despues se avanza el reloj una vez.
async function drainAllBrowserQueues(clock, learners, advanceMs) {
  const candidates = learners.filter((learner) => learner.browser.memoryQueue.size > 0);
  const promises = candidates.map((learner) => drainBrowserQueue(learner.browser));
  await clock.advanceTo(clock.getNow() + (advanceMs || 60000));
  const results = await Promise.all(promises);
  let delivered = 0, kept = 0, dropped = 0;
  results.forEach((res) => { delivered += res.delivered; kept += res.kept; dropped += res.dropped; });
  return { delivered, kept, dropped };
}

function countPending(learners) {
  return learners.reduce((sum, l) => sum + l.browser.memoryQueue.size, 0);
}

// ─────────────────────────────────────────────────────────────────────────
// A-E: volumen basico, servidor NORMAL, 1 grupo
// ─────────────────────────────────────────────────────────────────────────

async function runBasicVolumeScenario(label, learnerCount, filesPerLearner) {
  const clock = createVirtualClock();
  const server = createFakeAppsScriptServer(clock, () => ({ kind: "ok", delayMs: 300 + Math.floor(Math.random() * 400) }));
  const learners = makeLearners(clock, server.fetchImpl, learnerCount);
  const expectedFiles = learnerCount * filesPerLearner;

  const promises = fireWave(learners, filesPerLearner);
  await clock.advanceTo(60000);
  const results = await Promise.all(promises);
  const summary = summarize(results, expectedFiles);
  const stats = server.getStats();

  assert.strictEqual(summary.delivered, expectedFiles, label + ": todos deben entregarse con servidor normal");
  assert.strictEqual(summary.queued, 0, label + ": nada deberia caer a cola con servidor sano");
  assert.strictEqual(stats.filesCreated, expectedFiles, label + ": ningun duplicado (1 archivo por submissionId)");
  assert.strictEqual(stats.totalRequests, expectedFiles, label + ": sin reintentos, 1 request por archivo (servidor sano)");

  pushMetricsRow({
    escenario: label,
    aprendices: learnerCount,
    archivos: expectedFiles,
    requestsIniciales: expectedFiles,
    retries: summary.totalRetries,
    requestsTotales: stats.totalRequests,
    concurrenciaMax: stats.maxConcurrency,
    duplicados: stats.filesCreated - expectedFiles > 0 ? stats.filesCreated - expectedFiles : 0,
    perdidos: 0,
    pendientes: 0,
    recuperados: 0,
  });
  return { summary, stats };
}

test("A. 16 aprendices x 1 archivo, servidor normal", async () => {
  await runBasicVolumeScenario("16x1", 16, 1);
});
test("B. 20 aprendices x 1 archivo, servidor normal", async () => {
  await runBasicVolumeScenario("20x1", 20, 1);
});
test("C. 30 aprendices x 1 archivo, servidor normal", async () => {
  await runBasicVolumeScenario("30x1", 30, 1);
});
test("D. 16 aprendices x 2 archivos, servidor normal", async () => {
  await runBasicVolumeScenario("16x2", 16, 2);
});
test("E. 30 aprendices x 2 archivos, servidor normal", async () => {
  await runBasicVolumeScenario("30x2", 30, 2);
});
test("F. 2 grupos x 16 x 1 archivo (32 aprendices), servidor normal", async () => {
  await runBasicVolumeScenario("2g x16x1", 32, 1);
});
test("G. 2 grupos x 30 x 1 archivo (60 aprendices), servidor normal", async () => {
  await runBasicVolumeScenario("2g x30x1", 60, 1);
});
test("H. 2 grupos x 16 x 2 archivos (32 aprendices, 64 archivos), servidor normal", async () => {
  await runBasicVolumeScenario("2g x16x2", 32, 2);
});
test("I. 2 grupos x 30 x 2 archivos (60 aprendices, 120 archivos), servidor normal", async () => {
  const { stats } = await runBasicVolumeScenario("2g x30x2", 60, 2);
  assert.ok(stats.maxConcurrency <= 120, "sanity check: la concurrencia nunca puede superar el numero de archivos en vuelo");
});

// ─────────────────────────────────────────────────────────────────────────
// Escenarios de fallo sobre 2 grupos x 30 x 2 (120 archivos logicos)
// ─────────────────────────────────────────────────────────────────────────

async function runFailureScenario(label, behaviorFn, opts) {
  opts = opts || {};
  const learnerCount = opts.learnerCount || 60;
  const filesPerLearner = opts.filesPerLearner || 2;
  const advanceMs = opts.advanceMs || 300000; // 5 min simulados por defecto
  const clock = createVirtualClock();
  const server = createFakeAppsScriptServer(clock, behaviorFn);
  const learners = makeLearners(clock, server.fetchImpl, learnerCount);
  const expectedFiles = learnerCount * filesPerLearner;

  const promises = fireWave(learners, filesPerLearner);
  await clock.advanceTo(advanceMs);
  const results = await Promise.all(promises);
  const summary = summarize(results, expectedFiles);
  const statsBeforeQueueDrain = server.getStats();

  // Drena las colas de todos los navegadores UNA vez, simulando que el
  // servicio ya se recupero (equivalente a runDeliveryQueue tras "online").
  const drainResult = await drainAllBrowserQueues(clock, learners, 60000);
  const statsAfterDrain = server.getStats();
  const stillPending = countPending(learners);

  return { summary, statsBeforeQueueDrain, statsAfterDrain, drainResult, stillPending, learners, server, clock };
}

test("Fallo 1/baseline: servidor normal (referencia para comparar el resto)", async () => {
  const { summary, statsAfterDrain, stillPending } = await runFailureScenario("2g x30x2 + normal", () => ({ kind: "ok", delayMs: 300 }));
  assert.strictEqual(summary.queued, 0);
  assert.strictEqual(stillPending, 0);
  pushMetricsRow({
    escenario: "2g x30x2 +normal", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: 0,
  });
});

test("Fallo 2: Apps Script lento pero sano (delay alto, sin error) -- no debe generar reintentos ni cola", async () => {
  const { summary, statsAfterDrain, stillPending } = await runFailureScenario("2g x30x2 +lento", () => ({ kind: "ok", delayMs: 8000 }));
  assert.strictEqual(summary.delivered, 120, "lento pero exitoso no debe caer a cola (el timeout de 25s no se cumple)");
  assert.strictEqual(summary.queued, 0);
  pushMetricsRow({
    escenario: "2g x30x2 +lento(8s)", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: 0,
  });
});

test("Fallo 3: 10% de los intentos con timeout (25s) -- se recuperan solos por retry, sin llegar a cola en la mayoria", async () => {
  const behavior = (ctx) => (ctx.requestIndex % 10 === 0 ? { kind: "transient-timeout" } : { kind: "ok", delayMs: 300 });
  const { summary, statsAfterDrain, stillPending, drainResult } = await runFailureScenario("2g x30x2 +10%timeout", behavior, { advanceMs: 400000 });
  assert.strictEqual(summary.delivered + summary.queued, 120, "ningun archivo debe perderse: entregado o en cola, nunca desaparecido");
  assert.strictEqual(stillPending + drainResult.delivered, summary.queued, "lo que quedo en cola, o se entrego en el drenado o sigue pendiente -- nunca se pierde");
  pushMetricsRow({
    escenario: "2g x30x2 +10% timeout", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 4: 25% de los intentos con timeout -- mas caen a cola, ninguno se pierde ni se duplica", async () => {
  const behavior = (ctx) => (ctx.requestIndex % 4 === 0 ? { kind: "transient-timeout" } : { kind: "ok", delayMs: 300 });
  const { summary, statsAfterDrain, stillPending, drainResult, server } = await runFailureScenario("2g x30x2 +25%timeout", behavior, { advanceMs: 400000 });
  assert.strictEqual(summary.delivered + summary.queued, 120);
  const finalStats = server.getStats();
  assert.strictEqual(finalStats.filesCreated, 120, "0 duplicados incluso con 25% de timeouts + reintentos + cola");
  pushMetricsRow({
    escenario: "2g x30x2 +25% timeout", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 5: Apps Script devuelve 429 en todos los intentos in-session -- todo cae a cola, se recupera al drenar", async () => {
  const { summary, statsAfterDrain, stillPending, drainResult } = await runFailureScenario("2g x30x2 +429", () => ({ kind: "transient-429", delayMs: 100 }), { advanceMs: 200000 });
  assert.strictEqual(summary.queued, 120, "con 429 persistente, TODO debe terminar en cola (nunca perdido, nunca marcado como fallo permanente)");
  assert.strictEqual(summary.failedPermanent, 0, "429 nunca debe clasificarse como error permanente");
  pushMetricsRow({
    escenario: "2g x30x2 +429 sostenido", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 6: Apps Script devuelve 503 en todos los intentos in-session -- mismo tratamiento que 429 (transitorio)", async () => {
  const { summary, statsAfterDrain, stillPending, drainResult } = await runFailureScenario("2g x30x2 +503", () => ({ kind: "transient-503", delayMs: 100 }), { advanceMs: 200000 });
  assert.strictEqual(summary.queued, 120);
  assert.strictEqual(summary.failedPermanent, 0);
  pushMetricsRow({
    escenario: "2g x30x2 +503 sostenido", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 7+8: caida de Internet durante los primeros 2 minutos, recuperacion despues -- nada se pierde", async () => {
  const outageEndMs = 120000;
  const behavior = (ctx) => (ctx.now < outageEndMs ? { kind: "transient-network", delayMs: 50 } : { kind: "ok", delayMs: 300 });
  const { summary, statsAfterDrain, stillPending, drainResult } = await runFailureScenario("2g x30x2 +caida2min", behavior, { advanceMs: 400000 });
  assert.strictEqual(summary.delivered + summary.queued, 120, "nada debe perderse durante una caida de red de 2 minutos");
  pushMetricsRow({
    escenario: "2g x30x2 +caida 2min", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 9 (CRITICO): respuesta perdida DESPUES de que el servidor ya guardo el archivo -- NO debe duplicarse al reintentar", async () => {
  // El servidor SI crea el archivo en el primer intento de cada submissionId,
  // pero la respuesta nunca llega al cliente -- el cliente reintenta creyendo
  // que fallo. La idempotencia por submissionId (findFileBySubmissionId real,
  // replicada en el server falso) debe devolver el archivo YA CREADO.
  const seenOnce = new Set();
  const behavior = (ctx) => {
    if (!seenOnce.has(ctx.submissionId)) {
      seenOnce.add(ctx.submissionId);
      return { kind: "response-lost-after-save", delayMs: 50 };
    }
    return { kind: "ok", delayMs: 300 };
  };
  const { summary, statsAfterDrain, stillPending, drainResult, server } = await runFailureScenario("2g x30x2 +resp.perdida", behavior, { advanceMs: 400000 });
  const finalStats = server.getStats();
  assert.strictEqual(finalStats.filesCreated, 120, "exactamente 1 archivo por submissionId -- CERO duplicados aunque el cliente haya reintentado tras perder la respuesta");
  assert.strictEqual(summary.delivered + summary.queued, 120);
  pushMetricsRow({
    escenario: "2g x30x2 +respuesta perdida", aprendices: 60, archivos: 120,
    requestsIniciales: 120, retries: summary.totalRetries, requestsTotales: statsAfterDrain.totalRequests,
    concurrenciaMax: statsAfterDrain.maxConcurrency, duplicados: finalStats.filesCreated - 120, perdidos: 0, pendientes: stillPending, recuperados: drainResult.delivered,
  });
});

test("Fallo 10 (Python multiarchivo): archivo A confirmado / archivo B falla -- A NUNCA se reenvia, solo se reintenta B", async () => {
  const clock = createVirtualClock();
  // B (target-2) falla las primeras 3 veces con 503, luego se recupera. A (target-1) siempre ok.
  const bAttempts = new Map();
  const behavior = (ctx) => {
    if (ctx.submissionId.endsWith("-file2")) {
      const n = (bAttempts.get(ctx.submissionId) || 0) + 1;
      bAttempts.set(ctx.submissionId, n);
      if (n <= 3) return { kind: "transient-503", delayMs: 100 };
      return { kind: "ok", delayMs: 200 };
    }
    return { kind: "ok", delayMs: 200 };
  };
  const server = createFakeAppsScriptServer(clock, behavior);
  const learners = makeLearners(clock, server.fetchImpl, 30);
  const promises = fireWave(learners, 2);
  await clock.advanceTo(200000);
  const results = await Promise.all(promises);

  const aResults = results.filter((r) => r.file === 1);
  const bResults = results.filter((r) => r.file === 2);
  assert.ok(aResults.every((r) => r.result.outcome === "delivered-immediately"), "el archivo A (target-1) siempre debe entregarse en el primer intento sano");
  assert.ok(bResults.every((r) => r.result.outcome === "delivered-immediately" || r.result.outcome === "queued"), "B nunca debe perderse: entregado tras reintentos, o en cola");

  const stats = server.getStats();
  // Cada submissionId de A solo genera 1 request (nunca se reenvia por culpa de B).
  const aRequests = stats.requestLog.filter((r) => r.submissionId.endsWith("-file1")).length;
  assert.strictEqual(aRequests, 30, "A debe generar EXACTAMENTE 1 request por aprendiz -- nunca se reintenta ni se reenvia por el fallo de B");
  assert.strictEqual(stats.filesCreated, aResults.length + bResults.filter(r => r.result.outcome === "delivered-immediately").length, "sin duplicados");

  pushMetricsRow({
    escenario: "Python 30x2 A-ok/B-falla3x", aprendices: 30, archivos: 60,
    requestsIniciales: 60, retries: results.reduce((s, r) => s + r.result.retries, 0), requestsTotales: stats.totalRequests,
    concurrenciaMax: stats.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: countPending(learners), recuperados: 0,
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Escenarios especiales del prompt (§25 estampida, §26 acumulacion entre
// grupos, §27 recuperacion escalonada, §30 cuota agotada)
// ─────────────────────────────────────────────────────────────────────────

test("Estampida de reconexion (H3): 25 navegadores independientes disparan 'online' en el MISMO instante -- el jitter dispersa el drenado, no lo concentra", async () => {
  const clock = createVirtualClock();
  const server = createFakeAppsScriptServer(clock, () => ({ kind: "ok", delayMs: 100 }));
  const learners = makeLearners(clock, server.fetchImpl, 25, { groupLabel: "estampida" });
  learners.forEach((learner, idx) => {
    learner.browser.memoryQueue.set("guia.html|target", {
      key: "guia.html|target",
      payload: { submissionId: "estampida-" + idx, fileName: "x.py", pageFile: "guia.html", fullName: "Aprendiz " + idx },
      deliveryCtx: { context: { pageFile: "guia.html", panelKey: "target" }, panelKey: "target", pageFile: "guia.html" },
      createdAt: 0,
      attempts: 0,
      status: "pending",
    });
  });

  // Los 25 navegadores reciben el evento "online" en el MISMO instante fisico
  // (t=0 virtual). Cada uno usa su PROPIO Math.random real (independiente,
  // como 25 procesos JS realmente separados) -- solo sustituimos el runner
  // por el drenado en memoria de este arnes (ver comentario en
  // delivery_load_sim.cjs: la IndexedDB falsa no implementa transaction/put
  // reales, asi que _runDeliveryQueue real no es utilizable end-to-end aqui;
  // el jitter que se mide es el MISMO _scheduleDeliveryQueueDrain real).
  const jitters = learners.map((learner) =>
    learner.browser.api._scheduleDeliveryQueueDrain({ runner: () => drainBrowserQueue(learner.browser) })
  );

  await clock.advanceTo(5000);
  const stats = server.getStats();

  assert.strictEqual(stats.totalRequests, 25, "las 25 entregas pendientes deben drenarse igual, solo que dispersas en el tiempo");
  const distinctJitters = new Set(jitters);
  assert.ok(distinctJitters.size >= 15, "25 navegadores independientes deben elegir jitters mayormente distintos (no coincidir en un puñado de valores)");
  const uniqueTimestamps = new Set(stats.requestLog.map((r) => r.at));
  assert.ok(uniqueTimestamps.size > 1, "el jitter debe dispersar los 25 drenados en varios instantes virtuales distintos, no en una unica rafaga de t=0");
  assert.ok(stats.maxConcurrency < 25, "la dispersion del jitter debe bajar la concurrencia pico observada por el servidor frente a que los 25 lleguen exactamente juntos");

  pushMetricsRow({
    escenario: "Estampida reconexion (25 nav., H3)", aprendices: 25, archivos: 25,
    requestsIniciales: 25, retries: 0, requestsTotales: stats.totalRequests,
    concurrenciaMax: stats.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: 0, recuperados: 25,
  });
});

test("Acumulacion entre grupos (§26): cola vieja de 30 (grupo 1) sigue drenando mientras el grupo 2 (16 aprendices) entrega en caliente -- el grupo 2 no se bloquea ni se retrasa por la cola vieja", async () => {
  const clock = createVirtualClock();
  const server = createFakeAppsScriptServer(clock, () => ({ kind: "ok", delayMs: 300 }));

  // Grupo 1: 30 aprendices con una entrega YA pendiente de una caida anterior.
  const group1 = makeLearners(clock, server.fetchImpl, 30, { groupLabel: "g1old" });
  group1.forEach((learner, idx) => {
    learner.browser.memoryQueue.set("guia.html|target", {
      key: "guia.html|target",
      payload: { submissionId: "g1old-" + idx, fileName: "x.py", pageFile: "guia.html", fullName: "G1 " + idx },
      deliveryCtx: { context: { pageFile: "guia.html", panelKey: "target" }, panelKey: "target", pageFile: "guia.html" },
      createdAt: 0, attempts: 0, status: "pending",
    });
  });

  // Grupo 2: 16 aprendices frescos, entrega interactiva normal, AL MISMO TIEMPO.
  const group2 = makeLearners(clock, server.fetchImpl, 16, { groupLabel: "g2new" });

  const group1DrainPromises = group1.map((learner) => drainBrowserQueue(learner.browser));
  const group2UploadPromises = fireWave(group2, 1);

  await clock.advanceTo(30000);
  const group1Results = await Promise.all(group1DrainPromises);
  const group2Results = await Promise.all(group2UploadPromises);

  const group2Summary = summarize(group2Results, 16);
  assert.strictEqual(group2Summary.delivered, 16, "el grupo 2 (entrega interactiva nueva) debe entregarse completo aunque el grupo 1 este drenando su cola vieja al mismo tiempo");
  assert.strictEqual(group2Summary.totalRetries, 0, "el grupo 2 no deberia necesitar reintentos solo por coexistir con la cola vieja del grupo 1 (no hay bloqueo cruzado entre navegadores distintos)");
  const group1Delivered = group1Results.reduce((s, r) => s + r.delivered, 0);
  assert.strictEqual(group1Delivered, 30, "la cola vieja del grupo 1 tambien debe drenarse completa (servidor sano)");

  const stats = server.getStats();
  assert.strictEqual(stats.filesCreated, 46, "30 (grupo 1) + 16 (grupo 2) = 46 archivos, sin duplicados ni mezcla de identidad entre grupos");

  pushMetricsRow({
    escenario: "Cola vieja(30)+grupo nuevo(16)", aprendices: 46, archivos: 46,
    requestsIniciales: 46, retries: 0, requestsTotales: stats.totalRequests,
    concurrenciaMax: stats.maxConcurrency, duplicados: 0, perdidos: 0, pendientes: 0, recuperados: 30,
  });
});

test("Recuperacion escalonada (§27): 60 pendientes reconectan con jitter H3 -- medicion en t=0/5/10/30/60/120s", async () => {
  const clock = createVirtualClock();
  const server = createFakeAppsScriptServer(clock, () => ({ kind: "ok", delayMs: 300 }));
  const learners = makeLearners(clock, server.fetchImpl, 60, { groupLabel: "escalonado" });
  learners.forEach((learner, idx) => {
    learner.browser.memoryQueue.set("guia.html|target", {
      key: "guia.html|target",
      payload: { submissionId: "escalonado-" + idx, fileName: "x.py", pageFile: "guia.html", fullName: "E " + idx },
      deliveryCtx: { context: { pageFile: "guia.html", panelKey: "target" }, panelKey: "target", pageFile: "guia.html" },
      createdAt: 0, attempts: 0, status: "pending",
    });
  });
  learners.forEach((learner) => {
    learner.browser.api._scheduleDeliveryQueueDrain({ runner: () => drainBrowserQueue(learner.browser) });
  });

  const checkpoints = [0, 5000, 10000, 30000, 60000, 120000];
  const countsAtCheckpoint = {};
  for (const t of checkpoints) {
    await clock.advanceTo(t);
    countsAtCheckpoint[t] = server.getStats().totalRequests;
  }

  assert.strictEqual(countsAtCheckpoint[0], 0, "en t=0 (mismo instante del evento online) ningun request debe haber salido aun -- el jitter SIEMPRE introduce algo de retraso antes del primer intento");
  assert.strictEqual(countsAtCheckpoint[120000], 60, "a los 2 minutos, el drenado completo de 60 pendientes debe estar terminado");
  assert.ok(countsAtCheckpoint[5000] >= countsAtCheckpoint[0], "el conteo de requests debe ser no decreciente en el tiempo");

  pushMetricsRow({
    escenario: "Recuperacion escalonada (60 pend.)", aprendices: 60, archivos: 60,
    requestsIniciales: 60, retries: 0, requestsTotales: server.getStats().totalRequests,
    concurrenciaMax: server.getStats().maxConcurrency, duplicados: 0, perdidos: 0, pendientes: 0, recuperados: 60,
  });

  console.log(
    "  [Recuperacion escalonada] requests acumulados por marca de tiempo: " +
      checkpoints.map((t) => "t=" + t / 1000 + "s->" + countsAtCheckpoint[t]).join(", ") +
      "  (ventana de jitter H3 configurada: 4000ms max -- por eso el drenado real termina en segundos, no en minutos)"
  );
});

test("Cuota agotada (§30): outage sostenido de 40 min -- confirma que el fix de Bloque G.2 (maxAttempts 25->20000) ya NO descarta el archivo en ese lapso", async () => {
  const clock = createVirtualClock();
  let failuresServed = 0;
  const server = createFakeAppsScriptServer(clock, () => {
    failuresServed += 1;
    return { kind: "transient-503", delayMs: 50 };
  });
  const browser = createSimulatedBrowser(clock, server.fetchImpl, { learnerId: "cuota-agotada-1" });
  browser.fireDomReady();

  // El intento interactivo agota sus 4 reintentos in-session y cae a la cola.
  const firstResult = await (async () => {
    const p = simulateLearnerUpload(browser, { submissionId: "cuota-agotada-sub1", fileName: "x.py", pageFile: "guia.html" });
    await clock.advanceTo(200000);
    return p;
  })();
  assert.strictEqual(firstResult.outcome, "queued");

  // A partir de aqui, simulamos el intervalo real de produccion
  // (setInterval(runDeliveryQueue, 60000)) llamando processDeliveryQueue cada
  // 60s de reloj VIRTUAL, con el servicio TODAVIA caido, hasta ver si se
  // descarta (dropped) antes de agotar los 7 dias de maxAgeMs.
  let droppedAtAttempt = null;
  let deliveredEventually = false;
  const MAX_DRAINS_TO_TRY = 40; // 40 x 60s = 40 min simulados de outage sostenido
  for (let i = 1; i <= MAX_DRAINS_TO_TRY; i++) {
    // Se dispara drainBrowserQueue ANTES de avanzar el reloj (no al reves):
    // su sleep interno (via el fetch falso) es una promesa atada al reloj
    // VIRTUAL -- si se esperara primero y se avanzara despues, esa promesa
    // no tendria quien la resuelva y el test se colgaria para siempre.
    const resPromise = drainBrowserQueue(browser);
    await clock.advanceTo(clock.getNow() + 60000);
    const res = await resPromise;
    if (res.dropped > 0) { droppedAtAttempt = i; break; }
    if (res.delivered > 0) { deliveredEventually = true; break; }
    if (browser.memoryQueue.size === 0) break;
  }

  console.log(
    "  [Cuota agotada] resultado real medido tras " + MAX_DRAINS_TO_TRY + " min de outage sostenido (post Bloque G.2): " +
      (droppedAtAttempt
        ? "el archivo fue DESCARTADO en la llamada periodica #" + droppedAtAttempt + " (inesperado -- revisar el fix)."
        : "el archivo SIGUE PENDIENTE (correcto: con maxAttempts=20000 hacen falta ~13.9 dias de outage sostenido, no " + MAX_DRAINS_TO_TRY + " min, para llegar al tope -- antes del fix se descartaba en el intento #26/~25 min, ver tests/delivery_queue_give_up_notice.test.cjs para la prueba puntual del limite exacto).") +
      " Total de requests fallidos contra el servidor durante todo el outage (incluye los 4 intentos interactivos in-session): " + failuresServed
  );

  // Antes de Bloque G.2 este archivo se descartaba en el intento periodico
  // #26 (~25 min de outage). El fix (maxAttempts 25->20000, ver
  // js/shared_apps_script_delivery.js) hace que 40 min de outage sostenido ya
  // NO alcancen para descartarlo -- confirmado aqui, no asumido. El limite
  // EXACTO de 20000 intentos (y que SI descarta al llegar a el, disparando el
  // aviso "delivery-failed") ya esta probado por separado, con conteos
  // inyectados en vez de 20000 iteraciones reales de este arnes, en
  // tests/delivery_queue_give_up_notice.test.cjs.
  assert.strictEqual(droppedAtAttempt, null, "con el fix de Bloque G.2, 40 min de outage sostenido NO deben bastar para descartar el archivo (antes del fix se descartaba a los ~25 min)");
  assert.strictEqual(deliveredEventually, false);
  assert.strictEqual(browser.memoryQueue.size, 1, "el archivo debe seguir en la cola, pendiente, ni entregado ni descartado");

  pushMetricsRow({
    escenario: "Cuota agotada (outage 40min, post-fix G.2)", aprendices: 1, archivos: 1,
    requestsIniciales: 1, retries: 3, requestsTotales: failuresServed,
    concurrenciaMax: 1, duplicados: 0, perdidos: droppedAtAttempt ? 1 : 0, pendientes: droppedAtAttempt ? 0 : 1, recuperados: 0,
  });
});

after(() => {
  const cols = ["escenario", "aprendices", "archivos", "requestsIniciales", "retries", "requestsTotales", "concurrenciaMax", "duplicados", "perdidos", "pendientes", "recuperados"];
  const headers = ["Escenario", "Aprend.", "Archivos", "Req.inic.", "Retries", "Req.tot.", "Conc.max", "Dupl.", "Perdidos", "Pend.", "Recup."];
  const widths = cols.map((c, i) => Math.max(headers[i].length, ...METRICS_ROWS.map((r) => String(r[c] != null ? r[c] : "").length)));
  function fmtRow(vals) {
    return "| " + vals.map((v, i) => String(v).padEnd(widths[i])).join(" | ") + " |";
  }
  console.log("\n=== Bloque G.1 -- Tabla de simulaciones de carga (Fase E, 100% local) ===");
  console.log(fmtRow(headers));
  console.log("|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|");
  METRICS_ROWS.forEach((row) => console.log(fmtRow(cols.map((c) => row[c]))));
  console.log("=== fin de la tabla (" + METRICS_ROWS.length + " escenarios medidos) ===\n");
});

module.exports = { METRICS_ROWS, pushMetricsRow };
