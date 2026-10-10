'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const{pathToFileURL}=require('node:url');const ROOT=path.resolve(__dirname,'..');
const box={window:{},console};vm.createContext(box);
for(const f of['tools','data_laptop','data_desktop','laptop_profiles','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','diagnosis_gaming'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js/hardware_lab_'+f+'.js'),'utf8'),box);
const H=box.window.HardwareLab,D=H.LaptopProfiles.get('gaming').equipment,E=H.Engine,DE=H.DiagnosisEngine,V=H.DiagnosticsV3;
const must=r=>{assert.equal(r.ok,true,r.message);return r.session};
test('V4 profiles keep standard intact and independently complete every assembly direction',()=>{
 assert.equal(Object.keys(H.LaptopProfiles.get('standard').equipment.parts).length,22);assert.equal(Object.keys(D.parts).length,26);assert.ok(!D.parts.cpu&&!D.parts.gpu);
 for(const mode of ['disassembly-guided','assembly-guided','maintenance-guided']){
  let s=E.createSession(D,mode),guard=0;
  while(!E.isFinished(s)){assert.ok(guard++<60);const step=E.currentStep(s);s=must(step.kind==='safety'?E.attemptSafetyStep(s,step.id):E.attemptAction(D,s,{...step,toolId:D.parts[step.partId].tool}));}
  assert.equal(s.errors,0);assert.equal(E.serialize(s).profileId,'gaming');
 }
});
function repair(s,cond){
 const removed=[];
 function remove(id){if(s.parts[id]===false)return;for(const dep of D.parts[id].removeRequires)remove(dep);s=must(DE.attemptAction(D,s,{partId:id,action:D.parts[id].kind==='cable'?'disconnect':'remove',toolId:D.parts[id].tool}));removed.push(id);}
 remove('bottom-cover');remove('cable-battery');if(cond.partId)remove(cond.partId);
 if(cond.type==='replaced')s=must(DE.replacePart(D,s,cond.partId));
 if(!H.Thermal.isReady(s.thermal)){remove('cooler');for(const task of ['brush','air','scrape','alcohol','apply'])s=must(DE.applyThermalTask(D,s,task,{amount:'adecuada'}));}
 for(const id of removed.reverse())s=must(DE.attemptAction(D,s,{partId:id,action:D.parts[id].kind==='cable'?'connect':'install',toolId:D.parts[id].tool}));
 return s;
}
for(const c of H.DiagnosisGaming.cases.concat(H.DiagnosisGaming.evaluations))test('V4 gamer complete diagnosis: '+c.id,()=>{
 let s=DE.createDiagnosisSession(D,c);
 for(const st of s.stages){
  s=DE.checkPowerOn(D,s).session;const q=DE.pendingQuestion(s);assert.ok(q,'hypothesis should be available');s=must(DE.answerDiagnosis(s,DE.subsystemOf(st)));
  for(const tool of c.workflow.evidence)s=must(V.run(D,s,tool,DE));
  s=repair(s,st.fixCondition);
 }
 s=DE.checkPowerOn(D,s).session;for(const tool of c.workflow.evidence)s=must(V.run(D,s,tool,DE));
 const end=DE.checkPowerOn(D,s,{screwsSecured:true});assert.equal(end.fixed,true,end.message);assert.equal(end.session.errors,0);
 if(c.evaluation)assert.equal(DE.finish(end.session,{equipmentData:D}).result.status,'APROBADO');
});
test('V4 RAM and SSD channels cannot contaminate each other or other profiles',()=>{
 let s=DE.checkPowerOn(D,DE.createDiagnosisSession(D,H.DiagnosisGaming.cases[2])).session;
 assert.match(V.run(D,s,'ram',DE,'ram').message,/128 discrepancias/);assert.match(V.run(D,s,'ram',DE,'ram-b').message,/0 discrepancias/);
 assert.equal(V.run(D,s,'ram',DE,'cpu').ok,false);
 const store=H.LaptopProfiles.storage('gaming',null);store.persist('laptop','free',{profileId:'gaming',parts:{ram:false}});
 assert.equal(store.loadLocal('laptop','free').parts.ram,false);assert.equal(H.LaptopProfiles.storage('standard',123),123);
 assert.equal(H.DiagnosisCases.casesFor('laptop').length,11);assert.equal(H.DiagnosisCases.casesFor('laptop','gaming').length,8);
});
test('V4 physical model has independent service parts, specific screws and two fixed chips; 20 profile rebuilds release registrations',async()=>{
 global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>({width:10,data:new Uint8ClampedArray(4)})})})};
 const u=f=>pathToFileURL(path.join(ROOT,'js',f)).href;
 const THREE=await import(u('vendor/three.module.min.js')),{createRig}=await import(u('hardware_lab_3d_rig.js')),{createGamingLayout}=await import(u('hardware_lab_3d_layout_gaming.js')),{createLaptopLayout}=await import(u('hardware_lab_3d_layout_laptop.js'));
 const registry=new Set(),scene=new THREE.Scene();const interactions={registerInteractive:o=>registry.add(o),unregisterInteractive:o=>registry.delete(o),registerOccluder:o=>registry.add(o),unregisterOccluder:o=>registry.delete(o)};
 for(let n=0;n<20;n++){
  const gaming=n%2===0,rig=createRig({scene,interactions,tweenGroup:null,layout:gaming?createGamingLayout():createLaptopLayout(),equipmentId:'laptop'});
  assert.equal(rig.partIds.length,gaming?26:22);assert.equal(rig.screwEntries.length,gaming?33:25);
  if(gaming){assert.ok(rig.root.getObjectByName('gaming-gpu-soldered'));assert.equal(rig.getObject3D('gpu'),null);for(const id of rig.partIds){const obj=rig.getObject3D(id),b=new THREE.Box3().setFromObject(obj);assert.ok(Number.isFinite(b.min.x));rig.setPresence(id,false,{animate:false});rig.setPresence(id,true,{animate:false});}}
  rig.dispose();assert.equal(registry.size,0);assert.equal(scene.children.length,0);
 }
});

