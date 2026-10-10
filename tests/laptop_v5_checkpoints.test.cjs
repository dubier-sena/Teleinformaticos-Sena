'use strict';
const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url'),ROOT=path.resolve(__dirname,'..');
const box={window:{},console};vm.createContext(box);
for(const name of ['tools','data_laptop','data_desktop','laptop_profiles','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','diagnosis_gaming','checkpoints_v5'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js/hardware_lab_'+name+'.js'),'utf8'),box);
const H=box.window.HardwareLab,C=H.CheckpointsV5,E=H.Engine,DE=H.DiagnosisEngine,clone=v=>JSON.parse(JSON.stringify(v));
const owner={kind:'student',user:'fixture-a',uid:'fixture-uid-a'},layouts={};
function memory(){const map=new Map();return{map,get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
before(async()=>{const {createProfileLayout}=await import(pathToFileURL(path.join(ROOT,'js/hardware_lab_3d_laptop_profiles.js')));for(const p of ['standard','gaming'])layouts[p]=createProfileLayout(p);});
function store(profile='gaming',storage=memory(),extra={}){return C.createLocalStore({profile,screws:layouts[profile].screws,storage,identity:owner,...extra});}
function pack(profile,s,diagnosis=false){return {...clone(diagnosis?DE.serialize(s):E.serialize(s)),attemptNonce:s.attemptNonce||'fixture-attempt',screws:Object.fromEntries(layouts[profile].screws.map(e=>[e.id,{installed:!!s.parts[e.partId],presented:false}])),thermal:s.thermal||H.Thermal.createThermalState(s.direction==='assembly'?'new':'used')};}
const must=r=>{assert.equal(r.ok,true,r.message);return r.session};
for(const profile of ['standard','gaming']){
 test('V5 '+profile+' reconstructs every logical assembly/disassembly/maintenance point',()=>{
  const D=H.LaptopProfiles.get(profile).equipment,storage=memory();let points=0;
  for(const mode of ['disassembly-guided','assembly-guided','maintenance-guided','disassembly-open','assembly-open']){
   let s=E.createSession(D,mode),adapter=store(profile,storage);const practice=mode.replace('-open','-free');
   function roundtrip(){const data=pack(profile,s);assert.equal(adapter.persist('laptop',practice,data),true,adapter.status.detail);adapter=store(profile,storage);const restored=adapter.loadLocal('laptop',practice);assert.deepEqual(clone(restored),clone(data));s=E.deserialize(D,restored);points++;}
   roundtrip();
   if(s.kind==='guided')while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));roundtrip();}
   else{
    while(E.currentStep(s)?.kind==='safety')s=must(E.attemptSafetyStep(s,E.currentStep(s).id));
    for(const step of D.sequences[s.direction].filter(x=>x.kind==='action')){s=must(E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}));roundtrip();}
    while(!E.isFinished(s))s=must(E.attemptSafetyStep(s,E.currentStep(s).id));
   }
   s=E.finish(s);roundtrip();assert.equal(adapter.pendingFor(owner).filter(x=>x.event.practice===practice).length,1);assert.equal(adapter.writes,0,'restoring never emits completion');
  }
  assert.ok(points>100);
 });
 for(const def of H.DiagnosisCases.casesFor('laptop',profile).concat(H.DiagnosisCases.evaluationScenarios('laptop',{advanced:true,profileId:profile})))test('V5 '+profile+' preserves case '+def.id,()=>{
  const D=H.LaptopProfiles.get(profile).equipment,storage=memory(),adapter=store(profile,storage),practice='diagnosis-'+def.id;
  let s=DE.createDiagnosisSession(D,def,{advanced:true});
  const initial=pack(profile,s,true);assert.equal(adapter.persist('laptop',practice,initial),true,adapter.status.detail);
  s=DE.checkPowerOn(D,s,{screwsSecured:true}).session;
  if(DE.pendingQuestion(s))s=must(DE.answerDiagnosis(s,DE.subsystemOf(DE.stagesOf(s)[0])));
  s=must(H.DiagnosticsV3.run(D,s,'ram',DE));
  const payload=pack(profile,s,true);assert.equal(adapter.persist('laptop',practice,payload),true,adapter.status.detail);
  const other=store(profile,storage),restored=other.loadLocal('laptop',practice);
  assert.equal(restored.caseId,s.caseId);assert.equal(restored.variantId,s.variantId);assert.deepEqual(clone(restored.fixCondition),clone(s.fixCondition));assert.deepEqual(clone(restored.instrumentRecords),clone(s.instrumentRecords));assert.equal(other.pendingFor(owner).length,0);
 });
 for(const delay of [0,50,100,250,500])test('V5 '+profile+' immediate closure after confirmed screw '+delay+'ms',async()=>{
  const D=H.LaptopProfiles.get(profile).equipment,storage=memory(),adapter=store(profile,storage),practice='disassembly-guided',data=pack(profile,E.createSession(D,practice));
  assert.equal(adapter.persist('laptop',practice,data),true);
  const screw=layouts[profile].screws.find(s=>s.partId==='bottom-cover');data.screws[screw.id].installed=false;
  assert.equal(adapter.persist('laptop',practice,data),true);assert.equal(adapter.writes,2);
  await new Promise(r=>setTimeout(r,delay));
  const restored=store(profile,storage).loadLocal('laptop',practice);assert.equal(restored.screws[screw.id].installed,false);
 });
}
test('V5 deduplicates commits and isolates users/profiles/practices',()=>{
 const storage=memory(),a=store('standard',storage),b=store('gaming',storage),other=store('gaming',storage,{identity:{...owner,user:'fixture-b'}});
 for(const [adapter,profile] of [[a,'standard'],[b,'gaming'],[other,'gaming']])for(const practice of ['assembly-guided','disassembly-guided']){
  const s=pack(profile,E.createSession(H.LaptopProfiles.get(profile).equipment,practice));assert.equal(adapter.persist('laptop',practice,s),true,adapter.status.detail);assert.equal(adapter.persist('laptop',practice,s),true);
 }
 assert.equal(storage.map.size,6);assert.equal(a.writes,2);assert.equal(b.writes,2);assert.equal(other.writes,2);
});
test('V5 freezes identity and never exports another owner',()=>{
 const storage=memory();let identity=owner;const a=store('gaming',storage,{identityProvider:()=>identity});const p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 assert.equal(a.persist('laptop',p,s),true);identity={...owner,user:'fixture-b'};s.errors++;
 assert.equal(a.persist('laptop',p,s),false);assert.equal(a.writes,1);assert.throws(()=>a.pendingFor(identity));
});
test('V5 two tabs detect stale revisions even with equal timestamps',()=>{
 const storage=memory(),a=store('gaming',storage),b=store('gaming',storage),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 a.persist('laptop',p,s);b.loadLocal('laptop',p);s.errors++;a.persist('laptop',p,s);s.errors++;
 assert.equal(b.persist('laptop',p,s),false);assert.equal(b.status.kind,'conflict');assert.equal(store('gaming',storage).loadLocal('laptop',p).errors,1);
});
test('V5 quota failure retries last committed logical draft, without sampling animation',()=>{
 const storage=memory(),a=store('gaming',storage),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 a.persist('laptop',p,s);const write=storage.setItem;storage.setItem=()=>{throw Error('quota');};s.errors=1;
 assert.equal(a.persist('laptop',p,s),false);s.errors=99;storage.setItem=write;assert.equal(a.flush(),true);assert.equal(store('gaming',storage).loadLocal('laptop',p).errors,1);
});
test('V5 corrupt latest slot preserves evidence and restores previous revision',()=>{
 const storage=memory(),a=store('gaming',storage),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 a.persist('laptop',p,s);s.errors=1;a.persist('laptop',p,s);const key=a.key(p)+':0';storage.setItem(key,'{bad json');
 const b=store('gaming',storage);assert.equal(b.loadLocal('laptop',p).errors,0);assert.equal(b.status.kind,'recovered-previous');assert.equal(storage.getItem(key),'{bad json');assert.ok([...storage.map.keys()].some(k=>k.includes(':quarantine:')));
});
for(const [name,mutate] of [
 ['future schema',r=>r.schemaVersion=999],['wrong profile',r=>r.profile='standard'],['wrong practice',r=>r.practice='assembly-guided'],['wrong inventory',r=>r.inventory.parts.push('imaginary')],['duplicate screw',r=>r.inventory.screws.push(r.inventory.screws[0])],
 ['unknown component',r=>r.session.parts.fake=true],['unknown screw',r=>r.session.screws.fake={installed:true,presented:false}],['impossible number',r=>r.session.errors=-1],['NaN',r=>r.session.errors=NaN],['step mismatch',r=>r.session.stepIndex=14],['physical mismatch',r=>r.session.parts.motherboard=false],['invalid thermal',r=>r.session.thermal.amount='mucho'],['function',r=>r.session.timer=()=>{}]
])test('V5 rejects '+name,()=>{
 const a=store(),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));a.persist('laptop',p,s);const r=a.inspect(p);mutate(r);r.checksum=C.sign(r);assert.equal(C.validateCheckpoint(r,a.context,p).ok,false);
});
test('V5 invalid optional camera does not invalidate progress',()=>{
 const a=store(),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));a.persist('laptop',p,s);const r=a.inspect(p);r.camera={position:[NaN,Infinity,0]};assert.equal(C.restoreCheckpoint(r,a.context,p).ok,true);assert.equal(C.restoreCheckpoint(r,a.context,p).camera,null);
});
test('V5 imports legacy standard locally and retains original snapshot',()=>{
 const storage=memory(),D=H.LaptopProfiles.get('standard').equipment,p='disassembly-guided';let s=E.createSession(D,p);s=must(E.attemptSafetyStep(s,E.currentStep(s).id));const legacy=pack('standard',s),before=JSON.stringify(legacy);
 const a=store('standard',storage,{legacyLoad:()=>legacy});assert.equal(a.loadLocal('laptop',p).stepIndex,1);assert.equal(a.status.kind,'migrated');assert.equal(JSON.stringify(legacy),before);assert.equal(a.writes,0); // Migration reads do not compete with an active tab.
 assert.equal(a.persist('laptop',p,a.loadLocal('laptop',p)),true);assert.equal(a.writes,1);
});

