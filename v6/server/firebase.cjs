'use strict';
// Adapter for the existing SENA portal. No alternative authentication or grades.
const crypto = require('node:crypto');
const {createService} = require('./service.cjs');
const COLLECTIONS = Object.freeze({heads:'sena_portal_hwlab_v6_checkpoints',completions:'sena_portal_hwlab_v6_completions',receipts:'sena_portal_hwlab_v6_receipts',conflicts:'sena_portal_hwlab_v6_conflicts'});
const clone = value => JSON.parse(JSON.stringify(value));
function requireCondition(ok, code) { if (!ok) throw new Error(code); }
function portalConfig(config) {
 requireCondition(config?.enabled === true && /^[a-z][a-z0-9-]{4,62}$/.test(config.projectId), 'PORTAL_CONFIG');
 return {projectId:config.projectId, roles:'sena_portal_roles', users:'sena_portal_users', index:'sena_portal_user_index', ...COLLECTIONS};
}
// Query only this owner or an authorized ficha. A per-owner guard serializes
// concurrent inserts, including the case where all collections are empty.
class FirestoreRepository {
 constructor(db) { this.db = db; }
 async transaction(fn, scope) {
  requireCondition(!!scope && (!!scope.uid !== !!scope.ficha), 'REPOSITORY_SCOPE');
  const field = scope.uid ? 'uid' : 'ficha', value = scope[field];
  return this.db.runTransaction(async tx => {
   let guard, generation = 0;
   if (scope.uid) {
    guard = this.db.collection('sena_portal_hwlab_v6_locks').doc(crypto.createHash('sha256').update(scope.uid).digest('hex'));
    generation = (await tx.get(guard)).data()?.generation || 0;
   }
   const state = {heads:{},completions:{},receipts:{},conflicts:{}};
   for (const [kind, collection] of Object.entries(COLLECTIONS)) {
    if (scope.ficha && kind === 'receipts') continue;
    const snapshots = await tx.get(this.db.collection(collection).where(field,'==',value).limit(2049));
    requireCondition(snapshots.size <= 2048, 'CAPACITY');
    snapshots.forEach(doc => { state[kind][doc.id] = doc.data(); });
   }
   const before = clone(state), result = fn(state);
   if (result.write) {
    requireCondition(!!scope.uid, 'READ_ONLY_TRACKING');
    let writes = 0;
    for (const [kind, collection] of Object.entries(COLLECTIONS)) {
     for (const [id, doc] of Object.entries(state[kind])) {
      if (JSON.stringify(before[kind][id]) === JSON.stringify(doc)) continue;
      requireCondition(doc.uid === scope.uid, 'WRITE_OWNER');
      // Firestore documents have a 1 MiB limit. Leave room for field overhead.
      requireCondition(Buffer.byteLength(JSON.stringify(doc)) <= 900 * 1024, 'DOCUMENT_SIZE');
      requireCondition(++writes <= 20, 'TRANSACTION_SIZE');
      tx.set(this.db.collection(collection).doc(id), doc);
     }
    }
    if (writes) tx.set(guard, {uid:scope.uid,generation:generation+1});
   }
   return clone(result.value);
  }, {maxAttempts:5});
 }
}
function portalDirectory(db) {
 return async auth => {
  const role = (await db.collection('sena_portal_roles').doc(auth.uid).get()).data();
  const grant = role?.hwlabV6;
  if (!grant || grant.enabled !== true || role.enabled === false) return null;
  if (role.role === 'admin') {
   if (!Array.isArray(grant.fichas) || !grant.fichas.length || !grant.fichas.every(f=>typeof f==='string' && f.length>0)) return null;
   return {enabled:true,role:'instructor',user:auth.uid,fichas:grant.fichas};
  }
  if (role.role !== 'student' || typeof grant.usernameKey !== 'string' || typeof grant.ficha !== 'string' || !grant.ficha) return null;
  const key = grant.usernameKey;
  if (!/^[a-z0-9_.-]+$/.test(key)) return null;
  const [userDoc,indexDoc,metaDoc] = await Promise.all([
   db.collection('sena_portal_users').doc(key).get(),
   db.collection('sena_portal_user_index').doc(auth.uid).get(),
   db.collection('sena_portal_user_meta').doc(key).get()
  ]);
  const user=userDoc.data(), index=indexDoc.data(), version=Number(grant.authEmailVersion || 1);
  if (!Number.isSafeInteger(version) || version<1 || Number(metaDoc.data()?.authEmailVersion || 1)!==version) return null;
  const email=key+(version>1?'.v'+version:'')+'@sena-portal.local';
  if (auth.email!==email || user?.uid!==auth.uid || user.usernameKey!==key || user.ficha!==grant.ficha || index?.ficha!==grant.ficha || user.enabled===false || user.active===false || String(user.status||'').toLowerCase()==='inactive') return null;
  return {enabled:true,role:'student',user:key,ficha:grant.ficha};
 };
}
async function createFirebaseService({config,auth,db}) {
 portalConfig(config);
 requireCondition(auth?.app?.options?.projectId===config.projectId && db?.projectId===config.projectId, 'FIREBASE_PROJECT_MISMATCH');
 const directory=portalDirectory(db);
 const service=await createService({repository:new FirestoreRepository(db),verifyToken:token=>auth.verifyIdToken(token,true),directory});
 service.revokeAccess=async(token,body)=>{
  requireCondition(body && Object.keys(body).join(',')==='usernameKey' && /^[a-z0-9_.-]+$/.test(body.usernameKey),'REVOKE_REQUEST');
  const caller=await directory(await auth.verifyIdToken(token,true));
  requireCondition(caller?.enabled && caller.role==='instructor','FORBIDDEN');
  return db.runTransaction(async tx=>{
   const grants=await tx.get(db.collection('sena_portal_roles').where('hwlabV6.usernameKey','==',body.usernameKey).limit(401));
   requireCondition(grants.size<=400,'CAPACITY');
   for(const doc of grants.docs)requireCondition(caller.fichas.includes(doc.data().hwlabV6.ficha),'FORBIDDEN');
   for(const doc of grants.docs)tx.update(doc.ref,{'hwlabV6.enabled':false});
   return {status:'revoked',usernameKey:body.usernameKey,revoked:grants.size};
  });
 };
 return service;
}
// Only local startup is shipped/authorized now. Production initialization will
// use the same adapter and portal config in the authorized server deployment.
function emulatorOptions({projectId,authHost,firestoreHost}) {
 requireCondition(/^demo-[a-z0-9-]+$/.test(projectId), 'DEMO_PROJECT_REQUIRED');
 for (const host of [authHost,firestoreHost]) requireCondition(/^127\.0\.0\.1:([1-9][0-9]{3,4})$/.test(host) && Number(host.split(':')[1])<=65535, 'LOOPBACK_REQUIRED');
 return {projectId,authHost,firestoreHost};
}
function initializeEmulators(options) {
 const o=emulatorOptions(options);
 // Must precede Admin initialization; no ADC or real credential fallback.
 process.env.FIREBASE_AUTH_EMULATOR_HOST=o.authHost;
 process.env.FIRESTORE_EMULATOR_HOST=o.firestoreHost;
 const {initializeApp,cert}=require('firebase-admin/app');
 const {getAuth}=require('firebase-admin/auth');
 const {getFirestore}=require('firebase-admin/firestore');
 // A disposable local-only key satisfies Admin's credential type check. Both
 // SDKs use emulator owner auth; never consult ADC or the user's credentials.
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 const app=initializeApp({projectId:o.projectId,credential:cert({projectId:o.projectId,clientEmail:'emulator@'+o.projectId+'.iam.gserviceaccount.com',privateKey})},'hwlab-v6-'+crypto.randomUUID());
 return {app,auth:getAuth(app),db:getFirestore(app),config:{enabled:true,projectId:o.projectId}};
}
module.exports={COLLECTIONS,FirestoreRepository,portalDirectory,portalConfig,emulatorOptions,initializeEmulators,createFirebaseService};
