/* Pure academic planning core. No network, storage, grades or delivery writes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.academicPlanner = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000;
  const STATES = ['Programada', 'Realizada', 'Suspendida', 'Parcial', 'Reprogramada'];
  const EXCLUDED = ['210201501', '220601501'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function requireThat(ok, message) { if (!ok) throw new Error(message); }
  function date(value) {
    requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Fecha inválida.');
    const d = new Date(value + 'T00:00:00Z');
    requireThat(Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value, 'Fecha inexistente.');
    return d;
  }
  const iso = d => d.toISOString().slice(0, 10);
  const add = (s, n) => iso(new Date(date(s).getTime() + n * DAY));
  const weekday = s => date(s).getUTCDay();
  const monday = s => add(s, -((weekday(s) + 6) % 7));
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function yearValue(year) {
    requireThat(Number.isInteger(year) && year >= 2026 && year <= 9998, 'Año académico inválido (2026–9998).');
    return year;
  }
  function inYear(s, year) { date(s); requireThat(Number(s.slice(0, 4)) === year, 'No se puede programar fuera del año académico.'); }
  function minutes(s) {
    requireThat(typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s), 'Hora inválida; usar HH:MM.');
    return Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  }
  function blocks(input) {
    requireThat(Array.isArray(input) && input.length > 0, 'Se requiere al menos un bloque horario.');
    const list = input.map(b => ({ start: b.start, end: b.end })).sort((a, b) => minutes(a.start) - minutes(b.start));
    list.forEach((b, i) => {
      requireThat(minutes(b.end) > minutes(b.start), 'El fin del bloque debe ser posterior al inicio.');
      if (i) requireThat(minutes(list[i - 1].end) <= minutes(b.start), 'Los bloques se superponen.');
    });
    return list;
  }
  const duration = input => blocks(input).reduce((n, b) => n + minutes(b.end) - minutes(b.start), 0);
  const overlap = (a, b) => a.some(x => b.some(y => minutes(x.start) < minutes(y.end) && minutes(y.start) < minutes(x.end)));
  function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(new Date(Date.UTC(year, month - 1, day)));
  }
  // Ley 51/1983 and Ley 2578/2026 art. 6. Rule set checked 2026-10-15;
  // future years must be rechecked for later legislative changes.
  function holidays(year) {
    yearValue(year);
    const map = new Map();
    const put = (s, label, move) => {
      const observed = move ? add(s, (8 - weekday(s)) % 7) : s;
      map.set(observed, [...(map.get(observed) || []), label]);
    };
    [['01-01','Año Nuevo'],['05-01','Día del Trabajo'],['07-20','Independencia'],['08-07','Batalla de Boyacá'],['12-08','Inmaculada Concepción'],['12-25','Navidad']].forEach(([d,n]) => put(year + '-' + d,n,false));
    [['01-06','Reyes Magos'],['03-19','San José'],['06-29','San Pedro y San Pablo'],['07-09','Nuestra Señora del Rosario de Chiquinquirá'],['08-15','Asunción'],['10-12','12 de octubre'],['11-01','Todos los Santos'],['11-11','Independencia de Cartagena']].forEach(([d,n]) => put(year + '-' + d,n,true));
    [[-3,'Jueves Santo'],[-2,'Viernes Santo'],[43,'Ascensión'],[64,'Corpus Christi'],[71,'Sagrado Corazón']].forEach(([d,n]) => put(add(easter(year),d),n,false));
    return [...map].sort(([a],[b]) => a.localeCompare(b)).map(([date,names]) => ({ date, names }));
  }
  function institutions() {
    return [
      ['puerto-pinzon','I.E. PUERTO PINZÓN'],['san-pedro-claver','I.E. SAN PEDRO CLAVER'],['antonia-santos','I.E. ANTONIA SANTOS'],
      ['john-f-kennedy','I.E. JOHN F. KENNEDY'],['el-prado','I.E. EL PRADO'],['santa-barbara','I.E. SANTA BARBARA'],
      ['jose-antonio-galan','I.ET. JOSÉ ANTONIO GALÁN'],['el-marfil','I.E.T. AGROPECUARIA EL MARFIL'],['puerto-serviez','I.E.T. PUERTO SERVIEZ'],
      ['pablo-valette','I.E. TECNICA PABLO VALETTE'],['jose-joaquin-ortiz','I.E.T. JOSÉ JOAQUÍN ORTIZ'],['nuestra-senora-paz','I.E.T. NUESTRA SEÑORA DE LA PAZ'],
      ['la-floresta','I.E.T LA FLORESTA'],['santa-teresita','COLEGIO SANTA TERESITA'],['pestalozzi','LICEO PESTALOZZI']
    ].map(([id,name],i) => ({id,name,type:i < 6 ? 'academica' : i < 13 ? 'tecnica' : 'privada',weeklyHours:i < 6 ? 11 : i < 13 ? 5 : 2}));
  }
  function createYear(year) {
    return {schemaVersion:1,year:yearValue(year),institutions:institutions(),fichas:[],breaks:[],breaksReviewed:[],schedules:[],rotation:null};
  }
  function canManage(actor, ficha) { return !!(actor && actor.role === 'instructor' && typeof actor.id === 'string' && actor.id.trim() && Array.isArray(actor.fichas) && actor.fichas.includes(ficha)); }
  function authorize(actor, ficha) { requireThat(canManage(actor,ficha), 'Solo el instructor responsable puede modificar esta ficha.'); }
  function validateConfig(c) {
    requireThat(c && c.schemaVersion === 1, 'Versión de configuración no compatible.');
    yearValue(c.year);
    ['institutions','fichas','breaks','breaksReviewed','schedules'].forEach(k => requireThat(Array.isArray(c[k]), 'Configuración incompleta: ' + k));
    const unique = (rows, label) => requireThat(new Set(rows.map(r => r.id)).size === rows.length, label + ': identificadores duplicados.');
    unique(c.institutions,'Instituciones'); unique(c.fichas,'Fichas');
    c.institutions.forEach(i => {
      requireThat(typeof i.id === 'string' && /^[a-z0-9-]+$/.test(i.id) && String(i.name || '').trim(), 'Institución inválida.');
      requireThat(['academica','tecnica','privada'].includes(i.type) && Number.isFinite(i.weeklyHours) && i.weeklyHours > 0 && i.weeklyHours <= 168,'Tipo u horas de institución inválidos.');
    });
    const inst = new Set(c.institutions.map(i => i.id));
    c.fichas.forEach(f => requireThat(typeof f.id === 'string' && /^\d+$/.test(f.id) && inst.has(f.institutionId) && String(f.grade || '').trim() && String(f.program || '').trim(), 'Ficha, institución, grado o programa inválidos.'));
    c.breaksReviewed.forEach(id => requireThat(inst.has(id), 'Revisión de recesos de institución desconocida.'));
    c.breaks.forEach(b => {
      date(b.start); date(b.end);
      requireThat(b.start <= c.year + '-12-31' && b.end >= c.year + '-01-01', 'El receso debe intersectar el año académico.');
      requireThat(inst.has(b.institutionId) && b.end >= b.start && weekday(b.start) === 1, 'El receso debe empezar en lunes y tener rango válido.');
    });
    c.schedules.forEach(s => {
      requireThat(c.fichas.some(f => f.id === s.ficha), 'Horario de ficha desconocida.');
      requireThat(Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6, 'Día de formación inválido.');
      blocks(s.blocks);
    });
    requireThat(new Set(c.schedules.map(s => s.ficha + ':' + s.weekday)).size === c.schedules.length,'Unifique los bloques del mismo día y ficha.');
    if (c.rotation) {
      const r = c.rotation; inYear(r.start,c.year);
      requireThat(weekday(r.start) === 1 && Array.isArray(r.turns) && r.turns.length > 0,'La rotación debe comenzar en lunes y tener turnos.');
      r.turns.forEach(t => {
        requireThat(inst.has(t.institutionId) && Number.isInteger(t.weeks) && t.weeks >= 1 && t.weeks <= 52,'Turno de rotación inválido.');
        requireThat(c.breaksReviewed.includes(t.institutionId),'Revise los recesos de todas las instituciones del ciclo.');
        requireThat(Array.isArray(t.fichas) && t.fichas.length > 0 && t.fichas.every(id => c.fichas.some(f => f.id === id && f.institutionId === t.institutionId)),'Fichas del turno incompatibles con la institución.');
      });
      requireThat(Array.isArray(r.inactiveWeeks), 'Indique las semanas inactivas del ciclo.');
      r.inactiveWeeks.forEach(d => { inYear(d,c.year); requireThat(weekday(d) === 1,'Las semanas inactivas se identifican por su lunes.'); });
    }
    return c;
  }
  function onBreak(c, institutionId, d) { return c.breaks.some(b => b.institutionId === institutionId && d >= b.start && d <= b.end); }
  // Monday-Friday plus any configured weekend teaching days.
  function fullBreak(c, institutionId, week) {
    const days = new Set([0,1,2,3,4]);
    c.schedules.filter(s=>c.fichas.some(f=>f.id===s.ficha && f.institutionId===institutionId)).forEach(s=>days.add((s.weekday+6)%7));
    return [...days].every(n => onBreak(c,institutionId,add(week,n)));
  }
  function rotationWeeks(c) {
    if (!c.rotation) return null;
    const r = c.rotation, result = {}, cycle = r.turns.flatMap(t => Array.from({length:t.weeks},() => t));
    let turn = 0;
    for (let w = r.start; w <= c.year + '-12-31'; w = add(w,7)) {
      const current = cycle[turn % cycle.length];
      const paused = r.inactiveWeeks.includes(w) || fullBreak(c,current.institutionId,w);
      result[w] = {institutionId:current.institutionId,fichas:current.fichas,paused,turn:turn % cycle.length};
      if (!paused) turn++;
    }
    return result;
  }
  function eligible(c,ficha,d,weeks,festivos) {
    if (onBreak(c,ficha.institutionId,d) || festivos.has(d)) return false;
    if (weeks) {
      const w = weeks[monday(d)];
      if (!w || w.paused || !w.fichas.includes(ficha.id)) return false;
    }
    return c.schedules.find(s => s.ficha === ficha.id && s.weekday === weekday(d)) || false;
  }
  function curriculumItem(catalog, ficha, id, institution) {
    const item = catalog.find(r => r.id === id);
    requireThat(item && item.fichas.includes(ficha.id) && normalize(item.program) === normalize(ficha.program),'Competencia/RAP sin fuente correspondiente a esta ficha y programa.');
    requireThat(item.order > 0 && Number.isInteger(item.order) && /^\d{9}$/.test(item.competencyCode) && item.source,'RAP sin código, orden o fuente verificable.');
    requireThat(!item.needsVerification,'La fuente curricular presenta discrepancias; requiere verificación antes de programar.');
    requireThat(!EXCLUDED.includes(item.competencyCode),'Competencia no impartida por este instructor.');
    const isSanta = ficha.institutionId === 'santa-barbara' || normalize(institution.name).includes('santa barbara');
    requireThat(!(isSanta && /^10(?:\D|$)/.test(ficha.grade) && item.competencyCode === '220501121'),'Herramientas Informáticas de Santa Bárbara grado 10 corresponde a la institución.');
    return item;
  }
  function checkSequence(existing, item, ficha, d) {
    existing.filter(s => s.ficha === ficha && s.curriculum.competencyCode === item.competencyCode).forEach(s => {
      requireThat(!(s.curriculum.order < item.order && s.date >= d) && !(s.curriculum.order > item.order && s.date <= d),'La fecha invierte la secuencia académica de los RAP.');
    });
  }
  function propose(c, request, catalog, existing, actor) {
    validateConfig(c); authorize(actor,request.ficha);
    const f = c.fichas.find(f => f.id === request.ficha);
    requireThat(f,'Ficha no asociada al año.');
    requireThat(c.breaksReviewed.includes(f.institutionId),'Registre y revise vacaciones/recesos antes de programar.');
    requireThat(c.rotation,'Configure la rotación; use un turno para una institución sin alternancia.');
    inYear(request.start,c.year);
    requireThat(Number.isInteger(request.count) && request.count > 0 && request.count <= 366,'Cantidad de sesiones inválida.');
    const item = curriculumItem(catalog,f,request.curriculumId,c.institutions.find(i => i.id === f.institutionId));
    const all = existing || [], weeks = rotationWeeks(c), festivos = new Set(holidays(c.year).map(h => h.date));
    const sessions = [], skipped = [];
    for (let d = request.start; d <= c.year + '-12-31' && sessions.length < request.count; d = add(d,1)) {
      const schedule = eligible(c,f,d,weeks,festivos);
      if (!schedule) continue;
      const b = blocks(schedule.blocks);
      const conflict = all.find(s => s.date === d && s.status !== 'Suspendida' && (s.ficha === f.id || (s.instructorId === actor.id && overlap(s.blocks,b))));
      if (conflict) { skipped.push({date:d,reason:'Conflicto con sesión ' + conflict.id}); continue; }
      try { checkSequence(all,item,f.id,d); } catch (e) { skipped.push({date:d,reason:e.message}); continue; }
      const baseId=c.year + ':' + f.id + ':' + d;
      let id=baseId, suffix=1; while(all.some(s=>s.id===id)) id=baseId+':'+(++suffix);
      sessions.push({id,year:c.year,ficha:f.id,institutionId:f.institutionId,instructorId:actor.id,originalDate:d,date:d,blocks:b,plannedMinutes:duration(b),actualMinutes:0,status:'Programada',curriculum:clone(item),history:[]});
    }
    const warnings = [];
    if (item.order > 1 && !all.some(s => s.ficha === f.id && s.curriculum.competencyCode === item.competencyCode && s.curriculum.order === item.order - 1)) warnings.push('No consta el RAP anterior en este borrador; verificar la secuencia con el historial académico.');
    return {sessions,requested:request.count,complete:sessions.length === request.count,skipped,warnings,totalMinutes:sessions.reduce((n,s) => n+s.plannedMinutes,0)};
  }
  function stamp(actor, reason, before, after, now) {
    requireThat(actor && String(actor.id || '').trim(),'Responsable requerido.');
    requireThat(String(reason || '').trim(),'Registre el motivo del cambio.');
    return {at:now || new Date().toISOString(),actor:actor.id,reason:String(reason).trim(),before:clone(before),after:clone(after)};
  }
  function confirmProposal(proposal, existing, actor, confirmed) {
    requireThat(confirmed === true,'La propuesta requiere confirmación del instructor.');
    requireThat(Number.isInteger(proposal.requested) && proposal.requested > 0 && proposal.complete && proposal.sessions.length === proposal.requested,'No hay suficientes fechas dentro del año: no se guarda una propuesta incompleta.');
    const next = clone(existing);
    proposal.sessions.forEach(s => {
      authorize(actor,s.ficha);
      requireThat(!next.some(x => x.id === s.id || (x.date === s.date && x.status !== 'Suspendida' && (x.ficha === s.ficha || (x.instructorId === s.instructorId && overlap(x.blocks,s.blocks))))),'Conflicto: regenere la vista previa.');
      const saved = clone(s); saved.history.push(stamp(actor,'Confirmación de propuesta',null,s)); next.push(saved);
    });
    return next;
  }
  function changeSession(session, patch, actor, reason, explicitRealized) {
    authorize(actor,session.ficha);
    requireThat(session.status !== 'Realizada' || explicitRealized === true,'La sesión realizada requiere una operación explícita y trazable.');
    requireThat(Object.keys(patch).every(k => ['date','blocks','status','actualMinutes'].includes(k)),'No se puede alterar la identidad ni el currículo de la sesión.');
    const next = Object.assign(clone(session),clone(patch));
    inYear(next.date,session.year); next.blocks = blocks(next.blocks); next.plannedMinutes = duration(next.blocks);
    requireThat(STATES.includes(next.status),'Estado de sesión inválido.');
    requireThat(Number.isInteger(next.actualMinutes) && next.actualMinutes >= 0 && next.actualMinutes <= next.plannedMinutes,'Minutos realizados inválidos.');
    requireThat(next.status !== 'Realizada' || next.actualMinutes === next.plannedMinutes,'Una sesión realizada debe registrar todos sus minutos previstos.');
    requireThat(next.status !== 'Parcial' || (next.actualMinutes > 0 && next.actualMinutes < next.plannedMinutes),'Una sesión parcial debe indicar minutos mayores a cero y menores a los previstos.');
    requireThat(!['Programada','Suspendida','Reprogramada'].includes(next.status) || next.actualMinutes === 0,'Con formación impartida, conserve el estado Parcial o Realizada.');
    requireThat(next.date === session.date || next.status === 'Reprogramada','El cambio de fecha debe quedar como Reprogramada.');
    const entry=stamp(actor,reason,{date:session.date,blocks:session.blocks,status:session.status,actualMinutes:session.actualMinutes},{date:next.date,blocks:next.blocks,status:next.status,actualMinutes:next.actualMinutes});
    entry.explicitRealizedCorrection=session.status==='Realizada' && explicitRealized===true;
    next.history.push(entry);
    return next;
  }
  // Replan ALL pending sessions in original academic/date order, preserving IDs/history.
  // Completed, partial and suspended entries remain visible and untouched.
  function recalculate(c, sessions, catalog, actor, from) {
    validateConfig(c); inYear(from,c.year);
    const pending = sessions.filter(s => s.year === c.year && s.date >= from && ['Programada','Reprogramada'].includes(s.status) && canManage(actor,s.ficha));
    pending.sort((a,b) => a.date.localeCompare(b.date) || a.curriculum.order-b.curriculum.order || a.id.localeCompare(b.id));
    const keep = sessions.filter(s => !pending.includes(s)), changes = [], failures = [];
    for (const s of pending) {
      const p = propose(c,{ficha:s.ficha,start:from,count:1,curriculumId:s.curriculum.id},catalog,keep,actor);
      if (!p.complete) { failures.push(s.id); continue; }
      const candidate = p.sessions[0];
      const changed = s.date !== candidate.date || JSON.stringify(s.blocks) !== JSON.stringify(candidate.blocks);
      const next = changed ? changeSession(s,{date:candidate.date,blocks:candidate.blocks,status:'Reprogramada'},actor,'Recálculo concertado de calendario') : clone(s);
      keep.push(next); if (changed) changes.push({id:s.id,before:clone(s),after:next});
    }
    return {sessions:keep,changes,failures,complete:failures.length === 0};
  }
  function reprogram(c,session,start,catalog,all,actor,reason) {
    requireThat(['Suspendida','Programada','Reprogramada'].includes(session.status),'La sesión impartida o parcial se conserva; no se reprograma automáticamente.');
    const p = propose(c,{ficha:session.ficha,start,count:1,curriculumId:session.curriculum.id},catalog,all.filter(s => s.id !== session.id),actor);
    requireThat(p.complete,'No hay fecha válida para reprogramar dentro del año.');
    return changeSession(session,{date:p.sessions[0].date,blocks:p.sessions[0].blocks,status:'Reprogramada'},actor,reason);
  }
  function studentView(sessions, actor, deadlines) {
    requireThat(actor && actor.role === 'aprendiz' && actor.ficha,'Sesión de aprendiz requerida.');
    return sessions.filter(s => s.ficha === actor.ficha).map(s => ({
      id:s.id,date:s.date,originalDate:s.originalDate,blocks:clone(s.blocks),status:s.status,
      plannedMinutes:s.plannedMinutes,actualMinutes:s.actualMinutes,competency:s.curriculum.competency,rap:s.curriculum.rap,
      guides:(s.curriculum.guides || []).map(g => ({file:g.file,title:g.title,activities:(g.activities || []).map(a => ({id:a.id,label:a.label,dueAt:deadlines && deadlines[g.file] && deadlines[g.file][a.id] ? deadlines[g.file][a.id].dueAt || '' : ''}))}))
    }));
  }
  return Object.freeze({STATES,createYear,institutions,validateConfig,holidays,easter,date,add,monday,blocks,duration,overlap,fullBreak,rotationWeeks,canManage,propose,confirmProposal,changeSession,recalculate,reprogram,studentView});
});