for(const profile of ['standard','gaming'])test('V5 '+profile+' repairs, maintenance, double fault and finalization survive every boundary',()=>{
 const D=H.LaptopProfiles.get(profile).equipment,def=H.DiagnosisCases.getCase('laptop',profile==='gaming'?'eval-gaming-1':'eval-v3-s1',profile),storage=memory(),p='diagnosis-'+def.id;
 let s=DE.createDiagnosisSession(D,def),adapter=store(profile,storage),snapshots=0;
 function roundtrip(){const payload=pack(profile,s,true);assert.equal(adapter.persist('laptop',p,payload),true,adapter.status.detail);adapter=store(profile,storage);s=adapter.loadLocal('laptop',p);assert.ok(s,adapter.status.detail);assert.equal(s.caseId,def.id);snapshots++;}
 function action(id,install=false){s=must(DE.attemptAction(D,s,{partId:id,action:D.parts[id].kind==='cable'?(install?'connect':'disconnect'):(install?'install':'remove'),toolId:D.parts[id].tool}));roundtrip();}
 function repair(cond){
  const removed=[];function remove(id){if(!s.parts[id])return;for(const dep of D.parts[id].removeRequires)remove(dep);action(id);removed.push(id);}
  remove('bottom-cover');remove('cable-battery');if(cond.partId)remove(cond.partId);
  if(cond.type==='replaced'){s=must(DE.replacePart(D,s,cond.partId));roundtrip();}
  if(!H.Thermal.isReady(s.thermal)){remove('cooler');for(const task of ['brush','air','scrape','alcohol','apply']){s=must(DE.applyThermalTask(D,s,task,{amount:'adecuada'}));const t=clone(s.thermal);roundtrip();assert.deepEqual(clone(s.thermal),t);}}
  for(const id of removed.reverse())action(id,true);
 }
 roundtrip();const faults=clone(s.stages);
 for(let i=0;i<faults.length;i++){
  s=DE.checkPowerOn(D,s).session;s=must(DE.answerDiagnosis(s,DE.subsystemOf(s.stages[i])));for(const tool of s.verificationTools)s=must(H.DiagnosticsV3.run(D,s,tool,DE));roundtrip();repair(faults[i].fixCondition);
  s=DE.checkPowerOn(D,s,{screwsSecured:true}).session;roundtrip();if(i===0){assert.equal(DE.stageProgress(D,s).fixed,1);assert.equal(s.fixed,false);assert.equal(s.result,null);}
 }
 for(const tool of s.verificationTools)s=must(H.DiagnosticsV3.run(D,s,tool,DE));roundtrip();s=DE.checkPowerOn(D,s,{screwsSecured:true}).session;assert.equal(s.fixed,true);s=DE.finish(s,{equipmentData:D});roundtrip();
 const record=adapter.inspect(p),result=clone(s.result);assert.equal(s.result.status,'APROBADO');
 for(let i=0;i<5;i++){roundtrip();assert.equal(adapter.inspect(p).revision,record.revision);assert.deepEqual(clone(s.result),result);assert.equal(adapter.pendingFor(owner).length,1);}
 assert.ok(snapshots>=35);
});
test('V5 12 gamer screws restore exactly as 12 removed / 21 installed',()=>{
 const storage=memory(),a=store('gaming',storage),D=H.LaptopProfiles.get('gaming').equipment,p='disassembly-free';let s=E.createSession(D,'disassembly-open');
 while(E.currentStep(s)?.kind==='safety')s=must(E.attemptSafetyStep(s,E.currentStep(s).id));
 const payload=pack('gaming',s);for(const screw of layouts.gaming.screws.slice(0,12))payload.screws[screw.id].installed=false;
 assert.equal(a.persist('laptop',p,payload),true,a.status.detail);const recovered=store('gaming',storage).loadLocal('laptop',p);
 assert.equal(Object.values(recovered.screws).filter(s=>!s.installed).length,12);assert.equal(Object.values(recovered.screws).filter(s=>s.installed).length,21);
});
test('V5 restarting one practice cannot erase another model, practice or owner',()=>{
 const storage=memory(),a=store('standard',storage),b=store('gaming',storage),p='disassembly-guided';
 const old=pack('standard',E.createSession(H.LaptopProfiles.get('standard').equipment,p));old.errors=3;a.persist('laptop',p,old);
 const untouched=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));b.persist('laptop',p,untouched);
 a.persist('laptop','assembly-guided',pack('standard',E.createSession(H.LaptopProfiles.get('standard').equipment,'assembly-guided')));
 const before=clone([...storage.map.entries()].filter(([key])=>!key.startsWith(a.key(p)+':')));
 const fresh=pack('standard',E.createSession(H.LaptopProfiles.get('standard').equipment,p));fresh.attemptNonce='new-confirmed-attempt';a.persist('laptop',p,fresh);
 assert.deepEqual([...storage.map.entries()].filter(([key])=>!key.startsWith(a.key(p)+':')),before);assert.equal(store('standard',storage).loadLocal('laptop',p).errors,0);
});
test('V5 unknown schema and both corrupt slots retain evidence while new safe state can save',()=>{
 const storage=memory(),a=store(),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 // The adapter under test must use this backing store.
 const writer=store('gaming',storage);writer.persist('laptop',p,s);let r=writer.inspect(p);r.schemaVersion=5;r.checksum=C.sign(r);storage.setItem(writer.key(p)+':1',JSON.stringify(r));storage.setItem(writer.key(p)+':0','invalid');
 const fresh=store('gaming',storage);assert.equal(fresh.loadLocal('laptop',p),null);assert.equal(fresh.status.kind,'corrupt');assert.equal(fresh.persist('laptop',p,s),true);
 assert.equal([...storage.map.keys()].filter(k=>k.includes('quarantine')).length,2);
});
test('V5 equal revision conflict is preserved, not ordered by wall clock',()=>{
 const storage=memory(),a=store('gaming',storage),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));a.persist('laptop',p,s);
 const r=a.inspect(p);r.session.errors=8;r.checksum=C.sign(r);storage.setItem(a.key(p)+':0',JSON.stringify(r));
 const b=store('gaming',storage);assert.equal(b.loadLocal('laptop',p),null);assert.equal(b.persist('laptop',p,s),false);assert.equal(storage.map.size,2);
});
test('V5 corrupt snapshot is never overwritten when quarantine hits quota',()=>{
 const storage=memory(),a=store('gaming',storage),p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));storage.setItem(a.key(p)+':1','corrupt');storage.setItem=()=>{throw Error('quota');};
 assert.equal(a.loadLocal('laptop',p),null);assert.equal(a.persist('laptop',p,s),false);assert.equal(storage.getItem(a.key(p)+':1'),'corrupt');
});
test('V5 migrates the 18-part legacy standard without changing its source',()=>{
 const D=H.LaptopProfiles.get('standard').equipment,p='disassembly-guided',s=pack('standard',E.createSession(D,p));
 for(const id of D.sessionAddedParts)delete s.parts[id];delete s.screws;delete s.attemptNonce;const original=JSON.stringify(s),a=store('standard',memory(),{legacyLoad:()=>s});
 const result=a.loadLocal('laptop',p);assert.ok(result,a.status.detail);assert.equal(Object.keys(result.parts).length,22);assert.equal(Object.keys(result.screws).length,25);assert.equal(JSON.stringify(s),original);
});
test('V5 evaluation assignment retains completed order until explicit next request',()=>{
 const storage=memory(),a=store('gaming',storage),p='evaluation-assignment',data={current:'eval-gaming-3',done:['eval-gaming-3'],last:'eval-gaming-3'};
 assert.equal(a.persist('laptop',p,data),true);assert.deepEqual(clone(store('gaming',storage).loadLocal('laptop',p)),data);assert.equal(a.pendingFor(owner).length,0);
});
function browserFixture(storage,locks){
 const nodes=new Map(),events=new Map(),docEvents=new Map();
 const make=()=>({dataset:{},setAttribute(){},after(el){nodes.set(el.id,el);}});
 for(const id of ['hwlab-scene','hwlab-restart-btn','hwlab-hint-btn'])nodes.set(id,make());
 const document={getElementById:id=>nodes.get(id),querySelector:()=>make(),createElement:make,addEventListener:(event,fn)=>docEvents.set(event,fn),visibilityState:'visible'};
 const window={HardwareLab:{...H,Storage:{loadLocal:()=>null}},localStorage:storage,addEventListener:(event,fn)=>events.set(event,fn),confirm:()=>true};
 const sandbox={window,document,navigator:{locks},createProfileLayout:p=>layouts[p]};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'js/hardware_lab_cloud_v6.js'),'utf8').replace(/export /g,''),sandbox);
 let source=fs.readFileSync(path.join(ROOT,'js/hardware_lab_3d_checkpoint.js'),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'');
 vm.runInContext(source+'\nthis.api={createCheckpointStorage,activateCheckpoint,releaseCheckpoint,recoveredNotice};',sandbox);
 return {...sandbox,events,docEvents,nodes};
}
function lockManager(){const held=new Set();return{request:async(name,opts,callback)=>{if(held.has(name))return callback(null);held.add(name);try{return await callback({name});}finally{held.delete(name);}}};}
test('V5 browser lock prevents simultaneous writes and transfers ownership on release',async()=>{
 const storage=memory(),locks=lockManager(),a=browserFixture(storage,locks),b=browserFixture(storage,locks),sa=a.api.createCheckpointStorage('gaming'),sb=b.api.createCheckpointStorage('gaming');
 assert.equal(await a.api.activateCheckpoint(sa),true);assert.equal(await b.api.activateCheckpoint(sb),false);assert.equal(b.nodes.get('hwlab-scene').inert,true);
 const p='disassembly-guided',s=pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,p));
 assert.equal(sa.persist('laptop',p,s),true);assert.equal(sb.persist('laptop',p,s),false);
 a.api.releaseCheckpoint(sa);await new Promise(r=>setImmediate(r));assert.equal(await b.api.activateCheckpoint(sb),true);assert.equal(b.nodes.get('hwlab-scene').inert,false);assert.ok(sb.loadLocal('laptop',p));
 b.api.releaseCheckpoint(sb);
});
test('V5 pagehide and visibility flush only the accepted draft with one listener after 80 switches',async()=>{
 const storage=memory(),browser=browserFixture(storage,lockManager()),p='disassembly-guided';let last;
 for(let i=0;i<80;i++){
  const profile=i%2?'gaming':'standard',s=browser.api.createCheckpointStorage(profile);assert.equal(await browser.api.activateCheckpoint(s),true);last=s;
  const data=pack(profile,E.createSession(H.LaptopProfiles.get(profile).equipment,p));data.attemptNonce='cycle-'+i;assert.equal(s.persist('laptop',p,data),true);
  browser.api.releaseCheckpoint(s);
 }
 assert.equal(browser.events.size,1);assert.equal(browser.docEvents.size,1);
 assert.equal(await browser.api.activateCheckpoint(last),true);const data=last.loadLocal('laptop',p),set=storage.setItem;storage.setItem=()=>{throw Error('quota');};data.errors=3;assert.equal(last.persist('laptop',p,data),false);data.errors=100;
 storage.setItem=set;browser.document.visibilityState='hidden';browser.docEvents.get('visibilitychange')();browser.events.get('pagehide')();assert.equal(last.loadLocal('laptop',p).errors,3);browser.api.releaseCheckpoint(last);
});
test('V5 unsupported browser locking cannot silently accept unsaved actions',async()=>{
 const b=browserFixture(memory(),null),s=b.api.createCheckpointStorage('gaming');assert.equal(await b.api.activateCheckpoint(s),false);assert.equal(b.nodes.get('hwlab-scene').inert,true);
 assert.equal(s.persist('laptop','disassembly-guided',pack('gaming',E.createSession(H.LaptopProfiles.get('gaming').equipment,'disassembly-guided'))),false);
 b.api.releaseCheckpoint(s);
});

