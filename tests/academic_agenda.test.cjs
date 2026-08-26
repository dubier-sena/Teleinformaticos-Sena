"use strict";

// Fase Agenda Academica (bloque agregador central, 2026-08-24):
// js/academic_agenda.js es la capa de normalizacion PURA que consolida
// clases legacy, deadlines de guia (incluye Taller Integrador via
// activityDeadlineManager), bitacoras/Sofia Plus y documentos base de
// Etapa Productiva sin fecha. require() directo (no vm.createContext): ya
// nos golpeo el gotcha de cross-realm (Date/Object de otro realm) en el
// bloque anterior -- ver tests/productive_stage_deadlines.test.cjs.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const agenda = require(path.join(root, "js/academic_agenda.js"));
const productiveStageDeadlines = require(path.join(root, "js/productive_stage_deadlines.js"));

const JFK_10A = { ficha: "3441939", grupo: "10A", institucionShort: "I.E. Jhon F. Kennedy", institucionLong: "Institucion Educativa Jhon F. Kennedy" };
const SB_11A = { ficha: "3168850", grupo: "11A", institucionShort: "I.E. Santa Bárbara", institucionLong: "Institucion Educativa Santa Barbara", hasProductiveStage: true };

function guide(pageFile, guideTitle, activities) {
  return { pageFile: pageFile, guideTitle: guideTitle, route: "guia.html?g=" + pageFile, activities: activities };
}

const DOC_CATALOG = [
  { id: "ficha-inscripcion", title: "Ficha de inscripcion", deliveryLabel: "Ficha de Inscripcion" },
  { id: "acuerdo-etapa-productiva", title: "Acuerdo de Etapa Productiva", deliveryLabel: "Acuerdo de Etapa Productiva" },
  { id: "sofia-plus", title: "Pantallazo Sofia Plus", deliveryLabel: "Pantallazo Sofia Plus" },
  { id: "bitacora-1", title: "Bitacora N 1", deliveryLabel: "Bitacora 1" },
  { id: "bitacora-2", title: "Bitacora N 2", deliveryLabel: "Bitacora 2" },
];

// 1. Deadline de guia -> evento ENTREGA -------------------------------------

test("1. deadline de actividad de guia produce un evento ENTREGA con la fecha real", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    now: new Date("2026-08-24T15:00:00.000Z"),
    guideCatalog: [guide("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "Guia 2", [
      { id: "matriz322", label: "Actividad 3.2.2 - Matriz" },
    ])],
    deadlinesSnapshot: {
      policies: {
        "grupo-10a-guia-02-herramientas-informaticas-digitales.html": {
          matriz322: { dueAt: "2026-08-28T22:30:00.000Z", updatedAt: "x", updatedBy: "admin" },
        },
      },
    },
  });

  const events = result.events.filter((e) => e.source === "guide-deadline");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, agenda.TYPE.ENTREGA);
  assert.equal(events[0].dueAt, "2026-08-28T22:30:00.000Z");
  assert.equal(events[0].sourceId, "grupo-10a-guia-02-herramientas-informaticas-digitales.html::matriz322");
  assert.equal(events[0].route, "guia.html?g=grupo-10a-guia-02-herramientas-informaticas-digitales.html");
  assert.equal(events[0].isDerived, true);
  assert.equal(events[0].ficha, "3441939");
});

test("Taller Integrador entra por el mismo adaptador de guia (sin adaptador propio)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    guideCatalog: [guide("grupo-10a-guia-04-taller-integrador.html", "Taller Integrador", [
      { id: "producto1", label: "Producto 1" },
    ])],
    deadlinesSnapshot: {
      policies: { "grupo-10a-guia-04-taller-integrador.html": { producto1: { dueAt: "2026-09-12T22:00:00.000Z" } } },
    },
  });
  const event = result.events.find((e) => e.sourceId === "grupo-10a-guia-04-taller-integrador.html::producto1");
  assert.ok(event, "el Taller Integrador debe producir un evento igual que cualquier otra guia");
  assert.equal(event.source, "guide-deadline");
});

