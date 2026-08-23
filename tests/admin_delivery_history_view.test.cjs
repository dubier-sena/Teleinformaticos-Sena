"use strict";

// Auditoria 2026-08-22, Fase 11: el panel admin ("Respuestas") no mostraba el
// historial de reentregas (delivery.historialEntregas ya existia en el
// estado desde antes de esta sesion, ver activity_standard.js, pero nunca se
// renderizaba). Cubre que buildResponsesView llame a la nueva seccion y que
// esta nunca borre ni oculte la entrega actual.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }

test("buildResponsesView incluye la seccion de historial de entregas", () => {
  const code = read(path.join("js", "admin_usuarios.js"));
  assert.match(code, /function buildDeliveryHistorySection\(delivery\)/);
  const fn = code.match(/function buildResponsesView\(summary\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fn, "buildResponsesView debe existir");
  assert.match(fn[0], /buildDeliveryHistorySection\(summary\.delivery\)/);
});

test("buildDeliveryHistorySection: sin historial (nunca hubo reentrega) no muestra nada", () => {
  const code = read(path.join("js", "admin_usuarios.js"));
  const fn = code.match(/function buildDeliveryHistorySection\(delivery\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(fn);
  // Ejecuta la funcion pura en un sandbox minimo (solo necesita escapeHtml/formatDate/formatTime,
  // que se stubbean aqui para no arrastrar las 5000 lineas del archivo completo).
  const sandbox = {
    escapeHtml: (v) => String(v ?? ""),
    formatDate: (v) => (v ? "18/08/2026" : ""),
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fn[0] + "\n" +
    (code.match(/function formatTime\(iso\)\s*\{[\s\S]*?\n  \}/) || [""])[0] + "\n" +
    "this.result = buildDeliveryHistorySection(undefined);",
    sandbox
  );
  assert.equal(sandbox.result, "", "sin delivery/historial, no debe imprimir ninguna seccion");
});

test("buildDeliveryHistorySection: con 2 reentregas anteriores, muestra ambas con su metodo y enlace, sin perder ninguna", () => {
  const code = read(path.join("js", "admin_usuarios.js"));
  const fnSrc = code.match(/function buildDeliveryHistorySection\(delivery\)\s*\{[\s\S]*?\n  \}/)[0];
  const timeSrc = (code.match(/function formatTime\(iso\)\s*\{[\s\S]*?\n  \}/) || [""])[0];
  const sandbox = {
    escapeHtml: (v) => String(v ?? ""),
    formatDate: (v) => (v ? "fecha(" + v + ")" : ""),
    Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fnSrc + "\n" + timeSrc + "\n" +
    `this.result = buildDeliveryHistorySection({
      historialEntregas: [
        { submittedAt: "2026-08-18T14:35:00.000Z", savedFileName: "v1.pdf", driveUrl: "https://drive/aaa", method: "automatic" },
        { submittedAt: "2026-08-20T16:10:00.000Z", savedFileName: "v2.pdf", driveUrl: "https://drive/bbb", method: "manual-verified" },
      ],
    });`,
    sandbox
  );
  assert.match(sandbox.result, /Historial de entregas \(2 anteriores\)/);
  assert.match(sandbox.result, /v1\.pdf/);
  assert.match(sandbox.result, /v2\.pdf/);
  assert.match(sandbox.result, /https:\/\/drive\/aaa/);
  assert.match(sandbox.result, /https:\/\/drive\/bbb/);
  assert.match(sandbox.result, /Manual verificada/);
  assert.match(sandbox.result, /Automatica/);
});
