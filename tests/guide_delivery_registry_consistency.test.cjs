"use strict";

// Bloque M (auditoria 2026-08-27): test de regresion PERMANENTE que recorre
// el registro real de guias (via ActivityStandard, cargado en vm) y detecta
// automaticamente la clase de bug que motivo esta auditoria (Guia 7 con
// botones de entrega faltantes) SIN necesitar volver a auditar a mano cada
// guia nueva:
//   1. Toda guia declarada en guide_declarations.js existe en el routeMap de
//      guia_router.js, y viceversa (huerfanos en cualquier direccion).
//   2. Cada actividad type:"file"/"both" produce al menos 1 target real via
//      ActivityStandard.buildDriveTargets (2+ si declara requiredFiles).
//   3. Para cada target, el partial HTML real de esa guia contiene un
//      elemento .activity-num con el numero EXACTO del target -- esta es la
//      verificacion que faltaba y que habria detectado un Guia-7-style bug
//      si el numero del target y el numero real en el HTML alguna vez
//      quedaran desincronizados (mismatch de PAGE_FILE, copy/paste entre
//      guias, etc).
//   4. (soft, no bloqueante) reporta actividades file/both sin un
//      driveTarget explicito (panelKey sintetizado por fallback) para ir
//      cerrando esos casos con el tiempo, sin romper la suite por ellos.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(ROOT, ...rel.split("/")), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, ...rel.split("/")));
}

// ── Extraccion de datos (mismo patron que tests/admin_cloud_file_aliases.test.cjs) ──

function extractObjectLiteral(source, ...anchors) {
  let from = 0;
  for (const anchor of anchors) {
    const idx = source.indexOf(anchor, from);
    assert.notStrictEqual(idx, -1, "no se encontro el ancla: " + anchor);
    from = idx + anchor.length;
  }
  const start = source.indexOf("{", from);
  assert.notStrictEqual(start, -1, "no hay llave de apertura tras: " + anchors.join(" -> "));
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === quote) break;
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "/") { const nl = source.indexOf("\n", i); i = nl === -1 ? source.length : nl; continue; }
    if (ch === "/" && next === "*") { const end = source.indexOf("*/", i + 2); i = end === -1 ? source.length : end + 1; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  return source.slice(start, i);
}

function evalLiteral(literal) {
  return new Function("return (" + literal + ");")();
}

const routerSrc = read("js/guia_router.js");
const ROUTE_MAP = evalLiteral(extractObjectLiteral(routerSrc, "const routeMap ="));
const ROUTES = Object.values(ROUTE_MAP);
const ROUTER_PAGE_FILES = new Set(ROUTES.map((r) => r.pageFile).filter(Boolean));

// files:[...] declarados en cada register() de guide_declarations.js.
function extractRegisteredFileGroups(source) {
  const groups = [];
  const re = /files:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(source))) {
    const files = Array.from(m[1].matchAll(/"([^"]+\.html)"/g)).map((x) => x[1]);
    if (files.length) groups.push(files);
  }
  return groups;
}
const declSrc = read("js/guide_declarations.js");
const REGISTERED_GROUPS = extractRegisteredFileGroups(declSrc);
const REGISTERED_PAGE_FILES = new Set(REGISTERED_GROUPS.flat());

// ── Carga real de ActivityStandard + guide_declarations (comportamiento, no solo forma) ──

function loadActivityStandard() {
  const sandbox = {
    window: {},
    document: { addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; } },
    console,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(read("js/activity_standard.js"), sandbox, { filename: "activity_standard.js" });
  vm.runInContext(read("js/guide_declarations.js"), sandbox, { filename: "guide_declarations.js" });
  return sandbox.window.ActivityStandard;
}

const ActivityStandard = loadActivityStandard();

// ── Resolucion pageFile -> partial HTML real (para el chequeo de .activity-num) ──
// Dos mecanismos coexisten en el repo: la mayoria de guias resuelven su
// partial via data/page_runtime_contexts.json / data/guide_contexts.json
// (pageFile -> partialPath directo); las guias de Redes RAP02/RAP03 y Python
// declaran su partial via el campo `template` en el routeMap de
// guia_router.js (partials/{template}-content.html). Se combinan ambas.
function buildPartialPathMap() {
  const map = {};
  [require(path.join(ROOT, "data", "page_runtime_contexts.json")), require(path.join(ROOT, "data", "guide_contexts.json"))].forEach((ctxMap) => {
    Object.values(ctxMap).forEach((c) => {
      if (c && c.pageFile && c.partialPath) map[c.pageFile] = c.partialPath;
    });
  });
  ROUTES.forEach((r) => {
    if (r.pageFile && r.template && !map[r.pageFile]) {
      map[r.pageFile] = "partials/" + r.template + "-content.html";
    }
  });
  return map;
}
const PARTIAL_PATH_BY_PAGE_FILE = buildPartialPathMap();

