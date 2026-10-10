/* A second physical laptop layout, using the common rig and component factories. */
import * as THREE from './vendor/three.module.min.js';
import {createLaptopLayout} from './hardware_lab_3d_layout_laptop.js?v=20261009_1';
import * as F from './hardware_lab_3d_laptop_factory.js?v=20261009_1';
import {silkTextTexture} from './hardware_lab_3d_textures.js?v=20261009_1';
import {materialFor} from './hardware_lab_3d_constants.js?v=20261009_1';
const v=(x,y,z)=>new THREE.Vector3(x,y,z),DOWN=[0,-1,0],FACE=[Math.PI,0,0],S=v(1.15,1.2,1.15);
const POS={cpu:[-.045,.0187,-.066],gpu:[.04,.0187,-.066],ram:[-.042,.017,.022],'ram-b':[.042,.017,.022],'ssd-m2':[-.133,.017,.026],'ssd-m2-b':[.133,.017,.026],'wifi-card':[-.035,.017,-.015],'fan-cpu':[-.132,.014,-.079],'fan-gpu':[.132,.014,-.079],battery:[0,.011,.098],cooler:[0,.0174,0]};
function box(g,size,pos,kind,name){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),materialFor(kind));m.position.fromArray(pos);m.name=name||'';g.add(m);return m;}
function scaled(built){built.group.scale.multiply(S);if(built.anchors)for(const val of Object.values(built.anchors)){if(val?.isVector3)val.multiply(S);else if(Array.isArray(val))val.forEach(p=>p.multiply(S));}return built;}
function label(g,text,pos,width=.022){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.008),new THREE.MeshStandardMaterial({map:silkTextTexture(text),transparent:true,depthWrite:false,roughness:.85,metalness:0}));
 mesh.name='decal';mesh.rotation.x=Math.PI/2;mesh.rotation.z=Math.PI;mesh.position.fromArray(pos);g.add(mesh);
}
function pcb(){
 const group=new THREE.Group();group.name='gaming-motherboard';
 const board=box(group,[.343,.0016,.177],[0,.02,-.027],'pcbBlue','gaming-pcb');
 // A matte solder mask keeps traces and service labels legible under the
 // workshop light. The cached override belongs only to this gaming board.
 board.material=materialFor('pcbBlue',{color:0x041322,roughness:.86,metalness:.03,envMapIntensity:.3});
 const anchors={};
 for(const[id,x]of[["CPU",-.045],["GPU",.04]])label(group,id,[x,.0189,-.042]);
 for(const[id,x]of[["RAM A",-.042],["RAM B",.042]])label(group,id,[x,.0189,.043]);
 for(const id of ['cpu','gpu']){
  const chip=F.buildLaptopCpu({size:.024});chip.name='gaming-'+id+'-soldered';chip.position.fromArray(POS[id]);chip.rotation.x=Math.PI;group.add(chip);anchors[id]=v(...POS[id]);
 }
 for(const id of ['ram','ram-b'])box(group,[.071,.0025,.004],[POS[id][0],.0183,POS[id][2]-.014],'plasticDark','socket-'+id);
 for(const id of ['ssd-m2','ssd-m2-b']){
  box(group,[.024,.0025,.006],[POS[id][0],.0183,POS[id][2]-.04],'plasticDark','socket-'+id);
  box(group,[.005,.0016,.005],[POS[id][0],.0184,POS[id][2]+.039],'metalDark','standoff-'+id);
 }
 box(group,[.005,.002,.024],[-.050,.018,-.015],'plasticDark','socket-wifi');
 // Distinct VRM banks flank the two soldered processors. Instanced repeated packages.
 const chips=new THREE.InstancedMesh(new THREE.BoxGeometry(.006,.002,.004),materialFor('plasticDark'),20),m=new THREE.Matrix4();
 for(let i=0;i<20;i++){const side=i<10?-1:1,j=i%10;m.makeTranslation(side*.075,.0182,-.093+j*.006);chips.setMatrixAt(i,m);}group.add(chips);
 return {group,anchors};
}
function blower(){
 const g=new THREE.Group();g.name='gaming-blower';
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.024,.002,6,40),materialFor('plasticDark'));ring.rotation.x=Math.PI/2;g.add(ring);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.006,20),materialFor('metalDark'));g.add(hub);
 const blades=new THREE.InstancedMesh(new THREE.BoxGeometry(.015,.004,.001),materialFor('plasticDark'),28),m=new THREE.Matrix4(),q=new THREE.Quaternion();
 for(let i=0;i<28;i++){const a=i*Math.PI*2/28;q.setFromAxisAngle(v(0,1,0),-a+.35);m.compose(v(Math.cos(a)*.015,0,Math.sin(a)*.015),q,v(1,1,1));blades.setMatrixAt(i,m);}
 blades.name='laptop-fan-rotor';blades.userData.rotorCenter=[0,0];g.add(blades);
 box(g,[.048,.002,.009],[0,.003,-.026],'plasticDark');
 for(const x of [-.023,.023])box(g,[.008,.002,.008],[x,-.002,.017],'metalDark');
 return g;
}
function thermal(){
 const g=new THREE.Group();g.name='gaming-dual-thermal';
 for(const [id,x] of [['cpu',-.045],['gpu',.04]]){
  box(g,[.034,.0016,.034],[x,-.0008,-.066],'copper');
  box(g,[.017,.0003,.017],[x,-.0001,-.066],'thermalPaste','cooler-contact-paste');
  for(const dx of [-.018,.018])box(g,[.008,.001,.007],[x+dx,-.001,-.066],'metalDark');
 }
 // Two primary routes to the corresponding radiators, plus one shared bridge.
 const routes=[
  [[-.045,-.066],[-.077,-.095],[-.132,-.116]],
  [[.04,-.066],[.077,-.095],[.132,-.116]],
  [[-.045,-.066],[-.035,-.098],[.029,-.098],[.04,-.066]]
 ];
 for(const route of routes){
  const points=route.map(([x,z])=>v(x,-.0022,z));
  const pipe=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.0021,6,false),materialFor('copper'));pipe.name='gaming-heatpipe';g.add(pipe);
 }
 const dust=new THREE.Group();dust.name='thermal-dust';
 for(const side of [-1,1]){
  const fins=new THREE.InstancedMesh(new THREE.BoxGeometry(.0006,.008,.013),materialFor('metalDark'),36),m=new THREE.Matrix4();
  for(let i=0;i<36;i++){m.makeTranslation(side*.132-.027+i*.0015,-.0047,-.115);fins.setMatrixAt(i,m);}g.add(fins);
  const d=box(dust,[.052,.005,.0006],[side*.132,-.0047,-.1083],'thermalPaste');d.material=d.material.clone();
 }
 g.add(dust);return g;
}
export function createGamingLayout(){
 const coverPoints=[[-.175,-.121],[.175,-.121],[-.172,.119],[.172,.119],[0,.119],[0,-.122]];
 const layout=createLaptopLayout({base:{
   vents:[{x:-.132/S.x,width:.058/S.x},{x:.132/S.x,width:.058/S.x}],
   coverScrews:coverPoints.map(([x,z])=>[x/S.x,z/S.z]),
   batterySupports:[[-.150,.078],[.150,.078],[-.150,.118],[.150,.118]].map(([x,z])=>[x/S.x,z/S.z,.0088/S.y])
 },cover:{intakeCenters:[[-.132/S.x,-.079/S.z],[.132/S.x,-.079/S.z]]}});layout.profileId='gaming';layout.thermalTargets=['gaming-cpu-soldered','gaming-gpu-soldered'];
 layout.partCatalog=typeof window!=='undefined'?window.HardwareLab.LaptopProfiles.get('gaming').equipment.parts:null;
 layout.structure=layout.structure.map(entry=>{
  if(entry.partId==='motherboard')return {...entry,build:pcb,mount:()=>v(0,0,0)};
  return {...entry,build:()=>scaled(entry.build()),mount:a=>entry.mount(a)};
 });
 const c={},common={detachAxis:DOWN,tier:1,trayRotationEuler:[0,0,0]};
 for(const id of ['ram','ram-b','ssd-m2','ssd-m2-b','wifi-card']){
  const source=id==='ram-b'?'ram':id==='ssd-m2-b'?'ssd-m2':id;
  c[id]={...layout.components[source],mount:()=>v(...POS[id])};
  if(id.startsWith('ssd'))c[id].rotationEuler=[Math.PI,Math.PI/2,0];
 }
 c.cooler={...common,build:thermal,mount:()=>v(...POS.cooler)};
 for(const side of ['cpu','gpu'])c['fan-'+side]={...common,build:blower,mount:()=>v(...POS['fan-'+side])};
 c.battery={...layout.components.battery,build:()=>{
  const g=F.buildLaptopBattery({width:.29,depth:.054,height:.006});
  for(const ear of g.children.filter(n=>n.name==='battery-ear'))g.remove(ear);
  for(const x of [-.150,.150])for(const z of [-.020,.020])box(g,[.010,.0008,.008],[x,.0026,z],'metalDark','gaming-battery-ear');
  return g;
 },mount:()=>v(...POS.battery)};
 for(const id of ['keyboard','touchpad']){
  const cfg=layout.components[id];c[id]={...cfg,build:()=>{const g=(id==='keyboard'?F.buildLaptopKeyboard:F.buildLaptopTouchpad)();g.scale.multiply(S);return g;}};
 }
 for(const [side,sign] of [['left',-1],['right',1]])c['speaker-'+side]={...layout.components['speaker-'+side],mount:()=>v(sign*.17,.0068,.098)};
 // Short internal leads need 1 mm slack; the desktop factory defaults to 30 mm.
 function cable(id,from,to,kind='power',waypoints=[]){c[id]={kind:'cable',cableKind:kind,from:()=>v(...from),to:()=>v(...to),waypoints:()=>waypoints.map(p=>v(...p)),detachAxis:DOWN,tier:3,buildOpts:{sag:.001,radius:kind==='power'?.0008:.0007,hitRadius:.0025,...(kind==='flex'||kind==='display'?{flat:true,ribbonWidth:.007}:{} )}};}
 cable('cable-battery',[.084,.011,.068],[.085,.015,.053]);
 cable('cable-cpu-fan-laptop',[-.109,.012,-.065],[-.085,.016,-.046]);
 cable('cable-gpu-fan',[.109,.012,-.065],[.085,.016,-.046]);
 cable('cable-keyboard-flex',[-.020,.021,.007],[-.020,.015,.049],'flex',[[-.019,.011,.054]]);
 cable('cable-touchpad-flex',[0,.021,.064],[.014,.015,.049],'flex',[[.015,.013,.062]]);
 cable('cable-screen-flex',[.16,.015,-.053],[.129,.022,-.122],'display',[[.173,.010,-.069],[.173,.010,-.12]]);
 cable('wifi-antenna-1',[-.0434,.012,-.02116],[-.131,.022,-.122],'antenna-main',[[-.06,.009,-.016],[-.17,.009,-.035],[-.172,.009,-.12]]);
 cable('wifi-antenna-2',[-.0434,.012,-.00884],[.132,.022,-.122],'antenna-aux',[[-.06,.010,-.011],[-.08,.010,.062],[.172,.010,.063],[.177,.010,-.12]]);
 for(const[side,sign]of[['left',-1],['right',1]])cable('cable-speaker-'+side,[sign*.162,.014,.045],[sign*.156,.002,.093],'power',[[sign*.161,.007,.064],[sign*.159,.006,.089]]);
 layout.components=c;
 // Inventory belongs to this chassis: six cover, four board, four thermal,
 // four fans, four battery, two SSD, one WLAN, two keyboard/touchpad, four hinges.
 const stockScrews=layout.screws;
 const stockPosition=(source,anchors)=>{
   const raw={};for(const [id,values]of Object.entries(anchors)){raw[id]={};for(const [key,value]of Object.entries(values))raw[id][key]=value?.isVector3?value.clone().divide(S):Array.isArray(value)?value.map(p=>p.clone().divide(S)):value;}
   return source.position(raw).multiply(S);
 };
 const screws=[];
 function screw(partId,point,n){screws.push({id:'gaming-'+partId+'-'+n,partId,label:'Tornillo '+n+' · '+(layout.partCatalog?.[partId]?.name||partId),position:()=>v(...point),outDir:DOWN});}
 coverPoints.forEach(([x,z],i)=>screw('bottom-cover',[x,-.0029,z],i+1));
 [[-.163,-.108],[.163,-.108],[-.161,.056],[.161,.056]].forEach(([x,z],i)=>screw('motherboard',[x,.0188,z],i+1));
 for(const [id,x]of[['cpu',-.045],['gpu',.04]])for(const [i,dx]of[-.018,.018].entries())screw('cooler',[x+dx,.0159,-.066],(id==='cpu'?0:2)+i+1);
 for(const side of ['cpu','gpu'])for(const [i,dx]of[-.023,.023].entries())screw('fan-'+side,[POS['fan-'+side][0]+dx,.011,-.062],i+1);
 for(const[i,[x,z]]of[[-.150,.078],[.150,.078],[-.150,.118],[.150,.118]].entries())screw('battery',[x,.008,z],i+1);
 for(const id of['ssd-m2','ssd-m2-b'])screw(id,[POS[id][0],.0164,POS[id][2]+.0388],1);
 screw('wifi-card',[-.021,.0165,-.015],1);
 for(const id of['keyboard','touchpad'])for(const[i,x]of[-1,1].entries())screws.push({...stockScrews.find(s=>s.partId===id),id:'gaming-'+id+'-'+i,partId:id,position:a=>{const source=stockScrews.filter(s=>s.partId===id)[i];return stockPosition(source,a);}});
 // Scaled stock hinge locations retain the mechanical leaf attachment.
 stockScrews.filter(s=>s.partId==='screen-assembly').forEach((s,i)=>screws.push({...s,id:'gaming-hinge-'+i,position:a=>stockPosition(s,a)}));
 layout.screws=screws;
 layout.traySlots={...layout.traySlots,'ram-b':{x:.87,z:.30},'ssd-m2-b':{x:.98,z:.30},'fan-cpu':{x:.9,z:.42},'fan-gpu':{x:1.02,z:.42},'cable-gpu-fan':{x:.85,z:.54},cooler:{x:.67,z:.56},'cable-speaker-left':{x:.45,z:.63},'cable-speaker-right':{x:.99,z:.63}};
 layout.traySlots.motherboard={x:.69,z:.15};layout.traySlots['bottom-cover']={x:.71,z:-.13};
 return layout;
}
