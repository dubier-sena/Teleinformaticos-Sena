/* Laptop camera barrier: individual opaque panels, never a whole-chassis hull. */
import * as THREE from './vendor/three.module.min.js';
import { isHitbox } from './hardware_lab_3d_constants.js?v=20261009_1';

export function createCameraBarrier(root, clearance = .0015) {
  const surfaces = [], local = new THREE.Box3(), world = new THREE.Box3(), size = new THREE.Vector3();
  const instance = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  root.traverse(mesh => {
    if (!mesh.isMesh || isHitbox(mesh) || mesh.name.startsWith('hwlab-outline')) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.every(m => m.transparent && m.opacity < .5)) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const count = mesh.isInstancedMesh ? mesh.count : 1;
    for (let i = 0; i < count; i++) {
      local.copy(mesh.geometry.boundingBox);
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); local.applyMatrix4(instance); }
      world.copy(local).applyMatrix4(mesh.matrixWorld);world.getSize(size);
      const dimensions = [size.x,size.y,size.z].sort((a,b)=>b-a);
      if (dimensions[1] < .025 && !(dimensions[0] >= .05 && dimensions[1] >= .006)) continue; // chips, pins and screw heads are not camera walls
      surfaces.push({mesh, local:local.clone(), inverse:new THREE.Matrix4()});
    }
  });
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  const movement = new THREE.Vector3(), safe = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), hits = [], tested = new Set();
  return {
    get surfaceCount() { return surfaces.length; },
    constrain(previous, requested) {
      movement.subVectors(requested,previous);const distance=movement.length();
      if(distance<1e-9)return false;
      let fraction=1;
      raycaster.set(previous, movement.clone().normalize());raycaster.near=0;raycaster.far=distance;tested.clear();
      for(const surface of surfaces){
        let shown=true;for(let n=surface.mesh;n;n=n.parent)if(!n.visible){shown=false;break}
        if(!shown)continue;
        surface.mesh.updateWorldMatrix(true,false);
        surface.inverse.copy(surface.mesh.matrixWorld).invert();
        a.copy(previous).applyMatrix4(surface.inverse);b.copy(requested).applyMatrix4(surface.inverse);
        // Work in mesh-local space so rotated panels do not become solid AABB rooms.
        const length=a.distanceTo(b);if(length<1e-10)continue;
        ray.set(a,b.sub(a).normalize());
        if(ray.intersectBox(surface.local,hit) && !tested.has(surface.mesh)){
          // The box is only a broad phase: holes between pipes/blades stay free.
          // Closed surfaces use outward faces, also allowing an enclosed lens
          // to escape after a model animation without getting trapped.
          tested.add(surface.mesh);hits.length=0;
          raycaster.intersectObject(surface.mesh,false,hits);
          if(hits.length)fraction=Math.min(fraction,Math.max(0,(hits[0].distance-clearance)/distance));
        }
      }
      if(fraction>=1)return false;
      safe.copy(previous).addScaledVector(movement,fraction);requested.copy(safe);return true;
    },
    dispose(){surfaces.length=0;}
  };
}
