const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

// buildGradeBadge() es una funcion privada de activity_grades.js (no se
// expone en window.activityGradesManager) -- se inserta una exposicion
// extra SOLO en esta copia de prueba, mismo patron ya usado en otros tests
// de este repo (p. ej. tests/portal_home_callouts.test.cjs).
function makeEl() {
  const el = { className: "", attrs: {}, _html: "" };
  el.setAttribute = (name, value) => { el.attrs[name] = value; };
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = v; },
  });
  return el;
}

function loadManagerWithBadgeExposed() {
  const ctx = {
    window: {},
    document: {
      querySelector: () => null,
      createElement: () => makeEl(),
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console,
    URL,
    Date,
  };
  ctx.window.location = { href: "https://x/" };
  ctx.window.portalAuth = { getCurrentSession: () => null };
  ctx.window._firebaseDb = {};
  ctx.window.ActivityStandard = {};
  vm.createContext(ctx);

  let code = fs.readFileSync(path.join(root, "js", "activity_grades.js"), "utf8");
  assert.match(code, /\n\}\)\(\);\s*$/, "no se pudo ubicar el cierre del IIFE de activity_grades.js para exponer buildGradeBadge en la prueba");
  code = code.replace(/\n\}\)\(\);\s*$/, "\n  window.__buildGradeBadge = buildGradeBadge;\n})();");
  vm.runInContext(code, ctx, { filename: "activity_grades.js" });
  return ctx.window;
}

test("buildGradeBadge: 'No aprobado' SIN motivo se ve igual que antes (sin linea extra)", () => {
  const win = loadManagerWithBadgeExposed();
  const badge = win.__buildGradeBadge("D", "matriz322", "2026-07-09T00:00:00.000Z", "");

  assert.match(badge.innerHTML, /No aprobado/);
  assert.doesNotMatch(badge.innerHTML, /grade-badge-obs/, "sin motivo, no debe agregar el span de motivo");
});

test("buildGradeBadge: 'No aprobado' CON motivo predeterminado lo muestra junto al badge", () => {
  const win = loadManagerWithBadgeExposed();
  const badge = win.__buildGradeBadge("D", "matriz322", "2026-07-09T00:00:00.000Z", "No entregó la actividad en los tiempos establecidos.");

  assert.match(badge.innerHTML, /No aprobado/);
  assert.match(badge.innerHTML, /grade-badge-obs/);
  assert.match(badge.innerHTML, /No entreg.* en los tiempos establecidos/);
});

test("buildGradeBadge: el motivo se escapa (no permite inyectar HTML desde el campo de texto libre)", () => {
  const win = loadManagerWithBadgeExposed();
  const badge = win.__buildGradeBadge("D", "matriz322", "", '<img src=x onerror=alert(1)>');

  assert.doesNotMatch(badge.innerHTML, /<img/, "el motivo con HTML crudo no debe insertarse sin escapar (XSS)");
  assert.match(badge.innerHTML, /&lt;img/);
});

test("buildGradeBadge: 'Aprobado' ignora el motivo (el motivo solo aplica a No aprobado)", () => {
  const win = loadManagerWithBadgeExposed();
  const badge = win.__buildGradeBadge("A", "matriz322", "", "No entregó a tiempo.");

  assert.match(badge.innerHTML, /Aprobado/);
  assert.doesNotMatch(badge.innerHTML, /grade-badge-obs/);
});
