'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {portalConfig,emulatorOptions}=require('../v6/server/firebase.cjs');
const root=path.resolve(__dirname,'..');
function browser(config){const w={PORTAL_FIREBASE_CONFIG:config,HardwareLab:{},location:{href:'http://127.0.0.1:8796/laboratorio-virtual-hardware.html',origin:'http://127.0.0.1:8796'}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/hardware_lab_firebase_v6.js'),'utf8'),{window:w,URL,AbortController,setTimeout,clearTimeout});return w;}
const config=()=>({enabled:true,projectId:'demo-hwlab-v6',hardwareLabV6:{enabled:true,mode:'emulator',endpoint:'/v6/checkpoints',authEmulatorHost:'127.0.0.1:9099'}});
test('V6 Firebase adapter reads existing portal configuration without activating production',()=>{const w={};vm.runInNewContext(fs.readFileSync(path.join(root,'js/firebase-config.js'),'utf8'),{window:w});const d=portalConfig(w.PORTAL_FIREBASE_CONFIG);assert.equal(d.projectId,w.PORTAL_FIREBASE_CONFIG.projectId);assert.equal(d.roles,'sena_portal_roles');const b=browser(w.PORTAL_FIREBASE_CONFIG);assert.equal(b.HardwareLab.FirebaseV6.transport({uid:'test'}),null);});
test('V6 Firebase startup rejects production projects and non-loopback emulator endpoints',()=>{const good={projectId:'demo-hwlab-v6',authHost:'127.0.0.1:9099',firestoreHost:'127.0.0.1:8089'};assert.deepEqual(emulatorOptions(good),good);for(const bad of [{projectId:'sena-portal'},{authHost:'identitytoolkit.googleapis.com:443'},{firestoreHost:'127.0.0.1:99999'},{firestoreHost:'localhost:8089'}])assert.throws(()=>emulatorOptions({...good,...bad}));});
test('V6 browser adapter uses existing portal token, refreshes each request and rejects changed UID',async()=>{const w=browser(config());let uid='test',n=0;w.portalFirebaseAuth={getIdToken:async()=>`token-${++n}`,currentUid:()=>uid};const t=w.HardwareLab.FirebaseV6.transport({uid});assert.equal(await t.token(),'token-1');assert.equal(await t.token(),'token-2');uid='other';await assert.rejects(t.token(),/IDENTITY_CHANGED/);});
test('V6 browser adapter rejects production capability and token exfiltration endpoints',()=>{for(const change of [{mode:'production'},{endpoint:'https://example.test/v6/checkpoints'},{endpoint:'http://127.0.0.1:9999/v6/checkpoints'},{endpoint:'/v6/checkpoints?target=x'}]){const c=config();Object.assign(c.hardwareLabV6,change);assert.throws(()=>browser(c).HardwareLab.FirebaseV6.transport({uid:'a'}));}});
function bridge(c){const events=[],user={uid:'test',getIdToken:async()=>'emulated-token'},auth={currentUser:user,setPersistence:async()=>events.push('persistence'),useEmulator:url=>events.push(url)};const app={options:{projectId:c.projectId}};function getAuth(){return auth;}getAuth.Auth={Persistence:{LOCAL:'local'}};const w={PORTAL_FIREBASE_CONFIG:{apiKey:'fake',...c},firebase:{apps:[],app:()=>app,initializeApp:()=>{events.push('initialize');return app;},auth:getAuth}};vm.runInNewContext(fs.readFileSync(path.join(root,'js/firebase_auth_bridge.js'),'utf8'),{window:w,console:{warn(){}},setTimeout,clearTimeout});return{w,events};}
test('V6 existing Auth bridge attaches emulator before persistence and reuses signed-in UID',async()=>{const {w,events}=bridge(config());assert.equal(await w.portalFirebaseAuth.ready(),true);assert.deepEqual(events,['initialize','http://127.0.0.1:9099','persistence']);assert.equal(w.portalFirebaseAuth.currentUid(),'test');assert.equal(await w.portalFirebaseAuth.getIdToken(),'emulated-token');});
test('V6 existing Auth bridge refuses real project emulator activation before initializing SDK',async()=>{const c=config();c.projectId='sena-portal';const {w,events}=bridge(c);assert.equal(await w.portalFirebaseAuth.ready(),false);assert.deepEqual(events,[]);});
test('V6 gateway and rule extension do not alter legacy published rules or academic modules',()=>{
 // SHA-256 from the verified V5 baseline, before V6 publication preparation.
 // Keep this protection runnable in a clean clone without a sibling V5 tree.
 const baseline={
  'firestore.rules':'07fb3f9a515a9efe72f93c2918a24a97539ee43d9f84bde870d5ebfc1a903b3b',
  'js/firebase-config.js':'3f35ef06ddf9d128807312fbbf63622afe3ae46203cb92fabf7d9193c8a45f22',
  'js/firebase_db.js':'f17b2d24a0cb110b8d6ec95f00e49e6985d085e5add46caf9ebe87572f067e06',
  'js/hardware_lab_attempts.js':'1e36582624b3b37c2b33afb7f8c592c75ce35d22eae367d100600b2b7ee9b024',
  'js/admin_hwlab_tracking.js':'a1a4aa6e67a888a48c82a7072894f03fab68d3b7decaaeb3aeb467f388ee57f0'
 };
 for(const [p,sha] of Object.entries(baseline))assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),sha,p);
 const rules=fs.readFileSync(path.join(root,'v6/emulators/firestore.rules'),'utf8');assert.match(rules,/sena_portal_roles/);assert.match(rules,/sena_portal_hwlab_v6_checkpoints/);assert.doesNotMatch(rules,/v6_directory/);
});
for(const mode of ['deadline','dispose'])test('V6 cloud '+mode+' releases pending token and prevents late requests',async()=>{
 let resolveToken,fetches=0,error=false;const callbacks=new Map();let id=0;
 const token=new Promise(resolve=>resolveToken=resolve),location={hostname:'127.0.0.1',origin:'http://127.0.0.1:8796',href:'http://127.0.0.1:8796/laboratorio-virtual-hardware.html'};
 const window={HardwareLab:{FirebaseV6:{transport:()=>({endpoint:'/v6/checkpoints',token:()=>token})},SyncV6:{create:({transport})=>({prepare:async()=>{try{await transport.list('standard');}catch{error=true;}},enqueue(){},get due(){return Infinity;},close(){}})}},addEventListener(){},removeEventListener(){}};
 const box={window,location,URL,AbortController,fetch:async()=>{fetches++;return{ok:true,json:async()=>[]}},setTimeout:fn=>{callbacks.set(++id,fn);return id;},clearTimeout:key=>callbacks.delete(key),document:{createElement:()=>({setAttribute(){},dataset:{},remove(){}}),querySelector:()=>({after(){}})}};
 vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'js/hardware_lab_cloud_v6.js'),'utf8').replace('export function','function'),box);
 const store={context:{identity:{uid:'a'}},persist(){},flush(){},pendingFor:()=>[]};box.attachCloud(store,{},()=>({uid:'a'}));
 const pending=store.cloud.prepare();await Promise.resolve();assert.equal(fetches,0);
 if(mode==='dispose')store.cloud.dispose();else [...callbacks.values()][0]();
 await pending;assert.equal(error,true);resolveToken('late-token');await new Promise(r=>setImmediate(r));assert.equal(fetches,0);assert.equal(callbacks.size,0);
});
test('V6 admin reset revokes old grants before calling existing reset; failure prevents reset',async()=>{
 for(const success of [true,false]){
  const events=[],w=browser(config());w.portalFirebaseAuth={currentUid:()=> 'admin',getIdToken:async()=> 'admin-token'};
  w.fetch=async()=>{events.push('revoke');return{ok:success,json:async()=>({status:'revoked',usernameKey:'learner'})}};
  const auth={updateStudentPassword:async()=>{events.push('reset');return{ok:true}}};w.HardwareLab.FirebaseV6.installAdminResetGuard(auth);
  const result=await auth.updateStudentPassword('learner','Ficticia123');assert.equal(result.ok,success);assert.deepEqual(events,success?['revoke','reset']:['revoke']);
 }
});
test('V6 inactive capability leaves existing admin reset unchanged',async()=>{const w=browser({enabled:true,projectId:'sena-portal'});let calls=0;const auth={updateStudentPassword:async()=>{calls++;return{ok:true}}};w.HardwareLab.FirebaseV6.installAdminResetGuard(auth);assert.equal((await auth.updateStudentPassword('x','pass')).ok,true);assert.equal(calls,1);});

