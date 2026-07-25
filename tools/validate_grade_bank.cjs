#!/usr/bin/env node
// validate_grade_bank.cjs — Chequea el banco de respuestas (grade_solutions_bank.js)
// contra los campos data-store REALES y ACTUALES de cada guía.
//
// Uso:  node tools/validate_grade_bank.cjs            (todas las guías)
//       node tools/validate_grade_bank.cjs guia-02-herramientas
//
// Reporta por familia:
//   ✔ respuestas OK   ⚠ huérfanas (campo borrado/renombrado)
//   ✘ vacías (campo actual de un grupo ya respondido, sin respuesta)
//   ℹ actividades del catálogo sin ninguna respuesta
// Sale con código !=0 si hay huérfanas (para poder encadenarlo a un check).

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
  catch (e) { return ""; }
}

// data-store literales presentes en un HTML.
function literalStores(html) {
  return new Set([...html.matchAll(/data-store="([^"]+)"/g)].map((m) => m[1]));
}

// Extrae los `id: "..."` del array `const <name> = [ ... ];` de un script.
function arrayIds(script, name) {
  const start = script.indexOf("const " + name + " = [");
  if (start === -1) return [];
  let i = script.indexOf("[", start), depth = 0, end = -1;
  for (let j = i; j < script.length; j++) {
    if (script[j] === "[") depth++;
    else if (script[j] === "]") { depth--; if (depth === 0) { end = j; break; } }
  }
  if (end === -1) return [];
  const block = script.slice(i, end);
  return [...block.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
}

// Generadores dinámicos: campos que el script de la guía crea en tiempo de ejecución.
const DYNAMIC = {
  "guia-02-herramientas": [
    { script: "js/script_guia2.js", arr: "extensions",         keys: (id) => [`extension:${id}:program`, `extension:${id}:description`] },
    { script: "js/script_guia2.js", arr: "systems",            keys: (id) => ["processor","ram","disk","source"].map((s) => `system:${id}:${s}`) },
    { script: "js/script_guia2.js", arr: "collaborativeTools", keys: (id) => ["function","advantage","limit","license"].map((s) => `collab:${id}:${s}`) },
    { script: "js/script_guia2.js", arr: "digitalCompetencyChecklist",    keys: (id) => [`checklist:${id}`] },
    { script: "js/script_guia2.js", arr: "CIBERSEG_335_CHECKLIST_ITEMS",  keys: (id) => [`ciberseg:checklist:${id}`] },
    // Ciberseguridad 3.3.5: las demas sub-secciones declaran sus campos como
    // objetos { key: "ciberseg:..." } dentro del script (no como data-store literal).
    { script: "js/script_guia2.js", literal: /key:\s*"(ciberseg:[^"]+)"/g },
    // Ficha de caso (nota compartida con matriz322): la pagina auxiliar genera
    // data-store "fichacaso-{slug}-{a..d}" con los slugs de js/fichas_casos.js.
    { script: "js/fichas_casos.js", literal: /slug:\s*"([^"]+)"/g,
      keys: (slug) => ["a","b","c","d"].map((l) => `fichacaso-${slug}-${l}`) },
  ],
  "guia-06-planificar": [
    { script: "js/script_guia6.js", arr: "installationTools",  keys: (id) => ["inst_source","inst_version","inst_verify","inst_done","inst_notes"].map((p) => `${p}_${id}`) },
    { script: "js/script_guia6.js", arr: "diagnosticSections", keys: (id) => ["diag_result","diag_action"].map((p) => `${p}_${id}`) },
    { script: "js/script_guia6.js", arr: "budgetItems",        keys: (id) => ["budget_license","budget_price","budget_qty","budget_why"].map((p) => `${p}_${id}`) },
  ],
  "guia-05-herramientas": [
    { script: "js/script.js", arr: "matchingTools", keys: (id) => [`matching:${id}`] },
    { script: "js/script.js", arr: "extensions",    keys: (id) => [`extension:${id}:program`, `extension:${id}:description`] },
    { script: "js/script.js", arr: "systems",       keys: (id) => ["processor","ram","disk","source"].map((s) => `system:${id}:${s}`) },
  ],
};

