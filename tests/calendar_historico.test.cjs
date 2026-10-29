'use strict';
// 2026-10-29 · Un solo calendario vigente: la dirección antigua redirige al oficial y el registro anterior solo se abre
// a propósito como «Histórico 2026 — Solo consulta», sin escrituras ni indicadores de conexión.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function runRedirect(search){const calls=[];const window={location:{search,replace:u=>calls.push(u)}};vm.runInNewContext(read('js/legacy_calendar_redirect.js'),{window});return {calls,historico:window.legacyCalendarHistorical};}
test('la dirección antigua redirige al calendario oficial; ?historico=1 abre el histórico',()=>{
 assert.deepEqual(runRedirect('').calls,['calendario-academico-sesiones.html']);
 assert.deepEqual(runRedirect('?x=1').calls,['calendario-academico-sesiones.html']);
 const h=runRedirect('?historico=1');assert.deepEqual(h.calls,[]);assert.equal(h.historico,true);
});
test('el redireccionador se carga antes que cualquier otro script del calendario antiguo',()=>{
 const html=read('calendario-academico-2026.html'),first=html.indexOf('<script');
 assert.ok(html.slice(first,first+120).includes('js/legacy_calendar_redirect.js'));assert.match(html,/<title>Histórico 2026 — Solo consulta/);
 assert.match(html,/legacy_calendar_readonly\.js/);
});
test('el histórico no ofrece guardar, cargar, restaurar ni indicadores de conexión',()=>{
 const js=read('js/legacy_calendar_readonly.js');
 for(const id of ['firebase-sync-button','calendar-reset-button','firebase-load-button'])assert.ok(js.includes('hide("'+id+'")'),id);
 assert.match(js,/sync-chip/);assert.match(js,/el\.style\.display = "none"/,'el estilo .hbtn anula hidden: se oculta con display');assert.match(js,/NO es la programación vigente/);assert.match(js,/window\.syncFirebaseState = function \(\) \{ return Promise\.resolve\(false\); \}/);
});
test('ningún enlace operativo abre la programación obsoleta: menú → oficial, inicio → oficial + histórico rotulado',()=>{
 assert.match(read('js/shared_shell.js'),/href="' \+ p \+ 'calendario-academico-sesiones\.html" data-nav-key="calendario"/);
 const idx=read('index.html');assert.ok(!/href="calendario-academico-2026\.html"/.test(idx));
 assert.match(idx,/href="calendario-academico-2026\.html\?historico=1"[\s\S]{0,200}Histórico 2026 — Solo consulta/);
 assert.match(idx,/href="calendario-academico-sesiones\.html"[\s\S]{0,200}Calendario oficial 2026/);
});
