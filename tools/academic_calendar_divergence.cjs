'use strict';
// Diferencias entre el calendario ANTERIOR (documento global + clases manuales de la Agenda) y las sesiones
// por ficha ya importadas. Solo lectura de archivos locales: no toca Firebase ni migra nada. Rehace la
// preparación de la importación con el estado ACTUAL del anterior y la compara con el paquete importado:
// cualquier diferencia es un cambio hecho en el anterior que el aprendiz no ve.
// Uso: node tools/academic_calendar_divergence.cjs --paquete=<json> --legado=<doc REST> [--manuales=<doc REST>]
const fs=require('node:fs'),path=require('node:path');
const C=require('../js/academic_calendar_cloud.js'),Release=require('./academic_calendar_release.cjs'),Import=require('./academic_calendar_import.cjs');
const MAPPING={'I.E. Jhon F. Kennedy|10A':'3441939','I.E. Jhon F. Kennedy|10B':'3441942','I.E. Santa Bárbara|10A':'3441944','I.E. Santa Bárbara|10B':'3441950','I.E. Santa Bárbara|11A':'3168850','I.E. Santa Bárbara|11B':'3168852'};
const SESSION=/\/sessions\/[^/]+$/;
const view=s=>({date:s.date,status:s.status,blocks:s.blocks,sourceStatuses:(s.sourceStatuses||[]).map(x=>({sourceId:x.sourceId,state:x.state}))});
function sessionsOf(documents){return new Map(documents.filter(d=>SESSION.test(d.path)).map(d=>[d.path,d.data]));}
function minutes(t){const [h,m]=String(t).split(':').map(Number);return h*60+m;}
function compare({imported,current,manual=[]}){
 const a=sessionsOf(imported.documents),b=sessionsOf(current.documents),out=[];
 for(const [p,s] of b){const before=a.get(p);
  if(!before)out.push({tipo:'sesion-nueva-en-anterior',ficha:s.ficha,fecha:s.date,ahora:view(s)});
  else if(!Import.equal(view(before),view(s)))out.push({tipo:'sesion-cambiada-en-anterior',ficha:s.ficha,fecha:s.date,importada:view(before),ahora:view(s)});}
 for(const [p,s] of a)if(!b.has(p))out.push({tipo:'sesion-ausente-en-anterior',ficha:s.ficha,fecha:s.date,importada:view(s)});
 // Clases creadas a mano en la Agenda: ¿existe una sesión de esa ficha y fecha que cubra su franja?
 for(const ev of manual.filter(e=>e&&e.type==='CLASE'&&e.status!=='cancelled')){
  const s=[...a.values()].find(x=>x.ficha===String(ev.ficha)&&x.date===ev.date);
  const slots=(ev.slots&&ev.slots.length?ev.slots:[{startAt:ev.startAt,endAt:ev.endAt}]).map(x=>({start:String(x.startAt).slice(11,16),end:String(x.endAt).slice(11,16)}));
  const covered=!!s&&slots.every(t=>s.blocks.some(bk=>minutes(bk.start)<=minutes(t.start)&&minutes(bk.end)>=minutes(t.end)));
  if(!covered)out.push({tipo:'clase-manual-sin-sesion',ficha:String(ev.ficha),fecha:ev.date,franjas:slots,sesionDelDia:s?view(s):null,id:ev.id});
 }
 const mixed=[...a.values()].filter(s=>String(s.status).includes('revisar')).map(s=>({tipo:'sesion-con-estados-mixtos',ficha:s.ficha,fecha:s.date,importada:view(s)}));
 return [...out,...mixed].sort((x,y)=>(x.fecha+x.ficha).localeCompare(y.fecha+y.ficha));
}
function prepareFromLegacy({legacyDoc,imported,records}){
 const snapshot=C.document(legacyDoc).data;
 return Release.prepare({records,snapshot,mapping:MAPPING,year:2026,readTime:imported.source.readTime,adminUid:imported.requiredAdminUid},require('../data/academic_planner_catalog.js'));
}
module.exports={compare,prepareFromLegacy,MAPPING};
if(require.main===module){
 const arg=k=>(process.argv.find(a=>a.startsWith('--'+k+'='))||'').split('=').slice(1).join('=');
 const imported=JSON.parse(fs.readFileSync(arg('paquete'),'utf8'));
 const legacyDoc=JSON.parse(fs.readFileSync(arg('legado'),'utf8'));
 const manualDoc=arg('manuales')?JSON.parse(fs.readFileSync(arg('manuales'),'utf8')):null;
 global.window={};require(path.join(__dirname,'..','data','calendario_2026_records.js'));
 const current=prepareFromLegacy({legacyDoc,imported,records:global.window.CALENDAR_2026_RECORDS});
 const manual=manualDoc?(C.document(manualDoc).data.events||[]):[];
 const diffs=compare({imported,current,manual});
 console.log(JSON.stringify({legadoActualizado:legacyDoc.updateTime,diferencias:diffs.length,detalle:diffs},null,1));
}
