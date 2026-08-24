const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// renderCallouts()/isSignaturePending() son funciones privadas del IIFE de
// portal_home.js (a proposito -- solo refreshPortalHome se expone en
// produccion). Se inserta una exposicion extra SOLO en esta copia de prueba,
// igual que en tests/portal_home_pending_activities.test.cjs.
function makeEl() {
  const el = { hidden: false, _html: "" };
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = v; },
  });
  return el;
}

const GUIDE2_FILE = "grupo-10a-guia-02-herramientas-informaticas-digitales.html";

function loadPortalHome(opts) {
  const calloutsBox = makeEl();
  const syncStatusBox = makeEl();
  const localStorageData = {};
  // Etapa Productiva (jul-15): los documentos base sin entregar generan su
  // propio aviso. Aqui se siembran como entregados por defecto para que los
  // tests de firma / "No aprobado" sigan probando SOLO su caso; el aviso de
  // documentos se prueba aparte con keepProductiveDocsPending.
  if (!(opts && opts.keepProductiveDocsPending)) {
    ["etapa_doc_ficha_inscripcion", "etapa_doc_acuerdo_etapa_productiva"].forEach((segment) => {
      localStorageData[
        `sena_portal:student:prueba.aprendiz:guide-data:etapa-productiva-estudiante:delivery:${segment}`
      ] = JSON.stringify({ status: "delivered" });
    });
  }
  const ctx = {
    console,
    localStorage: {
      getItem: (key) => (key in localStorageData ? localStorageData[key] : null),
      setItem: (key, value) => { localStorageData[key] = String(value); },
      removeItem: (key) => { delete localStorageData[key]; },
    },
    document: {
      getElementById: (id) => {
        if (id === "student-callouts") return calloutsBox;
        if (id === "sync-status") return syncStatusBox;
        return null;
      },
      querySelectorAll: () => [],
      addEventListener() {},
    },
    window: {},
    URL,
    Date,
  };
  ctx.window.portalAuth = {
    getCurrentSession: () => null,
    getStudentStorageKey: (usernameKey, key, opts) => `sena_portal:student:${usernameKey}:${(opts && opts.area) || "app"}:${key}`,
    getGuideHref: (file) => `guia.html?g=${encodeURIComponent(file)}`,
  };
  ctx.window._firebaseDb = {};
  if (opts && opts.studentSummary) {
    ctx.window.studentSummary = opts.studentSummary;
  }
  vm.createContext(ctx);

  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_standard.js"), "utf8"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "guide_declarations.js"), "utf8"), ctx, { filename: "guide_declarations.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx, { filename: "activity_grades.js" });

  let code = fs.readFileSync(path.join(root, "js", "portal_home.js"), "utf8");
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE de portal_home.js para exponer renderCallouts en la prueba");
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.renderCallouts = renderCallouts;\n})();");
  vm.runInContext(code, ctx, { filename: "portal_home.js" });

  ctx.__calloutsBox = calloutsBox;
  ctx.__syncStatusBox = syncStatusBox;
  ctx.__localStorageData = localStorageData;
  return ctx;
}

test("renderCallouts: sin firma pendiente y sin cloudGetSignatureAuth -> caja oculta", async () => {
  const ctx = loadPortalHome();
  // window._firebaseDb = {} (sin cloudGetSignatureAuth): isSignaturePending
  // debe devolver false en vez de reventar.
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, true, "sin forma de confirmar la firma, no debe mostrar un aviso incierto");
});

test("renderCallouts: firma ya enviada (status delivered) -> caja oculta", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => ({ status: "delivered", submittedAt: "2026-07-01T00:00:00.000Z" });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, true, "si ya envio la firma, no debe mostrar el aviso");
});

test("renderCallouts: firma sin enviar (sin registro) -> muestra el aviso con enlace a la pagina de firma", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => null;

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, false, "sin registro de firma, debe mostrar el aviso");
  assert.match(ctx.__calloutsBox.innerHTML, /firma/i);
  assert.match(ctx.__calloutsBox.innerHTML, /autorizacion-firma\.html/);
});

test("renderCallouts: si cloudGetSignatureAuth revienta -> no muestra un aviso incierto (no revienta la pagina)", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => { throw new Error("Firestore no disponible"); };

  await assert.doesNotReject(async () => {
    await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  });
  assert.equal(ctx.__calloutsBox.hidden, true, "si la lectura falla, mejor no mostrar un aviso que podria ser incorrecto");
});

test("renderCallouts: documentos base de Etapa Productiva sin entregar -> aviso con enlace", async () => {
  const ctx = loadPortalHome({ keepProductiveDocsPending: true });
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => ({ status: "delivered" });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, false, "con documentos base sin registrar, debe mostrar el aviso");
  assert.match(ctx.__calloutsBox.innerHTML, /Etapa Productiva/);
  assert.match(ctx.__calloutsBox.innerHTML, /Ficha de inscripción/);
  assert.match(ctx.__calloutsBox.innerHTML, /Acuerdo de Etapa Productiva/);
  assert.match(ctx.__calloutsBox.innerHTML, /etapa-productiva-estudiante\.html/);
});

