'use strict';
// Edición directa del calendario oficial (2026-10-29): lógica pura del editor, traslado atómico entre fichas,
// observación acumulada, novedades institucionales y página del instructor. Datos ficticios; sin red.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../js/academic_calendar_editor.js'),C=require('../js/academic_calendar_cloud.js'),P=require('../js/academic_planner.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const empty={id:'',competencyCode:'',competency:'',rap:'',order:'',source:''};
const s=(o={})=>({id:'s1',ficha:'3441939',year:2026,date:'2026-11-04',originalDate:'2026-11-04',blocks:[{start:'14:10',end:'18:10'}],plannedMinutes:240,actualMinutes:null,status:'Activa',activity:'',evidence:'',dueDate:'',curriculum:empty,sourceStatuses:[],origin:'legacy',protected:false,revision:0,mutationId:'m0',updatedBy:'admin',...o});
const holidays=P.holidays(2026);
const form=(d,o={})=>({ficha:d.ficha,date:d.date,blocks:d.blocks,status:d.status,actualMinutes:'',activity:d.activity,evidence:d.evidence,dueDate:d.dueDate,reason:'Ajuste acordado',...o});

test('noviembre 2026: los festivos del 2 y 16 se conservan y bloquean clases',()=>{
 assert.deepEqual(holidays.filter(h=>h.date.startsWith('2026-11')).map(h=>h.date),['2026-11-02','2026-11-16']);
 const p=E.planSingle(s(),form(s(),{date:'2026-11-16'}),[s()],{holidays});
 assert.match(p.errors.join(),/festivo/);
 // Una clase suspendida en un festivo no es error (no se imparte).
 assert.equal(E.placement({...s(),date:'2026-11-02',status:'Suspendida'},[],{holidays}).errors.length,0);
});
test('editar fecha, horario y varias franjas conserva la identidad y no duplica la ficha en un día',()=>{
 const a=s(),b=s({id:'s2',date:'2026-11-06'});
 const p=E.planSingle(a,form(a,{date:'2026-11-05',blocks:[{start:'14:10',end:'16:10'},{start:'07:00',end:'08:00'}],status:'Reprogramada'}),[a,b],{holidays});
 assert.equal(p.mode,'update');assert.equal(p.next.id,'s1');assert.equal(p.next.originalDate,'2026-11-04');
 assert.deepEqual(p.next.blocks,[{start:'07:00',end:'08:00'},{start:'14:10',end:'16:10'}],'franjas ordenadas');assert.equal(p.next.plannedMinutes,180);
 assert.equal(C.validate({...p.next,revision:1,mutationId:'x'}).status,'Reprogramada');assert.deepEqual(p.errors,[]);
 const dup=E.planSingle(a,form(a,{date:'2026-11-06'}),[a,b],{holidays});
 assert.match(dup.errors.join(),/ya tiene una clase el 2026-11-06/);
 assert.throws(()=>E.planSingle(a,form(a,{blocks:[{start:'14:10',end:'16:10'},{start:'15:00',end:'17:00'}]}),[a]),/se cruzan/);
 assert.throws(()=>E.planSingle(a,form(a,{reason:'  '}),[a]),/motivo/);
 assert.throws(()=>E.planSingle(a,form(a,{date:'2027-01-05'}),[a]),/año 2026/);
});
test('cruce de horario con otra ficha se advierte; el mismo día en otra ficha está permitido',()=>{
 const a=s(),other=s({id:'o1',ficha:'3441944',date:'2026-11-05',blocks:[{start:'14:15',end:'16:15'}]});
 const p=E.planSingle(a,form(a,{date:'2026-11-05'}),[a,other],{holidays});
 assert.deepEqual(p.errors,[]);assert.match(p.warnings.join(),/Cruce de horario con Santa Bárbara 10A/);
});
test('estado: Parcial exige minutos; Realizada avisa que queda fija; impartida conserva su estado',()=>{
 const a=s();
 assert.throws(()=>E.planSingle(a,form(a,{status:'Parcial'}),[a]),/minutos impartidos/);
 assert.equal(E.planSingle(a,form(a,{status:'Parcial',actualMinutes:'120'}),[a]).next.actualMinutes,120);
 assert.match(E.planSingle(a,form(a,{status:'Realizada'}),[a]).warnings.join(),/queda fijo/);
 const done=s({status:'Impartida',protected:true});
 const p=E.planSingle(done,form(done,{status:'Programada',date:'2026-11-05'}),[done],{holidays});
 assert.equal(p.next.status,'Impartida');assert.match(p.warnings.join(),/se conserva/);
 const real=s({status:'Realizada',origin:'new',actualMinutes:240});
 assert.equal(E.planSingle(real,form(real,{blocks:[{start:'14:10',end:'17:10'}]}),[real]).next.actualMinutes,180,'corregir franjas de una realizada ajusta su duración');
 assert.throws(()=>E.planSingle(a,form(a,{status:'Inventado'}),[a]),/no permitido/);
});
test('cambio de ficha = traslado: la original queda Suspendida y nace una clase nueva sin duplicar',()=>{
 const a=s(),busy=s({id:'k',ficha:'3441942',date:'2026-11-05'});
 const p=E.planSingle(a,form(a,{ficha:'3441942',date:'2026-11-04'}),[a,busy],{holidays,uid:'admin',newId:'class_x'});
 assert.equal(p.mode,'transfer');assert.equal(p.next.status,'Suspendida');assert.equal(p.next.id,'s1');assert.equal(p.next.ficha,'3441939');
 assert.equal(p.target.ficha,'3441942');assert.equal(p.target.status,'Programada');assert.equal(p.target.origin,'new');assert.deepEqual(p.target.curriculum,empty);
 assert.match(E.planSingle(a,form(a,{ficha:'3441942',date:'2026-11-05'}),[a,busy],{holidays,newId:'class_y'}).errors.join(),/ya tiene una clase/);
 assert.throws(()=>E.planSingle(s({status:'Impartida',protected:true}),form(a,{ficha:'3441942'}),[a]),/no se traslada/);
 assert.equal(E.institutionOf('3168850'),'santa-barbara');assert.equal(E.fichaLabel('3441939'),'John F. Kennedy 10A · 3441939');
});
test('clase nueva nace Programada y respeta un día por ficha',()=>{
 const a=s();const p=E.planSingle(null,{ficha:'3441939',date:'2026-11-09',blocks:[{start:'07:00',end:'09:00'}],status:'Programada',reason:'Recuperación'},[a],{holidays,uid:'admin',newId:'class_n'});
 assert.equal(p.mode,'create');assert.equal(p.next.status,'Programada');assert.equal(p.next.revision,0);assert.equal(p.next.originalDate,'2026-11-09');
 assert.match(E.planSingle(null,{ficha:'3441939',date:'2026-11-04',blocks:[{start:'07:00',end:'09:00'}],reason:'x'},[a],{newId:'c'}).errors.join(),/ya tiene una clase/);
});
test('varias clases: mover la semana completa ordena los guardados y detecta intercambios',()=>{
 const w=['2026-11-03','2026-11-10','2026-11-17'].map((d,i)=>s({id:'w'+i,ficha:'3441942',date:d,originalDate:d}));
 const p=E.planBulk(w,['w0','w1'],{shiftDays:7,reason:'Se corre una semana'},{holidays});
 assert.match(p.errors.join(),/2026-11-17/,'w1 caería sobre w2, que no se mueve');
 const q=E.planBulk(w,['w0','w1','w2'],{shiftDays:7,reason:'Se corre una semana'},{holidays});
 assert.deepEqual(q.errors,[]);assert.deepEqual(q.items.map(i=>i.before.id),['w2','w1','w0'],'primero la que libera el día siguiente');
 const swap=E.planBulk([s({id:'x',date:'2026-11-04'}),s({id:'y',date:'2026-11-11'})],['x','y'],{shiftDays:7,reason:'r'},{holidays});
 assert.deepEqual(swap.errors,[],'y pasa al 18 y x al 11 en orden');
 const sus=E.planBulk(w,['w0','w1'],{status:'Suspendida',noteAppend:'Paro',reason:'Paro'},{holidays});
 assert.deepEqual(sus.items.map(i=>i.next.status),['Suspendida','Suspendida']);assert.equal(sus.noteAppend,'Paro');
 const taught=E.planBulk([s({id:'t',status:'Impartida',protected:true})],['t'],{status:'Suspendida',reason:'r'},{holidays});
 assert.equal(taught.items.length,0);assert.match(taught.warnings.join(),/se conserva/);
 assert.throws(()=>E.planBulk(w,['w0'],{reason:'r'}),/al menos un cambio/);
 assert.throws(()=>E.planBulk(w,[],{status:'Suspendida',reason:'r'}),/al menos una clase/);
 const blk=E.planBulk(w,['w0'],{blocks:[{start:'07:00',end:'09:55'}],reason:'r'},{holidays});assert.equal(blk.items[0].next.plannedMinutes,175);
 for(const it of [...q.items,...sus.items,...blk.items])C.validate({...it.next,revision:it.next.revision+1,mutationId:'v'});
});
test('novedades del calendario anterior: copia fiel de los registros no lectivos (incluye Sede SENA 9-nov)',()=>{
 global.window={};new Function('window',read('data/calendario_2026_records.js'))(global.window);
 const legacy=global.window.CALENDAR_2026_RECORDS.filter(r=>!r.finde&&r.tipo!=='CLASE');delete global.window;
 const mine=E.legacyEvents(2026);assert.equal(mine.length,legacy.length);
 legacy.forEach((r,i)=>{assert.equal(mine[i].legacyId,r.id);assert.equal(mine[i].date,r.fecha);assert.equal(mine[i].kind,r.tipo);assert.equal(mine[i].place,r.colegio);assert.equal(mine[i].note,r.defO);});
 assert.ok(mine.some(e=>e.date==='2026-11-09'&&e.title==='Sede SENA'));assert.deepEqual(E.legacyEvents(2027),[]);
});
test('novedad: editar, cancelar y conservar historial sin borrar',()=>{
 const doc=E.eventDoc(2026,E.legacyEvents(2026)),sena=doc.events.find(e=>e.date==='2026-11-09');
 const moved=E.applyEvent(doc,{...sena,date:'2026-11-10',start:'07:00',end:'12:00'},{actor:'admin',reason:'Cambio de fecha SENA',at:'T1'});
 assert.equal(moved.events.find(e=>e.id===sena.id).date,'2026-11-10');assert.equal(moved.history.length,1);assert.equal(moved.history[0].before.date,'2026-11-09');
 const cancelled=E.applyEvent(moved,{...moved.events.find(e=>e.id===sena.id),status:'Cancelada'},{actor:'admin',reason:'No se realiza',at:'T2'});
 assert.equal(cancelled.events.length,doc.events.length,'cancelar no borra');assert.equal(cancelled.history.length,2);
 assert.throws(()=>E.applyEvent(doc,{...sena},{actor:'a',reason:'x'}),/No hay cambios/);
 assert.throws(()=>E.applyEvent(doc,{...sena,date:'2027-01-01'},{actor:'a',reason:'x'}),/año 2026/);
 assert.throws(()=>E.applyEvent(doc,{...sena,title:'Otra'},{actor:'a',reason:' '}),/motivo/);
 assert.deepEqual(C.decode({mapValue:{fields:C.fields(cancelled)}}),cancelled,'se codifica en Firestore sin pérdida');
});

