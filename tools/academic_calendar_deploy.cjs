'use strict';
// Calendar data deployment (admin assignment -> historical import -> learner assignments) WITH the admin's own
// Firebase identity, so every write is evaluated by the deployed rules (never IAM/CLI credentials, which bypass them).
// Default: plan only, no network. Execution needs --ejecutar --objetivo=emulador|produccion; production additionally
// needs SENA_AUTORIZACION_DESPLIEGUE="AUTORIZO DESPLIEGUE CALENDARIO YYYY-MM-DD" (today, Bogotá) and the admin
// password typed on stdin (never stored). Rules, pages and Apps Script are deployed separately (see the runbook).
const fs=require('node:fs'),path=require('node:path'),C=require('../js/academic_calendar_cloud.js'),Import=require('./academic_calendar_import.cjs');
const today=()=>new Date(Date.now()-5*3600e3).toISOString().slice(0,10);
function plan({prepared,assignments}){
 const steps=Import.plan(prepared);
 if(!/^[A-Za-z0-9]{20,40}$/.test(assignments?.instructor?.uid||''))throw Error('UID administrador no verificado.');
 if(prepared.requiredAdminUid!==assignments.instructor.uid)throw Error('El paquete no fue preparado para el administrador verificado.');
 const learners=assignments.asignacionesAprendiz||[],seen=new Set();
 for(const a of learners){
  if(!/^[A-Za-z0-9]{20,40}$/.test(a.uid||'')||a.role!=='aprendiz'||a.active!==true||!Array.isArray(a.fichas)||a.fichas.length!==1||!C.FICHAS.includes(a.fichas[0]))throw Error('Asignación de aprendiz inválida.');
  if(seen.has(a.uid)||a.uid===assignments.instructor.uid)throw Error('UID repetido en las asignaciones.');seen.add(a.uid);
 }
 const perFicha={};for(const a of learners)perFicha[a.fichas[0]]=(perFicha[a.fichas[0]]||0)+1;
 return {adminUid:assignments.instructor.uid,importSteps:steps.length,importDocuments:prepared.documents.length,integrity:prepared.integrity,learnerAssignments:learners.length,perFicha,
  writesEstimated:1+prepared.documents.length+1+learners.length};
}
function authorized(objetivo,env=process.env){
 if(objetivo==='emulador')return true;
 if(objetivo!=='produccion')throw Error('Objetivo desconocido.');
 if(env.SENA_AUTORIZACION_DESPLIEGUE!=='AUTORIZO DESPLIEGUE CALENDARIO '+today())throw Error('Falta la autorización expresa del propietario con la fecha de hoy.');
 return true;
}
async function execute({prepared,assignments,api,transport,log=()=>{}}){
 const summary=plan({prepared,assignments}),me=await api.principal().catch(()=>null);
 // The admin assignment must exist before importing: the import rules require calEditor() on every ficha.
 // Bootstrap: client.assign() requires an existing assignment, so the first one is created through the transport
 // (rules: create only by isAdmin(), exists:false) and then verified by reading it as the admin.
 if(!me){const data={role:'admin',active:true,fichas:C.FICHAS};await transport.commit([{path:'sena_portal_calendar_assignments/'+summary.adminUid,data}]);
  const check=await api.principal();if(check.uid!==summary.adminUid||check.role!=='admin'||JSON.stringify(check.fichas)!==JSON.stringify(C.FICHAS))throw Error('Asignación del administrador no verificada.');log('asignación administrador creada y verificada');}
 else if(me.uid!==summary.adminUid||me.role!=='admin')throw Error('La sesión no corresponde al administrador verificado.');
 const receipt=await Import.run(prepared,transport,{receiptPath:'sena_portal_calendar/import_receipt_'+prepared.integrity.sourceHash.slice(0,24)+'_'+Date.now()+'_'+require('node:crypto').randomBytes(4).toString('hex')});
 log('importación: '+receipt.status);
 if(!['COMPLETADA'].includes(receipt.status))return {summary,receipt,assigned:[],stopped:true};
 const assigned=[],skipped=[];
 for(const a of assignments.asignacionesAprendiz){
  const current=await api.readAssignment(a.uid);
  if(current){if(JSON.stringify(current.data.fichas)===JSON.stringify(a.fichas)&&current.data.role===a.role&&current.data.active===a.active)skipped.push(a.uid);else throw Error('Asignación existente distinta para '+a.uid+'; revisar manualmente, no se sobrescribe.');continue;}
  await api.assign(a.uid,{role:a.role,active:a.active,fichas:a.fichas},null);assigned.push(a.uid);
 }
 log('asignaciones: '+assigned.length+' nuevas, '+skipped.length+' ya presentes');
 return {summary,receipt,assigned,skipped,stopped:false};
}
// Segunda ronda (2026-10-28): asigna aprendices cuyo primer inicio de sesión ocurrió DESPUÉS de la ventana.
// No importa ni toca sesiones: solo crea asignaciones nuevas verificadas (lectura posterior) y nunca sobrescribe
// una asignación existente distinta. Requiere la asignación admin vigente.
async function assignOnly({assignments,api,log=()=>{}}){
 const learners=assignments?.asignacionesAprendiz||[],seen=new Set();
 for(const a of learners){
  if(!/^[A-Za-z0-9]{20,40}$/.test(a.uid||'')||a.role!=='aprendiz'||a.active!==true||!Array.isArray(a.fichas)||a.fichas.length!==1||!C.FICHAS.includes(a.fichas[0]))throw Error('Asignación de aprendiz inválida.');
  if(seen.has(a.uid))throw Error('UID repetido en las asignaciones.');seen.add(a.uid);
 }
 const me=await api.principal();if(me.role!=='admin'||(assignments.instructor&&me.uid!==assignments.instructor.uid))throw Error('La sesión no corresponde al administrador verificado.');
 const assigned=[],skipped=[],pending=[];
 // Primero se comprueba TODO; si una asignación existente difiere, no se escribe nada.
 for(const a of learners){
  if(a.uid===me.uid)throw Error('El UID del administrador no se asigna como aprendiz.');
  const current=await api.readAssignment(a.uid);
  if(current){if(JSON.stringify(current.data.fichas)===JSON.stringify(a.fichas)&&current.data.role===a.role&&current.data.active===a.active)skipped.push(a.uid);else throw Error('Asignación existente distinta para '+a.uid+'; revisar manualmente, no se sobrescribe. No se escribió ninguna asignación.');}
  else pending.push(a);
 }
 for(const a of pending){await api.assign(a.uid,{role:a.role,active:a.active,fichas:a.fichas},null);assigned.push(a.uid);}
 log('asignaciones (segunda ronda): '+assigned.length+' nuevas, '+skipped.length+' ya presentes');
 return {assigned,skipped};
}
// 2026-10-28 (cuentas actuales): SOLO importa los datos del calendario con la identidad del administrador.
// No crea asignaciones de ninguna cuenta (ni siquiera la del administrador): el acceso sale del perfil existente.
async function importOnly({prepared,api,transport,log=()=>{}}){
 const me=await api.principal();
 if(me.role!=='admin'||me.uid!==prepared.requiredAdminUid)throw Error('La sesión no corresponde al administrador verificado del paquete.');
 const receipt=await Import.run(prepared,transport,{receiptPath:'sena_portal_calendar/import_receipt_'+prepared.integrity.sourceHash.slice(0,24)+'_'+Date.now()+'_'+require('node:crypto').randomBytes(4).toString('hex')});
 log('importación: '+receipt.status);
 return {receipt,stopped:receipt.status!=='COMPLETADA'};
}
function restTransport({base,docRoot,token}){
 const enc=C.fields,dec=d=>C.document(d).data;
 return {async commit(writes){const r=await fetch(base+':commit',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({writes:writes.map(w=>({update:{name:docRoot+'/'+w.path,fields:enc(w.data)},currentDocument:{exists:false}}))})});
   if(!r.ok){const b=await r.json().catch(()=>({}));const e=Error(b.error?.message||String(r.status));if(/ALREADY_EXISTS|FAILED_PRECONDITION/.test(b.error?.status||''))e.code='CONFLICT';throw e;}},
  async read(p){const r=await fetch(base+'/'+p,{headers:{Authorization:'Bearer '+await token()}});if(r.status===404)return null;if(!r.ok)throw Error('Lectura '+r.status+' '+p);return dec(await r.json());}};
}
module.exports={plan,authorized,execute,assignOnly,importOnly,restTransport,today};
if(require.main===module)(async()=>{
 const arg=k=>(process.argv.find(a=>a.startsWith('--'+k+'='))||'').split('=').slice(1).join('=');
 const soloAsignaciones=process.argv.includes('--solo-asignaciones');
 const assignments=JSON.parse(fs.readFileSync(arg('asignaciones'),'utf8'));
 const prepared=soloAsignaciones?null:JSON.parse(fs.readFileSync(arg('paquete'),'utf8'));
 const summary=soloAsignaciones?{adminUid:assignments?.instructor?.uid,learnerAssignments:(assignments.asignacionesAprendiz||[]).length}:plan({prepared,assignments});
 console.log(JSON.stringify({modo:(soloAsignaciones?'SEGUNDA RONDA (solo asignaciones)':'PLAN')+' (sin red)',...summary},null,2));
 if(!process.argv.includes('--ejecutar'))return;
 const objetivo=arg('objetivo');authorized(objetivo);
 if(objetivo==='produccion')throw Error('Ejecución en producción deshabilitada en esta versión: requiere la revisión final del propietario (ver PLAN_DESPLIEGUE).');
 const project='demo-sena-calendar',docRoot='projects/'+project+'/databases/(default)/documents',base='http://127.0.0.1:9180/v1/'+docRoot,uid=summary.adminUid;
 const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),n=Math.floor(Date.now()/1000),token=async()=>b({alg:'none'})+'.'+b({iss:'https://securetoken.google.com/'+project,aud:project,sub:uid,user_id:uid,iat:n,exp:n+3600,auth_time:n,email:'dubier@sena-portal.local',firebase:{sign_in_provider:'password',identities:{}}})+'.';
 const api=C.create({projectId:project,emulatorHost:'127.0.0.1:9180',enabled:true,auth:{getUid:async()=>uid,getIdToken:token}});
 if(soloAsignaciones){const r=await assignOnly({assignments,api,log:m=>console.log('·',m)});console.log(JSON.stringify({objetivo,assigned:r.assigned.length,skipped:r.skipped.length},null,2));return;}
 const result=await execute({prepared,assignments,api,transport:restTransport({base,docRoot,token}),log:m=>console.log('·',m)});
 console.log(JSON.stringify({objetivo,receipt:result.receipt.status,verified:result.receipt.verified,assigned:result.assigned.length,skipped:(result.skipped||[]).length},null,2));
})().catch(e=>{console.error('DETENIDO:',e.message);process.exitCode=1;});