for(const profile of ['standard','gaming'])test('V5 '+profile+' retains completed academic events across restart and fresh adapters',()=>{
 const storage=memory(),D=H.LaptopProfiles.get(profile).equipment,p='disassembly-guided';let s=E.createSession(D,p);
 while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}
 s=E.finish(s);const a=store(profile,storage),finished=pack(profile,s);assert.equal(a.persist('laptop',p,finished),true,a.status.detail);
 const event=a.pendingFor(owner)[0];let fresh=pack(profile,E.createSession(D,p));fresh.attemptNonce='next-confirmed-attempt';
 assert.equal(a.persist('laptop',p,fresh),true);fresh.errors=1;assert.equal(a.persist('laptop',p,fresh),true);
 const recovered=store(profile,storage);assert.deepEqual(clone(recovered.pendingFor(owner)),[clone(event)]);assert.equal(recovered.loadLocal('laptop',p).errors,1);
 assert.equal([...storage.map.keys()].filter(k=>k.includes(':completed:')).length,1);
 const other=store(profile,storage,{identity:{...owner,user:'fixture-other'}});assert.equal(other.pendingFor({...owner,user:'fixture-other'}).length,0);
});
test('V5 archive quota cannot overwrite a completed checkpoint during restart',()=>{
 const storage=memory(),D=H.LaptopProfiles.get('gaming').equipment,p='disassembly-guided';let s=E.createSession(D,p);
 while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}
 const a=store('gaming',storage);a.persist('laptop',p,pack('gaming',E.finish(s)));const before=a.inspect(p),set=storage.setItem;
 storage.setItem=(k,v)=>{if(k.includes(':completed:'))throw Error('quota');set(k,v);};
 const fresh=pack('gaming',E.createSession(D,p));fresh.attemptNonce='restart';assert.equal(a.persist('laptop',p,fresh),false);assert.equal(a.inspect(p).checksum,before.checksum);assert.equal(store('gaming',storage).loadLocal('laptop',p).result.status,before.session.result.status);
 storage.setItem=set;assert.equal(a.flush(),true);assert.equal(store('gaming',storage).pendingFor(owner).length,1);
});

