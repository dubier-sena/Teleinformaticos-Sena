(function(root){
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // 2026-10-29: edición directa del calendario oficial (las mismas sesiones que ve el aprendiz). Al abrir la página se
 // conecta sola; seleccionar una clase muestra «Editar», «Suspender» e «Historial». Todo cambio pasa por una vista
 // previa y se guarda con motivo, recibo de auditoría y lectura posterior (academic_calendar_cloud.js).
 root.academicCalendarCloudUI=function({state,render,select,message}){
  const E=root.academicCalendarEditor,Cloud=root.academicCalendarCloud;
  let api,principal,docs=[],sources=[],notes=new Map(),pending=null,loadedYear=null,events=null,busy=false;
  const locked=d=>E.taught(d);
  const holidays=()=>root.academicPlanner?.holidays(state().year)||[];
  const internal=d=>notes.has(d.id)?notes.get(d.id):sources.filter(r=>d.sourceStatuses.some(s=>s.sourceId===r.sourceId)).map(r=>r.observation).filter(Boolean).join(' / ');
  const data=()=>docs.map(d=>d.data);
  const label=d=>E.fichaLabel(d.ficha)+' · '+d.date+' · '+d.blocks.map(b=>b.start+'–'+b.end).join(', ');
  const source=$('calendar-source'),host=document.createElement('section');host.id='cloud-controls';host.className='cloud-controls';
  host.innerHTML='<p id="cloud-status" role="status">Conectando con el calendario oficial…</p><div class="actions">'
   +'<button id="cloud-connect" class="c-btn c-btn--secondary" type="button">Actualizar desde Firestore</button>'
   +'<button id="cloud-new" class="c-btn c-btn--primary" type="button" hidden>+ Crear clase</button>'
   +'<button id="cloud-bulk" class="c-btn c-btn--secondary" type="button" hidden>Editar varias clases</button>'
   +'<button id="cloud-events" class="c-btn c-btn--secondary" type="button" hidden>Novedades (Sede SENA)</button>'
   +'<button id="cloud-edit" class="c-btn c-btn--secondary" type="button" hidden>Editar clase seleccionada</button>'
   +'<button id="cloud-history" class="c-btn c-btn--secondary" type="button" hidden>Historial de la clase</button>'
   +'<button id="cloud-review-draft" class="c-btn c-btn--ghost" type="button" hidden>Enviar sesiones del asistente a Firestore</button>'
   +'<a id="cloud-learner" hidden target="_blank" rel="noopener">Abrir vista del aprendiz en emulador</a></div><p id="cloud-month-events" class="cloud-month-events"></p>';
  document.querySelector('.quick-actions').after(host);
  const statusOptions=s=>[...new Set([...E.EDITABLE,...(s&&!E.EDITABLE.includes(s.status)?[s.status]:[])])];
  const fichaOptions=(inst,keep)=>(principal?.fichas||[]).filter(f=>!inst||E.institutionOf(f)===inst||f===keep).map(f=>'<option value="'+esc(f)+'">'+esc(E.fichaLabel(f))+'</option>').join('');
  // ── Diálogo de edición individual ──
  const dialog=document.createElement('dialog');dialog.id='cloud-dialog';dialog.className='cloud-dialog';dialog.setAttribute('aria-labelledby','cloud-title');
  dialog.innerHTML='<div class="dialog-header"><h2 id="cloud-title">Editar clase</h2><button id="cloud-close" type="button">Cerrar</button></div>'
   +'<p id="cloud-before" class="view-hint"></p><p role="alert" id="cloud-error"></p><form id="cloud-form" novalidate><div class="grid">'
   +'<label>Institución<select id="cloud-institution"><option value="john-f-kennedy">'+esc(E.INSTITUTIONS['john-f-kennedy'])+'</option><option value="santa-barbara">'+esc(E.INSTITUTIONS['santa-barbara'])+'</option></select></label>'
   +'<label>Grupo / ficha<select id="cloud-ficha"></select></label><label>Fecha<input id="cloud-date" type="date" required></label>'
   +'<label>Estado<select id="cloud-state"></select></label><label id="cloud-minutes-wrap" hidden>Minutos impartidos (clase parcial)<input id="cloud-minutes" type="number" min="1"></label></div>'
   +'<p id="cloud-state-note" class="view-hint" hidden>Clase impartida o histórica: puede corregir fecha, horario, actividad y observación. El estado registrado se conserva.</p>'
   +'<fieldset class="cloud-blocks"><legend>Franjas horarias</legend><div id="cloud-block-rows"></div><button id="cloud-add-block" type="button" class="c-btn c-btn--ghost">+ Agregar franja</button></fieldset>'
   +'<label>Actividad programada (la ve el aprendiz)<textarea id="cloud-activity" maxlength="4000" rows="2"></textarea></label>'
   +'<details><summary>Evidencia y fecha límite (opcional)</summary><label>Evidencia o entrega (la ve el aprendiz)<textarea id="cloud-evidence" maxlength="4000" rows="2"></textarea></label><label>Fecha límite de entrega<input id="cloud-due" type="date"></label></details>'
   +'<label>Observación interna (solo instructor; el aprendiz no la ve)<textarea id="cloud-observation" maxlength="8000" rows="2"></textarea></label>'
   +'<label>Motivo del cambio (obligatorio; queda en el historial)<input id="cloud-reason" maxlength="2000"></label>'
   +'<button class="c-btn c-btn--primary" type="submit">Ver vista previa</button></form>'
   +'<section id="cloud-review" class="cloud-review" hidden tabindex="-1"><h3>Revise antes de guardar</h3><div id="cloud-diff"></div><div class="actions"><button id="cloud-save" class="c-btn c-btn--primary" type="button">Confirmar y guardar</button><button id="cloud-back" class="c-btn c-btn--secondary" type="button">Volver a editar</button></div></section>';
  document.body.append(dialog);
  function blockRow(b={start:'',end:''}){const row=document.createElement('div');row.className='cloud-block-row';
   row.innerHTML='<label>Inicio<input type="time" data-part="start" value="'+esc(b.start)+'"></label><label>Fin<input type="time" data-part="end" value="'+esc(b.end)+'"></label><button type="button" class="c-btn c-btn--ghost" data-remove-block aria-label="Quitar franja">Quitar</button>';
   return row;}
  function setBlocks(list){const host=$('cloud-block-rows');host.innerHTML='';(list.length?list:[{start:'',end:''}]).forEach(b=>host.append(blockRow(b)));}
  const readBlocks=hostId=>[...$(hostId).querySelectorAll('.cloud-block-row')].map(r=>({start:r.querySelector('[data-part=start]').value,end:r.querySelector('[data-part=end]').value}));
  function syncState(){const s=$('cloud-state').value;$('cloud-minutes-wrap').hidden=s!=='Parcial';}
  function syncFichas(){const keep=pending?.before?.data.ficha;const current=$('cloud-ficha').value;$('cloud-ficha').innerHTML=fichaOptions($('cloud-institution').value,null);
   if([...$('cloud-ficha').options].some(o=>o.value===current))$('cloud-ficha').value=current;else if(keep&&E.institutionOf(keep)===$('cloud-institution').value)$('cloud-ficha').value=keep;}
  function hideReview(){$('cloud-review').hidden=true;if(pending)pending={before:pending.before};}
  async function open(before,{date}={}){
   if(!principal||principal.role==='aprendiz')return;
   pending={before};$('cloud-error').textContent='';$('cloud-review').hidden=true;$('cloud-form').hidden=false;$('cloud-save').hidden=false;
   const s=before?.data;$('cloud-title').textContent=s?'Editar clase':'Crear clase';
   $('cloud-institution').value=s?E.institutionOf(s.ficha):(E.institutionOf(state().filterFicha)||'john-f-kennedy');syncFichas();
   if(s)$('cloud-ficha').value=s.ficha;else if(state().filterFicha&&principal.fichas.includes(state().filterFicha))$('cloud-ficha').value=state().filterFicha;
   $('cloud-ficha').disabled=!!s&&locked(s);$('cloud-institution').disabled=!!s&&locked(s);
   $('cloud-date').value=s?.date||date||state().date;setBlocks(s?s.blocks:[]);
   const fixed=!!s&&locked(s);$('cloud-state').innerHTML=statusOptions(s).map(x=>'<option>'+esc(x)+'</option>').join('');
   $('cloud-state').value=s?.status||'Programada';$('cloud-state').disabled=fixed||!s;$('cloud-state-note').hidden=!fixed;syncState();
   $('cloud-minutes').value=s?.status==='Parcial'?s.actualMinutes??'':'';$('cloud-activity').value=s?.activity||'';$('cloud-evidence').value=s?.evidence||'';$('cloud-due').value=s?.dueDate||'';
   $('cloud-observation').value=s?internal(s):'';$('cloud-reason').value='';
   $('cloud-before').textContent=s?'Versión '+s.revision+' · '+label(s)+' · '+s.status+(s.origin==='legacy'?' · importada del calendario anterior':''):'Clase nueva: nace Programada. Una ficha tiene a lo sumo una clase por día; para sumar franjas, edite la clase existente.';
   dialog.showModal();
   // La observación interna se lee aquí (1 lectura) para no listar todas las notas al abrir la página.
   if(s&&!notes.has(s.id))try{const o=await api.note(s.ficha,s.year,s.id);notes.set(s.id,o);if(pending?.before===before&&$('cloud-review').hidden)$('cloud-observation').value=o||internal(s);}catch(e){$('cloud-error').textContent=e.message;}
  }
  function describe(plan){
   const rows=list=>'<table class="cloud-diff-table"><thead><tr><th>Campo</th><th>Antes</th><th>Después</th></tr></thead><tbody>'+list.map(r=>'<tr><th scope="row">'+esc(r.label)+'</th><td>'+esc(r.before)+'</td><td><strong>'+esc(r.after)+'</strong></td></tr>').join('')+'</tbody></table>';
   const notesBefore=plan.before?internal(plan.before):'',noteChange=plan.observation!==undefined&&plan.observation!==notesBefore;
   let html='';
   if(plan.mode==='transfer')html+='<p><strong>Traslado a otra ficha.</strong></p><h4>'+esc(E.fichaLabel(plan.before.ficha))+'</h4>'+rows(E.diff(plan.before,plan.next))+'<h4>Nueva clase en '+esc(E.fichaLabel(plan.target.ficha))+'</h4>'+rows(E.diff(null,plan.target));
   else{const d=E.diff(plan.before,plan.next);html+=d.length?rows(d):'<p>Sin cambios en los datos que ve el aprendiz.</p>';}
   if(noteChange)html+='<p>Observación interna (solo instructor): «'+esc(notesBefore||'—')+'» → «'+esc(plan.observation||'—')+'»</p>';
   html+='<p>Motivo: '+esc(plan.reason)+'</p>';
   if(plan.warnings.length)html+='<ul class="cloud-warnings">'+plan.warnings.map(w=>'<li>⚠ '+esc(w)+'</li>').join('')+'</ul>';
   if(plan.errors.length)html+='<ul class="cloud-errors" role="alert">'+plan.errors.map(w=>'<li>✖ '+esc(w)+'</li>').join('')+'</ul>';
   return html;
  }
  $('cloud-form').onsubmit=e=>{e.preventDefault();$('cloud-error').textContent='';
   try{const before=pending?.before;
    const form={ficha:$('cloud-ficha').value,date:$('cloud-date').value,blocks:readBlocks('cloud-block-rows'),status:$('cloud-state').value,actualMinutes:$('cloud-minutes').value,
     activity:$('cloud-activity').value,evidence:$('cloud-evidence').value,dueDate:$('cloud-due').value,observation:$('cloud-observation').value,reason:$('cloud-reason').value};
    const plan=E.planSingle(before?.data||null,form,data(),{holidays:holidays(),uid:principal.uid,newId:'class_'+crypto.randomUUID().replace(/-/g,'')});
    if(plan.mode==='update'&&!E.diff(plan.before,plan.next).length&&plan.observation===internal(plan.before))throw Error('No hay cambios para guardar.');
    if(plan.mode==='transfer'){plan.observationBefore=(internal(before.data)?internal(before.data)+'\n':'')+'Trasladada a la ficha '+plan.target.ficha+' el '+plan.target.date+'.';plan.observationTarget=(form.observation&&form.observation!==internal(before.data)?form.observation+'\n':'')+'Trasladada desde la ficha '+before.data.ficha+' ('+before.data.date+').';}
    if(plan.mode!=='transfer')Cloud.validate({...plan.next,revision:plan.next.revision+1,mutationId:'x',updatedBy:principal.uid});
    pending={before,plan};$('cloud-diff').innerHTML=describe(plan);$('cloud-save').hidden=plan.errors.length>0;$('cloud-review').hidden=false;$('cloud-form').hidden=true;$('cloud-review').focus();
   }catch(err){$('cloud-error').textContent=err.message;}};
  $('cloud-form').oninput=hideReview;$('cloud-state').onchange=()=>{syncState();hideReview();};$('cloud-institution').onchange=()=>{syncFichas();hideReview();};
  $('cloud-add-block').onclick=()=>{if($('cloud-block-rows').children.length<6)$('cloud-block-rows').append(blockRow());hideReview();};
  dialog.addEventListener('click',e=>{const b=e.target.closest('[data-remove-block]');if(!b)return;const rows=$('cloud-block-rows');if(rows.children.length>1)b.closest('.cloud-block-row').remove();hideReview();});
  $('cloud-back').onclick=()=>{$('cloud-review').hidden=true;$('cloud-form').hidden=false;};
  $('cloud-close').onclick=()=>dialog.close();
  function store(d,observation){const i=docs.findIndex(x=>x.data.id===d.data.id&&x.data.ficha===d.data.ficha);const clean={data:d.data,updateTime:d.updateTime,name:d.name};if(i<0)docs.push(clean);else docs[i]=clean;if(observation!==undefined)notes.set(d.data.id,observation);}
  $('cloud-save').onclick=async()=>{const work=pending;if(!work?.plan&&!work?.batch||busy)return;busy=true;$('cloud-save').disabled=true;$('cloud-error').textContent='Guardando y verificando en Firestore…';
   try{
    if(work.batch){for(const item of work.batch){const r=await api.save(item,null,'Programación revisada del asistente');store(r,'');}dialog.close();render();message(work.batch.length+' clases guardadas y verificadas en Firestore.');return;}
    const p=work.plan;let selected;
    if(p.mode==='transfer'){const r=await api.transfer(work.before,p.target,p.reason,{observationBefore:p.observationBefore,observationTarget:p.observationTarget});store(r.original,r.original.observation);store(r.target,r.target.observation);selected=r.target.data;}
    else{const r=await api.save(p.next,work.before||null,p.reason,{observation:p.observation});store(r,r.observation);selected=r.data;}
    pending=null;dialog.close();select(selected);render();message('Cambio guardado y verificado en Firestore. Los aprendices de la ficha lo verán al abrir su calendario.');
   }catch(e){$('cloud-error').textContent=e.message+(e.code==='CONFLICT'?' Pulse «Actualizar desde Firestore» y repita el cambio.':' No se reintenta automáticamente.');}
   finally{busy=false;$('cloud-save').disabled=false;}};
  // ── Edición de varias clases ──
  const bulk=document.createElement('dialog');bulk.id='cloud-bulk-dialog';bulk.className='cloud-dialog';bulk.setAttribute('aria-labelledby','cloud-bulk-title');
  bulk.innerHTML='<div class="dialog-header"><h2 id="cloud-bulk-title">Editar varias clases</h2><button id="cloud-bulk-close" type="button">Cerrar</button></div><p role="alert" id="cloud-bulk-error"></p>'
   +'<form id="cloud-bulk-form" novalidate><fieldset><legend>1. Elija las clases</legend><div class="grid"><label>Desde<input id="cloud-bulk-from" type="date"></label><label>Hasta<input id="cloud-bulk-to" type="date"></label>'
   +'<label>Institución<select id="cloud-bulk-institution"><option value="">Todas</option><option value="john-f-kennedy">'+esc(E.INSTITUTIONS['john-f-kennedy'])+'</option><option value="santa-barbara">'+esc(E.INSTITUTIONS['santa-barbara'])+'</option></select></label>'
   +'<label>Ficha<select id="cloud-bulk-ficha"></select></label></div><div id="cloud-bulk-list" class="cloud-bulk-list"></div></fieldset>'
   +'<fieldset><legend>2. Elija el cambio (deje en blanco lo que no cambia)</legend><div class="grid"><label>Nuevo estado<select id="cloud-bulk-status"><option value="">Sin cambio</option>'+E.EDITABLE.filter(s=>s!=='Parcial').map(s=>'<option>'+s+'</option>').join('')+'</select></label>'
   +'<label>Mover días (+7 = una semana después)<input id="cloud-bulk-shift" type="number" min="-180" max="180" value="0"></label></div>'
   +'<label class="check"><input id="cloud-bulk-use-blocks" type="checkbox"> Reemplazar las franjas por:</label><div id="cloud-bulk-blocks" hidden><div class="cloud-block-row"><label>Inicio<input type="time" data-part="start"></label><label>Fin<input type="time" data-part="end"></label></div><div class="cloud-block-row"><label>Inicio 2 (opcional)<input type="time" data-part="start"></label><label>Fin 2<input type="time" data-part="end"></label></div></div>'
   +'<label class="check"><input id="cloud-bulk-use-activity" type="checkbox"> Reemplazar la actividad por:</label><textarea id="cloud-bulk-activity" rows="2" maxlength="4000" hidden></textarea>'
   +'<label>Agregar a la observación interna (opcional)<input id="cloud-bulk-note" maxlength="1000"></label><label>Motivo (obligatorio; queda en el historial de cada clase)<input id="cloud-bulk-reason" maxlength="2000"></label></fieldset>'
   +'<button class="c-btn c-btn--primary" type="submit">Ver vista previa</button></form>'
   +'<section id="cloud-bulk-review" class="cloud-review" hidden tabindex="-1"><h3>Revise antes de guardar</h3><div id="cloud-bulk-diff"></div><div class="actions"><button id="cloud-bulk-save" class="c-btn c-btn--primary" type="button">Confirmar y guardar</button><button id="cloud-bulk-back" class="c-btn c-btn--secondary" type="button">Volver</button></div><p id="cloud-bulk-progress" role="status"></p></section>';
  document.body.append(bulk);
  let bulkPlan=null;
  function bulkCandidates(){const from=$('cloud-bulk-from').value,to=$('cloud-bulk-to').value,inst=$('cloud-bulk-institution').value,f=$('cloud-bulk-ficha').value;
   return data().filter(d=>(!from||d.date>=from)&&(!to||d.date<=to)&&(!inst||E.institutionOf(d.ficha)===inst)&&(!f||d.ficha===f)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.ficha<b.ficha?-1:1);}
  function renderBulkList(){const list=bulkCandidates();$('cloud-bulk-list').innerHTML=list.length?'<p><label class="check"><input type="checkbox" id="cloud-bulk-all" checked> Todas ('+list.length+')</label></p>'+list.map(d=>'<label class="check"><input type="checkbox" data-bulk-id="'+esc(d.id)+'" checked> '+esc(label(d))+' · '+esc(d.status)+(locked(d)?' · impartida':'')+'</label>').join(''):'<p>No hay clases con estos filtros.</p>';bulkPlan=null;$('cloud-bulk-review').hidden=true;}
  function openBulk(){if(!principal||principal.role==='aprendiz')return;const d=state().date,mon=E.addDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));
   $('cloud-bulk-from').value=mon;$('cloud-bulk-to').value=E.addDays(mon,4);$('cloud-bulk-ficha').innerHTML='<option value="">Todas</option>'+fichaOptions('',null);
   ['cloud-bulk-status','cloud-bulk-note','cloud-bulk-reason','cloud-bulk-activity'].forEach(id=>$(id).value='');$('cloud-bulk-shift').value='0';$('cloud-bulk-use-blocks').checked=false;$('cloud-bulk-use-activity').checked=false;
   $('cloud-bulk-blocks').hidden=true;$('cloud-bulk-activity').hidden=true;$('cloud-bulk-error').textContent='';$('cloud-bulk-progress').textContent='';$('cloud-bulk-form').hidden=false;renderBulkList();bulk.showModal();}
  ['cloud-bulk-from','cloud-bulk-to','cloud-bulk-ficha'].forEach(id=>$(id).addEventListener('change',renderBulkList));
  $('cloud-bulk-institution').onchange=()=>{$('cloud-bulk-ficha').innerHTML='<option value="">Todas</option>'+fichaOptions($('cloud-bulk-institution').value,null);renderBulkList();};
  $('cloud-bulk-use-blocks').onchange=()=>{$('cloud-bulk-blocks').hidden=!$('cloud-bulk-use-blocks').checked;};$('cloud-bulk-use-activity').onchange=()=>{$('cloud-bulk-activity').hidden=!$('cloud-bulk-use-activity').checked;};
  bulk.addEventListener('change',e=>{if(e.target.id==='cloud-bulk-all')bulk.querySelectorAll('[data-bulk-id]').forEach(x=>{x.checked=e.target.checked;});bulkPlan=null;$('cloud-bulk-review').hidden=true;});
  $('cloud-bulk-form').onsubmit=e=>{e.preventDefault();$('cloud-bulk-error').textContent='';
   try{const ids=[...bulk.querySelectorAll('[data-bulk-id]:checked')].map(x=>x.dataset.bulkId);
    const op={status:$('cloud-bulk-status').value||undefined,shiftDays:Number($('cloud-bulk-shift').value||0),reason:$('cloud-bulk-reason').value,noteAppend:$('cloud-bulk-note').value};
    if($('cloud-bulk-use-blocks').checked)op.blocks=readBlocks('cloud-bulk-blocks');if($('cloud-bulk-use-activity').checked)op.activity=$('cloud-bulk-activity').value;
    bulkPlan=E.planBulk(data(),ids,op,{holidays:holidays()});
    const rows=bulkPlan.items.map(it=>{const d=E.diff(it.before,it.next);return '<li><strong>'+esc(label(it.before))+'</strong>: '+(d.length?d.map(r=>esc(r.label)+' '+esc(r.before)+' → '+esc(r.after)).join(' · '):'solo observación interna')+'</li>';}).join('');
    $('cloud-bulk-diff').innerHTML='<p>'+bulkPlan.items.length+' clases cambiarán'+(bulkPlan.unchanged?' ('+bulkPlan.unchanged+' quedan igual)':'')+'. Cada una se guarda y verifica por separado, en este orden.</p><ol>'+rows+'</ol>'
     +(bulkPlan.noteAppend?'<p>Se agrega a la observación interna: «'+esc(bulkPlan.noteAppend)+'»</p>':'')+'<p>Motivo: '+esc(bulkPlan.reason)+'</p>'
     +(bulkPlan.warnings.length?'<ul class="cloud-warnings">'+bulkPlan.warnings.map(w=>'<li>⚠ '+esc(w)+'</li>').join('')+'</ul>':'')
     +(bulkPlan.errors.length?'<ul class="cloud-errors" role="alert">'+bulkPlan.errors.map(w=>'<li>✖ '+esc(w)+'</li>').join('')+'</ul>':'');
    $('cloud-bulk-save').hidden=!!bulkPlan.errors.length||!bulkPlan.items.length;$('cloud-bulk-form').hidden=true;$('cloud-bulk-review').hidden=false;$('cloud-bulk-review').focus();
   }catch(err){$('cloud-bulk-error').textContent=err.message;}};
  $('cloud-bulk-back').onclick=()=>{$('cloud-bulk-review').hidden=true;$('cloud-bulk-form').hidden=false;};
  $('cloud-bulk-close').onclick=()=>bulk.close();
  $('cloud-bulk-save').onclick=async()=>{const plan=bulkPlan;if(!plan||busy)return;busy=true;$('cloud-bulk-save').disabled=true;let done=0;
   try{for(const it of plan.items){$('cloud-bulk-progress').textContent='Guardando '+(done+1)+' de '+plan.items.length+'…';
     const before=docs.find(d=>d.data.id===it.before.id&&d.data.ficha===it.before.ficha);
     const r=await api.save(it.next,before,plan.reason,{appendObservation:plan.noteAppend});store(r,r.observation);done++;}
    bulkPlan=null;bulk.close();render();message(done+' clases guardadas y verificadas en Firestore.');}
   catch(e){$('cloud-bulk-progress').textContent='Se guardaron '+done+' de '+plan.items.length+'. Se detuvo en la clase '+(done+1)+': '+e.message+' Las ya guardadas quedan con su historial; pulse «Actualizar desde Firestore» antes de continuar.';render();}
   finally{busy=false;$('cloud-bulk-save').disabled=false;}};
  // ── Novedades institucionales (Sede SENA, desplazamientos, reuniones) ──
  const evDialog=document.createElement('dialog');evDialog.id='cloud-events-dialog';evDialog.className='cloud-dialog';evDialog.setAttribute('aria-labelledby','cloud-events-title');
  evDialog.innerHTML='<div class="dialog-header"><h2 id="cloud-events-title">Novedades institucionales</h2><button id="cloud-events-close" type="button">Cerrar</button></div>'
   +'<p class="view-hint">Días en Sede SENA, desplazamientos y reuniones. Son solo del instructor: no aparecen a los aprendices ni cambian clases. Para suspender clases de ese día use «Editar varias clases».</p>'
   +'<p role="alert" id="cloud-events-error"></p><div id="cloud-events-seed"></div><div id="cloud-events-list"></div>'
   +'<form id="cloud-event-form" novalidate><h3 id="cloud-event-form-title">Nueva novedad</h3><input type="hidden" id="cloud-event-id"><div class="grid"><label>Fecha<input id="cloud-event-date" type="date"></label>'
   +'<label>Tipo<select id="cloud-event-kind">'+E.EVENT_KINDS.map(k=>'<option>'+k+'</option>').join('')+'</select></label><label>Título<input id="cloud-event-title" maxlength="200" value="Sede SENA"></label>'
   +'<label>Lugar<input id="cloud-event-place" maxlength="200" value="Sede SENA"></label><label>Inicio (opcional)<input id="cloud-event-start" type="time"></label><label>Fin (opcional)<input id="cloud-event-end" type="time"></label>'
   +'<label>Estado<select id="cloud-event-status"><option>Activa</option><option>Cancelada</option></select></label></div><label>Nota<input id="cloud-event-note" maxlength="2000"></label>'
   +'<label>Motivo del cambio (obligatorio)<input id="cloud-event-reason" maxlength="500"></label><div class="actions"><button class="c-btn c-btn--primary" type="submit">Guardar novedad</button><button id="cloud-event-reset" class="c-btn c-btn--secondary" type="button">Limpiar</button></div></form>';
  document.body.append(evDialog);
  const evList=()=>events?events.data.events:E.legacyEvents(state().year);
  function renderEvents(){const seed=!events&&E.legacyEvents(state().year).length;
   $('cloud-events-seed').innerHTML=seed?'<p>Aún no hay novedades guardadas en el calendario por ficha. Abajo se ven las '+E.legacyEvents(state().year).length+' del calendario anterior (solo referencia).</p><button id="cloud-events-adopt" class="c-btn c-btn--primary" type="button">Incorporarlas al calendario por ficha (1 escritura)</button>':'';
   const month=state().date.slice(0,7);
   $('cloud-events-list').innerHTML='<table class="cloud-diff-table"><thead><tr><th>Fecha</th><th>Novedad</th><th>Estado</th><th></th></tr></thead><tbody>'+evList().map(e=>'<tr'+(e.date.slice(0,7)===month?' class="is-current-month"':'')+'><td>'+esc(e.date)+'</td><td>'+esc(e.title)+(e.start?' · '+esc(e.start+'–'+e.end):'')+(e.note?'<br><small>'+esc(e.note)+'</small>':'')+'</td><td>'+esc(e.status)+'</td><td>'+(events?'<button type="button" class="c-btn c-btn--ghost" data-event-edit="'+esc(e.id)+'">Editar</button>':'')+'</td></tr>').join('')+'</tbody></table>';
   $('cloud-event-form').hidden=!events;}
  function fillEvent(e){$('cloud-event-form-title').textContent=e?'Editar novedad del '+e.date:'Nueva novedad';$('cloud-event-id').value=e?.id||'';$('cloud-event-date').value=e?.date||state().date;$('cloud-event-kind').value=e?.kind||'SENA';
   $('cloud-event-title').value=e?.title||'Sede SENA';$('cloud-event-place').value=e?.place??'Sede SENA';$('cloud-event-start').value=e?.start||'';$('cloud-event-end').value=e?.end||'';$('cloud-event-status').value=e?.status||'Activa';$('cloud-event-note').value=e?.note||'';$('cloud-event-reason').value='';}
  async function loadEvents(){try{events=await api.events(state().year);}catch(e){events=null;$('cloud-month-events').textContent='Novedades no disponibles: '+e.message;return;}monthEvents();}
  function monthEvents(){if(!principal||principal.role==='aprendiz')return;const month=state().date.slice(0,7),list=evList().filter(e=>e.date.slice(0,7)===month);
   $('cloud-month-events').textContent=list.length?'Novedades del mes'+(events?'':' (calendario anterior)')+': '+list.map(e=>e.date.slice(8)+' · '+e.title+(e.status==='Cancelada'?' (cancelada)':'')).join(' · '):'';}
  async function writeEvents(next){if(busy)return;busy=true;$('cloud-events-error').textContent='Guardando…';
   try{events=await api.saveEvents(state().year,next,events);$('cloud-events-error').textContent='Guardado y verificado.';fillEvent(null);renderEvents();monthEvents();render();}
   catch(e){$('cloud-events-error').textContent=e.message+(e.code==='CONFLICT'?' Cierre y vuelva a abrir Novedades.':'');}finally{busy=false;}}
  evDialog.addEventListener('click',e=>{if(e.target.id==='cloud-events-adopt')writeEvents(E.eventDoc(state().year,E.legacyEvents(state().year)));
   const b=e.target.closest('[data-event-edit]');if(b)fillEvent(evList().find(x=>x.id===b.dataset.eventEdit));});
  $('cloud-event-reset').onclick=()=>fillEvent(null);$('cloud-events-close').onclick=()=>evDialog.close();
  $('cloud-event-form').onsubmit=e=>{e.preventDefault();try{const id=$('cloud-event-id').value||'ev_'+crypto.randomUUID().replace(/-/g,'').slice(0,20),old=evList().find(x=>x.id===id);
   const next=E.applyEvent(events.data,{id,legacyId:old?.legacyId||'',date:$('cloud-event-date').value,kind:$('cloud-event-kind').value,title:$('cloud-event-title').value,place:$('cloud-event-place').value,start:$('cloud-event-start').value,end:$('cloud-event-end').value,status:$('cloud-event-status').value,note:$('cloud-event-note').value},{actor:principal.uid,reason:$('cloud-event-reason').value});
   writeEvents(next);}catch(err){$('cloud-events-error').textContent=err.message;}};
  // ── Conexión y carga (lecturas mínimas: copia local por ficha y solo lo cambiado desde la última apertura) ──
  function error(e){docs=[];sources=[];notes=new Map();pending=null;principal=null;source.value='draft';document.body.classList.remove('cloud-mode');render();$('cloud-status').textContent=e.message;message(e.message,true);}
  async function reload({force=false}={}){if(busy)return;busy=true;$('cloud-status').textContent='Leyendo el calendario oficial…';
   try{api=api||root.academicCalendarConnection();principal=await api.principal();const year=state().year,next=[],nextSources=[];let storage=null;try{storage=root.localStorage;}catch{}
    for(const f of principal.fichas){const r=await api.listCached(f,year,{storage,force});next.push(...r.docs);
     if(principal.role!=='aprendiz'){const s=await api.source(f,year);if(s)nextSources.push(...(s.data.records||[]));}}
    docs=next;sources=nextSources;notes=new Map();loadedYear=year;
    if(![...source.options].some(o=>o.value==='cloud'))source.add(new Option('Calendario oficial (Firestore)','cloud'));source.value='cloud';document.body.classList.add('cloud-mode');const badge=document.querySelector('.local-badge');if(badge)badge.textContent='Calendario oficial';
    const editor=principal.role!=='aprendiz';// Editar e Historial se ofrecen en el panel de la clase seleccionada (decorate), no en la barra.
    ['cloud-new','cloud-bulk','cloud-events'].forEach(id=>$(id).hidden=!editor);
    $('cloud-review-draft').hidden=!editor||!state().saved.sessions.some(s=>s.year===year&&s.status==='Programada');
    $('cloud-status').textContent='Calendario oficial · '+docs.length+' clases de '+principal.fichas.length+' fichas · lo que guarde aquí lo ven los aprendices de cada ficha.';
    if(root.SENA_CALENDAR_FIRESTORE?.emulatorHost){$('cloud-learner').hidden=false;$('cloud-learner').href='pages/auxiliares/calendario-aprendiz.html?cloud=emulator&year='+year;}
    busy=false;if(editor)loadEvents();render();
   }catch(e){busy=false;error(e);}}
  const mapped=d=>({...d.data,institutionId:root.academicPlannerCatalog.fichas.find(f=>f.id===d.data.ficha)?.institutionId||'',instructorId:d.data.updatedBy,history:[],readonly:true,cloud:true,sourceIds:d.data.sourceStatuses.map(x=>x.sourceId),blockSources:d.data.revision===0?d.data.sourceStatuses.flatMap(x=>x.blocks.map(block=>({block,state:x.state,sourceId:x.sourceId}))):[],observation:principal?.role!=='aprendiz'?internal(d.data):'',curriculum:{...d.data.curriculum,guides:[]}});
  const selected=()=>docs.find(d=>d.data.id===state().selection);
  async function showHistory(){try{const d=selected();if(!d)throw Error('Seleccione una clase del calendario.');
    const history=await api.history(d.data.ficha,d.data.year,d.data.id),originals=sources.filter(r=>d.data.sourceStatuses.some(s=>s.sourceId===r.sourceId));
    await open(d);pending=null;$('cloud-title').textContent='Historial de la clase';$('cloud-form').hidden=true;$('cloud-review').hidden=false;$('cloud-save').hidden=true;
    $('cloud-diff').innerHTML='<ol class="cloud-history">'+history.map(h=>h.data).sort((a,b)=>a.revision-b.revision).map(h=>'<li><strong>Versión '+h.revision+'</strong> · '+esc(h.at?new Date(h.at).toLocaleString('es-CO',{timeZone:'America/Bogota'}):'importación')+' · '+esc(h.reason)
      +(h.before?'<ul>'+E.diff(h.before,h.after).map(r=>'<li>'+esc(r.label)+': '+esc(r.before)+' → '+esc(r.after)+'</li>').join('')+(h.notesBefore!==h.notesAfter?'<li>Observación interna: '+esc(h.notesBefore||'—')+' → '+esc(h.notesAfter||'—')+'</li>':'')+'</ul>':'')+'</li>').join('')+'</ol>'
      +(originals.length?'<details><summary>Registros originales del calendario anterior ('+originals.length+')</summary><pre>'+esc(JSON.stringify(originals.map(r=>({id:r.sourceId,estado:r.state,horario:r.schedule,observacion:r.observation})),null,2))+'</pre></details>':'');
   }catch(e){message(e.message,true);}}
  async function suspend(){const d=selected();if(!d)return;await open(d);$('cloud-state').value='Suspendida';syncState();$('cloud-reason').focus();}
  $('cloud-connect').onclick=()=>reload({force:true});
  $('cloud-new').onclick=()=>open(null);$('cloud-bulk').onclick=openBulk;$('cloud-events').onclick=()=>{fillEvent(null);$('cloud-events-error').textContent='';renderEvents();evDialog.showModal();};
  $('cloud-edit').onclick=()=>{const d=selected();if(!d)return message('Seleccione una clase del calendario.',true);open(d);};
  $('cloud-history').onclick=showHistory;
  $('cloud-review-draft').onclick=async()=>{try{const s=state(),batch=await Cloud.proposal(s.saved.sessions,s.year,principal,docs);
   if(!batch.length)throw Error('No hay sesiones programadas nuevas del asistente para este año.');
   await open(null);pending={batch};$('cloud-form').hidden=true;$('cloud-review').hidden=false;$('cloud-save').hidden=false;
   $('cloud-diff').innerHTML='<p>Revisar '+batch.length+' clases. Cada clase se verifica por separado; ante un conflicto se detiene el lote y se conserva lo ya confirmado.</p><ul>'+batch.map(d=>'<li>'+esc(label(d))+'</li>').join('')+'</ul>';
  }catch(e){message(e.message,true);}};
  // Acciones en el panel de detalle de la clase seleccionada y en el día.
  function decorate(s,el){if(!s?.cloud||!principal||principal.role==='aprendiz'||!el)return;
   const bar=document.createElement('div');bar.className='cloud-detail-actions actions';
   bar.innerHTML='<button type="button" class="c-btn c-btn--primary" data-cloud-act="edit">Editar esta clase</button>'+(locked(s)?'':'<button type="button" class="c-btn c-btn--secondary" data-cloud-act="suspend">Suspender</button>')+'<button type="button" class="c-btn c-btn--secondary" data-cloud-act="history">Historial</button>';
   el.prepend(bar);const obs=el.querySelector('h3:last-of-type + p');
   if(!notes.has(s.id)&&obs)api.note(s.ficha,s.year,s.id).then(o=>{notes.set(s.id,o);if(state().selection===s.id&&o)obs.textContent=o;}).catch(()=>{});}
  function decorateDay(date,el){if(!principal||principal.role==='aprendiz'||!el)return;const list=evList().filter(e=>e.date===date);
   const box=document.createElement('div');box.className='cloud-detail-actions';
   box.innerHTML=list.map(e=>'<p class="date-note">'+esc(e.title)+(e.status==='Cancelada'?' (cancelada)':'')+(e.note?' · '+esc(e.note):'')+'</p>').join('')+'<button type="button" class="c-btn c-btn--primary" data-cloud-act="new-day">+ Crear clase este día</button>';
   el.append(box);}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-cloud-act]');if(!b)return;const act=b.dataset.cloudAct;
   if(act==='edit')$('cloud-edit').click();if(act==='suspend')suspend();if(act==='history')showHistory();if(act==='new-day')open(null,{date:state().date});});
  const yearInput=$('year');if(yearInput)yearInput.addEventListener('change',()=>{if(principal&&Number(yearInput.value)!==loadedYear)setTimeout(()=>reload(),0);});
  $('load-year')?.addEventListener('click',()=>{if(principal)setTimeout(()=>reload(),0);});
  // 2026-10-28: asignaciones de cuentas POSPUESTAS (migración futura). El calendario usa el perfil existente.
  if(root.SENA_CALENDAR_FIRESTORE?.enabled)setTimeout(()=>reload(),0);
  return {reference:()=>source.value==='cloud'?docs.filter(d=>d.data.year===state().year).map(mapped):null,fichas:()=>principal?.fichas||[],reload,decorate,decorateDay,monthChanged:monthEvents};
 };
})(window);
