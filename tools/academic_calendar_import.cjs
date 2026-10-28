'use strict';
// Controlled historical import. Pure planning plus an injected transport: it never chooses an endpoint,
// never overwrites existing data and never retries blindly. Only demo/emulator transports are wired in this repo.
const crypto=require('node:crypto');
const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?x.map(canonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]))):x;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const SESSION=/^sena_portal_calendar_fichas\/(\d{6,9})\/years\/(\d{4})\/sessions\/([a-zA-Z0-9_-]{1,120})$/;
function plan(prepared){
 if(!prepared||prepared.preparedOnly!==true||prepared.productionWrites!==0||!Array.isArray(prepared.documents)||!prepared.source?.sha256)throw Error('Paquete de importación no preparado ni verificado.');
 const documents=prepared.documents,byPath=new Map(documents.map(d=>[d.path,d]));
 if(byPath.size!==documents.length)throw Error('Destino duplicado; no importar.');
 if(documents.some(d=>!d.path||d.path.startsWith('/')||d.path.includes('//')||d.precondition?.exists!==false))throw Error('Ruta o precondición inválida; solo se crean documentos inexistentes.');
 const used=new Set(),groups=[],days=new Set();
 for(const s of documents.filter(d=>SESSION.test(d.path))){
  const [,ficha,year,id]=s.path.match(SESSION),prefix=s.path.replace(/\/sessions\/[^/]+$/,''),audit=byPath.get(s.path+'/audit/0'),day=byPath.get(prefix+'/days/'+s.data.date),note=byPath.get(prefix+'/notes/'+id);
  if(s.data.id!==id||s.data.ficha!==ficha||s.data.year!==Number(year))throw Error('Sesión fuera de su ruta: '+s.path);
  if(s.data.origin!=='legacy'||s.data.revision!==0)throw Error('La importación solo provisiona sesiones históricas en revisión 0.');
  // Every historical session travels with its append-only receipt, its occupied day and its internal note, in one atomic commit.
  if(!audit||!day||!note)throw Error('Sesión histórica sin recibo de auditoría, día ocupado o nota interna: '+s.path);
  const a=audit.data;
  if(a.revision!==0||a.before!==null||a.actor!==s.data.updatedBy||typeof a.reason!=='string'||!a.reason.trim()||a.mutationId!==s.data.mutationId||!equal(a.after,s.data)||a.notesBefore!==''||'at' in a)throw Error('El recibo de auditoría no coincide con la sesión: '+s.path);
  if(!equal(note.data,{sessionId:id,revision:0,observation:a.notesAfter}))throw Error('Nota interna inconsistente: '+note.path);
  if(day.data?.sessionId!==id||Object.keys(day.data).length!==1)throw Error('Día ocupado inconsistente: '+day.path);
  const key=prefix+'|'+s.data.date;if(days.has(key))throw Error('Dos sesiones históricas en la misma ficha y fecha: '+key);days.add(key);
  for(const d of [s,audit,day,note])used.add(d.path);groups.push([s,audit,day,note]);
 }
 const singles=documents.filter(d=>!used.has(d.path));
 if(singles.some(d=>/\/(sessions|days|notes)\//.test(d.path)))throw Error('Recibo, día o nota huérfanos; no importar.');
 return [...singles.map(d=>[d]),...groups];
}
async function run(prepared,{commit,read},{receiptPath=null,now=()=>new Date().toISOString()}={}){
 const steps=plan(prepared);
 const receipt={schemaVersion:1,operation:'historical-import',sourceHash:prepared.source.sha256,readTime:prepared.source.readTime??null,packageHash:sha(prepared.documents),
  integrity:prepared.integrity,documents:prepared.documents.length,steps:steps.length,startedAt:now(),written:0,alreadyPresent:0,verified:0,conflicts:[],status:'EN_PROCESO'};
 // The receipt is recorded for every terminal state, including stops, so the attempt stays auditable.
 const finish=async status=>{receipt.status=status;receipt.finishedAt=now();
  if(receiptPath){await commit([{path:receiptPath,data:receipt}]);if(!equal(await read(receiptPath),receipt))throw Error('Recibo de importación no verificado.');}
  return receipt;};
 for(const group of steps){
  let error=null;
  try{await commit(group.map(d=>({path:d.path,data:d.data})));receipt.written+=group.length;continue;}catch(e){error=e;}
  // Outcome unknown or rejected: decide only from what is stored now. Never overwrite, never retry.
  const current=await Promise.all(group.map(d=>read(d.path)));
  if(group.every((d,i)=>current[i]!==null&&equal(current[i],d.data))){receipt.alreadyPresent+=group.length;continue;}
  receipt.conflicts=group.filter((d,i)=>current[i]!==null&&!equal(current[i],d.data)).map(d=>d.path);
  receipt.error=String(error.message||error);
  return finish(error.code==='CONFLICT'||receipt.conflicts.length?'DETENIDA_CONFLICTO':'DETENIDA_NO_CONFIRMADA');
 }
 for(const d of prepared.documents){
  const stored=await read(d.path);
  if(stored===null||!equal(stored,d.data)){receipt.conflicts=[d.path];return finish('VERIFICACION_FALLIDA');}
  receipt.verified++;
 }
 return finish('COMPLETADA');
}
module.exports={plan,run,equal,sha};