for(const profile of ['standard','gaming'])test('V5 '+profile+' completed results are immutable within the same attempt',()=>{
 const D=H.LaptopProfiles.get(profile).equipment,p='disassembly-guided',a=store(profile);let s=E.createSession(D,p);
 while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}
 const completed=pack(profile,E.finish(s));assert.equal(a.persist('laptop',p,completed),true);const before=clone(a.inspect(p));
 const edited=clone(completed);edited.hints.used=1;
 assert.equal(a.persist('laptop',p,edited),false);assert.deepEqual(clone(a.inspect(p)),before);assert.equal(a.flush(),true);assert.deepEqual(clone(a.inspect(p)),before);
 assert.equal(a.persist('laptop',p,completed),true);assert.equal(a.writes,1,'same completion is still idempotent');
});

test('V5 completed assembly controller ignores hints, thermal tasks and physical actions',()=>{
 const D=H.LaptopProfiles.get('standard').equipment,p='disassembly-guided';let s=E.createSession(D,p);
 while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}s=E.finish(s);
 const sandbox={window:box.window,console};vm.createContext(sandbox);
 let source=fs.readFileSync(path.join(ROOT,'js/hardware_lab_3d_controller.js'),'utf8').replace(/^import .*$/mg,'').replace('export function','function');
 source=source.replace('return { start };','return { start, onHint, onThermalTask, handlePartClick, handleScrewClick, attemptSafety, bind(s){session=s;checkpointStore={};}, snapshot(){return session;} };');
 vm.runInContext(source+'\nthis.factory=createAssemblyController;',sandbox);
 const ctl=sandbox.factory(new Proxy({},{get:()=>()=>{throw Error('Completed attempt must not invoke mutating UI');}}));ctl.bind(clone(s));const before=JSON.stringify(ctl.snapshot());
 ctl.onHint();ctl.onThermalTask('brush');ctl.handlePartClick('battery');ctl.handleScrewClick('cover-1');ctl.attemptSafety('power-off');assert.equal(JSON.stringify(ctl.snapshot()),before);
});

