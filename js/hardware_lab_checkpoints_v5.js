/* Local-only logical checkpoints. One atomic localStorage value per commit.
 * Two alternating slots, monotonic revisions, owner-bound adapters, no network.
 * The checksum detects accidental damage; it is not an anti-cheat signature.
 */
(function(root){
  'use strict';
  const H=root.HardwareLab, SCHEMA=1, PRACTICE_VERSION=1, PREFIX='hwlab-checkpoint-v5:';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const ensure=(ok,message)=>{if(!ok)throw Error(message);};
  const integer=n=>Number.isSafeInteger(n)&&n>=0;
  const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
  function canonical(v){
    if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
    if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
    return JSON.stringify(v);
  }
  function logical(v,depth=0){
    ensure(depth<35,'Estructura demasiado profunda');
    if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return;
    if(typeof v==='number'){ensure(Number.isFinite(v),'Número no finito');return;}
    ensure(v&&typeof v==='object'&&(Array.isArray(v)||Object.prototype.toString.call(v)==='[object Object]'),'Objeto no lógico');
    for(const k of Object.keys(v)){ensure(!['__proto__','constructor','prototype'].includes(k),'Clave insegura');logical(v[k],depth+1);}
  }
  function checksum(v){let n=2166136261;for(const c of canonical(v)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return(n>>>0).toString(16);}
  function sign(r){const v={...r};delete v.checksum;delete v.camera;return checksum(v);}
  function identityFromSession(){
    let s=null;try{s=root.portalAuth?.getCurrentSession?.();}catch(_){}
    const u=s?.user;
    return u&&(u.usernameKey||u.username)?{kind:String(s.role||'user'),user:String(u.usernameKey||u.username),uid:u.uid?String(u.uid):null}:{kind:'guest',user:'local-device',uid:null};
  }
  function newAttemptId(){return root.crypto?.randomUUID?.()||'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
  function context(o){
    const p=H.LaptopProfiles.get(o.profile||'standard');ensure(p.equipment.id==='laptop','Solo portátil');
    const screws=o.screws.map(s=>({id:s.id,partId:s.partId})).sort((a,b)=>a.id.localeCompare(b.id));
    ensure(new Set(screws.map(s=>s.id)).size===screws.length,'Tornillo duplicado');
    ensure(screws.every(s=>own(p.equipment.parts,s.partId)),'Soporte desconocido');
    const identity=copy(o.identity||identityFromSession());logical(identity);
    ensure(typeof identity.user==='string'&&identity.user.length>0&&typeof identity.kind==='string','Identidad inválida');
    return{...o,profile:p.id,equipment:p.equipment,identity,screws,inventory:{parts:Object.keys(p.equipment.parts).sort(),screws}};
  }
  function keyFor(c,practice){return PREFIX+JSON.stringify([c.identity.kind,c.identity.user,c.identity.uid||null,'laptop',c.profile,practice]);}
  function attemptIdFor(c,practice,s){return canonical([c.identity,'laptop',c.profile,practice,s.startedAt||null,s.attemptNonce||'legacy']);}
  function uniqueIds(a,allowed,label){ensure(Array.isArray(a)&&new Set(a).size===a.length&&a.every(id=>allowed.includes(id)),'Referencias inválidas: '+label);}
  function thermal(t){
    ensure(t&&['dirty','loose','clean'].includes(t.dust)&&['old','residue','clean','new'].includes(t.paste),'Mantenimiento inválido');
    ensure(integer(t.mistakes)&&(t.paste==='new'?['insuficiente','adecuada','excesiva'].includes(t.amount):t.amount===null),'Cantidad térmica inválida');
  }
  function normalizeSession(payload,c,practice){
    logical(payload);const s=copy(payload),D=c.equipment,ids=c.inventory.parts,E=H.Engine,DE=H.DiagnosisEngine;
    if(practice==='evaluation-assignment'){
      const all=H.DiagnosisCases.evaluationScenarios('laptop',{advanced:true,profileId:c.profile}).map(x=>x.id);
      const allowed=id=>id===null||(typeof id==='string'&&!!H.DiagnosisCases.getCase('laptop',id,c.profile)?.evaluation);
      ensure(allowed(s.current)&&allowed(s.last),'Orden asignada inválida');uniqueIds(s.done,all.concat([s.current,s.last].filter(Boolean)),'órdenes');
      ensure(s.attemptNonce===undefined||(typeof s.attemptNonce==='string'&&s.attemptNonce.length>0&&s.attemptNonce.length<=200),'Identidad de orden inválida');
      return{current:s.current,done:s.done,last:s.last,...(s.attemptNonce?{attemptNonce:s.attemptNonce}:{})};
    }
    ensure(s.equipmentId==='laptop'&&(s.profileId||'standard')===c.profile,'Perfil incorrecto');
    ensure(s.parts&&canonical(Object.keys(s.parts).sort())===canonical(ids)&&ids.every(id=>typeof s.parts[id]==='boolean'),'Inventario de componentes incompatible');
    ensure(s.screws&&canonical(Object.keys(s.screws).sort())===canonical(c.screws.map(x=>x.id).sort()),'Inventario de tornillos incompatible');
    for(const e of c.screws){const v=s.screws[e.id];ensure(v&&typeof v.installed==='boolean'&&typeof v.presented==='boolean'&&!(v.installed&&v.presented),'Tornillo inválido');ensure(s.parts[e.partId]||(!v.installed&&!v.presented),'Tornillo sin soporte');}
    ensure(date(s.startedAt)&&(s.finishedAt===null||date(s.finishedAt))&&(!s.finishedAt||Date.parse(s.finishedAt)>=Date.parse(s.startedAt)),'Tiempos inválidos');
    ensure(integer(s.errors)&&s.errorsByType&&Object.values(s.errorsByType).every(integer),'Errores inválidos');
    ensure(s.hints&&integer(s.hints.used)&&integer(s.hints.max)&&s.hints.used<=s.hints.max,'Pistas inválidas');
    ensure(Array.isArray(s.actionLog)&&s.actionLog.length<=200&&s.actionLog.every(a=>!a.partId||ids.includes(a.partId)),'Historial inválido');
    thermal(s.thermal);
    if(practice.startsWith('diagnosis-')){
      const caseId=practice.slice(10),def=H.DiagnosisCases.getCase('laptop',caseId,c.profile);ensure(def&&s.caseId===caseId,'Caso incompatible');
      const pool=def.faultPool||[],idx=pool.findIndex(f=>f.variantId===s.variantId);ensure(!pool.length||idx>=0,'Variante desconocida');
      const initial=DE.createDiagnosisSession(D,def,{advanced:!!s.advanced,rng:()=> (idx+.1)/(pool.length||1)});
      for(const k of ['fixCondition','faultPartIds','damagedPartIds','relevantPartIds','evaluation','maintenanceRequired'])ensure(canonical(s[k])===canonical(initial[k]),'Caso alterado: '+k);
      ensure(canonical(DE.stagesOf(s).map(st=>st.fixCondition))===canonical(initial.stages.map(st=>st.fixCondition)),'Fallas alteradas');
      // Authored V4 fan cases repeat a relevant ID; exact case equality above
      // preserves that legacy data without accepting arbitrary duplicates.
      for(const k of ['faultPartIds','relevantPartIds'])ensure(s[k].every(id=>ids.includes(id)),'Referencia de caso desconocida');
      for(const k of ['damagedPartIds','unjustifiedReplacements','inspectedPartIds','unnecessaryPartIds'])uniqueIds(s[k]||[],ids,k);
      for(const m of [s.replaced,s.workEvidence?.removed||{},s.workEvidence?.reseated||{}])ensure(m&&Object.entries(m).every(([id,v])=>ids.includes(id)&&v===true),'Evidencia de pieza inválida');
      ensure(integer(s.hardwareRevision||0)&&integer(s.checkAttempts),'Revisión inválida');
      ensure(['apagado','falla','funcional'].includes(s.powerState),'POWER transitorio inválido');
      ensure(Array.isArray(s.instrumentRecords)&&s.instrumentRecords.length<=10000,'Instrumentos inválidos');
      for(const r of s.instrumentRecords){
        ensure(H.DiagnosticsV3.TOOLS.some(t=>t.id===r.tool)&&integer(r.revision)&&r.revision<=(s.hardwareRevision||0),'Lectura incompatible');uniqueIds(r.targets||[],ids,'canales');
        ensure(!r.target||ids.includes(r.target),'Canal desconocido');ensure(Array.isArray(r.lines)&&r.lines.every(x=>typeof x==='string')&&typeof r.measured==='boolean','Lectura inválida');
      }
      uniqueIds(s.verificationTools||[],H.DiagnosticsV3.TOOLS.map(t=>t.id),'instrumentos de verificación');
      ensure(!s.advanced||canonical(s.verificationTools)===canonical(initial.verificationTools),'Verificación alterada');
      ensure(!s.advanced||canonical(s.verificationTargets)===canonical(initial.verificationTargets),'Canales de verificación alterados');
      ensure(Array.isArray(s.hypotheses)&&s.hypotheses.every(h=>integer(h.stage)&&h.stage<initial.stages.length&&typeof h.answer==='string'&&typeof h.correct==='boolean'),'Hipótesis inválida');
      const secured=c.screws.every(x=>!s.parts[x.partId]||s.screws[x.id].installed);
      s.lastScrewsSecured=secured;
      s.fixed=!!s.fixed&&DE.isFixConditionMet(D,s)&&DE.equipmentReadyForPowerTest(D,s,{screwsSecured:secured}).ready&&(!s.advanced||H.DiagnosticsV3.verified(s));
      if(s.result){ensure(!!s.finishedAt,'Resultado sin finalización');s.result=DE.finish(s,{equipmentData:D,now:s.finishedAt}).result;s.result.trace=DE.diagnosisTrace(D,s);}
    }else{
      const m=/^(assembly|disassembly|maintenance)-(guided|free|evaluation)$/.exec(practice);ensure(m&&!(m[1]==='maintenance'&&m[2]!=='guided'),'Práctica desconocida');
      const mode=m[1]+(m[2]==='guided'?'-guided':'-open');ensure(s.mode===mode&&s.direction===m[1]&&s.kind===(m[2]==='guided'?'guided':'open'),'Modo incompatible');
      const restored=E.deserialize(D,s),sequence=restored.sequence;ensure(integer(s.stepIndex)&&s.stepIndex<=sequence.length,'Paso inválido');
      if(s.kind==='guided'){
        const expected={...(s.direction==='assembly'?D.initialStateAssembly:D.initialStateDisassembly)};
        sequence.slice(0,s.stepIndex).forEach(st=>{if(st.kind==='action')expected[st.partId]=E.ACTION_TARGET_PRESENT[st.action];});ensure(canonical(expected)===canonical(s.parts),'Paso y piezas no coinciden');
      }else ensure(integer(s.preIndex)&&s.preIndex<=restored._pre.length&&integer(s.postIndex)&&s.postIndex<=restored._post.length,'Seguridad inválida');
      if(s.result){ensure(s.finishedAt&&E.isFinished(restored),'Resultado sin práctica terminada');ensure(c.screws.every(x=>s.direction==='disassembly'?!s.screws[x.id].installed:s.screws[x.id].installed),'Resultado con tornillos pendientes');s.result=E.finish(restored,{now:s.finishedAt}).result;}
    }
    for(const id of ids)if(s.parts[id])for(const needed of D.parts[id].installRequires||[])ensure(s.parts[needed],'Dependencia física incompatible: '+id+'/'+needed);
    ensure(!s.finishedAt||!!s.result,'Finalización sin resultado');return s;
  }
  function validateCheckpoint(r,c,practice){
    try{
      // Camera is optional and never participates in progress validity.
      const checked={...r};delete checked.camera;logical(checked);
      ensure(r.schemaVersion===SCHEMA&&r.practiceVersion===PRACTICE_VERSION,'Versión desconocida');
      ensure(r.equipment==='laptop'&&r.profile===c.profile&&r.practice===practice&&canonical(r.owner)===canonical(c.identity),'Identidad incompatible');
      ensure(canonical(r.inventory)===canonical(c.inventory),'Catálogo incompatible');
      ensure(integer(r.revision)&&r.revision>0&&date(r.createdAt)&&date(r.updatedAt),'Metadatos inválidos');ensure(r.checksum===sign(r),'Integridad inválida');
      const session=normalizeSession(r.session,c,practice);ensure(r.status===(session.result?'complete':'active'),'Estado de finalización incompatible');
      ensure(r.attemptId===attemptIdFor(c,practice,session),'Intento incompatible');
      ensure(session.result ? r.completion&&r.completion.id===r.attemptId&&r.completion.type==='academic-completion'&&r.completion.profile===c.profile&&r.completion.practice===practice&&r.completion.delivery==='local-only'&&canonical(r.completion.owner)===canonical(c.identity) : r.completion===null,'Evento académico incompatible');
      return{ok:true,session};
    }catch(e){return{ok:false,reason:e.message};}
  }
  function restoreCheckpoint(r,c,p){const v=validateCheckpoint(r,c,p);return v.ok?{ok:true,session:v.session,camera:null}:v;}
  function migrateCheckpoint(r){return r?.schemaVersion===SCHEMA?{ok:true,record:r}:{ok:false,reason:'Versión sin migración conocida'};}
  function migrateLegacy(payload,c,practice){
    ensure(c.profile==='standard','Migración legacy solo estándar');if(practice==='evaluation-assignment')return normalizeSession(payload,c,practice);
    logical(payload);const diagnosis=practice.startsWith('diagnosis-');let s=diagnosis?H.DiagnosisEngine.deserialize(copy(payload),c.equipment):H.Engine.deserialize(c.equipment,copy(payload));
    s.profileId='standard';if(!s.thermal)s.thermal=H.Thermal.createThermalState(diagnosis?'serviced':s.direction==='assembly'?'new':'used');
    const screws={...s.screws};for(const x of c.screws)if(!own(screws,x.id))screws[x.id]={installed:!!s.parts[x.partId],presented:false};
    s={...(diagnosis?H.DiagnosisEngine.serialize(s):H.Engine.serialize(s)),attemptNonce:s.attemptNonce||'legacy',screws,thermal:s.thermal};return normalizeSession(s,c,practice);
  }
  function createLocalStore(options){
    const c=context(options),states=new Map();let lastStatus={kind:'ready'},writes=0;
    function status(kind,detail){lastStatus={kind,detail};options.onStatus?.(lastStatus);}
    function ownerMatches(){return !c.identityProvider||canonical(c.identityProvider())===canonical(c.identity);}
    const completedPrefix=PREFIX+'completed:'+JSON.stringify([c.identity.kind,c.identity.user,c.identity.uid||null,'laptop',c.profile])+':';
    function retainCompletion(record){
      if(!record?.completion)return true;
      try{
        const key=completedPrefix+record.attemptId,raw=JSON.stringify(record),previous=c.storage.getItem(key);
        ensure(previous===null||previous===raw,'La finalización conservada tiene otra versión.');
        if(previous===null)c.storage.setItem(key,raw);
        return true;
      }catch(_){status('failed','No se pudo conservar la práctica terminada. Libera espacio antes de reiniciarla.');return false;}
    }
    function quarantine(key,raw,reason){
      try{const k=key+':quarantine:'+checksum(raw);if(c.storage.getItem(k)===null)c.storage.setItem(k,JSON.stringify({reason,raw,at:new Date().toISOString()}));return true;}
      catch(_){status('blocked','No se pudo conservar el guardado dañado.');return false;}
    }
    function read(practice){
      const base=keyFor(c,practice),records=[];let damaged=false,blocked=false,exists=false;
      for(let slot=0;slot<2;slot++){
        const key=base+':'+slot;let raw;try{raw=c.storage.getItem(key);}catch(_){blocked=true;continue;}
        if(raw==null)continue;exists=true;
        try{ensure(raw.length<=2e6,'Checkpoint demasiado grande');const r=JSON.parse(raw),m=migrateCheckpoint(r);ensure(m.ok,m.reason);const v=validateCheckpoint(r,c,practice);ensure(v.ok,v.reason);records.push({record:r,session:v.session});}
        catch(e){damaged=true;if(!quarantine(key,raw,e.message))blocked=true;}
      }
      records.sort((a,b)=>b.record.revision-a.record.revision);
      if(records.length===2&&records[0].record.revision===records[1].record.revision&&records[0].record.checksum!==records[1].record.checksum){status('conflict','Dos versiones simultáneas de esta práctica; conservamos ambas.');return{record:null,blocked:true,exists:true,damaged:true};}
      return{...records[0],blocked,exists,damaged};
    }
    function loadLocal(equipment,practice){
      if(equipment!=='laptop'||!ownerMatches()){status('identity','La identidad cambió. Vuelve al menú para continuar.');return null;}
      const found=read(practice),state={record:found.record||null,blocked:found.blocked,pending:null};states.set(practice,state);
      if(found.record){status(found.blocked?'blocked':found.damaged?'recovered-previous':'restored',found.blocked?'Se recuperó progreso, pero no se puede guardar sin conservar antes los datos dañados.':undefined);return copy(found.session);}
      if(found.blocked){status('blocked','El almacenamiento local no está disponible.');return null;}
      if(!found.exists&&c.profile==='standard'&&c.legacyLoad){
        try{const old=c.legacyLoad(equipment,practice);if(old){const s=migrateLegacy(old,c,practice);state.pending=copy(s);status('migrated');return s;}}
        catch(e){status('corrupt-legacy',e.message);return null;}
      }
      status(found.damaged?'corrupt':'empty');return null;
    }
    function persist(equipment,practice,payload){
      if(c.canWrite&&!c.canWrite()){status('conflict','La práctica no tiene permiso de escritura en esta pestaña.');return false;}
      if(equipment!=='laptop'||!ownerMatches()){status('identity','La identidad cambió; no se atribuyó progreso a otra persona.');return false;}
      if(!states.has(practice))loadLocal(equipment,practice);const state=states.get(practice);if(!state||state.blocked)return false;
      let session;try{session=normalizeSession(payload,c,practice);}catch(e){status('invalid',e.message);return false;}
      state.pending=copy(session);const latest=read(practice);if(latest.blocked){state.blocked=true;return false;}
      if((latest.record?.checksum||null)!==(state.record?.checksum||null)){status('conflict','Esta práctica cambió en otra pestaña. Recárgala antes de continuar.');return false;}
      if(state.record&&canonical(state.record.session)===canonical(session)){state.pending=null;return true;}
      const now=new Date().toISOString(),attemptId=attemptIdFor(c,practice,session);
      if(state.record?.status==='complete'&&state.record.attemptId===attemptId){state.pending=null;status('invalid','La práctica ya terminó. Reinicia para crear un intento nuevo.');return false;}
      // A confirmed restart replaces recoverable progress, never its academic event.
      // Archive first: if this write fails, the completed checkpoint stays current.
      if(state.record?.attemptId!==attemptId&&!retainCompletion(state.record))return false;
      const r={schemaVersion:SCHEMA,practiceVersion:PRACTICE_VERSION,equipment:'laptop',profile:c.profile,practice,owner:c.identity,inventory:c.inventory,
        revision:(state.record?.revision||0)+1,attemptId,createdAt:state.record?.attemptId===attemptId?state.record.createdAt:now,updatedAt:now,status:session.result?'complete':'active',session,
        completion:session.result?{id:attemptId,type:'academic-completion',owner:c.identity,profile:c.profile,practice,delivery:'local-only'}:null};r.checksum=sign(r);
      try{c.storage.setItem(keyFor(c,practice)+':'+(r.revision%2),JSON.stringify(r));writes++;state.record=r;state.pending=null;status('saved');return true;}
      catch(_){status('failed','No se pudo guardar en este navegador. Conserva la página abierta y libera espacio.');return false;}
    }
    function flush(){let ok=true;for(const[p,s]of states)if(s.pending)ok=persist('laptop',p,s.pending)&&ok;return ok;}
    function pendingFor(identity){
      ensure(canonical(identity)===canonical(c.identity)&&ownerMatches()&&identity.kind==='student'&&typeof identity.uid==='string'&&identity.uid.length>0,'Propietario de exportación incompatible');
      const events=new Map(),practices=new Set(),scope=PREFIX+JSON.stringify([c.identity.kind,c.identity.user,c.identity.uid||null,'laptop',c.profile]).slice(0,-1)+',';
      function accept(r){const v=validateCheckpoint(r,c,r.practice);ensure(v.ok,v.reason);if(r.completion)events.set(r.attemptId,{event:r.completion,checkpoint:r});}
      // Export is an explicit local boundary, outside action/render handlers. Scan
      // only this owner's profile so a fresh adapter also finds earlier finishes.
      for(let i=0;i<c.storage.length;i++){
        const key=c.storage.key(i);
        if(key?.startsWith(completedPrefix)){accept(JSON.parse(c.storage.getItem(key)));continue;}
        if(!key?.startsWith(scope)||key.includes(':quarantine:')||!/:[01]$/.test(key))continue;
        const tuple=JSON.parse(key.slice(PREFIX.length,-2)),practice=tuple[5];
        ensure(Array.isArray(tuple)&&tuple.length===6&&typeof practice==='string'&&key.slice(0,-2)===keyFor(c,practice),'Clave de exportación incompatible');
        practices.add(practice);
      }
      // Use the same validation, quarantine and conflict rules as restoration.
      // A damaged sibling slot cannot hide an intact completion, but unavailable
      // quarantine, ambiguous revisions or no valid slot still abort export.
      for(const practice of practices){
        const found=read(practice);
        ensure(!found.blocked&&found.record,'No se pudo validar y conservar la práctica para exportar.');
        accept(found.record);
      }
      return [...events.values()].map(copy);
    }
    function importRemote(record){
      // V6 only: importing to an empty scope never overwrites local evidence.
      if(!ownerMatches()||(c.canWrite&&!c.canWrite()))return false;
      const v=validateCheckpoint(record,c,record?.practice);if(!v.ok)return false;
      const found=read(record.practice);if(found.exists||found.blocked)return false;
      try{c.storage.setItem(keyFor(c,record.practice)+':'+(record.revision%2),JSON.stringify(record));states.delete(record.practice);loadLocal('laptop',record.practice);return true;}
      catch(_){status('failed','No se pudo guardar el progreso recuperado.');return false;}
    }
    return{loadLocal,persist,flush,pendingFor,importRemote,context:c,key:p=>keyFor(c,p),inspect:p=>copy(states.get(p)?.record||null),get status(){return lastStatus;},get writes(){return writes;}};
  }
  H.CheckpointsV5={SCHEMA,PRACTICE_VERSION,PREFIX,createLocalStore,validateCheckpoint,migrateCheckpoint,migrateLegacy,restoreCheckpoint,normalizeSession,identityFromSession,newAttemptId,canonical,sign};
  if(typeof module!=='undefined'&&module.exports)module.exports=H.CheckpointsV5;
})(typeof window!=='undefined'?window:globalThis);
