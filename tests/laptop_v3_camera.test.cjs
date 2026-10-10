'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const{pathToFileURL}=require('node:url');
const u=f=>pathToFileURL(path.resolve(__dirname,'../js',f)).href;
async function setup(){
 const T=await import(u('vendor/three.module.min.js')),I=await import(u('hardware_lab_3d_interactions.js'));
 const camera=new T.PerspectiveCamera(45,1,.001,10);camera.position.z=1;camera.updateMatrixWorld();const scene=new T.Scene(),listeners=new Map();
 const el={style:{},getBoundingClientRect:()=>({left:0,top:0,right:400,bottom:400,width:400,height:400}),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 const layer=I.createInteractionLayer({scene,camera,renderer:{domElement:el},tweenGroup:{activeCount:0,killTarget(){},add(){}},onTick:()=>()=>{}});layer.setLaptopMode(true);layer.setFreeGestures(true);
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(.1,.1,.03),new T.MeshStandardMaterial()));scene.add(root);layer.registerInteractive(root,{partId:'ram'});scene.updateMatrixWorld(true);
 const send=(kind,x=200,y=200,id=1,type='mouse')=>listeners.get(kind)({clientX:x,clientY:y,pointerId:id,pointerType:type,button:0});
 return{T,layer,root,listeners,send};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('V3 double click/tap focuses without any action; single tap operates once after discrimination',async()=>{
 for(const type of ['mouse','touch']){
  const x=await setup();let actions=0,focus=0;x.layer.onClick(()=>actions++);x.layer.onFocus(()=>focus++);
  x.send('pointerdown',200,200,1,type);x.send('pointerup',200,200,1,type);assert.equal(x.layer.selected,x.root);
  x.send('pointerdown',200,200,1,type);x.send('pointerup',200,200,1,type);await wait(325);assert.equal(actions,0);assert.equal(focus,1);
  x.send('pointerdown',200,200,1,type);x.send('pointerup',200,200,1,type);await wait(325);assert.equal(actions,1);x.layer.dispose();
 }
});
test('V3 returning drag, pinch and wheel cancel operation; inspection guard sees selection but blocks controller',async()=>{
 const x=await setup();let actions=0,inspected=0;x.layer.onClick(()=>actions++);
 x.send('pointerdown');x.send('pointermove',250);x.send('pointermove',200);x.send('pointerup');await wait(325);assert.equal(actions,0);
 x.send('pointerdown');x.send('pointerup');x.listeners.get('wheel')();await wait(325);assert.equal(actions,0);
 x.send('pointerdown',200,200,1,'touch');x.send('pointerdown',210,200,2,'touch');x.send('pointerup',210,200,2,'touch');x.send('pointerup',200,200,1,'touch');await wait(325);assert.equal(actions,0);
 x.layer.setClickGuard(()=>{inspected++;return false});x.send('pointerdown');x.send('pointerup');await wait(325);assert.equal(inspected,1);assert.equal(actions,0);x.layer.dispose();
});
test('V3 camera barrier stops fast zoom through a panel, allows side travel and escape; follows moved parts',async()=>{
 const T=await import(u('vendor/three.module.min.js')),{createCameraBarrier}=await import(u('hardware_lab_3d_camera_collision.js'));
 const root=new T.Group(),panel=new T.Mesh(new T.BoxGeometry(.3,.003,.2),new T.MeshStandardMaterial());root.add(panel);const barrier=createCameraBarrier(root);
 assert.equal(barrier.surfaceCount,1);
 const from=new T.Vector3(0,.1,0),to=new T.Vector3(0,-.1,0);assert.equal(barrier.constrain(from,to),true);assert.ok(to.y>.0015);
 const side=new T.Vector3(.4,-.1,0);assert.equal(barrier.constrain(new T.Vector3(.4,.1,0),side),false);
 panel.position.y=.5;const moved=new T.Vector3(0,.4,0);assert.equal(barrier.constrain(new T.Vector3(0,.6,0),moved),true);assert.ok(moved.y>.5015);
 const escape=new T.Vector3(0,.6,0);assert.equal(barrier.constrain(new T.Vector3(0,.5,0),escape),false);
 panel.visible=false;assert.equal(barrier.constrain(new T.Vector3(0,.6,0),new T.Vector3(0,.4,0)),false);barrier.dispose();assert.equal(barrier.surfaceCount,0);
});
test('V3 an invisible proxy protruding through a different part cannot select the hidden part',async()=>{
 const x=await setup(),C=await import(u('hardware_lab_3d_constants.js'));
 const proxy=C.markAsHitbox(new x.T.Mesh(new x.T.BoxGeometry(.2,.2,.5),new x.T.MeshBasicMaterial()));x.root.add(proxy);x.layer.registerInteractive(x.root,{partId:'ram'});
 const wall=new x.T.Group();wall.add(new x.T.Mesh(new x.T.BoxGeometry(.5,.5,.02),new x.T.MeshStandardMaterial()));wall.position.z=.15;x.root.parent.add(wall);x.layer.registerInteractive(wall,{partId:'battery'});wall.parent.updateMatrixWorld(true);
 x.layer.setPickExpectation(()=>({expected:m=>m.partId==='ram'}));assert.equal(x.layer.pickAt(200,200,'touch').root,wall);x.layer.dispose();
});
test('V3 touch up followed by implicit pointerleave preserves tap and double tap',async()=>{
 const x=await setup();let actions=0,focus=0;x.layer.onClick(()=>actions++);x.layer.onFocus(()=>focus++);
 const tap=()=>{x.send('pointerdown',200,200,1,'touch');x.send('pointerup',200,200,1,'touch');x.send('pointerleave',200,200,1,'touch');};
 tap();await wait(325);assert.equal(actions,1);
 tap();tap();await wait(325);assert.equal(actions,1);assert.equal(focus,1);x.layer.dispose();
});
test('V3 changing inspection cancels a delayed action and an active pointer leaving cancels the gesture',async()=>{
 const x=await setup();let actions=0;x.layer.onClick(()=>actions++);
 x.send('pointerdown');x.send('pointerup');x.layer.cancelPendingTap();await wait(325);assert.equal(actions,0);
 x.send('pointerdown');x.send('pointermove',260);x.send('pointerleave',420);x.send('pointerup');await wait(325);assert.equal(actions,0);x.layer.dispose();
});
test('V3 camera cannot cross the actual thin chassis side walls',async()=>{
 global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>({width:10,data:new Uint8ClampedArray(4)})})})};
 const T=await import(u('vendor/three.module.min.js')),{buildLaptopBase}=await import(u('hardware_lab_3d_laptop_factory.js')),{createCameraBarrier}=await import(u('hardware_lab_3d_camera_collision.js'));
 const built=buildLaptopBase(),root=built.group||built,barrier=createCameraBarrier(root);
 for(const z of [.03,.06,.08]){const to=new T.Vector3(.15,.012,z);assert.equal(barrier.constrain(new T.Vector3(.2,.012,z),to),true);assert.ok(to.x>.165);}
 barrier.dispose();
});
test('V3 broad phase does not close an actual opening in a large surface',async()=>{
 const T=await import(u('vendor/three.module.min.js')),{createCameraBarrier}=await import(u('hardware_lab_3d_camera_collision.js'));
 const root=new T.Group(),ring=new T.Mesh(new T.TorusGeometry(.08,.01,8,24),new T.MeshStandardMaterial());root.add(ring);const barrier=createCameraBarrier(root);
 const throughHole=new T.Vector3(0,0,-.1);assert.equal(barrier.constrain(new T.Vector3(0,0,.1),throughHole),false);
 const throughRing=new T.Vector3(.08,0,-.1);assert.equal(barrier.constrain(new T.Vector3(.08,0,.1),throughRing),true);barrier.dispose();
});
