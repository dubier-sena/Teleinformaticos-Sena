const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "css/page_admin.css"), "utf8");
const html = fs.readFileSync(path.join(root, "panel-administrativo-usuarios.html"), "utf8");
const adminScript = fs.readFileSync(path.join(root, "js/admin_usuarios.js"), "utf8");
const auditScript = fs.existsSync(path.join(root, "js/admin_audit.js"))
  ? fs.readFileSync(path.join(root, "js/admin_audit.js"), "utf8")
  : "";
const gradesScript = fs.existsSync(path.join(root, "js/admin_grades.js"))
  ? fs.readFileSync(path.join(root, "js/admin_grades.js"), "utf8")
  : "";
const deadlinesScript = fs.existsSync(path.join(root, "js/admin_deadlines.js"))
  ? fs.readFileSync(path.join(root, "js/admin_deadlines.js"), "utf8")
  : "";
const redesScript = fs.existsSync(path.join(root, "js/admin_redes.js"))
  ? fs.readFileSync(path.join(root, "js/admin_redes.js"), "utf8")
  : "";
const exportScript = fs.existsSync(path.join(root, "js/admin_export.js"))
  ? fs.readFileSync(path.join(root, "js/admin_export.js"), "utf8")
  : "";
const activitiesScript = fs.existsSync(path.join(root, "js/admin_activities.js"))
  ? fs.readFileSync(path.join(root, "js/admin_activities.js"), "utf8")
  : "";
const guide6Script = fs.existsSync(path.join(root, "js/admin_guide6.js"))
  ? fs.readFileSync(path.join(root, "js/admin_guide6.js"), "utf8")
  : "";
const progressScript = fs.existsSync(path.join(root, "js/admin_progress.js"))
  ? fs.readFileSync(path.join(root, "js/admin_progress.js"), "utf8")
  : "";

