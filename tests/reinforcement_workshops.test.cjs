// Logica pura de los talleres de refuerzo (sin DOM/almacenamiento).
const test = require("node:test");
const assert = require("node:assert");
const { makeWorkshop, applyWorkshopDeadlineChange, deriveWorkshopStatus, WORKSHOP_STATUS_LABELS } = require("../js/reinforcement_workshops.js");

const DAY = 86400000;

test("makeWorkshop: valores por defecto y campos clave", () => {
  const now = Date.parse("2026-08-21T12:00:00Z");
  const w = makeWorkshop({ workshopKey: "guia-01-induccion", title: "Taller de Refuerzo — Guía de Inducción", fileUrl: "assets/materiales/talleres_refuerzo/induccion/TALLER_REFUERZO_Guia_Induccion.pdf", fechaLimite: "2026-09-05", asignadoPor: "dubier", now });
  assert.match(w.id, /^taller_guia-01-induccion_/);
  assert.equal(w.estado, "asignado");
  assert.equal(w.workshopKey, "guia-01-induccion");
  assert.equal(w.fechaLimite, "2026-09-05");
  assert.equal(w.asignadoPor, "dubier");
  assert.equal(w.motivo, "");                              // opcional, sin default (a diferencia de Mejoramiento)
  assert.equal(w.historialFechas.length, 1);
  assert.equal(w.historialFechas[0].fecha, "2026-09-05");
  assert.equal(w.resultado, "");
  assert.equal(w.entrega, null);
});

test("makeWorkshop: respeta un motivo dado", () => {
  const w = makeWorkshop({ workshopKey: "guia-01-induccion", motivo: "Refuerzo preventivo" });
  assert.equal(w.motivo, "Refuerzo preventivo");
});

test("applyWorkshopDeadlineChange: cambia fecha, deja rastro y re-habilita vencido", () => {
  const now = Date.parse("2026-09-10T00:00:00Z");
  let w = makeWorkshop({ workshopKey: "guia-01-induccion", fechaLimite: "2026-09-05", now: now - DAY });
  w.estado = "vencido";
  const upd = applyWorkshopDeadlineChange(w, "2026-09-20", now);
  assert.equal(upd.fechaLimite, "2026-09-20");
  assert.equal(upd.historialFechas.length, 2);              // se agrego el cambio
  assert.equal(upd.historialFechas[1].fecha, "2026-09-20");
  assert.equal(upd.estado, "asignado");                     // vencido -> re-habilitado
});

test("deriveWorkshopStatus: resultado tiene prioridad", () => {
  assert.equal(deriveWorkshopStatus({ resultado: "A" }), "superado");
  assert.equal(deriveWorkshopStatus({ resultado: "D" }), "no_superado");
});

test("deriveWorkshopStatus: entrega -> entregado; vencido por fecha; futuro -> asignado", () => {
  const now = Date.parse("2026-08-25T12:00:00Z");
  assert.equal(deriveWorkshopStatus({ fechaLimite: "2026-09-05" }, now, true), "entregado");
  assert.equal(deriveWorkshopStatus({ fechaLimite: "2026-08-24" }, now), "vencido");    // paso la fecha, sin entrega
  assert.equal(deriveWorkshopStatus({ fechaLimite: "2026-09-05" }, now), "asignado");   // fecha futura
});

test("WORKSHOP_STATUS_LABELS cubre todos los estados", () => {
  ["asignado", "entregado", "superado", "no_superado", "vencido"].forEach((s) => {
    assert.ok(WORKSHOP_STATUS_LABELS[s], "falta label para " + s);
  });
});
