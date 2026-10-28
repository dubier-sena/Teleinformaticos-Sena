'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../js/academic_planner_integration.js'),C=require('../js/academic_planner_calendar.js');
const mapping={'Institución ficticia|Grupo ficticio':'900001'};
const source=()=>[{id:'ficticia',fecha:'2030-02-04',tipo:'CLASE',colegio:'Institución ficticia',grado:'Grupo ficticio',horario:'7:00am–7:55am / 9:00am–9:55am',defE:'Activa',defO:'Base ficticia'}];
const states=()=>({'ficticia|franja1':{estado:'Impartida',obs:'Primera franja ficticia',act:{nombre:'Actividad ficticia',fecha:'2030-02-06'},custom:{mustKeep:true}},'ficticia|franja2':{estado:'Cancelada',obs:'Segunda franja ficticia'}});
const freeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')freeze(v);return Object.freeze(o);};
test('aplica cada override por ID expandido sin modificar originales ni campos desconocidos',()=>{
 const r=freeze(source()),o=freeze(states()),seed=freeze({ficticia:{estado:'Recuperada'}}),before=JSON.stringify({r,o,seed});
 const result=I.legacy(r,seed,o,mapping);
 assert.deepEqual(result.projected.map(r=>[r.sourceId,r.state]),[['ficticia|franja1','Impartida'],['ficticia|franja2','Cancelada']]);
 for(const row of result.projected)assert.deepEqual(row.sourceState,o[row.sourceId]);
 assert.deepEqual(result.raw,{records:r,seed,overrides:o});assert.equal(JSON.stringify({r,o,seed}),before);assert.equal(result.issues.length,0);
 assert.deepEqual(result.projected.map(r=>r.schedule),['7:00am–7:55am','9:00am–9:55am']);
});
test('precedencia de claves base y franja reproduce el orden publicado sin descartar raw',()=>{
 const o={ficticia:{estado:'Impartida'},'ficticia|franja2':{estado:'Cancelada'},orphan:{estado:'Impartida'}};
 const out=I.legacy(source(),{},o,mapping);assert.deepEqual(out.projected.map(r=>r.state),['Impartida','Cancelada']);assert.deepEqual(out.raw.overrides.orphan,o.orphan);assert.equal(out.issues.length,1);
 const reverse=I.legacy(source(),{},Object.fromEntries(Object.entries(o).reverse()),mapping);assert.deepEqual(reverse.projected.map(r=>r.state),['Impartida','Impartida']);
});
test('un override parcial conserva los defaults publicados, incluidos observación vacía y actividad nula',()=>{
 const n=I.legacy(source(),{ficticia:{estado:'Impartida',obs:'seed',act:{nombre:'seed'}}},{'ficticia|franja1':{obs:'',act:null}},mapping);
 assert.equal(n.projected[0].state,'Activa');assert.equal(n.projected[0].observation,'');assert.equal(n.projected[0].activity,null);assert.equal(n.projected[1].state,'Impartida');
});
test('fuente ya expandida no produce IDs dobles y duplicados explícitos se rechazan',()=>{
 const a=I.expandLegacyRecords(source());assert.deepEqual(I.expandLegacyRecords(a),a);
 assert.throws(()=>I.legacy([a[0],a[0]],{},{},mapping),/duplicados/);
});
test('estados SENA impartidos y campos de actividad se conservan sin inventar ficha',()=>{
 const r=[{id:'sena-ficticio',fecha:'2030-02-04',tipo:'SENA',horario:'—',defE:'Activa'}],o={'sena-ficticio':{estado:'Impartida',obs:'Registro ficticio',sourceRow:'9'}};
 const n=I.legacy(r,{},o,mapping);assert.equal(n.projected[0].state,'Impartida');assert.equal(n.projected[0].ficha,null);assert.deepEqual(n.projected[0].sourceState,o['sena-ficticio']);assert.equal(n.stats.sena,1);
});
test('minutos desconocidos permanecen null; una duración teórica no demuestra ejecución',()=>{
 const projection=I.legacy(source(),{},states(),mapping),sessions=I.legacySessions(projection).sessions;
 assert.ok(projection.projected.every(r=>r.actualMinutes===null));assert.equal(sessions[0].actualMinutes,null);assert.equal(sessions[0].plannedMinutes,110);assert.equal(C.metrics(sessions).actual,null);assert.equal(C.executionLabel(null),'No documentados');assert.equal(C.executionLabel(0),'0 min');
});
test('solo suma minutos explícitos por franja, sin duplicar un total agregado de la base',()=>{
 let p=I.legacy(source(),{}, {'ficticia|franja1':{estado:'Impartida',actualMinutes:45},'ficticia|franja2':{estado:'Parcial',actualMinutes:20}},mapping);
 assert.equal(I.legacySessions(p).sessions[0].actualMinutes,65);
 p=I.legacy(source(),{ficticia:{estado:'Impartida',actualMinutes:65}},{},mapping);assert.equal(I.legacySessions(p).sessions[0].actualMinutes,null);
 p.projected[0].actualMinutes=45;assert.equal(I.legacySessions(p).sessions[0].actualMinutes,null);
});
test('agenda de aprendiz preserva estados distintos por franja y excluye otra ficha y año',()=>{
 const projection=I.legacy(source(),{},states(),mapping),sessions=I.legacySessions(projection).sessions;
 const other={...sessions[0],id:'other',ficha:'900002'},next={...sessions[0],id:'next',year:2031};
 const out=I.toAgenda({sessions:[...sessions,other,next]}, {role:'aprendiz',ficha:'900001'},2030);
 assert.equal(out.length,2);assert.deepEqual(out.map(e=>e.status),['taught','cancelled']);assert.deepEqual(out.map(e=>e.sourceRowId),['ficticia|franja1','ficticia|franja2']);
 assert.ok(out.every(e=>e.ficha==='900001'&&e.readonly&&e.actualMinutes===null));assert.ok(out.every(e=>!e.description.includes('0 min')&&e.description.includes('no documentados')));
 assert.deepEqual(I.toAgenda({sessions},{role:'aprendiz',ficha:'900002'},2030),[]);
});
test('la vista diaria y el resumen no convierten null a cero ni muestran null minutos',()=>{
 const sessions=I.legacySessions(I.legacy(source(),{},states(),mapping)).sessions,config={year:2030,institutions:[],breaks:[]};
 const html=C.day('2030-02-04',sessions,config,[]);assert.match(html,/Realizados: No documentados/);assert.doesNotMatch(html,/Realizados: (0|null)/);
 assert.equal(C.metrics([{...sessions[0],actualMinutes:45},sessions[0]]).actual,null);
});
test('rechaza filas históricas que contradicen la ficha o año de la sesión consultada',()=>{
 const sessions=I.legacySessions(I.legacy(source(),{},states(),mapping)).sessions;
 for(const field of ['ficha','date']){const bad=structuredClone(sessions);bad[0].sourceRows[0][field]=field==='ficha'?'900002':'2031-02-04';assert.throws(()=>I.toAgenda({sessions:bad},{role:'aprendiz',ficha:'900001'},2030),/fuera de ficha o año/);}
});
test('cada bloque histórico mantiene su estado en las vistas semana y día',()=>{
 const sessions=I.legacySessions(I.legacy(source(),{},states(),mapping)).sessions,s=sessions[0],config={year:2030,institutions:[],breaks:[]};
 assert.equal(C.blockStatus(s,s.blocks[0]),'Impartida');assert.equal(C.blockStatus(s,s.blocks[1]),'Cancelada');
 const week=C.week('2030-02-04',sessions,config,[]),day=C.day('2030-02-04',sessions,config,[]);
 assert.match(week,/state-taught/);assert.match(week,/state-cancelled/);assert.match(day,/07:00–07:55 · Impartida/);assert.match(day,/09:00–09:55 · Cancelada/);assert.match(day,/Primera franja ficticia/);
});
