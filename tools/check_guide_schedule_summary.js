const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
let failed = false;

function assertIncludes(content, marker, label) {
  if (!content.includes(marker)) {
    console.error(`[FAIL] Falta ${label}: ${marker}`);
    failed = true;
  }
}

const routerJs = fs.readFileSync(path.join(root, "js", "guia_router.js"), "utf8");
[
  "data/calendario_2026_records.js",
  "data/calendario_2026_seed.js",
  "js/guia_template.js",
  "10a-guia-2-herramientas",
  "10b-guia-2-herramientas",
].forEach((marker) => assertIncludes(routerJs, marker, "rutas de guia cargan calendario"));

const templateJs = fs.readFileSync(path.join(root, "js", "guia_template.js"), "utf8");
[
  "GUIDE_CALENDAR_DOC = \"calendario_2026_admin\"",
  "GUIDE_CALENDAR_STORAGE_KEY = \"sena-calendario-pro-2026-v2\"",
  "ensureGuideScheduleMeta",
  "renderGuideScheduleSummary",
  "getGuideScheduleNowDate",
  "getGuideNowMinutes",
  "isGuideClassAfterNow",
  "findCurrentGuideClass",
  "findNextGuideClass",
  "findNextGuideDelivery",
  "findNextGuideNotice",
  "getGuideRecordHorario",
  "loadGuideCalendarState",
  "cloudGetCalendar",
  "guideScheduleNextClass",
  "guideScheduleNextDelivery",
  "Estoy dentro de la hora de clase",
  "Proxima clase",
  "Entrega pendiente",
  "Sin entrega proxima",
  "Novedad de clase",
].forEach((marker) => assertIncludes(templateJs, marker, "logica de calendario en plantilla"));

const calendarHtml = fs.readFileSync(path.join(root, "calendario-academico-2026.html"), "utf8");
[
  "calculateRecordHorario",
  "const getH=r=>estados[r.id]?.horario??r.horario",
  "current.horario=getH(record)",
  "horario-preview",
].forEach((marker) => assertIncludes(calendarHtml, marker, "edicion de grado y horario en calendario"));

const css = fs.readFileSync(path.join(root, "css", "guia_template.css"), "utf8");
[
  ".guide-schedule-item",
  ".guide-schedule-item--class",
  ".guide-schedule-item--delivery",
  ".guide-schedule-item.is-empty",
  ".guide-schedule-item strong",
].forEach((marker) => assertIncludes(css, marker, "estilos del resumen de calendario"));

function loadCalendarWindow() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(root, "data", "calendario_2026_records.js"), "utf8"),
    context
  );
  vm.runInContext(
    fs.readFileSync(path.join(root, "data", "calendario_2026_seed.js"), "utf8"),
    context
  );
  return context.window;
}

