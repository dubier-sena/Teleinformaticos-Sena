"use strict";

// Bloque G.2 (auditoria 2026-08-27): hallazgo de Bloque G.1/Fase E ("Cuota
// agotada", ver tests/delivery_load_simulation.test.cjs) -- con el intervalo
// real de produccion (60s), un tope de 25 intentos descartaba un archivo de
// la cola durable tras ~25 MINUTOS de caida sostenida, muy antes de los 7
// dias de maxAgeMs, y de forma SILENCIOSA (el aprendiz nunca se enteraba).
//
// Este archivo prueba las 2 piezas del cierre:
//   1. maxAttempts sube a un valor que ya no compite con maxAgeMs (asi la
//      antiguedad, no un conteo arbitrario, es el limite real).
//   2. processDeliveryQueue invoca un onGiveUp(entry, reason) inyectable
//      justo antes de descartar, y shared_apps_script_delivery.js lo conecta
//      a un aviso real (registro "delivery-failed" + evento
//      "guide-delivery-failed") que activity_standard.js muestra reusando
//      renderManualDriveFallback (el mismo respaldo manual de Drive que ya
//      existia para el fallo interactivo -- no se invento una UI nueva).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function makeNode(tagName, attrs) {
  const node = {
    tagName,
    className: (attrs && attrs.class) || "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    children: [],
    parent: null,
    _attrs: Object.assign({}, attrs || {}),
    dataset: Object.assign({}, (attrs && attrs.dataset) || {}),
    style: {},
    getAttribute(name) {
      if (name === "class") return this.className || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
    },
    setAttribute(name, value) { this._attrs[name] = String(value); },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    querySelector(sel) {
      const attrMatch = sel.match(/^\[([\w-]+)=(['"])(.*)\2\]$/);
      const dataMatch = sel.match(/^\[data-([\w-]+)\]$/);
      function matches(n) {
        if (attrMatch) return n.getAttribute(attrMatch[1]) === attrMatch[3];
        if (dataMatch) return Object.prototype.hasOwnProperty.call(n._attrs, "data-" + dataMatch[1]);
        return false;
      }
      function search(n) {
        for (const c of n.children) {
          if (matches(c)) return c;
          const found = search(c);
          if (found) return found;
        }
        return null;
      }
      return matches(this) ? this : search(this);
    },
    querySelectorAll() { return []; },
  };
  return node;
}

function FakeCustomEvent(type, opts) {
  this.type = type;
  this.detail = (opts && opts.detail) || null;
}

function buildDom() {
  const docNode = makeNode("#document", {});
  docNode.createElement = (tag) => makeNode(tag, {});
  docNode.getElementById = () => null;
  docNode.head = makeNode("head", {});
  const mount = makeNode("div", { "data-act-std-delivery": "testAct" });
  docNode.appendChild(mount);
  docNode._eventListeners = {};
  docNode.addEventListener = function (type, fn) {
    (docNode._eventListeners[type] = docNode._eventListeners[type] || []).push(fn);
  };
  docNode.dispatchEvent = function (event) {
    (docNode._eventListeners[event.type] || []).forEach((fn) => fn(event));
    return true;
  };
  docNode.title = "";
  return { docNode, mount };
}

function loadContext(domRoot, integrations) {
  const store = {};
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const ctx = {
    console,
    window: {},
    document: domRoot,
    CustomEvent: FakeCustomEvent,
    localStorage,
    setTimeout, clearTimeout, setInterval, clearInterval,
    URL: global.URL,
    AbortController: global.AbortController,
    navigator: { onLine: true },
  };
  ctx.window.window = ctx.window;
  ctx.window.document = domRoot;
  ctx.window.localStorage = localStorage;
  ctx.window.location = { pathname: "/pages/guias/guia-test.html" };
  ctx.window.__RUNTIME_PAGE_FILE__ = "guia-test.html";
  ctx.window.addEventListener = () => {};
  ctx.window.PROJECT_INTEGRATIONS = integrations || { googleAppsScriptUrl: "https://script.google.com/macros/s/FAKE/exec", fichaDriveFolders: {} };
  ctx.window.portalFirebaseAuth = { getIdToken: async () => "fake-token" };

  vm.createContext(ctx);
  vm.runInContext(read("js/activity_standard.js"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read("js/shared_apps_script_delivery.js"), ctx, { filename: "shared_apps_script_delivery.js" });
  return ctx;
}

function makeStateCtx(state) {
  return {
    getState: () => state,
    saveState: () => {},
    getLearnerName: () => "Aprendiz Prueba",
    getSelection: () => ({ ficha: "3441939" }),
  };
}

// ── 1. maxAttempts: el tope ya no compite con maxAgeMs ─────────────────────

test("processDeliveryQueue: el default de maxAttempts ya no descarta antes que maxAgeMs (20000 x 60s > 7 dias)", async () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const api = ctx.window.sharedAppsScriptDelivery;

  const entries = [{ key: "k1", payload: {}, deliveryCtx: {}, attempts: 19999, status: "pending" }];
  const removed = [];
  const result = await api._processDeliveryQueue({
    storage: {
      getAll: async () => entries,
      remove: async (k) => removed.push(k),
      put: async () => {},
    },
    upload: async () => { throw Object.assign(new Error("503"), { transient: true }); },
    isPermanent: () => false,
  });
  assert.strictEqual(result.dropped, 0, "con 19999 intentos previos (por debajo del nuevo tope) todavia NO debe descartarse solo por conteo");
  assert.strictEqual(removed.length, 0);

  entries[0].attempts = 20000;
  const result2 = await api._processDeliveryQueue({
    storage: { getAll: async () => entries, remove: async (k) => removed.push(k), put: async () => {} },
    upload: async () => { throw new Error("no deberia llegar aqui"); },
    isPermanent: () => false,
  });
  assert.strictEqual(result2.dropped, 1, "con exactamente 20000 intentos previos, SI debe descartarse (el nuevo tope)");
});

// ── 2. onGiveUp: se invoca exactamente en los 2 casos de descarte, nunca en exito/kept ──

test("processDeliveryQueue: invoca onGiveUp(entry, 'max-attempts-or-age') al descartar por tope/antiguedad, y no lo hace si sigue en 'kept'", async () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const api = ctx.window.sharedAppsScriptDelivery;
  const giveUps = [];

  const oldEntry = { key: "old", payload: {}, deliveryCtx: { panelKey: "p1" }, attempts: 99999, status: "pending" };
  await api._processDeliveryQueue({
    storage: { getAll: async () => [oldEntry], remove: async () => {}, put: async () => {} },
    upload: async () => { throw new Error("no deberia llegar aqui"); },
    isPermanent: () => false,
    onGiveUp: (entry, reason) => giveUps.push({ key: entry.key, reason }),
  });
  assert.deepStrictEqual(giveUps, [{ key: "old", reason: "max-attempts-or-age" }]);

  giveUps.length = 0;
  const freshEntry = { key: "fresh", payload: {}, deliveryCtx: { panelKey: "p2" }, attempts: 0, status: "pending" };
  await api._processDeliveryQueue({
    storage: { getAll: async () => [freshEntry], remove: async () => {}, put: async () => {} },
    upload: async () => { throw Object.assign(new Error("503"), { transient: true }); },
    isPermanent: () => false,
    onGiveUp: (entry, reason) => giveUps.push({ key: entry.key, reason }),
  });
  assert.deepStrictEqual(giveUps, [], "un fallo transitorio que se conserva (kept) NUNCA debe disparar onGiveUp");
});

test("processDeliveryQueue: invoca onGiveUp(entry, 'permanent-error') cuando un reintento en background se reclasifica a error permanente", async () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const api = ctx.window.sharedAppsScriptDelivery;
  const giveUps = [];

  const entry = { key: "perm", payload: {}, deliveryCtx: { panelKey: "p3" }, attempts: 1, status: "pending" };
  await api._processDeliveryQueue({
    storage: { getAll: async () => [entry], remove: async () => {}, put: async () => {} },
    upload: async () => { throw new Error("archivo invalido"); },
    isPermanent: () => true,
    onGiveUp: (e, reason) => giveUps.push({ key: e.key, reason }),
  });
  assert.deepStrictEqual(giveUps, [{ key: "perm", reason: "permanent-error" }]);
});

test("processDeliveryQueue: sin onGiveUp explicito (default no-op), descartar no lanza -- compatibilidad con llamadas existentes", async () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const api = ctx.window.sharedAppsScriptDelivery;
  const entry = { key: "k", payload: {}, deliveryCtx: {}, attempts: 99999, status: "pending" };
  const result = await api._processDeliveryQueue({
    storage: { getAll: async () => [entry], remove: async () => {}, put: async () => {} },
    upload: async () => { throw new Error("no deberia llegar aqui"); },
    isPermanent: () => false,
  });
  assert.strictEqual(result.dropped, 1);
});