test("actividad de guia SIN deadline configurado no produce ningun evento (no se inventa fecha)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    guideCatalog: [guide("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "Guia 2", [
      { id: "matriz322", label: "Actividad 3.2.2" },
    ])],
    deadlinesSnapshot: { policies: {} },
  });
  assert.equal(result.events.filter((e) => e.source === "guide-deadline").length, 0);
});

// 2. Deadline de bitacora -> evento ------------------------------------------

test("2. deadline configurado por el admin en una bitacora produce un evento con esa fecha (no la legacy)", () => {
  const snapshot = { documentDeliveries: [], documentDeadlines: { "bitacora-2": { dueAt: "2026-09-01T22:00:00.000Z", updatedAt: "x", updatedBy: "admin" } } };
  const result = agenda.buildAcademicAgenda({
    context: SB_11A,
    productiveStageSnapshot: snapshot,
    documentCatalog: DOC_CATALOG,
  });
  const event = result.events.find((e) => e.sourceId === "bitacora-2");
  assert.equal(event.source, "productive-stage-deadline");
  assert.equal(event.dueAt, "2026-09-01T22:00:00.000Z");
  assert.notEqual(event.dueAt, productiveStageDeadlines.legacyDeadlineIso("bitacora-2"));
});

test("bitacora SIN configuracion admin usa la fecha legacy (fallback, no se inventa una nueva)", () => {
  const result = agenda.buildAcademicAgenda({
    context: SB_11A,
    productiveStageSnapshot: { documentDeliveries: [], documentDeadlines: {} },
    documentCatalog: DOC_CATALOG,
  });
  const event = result.events.find((e) => e.sourceId === "bitacora-1");
  assert.equal(event.dueAt, productiveStageDeadlines.legacyDeadlineIso("bitacora-1"));
});

// 3. Bitacora/documento SIN fecha -> pendiente sin fecha ---------------------

test("3. documento base sin fecha (ficha de inscripcion) -> pendiente SIN fecha, nunca inventada", () => {
  const result = agenda.buildAcademicAgenda({
    context: SB_11A,
    productiveStageSnapshot: { documentDeliveries: [], documentDeadlines: {} },
    documentCatalog: DOC_CATALOG,
  });
  const event = result.events.find((e) => e.sourceId === "ficha-inscripcion");
  assert.equal(event.type, agenda.TYPE.DOCUMENTO);
  assert.equal(event.dueAt, "", "no debe tener fecha inventada");
  assert.equal(event.date, "");
  assert.equal(event.status, agenda.STATUS.NO_DEADLINE);
});

test("documento base entregado -> status 'delivered', sigue sin fecha inventada", () => {
  const result = agenda.buildAcademicAgenda({
    context: Object.assign({}, SB_11A, { usernameKey: "prueba.sb11" }),
    productiveStageSnapshot: {
      documentDeliveries: [{ usernameKey: "prueba.sb11", docId: "acuerdo-etapa-productiva", submittedAt: "2026-08-01T00:00:00.000Z" }],
      documentDeadlines: {},
    },
    documentCatalog: DOC_CATALOG,
  });
  const event = result.events.find((e) => e.sourceId === "acuerdo-etapa-productiva");
  assert.equal(event.status, agenda.STATUS.DELIVERED);
  assert.equal(event.dueAt, "");
});

test("Etapa Productiva NUNCA aparece para una ficha sin hasProductiveStage (Proyecto no tiene deadline real, y grado 10 no tiene el modulo)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A, // hasProductiveStage no seteado (undefined/false)
    productiveStageSnapshot: { documentDeliveries: [], documentDeadlines: { "bitacora-1": { dueAt: "2026-09-01T00:00:00.000Z" } } },
    documentCatalog: DOC_CATALOG,
  });
  assert.equal(result.events.filter((e) => e.source.indexOf("productive-stage") === 0).length, 0);
});

// 4. Clase legacy -> evento normalizado --------------------------------------

