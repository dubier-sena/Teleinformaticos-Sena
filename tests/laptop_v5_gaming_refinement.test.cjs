'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const url=f=>pathToFileURL(path.resolve(__dirname,'../js',f)).href;
function canvas(){global.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>({width:10,data:new Uint8ClampedArray(4)})})})};}
async function modules(){canvas();return {T:await import(url('vendor/three.module.min.js')),F:await import(url('hardware_lab_3d_parts_factory.js')),L:await import(url('hardware_lab_3d_layout_gaming.js')),C:await import(url('hardware_lab_3d_constants.js')),I:await import(url('hardware_lab_3d_interactions.js'))};}
for(const id of ['cable-battery','cable-cpu-fan-laptop','cable-gpu-fan'])test('V5 Gamer: short cable stays inside chassis, '+id,async()=>{
 const {T,F,L}=await modules(),cfg=L.createGamingLayout().components[id];
 const g=F.buildCable(cfg.cableKind,cfg.from(),cfg.to(),{...cfg.buildOpts,waypoints:cfg.waypoints()});
 const proxy=g.getObjectByName('cable-hit-proxy'),curve=proxy.geometry.parameters.path;
 // The service cavity is above the lower cover at y=0. A desktop 30 mm
 // sag passes through that cover even when both cable ends are inside.
 for(let i=0;i<=100;i++)assert.ok(curve.getPoint(i/100).y-cfg.buildOpts.radius>=.003,id+' crosses the lower cover');
 const bounds=new T.Box3().setFromObject(proxy);assert.ok(bounds.min.y>0,'click proxy crosses cover');
 assert.deepEqual(curve.getPoint(0).toArray(),cfg.from().toArray());
 assert.ok(curve.getPoint(1).distanceTo(cfg.to())<1e-12);
});
test('V5 Gamer: cable hitboxes do not expand visible selection contours',async()=>{
 const {T,F,L,I,C}=await modules();
 for(const [id,cfg] of Object.entries(L.createGamingLayout().components).filter(([,c])=>c.kind==='cable')){
  const g=F.buildCable(cfg.cableKind,cfg.from(),cfg.to(),{...cfg.buildOpts,waypoints:cfg.waypoints()});g.updateMatrixWorld(true);
  const proxy=g.getObjectByName('cable-hit-proxy');assert.ok(C.isHitbox(proxy));assert.equal(proxy.material.opacity,0);assert.equal(proxy.castShadow,false);
  const before=I.visibleLocalBox(g).clone();proxy.scale.setScalar(20);g.updateMatrixWorld(true);
  const after=I.visibleLocalBox(g);assert.ok(before.min.distanceTo(after.min)<1e-10,id);assert.ok(before.max.distanceTo(after.max)<1e-10,id);
 }
});
