/* Separate proposal view: never mutates the legacy instructor gradebook. */
(function(root){
 'use strict';
 function project(payload){
  const rows=new Map();
  const key=h=>JSON.stringify([h.uid,h.profile,h.practice]);
  function row(h){if(!rows.has(key(h)))rows.set(key(h),{uid:h.uid,ficha:h.ficha,profile:h.profile,practice:h.practice,active:0,completed:0,conflicts:0,bestProposedScore:null,lastProposedScore:null,updatedAt:null,officialGrade:null});return rows.get(key(h));}
  for(const h of payload.heads||[]){const r=row(h);r.active=h.checkpoint.status==='active'?1:0;r.updatedAt=h.receivedAt;}
  const completions=[...(payload.completions||[])].sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt));
  for(const h of completions){const r=row(h);r.completed++;const score=h.checkpoint.session.result?.score;if(Number.isFinite(score)){r.lastProposedScore=score;r.bestProposedScore=Math.max(r.bestProposedScore??score,score);}}
  for(const c of payload.conflicts||[])row(c).conflicts++;
  return [...rows.values()];
 }
 root.HardwareLab=root.HardwareLab||{};root.HardwareLab.TrackingV6={project};
 if(typeof module!=='undefined'&&module.exports)module.exports={project};
})(typeof window!=='undefined'?window:globalThis);
