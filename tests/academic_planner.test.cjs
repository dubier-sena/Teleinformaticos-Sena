'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../js/academic_planner.js'),Store=require('../js/academic_planner_store.js');
const Catalog=require('../data/academic_planner_catalog.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const actor={role:'instructor',id:'instructor-prueba',fichas:['1','2']};
const catalog=[1,2,3].map(order=>({id:'rap'+order,program:'Programa de prueba',competencyCode:'280102129',competency:'Competencia de prueba (fixture)',rap:'RAP '+order,order,fichas:['1','2'],source:'fixture-local',needsVerification:false,guides:[]}));
function config(year=2026){
  const c=P.createYear(year);c.fichas=[{id:'1',institutionId:'santa-barbara',grade:'11B',program:'Programa de prueba'},{id:'2',institutionId:'john-f-kennedy',grade:'10A',program:'Programa de prueba'}];
  c.breaksReviewed=['santa-barbara','john-f-kennedy'];
  c.schedules=[{ficha:'1',weekday:1,blocks:[{start:'07:00',end:'07:55'},{start:'09:55',end:'10:50'}]},{ficha:'2',weekday:1,blocks:[{start:'07:00',end:'09:00'}]}];
  c.rotation={start:year+'-02-02',turns:[{institutionId:'santa-barbara',weeks:1,fichas:['1']}],inactiveWeeks:[]};
  if(year===2027)c.rotation.start='2027-02-01';
  return c;
}
function proposal(c=config(),existing=[],request={}){return P.propose(c,{ficha:'1',curriculumId:'rap1',start:'2026-02-02',count:5,...request},catalog,existing,actor);}
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}

