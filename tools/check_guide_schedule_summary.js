const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const guidePages = [
  "grupo-10a-guia-02-herramientas-informaticas-digitales.html",
  "grupo-10b-guia-02-herramientas-informaticas-digitales.html",
];

let failed = false;

function assertIncludes(content, marker, label) {
  if (!content.includes(marker)) {
    console.error(`[FAIL] Falta ${label}: ${marker}`);
    failed = true;
  }
}

for (const page of guidePages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  assertIncludes(html, "data/calendario_2026_records.js?v=20260410_1", `${page} carga registros del calendario`);
  assertIncludes(html, "data/calendario_2026_seed.js?v=20260410_1", `${page} carga estado base del calendario`);
  assertIncludes(html, "js/guia_template.js?v=20260411_1", `${page} usa cache actualizado de plantilla`);
}

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
  "loadGuideCalendarState",
  "cloudGetCalendar",
  "guideScheduleNextClass",
  "guideScheduleNextDelivery",
  "Estoy dentro de la hora de clase",
  "Proxima clase",
  "Entrega pendiente",
  "Sin entrega proxima",
].forEach((marker) => assertIncludes(templateJs, marker, "logica de calendario en plantilla"));

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
    },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
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
    "\n  ensureGuideRevealShell();",
    `
  window.__guideTemplateTestHooks = {
    findCurrentGuideClass,
    findNextGuideClass,
    getGuideScheduleTimeValue,
    getGuideNowMinutes,
    isGuideClassAfterNow,
  };
  return;
  ensureGuideRevealShell();`
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

if (failed) {
  process.exit(1);
}

console.log("OK: Las guias muestran proxima clase y entrega pendiente por ficha en el encabezado.");
