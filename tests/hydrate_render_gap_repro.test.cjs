"use strict";

// Regresion permanente: reproduce el hallazgo encontrado durante la
// validacion en produccion del fix de GuideCloudSync (2026-08-31) --
// distinto del bug ya corregido antes (script tag faltante).
//
// Patron real en los 8 guiones que usan window.GuideCloudSync:
//   1. ActivityStandard.mountActivities(stateCtx) se llama con el estado
//      LOCAL (antes de que la nube responda).
//   2. cloudStore.hydrate() se llama DESPUES, es asincrono.
//   3. hydrate() SI actualiza state correctamente (setState + localStorage)
//      cuando la nube tiene una version mas nueva -- confirmado leyendo
//      js/guide_cloud_sync.js:hydrate() y js/firebase_db.js:resolveGuideHydration.
//   4. Pero onHydrated (el callback que cada guion pasa a createStore) solo
//      llama hydrateFields()+updateProgress() (o, en script_guia_python.js,
//      updateProgress()+renderDeliverySummary()) -- NINGUNO volvia a llamar
//      ActivityStandard.mountActivities() ni a las funciones que pintan el
//      panel "Actividad entregada correctamente" o bloquean los campos de
//      formulario.
//
// Verificado en vivo el 2026-08-31 en produccion (santa-barbara-10b-guia-04-
// redes-rap03.html, cuenta QA prueba10bsb): tras borrar las 8 llaves de
// localStorage de esa guia y recargar, state/localStorage/Firestore
// mostraban la entrega correcta pero el panel de confirmacion seguia vacio
// y los botones "Subir/Entregar" seguian activos.
//
// FIX (2026-08-31, mismo dia): js/guide_cloud_sync.js dispara el evento
// existente "activity-deadlines-updated" (Opcion D del analisis: reusar el
// evento que mountFormActivity/_mountDeliveryWatcher YA escuchan, en vez de
// volver a llamar mountActivities() o inventar un evento nuevo) justo
// despues de setState(...)+onHydrated(...), tanto en hydrate() como en
// startPeriodicRefresh(). Las dos pruebas de reproduccion de abajo deben
// pasar ahora (antes del fix estaban en rojo -- no se les toco la
// expectativa, solo se corrigio el codigo fuente).
//
// Este archivo reproduce el patron con activity_standard.js +
// guide_cloud_sync.js REALES (no reimplementados) sobre un DOM minimo, para
// que el resultado sea mecanico y no dependa de observacion manual.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

// ── DOM minimo (mismo enfoque que tests/guia_python_reto_adicional_delivery.test.cjs) ──