test('V4 verification and diagnosis distinguish RAM A from RAM B evidence',()=>{
 const c=H.DiagnosisGaming.evaluations[3];let s=DE.checkPowerOn(D,DE.createDiagnosisSession(D,c)).session;
 s=must(DE.answerDiagnosis(s,'memoria'));s=must(V.run(D,s,'ram',DE,'ram'));s=repair(s,s.stages[0].fixCondition);s=DE.checkPowerOn(D,s).session;
 s=must(V.run(D,s,'ram',DE,'ram'));s=must(V.run(D,s,'temperature',DE));
 assert.equal(DE.checkPowerOn(D,s).fixed,false);assert.equal(V.score(D,s,DE).diagnostico.value,10);
 s=must(V.run(D,s,'ram',DE,'ram-b'));assert.equal(DE.checkPowerOn(D,s).fixed,true);
});

test('V4 service screw heads remain physically exposed on both fans and M.2 channels',async()=>{
 global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>({width:10,data:new Uint8ClampedArray(4)})})})};
 const u=f=>pathToFileURL(path.join(ROOT,'js',f)).href;
 const T=await import(u('vendor/three.module.min.js')),{createRig}=await import(u('hardware_lab_3d_rig.js')),{createGamingLayout}=await import(u('hardware_lab_3d_layout_gaming.js')),{isHitbox}=await import(u('hardware_lab_3d_constants.js'));
 const scene=new T.Scene(),interactions={registerInteractive(){},unregisterInteractive(){},registerOccluder(){},unregisterOccluder(){}};
 const rig=createRig({scene,interactions,tweenGroup:null,layout:createGamingLayout(),equipmentId:'laptop'}),ray=new T.Raycaster();
 for(const step of D.sequences.disassembly.filter(s=>s.partId)){
  scene.updateMatrixWorld(true);
  for(const entry of rig.screwEntries.filter(e=>e.partId===step.partId)){
   if(['fan-cpu','fan-gpu','ssd-m2','ssd-m2-b'].includes(step.partId)){
    const target=entry.object3d.getWorldPosition(new T.Vector3()),direction=entry.outDir.clone().transformDirection(rig.root.matrixWorld);
    ray.set(target.clone().addScaledVector(direction,.06),direction.negate());
    const hits=ray.intersectObject(scene,true).filter(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return !isHitbox(h.object)&&!(h.object.material?.transparent&&h.object.material.opacity<.5)});
    let first=hits[0]?.object;while(first?.parent&&!first.userData.screwId)first=first.parent;
    assert.equal(first?.userData.screwId,entry.id,'Head is covered by another solid: '+entry.id);
   }
   entry.object3d.visible=false;
  }
  rig.setPresence(step.partId,false,{animate:false});
 }
 rig.dispose();
});
