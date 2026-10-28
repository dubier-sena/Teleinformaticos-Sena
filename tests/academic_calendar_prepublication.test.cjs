'use strict';
// Prepublication audit 2026-10-21 (calendar). No network, no private data: guards for the release candidate.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=r=>fs.readFileSync(path.join(__dirname,'..',r),'utf8'),R=require('../tools/academic_calendar_release.cjs'),Security=require('../tools/academic_calendar_security.cjs');
const pages=()=>R.pages(read('calendario-planificador-local.html'),read('pages/auxiliares/calendario-aprendiz.html'));
const scripts=h=>[...h.matchAll(/<script([^>]*)src="([^"]+)"[^>]*><\/script>/g)].map(m=>({file:m[2].split('?')[0].split('/').pop(),defer:/\bdefer\b/.test(m[1])}));
test('instructor candidate lives on a new route, gated like every admin page',()=>{
 const out=pages(),list=scripts(out['calendario-academico-sesiones.html']),idx=f=>list.findIndex(s=>s.file===f);
 assert.ok(!('calendario-administrativo-agenda.html' in out),'the published administrative agenda is not replaced');
 assert.ok(idx('portal_auth.js')>=0&&idx('access_guard_admin.js')===idx('portal_auth.js')+1,'guard right after portal_auth');
 assert.equal(list[idx('portal_auth.js')].defer,false);assert.equal(list[idx('access_guard_admin.js')].defer,false);
 assert.ok(list.slice(0,idx('access_guard_admin.js')).every(s=>!s.defer),'nothing deferred runs before the guard');
 assert.ok(!list.some(s=>/^calendario_2026_(records|seed)\.js$/.test(s.file)),'no all-fichas seed shipped');
 assert.match(out['calendario-academico-sesiones.html'],/connect-src 'self' https:\/\/firestore\.googleapis\.com/);
});
test('learner candidate keeps its deliverable sources and drops every all-fichas calendar source',()=>{
 const list=scripts(pages()['pages/auxiliares/calendario-aprendiz.html']).map(s=>s.file),at=f=>list.indexOf(f);
 for(const f of ['activity_deadlines.js','guide_declarations.js','activity_standard.js','productive_stage_store.js','academic_agenda_context.js','academic_agenda.js','student_calendar.js','academic_calendar_cloud.js','academic_calendar_connection.js','access_guard_authenticated.js'])assert.ok(at(f)>=0,f);
 for(const f of ['calendario_2026_records.js','calendario_admin_manual_events.js'])assert.equal(at(f),-1,f);
 assert.ok(at('guide_merge_utils.js')<at('firebase_db.js'),'critical load order');assert.ok(at('portal_auth.js')<at('access_guard_authenticated.js'));
});
function context(overrides){const sb={console,Set,Promise,JSON,Object,Array,String,encodeURIComponent,setTimeout,clearTimeout,localStorage:{getItem(){return null;},setItem(){},removeItem(){}}};sb.window=sb;Object.assign(sb,overrides);vm.createContext(sb);vm.runInContext(read('js/academic_agenda_context.js'),sb);return sb.academicAgendaContext;}
const auth={getCurrentSession:()=>({role:'student',user:{usernameKey:'ficticio',ficha:'3441939'}}),getFichaInfo:()=>({inst:'Institucion Ficticia',grupo:'10A'}),getGuidesForFicha:()=>['guia-ficticia.html'],getGuideTitle:()=>'Guía ficticia',getGuideHref:f=>'guia.html?g='+f,getStudentStorageKey:(u,k)=>u+':'+k};
const deadlines={ready:()=>Promise.resolve(),getSnapshot:()=>({policies:{'guia-ficticia.html':{act1:{dueAt:'2030-03-01T22:00:00.000Z'}}}}),getActivitiesForGuide:()=>[{id:'act1',label:'Actividad ficticia'}]};
test('secure mode never requests the all-fichas calendar document, but guide deadlines still resolve',async()=>{
 let calls=0;const db={cloudGetCalendar:async()=>{calls++;return {state:{x:{estado:'Impartida',obs:'Privada'}}};}};
 const secure=await context({portalAuth:auth,activityDeadlineManager:deadlines,_firebaseDb:db,SENA_CALENDAR_FIRESTORE:{enabled:true}}).resolveStudentAgendaContext();
 assert.equal(calls,0);assert.ok(secure);
 const events=require('../js/academic_agenda.js').buildAcademicAgenda(secure).events;assert.ok(events.some(e=>e.type==='ENTREGA'&&e.dueAt==='2030-03-01T22:00:00.000Z'));
 await context({portalAuth:auth,activityDeadlineManager:deadlines,_firebaseDb:db}).resolveStudentAgendaContext();assert.equal(calls,1,'published behaviour unchanged without the secure flag');
});
test('secure learner view adds deliverables only for the attested ficha and never global classes',()=>{
 const src=read('js/student_calendar.js'),fn=src.slice(src.indexOf('async function secureDeliverables'),src.indexOf('async function loadAndRender'));
 assert.match(fn,/String\(input\.context\.ficha\) !== String\(attestedFicha\)\) return \{events: \[\]\}/);assert.match(fn,/e\.type !== "CLASE"/);
 const cloud=src.slice(src.indexOf('Secure calendar mode'),src.indexOf('This explicit fixture path'));assert.doesNotMatch(cloud,/loadManualEventsForFicha/,'global manual events are not read in secure mode');
});
test('candidate rules keep every non-calendar rule of their base',()=>{
 const base=read('firestore.rules'),out=Security.prepareRules(base),matches=t=>new Set([...t.matchAll(/match (\/[^\s{]+(?:\{[^}]+\}[^\s{]*)*)\s*\{/g)].map(m=>m[1]));
 const before=matches(base),after=matches(out);
 for(const m of before)assert.ok(after.has(m),'rule lost: '+m);
 for(const m of after)if(!before.has(m))assert.match(m,/sena_portal_calendar|^\/audit\/\{revision\}$/,'only calendar rules are added: '+m);
 assert.equal(out.split('match /audit/{revision}').length,2,'the only nested addition is the calendar audit receipt');
});
const Deploy=require('../tools/academic_calendar_deploy.cjs'),Release2=R,Imp=require('../tools/academic_calendar_import.cjs');
const ADMIN='AdminFicticio000000000001';
function fixture(){const p=Release2.prepare({records:[{id:'a',fecha:'2030-02-04',tipo:'CLASE',colegio:'F',grado:'A',horario:'07:00–07:55',defE:'Activa'}],snapshot:{state:{a:{estado:'Impartida',obs:'x'}}},mapping:{'F|A':'3168850'},year:2030,readTime:'2030-02-05T00:00:00Z',adminUid:ADMIN},{items:[]});
 return {prepared:p,assignments:{instructor:{uid:ADMIN},asignacionesAprendiz:[{uid:'AprendizFicticio00000001',role:'aprendiz',active:true,fichas:['3168850']}]}};}
test('deploy plan validates the verified admin and every learner assignment',()=>{
 const f=fixture();assert.equal(Deploy.plan(f).learnerAssignments,1);
 assert.throws(()=>Deploy.plan({...f,assignments:{...f.assignments,instructor:{uid:'PENDIENTE'}}}),/no verificado/);
 assert.throws(()=>Deploy.plan({...f,prepared:{...f.prepared,requiredAdminUid:'OtroAdmin0000000000000001'}}),/administrador verificado/);
 for(const bad of [{fichas:['3168850','3168852']},{fichas:['999']},{role:'admin'},{active:false}])assert.throws(()=>Deploy.plan({...f,assignments:{...f.assignments,asignacionesAprendiz:[{...f.assignments.asignacionesAprendiz[0],...bad}]}}),/inválida/);
 const a=f.assignments.asignacionesAprendiz[0];assert.throws(()=>Deploy.plan({...f,assignments:{...f.assignments,asignacionesAprendiz:[a,a]}}),/repetido/);
});
test('production execution requires the owner phrase with today\'s date',()=>{
 assert.equal(Deploy.authorized('emulador',{}),true);assert.throws(()=>Deploy.authorized('produccion',{}),/autorización/);
 assert.throws(()=>Deploy.authorized('produccion',{SENA_AUTORIZACION_DESPLIEGUE:'AUTORIZO DESPLIEGUE CALENDARIO 2020-01-01'}),/autorización/);
 assert.equal(Deploy.authorized('produccion',{SENA_AUTORIZACION_DESPLIEGUE:'AUTORIZO DESPLIEGUE CALENDARIO '+Deploy.today()}),true);
 assert.throws(()=>Deploy.authorized('otro',{}),/desconocido/);
});
test('deploy bootstraps the admin, imports, assigns, never overwrites a different assignment and stops if the import stops',async()=>{
 const f=fixture(),docs=new Map(),assigns=new Map();
 const transport={async commit(w){if(w.some(x=>docs.has(x.path))){const e=Error('exists');e.code='CONFLICT';throw e;}for(const x of w)docs.set(x.path,JSON.parse(JSON.stringify(x.data)));},async read(p){return docs.has(p)?JSON.parse(JSON.stringify(docs.get(p))):null;}};
 const api={principal:async()=>{const a=docs.get('sena_portal_calendar_assignments/'+ADMIN);if(!a)throw Error('none');return {uid:ADMIN,...a};},readAssignment:async u=>assigns.has(u)?{data:assigns.get(u)}:null,assign:async(u,d)=>{assigns.set(u,d);}};
 const r=await Deploy.execute({...f,api,transport});assert.equal(r.receipt.status,'COMPLETADA');assert.deepEqual(r.assigned,['AprendizFicticio00000001']);
 assert.deepEqual(docs.get('sena_portal_calendar_assignments/'+ADMIN).fichas,require('../js/academic_calendar_cloud.js').FICHAS);
 const again=await Deploy.execute({...f,api,transport});assert.deepEqual(again.skipped,['AprendizFicticio00000001']);assert.equal(again.assigned.length,0);
 assigns.set('AprendizFicticio00000001',{role:'aprendiz',active:true,fichas:['3168852']});await assert.rejects(Deploy.execute({...f,api,transport}),/no se sobrescribe/);
 assert.deepEqual(assigns.get('AprendizFicticio00000001').fichas,['3168852'],'different existing assignment untouched');
 const s=[...docs.keys()].find(k=>/\/sessions\/[^/]+$/.test(k));docs.set(s,{...docs.get(s),activity:'vigente'});assigns.clear();
 const stopped=await Deploy.execute({...f,api,transport});assert.equal(stopped.stopped,true);assert.equal(assigns.size,0,'no assignments after a stopped import');
});
