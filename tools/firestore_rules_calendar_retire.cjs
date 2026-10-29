'use strict';
// 2026-10-29 · Reglas candidatas: «Quitar del calendario» como RETIRO LÓGICO validado por el servidor.
// Transformación pura e idempotente de las reglas activas (config/firestore.deployed-c445f954.rules). Solo toca el
// bloque del calendario por ficha; nunca habilita borrar sesiones (delete sigue en false), y cada cambio exige su
// recibo de auditoría como hasta ahora.
//  - 'Retirada' es un estado válido.
//  - Retirar: solo desde una clase no protegida ni impartida, misma fecha, y liberando su día en el mismo commit.
//  - Restaurar: de 'Retirada' solo a 'Programada', reocupando el día (calDay). Mientras está retirada no se edita.
//  - El día solo se crea para una sesión no retirada, y solo se borra si la sesión cambia de fecha o se retira.
// Uso: node tools/firestore_rules_calendar_retire.cjs [entrada] [salida]
const fs=require('node:fs'),path=require('node:path');
const D='/databases/$(database)/documents/sena_portal_calendar_fichas/$(ficha)/years/$(year)';
const EDITS=[
 ["'Recuperada','Sin programación','Estados mixtos — revisar']\n        && calPublic(d)",
  "'Recuperada','Sin programación','Estados mixtos — revisar','Retirada']\n        && calPublic(d)"],
 ["      allow create: if calEditor(ficha) && request.resource.data.keys().hasOnly(['sessionId'])\n        && getAfter("+D+"/sessions/$(request.resource.data.sessionId)).data.date == date;",
  "      allow create: if calEditor(ficha) && request.resource.data.keys().hasOnly(['sessionId'])\n        && getAfter("+D+"/sessions/$(request.resource.data.sessionId)).data.date == date\n        && getAfter("+D+"/sessions/$(request.resource.data.sessionId)).data.status != 'Retirada';"],
 ["        && getAfter("+D+"/sessions/$(resource.data.sessionId)).data.date != date;",
  "        && (getAfter("+D+"/sessions/$(resource.data.sessionId)).data.date != date\n          || getAfter("+D+"/sessions/$(resource.data.sessionId)).data.status == 'Retirada');"],
 ["            && request.resource.data.status in ['Programada','Realizada','Suspendida','Parcial','Reprogramada']))\n        && request.resource.data.revision == resource.data.revision + 1\n        && request.resource.data.mutationId != resource.data.mutationId\n        && calDay(ficha,year,id,request.resource.data)",
  "            && request.resource.data.status in ['Programada','Realizada','Suspendida','Parcial','Reprogramada','Retirada']))\n"
  +"        // 2026-10-29: retiro lógico. Una retirada solo vuelve a Programada; retirar no cambia la fecha y libera el día.\n"
  +"        && (resource.data.status != 'Retirada' || request.resource.data.status == 'Programada')\n"
  +"        && (request.resource.data.status != 'Retirada' || resource.data.status == 'Retirada' || request.resource.data.date == resource.data.date)\n"
  +"        && request.resource.data.revision == resource.data.revision + 1\n        && request.resource.data.mutationId != resource.data.mutationId\n"
  +"        && ((request.resource.data.status == 'Retirada' && !existsAfter("+D+"/days/$(resource.data.date)))\n"
  +"          || (request.resource.data.status != 'Retirada' && calDay(ficha,year,id,request.resource.data)))"],
];
function transform(src){
 if(src.includes("'Reprogramada','Retirada']"))return src;
 let out=src;
 for(const [a,b] of EDITS){const n=out.split(a).length-1;if(n!==1)throw Error('Ancla no encontrada exactamente una vez ('+n+'): '+a.slice(0,80));out=out.replace(a,()=>b);}
 return out;
}
module.exports={transform,EDITS};
if(require.main===module){const root=path.join(__dirname,'..'),input=process.argv[2]||path.join(root,'config/firestore.deployed-c445f954.rules'),output=process.argv[3]||path.join(root,'config/firestore.calendar-retire.rules');
 const out=transform(fs.readFileSync(input,'utf8'));fs.writeFileSync(output,out);console.log(output,require('node:crypto').createHash('sha256').update(out).digest('hex'));}
