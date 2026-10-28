'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {load}=require('../tools/academic_calendar_snapshot.cjs');
function fixture(t,state){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sena-calendar-copy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({exportScopeComplete:true,readTime:'2030-02-01T00:00:00Z'}));
 const file=path.join(dir,'decoded.json');
 fs.writeFileSync(file,JSON.stringify([{name:'projects/sena-portal/databases/(default)/documents/sena_portal_calendar/calendario_2026_admin',value:{state,updatedAt:null}}]));
 return {dir,file};
}
test('preview snapshot preserves explicit state and unknown minutes without cloud calls',t=>{
 const state={ficticio:{estado:'Impartida',obs:'Solo copia',actualMinutes:null}},f=fixture(t,state),out=load(f.file),context={window:{}};
 vm.runInNewContext(out.script,context);assert.equal(JSON.stringify(context.window.CALENDAR_2026_INITIAL_STATE),JSON.stringify(state));
 assert.equal(out.meta.impartida,1);assert.equal(out.meta.records,1);assert.equal(out.meta.updatedAt,null);
});
test('preview refuses incomplete exports instead of silently using partial history',t=>{
 const f=fixture(t,{ficticio:{estado:'Impartida'}});fs.writeFileSync(path.join(f.dir,'manifest.json'),JSON.stringify({exportScopeComplete:false,readTime:'2030-02-01T00:00:00Z'}));
 assert.throws(()=>load(f.file),/Invalid calendar snapshot/);
});
test('preview serves only derived academic state, not its private file or unrelated documents',t=>{
 const f=fixture(t,{ficticio:{estado:'Impartida'}}),docs=JSON.parse(fs.readFileSync(f.file));docs.push({name:'unrelated',value:{private:'DO_NOT_EXPOSE'}});fs.writeFileSync(f.file,JSON.stringify(docs));
 let handler;const realFs={...fs,readFile:(name,cb)=>cb(null,fs.readFileSync(name))};
 vm.runInNewContext(fs.readFileSync('tools/preview_academic_planner.cjs','utf8'),{require:n=>n==='node:http'?{createServer:fn=>{handler=fn;return {listen(){}};}}:n==='node:fs'?realFs:require(n),__dirname:path.resolve('tools'),URL,Buffer,console,process:{argv:['node','preview','--firestore-snapshot',f.file]}});
 function request(url){let status,body;handler({method:'GET',url},{writeHead(s){status=s;return this;},end(b){body=String(b||'');}});return {status,body};}
 const seed=request('/data/calendario_2026_seed.js'),html=request('/');
 assert.equal(seed.status,200);assert.doesNotMatch(seed.body,/DO_NOT_EXPOSE/);
 assert.match(html.body,/1 registros · 1 Impartida/);
 assert.equal(request('/memory/decoded.json').status,404);assert.equal(request(f.file).status,404);
 assert.match(html.body,/<\/header>[\s\S]*<main[\s\S]*role="note"/);
 const learner=request('/pages/auxiliares/calendario-aprendiz.html?preview=local');
 assert.equal(learner.status,200);
 assert.doesNotMatch(learner.body,/\sdata-reveal(?:\s|=|>)/);
 assert.match(learner.body,/connect-src 'none'/);
 assert.doesNotMatch(learner.body,/<script[^>]+(?:shared_shell|firebase|auth)/);
});
