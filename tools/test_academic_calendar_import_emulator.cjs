'use strict';
// Full historical import into the loopback emulator only (demo-sena-calendar), with unsigned demo tokens.
// Reads the PRIVATE read-only Firestore copy from memory/ (never committed); never contacts production.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),C=require('../js/academic_calendar_cloud.js'),Release=require('./academic_calendar_release.cjs'),Import=require('./academic_calendar_import.cjs');
const project='demo-sena-calendar',docRoot='projects/'+project+'/databases/(default)/documents',base='http://127.0.0.1:9180/v1/'+docRoot;
const snapshotDir=path.join(root,'memory/respaldos/firestore-principal-2026-10-20');
const out=path.join(root,'memory/validaciones/continuacion-claude-2026-10-21/emulator-import-results.json');
const results=[];
const token=uid=>{const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),n=Math.floor(Date.now()/1000);return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,user_id:uid,iat:n,exp:n+3600,auth_time:n,email:uid+'@sena-portal.local',firebase:{sign_in_provider:'password',identities:{}}})+'.';};
async function raw(method,p,uid,body){const r=await fetch(base+p,{method,headers:{Authorization:'Bearer '+(uid?token(uid):'owner'),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):{}};}
const seed=async(p,d)=>{const r=await raw('PATCH','/'+p,null,{fields:C.fields(d)});assert.equal(r.status,200,JSON.stringify(r.body));};
const client=uid=>C.create({projectId:project,emulatorHost:'127.0.0.1:9180',enabled:true,auth:{getUid:async()=>uid,getIdToken:async()=>token(uid)}});
async function check(name,fn){let detail;try{detail=await fn();}catch(e){e.message=name+": "+e.message;throw e;}results.push({name,pass:true,...(detail&&{detail})});}
// Same transport contract as Import.run: atomic commit with exists:false, CONFLICT on existing data, null on missing.
const transport=uid=>({
 async commit(writes){const r=await raw('POST',':commit',uid,{writes:writes.map(w=>({update:{name:docRoot+'/'+w.path,fields:C.fields(w.data)},currentDocument:{exists:false}}))});
  if(r.status!==200){const e=Error(r.body.error?.message||String(r.status));if([409,400].includes(r.status)&&/ALREADY_EXISTS|FAILED_PRECONDITION/.test(r.body.error?.status||''))e.code='CONFLICT';throw e;}},
 async read(p){const r=await raw('GET','/'+p,uid);if(r.status===404)return null;assert.equal(r.status,200,JSON.stringify(r.body));return C.document(r.body).data;}});
(async()=>{
 if(!fs.existsSync(path.join(snapshotDir,'firestore/decoded-analysis.json')))throw Error('Copia privada de Firestore no disponible; esta prueba solo corre en el equipo del propietario.');
 const docs=JSON.parse(fs.readFileSync(path.join(snapshotDir,'firestore/decoded-analysis.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(snapshotDir,'firestore/manifest.json'),'utf8'));
 const snapshot=docs.find(d=>d.name.endsWith('/sena_portal_calendar/calendario_2026_admin')).value,sourceCopy=JSON.stringify(snapshot);
 const previous=JSON.parse(fs.readFileSync(path.join(snapshotDir,'old-decoded-corrected.json'),'utf8')).find(d=>d.name.endsWith('/sena_portal_calendar/calendario_2026_admin')).value;
 const scope={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data/calendario_2026_records.js'),'utf8'),scope);
 const records=JSON.parse(JSON.stringify(scope.window.CALENDAR_2026_RECORDS));
 const mapping={'I.E. Jhon F. Kennedy|10A':'3441939','I.E. Jhon F. Kennedy|10B':'3441942','I.E. Santa Bárbara|10A':'3441944','I.E. Santa Bárbara|10B':'3441950','I.E. Santa Bárbara|11A':'3168850','I.E. Santa Bárbara|11B':'3168852'};
 const p=Release.prepare({records,snapshot,mapping,year:2026,readTime:manifest.readTime,adminUid:'demo-admin'},require('../data/academic_planner_catalog.js'));
 const sessionDocs=p.documents.filter(d=>/\/sessions\/[^/]+$/.test(d.path)),byId=new Map(sessionDocs.map(d=>[d.data.id,d.data]));
 const expected={'3168850':[57,43],'3168852':[48,38],'3441939':[35,25],'3441942':[36,25],'3441944':[50,37],'3441950':[42,33]};
 await fetch('http://127.0.0.1:9180/emulator/v1/projects/'+project+'/databases/(default)/documents',{method:'DELETE'});
 await seed('sena_portal_roles/demo-admin',{role:'admin'});
 await seed('sena_portal_calendar_assignments/demo-admin',{role:'admin',active:true,fichas:C.FICHAS});
 await seed('sena_portal_calendar_assignments/demo-instructor',{role:'instructor',active:true,fichas:C.FICHAS});
 for(const [i,f] of C.FICHAS.entries())await seed('sena_portal_calendar_assignments/demo-student-'+i,{role:'aprendiz',active:true,fichas:[f]});

 await check('integrity before import: 364 records, 203 Impartida, 201 in six fichas, 268 classes, 211 sessions',async()=>{
  assert.deepEqual({records:p.integrity.records,taught:p.integrity.taught,inFichas:p.integrity.taughtInFichas,classes:p.integrity.classes,sessions:p.integrity.sessions},{records:364,taught:203,inFichas:201,classes:268,sessions:211});
  assert.equal(Object.keys(snapshot.state).length,364);return p.integrity;});
 const old113=Object.keys(previous.state).filter(id=>previous.state[id].estado==='Impartida'&&!records.some(r=>r.id===id));
 await check('the 113 previously omitted Impartida slots are represented as Impartida',async()=>{
  assert.equal(old113.length,113);for(const id of old113){const c=p.comparison.find(x=>x.id===id);assert.ok(c,id);assert.equal(c.state,'Impartida',id);if(c.ficha)assert.equal(byId.get(c.sessionId).sourceStatuses.find(x=>x.sourceId===id).state,'Impartida',id);}return {old113:old113.length};});

 let receipt;
 await check('controlled historical import completes atomically with readback and audit receipt',async()=>{
  receipt=await Import.run(p,transport('demo-admin'),{receiptPath:'sena_portal_calendar/import_receipt_2026_'+p.source.sha256.slice(0,24)});
  assert.equal(receipt.status,'COMPLETADA',JSON.stringify(receipt));assert.equal(receipt.written,p.documents.length);assert.equal(receipt.verified,p.documents.length);
  return {documents:receipt.documents,steps:receipt.steps,written:receipt.written,verified:receipt.verified};});
 const store=transport('demo-admin');
 await check('archive in emulator equals the Firestore snapshot field by field (364 states)',async()=>{
  const archive=(await store.read(p.documents[0].path));assert.ok(Import.equal(archive.state,snapshot.state));
  for(const id of Object.keys(snapshot.state))assert.ok(Import.equal(archive.state[id],snapshot.state[id]),id);
  assert.equal(JSON.stringify(snapshot),sourceCopy,'source copy untouched');return {states:Object.keys(archive.state).length};});
 const perFicha={};
 await check('each class: id, ficha, date, slot hours and state identical after import',async()=>{
  const listed=new Map();for(const f of C.FICHAS)for(const d of await client('demo-instructor').list(f,2026))listed.set(d.data.id,d.data);
  assert.equal(listed.size,211);
  for(const c of p.comparison.filter(c=>c.sessionId)){
   const s=listed.get(c.sessionId),src=s.sourceStatuses.find(x=>x.sourceId===c.id),rec=snapshot.state[c.id];
   assert.equal(s.ficha,c.ficha,c.id);assert.equal(s.date,c.date,c.id);assert.equal(src.state,c.state,c.id);if(rec?.estado)assert.equal(src.state,rec.estado,c.id);
   assert.ok(src.blocks.length>0&&src.blocks.every(b=>s.blocks.some(x=>x.start===b.start&&x.end===b.end)),c.id);
   assert.ok(Import.equal(s,byId.get(c.sessionId)),c.sessionId);
   perFicha[c.ficha]=perFicha[c.ficha]||[0,0];perFicha[c.ficha][0]++;if(c.state==='Impartida')perFicha[c.ficha][1]++;
  }
  assert.deepEqual(perFicha,expected);return perFicha;});
 await check('per-ficha private views keep original activities and observations unchanged',async()=>{
  let withObs=0,withAct=0;for(const f of C.FICHAS){const v=await store.read('sena_portal_calendar_fichas/'+f+'/years/2026');for(const r of v.records){assert.ok(Import.equal(r.sourceState,snapshot.state[r.sourceId]??r.sourceState),r.sourceId);if(r.sourceState?.obs)withObs++;if(r.sourceState?.act)withAct++;}}
  return {recordsWithObservation:withObs,recordsWithActivity:withAct};});
 await check('re-import is idempotent: no duplicates, nothing rewritten',async()=>{
  const again=await Import.run(p,store);assert.equal(again.status,'COMPLETADA');assert.equal(again.written,0);assert.equal(again.alreadyPresent,p.documents.length);
  let total=0;for(const f of C.FICHAS)total+=(await client('demo-instructor').list(f,2026)).length;assert.equal(total,211);return {alreadyPresent:again.alreadyPresent};});
 await check('learner reads only own ficha, never archive, private view, notes, audit or other fichas',async()=>{
  for(const [i,f] of C.FICHAS.entries()){const u='demo-student-'+i,mine=await client(u).list(f,2026);assert.equal(mine.length,sessionDocs.filter(d=>d.data.ficha===f).length);
   for(const other of C.FICHAS.filter(x=>x!==f))assert.equal((await raw('GET','/sena_portal_calendar_fichas/'+other+'/years/2026/sessions',u)).status,403);
   assert.equal((await raw('GET','/sena_portal_calendar_fichas/'+f+'/years/2026',u)).status,403);
   assert.equal((await raw('GET','/sena_portal_calendar_fichas/'+f+'/years/2026/notes',u)).status,403);
   assert.equal((await raw('GET','/sena_portal_calendar_fichas/'+f+'/years/2026/notes/'+mine[0].data.id,u)).status,403);
   assert.equal((await raw('GET','/'+mine[0].name.split('/documents/')[1]+'/audit/0',u)).status,403);
   await assert.rejects(client(u).notes(f,2026),e=>e.code==='PERMISSION');await assert.rejects(client(u).history(f,2026,mine[0].data.id),e=>e.code==='PERMISSION');}
  assert.equal((await raw('GET','/'+p.documents[0].path,'demo-student-0')).status,403);
  assert.equal((await raw('POST',':runQuery','demo-student-0',{structuredQuery:{from:[{collectionId:'sessions',allDescendants:true}]}})).status,403);
  assert.equal((await raw('POST',':runQuery','demo-student-0',{structuredQuery:{from:[{collectionId:'notes',allDescendants:true}]}})).status,403);});
 await check('learner-readable sessions contain no internal observation, reason or administrative note',async()=>{
  for(const [i,f] of C.FICHAS.entries())for(const d of await client('demo-student-'+i).list(f,2026)){assert.deepEqual(Object.keys(d.data).sort(),[...C.KEYS].sort());assert.ok(!('observation' in d.data)&&!('reason' in d.data));}
  const events=C.agenda((await client('demo-student-0').list('3168850',2026)).map(d=>d.data)),text=JSON.stringify(events);
  for(const obs of new Set(Object.values(snapshot.state).map(x=>x.obs).filter(x=>typeof x==='string'&&x.length>3)))assert.ok(!text.includes(obs),'internal observation leaked: '+obs);
  assert.ok(events.every(e=>e.readonly&&e.ficha==='3168850'));return {events:events.length};});
 const teacher=client('demo-instructor'),learner=f=>client('demo-student-'+C.FICHAS.indexOf(f));
 const legacyActiva=sessionDocs.map(d=>d.data).filter(s=>s.status==='Activa'&&!s.protected);
 const freeDate=(f,from)=>{const taken=new Set(sessionDocs.filter(d=>d.data.ficha===f).map(d=>d.data.date));let date=from;while(taken.has(date))date=new Date(Date.parse(date+'T12:00:00Z')+864e5).toISOString().slice(0,10);return date;};
 let corrected,original;
 await check('instructor corrects a taught historical class: date, hours, activity, evidence and internal note, with full audit',async()=>{
  const prot=(await teacher.list('3168850',2026)).find(d=>d.data.protected&&d.data.status==='Impartida'&&d.data.blocks.length===1);original=prot;
  const oldDate=prot.data.date,newDate=freeDate('3168850','2026-11-03'),b=prot.data.blocks[0];
  const archiveBefore=await store.read(p.documents[0].path);
  corrected=await teacher.save({...prot.data,date:newDate,blocks:[{start:b.start,end:b.end},{start:'14:00',end:'14:55'}],plannedMinutes:prot.data.plannedMinutes+55,activity:'Actividad corregida ficticia',evidence:'Evidencia ficticia',dueDate:newDate},prot,'Corrección ficticia de fecha y horario',{observation:'Observación interna ficticia'});
  assert.equal(corrected.data.status,'Impartida');assert.equal(corrected.data.revision,1);assert.equal(corrected.data.originalDate,prot.data.originalDate);assert.ok(Import.equal(corrected.data.sourceStatuses,prot.data.sourceStatuses),'original per-slot states kept');
  const h=(await teacher.history('3168850',2026,prot.data.id)).map(x=>x.data).sort((x,y)=>x.revision-y.revision);
  assert.equal(h.length,2);assert.ok(Import.equal(h[0].after,prot.data),'original record kept in audit 0');
  const r=h[1];assert.equal(r.actor,'demo-instructor');assert.equal(r.reason,'Corrección ficticia de fecha y horario');assert.ok(Import.equal(r.before,prot.data));assert.ok(Import.equal(r.after,corrected.data));
  assert.equal(r.notesBefore,'');assert.equal(r.notesAfter,'Observación interna ficticia');assert.match(r.at,/^\d{4}-\d{2}-\d{2}T/);assert.ok(Math.abs(Date.parse(r.at)-Date.now())<120000,'server time recorded');
  assert.equal((await raw('GET','/sena_portal_calendar_fichas/3168850/years/2026/days/'+oldDate,'demo-admin')).status,404,'previous day released');
  assert.equal((await store.read('sena_portal_calendar_fichas/3168850/years/2026/days/'+newDate)).sessionId,prot.data.id,'new day occupied');
  assert.ok(Import.equal(await store.read(p.documents[0].path),archiveBefore),'historical archive untouched');
  const seen=(await learner('3168850').list('3168850',2026)).find(d=>d.data.id===prot.data.id).data;assert.equal(seen.date,newDate);assert.equal(seen.activity,'Actividad corregida ficticia');
  const ev=C.agenda([seen]);assert.ok(ev.some(e=>e.type==='ENTREGA'&&e.date===newDate));assert.ok(!JSON.stringify(ev).includes('Observación interna ficticia'));
  return {oldDate,newDate,auditAt:r.at};});
 await check('freed date can be reused; the moved class keeps its new day; duplicates rejected',async()=>{
  const d={id:'class_reuse_'+Date.now(),ficha:'3168850',year:2026,date:original.data.date,originalDate:original.data.date,blocks:[{start:'07:00',end:'07:55'}],plannedMinutes:55,actualMinutes:null,status:'Programada',activity:'',evidence:'',dueDate:'',curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses:[],origin:'new',protected:false,revision:0,mutationId:'draft',updatedBy:'demo-instructor'};
  await teacher.save(d,null,'Uso de la fecha liberada');
  await assert.rejects(teacher.save({...d,id:'class_dup_'+Date.now(),date:corrected.data.date,originalDate:corrected.data.date},null,'Duplicada'));});
 await check('taught state cannot be changed, and a stale correction is rejected without overwriting',async()=>{
  await assert.rejects(teacher.save({...corrected.data,status:'Programada'},corrected,'Regresión'),/estado/);
  await assert.rejects(teacher.save({...original.data,activity:'Obsoleta'},original,'Obsoleta'),e=>e.code==='CONFLICT');
  assert.equal((await teacher.list('3168850',2026)).find(d=>d.data.id===corrected.data.id).data.activity,'Actividad corregida ficticia');});
 const name=x=>docRoot+'/'+x.name.split('/documents/')[1];
 const forgedUpdate=async(uid,cur,next,extra=[],{dropOldDay=false,notesAfter='Forzada'}={})=>{const pre='sena_portal_calendar_fichas/'+cur.data.ficha+'/years/2026',moved=next.date!==cur.data.date;
  const writes=[{update:{name:name(cur),fields:C.fields(next)},currentDocument:{updateTime:cur.updateTime}},{update:{name:name(cur)+'/audit/'+next.revision,fields:C.fields({revision:next.revision,actor:uid,reason:'Forzada',mutationId:next.mutationId,before:cur.data,after:next,notesBefore:(await store.read(pre+'/notes/'+cur.data.id))?.observation??'',notesAfter})},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}},
   {update:{name:docRoot+'/'+pre+'/notes/'+cur.data.id,fields:C.fields({sessionId:cur.data.id,revision:next.revision,observation:notesAfter})}},...extra];
  if(moved){writes.push({update:{name:docRoot+'/'+pre+'/days/'+next.date,fields:C.fields({sessionId:cur.data.id})},currentDocument:{exists:false}});if(!dropOldDay)writes.push({delete:docRoot+'/'+pre+'/days/'+cur.data.date});}
  return (await raw('POST',':commit',uid,{writes})).status;};
 await check('rules: a move must release the old day; unauthorized users and state changes are denied',async()=>{
  const cur=(await teacher.list('3168850',2026)).find(d=>d.data.id===corrected.data.id),date=freeDate('3168850','2026-11-17'),base={...cur.data,date,dueDate:date,revision:cur.data.revision+1,mutationId:'forged-'+Date.now(),updatedBy:'demo-instructor'};
  assert.equal(await forgedUpdate('demo-instructor',cur,{...base,dueDate:cur.data.date}),403,'deadline before the class');
  assert.equal(await forgedUpdate('demo-instructor',cur,base,[],{dropOldDay:true}),403,'move keeping the old day occupied');
  assert.equal(await forgedUpdate('demo-instructor',cur,{...base,status:'Programada'}),403,'taught state change');
  assert.equal(await forgedUpdate('demo-student-0',cur,{...base,updatedBy:'demo-student-0'}),403,'learner write');
  await seed('sena_portal_calendar_assignments/limited-instructor',{role:'instructor',active:true,fichas:['3441939']});
  assert.equal(await forgedUpdate('limited-instructor',cur,{...base,updatedBy:'limited-instructor'}),403,'instructor of another ficha');
  assert.equal(await forgedUpdate('demo-instructor',cur,{...base,observation:'Filtrada'}),403,'internal note inside the learner-readable session');
  assert.equal(await forgedUpdate('demo-instructor',cur,base),200,'positive control: complete, correct move is accepted');
  assert.equal((await raw('GET','/sena_portal_calendar_fichas/3168850/years/2026/days/'+cur.data.date,'demo-admin')).status,404);});
 let registered;
 await check('instructor registers a pending historical class as taught with activity, evidence and internal note',async()=>{
  const target=legacyActiva[0],before=(await teacher.list(target.ficha,2026)).find(d=>d.data.id===target.id);
  registered=await teacher.save({...before.data,status:'Realizada',activity:'Actividad ficticia de verificación',evidence:'Informe ficticio'},before,'Registro ficticio de clase impartida',{observation:'Nota interna ficticia'});
  assert.equal(registered.data.revision,1);assert.equal(registered.data.actualMinutes,null);assert.ok(Import.equal(registered.data.sourceStatuses,target.sourceStatuses),'original states kept');
  assert.equal((await teacher.notes(target.ficha,2026)).get(target.id),'Nota interna ficticia');
  const seen=(await learner(target.ficha).list(target.ficha,2026)).find(d=>d.data.id===target.id).data;assert.equal(seen.activity,'Actividad ficticia de verificación');assert.equal(seen.evidence,'Informe ficticio');
  const ev=C.agenda([seen]);assert.ok(ev.filter(e=>e.type==='CLASE').every(e=>e.status==='taught'&&e.readonly));assert.match(ev[0].description,/sin fecha límite registrada/);assert.ok(!JSON.stringify(ev).includes('Nota interna'));
  return {ficha:target.ficha,date:target.date};});
 await check('taught class can still be corrected afterwards (activity and internal note) with a new audit revision',async()=>{
  const again=await teacher.save({...registered.data,activity:'Actividad ficticia corregida'},registered,'Corrección posterior ficticia',{observation:'Nota interna corregida'});
  assert.equal(again.data.revision,2);assert.equal(again.data.status,'Realizada');const h=await teacher.history(again.data.ficha,2026,again.data.id);assert.equal(h.length,3);
  const last=h.map(x=>x.data).find(x=>x.revision===2);assert.equal(last.notesBefore,'Nota interna ficticia');assert.equal(last.notesAfter,'Nota interna corregida');assert.equal(last.before.activity,'Actividad ficticia de verificación');});
 await check('re-import after legitimate changes stops and preserves the current versions',async()=>{
  const r=await Import.run(p,store);assert.equal(r.status,'DETENIDA_CONFLICTO');assert.ok(r.conflicts.length>0);
  assert.equal((await teacher.list('3168850',2026)).find(d=>d.data.id===corrected.data.id).data.activity,'Actividad corregida ficticia');return {conflicts:r.conflicts.length};});
 await check('concurrent corrections of one class: one winner, loser told the calendar changed',async()=>{
  const target=legacyActiva[1],before=(await teacher.list(target.ficha,2026)).find(d=>d.data.id===target.id);
  // Same transformation as the edit dialog: a pending historical 'Activa' class is edited as 'Programada'.
  const r=await Promise.allSettled(['A','B'].map(x=>client('demo-instructor').save({...before.data,status:'Programada',activity:'Concurrente '+x},before,'Concurrencia '+x,{observation:'Nota '+x})));
  assert.equal(r.filter(x=>x.status==='fulfilled').length,1,r.map(x=>x.reason?.message).join(' | '));
  assert.equal(r.find(x=>x.status==='rejected').reason.code,'CONFLICT',r.find(x=>x.status==='rejected').reason.message);
  const h=await teacher.history(target.ficha,2026,target.id);assert.equal(h.length,2);const win=r.find(x=>x.status==='fulfilled').value;assert.equal((await teacher.notes(target.ficha,2026)).get(target.id),win.observation);});
 await check('revoked learner loses access immediately; reinstated learner recovers it',async()=>{
  await seed('sena_portal_calendar_assignments/demo-student-1',{role:'aprendiz',active:false,fichas:['3168852']});
  await assert.rejects(client('demo-student-1').list('3168852',2026),e=>e.code==='PERMISSION');assert.equal((await raw('GET','/sena_portal_calendar_fichas/3168852/years/2026/sessions','demo-student-1')).status,403);
  await seed('sena_portal_calendar_assignments/demo-student-1',{role:'aprendiz',active:true,fichas:['3168852']});assert.equal((await client('demo-student-1').list('3168852',2026)).length,sessionDocs.filter(d=>d.data.ficha==='3168852').length);});
 await check('historical integrity after all corrections: 364 archived states, 203 Impartida, 113 recovered, source states unchanged',async()=>{
  const archive=await store.read(p.documents[0].path);assert.ok(Import.equal(archive.state,snapshot.state));
  assert.equal(Object.values(archive.state).filter(x=>x.estado==='Impartida').length,203);
  const all=new Map();for(const f of C.FICHAS)for(const d of await teacher.list(f,2026))all.set(d.data.id,d.data);
  for(const c of p.comparison.filter(c=>c.sessionId))assert.equal(all.get(c.sessionId).sourceStatuses.find(x=>x.sourceId===c.id).state,c.state,c.id);
  for(const id of old113){const c=p.comparison.find(x=>x.id===id);if(c.sessionId)assert.equal(all.get(c.sessionId).sourceStatuses.find(x=>x.sourceId===id).state,'Impartida');}
  return {archived:Object.keys(archive.state).length,impartida:203,recovered:old113.length};});
 await check('worst case within the 1000-expression limit: six blocks + curriculum + deadline on historical, new and moved writes',async()=>{
  const cv={id:'worst',competencyCode:'T',competency:'Ficticia',rap:'R',order:'1',source:'Ficticia'};await seed('sena_portal_calendar_curriculum/worst',{value:cv,fichas:['3441950']});
  const blocks=Array.from({length:6},(_,i)=>({start:String(i+7).padStart(2,'0')+':00',end:String(i+7).padStart(2,'0')+':50'}));
  const legacy={id:'legacy_worst',ficha:'3441950',year:2031,date:'2031-04-07',originalDate:'2031-04-07',blocks,plannedMinutes:300,actualMinutes:null,status:'Impartida',activity:'',evidence:'',dueDate:'',curriculum:cv,sourceStatuses:blocks.map((b,i)=>({sourceId:'ficticio|f'+i,state:'Impartida',blocks:[b]})),origin:'legacy',protected:true,revision:0,mutationId:'historical-import',updatedBy:'demo-admin'};
  const prefix='sena_portal_calendar_fichas/3441950/years/2031',pk={preparedOnly:true,productionWrites:0,source:{sha256:'ficticio'},integrity:{},documents:[{path:prefix+'/sessions/legacy_worst',data:legacy,precondition:{exists:false}},{path:prefix+'/sessions/legacy_worst/audit/0',data:{revision:0,actor:'demo-admin',reason:'Peor caso ficticio',mutationId:legacy.mutationId,before:null,after:legacy,notesBefore:'',notesAfter:''},precondition:{exists:false}},{path:prefix+'/days/2031-04-07',data:{sessionId:'legacy_worst'},precondition:{exists:false}},{path:prefix+'/notes/legacy_worst',data:{sessionId:'legacy_worst',revision:0,observation:''},precondition:{exists:false}}]};
  assert.equal((await Import.run(pk,store)).status,'COMPLETADA');
  const hist=(await teacher.list('3441950',2031)).find(d=>d.data.id==='legacy_worst');
  await teacher.save({...hist.data,date:'2031-04-08',activity:'Corrección peor caso',evidence:'Evidencia',dueDate:'2031-04-30'},hist,'Corrección peor caso ficticio',{observation:'Nota'});
  const created=await teacher.save({...legacy,id:'new_worst',date:'2031-04-14',originalDate:'2031-04-14',status:'Programada',sourceStatuses:[],origin:'new',protected:false,evidence:'Entrega',dueDate:'2031-04-30'},null,'Peor caso ficticio',{observation:'Nota'});
  const moved=await teacher.save({...created.data,date:'2031-04-21'},created,'Cambio de fecha peor caso');assert.equal(moved.data.date,'2031-04-21');});
 assert.equal(JSON.stringify(snapshot),sourceCopy,'source copy untouched at the end');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify({project,endpoint:'127.0.0.1:9180',productionWrites:0,passed:results.length,receipt,results},null,2));
 console.log(JSON.stringify({passed:results.length,productionWrites:0}));
})().catch(e=>{console.error(e.message);console.error(String(e.stack).split("\n").find(l=>l.includes("import_emulator")));console.error("aprobadas antes del fallo:",results.map(r=>r.name).join(" | "));process.exitCode=1;});