function loadTemplateHooks(todayOverride, minutesOverride) {
  const context = {
    window: {
      location: { pathname: "/grupo-10a-guia-02-herramientas-informaticas-digitales.html" },
      GUIDE_SCHEDULE_TODAY_OVERRIDE: todayOverride,
      GUIDE_SCHEDULE_MINUTES_OVERRIDE: minutesOverride,
      addEventListener() {},
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    document: {
      addEventListener() {},
    },
    console,
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(root, "data", "calendario_2026_records.js"), "utf8"),
    context
  );
  vm.runInContext(
    fs.readFileSync(path.join(root, "data", "calendario_2026_seed.js"), "utf8"),
    context
  );

  const instrumentedTemplate = templateJs.replace(
    '\n  window.addEventListener("pagehide"',
    `
  window.__guideTemplateTestHooks = {
    findCurrentGuideClass,
    findNextGuideClass,
    findNextGuideNotice,
    getGuideRecordHorario,
    getGuideScheduleTimeValue,
    getGuideNowMinutes,
    isGuideClassAfterNow,
    __setGuideCalendarState(nextState) {
      const previous = guideCalendarState;
      guideCalendarState = nextState || {};
      return previous;
    },
  };
  window.addEventListener("pagehide"`
  );
  vm.runInContext(instrumentedTemplate, context);
  return context.window.__guideTemplateTestHooks;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function institutionKey(value) {
  const normalized = normalizeText(value);
  if (normalized.includes("kennedy")) return "kennedy";
  if (normalized.includes("santa") && normalized.includes("barbara")) return "santa-barbara";
  return normalized;
}

function groupKey(value) {
  return String(value || "").replace(/^grupo\s+/i, "").toUpperCase();
}

function timeValue(record) {
  const match = String(record.horario || "").match(/(\d{1,2}):(\d{2})(am|pm)/i);
  if (!match) return 9999;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return hour * 60 + Number(match[2]);
}

function nextClassFor(records, state, inst, grupo) {
  return records
    .filter((record) => {
      const entry = state[record.id] || {};
      const status = normalizeText(entry.estado || record.defE || "");
      return (
        record.tipo === "CLASE" &&
        record.fecha >= "2026-04-10" &&
        institutionKey(record.colegio) === institutionKey(inst) &&
        groupKey(entry.grado || record.grado) === groupKey(grupo) &&
        !["cancelada", "sin programacion", "no aplica", "novedad"].includes(status)
      );
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || timeValue(a) - timeValue(b))[0];
}

const calendarWindow = loadCalendarWindow();
[
  ["Institucion Educativa Jhon F. Kennedy", "10A", "2026-04-10"],
  ["Institucion Educativa Jhon F. Kennedy", "10B", "2026-04-14"],
].forEach(([inst, grupo, expectedDate]) => {
  const nextClass = nextClassFor(
    calendarWindow.CALENDAR_2026_RECORDS,
    calendarWindow.CALENDAR_2026_INITIAL_STATE,
    inst,
    grupo
  );
  if (!nextClass || nextClass.fecha !== expectedDate) {
    console.error(
      `[FAIL] Proxima clase ${grupo}: esperado ${expectedDate}, obtenido ${
        nextClass ? nextClass.fecha : "sin registro"
      }`
    );
    failed = true;
  }
});

const beforeClassHooks = loadTemplateHooks("2026-04-10", 5 * 60 + 59);
const duringClassHooks = loadTemplateHooks("2026-04-10", 8 * 60 + 3);
const selection10A = { inst: "Institucion Educativa Jhon F. Kennedy", grupo: "10A" };
const beforeClass = beforeClassHooks?.findNextGuideClass(selection10A);
const currentDuringClass = duringClassHooks?.findCurrentGuideClass(selection10A);
const duringClass = duringClassHooks?.findNextGuideClass(selection10A);

if (!beforeClass || beforeClass.fecha !== "2026-04-10") {
  console.error(
    `[FAIL] Antes de iniciar la clase 10A debe mostrar 2026-04-10, obtuvo ${
      beforeClass ? beforeClass.fecha : "sin registro"
    }`
  );
  failed = true;
}

if (!duringClass || duringClass.fecha !== "2026-04-15") {
  console.error(
    `[FAIL] Durante la clase 10A debe saltar la clase en curso y mostrar 2026-04-15, obtuvo ${
      duringClass ? duringClass.fecha : "sin registro"
    }`
  );
  failed = true;
}

if (!currentDuringClass || currentDuringClass.fecha !== "2026-04-10") {
  console.error(
    `[FAIL] Durante la clase 10A debe detectar la clase actual del 2026-04-10, obtuvo ${
      currentDuringClass ? currentDuringClass.fecha : "sin registro"
    }`
  );
  failed = true;
}

const changedScheduleHooks = loadTemplateHooks("2026-02-25", 6 * 60);
const changedRecord = calendarWindow.CALENDAR_2026_RECORDS.find(
  (record) => record.fecha === "2026-02-25" && record.colegio.includes("Santa") && record.grado === "11A"
);
if (!changedRecord) {
  console.error("[FAIL] No se encontro registro base SB 11A para probar cambio de grupo.");
  failed = true;
} else {
  const changedState = {
    [changedRecord.id]: {
      grado: "11B",
      horario: "10:50am-11:45am; 2:15pm-4:15pm",
      estado: "Activa",
      obs: "Cambio de grupo y horario",
    },
  };
  const originalState = changedScheduleHooks.__setGuideCalendarState
    ? changedScheduleHooks.__setGuideCalendarState(changedState)
    : null;
  const nextFor10B = changedScheduleHooks.findNextGuideClass({
    inst: "Institucion Educativa Santa Barbara",
    grupo: "11B",
  });
  if (!nextFor10B || nextFor10B.id !== changedRecord.id || changedScheduleHooks.getGuideRecordHorario(nextFor10B) !== "10:50am-11:45am; 2:15pm-4:15pm") {
    console.error("[FAIL] El aprendiz 11B debe ver la clase cambiada con el horario actualizado.");
    failed = true;
  }
  if (changedScheduleHooks.__setGuideCalendarState && originalState) {
    changedScheduleHooks.__setGuideCalendarState(originalState);
  }
}

const noticeHooks = loadTemplateHooks("2026-05-05", 6 * 60);
const noticeRecord = calendarWindow.CALENDAR_2026_RECORDS.find(
  (record) => record.fecha >= "2026-05-05" && record.colegio.includes("Kennedy") && record.grado === "10B"
);
if (!noticeRecord) {
  console.error("[FAIL] No se encontro registro JFK 10B para probar novedad.");
  failed = true;
} else {
  const originalState = noticeHooks.__setGuideCalendarState
    ? noticeHooks.__setGuideCalendarState({
        [noticeRecord.id]: {
          estado: "Cancelada",
          obs: "Clase cancelada por evento institucional",
          grado: "10B",
          horario: noticeRecord.horario,
        },
      })
    : null;
  const notice = noticeHooks.findNextGuideNotice({
    inst: "Institucion Educativa Jhon F. Kennedy",
    grupo: "10B",
  });
  if (!notice || notice.id !== noticeRecord.id) {
    console.error("[FAIL] El aprendiz debe ver la proxima novedad de clase cancelada.");
    failed = true;
  }
  if (noticeHooks.__setGuideCalendarState && originalState) {
    noticeHooks.__setGuideCalendarState(originalState);
  }
}

if (failed) {
  process.exit(1);
}

console.log("OK: Las guias muestran proxima clase y entrega pendiente por ficha en el encabezado.");