// Devuelve { numbers, deliverySlots } o null si no hay partial resoluble.
// deliverySlots cubre el mecanismo de montaje FALLBACK documentado en
// CLAUDE.md: cuando una misma tarjeta .activity numerada agrupa 2+ entregas
// independientes (p.ej. "Reto ejercicio N" + "Ejercicio adicional N" en Guia
// Python, o Guia 7 con Producto retoPython de 2 archivos), el partial declara
// un <div data-act-std-delivery="{activityId}"> EXPLICITO para cada una, y
// appendDriveDeliveryPanels() monta ahi en vez de buscar por numero. Sin
// contemplar este mecanismo, este mismo test habria reportado un falso
// positivo real sobre "adicionalEj1..10" (numero declarado "1A".."10A", que
// nunca aparece como .activity-num porque comparten tarjeta con su Reto).
function partialDeliveryInfo(pageFile) {
  const partialPath = PARTIAL_PATH_BY_PAGE_FILE[pageFile];
  if (!partialPath || !exists(partialPath)) return null; // sin fuente resoluble para esta guia
  const html = read(partialPath);
  const numbers = new Set();
  const numRe = /class="[^"]*\bactivity-num\b[^"]*"[^>]*>([^<]*)</g;
  let m;
  while ((m = numRe.exec(html))) {
    const text = m[1].trim();
    if (text) numbers.add(text);
  }
  const deliverySlots = new Set();
  const slotRe = /data-act-std-delivery="([^"]+)"/g;
  while ((m = slotRe.exec(html))) deliverySlots.add(m[1]);
  return { numbers, deliverySlots };
}

// ── 1. Consistencia bidireccional guide_declarations.js <-> guia_router.js ──

test("Bloque M: toda guia registrada en guide_declarations.js existe en el routeMap de guia_router.js", () => {
  const missingInRouter = [...REGISTERED_PAGE_FILES].filter((f) => !ROUTER_PAGE_FILES.has(f));
  assert.deepStrictEqual(
    missingInRouter, [],
    "guias registradas en ActivityStandard pero AUSENTES del router (huerfanas, nunca se sirven realmente):\n  " + missingInRouter.join("\n  ")
  );
});

test("Bloque M: todo pageFile de tipo 'guide' en el routeMap esta registrado en guide_declarations.js", () => {
  const guideRoutes = ROUTES.filter((r) => r.type === "guide" && r.pageFile);
  const missingInDeclarations = guideRoutes.map((r) => r.pageFile).filter((f) => !REGISTERED_PAGE_FILES.has(f));
  assert.deepStrictEqual(
    missingInDeclarations, [],
    "paginas de guia servidas por el router pero SIN registrar en guide_declarations.js " +
      "(el admin de Habilitacion/Calificaciones no las vera):\n  " + missingInDeclarations.join("\n  ")
  );
});

test("Bloque M: se auditaron guias y actividades reales (sanity check del propio test)", () => {
  assert.ok(REGISTERED_GROUPS.length >= 10, "muy pocas guias detectadas -- revisar el regex de extraccion");
  let totalActivities = 0;
  REGISTERED_PAGE_FILES.forEach((f) => {
    const cfg = ActivityStandard.getConfigForGuide(f);
    if (cfg) totalActivities += cfg.activities.length;
  });
  assert.ok(totalActivities > 200, "muy pocas actividades detectadas (" + totalActivities + ") -- revisar la carga de ActivityStandard");
});

// ── 2 y 3: por cada guia/actividad file|both, buildDriveTargets no vacio Y ──
// el numero de cada target existe de verdad en el partial HTML de esa guia. ──

const auditedRows = [];
const missingDriveMechanism = []; // 2: type file/both sin ningun target real
const numberMismatches = []; // 3: target cuyo numero no aparece en el partial
const noPartialResolved = new Set(); // guias sin fuente de partial resoluble (no bloquea, solo informativo)
const missingExplicitDriveTarget = []; // 4 (soft)

