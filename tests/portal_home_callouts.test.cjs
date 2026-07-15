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
      getElementById: (id) => (id === "student-callouts" ? calloutsBox : null),
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
  vm.createContext(ctx);

  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_standard.js"), "utf8"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "guide_declarations.js"), "utf8"), ctx, { filename: "guide_declarations.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8"), ctx, { filename: "activity_grades.js" });

  let code = fs.readFileSync(path.join(root, "js", "portal_home.js"), "utf8");
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE de portal_home.js para exponer renderCallouts en la prueba");
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.renderCallouts = renderCallouts;\n})();");
  vm.runInContext(code, ctx, { filename: "portal_home.js" });

  ctx.__calloutsBox = calloutsBox;
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
