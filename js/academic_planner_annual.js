/* Annual drafts and schedule proposals. No network; confirmed data remains in the existing store. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./academic_planner.js'));else root.academicPlannerAnnual=factory(root.academicPlanner);})(typeof globalThis!=='undefined'?globalThis:this,function(P){
'use strict';
const KEY='sena_academic_planner_annual_drafts_v1', PREVIEW_KEY='sena_academic_planner_readonly_preview_v1';
const clone=x=>JSON.parse(JSON.stringify(x)),check=(ok,message)=>{if(!ok)throw new Error(message);};
function read(storage){const raw=storage.getItem(KEY);if(!raw)return {schemaVersion:1,revision:0,years:{}};const value=JSON.parse(raw);check(value.schemaVersion===1&&Number.isInteger(value.revision)&&value.revision>=0&&value.years&&!Array.isArray(value.years),'El borrador anual no es compatible. Conserva sus datos; no se reinicia automáticamente.');for(const [year,d] of Object.entries(value.years)){check(Number(year)===d.config?.year&&Number.isInteger(d.step)&&d.step>=0&&d.step<8&&Number.isInteger(d.baseRevision),'Borrador anual incompleto.');P.validateConfig({...d.config,rotation:null});}return value;}
// The caller holds a Web Lock. CAS also refuses outdated tabs.
function saveDraft(storage,draft,expectedRevision){const before=read(storage);check(before.revision===expectedRevision,'Otra pestaña cambió un borrador anual. Recarga antes de guardarlo.');P.validateConfig({...draft.config,rotation:null});check(Number.isInteger(draft.step)&&draft.step>=0&&draft.step<8&&Number.isInteger(draft.baseRevision),'Borrador anual incompleto.');const next=clone(before);next.years[draft.config.year]=clone({...draft,updatedAt:new Date().toISOString()});next.revision++;storage.setItem(KEY,JSON.stringify(next));return next;}
function finishDraft(storage,year,expectedRevision){const before=read(storage);check(before.revision===expectedRevision,'La programación se confirmó, pero otra pestaña cambió el borrador anual; se conservó para revisión.');if(!before.years[year])return before;const next=clone(before);next.years[year].confirmed=true;next.revision++;storage.setItem(KEY,JSON.stringify(next));return next;}
function period(config,settings){P.date(settings.start);P.date(settings.end);check(settings.start.slice(0,4)===String(config.year)&&settings.end.slice(0,4)===String(config.year)&&settings.start<=settings.end,'Elige un inicio y un fin dentro del año, en ese orden.');}
function propose(snapshot,config,settings,actor){
 P.validateConfig(config);check(actor?.role==='instructor'&&actor.id,'Instructor requerido.');
 const confirmed=clone(snapshot.sessions.filter(s=>s.year===config.year)),sessions=[],warnings=[],conflicts=[];
 const missing=config.fichas.filter(f=>!config.breaksReviewed.includes(f.institutionId));
 if(missing.length)warnings.push('Falta revisar vacaciones y recesos de '+[...new Set(missing.map(f=>config.institutions.find(i=>i.id===f.institutionId)?.name))].join(', ')+'.');
 const unscheduled=config.fichas.filter(f=>!config.schedules.some(s=>s.ficha===f.id));
 if(unscheduled.length)warnings.push('Sin horario: fichas '+unscheduled.map(f=>f.id).join(', ')+'.');
 if(!settings.start||!settings.end)return {sessions,confirmed,warnings:warnings.concat('Selecciona el inicio y fin de la programación en el paso 4.'),conflicts,complete:!settings.createClasses&&!missing.length};
 period(config,settings);
 const weeks=P.rotationWeeks(config),holidays=new Set(P.holidays(config.year).map(h=>h.date));
 for(let date=settings.start;date<=settings.end;date=P.add(date,1)){
  if(holidays.has(date))continue;
  for(const schedule of config.schedules.filter(s=>s.weekday===P.date(date).getUTCDay())){
   const ficha=config.fichas.find(f=>f.id===schedule.ficha);check(P.canManage(actor,ficha.id),'Ficha no administrada.');
   if(config.breaks.some(b=>b.institutionId===ficha.institutionId&&b.start<=date&&b.end>=date))continue;
   if(weeks){const w=weeks[P.monday(date)];if(!w||w.paused||!w.fichas.includes(ficha.id))continue;}
   // Any existing state occupies this date/ficha; cancelled classes are never silently replaced.
   if(confirmed.some(s=>s.date===date&&s.ficha===ficha.id))continue;
   const blocks=P.blocks(schedule.blocks),other=confirmed.concat(sessions).find(s=>s.date===date&&s.status!=='Suspendida'&&s.instructorId===actor.id&&P.overlap(s.blocks,blocks));
   if(other)conflicts.push(date+': las fichas '+other.ficha+' y '+ficha.id+' tienen franjas superpuestas. Ajusta horarios o rotación.');
   sessions.push({id:'annual:'+config.year+':'+ficha.id+':'+date,year:config.year,ficha:ficha.id,institutionId:ficha.institutionId,instructorId:actor.id,originalDate:date,date,blocks,plannedMinutes:P.duration(blocks),actualMinutes:0,status:'Programada',curriculum:{id:'',order:'—',competencyCode:'',competency:'Sin competencia vinculada',rap:'Sin RAP vinculado',guides:[]},history:[]});
  }
 }
 if(settings.createClasses&&!sessions.length)warnings.push('No hay clases nuevas en el intervalo: revisa horarios, recesos, festivos y fechas ya ocupadas.');
 if(confirmed.length)warnings.push('Las '+confirmed.length+' clases existentes conservan sus fechas, estados e historial. El recálculo de pendientes se solicita por separado.');
 return {sessions,confirmed,warnings,conflicts,complete:!missing.length&&(!settings.createClasses||(!conflicts.length&&!unscheduled.length&&sessions.length>0))};
}
function confirm(snapshot,config,settings,actor,reason,approved){
 check(approved===true&&String(reason||'').trim(),'Revisa la propuesta, marca la confirmación y escribe el acuerdo.');
 check(config.fichas.length,'Agrega al menos una ficha antes de confirmar.');
 const proposal=propose(snapshot,config,settings,actor);check(proposal.complete,'La propuesta requiere corregir los avisos antes de confirmar.');
 const next=clone(snapshot);next.years[config.year]=clone(config);
 if(settings.createClasses){next.sessions=P.confirmProposal({sessions:proposal.sessions,requested:proposal.sessions.length,complete:true},snapshot.sessions,actor,true);for(const s of next.sessions.filter(s=>proposal.sessions.some(p=>p.id===s.id)))s.history.at(-1).reason=reason.trim();}
 return next;
}
return Object.freeze({KEY,PREVIEW_KEY,read,saveDraft,finishDraft,propose,confirm,period});
});
