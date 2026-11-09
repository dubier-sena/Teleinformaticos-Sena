'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const clone = v => JSON.parse(JSON.stringify(v));
function load() {
  const container = { innerHTML: '' };
  const ctx = { console, window: { addEventListener() {} }, document: { querySelector: s => s === '[data-act-std-avance]' ? container : null, querySelectorAll: () => [], head: null, addEventListener() {} } };
  vm.createContext(ctx);
  for (const f of ['guide_merge_utils', 'activity_standard', 'guide_declarations']) vm.runInContext(read('js/' + f + '.js'), ctx);
  return { ctx, w: ctx.window, utils: ctx.window.guideMergeUtils, container };
}
function fn(src, name) {
  const start = src.indexOf(name); assert.ok(start >= 0, name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1); }
  throw Error(name);
}
const FILES = ['11a', '11b'].flatMap(g => ['09-redes-rap01', '10-redes-rap02', '11-redes-rap03'].map(r => `grupo-${g}-guia-${r}.html`));
const fileRecord = { status: 'delivered', savedFileName: 'evidencia-ficticia.pkt', submittedAt: '2026-11-09T12:00:00Z' };
for (const file of FILES) test(file + ': vacio, parcial y completo usan el mismo contador en guia/control/inicio/derivacion', () => {
  const { w, ctx, utils, container } = load();
  const acts = w.ActivityStandard.getConfigForGuide(file).activities;
  const form = acts.find(a => a.type === 'form' && a.formFields.length > 1);
  assert.ok(form);
  const family = 'guia-redes11-' + file.match(/rap0[123]/)[0];
  const grades = {};
  w.activityGradesManager = { GUIDE_FAMILY_BY_FILE: { [file]: family }, isEvidenceStrictFamily: () => true, getStudentGrades: () => grades };
  w.portalAuth = { getCurrentSession: () => ({ role: 'student', usernameKey: 'ficticio' }) };
  const state = {};
  const check = expected => {
    const before = JSON.stringify(state);
    const prog = utils.redes11Progress(file, state, grades);
    assert.equal(prog.completed, expected);
    assert.equal(prog.total, acts.length);
    w.ActivityStandard.renderAvancePanel({ getGuideDataFile: () => file, getState: () => state });
    assert.match(container.innerHTML, new RegExp(expected + ' / ' + acts.length + ' &middot; ' + prog.percent + '%'));
    const derived = utils.deriveProgressFromGuideDataDoc(file, { snapshotJson: JSON.stringify({ state }), redes11Grades: grades });
    assert.equal(derived.completed, expected);
    ctx.state = state; ctx.grades = grades;
    vm.runInContext(fn(read('js/portal_home.js'), 'function pendingActivitiesFor('), ctx);
    ctx.window.ActivityStandard = w.ActivityStandard; ctx.guideState = () => state;
    const pending = vm.runInContext(`pendingActivitiesFor(${JSON.stringify(file)}, 'ficticio')`, ctx);
    assert.equal(pending.length, acts.length - expected);
    assert.equal(JSON.stringify(state), before, 'no crea ni modifica evidencias');
  };
  check(0);
  state[form.formFields[0]] = 'respuesta propia'; check(0);
  assert.match(container.innerHTML, /En proceso/);
  state[form.id + '-locked'] = true; check(0);
  for (const k of form.formFields) state[k] = 'respuesta propia'; check(1);
  // Tampoco suma metadatos, contenido legado ni marcas de falsa reapertura.
  state.reabierta = true; state.permiteEdicion = true; state['otro-locked'] = true; state.legacy = 'texto'; check(1);
  grades[form.id] = 'A'; grades[form.id + ':solution'] = { otro: 'modelo' }; check(1);
});
test('archivo: nota A, metadatos, fallo o entrega por aprobacion nunca sustituyen un archivo', () => {
  const { utils } = load(); const act = { id: 'x', type: 'file' };
  for (const rec of [null, { status: 'delivered' }, { status: 'reabierta', savedFileName: 'x' }, { ...fileRecord, registeredBy: 'admin-grade-approval' }, { status: 'delivery-failed', fileId: 'x' }]) {
    const s = { 'x-delivery': rec, 'x-locked': true };
    assert.equal(utils.redes11ActivityProgress(act, s, 'A').complete, false);
  }
  assert.equal(utils.redes11ActivityProgress(act, { 'x-delivery': fileRecord }, 'A').complete, true);
});
test('formulario+archivo exige todas las partes; A no suple formulario ni archivo', () => {
  const { utils } = load(); const a = { id: 'x', type: 'both', formFields: ['a', 'b'] };
  for (const st of [{ a: 'si' }, { a: 'si', b: 'si' }, { 'x-delivery': fileRecord }, { a: 'si', 'x-delivery': fileRecord }]) assert.equal(utils.redes11ActivityProgress(a, st, 'A').complete, false);
  assert.equal(utils.redes11ActivityProgress(a, { a: 'si', b: 'si', 'x-delivery': fileRecord }, null).complete, true);
});
test('100 % de desarrollo no modifica ni aprueba el RAP; el conteo es entero por actividad', () => {
  const { utils, w } = load();
  for (const file of FILES) {
    const state = {}; const acts = w.ActivityStandard.getConfigForGuide(file).activities;
    acts.forEach(a => { (a.formFields || []).forEach(k => state[k] = 'propia'); if (a.type === 'file' || a.type === 'both') state[a.id + '-delivery'] = fileRecord; });
    const before = JSON.stringify(state);
    const p = utils.redes11Progress(file, state, {});
    assert.equal(p.percent, 100); assert.equal(p.completed, acts.length); assert.equal(JSON.stringify(state), before);
  }
});
for (const [sig, attrs] of [ ['async function handleUnlockClick(', { habGuide: FILES[0], habUnlock: 'ficticio', habActivity: 'x' }], ['async function reopenDeliveredActivity(', { guideFile: FILES[0], reopenDelivery: 'ficticio', activityId: 'x' }] ]) test('reapertura segura: ' + sig + ' no confirma exito, no cambia nota ni escribe estado', async () => {
  const messages = [];
  const ctx = { hasAdminPanelAccess: () => true, getUser: () => ({ usernameKey: 'ficticio' }), setFeedback: (s, kind) => messages.push({ s, kind }) };
  vm.createContext(ctx); vm.runInContext(fn(read('js/admin_usuarios.js'), sig), ctx);
  ctx.button = { dataset: attrs };
  await vm.runInContext(sig.includes('handleUnlock') ? 'handleUnlockClick(button)' : 'reopenDeliveredActivity(button)', ctx);
  assert.equal(messages.length, 1); assert.match(messages[0].s, /Reapertura de Redes 11 no disponible/); assert.equal(messages[0].kind, 'error');
});
test('el inicio y los fallbacks locales derivan actividades en vez de confiar en porcentajes antiguos', () => {
  const { w, ctx, utils } = load();
  const file = FILES[0]; const acts = w.ActivityStandard.getConfigForGuide(file).activities;
  const state = { [acts[0].formFields[0]]: 'parcial' };
  ctx.readJson = (k, fb) => k.includes('guide-data') ? state : { completed: 999, total: 999 };
  ctx.getStudentStorageKey = ctx.getStudentStorageKeyLocal = (u, k, o) => o.area + ':' + k;
  ctx.buildProgressResult = (f, completed, total, source) => ({ completed, total, source });
  for (const suffix of ['', 'Local']) {
    vm.runInContext(fn(read('js/portal_auth.js'), 'function getStudentGuideProgress' + suffix + '('), ctx);
    const result = vm.runInContext(`getStudentGuideProgress${suffix}('ficticio', ${JSON.stringify(file)})`, ctx);
    assert.equal(result.completed, 0); assert.equal(result.total, acts.length); assert.equal(result.source, 'redes11-activities-v1');
  }
});

test('KPI de pendientes Redes usa las actividades restantes de cada ficha y excluye entregas de otras fichas', () => {
  const { ctx, utils } = load();
  ctx.state = { users: [{ progress: { guides: [{ fileName: FILES[0], total: 13, completed: 2 }] } }] };
  ctx.getFichaEntries = () => [];
  ctx.getAllGuideFiles = () => FILES;
  ctx.deadlineManager = { getActivitiesForGuide: () => [{ id: "x" }], getSnapshot: () => ({ policies: {} }) };
  ctx.collectDeliveries = () => [{ fileName: FILES[1] }];
  ctx.progressForUser = u => u.progress;
  ctx.isInactive = () => false;
  vm.runInContext(fn(read('js/admin_usuarios.js'), 'function getDashboardStats('), ctx);
  const result = vm.runInContext('getDashboardStats()', ctx);
  assert.equal(result.pending, 11, '13 actividades propias - 2 completas; no catalogo global por todos los aprendices');
});
