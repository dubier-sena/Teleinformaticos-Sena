'use strict';
const {test}=require('node:test'); const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');const ROOT=path.resolve(__dirname,'..');
function load(){const ctx={window:{},console};vm.createContext(ctx);for(const f of ['tools','data_laptop','engine'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js/hardware_lab_'+f+'.js'),'utf8'),ctx);return ctx.window.HardwareLab}
const H=load(),D=H.DataLaptop.LAPTOP_EQUIPMENT,E=H.Engine;
function open(){let s=E.createSession(D,'disassembly-open');while(E.currentStep(s)?.kind==='safety')s=E.attemptSafetyStep(s,E.currentStep(s).id).session;for(const [id,action]of [['bottom-cover','remove'],['cable-battery','disconnect'],['battery','remove']]){const r=E.attemptAction(D,s,{partId:id,action,toolId:D.parts[id].tool});assert.ok(r.ok,r.message);s=r.session}return s}
function action(s,id,a){return E.attemptAction(D,s,{partId:id,action:a,toolId:'hands'})}
test('V2: 22 service states, 22 actions each way, audio has complete information',()=>{
 assert.equal(Object.keys(D.parts).length,22);
 for(const dir of ['assembly','disassembly']) assert.equal(D.sequences[dir].filter(s=>s.kind==='action').length,22);
 for(const side of ['left','right'])for(const prefix of ['speaker-','cable-speaker-']){const p=D.parts[prefix+side];assert.ok(p.removeInstructions.length&&p.installInstructions.length);for(const key of ['function','characteristics','location','connectionType','precautions','compatibility','commonErrors'])assert.ok(p.info[key]);}
});
test('V2: audio cannot leave with its cable connected; reverse order restores all states',()=>{
 let s=open();
 for(const side of ['left','right']){const id='speaker-'+side,c='cable-'+id;assert.equal(action(s,id,'remove').ok,false);let r=action(s,c,'disconnect');assert.ok(r.ok,r.message);s=r.session;r=action(s,id,'remove');assert.ok(r.ok,r.message);s=r.session;assert.equal(action(s,c,'connect').ok,false);r=action(s,id,'install');assert.ok(r.ok,r.message);s=r.session;r=action(s,c,'connect');assert.ok(r.ok,r.message);s=r.session;}
 assert.ok(s.parts['speaker-left']&&s.parts['speaker-right']);
});
test('V2: battery and motherboard block unsafe audio actions; reset and serialization preserve IDs',()=>{
 let s=open();s=action(s,'cable-speaker-left','disconnect').session;
 const without=action(s,'speaker-left','remove').session;
 assert.equal(E.attemptAction(D,without,{partId:'battery',action:'install',toolId:'phillips'}).ok,false);
 s={...s,parts:{...s.parts,battery:true}};assert.equal(action(s,'cable-speaker-left','connect').ok,false);
 s={...s,parts:{...s.parts,battery:false,motherboard:false}};assert.equal(action(s,'cable-speaker-left','connect').ok,false);
 assert.equal(E.serialize(without).parts['speaker-left'],false);
 assert.equal(E.createSession(D,'disassembly-open').parts['speaker-left'],true);
});
test('V2: new service parts have independent selectable geometry, tray/reset and 25 original screws',async()=>{
 global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>({width:10,data:new Uint8ClampedArray(4)})})})};
 const u=f=>pathToFileURL(path.join(ROOT,'js',f)).href;
 const THREE=await import(u('vendor/three.module.min.js'));const{createRig}=await import(u('hardware_lab_3d_rig.js'));const{createLaptopLayout}=await import(u('hardware_lab_3d_layout_laptop.js'));
 const registry=new Map();const interactions={registerInteractive:(o,m)=>registry.set(o,m),unregisterInteractive:o=>registry.delete(o),registerOccluder(){},unregisterOccluder(){}};
 const rig=createRig({scene:new THREE.Scene(),interactions,tweenGroup:null,layout:createLaptopLayout(),equipmentId:'laptop'});
 assert.equal(rig.screwEntries.length,25);assert.equal(registry.size,47);
 for(const side of ['left','right'])for(const prefix of ['speaker-','cable-speaker-']){
  const id=prefix+side,obj=rig.getObject3D(id),home=obj.position.clone();assert.equal(registry.get(obj).partId,id);
  rig.setPresence(id,false,{animate:false});assert.equal(rig.isPresent(id),false);assert.ok(obj.position.distanceTo(home)>.05);
  rig.setPresence(id,true,{animate:false});assert.equal(rig.isPresent(id),true);assert.ok(obj.position.distanceTo(home)<1e-8);
 }
 let instances=0, released=0;
 rig.root.traverse(n=>{if(n.isInstancedMesh){instances++;n.addEventListener('dispose',()=>released++)}});
 assert.ok(instances>20);rig.dispose();assert.equal(released,instances);assert.equal(registry.size,0);
});

