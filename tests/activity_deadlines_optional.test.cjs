const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.join(__dirname, "..");

function loadDeadlineManager(prepare) {
  const script = fs.readFileSync(path.join(REPO_ROOT, "js", "activity_deadlines.js"), "utf8");
  const documentOverride = { current: null };
  const sandbox = {
    window: {
      localStorage: {
        store: {},
        getItem(key) {
          return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
        },
        setItem(key, value) {
          this.store[key] = String(value);
        },
      },
      dispatchEvent() {},
      addEventListener() {},
      removeEventListener() {},
      alert() {},
    },
    localStorage: null,
    CustomEvent: function CustomEvent(name, init) {
      this.type = name;
      this.detail = init?.detail;
    },
    document: {
      getElementById(id) {
        return documentOverride.current?.getElementById?.(id) || null;
      },
      querySelectorAll(selector) {
        return documentOverride.current?.querySelectorAll?.(selector) || [];
      },
      createElement() { return { style: {}, className: "", hidden: false, textContent: "" }; },
    },
    console,
    Date,
  };
  sandbox.localStorage = sandbox.window.localStorage;
  if (typeof prepare === "function") {
    prepare(sandbox);
  }
  vm.runInNewContext(script, sandbox);
  sandbox.window.activityDeadlineManager.__testDocument = documentOverride;
  return sandbox.window.activityDeadlineManager;
}

test("deadline manager keeps deadlines optional by default", () => {
  const manager = loadDeadlineManager();
  const evaluation = manager.evaluatePolicy(null, new Date("2026-04-30T10:00:00"));
  assert.equal(evaluation.hasDeadline, false);
  assert.equal(evaluation.state, "none");
});

test("deadline manager closes an activity only after the configured due date", () => {
  const manager = loadDeadlineManager();
  const active = manager.evaluatePolicy({ dueAt: "2026-05-10T18:00" }, new Date("2026-05-10T17:00:00"));
  const closed = manager.evaluatePolicy({ dueAt: "2026-05-10T18:00" }, new Date("2026-05-10T18:30:00"));
  assert.equal(active.state, "active");
  assert.equal(closed.state, "closed");
});