test("4. clase legacy con horario simple se normaliza a un evento CLASE con startAt/endAt reales", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    calendarRecords: [
      { id: "2026-08-25|I.E. Jhon F. Kennedy|10A", fecha: "2026-08-25", dia: "Martes", colegio: "I.E. Jhon F. Kennedy", grado: "10A", horario: "9:00am–9:55am", tipo: "CLASE", defE: "Activa", defO: "" },
    ],
    calendarOverrides: {},
  });
  const events = result.events.filter((e) => e.source === "calendar");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, agenda.TYPE.CLASE);
  assert.equal(events[0].allDay, false);
  // 9:00am Bogota (-05:00) == 14:00 UTC
  assert.equal(events[0].startAt, "2026-08-25T14:00:00.000Z");
  assert.equal(events[0].endAt, "2026-08-25T14:55:00.000Z");
});

test("clase legacy con DOS franjas en el mismo dia produce DOS eventos independientes", () => {
  const result = agenda.buildAcademicAgenda({
    context: { ficha: "x", grupo: "11B", institucionShort: "I.E. Santa Bárbara", institucionLong: "Institucion Educativa Santa Barbara" },
    calendarRecords: [
      { id: "r1", fecha: "2026-08-25", colegio: "I.E. Santa Bárbara", grado: "11B", horario: "10:50am–11:45am; 2:15pm–4:15pm", tipo: "CLASE", defE: "Activa", defO: "" },
    ],
  });
  const events = result.events.filter((e) => e.source === "calendar");
  assert.equal(events.length, 2);
  assert.equal(events[0].id, "calendar:r1:0");
  assert.equal(events[1].id, "calendar:r1:1");
});

test("registro DESPLAZAMIENTO (sin horario) se normaliza como evento de todo el dia", () => {
  const result = agenda.buildAcademicAgenda({
    context: { ficha: "x", grupo: "10A", institucionShort: "I.E. Santa Bárbara", institucionLong: "Institucion Educativa Santa Barbara" },
    calendarRecords: [
      { id: "r2", fecha: "2026-02-23", colegio: "I.E. Santa Bárbara", grado: "10A", horario: "—", tipo: "DESPLAZAMIENTO", defE: "Novedad", defO: "Desplazamiento" },
    ],
  });
  const event = result.events.find((e) => e.sourceId === "r2");
  assert.equal(event.type, agenda.TYPE.ACTIVIDAD_ESPECIAL);
  assert.equal(event.allDay, true);
});

test("clase de OTRO grupo/institucion no aparece en el contexto actual", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    calendarRecords: [
      { id: "otro", fecha: "2026-08-25", colegio: "I.E. Jhon F. Kennedy", grado: "10B", horario: "9:00am–9:55am", tipo: "CLASE", defE: "Activa", defO: "" },
    ],
  });
  assert.equal(result.events.filter((e) => e.source === "calendar").length, 0);
});

test("override de calendario (cancelada) cambia el status del evento derivado sin duplicarlo", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    calendarRecords: [
      { id: "r3", fecha: "2026-08-25", colegio: "I.E. Jhon F. Kennedy", grado: "10A", horario: "9:00am–9:55am", tipo: "CLASE", defE: "Activa", defO: "" },
    ],
    calendarOverrides: { r3: { estado: "Cancelada", obs: "Paro de transporte" } },
  });
  const events = result.events.filter((e) => e.sourceId === "r3");
  assert.equal(events.length, 1);
  assert.equal(events[0].status, agenda.CALENDAR_STATUS.CANCELLED);
  assert.match(events[0].description, /Paro de transporte/);
});

// 5. Cambio de deadline -> cambia el evento derivado -------------------------

test("5. cambiar el dueAt de una actividad de guia cambia el evento derivado (sin duplicarlo)", () => {
  const guideCatalog = [guide("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "Guia 2", [{ id: "matriz322", label: "Matriz" }])];
  const before = agenda.buildAcademicAgenda({
    context: JFK_10A, guideCatalog: guideCatalog,
    deadlinesSnapshot: { policies: { "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-08-28T22:00:00.000Z" } } } },
  });
  const after = agenda.buildAcademicAgenda({
    context: JFK_10A, guideCatalog: guideCatalog,
    deadlinesSnapshot: { policies: { "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-08-30T22:00:00.000Z" } } } },
  });
  assert.equal(before.events[0].id, after.events[0].id, "mismo id: es el MISMO evento, no uno nuevo");
  assert.equal(before.events[0].dueAt, "2026-08-28T22:00:00.000Z");
  assert.equal(after.events[0].dueAt, "2026-08-30T22:00:00.000Z");
});