// ── 3. El aviso real: registro "delivery-failed" + evento, reusando el fallback manual ──

test("_handleQueueGiveUp: guarda un registro 'delivery-failed' recuperable via loadDeliveryRecord y dispara 'guide-delivery-failed'", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const api = ctx.window.sharedAppsScriptDelivery;

  let eventDetail = null;
  dom.docNode.addEventListener("guide-delivery-failed", (event) => { eventDetail = event.detail; });

  const entry = {
    key: "guia-test.html|testPanel",
    deliveryCtx: {
      context: { pageFile: "guia-test.html", panelKey: "testPanel" },
      panelKey: "testPanel",
      ficha: "3441939",
      fullName: "Aprendiz Prueba",
      fileName: "evidencia.py",
      standardName: "Guia_1_Actividad_11_Reto_3441939_Aprendiz_Prueba.py",
      submittedAt: "2026-08-27T10:00:00.000Z",
    },
  };

  const record = api._handleQueueGiveUp(entry, "max-attempts-or-age");
  assert.strictEqual(record.status, "delivery-failed");
  assert.strictEqual(record.panelKey, "testPanel");
  assert.strictEqual(record.savedFileName, "Guia_1_Actividad_11_Reto_3441939_Aprendiz_Prueba.py");

  const loaded = api.loadDeliveryRecord({ pageFile: "guia-test.html", panelKey: "testPanel" });
  assert.strictEqual(loaded.status, "delivery-failed", "loadDeliveryRecord (el mismo mecanismo que una entrega exitosa) debe encontrar el registro de fallo");

  assert.ok(eventDetail, "debe dispararse el evento guide-delivery-failed");
  assert.strictEqual(eventDetail.panelKey, "testPanel");
  assert.strictEqual(eventDetail.status, "delivery-failed");
});

