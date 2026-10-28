'use strict';
// Pure release preparation. No network and no writes to live files or accounts.
const crypto=require('node:crypto'),Package=require('./academic_calendar_package.cjs');
const IMPORT_REASON='Importación verificada; originales en archivo histórico privado por ficha.';
function prepare(input,catalog){
 const p=Package.prepare(input),documents=[];
 const add=(path,data)=>documents.push({path,data:structuredClone(data),precondition:{exists:false}});
 add('sena_portal_calendar/archive_'+input.year+'_'+p.source.sha256.slice(0,24),{...p.archive,archiveSource:p.source});
 for(const [f,d] of Object.entries(p.documents))add('sena_portal_calendar_fichas/'+f+'/years/'+input.year,d);
 for(const s of p.sessions){const prefix='sena_portal_calendar_fichas/'+s.ficha+'/years/'+s.year;add(prefix+'/sessions/'+s.id,s);add(prefix+'/days/'+s.date,{sessionId:s.id});add(prefix+'/sessions/'+s.id+'/audit/0',{revision:0,actor:s.updatedBy,reason:IMPORT_REASON,mutationId:s.mutationId,before:null,after:s,notesBefore:'',notesAfter:''});add(prefix+'/notes/'+s.id,{sessionId:s.id,revision:0,observation:''});}
 for(const item of catalog.items.filter(x=>!x.needsVerification)){
  const value=Object.fromEntries(['id','competencyCode','competency','rap','order','source'].map(k=>[k,String(item[k]??'')]));
  add('sena_portal_calendar_curriculum/'+item.id,{value,fichas:item.fichas});
 }
 if(new Set(documents.map(d=>d.path)).size!==documents.length)throw Error('Duplicate destination; do not import.');
 const all=[...Object.values(p.documents).flatMap(d=>d.records),...p.adminOnly];
 const comparison=all.map(r=>({id:r.sourceId,ficha:r.ficha,date:r.date,state:r.state,sourceStateUnchanged:JSON.stringify(r.sourceState)===JSON.stringify(input.snapshot.state[r.sourceId]),archiveUnchanged:JSON.stringify(input.snapshot.state[r.sourceId])===JSON.stringify(p.archive.state[r.sourceId]),sessionId:p.sessions.find(s=>s.sourceStatuses.some(x=>x.sourceId===r.sourceId))?.id||null}));
 if(comparison.length!==Object.keys(input.snapshot.state).length||comparison.some(c=>!c.sourceStateUnchanged||!c.archiveUnchanged))throw Error('Individual source verification failed.');
 return {schemaVersion:1,preparedOnly:true,productionWrites:0,requiredAdminUid:input.adminUid,source:p.source,integrity:p.integrity,comparison,documents,assignments:{source:'Administración institucional verificada, nunca el perfil editable',accounts:[],requiredFields:['uid','role','active','fichas'],status:'PENDIENTE de cuentas verificadas y autorización; no se inventan UID'}};
}
function pages(planner,learner){
 const version='20261021_3',script=f=>'<script defer src="'+f+'?v='+version+'"></script>',blocking=f=>'<script src="'+f+'?v='+version+'"></script>';
 const config=script('js/academic_calendar_release_config.js');
 const auth=['js/firebase-config.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js','js/firebase_auth_bridge.js'].map(script).join('\n');
 // Prepublication audit 2026-10-21: the planner is an instructor page and must be gated like every admin page.
 // Same pattern as the published admin pages: portal_auth.js and the guard are blocking, before deferred scripts.
 const guard=blocking('js/portal_auth.js')+'\n'+blocking('js/access_guard_admin.js');
 // New route: the published administrative agenda (manual events, productive stage) stays untouched. Do not ship the global seed.
 const instructor=planner.replace(/<script[^>]+src="data\/calendario_2026_(?:records|seed)\.js[^>]*><\/script>\s*/g,'')
  .replace('<title>',guard+'\n'+config+auth+'<title>')
  .replace("script-src 'self'", "script-src 'self' https://www.gstatic.com")
  // Candidata 2026-10-28: los 6 hosts confirmados del portal (tests/csp_hardening), igual que las demas paginas con Firebase.
  .replace("connect-src 'none'", "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://script.google.com https://script.googleusercontent.com https://cdn.jsdelivr.net")
  .replace(/<option value="legacy">[^<]*<\/option>/g,'')
  .replace('Guardado en este navegador · Sin sincronización con el portal ni con aprendices.','El asistente prepara borradores locales. Conecte Firestore para consultar y guardar sesiones de sus fichas autorizadas.');
 // Keep the existing authentication, styles and learner renderer; remove global data/fallback loaders.
 // Deliverable sources stay (guide deadlines, productive stage); the all-fichas records file and global manual events do not.
 const keep=new Set(['shared_utils','global_error_handler','portal_auth','firebase-config','firebase_auth_bridge','guide_merge_utils','firebase_db','project_integrations','drive_db','firebase_status_banner','save_status','shared_shell','activity_standard','guide_declarations','activity_deadlines','productive_stage_store','productive_stage_deadlines','academic_agenda','academic_agenda_context','academic_agenda_views','academic_agenda_calendar_ui','agenda_view_preference','student_calendar','access_guard_authenticated']);
 const student=learner.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(tag,url)=>{const file=url.split('/').pop().split('?')[0].replace(/\.js$/,'');return keep.has(file)||/^https:\/\/www\.gstatic\.com\/firebasejs\//.test(url)?tag:'';})
  .replace('<title>',config+script('js/academic_calendar_cloud.js')+script('js/academic_calendar_connection.js')+'<title>');
 return {'calendario-academico-sesiones.html':instructor,'pages/auxiliares/calendario-aprendiz.html':student,
  'js/academic_calendar_release_config.js':"// Candidate only. Deploy together with reviewed rules, assignments and data.\nwindow.SENA_CALENDAR_FIRESTORE={enabled:true,projectId:'sena-portal'};\n"};
}
module.exports={prepare,pages};