// 6. Eliminacion explicita -> no reaparece la fecha legacy -------------------

test("6. eliminar explicitamente el deadline de una bitacora deja el evento SIN fecha (no resucita la legacy)", () => {
  const result = agenda.buildAcademicAgenda({
    context: SB_11A,
    productiveStageSnapshot: { documentDeliveries: [], documentDeadlines: { "bitacora-1": { cleared: true, updatedAt: "x", updatedBy: "admin" } } },
    documentCatalog: DOC_CATALOG,
  });
  const event = result.events.find((e) => e.sourceId === "bitacora-1");
  assert.equal(event.dueAt, "", "debe quedar sin fecha, NO la legacy (2026-03-27)");
  assert.equal(event.status, agenda.STATUS.NO_DEADLINE);
});

// 7. No duplicacion -----------------------------------------------------------

test("7. no hay ids de evento duplicados en la salida, incluso con muchas fuentes combinadas", () => {
  const result = agenda.buildAcademicAgenda({
    context: SB_11A,
    guideCatalog: [guide("santa-barbara-10a-guia-02-redes-rap01.html", "Redes", [{ id: "lab1", label: "Lab 1" }])],
    deadlinesSnapshot: { policies: { "santa-barbara-10a-guia-02-redes-rap01.html": { lab1: { dueAt: "2026-09-01T00:00:00.000Z" } } } },
    productiveStageSnapshot: { documentDeliveries: [], documentDeadlines: {} },
    documentCatalog: DOC_CATALOG,
    calendarRecords: [{ id: "r4", fecha: "2026-08-25", colegio: SB_11A.institucionShort, grado: "11A", horario: "9:00am–9:55am", tipo: "CLASE", defE: "Activa", defO: "" }],
  });
  const ids = result.events.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 6, "debe combinar clase + guia + 5 documentos catalogados");
});

// 8. Aislamiento por ficha ----------------------------------------------------

test("8. una ficha nunca recibe eventos de guia de otra ficha (el llamador ya filtra el catalogo, y el evento queda etiquetado)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    guideCatalog: [guide("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "Guia 2", [{ id: "matriz322", label: "Matriz" }])],
    deadlinesSnapshot: { policies: { "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-08-28T00:00:00.000Z" } } } },
  });
  result.events.forEach((event) => assert.equal(event.ficha, "3441939"));
});

test("8b. dos llamadas para dos fichas distintas no comparten ids (seguro para una vista admin que las combine)", () => {
  const guideCatalog = [guide("grupo-10a-guia-02-herramientas-informaticas-digitales.html", "Guia 2", [{ id: "matriz322", label: "Matriz" }])];
  const snapshot = { policies: { "grupo-10a-guia-02-herramientas-informaticas-digitales.html": { matriz322: { dueAt: "2026-08-28T00:00:00.000Z" } } } };
  const forA = agenda.buildAcademicAgenda({ context: { ficha: "3441939", grupo: "10A", institucionShort: "x" }, guideCatalog: guideCatalog, deadlinesSnapshot: snapshot });
  const forB = agenda.buildAcademicAgenda({ context: { ficha: "3441942", grupo: "10B", institucionShort: "x" }, guideCatalog: guideCatalog, deadlinesSnapshot: snapshot });
  assert.notEqual(forA.events[0].id, forB.events[0].id);
});

// 9. Estados Pendiente/Entregada/Vencida -------------------------------------

test("9. estado: sin entrega y fecha futura -> pendiente", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    now: new Date("2026-08-24T12:00:00.000Z"),
    guideCatalog: [guide("g.html", "G", [{ id: "a1", label: "A1" }])],
    deadlinesSnapshot: { policies: { "g.html": { a1: { dueAt: "2026-09-10T00:00:00.000Z" } } } },
  });
  assert.equal(result.events[0].status, agenda.STATUS.PENDING);
});

