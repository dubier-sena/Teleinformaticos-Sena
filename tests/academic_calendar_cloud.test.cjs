'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../js/academic_calendar_cloud.js'),Package=require('../tools/academic_calendar_package.cjs');
const emptyCurriculum=()=>({id:'',competencyCode:'',competency:'',rap:'',order:'',source:''});
const sample=()=>({id:'ficticio',ficha:'3168850',year:2030,date:'2030-02-04',originalDate:'2030-02-04',blocks:[{start:'07:00',end:'07:55'}],plannedMinutes:55,actualMinutes:null,status:'Programada',activity:'',evidence:'',dueDate:'',curriculum:emptyCurriculum(),sourceStatuses:[],origin:'new',protected:false,revision:0,mutationId:'test',updatedBy:'test'});
test('cloud schema preserves unknown execution, rejects invalid dates, intervals and fabricated totals',()=>{
 assert.equal(C.validate(sample()).actualMinutes,null);
 for(const change of [{date:'2030-02-30'},{plannedMinutes:120},{blocks:[{start:'07:00',end:'07:55'},{start:'07:30',end:'08:00'}]},{actualMinutes:60},{actualMinutes:NaN},{year:2031},{status:'Inventada'},{dueDate:'2030-02-03'},{dueDate:'2031-01-10'},{dueDate:'2030-02-31'},{observation:'Interna'},{reason:'Administrativo'}])assert.throws(()=>C.validate({...sample(),...change}));
 assert.equal(C.validate({...sample(),evidence:'Informe',dueDate:'2030-02-04'}).dueDate,'2030-02-04');
 assert.equal(C.validate({...sample(),status:'Realizada'}).actualMinutes,null);
});
test('REST encoding roundtrips numbers, nulls, original text and arrays',()=>{const s=sample();assert.deepEqual(C.decode({mapValue:{fields:C.fields(s)}}),s);});
test('cloud adapter requires explicit activation and isolates demo endpoint',()=>{
 assert.throws(()=>C.create({projectId:'sena-portal'}));
 assert.throws(()=>C.create({projectId:'sena-portal',enabled:true,emulatorHost:'127.0.0.1:9180'}));
 assert.throws(()=>C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'example.com:9180'}));
});
// 2026-10-28: identidad por PERFIL existente (sin asignaciones). Sin perfil -> se niega sin Drive ni copia local.
test('missing profile fails closed without Drive or local fallback',async()=>{
 const calls=[];const api=C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',auth:{getUid:async()=> 'ficticio',getIdToken:async()=> 'demo',getUsernameKey:async()=>'ficticio',isAdminHint:async()=>false},fetch:async(url)=>{calls.push(url);return {status:404,ok:false,text:async()=>JSON.stringify({error:{status:'NOT_FOUND'}})};}});
 await assert.rejects(api.list('3168850',2030),e=>e.code==='PERMISSION');assert.equal(calls.length,1);assert.match(calls[0],/127\.0\.0\.1:9180.*sena_portal_users\/ficticio$/);
});
test('learner cannot mutate even when calling adapter directly',async()=>{
 const api=C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',auth:{getUid:async()=> 'ficticio',getIdToken:async()=> 'demo'},fetch:async()=>({status:200,ok:true,text:async()=>JSON.stringify({fields:C.fields({role:'aprendiz',active:true,fichas:['3168850']})})})});
 await assert.rejects(api.save(sample(),null,'Ataque'),e=>e.code==='PERMISSION');
 await assert.rejects(api.list('3168852',2030),e=>e.code==='PERMISSION');
});
test('historical package preserves mixed per-slot states and archives observations without exposing them',()=>{
 const input={records:[{id:'a',fecha:'2030-02-04',tipo:'CLASE',colegio:'Ficticia',grado:'A',horario:'07:00–07:55 / 09:55–10:50',defE:'Activa'}],snapshot:{state:{'a|franja1':{estado:'Impartida',obs:'Privada original',extra:'Conservar'},'a|franja2':{estado:'Activa',obs:'Original'}}},mapping:{'Ficticia|A':'3168850'},year:2030,readTime:'2030-02-04T00:00:00Z',adminUid:'test-admin'};
 const before=JSON.stringify(input),p=Package.prepare(input);assert.equal(JSON.stringify(input),before);assert.deepEqual(p.archive,input.snapshot);assert.equal(p.integrity.records,2);assert.equal(p.integrity.taught,1);assert.equal(p.sessions[0].protected,true);assert.ok(!('observation' in p.sessions[0])&&!('reason' in p.sessions[0]),'internal fields never in the learner-readable session');assert.equal(p.documents['3168850'].records[0].sourceState.extra,'Conservar');
 // Owner decision 2026-10-21: learners see classes, hours, activities and deliverables only; no internal or administrative data.
 const events=C.agenda(p.sessions);assert.deepEqual(events.map(e=>e.originalStatus),['Impartida','Activa']);assert.ok(events.every(e=>!/minutos|documentad/i.test(e.description)));assert.ok(!JSON.stringify(events).includes('Privada original'));
});
test('learner events show activity, evidence and deadline but never internal notes',()=>{
 const d={...sample(),status:'Realizada',revision:2,activity:'Práctica',evidence:'Informe de laboratorio',dueDate:'2030-02-11'};const events=C.agenda([{...d,observation:'Interna'}],'2030-02-05');assert.equal(events[0].status,'taught');assert.equal(events[0].ficha,d.ficha);assert.match(events[0].description,/Práctica/);assert.match(events[0].description,/Informe de laboratorio · fecha límite 2030-02-11/);assert.equal(events[0].readonly,true);assert.ok(!JSON.stringify(events).includes('Interna'));
 const legacy={...sample(),origin:'legacy',protected:false,status:'Activa',sourceStatuses:[{sourceId:'x|franja1',state:'Activa',blocks:[{start:'07:00',end:'07:55'}]}]};
 assert.equal(C.agenda([legacy])[0].status,'scheduled');assert.equal(C.agenda([{...legacy,status:'Realizada',revision:1}])[0].status,'taught','a registered historical class shows its new state');
 const due=events.find(e=>e.type==='ENTREGA');assert.equal(due.date,'2030-02-11');assert.equal(due.status,'pending');assert.equal(due.readonly,true);
 assert.equal(C.agenda([d],'2030-02-11').find(e=>e.type==='ENTREGA').status,'due-today');assert.equal(C.agenda([d],'2030-02-10').find(e=>e.type==='ENTREGA').status,'due-tomorrow');
 assert.equal(C.agenda([d],'2030-03-01').find(e=>e.type==='ENTREGA').status,'deadline-passed','manual deliveries are never reported as missing');
 assert.equal(C.agenda([{...d,dueDate:''}]).filter(e=>e.type==='ENTREGA').length,0,'no deadline is invented');assert.match(C.agenda([{...d,dueDate:''}])[0].description,/sin fecha límite registrada/);
});
test('eight-step wizard proposal reaches cloud without invented curriculum or execution',async()=>{
 const P=require('../js/academic_planner.js'),A=require('../js/academic_planner_annual.js'),Store=require('../js/academic_planner_store.js');
 const c=P.createYear(2030),actor={id:'test',role:'instructor',fichas:['3168850']};c.fichas=[{id:'3168850',institutionId:'santa-barbara',grade:'Prueba',program:'Ficticio'}];c.breaksReviewed=['santa-barbara'];c.schedules=[{ficha:'3168850',weekday:1,blocks:[{start:'07:00',end:'07:55'}]}];
 const saved=A.confirm(Store.empty(),c,{start:'2030-03-04',end:'2030-03-11',createClasses:true},actor,'Prueba ficticia',true),before=JSON.stringify(saved);
 const batch=await C.proposal(saved.sessions,2030,{uid:'test',fichas:actor.fichas});assert.equal(batch.length,2);assert.deepEqual(batch[0].curriculum,emptyCurriculum());assert.equal(batch[0].actualMinutes,null);assert.equal(JSON.stringify(saved),before);
 assert.deepEqual(await C.proposal(saved.sessions,2030,{uid:'test',fichas:actor.fichas},batch.map(data=>({data}))),[]);
 await assert.rejects(C.proposal(saved.sessions,2030,{uid:'test',fichas:[]}),/asignadas/);
 await assert.rejects(C.proposal(saved.sessions,2030,{uid:'test',fichas:actor.fichas},[{data:{...batch[0],date:'2030-03-05'}}]),/cambios/);
});
test('release pages connect existing routes and exclude global source loaders',()=>{
 const fs=require('fs'),R=require('../tools/academic_calendar_release.cjs'),out=R.pages(fs.readFileSync('calendario-planificador-local.html','utf8'),fs.readFileSync('pages/auxiliares/calendario-aprendiz.html','utf8'));
 // Prepublication audit 2026-10-21: new instructor route; the published administrative agenda is not replaced.
 assert.ok(!('calendario-administrativo-agenda.html' in out));
 for(const key of ['calendario-academico-sesiones.html','pages/auxiliares/calendario-aprendiz.html']){assert.match(out[key],/academic_calendar_release_config/);assert.doesNotMatch(out[key],/src="data\/calendario_2026/);assert.match(out[key],/firebase_auth_bridge/);}
 // Deliverable loaders stay (owner decision 2026-10-21); isolation relies on rules + Apps Script, and secure mode never reads the global calendar
 // (tests/academic_calendar_prepublication.test.cjs). The all-fichas sources themselves are never shipped to the learner.
 assert.doesNotMatch(out['pages/auxiliares/calendario-aprendiz.html'],/src="(data\/calendario_2026_(records|seed)|js\/calendario_admin_manual_events)/);
});

// 2026-10-28: identidad del calendario desde el PERFIL EXISTENTE (cuentas actuales, sin asignaciones nuevas).
test('principal: perfil validado y activo de una de las seis fichas -> aprendiz de esa ficha; cualquier otra cosa se niega',async()=>{
 const mk=(profile,roleDoc,hint=false)=>C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',
  auth:{getUid:async()=>'uidFicticio',getIdToken:async()=>'demo',getUsernameKey:async()=>'ap.ficticio',isAdminHint:async()=>hint},
  fetch:async url=>{const nf={status:404,ok:false,text:async()=>JSON.stringify({error:{status:'NOT_FOUND'}})};
   if(url.includes('/sena_portal_roles/'))return roleDoc?{status:200,ok:true,text:async()=>JSON.stringify({fields:C.fields(roleDoc)})}:nf;
   if(url.includes('/sena_portal_users/'))return profile?{status:200,ok:true,text:async()=>JSON.stringify({fields:C.fields(profile)})}:nf;return nf;}});
 const ok=await mk({ficha:'3441944',validacionNombre:'oficial',active:true}).principal();assert.deepEqual([ok.role,ok.fichas],['aprendiz',['3441944']]);
 assert.equal((await mk({ficha:'3441944',validacionNombre:'duplicado_diferenciado'}).principal()).fichas[0],'3441944');
 for(const bad of [{ficha:'3441944'},{ficha:'3441944',validacionNombre:'pendiente'},{ficha:'3441944',validacionNombre:'oficial',active:false},{ficha:'3441944',validacionNombre:'oficial',estado:'inactivo'},{ficha:'9999999',validacionNombre:'oficial'},null])
  await assert.rejects(mk(bad).principal(),e=>e.code==='PERMISSION',JSON.stringify(bad));
 const adm=await mk(null,{role:'admin'},true).principal();assert.equal(adm.role,'admin');assert.equal(adm.fichas.length,6);
 const fake=await mk({ficha:'3441939',validacionNombre:'oficial'},null,true).principal();assert.equal(fake.role,'aprendiz','una pista de admin sin rol en el servidor no da privilegios');
 const noKey=C.create({projectId:'demo-sena-calendar',enabled:true,emulatorHost:'127.0.0.1:9180',auth:{getUid:async()=>'u',getIdToken:async()=>'d',getUsernameKey:async()=>'',isAdminHint:async()=>false},fetch:async()=>({status:404,ok:false,text:async()=>'{}'})});
 await assert.rejects(noKey.principal(),e=>e.code==='PERMISSION');
});
