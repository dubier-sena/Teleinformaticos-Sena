'use strict';
// Isolated contract gateway. No Firebase SDK, credentials or production endpoint.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const clone=v=>JSON.parse(JSON.stringify(v));
function reject(code){const e=new Error(code);e.code=code;throw e;}
function need(ok,code){if(!ok)reject(code);}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
class FileRepository {
 constructor(file){this.file=file;fs.mkdirSync(path.dirname(file),{recursive:true});}
 transaction(fn){
  // Atomic replacement under an exclusive lock, including across gateway processes.
  const lock=this.file+'.lock';let acquired=false;
  try{fs.mkdirSync(lock);acquired=true;const state=fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{heads:{},completions:{},receipts:{},conflicts:{}};
   const result=fn(state);if(result.write){const raw=JSON.stringify(state);need(Buffer.byteLength(raw)<=24*1024*1024,'CAPACITY');
    const tmp=this.file+'.tmp-'+crypto.randomUUID(),fd=fs.openSync(tmp,'wx',0o600);
    try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,this.file);const dir=fs.openSync(path.dirname(this.file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
   }return clone(result.value);
  }finally{if(acquired)fs.rmdirSync(lock);}
 }
}
async function createService({repository,verifyToken,directory,now=()=>new Date().toISOString()}){
 const ROOT=path.resolve(__dirname,'../..'),box={window:{},console};vm.createContext(box);
 for(const name of ['tools','data_laptop','data_desktop','laptop_profiles','engine','thermal','diagnostics_v3','diagnosis_engine','diagnosis_cases','diagnosis_gaming','checkpoints_v5'])vm.runInContext(fs.readFileSync(path.join(ROOT,'js/hardware_lab_'+name+'.js'),'utf8'),box);
 const C=box.window.HardwareLab.CheckpointsV5,{createProfileLayout}=await import(pathToFileURL(path.join(ROOT,'js/hardware_lab_3d_laptop_profiles.js')));
 const layouts={standard:createProfileLayout('standard'),gaming:createProfileLayout('gaming')};
 const stats={reads:0,writes:0,duplicates:0,conflicts:0};
 async function principal(token){const auth=await verifyToken(token);const p=auth&&(typeof directory==='function'?await directory(auth):directory[auth.uid]);need(p&&p.enabled===true,'UNAUTHENTICATED');return {...clone(p),uid:auth.uid};}
 function context(p,profile){need(Object.hasOwn(layouts,profile),'PROFILE');return C.createLocalStore({profile,identity:{kind:'student',user:p.user,uid:p.uid},screws:layouts[profile].screws,storage:{getItem:()=>null}}).context;}
 function validate(p,envelope){
  need(p.role==='student','FORBIDDEN');need(envelope&&['catalogVersion,checkpoint,expectedServerRevision,schemaVersion','archive,catalogVersion,checkpoint,expectedServerRevision,schemaVersion'].includes(Object.keys(envelope).sort().join(',')),'ENVELOPE');
  need(!Object.hasOwn(envelope,'archive')||envelope.archive===true,'ENVELOPE');
  need(envelope.schemaVersion===6&&envelope.catalogVersion===1,'VERSION');need(Number.isSafeInteger(envelope.expectedServerRevision)&&envelope.expectedServerRevision>=0,'REVISION');
  need(Buffer.byteLength(JSON.stringify(envelope))<=700*1024,'SIZE');const r=envelope.checkpoint;need(r&&typeof r.practice==='string'&&r.practice.length<=180,'PRACTICE');
  // Camera is neither restored nor accepted at the trust boundary.
  need(Object.keys(r).sort().join(',')==='attemptId,checksum,completion,createdAt,equipment,inventory,owner,practice,practiceVersion,profile,revision,schemaVersion,session,status,updatedAt','CHECKPOINT_FIELDS');
  const c=context(p,r.profile),v=C.validateCheckpoint(r,c,r.practice);need(v.ok,'INVALID_CHECKPOINT');need(!envelope.archive||r.status==='complete','ARCHIVE_REQUIRES_COMPLETION');
  need(C.canonical(v.session)===C.canonical(r.session),'RESULT_MISMATCH');
  // Client result is at most a coherent proposal; it is never an official grade.
  return clone(r);
 }
 async function send(token,envelope){
  const p=await principal(token),r=validate(p,envelope),key=hash([p.uid,r.profile,r.practice]),eventKey=hash([p.uid,r.attemptId]);
  const canonical=C.canonical(r),receiptKey=hash([key,canonical,envelope.archive?'archive':'head']);
  return repository.transaction(s=>{
   if(s.receipts[receiptKey]){stats.duplicates++;return{write:false,value:s.receipts[receiptKey]};}
   need(Object.keys(s.receipts).length<2048,'CAPACITY');
   const head=s.heads[key],revision=head?.serverRevision||0,closed=s.completions[eventKey];
   if(closed)need(C.canonical(closed.checkpoint)===canonical,'COMPLETED_IMMUTABLE');
   if(envelope.archive){
    const receivedAt=now();s.completions[eventKey]=closed||{uid:p.uid,ficha:p.ficha,profile:r.profile,practice:r.practice,serverRevision:revision,receivedAt,checkpoint:r};
    const ack={status:'ack',uid:p.uid,profile:r.profile,practice:r.practice,attemptId:r.attemptId,revision:r.revision,serverRevision:revision,canonical,receivedAt,advancesHead:false};s.receipts[receiptKey]=ack;stats.writes++;return{write:true,value:ack};
   }
   if(envelope.expectedServerRevision!==revision){
    const conflictKey=hash([receiptKey,envelope.expectedServerRevision]);need(Object.keys(s.conflicts).length<256||s.conflicts[conflictKey],'CAPACITY');
    s.conflicts[conflictKey]={uid:p.uid,ficha:p.ficha,profile:r.profile,practice:r.practice,local:r,remote:head||null,at:now()};stats.conflicts++;
    return{write:true,value:{status:'conflict',local:r,remote:head||null}};
   }
   if(head?.checkpoint.attemptId===r.attemptId)need(r.revision>head.checkpoint.revision,'STALE_REVISION');
   const saved={uid:p.uid,ficha:p.ficha,profile:r.profile,practice:r.practice,serverRevision:revision+1,receivedAt:now(),checkpoint:r};
   s.heads[key]=saved;if(r.status==='complete')s.completions[eventKey]=saved;
   const ack={status:'ack',uid:p.uid,profile:r.profile,practice:r.practice,attemptId:r.attemptId,revision:r.revision,serverRevision:saved.serverRevision,canonical,receivedAt:saved.receivedAt,advancesHead:true};
   s.receipts[receiptKey]=ack;stats.writes++;return{write:true,value:ack};
  },{uid:p.uid});
 }
 async function list(token,profile){const p=await principal(token);need(p.role==='student','FORBIDDEN');context(p,profile);stats.reads++;
  return repository.transaction(s=>({write:false,value:Object.values(s.heads).filter(h=>h.uid===p.uid&&h.profile===profile).map(h=>({...h,ack:s.receipts[hash([hash([p.uid,h.profile,h.practice]),C.canonical(h.checkpoint),'head'])]}))}),{uid:p.uid});
 }
 async function tracking(token,ficha){const p=await principal(token);need(p.role==='instructor'&&p.fichas?.includes(ficha),'FORBIDDEN');stats.reads++;
  return repository.transaction(s=>({write:false,value:{ficha,heads:Object.values(s.heads).filter(h=>h.ficha===ficha),completions:Object.values(s.completions).filter(h=>h.ficha===ficha),conflicts:Object.values(s.conflicts).filter(h=>h.ficha===ficha),officialGrades:[],academicWritesEnabled:false}}),{ficha});
 }
 return{send,list,tracking,stats};
}
module.exports={createService,FileRepository};
