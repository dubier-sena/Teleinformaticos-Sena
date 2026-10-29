(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.academicCalendarCloud=factory();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const canonical=x=>x&&typeof x==='object'?(Array.isArray(x)?x.map(canonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]))):x;
  const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const FICHAS=['3168850','3168852','3441939','3441942','3441944','3441950'];
  // Learner-readable session. Internal observations (notes/{id}) and reasons (audit) are kept apart.
  const KEYS=['id','ficha','year','date','originalDate','blocks','plannedMinutes','actualMinutes','status','activity','evidence','dueDate','curriculum','sourceStatuses','origin','protected','revision','mutationId','updatedBy'];
  function fail(text,code){const e=new Error(text);e.code=code;throw e;}
  function date(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)fail('Fecha inválida.');return value;}
  function duration(blocks){
    if(!Array.isArray(blocks)||!blocks.length||blocks.length>6)fail('Se requieren entre uno y seis bloques.');
    let last='',total=0;for(const b of blocks){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end)||b.start>=b.end||b.start<last||Object.keys(b).sort().join(',')!=='end,start')fail('Bloques inválidos o superpuestos.');const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));total+=mins(b.end)-mins(b.start);last=b.end;}return total;
  }
  function validate(s){
    if(!s||Object.keys(s).some(k=>!KEYS.includes(k))||KEYS.some(k=>!Object.hasOwn(s,k)))fail('Sesión incompleta.');
    if(!/^[a-zA-Z0-9_-]{1,120}$/.test(s.id)||!/^\d{6,9}$/.test(s.ficha)||!Number.isInteger(s.year)||s.year<2020||s.year>2100)fail('Identidad de sesión inválida.');
    if(Number(date(s.date).slice(0,4))!==s.year||Number(date(s.originalDate).slice(0,4))!==s.year)fail('Fecha fuera del año.');
    if(s.plannedMinutes!==duration(s.blocks)||s.actualMinutes!==null&&(!Number.isInteger(s.actualMinutes)||s.actualMinutes<0||s.actualMinutes>s.plannedMinutes))fail('Minutos inválidos.');
    if(!['Programada','Realizada','Suspendida','Parcial','Reprogramada','Activa','Impartida','Cancelada','Recuperada','Sin programación','Estados mixtos — revisar'].includes(s.status)||s.status==='Parcial'&&!(s.actualMinutes>0&&s.actualMinutes<s.plannedMinutes)&&!(s.origin==='legacy'&&s.actualMinutes===null))fail('Estado inválido.');
    if(['Programada','Suspendida','Reprogramada'].includes(s.status)&&s.actualMinutes!==null&&s.actualMinutes!==0)fail('Minutos incompatibles con el estado.');
    if(s.status==='Realizada'&&s.actualMinutes!==null&&s.actualMinutes!==s.plannedMinutes)fail('La duración ejecutada no coincide con una sesión completa.');
    if(typeof s.activity!=='string'||s.activity.length>4000||typeof s.evidence!=='string'||s.evidence.length>4000)fail('Actividad o evidencia inválida.');
    if(typeof s.dueDate!=='string'||s.dueDate&&(Number(date(s.dueDate).slice(0,4))!==s.year||s.dueDate<s.date))fail('La fecha límite debe ser del mismo año y no anterior a la clase.');
    if(!['new','legacy'].includes(s.origin)||typeof s.protected!=='boolean'||!Number.isInteger(s.revision)||s.revision<0||!s.updatedBy||!s.mutationId)fail('Metadatos inválidos.');
    if(!Array.isArray(s.sourceStatuses))fail('Estados fuente inválidos.');
    if(!s.curriculum||Object.keys(s.curriculum).sort().join(',')!=='competency,competencyCode,id,order,rap,source'||Object.values(s.curriculum).some(v=>typeof v!=='string'))fail('Fuente curricular inválida.');
    return s;
  }
  function encode(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:fields(v)}};return typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:{stringValue:v};}
  function fields(v){return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]));}
  function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('nullValue'in v)return null;return Object.values(v)[0];}
  function document(d){return {data:decode({mapValue:{fields:d.fields||{}}}),updateTime:d.updateTime,name:d.name};}
  // Copias locales del calendario (listCached): se borran al cerrar sesión.
  const CACHE_PREFIX='sena_calendar_cache_v1:';
  function clearCache(storage){try{if(!storage)return;for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k&&k.indexOf(CACHE_PREFIX)===0)storage.removeItem(k);}}catch{}}
  function create({projectId,emulatorHost=null,auth,fetch:request=globalThis.fetch,enabled=false}){
    if(!enabled)fail('Conexión Firestore todavía no habilitada.');
    if(!/^[a-z][a-z0-9-]+$/.test(projectId))fail('Proyecto inválido.');
    if(emulatorHost&&(projectId!=='demo-sena-calendar'||emulatorHost!=='127.0.0.1:9180'))fail('El emulador debe usar el proyecto demo y loopback.');
    if(!emulatorHost&&projectId!=='sena-portal')fail('Proyecto no autorizado.');
    const root='projects/'+projectId+'/databases/(default)/documents',base=(emulatorHost?'http://'+emulatorHost:'https://firestore.googleapis.com')+'/v1/'+root;
    let identity=null;
    async function call(method,path,body,allowMissing=false){
      const token=await auth.getIdToken();if(!token)fail('Autenticación Firebase requerida.','AUTH');
      const response=await request(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
      const text=await response.text();let result;try{result=text?JSON.parse(text):{};}catch{fail('Respuesta Firestore inválida.');}
      if(response.status===404&&allowMissing)return null;
      if(!response.ok){const code=result.error?.status||String(response.status);if(['FAILED_PRECONDITION','ABORTED','ALREADY_EXISTS'].includes(code))fail('El calendario cambió. Recargue y revise antes de guardar.','CONFLICT');if(response.status===403||response.status===401){identity=null;fail('Permiso revocado o ficha no autorizada.','PERMISSION');}fail('Firestore no confirmó la operación ('+code+').',code);}
      return result;
    }
    // 2026-10-28 (cuentas actuales, sin asignaciones nuevas): administrador por su rol en sena_portal_roles;
    // aprendiz por SU perfil existente (ficha + nombre validado por el administrador). Las reglas candidatas
    // comprueban exactamente lo mismo en el servidor; aquí solo se evita mostrar algo que el servidor negaría.
    const VALIDATED=['oficial','duplicado_diferenciado'];
    async function principal(){
      const uid=await auth.getUid();if(!uid||uid.includes('/'))fail('No hay una sesión activa con la nube. Cierre sesión, vuelva a entrar al portal y pulse «Actualizar».','AUTH');
      const hint=typeof auth.isAdminHint==='function'?!!(await auth.isAdminHint()):true;
      if(hint){const role=await call('GET','/sena_portal_roles/'+encodeURIComponent(uid),undefined,true);
        if(role&&document(role).data.role==='admin'){identity={uid,role:'admin',active:true,fichas:FICHAS.slice()};return clone(identity);}}
      const key=String(typeof auth.getUsernameKey==='function'?await auth.getUsernameKey():'').trim().toLowerCase();
      if(!key||key.includes('/'))fail('No se pudo identificar el perfil académico de esta cuenta.','PERMISSION');
      const prof=await call('GET','/sena_portal_users/'+encodeURIComponent(key),undefined,true);
      if(!prof)fail('No existe un perfil académico para esta cuenta.','PERMISSION');
      const p=document(prof).data;
      if(!FICHAS.includes(String(p.ficha))||!VALIDATED.includes(p.validacionNombre)||p.active===false||p.estado==='inactivo')
        fail('Su perfil está pendiente de validación por el instructor; el calendario se habilitará cuando quede validado.','PERMISSION');
      identity={uid,role:'aprendiz',active:true,fichas:[String(p.ficha)]};return clone(identity);
    }
    function scope(ficha,year){if(!identity?.fichas.includes(ficha)||!Number.isInteger(year)||year<2020||year>2100)fail('Ficha o año no autorizado.','PERMISSION');return '/sena_portal_calendar_fichas/'+ficha+'/years/'+year;}
    async function list(ficha,year){await principal();const prefix=scope(ficha,year),out=[];let page;
      do{const r=await call('GET',prefix+'/sessions?pageSize=100'+(page?'&pageToken='+encodeURIComponent(page):''));out.push(...(r.documents||[]).map(document));page=r.nextPageToken;}while(page);
      out.forEach(d=>{validate(d.data);if(d.data.ficha!==ficha||d.data.year!==year)fail('Respuesta fuera del alcance autorizado.');});return out;
    }
    // Copia local por cuenta, ficha y año (2026-10-28). Correcta por las reglas del servidor: las sesiones
    // no se borran, toda edición sube revision (las importadas nacen en 0) y las nuevas nacen en 1. En cada
    // apertura solo se piden las sesiones con revision > 0 (todo lo que cambió o se creó alguna vez); lo demás
    // no pudo cambiar. Revalidación completa cada 7 días, con «Actualizar» o ante cualquier incoherencia.
    // Ante un 401/403 la copia se borra y nunca se muestra.
    const CACHE_FULL_MS=7*24*3600e3;
    async function listCached(ficha,year,{storage=null,force=false,now=Date.now}={}){
      const own=CACHE_PREFIX+projectId+':'+(await auth.getUid())+':';
      const purge=keepFichas=>{try{if(!storage)return;for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k&&k.indexOf(own)===0&&!(keepFichas||[]).includes(k.slice(own.length).split(':')[0]))storage.removeItem(k);}}catch{}};
      // Asignación revocada o inactiva: se borran TODAS las copias de esta cuenta. Traslado de ficha: se borran
      // las copias de las fichas que ya no tiene asignadas.
      try{await principal();}catch(e){if(e.code==='PERMISSION'||e.code==='AUTH')purge([]);throw e;}
      purge(identity.fichas);
      const prefix=scope(ficha,year),key=CACHE_PREFIX+projectId+':'+identity.uid+':'+ficha+':'+year,t=now();
      const read=()=>{try{return storage?JSON.parse(storage.getItem(key)||'null'):null;}catch{return null;}};
      const drop=()=>{try{storage&&storage.removeItem(key);}catch{}};
      const keep=(docs,fullAt)=>{try{storage&&storage.setItem(key,JSON.stringify({v:1,uid:identity.uid,ficha,year,fullAt,docs:docs.map(d=>({data:d.data,updateTime:d.updateTime}))}));}catch{}};
      const sorted=docs=>docs.slice().sort((a,b)=>a.data.id<b.data.id?-1:a.data.id>b.data.id?1:0);
      const full=async()=>{try{const docs=await list(ficha,year);keep(docs,t);return {docs:sorted(docs),source:'full',changed:docs.length};}catch(e){if(e.code==='PERMISSION'||e.code==='AUTH')drop();throw e;}};
      const cache=read();
      const valid=!force&&cache&&cache.v===1&&cache.uid===identity.uid&&cache.ficha===ficha&&cache.year===year&&Array.isArray(cache.docs)
        &&typeof cache.fullAt==='number'&&t-cache.fullAt>=0&&t-cache.fullAt<CACHE_FULL_MS;
      if(!valid)return full();
      let changed;
      try{const r=await call('POST',prefix+':runQuery',{structuredQuery:{from:[{collectionId:'sessions'}],where:{fieldFilter:{field:{fieldPath:'revision'},op:'GREATER_THAN',value:{integerValue:'0'}}}}});
        changed=(Array.isArray(r)?r:[]).filter(x=>x&&x.document).map(x=>document(x.document));}
      catch(e){if(e.code==='PERMISSION'||e.code==='AUTH'){drop();throw e;}return full();}
      const byId=new Map();
      try{cache.docs.forEach(d=>{validate(d.data);if(d.data.ficha!==ficha||d.data.year!==year)throw Error('alcance');byId.set(d.data.id,{data:d.data,updateTime:d.updateTime});});}catch{return full();}
      const seen=new Set();
      for(const d of changed){validate(d.data);if(d.data.ficha!==ficha||d.data.year!==year)fail('Respuesta fuera del alcance autorizado.');
        const old=byId.get(d.data.id);if(old&&d.data.revision<old.data.revision)return full();byId.set(d.data.id,d);seen.add(d.data.id);}
      for(const [id,d] of byId)if(d.data.revision>0&&!seen.has(id))return full();
      const docs=sorted([...byId.values()]);keep(docs,cache.fullAt);
      return {docs,source:'delta',changed:changed.length,fullAt:cache.fullAt};
    }
    async function history(ficha,year,id){await principal();if(identity.role==='aprendiz')fail('Historial administrativo restringido.','PERMISSION');const out=[];let page;do{const r=await call('GET',scope(ficha,year)+'/sessions/'+encodeURIComponent(id)+'/audit?pageSize=100'+(page?'&pageToken='+encodeURIComponent(page):''));out.push(...(r.documents||[]).map(document));page=r.nextPageToken;}while(page);return out;}
    const taught=d=>d.protected||['Realizada','Impartida'].includes(d.status);
    async function save(input,before,reason,{observation,appendObservation}={}){
      await principal();if(identity.role==='aprendiz')fail('Acceso de solo lectura.','PERMISSION');
      const next=clone(input),prefix=scope(next.ficha,next.year),id=encodeURIComponent(next.id),motive=String(reason||'').trim();
      if(!motive||motive.length>2000)fail('Indique el motivo del cambio (máximo 2000 caracteres).');
      if(before){validate(before.data);if(before.data.id!==next.id||before.data.ficha!==next.ficha||before.data.year!==next.year)fail('Referencia de guardado incompatible.');for(const k of ['sourceStatuses','origin','protected','originalDate','curriculum'])if(JSON.stringify(next[k])!==JSON.stringify(before.data[k]))fail('Fuente histórica inmutable.');
        // Taught or historical classes can be corrected, but their recorded state is not rewritten.
        if(taught(before.data)&&next.status!==before.data.status)fail('El estado de una clase impartida o histórica no se modifica.');}
      else if(next.origin!=='new'||next.protected||next.sourceStatuses.length||next.status!=='Programada')fail('Las sesiones nuevas deben estar programadas.');
      next.revision=before?before.data.revision+1:1;next.updatedBy=identity.uid;next.mutationId=globalThis.crypto.randomUUID();validate(next);
      let note=null;
      if(before){const current=await call('GET',prefix+'/sessions/'+id,undefined,true);if(!current||current.updateTime!==before.updateTime)fail('El calendario cambió. Recargue y revise antes de guardar.','CONFLICT');note=await call('GET',prefix+'/notes/'+id,undefined,true);}
      const extra=String(appendObservation||'').trim(),notesBefore=note?document(note).data.observation:'';
      const notesAfter=observation!==undefined?String(observation):extra?(notesBefore?notesBefore+'\n':'')+extra:notesBefore;
      if(notesAfter.length>8000)fail('Observación interna demasiado larga.');
      const full=root+prefix+'/sessions/'+id;
      const audit={revision:next.revision,actor:identity.uid,reason:motive,mutationId:next.mutationId,before:before?before.data:null,after:next,notesBefore,notesAfter};
      // Session, append-only receipt (with server time) and internal note commit together. No blind retry.
      const writes=[{update:{name:full,fields:fields(next)},currentDocument:before?{updateTime:before.updateTime}:{exists:false}},
        {update:{name:full+'/audit/'+next.revision,fields:fields(audit)},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}},
        {update:{name:root+prefix+'/notes/'+id,fields:fields({sessionId:next.id,revision:next.revision,observation:notesAfter})},currentDocument:note?{updateTime:note.updateTime}:{exists:false}}];
      if(!before||next.date!==before.data.date){
        writes.push({update:{name:root+prefix+'/days/'+next.date,fields:fields({sessionId:next.id})},currentDocument:{exists:false}});
        // The previous day is released in the same commit; the rules reject a move that keeps it occupied.
        if(before)writes.push({delete:root+prefix+'/days/'+before.data.date});
      }
      try{await call('POST',':commit',{writes});}catch(e){
        // Rules run before preconditions: a concurrent winner's receipt makes the loser look unauthorized.
        if(e.code==='PERMISSION'){const now=await call('GET',prefix+'/sessions/'+id,undefined,true).catch(()=>undefined);
          if(now!==undefined&&(before?!now||now.updateTime!==before.updateTime:!!now))fail('El calendario cambió. Recargue y revise antes de guardar.','CONFLICT');}
        if(!['PERMISSION','CONFLICT'].includes(e.code))e.message+=' Resultado no confirmado; recargue antes de reintentar.';throw e;}
      const verified=document(await call('GET',prefix+'/sessions/'+id));
      if(verified.data.mutationId!==next.mutationId||verified.data.revision!==next.revision)fail('Guardado enviado, pero otra versión ya está vigente. Recargue para conciliar.','READBACK');
      const receipt=document(await call('GET',prefix+'/sessions/'+id+'/audit/'+next.revision)),stored=document(await call('GET',prefix+'/notes/'+id));
      if(!equal(receipt.data.after,verified.data)||receipt.data.notesAfter!==notesAfter||!receipt.data.at||stored.data.revision!==next.revision||stored.data.observation!==notesAfter)fail('Verificación de historial incompleta.','READBACK');
      return {...verified,observation:notesAfter,audit:receipt.data};
    }
    // 2026-10-29: traslado de una clase a otra ficha. Las sesiones no se borran ni cambian de ficha (sus reglas lo
    // impiden), así que en UN SOLO commit la original pasa a Suspendida (con recibo y nota) y nace la clase nueva en
    // la ficha destino (con su recibo, nota y día ocupado). Si algo falla no queda ninguna de las dos a medias.
    async function transfer(before,target,reason,{observationBefore,observationTarget=''}={}){
      await principal();if(identity.role==='aprendiz')fail('Acceso de solo lectura.','PERMISSION');
      const motive=String(reason||'').trim();if(!motive||motive.length>2000)fail('Indique el motivo del cambio (máximo 2000 caracteres).');
      if(!before)fail('Seleccione la clase que se traslada.');validate(before.data);
      if(taught(before.data))fail('Una clase impartida o histórica no se traslada de ficha.');
      const orig={...clone(before.data),status:'Suspendida',actualMinutes:null},born=clone(target);
      if(born.ficha===orig.ficha||born.year!==orig.year)fail('El traslado debe ir a otra ficha del mismo año.');
      if(born.origin!=='new'||born.protected||born.sourceStatuses.length||born.status!=='Programada')fail('La clase destino debe nacer programada.');
      const pa=scope(orig.ficha,orig.year),pb=scope(born.ficha,born.year),ia=encodeURIComponent(orig.id),ib=encodeURIComponent(born.id);
      orig.revision=before.data.revision+1;orig.updatedBy=identity.uid;orig.mutationId=globalThis.crypto.randomUUID();
      born.revision=1;born.originalDate=born.date;born.updatedBy=identity.uid;born.mutationId=globalThis.crypto.randomUUID();validate(orig);validate(born);
      const current=await call('GET',pa+'/sessions/'+ia,undefined,true);if(!current||current.updateTime!==before.updateTime)fail('El calendario cambió. Recargue y revise antes de guardar.','CONFLICT');
      const note=await call('GET',pa+'/notes/'+ia,undefined,true);
      const notesBefore=note?document(note).data.observation:'',notesAfter=observationBefore===undefined?notesBefore:String(observationBefore),bornNote=String(observationTarget);
      if(notesAfter.length>8000||bornNote.length>8000)fail('Observación interna demasiado larga.');
      const fa=root+pa+'/sessions/'+ia,fb=root+pb+'/sessions/'+ib;
      const writes=[{update:{name:fa,fields:fields(orig)},currentDocument:{updateTime:before.updateTime}},
        {update:{name:fa+'/audit/'+orig.revision,fields:fields({revision:orig.revision,actor:identity.uid,reason:motive,mutationId:orig.mutationId,before:before.data,after:orig,notesBefore,notesAfter})},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}},
        {update:{name:root+pa+'/notes/'+ia,fields:fields({sessionId:orig.id,revision:orig.revision,observation:notesAfter})},currentDocument:note?{updateTime:note.updateTime}:{exists:false}},
        {update:{name:fb,fields:fields(born)},currentDocument:{exists:false}},
        {update:{name:fb+'/audit/1',fields:fields({revision:1,actor:identity.uid,reason:motive,mutationId:born.mutationId,before:null,after:born,notesBefore:'',notesAfter:bornNote})},updateTransforms:[{fieldPath:'at',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}},
        {update:{name:root+pb+'/notes/'+ib,fields:fields({sessionId:born.id,revision:1,observation:bornNote})},currentDocument:{exists:false}},
        {update:{name:root+pb+'/days/'+born.date,fields:fields({sessionId:born.id})},currentDocument:{exists:false}}];
      try{await call('POST',':commit',{writes});}catch(e){
        if(e.code==='PERMISSION'){const now=await call('GET',pa+'/sessions/'+ia,undefined,true).catch(()=>undefined);
          if(now!==undefined&&(!now||now.updateTime!==before.updateTime))fail('El calendario cambió. Recargue y revise antes de guardar.','CONFLICT');
          const day=await call('GET',pb+'/days/'+born.date,undefined,true).catch(()=>undefined);
          if(day)fail('La ficha '+born.ficha+' ya tiene una clase el '+born.date+'. Edite esa clase en lugar de trasladar otra.','CONFLICT');}
        if(!['PERMISSION','CONFLICT'].includes(e.code))e.message+=' Resultado no confirmado; recargue antes de reintentar.';throw e;}
      const va=document(await call('GET',pa+'/sessions/'+ia)),vb=document(await call('GET',pb+'/sessions/'+ib));
      if(va.data.mutationId!==orig.mutationId||vb.data.mutationId!==born.mutationId)fail('Traslado enviado, pero otra versión ya está vigente. Recargue para conciliar.','READBACK');
      return {original:{...va,observation:notesAfter},target:{...vb,observation:bornNote}};
    }
    async function notes(ficha,year){await principal();if(identity.role==='aprendiz')fail('Observaciones internas restringidas.','PERMISSION');const out=new Map();let page;
      do{const r=await call('GET',scope(ficha,year)+'/notes?pageSize=300'+(page?'&pageToken='+encodeURIComponent(page):''));for(const d of r.documents||[]){const n=document(d).data;out.set(n.sessionId,n.observation);}page=r.nextPageToken;}while(page);return out;}
    async function assign(uid,assignment,before){
      await principal();if(identity.role!=='admin'||!uid||uid.includes('/'))fail('Administración restringida.','PERMISSION');
      const data=clone(assignment);if(!['aprendiz','instructor','admin'].includes(data.role)||typeof data.active!=='boolean'||!Array.isArray(data.fichas)||!data.fichas.length||new Set(data.fichas).size!==data.fichas.length||data.fichas.some(f=>!FICHAS.includes(f))||data.role==='aprendiz'&&data.fichas.length!==1)fail('Asignación inválida.');
      const path='/sena_portal_calendar_assignments/'+encodeURIComponent(uid);
      await call('POST',':commit',{writes:[{update:{name:root+path,fields:fields(data)},currentDocument:before?{updateTime:before.updateTime}:{exists:false}}]});
      const out=document(await call('GET',path));for(const k of ['role','active','fichas'])if(JSON.stringify(out.data[k])!==JSON.stringify(data[k]))fail('Asignación no verificada.','READBACK');return out;
    }
    // Novedades institucionales (p. ej. «Sede SENA»): un documento por año, solo administrador (regla existente de
    // sena_portal_calendar). No las ve el aprendiz. Guardado con precondición de versión y historial en el mismo documento.
    const eventsPath=year=>{if(!Number.isInteger(year)||year<2020||year>2100)fail('Año inválido.');return '/sena_portal_calendar/institutional_events_'+year;};
    async function events(year){await principal();if(identity.role!=='admin')fail('Novedades institucionales restringidas.','PERMISSION');
      const d=await call('GET',eventsPath(year),undefined,true);return d?document(d):null;}
    async function saveEvents(year,data,before){await principal();if(identity.role!=='admin')fail('Novedades institucionales restringidas.','PERMISSION');
      const body=clone(data);if(body.year!==year||!Array.isArray(body.events)||!Array.isArray(body.history)||body.events.length>400||body.history.length>2000)fail('Novedades inválidas.');
      try{await call('POST',':commit',{writes:[{update:{name:root+eventsPath(year),fields:fields(body)},currentDocument:before?{updateTime:before.updateTime}:{exists:false}}]});}
      catch(e){if(!['PERMISSION','CONFLICT'].includes(e.code))e.message+=' Resultado no confirmado; recargue antes de reintentar.';throw e;}
      const out=document(await call('GET',eventsPath(year)));if(!equal(out.data,body))fail('Novedades no verificadas tras guardar.','READBACK');return out;}
    // Observación interna de UNA sesión (1 lectura), para no listar todas las notas en cada apertura.
    async function note(ficha,year,id){await principal();if(identity.role==='aprendiz')fail('Observaciones internas restringidas.','PERMISSION');
      const d=await call('GET',scope(ficha,year)+'/notes/'+encodeURIComponent(id),undefined,true);return d?document(d).data.observation:'';}
    return {principal,list,listCached,clearCache,save,transfer,events,saveEvents,note,history,notes,assign,source:async(ficha,year)=>{await principal();if(identity.role==='aprendiz')fail('Archivo histórico restringido.');const d=await call('GET',scope(ficha,year),undefined,true);return d?document(d):null;},readAssignment:async uid=>{await principal();if(identity.role!=='admin')fail('Administración restringida.');const d=await call('GET','/sena_portal_calendar_assignments/'+encodeURIComponent(uid),undefined,true);return d?document(d):null;}};
  }
  async function proposal(sessions,year,principal,existing=[]){
    const batch=[],days=new Set(existing.map(d=>d.data.ficha+'|'+d.data.date));
    for(const x of sessions.filter(x=>x.year===year)){
      if(!principal.fichas.includes(x.ficha)||x.status!=='Programada')fail('Solo se trasladan propuestas programadas de fichas asignadas.');
      const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(x.id));
      const id='draft_'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      const d={id,ficha:x.ficha,year:x.year,date:x.date,originalDate:x.originalDate,blocks:clone(x.blocks),plannedMinutes:x.plannedMinutes,actualMinutes:null,status:'Programada',activity:String(x.activity||''),evidence:String(x.evidence||''),dueDate:'',curriculum:Object.fromEntries(['id','competencyCode','competency','rap','order','source'].map(k=>[k,x.curriculum?.id?String(x.curriculum?.[k]??''):''])),sourceStatuses:[],origin:'new',protected:false,revision:0,mutationId:'draft',updatedBy:principal.uid};
      validate(d);
      const old=existing.find(e=>e.data.id===id);
      if(old){if(['ficha','year','date','originalDate','blocks','curriculum'].some(k=>!equal(d[k],old.data[k])))fail('La propuesta ya existe con cambios en Firestore. Revise esa sesión individualmente.','CONFLICT');continue;}
      const day=d.ficha+'|'+d.date;if(days.has(day))fail('Ya existe una sesión para la ficha y fecha propuestas.','CONFLICT');days.add(day);batch.push(d);
    }
    return batch;
  }
  // Learner agenda: classes, hours, activity and evidence to deliver with its deadline. Nothing internal.
  function agenda(sessions,today=new Date(Date.now()-5*3600e3).toISOString().slice(0,10)){
    const status={Programada:'scheduled',Activa:'scheduled',Realizada:'taught',Impartida:'taught',Suspendida:'cancelled',Cancelada:'cancelled',Parcial:'partial',Reprogramada:'rescheduled',Recuperada:'recovered','Sin programación':'unplanned'};
    const label=x=>x==='Estados mixtos — revisar'?'Clase':x;
    return sessions.flatMap(s=>{
      // Historical per-slot states are shown while the session keeps its source-derived state and original slots.
      const states=[...new Set(s.sourceStatuses.map(x=>x.state))],sourceState=states.length===1?states[0]:'Estados mixtos — revisar';
      const perSlot=s.origin==='legacy'&&s.sourceStatuses.length&&s.status===sourceState&&s.sourceStatuses.every(x=>(x.blocks||[]).every(b=>s.blocks.some(y=>y.start===b.start&&y.end===b.end)));
      const rows=perSlot?s.sourceStatuses.map(x=>({id:x.sourceId,status:x.state,blocks:x.blocks||s.blocks})):[{id:s.id,status:s.status,blocks:s.blocks}];
      const description=[s.activity&&'Actividad: '+s.activity,s.evidence&&'Entrega: '+s.evidence+(s.dueDate?' · fecha límite '+s.dueDate:' · sin fecha límite registrada')].filter(Boolean).join(' · ');
      const classes=rows.flatMap(r=>r.blocks.map((b,i)=>({id:r.id+':'+i,source:'calendar-cloud',sourceId:s.id,type:'CLASE',ficha:s.ficha,date:s.date,startAt:s.date+'T'+b.start+':00-05:00',endAt:s.date+'T'+b.end+':00-05:00',status:status[r.status]||'unknown',originalStatus:r.status,title:label(r.status)+' · Ficha '+s.ficha,description,route:'',readonly:true})));
      if(!s.evidence||!s.dueDate)return classes;
      // Deliveries are manual: a past deadline is reported as finished, never as missing.
      const next=new Date(Date.parse(today+'T12:00:00Z')+864e5).toISOString().slice(0,10);
      return [...classes,{id:s.id+':entrega',source:'calendar-cloud',sourceId:s.id,type:'ENTREGA',ficha:s.ficha,date:s.dueDate,startAt:'',endAt:'',dueAt:s.dueDate+'T23:59:00-05:00',allDay:false,
        status:s.dueDate<today?'deadline-passed':s.dueDate===today?'due-today':s.dueDate===next?'due-tomorrow':'pending',title:'Entrega · '+s.evidence,description:(s.activity?'Actividad: '+s.activity+' · ':'')+'Clase del '+s.date,route:'',readonly:true}];
    });
  }
  return {create,validate,duration,fields,decode,document,FICHAS,KEYS,agenda,proposal,clearCache};
});
