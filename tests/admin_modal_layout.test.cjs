const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/page_admin.css"), "utf8");
const html = fs.readFileSync(path.join(root, "panel-administrativo-usuarios.html"), "utf8");
const adminScript = fs.readFileSync(path.join(root, "js/admin_usuarios.js"), "utf8");

test("admin response modal stays below the fixed navbar and scrolls internally", () => {
  assert.match(css, /\.modal-shell\s*\{[\s\S]*z-index:\s*1200/);
  assert.match(css, /\.modal-shell\s*\{[\s\S]*padding:\s*calc\(var\(--navbar-height,\s*60px\) \+ 14px\) 14px 14px/);
  assert.match(css, /\.modal-card\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--navbar-height,\s*60px\) - 28px\)/);
  assert.match(css, /\.modal-header\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-meta\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*min-height:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*overflow:\s*auto/);
});

test("admin response modal can export visible answers to Word", () => {
  assert.match(html, /id="guide2-responses-export"/);
  assert.match(html, /data-export-responses-word/);
  assert.match(css, /\.modal-export-actions/);
  assert.match(adminScript, /function buildAdminResponsesWordDocument/);
  assert.match(adminScript, /function exportCurrentResponsesToWord/);
  assert.match(adminScript, /application\/msword/);
  assert.match(adminScript, /Servicio Nacional de Aprendizaje - SENA/);
  assert.match(adminScript, /Sistemas Teleinformaticos/);
  assert.match(adminScript, /Competencia/);
  assert.match(adminScript, /Resultado de Aprendizaje/);
  assert.match(adminScript, /data-export-responses-word/);
});

test("guide progress tab focuses on progress and individual unlocks, not response viewers", () => {
  const buildProgressCard = adminScript.match(/function buildProgressCard\(user, guide\) \{[\s\S]*?\n  function buildUserCard/);
  assert.ok(buildProgressCard, "buildProgressCard should be present");
  const body = buildProgressCard[0];

  assert.doesNotMatch(body, /data-view-guide2/);
  assert.doesNotMatch(body, /data-view-guide6/);
  assert.doesNotMatch(body, /renderWordSearchAdminSummary/);
  assert.doesNotMatch(body, /renderMatchingGameAdminSummary/);
  assert.match(body, /progress-card__summary/);
  assert.match(body, /progress-card__actions/);
  assert.match(body, /activity-unlock-panel/);
  assert.match(body, /data-unlock-activity/);
});

test("activities tab exposes individual response viewers for available guide activities", () => {
  assert.match(adminScript, /data-view-guide-activity/);
  assert.match(adminScript, /function handleViewGuideActivityResponses/);
  assert.match(adminScript, /function renderGuide2ActivityResponsesBody/);
  assert.match(adminScript, /function renderGuide6ActivityResponsesBody/);
  assert.match(adminScript, /buildAvailableGuideActivityCards/);
  assert.match(adminScript, /Actividad 8 - Herramientas colaborativas/);
  assert.match(adminScript, /Bitácora 3\.1\.1|BitÃ¡cora 3\.1\.1/);
  assert.match(css, /\.activity-response-grid/);
  assert.match(css, /\.activity-response-card/);
});
