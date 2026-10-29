"use strict";
// Detector de diferencias entre el calendario anterior y las sesiones importadas (solo archivos locales).
const test = require("node:test");
const assert = require("node:assert/strict");
const { compare } = require("../tools/academic_calendar_divergence.cjs");

const P = "sena_portal_calendar_fichas/3441942/years/2026/sessions/";
const session = (id, date, status, blocks, states) => ({ path: P + id, data: { id, ficha: "3441942", date, status, blocks, sourceStatuses: states.map((state, i) => ({ sourceId: date + "|f" + i, state })) } });
const pkg = (...sessions) => ({ documents: [...sessions, { path: P + "x/audit/0", data: {} }] });

test("sin cambios en el anterior no hay diferencias", () => {
  const s = session("a", "2026-10-27", "Activa", [{ start: "14:10", end: "18:10" }], ["Activa"]);
  assert.deepEqual(compare({ imported: pkg(s), current: pkg(s) }), []);
});

test("una clase marcada Impartida solo en el anterior aparece como sesión cambiada", () => {
  const before = session("a", "2026-10-27", "Activa", [{ start: "14:10", end: "18:10" }], ["Activa"]);
  const after = session("a", "2026-10-27", "Impartida", [{ start: "14:10", end: "18:10" }], ["Impartida"]);
  const d = compare({ imported: pkg(before), current: pkg(after) });
  assert.equal(d.length, 1);
  assert.equal(d[0].tipo, "sesion-cambiada-en-anterior");
  assert.equal(d[0].importada.status, "Activa");
  assert.equal(d[0].ahora.status, "Impartida");
});

test("sesiones nuevas o ausentes en el anterior se informan", () => {
  const a = session("a", "2026-10-27", "Activa", [{ start: "14:10", end: "18:10" }], ["Activa"]);
  const b = session("b", "2026-10-28", "Activa", [{ start: "14:10", end: "18:10" }], ["Activa"]);
  const tipos = compare({ imported: pkg(a), current: pkg(b) }).map((x) => x.tipo).sort();
  assert.deepEqual(tipos, ["sesion-ausente-en-anterior", "sesion-nueva-en-anterior"]);
});

test("una clase manual cuya franja no cubre ninguna sesión se informa; una cubierta o cancelada no", () => {
  const s = session("a", "2026-09-15", "Impartida", [{ start: "07:00", end: "09:55" }], ["Impartida"]);
  const manual = [
    { type: "CLASE", ficha: "3441942", date: "2026-09-15", status: "scheduled", slots: [{ startAt: "2026-09-15T14:15:00-05:00", endAt: "2026-09-15T16:15:00-05:00" }] },
    { type: "CLASE", ficha: "3441942", date: "2026-09-15", status: "scheduled", slots: [{ startAt: "2026-09-15T07:00:00-05:00", endAt: "2026-09-15T09:00:00-05:00" }] },
    { type: "CLASE", ficha: "3441942", date: "2026-09-16", status: "cancelled", startAt: "2026-09-16T14:15:00-05:00", endAt: "2026-09-16T16:15:00-05:00" },
    { type: "ACTIVIDAD_ESPECIAL", ficha: "3441942", date: "2026-09-17" },
  ];
  const d = compare({ imported: pkg(s), current: pkg(s), manual });
  assert.equal(d.length, 1);
  assert.equal(d[0].tipo, "clase-manual-sin-sesion");
  assert.deepEqual(d[0].franjas, [{ start: "14:15", end: "16:15" }]);
});

test("las sesiones con estados mixtos se listan para revisión", () => {
  const s = session("m", "2026-10-19", "Estados mixtos — revisar", [{ start: "09:00", end: "09:55" }], ["Impartida", "Activa"]);
  const d = compare({ imported: pkg(s), current: pkg(s) });
  assert.equal(d.length, 1);
  assert.equal(d[0].tipo, "sesion-con-estados-mixtos");
});