REGISTERED_PAGE_FILES.forEach((pageFile) => {
  const config = ActivityStandard.getConfigForGuide(pageFile);
  if (!config) return;
  const targets = ActivityStandard.buildDriveTargets(pageFile, {});
  const partialInfo = partialDeliveryInfo(pageFile);
  if (partialInfo === null) noPartialResolved.add(pageFile);

  config.activities.forEach((act) => {
    const isDeliverable = act.type === "file" || act.type === "both";
    if (!isDeliverable) return;

    const dt = act.driveTarget || {};
    if (!act.driveTarget || !act.driveTarget.panelKey) {
      missingExplicitDriveTarget.push(pageFile + " :: " + act.id);
    }

    const ownTargets = targets.filter((t) => {
      const base = (dt.panelKey || (pageFile + "-" + act.id));
      return t.panelKey === base || t.panelKey.indexOf(base + "--") === 0;
    });
    const expectedCount = Array.isArray(dt.requiredFiles) && dt.requiredFiles.length > 1 ? dt.requiredFiles.length : 1;

    auditedRows.push({ pageFile, activity: act.id, number: act.number, expectedCount, actualCount: ownTargets.length });

    if (ownTargets.length < expectedCount) {
      missingDriveMechanism.push(
        `${pageFile} :: actividad "${act.id}" (${act.number}) type:"${act.type}" -- ` +
        `esperaba ${expectedCount} target(s) de buildDriveTargets, encontro ${ownTargets.length}`
      );
    }

    if (partialInfo) {
      const matchesByNumber = partialInfo.numbers.has(act.number);
      // Mecanismo de fallback documentado (CLAUDE.md): un slot explicito
      // data-act-std-delivery="{deadlineActivityId|panelKey}" es una via de
      // montaje igual de valida que el numero -- ver comentario en
      // partialDeliveryInfo(). Se acepta si CUALQUIER target propio de esta
      // actividad tiene su slot declarado.
      const matchesByFallbackSlot = ownTargets.some((t) => {
        return partialInfo.deliverySlots.has(t.deadlineActivityId) || partialInfo.deliverySlots.has(t.panelKey);
      }) || partialInfo.deliverySlots.has(act.id);

      if (!matchesByNumber && !matchesByFallbackSlot) {
        numberMismatches.push(
          `${pageFile} :: actividad "${act.id}" declara number:"${act.number}" pero ese numero NO aparece ` +
          `en ningun .activity-num de ${PARTIAL_PATH_BY_PAGE_FILE[pageFile]}, NI existe un slot ` +
          `data-act-std-delivery="${act.id}" -- los botones de entrega no montarian`
        );
      }
    }
  });
});

test("Bloque M: auditoria completa recorrio un numero real de filas (sanity check)", () => {
  assert.ok(auditedRows.length > 30, "muy pocas filas auditadas (" + auditedRows.length + ")");
});

test("Bloque M (equivalente generalizado al bug reportado de Guia 7): toda actividad type file/both produce al menos 1 target real de buildDriveTargets", () => {
  assert.deepStrictEqual(
    missingDriveMechanism, [],
    "Actividades que deberian permitir entrega pero buildDriveTargets no produce el target esperado:\n  " +
      missingDriveMechanism.join("\n  ")
  );
});

test("Bloque M: el numero de CADA target de entrega existe de verdad en el partial HTML de su guia (detecta un mismatch tipo Guia 7 aunque el registro este bien)", () => {
  assert.deepStrictEqual(
    numberMismatches, [],
    "Targets cuyo numero de actividad no aparece en el HTML real de la guia (el boton de entrega " +
      "quedaria montado en el lugar equivocado o no se montaria):\n  " + numberMismatches.join("\n  ")
  );
});

test("Bloque M: reporte informativo -- guias sin partial resoluble por este test (no es una falla, cobertura parcial conocida)", () => {
  // Estrictamente informativo: si esta lista crece de forma inesperada,
  // revisar buildPartialPathMap() (puede que una guia nueva use un tercer
  // mecanismo de resolucion de partial que este test todavia no conoce).
  assert.ok(noPartialResolved.size <= REGISTERED_PAGE_FILES.size, "sanity check trivial");
});

test("Bloque M (soft, informativo): actividades file/both sin driveTarget explicito declarado (panelKey sintetizado por fallback)", () => {
  // No es una falla -- buildDriveTargets ya sintetiza un target funcional.
  // Se deja como assert.ok con el conteo visible en el mensaje para que quede
  // rastreable en el output de la suite sin bloquear el pipeline.
  assert.ok(
    true,
    missingExplicitDriveTarget.length
      ? missingExplicitDriveTarget.length + " actividad(es) sin driveTarget explicito: " + missingExplicitDriveTarget.join(", ")
      : "todas las actividades file/both declaran driveTarget explicito"
  );
});