test("9. estado: fecha ya pasada y sin entrega -> vencida", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    now: new Date("2026-08-24T12:00:00.000Z"),
    guideCatalog: [guide("g.html", "G", [{ id: "a1", label: "A1" }])],
    deadlinesSnapshot: { policies: { "g.html": { a1: { dueAt: "2026-08-01T00:00:00.000Z" } } } },
  });
  assert.equal(result.events[0].status, agenda.STATUS.OVERDUE);
});

test("9. estado: entregado (deliveredGuideActivityKeys) gana sobre la fecha, incluso vencida", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    now: new Date("2026-08-24T12:00:00.000Z"),
    guideCatalog: [guide("g.html", "G", [{ id: "a1", label: "A1" }])],
    deadlinesSnapshot: { policies: { "g.html": { a1: { dueAt: "2026-08-01T00:00:00.000Z" } } } },
    deliveredGuideActivityKeys: ["g.html::a1"],
  });
  assert.equal(result.events[0].status, agenda.STATUS.DELIVERED);
});

test("9. sin informacion de entrega local, NUNCA se marca como entregada (no se inventa un estado que no se puede determinar)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    now: new Date("2026-08-24T12:00:00.000Z"),
    guideCatalog: [guide("g.html", "G", [{ id: "a1", label: "A1" }])],
    deadlinesSnapshot: { policies: { "g.html": { a1: { dueAt: "2026-09-10T00:00:00.000Z" } } } },
    // deliveredGuideActivityKeys ausente a proposito
  });
  assert.notEqual(result.events[0].status, agenda.STATUS.DELIVERED);
});

// 10. Zona horaria Bogota -----------------------------------------------------

test("10. horario legacy 11:00pm-11:59pm se ancla a Bogota, no a UTC ni a la hora local del proceso", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    calendarRecords: [{ id: "rz", fecha: "2026-08-25", colegio: JFK_10A.institucionShort, grado: "10A", horario: "11:00pm–11:59pm", tipo: "CLASE", defE: "Activa", defO: "" }],
  });
  const event = result.events.find((e) => e.sourceId === "rz");
  // 23:00 Bogota (-05:00) == 04:00 UTC del dia SIGUIENTE.
  assert.equal(event.startAt, "2026-08-26T04:00:00.000Z");
});

test("10. un deadline de guia justo a medianoche Bogota separa correctamente 'aun pendiente' de 'vencida'", () => {
  const guideCatalog = [guide("g.html", "G", [{ id: "a1", label: "A1" }])];
  const dueAt = productiveStageDeadlines.normalizeDueAt("2026-08-24T23:59"); // 23:59 Bogota, 24-ago
  const snapshot = { policies: { "g.html": { a1: { dueAt: dueAt } } } };

  const justBefore = agenda.buildAcademicAgenda({ context: JFK_10A, guideCatalog: guideCatalog, deadlinesSnapshot: snapshot, now: new Date("2026-08-25T04:58:00.000Z") }); // 23:58 Bogota
  const justAfter = agenda.buildAcademicAgenda({ context: JFK_10A, guideCatalog: guideCatalog, deadlinesSnapshot: snapshot, now: new Date("2026-08-25T05:00:01.000Z") }); // 00:00:01 Bogota (25-ago)

  assert.equal(justBefore.events[0].status, agenda.STATUS.DUE_TODAY);
  assert.equal(justAfter.events[0].status, agenda.STATUS.OVERDUE);
});

test("10. la lista final queda ordenada cronologicamente por dueAt/startAt (prioriza lo mas urgente primero)", () => {
  const result = agenda.buildAcademicAgenda({
    context: JFK_10A,
    guideCatalog: [guide("g.html", "G", [{ id: "later", label: "Later" }, { id: "sooner", label: "Sooner" }])],
    deadlinesSnapshot: {
      policies: { "g.html": {
        later: { dueAt: "2026-10-01T00:00:00.000Z" },
        sooner: { dueAt: "2026-08-26T00:00:00.000Z" },
      } },
    },
  });
  assert.equal(result.events[0].sourceId, "g.html::sooner");
  assert.equal(result.events[1].sourceId, "g.html::later");
});
