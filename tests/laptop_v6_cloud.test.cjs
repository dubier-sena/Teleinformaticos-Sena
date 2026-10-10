'use strict';
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const {createService,FileRepository}=require('../v6/server/service.cjs'),fixtures=require('../v6/server/fixtures.cjs');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'v6-contract-')),box={window:{},console};vm.createContext(box);
for(const n of ['tools','data_laptop','data_desktop','laptop_profiles','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','diagnosis_gaming','checkpoints_v5','sync_v6'])vm.runInContext(fs.readFileSync(path.join(root,'js/hardware_lab_'+n+'.js'),'utf8'),box);
const H=box.window.HardwareLab,C=H.CheckpointsV5,E=H.Engine,S=H.SyncV6,clone=x=>JSON.parse(JSON.stringify(x)),owner={kind:'student',user:'APRENDIZ_A',uid:'test-a'},layouts={};let index=0;
before(async()=>{const {createProfileLayout}=await import(pathToFileURL(path.join(root,'js/hardware_lab_3d_laptop_profiles.js')));for(const p of ['standard','gaming'])layouts[p]=createProfileLayout(p);});
after(()=>fs.rmSync(dir,{recursive:true,force:true})); // Only test-owned disposable temp data.
function memory(){const m=new Map();return{m,get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};}
function local(profile='standard',storage=memory(),identity=owner){return C.createLocalStore({profile,storage,identity,screws:layouts[profile].screws});}
function data(profile='standard',completed=false){
 const D=H.LaptopProfiles.get(profile).equipment;let s=E.createSession(D,'disassembly-guided');
 if(completed){while(!E.isFinished(s)){const step=E.currentStep(s),r=step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id);assert.equal(r.ok,true);s=r.session;}s=E.finish(s);}
 return{...clone(E.serialize(s)),attemptNonce:'v6-fixture',screws:Object.fromEntries(layouts[profile].screws.map(x=>[x.id,{installed:!!s.parts[x.partId],presented:false}])),thermal:s.thermal||H.Thermal.createThermalState('used')};
}
function record(profile='standard',completed=false){const a=local(profile);assert.equal(a.persist('laptop','disassembly-guided',data(profile,completed)),true,a.status.detail);return a.inspect('disassembly-guided');}
function envelope(r,rev=0){return{schemaVersion:6,catalogVersion:1,expectedServerRevision:rev,checkpoint:clone(r)};}
async function service(){const file=path.join(dir,`${++index}.json`),repository=new FileRepository(file);return{api:await createService({repository,...fixtures}),repository,file};}
function client(api,profile='standard',storage=memory(),opts={}){const store=local(profile,storage),transport={send:e=>api.send('fixture-token-a',clone(e)),list:p=>api.list('fixture-token-a',p)},sync=S.create({store,storage,identityProvider:()=>owner,transport,...opts});return{store,storage,sync};}
for(const profile of ['standard','gaming']){
 test('V6 '+profile+' transfers a validated snapshot between isolated stores without changing attempt',async()=>{
  const {api}=await service(),a=client(api,profile),b=client(api,profile),payload=data(profile);
  // This is a logical integration fixture, not a browser physical-action walkthrough.
  for(const x of layouts[profile].screws.filter(x=>x.partId==='bottom-cover'))payload.screws[x.id].installed=false;
  assert.equal(a.store.persist('laptop','disassembly-guided',payload),true);const r=a.store.inspect('disassembly-guided');
  a.sync.enqueue(r);await a.sync.pump();assert.equal(a.sync.status.kind,'synced');assert.equal(await b.sync.prepare(),true);
  assert.deepEqual(clone(b.store.loadLocal('laptop',r.practice)),clone(payload));assert.equal(b.store.inspect(r.practice).attemptId,r.attemptId);assert.equal(b.store.writes,0);
 });
 test('V6 '+profile+' ACK loss and repository restart produce one durable completion',async()=>{
  const {api,file}=await service(),r=record(profile,true);const first=await api.send('fixture-token-a',envelope(r));
  const restarted=await createService({repository:new FileRepository(file),...fixtures});const second=await restarted.send('fixture-token-a',envelope(r));
  assert.deepEqual(first,second);const summary=await restarted.tracking('fixture-token-instructor','TEST_A');assert.equal(summary.completions.length,1);assert.equal(summary.officialGrades.length,0);
  const altered=clone(r);altered.updatedAt=new Date(Date.parse(altered.updatedAt)+1000).toISOString();altered.checksum=C.sign(altered);
  await assert.rejects(restarted.send('fixture-token-a',envelope(altered,1)),/COMPLETED_IMMUTABLE/);
 });
 test('V6 '+profile+' stale and divergent devices preserve both snapshots',async()=>{
  const {api}=await service(),a=client(api,profile),b=client(api,profile);const payload=data(profile);a.store.persist('laptop','disassembly-guided',payload);a.sync.enqueue(a.store.inspect('disassembly-guided'));await a.sync.pump();await b.sync.prepare();
  const pa=clone(payload),pb=clone(payload);pa.errors=1;pb.errors=2;
  a.store.persist('laptop','disassembly-guided',pa);b.store.persist('laptop','disassembly-guided',pb);
  a.sync.enqueue(a.store.inspect('disassembly-guided'));b.sync.enqueue(b.store.inspect('disassembly-guided'));await a.sync.pump();await b.sync.pump();
  assert.equal(b.sync.status.kind,'conflict');assert.equal(b.store.inspect('disassembly-guided').session.errors,2);assert.equal((await api.list('fixture-token-a',profile))[0].checkpoint.session.errors,1);
  assert.equal((await api.tracking('fixture-token-instructor','TEST_A')).conflicts.length,1);
 });
 test('V6 '+profile+' offline outbox survives reconstruction then receives ACK',async()=>{
  const {api}=await service(),storage=memory();let clock=0;const a=client(api,profile,storage,{now:()=>clock,transport:{send:async()=>{throw Error('offline');}}});
  a.store.persist('laptop','disassembly-guided',data(profile));const r=a.store.inspect('disassembly-guided');a.sync.enqueue(r);await a.sync.pump();assert.equal(a.sync.status.kind,'error');
  clock=5000;const b=client(api,profile,storage,{now:()=>clock});await b.sync.pump();assert.equal(b.sync.state.queue.length,0);assert.equal(b.store.loadLocal('laptop',r.practice).attemptNonce,r.session.attemptNonce);assert.equal(b.sync.status.kind,'synced');
 });
}
for(const [name,alter,pattern] of [
 ['unknown version',e=>e.schemaVersion=7,/VERSION/],['extra uid',e=>e.uid='test-b',/ENVELOPE/],['extra ficha',e=>e.ficha='TEST_B',/ENVELOPE/],['extra role',e=>e.role='instructor',/ENVELOPE/],
 ['other owner',e=>e.checkpoint.owner.uid='test-b',/INVALID_CHECKPOINT/],['role escalation',e=>e.checkpoint.owner.kind='instructor',/INVALID_CHECKPOINT/],['profile swap',e=>e.checkpoint.profile='gaming',/INVALID_CHECKPOINT/],
 ['unknown practice',e=>e.checkpoint.practice='grades',/INVALID_CHECKPOINT/],['negative revision',e=>e.expectedServerRevision=-1,/REVISION/],['oversized',e=>e.checkpoint.session.padding='x'.repeat(720*1024),/SIZE/],
 ['score tampering',e=>{e.checkpoint.session.result.score=900;e.checkpoint.checksum=C.sign(e.checkpoint);},/RESULT_MISMATCH/],
 ['unknown catalog',e=>e.catalogVersion=2,/VERSION/],['invalid JSON data',e=>{e.checkpoint.session.screws={};e.checkpoint.checksum=C.sign(e.checkpoint);},/INVALID_CHECKPOINT/]
])test('V6 trust boundary rejects '+name,async()=>{const {api}=await service(),e=envelope(record('standard',name==='score tampering'));alter(e);await assert.rejects(api.send('fixture-token-a',e),pattern);assert.equal((await api.list('fixture-token-a','standard')).length,0);});
test('V6 server directory, not payload, determines identity, ficha and instructor scope',async()=>{
 const {api}=await service();await api.send('fixture-token-a',envelope(record()));assert.equal((await api.list('fixture-token-b','standard')).length,0);
 await assert.rejects(api.send('fixture-token-b',envelope(record())),/INVALID_CHECKPOINT/);await assert.rejects(api.send('forged-token',envelope(record())),/UNAUTHENTICATED/);
 await assert.rejects(api.tracking('fixture-token-a','TEST_A'),/FORBIDDEN/);await assert.rejects(api.tracking('fixture-token-instructor','TEST_B'),/FORBIDDEN/);
 const tracking=await api.tracking('fixture-token-instructor','TEST_A');assert.equal(tracking.heads[0].ficha,'TEST_A');assert.equal(tracking.academicWritesEnabled,false);
});
test('V6 simultaneous identical requests have exactly one server write',async()=>{const {api}=await service(),e=envelope(record());const a=await Promise.all(Array.from({length:12},()=>api.send('fixture-token-a',e)));assert.ok(a.every(x=>x.serverRevision===1));assert.equal(api.stats.writes,1);});
test('V6 no ACK is returned if persistence fails',async()=>{const api=await createService({repository:{transaction:()=>{throw Error('disk full');}},...fixtures});await assert.rejects(api.send('fixture-token-a',envelope(record())),/disk full/);});
test('V6 client rejects forged ACK and retains local checkpoint and outbox',async()=>{const {api}=await service(),a=client(api,'standard',memory(),{transport:{send:async()=>({status:'ack',uid:'test-b'})}});a.store.persist('laptop','disassembly-guided',data());a.sync.enqueue(a.store.inspect('disassembly-guided'));await a.sync.pump();assert.equal(a.sync.status.kind,'error');assert.equal(a.sync.state.queue.length,1);assert.ok(a.store.inspect('disassembly-guided'));});
test('V6 client keeps later action queued while an earlier revision is in flight',async()=>{
 const {api}=await service();let release;const a=client(api,'standard',memory(),{transport:{send:async e=>{await new Promise(r=>release=r);return api.send('fixture-token-a',clone(e));}}});
 const p=data();a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));const task=a.sync.pump();await Promise.resolve();p.errors=1;a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));release();
 await new Promise(r=>setImmediate(r));assert.equal(a.sync.state.queue.length,1);release();await task;assert.equal((await api.list('fixture-token-a','standard'))[0].checkpoint.session.errors,1);assert.equal(a.sync.state.queue.length,0);
});
test('V6 backoff stops after five failures and retains queue',async()=>{const {api}=await service();let clock=0,calls=0;const a=client(api,'standard',memory(),{now:()=>clock,transport:{send:async()=>{calls++;throw Error('offline');}}});a.sync.enqueue(record());for(let i=0;i<12;i++){await a.sync.pump();clock+=65000;}assert.equal(calls,5);assert.equal(a.sync.state.queue.length,1);});
test('V6 identity change during flight cannot apply ACK to new user',async()=>{const {api}=await service();let current=owner,release;const a=client(api,'standard',memory(),{identityProvider:()=>current,transport:{send:async e=>{await new Promise(r=>release=r);return api.send('fixture-token-a',clone(e));}}});a.sync.enqueue(record());const task=a.sync.pump();await Promise.resolve();current={kind:'student',user:'APRENDIZ_B',uid:'test-b'};release();await task;assert.equal(a.sync.state.queue.length,1);assert.equal(Object.keys(a.sync.state.heads).length,0);});
test('V6 corrupt outbox and queue overflow preserve original bytes and local commit',async()=>{
 const {api}=await service(),storage=memory(),a=client(api,'standard',storage,{maxItems:1});a.sync.enqueue(record());const r=record('standard',true);r.session.attemptNonce='new';r.attemptId=C.canonical([owner,'laptop',r.profile,r.practice,r.session.startedAt,'new']);r.completion.id=r.attemptId;r.checksum=C.sign(r);assert.equal(a.sync.enqueue(r),false);assert.equal(a.sync.state.queue.length,1);
 storage.setItem(a.sync.key,'{bad');const b=client(api,'standard',storage);assert.equal(b.sync.enqueue(record()),false);assert.equal(storage.getItem(b.sync.key),'{bad');
});
test('V6 remote import never overwrites a damaged slot or another identity',()=>{const storage=memory(),a=local('standard',storage),r=record();storage.setItem(a.key(r.practice)+':0','{corrupt');assert.equal(a.importRemote(r),false);assert.equal(storage.getItem(a.key(r.practice)+':0'),'{corrupt');const b=local('standard',memory(),{kind:'student',user:'APRENDIZ_B',uid:'test-b'});assert.equal(b.importRemote(r),false);});
test('V6 unchanged snapshots are deduplicated without queue writes',async()=>{const {api}=await service(),a=client(api),r=record();a.sync.enqueue(r);await a.sync.pump();const before=a.storage.getItem(a.sync.key);for(let i=0;i<100;i++)a.sync.enqueue(r);assert.equal(a.storage.getItem(a.sync.key),before);assert.equal(api.stats.writes,1);});
test('V6 lost ACK followed by another action replays exact prior bytes before new revision',async()=>{
 const {api}=await service();let clock=0,first=true;const a=client(api,'standard',memory(),{now:()=>clock,transport:{send:async e=>{const result=await api.send('fixture-token-a',clone(e));if(first){first=false;throw Error('response lost');}return result;}}});
 const p=data();a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));await a.sync.pump();
 p.errors=3;a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));assert.equal(a.sync.state.queue.length,2);await a.sync.pump();assert.equal(api.stats.writes,1);assert.equal(a.sync.due,2000);
 clock=2500;await a.sync.pump();assert.equal(a.sync.status.kind,'synced');assert.equal(api.stats.writes,2);assert.equal(api.stats.duplicates,1);assert.equal((await api.list('fixture-token-a','standard'))[0].checkpoint.session.errors,3);
});
test('V6 rejects remote list atomically when one member has another owner',async()=>{
 const good={uid:owner.uid,profile:'standard',serverRevision:1,checkpoint:record()},bad={...good,uid:'test-b'};
 const {api}=await service(),a=client(api,'standard',memory(),{transport:{list:async()=>[good,bad]}});
 assert.equal(await a.sync.prepare(),false);assert.equal(a.store.inspect('disassembly-guided'),null);
});
test('V6 local quota failure cannot fabricate sync success or delete the local checkpoint',async()=>{
 const {api}=await service(),a=client(api),p=data();a.store.persist('laptop','disassembly-guided',p);const r=a.store.inspect('disassembly-guided'),original=a.storage.setItem;
 a.storage.setItem=()=>{throw Error('quota');};assert.equal(a.sync.enqueue(r),false);assert.equal(api.stats.writes,0);assert.equal(a.store.inspect(r.practice).attemptId,r.attemptId);
 a.storage.setItem=original;assert.equal(a.sync.enqueue(r),true);await a.sync.pump();assert.equal(a.sync.status.kind,'synced');
});
test('V6 guest records are never reassigned or queued for a learner',async()=>{
 const {api}=await service(),guest={kind:'guest',user:'local-device',uid:null},storage=memory(),store=local('standard',storage,guest),sync=S.create({store,storage,identityProvider:()=>guest,transport:{send:e=>api.send('fixture-token-a',e)}});
 store.persist('laptop','disassembly-guided',data());assert.equal(sync.enqueue(store.inspect('disassembly-guided')),false);assert.equal(sync.due,Infinity);assert.equal(sync.state.queue.length,0);
});
test('V6 profile reads never return the other model',async()=>{const {api}=await service();await api.send('fixture-token-a',envelope(record('gaming')));assert.equal((await api.list('fixture-token-a','standard')).length,0);assert.equal((await api.list('fixture-token-a','gaming')).length,1);});
test('V6 evaluation assignment nonce survives remote import without score creation',async()=>{const {api}=await service(),a=client(api),b=client(api),p='evaluation-assignment';assert.equal(a.store.persist('laptop',p,{current:null,last:null,done:[],attemptNonce:'assignment-v6'}),true);a.sync.enqueue(a.store.inspect(p));await a.sync.pump();await b.sync.prepare();assert.equal(b.store.loadLocal('laptop',p).attemptNonce,'assignment-v6');assert.equal((await api.tracking('fixture-token-instructor','TEST_A')).completions.length,0);});
test('V6 instructor projection separates active snapshots, completions and proposals',async()=>{const {project}=require('../js/hardware_lab_tracking_v6.js'),{api}=await service();await api.send('fixture-token-a',envelope(record('standard')));await api.send('fixture-token-a',envelope(record('gaming',true)));const rows=project(await api.tracking('fixture-token-instructor','TEST_A'));assert.equal(rows.find(r=>r.profile==='standard').completed,0);assert.equal(rows.find(r=>r.profile==='gaming').completed,1);assert.ok(rows.every(r=>r.officialGrade===null));});
test('V6 real browser adapter attaches only after lease and removes online listener on every release',async()=>{
 const listeners=new Set(),nodes=new Map(),timers=new Map();let tid=0;
 function element(){return{dataset:{},setAttribute(){},after(el){nodes.set(el.id,el);},remove(){nodes.delete(this.id);}};}
 const window={HardwareLab:{...H,Storage:{loadLocal:()=>null}},HWLAB_V6_TEST:{endpoint:'/v6/checkpoints',token:'fixture-token-a'},localStorage:memory(),addEventListener:(k,f)=>{if(k==='online')listeners.add(f);},removeEventListener:(k,f)=>listeners.delete(f)};
 const sandbox={window,document:{getElementById:id=>nodes.get(id),createElement:element,querySelector:element,addEventListener(){}},navigator:{locks:{request:async(_k,_o,f)=>f({})}},createProfileLayout:p=>layouts[p],location:{hostname:'127.0.0.1',origin:'http://127.0.0.1:8796',href:'http://127.0.0.1:8796/laboratorio-virtual-hardware.html'},URL,AbortController,setTimeout:f=>{timers.set(++tid,f);return tid;},clearTimeout:id=>timers.delete(id),fetch:async()=>({ok:true,json:async()=>[]})};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'js/hardware_lab_cloud_v6.js'),'utf8').replace(/export /g,''),sandbox);
 vm.runInContext(fs.readFileSync(path.join(root,'js/hardware_lab_3d_checkpoint.js'),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'')+'\nthis.api={createCheckpointStorage,activateCheckpoint,releaseCheckpoint};',sandbox);
 for(let i=0;i<80;i++)sandbox.api.createCheckpointStorage('gaming');assert.equal(listeners.size,0);assert.equal(nodes.size,0);
 const store=sandbox.api.createCheckpointStorage('standard');
 for(let i=0;i<8;i++){assert.equal(await sandbox.api.activateCheckpoint(store),true);assert.equal(listeners.size,1);sandbox.api.releaseCheckpoint(store);assert.equal(listeners.size,0);assert.equal(timers.size,0);}
});
test('V6 reconstructs after lost ACK plus later offline action using persisted receipt',async()=>{
 const {api}=await service(),storage=memory();const a=client(api,'standard',storage,{transport:{send:async e=>{await api.send('fixture-token-a',clone(e));throw Error('ACK lost');}}});
 const p=data();a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));await a.sync.pump();p.errors=4;a.store.persist('laptop','disassembly-guided',p);a.sync.enqueue(a.store.inspect('disassembly-guided'));
 const b=client(api,'standard',storage);assert.equal(await b.sync.prepare(),true);assert.equal(Object.keys(b.sync.state.conflicts).length,0);await b.sync.pump();assert.equal(b.sync.state.queue.length,0);assert.equal((await api.list('fixture-token-a','standard'))[0].checkpoint.session.errors,4);assert.equal(api.stats.writes,2);
});
for(const profile of ['standard','gaming'])test('V6 '+profile+' archived completion never rewinds current attempt or server head',async()=>{
 const {api}=await service(),a=client(api,profile),old=record(profile,true);a.store.importRemote(old);a.sync.enqueue(old);await a.sync.pump();
 const fresh=data(profile);fresh.attemptNonce='new-attempt';a.store.persist('laptop',old.practice,fresh);a.sync.enqueue(a.store.inspect(old.practice));await a.sync.pump();assert.equal(a.sync.state.heads[old.practice].revision,2);
 // First exercise a late duplicate ACK from the original head operation.
 a.sync.enqueue(old);await a.sync.pump();assert.equal(a.sync.state.heads[old.practice].revision,2);
 const b=client(api,profile,a.storage);await b.sync.prepare();b.sync.enqueue(old,{archive:true});await b.sync.pump();assert.equal(b.sync.state.heads[old.practice].revision,2);
 fresh.errors=1;b.store.persist('laptop',old.practice,fresh);b.sync.enqueue(b.store.inspect(old.practice));await b.sync.pump();assert.equal(b.sync.status.kind,'synced');assert.equal((await api.list('fixture-token-a',profile))[0].checkpoint.attemptId,b.store.inspect(old.practice).attemptId);
 assert.equal((await api.tracking('fixture-token-instructor','TEST_A')).completions.length,1);
 const writes=api.stats.writes;b.sync.enqueue(old,{archive:true});await b.sync.pump();assert.equal(api.stats.writes,writes);
});
test('V6 uploading an unsent historical completion archives it without replacing active head',async()=>{
 const {api}=await service(),active=record(),finished=record('standard',true);await api.send('fixture-token-a',envelope(active));
 const ack=await api.send('fixture-token-a',{...envelope(finished,1),archive:true});assert.equal(ack.advancesHead,false);assert.equal((await api.list('fixture-token-a','standard'))[0].checkpoint.attemptId,active.attemptId);
 await assert.rejects(api.send('fixture-token-a',{...envelope(active,1),archive:true}),/ARCHIVE_REQUIRES_COMPLETION/);
});
test('V6 disabled learners and instructors are rejected by server directory',async()=>{
 const file=path.join(dir,`${++index}.json`),directory=clone(fixtures.directory);directory['test-a'].enabled=false;directory['test-instructor'].enabled=false;
 const api=await createService({repository:new FileRepository(file),verifyToken:fixtures.verifyToken,directory});await assert.rejects(api.list('fixture-token-a','standard'),/UNAUTHENTICATED/);await assert.rejects(api.tracking('fixture-token-instructor','TEST_A'),/UNAUTHENTICATED/);
 const rules=fs.readFileSync(path.join(root,'v6/emulators/firestore.rules'),'utf8');assert.match(rules,/function enabled\(\)[\s\S]*hwlabV6\.enabled == true/);assert.equal((rules.match(/allow read: if enabled\(\)/g)||[]).length,2); // Static guard; execution in emulator has its separate integration suite.
});
