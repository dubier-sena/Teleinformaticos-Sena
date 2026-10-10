'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');const{pathToFileURL}=require('node:url');
const U=f=>pathToFileURL(path.resolve(__dirname,'../js',f)).href;
async function setup(){
 const T=await import(U('vendor/three.module.min.js')),I=await import(U('hardware_lab_3d_interactions.js')),C=await import(U('hardware_lab_3d_constants.js'));
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.01,10);camera.position.z=1;camera.updateMatrixWorld();
 const listeners=new Map(),el={style:{},getBoundingClientRect:()=>({left:0,top:0,right:400,bottom:400,width:400,height:400}),addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:(k)=>listeners.delete(k)};let tick;
 const layer=I.createInteractionLayer({scene,camera,renderer:{domElement:el},tweenGroup:{activeCount:0,killTarget(){},add(){}},onTick:f=>(tick=f,()=>{tick=null})});layer.setLaptopMode(true);
 const root=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(.1,.1,.03),new T.MeshStandardMaterial());root.add(mesh);scene.add(root);layer.registerInteractive(root,{partId:'ram',label:'RAM'});scene.updateMatrixWorld(true);
 return{T,I,C,scene,camera,el,listeners,layer,root,mesh,tick:()=>tick?.()};
}
test('V2: repeated selection reuses outline; visual scale/material unchanged and resources released',async()=>{
 const x=await setup(),mat=x.mesh.material;let disposed=0;
 x.layer.setSelected(x.root);const line=x.root.getObjectByName('hwlab-outline-select');line.geometry.addEventListener('dispose',()=>disposed++);
 for(let i=0;i<50;i++){x.layer.clearSelection();x.layer.setSelected(x.root);assert.equal(x.root.getObjectByName('hwlab-outline-select'),line)}
 assert.equal(x.mesh.material,mat);assert.deepEqual(x.root.scale.toArray(),[1,1,1]);x.layer.dispose();assert.equal(disposed,1);assert.equal(x.listeners.size,0);
});
test('V2: invisible hitboxes are selectable; hidden parents and solid occluders are respected',async()=>{
 const x=await setup();const proxy=x.C.markAsHitbox(new x.T.Mesh(new x.T.BoxGeometry(.16,.16,.04),new x.T.MeshBasicMaterial()));x.root.add(proxy);x.layer.registerInteractive(x.root,{partId:'ram'});x.scene.updateMatrixWorld(true);
 assert.equal(x.layer.pickAt(235,200,'mouse').root,x.root);
 x.root.visible=false;assert.equal(x.layer.pickAt(200,200,'mouse').root,null);x.root.visible=true;
 const wall=new x.T.Mesh(new x.T.BoxGeometry(.8,.8,.02),new x.T.MeshBasicMaterial());wall.position.z=.2;x.scene.add(wall);x.layer.registerOccluder(wall);x.scene.updateMatrixWorld(true);
 assert.equal(x.layer.pickAt(200,200,'touch').root,null);x.layer.dispose();
});
test('V2: touch assistance is larger than mouse, hover raycast sleeps with static pointer/camera',async()=>{
 const x=await setup();x.root.scale.setScalar(.1);x.scene.updateMatrixWorld(true);x.layer.setPickExpectation(()=>({expected:m=>m.partId==='ram'}));
 assert.equal(x.layer.pickAt(220,200,'touch').root,x.root);assert.equal(x.layer.pickAt(220,200,'mouse').root,null);
 let calls=0;const old=x.mesh.raycast;x.mesh.raycast=function(...args){calls++;return old.apply(this,args)};
 x.listeners.get('pointermove')({clientX:200,clientY:200,pointerType:'mouse'});x.tick();const once=calls;for(let i=0;i<60;i++)x.tick();assert.ok(once>0);assert.equal(calls,once);
 x.layer.dispose();
});

test('V2: stationary hover follows projection and canvas resize',async()=>{
 const x=await setup();x.root.position.x=.2;x.scene.updateMatrixWorld(true);
 x.listeners.get('pointermove')({clientX:297,clientY:200,pointerType:'mouse'});x.tick();assert.equal(x.layer.hovered,x.root);
 x.camera.aspect=2;x.camera.updateProjectionMatrix();x.tick();assert.equal(x.layer.hovered,null);
 x.camera.aspect=1;x.camera.updateProjectionMatrix();x.tick();assert.equal(x.layer.hovered,x.root);
 x.el.getBoundingClientRect=()=>({left:100,top:0,width:400,height:400});x.tick();assert.equal(x.layer.hovered,null);x.layer.dispose();
});
test('V2: two-finger gesture and camera drag do not select a part',async()=>{
 const x=await setup();let clicks=0;x.layer.onClick(()=>clicks++);
 const event=(id,xp=200)=>({pointerId:id,pointerType:'touch',clientX:xp,clientY:200,button:0});
 x.listeners.get('pointerdown')(event(1));x.listeners.get('pointerdown')(event(2));x.listeners.get('pointerup')(event(1));x.listeners.get('pointerup')(event(2));assert.equal(clicks,0);
 x.listeners.get('pointerdown')(event(3));x.listeners.get('pointerup')(event(3,250));assert.equal(clicks,0);
 x.listeners.get('pointerdown')(event(4));x.listeners.get('pointerup')(event(4));assert.equal(clicks,1);x.layer.dispose();
});
