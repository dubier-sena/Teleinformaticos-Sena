'use strict';
// Explicit, offline snapshot for the loopback preview. Does not read browser storage or cloud.
const fs=require('node:fs'),path=require('node:path');
function load(file){
 const docs=JSON.parse(fs.readFileSync(file,'utf8'));
 const doc=docs.find(d=>d.name==='projects/sena-portal/databases/(default)/documents/sena_portal_calendar/calendario_2026_admin');
 const manifest=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'manifest.json'),'utf8'));
 if(!doc?.value?.state||!manifest.exportScopeComplete||!/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(manifest.readTime))throw Error('Invalid calendar snapshot.');
 const state=doc.value.state;
 if(!Object.keys(state).length||Object.values(state).some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error('Invalid calendar states.');
 const meta={source:'Firestore',readTime:manifest.readTime,updatedAt:doc.value.updatedAt??null,records:Object.keys(state).length,
  impartida:Object.values(state).filter(v=>v.estado==='Impartida').length};
 return {meta,script:'window.CALENDAR_2026_INITIAL_STATE = '+JSON.stringify(state)+';\nwindow.CALENDAR_2026_SNAPSHOT = '+JSON.stringify(meta)+';\n'};
}
module.exports={load};
