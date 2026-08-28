"use strict";

// Bloque E (auditoria 2026-08-27): "retoPython" (Guia Python) exige 2
// archivos reales (programa .py + evidencia). Antes se le pedia al aprendiz
// comprimir ambos en un solo .zip subido por el flujo de archivo unico, sin
// ninguna verificacion de que el zip trajera los 2 archivos -- la actividad
// se marcaba "entregada" con solo 1 archivo (el zip, aunque viniera
// incompleto). Ahora cada archivo se sube por su propio boton
// (buildDriveTargets genera 2 targets con panelKeys distintos que comparten
// un logicalGroupKey), y ActivityStandard solo marca la actividad como
// entregada (y solo cuenta para el % de progreso) cuando AMBOS estan.
//
// Reusa el mismo DOM minimo y el mismo patron de carga (vm + activity_standard
// + guide_declarations + shared_apps_script_delivery + shared_drive_delivery)
// que tests/guia_python_reto_adicional_delivery.test.cjs, aplicado a la
// actividad 5.1 (retoPython) en vez de a los ejercicios 1-10.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function matchesSimpleSelector(el, sel) {
  if (sel.charAt(0) === ".") {
    const cls = sel.slice(1);
    return (el.className || "").split(/\s+/).indexOf(cls) !== -1;
  }
  const attrMatch = sel.match(/^\[([\w-]+)=(['"])(.*)\2\]$/);
  if (attrMatch) {
    return el.getAttribute(attrMatch[1]) === attrMatch[3];
  }
  return false;
}

function collectDeep(node, sel, out) {
  for (const child of node.children) {
    if (matchesSimpleSelector(child, sel)) out.push(child);
    collectDeep(child, sel, out);
  }
  return out;
}

function makeNode(tagName, attrs) {
  const node = {
    tagName: tagName,
    className: (attrs && attrs.class) || "",
    textContent: "",
    children: [],
    parent: null,
    _attrs: Object.assign({}, attrs || {}),
    _listeners: {},
    style: {},
    hidden: false,
    dataset: {},
    getAttribute(name) {
      if (name === "class") return this.className || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
    },
    setAttribute(name, value) {
      if (name === "class") { this.className = String(value); return; }
      this._attrs[name] = String(value);
    },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    addEventListener(type, fn) { this._listeners[type] = fn; },
    querySelector(sel) { const r = collectDeep(this, sel, []); return r[0] || null; },
    querySelectorAll(sel) { return collectDeep(this, sel, []); },
    closest(sel) {
      let n = this;
      while (n) {
        if (n.tagName !== "#document" && matchesSimpleSelector(n, sel)) return n;
        n = n.parent;
      }
      return null;
    },
    classList: { add() {}, remove() {}, toggle() {} },
  };
  return node;
}

function buildRetoPythonDom() {
  const docNode = makeNode("#document", {});
  docNode.createElement = (tag) => makeNode(tag, {});
  docNode.getElementById = () => null; // simplificacion: _injectDeliveryStyles solo necesita "no existe todavia"
  docNode.head = makeNode("head", {});

  const activity = makeNode("div", { class: "activity" });
  const header = makeNode("div", { class: "activity-header" });
  const num = makeNode("span", { class: "activity-num" });
  num.textContent = "5.1";
  const title = makeNode("span", { class: "activity-title" });
  title.textContent = "Reto integrador - Sistema basico de seguimiento academico";
  header.appendChild(num);
  header.appendChild(title);

  const body = makeNode("div", { class: "activity-body" });
  // Slot de confirmacion agrupada (convencion documentada en CLAUDE.md).
  const groupSlot = makeNode("div", { "data-act-std-delivery": "retoPython" });
  body.appendChild(groupSlot);

  activity.appendChild(header);
  activity.appendChild(body);
  docNode.appendChild(activity);
  return docNode;
}

// CustomEvent minimo: alcanza con .type/.detail, que es todo lo que
// notifyDeliveryRegistered/los listeners de guide-delivery-registered leen.
function FakeCustomEvent(type, opts) {
  this.type = type;
  this.detail = (opts && opts.detail) || null;
}

function loadContext(domRoot) {
  const ctx = {
    console,
    window: {},
    document: domRoot,
    CustomEvent: FakeCustomEvent,
    localStorage: (function () {
      const store = {};
      return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
      };
    })(),
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {},
  };
  ctx.window.window = ctx.window;
  ctx.window.document = domRoot;
  ctx.window.localStorage = ctx.localStorage;
  ctx.window.location = { pathname: "/pages/guias/santa-barbara-guia-python.html" };
  ctx.window.__RUNTIME_PAGE_FILE__ = "santa-barbara-guia-python.html";
  ctx.window.addEventListener = (type, fn) => { ctx.window._listeners = ctx.window._listeners || {}; (ctx.window._listeners[type] = ctx.window._listeners[type] || []).push(fn); };
  // A diferencia del test hermano (guia_python_reto_adicional_delivery), este
  // SI necesita un bus de eventos real en document: la actividad solo se
  // bloquea (retoPython-locked) dentro del listener "guide-delivery-registered"
  // que _mountGroupedDeliveryWatcher registra via document.addEventListener.
  domRoot._eventListeners = {};
  domRoot.addEventListener = function (type, fn) {
    (domRoot._eventListeners[type] = domRoot._eventListeners[type] || []).push(fn);
  };
  domRoot.dispatchEvent = function (event) {
    (domRoot._eventListeners[event.type] || []).forEach((fn) => fn(event));
    return true;
  };
  domRoot.title = "";

  vm.createContext(ctx);
  vm.runInContext(read("js/activity_standard.js"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read("js/guide_declarations.js"), ctx, { filename: "guide_declarations.js" });
  vm.runInContext(read("js/shared_apps_script_delivery.js"), ctx, { filename: "shared_apps_script_delivery.js" });
  vm.runInContext(read("js/shared_drive_delivery.js"), ctx, { filename: "shared_drive_delivery.js" });

  return ctx;
}

function makeStateCtx(state) {
  return {
    getState: () => state,
    saveState: () => {},
    getLearnerName: () => "Laura Gomez",
    getSelection: () => ({ ficha: "3441939" }),
    getGuideMetadata: () => ctxGuideMeta,
    getGuideDataFile: () => "santa-barbara-guia-python.html",
  };
}

let ctxGuideMeta;

test("buildDriveTargets genera 2 targets independientes para retoPython, con panelKeys distintos y el mismo logicalGroupKey", () => {
  const dom = buildRetoPythonDom();
  const ctx = loadContext(dom);
  ctxGuideMeta = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");

  const allTargets = ctx.window.ActivityStandard.buildDriveTargets("santa-barbara-guia-python.html", {
    getSelection: () => ({ ficha: "3441939" }),
    getLearnerName: () => "Laura Gomez",
  });
  const targets = allTargets.filter((t) => (t.activityContext.logicalGroupKey || "") === "python-reto");
  assert.strictEqual(targets.length, 2, "retoPython debe producir 2 targets (programa + evidencia), no 1");

  const programa = targets.find((t) => t.panelKey === "python-reto--programa");
  const evidencia = targets.find((t) => t.panelKey === "python-reto--evidencia");
  assert.ok(programa, "falta el target del archivo .py");
  assert.ok(evidencia, "falta el target de la evidencia");
  assert.notStrictEqual(programa.panelKey, evidencia.panelKey);
  assert.strictEqual(programa.activityContext.logicalGroupKey, evidencia.activityContext.logicalGroupKey);
  assert.match(programa.activityContext.activityTitle, /Programa \.py/);
  assert.match(evidencia.activityContext.activityTitle, /evidencia/i);
  // Bloque G (hallazgo incidental corregido de paso): allowedExtensions por
  // archivo SI llega ahora al contexto que usa el modal (antes buildDriveTargets
  // nunca lo propagaba desde driveTarget/requiredFiles). Comparacion por
  // .join() en vez de deepStrictEqual: los arrays vienen de OTRO realm (vm),
  // y deepStrictEqual exige identidad de constructor entre realms.
  assert.strictEqual(Array.from(programa.activityContext.allowedExtensions).join(","), ".py");
  assert.strictEqual(Array.from(evidencia.activityContext.allowedExtensions).join(","), ".png,.jpg,.jpeg,.pdf");
});

test("los 2 targets de retoPython montan sus botones dentro del MISMO bloque .activity (numero 5.1)", () => {
  const dom = buildRetoPythonDom();
  const ctx = loadContext(dom);
  ctxGuideMeta = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");
  const targets = ctx.window.ActivityStandard.buildDriveTargets("santa-barbara-guia-python.html", {
    getSelection: () => ({ ficha: "3441939" }),
    getLearnerName: () => "Laura Gomez",
  }).filter((t) => (t.activityContext.logicalGroupKey || "") === "python-reto");

  ctx.window.sharedDriveDelivery.appendDriveDeliveryPanels({ targets, onDriveClick() {} });
  const panels = dom.querySelectorAll(".drive-submit-box");
  assert.strictEqual(panels.length, 2, "deben montarse 2 paneles de entrega, uno por archivo");
});

test("1/2 archivos subidos: la actividad queda PARCIAL, no entregada -- no bloquea el estado ni cuenta como completa", () => {
  const dom = buildRetoPythonDom();
  const ctx = loadContext(dom);
  ctxGuideMeta = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");
  const state = {};
  const stateCtx = makeStateCtx(state);

  ctx.window.ActivityStandard.mountActivities(stateCtx);

  const record = {
    panelKey: "python-reto--programa",
    status: "delivered",
    submittedAt: "2026-08-27T10:00:00.000Z",
    savedFileName: "Guia_5_Actividad_51_RetoIntegrador_programa_3441939_Laura_Gomez.py",
  };
  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ panelKey: "python-reto--programa" }, record);
  ctx.window.sharedAppsScriptDelivery.notifyDeliveryRegistered(record);

  const config = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");
  const retoPython = config.activities.find((a) => a.id === "retoPython");

  // getActivityDeliveryInfo debe reflejar 1/2 ya con solo el registro guardado
  // en localStorage (no depende del evento para ESTE calculo puntual).
  const info = ctx.window.ActivityStandard.getActivityDeliveryInfo(retoPython, state);
  assert.strictEqual(info.kind, "partial");
  assert.strictEqual(info.filesDelivered, 1);
  assert.strictEqual(info.filesTotal, 2);
  assert.strictEqual(state["retoPython-locked"], undefined, "no debe bloquearse la actividad con solo 1 de 2 archivos");
});

test("2/2 archivos subidos: la actividad SI queda entregada y bloqueada", () => {
  const dom = buildRetoPythonDom();
  const ctx = loadContext(dom);
  ctxGuideMeta = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");
  const state = {};
  const stateCtx = makeStateCtx(state);

  ctx.window.ActivityStandard.mountActivities(stateCtx);

  const recordPrograma = {
    panelKey: "python-reto--programa",
    status: "delivered",
    submittedAt: "2026-08-27T10:00:00.000Z",
    fullName: "Laura Gomez",
    ficha: "3441939",
  };
  const recordEvidencia = {
    panelKey: "python-reto--evidencia",
    status: "delivered",
    submittedAt: "2026-08-27T10:05:00.000Z",
    fullName: "Laura Gomez",
    ficha: "3441939",
  };
  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ panelKey: "python-reto--programa" }, recordPrograma);
  ctx.window.sharedAppsScriptDelivery.notifyDeliveryRegistered(recordPrograma);
  ctx.window.sharedAppsScriptDelivery.saveDeliveryRecord({ panelKey: "python-reto--evidencia" }, recordEvidencia);
  ctx.window.sharedAppsScriptDelivery.notifyDeliveryRegistered(recordEvidencia);

  const config = ctx.window.ActivityStandard.getConfigForGuide("santa-barbara-guia-python.html");
  const retoPython = config.activities.find((a) => a.id === "retoPython");
  const info = ctx.window.ActivityStandard.getActivityDeliveryInfo(retoPython, state);
  assert.strictEqual(info.kind, "delivered");
  assert.strictEqual(state["retoPython-locked"], true, "con los 2 archivos presentes, la actividad SI debe bloquearse/marcarse entregada");
});
