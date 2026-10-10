/* V6 durable outbox. Local commit is authoritative for offline continuity.
 * Network capability is injected explicitly; this module has no default endpoint.
 */
(function(root){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const labels={local:'Guardado localmente',pending:'Pendiente de sincronización',sending:'Sincronizando',synced:'Sincronizado',conflict:'Conflicto: conservamos ambas versiones',error:'No se pudo sincronizar. Tu progreso sigue en este navegador.'};
 function create({store,storage,transport,identityProvider,now=Date.now,onStatus=()=>{},maxItems=64,maxBytes=6*1024*1024}){
  const C=root.HardwareLab.CheckpointsV5,owner=clone(store.context.identity),key='hwlab-v6:'+C.canonical([owner,store.context.profile]);
  let state={version:6,queue:[],heads:{},conflicts:{},archives:{}},blocked=false,busy=null,closed=false,kind='local';
  function status(k){if(k!=='error'&&Object.keys(state.conflicts).length)k='conflict';if(kind!==k){kind=k;onStatus({kind:k,text:labels[k]});}}
  function valid(r){return r&&C.validateCheckpoint(r,store.context,r.practice).ok;}
  function validAck(ack,r,archive=false){return ack?.status==='ack'&&ack.uid===owner.uid&&ack.profile===r.profile&&ack.practice===r.practice&&ack.attemptId===r.attemptId&&ack.revision===r.revision&&ack.canonical===C.canonical(r)&&Number.isSafeInteger(ack.serverRevision)&&ack.serverRevision>=(archive?0:1)&&ack.advancesHead===!archive;}
  try{const raw=storage.getItem(key);if(raw){const saved=JSON.parse(raw);if(saved.version!==6||!Array.isArray(saved.queue)||saved.queue.length>maxItems||!saved.heads||!saved.conflicts||saved.queue.some(x=>!valid(x.record)||!Number.isSafeInteger(x.tries)||x.tries<0||!Number.isFinite(x.due)))throw Error('Invalid outbox');state=saved;}}
  catch(_){blocked=true;status('error');} // Preserve corrupt bytes, never replace them.
  function identity(){return !closed&&C.canonical(identityProvider())===C.canonical(owner)&&owner.kind==='student'&&!!owner.uid;}
  function commit(next){if(blocked)return false;try{const raw=JSON.stringify(next);if(raw.length>maxBytes||next.queue.length>maxItems)throw Error('Outbox full');storage.setItem(key,raw);state=next;return true;}catch(_){status('error');return false;}}
  function enqueue(record,{archive=false}={}){
   if(!identity()||!valid(record)){status('local');return false;}
   if(blocked)return false;
   const canonical=C.canonical(record),head=state.heads[record.practice];
   if(archive&&record.status!=='complete')return false;
   if(archive&&state.archives?.[record.attemptId]===canonical)return true;
   if(head?.canonical===canonical&&!state.queue.some(x=>x.record.practice===record.practice)){status('synced');return true;}
   if(state.queue.some(x=>C.canonical(x.record)===canonical))return true;
   const same=state.queue.filter(x=>x.record.practice===record.practice&&x.record.attemptId===record.attemptId);
   if(same.some(x=>x.record.status==='complete')){status('conflict');return false;}
   // Preserve exact sent bytes until ACK; the server may have committed them.
   const next=clone(state),i=next.queue.findIndex(x=>x.record.practice===record.practice&&x.record.attemptId===record.attemptId&&!x.attempted);
   const item={record:clone(record),archive,tries:0,due:now()};if(i>=0)next.queue[i]=item;else next.queue.push(item);
   const ok=commit(next);if(ok)status('pending');return ok;
  }
  async function run(){
   if(!identity()||blocked||!transport)return false;
   for(let n=0;n<maxItems&&identity();n++){
    const item=state.queue.find((x,i,q)=>x.tries<5&&x.due<=now()&&!state.conflicts[x.record.practice]&&!q.slice(0,i).some(y=>y.record.practice===x.record.practice));if(!item)break;
    const r=clone(item.record),canonical=C.canonical(r),head=state.heads[r.practice];status('sending');
    try{
     const sent=clone(state);sent.queue.find(x=>C.canonical(x.record)===canonical).attempted=true;if(!commit(sent))return false;
     const ack=await transport.send({schemaVersion:6,catalogVersion:1,expectedServerRevision:head?.revision||0,checkpoint:r,...(item.archive?{archive:true}:{})});
     if(!identity())return false;
     if(ack?.status==='conflict'){
      if(ack.remote&&!valid(ack.remote.checkpoint))throw Error('Invalid conflict');
      const next=clone(state);next.conflicts[r.practice]={local:r,remote:ack.remote||null};if(!commit(next))return false;status('conflict');continue;
     }
     if(!validAck(ack,r,!!item.archive))throw Error('Invalid ACK');
     const next=clone(state);
     if(item.archive){next.archives=next.archives||{};next.archives[r.attemptId]=canonical;}
     else if(ack.serverRevision>=(next.heads[r.practice]?.revision||0))next.heads[r.practice]={revision:ack.serverRevision,canonical};
     next.queue=next.queue.filter(x=>C.canonical(x.record)!==canonical);
     if(!commit(next))return false;status(next.queue.length?'pending':'synced');
    }catch(_){
     if(!identity())return false;
     const next=clone(state),pending=next.queue.find(x=>C.canonical(x.record)===canonical);
     if(pending){pending.tries++;pending.due=now()+Math.min(60000,1000*2**pending.tries);if(!commit(next))return false;}
     status('error');break;
    }
   }
   return state.queue.length===0;
  }
  function pump(){if(busy)return busy;busy=run().finally(()=>{busy=null;});return busy;}
  async function prepare(){
   if(!identity()||blocked||!transport)return false;
   try{
    const remote=await transport.list(store.context.profile);if(!identity())return false;
    if(!Array.isArray(remote)||remote.length>64)throw Error('Invalid list');
    // Validate the entire response before installing any snapshot.
    if(remote.some(x=>x.uid!==owner.uid||x.profile!==store.context.profile||!Number.isSafeInteger(x.serverRevision)||x.serverRevision<1||!valid(x.checkpoint)))throw Error('Invalid remote');
    for(const entry of remote){
     const r=entry.checkpoint,p=r.practice;store.loadLocal('laptop',p);const local=store.inspect(p),canonical=C.canonical(r);
     const next=clone(state);
     // A lost response can be recovered only with the persisted receipt, never
     // by guessing that a similar remote snapshot acknowledges an upload.
     if(next.queue.some(x=>x.attempted&&C.canonical(x.record)===canonical)&&validAck(entry.ack,r)&&entry.ack.serverRevision===entry.serverRevision){
      next.heads[p]={revision:entry.serverRevision,canonical};next.queue=next.queue.filter(x=>C.canonical(x.record)!==canonical);
     }
     if(!local){if(!store.importRemote(r))throw Error('Local import unavailable');next.heads[p]={revision:entry.serverRevision,canonical};}
     else if(C.canonical(local)===canonical){next.heads[p]={revision:entry.serverRevision,canonical};}
     else if(next.heads[p]?.canonical!==canonical){next.conflicts[p]={local,remote:entry};}
     if(!commit(next))return false;
    }
    if(Object.keys(state.conflicts).length)status('conflict');else status(state.queue.length?'pending':'local');return true;
   }catch(_){status('error');return false;}
  }
  function reconnect(){const next=clone(state);next.queue.forEach(x=>{x.tries=0;x.due=now();});if(commit(next))return pump();return Promise.resolve(false);}
  return{enqueue,pump,prepare,reconnect,close(){closed=true;},get state(){return clone(state);},get status(){return{kind,text:labels[kind]};},get key(){return key;},get due(){if(blocked||!identity())return Infinity;return Math.min(...state.queue.filter((x,i,q)=>x.tries<5&&!state.conflicts[x.record.practice]&&!q.slice(0,i).some(y=>y.record.practice===x.record.practice)).map(x=>x.due));}};
 }
 root.HardwareLab.SyncV6={create,labels};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.HardwareLab.SyncV6;
})(typeof window!=='undefined'?window:globalThis);
