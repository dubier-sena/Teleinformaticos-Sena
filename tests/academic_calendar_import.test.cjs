'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Import=require('../tools/academic_calendar_import.cjs'),Release=require('../tools/academic_calendar_release.cjs');
const catalog={items:[]};
// Fictitious source: two fichas, a two-slot class with mixed per-slot states, a cancelled class and an unmapped SENA day.
function prepared(){
 const records=[
  {id:'a',fecha:'2030-02-04',tipo:'CLASE',colegio:'Ficticia',grado:'A',horario:'07:00–07:55 / 09:55–10:50',defE:'Activa'},
  {id:'b',fecha:'2030-02-05',tipo:'CLASE',colegio:'Ficticia',grado:'B',horario:'08:00–09:00',defE:'Activa'},
  {id:'c',fecha:'2030-02-06',tipo:'CLASE',colegio:'Ficticia',grado:'B',horario:'08:00–09:00',defE:'Activa'},
  {id:'s',fecha:'2030-02-07',tipo:'SENA',colegio:'SENA',grado:'—',horario:'—',defE:'Activa'}];
 const snapshot={state:{'a|franja1':{estado:'Impartida',obs:'Original 1',act:{nombre:'Actividad original'}},'a|franja2':{estado:'Activa',obs:'Original 2'},b:{estado:'Impartida',obs:'Clase dada'},c:{estado:'Cancelada',obs:'Paro'},s:{estado:'Impartida',obs:'Jornada SENA'}}};
 return Release.prepare({records,snapshot,mapping:{'Ficticia|A':'3168850','Ficticia|B':'3168852'},year:2030,readTime:'2030-02-08T00:00:00Z',adminUid:'demo-admin'},catalog);
}
function store(){
 const docs=new Map(),log=[];
 return {docs,log,
  async commit(writes){log.push(writes.map(w=>w.path));if(writes.some(w=>docs.has(w.path))){const e=Error('ALREADY_EXISTS');e.code='CONFLICT';throw e;}for(const w of writes)docs.set(w.path,JSON.parse(JSON.stringify(w.data)));},
  async read(p){return docs.has(p)?JSON.parse(JSON.stringify(docs.get(p))):null;}};
}
test('import plan keeps every historical session atomic with its audit receipt, occupied day and internal note',()=>{
 const p=prepared(),steps=Import.plan(p),groups=steps.filter(g=>g.length===4);
 assert.equal(groups.length,p.integrity.sessions);
 for(const [s,audit,day,note] of groups){assert.match(s.path,/\/sessions\/legacy_/);assert.equal(audit.path,s.path+'/audit/0');assert.ok(Import.equal(audit.data.after,s.data));assert.equal(day.data.sessionId,s.data.id);assert.deepEqual(note.data,{sessionId:s.data.id,revision:0,observation:''});assert.ok(!('observation' in s.data));}
 assert.equal(steps.flat().length,p.documents.length);
});
test('import plan rejects packages that would lose the receipt, duplicate a date or overwrite',()=>{
 const drop=(p,re)=>({...p,documents:p.documents.filter(d=>!re.test(d.path))});
 assert.throws(()=>Import.plan(drop(prepared(),/\/audit\/0$/)),/recibo/);
 assert.throws(()=>Import.plan(drop(prepared(),/\/days\//)),/día ocupado|recibo/);
 assert.throws(()=>Import.plan(drop(prepared(),/\/notes\//)),/nota interna/);
 const forged=prepared(),audit=forged.documents.find(d=>d.path.endsWith('/audit/0'));audit.data.after={...audit.data.after,status:'Activa'};
 assert.throws(()=>Import.plan(forged),/no coincide/);
 const dup=prepared();dup.documents.push({...dup.documents[0]});assert.throws(()=>Import.plan(dup),/duplicado/);
 const overwrite=prepared();overwrite.documents[0].precondition={};assert.throws(()=>Import.plan(overwrite),/inexistentes/);
 assert.throws(()=>Import.plan({...prepared(),preparedOnly:false}),/no preparado/);
});
test('historical import writes, verifies by readback and records its audit receipt',async()=>{
 const p=prepared(),s=store(),before=JSON.stringify(p);
 const r=await Import.run(p,s,{receiptPath:'sena_portal_calendar/import_receipt_test'});
 assert.equal(r.status,'COMPLETADA');assert.equal(r.written,p.documents.length);assert.equal(r.verified,p.documents.length);assert.equal(r.alreadyPresent,0);
 assert.deepEqual(r.integrity,p.integrity);assert.equal(r.sourceHash,p.source.sha256);
 assert.deepEqual(s.docs.get('sena_portal_calendar/import_receipt_test'),JSON.parse(JSON.stringify(r)));
 assert.equal(JSON.stringify(p),before,'the prepared package is not mutated');
 for(const d of p.documents)assert.deepEqual(s.docs.get(d.path),d.data);
});
test('re-running the import is idempotent: no duplicates and nothing rewritten',async()=>{
 const p=prepared(),s=store();await Import.run(p,s);const snapshot=JSON.stringify([...s.docs]),writes=s.log.length;
 const again=await Import.run(p,s);
 assert.equal(again.status,'COMPLETADA');assert.equal(again.written,0);assert.equal(again.alreadyPresent,p.documents.length);
 assert.equal(JSON.stringify([...s.docs]),snapshot);assert.equal(s.log.length-writes,Import.plan(p).length,'one rejected attempt per step, no retries');
});
test('import stops on current data that differs and never overwrites it',async()=>{
 const p=prepared(),s=store();await Import.run(p,s);
 const session=p.documents.find(d=>/\/sessions\/[^/]+$/.test(d.path)),edited={...s.docs.get(session.path),observation:'Cambio vigente del instructor',revision:1};
 s.docs.set(session.path,edited);
 const r=await Import.run(p,s,{receiptPath:'sena_portal_calendar/import_receipt_conflict'});
 assert.equal(r.status,'DETENIDA_CONFLICTO');assert.deepEqual(r.conflicts,[session.path]);
 assert.deepEqual(s.docs.get(session.path),edited,'current data preserved');
 assert.equal(s.docs.get('sena_portal_calendar/import_receipt_conflict').status,'DETENIDA_CONFLICTO');
});
test('a lost commit response is resolved by reading, never by blind retry',async()=>{
 const p=prepared(),s=store();let lost=0;
 const flaky={read:s.read,async commit(w){await s.commit(w);if(w.length===4&&!lost++){throw Error('Respuesta perdida simulada');}}};
 const r=await Import.run(p,flaky);assert.equal(r.status,'COMPLETADA');assert.equal(r.verified,p.documents.length);
 const unconfirmed=await Import.run(p,{read:async()=>null,commit:async()=>{throw Error('Red caída');}});
 assert.equal(unconfirmed.status,'DETENIDA_NO_CONFIRMADA');assert.equal(unconfirmed.written,0);
});
test('historical integrity: every source state is archived unchanged and every class is represented',()=>{
 const p=prepared(),archive=p.documents.find(d=>/^sena_portal_calendar\/archive_/.test(d.path)).data;
 assert.equal(p.integrity.records,5);assert.equal(p.integrity.taught,3);assert.equal(p.integrity.taughtInFichas,2);
 for(const c of p.comparison){assert.ok(c.sourceStateUnchanged&&c.archiveUnchanged,c.id);}
 assert.deepEqual(archive.state,prepared().documents.find(d=>/^sena_portal_calendar\/archive_/.test(d.path)).data.state);
 const sessions=p.documents.filter(d=>/\/sessions\/[^/]+$/.test(d.path)).map(d=>d.data),mixed=sessions.find(s=>s.date==='2030-02-04');
 assert.equal(mixed.status,'Estados mixtos — revisar');assert.equal(mixed.protected,true);assert.deepEqual(mixed.sourceStatuses.map(x=>x.state),['Impartida','Activa']);
 assert.ok(sessions.every(s=>s.actualMinutes===null&&s.curriculum.id===''),'no invented execution or curriculum');
 assert.equal(p.comparison.find(c=>c.id==='s').sessionId,null,'SENA day stays in the admin-only archive');
});
test('rules keep heavy timing validation in the mandatory audit receipt (1000-expression limit)',()=>{
 const rules=fs.readFileSync(path.join(__dirname,'../config/academic_calendar_sessions.rules'),'utf8');
 const sessionBlock=rules.slice(rules.indexOf('match /sena_portal_calendar_fichas/{ficha}/years/{year}/sessions/{id}'));
 const creates=sessionBlock.split('allow create:').slice(1,3).map(x=>x.split('allow ')[0]),update=sessionBlock.split('allow update:')[1].split('allow ')[0];
 assert.equal(creates.length,2);
 for(const rule of [...creates,update]){assert.match(rule,/calReceipt\(/);assert.match(rule,/calDay\(/);assert.doesNotMatch(rule,/calTiming\(/);}
 const audit=sessionBlock.slice(sessionBlock.indexOf('match /audit/{revision}'));
 assert.match(audit,/allow create: if calEditor\(ficha\) && calTiming\(request\.resource\.data\.after,year\)/);
 assert.ok(audit.includes('/sessions/$(id)).data == request.resource.data.after'),'audit after must equal the committed session');
 assert.match(audit,/allow update, delete: if false/);
 assert.match(rules,/function calReceipt[\s\S]*?!exists\(p\)[\s\S]*?a\.after == d/);
});
test('concurrent loser denied by rules is reported as a calendar change, a real revocation stays a permission error',async()=>{
 const C=require('../js/academic_calendar_cloud.js');
 const s={id:'ficticio',ficha:'3168850',year:2030,date:'2030-02-04',originalDate:'2030-02-04',blocks:[{start:'07:00',end:'07:55'}],plannedMinutes:55,actualMinutes:null,status:'Programada',activity:'',evidence:'',dueDate:'',curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses:[],origin:'new',protected:false,revision:1,mutationId:'m1',updatedBy:'demo-instructor'};
 const before={data:s,updateTime:'T1'},ok=body=>({status:200,ok:true,text:async()=>JSON.stringify(body)}),denied={status:403,ok:false,text:async()=>JSON.stringify({error:{status:'PERMISSION_DENIED'}})};
 // The session is read once before the commit (still T1) and once after the denied commit (sessionAfter).
 const api=sessionAfter=>{let committed=false;return C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',auth:{getUid:async()=>'demo-instructor',getIdToken:async()=>'demo'},
  fetch:async(url,opts)=>{if(url.includes('/sena_portal_roles/'))return ok({fields:C.fields({role:'admin'})});
   if(url.includes('/notes/'))return ok({fields:C.fields({sessionId:'ficticio',revision:1,observation:'Nota'}),updateTime:'N1'});
   if(opts.method==='POST'){committed=true;return denied;}return committed?sessionAfter():ok({fields:C.fields(s),updateTime:'T1'});}});};
 await assert.rejects(api(()=>ok({fields:C.fields({...s,revision:2}),updateTime:'T2'})).save({...s,activity:'Mía'},before,'Concurrente',{observation:'Mía'}),e=>e.code==='CONFLICT'&&/cambió/.test(e.message));
 await assert.rejects(api(()=>denied).save({...s,activity:'Mía'},before,'Revocado'),e=>e.code==='PERMISSION');
 await assert.rejects(api(()=>ok({fields:C.fields(s),updateTime:'T1'})).save({...s,activity:'Mía'},before,'Sin cambio'),e=>e.code==='PERMISSION');
 await assert.rejects(api(()=>denied).save({...s,activity:'Mía'},before,'   '),/motivo/,'a reason is mandatory');

});
test('mobile layout guards: year filter keeps its own row and long metric values wrap (390 px overflow fix)',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../css/page_academic_planner.css'),'utf8');
 assert.match(css,/\.metric strong\{[^}]*overflow-wrap:anywhere/,'"No documentadas" must not widen the page');
 const mobile=css.split('@media(max-width:640px)').slice(1).join('');
 assert.match(mobile,/\.year-field\{flex:1 1 100%\}/);assert.match(mobile,/\.year-field input\{width:100%\}/);assert.match(mobile,/\.year-field button\{flex:0 0 auto;min-width:96px/);
 const html=fs.readFileSync(path.join(__dirname,'../calendario-planificador-local.html'),'utf8');assert.match(html,/page_academic_planner\.css\?v=20261021_3/);
});
test('learner renderer labels a finished manual deadline without claiming it is missing',()=>{
 const sc=fs.readFileSync(path.join(__dirname,'../js/student_calendar.js'),'utf8'),ui=fs.readFileSync(path.join(__dirname,'../js/academic_agenda_calendar_ui.js'),'utf8');
 assert.match(sc,/"deadline-passed": \{ label: "Plazo finalizado", cls: "pending" \}/);assert.match(ui,/"deadline-passed": "pending"/);
});