test("admin response modal stays below the fixed navbar and scrolls internally", () => {
  assert.match(css, /\.modal-shell\s*\{[\s\S]*z-index:\s*1200/);
  assert.match(css, /\.modal-shell\s*\{[\s\S]*padding:\s*calc\(var\(--navbar-height,\s*60px\) \+ 14px\) 14px 14px/);
  assert.match(css, /\.modal-card\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--navbar-height,\s*60px\) - 28px\)/);
  assert.match(css, /\.modal-header\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-meta\s*\{[\s\S]*flex-shrink:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*min-height:\s*0/);
  assert.match(css, /\.modal-body\s*\{[\s\S]*overflow:\s*auto/);
});

test("admin redes quiz evidence rendering lives in the redes helper", () => {
  assert.match(redesScript, /function getQuizEvidenceHtml\(summary, deps\)/);
  assert.match(redesScript, /redes-quiz-evidence-list/);
  assert.match(css, /\.redes-quiz-evidence-list/);
  assert.match(adminScript, /window\.adminRedes\.getQuizEvidenceHtml\(summary, \{ formatDate, escapeHtml \}\)/);
  assert.doesNotMatch(adminScript, /Evidencia de visibilidad[\s\S]*<ul style=/);
});

test("admin redes activity rows use redes helpers for status and unlock buttons", () => {
  assert.match(redesScript, /function getQuizActivityStatusHtml\(summary, deps\)/);
  assert.match(redesScript, /function getUnlockButtonHtml\(config, deps\)/);
  assert.match(activitiesScript, /adminRedes\.getQuizActivityStatusHtml\(summary, \{ escapeHtml \}\)/);
  assert.match(activitiesScript, /adminRedes\.getUnlockButtonHtml\(\{ type: "quiz"/);
  assert.match(activitiesScript, /adminRedes\.getUnlockButtonHtml\(\{ type: "activity"/);

  const tableStart = activitiesScript.indexOf("function buildStudentActivityTable");
  const redesStart = activitiesScript.indexOf('if (guideKind === "redes") {', tableStart);
  const redesEnd = activitiesScript.indexOf('const rows = usersWithGuide.map((user) => {', redesStart + 1);
  assert.ok(tableStart >= 0 && redesStart > tableStart && redesEnd > redesStart, "redes activity branch should be present");
  const redesActivities = activitiesScript.slice(redesStart, redesEnd);
  assert.doesNotMatch(redesActivities, /data-unlock-redes-(quiz|activity)=/);
});

test("admin redes quiz action layout uses a stylesheet class", () => {
  assert.match(css, /\.redes-quiz-actions/);
  assert.match(adminScript, /class="redes-quiz-actions"/);

  const quizTable = adminScript.match(
    /function buildRedesQuizTable\(rows\) \{[\s\S]*?\n  function renderRedesQuizDetail/
  );
  assert.ok(quizTable, "buildRedesQuizTable should be present");
  assert.doesNotMatch(quizTable[0], /style="display:grid;gap:8px"/);
});

test("admin response cards use reusable layout classes instead of inline grid styles", () => {
  assert.match(css, /\.answer-card--wide/);
  assert.match(css, /\.answer-conclusion/);
  assert.match(css, /\.answer-conclusion__label/);
  assert.match(css, /\.answer-conclusion__value/);
  assert.match(guide6Script, /class="answer-card answer-card--wide"/);
  assert.match(guide6Script, /class="answer-conclusion"/);

  const responseRenderers = adminScript.match(
    /function renderGuide2ActivityResponsesBody\(activityId, state, context\) \{[\s\S]*?\n  function openGuide2ResponsesModal/
  );
  assert.ok(responseRenderers, "guide activity response renderers should be present");
  assert.doesNotMatch(responseRenderers[0], /<article class="answer-card" style="grid-column:1\/-1"/);
  assert.doesNotMatch(responseRenderers[0], /<div style="margin-top:12px"/);
});

test("admin matriz 322 modal uses stylesheet classes instead of inline styles", () => {
  assert.match(css, /\.matriz322-table-wrap/);
  assert.match(css, /\.matriz322-table/);
  assert.match(css, /\.matriz322-actor-cell/);
  assert.match(css, /\.matriz322-response-cell/);
  assert.match(css, /\.matriz322-note-card/);
  assert.match(css, /\.matriz322-note-title/);
  assert.match(css, /\.matriz322-note-copy/);

  assert.match(activitiesScript, /function buildMatriz322Table\(rows, deps\)/);
  assert.match(activitiesScript, /function buildMatriz322ModalPayload\(summary, deps\)/);
  assert.match(activitiesScript, /class="answer-table-wrap matriz322-table-wrap"/);
  assert.match(activitiesScript, /class="answer-table matriz322-table"/);
  assert.match(activitiesScript, /class="matriz322-note-card"/);
  assert.match(adminScript, /window\.adminActivities\.buildMatriz322Table\(rows, \{ escapeHtml, formatDate \}\)/);
  assert.match(adminScript, /window\.adminActivities\.buildMatriz322ModalPayload\(summary, \{ escapeHtml, formatDate \}\)/);
  assert.doesNotMatch(activitiesScript, /style="/);

  const matrizModal = adminScript.match(/function openMatriz322Modal\(summary\) \{[\s\S]*?\n  \}/);
  assert.ok(matrizModal, "openMatriz322Modal should remain as a thin wrapper");
  assert.doesNotMatch(matrizModal[0], /MATRIZ322_ACTORS/);
  assert.doesNotMatch(matrizModal[0], /matriz322-note-card/);
});

test("admin user progress section spacing uses a stylesheet class", () => {
  assert.match(css, /\.user-section-title--progress/);
  assert.match(adminScript, /class="user-section-title user-section-title--progress"/);

  const cardStart = adminScript.indexOf("function buildUserCard(user)");
  const cardEnd = adminScript.indexOf("function renderUsers", cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart, "buildUserCard should be present");
  const userCard = adminScript.slice(cardStart, cardEnd);
  assert.doesNotMatch(userCard, /class="user-section-title" style="margin-top:12px"/);
});

test("admin progress cards use native progress without inline width styles", () => {
  assert.match(css, /\.progress-bar::-webkit-progress-value/);
  assert.match(css, /\.progress-bar::-moz-progress-bar/);

  assert.ok(
    html.indexOf("js/admin_progress.js") >= 0 && html.indexOf("js/admin_progress.js") < html.indexOf("js/admin_usuarios.js"),
    "admin progress module should load before admin_usuarios.js"
  );
  assert.match(progressScript, /window\.adminProgress\s*=/);
  assert.match(progressScript, /function buildProgressCard\(config, deps\)/);
  assert.match(progressScript, /<progress class="progress-bar"/);
  assert.match(progressScript, /value="\$\{fillWidth\}"/);
  assert.match(adminScript, /window\.adminProgress\.buildProgressCard\(\{/);
  assert.doesNotMatch(progressScript, /class="progress-fill"/);
  assert.doesNotMatch(progressScript, /style="width:\$\{fillWidth\}%"/);

  const buildProgressCard = adminScript.match(/function buildProgressCard\(user, guide\) \{[\s\S]*?\n  \}/);
  assert.ok(buildProgressCard, "buildProgressCard should remain as a thin wrapper");
  assert.doesNotMatch(buildProgressCard[0], /REDES_ADMIN_QUIZ_CONFIGS\.map/);
  assert.doesNotMatch(buildProgressCard[0], /GUIDE6_ACTIVITIES/);
});

test("admin response modal can export visible answers to Word", () => {
  assert.match(html, /id="guide2-responses-export"/);
  assert.match(html, /data-export-responses-word/);
  assert.ok(
    html.indexOf("js/admin_export.js") >= 0 && html.indexOf("js/admin_export.js") < html.indexOf("js/admin_usuarios.js"),
    "admin export module should load before admin_usuarios.js"
  );
  assert.match(css, /\.modal-export-actions/);
  assert.match(exportScript, /window\.adminExport\s*=/);
  assert.match(exportScript, /function buildWordDocument\(exportData\)/);
  assert.match(exportScript, /function downloadWord\(exportData, options\)/);
  assert.match(adminScript, /function exportCurrentResponsesToWord/);
  assert.match(adminScript, /window\.adminExport\?\.downloadWord\(currentResponsesExport\)/);
  assert.match(adminScript, /window\.adminExport\.downloadWord\(exportData, \{/);
  assert.doesNotMatch(adminScript, /function buildAdminResponsesWordDocument/);
  assert.doesNotMatch(adminScript, /function sanitizeFileName/);
  assert.match(exportScript, /application\/msword/);
  assert.match(exportScript, /Servicio Nacional de Aprendizaje - SENA/);
  assert.match(exportScript, /Sistemas Teleinformaticos/);
  assert.match(exportScript, /Competencia/);
  assert.match(exportScript, /Resultado de Aprendizaje/);
  assert.match(adminScript, /data-export-responses-word/);
});

test("guide progress tab focuses on progress and individual unlocks, not response viewers", () => {
  const buildProgressCard = progressScript.match(/function buildProgressCard\(config, deps\) \{[\s\S]*?\n  window\.adminProgress/);
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
  assert.ok(
    html.indexOf("js/admin_guide6.js") >= 0 && html.indexOf("js/admin_guide6.js") < html.indexOf("js/admin_usuarios.js"),
    "admin guide6 module should load before admin_usuarios.js"
  );
  assert.match(guide6Script, /window\.adminGuide6\s*=/);
  assert.match(guide6Script, /function renderActivityResponsesBody\(activityId, state, deps\)/);
  assert.match(guide6Script, /function renderFullResponsesBody\(state, deps\)/);
  assert.match(adminScript, /window\.adminGuide6\.renderFullResponsesBody\(state, \{/);
  assert.match(adminScript, /window\.adminGuide6\.renderActivityResponsesBody\(activityId, state, \{/);
  assert.match(activitiesScript, /function buildExplorerPanel\(config, deps\)/);
  assert.match(activitiesScript, /function buildStudentActivityTable\(config, deps\)/);
  assert.match(adminScript, /Actividad 8 - Herramientas colaborativas/);
  assert.match(adminScript, /BitÃ¡cora 3\.1\.1|BitÃƒÂ¡cora 3\.1\.1/);
  assert.match(css, /\.act-explorer__layout/);
  assert.match(css, /\.act-explorer__activity-list/);

  const guide6Renderer = adminScript.match(/function renderGuide6ActivityResponsesBody\(activityId, state\) \{[\s\S]*?\n  \}/);
  assert.ok(guide6Renderer, "renderGuide6ActivityResponsesBody should remain as a thin wrapper");
  assert.doesNotMatch(guide6Renderer[0], /GUIDE6_INSTALL_IDS\.map/);
  assert.doesNotMatch(guide6Renderer[0], /quiz-guia6-312/);

  const guide6FullRenderer = adminScript.match(/function renderGuide6ResponsesBody\(state\) \{[\s\S]*?\n  \}/);
  assert.ok(guide6FullRenderer, "renderGuide6ResponsesBody should remain as a thin wrapper");
  assert.doesNotMatch(guide6FullRenderer[0], /GUIDE6_INSTALL_IDS\.map/);
  assert.doesNotMatch(guide6FullRenderer[0], /quiz-guia6-312/);
});

test("admin activities shared helpers live outside the main admin script", () => {
  assert.ok(
    html.indexOf("js/admin_activities.js") >= 0 && html.indexOf("js/admin_activities.js") < html.indexOf("js/admin_usuarios.js"),
    "admin activities module should load before admin_usuarios.js"
  );
  assert.match(activitiesScript, /window\.adminActivities\s*=/);
  assert.match(activitiesScript, /function getGroups\(users\)/);
  assert.match(activitiesScript, /function buildStandardButtons\(config, deps\)/);
  assert.match(activitiesScript, /function getUniqueInteractiveGuides\(users, deps\)/);
  assert.match(activitiesScript, /function getGuide2ActivityStatusHtml\(activityId, snapshot, deps\)/);
  assert.match(activitiesScript, /function buildGuide1ActivityResponsePayload\(config, deps\)/);
  assert.match(activitiesScript, /function buildMatriz322Table\(rows, deps\)/);
  assert.match(activitiesScript, /function buildMatriz322ModalPayload\(summary, deps\)/);
  assert.match(activitiesScript, /function buildStudentActivityTable\(config, deps\)/);
  assert.match(activitiesScript, /function buildExplorerPanel\(config, deps\)/);
  assert.match(adminScript, /window\.adminActivities\.getGroups\(users\)/);
  assert.match(adminScript, /window\.adminActivities\.buildStandardButtons\(\{/);
  assert.match(adminScript, /window\.adminActivities\.getUniqueInteractiveGuides\(users, \{/);
  assert.match(adminScript, /window\.adminActivities\.getGuide2ActivityStatusHtml\(activityId, snapshot, \{/);
  assert.match(adminScript, /window\.adminActivities\.buildGuide1ActivityResponsePayload\(\{/);
  assert.match(adminScript, /window\.adminActivities\.buildMatriz322Table\(rows, \{ escapeHtml, formatDate \}\)/);
  assert.match(adminScript, /window\.adminActivities\.buildMatriz322ModalPayload\(summary, \{ escapeHtml, formatDate \}\)/);
  assert.match(adminScript, /window\.adminActivities\.buildStudentActivityTable\(\s*\{/);
  assert.match(adminScript, /window\.adminActivities\.buildExplorerPanel\(\s*\{/);

  const groupsHelper = adminScript.match(/function getActivitiesGroups\(users\) \{[\s\S]*?\n  \}/);
  assert.ok(groupsHelper, "getActivitiesGroups should remain as a thin wrapper");
  assert.doesNotMatch(groupsHelper[0], /new Set\(/);

  const standardButtons = adminScript.match(/function buildStandardActivityButtons\(activityId, guideKind, fileName, activityLabel, user\) \{[\s\S]*?\n  \}/);
  assert.ok(standardButtons, "buildStandardActivityButtons should remain as a thin wrapper");
  assert.doesNotMatch(standardButtons[0], /data-view-guide-activity/);

  const uniqueGuides = adminScript.match(/function getUniqueInteractiveGuides\(users\) \{[\s\S]*?\n  \}/);
  assert.ok(uniqueGuides, "getUniqueInteractiveGuides should remain as a thin wrapper");
  assert.doesNotMatch(uniqueGuides[0], /\.map\(\(fileName\)/);

  const guide2Status = adminScript.match(/function getGuide2ActivityStatusHtml\(activityId, snapshot\) \{[\s\S]*?\n  \}/);
  assert.ok(guide2Status, "getGuide2ActivityStatusHtml should remain as a thin wrapper");
  assert.doesNotMatch(guide2Status[0], /keys\.some/);

  const guide1Payload = adminScript.match(/function buildGuide1ActivityResponsePayload\(user, fileName, activityId, activityLabel\) \{[\s\S]*?\n  \}/);
  assert.ok(guide1Payload, "buildGuide1ActivityResponsePayload should remain as a thin wrapper");
  assert.doesNotMatch(guide1Payload[0], /Fecha de entrega/);
  assert.doesNotMatch(guide1Payload[0], /renderAnswerTable\(\s*\["Campo", "Valor"\]/);

  const studentTable = adminScript.match(/function buildActivitiesStudentTable\(groupUsers, fileName, activityId, activityLabel, guideKind\) \{[\s\S]*?\n  \}/);
  assert.ok(studentTable, "buildActivitiesStudentTable should remain as a thin wrapper");
  assert.doesNotMatch(studentTable[0], /guideKind === "redes"/);
  assert.doesNotMatch(studentTable[0], /redesQuizSummaries\[user\.usernameKey\]/);

  const explorerPanel = adminScript.match(/function buildActivitiesPanels\(groupUsers\) \{[\s\S]*?\n  \}/);
  assert.ok(explorerPanel, "buildActivitiesPanels should remain as a thin wrapper");
  assert.doesNotMatch(explorerPanel[0], /act-explorer__guide-filter/);
  assert.doesNotMatch(explorerPanel[0], /act-explorer__activity-list/);
});

test("admin password changes require explicit confirmation before saving", () => {
  const handler = adminScript.match(
    /async function handlePasswordSubmit\(form\) \{[\s\S]*?\n  async function handleAccountSubmit/
  );
  assert.ok(handler, "handlePasswordSubmit should be present");

  assert.match(handler[0], /await confirmAdminAction/);
  assert.match(handler[0], /if \(!confirmed\) \{[\s\S]*return;/);
  assert.ok(
    handler[0].indexOf("confirmAdminAction") < handler[0].indexOf("auth.updateStudentPassword"),
    "confirmation must happen before auth.updateStudentPassword"
  );
});

test("admin account changes require confirmation before saving", () => {
  const handler = adminScript.match(
    /async function handleAccountSubmit\(form\) \{[\s\S]*?\n  async function handleResetGuide/
  );
  assert.ok(handler, "handleAccountSubmit should be present");

  assert.match(handler[0], /await confirmAdminAction/);
  assert.match(handler[0], /if \(!confirmed\) \{[\s\S]*return;/);
  assert.ok(
    handler[0].indexOf("confirmAdminAction") < handler[0].indexOf("auth.updateStudentAccount"),
    "confirmation must happen before auth.updateStudentAccount"
  );
});

test("admin sensitive actions use a shared confirmation helper", () => {
  assert.match(adminScript, /async function confirmAdminAction\(message\)/);

  const directConfirmCalls = adminScript.match(/window\.confirm/g) || [];
  assert.equal(directConfirmCalls.length, 1, "window.confirm should only be called inside the helper");

  assert.match(adminScript, /const confirmed = await confirmAdminAction\(/);
  assert.match(adminScript, /await confirmAdminAction\([\s\S]*auth\.updateStudentPassword/);
  assert.match(adminScript, /await confirmAdminAction\([\s\S]*auth\.updateStudentAccount/);
});

test("admin confirmation helper lives in its own script loaded before the admin panel", () => {
  const confirmationScript = fs.readFileSync(
    path.join(root, "js", "admin_confirmations.js"),
    "utf8"
  );
  const confirmationIndex = html.indexOf("js/admin_confirmations.js");
  const adminIndex = html.indexOf("js/admin_usuarios.js");

  assert.ok(confirmationIndex >= 0, "panel should load admin_confirmations.js");
  assert.ok(adminIndex > confirmationIndex, "confirmations should load before admin_usuarios.js");
  assert.match(confirmationScript, /window\.adminConfirmAction\s*=/);
  assert.match(confirmationScript, /role", "dialog"/);
  assert.match(confirmationScript, /aria-modal/);
  assert.match(confirmationScript, /data-admin-confirm-accept/);
  assert.match(confirmationScript, /Promise\.resolve\(window\.confirm\(message\)\)/);
  assert.doesNotMatch(confirmationScript, /createElement\("style"\)/);
  assert.match(css, /\.admin-confirmation-modal/);
  assert.match(css, /\.admin-confirmation-card/);
  assert.match(adminScript, /window\.adminConfirmAction/);
});

test("admin panel exposes a local audit tab for sensitive actions", () => {
  assert.match(html, /data-tab="auditoria"/);
  assert.match(html, /id="audit-container"/);
  assert.doesNotMatch(adminScript, /const ADMIN_AUDIT_KEY/);
  assert.match(auditScript, /const ADMIN_AUDIT_KEY = "sena_portal_admin_audit_v1"/);
  assert.match(auditScript, /window\.adminAudit\s*=/);
  assert.match(auditScript, /recordAction/);
  assert.match(auditScript, /renderAuditTab/);
  assert.match(auditScript, /function escapeHtml/);
  assert.doesNotMatch(adminScript, /getEntries/);
  assert.doesNotMatch(adminScript, /window\.adminAudit\.getEntries/);
  assert.match(adminScript, /window\.adminAudit\.renderAuditTab/);
  assert.match(adminScript, /tab === "auditoria"/);
  assert.match(css, /\.audit-log/);
  assert.match(css, /\.audit-entry/);
});

test("admin sensitive actions are recorded after successful changes", () => {
  assert.match(html, /js\/admin_audit\.js/);
  assert.ok(
    html.indexOf("js/admin_audit.js") < html.indexOf("js/admin_usuarios.js"),
    "admin audit module should load before admin_usuarios.js"
  );
  assert.match(adminScript, /recordAdminAuditAction\(\{[\s\S]*action: "password-change"/);
  assert.match(adminScript, /recordAdminAuditAction\(\{[\s\S]*action: "account-update"/);
  assert.match(adminScript, /recordAdminAuditAction\(\{[\s\S]*action: "guide-reset"/);
  assert.match(adminScript, /recordAdminAuditAction\(\{[\s\S]*action: "all-progress-reset"/);
  assert.match(adminScript, /window\.adminAudit\.recordAction/);

  const passwordHandler = adminScript.match(
    /async function handlePasswordSubmit\(form\) \{[\s\S]*?\n  async function handleAccountSubmit/
  );
  assert.ok(passwordHandler, "handlePasswordSubmit should be present");
  assert.ok(
    passwordHandler[0].indexOf("auth.updateStudentPassword") < passwordHandler[0].indexOf("recordAdminAuditAction"),
    "password audit entry should be recorded after the password update succeeds"
  );
});

test("admin deadline changes require confirmation and audit entries", () => {
  assert.match(html, /js\/admin_deadlines\.js/);
  assert.ok(
    html.indexOf("js/admin_deadlines.js") < html.indexOf("js/admin_usuarios.js"),
    "admin deadlines module should load before admin_usuarios.js"
  );
  assert.match(deadlinesScript, /window\.adminDeadlines\s*=/);
  assert.match(deadlinesScript, /function buildConfigPanel\(users, deps\)/);
  assert.doesNotMatch(adminScript, /function buildDeadlineConfigPanel\(users\)/);
  assert.match(adminScript, /window\.adminDeadlines\.buildConfigPanel/);

  const saveHandler = adminScript.match(
    /async function handleSaveActivityDeadline\(button\) \{[\s\S]*?\n  async function handleClearActivityDeadline/
  );
  assert.ok(saveHandler, "handleSaveActivityDeadline should be present");
  assert.match(saveHandler[0], /await confirmAdminAction/);
  assert.match(saveHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "deadline-save"/);
  assert.ok(
    saveHandler[0].indexOf("confirmAdminAction") < saveHandler[0].indexOf("deadlineManager.savePolicy"),
    "deadline save confirmation should happen before savePolicy"
  );
  assert.ok(
    saveHandler[0].indexOf("deadlineManager.savePolicy") < saveHandler[0].indexOf("recordAdminAuditAction"),
    "deadline save audit entry should be recorded after savePolicy"
  );

  const clearHandler = adminScript.match(
    /async function handleClearActivityDeadline\(button\) \{[\s\S]*?\n  async function handlePasswordSubmit/
  );
  assert.ok(clearHandler, "handleClearActivityDeadline should be present");
  assert.match(clearHandler[0], /await confirmAdminAction/);
  assert.match(clearHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "deadline-clear"/);
  assert.ok(
    clearHandler[0].indexOf("confirmAdminAction") < clearHandler[0].indexOf("deadlineManager.clearPolicy"),
    "deadline clear confirmation should happen before clearPolicy"
  );
});

test("admin grade changes require confirmation and audit entries", () => {
  const gradeHandler = adminScript.match(
    /async function handleGradeChange\(select\) \{[\s\S]*?\n  function patchGuideState/
  );
  assert.ok(gradeHandler, "handleGradeChange should be async and present");
  assert.match(gradeHandler[0], /await confirmAdminAction/);
  assert.match(gradeHandler[0], /select\.value = previousGrade/);
  assert.match(gradeHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "grade-change"/);
  assert.ok(
    gradeHandler[0].indexOf("confirmAdminAction") < gradeHandler[0].indexOf("gradesManager.setStudentActivityGrade"),
    "manual grade confirmation should happen before setStudentActivityGrade"
  );

  const importHandler = adminScript.match(
    /async function readGradesFromExcelFile\(file\) \{[\s\S]*?\n  function renderUsers/
  );
  assert.ok(importHandler, "readGradesFromExcelFile and import flow should be present");
  assert.match(adminScript, /const parsed = await readGradesFromExcelFile\(file\)/);
  assert.match(adminScript, /await confirmAdminAction\([\s\S]*parsed\.students\.length/);
  assert.match(adminScript, /const result = adminGrades\.applyParsedGrades\(parsed\.guideFamily, parsed\.students, allUsers, window\.activityGradesManager\)/);
  assert.match(adminScript, /recordAdminAuditAction\(\{[\s\S]*action: "grades-import"/);
});

test("admin grade Excel import validates file type and size before reading", () => {
  assert.match(html, /js\/admin_grades\.js/);
  assert.ok(
    html.indexOf("js/admin_grades.js") < html.indexOf("js/admin_usuarios.js"),
    "admin grades module should load before admin_usuarios.js"
  );
  assert.match(gradesScript, /window\.adminGrades\s*=/);
  assert.match(gradesScript, /const GRADES_IMPORT_MAX_BYTES = 10 \* 1024 \* 1024/);
  assert.match(gradesScript, /function validateExcelFile\(file\)/);
  assert.match(gradesScript, /function normalizeForMatch\(str\)/);
  assert.match(gradesScript, /function parseWorkbook\(wb\)/);
  assert.match(gradesScript, /function applyParsedGrades\(guideFamily, students, allUsers, gradesManager\)/);
  assert.doesNotMatch(adminScript, /const GRADES_IMPORT_MAX_BYTES = 10 \* 1024 \* 1024/);
  assert.doesNotMatch(adminScript, /function validateGradesExcelFile\(file\)/);
  assert.doesNotMatch(adminScript, /function normalizeForMatch\(str\)/);
  assert.doesNotMatch(adminScript, /const EXCEL_GUIDE_SIGNATURES = \[/);
  assert.doesNotMatch(adminScript, /function parseGradesFromWorkbook\(wb\)/);
  assert.doesNotMatch(adminScript, /function applyParsedGrades\(guideFamily, students, allUsers\)/);

  const changeHandler = adminScript.match(
    /fileInput\.addEventListener\("change", async \(e\) => \{[\s\S]*?\n      \}\);/
  );
  assert.ok(changeHandler, "grades file change handler should be present");
  assert.match(changeHandler[0], /const validation = adminGrades\.validateExcelFile\(file\)/);
  assert.ok(
    changeHandler[0].indexOf("adminGrades.validateExcelFile") < changeHandler[0].indexOf("readGradesFromExcelFile"),
    "file validation should happen before reading the workbook"
  );
  assert.match(adminScript, /adminGrades\.parseWorkbook\(wb\)/);
  assert.match(adminScript, /adminGrades\.applyParsedGrades\(parsed\.guideFamily, parsed\.students, allUsers, window\.activityGradesManager\)/);
});

test("admin grade import panel uses stylesheet classes instead of inline styles", () => {
  const gradesTab = adminScript.match(
    /function renderGradesTab\(users\) \{[\s\S]*?\n  async function readGradesFromExcelFile/
  );
  assert.ok(gradesTab, "renderGradesTab should be present");

  assert.match(gradesTab[0], /class="grades-import-box"/);
  assert.match(gradesTab[0], /class="grades-import-title"/);
  assert.match(gradesTab[0], /class="grades-import-copy"/);
  assert.match(gradesTab[0], /class="grades-import-actions"/);
  assert.match(gradesTab[0], /class="btn secondary grades-import-button"/);
  assert.match(gradesTab[0], /class="grades-import-input"/);
  assert.match(gradesTab[0], /class="grades-import-status"/);
  assert.match(gradesTab[0], /class="grades-import-divider"/);
  assert.doesNotMatch(gradesTab[0], /style="/);

  assert.match(css, /\.grades-import-box/);
  assert.match(css, /\.grades-import-title/);
  assert.match(css, /\.grades-import-copy/);
  assert.match(css, /\.grades-import-actions/);
  assert.match(css, /\.grades-import-button/);
  assert.match(css, /\.grades-import-input/);
  assert.match(css, /\.grades-import-status/);
  assert.match(css, /\.grades-import-divider/);
});

test("admin redes unlock actions use shared confirmation and audit", () => {
  const guideHandler = adminScript.match(
    /async function unlockRedesGuideProgress\(usernameKey, fileName, displayName\) \{[\s\S]*?\n  async function unlockRedesActivityProgress/
  );
  assert.ok(guideHandler, "unlockRedesGuideProgress should be present");
  assert.match(guideHandler[0], /await confirmAdminAction/);
  assert.doesNotMatch(guideHandler[0], /\bconfirm\(/);
  assert.match(guideHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "redes-guide-unlock"/);

  const activityHandler = adminScript.match(
    /async function unlockRedesActivityProgress\(usernameKey, fileName, activityId, displayName\) \{[\s\S]*?\n  async function unlockRedesQuizProgress/
  );
  assert.ok(activityHandler, "unlockRedesActivityProgress should be present");
  assert.match(activityHandler[0], /await confirmAdminAction/);
  assert.doesNotMatch(activityHandler[0], /\bconfirm\(/);
  assert.match(activityHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "redes-activity-unlock"/);

  const quizHandler = adminScript.match(
    /async function unlockRedesQuizProgress\(usernameKey, fileName, quizKey, displayName\) \{[\s\S]*?\n  async function unlockRedesStudent/
  );
  assert.ok(quizHandler, "unlockRedesQuizProgress should be present");
  assert.match(quizHandler[0], /await confirmAdminAction/);
  assert.doesNotMatch(quizHandler[0], /\bconfirm\(/);
  assert.match(quizHandler[0], /recordAdminAuditAction\(\{[\s\S]*action: "redes-quiz-unlock"/);

  const studentHandler = adminScript.match(
    /async function unlockRedesStudent\(usernameKey, ficha, displayName\) \{[\s\S]*?\n  window\.unlockRedesStudent/
  );
  assert.ok(studentHandler, "unlockRedesStudent should be present");
  assert.doesNotMatch(studentHandler[0], /return;\s*if \(/, "unlockRedesStudent should not keep unreachable confirm code");
});

test("admin redes status labels use CSS classes instead of inline colors", () => {
  assert.match(html, /js\/admin_redes\.js/);
  assert.ok(
    html.indexOf("js/admin_redes.js") < html.indexOf("js/admin_usuarios.js"),
    "admin redes module should load before admin_usuarios.js"
  );
  assert.match(redesScript, /window\.adminRedes\s*=/);
  assert.match(redesScript, /function getQuizStatusLabel\(summary\)/);
  assert.match(redesScript, /function getQuizStatusText\(summary\)/);
  assert.match(redesScript, /function getQuizScoreText\(summary\)/);
  assert.match(redesScript, /function getSocializationStatusLabel\(locked\)/);
  assert.match(redesScript, /function getSocializationActivityStatusHtml\(summary, deps\)/);
  assert.match(redesScript, /function getActivityStateRows\(activity, state\)/);
  assert.match(redesScript, /function buildSocializationPayload\(config, deps\)/);
  assert.match(redesScript, /function buildActivityStatePayload\(config, deps\)/);
  assert.match(redesScript, /redes-status-label--warning/);
  assert.match(redesScript, /redes-status-label--success/);
  assert.match(redesScript, /redes-status-label--progress/);
  assert.doesNotMatch(redesScript, /style=/);
  assert.doesNotMatch(adminScript, /function getRedesQuizStatusLabel\(summary\)/);
  assert.match(adminScript, /window\.adminRedes\.getQuizStatusText\(summary\)/);
  assert.match(adminScript, /window\.adminRedes\.getActivityStateRows\(activity, state\)/);
  assert.match(redesScript, /getQuizScoreText\(summary\)/);
  assert.match(activitiesScript, /adminRedes\.getSocializationActivityStatusHtml\(summary, \{ formatDate, escapeHtml \}\)/);
  assert.match(adminScript, /window\.adminRedes\.buildSocializationPayload\(\{/);
  assert.match(adminScript, /window\.adminRedes\.buildActivityStatePayload\(\{/);
  assert.doesNotMatch(adminScript, /Sin env(?:ÃƒÂ­|Ã­)o registrado/);
  assert.doesNotMatch(adminScript, /Puntaje \$\{escapeHtml\(summary\.score\)\} \/ \$\{escapeHtml\(summary\.maxScore \|\| 100\)\}/);
  assert.doesNotMatch(adminScript, /summary\.status === "terminated_visibility"[\s\S]*\? "Finalizado por visibilidad"[\s\S]*: summary\.locked/);
  assert.doesNotMatch(adminScript, /Notas enviadas", summary\.text/);
  assert.doesNotMatch(adminScript, /renderAnswerTable\(\["Campo", "Valor"\], rows\)/);

  const socialTable = adminScript.match(
    /function buildRedesSocializacionTable\(rows\) \{[\s\S]*?\n  function getActivitiesGroups/
  );
  assert.ok(socialTable, "buildRedesSocializacionTable should be present");
  assert.match(adminScript, /window\.adminRedes\.getQuizStatusLabel\(summary\)/);
  assert.match(socialTable[0], /window\.adminRedes\.getSocializationStatusLabel\(summary\.locked\)/);
  assert.match(socialTable[0], /class="redes-socialization-notes"/);
  assert.doesNotMatch(socialTable[0], /<span style=/);

  assert.match(css, /\.redes-status-label/);
  assert.match(css, /\.redes-status-label--warning/);
  assert.match(css, /\.redes-status-label--success/);
  assert.match(css, /\.redes-status-label--progress/);
  assert.match(css, /\.redes-socialization-notes/);
});
