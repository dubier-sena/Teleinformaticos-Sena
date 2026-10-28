/* Progressive annual setup over the existing planner controller and store. */
(function(window){'use strict';
window.academicPlannerAnnualUI=function(ctx){
 const $=id=>document.getElementById(id),A=window.academicPlannerAnnual,P=window.academicPlanner,C=window.academicPlannerCalendar,I=window.academicPlannerIntegration;
 const copy=x=>JSON.parse(JSON.stringify(x)),esc=C.esc||function(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));};
 const titles=['Año','Instituciones','Fichas','Horarios','Vacaciones y recesos','Rotaciones','Vista previa','Confirmación'];
 const fieldIds=['institution','institution-name','institution-type','institution-hours','known-ficha','new-ficha','new-grade','new-program','schedule-ficha','weekday','schedule-blocks','break-start','break-end','break-kind','breaks-reviewed','rotation-start','rotation-institution','turn-weeks','inactive-weeks','recalculate-from','recalculate-reason','config-reason','annual-start','annual-end','annual-create-classes','annual-block-start','annual-block-end','turn-fichas'];
 let collection=A.read(localStorage),step=0,month='',day='',showMobilePreview=false,currentDraft=null,unpersisted=false,proposal=null,newFlow=false;
 const working=new Map();
 const state=ctx.state,check=(ok,msg)=>{if(!ok)throw new Error(msg);};
 const settings=()=>({start:$('annual-start').value,end:$('annual-end').value,createClasses:$('annual-create-classes').checked===true});
 function on(id,fn,event='click'){$(id).addEventListener(event,async e=>{e.preventDefault();try{$('annual-error').textContent='';await fn(e);}catch(err){ctx.message(err.message,true);$('annual-error').textContent=err.message;}});}
 function opts(id,rows,selected){const el=$(id),old=selected??el.value;el.innerHTML=rows.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('');if(rows.some(([v])=>String(v)===old))el.value=old;}
 function fields(){return Object.fromEntries(fieldIds.map(id=>[id,id==='turn-fichas'?[...$('turn-fichas').selectedOptions].map(o=>o.value):$(id).type==='checkbox'||['annual-create-classes','breaks-reviewed'].includes(id)?!!$(id).checked:$(id).value]));}
 function capture(){return {config:copy(state().config),step,fields:fields(),baseRevision:currentDraft?.baseRevision??state().saved.revision,confirmed:false,unpersisted};}
 function stash(){if(currentDraft||state().dirty||unpersisted)working.set(state().config.year,capture());}
 function defaults(){const y=state().config.year;$('annual-start').value='';$('annual-end').value='';$('annual-create-classes').checked=!state().saved.sessions.some(s=>s.year===y);$('config-reason').value='';$('annual-ack').checked=false;month=y+'-01';day=y+'-01-01';}
 function restore(d){defaults();if(!d)return;if(d.fields?.institution)$('institution').value=d.fields.institution;ctx.syncInstitution();if(d.fields?.['rotation-institution'])$('rotation-institution').value=d.fields['rotation-institution'];ctx.syncTurnFichas();for(const [id,value] of Object.entries(d.fields||{})){if(!fieldIds.includes(id))continue;if(Array.isArray(value))$(id).querySelectorAll('option').forEach(o=>o.selected=value.includes(o.value));else if(typeof value==='boolean')$(id).checked=value;else $(id).value=value;}step=d.step;currentDraft=d;unpersisted=!!d.unpersisted;month=(d.fields?.['annual-start']||state().config.year+'-01-01').slice(0,7);day=month+'-01';}
 function changeYear(year,template){
  P.createYear(year);check(!state().hasPreview,'Confirma o descarta la propuesta abierta antes de cambiar de año.');stash();const d=working.get(year)||collection.years[year];currentDraft=d&&!d.confirmed?copy(d):null;step=0;unpersisted=false;
  let config=currentDraft?.config;
  if(!config&&!state().saved.years[year]&&template){config=P.createYear(year);const source=state().saved.years[template];check(source,'Selecciona un año de referencia existente.');config.institutions=copy(source.institutions);}
  ctx.loadYear(year,config,!!currentDraft||!!config);defaults();restore(currentDraft);$('annual-year').value=year;
  if(!currentDraft&&config){unpersisted=true;currentDraft=capture();}
  if(year===2026&&!state().saved.sessions.some(s=>s.year===year)&&ctx.historical().length)$('calendar-source').value='legacy';
  ctx.render();notice();refresh();
 }
 function notice(){const y=state().config.year,d=working.get(y)||collection.years[y];const present=currentDraft||d&&!d.confirmed||state().dirty||unpersisted;$('resume-annual').hidden=!present;$('annual-resume-notice').hidden=!present;$('annual-resume-notice').textContent=present?`Año ${y}: ${unpersisted?'cambios sin guardar':'borrador de configuración disponible'}. Puedes continuar mientras consultas el calendario.`:'';const available=new Map(Object.entries(collection.years).map(([year,d])=>[Number(year),d]));for(const [year,d] of working)available.set(year,d);$('annual-draft-years').innerHTML=[...available].filter(([year,d])=>year!==y&&!d.confirmed).map(([year,d])=>'<button data-resume-year="'+year+'">Continuar borrador '+year+' · paso '+(d.step+1)+'</button>').join('');}
 function start(create){
  ctx.showCalendar();newFlow=!!create;if(create){let y=Math.max(2027,state().config.year+1);while(state().saved.years[y]||working.has(y)||collection.years[y]&&!collection.years[y].confirmed)y++;changeYear(Math.min(y,9998));$('annual-year').value=Math.min(y,9998);}
  else {const d=working.get(state().config.year)||collection.years[state().config.year];if(!currentDraft&&d&&!d.confirmed)changeYear(state().config.year);$('annual-year').value=state().config.year;}
  opts('annual-template',[['','Empezar con el catálogo de instituciones'],...Object.keys(state().saved.years).map(y=>[y,'Usar instituciones de '+y])]);$('annual-template').disabled=!create;
  $('config-dialog').showModal();showMobilePreview=false;refresh();focusStep();
 }
 function focusStep(){document.querySelector(`[data-annual-step="${step}"] h3`)?.focus();}
 function mark(){unpersisted=true;currentDraft=currentDraft||capture();$('annual-ack').checked=false;ctx.markDirty();notice();refresh();}
 function checkStep(){const {config}=state();if(step===0){const y=Number($('annual-year').value);P.createYear(y);if(newFlow)check(!state().saved.years[y],'Este año ya existe. Ciérralo y ábrelo con el selector del calendario.');if(y!==config.year||newFlow){changeYear(y,$('annual-template').value);newFlow=false;}$('annual-template').disabled=true;}
  if(step===1)check(config.institutions.length,'Agrega una institución.');
  if(step===2)check(config.fichas.length,'Agrega al menos una ficha.');
  if(step===3&&settings().createClasses){A.period(config,settings());check(config.fichas.every(f=>config.schedules.some(s=>s.ficha===f.id)),'Agrega un horario para cada ficha o desmarca la creación de clases nuevas.');}
  if(step===4)check(config.fichas.every(f=>config.breaksReviewed.includes(f.institutionId)),'Revisa los recesos de cada institución con fichas antes de continuar.');
  if(step===5){ctx.syncRotation();P.validateConfig(config);}
  if(step===6){refresh();check(proposal?.complete,'Corrige los avisos de la propuesta antes de confirmar.');}
 }
 function paintColors(){const registry=I.identityRegistry(state().saved,state().config.fichas.map(f=>f.id));$('annual-calendar').querySelectorAll('[data-identity]').forEach(el=>{const v=registry[el.dataset.identity];el.style.borderLeftColor=v.color;el.style.backgroundColor=v.color+'12';el.style.color='#20352A';});}
 function refresh(){
  const {config,saved}=state();if(step===5)ctx.syncRotation();if(!month.startsWith(config.year+'-')){month=config.year+'-01';day=month+'-01';}
  $('available-years').innerHTML=[...new Set([2026,2027,2028,config.year,...Object.keys(saved.years).map(Number),...Object.keys(collection.years).map(Number)])].sort((a,b)=>a-b).map(y=>'<option value="'+y+'"></option>').join('');
  $('config-title').textContent=(newFlow?'Crear año académico':'Configurar '+config.year);
  $('annual-progress').textContent=`Paso ${step+1} / 8 · ${titles[step]}`;
  document.querySelectorAll('[data-annual-step]').forEach(el=>el.hidden=Number(el.dataset.annualStep)!==step);
  $('annual-back').disabled=step===0;$('annual-next').hidden=step===7;$('annual-confirm').hidden=step!==7;
  $('config-dialog').classList.toggle('show-annual-preview',showMobilePreview);$('annual-toggle-preview').textContent=showMobilePreview?'Volver al formulario':'Ver calendario propuesto';$('annual-toggle-preview').setAttribute('aria-expanded',String(showMobilePreview));
  $('annual-month').value=month;$('annual-month').min=config.year+'-01';$('annual-month').max=config.year+'-12';$('annual-prev-month').disabled=month.endsWith('-01');$('annual-next-month').disabled=month.endsWith('-12');
  const institutions=config.institutions.map(i=>[i.id,i.name]);for(const id of ['annual-ficha-institution','annual-break-institution'])opts(id,institutions,$('institution').value);
  $('annual-ficha-list').innerHTML=config.fichas.map(f=>`<li>${esc(f.id)} · ${esc(f.grade)} · ${esc(config.institutions.find(i=>i.id===f.institutionId)?.name)}</li>`).join('')||'<li>Aún no has agregado fichas.</li>';
  $('annual-institution-context').textContent='Las fichas se agregan al borrador; podrás revisar sus recesos en el paso 5.';
  const used=[...new Set(config.fichas.map(f=>f.institutionId))];$('annual-break-progress').textContent=used.length?used.filter(id=>config.breaksReviewed.includes(id)).length+' de '+used.length+' instituciones con recesos revisados.':'Agrega primero las fichas.';
  proposal=null;let error='';try{proposal=A.propose(saved,config,settings(),state().actor);}catch(e){error=e.message;}
  const p=proposal||{sessions:[],confirmed:saved.sessions.filter(s=>s.year===config.year),warnings:[],conflicts:[],complete:false};
  const proposed=p.sessions.map(s=>({...s,proposal:true})),all=C.numbered(p.confirmed.concat(proposed));
  $('annual-preview-status').textContent=`${p.sessions.length} clases propuestas · ${p.confirmed.length} confirmadas. ${settings().createClasses?'Las propuestas se crearán solo al confirmar.':'Solo se confirmará la configuración; los horarios son orientativos.'}`;
  const warnings=[error,...p.conflicts,...p.warnings].filter(Boolean);$('annual-warnings').innerHTML=warnings.length?'<details'+(error||p.conflicts.length?' open':'')+'><summary>'+warnings.length+' avisos para revisar</summary><ul>'+warnings.slice(0,15).map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'+(warnings.length>15?'<p>Hay más coincidencias del mismo tipo; corrige el horario para actualizar.</p>':'')+'</details>':'';
  $('annual-calendar').innerHTML=C.month(month+'-01',all,config,P.holidays(config.year),'','');
  $('annual-day-detail').innerHTML='<h4>'+esc(C.label(day))+'</h4>'+all.filter(s=>s.date===day).map(s=>'<p>'+esc((s.proposal?'Propuesta':'Confirmada')+' · '+s.ficha+' · '+s.blocks.map(b=>b.start+'–'+b.end).join(' / ')+' · '+s.plannedMinutes+' min · '+I.displayStatus(s))+'</p>').join('');
  const summary=`${config.year}: ${config.institutions.filter(i=>used.includes(i.id)).length} instituciones, ${config.fichas.length} fichas, ${config.schedules.length} horarios y ${config.breaks.length} recesos. Se añadirán ${settings().createClasses?p.sessions.length:0} clases; se conservan ${p.confirmed.length} existentes.`;
  $('annual-review').textContent=summary;$('annual-final-summary').textContent=summary;
  $('annual-confirm').disabled=!p.complete||state().busy;$('annual-rebase').hidden=!currentDraft||currentDraft.baseRevision===saved.revision;
  renderBlockList();paintColors();notice();
 }
 async function save(){
  check(navigator.locks,'Este navegador no permite guardar borradores con bloqueo entre pestañas.');
  // Year choice is applied even when saving directly from step 1.
  if(step===0)checkStep();const d=capture();d.unpersisted=false;
  await navigator.locks.request(A.KEY,()=>{collection=A.saveDraft(localStorage,d,collection.revision);});
  unpersisted=false;currentDraft=copy(collection.years[d.config.year]);working.set(d.config.year,currentDraft);$('annual-save-status').textContent='Borrador guardado · año '+d.config.year+' · paso '+(step+1)+'. Puedes cerrar y continuar después.';notice();
 }

 function rawBlocks(){return $('schedule-blocks').value.trim()?$('schedule-blocks').value.split(';').map(b=>{const [start,end]=b.trim().split(/[-–]/);return {start:start?.trim(),end:end?.trim()};}):[];}
 function renderBlockList(){$('annual-block-list').innerHTML=rawBlocks().map((b,i)=>'<li>'+esc((b.start||'')+'–'+(b.end||''))+' <button data-remove-draft-block="'+i+'">Quitar franja</button></li>').join('')||'<li>Agrega la primera franja con su hora de inicio y fin.</li>';}
 function loadSchedule(){const s=state().config.schedules.find(s=>s.ficha===$('schedule-ficha').value&&s.weekday===Number($('weekday').value));$('schedule-blocks').value=(s?.blocks||[]).map(b=>b.start+'-'+b.end).join(';');renderBlockList();}
 ['schedule-ficha','weekday'].forEach(id=>on(id,loadSchedule,'change'));
 on('annual-add-block',()=>{check($('schedule-ficha').value,'Agrega y selecciona una ficha primero.');const blocks=P.blocks(rawBlocks().concat({start:$('annual-block-start').value,end:$('annual-block-end').value}));$('schedule-blocks').value=blocks.map(b=>b.start+'-'+b.end).join(';');ctx.applySchedule();$('annual-block-start').value='';$('annual-block-end').value='';renderBlockList();});
 $('annual-block-list').addEventListener('click',e=>{const b=e.target.closest('[data-remove-draft-block]');if(!b)return;try{const blocks=rawBlocks();blocks.splice(Number(b.dataset.removeDraftBlock),1);$('schedule-blocks').value=blocks.map(b=>b.start+'-'+b.end).join(';');if(blocks.length)ctx.applySchedule();else ctx.removeCurrentSchedule();renderBlockList();}catch(error){ctx.message(error.message,true);}});
 on('annual-next',()=>{checkStep();step=Math.min(7,step+1);showMobilePreview=step===6;refresh();focusStep();});
 on('annual-back',()=>{step=Math.max(0,step-1);showMobilePreview=false;refresh();focusStep();});
 on('annual-save',save);on('annual-toggle-preview',()=>{showMobilePreview=!showMobilePreview;refresh();if(showMobilePreview)$('annual-month').focus();else focusStep();});
 $('annual-draft-years').addEventListener('click',e=>{const button=e.target.closest('[data-resume-year]');if(!button)return;try{changeYear(Number(button.dataset.resumeYear));start(false);}catch(error){ctx.message(error.message,true);}});
 on('create-academic-year',()=>start(true));on('resume-annual',()=>start(false));
 ['annual-ficha-institution','annual-break-institution'].forEach(id=>on(id,()=>{$('institution').value=$(id).value;ctx.syncInstitution();refresh();},'change'));
 ['annual-start','annual-end','annual-create-classes'].forEach(id=>on(id,()=>{if(id==='annual-start'&&$('annual-start').value){month=$('annual-start').value.slice(0,7);day=$('annual-start').value;}mark();},'change'));
 on('annual-month',()=>{const m=$('annual-month').value;check(m.startsWith(state().config.year+'-')&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m),'Selecciona un mes de este año.');month=m;day=m+'-01';refresh();},'change');
 for(const [id,delta] of [['annual-prev-month',-1],['annual-next-month',1]])on(id,()=>{month=C.move(month+'-01','month',delta,state().config.year).slice(0,7);day=month+'-01';refresh();});
 $('config-dialog').addEventListener('input',e=>{if(fieldIds.includes(e.target.id)){unpersisted=true;$('annual-ack').checked=false;notice();}});
 $('config-dialog').addEventListener('close',()=>{stash();notice();});
 $('annual-calendar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;day=b.dataset.date||b.dataset.day||proposal?.sessions.concat(proposal.confirmed).find(s=>s.id===b.dataset.session)?.date||day;month=day.slice(0,7);refresh();});
 on('annual-rebase',()=>{check(currentDraft,'No hay borrador pendiente.');currentDraft.baseRevision=state().saved.revision;step=6;showMobilePreview=true;unpersisted=true;$('annual-ack').checked=false;refresh();ctx.message('Borrador contrastado con el estado local actual. Revisa de nuevo las fechas y la configuración antes de confirmar.');});
 on('annual-confirm',async()=>{
  check(!state().busy,'Espera a que termine el guardado.');ctx.syncRotation();
  check(!currentDraft||currentDraft.baseRevision===state().saved.revision,'Este borrador se inició antes de otros cambios confirmados. Recarga y revisa su configuración antes de aplicarlo.');
  const {saved,config,actor}=state(),next=A.confirm(saved,config,settings(),actor,$('config-reason').value,$('annual-ack').checked);
  ctx.stage(next,$('annual-final-summary').textContent,'<p>Configuración revisada en los ocho pasos.</p>',$('config-reason').value);
  await ctx.commit();
  const y=config.year;currentDraft=null;unpersisted=false;working.delete(y);
  try{await navigator.locks.request(A.KEY,()=>{collection=A.finishDraft(localStorage,y,collection.revision);});}catch(e){ctx.message('Programación confirmada. No se pudo cerrar el borrador: '+e.message,true);}
  $('annual-save-status').textContent='Programación confirmada localmente.';step=0;notice();
 });
 // A scoped read model is prepared explicitly; no learner login or academic write.
 function learnerData(){const y=Number($('preview-student-year').value),source=$('preview-student-source').value,{saved,catalog}=state();let snapshot=copy(saved),config=saved.years[y];
  if(source==='proposal'){const d=y===state().config.year?capture():working.get(y)||collection.years[y];check(d&&!d.confirmed,'No hay un borrador de configuración disponible para este año.');config=copy(d.config);const f=d.fields||{},p=A.propose(saved,config,{start:f['annual-start'],end:f['annual-end'],createClasses:!!f['annual-create-classes']},{...state().actor,fichas:config.fichas.map(f=>f.id)});snapshot.years[y]=config;snapshot.sessions=snapshot.sessions.concat(p.sessions.map(s=>({...s,observation:'PROGRAMACIÓN PROPUESTA · aún sin confirmar'})));}
  if(source==='legacy'){check(y===2026,'La referencia histórica disponible corresponde a 2026.');config=P.createYear(2026);config.fichas=copy(catalog.fichas);snapshot={...snapshot,years:{2026:config},sessions:copy(ctx.historical()),deadlines:[],administrative:[],recoveries:[]};}
  check(config,'Este año aún no tiene configuración confirmada. Selecciona un borrador disponible.');return {snapshot,config,source};
 }
 function studentOptions(resetInstitution){$('student-preview-link').hidden=true;try{const {config}=learnerData();opts('preview-student-institution',config.institutions.filter(i=>config.fichas.some(f=>f.institutionId===i.id)).map(i=>[i.id,i.name]),resetInstitution?'':undefined);opts('preview-student-ficha',config.fichas.filter(f=>f.institutionId===$('preview-student-institution').value).map(f=>[f.id,f.id+' · '+f.grade]));$('preview-student-info').textContent=config.fichas.length?'Agenda, semana y mes de la ficha elegida.':'Este año todavía no tiene fichas para previsualizar.';}catch(e){opts('preview-student-institution',[]);opts('preview-student-ficha',[]);$('preview-student-info').textContent=e.message;}}
 on('open-student-preview',()=>{stash();const years=[...new Set([2026,state().config.year,...Object.keys(state().saved.years).map(Number),...working.keys(),...Object.keys(collection.years).map(Number)])].sort();opts('preview-student-year',years.map(y=>[String(y),String(y)]),String(state().config.year));$('preview-student-source').value=state().dirty||currentDraft?'proposal':state().saved.years[state().config.year]?'local':'legacy';studentOptions(true);$('student-preview-dialog').showModal();});
 ['preview-student-year','preview-student-source'].forEach(id=>on(id,()=>studentOptions(true),'change'));on('preview-student-institution',()=>studentOptions(false),'change');on('preview-student-ficha',()=>{$('student-preview-link').hidden=true;},'change');
 on('prepare-student-link',()=>{const {snapshot,config,source}=learnerData(),ficha=$('preview-student-ficha').value,f=config.fichas.find(f=>f.id===ficha&&f.institutionId===$('preview-student-institution').value);check(f,'Selecciona una institución y una ficha.');const events=I.toAgenda(snapshot,{role:'aprendiz',ficha},config.year).map(e=>({...e,route:''})),token=String(Date.now())+'-'+Math.random().toString(36).slice(2),sourceLabel={local:'Programación confirmada local',proposal:'PROGRAMACIÓN PROPUESTA · sin confirmar',legacy:'Referencia histórica local de 2026'}[source];const model={token,year:config.year,date:events[0]?.date||config.year+'-01-01',events,identities:I.identityRegistry(snapshot,[ficha]),sourceLabel,context:{ficha,grupo:f.grade,institucionShort:config.institutions.find(i=>i.id===f.institutionId)?.name,hasProductiveStage:false}};localStorage.setItem(A.PREVIEW_KEY,JSON.stringify(model));$('student-preview-link').href='pages/auxiliares/calendario-aprendiz.html?preview=local&token='+encodeURIComponent(token);$('student-preview-link').hidden=false;$('preview-student-info').textContent=sourceLabel+' · ficha '+ficha+' · '+events.length+' eventos/franjas. Abre la agenda para consultar las tres vistas.';$('student-preview-link').focus();});
 window.addEventListener('storage',e=>{if(e.key===A.KEY)ctx.message('Otro borrador anual cambió en una pestaña. Conserva tus cambios y recarga antes de guardarlos.',true);});
 defaults();notice();refresh();
 return {start,changeYear,refresh,changed:mark,stash,isSaved:()=>!unpersisted&&!Array.from(working.values()).some(d=>d.unpersisted),confirmed(){currentDraft=null;unpersisted=false;},historicalPreview:learnerData};
};
})(window);
