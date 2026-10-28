'use strict';
// Deliberately hardwired to a demo project and loopback. Never accepts a production URL.
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:9180/v1/projects/demo-sena-calendar/databases/(default)/documents';
const results = [];
function value(v) {
  if(v===null)return {nullValue:null};
  if(Array.isArray(v))return {arrayValue:{values:v.map(value)}};
  if(typeof v==='object')return {mapValue:{fields:fields(v)}};
  return typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:{stringValue:v};
}
function fields(d){return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,value(v)]));}
function token(uid,extra={}) {
  const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),now=Math.floor(Date.now()/1000);
  return b({alg:'none',typ:'JWT'})+'.'+b({iss:'https://securetoken.google.com/demo-sena-calendar',aud:'demo-sena-calendar',
    sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,email:uid+'@sena-portal.local',
    firebase:{sign_in_provider:'password',identities:{}},...extra})+'.';
}
async function request(method,path,who,body){
  const headers={'Content-Type':'application/json'};if(who)headers.Authorization='Bearer '+who;
  const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const text=await r.text();return {status:r.status,text};
}
async function seed(path,d){const r=await request('PATCH','/'+path,'owner',{fields:fields(d)});assert.equal(r.status,200,r.text);}
async function expect(name,status,method,path,who,body){
  const r=await request(method,path,who,body);assert.equal(r.status,status,name+': '+r.text);results.push({name,status});
}
(async()=>{
  const fichas=['900001','900002','900003','900004','900005','900006'];
  await seed('sena_portal_roles/test-admin',{role:'admin'});
  for(const [i,ficha] of fichas.entries()){
    // 2026-10-28: perfil existente validado por el administrador (sin documentos de asignación).
    await seed('sena_portal_users/student'+i,{usernameKey:'student'+i,fullName:'Ficticio '+i,ficha,validacionNombre:'oficial',active:true});
    await seed('sena_portal_calendar_fichas/'+ficha+'/years/2030',{ficha,year:2030,records:[{id:'ficticio-'+i,observacion:'Privada ficha '+ficha}]});
  }
  await seed('sena_portal_calendar/calendario_2030_admin',{state:{other:'Todas las fichas ficticias'}});
  await seed('sena_portal_progress/__calendar__:calendario_2030_admin',{state:{other:'Copia global ficticia'}});
  for(const [i,own] of fichas.entries()){
    for(const ficha of fichas)await expect('student'+i+' -> '+ficha,ficha===own?200:403,'GET','/sena_portal_calendar_fichas/'+ficha+'/years/2030/sessions',token('student'+i));
  }
  const own='/sena_portal_calendar_fichas/900001/years/2030',s=token('student0');
  await expect('own raw historical archive is private',403,'GET',own,s);
  await expect('anonymous denied',403,'GET',own,null);
  await expect('unassigned with forged claims denied',403,'GET',own,token('unassigned',{role:'admin',ficha:'900001'}));
  await seed('sena_portal_user_index/unassigned',{ficha:'900001'});
  await expect('user-editable index is not authority',403,'GET',own,token('unassigned'));
  await expect('cannot self assign',403,'PATCH','/sena_portal_calendar_assignments/unassigned',token('unassigned'),{fields:fields({role:'aprendiz',active:true,fichas:['900001']})});
  await expect('cannot change assignment',403,'PATCH','/sena_portal_calendar_assignments/student0',s,{fields:fields({role:'aprendiz',active:true,fichas:['900002']})});
  await expect('cannot read foreign assignment',403,'GET','/sena_portal_calendar_assignments/student1',s);
  await expect('assignment docs are unused: not even the owner reads them',403,'GET','/sena_portal_calendar_assignments/student0',s);
  await expect('owner cannot change own profile ficha',403,'PATCH','/sena_portal_users/student0?updateMask.fieldPaths=ficha',s,{fields:fields({ficha:'900002'})});
  await expect('owner cannot self-validate a new profile',403,'PATCH','/sena_portal_users/unassigned',token('unassigned'),{fields:fields({usernameKey:'unassigned',ficha:'900001',validacionNombre:'oficial'})});
  await expect('cannot write view',403,'PATCH',own,s,{fields:fields({ficha:'900001',year:2030,records:[]})});
  await expect('cannot delete view',403,'DELETE',own,s);
  await expect('cannot list years',403,'GET','/sena_portal_calendar_fichas/900001/years',s);
  await expect('cannot query all fichas',403,'POST',':runQuery',s,{structuredQuery:{from:[{collectionId:'years',allDescendants:true}]}});
  for(const path of ['/sena_portal_calendar/calendario_2030_admin','/sena_portal_progress/__calendar__:calendario_2030_admin']){
    await expect('global source denied '+path,403,'GET',path,s);
    await expect('global source admin allowed '+path,200,'GET',path,token('test-admin'));
  }
  await expect('calendar fallback ownership spoof denied',403,'GET','/sena_portal_progress/__calendar__:calendario_2030_admin',token('spoof',{email:'__calendar__:calendario_2030_admin@sena-portal.local'}));
  // Sin rol de instructor: solo el administrador edita/lee la vista materializada.
  await seed('sena_portal_roles/instructor',{role:'instructor'});
  await expect('non-admin role cannot read materialized view',403,'GET',own,token('instructor'));
  await expect('non-admin role cannot read another view',403,'GET','/sena_portal_calendar_fichas/900003/years/2030',token('instructor'));
  await expect('non-admin role cannot rewrite materialized history',403,'PATCH',own,token('instructor'),{fields:fields({ficha:'900001',year:2030})});
  await expect('admin reads materialized view',200,'GET',own,token('test-admin'));
  await seed('sena_portal_users/student0',{usernameKey:'student0',ficha:'900001',validacionNombre:'oficial',active:false});
  await expect('deactivated profile denies old token',403,'GET',own+'/sessions',s);
  await seed('sena_portal_users/student0',{usernameKey:'student0',ficha:'900001',active:true});
  await expect('unvalidated profile denied',403,'GET',own+'/sessions',s);
  await seed('sena_portal_users/student0',{usernameKey:'student0',ficha:'900001',validacionNombre:'oficial',active:true});
  await expect('restored profile allowed again',200,'GET',own+'/sessions',s);
  await seed('sena_portal_calendar_fichas/900001/years/2030',{ficha:'900002',year:2030,records:[]});
  await expect('inconsistent ficha document denied to non-admin',403,'GET',own,token('instructor'));
  await seed('sena_portal_calendar_fichas/900001/years/2030',{ficha:'900001',year:2031,records:[]});
  await expect('inconsistent year denied to non-admin',403,'GET',own,token('instructor'));
  console.log(JSON.stringify({project:'demo-sena-calendar',endpoint:'127.0.0.1:9180',productionWrites:0,passed:results.length,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
