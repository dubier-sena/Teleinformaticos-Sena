'use strict';
// Preview only the isolated planner. Never serve memory/, credentials, or other pages.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
// Optional, explicit copy selected by the operator; never calls production.
const args=typeof process==='undefined'?[]:process.argv.slice(2);
const emulator=args.includes('--emulator');
const snapshotIndex=args.indexOf('--firestore-snapshot');
const snapshot=snapshotIndex<0?null:require(path.join(__dirname,'academic_calendar_snapshot.cjs')).load(args[snapshotIndex+1]);
const allowed=new Set(['calendario-planificador-local.html','js/academic_planner.js','js/academic_planner_integration.js','js/academic_planner_workspace.js','js/academic_planner_annual.js','js/academic_planner_annual_ui.js','data/calendario_2026_records.js','data/calendario_2026_seed.js','js/academic_planner_store.js','js/academic_planner_page.js','js/academic_planner_calendar.js','data/academic_planner_catalog.js','css/site_tokens.css','css/components.css','css/page_academic_planner.css']);
['js/academic_calendar_cloud.js','js/academic_calendar_connection.js','js/academic_calendar_cloud_ui.js'].forEach(f=>allowed.add(f));
const learner='pages/auxiliares/calendario-aprendiz.html';
const learnerScripts=['js/academic_planner.js','js/academic_planner_integration.js','js/academic_planner_store.js','js/academic_planner_student_preview.js','js/productive_stage_deadlines.js','js/academic_agenda.js','js/academic_agenda_views.js','js/academic_agenda_calendar_ui.js','js/agenda_view_preference.js','js/student_calendar.js'];
[learner,...learnerScripts,'css/shared_shell.css','css/page_student_calendar.css','css/academic_agenda_calendar.css'].forEach(f=>allowed.add(f));
function learnerPreview(body,secure=false){
  // shared_shell.js is intentionally excluded from this offline preview.
  // Remove its reveal hooks so content does not remain transparent without it.
  let html=body.toString().replace(/\sdata-reveal(?:=(?:"[^"]*"|'[^']*'))?(?=[\s>])/gi,'')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*https:[^>]*>/gi,'').replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?>/i,"<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; img-src 'self' data:;\">");
  return html.replace('</head>',learnerScripts.filter(f=>!secure||f!=='js/academic_planner_student_preview.js').map(f=>'<script defer src="'+f+'?v=20261020_1"></script>').join('')+'</head>');
}
const server=http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'calendario-planificador-local.html';}catch{res.writeHead(400).end();return;}
  if(name===learner&&!new URL(req.url,'http://localhost').searchParams.has('preview')&&!(emulator&&new URL(req.url,'http://localhost').searchParams.get('cloud')==='emulator')){res.writeHead(404).end();return;}
  const cloud=emulator&&(name==='calendario-planificador-local.html'||name===learner&&new URL(req.url,'http://localhost').searchParams.get('cloud')==='emulator');
  if(emulator&&['GET','HEAD'].includes(req.method)&&name==='calendar-emulator-config.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'}).end("window.SENA_CALENDAR_FIRESTORE={enabled:true,projectId:'demo-sena-calendar',emulatorHost:'127.0.0.1:9180',demoUid:"+JSON.stringify(new URL(req.url,'http://localhost').searchParams.get('role')==='learner'?'demo-student-0':new URL(req.url,'http://localhost').searchParams.get('role')==='admin'?'demo-admin':'demo-instructor')+"};");return;}
  if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(404).end('Not found');return;}
  fs.readFile(path.join(root,name),(err,body)=>{
    if(err){res.writeHead(404).end();return;}
    if(snapshot&&name==='data/calendario_2026_seed.js')body=Buffer.from(snapshot.script);
    if(snapshot&&name==='calendario-planificador-local.html')body=body.toString().replace('Referencia 2026 · solo lectura','Firestore 2026 · copia solo lectura').replace('<p id="planner-message"','<p class="local-notice" role="note">Copia Firestore leída el '+snapshot.meta.readTime+' · '+snapshot.meta.records+' registros · '+snapshot.meta.impartida+' Impartida. Solo lectura; no sincroniza con producción.</p><p id="planner-message"');
    if(name===learner)body=learnerPreview(body,cloud);
    if(cloud){body=body.toString().replace('Guardado en este navegador · Sin sincronización con el portal ni con aprendices.','Pruebas aisladas · Firestore del emulador. Los borradores del asistente siguen en este navegador; producción no se modifica.').replace("connect-src 'none'","connect-src 'self' http://127.0.0.1:9180").replace('<title>', '<script defer src="calendar-emulator-config.js?role='+ (name===learner?'learner':new URL(req.url,'http://localhost').searchParams.get('role')==='admin'?'admin':'instructor')+'"></script>'+(name===learner?['js/academic_calendar_cloud.js','js/academic_calendar_connection.js'].map(f=>'<script defer src="'+f+'?v=20261021_3"></script>').join(''):'')+'<title>');}

    res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript'}[path.extname(name)]||'text/plain')+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);
  });
});
server.listen(9092,'127.0.0.1',()=>console.log('Planificador local: http://127.0.0.1:9092/'));
