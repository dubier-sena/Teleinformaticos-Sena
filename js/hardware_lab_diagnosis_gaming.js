/* Gamer work orders: distinct targets, one common diagnosis engine. */
(function(root){
 'use strict';
 var H=root.HardwareLab,D=H.LaptopProfiles.get('gaming').equipment;
 function fault(partId,type,screen,symptom){return {fixCondition:partId?{type:type,partId:partId}:{type:'thermalReady'},screen:{broken:screen},symptomBroken:symptom};}
 var causes={
  cpu:()=>fault('fan-cpu','replaced','overheat','La carga de CPU produce limitación térmica; contrasta las dos lecturas de RPM.'),
  gpu:()=>fault('fan-gpu','replaced','overheat','La GPU eleva su temperatura bajo carga gráfica; compara FAN CPU y FAN GPU.'),
  rama:()=>fault('ram','replaced','no-post','La prueba de inicio se interrumpe. Los dos módulos se deben ensayar por separado.'),
  ramb:()=>fault('ram-b','reseated','no-post','Después de un traslado, el POST de memoria es intermitente.'),
  ssd:()=>fault('ssd-m2-b','reseated','storage-secondary','El sistema inicia desde M.2 #1, pero el volumen de datos M.2 #2 no aparece.'),
  wifi:()=>fault('wifi-card','replaced','wifi-fail','El sistema inicia y la red cableada funciona; la interfaz inalámbrica no se enumera.'),
  thermal:()=>fault(null,'thermalReady','overheat','Ambos ventiladores giran, pero la carga sostenida eleva CPU y GPU por encima de su rango didáctico.'),
  gpucable:()=>fault('cable-gpu-fan','reseated','overheat','El mantenimiento anterior dejó una lectura de RPM intermitente en FAN GPU.')
 };
 function order(n,name,context,keys,tools,evaluation){
  var faults=keys.map(k=>causes[k]()),maint=evaluation||keys.includes('thermal');
  var conditions=faults.map(f=>f.fixCondition),symptom=faults[0].symptomBroken;
  return {id:(evaluation?'eval-gaming-':'gaming-case-')+n,equipmentId:'laptop',profileId:'gaming',number:n,name:name,level:evaluation?'evaluacion':'avanzado',advanced:true,evaluation:!!evaluation,maintenanceRequired:maint,revealSymptomOnCheck:true,
   symptom:context+' '+symptom,hints:['Reproduce el síntoma con POWER y registra una hipótesis.','Compara los canales independientes; un fallo en FAN GPU no justifica cambiar FAN CPU.','Aísla la batería, intervén solo lo respaldado por evidencias y repite las pruebas al cerrar.'],
   fault:{overrides:[],faults:faults,fixCondition:{type:'all',conditions:conditions},thermal:maint?{dust:'dirty',paste:'old'}:{dust:'clean',paste:'new',amount:'adecuada'},thermalVariant:maint?'both':null,relevantPartIds:['bottom-cover','cable-battery','cooler','fan-cpu','fan-gpu','cable-cpu-fan-laptop','cable-gpu-fan'].concat(conditions.map(c=>c.partId).filter(Boolean)),screen:{fixed:'desktop'},symptomBroken:symptom,symptomFixed:'El gamer inicia, ambos canales responden y el comportamiento térmico queda verificado.',explanation:{whatWasHappening:context,why:'Cada canal de memoria, almacenamiento y ventilación tiene estado independiente.',howToFix:'Reparar la causa respaldada por las mediciones, completar el montaje y repetir las pruebas.'}},
   workflow:{context:context,symptom:symptom,objective:'Recuperar y comprobar este gamer con sus dos canales de refrigeración.',evidence:tools,validActions:conditions,maintenance:maint?['brush','air','scrape','alcohol','apply']:[],faultCount:faults.length,solution:conditions,verification:['Comparar ambos canales','Verificar CPU y GPU bajo carga','Cerrar y fijar todos los tornillos','POWER final']},
   explanation:{howToDiagnose:'Ensaya cada módulo por separado y compara sus resultados antes de reemplazar.',prevention:'Conservar ambos radiadores limpios y las dos interfaces térmicas correctamente mantenidas.'}};
 }
 var cases=[
  order(1,'FAN CPU sin respuesta','Una compilación prolongada pierde rendimiento.',['cpu'],['temperature']),
  order(2,'FAN GPU y carga gráfica','La carga gráfica limita su rendimiento mientras otras tareas son estables.',['gpu'],['temperature']),
  order(3,'Memoria: canal A','Un módulo produce discrepancias repetibles.',['rama'],['ram']),
  order(4,'Memoria después del traslado','Los dos SO-DIMM conservan su capacidad nominal, pero el inicio es intermitente.',['ramb'],['ram']),
  order(5,'Volumen secundario ausente','El sistema instalado en M.2 #1 inicia con normalidad.',['ssd'],['smart']),
  order(6,'Interfaz inalámbrica','La sesión remota funciona con cable, pero no con Wi-Fi.',['wifi'],['wifi']),
  order(7,'Dos chips, una interfaz térmica mantenida','El gamer lleva mucho tiempo sin mantenimiento.',['thermal'],['temperature']),
  order(8,'Dos síntomas después de servicio','Se observan fallos de inicio y pérdida de ventilación de GPU.',['ramb','gpucable'],['ram','temperature'])
 ];
 var evaluations=[
  order(1,'Servicio G1 · Memoria y refrigeración GPU','Estación de diseño que falla al iniciar y al cargar escenas.',['rama','gpu'],['ram','temperature'],true),
  order(2,'Servicio G2 · Datos y mantenimiento','El volumen de proyectos desaparece; se solicita mantenimiento integral.',['ssd'],['smart','temperature'],true),
  order(3,'Servicio G3 · Ventilación y red','Equipo de aula con ralentización y sin interfaz inalámbrica.',['cpu','wifi'],['temperature','wifi'],true),
  order(4,'Servicio G4 · Traslado y carga sostenida','Después del transporte, el inicio es irregular; se solicita renovar ambas interfaces térmicas.',['ramb'],['ram','temperature'],true)
 ];
 H.DiagnosisCases.registerProfileBank('gaming',{cases:cases,evaluations:evaluations});
 H.DiagnosisGaming={cases:cases,evaluations:evaluations};
})(typeof window!=='undefined'?window:globalThis);
