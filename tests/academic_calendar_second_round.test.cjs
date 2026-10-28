"use strict";
// Segunda ronda de asignaciones (2026-10-28): para aprendices que inician sesión por primera vez después de la
// ventana. No toca sesiones; comprueba todo antes de escribir; nunca sobrescribe una asignación distinta.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const D = require(path.join(__dirname, "..", "tools", "academic_calendar_deploy.cjs"));
const ADMIN = "demoAdminFicticio00000000001";
const uid = (i) => "demoSegundaRondaFicticia" + String(i).padStart(4, "0");
function api(existing, role = "admin", me = ADMIN) {
  const store = new Map(Object.entries(existing || {})), writes = [];
  return { writes, store,
    principal: async () => ({ uid: me, role, active: true, fichas: ["3441939"] }),
    readAssignment: async (u) => (store.has(u) ? { data: store.get(u) } : null),
    assign: async (u, a) => { writes.push(u); store.set(u, a); return { data: a }; } };
}
const A = (u, f = "3441939") => ({ uid: u, role: "aprendiz", active: true, fichas: [f] });

test("asigna los nuevos, omite los ya presentes iguales", async () => {
  const x = api({ [uid(1)]: { role: "aprendiz", active: true, fichas: ["3441939"] } });
  const r = await D.assignOnly({ assignments: { instructor: { uid: ADMIN }, asignacionesAprendiz: [A(uid(1)), A(uid(2)), A(uid(3), "3168850")] }, api: x });
  assert.deepEqual(r.assigned, [uid(2), uid(3)]); assert.deepEqual(r.skipped, [uid(1)]);
});
test("una asignación existente distinta detiene todo ANTES de escribir", async () => {
  const x = api({ [uid(1)]: { role: "aprendiz", active: true, fichas: ["3168850"] } });
  await assert.rejects(() => D.assignOnly({ assignments: { asignacionesAprendiz: [A(uid(2)), A(uid(1))] }, api: x }), /no se sobrescribe/);
  assert.deepEqual(x.writes, []);
});
test("rechaza UID inválidos, duplicados, roles distintos de aprendiz, varias fichas y fichas ajenas", async () => {
  const bad = [[{ uid: "corto", role: "aprendiz", active: true, fichas: ["3441939"] }], [A(uid(1)), A(uid(1))], [{ ...A(uid(1)), role: "admin" }], [{ ...A(uid(1)), fichas: ["3441939", "3441942"] }], [A(uid(1), "9999999")], [{ ...A(uid(1)), active: false }]];
  for (const list of bad) { const x = api(); await assert.rejects(() => D.assignOnly({ assignments: { asignacionesAprendiz: list }, api: x })); assert.deepEqual(x.writes, []); }
});
test("solo el administrador verificado; nunca se asigna al propio administrador como aprendiz", async () => {
  await assert.rejects(() => D.assignOnly({ assignments: { asignacionesAprendiz: [A(uid(1))] }, api: api({}, "aprendiz", uid(9)) }));
  await assert.rejects(() => D.assignOnly({ assignments: { instructor: { uid: "otroAdminFicticio000000000001" }, asignacionesAprendiz: [A(uid(1))] }, api: api() }));
  await assert.rejects(() => D.assignOnly({ assignments: { asignacionesAprendiz: [A(ADMIN)] }, api: api() }), /administrador/);
});
test("la ejecución en producción sigue deshabilitada también para la segunda ronda", () => {
  const src = require("node:fs").readFileSync(path.join(__dirname, "..", "tools", "academic_calendar_deploy.cjs"), "utf8");
  const i = src.indexOf("if(objetivo==='produccion')throw"), j = src.indexOf("if(soloAsignaciones){const r=await assignOnly");
  assert.ok(i > 0 && j > i, "el bloqueo de producción ocurre antes de la segunda ronda");
});