// ── "No aprobado" en el home (pedido explicito del usuario 2026-07-09,
//    justo despues de agregar los motivos predeterminados en Calificaciones) ──
test("renderCallouts: actividad calificada 'D' (cache local) -> aparece en el aviso con su motivo", async () => {
  const ctx = loadPortalHome();
  const gradesKey = "sena_portal:student:prueba.aprendiz:app:grades";
  ctx.__localStorageData[gradesKey] = JSON.stringify({
    "guia-02-herramientas": {
      extensiones331: "D",
      "extensiones331:obs": "No entregó la actividad en los tiempos establecidos.",
    },
  });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, [GUIDE2_FILE]);

  assert.equal(ctx.__calloutsBox.hidden, false, "una actividad D debe mostrar el aviso");
  assert.match(ctx.__calloutsBox.innerHTML, /Extensiones de archivo/i, "debe incluir el nombre de la actividad no aprobada");
  assert.match(ctx.__calloutsBox.innerHTML, /No entregó la actividad en los tiempos establecidos/);
  assert.match(ctx.__calloutsBox.innerHTML, new RegExp(GUIDE2_FILE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "debe enlazar a la guia real");
});

test("renderCallouts: actividad calificada 'D' SIN motivo elegido -> igual aparece, sin texto de motivo extra", async () => {
  const ctx = loadPortalHome();
  const gradesKey = "sena_portal:student:prueba.aprendiz:app:grades";
  ctx.__localStorageData[gradesKey] = JSON.stringify({
    "guia-02-herramientas": { extensiones331: "D" },
  });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, [GUIDE2_FILE]);

  assert.equal(ctx.__calloutsBox.hidden, false);
  assert.match(ctx.__calloutsBox.innerHTML, /no aprobada/i);
});

test("renderCallouts: sin ninguna 'D' -> no aparece nada por ese lado (aunque la guia tenga cache de notas)", async () => {
  const ctx = loadPortalHome();
  const gradesKey = "sena_portal:student:prueba.aprendiz:app:grades";
  ctx.__localStorageData[gradesKey] = JSON.stringify({
    "guia-02-herramientas": { extensiones331: "A" },
  });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, [GUIDE2_FILE]);

  assert.equal(ctx.__calloutsBox.hidden, true, "solo A (Aprobado), no debe mostrar ningun aviso de 'no aprobada'");
});

// ── Talleres de Refuerzo (aviso en el Home -> pagina auxiliar dedicada) ───────
test("renderCallouts: sin cloudGetReinforcementWorkshops -> caja oculta (no revienta)", async () => {
  const ctx = loadPortalHome();
  // window._firebaseDb = {} (sin cloudGetReinforcementWorkshops): debe devolver
  // false en vez de reventar, igual que isSignaturePending.
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, true);
});

test("renderCallouts: talleres solo cerrados (superado/no superado) -> caja oculta", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetReinforcementWorkshops = async () => ([
    { id: "t1", workshopKey: "guia-01-induccion", resultado: "A" },
    { id: "t2", workshopKey: "guia-01-induccion", resultado: "D" },
  ]);

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, true, "sin ningun taller abierto, no debe mostrar el aviso");
});

test("renderCallouts: un taller sin cerrar (asignado o vencido) -> muestra el aviso con enlace a la pagina de talleres", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetReinforcementWorkshops = async () => ([
    { id: "t1", workshopKey: "guia-01-induccion", resultado: "" },
  ]);

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, false, "con un taller sin cerrar, debe mostrar el aviso");
  assert.match(ctx.__calloutsBox.innerHTML, /Taller de Refuerzo/);
  assert.match(ctx.__calloutsBox.innerHTML, /talleres-refuerzo\.html/);
});

test("renderCallouts: si cloudGetReinforcementWorkshops revienta -> no muestra un aviso incierto (no revienta la pagina)", async () => {
  const ctx = loadPortalHome();
  ctx.window._firebaseDb.cloudGetReinforcementWorkshops = async () => { throw new Error("Firestore no disponible"); };

  await assert.doesNotReject(async () => {
    await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  });
  assert.equal(ctx.__calloutsBox.hidden, true, "si la lectura falla, mejor no mostrar un aviso que podria ser incorrecto");
});

