'use strict';
// Pure preparation: returns documents; never connects to Firebase or writes a deployment.
const I=require('../js/academic_planner_integration.js'),Cloud=require('../js/academic_calendar_cloud.js'),security=require('./academic_calendar_security.cjs');
const crypto=require('node:crypto');
function prepare(input){
 const models=security.readModels(input),projection=I.legacy(input.records,input.seed,input.snapshot.state,input.mapping),grouped=I.legacySessions(projection);
 if(grouped.issues.length)throw Error('Historical schedule requires review.');
 const sessions=grouped.sessions.map(s=>{
  const sourceStatuses=s.sourceRows.map(r=>({sourceId:r.sourceId,state:r.state,blocks:s.blockSources.filter(b=>b.sourceId===r.sourceId).map(b=>b.block)}));
  // Learner-visible activity is copied verbatim from the source (act.nombre); observations stay in the private archive.
  const activity=[...new Set(s.sourceRows.map(r=>r.activity?.nombre).filter(x=>typeof x==='string'&&x.trim()))].join(' / ');
  const d={id:'legacy_'+crypto.createHash('sha256').update(s.id).digest('hex').slice(0,32),ficha:s.ficha,year:s.year,date:s.date,originalDate:s.originalDate,blocks:s.blocks,plannedMinutes:s.plannedMinutes,actualMinutes:s.actualMinutes,status:s.status,
   activity,evidence:'',dueDate:'',curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses,origin:'legacy',protected:sourceStatuses.some(r=>r.state!=='Activa'),revision:0,mutationId:'historical-import',updatedBy:input.adminUid};
  Cloud.validate(d);return d;
 });
 const represented=new Set(sessions.flatMap(s=>s.sourceStatuses.map(r=>r.sourceId)));
 if(projection.projected.filter(r=>r.type==='CLASE').some(r=>!represented.has(r.sourceId)))throw Error('Historical class omitted.');
 const originalTaught=projection.projected.filter(r=>r.state==='Impartida');
 if(originalTaught.some(r=>r.ficha&&!sessions.some(s=>s.protected&&s.sourceStatuses.some(x=>x.sourceId===r.sourceId&&x.state==='Impartida'))))throw Error('Historical taught state lost.');
 return {...models,sessions,integrity:{records:projection.projected.length,classes:represented.size,sessions:sessions.length,taught:originalTaught.length,taughtInFichas:originalTaught.filter(r=>r.ficha).length,sourceHash:models.source.sha256}};
}
module.exports={prepare};