test("deadline close blocks action buttons without disabling response fields", async () => {
  const manager = loadDeadlineManager();
  await manager.ready();
  await manager.savePolicy(
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "extensiones331",
    "2026-04-30T08:00",
    "admin"
  );

  const field = {
    tagName: "TEXTAREA",
    style: {},
    disabled: false,
    setAttribute(name, value) {
      this[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
    },
  };
  const button = {
    tagName: "BUTTON",
    style: {},
    disabled: false,
    textContent: "Guardar respuestas",
    setAttribute(name, value) {
      this[name] = value;
    },
    removeAttribute(name) {
      delete this[name];
    },
  };
  manager.__test.setNowProvider(() => new Date("2026-04-30T09:00:00"));
  manager.__testDocument.current = {
    querySelectorAll(selector) {
      return selector === "[data-store='respuesta']" ? [field] : [];
    },
    getElementById(id) {
      return id === "saveButton" ? button : null;
    },
  };

  const result = manager.applyAvailability({
    pageFile: "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    activityId: "extensiones331",
    fieldSelector: "[data-store='respuesta']",
    buttonId: "saveButton",
    closedButtonText: "Entrega cerrada",
  });

  manager.__test.setNowProvider(null);
  manager.__testDocument.current = null;

  assert.equal(result.blocked, true);
  assert.equal(field.disabled, false);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Entrega cerrada");
});

test("deadline manager resolves guide storage aliases to the public guide file", async () => {
  const manager = loadDeadlineManager();
  await manager.ready();
  await manager.savePolicy(
    "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
    "extensiones331",
    "2026-04-30T08:00",
    "admin"
  );

  manager.__test.setNowProvider(() => new Date("2026-04-30T09:00:00"));
  const canSubmit = manager.canSubmit({
    pageFile: "10a_guia2.html",
    activityId: "extensiones331",
    showAlert: false,
  });
  manager.__test.setNowProvider(null);

  assert.equal(canSubmit, false);
});

test("deadline manager catalog covers the supported guide activities", () => {
  const manager = loadDeadlineManager();
  const induction = manager.getActivitiesForGuide("grupo-10a-guia-01-induccion.html");
  const guide2 = manager.getActivitiesForGuide("grupo-10a-guia-02-herramientas-informaticas-digitales.html");
  const guide6 = manager.getActivitiesForGuide("grupo-11a-guia-06-planificar-informacion.html");
  const redes = manager.getActivitiesForGuide("santa-barbara-10a-guia-02-redes-rap01.html");

  assert.ok(induction.some((item) => item.id === "arbol312"));
  assert.ok(induction.some((item) => item.id === "programa332"));
  assert.ok(guide2.some((item) => item.id === "colaborativas334"));
  assert.ok(guide2.some((item) => item.id === "suite333"));
  assert.ok(guide6.some((item) => item.id === "bitacora311"));
  assert.ok(guide6.some((item) => item.id === "tabla321"));
  assert.ok(redes.some((item) => item.id === "lab1"));
  assert.ok(redes.some((item) => item.id === "reflexion311"));
  assert.ok(redes.some((item) => item.id === "socializacion311"));
});

test("public guide entry and admin panel load the optional deadline manager", () => {
  const guiaHtml = fs.readFileSync(path.join(REPO_ROOT, "guia.html"), "utf8");
  const adminHtml = fs.readFileSync(path.join(REPO_ROOT, "panel-administrativo-usuarios.html"), "utf8");
  const directGuideHtml = fs.readFileSync(
    path.join(REPO_ROOT, "pages", "guias", "grupo-10a-guia-02-herramientas-informaticas-digitales.html"),
    "utf8"
  );

  assert.match(guiaHtml, /js\/activity_deadlines\.js/);
  assert.match(adminHtml, /js\/activity_deadlines\.js/);
  assert.match(directGuideHtml, /js\/activity_deadlines\.js/);
});

test("admin and guide scripts wire the optional deadline controls", () => {
  const adminScript = fs.readFileSync(path.join(REPO_ROOT, "js", "admin_usuarios.js"), "utf8");
  const adminDeadlinesScript = fs.readFileSync(path.join(REPO_ROOT, "js", "admin_deadlines.js"), "utf8");
  const inductionScript = fs.readFileSync(path.join(REPO_ROOT, "js", "script_induccion.js"), "utf8");
  const guide2Script = fs.readFileSync(path.join(REPO_ROOT, "js", "script_guia2.js"), "utf8");
  const guide6Script = fs.readFileSync(path.join(REPO_ROOT, "js", "script_guia6.js"), "utf8");
  const redesScript = fs.readFileSync(path.join(REPO_ROOT, "js", "script_guia_redes.js"), "utf8");
  const deadlineScript = fs.readFileSync(path.join(REPO_ROOT, "js", "activity_deadlines.js"), "utf8");
  const sharedDrive = fs.readFileSync(path.join(REPO_ROOT, "js", "shared_drive_delivery.js"), "utf8");

  assert.match(adminScript, /window\.adminDeadlines\.buildConfigPanel/);
  assert.match(adminDeadlinesScript, /Fechas opcionales de entrega/);
  assert.match(adminDeadlinesScript, /data-save-activity-deadline/);
  assert.match(inductionScript, /installInduccionDeadlineControls/);
  assert.match(inductionScript, /arbol312/);
  assert.match(guide2Script, /activityDeadlineManager/);
  assert.match(guide2Script, /adminMount:\s*\{\s*mountSelector:\s*"#extensiones331DeadlineControls"/);
  assert.match(guide2Script, /adminMount:\s*\{\s*mountSelector:\s*"#sistemas332DeadlineControls"/);
  assert.match(guide6Script, /activity-deadlines-updated/);
  assert.match(guide6Script, /adminMount:\s*\{\s*mountSelector:\s*"#bitacora311DeadlineControls"/);
  assert.match(guide6Script, /adminMount:\s*\{\s*mountSelector:\s*"#socializacion312DeadlineControls"/);
  assert.match(redesScript, /installRedesDeadlineWrappers/);
  assert.match(deadlineScript, /activity-deadline-admin-inline/);
  assert.match(deadlineScript, /Guardar fecha/);
  assert.match(sharedDrive, /delivery-deadline-admin-slot/);
  assert.match(sharedDrive, /deadlineActivityId/);
});

// ── Bug jul-17: fecha eliminada por el admin no desbloqueaba al aprendiz ──────
// El aprendiz guardaba en localStorage una copia del snapshot de fechas; al
// eliminar el admin la fecha, la lectura de nube del aprendiz devolvia null
// (403 en reglas + denegacion del Apps Script) y la copia local vieja ganaba
// para siempre: la guia quedaba "Entrega cerrada" sin fecha vigente.

test("fecha eliminada por el admin en la nube gana a la copia local vieja", async () => {
  const staleLocal = {
    policies: {
      "grupo-10a-guia-02-herramientas-informaticas-digitales.html": {
        extensiones331: {
          dueAt: "2026-07-01T13:00:00.000Z",
          updatedAt: "2026-07-01T12:00:00.000Z",
          updatedBy: "admin",
        },
      },
    },
    updatedAt: "2026-07-01T12:00:00.000Z",
    updatedBy: "admin",
  };
  let seenOpts = null;
  const manager = loadDeadlineManager((sandbox) => {
    sandbox.window.localStorage.setItem(
      "sena_portal_admin_activity_deadlines_v1",
      JSON.stringify(staleLocal)
    );
    sandbox.window._firebaseDb = {
      cloudGetGuideData(scopeKey, fileName, opts) {
        seenOpts = opts || null;
        // El admin ya elimino la fecha: snapshot MAS NUEVO con policies vacias.
        return Promise.resolve({
          policies: {},
          updatedAt: "2026-07-17T12:00:00.000Z",
          updatedBy: "admin",
        });
      },
    };
  });
  await manager.ready();

  assert.equal(seenOpts?.firestoreFirst, true, "debe leer Firestore directo, no la replica Drive");
  assert.equal(seenOpts?.skipDriveOn404, true, "un miss real no debe pegarle a Apps Script");
  assert.equal(
    manager.getPolicy("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "extensiones331"),
    null,
    "la eliminacion (updatedAt mas nuevo) debe reemplazar la copia local vieja"
  );
});

test("contrato con firebase_db.js: fsGet honra firestoreFirst y el docId compartido es el esperado", () => {
  const db = fs.readFileSync(path.join(REPO_ROOT, "js", "firebase_db.js"), "utf8");
  // fsGet debe pasar opts al ruteo para que firestoreFirst pueda saltarse Drive.
  assert.match(db, /canCallFirestore\(collection, false, opts\)/);
  assert.match(db, /opts && opts\.firestoreFirst/);
  // El docId que autorizan firestore.rules y el Apps Script debe coincidir con
  // el que construye guideStateDocId: prefijo + safeCloudKey(scope) + ":" + fileNameToKey(file).
  const SHARED_DOC_ID = "__guide_data__:admin:activity-deadlines:__activity_deadlines_v1";
  const rules = fs.readFileSync(path.join(REPO_ROOT, "firestore.rules"), "utf8");
  const gs = fs.readFileSync(path.join(REPO_ROOT, "apps-script", "respaldo_firestore.gs"), "utf8");
  assert.ok(rules.includes(SHARED_DOC_ID), "firestore.rules debe autorizar el doc compartido de fechas");
  assert.ok(gs.includes(SHARED_DOC_ID), "respaldo_firestore.gs debe autorizar el doc compartido de fechas");
});
