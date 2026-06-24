// Logica pura de los planes de mejoramiento (sin DOM/almacenamiento).
const test = require("node:test");
const assert = require("node:assert");
const { makePlan, applyDeadlineChange, derivePlanStatus, STATUS_LABELS } = require("../js/improvement_plans.js");

const DAY = 86400000;

test("makePlan: valores por defecto y campos clave", () => {
  const now = Date.parse("2026-06-24T12:00:00Z");
  const p = makePlan({ activityId: "extensiones331", family: "guia-02-herramientas", guideFile: "g.html", fechaLimite: "2026-06-30", asignadoPor: "dubier", now });
  assert.match(p.id, /^plan_extensiones331_/);
  assert.equal(p.estado, "asignado");
  assert.equal(p.activityId, "extensiones331");
  assert.equal(p.fechaLimite, "2026-06-30");
  assert.equal(p.asignadoPor, "dubier");
  assert.match(p.motivo, /tiempo establecido/);          // motivo por defecto
  assert.equal(p.historialFechas.length, 1);
  assert.equal(p.historialFechas[0].fecha, "2026-06-30");
  assert.equal(p.resultado, "");
});

test("makePlan: respeta un motivo dado", () => {
  const p = makePlan({ activityId: "a", motivo: "Faltan evidencias del taller" });
  assert.equal(p.motivo, "Faltan evidencias del taller");
});

test("applyDeadlineChange: cambia fecha, deja rastro y re-habilita vencido", () => {
  const now = Date.parse("2026-06-25T00:00:00Z");
  let p = makePlan({ activityId: "a", fechaLimite: "2026-06-20", now: now - DAY });
  p.estado = "vencido";
  const upd = applyDeadlineChange(p, "2026-07-05", now);
  assert.equal(upd.fechaLimite, "2026-07-05");
  assert.equal(upd.historialFechas.length, 2);           // se agrego el cambio
  assert.equal(upd.historialFechas[1].fecha, "2026-07-05");
  assert.equal(upd.estado, "asignado");                  // vencido -> re-habilitado
});

test("derivePlanStatus: resultado tiene prioridad", () => {
  assert.equal(derivePlanStatus({ resultado: "A" }), "superado");
  assert.equal(derivePlanStatus({ resultado: "D" }), "no_superado");
});

test("derivePlanStatus: entrega -> entregado; vencido por fecha; futuro -> asignado", () => {
  const now = Date.parse("2026-06-30T12:00:00Z");
  assert.equal(derivePlanStatus({ fechaLimite: "2026-07-10" }, now, true), "entregado");
  assert.equal(derivePlanStatus({ fechaLimite: "2026-06-29" }, now), "vencido");   // paso la fecha, sin entrega
  assert.equal(derivePlanStatus({ fechaLimite: "2026-07-10" }, now), "asignado");  // fecha futura
});

test("STATUS_LABELS cubre todos los estados", () => {
  ["asignado", "entregado", "superado", "no_superado", "vencido"].forEach((s) => {
    assert.ok(STATUS_LABELS[s], "falta label para " + s);
  });
});
