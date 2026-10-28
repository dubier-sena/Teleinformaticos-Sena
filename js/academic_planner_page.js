(function(){
  'use strict';
  const $=id=>document.getElementById(id), P=window.academicPlanner, Store=window.academicPlannerStore, Catalog=window.academicPlannerCatalog;
  const clone=x=>JSON.parse(JSON.stringify(x)), escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const C=window.academicPlannerCalendar;
  let saved, config, preview=null, dirty=false, busy=false, workspace=null,annual=null,cloud=null;
  let selectedDate='2026-01-01',view='month',selectedSession=null,wizardStep=0,ready=false;
  const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const actor=()=>({id:'instructor-local',role:'instructor',fichas:[...new Set([...config.fichas.map(f=>f.id),...saved.sessions.map(s=>s.ficha)])]});
  const message=(text,error=false)=>{ $('planner-message').textContent=text; $('planner-message').classList.toggle('error',error);const dialog=document.querySelector('dialog[open]');if(error&&dialog){let target=dialog.querySelector('[role=alert]');if(!target){target=document.createElement('p');target.setAttribute('role','alert');dialog.querySelector('.dialog-header').after(target);}target.textContent=text;target.tabIndex=-1;target.focus();} };
  function check(ok,text){if(!ok)throw new Error(text);}
  function on(id,fn,event='click'){ $(id).addEventListener(event,async e=>{e.preventDefault();try{await fn(e);}catch(err){message(err.message,true);if($('local-save-state'))$('local-save-state').textContent='ERROR · '+err.message;}}); }
  function options(id,list,selected){const el=$(id),old=selected??el.value;el.innerHTML=list.map(([v,t])=>`<option value="${escape(v)}">${escape(t)}</option>`).join('');if(list.some(([v])=>v===old))el.value=old;}
  function clearPreview(){preview=null;$('preview').hidden=true;if($('local-save-state'))$('local-save-state').textContent=dirty?'PENDIENTE · configuración sin confirmar':'GUARDADO · local';if(ready)renderCalendar();}
  function invalidate(){dirty=true;if(annual)annual.changed();clearPreview();message('Cambios en el borrador sin confirmar. Revisa la configuración para guardarlos.');}
  function inst(){return config.institutions.find(i=>i.id===$('institution').value);}
  function formRotation(){
    const turns=config.rotation?.turns||[];
    if(!turns.length&&!$('rotation-start').value){config.rotation=null;return;}
    config.rotation={start:$('rotation-start').value,turns,inactiveWeeks:$('inactive-weeks').value.split(',').map(s=>s.trim()).filter(Boolean)};
  }
  function renderInstitution(){
    const i=inst();$('institution-name').value=i.name;$('institution-type').value=i.type;$('institution-hours').value=i.weeklyHours;
    $('breaks-reviewed').checked=config.breaksReviewed.includes(i.id);
    $('break-list').innerHTML=config.breaks.map((b,index)=>b.institutionId===i.id?`<li>${escape(b.start)} a ${escape(b.end)} <button data-break="${index}" class="c-btn c-btn--ghost">Retirar del borrador</button></li>`:'').join('');
    options('known-ficha',Catalog.fichas.filter(f=>f.institutionId===i.id).map(f=>[f.id,`${f.id} · ${f.grade}`]));
    renderFichas();
  }
  function renderFichas(){
    const list=config.fichas.map(f=>[f.id,`${f.id} · ${f.grade} · ${config.institutions.find(i=>i.id===f.institutionId)?.name}`]);
    ['schedule-ficha','student-ficha'].forEach(id=>options(id,list));
    options('plan-institution',config.institutions.map(i=>[i.id,i.name]));renderPlanFichas();if(ready)renderFilterOptions();
    renderCurriculum();renderSchedules();renderTurnFichas();renderStudent();
  }
  function renderPlanFichas(){
    options('plan-ficha',config.fichas.filter(f=>f.institutionId===$('plan-institution').value).map(f=>[f.id,f.id+' · '+f.grade]));renderCompetencies();
  }
  function renderCompetencies(){
    const items=Catalog.items.filter(i=>i.fichas.includes($('plan-ficha').value));
    options('plan-competency',[...new Map(items.map(i=>[i.competencyCode,[i.competencyCode,i.competencyCode+' · '+i.competency]])).values()]);renderCurriculum();
  }
  function renderCurriculum(){
    const items=Catalog.items.filter(i=>i.fichas.includes($('plan-ficha').value)&&i.competencyCode===$('plan-competency').value).sort((a,b)=>a.order-b.order);
    options('curriculum',items.map(i=>[i.id,`${i.needsVerification?'[REQUIERE VERIFICACIÓN] ':''}RAP ${i.order} · ${i.rap}`]));
    const item=items.find(i=>i.id===$('curriculum').value);
    $('curriculum-source').textContent=item?`Fuente: ${item.source}. ${item.needsVerification?'Este RAP está bloqueado hasta cotejar su fuente. ':''}${Catalog.notice}`:'No hay RAP con fuente local para esta ficha.';
  }
  function renderSchedules(){
    const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    $('schedule-list').innerHTML=config.schedules.map((s,index)=>`<li>${escape(s.ficha)} · ${days[s.weekday]} · ${s.blocks.map(b=>escape(b.start+'–'+b.end)).join(' / ')} · ${P.duration(s.blocks)} min por sesión <button data-schedule="${index}" class="c-btn c-btn--ghost">Retirar horario</button></li>`).join('')||'<li>Aún no hay horarios.</li>';
  }
  function renderTurnFichas(){options('turn-fichas',config.fichas.filter(f=>f.institutionId===$('rotation-institution').value).map(f=>[f.id,f.id+' · '+f.grade]));}
  function renderTurns(){ $('turn-list').innerHTML=(config.rotation?.turns||[]).map((t,index)=>`<li>${escape(config.institutions.find(i=>i.id===t.institutionId)?.name)} · ${t.weeks} semana(s) · fichas ${escape(t.fichas.join(', '))} <button data-turn="${index}" class="c-btn c-btn--ghost">Retirar turno</button></li>`).join(''); }
  function table(sessions){return '<div class="table-scroll"><table><thead><tr><th>Fecha / original</th><th>Ficha / RAP</th><th>Bloques</th><th>Minutos previstos / realizados</th><th>Estado</th></tr></thead><tbody>'+sessions.map(s=>`<tr><td>${escape(s.date)}<br>${escape(s.originalDate)}</td><td>${escape(s.ficha)}<br>${escape(s.curriculum.rap)}</td><td>${s.blocks.map(b=>escape(b.start+'–'+b.end)).join('<br>')}</td><td>${s.plannedMinutes} / ${C.executionLabel(s.actualMinutes)}</td><td>${escape(s.status)}</td></tr>`).join('')+'</tbody></table></div>';}
  function renderSessions(){
    const list=saved.sessions.filter(s=>s.year===config.year).sort((a,b)=>a.date.localeCompare(b.date));
    $('sessions').innerHTML=list.length?table(list):'<p>Aún no hay sesiones confirmadas en este año.</p>';
    options('edit-session',list.map(s=>[s.id,s.date+' · '+s.ficha+' · '+s.status]));
    renderSessionForm();$('history').textContent=JSON.stringify({configuracion:saved.history,sesiones:list.map(s=>({id:s.id,history:s.history}))},null,2);renderStudent();if(ready){renderFilterOptions();renderCalendar();}
  }
  function renderSessionForm(){const s=saved.sessions.find(s=>s.id===$('edit-session').value);if(s){$('session-status').value=s.status;$('actual-minutes').value=s.actualMinutes;$('explicit-realized').checked=false;$('session-reason').value='';$('reschedule-start').value=s.date;}}
  function renderStudent(){
    const view=P.studentView(saved.sessions.filter(s=>s.year===config.year),{role:'aprendiz',ficha:$('student-ficha').value||'sin-ficha'},{});
    $('student-view').innerHTML=view.map(s=>`<article><h3>${escape(s.date)} · ${escape(s.status)}</h3><p>${escape(s.competency)}<br>${escape(s.rap)}</p><p>${s.blocks.map(b=>escape(b.start+'–'+b.end)).join(' / ')} · ${s.plannedMinutes} minutos</p><details><summary>Guías y actividades relacionadas</summary>${s.guides.map(g=>`<h4>${escape(g.title)}</h4><p>Guía del portal: ${escape(g.file)}</p><ul>${g.activities.map(a=>`<li>${escape(a.label)} · ${a.dueAt?escape(a.dueAt):'Entrega sin fecha manual en este borrador'}</li>`).join('')}</ul>`).join('')}</details></article>`).join('')||'<p>Sin sesiones para esta ficha.</p>';
  }
  function showPreview(next,summary,details,reason,visualSessions){
    check(!busy,'Espere a que termine el guardado en curso.');if($('local-save-state'))$('local-save-state').textContent='PENDIENTE · propuesta sin confirmar';
    ['filter-institution','filter-ficha','filter-competency','filter-rap','filter-status'].forEach(id=>$(id).value='');renderFilterOptions();$('advanced-filters').open=false;
    const changed=visualSessions||next.sessions.filter(s=>JSON.stringify(s)!==JSON.stringify(saved.sessions.find(old=>old.id===s.id)));
    preview={next,revision:saved.revision,reason,visual:changed,complete:true};$('preview-summary').textContent=summary;$('preview-details').innerHTML=changed.map(after=>{const before=saved.sessions.find(s=>s.id===after.id);return `<p><strong>Ficha ${escape(after.ficha)}</strong><br>${before?'Antes: '+escape(before.date+' · '+before.status)+'<br>'+before.blocks.map(b=>escape(b.start+'–'+b.end)).join(' / ')+' · '+before.actualMinutes+' min realizados<br>Después: ':''}${escape(after.date+' · '+after.status)}<br>${after.blocks.map(b=>escape(b.start+'–'+b.end)).join(' / ')} · ${after.plannedMinutes} min previstos · ${after.actualMinutes} realizados</p>`;}).join('')+details;$('preview').hidden=false;$('confirm').disabled=false;
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    if(changed.length){selectedDate=changed[0].date;selectedSession=changed[0].id;}
    view='month';renderCalendar();$('preview').focus();
    message('Vista previa preparada. Filtros despejados para mostrar todas las fechas propuestas; aún no se ha guardado.');
  }
  function openYear(override,hasChanges=false){
    const year=Number($('year').value);selectedDate=String(year)===todayLocal().slice(0,4)?todayLocal():year+'-01-01';selectedSession=null;config=clone(override||saved.years[year]||P.createYear(year));if($('calendar-source'))$('calendar-source').value='draft';dirty=hasChanges;preview=null;$('preview').hidden=true;
    options('institution',config.institutions.map(i=>[i.id,i.name]));options('rotation-institution',config.institutions.map(i=>[i.id,i.name]));
    $('rotation-start').value=config.rotation?.start||'';$('inactive-weeks').value=config.rotation?.inactiveWeeks.join(', ')||'';
    ['recalculate-from','session-start'].forEach(id=>$(id).value=year+'-01-01');
    $('holiday-list').innerHTML=P.holidays(year).map(h=>`<li>${h.date} · ${escape(h.names.join(' / '))}</li>`).join('');renderInstitution();renderTurns();renderSessions();ready=true;renderFilterOptions();renderCalendar();
    message(`Año ${year} abierto. ${!saved.years[year]?'Configura y confirma el nuevo borrador.':'Configuración local cargada.'}`);
  }
  function filters(){return {year:config.year,institution:$('filter-institution').value,ficha:$('filter-ficha').value,competency:$('filter-competency').value,rap:$('filter-rap').value,status:$('filter-status').value};}
  function renderFilterOptions(){
    options('filter-institution',[['','Todas las instituciones'],...config.institutions.map(i=>[i.id,i.name])]);
    const fs=(reference()?Catalog.fichas:config.fichas).filter(f=>!cloud?.reference()||cloud.fichas().includes(f.id)).filter(f=>!$('filter-institution').value||f.institutionId===$('filter-institution').value);
    options('filter-ficha',[['','Todas las fichas'],...fs.map(f=>[f.id,f.id+' · '+f.grade])]);
    const ids=$('filter-ficha').value?[$('filter-ficha').value]:fs.map(f=>f.id),items=Catalog.items.filter(i=>i.fichas.some(f=>ids.includes(f)));
    options('filter-competency',[['','Todas las competencias'],...[...new Map(items.map(i=>[i.competencyCode,i.competency])).entries()].map(([id,title])=>[id,id+' · '+title])]);
    options('filter-rap',[['','Todos los RAP'],...items.filter(i=>!$('filter-competency').value||i.competencyCode===$('filter-competency').value).map(i=>[i.id,'RAP '+i.order+' · '+i.rap])]);
    options('filter-status',[['','Todos los estados'],...(reference()?['Activa','Impartida','Cancelada','Recuperada','Sin programación','Parcial','Reprogramada']:P.STATES).map(s=>[s,s])]);
  }
  function reference(){return cloud?.reference()||workspace?.reference();}
  function visibleSessions(){return C.filter(C.numbered(reference()||C.overlays(saved.sessions,preview?.visual||[])),filters());}
  function renderCalendar(){
    if(!ready)return;
    renderFilterOptions();
    const f=filters(),list=visibleSessions(),confirmed=C.filter(reference()||saved.sessions,f),m=C.metrics(confirmed),hours=n=>(n/60).toLocaleString('es-CO',{maximumFractionDigits:2});
    $('metrics').innerHTML=[['Total de sesiones',m.total,'Total confirmado'],['Impartidas',m.done,'Sesiones completas'],['Pendientes',m.pending,'Incluye parciales'],['Canceladas',m.suspended,'Sin recuperación automática'],['Horas planificadas',hours(m.planned),'Suma de bloques'],['Horas ejecutadas',m.actual===null?'No documentadas':hours(m.actual),'Minutos registrados']].map(([title,value,hint])=>`<div class="metric"><span>${title}</span><strong>${value}</strong><small>${hint}</small></div>`).join('');
    $('calendar-title').textContent=view==='month'?C.label(selectedDate,{month:'long',year:'numeric'}):view==='week'?C.label(C.monday(selectedDate),{day:'numeric',month:'short'})+' – '+C.label(C.add(C.monday(selectedDate),6),{day:'numeric',month:'short',year:'numeric'}):C.label(selectedDate,{day:'numeric',month:'long'});
    $('previous').disabled=C.move(selectedDate,view,-1,config.year)===selectedDate;$('next').disabled=C.move(selectedDate,view,1,config.year)===selectedDate;
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
    $('calendar-context').textContent=cloud?.reference()?'Firestore · sesiones autorizadas · lectura actualizada al conectar o pulsar Actualizar.':reference()?'Referencia histórica local de 2026 · solo lectura · '+list.length+' sesiones agrupadas por fecha/ficha. Los indicadores superiores corresponden a esta referencia. Horarios ambiguos permanecen en Historial.':`${list.length} sesiones en el año con estos filtros${preview?' · Vista previa activa; los indicadores solo cuentan lo guardado.':dirty?' · Configuración en borrador sin confirmar.':' · Selecciona un día o una sesión para ver el detalle.'}`;
    const weeks=[...new Set(C.dates(selectedDate,view).map(C.monday))];let rotation={};try{rotation=config.rotation?P.rotationWeeks(config):{};}catch{/* Incomplete draft rotation remains editable in its step. */}
    $('rotation-overview').innerHTML='<details class=rotation-summary><summary>Rotación y semanas sin formación</summary><div class=rotation-items>'+weeks.map(w=>{const r=rotation[w];return `<p><strong>${C.label(w,{day:'numeric',month:'short'})}</strong> · ${r?escape(config.institutions.find(i=>i.id===r.institutionId)?.name||'')+' · '+(r.paused?'Pausa · turno pendiente conservado':'Turno activo · fichas '+escape(r.fichas.join(', '))):'Sin turno configurado'}</p>`;}).join('')+'</div></details>';
    $('calendar').innerHTML=C[view](selectedDate,list,config,P.holidays(config.year),f.institution,todayLocal());
    $('calendar').querySelectorAll('[data-top]').forEach(el=>el.style.top=el.dataset.top+'px');$('calendar').querySelectorAll('[data-height]').forEach(el=>el.style.height=el.dataset.height+'px');
    $('calendar-legend').innerHTML=(reference()?Catalog.fichas:config.fichas).filter(x=>!f.ficha||x.id===f.ficha).map(x=>`<span class="legend-item color-${C.color(x.id)}" data-identity="${escape(x.id)}"><i class="legend-dot" aria-hidden="true"></i>${escape(x.id)} · ${escape(x.grade)}</span>`).join('')+'<span>Ámbar: festivo · Gris: receso / vacaciones · Borde discontinuo: propuesta</span>';
    renderSelection(list);
    $('calendar-empty-help').hidden=list.length>0;if(workspace)workspace.refresh();if(cloud?.reference())$('selection-details').querySelectorAll('a[href*="preview=local"]').forEach(a=>a.remove());
  }
  function renderSelection(list){
    const s=list.find(s=>s.id===selectedSession),day=list.filter(s=>s.date===selectedDate);$('open-editor').hidden=!s||s.proposal||s.readonly;
    if(s){
      const ordered=saved.sessions.filter(x=>x.ficha===s.ficha&&x.curriculum.id===s.curriculum.id).sort((a,b)=>a.date.localeCompare(b.date));
      $('selection-details').innerHTML=`<p class="eyebrow">${s.proposal?'PROPUESTA SIN GUARDAR':'DETALLE DE SESIÓN'}</p><h2>Ficha ${escape(s.ficha)}</h2><p>${escape(config.institutions.find(i=>i.id===s.institutionId)?.name)}</p><p class="session-status-badge color-${C.color(s.ficha)}" data-identity="${escape(s.ficha)}">${s.proposal?'Propuesta · ':''}${escape(s.status)}</p><dl><dt>Fecha</dt><dd>${C.label(s.date)}</dd><dt>Original</dt><dd>${C.label(s.originalDate)}</dd><dt>Sesión</dt><dd>${s.cloud?'Firestore · revisión '+s.revision:s.readonly?'Referencia histórica':s.proposal?'Propuesta':ordered.findIndex(x=>x.id===s.id)+1} · RAP ${escape(s.curriculum.order)}</dd><dt>Duración</dt><dd>${s.plannedMinutes} min previstos · Ejecutados: ${C.executionLabel(s.actualMinutes)}</dd><dt>Bloques</dt><dd>${s.blocks.map(b=>escape(b.start+'–'+b.end+(s.readonly?' · '+C.blockStatus(s,b):''))).join('<br>')}</dd><dt>Estado</dt><dd>${escape(s.status)}</dd></dl><h3>${escape(s.curriculum.competencyCode)}</h3><p>${escape(s.curriculum.competency)}</p><h3>Resultado de aprendizaje</h3><p>${escape(s.curriculum.rap)}</p>${s.readonly&&!s.cloud?'<p>Fuente histórica · solo lectura. IDs: '+escape(s.sourceIds.join(', '))+'. Minutos ejecutados no documentados.</p>':''}${s.cloud?'<h3>Actividad</h3><p>'+escape(s.activity||'Sin actividad registrada')+'</p>':''}<h3>Observaciones</h3><p>${escape(s.observation||s.history.at(-1)?.reason||'Sin observaciones')}</p>${s.cloud?'<p>Consulte el historial verificado y los originales con el botón superior.</p>':'<details><summary>Historial de cambios ('+s.history.length+')</summary><pre>'+escape(JSON.stringify(s.history,null,2))+'</pre></details>'}`;
    }else{
      selectedSession=null;$('selection-details').innerHTML=`<p class="eyebrow">${C.label(selectedDate,{weekday:'long'}).toUpperCase()}</p><div class="selected-date">${Number(selectedDate.slice(-2))}</div><h2>${C.label(selectedDate,{month:'long',year:'numeric'})}</h2><p>${day.length} ${day.length===1?'sesión':'sesiones'} en este día</p>${C.annotations(selectedDate,config,P.holidays(config.year),filters().institution).map(a=>`<p class="date-note ${a.kind}">${escape(a.text)}</p>`).join('')}<div class="day-session-list">${day.length?day.map(s=>`<div class="detail-session">${C.event(s)}<p>${s.plannedMinutes} min · ${s.blocks.length} bloques</p></div>`).join(''):'<p>No hay sesiones con los filtros actuales. Puedes elegir otra fecha o preparar una propuesta.</p>'}</div>`;
    }
  }
  function wizardRender(){
    $('wizard-progress').textContent=`Paso ${wizardStep+1} de 3 · ${['Grupo','Aprendizaje','Fechas'][wizardStep]}`;
    document.querySelectorAll('[data-step]').forEach(el=>el.hidden=Number(el.dataset.step)!==wizardStep);
    $('wizard-back').disabled=wizardStep===0;$('wizard-next').hidden=wizardStep===2;$('generate').hidden=wizardStep!==2;$('wizard-error').textContent='';
  }
  function startWizard(){
    clearPreview();wizardStep=0;options('plan-institution',config.institutions.map(i=>[i.id,i.name]),$('filter-institution').value||config.fichas[0]?.institutionId);renderPlanFichas();
    if($('filter-ficha').value){$('plan-ficha').value=$('filter-ficha').value;renderCompetencies();}
    $('session-start').value=selectedDate;wizardRender();$('wizard-dialog').showModal();
  }
  try{
    check(window.SENA_CALENDAR_FIRESTORE?.enabled || location.protocol==='file:' || ['localhost','127.0.0.1','[::1]'].includes(location.hostname),'Esta versión de revisión funciona únicamente en el equipo local.');
    saved=Store.load(localStorage);$('planner-app').hidden=false;options('session-status',P.STATES.map(s=>[s,s]));openYear();
  }catch(e){message(e.message,true);return;}
  on('open-config',()=>{if(annual)annual.start(false);else{$('config-title').textContent='Configurar el año '+config.year;$('config-dialog').showModal();}});on('open-wizard',startWizard);on('plan-selected-day',startWizard);
  on('plan-institution',()=>{clearPreview();renderPlanFichas();},'change');on('plan-competency',()=>{clearPreview();renderCurriculum();},'change');
  on('wizard-next',()=>{if(wizardStep===0)check($('plan-ficha').value,'Asocia una ficha en Configurar año antes de continuar.');if(wizardStep===1){const item=Catalog.items.find(i=>i.id===$('curriculum').value);check(item&&!item.needsVerification,'Selecciona un RAP con fuente verificada.');}wizardStep=Math.min(2,wizardStep+1);wizardRender();document.querySelector('[data-step]:not([hidden]) select, [data-step]:not([hidden]) input')?.focus();});
  on('wizard-back',()=>{wizardStep=Math.max(0,wizardStep-1);wizardRender();});
  on('open-editor',()=>{$('edit-session').value=selectedSession;renderSessionForm();$('edit-error').textContent='';$('edit-dialog').showModal();});
  for(const [id,n] of [['previous',-1],['next',1]])on(id,()=>{selectedDate=C.move(selectedDate,view,n,config.year);selectedSession=null;renderCalendar();});
  on('today',()=>{const year=Number(todayLocal().slice(0,4));if(year!==config.year){if(annual)annual.changeYear(year);else{check(!dirty,'Confirma la configuración actual antes de volver a hoy.');$('year').value=year;openYear();}}selectedDate=todayLocal();selectedSession=null;renderCalendar();});
  ['filter-institution','filter-ficha','filter-competency','filter-rap','filter-status'].forEach(id=>on(id,()=>{selectedSession=null;renderFilterOptions();renderCalendar();},'change'));
  on('clear-filters',()=>{['filter-institution','filter-ficha','filter-competency','filter-rap','filter-status'].forEach(id=>$(id).value='');renderFilterOptions();selectedSession=null;renderCalendar();});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.close)$(b.dataset.close).close();
    if(b.closest('#annual-calendar'))return;
    if(b.dataset.view){view=b.dataset.view;renderCalendar();}
    if(b.dataset.date||b.dataset.day){selectedDate=b.dataset.date||b.dataset.day;selectedSession=null;if(b.dataset.day)view='day';renderCalendar();}
    if(b.dataset.session){selectedSession=b.dataset.session;const s=visibleSessions().find(s=>s.id===selectedSession);if(s)selectedDate=s.date;renderCalendar();$('selection-details').focus();}
  });
  $('calendar').addEventListener('keydown',e=>{
    const b=e.target.closest('[data-date]');if(!b||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const next=C.add(b.dataset.date,{ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key]);if(Number(next.slice(0,4))!==config.year)return;
    selectedDate=next;selectedSession=null;renderCalendar();$('calendar').querySelector(`[data-date="${next}"]`)?.focus();
  });
  on('load-year',()=>{if(annual)annual.changeYear(Number($('year').value));else{check(!dirty,'Confirma la configuración actual antes de cambiar de año.');openYear();}});
  on('institution',()=>{renderInstitution();if(annual)annual.refresh();},'change');on('rotation-institution',renderTurnFichas,'change');on('plan-ficha',()=>{clearPreview();renderCompetencies();},'change');on('curriculum',()=>{clearPreview();renderCurriculum();},'change');on('student-ficha',renderStudent,'change');on('edit-session',renderSessionForm,'change');
  function updateInstitution(addNew){
    const target=clone(config),item={id:addNew?'institucion-'+Date.now():inst().id,name:$('institution-name').value.trim(),type:$('institution-type').value,weeklyHours:Number($('institution-hours').value)};
    if(addNew)target.institutions.push(item);else target.institutions[target.institutions.findIndex(i=>i.id===item.id)]=item;
    P.validateConfig(target);config=target;invalidate();options('institution',config.institutions.map(i=>[i.id,i.name]),item.id);options('rotation-institution',config.institutions.map(i=>[i.id,i.name]));renderInstitution();
  }
  on('update-institution',()=>updateInstitution(false));on('add-institution',()=>updateInstitution(true));
  on('add-break',()=>{const target=clone(config);target.breaks.push({kind:$('break-kind').value,institutionId:inst().id,start:$('break-start').value,end:$('break-end').value});P.validateConfig(target);config=target;invalidate();renderInstitution();});
  on('breaks-reviewed',()=>{const id=inst().id;if($('breaks-reviewed').checked){if(!config.breaksReviewed.includes(id))config.breaksReviewed.push(id);}else config.breaksReviewed=config.breaksReviewed.filter(x=>x!==id);invalidate();},'change');
  function associate(f){
    // Association is a draft step; planning still requires reviewed breaks.
    check(f,'Seleccione una ficha.');check(!config.fichas.some(x=>x.id===f.id),'La ficha ya está asociada a este año.');
    const target=clone(config);target.fichas.push(f);P.validateConfig(target);config=target;invalidate();renderFichas();
  }
  on('associate-ficha',()=>associate(clone(Catalog.fichas.find(f=>f.id===$('known-ficha').value)||null)));
  on('associate-new',()=>associate({id:$('new-ficha').value.trim(),institutionId:inst().id,grade:$('new-grade').value.trim(),program:$('new-program').value.trim(),guideFiles:[]}));
  function applySchedule(){
    const target=clone(config),ficha=$('schedule-ficha').value,day=Number($('weekday').value);
    const b=$('schedule-blocks').value.split(';').map(v=>{const parts=v.trim().split(/[-–]/);check(parts.length===2,'Use HH:MM-HH:MM y separe bloques con punto y coma.');return {start:parts[0].trim(),end:parts[1].trim()};});
    target.schedules=target.schedules.filter(s=>s.ficha!==ficha||s.weekday!==day);target.schedules.push({ficha,weekday:day,blocks:P.blocks(b)});P.validateConfig(target);config=target;invalidate();renderSchedules();
  }
  on('set-schedule',applySchedule);
  on('add-turn',()=>{
    const target=clone(config),t={institutionId:$('rotation-institution').value,weeks:Number($('turn-weeks').value),fichas:[...$('turn-fichas').selectedOptions].map(o=>o.value)};
    target.rotation={start:$('rotation-start').value,turns:[...(target.rotation?.turns||[]),t],inactiveWeeks:$('inactive-weeks').value.split(',').map(v=>v.trim()).filter(Boolean)};
    P.validateConfig(target);config=target;invalidate();renderTurns();
  });
  ['rotation-start','inactive-weeks'].forEach(id=>on(id,invalidate,'input'));
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.break!==undefined){config.breaks.splice(Number(b.dataset.break),1);invalidate();renderInstitution();}
    if(b.dataset.schedule!==undefined){config.schedules.splice(Number(b.dataset.schedule),1);invalidate();renderSchedules();}
    if(b.dataset.turn!==undefined){config.rotation.turns.splice(Number(b.dataset.turn),1);if(!config.rotation.turns.length){config.rotation=null;$('rotation-start').value='';}invalidate();renderTurns();}
  });
  on('review-config',()=>{
    formRotation();P.validateConfig(config);const reason=$('recalculate-reason')?.value.trim()||$('config-reason').value.trim();check(reason,'Registre el acuerdo o motivo de configuración.');
    const result=P.recalculate(config,saved.sessions,Catalog.items,actor(),$('recalculate-from').value);check(result.complete,'No hay fechas suficientes para todas las sesiones pendientes. Ajuste la configuración.');
    const next=clone(saved);next.years[config.year]=clone(config);next.sessions=result.sessions;
    showPreview(next,`${config.year}: ${config.fichas.length} fichas, ${config.breaks.length} recesos, ${config.schedules.length} horarios, ${result.changes.length} sesiones pendientes afectadas.`,result.changes.map(c=>`<p>${escape(c.id)}: ${escape(c.before.date)} → ${escape(c.after.date)}</p>`).join('')+table(result.sessions.filter(s=>s.year===config.year))+'<details><summary>Configuración a confirmar</summary><pre>'+escape(JSON.stringify(config,null,2))+'</pre></details>',reason);
  });
  on('generate',()=>{
    check(!dirty && saved.years[config.year],'Confirme primero la configuración del año.');
    const p=P.propose(config,{ficha:$('plan-ficha').value,curriculumId:$('curriculum').value,count:Number($('session-count').value),start:$('session-start').value},Catalog.items,saved.sessions,actor());
    const next=clone(saved);if(p.complete)next.sessions=P.confirmProposal(p,saved.sessions,actor(),true);
    showPreview(next,`${p.sessions.length} de ${p.requested} sesiones · ${p.totalMinutes} minutos de formación (${(p.totalMinutes/60).toFixed(2)} horas).`,table(p.sessions)+'<p>'+escape(p.warnings.join(' '))+'</p>'+p.skipped.map(s=>`<p>${escape(s.date)}: ${escape(s.reason)}</p>`).join(''),'Programación confirmada de sesiones',p.sessions);
    if(!p.complete){preview.complete=false;$('confirm').disabled=true;message('Propuesta incompleta: no hay suficientes fechas válidas dentro del año. No se puede guardar.',true);}
  });
  on('review-session',()=>{
    check(!dirty,'Confirme primero los cambios de configuración.');const s=saved.sessions.find(x=>x.id===$('edit-session').value);check(s,'Seleccione una sesión.');
    const status=$('session-status').value,reason=$('session-reason').value.trim();
    const after=status==='Suspendida'&&window.academicPlannerIntegration?window.academicPlannerIntegration.cancel(saved,s.id,reason,'',actor(),$('explicit-realized').checked).sessions.find(x=>x.id===s.id):status==='Reprogramada'?P.reprogram(config,s,$('reschedule-start').value,Catalog.items,saved.sessions,actor(),reason):P.changeSession(s,{status,actualMinutes:Number($('actual-minutes').value)},actor(),reason,$('explicit-realized').checked);
    check(after.status==='Suspendida'||!saved.sessions.some(other=>other.id!==after.id&&other.date===after.date&&other.status!=='Suspendida'&&(other.ficha===after.ficha||(other.instructorId===after.instructorId&&P.overlap(other.blocks,after.blocks)))),'Conflicto con otra sesión guardada. Reprograma a una fecha disponible.');
    const next=clone(saved);next.sessions=next.sessions.map(x=>x.id===s.id?after:x);showPreview(next,'Cambio de sesión: '+s.status+' → '+after.status,table([s,after]),reason);
  });
  async function commitPreview(){
    check(preview && preview.complete && !busy,'No hay propuesta completa pendiente.');check(navigator.locks,'Este navegador no permite bloquear el borrador entre pestañas; use un navegador con Web Locks.');
    busy=true;$('confirm').disabled=true;const p=preview;
    try{await navigator.locks.request(Store.KEY,()=>{saved=Store.save(localStorage,p.next,p.revision,actor(),p.reason,true);});config=clone(saved.years[config.year]);dirty=false;preview=null;$('preview').hidden=true;renderSessions();message('Borrador local guardado. Revisión '+saved.revision+'.');if($('local-save-state'))$('local-save-state').textContent='GUARDADO · revisión '+saved.revision;}
    finally{busy=false;$('confirm').disabled=false;}
  }
  on('confirm',commitPreview);
  on('cancel-preview',()=>{clearPreview();message('Propuesta descartada. No se guardó.');});
  on('export-draft',()=>{const blob=new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='calendario-borrador-'+config.year+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  ['session-count','session-start','session-status','actual-minutes','reschedule-start','session-reason','explicit-realized','recalculate-from','config-reason'].forEach(id=>on(id,clearPreview,'input'));
  window.addEventListener('storage',e=>{if(e.key===Store.KEY){clearPreview();message('El borrador cambió en otra pestaña. Recarga antes de continuar; los cambios sin guardar siguen en pantalla.',true);}});
  window.addEventListener('beforeunload',e=>{if((dirty&&(!annual||!annual.isSaved()))||preview||annual&&!annual.isSaved()){e.preventDefault();e.returnValue='';}});
  if(window.SENA_CALENDAR_FIRESTORE?.enabled&&window.academicCalendarCloudUI){cloud=window.academicCalendarCloudUI({state:()=>({year:config.year,date:selectedDate,selection:selectedSession,saved}),render:()=>{renderFilterOptions();renderCalendar();},select:(s)=>{selectedDate=s.date;selectedSession=s.id;},message});}
  if(window.academicPlannerWorkspace){workspace=window.academicPlannerWorkspace({state:()=>({saved,config,dirty,date:selectedDate,selection:selectedSession,actor:actor(),catalog:Catalog,busy}),preview:showPreview,clearPreview,message,render:renderCalendar});workspace.refresh();}
  if(window.academicPlannerAnnualUI){try{annual=window.academicPlannerAnnualUI({
    state:()=>({saved,config,dirty,date:selectedDate,actor:actor(),catalog:Catalog,busy,hasPreview:!!preview}),
    loadYear:(year,override,changed)=>{$('year').value=year;openYear(override,changed);},
    showCalendar:()=>workspace?.showCalendar(),syncTurnFichas:renderTurnFichas,syncInstitution:renderInstitution,syncRotation:formRotation,applySchedule,removeCurrentSchedule:()=>{config.schedules=config.schedules.filter(s=>s.ficha!==$('schedule-ficha').value||s.weekday!==Number($('weekday').value));invalidate();renderSchedules();},markDirty:()=>{dirty=true;},
    render:renderCalendar,message,stage:(...args)=>{workspace?.showCalendar();$('calendar-source').value='draft';showPreview(...args);},commit:commitPreview,
    historical:()=>workspace?.historical()||[]
  });if(config.year===2026&&!saved.sessions.some(s=>s.year===2026)&&workspace?.historical().length){$('calendar-source').value='legacy';renderCalendar();}}catch(error){message('No se pudo recuperar la configuración anual: '+error.message,true);$('open-config').disabled=true;$('create-academic-year').disabled=true;$('open-student-preview').disabled=true;}}

})();
