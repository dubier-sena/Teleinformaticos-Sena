/* Model data only. Profiles share the assembly/diagnosis engines. */
(function(root){
  'use strict';
  var H=root.HardwareLab, standard=H.DataLaptop.LAPTOP_EQUIPMENT;
  var copy=function(value){return JSON.parse(JSON.stringify(value));};
  var gaming=copy(standard);
  gaming.profileId='gaming';gaming.name='Portátil gamer · doble refrigeración';gaming.sessionAddedParts=[];
  delete gaming.parts.cpu;
  function rename(id,name,description){var p=gaming.parts[id];p.name=name;p.info.function=description;p.info.compatibility='Perfil gamer genérico del laboratorio; no representa una marca o modelo comercial.';}
  function duplicate(source,id,name){gaming.parts[id]=copy(gaming.parts[source]);gaming.parts[id].id=id;rename(id,name,'Canal independiente: se diagnostica y manipula por separado.');}
  rename('ram','RAM A · SO-DIMM','Primer canal de memoria extraíble del gamer.');duplicate('ram','ram-b','RAM B · SO-DIMM');
  rename('ssd-m2','M.2 #1 · sistema','Unidad NVMe principal, usada para el arranque.');duplicate('ssd-m2','ssd-m2-b','M.2 #2 · datos');
  rename('cooler','Sistema térmico CPU + GPU','Dos placas de contacto y heatpipes compartidos llevan calor a dos radiadores. La CPU y la GPU están soldadas a la motherboard.');
  gaming.parts.cooler.info.characteristics='Sistema de doble contacto. Ambos ventiladores se retiran antes de levantar el conjunto térmico.';
  gaming.parts.cooler.removeRequires=['cable-battery','fan-cpu','fan-gpu'];gaming.parts.cooler.installRequires=['motherboard'];
  gaming.parts.cooler.removeInstructions=['Aísla la batería y desconecta ambos ventiladores.','Retira FAN CPU y FAN GPU, libera los tornillos del sistema térmico y levántalo de manera uniforme.'];
  gaming.parts.cooler.installInstructions=['Limpia ambas superficies CPU/GPU y renueva la interfaz térmica en cantidad adecuada.','Asienta el sistema térmico y aprieta sus tornillos de manera gradual y cruzada.'];
  for(var side of ['cpu','gpu']){
    var id='fan-'+side,p=copy(standard.parts.cooler);p.id=id;p.name='FAN '+side.toUpperCase();p.removeRequires=['cable-battery',side==='cpu'?'cable-cpu-fan-laptop':'cable-gpu-fan'];p.installRequires=['motherboard','cooler'];
    p.info={function:'Impulsa aire hacia el radiador '+side.toUpperCase()+'. Motor y conector independientes.',characteristics:'Ventilador centrífugo extraíble, con lectura didáctica de RPM.',location:'Extremo trasero '+(side==='cpu'?'izquierdo':'derecho')+'.',connectionType:'Conector de alimentación/señal y dos tornillos.',precautions:'Desconecta su cable antes de retirarlo; bloquea las aspas para limpiar.',compatibility:'Solo este perfil gamer.',commonErrors:'Confundir FAN CPU con FAN GPU o dejar su cable suelto.'};
    p.removeInstructions=['Aísla la batería y desconecta el cable de este ventilador.','Retira sus dos tornillos y levanta la carcasa por sus bordes.'];p.installInstructions=['Asienta el ventilador junto a su radiador.','Fija ambos tornillos y conecta el cable correspondiente.'];gaming.parts[id]=p;
  }
  rename('cable-cpu-fan-laptop','Conector FAN CPU','Alimentación y señal del ventilador CPU.');
  gaming.parts['cable-cpu-fan-laptop'].installRequires=['motherboard','fan-cpu'];
  duplicate('cable-cpu-fan-laptop','cable-gpu-fan','Conector FAN GPU');gaming.parts['cable-gpu-fan'].installRequires=['motherboard','fan-gpu'];
  rename('motherboard','Motherboard gamer · CPU y GPU soldadas','Placa propia con CPU y GPU dedicada BGA integradas, dos slots SO-DIMM y dos M.2. Los chips no son módulos reemplazables.');
  gaming.parts.motherboard.info.characteristics='CPU y GPU permanecen unidas a la placa durante el desmontaje. Una avería del silicio exige servicio especializado.';
  Object.values(gaming.parts).forEach(function(p){for(var k of ['removeRequires','installRequires'])p[k]=(p[k]||[]).filter(function(id){return id!=='cpu';});});
  var order=['bottom-cover','cable-battery','battery','cable-speaker-left','speaker-left','cable-speaker-right','speaker-right','cable-cpu-fan-laptop','cable-gpu-fan','fan-cpu','fan-gpu','cooler','ram-b','ram','ssd-m2-b','ssd-m2','wifi-antenna-1','wifi-antenna-2','wifi-card','cable-screen-flex','screen-assembly','cable-keyboard-flex','keyboard','cable-touchpad-flex','touchpad','motherboard'];
  gaming.parts.motherboard.removeRequires=order.filter(function(id){return id!=='motherboard'&&id!=='bottom-cover';});
  function action(id,install){return {kind:'action',partId:id,action:gaming.parts[id].kind==='cable'?(install?'connect':'disconnect'):(install?'install':'remove')};}
  var safety=standard.sequences.disassembly.filter(function(s){return s.kind==='safety';});
  var verify=standard.sequences.assembly.filter(function(s){return s.kind!=='safety'&&s.kind!=='action';});
  gaming.sequences={disassembly:safety.concat(order.map(function(id){return action(id,false);})),assembly:safety.concat(order.slice().reverse().map(function(id){return action(id,true);}),verify)};
  var maintenance=['bottom-cover','cable-battery','cable-cpu-fan-laptop','cable-gpu-fan','fan-cpu','fan-gpu','cooler'];
  gaming.sequences.maintenance=safety.concat(maintenance.map(function(id){return action(id,false);}),maintenance.slice().reverse().map(function(id){return action(id,true);}),verify);
  gaming.initialStateAssembly={};gaming.initialStateDisassembly={};Object.keys(gaming.parts).forEach(function(id){gaming.initialStateAssembly[id]=false;gaming.initialStateDisassembly[id]=true;});
  gaming.spares=standard.spares.filter(function(id){return id!=='cooler';}).concat(['ram-b','ssd-m2-b','fan-cpu','fan-gpu','cable-gpu-fan']);
  gaming.diagnosticChannels={ram:['ram','ram-b'],ssd:['ssd-m2','ssd-m2-b'],fans:['cable-cpu-fan-laptop','cable-gpu-fan'],fanModules:['fan-cpu','fan-gpu'],cooler:'cooler',battery:'battery',batteryCable:'cable-battery',display:'cable-screen-flex',wifi:'wifi-card',antennas:['wifi-antenna-1','wifi-antenna-2'],gpu:true};
  var profiles={standard:{id:'standard',name:'Portátil estándar',description:'Un ventilador, un SO-DIMM y un M.2. Conserva la práctica completa de 22 componentes.',equipment:standard,capabilities:{solderedCPU:false,gpu:false}},gaming:{id:'gaming',name:'Portátil gamer',description:'CPU y GPU soldadas, dos ventiladores, dos SO-DIMM y dos M.2 independientes.',equipment:gaming,capabilities:{solderedCPU:true,gpu:true}}};
  gaming.capabilities=profiles.gaming.capabilities;
  // Prototypes keep gaming state in memory until profile-aware persistence is integrated.
  // No cloud migration, identity assumptions or checkpoint implementation here.
  var stores=new Map();
  function prototypeStorage(profileId){
    if(stores.has(profileId))return stores.get(profileId);
    var local=new Map();
    var storage={loadLocal:function(e,m){var s=local.get(e+':'+m);return s?copy(s):null;},persist:function(e,m,s){local.set(e+':'+m,copy(s));},clearLocal:function(e,m){local.delete(e+':'+m);}};
    stores.set(profileId,storage);return storage;
  }
  var api={list:function(){return Object.values(profiles);},get:function(id){var p=profiles[id||'standard'];if(!p)throw Error('Perfil de portátil desconocido: '+id);return p;},storage:function(id,fallback){return !id || id==='standard'?fallback:prototypeStorage(id);},register:function(profile){if(!profile||!profile.id||profiles[profile.id]||!profile.equipment)throw Error('Perfil inválido o duplicado');profiles[profile.id]=profile;}};
  H.LaptopProfiles=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
