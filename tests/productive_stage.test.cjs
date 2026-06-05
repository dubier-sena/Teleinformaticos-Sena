"use strict";
// Reemplaza cinco checks de tooling de etapa productiva
// (check_productive_stage_admin_delivery / _admin_import / _cta_panel /
// _student_links / _student_resources). Fallaban por clavar versiones `?v=` y
// por asertar el CTA del index PREVIO al rediseño "sesión primero" (ese panel de
// grupo se eliminó). El MÓDULO de etapa productiva sigue vivo en sus páginas
// dedicadas; aquí se conservan sus invariantes estructurales actuales: el panel
// principal solo enlaza el módulo (no incrusta el importador pesado), la página
// admin dedicada trae importador + listado + detalle, y la vista del estudiante
// trae documentos base + entrega de avance. Sin pinear versiones.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");
function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test("el panel principal solo enlaza el módulo y no incrusta el importador pesado", () => {
  const panel = read("panel-administrativo-usuarios.html");
  assert.match(panel, /href="etapa-productiva-admin\.html"/);
  // El parser DOCX y el importador viven en la página dedicada, no aquí.
  assert.doesNotMatch(panel, /src="js\/vendor\/mammoth\.browser\.min\.js/);
  assert.doesNotMatch(panel, /src="js\/productive_stage_import\.js/);
  assert.doesNotMatch(panel, /id="productive-stage-detail-modal"/);
});

test("la página admin dedicada trae el importador, listado y detalle del proyecto", () => {
  const html = read("etapa-productiva-admin.html");
  for (const id of [
    "productive-stage-panel",
    "productive-stage-file",
    "productive-stage-import-button",
    "productive-stage-projects",
    "productive-stage-detail-modal",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `falta #${id} en la página admin dedicada`);
  }
  const js = read("js/productive_stage_admin.js");
  assert.match(js, /renderProductiveStageSection/);
  assert.match(js, /handleProductiveStageImport/);
  assert.match(js, /refreshProductiveStageModule/);
  assert.match(js, /handleProductiveStageDeliverySubmit/);
  assert.match(js, /sharedDelivery\.uploadToAppsScript/);
  const css = read("css/page_productive_stage_admin.css");
  assert.match(css, /\.productive-stage-admin-shell/);
  assert.match(css, /\.productive-stage-delivery-card/);
});

test("la vista del estudiante trae documentos base y entrega de avance del proyecto", () => {
  const html = read("etapa-productiva-estudiante.html");
  assert.match(html, /id="student-project-resources"/);
  assert.match(html, /id="student-project-delivery"/);
  assert.match(html, /src="js\/shared_apps_script_delivery\.js/);
  assert.match(html, /src="js\/productive_stage_project_delivery\.js/);
  assert.match(read("js/productive_stage_student.js"), /productiveStageProjectDelivery/);
  assert.match(read("js/productive_stage_project_delivery.js"), /renderProjectResources/);
  const css = read("css/page_productive_stage_student.css");
  assert.match(css, /\.student-project-downloads/);
  assert.match(css, /\.student-project-delivery-card/);
});

test("el portal y las guías 11 enlazan la vista privada del estudiante", () => {
  assert.match(read("js/index_auth.js"), /etapa-productiva-estudiante\.html/);
  assert.match(read("js/guia_template.js"), /etapa-productiva-estudiante\.html/);
});