test('15 instituciones: 6 académicas, 7 técnicas y 2 privadas; años independientes',()=>{
  const a=P.createYear(2026),b=P.createYear(2027);assert.equal(a.institutions.length,15);
  assert.deepEqual([11,5,2].map(h=>a.institutions.filter(i=>i.weeklyHours===h).length),[6,7,2]);a.institutions[0].name='Cambio';assert.notEqual(a.institutions[0].name,b.institutions[0].name);
});
test('ejemplos SB: dos bloques son una sesión de 110 o 175 minutos sin contar intervalos',()=>{
  const p=proposal();assert.equal(p.sessions.length,5);assert.equal(p.totalMinutes,550);assert.equal(new Set(p.sessions.map(s=>s.date)).size,5);
  assert.equal(P.duration([{start:'09:00',end:'09:55'},{start:'14:15',end:'16:15'}]),175);assert.equal(p.sessions[0].actualMinutes,0);
});
test('rechaza fechas imposibles, horas invertidas y bloques solapados',()=>{
  assert.throws(()=>P.date('2026-02-30'));assert.throws(()=>P.duration([{start:'24:00',end:'25:00'}]));
  assert.throws(()=>P.duration([{start:'09:00',end:'08:00'}]));assert.throws(()=>P.duration([{start:'09:00',end:'11:00'},{start:'10:00',end:'12:00'}]));
});
test('festivos 2026: 19 fechas, Semana Santa y nuevo festivo de Chiquinquirá',()=>{
  const d=P.holidays(2026).map(h=>h.date);assert.equal(d.length,19);
  assert.deepEqual(d,['2026-01-01','2026-01-12','2026-03-23','2026-04-02','2026-04-03','2026-05-01','2026-05-18','2026-06-08','2026-06-15','2026-06-29','2026-07-13','2026-07-20','2026-08-07','2026-08-17','2026-10-12','2026-11-02','2026-11-16','2026-12-08','2026-12-25']);
});
test('festivos 2027 calculados por año; colisión de celebraciones se deduplica',()=>{
  const d=P.holidays(2027);assert.equal(P.easter(2027),'2027-03-28');assert.ok(d.some(h=>h.date==='2027-03-25'));assert.ok(d.some(h=>h.date==='2027-07-12'));assert.equal(d.filter(h=>h.date==='2027-07-12').length,1);
});
test('receso completo pausa el turno pendiente de un ciclo quincenal',()=>{
  const c=config();c.rotation.turns=[{institutionId:'santa-barbara',weeks:2,fichas:['1']},{institutionId:'john-f-kennedy',weeks:2,fichas:['2']}];
  c.breaks=[{institutionId:'santa-barbara',start:'2026-02-09',end:'2026-02-13'}];const weeks=P.rotationWeeks(c);
  assert.equal(weeks['2026-02-09'].paused,true);assert.equal(weeks['2026-02-16'].turn,1);assert.equal(weeks['2026-02-23'].institutionId,'john-f-kennedy');
  assert.deepEqual(proposal(c,[],{count:2}).sessions.map(s=>s.date),['2026-02-02','2026-02-16']);
});
test('receso de institución no asignada no consume ni congela otro turno; pausa explícita sí',()=>{
  const c=config();c.breaks=[{institutionId:'john-f-kennedy',start:'2026-02-02',end:'2026-02-06'}];assert.equal(P.rotationWeeks(c)['2026-02-02'].paused,false);
  c.rotation.inactiveWeeks=['2026-02-09'];assert.equal(P.rotationWeeks(c)['2026-02-09'].paused,true);
});
test('receso parcial excluye fechas pero no pausa la semana',()=>{
  const c=config();c.breaks=[{institutionId:'santa-barbara',start:'2026-02-02',end:'2026-02-04'}];assert.equal(P.rotationWeeks(c)['2026-02-02'].paused,false);assert.equal(proposal(c).sessions[0].date,'2026-02-09');
});
test('festivo se excluye sin deuda ni recuperación automática; ciclo sigue avanzando',()=>{
  const p=proposal(config(),[],{start:'2026-03-23',count:1});assert.equal(p.sessions[0].date,'2026-03-30');assert.ok(!('debt' in p));
});
test('no programa antes de revisar recesos ni sin rotación',()=>{
  const c=config();c.breaksReviewed=[];assert.throws(()=>proposal(c),/recesos/);c.breaksReviewed=['santa-barbara','john-f-kennedy'];c.rotation=null;assert.throws(()=>proposal(c),/rotación/);
});
test('ficha del turno debe pertenecer a la institución y no duplica horario por día',()=>{
  const c=config();c.rotation.turns[0].fichas=['2'];assert.throws(()=>P.validateConfig(c),/incompatibles/);
  const d=config();d.schedules.push(clone(d.schedules[0]));assert.throws(()=>P.validateConfig(d),/Unifique/);
});
test('conflicto de instructor entre fichas y de ficha entre sesiones salta la fecha',()=>{
  const first=proposal(config(),[],{count:1}).sessions[0];assert.equal(proposal(config(),[first],{count:1}).sessions[0].date,'2026-02-09');
  const c=config();c.rotation.turns=[{institutionId:'john-f-kennedy',weeks:1,fichas:['2']}];assert.equal(proposal(c,[first],{ficha:'2',count:1}).sessions[0].date,'2026-02-09');
});
test('huecos entre bloques permiten otra ficha del instructor en esos intervalos',()=>{
  const first=proposal(config(),[],{count:1}).sessions[0],c=config();c.schedules[1].blocks=[{start:'08:00',end:'09:00'}];c.rotation.turns=[{institutionId:'john-f-kennedy',weeks:1,fichas:['2']}];
  assert.equal(proposal(c,[first],{ficha:'2',count:1}).sessions[0].date,'2026-02-02');
});
test('rechaza competencias excluidas, datos inventados y discrepancias',()=>{
  const req={ficha:'1',start:'2026-02-02',count:1,curriculumId:'rap1'};
  for(const code of ['210201501','220601501']) assert.throws(()=>P.propose(config(),req,[{...catalog[0],competencyCode:code}],[],actor),/no impartida/);
  assert.throws(()=>P.propose(config(),req,[],[],actor),/sin fuente/);assert.throws(()=>P.propose(config(),req,[{...catalog[0],needsVerification:true}],[],actor),/discrepancias/);
});
test('Herramientas Informáticas no se asigna al instructor de Santa Bárbara grado 10',()=>{
  const c=config();c.fichas[0].grade='10B';assert.throws(()=>P.propose(c,{ficha:'1',curriculumId:'rap1',start:'2026-02-02',count:1},[{...catalog[0],competencyCode:'220501121'}],[],actor),/corresponde a la institución/);
});
test('respeta el orden de RAP y señala historial previo ausente',()=>{
  const first=proposal(config(),[],{count:1}).sessions[0];const p=proposal(config(),[first],{count:1,curriculumId:'rap2'});assert.equal(p.sessions[0].date,'2026-02-09');
  assert.equal(proposal(config(),[],{count:1,curriculumId:'rap2'}).warnings.length,1);
  const later=proposal(config(),[],{count:1,curriculumId:'rap2'}).sessions[0];assert.equal(proposal(config(),[later],{count:1}).complete,false);
});
test('propuesta insuficiente no se guarda ni extiende a otro año',()=>{
  const p=proposal(config(),[],{start:'2026-12-31',count:5});assert.equal(p.complete,false);assert.throws(()=>P.confirmProposal(p,[],actor,true),/incompleta/);
  assert.throws(()=>proposal(config(),[],{start:'2027-01-01'}),/fuera del año/);
});
test('vista previa no muta datos; confirmación explícita, idempotencia y permisos',()=>{
  const c=config(),original=JSON.stringify(c),p=proposal(c),before=[];assert.equal(JSON.stringify(c),original);assert.deepEqual(before,[]);
  assert.throws(()=>P.confirmProposal(p,before,actor,false),/confirmación/);const next=P.confirmProposal(p,before,actor,true);assert.equal(next.length,5);assert.equal(next[0].history.length,1);assert.deepEqual(before,[]);
  assert.throws(()=>P.confirmProposal(p,next,actor,true),/Conflicto/);
  for(const a of [{role:'aprendiz',id:'x',fichas:['1']},{role:'instructor',id:'x',fichas:['2']}])assert.throws(()=>P.propose(c,{ficha:'1'},catalog,[],a),/instructor responsable/);
});
test('realizada queda protegida y corrección explícita conserva historia',()=>{
  const s=P.confirmProposal(proposal(config(),[],{count:1}),[],actor,true)[0];
  const done=P.changeSession(s,{status:'Realizada',actualMinutes:110},actor,'Clase completada');
  assert.throws(()=>P.changeSession(done,{status:'Parcial',actualMinutes:80},actor,'Corrección'),/explícita/);
  const corrected=P.changeSession(done,{status:'Parcial',actualMinutes:80},actor,'Corrección expresa',true);assert.equal(corrected.history.length,3);assert.equal(done.actualMinutes,110);
});
test('suspendida se reprograma con mismo ID, fecha original y motivo; no borra el registro',()=>{
  const s=proposal(config(),[],{count:1}).sessions[0],cancel=P.changeSession(s,{status:'Suspendida'},actor,'Evento institucional');
  const next=P.reprogram(config(),cancel,'2026-02-09',catalog,[cancel],actor,'Acuerdo institucional');
  assert.equal(next.originalDate,'2026-02-02');assert.equal(next.date,'2026-02-09');assert.equal(next.id,s.id);assert.equal(next.history.length,2);
  assert.throws(()=>P.changeSession(s,{ficha:'2'},actor,'Intento'),/identidad/);
});
test('nuevo uso de fecha original tras reprogramación tiene ID nuevo',()=>{
  const s=proposal(config(),[],{count:1}).sessions[0],moved=P.reprogram(config(),s,'2026-02-09',catalog,[s],actor,'Cambio');
  const p=proposal(config(),[moved],{count:1});assert.equal(p.sessions[0].date,s.originalDate);assert.notEqual(p.sessions[0].id,s.id);assert.equal(P.confirmProposal(p,[moved],actor,true).length,2);
});
test('recálculo conserva realizadas, parciales, suspendidas e historial; solo cambia pendientes',()=>{
  let ss=P.confirmProposal(proposal(),[],actor,true);ss[0]=P.changeSession(ss[0],{status:'Realizada',actualMinutes:110},actor,'Hecho');ss[1]=P.changeSession(ss[1],{status:'Parcial',actualMinutes:55},actor,'Parcial');ss[2]=P.changeSession(ss[2],{status:'Suspendida'},actor,'Suspensión');
  const c=config();c.breaks=[{institutionId:'santa-barbara',start:'2026-02-23',end:'2026-03-06'}];const r=P.recalculate(c,ss,catalog,actor,'2026-02-23');assert.equal(r.complete,true);assert.equal(r.changes.length,2);
  for(const s of ss.slice(0,3))assert.deepEqual(r.sessions.find(x=>x.id===s.id),s);assert.equal(r.changes[0].after.originalDate,'2026-02-23');
});
test('consulta aprendiz solo su ficha; fechas manuales no se derivan ni modifican',()=>{
  const ss=proposal().sessions;ss[0].curriculum.guides=[{file:'guia.html',title:'Guía fixture',activities:[{id:'a',label:'Actividad'}]}];
  const deadlines={'guia.html':{a:{dueAt:'2026-02-20T23:59:00-05:00'}}},before=JSON.stringify(deadlines);
  const view=P.studentView(ss.concat({...ss[0],ficha:'2'}),{role:'aprendiz',ficha:'1'},deadlines);assert.equal(view.length,5);assert.equal(view[0].guides[0].activities[0].dueAt,deadlines['guia.html'].a.dueAt);assert.equal(JSON.stringify(deadlines),before);
  assert.equal(P.studentView(ss,{role:'aprendiz',ficha:'1'},{} )[0].guides[0].activities[0].dueAt,'');assert.ok(!('instructorId' in view[0]));
});
test('guardado local rechaza versión obsoleta, borrado de sesiones y errores de cuota',()=>{
  const st=storage(),first=Store.empty();first.years[2026]=config();first.sessions=P.confirmProposal(proposal(),[],actor,true);
  const saved=Store.save(st,first,0,actor,'Configuración de prueba',true);assert.equal(saved.revision,1);
  assert.throws(()=>Store.save(st,first,0,actor,'Obsoleto',true),/otra pestaña/);
  assert.throws(()=>Store.save(st,{...saved,sessions:[]},1,actor,'Borrado',true),/eliminar/);
  assert.throws(()=>Store.save(st,saved,1,{role:'aprendiz'},'No autorizado',true),/confirmación/);
  assert.throws(()=>Store.save({getItem:()=>null,setItem:()=>{throw new Error('quota');}},first,0,actor,'Prueba',true),/quota/);
});
test('catálogo generado coincide con fuentes existentes, no contiene datos de aprendices',()=>{
  const {build}=require('../tools/build_academic_planner_catalog.cjs');assert.deepEqual(JSON.parse(JSON.stringify(build())),Catalog);assert.equal(Catalog.fichas.length,6);
  // 2026-10-28 (candidata unica): la normalizacion de guias corrigio el nombre de la competencia 220501121 en las Guias 2/5
  // ("Procesar..." -> "Operar..."), que era la unica discrepancia; ya no quedan items marcados. Se fija la regla, no el dato:
  // todo codigo con mas de un nombre de competencia debe quedar marcado para verificacion.
  {const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.,]/g,'').replace(/\s+/g,' ').trim(),byCode=new Map();
  Catalog.items.forEach(i=>{assert.equal(typeof i.needsVerification,'boolean');if(!byCode.has(i.competencyCode))byCode.set(i.competencyCode,new Set());byCode.get(i.competencyCode).add(norm(i.competency));});
  Catalog.items.forEach(i=>{if(byCode.get(i.competencyCode).size>1)assert.equal(i.needsVerification,true,i.id);});}assert.ok(Catalog.items.filter(i=>!i.needsVerification).every(i=>i.source==='js/guide_declarations.js'));
});
test('página local no carga Firebase, autenticación de producción ni conexiones externas',()=>{
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../calendario-planificador-local.html'),'utf8');
  assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/<script[^>]+(?:https:|firebase|portal_auth|drive_db)/);assert.doesNotMatch(html,/onclick=/);
});
test('vacaciones pueden cruzar límites de año sin permitir clases fuera del año',()=>{
  const c=config();c.breaks=[{institutionId:'santa-barbara',start:'2025-12-29',end:'2026-01-09'}];assert.doesNotThrow(()=>P.validateConfig(c));
  c.breaks[0].end='2025-12-31';assert.throws(()=>P.validateConfig(c),/intersectar/);
});
test('horarios de sábado se respetan al decidir si un receso pausa la semana completa',()=>{
  const c=config();c.schedules.push({ficha:'1',weekday:6,blocks:[{start:'08:00',end:'09:00'}]});c.breaks=[{institutionId:'santa-barbara',start:'2026-02-02',end:'2026-02-06'}];
  assert.equal(P.fullBreak(c,'santa-barbara','2026-02-02'),false);assert.equal(proposal(c,[],{count:1}).sessions[0].date,'2026-02-07');
  c.breaks[0].end='2026-02-08';assert.equal(P.fullBreak(c,'santa-barbara','2026-02-02'),true);
});
test('persistencia rechaza pérdida del año histórico y alteración de fecha original',()=>{
  const st=storage(),draft=Store.empty();draft.years[2026]=config();draft.sessions=P.confirmProposal(proposal(),[],actor,true);
  const saved=Store.save(st,draft,0,actor,'Inicial',true),altered=clone(saved);altered.sessions[0].originalDate='2026-01-01';
  assert.throws(()=>Store.save(st,altered,1,actor,'Cambio',true),/inmutables/);assert.throws(()=>Store.save(st,{...saved,years:{}},1,actor,'Borrar',true),/históricos/);
});
