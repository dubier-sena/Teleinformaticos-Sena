/* Reuses the portal's Firebase session. No sign-in/sign-up and no direct grade writes. */
(function(root){
 'use strict';
 function describe(config){
  if(!config || config.enabled!==true || typeof config.projectId!=='string')throw Error('PORTAL_CONFIG');
  return {projectId:config.projectId,authBridge:'portalFirebaseAuth',identityIndex:'sena_portal_user_index',roles:'sena_portal_roles',officialGrades:'sena_portal_grades',legacyAttempts:'sena_portal_hwlab_attempts'};
 }
 function transport(owner){
  const config=root.PORTAL_FIREBASE_CONFIG,cap=config?.hardwareLabV6;
  if(!cap?.enabled)return null;
  describe(config);
  // Real activation remains unauthorized. An emulator override must replace
  // only the runtime config, never the checked-in portal configuration.
  if(cap.mode!=='emulator'||!/^demo-[a-z0-9-]+$/.test(config.projectId))throw Error('REAL_INTEGRATION_NOT_AUTHORIZED');
  const endpoint=new URL(cap.endpoint,root.location.href);
  if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||endpoint.origin!==root.location.origin||endpoint.pathname!=='/v6/checkpoints'||endpoint.search||endpoint.hash||endpoint.username||endpoint.password)throw Error('LOCAL_ENDPOINT_REQUIRED');
  const bridge=root.portalFirebaseAuth;
  if(!bridge?.getIdToken||!bridge?.currentUid)throw Error('PORTAL_AUTH_REQUIRED');
  return {endpoint:endpoint.href,async token(){
   const token=await bridge.getIdToken();
   if(!token||bridge.currentUid()!==owner.uid)throw Error('IDENTITY_CHANGED');
   return token;
  }};
 }
 async function revokeAccess(usernameKey){
  const bridge=root.portalFirebaseAuth,t=transport({uid:bridge?.currentUid()});
  if(!t)throw Error('V6_NOT_ACTIVE');
  const abort=new AbortController();let rejectDeadline;
  const deadline=new Promise((_,reject)=>{rejectDeadline=reject;});
  const timer=setTimeout(()=>{abort.abort();rejectDeadline(Error('V6_TIMEOUT'));},2500);
  try{return await Promise.race([deadline,(async()=>{
   const token=await t.token();if(abort.signal.aborted)throw Error('V6_TIMEOUT');
   const response=await root.fetch(t.endpoint.replace(/checkpoints$/, 'access/revoke'),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({usernameKey}),signal:abort.signal,redirect:'error',cache:'no-store'});
   if(!response.ok)throw Error('V6_REVOKE_REJECTED');const ack=await response.json();
   if(ack.status!=='revoked'||ack.usernameKey!==usernameKey)throw Error('V6_INVALID_ACK');return ack;
  })()]);}finally{clearTimeout(timer);}
 }
 function installAdminResetGuard(auth){
  if(!auth?.updateStudentPassword||auth.updateStudentPassword.v6Guard)return;
  const original=auth.updateStudentPassword;
  const guarded=async function(usernameKey,password){
   if(root.PORTAL_FIREBASE_CONFIG?.hardwareLabV6?.enabled){
    // Invalid passwords are left to the existing validator, with no revocation.
    if(String(password||'').trim().length>=6){
     try{await revokeAccess(String(usernameKey||'').trim().toLowerCase());}
     catch(_){return{ok:false,message:'No se pudo proteger el acceso del laboratorio. Reintenta el cambio de contraseña.'};}
    }
   }
   return original.call(this,usernameKey,password);
  };
  guarded.v6Guard=true;auth.updateStudentPassword=guarded;
 }
 root.HardwareLab=root.HardwareLab||{};
 root.HardwareLab.FirebaseV6={describe,transport,revokeAccess,installAdminResetGuard};
 installAdminResetGuard(root.portalAuth);
 if(typeof module!=='undefined'&&module.exports)module.exports=root.HardwareLab.FirebaseV6;
})(typeof window!=='undefined'?window:globalThis);