// Firestore simulado: documentos por ruta, precondiciones exists/updateTime y commit atómico (todo o nada).
function fakeFirestore(seed={},{role='admin',failCommit=null}={}){
 const db=new Map(),log=[];let clock=0;const put=(p,data)=>db.set(p,{fields:C.fields(data),updateTime:'T'+(++clock)});
 put('sena_portal_roles/admin',{role});for(const [p,d] of Object.entries(seed))put(p,d);
 const rel=name=>name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//,'');
 const reply=(status,body)=>({status,ok:status<300,text:async()=>JSON.stringify(body)});
 const fetch=async(url,opt={})=>{const u=new URL(url),p=decodeURIComponent(u.pathname.replace(/^\/v1\/projects\/[^/]+\/databases\/\(default\)\/documents\/?/,''));log.push((opt.method||'GET')+' '+p);
  if(p.endsWith(':commit')){const {writes}=JSON.parse(opt.body);if(failCommit)return reply(failCommit,{error:{status:failCommit===403?'PERMISSION_DENIED':'UNAVAILABLE'}});
   for(const w of writes){const name=rel(w.update?.name||w.delete),cur=db.get(name),pre=w.currentDocument;
    if(pre&&'exists' in pre&&!!cur!==pre.exists)return reply(409,{error:{status:'ALREADY_EXISTS'}});if(pre?.updateTime&&cur?.updateTime!==pre.updateTime)return reply(400,{error:{status:'FAILED_PRECONDITION'}});}
   for(const w of writes){if(w.delete){db.delete(rel(w.delete));continue;}const f={...w.update.fields};if(w.updateTransforms)f.at={stringValue:'2026-10-29T15:00:00Z'};db.set(rel(w.update.name),{fields:f,updateTime:'T'+(++clock)});}
   return reply(200,{});}
  const d=db.get(p);if(d)return reply(200,{name:p,...d});
  const kids=[...db.entries()].filter(([k])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/'));
  if(kids.length)return reply(200,{documents:kids.map(([k,v])=>({name:k,...v}))});return reply(404,{error:{status:'NOT_FOUND'}});};
 const api=C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',fetch,auth:{getUid:async()=>'admin',getIdToken:async()=>'t',getUsernameKey:async()=>'dubier',isAdminHint:async()=>true}});
 const get=p=>db.has(p)?C.document({name:p,...db.get(p)}):null;
 return {api,db,log,get};
}
const base='sena_portal_calendar_fichas/3441939/years/2026',other='sena_portal_calendar_fichas/3441942/years/2026';
const seeded=()=>({[base+'/sessions/s1']:s(),[base+'/days/2026-11-04']:{sessionId:'s1'},[base+'/notes/s1']:{sessionId:'s1',revision:0,observation:'Nota privada'}});
test('traslado atómico: original Suspendida + clase nueva + recibos y notas en un solo commit',async()=>{
 globalThis.crypto??=require('node:crypto').webcrypto;
 const f=fakeFirestore(seeded()),before=f.get(base+'/sessions/s1');
 const target={...s(),id:'class_new',ficha:'3441942',origin:'new',status:'Programada',revision:0,mutationId:'draft',activity:'Práctica'};
 const r=await f.api.transfer(before,target,'Se cambia de grupo',{observationBefore:'Nota privada\nTrasladada',observationTarget:'Desde 10A'});
 assert.equal(f.log.filter(l=>l.includes(':commit')).length,1,'un solo commit');
 assert.equal(r.original.data.status,'Suspendida');assert.equal(r.original.data.revision,1);assert.equal(r.target.data.revision,1);assert.equal(r.target.data.ficha,'3441942');
 assert.equal(f.get(other+'/days/2026-11-04').data.sessionId,'class_new');assert.equal(f.get(base+'/days/2026-11-04').data.sessionId,'s1','la original conserva su día');
 assert.equal(f.get(base+'/sessions/s1/audit/1').data.reason,'Se cambia de grupo');assert.equal(f.get(base+'/sessions/s1/audit/1').data.before.status,'Activa');
 assert.equal(f.get(other+'/sessions/class_new/audit/1').data.before,null);assert.equal(f.get(other+'/notes/class_new').data.observation,'Desde 10A');
 assert.equal(f.get(base+'/notes/s1').data.observation,'Nota privada\nTrasladada');
});
test('traslado: conflicto de versión o día ocupado no deja nada a medias',async()=>{
 const f=fakeFirestore({...seeded(),[other+'/days/2026-11-04']:{sessionId:'ya'}}),before=f.get(base+'/sessions/s1');
 const target={...s(),id:'class_new',ficha:'3441942',origin:'new',status:'Programada'};
 await assert.rejects(f.api.transfer(before,target,'r'),e=>e.code==='CONFLICT');
 assert.equal(f.get(base+'/sessions/s1').data.status,'Activa');assert.equal(f.get(other+'/sessions/class_new'),null);
 const g=fakeFirestore(seeded()),stale={...g.get(base+'/sessions/s1'),updateTime:'viejo'};
 await assert.rejects(g.api.transfer(stale,target,'r'),e=>e.code==='CONFLICT');
 const h=fakeFirestore({...seeded(),[base+'/sessions/s1']:s({status:'Impartida',protected:true})});
 await assert.rejects(h.api.transfer(h.get(base+'/sessions/s1'),target,'r'),/no se traslada/);
 const l=fakeFirestore(seeded(),{role:'aprendiz'});await assert.rejects(l.api.transfer(l.get(base+'/sessions/s1'),target,'r'));
});
test('edición con observación acumulada y lectura posterior verificada',async()=>{
 const f=fakeFirestore(seeded()),before=f.get(base+'/sessions/s1');
 const r=await f.api.save({...before.data,status:'Suspendida'},before,'Paro',{appendObservation:'Paro docente'});
 assert.equal(r.observation,'Nota privada\nParo docente');assert.equal(f.get(base+'/sessions/s1/audit/1').data.notesBefore,'Nota privada');
 assert.equal(r.data.status,'Suspendida');assert.equal(r.data.id,'s1');
 assert.equal(await f.api.note('3441939',2026,'s1'),'Nota privada\nParo docente');
});
test('novedades institucionales: solo administrador, precondición de versión y lectura verificada',async()=>{
 const f=fakeFirestore();assert.equal(await f.api.events(2026),null);
 const doc=E.eventDoc(2026,E.legacyEvents(2026)),first=await f.api.saveEvents(2026,doc,null);
 assert.equal(first.data.events.length,doc.events.length);assert.ok(f.db.has('sena_portal_calendar/institutional_events_2026'));
 await assert.rejects(f.api.saveEvents(2026,doc,null),e=>e.code==='CONFLICT','no se crea dos veces');
 const next=E.applyEvent(first.data,{...first.data.events.at(-1),status:'Cancelada'},{actor:'admin',reason:'r'});
 assert.equal((await f.api.saveEvents(2026,next,first)).data.history.length,1);
 await assert.rejects(f.api.saveEvents(2026,next,first),e=>e.code==='CONFLICT','versión vieja');
 const l=fakeFirestore({},{role:'aprendiz'});await assert.rejects(l.api.events(2026));
});
test('página del instructor: generada desde el planificador, editor antes de la interfaz y modo oficial sin borradores',()=>{
 const R=require('../tools/academic_calendar_release.cjs'),out=R.pages(read('calendario-planificador-local.html'),read('pages/auxiliares/calendario-aprendiz.html'));
 assert.equal(read('calendario-academico-sesiones.html'),out['calendario-academico-sesiones.html'],'la página publicada es exactamente la generada');
 assert.equal(read('pages/auxiliares/calendario-aprendiz.html'),out['pages/auxiliares/calendario-aprendiz.html'],'la vista del aprendiz no cambia');
 const html=read('calendario-academico-sesiones.html'),at=f=>html.indexOf(f);
 assert.ok(at('academic_calendar_cloud.js')<at('academic_calendar_editor.js')&&at('academic_calendar_editor.js')<at('academic_calendar_cloud_ui.js')&&at('academic_calendar_cloud_ui.js')<at('academic_planner_page.js'));
 const css=read('css/page_academic_planner.css');for(const id of ['#quick-class','#open-wizard','#open-editor','#plan-selected-day','#quick-admin'])assert.ok(css.includes('.cloud-mode '+id),id);
 const ui=read('js/academic_calendar_cloud_ui.js');assert.match(ui,/setTimeout\(\(\)=>reload\(\),0\)/,'se conecta sola');assert.match(ui,/listCached/,'lecturas incrementales');assert.doesNotMatch(ui,/api\.notes\(/,'no lista todas las notas al abrir');
});
test('el aprendiz nunca recibe observaciones internas ni novedades',()=>{
 const learner=C.agenda([{...s(),activity:'Práctica',observation:'SECRETO'}]);assert.ok(!JSON.stringify(learner).includes('SECRETO'));
 assert.ok(!C.KEYS.includes('observation'));const learnerPage=read('pages/auxiliares/calendario-aprendiz.html');assert.doesNotMatch(learnerPage,/academic_calendar_editor|cloud_ui/);
});
