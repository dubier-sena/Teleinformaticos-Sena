/* Pure, local evidence instruments. Values are didactic simulations, not sensors. */
(function (root) {
  'use strict';
  var TOOLS = [
    {id:'post',label:'POST e indicadores',subsystem:null},
    {id:'ram',label:'Prueba de memoria',subsystem:'memoria'},
    {id:'smart',label:'SMART / lectura SSD',subsystem:'almacenamiento'},
    {id:'temperature',label:'Temperatura y RPM',subsystem:'refrigeracion'},
    {id:'battery',label:'Capacidad de batería',subsystem:'energia'},
    {id:'wifi',label:'Enlace Wi-Fi',subsystem:'red'},
    {id:'display',label:'Señal de pantalla',subsystem:'imagen'},
    {id:'input',label:'Prueba de entrada',subsystem:'entrada'},
  ];
  function channels(data) {
    return data.diagnosticChannels || {ram:['ram'],ssd:['ssd-m2'],fans:['cable-cpu-fan-laptop'],fanModules:['cooler'],cooler:'cooler',battery:'battery',batteryCable:'cable-battery',display:'cable-screen-flex',wifi:'wifi-card',antennas:['wifi-antenna-1','wifi-antenna-2']};
  }
  function bad(data,session,id,engine) {
    if(session.parts[id]!==true)return true;
    return engine.conditionList(session.fixCondition).some(function(c){return c.partId===id&&!engine.conditionMet(data,session,c);});
  }
  function fanRPM(data,session,engine,index) {
    var c=channels(data),id=c.fans[index],module=c.fanModules&&c.fanModules[index];
    return !id || bad(data,session,id,engine) || (module && bad(data,session,module,engine)) ? 0 : 3200;
  }
  function hardware(data,session,engine) {
    var c=channels(data),p=session.parts;
    if(!p[c.battery]||!p[c.batteryCable])return {state:'apagado',screen:'off',post:false,message:'Sin alimentación interna disponible; revisa el montaje antes de energizar.'};
    if(!p.motherboard||!p[c.cooler])return {state:'apagado',screen:'off',post:false,message:'Montaje incompleto: la prueba de encendido está inhibida por seguridad.'};
    if(data.parts.cpu && !p.cpu)return {state:"falla",screen:"no-post",post:false,message:"La secuencia de inicialización no llega al POST; procesador sin instalar."};
    if(c.ram.every(function(id){return !p[id];})||c.ram.some(function(id){return p[id]&&bad(data,session,id,engine);}))return {state:'falla',screen:'no-post',post:false,message:'POST detenido en la comprobación de memoria; indicador de memoria intermitente.'};
    if(bad(data,session,c.display,engine)||!p['screen-assembly'])return {state:'falla',screen:'no-image',post:true,message:'POST completado y actividad de arranque, pero sin señal visible en el panel.'};
    if(bad(data,session,c.ssd[0],engine))return {state:'falla',screen:'no-boot',post:true,message:'POST completado; no se puede leer la unidad de arranque.'};
    if(c.fans.concat(c.fanModules||[]).some(function(id){return bad(data,session,id,engine);}))return {state:'falla',screen:'overheat',post:true,message:'La temperatura aumenta bajo carga y el rendimiento se limita.'};
    var pending=engine.pendingStage(data,session);
    if(pending)return {state:'falla',screen:pending.screen||'desktop',post:true,message:pending.symptomBroken};
    if(!root.HardwareLab.Thermal.isReady(session.thermal))return {state:'falla',screen:'overheat',post:true,message:'La carga térmica revela mantenimiento pendiente: temperatura elevada y limitación de rendimiento.'};
    return {state:'funcional',screen:'desktop',post:true,message:'POST completado. El sistema inicia y responde a las comprobaciones.'};
  }
  function run(data,session,id,engine,target) {
    var tool=TOOLS.find(function(t){return t.id===id;});
    if(!tool)return {ok:false,session:session,message:'Instrumento no disponible.'};
    var c=channels(data),p=session.parts,lines=[],h=hardware(data,session,engine),targets=[];
    if(id==='ram'||id==='smart'){
      targets=id==='ram'?c.ram:c.ssd;
      if(target){if(targets.indexOf(target)<0)return {ok:false,session:session,message:'Ese canal no pertenece al modelo.'};targets=[target];}
      targets.forEach(function(partId){
        var name=data.parts[partId].name;
        if(id==='smart' && p[partId] && !h.post){lines.push(name+': SMART no disponible antes del POST. Puede probarse en el banco aislado después de retirarlo.');return;}
        var damaged=engine.isDamaged(session,partId),fault=p[partId]?bad(data,session,partId,engine):damaged;
        if(!p[partId])name+=' · banco aislado';
        if(id==='ram')lines.push(name+': '+(fault?'Patrón 0xAA/0x55: 128 discrepancias en 3 pasadas.':'3 pasadas, 0 discrepancias detectadas.')+' Banco autónomo de memoria.');
        else lines.push(name+': '+(damaged?'SMART: 37 errores de integridad; prueba de lectura interrumpida.':fault?'Identificación intermitente; SMART no disponible.':'SMART: 0 errores de integridad; lectura completada.'));
      });
    }
    if(id==='post')lines=[h.message,'Indicador de alimentación: '+(h.state==='apagado'?'apagado':'encendido')+'. POST: '+(h.post?'completado':'sin completar')+'.'];
    if(id==='temperature'){
      var stopped=c.fans.concat(c.fanModules||[]).some(function(partId){return bad(data,session,partId,engine);}),thermal=root.HardwareLab.Thermal.isReady(session.thermal);
      lines.push('Carga didáctica de 60 s: CPU '+(stopped?98:thermal?64:94)+' °C; límite térmico '+(stopped||!thermal?'activo':'inactivo')+'.');
      c.fans.forEach(function(partId,i){lines.push('Ventilador '+(i+1)+': '+fanRPM(data,session,engine,i)+' RPM.');});
      if(c.gpu)lines.push('GPU: '+(stopped?96:thermal?68:92)+' °C bajo carga.');
      if(h.state==='apagado'||!h.post)lines=['Sin POST completado: no se puede ejecutar carga ni obtener una curva térmica.'];
    }
    if(id==='battery')lines=[!p[c.battery]?'Batería ausente: sin lectura del controlador.':'Capacidad de diseño: 50 Wh; capacidad a plena carga: '+(bad(data,session,c.battery,engine)?12:47)+' Wh; ciclos: '+(bad(data,session,c.battery,engine)?980:120)+'.'];
    if(id==='wifi')lines=[bad(data,session,c.wifi,engine)?'Interfaz no enumerada; no se puede iniciar la prueba de enlace.':c.antennas.some(function(partId){return bad(data,session,partId,engine);})?'Interfaz enumerada. Señal −86 dBm; pérdida de paquetes 28 % en enlace de referencia.':'Interfaz enumerada. Señal −48 dBm; pérdida de paquetes 0 % en enlace de referencia.'];
    if(id==='display')lines=[!p['screen-assembly']?'Panel ausente: no hay imagen de prueba disponible.':bad(data,session,c.display,engine)?'POST registrado; enlace eDP sin respuesta. Compara conectores y continuidad del cable con el equipo apagado.':'Enlace eDP establecido; patrón de imagen estable.'];
    if(id==='input')lines=['Teclado: '+(!p.keyboard||bad(data,session,'cable-keyboard-flex',engine)?'0 eventos':'eventos recibidos')+'; panel táctil: '+(bad(data,session,'cable-touchpad-flex',engine)||bad(data,session,'touchpad',engine)?'sin movimiento registrado':'coordenadas recibidas')+'.'];
    if(['wifi','display','input'].indexOf(id)>=0 && !h.post)lines=['POST sin completar: la prueba funcional no puede iniciarse todavía.'];
    var needsPower=['post','temperature','wifi','display','input'].indexOf(id)>=0 || (id==='smart' && targets.some(function(partId){return p[partId];}));
    if(needsPower && session.powerState==='apagado')lines=['Equipo apagado: pulsa Encender y comprobar antes de obtener esta lectura.'];
    var measured=!lines.every(function(line){return /no disponible antes|no se puede ejecutar|no puede iniciarse|Equipo apagado/.test(line);});
    var record={targets:targets.slice(),revision:session.hardwareRevision||0,measured:measured,tool:id,target:target||null,subsystem:tool.subsystem,lines:lines,atAction:(session.actionLog||[]).length};
    var updated=Object.assign({},session,{instrumentRecords:(session.instrumentRecords||[]).concat([record]),actionLog:(session.actionLog||[]).concat([{type:'instrument',tool:id,target:target||null,ok:true}]).slice(-200)});
    return {ok:true,session:updated,record:record,message:lines.join(' ')};
  }
  function verified(session) {
    return (session.verificationTools||[]).every(function(tool){
      var targets=(session.verificationTargets||{})[tool]||[null];
      return targets.every(function(target){return (session.instrumentRecords||[]).some(function(r){return r.measured!==false && r.tool===tool && r.revision===(session.hardwareRevision||0) && (!target || (r.targets||[]).indexOf(target)>=0);});});
    });
  }
  var MAX={diagnostico:20,procedimiento:15,seguridad:15,herramientas:10,reparacion:20,ensamblaje:10,verificacion:10};
  function score(data,session,engine){
    var stages=engine.stagesOf(session),progress=engine.stageProgress(data,session),ratio=progress.fixed/(progress.total||1),e=session.errorsByType||{},records=session.instrumentRecords||[],log=session.actionLog||[];
    function evidenceFor(stage,record){
      if(record.measured===false || record.subsystem!==engine.subsystemOf(stage))return false;
      var id=stage.fixCondition && stage.fixCondition.partId;
      return ['ram','smart'].indexOf(record.tool)<0 || (record.targets||[record.target]).indexOf(id)>=0;
    }
    var hypotheses=session.hypotheses||[];
    var diagnostic=stages.reduce(function(sum,st,i){var hyp=hypotheses.find(function(h){return h.stage===i;});var tested=records.some(function(r){return evidenceFor(st,r);});return sum+(hyp&&hyp.correct?(tested?1:.5):0);},0)/(stages.length||1);
    var worked=!!session.workEvidence?.worked || log.some(function(a){return a.type==='action'&&a.ok;}),maint=root.HardwareLab.Thermal.isReady(session.thermal),ready=engine.equipmentReadyForPowerTest(data,session,{screwsSecured:session.lastScrewsSecured!==false}).ready;
    var safe=!!session.workEvidence?.isolated || log.some(function(a){return a.type==='action'&&a.partId===channels(data).batteryCable&&a.action==='disconnect'&&a.ok;});
    var relevant=new Set(stages.map(function(st){return engine.subsystemOf(st);}));if(session.maintenanceRequired)relevant.add('refrigeracion');
    var evidenceCount=Array.from(relevant).filter(function(sub){return records.some(function(r){return r.measured!==false && r.subsystem===sub && stages.filter(function(st){return engine.subsystemOf(st)===sub;}).every(function(st){return records.some(function(row){return evidenceFor(st,row);});});});}).length;
    var values={
      diagnostico:Math.max(0,Math.round(20*diagnostic)-(session.hints.used||0)*3-(session.unjustifiedReplacements||[]).length*5),
      procedimiento:worked?Math.max(0,(maint?15:7)-(e.thermal||0)*3-(session.unnecessaryPartIds||[]).length):0,
      seguridad:safe?Math.max(0,15-(e.unsafe||0)*5):0,
      herramientas:worked?Math.max(0,Math.round(10*evidenceCount/(relevant.size||1))-(e.wrongTool||0)*3):0,
      reparacion:Math.round(20*ratio),
      ensamblaje:worked&&ready?10:0,
      verificacion:session.fixed?10:0,
    },out={total:0};
    Object.keys(MAX).forEach(function(k){out[k]={value:Math.min(MAX[k],values[k]),max:MAX[k]};out.total+=out[k].value;});return out;
  }
  var api={TOOLS:TOOLS,MAX:MAX,channels:channels,fanRPM:fanRPM,verified:verified,hardware:hardware,run:run,score:score};
  root.HardwareLab=root.HardwareLab||{};root.HardwareLab.DiagnosticsV3=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