test("runDeliveryQueue real: su llamada a processDeliveryQueue incluye onGiveUp conectado a _handleQueueGiveUp (no queda desconectado)", () => {
  const src = read("js/shared_apps_script_delivery.js");
  assert.match(
    src,
    /onGiveUp:\s*handleQueueGiveUp/,
    "runDeliveryQueue debe pasar onGiveUp: handleQueueGiveUp a processDeliveryQueue -- si esto se pierde en un refactor futuro, el descarte vuelve a ser silencioso"
  );
});

// ── 4. activity_standard.js: getActivityDeliveryInfo + el aviso visible ────

test("getActivityDeliveryInfo: reconoce un registro 'delivery-failed' como kind:'failed' (no lo confunde con 'pending')", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const act = { id: "testAct", driveTarget: { panelKey: "testPanel" } };

  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ pageFile: "guia-test.html", panelKey: "testPanel" }, {
    status: "delivery-failed", reason: "max-attempts-or-age", ficha: "3441939", savedFileName: "archivo.py",
  });

  const info = ctx.window.ActivityStandard.getActivityDeliveryInfo(act, {});
  assert.strictEqual(info.kind, "failed");
  assert.strictEqual(info.ficha, "3441939");
  assert.strictEqual(info.standardName, "archivo.py");
});

test("getActivityDeliveryInfo: un registro 'delivered' sigue ganando (nunca se pisa una entrega real con un fallo viejo)", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const act = { id: "testAct", driveTarget: { panelKey: "testPanel" } };
  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ pageFile: "guia-test.html", panelKey: "testPanel" }, {
    status: "delivered", submittedAt: "2026-08-27T10:00:00.000Z",
  });
  const info = ctx.window.ActivityStandard.getActivityDeliveryInfo(act, {});
  assert.strictEqual(info.kind, "delivered");
});

test("_restoreDeliveryFailureFromRecord: al montar la guia, si hay un 'delivery-failed' pendiente, pinta el respaldo manual de Drive (reusa renderManualDriveFallback, no una UI nueva)", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode, { googleAppsScriptUrl: "https://script.google.com/macros/s/FAKE/exec", fichaDriveFolders: { "3441939": "https://drive.google.com/drive/folders/FAKE" } });
  const act = { id: "testAct", driveTarget: { panelKey: "testPanel" } };
  const state = {};

  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ pageFile: "guia-test.html", panelKey: "testPanel" }, {
    status: "delivery-failed", ficha: "3441939", savedFileName: "Guia_1_Actividad_11_Reto_3441939_X.py",
  });

  ctx.window.ActivityStandard._restoreDeliveryFailureFromRecord(act, makeStateCtx(state));

  assert.match(dom.mount.innerHTML, /entrega automatica no pudo completarse/i);
  assert.match(dom.mount.innerHTML, /https:\/\/drive\.google\.com\/drive\/folders\/FAKE/);
  assert.match(dom.mount.innerHTML, /Guia_1_Actividad_11_Reto_3441939_X\.py/);
  assert.strictEqual(dom.mount.hidden, false);
});

test("_restoreDeliveryFailureFromRecord: si la actividad YA esta entregada (state), NUNCA pisa esa confirmacion con un aviso de fallo viejo", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const act = { id: "testAct", driveTarget: { panelKey: "testPanel" } };
  const state = { "testAct-delivery": { status: "delivered" } };

  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ pageFile: "guia-test.html", panelKey: "testPanel" }, {
    status: "delivery-failed", ficha: "3441939", savedFileName: "no-deberia-mostrarse.py",
  });

  ctx.window.ActivityStandard._restoreDeliveryFailureFromRecord(act, makeStateCtx(state));
  assert.strictEqual(dom.mount.innerHTML, "", "sin registro de entrega correcta ya confirmada, el mount no debe tocarse con el aviso de fallo");
});

test("_restoreDeliveryFailureFromRecord: sin ningun registro de fallo, no toca el mount", () => {
  const dom = buildDom();
  const ctx = loadContext(dom.docNode);
  const act = { id: "testAct", driveTarget: { panelKey: "testPanel" } };
  ctx.window.ActivityStandard._restoreDeliveryFailureFromRecord(act, makeStateCtx({}));
  assert.strictEqual(dom.mount.innerHTML, "");
});