// Partials (fuente de los campos estáticos) por familia.
const PARTIALS = {
  "guia-02-herramientas": [
    "partials/guia-02-herramientas-content.html",
    // Actividades que viven en paginas auxiliares (10a y 10b comparten data-store):
    "pages/auxiliares/grupo-10a-guia-02-actividad-322-matriz.html",
    "pages/auxiliares/grupo-10a-guia-02-ficha-caso.html",
    "pages/auxiliares/grupo-10a-guia-02-actividad-4-formulario.html",
  ],
  "guia-05-herramientas": ["partials/guia-05-herramientas-content.html"],
  "guia-06-planificar":   ["partials/guia-06-planificar-content.html"],
  "guia-redes-rap01":     ["partials/guia-redes-rap01-content.html", "partials/guia-redes-rap02-content.html"],
  "guia-07-ciberseguridad":       ["partials/guia-07-planificar-ciberseguridad-content.html"],
  "guia-08-documentar-gestion":   ["partials/guia-08-documentar-gestion-content.html"],
  "taller-integrador-sb11":       ["partials/taller-integrador-sb11-content.html"],
};

// Conjunto de campos data-store ACTUALES de una familia (estáticos + dinámicos).
function currentKeys(family) {
  const set = new Set();
  (PARTIALS[family] || []).forEach((p) => literalStores(read(p)).forEach((k) => set.add(k)));
  (DYNAMIC[family] || []).forEach((gen) => {
    const script = read(gen.script);
    if (gen.literal) {
      [...script.matchAll(gen.literal)].forEach((m) => {
        (gen.keys ? gen.keys(m[1]) : [m[1]]).forEach((k) => set.add(k));
      });
      return;
    }
    arrayIds(script, gen.arr).forEach((id) => gen.keys(id).forEach((k) => set.add(k)));
  });
  return set;
}

function namespace(key) { return String(key).split(/[:_-]/)[0]; }

// Cargar banco + catálogo.
const win = {}; const doc = { querySelector: () => null };
try { win.gradeSolutionsBank = JSON.parse(read("grade_solutions_bank.json")); } catch (e) { win.gradeSolutionsBank = {}; }
try { new Function("window", "document", read("js/activity_grades.js"))(win, doc); } catch (e) {}
const bank = win.gradeSolutionsBank || {};
const catalog = (win.activityGradesManager && win.activityGradesManager.GRADE_CATALOG) || {};

const only = process.argv[2];
const families = Object.keys(bank).filter((f) => f !== "guia-01-induccion" && (!only || f === only));

let totalOrphans = 0;
families.forEach((family) => {
  const current = currentKeys(family);
  const acts = bank[family] || {};
  const bankKeys = [];
  Object.values(acts).forEach((a) => Object.keys(a).forEach((k) => bankKeys.push(k)));
  const bankSet = new Set(bankKeys);
  const bankNamespaces = new Set(bankKeys.map(namespace));

  const ok = bankKeys.filter((k) => current.has(k));
  const orphans = bankKeys.filter((k) => !current.has(k));
  const gaps = [...current].filter((k) => !bankSet.has(k) && bankNamespaces.has(namespace(k)));

  // Actividades del catálogo sin ninguna respuesta en el banco.
  const catActs = (catalog[family] && catalog[family].activities) || [];
  const noBank = catActs.map((a) => a.id).filter((id) => !acts[id] || Object.keys(acts[id]).length === 0);

  totalOrphans += orphans.length;
  console.log(`\n══ ${family} ══`);
  console.log(`  ✔ ${ok.length} respuestas OK`);
  if (orphans.length) console.log(`  ⚠ ${orphans.length} huérfanas (campo ya no existe):\n     ${orphans.join("\n     ")}`);
  else console.log(`  ⚠ 0 huérfanas`);
  if (gaps.length) console.log(`  ✘ ${gaps.length} campos sin respuesta (grupo ya respondido):\n     ${gaps.join("\n     ")}`);
  else console.log(`  ✘ 0 campos sin respuesta en grupos respondidos`);
  if (noBank.length) console.log(`  ℹ actividades del catálogo sin banco: ${noBank.join(", ")}`);
});

console.log(`\n${totalOrphans === 0 ? "✔ Sin huérfanas." : "⚠ Hay " + totalOrphans + " huérfanas — revisar."}`);
process.exit(totalOrphans === 0 ? 0 : 1);
