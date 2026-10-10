'use strict';
// Logical pipeline benchmark. No claim about WebGL, network latency or Firebase.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),{performance}=require('node:perf_hooks'),{pathToFileURL}=require('node:url');
const {createService,FileRepository}=require('./server/service.cjs'),fixtures=require('./server/fixtures.cjs');
const ROOT=path.resolve(__dirname,'..'),BASE=path.resolve(ROOT,'../portatil-v5-persistencia-20261005');
function load(root,sync=false){const box={window:{},console};vm.createContext(box);for(const n of ['tools','data_laptop','data_desktop','laptop_profiles','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','diagnosis_gaming','checkpoints_v5',...(sync?['sync_v6']:[])])vm.runInContext(fs.readFileSync(path.join(root,'js/hardware_lab_'+n+'.js'),'utf8'),box);return box.window.HardwareLab;}
function memory(){const map=new Map();let writes=0;return{get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem(k,v){writes++;map.set(k,String(v));},get bytes(){return [...map].reduce((n,[k,v])=>n+Buffer.byteLength(k+v),0);},get writes(){return writes;}};}
function summary(a){a.sort((x,y)=>x-y);return{median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};}
async function main(){
 const H5=load(BASE),H6=load(ROOT,true),{createProfileLayout}=await import(pathToFileURL(path.join(ROOT,'js/hardware_lab_3d_laptop_profiles.js'))),owner={kind:'student',user:'APRENDIZ_A',uid:'test-a'},temp=fs.mkdtempSync(path.join(os.tmpdir(),'v6-bench-'));const rows=[];
 try{for(const profile of ['standard','gaming']){
  const layout=createProfileLayout(profile),times={v5:[],v6Local:[],v6WithQueue:[]};let stats;
  for(let repeat=0;repeat<5;repeat++){
   const storage=memory(),store5=H5.CheckpointsV5.createLocalStore({profile,storage:memory(),identity:owner,screws:layout.screws}),store6=H6.CheckpointsV5.createLocalStore({profile,storage,identity:owner,screws:layout.screws});
   const api=await createService({repository:new FileRepository(path.join(temp,profile+repeat+'.json')),...fixtures});
   const sync=H6.SyncV6.create({store:store6,storage,identityProvider:()=>owner,transport:{send:e=>api.send('fixture-token-a',JSON.parse(JSON.stringify(e))),list:p=>api.list('fixture-token-a',p)}});
   const s=H6.Engine.createSession(H6.LaptopProfiles.get(profile).equipment,'disassembly-guided');
   const payload={...JSON.parse(JSON.stringify(H6.Engine.serialize(s))),attemptNonce:'benchmark',screws:Object.fromEntries(layout.screws.map(x=>[x.id,{installed:true,presented:false}])),thermal:H6.Thermal.createThermalState('used')};
   for(let i=0;i<40;i++){payload.errors=i;let t=performance.now();if(!store5.persist('laptop','disassembly-guided',payload))throw Error('V5 persist');const d5=performance.now()-t;
    t=performance.now();if(!store6.persist('laptop','disassembly-guided',payload))throw Error('V6 persist');const local=performance.now()-t;sync.enqueue(store6.inspect('disassembly-guided'));const full=performance.now()-t;
    if(i>=5){times.v5.push(d5);times.v6Local.push(local);times.v6WithQueue.push(full);}
   }
   const beforeBytes=storage.bytes,queueLength=sync.state.queue.length,heapBefore=process.memoryUsage().heapUsed,t=performance.now();await sync.pump();const syncMs=performance.now()-t;
   const other=H6.CheckpointsV5.createLocalStore({profile,storage:memory(),identity:owner,screws:layout.screws}),client=H6.SyncV6.create({store:other,storage:memory(),identityProvider:()=>owner,transport:{list:p=>api.list('fixture-token-a',p)}});
   const restoreStart=performance.now();if(!await client.prepare())throw Error('restore');const restoreMs=performance.now()-restoreStart;
   stats={logicalActions:40,snapshotBytes:Buffer.byteLength(JSON.stringify(store6.inspect('disassembly-guided'))),queueBefore:queueLength,queueAfter:sync.state.queue.length,storageBytesBefore:beforeBytes,storageBytesAfter:storage.bytes,localStorageWrites:storage.writes,remote:api.stats,syncMs,restoreMs,heapDelta:process.memoryUsage().heapUsed-heapBefore};
  }
  rows.push({profile,samplesPerPipeline:times.v5.length,v5LocalMs:summary(times.v5),v6LocalMs:summary(times.v6Local),v6LocalPlusQueueMs:summary(times.v6WithQueue),lastRepetition:stats});
 }}finally{fs.rmSync(temp,{recursive:true,force:true});}
 return{date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),method:'Node logical snapshots, five repetitions per profile, 40 commits each, first 5 discarded for timing. File gateway calls in process; no HTTP/Firebase. Queue flush after 40 actions.',status:'PASS',rows,browser:{status:'NOT TESTED',reason:'No comparable V5/V6 WebGL run; the loopback restriction has been resolved for emulator/API tests'},notMeasured:['FPS','ms/frame','page load','GPU resources','real network latency','Firebase emulator latency'],memoryLimit:'Single-operation heap delta, no GC control; does not prove absence of leaks'};
}
if(require.main===module)main().then(r=>process.stdout.write(JSON.stringify(r,null,2)+'\n')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={main};
