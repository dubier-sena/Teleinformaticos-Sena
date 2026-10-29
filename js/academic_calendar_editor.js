/* Edición directa del calendario por ficha (2026-10-29). Lógica pura, sin red: arma la sesión resultante, detecta
 * conflictos (misma ficha y fecha, festivo, cruce de horario del instructor) y describe el cambio para la vista
 * previa. El guardado real lo hace academic_calendar_cloud.js (save/transfer) y las reglas lo vuelven a validar. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.academicCalendarEditor=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const INSTITUTIONS={'john-f-kennedy':'I.E. John F. Kennedy','santa-barbara':'I.E. Santa Bárbara'};
  const FICHAS={'3441939':{institutionId:'john-f-kennedy',grade:'10A'},'3441942':{institutionId:'john-f-kennedy',grade:'10B'},
    '3441944':{institutionId:'santa-barbara',grade:'10A'},'3441950':{institutionId:'santa-barbara',grade:'10B'},
    '3168850':{institutionId:'santa-barbara',grade:'11A'},'3168852':{institutionId:'santa-barbara',grade:'11B'}};
  // Estados que el instructor puede asignar (los mismos que aceptan las reglas desplegadas al actualizar).
  const EDITABLE=['Programada','Reprogramada','Suspendida','Parcial','Realizada'];
  const fichaLabel=f=>FICHAS[f]?INSTITUTIONS[FICHAS[f].institutionId].replace('I.E. ','')+' '+FICHAS[f].grade+' · '+f:'Ficha '+f;
  const institutionOf=f=>FICHAS[f]?.institutionId||'';
  const taught=d=>!!d&&(d.protected||['Realizada','Impartida'].includes(d.status));
  // Retirada = quitada del calendario (retiro lógico, restaurable). No ocupa su día ni cuenta para cruces.
  const retired=d=>!!d&&d.status==='Retirada';
  const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const HHMM=/^([01]\d|2[0-3]):[0-5]\d$/;
  function fail(text,code){const e=new Error(text);if(code)e.code=code;throw e;}
  function addDays(date,n){return new Date(Date.parse(date+'T12:00:00Z')+n*864e5).toISOString().slice(0,10);}
  function weekday(date){return new Date(date+'T12:00:00Z').getUTCDay();}
  // Franjas desde filas {start,end}: ordenadas, sin solaparse, entre 1 y 6 (mismo límite de las reglas).
  function blocks(rows){
    const list=(rows||[]).map(r=>({start:String(r.start||'').trim(),end:String(r.end||'').trim()})).filter(r=>r.start||r.end);
    if(!list.length)fail('Agregue al menos una franja horaria.');
    if(list.length>6)fail('Máximo seis franjas por clase.');
    for(const b of list){if(!HHMM.test(b.start)||!HHMM.test(b.end))fail('Use horas completas (HH:MM) en cada franja.');if(b.start>=b.end)fail('La franja '+b.start+'–'+b.end+' termina antes de empezar.');}
    list.sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:0);
    for(let i=1;i<list.length;i++)if(list[i].start<list[i-1].end)fail('Las franjas '+list[i-1].start+'–'+list[i-1].end+' y '+list[i].start+'–'+list[i].end+' se cruzan.');
    return list;
  }
  const duration=bs=>bs.reduce((t,b)=>t+mins(b.end)-mins(b.start),0);
  const overlaps=(a,b)=>a.some(x=>b.some(y=>x.start<y.end&&y.start<x.end));
  const active=d=>!['Suspendida','Cancelada','Retirada'].includes(d.status);
  // Errores bloquean el guardado; advertencias se muestran en la vista previa.
  function placement(next,docs,{holidays=[],ignore=[]}={}){
    const errors=[],warnings=[],skip=new Set([next.id,...ignore]);
    const holiday=holidays.find(h=>h.date===next.date);
    if(holiday&&active(next))errors.push('El '+next.date+' es festivo ('+holiday.names.join(', ')+'). Los festivos se conservan sin clases.');
    if([0,6].includes(weekday(next.date)))warnings.push('El '+next.date+' es fin de semana.');
    const same=docs.find(d=>!skip.has(d.id)&&!retired(d)&&d.ficha===next.ficha&&d.date===next.date);
    if(same)errors.push('La ficha '+next.ficha+' ya tiene una clase el '+next.date+' ('+same.blocks.map(b=>b.start+'–'+b.end).join(', ')+'). Edite esa clase para agregarle franjas; así no se duplica.');
    if(active(next))for(const d of docs.filter(d=>!skip.has(d.id)&&d.ficha!==next.ficha&&d.date===next.date&&active(d)&&overlaps(d.blocks,next.blocks)))
      warnings.push('Cruce de horario con '+fichaLabel(d.ficha)+' ('+d.blocks.map(b=>b.start+'–'+b.end).join(', ')+').');
    return {errors,warnings};
  }
  function minutesFor(status,value,planned){
    if(status==='Parcial'){const n=Number(value);if(!Number.isInteger(n)||n<=0||n>=planned)fail('En una clase parcial indique los minutos impartidos (entre 1 y '+(planned-1)+').');return n;}
    if(status==='Realizada')return value===''||value===null||value===undefined?null:(Number(value)===planned?planned:fail('Una clase realizada registra la duración completa ('+planned+' min) o se deja sin minutos.'));
    return null;
  }
  // Edición individual. form: {ficha,date,blocks:[{start,end}],status,actualMinutes,activity,evidence,dueDate,observation,reason}.
  // Si cambia la ficha de una clase existente se arma un TRASLADO: la original queda Suspendida (no se borra) y nace
  // una clase nueva en la ficha destino, ambas en el mismo guardado atómico.
  function planSingle(before,form,docs,{holidays=[],uid='',newId}={}){
    const reason=String(form.reason||'').trim();if(!reason)fail('Indique el motivo del cambio; queda en el historial.');
    if(!FICHAS[form.ficha])fail('Ficha no válida.');
    const bs=blocks(form.blocks),planned=duration(bs),errors=[],warnings=[];
    const base={date:String(form.date||''),blocks:bs,plannedMinutes:planned,activity:String(form.activity||''),evidence:String(form.evidence||''),dueDate:String(form.dueDate||'')};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(base.date))fail('Indique la fecha de la clase.');
    if(base.dueDate&&base.dueDate<base.date)fail('La fecha límite de entrega no puede ser anterior a la clase.');
    if(!before){
      const next={id:newId,ficha:form.ficha,year:Number(base.date.slice(0,4)),originalDate:base.date,...base,actualMinutes:null,status:'Programada',
        curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses:[],origin:'new',protected:false,revision:0,mutationId:'draft',updatedBy:uid};
      if(form.status&&form.status!=='Programada')warnings.push('Las clases nuevas se crean Programadas; cambie el estado después de impartirla.');
      const p=placement(next,docs,{holidays});
      return {mode:'create',next,observation:String(form.observation||''),reason,errors:[...errors,...p.errors],warnings:[...warnings,...p.warnings]};
    }
    const b=before;
    if(retired(b))fail('Esta clase está retirada del calendario. Restáurela primero.');
    if(Number(base.date.slice(0,4))!==b.year)fail('La clase debe quedar dentro del año '+b.year+'.');
    if(form.ficha!==b.ficha){
      if(taught(b))fail('Una clase impartida o histórica no se traslada de ficha; corrija su fecha u horario en su propia ficha.');
      const original={...clone(b),status:'Suspendida',actualMinutes:null};
      const target={id:newId,ficha:form.ficha,year:b.year,originalDate:base.date,...base,actualMinutes:null,status:'Programada',
        curriculum:{id:'',competencyCode:'',competency:'',rap:'',order:'',source:''},sourceStatuses:[],origin:'new',protected:false,revision:0,mutationId:'draft',updatedBy:uid};
      const p=placement(target,docs,{holidays,ignore:[b.id]});
      return {mode:'transfer',before:b,next:original,target,reason,observation:String(form.observation||''),
        errors:p.errors,warnings:[...p.warnings,'La clase de la ficha '+b.ficha+' queda Suspendida (se conserva en su historial) y se crea la clase en la ficha '+form.ficha+'.']};
    }
    const fixed=taught(b);
    let status=fixed?b.status:String(form.status||b.status);
    if(!fixed&&![...EDITABLE,b.status].includes(status))fail('Estado no permitido: '+status+'.');
    const sameSlots=JSON.stringify(bs)===JSON.stringify(b.blocks);
    // Corregir las franjas de una clase impartida ajusta su duración documentada (Realizada = duración completa).
    const actual=fixed?(sameSlots||b.actualMinutes===null?b.actualMinutes:status==='Realizada'?planned:Math.min(b.actualMinutes,planned)):minutesFor(status,form.actualMinutes,planned);
    const next={...clone(b),...base,status,actualMinutes:actual};
    if(fixed&&(next.date!==b.date||!sameSlots))warnings.push('Corrección de una clase impartida: el estado «'+b.status+'» se conserva y el cambio queda en el historial.');
    if(status==='Realizada'&&b.status!=='Realizada')warnings.push('Al marcarla Realizada el estado queda fijo (no podrá volver a Programada).');
    if(next.date!==b.date&&status===b.status&&['Programada','Activa'].includes(status))warnings.push('Cambio de fecha: considere el estado «Reprogramada» si la clase se movió por una novedad.');
    const p=placement(next,docs,{holidays});
    return {mode:'update',before:b,next,reason,observation:form.observation===undefined?undefined:String(form.observation),errors:p.errors,warnings:[...warnings,...p.warnings]};
  }
  // Edición de varias clases: mismo cambio aplicado a cada una, con vista previa y orden de guardado seguro.
  // op: {status?, shiftDays?, blocks?, activity?, evidence?, dueDate?, noteAppend?, reason}
  function planBulk(docs,ids,op,{holidays=[]}={}){
    const reason=String(op.reason||'').trim();if(!reason)fail('Indique el motivo del cambio; queda en el historial de cada clase.');
    const chosen=docs.filter(d=>ids.includes(d.id)&&!retired(d));if(!chosen.length)fail('Seleccione al menos una clase.');
    if(op.retire)return planRetire(docs,chosen.map(d=>d.id),reason);
    const shift=Number(op.shiftDays||0);if(!Number.isInteger(shift)||Math.abs(shift)>180)fail('Desplazamiento de días inválido.');
    const bs=op.blocks?blocks(op.blocks):null;
    if(op.status&&!EDITABLE.includes(op.status))fail('Estado no permitido: '+op.status+'.');
    if(op.status==='Parcial')fail('El estado Parcial necesita los minutos de cada clase; edítela individualmente.');
    if(!op.status&&!shift&&!bs&&op.activity===undefined&&op.evidence===undefined&&op.dueDate===undefined&&!op.noteAppend)fail('Elija al menos un cambio para aplicar.');
    const items=[],errors=[],warnings=[];
    for(const b of chosen){
      const next=clone(b),fixed=taught(b);
      if(shift)next.date=addDays(b.date,shift);
      if(bs){next.blocks=clone(bs);next.plannedMinutes=duration(bs);if(next.actualMinutes!==null&&next.actualMinutes>next.plannedMinutes)next.actualMinutes=fixed?null:next.plannedMinutes;}
      if(op.status&&!fixed){next.status=op.status;next.actualMinutes=null;}
      if(op.status&&fixed&&op.status!==b.status)warnings.push(fichaLabel(b.ficha)+' '+b.date+': clase impartida, su estado «'+b.status+'» se conserva.');
      if(fixed&&next.status==='Realizada'&&next.actualMinutes!==null)next.actualMinutes=next.plannedMinutes;
      if(op.activity!==undefined)next.activity=String(op.activity);
      if(op.evidence!==undefined)next.evidence=String(op.evidence);
      if(op.dueDate!==undefined)next.dueDate=String(op.dueDate);
      if(next.dueDate&&next.dueDate<next.date)errors.push(fichaLabel(b.ficha)+' '+b.date+': la fecha límite quedaría antes de la clase.');
      if(Number(next.date.slice(0,4))!==b.year)errors.push(fichaLabel(b.ficha)+' '+b.date+': quedaría fuera del año '+b.year+'.');
      items.push({before:b,next});
    }
    // Conflictos contra el estado FINAL: las clases movidas en el mismo lote liberan su día.
    const finalDocs=docs.filter(d=>!ids.includes(d.id)).concat(items.map(i=>i.next));
    for(const it of items){if(JSON.stringify(it.next)===JSON.stringify(it.before)&&!op.noteAppend)continue;const p=placement(it.next,finalDocs,{holidays});
      p.errors.forEach(e=>errors.push(fichaLabel(it.next.ficha)+' '+it.before.date+': '+e));p.warnings.forEach(w=>warnings.push(fichaLabel(it.next.ficha)+' '+it.before.date+': '+w));}
    // Orden: cada clase se guarda cuando su nuevo día ya está libre (las reglas exigen un único día ocupado por ficha).
    const pending=items.filter(i=>JSON.stringify(i.next)!==JSON.stringify(i.before)||op.noteAppend),order=[],occupied=new Map(docs.map(d=>[d.ficha+'|'+d.date,d.id]));
    let guard=pending.length+1;
    while(order.length<pending.length&&guard-->0){
      for(const it of pending){if(order.includes(it))continue;const key=it.next.ficha+'|'+it.next.date,owner=occupied.get(key);
        if(owner&&owner!==it.before.id)continue;occupied.delete(it.before.ficha+'|'+it.before.date);occupied.set(key,it.before.id);order.push(it);}
    }
    if(order.length<pending.length)errors.push('Los cambios de fecha se cruzan entre sí (intercambio de días). Muévalos en dos pasos.');
    return {items:order,unchanged:items.length-pending.length,reason,noteAppend:String(op.noteAppend||'').trim(),errors,warnings};
  }
  // Quitar del calendario (una o varias). Las impartidas, protegidas o ya retiradas se omiten con aviso, nunca se tocan.
  function planRetire(docs,ids,reason){
    const motive=String(reason||'').trim();if(!motive)fail('Indique el motivo para quitar la clase; queda en el historial.');
    const items=[],warnings=[];
    for(const b of docs.filter(d=>ids.includes(d.id))){
      if(retired(b)){warnings.push(fichaLabel(b.ficha)+' '+b.date+': ya estaba retirada.');continue;}
      if(taught(b)){warnings.push(fichaLabel(b.ficha)+' '+b.date+': clase impartida o histórica protegida; se conserva.');continue;}
      items.push({before:b,next:{...clone(b),status:'Retirada',actualMinutes:null}});
    }
    if(!items.length)fail('Ninguna de las clases elegidas se puede quitar (impartidas, protegidas o ya retiradas).');
    return {retire:true,items,unchanged:0,reason:motive,noteAppend:'',errors:[],warnings};
  }
  // Restaurar: vuelve Programada en su misma fecha, si ese día sigue libre para la ficha y no es festivo.
  function planRestore(before,docs,{holidays=[],reason}={}){
    if(!retired(before))fail('La clase no está retirada.');
    const motive=String(reason||'').trim();if(!motive)fail('Indique el motivo de la restauración.');
    const next={...clone(before),status:'Programada',actualMinutes:null},p=placement(next,docs,{holidays});
    return {mode:'update',before,next,reason:motive,observation:undefined,errors:p.errors,warnings:p.warnings};
  }
  const WEEKDAYS=['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
  // Franjas de referencia de una ficha: las que tienen sus clases vigentes del calendario oficial ese día de la semana
  // (el portal no guarda otro horario oficial en la nube). Si ese día no tiene clases, se ofrecen las de otros días.
  function usualBlocks(docs,ficha,date){
    const wd=weekday(date),pool=docs.filter(d=>d.ficha===ficha&&!retired(d)&&!['Suspendida','Cancelada'].includes(d.status));
    const count=list=>{const m=new Map();for(const d of list)for(const b of d.blocks){const k=b.start+'-'+b.end;m.set(k,(m.get(k)||0)+1);}
      return [...m].map(([k,n])=>({start:k.slice(0,5),end:k.slice(6),count:n})).sort((a,b)=>a.start<b.start?-1:a.start>b.start?1:a.end<b.end?-1:1);};
    const same=pool.filter(d=>weekday(d.date)===wd),patterns=new Map();
    for(const d of same){const k=d.blocks.map(b=>b.start+'-'+b.end).join(',');patterns.set(k,{blocks:clone(d.blocks),count:(patterns.get(k)?.count||0)+1});}
    const best=[...patterns.values()].sort((a,b)=>b.count-a.count)[0]||null;
    return {weekday:WEEKDAYS[wd],sameDay:count(same),otherDays:same.length?[]:count(pool),suggested:best?best.blocks:[]};
  }
  const FIELDS=[['ficha','Ficha',v=>fichaLabel(v)],['date','Fecha'],['blocks','Franjas',v=>v.map(b=>b.start+'–'+b.end).join(', ')],['plannedMinutes','Minutos previstos'],
    ['status','Estado'],['actualMinutes','Minutos impartidos',v=>v===null?'sin documentar':v],['activity','Actividad (la ve el aprendiz)',v=>v||'—'],
    ['evidence','Evidencia (la ve el aprendiz)',v=>v||'—'],['dueDate','Fecha límite',v=>v||'—']];
  function diff(before,next){
    return FIELDS.filter(([k])=>!before||JSON.stringify(before[k])!==JSON.stringify(next[k])).map(([k,label,f=v=>String(v)])=>({field:k,label,before:before?f(before[k]):'—',after:f(next[k])}));
  }
  // Novedades institucionales del calendario anterior (sin ficha; no las ve el aprendiz). Copia fiel de los registros
  // no lectivos de data/calendario_2026_records.js (tests/academic_calendar_editor.test.cjs lo comprueba).
  const LEGACY_EVENTS_2026=[['2026-02-23|SP','2026-02-23','DESPLAZAMIENTO','I.E. Santa Bárbara','🚗 Desplazamiento – Sin clases en institución'],
    ['2026-02-24|SP','2026-02-24','REUNIÓN RECTOR','I.E. Santa Bárbara','🤝 Reunión con Rector – Sin clases'],
    ...['03-02','03-09','04-06','04-13','05-04','05-11','06-01','07-06','07-13','08-03','08-10','08-31','09-07','09-28','10-26','11-09'].map(d=>['2026-'+d+'|SENA','2026-'+d,'SENA','Sede SENA',''])];
  const EVENT_KINDS=['SENA','DESPLAZAMIENTO','REUNIÓN RECTOR','REUNIÓN INSTITUCIONAL','OTRA NOVEDAD'];
  function legacyEvents(year){return year===2026?LEGACY_EVENTS_2026.map(([legacyId,date,kind,place,note])=>({id:'legacy_'+legacyId.replace(/[^0-9A-Za-z]+/g,'_'),legacyId,date,kind,
    title:kind==='SENA'?'Sede SENA':kind.charAt(0)+kind.slice(1).toLowerCase(),place,start:'',end:'',status:'Activa',note})):[];}
  function eventDoc(year,events){return {schemaVersion:1,year,events,history:[]};}
  // Agregar, editar o cancelar UNA novedad; devuelve el documento nuevo con el cambio en su historial (nunca se borra).
  function applyEvent(doc,input,{actor,reason,at=new Date().toISOString()}){
    const motive=String(reason||'').trim();if(!motive)fail('Indique el motivo del cambio de la novedad.');
    const e={id:String(input.id||''),legacyId:String(input.legacyId||''),date:String(input.date||''),kind:String(input.kind||''),title:String(input.title||'').trim(),place:String(input.place||'').trim(),
      start:String(input.start||''),end:String(input.end||''),status:input.status==='Cancelada'?'Cancelada':'Activa',note:String(input.note||'')};
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(e.id))fail('Identificador de novedad inválido.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||Number(e.date.slice(0,4))!==doc.year)fail('La fecha de la novedad debe ser del año '+doc.year+'.');
    if(!EVENT_KINDS.includes(e.kind))fail('Tipo de novedad no válido.');if(!e.title)fail('Indique el título de la novedad.');
    if(e.start||e.end){if(!HHMM.test(e.start)||!HHMM.test(e.end)||e.start>=e.end)fail('Horario de la novedad inválido.');}
    if(e.note.length>2000||e.title.length>200||e.place.length>200)fail('Texto de la novedad demasiado largo.');
    const next=clone(doc),i=next.events.findIndex(x=>x.id===e.id),before=i<0?null:next.events[i];
    if(before&&JSON.stringify(before)===JSON.stringify(e))fail('No hay cambios en la novedad.');
    if(i<0)next.events.push(e);else next.events[i]=e;
    next.events.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.id<b.id?-1:1);
    next.history.push({at,actor:String(actor||''),reason:motive,eventId:e.id,before,after:e});
    return next;
  }
  return {retired,planRetire,planRestore,usualBlocks,INSTITUTIONS,FICHAS,EDITABLE,EVENT_KINDS,legacyEvents,eventDoc,applyEvent,fichaLabel,institutionOf,taught,blocks,duration,placement,planSingle,planBulk,diff,addDays};
});