for(const profile of ['standard','gaming'])test('V5 '+profile+' a second evaluation round starts a new durable attempt and F5 resumes it',async()=>{
 const storage=memory(),a=store(profile,storage),D=H.LaptopProfiles.get(profile).equipment,defs=H.DiagnosisCases.evaluationScenarios('laptop',{advanced:true,profileId:profile});
 for(const def of defs){const old=pack(profile,DE.finish(DE.createDiagnosisSession(D,def,{advanced:true}),{equipment:D}),true);old.attemptNonce='old-'+def.id;assert.equal(a.persist('laptop','diagnosis-'+def.id,old),true,a.status.detail);}
 assert.equal(a.persist('laptop','evaluation-assignment',{current:null,done:defs.map(x=>x.id),last:defs.at(-1).id}),true);
 const sandbox={window:box.window,console,createCheckpointStorage:()=>a,activateCheckpoint:async()=>true,createProfileLayout:()=>({})};vm.createContext(sandbox);
 let source=fs.readFileSync(path.join(ROOT,'js/hardware_lab_3d_diagnosis_controller.js'),'utf8').replace(/^import .*$/mg,'').replace('export function','function');
 source=source.replace('    showCaseMenu,','    bind(){equipmentId="laptop";profileId="'+profile+'";checkpointStore=createCheckpointStorage();}, assignedScenario, closeAssignedScenario,\n    showCaseMenu,');
 vm.runInContext(source+'\nthis.factory=createDiagnosisController;',sandbox);
 const stage={showStage:()=>true,loadRig(){},setInspectionCatalog(){},setRigCleanup(){},currentRig:{syncFromSessionParts(){throw Error('STOP_AFTER_REAL_SESSION_RESTORE');}}};
 const ctl=sandbox.factory(stage);ctl.bind();const id=ctl.assignedScenario(()=>0),assignment=a.loadLocal('laptop','evaluation-assignment');assert.ok(assignment.attemptNonce);
 const old=a.inspect('diagnosis-'+id);await assert.rejects(ctl.startCase(id,{evaluation:true}),/STOP_AFTER_REAL_SESSION_RESTORE/);
 let fresh=ctl.getSession();assert.equal(fresh.result,null);assert.notEqual(fresh.attemptNonce,old.session.attemptNonce);assert.equal(fresh.attemptNonce,assignment.attemptNonce);
 assert.equal(a.persist('laptop','diagnosis-'+id,pack(profile,fresh,true)),true,a.status.detail);assert.ok(a.pendingFor(owner).some(x=>x.event.id===old.attemptId));
 const recovered=sandbox.factory(stage);recovered.bind();assert.equal(recovered.assignedScenario(()=>.9),id);await assert.rejects(recovered.startCase(id,{evaluation:true}),/STOP_AFTER_REAL_SESSION_RESTORE/);assert.equal(recovered.getSession().attemptNonce,fresh.attemptNonce);assert.equal(recovered.getSession().result,null);
 const finished=DE.finish(recovered.getSession(),{equipment:D});assert.equal(a.persist('laptop','diagnosis-'+id,pack(profile,finished,true)),true,a.status.detail);recovered.closeAssignedScenario(id,true);
 assert.equal(a.loadLocal('laptop','evaluation-assignment').attemptNonce,assignment.attemptNonce);
 await assert.rejects(recovered.startCase(id,{evaluation:true}),/STOP_AFTER_REAL_SESSION_RESTORE/);assert.ok(recovered.getSession().result);assert.equal(recovered.getSession().attemptNonce,fresh.attemptNonce);
});

