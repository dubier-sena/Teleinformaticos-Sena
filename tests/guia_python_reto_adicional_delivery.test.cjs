"use strict";

// Bug real reportado: en la Guia - Practica de Python, cada ejercicio numerado
// (partials/guia-python-content.html) tiene DOS entregas de archivo independientes
// dentro del MISMO bloque .activity: "Reto ejercicio N" y "Ejercicio adicional N".
// Es la unica guia con este patron (ver grep de data-act-std-delivery por .activity).
//
// appendDriveDeliveryPanels() (js/shared_drive_delivery.js) derivaba el numero y la
// etiqueta de la actividad leyendo el DOM del .activity contenedor -- comun a ambos
// paneles -- en vez de propagar el deadlineActivityId/numero REAL de cada target.
// Consecuencia: resolveGuideStandardContext() (js/shared_apps_script_delivery.js)
// no podia distinguir "Ejercicio adicional 1" de "Reto ejercicio 1" y SIEMPRE
// resolvia al Reto, asi que el Ejercicio adicional se subia a Drive con el MISMO
// nombre estandar que el Reto (colision) y el modal de entrega mostraba el mismo
// titulo generico "Actividad 1" para los dos botones -- de ahi que el aprendiz se
// perdiera y subiera los archivos trocados entre Reto y Adicional.
//
// Este test reproduce el flujo real (activity_standard.js + guide_declarations.js +
// shared_drive_delivery.js + shared_apps_script_delivery.js) sobre un DOM minimo que
// imita el bloque del ejercicio 1 en partials/guia-python-content.html.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

// ── DOM minimo: solo lo que appendDriveDeliveryPanels/getActivityContextFromNode
// realmente ejercitan (selectores simples de clase/atributo, closest, appendChild). ──

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

function buildPythonExercise1Dom() {
  const docNode = makeNode("#document", {});
  docNode.createElement = (tag) => makeNode(tag, {});

  const activity = makeNode("div", { class: "activity" });
  const header = makeNode("div", { class: "activity-header" });
  const num = makeNode("span", { class: "activity-num" });
  num.textContent = "1";
  const title = makeNode("span", { class: "activity-title" });
  title.textContent = "Registro básico del aprendiz";
  header.appendChild(num);
  header.appendChild(title);

  const body = makeNode("div", { class: "activity-body" });
  // Orden real del partial: primero el slot del adicional, luego el del reto.
  const adicionalSlot = makeNode("div", { "data-act-std-delivery": "adicionalEj1" });
  const retoSlot = makeNode("div", { "data-act-std-delivery": "retoEj1" });
  body.appendChild(adicionalSlot);
  body.appendChild(retoSlot);

  activity.appendChild(header);
  activity.appendChild(body);
  docNode.appendChild(activity);
  return docNode;
}

function loadCombinedContext(domRoot) {
  const capturedModalContexts = [];
  const ctx = {
    console,
    window: {},
    document: domRoot,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {},
  };
  ctx.window.window = ctx.window;
  ctx.window.document = domRoot;
  ctx.window.location = { pathname: "/pages/guias/santa-barbara-guia-python.html" };
  ctx.window.__RUNTIME_PAGE_FILE__ = "santa-barbara-guia-python.html";
  ctx.window.addEventListener = () => {};
  domRoot.addEventListener = () => {};
  domRoot.title = "";

  vm.createContext(ctx);
  vm.runInContext(read("js/activity_standard.js"), ctx, { filename: "activity_standard.js" });
  vm.runInContext(read("js/guide_declarations.js"), ctx, { filename: "guide_declarations.js" });
  vm.runInContext(read("js/shared_apps_script_delivery.js"), ctx, { filename: "shared_apps_script_delivery.js" });
  // Reemplaza el modal real (requiere su propio DOM) por una captura del contexto
  // con el que fue invocado -- eso es lo que el test necesita verificar.
  ctx.window.sharedAppsScriptDelivery.openDeliveryModal = (context) => {
    capturedModalContexts.push(context);
  };
  vm.runInContext(read("js/shared_drive_delivery.js"), ctx, { filename: "shared_drive_delivery.js" });

  return { ctx, capturedModalContexts };
}

test("Reto ejercicio 1 y Ejercicio adicional 1 quedan identificados con id/numero propios (no el generico del .activity compartido)", () => {
  const dom = buildPythonExercise1Dom();
  const { ctx, capturedModalContexts } = loadCombinedContext(dom);

  const allTargets = ctx.window.ActivityStandard.buildDriveTargets("santa-barbara-guia-python.html", {
    getSelection: () => ({ ficha: "3441939" }),
    getLearnerName: () => "Laura Gomez",
  });
  const targets = allTargets.filter((t) => t.panelKey === "python-ej1" || t.panelKey === "python-adicional-ej1");
  assert.strictEqual(targets.length, 2, "buildDriveTargets debe producir los targets del reto y del adicional del ejercicio 1");

  ctx.window.sharedDriveDelivery.appendDriveDeliveryPanels({ targets, onDriveClick() {} });

  const triggerButtons = dom.querySelectorAll('[data-apps-script-trigger="true"]');
  assert.strictEqual(triggerButtons.length, 2, "cada panel debe montar su propio boton de entrega segura");
  triggerButtons.forEach((btn) => btn._listeners.click());
  assert.strictEqual(capturedModalContexts.length, 2);

  const retoCtx = capturedModalContexts.find((c) => c.panelKey === "python-ej1");
  const adicionalCtx = capturedModalContexts.find((c) => c.panelKey === "python-adicional-ej1");
  assert.ok(retoCtx, "falta el contexto capturado del Reto");
  assert.ok(adicionalCtx, "falta el contexto capturado del Ejercicio adicional");

  // El id real de cada actividad (guide_declarations.js) debe llegar intacto,
  // no quedar vacio ni heredar el del hermano.
  assert.strictEqual(retoCtx.deadlineActivityId, "retoEj1");
  assert.strictEqual(adicionalCtx.deadlineActivityId, "adicionalEj1");

  // El numero de actividad NO debe colapsar al generico "1" leido del .activity
  // contenedor para el adicional (su numero real es "1A").
  assert.strictEqual(retoCtx.activityNumber, "1");
  assert.strictEqual(adicionalCtx.activityNumber, "1A");

  // El titulo mostrado en el modal ("Entrega segura - {activityLabel}") debe
  // distinguir Reto de Adicional, no mostrar "Actividad 1" para ambos.
  assert.notStrictEqual(retoCtx.activityLabel, adicionalCtx.activityLabel);
  assert.match(retoCtx.activityLabel, /Reto ejercicio 1/i);
  assert.match(adicionalCtx.activityLabel, /Ejercicio adicional 1/i);

  // El nombre de archivo final ya no colisiona entre las dos entregas.
  const retoFileName = ctx.window.sharedAppsScriptDelivery.buildDeliveryFileNamePreview(
    "Laura Gomez", retoCtx, "evidencia.py", "3441939"
  );
  const adicionalFileName = ctx.window.sharedAppsScriptDelivery.buildDeliveryFileNamePreview(
    "Laura Gomez", adicionalCtx, "evidencia.py", "3441939"
  );
  assert.notStrictEqual(retoFileName, adicionalFileName, "Reto y Adicional no deben terminar con el mismo nombre de archivo en Drive");
  assert.match(retoFileName, /RetoEj1/);
  assert.match(adicionalFileName, /AdicionalEj1/);
});
