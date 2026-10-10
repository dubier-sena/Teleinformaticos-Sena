'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const box={window:{},console};vm.createContext(box);
for(const f of ['tools','data_laptop','data_desktop','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','attempts'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/hardware_lab_'+f+'.js'),'utf8'),box);
const H=box.window.HardwareLab,D=H.DataLaptop.LAPTOP_EQUIPMENT,E=H.DiagnosisEngine,V=H.DiagnosticsV3,C=H.DiagnosisCases,B=C.evaluationScenarios('laptop',{advanced:true});
const must=r=>{assert.equal(r.ok,true,r.message);return r.session};
const act=(s,id,a)=>must(E.attemptAction(D,s,{partId:id,action:a,toolId:D.parts[id].tool||'hands'}));
function repair(s,cond){
 const removed=[];
 function remove(id){if(s.parts[id]===false)return;for(const dep of D.parts[id].removeRequires||[])remove(dep);s=act(s,id,D.parts[id].kind==='cable'?'disconnect':'remove');removed.push(id);}
 remove('bottom-cover');remove('cable-battery');remove(cond.partId);
 if(cond.type==='replaced')s=must(E.replacePart(D,s,cond.partId));
 if(!H.Thermal.isReady(s.thermal)){
  remove('cooler');
  for(const task of ['brush','air','scrape','alcohol','apply'])s=must(E.applyThermalTask(D,s,task,{amount:'adecuada'}));
 }
 for(const id of removed.reverse())s=act(s,id,D.parts[id].kind==='cable'?'connect':'install');
 return s;
}
test('V3 has six new complete work orders, 1/2 faults each, independent preventive maintenance',()=>{
 assert.equal(B.length,6);const old=new Set(C.evaluationScenarios('laptop').map(c=>c.id));
 for(const c of B){assert.ok(!old.has(c.id));assert.ok(c.advanced&&c.maintenanceRequired);assert.ok([1,2].includes(c.workflow.faultCount));for(const k of ['context','symptom','objective','evidence','validActions','maintenance','solution','verification'])assert.ok(c.workflow[k]?.length,k);assert.equal(c.fault.faults.length,c.workflow.faultCount);}
});
for(const c of B)test('V3 evidence → hypotheses → repair → maintenance → assembly → verification: '+c.id,()=>{
 let s=E.createDiagnosisSession(D,c);assert.equal(E.finish(s,{equipmentData:D}).result.score,0);
 for(const st of s.stages){
  let power=E.checkPowerOn(D,s,{screwsSecured:true});s=power.session;assert.equal(power.fixed,false);
  const q=E.pendingQuestion(s);assert.ok(q,'hypothesis after visible symptom');s=must(E.answerDiagnosis(s,E.subsystemOf(s.stages[q.stage])));
  for(const tool of c.workflow.evidence)s=must(V.run(D,s,tool,E));
  const before=JSON.stringify(s.parts);const sampled=V.run(D,s,'post',E);assert.equal(JSON.stringify(sampled.session.parts),before);
  s=repair(s,st.fixCondition);
  const done=E.checkPowerOn(D,s,{screwsSecured:true});s=done.session;
  if(st!==s.stages[s.stages.length-1])assert.equal(done.fixed,false,'one of two is not complete');
 }
 for(const tool of c.workflow.evidence)s=must(V.run(D,s,tool,E));
 const end=E.checkPowerOn(D,s,{screwsSecured:true});assert.equal(end.fixed,true,end.message);s=end.session;
 assert.ok(H.Thermal.isReady(s.thermal));assert.ok(Object.values(s.parts).every(Boolean));assert.equal(s.errors,0);
 const result=E.finish(s,{equipmentData:D}).result;assert.equal(result.rawMax,100);assert.equal(Object.keys(result.breakdown).filter(k=>k!=='total').length,7);assert.ok(result.score>=90,JSON.stringify(result.breakdown));
 assert.equal(JSON.stringify(E.deserialize(E.serialize(s)).instrumentRecords),JSON.stringify(s.instrumentRecords));
});
test('V3 power reflects missing RAM, CPU, battery, eDP, SSD and fan independently of original fault',()=>{
 const base=E.createDiagnosisSession(D,B[5]);base.fixCondition={type:'all',conditions:[]};base.stages=[];base.thermal=H.Thermal.createThermalState('serviced');
 for(const[id,screen]of [['ram','no-post'],['cpu','no-post'],['battery','off'],['cable-screen-flex','no-image'],['ssd-m2','no-boot'],['cable-cpu-fan-laptop','overheat']]){
  const s={...base,parts:{...base.parts,[id]:false}};assert.equal(V.hardware(D,s,E).screen,screen,id);assert.equal(E.checkPowerOn(D,s,{screwsSecured:true}).fixed,false,id);
 }
 assert.equal(E.checkPowerOn(D,base,{screwsSecured:false}).fixed,false);
});
test('V3 hidden electrical RAM/SSD defects are evidenced by tests, not automatic visual verdicts',()=>{
 let s=E.checkPowerOn(D,E.createDiagnosisSession(D,B[0])).session;const ram=V.run(D,s,'ram',E),ssd=V.run(D,s,'smart',E);assert.match(ram.message,/discrepancias/);assert.match(ssd.message,/no disponible antes del POST/);
 const bench={...s,parts:{...s.parts,'ssd-m2':false}};assert.match(V.run(D,bench,'smart',E).message,/37 errores/);
 s=act(act(act(s,'bottom-cover','remove'),'cable-battery','disconnect'),'ram','remove');assert.match(E.inspectPart(D,s,'ram').message,/Sin daño visual concluyente/);
});
test('V3 scoring separates unsafe work from pointer/blocked events and prevents incomplete verification credit',()=>{
 const s=E.createDiagnosisSession(D,B[4]);const baseline=V.score(D,s,E);const blocked={...s,errorsByType:{...s.errorsByType,blocked:100}};
 assert.equal(V.score(D,blocked,E).total,baseline.total);assert.equal(baseline.verificacion.value,0);
 let good=repair(s,s.stages[0].fixCondition);good=E.checkPowerOn(D,good,{screwsSecured:true}).session;
 const unsafe={...good,errorsByType:{...good.errorsByType,unsafe:2}};assert.equal(V.score(D,good,E).seguridad.value-V.score(D,unsafe,E).seguridad.value,10);
});
test('V3 a high partial score never passes with one of two faults unrepaired',()=>{
 let s=E.createDiagnosisSession(D,B[0]);s=E.checkPowerOn(D,s).session;s=must(E.answerDiagnosis(s,'memoria'));s=must(V.run(D,s,'ram',E));s=repair(s,s.stages[0].fixCondition);
 s=E.checkPowerOn(D,s).session;s=must(E.answerDiagnosis(s,'almacenamiento'));for(const tool of ['ram','smart','temperature'])s=must(V.run(D,s,tool,E));
 const result=E.finish(s,{equipmentData:D}).result;assert.ok(result.score>=70);assert.equal(result.status,'POR MEJORAR');assert.equal(result.diagnosisCorrect,false);assert.equal(result.faultsFixed,1);
});
test('V3 instruments require their final keyboard and screen, not merely connected cables',()=>{
 let s=E.createDiagnosisSession(D,B[0]);s=repair(s,s.stages[0].fixCondition);s=E.checkPowerOn(D,s).session;
 assert.match(V.run(D,{...s,parts:{...s.parts,keyboard:false}},'input',E).message,/Teclado: 0 eventos/);
 assert.match(V.run(D,{...s,parts:{...s.parts,'screen-assembly':false}},'display',E).message,/Panel ausente/);
});

test('V3 keeps a pending V2 assignment until delivery, then chooses the new bank',()=>{
 const ctl=fs.readFileSync(path.join(__dirname,'../js/hardware_lab_3d_diagnosis_controller.js'),'utf8');
 const src=ctl.slice(ctl.indexOf('function assignedScenario(rng)'),ctl.indexOf('function startEvaluation'));
 let store={current:'eval-e3',done:[]};
 const Storage=()=>({loadLocal:()=>store,persist:(e,m,value)=>{store=value;}});
 const fns=new Function('window','Storage','equipmentId','EVAL_ASSIGN_MODE','profileId','checkpointStore',src+';return {assignedScenario,closeAssignedScenario};')(box.window,Storage,'laptop','test','standard',null);
 assert.equal(fns.assignedScenario(()=>0),'eval-e3');
 fns.closeAssignedScenario('eval-e3');assert.equal(fns.assignedScenario(()=>0),B[0].id);
});

test('V3 measurements need power and expire after work, including beyond the 200-entry log limit',()=>{
 let s=E.createDiagnosisSession(D,B[4]);
 assert.equal(V.run(D,s,'temperature',E).record.measured,false);
 s=repair(s,s.stages[0].fixCondition);s=E.checkPowerOn(D,s).session;
 for(const tool of s.verificationTools)s=must(V.run(D,s,tool,E));
 assert.equal(V.verified(s),true);s=E.checkPowerOn(D,s).session;assert.equal(s.fixed,true);
 for(let i=0;i<210;i++)s=must(V.run(D,s,'battery',E));
 s=act(s,'bottom-cover','remove');assert.equal(s.fixed,false);assert.equal(s.powerState,'apagado');assert.equal(V.verified(s),false);
 s=act(s,'bottom-cover','install');s=E.checkPowerOn(D,s).session;
 assert.equal(s.fixed,false,'old evidence cannot validate reassembly');
 for(const tool of s.verificationTools)s=must(V.run(D,s,tool,E));
 assert.equal(E.checkPowerOn(D,s).fixed,true);
});

test('V3 restores old laptop diagnosis audio without changing legacy scoring, log or explicit states',()=>{
 const original=E.serialize(E.createDiagnosisSession(D,C.getCase('laptop','eval-e1')));
 for(const id of D.sessionAddedParts)delete original.parts[id];
 const restored=E.deserialize(original,D);assert.equal(restored.advanced,false);
 assert.deepEqual(restored.actionLog,original.actionLog);assert.equal(E.equipmentReadyForPowerTest(D,restored).ready,true);
 const disassembled={...original,parts:{...original.parts,motherboard:false,battery:false}};
 const open=E.deserialize(disassembled,D);for(const id of D.sessionAddedParts)assert.equal(open.parts[id],false);
 const explicit={...original,parts:{...original.parts,'speaker-left':false}};assert.equal(E.deserialize(explicit,D).parts['speaker-left'],false);
});

test('V3 local attempt mapping preserves incomplete status and partial points without a backend call',()=>{
 const result={score:80,diagnosisCorrect:false,status:'POR MEJORAR',breakdown:{total:80,diagnostico:{value:20,max:20},resto:{value:60,max:80}}};
 const doc=H.Attempts.buildAttemptDoc({advanced:true,startedAt:'2026-10-04T12:00:00Z',result},{uid:'offline-test',equipo:'laptop',practica:'diagnosis-eval-v3-s1',nonce:'abc123',origen:'new'});
 assert.equal(doc.estado,'POR MEJORAR');assert.equal(doc.normalizedScore,80);
});