for(const profile of ['standard','gaming'])test('V5 '+profile+' result retry restores hints only when the new practice permits them',()=>{
 for(const maxHints of [3,0]){
  const D=H.LaptopProfiles.get(profile).equipment;let s=E.createSession(D,'disassembly-guided',{maxHints});
  while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}
  const sandbox={window:box.window,console,confirmRestart:()=>true};vm.createContext(sandbox);
  let source=fs.readFileSync(path.join(ROOT,'js/hardware_lab_3d_controller.js'),'utf8').replace(/^import .*$/mg,'').replace('export function','function');
  source=source.replace('return { start };',`return { maybeFinish, snapshot(){return session;}, bind(s,D){session=s;equipmentId='laptop';equipmentData=D;engineMode='disassembly-guided';checkpointStore={};partWithPendingScrews=()=>null;hasPose=()=>false;persist=()=>{};equipmentCheckHtml=()=>'';resetPose=resetThermal=setupScrews=renderInfoPanel=refreshStats=()=>{};} };`);
  vm.runInContext(source+'\nthis.factory=createAssemblyController;',sandbox);
  let hints,options;const stage={stopTimer(){},startTimer(){},clearActionLog(){},currentRig:{syncFromSessionParts(){}},setHintUi(used,max,handler){hints={used,max,handler};},openResultModal(result,opts){options=opts;}};
  const ctl=sandbox.factory(stage);ctl.bind(clone(s),D);ctl.maybeFinish();assert.equal(hints.max,0);assert.equal(hints.handler,null);
  options.onRetry();assert.equal(ctl.snapshot().result,null);assert.equal(ctl.snapshot().hints.max,maxHints);assert.equal(hints.used,0);assert.equal(hints.max,maxHints);assert.equal(typeof hints.handler,'function');
 }
});

