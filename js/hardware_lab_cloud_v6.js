// Explicit fixture capability only. No production fallback or Firebase singleton.
export function attachCloud(store,storage,identityProvider){
 const portal=window.HardwareLab.FirebaseV6?.transport(store.context.identity);
 const config=portal||window.HWLAB_V6_TEST;
 if(!config||location.hostname!=='127.0.0.1'||!window.HardwareLab.SyncV6)return store;
 const endpoint=new URL(config.endpoint,location.href);
 if(endpoint.origin!==location.origin||endpoint.pathname!=='/v6/checkpoints')return store;
 let timer=null,disposed=false;const requests=new Set();
 const status=document.createElement('p');status.id='hwlab-sync-v6';status.className='hwlab-checkpoint-notice';status.setAttribute('role','status');status.textContent='Guardado localmente';
 document.querySelector('#hwlab-stage header')?.after(status);
 async function request(url,body){
  const abort=new AbortController();let rejectDeadline;
  const deadline=new Promise((_,reject)=>{rejectDeadline=reject;});
  const cancel=()=>{abort.abort();rejectDeadline(Error('Synchronization deadline or disposal'));};
  const timeout=setTimeout(cancel,2500);requests.add(cancel);
  const operation=(async()=>{
   const token=portal?await portal.token():config.token;
   if(abort.signal.aborted||disposed)throw Error('Synchronization cancelled');
   const response=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:body?JSON.stringify(body):undefined,signal:abort.signal,redirect:'error',cache:'no-store'});
   if(!response.ok)throw Error('Remote rejected');return await response.json();
  })();
  try{return await Promise.race([operation,deadline]);}
  finally{clearTimeout(timeout);requests.delete(cancel);}
 }
 const sync=window.HardwareLab.SyncV6.create({store,storage,identityProvider,transport:{send:e=>request(endpoint.href,e),list:profile=>request(endpoint.href+'?profile='+encodeURIComponent(profile))},onStatus:s=>{status.textContent=s.text;status.dataset.warning=String(['error','conflict'].includes(s.kind));}});
 function schedule(){clearTimeout(timer);if(!disposed&&Number.isFinite(sync.due))timer=setTimeout(async()=>{await sync.pump();schedule();},Math.max(50,sync.due-Date.now()));}
 const touched=new Set(),persist=store.persist.bind(store),flush=store.flush.bind(store);
 function enqueue(p){const record=store.inspect(p);if(record)sync.enqueue(record);schedule();}
 store.persist=(e,p,data)=>{touched.add(p);const ok=persist(e,p,data);if(ok)enqueue(p);return ok;};
 store.flush=()=>{const ok=flush();for(const p of touched)enqueue(p);return ok;};
 const online=()=>{sync.reconnect().finally(schedule);};window.addEventListener('online',online);
 store.cloud={async prepare(){await sync.prepare();try{for(const {checkpoint} of store.pendingFor(store.context.identity)){store.loadLocal('laptop',checkpoint.practice);const current=store.inspect(checkpoint.practice);sync.enqueue(checkpoint,{archive:current?.attemptId!==checkpoint.attemptId});}}catch(_){}schedule();},dispose(){disposed=true;for(const cancel of requests)cancel();clearTimeout(timer);window.removeEventListener('online',online);sync.close();status.remove();store.persist=persist;store.flush=flush;delete store.cloud;}};
 return store;
}
