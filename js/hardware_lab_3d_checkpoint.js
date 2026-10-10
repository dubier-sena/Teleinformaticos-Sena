/* Browser lifecycle for the laptop-only local adapter. No render-loop work. */
import {createProfileLayout} from './hardware_lab_3d_laptop_profiles.js?v=20261009_1';
import {attachCloud} from './hardware_lab_cloud_v6.js?v=20261009_1';
let activeStore=null, listening=false, releaseLease=null, leaseGeneration=0, leaseDone=Promise.resolve();
function notice(text,warning=false){
  let el=document.getElementById('hwlab-checkpoint-notice');
  if(!el){el=document.createElement('p');el.id='hwlab-checkpoint-notice';el.className='hwlab-checkpoint-notice';el.setAttribute('role','status');document.querySelector('#hwlab-stage header')?.after(el);}
  el.textContent=text;el.dataset.warning=String(warning);el.hidden=!text;
}
function flush(){activeStore?.flush();}
function interactionReady(ready){
  const scene=document.getElementById('hwlab-scene');if(scene)scene.inert=!ready;
  for(const id of ['hwlab-restart-btn','hwlab-hint-btn']){const el=document.getElementById(id);if(el)el.disabled=!ready;}
}
export async function activateCheckpoint(store){
  if(activeStore) releaseCheckpoint(activeStore);
  activeStore=store;notice('');interactionReady(!store);
  if(!listening){window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});listening=true;}
  if(!store)return true;
  const generation=++leaseGeneration;
  await leaseDone;
  if (generation !== leaseGeneration) return false;
  if(!navigator.locks){notice('Este navegador no permite proteger la práctica entre pestañas. Usa un navegador compatible para continuar.',true);return false;}
  return new Promise(resolve=>{
    leaseDone=navigator.locks.request(store.key('__active_writer__'),{ifAvailable:true},async lock=>{
      if(generation!==leaseGeneration){resolve(false);return;}
      if(!lock){notice('Esta práctica está abierta en otra pestaña. Ciérrala allí y vuelve a elegir el modelo.',true);resolve(false);return;}
      const released=new Promise(release=>{releaseLease=release;});
      try{store.startCloud?.();await store.cloud?.prepare();}catch(_){notice('Tu progreso sigue guardado en este navegador.',true);}
      if(generation!==leaseGeneration){resolve(false);return;}
      interactionReady(true);resolve(true);await released;
    }).catch(()=>{notice('No se pudo proteger el guardado local. Vuelve a elegir la práctica.',true);resolve(false);});
  });
}
export function releaseCheckpoint(store){
  if(activeStore===store){store?.flush();store?.cloud?.dispose();activeStore=null;leaseGeneration++;releaseLease?.();releaseLease=null;notice('');interactionReady(true);}
}
export function createCheckpointStorage(profile){
  const C=window.HardwareLab.CheckpointsV5;
  if(!C)return null;
  let local=null;try{local=window.localStorage;}catch(_){}
  const store=C.createLocalStore({profile,screws:createProfileLayout(profile).screws,storage:local,identity:C.identityFromSession(),identityProvider:C.identityFromSession,canWrite:()=>activeStore===store&&!!releaseLease,
    legacyLoad:profile==='standard'?(e,p)=>window.HardwareLab.Storage.loadLocal(e,p):null,
    onStatus:s=>{if(activeStore===store&&['failed','blocked','identity','conflict','invalid'].includes(s.kind))notice(s.detail||'No se pudo guardar tu progreso.',true);}
  });
  // Menu adapters only read local state; attach network/listeners after the lease.
  store.startCloud=()=>{if(!store.cloud)attachCloud(store,local,C.identityFromSession);};
  return store;
}
export function recoveredNotice(store,saved){
  if(!store)return;
  const kind=store.status.kind;
  if(['failed','blocked','identity','conflict','invalid'].includes(kind)){notice(store.status.detail||'No se pudo guardar tu progreso.',true);return;}
  if(kind==='corrupt'||kind==='corrupt-legacy')notice('El progreso anterior no se pudo recuperar. Conservamos sus datos y abrimos una práctica segura.',true);
  else if(kind==='recovered-previous')notice('Se recuperó la última versión válida de tu progreso.',true);
  else notice(saved?(saved.result?'Se recuperó tu práctica terminada. Puedes revisarla o iniciar otra.':'Se recuperó tu progreso anterior.'):'Tu progreso se guarda en este navegador.');
}
export function confirmRestart(){return window.confirm('¿Reiniciar esta práctica? Se perderá su progreso actual. Las otras prácticas se conservarán.');}