// ── Fase 11: resumen remoto (window.studentSummary) tiene prioridad sobre
//    las lecturas/caches ad-hoc de arriba cuando esta disponible ───────────
test("renderCallouts: con resumen remoto disponible, usa sus campos SIN llamar los fallback ad-hoc", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: {
          signaturePending: true,
          reinforcementPendingCount: 0,
          productiveDocsPending: [],
          rejectedActivities: [],
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  });
  // A proposito NO se define cloudGetSignatureAuth en _firebaseDb: si el
  // codigo cayera al fallback ad-hoc en vez de usar el resumen, isSignature
  // Pending devolveria false (sin forma de confirmar) y el aviso NO saldria.
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, false, "el resumen dice signaturePending=true, debe mostrar el aviso");
  assert.match(ctx.__calloutsBox.innerHTML, /firma/i);
});

test("renderCallouts: el resumen remoto puede SUPRIMIR un aviso que el fallback ad-hoc si mostraria", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: {
          signaturePending: false,
          reinforcementPendingCount: 0,
          productiveDocsPending: [],
          rejectedActivities: [],
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  });
  // Si cayera al fallback, esta lectura ad-hoc SI mostraria el aviso de firma
  // (registro ausente); el resumen manda y dice que no hace falta.
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => null;

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, true, "el resumen remoto dice que no hay nada pendiente, no debe mostrar avisos");
});

test("renderCallouts: actividad 'no aprobada' del resumen remoto se enlaza a la guia real de su family", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: {
          signaturePending: false,
          reinforcementPendingCount: 0,
          productiveDocsPending: [],
          rejectedActivities: [{
            family: "guia-02-herramientas",
            activityLabel: "Guía 2: Extensiones de archivo",
            reason: "Revisar evidencia",
          }],
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, [GUIDE2_FILE]);

  assert.equal(ctx.__calloutsBox.hidden, false);
  assert.match(ctx.__calloutsBox.innerHTML, /Extensiones de archivo/);
  assert.match(ctx.__calloutsBox.innerHTML, /Revisar evidencia/);
  assert.match(ctx.__calloutsBox.innerHTML, new RegExp(GUIDE2_FILE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("renderCallouts: documentos de Etapa Productiva pendientes del resumen remoto se listan tal cual", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: {
          signaturePending: false,
          reinforcementPendingCount: 0,
          productiveDocsPending: ["Ficha de inscripción"],
          rejectedActivities: [],
          updatedAt: new Date().toISOString(),
        },
      }),
    },
  });

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.equal(ctx.__calloutsBox.hidden, false);
  assert.match(ctx.__calloutsBox.innerHTML, /Ficha de inscripción/);
  assert.match(ctx.__calloutsBox.innerHTML, /etapa-productiva-estudiante\.html/);
});

test("renderCallouts: si loadForHome revienta, cae al comportamiento local de siempre (no rompe el Home)", async () => {
  const ctx = loadPortalHome({
    studentSummary: { loadForHome: async () => { throw new Error("fallo inesperado"); } },
  });
  ctx.window._firebaseDb.cloudGetSignatureAuth = async () => null; // sin registro -> pendiente

  await assert.doesNotReject(async () => {
    await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  });
  assert.equal(ctx.__calloutsBox.hidden, false, "debe caer al fallback ad-hoc y mostrar el aviso de firma");
});

// ── Fase 11: indicador de sincronizacion ────────────────────────────────────
test("sync-status: sin modulo de resumen -> queda vacio (no rompe paginas viejas sin el elemento nuevo en mente)", async () => {
  const ctx = loadPortalHome();
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  assert.equal(ctx.__syncStatusBox.textContent, "");
});

test("sync-status: con resumen fresco -> 'Todo sincronizado'", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: { signaturePending: false, reinforcementPendingCount: 0, productiveDocsPending: [], rejectedActivities: [], updatedAt: new Date().toISOString() },
      }),
    },
  });
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  assert.match(ctx.__syncStatusBox.textContent, /Todo sincronizado/);
});

test("sync-status: con resumen viejo (stale) -> 'Última sincronización'", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: true,
        source: "local-mirror",
        summary: { signaturePending: false, reinforcementPendingCount: 0, productiveDocsPending: [], rejectedActivities: [], updatedAt: new Date(Date.now() - 3600000).toISOString() },
      }),
    },
  });
  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);
  assert.match(ctx.__syncStatusBox.textContent, /Última sincronización/);
});

test("sync-status: con escrituras locales pendientes de promocion (Fase 10) -> avisa aunque el resumen este ok", async () => {
  const ctx = loadPortalHome({
    studentSummary: {
      loadForHome: async () => ({
        stale: false,
        source: "remote",
        summary: { signaturePending: false, reinforcementPendingCount: 0, productiveDocsPending: [], rejectedActivities: [], updatedAt: new Date().toISOString() },
      }),
    },
  });
  ctx.window._firebaseDb.readPendingPromotions = () => ([
    { collection: "sena_portal_progress", docId: "prueba.aprendiz", type: "set" },
  ]);

  await ctx.window.renderCallouts({ usernameKey: "prueba.aprendiz" }, []);

  assert.match(ctx.__syncStatusBox.textContent, /pendientes de sincronizar/);
});
