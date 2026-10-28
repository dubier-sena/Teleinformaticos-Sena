(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory(require('./academic_planner.js'),require('./academic_planner_integration.js'));
  else root.academicPlannerStore=factory(root.academicPlanner,root.academicPlannerIntegration);
})(typeof self!=='undefined'?self:this,function(planner,integration){
  'use strict';
  const KEY='sena_academic_planner_local_v1';
  function empty(){return {schemaVersion:1,revision:0,years:{},sessions:[],history:[]};}
  function load(storage){
    const raw=storage.getItem(KEY);
    if(!raw) return empty();
    const value=JSON.parse(raw);
    if(value.schemaVersion!==1 || !Number.isInteger(value.revision) || !value.years || !Array.isArray(value.sessions) || !Array.isArray(value.history)) throw new Error('Borrador local incompatible. Conserve el archivo; no se reinicia automáticamente.');
    Object.values(value.years).forEach(planner.validateConfig);
    for(const s of value.sessions){
      planner.date(s.date);planner.date(s.originalDate);
      if(!s.id || !s.curriculum || !Array.isArray(s.history) || !planner.STATES.includes(s.status) || s.plannedMinutes!==planner.duration(s.blocks) || !Number.isInteger(s.actualMinutes) || s.actualMinutes<0 || s.actualMinutes>s.plannedMinutes)throw new Error('Sesión local dañada. Conserve la exportación; no se reinicia automáticamente.');
    }
    integration.validateExtensions(value,value,{id:'structural-validation',role:'instructor',fichas:[]});
    return value;
  }
  // Call under a browser Web Lock for cross-tab exclusion. Revision rejects stale previews.
  function save(storage,next,expectedRevision,actor,reason,confirmed){
    if(confirmed!==true || actor?.role!=='instructor' || !actor.id || !String(reason||'').trim()) throw new Error('Guardado sin confirmación, responsable o motivo.');
    const before=load(storage);
    if(before.revision!==expectedRevision) throw new Error('El borrador cambió en otra pestaña. Recargue y revise otra vez.');
    if(next?.schemaVersion!==1||!next.years||!Array.isArray(next.sessions)||!Array.isArray(next.history))throw new Error('Snapshot incompatible o incompleto.');
    Object.values(next.years).forEach(planner.validateConfig);
    if(Object.keys(before.years).some(y=>!next.years[y])) throw new Error('No se permite eliminar años históricos.');
    if(new Set(next.sessions.map(s=>s.id)).size!==next.sessions.length) throw new Error('Identificadores de sesión duplicados.');
    for(const s of before.sessions){
      const after=next.sessions.find(x=>x.id===s.id);
      if(!after) throw new Error('No se permite eliminar sesiones del historial.');
      for(const key of ['id','year','ficha','institutionId','instructorId','originalDate','curriculum']) if(JSON.stringify(after[key])!==JSON.stringify(s[key])) throw new Error('La identidad y fuente histórica de la sesión son inmutables.');
      if(JSON.stringify(after)!==JSON.stringify(s)){
        if(s.status==='Realizada' && after.history.at(-1)?.explicitRealizedCorrection!==true) throw new Error('Corrección de realizada no explícita.');
        if(!planner.canManage(actor,s.ficha)) throw new Error('Ficha no administrada.');
        if(after.history.length<=s.history.length || JSON.stringify(after.history.slice(0,s.history.length))!==JSON.stringify(s.history)) throw new Error('El cambio debe conservar y ampliar el historial.');
      }
    }
    for(const s of next.sessions){
      planner.date(s.date); planner.date(s.originalDate);
      if(!next.years[s.year]?.fichas.some(f=>f.id===s.ficha) || Number(s.date.slice(0,4))!==s.year || Number(s.originalDate.slice(0,4))!==s.year) throw new Error('Sesión fuera de su ficha o año.');
      if(!planner.STATES.includes(s.status) || s.plannedMinutes!==planner.duration(s.blocks) || !Number.isInteger(s.actualMinutes) || s.actualMinutes<0 || s.actualMinutes>s.plannedMinutes || !Array.isArray(s.history)) throw new Error('Estado, horas o historial inválidos.');
      if(!before.sessions.some(x=>x.id===s.id) && !planner.canManage(actor,s.ficha)) throw new Error('Ficha no administrada.');
    }
    for(const s of next.sessions){
      const old=before.sessions.find(x=>x.id===s.id);
      if(JSON.stringify(old)!==JSON.stringify(s)){
        if(s.status==='Realizada'&&s.actualMinutes!==s.plannedMinutes || s.status==='Parcial'&&!(s.actualMinutes>0&&s.actualMinutes<s.plannedMinutes) || ['Programada','Suspendida','Reprogramada'].includes(s.status)&&s.actualMinutes!==0)throw new Error('Minutos incoherentes con el estado.');
        if(s.status!=='Suspendida'&&next.sessions.some(o=>o.id!==s.id&&o.status!=='Suspendida'&&o.date===s.date&&(o.ficha===s.ficha||o.instructorId===s.instructorId&&planner.overlap(o.blocks,s.blocks))))throw new Error('Conflicto de sesión o franja en el borrador a guardar.');
      }
    }
    integration.validateExtensions(next,before,actor);
    const value=JSON.parse(JSON.stringify(next));
    if(JSON.stringify(next.history)!==JSON.stringify(before.history))value.importedHistories=(before.importedHistories||[]).concat([{sourceRevision:next.revision,history:next.history,reason}]);
    value.revision=before.revision+1;
    value.history=before.history.concat([{at:new Date().toISOString(),actor:actor.id,reason,previousRevision:before.revision,revision:value.revision,configurationBefore:before.years,configurationAfter:value.years}]);
    storage.setItem(KEY,JSON.stringify(value)); // Quota errors propagate; never claim success.
    return value;
  }
  return {KEY,empty,load,save};
});
