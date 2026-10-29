'use strict';
// Reglas candidatas config/firestore.calendar-retire.rules en el EMULADOR (proyecto demo, tokens sin firma, datos ficticios).
// Requiere el emulador de Firestore en 127.0.0.1:9180 cargado con esas reglas (Java con -Duser.language=en).
// Uso: node tools/test_calendar_retire_emulator.cjs
const assert=require('node:assert/strict'),Cloud=require('../js/academic_calendar_cloud.js');
globalThis.crypto??=require('node:crypto').webcrypto;
const project='demo-sena-calendar',root='projects/'+project+'/databases/(default)/documents',base='http://127.0.0.1:9180/v1/'+root;
const token=uid=>{const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);
 return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,email:uid+'@sena-portal.local',firebase:{sign_in_provider:'password',identities:{}}})+'.';};
async function raw(method,path,who,body){const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>({}))};}
const seed=async(path,data)=>assert.equal((await raw('PATCH','/'+path,'owner',{fields:Cloud.fields(data)})).status,200);
const client=uid=>Cloud.create({projectId:project,emulatorHost:'127.0.0.1:9180',enabled:true,auth:{getUid:async()=>uid,getIdToken:async()=>token(uid),getUsernameKey:async()=>uid,isAdminHint:async()=>true}});
const F='3441939',P='sena_portal_calendar_fichas/'+F+'/years/2026';
const sess=(id,date,o={})=>({id,ficha:F,year:2026,date,originalDate:date,blocks:[{start:'14:10',end:'18:10'}],plannedMinutes:240,actualMinutes:null,status:'Activa',activity:'',evidence:'',dueDate:'',curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses:[],origin:'legacy',protected:false,revision:0,mutationId:'m-'+id,updatedBy:'demo-admin',...o});
const results=[];const check=async(name,fn)=>{try{await fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,detail:String(e.message).slice(0,300)});}};
(async()=>{
 await fetch('http://127.0.0.1:9180/emulator/v1/projects/'+project+'/databases/(default)/documents',{method:'DELETE'});
 await seed('sena_portal_roles/demo-admin',{role:'admin'});
 await seed('sena_portal_users/ap1',{usernameKey:'ap1',ficha:F,validacionNombre:'oficial',active:true});
 for(const [id,date,o] of [['a','2026-11-04',{}],['b','2026-11-06',{}],['t','2026-11-11',{status:'Impartida',protected:true}],['c','2026-11-13',{}]]){
  await seed(P+'/sessions/'+id,sess(id,date,o));await seed(P+'/days/'+date,{sessionId:id});await seed(P+'/notes/'+id,{sessionId:id,revision:0,observation:''});}
 const admin=client('demo-admin'),learner=client('ap1');
 const get=async id=>Cloud.document((await raw('GET','/'+P+'/sessions/'+id,'owner')).body);
 await check('retirar una clase importada (libera el día) con recibo',async()=>{const d=await get('a');const r=await admin.save({...d.data,status:'Retirada'},d,'Se quita');assert.equal(r.data.status,'Retirada');assert.equal((await raw('GET','/'+P+'/days/2026-11-04','owner')).status,404);});
 await check('el día liberado admite otra clase nueva de la ficha',async()=>{const n={...sess('nueva','2026-11-04'),origin:'new',status:'Programada',revision:0};await admin.save(n,null,'Reemplazo');});
 await check('restaurar exige el día libre (ocupado → rechazo)',async()=>{const d=await get('a');await assert.rejects(admin.save({...d.data,status:'Programada'},d,'r'));});
 await check('restaurar a Programada con el día libre',async()=>{const d=await get('c');const r=await admin.save({...d.data,status:'Retirada'},d,'q');const back=await admin.save({...r.data,status:'Programada'},{data:r.data,updateTime:r.updateTime},'vuelve');assert.equal(back.data.status,'Programada');assert.equal((await raw('GET','/'+P+'/days/2026-11-13','owner')).status,200);});
 // Negativos directos al servidor (sin las salvaguardas del cliente).
 const commitRaw=async(who,writes)=>(await raw('POST',':commit',who,{writes})).status;
 const receipt=(id,before,after,rev)=>[{update:{name:root+'/'+P+'/sessions/'+id,fields:Cloud.fields(after)},currentDocument:{exists:true}},
  {update:{name:root+'/'+P+'/sessions/'+id+'/audit/'+rev,fields:Cloud.fields({revision:rev,actor:'demo-admin',reason:'x',mutationId:after.mutationId,before,after,notesBefore:'',notesAfter:''})},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}},
  {update:{name:root+'/'+P+'/notes/'+id,fields:Cloud.fields({sessionId:id,revision:rev,observation:''})},currentDocument:{exists:true}}];
 await check('retirar sin liberar el día → denegado',async()=>{const d=(await get('b')).data;const a={...d,status:'Retirada',revision:1,mutationId:'z1'};assert.equal(await commitRaw(token('demo-admin'),receipt('b',d,a,1)),403);});
 await check('retirar cambiando la fecha → denegado',async()=>{const d=(await get('b')).data;const a={...d,status:'Retirada',date:'2026-11-05',revision:1,mutationId:'z2'};assert.equal(await commitRaw(token('demo-admin'),[...receipt('b',d,a,1),{delete:root+'/'+P+'/days/2026-11-06'}]),403);});
 await check('retirar una clase impartida → denegado',async()=>{const d=(await get('t')).data;const a={...d,status:'Retirada',revision:1,mutationId:'z3'};assert.equal(await commitRaw(token('demo-admin'),[...receipt('t',d,a,1),{delete:root+'/'+P+'/days/2026-11-11'}]),403);});
 await check('aprendiz no puede retirar → denegado',async()=>{const d=(await get('b')).data;const a={...d,status:'Retirada',revision:1,mutationId:'z4',updatedBy:'ap1'};assert.equal(await commitRaw(token('ap1'),[...receipt('b',d,a,1),{delete:root+'/'+P+'/days/2026-11-06'}]),403);});
 await check('borrar una sesión → denegado',async()=>assert.equal(await commitRaw(token('demo-admin'),[{delete:root+'/'+P+'/sessions/b'}]),403));
 await check('editar una retirada sin restaurar → denegado',async()=>{const d=(await get('a')).data;const a={...d,activity:'x',revision:d.revision+1,mutationId:'z5'};assert.equal(await commitRaw(token('demo-admin'),receipt('a',d,a,d.revision+1)),403);});
 await check('restaurar a Suspendida → denegado',async()=>{const d=(await get('a')).data;const a={...d,status:'Suspendida',revision:d.revision+1,mutationId:'z6'};assert.equal(await commitRaw(token('demo-admin'),receipt('a',d,a,d.revision+1)),403);});
 await check('ocupar el día con una sesión retirada → denegado',async()=>assert.equal(await commitRaw(token('demo-admin'),[{update:{name:root+'/'+P+'/days/2026-11-20',fields:Cloud.fields({sessionId:'a'})},currentDocument:{exists:false}}]),403));
 // Regresión de lo ya publicado.
 await check('editar fecha y franjas sigue funcionando',async()=>{const d=await get('b');const r=await admin.save({...d.data,date:'2026-11-05',blocks:[{start:'07:00',end:'08:00'},{start:'14:10',end:'18:10'}],plannedMinutes:300},d,'mover');assert.equal(r.data.date,'2026-11-05');});
 await check('traslado entre fichas sigue funcionando',async()=>{const d=await get('c');const t={...sess('tras','2026-11-13'),ficha:'3441942',origin:'new',status:'Programada'};const r=await admin.transfer(d,t,'traslado');assert.equal(r.original.data.status,'Suspendida');});
 await check('el aprendiz lee su ficha y la retirada no está en su agenda',async()=>{const docs=await learner.list(F,2026);assert.ok(docs.length>0);assert.ok(!Cloud.agenda(docs.map(d=>d.data)).some(e=>e.sourceId==='a'));});
 results.forEach(r=>console.log((r.ok?'PASS ':'FAIL ')+r.name+(r.ok?'':'  -> '+r.detail)));console.log(results.filter(r=>r.ok).length+'/'+results.length+' PASS');process.exitCode=results.every(r=>r.ok)?0:1;
})();