test('V2: every legacy guided boundary resumes and completes without errors or lost records',()=>{
 // Exact sources from the published baseline; runnable in the existing shallow CI checkout.
 const raw=fs.readFileSync(path.join(__dirname,'fixtures/hardware_lab_legacy_204dc407.json'));
 assert.equal(require('node:crypto').createHash('sha256').update(raw).digest('hex'),'880705cf354b8b8a0b0805a2ac6f7107e74facd65720214d593041a12bf0b288');
 const baseline=JSON.parse(raw);assert.equal(baseline.commit,'204dc4076b236516cf6c8d145625e9e5f67265a9');
 const ctx={window:{},console};vm.createContext(ctx);
 for(const f of ['tools','data_laptop','engine'])vm.runInContext(baseline.sources[f],ctx);
 const old=ctx.window.HardwareLab,O=old.Engine,OD=old.DataLaptop.LAPTOP_EQUIPMENT;
 function advance(engine,data,s){const step=engine.currentStep(s);const r=step.kind==='safety'?engine.attemptSafetyStep(s,step.id):engine.attemptAction(data,s,{...step,toolId:data.parts[step.partId].tool||'hands'});assert.ok(r.ok,r.message);assert.notEqual(r.session.stepIndex,s.stepIndex);return r.session}
 for(const mode of ['disassembly-guided','assembly-guided','maintenance-guided']){
  let legacy=O.createSession(OD,mode);
  for(let i=0;i<=legacy.sequence.length;i++){
   const saved=O.serialize(legacy),before=JSON.stringify(saved);let migrated=E.deserialize(D,saved);
   assert.equal(JSON.stringify(saved),before);assert.equal(migrated.actionLog,saved.actionLog);assert.equal(migrated.errors,legacy.errors);
   for(const id of D.sessionAddedParts)assert.equal(typeof migrated.parts[id],'boolean');
   let guard=0;while(!E.isFinished(migrated)){assert.ok(guard++<40);migrated=advance(E,D,migrated)}
   assert.equal(migrated.errors,0);if(i<legacy.sequence.length)legacy=advance(O,OD,legacy);
  }
 }
});
test('V2: old open sessions normalize audio at physical boundaries; desktop restore is unchanged',()=>{
 for(const direction of ['assembly','disassembly'])for(const board of [false,true])for(const battery of [false,true]){
  const s=E.createSession(D,direction+'-open');for(const id of D.sessionAddedParts)delete s.parts[id];s.parts.motherboard=board;s.parts.battery=battery;
  const r=E.deserialize(D,E.serialize(s));for(const id of D.sessionAddedParts)assert.equal(r.parts[id],!board?false:battery?true:direction!=='assembly');
 }
 const desktop=Object.assign({},D,{id:'desktop',sessionAddedParts:undefined});const s=E.createSession(desktop,'assembly-guided'),r=E.deserialize(desktop,E.serialize(s));assert.equal(r.parts,s.parts);assert.equal(r.stepIndex,0);
});
