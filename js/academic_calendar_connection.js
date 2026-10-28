(function(root){
 'use strict';
 // Enabled only by a reviewed deployment configuration, or the loopback emulator fixture.
 root.academicCalendarConnection=function(){
  const cfg=root.SENA_CALENDAR_FIRESTORE;
  if(!cfg?.enabled)throw Error('La integración Firestore está deshabilitada hasta su activación autorizada.');
  let auth;
  if(cfg.emulatorHost){
   if(!['127.0.0.1','localhost'].includes(location.hostname)||cfg.projectId!=='demo-sena-calendar'||cfg.emulatorHost!=='127.0.0.1:9180')throw Error('Configuración de emulador inválida.');
   const uid=cfg.demoUid||'demo-instructor',demoKey=cfg.demoKey||'';
   auth={getUid:async()=>uid,getUsernameKey:async()=>demoKey,isAdminHint:async()=>!!cfg.demoAdmin,getIdToken:async()=>{const now=Math.floor(Date.now()/1000),enc=x=>btoa(JSON.stringify(x)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');return enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/demo-sena-calendar',aud:'demo-sena-calendar',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,email:(demoKey||uid)+'@sena-portal.local',firebase:{sign_in_provider:'password',identities:{}}})+'.';}};
  }else{
   if(cfg.projectId!=='sena-portal'||!root.portalFirebaseAuth)throw Error('Se requiere la sesión Firebase existente del portal.');
   // Identidad: UID de Firebase Auth; perfil = usuario de la sesión del portal. El servidor (reglas)
   // vuelve a comprobar que el correo autenticado corresponde a ese perfil.
   const session=()=>root.portalAuth&&typeof root.portalAuth.getCurrentSession==='function'?root.portalAuth.getCurrentSession():null;
   auth={getUid:async()=>{await root.portalFirebaseAuth.waitForAuthHydration(4000);return root.portalFirebaseAuth.currentUid();},getIdToken:()=>root.portalFirebaseAuth.getIdToken(),
    getUsernameKey:async()=>{const s=session();return (s&&(s.usernameKey||(s.user&&s.user.usernameKey)))||'';},
    isAdminHint:async()=>!!(root.portalAuth&&typeof root.portalAuth.isAdminSession==='function'&&root.portalAuth.isAdminSession())};
  }
  return root.academicCalendarCloud.create({...cfg,auth});
 };
})(window);