function matchesSimpleSelector(el, sel) {
  if (sel.charAt(0) === ".") {
    const cls = sel.slice(1);
    return (el.className || "").split(/\s+/).indexOf(cls) !== -1;
  }
  if (sel.charAt(0) === "#") {
    return el.id === sel.slice(1);
  }
  const attrMatch = sel.match(/^\[([\w-]+)=(['"])(.*)\2\]$/);
  if (attrMatch) {
    return el.getAttribute(attrMatch[1]) === attrMatch[3];
  }
  const attrExistsMatch = sel.match(/^\[([\w-]+)\]$/);
  if (attrExistsMatch) {
    return el.getAttribute(attrExistsMatch[1]) != null;
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

function findByIdDeep(node, id) {
  for (const child of node.children) {
    if (child.id === id) return child;
    const found = findByIdDeep(child, id);
    if (found) return found;
  }
  return null;
}

function makeNode(tagName, attrs) {
  attrs = attrs || {};
  const node = {
    tagName: tagName,
    className: attrs.class || "",
    id: attrs.id || "",
    textContent: "",
    innerHTML: "",
    children: [],
    parent: null,
    _attrs: Object.assign({}, attrs),
    _listeners: {},
    style: {},
    hidden: false,
    disabled: false,
    dataset: {},
    getAttribute(name) {
      if (name === "class") return this.className || null;
      if (name === "id") return this.id || null;
      return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
    },
    setAttribute(name, value) {
      if (name === "class") { this.className = String(value); return; }
      if (name === "id") { this.id = String(value); return; }
      this._attrs[name] = String(value);
    },
    appendChild(child) { child.parent = this; this.children.push(child); return child; },
    addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
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

function buildDom() {
  const docNode = makeNode("#document", {});
  docNode.createElement = (tag) => makeNode(tag, {});
  docNode.head = makeNode("head", {});
  docNode.body = makeNode("body", {});
  docNode.appendChild(docNode.head);
  docNode.appendChild(docNode.body);

  // Slot de confirmacion de la actividad tipo "file" (igual al HTML real:
  // <div data-act-std-delivery="testDelivery"></div> dentro del panel).
  const deliverySlot = makeNode("div", { "data-act-std-delivery": "testDelivery" });
  docNode.body.appendChild(deliverySlot);

  // Boton de guardar + campo de formulario de la actividad tipo "form".
  const formField = makeNode("textarea", { "data-store": "campoForm" });
  const saveBtn = makeNode("button", { id: "btnGuardarForm" });
  docNode.body.appendChild(formField);
  docNode.body.appendChild(saveBtn);

  // Panel "Tu control de avance".
  const avancePanel = makeNode("div", { "data-act-std-avance": "" });
  docNode.body.appendChild(avancePanel);

  docNode.getElementById = (id) => {
    if (docNode.id === id) return docNode;
    return findByIdDeep(docNode, id);
  };

  return { docNode, deliverySlot, formField, saveBtn, avancePanel };
}

// ── Replica fiel (no reimplementacion libre) del merge por timestamp de
// guide_merge_utils.js/firebase_db.js:resolveGuideHydration -- misma
// convencion que tests/guide_cloud_sync_store.test.cjs ("el algoritmo
// completo ya se prueba" en otro archivo; aqui alcanza con una replica
// suficiente para ejercitar hydrate() de punta a punta). ──

function snapshotTimestamp(snap) {
  const t = Date.parse((snap && snap.updatedAt) || "");
  return Number.isFinite(t) ? t : NaN;
}

function hasMeaningfulValue(v) {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "boolean") return v === true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function mergeGuideValueMock(previous, incoming) {
  const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (isPlain(previous) && isPlain(incoming)) {
    const nested = Object.assign({}, previous);
    Object.keys(incoming).forEach((k) => { nested[k] = mergeGuideValueMock(previous[k], incoming[k]); });
    return nested;
  }
  if (!hasMeaningfulValue(incoming) && hasMeaningfulValue(previous)) return previous;
  return incoming;
}

function mergeGuideStateMock(previousState, incomingState) {
  const previous = previousState || {};
  const incoming = incomingState || {};
  const next = Object.assign({}, previous);
  Object.keys(incoming).forEach((key) => {
    if (/-locked$/.test(key)) {
      if (incoming[key]) next[key] = true; else delete next[key];
      return;
    }
    next[key] = mergeGuideValueMock(previous[key], incoming[key]);
  });
  return next;
}

function resolveGuideHydrationMock(localSnapshot, remoteSnapshot) {
  const local = localSnapshot || {};
  const remote = remoteSnapshot || null;
  if (!remote) return { state: local.state || {}, updatedAt: local.updatedAt || "", source: "local" };
  const localTs = snapshotTimestamp(local);
  const remoteTs = snapshotTimestamp(remote);
  const remoteIsNewer = !Number.isFinite(localTs) || (Number.isFinite(remoteTs) && remoteTs > localTs);
  const newer = remoteIsNewer ? remote : local;
  const older = remoteIsNewer ? local : remote;
  const merged = mergeGuideStateMock(older.state || {}, newer.state || {});
  return {
    state: merged,
    updatedAt: (remoteIsNewer ? remote.updatedAt : local.updatedAt) || new Date().toISOString(),
    source: remoteIsNewer ? "remote" : "local",
  };
}

// ── Carga activity_standard.js + guide_cloud_sync.js REALES en un sandbox
// compartido (mismo `window`), igual que conviven en una pagina real. ──

function loadRealModules(domRoot, firebaseDbOverrides) {
  const listeners = {};
  const localStorageMap = new Map();
  const localStorage = {
    getItem: (k) => (localStorageMap.has(k) ? localStorageMap.get(k) : null),
    setItem: (k, v) => { localStorageMap.set(k, String(v)); },
    removeItem: (k) => { localStorageMap.delete(k); },
  };

  const windowObj = {
    localStorage,
    setTimeout, clearTimeout, setInterval, clearInterval,
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    dispatchEvent: (evt) => { (listeners[evt.type] || []).forEach((fn) => fn(evt)); },
    portalAuth: { getCurrentSession: () => ({ role: "student", user: { usernameKey: "auditoria_claude" } }) },
    portalSaveStatus: null,
    navigator: { onLine: true },
    requestAnimationFrame: (fn) => fn(),
    _firebaseDb: Object.assign({
      resolveGuideHydration: resolveGuideHydrationMock,
    }, firebaseDbOverrides || {}),
  };
  windowObj.window = windowObj;
  windowObj.document = domRoot;

  const sandbox = {
    window: windowObj,
    document: domRoot,
    navigator: windowObj.navigator,
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; },
    Event: function Event(type) { this.type = type; },
  };
  domRoot.addEventListener = (type, fn) => { (listeners["doc:" + type] = listeners["doc:" + type] || []).push(fn); };
  domRoot.dispatchEvent = (evt) => { (listeners["doc:" + evt.type] || []).forEach((fn) => fn(evt)); };

  vm.createContext(sandbox);
  vm.runInContext(read("js/activity_standard.js"), sandbox, { filename: "activity_standard.js" });
  vm.runInContext(read("js/guide_cloud_sync.js"), sandbox, { filename: "guide_cloud_sync.js" });

  return { ctx: sandbox, windowObj, listeners, localStorage };
}

// ── Config minima de guia: una actividad tipo "file" (entrega a Drive) y una
// tipo "form" (respuestas + bloqueo de campo), igual de forma a cualquiera
// de las 8 guias reales registradas en guide_declarations.js. ──

function registerTestGuide(ActivityStandard, fileName) {
  ActivityStandard.registerGuide({
    files: [fileName],
    guideNumber: "T",
    guideTitle: "Guia de prueba (auditoria hydrate/render)",
    stateKey: "guia_test_hydrate_render",
    program: "Sistemas Teleinformaticos",
    competencia: "TEST",
    resultado: "TEST",
    activities: [
      {
        id: "testDelivery",
        number: "9.9.1",
        label: "Entrega de prueba",
        shortName: "Prueba",
        type: "file",
        driveTarget: { panelKey: "testDelivery" },
      },
      {
        id: "testForm",
        number: "9.9.2",
        label: "Formulario de prueba",
        shortName: "PruebaForm",
        type: "form",
        formFields: ["campoForm"],
        buttonIds: { save: "btnGuardarForm", status: "" },
      },
    ],
  });
}

function buildStateCtx(getState, saveState, fileName, ActivityStandard) {
  return {
    getState,
    saveState,
    getLearnerName: () => "Aprendiz Prueba",
    getSelection: () => ({ ficha: "0000000", grupo: "T", inst: "Test" }),
    getGuideMetadata: () => ActivityStandard.getConfigForGuide(fileName) || {},
    getGuideDataFile: () => fileName,
  };
}

test("FIX: tras hydrate() con entrega en la nube, state se actualiza Y el panel de confirmacion se repinta", async () => {
  const FILE_NAME = "guia-test-hydrate-render.html";
  const { docNode, deliverySlot } = buildDom();

  let state = {}; // estado local vacio: simula cache borrada / dispositivo distinto
  const remoteState = {
    "testDelivery-locked": true,
    "testDelivery-delivery": {
      status: "delivered",
      submittedAt: "2026-08-31T22:00:00.000Z",
      savedFileName: "Entrega_Remota.pdf",
      driveUrl: "https://drive.google.com/file/d/REMOTE123/view?usp=sharing",
    },
  };

  const { ctx } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T22:00:05.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);

  const stateCtx = buildStateCtx(() => state, () => {}, FILE_NAME, ActivityStandard);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:hydrate-render",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    // Mismo onHydrated que usan 7 de los 8 guiones reales: SOLO repinta
    // campos de formulario y progreso. El repintado del panel de entrega ya
    // NO depende de esto -- lo dispara guide_cloud_sync.js internamente.
    onHydrated: () => { /* hydrateFields() + updateProgress() equivalentes */ },
  });

  // 1) Boot real: mountActivities() PRIMERO, con el estado local (vacio).
  ActivityStandard.mountActivities(stateCtx);
  assert.equal(deliverySlot.innerHTML, "", "antes de hydratar, el panel de confirmacion debe estar vacio (nada entregado localmente)");

  // 2) hydrate() DESPUES (async), como en los 8 guiones reales.
  await cloudStore.hydrate();

  // 3) La capa de datos se actualizo correctamente (control, ya probado en
  // tests/guide_cloud_sync_store.test.cjs).
  assert.equal(state["testDelivery-locked"], true, "state debe reflejar el candado que trajo la nube");
  assert.equal(state["testDelivery-delivery"].savedFileName, "Entrega_Remota.pdf", "state debe reflejar la entrega que trajo la nube");

  // 4) LA UI -- esto es lo que el fix corrige. El panel debe mostrar la
  // confirmacion recuperada de la nube.
  assert.match(
    deliverySlot.innerHTML,
    /entregada correctamente/i,
    "el panel de confirmacion de entrega debe repintarse tras hydrate() y mostrar la entrega recuperada de la nube"
  );
});

test("FIX: el bloqueo de campos de formulario (applyLock) se reevalua tras hydrate", async () => {
  const FILE_NAME = "guia-test-hydrate-render-form.html";
  const { docNode, saveBtn } = buildDom();

  let state = {};
  const remoteState = { "testForm-locked": true, campoForm: "Respuesta guardada en otro equipo" };

  const { ctx } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T22:00:05.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);
  const stateCtx = buildStateCtx(() => state, () => {}, FILE_NAME, ActivityStandard);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:hydrate-render-form",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  ActivityStandard.mountActivities(stateCtx);
  assert.equal(saveBtn.disabled, false, "antes de hydratar, el campo no deberia estar bloqueado (nada guardado localmente)");

  await cloudStore.hydrate();

  assert.equal(state["testForm-locked"], true, "state debe reflejar el candado que trajo la nube");
  assert.equal(
    saveBtn.disabled,
    true,
    "el boton 'Guardar respuestas' debe quedar bloqueado tras hydrate() (la actividad ya esta bloqueada en la nube)"
  );
});

// ── Parte 5 de la auditoria: el sentido contrario. Documenta (como prueba
// ejecutable, no solo como prosa) que hydrate() NUNCA debe pisar un estado
// local mas nuevo que el remoto, ni borrar campos que el remoto no trae --
// y que esto sigue siendo cierto DESPUES del fix del repintado. ──

test("CASO INVERSO (sigue verde despues del fix): si localStorage es MAS NUEVO que Firestore, hydrate() no lo pisa", async () => {
  const FILE_NAME = "guia-test-reverse.html";
  const { docNode } = buildDom();

  // Local: respuesta reciente, aun no confirmada como sincronizada.
  let state = { campoForm: "Respuesta local reciente, todavia no subida" };
  const localMeta = { updatedAt: "2026-08-31T23:00:00.000Z" };

  // Remoto: version vieja (anterior a la respuesta local).
  const remoteState = { campoForm: "Respuesta vieja en la nube" };

  const { ctx, localStorage } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T22:00:00.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);

  const storageKey = "sena_portal:test:guide-data:reverse";
  localStorage.setItem(storageKey + "__meta", JSON.stringify(localMeta));

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: storageKey,
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  await cloudStore.hydrate();

  assert.equal(
    state.campoForm,
    "Respuesta local reciente, todavia no subida",
    "lo local (mas nuevo) debe ganar el conflicto; la nube (mas vieja) NO debe pisarlo"
  );
});

test("CASO INVERSO: un estado remoto PARCIAL no borra campos que solo existen en local", async () => {
  const FILE_NAME = "guia-test-reverse-partial.html";
  const { docNode } = buildDom();

  // Local tiene 2 campos guardados; el remoto (mas nuevo) solo trae 1 --
  // simula un guardado parcial/admin que no toca todos los campos.
  let state = { campoA: "Respuesta A (solo local)", campoB: "Respuesta B (local vieja)" };
  const remoteState = { campoB: "Respuesta B (actualizada en la nube)" };

  const { ctx } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T23:00:00.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:reverse-partial",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  await cloudStore.hydrate();

  assert.equal(state.campoA, "Respuesta A (solo local)", "un campo que el remoto (mas nuevo) ni menciona NO debe borrarse");
  assert.equal(state.campoB, "Respuesta B (actualizada en la nube)", "un campo que SI trae el remoto (mas nuevo) debe ganar sobre el local");
});

test("FIX: el panel 'Tu control de avance' tambien se repinta tras hydrate() (sin crear un segundo panel)", async () => {
  const FILE_NAME = "guia-test-avance.html";
  const { docNode, avancePanel } = buildDom();

  let state = {};
  const remoteState = {
    "testDelivery-locked": true,
    "testDelivery-delivery": { status: "delivered", submittedAt: "2026-08-31T22:00:00.000Z" },
  };

  const { ctx } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T22:00:05.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);
  const stateCtx = buildStateCtx(() => state, () => {}, FILE_NAME, ActivityStandard);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:avance",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  ActivityStandard.mountActivities(stateCtx);
  const panelCountBefore = docNode.body.children.filter((c) => c === avancePanel || c.getAttribute("data-act-std-avance") !== null).length;
  assert.doesNotMatch(avancePanel.innerHTML, /Entregada/, "antes de hydratar, el avance no deberia mostrar la actividad como entregada");

  await cloudStore.hydrate();

  assert.match(avancePanel.innerHTML, /Entregada/, "el panel de avance debe reflejar la entrega recuperada de la nube tras hydrate()");
  const panelCountAfter = docNode.body.children.filter((c) => c.getAttribute && c.getAttribute("data-act-std-avance") !== null).length;
  assert.equal(panelCountAfter, panelCountBefore, "no debe crearse un segundo panel de avance");
});

test("ESTADO ESTABLE: local YA entregado + remoto confirma lo mismo -- no rompe nada, panel se mantiene correcto", async () => {
  const FILE_NAME = "guia-test-steady-state.html";
  const { docNode, deliverySlot } = buildDom();

  // Local YA tiene la entrega (se guardo en ESTE mismo equipo hace un rato).
  let state = {
    "testDelivery-locked": true,
    "testDelivery-delivery": {
      status: "delivered",
      submittedAt: "2026-08-31T20:00:00.000Z",
      savedFileName: "Entrega_Original.pdf",
      driveUrl: "https://drive.google.com/file/d/LOCAL123/view?usp=sharing",
    },
  };
  // El remoto (mas nuevo, ya sincronizado antes) confirma exactamente lo mismo.
  const remoteState = JSON.parse(JSON.stringify(state));

  const { ctx } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: remoteState, updatedAt: "2026-08-31T20:00:05.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);
  const stateCtx = buildStateCtx(() => state, () => {}, FILE_NAME, ActivityStandard);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:steady-state",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  ActivityStandard.mountActivities(stateCtx);
  assert.match(deliverySlot.innerHTML, /entregada correctamente/i, "ya entregado localmente: el panel debe mostrarlo desde el primer mount");

  await cloudStore.hydrate();

  assert.match(deliverySlot.innerHTML, /entregada correctamente/i, "tras confirmar lo mismo desde la nube, el panel debe seguir correcto (no vacio, no duplicado)");
  assert.match(deliverySlot.innerHTML, /Entrega_Original\.pdf/, "debe seguir mostrando el archivo original, no uno distinto");
});

// ── Regresion critica (motivo real de elegir la Opcion D en vez de volver a
// llamar mountActivities()): varias hidrataciones/refrescos consecutivos NO
// deben ir acumulando listeners. Se prueba disparando el evento 3 veces
// (simula 3 ciclos de hydrate/refresco periodico) y verificando que una
// entrega REAL posterior (evento "guide-delivery-registered", disparado UNA
// sola vez) ejecuta su handler UNA sola vez -- no 3 veces. ──

test("NO DUPLICACION: disparar 'activity-deadlines-updated' 3 veces seguidas no acumula listeners -- una entrega real despues se procesa UNA sola vez", async () => {
  const FILE_NAME = "guia-test-no-duplicate-listeners.html";
  const { docNode, deliverySlot } = buildDom();

  let state = {};
  let saveStateCalls = 0;

  const { ctx, windowObj } = loadRealModules(docNode, {
    cloudGetGuideData: async () => ({ state: {}, updatedAt: "2026-08-31T22:00:00.000Z" }),
  });
  const ActivityStandard = ctx.window.ActivityStandard;
  registerTestGuide(ActivityStandard, FILE_NAME);
  const stateCtx = buildStateCtx(() => state, () => { saveStateCalls += 1; }, FILE_NAME, ActivityStandard);

  const cloudStore = ctx.window.GuideCloudSync.createStore({
    storageKey: "sena_portal:test:guide-data:no-duplicate",
    guideDataFile: FILE_NAME,
    getState: () => state,
    setState: (next) => { state = next; },
    getActor: () => "Aprendiz Prueba",
    onHydrated: () => {},
  });

  // Montaje normal UNA sola vez (como en produccion: mountActivities() nunca
  // se vuelve a llamar).
  ActivityStandard.mountActivities(stateCtx);

  // Simula 3 hidrataciones/refrescos consecutivos (cada uno dispara el mismo
  // evento; ninguno debe re-montar ni volver a registrar listeners).
  await cloudStore.hydrate(); // 1
  windowObj.dispatchEvent({ type: "activity-deadlines-updated" }); // 2 (simulado, como un 2do refresco)
  windowObj.dispatchEvent({ type: "activity-deadlines-updated" }); // 3 (simulado, como un 3er refresco)

  // Ahora ocurre UNA entrega real (el aprendiz sube el archivo en esta sesion).
  docNode.dispatchEvent({
    type: "guide-delivery-registered",
    detail: {
      panelKey: "testDelivery",
      status: "delivered",
      submittedAt: "2026-08-31T22:05:00.000Z",
      savedFileName: "Entrega_Real.pdf",
      driveUrl: "https://drive.google.com/file/d/REAL123/view?usp=sharing",
      activityNumber: "9.9.1",
      activityTitle: "Entrega de prueba",
    },
  });

  assert.equal(
    saveStateCalls,
    1,
    "una sola entrega real debe llamar saveState() EXACTAMENTE una vez -- si hubiera listeners duplicados, se llamaria 2 o 3 veces"
  );
  assert.equal(state["testDelivery-locked"], true, "la entrega real debe quedar reflejada en el state");
  assert.match(deliverySlot.innerHTML, /Entrega_Real\.pdf/, "el panel debe mostrar la entrega real (una sola vez, sin contenido duplicado)");
});
