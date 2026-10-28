'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {prepareRules,prepareDrive,readModels}=require('../tools/academic_calendar_security.cjs');
test('candidate changes only calendar rules and legacy calendar ownership exception',()=>{
 const base=fs.readFileSync('firestore.rules','utf8'),out=prepareRules(base);
 assert.match(out,/calendarAssigned\(ficha\)/);
 // 2026-10-28: ficha desde el perfil existente validado (sin asignaciones), mismo control de identidad del portal.
 assert.match(out,/get\(\/databases\/\$\(database\)\/documents\/sena_portal_users\/\$\(key\)\)\.data/);
 assert.match(out,/isOwnerByUsernameKey\(key\) && p\.ficha == ficha/);
 assert.match(out,/p\.get\('validacionNombre', ''\) in \['oficial', 'duplicado_diferenciado'\]/);
 // El aprendiz no puede cambiar su ficha ni su validación; nadie escribe asignaciones.
 assert.match(out,/affectedKeys\(\)\.hasAny\(\['ficha', 'validacionNombre', 'nombreOficial', 'fuenteValidacion', 'active', 'estado', 'status'\]\)/);
 assert.match(out,/match \/sena_portal_calendar_assignments\/\{uid\} \{\n      allow get, list: if isAdmin\(\);\n      allow create, update, delete: if false;/);
 assert.doesNotMatch(out,/allow create, update: if isAdmin\(\) \|\| isOwnerByUsernameKey\(usernameKey\);\n      allow delete: if isAdmin\(\);\n    \}\n    \/\/ ───── Hash/);
 assert.match(out,/!usernameKey\.matches\("\^__calendar__:\.\*\$"\)/);
 assert.throws(()=>prepareRules(out),/baseline changed/);
});
test('Drive candidate denies all calendar bypass routes to learners, preserves admin and unrelated ownership',()=>{
 const c={};vm.createContext(c);vm.runInContext(prepareDrive(fs.readFileSync('apps-script/respaldo_firestore.gs','utf8')),c);
 const who={email:'ficticio@sena-portal.local',uid:'ficticio',adminEmails:['admin@sena-portal.local']};
 for(const collection of ['sena_portal_calendar','sena_portal_calendar_assignments','sena_portal_calendar_fichas','sena_portal_progress']){
  for(const action of ['get','list','set','updatefield','delete']){
   const args={...who,collection,action,docId:'__calendar__:ficticio'};
   assert.equal(c.authorizeRequest(args).ok,false,collection+action);
   assert.equal(c.authorizeRequest({...args,email:'admin@sena-portal.local'}).ok,true);
  }
 }
 assert.equal(c.authorizeRequest({...who,collection:'sena_portal_progress',action:'get',docId:'ficticio'}).ok,true);
});
test('ficha documents do not carry foreign rows or the complete archive, including unknown fields',()=>{
 const records=['A','B'].map((id,i)=>({id,fecha:'2030-02-04',tipo:'CLASE',colegio:'Ficticia',grado:id,horario:'7:00–8:00',defE:'Activa'}));
 records.push({id:'sena',fecha:'2030-02-05',tipo:'SENA',horario:'—',defE:'Activa'});
 const snapshot={state:{A:{estado:'Impartida',obs:'Solo A',extra:{keep:true}},B:{estado:'Impartida',obs:'Solo B'},sena:{estado:'Impartida'}},extra:'Archive'};
 const before=JSON.stringify(snapshot),out=readModels({records,snapshot,mapping:{'Ficticia|A':'900001','Ficticia|B':'900002'},year:2030,readTime:'2030-02-05T00:00:00Z'});
 assert.equal(JSON.stringify(snapshot),before);assert.deepEqual(out.archive,snapshot);
 assert.equal(out.documents['900001'].records.length,1);
 assert.equal(out.documents['900001'].records[0].sourceState.extra.keep,true);
 assert.ok(!JSON.stringify(out.documents['900001']).includes('Solo B'));
 assert.equal(out.documents['900001'].records[0].actualMinutes,null);
 assert.equal(out.adminOnly[0].sourceId,'sena');
});
test('preparation rejects unresolved cloud IDs instead of dropping them',()=>{
 assert.throws(()=>readModels({records:[],snapshot:{state:{missing:{estado:'Impartida'}}},mapping:{},year:2030,readTime:'2030'}),/Unresolved/);
});