test('V6 Firebase adapter refuses mismatched portal/Auth/Firestore projects',async()=>{const {createFirebaseService}=require('../v6/server/firebase.cjs');await assert.rejects(createFirebaseService({config:{enabled:true,projectId:'demo-hwlab-v6'},auth:{app:{options:{projectId:'demo-other'}}},db:{projectId:'demo-hwlab-v6'}}),/FIREBASE_PROJECT_MISMATCH/);});
test('V6 existing panel withdraws grant before synchronous deactivation and stops on failure',async()=>{
 const source=fs.readFileSync(path.join(root,'js/admin_usuarios.js'),'utf8');const start=source.indexOf('  async function handleToggleLearner('),end=source.indexOf('  async function handleDeadlineSubmit(',start);assert.ok(start>=0&&end>start);
 for(const enabled of [false,true])for(const success of [false,true]){
  const calls=[],context={window:{PORTAL_FIREBASE_CONFIG:{hardwareLabV6:{enabled}},HardwareLab:{FirebaseV6:{revokeAccess:async()=>{calls.push('revoke');if(!success)throw Error('offline');}}},portalSaveStatus:{saving(){},error(){},saved(){}}},getUser:()=>({fullName:'Ficticio'}),confirmAdminAction:async()=>true,auth:{updateStudentStatus:()=>{calls.push('deactivate');return{ok:true}}},setFeedback(){},recordAdminAuditAction(){},loadUsers:async()=>{}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);await context.handleToggleLearner({dataset:{toggleLearner:'test',nextActive:'false'}});assert.deepEqual(calls,enabled?(success?['revoke','deactivate']:['revoke']):['deactivate']);
 }
});
