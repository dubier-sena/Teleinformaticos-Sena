/* Laptop-only procedural finishes. Shared textures, no external assets or per-frame work. */
import * as THREE from './vendor/three.module.min.js';
const textures = new Map();
export function laptopFinish(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  // Seeded, repeatable microstructure. Linear roughness; never tagged sRGB.
  let seed = 7321;
  for (let y=0;y<128;y++) for(let x=0;x<128;x++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const v=kind==='metal'?170+(y%3)*12+(seed%9):236+(seed%8);
    ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,1,1);
  }
  const t=new THREE.CanvasTexture(c);t.name='laptop-v2-'+kind+'-roughness';
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;textures.set(kind,t);return t;
}
export function laptopPcbSurface(source,layout) {
  const key='motherboard';if(textures.has(key))return textures.get(key);
  const c=document.createElement('canvas');c.width=2048;c.height=512;
  const ctx=c.getContext('2d');ctx.drawImage(source.image,0,0,c.width,c.height);
  const pixels=ctx.getImageData(0,0,c.width,c.height);
  // Solder mask and copper routes have their own colour; silkscreen is printed on top.
  for(let i=0;i<pixels.data.length;i+=4){
    const ink=1-pixels.data[i]/255;
    pixels.data[i]=10+ink*65;pixels.data[i+1]=46+ink*66;pixels.data[i+2]=39+ink*60;
  }
  ctx.putImageData(pixels,0,0);
  const px=x=>(x/layout.width+.5)*c.width,py=z=>(.5-z/layout.depth)*c.height;
  ctx.strokeStyle='#7dbaab';ctx.fillStyle='#d6e9df';ctx.lineWidth=1.3;ctx.textBaseline='middle';
  for(const mark of layout.marks){
    if(mark.rect){const[x,z,w,d]=mark.rect;ctx.strokeRect(px(x-w/2),py(z+d/2),w/layout.width*c.width,d/layout.depth*c.height)}
    else if(mark.text){ctx.font='600 13px monospace';ctx.fillText(mark.text,px(mark.at[0]),py(mark.at[1]))}
  }
  ctx.font='bold 18px monospace';ctx.fillText('MB-14 / REV. C',45,475);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.name='laptop-v2-pcb-2048x512';textures.set(key,t);return t;
}

/** Clone each distinct material once per rig; never mutate the desktop cache. */
export function applyLaptopFinishes(root) {
  const clones=new Map();
  root.traverse(n=>{
    if(!n.isMesh||!n.material||Array.isArray(n.material)||!n.material.isMeshStandardMaterial)return;
    const m=n.material;
    // Decals and the colour-managed PCB already contain their own finish.
    if(n.name==='decal'||m.map?.name==='laptop-v2-pcb-2048x512')return;
    if(clones.has(m)){n.material=clones.get(m);return}
    const own=m.clone();clones.set(m,own);n.material=own;
    if(!own.map){
      own.roughnessMap=laptopFinish(own.metalness>.35?'metal':'polymer');
      if(own.metalness<.2){own.envMapIntensity=Math.min(own.envMapIntensity,.45);own.roughness=Math.max(.6,own.roughness)}
    }
    own.userData.laptopOwned=true;
  });
}