for(const profile of ['standard','gaming']){
 function completedExportFixture(){
  const storage=memory(),adapter=store(profile,storage),practice='disassembly-guided',D=H.LaptopProfiles.get(profile).equipment;let s=E.createSession(D,practice);
  while(!E.isFinished(s)){const step=E.currentStep(s);s=must(step.kind==='action'?E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}):E.attemptSafetyStep(s,step.id));}
  assert.equal(adapter.persist('laptop',practice,pack(profile,E.finish(s))),true);
  return {storage,adapter,practice,record:clone(adapter.inspect(practice))};
 }
 test('V5 '+profile+' exports intact completion from either valid slot and quarantines corruption',()=>{
  for(const badSlot of [0,1])for(const damage of ['json','version','inventory','counter']){
   const {storage,adapter,practice,record}=completedExportFixture(),raw=JSON.stringify(record),bad=clone(record);
   if(damage==='version')bad.schemaVersion=999;if(damage==='inventory')bad.inventory.parts.push('invented');if(damage==='counter')bad.session.errors=-1;
   bad.checksum=C.sign(bad);const damaged=damage==='json'?'{bad json':JSON.stringify(bad);
   const key=adapter.key(practice);storage.setItem(key+':'+(1-badSlot),raw);storage.setItem(key+':'+badSlot,damaged);
   const fresh=store(profile,storage),events=fresh.pendingFor(owner);
   assert.equal(events.length,1);assert.deepEqual(clone(events[0]),{event:record.completion,checkpoint:record});
   assert.equal(storage.getItem(key+':'+badSlot),damaged);assert.equal(storage.getItem(key+':'+(1-badSlot)),raw);
   const quarantine=[...storage.map.keys()].filter(k=>k.includes(':quarantine:'));assert.equal(quarantine.length,1);assert.equal(JSON.parse(storage.getItem(quarantine[0])).raw,damaged);
   assert.deepEqual(clone(fresh.pendingFor(owner)),clone(events));assert.equal(fresh.writes,0);
  }
 });
 test('V5 '+profile+' export stays closed on conflicts, missing valid slots, quarantine quota and corrupt archives',()=>{
  for(const fault of ['both-corrupt','quota','conflict','archive']){
   const {storage,adapter,practice,record}=completedExportFixture(),key=adapter.key(practice),validRaw=storage.getItem(key+':1');
   if(fault==='both-corrupt'){storage.setItem(key+':0','bad0');storage.setItem(key+':1','bad1');}
   if(fault==='quota'){storage.setItem(key+':0','bad');const set=storage.setItem;storage.setItem=(k,v)=>{if(k.includes(':quarantine:'))throw Error('quota');set(k,v);};}
   if(fault==='conflict'){const conflict=clone(record);conflict.updatedAt='2026-10-09T05:00:00Z';conflict.checksum=C.sign(conflict);storage.setItem(key+':0',JSON.stringify(conflict));}
   if(fault==='archive')storage.setItem(C.PREFIX+'completed:'+JSON.stringify([owner.kind,owner.user,owner.uid,'laptop',profile])+':bad','bad archive');
   assert.throws(()=>store(profile,storage).pendingFor(owner));
   if(fault!=='both-corrupt')assert.equal(storage.getItem(key+':1'),validRaw);
  }
 });
}

for(const finished of [false,true])test('V5 timer '+(finished?'restores the final duration without a live interval':'keeps the active desktop/legacy clock behavior'),()=>{
 const source=fs.readFileSync(path.join(ROOT,'js/hardware_lab_3d_stage.js'),'utf8'),start=source.indexOf('  function startTimer('),end=source.indexOf('  function setInfoPanel(',start);
 let now=Date.parse('2026-10-07T12:00:00Z'),callback=null,intervals=0;const el={textContent:''};
 const sandbox={document:{getElementById:()=>el},Date:{parse:Date.parse,now:()=>now},setInterval:fn=>{callback=fn;intervals++;return 1;},clearInterval:()=>{callback=null;}};vm.createContext(sandbox);
 vm.runInContext('let timerInterval=null;'+source.slice(start,end)+';this.start=startTimer;',sandbox);
 sandbox.start('2026-10-07T10:00:00Z',finished?'2026-10-07T10:02:05Z':undefined);
 assert.equal(el.textContent,finished?'02:05':'120:00');assert.equal(intervals,finished?0:1);
 now+=60000;if(callback)callback();assert.equal(el.textContent,finished?'02:05':'121:00');
});
