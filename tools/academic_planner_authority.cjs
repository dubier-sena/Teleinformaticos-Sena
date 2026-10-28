'use strict';
/* Isolated backend contract. Not wired to Firebase, not a replacement for deployed rules.
   readPrincipal must resolve attested assignments outside the client payload.
   transaction must serialize compare-and-swap across instances in a real backend. */
const Store=require('../js/academic_planner_store.js'),I=require('../js/academic_planner_integration.js');
module.exports=function({readPrincipal,transaction,read}){
 async function principal(token){const p=await readPrincipal(token);if(!p?.uid||!['instructor','aprendiz'].includes(p.role)||!Array.isArray(p.fichas))throw new Error('Identidad o asignación de servidor inválida.');return p;}
 return {
  async query(token,year){const p=await principal(token),snapshot=await read();if(p.role==='aprendiz'){if(p.fichas.length!==1)throw new Error('Ficha aprendiz ambigua.');return I.student(snapshot,{role:'aprendiz',ficha:p.fichas[0]},year);}return {schemaVersion:snapshot.schemaVersion,revision:snapshot.revision,sessions:snapshot.sessions.filter(s=>s.year===year&&p.fichas.includes(s.ficha)),years:{[year]:{...snapshot.years[year],fichas:(snapshot.years[year]?.fichas||[]).filter(f=>p.fichas.includes(f.id))}},deadlines:(snapshot.deadlines||[]).filter(d=>d.year===year&&p.fichas.includes(d.ficha)),administrative:(snapshot.administrative||[]).filter(e=>e.year===year&&e.fichas.every(f=>p.fichas.includes(f))),history:[],identityHistory:[],recoveries:(snapshot.recoveries||[]).filter(r=>snapshot.sessions.some(s=>s.id===r.originalId&&p.fichas.includes(s.ficha)))};},
  async save(token,next,expectedRevision,reason){const p=await principal(token);if(p.role!=='instructor')throw new Error('Aprendiz solo consulta.');return transaction(async current=>{if(JSON.stringify(next.years)!==JSON.stringify(current.years))throw new Error('La configuración institucional requiere un contrato de autoridad separado.');for(const s of next.sessions){if(!current.sessions.some(old=>old.id===s.id)&&s.instructorId!==p.uid)throw new Error('Instructor de sesión no coincide con identidad atestada.');}let result;const storage={getItem:()=>JSON.stringify(current),setItem:(key,value)=>{result=JSON.parse(value);}};Store.save(storage,next,expectedRevision,{id:p.uid,role:p.role,fichas:p.fichas},reason,true);return result;});}
 };
};
