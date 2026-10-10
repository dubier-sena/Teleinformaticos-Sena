/* Rendering providers are separate from pure model data (which also runs in Node). */
import {createLaptopLayout} from './hardware_lab_3d_layout_laptop.js?v=20261009_1';
import {createGamingLayout} from './hardware_lab_3d_layout_gaming.js?v=20261009_1';
const builders=new Map([['standard',createLaptopLayout],['gaming',createGamingLayout]]);
export function registerLaptopLayout(profileId,builder){
  if(builders.has(profileId)||typeof builder!=='function')throw Error('Proveedor de layout inválido o duplicado');
  builders.set(profileId,builder);
}
export function createProfileLayout(profileId='standard'){
  const builder=builders.get(profileId);
  if(!builder)throw Error('El perfil no tiene un layout registrado: '+profileId);
  const layout=builder();layout.profileId=profileId;
  if(typeof window!=='undefined')layout.partCatalog=window.HardwareLab.LaptopProfiles?.get(profileId).equipment.parts;
  return layout;
}
