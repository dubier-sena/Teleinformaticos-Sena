"use strict";

// Panel del instructor del Laboratorio Virtual (js/admin_hardware_lab.js):
// prueba las funciones PURAS de parseo/agregacion (parseHwlabState,
// summarizeStudent), expuestas solo para test via window.__hwlabAdminTest__
// (ver export al final del archivo fuente). No prueba el DOM/render.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadModule() {
  const sandbox = {
    window: {},
    document: { getElementById: () => null, addEventListener: () => {} },
    console: { warn() {}, error() {}, info() {} },
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, "..", "js", "admin_hardware_lab.js"), "utf8");
  vm.runInContext(code, sandbox);
  return sandbox.window.__hwlabAdminTest__;
}

const testApi = loadModule();

test("parseHwlabState separa practicas de ensamble/desensamble de casos de diagnostico por el nombre de la llave", () => {
  const state = {
    hwlab_desktop_disassembly_guided: { mode: "disassembly-guided", result: { score: 90 } },
    hwlab_desktop_assembly_open_libre: { mode: "assembly-open-libre", result: null },
    hwlab_desktop_diagnosis_caso_01: { result: { score: 100, status: "APROBADO" } },
    hwlab_laptop_diagnosis_caso_02: { result: null },
    otra_llave_no_relacionada: { foo: "bar" },
  };
  const parsed = testApi.parseHwlabState(state);
  assert.strictEqual(parsed.practices.length, 2);
  assert.strictEqual(parsed.diagnosisCases.length, 2);
  assert.ok(parsed.practices.some((p) => p.mode === "disassembly-guided" && p.equipmentId === "desktop"));
  assert.ok(parsed.practices.some((p) => p.mode === "assembly-open-libre"));
  assert.ok(parsed.diagnosisCases.some((c) => c.caseKey === "caso_01" && c.equipmentId === "desktop"));
  assert.ok(parsed.diagnosisCases.some((c) => c.caseKey === "caso_02" && c.equipmentId === "laptop"));
});

test("summarizeStudent calcula casos completados/pendientes, promedio y nivel alcanzado", () => {
  const parsed = {
    practices: [
      { key: "a", equipmentId: "desktop", mode: "disassembly-guided", session: { errors: 1, hints: { used: 0 }, result: { score: 80, status: "APROBADO", durationSeconds: 120 }, startedAt: "2026-08-01T10:00:00.000Z", finishedAt: "2026-08-01T10:02:00.000Z" } },
    ],
    diagnosisCases: [
      { key: "b", equipmentId: "desktop", caseKey: "caso_01", session: { errors: 0, hints: { used: 1 }, result: { score: 100, status: "APROBADO", durationSeconds: 60 }, startedAt: "2026-08-02T10:00:00.000Z", finishedAt: "2026-08-02T10:01:00.000Z" } },
      { key: "c", equipmentId: "desktop", caseKey: "caso_02", session: { errors: 2, hints: { used: 0 }, result: null, startedAt: "2026-08-03T10:00:00.000Z" } },
    ],
  };
  const user = { fullName: "Ana Perez", usernameKey: "ana.perez", ficha: "3441939" };
  const summary = testApi.summarizeStudent(user, parsed);

  assert.strictEqual(summary.attempts, 3);
  assert.strictEqual(summary.casesCompleted, 1); // solo caso_01 tiene status APROBADO
  assert.strictEqual(summary.casesPending, 1); // caso_02 sin resultado
  assert.strictEqual(summary.totalErrors, 3); // 1 + 0 + 2
  assert.strictEqual(summary.totalHints, 1);
  assert.strictEqual(summary.avgScore, 90); // promedio de 80 y 100 (caso_02 no cuenta, no tiene result)
  assert.strictEqual(summary.highestCasePassed, 1);
  // Ultima actividad: la mas reciente entre finishedAt/startedAt de las 3 sesiones.
  assert.strictEqual(summary.lastActivity, Date.parse("2026-08-03T10:00:00.000Z"));
});

test("summarizeStudent con cero intentos no revienta y da promedio null", () => {
  const summary = testApi.summarizeStudent({ fullName: "Nadie" }, { practices: [], diagnosisCases: [] });
  assert.strictEqual(summary.attempts, 0);
  assert.strictEqual(summary.avgScore, null);
  assert.strictEqual(summary.casesCompleted, 0);
  assert.strictEqual(summary.casesPending, 0);
});
